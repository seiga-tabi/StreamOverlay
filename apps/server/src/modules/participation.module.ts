import fs from "node:fs";
import path from "node:path";
import type {
  LolRole,
  ParticipationEntry,
  ParticipationSettings,
  TwitchChatMessageInternalEvent,
  TwitchRewardRedemptionInternalEvent
} from "@streamops/shared";
import { formatBilingualNotice, newId, normalizeLolRole, nowIso, parseRiotIdDetailed, toSafeErrorMessage } from "@streamops/shared";
import type { BotModule, ModuleContext } from "../core/module.js";
import { appConfig } from "../config.js";
import { createParticipationTrace, publishParticipationSnapshot, type ParticipationTrace } from "../services/participation-snapshot.js";
import { RiotRateLimitError } from "../services/riot-api.js";

type ParticipationSettingsFile = ParticipationSettings & {
  channelPointRewardTitles: string[];
  guideMessage: string;
};

type ParticipationInput = {
  riotId: { gameName: string; tagLine: string };
  role: LolRole;
};

type ParticipationInputParseResult =
  | { ok: true; input: ParticipationInput }
  | { ok: false; message: string };

type ParticipationApplySource = "chat_command" | "channel_point" | "dashboard";

type ParticipationCommandKind = "open" | "close" | "checkIn" | "cancel" | "apply";

const PARTICIPATION_COMMANDS: Record<ParticipationCommandKind, readonly string[]> = {
  open: [
    "!시참시작",
    "!참가시작",
    "!参加開始",
    "!参加募集開始",
    "!さんか開始",
    "!joinstart",
    "!participationstart",
    "!queueopen",
    "!openqueue"
  ],
  close: [
    "!시참종료",
    "!참가종료",
    "!参加終了",
    "!参加募集終了",
    "!さんか終了",
    "!joinend",
    "!participationstop",
    "!queueclose",
    "!closequeue"
  ],
  checkIn: [
    "!참가확인",
    "!시참확인",
    "!参加確認",
    "!さんか確認",
    "!checkin",
    "!check-in",
    "!ready"
  ],
  cancel: [
    "!시참취소",
    "!참가취소",
    "!参加取消",
    "!参加キャンセル",
    "!さんか取消",
    "!キャンセル",
    "!cancel",
    "!leave",
    "!quit"
  ],
  apply: [
    "!시참",
    "!참가",
    "!参加",
    "!さんか",
    "!join",
    "!participate",
    "!loljoin"
  ]
};

const OPERATOR_COMMAND_KINDS = new Set<ParticipationCommandKind>(["open", "close"]);
const RIOT_VERIFICATION_RETRY_DELAYS_MS = [0, 500, 1_500] as const;
const pendingRiotVerifications = new Map<string, Promise<void>>();

function normalizeCommandToken(command: string): string {
  return command.trim().normalize("NFKC").toLowerCase();
}

function participationCommandKind(command: string): ParticipationCommandKind | undefined {
  const normalized = normalizeCommandToken(command);
  for (const [kind, commands] of Object.entries(PARTICIPATION_COMMANDS) as Array<[ParticipationCommandKind, readonly string[]]>) {
    if (commands.some((candidate) => normalizeCommandToken(candidate) === normalized)) return kind;
  }
  return undefined;
}

