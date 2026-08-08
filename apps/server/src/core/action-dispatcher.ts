import type { BotAction, DiscordNotifyEvent } from "@streamops/shared";
import { newId, toSafeErrorMessage, validateBotAction } from "@streamops/shared";
import type { TwitchChatService } from "../services/twitch-chat-service.js";
import type { ActionRecord, Store } from "../services/store.js";
import type { JsonlLogger } from "../logging/jsonl-logger.js";
import { renderObjectTemplates, type TemplateContext } from "./template.js";

const TEMPLATE_PATTERN = /\{([a-zA-Z0-9_]+)\}/;

function validateTemplateSafety(action: BotAction): string | undefined {
  return TEMPLATE_PATTERN.test(action.type)
    ? "action.type에는 템플릿을 사용할 수 없습니다."
    : undefined;
}

/* Discord 알림 발행자.
 *
 * dispatcher 는 어느 길드·채널로 보낼지 모릅니다. streamerId 만 넘기고,
 * 실제 대상은 구현체가 Dashboard 에 등록된 target 에서 읽습니다.
 * 아직 구현체가 없으므로 주입하지 않으면 action 은 skipped 로 기록됩니다.
 */
export type DiscordAnnouncementPublisher = {
  publish(input: { event: DiscordNotifyEvent; streamerId: string }): Promise<void>;
};

export class ActionDispatcher {
  constructor(
    private readonly twitchChat: TwitchChatService,
    private readonly store: Store,
    private readonly logger: JsonlLogger,
    private readonly discordAnnouncements?: DiscordAnnouncementPublisher
  ) {}

  async dispatch(actions: BotAction[], ctx: TemplateContext = {}, reason?: string): Promise<void> {
    for (const action of actions) await this.dispatchOne(action, ctx, reason);
  }

  async dispatchOne(rawAction: BotAction, ctx: TemplateContext = {}, reason?: string): Promise<void> {
    const actionId = newId("action");
    const templateSafetyError = validateTemplateSafety(rawAction);
    if (templateSafetyError) {
      this.recordFailure(actionId, rawAction, templateSafetyError, reason, "action.template_blocked");
      return;
    }

    const action = this.renderAction(rawAction, ctx);
    const validation = validateBotAction(action);
    if (!validation.ok) {
      this.recordFailure(actionId, action, validation.error, reason, "action.validation_failed");
      return;
    }

    try {
      let status: ActionRecord["status"] = "ok";
      const streamerId = typeof ctx.streamerId === "string" && ctx.streamerId.trim()
        ? ctx.streamerId.trim()
        : undefined;
      switch (action.type) {
        case "twitch.chat":
          await this.twitchChat.sendChatMessage(action.message, { reason });
          break;
        case "queue.question": {
          const question = this.store.addQuestion({
            userName: action.userName ?? "unknown",
            question: action.question,
            translatedQuestion: action.translatedQuestion
          });
          this.logger.question(question as unknown as Record<string, unknown>);
          break;
        }
        case "log.highlight": {
          const highlight = this.store.addHighlight({ userName: action.userName, reason: action.reason });
          this.logger.highlight(highlight as unknown as Record<string, unknown>);
          break;
        }
        case "participation.open":
          if (streamerId && this.store.getParticipationSession(streamerId)?.status === "completed") {
            this.logger.event({ type: "participation.open_ignored", reason: "completed_session", streamerId });
            status = "skipped";
          } else {
            this.store.setParticipationOpen(true, streamerId);
          }
          break;
        case "participation.close":
          this.store.setParticipationOpen(false, streamerId);
          break;
        /* 발행자가 없거나 streamerId 를 모르면 조용히 성공했다고 하지 않고 skipped 로 남깁니다. */
        case "discord.notify":
          if (!streamerId) {
            this.logger.event({ type: "discord.notify_skipped", reason: "missing_streamer" });
            status = "skipped";
          } else if (!this.discordAnnouncements) {
            this.logger.event({ type: "discord.notify_skipped", reason: "publisher_unavailable" });
            status = "skipped";
          } else {
            await this.discordAnnouncements.publish({ event: action.event, streamerId });
          }
          break;
        case "noop":
          break;
      }
      this.logger.action({ id: actionId, type: action.type, status, reason });
      this.store.addAction({ id: actionId, type: action.type, status, createdAt: new Date().toISOString() });
    } catch (error) {
      this.recordFailure(actionId, action, toSafeErrorMessage(error), reason, "action.dispatch_failed");
    }
  }

  private renderAction(rawAction: BotAction, ctx: TemplateContext): BotAction {
    if (rawAction.type === "twitch.chat") {
      return { ...rawAction, message: this.twitchChat.renderMessageTemplate(rawAction.message, ctx) };
    }
    /* discord.notify 는 템플릿을 전혀 렌더링하지 않습니다.
       렌더가 검증보다 먼저 돌기 때문에, "{key}" 를 두면 context 값이 event 로 치환되어
       고정 enum 을 우회할 수 있습니다. 이 action 에는 치환할 자유 필드가 없으므로
       원문 그대로 검증합니다. */
    if (rawAction.type === "discord.notify") return rawAction;
    return renderObjectTemplates(rawAction, ctx) as BotAction;
  }

  private recordFailure(
    actionId: string,
    action: BotAction,
    error: string,
    reason: string | undefined,
    eventType: string
  ): void {
    this.logger.error({ type: eventType, action, error });
    this.logger.action({ id: actionId, type: action.type, status: "failed", error, reason });
    this.store.addAction({
      id: actionId,
      type: action.type,
      status: "failed",
      error,
      createdAt: new Date().toISOString()
    });
  }
}
