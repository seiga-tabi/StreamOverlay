import type { BotAction, OverlayBannerMessage, OverlayMessage } from "@streamops/shared";
import { isObsAction, newId, toSafeErrorMessage, validateBotAction, validateOverlayMessage } from "@streamops/shared";
import type { BridgeManager } from "../services/bridge-manager.js";
import type { TwitchChatService } from "../services/twitch-chat-service.js";
import type { OverlayHub } from "../services/overlay-hub.js";
import type { ActionRecord, Store } from "../services/store.js";
import type { JsonlLogger } from "../logging/jsonl-logger.js";
import type { LocalTtsService } from "../services/local-tts-service.js";
import { appConfig } from "../config.js";
import { renderObjectTemplates, type TemplateContext } from "./template.js";

const TEMPLATE_PATTERN = /\{([a-zA-Z0-9_]+)\}/;
const OVERLAY_COOLDOWN_MS = 1500;
const DEFAULT_OVERLAY_TTS_BROADCAST_WAIT_MS = 15_000;

function hasTemplate(value: unknown): boolean {
  if (typeof value === "string") return TEMPLATE_PATTERN.test(value);
  if (Array.isArray(value)) return value.some((item) => hasTemplate(item));
  if (value && typeof value === "object") return Object.values(value).some((item) => hasTemplate(item));
  return false;
}

function validateTemplateSafety(rawAction: BotAction): string | undefined {
  if (typeof rawAction.type === "string" && TEMPLATE_PATTERN.test(rawAction.type)) {
    return "action.type에는 템플릿을 사용할 수 없습니다.";
  }
  if (isObsAction(rawAction) && hasTemplate(rawAction)) {
    return "obs.* action에는 viewer 템플릿을 사용할 수 없습니다.";
  }
  return undefined;
}

export class ActionDispatcher {
  private readonly lastOverlaySentAtByKey = new Map<string, number>();

  constructor(
    private readonly bridge: BridgeManager,
    private readonly twitchChat: TwitchChatService,
    private readonly overlay: OverlayHub,
    private readonly store: Store,
    private readonly logger: JsonlLogger,
    private readonly onActionRecorded?: () => void,
    private readonly localTts?: LocalTtsService
  ) {}

  async dispatch(actions: BotAction[], ctx: TemplateContext = {}, reason?: string): Promise<void> {
    for (const rawAction of actions) {
      await this.dispatchOne(rawAction, ctx, reason);
    }
  }