function loadSettings(): ParticipationSettingsFile {
  const filePath = path.join(appConfig.paths.config, "participation.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ParticipationSettingsFile;
}

function isParticipationOpen(ctx: ModuleContext, streamerId?: string): boolean {
  return ctx.store.getParticipationState(streamerId).isOpen;
}

async function publishState(
  ctx: ModuleContext,
  settings: ParticipationSettingsFile,
  input: {
    message?: string;
    reason: string;
    streamerId?: string;
    trace?: ParticipationTrace;
  }
): Promise<void> {
  await publishParticipationSnapshot({
    store: ctx.store,
    actions: ctx.actions,
    logger: ctx.logger
  }, {
    message: input.message,
    mode: settings.mode,
    reason: input.reason,
    streamerId: input.streamerId,
    trace: input.trace
  });
}

function logEntry(entry: ParticipationEntry, streamerId?: string): Record<string, unknown> {
  return {
    id: entry.id,
    streamerId: streamerId ?? entry.streamerId,
    preferredRole: entry.preferredRole,
    status: entry.status,
    source: entry.source,
    selectedAt: entry.selectedAt,
    checkInExpiresAt: entry.checkInExpiresAt
  };
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function emitEntryCreated(ctx: ModuleContext, entry: ParticipationEntry, streamerId?: string): void {
  ctx.events.emit({
    type: "participation.entryCreated",
    id: newId("event"),
    entryId: entry.id,
    streamerId,
    twitchUserId: entry.twitchUserId,
    twitchUserName: entry.twitchUserName,
    riotGameName: entry.riotGameName,
    riotTagLine: entry.riotTagLine,
    riotPuuid: entry.riotPuuid,
    requestedRole: entry.requestedRole,
    createdAt: nowIso()
  });
}

async function resolveRiotAccount(ctx: ModuleContext, entry: ParticipationEntry) {
  let lastError: unknown;

  for (let attempt = 0; attempt < RIOT_VERIFICATION_RETRY_DELAYS_MS.length; attempt += 1) {
    const configuredDelayMs = RIOT_VERIFICATION_RETRY_DELAYS_MS[attempt] ?? 0;
    if (configuredDelayMs > 0) await sleep(configuredDelayMs);

    try {
      return await ctx.riot.getAccountByRiotId(entry.riotGameName, entry.riotTagLine);
    } catch (error) {
      lastError = error;
      if (attempt >= RIOT_VERIFICATION_RETRY_DELAYS_MS.length - 1) break;
      if (error instanceof RiotRateLimitError && error.retryAfterMs) {
        await sleep(Math.min(Math.max(error.retryAfterMs, 0), 5_000));
      }
    }
  }

  throw lastError ?? new Error("Riot 계정 확인에 실패했습니다.");
}

async function verifyPendingParticipation(
  ctx: ModuleContext,
  settings: ParticipationSettingsFile,
  entry: ParticipationEntry,
  streamerId: string | undefined,
  trace: ParticipationTrace
): Promise<void> {
  try {
    const account = await resolveRiotAccount(ctx, entry);
    const riotResolvedAt = nowIso();
    trace.riotResolvedAt = riotResolvedAt;
    const current = ctx.store.getParticipationEntryById(entry.id, streamerId);
    if (!current || current.status !== "pending") return;

    if (!account) {
      const rejected = ctx.store.markParticipant(entry.id, "rejected", streamerId);
      ctx.logger.event({
        type: "participation.verification_rejected",
        reason: "riot_account_not_found",
        entry: rejected ? logEntry(rejected, streamerId) : { id: entry.id, streamerId }
      });
      await publishState(ctx, settings, {
        message: chatGuide(
          "Riot IDを確認できませんでした。入力内容を確認してもう一度申請してください。",
          "Riot ID를 확인할 수 없습니다. 입력 내용을 확인한 뒤 다시 신청해주세요.",
          "確認失敗",
          "확인 실패"
        ),
        reason: "participation.verification_rejected",
        streamerId,
        trace
      });
      ctx.dashboard.broadcastSnapshot();
      return;
    }

    const duplicate = ctx.store.findParticipationDuplicate({
      twitchUserId: current.twitchUserId,
      riotGameName: current.riotGameName,
      riotTagLine: current.riotTagLine,
      riotPuuid: account.puuid,
      excludeEntryId: current.id
    }, streamerId);
    if (duplicate) {
      const rejected = ctx.store.markParticipant(entry.id, "rejected", streamerId);
      ctx.logger.event({
        type: "participation.verification_rejected",
        reason: duplicate.reason,
        existingEntryId: duplicate.entry.id,
        entry: rejected ? logEntry(rejected, streamerId) : { id: entry.id, streamerId }
      });
      await publishState(ctx, settings, {
        message: duplicateMessage(duplicate.reason, current.twitchUserName),
        reason: "participation.verification_duplicate",
        streamerId,
        trace
      });
      ctx.dashboard.broadcastSnapshot();
      return;
    }

    ctx.store.patchParticipationProfile(entry.id, { riotPuuid: account.puuid }, streamerId);
    const verified = ctx.store.markParticipant(entry.id, "verified", streamerId);
    if (!verified) return;

    emitEntryCreated(ctx, verified, streamerId);
    ctx.logger.event({
      type: "participation.verification_completed",
      verificationDurationMs: Date.parse(riotResolvedAt) - Date.parse(trace.requestReceivedAt),
      entry: logEntry(verified, streamerId)
    });
    await publishState(ctx, settings, {
      reason: "participation.verification_completed",
      streamerId,
      trace
    });
    ctx.dashboard.broadcastSnapshot();
  } catch (error) {
    trace.riotResolvedAt = nowIso();
    ctx.logger.error({
      type: "participation.verification_deferred",
      entryId: entry.id,
      streamerId,
      error: toSafeErrorMessage(error)
    });
    await publishState(ctx, settings, {
      message: chatGuide(
        "Riot IDの確認が遅延しています。申請は受け付け済みです。",
        "Riot ID 확인이 지연되고 있습니다. 신청은 접수된 상태입니다.",
        "確認待機",
        "확인 대기"
      ),
      reason: "participation.verification_deferred",
      streamerId,
      trace
    });
    ctx.dashboard.broadcastSnapshot();
  }
}

function scheduleRiotVerification(
  ctx: ModuleContext,
  settings: ParticipationSettingsFile,
  entry: ParticipationEntry,
  streamerId: string | undefined,
  trace: ParticipationTrace
): void {
  const key = `${streamerId ?? "default"}:${entry.id}`;
  if (pendingRiotVerifications.has(key)) return;

  const task = verifyPendingParticipation(ctx, settings, entry, streamerId, trace)
    .catch((error) => {
      ctx.logger.error({
        type: "participation.verification_task_failed",
        entryId: entry.id,
        streamerId,
        error: toSafeErrorMessage(error)
      });
    })
    .finally(() => {
      pendingRiotVerifications.delete(key);
    });
  pendingRiotVerifications.set(key, task);
  void task;
}

function chatGuide(ja: string, ko: string, titleJa = "案内", titleKo = "안내"): string {
  return formatBilingualNotice(titleJa, titleKo, ja, ko);
}

function parseParticipationInput(text: string): ParticipationInputParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      ok: false,
      message: chatGuide(
        "Riot IDを入力してください。例: !参加 HideOnBush#KR1 / !join HideOnBush#KR1",
        "Riot ID를 입력해주세요. 예: !시참 HideOnBush#KR1 / !join HideOnBush#KR1",
        "入力案内",
        "입력 안내"
      )
    };
  }

  const tokens = trimmed.split(/\s+/);
  const lastToken = tokens[tokens.length - 1];
  const roleFromLastToken = normalizeLolRole(lastToken);

  if (roleFromLastToken !== "unknown" && tokens.length > 1) {
    const riotId = parseRiotIdDetailed(tokens.slice(0, -1).join(" "));
    if (riotId.ok) return { ok: true, input: { riotId: { gameName: riotId.gameName, tagLine: riotId.tagLine }, role: roleFromLastToken } };
    return { ok: false, message: riotId.message };
  }

  const firstTokenRiotId = parseRiotIdDetailed(tokens[0] ?? "");
  if (firstTokenRiotId.ok) return { ok: true, input: { riotId: { gameName: firstTokenRiotId.gameName, tagLine: firstTokenRiotId.tagLine }, role: "unknown" } };

  const fullTextRiotId = parseRiotIdDetailed(trimmed);
  if (fullTextRiotId.ok) return { ok: true, input: { riotId: { gameName: fullTextRiotId.gameName, tagLine: fullTextRiotId.tagLine }, role: "unknown" } };

  return { ok: false, message: firstTokenRiotId.message };
}

