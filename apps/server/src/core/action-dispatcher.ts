import type { BotAction } from "@streamops/shared";
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

export class ActionDispatcher {
  constructor(
    private readonly twitchChat: TwitchChatService,
    private readonly store: Store,
    private readonly logger: JsonlLogger
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
