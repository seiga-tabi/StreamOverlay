import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";
import type { Store } from "../services/store.js";
import { publishParticipationSnapshot as publishAtomicParticipationSnapshot } from "../services/participation-snapshot.js";
import type { ActionDispatcher } from "../core/action-dispatcher.js";
import {
  OVERLAY_CHANNELS,
  formatRiotId,
  normalizeRiotIdKey,
  normalizeLolRole,
  parseRiotIdDetailed,
  toSafeErrorMessage,
  validateBotAction,
  type BotAction,
  type CommunityPost,
  type CommunityPostCategory,
  type CommunityPostCommentCreateInput,
  type CommunityPostCreateInput,
  type CommunityPostReport,
  type LolChampionSkinOption,
  type LolChampionSummary,
  type LolAutomationSettings,
  type LolOperationsState,
  type LolPerformanceStats,
  type LolRankHistoryPoint,
  type LolRankedStats,
  type LolRole,
  type LolRoleAnalysis,
  type ParticipationEntry,
  type ParticipationPhase,
  type ParticipationStreamerProfile,
  type ParticipationStatus,
  type DashboardServerStatus,
  type FollowerManagementResponse,
  type OverlayStatus,
  type StreamerProfileLink,
  type StreamerRiotIdentity,
  type StreamerRiotIdRequest,
  type SupportMailAttachmentSummary,
  type SupportMailInboundPayload,
  type StreamerTournament,
  type TournamentUpsertInput
} from "@streamops/shared";
import type { TwitchAuthService } from "../services/twitch-auth.js";
import { TwitchFollowerLookupError, type TwitchApiClient, type TwitchStreamStatus } from "../services/twitch-api.js";
import {
  StreamerFollowerAuthError,
  type StreamerFollowerAuthService
} from "../services/streamer-follower-auth.js";
import type { PublicTwitchAuthService } from "../services/public-twitch-auth.js";
import {
  clearPublicTwitchViewerSessionCookie,
  publicTwitchViewerSessionCookie,
  publicTwitchViewerSessionIdFromRequest
} from "../services/public-twitch-auth.js";
import { RiotApiHttpError, RiotRateLimitError, type RiotApiClient, type RiotCurrentGameInfo, type RiotMatch, type RiotMatchParticipant, type RiotMatchTimeline } from "../services/riot-api.js";
import type { DataDragonService, LolChampionAbilitySummary, LolRuneSummary } from "../services/data-dragon.js";
import type { LolProfileCacheEntry, LolProfileRepository } from "../services/lol-profile-store.js";
import { appConfig, legalRuntimeConfigReady } from "../config.js";
import type { TwitchEventSubClient } from "../services/twitch-eventsub-client.js";
import { rankedEmblemAssetPath } from "../services/ranked-emblems.js";
import { getRewardMappingSummaries } from "../modules/rewards.module.js";
import {
  loadGameMonitorConfig,
  refreshActiveStreamerProfile,
  refreshStreamerProfileForOwner,
  restartActiveLolGameMonitor,
  restartStreamerLolGameMonitor,
  saveGameMonitorConfig,
  type LolGameMonitorConfig
} from "../modules/lol-game-monitor.module.js";
import { loadLolParticipationProfileSettings, saveLolParticipationProfileSettings, type LolParticipationProfileSettings } from "../modules/lol-profile-enrichment.module.js";
import { buildRankHistory, inferMainRoleFromMatches, performanceStatsFromMatches } from "../services/lol-profile-enrichment.js";
import type { JsonlLogger } from "../logging/jsonl-logger.js";
import type { SupportMailboxFilter, SupportMailboxStore } from "../services/support-mailbox-store.js";
import {
  ALERT_OVERLAY_KEYS,
  alertAssetRoot,
  isAlertOverlayKey,
  isSafeAlertMediaUrl,
  listAlertGifAssets,
  loadAlertOverlayConfig,
  saveAlertOverlayPreset,
  type AlertOverlayKey
} from "../services/alert-overlay-config.js";
import {
  DashboardSessionStore,
  authenticateDashboardRequest,
  authorizeHttpRequest,
  clearDashboardSessionCookie,
  clientIp,
  dashboardSessionCookie,
  dashboardSessionIdFromRequest,
  tokenMatches,
  type AuthPrincipal,
  type DashboardRole
} from "../security/auth.js";
import { dashboardApiLimiter, dashboardLoginLimiter, inboundEmailLimiter, oauthLimiter, publicLolApiLimiter } from "../security/rate-limit.js";
import { isPublicDashboardAppRoute } from "../routing/public-dashboard-routes.js";
import {
  buildLivenessResponse,
  buildReadinessResponse,
  resolveReadiness,
  type ReadinessCheck
} from "../routing/health-responses.js";
import { CommunityModerationService, CommunityModerationServiceError } from "../services/community-moderation-service.js";
import {
  PALWORLD_PUBLIC_CACHE_CONTROL,
  PalworldRecordNotFoundError,
  palworldDataService
} from "../services/palworld-data.js";
import {
  PalworldQueryError,
  parsePalworldBreedingParentsQuery,
  parsePalworldBreedingQuery,
  parsePalworldId,
  parsePalworldItemListQuery,
  parsePalworldPalListQuery,
  parsePalworldSearchQuery
} from "../services/palworld-query.js";

const MAX_JSON_BODY_BYTES = 1_000_000;
const MAX_ALERT_GIF_BYTES = 5_000_000;
const MAX_COMMUNITY_IMAGE_BYTES = 5_000_000;
const MAX_INBOUND_EMAIL_WEBHOOK_BYTES = 250_000;
const MAX_SUPPORT_MAIL_TEXT_LENGTH = 100_000;
const MAX_SUPPORT_MAIL_ATTACHMENTS = 20;
const INBOUND_EMAIL_SIGNATURE_MAX_AGE_SECONDS = 5 * 60;
const MAX_PARTICIPATION_INVITE_MESSAGE_LENGTH = 360;
const MAX_PARTICIPATION_INVITE_BULK_TARGETS = 20;
const MAX_TWITCH_CHAT_MESSAGE_LENGTH = 500;
const PROFILE_REFRESH_COOLDOWN_MS = 60_000;
const SKIN_OPTIONS_CACHE_TTL_MS = 10 * 60_000;
const FOLLOWER_REFRESH_COOLDOWN_MS = 5 * 60_000;
const PUBLIC_LOL_PROFILE_MATCH_COUNT = 20;
const PUBLIC_LOL_PROFILE_MATCH_LOOKUP_COUNT = 20;
const PUBLIC_LOL_PROFILE_MAX_MATCH_START = 200;
const STREAMER_PROFILE_LINK_MAX = 5;
const STREAMER_PROFILE_LINK_LABEL_MAX = 40;
const STREAMER_PROFILE_LINK_URL_MAX = 2048;
const PUBLIC_LOL_PROFILE_TOP_CHAMPION_COUNT = 5;
const PUBLIC_LOL_PROFILE_QUEUES = [420, 440, 42, 6, 430, 400, 450];
const PUBLIC_LOL_PROFILE_CACHE_TTL_MS = 10 * 60_000;
const PUBLIC_LOL_PROFILE_REFRESH_COOLDOWN_MS = 10 * 60_000;
const PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE = 100;
const PUBLIC_LOL_CURRENT_GAME_LIVE_CACHE_TTL_MS = 20_000;
const PUBLIC_LOL_CURRENT_GAME_NOT_FOUND_CACHE_TTL_MS = 5_000;
const PUBLIC_LOL_CURRENT_GAME_ERROR_CACHE_TTL_MS = 10_000;
const PUBLIC_LOL_MATCH_RANK_CACHE_TTL_MS = 5 * 60_000;
const PUBLIC_LOL_MATCH_BUILD_CACHE_TTL_MS = 30 * 60_000;
const PUBLIC_LOL_MATCH_DETAIL_CACHE_TTL_MS = 30 * 60_000;
const PUBLIC_LOL_MATCH_DETAIL_CACHE_MAX = 1000;
const PUBLIC_LOL_PROFILE_CACHE_MAX = 500;
const PUBLIC_LOL_CURRENT_GAME_CACHE_MAX = 500;
const PUBLIC_LOL_MATCH_CACHE_MAX = 1000;
const TWITCH_STREAM_EVENTSUB_LIVE_FALLBACK_MAX_AGE_MS = 5 * 60_000;
const SERVER_PROCESS_STARTED_AT = new Date(Date.now() - process.uptime() * 1000).toISOString();
const PUBLIC_TWITCH_SUBSCRIPTION_CHECK_LIMIT = 30;
const SAFE_CHAT_URL_PROTOCOLS = new Set(["http", "https"]);
const PARTICIPATION_INVITE_TARGET_STATUSES = new Set(["verified", "waitlisted", "selected", "checked_in", "invited"]);
const PARTICIPATION_MANUAL_ACTIONS = new Set(["open", "show_queue", "mark_in_game", "finish_game", "close"]);
const PARTICIPATION_ENTRY_STATUSES = new Set<ParticipationStatus>([
  "pending",
  "verified",
  "waitlisted",
  "selected",
  "checked_in",
  "invited",
  "in_game",
  "played",
  "skipped",
  "cancelled",
  "no_show",
  "rejected",
  "blocked"
]);
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
};

const PALWORLD_CACHE_HEADERS = {
  "Cache-Control": PALWORLD_PUBLIC_CACHE_CONTROL,
  "X-Palworld-Data-Version": palworldDataService.meta().metadata.gameVersion,
  "X-Palworld-Data-Revision": palworldDataService.meta().metadata.sourceRevision
};

type SkinOptionsResponse = {
  status: "ready" | "missing_streamer" | "riot_not_configured" | "invalid_streamer" | "not_found" | "no_mastery";
  streamerRiotId: string;
  champion?: LolChampionSummary;
  skins: LolChampionSkinOption[];
  selectedSkinNum: number;
  message?: string;
};

type PublicLolMatchBadgeCode = "mvp" | "ace" | "unstoppable" | "tenacity" | "damage_carry" | "objective" | "vision";

type PublicLolMatchBadge = {
  code: PublicLolMatchBadgeCode;
  score?: number;
  rank?: number;
};

type PublicLolMatchRune = LolRuneSummary & {
  kind: "primary" | "secondary" | "stat";
  category: "style" | "keystone" | "perk" | "offense" | "flex" | "defense";
};

type PublicLocale = "ko" | "ja";

type PublicLocalePreference = {
  locale: PublicLocale;
  source: "country" | "accept-language" | "fallback";
  country?: string;
};

type PublicLolMatchParticipant = {
  participantId?: number;
  riotId?: string;
  isTarget: boolean;
  champion: LolChampionSummary;
  twitchStream?: PublicLolTwitchStream;
  championLevel?: number;
  position?: string;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  cs?: number;
  csPerMinute?: number;
  killParticipation?: number;
  goldEarned?: number;
  goldShare?: number;
  damageDealtToChampions?: number;
  damageShare?: number;
  damageDealtToObjectives?: number;
  damageObjectiveShare?: number;
  damageTaken?: number;
  damageTakenShare?: number;
  visionScore?: number;
  visionScorePerMinute?: number;
  items: Array<{ slot: number; itemId: number; iconUrl?: string }>;
  summonerSpells: number[];
  runes: PublicLolMatchRune[];
  badges?: PublicLolMatchBadge[];
};

type PublicLolMatchTeamDetail = {
  teamId: number;
  result: "win" | "loss" | "unknown";
  kills: number;
  deaths: number;
  assists: number;
  goldEarned: number;
  damageDealtToChampions: number;
  damageDealtToObjectives: number;
  damageTaken: number;
  objectives: Record<string, number>;
  players: PublicLolMatchParticipant[];
};

type PublicLolMatchRankParticipant = {
  riotId?: string;
  teamId?: number;
  championId: number;
  position?: string;
  rankedStats?: LolRankedStats;
};

type PublicLolMatchRankResponse = {
  status: "ready";
  matchId: string;
  participants: PublicLolMatchRankParticipant[];
  fetchedAt: string;
};

type PublicLolMatchBuildItemEvent = {
  itemId: number;
  iconUrl?: string;
  timestampMs: number;
};

type PublicLolMatchBuildSkillEvent = {
  slot: number;
  key: "Q" | "W" | "E" | "R";
  level: number;
  timestampMs: number;
  nameKo?: string;
  nameJa?: string;
  iconUrl?: string;
};

type PublicLolMatchBuildParticipant = {
  participantId?: number;
  riotId?: string;
  teamId?: number;
  result: "win" | "loss" | "unknown";
  champion: LolChampionSummary;
  score: number;
  items: Array<{ slot: number; itemId: number; iconUrl?: string }>;
  itemEvents: PublicLolMatchBuildItemEvent[];
  skillOrder: PublicLolMatchBuildSkillEvent[];
  runes: PublicLolMatchRune[];
  summonerSpells: number[];
  badges: PublicLolMatchBadge[];
};

type PublicLolMatchBuildResponse = {
  status: "ready";
  matchId: string;
  dataDragonVersion?: string;
  participants: PublicLolMatchBuildParticipant[];
  fetchedAt: string;
};

type PublicLolRecentMatch = {
  matchId: string;
  champion: LolChampionSummary;
  queueId?: number;
  gameMode?: string;
  gameType?: string;
  mapId?: number;
  startedAt?: string;
  durationSeconds?: number;
  result: "win" | "loss" | "unknown";
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  championLevel?: number;
  cs?: number;
  csPerMinute?: number;
  killParticipation?: number;
  goldEarned?: number;
  goldPerMinute?: number;
  damageDealtToChampions?: number;
  damageTaken?: number;
  damagePerMinute?: number;
  damageShare?: number;
  visionScore?: number;
  visionScorePerMinute?: number;
  wardsPlaced?: number;
  wardsKilled?: number;
  controlWardsPlaced?: number;
  largestMultiKill?: number;
  soloKills?: number;
  turretKills?: number;
  inhibitorKills?: number;
  objectivesStolen?: number;
  totalTimeSpentDead?: number;
  position?: string;
  items: Array<{ slot: number; itemId: number; iconUrl?: string }>;
  summonerSpells: number[];
  badges: PublicLolMatchBadge[];
  team?: {
    teamId: number;
    kills: number;
    deaths: number;
    goldEarned: number;
    damageDealtToChampions: number;
    objectives: Record<string, number>;
  };
  opponent?: {
    riotId?: string;
    champion: LolChampionSummary;
    kills: number;
    deaths: number;
    assists: number;
    kda: number;
  };
  teams: PublicLolMatchTeamDetail[];
};

type PublicLolChampionPerformance = {
  champion: LolChampionSummary;
  games: number;
  wins: number;
  winRate: number;
  averageKda: number;
  averageCsPerMinute?: number;
  averageDamagePerMinute?: number;
};

type PublicLolRolePerformance = {
  role: string;
  games: number;
  wins: number;
  winRate: number;
  averageKda: number;
};

type PublicLolSuggestion = {
  riotId: string;
  gameName: string;
  tagLine: string;
  source: "verified" | "recent";
  profileIconUrl?: string;
  summonerLevel?: number;
  lolPlatform?: string;
  rankedStats?: LolRankedStats;
  lastSeenAt: string;
};

type PublicLolCurrentGameParticipant = {
  riotId?: string;
  isTarget: boolean;
  teamId: number;
  summonerSpells: number[];
  profileIconUrl?: string;
  rankedStats?: LolRankedStats;
  bot?: boolean;
  champion: LolChampionSummary;
};

type PublicLolCurrentGame = {
  isLive: boolean;
  status: "live" | "not_found" | "unavailable";
  message?: string;
  errorCode?: string;
  lolPlatform?: string;
  gameId?: string;
  queueId?: number;
  gameMode?: string;
  gameType?: string;
  mapId?: number;
  startedAt?: string;
  gameLengthSeconds?: number;
  participants: PublicLolCurrentGameParticipant[];
  fetchedAt: string;
};

type PublicLolMatchPageResponse = {
  status: "ready";
  riotId: string;
  gameName: string;
  tagLine: string;
  accountRegion: string;
  lolPlatform: string;
  recentMatches: PublicLolRecentMatch[];
  recentMatchStart: number;
  nextRecentMatchStart?: number;
  hasMoreRecentMatches: boolean;
  fetchedAt: string;
};

type PublicLolProfileResponse = {
  status: "ready";
  riotId: string;
  gameName: string;
  tagLine: string;
  accountRegion: string;
  lolPlatform: string;
  profileIconUrl?: string;
  summonerLevel?: number;
  ladderRank?: number;
  rankedStats?: LolRankedStats;
  rankedQueues?: {
    solo?: LolRankedStats;
    flex?: LolRankedStats;
    ranked5v5?: LolRankedStats;
  };
  rankHistory?: LolRankHistoryPoint[];
  twitchStream?: PublicLolTwitchStream;
  performanceStats?: LolPerformanceStats;
  roleAnalysis?: LolRoleAnalysis;
  topChampions: LolChampionSummary[];
  recentMatches: PublicLolRecentMatch[];
  liveGame: PublicLolCurrentGame;
  recentMatchStart: number;
  nextRecentMatchStart?: number;
  hasMoreRecentMatches: boolean;
  summary: {
    recentGames: number;
    recentWins: number;
    recentWinRate: number;
    averageKda?: number;
    averageCsPerMinute?: number;
    averageKillParticipation?: number;
    averageDamagePerMinute?: number;
    averageDamageShare?: number;
    averageGoldPerMinute?: number;
    averageVisionScore?: number;
    totalKills: number;
    totalDeaths: number;
    totalAssists: number;
  };
  championPerformance: PublicLolChampionPerformance[];
  rolePerformance: PublicLolRolePerformance[];
  fetchedAt: string;
  refreshAvailableAt?: string;
};

type PublicLolRankedQueues = {
  solo?: LolRankedStats;
  flex?: LolRankedStats;
  ranked5v5?: LolRankedStats;
  primary?: LolRankedStats;
};

type PublicLolTwitchStream = {
  matched: true;
  isLive: boolean;
  twitchUserId: string;
  twitchLogin?: string;
  twitchDisplayName: string;
  profileImageUrl?: string;
  profileLinkUrl?: string;
  profileLinkLabel?: string;
  profileLinks?: StreamerProfileLink[];
  channelUrl?: string;
  title?: string;
  gameName?: string;
  viewerCount?: number;
  startedAt?: string;
  thumbnailUrl?: string;
  source: "participation" | "connected_streamer" | "approved_streamer";
};

type PublicLolTwitchCandidate = {
  twitchUserId: string;
  twitchLogin?: string;
  twitchDisplayName: string;
  profileImageUrl?: string;
  profileLinkUrl?: string;
  profileLinkLabel?: string;
  profileLinks?: StreamerProfileLink[];
  source: PublicLolTwitchStream["source"];
};

type PublicTwitchFollowedLolChannel = {
  twitchUserId: string;
  twitchLogin: string;
  twitchDisplayName: string;
  profileImageUrl?: string;
  followedAt: string;
  isLive: boolean;
  channelUrl?: string;
  title?: string;
  gameName?: string;
  viewerCount?: number;
  startedAt?: string;
  thumbnailUrl?: string;
  riotId?: string;
  riotGameName?: string;
  riotTagLine?: string;
  rankedStats?: LolRankedStats;
  source?: "participation" | "connected_streamer" | "approved_streamer";
};

type PublicTwitchSubscriptionChannel = {
  twitchUserId: string;
  twitchLogin: string;
  twitchDisplayName: string;
  profileImageUrl?: string;
  channelUrl?: string;
  tier: string;
  tierLabel: string;
  isGift: boolean;
  gifterName?: string;
};

type PublicTwitchFollowedLolResponse = {
  connected: boolean;
  total?: number;
  truncated: boolean;
  matchedCount: number;
  subscriptionScopeGranted: boolean;
  subscriptions: PublicTwitchSubscriptionChannel[];
  channels: PublicTwitchFollowedLolChannel[];
};

type PublicTwitchViewerStatusResponse = Awaited<ReturnType<PublicTwitchAuthService["getStatus"]>> & {
  streamerRiotRequest?: StreamerRiotIdRequest;
};

type PublicParticipationQueueItem = {
  position: number;
  twitchUserName: string;
  preferredRole?: LolRole;
  requestedRole?: LolRole;
  status: ParticipationStatus;
  profileStatus?: ParticipationEntry["profileStatus"];
  mainRole?: ParticipationEntry["mainRole"];
  mainRoleConfidence?: number;
  rankedStats?: LolRankedStats;
  topChampions?: LolChampionSummary[];
  isViewer: boolean;
};

type PublicParticipationViewerEntry = PublicParticipationQueueItem & {
  riotId: string;
  source: ParticipationEntry["source"];
};

type PublicParticipationStreamer = {
  id: string;
  twitchUserId?: string;
  twitchLogin?: string;
  twitchDisplayName: string;
  twitchProfileImageUrl?: string;
  riotId?: string;
  riotGameName?: string;
  riotTagLine?: string;
  isOpen: boolean;
  queueSize: number;
  updatedAt: string;
};

type PublicParticipationStateResponse = {
  connected: boolean;
  configured: boolean;
  isOpen: boolean;
  summary: ReturnType<Store["getParticipationState"]>["summary"];
  streamers: PublicParticipationStreamer[];
  selectedStreamerId?: string;
  queue: PublicParticipationQueueItem[];
  viewerEntry?: PublicParticipationViewerEntry;
  maxQueueSize: number;
  updatedAt: string;
};

type PublicParticipationJoinResponse = {
  ok: true;
  alreadyJoined: boolean;
  reused: boolean;
  state: PublicParticipationStateResponse;
  entry?: PublicParticipationViewerEntry;
};

type PublicParticipationCancelResponse = {
  ok: true;
  state: PublicParticipationStateResponse;
};

type FollowerRefreshRuntime = {
  inFlight?: Promise<FollowerManagementResponse>;
  availableAt: number;
  lastState?: FollowerManagementResponse;
};

class HttpRequestError extends Error {
  constructor(
    readonly status: number,
    readonly payload: Record<string, unknown>
  ) {
    super(String(payload.error ?? "request error"));
    this.name = "HttpRequestError";
  }
}

async function readRawBody(req: IncomingMessage, maxBytes = MAX_JSON_BODY_BYTES): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      throw new HttpRequestError(413, { error: "request body가 너무 큽니다." });
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function readBody(req: IncomingMessage, maxBytes = MAX_JSON_BODY_BYTES): Promise<string> {
  return (await readRawBody(req, maxBytes)).toString("utf8");
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req);
  if (!raw.trim()) throw new HttpRequestError(400, { error: "JSON body가 필요합니다." });
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpRequestError(400, { error: "올바른 JSON body가 아닙니다." });
  }
}

function isDevLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(origin);
}

function corsHeaders(req: IncomingMessage): Record<string, string> {
  const requestHeaders = req.headers ?? {};
  const origin = requestHeaders.origin;
  const responseHeaders: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-StreamOps-Dashboard-Token, X-StreamOps-Dashboard-Surface, X-StreamOps-Streamer-Slug, X-StreamOps-Dashboard-Key, X-StreamOps-CSRF",
    "Vary": "Origin"
  };
  if (typeof origin === "string") {
    const allowed = appConfig.security.corsOrigins.includes(origin) || (appConfig.nodeEnv !== "production" && isDevLocalOrigin(origin));
    if (allowed) {
      responseHeaders["Access-Control-Allow-Origin"] = origin;
      responseHeaders["Access-Control-Allow-Credentials"] = "true";
    }
  }
  return responseHeaders;
}

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store"
  };
}

function sendJson(req: IncomingMessage, res: ServerResponse, status: number, payload: unknown, headers: Record<string, string | string[]> = {}): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...securityHeadersForRequest(req),
    ...noStoreHeaders(),
    ...corsHeaders(req),
    ...headers
  });
  if (req.method === "HEAD" || status === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
}

function sendRedirect(res: ServerResponse, location: string, headers: Record<string, string | string[]> = {}): void {
  res.writeHead(302, { ...SECURITY_HEADERS, Location: location, ...headers });
  res.end();
}

function dashboardAuthSurface(value: string | null | undefined): DashboardRole {
  return value === "streamer" ? "streamer" : "admin";
}

function originFor(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "'self'";
  }
}

function originFromUrl(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function wsOriginFor(value: string): string {
  try {
    const url = new URL(value);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.origin;
  } catch {
    return "'self'";
  }
}

function headerFirstValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim();
}

function isLocalHostHeader(host: string | undefined): boolean {
  if (!host) return false;
  try {
    const hostname = new URL(`http://${host}`).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function requestProtocol(req: IncomingMessage): "http" | "https" {
  const forwardedProto = appConfig.security.trustProxy ? headerFirstValue(req.headers["x-forwarded-proto"]) : undefined;
  if (forwardedProto === "http" || forwardedProto === "https") return forwardedProto;
  const encrypted = Boolean((req.socket as IncomingMessage["socket"] & { encrypted?: boolean } | undefined)?.encrypted);
  return encrypted ? "https" : "http";
}

function securityHeadersForRequest(req: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = { ...SECURITY_HEADERS };
  if (appConfig.nodeEnv === "production" && requestProtocol(req) === "https") {
    headers["Strict-Transport-Security"] = "max-age=15552000; includeSubDomains";
  }
  return headers;
}

function shouldRedirectToHttps(req: IncomingMessage, pathname: string): boolean {
  if (appConfig.nodeEnv !== "production" || requestProtocol(req) === "https") return false;
  return pathname !== "/health" && pathname !== "/health/live" && pathname !== "/health/ready";
}

function sendHttpsRedirect(res: ServerResponse, requestUrl: string): void {
  const target = new URL(requestUrl, appConfig.publicBaseUrl).toString();
  res.writeHead(308, { ...SECURITY_HEADERS, "Cache-Control": "no-store", Location: target });
  res.end();
}

function requestOrigin(req: IncomingMessage): string | undefined {
  const forwardedHost = appConfig.security.trustProxy ? headerFirstValue(req.headers["x-forwarded-host"]) : undefined;
  const host = forwardedHost || headerFirstValue(req.headers.host);
  if (!host) return undefined;
  try {
    return new URL(`${requestProtocol(req)}://${host}`).origin;
  } catch {
    return undefined;
  }
}

function publicOriginForRequest(req: IncomingMessage): string {
  return requestOrigin(req) ?? originFromUrl(appConfig.publicBaseUrl) ?? "http://localhost:3000";
}

function forwardedOrigin(req: IncomingMessage): string | undefined {
  const forwardedProto = headerFirstValue(req.headers["x-forwarded-proto"]);
  const forwardedHost = headerFirstValue(req.headers["x-forwarded-host"]);
  if ((forwardedProto !== "http" && forwardedProto !== "https") || !forwardedHost) return undefined;
  try {
    return new URL(`${forwardedProto}://${forwardedHost}`).origin;
  } catch {
    return undefined;
  }
}

function refererOrigin(req: IncomingMessage): string | undefined {
  const referer = headerFirstValue(req.headers.referer);
  return referer ? originFromUrl(referer) : undefined;
}

function isLocalOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function externalPublicOriginForRequest(req: IncomingMessage): string {
  return forwardedOrigin(req) ??
    refererOrigin(req) ??
    requestOrigin(req) ??
    originFromUrl(appConfig.publicBaseUrl) ??
    "http://localhost:3000";
}

function trustedPublicOriginForRequest(req: IncomingMessage): string {
  const fallback = originFromUrl(appConfig.publicBaseUrl) ?? "http://localhost:3000";
  const allowedOrigins = new Set(
    [
      appConfig.publicBaseUrl,
      appConfig.dashboardBaseUrl,
      appConfig.overlayBaseUrl,
      appConfig.twitch.publicRedirectUri,
      ...appConfig.security.corsOrigins
    ]
      .map(originFromUrl)
      .filter((origin): origin is string => Boolean(origin))
  );
  const requestedOrigin = requestOrigin(req);
  return requestedOrigin && allowedOrigins.has(requestedOrigin) ? requestedOrigin : fallback;
}

function wsBaseForOrigin(origin: string): string {
  return origin.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
}

function publicTwitchCallbackUrlForRequest(req: IncomingMessage): string {
  const origin = externalPublicOriginForRequest(req);
  try {
    const configured = new URL(appConfig.twitch.publicRedirectUri);
    if (!isLocalOrigin(origin)) return configured.toString();
    if (isLocalOrigin(configured.origin)) return configured.toString();
    const pathname = configured.pathname || "/api/public/twitch/auth/callback";
    return `${origin}${pathname}${configured.search}`;
  } catch {
    return `${trustedPublicOriginForRequest(req)}/api/public/twitch/auth/callback`;
  }
}

function apiOriginForRequest(req: IncomingMessage): string {
  return forwardedOrigin(req) ??
    requestOrigin(req) ??
    originFromUrl(appConfig.publicBaseUrl) ??
    "http://localhost:3000";
}

function twitchCallbackUrlForRequest(req: IncomingMessage): string {
  const origin = apiOriginForRequest(req);
  try {
    const configured = new URL(appConfig.twitch.redirectUri);
    if (!isLocalOrigin(origin)) return configured.toString();
    if (isLocalOrigin(configured.origin)) return configured.toString();
    const pathname = configured.pathname || "/api/twitch/auth/callback";
    return `${origin}${pathname}${configured.search}`;
  } catch {
    return `${origin}/api/twitch/auth/callback`;
  }
}

function safeDashboardReturnPath(value: string | null | undefined): string | undefined {
  if (!value?.startsWith("/") || value.startsWith("//")) return undefined;
  if (value === "/dashboard" || value.startsWith("/dashboard/")) return value;
  if (value === "/admin" || value.startsWith("/admin/")) return value;
  return undefined;
}

function dashboardReturnUrlForRequest(req: IncomingMessage, requestedPath?: string | null): string {
  const fallbackOrigin = originFromUrl(appConfig.dashboardBaseUrl) ??
    originFromUrl(appConfig.publicBaseUrl) ??
    "http://localhost:5173";
  const allowedOrigins = new Set(
    [
      appConfig.dashboardBaseUrl,
      appConfig.publicBaseUrl,
      ...appConfig.security.corsOrigins
    ]
      .map(originFromUrl)
      .filter((origin): origin is string => Boolean(origin))
  );
  const requestedOrigin = refererOrigin(req);
  const origin = requestedOrigin && allowedOrigins.has(requestedOrigin) ? requestedOrigin : fallbackOrigin;
  const returnUrl = new URL(safeDashboardReturnPath(requestedPath) ?? "/", origin);
  returnUrl.searchParams.set("twitch", "connected");
  return returnUrl.toString();
}

function followerOAuthReturnUrlForRequest(req: IncomingMessage, storedReturnUrl: string): string {
  try {
    const stored = new URL(storedReturnUrl);
    return dashboardReturnUrlForRequest(req, safeDashboardReturnPath(stored.pathname));
  } catch {
    return dashboardReturnUrlForRequest(req);
  }
}

function publicLolReturnUrlForRequest(req: IncomingMessage): string {
  const url = new URL("/lol", publicOriginForRequest(req));
  url.searchParams.set("viewer_twitch", "connected");
  return url.toString();
}

function publicTwitchReturnUrlForRequest(req: IncomingMessage, requestedPath: string | null): string {
  const fallback = publicLolReturnUrlForRequest(req);
  if (!requestedPath?.startsWith("/") || requestedPath.startsWith("//")) return fallback;
  if (requestedPath !== "/dashboard" && !requestedPath.startsWith("/dashboard/")) return fallback;
  const returnUrl = new URL(requestedPath, publicOriginForRequest(req));
  returnUrl.searchParams.set("viewer_twitch", "connected");
  return returnUrl.toString();
}

function cspConnectSrcForRequest(req: IncomingMessage | undefined): string {
  const requestPublicOrigin = req ? trustedPublicOriginForRequest(req) : originFromUrl(appConfig.publicBaseUrl);
  return [
    "'self'",
    originFor(appConfig.publicBaseUrl),
    wsOriginFor(appConfig.publicBaseUrl),
    requestPublicOrigin,
    requestPublicOrigin ? wsBaseForOrigin(requestPublicOrigin) : undefined
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" ");
}

const DASHBOARD_CSP_NONCE_PLACEHOLDER = "__STREAMOPS_CSP_NONCE__";

function cspForStaticApp(
  mountPath: "/admin" | "/dashboard" | "/overlay",
  req?: IncomingMessage,
  nonce?: string
): string {
  if (mountPath === "/admin" || mountPath === "/dashboard") {
    const scriptSrc = nonce
      ? `script-src 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:`
      : "script-src 'self'";
    return [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      `connect-src ${cspConnectSrcForRequest(req)} https:`,
      `frame-src 'self' ${originFor(appConfig.overlayBaseUrl)} https:`,
      "fenced-frame-src https:",
      "frame-ancestors 'self'",
      "form-action 'self'"
    ].join("; ");
  }
  return [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: https:",
    "media-src 'self' https:",
    `connect-src ${cspConnectSrcForRequest(req)}`,
    "frame-ancestors 'self'",
    "form-action 'none'"
  ].join("; ");
}

function staticSecurityHeaders(
  req: IncomingMessage,
  filePath: string,
  mountPath?: "/admin" | "/dashboard" | "/overlay",
  nonce?: string
): Record<string, string> {
  const headers = securityHeadersForRequest(req);
  if (filePath.endsWith("index.html")) {
    const resolvedMountPath = mountPath
      ?? (filePath.includes(`${path.sep}dashboard${path.sep}`)
        ? "/dashboard"
        : filePath.includes(`${path.sep}overlay${path.sep}`)
          ? "/overlay"
          : undefined);
    if (resolvedMountPath) {
      headers["Content-Security-Policy"] = cspForStaticApp(resolvedMountPath, req, nonce);
    }
  }
  return headers;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function serializeRuntimeConfigValue(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function dashboardRuntimeConfig(req: IncomingMessage): string {
  void req;
  const legal = serializeRuntimeConfigValue({
    ...appConfig.legal,
    supportMailboxRetentionDays: appConfig.supportMailbox.retentionDays,
    configured: legalRuntimeConfigReady()
  });
  return `window.__STREAMOPS_CONFIG__ = {
  apiBase: "",
  wsBase: (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host,
  overlayBase: window.location.origin + "/overlay",
  dashboardAuthRequired: ${appConfig.security.localNoAuth ? "false" : "true"},
  legal: ${legal}
};\n`;
}

function overlayRuntimeConfig(req: IncomingMessage): string {
  void req;
  return `window.__STREAMOPS_CONFIG__ = {
  wsBase: (window.location.protocol === "https:" ? "wss://" : "ws://") + window.location.host
};\n`;
}

function tokenMatchesDashboardAuth(candidate: string): boolean {
  if (appConfig.security.localNoAuth) return true;
  const token = appConfig.security.dashboardAuthToken;
  if (!token) return false;
  const candidateBuffer = Buffer.from(candidate);
  const tokenBuffer = Buffer.from(token);
  if (candidateBuffer.byteLength !== tokenBuffer.byteLength) return false;
  return crypto.timingSafeEqual(candidateBuffer, tokenBuffer);
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".xml") return "application/xml; charset=utf-8";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".ico") return "image/x-icon";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp3") return "audio/mpeg";
  return "application/octet-stream";
}

type MultipartPart = {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
};

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  return headers[name.toLowerCase()];
}

function requestHeaderValue(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function verifyInboundEmailSignature(req: IncomingMessage, body: Buffer, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const timestamp = requestHeaderValue(req, "x-yoro-email-timestamp")?.trim() ?? "";
  const signature = requestHeaderValue(req, "x-yoro-email-signature")?.trim() ?? "";
  if (!/^\d{10,}$/.test(timestamp) || !/^sha256=[a-f0-9]{64}$/i.test(signature) || !secret) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > INBOUND_EMAIL_SIGNATURE_MAX_AGE_SECONDS) return false;
  const expected = crypto.createHmac("sha256", secret).update(timestamp).update(".").update(body).digest();
  const candidate = Buffer.from(signature.slice("sha256=".length), "hex");
  return candidate.byteLength === expected.byteLength && crypto.timingSafeEqual(candidate, expected);
}

function supportMailString(value: unknown, maxLength: number, required = false): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\u0000/g, "").trim().slice(0, maxLength);
  return normalized || (required ? undefined : "");
}

function supportMailAddress(value: unknown): string | undefined {
  const normalized = supportMailString(value, 320, true)?.toLowerCase();
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : undefined;
}