function rawChatEvent(event: TwitchChatMessageInternalEvent): Record<string, unknown> {
  const raw = event.raw;
  if (!raw || typeof raw !== "object") return {};
  const payload = (raw as { payload?: { event?: Record<string, unknown> } }).payload;
  return payload?.event ?? {};
}

function isOperatorCommandAllowed(event: TwitchChatMessageInternalEvent): boolean {
  if (event.chatterUserId === event.broadcasterUserId) return true;

  const rawEvent = rawChatEvent(event);
  if (rawEvent.chatter_is_moderator === true) return true;

  const badges = rawEvent.badges;
  if (!Array.isArray(badges)) return false;
  return badges.some((badge) => {
    if (!badge || typeof badge !== "object") return false;
    const setId = (badge as { set_id?: unknown }).set_id;
    return setId === "broadcaster" || setId === "moderator";
  });
}

function duplicateMessage(reason: "twitch_user" | "riot_id", twitchUserName: string): string {
  if (reason === "twitch_user") return chatGuide(`${twitchUserName}さんはすでに参加待機列に登録されています。`, `${twitchUserName}님, 이미 시참 대기열에 등록되어 있습니다.`, "登録済み", "등록됨");
  return chatGuide(`${twitchUserName}さん、この Riot ID はすでに登録されています。`, `${twitchUserName}님, 이미 등록된 Riot ID입니다.`, "登録済み", "등록됨");
}