  async dispatchOne(rawAction: BotAction, ctx: TemplateContext = {}, reason?: string): Promise<void> {
    const actionId = newId("action");
    const templateSafetyError = validateTemplateSafety(rawAction);
    if (templateSafetyError) {
      this.logger.error({ type: "action.template_blocked", action: rawAction, error: templateSafetyError });
      this.logger.action({ id: actionId, type: String((rawAction as { type?: string }).type), status: "failed", error: templateSafetyError, reason });
      this.recordAction({ id: actionId, type: String((rawAction as { type?: string }).type), status: "failed", error: templateSafetyError, createdAt: new Date().toISOString() });
      return;
    }

    const action = this.renderAction(rawAction, ctx);
    const validation = validateBotAction(action);
    if (!validation.ok) {
      this.logger.error({ type: "action.validation_failed", action, error: validation.error });
      this.logger.action({ id: actionId, type: String((action as { type?: string }).type), status: "failed", error: validation.error, reason });
      this.recordAction({ id: actionId, type: String((action as { type?: string }).type), status: "failed", error: validation.error, createdAt: new Date().toISOString() });
      return;
    }

    try {
      let actionStatus: ActionRecord["status"] = "ok";
      if (isObsAction(action)) {
        const commandId = this.bridge.send(action, reason);
        this.logger.action({ id: actionId, type: action.type, status: "sent_to_bridge", commandId, reason });
        this.recordAction({ id: actionId, type: action.type, status: "ok", createdAt: new Date().toISOString() });
        return;
      }

      switch (action.type) {
        case "twitch.chat":
          await this.twitchChat.sendChatMessage(action.message, { reason });
          break;
        case "overlay.banner": {
          const message: OverlayBannerMessage = {
            type: "overlay.banner",
            title: action.title,
            subtitle: action.subtitle,
            message: action.message,
            durationMs: action.durationMs,
            variant: action.variant,
            source: action.source ?? reason,
            eventKind: action.eventKind,
            mediaUrl: action.mediaUrl,
            mediaAlt: action.mediaAlt,
            soundUrl: action.soundUrl,
            soundVolume: action.soundVolume,
            speechEnabled: action.speechEnabled,
            speechText: action.speechText,
            speechAudioUrl: action.speechAudioUrl,
            speechLanguage: action.speechLanguage,
            speechRate: action.speechRate,
            speechPitch: action.speechPitch,
            speechVolume: action.speechVolume
          };
          await this.attachOverlaySpeech(message);
          actionStatus = this.broadcastOverlay(message);
          break;
        }
        case "overlay.subtitle":
          actionStatus = this.broadcastOverlay({
            type: "subtitle.update",
            sourceLanguage: action.sourceLanguage,
            targetLanguage: action.targetLanguage,
            original: action.original,
            translated: action.translated,
            isFinal: action.isFinal ?? true,
            durationMs: action.durationMs,
            variant: action.variant,
            source: action.source ?? reason
          });
          break;
        case "overlay.subtitleBoost":
          actionStatus = this.broadcastOverlay({ type: "subtitle.boost", title: action.title, message: action.message, durationMs: action.durationMs, variant: action.variant, source: action.source ?? reason });
          break;
        case "overlay.question":
          actionStatus = this.broadcastOverlay({ type: "question.show", userName: action.userName, question: action.question, translatedQuestion: action.translatedQuestion, durationMs: action.durationMs, variant: action.variant, source: action.source ?? reason });
          break;
        case "overlay.mission":
          actionStatus = this.broadcastOverlay({ type: "mission.update", title: action.title, missions: action.missions, durationMs: action.durationMs, variant: action.variant, source: action.source ?? reason });
          break;
        case "overlay.participationQueue":
          actionStatus = this.broadcastOverlay({ type: "participation.queue.update", isOpen: action.isOpen, queue: action.queue, durationMs: action.durationMs, variant: action.variant, source: action.source ?? reason });
          break;
        case "overlay.participationStatus":
          actionStatus = this.broadcastOverlay({
            type: "participation.status.update",
            isOpen: action.isOpen,
            mode: action.mode,
            phase: action.phase,
            message: action.message,
            nextCandidate: action.nextCandidate,
            streamerProfile: action.streamerProfile,
            durationMs: action.durationMs,
            variant: action.variant,
            source: action.source ?? reason
          });
          break;
        case "overlay.participationSelected":
          actionStatus = this.broadcastOverlay({
            type: "participation.selected.show",
            twitchUserName: action.twitchUserName,
            preferredRole: action.preferredRole,
            checkInSeconds: action.checkInSeconds,
            profileStatus: action.profileStatus,
            mainRole: action.mainRole,
            mainRoleConfidence: action.mainRoleConfidence,
            topChampions: action.topChampions,
            rankedStats: action.rankedStats,
            durationMs: action.durationMs,
            variant: action.variant,
            source: action.source ?? reason
          });
          break;
        case "overlay.participationTeams":
          actionStatus = this.broadcastOverlay({ type: "participation.teams.update", teams: action.teams, durationMs: action.durationMs, variant: action.variant, source: action.source ?? reason });
          break;
        case "overlay.soloRankProfile":
          actionStatus = this.broadcastOverlay({
            type: "solo-rank.profile.update",
            profile: action.profile,
            region: action.region,
            queueLabel: action.queueLabel,
            ladderRank: action.ladderRank,
            durationMs: action.durationMs,
            variant: action.variant,
            source: action.source ?? reason
          });
          break;
        case "overlay.emergency":
          actionStatus = this.broadcastOverlay(action.active === false
            ? { type: "emergency.clear", durationMs: action.durationMs, variant: action.variant, source: action.source ?? reason }
            : { type: "emergency.show", title: action.title, message: action.message, durationMs: action.durationMs, variant: action.variant ?? "danger", source: action.source ?? reason });
          break;
        case "queue.question": {
          const question = this.store.addQuestion({ userName: action.userName ?? "unknown", question: action.question, translatedQuestion: action.translatedQuestion });
          this.logger.question(question as unknown as Record<string, unknown>);
          break;
        }
        case "log.highlight": {
          const highlight = this.store.addHighlight({ userName: action.userName, reason: action.reason });
          this.logger.highlight(highlight as unknown as Record<string, unknown>);
          break;
        }
        case "participation.open":
          this.store.setParticipationOpen(true);
          actionStatus = this.broadcastOverlay({ type: "overlay.banner", title: "参加募集", message: "参加募集を開始しました。", variant: "success", durationMs: 5000, source: reason });
          this.broadcastOverlay({
            type: "participation.status.update",
            isOpen: true,
            mode: action.mode,
            phase: "recruiting",
            message: "롤 시참 모집 중",
            streamerProfile: this.store.getParticipationStreamerProfile(),
            source: reason
          });
          this.broadcastOverlay({
            type: "participation.queue.update",
            isOpen: true,
            queue: this.store.getParticipationOverlayQueue(),
            source: reason
          });
          break;
        case "participation.close":
          this.store.setParticipationOpen(false);
          actionStatus = this.broadcastOverlay({ type: "overlay.banner", title: "시참 모집", message: "롤 시참 모집을 종료합니다.", variant: "info", durationMs: 5000, source: reason });
          this.broadcastOverlay({
            type: "participation.status.update",
            isOpen: false,
            phase: "closed",
            message: "롤 시참 모집 종료",
            streamerProfile: this.store.getParticipationStreamerProfile(),
            source: reason
          });
          this.broadcastOverlay({
            type: "participation.queue.update",
            isOpen: false,
            queue: this.store.getParticipationOverlayQueue(),
            source: reason
          });
          break;
        case "noop":
          break;
      }
      this.logger.action({ id: actionId, type: action.type, status: actionStatus, reason });
      this.recordAction({ id: actionId, type: action.type, status: actionStatus, createdAt: new Date().toISOString() });
    } catch (error) {
      const safeError = toSafeErrorMessage(error);
      this.logger.error({ type: "action.dispatch_failed", action, error: safeError });
      this.logger.action({ id: actionId, type: action.type, status: "failed", error: safeError, reason });
      this.recordAction({ id: actionId, type: action.type, status: "failed", error: safeError, createdAt: new Date().toISOString() });
    }
  }