function supportMailAttachment(value: unknown): SupportMailAttachmentSummary | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const fileName = supportMailString(record.fileName, 240, true);
  const mimeType = supportMailString(record.mimeType, 120, true);
  const sizeBytes = Number(record.sizeBytes);
  if (!fileName || !mimeType || !Number.isFinite(sizeBytes) || sizeBytes < 0) return undefined;
  return { fileName, mimeType, sizeBytes: Math.trunc(sizeBytes) };
}

function parseSupportMailInboundPayload(body: Buffer): SupportMailInboundPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(body.toString("utf8"));
  } catch {
    throw new HttpRequestError(400, { error: "올바른 inbound email JSON body가 아닙니다." });
  }
  if (!raw || typeof raw !== "object") throw new HttpRequestError(400, { error: "inbound email payload가 필요합니다." });
  const record = raw as Record<string, unknown>;
  const providerMessageId = supportMailString(record.providerMessageId, 500, true);
  const envelopeFrom = supportMailAddress(record.envelopeFrom);
  const envelopeTo = supportMailAddress(record.envelopeTo);
  const fromAddress = supportMailAddress(record.fromAddress);
  const receivedAt = supportMailString(record.receivedAt, 40, true);
  const sizeBytes = Number(record.sizeBytes);
  if (
    record.version !== 1 || record.provider !== "cloudflare" || !providerMessageId || !envelopeFrom || !envelopeTo || !fromAddress
    || !receivedAt || !Number.isFinite(Date.parse(receivedAt)) || !Number.isFinite(sizeBytes) || sizeBytes <= 0
  ) {
    throw new HttpRequestError(400, { error: "inbound email payload 형식이 올바르지 않습니다." });
  }
  const attachments = Array.isArray(record.attachments)
    ? record.attachments.slice(0, MAX_SUPPORT_MAIL_ATTACHMENTS).map(supportMailAttachment).filter((item): item is SupportMailAttachmentSummary => Boolean(item))
    : [];
  const replyTo = record.replyTo ? supportMailAddress(record.replyTo) : undefined;
  return {
    version: 1,
    provider: "cloudflare",
    providerMessageId,
    envelopeFrom,
    envelopeTo,
    fromAddress,
    fromName: supportMailString(record.fromName, 200, true),
    replyTo,
    subject: supportMailString(record.subject, 300) ?? "",
    text: supportMailString(record.text, MAX_SUPPORT_MAIL_TEXT_LENGTH) ?? "",
    receivedAt: new Date(receivedAt).toISOString(),
    sizeBytes: Math.trunc(sizeBytes),
    attachments
  };
}

function supportMailboxFilter(value: string | null): SupportMailboxFilter {
  return value === "unread" || value === "read" ? value : "all";
}

function localeFromCountryCode(country: string | undefined): PublicLocale | undefined {
  const code = country?.trim().toUpperCase();
  if (code === "JP") return "ja";
  if (code === "KR" || code === "KP") return "ko";
  return undefined;
}

function countryCodeFromRequest(req: IncomingMessage): string | undefined {
  const headerNames = [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "cloudfront-viewer-country",
    "x-country-code",
    "x-appengine-country",
    "x-forwarded-country"
  ];
  for (const name of headerNames) {
    const code = requestHeaderValue(req, name)?.trim().toUpperCase();
    if (code && /^[A-Z]{2}$/.test(code) && code !== "XX") return code;
  }
  return undefined;
}

function localeFromAcceptLanguage(req: IncomingMessage): PublicLocale | undefined {
  const acceptLanguage = requestHeaderValue(req, "accept-language");
  if (!acceptLanguage) return undefined;
  const candidates = acceptLanguage
    .split(",")
    .map((part) => {
      const [rawTag = "", ...params] = part.trim().split(";");
      const q = params
        .map((param) => /^q=(\d+(?:\.\d+)?)$/i.exec(param.trim())?.[1])
        .find((value): value is string => Boolean(value));
      return {
        tag: rawTag.trim().toLowerCase(),
        q: q ? Number(q) : 1
      };
    })
    .filter((candidate) => candidate.tag && Number.isFinite(candidate.q))
    .sort((a, b) => b.q - a.q);
  for (const candidate of candidates) {
    if (candidate.tag.startsWith("ja")) return "ja";
    if (candidate.tag.startsWith("ko")) return "ko";
  }
  return undefined;
}

function publicLocalePreference(req: IncomingMessage): PublicLocalePreference {
  const country = countryCodeFromRequest(req);
  const countryLocale = localeFromCountryCode(country);
  if (countryLocale) return { locale: countryLocale, source: "country", country };
  const languageLocale = localeFromAcceptLanguage(req);
  if (languageLocale) return { locale: languageLocale, source: "accept-language" };
  return { locale: "ko", source: "fallback" };
}

function parseContentDisposition(value: string | undefined): { name?: string; filename?: string } {
  if (!value) return {};
  const name = /(?:^|;\s*)name="([^"]*)"/i.exec(value)?.[1];
  const filename = /(?:^|;\s*)filename="([^"]*)"/i.exec(value)?.[1];
  return { name, filename };
}

function parseMultipartBody(req: IncomingMessage, body: Buffer): MultipartPart[] {
  const contentType = Array.isArray(req.headers["content-type"]) ? req.headers["content-type"][0] : req.headers["content-type"];
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) throw new HttpRequestError(400, { error: "multipart boundary가 필요합니다." });

  const raw = body.toString("latin1");
  const chunks = raw.split(`--${boundary}`);
  const parts: MultipartPart[] = [];
  for (const chunk of chunks.slice(1, -1)) {
    const normalized = chunk.startsWith("\r\n") ? chunk.slice(2) : chunk;
    const headerEnd = normalized.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;
    const headerLines = normalized.slice(0, headerEnd).split("\r\n");
    const headers = Object.fromEntries(headerLines.map((line) => {
      const index = line.indexOf(":");
      return index < 0 ? ["", ""] : [line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim()];
    }).filter(([key]) => key)) as Record<string, string>;
    const disposition = parseContentDisposition(headerValue(headers, "content-disposition"));
    if (!disposition.name) continue;
    let data = normalized.slice(headerEnd + 4);
    if (data.endsWith("\r\n")) data = data.slice(0, -2);
    parts.push({
      name: disposition.name,
      filename: disposition.filename,
      contentType: headerValue(headers, "content-type"),
      data: Buffer.from(data, "latin1")
    });
  }
  return parts;
}

function isGifBytes(data: Buffer): boolean {
  const signature = data.subarray(0, 6).toString("ascii");
  return signature === "GIF87a" || signature === "GIF89a";
}

function communityAssetRoot(): string {
  return path.resolve(appConfig.paths.state, "community-assets");
}

function communityImageExtension(file: MultipartPart): "png" | "jpg" | "gif" | "webp" | undefined {
  const type = file.contentType?.toLowerCase().split(";")[0]?.trim();
  if (file.data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return type === undefined || type === "image/png" ? "png" : undefined;
  }
  if (file.data.byteLength >= 3 && file.data[0] === 0xff && file.data[1] === 0xd8 && file.data[2] === 0xff) {
    return type === undefined || type === "image/jpeg" || type === "image/jpg" ? "jpg" : undefined;
  }
  if (isGifBytes(file.data)) {
    return type === undefined || type === "image/gif" ? "gif" : undefined;
  }
  if (
    file.data.byteLength >= 12 &&
    file.data.subarray(0, 4).toString("ascii") === "RIFF" &&
    file.data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return type === undefined || type === "image/webp" ? "webp" : undefined;
  }
  return undefined;
}

function multipartText(parts: MultipartPart[], name: string): string | undefined {
  const part = parts.find((item) => item.name === name && !item.filename);
  return part ? part.data.toString("utf8").trim() : undefined;
}

function alertConfigResponse() {
  return {
    keys: ALERT_OVERLAY_KEYS,
    config: loadAlertOverlayConfig()
  };
}

function validateParticipationInviteMessage(value: unknown): { ok: true; message: string } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: "message는 문자열이어야 합니다." };
  const message = value.replace(/\s+/g, " ").trim();
  if (!message) return { ok: false, error: "전송할 메시지가 필요합니다." };
  if (message.length > MAX_PARTICIPATION_INVITE_MESSAGE_LENGTH) {
    return { ok: false, error: `메시지는 ${MAX_PARTICIPATION_INVITE_MESSAGE_LENGTH}자 이하여야 합니다.` };
  }
  for (const match of message.matchAll(/\b([a-z][a-z0-9+.-]*):/gi)) {
    const protocol = match[1]?.toLowerCase();
    if (protocol && !SAFE_CHAT_URL_PROTOCOLS.has(protocol)) {
      return { ok: false, error: "초대 링크는 http:// 또는 https:// 주소만 사용할 수 있습니다." };
    }
  }
  return { ok: true, message };
}

function participationMention(userName: string): string {
  return `@${userName.trim()}`;
}

function buildParticipationInviteChatMessages(entries: Array<{ twitchUserName: string }>, message: string): { ok: true; messages: string[] } | { ok: false; error: string } {
  const mentions = [...new Map(entries.map((entry) => [entry.twitchUserName.toLocaleLowerCase(), participationMention(entry.twitchUserName)])).values()];
  const messages: string[] = [];
  let currentMentions: string[] = [];
  for (const mention of mentions) {
    const nextMentions = [...currentMentions, mention];
    const nextMessage = `${nextMentions.join(" ")} ${message}`;
    if (nextMessage.length <= MAX_TWITCH_CHAT_MESSAGE_LENGTH) {
      currentMentions = nextMentions;
      continue;
    }
    if (currentMentions.length === 0) return { ok: false, error: "멘션을 포함한 메시지가 너무 깁니다." };
    messages.push(`${currentMentions.join(" ")} ${message}`);
    currentMentions = [mention];
  }
  if (currentMentions.length > 0) messages.push(`${currentMentions.join(" ")} ${message}`);
  return messages.length > 0 ? { ok: true, messages } : { ok: false, error: "전송 대상이 없습니다." };
}

async function broadcastParticipationSnapshot(input: {
  store: Store;
  actions: ActionDispatcher;
  logger?: Partial<Pick<JsonlLogger, "event" | "error">>;
}, phase: ParticipationPhase, reason: string, streamerId?: string): Promise<void> {
  await publishAtomicParticipationSnapshot(input, {
    phase,
    reason,
    streamerId
  });
}

async function broadcastParticipationQueue(input: {
  store: Store;
  actions: ActionDispatcher;
  logger?: Partial<Pick<JsonlLogger, "event" | "error">>;
}, reason: string, streamerId?: string): Promise<void> {
  await publishAtomicParticipationSnapshot(input, {
    reason,
    streamerId
  });
}

async function applyManualParticipationAction(input: {
  store: Store;
  actions: ActionDispatcher;
  logger?: Partial<Pick<JsonlLogger, "event" | "error">>;
}, action: string, streamerId?: string): Promise<ParticipationPhase> {
  switch (action) {
    case "open":
      input.store.setParticipationOpen(true, streamerId);
      await broadcastParticipationSnapshot(input, "recruiting", "dashboard.participation_manual.open", streamerId);
      return "recruiting";
    case "show_queue": {
      const phase = input.store.getParticipationState(streamerId).isOpen ? "recruiting" : "closed";
      await broadcastParticipationSnapshot(input, phase, "dashboard.participation_manual.show_queue", streamerId);
      return phase;
    }
    case "mark_in_game":
      input.store.markVisibleParticipationQueueInGame(undefined, streamerId);
      if (streamerId) input.store.updateParticipationSessionStatus(streamerId, "in_game");
      await broadcastParticipationSnapshot(input, "in_game", "dashboard.participation_manual.mark_in_game", streamerId);
      return "in_game";
    case "finish_game":
      input.store.markInGameParticipantsPlayed(streamerId);
      if (streamerId) input.store.updateParticipationSessionStatus(streamerId, "recruiting");
      await broadcastParticipationSnapshot(input, "game_ended", "dashboard.participation_manual.finish_game", streamerId);
      return "game_ended";
    case "close":
      input.store.setParticipationOpen(false, streamerId);
      await broadcastParticipationSnapshot(input, "closed", "dashboard.participation_manual.close", streamerId);
      return "closed";
    default:
      throw new HttpRequestError(400, { error: "허용되지 않은 시참 수동 조작입니다." });
  }
}

function selectedChampionSkinNum(champion: { championId: number; championKey?: string }, overrides: Record<string, number>): number {
  const keys = [champion.championKey, champion.championKey?.toLowerCase(), String(champion.championId)].filter((key): key is string => Boolean(key));
  for (const key of keys) {
    const skinNum = overrides[key];
    if (typeof skinNum === "number" && Number.isInteger(skinNum) && skinNum >= 0 && skinNum <= 1000) return skinNum;
  }
  return 0;
}

function sortedJson(value: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
}

function pruneMapToMax<K, V>(cache: Map<K, V>, maxSize: number): void {
  while (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value as K | undefined;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

function retryAfterSeconds(until: number): string {
  return String(Math.max(1, Math.ceil((until - Date.now()) / 1000)));
}

function staticEtag(size: number, mtimeMs: number): string {
  return `"${size.toString(16)}-${Math.trunc(mtimeMs).toString(16)}"`;
}

function isNotModified(req: IncomingMessage, etag: string, mtime: Date): boolean {
  const ifNoneMatch = req.headers?.["if-none-match"];
  if (typeof ifNoneMatch === "string" && ifNoneMatch.split(",").map((value) => value.trim()).includes(etag)) return true;
  const ifModifiedSince = req.headers?.["if-modified-since"];
  if (typeof ifModifiedSince !== "string") return false;
  const since = Date.parse(ifModifiedSince);
  return Number.isFinite(since) && mtime.getTime() <= since;
}

async function sendStaticFile(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  extraHeaders: Record<string, string> = {},
  mountPath?: "/admin" | "/dashboard" | "/overlay"
): Promise<void> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("not found");
    const isDashboardHtml = filePath.endsWith("index.html")
      && (mountPath === "/admin" || mountPath === "/dashboard" || filePath.includes(`${path.sep}dashboard${path.sep}`));
    const cspNonce = isDashboardHtml ? crypto.randomBytes(18).toString("base64url") : undefined;
    const etag = staticEtag(stat.size, stat.mtimeMs);
    const lastModified = stat.mtime.toUTCString();
    const publicMetadata = ["robots.txt", "sitemap.xml", "favicon.png", "favicon.svg"].includes(path.basename(filePath));
    const cacheControl = cspNonce
      ? "no-store"
      : filePath.endsWith("index.html")
      ? "no-cache"
      : publicMetadata
        ? "public, max-age=3600"
        : "public, max-age=31536000, immutable";
    const baseHeaders = {
      "Content-Type": contentTypeFor(filePath),
      "Cache-Control": cacheControl,
      ...(cspNonce ? {} : { "ETag": etag, "Last-Modified": lastModified }),
      ...staticSecurityHeaders(req, filePath, mountPath, cspNonce),
      ...extraHeaders
    };
    if (!cspNonce && isNotModified(req, etag, stat.mtime)) {
      res.writeHead(304, baseHeaders);
      res.end();
      return;
    }
    const fileBody = await fs.readFile(filePath);
    const body = cspNonce
      ? Buffer.from(fileBody.toString("utf8").replaceAll(DASHBOARD_CSP_NONCE_PLACEHOLDER, cspNonce), "utf8")
      : fileBody;
    res.writeHead(200, baseHeaders);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
    res.end(req.method === "HEAD" ? undefined : JSON.stringify({ error: "not found" }));
  }
}

function decodeUrlPathSegment(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function sendInvalidStaticPath(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(400, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
  res.end(req.method === "HEAD" ? undefined : JSON.stringify({ error: "잘못된 정적 파일 경로입니다." }));
}

async function sendRankedEmblemAsset(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  logger?: Pick<JsonlLogger, "error">
): Promise<boolean> {
  const match = /^\/riot\/ranked-emblems\/([a-z]+)\.png$/i.exec(pathname);
  if (!match?.[1]) return false;
  try {
    const filePath = await rankedEmblemAssetPath(match[1]);
    if (!filePath) {
      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
      res.end(req.method === "HEAD" ? undefined : JSON.stringify({ error: "not found" }));
      return true;
    }
    await sendStaticFile(req, res, filePath);
    return true;
  } catch (error) {
    logger?.error({
      type: "riot.ranked_emblem_asset_failed",
      tier: match[1].toUpperCase(),
      error: toSafeErrorMessage(error)
    });
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
    res.end(req.method === "HEAD" ? undefined : JSON.stringify({ error: "랭크 아이콘을 불러오지 못했습니다." }));
    return true;
  }
}

async function sendStaticApp(req: IncomingMessage, res: ServerResponse, pathname: string, mountPath: "/admin" | "/dashboard" | "/overlay", staticDir: string): Promise<boolean> {
  if (pathname !== mountPath && !pathname.startsWith(`${mountPath}/`)) return false;
  if (pathname === `${mountPath}/config.js`) {
    const body = mountPath === "/overlay" ? overlayRuntimeConfig(req) : dashboardRuntimeConfig(req);
    res.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Cloudflare-CDN-Cache-Control": "no-store",
      "Pragma": "no-cache",
      "Expires": "0",
      ...securityHeadersForRequest(req)
    });
    if (req.method === "HEAD") {
      res.end();
      return true;
    }
    res.end(body);
    return true;
  }
  const relative = pathname === mountPath || pathname === `${mountPath}/`
    ? "index.html"
    : decodeUrlPathSegment(pathname.slice(mountPath.length + 1));
  if (relative === undefined) {
    sendInvalidStaticPath(req, res);
    return true;
  }
  if (relative && !path.extname(relative)) {
    await sendStaticFile(req, res, path.resolve(staticDir, "index.html"), {}, mountPath);
    return true;
  }
  const normalized = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = path.resolve(staticDir, normalized);
  const root = path.resolve(staticDir);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
    res.end(JSON.stringify({ error: "forbidden" }));
    return true;
  }
  await sendStaticFile(req, res, candidate, {}, mountPath);
  return true;
}

const PUBLIC_DASHBOARD_ASSETS = new Map([
  ["/favicon.png", "favicon.png"],
  ["/favicon.svg", "favicon.svg"],
  ["/robots.txt", "robots.txt"],
  ["/sitemap.xml", "sitemap.xml"]
]);

async function sendPublicDashboardAsset(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  const relativePath = PUBLIC_DASHBOARD_ASSETS.get(pathname);
  if (!relativePath) return false;
  await sendStaticFile(req, res, path.resolve(appConfig.paths.dashboardStatic, relativePath));
  return true;
}

async function sendOverlayAlertAsset(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  if (!pathname.startsWith("/alerts/")) return false;
  const uploadPrefix = "/alerts/uploads/";
  const root = pathname.startsWith(uploadPrefix)
    ? path.resolve(alertAssetRoot())
    : path.resolve(appConfig.paths.overlayStatic, "alerts");
  const relative = decodeUrlPathSegment(pathname.slice(pathname.startsWith(uploadPrefix) ? uploadPrefix.length : "/alerts/".length));
  if (relative === undefined) {
    sendInvalidStaticPath(req, res);
    return true;
  }
  const normalized = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = path.resolve(root, normalized);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
    res.end(JSON.stringify({ error: "forbidden" }));
    return true;
  }
  await sendStaticFile(req, res, candidate);
  return true;
}

async function sendCommunityAsset(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  const uploadPrefix = "/community/uploads/";
  if (!pathname.startsWith(uploadPrefix)) return false;
  const root = communityAssetRoot();
  const relative = decodeUrlPathSegment(pathname.slice(uploadPrefix.length));
  if (relative === undefined) {
    sendInvalidStaticPath(req, res);
    return true;
  }
  const normalized = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  const candidate = path.resolve(root, normalized);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
    res.end(JSON.stringify({ error: "forbidden" }));
    return true;
  }
  await sendStaticFile(req, res, candidate);
  return true;
}

async function sendLocalTtsAsset(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  const configuredPath = appConfig.localTts.publicPath.trim().replace(/\/+$/, "") || "/tts";
  const publicPath = configuredPath.startsWith("/") ? configuredPath : `/${configuredPath}`;
  if (pathname !== publicPath && !pathname.startsWith(`${publicPath}/`)) return false;
  const relative = decodeUrlPathSegment(pathname.slice(publicPath.length + 1));
  if (relative === undefined) {
    sendInvalidStaticPath(req, res);
    return true;
  }
  const normalized = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  const root = path.resolve(appConfig.localTts.cacheDir);
  const candidate = path.resolve(root, normalized);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS });
    res.end(JSON.stringify({ error: "forbidden" }));
    return true;
  }
  await sendStaticFile(req, res, candidate);
  return true;
}

