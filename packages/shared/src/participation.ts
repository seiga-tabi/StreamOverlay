export type ParticipationGame = "lol" | "palworld";

export const PARTICIPATION_GAMES = ["lol", "palworld"] as const satisfies readonly ParticipationGame[];

/**
 * 게임별 진행 인원 정원(방송인 포함). LoL은 5인 커스텀 기준(방송인 1 + 시청자 4),
 * Palworld는 서버 정원 기준입니다. 세션을 시작한 뒤에는 이 값을 바꿀 수 없습니다 —
 * 도중에 정원이 바뀌면 이미 선정된 인원과 충돌할 수 있어서입니다.
 */
export const PARTICIPATION_GAME_CAPACITY: Record<ParticipationGame, number> = {
  lol: 5,
  palworld: 32
};

export function normalizeParticipationGame(value: unknown): ParticipationGame {
  return value === "palworld" ? "palworld" : "lol";
}

export type LolRole = "top" | "jungle" | "mid" | "adc" | "support" | "fill" | "unknown";

export type LolMainRole = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | "FILL" | "UNKNOWN";

export type LolProfileStatus = "pending" | "analyzing" | "ready" | "failed" | "rate_limited";

export type RiotIdParseErrorCode = "empty" | "missing_tag" | "invalid_game_name" | "invalid_tag_line" | "too_long" | "unsafe_characters";

export type RiotIdParseResult =
  | { ok: true; gameName: string; tagLine: string }
  | { ok: false; code: RiotIdParseErrorCode; message: string };

export type LolRankTier =
  | "IRON"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "EMERALD"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER"
  | "UNRANKED";

export type LolRankedStats = {
  queueType: "RANKED_SOLO_5x5" | "RANKED_FLEX_SR" | "RANKED_TEAM_5x5" | "UNRANKED";
  tier: LolRankTier;
  rank?: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  winRate: number;
  summonerLevel?: number;
  profileIconId?: number;
  tierIconUrl?: string;
  fetchedAt: string;
};

export type LolPerformanceStats = {
  sampleSize: number;
  averageKills: number;
  averageDeaths: number;
  averageAssists: number;
  kda: number;
};

export type LolRankHistoryPoint = {
  date: string;
  tier: LolRankTier;
  rank?: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  rankScore: number;
};

export type LolChampionSummary = {
  championId: number;
  championKey?: string;
  nameKo: string;
  nameJa?: string;
  nameEn?: string;
  iconUrl?: string;
  splashUrl?: string;
  loadingUrl?: string;
  imageVersion?: string;
  imageLocale?: "neutral";
  skinNum?: number;
  skinNameKo?: string;
  skinNameJa?: string;
  skinNameEn?: string;
  masteryLevel?: number;
  masteryPoints?: number;
  games?: number;
};

export type LolChampionSkinOption = {
  skinNum: number;
  nameKo: string;
  nameJa?: string;
  nameEn?: string;
  splashUrl: string;
  loadingUrl: string;
};

export type LolRecentMatchChampion = {
  championId: number;
  championKey?: string;
  nameKo: string;
  nameJa?: string;
  nameEn?: string;
  iconUrl?: string;
  splashUrl?: string;
  loadingUrl?: string;
  imageVersion?: string;
  imageLocale?: "neutral";
  /** Riot match의 실제 시작 시각. 이전 cache row에는 없을 수 있습니다. */
  startedAt?: string;
  won: boolean;
};

export type LolRoleAnalysis = {
  mainRole: LolMainRole;
  confidence: number;
  sampleSize: number;
};

export type LolProfileSummary = {
  status: LolProfileStatus;
  mainRole?: LolMainRole;
  mainRoleConfidence?: number;
  topChampions?: LolChampionSummary[];
  rankedStats?: LolRankedStats;
  performanceStats?: LolPerformanceStats;
  recentMatches?: LolRecentMatchChampion[];
  analyzedAt?: string;
};

export type ParticipationStatus =
  | "pending"
  | "verified"
  | "waitlisted"
  | "selected"
  | "checked_in"
  | "invited"
  | "in_game"
  | "played"
  | "skipped"
  | "cancelled"
  | "no_show"
  | "rejected"
  | "blocked";