function reusableProfilePatch(previous: ParticipationEntry | undefined): Pick<
  Partial<ParticipationEntry>,
  "profileStatus" | "profileFailureReason" | "mainRole" | "mainRoleConfidence" | "topChampions" | "rankedStats" | "verifiedRank" | "profileAnalyzedAt" | "riotPuuid"
> {
  if (!previous) return {};
  return {
    riotPuuid: previous.riotPuuid,
    profileStatus: previous.profileStatus,
    profileFailureReason: previous.profileFailureReason,
    mainRole: previous.mainRole,
    mainRoleConfidence: previous.mainRoleConfidence,
    topChampions: previous.topChampions?.map((champion) => ({ ...champion })),
    rankedStats: previous.rankedStats ? { ...previous.rankedStats } : undefined,
    verifiedRank: previous.verifiedRank,
    profileAnalyzedAt: previous.profileAnalyzedAt
  };
}

async function applyFromText(ctx: ModuleContext, settings: ParticipationSettingsFile, input: {
  text: string;
  twitchUserId: string;
  twitchUserName: string;
  source: ParticipationApplySource;
  redemptionId?: string;
  streamerId?: string;
}) {
  const trace = createParticipationTrace();
  if (!isParticipationOpen(ctx, input.streamerId)) {
    return;
  }

  const parsed = parseParticipationInput(input.text);
  if (!parsed.ok) {
    ctx.logger.event({
      type: "participation.apply_rejected",
      reason: "invalid_riot_id",
      streamerId: input.streamerId,
      traceId: trace.traceId
    });
    return;
  }
  const parsedInput = parsed.input;

  const duplicateBeforeLookup = ctx.store.findParticipationDuplicate({
    twitchUserId: input.twitchUserId,
    riotGameName: parsedInput.riotId.gameName,
    riotTagLine: parsedInput.riotId.tagLine
  }, input.streamerId);
  if (duplicateBeforeLookup) {
    ctx.logger.event({
      type: "participation.apply_rejected",
      reason: duplicateBeforeLookup.reason,
      existingEntryId: duplicateBeforeLookup.entry.id,
      streamerId: input.streamerId,
      traceId: trace.traceId
    });
    return;
  }

  if (ctx.store.getActiveParticipationCount(input.streamerId) >= settings.maxQueueSize) {
    ctx.logger.event({
      type: "participation.apply_rejected",
      reason: "queue_full",
      streamerId: input.streamerId,
      traceId: trace.traceId
    });
    return;
  }

  const previousProfile = ctx.store.findReusableParticipationProfile({
    riotGameName: parsedInput.riotId.gameName,
    riotTagLine: parsedInput.riotId.tagLine
  }, input.streamerId);
  const reusedProfile = reusableProfilePatch(previousProfile);
  const resolvedRiotPuuid = reusedProfile.riotPuuid;
  const requiresRiotVerification = ctx.riot.isConfigured() && !resolvedRiotPuuid;
  const entry = ctx.store.makeParticipationEntry({
    streamerId: input.streamerId,
    twitchUserId: input.twitchUserId,
    twitchUserName: input.twitchUserName,
    riotGameName: parsedInput.riotId.gameName,
    riotTagLine: parsedInput.riotId.tagLine,
    riotPuuid: resolvedRiotPuuid,
    requestedRole: parsedInput.role,
    preferredRole: parsedInput.role,
    profileStatus: reusedProfile.profileStatus ?? (ctx.lolProfileEnrichment ? "pending" : undefined),
    profileFailureReason: reusedProfile.profileFailureReason,
    mainRole: reusedProfile.mainRole,
    mainRoleConfidence: reusedProfile.mainRoleConfidence,
    topChampions: reusedProfile.topChampions,
    rankedStats: reusedProfile.rankedStats,
    verifiedRank: reusedProfile.verifiedRank,
    profileAnalyzedAt: reusedProfile.profileAnalyzedAt,
    status: resolvedRiotPuuid ? "verified" : requiresRiotVerification ? "pending" : "waitlisted",
    source: input.source,
    redemptionId: input.redemptionId
  });

  const savedResult = ctx.store.reactivateReusableParticipation(entry, input.streamerId);
  const saved = savedResult.entry;
  await publishState(ctx, settings, {
    reason: "participation.applied",
    streamerId: input.streamerId,
    trace
  });
  ctx.dashboard.broadcastSnapshot();

  ctx.logger.event({
    type: "participation.applied",
    verification: requiresRiotVerification ? "pending" : resolvedRiotPuuid ? "reused" : "format_only",
    reusedProfile: Boolean(previousProfile),
    reusedEntry: savedResult.reused,
    traceId: trace.traceId,
    entry: logEntry(saved, input.streamerId)
  });

  if (saved.status === "pending") {
    scheduleRiotVerification(ctx, settings, saved, input.streamerId, trace);
    return;
  }
  emitEntryCreated(ctx, saved, input.streamerId);
}

