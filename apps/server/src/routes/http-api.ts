import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";
import zlib from "node:zlib";
import type { Store } from "../services/store.js";
import { loadAramAugmentCatalog } from "../services/aram-augment-catalog.js";
import type { GameBoxartService } from "../services/game-boxart.js";
import type { PatchNotesService } from "../services/patch-notes-service.js";
import type { PatchChangeSummaryService } from "../services/patch-change-summary.js";
import { storeParticipationRepository } from "../services/participation-repository.js";
import { publishParticipationSnapshot as publishAtomicParticipationSnapshot } from "../services/participation-snapshot.js";
import type { ActionDispatcher } from "../core/action-dispatcher.js";
import {
  TWITCH_PUBLIC_VIEWER_SCOPES,
  PALWORLD_SERVER_AVAILABILITY_ERROR_CODES,
  PALWORLD_SERVER_DIAGNOSTIC_KEYS,
  PALWORLD_SERVER_SAFE_REGISTRATION_POLICY,
  PALWORLD_PAL_SPAWN_GRID_SIZE,
  formatRiotId,
  lolPlatformSlug,
  lolRoutingContext,
  normalizeLolPlatformId,
  normalizeRiotIdKey,
  normalizeLolRole,
  PARTICIPATION_CHAT_LOCALES,
  PARTICIPATION_GAME_CAPACITY,
  PARTICIPATION_GAMES,
  parseRiotIdDetailed,
  parseTwitchExtensionSettingsInput,
  STREAMER_SUB_RIOT_ACCOUNT_LIMIT,
  DISCORD_ANNOUNCEMENT_MAX_JOBS,
  type DiscordAnnouncementJob,
  parseDiscordAnnouncementAckRequest,
  parseDiscordAnnouncementPendingRequest,
  parseDiscordGuildDirectoryReportRequest,
  parseDiscordInstallationObservationRequest,
  parseDiscordGameServerStatusRequest,
  parseDiscordPalworldPlayerLookupRequest,
  parseDiscordBotCommandPolicyRequest,
  parseDiscordBotResponseLocaleUpdateRequest,
  parseUpdateDiscordBotControlInput,
  parseDiscordSetupSessionRequest,
  isDiscordSnowflake,
  toSafeErrorMessage,
  validatePalworldServerConnectionInput,
  validatePalworldServerDashboardResponse,
  validatePalworldServerTestResponse,
  validatePalworldMapLocationsResponse,
  validatePalworldMapMarkersResponse,
  validatePalworldPalSpawnResponse,
  validateMinecraftEnchantCatalogResponse,
  validateMinecraftItemCatalogResponse,
  validateMinecraftPatchNotesResponse,
  validateMinecraftRecipeCatalogResponse,
  validateValorantAgentCatalogResponse,
  validateValorantLeaderboardResponse,
  validateValorantMapCatalogResponse,
  validateValorantStreamerListResponse,
  validateValorantStreamerMatchesResponse,
  validateValorantWeaponCatalogResponse,
  validateBotAction,
  type BotAction,
  type LolChampionSkinOption,
  type LolChampionSummary,
  type LolAutomationSettings,
  type LolOperationsState,
  type LolPerformanceStats,
  type LolRankHistoryPoint,
  type LolRankedStats,
  type LolRole,
  type LolRoleAnalysis,
  type LolPlatformId,
  type LolRoutingContext,
  type ParticipationChatLocale,
  type ParticipationEntry,
  type ParticipationGame,
  type ParticipationListingVisibility,
  type ParticipationPhase,
  type ParticipationSession,
  type ParticipationState,
  type ParticipationStreamerProfile,
  type ParticipationStatus,
  type PublicLolMatchRankParticipant,
  type PublicLolMatchRankResponse,
  type PalworldServerAvailabilityErrorCode,
  type PalworldServerConnectionInput,
  type PalworldServerDashboardResponse,
  type PalworldServerTestResponse,
  type PalworldMapLocationsResponse,
  type PalworldMapMarkersResponse,
  type PalworldPalSpawnResponse,
  type MinecraftPatchNotesResponse,
  type DashboardServerStatus,
  type FollowerManagementResponse,
  type GlobalAdminAuditAction,
  type StreamerProfileLink,
  type StreamerRiotIdentity,
  type ParticipationEntryCreatedInternalEvent,
  type ParticipationEntryRemovedInternalEvent,
  type StreamerRiotIdRequest,
  type StreamerRiotIdRequestListItem,
  type StreamerRiotIdRequestListResponse,
  type StreamerRiotIdVerificationSummary,
  type SupportMailAttachmentSummary,
  type SupportMailInboundPayload,
  type TwitchExtensionSettingsResponse
} from "@streamops/shared";
import type { TwitchAuthService } from "../services/twitch-auth.js";
import {
  TwitchFollowerLookupError,
  type TwitchApiClient,
  type TwitchArchiveVideosFailureReason,
  type TwitchStreamStatus
} from "../services/twitch-api.js";
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
import {
  PalworldServerMonitorInputError,
  PalworldServerMonitorRateLimitError,
  type PalworldServerMonitor
} from "../services/palworld-server-monitor.js";
import type { DataDragonService, LolChampionAbilitySummary, LolRuneSummary } from "../services/data-dragon.js";
import type { LolProfileCacheEntry, LolProfileRepository } from "../services/lol-profile-store.js";
import type { PublicLolSnapshotStore } from "../services/public-lol-snapshot-store.js";
import {
  decryptPublicLolProfileLink,
  encryptPublicLolProfileLink,
} from "../services/public-lol-profile-link.js";
import {
  PublicLolSocialCardRenderer,
  buildPublicLolSocialSummary,
  type PublicLolSocialProfile,
} from "../services/public-lol-social-card.js";
import {
  PatchNotesSocialCardRenderer,
  latestPatchNoteWithVersion,
  patchNotesCardModel,
} from "../services/patch-notes-social-card.js";
import { HomeSocialCardRenderer } from "../services/home-social-card.js";
import { appConfig, legalRuntimeConfigReady } from "../config.js";
import type { TwitchEventSubClient } from "../services/twitch-eventsub-client.js";
import type { EventBus } from "../core/event-bus.js";
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
import type { TwitchExtensionSettingsRepository } from "../database/repositories/twitch-extension-settings-repository.js";
import {
  parseStreamerCommentDraft,
  parseStreamerListQuery,
  parseStreamerPostDraft,
  parseStreamerReportReason,
  isStreamerPostId
} from "@streamops/shared";
import type { ReactionRecordsRepository } from "../database/repositories/reaction-records-repository.js";
import { StreamerBoardChannelService, twitchLoginForChannelKey } from "../services/streamer-board-channels.js";
import { TwitchVodIndex, parseTwitchVods, type MatchReplay } from "../services/twitch-vod-index.js";
import {
  StreamerChannelTakenError,
  type StreamerBoardCommentRow,
  type StreamerBoardPostRow,
  type StreamerBoardRepository
} from "../database/repositories/streamer-board-repository.js";
import {
  REACTION_SUBMIT_COOLDOWN_MS,
  parseReactionSubmission,
  reactionAnonymousLabel,
  reactionPercentile,
  reactionTierDistribution,
  reactionTierForAverage
} from "../services/reaction-records.js";
import {
  TwitchExtensionJwtError,
  type TwitchExtensionPrincipal,
  type TwitchExtensionJwtVerifier
} from "../security/twitch-extension-jwt.js";
import { SafeDatabaseError } from "../database/errors.js";
import {
  ANNOUNCEMENT_MAX_TARGETS,
  type AnnouncementDispatchTarget
} from "../database/repositories/discord-participation-announcement-repository.js";
import {
  AdminAuditLogQueryError,
  parseAdminAuditLogQuery,
  type AdminAuditLogRepository
} from "../database/repositories/admin-audit-log-repository.js";

/* 같은 메시지를 30초보다 자주 편집하지 않습니다. Discord rate limit 과
   채널 소음을 서버에서 막습니다. */
const ANNOUNCEMENT_MIN_EDIT_INTERVAL_MS = 30_000;
import type { SupportMailboxFilter, SupportMailboxStore } from "../services/support-mailbox-store.js";
import {
  DashboardSessionStore,
  authenticateDashboardRequest,
  authorizeHttpRequest,
  clearDashboardSessionCookie,
  clientIp,
  dashboardSessionCookie,
  dashboardSessionIdFromRequest,
  stateChangingRequestHasTrustedOrigin,
  tokenMatches,
  type AuthPrincipal,
  type DashboardRole
} from "../security/auth.js";
import {
  adminAuditApiLimiter,
  dashboardApiLimiter,
  dashboardLoginLimiter,
  inboundEmailLimiter,
  oauthLimiter,
  publicLolApiLimiter,
  publicMinecraftPatchNotesApiLimiter,
  publicPalworldApiLimiter,
  publicPalworldListApiLimiter,
  publicValorantApiLimiter,
  twitchExtensionApiLimiter
} from "../security/rate-limit.js";
import {
  isPublicDashboardAppRoute,
  isLocalizablePublicDashboardRoute,
  koJaPublicUrlLocale,
  publicUrlLocaleFromPathname,
  stripPublicUrlLocalePrefix,
  type PublicUrlLocale,
} from "../routing/public-dashboard-routes.js";
import {
  applyPublicSeoMetadata,
  localizedPublicSeoUrl,
  patchNotesDetailRouteForPath,
  patchNotesDetailSeoMetadata,
  palworldBreedingPath,
  palworldBreedingRouteForPath,
  palworldBreedingSeoMetadata,
  palworldEntityRedirectPath,
  palworldEntityRouteForPath,
  palworldEntitySeoMetadata,
  palworldBreedingFallback,
  palworldItemsFallback,
  palworldPalsFallback,
  palworldSkillsFallback,
  palworldTechnologyFallback,
  reactionShareRouteForPath,
  reactionShareSeoMetadata,
  publicSeoMetadataForPath,
  withLolProfileSeo,
  type PalworldSeoEntity,
  type PalworldSeoBreedingPair,
  type PublicSeoFact,
  type PublicSeoMetadata,
} from "./public-seo.js";
import {
  PALWORLD_SITEMAP_KINDS,
  PALWORLD_BREEDING_PAIRS_PER_SITEMAP,
  PUBLIC_SITEMAP_PATHS,
  SITEMAP_MAX_URLS,
  buildPalworldBreedingSitemap,
  buildPalworldEntitySitemap,
  buildPatchNotesSitemap,
  buildSitemapIndex,
  buildStaticSitemap,
  palworldBreedingSitemapPaths,
  palworldBreedingSitemapShard,
} from "./public-sitemap.js";
import type { PalworldEntityKind } from "./public-seo.js";
import {
  buildLivenessResponse,
  buildReadinessResponse,
  resolveReadiness,
  type ReadinessCheck
} from "../routing/health-responses.js";
import {
  PALWORLD_PUBLIC_CACHE_CONTROL,
  PalworldDomainUnavailableError,
  PalworldRecordNotFoundError,
  type PalworldDataService
} from "../services/palworld-data.js";
import {
  PalworldQueryError,
  parsePalworldBreedingParentsQuery,
  parsePalworldBreedingPartnersQuery,
  parsePalworldBreedingQuery,
  parsePalworldId,
  parsePalworldItemListQuery,
  parsePalworldMapLocationsQuery,
  parsePalworldMapMarkersQuery,
  parsePalworldPalSpawnQuery,
  parsePalworldPalListQuery,
  parsePalworldSkillListQuery,
  parsePalworldSearchQuery,
  parsePalworldTechnologyListQuery
} from "../services/palworld-query.js";
import type { PalworldMapMarkerProvider } from "../data/palworld-map-marker-artifact.js";
import type { PalworldSpawnProvider } from "../data/palworld-spawn-artifact.js";
import type { PalworldMapLocationsProvider } from "../data/palworld-map-locations-artifact.js";
import {
  MinecraftCatalogQueryError,
  type MinecraftCatalogService
} from "../services/minecraft-catalog.js";
import {
  MinecraftPatchNotesQueryError,
  parseMinecraftPatchNotesQuery,
  type MinecraftPatchNotesService
} from "../services/minecraft-patch-notes-service.js";
import {
  ValorantCatalogError,
  type ValorantPublicCatalogService
} from "../services/valorant-public-catalog.js";
import {
  ValorantPublicQueryError,
  type ValorantPublicService
} from "../services/valorant-public-service.js";
import {
  clearDiscordOnboardingCookie,
  DISCORD_ONBOARDING_COOKIE,
  discordBotInstallUrl,
  discordOnboardingCookie,
  DiscordOnboardingError,
  type DiscordOnboardingService
} from "../services/discord-onboarding-service.js";
import {
  clearDiscordManagementCookie,
  DISCORD_MANAGEMENT_OAUTH_COOKIE,
  DISCORD_MANAGEMENT_SESSION_COOKIE,
  discordManagementOAuthCookie,
  discordManagementReturnUrl,
  discordManagementSessionCookie,
  DiscordManagementError,
  requireManagementOrganizationId,
  type DiscordManagementService
} from "../services/discord-management-service.js";
import type { GameServerStatusReadService } from "../services/game-server-status-read-service.js";
import type { DiscordBotCommandPolicyService } from "../services/discord-bot-command-policy-service.js";
import {
  clearYoroCookie,
  YORO_OAUTH_COOKIE,
  YORO_SESSION_COOKIE,
  yoroOAuthCookie,
  yoroSessionCookie,
  YoroAccountError,
  type YoroAccountService
} from "../services/yoro-account-service.js";
import {
  isManagementOrganizationId,
  isPatchNoteLocale,
  parseCreatePalworldGameServerInput,
  patchPlayRecords,
  PATCH_PLAY_SAMPLE_LIMIT,
  type PatchNoteLocale,
  type PatchPlaySummary
} from "@streamops/shared";
import {
  DISCORD_INTERNAL_MAX_BODY_BYTES,
  type DiscordInternalAuthVerifier
} from "../security/discord-internal-auth.js";

const MAX_JSON_BODY_BYTES = 1_000_000;
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
/* 첫 조회에서 보여줄 최근 게임 수 — 그날의 종합 바가 하루 단위 흐름을 보여주므로
   초기 20게임이 2~3일치를 담습니다. 추가 페이지(MATCH_COUNT)는 10 유지.
   주의: 값만큼 Riot 매치 상세 조회가 늘어납니다(20 → 프로필당 최대 21회). */
const PUBLIC_LOL_PROFILE_INITIAL_MATCH_COUNT = 20;
const PUBLIC_LOL_PROFILE_MATCH_COUNT = 10;
const PUBLIC_LOL_PROFILE_MATCH_LOOKUP_COUNT = PUBLIC_LOL_PROFILE_MATCH_COUNT + 1;
const PUBLIC_LOL_PROFILE_MAX_MATCH_START = 200;
const STREAMER_PROFILE_LINK_MAX = 5;
const STREAMER_PROFILE_LINK_LABEL_MAX = 40;
const STREAMER_PROFILE_LINK_URL_MAX = 2048;
const PUBLIC_LOL_PROFILE_TOP_CHAMPION_COUNT = 5;
/* 2300 = 아수라장(증강 칼바람) — 실데이터로 확인(2026-08-17, 맹금류애니비아).
   공식 queues.json 의 2400(ARAM: Mayhem)과 다름 — 문서보다 실측을 따릅니다. */
const PUBLIC_LOL_PROFILE_QUEUES = [420, 440, 430, 400, 450, 2300];
type PublicLolMatchQueueFilter = "all" | "solo" | "flex" | "ranked5v5" | "normal" | "aram" | "aramMayhem";

const PUBLIC_LOL_MATCH_QUEUE_IDS: Record<PublicLolMatchQueueFilter, readonly number[]> = {
  all: [],
  solo: [420],
  flex: [440],
  /* 710 = 신규 특별 랭크 모드(2026-08-17 실데이터 확인). 솔로(420)·자유(440)는
     별도 칩이 담당하므로 이 칩은 710 전용입니다. 42·6 은 폐기 레거시. */
  ranked5v5: [710],
  normal: [400, 430],
  aram: [450],
  aramMayhem: [2300]
};
const PUBLIC_LOL_PROFILE_CACHE_TTL_MS = 10 * 60_000;
/* 패치별 전적은 경기가 끝나야 바뀝니다. 10분이면 충분하고 Riot 호출을 아낍니다. */
const PATCH_PLAY_CACHE_TTL_MS = 10 * 60_000;
const PUBLIC_LOL_PROFILE_STALE_TTL_MS = 24 * 60 * 60_000;
const PUBLIC_LOL_PROFILE_REFRESH_COOLDOWN_MS = 10 * 60_000;
const PUBLIC_LOL_PROFILE_CACHE_KEY_VERSION = "v2";
const PUBLIC_LOL_PLATFORM_MEMBERSHIP_CACHE_TTL_MS = 6 * 60 * 60_000;
const PUBLIC_LOL_PLATFORM_MEMBERSHIP_MISS_TTL_MS = 60_000;
const PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE = 100;
const PUBLIC_LOL_CURRENT_GAME_LIVE_CACHE_TTL_MS = 20_000;
const PUBLIC_LOL_CURRENT_GAME_NOT_FOUND_CACHE_TTL_MS = 5_000;
const PUBLIC_LOL_CURRENT_GAME_ERROR_CACHE_TTL_MS = 10_000;
const PUBLIC_LOL_MATCH_RANK_CACHE_TTL_MS = 30 * 60_000;
const PUBLIC_LOL_PARTICIPANT_RANK_CACHE_TTL_MS = 30 * 60_000;
const PUBLIC_LOL_MATCH_BUILD_CACHE_TTL_MS = 30 * 60_000;
const PUBLIC_LOL_MATCH_DETAIL_CACHE_TTL_MS = 30 * 60_000;
const PUBLIC_LOL_MATCH_TEAMS_CACHE_TTL_MS = 30 * 60_000;
const PUBLIC_LOL_MATCH_DETAIL_CACHE_MAX = 1000;
const PUBLIC_LOL_PROFILE_CACHE_MAX = 500;
const PUBLIC_LOL_CURRENT_GAME_CACHE_MAX = 500;
const PUBLIC_LOL_MATCH_CACHE_MAX = 1000;
const STREAMER_RIOT_ID_REQUEST_DEFAULT_PAGE_SIZE = 50;
const STREAMER_RIOT_ID_REQUEST_MAX_PAGE_SIZE = 100;
const STREAMER_RIOT_ID_REQUEST_QUERY_MAX_LENGTH = 100;
const STREAMER_RIOT_ID_REQUEST_CURSOR_MAX_LENGTH = 512;
const STREAMER_RIOT_ID_VERIFICATION_FAILURE_TTL_MS = 10 * 60_000;
const STREAMER_RIOT_ID_VERIFICATION_FUTURE_SKEW_MS = 5 * 60_000;
const STREAMER_RIOT_ID_REQUEST_CURSOR_FALLBACK_SECRET = crypto.randomBytes(32);
const TWITCH_STREAM_EVENTSUB_LIVE_FALLBACK_MAX_AGE_MS = 5 * 60_000;
const SERVER_PROCESS_STARTED_AT = new Date(Date.now() - process.uptime() * 1000).toISOString();
const PUBLIC_TWITCH_SUBSCRIPTION_CHECK_LIMIT = 30;
const PUBLIC_TWITCH_FOLLOWED_CACHE_TTL_MS = 15_000;
const PUBLIC_TWITCH_FOLLOWED_CACHE_MAX = 500;
const SAFE_CHAT_URL_PROTOCOLS = new Set(["http", "https"]);
const PARTICIPATION_INVITE_TARGET_STATUSES = new Set(["verified", "waitlisted", "selected", "checked_in", "invited"]);
const PARTICIPATION_MANUAL_ACTIONS = new Set(["open", "show_queue", "select_next", "mark_in_game", "finish_game", "close"]);
const PARTICIPATION_SESSION_ACTIONS = new Set(["start", "finish", ...PARTICIPATION_MANUAL_ACTIONS]);
const PARTICIPATION_DASHBOARD_ENTRY_STATUSES = new Set<ParticipationStatus>([
  "selected",
  "checked_in",
  "in_game",
  "played",
  "skipped",
  "no_show"
]);
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

const PALWORLD_DATA_UNAVAILABLE_RESPONSE = {
  error: "PALWORLD_DATA_UNAVAILABLE",
  message: "Palworld 데이터를 사용할 수 없습니다."
} as const;

function publicLolProfileCacheHeaders(payload: PublicLolProfileHttpResponse, refresh: boolean): Record<string, string> {
  if (refresh) return noStoreHeaders();
  return publicLolCacheHeaders("profile", payload, "public, max-age=30, stale-while-revalidate=120");
}

function twitchUserLogKey(twitchUserId: string): string {
  return crypto
    .createHash("sha256")
    .update("public-lol-vod-v1\0", "utf8")
    .update(twitchUserId, "utf8")
    .digest("hex")
    .slice(0, 16);
}

function publicLolCacheHeaders(
  scope: string,
  payload: unknown,
  cacheControl = "public, max-age=30, stale-while-revalidate=120"
): Record<string, string> {
  const etag = crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 24);
  return {
    "Cache-Control": cacheControl,
    ETag: `"lol-${scope}-${etag}"`
  };
}

function palworldCacheHeaders(
  metadata: { gameVersion: string; sourceRevision: string },
  requestTarget: string,
  payload: unknown,
  domainIdentity: unknown
): Record<string, string> {
  // 최상위 release revision이 같아도 교배 근거·번역 병합·표시 정책은 바뀔 수 있습니다.
  // domain identity와 실제 응답 본문을 함께 ETag에 포함해 브라우저·CDN이 이전 응답을
  // 304로 재사용하지 않도록 하며, 동일한 composite는 계속 재검증할 수 있게 합니다.
  const serializedPayload = JSON.stringify(payload);
  const serializedDomainIdentity = JSON.stringify(domainIdentity);
  const releaseTag = crypto
    .createHash("sha256")
    .update(metadata.gameVersion)
    .update("\0")
    .update(metadata.sourceRevision)
    .update("\0")
    .update(serializedDomainIdentity)
    .update("\0")
    .update(requestTarget)
    .update("\0")
    .update(serializedPayload)
    .digest("hex")
    .slice(0, 24);
  return {
    "Cache-Control": PALWORLD_PUBLIC_CACHE_CONTROL,
    "X-Palworld-Data-Version": metadata.gameVersion,
    "X-Palworld-Data-Revision": metadata.sourceRevision,
    ETag: `"palworld-${releaseTag}"`
  };
}

function palworldNoStoreHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const { ETag: _etag, ...rest } = headers;
  return { ...rest, "Cache-Control": "no-store" };
}

function palworldRateLimitGroup(pathname: string): {
  group: string;
  list: boolean;
} {
  if (
    pathname === "/api/palworld/meta"
    || pathname === "/api/palworld/pals"
    || pathname === "/api/palworld/items"
    || pathname === "/api/palworld/technology"
    || pathname === "/api/palworld/skills"
  ) {
    return { group: "list", list: true };
  }
  if (pathname === "/api/palworld/search") return { group: "search", list: false };
  if (pathname.startsWith("/api/palworld/breeding")) return { group: "breeding", list: false };
  if (pathname.startsWith("/api/palworld/map/")) return { group: "map", list: false };
  return { group: "detail", list: false };
}

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

type PublicLolMatchItem = {
  slot: number;
  itemId: number;
  iconUrl?: string;
  nameKo?: string;
  nameJa?: string;
  nameEn?: string;
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
  items: PublicLolMatchItem[];
  summonerSpells: number[];
  runes: PublicLolMatchRune[];
  /* 증강 모드에서 고른 증강 id. 증강이 없는 모드에서는 생략합니다.
     Riot 은 모든 경기에 playerAugment1~6 을 담아 주고 값 0 은 미선택입니다. */
  augmentIds?: number[];
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
  nameEn?: string;
  iconUrl?: string;
};

type PublicLolMatchBuildParticipant = {
  participantId?: number;
  riotId?: string;
  teamId?: number;
  result: "win" | "loss" | "unknown";
  champion: LolChampionSummary;
  score: number;
  items: PublicLolMatchItem[];
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

type PublicLolMatchTeamsResponse = {
  status: "ready";
  matchId: string;
  teams: PublicLolMatchTeamDetail[];
  fetchedAt: string;
};

/* 아레나(큐 1700/1710/1750) 확장 — docs/mockups/lol-arena-match-row.html §⑥ 계약.
   프런트 타입(public-lol.ts)과 같은 모양이며, 아레나가 아니면 전부 생략합니다. */
type PublicLolArenaTeamPlayer = {
  riotId?: string;
  champion: LolChampionSummary;
  kills: number;
  deaths: number;
  assists: number;
  damageDealtToChampions?: number;
  goldEarned?: number;
  items?: PublicLolMatchItem[];
  augments?: number[];
  isTarget?: boolean;
};

type PublicLolArenaTeam = {
  /** 팀 최종 순위(1 = 우승). */
  placement: number;
  players: PublicLolArenaTeamPlayer[];
};

type PublicLolRecentMatch = {
  matchId: string;
  /** 증강 픽(픽 순서 유지) — 증강이 있는 모드(큐 2400 등)에서만 채워집니다. */
  augments?: number[];
  /** 아레나: 내 팀 최종 순위(subteamPlacement). */
  placement?: number;
  /** 아레나: 내 팀 id(playerSubteamId). */
  subteamId?: number;
  /** 아레나: 순위순 전체 팀 명단. 상세(teams) 하이드레이션 시점에만 채웁니다. */
  arenaTeams?: PublicLolArenaTeam[];
  champion: LolChampionSummary;
  queueId?: number;
  gameMode?: string;
  gameType?: string;
  mapId?: number;
  startedAt?: string;
  durationSeconds?: number;
  /* 다시보기 점프 지점. 스트리머로 연동된 프로필이고 그 경기를 담은 아카이브가
     남아 있을 때만 붙습니다 — 없으면 화면이 버튼을 그리지 않습니다. */
  replay?: MatchReplay;
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
  items: PublicLolMatchItem[];
  summonerSpells: number[];
  runes: PublicLolMatchRune[];
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
  status: "checking" | "live" | "not_found" | "unavailable";
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
  /** 같이 플레이한 소환사(함께 2게임 이상, 상위 5) — puuid 비노출. */
  frequentTeammates?: Array<{
    gameName: string;
    tagLine: string;
    games: number;
    wins: number;
    lastPlayedAt?: string;
  }>;
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

type PublicLolProfileHttpResponse = PublicLolProfileResponse & {
  /** 주소창에 Riot ID 평문을 남기지 않는 서버 발급 authenticated token입니다. */
  profileToken: string;
};

type PublicLolProfileDynamicResponse = {
  status: "ready";
  riotId: string;
  twitchStream?: PublicLolTwitchStream;
  liveGame: PublicLolCurrentGame;
  fetchedAt: string;
};

function isPublicLolProfileSnapshot(value: unknown): value is PublicLolProfileResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.status !== "ready") return false;
  if (["riotId", "gameName", "tagLine", "accountRegion", "lolPlatform", "fetchedAt"].some((key) => typeof record[key] !== "string")) return false;
  if (!Number.isFinite(Date.parse(record.fetchedAt as string))) return false;
  if (!Array.isArray(record.topChampions) || !Array.isArray(record.recentMatches)) return false;
  if (!Array.isArray(record.championPerformance) || !Array.isArray(record.rolePerformance)) return false;
  if (!record.summary || typeof record.summary !== "object" || Array.isArray(record.summary)) return false;
  if (!record.liveGame || typeof record.liveGame !== "object" || Array.isArray(record.liveGame)) return false;
  if (record.frequentTeammates !== undefined && (!Array.isArray(record.frequentTeammates)
    || !record.frequentTeammates.every((teammate) => {
      if (!teammate || typeof teammate !== "object" || Array.isArray(teammate)) return false;
      const item = teammate as Record<string, unknown>;
      return typeof item.gameName === "string"
        && typeof item.tagLine === "string"
        && typeof item.games === "number"
        && Number.isFinite(item.games)
        && typeof item.wins === "number"
        && Number.isFinite(item.wins)
        && (item.lastPlayedAt === undefined || typeof item.lastPlayedAt === "string");
    }))) return false;
  return record.recentMatches.every((match) => {
    if (!match || typeof match !== "object" || Array.isArray(match)) return false;
    const item = match as Record<string, unknown>;
    return typeof item.matchId === "string"
      && typeof item.kills === "number"
      && typeof item.deaths === "number"
      && typeof item.assists === "number"
      && Array.isArray(item.items)
      && Array.isArray(item.summonerSpells)
      && Array.isArray(item.runes)
      && Array.isArray(item.teams);
  });
}

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
  game: ParticipationGame;
  palworldNickname?: string;
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
  riotId?: string;
  source: ParticipationEntry["source"];
  checkInExpiresAt?: string;
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
  isLive?: boolean;
  isOpen: boolean;
  queueSize: number;
  maxQueueSize?: number;
  publicSessionId?: string;
  sessionStatus?: ParticipationSession["status"];
  listingVisibility?: ParticipationListingVisibility;
  updatedAt: string;
};

type PublicParticipationDiscoveryResponse = {
  connected: boolean;
  configured: boolean;
  followedRecruiting: PublicParticipationStreamer[];
  followedLiveButClosed: PublicParticipationStreamer[];
  followedOfflineRecruiting: PublicParticipationStreamer[];
  metadata: {
    fetchedAt: string;
    revision: number;
  };
};

type PublicParticipationStateResponse = {
  connected: boolean;
  configured: boolean;
  isOpen: boolean;
  summary: ReturnType<Store["getParticipationState"]>["summary"];
  streamers: PublicParticipationStreamer[];
  selectedStreamerId?: string;
  publicSessionId?: string;
  revision: number;
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

/* 알림 대상은 최대 3개라 본문이 작습니다. 기본 상한보다 좁게 잡습니다. */
const ANNOUNCEMENT_MAX_BODY_BYTES = 4 * 1024;

function parseParticipationAnnouncementInput(value: unknown): {
  enabled: boolean;
  targets: Array<{
    organizationId: string;
    discordGuildId: string;
    channelId: string;
    mentionRoleId?: string;
  }>;
} | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !== "enabled,targets"
    || typeof record.enabled !== "boolean"
    || !Array.isArray(record.targets)
    || record.targets.length > ANNOUNCEMENT_MAX_TARGETS
  ) return undefined;
  const targets: Array<{
    organizationId: string;
    discordGuildId: string;
    channelId: string;
    mentionRoleId?: string;
  }> = [];
  for (const item of record.targets) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
    const target = item as Record<string, unknown>;
    const keys = Object.keys(target).sort().join(",");
    if (
      (keys !== "channelId,discordGuildId,organizationId"
        && keys !== "channelId,discordGuildId,mentionRoleId,organizationId")
      || !isManagementOrganizationId(target.organizationId)
      || !isDiscordSnowflake(target.discordGuildId)
      || !isDiscordSnowflake(target.channelId)
      || (target.mentionRoleId !== undefined && !isDiscordSnowflake(target.mentionRoleId))
    ) return undefined;
    targets.push({
      organizationId: target.organizationId,
      discordGuildId: target.discordGuildId,
      channelId: target.channelId,
      ...(target.mentionRoleId === undefined
        ? {}
        : { mentionRoleId: target.mentionRoleId as string })
    });
  }
  return { enabled: record.enabled, targets };
}

/* 저장 실패를 안전한 코드로 바꿉니다.
   멤버가 아닌 organization 은 존재 여부가 새지 않도록 404 로 답합니다. */
function announcementFailure(error: unknown): [number, { error: string; code: string }] {
  const code = error instanceof SafeDatabaseError ? error.code : undefined;
  if (code === "DATABASE_REFERENCE_INVALID") {
    return [404, { error: "Organization을 찾을 수 없습니다.", code: "ORGANIZATION_NOT_FOUND" }];
  }
  if (code === "DATABASE_CONFLICT") {
    return [409, {
      error: "이 서버의 관리자가 참여 알림을 껐습니다.",
      code: "ANNOUNCEMENT_DISABLED_BY_GUILD"
    }];
  }
  if (code === "DATABASE_INVALID_INPUT") {
    return [400, { error: "알림 대상이 올바르지 않습니다.", code: "CHANNEL_NOT_ALLOWED" }];
  }
  throw error;
}

async function readJsonBody<T>(
  req: IncomingMessage,
  maxBytes = MAX_JSON_BODY_BYTES
): Promise<T> {
  const raw = await readBody(req, maxBytes);
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
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-StreamOps-Dashboard-Token, X-StreamOps-Dashboard-Surface, X-StreamOps-Streamer-Slug, X-StreamOps-Dashboard-Key, X-StreamOps-CSRF, X-Discord-CSRF, X-Yoro-CSRF",
    "Vary": "Origin"
  };
  if (typeof origin === "string") {
    const allowed = appConfig.security.corsOrigins.includes(origin)
      || (appConfig.twitchExtension.enabled && origin === appConfig.twitchExtension.origin)
      || (appConfig.nodeEnv !== "production" && isDevLocalOrigin(origin));
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
  const etag = headers.ETag;
  const ifNoneMatch = req.headers["if-none-match"];
  if (
    req.method === "GET"
    && status === 200
    && typeof etag === "string"
    && typeof ifNoneMatch === "string"
    && (ifNoneMatch === "*" || ifNoneMatch.split(",").map((value) => value.trim()).includes(etag))
  ) {
    res.writeHead(304, {
      ...securityHeadersForRequest(req),
      ...corsHeaders(req),
      ...headers
    });
    res.end();
    return;
  }
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

function sendPermanentRedirect(
  res: ServerResponse,
  location: string,
  headers: Record<string, string | string[]> = {}
): void {
  res.writeHead(308, { ...SECURITY_HEADERS, Location: location, ...headers });
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

function headerFirstValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim();
}

function requestProtocol(req: IncomingMessage): "http" | "https" {
  const forwardedProto = appConfig.security.trustProxy ? headerFirstValue(req.headers["x-forwarded-proto"]) : undefined;
  if (forwardedProto === "http" || forwardedProto === "https") return forwardedProto;
  const encrypted = Boolean((req.socket as IncomingMessage["socket"] & { encrypted?: boolean } | undefined)?.encrypted);
  return encrypted ? "https" : "http";
}

function securityHeadersForRequest(_req: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = { ...SECURITY_HEADERS };
  if (appConfig.nodeEnv === "production") {
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
      appConfig.twitch.publicRedirectUri,
      ...appConfig.security.corsOrigins
    ]
      .map(originFromUrl)
      .filter((origin): origin is string => Boolean(origin))
  );
  const requestedOrigin = requestOrigin(req);
  return requestedOrigin && allowedOrigins.has(requestedOrigin) ? requestedOrigin : fallback;
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
  const url = new URL("/lol", trustedPublicOriginForRequest(req));
  url.searchParams.set("viewer_twitch", "connected");
  return url.toString();
}

const PUBLIC_TWITCH_PALWORLD_RETURN_PATHS = new Set([
  "/palworld",
  "/palworld/pals",
  "/palworld/breeding",
  "/palworld/items",
  "/palworld/technology",
  "/palworld/skills",
  "/palworld/map",
  "/palworld/search"
]);

function hasUnsafePublicTwitchReturnValue(value: string): boolean {
  if (value.length > 4_096) return true;
  let decoded = value;
  for (let depth = 0; depth < 8; depth += 1) {
    if (/[\\\u0000-\u001f\u007f]/u.test(decoded)) return true;
    const next = decoded.replace(/%([0-9a-f]{2})/giu, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    );
    if (next === decoded) return false;
    decoded = next;
  }
  return /[\\\u0000-\u001f\u007f]/u.test(decoded) || /%[0-9a-f]{2}/iu.test(decoded);
}

function publicTwitchReturnUrlForRequest(req: IncomingMessage, requestedPath: string | null): string {
  const fallback = publicLolReturnUrlForRequest(req);
  if (!requestedPath?.startsWith("/") || requestedPath.startsWith("//")) return fallback;
  if (hasUnsafePublicTwitchReturnValue(requestedPath)) return fallback;
  const origin = trustedPublicOriginForRequest(req);
  let returnUrl: URL;
  try {
    returnUrl = new URL(requestedPath, origin);
  } catch {
    return fallback;
  }
  const rawPathname = requestedPath.split(/[?#]/u, 1)[0];
  if (
    returnUrl.origin !== origin ||
    returnUrl.username ||
    returnUrl.password ||
    returnUrl.hash ||
    rawPathname !== returnUrl.pathname
  ) {
    return fallback;
  }
  const dashboardPath = returnUrl.pathname === "/dashboard" || returnUrl.pathname.startsWith("/dashboard/");
  const publicPath = stripPublicUrlLocalePrefix(returnUrl.pathname);
  if (
    !dashboardPath
    && !PUBLIC_TWITCH_PALWORLD_RETURN_PATHS.has(returnUrl.pathname)
    && !isLocalizablePublicDashboardRoute(publicPath)
  ) {
    return fallback;
  }
  returnUrl.searchParams.set("viewer_twitch", "connected");
  return returnUrl.toString();
}

function cspConnectSrcForRequest(req: IncomingMessage | undefined): string {
  const requestPublicOrigin = req ? trustedPublicOriginForRequest(req) : originFromUrl(appConfig.publicBaseUrl);
  return [
    "'self'",
    originFor(appConfig.publicBaseUrl),
    requestPublicOrigin
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" ");
}

const DASHBOARD_CSP_NONCE_PLACEHOLDER = "__STREAMOPS_CSP_NONCE__";

function cspForStaticApp(
  mountPath: "/admin" | "/dashboard",
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
      /* 루트 홈의 명조 헤드라인과 붓글씨 마크는 Google Fonts 에서 받습니다.
         호스트를 정확히 두 개만 엽니다 — https: 전체를 열면 임의의 외부 stylesheet 가
         들어옵니다. font-src 가 없으면 default-src 'self' 로 떨어져 글꼴 파일 자체가
         막히므로 함께 둡니다(실측: 열기 전에는 두 요청 모두 차단됐습니다). */
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      `connect-src ${cspConnectSrcForRequest(req)} https:`,
      "frame-src 'self' https:",
      "fenced-frame-src https:",
      "frame-ancestors 'self'",
      "form-action 'self'"
    ].join("; ");
  }
  return "default-src 'none'";
}

function staticSecurityHeaders(
  req: IncomingMessage,
  filePath: string,
  mountPath?: "/admin" | "/dashboard",
  nonce?: string
): Record<string, string> {
  const headers = securityHeadersForRequest(req);
  if (filePath.endsWith("index.html")) {
    const resolvedMountPath = mountPath
      ?? (filePath.includes(`${path.sep}dashboard${path.sep}`) ? "/dashboard" : undefined);
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
  dashboardAuthRequired: ${appConfig.security.localNoAuth ? "false" : "true"},
  legal: ${legal}
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
  /* 홈 히어로 키아트가 avif 우선(<picture>) — octet-stream 폴백이면 일부
     브라우저가 이미지를 그리지 않거나 페인트를 미룹니다(2026-08-22 실측). */
  if (ext === ".avif") return "image/avif";
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

function requestCookie(req: IncomingMessage, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function discordSetupReturnUrl(status: "connected" | "error"): string {
  const target = new URL("/dashboard/organizations", appConfig.dashboardBaseUrl);
  target.searchParams.set("discord", status);
  return target.toString();
}

function discordManagementConnectReturnUrl(status: "select" | "error"): string {
  const target = new URL("/dashboard/organizations", appConfig.dashboardBaseUrl);
  target.searchParams.set("connect", status);
  return target.toString();
}

function legacyDiscordDashboardReturnUrl(url: URL): string {
  const target = new URL("/dashboard/organizations", appConfig.dashboardBaseUrl);
  const setup = url.searchParams.get("setup");
  const discord = url.searchParams.get("discord");
  const connect = url.searchParams.get("connect");
  if (setup && /^[A-Za-z0-9_-]{32,128}$/u.test(setup)) {
    target.searchParams.set("setup", setup);
  }
  if (discord === "connected" || discord === "error") {
    target.searchParams.set("discord", discord);
  }
  if (connect === "select" || connect === "error") {
    target.searchParams.set("connect", connect);
  }
  return `${target.pathname}${target.search}`;
}

function legacyBotPublicReturnPath(url: URL): string | undefined {
  const locale = publicUrlLocaleFromPathname(url.pathname);
  const unprefixed = stripPublicUrlLocalePrefix(url.pathname);
  const normalized = unprefixed.length > 1 && unprefixed.endsWith("/")
    ? unprefixed.slice(0, -1)
    : unprefixed;
  const canonical = new Map([
    ["/bot/features", "/bot/commands"],
    ["/bot/connect", "/bot/getting-started"],
    ["/bot/dedicated-server", "/bot/game-files"]
  ]).get(normalized);
  if (!canonical) return undefined;
  return `${locale ? `/${locale}` : ""}${canonical}${url.search}`;
}

/** 걷어낸 커뮤니티가 향하는 곳. dashboard 의 route key 와 같은 값입니다. */
const PUBLIC_PATCH_NOTES_PATH = "/patch-notes";

/**
 * 걷어낸 커뮤니티 URL을 패치 노트로 영구 이전합니다.
 *
 * `/community/*` 는 색인과 북마크에 남아 있습니다. 404 로 두면 그 신호가 버려지므로
 * 308 로 넘깁니다. 언어 prefix 와 query 는 그대로 유지합니다.
 */
function retiredCommunityReturnPath(url: URL): string | undefined {
  const locale = publicUrlLocaleFromPathname(url.pathname);
  const unprefixed = stripPublicUrlLocalePrefix(url.pathname);
  const normalized = unprefixed.length > 1 && unprefixed.endsWith("/")
    ? unprefixed.slice(0, -1)
    : unprefixed;
  if (normalized !== "/community" && !normalized.startsWith("/community/")) return undefined;
  return `${locale ? `/${locale}` : ""}${PUBLIC_PATCH_NOTES_PATH}${url.search}`;
}

function legacyStreamerDashboardReturnPath(pathname: string): string | undefined {
  const normalized = pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  const canonicalPaths = new Set([
    "/dashboard/streaming/permissions",
    "/dashboard/streaming/followers",
    "/dashboard/streaming/riot-id"
  ]);
  if (canonicalPaths.has(normalized)) return undefined;
  const matched = normalized.match(
    /^\/dashboard\/[a-zA-Z0-9_-]{1,64}\/sdk_[a-zA-Z0-9_-]{8,128}(?:\/(followers|riot-id))?$/u
  );
  if (!matched) return undefined;
  if (matched[1] === "followers") return "/dashboard/streaming/followers";
  if (matched[1] === "riot-id") return "/dashboard/streaming/riot-id";
  return "/dashboard/streaming";
}

function yoroAccountReturnUrl(
  returnPath: string,
  errorCode?: string,
  connectedProvider?: "twitch" | "riot"
): string {
  const target = new URL(returnPath, appConfig.dashboardBaseUrl);
  if (errorCode) target.searchParams.set("account", errorCode);
  if (!errorCode && connectedProvider) {
    target.searchParams.set("account", `${connectedProvider}_connected`);
  }
  return target.toString();
}

function discordJsonBodyAllowed(req: IncomingMessage): boolean {
  const contentType = requestHeaderValue(req, "content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  return contentType === "application/json";
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

/** 패치 노트 수집기로 들어갈 수 있는 locale을 shared 허용 목록으로 좁힙니다. */
function patchNoteLocaleFrom(value: string | null): PatchNoteLocale | undefined {
  return isPatchNoteLocale(value) ? value : undefined;
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

function multipartText(parts: MultipartPart[], name: string): string | undefined {
  const part = parts.find((item) => item.name === name && !item.filename);
  return part ? part.data.toString("utf8").trim() : undefined;
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
      if (streamerId && input.store.getParticipationSession(streamerId)) {
        input.store.updateParticipationSessionStatus(streamerId, "recruiting");
      }
      await broadcastParticipationSnapshot(input, "recruiting", "dashboard.participation_manual.open", streamerId);
      return "recruiting";
    case "show_queue": {
      const phase = input.store.getParticipationState(streamerId).isOpen ? "recruiting" : "closed";
      await broadcastParticipationSnapshot(input, phase, "dashboard.participation_manual.show_queue", streamerId);
      return phase;
    }
    case "select_next": {
      const state = input.store.getParticipationState(streamerId);
      if (!state.session || state.session.status !== "recruiting") {
        throw new HttpRequestError(409, {
          error: "모집 중인 시청자 참여 세션이 필요합니다.",
          code: "SESSION_NOT_RECRUITING"
        });
      }
      const checkInSeconds = state.session?.checkInSeconds ?? 60;
      input.store.selectNextParticipant(checkInSeconds, streamerId);
      const phase = state.isOpen ? "recruiting" : "closed";
      await broadcastParticipationSnapshot(input, phase, "dashboard.participation_manual.select_next", streamerId);
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
      if (streamerId && input.store.getParticipationSession(streamerId)) {
        input.store.updateParticipationSessionStatus(streamerId, "closed");
      }
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

/**
 * sitemap에 넣을 Palworld 엔티티 id 목록입니다.
 * 정렬을 고정해 sitemap 내용이 요청마다 흔들리지 않게 합니다.
 */
function palworldEntityIdsForSitemap(
  service: PalworldDataService,
  kind: PalworldEntityKind
): string[] {
  const page = { order: "asc", page: 1, limit: SITEMAP_MAX_URLS } as const;
  if (kind === "pal") {
    return service.listPals({ ...page, sort: "number" }).items.map((entry) => entry.id);
  }
  if (kind === "item") {
    return service.listItems({ ...page, sort: "name" }).items.map((entry) => entry.id);
  }
  return service.listSkills({ ...page, sort: "name" }).items.map((entry) => entry.id);
}

type PublicLolProfileRoute = {
  gameName: string;
  /** LoL 화면은 ko·ja 만 있습니다 — /en 은 파서에서 ko 로 접힙니다. */
  locale: "ko" | "ja";
  lolPlatform: string;
  platformSlug: string;
  profileSlug: string;
  tagLine: string;
};

type PublicLolSocialImageRoute = PublicLolProfileRoute & {
  revision: string;
};

function parsePublicLolProfileSlug(value: string): { gameName: string; tagLine: string } | undefined {
  const decoded = decodeUrlPathSegment(value);
  if (!decoded || decoded.length > 100 || decoded.includes("/") || decoded.includes("\\")) return undefined;
  const separator = decoded.lastIndexOf("-");
  if (separator <= 0 || separator === decoded.length - 1) return undefined;
  const parsed = parseRiotIdDetailed(`${decoded.slice(0, separator)}#${decoded.slice(separator + 1)}`);
  return parsed.ok ? { gameName: parsed.gameName, tagLine: parsed.tagLine } : undefined;
}

function publicLolProfileToken(value: { riotId: string; lolPlatform: string }): string {
  const lolPlatform = normalizeLolPlatformId(value.lolPlatform);
  if (!lolPlatform) throw new Error("PUBLIC_LOL_PROFILE_LINK_INPUT_INVALID");
  return encryptPublicLolProfileLink(
    { riotId: value.riotId, lolPlatform },
    appConfig.twitch.tokenEncryptionKey,
    appConfig.nodeEnv,
  );
}

function publicLolProfileFromToken(token: string): { riotId: string; lolPlatform: LolPlatformId } {
  return decryptPublicLolProfileLink(
    token,
    appConfig.twitch.tokenEncryptionKey,
    appConfig.nodeEnv,
  );
}

function withPublicLolProfileToken(profile: PublicLolProfileResponse): PublicLolProfileHttpResponse {
  return {
    ...profile,
    profileToken: publicLolProfileToken(profile),
  };
}

function publicLolProfileRouteForPath(pathname: string): PublicLolProfileRoute | undefined {
  /* LoL 화면은 ko·ja 만 있어 /en 도 ko 판으로 봅니다 — canonical 도 /ko 로 모입니다. */
  const locale = koJaPublicUrlLocale(publicUrlLocaleFromPathname(pathname) ?? "ko");
  const normalized = stripPublicUrlLocalePrefix(pathname).replace(/\/$/u, "");
  const match = /^\/lol\/summoners\/([^/]+)\/([^/]+)$/u.exec(normalized);
  if (!match?.[1] || !match[2]) return undefined;
  const platform = normalizeLolPlatformId(match[1]);
  let riotId: { gameName: string; tagLine: string } | undefined;
  let profileSlug = match[2];
  if (profileSlug.startsWith("~")) {
    try {
      const linked = publicLolProfileFromToken(profileSlug.slice(1));
      if (linked.lolPlatform !== platform) return undefined;
      const parsed = parseRiotIdDetailed(linked.riotId);
      if (parsed.ok) riotId = { gameName: parsed.gameName, tagLine: parsed.tagLine };
    } catch {
      return undefined;
    }
  } else {
    riotId = parsePublicLolProfileSlug(profileSlug);
    if (platform && riotId) {
      profileSlug = `~${publicLolProfileToken({
        riotId: `${riotId.gameName}#${riotId.tagLine}`,
        lolPlatform: platform,
      })}`;
    }
  }
  if (!platform || !riotId) return undefined;
  return {
    ...riotId,
    locale,
    lolPlatform: platform,
    platformSlug: lolPlatformSlug(platform),
    profileSlug,
  };
}

function publicLolSocialImageRouteForPath(pathname: string): PublicLolSocialImageRoute | undefined {
  const match = /^\/social\/lol\/(ko|ja)\/([^/]+)\/([^/]+)\/([a-f0-9]{16})\.png$/u.exec(pathname);
  if (!match?.[1] || !match[2] || !match[3] || !match[4]) return undefined;
  const platform = normalizeLolPlatformId(match[2]);
  const riotId = parsePublicLolProfileSlug(match[3]);
  if (!platform || !riotId) return undefined;
  return {
    ...riotId,
    locale: match[1] as "ko" | "ja",
    lolPlatform: platform,
    platformSlug: lolPlatformSlug(platform),
    profileSlug: match[3],
    revision: match[4],
  };
}

async function sendStaticFile(
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string,
  extraHeaders: Record<string, string> = {},
  mountPath?: "/admin" | "/dashboard",
  transformText?: (text: string) => string
): Promise<void> {
  const compressibleExtensions = new Set([".js", ".mjs", ".css", ".html", ".svg", ".json", ".txt", ".xml"]);
  const compressionCacheMaxEntries = 200;
  type StaticContentEncoding = "br" | "gzip";
  type SendStaticFileWithCache = typeof sendStaticFile & {
    compressionCache?: Map<string, Buffer>;
  };
  const compressionCache = ((sendStaticFile as SendStaticFileWithCache).compressionCache ??= new Map<string, Buffer>());

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error("not found");
    const isDashboardHtml = filePath.endsWith("index.html")
      && (mountPath === "/admin" || mountPath === "/dashboard" || filePath.includes(`${path.sep}dashboard${path.sep}`));
    const cspNonce = isDashboardHtml ? crypto.randomBytes(18).toString("base64url") : undefined;
    const etag = staticEtag(stat.size, stat.mtimeMs);
    const lastModified = stat.mtime.toUTCString();
    const publicMetadata = ["ads.txt", "robots.txt", "sitemap.xml", "favicon.png", "favicon.svg"].includes(path.basename(filePath));
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
      ...extraHeaders,
      "Vary": extraHeaders.Vary
        ? `${extraHeaders.Vary}, Accept-Encoding`
        : "Accept-Encoding"
    };
    if (!cspNonce && isNotModified(req, etag, stat.mtime)) {
      res.writeHead(304, baseHeaders);
      res.end();
      return;
    }
    const fileBody = await fs.readFile(filePath);
    const transformedText = transformText
      ? transformText(fileBody.toString("utf8"))
      : undefined;
    const body = cspNonce
      ? Buffer.from(
          (transformedText ?? fileBody.toString("utf8"))
            .replaceAll(DASHBOARD_CSP_NONCE_PLACEHOLDER, cspNonce),
          "utf8"
        )
      : transformedText !== undefined
        ? Buffer.from(transformedText, "utf8")
      : fileBody;
    let responseBody: Buffer = body;
    let contentEncoding: StaticContentEncoding | undefined;
    if (compressibleExtensions.has(path.extname(filePath).toLowerCase())) {
      const acceptEncodingHeader = req.headers["accept-encoding"];
      const acceptEncoding = Array.isArray(acceptEncodingHeader)
        ? acceptEncodingHeader.join(",")
        : acceptEncodingHeader ?? "";
      const acceptedEncodings = new Map<string, number>();
      for (const value of acceptEncoding.split(",")) {
        const [rawEncoding, ...parameters] = value.trim().toLowerCase().split(";");
        if (!rawEncoding) continue;
        const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
        const parsedQuality = qualityParameter
          ? Number.parseFloat(qualityParameter.trim().slice(2))
          : 1;
        const quality = Number.isFinite(parsedQuality) ? Math.max(0, Math.min(1, parsedQuality)) : 0;
        acceptedEncodings.set(rawEncoding, Math.max(acceptedEncodings.get(rawEncoding) ?? 0, quality));
      }
      const acceptsEncoding = (encoding: StaticContentEncoding): boolean =>
        (acceptedEncodings.get(encoding) ?? acceptedEncodings.get("*") ?? 0) > 0;
      contentEncoding = acceptsEncoding("br")
        ? "br"
        : acceptsEncoding("gzip")
          ? "gzip"
          : undefined;

      if (contentEncoding) {
        try {
          const cacheKey = `${filePath}\0${stat.mtimeMs}\0${contentEncoding}`;
          const cachedBody = cspNonce ? undefined : compressionCache.get(cacheKey);
          if (cachedBody) {
            compressionCache.delete(cacheKey);
            compressionCache.set(cacheKey, cachedBody);
            responseBody = cachedBody;
          } else {
            responseBody = await new Promise<Buffer>((resolve, reject) => {
              const onCompressed = (error: Error | null, result: Buffer): void => {
                if (error) reject(error);
                else resolve(result);
              };
              if (contentEncoding === "br") {
                zlib.brotliCompress(body, {
                  params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 }
                }, onCompressed);
              } else {
                zlib.gzip(body, onCompressed);
              }
            });
            if (!cspNonce) {
              compressionCache.set(cacheKey, responseBody);
              pruneMapToMax(compressionCache, compressionCacheMaxEntries);
            }
          }
        } catch {
          contentEncoding = undefined;
          responseBody = body;
        }
      }
    }
    res.writeHead(200, {
      ...baseHeaders,
      "Content-Length": String(responseBody.length),
      ...(contentEncoding ? { "Content-Encoding": contentEncoding } : {})
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    res.end(responseBody);
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

async function sendStaticApp(req: IncomingMessage, res: ServerResponse, pathname: string, mountPath: "/admin" | "/dashboard", staticDir: string): Promise<boolean> {
  if (pathname !== mountPath && !pathname.startsWith(`${mountPath}/`)) return false;
  if (pathname === `${mountPath}/config.js`) {
    const body = dashboardRuntimeConfig(req);
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
  if (relative && !path.extname(relative) && !relative.startsWith("images/")) {
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

// sitemap.xml은 route 목록과 Palworld data service를 단일 원본으로 삼아 서버가 생성합니다.
// public/sitemap.xml 정적 파일을 함께 두면 두 원본이 갈라지므로 여기에 넣지 않습니다.
const PUBLIC_DASHBOARD_ASSETS = new Map([
  ["/ads.txt", "ads.txt"],
  ["/favicon.png", "favicon.png"],
  ["/favicon.svg", "favicon.svg"],
  ["/riot.txt", "riot.txt"],
  ["/robots.txt", "robots.txt"],
  ["/valorant/riot.txt", "valorant/riot.txt"]
]);

async function sendPublicDashboardAsset(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  const relativePath = PUBLIC_DASHBOARD_ASSETS.get(pathname);
  if (!relativePath) return false;
  const isRiotVerification = pathname === "/riot.txt" || pathname === "/valorant/riot.txt";
  await sendStaticFile(
    req,
    res,
    path.resolve(appConfig.paths.dashboardStatic, relativePath),
    isRiotVerification ? { "Cache-Control": "no-store" } : {},
    undefined,
    isRiotVerification ? (text) => text.trim() : undefined
  );
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
  publicLolSnapshotStore?: PublicLolSnapshotStore;
  twitchAuth: TwitchAuthService;
  streamerFollowerAuth?: StreamerFollowerAuthService;
  publicTwitchAuth?: PublicTwitchAuthService;
  eventSub?: TwitchEventSubClient;
  logger?: Pick<JsonlLogger, "error"> & Partial<Pick<JsonlLogger, "event">>;
  refreshLolProfile?: (entryId: string, streamerId?: string) => Promise<boolean>;
  /* 참여 큐(채팅 명령 !join 포함) 등록이 다시보기 후보(twitchUserId)를 바꿀 때
     공개 LoL 프로필 캐시를 무효화하기 위한 구독 대상. index.ts가 봇 모듈과
     공유하는 전역 EventBus를 그대로 넘긴다 — 별도 이벤트 버스를 새로 만들지
     않는다(실사용자 보고: 참여 신청으로 연동된 스트리머의 다시보기 버튼이
     캐시가 자연 만료될 때까지 나타나지 않던 결함, 2026-08-28). */
  events?: EventBus;
  sessions?: DashboardSessionStore;
  supportMailbox?: SupportMailboxStore;
  readiness?: ReadinessCheck;
  isShuttingDown?: () => boolean;
  connectionStatus?: () => DashboardServerStatus["connections"];
  minecraftCatalog?: MinecraftCatalogService;
  minecraftPatchNotes?: MinecraftPatchNotesService;
  palworldDataService?: PalworldDataService;
  palworldMapMarkerProvider?: PalworldMapMarkerProvider;
  palworldSpawnProvider?: PalworldSpawnProvider;
  palworldMapLocationsProvider?: PalworldMapLocationsProvider;
  palworldServerMonitor?: PalworldServerMonitor;
  palworldServerUnavailableCode?: PalworldServerAvailabilityErrorCode;
  discordOnboarding?: DiscordOnboardingService;
  discordManagement?: DiscordManagementService;
  yoroAccounts?: YoroAccountService;
  twitchExtensionSettings?: TwitchExtensionSettingsRepository;
  reactionRecords?: ReactionRecordsRepository;
  streamerBoard?: StreamerBoardRepository;
  twitchExtensionJwt?: TwitchExtensionJwtVerifier;
  discordDatabaseReady?: () => boolean;
  discordInternalAuth?: DiscordInternalAuthVerifier;
  gameServerStatusRead?: GameServerStatusReadService;
  discordBotCommandPolicy?: DiscordBotCommandPolicyService;
  patchNotes?: PatchNotesService;
  gameBoxart?: GameBoxartService;
  patchChangeSummary?: PatchChangeSummaryService;
  patchNotesSocialCard?: PatchNotesSocialCardRenderer;
  adminAuditLogs?: Pick<
    AdminAuditLogRepository,
    "list" | "beginGlobalMutation" | "completeGlobalMutation"
  >;
  valorantCatalog?: ValorantPublicCatalogService;
  valorantPublic?: ValorantPublicService;
};

const PALWORLD_SERVER_DASHBOARD_PATH = "/api/dashboard/palworld-server";
const PALWORLD_SERVER_DASHBOARD_ENDPOINTS = new Set([
  PALWORLD_SERVER_DASHBOARD_PATH,
  `${PALWORLD_SERVER_DASHBOARD_PATH}/test`,
  `${PALWORLD_SERVER_DASHBOARD_PATH}/save`,
  `${PALWORLD_SERVER_DASHBOARD_PATH}/refresh`,
  `${PALWORLD_SERVER_DASHBOARD_PATH}/remove`
]);
const PALWORLD_SERVER_OWNER_SELECTOR_HEADERS = [
  "x-broadcaster-id",
  "x-broadcaster-user-id",
  "x-streamer-id",
  "x-streamops-streamer-id",
  "x-twitch-user-id",
  "x-owner-id"
] as const;

function disabledPalworldServerDashboardResponse(
  errorCode: PalworldServerAvailabilityErrorCode = "disabled"
): PalworldServerDashboardResponse {
  return {
    enabled: false,
    pollIntervalSeconds: 5,
    registrationPolicy: { ...PALWORLD_SERVER_SAFE_REGISTRATION_POLICY },
    connection: {
      configured: false,
      passwordConfigured: false
    },
    status: {
      state: "not_configured",
      errorCode,
      consecutiveFailures: 0,
      diagnostics: PALWORLD_SERVER_DIAGNOSTIC_KEYS.map((key) => ({ key, state: "skipped" }))
    }
  };
}

function hasPalworldServerOwnerSelectorHeader(req: IncomingMessage): boolean {
  const headerNames = Object.keys(req.headers).map((header) => header.toLowerCase());
  return headerNames.some((header) => {
    if ((PALWORLD_SERVER_OWNER_SELECTOR_HEADERS as readonly string[]).includes(header)) return true;
    if (header === "x-streamops-streamer-slug" || header === "x-streamops-dashboard-key") return false;
    return /(?:^|-)(?:broadcaster|owner-id|streamer-(?:user-)?id|twitch-user-id)(?:-|$)/.test(header);
  });
}

function palworldServerInputErrorMessage(code: string): string {
  if (code === "disabled") return "Palworld 서버 상태 기능이 비활성화되어 있습니다.";
  if (code === "config_missing" || code === "config_invalid") {
    return "Palworld 서버 상태 운영 설정을 확인해야 합니다.";
  }
  if (code === "policy_missing") return "Palworld 서버 접속 허용 정책을 확인해야 합니다.";
  if (code === "key_missing"
    || code === "key_invalid"
    || code === "key_permission_denied"
    || code === "key_mismatch"
    || code === "state_damaged") {
    return "Palworld 서버 자격 증명 보호 설정을 확인해야 합니다.";
  }
  if (code === "password_required") return "Palworld 서버 관리자 비밀번호가 필요합니다.";
  if (code === "invalid_url" || code === "origin_not_allowed" || code === "address_blocked") {
    return "허용된 Palworld REST API URL을 입력해야 합니다.";
  }
  return "Palworld 서버 연결 입력이 올바르지 않습니다.";
}

function normalizePalworldServerConnectionBody(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (typeof record.adminPassword !== "string" || record.adminPassword.trim().length > 0) return value;
  const normalized = { ...record };
  delete normalized.adminPassword;
  return normalized;
}

async function readPalworldServerConnectionInput(req: IncomingMessage): Promise<PalworldServerConnectionInput> {
  const raw = normalizePalworldServerConnectionBody(await readJsonBody<unknown>(req));
  const validation = validatePalworldServerConnectionInput(raw);
  if (!validation.ok) {
    throw new HttpRequestError(400, {
      error: "Palworld 서버 연결 입력이 올바르지 않습니다.",
      code: "invalid_request"
    });
  }
  return validation.data;
}

async function requireEmptyPalworldServerBody(req: IncomingMessage): Promise<void> {
  const body = await readJsonBody<unknown>(req);
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length > 0) {
    throw new HttpRequestError(400, {
      error: "요청 body에는 필드를 포함할 수 없습니다.",
      code: "invalid_request"
    });
  }
}

function strictJsonObject(value: unknown, allowedFields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpRequestError(400, {
      error: "요청 body가 올바르지 않습니다.",
      code: "INVALID_REQUEST"
    });
  }
  const body = value as Record<string, unknown>;
  const allowed = new Set(allowedFields);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new HttpRequestError(400, {
      error: "요청 body에 지원하지 않는 필드가 있습니다.",
      code: "INVALID_REQUEST"
    });
  }
  return body;
}

function validatedPalworldServerDashboardResponse(value: unknown): PalworldServerDashboardResponse {
  const validation = validatePalworldServerDashboardResponse(value);
  if (!validation.ok) {
    throw new HttpRequestError(500, { error: "서버 내부 오류" });
  }
  return validation.data;
}

function validatedPalworldServerTestResponse(value: unknown): PalworldServerTestResponse {
  const validation = validatePalworldServerTestResponse(value);
  if (!validation.ok) {
    throw new HttpRequestError(500, { error: "서버 내부 오류" });
  }
  return validation.data;
}

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

async function participantItems(
  dataDragon: DataDragonService | undefined,
  participant: RiotMatchParticipant,
  version: string | undefined
): Promise<PublicLolMatchItem[]> {
  const items = [participant.item0, participant.item1, participant.item2, participant.item3, participant.item4, participant.item5, participant.item6]
    .map((value, slot) => ({ slot, itemId: safeMatchStat(value) }))
    .filter((item) => item.itemId > 0)
    .map((item) => ({ ...item, iconUrl: itemIconUrl(version, item.itemId) }));
  if (!dataDragon || typeof dataDragon.mapItemSummaries !== "function") return items;

  try {
    const summaries = await dataDragon.mapItemSummaries(items.map((item) => item.itemId), version);
    const summaryById = new Map(summaries.map((summary) => [summary.itemId, summary]));
    return items.map((item) => {
      const summary = summaryById.get(item.itemId);
      return {
        ...item,
        iconUrl: summary?.iconUrl ?? item.iconUrl,
        nameKo: summary?.nameKo,
        nameJa: summary?.nameJa,
        nameEn: summary?.nameEn
      };
    });
  } catch {
    // 아이템 이름 조회 실패가 전적 조회 전체를 중단시키지 않도록 기존 아이콘 정보는 유지합니다.
    return items;
  }
}

/* 실제로 고른 증강 id 만 남깁니다.
 *
 * Match-V5 는 모든 경기에 playerAugment1~6 을 담아 줍니다(4개가 아닙니다).
 * 증강이 없는 모드는 여섯 값이 전부 0 이므로 결과가 비고, 그때는 응답에서 생략합니다.
 * 실측 2026-08-09: 아레나(queue 1700) 6개 모두 0 이 아님 · 칼바람(450) 전부 0.
 */
function participantAugmentIds(participant: RiotMatchParticipant): number[] | undefined {
  const ids = [
    participant.playerAugment1,
    participant.playerAugment2,
    participant.playerAugment3,
    participant.playerAugment4,
    participant.playerAugment5,
    participant.playerAugment6
  ].filter((id): id is number => Number.isInteger(id) && (id as number) > 0);
  return ids.length > 0 ? ids : undefined;
}

function participantSummonerSpells(participant: RiotMatchParticipant): number[] {
  return [safeMatchStat(participant.summoner1Id), safeMatchStat(participant.summoner2Id)].filter((spellId) => spellId > 0);
}

const STAT_SHARD_SUMMARIES: Record<number, LolRuneSummary> = {
  5008: {
    runeId: 5008,
    nameKo: "적응형 능력치",
    nameJa: "アダプティブフォース",
    nameEn: "Adaptive Force",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAdaptiveForceIcon.png"
  },
  5005: {
    runeId: 5005,
    nameKo: "공격 속도",
    nameJa: "攻撃速度",
    nameEn: "Attack Speed",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAttackSpeedIcon.png"
  },
  5007: {
    runeId: 5007,
    nameKo: "스킬 가속",
    nameJa: "スキルヘイスト",
    nameEn: "Ability Haste",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsCDRScalingIcon.png"
  },
  5001: {
    runeId: 5001,
    nameKo: "체력 증가",
    nameJa: "体力増加",
    nameEn: "Health Scaling",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png"
  },
  5011: {
    runeId: 5011,
    nameKo: "체력",
    nameJa: "体力",
    nameEn: "Health",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png"
  },
  5002: {
    runeId: 5002,
    nameKo: "방어력",
    nameJa: "物理防御",
    nameEn: "Armor",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsArmorIcon.png"
  },
  5003: {
    runeId: 5003,
    nameKo: "마법 저항력",
    nameJa: "魔法防御",
    nameEn: "Magic Resist",
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

/* ── 아레나(CHERRY) ──────────────────────────────────────────────
 * 큐 1700/1710 은 2인 팀, 1750("아레나 3x6")은 3인×6팀입니다. 팀 구분이
 * teamId 가 아니라 playerSubteamId 이고 결과가 승/패가 아니라 1~6위 순위라,
 * 이 큐에서만 placement·subteamId·arenaTeams 를 채웁니다.
 *
 * gameMode 를 우선 보는 이유: 새 아레나 큐 id 가 추가돼도 CHERRY 로 잡힙니다
 * (반대로 큐 id 만 보면 신규 큐를 놓칩니다). 큐 id 는 gameMode 가 비어 오는
 * 응답을 위한 보조 조건입니다.
 */
const ARENA_QUEUE_IDS = new Set([1700, 1710, 1750]);

function isArenaMatch(match: RiotMatch): boolean {
  if (match.info.gameMode === "CHERRY") return true;
  const queueId = match.info.queueId;
  return typeof queueId === "number" && ARENA_QUEUE_IDS.has(queueId);
}

/** playerAugment1~6 중 0 이 아닌 값을 픽 순서대로. 증강 없는 모드에서는 빈 배열. */
function participantAugments(participant: RiotMatchParticipant): number[] {
  return [
    participant.playerAugment1,
    participant.playerAugment2,
    participant.playerAugment3,
    participant.playerAugment4,
    participant.playerAugment5,
    participant.playerAugment6
  ].filter((id): id is number => typeof id === "number" && id > 0);
}

/** 팀 순위. subteamPlacement 가 정식이고 placement 는 초기 스키마의 잔재입니다. */
function participantPlacement(participant: RiotMatchParticipant): number | undefined {
  const placement = participant.subteamPlacement ?? participant.placement;
  return typeof placement === "number" && placement > 0 ? placement : undefined;
}

/**
 * 참가자 전원을 playerSubteamId 로 묶어 순위순 팀 목록을 만듭니다.
 * 팀 내에서는 조회 대상 본인을 앞에 둡니다(프런트도 재정렬하지만, 서버가 맞춰
 * 주면 확장 순위표를 그대로 그릴 수 있습니다).
 */
async function arenaTeamsFromMatch(
  dataDragon: DataDragonService | undefined,
  match: RiotMatch,
  targetPuuid: string,
  dataDragonVersion: string | undefined
): Promise<PublicLolArenaTeam[] | undefined> {
  if (!isArenaMatch(match)) return undefined;
  const grouped = new Map<number, { placement: number; participants: RiotMatchParticipant[] }>();
  for (const participant of match.info.participants) {
    const subteamId = participant.playerSubteamId;
    const placement = participantPlacement(participant);
    /* 둘 중 하나라도 없으면 순위표를 만들 수 없습니다 — 반쪽짜리 팀을 내보내느니
       필드를 생략해 프런트가 기존 승/패 문법으로 폴백하게 둡니다(fail-soft). */
    if (typeof subteamId !== "number" || placement === undefined) return undefined;
    const bucket = grouped.get(subteamId);
    if (bucket) bucket.participants.push(participant);
    else grouped.set(subteamId, { placement, participants: [participant] });
  }
  if (grouped.size === 0) return undefined;

  const teams = await Promise.all(
    [...grouped.values()]
      .sort((a, b) => a.placement - b.placement)
      .map(async (team) => ({
        placement: team.placement,
        players: await Promise.all(
          [...team.participants]
            .sort((a, b) => Number(b.puuid === targetPuuid) - Number(a.puuid === targetPuuid))
            .map(async (participant) => {
              const augments = participantAugments(participant);
              /* 아레나에는 장신구(슬롯 6) 자체가 없으므로 participantItems 가
                 돌려주는 목록에서 자연히 빠집니다 — 별도 제거가 필요 없습니다. */
              const items = await participantItems(dataDragon, participant, dataDragonVersion);
              return {
                riotId: participantRiotId(participant),
                champion: await mapChampionSummary(dataDragon, {
                  championId: participant.championId,
                  championName: participant.championName
                }),
                kills: safeMatchStat(participant.kills),
                deaths: safeMatchStat(participant.deaths),
                assists: safeMatchStat(participant.assists),
                damageDealtToChampions: safeOptionalStat(participant.totalDamageDealtToChampions),
                goldEarned: safeOptionalStat(participant.goldEarned),
                ...(items.length > 0 ? { items } : {}),
                ...(augments.length > 0 ? { augments } : {}),
                ...(participant.puuid === targetPuuid ? { isTarget: true } : {})
              } satisfies PublicLolArenaTeamPlayer;
            })
        )
      }))
  );
  return teams;
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
  const augmentIds = participantAugmentIds(participant);
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
    items: await participantItems(dataDragon, participant, dataDragonVersion),
    summonerSpells: participantSummonerSpells(participant),
    ...(augmentIds ? { augmentIds } : {}),
    runes: await participantRunes(dataDragon, dataDragonVersion, participant),
    badges: publicLolMatchBadges(match, participant)
  };
}

/* 목록 행의 아군/상대 2열용 경량 팀 요약 — publicLolMatchTeams(상세)의 축소판.
   목록을 만들 때 매치 JSON 이 이미 손에 있어 추가 Riot 호출 없이 채웁니다.
   아이템·룬·지표·시청 스트림 매핑은 응답 크기 때문에 빼고(빈 배열), 그 값들은
   기존대로 /api/lol/match-detail 이 행 펼침 시 하이드레이션으로 내려줍니다.
   (프런트 요청 — docs/handoffs 12차 Codex 핸드오프 항목을 사용자 지시로 반영.) */
async function publicLolMatchTeamsListSummary(
  dataDragon: DataDragonService | undefined,
  match: RiotMatch,
  targetPuuid: string
): Promise<PublicLolMatchTeamDetail[]> {
  const teamIds = [...new Set(match.info.participants.map((participant) => participant.teamId).filter((teamId): teamId is number => teamId !== undefined))]
    .sort((a, b) => a - b);
  return Promise.all(teamIds.map(async (teamId): Promise<PublicLolMatchTeamDetail> => {
    const teamStats = participantTeamDetailStats(match, teamId);
    const teamInfo = match.info.teams?.find((team) => team.teamId === teamId);
    const players = (await Promise.all(match.info.participants
      .filter((participant) => participant.teamId === teamId)
      .map(async (participant): Promise<PublicLolMatchParticipant> => ({
        participantId: safeOptionalStat(participant.participantId),
        riotId: participantRiotId(participant),
        isTarget: participant.puuid === targetPuuid,
        champion: await mapChampionSummary(dataDragon, {
          championId: participant.championId,
          championName: participant.championName
        }),
        position: participant.individualPosition || participant.teamPosition,
        kills: safeMatchStat(participant.kills),
        deaths: safeMatchStat(participant.deaths),
        assists: safeMatchStat(participant.assists),
        kda: participantKda(participant),
        items: [],
        summonerSpells: [],
        runes: []
      }))))
      .sort((a, b) => publicLolRoleOrder(a.position) - publicLolRoleOrder(b.position));
    return {
      ...teamStats,
      result: teamInfo?.win === true ? "win" : teamInfo?.win === false ? "loss" : "unknown",
      players
    };
  }));
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

function publicLolSuggestionKey(gameName: string, tagLine: string, lolPlatform?: string): string {
  const identity = `${gameName.trim().normalize("NFKC").toLocaleLowerCase()}#${tagLine.trim().normalize("NFKC").toLocaleLowerCase()}`;
  return lolPlatform ? `${lolPlatform.toLocaleLowerCase("en-US")}:${identity}` : identity;
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

function publicLolProfileCacheKey(gameName: string, tagLine: string, lolPlatform: string): string {
  return `${PUBLIC_LOL_PROFILE_CACHE_KEY_VERSION}:${publicLolSuggestionKey(gameName, tagLine, lolPlatform)}`;
}

function legacyPublicLolProfileCacheKey(gameName: string, tagLine: string, lolPlatform: string): string {
  return publicLolSuggestionKey(gameName, tagLine, lolPlatform);
}

function publicLolRouting(rawPlatform: string | null | undefined, riot: RiotApiClient | undefined): LolRoutingContext {
  const requested = rawPlatform?.trim();
  if (requested) {
    const routing = lolRoutingContext(requested);
    if (!routing) {
      throw new HttpRequestError(400, {
        error: "지원하지 않는 League of Legends 서버입니다.",
        code: "LOL_PLATFORM_INVALID"
      });
    }
    return routing;
  }
  const configured = riot?.routingStatus().lolPlatform;
  return lolRoutingContext(configured) ?? lolRoutingContext("jp1")!;
}

function publicLolMatchRouting(matchId: string, requested?: LolRoutingContext): LolRoutingContext {
  if (requested) return requested;
  const platformPrefix = matchId.trim().split("_", 1)[0];
  return lolRoutingContext(platformPrefix) ?? lolRoutingContext("jp1")!;
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

function publicLolMatchQueueFilter(value: unknown): PublicLolMatchQueueFilter {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized === "all") return "all";
  if (Object.prototype.hasOwnProperty.call(PUBLIC_LOL_MATCH_QUEUE_IDS, normalized)) {
    return normalized as PublicLolMatchQueueFilter;
  }
  throw new HttpRequestError(400, {
    error: "지원하지 않는 전적 큐 필터입니다.",
    code: "LOL_MATCH_QUEUE_INVALID"
  });
}

/* 같이 플레이한 소환사 집계 — docs/mockups/lol-frequent-teammates.html §①.
   이미 받아 둔 원본 매치의 참가자(같은 경기 + 같은 팀)만 사용하므로 추가 Riot 호출이 없습니다.
   규칙: 본인·이름 없는 참가자 제외 · 함께 2게임 이상만 · 게임 수 내림차순, 동률이면 최근 순 · 상위 5명.
   puuid 는 응답에 노출하지 않습니다(기존 보안 원칙). */
function frequentTeammatesFromMatches(matches: RiotMatch[], targetPuuid: string): Array<{
  gameName: string;
  tagLine: string;
  games: number;
  wins: number;
  lastPlayedAt?: string;
}> {
  const byId = new Map<string, { gameName: string; tagLine: string; games: number; wins: number; lastPlayedAt?: string }>();
  for (const match of matches) {
    const target = match.info.participants.find((item) => item.puuid === targetPuuid);
    if (!target) continue;
    const startedAt = matchStartedAt(match);
    for (const mate of match.info.participants) {
      if (mate.puuid === targetPuuid || mate.teamId !== target.teamId) continue;
      const gameName = mate.riotIdGameName?.trim();
      const tagLine = mate.riotIdTagline?.trim();
      if (!gameName || !tagLine) continue;
      const key = `${gameName}#${tagLine}`.toLowerCase();
      const entry = byId.get(key) ?? { gameName, tagLine, games: 0, wins: 0 };
      entry.games += 1;
      if (target.win === true) entry.wins += 1;
      if (startedAt && (!entry.lastPlayedAt || startedAt > entry.lastPlayedAt)) entry.lastPlayedAt = startedAt;
      byId.set(key, entry);
    }
  }
  return [...byId.values()]
    .filter((entry) => entry.games >= 2)
    .sort((a, b) => b.games - a.games || (b.lastPlayedAt ?? "").localeCompare(a.lastPlayedAt ?? ""))
    .slice(0, 5);
}

function isPublicLolQueue(match: RiotMatch): boolean {
  /* 2026-08-16 실사례(맹금류애니비아#9314): 신규 이벤트 모드(특별 랭크·아수라장)가
     공식 queues.json 에도 없는 큐 id 로 와서, 허용 목록에 걸러진 채 조회 창(21개)만
     소모 → 최근 전적이 통째로 사라지고 옛 매치만 남았습니다. 모르는 큐를 버리는
     대신 전부 통과시킵니다 — 큐별 칩 필터는 별도 매핑이 그대로 담당합니다. */
  return true;
}

function profileRecentMatchesForCache(matches: PublicLolRecentMatch[]): LolProfileCacheEntry["recentMatches"] {
  return matches.slice(0, 10).map((match) => ({
    championId: match.champion.championId,
    championKey: match.champion.championKey,
    nameKo: match.champion.nameKo,
    nameJa: match.champion.nameJa,
    nameEn: match.champion.nameEn,
    iconUrl: match.champion.iconUrl,
    splashUrl: match.champion.splashUrl,
    loadingUrl: match.champion.loadingUrl,
    imageVersion: match.champion.imageVersion,
    imageLocale: match.champion.imageLocale,
    startedAt: match.startedAt,
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
  let aramAugmentCatalog: ReturnType<typeof loadAramAugmentCatalog> | undefined;
  try {
    aramAugmentCatalog = loadAramAugmentCatalog();
  } catch {
    input.logger?.error?.({ type: "aram.augment_catalog_unavailable", errorCode: "invalid_catalog" });
  }
  const participationRepository = storeParticipationRepository(input.store);
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
  const publicLolProfileCache = new Map<string, {
    expiresAt: number;
    staleUntil: number;
    response: PublicLolProfileResponse;
  }>();
  const publicLolProfileInFlight = new Map<string, Promise<PublicLolProfileResponse>>();
  const publicLolProfileRefreshAvailableAt = new Map<string, number>();
  const publicLolProfileCacheGeneration = new Map<string, number>();
  const publicLolProfilePuuidCache = new Map<string, string>();
  const publicLolPlatformMembershipCache = new Map<string, { expiresAt: number; verified: boolean }>();
  const publicLolPlatformMembershipInFlight = new Map<string, Promise<boolean>>();
  const publicLolSocialCardRenderer = new PublicLolSocialCardRenderer();
  /* 테스트가 원격 호출 없이 이미지 경로를 검증할 수 있도록 주입 지점을 둡니다. */
  const patchNotesSocialCardRenderer = input.patchNotesSocialCard ?? new PatchNotesSocialCardRenderer();
  const homeSocialCardRenderer = new HomeSocialCardRenderer();
  const publicLolCurrentGameCache = new Map<string, { expiresAt: number; response: PublicLolCurrentGame }>();
  const publicLolCurrentGameInFlight = new Map<string, Promise<PublicLolCurrentGame>>();
  let publicLolParticipantRankCacheInvalidatedAt = 0;
  const publicLolMatchPageCache = new Map<string, { expiresAt: number; response: PublicLolMatchPageResponse }>();
  const publicLolMatchPageInFlight = new Map<string, Promise<PublicLolMatchPageResponse>>();
  const publicLolMatchRankCache = new Map<string, { expiresAt: number; response: PublicLolMatchRankResponse }>();
  const publicLolMatchRankInFlight = new Map<string, Promise<PublicLolMatchRankResponse>>();
  const publicLolMatchBuildCache = new Map<string, { expiresAt: number; response: PublicLolMatchBuildResponse }>();
  const publicLolMatchBuildInFlight = new Map<string, Promise<PublicLolMatchBuildResponse>>();
  const publicLolMatchTeamsCache = new Map<string, { expiresAt: number; response: PublicLolMatchTeamsResponse }>();
  const publicLolMatchTeamsInFlight = new Map<string, Promise<PublicLolMatchTeamsResponse>>();
  const publicLolMatchDetailCache = new Map<string, { expiresAt: number; match: RiotMatch }>();
  const patchPlaySummaryCache = new Map<string, { expiresAt: number; summary: PatchPlaySummary }>();
  const patchPlaySummaryInFlight = new Map<string, Promise<PatchPlaySummary>>();
  /* 큰 교배 sitemap은 data revision별·shard별로 한 번만 직렬화합니다. */
  const publicSitemapCache = new Map<string, string>();
  const publicLolMatchDetailInFlight = new Map<string, Promise<RiotMatch | null>>();
  const publicTwitchFollowedCache = new Map<string, {
    expiresAt: number;
    response: PublicTwitchFollowedLolResponse;
  }>();
  const publicTwitchFollowedInFlight = new Map<string, Promise<PublicTwitchFollowedLolResponse>>();

  async function verifyPublicLolPlatformMembership(
    puuid: string,
    routing: LolRoutingContext,
  ): Promise<boolean> {
    if (!input.riot || typeof input.riot.getSummonerByPuuid !== "function") return true;
    const key = `${routing.lolPlatform}:${puuid}`;
    const cached = publicLolPlatformMembershipCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.verified;
    if (cached) publicLolPlatformMembershipCache.delete(key);
    const running = publicLolPlatformMembershipInFlight.get(key);
    if (running) return running;
    const request = input.riot.getSummonerByPuuid(puuid, routing)
      .then((summoner) => {
        const verified = Boolean(summoner?.puuid || summoner?.id);
        publicLolPlatformMembershipCache.set(key, {
          verified,
          expiresAt: Date.now() + (verified
            ? PUBLIC_LOL_PLATFORM_MEMBERSHIP_CACHE_TTL_MS
            : PUBLIC_LOL_PLATFORM_MEMBERSHIP_MISS_TTL_MS),
        });
        pruneMapToMax(publicLolPlatformMembershipCache, PUBLIC_LOL_PROFILE_CACHE_MAX * 2);
        return verified;
      })
      .finally(() => {
        publicLolPlatformMembershipInFlight.delete(key);
      });
    publicLolPlatformMembershipInFlight.set(key, request);
    return request;
  }

  async function requirePublicLolPlatformMembership(
    puuid: string,
    routing: LolRoutingContext,
  ): Promise<void> {
    let verified: boolean;
    try {
      verified = await verifyPublicLolPlatformMembership(puuid, routing);
    } catch (error) {
      throw new HttpRequestError(502, {
        error: publicLolErrorMessage(error),
        code: "LOL_PLATFORM_LOOKUP_FAILED",
      });
    }
    if (!verified) {
      throw new HttpRequestError(404, {
        error: "선택한 서버에서 해당 소환사를 찾을 수 없습니다.",
        code: "LOL_PROFILE_NOT_ON_PLATFORM",
      });
    }
  }

  async function resolveCachedPublicLolSocialProfile(
    route: PublicLolProfileRoute,
  ): Promise<PublicLolSocialProfile | undefined> {
    const withRegisteredStreamerImage = (profile: PublicLolSocialProfile): PublicLolSocialProfile => {
      const riotIdKey = normalizeRiotIdKey(profile.gameName, profile.tagLine);
      const matchingStreamers = listApprovedStreamerRiotIds()
        .filter((request) => request.normalizedRiotId === riotIdKey && request.twitchProfileImageUrl)
        .filter((request, index, requests) => requests.findIndex((candidate) => candidate.twitchUserId === request.twitchUserId) === index);
      return matchingStreamers.length === 1 && matchingStreamers[0]?.twitchProfileImageUrl
        ? { ...profile, streamerProfileImageUrl: matchingStreamers[0].twitchProfileImageUrl }
        : profile;
    };
    const key = publicLolProfileCacheKey(route.gameName, route.tagLine, route.lolPlatform);
    const memoryEntry = publicLolProfileCache.get(key);
    if (
      memoryEntry
      && memoryEntry.staleUntil > Date.now()
      && isPublicLolProfileSnapshot(memoryEntry.response)
      && memoryEntry.response.lolPlatform === route.lolPlatform
    ) return withRegisteredStreamerImage(memoryEntry.response);

    if (input.publicLolSnapshotStore) {
      const snapshotKeys = route.lolPlatform === "jp1"
        ? [
            key,
            legacyPublicLolProfileCacheKey(route.gameName, route.tagLine, route.lolPlatform),
            publicLolSuggestionKey(route.gameName, route.tagLine),
          ]
        : [key];
      for (const snapshotKey of snapshotKeys) {
        const snapshot = await input.publicLolSnapshotStore.load(snapshotKey).catch((error) => {
          input.logger?.error({
            type: "public_lol.social_snapshot_load_failed",
            riotIdKey: snapshotKey,
            error: toSafeErrorMessage(error),
          });
          return undefined;
        });
        if (
          snapshot
          && isPublicLolProfileSnapshot(snapshot.payload)
          && snapshot.payload.fetchedAt === snapshot.fetchedAt
          && snapshot.payload.lolPlatform === route.lolPlatform
          && Date.now() - Date.parse(snapshot.fetchedAt) < PUBLIC_LOL_PROFILE_STALE_TTL_MS
          && Date.now() - Date.parse(snapshot.fetchedAt) >= -5 * 60_000
        ) {
          return withRegisteredStreamerImage(snapshot.payload);
        }
      }
    }

    const repositoryProfile = route.lolPlatform === "jp1"
      ? input.profileRepository?.getByRiotId(route.gameName, route.tagLine)
      : undefined;
    if (!repositoryProfile || repositoryProfile.status !== "ready") return undefined;
    const recentMatches = repositoryProfile.recentMatches ?? [];
    const recentWins = recentMatches.filter((match) => match.won).length;
    return withRegisteredStreamerImage({
      riotId: formatRiotId(repositoryProfile.riotGameName, repositoryProfile.riotTagLine),
      gameName: repositoryProfile.riotGameName,
      tagLine: repositoryProfile.riotTagLine,
      lolPlatform: route.lolPlatform,
      rankedStats: repositoryProfile.rankedStats,
      summary: {
        recentGames: recentMatches.length,
        recentWins,
        recentWinRate: recentMatches.length > 0 ? Math.round((recentWins / recentMatches.length) * 100) : undefined,
        averageKda: repositoryProfile.performanceStats?.kda,
      },
      recentMatches: recentMatches.map((match) => ({ result: match.won ? "win" : "loss" })),
      fetchedAt: repositoryProfile.analyzedAt ?? repositoryProfile.rankedStats?.fetchedAt ?? new Date(0).toISOString(),
    });
  }

  /**
   * 색인되면 안 되는 공개 경로에 실제 404를 돌려줍니다.
   * SPA shell을 200으로 주면 Google이 soft 404로 분류하고 같은 패턴 URL 전체의
   * 크롤 신뢰도가 떨어집니다.
   */
  function sendPublicNotFound(req: IncomingMessage, res: ServerResponse, pathname: string): void {
    const locale = publicUrlLocaleFromPathname(pathname) ?? "ko";
    const message = locale === "ja"
      ? "お探しのページは存在しません。"
      : "요청한 페이지를 찾을 수 없습니다.";
    res.writeHead(404, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      ...securityHeadersForRequest(req)
    });
    res.end(req.method === "HEAD" ? undefined : JSON.stringify({ error: message, code: "NOT_FOUND" }));
  }

  /**
   * 공개 라우트 화이트리스트 밖의 GET/HEAD 요청에 SPA 404 화면을 제공합니다.
   * index.html의 nonce 기반 CSP는 유지하되 실제 HTTP status는 404로 고정합니다.
   */
  async function sendPublicNotFoundPage(
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string,
  ): Promise<void> {
    const filePath = path.resolve(appConfig.paths.dashboardStatic, "index.html");
    try {
      const locale = publicUrlLocaleFromPathname(pathname) ?? "ko";
      const title = locale === "ja"
        ? "ページが見つかりません | YORO.gg"
        : locale === "en"
          ? "Page not found | YORO.gg"
          : "페이지를 찾을 수 없습니다 | YORO.gg";
      const description = locale === "ja"
        ? "URLが正しくないか、ページが移動した可能性があります。"
        : locale === "en"
          ? "The URL may be incorrect, or the page may have moved."
          : "잘못된 URL이거나 페이지가 이동되었을 수 있습니다.";
      const cspNonce = crypto.randomBytes(18).toString("base64url");
      const html = (await fs.readFile(filePath, "utf8"))
        .replace(/<html\s+lang="[^"]*"/u, `<html lang="${locale}"`)
        .replace(/<title>[^<]*<\/title>/u, `<title>${title}</title>`)
        .replace(
          /(<meta\s+name="description"\s+content=")[^"]*("\s*\/?>)/u,
          `$1${description}$2`,
        )
        .replaceAll(/<meta\s+name="robots"[^>]*>/giu, "")
        .replace(/<\/head>/iu, '<meta name="robots" content="noindex, nofollow" /></head>')
        .replaceAll(DASHBOARD_CSP_NONCE_PLACEHOLDER, cspNonce);
      res.writeHead(404, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        ...staticSecurityHeaders(req, filePath, "/dashboard", cspNonce),
        "X-Robots-Tag": "noindex, nofollow",
      });
      res.end(req.method === "HEAD" ? undefined : html);
    } catch {
      sendJson(req, res, 404, { error: "not found" }, {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      });
    }
  }

  /** 일시적인 교배 데이터 장애에는 빈 shell 대신 기존 교배 fallback을 담은 503을 냅니다. */
  async function sendPalworldBreedingUnavailablePage(
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string
  ): Promise<void> {
    const filePath = path.resolve(appConfig.paths.dashboardStatic, "index.html");
    const locale = publicUrlLocaleFromPathname(pathname) ?? "ko";
    try {
      const metadata = {
        ...publicSeoMetadataForPath(`/${locale}/palworld/breeding`),
        robotsNoindex: true
      };
      const cspNonce = crypto.randomBytes(18).toString("base64url");
      const html = applyPublicSeoMetadata(await fs.readFile(filePath, "utf8"), metadata)
        .replaceAll(DASHBOARD_CSP_NONCE_PLACEHOLDER, cspNonce);
      res.writeHead(503, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "600",
        "X-Robots-Tag": "noindex, nofollow",
        ...staticSecurityHeaders(req, filePath, "/dashboard", cspNonce)
      });
      res.end(req.method === "HEAD" ? undefined : html);
    } catch {
      sendJson(req, res, 503, PALWORLD_DATA_UNAVAILABLE_RESPONSE, {
        "Cache-Control": "no-store",
        "Retry-After": "600",
        "X-Robots-Tag": "noindex, nofollow"
      });
    }
  }

  /** 패치 피드가 일시적으로 없을 때 허브 fallback을 담은 재시도 가능한 503을 냅니다. */
  async function sendPatchNotesUnavailablePage(
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string
  ): Promise<void> {
    const filePath = path.resolve(appConfig.paths.dashboardStatic, "index.html");
    const locale = publicUrlLocaleFromPathname(pathname) === "ja" ? "ja" : "ko";
    try {
      const metadata = {
        ...publicSeoMetadataForPath(`/${locale}/patch-notes`),
        robotsNoindex: true
      };
      const cspNonce = crypto.randomBytes(18).toString("base64url");
      const html = applyPublicSeoMetadata(await fs.readFile(filePath, "utf8"), metadata)
        .replaceAll(DASHBOARD_CSP_NONCE_PLACEHOLDER, cspNonce);
      res.writeHead(503, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "600",
        "X-Robots-Tag": "noindex, nofollow",
        ...staticSecurityHeaders(req, filePath, "/dashboard", cspNonce)
      });
      res.end(req.method === "HEAD" ? undefined : html);
    } catch {
      sendJson(req, res, 503, {
        error: "PATCH_NOTES_UNAVAILABLE",
        message: "패치 노트를 사용할 수 없습니다."
      }, {
        "Cache-Control": "no-store",
        "Retry-After": "600",
        "X-Robots-Tag": "noindex, nofollow"
      });
    }
  }

  /**
   * sitemap index와 하위 sitemap을 응답합니다.
   * Palworld 하위 sitemap은 data service가 준비된 경우에만 index에 넣어
   * 크롤러가 빈 sitemap을 반복해서 받지 않게 합니다.
   */
  async function sendPublicSitemap(
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string
  ): Promise<boolean> {
    const palworldData = input.palworldDataService;
    const palworldMeta = (() => {
      if (!palworldData) return undefined;
      try {
        return palworldData.meta();
      } catch {
        return undefined;
      }
    })();
    const generatedAt = (palworldMeta?.metadata as { generatedAt?: unknown } | undefined)?.generatedAt;
    const dataVersion = typeof generatedAt === "string" ? generatedAt : undefined;
    const breedingPairCount = palworldMeta?.counts.breedingPairs ?? 0;
    const respond = (body: string): boolean => {
      res.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        ...securityHeadersForRequest(req)
      });
      res.end(req.method === "HEAD" ? undefined : body);
      return true;
    };

    if (pathname === PUBLIC_SITEMAP_PATHS.index) {
      const children = [
        { path: PUBLIC_SITEMAP_PATHS.static },
        ...(input.patchNotes ? [{ path: PUBLIC_SITEMAP_PATHS.patchNotesDetail }] : []),
        ...(palworldData
          ? [
              { path: PUBLIC_SITEMAP_PATHS.pals, lastmod: dataVersion },
              { path: PUBLIC_SITEMAP_PATHS.items, lastmod: dataVersion },
              { path: PUBLIC_SITEMAP_PATHS.skills, lastmod: dataVersion },
              ...palworldBreedingSitemapPaths(breedingPairCount)
                .map((path) => ({ path, lastmod: dataVersion }))
            ]
          : [])
      ];
      return respond(buildSitemapIndex(children));
    }
    if (pathname === PUBLIC_SITEMAP_PATHS.static) {
      return respond(buildStaticSitemap(undefined, {
        minecraftPatchNotesReady: input.minecraftPatchNotes?.hasReadyData() === true
      }));
    }
    if (pathname === PUBLIC_SITEMAP_PATHS.patchNotesDetail) {
      if (!input.patchNotes) {
        res.writeHead(404, {
          "Content-Type": "application/json; charset=utf-8",
          ...securityHeadersForRequest(req)
        });
        res.end(req.method === "HEAD" ? undefined : JSON.stringify({ error: "not found" }));
        return true;
      }
      try {
        const feed = await input.patchNotes.getFeed("ko");
        if (!feed) throw new TypeError("패치 노트 피드를 사용할 수 없습니다.");
        return respond(buildPatchNotesSitemap(feed.notes));
      } catch (error) {
        input.logger?.error({
          type: "public_seo.sitemap_failed",
          errorCode: "patch_notes_sitemap_unavailable",
          error: toSafeErrorMessage(error)
        });
        res.writeHead(503, {
          "Content-Type": "application/json; charset=utf-8",
          "Retry-After": "600",
          ...securityHeadersForRequest(req)
        });
        res.end(req.method === "HEAD" ? undefined : JSON.stringify({ error: "sitemap unavailable" }));
        return true;
      }
    }
    const breedingShard = palworldBreedingSitemapShard(pathname);
    if (breedingShard !== undefined) {
      const breedingPaths = palworldBreedingSitemapPaths(breedingPairCount);
      if (!palworldData || breedingShard >= breedingPaths.length) {
        res.writeHead(404, {
          "Content-Type": "application/json; charset=utf-8",
          ...securityHeadersForRequest(req)
        });
        res.end(req.method === "HEAD" ? undefined : JSON.stringify({ error: "not found" }));
        return true;
      }
      try {
        const cacheKey = `${dataVersion ?? "unknown"}\0${pathname}\0${breedingPairCount}`;
        const cached = publicSitemapCache.get(cacheKey);
        if (cached !== undefined) return respond(cached);
        const offset = breedingShard * PALWORLD_BREEDING_PAIRS_PER_SITEMAP;
        const page = palworldData.listBreedingPairs({
          offset,
          limit: PALWORLD_BREEDING_PAIRS_PER_SITEMAP
        });
        const expectedCount = Math.min(
          PALWORLD_BREEDING_PAIRS_PER_SITEMAP,
          breedingPairCount - offset
        );
        if (page.total !== breedingPairCount || page.items.length !== expectedCount) {
          throw new TypeError("Palworld 교배 sitemap 범위와 runtime metadata가 일치하지 않습니다.");
        }
        const body = buildPalworldBreedingSitemap(page.items, dataVersion);
        publicSitemapCache.set(cacheKey, body);
        /* shard 하나가 최대 약 28MB라 최근 1개만 process memory에 두고,
           반복 요청 캐시는 기존 1시간 HTTP/CDN 정책에 맡깁니다. */
        pruneMapToMax(publicSitemapCache, 1);
        return respond(body);
      } catch (error) {
        input.logger?.error({
          type: "public_seo.sitemap_failed",
          errorCode: "breeding_sitemap_unavailable",
          error: toSafeErrorMessage(error)
        });
        res.writeHead(503, {
          "Content-Type": "application/json; charset=utf-8",
          "Retry-After": "600",
          ...securityHeadersForRequest(req)
        });
        res.end(req.method === "HEAD" ? undefined : JSON.stringify({ error: "sitemap unavailable" }));
        return true;
      }
    }
    const kind = PALWORLD_SITEMAP_KINDS[pathname];
    if (!kind) return false;
    if (!palworldData) {
      res.writeHead(404, {
        "Content-Type": "application/json; charset=utf-8",
        ...securityHeadersForRequest(req)
      });
      res.end(req.method === "HEAD" ? undefined : JSON.stringify({ error: "not found" }));
      return true;
    }
    try {
      const ids = palworldEntityIdsForSitemap(palworldData, kind);
      return respond(buildPalworldEntitySitemap(kind, ids, dataVersion));
    } catch (error) {
      input.logger?.error({
        type: "public_seo.sitemap_failed",
        errorCode: "sitemap_unavailable",
        error: toSafeErrorMessage(error)
      });
      res.writeHead(503, {
        "Content-Type": "application/json; charset=utf-8",
        "Retry-After": "600",
        ...securityHeadersForRequest(req)
      });
      res.end(req.method === "HEAD" ? undefined : JSON.stringify({ error: "sitemap unavailable" }));
      return true;
    }
  }

  /**
   * Palworld 엔티티 상세 URL의 데이터를 읽습니다.
   * 데이터가 없으면 undefined를 돌려 호출자가 soft 404 대신 실제 404를 내도록 합니다.
   */
  /* 본문에 실을 교배 조합 상한. 조회는 이만큼만 가져오고, 전체 개수는 pagination
     의 total 로 실값을 적습니다(HTML 크기 상한 유지). */
  const PALWORLD_SEO_COMBO_LIMIT = 12;
  /* 교배 페이지 본문에 실을 팰 링크 수. public-seo 의 상한과 같은 값입니다. */
  const PALWORLD_SEO_BREEDING_LINKS = 60;
  /* Palworld 목록 허브 fallback에 실을 대표 항목 수. public-seo 상한과 같습니다. */
  const PALWORLD_SEO_HUB_ITEMS = 30;

  function resolvePalworldBreedingSeoPair(pathname: string): {
    dataUnavailable: boolean;
    isBreedingRoute: boolean;
    pair?: PalworldSeoBreedingPair;
  } {
    const route = palworldBreedingRouteForPath(pathname);
    if (!route) return { dataUnavailable: false, isBreedingRoute: false };
    const palworldData = input.palworldDataService;
    if (!palworldData) return { dataUnavailable: true, isBreedingRoute: true };
    try {
      const response = palworldData.breeding({
        parentA: route.parentAId,
        parentB: route.parentBId,
        ...(route.parentAGender === undefined ? {} : { parentAGender: route.parentAGender }),
        ...(route.parentBGender === undefined ? {} : { parentBGender: route.parentBGender })
      });
      if (response.state === "data_unavailable") {
        return { dataUnavailable: true, isBreedingRoute: true };
      }
      if (response.state !== "resolved" || !response.result) {
        return { dataUnavailable: false, isBreedingRoute: true };
      }
      if (response.result.child.id !== route.childId) {
        return { dataUnavailable: false, isBreedingRoute: true };
      }
      return {
        dataUnavailable: false,
        isBreedingRoute: true,
        pair: response.result
      };
    } catch (error) {
      if (error instanceof PalworldRecordNotFoundError) {
        return { dataUnavailable: false, isBreedingRoute: true };
      }
      input.logger?.error({
        type: "public_seo.breeding_detail_failed",
        errorCode: "breeding_detail_unavailable",
        error: toSafeErrorMessage(error)
      });
      return { dataUnavailable: true, isBreedingRoute: true };
    }
  }

  function resolvePalworldSeoEntity(pathname: string): {
    entity?: PalworldSeoEntity;
    isEntityRoute: boolean;
  } {
    const route = palworldEntityRouteForPath(pathname);
    if (!route) return { isEntityRoute: false };
    const palworldData = input.palworldDataService;
    if (!palworldData) return { isEntityRoute: true };
    try {
      /* 로케일별 표시명. 없으면 영문으로 떨어지고, 그것도 없으면 빈 문자열이라
         호출부에서 걸러집니다. en 은 영문 이름을 우선하고 없으면 한국어로 갑니다. */
      const nameOf = (
        reference: { nameKo?: string | null; nameJa?: string | null; nameEn?: string | null } | undefined
      ): string => (route.locale === "ja"
        ? reference?.nameJa
        : route.locale === "en"
          ? reference?.nameEn
          : reference?.nameKo) || reference?.nameEn || reference?.nameKo || "";

      if (route.kind === "item") {
        const item = palworldData.getItem(route.id);
        const dropPals = (item.dropPals ?? [])
          .map((pal) => ({ id: pal.id, name: nameOf(pal) }))
          .filter((pal) => pal.id && pal.name);
        const entity: PalworldSeoEntity = {
          ...(item as unknown as PalworldSeoEntity),
          ...(typeof item.sellPrice === "number" ? { sellPrice: item.sellPrice } : {}),
          ...(typeof item.weight === "number" ? { weight: item.weight } : {}),
          ...(typeof item.maxStack === "number" ? { maxStack: item.maxStack } : {}),
          ...(typeof item.technologyLevel === "number" ? { technologyLevel: item.technologyLevel } : {}),
          craftingMaterials: (item.craftingMaterials ?? [])
            .map((material) => ({ name: nameOf(material.item), count: material.quantity }))
            .filter((material) => material.name.length > 0),
          craftingFacilities: (item.craftingFacilities ?? [])
            .map((facility) => nameOf(facility))
            .filter((name) => name.length > 0),
          acquisitionLabels: (item.acquisitionMethods ?? [])
            .map((method) => (route.locale === "ja"
              ? method.labelJa
              : route.locale === "en"
                ? method.labelEn
                : method.labelKo) || method.labelEn || method.labelKo || "")
            .filter((label) => label.length > 0),
          ...(dropPals.length > 0 ? { dropPals, dropPalsTotal: dropPals.length } : {})
        };
        return { entity, isEntityRoute: true };
      }

      if (route.kind === "skill") {
        const skill = palworldData.getSkill(route.id);
        const relatedPals = (skill.relatedPals ?? [])
          .map((related) => ({ id: related.pal?.id ?? "", name: nameOf(related.pal) }))
          .filter((pal) => pal.id && pal.name);
        const entity: PalworldSeoEntity = {
          ...(skill as unknown as PalworldSeoEntity),
          skillType: skill.type,
          ...(skill.element ? { element: skill.element } : {}),
          ...(typeof skill.power === "number" ? { power: skill.power } : {}),
          ...(typeof skill.passiveTier === "number" ? { passiveTier: skill.passiveTier } : {}),
          ...(relatedPals.length > 0
            ? { relatedPals, relatedPalsTotal: skill.relatedPalCount ?? relatedPals.length }
            : {})
        };
        return { entity, isEntityRoute: true };
      }
      const pal = palworldData.getPal(route.id);
      /* 본문(fallback)에 실데이터를 싣기 위한 보강 — 능력치·작업 적성·드랍은
         상세 응답에 이미 있고, 교배 조합만 별도 조회입니다. 조회가 실패해도
         본문은 나머지로 성립하므로 각각 독립적으로 감쌉니다(빈 페이지 금지). */
      let breedingParents: Array<{ a: string; b: string }> | undefined;
      let breedingParentsTotal: number | undefined;
      let breedingChildren: Array<{ partner: string; child: string }> | undefined;
      let breedingChildrenTotal: number | undefined;
      try {
        const parents = palworldData.breedingParents({ child: pal.id, limit: PALWORLD_SEO_COMBO_LIMIT, page: 1 });
        if (parents.state === "resolved") {
          breedingParents = parents.items
            .map((pair) => ({ a: nameOf(pair.parentA), b: nameOf(pair.parentB) }))
            .filter((pair) => pair.a && pair.b);
          breedingParentsTotal = parents.pagination?.total;
        }
      } catch {
        /* 교배 스냅샷이 없는 배포에서는 이 섹션만 빠집니다. */
      }
      try {
        const partners = palworldData.breedingPartners({ parent: pal.id, limit: PALWORLD_SEO_COMBO_LIMIT, page: 1 });
        if (partners.state === "resolved") {
          breedingChildren = partners.items
            .map((pair) => ({
              partner: nameOf(pair.parentA?.id === pal.id ? pair.parentB : pair.parentA),
              child: nameOf(pair.child)
            }))
            .filter((pair) => pair.partner && pair.child);
          breedingChildrenTotal = partners.pagination?.total;
        }
      } catch {
        /* 위와 같음 */
      }
      const entity: PalworldSeoEntity = {
        ...(pal as unknown as PalworldSeoEntity),
        stats: pal.stats as unknown as Record<string, number | undefined>,
        workSuitabilities: pal.workSuitabilities,
        drops: pal.drops,
        partnerSkillName: nameOf(pal.partnerSkill as unknown as { nameKo?: string; nameJa?: string; nameEn?: string }) || undefined,
        nocturnal: pal.nocturnal,
        ...(breedingParents?.length ? { breedingParents } : {}),
        ...(breedingParentsTotal === undefined ? {} : { breedingParentsTotal }),
        ...(breedingChildren?.length ? { breedingChildren } : {}),
        ...(breedingChildrenTotal === undefined ? {} : { breedingChildrenTotal })
      };
      return { entity, isEntityRoute: true };
    } catch {
      // 존재하지 않는 id는 정상적인 404입니다. 진단 로그를 남길 사유가 아닙니다.
      return { isEntityRoute: true };
    }
  }

  async function resolvePublicSeoMetadata(pathname: string): Promise<PublicSeoMetadata> {
    const fallback = publicSeoMetadataForPath(pathname, {
      minecraftPatchNotesReady: input.minecraftPatchNotes?.hasReadyData() === true
    });
    /* 패치 노트 공유 카드 — SNS 크롤러는 JS 를 실행하지 않으므로 서버가
       최신 패치 번호·요약·카드 이미지를 메타에 넣어야만 미리보기가 살아납니다.
       카드 URL 에 패치 버전이 들어가 새 패치마다 SNS 캐시를 자연 우회합니다.
       근거: docs/mockups/patch-share-card.html §03 */
    const patchNotesLocale = patchNoteLocaleFrom(publicUrlLocaleFromPathname(pathname) ?? "ko") ?? "ko";
    if (stripPublicUrlLocalePrefix(pathname).replace(/\/$/u, "") === "/patch-notes" && input.patchNotes) {
      try {
        const feed = await input.patchNotes.getFeed(patchNotesLocale);
        const latest = latestPatchNoteWithVersion(feed);
        if (latest?.patchVersion) {
          const titles: Readonly<Record<PatchNoteLocale, string>> = {
            ko: `LoL 패치 ${latest.patchVersion} | YORO.gg`,
            ja: `LoL パッチ ${latest.patchVersion} | YORO.gg`,
            en: `LoL Patch ${latest.patchVersion} | YORO.gg`,
          };
          const imageAlts: Readonly<Record<PatchNoteLocale, string>> = {
            ko: `LoL 패치 ${latest.patchVersion} 미리보기`,
            ja: `LoL パッチ ${latest.patchVersion} プレビュー`,
            en: `LoL Patch ${latest.patchVersion} preview`,
          };
          return {
            ...fallback,
            title: titles[patchNotesLocale],
            description: latest.summary ?? fallback.description,
            imageUrl: new URL(
              `/social/patch-notes/${patchNotesLocale}/${latest.patchVersion}.png`,
              "https://yoro.gg",
            ).href,
            imageAlt: imageAlts[patchNotesLocale],
          };
        }
      } catch {
        /* 피드가 없으면 기존 고정 문구로 동작합니다 — 공유가 깨질 이유는 아닙니다. */
      }
    }
    /* 반응속도 공유 링크 — 기록이 찍힌 미리보기는 서버만 만들 수 있습니다.
       삭제됐거나 없는 id 는 일반 /games/reaction 메타로 떨어뜨리고 noindex 합니다:
       공유 id 는 임의로 만들 수 있는 URL 공간이라 색인 후보가 되면 soft 404 가
       쌓입니다(소환사 프로필과 같은 판단). */
    const reactionShare = reactionShareRouteForPath(pathname);
    if (reactionShare) {
      const shared = await reactionSharedRecord(reactionShare.shareId).catch(() => undefined);
      const averageMs = typeof shared?.averageMs === "number" ? shared.averageMs : undefined;
      if (averageMs === undefined) {
        return {
          ...publicSeoMetadataForPath(`/${reactionShare.locale}/games/reaction`),
          canonicalUrl: localizedPublicSeoUrl(`/games/reaction/r/${reactionShare.shareId}`, reactionShare.locale),
          robotsNoindex: true
        };
      }
      const tier = reactionTierForAverage(averageMs);
      return reactionShareSeoMetadata(reactionShare, {
        averageMs,
        tierKey: tier.key,
        tierEmoji: tier.emoji,
        tierLabel: reactionShare.locale === "ja" ? tier.labelJa : tier.labelKo,
        ...(typeof shared?.displayName === "string" ? { displayName: shared.displayName } : {}),
        ...(typeof shared?.percentile === "number" ? { percentile: shared.percentile } : {})
      });
    }
    const breedingRoute = palworldBreedingRouteForPath(pathname);
    if (breedingRoute) {
      const resolved = resolvePalworldBreedingSeoPair(pathname);
      if (resolved.pair) return palworldBreedingSeoMetadata(breedingRoute, resolved.pair);
    }
    /* 교배 페이지 본문 — 팰 상세로 이어지는 내부 링크가 크롤 경로가 됩니다.
       데이터가 없으면 기존 요약 문구 그대로입니다(빈 페이지 금지). */
    if (
      stripPublicUrlLocalePrefix(pathname).replace(/\/$/u, "") === "/palworld/breeding"
      && fallback.fallback
      && input.palworldDataService
    ) {
      const locale = publicUrlLocaleFromPathname(pathname) ?? "ko";
      try {
        /* 도감 번호 순 — 화면 기본 정렬과 같아야 본문과 목록이 어긋나지 않습니다. */
        const list = input.palworldDataService.listPals({
          sort: "number",
          order: "asc",
          page: 1,
          limit: PALWORLD_SEO_BREEDING_LINKS
        });
        const pals = list.items
          .map((pal) => ({
            id: pal.id,
            name: (locale === "ja" ? pal.nameJa : pal.nameKo) || pal.nameEn || pal.id
          }))
          .filter((pal) => pal.name.length > 0);
        return {
          ...fallback,
          fallback: palworldBreedingFallback(
            fallback.fallback,
            locale,
            pals,
            list.pagination?.total ?? pals.length
          )
        };
      } catch {
        /* 스냅샷이 없으면 요약만 남깁니다. */
      }
    }
    /* Palworld 목록 허브 본문 — 화면과 같은 정렬의 첫 항목과 실제 전체 개수를
       사용합니다. 각 도메인 스냅샷이 없으면 기존 요약으로 안전하게 돌아갑니다. */
    const normalizedPalworldHubPath = stripPublicUrlLocalePrefix(pathname).replace(/\/$/u, "");
    const palworldHubLocale = publicUrlLocaleFromPathname(pathname) ?? "ko";
    const palworldHubName = (
      reference: { nameKo?: string | null; nameJa?: string | null; nameEn?: string | null }
    ): string => (palworldHubLocale === "ja"
      ? reference.nameJa
      : palworldHubLocale === "en"
        ? reference.nameEn
        : reference.nameKo) || reference.nameEn || reference.nameKo || "";
    if (normalizedPalworldHubPath === "/palworld/pals" && fallback.fallback && input.palworldDataService) {
      try {
        const list = input.palworldDataService.listPals({
          locale: palworldHubLocale,
          sort: "number",
          order: "asc",
          page: 1,
          limit: PALWORLD_SEO_HUB_ITEMS
        });
        const pals = list.items
          .map((pal) => ({ id: pal.id, name: palworldHubName(pal) }))
          .filter((pal) => pal.name.length > 0);
        return {
          ...fallback,
          fallback: palworldPalsFallback(
            fallback.fallback,
            palworldHubLocale,
            pals,
            list.pagination?.total ?? pals.length
          )
        };
      } catch {
        /* 팰 스냅샷이 없으면 기존 요약만 남깁니다. */
      }
    }
    if (normalizedPalworldHubPath === "/palworld/items" && fallback.fallback && input.palworldDataService) {
      try {
        const list = input.palworldDataService.listItems({
          locale: palworldHubLocale,
          sort: "name",
          order: "asc",
          page: 1,
          limit: PALWORLD_SEO_HUB_ITEMS
        });
        const items = list.items
          .map((item) => ({ id: item.id, name: palworldHubName(item) }))
          .filter((item) => item.name.length > 0);
        return {
          ...fallback,
          fallback: palworldItemsFallback(
            fallback.fallback,
            palworldHubLocale,
            items,
            list.pagination?.total ?? items.length
          )
        };
      } catch {
        /* 아이템 스냅샷이 없으면 기존 요약만 남깁니다. */
      }
    }
    if (normalizedPalworldHubPath === "/palworld/skills" && fallback.fallback && input.palworldDataService) {
      try {
        const list = input.palworldDataService.listSkills({
          locale: palworldHubLocale,
          sort: "name",
          order: "asc",
          page: 1,
          limit: PALWORLD_SEO_HUB_ITEMS
        });
        const skills = list.items
          .map((skill) => ({ id: skill.id, name: palworldHubName(skill) }))
          .filter((skill) => skill.name.length > 0);
        return {
          ...fallback,
          fallback: palworldSkillsFallback(
            fallback.fallback,
            palworldHubLocale,
            skills,
            list.pagination?.total ?? skills.length
          )
        };
      } catch {
        /* 스킬 스냅샷이 없으면 기존 요약만 남깁니다. */
      }
    }
    if (normalizedPalworldHubPath === "/palworld/technology" && fallback.fallback && input.palworldDataService) {
      try {
        const list = input.palworldDataService.listTechnologyUnlocks({
          locale: palworldHubLocale,
          order: "asc",
          page: 1,
          limit: PALWORLD_SEO_HUB_ITEMS
        });
        const unlocks = list.items
          .map((unlock) => ({
            name: palworldHubName(unlock.kind === "item" ? unlock.item : unlock),
            technologyLevel: unlock.technologyLevel
          }))
          .filter((unlock) => unlock.name.length > 0);
        return {
          ...fallback,
          fallback: palworldTechnologyFallback(
            fallback.fallback,
            palworldHubLocale,
            unlocks,
            list.pagination?.total ?? unlocks.length
          )
        };
      } catch {
        /* 기술 데이터가 없으면 기존 요약만 남깁니다. */
      }
    }
    const palworldRoute = palworldEntityRouteForPath(pathname);
    if (palworldRoute) {
      const { entity } = resolvePalworldSeoEntity(pathname);
      return entity ? palworldEntitySeoMetadata(palworldRoute, entity) : fallback;
    }
    const route = publicLolProfileRouteForPath(pathname);
    if (!route) return fallback;
    try {
      const profile = await resolveCachedPublicLolSocialProfile(route);
      /* 조회된 적 없는 소환사 URL은 200으로 동작은 유지하되 noindex 합니다 —
         임의 문자열로 무한히 만들 수 있는 URL 공간이 전부 색인 후보가 되면
         Search Console에 soft 404·"크롤링됨-색인 생성 안 됨"이 쌓입니다.
         실제로 조회되어 캐시에 남은 프로필만 색인을 허용합니다. */
      if (!profile) {
        /* 첫 SSR 요청은 기존처럼 즉시 noindex fallback을 반환하되, 형식이 검증된
           Riot ID만 기존 프로필 빌드 경로로 비동기 예열합니다. 이 빌드는
           publicLolProfileInFlight dedup과 RiotApiClient의 전역 limiter를 그대로
           통과하며, 실패는 다음 응답에 영향을 주지 않도록 여기서 삼킵니다. */
        const parsed = parseRiotIdDetailed(`${route.gameName}#${route.tagLine}`);
        if (parsed.ok) {
          const routing = publicLolRouting(route.lolPlatform, input.riot);
          const key = publicLolProfileCacheKey(parsed.gameName, parsed.tagLine, routing.lolPlatform);
          void startPublicLolProfileBuild(
            key,
            `${parsed.gameName}#${parsed.tagLine}`,
            routing,
          ).catch((error) => {
            input.logger?.error({
              type: "public_lol.social_metadata_background_build_failed",
              riotIdKey: key,
              error: toSafeErrorMessage(error),
            });
          });
        }
        return { ...fallback, robotsNoindex: true };
      }
      const summary = buildPublicLolSocialSummary(profile, route.locale);
      const safeProfileSlug = encodeURIComponent(`${route.gameName}-${route.tagLine}`);
      const ja = route.locale === "ja";
      const facts: PublicSeoFact[] = [
        { label: ja ? "ランク" : "랭크", value: summary.rankLabel },
        ...(summary.recentRecordLabel
          ? [{ label: ja ? "最近の戦績" : "최근 전적", value: summary.recentRecordLabel }]
          : []),
        ...(summary.winRateLabel ? [{ label: ja ? "勝率" : "승률", value: summary.winRateLabel }] : []),
        ...(summary.kdaLabel ? [{ label: "KDA", value: summary.kdaLabel }] : []),
        { label: ja ? "サーバー" : "서버", value: route.platformSlug.toUpperCase() },
      ];
      return withLolProfileSeo(fallback, {
        canonicalPath: `/lol/summoners/${route.platformSlug}/${route.profileSlug}`,
        description: summary.description,
        facts,
        frequentTeammates: profile.frequentTeammates?.map(({ gameName, tagLine }) => ({ gameName, tagLine })),
        heading: summary.riotId,
        imageAlt: summary.imageAlt,
        imageUrl: new URL(
          `/social/lol/${route.locale}/${route.lolPlatform}/${safeProfileSlug}/${summary.revision}.png`,
          "https://yoro.gg",
        ).href,
        title: summary.title,
      });
    } catch (error) {
      input.logger?.error({
        type: "public_lol.social_metadata_failed",
        errorCode: "metadata_unavailable",
        error: toSafeErrorMessage(error),
      });
      /* 일시 오류로 프로필을 못 읽었을 때 generic 페이지가 색인되면 낮은 품질
         스냅샷이 남습니다 — 오류 응답도 색인 대상에서 제외합니다. */
      return { ...fallback, robotsNoindex: true };
    }
  }

  /* /social/patch-notes/<locale>/<version>.png — 버전이 URL 에 들어가므로
     응답은 immutable 캐시가 안전하고, 새 패치는 새 URL 이 됩니다. */
  async function sendPatchNotesSocialImage(
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string,
  ): Promise<boolean> {
    const match = /^\/social\/patch-notes\/(ko|ja|en)\/(\d{1,2}\.\d{1,2})\.png$/u.exec(pathname);
    if (!match?.[1] || !match[2]) return false;
    const locale = match[1] as PatchNoteLocale;
    const version = match[2];
    const sendFallback = async () => {
      await sendStaticFile(
        req,
        res,
        path.resolve(appConfig.paths.dashboardStatic, "images", "yorogg-og.png"),
        { "Cache-Control": "no-store" },
      );
    };
    try {
      const feed = input.patchNotes ? await input.patchNotes.getFeed(locale) : undefined;
      const note = feed?.notes.find((candidate) => candidate.patchVersion === version);
      const model = note ? patchNotesCardModel(note) : undefined;
      if (!model) {
        /* 피드에 없는 버전은 기본 OG 이미지로 — 공유 카드가 깨진 이미지로 남지 않게. */
        await sendFallback();
        return true;
      }
      const body = await patchNotesSocialCardRenderer.render(model, locale);
      const etag = `"patch-social-${locale}-${version}"`;
      const headers = {
        "Content-Type": "image/png",
        "Content-Length": String(body.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": etag,
        ...securityHeadersForRequest(req),
      };
      if (req.headers["if-none-match"]?.split(",").map((value) => value.trim()).includes(etag)) {
        res.writeHead(304, headers);
        res.end();
        return true;
      }
      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? undefined : body);
      return true;
    } catch (error) {
      input.logger?.error({
        type: "patch_notes.social_image_failed",
        errorCode: "render_failed",
        error: toSafeErrorMessage(error),
      });
      await sendFallback();
      return true;
    }
  }

  /* /social/home/<locale>.png — yoro.gg 를 그냥 공유했을 때(홈 og:image) 나오는
     대표 이미지. 이전에는 정적 PNG 1장을 ko/ja/en 전부가 공유해 다국어가 전혀
     반영되지 않았습니다(실측 확인) — 로케일별 실텍스트를 굽는 동적 이미지로 전환. */
  async function sendHomeSocialImage(
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string,
  ): Promise<boolean> {
    const match = /^\/social\/home\/(ko|ja|en)\.png$/u.exec(pathname);
    if (!match?.[1]) return false;
    const locale = match[1] as PublicUrlLocale;
    try {
      const body = await homeSocialCardRenderer.render(locale);
      const etag = `"home-social-${locale}"`;
      const headers = {
        "Content-Type": "image/png",
        "Content-Length": String(body.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": etag,
        ...securityHeadersForRequest(req),
      };
      if (req.headers["if-none-match"]?.split(",").map((value) => value.trim()).includes(etag)) {
        res.writeHead(304, headers);
        res.end();
        return true;
      }
      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? undefined : body);
      return true;
    } catch (error) {
      input.logger?.error({
        type: "home.social_image_failed",
        errorCode: "render_failed",
        error: toSafeErrorMessage(error),
      });
      await sendStaticFile(
        req,
        res,
        path.resolve(appConfig.paths.dashboardStatic, "images", "yorogg-og.png"),
        { "Cache-Control": "no-store" },
      );
      return true;
    }
  }

  async function sendPublicLolSocialImage(
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string,
  ): Promise<boolean> {
    const route = publicLolSocialImageRouteForPath(pathname);
    if (!route) return false;
    const sendFallback = async () => {
      await sendStaticFile(
        req,
        res,
        path.resolve(appConfig.paths.dashboardStatic, "images", "yorogg-og.png"),
        { "Cache-Control": "no-store" },
      );
    };
    const sendProfileSourceImage = async (profile: PublicLolSocialProfile): Promise<boolean> => {
      const sourceImage = await publicLolSocialCardRenderer.sourceImage(profile).catch(() => undefined);
      if (!sourceImage) return false;
      const etag = `"lol-social-source-${route.revision}"`;
      const headers = {
        "Content-Type": "image/png",
        "Content-Length": String(sourceImage.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": etag,
        ...securityHeadersForRequest(req),
      };
      if (req.headers["if-none-match"]?.split(",").map((value) => value.trim()).includes(etag)) {
        res.writeHead(304, headers);
        res.end();
        return true;
      }
      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? undefined : sourceImage);
      return true;
    };
    let profile: PublicLolSocialProfile | undefined;
    try {
      profile = await resolveCachedPublicLolSocialProfile(route);
      if (!profile) {
        await sendFallback();
        return true;
      }
      const expected = buildPublicLolSocialSummary(profile, route.locale);
      if (expected.revision !== route.revision) {
        if (await sendProfileSourceImage(profile)) return true;
        await sendFallback();
        return true;
      }
      const rendered = await publicLolSocialCardRenderer.render(profile, route.locale);
      const etag = `"lol-social-${rendered.summary.revision}"`;
      const headers = {
        "Content-Type": "image/png",
        "Content-Length": String(rendered.body.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": etag,
        ...securityHeadersForRequest(req),
      };
      if (req.headers["if-none-match"]?.split(",").map((value) => value.trim()).includes(etag)) {
        res.writeHead(304, headers);
        res.end();
        return true;
      }
      res.writeHead(200, headers);
      res.end(req.method === "HEAD" ? undefined : rendered.body);
      return true;
    } catch (error) {
      input.logger?.error({
        type: "public_lol.social_image_failed",
        errorCode: "render_failed",
        error: toSafeErrorMessage(error),
      });
      if (profile && await sendProfileSourceImage(profile)) return true;
      await sendFallback();
      return true;
    }
  }

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
    const key = publicLolSuggestionKey(profile.gameName, profile.tagLine, profile.lolPlatform);
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

  async function profileCacheEntryToSuggestion(profile: LolProfileCacheEntry, routing: LolRoutingContext): Promise<PublicLolSuggestion> {
    const platformMatches = normalizeLolPlatformId(profile.lolPlatform) === routing.lolPlatform;
    return {
      riotId: `${profile.riotGameName}#${profile.riotTagLine}`,
      gameName: profile.riotGameName,
      tagLine: profile.riotTagLine,
      source: "recent",
      profileIconUrl: await profileIconUrl(input.dataDragon, platformMatches ? profile.rankedStats?.profileIconId : undefined),
      summonerLevel: platformMatches ? profile.rankedStats?.summonerLevel : undefined,
      lolPlatform: routing.lolPlatform,
      rankedStats: platformMatches && profile.rankedStats ? { ...profile.rankedStats } : undefined,
      lastSeenAt: profile.analyzedAt ?? new Date(0).toISOString()
    };
  }

  function rememberPublicLolProfile(profile: PublicLolProfileResponse, accountPuuid: string): void {
    rememberPublicLolSuggestion(profile);
    const snapshotKey = publicLolProfileCacheKey(profile.gameName, profile.tagLine, profile.lolPlatform);
    if (input.publicLolSnapshotStore) {
      void input.publicLolSnapshotStore.save({
        key: snapshotKey,
        puuid: accountPuuid,
        fetchedAt: profile.fetchedAt,
        payload: profile
      }).catch((error) => {
        input.logger?.error({
          type: "public_lol.snapshot_save_failed",
          riotIdKey: snapshotKey,
          error: toSafeErrorMessage(error)
        });
      });
    }
    const repository = input.profileRepository;
    if (!repository) return;
    const existing = repository.getByPuuid(accountPuuid) ?? repository.getByRiotId(profile.gameName, profile.tagLine);
    repository.save({
      riotPuuid: accountPuuid,
      riotGameName: profile.gameName,
      riotTagLine: profile.tagLine,
      riotIdKey: normalizeRiotIdKey(profile.gameName, profile.tagLine),
      lolPlatform: profile.lolPlatform,
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

  /* 경기 → 다시보기 점프. 정상적인 빈 목록과 일시 실패의 캐시 수명을 분리합니다. */
  const twitchVodIndex = new TwitchVodIndex({
    videosFor: async (twitchUserId) => {
      const twitchUserKey = twitchUserLogKey(twitchUserId);
      let result;
      try {
        result = await input.twitch!.getArchiveVideosByUserId(twitchUserId);
      } catch {
        const reason: TwitchArchiveVideosFailureReason = "network_error";
        input.logger?.event?.({
          type: "twitch.archive_videos_request",
          twitchUserKey,
          state: "failed",
          reason
        });
        return { state: "failed" as const, reason };
      }
      if (result.state === "failed") {
        input.logger?.event?.({
          type: "twitch.archive_videos_request",
          twitchUserKey,
          state: "failed",
          reason: result.reason,
          ...(result.status === undefined ? {} : { status: result.status })
        });
        return { state: "failed" as const, reason: result.reason };
      }
      const vods = parseTwitchVods(result.payload);
      input.logger?.event?.({
        type: "twitch.archive_videos_request",
        twitchUserKey,
        state: "ready",
        reason: "http_200",
        status: result.status,
        archiveCount: result.count,
        usableVodCount: vods.length
      });
      return { state: "ready" as const, vods };
    },
    onLoad: ({ twitchUserId, state, vodCount, cacheTtlMs, reason }) => {
      input.logger?.event?.({
        type: "twitch.vod_index_loaded",
        twitchUserKey: twitchUserLogKey(twitchUserId),
        state,
        vodCount,
        cacheTtlMs,
        ...(reason === undefined ? {} : { reason })
      });
    }
  });

  /**
   * 경기 목록에 다시보기 지점을 붙입니다.
   *
   * 스트리머로 연동되지 않은 프로필은 그냥 원본을 돌려줍니다 — 대부분의 프로필이
   * 여기에 해당하므로 Twitch 를 부르지도 않습니다.
   */
  async function withPublicLolReplays(
    matches: PublicLolRecentMatch[],
    gameName: string,
    tagLine: string
  ): Promise<PublicLolRecentMatch[]> {
    if (matches.length === 0 || !input.twitch) return matches;
    const stream = await buildPublicLolTwitchStream(gameName, tagLine).catch(() => undefined);
    if (!stream?.twitchUserId) return matches;
    let replays: (MatchReplay | undefined)[];
    try {
      replays = await twitchVodIndex.replaysFor(
        stream.twitchUserId,
        matches.map((match) => match.startedAt)
      );
    } catch {
      input.logger?.event?.({
        type: "public_lol.replays_failed",
        twitchUserKey: twitchUserLogKey(stream.twitchUserId),
        reason: "index_error"
      });
      replays = matches.map(() => undefined);
    }
    input.logger?.event?.({
      type: "public_lol.replays_matched",
      twitchUserKey: twitchUserLogKey(stream.twitchUserId),
      matchedCount: replays.filter((replay) => replay !== undefined).length,
      totalMatches: matches.length
    });
    return matches.map((match, index) => {
      const replay = replays[index];
      return replay ? { ...match, replay } : match;
    });
  }

  /**
   * 디스크 스냅샷의 전적은 그대로 재사용하되 다시보기만 현재 등록 상태로 갱신합니다.
   *
   * 스트리머 승인 전 저장된 스냅샷에는 replay 가 없습니다. 승인 처리로 메모리 캐시를
   * 비운 뒤 그 스냅샷을 그대로 복원하면 프로필을 새로 만들 때의 Twitch 결합 단계를
   * 건너뛰므로, 승인된 스트리머인데도 다시보기 버튼이 계속 보이지 않게 됩니다.
   * 반대로 등록이 해제된 뒤에는 예전 replay 를 남기지 않도록 먼저 제거하고 다시 계산합니다.
   */
  async function withFreshPublicLolSnapshotReplays(
    response: PublicLolProfileResponse
  ): Promise<PublicLolProfileResponse> {
    if (!input.twitch || response.recentMatches.length === 0) return response;
    const matchesWithoutReplays = response.recentMatches.map((match) => (
      match.replay ? { ...match, replay: undefined } : match
    ));
    const recentMatches = await withPublicLolReplays(
      matchesWithoutReplays,
      response.gameName,
      response.tagLine
    );
    return { ...response, recentMatches };
  }

  async function buildPublicLolTwitchStream(gameName: string, tagLine: string): Promise<PublicLolTwitchStream | undefined> {
    const riotIdKey = normalizeRiotIdKey(gameName, tagLine);
    const candidates = new Map<string, PublicLolTwitchCandidate>();
    /* getActiveParticipationQueue — 취소/스킵된(cancelled/skipped) 엔트리는
       다시보기 후보에서 제외한다. getParticipationQueue(전체)를 쓰면 참여를
       취소한 뒤에도 그 twitchUserId가 계속 candidate로 남아 다시보기가
       사라지지 않는 반대 방향 결함이 생긴다(2026-08-29 개선 방안 점검). */
    const participationQueue = typeof input.store.getActiveParticipationQueue === "function"
      ? input.store.getActiveParticipationQueue()
      : typeof input.store.getParticipationQueue === "function" ? input.store.getParticipationQueue() : [];

    for (const entry of participationQueue) {
      if (!entry.riotGameName || !entry.riotTagLine) continue;
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

  function cachedRankedStatsForRiotId(
    gameName: string,
    tagLine: string,
    options: { allowStale?: boolean } = {}
  ): LolRankedStats | undefined {
    const profile = input.profileRepository?.getByRiotId(gameName, tagLine);
    const profileUpdatedAt = Date.parse(profile?.analyzedAt ?? "");
    if (profile?.rankedStats && (options.allowStale || (
      Number.isFinite(profileUpdatedAt)
      && profileUpdatedAt > publicLolParticipantRankCacheInvalidatedAt
      && Date.now() - profileUpdatedAt <= PUBLIC_LOL_PARTICIPANT_RANK_CACHE_TTL_MS
    ))) {
      return { ...profile.rankedStats };
    }
    const suggestion = publicLolSuggestionCache.get(publicLolSuggestionKey(gameName, tagLine));
    const suggestionUpdatedAt = Date.parse(suggestion?.lastSeenAt ?? "");
    return suggestion?.rankedStats && (options.allowStale || (
      Number.isFinite(suggestionUpdatedAt)
      && suggestionUpdatedAt > publicLolParticipantRankCacheInvalidatedAt
      && Date.now() - suggestionUpdatedAt <= PUBLIC_LOL_PARTICIPANT_RANK_CACHE_TTL_MS
    ))
      ? { ...suggestion.rankedStats }
      : undefined;
  }

  function listApprovedStreamerRiotIds(): StreamerRiotIdRequest[] {
    const storeWithRegistry = input.store as Store & { listApprovedStreamerRiotIds?: () => StreamerRiotIdRequest[] };
    return typeof storeWithRegistry.listApprovedStreamerRiotIds === "function"
      ? storeWithRegistry.listApprovedStreamerRiotIds()
      : [];
  }

  function isSubStreamerRiotAccount(request: Pick<StreamerRiotIdRequest, "accountRole">): boolean {
    return request.accountRole === "sub";
  }

  /* "스트리머 1명 = 계정 1개"를 전제하는 소비자용 대표(main) 계정 목록.
     전체 approved 목록(listApprovedStreamerRiotIds)은 Riot ID → 스트리머 매칭처럼
     계정 단위 소비자만 사용해야 합니다 — Map(twitchUserId, ...)으로 접으면
     서브 계정이 대표를 덮어씁니다. */
  function listApprovedMainStreamerRiotIds(): StreamerRiotIdRequest[] {
    return listApprovedStreamerRiotIds().filter((request) => !isSubStreamerRiotAccount(request));
  }

  function approvedStreamerRiotIdForTwitchUser(twitchUserId: string | undefined): StreamerRiotIdRequest | undefined {
    if (!twitchUserId) return undefined;
    /* 스트리머 자격은 승인된 "대표" row에만 걸립니다. 서브 row로 fallback하면
       관리자가 대표를 거절(자격 회수)해도 승인된 서브가 남아 있는 동안
       /api/account/streamer/* 권한이 계속 살아 있게 됩니다 —
       approvedStreamerIdentityForOwner(대표 전용)와도 판정이 어긋납니다. */
    return listApprovedStreamerRiotIds().find((request) =>
      request.twitchUserId === twitchUserId && !isSubStreamerRiotAccount(request)
    );
  }

  function streamerDashboardEnabled(request: StreamerRiotIdRequest | undefined): request is StreamerRiotIdRequest {
    return Boolean(request && request.status === "approved" && request.dashboardEnabled === true);
  }

  function dashboardEnabledStreamerRiotIdForTwitchUser(twitchUserId: string | undefined): StreamerRiotIdRequest | undefined {
    const request = approvedStreamerRiotIdForTwitchUser(twitchUserId);
    return streamerDashboardEnabled(request) ? request : undefined;
  }

  /* 대시보드 "내 Riot ID" 계정 목록 응답. 대표 row와 서브 row만 싣습니다 —
     본계정 재신청 flow가 남긴 pending·rejected non-sub row는 이 목록의 대상이
     아니라 /api/account/streamer 승인 상태 화면의 몫입니다. */
  function streamerRiotAccountsResponse(twitchUserId: string): {
    accounts: Array<{
      id: string;
      riotGameName: string;
      riotTagLine: string;
      riotId: string;
      status: StreamerRiotIdRequest["status"];
      isMain: boolean;
      requestedAt: string;
      updatedAt: string;
      reviewedAt?: string;
      note?: string;
    }>;
    limit: { sub: number };
  } {
    const rows = listStreamerRiotIdRequests()
      .filter((request) => request.twitchUserId === twitchUserId)
      .filter((request) => isSubStreamerRiotAccount(request)
        || (request.status === "approved" && !isSubStreamerRiotAccount(request)));
    const rank = (request: StreamerRiotIdRequest): number => {
      if (request.status === "approved" && !isSubStreamerRiotAccount(request)) return 0;
      if (request.status === "approved") return 1;
      if (request.status === "pending") return 2;
      return 3;
    };
    rows.sort((a, b) => rank(a) - rank(b) || Date.parse(a.requestedAt) - Date.parse(b.requestedAt));
    return {
      accounts: rows.map((request) => ({
        id: request.id,
        riotGameName: request.riotGameName,
        riotTagLine: request.riotTagLine,
        riotId: formatRiotId(request.riotGameName, request.riotTagLine),
        status: request.status,
        isMain: request.status === "approved" && !isSubStreamerRiotAccount(request),
        requestedAt: request.requestedAt,
        updatedAt: request.updatedAt,
        ...(request.reviewedAt ? { reviewedAt: request.reviewedAt } : {}),
        ...(request.note ? { note: request.note } : {})
      })),
      limit: { sub: STREAMER_SUB_RIOT_ACCOUNT_LIMIT }
    };
  }

  function currentStreamerRiotIdRequestForTwitchUser(twitchUserId: string | undefined): StreamerRiotIdRequest | undefined {
    if (!twitchUserId) return undefined;
    const requests = listStreamerRiotIdRequests().filter((request) => request.twitchUserId === twitchUserId);
    /* 서브 계정 row는 스트리머의 "현재 등록 상태"가 아닙니다 — 승인 대기 중인
       서브 때문에 대시보드가 본계정 재신청 대기로 보이면 안 됩니다. */
    const mains = requests.filter((request) => !isSubStreamerRiotAccount(request));
    return mains.find((request) => request.status === "approved")
      ?? mains.find((request) => request.status === "pending")
      ?? mains[0]
      ?? requests[0];
  }

  function publicStreamerDashboardInfo(request: StreamerRiotIdRequest): {
    twitchUserId: string;
    twitchLogin: string;
    twitchDisplayName: string;
    twitchProfileImageUrl?: string;
    riotGameName: string;
    riotTagLine: string;
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

  type GlobalAdminAuditHandle = Readonly<{
    mutationId: string;
    action: GlobalAdminAuditAction;
  }>;

  function globalAdminAuditActor(principal: AuthPrincipal): {
    actorMethod: "session";
    actorSessionId: string;
  } | {
    actorMethod: "token";
  } {
    if (
      principal.type !== "DASHBOARD_ADMIN"
      || principal.role !== "admin"
    ) {
      throw new HttpRequestError(403, {
        error: "관리자 권한이 필요합니다.",
        code: "FORBIDDEN"
      });
    }
    if (principal.method === "session") {
      if (!principal.sessionId) {
        throw new HttpRequestError(503, {
          error: "관리자 감사 로그를 사용할 수 없습니다.",
          code: "AUDIT_LOGS_UNAVAILABLE"
        });
      }
      return {
        actorMethod: "session",
        actorSessionId: `dashboard-session:${principal.sessionId}`
      };
    }
    /* bearer token 원문이나 그 hash는 actor identity로 저장하지 않습니다.
       token 인증은 현재 사람 단위 identity가 없으므로 비밀이 아닌 방식 표지만 기록합니다. */
    return { actorMethod: "token" };
  }

  async function beginGlobalAdminAudit(
    principal: AuthPrincipal,
    action: GlobalAdminAuditAction,
    targetIdentifier: string,
    metadata: Record<string, string | boolean>
  ): Promise<GlobalAdminAuditHandle | undefined> {
    if (!input.adminAuditLogs) {
      /* DB를 의도적으로 끈 local/legacy 환경의 기존 승인 흐름만 보존합니다.
         production 또는 DB 활성 환경에서는 감사 기록 없이 mutation하지 않습니다. */
      if (!appConfig.database.enabled && appConfig.nodeEnv !== "production") return undefined;
      throw new HttpRequestError(503, {
        error: "관리자 감사 로그를 사용할 수 없습니다.",
        code: "AUDIT_LOGS_UNAVAILABLE"
      });
    }
    if (input.discordDatabaseReady?.() === false) {
      throw new HttpRequestError(503, {
        error: "관리자 감사 로그를 사용할 수 없습니다.",
        code: "AUDIT_LOGS_UNAVAILABLE"
      });
    }
    try {
      const actor = globalAdminAuditActor(principal);
      const mutation = await input.adminAuditLogs.beginGlobalMutation({
        ...actor,
        action,
        targetIdentifier,
        metadata
      });
      return { mutationId: mutation.mutationId, action };
    } catch (error) {
      if (error instanceof HttpRequestError) throw error;
      input.logger?.error?.({
        type: "admin.audit_logs.begin_failed",
        action,
        errorCode: error instanceof SafeDatabaseError ? error.code : "AUDIT_LOGS_UNAVAILABLE"
      });
      throw new HttpRequestError(503, {
        error: "관리자 감사 로그를 사용할 수 없습니다.",
        code: "AUDIT_LOGS_UNAVAILABLE"
      });
    }
  }

  async function completeGlobalAdminAudit(
    handle: GlobalAdminAuditHandle | undefined,
    outcome: "succeeded" | "failed"
  ): Promise<void> {
    if (!handle || !input.adminAuditLogs) return;
    try {
      await input.adminAuditLogs.completeGlobalMutation({
        mutationId: handle.mutationId,
        outcome
      });
    } catch (error) {
      /* started row는 이미 영속됐으므로 원본 mutation을 재시도하게 만들지 않습니다.
         finalize 실패는 별도 안전 로그로 남겨 운영자가 미완료 row를 조사하게 합니다. */
      input.logger?.error?.({
        type: "admin.audit_logs.finalize_failed",
        action: handle.action,
        outcome,
        errorCode: error instanceof SafeDatabaseError ? error.code : "AUDIT_LOGS_UNAVAILABLE"
      });
    }
  }

  type StreamerRiotIdRequestListQuery = {
    parameterized: boolean;
    status?: StreamerRiotIdRequest["status"];
    query: string;
    cursor?: string;
    limit: number;
  };

  function streamerRiotIdRequestListQuery(url: URL): StreamerRiotIdRequestListQuery {
    const allowedKeys = new Set(["status", "q", "cursor", "limit"]);
    const providedKeys = [...url.searchParams.keys()];
    for (const key of providedKeys) {
      if (!allowedKeys.has(key) || url.searchParams.getAll(key).length !== 1) {
        throw new HttpRequestError(400, {
          error: "지원하지 않거나 중복된 조회 조건입니다.",
          code: "INVALID_QUERY_PARAMETER"
        });
      }
    }
    const parameterized = providedKeys.length > 0;
    const rawStatus = url.searchParams.get("status")?.trim().toLocaleLowerCase("en-US");
    if (rawStatus && rawStatus !== "all" && !["pending", "approved", "rejected"].includes(rawStatus)) {
      throw new HttpRequestError(400, {
        error: "status는 pending, approved, rejected 또는 all이어야 합니다.",
        code: "INVALID_STATUS"
      });
    }

    const rawQuery = url.searchParams.get("q") ?? "";
    if (
      rawQuery.length > STREAMER_RIOT_ID_REQUEST_QUERY_MAX_LENGTH
      || /[\u0000-\u001f\u007f]/u.test(rawQuery)
    ) {
      throw new HttpRequestError(400, {
        error: `q는 ${STREAMER_RIOT_ID_REQUEST_QUERY_MAX_LENGTH}자 이하여야 합니다.`,
        code: "INVALID_QUERY"
      });
    }
    const query = normalizeSuggestionText(rawQuery);

    const rawCursor = url.searchParams.get("cursor");
    if (
      rawCursor !== null
      && (
        !rawCursor
        || rawCursor !== rawCursor.trim()
        || rawCursor.length > STREAMER_RIOT_ID_REQUEST_CURSOR_MAX_LENGTH
        || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(rawCursor)
      )
    ) {
      throw new HttpRequestError(400, { error: "cursor가 올바르지 않습니다.", code: "INVALID_CURSOR" });
    }

    const rawLimit = url.searchParams.get("limit");
    let limit = STREAMER_RIOT_ID_REQUEST_DEFAULT_PAGE_SIZE;
    if (rawLimit !== null) {
      if (!/^[1-9][0-9]*$/u.test(rawLimit)) {
        throw new HttpRequestError(400, { error: "limit은 1 이상의 정수여야 합니다.", code: "INVALID_LIMIT" });
      }
      const requestedLimit = Number(rawLimit);
      if (!Number.isSafeInteger(requestedLimit)) {
        throw new HttpRequestError(400, { error: "limit이 올바르지 않습니다.", code: "INVALID_LIMIT" });
      }
      limit = Math.min(requestedLimit, STREAMER_RIOT_ID_REQUEST_MAX_PAGE_SIZE);
    }

    return {
      parameterized,
      ...(rawStatus && rawStatus !== "all" ? { status: rawStatus as StreamerRiotIdRequest["status"] } : {}),
      query,
      ...(rawCursor ? { cursor: rawCursor } : {}),
      limit
    };
  }

  type StreamerRiotIdRequestCursorPayload = {
    version: 1;
    filter: string;
    updatedAt: string;
    id: string;
  };

  function streamerRiotIdRequestFilterFingerprint(query: StreamerRiotIdRequestListQuery): string {
    return crypto.createHash("sha256")
      .update(`${query.status ?? "all"}\u0000${query.query}`, "utf8")
      .digest("base64url");
  }

  function streamerRiotIdRequestCursorSecret(): Buffer {
    const secret = appConfig.security.dashboardAuthToken || STREAMER_RIOT_ID_REQUEST_CURSOR_FALLBACK_SECRET;
    return crypto.createHash("sha256")
      .update("streamer-riot-id-request-cursor\u0000", "utf8")
      .update(secret)
      .digest();
  }

  function streamerRiotIdRequestCursorError(): never {
    throw new HttpRequestError(400, { error: "cursor가 현재 조회 조건에 맞지 않습니다.", code: "INVALID_CURSOR" });
  }

  function encodeStreamerRiotIdRequestCursor(
    request: StreamerRiotIdRequest,
    query: StreamerRiotIdRequestListQuery
  ): string {
    const payload: StreamerRiotIdRequestCursorPayload = {
      version: 1,
      filter: streamerRiotIdRequestFilterFingerprint(query),
      updatedAt: request.updatedAt,
      id: request.id
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = crypto.createHmac("sha256", streamerRiotIdRequestCursorSecret())
      .update(encoded, "ascii")
      .digest("base64url");
    return `${encoded}.${signature}`;
  }

  function decodeStreamerRiotIdRequestCursor(
    cursor: string,
    query: StreamerRiotIdRequestListQuery
  ): StreamerRiotIdRequestCursorPayload {
    const [encoded, signature] = cursor.split(".");
    if (!encoded || !signature) return streamerRiotIdRequestCursorError();
    const expectedSignature = crypto.createHmac("sha256", streamerRiotIdRequestCursorSecret())
      .update(encoded, "ascii")
      .digest();
    const actualSignature = Buffer.from(signature, "base64url");
    if (
      actualSignature.length !== expectedSignature.length
      || actualSignature.toString("base64url") !== signature
      || !crypto.timingSafeEqual(actualSignature, expectedSignature)
    ) return streamerRiotIdRequestCursorError();

    let parsed: unknown;
    try {
      const decoded = Buffer.from(encoded, "base64url");
      if (decoded.toString("base64url") !== encoded) return streamerRiotIdRequestCursorError();
      parsed = JSON.parse(decoded.toString("utf8"));
    } catch {
      return streamerRiotIdRequestCursorError();
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return streamerRiotIdRequestCursorError();
    const payload = parsed as Partial<StreamerRiotIdRequestCursorPayload>;
    if (
      payload.version !== 1
      || payload.filter !== streamerRiotIdRequestFilterFingerprint(query)
      || typeof payload.updatedAt !== "string"
      || payload.updatedAt.length > 64
      || !Number.isFinite(Date.parse(payload.updatedAt))
      || typeof payload.id !== "string"
      || !payload.id
      || payload.id.length > 128
      || /[\u0000-\u001f\u007f]/u.test(payload.id)
    ) return streamerRiotIdRequestCursorError();
    return payload as StreamerRiotIdRequestCursorPayload;
  }

  function streamerRiotIdVerificationCacheState(
    value: string | undefined,
    ttlMs: number,
    now: number
  ): "fresh" | "stale" | undefined {
    const observedAt = Date.parse(value ?? "");
    if (!Number.isFinite(observedAt) || observedAt - now > STREAMER_RIOT_ID_VERIFICATION_FUTURE_SKEW_MS) {
      return undefined;
    }
    return now - observedAt <= ttlMs ? "fresh" : "stale";
  }

  function latestIsoTimestamp(values: Iterable<string | undefined>, now = Date.now()): string | undefined {
    let latest: { value: string; timestamp: number } | undefined;
    for (const value of values) {
      if (!value) continue;
      const timestamp = Date.parse(value);
      if (!Number.isFinite(timestamp) || timestamp - now > STREAMER_RIOT_ID_VERIFICATION_FUTURE_SKEW_MS) continue;
      if (!latest || timestamp > latest.timestamp) latest = { value, timestamp };
    }
    return latest?.value;
  }

  function streamerDisplayNameComparisonKey(value: string): string {
    return value.trim().normalize("NFKC").replace(/\s+/gu, "").toLowerCase();
  }

  function streamerRiotIdVerificationSummary(
    request: StreamerRiotIdRequest
  ): StreamerRiotIdVerificationSummary {
    const now = Date.now();
    const riotIdKey = request.normalizedRiotId
      || normalizeRiotIdKey(request.riotGameName, request.riotTagLine);
    const expectedLolPlatform = normalizeLolPlatformId(appConfig.riot.lolPlatform) ?? "jp1";
    let repositoryProfile: LolProfileCacheEntry | undefined;
    try {
      repositoryProfile = input.profileRepository?.getByRiotId(request.riotGameName, request.riotTagLine);
    } catch {
      // 관리자 목록은 cache 조회 장애로 중단하지 않습니다. Riot API fallback도 하지 않습니다.
    }
    const repositoryPlatformMatches = repositoryProfile?.lolPlatform === expectedLolPlatform;

    const memoryProfiles = [...publicLolProfileCache.values()]
      .filter(({ response }) =>
        normalizeRiotIdKey(response.gameName, response.tagLine) === riotIdKey
        && normalizeLolPlatformId(response.lolPlatform) === expectedLolPlatform
      );
    const matchPages = [...publicLolMatchPageCache.values()]
      .filter(({ response }) =>
        normalizeRiotIdKey(response.gameName, response.tagLine) === riotIdKey
        && normalizeLolPlatformId(response.lolPlatform) === expectedLolPlatform
      );
    const suggestions = [...publicLolSuggestionCache.values()]
      .filter((suggestion) =>
        normalizeRiotIdKey(suggestion.gameName, suggestion.tagLine) === riotIdKey
        && normalizeLolPlatformId(suggestion.lolPlatform) === expectedLolPlatform
      );

    const repositoryObservedAt = repositoryProfile?.analyzedAt ?? repositoryProfile?.rankedStats?.fetchedAt;
    const repositoryState = streamerRiotIdVerificationCacheState(
      repositoryObservedAt,
      PUBLIC_LOL_PROFILE_STALE_TTL_MS,
      now
    );
    const freshMemoryProfiles = memoryProfiles.filter(({ staleUntil, response }) =>
      staleUntil > now
      && streamerRiotIdVerificationCacheState(response.fetchedAt, PUBLIC_LOL_PROFILE_STALE_TTL_MS, now) === "fresh"
    );
    const freshMatchPages = matchPages.filter(({ expiresAt, response }) =>
      expiresAt > now
      && streamerRiotIdVerificationCacheState(response.fetchedAt, PUBLIC_LOL_PROFILE_STALE_TTL_MS, now) === "fresh"
    );
    const freshSuggestions = suggestions.filter((suggestion) =>
      streamerRiotIdVerificationCacheState(suggestion.lastSeenAt, PUBLIC_LOL_PROFILE_STALE_TTL_MS, now) === "fresh"
    );

    const successfulObservations = [
      ...(repositoryProfile?.status === "ready" && repositoryState === "fresh" ? [repositoryObservedAt] : []),
      ...freshMemoryProfiles.map(({ response }) => response.fetchedAt),
      ...freshMatchPages.map(({ response }) => response.fetchedAt),
      ...freshSuggestions.map((suggestion) => suggestion.lastSeenAt)
    ];
    const accountExistsObservedAt = latestIsoTimestamp(successfulObservations, now);
    const negativeCacheFresh = repositoryPlatformMatches
      && repositoryProfile?.status === "failed"
      && repositoryProfile.failureCode === "account_not_found"
      && streamerRiotIdVerificationCacheState(
        repositoryObservedAt,
        STREAMER_RIOT_ID_VERIFICATION_FAILURE_TTL_MS,
        now
      ) === "fresh";
    const allObservations = [
      repositoryObservedAt,
      ...memoryProfiles.map(({ response }) => response.fetchedAt),
      ...matchPages.map(({ response }) => response.fetchedAt),
      ...suggestions.map((suggestion) => suggestion.lastSeenAt)
    ];
    const latestObservedAt = latestIsoTimestamp(allObservations, now);
    const hasFreshUnknownEvidence = repositoryProfile !== undefined && repositoryState === "fresh";
    const hasStaleEvidence = repositoryState === "stale"
      || memoryProfiles.some(({ staleUntil }) => staleUntil <= now)
      || matchPages.some(({ expiresAt }) => expiresAt <= now)
      || suggestions.some((suggestion) =>
        streamerRiotIdVerificationCacheState(suggestion.lastSeenAt, PUBLIC_LOL_PROFILE_STALE_TTL_MS, now) === "stale"
      );

    const account: StreamerRiotIdVerificationSummary["account"] = accountExistsObservedAt
      ? { state: "exists", evidence: "fresh_cache", observedAt: accountExistsObservedAt }
      : negativeCacheFresh && repositoryObservedAt
        ? { state: "not_found", evidence: "fresh_cache", observedAt: repositoryObservedAt }
        : {
          state: "unknown",
          evidence: hasFreshUnknownEvidence ? "fresh_cache" : hasStaleEvidence ? "stale_cache" : "cache_miss",
          ...(latestObservedAt ? { observedAt: latestObservedAt } : {})
        };

    const rankCandidates = [
      ...(repositoryPlatformMatches && repositoryProfile?.rankedStats
        ? [{ rankedStats: repositoryProfile.rankedStats, observedAt: repositoryObservedAt }]
        : []),
      ...memoryProfiles.flatMap(({ response }) => response.rankedStats
        ? [{ rankedStats: response.rankedStats, observedAt: response.fetchedAt }]
        : []),
      ...suggestions.flatMap((suggestion) => suggestion.rankedStats
        ? [{ rankedStats: suggestion.rankedStats, observedAt: suggestion.lastSeenAt }]
        : [])
    ].filter(({ rankedStats, observedAt }) =>
      streamerRiotIdVerificationCacheState(observedAt, PUBLIC_LOL_PARTICIPANT_RANK_CACHE_TTL_MS, now) === "fresh"
      && streamerRiotIdVerificationCacheState(rankedStats.fetchedAt, PUBLIC_LOL_PARTICIPANT_RANK_CACHE_TTL_MS, now) === "fresh"
    ).sort((a, b) => Date.parse(b.rankedStats.fetchedAt) - Date.parse(a.rankedStats.fetchedAt));
    const rankedStats = rankCandidates[0]?.rankedStats;

    const lastPlayedAt = latestIsoTimestamp([
      ...(repositoryPlatformMatches && repositoryProfile?.status === "ready" && repositoryState === "fresh"
        ? repositoryProfile.recentMatches?.map((match) => match.startedAt) ?? []
        : []),
      ...freshMemoryProfiles.flatMap(({ response }) => response.recentMatches.map((match) => match.startedAt)),
      ...freshMatchPages.flatMap(({ response }) => response.recentMatches.map((match) => match.startedAt))
    ], now);

    return {
      account,
      ...(rankedStats
        ? {
          rank: {
            queueType: rankedStats.queueType,
            tier: rankedStats.tier,
            ...(rankedStats.rank ? { rank: rankedStats.rank } : {}),
            leaguePoints: rankedStats.leaguePoints,
            fetchedAt: rankedStats.fetchedAt
          }
        }
        : {}),
      ...(lastPlayedAt ? { lastPlayedAt } : {}),
      twitchDisplayNameComparison: {
        normalizedExactMatch: streamerDisplayNameComparisonKey(request.twitchDisplayName)
          === streamerDisplayNameComparisonKey(request.riotGameName),
        method: "nfkc_lowercase_ignore_whitespace"
      }
    };
  }

  function streamerRiotIdRequestListItem(request: StreamerRiotIdRequest): StreamerRiotIdRequestListItem {
    const note = request.note?.replace(/[\u0000-\u001f\u007f]+/gu, " ").trim();
    return {
      id: request.id,
      twitchLogin: request.twitchLogin,
      twitchDisplayName: request.twitchDisplayName,
      ...(request.twitchProfileImageUrl ? { twitchProfileImageUrl: request.twitchProfileImageUrl } : {}),
      riotGameName: request.riotGameName,
      riotTagLine: request.riotTagLine,
      status: request.status,
      ...(request.accountRole ? { accountRole: request.accountRole } : {}),
      ...(request.dashboardEnabled !== undefined ? { dashboardEnabled: request.dashboardEnabled } : {}),
      requestedAt: request.requestedAt,
      updatedAt: request.updatedAt,
      ...(request.reviewedAt ? { reviewedAt: request.reviewedAt } : {}),
      ...(note ? { note } : {}),
      verification: streamerRiotIdVerificationSummary(request)
    };
  }

  function streamerRiotIdRequestListResponse(url: URL): StreamerRiotIdRequestListResponse {
    const query = streamerRiotIdRequestListQuery(url);
    const requests = listStreamerRiotIdRequests()
      .sort((a, b) => {
        const updatedDifference = (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0);
        return updatedDifference || b.id.localeCompare(a.id);
      })
      .filter((request) => !query.status || request.status === query.status)
      .filter((request) => {
        if (!query.query) return true;
        return [
          request.twitchLogin,
          `@${request.twitchLogin}`,
          request.twitchDisplayName,
          request.riotGameName,
          request.riotTagLine,
          formatRiotId(request.riotGameName, request.riotTagLine)
        ].some((value) => normalizeSuggestionText(value).includes(query.query));
      });

    if (!query.parameterized) {
      return { requests: requests.map(streamerRiotIdRequestListItem) };
    }

    let startIndex = 0;
    if (query.cursor) {
      const cursor = decodeStreamerRiotIdRequestCursor(query.cursor, query);
      const cursorIndex = requests.findIndex((request) =>
        request.id === cursor.id && request.updatedAt === cursor.updatedAt
      );
      if (cursorIndex < 0) return streamerRiotIdRequestCursorError();
      startIndex = cursorIndex + 1;
    }
    const page = requests.slice(startIndex, startIndex + query.limit);
    const hasMore = startIndex + page.length < requests.length;
    return {
      requests: page.map(streamerRiotIdRequestListItem),
      pagination: {
        limit: query.limit,
        total: requests.length,
        returned: page.length,
        hasMore,
        ...(hasMore && page.length > 0
          ? { nextCursor: encodeStreamerRiotIdRequestCursor(page[page.length - 1]!, query) }
          : {})
      }
    };
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

  async function handlePalworldServerDashboardApi(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    principal: AuthPrincipal
  ): Promise<boolean> {
    if (!PALWORLD_SERVER_DASHBOARD_ENDPOINTS.has(url.pathname)) return false;

    const ownerId = requireAuthenticatedStreamerOwner(principal);
    if (url.searchParams.size > 0 || hasPalworldServerOwnerSelectorHeader(req)) {
      throw new HttpRequestError(400, {
        error: "스트리머 선택 값은 요청에 포함할 수 없습니다.",
        code: "invalid_request"
      });
    }

    const expectedMethod = url.pathname === PALWORLD_SERVER_DASHBOARD_PATH ? "GET" : "POST";
    if (req.method !== expectedMethod) {
      sendJson(req, res, 404, { error: "not found" });
      return true;
    }

    try {
      if (url.pathname === PALWORLD_SERVER_DASHBOARD_PATH) {
        const response = input.palworldServerMonitor?.getDashboardResponse(ownerId)
          ?? disabledPalworldServerDashboardResponse(input.palworldServerUnavailableCode);
        sendJson(req, res, 200, validatedPalworldServerDashboardResponse(response));
        return true;
      }

      if (url.pathname === `${PALWORLD_SERVER_DASHBOARD_PATH}/test`) {
        const connection = await readPalworldServerConnectionInput(req);
        if (!input.palworldServerMonitor) {
          throw new PalworldServerMonitorInputError(
            input.palworldServerUnavailableCode ?? "disabled",
            "Palworld 서버 상태 기능을 사용할 수 없습니다."
          );
        }
        const response = await input.palworldServerMonitor.testConnection(ownerId, connection);
        sendJson(req, res, 200, validatedPalworldServerTestResponse(response));
        return true;
      }

      if (url.pathname === `${PALWORLD_SERVER_DASHBOARD_PATH}/save`) {
        const connection = await readPalworldServerConnectionInput(req);
        if (!input.palworldServerMonitor) {
          throw new PalworldServerMonitorInputError(
            input.palworldServerUnavailableCode ?? "disabled",
            "Palworld 서버 상태 기능을 사용할 수 없습니다."
          );
        }
        const response = await input.palworldServerMonitor.saveConnection(ownerId, connection);
        sendJson(req, res, 200, validatedPalworldServerDashboardResponse(response));
        return true;
      }

      await requireEmptyPalworldServerBody(req);
      if (!input.palworldServerMonitor) {
        throw new PalworldServerMonitorInputError(
          input.palworldServerUnavailableCode ?? "disabled",
          "Palworld 서버 상태 기능을 사용할 수 없습니다."
        );
      }
      const response = url.pathname === `${PALWORLD_SERVER_DASHBOARD_PATH}/refresh`
        ? await input.palworldServerMonitor.refresh(ownerId)
        : await input.palworldServerMonitor.removeConnection(ownerId);
      sendJson(req, res, 200, validatedPalworldServerDashboardResponse(response));
      return true;
    } catch (error) {
      if (error instanceof HttpRequestError) throw error;
      if (error instanceof PalworldServerMonitorRateLimitError) {
        const retryAfterSeconds = Number.isSafeInteger(error.retryAfterSeconds) && error.retryAfterSeconds > 0
          ? error.retryAfterSeconds
          : 1;
        sendJson(
          req,
          res,
          429,
          { error: "Palworld 서버 상태 확인 요청이 너무 많습니다.", code: "rate_limited" },
          { "Retry-After": String(retryAfterSeconds) }
        );
        return true;
      }
      if (error instanceof PalworldServerMonitorInputError) {
        const statusCode = (PALWORLD_SERVER_AVAILABILITY_ERROR_CODES as readonly string[]).includes(error.code)
          ? 503
          : 400;
        sendJson(req, res, statusCode, { error: palworldServerInputErrorMessage(error.code), code: error.code });
        return true;
      }
      input.logger?.error({
        type: "palworld_server.http_failed",
        path: url.pathname,
        errorCode: "internal_error"
      });
      sendJson(req, res, 500, { error: "서버 내부 오류", code: "internal_error" });
      return true;
    }
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

  function startParticipationSessionForOwner(
    streamerId: string,
    options: {
      game?: ParticipationGame;
      maxQueueSize?: number;
      allowRejoin?: boolean;
      checkInSeconds?: number;
      listingVisibility?: ParticipationListingVisibility;
    } = {}
  ) {
    // Riot ID 승인 게이트는 게임 종류와 무관하게 참여 기능 전체의 기존 입구입니다.
    // Palworld 세션도 이 게이트를 그대로 통과해야 합니다 — 승인/권한 로직 자체를
    // 건드리는 건 이번 변경 범위 밖입니다.
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
    }, options);
  }

  function participationSessionMutationBody(value: unknown): {
    action: string;
    game?: ParticipationGame;
    maxQueueSize?: number;
    allowRejoin?: boolean;
    checkInSeconds?: number;
    listingVisibility?: ParticipationListingVisibility;
    expectedRevision?: number;
  } {
    const body = strictJsonObject(value, ["action", "game", "maxQueueSize", "allowRejoin", "checkInSeconds", "listingVisibility", "expectedRevision"]);
    if (typeof body.action !== "string" || !PARTICIPATION_SESSION_ACTIONS.has(body.action)) {
      throw new HttpRequestError(400, { error: "허용되지 않은 시청자 참여 세션 조작입니다.", code: "INVALID_ACTION" });
    }
    if (body.action !== "start" && (
      body.game !== undefined
      || body.maxQueueSize !== undefined
      || body.allowRejoin !== undefined
      || body.checkInSeconds !== undefined
      || body.listingVisibility !== undefined
    )) {
      throw new HttpRequestError(400, { error: "세션 생성 설정은 start 동작에서만 사용할 수 있습니다.", code: "INVALID_REQUEST" });
    }
    if (body.game !== undefined && !PARTICIPATION_GAMES.includes(body.game as ParticipationGame)) {
      throw new HttpRequestError(400, { error: "지원하지 않는 게임입니다.", code: "INVALID_GAME" });
    }
    if (body.expectedRevision !== undefined && (
      typeof body.expectedRevision !== "number"
      || !Number.isSafeInteger(body.expectedRevision)
      || body.expectedRevision < 0
    )) {
      throw new HttpRequestError(400, { error: "참여 상태 revision이 올바르지 않습니다.", code: "INVALID_REVISION" });
    }
    if (body.maxQueueSize !== undefined && (
      typeof body.maxQueueSize !== "number"
      || !Number.isInteger(body.maxQueueSize)
      || body.maxQueueSize < 1
      || body.maxQueueSize > 500
    )) {
      throw new HttpRequestError(400, { error: "최대 대기 인원은 1명 이상 500명 이하여야 합니다.", code: "INVALID_QUEUE_SIZE" });
    }
    if (body.checkInSeconds !== undefined && (
      typeof body.checkInSeconds !== "number"
      || !Number.isInteger(body.checkInSeconds)
      || body.checkInSeconds < 15
      || body.checkInSeconds > 600
    )) {
      throw new HttpRequestError(400, { error: "체크인 시간은 15초 이상 600초 이하여야 합니다.", code: "INVALID_CHECK_IN_SECONDS" });
    }
    if (body.allowRejoin !== undefined && typeof body.allowRejoin !== "boolean") {
      throw new HttpRequestError(400, { error: "재참여 허용 값이 올바르지 않습니다.", code: "INVALID_ALLOW_REJOIN" });
    }
    if (body.listingVisibility !== undefined && !["public", "followers"].includes(String(body.listingVisibility))) {
      throw new HttpRequestError(400, { error: "참여 페이지 공개 범위가 올바르지 않습니다.", code: "INVALID_LISTING_VISIBILITY" });
    }
    return {
      action: body.action,
      ...(body.game === "lol" || body.game === "palworld" ? { game: body.game } : {}),
      ...(typeof body.maxQueueSize === "number" ? { maxQueueSize: body.maxQueueSize } : {}),
      ...(typeof body.allowRejoin === "boolean" ? { allowRejoin: body.allowRejoin } : {}),
      ...(typeof body.checkInSeconds === "number" ? { checkInSeconds: body.checkInSeconds } : {}),
      ...(body.listingVisibility === "public" || body.listingVisibility === "followers"
        ? { listingVisibility: body.listingVisibility }
        : {}),
      ...(typeof body.expectedRevision === "number" ? { expectedRevision: body.expectedRevision } : {})
    };
  }

  async function mutateParticipationSessionForOwner(
    streamerId: string,
    bodyValue: unknown
  ): Promise<{ ok: true; action: string; state: LolOperationsState }> {
    const body = participationSessionMutationBody(bodyValue);
    const currentRevision = input.store.getParticipationState(streamerId).revision ?? 0;
    if (body.expectedRevision !== undefined && body.expectedRevision !== currentRevision) {
      throw new HttpRequestError(409, {
        error: "다른 화면에서 참여 상태가 변경되었습니다. 최신 상태를 다시 불러왔습니다.",
        code: "REVISION_CONFLICT"
      });
    }
    const currentSession = input.store.getParticipationSession(streamerId);
    if (
      currentSession?.status === "completed"
      && body.action !== "start"
      && body.action !== "finish"
    ) {
      throw new HttpRequestError(409, {
        error: "종료된 시청자 참여 세션은 다시 활성화할 수 없습니다. 새 모집을 시작해 주세요.",
        code: "SESSION_COMPLETED"
      });
    }
    if (body.action === "start") {
      if (currentSession && currentSession.status !== "completed") {
        throw new HttpRequestError(409, {
          error: "이미 진행 중인 시청자 참여 세션이 있습니다.",
          code: "SESSION_ALREADY_ACTIVE"
        });
      }
      startParticipationSessionForOwner(streamerId, {
        ...(body.game !== undefined ? { game: body.game } : {}),
        ...(body.maxQueueSize !== undefined ? { maxQueueSize: body.maxQueueSize } : {}),
        ...(body.allowRejoin !== undefined ? { allowRejoin: body.allowRejoin } : {}),
        ...(body.checkInSeconds !== undefined ? { checkInSeconds: body.checkInSeconds } : {}),
        ...(body.listingVisibility !== undefined ? { listingVisibility: body.listingVisibility } : {})
      });
      await broadcastParticipationSnapshot(input, "recruiting", "dashboard.lol_operations.session_start", streamerId);
    } else if (body.action === "finish") {
      if (!input.store.getParticipationSession(streamerId)) {
        throw new HttpRequestError(409, { error: "종료할 시청자 참여 세션이 없습니다.", code: "SESSION_NOT_ACTIVE" });
      }
      input.store.setParticipationOpen(false, streamerId);
      input.store.endParticipationSession(streamerId);
      await broadcastParticipationSnapshot(input, "closed", "dashboard.lol_operations.session_finish", streamerId);
    } else {
      if (body.action === "open" && !input.store.getParticipationSession(streamerId)) {
        startParticipationSessionForOwner(streamerId);
      }
      await applyManualParticipationAction(input, body.action, streamerId);
    }
    return { ok: true, action: body.action, state: lolOperationsStateForOwner(streamerId) };
  }

  async function mutateParticipationEntryForOwner(
    streamerId: string,
    bodyValue: unknown,
    allowedStatuses: ReadonlySet<ParticipationStatus> = PARTICIPATION_DASHBOARD_ENTRY_STATUSES
  ): Promise<ParticipationState> {
    const body = strictJsonObject(bodyValue, ["entryId", "entryIds", "status", "expectedRevision"]);
    const hasSingleEntryId = typeof body.entryId === "string" && Boolean(body.entryId.trim());
    const hasBatchEntryIds = Array.isArray(body.entryIds);
    if (hasSingleEntryId === hasBatchEntryIds) {
      throw new HttpRequestError(400, { error: "entryId 또는 entryIds 중 하나가 필요합니다.", code: "INVALID_ENTRY_ID" });
    }
    if (typeof body.status !== "string" || !allowedStatuses.has(body.status as ParticipationStatus)) {
      throw new HttpRequestError(400, { error: "허용되지 않은 참가자 상태입니다.", code: "INVALID_ENTRY_STATUS" });
    }
    if (body.expectedRevision !== undefined && (
      typeof body.expectedRevision !== "number"
      || !Number.isSafeInteger(body.expectedRevision)
      || body.expectedRevision < 0
    )) {
      throw new HttpRequestError(400, { error: "참여 상태 revision이 올바르지 않습니다.", code: "INVALID_REVISION" });
    }
    const currentRevision = input.store.getParticipationState(streamerId).revision ?? 0;
    if (body.expectedRevision !== undefined && body.expectedRevision !== currentRevision) {
      throw new HttpRequestError(409, {
        error: "다른 화면에서 참여 상태가 변경되었습니다. 최신 상태를 다시 불러왔습니다.",
        code: "REVISION_CONFLICT"
      });
    }
    const entryIds = hasBatchEntryIds
      ? Array.from(new Set((body.entryIds as unknown[]).map((entryId) => (
        typeof entryId === "string" ? entryId.trim() : ""
      ))))
      : [(body.entryId as string).trim()];
    if (
      entryIds.length === 0
      || entryIds.length > 100
      || (hasBatchEntryIds && (body.entryIds as unknown[]).length > 100)
      || entryIds.some((entryId) => !entryId)
    ) {
      throw new HttpRequestError(400, { error: "entryIds는 1개 이상 100개 이하의 유효한 ID여야 합니다.", code: "INVALID_ENTRY_IDS" });
    }
    if (hasBatchEntryIds && body.status !== "selected") {
      throw new HttpRequestError(400, { error: "여러 참가자는 선정 상태로만 일괄 변경할 수 있습니다.", code: "INVALID_BATCH_ENTRY_STATUS" });
    }
    const currentState = input.store.getParticipationState(streamerId);
    const targetEntries = entryIds.map((entryId) => currentState.queue.find((entry) => entry.id === entryId));
    if (targetEntries.some((entry) => !entry)) {
      throw new HttpRequestError(404, { error: "시청자 참여 항목을 찾을 수 없습니다.", code: "ENTRY_NOT_FOUND" });
    }
    if (body.status === "selected") {
      if (!currentState.session || currentState.session.status !== "recruiting" || !currentState.isOpen) {
        throw new HttpRequestError(409, { error: "모집 중인 참여 세션에서만 참가자를 선정할 수 있습니다.", code: "SESSION_NOT_RECRUITING" });
      }
      if (targetEntries.some((entry) => !entry || !["verified", "waitlisted"].includes(entry.status))) {
        throw new HttpRequestError(409, { error: "검증이 완료된 대기 참가자만 선정할 수 있습니다.", code: "ENTRY_NOT_SELECTABLE" });
      }
      // 게임별 진행 인원 정원(방송인 1자리 제외)을 넘는 선정은 막습니다. 이 서버
      // 검증이 최종 판단입니다 — 대시보드의 비활성화는 안내용일 뿐입니다.
      const activeParticipantCount = currentState.queue.filter((entry) => (
        ["selected", "checked_in", "invited", "in_game"].includes(entry.status)
      )).length;
      const viewerCapacity = PARTICIPATION_GAME_CAPACITY[currentState.session.game] - 1;
      if (activeParticipantCount + entryIds.length > viewerCapacity) {
        throw new HttpRequestError(409, {
          error: "진행 인원이 가득 찼습니다.",
          code: "PARTICIPATION_CAPACITY_FULL"
        });
      }
      const selected = input.store.selectParticipants(
        entryIds,
        currentState.session.checkInSeconds ?? 60,
        streamerId
      );
      if (!selected) {
        throw new HttpRequestError(409, { error: "현재 참가자 처리가 끝난 뒤 다음 참가자를 선정해 주세요.", code: "CURRENT_PARTICIPANT_ACTIVE" });
      }
    } else {
      const updatedEntry = input.store.markParticipant(entryIds[0]!, body.status as ParticipationStatus, streamerId);
      if (updatedEntry) invalidatePublicLolProfileCachesForRiotId(updatedEntry.riotGameName, updatedEntry.riotTagLine);
    }
    await broadcastParticipationQueue(input, "dashboard.lol_operations.entry_status", streamerId);
    return input.store.getParticipationState(streamerId);
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
    /* 개명은 self-serve라 이 검사가 없으면 다른 스트리머(또는 자신의 서브)가
       이미 등록한 ID를 대표로 덮어써 같은 Riot ID의 승인 row가 둘이 됩니다 —
       서브 추가(addStreamerSubRiotIdRequest)의 선점 가드와 같은 기준을 적용합니다. */
    const normalizedKey = normalizeRiotIdKey(parsed.gameName, parsed.tagLine);
    const conflict = listStreamerRiotIdRequests().find((row) =>
      row.status !== "rejected"
      && row.normalizedRiotId === normalizedKey
      && row.id !== previous.id
    );
    if (conflict) {
      throw new HttpRequestError(409, conflict.twitchUserId === streamerId
        ? { error: "이미 등록한 Riot ID입니다. 대표 전환은 계정 목록의 대표 지정을 사용해주세요.", code: "riot_id_duplicated" }
        : { error: "이미 다른 스트리머가 등록한 Riot ID입니다.", code: "riot_id_taken" });
    }
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
    for (const request of listApprovedMainStreamerRiotIds()) {
      profiles.set(request.twitchUserId, {
        riotGameName: request.riotGameName,
        riotTagLine: request.riotTagLine,
        rankedStats: cachedRankedStatsForRiotId(request.riotGameName, request.riotTagLine),
        source: "approved_streamer"
      });
    }
    return profiles;
  }

  async function getPublicTwitchFollowedLol(
    limit: number,
    req: IncomingMessage,
    includeSubscriptions = true
  ): Promise<PublicTwitchFollowedLolResponse> {
    const yoroContext = input.yoroAccounts
      ? await input.yoroAccounts
          .getTwitchAccessContext(requestCookie(req, YORO_SESSION_COOKIE))
          .catch(() => undefined)
      : undefined;
    const context = yoroContext ?? (
      input.publicTwitchAuth
        ? await input.publicTwitchAuth.getAccessContext(
            publicTwitchViewerSessionIdFromRequest(req)
          )
        : undefined
    );
    if (!context) {
      return { connected: false, truncated: false, matchedCount: 0, subscriptionScopeGranted: false, subscriptions: [], channels: [] };
    }
    const twitch = input.twitch;
    if (!twitch) throw new HttpRequestError(503, { error: "Twitch API client를 사용할 수 없습니다." });

    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Math.trunc(limit), 100)) : 100;
    const cacheKey = `${context.userId}:${safeLimit}:${includeSubscriptions ? "subscriptions" : "channels"}`;
    const cached = publicTwitchFollowedCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.response;
    const pending = publicTwitchFollowedInFlight.get(cacheKey);
    if (pending) return pending;

    const request = (async (): Promise<PublicTwitchFollowedLolResponse> => {
      const followed = await twitch.getFollowedChannels({
      clientId: context.clientId,
      accessToken: context.accessToken,
      scopes: context.scopes,
      userId: context.userId
      }, safeLimit);
      const participationProfiles = participationRiotProfilesByTwitchId();
      const approvedProfiles = approvedStreamerRiotProfilesByTwitchId();
      const connectedStreamerRequest = connectedStreamerRiotProfile();
      const streamsRequest = twitch.getStreamsByUserIds({
        clientId: context.clientId,
        accessToken: context.accessToken,
        scopes: context.scopes
      }, followed.channels.map((channel) => channel.broadcasterId)).catch(() => new Map<string, TwitchStreamStatus>());
      const subscriptionScopeGranted = context.scopes.includes("user:read:subscriptions");
      const subscriptionCheckChannels = followed.channels.slice(0, PUBLIC_TWITCH_SUBSCRIPTION_CHECK_LIMIT);
      const subscriptionsRequest = subscriptionScopeGranted && includeSubscriptions
        ? twitch.checkUserSubscriptions({
          clientId: context.clientId,
          accessToken: context.accessToken,
          scopes: context.scopes,
          userId: context.userId
          }, subscriptionCheckChannels.map((channel) => channel.broadcasterId)).catch(() => new Map())
        : Promise.resolve(new Map());
      const [connectedStreamer, streams, subscriptionsByBroadcasterId] = await Promise.all([
        connectedStreamerRequest,
        streamsRequest,
        subscriptionsRequest,
      ]);

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
    })();
    publicTwitchFollowedInFlight.set(cacheKey, request);
    try {
      const response = await request;
      publicTwitchFollowedCache.set(cacheKey, {
        expiresAt: Date.now() + PUBLIC_TWITCH_FOLLOWED_CACHE_TTL_MS,
        response,
      });
      pruneMapToMax(publicTwitchFollowedCache, PUBLIC_TWITCH_FOLLOWED_CACHE_MAX);
      return response;
    } finally {
      if (publicTwitchFollowedInFlight.get(cacheKey) === request) {
        publicTwitchFollowedInFlight.delete(cacheKey);
      }
    }
  }

  function publicParticipationQueueItem(
    entry: ParticipationEntry,
    position: number,
    viewerTwitchUserId?: string
  ): PublicParticipationQueueItem {
    return {
      position,
      twitchUserName: entry.twitchUserName,
      game: entry.game ?? "lol",
      ...(entry.game === "palworld" && entry.palworldNickname ? { palworldNickname: entry.palworldNickname } : {}),
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
      ...(entry.game === "palworld"
        ? {}
        : { riotId: formatRiotId(entry.riotGameName ?? "", entry.riotTagLine ?? "") }),
      source: entry.source,
      ...(entry.checkInExpiresAt ? { checkInExpiresAt: entry.checkInExpiresAt } : {})
    };
  }

  async function publicParticipationStreamers(
    selectedStreamerId?: string,
    allowOfflineSelected = false
  ): Promise<{
    streamers: PublicParticipationStreamer[];
    selectedStreamerId?: string;
    scopeStreamerId?: string;
  }> {
    const approvedStreamers = listApprovedMainStreamerRiotIds();
    const approvedByOwner = new Map(approvedStreamers.map((request) => [request.twitchUserId, request]));
    const activeSessions = input.store.listParticipationSessions()
      .filter((session) => (
        session.status === "recruiting"
        || session.status === "in_game"
        || (allowOfflineSelected && selectedStreamerId === session.streamerId)
      ));
    if (activeSessions.length > 0) {
      const streamers = (await Promise.all(activeSessions.map(async (session) => {
        const isLive = await isPublicParticipationStreamerLive(session.streamerId);
        const isDirectlySelected = allowOfflineSelected && selectedStreamerId === session.streamerId;
        if (!isDirectlySelected && session.listingVisibility !== "public") return undefined;
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
          isLive,
          isOpen: participationState.isOpen,
          queueSize: participationState.summary.active,
          maxQueueSize: session.maxQueueSize ?? PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE,
          publicSessionId: session.publicSessionId,
          sessionStatus: session.status,
          listingVisibility: session.listingVisibility,
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
    /* riot-id 키 매칭은 서브 계정도 대상입니다 — approvedStreamers(대표 목록)가
       아니라 전체 승인 목록에서 찾아야 legacy monitor 설정이 서브가 된 계정을
       가리켜도 스트리머 연결이 끊기지 않습니다. */
    const matchedApproved = monitorKey
      ? listApprovedStreamerRiotIds().find((request) => request.normalizedRiotId === monitorKey)
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
      isLive: true,
      isOpen: true,
      queueSize: participationState.summary.active,
      maxQueueSize: participationState.session?.maxQueueSize ?? PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE,
      ...(participationState.session?.publicSessionId
        ? { publicSessionId: participationState.session.publicSessionId }
        : {}),
      sessionStatus: participationState.session?.status ?? "recruiting",
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

  async function getPublicParticipationDiscovery(req: IncomingMessage): Promise<PublicParticipationDiscoveryResponse> {
    const status = await getPublicTwitchViewerStatus(req);
    if (!status.connected) {
      return {
        connected: false,
        configured: status.configured,
        followedRecruiting: [],
        followedLiveButClosed: [],
        followedOfflineRecruiting: [],
        metadata: { fetchedAt: new Date().toISOString(), revision: 0 }
      };
    }
    const followed = await getPublicTwitchFollowedLol(100, req, false);
    const approvedByOwner = new Map(listApprovedMainStreamerRiotIds().map((request) => [request.twitchUserId, request]));
    const recruitingByOwner = new Map(
      participationRepository.listSessions()
        .filter((session) => session.status === "recruiting")
        .map((session) => [session.streamerId, session])
    );
    const toStreamer = (channel: PublicTwitchFollowedLolChannel, session?: ParticipationSession): PublicParticipationStreamer => {
      const approved = approvedByOwner.get(channel.twitchUserId);
      const state = session ? participationRepository.getState(session.streamerId) : undefined;
      return {
        id: channel.twitchUserId,
        twitchUserId: channel.twitchUserId,
        twitchLogin: channel.twitchLogin,
        twitchDisplayName: channel.twitchDisplayName,
        ...(channel.profileImageUrl ? { twitchProfileImageUrl: channel.profileImageUrl } : {}),
        ...(approved ? { riotGameName: approved.riotGameName, riotTagLine: approved.riotTagLine, riotId: formatRiotId(approved.riotGameName, approved.riotTagLine) } : {}),
        isLive: channel.isLive,
        isOpen: Boolean(session && state?.isOpen),
        queueSize: state?.summary.active ?? 0,
        ...(session ? { maxQueueSize: session.maxQueueSize ?? PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE } : {}),
        ...(session ? { publicSessionId: session.publicSessionId, sessionStatus: session.status } : {}),
        ...(session ? { listingVisibility: session.listingVisibility } : {}),
        updatedAt: session?.updatedAt ?? channel.followedAt
      };
    };
    const approvedFollowed = followed.channels.filter((channel) => approvedByOwner.has(channel.twitchUserId));
    const followedRecruiting: PublicParticipationStreamer[] = [];
    const followedOfflineRecruiting: PublicParticipationStreamer[] = [];
    const followedLiveButClosed: PublicParticipationStreamer[] = [];
    for (const channel of approvedFollowed) {
      const session = recruitingByOwner.get(channel.twitchUserId);
      if (session) {
        (channel.isLive ? followedRecruiting : followedOfflineRecruiting).push(toStreamer(channel, session));
      } else if (channel.isLive) {
        followedLiveButClosed.push(toStreamer(channel));
      }
    }
    const revision = Math.max(0, ...[...recruitingByOwner.keys()].map((streamerId) => participationRepository.getState(streamerId).revision ?? 0));
    return {
      connected: true,
      configured: status.configured,
      followedRecruiting,
      followedLiveButClosed,
      followedOfflineRecruiting,
      metadata: { fetchedAt: new Date().toISOString(), revision }
    };
  }

  async function getPublicParticipationState(
    req: IncomingMessage,
    knownStatus?: PublicTwitchViewerStatusResponse,
    selectedStreamerIdOverride?: string,
    publicSessionIdOverride?: string
  ): Promise<PublicParticipationStateResponse> {
    const status = knownStatus ?? await getPublicTwitchViewerStatus(req);
    const viewerId = status.connected ? status.user?.id : undefined;
    const url = new URL(req.url ?? "/", "http://localhost");
    const requestedPublicSessionId = publicSessionIdOverride ?? (url.searchParams.get("session")?.trim() || undefined);
    const publicSession = requestedPublicSessionId
      ? participationRepository.getSession(requestedPublicSessionId)
      : undefined;
    if (requestedPublicSessionId && !publicSession) {
      throw new HttpRequestError(404, { error: "참여 세션을 찾을 수 없습니다.", code: "SESSION_NOT_FOUND" });
    }
    const requestedStreamerId = publicSession?.streamerId
      ?? selectedStreamerIdOverride
      ?? (url.searchParams.get("streamerId")?.trim() || undefined);
    const streamerState = await publicParticipationStreamers(requestedStreamerId, Boolean(publicSession));
    const selectedScopeStreamerId = streamerState.scopeStreamerId;
    const participationState = selectedScopeStreamerId
      ? input.store.getParticipationState(selectedScopeStreamerId)
      : undefined;
    const activeEntries = selectedScopeStreamerId
      ? input.store.getActiveParticipationQueue(selectedScopeStreamerId)
      : [];
    const queue = participationState?.isOpen
      ? activeEntries
        .slice(0, participationState.session?.maxQueueSize ?? PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE)
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
      ...(participationState?.session?.publicSessionId ? { publicSessionId: participationState.session.publicSessionId } : {}),
      revision: participationState?.revision ?? 0,
      queue,
      ...(viewerEntry ? { viewerEntry } : {}),
      maxQueueSize: participationState?.session?.maxQueueSize ?? PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE,
      updatedAt: new Date().toISOString()
    };
  }

  async function joinPublicParticipation(
    req: IncomingMessage,
    publicSessionId?: string,
    rejoinOnly = false
  ): Promise<PublicParticipationJoinResponse> {
    const status = await getPublicTwitchViewerStatus(req);
    if (!status.connected || !status.user) {
      throw new HttpRequestError(401, { error: "Twitch 로그인 후 참여 등록을 할 수 있습니다." });
    }
    const body = strictJsonObject(
      await readJsonBody<unknown>(req),
      publicSessionId ? ["riotId", "role", "palworldNickname"] : ["riotId", "role", "palworldNickname", "streamerId"]
    );
    const selectedSession = publicSessionId ? participationRepository.getSession(publicSessionId) : undefined;
    if (publicSessionId && !selectedSession) {
      throw new HttpRequestError(404, { error: "참여 세션을 찾을 수 없습니다.", code: "SESSION_NOT_FOUND" });
    }
    const requestedStreamerId = selectedSession?.streamerId
      ?? (typeof body.streamerId === "string" ? body.streamerId.trim() : "");
    if (!requestedStreamerId) {
      throw new HttpRequestError(400, { error: "참여할 방송인을 선택해주세요." });
    }
    const streamerState = await publicParticipationStreamers(requestedStreamerId, Boolean(selectedSession));
    if (!streamerState.streamers.some((streamer) => streamer.id === requestedStreamerId)) {
      throw new HttpRequestError(404, { error: "선택한 방송인의 참여 대기열을 찾을 수 없습니다." });
    }
    if (!streamerState.selectedStreamerId || !input.store.getParticipationState(streamerState.scopeStreamerId).isOpen) {
      throw new HttpRequestError(409, { error: "현재 시청자 참여 대기열이 닫혀 있습니다.", code: "SESSION_CLOSED" });
    }
    // 세션이 정한 게임에 따라 입력 필드와 검증 방식이 갈립니다. Palworld는 공식
    // 계정 조회 API가 없어 검증 없이 자기 신고 닉네임만으로 대기열에 등록합니다.
    const targetGame = selectedSession?.game
      ?? input.store.getParticipationState(streamerState.scopeStreamerId).session?.game
      ?? "lol";
    const previousViewerEntry = input.store.getParticipationQueue(streamerState.scopeStreamerId)
      .filter((entry) => entry.twitchUserId === status.user!.id)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
    if (rejoinOnly && !["played", "skipped"].includes(previousViewerEntry?.status ?? "")) {
      throw new HttpRequestError(409, { error: "참여 완료 또는 순서 건너뛰기 후에만 재참여할 수 있습니다.", code: "REJOIN_NOT_ALLOWED" });
    }
    if (rejoinOnly && selectedSession?.allowRejoin === false) {
      throw new HttpRequestError(409, { error: "이 참여 세션은 재참여를 허용하지 않습니다.", code: "REJOIN_NOT_ALLOWED" });
    }

    let parsedRiotId: { gameName: string; tagLine: string } | undefined;
    let role: LolRole = "fill";
    let palworldNickname = "";
    if (targetGame === "palworld") {
      palworldNickname = typeof body.palworldNickname === "string" ? body.palworldNickname.trim() : "";
      if (!palworldNickname) {
        throw new HttpRequestError(400, { error: "Palworld 닉네임을 입력해주세요." });
      }
      if (palworldNickname.length > 32) {
        throw new HttpRequestError(400, { error: "닉네임은 32자 이하로 입력해주세요." });
      }
    } else {
      if (typeof body.riotId !== "string") {
        throw new HttpRequestError(400, { error: "Riot ID를 입력해주세요." });
      }
      const parsed = parseRiotIdDetailed(body.riotId);
      if (!parsed.ok) {
        throw new HttpRequestError(400, { error: parsed.message });
      }
      parsedRiotId = { gameName: parsed.gameName, tagLine: parsed.tagLine };
      const normalizedRole = normalizeLolRole(typeof body.role === "string" ? body.role : undefined);
      role = normalizedRole === "unknown" ? "fill" : normalizedRole;
    }
    const duplicateLookup = {
      twitchUserId: status.user.id,
      ...(parsedRiotId ? { riotGameName: parsedRiotId.gameName, riotTagLine: parsedRiotId.tagLine } : {})
    };

    const duplicateBefore = input.store.findParticipationDuplicate(duplicateLookup, streamerState.scopeStreamerId);
    if (duplicateBefore) {
      const state = await getPublicParticipationState(req, status, streamerState.selectedStreamerId, selectedSession?.publicSessionId);
      return {
        ok: true,
        alreadyJoined: true,
        reused: false,
        state,
        ...(state.viewerEntry ? { entry: state.viewerEntry } : {})
      };
    }
    const maxQueueSize = selectedSession?.maxQueueSize ?? PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE;
    if (input.store.getActiveParticipationCount(streamerState.scopeStreamerId) >= maxQueueSize) {
      throw new HttpRequestError(409, { error: "참여 대기열이 가득 찼습니다.", code: "QUEUE_FULL" });
    }

    const previousProfile = parsedRiotId
      ? input.store.findReusableParticipationProfile({
        riotGameName: parsedRiotId.gameName,
        riotTagLine: parsedRiotId.tagLine
      }, streamerState.scopeStreamerId)
      : undefined;
    const profileReady = previousProfile?.profileStatus === "ready" || Boolean(previousProfile?.rankedStats);
    const entry = input.store.makeParticipationEntry(targetGame === "palworld" ? {
      twitchUserId: status.user.id,
      twitchUserName: status.user.displayName || status.user.login,
      game: "palworld",
      palworldNickname,
      status: "waitlisted",
      source: "dashboard",
      joinedFrom: "public_web"
    } : {
      twitchUserId: status.user.id,
      twitchUserName: status.user.displayName || status.user.login,
      game: "lol",
      riotGameName: parsedRiotId!.gameName,
      riotTagLine: parsedRiotId!.tagLine,
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
      source: "dashboard",
      joinedFrom: "public_web"
    });
    const latestSession = participationRepository.getSession(
      selectedSession?.publicSessionId ?? input.store.getParticipationState(streamerState.scopeStreamerId).session?.publicSessionId ?? ""
    );
    if (
      !latestSession
      || !["recruiting", "in_game"].includes(latestSession.status)
      || !input.store.getParticipationState(streamerState.scopeStreamerId).isOpen
    ) {
      throw new HttpRequestError(409, { error: "현재 시청자 참여 대기열이 닫혀 있습니다.", code: "SESSION_CLOSED" });
    }
    const duplicateImmediatelyBeforeSave = input.store.findParticipationDuplicate(duplicateLookup, streamerState.scopeStreamerId);
    if (duplicateImmediatelyBeforeSave) {
      const state = await getPublicParticipationState(req, status, streamerState.selectedStreamerId, latestSession.publicSessionId);
      return {
        ok: true,
        alreadyJoined: true,
        reused: false,
        state,
        ...(state.viewerEntry ? { entry: state.viewerEntry } : {})
      };
    }
    if (input.store.getActiveParticipationCount(streamerState.scopeStreamerId) >= (latestSession.maxQueueSize ?? PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE)) {
      throw new HttpRequestError(409, { error: "참여 대기열이 가득 찼습니다.", code: "QUEUE_FULL" });
    }
    const saved = input.store.reactivateReusableParticipation(entry, streamerState.scopeStreamerId);
    await broadcastParticipationQueue(
      { store: input.store, actions: input.actions },
      "public.participation_join",
      streamerState.scopeStreamerId
    )
      .catch(() => undefined);
    if (targetGame === "lol" && input.refreshLolProfile && saved.entry.profileStatus !== "ready") {
      void input.refreshLolProfile(saved.entry.id, streamerState.scopeStreamerId).catch(() => undefined);
    }
    if (targetGame === "lol") {
      invalidatePublicLolProfileCachesForRiotId(saved.entry.riotGameName, saved.entry.riotTagLine);
    }
    const state = await getPublicParticipationState(req, status, streamerState.selectedStreamerId, selectedSession?.publicSessionId);
    return {
      ok: true,
      alreadyJoined: false,
      reused: saved.reused,
      state,
      ...(state.viewerEntry ? { entry: state.viewerEntry } : {})
    };
  }

  async function cancelPublicParticipation(req: IncomingMessage, publicSessionId?: string): Promise<PublicParticipationCancelResponse> {
    const status = await getPublicTwitchViewerStatus(req);
    if (!status.connected || !status.user) {
      throw new HttpRequestError(401, { error: "Twitch 로그인 후 참여 취소를 할 수 있습니다." });
    }
    const body = strictJsonObject(
      await readJsonBody<unknown>(req),
      publicSessionId ? [] : ["streamerId"]
    );
    const selectedSession = publicSessionId ? participationRepository.getSession(publicSessionId) : undefined;
    if (publicSessionId && !selectedSession) {
      throw new HttpRequestError(404, { error: "참여 세션을 찾을 수 없습니다.", code: "SESSION_NOT_FOUND" });
    }
    const requestedStreamerId = selectedSession?.streamerId
      ?? (typeof body.streamerId === "string" ? body.streamerId.trim() : "");
    if (!requestedStreamerId) {
      throw new HttpRequestError(400, { error: "참여할 방송인을 선택해주세요." });
    }
    const streamerState = await publicParticipationStreamers(requestedStreamerId, Boolean(selectedSession));
    if (!streamerState.streamers.some((streamer) => streamer.id === requestedStreamerId)) {
      throw new HttpRequestError(404, { error: "선택한 방송인의 참여 대기열을 찾을 수 없습니다." });
    }
    if (!streamerState.selectedStreamerId) {
      throw new HttpRequestError(404, { error: "선택한 방송인의 참여 대기열을 찾을 수 없습니다." });
    }
    const result = participationRepository.cancel(status.user.id, streamerState.scopeStreamerId!);
    if (!result.ok) {
      const error = result.reason === "in_game"
        ? "이미 게임 진행 상태라 참여 취소를 할 수 없습니다."
        : "취소할 참여 신청을 찾지 못했습니다.";
      throw new HttpRequestError(result.reason === "in_game" ? 409 : 404, { error });
    }
    invalidatePublicLolProfileCachesForRiotId(result.entry.riotGameName, result.entry.riotTagLine);
    await broadcastParticipationQueue(
      { store: input.store, actions: input.actions },
      "public.participation_cancel",
      streamerState.scopeStreamerId
    )
      .catch(() => undefined);
    return {
      ok: true,
      state: await getPublicParticipationState(req, status, streamerState.selectedStreamerId, selectedSession?.publicSessionId)
    };
  }

  function requireTwitchExtensionPrincipal(
    req: IncomingMessage,
    options: Readonly<{ mutation?: boolean }> = {}
  ): TwitchExtensionPrincipal {
    if (
      !appConfig.twitchExtension.enabled
      || !input.twitchExtensionJwt
      || !input.twitchExtensionSettings
    ) {
      throw new HttpRequestError(503, {
        error: "Twitch Extension을 사용할 수 없습니다.",
        code: "EXTENSION_UNAVAILABLE"
      });
    }
    try {
      const principal = input.twitchExtensionJwt.verifyRequest(req);
      if (options.mutation && (principal.role !== "viewer" || !principal.userId)) {
        throw new HttpRequestError(403, {
          error: "Twitch에서 신원을 공유한 시청자만 이 작업을 할 수 있습니다.",
          code: "IDENTITY_REQUIRED"
        });
      }
      return principal;
    } catch (error) {
      if (error instanceof HttpRequestError) throw error;
      if (error instanceof TwitchExtensionJwtError) {
        throw new HttpRequestError(401, {
          error: error.code === "expired"
            ? "Twitch Extension 인증이 만료되었습니다."
            : "Twitch Extension 인증이 올바르지 않습니다.",
          code: error.code === "expired" ? "TOKEN_EXPIRED" : "INVALID_TOKEN"
        });
      }
      throw error;
    }
  }

  async function twitchExtensionSettingsFor(
    streamerTwitchUserId: string
  ): Promise<TwitchExtensionSettingsResponse> {
    if (!input.twitchExtensionSettings) {
      throw new HttpRequestError(503, {
        error: "Twitch Extension 설정을 사용할 수 없습니다.",
        code: "EXTENSION_UNAVAILABLE"
      });
    }
    return input.twitchExtensionSettings.readForStreamer({
      streamerTwitchUserId,
      connectionState: appConfig.twitchExtension.enabled
        ? "connected"
        : "configuration_required"
    });
  }

  async function twitchExtensionViewerResponse(
    principal: TwitchExtensionPrincipal
  ): Promise<{
    identityLinked: boolean;
    settings: TwitchExtensionSettingsResponse;
    viewer: {
      status: "no_session" | "active" | "joined" | "next" | "paused" | "full" | "ended";
      game?: string;
      waitingCount?: number;
      myPosition?: number;
    };
  }> {
    const settings = await twitchExtensionSettingsFor(principal.channelId);
    const session = input.store.getParticipationSession(principal.channelId);
    if (!session) {
      return {
        identityLinked: Boolean(principal.userId),
        settings,
        viewer: { status: "no_session" }
      };
    }
    const state = input.store.getParticipationState(principal.channelId);
    const activeEntries = input.store.getActiveParticipationQueue(principal.channelId);
    const viewerIndex = principal.userId
      ? activeEntries.findIndex((entry) => entry.twitchUserId === principal.userId)
      : -1;
    const viewerEntry = viewerIndex >= 0 ? activeEntries[viewerIndex] : undefined;
    const maxQueueSize = session.maxQueueSize ?? PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE;
    const status = session.status === "completed"
      ? "ended" as const
      : !state.isOpen || session.status === "closed"
        ? "paused" as const
        : viewerEntry && ["selected", "checked_in", "invited", "in_game"].includes(viewerEntry.status)
          ? "next" as const
          : viewerEntry
            ? "joined" as const
            : activeEntries.length >= maxQueueSize
              ? "full" as const
              : "active" as const;
    return {
      identityLinked: Boolean(principal.userId),
      settings,
      viewer: {
        status,
        game: session.game === "palworld" ? "Palworld" : "League of Legends",
        waitingCount: activeEntries.length,
        ...(viewerIndex >= 0 ? { myPosition: viewerIndex + 1 } : {})
      }
    };
  }

  async function joinTwitchExtensionParticipation(
    req: IncomingMessage,
    principal: TwitchExtensionPrincipal
  ): Promise<{
    ok: true;
    alreadyJoined: boolean;
    viewer: Awaited<ReturnType<typeof twitchExtensionViewerResponse>>;
  }> {
    const twitchUserId = principal.userId!;
    const body = strictJsonObject(
      await readJsonBody<unknown>(req),
      ["riotId", "role", "palworldNickname"]
    );
    const session = input.store.getParticipationSession(principal.channelId);
    const state = input.store.getParticipationState(principal.channelId);
    if (
      !session
      || !["recruiting", "in_game"].includes(session.status)
      || !state.isOpen
    ) {
      throw new HttpRequestError(409, {
        error: "현재 시청자 참여 대기열이 닫혀 있습니다.",
        code: "SESSION_CLOSED"
      });
    }

    const previousViewerEntry = input.store.getParticipationQueue(principal.channelId)
      .filter((entry) => entry.twitchUserId === twitchUserId)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];
    if (
      ["played", "skipped"].includes(previousViewerEntry?.status ?? "")
      && session.allowRejoin === false
    ) {
      throw new HttpRequestError(409, {
        error: "이 참여 세션은 재참여를 허용하지 않습니다.",
        code: "REJOIN_NOT_ALLOWED"
      });
    }

    const duplicateLookup = { twitchUserId };
    if (input.store.findParticipationDuplicate(duplicateLookup, principal.channelId)) {
      return {
        ok: true,
        alreadyJoined: true,
        viewer: await twitchExtensionViewerResponse(principal)
      };
    }
    const maxQueueSize = session.maxQueueSize ?? PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE;
    if (input.store.getActiveParticipationCount(principal.channelId) >= maxQueueSize) {
      throw new HttpRequestError(409, {
        error: "참여 대기열이 가득 찼습니다.",
        code: "QUEUE_FULL"
      });
    }

    let parsedRiotId: { gameName: string; tagLine: string } | undefined;
    let role: LolRole = "fill";
    let palworldNickname = "";
    if (session.game === "palworld") {
      palworldNickname = typeof body.palworldNickname === "string"
        ? body.palworldNickname.trim()
        : previousViewerEntry?.game === "palworld"
          ? previousViewerEntry.palworldNickname ?? ""
          : "";
      if (!palworldNickname || palworldNickname.length > 32) {
        throw new HttpRequestError(400, {
          error: "Palworld 닉네임은 1자 이상 32자 이하여야 합니다.",
          code: "PROFILE_REQUIRED"
        });
      }
    } else {
      const riotId = typeof body.riotId === "string"
        ? body.riotId
        : previousViewerEntry?.riotGameName && previousViewerEntry.riotTagLine
          ? formatRiotId(previousViewerEntry.riotGameName, previousViewerEntry.riotTagLine)
          : "";
      const parsed = parseRiotIdDetailed(riotId);
      if (!parsed.ok) {
        throw new HttpRequestError(400, {
          error: "Riot ID가 필요합니다. YORO.gg 참가 페이지에서 먼저 프로필을 등록해주세요.",
          code: "PROFILE_REQUIRED"
        });
      }
      parsedRiotId = { gameName: parsed.gameName, tagLine: parsed.tagLine };
      const normalizedRole = normalizeLolRole(
        typeof body.role === "string" ? body.role : previousViewerEntry?.preferredRole
      );
      role = normalizedRole === "unknown" ? "fill" : normalizedRole;
    }

    const twitchProfile = await input.twitch?.getUserProfile(twitchUserId).catch(() => undefined);
    const twitchUserName = twitchProfile?.displayName
      || twitchProfile?.login
      || previousViewerEntry?.twitchUserName
      || "Twitch 시청자";
    const previousProfile = parsedRiotId
      ? input.store.findReusableParticipationProfile({
          riotGameName: parsedRiotId.gameName,
          riotTagLine: parsedRiotId.tagLine
        }, principal.channelId)
      : undefined;
    const profileReady = previousProfile?.profileStatus === "ready"
      || Boolean(previousProfile?.rankedStats);
    const entry = input.store.makeParticipationEntry(session.game === "palworld" ? {
      twitchUserId,
      twitchUserName,
      game: "palworld",
      palworldNickname,
      status: "waitlisted",
      source: "dashboard",
      joinedFrom: "twitch_extension"
    } : {
      twitchUserId,
      twitchUserName,
      game: "lol",
      riotGameName: parsedRiotId!.gameName,
      riotTagLine: parsedRiotId!.tagLine,
      ...(previousProfile?.riotPuuid ? { riotPuuid: previousProfile.riotPuuid } : {}),
      requestedRole: role,
      preferredRole: role,
      ...(previousProfile?.rankedStats ? { rankedStats: previousProfile.rankedStats } : {}),
      profileStatus: previousProfile?.profileStatus ?? "pending",
      ...(previousProfile?.mainRole ? { mainRole: previousProfile.mainRole } : {}),
      ...(typeof previousProfile?.mainRoleConfidence === "number"
        ? { mainRoleConfidence: previousProfile.mainRoleConfidence }
        : {}),
      ...(previousProfile?.topChampions?.length
        ? { topChampions: previousProfile.topChampions.map((champion) => ({ ...champion })) }
        : {}),
      status: profileReady ? "verified" : "waitlisted",
      source: "dashboard",
      joinedFrom: "twitch_extension"
    });

    const latestSession = input.store.getParticipationSession(principal.channelId);
    if (
      !latestSession
      || !["recruiting", "in_game"].includes(latestSession.status)
      || !input.store.getParticipationState(principal.channelId).isOpen
    ) {
      throw new HttpRequestError(409, {
        error: "현재 시청자 참여 대기열이 닫혀 있습니다.",
        code: "SESSION_CLOSED"
      });
    }
    if (input.store.findParticipationDuplicate(duplicateLookup, principal.channelId)) {
      return {
        ok: true,
        alreadyJoined: true,
        viewer: await twitchExtensionViewerResponse(principal)
      };
    }
    if (
      input.store.getActiveParticipationCount(principal.channelId)
      >= (latestSession.maxQueueSize ?? PUBLIC_PARTICIPATION_MAX_QUEUE_SIZE)
    ) {
      throw new HttpRequestError(409, {
        error: "참여 대기열이 가득 찼습니다.",
        code: "QUEUE_FULL"
      });
    }
    const saved = input.store.reactivateReusableParticipation(entry, principal.channelId);
    await broadcastParticipationQueue(
      { store: input.store, actions: input.actions },
      "twitch.extension_participation_join",
      principal.channelId
    ).catch(() => undefined);
    if (session.game === "lol" && input.refreshLolProfile && saved.entry.profileStatus !== "ready") {
      void input.refreshLolProfile(saved.entry.id, principal.channelId).catch(() => undefined);
    }
    if (session.game === "lol") {
      invalidatePublicLolProfileCachesForRiotId(saved.entry.riotGameName, saved.entry.riotTagLine);
    }
    return {
      ok: true,
      alreadyJoined: false,
      viewer: await twitchExtensionViewerResponse(principal)
    };
  }

  async function cancelTwitchExtensionParticipation(
    req: IncomingMessage,
    principal: TwitchExtensionPrincipal
  ): Promise<{
    ok: true;
    viewer: Awaited<ReturnType<typeof twitchExtensionViewerResponse>>;
  }> {
    strictJsonObject(await readJsonBody<unknown>(req), []);
    const result = participationRepository.cancel(principal.userId!, principal.channelId);
    if (!result.ok) {
      throw new HttpRequestError(result.reason === "in_game" ? 409 : 404, {
        error: result.reason === "in_game"
          ? "이미 게임 진행 상태라 참여 취소를 할 수 없습니다."
          : "취소할 참여 신청을 찾지 못했습니다.",
        code: result.reason === "in_game" ? "CANCEL_NOT_AVAILABLE" : "PARTICIPATION_NOT_FOUND"
      });
    }
    invalidatePublicLolProfileCachesForRiotId(result.entry.riotGameName, result.entry.riotTagLine);
    await broadcastParticipationQueue(
      { store: input.store, actions: input.actions },
      "twitch.extension_participation_cancel",
      principal.channelId
    ).catch(() => undefined);
    return {
      ok: true,
      viewer: await twitchExtensionViewerResponse(principal)
    };
  }

  async function checkInPublicParticipation(req: IncomingMessage, publicSessionId: string): Promise<PublicParticipationStateResponse> {
    const status = await getPublicTwitchViewerStatus(req);
    if (!status.connected || !status.user) {
      throw new HttpRequestError(401, { error: "Twitch 로그인 후 참여 확인을 할 수 있습니다.", code: "LOGIN_REQUIRED" });
    }
    const session = participationRepository.getSession(publicSessionId);
    if (!session) throw new HttpRequestError(404, { error: "참여 세션을 찾을 수 없습니다.", code: "SESSION_NOT_FOUND" });
    strictJsonObject(await readJsonBody<unknown>(req), []);
    const result = participationRepository.checkIn(status.user.id, session.streamerId);
    if (!result.ok) {
      const code = result.reason === "expired" ? "CHECK_IN_EXPIRED" : "CHECK_IN_NOT_AVAILABLE";
      throw new HttpRequestError(409, { error: result.reason === "expired" ? "참여 확인 시간이 만료되었습니다." : "참여 확인 대상이 아닙니다.", code });
    }
    await broadcastParticipationQueue(
      { store: input.store, actions: input.actions },
      "public.participation_check_in",
      session.streamerId
    ).catch(() => undefined);
    return getPublicParticipationState(req, status, session.streamerId, session.publicSessionId);
  }

  async function skipPublicParticipation(req: IncomingMessage, publicSessionId: string): Promise<PublicParticipationCancelResponse> {
    const status = await getPublicTwitchViewerStatus(req);
    if (!status.connected || !status.user) {
      throw new HttpRequestError(401, { error: "Twitch 로그인 후 이번 순서를 건너뛸 수 있습니다.", code: "LOGIN_REQUIRED" });
    }
    const session = participationRepository.getSession(publicSessionId);
    if (!session) throw new HttpRequestError(404, { error: "참여 세션을 찾을 수 없습니다.", code: "SESSION_NOT_FOUND" });
    strictJsonObject(await readJsonBody<unknown>(req), []);
    const result = participationRepository.skip(status.user.id, session.streamerId);
    if (!result.ok) {
      throw new HttpRequestError(409, {
        error: result.reason === "not_selected" ? "현재 체크인 순서가 아닙니다." : "건너뛸 참여 신청을 찾지 못했습니다.",
        code: result.reason === "not_selected" ? "SKIP_NOT_AVAILABLE" : "PARTICIPATION_NOT_FOUND"
      });
    }
    invalidatePublicLolProfileCachesForRiotId(result.entry.riotGameName, result.entry.riotTagLine);
    await broadcastParticipationQueue(
      { store: input.store, actions: input.actions },
      "public.participation_skip",
      session.streamerId
    ).catch(() => undefined);
    return {
      ok: true,
      state: await getPublicParticipationState(req, status, session.streamerId, session.publicSessionId)
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

  async function getPublicTwitchViewerStatus(req: IncomingMessage): Promise<PublicTwitchViewerStatusResponse> {
    const yoroContext = input.yoroAccounts
      ? await input.yoroAccounts
          .getTwitchAccessContext(requestCookie(req, YORO_SESSION_COOKIE))
          .catch(() => undefined)
      : undefined;
    if (yoroContext) {
      const status = {
        connected: true,
        configured: true,
        requiredScopes: [...TWITCH_PUBLIC_VIEWER_SCOPES],
        missingScopes: [],
        user: yoroContext.user,
        tokenExpiresAt: yoroContext.tokenExpiresAt
      };
      const streamerRiotRequest = currentStreamerRiotIdRequestForTwitchUser(
        yoroContext.user.id
      );
      return streamerRiotRequest ? { ...status, streamerRiotRequest } : status;
    }
    if (!input.publicTwitchAuth) {
      return {
        connected: false,
        configured: false,
        requiredScopes: [...TWITCH_PUBLIC_VIEWER_SCOPES],
        missingScopes: [...TWITCH_PUBLIC_VIEWER_SCOPES]
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
      if (input.yoroAccounts) {
        await input.yoroAccounts.adoptTwitchViewerSession(
          requestCookie(req, YORO_SESSION_COOKIE),
          session
        ).catch(() => {
          input.logger?.error?.({
            type: "yoro.account.twitch_credential_adoption_failed"
          });
        });
      }
      return sendRedirect(res, state.returnUrl || publicLolReturnUrlForRequest(req), { "Set-Cookie": publicTwitchViewerSessionCookie(session) });
    } catch {
      return sendSafeOAuthHtml(res, 400, "Twitch 연결 실패", "Twitch token 교환 또는 사용자 정보 조회에 실패했습니다. 서버 설정을 확인한 뒤 다시 시도해주세요.");
    }
  }

  async function buildPublicLolSuggestions(rawQuery: string, routing: LolRoutingContext): Promise<PublicLolSuggestion[]> {
    const query = rawQuery.trim().normalize("NFKC").replace(/＃/g, "#");
    if (query.length < 2) return [];
    const unique = new Map<string, PublicLolSuggestion>();
    for (const suggestion of publicLolSuggestionCache.values()) {
      if (suggestion.lolPlatform === routing.lolPlatform && publicLolSuggestionMatches(query, suggestion)) {
        unique.set(publicLolSuggestionKey(suggestion.gameName, suggestion.tagLine, suggestion.lolPlatform), suggestion);
      }
    }
    const defaultRouting = publicLolRouting(undefined, input.riot);
    if (routing.lolPlatform === defaultRouting.lolPlatform) {
      for (const profile of input.profileRepository?.searchByText(query, 8) ?? []) {
        const suggestion = await profileCacheEntryToSuggestion(profile, routing);
        unique.set(publicLolSuggestionKey(suggestion.gameName, suggestion.tagLine, suggestion.lolPlatform), suggestion);
      }
    }

    if (query.includes("#") && input.riot?.isConfigured()) {
      const parsed = parseRiotIdDetailed(query);
      if (parsed.ok) {
        const account = await input.riot.getAccountByRiotId(parsed.gameName, parsed.tagLine, routing).catch(() => null);
        if (account?.puuid) {
          const verified = await verifyPublicLolPlatformMembership(account.puuid, routing).catch(() => false);
          if (verified) {
            const now = new Date().toISOString();
            const rankedStats = typeof input.riot.getRankedStatsByPuuid === "function"
              ? await input.riot.getRankedStatsByPuuid(account.puuid, undefined, routing).catch(() => undefined)
              : undefined;
            const iconUrl = await profileIconUrl(input.dataDragon, rankedStats?.profileIconId);
            const key = publicLolSuggestionKey(account.gameName || parsed.gameName, account.tagLine || parsed.tagLine, routing.lolPlatform);
            unique.set(key, {
              riotId: `${account.gameName || parsed.gameName}#${account.tagLine || parsed.tagLine}`,
              gameName: account.gameName || parsed.gameName,
              tagLine: account.tagLine || parsed.tagLine,
              source: "verified",
              profileIconUrl: iconUrl,
              summonerLevel: rankedStats?.summonerLevel,
              lolPlatform: routing.lolPlatform,
              rankedStats: rankedStats ? { ...rankedStats } : undefined,
              lastSeenAt: now
            });
          }
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
    dataDragonVersion: string | undefined
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
    /* playerAugment1~6 — 값이 있는 슬롯만 픽 순서대로. 증강 없는 큐에서는 필드 생략. */
    const augments = participantAugments(participant);
    /* 아레나 필드는 전부 리스트 요약에 넣습니다.
       arenaTeams 를 상세(teams 하이드레이션)로 미룰 수 없는 이유: 프런트가
       PublicLolPage.tsx 에서 `match.arenaTeams` 를 읽는데, 하이드레이션 병합은
       `{ ...match, teams: matchDetail.teams }` 로 teams 만 옮깁니다. 상세로 내리면
       값이 UI 까지 도달하지 않습니다.
       비아레나 경기에는 셋 다 붙지 않으므로 기존 5v5 응답 크기는 그대로입니다. */
    const arena = isArenaMatch(match);
    const arenaPlacement = arena ? participantPlacement(participant) : undefined;
    const arenaSubteamId = arena && typeof participant.playerSubteamId === "number"
      ? participant.playerSubteamId
      : undefined;
    const arenaTeams = arena
      ? await arenaTeamsFromMatch(input.dataDragon, match, targetPuuid, dataDragonVersion)
      : undefined;
    return {
      matchId: match.metadata.matchId,
      ...(augments.length > 0 ? { augments } : {}),
      ...(arenaPlacement === undefined ? {} : { placement: arenaPlacement }),
      ...(arenaSubteamId === undefined ? {} : { subteamId: arenaSubteamId }),
      ...(arenaTeams ? { arenaTeams } : {}),
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
      items: await participantItems(input.dataDragon, participant, dataDragonVersion),
      summonerSpells: participantSummonerSpells(participant),
      runes: await participantRunes(input.dataDragon, dataDragonVersion, participant),
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
      /* 행의 아군/상대 2열(경량 요약) — 아레나는 arenaTeams 가 전담하므로 비웁니다.
         풀 팀 상세(아이템·지표·시청 스트림)는 기존대로 match-detail 하이드레이션. */
      teams: arena ? [] : await publicLolMatchTeamsListSummary(input.dataDragon, match, targetPuuid)
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

  async function getPublicLolMatchDetail(matchId: string, routing?: LolRoutingContext): Promise<RiotMatch | null> {
    if (!input.riot) throw new HttpRequestError(503, { error: "Riot API client를 사용할 수 없습니다." });
    const cacheKey = matchId.trim().toUpperCase();
    if (!cacheKey) return null;
    const cached = publicLolMatchDetailCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.match;
    if (cached) publicLolMatchDetailCache.delete(cacheKey);
    const running = publicLolMatchDetailInFlight.get(cacheKey);
    if (running) return running;

    const request = input.riot.getMatch(matchId, publicLolMatchRouting(matchId, routing))
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

  /* 패치별 내 전적.
   *
   * 경기의 gameVersion 이 Data Dragon 과 같은 major.minor 라서 패치 노트와 그대로
   * 이어집니다. 표본은 최근 PATCH_PLAY_SAMPLE_LIMIT 경기로 못 박습니다 —
   * 방문자 한 명이 Riot 호출을 무한정 늘릴 수 없어야 합니다.
   */
  async function buildPatchPlaySummary(
    rawRiotId: string,
    routing: LolRoutingContext
  ): Promise<PatchPlaySummary> {
    const parsed = parseRiotIdDetailed(rawRiotId);
    if (!parsed.ok) throw new HttpRequestError(400, { error: parsed.message, code: parsed.code });
    if (!input.riot) throw new HttpRequestError(503, { error: "Riot API client를 사용할 수 없습니다." });
    if (!input.riot.isConfigured()) throw new HttpRequestError(503, { error: "Riot API key가 설정되어 있지 않습니다." });

    const cacheKey = publicLolProfileCacheKey(parsed.gameName, parsed.tagLine, routing.lolPlatform);
    const cached = patchPlaySummaryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.summary;
    if (cached) patchPlaySummaryCache.delete(cacheKey);
    const running = patchPlaySummaryInFlight.get(cacheKey);
    if (running) return running;

    const request = (async (): Promise<PatchPlaySummary> => {
      const riot = input.riot;
      if (!riot) throw new HttpRequestError(503, { error: "Riot API client를 사용할 수 없습니다." });
      const account = await riot.getAccountByRiotId(parsed.gameName, parsed.tagLine, routing).catch((error) => {
        throw new HttpRequestError(502, { error: publicLolErrorMessage(error) });
      });
      if (!account?.puuid) throw new HttpRequestError(404, { error: "Riot 계정을 찾지 못했습니다." });
      await requirePublicLolPlatformMembership(account.puuid, routing);

      const matchIds = await riot.getRecentMatchIdsByPuuid(
        account.puuid,
        PATCH_PLAY_SAMPLE_LIMIT,
        [...PUBLIC_LOL_MATCH_QUEUE_IDS.all],
        0,
        routing
      ).catch(() => []);
      const matches = (await Promise.all(
        matchIds.slice(0, PATCH_PLAY_SAMPLE_LIMIT).map((matchId) => getPublicLolMatchDetail(matchId, routing).catch(() => null))
      ))
        .filter((match): match is RiotMatch => Boolean(match))
        .filter(isPublicLolQueue);

      const samples = matches
        .map((match) => {
          const participant = match.info.participants.find((item) => item.puuid === account.puuid);
          /* 승패를 모르는 경기는 표본에서 뺍니다. 추측해서 승률을 만들지 않습니다. */
          if (!participant || typeof participant.win !== "boolean") return undefined;
          /* championId 는 이미 손에 든 participant 에 있습니다 — 최다 사용 챔피언
             집계에 Riot 호출이 더 들지 않는 이유입니다. */
          return {
            gameVersion: match.info.gameVersion,
            won: participant.win,
            ...(typeof participant.championId === "number" ? { championId: participant.championId } : {})
          };
        })
        .filter((sample): sample is {
          gameVersion: string | undefined;
          won: boolean;
          championId?: number;
        } => Boolean(sample));

      const summary: PatchPlaySummary = Object.freeze({
        schemaVersion: 1 as const,
        gameName: account.gameName || parsed.gameName,
        tagLine: account.tagLine || parsed.tagLine,
        lolPlatform: routing.lolPlatform,
        sampledMatches: samples.length,
        fetchedAt: new Date().toISOString(),
        patches: Object.freeze(patchPlayRecords(samples))
      });
      patchPlaySummaryCache.set(cacheKey, { summary, expiresAt: Date.now() + PATCH_PLAY_CACHE_TTL_MS });
      pruneMapToMax(patchPlaySummaryCache, PUBLIC_LOL_PROFILE_CACHE_MAX);
      return summary;
    })().finally(() => {
      patchPlaySummaryInFlight.delete(cacheKey);
    });
    patchPlaySummaryInFlight.set(cacheKey, request);
    return request;
  }

  async function buildPublicLolMatchPageForAccount(
    account: { puuid: string },
    matchStart: number,
    dataDragonVersion: string | undefined,
    matchCount = PUBLIC_LOL_PROFILE_MATCH_COUNT,
    routing?: LolRoutingContext,
    queueFilter: PublicLolMatchQueueFilter = "all"
  ): Promise<{
    rawMatches: RiotMatch[];
    recentMatches: PublicLolRecentMatch[];
    recentMatchStart: number;
    nextRecentMatchStart?: number;
    hasMoreRecentMatches: boolean;
  }> {
    if (!input.riot) throw new HttpRequestError(503, { error: "Riot API client를 사용할 수 없습니다." });
    const safeStart = publicLolMatchStart(matchStart);
    const queueIds = [...PUBLIC_LOL_MATCH_QUEUE_IDS[queueFilter]];
    /* ID 조회는 요청 페이지 크기 + 1 — 상수(11) 고정이면 초기 페이지 크기
       (PUBLIC_LOL_PROFILE_INITIAL_MATCH_COUNT=20)를 키워도 11개만 조회되던 결함. */
    const matchIds = await input.riot.getRecentMatchIdsByPuuid(
      account.puuid,
      matchCount + 1,
      queueIds,
      safeStart,
      routing
    ).catch(() => []);
    const detailResults = await Promise.all(
      matchIds.slice(0, matchCount).map((matchId) => getPublicLolMatchDetail(matchId, routing).catch(() => null))
    );
    const fetchedDetails = detailResults.filter((match): match is RiotMatch => Boolean(match));
    /* ID 는 있는데 상세가 전부 실패하면(레이트 리밋·상류 장애) 빈 목록으로 위장하지 않습니다 —
       "전적 없음"이 아니라 오류+재시도가 맞습니다. 큐 필터로 0이 되는 정상 경우와 구분합니다. */
    if (matchIds.length > 0 && fetchedDetails.length === 0) {
      throw new HttpRequestError(503, { error: "Riot 매치 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
    const rawMatches = fetchedDetails
      .filter(isPublicLolQueue)
      .sort((a, b) => publicLolMatchSortTime(b) - publicLolMatchSortTime(a))
      .slice(0, matchCount);
    const recentMatches = (await Promise.all(
      rawMatches.map(async (match) => publicLolRecentMatchFromRiotMatch(
        match,
        account.puuid,
        await dataDragonVersionForMatch(input.dataDragon, match, dataDragonVersion)
      ))
    )).filter((match): match is PublicLolRecentMatch => Boolean(match));
    const hasMoreRecentMatches = matchIds.length > matchCount;
    return {
      rawMatches,
      recentMatches,
      recentMatchStart: safeStart,
      nextRecentMatchStart: hasMoreRecentMatches ? safeStart + matchCount : undefined,
      hasMoreRecentMatches
    };
  }

  function currentGameCacheTtl(response: PublicLolCurrentGame): number {
    if (response.status === "live") return PUBLIC_LOL_CURRENT_GAME_LIVE_CACHE_TTL_MS;
    if (response.status === "not_found") return PUBLIC_LOL_CURRENT_GAME_NOT_FOUND_CACHE_TTL_MS;
    return PUBLIC_LOL_CURRENT_GAME_ERROR_CACHE_TTL_MS;
  }

  function checkingPublicLolCurrentGame(lolPlatform: string | undefined): PublicLolCurrentGame {
    return {
      isLive: false,
      status: "checking",
      lolPlatform,
      participants: [],
      fetchedAt: new Date().toISOString()
    };
  }

  function currentGameParticipantRiotId(participant: RiotCurrentGameInfo["participants"][number]): string | undefined {
    if (participant.riotId) return participant.riotId;
    if (participant.riotIdGameName && participant.riotIdTagline) return `${participant.riotIdGameName}#${participant.riotIdTagline}`;
    return participant.summonerName;
  }

  async function currentGameParticipantRankedStats(
    participant: RiotCurrentGameInfo["participants"][number],
    riotId: string | undefined,
    fetchedAt: string,
    routing: LolRoutingContext
  ): Promise<LolRankedStats | undefined> {
    let rankedStats: LolRankedStats | undefined;
    if (riotId) {
      const parsed = parseRiotIdDetailed(riotId);
      rankedStats = parsed.ok ? cachedRankedStatsForRiotId(parsed.gameName, parsed.tagLine) : undefined;
    }
    if (!rankedStats && participant.puuid && input.riot && typeof input.riot.getRankedStatsByPuuid === "function") {
      rankedStats = await input.riot.getRankedStatsByPuuid(participant.puuid, undefined, routing).catch(() => undefined);
    }
    rememberPublicLolParticipantRank(riotId, rankedStats, fetchedAt);
    return rankedStats ? { ...rankedStats } : undefined;
  }

  async function buildPublicLolCurrentGame(targetPuuid: string, routing: LolRoutingContext): Promise<PublicLolCurrentGame> {
    const fetchedAt = new Date().toISOString();
    const base = { lolPlatform: routing.lolPlatform, fetchedAt };
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
    const game = await input.riot.getCurrentGameByPuuid(targetPuuid, routing).catch((error) => {
      if (error instanceof RiotApiHttpError && error.status === 404) return null;
      input.logger?.error({
        type: "public_lol.current_game_lookup_failed",
        lolPlatform: routing.lolPlatform,
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
          currentGameParticipantRankedStats(participant, riotId, fetchedAt, routing),
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

  async function getPublicLolCurrentGame(cacheKey: string, targetPuuid: string, routing: LolRoutingContext): Promise<PublicLolCurrentGame> {
    const cached = publicLolCurrentGameCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.response;
    if (cached) publicLolCurrentGameCache.delete(cacheKey);

    const running = publicLolCurrentGameInFlight.get(cacheKey);
    if (running) return running;

    const request = buildPublicLolCurrentGame(targetPuuid, routing)
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
    const routing = publicLolRouting(response.lolPlatform, input.riot);
    const [liveGame, twitchStream] = await Promise.all([
      targetPuuid ? getPublicLolCurrentGame(key, targetPuuid, routing).catch(() => response.liveGame) : Promise.resolve(response.liveGame),
      buildPublicLolTwitchStream(response.gameName, response.tagLine).catch(() => response.twitchStream)
    ]);
    return { ...response, liveGame, twitchStream };
  }

  async function getPublicLolProfileDynamicState(rawRiotId: string, routing: LolRoutingContext): Promise<PublicLolProfileDynamicResponse> {
    const parsed = parseRiotIdDetailed(rawRiotId);
    if (!parsed.ok) throw new HttpRequestError(400, { error: parsed.message, code: parsed.code });
    const key = publicLolProfileCacheKey(parsed.gameName, parsed.tagLine, routing.lolPlatform);
    const cached = publicLolProfileCache.get(key);
    if (!cached) {
      throw new HttpRequestError(404, {
        error: "먼저 전적을 검색해 주세요.",
        code: "LOL_PROFILE_NOT_CACHED"
      });
    }
    const response = await withFreshPublicLolDynamicState(cached.response, key);
    cached.response = response;
    return {
      status: "ready",
      riotId: response.riotId,
      twitchStream: response.twitchStream,
      liveGame: response.liveGame,
      fetchedAt: new Date().toISOString()
    };
  }

  async function buildPublicLolProfile(rawRiotId: string, routing: LolRoutingContext): Promise<PublicLolProfileResponse> {
    const startedAt = Date.now();
    const parsed = parseRiotIdDetailed(rawRiotId);
    if (!parsed.ok) throw new HttpRequestError(400, { error: parsed.message, code: parsed.code });
    if (!input.riot) throw new HttpRequestError(503, { error: "Riot API client를 사용할 수 없습니다." });
    if (!input.riot.isConfigured()) throw new HttpRequestError(503, { error: "Riot API key가 설정되어 있지 않습니다." });

    const account = await input.riot.getAccountByRiotId(parsed.gameName, parsed.tagLine, routing).catch((error) => {
      throw new HttpRequestError(502, { error: publicLolErrorMessage(error) });
    });
    if (!account?.puuid) throw new HttpRequestError(404, { error: "Riot 계정을 찾지 못했습니다." });
    await requirePublicLolPlatformMembership(account.puuid, routing);
    const accountResolvedAt = Date.now();

    const existingProfile = input.profileRepository?.getByPuuid(account.puuid) ?? input.profileRepository?.getByRiotId(account.gameName || parsed.gameName, account.tagLine || parsed.tagLine);
    const requestedCacheKey = publicLolProfileCacheKey(parsed.gameName, parsed.tagLine, routing.lolPlatform);
    const responseCacheKey = publicLolProfileCacheKey(account.gameName || parsed.gameName, account.tagLine || parsed.tagLine, routing.lolPlatform);
    publicLolProfilePuuidCache.set(requestedCacheKey, account.puuid);
    publicLolProfilePuuidCache.set(responseCacheKey, account.puuid);
    pruneMapToMax(publicLolProfilePuuidCache, PUBLIC_LOL_PROFILE_CACHE_MAX * 2);
    const rankedQueuesRequest: Promise<PublicLolRankedQueues> = typeof input.riot.getRankedQueueStatsByPuuid === "function"
      ? input.riot.getRankedQueueStatsByPuuid(account.puuid, routing).catch((): PublicLolRankedQueues => ({}))
      : input.riot.getRankedStatsByPuuid(account.puuid, undefined, routing).then((stats): PublicLolRankedQueues => ({
        solo: stats?.queueType === "RANKED_SOLO_5x5" ? stats : undefined,
        flex: stats?.queueType === "RANKED_FLEX_SR" ? stats : undefined,
        ranked5v5: stats?.queueType === "RANKED_TEAM_5x5" ? stats : undefined,
        primary: stats
      })).catch((): PublicLolRankedQueues => ({}));
    const dataDragonVersionRequest = dataDragonLatestVersion(input.dataDragon);
    const [rankedQueues, mastery, dataDragonVersion] = await Promise.all([
      rankedQueuesRequest,
      input.riot.getChampionMasteryTopByPuuid(account.puuid, PUBLIC_LOL_PROFILE_TOP_CHAMPION_COUNT, routing).catch(() => []),
      dataDragonVersionRequest
    ]);
    const coreDataResolvedAt = Date.now();
    const rankedStats = rankedQueues.primary;
    const topChampionsRequest = Promise.all(mastery.slice(0, PUBLIC_LOL_PROFILE_TOP_CHAMPION_COUNT).map((champion) => mapChampionSummary(input.dataDragon, {
      championId: champion.championId,
      masteryLevel: champion.championLevel,
      masteryPoints: champion.championPoints
    })));
    const [matchPage, topChampions, resolvedProfileIconUrl] = await Promise.all([
      buildPublicLolMatchPageForAccount(account, 0, dataDragonVersion, PUBLIC_LOL_PROFILE_INITIAL_MATCH_COUNT, routing),
      topChampionsRequest,
      profileIconUrl(input.dataDragon, rankedStats?.profileIconId)
    ]);
    const matchContentResolvedAt = Date.now();
    const matches = matchPage.rawMatches;

    /* 프로필 첫 화면의 경기 목록에도 다시보기를 붙입니다 — 더 보기로 받은 다음
       페이지에만 버튼이 생기면 같은 목록에서 행마다 달라 보입니다. */
    const visibleRecentMatches = await withPublicLolReplays(
      matchPage.recentMatches,
      account.gameName || parsed.gameName,
      account.tagLine || parsed.tagLine
    );
    const recentWins = visibleRecentMatches.filter((match) => match.result === "win").length;
    const recentKills = visibleRecentMatches.reduce((sum, match) => sum + match.kills, 0);
    const recentDeaths = visibleRecentMatches.reduce((sum, match) => sum + match.deaths, 0);
    const recentAssists = visibleRecentMatches.reduce((sum, match) => sum + match.assists, 0);

    const fetchedAt = new Date().toISOString();
    const rankHistory = buildRankHistory(existingProfile?.rankHistory, rankedStats, fetchedAt);
    const response: PublicLolProfileResponse = {
      status: "ready",
      riotId: `${account.gameName || parsed.gameName}#${account.tagLine || parsed.tagLine}`,
      gameName: account.gameName || parsed.gameName,
      tagLine: account.tagLine || parsed.tagLine,
      accountRegion: routing.accountRegion,
      lolPlatform: routing.lolPlatform,
      profileIconUrl: resolvedProfileIconUrl,
      summonerLevel: rankedStats?.summonerLevel,
      ladderRank: existingProfile?.ladderRank,
      rankedStats,
      rankedQueues: {
        solo: rankedQueues.solo,
        flex: rankedQueues.flex,
        ranked5v5: rankedQueues.ranked5v5
      },
      rankHistory,
      performanceStats: performanceStatsFromMatches(matches, account.puuid),
      frequentTeammates: frequentTeammatesFromMatches(matches, account.puuid),
      roleAnalysis: inferMainRoleFromMatches(matches, account.puuid, 45),
      topChampions,
      recentMatches: visibleRecentMatches,
      liveGame: checkingPublicLolCurrentGame(routing.lolPlatform),
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
    input.logger?.event?.({
      type: "public_lol.profile_built",
      riotIdKey: responseCacheKey,
      matchCount: visibleRecentMatches.length,
      responseBytes: Buffer.byteLength(JSON.stringify(response), "utf8"),
      accountMs: accountResolvedAt - startedAt,
      coreDataMs: coreDataResolvedAt - accountResolvedAt,
      matchContentMs: matchContentResolvedAt - coreDataResolvedAt,
      durationMs: Date.now() - startedAt,
      dynamicStateDeferred: true
    });
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
    publicLolParticipantRankCacheInvalidatedAt = Date.now();
    publicLolMatchBuildCache.clear();
    publicLolMatchBuildInFlight.clear();
    publicLolMatchTeamsCache.clear();
    publicLolMatchTeamsInFlight.clear();
  }

  function invalidatePublicLolProfileCachesForStreamer(request: StreamerRiotIdRequest | undefined): void {
    if (!request?.riotGameName || !request.riotTagLine) return;
    invalidatePublicLolProfileCachesForRiotId(request.riotGameName, request.riotTagLine);
  }

  /* 승인된 스트리머(StreamerRiotIdRequest)가 아니라도 참여 큐 등록으로 다시보기
     후보(buildPublicLolTwitchStream의 participation 소스)가 바뀌는 경로가 있다 —
     참여 신청/변경 시 이 함수로 캐시를 무효화하지 않으면, 이미 캐시된(최대 24h)
     프로필에는 새로 연결된 twitchUserId가 반영되지 않아 다시보기 버튼이
     그 시간 동안 나타나지 않는다(실사용자 보고, 2026-08-28). */
  function invalidatePublicLolProfileCachesForRiotId(gameName: string | undefined, tagLine: string | undefined): void {
    if (!gameName || !tagLine) return;
    const routing = publicLolRouting(input.riot?.routingStatus().lolPlatform, input.riot);
    invalidatePublicLolProfileCaches(publicLolProfileCacheKey(gameName, tagLine, routing.lolPlatform));
  }

  /* 채팅 명령(!join)을 포함한 모든 참여 신청 경로가 이 이벤트를 발행한다
     (participation.module.ts::emitEntryCreated) — 웹/Extension 참여 신청의
     직접 호출(위 두 지점)과 달리 채팅 경로는 http-api.ts와 완전히 분리된
     봇 모듈이라 직접 호출할 수 없어, 이미 존재하는 전역 EventBus 구독으로
     커버한다(lol-profile-enrichment.module.ts와 같은 패턴). */
  input.events?.on<ParticipationEntryCreatedInternalEvent>("participation.entryCreated", (event) => {
    invalidatePublicLolProfileCachesForRiotId(event.riotGameName, event.riotTagLine);
  });

  /* 채팅 명령(!cancel 등)으로 참여를 취소/거절할 때도 같은 이유로 EventBus
     구독이 필요하다 — 웹/Extension/대시보드 경로는 위에서 직접 호출로
     커버했다(2026-08-29 개선 방안 점검). */
  input.events?.on<ParticipationEntryRemovedInternalEvent>("participation.entryRemoved", (event) => {
    invalidatePublicLolProfileCachesForRiotId(event.riotGameName, event.riotTagLine);
  });

  function startPublicLolProfileBuild(key: string, riotId: string, routing: LolRoutingContext): Promise<PublicLolProfileResponse> {
    const running = publicLolProfileInFlight.get(key);
    if (running) return running;
    const cacheGeneration = publicLolProfileCacheGeneration.get(key) ?? 0;
    const request = buildPublicLolProfile(riotId, routing)
      .then((response) => {
        if ((publicLolProfileCacheGeneration.get(key) ?? 0) === cacheGeneration) {
          const now = Date.now();
          publicLolProfileCache.set(key, {
            response,
            expiresAt: now + PUBLIC_LOL_PROFILE_CACHE_TTL_MS,
            staleUntil: now + PUBLIC_LOL_PROFILE_STALE_TTL_MS
          });
          pruneMapToMax(publicLolProfileCache, PUBLIC_LOL_PROFILE_CACHE_MAX);
        }
        return response;
      })
      .finally(() => {
        publicLolProfileInFlight.delete(key);
      });
    publicLolProfileInFlight.set(key, request);
    return request;
  }

  async function getPublicLolProfile(rawRiotId: string, routing: LolRoutingContext, options: { refresh?: boolean } = {}): Promise<PublicLolProfileResponse> {
    const parsed = parseRiotIdDetailed(rawRiotId);
    if (!parsed.ok) throw new HttpRequestError(400, { error: parsed.message, code: parsed.code });
    const key = publicLolProfileCacheKey(parsed.gameName, parsed.tagLine, routing.lolPlatform);
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
    let cached = publicLolProfileCache.get(key);
    if (!options.refresh && !cached && input.publicLolSnapshotStore) {
      const snapshotKeys = routing.lolPlatform === "jp1"
        ? [
            key,
            legacyPublicLolProfileCacheKey(parsed.gameName, parsed.tagLine, routing.lolPlatform),
            publicLolSuggestionKey(parsed.gameName, parsed.tagLine),
          ]
        : [key];
      let snapshot: Awaited<ReturnType<PublicLolSnapshotStore["load"]>>;
      let restoredSnapshotKey = key;
      for (const snapshotKey of snapshotKeys) {
        snapshot = await input.publicLolSnapshotStore.load(snapshotKey).catch((error) => {
          input.logger?.error({
            type: "public_lol.snapshot_load_failed",
            riotIdKey: snapshotKey,
            error: toSafeErrorMessage(error)
          });
          return undefined;
        });
        if (snapshot) {
          restoredSnapshotKey = snapshotKey;
          break;
        }
      }
      if (
        snapshot
        && isPublicLolProfileSnapshot(snapshot.payload)
        && snapshot.payload.fetchedAt === snapshot.fetchedAt
        && snapshot.payload.lolPlatform === routing.lolPlatform
      ) {
        const fetchedAtMs = Date.parse(snapshot.fetchedAt);
        const ageMs = Date.now() - fetchedAtMs;
        if (ageMs >= -5 * 60_000 && ageMs < PUBLIC_LOL_PROFILE_STALE_TTL_MS) {
          const restoredResponse = await withFreshPublicLolSnapshotReplays(snapshot.payload);
          cached = {
            response: restoredResponse,
            expiresAt: fetchedAtMs + PUBLIC_LOL_PROFILE_CACHE_TTL_MS,
            staleUntil: fetchedAtMs + PUBLIC_LOL_PROFILE_STALE_TTL_MS
          };
          publicLolProfileCache.set(key, cached);
          publicLolProfilePuuidCache.set(key, snapshot.puuid);
          pruneMapToMax(publicLolProfileCache, PUBLIC_LOL_PROFILE_CACHE_MAX);
          pruneMapToMax(publicLolProfilePuuidCache, PUBLIC_LOL_PROFILE_CACHE_MAX * 2);
          input.logger?.event?.({
            type: "public_lol.snapshot_restored",
            riotIdKey: restoredSnapshotKey,
            cacheKey: key,
            stale: cached.expiresAt <= Date.now()
          });
        }
      }
    }
    const now = Date.now();
    if (!options.refresh && cached && cached.expiresAt > now) {
      return withPublicLolRefreshState(cached.response, key);
    }
    const riotId = `${parsed.gameName}#${parsed.tagLine}`;
    if (!options.refresh && cached && cached.staleUntil > now) {
      const refresh = startPublicLolProfileBuild(key, riotId, routing);
      void refresh.catch((error) => {
        input.logger?.error({
          type: "public_lol.profile_background_refresh_failed",
          riotIdKey: key,
          error: toSafeErrorMessage(error)
        });
      });
      return withPublicLolRefreshState(cached.response, key);
    }
    if (cached) publicLolProfileCache.delete(key);
    return withPublicLolRefreshState(await startPublicLolProfileBuild(key, riotId, routing), key);
  }

  async function buildPublicLolMatchPage(
    rawRiotId: string,
    start: number,
    routing: LolRoutingContext,
    queueFilter: PublicLolMatchQueueFilter = "all"
  ): Promise<PublicLolMatchPageResponse> {
    const startedAt = Date.now();
    const parsed = parseRiotIdDetailed(rawRiotId);
    if (!parsed.ok) throw new HttpRequestError(400, { error: parsed.message, code: parsed.code });
    if (!input.riot) throw new HttpRequestError(503, { error: "Riot API client를 사용할 수 없습니다." });
    if (!input.riot.isConfigured()) throw new HttpRequestError(503, { error: "Riot API key가 설정되어 있지 않습니다." });

    const profileKey = publicLolProfileCacheKey(parsed.gameName, parsed.tagLine, routing.lolPlatform);
    const cachedProfile = publicLolProfileCache.get(profileKey);
    const cachedPuuid = publicLolProfilePuuidCache.get(profileKey);
    const canReuseVerifiedIdentity = Boolean(
      cachedProfile
      && cachedProfile.staleUntil > Date.now()
      && cachedProfile.response.lolPlatform === routing.lolPlatform
      && cachedPuuid
    );
    const account = canReuseVerifiedIdentity && cachedProfile && cachedPuuid
      ? {
          puuid: cachedPuuid,
          gameName: cachedProfile.response.gameName,
          tagLine: cachedProfile.response.tagLine
        }
      : await input.riot.getAccountByRiotId(parsed.gameName, parsed.tagLine, routing).catch((error) => {
          throw new HttpRequestError(502, { error: publicLolErrorMessage(error) });
        });
    if (!account?.puuid) throw new HttpRequestError(404, { error: "Riot 계정을 찾지 못했습니다." });
    if (!canReuseVerifiedIdentity) await requirePublicLolPlatformMembership(account.puuid, routing);

    const dataDragonVersion = await dataDragonLatestVersion(input.dataDragon);
    const matchPage = await buildPublicLolMatchPageForAccount(
      account,
      start,
      dataDragonVersion,
      PUBLIC_LOL_PROFILE_MATCH_COUNT,
      routing,
      queueFilter
    );
    const recentMatches = await withPublicLolReplays(
      matchPage.recentMatches,
      account.gameName || parsed.gameName,
      account.tagLine || parsed.tagLine
    );
    const response: PublicLolMatchPageResponse = {
      status: "ready",
      riotId: `${account.gameName || parsed.gameName}#${account.tagLine || parsed.tagLine}`,
      gameName: account.gameName || parsed.gameName,
      tagLine: account.tagLine || parsed.tagLine,
      accountRegion: routing.accountRegion,
      lolPlatform: routing.lolPlatform,
      recentMatches,
      recentMatchStart: matchPage.recentMatchStart,
      nextRecentMatchStart: matchPage.nextRecentMatchStart,
      hasMoreRecentMatches: matchPage.hasMoreRecentMatches,
      fetchedAt: new Date().toISOString()
    };
    input.logger?.event?.({
      type: "public_lol.match_page_built",
      queueFilter,
      recentMatchStart: matchPage.recentMatchStart,
      matchCount: recentMatches.length,
      replayCount: recentMatches.filter((match) => match.replay).length,
      identitySource: canReuseVerifiedIdentity ? "profile_cache" : "riot_api",
      durationMs: Date.now() - startedAt
    });
    return response;
  }

  async function getPublicLolMatchPage(
    rawRiotId: string,
    start: number,
    routing: LolRoutingContext,
    queueFilter: PublicLolMatchQueueFilter = "all"
  ): Promise<PublicLolMatchPageResponse> {
    const parsed = parseRiotIdDetailed(rawRiotId);
    if (!parsed.ok) throw new HttpRequestError(400, { error: parsed.message, code: parsed.code });
    const safeStart = publicLolMatchStart(start);
    const cacheKey = `${publicLolProfileCacheKey(parsed.gameName, parsed.tagLine, routing.lolPlatform)}:matches:${queueFilter}:${safeStart}`;
    const cached = publicLolMatchPageCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.response;
    if (cached) publicLolMatchPageCache.delete(cacheKey);

    const running = publicLolMatchPageInFlight.get(cacheKey);
    if (running) return running;

    const request = buildPublicLolMatchPage(`${parsed.gameName}#${parsed.tagLine}`, safeStart, routing, queueFilter)
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

    const routing = publicLolMatchRouting(matchId);
    const match = await getPublicLolMatchDetail(matchId, routing).catch((error) => {
      throw new HttpRequestError(502, { error: publicLolErrorMessage(error) });
    });
    if (!match) throw new HttpRequestError(404, { error: "경기 상세 정보를 찾지 못했습니다." });

    const fetchedAt = new Date().toISOString();
    async function rankedParticipant(participant: RiotMatchParticipant): Promise<PublicLolMatchRankParticipant> {
      const riotId = participantRiotId(participant);
      let rankedStats: LolRankedStats | undefined;
      if (riotId) {
        const parsed = parseRiotIdDetailed(riotId);
        rankedStats = parsed.ok ? cachedRankedStatsForRiotId(parsed.gameName, parsed.tagLine) : undefined;
      }
      if (!rankedStats && typeof input.riot?.getRankedStatsByPuuidWithoutSummoner === "function") {
        rankedStats = await input.riot.getRankedStatsByPuuidWithoutSummoner(participant.puuid, undefined, routing).catch(() => undefined);
      } else if (!rankedStats) {
        rankedStats = await input.riot?.getRankedStatsByPuuid(participant.puuid, undefined, routing).catch(() => undefined);
      }
      if (!rankedStats && riotId) {
        const parsed = parseRiotIdDetailed(riotId);
        rankedStats = parsed.ok
          ? cachedRankedStatsForRiotId(parsed.gameName, parsed.tagLine, { allowStale: true })
          : undefined;
      }
      rememberPublicLolParticipantRank(riotId, rankedStats, fetchedAt);
      return {
        riotId,
        teamId: participant.teamId,
        championId: participant.championId,
        position: participant.individualPosition || participant.teamPosition,
        rankedStats: rankedStats ? { ...rankedStats } : undefined
      };
    }

    const participants: PublicLolMatchRankParticipant[] = [];
    const participantConcurrency = 2;
    for (let offset = 0; offset < match.info.participants.length; offset += participantConcurrency) {
      participants.push(...await Promise.all(
        match.info.participants.slice(offset, offset + participantConcurrency).map(rankedParticipant)
      ));
    }

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
          nameEn: ability?.nameEn,
          iconUrl: ability?.iconUrl
        };
      });
  }

  async function buildPublicLolMatchBuild(matchId: string): Promise<PublicLolMatchBuildResponse> {
    if (!input.riot) throw new HttpRequestError(503, { error: "Riot API client를 사용할 수 없습니다." });
    if (!input.riot.isConfigured()) throw new HttpRequestError(503, { error: "Riot API key가 설정되어 있지 않습니다." });

    const routing = publicLolMatchRouting(matchId);
    const match = await getPublicLolMatchDetail(matchId, routing).catch((error) => {
      throw new HttpRequestError(502, { error: publicLolErrorMessage(error) });
    });
    if (!match) throw new HttpRequestError(404, { error: "경기 상세 정보를 찾지 못했습니다." });

    const timeline = await input.riot.getMatchTimeline(match.metadata.matchId || matchId, routing).catch(() => null);
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
        items: await participantItems(input.dataDragon, participant, dataDragonVersion),
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
    const matchId = validPublicLolMatchId(rawMatchId);
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

  function validPublicLolMatchId(rawMatchId: string): string {
    const matchId = rawMatchId.trim();
    if (!matchId || matchId.length > 96 || !/^[A-Z0-9_]+$/i.test(matchId)) {
      throw new HttpRequestError(400, { error: "올바르지 않은 match id입니다.", code: "INVALID_MATCH_ID" });
    }
    return matchId;
  }

  async function buildPublicLolMatchTeams(rawMatchId: string, rawRiotId: string): Promise<PublicLolMatchTeamsResponse> {
    if (!input.riot) throw new HttpRequestError(503, { error: "Riot API client를 사용할 수 없습니다." });
    if (!input.riot.isConfigured()) throw new HttpRequestError(503, { error: "Riot API key가 설정되어 있지 않습니다." });

    const matchId = validPublicLolMatchId(rawMatchId);
    const parsedRiotId = parseRiotIdDetailed(rawRiotId);
    if (!parsedRiotId.ok) {
      throw new HttpRequestError(400, { error: "올바르지 않은 Riot ID입니다.", code: "INVALID_RIOT_ID" });
    }
    const targetRiotIdKey = normalizeRiotIdKey(parsedRiotId.gameName, parsedRiotId.tagLine);
    const cacheKey = `${matchId.toUpperCase()}:${targetRiotIdKey}`;
    const cached = publicLolMatchTeamsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.response;
    if (cached) publicLolMatchTeamsCache.delete(cacheKey);
    const running = publicLolMatchTeamsInFlight.get(cacheKey);
    if (running) return running;

    const request = (async (): Promise<PublicLolMatchTeamsResponse> => {
      const match = await getPublicLolMatchDetail(matchId).catch((error) => {
        throw new HttpRequestError(502, { error: publicLolErrorMessage(error) });
      });
      if (!match) throw new HttpRequestError(404, { error: "경기 상세 정보를 찾지 못했습니다." });
      const target = match.info.participants.find((participant) => {
        const riotId = participantRiotId(participant);
        if (!riotId) return false;
        const parsed = parseRiotIdDetailed(riotId);
        return parsed.ok && normalizeRiotIdKey(parsed.gameName, parsed.tagLine) === targetRiotIdKey;
      });
      if (!target) throw new HttpRequestError(404, { error: "경기에서 플레이어를 찾지 못했습니다." });

      const streamerByRiotId = await buildApprovedStreamerStreamsByRiotId(
        match.info.participants.map((participant) => participantRiotId(participant))
      );
      const fallbackDataDragonVersion = await dataDragonLatestVersion(input.dataDragon);
      const dataDragonVersion = await dataDragonVersionForMatch(input.dataDragon, match, fallbackDataDragonVersion);
      const response: PublicLolMatchTeamsResponse = {
        status: "ready",
        matchId: match.metadata.matchId || matchId,
        teams: await publicLolMatchTeams(input.dataDragon, dataDragonVersion, match, target.puuid, streamerByRiotId),
        fetchedAt: new Date().toISOString()
      };
      publicLolMatchTeamsCache.set(cacheKey, {
        response,
        expiresAt: Date.now() + PUBLIC_LOL_MATCH_TEAMS_CACHE_TTL_MS
      });
      pruneMapToMax(publicLolMatchTeamsCache, PUBLIC_LOL_MATCH_CACHE_MAX);
      return response;
    })().finally(() => {
      publicLolMatchTeamsInFlight.delete(cacheKey);
    });
    publicLolMatchTeamsInFlight.set(cacheKey, request);
    return request;
  }

  async function getPublicLolMatchRanks(rawMatchId: string): Promise<PublicLolMatchRankResponse> {
    const matchId = validPublicLolMatchId(rawMatchId);

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

  async function refreshFollowerManagementForOwner(
    broadcasterUserId: string,
    rawLimit: string | null
  ): Promise<{
    response: FollowerManagementResponse;
    headers?: Record<string, string>;
  }> {
    if (rawLimit !== null && !/^\d{1,5}$/u.test(rawLimit)) {
      throw new HttpRequestError(400, {
        error: "limit은 1 이상 5000 이하의 정수여야 합니다.",
        code: "INVALID_FOLLOWER_LIMIT"
      });
    }
    const limit = rawLimit === null ? 5000 : Number(rawLimit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5000) {
      throw new HttpRequestError(400, {
        error: "limit은 1 이상 5000 이하의 정수여야 합니다.",
        code: "INVALID_FOLLOWER_LIMIT"
      });
    }
    const runtime = followerRefreshRuntime(broadcasterUserId);
    if (runtime.inFlight) {
      if (runtime.lastState) {
        runtime.lastState = await followerManagementResponse(broadcasterUserId);
        return {
          response: runtime.lastState,
          headers: { "X-StreamOps-Cache": "in-flight" }
        };
      }
      try {
        return {
          response: await runtime.inFlight,
          headers: { "X-StreamOps-Cache": "in-flight" }
        };
      } catch (error) {
        if (error instanceof HttpRequestError) throw error;
        throw new HttpRequestError(502, {
          error: "Twitch 팔로워 목록을 갱신하지 못했습니다.",
          code: "FOLLOWER_REFRESH_FAILED"
        });
      }
    }
    if (runtime.lastState && Date.now() < runtime.availableAt) {
      runtime.lastState = await followerManagementResponse(broadcasterUserId);
      return {
        response: runtime.lastState,
        headers: {
          "X-StreamOps-Cache": "cooldown",
          "Retry-After": retryAfterSeconds(runtime.availableAt)
        }
      };
    }
    const refresh = refreshFollowerSnapshot(broadcasterUserId, limit, runtime);
    runtime.inFlight = refresh;
    try {
      return { response: await refresh };
    } catch (error) {
      if (error instanceof HttpRequestError) throw error;
      throw new HttpRequestError(502, {
        error: "Twitch 팔로워 목록을 갱신하지 못했습니다.",
        code: "FOLLOWER_REFRESH_FAILED"
      });
    } finally {
      runtime.inFlight = undefined;
    }
  }

  /* 이 대상이 지금 무엇을 보내야 하는지 계산합니다.
   *
   * 별도 job 테이블 없이, 마지막으로 보낸 내용(discord_participation_messages)과
   * 현재 참여 상태를 비교해 필요한 것만 만듭니다. 편집 최소 간격 30초도 여기서
   * 강제합니다 — 봇의 절제에 맡기지 않습니다. */
  function announcementSessionId(
    target: { streamerTwitchUserId: string }
  ): string | undefined {
    return input.store
      .getParticipationSession(target.streamerTwitchUserId)?.publicSessionId;
  }

  function announcementJobFor(
    target: AnnouncementDispatchTarget
  ): DiscordAnnouncementJob | undefined {
    const session = input.store.getParticipationSession(target.streamerTwitchUserId);
    if (!session) return undefined;
    const state: "recruiting" | "closed" = session.status === "recruiting"
      ? "recruiting"
      : "closed";
    /* 아직 아무것도 안 올렸는데 이미 끝난 세션이면 새로 만들지 않습니다. */
    if (!target.messageId && state === "closed") return undefined;

    const participation = input.store.getParticipationState(target.streamerTwitchUserId);
    /* followers 한정 세션은 인원을 싣지 않습니다. 팔로워 전용이라는 의도를
       공개 채널에서 깨지 않기 위해서입니다. */
    const publicCounts = session.listingVisibility !== "followers";
    const waiting = publicCounts ? participation.summary.waiting : undefined;
    const selected = publicCounts ? participation.summary.selected : undefined;

    if (target.messageId) {
      const stateSame = target.lastState === state;
      const waitingSame = (target.lastWaiting ?? undefined) === waiting;
      if (stateSame && waitingSame) return undefined;
      if (stateSame && target.lastEditedAt) {
        const elapsed = Date.now() - Date.parse(target.lastEditedAt);
        if (Number.isFinite(elapsed) && elapsed < ANNOUNCEMENT_MIN_EDIT_INTERVAL_MS) {
          return undefined;
        }
      }
    }

    const profile = session.profileSnapshot;
    return Object.freeze({
      jobId: target.targetId,
      guildId: target.discordGuildId,
      channelId: target.channelId,
      ...(target.mentionRoleId ? { mentionRoleId: target.mentionRoleId } : {}),
      ...(target.messageId ? { messageId: target.messageId } : {}),
      locale: target.preferredLocale,
      state,
      streamerDisplayName: profile?.profile?.displayName
        ?? profile?.riotGameName
        ?? "YORO",
      participationUrl: new URL(
        `/participation?session=${encodeURIComponent(session.publicSessionId)}`,
        appConfig.publicBaseUrl
      ).toString(),
      ...(waiting === undefined ? {} : { waiting }),
      ...(selected === undefined ? {} : { selected })
    });
  }

  /* ── 반응속도 기록 헬퍼 ────────────────────────────────────────
   * 계정당 등록 쿨다운. 프로세스 메모리라 재시작하면 풀립니다 — 남용 억제가
   * 목적이고 단일 인스턴스 운영이라 이 수준이면 충분합니다. */
  const reactionSubmitAvailableAt = new Map<string, number>();

  /** 로그인한 사용자면 userId·표시 이름을, 아니면 undefined. */
  async function reactionViewer(
    req: IncomingMessage
  ): Promise<{ userId: string; displayName?: string; avatarUrl?: string } | undefined> {
    if (!input.yoroAccounts) return undefined;
    const sessionCookie = requestCookie(req, YORO_SESSION_COOKIE);
    if (!sessionCookie) return undefined;
    const [authenticated, account] = await Promise.all([
      input.yoroAccounts.authenticateForManagement(sessionCookie),
      input.yoroAccounts.session(sessionCookie)
    ]);
    if (!authenticated) return undefined;
    const twitch = account?.identities.find((identity) => identity.provider === "twitch");
    return {
      userId: authenticated.userId,
      ...(twitch?.displayName ? { displayName: twitch.displayName } : {}),
      ...(twitch?.avatarUrl ? { avatarUrl: twitch.avatarUrl } : {})
    };
  }

  /**
   * 변경 요청용. 로그인 + 신뢰 Origin 을 요구합니다.
   *
   * 다른 계정 mutation 과 달리 x-yoro-csrf 를 요구하지 않습니다: 세션 쿠키가
   * SameSite=Lax 라 크로스 사이트 POST 에는 쿠키 자체가 실리지 않고, 여기에
   * Origin 검사를 더하면 토큰 없이도 CSRF 가 성립하지 않습니다. 프런트 계약
   * (features/public-games/api.ts)이 헤더를 보내지 않아 요구하면 전 요청이
   * 403 이 됩니다 — 프런트가 헤더를 붙이면 이 함수도 토큰 검사를 켜야 합니다.
   */
  async function requireReactionViewer(req: IncomingMessage): Promise<{ userId: string; displayName?: string }> {
    if (!stateChangingRequestHasTrustedOrigin(req)) {
      throw new HttpRequestError(403, { error: "trusted Origin이 필요합니다.", code: "origin_denied" });
    }
    const viewer = await reactionViewer(req);
    if (!viewer) {
      throw new HttpRequestError(401, {
        error: "YORO 계정 로그인이 필요합니다.",
        code: "session_required"
      });
    }
    return viewer;
  }

  /** 리더보드 1행. identity 에 따라 이름 또는 익명 라벨만 내보냅니다.
      공개 기록인데 Twitch 이름을 못 찾으면(연동 해제 등) 익명 라벨로 떨어집니다 —
      이름 없는 빈 칸을 내보내는 것보다 안전합니다. */
  function reactionLeaderboardEntry(row: {
    rank: number;
    identity: "public" | "anonymous";
    anonymousNo: number;
    averageMs: number;
    displayName?: string;
  }): Record<string, unknown> {
    const tier = reactionTierForAverage(row.averageMs);
    const named = row.identity === "public" && row.displayName;
    return {
      rank: row.rank,
      ...(named ? { displayName: row.displayName } : { anonymousLabel: reactionAnonymousLabel(row.anonymousNo) }),
      averageMs: row.averageMs,
      tierKey: tier.key
    };
  }

  /** 공유 링크 응답. 계정 식별자는 어떤 형태로도 넣지 않습니다(§④-5). */
  async function reactionSharedRecord(shareId: string): Promise<Record<string, unknown> | undefined> {
    if (!input.reactionRecords) return undefined;
    const record = await input.reactionRecords.findByShareId(shareId);
    if (!record) return undefined;
    const stats = await input.reactionRecords.stats();
    const percentile = reactionPercentile(record.rank, stats.total);
    const tier = reactionTierForAverage(record.averageMs);
    const named = record.identity === "public" && record.displayName;
    return {
      averageMs: record.averageMs,
      tierKey: tier.key,
      ...(named
        ? { displayName: record.displayName }
        : { anonymousLabel: reactionAnonymousLabel(record.anonymousNo) }),
      ...(percentile === undefined ? {} : { percentile }),
      at: record.updatedAt
    };
  }

  /* LIVE 와 프로필 이미지는 Twitch 에만 있는 값입니다. 캐시와 실패 처리는
     이 서비스가 갖고 있고, 여기서는 결과만 씁니다. */
  const streamerBoardChannels = new StreamerBoardChannelService(input.twitch);

  /* ── 스트리머 추천 게시판 ──────────────────────────────────────────
   *
   * 신원은 Twitch 계정입니다. 공개 화면의 로그인 상태가 두 가지(YORO 계정 세션과
   * 공개 Twitch 뷰어 세션)인데 둘 다 Twitch 사용자를 주기 때문입니다. 계정 세션만
   * 인정하면 LoL 화면에서 Twitch 로 로그인한 사람은 글쓰기 화면이 열려 있는데
   * 저장만 401 로 실패합니다 — getPublicTwitchViewerStatus 가 두 경로를 이미
   * 하나로 합쳐 줍니다.
   */

  /* 추천 글의 전적 요약.
   *
   * 리그 오브 레전드 글에만 붙습니다. 전체 프로필(getPublicLolProfile)은 경기
   * 목록까지 만들어 무겁기 때문에, 여기서는 계정 조회 1회 + 랭크 조회 1회로 끝나는
   * 경로만 씁니다. 그래도 목록 한 번에 여러 건이 될 수 있으므로 캐시와 상한을 둡니다 —
   * 게시판이 커졌다고 Riot 호출이 같이 늘면 다른 화면의 예산까지 먹습니다.
   */
  const streamerBoardRankCache = new Map<string, { value?: LolRankedStats; expiresAt: number }>();
  const STREAMER_BOARD_RANK_TTL_MS = 30 * 60 * 1000;
  const STREAMER_BOARD_RANK_MAX_LOOKUPS = 6;
  const STREAMER_BOARD_RANK_CACHE_MAX = 200;

  async function streamerBoardRankedStats(
    riotId: string,
    budget: { remaining: number }
  ): Promise<LolRankedStats | undefined> {
    const key = riotId.trim().toLocaleLowerCase();
    const cached = streamerBoardRankCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    /* 예산을 다 썼으면 이번 요청에서는 붙이지 않습니다 — 다음 요청에서 채워집니다.
       화면은 전적 줄 없이 게임 표기까지만 그리므로 깨지지 않습니다. */
    if (budget.remaining <= 0 || !input.riot?.isConfigured()) return cached?.value;

    budget.remaining -= 1;
    const parsed = parseRiotIdDetailed(riotId);
    if (!parsed.ok) {
      streamerBoardRankCache.set(key, { expiresAt: Date.now() + STREAMER_BOARD_RANK_TTL_MS });
      return undefined;
    }
    const routing = publicLolRouting(undefined, input.riot);
    const value = await (async () => {
      const account = await input.riot?.getAccountByRiotId(parsed.gameName, parsed.tagLine, routing);
      if (!account?.puuid) return undefined;
      return typeof input.riot?.getRankedStatsByPuuidWithoutSummoner === "function"
        ? input.riot.getRankedStatsByPuuidWithoutSummoner(account.puuid, undefined, routing)
        : input.riot?.getRankedStatsByPuuid(account.puuid, undefined, routing);
    })().catch(() => undefined);

    streamerBoardRankCache.set(key, { value, expiresAt: Date.now() + STREAMER_BOARD_RANK_TTL_MS });
    pruneMapToMax(streamerBoardRankCache, STREAMER_BOARD_RANK_CACHE_MAX);
    return value;
  }

  /** 화면 계약에 맞춘 최소 형태. 티어 표기는 프런트가 다른 LoL 화면과 같은 규칙으로 만듭니다. */
  async function streamerBoardLolProfile(
    post: StreamerBoardPostRow,
    budget: { remaining: number }
  ): Promise<Record<string, unknown> | undefined> {
    if (!post.riotId || !post.games.includes("lol")) return undefined;
    const stats = await streamerBoardRankedStats(post.riotId, budget);
    if (!stats) return undefined;
    return {
      riotId: post.riotId,
      tier: stats.tier,
      ...(stats.rank ? { rank: stats.rank } : {}),
      leaguePoints: stats.leaguePoints,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.winRate
    };
  }

  function requireStreamerBoard(): StreamerBoardRepository {
    if (!input.streamerBoard) {
      throw new HttpRequestError(503, {
        error: "추천 게시판을 사용할 수 없습니다.",
        code: "feature_unavailable"
      });
    }
    return input.streamerBoard;
  }

  /**
   * 지금 방송 중인 채널 키. Twitch 조회가 실패하면 빈 목록이고 화면에는 LIVE 배지가
   * 사라질 뿐입니다 — 게시판이 Twitch 장애에 같이 넘어가지 않아야 합니다.
   */
  async function streamerBoardLiveChannelKeys(): Promise<string[]> {
    if (!input.streamerBoard) return [];
    try {
      const channelKeys = await input.streamerBoard.twitchChannelKeys();
      return await streamerBoardChannels.liveChannelKeys(channelKeys);
    } catch {
      return [];
    }
  }

  async function streamerBoardViewer(
    req: IncomingMessage
  ): Promise<{ twitchUserId: string; displayName: string } | undefined> {
    const status = await getPublicTwitchViewerStatus(req).catch(() => undefined);
    if (!status?.connected || !status.user?.id) return undefined;
    return {
      twitchUserId: status.user.id,
      displayName: status.user.displayName || status.user.login
    };
  }

  /** 변경 요청용. 로그인 + 신뢰 Origin 을 요구합니다(반응속도 기록과 같은 규칙). */
  async function requireStreamerBoardViewer(
    req: IncomingMessage
  ): Promise<{ twitchUserId: string; displayName: string }> {
    if (!stateChangingRequestHasTrustedOrigin(req)) {
      throw new HttpRequestError(403, { error: "trusted Origin이 필요합니다.", code: "origin_denied" });
    }
    const viewer = await streamerBoardViewer(req);
    if (!viewer) {
      throw new HttpRequestError(401, {
        error: "Twitch 로그인이 필요합니다.",
        code: "session_required"
      });
    }
    return viewer;
  }

  /**
   * 공개 응답 1건. channelKey 는 내부 값이라 내보내지 않고, 작성자 식별자도 넣지
   * 않습니다(표시 이름만).
   *
   * channelUrl 은 로그인한 사람에게만 실립니다 — 목업의 표시 규칙입니다.
   */
  function streamerBoardPostPayload(
    post: StreamerBoardPostRow,
    options: { signedIn: boolean; live: boolean; lolProfile?: Record<string, unknown> }
  ): Record<string, unknown> {
    return {
      id: post.id,
      streamerName: post.streamerName,
      platform: post.platform,
      ...(options.signedIn ? { channelUrl: post.channelUrl } : {}),
      /* 같은 origin 경로입니다 — 시청자 브라우저가 Twitch CDN 에 직접 붙지 않습니다.
         Twitch 채널이 아니면 이미지가 없고 화면이 플랫폼 마크로 떨어집니다. */
      ...(twitchLoginForChannelKey(post.channelKey)
        ? { profileImageUrl: `/api/public/streamers/${post.id}/avatar` }
        : {}),
      live: options.live,
      games: [...post.games],
      tags: [...post.tags],
      votes: post.votes,
      voted: post.voted,
      commentCount: post.commentCount,
      authorName: post.authorName,
      createdAt: post.createdAt,
      /* 전적 줄은 리그 오브 레전드 글에만 붙습니다 — 다른 게임은 게임 표기까지입니다. */
      ...(options.lolProfile ? { lolProfile: options.lolProfile } : {})
    };
  }

  function streamerBoardCommentPayload(comment: StreamerBoardCommentRow): Record<string, unknown> {
    return {
      id: comment.id,
      anonymous: comment.anonymous,
      ...(comment.authorName ? { authorName: comment.authorName } : {}),
      body: comment.body,
      createdAt: comment.createdAt
    };
  }

  async function getStreamerBoardList(req: IncomingMessage, url: URL): Promise<Record<string, unknown>> {
    const board = requireStreamerBoard();
    const query = parseStreamerListQuery(url.searchParams);
    const viewer = await streamerBoardViewer(req);
    /* LIVE 는 DB 에 없는 값입니다. 지금 방송 중인 채널을 먼저 받아 두고, liveOnly
       필터일 때는 그 목록으로 좁힙니다. 조회가 실패하면 LIVE 없이 나갑니다 —
       게시판이 Twitch 장애에 같이 넘어가지 않아야 합니다. */
    const liveKeys = await streamerBoardLiveChannelKeys();
    const result = await board.list(query, viewer?.twitchUserId, liveKeys);
    const budget = { remaining: STREAMER_BOARD_RANK_MAX_LOOKUPS };
    const posts = await Promise.all(result.posts.map(async (post) => {
      const lolProfile = await streamerBoardLolProfile(post, budget);
      return streamerBoardPostPayload(post, {
        signedIn: Boolean(viewer),
        live: liveKeys.includes(post.channelKey),
        ...(lolProfile ? { lolProfile } : {})
      });
    }));
    return { total: result.total, liveCount: result.liveCount, posts };
  }

  async function getStreamerBoardPost(req: IncomingMessage, postId: string): Promise<Record<string, unknown>> {
    const board = requireStreamerBoard();
    const viewer = await streamerBoardViewer(req);
    const post = await board.findPost(postId, viewer?.twitchUserId);
    if (!post) {
      throw new HttpRequestError(404, { error: "추천 글을 찾을 수 없습니다.", code: "post_not_found" });
    }
    const [comments, liveKeys] = await Promise.all([
      board.comments(postId),
      streamerBoardLiveChannelKeys()
    ]);
    const lolProfile = await streamerBoardLolProfile(post, { remaining: 1 });
    return {
      post: streamerBoardPostPayload(post, {
        signedIn: Boolean(viewer),
        live: liveKeys.includes(post.channelKey),
        ...(lolProfile ? { lolProfile } : {})
      }),
      comments: comments.map(streamerBoardCommentPayload)
    };
  }

  /** 글의 채널 프로필 이미지. 글이 없거나 Twitch 채널이 아니면 undefined 입니다. */
  async function streamerBoardAvatar(postId: string) {
    if (!input.streamerBoard) return undefined;
    const post = await input.streamerBoard.findPost(postId);
    if (!post) return undefined;
    return streamerBoardChannels.avatar(post.channelKey);
  }

  async function createStreamerBoardPost(req: IncomingMessage): Promise<Record<string, unknown>> {
    const board = requireStreamerBoard();
    const viewer = await requireStreamerBoardViewer(req);
    const draft = parseStreamerPostDraft(await readJsonBody<unknown>(req));
    if (!draft) {
      throw new HttpRequestError(400, {
        error: "채널 주소와 주력 게임을 확인해 주세요.",
        code: "invalid_request"
      });
    }
    try {
      const post = await board.createPost(draft, viewer);
      return { post: streamerBoardPostPayload(post, { signedIn: true, live: false }) };
    } catch (error) {
      if (error instanceof StreamerChannelTakenError) {
        /* 한 채널은 글 하나입니다. 화면이 그 글로 안내할 수 있게 알려 줍니다. */
        throw new HttpRequestError(409, {
          error: "이미 등록된 채널입니다.",
          code: "duplicate_channel",
          existing: error.existing
        });
      }
      throw error;
    }
  }

  async function voteStreamerBoardPost(req: IncomingMessage, postId: string): Promise<Record<string, unknown>> {
    const board = requireStreamerBoard();
    const viewer = await requireStreamerBoardViewer(req);
    const result = await board.vote(postId, viewer.twitchUserId);
    if (!result) {
      throw new HttpRequestError(404, { error: "추천 글을 찾을 수 없습니다.", code: "post_not_found" });
    }
    return { votes: result.votes, voted: true };
  }

  async function createStreamerBoardComment(
    req: IncomingMessage,
    postId: string
  ): Promise<Record<string, unknown>> {
    const board = requireStreamerBoard();
    const viewer = await requireStreamerBoardViewer(req);
    const draft = parseStreamerCommentDraft(await readJsonBody<unknown>(req));
    if (!draft) {
      throw new HttpRequestError(400, { error: "댓글 내용을 확인해 주세요.", code: "invalid_request" });
    }
    const comment = await board.createComment(postId, draft, viewer);
    if (!comment) {
      throw new HttpRequestError(404, { error: "추천 글을 찾을 수 없습니다.", code: "post_not_found" });
    }
    return { comment: streamerBoardCommentPayload(comment) };
  }

  async function reportStreamerBoardComment(
    req: IncomingMessage,
    postId: string,
    commentId: string
  ): Promise<Record<string, unknown>> {
    const board = requireStreamerBoard();
    const viewer = await requireStreamerBoardViewer(req);
    const reason = parseStreamerReportReason(await readJsonBody<unknown>(req));
    if (!reason) {
      throw new HttpRequestError(400, { error: "신고 사유를 확인해 주세요.", code: "invalid_request" });
    }
    const accepted = await board.reportComment(postId, commentId, reason, viewer.twitchUserId);
    if (!accepted) {
      throw new HttpRequestError(404, { error: "댓글을 찾을 수 없습니다.", code: "comment_not_found" });
    }
    /* 이미 신고한 댓글인지는 알려 주지 않습니다 — 신고 여부가 새면 떠볼 수 있습니다. */
    return { reported: true };
  }

  async function yoroStreamerContext(
    req: IncomingMessage,
    mutation = false
  ): Promise<{
    csrfToken: string;
    userId: string;
    account: NonNullable<Awaited<ReturnType<YoroAccountService["session"]>>>;
    twitch?: NonNullable<Awaited<ReturnType<YoroAccountService["getTwitchAccessContext"]>>>;
  }> {
    if (!input.yoroAccounts) {
      throw new HttpRequestError(503, {
        error: "YORO 계정 기능을 사용할 수 없습니다.",
        code: "feature_unavailable"
      });
    }
    const sessionCookie = requestCookie(req, YORO_SESSION_COOKIE);
    const [authenticated, account, twitch] = await Promise.all([
      input.yoroAccounts.authenticateForManagement(sessionCookie),
      input.yoroAccounts.session(sessionCookie),
      input.yoroAccounts.getTwitchAccessContext(sessionCookie)
    ]);
    if (!authenticated || !account) {
      throw new HttpRequestError(401, {
        error: "YORO Dashboard 로그인이 필요합니다.",
        code: "session_required"
      });
    }
    if (mutation) {
      if (!stateChangingRequestHasTrustedOrigin(req)) {
        throw new HttpRequestError(403, {
          error: "trusted Origin이 필요합니다.",
          code: "origin_denied"
        });
      }
      const csrfToken = requestHeaderValue(req, "x-yoro-csrf");
      if (!csrfToken || !tokenMatches(authenticated.csrfToken, csrfToken)) {
        throw new HttpRequestError(403, {
          error: "CSRF token이 필요합니다.",
          code: "csrf_required"
        });
      }
    }
    return {
      csrfToken: authenticated.csrfToken,
      userId: authenticated.userId,
      account,
      ...(twitch ? { twitch } : {})
    };
  }

  function requireApprovedYoroStreamer(
    context: Awaited<ReturnType<typeof yoroStreamerContext>>
  ): {
    twitch: NonNullable<typeof context.twitch>;
    streamer: StreamerRiotIdRequest;
  } {
    if (!context.twitch) {
      throw new HttpRequestError(409, {
        error: "연결된 Twitch 계정의 기본 권한을 다시 승인해주세요.",
        code: "TWITCH_PERMISSION_REQUIRED"
      });
    }
    const streamer = approvedStreamerRiotIdForTwitchUser(context.twitch.userId);
    if (!streamer) {
      throw new HttpRequestError(403, {
        error: "승인된 스트리머만 이 기능을 사용할 수 있습니다.",
        code: "STREAMER_APPROVAL_REQUIRED"
      });
    }
    return { twitch: context.twitch, streamer };
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
        /* www 호스트가 canonical 없이 200으로 서빙되면 Google이 모든 페이지를
           "적절한 표준 태그가 있는 대체 페이지"로 이중 크롤합니다 — 색인 예산
           낭비의 원인이라 apex로 영구 이동시킵니다. 다른 호스트(로컬·스테이징)는
           건드리지 않습니다. */
        const requestHost = (req.headers.host ?? "").toLowerCase();
        if (requestHost === "www.yoro.gg") {
          return sendPermanentRedirect(res, `https://yoro.gg${req.url}`, {
            "Cache-Control": "public, max-age=86400"
          });
        }
        if (url.pathname === "/dashborad" || url.pathname === "/dashborad/") return sendRedirect(res, "/");
        const canonicalBotPath = legacyBotPublicReturnPath(url);
        if (canonicalBotPath) {
          return sendPermanentRedirect(res, canonicalBotPath, {
            "Cache-Control": "public, max-age=3600",
            "Referrer-Policy": "no-referrer"
          });
        }
        const retiredCommunityPath = retiredCommunityReturnPath(url);
        if (retiredCommunityPath) {
          return sendPermanentRedirect(res, retiredCommunityPath, {
            "Cache-Control": "public, max-age=3600",
            "Referrer-Policy": "no-referrer"
          });
        }
        if (
          url.pathname === "/setup/discord"
          || url.pathname === "/setup/discord/"
          || url.pathname === "/bot/manage"
          || url.pathname === "/bot/manage/"
        ) {
          return sendRedirect(res, legacyDiscordDashboardReturnUrl(url), {
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer"
          });
        }
        const unifiedStreamerPath = legacyStreamerDashboardReturnPath(
          url.pathname
        );
        if (unifiedStreamerPath) {
          return sendRedirect(res, unifiedStreamerPath, {
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer"
          });
        }
        if (await sendPublicLolSocialImage(req, res, url.pathname)) return;
        if (await sendPatchNotesSocialImage(req, res, url.pathname)) return;
        if (await sendHomeSocialImage(req, res, url.pathname)) return;
        if (await sendPublicSitemap(req, res, url.pathname)) return;
        if (await sendPublicDashboardAsset(req, res, url.pathname)) return;
        // 기존 `?pal=` 상세 query는 고유 URL로 영구 이전합니다. 두 URL이 같은 내용을
        // 제공하면 중복 색인이 되고 canonical 신호가 흩어집니다.
        const palworldEntityTarget = palworldEntityRedirectPath(url.pathname, url.searchParams);
        if (palworldEntityTarget) {
          return sendPermanentRedirect(res, palworldEntityTarget, {
            "Cache-Control": "public, max-age=3600"
          });
        }
        const patchNotesDetailRoute = patchNotesDetailRouteForPath(url.pathname);
        if (patchNotesDetailRoute) {
          if (!input.patchNotes) {
            await sendPatchNotesUnavailablePage(req, res, url.pathname);
            return;
          }
          let feed: Awaited<ReturnType<PatchNotesService["getFeed"]>>;
          try {
            feed = await input.patchNotes.getFeed(patchNotesDetailRoute.locale);
          } catch (error) {
            input.logger?.error({
              type: "public_seo.patch_notes_detail_failed",
              errorCode: "patch_notes_feed_unavailable",
              error: toSafeErrorMessage(error)
            });
          }
          if (!feed) {
            await sendPatchNotesUnavailablePage(req, res, url.pathname);
            return;
          }
          const note = feed.notes.find((candidate) => (
            candidate.patchVersion === patchNotesDetailRoute.patchVersion
          ));
          if (!note) return sendPublicNotFound(req, res, url.pathname);
          let changes: Awaited<ReturnType<PatchChangeSummaryService["summaryFor"]>>;
          if (input.patchChangeSummary) {
            try {
              const resolved = await input.patchChangeSummary.summaryFor(
                patchNotesDetailRoute.patchVersion,
                patchNotesDetailRoute.locale
              );
              if (resolved?.patchVersion === patchNotesDetailRoute.patchVersion) changes = resolved;
            } catch (error) {
              /* 변경 비교는 부분 데이터입니다. 실패해도 유효한 패치 상세는 원문 링크와
                 공개일을 포함한 기본 fallback으로 계속 서빙합니다. */
              input.logger?.error({
                type: "public_seo.patch_notes_detail_failed",
                errorCode: "patch_change_summary_unavailable",
                error: toSafeErrorMessage(error)
              });
            }
          }
          const seoMetadata = patchNotesDetailSeoMetadata(patchNotesDetailRoute, note, changes);
          await sendStaticFile(
            req,
            res,
            path.resolve(appConfig.paths.dashboardStatic, "index.html"),
            undefined,
            "/dashboard",
            (html) => applyPublicSeoMetadata(html, seoMetadata)
          );
          return;
        }
        if (url.pathname === "/" || isPublicDashboardAppRoute(url.pathname)) {
          const breedingPair = resolvePalworldBreedingSeoPair(url.pathname);
          if (breedingPair.isBreedingRoute && !breedingPair.pair) {
            if (breedingPair.dataUnavailable) {
              await sendPalworldBreedingUnavailablePage(req, res, url.pathname);
              return;
            }
            return sendPublicNotFound(req, res, url.pathname);
          }
          if (breedingPair.pair) {
            const locale = publicUrlLocaleFromPathname(url.pathname);
            const canonicalPath = palworldBreedingPath(breedingPair.pair);
            if (locale && stripPublicUrlLocalePrefix(url.pathname).replace(/\/$/u, "") !== canonicalPath) {
              return sendPermanentRedirect(res, `/${locale}${canonicalPath}`, {
                "Cache-Control": "public, max-age=3600"
              });
            }
          }
          const palworldEntity = resolvePalworldSeoEntity(url.pathname);
          if (palworldEntity.isEntityRoute && !palworldEntity.entity) {
            // 존재하지 않는 엔티티에 200을 주면 soft 404가 되어 같은 패턴 URL 전체의
            // 크롤 신뢰도가 떨어집니다.
            return sendPublicNotFound(req, res, url.pathname);
          }
          const seoMetadata = await resolvePublicSeoMetadata(url.pathname);
          const noindexHeaders = seoMetadata.robotsNoindex
            ? { "X-Robots-Tag": "noindex, nofollow" }
            : undefined;
          await sendStaticFile(
            req,
            res,
            path.resolve(appConfig.paths.dashboardStatic, "index.html"),
            noindexHeaders,
            "/dashboard",
            (html) => applyPublicSeoMetadata(html, seoMetadata)
          );
          return;
        }
      }
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

      if (url.pathname.startsWith("/api/")) {
        const palworldLimitGroup = url.pathname.startsWith("/api/palworld/")
          ? palworldRateLimitGroup(url.pathname)
          : undefined;
        const rateLimitPath = url.pathname === "/api/minecraft/patch-notes"
          ? "/api/minecraft/patch-notes"
          : palworldLimitGroup === undefined
          ? url.pathname.startsWith("/api/valorant/")
            ? "/api/valorant/public"
            : url.pathname
          : `/api/palworld/${palworldLimitGroup.group}`;
        const limitKey = `${ip}:${rateLimitPath}`;
        const limiter = url.pathname === "/api/minecraft/patch-notes"
          ? publicMinecraftPatchNotesApiLimiter
          : url.pathname === "/api/admin/audit-logs"
          ? adminAuditApiLimiter
          : url.pathname === "/api/inbound-email/cloudflare"
          ? inboundEmailLimiter
          : url.pathname.startsWith("/api/dashboard/auth/")
          ? dashboardLoginLimiter
          : url.pathname.startsWith("/api/twitch/auth/")
            || url.pathname.startsWith("/api/public/twitch/auth/")
            || url.pathname.startsWith("/api/account/oauth/")
            || url.pathname.startsWith("/api/discord/")
            ? oauthLimiter
          : palworldLimitGroup?.list
            ? publicPalworldListApiLimiter
            : palworldLimitGroup
              ? publicPalworldApiLimiter
          : url.pathname.startsWith("/api/valorant/")
              ? publicValorantApiLimiter
          : url.pathname.startsWith("/api/twitch-extension/")
              ? twitchExtensionApiLimiter
          : url.pathname.startsWith("/api/lol/") || url.pathname.startsWith("/api/public/twitch/") || url.pathname.startsWith("/api/public/aram/") || url.pathname.startsWith("/api/public/patch-notes") || url.pathname.startsWith("/api/public/participation/") || url.pathname.startsWith("/api/public/streamers") || url.pathname === "/api/public/locale" || url.pathname === "/api/public/game-boxart"
              ? publicLolApiLimiter
              : dashboardApiLimiter;
        const limited = limiter.check(limitKey);
        if (!limited.ok) {
          return sendJson(req, res, 429, { error: "rate limit exceeded" }, {
            "Cache-Control": "no-store",
            "Retry-After": String(limited.retryAfterSeconds),
            "X-RateLimit-Limit": String(limiter.requestLimit),
            "X-RateLimit-Reset": String(
              Math.ceil(Date.now() / 1_000) + limited.retryAfterSeconds
            )
          });
        }
      }

      if (url.pathname.startsWith("/internal/discord/")) {
        const participationAnnouncementPaths = new Set([
          "/internal/discord/guild-channels/report",
          "/internal/discord/participation-announcements/pending",
          "/internal/discord/participation-announcements/ack"
        ]);
        const internalPaths = new Set([
          "/internal/discord/setup-sessions",
          "/internal/discord/installations/upsert",
          "/internal/discord/installations/revoked",
          "/internal/discord/game-server-status",
          "/internal/discord/palworld-players",
          "/internal/discord/command-policy",
          "/internal/discord/response-locale",
          "/internal/discord/guild-channels/report",
          "/internal/discord/participation-announcements/pending",
          "/internal/discord/participation-announcements/ack"
        ]);
        if (!internalPaths.has(url.pathname) || req.method !== "POST") {
          return sendJson(req, res, 404, { error: "not found" });
        }
        if (
          !appConfig.discordParticipationAnnounce.enabled
          && participationAnnouncementPaths.has(url.pathname)
        ) {
          return sendJson(req, res, 404, { error: "not found" });
        }
        if (
          !appConfig.discordBotInternal.enabled
          || !appConfig.discordSaas.enabled
          || !appConfig.database.enabled
          || !input.discordOnboarding
          || !input.discordInternalAuth
          || input.discordDatabaseReady?.() !== true
        ) {
          return sendJson(req, res, 503, {
            error: "Discord Bot 내부 기능을 사용할 수 없습니다.",
            code: "feature_unavailable"
          });
        }
        if (req.headers.origin || req.headers["access-control-request-method"]) {
          return sendJson(req, res, 403, {
            error: "브라우저 요청은 허용되지 않습니다.",
            code: "internal_only"
          });
        }
        if (!discordJsonBodyAllowed(req)) {
          return sendJson(req, res, 415, {
            error: "application/json Content-Type이 필요합니다."
          });
        }
        const rawBody = await readRawBody(req, DISCORD_INTERNAL_MAX_BODY_BYTES);
        const verified = input.discordInternalAuth.verify({
          body: rawBody,
          headers: req.headers,
          method: req.method,
          path: url.pathname
        });
        if (!verified.ok) {
          return sendJson(req, res, 401, {
            error: "내부 인증에 실패했습니다.",
            code: verified.code
          });
        }
        let body: unknown;
        try {
          body = JSON.parse(rawBody.toString("utf8"));
        } catch {
          return sendJson(req, res, 400, { error: "올바른 JSON body가 아닙니다." });
        }
        if (url.pathname === "/internal/discord/setup-sessions") {
          const setup = parseDiscordSetupSessionRequest(body);
          if (
            !setup
            || setup.applicationId !== appConfig.discordBotInternal.applicationId
          ) {
            return sendJson(req, res, 400, {
              error: "setup session 요청 형식이 올바르지 않습니다."
            });
          }
          // 명령 interaction 자체가 현재 Guild에 Bot이 설치되어 있다는 증거입니다.
          // GUILD_CREATE 관찰 저장보다 setup 명령이 먼저 도착하는 경쟁 상태를
          // 같은 서명 요청 안에서 복구합니다.
          await input.discordOnboarding.observeBotInstallation({
            applicationId: setup.applicationId,
            guildId: setup.guildId
          });
          const issued = await input.discordOnboarding.issueSetupSession({
            applicationId: setup.applicationId,
            guildId: setup.guildId,
            userId: setup.userId,
            issuedVia: "bot_command"
          });
          return sendJson(req, res, 201, issued, noStoreHeaders());
        }
        if (url.pathname === "/internal/discord/game-server-status") {
          const statusRequest = parseDiscordGameServerStatusRequest(body);
          if (
            !statusRequest
            || statusRequest.applicationId !== appConfig.discordBotInternal.applicationId
          ) {
            return sendJson(req, res, 400, {
              error: "게임 서버 상태 요청 형식이 올바르지 않습니다."
            }, noStoreHeaders());
          }
          if (!input.gameServerStatusRead) {
            return sendJson(req, res, 503, {
              error: "게임 서버 상태 기능을 사용할 수 없습니다.",
              code: "feature_unavailable"
            }, noStoreHeaders());
          }
          try {
            return sendJson(
              req,
              res,
              200,
              await input.gameServerStatusRead.read(statusRequest),
              noStoreHeaders()
            );
          } catch (error) {
            input.logger?.error({
              type: "discord.internal.game_server_status_failed",
              errorCode: error instanceof SafeDatabaseError
                ? error.code
                : "STATUS_READ_FAILED"
            });
            return sendJson(req, res, 503, {
              error: "게임 서버 상태를 확인할 수 없습니다.",
              code: "status_read_failed"
            }, noStoreHeaders());
          }
        }
        if (url.pathname === "/internal/discord/palworld-players") {
          const playerRequest = parseDiscordPalworldPlayerLookupRequest(body);
          if (
            !playerRequest
            || playerRequest.applicationId
              !== appConfig.discordBotInternal.applicationId
          ) {
            return sendJson(req, res, 400, {
              error: "Palworld 플레이어 조회 요청 형식이 올바르지 않습니다."
            }, noStoreHeaders());
          }
          if (!input.gameServerStatusRead) {
            return sendJson(req, res, 503, {
              error: "Palworld 플레이어 조회 기능을 사용할 수 없습니다.",
              code: "feature_unavailable"
            }, noStoreHeaders());
          }
          try {
            return sendJson(
              req,
              res,
              200,
              await input.gameServerStatusRead.readPlayers(playerRequest),
              noStoreHeaders()
            );
          } catch (error) {
            input.logger?.error({
              type: "discord.internal.palworld_players_failed",
              errorCode: error instanceof SafeDatabaseError
                ? error.code
                : "PLAYER_READ_FAILED"
            });
            return sendJson(req, res, 503, {
              error: "Palworld 플레이어를 확인할 수 없습니다.",
              code: "player_read_failed"
            }, noStoreHeaders());
          }
        }
        if (url.pathname === "/internal/discord/command-policy") {
          const policyRequest = parseDiscordBotCommandPolicyRequest(body);
          if (
            !policyRequest
            || policyRequest.applicationId
              !== appConfig.discordBotInternal.applicationId
          ) {
            return sendJson(req, res, 400, {
              error: "Discord Bot 명령 정책 요청 형식이 올바르지 않습니다."
            }, noStoreHeaders());
          }
          if (!input.discordBotCommandPolicy) {
            return sendJson(req, res, 503, {
              error: "Discord Bot 명령 정책 기능을 사용할 수 없습니다.",
              code: "feature_unavailable"
            }, noStoreHeaders());
          }
          try {
            return sendJson(
              req,
              res,
              200,
              await input.discordBotCommandPolicy.resolve(policyRequest),
              noStoreHeaders()
            );
          } catch (error) {
            input.logger?.error({
              type: "discord.internal.command_policy_failed",
              errorCode: error instanceof SafeDatabaseError
                ? error.code
                : "COMMAND_POLICY_FAILED"
            });
            return sendJson(req, res, 503, {
              error: "Discord Bot 명령 정책을 확인할 수 없습니다.",
              code: "command_policy_failed"
            }, noStoreHeaders());
          }
        }
        if (url.pathname === "/internal/discord/response-locale") {
          const localeRequest = parseDiscordBotResponseLocaleUpdateRequest(body);
          if (
            !localeRequest
            || localeRequest.applicationId
              !== appConfig.discordBotInternal.applicationId
          ) {
            return sendJson(req, res, 400, {
              error: "Discord Bot 응답 언어 요청 형식이 올바르지 않습니다."
            }, noStoreHeaders());
          }
          if (!input.discordBotCommandPolicy) {
            return sendJson(req, res, 503, {
              error: "Discord Bot 응답 언어 기능을 사용할 수 없습니다.",
              code: "feature_unavailable"
            }, noStoreHeaders());
          }
          try {
            return sendJson(
              req,
              res,
              200,
              await input.discordBotCommandPolicy.updateResponseLocale(
                localeRequest
              ),
              noStoreHeaders()
            );
          } catch (error) {
            const denied = error instanceof SafeDatabaseError
              && error.code === "DATABASE_REFERENCE_INVALID";
            input.logger?.error({
              type: "discord.internal.response_locale_failed",
              errorCode: error instanceof SafeDatabaseError
                ? error.code
                : "RESPONSE_LOCALE_FAILED"
            });
            return sendJson(req, res, denied ? 403 : 503, {
              error: denied
                ? "Discord Bot 응답 언어를 변경할 권한이 없습니다."
                : "Discord Bot 응답 언어를 변경할 수 없습니다.",
              code: denied ? "permission_required" : "response_locale_failed"
            }, noStoreHeaders());
          }
        }
        if (url.pathname === "/internal/discord/participation-announcements/pending") {
          const pending = parseDiscordAnnouncementPendingRequest(body);
          if (
            !pending
            || pending.applicationId !== appConfig.discordBotInternal.applicationId
          ) {
            return sendJson(req, res, 400, { error: "요청 형식이 올바르지 않습니다.", code: "invalid_input" });
          }
          const targets = await input.discordOnboarding
            .listAnnouncementTargets(pending.applicationId);
          const jobs: DiscordAnnouncementJob[] = [];
          for (const target of targets) {
            if (jobs.length >= DISCORD_ANNOUNCEMENT_MAX_JOBS) break;
            const job = announcementJobFor(target);
            if (job) jobs.push(job);
          }
          return sendJson(req, res, 200, { jobs }, noStoreHeaders());
        }
        if (url.pathname === "/internal/discord/participation-announcements/ack") {
          const ack = parseDiscordAnnouncementAckRequest(body);
          if (
            !ack
            || ack.applicationId !== appConfig.discordBotInternal.applicationId
          ) {
            return sendJson(req, res, 400, { error: "요청 형식이 올바르지 않습니다.", code: "invalid_input" });
          }
          if (ack.result === "ok" && ack.messageId) {
            const target = (await input.discordOnboarding
              .listAnnouncementTargets(ack.applicationId))
              .find((entry) => entry.targetId === ack.jobId);
            const job = target ? announcementJobFor(target) : undefined;
            if (!target || !job) {
              return sendJson(req, res, 200, { ok: true }, noStoreHeaders());
            }
            await input.discordOnboarding.recordAnnouncementPublished({
              targetId: target.targetId,
              messageId: ack.messageId,
              publicSessionId: announcementSessionId(target) ?? "",
              state: job.state,
              ...(job.waiting === undefined ? {} : { waiting: job.waiting })
            });
            return sendJson(req, res, 200, { ok: true }, noStoreHeaders());
          }
          if (ack.result !== "failed") {
            await input.discordOnboarding.recordAnnouncementFailure({
              targetId: ack.jobId,
              deliverable: ack.result === "channel_missing"
                ? "missing_channel"
                : ack.result === "permission_missing"
                  ? "missing_permission"
                  : "missing_channel",
              dropMessage: ack.result === "message_deleted"
            });
          }
          return sendJson(req, res, 200, { ok: true }, noStoreHeaders());
        }
        if (url.pathname === "/internal/discord/guild-channels/report") {
          const report = parseDiscordGuildDirectoryReportRequest(body);
          if (
            !report
            || report.applicationId !== appConfig.discordBotInternal.applicationId
          ) {
            return sendJson(req, res, 400, {
              error: "길드 채널 보고 형식이 올바르지 않습니다.",
              code: "invalid_input"
            });
          }
          const result = await input.discordOnboarding.reportGuildDirectory(report);
          return sendJson(req, res, 200, result, noStoreHeaders());
        }
        const observation = parseDiscordInstallationObservationRequest(body);
        if (
          !observation
          || observation.applicationId !== appConfig.discordBotInternal.applicationId
        ) {
          return sendJson(req, res, 400, {
            error: "installation 요청 형식이 올바르지 않습니다."
          });
        }
        if (url.pathname === "/internal/discord/installations/upsert") {
          await input.discordOnboarding.observeBotInstallation(observation);
          return sendJson(req, res, 204, {}, noStoreHeaders());
        }
        await input.discordOnboarding.revokeBotInstallation(observation);
        return sendJson(req, res, 204, {}, noStoreHeaders());
      }

      if (
        url.pathname === "/api/account/streamer/participation/announcement"
        && !appConfig.discordParticipationAnnounce.enabled
      ) {
        return sendJson(req, res, 404, { error: "not found" });
      }
      if (
        (
          url.pathname === "/api/account/oauth/riot/start"
          || url.pathname === "/api/account/oauth/riot/callback"
        )
        && !appConfig.riot.rsoEnabled
      ) {
        return sendJson(req, res, 404, { error: "not found" });
      }
      if (url.pathname.startsWith("/api/valorant/") && !appConfig.riot.valorantPublicEnabled) {
        return sendJson(req, res, 404, { error: "not found" });
      }

      const auth = authorizeHttpRequest(req, url.pathname, sessions);
      if (!auth.ok) {
        return sendJson(req, res, auth.status, { error: auth.message, code: auth.code });
      }

      if (
        req.method === "GET"
        && url.pathname === "/api/account/oauth/riot/logout/callback"
      ) {
        if (url.search) {
          return sendJson(req, res, 400, { error: "query는 허용되지 않습니다." });
        }
        return sendRedirect(
          res,
          yoroAccountReturnUrl("/dashboard/account", "riot_logged_out"),
          {
            "Set-Cookie": clearYoroCookie(YORO_OAUTH_COOKIE),
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer"
          }
        );
      }

      if (url.pathname.startsWith("/api/account/")) {
        if (
          !appConfig.database.enabled
          || !input.yoroAccounts
          || input.discordDatabaseReady?.() !== true
        ) {
          return sendJson(req, res, 503, {
            error: "YORO 계정 기능을 사용할 수 없습니다.",
            code: "feature_unavailable"
          }, noStoreHeaders());
        }
        const sessionCookie = requestCookie(req, YORO_SESSION_COOKIE);
        if (req.method === "GET" && url.pathname === "/api/account/session") {
          if (url.search) {
            return sendJson(req, res, 400, { error: "query는 허용되지 않습니다." });
          }
          const session = await input.yoroAccounts.session(sessionCookie);
          return sendJson(
            req,
            res,
            200,
            session ?? { authenticated: false },
            noStoreHeaders()
          );
        }
        if (req.method === "GET" && url.pathname === "/api/account/streamer") {
          if (url.search) {
            return sendJson(req, res, 400, { error: "query는 허용되지 않습니다." });
          }
          const context = await yoroStreamerContext(req);
          const request = context.twitch
            ? currentStreamerRiotIdRequestForTwitchUser(context.twitch.userId)
            : undefined;
          const enabled = request?.status === "approved";
          const followerPermission = enabled
            ? await requireStreamerFollowerAuth()
                .getStatus(context.twitch?.userId ?? "")
                .catch(() => ({
                  state: "disconnected" as const,
                  missingScopes: ["moderator:read:followers"]
                }))
            : {
                state: "disconnected" as const,
                missingScopes: ["moderator:read:followers"]
              };
          const followerState = enabled && context.twitch
            ? input.store.getFollowerManagementState(context.twitch.userId)
            : undefined;
          return sendJson(req, res, 200, {
            twitchConnected: context.account.identities.some(
              (identity) => identity.provider === "twitch"
            ),
            twitchPermissionReady: Boolean(context.twitch),
            approval: {
              status: request?.status ?? "not_requested",
              enabled,
              ...(request?.requestedAt ? { requestedAt: request.requestedAt } : {}),
              ...(request?.reviewedAt ? { reviewedAt: request.reviewedAt } : {})
            },
            followerPermission,
            ...(context.twitch ? {
              profile: {
                twitchLogin: context.twitch.user.login,
                twitchDisplayName: context.twitch.user.displayName,
                ...(context.twitch.user.profileImageUrl
                  ? { twitchProfileImageUrl: context.twitch.user.profileImageUrl }
                  : {}),
                ...(request ? {
                  riotGameName: request.riotGameName,
                  riotTagLine: request.riotTagLine
                } : {})
              }
            } : {}),
            ...(followerState ? {
              summary: {
                activeFollowers: followerState.summary.activeFollowers,
                knownFollowers: followerState.summary.knownFollowers,
                // Dashboard 홈이 증감을 보여 주려고 팔로워 전체 목록을 다시
                // 받지 않도록, 이미 계산된 값을 여기서 함께 내려줍니다.
                newFollowers7d: followerState.summary.newFollowers7d,
                ...(followerState.lastSnapshotAt
                  ? { lastSnapshotAt: followerState.lastSnapshotAt }
                  : {})
              }
            } : {})
          }, noStoreHeaders());
        }
        if (req.method === "POST" && url.pathname === "/api/account/streamer/apply") {
          const context = await yoroStreamerContext(req, true);
          if (!context.twitch) {
            return sendJson(req, res, 409, {
              error: "연결된 Twitch 계정의 기본 권한을 다시 승인해주세요.",
              code: "TWITCH_PERMISSION_REQUIRED"
            }, noStoreHeaders());
          }
          const existingRequest = currentStreamerRiotIdRequestForTwitchUser(
            context.twitch.userId
          );
          if (existingRequest?.status === "approved") {
            return sendJson(req, res, 409, {
              error: "이미 승인된 스트리머입니다. Riot ID 관리 화면을 이용해주세요.",
              code: "STREAMER_ALREADY_APPROVED"
            }, noStoreHeaders());
          }
          if (existingRequest?.status === "pending") {
            return sendJson(req, res, 409, {
              error: "이미 검토 중인 스트리머 신청이 있습니다.",
              code: "STREAMER_APPLICATION_PENDING"
            }, noStoreHeaders());
          }
          const body = await readJsonBody<Record<string, unknown>>(req);
          if (
            Object.keys(body).length !== 1
            || typeof body.riotId !== "string"
          ) {
            return sendJson(req, res, 400, {
              error: "riotId 입력이 올바르지 않습니다.",
              code: "invalid_input"
            }, noStoreHeaders());
          }
          const parsed = parseRiotIdDetailed(body.riotId);
          if (!parsed.ok) {
            return sendJson(req, res, 400, {
              error: parsed.message,
              code: "invalid_input"
            }, noStoreHeaders());
          }
          const request = upsertStreamerRiotIdRequest({
            twitchUserId: context.twitch.userId,
            twitchLogin: context.twitch.user.login,
            twitchDisplayName: context.twitch.user.displayName,
            twitchProfileImageUrl: context.twitch.user.profileImageUrl,
            riotGameName: parsed.gameName,
            riotTagLine: parsed.tagLine
          });
          return sendJson(req, res, 200, {
            approval: {
              status: request.status,
              enabled: request.status === "approved",
              requestedAt: request.requestedAt,
              ...(request.reviewedAt ? { reviewedAt: request.reviewedAt } : {})
            },
            profile: {
              twitchLogin: request.twitchLogin,
              twitchDisplayName: request.twitchDisplayName,
              ...(request.twitchProfileImageUrl
                ? { twitchProfileImageUrl: request.twitchProfileImageUrl }
                : {}),
              riotGameName: request.riotGameName,
              riotTagLine: request.riotTagLine
            }
          }, noStoreHeaders());
        }
        if (
          req.method === "POST"
          && url.pathname === "/api/account/streamer/permissions/start"
        ) {
          const context = await yoroStreamerContext(req, true);
          const { twitch } = requireApprovedYoroStreamer(context);
          try {
            const authorizationUrl = requireStreamerFollowerAuth().createAuthorizationUrl(
              twitch.userId,
              {
                redirectUri: twitchCallbackUrlForRequest(req),
                returnUrl: dashboardReturnUrlForRequest(
                  req,
                  "/dashboard/streaming/permissions"
                ),
                forceVerify: true
              }
            );
            return sendJson(req, res, 200, { url: authorizationUrl }, noStoreHeaders());
          } catch (error) {
            throw followerAuthHttpError(error);
          }
        }
        if (
          req.method === "GET"
          && url.pathname === "/api/account/streamer/followers"
        ) {
          if (url.search) {
            return sendJson(req, res, 400, { error: "query는 허용되지 않습니다." });
          }
          const context = await yoroStreamerContext(req);
          const { twitch } = requireApprovedYoroStreamer(context);
          return sendJson(
            req,
            res,
            200,
            await followerManagementResponse(twitch.userId),
            noStoreHeaders()
          );
        }
        if (
          req.method === "POST"
          && url.pathname === "/api/account/streamer/followers/refresh"
        ) {
          const context = await yoroStreamerContext(req, true);
          const { twitch } = requireApprovedYoroStreamer(context);
          const refreshed = await refreshFollowerManagementForOwner(
            twitch.userId,
            url.searchParams.get("limit")
          );
          return sendJson(req, res, 200, refreshed.response, {
            ...noStoreHeaders(),
            ...refreshed.headers
          });
        }
        if (
          req.method === "POST"
          && url.pathname === "/api/account/streamer/riot-id"
        ) {
          const context = await yoroStreamerContext(req, true);
          const { twitch } = requireApprovedYoroStreamer(context);
          const body = await readJsonBody<Record<string, unknown>>(req);
          if (
            Object.keys(body).length !== 1
            || typeof body.riotId !== "string"
          ) {
            return sendJson(req, res, 400, {
              error: "riotId 입력이 올바르지 않습니다.",
              code: "invalid_input"
            }, noStoreHeaders());
          }
          const result = await updateStreamerRiotIdentityForOwner(
            twitch.userId,
            body.riotId
          );
          return sendJson(req, res, 200, {
            twitchLogin: result.request.twitchLogin,
            twitchDisplayName: result.request.twitchDisplayName,
            ...(result.request.twitchProfileImageUrl
              ? { twitchProfileImageUrl: result.request.twitchProfileImageUrl }
              : {}),
            riotGameName: result.request.riotGameName,
            riotTagLine: result.request.riotTagLine
          }, noStoreHeaders());
        }
        if (url.pathname === "/api/account/streamer/riot-ids" && req.method === "GET") {
          const context = await yoroStreamerContext(req);
          const { twitch } = requireApprovedYoroStreamer(context);
          return sendJson(req, res, 200, streamerRiotAccountsResponse(twitch.userId), noStoreHeaders());
        }
        if (url.pathname === "/api/account/streamer/riot-ids" && req.method === "POST") {
          const context = await yoroStreamerContext(req, true);
          const { twitch, streamer } = requireApprovedYoroStreamer(context);
          const body = await readJsonBody<Record<string, unknown>>(req);
          if (Object.keys(body).length !== 1 || typeof body.riotId !== "string") {
            return sendJson(req, res, 400, {
              error: "riotId 입력이 올바르지 않습니다.",
              code: "invalid_input"
            }, noStoreHeaders());
          }
          const parsed = parseRiotIdDetailed(body.riotId);
          if (!parsed.ok) {
            return sendJson(req, res, 400, { error: parsed.message, code: "invalid_input" }, noStoreHeaders());
          }
          /* Twitch 채널명·아바타는 방송인 신청(apply) 경로처럼 라이브 컨텍스트에서
             읽습니다 — 대표 row 스냅샷은 개명·아바타 변경 이후 낡아 있을 수 있고,
             이 값이 서브 계정 검색 페이지의 스트리머 카드에 그대로 노출됩니다.
             이 endpoint는 승인된 대표 스트리머만 통과하며 서브 계정은 즉시 승인됩니다. */
          const result = input.store.addStreamerSubRiotIdRequest({
            twitchUserId: twitch.userId,
            twitchLogin: twitch.user.login || streamer.twitchLogin,
            twitchDisplayName: twitch.user.displayName || streamer.twitchDisplayName,
            twitchProfileImageUrl: twitch.user.profileImageUrl ?? streamer.twitchProfileImageUrl,
            riotGameName: parsed.gameName,
            riotTagLine: parsed.tagLine
          }, { approvalMode: "owner_self_service" });
          if (!result.ok) {
            const failures = {
              streamer_approval_required: { status: 403, error: "승인된 대표 스트리머만 서브 계정을 등록할 수 있습니다." },
              riot_id_duplicated: { status: 409, error: "이미 등록한 Riot ID입니다." },
              riot_id_taken: { status: 409, error: "이미 다른 스트리머가 등록한 Riot ID입니다." },
              riot_id_rejected: { status: 409, error: "관리자가 연결을 중지한 Riot ID입니다. 재검토가 필요하면 관리자에게 문의해주세요." },
              limit_exceeded: { status: 409, error: `서브 계정은 최대 ${STREAMER_SUB_RIOT_ACCOUNT_LIMIT}개까지 등록할 수 있습니다.` }
            } as const;
            const failure = failures[result.code];
            return sendJson(req, res, failure.status, { error: failure.error, code: result.code }, noStoreHeaders());
          }
          invalidatePublicLolProfileCachesForStreamer(result.request);
          return sendJson(req, res, 200, streamerRiotAccountsResponse(twitch.userId), noStoreHeaders());
        }
        if (url.pathname === "/api/account/streamer/riot-ids/main" && req.method === "POST") {
          const context = await yoroStreamerContext(req, true);
          const { twitch } = requireApprovedYoroStreamer(context);
          const body = await readJsonBody<Record<string, unknown>>(req);
          if (Object.keys(body).length !== 1 || typeof body.accountId !== "string") {
            return sendJson(req, res, 400, {
              error: "accountId 입력이 올바르지 않습니다.",
              code: "invalid_input"
            }, noStoreHeaders());
          }
          const previousMain = approvedStreamerRiotIdForTwitchUser(twitch.userId);
          const result = input.store.setMainStreamerRiotId({
            twitchUserId: twitch.userId,
            requestId: body.accountId
          });
          if (!result.ok) {
            const failure = result.code === "not_found"
              ? { status: 404, error: "계정을 찾을 수 없습니다." }
              : { status: 409, error: "승인된 계정만 대표로 지정할 수 있습니다." };
            return sendJson(req, res, failure.status, { error: failure.error, code: result.code }, noStoreHeaders());
          }
          /* 대표 교체는 게임 모니터 추적 대상과 공개 프로필의 스트리머 카드 기준을
             바꿉니다 — Riot ID 개명(updateStreamerRiotIdentityForOwner)과 같은
             재시작·캐시 무효화 절차를 따릅니다. */
          invalidatePublicLolProfileCachesForStreamer(previousMain);
          invalidatePublicLolProfileCachesForStreamer(result.request);
          const automation = input.store.getLolAutomationSettings(twitch.userId);
          await restartStreamerLolGameMonitor(twitch.userId, result.request, automation);
          if (automation.enabled) {
            await refreshStreamerProfileForOwner(twitch.userId, true).catch(() => undefined);
          }
          return sendJson(req, res, 200, streamerRiotAccountsResponse(twitch.userId), noStoreHeaders());
        }
        {
          const riotAccountMatch = url.pathname.match(/^\/api\/account\/streamer\/riot-ids\/([^/]+)$/);
          if (riotAccountMatch && riotAccountMatch[1] !== "main" && req.method === "DELETE") {
            const context = await yoroStreamerContext(req, true);
            const { twitch } = requireApprovedYoroStreamer(context);
            const result = input.store.deleteStreamerRiotIdRequest({
              twitchUserId: twitch.userId,
              requestId: riotAccountMatch[1]!
            });
            if (!result.ok) {
              const failures = {
                not_found: { status: 404, error: "계정을 찾을 수 없습니다." },
                cannot_delete_main: { status: 409, error: "대표 계정은 삭제할 수 없습니다. 먼저 다른 계정을 대표로 지정해주세요." },
                cannot_delete_rejected: { status: 409, error: "관리자가 연결을 중지한 계정은 삭제할 수 없습니다. 재검토가 필요하면 관리자에게 문의해주세요." }
              } as const;
              const failure = failures[result.code];
              return sendJson(req, res, failure.status, { error: failure.error, code: result.code }, noStoreHeaders());
            }
            if (result.request.status === "approved") {
              invalidatePublicLolProfileCachesForStreamer(result.request);
            }
            return sendJson(req, res, 200, streamerRiotAccountsResponse(twitch.userId), noStoreHeaders());
          }
        }
        if (url.pathname === "/api/account/streamer/participation/announcement") {
          if (req.method === "GET") {
            if (url.search) {
              return sendJson(req, res, 400, { error: "query는 허용되지 않습니다.", code: "invalid_request" });
            }
            const context = await yoroStreamerContext(req);
            const { twitch } = requireApprovedYoroStreamer(context);
            return sendJson(req, res, 200, await input.yoroAccounts.participationAnnouncement({
              userId: context.userId,
              streamerTwitchUserId: twitch.userId
            }), noStoreHeaders());
          }
          if (req.method === "PUT") {
            const context = await yoroStreamerContext(req, true);
            const { twitch } = requireApprovedYoroStreamer(context);
            const parsed = parseParticipationAnnouncementInput(
              await readJsonBody<unknown>(req, ANNOUNCEMENT_MAX_BODY_BYTES)
            );
            if (!parsed) {
              return sendJson(req, res, 400, {
                error: "알림 설정 형식이 올바르지 않습니다.",
                code: "invalid_request"
              }, noStoreHeaders());
            }
            try {
              return sendJson(req, res, 200, await input.yoroAccounts.replaceParticipationAnnouncement({
                userId: context.userId,
                streamerTwitchUserId: twitch.userId,
                enabled: parsed.enabled,
                targets: parsed.targets
              }), noStoreHeaders());
            } catch (error) {
              return sendJson(req, res, ...announcementFailure(error));
            }
          }
          return sendJson(req, res, 405, { error: "method not allowed" });
        }
        if (url.pathname === "/api/account/streamer/twitch-extension") {
          if (url.search) {
            return sendJson(req, res, 400, {
              error: "query는 허용되지 않습니다.",
              code: "invalid_request"
            });
          }
          if (!input.twitchExtensionSettings) {
            return sendJson(req, res, 503, {
              error: "Twitch Extension 설정 저장소를 사용할 수 없습니다.",
              code: "feature_unavailable"
            }, noStoreHeaders());
          }
          if (req.method === "GET") {
            const context = await yoroStreamerContext(req);
            const { twitch } = requireApprovedYoroStreamer(context);
            return sendJson(req, res, 200, await input.twitchExtensionSettings.readForOwner({
              userId: context.userId,
              streamerTwitchUserId: twitch.userId,
              connectionState: appConfig.twitchExtension.enabled
                ? "connected"
                : "configuration_required"
            }), noStoreHeaders());
          }
          if (req.method === "PUT") {
            const context = await yoroStreamerContext(req, true);
            const { twitch } = requireApprovedYoroStreamer(context);
            const settings = parseTwitchExtensionSettingsInput(
              await readJsonBody<unknown>(req, 8 * 1_024)
            );
            if (!settings) {
              return sendJson(req, res, 400, {
                error: "Twitch Extension 설정 형식이 올바르지 않습니다.",
                code: "invalid_request"
              }, noStoreHeaders());
            }
            return sendJson(req, res, 200, await input.twitchExtensionSettings.replace({
              userId: context.userId,
              streamerTwitchUserId: twitch.userId,
              settings,
              connectionState: appConfig.twitchExtension.enabled
                ? "connected"
                : "configuration_required"
            }), noStoreHeaders());
          }
          return sendJson(req, res, 405, { error: "method not allowed" });
        }
        if (
          req.method === "GET"
          && url.pathname === "/api/account/streamer/participation"
        ) {
          if (url.search) {
            return sendJson(req, res, 400, { error: "query는 허용되지 않습니다.", code: "invalid_request" });
          }
          const context = await yoroStreamerContext(req);
          const { twitch } = requireApprovedYoroStreamer(context);
          return sendJson(req, res, 200, input.store.getParticipationState(twitch.userId), noStoreHeaders());
        }
        if (
          req.method === "POST"
          && url.pathname === "/api/account/streamer/participation/session"
        ) {
          const context = await yoroStreamerContext(req, true);
          const { twitch } = requireApprovedYoroStreamer(context);
          const result = await mutateParticipationSessionForOwner(
            twitch.userId,
            await readJsonBody<unknown>(req)
          );
          return sendJson(req, res, 200, result, noStoreHeaders());
        }
        if (
          req.method === "POST"
          && url.pathname === "/api/account/streamer/participation/entry-status"
        ) {
          const context = await yoroStreamerContext(req, true);
          const { twitch } = requireApprovedYoroStreamer(context);
          const state = await mutateParticipationEntryForOwner(
            twitch.userId,
            await readJsonBody<unknown>(req)
          );
          return sendJson(req, res, 200, state, noStoreHeaders());
        }
        if (req.method === "PATCH" && url.pathname === "/api/account/preferences") {
          if (!stateChangingRequestHasTrustedOrigin(req)) {
            return sendJson(req, res, 403, {
              error: "trusted Origin이 필요합니다.",
              code: "origin_denied"
            });
          }
          const body = await readJsonBody<Record<string, unknown>>(req);
          const allowedKeys = new Set([
            "locale",
            "defaultDashboardPage",
            "reducedMotion"
          ]);
          if (
            Object.keys(body).length !== allowedKeys.size
            || Object.keys(body).some((key) => !allowedKeys.has(key))
            || (body.locale !== "ko" && body.locale !== "ja")
            || ![
              "overview",
              "account",
              "organizations",
              "settings"
            ].includes(String(body.defaultDashboardPage))
            || typeof body.reducedMotion !== "boolean"
          ) {
            return sendJson(req, res, 400, {
              error: "개인 설정 입력이 올바르지 않습니다.",
              code: "invalid_input"
            });
          }
          const preferences = await input.yoroAccounts.updatePreferences({
            sessionCookie,
            csrfToken: requestHeaderValue(req, "x-yoro-csrf"),
            preferences: {
              locale: body.locale,
              defaultDashboardPage: body.defaultDashboardPage as
                | "overview"
                | "account"
                | "organizations"
                | "settings",
              reducedMotion: body.reducedMotion
            }
          });
          return sendJson(req, res, 200, { preferences }, noStoreHeaders());
        }
        const oauthStartMatch = url.pathname.match(
          /^\/api\/account\/oauth\/(discord|twitch|riot)\/start$/u
        );
        if (req.method === "GET" && oauthStartMatch) {
          if (
            [...url.searchParams.keys()].some(
              (key) => key !== "purpose" && key !== "return_to"
            )
            || url.searchParams.getAll("purpose").length > 1
            || url.searchParams.getAll("return_to").length > 1
          ) {
            return sendJson(req, res, 400, { error: "허용되지 않은 query입니다." });
          }
          const provider = oauthStartMatch[1] as "discord" | "twitch" | "riot";
          if (
            provider === "riot"
            && url.searchParams.get("purpose") !== "link_identity"
          ) {
            return sendJson(req, res, 400, {
              error: "Riot 계정은 Twitch 로그인 후 연결해야 합니다.",
              code: "invalid_input"
            });
          }
          const purpose = url.searchParams.get("purpose") === "link_identity"
            ? "link_identity"
            : "login";
          const started = await input.yoroAccounts.beginOAuth({
            provider,
            purpose,
            returnPath: url.searchParams.get("return_to") ?? undefined,
            sessionCookie
          });
          return sendRedirect(res, started.authorizationUrl, {
            "Set-Cookie": yoroOAuthCookie(started.cookieValue),
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer"
          });
        }
        if (req.method === "GET" && url.pathname === "/api/account/oauth/riot/callback") {
          const allowed = new Set(["code", "state", "error", "error_description"]);
          if (
            [...url.searchParams.keys()].some((key) => !allowed.has(key))
            || [...allowed].some((key) => url.searchParams.getAll(key).length > 1)
            || url.searchParams.has("error")
          ) {
            return sendRedirect(
              res,
              yoroAccountReturnUrl("/dashboard/account", "oauth_failed"),
              {
                "Set-Cookie": clearYoroCookie(YORO_OAUTH_COOKIE),
                "Cache-Control": "no-store",
                "Referrer-Policy": "no-referrer"
              }
            );
          }
          try {
            const completed = await input.yoroAccounts.completeOAuth({
              provider: "riot",
              state: url.searchParams.get("state") ?? "",
              code: url.searchParams.get("code") ?? "",
              oauthCookie: requestCookie(req, YORO_OAUTH_COOKIE),
              sessionCookie
            });
            return sendRedirect(
              res,
              yoroAccountReturnUrl(completed.returnPath, undefined, "riot"),
              {
                "Set-Cookie": [
                  clearYoroCookie(YORO_OAUTH_COOKIE),
                  yoroSessionCookie(completed.sessionToken)
                ],
                "Cache-Control": "no-store",
                "Referrer-Policy": "no-referrer"
              }
            );
          } catch {
            return sendRedirect(
              res,
              yoroAccountReturnUrl("/dashboard/account", "oauth_failed"),
              {
                "Set-Cookie": clearYoroCookie(YORO_OAUTH_COOKIE),
                "Cache-Control": "no-store",
                "Referrer-Policy": "no-referrer"
              }
            );
          }
        }
        if (
          req.method === "POST"
          && url.pathname === "/api/account/riot/valorant-record-consent"
        ) {
          if (!stateChangingRequestHasTrustedOrigin(req)) {
            return sendJson(req, res, 403, {
              error: "trusted Origin이 필요합니다.",
              code: "origin_denied"
            });
          }
          if (!discordJsonBodyAllowed(req)) {
            return sendJson(req, res, 415, {
              error: "application/json Content-Type이 필요합니다."
            });
          }
          const body = await readJsonBody<Record<string, unknown>>(req);
          if (Object.keys(body).length !== 1 || typeof body.enabled !== "boolean") {
            return sendJson(req, res, 400, {
              error: "enabled boolean만 허용됩니다.",
              code: "invalid_input"
            });
          }
          const consent = await input.yoroAccounts.updateValorantRecordConsent({
            enabled: body.enabled,
            sessionCookie,
            csrfToken: requestHeaderValue(req, "x-yoro-csrf")
          });
          return sendJson(req, res, 200, {
            valorantRecordConsent: consent.enabled,
            ...consent
          }, noStoreHeaders());
        }
        if (req.method === "POST" && url.pathname === "/api/account/logout") {
          if (!stateChangingRequestHasTrustedOrigin(req)) {
            return sendJson(req, res, 403, {
              error: "trusted Origin이 필요합니다.",
              code: "origin_denied"
            });
          }
          const session = await input.yoroAccounts.session(sessionCookie);
          const csrfToken = requestHeaderValue(req, "x-yoro-csrf");
          if (!session || !csrfToken || !tokenMatches(session.csrfToken, csrfToken)) {
            return sendJson(req, res, 403, {
              error: "CSRF token이 필요합니다.",
              code: "csrf_required"
            });
          }
          await input.yoroAccounts.logout(sessionCookie);
          return sendJson(req, res, 204, {}, {
            "Set-Cookie": clearYoroCookie(YORO_SESSION_COOKIE),
            "Cache-Control": "no-store"
          });
        }
        const connectionMatch = url.pathname.match(
          /^\/api\/account\/connections\/(discord|twitch|riot)$/u
        );
        if (req.method === "DELETE" && connectionMatch) {
          if (!stateChangingRequestHasTrustedOrigin(req)) {
            return sendJson(req, res, 403, {
              error: "trusted Origin이 필요합니다.",
              code: "origin_denied"
            });
          }
          await input.yoroAccounts.unlinkIdentity({
            provider: connectionMatch[1] as "discord" | "twitch" | "riot",
            sessionCookie,
            csrfToken: requestHeaderValue(req, "x-yoro-csrf")
          });
          return sendJson(req, res, 204, {}, {
            "Set-Cookie": clearYoroCookie(YORO_SESSION_COOKIE),
            "Cache-Control": "no-store"
          });
        }
        return sendJson(req, res, 404, { error: "not found" });
      }

      if (url.pathname.startsWith("/api/discord/")) {
        const discordApplicationConfigured = isDiscordSnowflake(
          appConfig.discordBotInternal.applicationId
        );
        if (
          (req.method === "GET" || req.method === "HEAD")
          && url.pathname === "/api/discord/status"
        ) {
          if (url.search) {
            return sendJson(req, res, 400, { error: "query는 허용되지 않습니다." });
          }
          const databaseReady = appConfig.database.enabled
            && input.discordDatabaseReady?.() === true;
          return sendJson(req, res, 200, {
            installAvailable: discordApplicationConfigured,
            oauthAvailable: appConfig.discordSaas.enabled
              && databaseReady
              && Boolean(input.discordOnboarding),
            managementAvailable: appConfig.discordSaas.enabled
              && appConfig.discordBotManagement.enabled
              && databaseReady
              && Boolean(input.discordManagement),
            gatewayConfigured: appConfig.discordBotInternal.enabled
          }, noStoreHeaders());
        }
        if (
          (req.method === "GET" || req.method === "HEAD")
          && url.pathname === "/api/discord/bot/install"
        ) {
          if (url.search || !discordApplicationConfigured) {
            return sendJson(req, res, 404, { error: "not found" });
          }
          return sendRedirect(res, discordBotInstallUrl(), {
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer"
          });
        }
        if (!appConfig.discordSaas.enabled) {
          return sendJson(req, res, 404, { error: "not found" });
        }
        if (
          !appConfig.database.enabled
          || !input.discordOnboarding
          || input.discordDatabaseReady?.() !== true
        ) {
          return sendJson(req, res, 503, {
            error: "Discord 연결 기능을 사용할 수 없습니다.",
            code: "database_unavailable"
          });
        }
        if (url.pathname.startsWith("/api/discord/management/")) {
          if (!appConfig.discordBotManagement.enabled || !input.discordManagement) {
            return sendJson(req, res, 404, { error: "not found" });
          }
          const webGuildConnectionRequest = (
            url.pathname === "/api/discord/management/connect/start"
            || url.pathname === "/api/discord/management/connect/session"
            || url.pathname === "/api/discord/management/guilds/claim"
          );
          if (webGuildConnectionRequest && !appConfig.discordBotInternal.enabled) {
            return sendJson(req, res, 503, {
              error: "Discord Bot 설치 관찰 기능을 사용할 수 없습니다.",
              code: "bot_gateway_unavailable"
            }, noStoreHeaders());
          }
          const oauthCookie = requestCookie(req, DISCORD_MANAGEMENT_OAUTH_COOKIE);
          const yoroOauthCookieValue = requestCookie(req, YORO_OAUTH_COOKIE);
          const managementCookie = requestCookie(req, YORO_SESSION_COOKIE)
            ?? requestCookie(req, DISCORD_MANAGEMENT_SESSION_COOKIE);
          const onboardingCookie = requestCookie(req, DISCORD_ONBOARDING_COOKIE);
          if (
            req.method === "GET"
            && url.pathname === "/api/discord/management/connect/start"
          ) {
            if (url.search) {
              return sendJson(req, res, 400, { error: "query는 허용되지 않습니다." });
            }
            const yoroSession = await input.yoroAccounts?.authenticateForManagement(
              requestCookie(req, YORO_SESSION_COOKIE)
            );
            if (!yoroSession) {
              return sendJson(req, res, 401, {
                error: "YORO Dashboard 로그인이 필요합니다.",
                code: "session_required"
              }, noStoreHeaders());
            }
            const started = await input.discordOnboarding.beginWebManagementOAuth();
            return sendRedirect(res, started.authorizationUrl, {
              "Set-Cookie": discordOnboardingCookie(started.cookieValue),
              "Cache-Control": "no-store"
            });
          }
          if (
            req.method === "GET"
            && url.pathname === "/api/discord/management/connect/session"
          ) {
            if (url.search) {
              return sendJson(req, res, 400, { error: "query는 허용되지 않습니다." });
            }
            const session = await input.discordOnboarding.webManagementSession(onboardingCookie);
            return sendJson(
              req,
              res,
              200,
              session ?? { authenticated: false },
              noStoreHeaders()
            );
          }
          if (
            req.method === "POST"
            && url.pathname === "/api/discord/management/guilds/claim"
          ) {
            if (!stateChangingRequestHasTrustedOrigin(req)) {
              return sendJson(req, res, 403, {
                error: "trusted Origin이 필요합니다.",
                code: "origin_denied"
              });
            }
            if (!discordJsonBodyAllowed(req)) {
              return sendJson(req, res, 415, {
                error: "application/json Content-Type이 필요합니다."
              });
            }
            const body = await readJsonBody<Record<string, unknown>>(req);
            if (
              Object.keys(body).some((key) => !["guildId", "organizationId"].includes(key))
              || typeof body.guildId !== "string"
              || (body.organizationId !== undefined && typeof body.organizationId !== "string")
            ) {
              return sendJson(req, res, 400, {
                error: "Guild 연결 요청 형식이 올바르지 않습니다.",
                code: "invalid_input"
              });
            }
            const connected = await input.discordOnboarding.connectGuild({
              cookieValue: onboardingCookie,
              csrfToken: requestHeaderValue(req, "x-discord-csrf"),
              guildId: body.guildId,
              ...(typeof body.organizationId === "string"
                ? { organizationId: body.organizationId }
                : {})
            });
            if (!connected.yoroSessionToken) {
              return sendJson(req, res, 409, {
                error: "YORO Dashboard session을 발급할 수 없습니다.",
                code: "session_required"
              });
            }
            return sendJson(req, res, 200, {
              completed: true,
              guild: connected.guild,
              organization: connected.organization
            }, {
              "Set-Cookie": [
                clearDiscordOnboardingCookie(),
                clearDiscordManagementCookie(DISCORD_MANAGEMENT_SESSION_COOKIE),
                yoroSessionCookie(connected.yoroSessionToken)
              ],
              "Cache-Control": "no-store"
            });
          }
          if (req.method === "GET" && url.pathname === "/api/discord/management/oauth/start") {
            if (url.search) {
              return sendJson(req, res, 400, { error: "query는 허용되지 않습니다." });
            }
            const started = await input.discordManagement.beginLogin();
            return sendRedirect(res, started.authorizationUrl, {
              "Set-Cookie": discordManagementOAuthCookie(started.cookieValue),
              "Cache-Control": "no-store"
            });
          }
          if (req.method === "GET" && url.pathname === "/api/discord/management/oauth/callback") {
            const allowed = new Set(["code", "state", "error", "error_description"]);
            if (
              [...url.searchParams.keys()].some((key) => !allowed.has(key))
              || url.searchParams.has("error")
            ) {
              if (yoroOauthCookieValue) {
                return sendRedirect(
                  res,
                  yoroAccountReturnUrl("/login", "oauth_failed"),
                  {
                    "Set-Cookie": clearYoroCookie(YORO_OAUTH_COOKIE),
                    "Cache-Control": "no-store"
                  }
                );
              }
              return sendRedirect(res, discordManagementReturnUrl("error"), {
                "Set-Cookie": clearDiscordManagementCookie(DISCORD_MANAGEMENT_OAUTH_COOKIE),
                "Cache-Control": "no-store"
              });
            }
            try {
              if (yoroOauthCookieValue && input.yoroAccounts) {
                const completed = await input.yoroAccounts.completeOAuth({
                  provider: "discord",
                  state: url.searchParams.get("state") ?? "",
                  code: url.searchParams.get("code") ?? "",
                  oauthCookie: yoroOauthCookieValue
                });
                return sendRedirect(
                  res,
                  yoroAccountReturnUrl(completed.returnPath),
                  {
                    "Set-Cookie": [
                      clearYoroCookie(YORO_OAUTH_COOKIE),
                      yoroSessionCookie(completed.sessionToken)
                    ],
                    "Cache-Control": "no-store"
                  }
                );
              }
              const completed = await input.discordManagement.completeLogin({
                state: url.searchParams.get("state") ?? "",
                code: url.searchParams.get("code") ?? "",
                oauthCookie
              });
              return sendRedirect(res, discordManagementReturnUrl(), {
                "Set-Cookie": [
                  clearDiscordManagementCookie(DISCORD_MANAGEMENT_OAUTH_COOKIE),
                  discordManagementSessionCookie(completed.sessionToken)
                ],
                "Cache-Control": "no-store"
              });
            } catch {
              if (yoroOauthCookieValue) {
                return sendRedirect(
                  res,
                  yoroAccountReturnUrl("/login", "oauth_failed"),
                  {
                    "Set-Cookie": clearYoroCookie(YORO_OAUTH_COOKIE),
                    "Cache-Control": "no-store"
                  }
                );
              }
              return sendRedirect(res, discordManagementReturnUrl("error"), {
                "Set-Cookie": clearDiscordManagementCookie(DISCORD_MANAGEMENT_OAUTH_COOKIE),
                "Cache-Control": "no-store"
              });
            }
          }
          if (req.method === "GET" && url.pathname === "/api/discord/management/session") {
            if (url.search) {
              return sendJson(req, res, 400, { error: "query는 허용되지 않습니다." });
            }
            const session = await input.discordManagement.session(managementCookie);
            return sendJson(req, res, 200, session ?? { authenticated: false }, noStoreHeaders());
          }
          if (req.method === "POST" && url.pathname === "/api/discord/management/logout") {
            if (!stateChangingRequestHasTrustedOrigin(req)) {
              return sendJson(req, res, 403, { error: "trusted Origin이 필요합니다.", code: "origin_denied" });
            }
            const session = await input.discordManagement.session(managementCookie);
            const csrfToken = requestHeaderValue(req, "x-discord-csrf");
            if (!session || !csrfToken || session.csrfToken !== csrfToken) {
              return sendJson(req, res, 403, { error: "CSRF token이 필요합니다.", code: "csrf_required" });
            }
            await input.discordManagement.logout(managementCookie);
            return sendJson(req, res, 204, {}, {
              "Set-Cookie": [
                clearDiscordManagementCookie(DISCORD_MANAGEMENT_SESSION_COOKIE),
                clearYoroCookie(YORO_SESSION_COOKIE)
              ]
            });
          }
          const gameServersMatch = url.pathname.match(
            /^\/api\/discord\/management\/organizations\/([^/]+)\/game-servers$/u
          );
          if (gameServersMatch) {
            const organizationId = requireManagementOrganizationId(gameServersMatch[1] ?? "");
            if (req.method === "GET") {
              if (url.search) {
                return sendJson(req, res, 400, { error: "query는 허용되지 않습니다." });
              }
              const items = await input.discordManagement.listGameServers({
                cookieValue: managementCookie,
                organizationId
              });
              return sendJson(req, res, 200, { items }, noStoreHeaders());
            }
            if (req.method === "POST") {
              if (!stateChangingRequestHasTrustedOrigin(req)) {
                return sendJson(req, res, 403, { error: "trusted Origin이 필요합니다.", code: "origin_denied" });
              }
              if (!discordJsonBodyAllowed(req)) {
                return sendJson(req, res, 415, { error: "application/json Content-Type이 필요합니다." });
              }
              const value = parseCreatePalworldGameServerInput(await readJsonBody<unknown>(req));
              if (!value) {
                return sendJson(req, res, 400, { error: "게임 서버 요청 형식이 올바르지 않습니다.", code: "invalid_input" });
              }
              const server = await input.discordManagement.createGameServer({
                cookieValue: managementCookie,
                csrfToken: requestHeaderValue(req, "x-discord-csrf"),
                organizationId,
                value
              });
              return sendJson(req, res, 201, { server }, noStoreHeaders());
            }
          }
          const botControlMatch = url.pathname.match(
            /^\/api\/discord\/management\/organizations\/([^/]+)\/bot-control$/u
          );
          if (botControlMatch) {
            const organizationId = requireManagementOrganizationId(
              botControlMatch[1] ?? ""
            );
            if (url.search) {
              return sendJson(req, res, 400, {
                error: "query는 허용되지 않습니다."
              });
            }
            if (req.method === "GET") {
              return sendJson(
                req,
                res,
                200,
                await input.discordManagement.botControl({
                  cookieValue: managementCookie,
                  organizationId
                }),
                noStoreHeaders()
              );
            }
            if (req.method === "PATCH") {
              if (!stateChangingRequestHasTrustedOrigin(req)) {
                return sendJson(req, res, 403, {
                  error: "trusted Origin이 필요합니다.",
                  code: "origin_denied"
                });
              }
              if (!discordJsonBodyAllowed(req)) {
                return sendJson(req, res, 415, {
                  error: "application/json Content-Type이 필요합니다."
                });
              }
              const value = parseUpdateDiscordBotControlInput(
                await readJsonBody<unknown>(req)
              );
              if (!value) {
                return sendJson(req, res, 400, {
                  error: "Discord Bot 설정 요청 형식이 올바르지 않습니다.",
                  code: "invalid_input"
                });
              }
              return sendJson(
                req,
                res,
                200,
                await input.discordManagement.updateBotControl({
                  cookieValue: managementCookie,
                  csrfToken: requestHeaderValue(req, "x-discord-csrf"),
                  organizationId,
                  value
                }),
                noStoreHeaders()
              );
            }
          }
          const gameServerDetailMatch = url.pathname.match(
            /^\/api\/discord\/management\/organizations\/([^/]+)\/game-servers\/([^/]+)$/u
          );
          if (gameServerDetailMatch && req.method === "DELETE") {
            const organizationId = requireManagementOrganizationId(
              gameServerDetailMatch[1] ?? ""
            );
            const gameServerId = gameServerDetailMatch[2] ?? "";
            if (!isManagementOrganizationId(gameServerId) || url.search) {
              return sendJson(req, res, 404, { error: "not found" });
            }
            if (!stateChangingRequestHasTrustedOrigin(req)) {
              return sendJson(req, res, 403, {
                error: "trusted Origin이 필요합니다.",
                code: "origin_denied"
              });
            }
            const csrfToken = requestHeaderValue(req, "x-discord-csrf");
            await input.discordManagement.deleteGameServer({
              cookieValue: managementCookie,
              csrfToken,
              organizationId,
              gameServerId,
              ...(input.palworldServerMonitor
                ? {
                    beforeDelete: async (ownerId: string) => {
                      await input.palworldServerMonitor!.removeConnection(ownerId);
                    }
                  }
                : {})
            });
            return sendJson(req, res, 204, {}, noStoreHeaders());
          }
          const gameServerRestMatch = url.pathname.match(
            /^\/api\/discord\/management\/organizations\/([^/]+)\/game-servers\/([^/]+)\/palworld-rest(?:\/(test|save|refresh|remove))?$/u
          );
          if (gameServerRestMatch) {
            const organizationId = requireManagementOrganizationId(
              gameServerRestMatch[1] ?? ""
            );
            const gameServerId = gameServerRestMatch[2] ?? "";
            const action = gameServerRestMatch[3];
            if (!isManagementOrganizationId(gameServerId) || url.search) {
              return sendJson(req, res, 404, { error: "not found" });
            }
            const expectedMethod = action ? "POST" : "GET";
            if (req.method !== expectedMethod) {
              return sendJson(req, res, 404, { error: "not found" });
            }
            if (
              action
              && !stateChangingRequestHasTrustedOrigin(req)
            ) {
              return sendJson(req, res, 403, {
                error: "trusted Origin이 필요합니다.",
                code: "origin_denied"
              });
            }
            const ownerId = await input.discordManagement
              .authorizeGameServerRestConnection({
                cookieValue: managementCookie,
                csrfToken: requestHeaderValue(req, "x-discord-csrf"),
                organizationId,
                gameServerId,
                mutation: Boolean(action)
              });
            try {
              if (!action) {
                const response = input.palworldServerMonitor
                  ?.getDashboardResponse(ownerId)
                  ?? disabledPalworldServerDashboardResponse(
                    input.palworldServerUnavailableCode
                  );
                return sendJson(
                  req,
                  res,
                  200,
                  validatedPalworldServerDashboardResponse(response),
                  noStoreHeaders()
                );
              }
              if (!input.palworldServerMonitor) {
                throw new PalworldServerMonitorInputError(
                  input.palworldServerUnavailableCode ?? "disabled",
                  "Palworld 서버 상태 기능을 사용할 수 없습니다."
                );
              }
              if (action === "test" || action === "save") {
                if (!discordJsonBodyAllowed(req)) {
                  return sendJson(req, res, 415, {
                    error: "application/json Content-Type이 필요합니다."
                  });
                }
                const connection = await readPalworldServerConnectionInput(req);
                const response = action === "test"
                  ? await input.palworldServerMonitor.testConnection(ownerId, connection)
                  : await input.palworldServerMonitor.saveConnection(ownerId, connection);
                return sendJson(
                  req,
                  res,
                  200,
                  action === "test"
                    ? validatedPalworldServerTestResponse(response)
                    : validatedPalworldServerDashboardResponse(response),
                  noStoreHeaders()
                );
              }
              await requireEmptyPalworldServerBody(req);
              const response = action === "refresh"
                ? await input.palworldServerMonitor.refresh(ownerId)
                : await input.palworldServerMonitor.removeConnection(ownerId);
              return sendJson(
                req,
                res,
                200,
                validatedPalworldServerDashboardResponse(response),
                noStoreHeaders()
              );
            } catch (restError) {
              if (restError instanceof HttpRequestError) throw restError;
              if (restError instanceof PalworldServerMonitorRateLimitError) {
                const retryAfterSeconds = Number.isSafeInteger(
                  restError.retryAfterSeconds
                ) && restError.retryAfterSeconds > 0
                  ? restError.retryAfterSeconds
                  : 1;
                return sendJson(req, res, 429, {
                  error: "Palworld 서버 상태 확인 요청이 너무 많습니다.",
                  code: "rate_limited"
                }, {
                  ...noStoreHeaders(),
                  "Retry-After": String(retryAfterSeconds)
                });
              }
              if (restError instanceof PalworldServerMonitorInputError) {
                const statusCode = (
                  PALWORLD_SERVER_AVAILABILITY_ERROR_CODES as readonly string[]
                ).includes(restError.code)
                  ? 503
                  : 400;
                return sendJson(req, res, statusCode, {
                  error: palworldServerInputErrorMessage(restError.code),
                  code: restError.code
                }, noStoreHeaders());
              }
              input.logger?.error({
                type: "palworld_server.organization_http_failed",
                action: action ?? "status",
                errorCode: "internal_error"
              });
              return sendJson(req, res, 500, {
                error: "서버 내부 오류",
                code: "internal_error"
              }, noStoreHeaders());
            }
          }
        }
        const onboardingCookie = requestCookie(req, DISCORD_ONBOARDING_COOKIE);
        if (req.method === "GET" && url.pathname === "/api/discord/oauth/start") {
          const allowed = new Set(["setup"]);
          if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
            return sendJson(req, res, 400, { error: "허용되지 않은 query입니다." });
          }
          const setupToken = url.searchParams.get("setup") ?? "";
          const started = await input.discordOnboarding.beginOAuth(setupToken);
          return sendRedirect(res, started.authorizationUrl, {
            "Set-Cookie": discordOnboardingCookie(started.cookieValue),
            "Cache-Control": "no-store"
          });
        }
        if (req.method === "GET" && url.pathname === "/api/discord/oauth/callback") {
          const allowed = new Set(["code", "state", "error", "error_description"]);
          if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) {
            await input.discordOnboarding.logout(onboardingCookie);
            return sendRedirect(res, discordSetupReturnUrl("error"), {
              "Set-Cookie": clearDiscordOnboardingCookie(),
              "Cache-Control": "no-store"
            });
          }
          if (url.searchParams.has("error")) {
            const webManagement = await input.discordOnboarding
              .isWebManagementCookie(onboardingCookie);
            await input.discordOnboarding.logout(onboardingCookie);
            return sendRedirect(
              res,
              webManagement
                ? discordManagementConnectReturnUrl("error")
                : discordSetupReturnUrl("error"),
              {
              "Set-Cookie": clearDiscordOnboardingCookie(),
              "Cache-Control": "no-store"
              }
            );
          }
          const webManagement = await input.discordOnboarding
            .isWebManagementCookie(onboardingCookie);
          try {
            const targetUser = webManagement
              ? await input.yoroAccounts?.authenticateForManagement(
                  requestCookie(req, YORO_SESSION_COOKIE)
                )
              : undefined;
            const issuedVia = await input.discordOnboarding.completeOAuth({
              state: url.searchParams.get("state") ?? "",
              code: url.searchParams.get("code") ?? "",
              cookieValue: onboardingCookie,
              ...(targetUser ? { targetUserId: targetUser.userId } : {})
            });
            if (issuedVia === "web_management") {
              return sendRedirect(res, discordManagementConnectReturnUrl("select"), {
                "Cache-Control": "no-store"
              });
            }
          } catch {
            return sendRedirect(res, webManagement
              ? discordManagementConnectReturnUrl("error")
              : discordSetupReturnUrl("error"), {
              "Set-Cookie": clearDiscordOnboardingCookie(),
              "Cache-Control": "no-store"
            });
          }
          return sendRedirect(res, discordSetupReturnUrl("connected"), {
            "Cache-Control": "no-store"
          });
        }
        if (
          req.method === "GET"
          && (url.pathname === "/api/discord/session" || url.pathname === "/api/discord/onboarding/guilds")
        ) {
          if (url.search) return sendJson(req, res, 400, { error: "query는 허용되지 않습니다." });
          const session = await input.discordOnboarding.session(onboardingCookie);
          return sendJson(req, res, 200, session ?? { authenticated: false });
        }
        if (req.method === "POST" && url.pathname === "/api/discord/onboarding/guild") {
          if (!stateChangingRequestHasTrustedOrigin(req)) {
            return sendJson(req, res, 403, { error: "trusted Origin이 필요합니다.", code: "origin_denied" });
          }
          if (!discordJsonBodyAllowed(req)) {
            return sendJson(req, res, 415, { error: "application/json Content-Type이 필요합니다." });
          }
          const body = await readJsonBody<Record<string, unknown>>(req);
          if (
            Object.keys(body).some((key) => !["guildId", "organizationId"].includes(key))
            || typeof body.guildId !== "string"
            || (body.organizationId !== undefined && typeof body.organizationId !== "string")
          ) {
            return sendJson(req, res, 400, { error: "Guild 연결 요청 형식이 올바르지 않습니다." });
          }
          const connected = await input.discordOnboarding.connectGuild({
            cookieValue: onboardingCookie,
            csrfToken: requestHeaderValue(req, "x-discord-csrf"),
            guildId: body.guildId,
            ...(typeof body.organizationId === "string" ? { organizationId: body.organizationId } : {})
          });
          return sendJson(req, res, 200, {
            completed: true,
            guild: connected.guild,
            organization: connected.organization
          }, {
            "Set-Cookie": [
              clearDiscordOnboardingCookie(),
              clearDiscordManagementCookie(DISCORD_MANAGEMENT_SESSION_COOKIE),
              yoroSessionCookie(connected.yoroSessionToken)
            ]
          });
        }
        if (req.method === "POST" && url.pathname === "/api/discord/oauth/logout") {
          if (!stateChangingRequestHasTrustedOrigin(req)) {
            return sendJson(req, res, 403, { error: "trusted Origin이 필요합니다.", code: "origin_denied" });
          }
          if (!discordJsonBodyAllowed(req)) {
            return sendJson(req, res, 415, { error: "application/json Content-Type이 필요합니다." });
          }
          const session = await input.discordOnboarding.session(onboardingCookie);
          const csrfToken = requestHeaderValue(req, "x-discord-csrf");
          if (!session || !csrfToken || session.csrfToken !== csrfToken) {
            return sendJson(req, res, 403, { error: "CSRF token이 필요합니다.", code: "csrf_required" });
          }
          await input.discordOnboarding.logout(onboardingCookie);
          return sendJson(req, res, 204, {}, { "Set-Cookie": clearDiscordOnboardingCookie() });
        }
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
      if (req.method === "GET" && url.pathname.startsWith("/api/minecraft/")) {
        const catalog = input.minecraftCatalog;
        if (url.pathname === "/api/minecraft/patch-notes") {
          let candidate: MinecraftPatchNotesResponse;
          if (input.minecraftPatchNotes) {
            candidate = await input.minecraftPatchNotes.page(url.searchParams);
          } else {
            parseMinecraftPatchNotesQuery(url.searchParams);
            candidate = { state: "data_unavailable" as const };
          }
          const validation = validateMinecraftPatchNotesResponse(candidate);
          if (!validation.ok) throw new Error(`minecraft_patch_notes_response_invalid:${validation.error}`);
          return sendJson(req, res, 200, validation.data, validation.data.state === "ready"
            ? {
                "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
              }
            : noStoreHeaders());
        }
        if (url.pathname === "/api/minecraft/items") {
          const response = catalog?.items(url.searchParams) ?? { state: "data_unavailable" as const };
          const validation = validateMinecraftItemCatalogResponse(response);
          if (!validation.ok) throw new Error(`minecraft_item_response_invalid:${validation.error}`);
          return sendJson(req, res, 200, validation.data, validation.data.state === "ready"
            ? {
                "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
                "X-Minecraft-Data-Version": validation.data.metadata.gameVersion,
                "X-Minecraft-Data-Revision": validation.data.metadata.sourceRevision
              }
            : noStoreHeaders());
        }
        if (url.pathname === "/api/minecraft/recipes") {
          const response = catalog?.recipes(url.searchParams) ?? { state: "data_unavailable" as const };
          const validation = validateMinecraftRecipeCatalogResponse(response);
          if (!validation.ok) throw new Error(`minecraft_recipe_response_invalid:${validation.error}`);
          return sendJson(req, res, 200, validation.data, validation.data.state === "ready"
            ? {
                "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
                "X-Minecraft-Data-Version": validation.data.metadata.gameVersion,
                "X-Minecraft-Data-Revision": validation.data.metadata.sourceRevision
              }
            : noStoreHeaders());
        }
        if (url.pathname === "/api/minecraft/enchants") {
          const response = catalog?.enchants(url.searchParams) ?? { state: "data_unavailable" as const };
          const validation = validateMinecraftEnchantCatalogResponse(response);
          if (!validation.ok) throw new Error(`minecraft_enchant_response_invalid:${validation.error}`);
          return sendJson(req, res, 200, validation.data, validation.data.state === "ready"
            ? {
                "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
                "X-Minecraft-Data-Version": validation.data.metadata.gameVersion,
                "X-Minecraft-Data-Revision": validation.data.metadata.sourceRevision
              }
            : noStoreHeaders());
        }
      }
      if (req.method === "GET" && url.pathname.startsWith("/api/valorant/")) {
        const catalog = input.valorantCatalog;
        if (url.pathname === "/api/valorant/agents") {
          const response = catalog?.agents(url.searchParams) ?? { state: "data_unavailable" as const };
          const validation = validateValorantAgentCatalogResponse(response);
          if (!validation.ok) throw new Error(`valorant_agent_response_invalid:${validation.error}`);
          return sendJson(req, res, 200, validation.data, validation.data.state === "ready"
            ? { "Cache-Control": "public, max-age=300, s-maxage=3600" }
            : noStoreHeaders());
        }
        if (url.pathname === "/api/valorant/weapons") {
          const response = catalog?.weapons(url.searchParams) ?? { state: "data_unavailable" as const };
          const validation = validateValorantWeaponCatalogResponse(response);
          if (!validation.ok) throw new Error(`valorant_weapon_response_invalid:${validation.error}`);
          return sendJson(req, res, 200, validation.data, validation.data.state === "ready"
            ? { "Cache-Control": "public, max-age=300, s-maxage=3600" }
            : noStoreHeaders());
        }
        if (url.pathname === "/api/valorant/maps") {
          const response = catalog?.maps(url.searchParams) ?? { state: "data_unavailable" as const };
          const validation = validateValorantMapCatalogResponse(response);
          if (!validation.ok) throw new Error(`valorant_map_response_invalid:${validation.error}`);
          return sendJson(req, res, 200, validation.data, validation.data.state === "ready"
            ? { "Cache-Control": "public, max-age=300, s-maxage=3600" }
            : noStoreHeaders());
        }
        if (url.pathname === "/api/valorant/leaderboard") {
          const candidate = input.valorantPublic
            ? await input.valorantPublic.leaderboard(url.searchParams)
            : { state: appConfig.riot.valorantProductionApproved ? "data_unavailable" : "approval_pending" } as const;
          const response = validateValorantLeaderboardResponse(candidate);
          if (!response.ok) throw new Error(`valorant_leaderboard_response_invalid:${response.error}`);
          return sendJson(req, res, 200, response.data, response.data.state === "ready"
            ? { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=1800" }
            : noStoreHeaders());
        }
        if (url.pathname === "/api/valorant/streamers") {
          if (url.search) throw new ValorantPublicQueryError("invalid_query");
          const candidate = input.valorantPublic
            ? await input.valorantPublic.streamers()
            : { state: appConfig.riot.valorantProductionApproved ? "data_unavailable" : "approval_pending" } as const;
          const response = validateValorantStreamerListResponse(candidate);
          if (!response.ok) throw new Error(`valorant_streamer_response_invalid:${response.error}`);
          return sendJson(req, res, 200, response.data, noStoreHeaders());
        }
        const match = /^\/api\/valorant\/streamers\/([a-f0-9]{32})\/matches$/u.exec(url.pathname);
        if (match?.[1]) {
          const candidate = input.valorantPublic
            ? await input.valorantPublic.streamerMatches(match[1], url.searchParams)
            : { state: appConfig.riot.valorantProductionApproved ? "data_unavailable" : "approval_pending" } as const;
          if (!candidate) return sendJson(req, res, 404, { error: "not_found" }, noStoreHeaders());
          const response = validateValorantStreamerMatchesResponse(candidate);
          if (!response.ok) throw new Error(`valorant_matches_response_invalid:${response.error}`);
          return sendJson(req, res, 200, response.data, noStoreHeaders());
        }
        return sendJson(req, res, 404, { error: "not found" });
      }
      if (req.method === "GET" && url.pathname.startsWith("/api/palworld/")) {
        const palworldData = input.palworldDataService;
        if (!palworldData) {
          return sendJson(req, res, 503, PALWORLD_DATA_UNAVAILABLE_RESPONSE, { "Cache-Control": "no-store" });
        }
        const activeMeta = palworldData.meta();
        const requestTarget = `${url.pathname}${url.search}`;
        const cacheHeadersFor = (payload: unknown) => palworldCacheHeaders(
          activeMeta.metadata,
          requestTarget,
          payload,
          activeMeta.domains
        );
        if (url.pathname === "/api/palworld/meta") {
          return sendJson(req, res, 200, activeMeta, cacheHeadersFor(activeMeta));
        }
        if (url.pathname === "/api/palworld/map/markers") {
          const query = parsePalworldMapMarkersQuery(url.searchParams);
          const candidate: PalworldMapMarkersResponse = input.palworldMapMarkerProvider?.response(
            query.world,
            activeMeta.metadata
          ) ?? {
            state: "data_unavailable",
            world: query.world,
            markers: [],
            metadata: activeMeta.metadata
          };
          const validation = validatePalworldMapMarkersResponse(candidate);
          if (!validation.ok) {
            throw new TypeError(`Palworld 지도 marker 응답 검증에 실패했습니다. ${validation.error}`);
          }
          return sendJson(
            req,
            res,
            200,
            validation.data,
            validation.data.state === "data_unavailable"
              ? palworldNoStoreHeaders(cacheHeadersFor(validation.data))
              : cacheHeadersFor(validation.data)
          );
        }
        if (url.pathname === "/api/palworld/map/locations") {
          const query = parsePalworldMapLocationsQuery(url.searchParams);
          const candidate: PalworldMapLocationsResponse =
            input.palworldMapLocationsProvider?.response(
              query.world,
              query.layers,
              query.offset,
              query.limit,
              activeMeta.metadata
            ) ?? {
              state: "data_unavailable",
              world: query.world,
              layers: query.layers,
              offset: query.offset,
              limit: query.limit,
              total: 0,
              returned: 0,
              hasMore: false,
              locations: [],
              metadata: activeMeta.metadata
            };
          const validation = validatePalworldMapLocationsResponse(candidate);
          if (!validation.ok) {
            throw new TypeError(
              `Palworld 지도 위치 응답 검증에 실패했습니다. ${validation.error}`
            );
          }
          return sendJson(
            req,
            res,
            200,
            validation.data,
            validation.data.state === "data_unavailable"
              ? palworldNoStoreHeaders(cacheHeadersFor(validation.data))
              : cacheHeadersFor(validation.data)
          );
        }
        if (url.pathname === "/api/palworld/map/spawns") {
          const query = parsePalworldPalSpawnQuery(url.searchParams);
          const canonicalPalId = palworldData.getPal(query.pal).id;
          const candidate: PalworldPalSpawnResponse = input.palworldSpawnProvider?.response(
            query.world,
            canonicalPalId,
            activeMeta.metadata
          ) ?? {
            state: "data_unavailable",
            world: query.world,
            palId: canonicalPalId,
            gridSize: PALWORLD_PAL_SPAWN_GRID_SIZE,
            totalPlacements: 0,
            points: [],
            metadata: activeMeta.metadata
          };
          const validation = validatePalworldPalSpawnResponse(candidate);
          if (!validation.ok) {
            throw new TypeError(`Palworld 일반 스폰 응답 검증에 실패했습니다. ${validation.error}`);
          }
          return sendJson(
            req,
            res,
            200,
            validation.data,
            validation.data.state === "data_unavailable"
              ? palworldNoStoreHeaders(cacheHeadersFor(validation.data))
              : cacheHeadersFor(validation.data)
          );
        }
        if (url.pathname === "/api/palworld/search") {
          const query = parsePalworldSearchQuery(url.searchParams);
          const response = palworldData.search(query.q, query.limit);
          return sendJson(req, res, 200, response, cacheHeadersFor(response));
        }
        if (url.pathname === "/api/palworld/pals") {
          const query = parsePalworldPalListQuery(url.searchParams);
          const response = palworldData.listPals(query);
          return sendJson(req, res, 200, response, cacheHeadersFor(response));
        }
        const palworldPalDetailMatch = url.pathname.match(/^\/api\/palworld\/pals\/([^/]+)$/);
        if (palworldPalDetailMatch?.[1]) {
          const decodedId = decodeUrlPathSegment(palworldPalDetailMatch[1]);
          if (decodedId === undefined) throw new PalworldQueryError("Pal ID 인코딩이 올바르지 않습니다.");
          const response = palworldData.getPal(parsePalworldId(decodedId, "Pal ID"));
          return sendJson(req, res, 200, response, cacheHeadersFor(response));
        }
        if (url.pathname === "/api/palworld/items") {
          const query = parsePalworldItemListQuery(url.searchParams);
          const response = palworldData.listItems(query);
          return sendJson(req, res, 200, response, cacheHeadersFor(response));
        }
        if (url.pathname === "/api/palworld/technology") {
          const query = parsePalworldTechnologyListQuery(url.searchParams);
          const response = palworldData.listTechnologyUnlocks(query);
          return sendJson(req, res, 200, response, cacheHeadersFor(response));
        }
        const palworldItemDetailMatch = url.pathname.match(/^\/api\/palworld\/items\/([^/]+)$/);
        if (palworldItemDetailMatch?.[1]) {
          const decodedId = decodeUrlPathSegment(palworldItemDetailMatch[1]);
          if (decodedId === undefined) throw new PalworldQueryError("아이템 ID 인코딩이 올바르지 않습니다.");
          const response = palworldData.getItem(parsePalworldId(decodedId, "아이템 ID"));
          return sendJson(req, res, 200, response, cacheHeadersFor(response));
        }
        if (url.pathname === "/api/palworld/skills") {
          const query = parsePalworldSkillListQuery(url.searchParams);
          const response = palworldData.listSkills(query);
          return sendJson(req, res, 200, response, cacheHeadersFor(response));
        }
        const palworldSkillDetailMatch = url.pathname.match(/^\/api\/palworld\/skills\/([^/]+)$/);
        if (palworldSkillDetailMatch?.[1]) {
          const decodedId = decodeUrlPathSegment(palworldSkillDetailMatch[1]);
          if (decodedId === undefined) throw new PalworldQueryError("스킬 ID 인코딩이 올바르지 않습니다.");
          const response = palworldData.getSkill(parsePalworldId(decodedId, "스킬 ID"));
          return sendJson(req, res, 200, response, cacheHeadersFor(response));
        }
        if (url.pathname === "/api/palworld/breeding/parents") {
          const query = parsePalworldBreedingParentsQuery(url.searchParams);
          const response = palworldData.breedingParents(query);
          return sendJson(
            req,
            res,
            200,
            response,
            response.state === "data_unavailable"
              ? palworldNoStoreHeaders(cacheHeadersFor(response))
              : cacheHeadersFor(response)
          );
        }
        if (url.pathname === "/api/palworld/breeding/partners") {
          const query = parsePalworldBreedingPartnersQuery(url.searchParams);
          const response = palworldData.breedingPartners(query);
          return sendJson(
            req,
            res,
            200,
            response,
            response.state === "data_unavailable"
              ? palworldNoStoreHeaders(cacheHeadersFor(response))
              : cacheHeadersFor(response)
          );
        }
        if (url.pathname === "/api/palworld/breeding") {
          const query = parsePalworldBreedingQuery(url.searchParams);
          const response = palworldData.breeding(query);
          return sendJson(
            req,
            res,
            200,
            response,
            response.state === "data_unavailable"
              ? palworldNoStoreHeaders(cacheHeadersFor(response))
              : cacheHeadersFor(response)
          );
        }
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
      if (await handlePalworldServerDashboardApi(req, res, url, auth.principal)) return;
      if (url.pathname === "/api/admin/audit-logs" && req.method === "GET") {
        if (auth.principal.type !== "DASHBOARD_ADMIN" || auth.principal.role !== "admin") {
          return sendJson(req, res, 403, {
            error: "관리자 권한이 필요합니다.",
            code: "FORBIDDEN"
          }, noStoreHeaders());
        }
        if (!input.adminAuditLogs || input.discordDatabaseReady?.() === false) {
          return sendJson(req, res, 503, {
            error: "감사 로그를 사용할 수 없습니다.",
            code: "AUDIT_LOGS_UNAVAILABLE"
          }, noStoreHeaders());
        }
        try {
          const response = await input.adminAuditLogs.list(parseAdminAuditLogQuery(url.searchParams));
          return sendJson(req, res, 200, response, noStoreHeaders());
        } catch (error) {
          if (error instanceof AdminAuditLogQueryError) {
            return sendJson(req, res, 400, {
              error: "감사 로그 조회 조건이 올바르지 않습니다.",
              code: error.code
            }, noStoreHeaders());
          }
          input.logger?.error({
            type: "admin.audit_logs.read_failed",
            errorCode: error instanceof SafeDatabaseError ? error.code : "AUDIT_LOGS_UNAVAILABLE"
          });
          return sendJson(req, res, 503, {
            error: "감사 로그를 사용할 수 없습니다.",
            code: "AUDIT_LOGS_UNAVAILABLE"
          }, noStoreHeaders());
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
          http: 0
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
        const rawRiotId = url.searchParams.get("riotId")?.trim() ?? "";
        const profileToken = url.searchParams.get("token")?.trim() ?? "";
        if (Boolean(rawRiotId) === Boolean(profileToken)) {
          throw new HttpRequestError(400, {
            error: "Riot ID 또는 profile token 중 하나만 입력해야 합니다.",
            code: "LOL_PROFILE_LINK_INPUT_INVALID",
          });
        }
        let routing = publicLolRouting(url.searchParams.get("platform"), input.riot);
        let resolvedRiotId = rawRiotId;
        if (profileToken) {
          let linked: ReturnType<typeof publicLolProfileFromToken>;
          try {
            linked = publicLolProfileFromToken(profileToken);
          } catch {
            throw new HttpRequestError(400, {
              error: "전적 공유 링크가 올바르지 않거나 만료되었습니다.",
              code: "LOL_PROFILE_LINK_INVALID",
            });
          }
          if (url.searchParams.has("platform") && routing.lolPlatform !== linked.lolPlatform) {
            throw new HttpRequestError(400, {
              error: "전적 공유 링크의 서버 정보가 일치하지 않습니다.",
              code: "LOL_PROFILE_LINK_PLATFORM_MISMATCH",
            });
          }
          routing = publicLolRouting(linked.lolPlatform, input.riot);
          resolvedRiotId = linked.riotId;
        }
        const profile = withPublicLolProfileToken(await getPublicLolProfile(resolvedRiotId, routing, { refresh }));
        return sendJson(req, res, 200, profile, publicLolProfileCacheHeaders(profile, refresh));
      }
      if (req.method === "GET" && url.pathname === "/api/lol/profile-state") {
        const routing = publicLolRouting(url.searchParams.get("platform"), input.riot);
        return sendJson(req, res, 200, await getPublicLolProfileDynamicState(url.searchParams.get("riotId") ?? "", routing));
      }
      if (req.method === "GET" && url.pathname === "/api/lol/matches") {
        const routing = publicLolRouting(url.searchParams.get("platform"), input.riot);
        const queueFilter = publicLolMatchQueueFilter(url.searchParams.get("queue"));
        const page = await getPublicLolMatchPage(
          url.searchParams.get("riotId") ?? "",
          publicLolMatchStart(url.searchParams.get("start")),
          routing,
          queueFilter
        );
        return sendJson(req, res, 200, page, publicLolCacheHeaders("matches", page));
      }
      if (req.method === "GET" && url.pathname === "/api/lol/match-ranks") {
        const ranks = await getPublicLolMatchRanks(url.searchParams.get("matchId") ?? "");
        return sendJson(req, res, 200, ranks, publicLolCacheHeaders("match-ranks", ranks, "public, max-age=300, stale-while-revalidate=1800"));
      }
      if (req.method === "GET" && url.pathname === "/api/lol/match-build") {
        const build = await getPublicLolMatchBuild(url.searchParams.get("matchId") ?? "");
        return sendJson(req, res, 200, build, publicLolCacheHeaders("match-build", build, "public, max-age=3600, stale-while-revalidate=86400"));
      }
      if (req.method === "GET" && url.pathname === "/api/lol/match-detail") {
        const detail = await buildPublicLolMatchTeams(
          url.searchParams.get("matchId") ?? "",
          url.searchParams.get("riotId") ?? ""
        );
        return sendJson(req, res, 200, detail, publicLolCacheHeaders("match-detail", detail, "public, max-age=300, stale-while-revalidate=1800"));
      }
      if (req.method === "GET" && url.pathname === "/api/lol/suggestions") {
        const routing = publicLolRouting(url.searchParams.get("platform"), input.riot);
        return sendJson(req, res, 200, { suggestions: await buildPublicLolSuggestions(url.searchParams.get("q") ?? "", routing) });
      }
      if (req.method === "GET" && url.pathname === "/api/public/locale") {
        return sendJson(req, res, 200, publicLocalePreference(req));
      }
      if (req.method === "GET" && url.pathname === "/api/public/aram/augments") {
        if (!aramAugmentCatalog) {
          return sendJson(req, res, 503, {
            error: "ARAM_DATA_UNAVAILABLE",
            message: "칼바람 데이터를 사용할 수 없습니다."
          }, { "Cache-Control": "no-store" });
        }
        return sendJson(req, res, 200, aramAugmentCatalog, {
          "Cache-Control": aramAugmentCatalog.status === "ready"
            ? "public, max-age=300, stale-while-revalidate=3600"
            : "no-store"
        });
      }
      /* ── 반응속도 기록·리더보드·공유 (목업 reaction-test.html v5 §④-2~④-5) ──
       *
       * 저장소가 없으면(로컬 DB 비활성 등) 503 입니다. 프런트는 리더보드 조회
       * 실패 시 기록 UI 전체를 숨기므로(fail-closed), 반쯤 동작하는 화면이
       * 남지 않습니다.
       *
       * 공개 응답에는 계정 식별자를 절대 싣지 않습니다(§④-5). 익명 기록은
       * anonymousLabel 만, 공개 기록도 Twitch 표시 이름까지만 나갑니다.
       */
      if (url.pathname === "/api/games/reaction/leaderboard") {
        if (req.method !== "GET") return sendJson(req, res, 405, { error: "method not allowed" });
        if (!input.reactionRecords) {
          return sendJson(req, res, 503, {
            error: "반응속도 기록 저장소를 사용할 수 없습니다.",
            code: "feature_unavailable"
          }, noStoreHeaders());
        }
        const requestedLimit = Number(url.searchParams.get("limit") ?? "50");
        const limit = Number.isSafeInteger(requestedLimit)
          ? Math.max(1, Math.min(100, requestedLimit))
          : 50;
        const [rows, stats] = await Promise.all([
          input.reactionRecords.leaderboard(limit),
          input.reactionRecords.stats()
        ]);
        const entries = rows.map((row) => reactionLeaderboardEntry(row));

        let me: unknown;
        const viewer = await reactionViewer(req);
        if (viewer) {
          const mine = await input.reactionRecords.findByUser(viewer.userId);
          if (mine) {
            me = {
              ...reactionLeaderboardEntry(mine),
              shareId: mine.shareId,
              identity: mine.identity
            };
          }
        }

        return sendJson(req, res, 200, {
          entries,
          ...(me ? { me } : {}),
          total: stats.total,
          tierDistribution: reactionTierDistribution(stats.averages)
        }, viewer
          /* me 가 섞이는 응답은 사용자마다 다르므로 공유 캐시에 올리면 안 됩니다. */
          ? noStoreHeaders()
          : { "Cache-Control": "public, max-age=60" });
      }

      if (url.pathname === "/api/games/reaction/records") {
        if (req.method !== "POST") return sendJson(req, res, 405, { error: "method not allowed" });
        if (!input.reactionRecords) {
          return sendJson(req, res, 503, {
            error: "반응속도 기록 저장소를 사용할 수 없습니다.",
            code: "feature_unavailable"
          }, noStoreHeaders());
        }
        const viewer = await requireReactionViewer(req);
        const submission = parseReactionSubmission(await readJsonBody<unknown>(req, 4 * 1_024));
        if (!submission) {
          return sendJson(req, res, 400, {
            error: "기록 형식이 올바르지 않습니다.",
            code: "invalid_request"
          }, noStoreHeaders());
        }
        /* 계정당 1분 1회 — 자동화로 리더보드를 채우는 것을 막습니다. */
        const now = Date.now();
        const availableAt = reactionSubmitAvailableAt.get(viewer.userId) ?? 0;
        if (availableAt > now) {
          return sendJson(req, res, 429, {
            error: "기록 등록은 1분에 한 번만 가능합니다.",
            code: "rate_limited",
            retryAfterMs: availableAt - now
          }, { ...noStoreHeaders(), "Retry-After": String(Math.ceil((availableAt - now) / 1_000)) });
        }
        reactionSubmitAvailableAt.set(viewer.userId, now + REACTION_SUBMIT_COOLDOWN_MS);
        pruneMapToMax(reactionSubmitAvailableAt, 10_000);

        const saved = await input.reactionRecords.upsert({
          userId: viewer.userId,
          averageMs: submission.averageMs,
          samples: submission.samples,
          identity: submission.identity
        });
        const stats = await input.reactionRecords.stats();
        const percentile = reactionPercentile(saved.rank, stats.total);
        return sendJson(req, res, 200, {
          shareId: saved.shareId,
          rank: saved.rank,
          ...(percentile === undefined ? {} : { percentile })
        }, noStoreHeaders());
      }

      if (url.pathname === "/api/games/reaction/records/me") {
        if (req.method !== "DELETE") return sendJson(req, res, 405, { error: "method not allowed" });
        if (!input.reactionRecords) {
          return sendJson(req, res, 503, {
            error: "반응속도 기록 저장소를 사용할 수 없습니다.",
            code: "feature_unavailable"
          }, noStoreHeaders());
        }
        const viewer = await requireReactionViewer(req);
        await input.reactionRecords.deleteByUser(viewer.userId);
        /* 있든 없든 204 — 존재 여부를 알려 주면 계정 탐색 단서가 됩니다. */
        res.writeHead(204, noStoreHeaders());
        res.end();
        return;
      }

      if (req.method === "GET" && url.pathname.startsWith("/api/games/reaction/records/")) {
        if (!input.reactionRecords) {
          return sendJson(req, res, 503, {
            error: "반응속도 기록 저장소를 사용할 수 없습니다.",
            code: "feature_unavailable"
          }, noStoreHeaders());
        }
        const shareId = decodeURIComponent(url.pathname.slice("/api/games/reaction/records/".length));
        const shared = await reactionSharedRecord(shareId);
        if (!shared) {
          return sendJson(req, res, 404, { error: "기록을 찾을 수 없습니다.", code: "not_found" }, noStoreHeaders());
        }
        return sendJson(req, res, 200, shared, { "Cache-Control": "public, max-age=60" });
      }

      if (req.method === "GET" && url.pathname === "/api/public/game-boxart") {
        /* 홈 카테고리 타일의 트위치 박스아트(안 B). 실패·미구성은 null — 프런트가
           자체 키아트·마크 타일로 폴백하므로 이 응답이 화면을 막지 않습니다. */
        if (!input.gameBoxart) {
          return sendJson(req, res, 200, { games: [] }, { "Cache-Control": "public, max-age=300" });
        }
        const games = await input.gameBoxart.getBoxart();
        const anyHit = games.some((game) => game.boxArtUrl !== null);
        return sendJson(req, res, 200, { games }, {
          /* 박스아트는 사실상 불변 — 성공은 공용 캐시 1h, 실패는 5m 뒤 재시도. */
          "Cache-Control": anyHit
            ? "public, max-age=3600, stale-while-revalidate=86400"
            : "public, max-age=300"
        });
      }
      if (req.method === "GET" && url.pathname === "/api/public/patch-notes") {
        if (!input.patchNotes) {
          return sendJson(req, res, 503, {
            error: "PATCH_NOTES_UNAVAILABLE",
            message: "패치 노트를 사용할 수 없습니다."
          }, { "Cache-Control": "no-store" });
        }
        const requested = url.searchParams.get("locale");
        /* 목록에 없는 값은 무시하고 방문자 언어로 되돌립니다. 임의 값이 수집기로 들어가지 않습니다. */
        const explicitLocale = patchNoteLocaleFrom(requested);
        const locale: PatchNoteLocale = explicitLocale
          ?? publicLocalePreference(req).locale;
        const feed = await input.patchNotes.getFeed(locale);
        if (!feed) {
          return sendJson(req, res, 503, {
            error: "PATCH_NOTES_UNAVAILABLE",
            message: "패치 노트를 아직 받아오지 못했습니다."
          }, { "Cache-Control": "no-store" });
        }
        return sendJson(req, res, 200, feed, {
          /* 언어가 query 로 오면 URL 이 응답을 결정하므로 공용 캐시에 둘 수 있습니다.
             요청 header 로 언어를 고른 경우에는 같은 URL 이 사람마다 다른 본문을 내므로
             공용 캐시에 두면 한국어 방문자에게 일본어가 나갈 수 있습니다. */
          "Cache-Control": explicitLocale
            ? (feed.stale ? "public, max-age=60" : "public, max-age=900, stale-while-revalidate=21600")
            : (feed.stale ? "private, max-age=60" : "private, max-age=900"),
          Vary: "Accept-Language"
        });
      }
      if (req.method === "GET" && url.pathname === "/api/public/patch-notes/keyart") {
        /* 공유 카드가 키 아트를 캔버스에 그리려면 같은 origin 에서 받아야 합니다 —
           Riot CDN 은 CORS 헤더를 주지 않아 canvas 가 오염됩니다(2026-08-18 실측).
           대상 URL 은 이용자 입력이 아니라 우리가 수집한 노트의 imageUrl 이고,
           공유 카드가 쓰는 것과 같은 allowlist·타임아웃·크기 상한을 지납니다. */
        const patchVersion = url.searchParams.get("patch") ?? "";
        if (!/^\d{1,3}\.\d{1,3}$/u.test(patchVersion)) {
          return sendJson(req, res, 400, {
            error: "패치 번호 형식이 올바르지 않습니다.",
            code: "INVALID_PATCH_VERSION"
          }, { "Cache-Control": "no-store" });
        }
        const keyArtLocale = patchNoteLocaleFrom(url.searchParams.get("locale")) ?? "ko";
        const feed = input.patchNotes ? await input.patchNotes.getFeed(keyArtLocale) : undefined;
        const note = feed?.notes.find((candidate) => candidate.patchVersion === patchVersion);
        /* 패치 번호가 없는 노트는 카드 모델이 만들어지지 않습니다(형식 미달). */
        const keyArtModel = note ? patchNotesCardModel(note) : undefined;
        const keyArt = keyArtModel
          ? await patchNotesSocialCardRenderer.keyArt(keyArtModel).catch(() => undefined)
          : undefined;
        if (!keyArt) {
          /* 키 아트가 없으면 화면은 그라디언트 폴백으로 닫힙니다 — 카드는 정상입니다. */
          return sendJson(req, res, 404, {
            error: "해당 패치의 키 아트가 없습니다.",
            code: "PATCH_KEYART_NOT_FOUND"
          }, { "Cache-Control": "public, max-age=600" });
        }
        const keyArtEtag = `"patch-keyart-${keyArtLocale}-${patchVersion}"`;
        if (req.headers["if-none-match"] === keyArtEtag) {
          res.writeHead(304, { ETag: keyArtEtag, "Cache-Control": "public, max-age=86400" });
          res.end();
          return true;
        }
        res.writeHead(200, {
          "Content-Type": "image/png",
          "Content-Length": String(keyArt.length),
          ETag: keyArtEtag,
          /* 패치 번호가 URL 에 있으므로 새 패치는 새 URL 입니다. */
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"
        });
        res.end(keyArt);
        return true;
      }
      if (req.method === "GET" && url.pathname === "/api/public/patch-notes/changes") {
        /* 경로가 /summary 가 아니라 /changes 인 이유: summary 는 이미 패치별 개인
           전적이 쓰고 있습니다(바로 아래). 이쪽은 공개 데이터 계산 결과라 캐시
           정책도 반대입니다 — 누구에게나 같은 값이므로 공용 캐시에 둡니다. */
        const patchVersion = url.searchParams.get("patch") ?? "";
        if (!/^\d{1,3}\.\d{1,3}$/u.test(patchVersion)) {
          return sendJson(req, res, 400, {
            error: "패치 번호 형식이 올바르지 않습니다.",
            code: "INVALID_PATCH_VERSION"
          }, { "Cache-Control": "no-store" });
        }
        if (!input.patchChangeSummary) {
          return sendJson(req, res, 503, {
            error: "패치 변경 요약을 사용할 수 없습니다.",
            code: "PATCH_CHANGES_UNAVAILABLE"
          }, { "Cache-Control": "no-store" });
        }
        const changesLocale = patchNoteLocaleFrom(url.searchParams.get("locale")) ?? "ko";
        const changes = await input.patchChangeSummary.summaryFor(patchVersion, changesLocale)
          .catch(() => undefined);
        /* 비교 경계를 못 잡았거나 변경이 0건이면 보여 줄 것이 없습니다. 프런트는
           404 를 받으면 패널을 통째로 숨깁니다(빈 패널 금지). */
        if (!changes) {
          return sendJson(req, res, 404, {
            error: "해당 패치의 변경 요약이 없습니다.",
            code: "PATCH_CHANGES_NOT_FOUND"
          }, { "Cache-Control": "public, max-age=600" });
        }
        return sendJson(req, res, 200, changes, {
          /* locale 이 URL 에 있으므로 URL 이 응답을 결정합니다 — 공용 캐시 가능.
             패치가 나오기 전에는 값이 바뀌지 않아 길게 잡습니다. */
          "Cache-Control": "public, max-age=21600, stale-while-revalidate=86400"
        });
      }
      if (req.method === "GET" && url.pathname === "/api/public/patch-notes/summary") {
        const summary = await buildPatchPlaySummary(
          url.searchParams.get("riotId") ?? "",
          publicLolRouting(url.searchParams.get("platform"), input.riot)
        );
        return sendJson(req, res, 200, summary, {
          /* 개인 전적입니다. 공용 캐시에 남기지 않습니다. */
          "Cache-Control": "private, max-age=60"
        });
      }
      if (url.pathname === "/api/public/streamers" || url.pathname.startsWith("/api/public/streamers/")) {
        const segments = url.pathname.slice("/api/public/streamers".length).split("/").filter(Boolean);
        if (req.method === "GET" && segments.length === 0) {
          /* 목록은 사람마다 다릅니다(로그인 여부로 channelUrl 이 갈리고 voted 가 붙습니다).
             공용 캐시에 넣으면 남의 상태를 보게 됩니다. */
          return sendJson(req, res, 200, await getStreamerBoardList(req, url), {
            "Cache-Control": "private, no-store"
          });
        }
        if (req.method === "POST" && segments.length === 0) {
          return sendJson(req, res, 201, await createStreamerBoardPost(req), {
            "Cache-Control": "private, no-store"
          });
        }
        const postId = segments[0];
        if (postId && isStreamerPostId(postId)) {
          if (req.method === "GET" && segments.length === 1) {
            return sendJson(req, res, 200, await getStreamerBoardPost(req, postId), {
              "Cache-Control": "private, no-store"
            });
          }
          if (req.method === "GET" && segments.length === 2 && segments[1] === "avatar") {
            const avatar = await streamerBoardAvatar(postId);
            if (!avatar) {
              /* 이미지가 없으면 화면이 플랫폼 마크로 닫습니다 — 정상 경로입니다. */
              return sendJson(req, res, 404, { error: "not found" }, { "Cache-Control": "public, max-age=600" });
            }
            if (req.headers["if-none-match"] === avatar.etag) {
              res.writeHead(304, { ETag: avatar.etag, "Cache-Control": "public, max-age=3600" });
              res.end();
              return true;
            }
            res.writeHead(200, {
              "Content-Type": avatar.contentType,
              "Content-Length": String(avatar.body.length),
              ETag: avatar.etag,
              "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
              ...SECURITY_HEADERS
            });
            res.end(avatar.body);
            return true;
          }
          if (req.method === "POST" && segments.length === 2 && segments[1] === "vote") {
            return sendJson(req, res, 200, await voteStreamerBoardPost(req, postId));
          }
          if (req.method === "POST" && segments.length === 2 && segments[1] === "comments") {
            return sendJson(req, res, 201, await createStreamerBoardComment(req, postId));
          }
          const commentId = segments[2];
          if (
            req.method === "POST"
            && segments.length === 4
            && segments[1] === "comments"
            && segments[3] === "report"
            && commentId
            && isStreamerPostId(commentId)
          ) {
            return sendJson(req, res, 202, await reportStreamerBoardComment(req, postId, commentId));
          }
        }
        return sendJson(req, res, 404, { error: "not found" });
      }
      if (req.method === "GET" && url.pathname === "/api/public/participation/state") {
        return sendJson(req, res, 200, await getPublicParticipationState(req));
      }
      if (url.pathname === "/api/twitch-extension/viewer") {
        if (url.search) {
          return sendJson(req, res, 400, {
            error: "query는 허용되지 않습니다.",
            code: "INVALID_REQUEST"
          });
        }
        if (req.method !== "GET") {
          return sendJson(req, res, 405, { error: "method not allowed" });
        }
        const principal = requireTwitchExtensionPrincipal(req);
        return sendJson(
          req,
          res,
          200,
          await twitchExtensionViewerResponse(principal),
          noStoreHeaders()
        );
      }
      if (url.pathname === "/api/twitch-extension/join") {
        if (url.search) {
          return sendJson(req, res, 400, {
            error: "query는 허용되지 않습니다.",
            code: "INVALID_REQUEST"
          });
        }
        if (req.method !== "POST") {
          return sendJson(req, res, 405, { error: "method not allowed" });
        }
        const principal = requireTwitchExtensionPrincipal(req, { mutation: true });
        return sendJson(
          req,
          res,
          200,
          await joinTwitchExtensionParticipation(req, principal),
          noStoreHeaders()
        );
      }
      if (url.pathname === "/api/twitch-extension/cancel") {
        if (url.search) {
          return sendJson(req, res, 400, {
            error: "query는 허용되지 않습니다.",
            code: "INVALID_REQUEST"
          });
        }
        if (req.method !== "POST") {
          return sendJson(req, res, 405, { error: "method not allowed" });
        }
        const principal = requireTwitchExtensionPrincipal(req, { mutation: true });
        return sendJson(
          req,
          res,
          200,
          await cancelTwitchExtensionParticipation(req, principal),
          noStoreHeaders()
        );
      }
      if (req.method === "GET" && url.pathname === "/api/public/participation/discovery") {
        if ((url.searchParams.get("scope") ?? "followed") !== "followed") {
          return sendJson(req, res, 400, { error: "지원하지 않는 참여 탐색 범위입니다.", code: "INVALID_SCOPE" });
        }
        return sendJson(req, res, 200, await getPublicParticipationDiscovery(req));
      }
      const publicParticipationSessionMatch = url.pathname.match(
        /^\/api\/public\/participation\/sessions\/([^/]+)(?:\/(join|cancel|check-in|rejoin|skip))?$/u
      );
      if (publicParticipationSessionMatch) {
        let publicSessionId = "";
        try {
          publicSessionId = decodeURIComponent(publicParticipationSessionMatch[1] ?? "");
        } catch {
          return sendJson(req, res, 400, { error: "참여 세션 주소가 올바르지 않습니다.", code: "INVALID_SESSION_ID" });
        }
        const action = publicParticipationSessionMatch[2];
        const session = participationRepository.getSession(publicSessionId);
        if (!session) {
          return sendJson(req, res, 404, { error: "참여 세션을 찾을 수 없습니다.", code: "SESSION_NOT_FOUND" });
        }
        if (req.method === "GET" && !action) {
          return sendJson(req, res, 200, await getPublicParticipationState(req, undefined, session.streamerId, session.publicSessionId));
        }
        if (req.method === "POST" && action) {
          if (!stateChangingRequestHasTrustedOrigin(req)) {
            return sendJson(req, res, 403, { error: "trusted Origin이 필요합니다.", code: "origin_denied" });
          }
          if (action === "join") return sendJson(req, res, 200, await joinPublicParticipation(req, session.publicSessionId));
          if (action === "rejoin") return sendJson(req, res, 200, await joinPublicParticipation(req, session.publicSessionId, true));
          if (action === "cancel") return sendJson(req, res, 200, await cancelPublicParticipation(req, session.publicSessionId));
          if (action === "check-in") return sendJson(req, res, 200, { ok: true, state: await checkInPublicParticipation(req, session.publicSessionId) });
          if (action === "skip") return sendJson(req, res, 200, await skipPublicParticipation(req, session.publicSessionId));
        }
        return sendJson(req, res, 405, { error: "method not allowed" });
      }
      if (req.method === "POST" && url.pathname === "/api/public/participation/join") {
        if (!stateChangingRequestHasTrustedOrigin(req)) {
          return sendJson(req, res, 403, { error: "trusted Origin이 필요합니다.", code: "origin_denied" });
        }
        return sendJson(req, res, 200, await joinPublicParticipation(req));
      }
      if (req.method === "POST" && url.pathname === "/api/public/participation/cancel") {
        if (!stateChangingRequestHasTrustedOrigin(req)) {
          return sendJson(req, res, 403, { error: "trusted Origin이 필요합니다.", code: "origin_denied" });
        }
        return sendJson(req, res, 200, await cancelPublicParticipation(req));
      }
      if (req.method === "GET" && url.pathname === "/api/public/twitch/status") {
        return sendJson(req, res, 200, await getPublicTwitchViewerStatus(req));
      }
      if (req.method === "GET" && url.pathname === "/api/public/twitch/followed-lol") {
        const limit = Number(url.searchParams.get("limit") ?? "100");
        const includeSubscriptions = url.searchParams.get("includeSubscriptions") !== "0";
        return sendJson(req, res, 200, await getPublicTwitchFollowedLol(limit, req, includeSubscriptions));
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
        const yoroOauthCookieValue = requestCookie(req, YORO_OAUTH_COOKIE);
        if (yoroOauthCookieValue && input.yoroAccounts) {
          if (url.searchParams.has("error")) {
            return sendRedirect(
              res,
              yoroAccountReturnUrl("/login", "oauth_failed"),
              {
                "Set-Cookie": clearYoroCookie(YORO_OAUTH_COOKIE),
                "Cache-Control": "no-store"
              }
            );
          }
          try {
            const completed = await input.yoroAccounts.completeOAuth({
              provider: "twitch",
              state: url.searchParams.get("state") ?? "",
              code: url.searchParams.get("code") ?? "",
              oauthCookie: yoroOauthCookieValue
            });
            return sendRedirect(
              res,
              yoroAccountReturnUrl(completed.returnPath, undefined, "twitch"),
              {
                "Set-Cookie": [
                  clearYoroCookie(YORO_OAUTH_COOKIE),
                  yoroSessionCookie(completed.sessionToken)
                ],
                "Cache-Control": "no-store"
              }
            );
          } catch {
            return sendRedirect(
              res,
              yoroAccountReturnUrl("/login", "oauth_failed"),
              {
                "Set-Cookie": clearYoroCookie(YORO_OAUTH_COOKIE),
                "Cache-Control": "no-store"
              }
            );
          }
        }
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
              participation: input.store.getParticipationState(streamerId).isOpen ? "open" : "closed"
            }
          : status);
      }
      if (req.method === "GET" && url.pathname === "/api/rewards/mappings") return sendJson(req, res, 200, getRewardMappingSummaries());
      if (req.method === "GET" && url.pathname === "/api/events/recent") return sendJson(req, res, 200, input.store.recentEvents(50));
      if (req.method === "GET" && url.pathname === "/api/actions/recent") return sendJson(req, res, 200, input.store.recentActions(50));
      if (req.method === "GET" && url.pathname === "/api/questions") return sendJson(req, res, 200, input.store.getQuestions());
      if (req.method === "GET" && url.pathname === "/api/highlights") return sendJson(req, res, 200, input.store.getHighlights());
      if (req.method === "GET" && url.pathname === "/api/followers") {
        const broadcasterUserId = requireAuthenticatedStreamerOwner(auth.principal);
        return sendJson(req, res, 200, await followerManagementResponse(broadcasterUserId));
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
        if (body.chatLocale !== undefined) {
          if (!PARTICIPATION_CHAT_LOCALES.includes(body.chatLocale as ParticipationChatLocale)) {
            return sendJson(req, res, 400, { error: "지원하지 않는 봇 응답 언어입니다.", code: "INVALID_CHAT_LOCALE" });
          }
          patch.chatLocale = body.chatLocale as ParticipationChatLocale;
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
        return sendJson(
          req,
          res,
          200,
          await mutateParticipationSessionForOwner(streamerId, await readJsonBody<unknown>(req))
        );
      }
      if (req.method === "POST" && url.pathname === "/api/lol-operations/participation/entry-status") {
        const streamerId = requireAuthenticatedStreamerOwner(auth.principal);
        return sendJson(
          req,
          res,
          200,
          await mutateParticipationEntryForOwner(
            streamerId,
            await readJsonBody<unknown>(req),
            PARTICIPATION_ENTRY_STATUSES
          )
        );
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
        return sendJson(req, res, 200, streamerRiotIdRequestListResponse(url));
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
          const bodyChatLocale = (body as Record<string, unknown>).chatLocale;
          if (bodyChatLocale !== undefined) {
            if (!PARTICIPATION_CHAT_LOCALES.includes(bodyChatLocale as ParticipationChatLocale)) {
              return sendJson(req, res, 400, { error: "지원하지 않는 봇 응답 언어입니다.", code: "INVALID_CHAT_LOCALE" });
            }
            scopedPatch.chatLocale = bodyChatLocale as ParticipationChatLocale;
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
        if (!beforeRequest) return sendJson(req, res, 404, { error: "등록 요청을 찾을 수 없습니다." });
        const previousApprovedRequests = beforeRequests.filter((candidate) =>
          candidate.twitchUserId === beforeRequest.twitchUserId
          && candidate.status === "approved"
        );
        const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : undefined;
        const audit = await beginGlobalAdminAudit(
          auth.principal,
          "streamer.riot_id_request.resolved",
          beforeRequest.id,
          { decision: body.decision, noteProvided: Boolean(note) }
        );
        let request: StreamerRiotIdRequest | undefined;
        try {
          request = resolveStreamerRiotIdRequest({
            requestId: body.requestId,
            decision: body.decision,
            reviewer: "dashboard",
            note
          });
        } catch (error) {
          await completeGlobalAdminAudit(audit, "failed");
          throw error;
        }
        if (!request) {
          await completeGlobalAdminAudit(audit, "failed");
          return sendJson(req, res, 404, { error: "등록 요청을 찾을 수 없습니다." });
        }
        await completeGlobalAdminAudit(audit, "succeeded");
        /* 세션 강제 만료는 "대시보드 접근 근거가 사라졌을 때"의 조치입니다.
           서브 계정 row는 dashboardEnabled를 갖지 않으므로 이 조건에 항상 걸립니다 —
           서브 승인·거절은 대표 계정의 접근 근거와 무관하니 세션을 건드리지 않습니다.
           방송 중 서브 승인 한 건으로 스트리머가 로그아웃되는 사고를 막습니다. */
        if (!isSubStreamerRiotAccount(request) && (request.status !== "approved" || request.dashboardEnabled !== true)) {
          sessions.revokeByTwitchUserId(request.twitchUserId);
        }
        invalidatePublicLolProfileCachesForStreamer(request);
        for (const previousRequest of previousApprovedRequests) invalidatePublicLolProfileCachesForStreamer(previousRequest);
        return sendJson(req, res, 200, {
          request: streamerRiotIdRequestListItem(request),
          requests: listStreamerRiotIdRequests().map(streamerRiotIdRequestListItem)
        });
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
        const beforeRequest = listStreamerRiotIdRequests().find((candidate) =>
          candidate.id === body.requestId
          && candidate.status === "approved"
          && !isSubStreamerRiotAccount(candidate)
        );
        if (!beforeRequest) return sendJson(req, res, 404, { error: "승인된 등록 요청을 찾을 수 없습니다." });
        const audit = await beginGlobalAdminAudit(
          auth.principal,
          "streamer.dashboard_access.updated",
          beforeRequest.id,
          { dashboardEnabled: body.dashboardEnabled, noteProvided: Boolean(note) }
        );
        let request: StreamerRiotIdRequest | undefined;
        try {
          request = setStreamerRiotIdDashboardEnabled({
            requestId: body.requestId,
            dashboardEnabled: body.dashboardEnabled,
            reviewer: "dashboard",
            note
          });
        } catch (error) {
          await completeGlobalAdminAudit(audit, "failed");
          throw error;
        }
        if (!request) {
          await completeGlobalAdminAudit(audit, "failed");
          return sendJson(req, res, 404, { error: "승인된 등록 요청을 찾을 수 없습니다." });
        }
        await completeGlobalAdminAudit(audit, "succeeded");
        if (!request.dashboardEnabled) {
          sessions.revokeByTwitchUserId(request.twitchUserId);
        }
        invalidatePublicLolProfileCachesForStreamer(request);
        return sendJson(req, res, 200, {
          request: streamerRiotIdRequestListItem(request),
          requests: listStreamerRiotIdRequests().map(streamerRiotIdRequestListItem)
        });
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
        const refreshed = await refreshFollowerManagementForOwner(
          broadcasterUserId,
          url.searchParams.get("limit")
        );
        return sendJson(req, res, 200, refreshed.response, refreshed.headers);
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
        await input.store.flushRuntimeState();
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
        invalidatePublicLolProfileCachesForRiotId(updated.riotGameName, updated.riotTagLine);
        await input.store.flushRuntimeState();
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

      if (
        (req.method === "GET" || req.method === "HEAD")
        && !url.pathname.startsWith("/api/")
        && !url.pathname.startsWith("/internal/")
      ) {
        return sendPublicNotFoundPage(req, res, url.pathname);
      }
      return sendJson(req, res, 404, { error: "not found" });
    } catch (error) {
      if (error instanceof HttpRequestError) return sendJson(req, res, error.status, error.payload);
      if (error instanceof DiscordOnboardingError) {
        return sendJson(req, res, error.status, {
          error: "Discord 연결 요청을 처리할 수 없습니다.",
          code: error.code
        });
      }
      if (error instanceof DiscordManagementError) {
        return sendJson(req, res, error.status, {
          error: "YORO Bot 관리 요청을 처리할 수 없습니다.",
          code: error.code
        }, noStoreHeaders());
      }
      if (error instanceof YoroAccountError) {
        return sendJson(req, res, error.status, {
          error: "YORO 계정 요청을 처리할 수 없습니다.",
          code: error.code
        }, noStoreHeaders());
      }
      if (error instanceof ValorantCatalogError || error instanceof ValorantPublicQueryError) {
        return sendJson(req, res, 400, {
          error: "발로란트 요청 query가 올바르지 않습니다.",
          code: "invalid_query"
        }, noStoreHeaders());
      }
      if (error instanceof MinecraftCatalogQueryError) {
        return sendJson(req, res, 400, {
          error: error.publicMessage,
          code: error.code
        }, noStoreHeaders());
      }
      if (error instanceof MinecraftPatchNotesQueryError) {
        return sendJson(req, res, 400, {
          error: error.publicMessage,
          code: error.code
        }, noStoreHeaders());
      }
      if (error instanceof PalworldQueryError) {
        return sendJson(req, res, 400, { error: error.publicMessage, code: error.code });
      }
      if (error instanceof PalworldRecordNotFoundError) {
        return sendJson(req, res, 404, { error: error.message, code: error.code });
      }
      if (error instanceof PalworldDomainUnavailableError) {
        return sendJson(req, res, 503, {
          ...PALWORLD_DATA_UNAVAILABLE_RESPONSE,
          domain: error.domain
        }, { "Cache-Control": "no-store" });
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