export type ParticipationJoinSource = "public_web" | "discord_announcement" | "twitch_chat" | "twitch_extension" | "dashboard";

export type ParticipationEntry = {
  id: string;
  streamerId?: string;
  sessionId?: string;
  /** 기본값 "lol" — 이 필드가 없는 기존 저장 데이터는 전부 LoL 참가자였습니다. */
  game?: ParticipationGame;
  twitchUserId: string;
  twitchUserName: string;
  /** LoL 참가자만 채웁니다. Palworld 참가자는 대신 palworldNickname을 씁니다. */
  riotGameName?: string;
  riotTagLine?: string;
  riotPuuid?: string;
  /** Palworld 참가자의 자기 신고 닉네임. 검증하지 않고 그대로 대기열에 등록합니다. */
  palworldNickname?: string;
  requestedRole?: LolRole;
  preferredRole?: LolRole;
  secondaryRole?: LolRole;
  declaredRank?: string;
  verifiedRank?: string;
  rankedStats?: LolRankedStats;
  profileStatus?: LolProfileStatus;
  profileFailureReason?: string;
  mainRole?: LolMainRole;
  mainRoleConfidence?: number;
  topChampions?: LolChampionSummary[];
  profileAnalyzedAt?: string;
  status: ParticipationStatus;
  source: "chat_command" | "channel_point" | "dashboard";
  joinedFrom?: ParticipationJoinSource;
  attemptNumber?: number;
  lastRequeuedAt?: string;
  redemptionId?: string;
  checkInExpiresAt?: string;
  selectedAt?: string;
  playedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ParticipationMode = "normal5" | "custom5v5" | "aram" | "onevone";

export type ParticipationPhase = "recruiting" | "closed" | "in_game" | "game_ended";

export type ParticipationSettings = {
  enabled: boolean;
  openByDefault: boolean;
  mode: ParticipationMode;
  requiredPlayers: number;
  checkInSeconds: number;
  maxQueueSize: number;
};

export type LolGameMonitorSettings = {
  enabled: boolean;
  streamerRiotId: string;
  pollIntervalMs: number;
  gameEndDebounceMs: number;
  autoSelectNextAfterGame: boolean;
  announceInChat: boolean;
};

export type StreamerRiotIdentity = {
  twitchUserId: string;
  riotGameName: string;
  riotTagLine: string;
  normalizedRiotId: string;
  approvalStatus: StreamerRiotIdRequestStatus;
  profileStatus?: LolProfileStatus;
  updatedAt: string;
};

/**
 * 봇 명령어(!join 등)는 언어 인식 없이 영어 고정입니다 — 트리거를 여러 언어로
 * 인식시키는 건 유지비가 커서 포기하고, 대신 봇이 채팅에 보내는 답변만 이
 * 값으로 언어를 고정합니다("auto"는 없습니다 — 스트리머가 한 번 직접 고릅니다).
 */
export type ParticipationChatLocale = "ko" | "ja" | "en";

export const PARTICIPATION_CHAT_LOCALES = ["ko", "ja", "en"] as const satisfies readonly ParticipationChatLocale[];

export function normalizeParticipationChatLocale(value: unknown): ParticipationChatLocale {
  return value === "ja" || value === "en" ? value : "ko";
}

export type LolAutomationSettings = {
  streamerId: string;
  enabled: boolean;
  autoSelectNextAfterGame: boolean;
  announceInChat: boolean;
  chatLocale: ParticipationChatLocale;
  pollIntervalMs: number;
  gameEndDebounceMs: number;
  updatedAt: string;
};

export type ParticipationSessionStatus = "closed" | "recruiting" | "in_game" | "completed";

export type ParticipationListingVisibility = "public" | "followers";

export type StreamerProfileSnapshot = {
  riotGameName: string;
  riotTagLine: string;
  normalizedRiotId: string;
  profile?: ParticipationStreamerProfile;
  capturedAt: string;
};

export type ParticipationSession = {
  streamerId: string;
  sessionId: string;
  publicSessionId: string;
  /** 세션 시작 시 확정되고 이후 바뀌지 않습니다. 기본값 "lol" — 이 필드가 없는
   *  기존 저장 데이터는 전부 LoL 세션이었습니다. */
  game: ParticipationGame;
  status: ParticipationSessionStatus;
  listingVisibility: ParticipationListingVisibility;
  maxQueueSize?: number;
  allowRejoin?: boolean;
  checkInSeconds?: number;
  profileSnapshot?: StreamerProfileSnapshot;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
};

export type ParticipationPublicQueueEntry = {
  position: number;
  twitchUserName: string;
  game?: ParticipationGame;
  palworldNickname?: string;
  preferredRole?: LolRole;
  status: ParticipationStatus;
  requestedRole?: LolRole;
  profileStatus?: LolProfileStatus;
  mainRole?: LolMainRole;
  mainRoleConfidence?: number;
  topChampions?: LolChampionSummary[];
  rankedStats?: LolRankedStats;
};

export type ParticipationStreamerProfile = {
  displayName?: string;
  riotTagLine?: string;
  profileStatus?: LolProfileStatus;
  mainRole?: LolMainRole;
  mainRoleConfidence?: number;
  ladderRank?: number;
  topChampions?: LolChampionSummary[];
  rankedStats?: LolRankedStats;
  performanceStats?: LolPerformanceStats;
  recentMatches?: LolRecentMatchChampion[];
  rankHistory?: LolRankHistoryPoint[];
};

export type StreamerRiotIdRequestStatus = "pending" | "approved" | "rejected";

/**
 * 스트리머 Riot 계정의 역할.
 * - "main": 스트리머 카드·게임 모니터·대시보드 접근 키가 따라가는 대표 계정.
 * - "sub": 같은 스트리머로 전적 검색이 연결되는 부계정.
 * 이 필드가 없는 기존 row는 main으로 취급합니다(단일 계정 시절 데이터).
 */
export type StreamerRiotAccountRole = "main" | "sub";

/** 스트리머 1명이 등록할 수 있는 활성 서브 계정(rejected 제외) 상한. */
export const STREAMER_SUB_RIOT_ACCOUNT_LIMIT = 4;

export type StreamerProfileLink = {
  id: string;
  url: string;
  label: string;
  platform?: string;
};

export type StreamerRiotIdRequest = {
  id: string;
  twitchUserId: string;
  twitchLogin: string;
  twitchDisplayName: string;
  twitchProfileImageUrl?: string;
  riotGameName: string;
  riotTagLine: string;
  normalizedRiotId: string;
  dashboardSlug?: string;
  dashboardKey?: string;
  profileLinkUrl?: string;
  profileLinkLabel?: string;
  profileLinks?: StreamerProfileLink[];
  status: StreamerRiotIdRequestStatus;
  accountRole?: StreamerRiotAccountRole;
  dashboardEnabled?: boolean;
  requestedAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewer?: string;
  note?: string;
};

export type StreamerRiotIdVerificationAccount = {
  /** 소유권 판단이 아니라 기존 LoL cache가 확인한 계정 실존 사실만 나타냅니다. */
  state: "exists" | "not_found" | "unknown";
  evidence: "fresh_cache" | "stale_cache" | "cache_miss";
  observedAt?: string;
};

export type StreamerRiotIdVerificationRank = Pick<
  LolRankedStats,
  "queueType" | "tier" | "rank" | "leaguePoints" | "fetchedAt"
>;

export type StreamerRiotIdVerificationSummary = {
  account: StreamerRiotIdVerificationAccount;
  rank?: StreamerRiotIdVerificationRank;
  /** cache에 실제 경기 시작 시각이 있을 때만 제공합니다. */
  lastPlayedAt?: string;
  twitchDisplayNameComparison: {
    /** NFKC·대소문자·공백만 정규화한 뒤 Riot gameName과 정확히 같은지 여부입니다. */
    normalizedExactMatch: boolean;
    method: "nfkc_lowercase_ignore_whitespace";
  };
};

/** 관리자 목록에 필요한 표시·처리 필드만 노출합니다. dashboardKey 같은 capability는 포함하지 않습니다. */
export type StreamerRiotIdRequestListItem = Pick<
  StreamerRiotIdRequest,
  | "id"
  | "twitchLogin"
  | "twitchDisplayName"
  | "twitchProfileImageUrl"
  | "riotGameName"
  | "riotTagLine"
  | "status"
  | "accountRole"
  | "dashboardEnabled"
  | "requestedAt"
  | "updatedAt"
  | "reviewedAt"
  | "note"
> & {
  verification: StreamerRiotIdVerificationSummary;
};

export type StreamerRiotIdRequestListPagination = {
  limit: number;
  total: number;
  returned: number;
  hasMore: boolean;
  nextCursor?: string;
};

export type StreamerRiotIdRequestListResponse = {
  requests: StreamerRiotIdRequestListItem[];
  /** 무인자 legacy 호출에서는 하위 호환을 위해 생략합니다. */
  pagination?: StreamerRiotIdRequestListPagination;
};

const STREAMER_RIOT_ID_LIST_STATUSES = ["pending", "approved", "rejected"] as const;
const STREAMER_RIOT_ID_LIST_ACCOUNT_ROLES = ["main", "sub"] as const;
const STREAMER_RIOT_ID_VERIFICATION_STATES = ["exists", "not_found", "unknown"] as const;
const STREAMER_RIOT_ID_VERIFICATION_EVIDENCE = ["fresh_cache", "stale_cache", "cache_miss"] as const;
const STREAMER_RIOT_ID_RANK_QUEUES = ["RANKED_SOLO_5x5", "RANKED_FLEX_SR", "RANKED_TEAM_5x5", "UNRANKED"] as const;
const STREAMER_RIOT_ID_RANK_TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
  "UNRANKED"
] as const;

function streamerRiotIdListExactRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return Object.keys(record).every((key) => allowedKeys.includes(key)) ? record : undefined;
}

function streamerRiotIdListString(value: unknown, maxLength: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maxLength
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function streamerRiotIdListIsoTimestamp(value: unknown): value is string {
  if (!streamerRiotIdListString(value, 64)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function streamerRiotIdListSafeInteger(value: unknown, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
}

function parseStreamerRiotIdVerificationRank(value: unknown): StreamerRiotIdVerificationRank | undefined {
  const record = streamerRiotIdListExactRecord(value, ["queueType", "tier", "rank", "leaguePoints", "fetchedAt"]);
  if (
    !record
    || !STREAMER_RIOT_ID_RANK_QUEUES.includes(record.queueType as typeof STREAMER_RIOT_ID_RANK_QUEUES[number])
    || !STREAMER_RIOT_ID_RANK_TIERS.includes(record.tier as typeof STREAMER_RIOT_ID_RANK_TIERS[number])
    || (record.rank !== undefined && !streamerRiotIdListString(record.rank, 16))
    || !streamerRiotIdListSafeInteger(record.leaguePoints, 100_000)
    || !streamerRiotIdListIsoTimestamp(record.fetchedAt)
  ) return undefined;
  return {
    queueType: record.queueType as StreamerRiotIdVerificationRank["queueType"],
    tier: record.tier as StreamerRiotIdVerificationRank["tier"],
    ...(record.rank !== undefined ? { rank: record.rank as string } : {}),
    leaguePoints: record.leaguePoints as number,
    fetchedAt: record.fetchedAt
  };
}

function parseStreamerRiotIdVerification(value: unknown): StreamerRiotIdVerificationSummary | undefined {
  const record = streamerRiotIdListExactRecord(value, ["account", "rank", "lastPlayedAt", "twitchDisplayNameComparison"]);
  const account = streamerRiotIdListExactRecord(record?.account, ["state", "evidence", "observedAt"]);
  const comparison = streamerRiotIdListExactRecord(record?.twitchDisplayNameComparison, ["normalizedExactMatch", "method"]);
  if (
    !record
    || !account
    || !STREAMER_RIOT_ID_VERIFICATION_STATES.includes(account.state as typeof STREAMER_RIOT_ID_VERIFICATION_STATES[number])
    || !STREAMER_RIOT_ID_VERIFICATION_EVIDENCE.includes(account.evidence as typeof STREAMER_RIOT_ID_VERIFICATION_EVIDENCE[number])
    || (account.observedAt !== undefined && !streamerRiotIdListIsoTimestamp(account.observedAt))
    || !comparison
    || typeof comparison.normalizedExactMatch !== "boolean"
    || comparison.method !== "nfkc_lowercase_ignore_whitespace"
    || (record.lastPlayedAt !== undefined && !streamerRiotIdListIsoTimestamp(record.lastPlayedAt))
  ) return undefined;
  const rank = record.rank === undefined ? undefined : parseStreamerRiotIdVerificationRank(record.rank);
  if (record.rank !== undefined && !rank) return undefined;
  return {
    account: {
      state: account.state as StreamerRiotIdVerificationAccount["state"],
      evidence: account.evidence as StreamerRiotIdVerificationAccount["evidence"],
      ...(account.observedAt !== undefined ? { observedAt: account.observedAt as string } : {})
    },
    ...(rank ? { rank } : {}),
    ...(record.lastPlayedAt !== undefined ? { lastPlayedAt: record.lastPlayedAt as string } : {}),
    twitchDisplayNameComparison: {
      normalizedExactMatch: comparison.normalizedExactMatch,
      method: "nfkc_lowercase_ignore_whitespace"
    }
  };
}

function parseStreamerRiotIdRequestListItem(value: unknown): StreamerRiotIdRequestListItem | undefined {
  const record = streamerRiotIdListExactRecord(value, [
    "id",
    "twitchLogin",
    "twitchDisplayName",
    "twitchProfileImageUrl",
    "riotGameName",
    "riotTagLine",
    "status",
    "accountRole",
    "dashboardEnabled",
    "requestedAt",
    "updatedAt",
    "reviewedAt",
    "note",
    "verification"
  ]);
  if (
    !record
    || !streamerRiotIdListString(record.id, 128)
    || !streamerRiotIdListString(record.twitchLogin, 64)
    || !streamerRiotIdListString(record.twitchDisplayName, 128)
    || (record.twitchProfileImageUrl !== undefined && !streamerRiotIdListString(record.twitchProfileImageUrl, 2_048))
    || !streamerRiotIdListString(record.riotGameName, 64)
    || !streamerRiotIdListString(record.riotTagLine, 32)
    || !STREAMER_RIOT_ID_LIST_STATUSES.includes(record.status as typeof STREAMER_RIOT_ID_LIST_STATUSES[number])
    || (record.accountRole !== undefined && !STREAMER_RIOT_ID_LIST_ACCOUNT_ROLES.includes(record.accountRole as typeof STREAMER_RIOT_ID_LIST_ACCOUNT_ROLES[number]))
    || (record.dashboardEnabled !== undefined && typeof record.dashboardEnabled !== "boolean")
    || !streamerRiotIdListIsoTimestamp(record.requestedAt)
    || !streamerRiotIdListIsoTimestamp(record.updatedAt)
    || (record.reviewedAt !== undefined && !streamerRiotIdListIsoTimestamp(record.reviewedAt))
    || (record.note !== undefined && !streamerRiotIdListString(record.note, 1_000))
  ) return undefined;
  const verification = parseStreamerRiotIdVerification(record.verification);
  if (!verification) return undefined;
  return {
    id: record.id,
    twitchLogin: record.twitchLogin,
    twitchDisplayName: record.twitchDisplayName,
    ...(record.twitchProfileImageUrl !== undefined ? { twitchProfileImageUrl: record.twitchProfileImageUrl as string } : {}),
    riotGameName: record.riotGameName,
    riotTagLine: record.riotTagLine,
    status: record.status as StreamerRiotIdRequestStatus,
    ...(record.accountRole !== undefined ? { accountRole: record.accountRole as StreamerRiotAccountRole } : {}),
    ...(record.dashboardEnabled !== undefined ? { dashboardEnabled: record.dashboardEnabled as boolean } : {}),
    requestedAt: record.requestedAt,
    updatedAt: record.updatedAt,
    ...(record.reviewedAt !== undefined ? { reviewedAt: record.reviewedAt as string } : {}),
    ...(record.note !== undefined ? { note: record.note as string } : {}),
    verification
  };
}

/** 관리자 Riot ID 요청 목록을 capability 누출 없는 exact·bounded schema로 검증합니다. */
export function parseStreamerRiotIdRequestListResponse(value: unknown): StreamerRiotIdRequestListResponse | undefined {
  const record = streamerRiotIdListExactRecord(value, ["requests", "pagination"]);
  if (!record || !Array.isArray(record.requests) || record.requests.length > 10_000) return undefined;
  const requests = record.requests.map(parseStreamerRiotIdRequestListItem);
  if (requests.some((request) => !request)) return undefined;
  if (record.pagination === undefined) return { requests: requests as StreamerRiotIdRequestListItem[] };

  const pagination = streamerRiotIdListExactRecord(record.pagination, ["limit", "total", "returned", "hasMore", "nextCursor"]);
  if (
    !pagination
    || !streamerRiotIdListSafeInteger(pagination.limit, 100)
    || pagination.limit < 1
    || !streamerRiotIdListSafeInteger(pagination.total, 10_000_000)
    || !streamerRiotIdListSafeInteger(pagination.returned, 100)
    || pagination.returned !== requests.length
    || pagination.returned > pagination.limit
    || typeof pagination.hasMore !== "boolean"
    || (pagination.nextCursor !== undefined && !streamerRiotIdListString(pagination.nextCursor, 512))
    || (pagination.hasMore && requests.length > 0 && pagination.nextCursor === undefined)
  ) return undefined;
  return {
    requests: requests as StreamerRiotIdRequestListItem[],
    pagination: {
      limit: pagination.limit,
      total: pagination.total,
      returned: pagination.returned,
      hasMore: pagination.hasMore,
      ...(pagination.nextCursor !== undefined ? { nextCursor: pagination.nextCursor as string } : {})
    }
  };
}

export type ParticipationDashboardQueueEntry = ParticipationPublicQueueEntry & {
  id: string;
  twitchUserName: string;
  /** LoL 참가자만 있습니다. Palworld 참가자는 palworldNickname을 대신 씁니다. */
  riotId?: string;
  source: ParticipationEntry["source"];
  verifiedRank?: string;
  profileAnalyzedAt?: string;
  profileFailureReason?: string;
  selectedAt?: string;
  checkInExpiresAt?: string;
  playedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ParticipationSummary = {
  total: number;
  active: number;
  waiting: number;
  selected: number;
  checkedIn: number;
  noShow: number;
  played: number;
};

export type ParticipationState = {
  streamerId?: string;
  revision?: number;
  session?: ParticipationSession;
  isOpen: boolean;
  queue: ParticipationDashboardQueueEntry[];
  activeQueue: ParticipationDashboardQueueEntry[];
  summary: ParticipationSummary;
};

export type LolOperationsState = {
  identity?: StreamerRiotIdentity;
  automation: LolAutomationSettings;
  participation: ParticipationState;
  summary: {
    riotApprovalStatus: StreamerRiotIdRequestStatus | "missing";
    gameMonitorStatus: "disabled" | "waiting_for_approval" | "monitoring";
    currentGameStatus: "idle" | "in_game" | "unknown";
    participationStatus: ParticipationSessionStatus;
    waitingCount: number;
  };
};

export const PARTICIPATION_ACTIVE_STATUSES = [
  "pending",
  "verified",
  "waitlisted",
  "selected",
  "checked_in",
  "invited",
  "in_game"
] as const satisfies readonly ParticipationStatus[];

export const PARTICIPATION_WAITING_STATUSES = ["verified", "waitlisted"] as const satisfies readonly ParticipationStatus[];

export function isActiveParticipationStatus(status: ParticipationStatus): boolean {
  return (PARTICIPATION_ACTIVE_STATUSES as readonly ParticipationStatus[]).includes(status);
}

export function isWaitingParticipationStatus(status: ParticipationStatus): boolean {
  return (PARTICIPATION_WAITING_STATUSES as readonly ParticipationStatus[]).includes(status);
}

export function normalizeLolRole(value: string | undefined): LolRole {
  const input = (value ?? "").trim().normalize("NFKC").toLowerCase();
  if (["탑", "top", "탑솔", "toplane", "top lane", "トップ", "上"].includes(input)) return "top";
  if (["정글", "jungle", "jg", "jgl", "ジャングル"].includes(input)) return "jungle";
  if (["미드", "mid", "middle", "midlane", "mid lane", "ミッド", "中央"].includes(input)) return "mid";
  if (["원딜", "adc", "bot", "bottom", "바텀", "botlane", "bot lane", "bottom lane", "ボット", "ボトム"].includes(input)) return "adc";
  if (["서폿", "서포터", "support", "sup", "サポート", "サポ"].includes(input)) return "support";
  if (["아무", "아무라인", "fill", "상관없음", "올포지션", "any", "anyrole", "any role", "どこでも", "おまかせ", "なんでも"].includes(input)) return "fill";
  return "unknown";
}

export function parseRiotId(input: string): { gameName: string; tagLine: string } | null {
  const result = parseRiotIdDetailed(input);
  return result.ok ? { gameName: result.gameName, tagLine: result.tagLine } : null;
}

export function formatBilingualNotice(titleJa: string, titleKo: string, messageJa: string, messageKo: string): string {
  return `${titleJa} / ${titleKo}\nJP｜${messageJa}\nKR｜${messageKo}`;
}

export function parseRiotIdDetailed(input: string): RiotIdParseResult {
  const trimmed = input.trim().normalize("NFKC");
  if (!trimmed) return { ok: false, code: "empty", message: formatBilingualNotice("入力案内", "입력 안내", "Riot IDを入力してください。例: HideOnBush#KR1", "Riot ID를 입력해주세요. 예: HideOnBush#KR1") };
  if (trimmed.length > 64) return { ok: false, code: "too_long", message: formatBilingualNotice("入力エラー", "입력 오류", "Riot IDが長すぎます。gameName#tagLine 形式で入力してください。", "Riot ID가 너무 깁니다. gameName#tagLine 형식으로 입력해주세요.") };
  if (/[\r\n\t]/.test(trimmed) || /[<>`"']/.test(trimmed)) {
    return { ok: false, code: "unsafe_characters", message: formatBilingualNotice("入力エラー", "입력 오류", "Riot IDに使用できない文字が含まれています。", "Riot ID에 사용할 수 없는 문자가 포함되어 있습니다.") };
  }
  const hashIndex = trimmed.lastIndexOf("#");
  if (hashIndex < 0) return { ok: false, code: "missing_tag", message: formatBilingualNotice("タグ不足", "태그 누락", "タグが必要です。Riot IDを gameName#tagLine 形式で入力してください。例: HideOnBush#KR1", "태그가 필요합니다. Riot ID를 gameName#tagLine 형식으로 입력해주세요. 예: HideOnBush#KR1") };
  if (hashIndex === 0 || hashIndex === trimmed.length - 1) {
    return { ok: false, code: "missing_tag", message: formatBilingualNotice("入力案内", "입력 안내", "gameName と tagLine を両方入力してください。例: HideOnBush#KR1", "gameName과 tagLine을 모두 입력해주세요. 예: HideOnBush#KR1") };
  }
  const gameName = trimmed.slice(0, hashIndex).trim().replace(/\s+/g, " ");
  const tagLine = trimmed.slice(hashIndex + 1).trim();
  if (!gameName || gameName.length > 32) {
    return { ok: false, code: "invalid_game_name", message: formatBilingualNotice("入力エラー", "입력 오류", "Riot ID の gameName は1〜32文字で入力してください。", "Riot ID의 gameName은 1자 이상 32자 이하로 입력해주세요.") };
  }
  if (!tagLine || tagLine.length > 10 || /\s/.test(tagLine) || !/^[\p{L}\p{N}_-]+$/u.test(tagLine)) {
    return { ok: false, code: "invalid_tag_line", message: formatBilingualNotice("入力エラー", "입력 오류", "Riot ID の tagLine は空白なしで1〜10文字で入力してください。", "Riot ID의 tagLine은 공백 없이 1자 이상 10자 이하로 입력해주세요.") };
  }
  return { ok: true, gameName, tagLine };
}

export function formatRiotId(gameName: string, tagLine: string): string {
  return `${gameName.trim()}#${tagLine.trim()}`;
}

export function normalizeRiotIdKey(gameName: string, tagLine: string): string {
  const normalizedGameName = gameName.trim().normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
  const normalizedTagLine = tagLine.trim().normalize("NFKC").toLowerCase();
  return `${normalizedGameName}#${normalizedTagLine}`;
}