function sendSafeOAuthHtml(res: ServerResponse, status: number, title: string, message: string): void {
  const dashboardUrl = escapeHtml(appConfig.dashboardBaseUrl);
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS });
  res.end(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f7fb; color: #1f2937; }
      main { max-width: 560px; margin: 12vh auto; padding: 28px; background: #fff; border: 1px solid #e4e7ec; border-radius: 8px; }
      a { color: #2563eb; font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <p><a href="${dashboardUrl}">대시보드로 돌아가기</a></p>
    </main>
  </body>
</html>`);
}

function twitchOAuthErrorMessage(url: URL, fallback: string): string {
  const error = url.searchParams.get("error")?.trim();
  const description = url.searchParams.get("error_description")?.trim();
  const detail = [error, description].filter((value): value is string => Boolean(value)).join(": ");
  return detail ? `${fallback} Twitch 응답: ${detail}` : fallback;
}

type HttpHandlerInput = {
  store: Store;
  actions: ActionDispatcher;
  twitch?: TwitchApiClient;
  riot?: RiotApiClient;
  dataDragon?: DataDragonService;
  profileRepository?: LolProfileRepository;
  twitchAuth: TwitchAuthService;
  streamerFollowerAuth?: StreamerFollowerAuthService;
  publicTwitchAuth?: PublicTwitchAuthService;
  eventSub?: TwitchEventSubClient;
  logger?: Pick<JsonlLogger, "error"> & Partial<Pick<JsonlLogger, "event">>;
  refreshLolProfile?: (entryId: string, streamerId?: string) => Promise<boolean>;
  sessions?: DashboardSessionStore;
  supportMailbox?: SupportMailboxStore;
  readiness?: ReadinessCheck;
  isShuttingDown?: () => boolean;
  connectionStatus?: () => DashboardServerStatus["connections"];
  disconnectStreamerDashboard?: (twitchUserId: string) => void;
  overlayStatusForStreamer?: (twitchUserId: string) => OverlayStatus;
};

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function safeMatchStat(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function safeOptionalStat(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.max(0, Math.trunc(number));
}

function safeOptionalPercent(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.max(0, Math.min(100, Math.round(number * 100)));
}

function participantKda(participant: RiotMatchParticipant): number {
  const kills = safeMatchStat(participant.kills);
  const deaths = safeMatchStat(participant.deaths);
  const assists = safeMatchStat(participant.assists);
  return roundTo((kills + assists) / Math.max(1, deaths), 2);
}

function participantCs(participant: RiotMatchParticipant): number | undefined {
  const total = safeMatchStat(participant.totalMinionsKilled) + safeMatchStat(participant.neutralMinionsKilled);
  return total > 0 ? total : undefined;
}

function matchDurationSeconds(match: RiotMatch): number | undefined {
  const seconds = safeOptionalStat(match.info.gameDuration);
  return seconds && seconds > 0 ? seconds : undefined;
}

function matchDurationMinutes(match: RiotMatch): number | undefined {
  const seconds = matchDurationSeconds(match);
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  return seconds / 60;
}

function matchStartedAt(match: RiotMatch): string | undefined {
  if (!match.info.gameCreation) return undefined;
  const date = new Date(match.info.gameCreation);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function fallbackChampion(championId: number, fallbackName?: string): LolChampionSummary {
  return {
    championId,
    championKey: fallbackName,
    nameKo: `Champion ${championId}`
  };
}

function publicWinRate(wins: number, games: number): number {
  return games > 0 ? Math.round((wins / games) * 100) : 0;
}

function averageDefined(values: Array<number | undefined>, digits = 1): number | undefined {
  const numbers = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
  if (numbers.length === 0) return undefined;
  return roundTo(numbers.reduce((sum, value) => sum + value, 0) / numbers.length, digits);
}

function itemIconUrl(version: string | undefined, itemId: number): string | undefined {
  return version ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png` : undefined;
}

function participantItems(participant: RiotMatchParticipant, version: string | undefined): Array<{ slot: number; itemId: number; iconUrl?: string }> {
  return [participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5, participant.item6]
    .map((value, slot) => ({ slot, itemId: safeMatchStat(value) }))
    .filter((item) => item.itemId > 0)
    .map((item) => ({ ...item, iconUrl: itemIconUrl(version, item.itemId) }));
}

function participantSummonerSpells(participant: RiotMatchParticipant): number[] {
  return [safeMatchStat(participant.summoner1Id), safeMatchStat(participant.summoner2Id)].filter((spellId) => spellId > 0);
}

const STAT_SHARD_SUMMARIES: Record<number, LolRuneSummary> = {
  5008: {
    runeId: 5008,
    nameKo: "적응형 능력치",
    nameJa: "アダプティブフォース",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAdaptiveForceIcon.png"
  },
  5005: {
    runeId: 5005,
    nameKo: "공격 속도",
    nameJa: "攻撃速度",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAttackSpeedIcon.png"
  },
  5007: {
    runeId: 5007,
    nameKo: "스킬 가속",
    nameJa: "スキルヘイスト",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsCDRScalingIcon.png"
  },
  5001: {
    runeId: 5001,
    nameKo: "체력 증가",
    nameJa: "体力増加",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png"
  },
  5011: {
    runeId: 5011,
    nameKo: "체력",
    nameJa: "体力",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png"
  },
  5002: {
    runeId: 5002,
    nameKo: "방어력",
    nameJa: "物理防御",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsArmorIcon.png"
  },
  5003: {
    runeId: 5003,
    nameKo: "마법 저항력",
    nameJa: "魔法防御",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsMagicResIcon.png"
  }
};

function statShardSummary(runeId: number): LolRuneSummary {
  return STAT_SHARD_SUMMARIES[runeId] ?? { runeId };
}

function participantRuneIds(participant: RiotMatchParticipant): Array<Pick<PublicLolMatchRune, "runeId" | "kind" | "category">> {
  const styles = participant.perks?.styles ?? [];
  const primary = styles.find((style) => style.description === "primaryStyle") ?? styles[0];
  const secondary = styles.find((style) => style.description === "subStyle") ?? styles[1];
  const runes: Array<Pick<PublicLolMatchRune, "runeId" | "kind" | "category">> = [];
  const primaryStyleId = safeMatchStat(primary?.style);
  if (primaryStyleId > 0) runes.push({ runeId: primaryStyleId, kind: "primary", category: "style" });
  for (const [index, selection] of (primary?.selections ?? []).entries()) {
    const runeId = safeMatchStat(selection.perk);
    if (runeId > 0) runes.push({ runeId, kind: "primary", category: index === 0 ? "keystone" : "perk" });
  }
  const secondaryStyleId = safeMatchStat(secondary?.style);
  if (secondaryStyleId > 0) runes.push({ runeId: secondaryStyleId, kind: "secondary", category: "style" });
  for (const selection of secondary?.selections ?? []) {
    const runeId = safeMatchStat(selection.perk);
    if (runeId > 0) runes.push({ runeId, kind: "secondary", category: "perk" });
  }
  const statPerks = participant.perks?.statPerks;
  const offenseShardId = safeMatchStat(statPerks?.offense);
  const flexShardId = safeMatchStat(statPerks?.flex);
  const defenseShardId = safeMatchStat(statPerks?.defense);
  if (offenseShardId > 0) runes.push({ runeId: offenseShardId, kind: "stat", category: "offense" });
  if (flexShardId > 0) runes.push({ runeId: flexShardId, kind: "stat", category: "flex" });
  if (defenseShardId > 0) runes.push({ runeId: defenseShardId, kind: "stat", category: "defense" });
  const seen = new Set<string>();
  return runes.filter((rune) => {
    const key = `${rune.kind}:${rune.category}:${rune.runeId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function participantRunes(
  dataDragon: DataDragonService | undefined,
  dataDragonVersion: string | undefined,
  participant: RiotMatchParticipant
): Promise<PublicLolMatchRune[]> {
  const runeIds = participantRuneIds(participant);
  if (runeIds.length === 0) return [];
  if (!dataDragon) return runeIds.map((rune) => ({
    ...(rune.kind === "stat" ? statShardSummary(rune.runeId) : {}),
    runeId: rune.runeId,
    kind: rune.kind,
    category: rune.category
  }));
  const summaries = await dataDragon.mapRuneSummaries(runeIds.map((rune) => rune.runeId), dataDragonVersion).catch(() => []);
  return runeIds.map((rune, index) => ({
    ...(rune.kind === "stat" ? statShardSummary(rune.runeId) : summaries[index]),
    runeId: rune.runeId,
    kind: rune.kind,
    category: rune.category
  }));
}

function participantRiotId(participant: RiotMatchParticipant): string | undefined {
  if (participant.riotIdGameName && participant.riotIdTagline) return `${participant.riotIdGameName}#${participant.riotIdTagline}`;
  return participant.summonerName;
}

function teamObjectiveKills(match: RiotMatch, teamId: number | undefined): Record<string, number> {
  const objectives = match.info.teams?.find((team) => team.teamId === teamId)?.objectives ?? {};
  return Object.fromEntries(Object.entries(objectives).map(([key, value]) => [key, safeMatchStat(value?.kills)]));
}

function participantTeamSummary(match: RiotMatch, participant: RiotMatchParticipant): PublicLolRecentMatch["team"] | undefined {
  const teamId = participant.teamId;
  if (teamId === undefined) return undefined;
  const teammates = match.info.participants.filter((item) => item.teamId === teamId);
  if (teammates.length === 0) return undefined;
  return {
    teamId,
    kills: teammates.reduce((sum, item) => sum + safeMatchStat(item.kills), 0),
    deaths: teammates.reduce((sum, item) => sum + safeMatchStat(item.deaths), 0),
    goldEarned: teammates.reduce((sum, item) => sum + safeMatchStat(item.goldEarned), 0),
    damageDealtToChampions: teammates.reduce((sum, item) => sum + safeMatchStat(item.totalDamageDealtToChampions), 0),
    objectives: teamObjectiveKills(match, teamId)
  };
}

function participantTeamDetailStats(match: RiotMatch, teamId: number): Omit<PublicLolMatchTeamDetail, "players" | "result"> {
  const teammates = match.info.participants.filter((item) => item.teamId === teamId);
  return {
    teamId,
    kills: teammates.reduce((sum, item) => sum + safeMatchStat(item.kills), 0),
    deaths: teammates.reduce((sum, item) => sum + safeMatchStat(item.deaths), 0),
    assists: teammates.reduce((sum, item) => sum + safeMatchStat(item.assists), 0),
    goldEarned: teammates.reduce((sum, item) => sum + safeMatchStat(item.goldEarned), 0),
    damageDealtToChampions: teammates.reduce((sum, item) => sum + safeMatchStat(item.totalDamageDealtToChampions), 0),
    damageDealtToObjectives: teammates.reduce((sum, item) => sum + safeMatchStat(item.totalDamageDealtToObjectives), 0),
    damageTaken: teammates.reduce((sum, item) => sum + safeMatchStat(item.totalDamageTaken), 0),
    objectives: teamObjectiveKills(match, teamId)
  };
}

function participantDamageShare(match: RiotMatch, participant: RiotMatchParticipant): number | undefined {
  const participantDamage = safeOptionalStat(participant.totalDamageDealtToChampions);
  if (participantDamage === undefined || participant.teamId === undefined) return undefined;
  const teamDamage = match.info.participants
    .filter((item) => item.teamId === participant.teamId)
    .reduce((sum, item) => sum + safeMatchStat(item.totalDamageDealtToChampions), 0);
  if (teamDamage <= 0) return undefined;
  return roundTo((participantDamage / teamDamage) * 100, 1);
}

function statShare(value: number | undefined, total: number): number | undefined {
  if (value === undefined || total <= 0) return undefined;
  return roundTo((value / total) * 100, 1);
}

function participantKillParticipation(match: RiotMatch, participant: RiotMatchParticipant): number | undefined {
  const challengeValue = safeOptionalPercent(participant.challenges?.killParticipation);
  if (challengeValue !== undefined) return challengeValue;
  if (participant.teamId === undefined) return undefined;
  const teamKills = match.info.participants
    .filter((item) => item.teamId === participant.teamId)
    .reduce((sum, item) => sum + safeMatchStat(item.kills), 0);
  if (teamKills <= 0) return undefined;
  const participation = safeMatchStat(participant.kills) + safeMatchStat(participant.assists);
  return roundTo((participation / teamKills) * 100, 0);
}

function participantDamageTakenShare(match: RiotMatch, participant: RiotMatchParticipant): number | undefined {
  if (participant.teamId === undefined) return undefined;
  const teamTaken = match.info.participants
    .filter((item) => item.teamId === participant.teamId)
    .reduce((sum, item) => sum + safeMatchStat(item.totalDamageTaken), 0);
  return statShare(safeOptionalStat(participant.totalDamageTaken), teamTaken);
}

function participantObjectiveDamageShare(match: RiotMatch, participant: RiotMatchParticipant): number | undefined {
  if (participant.teamId === undefined) return undefined;
  const teamObjectiveDamage = match.info.participants
    .filter((item) => item.teamId === participant.teamId)
    .reduce((sum, item) => sum + safeMatchStat(item.totalDamageDealtToObjectives), 0);
  return statShare(safeOptionalStat(participant.totalDamageDealtToObjectives), teamObjectiveDamage);
}

function participantImpactScore(match: RiotMatch, participant: RiotMatchParticipant): number {
  const durationMinutes = matchDurationMinutes(match);
  const cs = participantCs(participant);
  const csPerMinute = cs !== undefined && durationMinutes ? cs / durationMinutes : 0;
  const visionScore = safeOptionalStat(participant.visionScore);
  const visionScorePerMinute = averageDefined([participant.challenges?.visionScorePerMinute], 2) ?? (visionScore !== undefined && durationMinutes ? visionScore / durationMinutes : 0);
  const kills = safeMatchStat(participant.kills);
  const deaths = safeMatchStat(participant.deaths);
  const assists = safeMatchStat(participant.assists);
  const objectiveScore =
    safeMatchStat(participant.turretKills) +
    safeMatchStat(participant.inhibitorKills) * 2 +
    safeMatchStat(participant.objectivesStolen) * 3;
  const rawScore =
    34 +
    Math.min(24, kills * 2.2 + assists * 0.9) -
    deaths * 2.8 +
    Math.min(22, participantKda(participant) * 2.4) +
    (participantKillParticipation(match, participant) ?? 0) * 0.12 +
    (participantDamageShare(match, participant) ?? 0) * 0.22 +
    Math.min(10, csPerMinute * 1.1) +
    Math.min(8, visionScorePerMinute * 4) +
    Math.min(10, objectiveScore * 2) +
    Math.min(6, (participantDamageTakenShare(match, participant) ?? 0) * 0.1) +
    (participant.win === true ? 4 : 0) +
    (safeMatchStat(participant.largestMultiKill) >= 3 ? 4 : 0);
  return Math.round(clampNumber(rawScore, 0, 100));
}

function participantImpactRank(
  match: RiotMatch,
  participant: RiotMatchParticipant,
  filter: (item: RiotMatchParticipant) => boolean
): { rank: number; score: number } | undefined {
  const ranked = match.info.participants
    .filter(filter)
    .map((item) => ({ participant: item, score: participantImpactScore(match, item) }))
    .sort((a, b) => b.score - a.score);
  const index = ranked.findIndex((item) => item.participant.puuid === participant.puuid);
  const rankedParticipant = ranked[index];
  if (index < 0 || !rankedParticipant) return undefined;
  return { rank: index + 1, score: rankedParticipant.score };
}

function publicLolMatchBadges(match: RiotMatch, participant: RiotMatchParticipant): PublicLolMatchBadge[] {
  const badges: PublicLolMatchBadge[] = [];
  const addBadge = (badge: PublicLolMatchBadge): void => {
    if (!badges.some((item) => item.code === badge.code)) badges.push(badge);
  };
  const teamRank = participantImpactRank(match, participant, (item) => item.teamId === participant.teamId);
  const teamWin = participant.win ?? match.info.teams?.find((team) => team.teamId === participant.teamId)?.win;
  if (teamWin === true && teamRank?.rank === 1 && teamRank.score >= 60) {
    addBadge({ code: "mvp", score: teamRank.score, rank: teamRank.rank });
  }
  if (teamWin === false && teamRank?.rank === 1 && teamRank.score >= 55) {
    addBadge({ code: "ace", score: teamRank.score, rank: teamRank.rank });
  }

  const kills = safeMatchStat(participant.kills);
  const deaths = safeMatchStat(participant.deaths);
  const damage = safeOptionalStat(participant.totalDamageDealtToChampions);
  const damageTaken = safeOptionalStat(participant.totalDamageTaken);
  const damageShare = participantDamageShare(match, participant);
  const damageTakenShare = participantDamageTakenShare(match, participant);
  const objectiveDamageShare = participantObjectiveDamageShare(match, participant);
  const killParticipation = participantKillParticipation(match, participant);
  const visionScore = safeOptionalStat(participant.visionScore);
  const visionScorePerMinute = averageDefined([participant.challenges?.visionScorePerMinute], 2) ?? (
    visionScore !== undefined && matchDurationMinutes(match) ? roundTo(visionScore / matchDurationMinutes(match)!, 2) : undefined
  );
  const objectiveScore =
    safeMatchStat(participant.turretKills) +
    safeMatchStat(participant.inhibitorKills) * 2 +
    safeMatchStat(participant.objectivesStolen) * 3;

  if (
    safeMatchStat(participant.largestMultiKill) >= 3 ||
    (kills >= 8 && deaths <= 2 && participantKda(participant) >= 5) ||
    (kills >= 10 && (killParticipation ?? 0) >= 55)
  ) {
    addBadge({ code: "unstoppable" });
  }
  if (
    ((damageTakenShare ?? 0) >= 30 && deaths <= 5) ||
    (damageTaken !== undefined && damageTaken >= 25_000 && deaths <= 4) ||
    (damageTaken !== undefined && damageTaken >= 18_000 && deaths <= 1)
  ) {
    addBadge({ code: "tenacity" });
  }
  if (damage !== undefined && damage >= 20_000 && (damageShare ?? 0) >= 35) {
    addBadge({ code: "damage_carry" });
  }
  if (objectiveScore >= 3 || (objectiveDamageShare ?? 0) >= 40) {
    addBadge({ code: "objective" });
  }
  if ((visionScore ?? 0) >= 45 || (visionScorePerMinute ?? 0) >= 1.2) {
    addBadge({ code: "vision" });
  }
  return badges.slice(0, 4);
}

function findLaneOpponent(match: RiotMatch, participant: RiotMatchParticipant): RiotMatchParticipant | undefined {
  const position = (participant.individualPosition || participant.teamPosition || "").toUpperCase();
  if (!position || position === "INVALID" || participant.teamId === undefined) return undefined;
  return match.info.participants.find((item) => (
    item.teamId !== participant.teamId &&
    (item.individualPosition || item.teamPosition || "").toUpperCase() === position
  ));
}

const PUBLIC_LOL_ROLE_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY", "SUPPORT"] as const;

function publicLolRoleOrder(position: string | undefined): number {
  const normalized = (position ?? "").toUpperCase();
  const index = PUBLIC_LOL_ROLE_ORDER.findIndex((role) => role === normalized);
  return index >= 0 ? index : PUBLIC_LOL_ROLE_ORDER.length;
}

async function publicLolMatchParticipantDetail(
  dataDragon: DataDragonService | undefined,
  dataDragonVersion: string | undefined,
  match: RiotMatch,
  participant: RiotMatchParticipant,
  teamStats: Omit<PublicLolMatchTeamDetail, "players" | "result">,
  targetPuuid: string,
  streamerByRiotId: Map<string, PublicLolTwitchStream>
): Promise<PublicLolMatchParticipant> {
  const durationMinutes = matchDurationMinutes(match);
  const riotId = participantRiotId(participant);
  const parsedRiotId = riotId ? parseRiotIdDetailed(riotId) : undefined;
  const cs = participantCs(participant);
  const goldEarned = safeOptionalStat(participant.goldEarned);
  const damageDealtToChampions = safeOptionalStat(participant.totalDamageDealtToChampions);
  const damageDealtToObjectives = safeOptionalStat(participant.totalDamageDealtToObjectives);
  const damageTaken = safeOptionalStat(participant.totalDamageTaken);
  const visionScore = safeOptionalStat(participant.visionScore);
  return {
    participantId: safeOptionalStat(participant.participantId),
    riotId,
    isTarget: participant.puuid === targetPuuid,
    champion: await mapChampionSummary(dataDragon, {
      championId: participant.championId,
      championName: participant.championName
    }),
    twitchStream: parsedRiotId?.ok ? streamerByRiotId.get(normalizeRiotIdKey(parsedRiotId.gameName, parsedRiotId.tagLine)) : undefined,
    championLevel: safeOptionalStat(participant.champLevel),
    position: participant.individualPosition || participant.teamPosition,
    kills: safeMatchStat(participant.kills),
    deaths: safeMatchStat(participant.deaths),
    assists: safeMatchStat(participant.assists),
    kda: participantKda(participant),
    cs,
    csPerMinute: cs !== undefined && durationMinutes ? roundTo(cs / durationMinutes, 1) : undefined,
    killParticipation: participantKillParticipation(match, participant),
    goldEarned,
    goldShare: statShare(goldEarned, teamStats.goldEarned),
    damageDealtToChampions,
    damageShare: statShare(damageDealtToChampions, teamStats.damageDealtToChampions),
    damageDealtToObjectives,
    damageObjectiveShare: statShare(damageDealtToObjectives, teamStats.damageDealtToObjectives),
    damageTaken,
    damageTakenShare: statShare(damageTaken, teamStats.damageTaken),
    visionScore,
    visionScorePerMinute: averageDefined([participant.challenges?.visionScorePerMinute], 2) ?? (visionScore !== undefined && durationMinutes ? roundTo(visionScore / durationMinutes, 2) : undefined),
    items: participantItems(participant, dataDragonVersion),
    summonerSpells: participantSummonerSpells(participant),
    runes: await participantRunes(dataDragon, dataDragonVersion, participant),
    badges: publicLolMatchBadges(match, participant)
  };
}

async function publicLolMatchTeams(
  dataDragon: DataDragonService | undefined,
  dataDragonVersion: string | undefined,
  match: RiotMatch,
  targetPuuid: string,
  streamerByRiotId: Map<string, PublicLolTwitchStream>
): Promise<PublicLolMatchTeamDetail[]> {
  const teamIds = [...new Set(match.info.participants.map((participant) => participant.teamId).filter((teamId): teamId is number => teamId !== undefined))]
    .sort((a, b) => a - b);
  const teams = await Promise.all(teamIds.map(async (teamId): Promise<PublicLolMatchTeamDetail> => {
    const teamStats = participantTeamDetailStats(match, teamId);
    const teamInfo = match.info.teams?.find((team) => team.teamId === teamId);
    const players = (await Promise.all(match.info.participants
      .filter((participant) => participant.teamId === teamId)
      .map((participant) => publicLolMatchParticipantDetail(dataDragon, dataDragonVersion, match, participant, teamStats, targetPuuid, streamerByRiotId))))
      .sort((a, b) => publicLolRoleOrder(a.position) - publicLolRoleOrder(b.position));
    return {
      ...teamStats,
      result: teamInfo?.win === true ? "win" : teamInfo?.win === false ? "loss" : "unknown",
      players
    };
  }));
  return teams;
}

async function mapChampionSummary(
  dataDragon: DataDragonService | undefined,
  input: {
    championId: number;
    championName?: string;
    masteryLevel?: number;
    masteryPoints?: number;
    games?: number;
  }
): Promise<LolChampionSummary> {
  if (dataDragon) {
    return dataDragon.mapChampionSummary({
      championId: input.championId,
      championName: input.championName,
      masteryLevel: input.masteryLevel,
      masteryPoints: input.masteryPoints,
      games: input.games
    });
  }
  return {
    ...fallbackChampion(input.championId, input.championName),
    masteryLevel: input.masteryLevel,
    masteryPoints: input.masteryPoints,
    games: input.games
  };
}

async function profileIconUrl(dataDragon: DataDragonService | undefined, profileIconId: number | undefined): Promise<string | undefined> {
  if (!dataDragon || profileIconId === undefined) return undefined;
  const safeIconId = Math.max(0, Math.trunc(profileIconId));
  if (!Number.isFinite(safeIconId)) return undefined;
  const version = await dataDragonLatestVersion(dataDragon);
  return version ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${safeIconId}.png` : undefined;
}

async function dataDragonLatestVersion(dataDragon: DataDragonService | undefined): Promise<string | undefined> {
  if (!dataDragon || typeof dataDragon.getLatestVersion !== "function") return undefined;
  return dataDragon.getLatestVersion().catch(() => undefined);
}

async function dataDragonVersionForMatch(
  dataDragon: DataDragonService | undefined,
  match: RiotMatch,
  fallbackVersion: string | undefined
): Promise<string | undefined> {
  if (!dataDragon) return fallbackVersion;
  const gameVersion = match.info.gameVersion;
  if (!gameVersion) return fallbackVersion ?? dataDragonLatestVersion(dataDragon);
  return dataDragon.getVersionForGameVersion(gameVersion).catch(async () => fallbackVersion ?? dataDragonLatestVersion(dataDragon));
}

function recentWinRate(matches: PublicLolRecentMatch[]): number {
  const decided = matches.filter((match) => match.result !== "unknown");
  if (decided.length === 0) return 0;
  return Math.round((decided.filter((match) => match.result === "win").length / decided.length) * 100);
}

function kdaFromTotals(kills: number, deaths: number, assists: number): number {
  return roundTo((kills + assists) / Math.max(1, deaths), 2);
}

function championPerformance(matches: PublicLolRecentMatch[]): PublicLolChampionPerformance[] {
  const grouped = new Map<number, {
    champion: LolChampionSummary;
    games: number;
    wins: number;
    kills: number;
    deaths: number;
    assists: number;
    csPerMinute: Array<number | undefined>;
    damagePerMinute: Array<number | undefined>;
  }>();
  for (const match of matches) {
    const existing = grouped.get(match.champion.championId) ?? {
      champion: match.champion,
      games: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      csPerMinute: [],
      damagePerMinute: []
    };
    existing.games += 1;
    existing.wins += match.result === "win" ? 1 : 0;
    existing.kills += match.kills;
    existing.deaths += match.deaths;
    existing.assists += match.assists;
    existing.csPerMinute.push(match.csPerMinute);
    existing.damagePerMinute.push(match.damagePerMinute);
    grouped.set(match.champion.championId, existing);
  }
  return [...grouped.values()]
    .sort((a, b) => b.games - a.games || b.wins - a.wins || b.kills - a.kills)
    .slice(0, 5)
    .map((item) => ({
      champion: item.champion,
      games: item.games,
      wins: item.wins,
      winRate: publicWinRate(item.wins, item.games),
      averageKda: kdaFromTotals(item.kills, item.deaths, item.assists),
      averageCsPerMinute: averageDefined(item.csPerMinute, 1),
      averageDamagePerMinute: averageDefined(item.damagePerMinute, 0)
    }));
}

function rolePerformance(matches: PublicLolRecentMatch[]): PublicLolRolePerformance[] {
  const grouped = new Map<string, { role: string; games: number; wins: number; kills: number; deaths: number; assists: number }>();
  for (const match of matches) {
    const role = match.position || "UNKNOWN";
    const existing = grouped.get(role) ?? { role, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
    existing.games += 1;
    existing.wins += match.result === "win" ? 1 : 0;
    existing.kills += match.kills;
    existing.deaths += match.deaths;
    existing.assists += match.assists;
    grouped.set(role, existing);
  }
  return [...grouped.values()]
    .sort((a, b) => b.games - a.games || b.wins - a.wins)
    .map((item) => ({
      role: item.role,
      games: item.games,
      wins: item.wins,
      winRate: publicWinRate(item.wins, item.games),
      averageKda: kdaFromTotals(item.kills, item.deaths, item.assists)
    }));
}

function normalizeSuggestionText(value: string): string {
  return value.trim().normalize("NFKC").replace(/＃/g, "#").toLocaleLowerCase();
}

function publicLolSuggestionKey(gameName: string, tagLine: string): string {
  return `${gameName.trim().normalize("NFKC").toLocaleLowerCase()}#${tagLine.trim().normalize("NFKC").toLocaleLowerCase()}`;
}

function publicLolSuggestionMatches(query: string, suggestion: PublicLolSuggestion): boolean {
  const searchText = normalizeSuggestionText(query);
  if (!searchText) return false;
  const riotId = normalizeSuggestionText(suggestion.riotId);
  const gameName = normalizeSuggestionText(suggestion.gameName);
  const tagLine = normalizeSuggestionText(suggestion.tagLine);
  const tagOnly = searchText.startsWith("#") ? searchText.slice(1) : "";
  if (tagOnly) return tagLine.includes(tagOnly);
  return riotId.includes(searchText) || gameName.includes(searchText) || tagLine.includes(searchText);
}

function publicLolProfileCacheKey(gameName: string, tagLine: string): string {
  return publicLolSuggestionKey(gameName, tagLine);
}

function publicLolErrorMessage(error: unknown): string {
  if (error instanceof RiotRateLimitError || (error instanceof RiotApiHttpError && error.status === 429)) {
    return "Riot API 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.";
  }
  if (error instanceof RiotApiHttpError && (error.status === 401 || error.status === 403)) {
    return "Riot API key가 유효하지 않거나 만료되었습니다. 방송 관리 설정을 확인해주세요.";
  }
  if (error instanceof RiotApiHttpError && error.status >= 500) {
    return "Riot API가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.";
  }
  return "전적 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function publicLolCurrentGameErrorCode(error: unknown): string {
  if (error instanceof RiotRateLimitError || (error instanceof RiotApiHttpError && error.status === 429)) return "RIOT_RATE_LIMIT";
  if (error instanceof RiotApiHttpError && (error.status === 401 || error.status === 403)) return "RIOT_AUTH";
  if (error instanceof RiotApiHttpError && error.status >= 500) return "RIOT_UNAVAILABLE";
  if (error instanceof RiotApiHttpError) return "RIOT_HTTP_ERROR";
  return "RIOT_CURRENT_GAME_FAILED";
}

function publicLolMatchSortTime(match: RiotMatch): number {
  const time = Number(match.info.gameCreation);
  return Number.isFinite(time) ? time : 0;
}

function publicLolMatchStart(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(PUBLIC_LOL_PROFILE_MAX_MATCH_START, Math.trunc(number)));
}

function isPublicLolQueue(match: RiotMatch): boolean {
  return match.info.queueId === undefined || PUBLIC_LOL_PROFILE_QUEUES.includes(match.info.queueId);
}

function profileRecentMatchesForCache(matches: PublicLolRecentMatch[]): LolProfileCacheEntry["recentMatches"] {
  return matches.slice(0, 10).map((match) => ({
    championId: match.champion.championId,
    championKey: match.champion.championKey,
    nameKo: match.champion.nameKo,
    nameJa: match.champion.nameJa,
    iconUrl: match.champion.iconUrl,
    splashUrl: match.champion.splashUrl,
    loadingUrl: match.champion.loadingUrl,
    imageVersion: match.champion.imageVersion,
    imageLocale: match.champion.imageLocale,
    won: match.result === "win"
  }));
}

function safeTwitchLogin(value: string | undefined): string | undefined {
  const login = value?.trim().toLocaleLowerCase();
  return login && /^[a-z0-9_]{1,32}$/.test(login) ? login : undefined;
}

function twitchChannelUrl(login: string | undefined): string | undefined {
  return login ? `https://www.twitch.tv/${encodeURIComponent(login)}` : undefined;
}

function twitchSubscriptionTierLabel(tier: string | undefined): string {
  if (tier === "1000") return "Tier 1";
  if (tier === "2000") return "Tier 2";
  if (tier === "3000") return "Tier 3";
  return tier ? `Tier ${tier}` : "구독";
}

function defaultStreamerProfileLinkLabel(url: URL): string {
  return url.hostname.replace(/^www\./i, "").slice(0, STREAMER_PROFILE_LINK_LABEL_MAX) || "Link";
}

function streamerProfileLinkPlatform(url: URL): string {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
  if (host.endsWith("twitch.tv")) return "twitch";
  if (host === "discord.gg" || host.endsWith("discord.com")) return "discord";
  if (host === "x.com" || host.endsWith("twitter.com")) return "x";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("afreecatv.com") || host.endsWith("sooplive.co.kr")) return "soop";
  return "website";
}

function normalizedStreamerProfileLinkEntry(input: unknown, index: number): StreamerProfileLink | undefined {
  const record = typeof input === "object" && input !== null ? input as {
    id?: unknown;
    url?: unknown;
    label?: unknown;
  } : undefined;
  if (!record) {
    throw new HttpRequestError(400, { error: "프로필 링크 항목은 객체여야 합니다." });
  }
  if (record.url !== undefined && typeof record.url !== "string") {
    throw new HttpRequestError(400, { error: "프로필 링크 URL은 문자열이어야 합니다." });
  }
  if (record.label !== undefined && typeof record.label !== "string") {
    throw new HttpRequestError(400, { error: "프로필 링크 이름은 문자열이어야 합니다." });
  }
  if (record.id !== undefined && typeof record.id !== "string") {
    throw new HttpRequestError(400, { error: "프로필 링크 ID는 문자열이어야 합니다." });
  }
  const rawUrl = typeof record.url === "string" ? record.url.trim() : "";
  if (!rawUrl) return undefined;
  if (rawUrl.length > STREAMER_PROFILE_LINK_URL_MAX) {
    throw new HttpRequestError(400, { error: "프로필 링크 URL은 2048자 이하여야 합니다." });
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new HttpRequestError(400, { error: "프로필 링크 URL 형식이 올바르지 않습니다." });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new HttpRequestError(400, { error: "프로필 링크는 http 또는 https URL만 사용할 수 있습니다." });
  }
  if (parsed.username || parsed.password) {
    throw new HttpRequestError(400, { error: "프로필 링크에는 사용자 인증 정보를 포함할 수 없습니다." });
  }
  const rawId = typeof record.id === "string" ? record.id.trim() : "";
  const rawLabel = typeof record.label === "string" ? record.label.trim() : "";
  return {
    id: (rawId || `plink_${crypto.randomBytes(8).toString("hex")}_${index}`).slice(0, 80),
    url: parsed.toString(),
    label: (rawLabel || defaultStreamerProfileLinkLabel(parsed)).slice(0, STREAMER_PROFILE_LINK_LABEL_MAX),
    platform: streamerProfileLinkPlatform(parsed)
  };
}

function normalizedStreamerProfileLink(body: {
  profileLinkUrl?: unknown;
  profileLinkLabel?: unknown;
  profileLinks?: unknown;
}): {
  profileLinkUrl?: string;
  profileLinkLabel?: string;
  profileLinks?: StreamerProfileLink[];
} {
  if (body.profileLinks !== undefined) {
    if (!Array.isArray(body.profileLinks)) {
      throw new HttpRequestError(400, { error: "profileLinks는 배열이어야 합니다." });
    }
    if (body.profileLinks.length > STREAMER_PROFILE_LINK_MAX) {
      throw new HttpRequestError(400, { error: `프로필 링크는 최대 ${STREAMER_PROFILE_LINK_MAX}개까지 등록할 수 있습니다.` });
    }
    const profileLinks = body.profileLinks
      .map((item, index) => normalizedStreamerProfileLinkEntry(item, index))
      .filter((item): item is StreamerProfileLink => Boolean(item));
    return {
      profileLinkUrl: profileLinks[0]?.url,
      profileLinkLabel: profileLinks[0]?.label,
      profileLinks
    };
  }
  if (body.profileLinkUrl !== undefined && typeof body.profileLinkUrl !== "string") {
    throw new HttpRequestError(400, { error: "profileLinkUrl은 문자열이어야 합니다." });
  }
  if (body.profileLinkLabel !== undefined && typeof body.profileLinkLabel !== "string") {
    throw new HttpRequestError(400, { error: "profileLinkLabel은 문자열이어야 합니다." });
  }
  const rawUrl = body.profileLinkUrl?.trim() ?? "";
  const rawLabel = body.profileLinkLabel?.trim() ?? "";
  if (!rawUrl) return {};
  const profileLink = normalizedStreamerProfileLinkEntry({ url: rawUrl, label: rawLabel }, 0);
  return {
    profileLinkUrl: profileLink?.url,
    profileLinkLabel: profileLink?.label,
    profileLinks: profileLink ? [profileLink] : []
  };
}

function publicLolTwitchStreamFromCandidate(
  candidate: PublicLolTwitchCandidate,
  stream: TwitchStreamStatus | undefined,
  profile: { login?: string; displayName?: string; profileImageUrl?: string } | undefined,
  fallbackLive = false
): PublicLolTwitchStream {
  const login = stream?.userLogin || profile?.login || candidate.twitchLogin || safeTwitchLogin(candidate.twitchDisplayName);
  return {
    matched: true,
    isLive: Boolean(stream || fallbackLive),
    twitchUserId: stream?.userId || candidate.twitchUserId,
    twitchLogin: login,
    twitchDisplayName: stream?.userName || profile?.displayName || candidate.twitchDisplayName,
    profileImageUrl: profile?.profileImageUrl || candidate.profileImageUrl,
    profileLinkUrl: candidate.profileLinkUrl,
    profileLinkLabel: candidate.profileLinkLabel,
    profileLinks: candidate.profileLinks,
    channelUrl: twitchChannelUrl(login),
    title: stream?.title,
    gameName: stream?.gameName,
    viewerCount: stream?.viewerCount,
    startedAt: stream?.startedAt,
    thumbnailUrl: stream?.thumbnailUrl,
    source: candidate.source
  };
}

export function createHttpHandler(input: HttpHandlerInput) {
  const sessions = input.sessions ?? new DashboardSessionStore();
  const communityModeration = new CommunityModerationService(input.store);
  const followerRefreshByBroadcaster = new Map<string, FollowerRefreshRuntime>();
  let streamerProfileRefreshInFlight: Promise<ParticipationStreamerProfile | undefined> | undefined;
  let streamerProfileRefreshAvailableAt = 0;
  let streamerProfileRefreshKey = "";
  let lastStreamerProfileRefresh: ParticipationStreamerProfile | undefined;
  const entryProfileRefreshInFlight = new Map<string, Promise<boolean>>();
  const entryProfileRefreshAvailableAt = new Map<string, number>();
  const skinOptionsCache = new Map<string, { expiresAt: number; response: SkinOptionsResponse }>();
  const skinOptionsInFlight = new Map<string, Promise<SkinOptionsResponse>>();
  const publicLolSuggestionCache = new Map<string, PublicLolSuggestion>();
  const publicLolProfileCache = new Map<string, { expiresAt: number; response: PublicLolProfileResponse }>();
  const publicLolProfileInFlight = new Map<string, Promise<PublicLolProfileResponse>>();
  const publicLolProfileRefreshAvailableAt = new Map<string, number>();
  const publicLolProfileCacheGeneration = new Map<string, number>();
  const publicLolProfilePuuidCache = new Map<string, string>();
  const publicLolCurrentGameCache = new Map<string, { expiresAt: number; response: PublicLolCurrentGame }>();
  const publicLolCurrentGameInFlight = new Map<string, Promise<PublicLolCurrentGame>>();
  const publicLolMatchPageCache = new Map<string, { expiresAt: number; response: PublicLolMatchPageResponse }>();
  const publicLolMatchPageInFlight = new Map<string, Promise<PublicLolMatchPageResponse>>();
  const publicLolMatchRankCache = new Map<string, { expiresAt: number; response: PublicLolMatchRankResponse }>();
  const publicLolMatchRankInFlight = new Map<string, Promise<PublicLolMatchRankResponse>>();
  const publicLolMatchBuildCache = new Map<string, { expiresAt: number; response: PublicLolMatchBuildResponse }>();
  const publicLolMatchBuildInFlight = new Map<string, Promise<PublicLolMatchBuildResponse>>();
  const publicLolMatchDetailCache = new Map<string, { expiresAt: number; match: RiotMatch }>();
  const publicLolMatchDetailInFlight = new Map<string, Promise<RiotMatch | null>>();

  async function getTwitchStatus() {
    const status = await input.twitchAuth.getStatus();
    if (status.refreshed && status.connected) {
      input.eventSub?.reconnect("twitch.oauth.auto_refreshed");
    }
    return {
      ...status,
      eventSub: input.store.getTwitchEventSubStatus(),
      chat: input.store.getTwitchChatStatus()
    };
  }

  function twitchEventSubLiveFallback(twitchUserId: string | undefined): boolean {
    const storeWithLiveStatus = input.store as Store & {
      getTwitchStreamLiveStatus?: (twitchUserId: string | undefined) => { isLive: boolean; updatedAt: string } | undefined;
    };
    const status = typeof storeWithLiveStatus.getTwitchStreamLiveStatus === "function"
      ? storeWithLiveStatus.getTwitchStreamLiveStatus(twitchUserId)
      : undefined;
    if (!status?.isLive) return false;
    const updatedAt = Date.parse(status.updatedAt);
    if (!Number.isFinite(updatedAt)) return false;
    return Date.now() - updatedAt <= TWITCH_STREAM_EVENTSUB_LIVE_FALLBACK_MAX_AGE_MS;
  }

  function rememberTwitchStreamLiveStatus(status: {
    twitchUserId: string;
    isLive: boolean;
    source: "eventsub" | "snapshot";
  }): void {
    const storeWithLiveStatus = input.store as Store & {
      setTwitchStreamLiveStatus?: (input: {
        twitchUserId: string;
        isLive: boolean;
        source: "eventsub" | "snapshot";
      }) => void;
    };
    if (typeof storeWithLiveStatus.setTwitchStreamLiveStatus !== "function") return;
    storeWithLiveStatus.setTwitchStreamLiveStatus(status);
  }

  async function lookupTwitchStreamByUserId(twitchUserId: string): Promise<TwitchStreamStatus | undefined> {
    if (typeof input.twitch?.getStreamByUserId !== "function") return undefined;
    try {
      const stream = await input.twitch.getStreamByUserId(twitchUserId);
      rememberTwitchStreamLiveStatus({
        twitchUserId,
        isLive: Boolean(stream),
        source: "snapshot"
      });
      return stream;
    } catch (error) {
      input.logger?.error({
        type: "public_lol.twitch_stream_lookup_failed",
        twitchUserId,
        error: toSafeErrorMessage(error)
      });
      return undefined;
    }
  }

  async function isPublicParticipationStreamerLive(twitchUserId: string): Promise<boolean> {
    if (twitchEventSubLiveFallback(twitchUserId)) return true;
    return Boolean(await lookupTwitchStreamByUserId(twitchUserId));
  }

  async function lookupTwitchStreamForCandidate(candidate: PublicLolTwitchCandidate): Promise<TwitchStreamStatus | undefined> {
    const streamById = await lookupTwitchStreamByUserId(candidate.twitchUserId);
    if (streamById) return streamById;
    const login = safeTwitchLogin(candidate.twitchLogin);
    if (!login || typeof input.twitch?.getStreamByUserLogin !== "function") return undefined;
    try {
      const streamByLogin = await input.twitch.getStreamByUserLogin(login);
      if (streamByLogin) {
        rememberTwitchStreamLiveStatus({
          twitchUserId: candidate.twitchUserId,
          isLive: true,
          source: "snapshot"
        });
        if (streamByLogin.userId !== candidate.twitchUserId) {
          rememberTwitchStreamLiveStatus({
            twitchUserId: streamByLogin.userId,
            isLive: true,
            source: "snapshot"
          });
        }
      }
      return streamByLogin;
    } catch (error) {
      input.logger?.error({
        type: "public_lol.twitch_stream_login_lookup_failed",
        twitchUserId: candidate.twitchUserId,
        twitchLogin: login,
        error: toSafeErrorMessage(error)
      });
      return undefined;
    }
  }

  function rememberPublicLolSuggestion(profile: Pick<PublicLolProfileResponse, "riotId" | "gameName" | "tagLine" | "profileIconUrl" | "summonerLevel" | "lolPlatform" | "rankedStats" | "fetchedAt">): void {
    const key = publicLolSuggestionKey(profile.gameName, profile.tagLine);
    publicLolSuggestionCache.set(key, {
      riotId: profile.riotId,
      gameName: profile.gameName,
      tagLine: profile.tagLine,
      source: "recent",
      profileIconUrl: profile.profileIconUrl,
      summonerLevel: profile.summonerLevel,
      lolPlatform: profile.lolPlatform,
      rankedStats: profile.rankedStats ? { ...profile.rankedStats } : undefined,
      lastSeenAt: profile.fetchedAt
    });
    if (publicLolSuggestionCache.size <= 100) return;
    const oldestKey = [...publicLolSuggestionCache.entries()]
      .sort((a, b) => Date.parse(a[1].lastSeenAt) - Date.parse(b[1].lastSeenAt))[0]?.[0];
    if (oldestKey) publicLolSuggestionCache.delete(oldestKey);
  }

  async function profileCacheEntryToSuggestion(profile: LolProfileCacheEntry): Promise<PublicLolSuggestion> {
    return {
      riotId: `${profile.riotGameName}#${profile.riotTagLine}`,
      gameName: profile.riotGameName,
      tagLine: profile.riotTagLine,
      source: "recent",
      profileIconUrl: await profileIconUrl(input.dataDragon, profile.rankedStats?.profileIconId),
      summonerLevel: profile.rankedStats?.summonerLevel,
      lolPlatform: input.riot?.routingStatus().lolPlatform,
      rankedStats: profile.rankedStats ? { ...profile.rankedStats } : undefined,
      lastSeenAt: profile.analyzedAt ?? new Date(0).toISOString()
    };
  }

  function rememberPublicLolProfile(profile: PublicLolProfileResponse, accountPuuid: string): void {
    rememberPublicLolSuggestion(profile);
    const repository = input.profileRepository;
    if (!repository) return;
    const existing = repository.getByPuuid(accountPuuid) ?? repository.getByRiotId(profile.gameName, profile.tagLine);
    repository.save({
      riotPuuid: accountPuuid,
      riotGameName: profile.gameName,
      riotTagLine: profile.tagLine,
      riotIdKey: publicLolProfileCacheKey(profile.gameName, profile.tagLine),
      status: "ready",
      mainRole: profile.roleAnalysis?.mainRole,
      mainRoleConfidence: profile.roleAnalysis?.confidence,
      ladderRank: profile.ladderRank ?? existing?.ladderRank,
      topChampions: profile.topChampions.map((champion) => ({ ...champion })),
      rankedStats: profile.rankedStats ? { ...profile.rankedStats } : undefined,
      performanceStats: profile.performanceStats ? { ...profile.performanceStats } : undefined,
      recentMatches: profileRecentMatchesForCache(profile.recentMatches),
      rankHistory: profile.rankHistory?.map((point) => ({ ...point })) ?? existing?.rankHistory,
      championSkinOverridesKey: existing?.championSkinOverridesKey,
      analyzedAt: profile.fetchedAt
    });
  }

  async function buildPublicLolTwitchStream(gameName: string, tagLine: string): Promise<PublicLolTwitchStream | undefined> {
    const riotIdKey = normalizeRiotIdKey(gameName, tagLine);
    const candidates = new Map<string, PublicLolTwitchCandidate>();
    const participationQueue = typeof input.store.getParticipationQueue === "function" ? input.store.getParticipationQueue() : [];

    for (const entry of participationQueue) {
      if (normalizeRiotIdKey(entry.riotGameName, entry.riotTagLine) !== riotIdKey) continue;
      candidates.set(entry.twitchUserId, {
        twitchUserId: entry.twitchUserId,
        twitchLogin: safeTwitchLogin(entry.twitchUserName),
        twitchDisplayName: entry.twitchUserName,
        source: "participation"
      });
    }

    for (const request of listApprovedStreamerRiotIds()) {
      if (request.normalizedRiotId !== riotIdKey) continue;
      candidates.set(request.twitchUserId, {
        twitchUserId: request.twitchUserId,
        twitchLogin: request.twitchLogin,
        twitchDisplayName: request.twitchDisplayName,
        profileImageUrl: request.twitchProfileImageUrl,
        profileLinkUrl: request.profileLinkUrl,
        profileLinkLabel: request.profileLinkLabel,
        profileLinks: request.profileLinks?.map((link) => ({ ...link })),
        source: "approved_streamer"
      });
    }

    const twitchAuthStatus = typeof input.twitchAuth.getStatus === "function"
      ? await input.twitchAuth.getStatus().catch(() => undefined)
      : undefined;
    const broadcaster = twitchAuthStatus?.broadcaster;
    const monitorConfig = loadGameMonitorConfig();
    const streamerRiotId = parseRiotIdDetailed(monitorConfig.streamerRiotId);
    if (streamerRiotId.ok && normalizeRiotIdKey(streamerRiotId.gameName, streamerRiotId.tagLine) === riotIdKey) {
      if (broadcaster?.id) {
        const existing = candidates.get(broadcaster.id);
        candidates.set(broadcaster.id, {
          ...existing,
          twitchUserId: broadcaster.id,
          twitchLogin: broadcaster.login || existing?.twitchLogin,
          twitchDisplayName: broadcaster.displayName || broadcaster.login || existing?.twitchDisplayName || broadcaster.id,
          profileImageUrl: existing?.profileImageUrl || broadcaster.profileImageUrl,
          source: existing?.source === "approved_streamer" ? "approved_streamer" : "connected_streamer"
        });
      }
    }

    let offline: PublicLolTwitchStream | undefined;
    for (const candidate of candidates.values()) {
      const [stream, profile] = await Promise.all([
        lookupTwitchStreamForCandidate(candidate),
        typeof input.twitch?.getUserProfile === "function" ? input.twitch.getUserProfile(candidate.twitchUserId).catch(() => undefined) : Promise.resolve(undefined)
      ]);
      const fallbackLive = twitchEventSubLiveFallback(candidate.twitchUserId);
      const item = publicLolTwitchStreamFromCandidate(candidate, stream, profile, fallbackLive);
      if (item.isLive) return item;
      offline ??= item;
    }
    return offline;
  }

  async function buildApprovedStreamerStreamsByRiotId(riotIds: Iterable<string | undefined>): Promise<Map<string, PublicLolTwitchStream>> {
    const wantedRiotIds = new Set<string>();
    for (const riotId of riotIds) {
      if (!riotId) continue;
      const parsed = parseRiotIdDetailed(riotId);
      if (parsed.ok) wantedRiotIds.add(normalizeRiotIdKey(parsed.gameName, parsed.tagLine));
    }
    if (wantedRiotIds.size === 0) return new Map();

    const requests = listApprovedStreamerRiotIds()
      .map((request) => ({
        request,
        riotKey: request.normalizedRiotId || normalizeRiotIdKey(request.riotGameName, request.riotTagLine)
      }))
      .filter(({ riotKey }) => wantedRiotIds.has(riotKey));
    if (requests.length === 0) return new Map();

    const resolved = await Promise.all(requests.map(async ({ request, riotKey }) => {
      const candidate: PublicLolTwitchCandidate = {
        twitchUserId: request.twitchUserId,
        twitchLogin: request.twitchLogin,
        twitchDisplayName: request.twitchDisplayName,
        profileImageUrl: request.twitchProfileImageUrl,
        profileLinkUrl: request.profileLinkUrl,
        profileLinkLabel: request.profileLinkLabel,
        profileLinks: request.profileLinks?.map((link) => ({ ...link })),
        source: "approved_streamer"
      };
      const stream = await lookupTwitchStreamForCandidate(candidate);
      return {
        riotKey,
        stream: publicLolTwitchStreamFromCandidate(candidate, stream, {
          login: request.twitchLogin,
          displayName: request.twitchDisplayName,
          profileImageUrl: request.twitchProfileImageUrl
        }, twitchEventSubLiveFallback(request.twitchUserId))
      };
    }));

    const streamsByRiotId = new Map<string, PublicLolTwitchStream>();
    for (const item of resolved) {
      const existing = streamsByRiotId.get(item.riotKey);
      if (!existing || item.stream.isLive) streamsByRiotId.set(item.riotKey, item.stream);
    }
    return streamsByRiotId;
  }

  function cachedRankedStatsForRiotId(gameName: string, tagLine: string): LolRankedStats | undefined {
    const profile = input.profileRepository?.getByRiotId(gameName, tagLine);
    if (profile?.rankedStats) return { ...profile.rankedStats };
    const suggestion = publicLolSuggestionCache.get(publicLolSuggestionKey(gameName, tagLine));
    return suggestion?.rankedStats ? { ...suggestion.rankedStats } : undefined;
  }

  function listApprovedStreamerRiotIds(): StreamerRiotIdRequest[] {
    const storeWithRegistry = input.store as Store & { listApprovedStreamerRiotIds?: () => StreamerRiotIdRequest[] };
    return typeof storeWithRegistry.listApprovedStreamerRiotIds === "function"
      ? storeWithRegistry.listApprovedStreamerRiotIds()
      : [];
  }

  function approvedStreamerRiotIdForTwitchUser(twitchUserId: string | undefined): StreamerRiotIdRequest | undefined {
    if (!twitchUserId) return undefined;
    return listApprovedStreamerRiotIds().find((request) => request.twitchUserId === twitchUserId);
  }

  function streamerDashboardEnabled(request: StreamerRiotIdRequest | undefined): request is StreamerRiotIdRequest {
    return Boolean(request && request.status === "approved" && request.dashboardEnabled === true);
  }

  function dashboardEnabledStreamerRiotIdForTwitchUser(twitchUserId: string | undefined): StreamerRiotIdRequest | undefined {
    const request = approvedStreamerRiotIdForTwitchUser(twitchUserId);
    return streamerDashboardEnabled(request) ? request : undefined;
  }

  function currentStreamerRiotIdRequestForTwitchUser(twitchUserId: string | undefined): StreamerRiotIdRequest | undefined {
    if (!twitchUserId) return undefined;
    const requests = listStreamerRiotIdRequests().filter((request) => request.twitchUserId === twitchUserId);
    return requests.find((request) => request.status === "approved")
      ?? requests.find((request) => request.status === "pending")
      ?? requests[0];
  }

  function publicStreamerDashboardInfo(request: StreamerRiotIdRequest): {
    twitchUserId: string;
    twitchLogin: string;
    twitchDisplayName: string;
    twitchProfileImageUrl?: string;
    riotGameName: string;
    riotTagLine: string;
    overlaySlug?: string;
    overlayKey?: string;
    dashboardSlug?: string;
    dashboardKey?: string;
    dashboardPath?: string;
    profileLinkUrl?: string;
    profileLinkLabel?: string;
    profileLinks?: StreamerProfileLink[];
    dashboardEnabled?: boolean;
  } {
    return {
      twitchUserId: request.twitchUserId,
      twitchLogin: request.twitchLogin,
      twitchDisplayName: request.twitchDisplayName,
      twitchProfileImageUrl: request.twitchProfileImageUrl,
      riotGameName: request.riotGameName,
      riotTagLine: request.riotTagLine,
      overlaySlug: request.overlaySlug,
      overlayKey: request.overlayKey,
      dashboardSlug: request.dashboardSlug,
      dashboardKey: request.dashboardKey,
      dashboardPath: streamerDashboardPath(request),
      profileLinkUrl: request.profileLinkUrl,
      profileLinkLabel: request.profileLinkLabel,
      profileLinks: request.profileLinks?.map((link) => ({ ...link })),
      dashboardEnabled: request.dashboardEnabled === true
    };
  }

  function streamerDashboardPath(request: StreamerRiotIdRequest): string | undefined {
    const slug = request.dashboardSlug?.trim();
    const key = request.dashboardKey?.trim();
    if (!slug || !key) return undefined;
    return `/dashboard/${encodeURIComponent(slug)}/${encodeURIComponent(key)}`;
  }

  function streamerDashboardTenantMatches(req: IncomingMessage, request: StreamerRiotIdRequest): boolean {
    const rawSlug = headerFirstValue(req.headers["x-streamops-streamer-slug"]);
    const rawKey = headerFirstValue(req.headers["x-streamops-dashboard-key"]);
    if (rawSlug === undefined && rawKey === undefined) return true;
    if (rawSlug === undefined || rawKey === undefined) return false;
    const expectedSlug = request.dashboardSlug?.trim().toLowerCase();
    const expectedKey = request.dashboardKey?.trim();
    const providedSlug = rawSlug.trim().toLowerCase();
    const providedKey = rawKey.trim();
    return Boolean(
      expectedSlug &&
      expectedKey &&
      providedSlug === expectedSlug &&
      tokenMatches(expectedKey, providedKey)
    );
  }

  function sendStreamerDashboardTenantMismatch(
    req: IncomingMessage,
    res: ServerResponse,
    request: StreamerRiotIdRequest
  ): void {
    sendJson(req, res, 403, {
      error: "대시보드 URL이 현재 스트리머 세션과 일치하지 않습니다.",
      code: "STREAMER_TENANT_MISMATCH",
      authenticated: true,
      role: "streamer",
      streamer: publicStreamerDashboardInfo(request),
      canonicalPath: streamerDashboardPath(request)
    });
  }

  function listStreamerRiotIdRequests(): StreamerRiotIdRequest[] {
    const storeWithRegistry = input.store as Store & { listStreamerRiotIdRequests?: () => StreamerRiotIdRequest[] };
    return typeof storeWithRegistry.listStreamerRiotIdRequests === "function"
      ? storeWithRegistry.listStreamerRiotIdRequests()
      : [];
  }

  function upsertStreamerRiotIdRequest(request: {
    twitchUserId: string;
    twitchLogin: string;
    twitchDisplayName: string;
    twitchProfileImageUrl?: string;
    riotGameName: string;
    riotTagLine: string;
  }): StreamerRiotIdRequest {
    const storeWithRegistry = input.store as Store & {
      upsertStreamerRiotIdRequest?: (input: typeof request) => StreamerRiotIdRequest;
    };
    if (typeof storeWithRegistry.upsertStreamerRiotIdRequest !== "function") {
      throw new HttpRequestError(503, { error: "스트리머 Riot ID 등록 저장소를 사용할 수 없습니다." });
    }
    return storeWithRegistry.upsertStreamerRiotIdRequest(request);
  }

  function resolveStreamerRiotIdRequest(request: {
    requestId: string;
    decision: "approved" | "rejected";
    reviewer?: string;
    note?: string;
  }): StreamerRiotIdRequest | undefined {
    const storeWithRegistry = input.store as Store & {
      resolveStreamerRiotIdRequest?: (input: typeof request) => StreamerRiotIdRequest | undefined;
    };
    if (typeof storeWithRegistry.resolveStreamerRiotIdRequest !== "function") {
      throw new HttpRequestError(503, { error: "스트리머 Riot ID 등록 저장소를 사용할 수 없습니다." });
    }
    return storeWithRegistry.resolveStreamerRiotIdRequest(request);
  }

  function setStreamerRiotIdDashboardEnabled(request: {
    requestId: string;
    dashboardEnabled: boolean;
    reviewer?: string;
    note?: string;
  }): StreamerRiotIdRequest | undefined {
    const storeWithRegistry = input.store as Store & {
      setStreamerRiotIdDashboardEnabled?: (input: typeof request) => StreamerRiotIdRequest | undefined;
    };
    if (typeof storeWithRegistry.setStreamerRiotIdDashboardEnabled !== "function") {
      throw new HttpRequestError(503, { error: "스트리머 대시보드 권한 저장소를 사용할 수 없습니다." });
    }
    return storeWithRegistry.setStreamerRiotIdDashboardEnabled(request);
  }

  function updateApprovedStreamerProfileLink(request: {
    twitchUserId: string;
    profileLinkUrl?: string;
    profileLinkLabel?: string;
    profileLinks?: StreamerProfileLink[];
  }): StreamerRiotIdRequest | undefined {
    const storeWithRegistry = input.store as Store & {
      updateApprovedStreamerProfileLink?: (input: typeof request) => StreamerRiotIdRequest | undefined;
    };
    if (typeof storeWithRegistry.updateApprovedStreamerProfileLink !== "function") {
      throw new HttpRequestError(503, { error: "스트리머 프로필 링크 저장소를 사용할 수 없습니다." });
    }
    return storeWithRegistry.updateApprovedStreamerProfileLink(request);
  }

  function updateApprovedStreamerRiotId(request: {
    twitchUserId: string;
    riotGameName: string;
    riotTagLine: string;
  }): StreamerRiotIdRequest | undefined {
    const storeWithRegistry = input.store as Store & {
      updateApprovedStreamerRiotId?: (input: typeof request) => StreamerRiotIdRequest | undefined;
    };
    if (typeof storeWithRegistry.updateApprovedStreamerRiotId !== "function") {
      throw new HttpRequestError(503, { error: "스트리머 Riot ID 저장소를 사용할 수 없습니다." });
    }
    return storeWithRegistry.updateApprovedStreamerRiotId(request);
  }

  function authenticatedStreamerOwnerId(principal: AuthPrincipal): string | undefined {
    if (principal.type !== "DASHBOARD_ADMIN" || principal.role !== "streamer") return undefined;
    const ownerId = principal.twitchUserId?.trim();
    return ownerId || undefined;
  }

  function requireAuthenticatedStreamerOwner(principal: AuthPrincipal): string {
    const ownerId = authenticatedStreamerOwnerId(principal);
    if (!ownerId) {
      throw new HttpRequestError(403, { error: "승인된 스트리머 세션이 필요합니다." });
    }
    return ownerId;
  }

  function streamerRiotIdentityForOwner(streamerId: string): StreamerRiotIdentity | undefined {
    const request = currentStreamerRiotIdRequestForTwitchUser(streamerId);
    if (!request) return undefined;
    const profile = input.store.getParticipationStreamerProfile(streamerId);
    return {
      twitchUserId: streamerId,
      riotGameName: request.riotGameName,
      riotTagLine: request.riotTagLine,
      normalizedRiotId: request.normalizedRiotId,
      approvalStatus: request.status,
      ...(profile?.profileStatus ? { profileStatus: profile.profileStatus } : {}),
      updatedAt: request.updatedAt
    };
  }

  function approvedStreamerIdentityForOwner(streamerId: string): StreamerRiotIdRequest | undefined {
    const request = currentStreamerRiotIdRequestForTwitchUser(streamerId);
    return request?.status === "approved" ? request : undefined;
  }

  function lolOperationsStateForOwner(streamerId: string): LolOperationsState {
    const identity = streamerRiotIdentityForOwner(streamerId);
    const automation = input.store.getLolAutomationSettings(streamerId);
    const participation = input.store.getParticipationState(streamerId);
    const currentGameStatus = participation.session?.status === "in_game"
      || participation.activeQueue.some((entry) => entry.status === "in_game")
      ? "in_game"
      : participation.session
        ? "idle"
        : "unknown";
    return {
      ...(identity ? { identity } : {}),
      automation,
      participation,
      summary: {
        riotApprovalStatus: identity?.approvalStatus ?? "missing",
        gameMonitorStatus: !automation.enabled
          ? "disabled"
          : identity?.approvalStatus === "approved"
            ? "monitoring"
            : "waiting_for_approval",
        currentGameStatus,
        participationStatus: participation.session?.status ?? (participation.isOpen ? "recruiting" : "closed"),
        waitingCount: participation.summary.waiting
      }
    };
  }

  function startParticipationSessionForOwner(streamerId: string) {
    const identity = approvedStreamerIdentityForOwner(streamerId);
    if (!identity) {
      throw new HttpRequestError(409, { error: "승인된 Riot ID가 있어야 시참 모집을 시작할 수 있습니다." });
    }
    return input.store.startParticipationSession(streamerId, {
      riotGameName: identity.riotGameName,
      riotTagLine: identity.riotTagLine,
      normalizedRiotId: identity.normalizedRiotId,
      profile: input.store.getParticipationStreamerProfile(streamerId),
      capturedAt: new Date().toISOString()
    });
  }

  function legacyGameMonitorConfigForOwner(streamerId: string): LolGameMonitorConfig {
    const identity = approvedStreamerIdentityForOwner(streamerId);
    const settings = input.store.getLolAutomationSettings(streamerId);
    return {
      enabled: settings.enabled,
      streamerRiotId: identity ? formatRiotId(identity.riotGameName, identity.riotTagLine) : "",
      pollIntervalMs: settings.pollIntervalMs,
      gameEndDebounceMs: settings.gameEndDebounceMs,
      autoSelectNextAfterGame: settings.autoSelectNextAfterGame,
      announceInChat: settings.announceInChat
    };
  }

  async function updateStreamerRiotIdentityForOwner(streamerId: string, rawRiotId: unknown): Promise<{
    request: StreamerRiotIdRequest;
    identity: StreamerRiotIdentity;
    streamerProfile?: ParticipationStreamerProfile;
  }> {
    if (typeof rawRiotId !== "string") {
      throw new HttpRequestError(400, { error: "riotId는 gameName#tagLine 문자열이어야 합니다." });
    }
    const previous = approvedStreamerIdentityForOwner(streamerId);
    if (!previous) {
      throw new HttpRequestError(409, { error: "승인된 Riot ID가 있어야 변경할 수 있습니다." });
    }
    const parsed = parseRiotIdDetailed(rawRiotId);
    if (!parsed.ok) throw new HttpRequestError(400, { error: parsed.message });
    const request = updateApprovedStreamerRiotId({
      twitchUserId: streamerId,
      riotGameName: parsed.gameName,
      riotTagLine: parsed.tagLine
    });
    if (!request) {
      throw new HttpRequestError(404, { error: "승인된 스트리머 등록 정보를 찾을 수 없습니다." });
    }
    invalidatePublicLolProfileCachesForStreamer(previous);
    invalidatePublicLolProfileCachesForStreamer(request);
    const automation = input.store.getLolAutomationSettings(streamerId);
    await restartStreamerLolGameMonitor(streamerId, request, automation);
    const streamerProfile = automation.enabled
      ? await refreshStreamerProfileForOwner(streamerId, true).catch(() => undefined)
      : undefined;
    const identity = streamerRiotIdentityForOwner(streamerId);
    if (!identity) throw new HttpRequestError(500, { error: "Riot ID 변경 결과를 불러오지 못했습니다." });
    return {
      request,
      identity,
      ...(streamerProfile ? { streamerProfile } : {})
    };
  }

  function listPublicTournaments(): StreamerTournament[] {
    const storeWithTournaments = input.store as Store & { listPublicTournaments?: () => StreamerTournament[] };
    return typeof storeWithTournaments.listPublicTournaments === "function"
      ? storeWithTournaments.listPublicTournaments()
      : [];
  }

  function communityText(value: unknown, maxLength: number): string {
    if (typeof value !== "string") return "";
    return value
      .replace(/\r\n/g, "\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, maxLength);
  }

  function communityTags(value: unknown): string[] {
    const rawTags = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",")
        : [];
    const tags: string[] = [];
    for (const rawTag of rawTags) {
      if (typeof rawTag !== "string") continue;
      const tag = communityText(rawTag.replace(/^#+/, ""), 20);
      if (!tag || tags.includes(tag)) continue;
      tags.push(tag);
      if (tags.length >= 5) break;
    }
    return tags;
  }

  function communityCategory(value: unknown): CommunityPostCategory {
    return value === "party" ? "party" : "server";
  }

  function communityPositiveInt(value: unknown, max: number): number | undefined {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) return undefined;
    return Math.max(1, Math.min(max, Math.trunc(numberValue)));
  }

  function isSafeCommunityImageUrl(value: string | undefined): boolean {
    return Boolean(value && /^\/community\/uploads\/[a-z0-9._-]+\.(?:png|jpe?g|gif|webp)$/i.test(value));
  }

  async function saveCommunityImage(file: MultipartPart | undefined): Promise<{ imageUrl?: string; imageAlt?: string }> {
    if (!file || !file.filename || file.data.byteLength === 0) return {};
    if (file.data.byteLength > MAX_COMMUNITY_IMAGE_BYTES) {
      throw new HttpRequestError(400, { error: "이미지는 5MB 이하로 등록해주세요." });
    }
    const ext = communityImageExtension(file);
    if (!ext) {
      throw new HttpRequestError(400, { error: "PNG, JPG, GIF, WEBP 이미지만 등록할 수 있습니다." });
    }
    const fileName = `community-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
    const root = communityAssetRoot();
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, fileName), file.data, { mode: 0o644 });
    return {
      imageUrl: `/community/uploads/${fileName}`,
      imageAlt: file.filename.slice(0, 120)
    };
  }

  function listCommunityPosts(limit: number, category?: CommunityPostCategory): CommunityPost[] {
    const storeWithCommunity = input.store as Store & { listCommunityPosts?: (limit?: number, category?: CommunityPostCategory) => CommunityPost[] };
    return typeof storeWithCommunity.listCommunityPosts === "function"
      ? storeWithCommunity.listCommunityPosts(limit, category)
      : [];
  }

  function getCommunityPostByAuthor(twitchUserId: string | undefined, category?: CommunityPostCategory): CommunityPost | undefined {
    const storeWithCommunity = input.store as Store & { getCommunityPostByAuthor?: (twitchUserId: string | undefined, category?: CommunityPostCategory) => CommunityPost | undefined };
    return typeof storeWithCommunity.getCommunityPostByAuthor === "function"
      ? storeWithCommunity.getCommunityPostByAuthor(twitchUserId, category)
      : undefined;
  }

  function countCommunityPostsByAuthor(twitchUserId: string | undefined, category?: CommunityPostCategory): number {
    const storeWithCommunity = input.store as Store & { countCommunityPostsByAuthor?: (twitchUserId: string | undefined, category?: CommunityPostCategory) => number };
    return typeof storeWithCommunity.countCommunityPostsByAuthor === "function"
      ? storeWithCommunity.countCommunityPostsByAuthor(twitchUserId, category)
      : 0;
  }

  function getCommunityPostById(postId: string | undefined): CommunityPost | undefined {
    const storeWithCommunity = input.store as Store & { getCommunityPostById?: (postId: string | undefined) => CommunityPost | undefined };
    return typeof storeWithCommunity.getCommunityPostById === "function"
      ? storeWithCommunity.getCommunityPostById(postId)
      : undefined;
  }

  function createCommunityPost(inputBody: CommunityPostCreateInput & {
    authorTwitchUserId: string;
    authorTwitchLogin: string;
    authorDisplayName: string;
    authorProfileImageUrl?: string;
    authorRiotGameName?: string;
    authorRiotTagLine?: string;
    riotGameName?: string;
    riotTagLine?: string;
    tags?: string[] | string;
    imageUrl?: string;
    imageAlt?: string;
    partyTier?: string;
    partyRole?: string;
    partyMode?: string;
    partyVoice?: string;
    partyCapacity?: number;
  }): CommunityPost {
    const storeWithCommunity = input.store as Store & {
      createCommunityPost?: (body: typeof inputBody) => CommunityPost | undefined;
      getCommunityPostByAuthor?: (twitchUserId: string | undefined, category?: CommunityPostCategory) => CommunityPost | undefined;
      countCommunityPostsByAuthor?: (twitchUserId: string | undefined, category?: CommunityPostCategory) => number;
    };
    if (typeof storeWithCommunity.createCommunityPost !== "function") {
      throw new HttpRequestError(503, { error: "커뮤니티 저장소를 사용할 수 없습니다." });
    }
    const category = communityCategory(inputBody.category);
    if (category === "party" && typeof storeWithCommunity.countCommunityPostsByAuthor === "function" && storeWithCommunity.countCommunityPostsByAuthor(inputBody.authorTwitchUserId, category) >= 2) {
      throw new HttpRequestError(409, { error: "파티 모집글은 하루에 2개까지 작성할 수 있습니다." });
    }
    if (category !== "party" && typeof storeWithCommunity.getCommunityPostByAuthor === "function" && storeWithCommunity.getCommunityPostByAuthor(inputBody.authorTwitchUserId, category)) {
      throw new HttpRequestError(409, { error: "커뮤니티 게시글은 게시판별 계정당 1개만 작성할 수 있습니다." });
    }
    const post = storeWithCommunity.createCommunityPost(inputBody);
    if (!post) throw new HttpRequestError(400, { error: "게시글 제목과 내용을 입력해주세요." });
    return post;
  }

  function updateCommunityPost(postId: string, inputBody: CommunityPostCreateInput & {
    riotGameName?: string;
    riotTagLine?: string;
    tags?: string[] | string;
    imageUrl?: string;
    imageAlt?: string;
  }): CommunityPost {
    const storeWithCommunity = input.store as Store & {
      updateCommunityPost?: (postId: string, body: typeof inputBody) => CommunityPost | undefined;
    };
    if (typeof storeWithCommunity.updateCommunityPost !== "function") {
      throw new HttpRequestError(503, { error: "커뮤니티 저장소를 사용할 수 없습니다." });
    }
    const post = storeWithCommunity.updateCommunityPost(postId, inputBody);
    if (!post) throw new HttpRequestError(400, { error: "게시글 제목과 내용을 입력해주세요." });
    return post;
  }

  function addCommunityPostComment(postId: string, inputBody: CommunityPostCommentCreateInput & {
    authorTwitchUserId: string;
    authorTwitchLogin: string;
    authorDisplayName: string;
    authorProfileImageUrl?: string;
  }): CommunityPost {
    const storeWithCommunity = input.store as Store & {
      addCommunityPostComment?: (postId: string, body: typeof inputBody) => CommunityPost | undefined;
    };
    if (typeof storeWithCommunity.addCommunityPostComment !== "function") {
      throw new HttpRequestError(503, { error: "커뮤니티 저장소를 사용할 수 없습니다." });
    }
    const post = storeWithCommunity.addCommunityPostComment(postId, inputBody);
    if (!post) throw new HttpRequestError(404, { error: "댓글을 작성할 파티모집 글을 찾을 수 없습니다." });
    return post;
  }

  function getPublicTournamentBySlug(slug: string): StreamerTournament | undefined {
    const storeWithTournaments = input.store as Store & { getPublicTournamentBySlug?: (slug: string) => StreamerTournament | undefined };
    return typeof storeWithTournaments.getPublicTournamentBySlug === "function"
      ? storeWithTournaments.getPublicTournamentBySlug(slug)
      : undefined;
  }

  function listDashboardTournaments(role: "admin" | "streamer", twitchUserId?: string): StreamerTournament[] {
    const storeWithTournaments = input.store as Store & {
      listDashboardTournaments?: (request: { role: "admin" | "streamer"; twitchUserId?: string }) => StreamerTournament[];
    };
    return typeof storeWithTournaments.listDashboardTournaments === "function"
      ? storeWithTournaments.listDashboardTournaments({ role, twitchUserId })
      : [];
  }

  function upsertStreamerTournament(body: TournamentUpsertInput, owner: StreamerRiotIdRequest): StreamerTournament | undefined {
    const storeWithTournaments = input.store as Store & {
      upsertStreamerTournament?: (body: TournamentUpsertInput, owner: StreamerRiotIdRequest) => StreamerTournament | undefined;
    };
    if (typeof storeWithTournaments.upsertStreamerTournament !== "function") {
      throw new HttpRequestError(503, { error: "대회 저장소를 사용할 수 없습니다." });
    }
    return storeWithTournaments.upsertStreamerTournament(body, owner);
  }

  function deleteStreamerTournament(id: string, owner: StreamerRiotIdRequest): boolean {
    const storeWithTournaments = input.store as Store & {
      deleteStreamerTournament?: (id: string, owner: StreamerRiotIdRequest) => boolean;
    };
    if (typeof storeWithTournaments.deleteStreamerTournament !== "function") {
      throw new HttpRequestError(503, { error: "대회 저장소를 사용할 수 없습니다." });
    }
    return storeWithTournaments.deleteStreamerTournament(id, owner);
  }

  function rememberPublicLolParticipantRank(riotId: string | undefined, rankedStats: LolRankedStats | undefined, fetchedAt: string): void {
    if (!riotId || !rankedStats) return;
    const parsed = parseRiotIdDetailed(riotId);
    if (!parsed.ok) return;
    const key = publicLolSuggestionKey(parsed.gameName, parsed.tagLine);
    const existing = publicLolSuggestionCache.get(key);
    publicLolSuggestionCache.set(key, {
      riotId,
      gameName: parsed.gameName,
      tagLine: parsed.tagLine,
      source: existing?.source ?? "recent",
      profileIconUrl: existing?.profileIconUrl,
      summonerLevel: rankedStats.summonerLevel ?? existing?.summonerLevel,
      lolPlatform: input.riot?.routingStatus().lolPlatform ?? existing?.lolPlatform,
      rankedStats: { ...rankedStats },
      lastSeenAt: fetchedAt
    });
  }

  async function connectedStreamerRiotProfile(): Promise<{
    twitchUserId: string;
    riotGameName: string;
    riotTagLine: string;
    rankedStats?: LolRankedStats;
    source: "connected_streamer";
  } | undefined> {
    const streamerRiotId = parseRiotIdDetailed(loadGameMonitorConfig().streamerRiotId);
    if (!streamerRiotId.ok || typeof input.twitchAuth.getStatus !== "function") return undefined;
    const status = await input.twitchAuth.getStatus().catch(() => undefined);
    const broadcaster = status?.broadcaster;
    if (!broadcaster?.id) return undefined;
    return {
      twitchUserId: broadcaster.id,
      riotGameName: streamerRiotId.gameName,
      riotTagLine: streamerRiotId.tagLine,
      rankedStats: cachedRankedStatsForRiotId(streamerRiotId.gameName, streamerRiotId.tagLine),
      source: "connected_streamer"
    };
  }

  function participationRiotProfilesByTwitchId(): Map<string, {
    riotGameName: string;
    riotTagLine: string;
    rankedStats?: LolRankedStats;
    source: "participation";
  }> {
    const profiles = new Map<string, {
      riotGameName: string;
      riotTagLine: string;
      rankedStats?: LolRankedStats;
      source: "participation";
      updatedAt?: string;
    }>();
    const entries = typeof input.store.getParticipationQueue === "function" ? input.store.getParticipationQueue() : [];
    for (const entry of entries) {
      if (!entry.twitchUserId || !entry.riotGameName || !entry.riotTagLine) continue;
      const previous = profiles.get(entry.twitchUserId);
      if (previous && Date.parse(previous.updatedAt ?? "") >= Date.parse(entry.updatedAt ?? "")) continue;
      profiles.set(entry.twitchUserId, {
        riotGameName: entry.riotGameName,
        riotTagLine: entry.riotTagLine,
        rankedStats: entry.rankedStats ? { ...entry.rankedStats } : cachedRankedStatsForRiotId(entry.riotGameName, entry.riotTagLine),
        source: "participation",
        updatedAt: entry.updatedAt
      });
    }
    return new Map([...profiles.entries()].map(([key, value]) => [key, {
      riotGameName: value.riotGameName,
      riotTagLine: value.riotTagLine,
      rankedStats: value.rankedStats,
      source: value.source
    }]));
  }

  function approvedStreamerRiotProfilesByTwitchId(): Map<string, {
    riotGameName: string;
    riotTagLine: string;
    rankedStats?: LolRankedStats;
    source: "approved_streamer";
  }> {
    const profiles = new Map<string, {
      riotGameName: string;
      riotTagLine: string;
      rankedStats?: LolRankedStats;
      source: "approved_streamer";
    }>();
    for (const request of listApprovedStreamerRiotIds()) {
      profiles.set(request.twitchUserId, {
        riotGameName: request.riotGameName,
        riotTagLine: request.riotTagLine,
        rankedStats: cachedRankedStatsForRiotId(request.riotGameName, request.riotTagLine),
        source: "approved_streamer"
      });
    }
    return profiles;
  }

  async function getPublicTwitchFollowedLol(limit: number, req: IncomingMessage): Promise<PublicTwitchFollowedLolResponse> {
    if (!input.publicTwitchAuth) {
      return { connected: false, truncated: false, matchedCount: 0, subscriptionScopeGranted: false, subscriptions: [], channels: [] };
    }
    const sessionId = publicTwitchViewerSessionIdFromRequest(req);
    const context = await input.publicTwitchAuth.getAccessContext(sessionId);
    if (!context) {
      return { connected: false, truncated: false, matchedCount: 0, subscriptionScopeGranted: false, subscriptions: [], channels: [] };
    }
    if (!input.twitch) throw new HttpRequestError(503, { error: "Twitch API client를 사용할 수 없습니다." });

    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 100)) : 100;
    const followed = await input.twitch.getFollowedChannels({
      clientId: context.clientId,
      accessToken: context.accessToken,
      scopes: context.scopes,
      userId: context.userId
    }, safeLimit);
    const participationProfiles = participationRiotProfilesByTwitchId();
    const approvedProfiles = approvedStreamerRiotProfilesByTwitchId();
    const connectedStreamer = await connectedStreamerRiotProfile();
    const streams = await input.twitch.getStreamsByUserIds({
      clientId: context.clientId,
      accessToken: context.accessToken,
      scopes: context.scopes
    }, followed.channels.map((channel) => channel.broadcasterId)).catch(() => new Map<string, TwitchStreamStatus>());
    const subscriptionScopeGranted = context.scopes.includes("user:read:subscriptions");
    const subscriptionCheckChannels = followed.channels.slice(0, PUBLIC_TWITCH_SUBSCRIPTION_CHECK_LIMIT);
    const subscriptionsByBroadcasterId = subscriptionScopeGranted
      ? await input.twitch.checkUserSubscriptions({
        clientId: context.clientId,
        accessToken: context.accessToken,
        scopes: context.scopes,
        userId: context.userId
      }, subscriptionCheckChannels.map((channel) => channel.broadcasterId)).catch(() => new Map())
      : new Map();

    const channels = followed.channels.map((channel): PublicTwitchFollowedLolChannel => {
      const connectedProfile = connectedStreamer?.twitchUserId === channel.broadcasterId ? connectedStreamer : undefined;
      const participationProfile = participationProfiles.get(channel.broadcasterId);
      const approvedProfile = approvedProfiles.get(channel.broadcasterId);
      const riotProfile = connectedProfile ?? approvedProfile ?? participationProfile;
      const stream = streams.get(channel.broadcasterId);
      const riotId = riotProfile ? `${riotProfile.riotGameName}#${riotProfile.riotTagLine}` : undefined;
      return {
        twitchUserId: channel.broadcasterId,
        twitchLogin: channel.broadcasterLogin,
        twitchDisplayName: stream?.userName || channel.broadcasterName,
        profileImageUrl: channel.profileImageUrl,
        followedAt: channel.followedAt,
        isLive: Boolean(stream),
        channelUrl: twitchChannelUrl(stream?.userLogin || channel.broadcasterLogin),
        title: stream?.title,
        gameName: stream?.gameName,
        viewerCount: stream?.viewerCount,
        startedAt: stream?.startedAt,
        thumbnailUrl: stream?.thumbnailUrl,
        riotId,
        riotGameName: riotProfile?.riotGameName,
        riotTagLine: riotProfile?.riotTagLine,
        rankedStats: riotProfile?.rankedStats ?? (riotProfile ? cachedRankedStatsForRiotId(riotProfile.riotGameName, riotProfile.riotTagLine) : undefined),
        source: riotProfile?.source
      };
    }).sort((a, b) => {
      const linkedScore = Number(Boolean(b.riotId)) - Number(Boolean(a.riotId));
      if (linkedScore !== 0) return linkedScore;
      const liveScore = Number(b.isLive) - Number(a.isLive);
      if (liveScore !== 0) return liveScore;
      return Date.parse(b.followedAt) - Date.parse(a.followedAt);
    });
    const channelById = new Map(followed.channels.map((channel) => [channel.broadcasterId, channel]));
    const subscriptions = [...subscriptionsByBroadcasterId.values()]
      .map((subscription): PublicTwitchSubscriptionChannel => {
        const followedChannel = channelById.get(subscription.broadcasterId);
        return {
          twitchUserId: subscription.broadcasterId,
          twitchLogin: subscription.broadcasterLogin || followedChannel?.broadcasterLogin || subscription.broadcasterId,
          twitchDisplayName: subscription.broadcasterName || followedChannel?.broadcasterName || subscription.broadcasterLogin || subscription.broadcasterId,
          profileImageUrl: followedChannel?.profileImageUrl,
          channelUrl: twitchChannelUrl(subscription.broadcasterLogin || followedChannel?.broadcasterLogin),
          tier: subscription.tier,
          tierLabel: twitchSubscriptionTierLabel(subscription.tier),
          isGift: subscription.isGift,
          gifterName: subscription.gifterName
        };
      })
      .sort((a, b) => a.twitchDisplayName.localeCompare(b.twitchDisplayName));

    return {
      connected: true,
      total: followed.total,
      truncated: followed.truncated,
      matchedCount: channels.filter((channel) => Boolean(channel.riotId)).length,
      subscriptionScopeGranted,
      subscriptions,
      channels
    };
  }

  function publicParticipationQueueItem(
    entry: ParticipationEntry,
    position: number,
    viewerTwitchUserId?: string
  ): PublicParticipationQueueItem {
    return {
      position,
      twitchUserName: entry.twitchUserName,
      ...(entry.preferredRole ? { preferredRole: entry.preferredRole } : {}),
      ...(entry.requestedRole ? { requestedRole: entry.requestedRole } : {}),
      status: entry.status,
      ...(entry.profileStatus ? { profileStatus: entry.profileStatus } : {}),
      ...(entry.mainRole ? { mainRole: entry.mainRole } : {}),
      ...(typeof entry.mainRoleConfidence === "number" ? { mainRoleConfidence: entry.mainRoleConfidence } : {}),
      ...(entry.rankedStats ? { rankedStats: { ...entry.rankedStats } } : {}),
      ...(entry.topChampions?.length ? { topChampions: entry.topChampions.map((champion) => ({ ...champion })) } : {}),
      isViewer: Boolean(viewerTwitchUserId && entry.twitchUserId === viewerTwitchUserId)
    };
  }

  function publicParticipationViewerEntry(entry: ParticipationEntry, position: number): PublicParticipationViewerEntry {
    return {
      ...publicParticipationQueueItem(entry, position, entry.twitchUserId),
      riotId: formatRiotId(entry.riotGameName, entry.riotTagLine),
      source: entry.source
    };
  }

  async function publicParticipationStreamers(
    selectedStreamerId?: string
  ): Promise<{
    streamers: PublicParticipationStreamer[];
    selectedStreamerId?: string;
    scopeStreamerId?: string;
  }> {
    const approvedStreamers = listApprovedStreamerRiotIds();
    const approvedByOwner = new Map(approvedStreamers.map((request) => [request.twitchUserId, request]));
    const activeSessions = input.store.listParticipationSessions()
      .filter((session) => session.status === "recruiting" || session.status === "in_game");
    if (activeSessions.length > 0) {
      const streamers = (await Promise.all(activeSessions.map(async (session) => {
        if (!await isPublicParticipationStreamerLive(session.streamerId)) return undefined;
        const participationState = input.store.getParticipationState(session.streamerId);
        const approved = approvedByOwner.get(session.streamerId);
        const snapshot = session.profileSnapshot;
        const profile = snapshot?.profile ?? input.store.getParticipationStreamerProfile(session.streamerId);
        const riotGameName = snapshot?.riotGameName ?? approved?.riotGameName ?? profile?.displayName;
        const riotTagLine = snapshot?.riotTagLine ?? approved?.riotTagLine ?? profile?.riotTagLine;
        return {
          id: session.streamerId,
          twitchUserId: session.streamerId,
          ...(approved?.twitchLogin ? { twitchLogin: approved.twitchLogin } : {}),
          twitchDisplayName: approved?.twitchDisplayName || profile?.displayName || riotGameName || "YORO.gg",
          ...(approved?.twitchProfileImageUrl ? { twitchProfileImageUrl: approved.twitchProfileImageUrl } : {}),
          ...(riotGameName ? { riotGameName } : {}),
          ...(riotTagLine ? { riotTagLine } : {}),
          ...(riotGameName ? { riotId: formatRiotId(riotGameName, riotTagLine || "JP1") } : {}),
          isOpen: participationState.isOpen,
          queueSize: participationState.summary.active,
          updatedAt: session.updatedAt
        };
      }))).filter((streamer): streamer is NonNullable<typeof streamer> => streamer !== undefined);
      const selected = selectedStreamerId
        ? streamers.find((streamer) => streamer.id === selectedStreamerId)
        : undefined;
      return selected
        ? { streamers, selectedStreamerId: selected.id, scopeStreamerId: selected.id }
        : { streamers };
    }

    const participationState = input.store.getParticipationState();
    if (!participationState.isOpen) {
      return { streamers: [] };
    }
    const now = new Date().toISOString();
    const streamerProfile = input.store.getParticipationStreamerProfile();
    const monitorRiotId = parseRiotIdDetailed(loadGameMonitorConfig().streamerRiotId);
    const monitorKey = monitorRiotId.ok ? normalizeRiotIdKey(monitorRiotId.gameName, monitorRiotId.tagLine) : undefined;
    const matchedApproved = monitorKey
      ? approvedStreamers.find((request) => request.normalizedRiotId === monitorKey)
      : undefined;
    const connectedStreamer = await connectedStreamerRiotProfile().catch(() => undefined);
    const connectedApproved = connectedStreamer?.twitchUserId
      ? approvedStreamers.find((request) => request.twitchUserId === connectedStreamer.twitchUserId)
      : undefined;
    const activeStreamer = matchedApproved ?? connectedApproved;
    if (!activeStreamer?.twitchUserId || !await isPublicParticipationStreamerLive(activeStreamer.twitchUserId)) {
      return { streamers: [] };
    }
    const riotGameName = activeStreamer?.riotGameName ?? (monitorRiotId.ok ? monitorRiotId.gameName : streamerProfile?.displayName);
    const riotTagLine = activeStreamer?.riotTagLine ?? (monitorRiotId.ok ? monitorRiotId.tagLine : streamerProfile?.riotTagLine);
    const fallbackDisplayName = riotGameName
      ? formatRiotId(riotGameName, riotTagLine || "JP1")
      : "YORO.gg";
    const streamer: PublicParticipationStreamer = {
      id: activeStreamer?.twitchUserId ?? (monitorKey ? `riot:${monitorKey}` : "active"),
      ...(activeStreamer?.twitchUserId ? { twitchUserId: activeStreamer.twitchUserId } : {}),
      ...(activeStreamer?.twitchLogin ? { twitchLogin: activeStreamer.twitchLogin } : {}),
      twitchDisplayName: activeStreamer?.twitchDisplayName || streamerProfile?.displayName || fallbackDisplayName,
      ...(activeStreamer?.twitchProfileImageUrl ? { twitchProfileImageUrl: activeStreamer.twitchProfileImageUrl } : {}),
      ...(riotGameName ? { riotGameName } : {}),
      ...(riotTagLine ? { riotTagLine } : {}),
      ...(riotGameName ? { riotId: formatRiotId(riotGameName, riotTagLine || "JP1") } : {}),
      isOpen: true,
      queueSize: participationState.summary.active,
      updatedAt: now
    };
    const streamers = [streamer];
    const selected = selectedStreamerId
      ? streamers.find((item) => item.id === selectedStreamerId)
      : undefined;
    return selected
      ? { streamers, selectedStreamerId: selected.id, scopeStreamerId: selected.id }
      : { streamers };
  }

  async function getPublicParticipationState(
    req: IncomingMessage,
    knownStatus?: PublicTwitchViewerStatusResponse,
    selectedStreamerIdOverride?: string
  ): Promise<PublicParticipationStateResponse> {
    const status = knownStatus ?? await getPublicTwitchViewerStatus(req);
    const viewerId = status.connected ? status.user?.id : undefined;
    const url = new URL(req.url ?? "/", "http://localhost");
    const requestedStreamerId = selectedStreamerIdOverride ?? (url.searchParams.get("streamerId")?.trim() || undefined);
    const streamerState = await publicParticipationStreamers(requestedStreamerId);
    const selectedScopeStreamerId = streamerState.scopeStreamerId;
    const participationState = selectedScopeStreamerId
      ? input.store.getParticipationState(selectedScopeStreamerId)
      : undefined;
    const activeEntries = selectedScopeStreamerId
      ? input.store.getActiveParticipationQueue(selectedScopeStreamerId)
      : [];
    const queue = participationState?.isOpen
      ? activeEntries
        .slice(0, PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE)
        .map((entry, index) => publicParticipationQueueItem(entry, index + 1, viewerId))
      : [];
    const viewerIndex = viewerId ? activeEntries.findIndex((entry) => entry.twitchUserId === viewerId) : -1;
    const activeViewerEntry = viewerIndex >= 0 && activeEntries[viewerIndex]
      ? publicParticipationViewerEntry(activeEntries[viewerIndex], viewerIndex + 1)
      : undefined;
    const completedViewerEntry = !activeViewerEntry && viewerId && selectedScopeStreamerId
      ? input.store.getParticipationQueue(selectedScopeStreamerId)
        .map((entry, index) => ({ entry, position: index + 1 }))
        .filter(({ entry }) => entry.twitchUserId === viewerId && entry.status === "played")
        .sort((a, b) => Date.parse(b.entry.updatedAt) - Date.parse(a.entry.updatedAt))[0]
      : undefined;
    const viewerEntry = activeViewerEntry ?? (completedViewerEntry
      ? publicParticipationViewerEntry(completedViewerEntry.entry, completedViewerEntry.position)
      : undefined);
    return {
      connected: Boolean(status.connected),
      configured: Boolean(status.configured),
      isOpen: Boolean(participationState?.isOpen),
      summary: participationState?.summary ?? {
        total: 0,
        active: 0,
        waiting: 0,
        selected: 0,
        checkedIn: 0,
        noShow: 0,
        played: 0
      },
      streamers: streamerState.streamers,
      ...(streamerState.selectedStreamerId ? { selectedStreamerId: streamerState.selectedStreamerId } : {}),
      queue,
      ...(viewerEntry ? { viewerEntry } : {}),
      maxQueueSize: PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE,
      updatedAt: new Date().toISOString()
    };
  }

  async function joinPublicParticipation(req: IncomingMessage): Promise<PublicParticipationJoinResponse> {
    if (!input.publicTwitchAuth) {
      throw new HttpRequestError(503, { error: "Twitch 공개 로그인을 사용할 수 없습니다." });
    }
    const status = await getPublicTwitchViewerStatus(req);
    if (!status.connected || !status.user) {
      throw new HttpRequestError(401, { error: "Twitch 로그인 후 참여 등록을 할 수 있습니다." });
    }
    const body = await readJsonBody<{ riotId?: unknown; role?: unknown; streamerId?: unknown }>(req);
    const requestedStreamerId = typeof body.streamerId === "string" ? body.streamerId.trim() : "";
    if (!requestedStreamerId) {
      throw new HttpRequestError(400, { error: "참여할 방송인을 선택해주세요." });
    }
    const streamerState = await publicParticipationStreamers(requestedStreamerId);
    if (!streamerState.streamers.some((streamer) => streamer.id === requestedStreamerId)) {
      throw new HttpRequestError(404, { error: "선택한 방송인의 참여 대기열을 찾을 수 없습니다." });
    }
    if (!streamerState.selectedStreamerId || !input.store.getParticipationState(streamerState.scopeStreamerId).isOpen) {
      throw new HttpRequestError(409, { error: "현재 시청자 참여 대기열이 닫혀 있습니다." });
    }
    if (typeof body.riotId !== "string") {
      throw new HttpRequestError(400, { error: "Riot ID를 입력해주세요." });
    }
    const parsed = parseRiotIdDetailed(body.riotId);
    if (!parsed.ok) {
      throw new HttpRequestError(400, { error: parsed.message });
    }
    const normalizedRole = normalizeLolRole(typeof body.role === "string" ? body.role : undefined);
    const role: LolRole = normalizedRole === "unknown" ? "fill" : normalizedRole;
    const duplicateBefore = input.store.findParticipationDuplicate({
      twitchUserId: status.user.id,
      riotGameName: parsed.gameName,
      riotTagLine: parsed.tagLine
    }, streamerState.scopeStreamerId);
    if (duplicateBefore) {
      const state = await getPublicParticipationState(req, status, streamerState.selectedStreamerId);
      return {
        ok: true,
        alreadyJoined: true,
        reused: false,
        state,
        ...(state.viewerEntry ? { entry: state.viewerEntry } : {})
      };
    }
    if (input.store.getActiveParticipationCount(streamerState.scopeStreamerId) >= PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE) {
      throw new HttpRequestError(409, { error: "참여 대기열이 가득 찼습니다." });
    }

    const previousProfile = input.store.findReusableParticipationProfile({
      riotGameName: parsed.gameName,
      riotTagLine: parsed.tagLine
    }, streamerState.scopeStreamerId);
    const profileReady = previousProfile?.profileStatus === "ready" || Boolean(previousProfile?.rankedStats);
    const entry = input.store.makeParticipationEntry({
      twitchUserId: status.user.id,
      twitchUserName: status.user.displayName || status.user.login,
      riotGameName: parsed.gameName,
      riotTagLine: parsed.tagLine,
      ...(previousProfile?.riotPuuid ? { riotPuuid: previousProfile.riotPuuid } : {}),
      requestedRole: role,
      preferredRole: role,
      ...(previousProfile?.verifiedRank ? { verifiedRank: previousProfile.verifiedRank } : {}),
      ...(previousProfile?.rankedStats ? { rankedStats: previousProfile.rankedStats } : {}),
      profileStatus: previousProfile?.profileStatus ?? "pending",
      ...(previousProfile?.profileFailureReason ? { profileFailureReason: previousProfile.profileFailureReason } : {}),
      ...(previousProfile?.mainRole ? { mainRole: previousProfile.mainRole } : {}),
      ...(typeof previousProfile?.mainRoleConfidence === "number" ? { mainRoleConfidence: previousProfile.mainRoleConfidence } : {}),
      ...(previousProfile?.topChampions?.length ? { topChampions: previousProfile.topChampions.map((champion) => ({ ...champion })) } : {}),
      ...(previousProfile?.profileAnalyzedAt ? { profileAnalyzedAt: previousProfile.profileAnalyzedAt } : {}),
      status: profileReady ? "verified" : "waitlisted",
      source: "dashboard"
    });
    const saved = input.store.reactivateReusableParticipation(entry, streamerState.scopeStreamerId);
    await broadcastParticipationQueue(
      { store: input.store, actions: input.actions },
      "public.participation_join",
      streamerState.scopeStreamerId
    )
      .catch(() => undefined);
    if (input.refreshLolProfile && saved.entry.profileStatus !== "ready") {
      void input.refreshLolProfile(saved.entry.id, streamerState.scopeStreamerId).catch(() => undefined);
    }
    const state = await getPublicParticipationState(req, status, streamerState.selectedStreamerId);
    return {
      ok: true,
      alreadyJoined: false,
      reused: saved.reused,
      state,
      ...(state.viewerEntry ? { entry: state.viewerEntry } : {})
    };
  }

  async function cancelPublicParticipation(req: IncomingMessage): Promise<PublicParticipationCancelResponse> {
    if (!input.publicTwitchAuth) {
      throw new HttpRequestError(503, { error: "Twitch 공개 로그인을 사용할 수 없습니다." });
    }
    const status = await getPublicTwitchViewerStatus(req);
    if (!status.connected || !status.user) {
      throw new HttpRequestError(401, { error: "Twitch 로그인 후 참여 취소를 할 수 있습니다." });
    }
    const body = await readJsonBody<{ streamerId?: unknown }>(req);
    const requestedStreamerId = typeof body.streamerId === "string" ? body.streamerId.trim() : "";
    if (!requestedStreamerId) {
      throw new HttpRequestError(400, { error: "참여할 방송인을 선택해주세요." });
    }
    const streamerState = await publicParticipationStreamers(requestedStreamerId);
    if (!streamerState.streamers.some((streamer) => streamer.id === requestedStreamerId)) {
      throw new HttpRequestError(404, { error: "선택한 방송인의 참여 대기열을 찾을 수 없습니다." });
    }
    if (!streamerState.selectedStreamerId) {
      throw new HttpRequestError(404, { error: "선택한 방송인의 참여 대기열을 찾을 수 없습니다." });
    }
    const result = input.store.cancelParticipationByUser(
      status.user.id,
      "시청자가 웹 참여 화면에서 참가를 취소했습니다.",
      streamerState.scopeStreamerId
    );
    if (!result.ok) {
      const error = result.reason === "in_game"
        ? "이미 게임 진행 상태라 참여 취소를 할 수 없습니다."
        : "취소할 참여 신청을 찾지 못했습니다.";
      throw new HttpRequestError(result.reason === "in_game" ? 409 : 404, { error });
    }
    await broadcastParticipationQueue(
      { store: input.store, actions: input.actions },
      "public.participation_cancel",
      streamerState.scopeStreamerId
    )
      .catch(() => undefined);
    return {
      ok: true,
      state: await getPublicParticipationState(req, status, streamerState.selectedStreamerId)
    };
  }

  async function createPublicStreamerRiotIdRequest(req: IncomingMessage): Promise<StreamerRiotIdRequest> {
    if (!input.publicTwitchAuth) {
      throw new HttpRequestError(503, { error: "Twitch 공개 로그인을 사용할 수 없습니다." });
    }
    const sessionId = publicTwitchViewerSessionIdFromRequest(req);
    const [context, status] = await Promise.all([
      input.publicTwitchAuth.getAccessContext(sessionId),
      input.publicTwitchAuth.getStatus(sessionId)
    ]);
    if (!context || !status.connected || !status.user) {
      throw new HttpRequestError(401, { error: "Twitch 로그인 후 Riot ID 등록을 요청할 수 있습니다." });
    }
    const body = await readJsonBody<{ riotId?: unknown }>(req);
    if (typeof body.riotId !== "string") {
      throw new HttpRequestError(400, { error: "riotId는 문자열이어야 합니다." });
    }
    const parsed = parseRiotIdDetailed(body.riotId);
    if (!parsed.ok) {
      throw new HttpRequestError(400, { error: parsed.message });
    }
    return upsertStreamerRiotIdRequest({
      twitchUserId: status.user.id,
      twitchLogin: status.user.login,
      twitchDisplayName: status.user.displayName || status.user.login,
      twitchProfileImageUrl: status.user.profileImageUrl,
      riotGameName: parsed.gameName,
      riotTagLine: parsed.tagLine
    });
  }

  async function createPublicCommunityPost(req: IncomingMessage): Promise<CommunityPost> {
    if (!input.publicTwitchAuth) {
      throw new HttpRequestError(503, { error: "Twitch 공개 로그인을 사용할 수 없습니다." });
    }
    const sessionId = publicTwitchViewerSessionIdFromRequest(req);
    const status = await input.publicTwitchAuth.getStatus(sessionId);
    if (!status.connected || !status.user) {
      throw new HttpRequestError(401, { error: "Twitch 로그인 후 게시글을 작성할 수 있습니다." });
    }
    if (communityModeration.isUserSanctioned(status.user.id)) {
      throw new HttpRequestError(403, { error: "커뮤니티 작성이 제한된 계정입니다. 관리자에게 문의해주세요." });
    }
    const contentType = requestHeaderValue(req, "content-type") ?? "";
    let category: CommunityPostCategory = "server";
    let title = "";
    let content = "";
    let rawRiotId = "";
    let tags: string[] = [];
    let partyTier: string | undefined;
    let partyRole: string | undefined;
    let partyMode: string | undefined;
    let partyVoice: string | undefined;
    let partyCapacity: number | undefined;
    let imageUrl: string | undefined;
    let imageAlt: string | undefined;

    if (/^multipart\/form-data\b/i.test(contentType)) {
      const parts = parseMultipartBody(req, await readRawBody(req, MAX_COMMUNITY_IMAGE_BYTES + MAX_JSON_BODY_BYTES));
      category = communityCategory(multipartText(parts, "category"));
      title = communityText(multipartText(parts, "title"), 80);
      content = communityText(multipartText(parts, "body"), 2000);
      rawRiotId = communityText(multipartText(parts, "riotId"), 80);
      tags = communityTags(multipartText(parts, "tags"));
      partyTier = communityText(multipartText(parts, "partyTier"), 24) || undefined;
      partyRole = communityText(multipartText(parts, "partyRole"), 24) || undefined;
      partyMode = communityText(multipartText(parts, "partyMode"), 32) || undefined;
      partyVoice = communityText(multipartText(parts, "partyVoice"), 32) || undefined;
      partyCapacity = communityPositiveInt(multipartText(parts, "partyCapacity"), 5);
      const image = await saveCommunityImage(parts.find((part) => (part.name === "image" || part.name === "file") && part.filename));
      imageUrl = image.imageUrl;
      imageAlt = image.imageAlt;
    } else {
      const body = await readJsonBody<CommunityPostCreateInput>(req);
      category = communityCategory(body.category);
      title = communityText(body.title, 80);
      content = communityText(body.body, 2000);
      rawRiotId = communityText(body.riotId, 80);
      tags = communityTags(body.tags);
      partyTier = communityText(body.partyTier, 24) || undefined;
      partyRole = communityText(body.partyRole, 24) || undefined;
      partyMode = communityText(body.partyMode, 32) || undefined;
      partyVoice = communityText(body.partyVoice, 32) || undefined;
      partyCapacity = communityPositiveInt(body.partyCapacity, 5);
      const requestedImageUrl = communityText(body.imageUrl, 220);
      if (requestedImageUrl && !isSafeCommunityImageUrl(requestedImageUrl)) {
        throw new HttpRequestError(400, { error: "이미지는 파일 업로드 또는 저장된 커뮤니티 이미지 경로만 사용할 수 있습니다." });
      }
      imageUrl = requestedImageUrl || undefined;
      imageAlt = communityText(body.imageAlt, 120) || undefined;
    }

    if (!title || !content) {
      throw new HttpRequestError(400, { error: "게시글 제목과 내용을 입력해주세요." });
    }
    if (category === "party" && countCommunityPostsByAuthor(status.user.id, category) >= 2) {
      throw new HttpRequestError(409, { error: "파티 모집글은 하루에 2개까지 작성할 수 있습니다." });
    }
    if (category !== "party" && getCommunityPostByAuthor(status.user.id, category)) {
      throw new HttpRequestError(409, { error: "커뮤니티 게시글은 게시판별 계정당 1개만 작성할 수 있습니다." });
    }
    let riotGameName: string | undefined;
    let riotTagLine: string | undefined;
    if (rawRiotId) {
      const parsed = parseRiotIdDetailed(rawRiotId);
      if (!parsed.ok) {
        throw new HttpRequestError(400, { error: parsed.message });
      }
      riotGameName = parsed.gameName;
      riotTagLine = parsed.tagLine;
    }
    const streamerRiotRequest = currentStreamerRiotIdRequestForTwitchUser(status.user.id);
    const approvedRiotRequest = streamerRiotRequest?.status === "approved" ? streamerRiotRequest : undefined;
    return createCommunityPost({
      category,
      title,
      body: content,
      riotGameName,
      riotTagLine,
      tags,
      imageUrl,
      imageAlt,
      partyTier,
      partyRole,
      partyMode,
      partyVoice,
      partyCapacity,
      authorTwitchUserId: status.user.id,
      authorTwitchLogin: status.user.login,
      authorDisplayName: status.user.displayName || status.user.login,
      authorProfileImageUrl: status.user.profileImageUrl,
      authorRiotGameName: approvedRiotRequest?.riotGameName,
      authorRiotTagLine: approvedRiotRequest?.riotTagLine
    });
  }

  async function updatePublicCommunityPost(req: IncomingMessage, postId: string): Promise<CommunityPost> {
    if (!input.publicTwitchAuth) {
      throw new HttpRequestError(503, { error: "Twitch 공개 로그인을 사용할 수 없습니다." });
    }
    const currentPost = getCommunityPostById(postId);
    if (!currentPost) {
      throw new HttpRequestError(404, { error: "수정할 게시글을 찾을 수 없습니다." });
    }
    if (currentPost.category !== "server") {
      throw new HttpRequestError(400, { error: "서버 모집 글만 수정할 수 있습니다." });
    }
    const sessionId = publicTwitchViewerSessionIdFromRequest(req);
    const status = await input.publicTwitchAuth.getStatus(sessionId);
    if (!status.connected || !status.user) {
      throw new HttpRequestError(401, { error: "Twitch 로그인 후 게시글을 수정할 수 있습니다." });
    }
    if (currentPost.authorTwitchUserId !== status.user.id) {
      throw new HttpRequestError(403, { error: "본인이 작성한 게시글만 수정할 수 있습니다." });
    }
    if (communityModeration.isUserSanctioned(status.user.id)) {
      throw new HttpRequestError(403, { error: "커뮤니티 작성이 제한된 계정입니다. 관리자에게 문의해주세요." });
    }

    const contentType = requestHeaderValue(req, "content-type") ?? "";
    let title = "";
    let content = "";
    let rawRiotId = "";
    let tags: string[] = [];
    let imageUrl: string | undefined;
    let imageAlt: string | undefined;
    let hasImageReplacement = false;

    if (/^multipart\/form-data\b/i.test(contentType)) {
      const parts = parseMultipartBody(req, await readRawBody(req, MAX_COMMUNITY_IMAGE_BYTES + MAX_JSON_BODY_BYTES));
      title = communityText(multipartText(parts, "title"), 80);
      content = communityText(multipartText(parts, "body"), 2000);
      rawRiotId = communityText(multipartText(parts, "riotId"), 80);
      tags = communityTags(multipartText(parts, "tags"));
      const image = await saveCommunityImage(parts.find((part) => (part.name === "image" || part.name === "file") && part.filename));
      imageUrl = image.imageUrl;
      imageAlt = image.imageAlt;
      hasImageReplacement = Boolean(imageUrl);
    } else {
      const body = await readJsonBody<CommunityPostCreateInput>(req);
      title = communityText(body.title, 80);
      content = communityText(body.body, 2000);
      rawRiotId = communityText(body.riotId, 80);
      tags = communityTags(body.tags);
      const requestedImageUrl = communityText(body.imageUrl, 220);
      if (requestedImageUrl && !isSafeCommunityImageUrl(requestedImageUrl)) {
        throw new HttpRequestError(400, { error: "이미지는 파일 업로드 또는 저장된 커뮤니티 이미지 경로만 사용할 수 있습니다." });
      }
      if (requestedImageUrl) {
        imageUrl = requestedImageUrl;
        imageAlt = communityText(body.imageAlt, 120) || undefined;
        hasImageReplacement = true;
      }
    }

    if (!title || !content) {
      throw new HttpRequestError(400, { error: "게시글 제목과 내용을 입력해주세요." });
    }

    let riotGameName: string | undefined;
    let riotTagLine: string | undefined;
    if (rawRiotId) {
      const parsed = parseRiotIdDetailed(rawRiotId);
      if (!parsed.ok) {
        throw new HttpRequestError(400, { error: parsed.message });
      }
      riotGameName = parsed.gameName;
      riotTagLine = parsed.tagLine;
    }

    return updateCommunityPost(postId, {
      category: "server",
      title,
      body: content,
      riotGameName,
      riotTagLine,
      tags,
      ...(hasImageReplacement ? { imageUrl, imageAlt } : {})
    });
  }

  async function createPublicCommunityComment(req: IncomingMessage, postId: string): Promise<CommunityPost> {
    if (!input.publicTwitchAuth) {
      throw new HttpRequestError(503, { error: "Twitch 공개 로그인을 사용할 수 없습니다." });
    }
    const currentPost = getCommunityPostById(postId);
    if (!currentPost || currentPost.category !== "party") {
      throw new HttpRequestError(404, { error: "댓글을 작성할 파티모집 글을 찾을 수 없습니다." });
    }
    const sessionId = publicTwitchViewerSessionIdFromRequest(req);
    const status = await input.publicTwitchAuth.getStatus(sessionId);
    if (!status.connected || !status.user) {
      throw new HttpRequestError(401, { error: "Twitch 로그인 후 댓글을 작성할 수 있습니다." });
    }
    if (communityModeration.isUserSanctioned(status.user.id)) {
      throw new HttpRequestError(403, { error: "커뮤니티 작성이 제한된 계정입니다. 관리자에게 문의해주세요." });
    }
    const body = await readJsonBody<CommunityPostCommentCreateInput>(req);
    const commentBody = communityText(body.body, 500);
    if (!commentBody) {
      throw new HttpRequestError(400, { error: "댓글 내용을 입력해주세요." });
    }
    return addCommunityPostComment(postId, {
      body: commentBody,
      authorTwitchUserId: status.user.id,
      authorTwitchLogin: status.user.login,
      authorDisplayName: status.user.displayName || status.user.login,
      authorProfileImageUrl: status.user.profileImageUrl
    });
  }

  async function createPublicCommunityReport(req: IncomingMessage, postId: string): Promise<CommunityPostReport> {
    if (!input.publicTwitchAuth) {
      throw new HttpRequestError(503, { error: "Twitch 공개 로그인을 사용할 수 없습니다." });
    }
    const status = await getPublicTwitchViewerStatus(req);
    if (!status.connected || !status.user) {
      throw new HttpRequestError(401, { error: "Twitch 로그인 후 게시글을 신고할 수 있습니다." });
    }
    const post = getCommunityPostById(postId);
    if (!post) throw new HttpRequestError(404, { error: "신고할 게시글을 찾을 수 없습니다." });
    if (post.authorTwitchUserId === status.user.id) {
      throw new HttpRequestError(409, { error: "본인이 작성한 게시글은 신고할 수 없습니다." });
    }
    const body = await readJsonBody<{ reason?: unknown; detail?: unknown }>(req);
    const reason = body.reason;
    if (reason !== "spam" && reason !== "harassment" && reason !== "privacy" && reason !== "other") {
      throw new HttpRequestError(400, { error: "신고 사유를 선택해주세요." });
    }
    const report = communityModeration.reportPost({
      postId,
      reason,
      detail: communityText(body.detail, 500) || undefined,
      reporterTwitchUserId: status.user.id,
      reporterTwitchLogin: status.user.login,
      reporterDisplayName: status.user.displayName || status.user.login
    });
    input.logger?.event?.({
      type: "community.post.reported",
      reportId: report.id,
      postId: report.postId,
      reason: report.reason
    });
    return report;
  }

  async function getPublicTwitchViewerStatus(req: IncomingMessage): Promise<PublicTwitchViewerStatusResponse> {
    if (!input.publicTwitchAuth) {
      return {
        connected: false,
        configured: false,
        requiredScopes: ["user:read:follows", "user:read:subscriptions"],
        missingScopes: ["user:read:follows", "user:read:subscriptions"]
      };
    }
    const status = await input.publicTwitchAuth.getStatus(publicTwitchViewerSessionIdFromRequest(req));
    const streamerRiotRequest = status.connected
      ? currentStreamerRiotIdRequestForTwitchUser(status.user?.id)
      : undefined;
    return streamerRiotRequest ? { ...status, streamerRiotRequest } : status;
  }

  async function handlePublicTwitchAuthCallback(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (!input.publicTwitchAuth) return sendSafeOAuthHtml(res, 503, "Twitch 연결 실패", "Twitch 공개 로그인을 사용할 수 없습니다.");
    const error = url.searchParams.get("error");
    if (error) return sendSafeOAuthHtml(res, 400, "Twitch 연결 실패", twitchOAuthErrorMessage(url, "Twitch 권한 승인이 완료되지 않았습니다. 전적 페이지에서 다시 시도해주세요."));
    const state = input.publicTwitchAuth.consumeState(url.searchParams.get("state"));
    if (!state) {
      return sendSafeOAuthHtml(res, 400, "Twitch 연결 실패", "OAuth state 검증에 실패했습니다. 전적 페이지에서 다시 연결을 시작해주세요.");
    }
    const code = url.searchParams.get("code");
    if (!code) return sendSafeOAuthHtml(res, 400, "Twitch 연결 실패", "OAuth callback에 필요한 code가 없습니다.");
    try {
      const session = await input.publicTwitchAuth.connectWithCode(code, state.redirectUri ?? publicTwitchCallbackUrlForRequest(req));
      return sendRedirect(res, state.returnUrl || publicLolReturnUrlForRequest(req), { "Set-Cookie": publicTwitchViewerSessionCookie(session) });
    } catch {
      return sendSafeOAuthHtml(res, 400, "Twitch 연결 실패", "Twitch token 교환 또는 사용자 정보 조회에 실패했습니다. 서버 설정을 확인한 뒤 다시 시도해주세요.");
    }
  }

  async function buildPublicLolSuggestions(rawQuery: string): Promise<PublicLolSuggestion[]> {
    const query = rawQuery.trim().normalize("NFKC").replace(/＃/g, "#");
    if (query.length < 2) return [];
    const unique = new Map<string, PublicLolSuggestion>();
    for (const suggestion of publicLolSuggestionCache.values()) {
      if (publicLolSuggestionMatches(query, suggestion)) {
        unique.set(publicLolSuggestionKey(suggestion.gameName, suggestion.tagLine), suggestion);
      }
    }
    for (const profile of input.profileRepository?.searchByText(query, 8) ?? []) {
      const suggestion = await profileCacheEntryToSuggestion(profile);
      unique.set(publicLolSuggestionKey(suggestion.gameName, suggestion.tagLine), suggestion);
    }

    if (query.includes("#") && input.riot?.isConfigured()) {
      const parsed = parseRiotIdDetailed(query);
      if (parsed.ok) {
        const account = await input.riot.getAccountByRiotId(parsed.gameName, parsed.tagLine).catch(() => null);
        if (account?.puuid) {
          const now = new Date().toISOString();
          const rankedStats = typeof input.riot.getRankedStatsByPuuid === "function"
            ? await input.riot.getRankedStatsByPuuid(account.puuid).catch(() => undefined)
            : undefined;
          const iconUrl = await profileIconUrl(input.dataDragon, rankedStats?.profileIconId);
          const key = publicLolSuggestionKey(account.gameName || parsed.gameName, account.tagLine || parsed.tagLine);
          unique.set(key, {
            riotId: `${account.gameName || parsed.gameName}#${account.tagLine || parsed.tagLine}`,
            gameName: account.gameName || parsed.gameName,
            tagLine: account.tagLine || parsed.tagLine,
            source: "verified",
            profileIconUrl: iconUrl,
            summonerLevel: rankedStats?.summonerLevel,
            lolPlatform: input.riot.routingStatus().lolPlatform,
            rankedStats: rankedStats ? { ...rankedStats } : undefined,
            lastSeenAt: now
          });
        }
      }
    }

    return [...unique.values()]
      .sort((a, b) => {
        const sourceScore = (b.source === "verified" ? 1 : 0) - (a.source === "verified" ? 1 : 0);
        if (sourceScore !== 0) return sourceScore;
        return Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
      })
      .slice(0, 8);
  }

  async function publicLolRecentMatchFromRiotMatch(
    match: RiotMatch,
    targetPuuid: string,
    dataDragonVersion: string | undefined,
    streamerByRiotId: Map<string, PublicLolTwitchStream>
  ): Promise<PublicLolRecentMatch | undefined> {
    const participant = match.info.participants.find((item) => item.puuid === targetPuuid);
    if (!participant) return undefined;
    const champion = await mapChampionSummary(input.dataDragon, {
      championId: participant.championId,
      championName: participant.championName
    });
    const opponent = findLaneOpponent(match, participant);
    const opponentChampion = opponent ? await mapChampionSummary(input.dataDragon, {
      championId: opponent.championId,
      championName: opponent.championName
    }) : undefined;
    const cs = participantCs(participant);
    const durationMinutes = matchDurationMinutes(match);
    const damageDealtToChampions = safeOptionalStat(participant.totalDamageDealtToChampions);
    const damageTaken = safeOptionalStat(participant.totalDamageTaken);
    const goldEarned = safeOptionalStat(participant.goldEarned);
    const visionScore = safeOptionalStat(participant.visionScore);
    return {
      matchId: match.metadata.matchId,
      champion,
      queueId: match.info.queueId,
      gameMode: match.info.gameMode,
      gameType: match.info.gameType,
      mapId: match.info.mapId,
      startedAt: matchStartedAt(match),
      durationSeconds: matchDurationSeconds(match),
      result: participant.win === true ? "win" : participant.win === false ? "loss" : "unknown",
      kills: safeMatchStat(participant.kills),
      deaths: safeMatchStat(participant.deaths),
      assists: safeMatchStat(participant.assists),
      kda: participantKda(participant),
      championLevel: safeOptionalStat(participant.champLevel),
      cs,
      csPerMinute: cs !== undefined && durationMinutes ? roundTo(cs / durationMinutes, 1) : undefined,
      killParticipation: participantKillParticipation(match, participant),
      goldEarned,
      goldPerMinute: averageDefined([participant.challenges?.goldPerMinute], 0) ?? (goldEarned !== undefined && durationMinutes ? roundTo(goldEarned / durationMinutes, 0) : undefined),
      damageDealtToChampions,
      damageTaken,
      damagePerMinute: averageDefined([participant.challenges?.damagePerMinute], 0) ?? (damageDealtToChampions !== undefined && durationMinutes ? roundTo(damageDealtToChampions / durationMinutes, 0) : undefined),
      damageShare: participantDamageShare(match, participant),
      visionScore,
      visionScorePerMinute: averageDefined([participant.challenges?.visionScorePerMinute], 2) ?? (visionScore !== undefined && durationMinutes ? roundTo(visionScore / durationMinutes, 2) : undefined),
      wardsPlaced: safeOptionalStat(participant.wardsPlaced),
      wardsKilled: safeOptionalStat(participant.wardsKilled),
      controlWardsPlaced: safeOptionalStat(participant.detectorWardsPlaced),
      largestMultiKill: safeOptionalStat(participant.largestMultiKill),
      soloKills: safeOptionalStat(participant.challenges?.soloKills),
      turretKills: safeOptionalStat(participant.turretKills),
      inhibitorKills: safeOptionalStat(participant.inhibitorKills),
      objectivesStolen: safeOptionalStat(participant.objectivesStolen),
      totalTimeSpentDead: safeOptionalStat(participant.totalTimeSpentDead),
      position: participant.individualPosition || participant.teamPosition,
      items: participantItems(participant, dataDragonVersion),
      summonerSpells: participantSummonerSpells(participant),
      badges: publicLolMatchBadges(match, participant),
      team: participantTeamSummary(match, participant),
      opponent: opponent && opponentChampion ? {
        riotId: participantRiotId(opponent),
        champion: opponentChampion,
        kills: safeMatchStat(opponent.kills),
        deaths: safeMatchStat(opponent.deaths),
        assists: safeMatchStat(opponent.assists),
        kda: participantKda(opponent)
      } : undefined,
      teams: await publicLolMatchTeams(input.dataDragon, dataDragonVersion, match, targetPuuid, streamerByRiotId)
    };
  }

  function rememberPublicLolMatchDetail(match: RiotMatch): void {
    const matchId = match.metadata.matchId?.trim();
    if (!matchId) return;
    publicLolMatchDetailCache.set(matchId.toUpperCase(), {
      match,
      expiresAt: Date.now() + PUBLIC_LOL_MATCH_DETAIL_CACHE_TTL_MS
    });
    if (publicLolMatchDetailCache.size <= PUBLIC_LOL_MATCH_DETAIL_CACHE_MAX) return;
    const oldestKey = [...publicLolMatchDetailCache.entries()]
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0]?.[0];
    if (oldestKey) publicLolMatchDetailCache.delete(oldestKey);
  }

  async function getPublicLolMatchDetail(matchId: string): Promise<RiotMatch | null> {
    if (!input.riot) throw new HttpRequestError(503, { error: "Riot API client를 사용할 수 없습니다." });
    const cacheKey = matchId.trim().toUpperCase();
    if (!cacheKey) return null;
    const cached = publicLolMatchDetailCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.match;
    if (cached) publicLolMatchDetailCache.delete(cacheKey);
    const running = publicLolMatchDetailInFlight.get(cacheKey);
    if (running) return running;

    const request = input.riot.getMatch(matchId)
      .then((match) => {
        if (match) rememberPublicLolMatchDetail(match);
        return match;
      })
      .finally(() => {
        publicLolMatchDetailInFlight.delete(cacheKey);
      });
    publicLolMatchDetailInFlight.set(cacheKey, request);
    return request;
  }

  async function buildPublicLolMatchPageForAccount(
    account: { puuid: string },
    matchStart: number,
    dataDragonVersion: string | undefined
  ): Promise<{
    rawMatches: RiotMatch[];
    recentMatches: PublicLolRecentMatch[];
    recentMatchStart: number;
    nextRecentMatchStart?: number;
    hasMoreRecentMatches: boolean;
  }> {
    if (!input.riot) throw new HttpRequestError(503, { error: "Riot API client를 사용할 수 없습니다." });
    const safeStart = publicLolMatchStart(matchStart);
    const matchIds = await input.riot.getRecentMatchIdsByPuuid(account.puuid, PUBLIC_LOL_PROFILE_MATCH_LOOKUP_COUNT, [], safeStart).catch(() => []);
    const rawMatches = (await Promise.all(
      matchIds.slice(0, PUBLIC_LOL_PROFILE_MATCH_LOOKUP_COUNT).map((matchId) => getPublicLolMatchDetail(matchId).catch(() => null))
    ))
      .filter((match): match is RiotMatch => Boolean(match))
      .filter(isPublicLolQueue)
      .sort((a, b) => publicLolMatchSortTime(b) - publicLolMatchSortTime(a))
      .slice(0, PUBLIC_LOL_PROFILE_MATCH_COUNT);
    const streamerByRiotId = await buildApprovedStreamerStreamsByRiotId(rawMatches.flatMap((match) => match.info.participants.map((participant) => participantRiotId(participant))));
    const recentMatches = (await Promise.all(
      rawMatches.map(async (match) => publicLolRecentMatchFromRiotMatch(
        match,
        account.puuid,
        await dataDragonVersionForMatch(input.dataDragon, match, dataDragonVersion),
        streamerByRiotId
      ))
    )).filter((match): match is PublicLolRecentMatch => Boolean(match));
    const hasMoreRecentMatches = matchIds.length >= PUBLIC_LOL_PROFILE_MATCH_LOOKUP_COUNT;
    return {
      rawMatches,
      recentMatches,
      recentMatchStart: safeStart,
      nextRecentMatchStart: hasMoreRecentMatches ? safeStart + PUBLIC_LOL_PROFILE_MATCH_COUNT : undefined,
      hasMoreRecentMatches
    };
  }

  function currentGameCacheTtl(response: PublicLolCurrentGame): number {
    if (response.status === "live") return PUBLIC_LOL_CURRENT_GAME_LIVE_CACHE_TTL_MS;
    if (response.status === "not_found") return PUBLIC_LOL_CURRENT_GAME_NOT_FOUND_CACHE_TTL_MS;
    return PUBLIC_LOL_CURRENT_GAME_ERROR_CACHE_TTL_MS;
  }

  function currentGameParticipantRiotId(participant: RiotCurrentGameInfo["participants"][number]): string | undefined {
    if (participant.riotId) return participant.riotId;
    if (participant.riotIdGameName && participant.riotIdTagline) return `${participant.riotIdGameName}#${participant.riotIdTagline}`;
    return participant.summonerName;
  }

  async function currentGameParticipantRankedStats(
    participant: RiotCurrentGameInfo["participants"][number],
    riotId: string | undefined,
    fetchedAt: string
  ): Promise<LolRankedStats | undefined> {
    let rankedStats: LolRankedStats | undefined;
    if (riotId) {
      const parsed = parseRiotIdDetailed(riotId);
      rankedStats = parsed.ok ? cachedRankedStatsForRiotId(parsed.gameName, parsed.tagLine) : undefined;
    }
    if (!rankedStats && participant.puuid && input.riot && typeof input.riot.getRankedStatsByPuuid === "function") {
      rankedStats = await input.riot.getRankedStatsByPuuid(participant.puuid).catch(() => undefined);
    }
    rememberPublicLolParticipantRank(riotId, rankedStats, fetchedAt);
    return rankedStats ? { ...rankedStats } : undefined;
  }

  async function buildPublicLolCurrentGame(targetPuuid: string): Promise<PublicLolCurrentGame> {
    const fetchedAt = new Date().toISOString();
    const routing = input.riot?.routingStatus();
    const base = { lolPlatform: routing?.lolPlatform, fetchedAt };
    if (!input.riot || typeof input.riot.getCurrentGameByPuuid !== "function") {
      return {
        isLive: false,
        status: "unavailable",
        message: "Riot Spectator API client를 사용할 수 없습니다.",
        errorCode: "RIOT_CLIENT_UNAVAILABLE",
        participants: [],
        ...base
      };
    }
    if (!input.riot.isConfigured()) {
      return {
        isLive: false,
        status: "unavailable",
        message: "Riot API key가 설정되어 있지 않습니다.",
        errorCode: "RIOT_AUTH",
        participants: [],
        ...base
      };
    }
    const game = await input.riot.getCurrentGameByPuuid(targetPuuid).catch((error) => {
      if (error instanceof RiotApiHttpError && error.status === 404) return null;
      input.logger?.error({
        type: "public_lol.current_game_lookup_failed",
        lolPlatform: routing?.lolPlatform,
        error: toSafeErrorMessage(error)
      });
      return {
        error
      };
    });
    if (!game) return { isLive: false, status: "not_found", participants: [], ...base };
    if ("error" in game) {
      return {
        isLive: false,
        status: "unavailable",
        message: publicLolErrorMessage(game.error),
        errorCode: publicLolCurrentGameErrorCode(game.error),
        participants: [],
        ...base
      };
    }
    return {
      isLive: true,
      status: "live",
      gameId: String(game.gameId),
      queueId: game.gameQueueConfigId,
      gameMode: game.gameMode,
      gameType: game.gameType,
      mapId: game.mapId,
      startedAt: Number.isFinite(game.gameStartTime) ? new Date(game.gameStartTime).toISOString() : undefined,
      gameLengthSeconds: safeOptionalStat(game.gameLength),
      participants: await Promise.all(game.participants.map(async (participant): Promise<PublicLolCurrentGameParticipant> => {
        const riotId = currentGameParticipantRiotId(participant);
        const summonerSpells = [participant.spell1Id, participant.spell2Id]
          .filter((spellId): spellId is number => Number.isFinite(spellId));
        const [champion, rankedStats, iconUrl] = await Promise.all([
          mapChampionSummary(input.dataDragon, { championId: participant.championId }),
          currentGameParticipantRankedStats(participant, riotId, fetchedAt),
          profileIconUrl(input.dataDragon, participant.profileIconId)
        ]);
        return {
          riotId,
          isTarget: participant.puuid === targetPuuid,
          teamId: participant.teamId,
          summonerSpells,
          profileIconUrl: iconUrl,
          rankedStats,
          bot: participant.bot === true,
          champion
        };
      })),
      ...base
    };
  }

  async function getPublicLolCurrentGame(cacheKey: string, targetPuuid: string): Promise<PublicLolCurrentGame> {
    const cached = publicLolCurrentGameCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.response;
    if (cached) publicLolCurrentGameCache.delete(cacheKey);

    const running = publicLolCurrentGameInFlight.get(cacheKey);
    if (running) return running;

    const request = buildPublicLolCurrentGame(targetPuuid)
      .then((response) => {
        publicLolCurrentGameCache.set(cacheKey, {
          response,
          expiresAt: Date.now() + currentGameCacheTtl(response)
        });
        pruneMapToMax(publicLolCurrentGameCache, PUBLIC_LOL_CURRENT_GAME_CACHE_MAX);
        return response;
      })
      .finally(() => {
        publicLolCurrentGameInFlight.delete(cacheKey);
      });
    publicLolCurrentGameInFlight.set(cacheKey, request);
    return request;
  }

  async function withFreshPublicLolDynamicState(response: PublicLolProfileResponse, key: string): Promise<PublicLolProfileResponse> {
    const targetPuuid = publicLolProfilePuuidCache.get(key);
    const [liveGame, twitchStream] = await Promise.all([
      targetPuuid ? getPublicLolCurrentGame(key, targetPuuid).catch(() => response.liveGame) : Promise.resolve(response.liveGame),
      buildPublicLolTwitchStream(response.gameName, response.tagLine).catch(() => response.twitchStream)
    ]);
    return { ...response, liveGame, twitchStream };
  }

  async function buildPublicLolProfile(rawRiotId: string): Promise<PublicLolProfileResponse> {
    const parsed = parseRiotIdDetailed(rawRiotId);
    if (!parsed.ok) throw new HttpRequestError(400, { error: parsed.message, code: parsed.code });
    if (!input.riot) throw new HttpRequestError(503, { error: "Riot API client를 사용할 수 없습니다." });
    if (!input.riot.isConfigured()) throw new HttpRequestError(503, { error: "Riot API key가 설정되어 있지 않습니다." });

    const account = await input.riot.getAccountByRiotId(parsed.gameName, parsed.tagLine).catch((error) => {
      throw new HttpRequestError(502, { error: publicLolErrorMessage(error) });
    });
    if (!account?.puuid) throw new HttpRequestError(404, { error: "Riot 계정을 찾지 못했습니다." });

    const routing = input.riot.routingStatus();
    const existingProfile = input.profileRepository?.getByPuuid(account.puuid) ?? input.profileRepository?.getByRiotId(account.gameName || parsed.gameName, account.tagLine || parsed.tagLine);
    const requestedCacheKey = publicLolProfileCacheKey(parsed.gameName, parsed.tagLine);
    const responseCacheKey = publicLolProfileCacheKey(account.gameName || parsed.gameName, account.tagLine || parsed.tagLine);
    publicLolProfilePuuidCache.set(requestedCacheKey, account.puuid);
    publicLolProfilePuuidCache.set(responseCacheKey, account.puuid);
    pruneMapToMax(publicLolProfilePuuidCache, PUBLIC_LOL_PROFILE_CACHE_MAX * 2);
    const rankedQueuesRequest: Promise<PublicLolRankedQueues> = typeof input.riot.getRankedQueueStatsByPuuid === "function"
      ? input.riot.getRankedQueueStatsByPuuid(account.puuid).catch((): PublicLolRankedQueues => ({}))
      : input.riot.getRankedStatsByPuuid(account.puuid).then((stats): PublicLolRankedQueues => ({
        solo: stats?.queueType === "RANKED_SOLO_5x5" ? stats : undefined,
        flex: stats?.queueType === "RANKED_FLEX_SR" ? stats : undefined,
        ranked5v5: stats?.queueType === "RANKED_TEAM_5x5" ? stats : undefined,
        primary: stats
      })).catch((): PublicLolRankedQueues => ({}));
    const [rankedQueues, mastery] = await Promise.all([
      rankedQueuesRequest,
      input.riot.getChampionMasteryTopByPuuid(account.puuid, PUBLIC_LOL_PROFILE_TOP_CHAMPION_COUNT).catch(() => [])
    ]);
    const rankedStats = rankedQueues.primary;
    const dataDragonVersion = await dataDragonLatestVersion(input.dataDragon);
    const [matchPage, liveGame] = await Promise.all([
      buildPublicLolMatchPageForAccount(account, 0, dataDragonVersion),
      getPublicLolCurrentGame(requestedCacheKey, account.puuid)
    ]);
    const matches = matchPage.rawMatches;

    const topChampions = await Promise.all(mastery.slice(0, PUBLIC_LOL_PROFILE_TOP_CHAMPION_COUNT).map((champion) => mapChampionSummary(input.dataDragon, {
      championId: champion.championId,
      masteryLevel: champion.championLevel,
      masteryPoints: champion.championPoints
    })));

    const visibleRecentMatches = matchPage.recentMatches;
    const recentWins = visibleRecentMatches.filter((match) => match.result === "win").length;
    const recentKills = visibleRecentMatches.reduce((sum, match) => sum + match.kills, 0);
    const recentDeaths = visibleRecentMatches.reduce((sum, match) => sum + match.deaths, 0);
    const recentAssists = visibleRecentMatches.reduce((sum, match) => sum + match.assists, 0);

    const fetchedAt = new Date().toISOString();
    const rankHistory = buildRankHistory(existingProfile?.rankHistory, rankedStats, fetchedAt);
    const twitchStream = await buildPublicLolTwitchStream(account.gameName || parsed.gameName, account.tagLine || parsed.tagLine);
    const response: PublicLolProfileResponse = {
      status: "ready",
      riotId: `${account.gameName || parsed.gameName}#${account.tagLine || parsed.tagLine}`,
      gameName: account.gameName || parsed.gameName,
      tagLine: account.tagLine || parsed.tagLine,
      accountRegion: routing.accountRegion,
      lolPlatform: routing.lolPlatform,
      profileIconUrl: await profileIconUrl(input.dataDragon, rankedStats?.profileIconId),
      summonerLevel: rankedStats?.summonerLevel,
      ladderRank: existingProfile?.ladderRank,
      rankedStats,
      rankedQueues: {
        solo: rankedQueues.solo,
        flex: rankedQueues.flex,
        ranked5v5: rankedQueues.ranked5v5
      },
      rankHistory,
      twitchStream,
      performanceStats: performanceStatsFromMatches(matches, account.puuid),
      roleAnalysis: inferMainRoleFromMatches(matches, account.puuid, 45),
      topChampions,
      recentMatches: visibleRecentMatches,
      liveGame,
      recentMatchStart: matchPage.recentMatchStart,
      nextRecentMatchStart: matchPage.nextRecentMatchStart,
      hasMoreRecentMatches: matchPage.hasMoreRecentMatches,
      summary: {
        recentGames: visibleRecentMatches.length,
        recentWins,
        recentWinRate: recentWinRate(visibleRecentMatches),
        averageKda: visibleRecentMatches.length > 0 ? kdaFromTotals(recentKills, recentDeaths, recentAssists) : undefined,
        averageCsPerMinute: averageDefined(visibleRecentMatches.map((match) => match.csPerMinute), 1),
        averageKillParticipation: averageDefined(visibleRecentMatches.map((match) => match.killParticipation), 0),
        averageDamagePerMinute: averageDefined(visibleRecentMatches.map((match) => match.damagePerMinute), 0),
        averageDamageShare: averageDefined(visibleRecentMatches.map((match) => match.damageShare), 1),
        averageGoldPerMinute: averageDefined(visibleRecentMatches.map((match) => match.goldPerMinute), 0),
        averageVisionScore: averageDefined(visibleRecentMatches.map((match) => match.visionScore), 1),
        totalKills: recentKills,
        totalDeaths: recentDeaths,
        totalAssists: recentAssists
      },
      championPerformance: championPerformance(visibleRecentMatches),
      rolePerformance: rolePerformance(visibleRecentMatches),
      fetchedAt
    };
    rememberPublicLolProfile(response, account.puuid);
    return response;
  }

  function withPublicLolRefreshState(response: PublicLolProfileResponse, key: string): PublicLolProfileResponse {
    const availableAt = publicLolProfileRefreshAvailableAt.get(key);
    if (!availableAt || availableAt <= Date.now()) return { ...response, refreshAvailableAt: undefined };
    return { ...response, refreshAvailableAt: new Date(availableAt).toISOString() };
  }

  function invalidatePublicLolProfileCaches(key: string): void {
    publicLolProfileCacheGeneration.set(key, (publicLolProfileCacheGeneration.get(key) ?? 0) + 1);
    pruneMapToMax(publicLolProfileCacheGeneration, PUBLIC_LOL_PROFILE_CACHE_MAX * 2);
    publicLolProfileCache.delete(key);
    publicLolProfileInFlight.delete(key);
    publicLolProfilePuuidCache.delete(key);
    publicLolCurrentGameCache.delete(key);
    publicLolCurrentGameInFlight.delete(key);
    const matchPagePrefix = `${key}:matches:`;
    for (const cacheKey of publicLolMatchPageCache.keys()) {
      if (cacheKey.startsWith(matchPagePrefix)) publicLolMatchPageCache.delete(cacheKey);
    }
    for (const cacheKey of publicLolMatchPageInFlight.keys()) {
      if (cacheKey.startsWith(matchPagePrefix)) publicLolMatchPageInFlight.delete(cacheKey);
    }
    publicLolMatchRankCache.clear();
    publicLolMatchRankInFlight.clear();
    publicLolMatchBuildCache.clear();
    publicLolMatchBuildInFlight.clear();
  }

  function invalidatePublicLolProfileCachesForStreamer(request: StreamerRiotIdRequest | undefined): void {
    if (!request?.riotGameName || !request.riotTagLine) return;
    invalidatePublicLolProfileCaches(publicLolProfileCacheKey(request.riotGameName, request.riotTagLine));
  }

  async function getPublicLolProfile(rawRiotId: string, options: { refresh?: boolean } = {}): Promise<PublicLolProfileResponse> {
    const parsed = parseRiotIdDetailed(rawRiotId);
    if (!parsed.ok) throw new HttpRequestError(400, { error: parsed.message, code: parsed.code });
    const key = publicLolProfileCacheKey(parsed.gameName, parsed.tagLine);
    if (options.refresh) {
      const availableAt = publicLolProfileRefreshAvailableAt.get(key) ?? 0;
      const now = Date.now();
      if (availableAt > now) {
        throw new HttpRequestError(429, {
          error: "전적 갱신은 10분에 한 번만 사용할 수 있습니다.",
          code: "REFRESH_COOLDOWN",
          retryAfterMs: availableAt - now,
          refreshAvailableAt: new Date(availableAt).toISOString()
        });
      }
      publicLolProfileRefreshAvailableAt.set(key, now + PUBLIC_LOL_PROFILE_REFRESH_COOLDOWN_MS);
      pruneMapToMax(publicLolProfileRefreshAvailableAt, PUBLIC_LOL_PROFILE_CACHE_MAX * 2);
      invalidatePublicLolProfileCaches(key);
    }
    const cached = publicLolProfileCache.get(key);
    if (!options.refresh && cached && cached.expiresAt > Date.now()) {
      return withPublicLolRefreshState(await withFreshPublicLolDynamicState(cached.response, key), key);
    }
    if (cached) publicLolProfileCache.delete(key);

    const running = publicLolProfileInFlight.get(key);
    if (running) return withPublicLolRefreshState(await running, key);

    const cacheGeneration = publicLolProfileCacheGeneration.get(key) ?? 0;
    const request = buildPublicLolProfile(`${parsed.gameName}#${parsed.tagLine}`)
      .then((response) => {
        if ((publicLolProfileCacheGeneration.get(key) ?? 0) === cacheGeneration) {
          publicLolProfileCache.set(key, {
            response,
            expiresAt: Date.now() + PUBLIC_LOL_PROFILE_CACHE_TTL_MS
          });
          pruneMapToMax(publicLolProfileCache, PUBLIC_LOL_PROFILE_CACHE_MAX);
        }
        return response;
      })
      .finally(() => {
        publicLolProfileInFlight.delete(key);
      });
    publicLolProfileInFlight.set(key, request);
	    return withPublicLolRefreshState(await request, key);
	  }

  async function buildPublicLolMatchPage(rawRiotId: string, start: number): Promise<PublicLolMatchPageResponse> {
    const parsed = parseRiotIdDetailed(rawRiotId);
    if (!parsed.ok) throw new HttpRequestError(400, { error: parsed.message, code: parsed.code });
    if (!input.riot) throw new HttpRequestError(503, { error: "Riot API client를 사용할 수 없습니다." });
    if (!input.riot.isConfigured()) throw new HttpRequestError(503, { error: "Riot API key가 설정되어 있지 않습니다." });

    const account = await input.riot.getAccountByRiotId(parsed.gameName, parsed.tagLine).catch((error) => {
      throw new HttpRequestError(502, { error: publicLolErrorMessage(error) });
    });
    if (!account?.puuid) throw new HttpRequestError(404, { error: "Riot 계정을 찾지 못했습니다." });

    const routing = input.riot.routingStatus();
    const dataDragonVersion = await dataDragonLatestVersion(input.dataDragon);
    const matchPage = await buildPublicLolMatchPageForAccount(account, start, dataDragonVersion);
    return {
      status: "ready",
      riotId: `${account.gameName || parsed.gameName}#${account.tagLine || parsed.tagLine}`,
      gameName: account.gameName || parsed.gameName,
      tagLine: account.tagLine || parsed.tagLine,
      accountRegion: routing.accountRegion,
      lolPlatform: routing.lolPlatform,
      recentMatches: matchPage.recentMatches,
      recentMatchStart: matchPage.recentMatchStart,
      nextRecentMatchStart: matchPage.nextRecentMatchStart,
      hasMoreRecentMatches: matchPage.hasMoreRecentMatches,
      fetchedAt: new Date().toISOString()
    };
  }

  async function getPublicLolMatchPage(rawRiotId: string, start: number): Promise<PublicLolMatchPageResponse> {
    const parsed = parseRiotIdDetailed(rawRiotId);
    if (!parsed.ok) throw new HttpRequestError(400, { error: parsed.message, code: parsed.code });
    const safeStart = publicLolMatchStart(start);
    const cacheKey = `${publicLolProfileCacheKey(parsed.gameName, parsed.tagLine)}:matches:${safeStart}`;
    const cached = publicLolMatchPageCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.response;
    if (cached) publicLolMatchPageCache.delete(cacheKey);

    const running = publicLolMatchPageInFlight.get(cacheKey);
    if (running) return running;

    const request = buildPublicLolMatchPage(`${parsed.gameName}#${parsed.tagLine}`, safeStart)
      .then((response) => {
        publicLolMatchPageCache.set(cacheKey, {
          response,
          expiresAt: Date.now() + PUBLIC_LOL_PROFILE_CACHE_TTL_MS
        });
        pruneMapToMax(publicLolMatchPageCache, PUBLIC_LOL_MATCH_CACHE_MAX);
        return response;
      })
      .finally(() => {
        publicLolMatchPageInFlight.delete(cacheKey);
      });
    publicLolMatchPageInFlight.set(cacheKey, request);
    return request;
  }

	  async function buildPublicLolMatchRanks(matchId: string): Promise<PublicLolMatchRankResponse> {
    if (!input.riot) throw new HttpRequestError(503, { error: "Riot API client를 사용할 수 없습니다." });
    if (!input.riot.isConfigured()) throw new HttpRequestError(503, { error: "Riot API key가 설정되어 있지 않습니다." });

    const match = await getPublicLolMatchDetail(matchId).catch((error) => {
      throw new HttpRequestError(502, { error: publicLolErrorMessage(error) });
    });
    if (!match) throw new HttpRequestError(404, { error: "경기 상세 정보를 찾지 못했습니다." });

    const fetchedAt = new Date().toISOString();
    const participants = await Promise.all(match.info.participants.map(async (participant): Promise<PublicLolMatchRankParticipant> => {
      const riotId = participantRiotId(participant);
      let rankedStats = await input.riot?.getRankedStatsByPuuid(participant.puuid).catch(() => undefined);
      if (!rankedStats && riotId) {
        const parsed = parseRiotIdDetailed(riotId);
        rankedStats = parsed.ok ? cachedRankedStatsForRiotId(parsed.gameName, parsed.tagLine) : undefined;
      }
      rememberPublicLolParticipantRank(riotId, rankedStats, fetchedAt);
      return {
        riotId,
        teamId: participant.teamId,
        championId: participant.championId,
        position: participant.individualPosition || participant.teamPosition,
        rankedStats: rankedStats ? { ...rankedStats } : undefined
      };
    }));

    return {
      status: "ready",
      matchId: match.metadata.matchId || matchId,
      participants,
      fetchedAt
    };
  }

  function timelineParticipantEvents(timeline: RiotMatchTimeline | null, participantId: number | undefined, type: string): Array<{ timestampMs: number; itemId?: number; skillSlot?: number }> {
    if (!timeline || participantId === undefined) return [];
    const events: Array<{ timestampMs: number; itemId?: number; skillSlot?: number }> = [];
    for (const frame of timeline.info.frames ?? []) {
      for (const event of frame.events ?? []) {
        if (event.type !== type || safeOptionalStat(event.participantId) !== participantId) continue;
        events.push({
          timestampMs: safeOptionalStat(event.timestamp) ?? safeOptionalStat(frame.timestamp) ?? 0,
          itemId: safeOptionalStat(event.itemId),
          skillSlot: safeOptionalStat(event.skillSlot)
        });
      }
    }
    return events.sort((a, b) => a.timestampMs - b.timestampMs);
  }

  function publicLolBuildItemEvents(timeline: RiotMatchTimeline | null, participantId: number | undefined, version: string | undefined): PublicLolMatchBuildItemEvent[] {
    return timelineParticipantEvents(timeline, participantId, "ITEM_PURCHASED")
      .filter((event) => event.itemId !== undefined && event.itemId > 0)
      .map((event) => ({
        itemId: event.itemId!,
        iconUrl: version ? itemIconUrl(version, event.itemId!) : undefined,
        timestampMs: event.timestampMs
      }));
  }

  function abilityForSlot(abilities: LolChampionAbilitySummary[], slot: number | undefined): LolChampionAbilitySummary | undefined {
    return abilities.find((ability) => ability.slot === slot);
  }

  function skillKeyForSlot(slot: number | undefined): "Q" | "W" | "E" | "R" {
    if (slot === 2) return "W";
    if (slot === 3) return "E";
    if (slot === 4) return "R";
    return "Q";
  }

  function publicLolBuildSkillOrder(
    timeline: RiotMatchTimeline | null,
    participantId: number | undefined,
    abilities: LolChampionAbilitySummary[]
  ): PublicLolMatchBuildSkillEvent[] {
    return timelineParticipantEvents(timeline, participantId, "SKILL_LEVEL_UP")
      .filter((event) => event.skillSlot !== undefined && event.skillSlot >= 1 && event.skillSlot <= 4)
      .map((event, index) => {
        const ability = abilityForSlot(abilities, event.skillSlot);
        return {
          slot: event.skillSlot!,
          key: ability?.key ?? skillKeyForSlot(event.skillSlot),
          level: index + 1,
          timestampMs: event.timestampMs,
          nameKo: ability?.nameKo,
          nameJa: ability?.nameJa,
          iconUrl: ability?.iconUrl
        };
      });
  }

  async function buildPublicLolMatchBuild(matchId: string): Promise<PublicLolMatchBuildResponse> {
    if (!input.riot) throw new HttpRequestError(503, { error: "Riot API client를 사용할 수 없습니다." });
    if (!input.riot.isConfigured()) throw new HttpRequestError(503, { error: "Riot API key가 설정되어 있지 않습니다." });

    const match = await getPublicLolMatchDetail(matchId).catch((error) => {
      throw new HttpRequestError(502, { error: publicLolErrorMessage(error) });
    });
    if (!match) throw new HttpRequestError(404, { error: "경기 상세 정보를 찾지 못했습니다." });

    const timeline = await input.riot.getMatchTimeline(match.metadata.matchId || matchId).catch(() => null);
    const fallbackDataDragonVersion = await dataDragonLatestVersion(input.dataDragon);
    const dataDragonVersion = await dataDragonVersionForMatch(input.dataDragon, match, fallbackDataDragonVersion);
    const participants = await Promise.all(match.info.participants.map(async (participant): Promise<PublicLolMatchBuildParticipant> => {
      const participantId = safeOptionalStat(participant.participantId);
      const champion = await mapChampionSummary(input.dataDragon, {
        championId: participant.championId,
        championName: participant.championName
      });
      const abilities = input.dataDragon
        ? await input.dataDragon.getChampionAbilities(participant.championId, dataDragonVersion).catch(() => [])
        : [];
      return {
        participantId,
        riotId: participantRiotId(participant),
        teamId: participant.teamId,
        result: participant.win === true ? "win" : participant.win === false ? "loss" : "unknown",
        champion,
        score: participantImpactScore(match, participant),
        items: participantItems(participant, dataDragonVersion),
        itemEvents: publicLolBuildItemEvents(timeline, participantId, dataDragonVersion),
        skillOrder: publicLolBuildSkillOrder(timeline, participantId, abilities),
        runes: await participantRunes(input.dataDragon, dataDragonVersion, participant),
        summonerSpells: participantSummonerSpells(participant),
        badges: publicLolMatchBadges(match, participant)
      };
    }));

    return {
      status: "ready",
      matchId: match.metadata.matchId || matchId,
      dataDragonVersion,
      participants: participants.sort((a, b) => (a.teamId ?? 0) - (b.teamId ?? 0)),
      fetchedAt: new Date().toISOString()
    };
  }

  async function getPublicLolMatchBuild(rawMatchId: string): Promise<PublicLolMatchBuildResponse> {
    const matchId = rawMatchId.trim();
    if (!matchId) throw new HttpRequestError(400, { error: "matchId가 필요합니다." });
    const cacheKey = matchId.toUpperCase();
    const cached = publicLolMatchBuildCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.response;
    if (cached) publicLolMatchBuildCache.delete(cacheKey);

    const running = publicLolMatchBuildInFlight.get(cacheKey);
    if (running) return running;

    const request = buildPublicLolMatchBuild(matchId)
      .then((response) => {
        publicLolMatchBuildCache.set(cacheKey, {
          response,
          expiresAt: Date.now() + PUBLIC_LOL_MATCH_BUILD_CACHE_TTL_MS
        });
        pruneMapToMax(publicLolMatchBuildCache, PUBLIC_LOL_MATCH_CACHE_MAX);
        return response;
      })
      .finally(() => {
        publicLolMatchBuildInFlight.delete(cacheKey);
      });
    publicLolMatchBuildInFlight.set(cacheKey, request);
    return request;
  }

  async function getPublicLolMatchRanks(rawMatchId: string): Promise<PublicLolMatchRankResponse> {
    const matchId = rawMatchId.trim();
    if (!matchId || matchId.length > 96 || !/^[A-Z0-9_]+$/i.test(matchId)) {
      throw new HttpRequestError(400, { error: "올바르지 않은 match id입니다.", code: "INVALID_MATCH_ID" });
    }

    const cacheKey = matchId.toUpperCase();
    const cached = publicLolMatchRankCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.response;
    if (cached) publicLolMatchRankCache.delete(cacheKey);

    const running = publicLolMatchRankInFlight.get(cacheKey);
    if (running) return running;

    const request = buildPublicLolMatchRanks(matchId)
      .then((response) => {
        publicLolMatchRankCache.set(cacheKey, {
          response,
          expiresAt: Date.now() + PUBLIC_LOL_MATCH_RANK_CACHE_TTL_MS
        });
        pruneMapToMax(publicLolMatchRankCache, PUBLIC_LOL_MATCH_CACHE_MAX);
        return response;
      })
      .finally(() => {
        publicLolMatchRankInFlight.delete(cacheKey);
      });
    publicLolMatchRankInFlight.set(cacheKey, request);
    return request;
  }

  function currentStreamerRefreshKey(): string {
    return loadGameMonitorConfig().streamerRiotId.trim().toLocaleLowerCase();
  }

  function followerRefreshRuntime(broadcasterUserId: string): FollowerRefreshRuntime {
    const existing = followerRefreshByBroadcaster.get(broadcasterUserId);
    if (existing) return existing;
    const runtime: FollowerRefreshRuntime = { availableAt: 0 };
    followerRefreshByBroadcaster.set(broadcasterUserId, runtime);
    return runtime;
  }

  function followerAuthHttpError(error: unknown): HttpRequestError {
    if (!(error instanceof StreamerFollowerAuthError)) {
      return new HttpRequestError(503, {
        error: "스트리머별 Twitch 팔로워 관리 권한을 확인할 수 없습니다.",
        code: "FOLLOWER_AUTH_UNAVAILABLE"
      });
    }
    if (error.code === "NOT_CONNECTED") {
      return new HttpRequestError(409, { error: error.message, code: "FOLLOWER_OAUTH_REQUIRED" });
    }
    if (error.code === "MISSING_SCOPES") {
      return new HttpRequestError(403, {
        error: error.message,
        code: "FOLLOWER_SCOPE_MISSING",
        missingScopes: error.missingScopes
      });
    }
    if (error.code === "TOKEN_EXPIRED") {
      return new HttpRequestError(409, { error: error.message, code: "FOLLOWER_TOKEN_EXPIRED" });
    }
    if (error.code === "OWNER_MISMATCH") {
      return new HttpRequestError(403, { error: error.message, code: "FOLLOWER_OAUTH_OWNER_MISMATCH" });
    }
    if (error.code === "INVALID_INPUT") {
      return new HttpRequestError(403, { error: "스트리머 계정 정보가 올바르지 않습니다.", code: "FOLLOWER_OWNER_INVALID" });
    }
    return new HttpRequestError(502, { error: error.message, code: "FOLLOWER_OAUTH_FAILED" });
  }

  function requireStreamerFollowerAuth(): StreamerFollowerAuthService {
    if (!input.streamerFollowerAuth) {
      throw new HttpRequestError(503, {
        error: "스트리머별 Twitch 팔로워 관리 권한 서비스를 사용할 수 없습니다.",
        code: "FOLLOWER_AUTH_UNAVAILABLE"
      });
    }
    return input.streamerFollowerAuth;
  }

  async function followerManagementResponse(broadcasterUserId: string): Promise<FollowerManagementResponse> {
    const followerAuth = requireStreamerFollowerAuth();
    try {
      return {
        ...input.store.getFollowerManagementState(broadcasterUserId),
        oauth: await followerAuth.getStatus(broadcasterUserId)
      };
    } catch (error) {
      throw followerAuthHttpError(error);
    }
  }

  async function followerSnapshotForBroadcaster(broadcasterUserId: string, limit: number) {
    if (!input.twitch) {
      throw new HttpRequestError(503, {
        error: "Twitch API client를 사용할 수 없습니다.",
        code: "FOLLOWER_TWITCH_UNAVAILABLE"
      });
    }
    const followerAuth = requireStreamerFollowerAuth();
    try {
      let context = await followerAuth.getAccessContext(broadcasterUserId);
      try {
        return await input.twitch.getChannelFollowersForBroadcaster(context, broadcasterUserId, limit);
      } catch (error) {
        if (!(error instanceof TwitchFollowerLookupError) || error.status !== 401) throw error;
        context = await followerAuth.getAccessContext(broadcasterUserId, { forceRefresh: true });
        try {
          return await input.twitch.getChannelFollowersForBroadcaster(context, broadcasterUserId, limit);
        } catch (retryError) {
          if (retryError instanceof TwitchFollowerLookupError && retryError.status === 401) {
            await followerAuth.markAccessTokenRejected(broadcasterUserId, context.accessToken);
          }
          throw retryError;
        }
      }
    } catch (error) {
      if (error instanceof StreamerFollowerAuthError) throw followerAuthHttpError(error);
      if (error instanceof TwitchFollowerLookupError && error.status === 401) {
        throw new HttpRequestError(409, {
          error: "Twitch 팔로워 관리 token이 만료되었거나 취소되었습니다. 다시 연결해주세요.",
          code: "FOLLOWER_TOKEN_EXPIRED"
        });
      }
      if (error instanceof TwitchFollowerLookupError && error.status === 403) {
        throw new HttpRequestError(403, {
          error: "Twitch 팔로워 조회 권한이 부족합니다. 운영 권한을 다시 승인해주세요.",
          code: "FOLLOWER_SCOPE_MISSING",
          missingScopes: ["moderator:read:followers"]
        });
      }
      if (error instanceof TwitchFollowerLookupError && error.status === 429) {
        throw new HttpRequestError(429, {
          error: "Twitch API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
          code: "FOLLOWER_TWITCH_RATE_LIMITED"
        });
      }
      throw new HttpRequestError(502, {
        error: "Twitch 팔로워 목록을 조회하지 못했습니다.",
        code: "FOLLOWER_TWITCH_LOOKUP_FAILED"
      });
    }
  }

  async function refreshFollowerSnapshot(
    broadcasterUserId: string,
    limit: number,
    runtime: FollowerRefreshRuntime
  ): Promise<FollowerManagementResponse> {
    const snapshot = await followerSnapshotForBroadcaster(broadcasterUserId, limit);
    input.store.reconcileFollowerSnapshot({
      broadcasterUserId,
      followers: snapshot.followers,
      total: snapshot.total,
      truncated: snapshot.truncated
    });
    const response = await followerManagementResponse(broadcasterUserId);
    runtime.lastState = response;
    runtime.availableAt = Date.now() + FOLLOWER_REFRESH_COOLDOWN_MS;
    return response;
  }

  async function loadFreshSkinOptions(): Promise<SkinOptionsResponse> {
    const settings = loadLolParticipationProfileSettings();
    const monitor = loadGameMonitorConfig();
    const streamerRiotId = monitor.streamerRiotId.trim();
    if (!streamerRiotId) {
      return { status: "missing_streamer", streamerRiotId, skins: [], selectedSkinNum: 0 };
    }
    if (!input.riot?.isConfigured()) {
      return { status: "riot_not_configured", streamerRiotId, skins: [], selectedSkinNum: 0 };
    }
    if (!input.dataDragon) {
      throw new Error("Data Dragon service를 사용할 수 없습니다.");
    }
    const parsed = parseRiotIdDetailed(streamerRiotId);
    if (!parsed.ok) {
      return { status: "invalid_streamer", streamerRiotId, skins: [], selectedSkinNum: 0, message: parsed.message };
    }
    const account = await input.riot.getAccountByRiotId(parsed.gameName, parsed.tagLine);
    if (!account?.puuid) {
      return { status: "not_found", streamerRiotId, skins: [], selectedSkinNum: 0 };
    }
    const mastery = await input.riot.getChampionMasteryTopByPuuid(account.puuid, 1);
    const topChampion = mastery[0];
    if (!topChampion?.championId) {
      return { status: "no_mastery", streamerRiotId, skins: [], selectedSkinNum: 0 };
    }
    const skinOptions = await input.dataDragon.getChampionSkinOptions(topChampion.championId);
    return {
      status: "ready",
      streamerRiotId,
      champion: {
        ...skinOptions.champion,
        masteryLevel: topChampion.championLevel,
        masteryPoints: topChampion.championPoints
      },
      skins: skinOptions.skins,
      selectedSkinNum: selectedChampionSkinNum(skinOptions.champion, settings.championSkinOverrides)
    };
  }

  async function getSkinOptionsWithCache(): Promise<{ response: SkinOptionsResponse; headers: Record<string, string> }> {
    const settings = loadLolParticipationProfileSettings();
    const streamerRiotId = loadGameMonitorConfig().streamerRiotId.trim();
    const cacheKey = `${streamerRiotId.toLocaleLowerCase()}:${sortedJson(settings.championSkinOverrides)}`;
    const cached = skinOptionsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { response: cached.response, headers: { "X-StreamOps-Cache": "hit" } };
    }
    const running = skinOptionsInFlight.get(cacheKey);
    if (running) {
      const response = await running;
      return { response, headers: { "X-StreamOps-Cache": "in-flight" } };
    }
    const request = loadFreshSkinOptions()
      .then((response) => {
        skinOptionsCache.set(cacheKey, { response, expiresAt: Date.now() + SKIN_OPTIONS_CACHE_TTL_MS });
        return response;
      })
      .finally(() => {
        skinOptionsInFlight.delete(cacheKey);
      });
    skinOptionsInFlight.set(cacheKey, request);
    return { response: await request, headers: { "X-StreamOps-Cache": "miss" } };
  }

  return async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) return sendJson(req, res, 404, { error: "not found" });
    if (req.method === "OPTIONS") return sendJson(req, res, 204, {});
    const url = new URL(req.url, "http://localhost");
    const ip = clientIp(req);

    if (shouldRedirectToHttps(req, url.pathname)) {
      sendHttpsRedirect(res, req.url);
      return;
    }

    try {
      if (req.method === "GET" || req.method === "HEAD") {
        if (url.pathname === "/dashborad" || url.pathname === "/dashborad/") return sendRedirect(res, "/");
        if (await sendPublicDashboardAsset(req, res, url.pathname)) return;
        if (url.pathname === "/" || isPublicDashboardAppRoute(url.pathname)) {
          const legalDraftHeaders = url.pathname === "/privacy" || url.pathname === "/terms"
            ? { "X-Robots-Tag": "noindex, nofollow" }
            : undefined;
          await sendStaticFile(req, res, path.resolve(appConfig.paths.dashboardStatic, "index.html"), legalDraftHeaders, "/dashboard");
          return;
        }
      }
      if ((req.method === "GET" || req.method === "HEAD") && await sendOverlayAlertAsset(req, res, url.pathname)) return;
      if ((req.method === "GET" || req.method === "HEAD") && await sendCommunityAsset(req, res, url.pathname)) return;
      if ((req.method === "GET" || req.method === "HEAD") && await sendLocalTtsAsset(req, res, url.pathname)) return;
      if (
        (req.method === "GET" || req.method === "HEAD") &&
        await sendRankedEmblemAsset(req, res, url.pathname, input.logger)
      ) return;
      if (
        (req.method === "GET" || req.method === "HEAD") &&
        url.pathname.startsWith("/images/") &&
        await sendStaticApp(req, res, `/dashboard${url.pathname}`, "/dashboard", appConfig.paths.dashboardStatic)
      ) return;
      if ((req.method === "GET" || req.method === "HEAD") && await sendStaticApp(req, res, url.pathname, "/admin", appConfig.paths.dashboardStatic)) return;
      if ((req.method === "GET" || req.method === "HEAD") && await sendStaticApp(req, res, url.pathname, "/dashboard", appConfig.paths.dashboardStatic)) return;
      if ((req.method === "GET" || req.method === "HEAD") && await sendStaticApp(req, res, url.pathname, "/overlay", appConfig.paths.overlayStatic)) return;

      if (url.pathname.startsWith("/api/")) {
        const rateLimitPath = url.pathname.startsWith("/api/palworld/") ? "/api/palworld" : url.pathname;
        const limitKey = `${ip}:${rateLimitPath}`;
        const limiter = url.pathname === "/api/inbound-email/cloudflare"
          ? inboundEmailLimiter
          : url.pathname.startsWith("/api/dashboard/auth/")
          ? dashboardLoginLimiter
          : url.pathname.startsWith("/api/twitch/auth/") || url.pathname.startsWith("/api/public/twitch/auth/")
            ? oauthLimiter
            : url.pathname.startsWith("/api/lol/") || url.pathname.startsWith("/api/palworld/") || url.pathname.startsWith("/api/public/twitch/") || url.pathname.startsWith("/api/public/tournaments") || url.pathname.startsWith("/api/public/community/") || url.pathname.startsWith("/api/public/participation/") || url.pathname === "/api/public/locale"
              ? publicLolApiLimiter
              : dashboardApiLimiter;
        const limited = limiter.check(limitKey);
        if (!limited.ok) return sendJson(req, res, 429, { error: "rate limit exceeded" }, { "Retry-After": String(limited.retryAfterSeconds) });
      }

      const auth = authorizeHttpRequest(req, url.pathname, sessions);
      if (!auth.ok) {
        return sendJson(req, res, auth.status, { error: auth.message, code: auth.code });
      }

      if (req.method === "POST" && url.pathname === "/api/inbound-email/cloudflare") {
        if (!appConfig.supportMailbox.enabled || !input.supportMailbox) {
          return sendJson(req, res, 503, { error: "지원 메일함이 활성화되지 않았습니다." });
        }
        const body = await readRawBody(req, MAX_INBOUND_EMAIL_WEBHOOK_BYTES);
        if (!verifyInboundEmailSignature(req, body, appConfig.supportMailbox.webhookSecret)) {
          return sendJson(req, res, 401, { error: "inbound email signature가 올바르지 않습니다." });
        }
        const payload = parseSupportMailInboundPayload(body);
        if (payload.envelopeTo !== appConfig.supportMailbox.address) {
          return sendJson(req, res, 400, { error: "허용되지 않은 지원 메일 수신 주소입니다." });
        }
        const saved = await input.supportMailbox.add(payload);
        return sendJson(req, res, saved.deduplicated ? 200 : 202, {
          ok: true,
          id: saved.message.id,
          deduplicated: saved.deduplicated
        });
      }

      if (req.method === "GET" && url.pathname === "/health") {
        return sendJson(req, res, 200, { ok: true, build: appConfig.build });
      }
      if (req.method === "GET" && url.pathname === "/health/live") {
        return sendJson(req, res, 200, buildLivenessResponse({
          startedAt: SERVER_PROCESS_STARTED_AT,
          uptimeSeconds: Math.max(0, Math.floor(process.uptime())),
          build: appConfig.build
        }));
      }
      if (req.method === "GET" && url.pathname === "/health/ready") {
        const shuttingDown = input.isShuttingDown?.() ?? false;
        const readiness = resolveReadiness(input.readiness, shuttingDown);
        return sendJson(
          req,
          res,
          readiness.ok ? 200 : 503,
          buildReadinessResponse(readiness, appConfig.build)
        );
      }
      if (req.method === "GET" && url.pathname === "/api/palworld/meta") {
        return sendJson(req, res, 200, palworldDataService.meta(), PALWORLD_CACHE_HEADERS);
      }
      if (req.method === "GET" && url.pathname === "/api/palworld/search") {
        const query = parsePalworldSearchQuery(url.searchParams);
        return sendJson(req, res, 200, palworldDataService.search(query.q, query.limit), PALWORLD_CACHE_HEADERS);
      }
      if (req.method === "GET" && url.pathname === "/api/palworld/pals") {
        const query = parsePalworldPalListQuery(url.searchParams);
        return sendJson(req, res, 200, palworldDataService.listPals(query), PALWORLD_CACHE_HEADERS);
      }
      const palworldPalDetailMatch = url.pathname.match(/^\/api\/palworld\/pals\/([^/]+)$/);
      if (req.method === "GET" && palworldPalDetailMatch?.[1]) {
        const decodedId = decodeUrlPathSegment(palworldPalDetailMatch[1]);
        if (decodedId === undefined) throw new PalworldQueryError("Pal ID 인코딩이 올바르지 않습니다.");
        return sendJson(
          req,
          res,
          200,
          palworldDataService.getPal(parsePalworldId(decodedId, "Pal ID")),
          PALWORLD_CACHE_HEADERS
        );
      }
      if (req.method === "GET" && url.pathname === "/api/palworld/items") {
        const query = parsePalworldItemListQuery(url.searchParams);
        return sendJson(req, res, 200, palworldDataService.listItems(query), PALWORLD_CACHE_HEADERS);
      }
      const palworldItemDetailMatch = url.pathname.match(/^\/api\/palworld\/items\/([^/]+)$/);
      if (req.method === "GET" && palworldItemDetailMatch?.[1]) {
        const decodedId = decodeUrlPathSegment(palworldItemDetailMatch[1]);
        if (decodedId === undefined) throw new PalworldQueryError("아이템 ID 인코딩이 올바르지 않습니다.");
        return sendJson(
          req,
          res,
          200,
          palworldDataService.getItem(parsePalworldId(decodedId, "아이템 ID")),
          PALWORLD_CACHE_HEADERS
        );
      }
      if (req.method === "GET" && url.pathname === "/api/palworld/breeding/parents") {
        const query = parsePalworldBreedingParentsQuery(url.searchParams);
        return sendJson(req, res, 200, palworldDataService.breedingParents(query), PALWORLD_CACHE_HEADERS);
      }
      if (req.method === "GET" && url.pathname === "/api/palworld/breeding") {
        const query = parsePalworldBreedingQuery(url.searchParams);
        return sendJson(req, res, 200, palworldDataService.breeding(query), PALWORLD_CACHE_HEADERS);
      }
      if (req.method === "GET" && url.pathname === "/api/dashboard/auth/status") {
        const surface = dashboardAuthSurface(url.searchParams.get("surface"));
        const principal = authenticateDashboardRequest(req, sessions, surface);
        if (principal?.type === "DASHBOARD_ADMIN") {
          const streamer = principal.role === "streamer"
            ? dashboardEnabledStreamerRiotIdForTwitchUser(principal.twitchUserId)
            : undefined;
          if (principal.role === "streamer" && !streamer) {
            return sendJson(req, res, 200, {
              required: !appConfig.security.localNoAuth,
              configured: Boolean(input.publicTwitchAuth),
              authenticated: false
            }, { "Set-Cookie": clearDashboardSessionCookie("streamer") });
          }
          if (streamer && !streamerDashboardTenantMatches(req, streamer)) {
            sendStreamerDashboardTenantMismatch(req, res, streamer);
            return;
          }
          return sendJson(req, res, 200, {
            required: !appConfig.security.localNoAuth,
            configured: surface === "streamer"
              ? Boolean(input.publicTwitchAuth)
              : appConfig.security.localNoAuth || Boolean(appConfig.security.dashboardAuthToken),
            authenticated: true,
            role: principal.role,
            streamer: streamer ? publicStreamerDashboardInfo(streamer) : undefined,
            csrfToken: principal.method === "session" ? principal.csrfToken : undefined
          });
        }
        if (surface === "streamer" && input.publicTwitchAuth) {
          const publicTwitchStatus = await input.publicTwitchAuth.getStatus(publicTwitchViewerSessionIdFromRequest(req));
          const approvedStreamer = publicTwitchStatus.connected
            ? dashboardEnabledStreamerRiotIdForTwitchUser(publicTwitchStatus.user?.id)
            : undefined;
          if (approvedStreamer && publicTwitchStatus.user) {
            if (!streamerDashboardTenantMatches(req, approvedStreamer)) {
              sendStreamerDashboardTenantMismatch(req, res, approvedStreamer);
              return;
            }
            const session = sessions.create({ role: "streamer", twitchUserId: publicTwitchStatus.user.id });
            return sendJson(req, res, 200, {
              required: !appConfig.security.localNoAuth,
              configured: true,
              authenticated: true,
              role: "streamer",
              streamer: publicStreamerDashboardInfo(approvedStreamer),
              csrfToken: session.csrfToken,
              expiresAt: new Date(session.expiresAt).toISOString()
            }, { "Set-Cookie": dashboardSessionCookie(session) });
          }
        }
        return sendJson(req, res, 200, {
          required: !appConfig.security.localNoAuth,
          configured: surface === "streamer"
            ? Boolean(input.publicTwitchAuth)
            : appConfig.security.localNoAuth || Boolean(appConfig.security.dashboardAuthToken),
          authenticated: false
        });
      }
      if (
        auth.principal.type === "DASHBOARD_ADMIN" &&
        auth.principal.role === "streamer" &&
        url.pathname !== "/api/dashboard/auth/logout"
      ) {
        const streamer = dashboardEnabledStreamerRiotIdForTwitchUser(auth.principal.twitchUserId);
        if (!streamer) {
          return sendJson(req, res, 403, { error: "스트리머 대시보드 사용 권한이 필요합니다.", code: "STREAMER_DASHBOARD_DISABLED" });
        }
        if (!streamerDashboardTenantMatches(req, streamer)) {
          sendStreamerDashboardTenantMismatch(req, res, streamer);
          return;
        }
      }
      if (url.pathname === "/api/dashboard/server-status" && req.method === "GET") {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || auth.principal.role !== "admin") {
          return sendJson(req, res, 403, { error: "관리자 권한이 필요합니다." });
        }
        const shuttingDown = input.isShuttingDown?.() ?? false;
        const readiness = resolveReadiness(input.readiness, shuttingDown);
        const services = input.store.getStatus();
        const uptimeSeconds = Math.max(0, Math.floor(process.uptime()));
        const memory = process.memoryUsage();
        const connections = input.connectionStatus?.() ?? {
          http: 0,
          dashboardWebSocket: 0,
          overlayWebSocket: 0,
          bridge: services.bridge === "connected"
        };
        const response: DashboardServerStatus = {
          collectedAt: new Date().toISOString(),
          status: shuttingDown ? "shutting_down" : readiness.ok ? "ready" : "degraded",
          uptimeSeconds,
          startedAt: services.startedAt ?? new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
          build: { ...appConfig.build },
          runtime: {
            nodeEnv: appConfig.nodeEnv,
            nodeVersion: process.version
          },
          memory: {
            rssBytes: memory.rss,
            heapUsedBytes: memory.heapUsed,
            heapTotalBytes: memory.heapTotal,
            externalBytes: memory.external
          },
          readiness: {
            ok: readiness.ok,
            checks: readiness.checks,
            errors: readiness.errors
          },
          connections,
          services
        };
        return sendJson(req, res, 200, response);
      }
      if (url.pathname === "/api/support-mailbox" && req.method === "GET") {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || auth.principal.role !== "admin") {
          return sendJson(req, res, 403, { error: "관리자 권한이 필요합니다." });
        }
        if (!appConfig.supportMailbox.enabled || !input.supportMailbox) {
          return sendJson(req, res, 200, {
            enabled: false,
            address: appConfig.supportMailbox.address,
            retentionDays: appConfig.supportMailbox.retentionDays,
            totalCount: 0,
            unreadCount: 0,
            messages: []
          });
        }
        const filter = supportMailboxFilter(url.searchParams.get("filter"));
        const limit = Math.max(1, Math.min(200, Math.trunc(Number(url.searchParams.get("limit")) || 100)));
        const messages = await input.supportMailbox.list(filter, limit);
        const counts = await input.supportMailbox.counts();
        return sendJson(req, res, 200, {
          enabled: true,
          address: appConfig.supportMailbox.address,
          retentionDays: appConfig.supportMailbox.retentionDays,
          ...counts,
          messages
        });
      }
      const supportMailboxDetailMatch = url.pathname.match(/^\/api\/support-mailbox\/([^/]+)$/);
      if (req.method === "GET" && supportMailboxDetailMatch) {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || auth.principal.role !== "admin") {
          return sendJson(req, res, 403, { error: "관리자 권한이 필요합니다." });
        }
        if (!input.supportMailbox) return sendJson(req, res, 503, { error: "지원 메일함이 활성화되지 않았습니다." });
        const id = decodeURIComponent(supportMailboxDetailMatch[1] ?? "").trim();
        const message = id ? await input.supportMailbox.get(id) : undefined;
        if (!message) return sendJson(req, res, 404, { error: "문의 메일을 찾을 수 없습니다." });
        return sendJson(req, res, 200, { message });
      }
      const supportMailboxReadMatch = url.pathname.match(/^\/api\/support-mailbox\/([^/]+)\/read$/);
      if (req.method === "POST" && supportMailboxReadMatch) {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || auth.principal.role !== "admin") {
          return sendJson(req, res, 403, { error: "관리자 권한이 필요합니다." });
        }
        if (!input.supportMailbox) return sendJson(req, res, 503, { error: "지원 메일함이 활성화되지 않았습니다." });
        const body = await readJsonBody<{ read?: unknown }>(req);
        if (typeof body.read !== "boolean") return sendJson(req, res, 400, { error: "read는 boolean이어야 합니다." });
        const message = await input.supportMailbox.setRead(decodeURIComponent(supportMailboxReadMatch[1] ?? ""), body.read);
        if (!message) return sendJson(req, res, 404, { error: "문의 메일을 찾을 수 없습니다." });
        return sendJson(req, res, 200, { message });
      }
      if (req.method === "DELETE" && supportMailboxDetailMatch) {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || auth.principal.role !== "admin") {
          return sendJson(req, res, 403, { error: "관리자 권한이 필요합니다." });
        }
        if (!input.supportMailbox) return sendJson(req, res, 503, { error: "지원 메일함이 활성화되지 않았습니다." });
        const deleted = await input.supportMailbox.delete(decodeURIComponent(supportMailboxDetailMatch[1] ?? ""));
        if (!deleted) return sendJson(req, res, 404, { error: "문의 메일을 찾을 수 없습니다." });
        return sendJson(req, res, 200, { ok: true });
      }
      if (req.method === "GET" && url.pathname === "/api/lol/profile") {
        const refresh = url.searchParams.get("refresh") === "1" || url.searchParams.get("refresh") === "true";
        return sendJson(req, res, 200, await getPublicLolProfile(url.searchParams.get("riotId") ?? "", { refresh }));
      }
      if (req.method === "GET" && url.pathname === "/api/lol/matches") {
        return sendJson(req, res, 200, await getPublicLolMatchPage(
          url.searchParams.get("riotId") ?? "",
          publicLolMatchStart(url.searchParams.get("start"))
        ));
      }
      if (req.method === "GET" && url.pathname === "/api/lol/match-ranks") {
        return sendJson(req, res, 200, await getPublicLolMatchRanks(url.searchParams.get("matchId") ?? ""));
      }
      if (req.method === "GET" && url.pathname === "/api/lol/match-build") {
        return sendJson(req, res, 200, await getPublicLolMatchBuild(url.searchParams.get("matchId") ?? ""));
      }
      if (req.method === "GET" && url.pathname === "/api/lol/suggestions") {
        return sendJson(req, res, 200, { suggestions: await buildPublicLolSuggestions(url.searchParams.get("q") ?? "") });
      }
      if (req.method === "GET" && url.pathname === "/api/public/locale") {
        return sendJson(req, res, 200, publicLocalePreference(req));
      }
      if (req.method === "GET" && url.pathname === "/api/public/tournaments") {
        return sendJson(req, res, 200, { tournaments: listPublicTournaments() });
      }
      if (req.method === "GET" && url.pathname.startsWith("/api/public/tournaments/")) {
        const slug = decodeURIComponent(url.pathname.slice("/api/public/tournaments/".length)).trim();
        const tournament = slug ? getPublicTournamentBySlug(slug) : undefined;
        if (!tournament) return sendJson(req, res, 404, { error: "공개 대회를 찾을 수 없습니다." });
        return sendJson(req, res, 200, { tournament });
      }
      if (req.method === "GET" && url.pathname === "/api/public/community/posts") {
        const limit = Math.max(1, Math.min(100, Math.trunc(Number(url.searchParams.get("limit")) || 50)));
        const category = url.searchParams.has("category") ? communityCategory(url.searchParams.get("category")) : undefined;
        return sendJson(req, res, 200, { posts: listCommunityPosts(limit, category) });
      }
      if (req.method === "POST" && url.pathname === "/api/public/community/posts") {
        const post = await createPublicCommunityPost(req);
        return sendJson(req, res, 201, { post, posts: listCommunityPosts(50, post.category) });
      }
      const communityPostMatch = url.pathname.match(/^\/api\/public\/community\/posts\/([^/]+)$/);
      if (req.method === "PATCH" && communityPostMatch) {
        const postId = decodeURIComponent(communityPostMatch[1] ?? "");
        const post = await updatePublicCommunityPost(req, postId);
        return sendJson(req, res, 200, { post, posts: listCommunityPosts(50, post.category) });
      }
      const communityCommentMatch = url.pathname.match(/^\/api\/public\/community\/posts\/([^/]+)\/comments$/);
      if (req.method === "POST" && communityCommentMatch) {
        const postId = decodeURIComponent(communityCommentMatch[1] ?? "");
        const post = await createPublicCommunityComment(req, postId);
        return sendJson(req, res, 201, { post, posts: listCommunityPosts(50, post.category) });
      }
      const communityReportMatch = url.pathname.match(/^\/api\/public\/community\/posts\/([^/]+)\/reports$/);
      if (req.method === "POST" && communityReportMatch) {
        const postId = decodeURIComponent(communityReportMatch[1] ?? "");
        const report = await createPublicCommunityReport(req, postId);
        return sendJson(req, res, 201, { report });
      }
      if (req.method === "GET" && url.pathname === "/api/public/participation/state") {
        return sendJson(req, res, 200, await getPublicParticipationState(req));
      }
      if (req.method === "POST" && url.pathname === "/api/public/participation/join") {
        return sendJson(req, res, 200, await joinPublicParticipation(req));
      }
      if (req.method === "POST" && url.pathname === "/api/public/participation/cancel") {
        return sendJson(req, res, 200, await cancelPublicParticipation(req));
      }
      if (req.method === "GET" && url.pathname === "/api/public/twitch/status") {
        return sendJson(req, res, 200, await getPublicTwitchViewerStatus(req));
      }
      if (req.method === "GET" && url.pathname === "/api/public/twitch/followed-lol") {
        const limit = Number(url.searchParams.get("limit") ?? "100");
        return sendJson(req, res, 200, await getPublicTwitchFollowedLol(limit, req));
      }
      if (req.method === "POST" && url.pathname === "/api/public/twitch/riot-id-request") {
        return sendJson(req, res, 200, { request: await createPublicStreamerRiotIdRequest(req) });
      }
      if (req.method === "GET" && url.pathname === "/api/public/twitch/auth/start") {
        if (!input.publicTwitchAuth) return sendJson(req, res, 503, { error: "Twitch 공개 로그인을 사용할 수 없습니다." });
        const forceVerify = url.searchParams.get("force_verify") === "1" || url.searchParams.get("force_verify") === "true";
        const returnUrl = publicTwitchReturnUrlForRequest(req, url.searchParams.get("return_to"));
        return sendRedirect(res, input.publicTwitchAuth.createAuthorizationUrl(forceVerify, publicTwitchCallbackUrlForRequest(req), returnUrl));
      }
      if (req.method === "GET" && url.pathname === "/api/public/twitch/auth/callback") {
        return handlePublicTwitchAuthCallback(req, res, url);
      }
      if (req.method === "POST" && url.pathname === "/api/public/twitch/logout") {
        input.publicTwitchAuth?.disconnect(publicTwitchViewerSessionIdFromRequest(req));
        return sendJson(req, res, 200, { ok: true }, { "Set-Cookie": clearPublicTwitchViewerSessionCookie() });
      }
      if (req.method === "POST" && url.pathname === "/api/dashboard/auth/check") {
        const body = await readJsonBody<{ token?: unknown }>(req);
        const token = typeof body.token === "string" ? body.token : "";
        const authenticated = tokenMatchesDashboardAuth(token);
        if (!authenticated) {
          return sendJson(req, res, 401, {
            required: !appConfig.security.localNoAuth,
            configured: appConfig.security.localNoAuth || Boolean(appConfig.security.dashboardAuthToken),
            authenticated: false
          });
        }
        const session = sessions.create({ role: "admin" });
        return sendJson(req, res, 200, {
          required: !appConfig.security.localNoAuth,
          configured: appConfig.security.localNoAuth || Boolean(appConfig.security.dashboardAuthToken),
          authenticated: true,
          role: "admin",
          csrfToken: session.csrfToken,
          expiresAt: new Date(session.expiresAt).toISOString()
        }, { "Set-Cookie": dashboardSessionCookie(session) });
      }
      if (req.method === "POST" && url.pathname === "/api/dashboard/auth/logout") {
        const surface = dashboardAuthSurface(url.searchParams.get("surface"));
        sessions.revoke(dashboardSessionIdFromRequest(req, surface));
        return sendJson(req, res, 200, { ok: true }, { "Set-Cookie": clearDashboardSessionCookie(surface) });
      }
      if (req.method === "POST" && url.pathname === "/api/followers/oauth/start") {
        const broadcasterUserId = requireAuthenticatedStreamerOwner(auth.principal);
        const streamer = dashboardEnabledStreamerRiotIdForTwitchUser(broadcasterUserId);
        const dashboardPath = streamer ? streamerDashboardPath(streamer) : undefined;
        if (!dashboardPath) {
          return sendJson(req, res, 403, {
            error: "스트리머 대시보드 URL을 확인할 수 없습니다.",
            code: "STREAMER_DASHBOARD_DISABLED"
          });
        }
        try {
          const authorizationUrl = requireStreamerFollowerAuth().createAuthorizationUrl(broadcasterUserId, {
            redirectUri: twitchCallbackUrlForRequest(req),
            returnUrl: dashboardReturnUrlForRequest(req, `${dashboardPath}/followers`),
            forceVerify: true
          });
          return sendJson(req, res, 200, { url: authorizationUrl });
        } catch (error) {
          throw followerAuthHttpError(error);
        }
      }
      if (req.method === "GET" && url.pathname === "/api/twitch/auth/start") {
        const forceVerify = url.searchParams.get("force_verify") === "1" || url.searchParams.get("force_verify") === "true";
        return sendRedirect(res, input.twitchAuth.createAuthorizationUrl(forceVerify, {
          redirectUri: twitchCallbackUrlForRequest(req),
          returnUrl: dashboardReturnUrlForRequest(req, url.searchParams.get("return_to"))
        }));
      }
      if (req.method === "GET" && url.pathname === "/api/twitch/auth/callback") {
        if (input.publicTwitchAuth?.isPublicState(url.searchParams.get("state"))) {
          return handlePublicTwitchAuthCallback(req, res, url);
        }
        if (input.streamerFollowerAuth?.isFollowerState(url.searchParams.get("state"))) {
          const followerState = input.streamerFollowerAuth.consumeState(url.searchParams.get("state"));
          if (!followerState) {
            return sendSafeOAuthHtml(res, 400, "Twitch 팔로워 권한 연결 실패", "OAuth state 검증에 실패했습니다. 팔로워 관리 화면에서 다시 연결을 시작해주세요.");
          }
          if (url.searchParams.get("error")) {
            return sendSafeOAuthHtml(res, 400, "Twitch 팔로워 권한 연결 실패", twitchOAuthErrorMessage(url, "Twitch 팔로워 관리 권한 승인이 완료되지 않았습니다."));
          }
          const code = url.searchParams.get("code");
          if (!code) {
            return sendSafeOAuthHtml(res, 400, "Twitch 팔로워 권한 연결 실패", "OAuth callback에 필요한 code가 없습니다.");
          }
          try {
            await input.streamerFollowerAuth.connectWithCode(code, {
              ownerId: followerState.ownerId,
              redirectUri: followerState.redirectUri
            });
          } catch (error) {
            const message = error instanceof StreamerFollowerAuthError && error.code === "OWNER_MISMATCH"
              ? error.message
              : "Twitch 팔로워 관리 권한 연결에 실패했습니다. 팔로워 관리 화면에서 다시 시도해주세요.";
            input.logger?.error({
              type: "followers.oauth_callback_failed",
              error: error instanceof StreamerFollowerAuthError ? error.code : toSafeErrorMessage(error)
            });
            return sendSafeOAuthHtml(res, 400, "Twitch 팔로워 권한 연결 실패", message);
          }
          return sendRedirect(res, followerOAuthReturnUrlForRequest(req, followerState.returnUrl));
        }
        const error = url.searchParams.get("error");
        if (error) return sendSafeOAuthHtml(res, 400, "Twitch 연결 실패", twitchOAuthErrorMessage(url, "Twitch 권한 승인이 완료되지 않았습니다. 대시보드에서 다시 시도해주세요."));
        const state = input.twitchAuth.consumeState(url.searchParams.get("state"));
        if (!state) {
          return sendSafeOAuthHtml(res, 400, "Twitch 연결 실패", "OAuth state 검증에 실패했습니다. 대시보드에서 다시 연결을 시작해주세요.");
        }
        const code = url.searchParams.get("code");
        if (!code) return sendSafeOAuthHtml(res, 400, "Twitch 연결 실패", "OAuth callback에 필요한 code가 없습니다.");
        try {
          await input.twitchAuth.connectWithCode(code, state.redirectUri ?? twitchCallbackUrlForRequest(req));
          input.eventSub?.reconnect("twitch.oauth.connected");
        } catch {
          return sendSafeOAuthHtml(res, 400, "Twitch 연결 실패", "Twitch token 교환 또는 방송자 정보 조회에 실패했습니다. 서버 설정을 확인한 뒤 다시 시도해주세요.");
        }
        return sendRedirect(res, state.returnUrl || dashboardReturnUrlForRequest(req));
      }
      if (req.method === "GET" && url.pathname === "/api/twitch/status") return sendJson(req, res, 200, await getTwitchStatus());
      if (req.method === "GET" && url.pathname === "/api/twitch/scopes") return sendJson(req, res, 200, input.twitchAuth.getScopes());
      if (req.method === "GET" && url.pathname === "/api/status") {
        const streamerId = authenticatedStreamerOwnerId(auth.principal);
        const status = input.store.getStatus();
        return sendJson(req, res, 200, streamerId
          ? {
              server: status.server,
              twitch: "disabled",
              stream: "unknown",
              bridge: "disconnected",
              obs: "unknown",
              participation: input.store.getParticipationState(streamerId).isOpen ? "open" : "closed"
            }
          : status);
      }
      if (req.method === "GET" && url.pathname === "/api/overlay/status") {
        const streamerId = authenticatedStreamerOwnerId(auth.principal);
        return sendJson(req, res, 200, streamerId
          ? input.overlayStatusForStreamer?.(streamerId) ?? {
              clientCount: 0,
              clientsByChannel: Object.fromEntries(OVERLAY_CHANNELS.map((channel) => [channel, 0])),
              recentMessages: []
            }
          : input.store.getOverlayStatus());
      }
      if (req.method === "GET" && url.pathname === "/api/rewards/mappings") return sendJson(req, res, 200, getRewardMappingSummaries());
      if (req.method === "GET" && url.pathname === "/api/alerts/config") {
        return sendJson(req, res, 200, {
          ...alertConfigResponse(),
          assets: await listAlertGifAssets()
        });
      }
      if (req.method === "POST" && url.pathname === "/api/alerts/config") {
        const body = await readJsonBody<{ eventType?: unknown; mediaUrl?: unknown; mediaAlt?: unknown }>(req);
        if (typeof body.eventType !== "string" || !isAlertOverlayKey(body.eventType)) {
          return sendJson(req, res, 400, { error: "eventType이 허용 목록에 없습니다." });
        }
        if (typeof body.mediaUrl !== "string" || !isSafeAlertMediaUrl(body.mediaUrl)) {
          return sendJson(req, res, 400, { error: "mediaUrl은 안전한 /alerts/... 경로여야 합니다." });
        }
        if (body.mediaAlt !== undefined && (typeof body.mediaAlt !== "string" || body.mediaAlt.length > 120)) {
          return sendJson(req, res, 400, { error: "mediaAlt는 120자 이하 문자열이어야 합니다." });
        }
        await saveAlertOverlayPreset(body.eventType, {
          mediaUrl: body.mediaUrl,
          mediaAlt: typeof body.mediaAlt === "string" ? body.mediaAlt : `${body.eventType} alert`
        });
        return sendJson(req, res, 200, {
          ...alertConfigResponse(),
          assets: await listAlertGifAssets()
        });
      }
      if (req.method === "POST" && url.pathname === "/api/alerts/assets") {
        const parts = parseMultipartBody(req, await readRawBody(req, MAX_ALERT_GIF_BYTES + 200_000));
        const file = parts.find((part) => part.name === "file" && part.filename);
        if (!file) return sendJson(req, res, 400, { error: "file 필드가 필요합니다." });
        if (file.data.byteLength < 6 || file.data.byteLength > MAX_ALERT_GIF_BYTES) {
          return sendJson(req, res, 400, { error: "GIF 파일은 1바이트 이상 5MB 이하여야 합니다." });
        }
        if (!isGifBytes(file.data)) return sendJson(req, res, 400, { error: "GIF 파일만 등록할 수 있습니다." });
        const rawEventType = multipartText(parts, "eventType") ?? "alert";
        const eventType: AlertOverlayKey | "alert" = isAlertOverlayKey(rawEventType) ? rawEventType : "alert";
        const fileName = `${eventType}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.gif`;
        const root = alertAssetRoot();
        await fs.mkdir(root, { recursive: true });
        const filePath = path.join(root, fileName);
        await fs.writeFile(filePath, file.data, { mode: 0o644 });
        return sendJson(req, res, 200, {
          fileName,
          url: `/alerts/uploads/${fileName}`,
          size: file.data.byteLength
        });
      }
      if (req.method === "GET" && url.pathname === "/api/events/recent") return sendJson(req, res, 200, input.store.recentEvents(50));
      if (req.method === "GET" && url.pathname === "/api/actions/recent") return sendJson(req, res, 200, input.store.recentActions(50));
      if (req.method === "GET" && url.pathname === "/api/questions") return sendJson(req, res, 200, input.store.getQuestions());
      if (req.method === "GET" && url.pathname === "/api/highlights") return sendJson(req, res, 200, input.store.getHighlights());
      if (req.method === "GET" && url.pathname === "/api/followers") {
        const broadcasterUserId = requireAuthenticatedStreamerOwner(auth.principal);
        return sendJson(req, res, 200, await followerManagementResponse(broadcasterUserId));
      }
      if (req.method === "GET" && url.pathname === "/api/community/moderation") {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || auth.principal.role !== "admin") {
          return sendJson(req, res, 403, { error: "관리자 권한이 필요합니다." });
        }
        return sendJson(req, res, 200, communityModeration.snapshot());
      }
      const communityVisibilityMatch = url.pathname.match(/^\/api\/community\/moderation\/posts\/([^/]+)\/visibility$/);
      if (req.method === "POST" && communityVisibilityMatch) {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || auth.principal.role !== "admin") {
          return sendJson(req, res, 403, { error: "관리자 권한이 필요합니다." });
        }
        const body = await readJsonBody<{ visibility?: unknown; reason?: unknown }>(req);
        if (body.visibility !== "visible" && body.visibility !== "hidden") {
          return sendJson(req, res, 400, { error: "visibility는 visible 또는 hidden이어야 합니다." });
        }
        const post = communityModeration.setPostVisibility({
          postId: decodeURIComponent(communityVisibilityMatch[1] ?? ""),
          visibility: body.visibility,
          reason: communityText(body.reason, 300) || undefined,
          updatedBy: "dashboard-admin"
        });
        input.logger?.event?.({ type: "community.post.visibility_changed", postId: post.id, visibility: body.visibility });
        return sendJson(req, res, 200, { post, ...communityModeration.snapshot() });
      }
      const communitySanctionMatch = url.pathname.match(/^\/api\/community\/moderation\/users\/([^/]+)\/sanction$/);
      if (req.method === "POST" && communitySanctionMatch) {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || auth.principal.role !== "admin") {
          return sendJson(req, res, 403, { error: "관리자 권한이 필요합니다." });
        }
        const body = await readJsonBody<{ active?: unknown; twitchLogin?: unknown; reason?: unknown; expiresAt?: unknown }>(req);
        if (typeof body.active !== "boolean") return sendJson(req, res, 400, { error: "active는 boolean이어야 합니다." });
        const expiresAt = communityText(body.expiresAt, 40) || undefined;
        if (expiresAt && !Number.isFinite(Date.parse(expiresAt))) {
          return sendJson(req, res, 400, { error: "expiresAt은 올바른 날짜여야 합니다." });
        }
        const twitchUserId = decodeURIComponent(communitySanctionMatch[1] ?? "").trim();
        if (!twitchUserId) return sendJson(req, res, 400, { error: "Twitch 사용자 ID가 필요합니다." });
        const sanction = communityModeration.setUserSanction({
          twitchUserId,
          twitchLogin: communityText(body.twitchLogin, 80) || undefined,
          active: body.active,
          reason: communityText(body.reason, 300) || undefined,
          expiresAt,
          updatedBy: "dashboard-admin"
        });
        if (body.active && !sanction) return sendJson(req, res, 400, { error: "제재를 적용하지 못했습니다." });
        input.logger?.event?.({ type: "community.user.sanction_changed", twitchUserId, active: body.active });
        return sendJson(req, res, 200, { sanction, ...communityModeration.snapshot() });
      }
      if (req.method === "GET" && url.pathname === "/api/tournaments") {
        if (auth.principal.type !== "DASHBOARD_ADMIN") return sendJson(req, res, 403, { error: "대시보드 인증이 필요합니다." });
        if (auth.principal.role === "streamer" && !dashboardEnabledStreamerRiotIdForTwitchUser(auth.principal.twitchUserId)) {
          return sendJson(req, res, 403, { error: "스트리머 대시보드 사용 권한이 필요합니다." });
        }
        return sendJson(req, res, 200, {
          tournaments: listDashboardTournaments(auth.principal.role, auth.principal.twitchUserId)
        });
      }
      if (req.method === "POST" && url.pathname === "/api/tournaments") {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || !auth.principal.twitchUserId) {
          return sendJson(req, res, 403, { error: "승인된 스트리머 세션이 필요합니다." });
        }
        const owner = dashboardEnabledStreamerRiotIdForTwitchUser(auth.principal.twitchUserId);
        if (!owner) return sendJson(req, res, 403, { error: "스트리머 대시보드 사용 권한이 필요합니다." });
        const body = await readJsonBody<TournamentUpsertInput>(req);
        const tournament = upsertStreamerTournament(body, owner);
        if (!tournament) return sendJson(req, res, 400, { error: "대회 제목과 올바른 입력값이 필요합니다." });
        return sendJson(req, res, 200, { tournament, tournaments: listDashboardTournaments(auth.principal.role, auth.principal.twitchUserId) });
      }
      if (req.method === "DELETE" && url.pathname.startsWith("/api/tournaments/")) {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || !auth.principal.twitchUserId) {
          return sendJson(req, res, 403, { error: "승인된 스트리머 세션이 필요합니다." });
        }
        const owner = dashboardEnabledStreamerRiotIdForTwitchUser(auth.principal.twitchUserId);
        if (!owner) return sendJson(req, res, 403, { error: "스트리머 대시보드 사용 권한이 필요합니다." });
        const tournamentId = decodeURIComponent(url.pathname.slice("/api/tournaments/".length)).trim();
        if (!tournamentId) return sendJson(req, res, 400, { error: "대회 ID가 필요합니다." });
        if (!deleteStreamerTournament(tournamentId, owner)) return sendJson(req, res, 404, { error: "삭제할 대회를 찾을 수 없습니다." });
        return sendJson(req, res, 200, { tournaments: listDashboardTournaments(auth.principal.role, auth.principal.twitchUserId) });
      }
      if (req.method === "GET" && url.pathname === "/api/riot/settings") {
        if (!input.riot) return sendJson(req, res, 503, { error: "Riot API client를 사용할 수 없습니다." });
        return sendJson(req, res, 200, input.riot.credentialStatus());
      }
      if (req.method === "GET" && url.pathname === "/api/lol-operations") {
        const streamerId = requireAuthenticatedStreamerOwner(auth.principal);
        return sendJson(req, res, 200, lolOperationsStateForOwner(streamerId));
      }
      if (req.method === "GET" && url.pathname === "/api/lol-operations/identity") {
        const streamerId = requireAuthenticatedStreamerOwner(auth.principal);
        return sendJson(req, res, 200, {
          identity: streamerRiotIdentityForOwner(streamerId),
          request: currentStreamerRiotIdRequestForTwitchUser(streamerId)
        });
      }
      if (req.method === "POST" && url.pathname === "/api/lol-operations/identity") {
        const streamerId = requireAuthenticatedStreamerOwner(auth.principal);
        const body = await readJsonBody<{ riotId?: unknown }>(req);
        const result = await updateStreamerRiotIdentityForOwner(streamerId, body.riotId);
        return sendJson(req, res, 200, {
          ...result,
          state: lolOperationsStateForOwner(streamerId)
        });
      }
      if (req.method === "GET" && url.pathname === "/api/lol-operations/automation") {
        const streamerId = requireAuthenticatedStreamerOwner(auth.principal);
        return sendJson(req, res, 200, {
          settings: input.store.getLolAutomationSettings(streamerId),
          identity: streamerRiotIdentityForOwner(streamerId)
        });
      }
      if (req.method === "POST" && url.pathname === "/api/lol-operations/automation") {
        const streamerId = requireAuthenticatedStreamerOwner(auth.principal);
        const body = await readJsonBody<Record<string, unknown>>(req);
        if (body.streamerRiotId !== undefined) {
          return sendJson(req, res, 400, { error: "Riot ID는 계정 연결 탭에서만 변경할 수 있습니다." });
        }
        if (body.announceInChat === true) {
          return sendJson(req, res, 409, {
            error: "스트리머별 Twitch 채팅 연결이 지원되기 전에는 채팅 안내를 활성화할 수 없습니다.",
            code: "STREAMER_CHAT_NOT_ISOLATED"
          });
        }
        const patch: Partial<Omit<LolAutomationSettings, "streamerId" | "updatedAt">> = {};
        for (const key of ["enabled", "autoSelectNextAfterGame", "announceInChat"] as const) {
          if (body[key] === undefined) continue;
          if (typeof body[key] !== "boolean") return sendJson(req, res, 400, { error: `${key}는 boolean이어야 합니다.` });
          patch[key] = body[key];
        }
        for (const key of ["pollIntervalMs", "gameEndDebounceMs"] as const) {
          if (body[key] === undefined) continue;
          const value = Number(body[key]);
          if (!Number.isFinite(value) || value < 0) return sendJson(req, res, 400, { error: `${key}는 0 이상의 숫자여야 합니다.` });
          patch[key] = Math.trunc(value);
        }
        const identity = approvedStreamerIdentityForOwner(streamerId);
        if (patch.enabled === true && !identity) {
          return sendJson(req, res, 409, { error: "승인된 Riot ID가 있어야 게임 감시를 시작할 수 있습니다." });
        }
        const settings = input.store.setLolAutomationSettings(streamerId, patch);
        await restartStreamerLolGameMonitor(streamerId, identity, settings);
        return sendJson(req, res, 200, {
          settings,
          state: lolOperationsStateForOwner(streamerId)
        });
      }
      if (req.method === "GET" && url.pathname === "/api/lol-operations/participation") {
        const streamerId = requireAuthenticatedStreamerOwner(auth.principal);
        return sendJson(req, res, 200, input.store.getParticipationState(streamerId));
      }
      if (req.method === "POST" && url.pathname === "/api/lol-operations/participation/session") {
        const streamerId = requireAuthenticatedStreamerOwner(auth.principal);
        const body = await readJsonBody<{ action?: unknown }>(req);
        if (typeof body.action !== "string") return sendJson(req, res, 400, { error: "action이 필요합니다." });
        if (body.action === "start") {
          startParticipationSessionForOwner(streamerId);
          await broadcastParticipationSnapshot(input, "recruiting", "dashboard.lol_operations.session_start", streamerId);
        } else if (body.action === "finish") {
          input.store.setParticipationOpen(false, streamerId);
          input.store.endParticipationSession(streamerId);
          await broadcastParticipationSnapshot(input, "closed", "dashboard.lol_operations.session_finish", streamerId);
        } else if (PARTICIPATION_MANUAL_ACTIONS.has(body.action)) {
          if (body.action === "open" && !input.store.getParticipationSession(streamerId)) {
            startParticipationSessionForOwner(streamerId);
          }
          await applyManualParticipationAction(input, body.action, streamerId);
        } else {
          return sendJson(req, res, 400, { error: "허용되지 않은 시참 세션 조작입니다." });
        }
        return sendJson(req, res, 200, {
          ok: true,
          action: body.action,
          state: lolOperationsStateForOwner(streamerId)
        });
      }
      if (req.method === "POST" && url.pathname === "/api/lol-operations/participation/entry-status") {
        const streamerId = requireAuthenticatedStreamerOwner(auth.principal);
        const body = await readJsonBody<{ entryId?: unknown; status?: unknown }>(req);
        if (typeof body.entryId !== "string" || !body.entryId.trim()) return sendJson(req, res, 400, { error: "entryId가 필요합니다." });
        if (typeof body.status !== "string" || !PARTICIPATION_ENTRY_STATUSES.has(body.status as ParticipationStatus)) {
          return sendJson(req, res, 400, { error: "허용되지 않은 참가자 상태입니다." });
        }
        const updated = input.store.markParticipant(body.entryId.trim(), body.status as ParticipationStatus, streamerId);
        if (!updated) return sendJson(req, res, 404, { error: "시참 entry를 찾을 수 없습니다." });
        await broadcastParticipationQueue(input, "dashboard.lol_operations.entry_status", streamerId);
        return sendJson(req, res, 200, input.store.getParticipationState(streamerId));
      }

      const compatibilityStreamerId = authenticatedStreamerOwnerId(auth.principal);
      if (req.method === "GET" && url.pathname === "/api/participation/queue") {
        return sendJson(req, res, 200, input.store.getParticipationQueue(compatibilityStreamerId));
      }
      if (req.method === "GET" && url.pathname === "/api/participation/state") {
        return sendJson(req, res, 200, input.store.getParticipationState(compatibilityStreamerId));
      }
      if (req.method === "GET" && url.pathname === "/api/participation/game-monitor") {
        return sendJson(req, res, 200, compatibilityStreamerId ? legacyGameMonitorConfigForOwner(compatibilityStreamerId) : loadGameMonitorConfig());
      }
      if (req.method === "GET" && url.pathname === "/api/participation/streamer-profile") {
        return sendJson(req, res, 200, { profile: input.store.getParticipationStreamerProfile(compatibilityStreamerId) });
      }
      if (req.method === "POST" && url.pathname === "/api/participation/streamer-profile-link") {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || !auth.principal.twitchUserId) {
          return sendJson(req, res, 403, { error: "승인된 스트리머 세션이 필요합니다." });
        }
        const body = await readJsonBody<{ profileLinkUrl?: unknown; profileLinkLabel?: unknown; profileLinks?: unknown }>(req);
        const link = normalizedStreamerProfileLink(body);
        const request = updateApprovedStreamerProfileLink({
          twitchUserId: auth.principal.twitchUserId,
          ...link
        });
        if (!request) return sendJson(req, res, 404, { error: "승인된 스트리머 등록 정보를 찾을 수 없습니다." });
        invalidatePublicLolProfileCachesForStreamer(request);
        return sendJson(req, res, 200, { streamer: publicStreamerDashboardInfo(request), request });
      }
      if (req.method === "POST" && url.pathname === "/api/participation/streamer-riot-id") {
        const streamerId = requireAuthenticatedStreamerOwner(auth.principal);
        const body = await readJsonBody<{ riotId?: unknown }>(req);
        const result = await updateStreamerRiotIdentityForOwner(streamerId, body.riotId);

        return sendJson(req, res, 200, {
          streamer: publicStreamerDashboardInfo(result.request),
          request: result.request,
          gameMonitor: legacyGameMonitorConfigForOwner(streamerId),
          streamerProfile: result.streamerProfile
        });
      }
      if (req.method === "GET" && url.pathname === "/api/participation/streamer-riot-id-requests") {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || auth.principal.role !== "admin") {
          return sendJson(req, res, 403, { error: "관리자 권한이 필요합니다." });
        }
        return sendJson(req, res, 200, { requests: listStreamerRiotIdRequests() });
      }
      if (req.method === "GET" && url.pathname === "/api/participation/profile-settings") return sendJson(req, res, 200, loadLolParticipationProfileSettings());
      if (req.method === "GET" && url.pathname === "/api/participation/profile-settings/skin-options") {
        try {
          const { response, headers } = await getSkinOptionsWithCache();
          return sendJson(req, res, 200, response, headers);
        } catch (error) {
          return sendJson(req, res, 400, { error: toSafeErrorMessage(error) });
        }
      }

      if (req.method === "POST" && url.pathname === "/api/participation/game-monitor") {
        const body = await readJsonBody<Partial<LolGameMonitorConfig>>(req);
        if (compatibilityStreamerId) {
          const identity = approvedStreamerIdentityForOwner(compatibilityStreamerId);
          if (body.announceInChat === true) {
            return sendJson(req, res, 409, {
              error: "스트리머별 Twitch 채팅 연결이 지원되기 전에는 채팅 안내를 활성화할 수 없습니다.",
              code: "STREAMER_CHAT_NOT_ISOLATED"
            });
          }
          if (body.streamerRiotId !== undefined) {
            if (typeof body.streamerRiotId !== "string") {
              return sendJson(req, res, 400, { error: "streamerRiotId는 문자열이어야 합니다." });
            }
            const requestedRiotId = body.streamerRiotId.trim();
            if (requestedRiotId) {
              const parsed = parseRiotIdDetailed(requestedRiotId);
              if (!parsed.ok) return sendJson(req, res, 400, { error: parsed.message });
              if (!identity || normalizeRiotIdKey(parsed.gameName, parsed.tagLine) !== identity.normalizedRiotId) {
                return sendJson(req, res, 409, { error: "Riot ID는 LoL 방송 운영의 계정 연결 탭에서만 변경할 수 있습니다." });
              }
            }
          }
          const scopedPatch: Partial<Omit<LolAutomationSettings, "streamerId" | "updatedAt">> = {};
          for (const key of ["enabled", "autoSelectNextAfterGame", "announceInChat"] as const) {
            if (body[key] === undefined) continue;
            if (typeof body[key] !== "boolean") return sendJson(req, res, 400, { error: `${key}는 boolean이어야 합니다.` });
            scopedPatch[key] = body[key];
          }
          for (const key of ["pollIntervalMs", "gameEndDebounceMs"] as const) {
            if (body[key] === undefined) continue;
            const value = Number(body[key]);
            if (!Number.isFinite(value) || value < 0) return sendJson(req, res, 400, { error: `${key}는 0 이상의 숫자여야 합니다.` });
            scopedPatch[key] = Math.trunc(value);
          }
          if (scopedPatch.enabled === true && !identity) {
            return sendJson(req, res, 409, { error: "승인된 Riot ID가 있어야 게임 감시를 시작할 수 있습니다." });
          }
          const settings = input.store.setLolAutomationSettings(compatibilityStreamerId, scopedPatch);
          await restartStreamerLolGameMonitor(compatibilityStreamerId, identity, settings);
          return sendJson(req, res, 200, legacyGameMonitorConfigForOwner(compatibilityStreamerId));
        }
        const patch: Partial<LolGameMonitorConfig> = {};
        if (body.streamerRiotId !== undefined) {
          if (typeof body.streamerRiotId !== "string") return sendJson(req, res, 400, { error: "streamerRiotId는 문자열이어야 합니다." });
          const streamerRiotId = body.streamerRiotId.trim();
          if (streamerRiotId) {
            const parsed = parseRiotIdDetailed(streamerRiotId);
            if (!parsed.ok) return sendJson(req, res, 400, { error: parsed.message });
            patch.streamerRiotId = `${parsed.gameName}#${parsed.tagLine}`;
          } else {
            patch.streamerRiotId = "";
          }
        }
        for (const key of ["enabled", "autoSelectNextAfterGame", "announceInChat"] as const) {
          if (body[key] === undefined) continue;
          if (typeof body[key] !== "boolean") return sendJson(req, res, 400, { error: `${key}는 boolean이어야 합니다.` });
          patch[key] = body[key];
        }
        const saved = saveGameMonitorConfig(patch);
        await restartActiveLolGameMonitor(saved);
        return sendJson(req, res, 200, saved);
      }

      if (req.method === "POST" && url.pathname === "/api/participation/streamer-riot-id-requests/resolve") {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || auth.principal.role !== "admin") {
          return sendJson(req, res, 403, { error: "관리자 권한이 필요합니다." });
        }
        const body = await readJsonBody<{ requestId?: unknown; decision?: unknown; note?: unknown }>(req);
        if (typeof body.requestId !== "string" || !body.requestId.trim()) {
          return sendJson(req, res, 400, { error: "requestId는 문자열이어야 합니다." });
        }
        if (body.decision !== "approved" && body.decision !== "rejected") {
          return sendJson(req, res, 400, { error: "decision은 approved 또는 rejected여야 합니다." });
        }
        const beforeRequests = listStreamerRiotIdRequests();
        const beforeRequest = beforeRequests.find((candidate) => candidate.id === body.requestId);
        const previousApprovedRequests = beforeRequest
          ? beforeRequests.filter((candidate) => candidate.twitchUserId === beforeRequest.twitchUserId && candidate.status === "approved")
          : [];
        const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : undefined;
        const request = resolveStreamerRiotIdRequest({
          requestId: body.requestId,
          decision: body.decision,
          reviewer: "dashboard",
          note
        });
        if (!request) return sendJson(req, res, 404, { error: "등록 요청을 찾을 수 없습니다." });
        if (request.status !== "approved" || request.dashboardEnabled !== true) {
          sessions.revokeByTwitchUserId(request.twitchUserId);
          input.disconnectStreamerDashboard?.(request.twitchUserId);
        }
        invalidatePublicLolProfileCachesForStreamer(request);
        for (const previousRequest of previousApprovedRequests) invalidatePublicLolProfileCachesForStreamer(previousRequest);
        return sendJson(req, res, 200, { request, requests: listStreamerRiotIdRequests() });
      }

      if (req.method === "POST" && url.pathname === "/api/participation/streamer-riot-id-requests/dashboard-access") {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || auth.principal.role !== "admin") {
          return sendJson(req, res, 403, { error: "관리자 권한이 필요합니다." });
        }
        const body = await readJsonBody<{ requestId?: unknown; dashboardEnabled?: unknown; note?: unknown }>(req);
        if (typeof body.requestId !== "string" || !body.requestId.trim()) {
          return sendJson(req, res, 400, { error: "requestId는 문자열이어야 합니다." });
        }
        if (typeof body.dashboardEnabled !== "boolean") {
          return sendJson(req, res, 400, { error: "dashboardEnabled는 boolean이어야 합니다." });
        }
        const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : undefined;
        const request = setStreamerRiotIdDashboardEnabled({
          requestId: body.requestId,
          dashboardEnabled: body.dashboardEnabled,
          reviewer: "dashboard",
          note
        });
        if (!request) return sendJson(req, res, 404, { error: "승인된 등록 요청을 찾을 수 없습니다." });
        if (!request.dashboardEnabled) {
          sessions.revokeByTwitchUserId(request.twitchUserId);
          input.disconnectStreamerDashboard?.(request.twitchUserId);
        }
        invalidatePublicLolProfileCachesForStreamer(request);
        return sendJson(req, res, 200, { request, requests: listStreamerRiotIdRequests() });
      }

      if (req.method === "POST" && url.pathname === "/api/participation/manual-control") {
        const body = await readJsonBody<{ action?: unknown }>(req);
        if (typeof body.action !== "string" || !PARTICIPATION_MANUAL_ACTIONS.has(body.action)) {
          return sendJson(req, res, 400, { error: "허용되지 않은 시참 수동 조작입니다." });
        }
        if (compatibilityStreamerId && body.action === "open" && !input.store.getParticipationSession(compatibilityStreamerId)) {
          startParticipationSessionForOwner(compatibilityStreamerId);
        }
        const phase = await applyManualParticipationAction(input, body.action, compatibilityStreamerId);
        return sendJson(req, res, 200, {
          ok: true,
          action: body.action,
          phase,
          state: input.store.getParticipationState(compatibilityStreamerId)
        });
      }

      if (req.method === "POST" && url.pathname === "/api/participation/profile-settings") {
        const body = await readJsonBody<Partial<LolParticipationProfileSettings>>(req);
        if (body.championSkinOverrides !== undefined && (typeof body.championSkinOverrides !== "object" || body.championSkinOverrides === null || Array.isArray(body.championSkinOverrides))) {
          return sendJson(req, res, 400, { error: "championSkinOverrides는 객체여야 합니다." });
        }
        const saved = saveLolParticipationProfileSettings({
          championSkinOverrides: body.championSkinOverrides ?? {}
        });
        return sendJson(req, res, 200, saved);
      }

      if (req.method === "POST" && url.pathname === "/api/participation/streamer-profile/refresh") {
        if (compatibilityStreamerId) {
          const profile = await refreshStreamerProfileForOwner(compatibilityStreamerId, true).catch(() => undefined);
          if (!profile) return sendJson(req, res, 404, { error: "방송자 프로필 갱신을 사용할 수 없습니다. Riot API key와 승인된 Riot ID를 확인하세요." });
          return sendJson(req, res, 200, { profile });
        }
        const key = currentStreamerRefreshKey();
        const cachedProfile = key && streamerProfileRefreshKey === key
          ? lastStreamerProfileRefresh ?? input.store.getParticipationStreamerProfile()
          : undefined;
        if (streamerProfileRefreshInFlight && streamerProfileRefreshKey === key) {
          const profile = await streamerProfileRefreshInFlight;
          if (!profile) return sendJson(req, res, 404, { error: "방송자 프로필 갱신을 사용할 수 없습니다. Riot API key와 방송자 Riot ID를 확인하세요." });
          return sendJson(req, res, 200, { profile }, { "X-StreamOps-Cache": "in-flight" });
        }
        if (cachedProfile && Date.now() < streamerProfileRefreshAvailableAt) {
          return sendJson(req, res, 200, { profile: cachedProfile }, {
            "X-StreamOps-Cache": "cooldown",
            "Retry-After": retryAfterSeconds(streamerProfileRefreshAvailableAt)
          });
        }
        streamerProfileRefreshKey = key;
        const refreshRequest = refreshActiveStreamerProfile(true)
          .then((profile) => {
            if (profile) {
              lastStreamerProfileRefresh = profile;
              streamerProfileRefreshAvailableAt = Date.now() + PROFILE_REFRESH_COOLDOWN_MS;
            }
            return profile;
          })
          .finally(() => {
            if (streamerProfileRefreshInFlight === refreshRequest) streamerProfileRefreshInFlight = undefined;
          });
        streamerProfileRefreshInFlight = refreshRequest;
        const profile = await streamerProfileRefreshInFlight;
        if (!profile) return sendJson(req, res, 404, { error: "방송자 프로필 갱신을 사용할 수 없습니다. Riot API key와 방송자 Riot ID를 확인하세요." });
        return sendJson(req, res, 200, { profile });
      }

      if (req.method === "POST" && url.pathname === "/api/participation/profile/refresh") {
        const body = await readJsonBody<{ entryId?: string }>(req);
        if (typeof body.entryId !== "string" || !body.entryId.trim()) return sendJson(req, res, 400, { error: "entryId가 필요합니다." });
        const entryId = body.entryId.trim();
        if (!input.store.getParticipationEntryById(entryId, compatibilityStreamerId)) {
          return sendJson(req, res, 404, { error: "시참 entry를 찾을 수 없습니다." });
        }
        const currentRefresh = entryProfileRefreshInFlight.get(entryId);
        if (currentRefresh) {
          const refreshed = await currentRefresh;
          if (!refreshed) return sendJson(req, res, 404, { error: "시참 entry를 찾을 수 없거나 refresh를 사용할 수 없습니다." });
          return sendJson(req, res, 200, input.store.getParticipationState(compatibilityStreamerId), { "X-StreamOps-Cache": "in-flight" });
        }
        const availableAt = entryProfileRefreshAvailableAt.get(entryId) ?? 0;
        if (Date.now() < availableAt) {
          return sendJson(req, res, 200, input.store.getParticipationState(compatibilityStreamerId), {
            "X-StreamOps-Cache": "cooldown",
            "Retry-After": retryAfterSeconds(availableAt)
          });
        }
        const refresh = input.refreshLolProfile?.(entryId, compatibilityStreamerId) ?? Promise.resolve(false);
        entryProfileRefreshInFlight.set(entryId, refresh);
        const refreshed = await refresh.finally(() => {
          entryProfileRefreshInFlight.delete(entryId);
        });
        if (!refreshed) return sendJson(req, res, 404, { error: "시참 entry를 찾을 수 없거나 refresh를 사용할 수 없습니다." });
        entryProfileRefreshAvailableAt.set(entryId, Date.now() + PROFILE_REFRESH_COOLDOWN_MS);
        return sendJson(req, res, 200, input.store.getParticipationState(compatibilityStreamerId));
      }

      if (req.method === "POST" && url.pathname === "/api/participation/invite-message") {
        const body = await readJsonBody<{ entryId?: unknown; message?: unknown }>(req);
        if (typeof body.entryId !== "string" || !body.entryId.trim()) return sendJson(req, res, 400, { error: "entryId가 필요합니다." });
        const entry = input.store.getParticipationEntryById(body.entryId.trim(), compatibilityStreamerId);
        if (!entry) return sendJson(req, res, 404, { error: "시참 entry를 찾을 수 없습니다." });
        const validation = validateParticipationInviteMessage(body.message);
        if (!validation.ok) return sendJson(req, res, 400, { error: validation.error });
        await input.actions.dispatchOne({
          type: "twitch.chat",
          message: `@${entry.twitchUserName} ${validation.message}`
        }, { user: "dashboard", input: "" }, "dashboard.participation_invite");
        return sendJson(req, res, 200, {
          ok: true,
          entryId: entry.id,
          twitchUserName: entry.twitchUserName
        });
      }

      if (req.method === "POST" && url.pathname === "/api/participation/invite-message/bulk") {
        const body = await readJsonBody<{ entryIds?: unknown; message?: unknown }>(req);
        if (!Array.isArray(body.entryIds) || body.entryIds.length === 0) return sendJson(req, res, 400, { error: "entryIds가 필요합니다." });
        const entryIds = [...new Set(body.entryIds.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean))];
        if (entryIds.length === 0) return sendJson(req, res, 400, { error: "entryIds가 필요합니다." });
        if (entryIds.length > MAX_PARTICIPATION_INVITE_BULK_TARGETS) {
          return sendJson(req, res, 400, { error: `일괄 전송 대상은 최대 ${MAX_PARTICIPATION_INVITE_BULK_TARGETS}명입니다.` });
        }
        const entries = entryIds.map((entryId) => input.store.getParticipationEntryById(entryId, compatibilityStreamerId));
        if (entries.some((entry) => !entry)) return sendJson(req, res, 404, { error: "일부 시참 entry를 찾을 수 없습니다." });
        const targets = entries
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
          .filter((entry) => PARTICIPATION_INVITE_TARGET_STATUSES.has(entry.status));
        if (targets.length === 0) return sendJson(req, res, 400, { error: "일괄 전송 가능한 대기열 참가자가 없습니다." });
        const validation = validateParticipationInviteMessage(body.message);
        if (!validation.ok) return sendJson(req, res, 400, { error: validation.error });
        const chatMessages = buildParticipationInviteChatMessages(targets, validation.message);
        if (!chatMessages.ok) return sendJson(req, res, 400, { error: chatMessages.error });
        for (const message of chatMessages.messages) {
          await input.actions.dispatchOne({ type: "twitch.chat", message }, { user: "dashboard", input: "" }, "dashboard.participation_invite_bulk");
        }
        return sendJson(req, res, 200, {
          ok: true,
          targetCount: targets.length,
          sentMessages: chatMessages.messages.length
        });
      }

      if (req.method === "POST" && url.pathname === "/api/followers/refresh") {
        const broadcasterUserId = requireAuthenticatedStreamerOwner(auth.principal);
        const rawLimit = url.searchParams.get("limit");
        if (rawLimit !== null && !/^\d{1,5}$/.test(rawLimit)) {
          return sendJson(req, res, 400, { error: "limit은 1 이상 5000 이하의 정수여야 합니다.", code: "INVALID_FOLLOWER_LIMIT" });
        }
        const limit = rawLimit === null ? 5000 : Number(rawLimit);
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5000) {
          return sendJson(req, res, 400, { error: "limit은 1 이상 5000 이하의 정수여야 합니다.", code: "INVALID_FOLLOWER_LIMIT" });
        }
        const runtime = followerRefreshRuntime(broadcasterUserId);
        if (runtime.inFlight) {
          if (runtime.lastState) {
            runtime.lastState = await followerManagementResponse(broadcasterUserId);
            return sendJson(req, res, 200, runtime.lastState, { "X-StreamOps-Cache": "in-flight" });
          }
          try {
            return sendJson(req, res, 200, await runtime.inFlight, { "X-StreamOps-Cache": "in-flight" });
          } catch (error) {
            if (error instanceof HttpRequestError) throw error;
            throw new HttpRequestError(502, { error: "Twitch 팔로워 목록을 갱신하지 못했습니다.", code: "FOLLOWER_REFRESH_FAILED" });
          }
        }
        if (runtime.lastState && Date.now() < runtime.availableAt) {
          runtime.lastState = await followerManagementResponse(broadcasterUserId);
          return sendJson(req, res, 200, runtime.lastState, {
            "X-StreamOps-Cache": "cooldown",
            "Retry-After": retryAfterSeconds(runtime.availableAt)
          });
        }
        const refresh = refreshFollowerSnapshot(broadcasterUserId, limit, runtime);
        runtime.inFlight = refresh;
        try {
          return sendJson(req, res, 200, await refresh);
        } catch (error) {
          if (error instanceof HttpRequestError) throw error;
          throw new HttpRequestError(502, { error: "Twitch 팔로워 목록을 갱신하지 못했습니다.", code: "FOLLOWER_REFRESH_FAILED" });
        } finally {
          if (runtime.inFlight === refresh) runtime.inFlight = undefined;
        }
      }

      if (req.method === "POST" && url.pathname === "/api/riot/api-key") {
        if (!input.riot) return sendJson(req, res, 503, { error: "Riot API client를 사용할 수 없습니다." });
        const body = await readJsonBody<{ apiKey?: unknown }>(req);
        if (typeof body.apiKey !== "string") return sendJson(req, res, 400, { error: "Riot API key는 문자열이어야 합니다." });
        try {
          return sendJson(req, res, 200, input.riot.setRuntimeApiKey(body.apiKey));
        } catch (error) {
          return sendJson(req, res, 400, { error: toSafeErrorMessage(error) });
        }
      }

      if (req.method === "POST" && url.pathname === "/api/riot/api-key/delete") {
        if (!input.riot) return sendJson(req, res, 503, { error: "Riot API client를 사용할 수 없습니다." });
        return sendJson(req, res, 200, input.riot.clearRuntimeApiKey());
      }

      if (req.method === "POST" && url.pathname === "/api/participation/role-override") {
        const body = await readJsonBody<{ entryId?: string; role?: string }>(req);
        if (!body.entryId || !body.role) return sendJson(req, res, 400, { error: "entryId와 role이 필요합니다." });
        const role = normalizeLolRole(body.role);
        if (role === "unknown") return sendJson(req, res, 400, { error: "허용되지 않은 role입니다." });
        const updated = input.store.setParticipationRequestedRole(body.entryId, role, compatibilityStreamerId);
        if (!updated) return sendJson(req, res, 404, { error: "시참 entry를 찾을 수 없습니다." });
        await input.actions.dispatchOne({
          type: "overlay.participationQueue",
          streamerId: compatibilityStreamerId,
          isOpen: input.store.getParticipationState(compatibilityStreamerId).isOpen,
          queue: input.store.getParticipationOverlayQueue(undefined, compatibilityStreamerId)
        }, {}, "dashboard.role_override");
        return sendJson(req, res, 200, input.store.getParticipationState(compatibilityStreamerId));
      }

      if (req.method === "POST" && url.pathname === "/api/participation/entry-status") {
        const body = await readJsonBody<{ entryId?: unknown; status?: unknown }>(req);
        if (typeof body.entryId !== "string" || !body.entryId.trim()) return sendJson(req, res, 400, { error: "entryId가 필요합니다." });
        if (typeof body.status !== "string" || !PARTICIPATION_ENTRY_STATUSES.has(body.status as ParticipationStatus)) {
          return sendJson(req, res, 400, { error: "허용되지 않은 참가자 상태입니다." });
        }
        const updated = input.store.markParticipant(body.entryId.trim(), body.status as ParticipationStatus, compatibilityStreamerId);
        if (!updated) return sendJson(req, res, 404, { error: "시참 entry를 찾을 수 없습니다." });
        await input.actions.dispatchOne({
          type: "overlay.participationQueue",
          streamerId: compatibilityStreamerId,
          isOpen: input.store.getParticipationState(compatibilityStreamerId).isOpen,
          queue: input.store.getParticipationOverlayQueue(undefined, compatibilityStreamerId),
          source: "dashboard.participation_entry_status"
        }, { user: "dashboard", input: "" }, "dashboard.participation_entry_status");
        return sendJson(req, res, 200, input.store.getParticipationState(compatibilityStreamerId));
      }

      if (req.method === "POST" && url.pathname === "/api/actions/test") {
        const body = await readJsonBody<{ action: BotAction }>(req);
        const validation = validateBotAction(body.action);
        if (!validation.ok) return sendJson(req, res, 400, validation);
        const streamerId = authenticatedStreamerOwnerId(auth.principal);
        await input.actions.dispatchOne(body.action, {
          user: "dashboard",
          input: "",
          ...(streamerId ? { streamerId } : {})
        }, "dashboard.test");
        return sendJson(req, res, 200, { ok: true });
      }

      if (req.method === "POST" && url.pathname === "/api/twitch/auth/disconnect") {
        await input.twitchAuth.disconnect();
        return sendJson(req, res, 200, await getTwitchStatus());
      }

      if (req.method === "POST" && url.pathname === "/api/twitch/token/refresh") {
        await input.twitchAuth.refreshStoredToken();
        input.eventSub?.reconnect("dashboard.token_refresh");
        return sendJson(req, res, 200, await getTwitchStatus());
      }

      if (req.method === "POST" && url.pathname === "/api/twitch/eventsub/reconnect") {
        input.eventSub?.reconnect("dashboard.admin");
        return sendJson(req, res, 200, await getTwitchStatus());
      }

      return sendJson(req, res, 404, { error: "not found" });
    } catch (error) {
      if (error instanceof HttpRequestError) return sendJson(req, res, error.status, error.payload);
      if (error instanceof PalworldQueryError) {
        return sendJson(req, res, 400, { error: error.publicMessage, code: error.code });
      }
      if (error instanceof PalworldRecordNotFoundError) {
        return sendJson(req, res, 404, { error: error.message, code: error.code });
      }
      if (error instanceof CommunityModerationServiceError) {
        return sendJson(req, res, error.status, { error: error.publicMessage });
      }
      input.logger?.error({
        type: "http_api.unhandled_error",
        path: url.pathname,
        method: req.method,
        error: toSafeErrorMessage(error)
      });
      return sendJson(req, res, 500, { error: "서버 내부 오류" });
    }
  };
}
