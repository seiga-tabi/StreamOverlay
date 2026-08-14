import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  BotStatus,
  FollowerActivity,
  FollowerActivityKind,
  FollowerManagementState,
  FollowerRecord,
  FollowerSnapshotInput,
  InternalEvent,
  LolAutomationSettings,
  ParticipationDashboardQueueEntry,
  ParticipationEntry,
  ParticipationGame,
  ParticipationListingVisibility,
  ParticipationPublicQueueEntry,
  ParticipationSession,
  ParticipationState,
  StreamerProfileLink,
  StreamerProfileSnapshot,
  StreamerRiotIdRequest,
  TwitchChatSendFailure,
  TwitchChatStatus,
  TwitchEventSubStatus,
  TwitchEventSubSubscriptionStatus
} from "@streamops/shared";
import {
  formatRiotId,
  isActiveParticipationStatus,
  isWaitingParticipationStatus,
  newId,
  normalizeParticipationChatLocale,
  normalizeParticipationGame,
  normalizeRiotIdKey,
  nowIso,
  PARTICIPATION_GAME_CAPACITY,
  STREAMER_SUB_RIOT_ACCOUNT_LIMIT,
  toSafeErrorMessage,
  type ParticipationStreamerProfile
} from "@streamops/shared";

export type QuestionEntry = {
  id: string;
  userName: string;
  question: string;
  translatedQuestion?: string;
  status: "pending" | "answered" | "skipped";
  createdAt: string;
};

export type HighlightEntry = {
  id: string;
  userName?: string;
  reason: string;
  createdAt: string;
};

export type ActionRecord = {
  id: string;
  type: string;
  status: "pending" | "ok" | "failed" | "skipped";
  error?: string;
  createdAt: string;
};

export type StoreOptions = {
  followerStatePath?: string;
  streamerRiotIdStatePath?: string;
  runtimeStatePath?: string;
  onPersistenceError?: (failure: StorePersistenceFailure) => void;
};

type ScopedFollowerState = {
  followers: Map<string, FollowerRecord>;
  lastSnapshotAt?: string;
  lastSnapshotTotal?: number;
  lastSnapshotTruncated?: boolean;
};

type UnassignedLegacyFollowerState = ScopedFollowerState & {
  sourceVersion: 1;
  reason: "owner_unverified";
};

export type StorePersistenceFailure = {
  scope: "followers" | "streamer_riot_ids" | "runtime";
  operation: "load" | "save" | "readiness";
  filePath: string;
  error: string;
};

export type StoreReadiness = {
  ok: boolean;
  checks: Record<string, boolean>;
  errors: string[];
  loadStates: Record<StorePersistenceFailure["scope"], PersistenceLoadState>;
};

export type PersistenceLoadState = "not_loaded" | "ready" | "corrupted" | "unreadable" | "encryption_failed";

export type TwitchStreamLiveStatus = {
  twitchUserId: string;
  isLive: boolean;
  updatedAt: string;
  source: "eventsub" | "snapshot";
};

export type StreamerRiotIdRequestInput = {
  twitchUserId: string;
  twitchLogin: string;
  twitchDisplayName: string;
  twitchProfileImageUrl?: string;
  riotGameName: string;
  riotTagLine: string;
};

export type ParticipationDuplicate = {
  reason: "twitch_user" | "riot_id";
  entry: ParticipationEntry;
};

export type ParticipationCheckInResult =
  | { ok: true; entry: ParticipationEntry }
  | { ok: false; reason: "missing" | "expired"; entry?: ParticipationEntry };

export type ParticipationCancelResult =
  | { ok: true; entry: ParticipationEntry }
  | { ok: false; reason: "missing" | "in_game" };

export type ParticipationSkipResult =
  | { ok: true; entry: ParticipationEntry }
  | { ok: false; reason: "missing" | "not_selected" };

const CANCELLABLE_PARTICIPATION_STATUSES = new Set<ParticipationEntry["status"]>([
  "pending",
  "verified",
  "waitlisted",
  "selected",
  "checked_in",
  "invited"
]);
const PERSISTED_PARTICIPATION_STATUSES = new Set<ParticipationEntry["status"]>([
  "pending", "verified", "waitlisted", "selected", "checked_in", "invited", "in_game", "played",
  "skipped", "cancelled", "no_show", "rejected", "blocked"
]);
const PERSISTED_PARTICIPATION_SOURCES = new Set<ParticipationEntry["source"]>(["chat_command", "channel_point", "dashboard"]);
const PERSISTED_LOL_ROLES = new Set<ParticipationEntry["preferredRole"]>(["top", "jungle", "mid", "adc", "support", "fill", "unknown"]);
const PARTICIPATION_PUBLIC_VISIBLE_LIMIT = 4;
const PARTICIPATION_TOP_CHAMPION_LIMIT = 3;

/** Palworld 참가자는 Riot ID가 없습니다 — 둘 다 있을 때만 중복판정 키를 만듭니다. */
function riotIdKeyOrUndefined(gameName?: string, tagLine?: string): string | undefined {
  return gameName && tagLine ? normalizeRiotIdKey(gameName, tagLine) : undefined;
}

function cloneParticipationTopChampions(
  topChampions: ParticipationEntry["topChampions"]
): ParticipationEntry["topChampions"] {
  return topChampions
    ?.slice(0, PARTICIPATION_TOP_CHAMPION_LIMIT)
    .map((champion) => ({ ...champion }));
}

