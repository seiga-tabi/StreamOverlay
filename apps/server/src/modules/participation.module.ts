import fs from "node:fs";
import path from "node:path";
import type {
  LolRole,
  ParticipationEntry,
  ParticipationSettings,
  TwitchChatMessageInternalEvent,
  TwitchRewardRedemptionInternalEvent
} from "@streamops/shared";
import { formatBilingualNotice, formatRiotId, newId, normalizeLolRole, nowIso, parseRiotIdDetailed, toSafeErrorMessage } from "@streamops/shared";
import type { BotModule, ModuleContext } from "../core/module.js";
import { appConfig } from "../config.js";

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

function publicQueue(ctx: ModuleContext) {
  return ctx.store.getParticipationOverlayQueue();
}

function isParticipationOpen(ctx: ModuleContext): boolean {
  return ctx.store.getStatus().participation === "open";
}

function queueAction(ctx: ModuleContext) {
  return { type: "overlay.participationQueue" as const, isOpen: isParticipationOpen(ctx), queue: publicQueue(ctx) };
}

function statusAction(ctx: ModuleContext, settings: ParticipationSettingsFile, isOpen: boolean, message: string) {
  return {
    type: "overlay.participationStatus" as const,
    isOpen,
    mode: settings.mode,
    phase: isOpen ? "recruiting" as const : "closed" as const,
    message,
    streamerProfile: ctx.store.getParticipationStreamerProfile()
  };
}