async function handleCheckIn(ctx: ModuleContext, settings: ParticipationSettingsFile, event: TwitchChatMessageInternalEvent): Promise<void> {
  const result = ctx.store.checkInSelectedParticipant(event.chatterUserId, new Date(), event.broadcasterUserId);
  if (!result.ok) {
    if (result.reason === "expired" && result.entry) {
      ctx.logger.event({
        type: "participation.no_show",
        reason: "checkin_expired",
        entry: logEntry(result.entry, event.broadcasterUserId)
      });
      await publishState(ctx, settings, {
        reason: "participation.checkin_expired",
        streamerId: event.broadcasterUserId
      });
      ctx.dashboard.broadcastSnapshot();
      return;
    }

    return;
  }

  ctx.logger.event({ type: "participation.checked_in", entry: logEntry(result.entry, event.broadcasterUserId) });
  await publishState(ctx, settings, {
    reason: "participation.checked_in",
    streamerId: event.broadcasterUserId
  });
  ctx.dashboard.broadcastSnapshot();
  void ctx.actions.dispatch([
    { type: "overlay.banner", message: `${event.chatterUserName}님 참가 확인 완료!`, variant: "success", durationMs: 4000 }
  ], { streamerId: event.broadcasterUserId }, "participation.checked_in").catch((error) => {
    ctx.logger.error({ type: "participation.banner_failed", error: toSafeErrorMessage(error) });
  });
}

async function handleCancel(ctx: ModuleContext, settings: ParticipationSettingsFile, event: TwitchChatMessageInternalEvent): Promise<void> {
  const result = ctx.store.cancelParticipationByUser(
    event.chatterUserId,
    "시청자가 채팅 명령어로 참가를 취소했습니다.",
    event.broadcasterUserId
  );
  if (!result.ok) {
    return;
  }

  ctx.logger.event({ type: "participation.cancelled", entry: logEntry(result.entry, event.broadcasterUserId) });
  await publishState(ctx, settings, {
    reason: "participation.cancelled",
    streamerId: event.broadcasterUserId
  });
  ctx.dashboard.broadcastSnapshot();
}