function isCheckInExpired(entry: ParticipationEntry, now = new Date()): boolean {
  if (!entry.checkInExpiresAt) return false;
  const expiresAt = Date.parse(entry.checkInExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now.getTime();
}

function toDashboardQueueEntry(entry: ParticipationEntry, position: number): ParticipationDashboardQueueEntry {
  return {
    id: entry.id,
    position,
    twitchUserName: entry.twitchUserName,
    game: entry.game ?? "lol",
    ...(entry.game === "palworld"
      ? { palworldNickname: entry.palworldNickname }
      : { riotId: formatRiotId(entry.riotGameName ?? "", entry.riotTagLine ?? "") }),
    preferredRole: entry.preferredRole,
    status: entry.status,
    requestedRole: entry.requestedRole,
    profileStatus: entry.profileStatus,
    mainRole: entry.mainRole,
    mainRoleConfidence: entry.mainRoleConfidence,
    topChampions: cloneParticipationTopChampions(entry.topChampions),
    rankedStats: entry.rankedStats,
    verifiedRank: entry.verifiedRank,
    profileAnalyzedAt: entry.profileAnalyzedAt,
    profileFailureReason: entry.profileFailureReason,
    source: entry.source,
    selectedAt: entry.selectedAt,
    checkInExpiresAt: entry.checkInExpiresAt,
    playedAt: entry.playedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

function toPublicQueueEntry(entry: ParticipationEntry, position: number): ParticipationPublicQueueEntry {
  return {
    position,
    twitchUserName: entry.twitchUserName,
    game: entry.game ?? "lol",
    ...(entry.game === "palworld" ? { palworldNickname: entry.palworldNickname } : {}),
    preferredRole: entry.preferredRole,
    status: entry.status,
    requestedRole: entry.requestedRole,
    profileStatus: entry.profileStatus,
    mainRole: entry.mainRole,
    mainRoleConfidence: entry.mainRoleConfidence,
    topChampions: cloneParticipationTopChampions(entry.topChampions),
    rankedStats: entry.rankedStats
  };
}

function emptyFollowerActivity(): FollowerActivity {
  return {
    chatMessages: 0,
    participationEntries: 0,
    total: 0,
    genres: {}
  };
}

function cloneFollowerRecord(record: FollowerRecord): FollowerRecord {
  return {
    ...record,
    activity: {
      ...record.activity,
      genres: { ...record.activity.genres }
    }
  };
}

function followerSortTime(record: FollowerRecord): number {
  return Date.parse(record.followedAt ?? record.firstSeenAt) || 0;
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function normalizedNonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizedParticipationEntry(value: unknown): ParticipationEntry | undefined {
  const input = objectRecord(value);
  const id = optionalString(input?.id);
  const twitchUserId = optionalString(input?.twitchUserId);
  const twitchUserName = optionalString(input?.twitchUserName);
  const status = optionalString(input?.status) as ParticipationEntry["status"] | undefined;
  const source = optionalString(input?.source) as ParticipationEntry["source"] | undefined;
  const createdAt = optionalString(input?.createdAt);
  const updatedAt = optionalString(input?.updatedAt);
  if (!id || !twitchUserId || !twitchUserName || !status || !source || !createdAt || !updatedAt) return undefined;
  if (!PERSISTED_PARTICIPATION_STATUSES.has(status) || !PERSISTED_PARTICIPATION_SOURCES.has(source)) return undefined;

  // 기존 저장 데이터에는 game 필드가 없었고 전부 LoL 참가자였습니다. Palworld는
  // Riot ID 대신 palworldNickname만 있고, 검증 없이 등록되므로 preferredRole도 없습니다.
  const game = normalizeParticipationGame(input?.game);
  const riotGameName = optionalString(input?.riotGameName);
  const riotTagLine = optionalString(input?.riotTagLine);
  const preferredRole = optionalString(input?.preferredRole) as ParticipationEntry["preferredRole"] | undefined;
  const palworldNickname = optionalString(input?.palworldNickname);
  if (game === "lol") {
    if (!riotGameName || !riotTagLine || !preferredRole || !PERSISTED_LOL_ROLES.has(preferredRole)) return undefined;
  } else if (!palworldNickname) {
    return undefined;
  }

  return {
    ...(input as ParticipationEntry),
    id,
    twitchUserId,
    twitchUserName,
    game,
    riotGameName,
    riotTagLine,
    ...(game === "palworld" ? { palworldNickname } : {}),
    status,
    source,
    joinedFrom: input?.joinedFrom === "public_web"
      || input?.joinedFrom === "discord_announcement"
      || input?.joinedFrom === "twitch_chat"
      || input?.joinedFrom === "twitch_extension"
      || input?.joinedFrom === "dashboard"
      ? input.joinedFrom
      : source === "chat_command" || source === "channel_point"
        ? "twitch_chat"
        : "dashboard",
    attemptNumber: Math.max(1, optionalInteger(input?.attemptNumber) ?? 1),
    lastRequeuedAt: optionalString(input?.lastRequeuedAt),
    preferredRole,
    createdAt,
    updatedAt,
    topChampions: Array.isArray(input?.topChampions)
      ? input.topChampions
        .map((champion) => objectRecord(champion))
        .filter((champion): champion is Record<string, unknown> => Boolean(champion))
        .slice(0, PARTICIPATION_TOP_CHAMPION_LIMIT)
        .map((champion) => ({ ...champion })) as ParticipationEntry["topChampions"]
      : undefined
  };
}

function cloneParticipationEntry(entry: ParticipationEntry): ParticipationEntry {
  return {
    ...entry,
    rankedStats: entry.rankedStats ? { ...entry.rankedStats } : undefined,
    topChampions: cloneParticipationTopChampions(entry.topChampions)
  };
}

function cloneParticipationStreamerProfile(profile: ParticipationStreamerProfile | undefined): ParticipationStreamerProfile | undefined {
  return profile ? {
    ...profile,
    topChampions: cloneParticipationTopChampions(profile.topChampions),
    rankedStats: profile.rankedStats ? { ...profile.rankedStats } : undefined,
    performanceStats: profile.performanceStats ? { ...profile.performanceStats } : undefined,
    recentMatches: profile.recentMatches?.map((match) => ({ ...match })),
    rankHistory: profile.rankHistory?.map((point) => ({ ...point }))
  } : undefined;
}

function normalizedParticipationSession(value: unknown, streamerId: string): ParticipationSession | undefined {
  const input = objectRecord(value);
  const sessionId = optionalString(input?.sessionId);
  const status = optionalString(input?.status) as ParticipationSession["status"] | undefined;
  const createdAt = optionalString(input?.createdAt);
  const updatedAt = optionalString(input?.updatedAt);
  if (!sessionId || !status || !createdAt || !updatedAt || !["closed", "recruiting", "in_game", "completed"].includes(status)) return undefined;
  const rawSnapshot = objectRecord(input?.profileSnapshot);
  const profileSnapshot = rawSnapshot && optionalString(rawSnapshot.riotGameName) && optionalString(rawSnapshot.riotTagLine)
    ? {
        ...(rawSnapshot as StreamerProfileSnapshot),
        riotGameName: optionalString(rawSnapshot.riotGameName)!,
        riotTagLine: optionalString(rawSnapshot.riotTagLine)!,
        normalizedRiotId: optionalString(rawSnapshot.normalizedRiotId) ?? normalizeRiotIdKey(optionalString(rawSnapshot.riotGameName)!, optionalString(rawSnapshot.riotTagLine)!),
        capturedAt: optionalString(rawSnapshot.capturedAt) ?? createdAt,
        profile: cloneParticipationStreamerProfile(rawSnapshot.profile as ParticipationStreamerProfile | undefined)
      }
    : undefined;
  return {
    streamerId,
    sessionId,
    publicSessionId: /^ps_[A-Za-z0-9_-]{32}$/u.test(optionalString(input?.publicSessionId) ?? "")
      ? optionalString(input?.publicSessionId)!
      : publicParticipationSessionIdFromInternal(sessionId),
    game: normalizeParticipationGame(input?.game),
    status,
    listingVisibility: input?.listingVisibility === "followers" ? "followers" : "public",
    maxQueueSize: Math.max(1, optionalInteger(input?.maxQueueSize) ?? 100),
    allowRejoin: input?.allowRejoin !== false,
    checkInSeconds: Math.max(1, optionalInteger(input?.checkInSeconds) ?? 60),
    profileSnapshot,
    createdAt,
    updatedAt,
    endedAt: optionalString(input?.endedAt)
  };
}

function publicParticipationSessionIdFromInternal(sessionId: string): string {
  return `ps_${crypto.createHash("sha256").update(`public:${sessionId}`).digest("base64url").slice(0, 32)}`;
}

function cloneParticipationSession(session: ParticipationSession | undefined): ParticipationSession | undefined {
  return session ? {
    ...session,
    profileSnapshot: session.profileSnapshot ? {
      ...session.profileSnapshot,
      profile: cloneParticipationStreamerProfile(session.profileSnapshot.profile)
    } : undefined
  } : undefined;
}

function normalizedLolAutomationSettings(value: unknown, streamerId: string): LolAutomationSettings {
  const input = objectRecord(value);
  const pollIntervalMs = Number(input?.pollIntervalMs);
  const gameEndDebounceMs = Number(input?.gameEndDebounceMs);
  return {
    streamerId,
    enabled: typeof input?.enabled === "boolean" ? input.enabled : DEFAULT_LOL_AUTOMATION_SETTINGS.enabled,
    autoSelectNextAfterGame: typeof input?.autoSelectNextAfterGame === "boolean" ? input.autoSelectNextAfterGame : DEFAULT_LOL_AUTOMATION_SETTINGS.autoSelectNextAfterGame,
    // 등록 스트리머별 Twitch chat token이 분리되기 전에는 서버 전역 채팅으로의 전송을 허용하지 않습니다.
    announceInChat: false,
    chatLocale: normalizeParticipationChatLocale(input?.chatLocale),
    pollIntervalMs: Number.isFinite(pollIntervalMs) ? Math.max(10_000, Math.trunc(pollIntervalMs)) : DEFAULT_LOL_AUTOMATION_SETTINGS.pollIntervalMs,
    gameEndDebounceMs: Number.isFinite(gameEndDebounceMs) ? Math.max(0, Math.trunc(gameEndDebounceMs)) : DEFAULT_LOL_AUTOMATION_SETTINGS.gameEndDebounceMs,
    updatedAt: optionalString(input?.updatedAt) ?? nowIso()
  };
}

function normalizedFollowerActivity(value: unknown): FollowerActivity {
  const input = objectRecord(value);
  const rawGenres = objectRecord(input?.genres);
  const genres: Record<string, number> = {};
  for (const [name, count] of Object.entries(rawGenres ?? {})) {
    const safeCount = Number(count);
    if (name && Number.isFinite(safeCount) && safeCount > 0) genres[name] = Math.trunc(safeCount);
  }
  return {
    chatMessages: Math.max(0, Math.trunc(Number(input?.chatMessages) || 0)),
    participationEntries: Math.max(0, Math.trunc(Number(input?.participationEntries) || 0)),
    total: Math.max(0, Math.trunc(Number(input?.total) || 0)),
    genres,
    lastActivityAt: optionalString(input?.lastActivityAt)
  };
}

function normalizedFollowerRecord(value: unknown): FollowerRecord | undefined {
  const input = objectRecord(value);
  const userId = optionalString(input?.userId);
  if (!userId) return undefined;
  const now = nowIso();
  const status = input?.status === "unfollowed" ? "unfollowed" : "following";
  const source = input?.source === "eventsub" ? "eventsub" : "snapshot";
  return {
    userId,
    userLogin: optionalString(input?.userLogin),
    userName: optionalString(input?.userName) ?? userId,
    profileImageUrl: optionalString(input?.profileImageUrl),
    riotGameName: optionalString(input?.riotGameName),
    riotTagLine: optionalString(input?.riotTagLine),
    riotPuuid: optionalString(input?.riotPuuid),
    riotIdUpdatedAt: optionalString(input?.riotIdUpdatedAt),
    followedAt: optionalString(input?.followedAt),
    firstSeenAt: optionalString(input?.firstSeenAt) ?? optionalString(input?.followedAt) ?? now,
    lastSeenAt: optionalString(input?.lastSeenAt) ?? now,
    status,
    unfollowedAt: status === "unfollowed" ? optionalString(input?.unfollowedAt) : undefined,
    source,
    activity: normalizedFollowerActivity(input?.activity)
  };
}

function requiredBroadcasterUserId(value: unknown): string {
  const broadcasterUserId = optionalString(value)?.trim();
  if (!broadcasterUserId) throw new Error("broadcasterUserId는 필수입니다.");
  return broadcasterUserId;
}

function normalizedFollowerState(value: unknown, label: string): ScopedFollowerState {
  const input = objectRecord(value);
  if (!input || !Array.isArray(input.followers)) {
    throw new Error(`${label} follower 상태 형식이 올바르지 않습니다.`);
  }
  const followers = new Map<string, FollowerRecord>();
  for (const value of input.followers) {
    const follower = normalizedFollowerRecord(value);
    if (!follower || followers.has(follower.userId)) {
      throw new Error(`${label} follower 레코드가 올바르지 않습니다.`);
    }
    followers.set(follower.userId, follower);
  }
  const rawTotal = input.lastFollowerSnapshotTotal;
  if (rawTotal !== undefined && (typeof rawTotal !== "number" || !Number.isSafeInteger(rawTotal) || rawTotal < 0)) {
    throw new Error(`${label} follower snapshot 전체 수가 올바르지 않습니다.`);
  }
  const rawTruncated = input.lastFollowerSnapshotTruncated;
  if (rawTruncated !== undefined && typeof rawTruncated !== "boolean") {
    throw new Error(`${label} follower snapshot 일부 조회 상태가 올바르지 않습니다.`);
  }
  return {
    followers,
    lastSnapshotAt: optionalString(input.lastFollowerSnapshotAt),
    lastSnapshotTotal: rawTotal as number | undefined,
    lastSnapshotTruncated: rawTruncated as boolean | undefined
  };
}

function serializedFollowerState(state: ScopedFollowerState): {
  followers: FollowerRecord[];
  lastFollowerSnapshotAt?: string;
  lastFollowerSnapshotTotal?: number;
  lastFollowerSnapshotTruncated?: boolean;
} {
  return {
    followers: [...state.followers.values()].map(cloneFollowerRecord),
    lastFollowerSnapshotAt: state.lastSnapshotAt,
    lastFollowerSnapshotTotal: state.lastSnapshotTotal,
    lastFollowerSnapshotTruncated: state.lastSnapshotTruncated
  };
}

function cloneStreamerProfileLinks(links: StreamerProfileLink[] | undefined): StreamerProfileLink[] | undefined {
  return links?.map((link) => ({ ...link }));
}

function normalizedStreamerProfileLinks(value: unknown, legacyUrl?: string, legacyLabel?: string): StreamerProfileLink[] | undefined {
  const links: StreamerProfileLink[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      const input = objectRecord(item);
      const url = optionalString(input?.url);
      if (!url) continue;
      const label = optionalString(input?.label) || legacyLabel || url;
      links.push({
        id: optionalString(input?.id) || newId("plink"),
        url,
        label,
        platform: optionalString(input?.platform)
      });
    }
  }
  if (!links.length && legacyUrl) {
    links.push({
      id: newId("plink"),
      url: legacyUrl,
      label: legacyLabel || legacyUrl
    });
  }
  return links.length ? links : undefined;
}

function firstStreamerProfileLink(links: StreamerProfileLink[] | undefined): StreamerProfileLink | undefined {
  return links?.find((link) => link.url);
}

function cloneStreamerRiotIdRequest(request: StreamerRiotIdRequest): StreamerRiotIdRequest {
  return { ...request, profileLinks: cloneStreamerProfileLinks(request.profileLinks) };
}

function streamerDashboardSlug(twitchLogin: string, twitchUserId?: string): string {
  const slug = twitchLogin.trim().toLowerCase().replace(/[^a-z0-9_]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return slug || `streamer-${twitchUserId ?? "unknown"}`;
}

function newStreamerDashboardKey(): string {
  return `sdk_${crypto.randomBytes(24).toString("base64url")}`;
}

function ensureApprovedStreamerDashboardAccess(request: StreamerRiotIdRequest): void {
  if (request.status !== "approved" || request.dashboardEnabled !== true) return;
  request.dashboardSlug = request.dashboardSlug || streamerDashboardSlug(request.twitchLogin, request.twitchUserId);
  request.dashboardKey = request.dashboardKey || newStreamerDashboardKey();
}

/* accountRole이 없는 row는 단일 계정 시절 데이터이므로 main으로 취급합니다.
   서브 계정은 생성 시점부터 명시적으로 "sub"를 갖습니다. */
function isSubStreamerRiotAccount(request: Pick<StreamerRiotIdRequest, "accountRole">): boolean {
  return request.accountRole === "sub";
}

const SELF_SERVICE_SUB_ACCOUNT_REVIEWER = "streamer-self-service";
const SELF_SERVICE_SUB_ACCOUNT_NOTE = "스트리머 본인 등록으로 자동 승인되었습니다.";

function normalizedStreamerRiotIdRequest(value: unknown): StreamerRiotIdRequest | undefined {
  const input = objectRecord(value);
  const id = optionalString(input?.id);
  const twitchUserId = optionalString(input?.twitchUserId);
  const twitchLogin = optionalString(input?.twitchLogin);
  const twitchDisplayName = optionalString(input?.twitchDisplayName);
  const riotGameName = optionalString(input?.riotGameName);
  const riotTagLine = optionalString(input?.riotTagLine);
  if (!id || !twitchUserId || !twitchLogin || !twitchDisplayName || !riotGameName || !riotTagLine) return undefined;
  const status = input?.status === "approved" || input?.status === "rejected" ? input.status : "pending";
  const requestedAt = optionalString(input?.requestedAt) ?? nowIso();
  const updatedAt = optionalString(input?.updatedAt) ?? requestedAt;
  const profileLinkUrl = optionalString(input?.profileLinkUrl);
  const profileLinkLabel = optionalString(input?.profileLinkLabel);
  const profileLinks = normalizedStreamerProfileLinks(input?.profileLinks, profileLinkUrl, profileLinkLabel);
  const primaryProfileLink = firstStreamerProfileLink(profileLinks);
  const request: StreamerRiotIdRequest = {
    id,
    twitchUserId,
    twitchLogin,
    twitchDisplayName,
    twitchProfileImageUrl: optionalString(input?.twitchProfileImageUrl),
    riotGameName,
    riotTagLine,
    normalizedRiotId: normalizeRiotIdKey(riotGameName, riotTagLine),
    dashboardSlug: optionalString(input?.dashboardSlug),
    dashboardKey: optionalString(input?.dashboardKey),
    profileLinkUrl: primaryProfileLink?.url ?? profileLinkUrl,
    profileLinkLabel: primaryProfileLink?.label ?? profileLinkLabel,
    profileLinks,
    status,
    accountRole: input?.accountRole === "sub" ? "sub" : input?.accountRole === "main" ? "main" : undefined,
    dashboardEnabled: status === "approved" && input?.dashboardEnabled === true,
    requestedAt,
    updatedAt,
    reviewedAt: optionalString(input?.reviewedAt),
    reviewer: optionalString(input?.reviewer),
    note: optionalString(input?.note)
  };
  ensureApprovedStreamerDashboardAccess(request);
  return request;
}

function optionalInteger(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : undefined;
}

type ScopedParticipationRuntime = {
  isOpen: boolean;
  revision: number;
  queue: ParticipationEntry[];
  streamerProfile?: ParticipationStreamerProfile;
  session?: ParticipationSession;
};

const DEFAULT_LOL_AUTOMATION_SETTINGS = {
  enabled: false,
  autoSelectNextAfterGame: true,
  announceInChat: false,
  pollIntervalMs: 45_000,
  gameEndDebounceMs: 90_000
} as const;

export class Store {
  private static readonly maxSeenTwitchMessageIds = 5000;
  private static readonly maxEvents = 200;
  private static readonly maxActions = 200;
  private static readonly maxQuestions = 200;
  private static readonly maxHighlights = 200;
  private readonly seenTwitchMessageIds = new Set<string>();
  private readonly seenTwitchMessageIdOrder: string[] = [];
  private readonly events: InternalEvent[] = [];
  private readonly actions: ActionRecord[] = [];
  private readonly questions: QuestionEntry[] = [];
  private readonly highlights: HighlightEntry[] = [];
  private readonly followersByBroadcaster = new Map<string, ScopedFollowerState>();
  private unassignedLegacyFollowerState?: UnassignedLegacyFollowerState;
  private followerPersistenceBlocked = false;
  private followerPersistTimer?: NodeJS.Timeout;
  private participationQueue: ParticipationEntry[] = [];
  private participationRevision = 0;
  private participationStreamerProfile?: ParticipationStreamerProfile;
  private readonly participationByStreamer = new Map<string, ScopedParticipationRuntime>();
  private readonly lolAutomationByStreamer = new Map<string, LolAutomationSettings>();
  private runtimePersistRequestedGeneration = 0;
  private runtimePersistCompletedGeneration = 0;
  private runtimePersistTask?: Promise<void>;
  private runtimePersistLastError?: { generation: number; error: Error };
  private streamerRiotIdRequests: StreamerRiotIdRequest[] = [];
  private readonly persistenceFailures = new Map<string, StorePersistenceFailure>();
  private readonly persistenceLoadStates: Record<StorePersistenceFailure["scope"], PersistenceLoadState> = {
    followers: "not_loaded",
    streamer_riot_ids: "not_loaded",
    runtime: "not_loaded"
  };
  private readonly twitchStreamLiveStatusByUserId = new Map<string, TwitchStreamLiveStatus>();
  private twitchEventSubStatus: TwitchEventSubStatus = {
    websocket: "disabled",
    activeSubscriptions: 0,
    failedSubscriptions: [],
    missingScopes: [],
    subscriptions: []
  };
  private twitchChatStatus: TwitchChatStatus = {
    mode: "broadcaster",
    queueSize: 0,
    throttleMs: 1500,
    cooldownMs: 10_000,
    maxMessageLength: 500,
    recentFailures: []
  };
  private status: BotStatus = {
    server: "online",
    twitch: "disabled",
    stream: "unknown",
    participation: "closed",
    startedAt: nowIso(),
    postStreamReportReady: false
  };

  constructor(private readonly options: StoreOptions = {}) {
    this.loadFollowerState();
    this.loadStreamerRiotIdState();
    this.loadRuntimeState();
  }

  private scopedFollowerState(broadcasterUserId: string, create = true): ScopedFollowerState | undefined {
    this.assertPersistenceAvailable("followers");
    const normalizedBroadcasterUserId = requiredBroadcasterUserId(broadcasterUserId);
    const existing = this.followersByBroadcaster.get(normalizedBroadcasterUserId);
    if (existing || !create) return existing;
    const state: ScopedFollowerState = { followers: new Map<string, FollowerRecord>() };
    this.followersByBroadcaster.set(normalizedBroadcasterUserId, state);
    return state;
  }

  private scopedParticipationRuntime(streamerId: string, create = true): ScopedParticipationRuntime | undefined {
    this.assertPersistenceAvailable("runtime");
    const normalizedStreamerId = streamerId.trim();
    if (!normalizedStreamerId) return undefined;
    const existing = this.participationByStreamer.get(normalizedStreamerId);
    if (existing || !create) return existing;
    const runtime: ScopedParticipationRuntime = { isOpen: false, revision: 0, queue: [] };
    this.participationByStreamer.set(normalizedStreamerId, runtime);
    return runtime;
  }

  private participationQueueFor(streamerId?: string): ParticipationEntry[] {
    this.assertPersistenceAvailable("runtime");
    if (!streamerId) return this.participationQueue;
    return this.scopedParticipationRuntime(streamerId)?.queue ?? [];
  }

  private participationOpenFor(streamerId?: string): boolean {
    this.assertPersistenceAvailable("runtime");
    if (!streamerId) return this.status.participation === "open";
    return this.scopedParticipationRuntime(streamerId, false)?.isOpen === true;
  }

  private ownedParticipationEntry(entry: ParticipationEntry, streamerId?: string): ParticipationEntry {
    if (!streamerId) return entry;
    const runtime = this.scopedParticipationRuntime(streamerId);
    return {
      ...entry,
      streamerId,
      sessionId: entry.sessionId ?? runtime?.session?.sessionId
    };
  }

  private reportPersistenceFailure(failure: StorePersistenceFailure): void {
    this.persistenceFailures.set(failure.scope, failure);
    this.options.onPersistenceError?.(failure);
  }

  private clearPersistenceFailure(scope: StorePersistenceFailure["scope"]): void {
    this.persistenceFailures.delete(scope);
    this.persistenceLoadStates[scope] = "ready";
  }

  private isMissingStateFile(error: unknown): boolean {
    return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
  }

  private markPersistenceLoadFailure(scope: StorePersistenceFailure["scope"], error: unknown): void {
    this.persistenceLoadStates[scope] = error instanceof SyntaxError
      || (error instanceof Error && !("code" in error))
      ? "corrupted"
      : "unreadable";
  }

  private assertPersistenceAvailable(scope: StorePersistenceFailure["scope"]): void {
    const state = this.persistenceLoadStates[scope];
    if (state === "corrupted" || state === "unreadable" || state === "encryption_failed") {
      throw new Error(`STATE_UNAVAILABLE:${scope}:${state}`);
    }
  }

  getReadiness(): StoreReadiness {
    const paths = [
      ["followers", this.options.followerStatePath],
      ["streamer_riot_ids", this.options.streamerRiotIdStatePath],
      ["runtime", this.options.runtimeStatePath]
    ].filter((entry): entry is [StorePersistenceFailure["scope"], string] => Boolean(entry[1]));
    let statePathsWritable = true;
    for (const [scope, filePath] of paths) {
      try {
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        fs.accessSync(dir, fs.constants.W_OK);
      } catch (error) {
        statePathsWritable = false;
        this.reportPersistenceFailure({
          scope,
          operation: "readiness",
          filePath,
          error: toSafeErrorMessage(error)
        });
      }
    }
    const errors = [...this.persistenceFailures.values()].map((failure) => `${failure.scope}:${failure.operation}`);
    return {
      ok: statePathsWritable && errors.length === 0,
      checks: {
        statePathsConfigured: paths.length > 0,
        statePathsWritable,
        persistenceHealthy: errors.length === 0
      },
      errors,
      loadStates: { ...this.persistenceLoadStates }
    };
  }

  flush(): void {
    if (this.followerPersistTimer) {
      clearTimeout(this.followerPersistTimer);
      this.followerPersistTimer = undefined;
    }
    if (this.persistenceLoadStates.followers === "ready") this.persistFollowerState();
    if (this.persistenceLoadStates.streamer_riot_ids === "ready") this.persistStreamerRiotIdState();
    if (this.persistenceLoadStates.runtime === "ready") this.persistRuntimeState();
  }

  async flushRuntimeState(): Promise<void> {
    if (!this.options.runtimeStatePath) return;
    const generation = this.persistRuntimeState();
    await this.waitForRuntimePersistence(generation);
  }

  close(): void {
    this.flush();
  }

  async closeAsync(): Promise<void> {
    this.flush();
    await this.waitForRuntimePersistence(this.runtimePersistRequestedGeneration);
  }

  getStatus(): BotStatus {
    return { ...this.status };
  }

  patchStatus(patch: Partial<BotStatus>): BotStatus {
    this.status = { ...this.status, ...patch };
    return this.getStatus();
  }

  setTwitchStreamLiveStatus(input: {
    twitchUserId: string;
    isLive: boolean;
    source: "eventsub" | "snapshot";
    updatedAt?: string;
  }): TwitchStreamLiveStatus | undefined {
    const twitchUserId = input.twitchUserId.trim();
    if (!/^\d{1,32}$/.test(twitchUserId)) return undefined;
    const status: TwitchStreamLiveStatus = {
      twitchUserId,
      isLive: input.isLive,
      source: input.source,
      updatedAt: input.updatedAt ?? nowIso()
    };
    this.twitchStreamLiveStatusByUserId.set(twitchUserId, status);
    return { ...status };
  }

  getTwitchStreamLiveStatus(twitchUserId: string | undefined): TwitchStreamLiveStatus | undefined {
    const safeTwitchUserId = twitchUserId?.trim();
    if (!safeTwitchUserId) return undefined;
    const status = this.twitchStreamLiveStatusByUserId.get(safeTwitchUserId);
    return status ? { ...status } : undefined;
  }

  markTwitchMessageSeen(id: string): boolean {
    return this.markTwitchEventSeen([id]);
  }

  markTwitchEventSeen(ids: readonly string[]): boolean {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) return true;
    if (uniqueIds.some((id) => this.seenTwitchMessageIds.has(id))) return false;
    for (const id of uniqueIds) {
      this.seenTwitchMessageIds.add(id);
      this.seenTwitchMessageIdOrder.push(id);
    }
    this.pruneSeenTwitchMessageIds();
    return true;
  }

  private pruneSeenTwitchMessageIds(): void {
    while (this.seenTwitchMessageIdOrder.length > Store.maxSeenTwitchMessageIds) {
      const expiredId = this.seenTwitchMessageIdOrder.shift();
      if (expiredId) this.seenTwitchMessageIds.delete(expiredId);
    }
  }

  getTwitchEventSubStatus(): TwitchEventSubStatus {
    return {
      ...this.twitchEventSubStatus,
      failedSubscriptions: this.twitchEventSubStatus.failedSubscriptions.map((subscription) => ({ ...subscription })),
      subscriptions: this.twitchEventSubStatus.subscriptions.map((subscription) => ({ ...subscription })),
      missingScopes: [...this.twitchEventSubStatus.missingScopes]
    };
  }

  patchTwitchEventSubStatus(patch: Partial<TwitchEventSubStatus>): TwitchEventSubStatus {
    this.twitchEventSubStatus = {
      ...this.twitchEventSubStatus,
      ...patch,
      failedSubscriptions: patch.failedSubscriptions
        ? patch.failedSubscriptions.map((subscription) => ({ ...subscription }))
        : this.twitchEventSubStatus.failedSubscriptions,
      subscriptions: patch.subscriptions
        ? patch.subscriptions.map((subscription) => ({ ...subscription }))
        : this.twitchEventSubStatus.subscriptions,
      missingScopes: patch.missingScopes ? [...patch.missingScopes] : this.twitchEventSubStatus.missingScopes
    };
    return this.getTwitchEventSubStatus();
  }

  setTwitchEventSubSubscriptions(subscriptions: TwitchEventSubSubscriptionStatus[]): TwitchEventSubStatus {
    const failedSubscriptions = subscriptions.filter((subscription) => subscription.status === "failed");
    const missingScopes = [...new Set(subscriptions.flatMap((subscription) => subscription.missingScopes))];
    return this.patchTwitchEventSubStatus({
      activeSubscriptions: subscriptions.filter((subscription) => subscription.status === "active").length,
      failedSubscriptions,
      missingScopes,
      subscriptions
    });
  }

  getTwitchChatStatus(): TwitchChatStatus {
    return {
      ...this.twitchChatStatus,
      recentFailures: this.twitchChatStatus.recentFailures.map((failure) => ({ ...failure }))
    };
  }

  patchTwitchChatStatus(patch: Partial<TwitchChatStatus>): TwitchChatStatus {
    this.twitchChatStatus = {
      ...this.twitchChatStatus,
      ...patch,
      recentFailures: patch.recentFailures
        ? patch.recentFailures.map((failure) => ({ ...failure }))
        : this.twitchChatStatus.recentFailures
    };
    return this.getTwitchChatStatus();
  }

  addTwitchChatFailure(failure: TwitchChatSendFailure): TwitchChatStatus {
    const recentFailures = [failure, ...this.twitchChatStatus.recentFailures].slice(0, 10);
    return this.patchTwitchChatStatus({
      lastFailureAt: failure.createdAt,
      recentFailures
    });
  }

  addEvent(event: InternalEvent): void {
    this.events.unshift(event);
    this.events.length = Math.min(this.events.length, Store.maxEvents);
  }

  recentEvents(limit = 50): InternalEvent[] {
    return this.events.slice(0, limit);
  }

  addAction(record: ActionRecord): void {
    this.actions.unshift(record);
    this.actions.length = Math.min(this.actions.length, Store.maxActions);
  }

  recentActions(limit = 50): ActionRecord[] {
    return this.actions.slice(0, limit);
  }

  addQuestion(input: { userName: string; question: string; translatedQuestion?: string }): QuestionEntry {
    const entry: QuestionEntry = {
      id: newId("question"),
      userName: input.userName,
      question: input.question,
      translatedQuestion: input.translatedQuestion,
      status: "pending",
      createdAt: nowIso()
    };
    this.questions.unshift(entry);
    this.questions.length = Math.min(this.questions.length, Store.maxQuestions);
    return entry;
  }

  getQuestions(): QuestionEntry[] {
    return [...this.questions];
  }

  addHighlight(input: { userName?: string; reason: string }): HighlightEntry {
    const entry: HighlightEntry = {
      id: newId("highlight"),
      userName: input.userName,
      reason: input.reason,
      createdAt: nowIso()
    };
    this.highlights.unshift(entry);
    this.highlights.length = Math.min(this.highlights.length, Store.maxHighlights);
    return entry;
  }

  getHighlights(): HighlightEntry[] {
    return [...this.highlights];
  }

  recordFollower(input: FollowerSnapshotInput & { broadcasterUserId: string; source: "eventsub" | "snapshot" }): FollowerRecord {
    const state = this.scopedFollowerState(input.broadcasterUserId)!;
    return this.upsertFollower(state, input, true);
  }

  private upsertFollower(
    state: ScopedFollowerState,
    input: FollowerSnapshotInput & { source: "eventsub" | "snapshot" },
    persist: boolean
  ): FollowerRecord {
    const now = nowIso();
    const previous = state.followers.get(input.userId);
    const next: FollowerRecord = {
      userId: input.userId,
      userLogin: input.userLogin ?? previous?.userLogin,
      userName: input.userName || previous?.userName || input.userId,
      profileImageUrl: input.profileImageUrl ?? previous?.profileImageUrl,
      riotGameName: previous?.riotGameName,
      riotTagLine: previous?.riotTagLine,
      riotPuuid: previous?.riotPuuid,
      riotIdUpdatedAt: previous?.riotIdUpdatedAt,
      followedAt: input.followedAt ?? previous?.followedAt,
      firstSeenAt: previous?.firstSeenAt ?? input.followedAt ?? now,
      lastSeenAt: now,
      status: "following",
      source: input.source,
      activity: previous ? {
        ...previous.activity,
        genres: { ...previous.activity.genres }
      } : emptyFollowerActivity()
    };
    state.followers.set(input.userId, next);
    if (persist) this.persistFollowerState();
    return cloneFollowerRecord(next);
  }

  recordFollowerActivity(input: {
    broadcasterUserId: string;
    userId: string;
    userName?: string;
    kind: FollowerActivityKind;
    genre: string;
    riotGameName?: string;
    riotTagLine?: string;
    riotPuuid?: string;
  }): FollowerRecord | undefined {
    const state = this.scopedFollowerState(input.broadcasterUserId, false);
    const previous = state?.followers.get(input.userId);
    if (!previous || previous.status !== "following") return undefined;
    const now = nowIso();
    previous.userName = input.userName || previous.userName;
    previous.lastSeenAt = now;
    if (input.riotGameName && input.riotTagLine) {
      previous.riotGameName = input.riotGameName;
      previous.riotTagLine = input.riotTagLine;
      previous.riotPuuid = input.riotPuuid || previous.riotPuuid;
      previous.riotIdUpdatedAt = now;
    }
    previous.activity.total += 1;
    previous.activity.lastActivityAt = now;
    previous.activity.genres[input.genre] = (previous.activity.genres[input.genre] ?? 0) + 1;
    if (input.kind === "chat") previous.activity.chatMessages += 1;
    if (input.kind === "participation") previous.activity.participationEntries += 1;
    this.queueFollowerStatePersist();
    return cloneFollowerRecord(previous);
  }

  reconcileFollowerSnapshot(input: {
    broadcasterUserId: string;
    followers: FollowerSnapshotInput[];
    total?: number;
    truncated?: boolean;
  }): FollowerManagementState {
    const state = this.scopedFollowerState(input.broadcasterUserId)!;
    const now = nowIso();
    const snapshotIds = new Set<string>();
    for (const follower of input.followers) {
      snapshotIds.add(follower.userId);
      this.upsertFollower(state, { ...follower, source: "snapshot" }, false);
    }

    if (!input.truncated) {
      for (const record of state.followers.values()) {
        if (record.status !== "following" || snapshotIds.has(record.userId)) continue;
        record.status = "unfollowed";
        record.unfollowedAt = now;
        record.lastSeenAt = now;
      }
    }

    state.lastSnapshotAt = now;
    state.lastSnapshotTotal = input.total;
    state.lastSnapshotTruncated = Boolean(input.truncated);
    this.persistFollowerState();
    return this.getFollowerManagementState(input.broadcasterUserId);
  }

  getFollowerManagementState(broadcasterUserId: string): FollowerManagementState {
    const state = this.scopedFollowerState(broadcasterUserId, false);
    const followers = (state ? [...state.followers.values()] : [])
      .map(cloneFollowerRecord)
      .sort((a, b) => followerSortTime(b) - followerSortTime(a));
    const activeFollowers = followers.filter((record) => record.status === "following");
    const recentFollowers = activeFollowers.slice(0, 12);
    const recentUnfollowers = followers
      .filter((record) => record.status === "unfollowed")
      .sort((a, b) => (Date.parse(b.unfollowedAt ?? "") || 0) - (Date.parse(a.unfollowedAt ?? "") || 0))
      .slice(0, 12);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const genreCounts = new Map<string, number>();
    for (const follower of activeFollowers) {
      for (const [name, count] of Object.entries(follower.activity.genres)) {
        genreCounts.set(name, (genreCounts.get(name) ?? 0) + count);
      }
    }

    return {
      summary: {
        knownFollowers: followers.length,
        activeFollowers: activeFollowers.length,
        unfollowed: followers.length - activeFollowers.length,
        newFollowers7d: activeFollowers.filter((record) => (Date.parse(record.followedAt ?? record.firstSeenAt) || 0) >= sevenDaysAgo).length,
        observedGenreFollowers: activeFollowers.filter((record) => Object.keys(record.activity.genres).length > 0).length
      },
      followers,
      recentFollowers,
      recentUnfollowers,
      topObservedGenres: [...genreCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count })),
      lastSnapshotAt: state?.lastSnapshotAt,
      lastSnapshotTotal: state?.lastSnapshotTotal,
      lastSnapshotTruncated: state?.lastSnapshotTruncated,
      dataNotes: [
        "새 팔로워는 Twitch EventSub channel.follow 이벤트와 follower snapshot에서 기록합니다.",
        "팔로우 취소는 Twitch가 실시간 이벤트를 제공하지 않아 전체 follower snapshot 비교로만 추정합니다.",
        "첫 follower snapshot 저장 이후 다음 전체 새로고침부터 팔로우 취소 추정이 가능합니다.",
        "일부만 조회됨이 true이면 누락을 언팔로우로 오인하지 않기 위해 팔로우 취소 추정을 하지 않습니다.",
        "시청 장르 이력은 Twitch API가 제공하지 않으므로 StreamOps가 관측한 채팅/시참 활동 기준으로만 표시합니다."
      ]
    };
  }

  private loadFollowerState(): void {
    if (!this.options.followerStatePath) return;
    this.followersByBroadcaster.clear();
    this.unassignedLegacyFollowerState = undefined;
    this.followerPersistenceBlocked = false;
    try {
      const raw = fs.readFileSync(this.options.followerStatePath, "utf8");
      const parsed = objectRecord(JSON.parse(raw));
      if (!parsed) throw new Error("follower 상태 파일 형식이 올바르지 않습니다.");

      if (parsed.version === 1) {
        const legacyState = normalizedFollowerState(parsed, "v1");
        this.unassignedLegacyFollowerState = {
          ...legacyState,
          sourceVersion: 1,
          reason: "owner_unverified"
        };
        this.clearPersistenceFailure("followers");
        this.persistFollowerState();
        return;
      }

      if (parsed.version !== 2) {
        throw new Error(`지원하지 않는 follower 상태 버전입니다: ${String(parsed.version ?? "missing")}`);
      }
      if (!Array.isArray(parsed.scopes)) {
        throw new Error("v2 follower scope 목록 형식이 올바르지 않습니다.");
      }
      for (const rawScope of parsed.scopes) {
        const scope = objectRecord(rawScope);
        const broadcasterUserId = requiredBroadcasterUserId(scope?.broadcasterUserId);
        if (this.followersByBroadcaster.has(broadcasterUserId)) {
          throw new Error(`중복된 follower broadcaster scope입니다: ${broadcasterUserId}`);
        }
        this.followersByBroadcaster.set(
          broadcasterUserId,
          normalizedFollowerState(scope, `broadcaster ${broadcasterUserId}`)
        );
      }

      if (parsed.unassignedLegacy !== undefined) {
        const legacy = objectRecord(parsed.unassignedLegacy);
        if (legacy?.sourceVersion !== 1 || legacy.reason !== "owner_unverified") {
          throw new Error("미할당 legacy follower 상태 형식이 올바르지 않습니다.");
        }
        this.unassignedLegacyFollowerState = {
          ...normalizedFollowerState(legacy, "unassigned legacy"),
          sourceVersion: 1,
          reason: "owner_unverified"
        };
      }
      this.clearPersistenceFailure("followers");
    } catch (error) {
      this.followersByBroadcaster.clear();
      this.unassignedLegacyFollowerState = undefined;
      const missingStateFile = this.isMissingStateFile(error);
      this.followerPersistenceBlocked = !missingStateFile;
      if (missingStateFile) {
        this.clearPersistenceFailure("followers");
      } else {
        this.markPersistenceLoadFailure("followers", error);
        this.reportPersistenceFailure({ scope: "followers", operation: "load", filePath: this.options.followerStatePath, error: toSafeErrorMessage(error) });
      }
    }
  }

  private persistFollowerState(): void {
    if (!this.options.followerStatePath) return;
    this.assertPersistenceAvailable("followers");
    let tmpPath: string | undefined;
    try {
      const dir = path.dirname(this.options.followerStatePath);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fs.chmodSync(dir, 0o700);
      tmpPath = `${this.options.followerStatePath}.${process.pid}.${Date.now()}.tmp`;
      const payload = {
        version: 2,
        scopes: [...this.followersByBroadcaster.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([broadcasterUserId, state]) => ({
            broadcasterUserId,
            ...serializedFollowerState(state)
          })),
        ...(this.unassignedLegacyFollowerState ? {
          unassignedLegacy: {
            sourceVersion: this.unassignedLegacyFollowerState.sourceVersion,
            reason: this.unassignedLegacyFollowerState.reason,
            ...serializedFollowerState(this.unassignedLegacyFollowerState)
          }
        } : {})
      };
      fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      fs.renameSync(tmpPath, this.options.followerStatePath);
      fs.chmodSync(this.options.followerStatePath, 0o600);
      tmpPath = undefined;
      this.clearPersistenceFailure("followers");
    } catch (error) {
      if (tmpPath) {
        try {
          fs.rmSync(tmpPath, { force: true });
        } catch {
          // 임시 파일 정리 실패는 원본 상태 파일 보존에 영향을 주지 않습니다.
        }
      }
      this.reportPersistenceFailure({ scope: "followers", operation: "save", filePath: this.options.followerStatePath, error: toSafeErrorMessage(error) });
    }
  }

  private queueFollowerStatePersist(): void {
    if (!this.options.followerStatePath || this.followerPersistenceBlocked || this.followerPersistTimer) return;
    this.followerPersistTimer = setTimeout(() => {
      this.followerPersistTimer = undefined;
      this.persistFollowerState();
    }, 1000);
    this.followerPersistTimer.unref?.();
  }

  private loadStreamerRiotIdState(): void {
    if (!this.options.streamerRiotIdStatePath) return;
    try {
      const raw = fs.readFileSync(this.options.streamerRiotIdStatePath, "utf8");
      const parsed = objectRecord(JSON.parse(raw));
      if (parsed?.version !== 1 || !Array.isArray(parsed.requests)) {
        throw new Error("streamer Riot ID 상태 파일 schema가 올바르지 않습니다.");
      }
      const requests = parsed.requests;
      const needsDashboardAccessMigration = requests.some((value) => {
        const request = objectRecord(value);
        return request?.status === "approved" &&
          request.dashboardEnabled === true &&
          (!optionalString(request.dashboardSlug) || !optionalString(request.dashboardKey));
      });
      const normalizedRequests = requests.map(normalizedStreamerRiotIdRequest);
      if (normalizedRequests.some((request) => !request)) {
        throw new Error("streamer Riot ID 상태 파일에 올바르지 않은 레코드가 있습니다.");
      }
      this.streamerRiotIdRequests = normalizedRequests as StreamerRiotIdRequest[];
      this.clearPersistenceFailure("streamer_riot_ids");
      if (needsDashboardAccessMigration) this.persistStreamerRiotIdState();
    } catch (error) {
      this.streamerRiotIdRequests = [];
      const missingStateFile = this.isMissingStateFile(error);
      if (!missingStateFile) {
        this.markPersistenceLoadFailure("streamer_riot_ids", error);
        this.reportPersistenceFailure({ scope: "streamer_riot_ids", operation: "load", filePath: this.options.streamerRiotIdStatePath, error: toSafeErrorMessage(error) });
      } else {
        this.clearPersistenceFailure("streamer_riot_ids");
      }
    }
  }

  private persistStreamerRiotIdState(options: { throwOnFailure?: boolean } = {}): void {
    if (!this.options.streamerRiotIdStatePath) return;
    this.assertPersistenceAvailable("streamer_riot_ids");
    const tmpPath = `${this.options.streamerRiotIdStatePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      const dir = path.dirname(this.options.streamerRiotIdStatePath);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const payload = {
        version: 1,
        requests: this.streamerRiotIdRequests.map(cloneStreamerRiotIdRequest)
      };
      fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      fs.renameSync(tmpPath, this.options.streamerRiotIdStatePath);
      this.clearPersistenceFailure("streamer_riot_ids");
    } catch (error) {
      try {
        fs.rmSync(tmpPath, { force: true });
      } catch {
        // 임시 파일 정리 실패보다 원래 영속화 오류를 우선 보고합니다.
      }
      this.reportPersistenceFailure({ scope: "streamer_riot_ids", operation: "save", filePath: this.options.streamerRiotIdStatePath, error: toSafeErrorMessage(error) });
      if (options.throwOnFailure) throw error;
    }
  }

  private persistStreamerRiotIdStateOrRollback(previousState: StreamerRiotIdRequest[]): void {
    try {
      this.persistStreamerRiotIdState({ throwOnFailure: true });
    } catch (error) {
      /* 관리자 감사 로그가 성공으로 확정되기 전에 파일 저장이 실패하면, 같은
         프로세스의 메모리 상태도 디스크에 남은 이전 상태와 일치시킵니다. */
      this.streamerRiotIdRequests = previousState;
      throw error;
    }
  }

  private loadRuntimeState(): void {
    if (!this.options.runtimeStatePath) return;
    try {
      const raw = fs.readFileSync(this.options.runtimeStatePath, "utf8");
      const parsed = objectRecord(JSON.parse(raw));
      const participation = objectRecord(parsed?.participation);
      if (
        parsed?.version !== 3
        || !participation
        || typeof participation.isOpen !== "boolean"
        || !Number.isInteger(participation.revision)
        || Number(participation.revision) < 0
        || !Array.isArray(participation.queue)
      ) {
        throw new Error("runtime 상태 파일 schema가 올바르지 않습니다.");
      }
      this.participationRevision = normalizedNonNegativeInteger(participation?.revision);
      const normalizedQueue = participation.queue.map(normalizedParticipationEntry);
      if (normalizedQueue.some((entry) => !entry)) {
        throw new Error("runtime 상태 파일의 참여 대기열 레코드가 올바르지 않습니다.");
      }
      this.participationQueue = (normalizedQueue as ParticipationEntry[])
        .slice(-2000);
      this.status.participation = participation?.isOpen === true ? "open" : "closed";
      const streamerProfile = objectRecord(participation?.streamerProfile);
      if (participation.streamerProfile !== undefined && !streamerProfile) {
        throw new Error("runtime 상태 파일의 스트리머 프로필이 올바르지 않습니다.");
      }
      this.participationStreamerProfile = streamerProfile
        ? cloneParticipationStreamerProfile(streamerProfile as ParticipationStreamerProfile)
        : undefined;
      this.participationByStreamer.clear();
      const scopedParticipation = objectRecord(parsed?.participationByStreamer);
      if (parsed?.participationByStreamer !== undefined && !scopedParticipation) {
        throw new Error("runtime 상태 파일의 tenant 참여 상태가 올바르지 않습니다.");
      }
      for (const [streamerId, rawRuntime] of Object.entries(scopedParticipation ?? {})) {
        const runtime = objectRecord(rawRuntime);
        if (
          !streamerId.trim()
          || !runtime
          || typeof runtime.isOpen !== "boolean"
          || !Number.isInteger(runtime.revision)
          || Number(runtime.revision) < 0
          || !Array.isArray(runtime.queue)
        ) {
          throw new Error("runtime 상태 파일의 tenant 참여 상태 레코드가 올바르지 않습니다.");
        }
        const normalizedScopedQueue = runtime.queue.map(normalizedParticipationEntry);
        if (normalizedScopedQueue.some((entry) => !entry)) {
          throw new Error("runtime 상태 파일의 tenant 참여 대기열 레코드가 올바르지 않습니다.");
        }
        const scopedQueue = (normalizedScopedQueue as ParticipationEntry[])
          .slice(-2000)
          .map((entry) => ({ ...entry, streamerId }));
        const scopedProfile = objectRecord(runtime.streamerProfile);
        const session = normalizedParticipationSession(runtime.session, streamerId);
        if (
          (runtime.streamerProfile !== undefined && !scopedProfile)
          || (runtime.session !== undefined && !session)
        ) {
          throw new Error("runtime 상태 파일의 tenant 프로필 또는 session이 올바르지 않습니다.");
        }
        this.participationByStreamer.set(streamerId, {
          isOpen: session?.status === "completed" || session?.status === "closed"
            ? false
            : runtime.isOpen === true,
          revision: normalizedNonNegativeInteger(runtime.revision),
          queue: scopedQueue,
          streamerProfile: scopedProfile ? cloneParticipationStreamerProfile(scopedProfile as ParticipationStreamerProfile) : undefined,
          session
        });
      }
      this.lolAutomationByStreamer.clear();
      const automationByStreamer = objectRecord(parsed?.lolAutomationByStreamer);
      if (parsed?.lolAutomationByStreamer !== undefined && !automationByStreamer) {
        throw new Error("runtime 상태 파일의 tenant 자동화 설정이 올바르지 않습니다.");
      }
      for (const [streamerId, rawSettings] of Object.entries(automationByStreamer ?? {})) {
        if (!streamerId.trim() || !objectRecord(rawSettings)) {
          throw new Error("runtime 상태 파일의 tenant 자동화 설정 레코드가 올바르지 않습니다.");
        }
        this.lolAutomationByStreamer.set(streamerId, normalizedLolAutomationSettings(rawSettings, streamerId));
      }
      this.clearPersistenceFailure("runtime");
    } catch (error) {
      this.participationQueue = [];
      this.participationRevision = 0;
      this.participationStreamerProfile = undefined;
      this.participationByStreamer.clear();
      this.lolAutomationByStreamer.clear();
      this.status.participation = "closed";
      const missingStateFile = this.isMissingStateFile(error);
      if (!missingStateFile) {
        this.markPersistenceLoadFailure("runtime", error);
        this.reportPersistenceFailure({ scope: "runtime", operation: "load", filePath: this.options.runtimeStatePath, error: toSafeErrorMessage(error) });
      } else {
        this.clearPersistenceFailure("runtime");
      }
    }
  }

  private runtimeStatePayload(): string {
    const payload = {
      version: 3,
      participation: {
        isOpen: this.status.participation === "open",
        revision: this.participationRevision,
        queue: this.participationQueue.map(cloneParticipationEntry),
        streamerProfile: cloneParticipationStreamerProfile(this.participationStreamerProfile)
      },
      participationByStreamer: Object.fromEntries([...this.participationByStreamer.entries()].map(([streamerId, runtime]) => [streamerId, {
        isOpen: runtime.isOpen,
        revision: runtime.revision,
        queue: runtime.queue.map((entry) => cloneParticipationEntry({ ...entry, streamerId })),
        streamerProfile: cloneParticipationStreamerProfile(runtime.streamerProfile),
        session: cloneParticipationSession(runtime.session)
      }])),
      lolAutomationByStreamer: Object.fromEntries([...this.lolAutomationByStreamer.entries()].map(([streamerId, settings]) => [streamerId, { ...settings }]))
    };
    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  private persistRuntimeState(): number {
    if (!this.options.runtimeStatePath) return 0;
    this.assertPersistenceAvailable("runtime");
    const generation = ++this.runtimePersistRequestedGeneration;
    this.startRuntimePersistWorker();
    return generation;
  }

  private startRuntimePersistWorker(): void {
    if (!this.options.runtimeStatePath || this.runtimePersistTask) return;
    this.assertPersistenceAvailable("runtime");
    this.runtimePersistTask = this.runRuntimePersistWorker().finally(() => {
      this.runtimePersistTask = undefined;
      if (this.runtimePersistCompletedGeneration < this.runtimePersistRequestedGeneration) {
        this.startRuntimePersistWorker();
      }
    });
  }

  private async runRuntimePersistWorker(): Promise<void> {
    if (!this.options.runtimeStatePath) return;
    while (this.runtimePersistCompletedGeneration < this.runtimePersistRequestedGeneration) {
      const generation = this.runtimePersistRequestedGeneration;
      const payload = this.runtimeStatePayload();
      const dir = path.dirname(this.options.runtimeStatePath);
      const tmpPath = `${this.options.runtimeStatePath}.${process.pid}.${generation}.tmp`;
      try {
        await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
        await fs.promises.writeFile(tmpPath, payload, { encoding: "utf8", mode: 0o600 });
        await fs.promises.rename(tmpPath, this.options.runtimeStatePath);
        this.runtimePersistLastError = undefined;
        this.clearPersistenceFailure("runtime");
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(toSafeErrorMessage(error));
        this.runtimePersistLastError = { generation, error: normalizedError };
        this.reportPersistenceFailure({
          scope: "runtime",
          operation: "save",
          filePath: this.options.runtimeStatePath,
          error: toSafeErrorMessage(error)
        });
        await fs.promises.rm(tmpPath, { force: true }).catch(() => undefined);
      } finally {
        this.runtimePersistCompletedGeneration = generation;
      }
    }
  }

  private async waitForRuntimePersistence(generation: number): Promise<void> {
    if (!this.options.runtimeStatePath || generation <= 0) return;
    while (this.runtimePersistCompletedGeneration < generation) {
      const task = this.runtimePersistTask;
      if (!task) break;
      await task;
    }
    if (this.runtimePersistLastError && this.runtimePersistLastError.generation >= generation) {
      throw this.runtimePersistLastError.error;
    }
  }

  listStreamerRiotIdRequests(): StreamerRiotIdRequest[] {
    this.assertPersistenceAvailable("streamer_riot_ids");
    return this.streamerRiotIdRequests
      .map(cloneStreamerRiotIdRequest)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  listApprovedStreamerRiotIds(): StreamerRiotIdRequest[] {
    return this.listStreamerRiotIdRequests().filter((request) => request.status === "approved");
  }

  /* 스트리머당 정확히 1개인 대표(main) 계정 목록. 게임 모니터·스트리머 카드처럼
     "스트리머 1명 = 계정 1개"를 전제하는 소비자는 전체 approved 목록이 아니라
     이 목록을 써야 서브 계정이 그 자리를 가로채지 않습니다. */
  listApprovedMainStreamerRiotIds(): StreamerRiotIdRequest[] {
    return this.listApprovedStreamerRiotIds().filter((request) => !isSubStreamerRiotAccount(request));
  }

  mainApprovedStreamerRiotId(twitchUserId: string): StreamerRiotIdRequest | undefined {
    this.assertPersistenceAvailable("streamer_riot_ids");
    const request = this.streamerRiotIdRequests.find((candidate) =>
      candidate.twitchUserId === twitchUserId &&
      candidate.status === "approved" &&
      !isSubStreamerRiotAccount(candidate)
    );
    return request ? cloneStreamerRiotIdRequest(request) : undefined;
  }

  upsertStreamerRiotIdRequest(input: StreamerRiotIdRequestInput): StreamerRiotIdRequest {
    this.assertPersistenceAvailable("streamer_riot_ids");
    const now = nowIso();
    const normalizedRiotId = normalizeRiotIdKey(input.riotGameName, input.riotTagLine);
    const approvedSame = this.streamerRiotIdRequests.find((request) =>
      request.twitchUserId === input.twitchUserId &&
      request.normalizedRiotId === normalizedRiotId &&
      request.status === "approved" &&
      !isSubStreamerRiotAccount(request)
    );
    if (approvedSame) {
      Object.assign(approvedSame, {
        twitchLogin: input.twitchLogin,
        twitchDisplayName: input.twitchDisplayName,
        twitchProfileImageUrl: input.twitchProfileImageUrl,
        updatedAt: now
      });
      ensureApprovedStreamerDashboardAccess(approvedSame);
      this.persistStreamerRiotIdState();
      return cloneStreamerRiotIdRequest(approvedSame);
    }

    /* 이미 자신의 서브 계정으로 등록된 ID를 본계정으로 재신청하면 새 row를 만들지
       않고 그 서브 row를 돌려줍니다 — 같은 normalizedRiotId를 가진 row가 둘이 되면
       승인 시 같은 ID의 main·sub가 공존해 목록·매칭이 이중으로 잡힙니다.
       본계정 전환은 대시보드의 대표 지정(setMainStreamerRiotId)으로 안내합니다. */
    const subSame = this.streamerRiotIdRequests.find((request) =>
      request.twitchUserId === input.twitchUserId &&
      request.normalizedRiotId === normalizedRiotId &&
      request.status !== "rejected" &&
      isSubStreamerRiotAccount(request)
    );
    if (subSame) {
      Object.assign(subSame, {
        twitchLogin: input.twitchLogin,
        twitchDisplayName: input.twitchDisplayName,
        twitchProfileImageUrl: input.twitchProfileImageUrl,
        updatedAt: now
      });
      this.persistStreamerRiotIdState();
      return cloneStreamerRiotIdRequest(subSame);
    }

    /* 서브 계정 row는 재신청 슬롯으로 재사용하지 않습니다 — 재사용하면 대기 중인
       서브 등록이 본계정 재신청으로 소리 없이 바뀝니다. */
    const existing = this.streamerRiotIdRequests.find((request) =>
      request.twitchUserId === input.twitchUserId
      && request.status === "pending"
      && !isSubStreamerRiotAccount(request)
    )
      ?? this.streamerRiotIdRequests.find((request) =>
        request.twitchUserId === input.twitchUserId &&
        request.normalizedRiotId === normalizedRiotId &&
        request.status === "rejected" &&
        !isSubStreamerRiotAccount(request)
      );
    if (existing) {
      Object.assign(existing, {
        twitchLogin: input.twitchLogin,
        twitchDisplayName: input.twitchDisplayName,
        twitchProfileImageUrl: input.twitchProfileImageUrl,
        riotGameName: input.riotGameName,
        riotTagLine: input.riotTagLine,
        normalizedRiotId,
        status: "pending" as const,
        dashboardEnabled: false,
        updatedAt: now,
        reviewedAt: undefined,
        reviewer: undefined,
        note: undefined
      });
      this.persistStreamerRiotIdState();
      return cloneStreamerRiotIdRequest(existing);
    }

    const request: StreamerRiotIdRequest = {
      id: newId("riotreq"),
      twitchUserId: input.twitchUserId,
      twitchLogin: input.twitchLogin,
      twitchDisplayName: input.twitchDisplayName,
      twitchProfileImageUrl: input.twitchProfileImageUrl,
      riotGameName: input.riotGameName,
      riotTagLine: input.riotTagLine,
      normalizedRiotId,
      status: "pending",
      dashboardEnabled: false,
      requestedAt: now,
      updatedAt: now
    };
    this.streamerRiotIdRequests.unshift(request);
    this.persistStreamerRiotIdState();
    return cloneStreamerRiotIdRequest(request);
  }

  resolveStreamerRiotIdRequest(input: {
    requestId: string;
    decision: "approved" | "rejected";
    reviewer?: string;
    note?: string;
  }): StreamerRiotIdRequest | undefined {
    this.assertPersistenceAvailable("streamer_riot_ids");
    const request = this.streamerRiotIdRequests.find((candidate) => candidate.id === input.requestId);
    if (!request) return undefined;
    const previousState = this.streamerRiotIdRequests.map(cloneStreamerRiotIdRequest);
    const now = nowIso();
    request.status = input.decision;
    request.dashboardEnabled = false;
    request.updatedAt = now;
    request.reviewedAt = now;
    request.reviewer = input.reviewer;
    request.note = input.note;
    if (input.decision === "approved" && isSubStreamerRiotAccount(request)) {
      /* 서브 계정 승인: 전적 검색 연결만 활성화합니다. 대시보드 접근 키·프로필 링크는
         대표 계정의 자산이므로 승계하지 않고, 다른 계정도 비활성화하지 않습니다. */
      this.persistStreamerRiotIdStateOrRollback(previousState);
      return cloneStreamerRiotIdRequest(request);
    }
    if (input.decision === "approved") {
      const previousApproved = this.streamerRiotIdRequests.find((candidate) =>
        candidate.id !== request.id &&
        candidate.twitchUserId === request.twitchUserId &&
        candidate.status === "approved" &&
        !isSubStreamerRiotAccount(candidate)
      );
      request.accountRole = "main";
      request.dashboardSlug = request.dashboardSlug || previousApproved?.dashboardSlug;
      request.dashboardKey = request.dashboardKey || previousApproved?.dashboardKey;
      request.dashboardEnabled = previousApproved?.dashboardEnabled === true;
      request.profileLinks = request.profileLinks?.length
        ? cloneStreamerProfileLinks(request.profileLinks)
        : cloneStreamerProfileLinks(previousApproved?.profileLinks);
      const primaryProfileLink = firstStreamerProfileLink(request.profileLinks);
      request.profileLinkUrl = request.profileLinkUrl || primaryProfileLink?.url || previousApproved?.profileLinkUrl;
      request.profileLinkLabel = request.profileLinkLabel || primaryProfileLink?.label || previousApproved?.profileLinkLabel;
      request.profileLinks = normalizedStreamerProfileLinks(request.profileLinks, request.profileLinkUrl, request.profileLinkLabel);
      ensureApprovedStreamerDashboardAccess(request);
      /* 대표 계정 재신청 승인은 이전 "대표" 승인만 교체합니다 — 승인된 서브 계정은
         별도 자산이므로 함께 비활성화하지 않습니다. */
      for (const candidate of this.streamerRiotIdRequests) {
        if (candidate.id === request.id || candidate.twitchUserId !== request.twitchUserId || candidate.status !== "approved") continue;
        if (isSubStreamerRiotAccount(candidate)) continue;
        candidate.status = "rejected";
        candidate.dashboardEnabled = false;
        candidate.updatedAt = now;
        candidate.reviewedAt = now;
        candidate.reviewer = input.reviewer;
        candidate.note = "새 Riot ID 승인으로 이전 승인 기록을 비활성화했습니다.";
      }
    }
    this.persistStreamerRiotIdStateOrRollback(previousState);
    return cloneStreamerRiotIdRequest(request);
  }

  setStreamerRiotIdDashboardEnabled(input: {
    requestId: string;
    dashboardEnabled: boolean;
    reviewer?: string;
    note?: string;
  }): StreamerRiotIdRequest | undefined {
    this.assertPersistenceAvailable("streamer_riot_ids");
    const request = this.streamerRiotIdRequests.find((candidate) => candidate.id === input.requestId);
    /* 대시보드 접근 키는 대표 계정만 가질 수 있습니다 — 서브 row에 켜면
       한 스트리머에게 접근 키가 계정 수만큼 생깁니다. */
    if (!request || request.status !== "approved" || isSubStreamerRiotAccount(request)) return undefined;
    const previousState = this.streamerRiotIdRequests.map(cloneStreamerRiotIdRequest);
    const now = nowIso();
    request.dashboardEnabled = input.dashboardEnabled;
    ensureApprovedStreamerDashboardAccess(request);
    request.updatedAt = now;
    request.reviewedAt = now;
    request.reviewer = input.reviewer;
    request.note = input.note;
    this.persistStreamerRiotIdStateOrRollback(previousState);
    return cloneStreamerRiotIdRequest(request);
  }

  updateApprovedStreamerProfileLink(input: {
    twitchUserId: string;
    profileLinkUrl?: string;
    profileLinkLabel?: string;
    profileLinks?: StreamerProfileLink[];
  }): StreamerRiotIdRequest | undefined {
    this.assertPersistenceAvailable("streamer_riot_ids");
    const request = this.streamerRiotIdRequests.find((candidate) =>
      candidate.twitchUserId === input.twitchUserId &&
      candidate.status === "approved" &&
      !isSubStreamerRiotAccount(candidate)
    );
    if (!request) return undefined;
    const profileLinks = normalizedStreamerProfileLinks(input.profileLinks, input.profileLinkUrl, input.profileLinkLabel);
    const primaryProfileLink = firstStreamerProfileLink(profileLinks);
    request.profileLinks = profileLinks;
    request.profileLinkUrl = primaryProfileLink?.url;
    request.profileLinkLabel = primaryProfileLink ? primaryProfileLink.label : undefined;
    request.updatedAt = nowIso();
    this.persistStreamerRiotIdState();
    return cloneStreamerRiotIdRequest(request);
  }

  updateApprovedStreamerRiotId(input: {
    twitchUserId: string;
    riotGameName: string;
    riotTagLine: string;
  }): StreamerRiotIdRequest | undefined {
    this.assertPersistenceAvailable("streamer_riot_ids");
    const request = this.streamerRiotIdRequests.find((candidate) =>
      candidate.twitchUserId === input.twitchUserId &&
      candidate.status === "approved" &&
      !isSubStreamerRiotAccount(candidate)
    );
    if (!request) return undefined;
    /* 다른 row(타 스트리머 또는 자신의 서브)가 이미 쓰는 ID로의 개명은 저장
       계층에서도 거부합니다 — route 검사를 우회하는 미래 호출자에 대한 안전망.
       구체적인 오류 코드 구분은 route 계층(updateStreamerRiotIdentityForOwner) 몫. */
    const normalizedRiotId = normalizeRiotIdKey(input.riotGameName, input.riotTagLine);
    const conflict = this.streamerRiotIdRequests.find((candidate) =>
      candidate.id !== request.id &&
      candidate.status !== "rejected" &&
      candidate.normalizedRiotId === normalizedRiotId
    );
    if (conflict) return undefined;
    request.riotGameName = input.riotGameName;
    request.riotTagLine = input.riotTagLine;
    request.normalizedRiotId = normalizedRiotId;
    request.updatedAt = nowIso();
    this.persistStreamerRiotIdState();
    return cloneStreamerRiotIdRequest(request);
  }

  /* 서브 계정 등록. owner_self_service는 승인된 대표 스트리머의 대시보드 API만
     전달하며 즉시 승인합니다. 기본값은 기존 수동 검토를 보존해 다른 내부 호출자가
     실수로 자동 승인하지 못하게 합니다. */
  addStreamerSubRiotIdRequest(
    input: StreamerRiotIdRequestInput,
    options?: { approvalMode?: "manual_review" | "owner_self_service" }
  ):
    | { ok: true; request: StreamerRiotIdRequest }
    | {
      ok: false;
      code: "streamer_approval_required" | "riot_id_duplicated" | "riot_id_taken" | "riot_id_rejected" | "limit_exceeded";
    } {
    this.assertPersistenceAvailable("streamer_riot_ids");
    const selfServiceApproval = options?.approvalMode === "owner_self_service";
    if (selfServiceApproval) {
      /* route 밖의 미래 호출자도 대표 승인 절차를 우회할 수 없게 저장 계층에서
         다시 확인합니다. 자동 승인은 승인된 스트리머의 서브 계정에만 적용됩니다. */
      const approvedMain = this.streamerRiotIdRequests.some((request) =>
        request.twitchUserId === input.twitchUserId
        && request.status === "approved"
        && !isSubStreamerRiotAccount(request)
      );
      if (!approvedMain) return { ok: false, code: "streamer_approval_required" };
    }

    const now = nowIso();
    const normalizedRiotId = normalizeRiotIdKey(input.riotGameName, input.riotTagLine);
    for (const request of this.streamerRiotIdRequests) {
      if (request.normalizedRiotId !== normalizedRiotId) continue;
      if (request.status === "rejected") {
        /* 관리자가 사후 차단한 자신의 서브 계정을 삭제·재등록해 자동 승인을
           되찾는 우회를 막습니다. 다른 스트리머의 rejected row는 선점하지 않습니다. */
        if (selfServiceApproval && request.twitchUserId === input.twitchUserId && isSubStreamerRiotAccount(request)) {
          return { ok: false, code: "riot_id_rejected" };
        }
        continue;
      }
      /* 누가 가졌는지는 응답에 싣지 않습니다 — code만 구분합니다. */
      return { ok: false, code: request.twitchUserId === input.twitchUserId ? "riot_id_duplicated" : "riot_id_taken" };
    }
    const subCount = this.streamerRiotIdRequests.filter((request) =>
      request.twitchUserId === input.twitchUserId
      && isSubStreamerRiotAccount(request)
      && request.status !== "rejected"
    ).length;
    if (subCount >= STREAMER_SUB_RIOT_ACCOUNT_LIMIT) {
      return { ok: false, code: "limit_exceeded" };
    }
    const request: StreamerRiotIdRequest = {
      id: newId("riotreq"),
      twitchUserId: input.twitchUserId,
      twitchLogin: input.twitchLogin,
      twitchDisplayName: input.twitchDisplayName,
      twitchProfileImageUrl: input.twitchProfileImageUrl,
      riotGameName: input.riotGameName,
      riotTagLine: input.riotTagLine,
      normalizedRiotId,
      status: selfServiceApproval ? "approved" : "pending",
      accountRole: "sub",
      dashboardEnabled: false,
      requestedAt: now,
      updatedAt: now,
      ...(selfServiceApproval
        ? {
          reviewedAt: now,
          reviewer: SELF_SERVICE_SUB_ACCOUNT_REVIEWER,
          note: SELF_SERVICE_SUB_ACCOUNT_NOTE
        }
        : {})
    };
    this.streamerRiotIdRequests.unshift(request);
    this.persistStreamerRiotIdState();
    return { ok: true, request: cloneStreamerRiotIdRequest(request) };
  }

  /* 승인된 서브 계정을 대표로 교체합니다. 대시보드 접근 키·프로필 링크는 스트리머의
     자산이므로 이전 대표 row에서 새 대표 row로 옮겨, "대표 row를 읽는" 모든 소비자
     (dashboard slug/key 조회·게임 모니터·스트리머 카드)가 끊기지 않게 합니다. */
  setMainStreamerRiotId(input: { twitchUserId: string; requestId: string }):
    | { ok: true; request: StreamerRiotIdRequest }
    | { ok: false; code: "not_found" | "not_approved_account" } {
    this.assertPersistenceAvailable("streamer_riot_ids");
    const target = this.streamerRiotIdRequests.find((candidate) =>
      candidate.id === input.requestId && candidate.twitchUserId === input.twitchUserId
    );
    if (!target) return { ok: false, code: "not_found" };
    if (target.status !== "approved") return { ok: false, code: "not_approved_account" };
    if (!isSubStreamerRiotAccount(target)) {
      /* 이미 대표인 계정 — 상태 변화 없이 성공으로 돌려 재시도에 안전하게 합니다. */
      return { ok: true, request: cloneStreamerRiotIdRequest(target) };
    }
    const now = nowIso();
    const currentMain = this.streamerRiotIdRequests.find((candidate) =>
      candidate.twitchUserId === input.twitchUserId &&
      candidate.status === "approved" &&
      !isSubStreamerRiotAccount(candidate)
    );
    target.accountRole = "main";
    target.updatedAt = now;
    if (currentMain) {
      target.dashboardSlug = currentMain.dashboardSlug;
      target.dashboardKey = currentMain.dashboardKey;
      target.dashboardEnabled = currentMain.dashboardEnabled;
      target.profileLinks = cloneStreamerProfileLinks(currentMain.profileLinks);
      target.profileLinkUrl = currentMain.profileLinkUrl;
      target.profileLinkLabel = currentMain.profileLinkLabel;
      currentMain.accountRole = "sub";
      currentMain.dashboardSlug = undefined;
      currentMain.dashboardKey = undefined;
      currentMain.dashboardEnabled = false;
      currentMain.profileLinks = undefined;
      currentMain.profileLinkUrl = undefined;
      currentMain.profileLinkLabel = undefined;
      currentMain.updatedAt = now;
    }
    ensureApprovedStreamerDashboardAccess(target);
    this.persistStreamerRiotIdState();
    return { ok: true, request: cloneStreamerRiotIdRequest(target) };
  }

  deleteStreamerRiotIdRequest(input: { twitchUserId: string; requestId: string }):
    | { ok: true; request: StreamerRiotIdRequest }
    | { ok: false; code: "not_found" | "cannot_delete_main" | "cannot_delete_rejected" } {
    this.assertPersistenceAvailable("streamer_riot_ids");
    const index = this.streamerRiotIdRequests.findIndex((candidate) =>
      candidate.id === input.requestId && candidate.twitchUserId === input.twitchUserId
    );
    if (index < 0) return { ok: false, code: "not_found" };
    const target = this.streamerRiotIdRequests[index]!;
    /* 대표 계정 삭제는 대시보드 접근·게임 모니터의 기준을 없애므로 금지합니다.
       먼저 다른 계정을 대표로 지정한 뒤 삭제해야 합니다. */
    if (target.status === "approved" && !isSubStreamerRiotAccount(target)) {
      return { ok: false, code: "cannot_delete_main" };
    }
    /* rejected 서브 row는 관리자 사후 차단의 tombstone입니다. 사용자가 이를
       지우고 같은 Riot ID를 자동 승인으로 재등록하지 못하게 보존합니다. */
    if (target.status === "rejected" && isSubStreamerRiotAccount(target)) {
      return { ok: false, code: "cannot_delete_rejected" };
    }
    this.streamerRiotIdRequests.splice(index, 1);
    this.persistStreamerRiotIdState();
    return { ok: true, request: cloneStreamerRiotIdRequest(target) };
  }

  getParticipationQueue(streamerId?: string): ParticipationEntry[] {
    return this.participationQueueFor(streamerId).map(cloneParticipationEntry);
  }

  setParticipationStreamerProfile(profile: ParticipationStreamerProfile | undefined, streamerId?: string): ParticipationStreamerProfile | undefined {
    this.assertPersistenceAvailable("runtime");
    if (streamerId) {
      const runtime = this.scopedParticipationRuntime(streamerId);
      if (!runtime) return undefined;
      runtime.streamerProfile = cloneParticipationStreamerProfile(profile);
    } else {
      this.participationStreamerProfile = cloneParticipationStreamerProfile(profile);
    }
    this.persistRuntimeState();
    return this.getParticipationStreamerProfile(streamerId);
  }

  getParticipationStreamerProfile(streamerId?: string): ParticipationStreamerProfile | undefined {
    this.assertPersistenceAvailable("runtime");
    const profile = streamerId
      ? this.scopedParticipationRuntime(streamerId, false)?.streamerProfile
      : this.participationStreamerProfile;
    return cloneParticipationStreamerProfile(profile);
  }

  getActiveParticipationQueue(streamerId?: string): ParticipationEntry[] {
    return this.participationQueueFor(streamerId).filter((entry) => isActiveParticipationStatus(entry.status));
  }

  getWaitingParticipationQueue(streamerId?: string): ParticipationEntry[] {
    return this.participationQueueFor(streamerId).filter((entry) => isWaitingParticipationStatus(entry.status));
  }

  getParticipationPublicQueue(limit = PARTICIPATION_PUBLIC_VISIBLE_LIMIT, streamerId?: string): ParticipationPublicQueueEntry[] {
    return this.getWaitingParticipationQueue(streamerId)
      .slice(0, Math.max(0, Math.trunc(limit)))
      .map((entry, index) => toPublicQueueEntry(entry, index + 1));
  }

  getParticipationPublicSnapshotQueue(limit = PARTICIPATION_PUBLIC_VISIBLE_LIMIT, streamerId?: string): ParticipationPublicQueueEntry[] {
    return this.participationQueueFor(streamerId)
      .filter((entry) => entry.status === "pending" || isWaitingParticipationStatus(entry.status))
      .slice(0, Math.max(0, Math.trunc(limit)))
      .map((entry, index) => toPublicQueueEntry(entry, index + 1));
  }

  getNextWaitingParticipationPublicEntry(streamerId?: string): ParticipationPublicQueueEntry | undefined {
    const entry = this.getWaitingParticipationQueue(streamerId)[0];
    return entry ? toPublicQueueEntry(entry, 1) : undefined;
  }

  getParticipationState(streamerId?: string): ParticipationState {
    const queue = this.participationQueueFor(streamerId);
    const activeQueue = this.getActiveParticipationQueue(streamerId);
    return {
      streamerId,
      revision: this.getParticipationRevision(streamerId),
      session: streamerId ? cloneParticipationSession(this.scopedParticipationRuntime(streamerId, false)?.session) : undefined,
      isOpen: this.participationOpenFor(streamerId),
      queue: queue.map((entry, index) => toDashboardQueueEntry(entry, index + 1)),
      activeQueue: activeQueue.map((entry, index) => toDashboardQueueEntry(entry, index + 1)),
      summary: {
        total: queue.length,
        active: activeQueue.length,
        waiting: this.getWaitingParticipationQueue(streamerId).length,
        selected: queue.filter((entry) => entry.status === "selected").length,
        checkedIn: queue.filter((entry) => entry.status === "checked_in").length,
        noShow: queue.filter((entry) => entry.status === "no_show").length,
        played: queue.filter((entry) => entry.status === "played").length
      }
    };
  }

  getParticipationRevision(streamerId?: string): number {
    this.assertPersistenceAvailable("runtime");
    if (!streamerId) return this.participationRevision;
    return this.scopedParticipationRuntime(streamerId, false)?.revision ?? 0;
  }

  advanceParticipationRevision(streamerId?: string): number {
    this.assertPersistenceAvailable("runtime");
    if (!streamerId) {
      this.participationRevision += 1;
      this.persistRuntimeState();
      return this.participationRevision;
    }
    const runtime = this.scopedParticipationRuntime(streamerId);
    if (!runtime) return 0;
    runtime.revision += 1;
    this.persistRuntimeState();
    return runtime.revision;
  }

  getActiveParticipationCount(streamerId?: string): number {
    return this.getActiveParticipationQueue(streamerId).length;
  }

  getParticipationEntryById(id: string, streamerId?: string): ParticipationEntry | undefined {
    const entry = this.participationQueueFor(streamerId).find((candidate) => candidate.id === id);
    return entry ? cloneParticipationEntry(entry) : undefined;
  }

  findReusableParticipationProfile(input: {
    riotGameName: string;
    riotTagLine: string;
    riotPuuid?: string;
  }, streamerId?: string): ParticipationEntry | undefined {
    const riotIdKey = normalizeRiotIdKey(input.riotGameName, input.riotTagLine);
    const reusable = this.participationQueueFor(streamerId)
      .filter((candidate) => {
        if (candidate.game === "palworld") return false;
        if (isActiveParticipationStatus(candidate.status)) return false;
        if (!candidate.profileStatus && !candidate.rankedStats && !candidate.topChampions?.length) return false;
        if (input.riotPuuid && candidate.riotPuuid && candidate.riotPuuid === input.riotPuuid) return true;
        return riotIdKeyOrUndefined(candidate.riotGameName, candidate.riotTagLine) === riotIdKey;
      })
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
    return reusable ? cloneParticipationEntry(reusable) : undefined;
  }

  findParticipationDuplicate(input: {
    twitchUserId: string;
    riotGameName?: string;
    riotTagLine?: string;
    riotPuuid?: string;
    excludeEntryId?: string;
  }, streamerId?: string): ParticipationDuplicate | undefined {
    const riotIdKey = riotIdKeyOrUndefined(input.riotGameName, input.riotTagLine);
    return this.getActiveParticipationQueue(streamerId).reduce<ParticipationDuplicate | undefined>((found, candidate) => {
      if (found) return found;
      if (candidate.id === input.excludeEntryId) return undefined;
      if (candidate.twitchUserId === input.twitchUserId) return { reason: "twitch_user", entry: candidate };
      if (input.riotPuuid && candidate.riotPuuid && candidate.riotPuuid === input.riotPuuid) return { reason: "riot_id", entry: candidate };
      if (riotIdKey && riotIdKeyOrUndefined(candidate.riotGameName, candidate.riotTagLine) === riotIdKey) {
        return { reason: "riot_id", entry: candidate };
      }
      return undefined;
    }, undefined);
  }

  addParticipation(entry: ParticipationEntry, streamerId?: string): ParticipationEntry {
    const queue = this.participationQueueFor(streamerId);
    const ownedEntry = this.ownedParticipationEntry(entry, streamerId);
    queue.push(ownedEntry);
    this.persistRuntimeState();
    return cloneParticipationEntry(ownedEntry);
  }

  reactivateReusableParticipation(entry: ParticipationEntry, streamerId?: string): { entry: ParticipationEntry; reused: boolean } {
    const queue = this.participationQueueFor(streamerId);
    const ownedEntry = this.ownedParticipationEntry(entry, streamerId);
    const reusable = queue
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => candidate.twitchUserId === entry.twitchUserId && !isActiveParticipationStatus(candidate.status))
      .sort((a, b) => Date.parse(b.candidate.updatedAt) - Date.parse(a.candidate.updatedAt))[0];

    if (!reusable) {
      queue.push(ownedEntry);
      this.persistRuntimeState();
      return { entry: cloneParticipationEntry(ownedEntry), reused: false };
    }

    const previous = reusable.candidate;
    const requeuedAt = nowIso();
    const previousRiotIdKey = riotIdKeyOrUndefined(previous.riotGameName, previous.riotTagLine);
    const sameRiotIdentity = Boolean(entry.riotPuuid && previous.riotPuuid && entry.riotPuuid === previous.riotPuuid)
      || (previousRiotIdKey !== undefined && previousRiotIdKey === riotIdKeyOrUndefined(entry.riotGameName, entry.riotTagLine));
    const profileFallback = sameRiotIdentity ? previous : undefined;
    const reactivated: ParticipationEntry = {
      ...previous,
      ...ownedEntry,
      id: previous.id,
      createdAt: previous.createdAt,
      attemptNumber: Math.max(1, previous.attemptNumber ?? 1) + 1,
      lastRequeuedAt: requeuedAt,
      riotPuuid: ownedEntry.riotPuuid ?? profileFallback?.riotPuuid,
      verifiedRank: ownedEntry.verifiedRank ?? profileFallback?.verifiedRank,
      rankedStats: ownedEntry.rankedStats ?? profileFallback?.rankedStats,
      profileStatus: ownedEntry.profileStatus ?? profileFallback?.profileStatus,
      profileFailureReason: ownedEntry.profileFailureReason ?? profileFallback?.profileFailureReason,
      mainRole: ownedEntry.mainRole ?? profileFallback?.mainRole,
      mainRoleConfidence: ownedEntry.mainRoleConfidence ?? profileFallback?.mainRoleConfidence,
      topChampions: ownedEntry.topChampions ?? profileFallback?.topChampions,
      profileAnalyzedAt: ownedEntry.profileAnalyzedAt ?? profileFallback?.profileAnalyzedAt,
      selectedAt: undefined,
      checkInExpiresAt: undefined,
      playedAt: undefined,
      updatedAt: requeuedAt
    };
    queue.splice(reusable.index, 1);
    queue.push(reactivated);
    this.persistRuntimeState();
    return { entry: reactivated, reused: true };
  }

  addOrUpdateParticipation(entry: ParticipationEntry, streamerId?: string): ParticipationEntry {
    const queue = this.participationQueueFor(streamerId);
    const ownedEntry = this.ownedParticipationEntry(entry, streamerId);
    const ownedRiotIdKey = riotIdKeyOrUndefined(ownedEntry.riotGameName, ownedEntry.riotTagLine);
    const existingIndex = queue.findIndex(
      (candidate) =>
        candidate.twitchUserId === ownedEntry.twitchUserId ||
        (ownedRiotIdKey !== undefined && riotIdKeyOrUndefined(candidate.riotGameName, candidate.riotTagLine) === ownedRiotIdKey) ||
        Boolean(ownedEntry.riotPuuid && candidate.riotPuuid === ownedEntry.riotPuuid)
    );
    if (existingIndex >= 0) {
      const previous = queue[existingIndex]!;
      const next = { ...previous, ...ownedEntry, id: previous.id, updatedAt: nowIso() };
      queue[existingIndex] = next;
      this.persistRuntimeState();
      return next;
    }
    queue.push(ownedEntry);
    this.persistRuntimeState();
    return cloneParticipationEntry(ownedEntry);
  }

  setParticipationOpen(open: boolean, streamerId?: string): void {
    this.assertPersistenceAvailable("runtime");
    if (streamerId) {
      const runtime = this.scopedParticipationRuntime(streamerId);
      if (!runtime) return;
      if (open && runtime.session?.status === "completed") return;
      runtime.isOpen = open;
      if (open && !runtime.session) {
        const timestamp = nowIso();
        const sessionId = newId("partsession");
        runtime.session = {
          streamerId,
          sessionId,
          publicSessionId: publicParticipationSessionIdFromInternal(sessionId),
          game: "lol",
          status: "recruiting",
          listingVisibility: "public",
          maxQueueSize: 100,
          allowRejoin: true,
          checkInSeconds: 60,
          createdAt: timestamp,
          updatedAt: timestamp
        };
      } else if (runtime.session) {
        runtime.session.status = open ? "recruiting" : "closed";
        runtime.session.updatedAt = nowIso();
        runtime.session.endedAt = open ? undefined : nowIso();
      }
    } else {
      this.patchStatus({ participation: open ? "open" : "closed" });
    }
    this.persistRuntimeState();
  }

  getLolAutomationSettings(streamerId: string): LolAutomationSettings {
    this.assertPersistenceAvailable("runtime");
    const normalizedStreamerId = streamerId.trim();
    return {
      ...normalizedLolAutomationSettings(this.lolAutomationByStreamer.get(normalizedStreamerId), normalizedStreamerId)
    };
  }

  listLolAutomationSettings(): LolAutomationSettings[] {
    this.assertPersistenceAvailable("runtime");
    return [...this.lolAutomationByStreamer.keys()]
      .map((streamerId) => this.getLolAutomationSettings(streamerId));
  }

  setLolAutomationSettings(
    streamerId: string,
    patch: Partial<Omit<LolAutomationSettings, "streamerId" | "updatedAt">>
  ): LolAutomationSettings {
    const normalizedStreamerId = streamerId.trim();
    if (!normalizedStreamerId) throw new Error("스트리머 식별자가 필요합니다.");
    const current = this.getLolAutomationSettings(normalizedStreamerId);
    const next = normalizedLolAutomationSettings({
      ...current,
      ...patch,
      updatedAt: nowIso()
    }, normalizedStreamerId);
    this.lolAutomationByStreamer.set(normalizedStreamerId, next);
    this.persistRuntimeState();
    return { ...next };
  }

  getParticipationSession(streamerId: string): ParticipationSession | undefined {
    return cloneParticipationSession(this.scopedParticipationRuntime(streamerId, false)?.session);
  }

  getParticipationSessionByPublicId(publicSessionId: string): ParticipationSession | undefined {
    const normalized = publicSessionId.trim();
    if (!/^ps_[A-Za-z0-9_-]{32}$/u.test(normalized)) return undefined;
    return this.listParticipationSessions().find((session) => session.publicSessionId === normalized);
  }

  listParticipationSessions(): ParticipationSession[] {
    this.assertPersistenceAvailable("runtime");
    return [...this.participationByStreamer.values()]
      .map((runtime) => cloneParticipationSession(runtime.session))
      .filter((session): session is ParticipationSession => Boolean(session));
  }

  startParticipationSession(
    streamerId: string,
    profileSnapshot?: StreamerProfileSnapshot,
    options: {
      game?: ParticipationGame;
      maxQueueSize?: number;
      allowRejoin?: boolean;
      checkInSeconds?: number;
      listingVisibility?: ParticipationListingVisibility;
    } = {}
  ): ParticipationSession {
    const normalizedStreamerId = streamerId.trim();
    if (!normalizedStreamerId) throw new Error("스트리머 식별자가 필요합니다.");
    const runtime = this.scopedParticipationRuntime(normalizedStreamerId);
    if (!runtime) throw new Error("시참 세션을 생성할 수 없습니다.");
    const timestamp = nowIso();
    const snapshot = profileSnapshot ? {
      ...profileSnapshot,
      profile: cloneParticipationStreamerProfile(profileSnapshot.profile)
    } : undefined;
    const sessionId = newId("partsession");
    runtime.session = {
      streamerId: normalizedStreamerId,
      sessionId,
      publicSessionId: publicParticipationSessionIdFromInternal(sessionId),
      game: normalizeParticipationGame(options.game),
      status: "recruiting",
      listingVisibility: options.listingVisibility === "followers" ? "followers" : "public",
      maxQueueSize: Math.max(1, Math.trunc(options.maxQueueSize ?? 100)),
      allowRejoin: options.allowRejoin !== false,
      checkInSeconds: Math.max(1, Math.trunc(options.checkInSeconds ?? 60)),
      profileSnapshot: snapshot,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    runtime.isOpen = true;
    this.persistRuntimeState();
    return cloneParticipationSession(runtime.session)!;
  }

  updateParticipationSessionStatus(
    streamerId: string,
    status: ParticipationSession["status"]
  ): ParticipationSession | undefined {
    const runtime = this.scopedParticipationRuntime(streamerId, false);
    if (!runtime?.session) return undefined;
    if (runtime.session.status === "completed" && status !== "completed") {
      return cloneParticipationSession(runtime.session);
    }
    runtime.session.status = status;
    runtime.session.updatedAt = nowIso();
    if (status === "recruiting") {
      runtime.isOpen = true;
      runtime.session.endedAt = undefined;
    }
    if (status === "closed" || status === "completed") {
      runtime.isOpen = false;
      runtime.session.endedAt = nowIso();
    }
    this.persistRuntimeState();
    return cloneParticipationSession(runtime.session);
  }

  endParticipationSession(streamerId: string): ParticipationSession | undefined {
    return this.updateParticipationSessionStatus(streamerId, "completed");
  }

  selectNextParticipant(checkInSeconds: number, streamerId?: string): ParticipationEntry | undefined {
    if (this.getPendingSelectedParticipant(new Date(), streamerId)) return undefined;
    const next = this.participationQueueFor(streamerId).find((entry) => entry.status === "waitlisted" || entry.status === "verified");
    if (!next) return undefined;
    next.status = "selected";
    next.selectedAt = nowIso();
    next.checkInExpiresAt = new Date(Date.now() + checkInSeconds * 1000).toISOString();
    next.updatedAt = nowIso();
    this.persistRuntimeState();
    return next;
  }

  selectParticipant(entryId: string, checkInSeconds: number, streamerId?: string): ParticipationEntry | undefined {
    return this.selectParticipants([entryId], checkInSeconds, streamerId)?.[0];
  }

  selectParticipants(entryIds: readonly string[], checkInSeconds: number, streamerId?: string): ParticipationEntry[] | undefined {
    const queue = this.participationQueueFor(streamerId);
    if (queue.some((entry) => ["selected", "checked_in", "invited", "in_game"].includes(entry.status))) {
      return undefined;
    }
    const uniqueIds = Array.from(new Set(entryIds));
    if (uniqueIds.length === 0) return undefined;
    const entries: ParticipationEntry[] = [];
    for (const entryId of uniqueIds) {
      const entry = queue.find((candidate) => (
        candidate.id === entryId
        && (candidate.status === "waitlisted" || candidate.status === "verified")
      ));
      if (!entry) return undefined;
      entries.push(entry);
    }
    const selectedAt = nowIso();
    const checkInExpiresAt = new Date(Date.now() + checkInSeconds * 1000).toISOString();
    for (const entry of entries) {
      entry.status = "selected";
      entry.selectedAt = selectedAt;
      entry.checkInExpiresAt = checkInExpiresAt;
      entry.updatedAt = selectedAt;
    }
    this.persistRuntimeState();
    return entries;
  }

  getPendingSelectedParticipant(now = new Date(), streamerId?: string): ParticipationEntry | undefined {
    return this.participationQueueFor(streamerId).find((entry) => entry.status === "selected" && !isCheckInExpired(entry, now));
  }

  markParticipantNoShow(id: string, note?: string, streamerId?: string): ParticipationEntry | undefined {
    const entry = this.participationQueueFor(streamerId).find((candidate) => candidate.id === id);
    if (!entry) return undefined;
    entry.status = "no_show";
    entry.updatedAt = nowIso();
    if (note) entry.notes = entry.notes ? `${entry.notes}\n${note}` : note;
    this.persistRuntimeState();
    return entry;
  }

  markExpiredSelectedNoShows(now = new Date(), streamerId?: string): ParticipationEntry[] {
    const expired: ParticipationEntry[] = [];
    for (const entry of this.participationQueueFor(streamerId)) {
      if (entry.status !== "selected" || !isCheckInExpired(entry, now)) continue;
      const marked = this.markParticipantNoShow(entry.id, "참가 확인 시간이 만료되었습니다.", streamerId);
      if (marked) expired.push(marked);
    }
    return expired;
  }

  checkInSelectedParticipant(twitchUserId: string, now = new Date(), streamerId?: string): ParticipationCheckInResult {
    const entry = this.participationQueueFor(streamerId).find((candidate) => candidate.twitchUserId === twitchUserId && candidate.status === "selected");
    if (!entry) return { ok: false, reason: "missing" };
    if (isCheckInExpired(entry, now)) {
      const marked = this.markParticipantNoShow(entry.id, "만료 후 참가 확인을 시도했습니다.", streamerId);
      return { ok: false, reason: "expired", entry: marked ?? entry };
    }
    entry.status = "checked_in";
    entry.updatedAt = nowIso();
    this.persistRuntimeState();
    return { ok: true, entry };
  }

  checkInParticipant(twitchUserId: string, streamerId?: string): ParticipationEntry | undefined {
    const result = this.checkInSelectedParticipant(twitchUserId, new Date(), streamerId);
    if (!result.ok) return undefined;
    return result.entry;
  }

  cancelParticipationByUser(twitchUserId: string, note?: string, streamerId?: string): ParticipationCancelResult {
    const entry = this.participationQueueFor(streamerId).find((candidate) => candidate.twitchUserId === twitchUserId && isActiveParticipationStatus(candidate.status));
    if (!entry) return { ok: false, reason: "missing" };
    if (!CANCELLABLE_PARTICIPATION_STATUSES.has(entry.status)) return { ok: false, reason: "in_game" };
    entry.status = "cancelled";
    entry.checkInExpiresAt = undefined;
    entry.updatedAt = nowIso();
    if (note) entry.notes = entry.notes ? `${entry.notes}\n${note}` : note;
    this.persistRuntimeState();
    return { ok: true, entry };
  }

  skipSelectedParticipationByUser(twitchUserId: string, note?: string, streamerId?: string): ParticipationSkipResult {
    const entry = this.participationQueueFor(streamerId).find((candidate) => (
      candidate.twitchUserId === twitchUserId && isActiveParticipationStatus(candidate.status)
    ));
    if (!entry) return { ok: false, reason: "missing" };
    if (entry.status !== "selected") return { ok: false, reason: "not_selected" };
    entry.status = "skipped";
    entry.selectedAt = undefined;
    entry.checkInExpiresAt = undefined;
    entry.updatedAt = nowIso();
    if (note) entry.notes = entry.notes ? `${entry.notes}\n${note}` : note;
    this.persistRuntimeState();
    return { ok: true, entry };
  }

  markParticipant(id: string, status: ParticipationEntry["status"], streamerId?: string): ParticipationEntry | undefined {
    const entry = this.participationQueueFor(streamerId).find((candidate) => candidate.id === id);
    if (!entry) return undefined;
    entry.status = status;
    entry.updatedAt = nowIso();
    if (status === "selected") {
      entry.selectedAt = entry.selectedAt ?? nowIso();
    } else {
      entry.selectedAt = undefined;
      entry.checkInExpiresAt = undefined;
    }
    if (status === "played") {
      entry.playedAt = nowIso();
    } else {
      entry.playedAt = undefined;
    }
    this.persistRuntimeState();
    return entry;
  }

  markReadyParticipantsInGame(streamerId?: string): ParticipationEntry[] {
    const entries: ParticipationEntry[] = [];
    for (const entry of this.participationQueueFor(streamerId)) {
      if (!["selected", "checked_in", "invited"].includes(entry.status)) continue;
      entry.status = "in_game";
      entry.checkInExpiresAt = undefined;
      entry.updatedAt = nowIso();
      entries.push(entry);
    }
    if (entries.length > 0) this.persistRuntimeState();
    return entries;
  }

  markVisibleParticipationQueueInGame(
    input: number | { limit?: number; participantPuuids?: Iterable<string | undefined> } = PARTICIPATION_PUBLIC_VISIBLE_LIMIT,
    streamerId?: string
  ): ParticipationEntry[] {
    const entries: ParticipationEntry[] = [];
    const seenIds = new Set<string>();
    const limit = typeof input === "number" ? input : input.limit ?? PARTICIPATION_PUBLIC_VISIBLE_LIMIT;
    const participantPuuids = typeof input === "number"
      ? undefined
      : new Set(Array.from(input.participantPuuids ?? []).filter((puuid): puuid is string => typeof puuid === "string" && puuid.length > 0));
    const markInGame = (entry: ParticipationEntry): void => {
      if (seenIds.has(entry.id)) return;
      seenIds.add(entry.id);
      entry.status = "in_game";
      entry.checkInExpiresAt = undefined;
      entry.updatedAt = nowIso();
      entries.push(entry);
    };

    for (const entry of this.participationQueueFor(streamerId)) {
      if (!["selected", "checked_in", "invited"].includes(entry.status)) continue;
      markInGame(entry);
    }

    if (participantPuuids && participantPuuids.size > 0) {
      for (const entry of this.getWaitingParticipationQueue(streamerId)) {
        if (!entry.riotPuuid || !participantPuuids.has(entry.riotPuuid)) continue;
        markInGame(entry);
      }
      if (entries.length > 0) this.persistRuntimeState();
      return entries;
    }

    const maxWaiting = Math.max(0, Math.trunc(limit));
    for (const entry of this.getWaitingParticipationQueue(streamerId).slice(0, maxWaiting)) {
      markInGame(entry);
    }

    if (entries.length > 0) this.persistRuntimeState();
    return entries;
  }

  markInGameParticipantsPlayed(streamerId?: string): ParticipationEntry[] {
    const entries: ParticipationEntry[] = [];
    for (const entry of this.participationQueueFor(streamerId)) {
      if (entry.status !== "in_game") continue;
      entry.status = "played";
      entry.playedAt = nowIso();
      entry.updatedAt = nowIso();
      entries.push(entry);
    }
    if (entries.length > 0) this.persistRuntimeState();
    return entries;
  }

  patchParticipationProfile(id: string, patch: Pick<
    Partial<ParticipationEntry>,
    "profileStatus" | "profileFailureReason" | "mainRole" | "mainRoleConfidence" | "topChampions" | "rankedStats" | "verifiedRank" | "profileAnalyzedAt" | "riotPuuid"
  >, streamerId?: string): ParticipationEntry | undefined {
    const entry = this.participationQueueFor(streamerId).find((candidate) => candidate.id === id);
    if (!entry) return undefined;
    Object.assign(entry, {
      ...patch,
      topChampions: cloneParticipationTopChampions(patch.topChampions),
      updatedAt: nowIso()
    });
    this.persistRuntimeState();
    return cloneParticipationEntry(entry);
  }

  setParticipationRequestedRole(id: string, role: ParticipationEntry["preferredRole"], streamerId?: string): ParticipationEntry | undefined {
    const entry = this.participationQueueFor(streamerId).find((candidate) => candidate.id === id);
    if (!entry) return undefined;
    entry.requestedRole = role;
    entry.preferredRole = role;
    entry.updatedAt = nowIso();
    this.persistRuntimeState();
    return cloneParticipationEntry(entry);
  }

  makeParticipationEntry(input: Omit<ParticipationEntry, "id" | "createdAt" | "updatedAt">): ParticipationEntry {
    return {
      id: newId("part"),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...input,
      attemptNumber: Math.max(1, input.attemptNumber ?? 1)
    };
  }
}