function logEntry(entry: ParticipationEntry): Record<string, unknown> {
  return {
    id: entry.id,
    twitchUserId: entry.twitchUserId,
    twitchUserName: entry.twitchUserName,
    riotId: formatRiotId(entry.riotGameName, entry.riotTagLine),
    preferredRole: entry.preferredRole,
    status: entry.status,
    verifiedRank: entry.verifiedRank,
    rankedStats: entry.rankedStats,
    source: entry.source,
    selectedAt: entry.selectedAt,
    checkInExpiresAt: entry.checkInExpiresAt
  };
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

async function applyFromText(ctx: ModuleContext, settings: ParticipationSettingsFile, input: {
  text: string;
  twitchUserId: string;
  twitchUserName: string;
  source: ParticipationApplySource;
  redemptionId?: string;
}) {
  if (ctx.store.getStatus().participation !== "open") {
    return;
  }

  const parsed = parseParticipationInput(input.text);
  if (!parsed.ok) {
    ctx.logger.event({ type: "participation.apply_rejected", reason: "invalid_riot_id", twitchUserId: input.twitchUserId, twitchUserName: input.twitchUserName });
    return;
  }
  const parsedInput = parsed.input;

  const duplicateBeforeLookup = ctx.store.findParticipationDuplicate({
    twitchUserId: input.twitchUserId,
    riotGameName: parsedInput.riotId.gameName,
    riotTagLine: parsedInput.riotId.tagLine
  });
  if (duplicateBeforeLookup) {
    ctx.logger.event({
      type: "participation.apply_rejected",
      reason: duplicateBeforeLookup.reason,
      twitchUserId: input.twitchUserId,
      twitchUserName: input.twitchUserName,
      existingEntryId: duplicateBeforeLookup.entry.id
    });
    return;
  }

  if (ctx.store.getActiveParticipationCount() >= settings.maxQueueSize) {
    ctx.logger.event({ type: "participation.apply_rejected", reason: "queue_full", twitchUserId: input.twitchUserId, twitchUserName: input.twitchUserName });
    return;
  }

  let riotPuuid: string | undefined;
  let verification: "format_only" | "verified" | "lookup_failed" = ctx.riot.isConfigured() ? "lookup_failed" : "format_only";

  if (ctx.riot.isConfigured()) {
    try {
      const account = await ctx.riot.getAccountByRiotId(parsedInput.riotId.gameName, parsedInput.riotId.tagLine);
      if (!account) {
        ctx.logger.event({
          type: "participation.apply_rejected",
          reason: "riot_account_not_found",
          twitchUserId: input.twitchUserId,
          twitchUserName: input.twitchUserName,
          riotId: formatRiotId(parsedInput.riotId.gameName, parsedInput.riotId.tagLine)
        });
        return;
      }
      riotPuuid = account.puuid;
      verification = "verified";
    } catch (error) {
      ctx.logger.error({
        type: "riot.lookup_failed",
        error: toSafeErrorMessage(error),
        riotId: formatRiotId(parsedInput.riotId.gameName, parsedInput.riotId.tagLine)
      });
    }
  }

  const duplicateAfterLookup = ctx.store.findParticipationDuplicate({
    twitchUserId: input.twitchUserId,
    riotGameName: parsedInput.riotId.gameName,
    riotTagLine: parsedInput.riotId.tagLine,
    riotPuuid
  });
  if (duplicateAfterLookup) {
    ctx.logger.event({
      type: "participation.apply_rejected",
      reason: duplicateAfterLookup.reason,
      twitchUserId: input.twitchUserId,
      twitchUserName: input.twitchUserName,
      existingEntryId: duplicateAfterLookup.entry.id
    });
    return;
  }

  const entry = ctx.store.makeParticipationEntry({
    twitchUserId: input.twitchUserId,
    twitchUserName: input.twitchUserName,
    riotGameName: parsedInput.riotId.gameName,
    riotTagLine: parsedInput.riotId.tagLine,
    riotPuuid,
    requestedRole: parsedInput.role,
    preferredRole: parsedInput.role,
    profileStatus: ctx.lolProfileEnrichment ? "pending" : undefined,
    status: riotPuuid ? "verified" : "waitlisted",
    source: input.source,
    redemptionId: input.redemptionId
  });

  const saved = ctx.store.addParticipation(entry);
  ctx.logger.event({ type: "participation.applied", verification, entry: logEntry(saved) });
  ctx.events.emit({
    type: "participation.entryCreated",
    id: newId("event"),
    entryId: saved.id,
    twitchUserId: saved.twitchUserId,
    twitchUserName: saved.twitchUserName,
    riotGameName: saved.riotGameName,
    riotTagLine: saved.riotTagLine,
    riotPuuid: saved.riotPuuid,
    requestedRole: saved.requestedRole,
    createdAt: nowIso()
  });
  await ctx.actions.dispatch([queueAction(ctx)], {}, "participation.applied");
  ctx.dashboard.broadcastSnapshot();
}

async function handleCheckIn(ctx: ModuleContext, event: TwitchChatMessageInternalEvent): Promise<void> {
  const result = ctx.store.checkInSelectedParticipant(event.chatterUserId);
  if (!result.ok) {
    if (result.reason === "expired" && result.entry) {
      ctx.logger.event({ type: "participation.no_show", reason: "checkin_expired", entry: logEntry(result.entry) });
      await ctx.actions.dispatch([queueAction(ctx)], {}, "participation.checkin_expired");
      ctx.dashboard.broadcastSnapshot();
      return;
    }

    return;
  }

  ctx.logger.event({ type: "participation.checked_in", entry: logEntry(result.entry) });
  await ctx.actions.dispatch([
    { type: "overlay.banner", message: `${event.chatterUserName}님 참가 확인 완료!`, variant: "success", durationMs: 4000 },
    queueAction(ctx)
  ], {}, "participation.checked_in");
  ctx.dashboard.broadcastSnapshot();
}

async function handleCancel(ctx: ModuleContext, event: TwitchChatMessageInternalEvent): Promise<void> {
  const result = ctx.store.cancelParticipationByUser(event.chatterUserId, "시청자가 채팅 명령어로 참가를 취소했습니다.");
  if (!result.ok) {
    return;
  }

  ctx.logger.event({ type: "participation.cancelled", entry: logEntry(result.entry) });
  await ctx.actions.dispatch([queueAction(ctx)], {}, "participation.cancelled");
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
      ctx.store.setParticipationOpen(true);
      ctx.logger.event({ type: "participation.opened", reason: "open_by_default" });
      void ctx.actions.dispatch([
        statusAction(ctx, settings, true, "롤 시참 모집 중"),
        queueAction(ctx)
      ], {}, "participation.open_by_default");
      ctx.dashboard.broadcastSnapshot();
    }

    ctx.events.on<TwitchChatMessageInternalEvent>("twitch.chatMessage", async (event) => {
      const trimmed = event.message.trim();
      const [command = "", ...rest] = trimmed.split(/\s+/);
      const commandKind = participationCommandKind(command);
      if (!commandKind) return;

      if (OPERATOR_COMMAND_KINDS.has(commandKind)) {
        if (!isOperatorCommandAllowed(event)) {
          ctx.logger.event({ type: "participation.operator_command_denied", command, twitchUserId: event.chatterUserId, twitchUserName: event.chatterUserName });
          return;
        }
      }

      if (commandKind === "open") {
        if (isParticipationOpen(ctx)) {
          ctx.logger.event({ type: "participation.open_ignored", reason: "already_open", twitchUserId: event.chatterUserId, twitchUserName: event.chatterUserName });
          return;
        }

        ctx.store.setParticipationOpen(true);
        ctx.logger.event({ type: "participation.opened", twitchUserId: event.chatterUserId, twitchUserName: event.chatterUserName });
        await ctx.actions.dispatch([
          { type: "overlay.banner", message: "参加募集を開始しました。", variant: "success", durationMs: 5000 },
          statusAction(ctx, settings, true, "롤 시참 모집 중"),
          { type: "twitch.chat", message: settings.guideMessage },
          queueAction(ctx)
        ], {}, "participation.open");
        ctx.dashboard.broadcastSnapshot();
        return;
      }

      if (commandKind === "close") {
        ctx.store.setParticipationOpen(false);
        ctx.logger.event({ type: "participation.closed", twitchUserId: event.chatterUserId, twitchUserName: event.chatterUserName });
        await ctx.actions.dispatch([
          statusAction(ctx, settings, false, "롤 시참 모집 종료"),
          queueAction(ctx)
        ], {}, "participation.close");
        ctx.dashboard.broadcastSnapshot();
        return;
      }

      if (commandKind === "checkIn") {
        await handleCheckIn(ctx, event);
        return;
      }

      if (commandKind === "cancel") {
        await handleCancel(ctx, event);
        return;
      }

      if (commandKind === "apply") {
        await applyFromText(ctx, settings, {
          text: rest.join(" "),
          twitchUserId: event.chatterUserId,
          twitchUserName: event.chatterUserName,
          source: "chat_command"
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
        redemptionId: event.id
      });
    });
  }
};