  private renderAction(rawAction: BotAction, ctx: TemplateContext): BotAction {
    if (rawAction.type === "twitch.chat") {
      return {
        ...rawAction,
        message: this.twitchChat.renderMessageTemplate(rawAction.message, ctx)
      };
    }
    return renderObjectTemplates(rawAction, ctx) as BotAction;
  }

  private async attachOverlaySpeech(message: OverlayBannerMessage): Promise<void> {
    if (!this.localTts || !appConfig.localTts.enabled || message.speechEnabled !== true || message.speechAudioUrl) return;

    const waitMs = Math.min(15_000, Math.max(500, appConfig.localTts.broadcastWaitMs ?? DEFAULT_OVERLAY_TTS_BROADCAST_WAIT_MS));
    let timedOut = false;
    const timeout = new Promise<undefined>((resolve) => {
      setTimeout(() => {
        timedOut = true;
        resolve(undefined);
      }, waitMs);
    });
    const speechAudioUrl = await Promise.race([
      this.localTts.synthesizeOverlaySpeech(message),
      timeout
    ]);

    if (speechAudioUrl) {
      message.speechAudioUrl = speechAudioUrl;
      return;
    }

    if (timedOut) {
      this.logger.error({
        type: "local_tts.overlay_generation_timeout",
        messageType: message.type,
        source: message.source,
        timeoutMs: waitMs,
        fallback: "browser_speech"
      });
    }
  }

  private broadcastOverlay(message: OverlayMessage): ActionRecord["status"] {
    const validation = validateOverlayMessage(message);
    if (!validation.ok) {
      this.logger.error({ type: "overlay.message_invalid", error: validation.error, messageType: message.type, source: message.source });
      throw new Error(`Overlay message validation failed: ${message.type}`);
    }

    const cooldownKey = this.overlayCooldownKey(message);
    const now = Date.now();
    const lastSentAt = this.lastOverlaySentAtByKey.get(cooldownKey) ?? 0;
    if (now - lastSentAt < OVERLAY_COOLDOWN_MS) {
      this.logger.event({ type: "overlay.cooldown_skipped", messageType: message.type, source: message.source });
      return "skipped";
    }

    if (!this.overlay.broadcast(message)) throw new Error(`Overlay message validation failed: ${message.type}`);
    this.lastOverlaySentAtByKey.set(cooldownKey, now);
    return "ok";
  }

  private overlayCooldownKey(message: OverlayMessage): string {
    if (message.type === "participation.queue.update") {
      const queueKey = message.queue
        .map((entry) => [
          entry.position,
          entry.twitchUserName,
          entry.status,
          entry.preferredRole ?? "",
          entry.profileStatus ?? "",
          entry.mainRole ?? ""
        ].join(":"))
        .join("|");
      return `${message.type}:${message.source ?? ""}:${message.isOpen ?? ""}:${queueKey}`;
    }
    if (message.type === "participation.status.update") {
      const nextCandidateKey = message.nextCandidate
        ? `${message.nextCandidate.position}:${message.nextCandidate.twitchUserName}:${message.nextCandidate.status}`
        : "";
      return `${message.type}:${message.source ?? ""}:${message.isOpen}:${message.phase ?? ""}:${message.message ?? ""}:${nextCandidateKey}`;
    }
    if (message.type === "participation.teams.update") {
      const teamKey = [
        message.teams.a.map((player) => `${player.twitchUserName}:${player.preferredRole ?? ""}`).join(","),
        message.teams.b.map((player) => `${player.twitchUserName}:${player.preferredRole ?? ""}`).join(",")
      ].join("|");
      return `${message.type}:${message.source ?? ""}:${teamKey}`;
    }
    if ("message" in message && typeof message.message === "string") return `${message.type}:${message.source ?? ""}:${message.message}`;
    if (message.type === "question.show") return `${message.type}:${message.source ?? ""}:${message.userName}:${message.question}`;
    if (message.type === "subtitle.update") return `${message.type}:${message.source ?? ""}:${message.translated}`;
    return `${message.type}:${message.source ?? ""}`;
  }

  private recordAction(record: ActionRecord): void {
    this.store.addAction(record);
    this.onActionRecorded?.();
  }
}