export const participationModule: BotModule = {
  name: "participation",
  setup(ctx) {
    const settings = loadSettings();
    if (!settings.enabled) {
      ctx.logger.event({ type: "participation.disabled" });
      return;
    }

    if (settings.openByDefault) {
      const streamerId = appConfig.twitch.broadcasterId?.trim() || undefined;
      ctx.store.setParticipationOpen(true, streamerId);
      ctx.logger.event({ type: "participation.opened", reason: "open_by_default", streamerId });
      void publishState(ctx, settings, {
        message: "롤 시참 모집 중",
        reason: "participation.open_by_default",
        streamerId
      }).then(() => {
        ctx.dashboard.broadcastSnapshot();
      }).catch((error) => {
        ctx.logger.error({ type: "participation.publish_failed", reason: "open_by_default", error: toSafeErrorMessage(error) });
      });
    }

    ctx.events.on<TwitchChatMessageInternalEvent>("twitch.chatMessage", async (event) => {
      const trimmed = event.message.trim();
      const [command = "", ...rest] = trimmed.split(/\s+/);
      const commandKind = participationCommandKind(command);
      if (!commandKind) return;

      if (OPERATOR_COMMAND_KINDS.has(commandKind)) {
        if (!isOperatorCommandAllowed(event)) {
          ctx.logger.event({
            type: "participation.operator_command_denied",
            command,
            streamerId: event.broadcasterUserId
          });
          return;
        }
      }

      if (commandKind === "open") {
        if (isParticipationOpen(ctx, event.broadcasterUserId)) {
          ctx.logger.event({
            type: "participation.open_ignored",
            reason: "already_open",
            streamerId: event.broadcasterUserId
          });
          return;
        }

        ctx.store.setParticipationOpen(true, event.broadcasterUserId);
        ctx.logger.event({ type: "participation.opened", streamerId: event.broadcasterUserId });
        await publishState(ctx, settings, {
          message: "롤 시참 모집 중",
          reason: "participation.open",
          streamerId: event.broadcasterUserId
        });
        ctx.dashboard.broadcastSnapshot();
        void ctx.actions.dispatch([
          { type: "overlay.banner", message: "参加募集を開始しました。", variant: "success", durationMs: 5000 },
          { type: "twitch.chat", message: settings.guideMessage }
        ], { streamerId: event.broadcasterUserId }, "participation.open").catch((error) => {
          ctx.logger.error({ type: "participation.followup_failed", reason: "open", error: toSafeErrorMessage(error) });
        });
        return;
      }

      if (commandKind === "close") {
        ctx.store.setParticipationOpen(false, event.broadcasterUserId);
        ctx.logger.event({ type: "participation.closed", streamerId: event.broadcasterUserId });
        await publishState(ctx, settings, {
          message: "롤 시참 모집 종료",
          reason: "participation.close",
          streamerId: event.broadcasterUserId
        });
        ctx.dashboard.broadcastSnapshot();
        return;
      }

      if (commandKind === "checkIn") {
        await handleCheckIn(ctx, settings, event);
        return;
      }

      if (commandKind === "cancel") {
        await handleCancel(ctx, settings, event);
        return;
      }

      if (commandKind === "apply") {
        await applyFromText(ctx, settings, {
          text: rest.join(" "),
          twitchUserId: event.chatterUserId,
          twitchUserName: event.chatterUserName,
          source: "chat_command",
          streamerId: event.broadcasterUserId
        });
      }
    });

    ctx.events.on<TwitchRewardRedemptionInternalEvent>("twitch.rewardRedemption", async (event) => {
      if (!settings.channelPointRewardTitles.includes(event.rewardTitle)) return;
      await applyFromText(ctx, settings, {
        text: event.userInput ?? "",
        twitchUserId: event.userId,
        twitchUserName: event.userName,
        source: "channel_point",
        redemptionId: event.id,
        streamerId: event.broadcasterUserId
      });
    });
  }
};
