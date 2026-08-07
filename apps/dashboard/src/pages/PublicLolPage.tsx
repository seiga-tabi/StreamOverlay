import { Fragment, useEffect, useId, useMemo, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import {
  normalizeLolPlatformId,
  parseRiotIdDetailed,
  type CommunityPost,
  type CommunityPostCategory,
  type CommunityPostReportCreateInput,
  type LolChampionSummary,
  type LolPerformanceStats,
  type LolPlatformId,
  type LolRankHistoryPoint,
  type LolRankedStats,
  type LolRole,
  type LolRoleAnalysis,
  type ParticipationStatus,
  type StreamerRiotIdRequest
} from "@streamops/shared";
import { apiBase } from "../api/client";
import { publicLegalRuntimeConfig } from "../runtime-config";
import { trackGoogleAnalyticsEvent } from "../analytics/google-analytics";
import {
  canCancelViewerQueue,
  getParticipationDisplayPhase,
  getViewerQueuePhase,
  getViewerAvailableActions,
  isViewerParticipationActive,
  type ParticipationDisplayPhase,
  type ViewerQueuePhase
} from "../features/participation/participation-display";
import {
  createPublicCommunityComment,
  createPublicCommunityPost,
  createPublicCommunityReport,
  getPublicCommunityPosts,
  updatePublicCommunityPost,
  type CommunityPostSubmitInput
} from "../features/public-lol/api/community";
import {
  getPublicTwitchFollowedChannels,
  getPublicTwitchStatus,
  invalidatePublicTwitchClientCache,
  logoutPublicTwitch,
  peekPublicTwitchFollowedChannels,
  peekPublicTwitchStatus,
  publicTwitchLoginUrl,
} from "../features/public-twitch/api";
import { safeTwitchStreamPreviewUrl } from "../features/public-twitch/stream-preview";
import { streamerBuckets, type StreamerFilter } from "../features/public-lol/utils/streamers";
import { isTwitchAccountOAuthReturn } from "../features/yoro-account/api";
import { ProfileLinkIcon, profileLinkPlatformFromUrl, profileLinkPlatformClass } from "../components/ProfileLinkIcon";
import { AppShell, AppShellHeader, AppShellMain, AppShellSidebar } from "../shared/ui/AppShell";
import { Button } from "../shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../shared/ui/Card";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../shared/ui/EmptyState";
import { FormControl, FormError, FormField, FormHint, FormLabel, Input, Select, Textarea } from "../shared/ui/Form";
import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../shared/ui/Modal";
import { Navigation, NavigationBadge, NavigationItem, NavigationSection } from "../shared/ui/Navigation";
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderEyebrow, PageHeaderStatus, PageHeaderTitle } from "../shared/ui/PageHeader";
import { Skeleton, SkeletonAvatar, SkeletonButton, SkeletonCard, SkeletonText } from "../shared/ui/Skeleton";
import { Badge, Metric, StatusPill } from "../shared/ui/Status";
import { TwitchGlitchIcon } from "../shared/TwitchGlitchIcon";
import {
  Toast,
  ToastCloseButton,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastTone,
} from "../shared/ui/Toast";
import {
  getPublicLolMatchBuild,
  getPublicLolMatchDetail,
  getPublicLolMatchPage,
  getPublicLolMatchRanks,
  getPublicLolProfileDynamicState,
  invalidatePublicLolMatchPageCache,
  prefetchPublicLolMatchPage,
  PublicHomeSearchPanel,
  PublicAppHeader as FeaturePublicAppHeader,
  PublicLocaleSelector,
  ChampionFilterSelect,
  PublicSiteFooter,
  PlayerItemBuild as FeaturePlayerItemBuild,
  PlayerLoadoutBuild as FeaturePlayerLoadoutBuild,
  PublicMatchFilterBar as FeaturePublicMatchFilterBar,
  ParticipationMyStatus,
  ParticipationQueueList,
  ParticipationStreamerPicks,
  ParticipationStreamerSwitcher,
  ProfileHeroRank as FeatureProfileHeroRank,
  StreamerFilterBar,
  StreamerLiveCard,
  StreamerRow,
  ProfileLpRecordCard as FeatureProfileLpRecordCard,
  ProfileMetricProfileCard as FeatureProfileMetricProfileCard,
  ProfileRoleCard as FeatureProfileRoleCard,
  ProfileStreamerCast as FeatureProfileStreamerCast,
  ProfileMetricStrip as FeatureProfileMetricStrip,
  ProfileTopPanel as FeatureProfileTopPanel,
  PublicProfileShareButton,
  MatchTeamCompare as FeatureMatchTeamCompare,
  MatchTeamDetails as FeatureMatchTeamDetails,
  LpTrendLineChart,
  RecentMatchBuildPanel as FeatureRecentMatchBuildPanel,
  RecentMatchExpandedPanel as FeatureRecentMatchExpandedPanel,
  RecentMatchRow as FeatureRecentMatchRow,
  recentMatchScoreGrade,
  RecentMatchesPanel as FeatureRecentMatchesPanel,
  RecentMatchesShareActions,
  RecentMatchesSummaryStrip,
  SearchForm as FeatureSearchForm,
  SearchableRiotId as FeatureSearchableRiotId,
  searchProfile,
  searchSuggestions,
  readPublicApiErrorMessage as readErrorMessage,
  type ParticipationStreamerOption,
  type ProfileHeroRankQueue,
  type StreamerChannelView,
  type ProfileLpChangeEntry,
  type ProfileMetricRow,
  type ProfileRoleEntry,
  type ProfileHeroRankTrend,
  type ProfileTopIdentityChampion,
  type PublicMatchFilterBarText,
  type ProfileTopPanelText,
  type PublicHomeLiveStreamer,
  type PublicHomeSearchPanelText,
  type PublicSiteFooterText,
  type MatchTeamCompareMetricViewModel,
  type MatchTeamCompareObjectiveViewModel,
  type MatchTeamCompareTeamViewModel,
  type MatchTeamCompareViewModel,
  type MatchTeamDetailsTeam,
  type PlayerItemBuildSlotViewModel,
  type PlayerItemBuildViewModel,
  type PlayerLoadoutBuildSlotViewModel,
  type PlayerLoadoutBuildViewModel,
  type PublicTeamMetricStatViewModel,
  type RecentMatchBuildBadge,
  type RecentMatchBuildRuneColumn,
  type RecentMatchBuildRuneRow,
  type RecentMatchBuildRuneSlot,
  type RecentMatchBuildViewModel,
  type RecentMatchExpandedPanelText,
  type RecentMatchRowMetric,
  type RecentMatchRowMediaItem,
  type RecentMatchRowTeamMember,
  type RecentMatchRowTeams,
  type RecentMatchShareItem,
  type RecentMatchesPanelText,
  type RecentMatchesSummaryChampion,
  type SearchFormProps,
  type SearchFormPanelRequest,
  type SearchFormPlatformOption,
  type SearchFormText,
  type SearchableRiotIdBadgeViewModel,
  type SearchableRiotIdViewModel,
  type TeamChampionAvatarViewModel,
} from "../features/public-lol";
import {
  activePublicLocale,
  publicI18n,
  publicJaText,
  publicKoText,
  publicText,
  setActivePublicLocale,
  t,
  type PublicLocale,
  type PublicTextKey,
} from "../features/public-lol/i18n/public-lol-i18n";
import type {
  PublicLolMatchParticipant,
  PublicLolMatchTeamDetail,
  PublicLolMatchRankParticipant,
  PublicLolMatchRankResponse,
  PublicLolMatchBuildItemEvent,
  PublicLolMatchBuildSkillEvent,
  PublicLolMatchBuildParticipant,
  PublicLolMatchBuildResponse,
  PublicLolMatchTeamsResponse,
  PublicLolMatchBadgeCode,
  PublicLolMatchBadge,
  PublicLolRecentMatch,
  PublicLolChampionPerformance,
  PublicLolRolePerformance,
  PublicProfileLink,
  PublicLolTwitchStream,
  PublicTwitchViewerStatus,
  PublicTwitchFollowedLolChannel,
  PublicTwitchSubscriptionChannel,
  PublicTwitchFollowedLolResponse,
  PublicParticipationQueueItem,
  PublicParticipationViewerEntry,
  PublicParticipationStreamer,
  PublicParticipationDiscoveryResponse,
  PublicParticipationStateResponse,
  PublicParticipationJoinResponse,
  PublicParticipationCancelResponse,
  PublicLolCurrentGameParticipant,
  PublicLolCurrentGame,
  PublicLolMatchPageResponse,
  PublicRecentRecord,
  PublicRecentChampionSummary,
  PublicLolProfile,
  CommunityPostProfileState,
  SearchSuggestion,
  PublicNavTarget,
  PublicMainPage,
  PublicProfileTab,
  PublicExpandedMatchView,
  PublicTheme,
  MatchQueueFilter,
  MatchPeriodFilter,
  PublicMatchFilters,
  PublicFavorite,
} from "../features/public-lol/types/public-lol";
import {
  buildSuggestions,
  DEFAULT_PUBLIC_LOL_PLATFORM,
  normalizeRiotId,
  normalizeSuggestionKey,
  normalizedTagLine,
  publicSummonerPath,
  publicSummonerRouteFromPath,
  riotIdQuery,
  searchTextForMatch,
  splitRiotIdText,
  suggestionRiotId,
} from "../features/public-lol/utils/riot-id";
import { formatCooldown, formatDecimal, formatDuration, formatNumber, formatPercent, refreshRemainingMs } from "../features/public-lol/utils/format";
import {
  isPublicLocale,
} from "../features/public-lol/utils/locale";
import {
  isLocalizablePublicPath,
  localizedPublicUrl,
  localizedPublicUrlForCurrentLocale,
  stripPublicLocalePrefix,
} from "../features/public-lol/utils/public-locale-path";
import {
  publicLegalPath,
  publicPageRouteFromPath,
  publicPathForPage,
  setPublicPath,
  type PublicLegalPageKey,
} from "../features/public-lol/utils/routes";
import { PublicAramPage } from "../features/public-lol/pages/PublicAramPage";
import {
  favoriteFromProfile,
  isFavoriteProfile,
  prependFavorite,
  readFavorites,
  readRecentSearches,
  saveRecentSearch,
  writeFavorites,
} from "../features/public-lol/utils/storage";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { usePublicTheme } from "../features/public-lol/hooks/usePublicTheme";
import {
  championAnalysisMax,
  championAnalysisRows,
  filteredMatches,
  hasActiveFilters,
  kdaFromTotals,
  matchPageWithAdditionalPage,
  profileWithAdditionalMatchPage,
  profileWithDynamicState,
  profileWithMatches,
  profileWithPreservedStreamerStateAfterRefresh,
  roundTo,
  safeRecordValue,
  summarizeMatches,
  winRateFromTotals,
} from "../features/public-lol/utils/match";
import {
  RECENT_ANALYSIS_MATCH_LIMIT,
  averageTierLabel,
  matchRankBadgeLabel,
  rankBadgeClass,
  rankLabel,
  rankScore,
  rankTierClass,
  rankTierLabel,
  rankTrendLine,
  rankTrendTierClass,
  shortRankLabel,
  tierKeyFromScore,
  totalGames,
} from "../features/public-lol/utils/rank";

const TOURNAMENT_PLAYER_PROFILE_LIMIT = 30;
const TOURNAMENT_PLAYER_PROFILE_CONCURRENCY = 3;

const PUBLIC_LEGAL_CONFIG = publicLegalRuntimeConfig();
const PUBLIC_CONTACT_EMAIL = PUBLIC_LEGAL_CONFIG.contactEmail || "support@yoro.gg";
const DEFAULT_MATCH_FILTERS: PublicMatchFilters = {
  queue: "all",
  championId: "all",
  period: "all"
};
const SUMMONER_SPELL_FILE_BY_ID: Record<number, string> = {
  1: "SummonerBoost",
  3: "SummonerExhaust",
  4: "SummonerFlash",
  6: "SummonerHaste",
  7: "SummonerHeal",
  11: "SummonerSmite",
  12: "SummonerTeleport",
  13: "SummonerMana",
  14: "SummonerDot",
  21: "SummonerBarrier",
  30: "SummonerPoroRecall",
  31: "SummonerPoroThrow",
  32: "SummonerSnowball",
  39: "SummonerSnowURFSnowball",
  54: "Summoner_UltBookPlaceholder",
  55: "Summoner_UltBookSmitePlaceholder"
};

type PublicLocalizedOption = {
  value: string;
  ko: string;
  ja: string;
};

const PARTY_TIER_OPTIONS: PublicLocalizedOption[] = [
  { value: "any", ko: "티어 무관", ja: "ティア不問" },
  { value: "iron", ko: "아이언", ja: "アイアン" },
  { value: "bronze", ko: "브론즈", ja: "ブロンズ" },
  { value: "silver", ko: "실버", ja: "シルバー" },
  { value: "gold", ko: "골드", ja: "ゴールド" },
  { value: "platinum", ko: "플래티넘", ja: "プラチナ" },
  { value: "emerald", ko: "에메랄드", ja: "エメラルド" },
  { value: "diamond", ko: "다이아몬드", ja: "ダイヤモンド" },
  { value: "master-plus", ko: "마스터 이상", ja: "マスター以上" }
];

const PARTY_ROLE_OPTIONS: PublicLocalizedOption[] = [
  { value: "any", ko: "역할 무관", ja: "役割不問" },
  { value: "top", ko: "탑", ja: "トップ" },
  { value: "jungle", ko: "정글", ja: "ジャングル" },
  { value: "mid", ko: "미드", ja: "ミッド" },
  { value: "bottom", ko: "원딜", ja: "ボット" },
  { value: "support", ko: "서포터", ja: "サポート" }
];

const PARTY_MODE_OPTIONS: PublicLocalizedOption[] = [
  { value: "ranked-solo", ko: "랭크 게임", ja: "ランクゲーム" },
  { value: "ranked-flex", ko: "자유랭크", ja: "フレックスランク" },
  { value: "normal", ko: "일반 게임", ja: "ノーマル" },
  { value: "aram", ko: "칼바람", ja: "ARAM" },
  { value: "duo", ko: "듀오", ja: "デュオ" },
  { value: "scrim", ko: "내전", ja: "カスタム" }
];

const PARTY_VOICE_OPTIONS: PublicLocalizedOption[] = [
  { value: "any", ko: "음성 무관", ja: "ボイス不問" },
  { value: "required", ko: "음성 가능", ja: "ボイスあり" },
  { value: "none", ko: "음성 없음", ja: "ボイスなし" }
];

const PARTY_TAG_OPTIONS: PublicLocalizedOption[] = [
  { value: "rank", ko: "랭크", ja: "ランク" },
  { value: "normal", ko: "일반", ja: "ノーマル" },
  { value: "aram", ko: "칼바람", ja: "ARAM" },
  { value: "duo", ko: "듀오", ja: "デュオ" },
  { value: "fun", ko: "즐겜", ja: "エンジョイ" },
  { value: "tryhard", ko: "빡겜", ja: "ガチ" },
  { value: "discord", ko: "디스코드", ja: "Discord" },
  { value: "beginner", ko: "초보환영", ja: "初心者歓迎" }
];

/* 팔로우 목록 자동 로드 재시도 정책. 실패해도 화면은 동작하므로 짧게 끊습니다. */
const FOLLOWED_LOL_MAX_ATTEMPTS = 4;
const FOLLOWED_LOL_RETRY_BASE_MS = 1_000;
const FOLLOWED_LOL_RETRY_MAX_MS = 30_000;

function publicOptionLabel(options: PublicLocalizedOption[], value: string | undefined): string {
  if (!value) return "";
  const option = options.find((item) => item.value === value);
  return option ? option[activePublicLocale] : value;
}

const matchBadgeLabelKeys: Record<PublicLolMatchBadgeCode, keyof typeof publicI18n.ko> = {
  mvp: "mvpBadge",
  ace: "aceBadge",
  unstoppable: "unstoppableBadge",
  tenacity: "tenacityBadge",
  damage_carry: "damageCarryBadge",
  objective: "objectiveBadge",
  vision: "visionBadge"
};

function matchBadgeLabel(code: PublicLolMatchBadgeCode, locale: PublicLocale = activePublicLocale): string {
  return publicI18n[locale][matchBadgeLabelKeys[code]];
}

function matchHighlightBadges(badges: PublicLolMatchBadge[] | undefined): PublicLolMatchBadge[] {
  return (badges ?? []).filter((badge) => badge.code === "mvp" || badge.code === "ace");
}

function matchHighlightClass(badges: PublicLolMatchBadge[] | undefined): string {
  const highlight = matchHighlightBadges(badges)[0]?.code;
  return highlight ? `highlight-${highlight}` : "";
}

function matchPlacementLabel(badges: PublicLolMatchBadge[] | undefined, locale: PublicLocale = activePublicLocale): string {
  const highlight = matchHighlightBadges(badges)[0];
  if (highlight) return matchBadgeLabel(highlight.code, locale);
  const rank = (badges ?? []).map((badge) => badge.rank).find((value): value is number => Number.isFinite(value));
  if (rank === undefined) return publicI18n[locale].aiScore;
  return locale === "ja" ? `${rank}位` : `${rank}등`;
}

async function loadPublicLocalePreference(signal?: AbortSignal): Promise<PublicLocale | undefined> {
  const response = await fetch(`${apiBase}/api/public/locale`, {
    credentials: "include",
    signal
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const body = await response.json() as { locale?: unknown };
  return isPublicLocale(body.locale) ? body.locale : undefined;
}

const queueLabels: Record<PublicLocale, Record<number, string>> = {
  ko: {
    6: "5v5 랭크",
    42: "5v5 랭크",
    400: "일반 교차",
    420: "솔로랭크",
    430: "일반",
    440: "자유랭크",
    450: "칼바람",
    2400: "증강 칼바람"
  },
  ja: {
    6: "5v5 ランク",
    42: "5v5 ランク",
    400: "ノーマルドラフト",
    420: "ソロランク",
    430: "ノーマル",
    440: "フレックスランク",
    450: "ランダムミッド",
    2400: "ランダムミッド：メイヘム"
  }
};

const roleLabels: Record<PublicLocale, Record<string, string>> = {
  ko: {
    TOP: "탑",
    JUNGLE: "정글",
    MIDDLE: "미드",
    MID: "미드",
    BOTTOM: "원딜",
    ADC: "원딜",
    UTILITY: "서포터",
    SUPPORT: "서포터",
    FILL: "올포지션",
    UNKNOWN: "알 수 없음"
  },
  ja: {
    TOP: "トップ",
    JUNGLE: "ジャングル",
    MIDDLE: "ミッド",
    MID: "ミッド",
    BOTTOM: "ADC",
    ADC: "ADC",
    UTILITY: "サポート",
    SUPPORT: "サポート",
    FILL: "どこでも",
    UNKNOWN: "不明"
  }
};

type PublicRoleIconKey = "top" | "jungle" | "mid" | "bottom" | "support" | "fill" | "unknown";

const roleIconAssets: Partial<Record<PublicRoleIconKey, string>> = {
  top: "/images/roles/position-top.svg",
  jungle: "/images/roles/position-jungle.svg",
  mid: "/images/roles/position-middle.svg",
  bottom: "/images/roles/position-bottom.svg",
  support: "/images/roles/position-utility.svg"
};

function roleIconKey(role: string | undefined): PublicRoleIconKey {
  const normalized = (role ?? "UNKNOWN").toUpperCase();
  if (normalized === "TOP") return "top";
  if (normalized === "JUNGLE") return "jungle";
  if (normalized === "MID" || normalized === "MIDDLE") return "mid";
  if (normalized === "BOTTOM" || normalized === "ADC") return "bottom";
  if (normalized === "UTILITY" || normalized === "SUPPORT") return "support";
  if (normalized === "FILL") return "fill";
  return "unknown";
}

function RoleIcon({ role }: { role: string | undefined }) {
  const icon = roleIconKey(role);
  const iconSrc = roleIconAssets[icon];
  return (
    <span className={`public-role-icon ${icon}`} aria-hidden="true">
      {iconSrc ? (
        <img src={iconSrc} alt="" />
      ) : (
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M11 3.8h2v6.1l4.3-4.3 1.4 1.4-4.3 4.3h6.1v2h-6.1l4.3 4.3-1.4 1.4-4.3-4.3v6.1h-2v-6.1L6.7 19l-1.4-1.4 4.3-4.3H3.5v-2h6.1L5.3 7l1.4-1.4L11 9.9V3.8Z" />
        </svg>
      )}
    </span>
  );
}

const objectiveLabels: Record<PublicLocale, Record<string, string>> = {
  ko: {
    baron: "바론",
    champion: "킬",
    dragon: "드래곤",
    horde: "공허 유충",
    inhibitor: "억제기",
    riftHerald: "전령",
    tower: "타워"
  },
  ja: {
    baron: "バロン",
    champion: "キル",
    dragon: "ドラゴン",
    horde: "ヴォイドグラブ",
    inhibitor: "インヒビター",
    riftHerald: "ヘラルド",
    tower: "タワー"
  }
};

async function getPublicParticipationState(streamerId?: string, publicSessionId?: string): Promise<PublicParticipationStateResponse> {
  const params = new URLSearchParams();
  if (publicSessionId) params.set("session", publicSessionId);
  else if (streamerId) params.set("streamerId", streamerId);
  const query = params.size ? `?${params.toString()}` : "";
  const response = await fetch(`${apiBase}/api/public/participation/state${query}`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const body: unknown = await response.json();
  if (!isPublicParticipationStateResponse(body)) throw new Error(t().participationLoadFailed);
  return body;
}

async function getPublicParticipationDiscovery(): Promise<PublicParticipationDiscoveryResponse> {
  const response = await fetch(`${apiBase}/api/public/participation/discovery?scope=followed`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const body: unknown = await response.json();
  if (!isPublicParticipationDiscoveryResponse(body)) throw new Error(t().participationLoadFailed);
  return body;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublicParticipationStateResponse(value: unknown): value is PublicParticipationStateResponse {
  if (!isObjectRecord(value) || !isObjectRecord(value.summary)) return false;
  return typeof value.connected === "boolean"
    && typeof value.configured === "boolean"
    && typeof value.isOpen === "boolean"
    && Array.isArray(value.streamers)
    && Array.isArray(value.queue)
    && typeof value.revision === "number"
    && Number.isFinite(value.revision)
    && typeof value.maxQueueSize === "number"
    && Number.isFinite(value.maxQueueSize)
    && typeof value.updatedAt === "string";
}

function isPublicParticipationDiscoveryResponse(value: unknown): value is PublicParticipationDiscoveryResponse {
  return isObjectRecord(value)
    && typeof value.connected === "boolean"
    && typeof value.configured === "boolean"
    && Array.isArray(value.followedRecruiting)
    && Array.isArray(value.followedLiveButClosed)
    && Array.isArray(value.followedOfflineRecruiting)
    && isObjectRecord(value.metadata)
    && typeof value.metadata.fetchedAt === "string"
    && typeof value.metadata.revision === "number"
    && Number.isFinite(value.metadata.revision);
}

async function postPublicParticipationJoin(input: { riotId: string; role: LolRole; streamerId?: string; publicSessionId?: string; rejoin?: boolean }): Promise<PublicParticipationJoinResponse> {
  const endpoint = input.publicSessionId
    ? `/api/public/participation/sessions/${encodeURIComponent(input.publicSessionId)}/${input.rejoin ? "rejoin" : "join"}`
    : "/api/public/participation/join";
  const response = await fetch(`${apiBase}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ riotId: input.riotId, role: input.role, ...(input.publicSessionId ? {} : { streamerId: input.streamerId }) })
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as PublicParticipationJoinResponse;
}

async function postPublicParticipationCancel(input: { streamerId?: string; publicSessionId?: string }): Promise<PublicParticipationCancelResponse> {
  const endpoint = input.publicSessionId
    ? `/api/public/participation/sessions/${encodeURIComponent(input.publicSessionId)}/cancel`
    : "/api/public/participation/cancel";
  const response = await fetch(`${apiBase}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input.publicSessionId ? {} : { streamerId: input.streamerId })
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as PublicParticipationCancelResponse;
}



function communityPostRiotId(post: CommunityPost | undefined): string | undefined {
  const gameName = post?.riotGameName?.trim();
  const tagLine = post?.riotTagLine?.trim();
  return gameName && tagLine ? `${gameName}#${tagLine}` : undefined;
}

function communityPostCategory(post: CommunityPost | undefined): CommunityPostCategory {
  return post?.category === "party" ? "party" : "server";
}

const PARTY_COMMUNITY_POST_LIMIT = 2;
const PARTY_COMMUNITY_POST_TTL_MS = 24 * 60 * 60 * 1000;

function communityPageCategory(page: PublicMainPage): CommunityPostCategory {
  return page === "communityParty" || page === "communityPartyWrite" ? "party" : "server";
}

async function requestPublicStreamerRiotId(riotId: string): Promise<StreamerRiotIdRequest> {
  const response = await fetch(`${apiBase}/api/public/twitch/riot-id-request`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ riotId })
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const body = await response.json() as { request?: StreamerRiotIdRequest };
  if (!body.request) throw new Error(t().searchFailed);
  return body.request;
}

function suggestionSourceLabel(suggestion: SearchSuggestion): string {
  if (suggestion.source === "verified") return t().verifiedSearch;
  if (suggestion.source === "recent") return t().recentSearch;
  if (suggestion.source === "recommended") return t().recommended;
  return t().inputSearch;
}

function assetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${apiBase}${url}`;
}

function matchRoleOrder(role: string | undefined): number {
  const normalized = (role ?? "").toUpperCase();
  const order = ["TOP", "JUNGLE", "MIDDLE", "MID", "BOTTOM", "UTILITY", "SUPPORT"];
  const index = order.indexOf(normalized);
  return index >= 0 ? index : order.length;
}

function matchRankParticipantMatchesRole(participant: PublicLolMatchRankParticipant, player: PublicLolMatchParticipant): boolean {
  if (!participant.position || !player.position) return false;
  return participant.position.toUpperCase() === player.position.toUpperCase();
}

function matchRankForPlayer(
  rankDetail: PublicLolMatchRankResponse | undefined,
  teamId: number,
  player: PublicLolMatchParticipant,
  playerIndex = -1
): LolRankedStats | undefined {
  if (!rankDetail) return undefined;
  const riotKey = player.riotId ? searchTextForMatch(player.riotId) : "";
  const teamParticipants = rankDetail.participants
    .filter((item) => item.teamId === teamId)
    .sort((a, b) => matchRoleOrder(a.position) - matchRoleOrder(b.position));
  const participant = teamParticipants.find((item) => riotKey && item.riotId && searchTextForMatch(item.riotId) === riotKey) ||
    teamParticipants.find((item) => item.championId === player.champion.championId && matchRankParticipantMatchesRole(item, player)) ||
    teamParticipants.find((item) => item.championId === player.champion.championId) ||
    teamParticipants[playerIndex];
  return participant?.rankedStats;
}

function resultLabel(result: PublicLolRecentMatch["result"]): string {
  if (result === "win") return t().win;
  if (result === "loss") return t().loss;
  return t().unknown;
}

/** 매치 행의 승패 배지용 1글자 라벨입니다. 한국어 승/패, 일본어 勝/敗 모두 1글자 폭이 유지됩니다. */
function resultShortLabel(result: PublicLolRecentMatch["result"]): string {
  return resultLabel(result).slice(0, 1);
}

function formatDate(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(activePublicLocale === "ja" ? "ja-JP" : "ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatMatchDate(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(activePublicLocale === "ja" ? "ja-JP" : "ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatMatchTime(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(activePublicLocale === "ja" ? "ja-JP" : "ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatRelativeDate(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  const elapsedMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return t().justNow;
  if (minutes < 60) return `${minutes}${t().minutesAgo}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t().hoursAgo}`;
  return `${Math.floor(hours / 24)}${t().daysAgo}`;
}

function formatBuildMinute(timestampMs: number | undefined): string {
  if (timestampMs === undefined || !Number.isFinite(timestampMs)) return "-";
  const minutes = Math.max(0, Math.floor(timestampMs / 60_000));
  return activePublicLocale === "ja" ? `${minutes}分` : `${minutes}분`;
}

function KdaMetricText({ value, digits = 2 }: { value: number | undefined; digits?: number }) {
  return (
    <>
      <span className={metricToneClass(kdaTone(value))}>{formatDecimal(value, digits)}</span> KDA
    </>
  );
}

type MetricTone = "excellent" | "good" | "neutral" | "warning" | "bad";
type SharedProfileTone = "neutral" | "info" | "success" | "warning" | "danger";

function metricToneClass(tone: MetricTone | undefined): string {
  return `metric-tone-${tone ?? "neutral"}`;
}

function sharedMetricTone(tone: MetricTone | undefined): SharedProfileTone {
  if (tone === "excellent" || tone === "good") return "success";
  if (tone === "warning") return "warning";
  if (tone === "bad") return "danger";
  return "neutral";
}

function sharedRankTone(stats: LolRankedStats | undefined, fallback = false): SharedProfileTone {
  if (fallback || !stats || stats.tier === "UNRANKED") return "neutral";
  return "info";
}

function kdaTone(value: number | undefined): MetricTone {
  if (value === undefined || !Number.isFinite(value)) return "neutral";
  if (value >= 5) return "excellent";
  if (value >= 3) return "good";
  if (value >= 2) return "neutral";
  if (value >= 1.2) return "warning";
  return "bad";
}

function percentTone(value: number | undefined, mode: "higher" | "lower" = "higher"): MetricTone {
  if (value === undefined || !Number.isFinite(value)) return "neutral";
  const safeValue = Math.max(0, Math.min(100, value));
  if (mode === "lower") {
    if (safeValue <= 20) return "excellent";
    if (safeValue <= 35) return "good";
    if (safeValue <= 45) return "neutral";
    if (safeValue <= 60) return "warning";
    return "bad";
  }
  if (safeValue >= 70) return "excellent";
  if (safeValue >= 55) return "good";
  if (safeValue >= 45) return "neutral";
  if (safeValue >= 35) return "warning";
  return "bad";
}

function teamShareTone(value: number | undefined): MetricTone {
  if (value === undefined || !Number.isFinite(value)) return "neutral";
  if (value >= 30) return "excellent";
  if (value >= 23) return "good";
  if (value >= 17) return "neutral";
  if (value >= 12) return "warning";
  return "bad";
}

function scoreTone(value: number | undefined): MetricTone {
  if (value === undefined || !Number.isFinite(value)) return "neutral";
  if (value >= 85) return "excellent";
  if (value >= 70) return "good";
  if (value >= 55) return "neutral";
  if (value >= 40) return "warning";
  return "bad";
}

function csTone(value: number | undefined): MetricTone {
  if (value === undefined || !Number.isFinite(value)) return "neutral";
  if (value >= 8) return "excellent";
  if (value >= 6.5) return "good";
  if (value >= 5) return "neutral";
  if (value >= 4) return "warning";
  return "bad";
}

function damagePerMinuteTone(value: number | undefined): MetricTone {
  if (value === undefined || !Number.isFinite(value)) return "neutral";
  if (value >= 850) return "excellent";
  if (value >= 650) return "good";
  if (value >= 450) return "neutral";
  if (value >= 300) return "warning";
  return "bad";
}

function mainRoleLabel(role: string | undefined): string {
  if (!role) return "-";
  return roleLabels[activePublicLocale][role.toUpperCase()] ?? role;
}

function championName(champion: LolChampionSummary | undefined, locale: PublicLocale = activePublicLocale): string {
  if (!champion) return "-";
  if (locale === "ja") return champion.nameJa ?? champion.nameKo ?? champion.championKey ?? `Champion ${champion.championId}`;
  return champion.nameKo ?? champion.nameJa ?? champion.championKey ?? `Champion ${champion.championId}`;
}

function soloRankStats(profile: PublicLolProfile): LolRankedStats | undefined {
  return profile.rankedQueues?.solo ?? (profile.rankedStats?.queueType === "RANKED_SOLO_5x5" ? profile.rankedStats : undefined);
}

function flexRankStats(profile: PublicLolProfile): LolRankedStats | undefined {
  return profile.rankedQueues?.flex ?? (profile.rankedStats?.queueType === "RANKED_FLEX_SR" ? profile.rankedStats : undefined);
}

function ranked5v5Stats(profile: PublicLolProfile): LolRankedStats | undefined {
  return profile.rankedQueues?.ranked5v5 ?? (profile.rankedStats?.queueType === "RANKED_TEAM_5x5" ? profile.rankedStats : undefined);
}

function multikillLabel(value: number | undefined): string {
  if (!value || value < 2) return "-";
  if (activePublicLocale === "ja") {
    if (value >= 5) return "ペンタキル";
    if (value === 4) return "クアドラキル";
    if (value === 3) return "トリプルキル";
    return "ダブルキル";
  }
  if (value >= 5) return "펜타킬";
  if (value === 4) return "쿼드라킬";
  if (value === 3) return "트리플킬";
  return "더블킬";
}

function objectiveSummary(objectives: Record<string, number> | undefined): string {
  const entries = Object.entries(objectives ?? {})
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${objectiveLabels[activePublicLocale][key] ?? key} ${value}`);
  return entries.length > 0 ? entries.join(" · ") : "-";
}

function objectiveSummaryByOrder(objectives: Record<string, number> | undefined, keys: string[]): string {
  const entries = keys
    .map((key) => [key, objectives?.[key] ?? 0] as const)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${objectiveLabels[activePublicLocale][key] ?? key} ${value}`);
  return entries.length > 0 ? entries.join(" · ") : "-";
}

const teamCompareObjectiveKeys = ["horde", "riftHerald", "dragon", "baron", "inhibitor", "tower"] as const;

const objectiveShortLabels: Record<PublicLocale, Record<(typeof teamCompareObjectiveKeys)[number], string>> = {
  ko: {
    horde: "유충",
    riftHerald: "전령",
    dragon: "용",
    baron: "바론",
    inhibitor: "억제",
    tower: "타워"
  },
  ja: {
    horde: "グラブ",
    riftHerald: "ヘラルド",
    dragon: "ドラ",
    baron: "バロン",
    inhibitor: "インヒビ",
    tower: "タワー"
  }
};

function recentRecord(matches: PublicLolRecentMatch[], title: string, unit: string, value: (match: PublicLolRecentMatch) => number | undefined): PublicRecentRecord {
  const match = matches.reduce<PublicLolRecentMatch | undefined>((best, current) => {
    if (!best) return current;
    return safeRecordValue(value(current)) > safeRecordValue(value(best)) ? current : best;
  }, undefined);
  return { title, unit, match, champion: match?.champion, value: match ? value(match) : undefined };
}

function recentRecords(profile: PublicLolProfile): PublicRecentRecord[] {
  return [
    recentRecord(profile.recentMatches, t().bestKills, t().unitKill, (match) => match.kills),
    recentRecord(profile.recentMatches, t().bestKda, "KDA", (match) => match.kda),
    recentRecord(profile.recentMatches, t().bestDamage, t().unitDamage, (match) => match.damageDealtToChampions),
    recentRecord(profile.recentMatches, t().bestCs, "CS", (match) => match.cs),
    recentRecord(profile.recentMatches, t().bestVision, t().unitPoint, (match) => match.visionScore)
  ];
}

function recordValue(record: PublicRecentRecord): string {
  if (record.value === undefined || !Number.isFinite(record.value)) return "-";
  return record.unit === "KDA" ? formatDecimal(record.value) : formatNumber(record.value);
}

function winLossText(wins: number, games: number): string {
  const losses = Math.max(0, games - wins);
  return activePublicLocale === "ja" ? `${wins}勝 ${losses}敗` : `${wins}승 ${losses}패`;
}

function gamesText(games: number): string {
  return `${games}${t().games}`;
}

function winsText(wins: number): string {
  return activePublicLocale === "ja" ? `${wins}勝` : `${wins}승`;
}

function ladderRankText(rank: number | undefined): string | undefined {
  if (!rank) return undefined;
  return activePublicLocale === "ja" ? `${t().ladderRank} ${formatNumber(rank)}位` : `${t().ladderRank} ${formatNumber(rank)}위`;
}

function perMinuteText(label: string, value: number | undefined, digits?: number): string {
  const formatted = digits === undefined ? formatNumber(value) : formatDecimal(value, digits);
  return activePublicLocale === "ja" ? `分あたり${label} ${formatted}` : `분당 ${label} ${formatted}`;
}

function killParticipationText(value: number | undefined): string {
  return activePublicLocale === "ja" ? `キル関与 ${formatPercent(value)}` : `킬 관여 ${formatPercent(value)}`;
}

function analysisRoleTitle(role: string | undefined): string {
  return activePublicLocale === "ja"
    ? `メインロールは${mainRoleLabel(role)}です。`
    : `주 포지션은 ${mainRoleLabel(role)}입니다.`;
}

function analysisRoleBody(sampleSize: number, confidence: number): string {
  return activePublicLocale === "ja"
    ? `最近${gamesText(sampleSize)}基準の信頼度は${confidence}%です。`
    : `최근 ${gamesText(sampleSize)} 기준 신뢰도 ${confidence}%입니다.`;
}

function analysisMasteryTitle(champion: LolChampionSummary | undefined): string {
  if (!champion) return activePublicLocale === "ja" ? "チャンピオン熟練度データがありません。" : "챔피언 숙련도 데이터가 없습니다.";
  return activePublicLocale === "ja" ? `${championName(champion)}の熟練度が高いです。` : `${championName(champion)} 숙련도가 높습니다.`;
}

function analysisMasteryBody(champion: LolChampionSummary): string {
  return activePublicLocale === "ja"
    ? `${formatNumber(champion.masteryPoints)} ${t().masteryPoint}を保有しています。`
    : `${formatNumber(champion.masteryPoints)} ${t().masteryPoint}를 보유하고 있습니다.`;
}

function analysisRecentTitle(winRate: number): string {
  return activePublicLocale === "ja" ? `最近の勝率は${winRate}%です。` : `최근 전적 승률은 ${winRate}%입니다.`;
}

function analysisRecentBody(profile: PublicLolProfile): string {
  return activePublicLocale === "ja"
    ? `${gamesText(profile.summary.recentGames)}中${winsText(profile.summary.recentWins)}、平均 ${formatDecimal(profile.summary.averageKda)} KDA、平均ダメージ ${formatNumber(profile.summary.averageDamagePerMinute)} DPMです。`
    : `${gamesText(profile.summary.recentGames)} 중 ${winsText(profile.summary.recentWins)}, 평균 ${formatDecimal(profile.summary.averageKda)} KDA, 평균 딜량 ${formatNumber(profile.summary.averageDamagePerMinute)} DPM입니다.`;
}

function analysisChampionTitle(item: PublicLolChampionPerformance | undefined): string {
  if (!item) return activePublicLocale === "ja" ? "最近のチャンピオン成績データがありません。" : "최근 챔피언 성과 데이터가 없습니다.";
  return activePublicLocale === "ja" ? `最近は${championName(item.champion)}の成績が最も多いです。` : `최근에는 ${championName(item.champion)} 성과가 가장 많습니다.`;
}

function analysisChampionBody(item: PublicLolChampionPerformance): string {
  return activePublicLocale === "ja"
    ? `${gamesText(item.games)} ${winsText(item.wins)}、${formatDecimal(item.averageKda)} KDA、勝率 ${formatPercent(item.winRate)}です。`
    : `${gamesText(item.games)} ${winsText(item.wins)}, ${formatDecimal(item.averageKda)} KDA, 승률 ${formatPercent(item.winRate)}입니다.`;
}

function analysisRolePerformanceTitle(item: PublicLolRolePerformance | undefined): string {
  if (!item) return activePublicLocale === "ja" ? "ロール別詳細データがありません。" : "포지션별 상세 데이터가 없습니다.";
  return activePublicLocale === "ja" ? `${mainRoleLabel(item.role)}のサンプルが最も多いです。` : `${mainRoleLabel(item.role)} 포지션 표본이 가장 많습니다.`;
}

function analysisRolePerformanceBody(item: PublicLolRolePerformance): string {
  return activePublicLocale === "ja"
    ? `${gamesText(item.games)}基準の勝率 ${formatPercent(item.winRate)}、平均 ${formatDecimal(item.averageKda)} KDAです。`
    : `${gamesText(item.games)} 기준 승률 ${formatPercent(item.winRate)}, 평균 ${formatDecimal(item.averageKda)} KDA입니다.`;
}

function barWidth(value: number | undefined, total: number | undefined): string {
  if (value === undefined || total === undefined || total <= 0) return "0%";
  return `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
}

function teamLabel(team: PublicLolMatchTeamDetail): string {
  return team.players.some((player) => player.isTarget) ? t().allyTeam : t().enemyTeam;
}

function matchTeamTotal(match: PublicLolRecentMatch, selector: (player: PublicLolMatchParticipant) => number | undefined): number {
  return Math.max(0, ...match.teams.flatMap((team) => team.players.map((player) => safeRecordValue(selector(player)))));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function matchAiScore(match: PublicLolRecentMatch): number {
  const resultScore = match.result === "win" ? 18 : match.result === "loss" ? 6 : 10;
  const kdaScore = Math.min(30, match.kda * 5);
  const killParticipationScore = Math.min(18, (match.killParticipation ?? 0) * .18);
  const csScore = Math.min(14, (match.csPerMinute ?? 0) * 1.7);
  const damageScore = Math.min(12, (match.damageShare ?? 0) * .45);
  const visionScore = Math.min(8, (match.visionScorePerMinute ?? 0) * 4);
  return clampScore(18 + resultScore + kdaScore + killParticipationScore + csScore + damageScore + visionScore);
}

function recentAnalysisMatches(profile: PublicLolProfile): PublicLolRecentMatch[] {
  return profile.recentMatches.slice(0, RECENT_ANALYSIS_MATCH_LIMIT);
}

function averageAiScore(profile: PublicLolProfile): number {
  const matches = recentAnalysisMatches(profile);
  if (matches.length === 0) return 0;
  return Math.round(matches.reduce((sum, match) => sum + matchAiScore(match), 0) / matches.length);
}

function aggregatePerformanceScore(profile: PublicLolProfile): number {
  const matches = recentAnalysisMatches(profile);
  if (matches.length === 0) return 0;
  const summary = summarizeMatches(matches);
  return Math.floor((averageAiScore(profile) * .62) + (summary.recentWinRate * .38));
}

function aggregatePerformanceGrade(profile: PublicLolProfile): string {
  const matches = recentAnalysisMatches(profile);
  if (matches.length === 0) return "-";
  const weightedScore = aggregatePerformanceScore(profile);
  if (weightedScore >= 88) return "S+";
  if (weightedScore >= 80) return "S";
  if (weightedScore >= 72) return "A+";
  if (weightedScore >= 64) return "A";
  if (weightedScore >= 56) return "B";
  if (weightedScore >= 46) return "C";
  return "D";
}

function metricProgress(value: number | undefined, max: number): string {
  if (value === undefined || !Number.isFinite(value) || max <= 0) return "0%";
  return barWidth(Math.max(0, Math.min(max, value)), max);
}

function metricTopPercent(value: number | undefined, excellentAt: number, range: number): number {
  if (value === undefined || !Number.isFinite(value) || excellentAt <= 0) return 99;
  const ratio = Math.max(0, Math.min(1, value / excellentAt));
  return Math.max(1, Math.min(99, Math.round(100 - ratio * range)));
}

function topPercentText(percent: number): string {
  return `${t().topPercentPrefix} ${percent}%`;
}

const recentChampionSummaryLimit = 20;
const recentChampionDisplayLimit = 3;

function recentChampionSummaries(matches: PublicLolRecentMatch[]): PublicRecentChampionSummary[] {
  const buckets = new Map<number, {
    champion: LolChampionSummary;
    games: number;
    wins: number;
    losses: number;
    kills: number;
    deaths: number;
    assists: number;
    firstIndex: number;
  }>();

  matches.slice(0, recentChampionSummaryLimit).forEach((match, index) => {
    const championId = match.champion.championId;
    const bucket = buckets.get(championId) ?? {
      champion: match.champion,
      games: 0,
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      firstIndex: index
    };

    bucket.games += 1;
    if (match.result === "win") bucket.wins += 1;
    if (match.result === "loss") bucket.losses += 1;
    bucket.kills += match.kills;
    bucket.deaths += match.deaths;
    bucket.assists += match.assists;
    buckets.set(championId, bucket);
  });

  return Array.from(buckets.values())
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.firstIndex - b.firstIndex)
    .slice(0, recentChampionDisplayLimit)
    .map((bucket) => ({
      champion: bucket.champion,
      games: bucket.games,
      wins: bucket.wins,
      losses: bucket.losses,
      winRate: winRateFromTotals(bucket.wins, bucket.games),
      averageKda: kdaFromTotals(bucket.kills, bucket.deaths, bucket.assists)
    }));
}

function publicTeamMetricStatViewModel({
  value,
  total,
  tone,
  label,
  labelClassName
}: {
  value: number | undefined;
  total: number;
  tone: "damage" | "cs" | "vision";
  label: string;
  labelClassName?: string;
}): PublicTeamMetricStatViewModel {
  return {
    tone,
    fillWidth: barWidth(value, total),
    valueLabel: formatNumber(value),
    label,
    labelClassName
  };
}

function playerDisplayName(player: PublicLolMatchParticipant): string {
  return player.riotId ?? championName(player.champion);
}

function splitRiotId(riotId: string | undefined, fallback: string): { name: string; tag?: string } {
  const value = riotId?.trim();
  if (!value) return { name: fallback };
  const separatorIndex = value.lastIndexOf("#");
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) return { name: value };
  return {
    name: value.slice(0, separatorIndex),
    tag: value.slice(separatorIndex + 1)
  };
}

function maskedRiotIdName(riotId: string | undefined, fallback: string): string {
  const display = splitRiotId(riotId, fallback);
  const nameLength = Array.from(display.name.trim()).length;
  return "*".repeat(Math.max(1, nameLength));
}

const PUBLIC_LOL_PLATFORM_OPTIONS: readonly SearchFormPlatformOption[] = [
  { id: "kr", code: "KR", label: { label: "한국 서버", ko: "한국 서버", ja: "韓国サーバー" } },
  { id: "jp1", code: "JP", label: { label: "일본 서버", ko: "일본 서버", ja: "日本サーバー" } },
  { id: "na1", code: "NA", label: { label: "북미 서버", ko: "북미 서버", ja: "北米サーバー" } },
  { id: "euw1", code: "EUW", label: { label: "유럽 서부", ko: "유럽 서부", ja: "西ヨーロッパ" } },
  { id: "eun1", code: "EUNE", label: { label: "유럽 북동부", ko: "유럽 북동부", ja: "北東ヨーロッパ" } },
  { id: "br1", code: "BR", label: { label: "브라질 서버", ko: "브라질 서버", ja: "ブラジルサーバー" } },
  { id: "la1", code: "LAN", label: { label: "라틴 아메리카 북부", ko: "라틴 아메리카 북부", ja: "北ラテンアメリカ" } },
  { id: "la2", code: "LAS", label: { label: "라틴 아메리카 남부", ko: "라틴 아메리카 남부", ja: "南ラテンアメリカ" } },
  { id: "oc1", code: "OCE", label: { label: "오세아니아 서버", ko: "오세아니아 서버", ja: "オセアニアサーバー" } },
  { id: "tr1", code: "TR", label: { label: "튀르키예 서버", ko: "튀르키예 서버", ja: "トルコサーバー" } },
  { id: "ru", code: "RU", label: { label: "러시아 서버", ko: "러시아 서버", ja: "ロシアサーバー" } },
  { id: "ph2", code: "PH", label: { label: "필리핀 서버", ko: "필리핀 서버", ja: "フィリピンサーバー" } },
  { id: "sg2", code: "SG", label: { label: "싱가포르 서버", ko: "싱가포르 서버", ja: "シンガポールサーバー" } },
  { id: "th2", code: "TH", label: { label: "태국 서버", ko: "태국 서버", ja: "タイサーバー" } },
  { id: "tw2", code: "TW", label: { label: "대만 서버", ko: "대만 서버", ja: "台湾サーバー" } },
  { id: "vn2", code: "VN", label: { label: "베트남 서버", ko: "베트남 서버", ja: "ベトナムサーバー" } }
];

function localizedPlatformOptions(locale: PublicLocale): readonly SearchFormPlatformOption[] {
  return PUBLIC_LOL_PLATFORM_OPTIONS.map((option) => ({
    ...option,
    label: {
      ...option.label,
      label: locale === "ja" ? option.label.ja : option.label.ko
    }
  }));
}

function searchFormText(): SearchFormText {
  return {
    searchServer: t().searchServer,
    searchPlaceholder: {
      label: t().searchPlaceholder,
      ko: publicI18n.ko.searchPlaceholder,
      ja: publicI18n.ja.searchPlaceholder
    },
    searchPlaceholderShort: {
      label: t().searchPlaceholderShort,
      ko: publicI18n.ko.searchPlaceholderShort,
      ja: publicI18n.ja.searchPlaceholderShort
    },
    clearSearch: t().clearSearch,
    searching: t().searching,
    search: t().search,
    summonerResults: {
      label: t().summonerResults,
      ko: publicI18n.ko.summonerResults,
      ja: publicI18n.ja.summonerResults
    },
    recentSearches: {
      label: t().recentSearch,
      ko: publicI18n.ko.recentSearch,
      ja: publicI18n.ja.recentSearch
    },
    favorites: {
      label: t().favoritesTitle,
      ko: publicI18n.ko.favoritesTitle,
      ja: publicI18n.ja.favoritesTitle
    },
    noRecentSearches: {
      label: t().noRecentSearches,
      ko: publicI18n.ko.noRecentSearches,
      ja: publicI18n.ja.noRecentSearches
    },
    noFavorites: {
      label: t().noFavorites,
      ko: publicI18n.ko.noFavorites,
      ja: publicI18n.ja.noFavorites
    },
    relatedSummoners: t().relatedSummoners
  };
}

function SearchForm(props: Omit<SearchFormProps<SearchSuggestion>, "helpers" | "text">) {
  return (
    <FeatureSearchForm
      {...props}
      helpers={{
        assetUrl,
        rankBadgeClass,
        shortRankLabel,
        suggestionRiotId,
        suggestionSourceLabel
      }}
      text={searchFormText()}
    />
  );
}

function SeigaSearchLoader() {
  return (
    <div className="public-search-loading-overlay" role="status" aria-live="polite" aria-label={t().searching}>
      <div className="public-search-loading-card">
        <div className="seiga-logo-loader" aria-hidden="true">
          <div className="loader-aura" />
          <div className="loader-ring ring-outer" />
          <div className="loader-ring ring-inner" />
          <div className="loader-scan" />
          <img className="seiga-mark" src="/images/yorogg-mark.png" alt="" />
        </div>
        <strong  >{t().searching}</strong>
      </div>
    </div>
  );
}

function publicHomeSearchPanelText(platform: LolPlatformId, locale: PublicLocale): PublicHomeSearchPanelText {
  const option = PUBLIC_LOL_PLATFORM_OPTIONS.find((candidate) => candidate.id === platform) ?? PUBLIC_LOL_PLATFORM_OPTIONS[0]!;
  const platformLabel = {
    ...option.label,
    label: locale === "ja" ? option.label.ja : option.label.ko
  };
  return {
    eyebrow: {
      label: "YORO.gg",
      ko: "YORO.gg",
      ja: "YORO.gg",
    },
    title: {
      label: t().homeSearchTitle,
      ko: publicI18n.ko.homeSearchTitle,
      ja: publicI18n.ja.homeSearchTitle,
    },
    description: {
      label: t().homeSearchDescription,
      ko: publicI18n.ko.homeSearchDescription,
      ja: publicI18n.ja.homeSearchDescription,
    },
    loadingStatus: {
      label: t().searching,
      ko: publicI18n.ko.searching,
      ja: publicI18n.ja.searching,
    },
    readyStatus: {
      label: platformLabel.label,
      ko: platformLabel.ko,
      ja: platformLabel.ja,
    },
    guideTitle: {
      label: t().searchNav,
      ko: publicI18n.ko.searchNav,
      ja: publicI18n.ja.searchNav,
    },
    guideDescription: {
      label: t().searchPlaceholder,
      ko: publicI18n.ko.searchPlaceholder,
      ja: publicI18n.ja.searchPlaceholder,
    },
    liveTitle: {
      label: activePublicLocale === "ja" ? "現在LIVE配信者" : "현재 LIVE 스트리머",
      ko: "현재 LIVE 스트리머",
      ja: "現在LIVE配信者",
    },
    livePrevious: {
      label: activePublicLocale === "ja" ? "前のLIVE配信者を見る" : "이전 LIVE 스트리머 보기",
      ko: "이전 LIVE 스트리머 보기",
      ja: "前のLIVE配信者を見る",
    },
    liveNext: {
      label: activePublicLocale === "ja" ? "次のLIVE配信者を見る" : "다음 LIVE 스트리머 보기",
      ko: "다음 LIVE 스트리머 보기",
      ja: "次のLIVE配信者を見る",
    },
    liveViewAll: {
      label: activePublicLocale === "ja" ? "すべて見る" : "전체 보기",
      ko: "전체 보기",
      ja: "すべて見る",
    },
    liveWatch: {
      label: activePublicLocale === "ja" ? "配信を見る" : "방송 보기",
      ko: "방송 보기",
      ja: "配信を見る",
    },
    liveEmptyTitle: {
      label: activePublicLocale === "ja" ? "現在登録済みのLIVE配信者はいません。" : "현재 등록된 LIVE 스트리머가 없습니다.",
      ko: "현재 등록된 LIVE 스트리머가 없습니다.",
      ja: "現在登録済みのLIVE配信者はいません。",
    },
    liveEmptyDescription: {
      label: activePublicLocale === "ja"
        ? "登録済みの配信者がLIVE配信を開始すると、ここに表示されます。"
        : "등록된 스트리머가 LIVE 방송을 시작하면 여기에 표시됩니다.",
      ko: "등록된 스트리머가 LIVE 방송을 시작하면 여기에 표시됩니다.",
      ja: "登録済みの配信者がLIVE配信を開始すると、ここに表示されます。",
    },
    primaryFeaturesTitle: {
      label: t().homePrimaryFeatures,
      ko: publicI18n.ko.homePrimaryFeatures,
      ja: publicI18n.ja.homePrimaryFeatures,
    },
    participationTitle: {
      label: t().homeParticipationTitle,
      ko: publicI18n.ko.homeParticipationTitle,
      ja: publicI18n.ja.homeParticipationTitle,
    },
    participationDescription: {
      label: t().homeParticipationDescription,
      ko: publicI18n.ko.homeParticipationDescription,
      ja: publicI18n.ja.homeParticipationDescription,
    },
    aramTitle: {
      label: t().homeAramTitle,
      ko: publicI18n.ko.homeAramTitle,
      ja: publicI18n.ja.homeAramTitle,
    },
    aramDescription: {
      label: t().homeAramDescription,
      ko: publicI18n.ko.homeAramDescription,
      ja: publicI18n.ja.homeAramDescription,
    },
    communityTitle: {
      label: t().homeCommunityTitle,
      ko: publicI18n.ko.homeCommunityTitle,
      ja: publicI18n.ja.homeCommunityTitle,
    },
    communityDescription: {
      label: t().homeCommunityDescription,
      ko: publicI18n.ko.homeCommunityDescription,
      ja: publicI18n.ja.homeCommunityDescription,
    },
    streamerTitle: {
      label: t().homeStreamerTitle,
      ko: publicI18n.ko.homeStreamerTitle,
      ja: publicI18n.ja.homeStreamerTitle,
    },
    streamerDescription: {
      label: t().homeStreamerDescription,
      ko: publicI18n.ko.homeStreamerDescription,
      ja: publicI18n.ja.homeStreamerDescription,
    },
    additionalFeaturesTitle: {
      label: t().homeAdditionalFeatures,
      ko: publicI18n.ko.homeAdditionalFeatures,
      ja: publicI18n.ja.homeAdditionalFeatures,
    },
  };
}

function SummaryCards({ profile }: { profile: PublicLolProfile }) {
  const stats = profile.rankedStats;
  const performance = profile.performanceStats;
  const summary = profile.summary;
  return (
    <section id="public-stats" className="public-card-grid summary">
      <article className="public-stat-card">
        <span>{t().winRate}</span>
        <strong className={metricToneClass(percentTone(stats?.winRate))}>{stats ? `${stats.winRate}%` : "-"}</strong>
        <p>{stats ? winLossText(stats.wins, stats.wins + stats.losses) : t().noData}</p>
      </article>
      <article className="public-stat-card">
        <span>{t().kda}</span>
        <strong className={metricToneClass(kdaTone(performance?.kda))}>{formatDecimal(performance?.kda)}</strong>
        <p>{performance ? `${performance.averageKills} / ${performance.averageDeaths} / ${performance.averageAssists}` : t().noData}</p>
      </article>
      <article className="public-stat-card">
        <span>{t().mainRole}</span>
        <strong>{mainRoleLabel(profile.roleAnalysis?.mainRole)}</strong>
        <p>{profile.roleAnalysis ? `${t().confidence} ${profile.roleAnalysis.confidence}% · ${profile.roleAnalysis.sampleSize}${t().games}` : t().noData}</p>
      </article>
      <article className="public-stat-card">
        <span>{t().recentGames}</span>
        <strong className={metricToneClass(percentTone(summary.recentWinRate))}>{summary.recentWinRate}%</strong>
        <p>{gamesText(summary.recentGames)} · {winsText(summary.recentWins)} · {summary.totalKills}/{summary.totalDeaths}/{summary.totalAssists}</p>
      </article>
      <article className="public-stat-card">
        <span  >{t().damage}</span>
        <strong className={metricToneClass(damagePerMinuteTone(summary.averageDamagePerMinute))}>{formatNumber(summary.averageDamagePerMinute)}</strong>
        <p>{perMinuteText(t().damage, summary.averageDamagePerMinute)} · {t().damageShare} {formatPercent(summary.averageDamageShare, 1)}</p>
      </article>
      <article className="public-stat-card">
        <span>CS / {t().gold}</span>
        <strong className={metricToneClass(csTone(summary.averageCsPerMinute))}>{formatDecimal(summary.averageCsPerMinute, 1)}</strong>
        <p>{perMinuteText("CS", summary.averageCsPerMinute, 1)} · {perMinuteText(t().gold, summary.averageGoldPerMinute)}</p>
      </article>
      <article className="public-stat-card">
        <span  >{t().vision}</span>
        <strong>{formatDecimal(summary.averageVisionScore, 1)}</strong>
        <p>{t().average} {t().vision} · {killParticipationText(summary.averageKillParticipation)}</p>
      </article>
    </section>
  );
}

function ProfileRankSection({ profile }: { profile: PublicLolProfile }) {
  const rankMetricCard = ({
    key,
    tone,
    icon,
    title,
    stats
  }: {
    key: string;
    tone: string;
    icon: string;
    title: string;
    stats: LolRankedStats | undefined;
  }) => {
    const unranked = !stats || stats.tier === "UNRANKED";
    return {
      key,
      tone: `${tone} ${unranked ? "is-unranked" : "is-ranked"}`,
      icon,
      imageUrl: assetUrl(stats?.tierIconUrl),
      imageFallbackLabel: unranked ? "U" : stats?.tier.slice(0, 1) ?? icon,
      title,
      value: unranked ? t().unranked : rankLabel(stats),
      valueTone: metricToneClass(unranked ? "neutral" : "good"),
      statusTone: unranked ? "neutral" : sharedMetricTone(percentTone(stats.winRate)),
      detail: unranked ? t().noData : gamesText(totalGames(stats)),
      rank: unranked ? undefined : `${t().winRate} ${formatPercent(stats.winRate)}`
    };
  };

  const rankedQueues = [
    { key: "solo-rank", tone: "blue", icon: "S", title: t().soloRank, stats: soloRankStats(profile) },
    { key: "flex-rank", tone: "green", icon: "F", title: t().flexRank, stats: flexRankStats(profile) },
    { key: "ranked-5v5", tone: "purple", icon: "5", title: t().ranked5v5, stats: ranked5v5Stats(profile) }
  ];
  const metricCards = rankedQueues.map(rankMetricCard);

  return (
    <Card as="section" className="public-profile-rank-section" padding="md" variant="elevated" aria-labelledby="public-profile-rank-title">
      <CardHeader className="public-profile-rank-section__header">
        <CardTitle as="h2" id="public-profile-rank-title">{t().rankSummary}</CardTitle>
      </CardHeader>
      <FeatureProfileMetricStrip ariaLabel={t().rankSummary} cards={metricCards} />
    </Card>
  );
}

function profileLinksFromStream(stream: PublicLolTwitchStream | undefined): PublicProfileLink[] {
  if (!stream) return [];
  if (stream.profileLinks?.length) return stream.profileLinks.filter((link) => Boolean(link.url));
  return stream.profileLinkUrl ? [{
    id: "legacy-profile-link",
    url: stream.profileLinkUrl,
    label: stream.profileLinkLabel ?? "Link",
    platform: profileLinkPlatformFromUrl(stream.profileLinkUrl)
  }] : [];
}

function visibleStreamerStream(stream: PublicLolTwitchStream | undefined): PublicLolTwitchStream | undefined {
  if (!stream || stream.source === "participation") return undefined;
  return stream;
}

function ProfileLinkIcons({ links }: { links: PublicProfileLink[] }) {
  if (!links.length) return null;
  return (
    <span className="public-profile-link-icons" aria-label={t().profileLinks}>
      {links.map((link, index) => {
        const platform = profileLinkPlatformClass(link.platform, link.url);
        return (
          <ProfileLinkIcon
            platform={platform}
            url={link.url}
            label={link.label}
            href={link.url}
            key={`${link.id ?? link.url}:${index}`}
          />
        );
      })}
    </span>
  );
}

function profileTopPanelText(): ProfileTopPanelText {
  return {
    searching: t().searching,
    recentMatches: { label: t().recentGames, ko: publicI18n.ko.recentGames, ja: publicI18n.ja.recentGames }
  };
}


/** Master 이상은 상위 컷 기준, 그 아래는 승급(100 LP) 기준으로 목표 문구가 갈립니다. */
const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);
const CHALLENGER_CUT_LP = 1900;

function profileHeroRankGoal(stats: LolRankedStats): { label: string; percent: number } | undefined {
  if (stats.tier === "CHALLENGER") return undefined;
  if (APEX_TIERS.has(stats.tier)) {
    const gap = Math.max(0, CHALLENGER_CUT_LP - stats.leaguePoints);
    if (gap === 0) return undefined;
    return {
      label: `${t().rankChallengerCut} ${formatNumber(CHALLENGER_CUT_LP)} LP${t().rankNextTierGap} ${formatNumber(gap)} LP`,
      percent: (stats.leaguePoints / CHALLENGER_CUT_LP) * 100,
    };
  }
  const gap = Math.max(0, 100 - stats.leaguePoints);
  return {
    label: `${t().rankPromotionGap} ${formatNumber(gap)} LP`,
    percent: Math.min(100, stats.leaguePoints),
  };
}

function profileHeroRankQueue(
  id: string,
  label: string,
  stats: LolRankedStats | undefined,
): ProfileHeroRankQueue {
  const ranked = Boolean(stats) && stats?.tier !== "UNRANKED";
  const winLabel = activePublicLocale === "ja" ? "勝" : "승";
  const lossLabel = activePublicLocale === "ja" ? "敗" : "패";
  if (!ranked || !stats) {
    return {
      id,
      label,
      ranked: false,
      tierKey: "unranked",
      tierFallbackLabel: "U",
      segmentValue: t().unranked,
      rankLabel: t().unranked,
      wins: 0,
      losses: 0,
      winsLabel: winLabel,
      lossesLabel: lossLabel,
      winRate: 0,
      recordCaption: t().noData,
      unrankedDescription: t().rankUnrankedDescription,
    };
  }
  return {
    id,
    label,
    ranked: true,
    tierKey: stats.tier.toLocaleLowerCase(),
    tierIconUrl: assetUrl(stats.tierIconUrl),
    tierFallbackLabel: stats.tier.slice(0, 1),
    segmentValue: `${formatNumber(stats.leaguePoints)} LP`,
    rankLabel: rankTierLabel(stats),
    leaguePointsLabel: `${formatNumber(stats.leaguePoints)} LP`,
    wins: stats.wins,
    losses: stats.losses,
    winsLabel: winLabel,
    lossesLabel: lossLabel,
    winRate: stats.winRate,
    recordCaption: `${gamesText(totalGames(stats))} · ${t().winRate} ${formatPercent(stats.winRate)}`,
    goal: profileHeroRankGoal(stats),
  };
}

function profileHeroRankQueues(profile: PublicLolProfile): ProfileHeroRankQueue[] {
  return [
    profileHeroRankQueue("solo", t().soloRank, soloRankStats(profile)),
    profileHeroRankQueue("flex", t().flexRank, flexRankStats(profile)),
    profileHeroRankQueue("ranked5v5", t().ranked5v5, ranked5v5Stats(profile)),
  ];
}

function profileHeroRankTrend(profile: PublicLolProfile): ProfileHeroRankTrend | undefined {
  const trend = rankTrendLine(profile);
  if (!trend || trend.points.length < 2) return undefined;
  return {
    ariaLabel: `${t().rankLpTrendLabel} ${t().period30}`,
    changeLabel: trend.change === 0 ? t().lpNoChange : `${trend.change > 0 ? "+" : ""}${trend.change} LP`,
    changeTone: trend.change > 0 ? "up" : trend.change < 0 ? "down" : "flat",
    points: trend.points.map((point) => ({ value: point.value, tierKey: tierKeyFromScore(point.value) })),
  };
}

function profileHeroTopChampions(profile: PublicLolProfile): ProfileTopIdentityChampion[] {
  return profile.championPerformance.slice(0, 3).map((entry) => ({
    key: String(entry.champion.championId),
    name: championName(entry.champion),
    iconUrl: assetUrl(entry.champion.iconUrl),
    fallbackLabel: championName(entry.champion).slice(0, 1),
  }));
}


/** "1시간 30분째" 처럼 방송 경과 시간을 만듭니다. 한 시간 미만이면 분만 씁니다. */
function streamerUptimeLabel(startedAt: string | undefined): string | undefined {
  if (!startedAt) return undefined;
  const startedMs = Date.parse(startedAt);
  if (!Number.isFinite(startedMs)) return undefined;
  const minutes = Math.max(0, Math.floor((Date.now() - startedMs) / 60_000));
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours <= 0) return `${restMinutes}${t().streamerUptimeMinutes}`;
  return `${hours}${t().streamerUptimeHours} ${restMinutes}${t().streamerUptimeMinutes}`;
}

function ProfileTopPanel({
  profile,
  loading,
  favoriteActive,
  refreshRemaining,
  onRefresh,
  onOpenParticipation,
  participationOpen,
  onToggleFavorite,
  tabs
}: {
  profile: PublicLolProfile;
  loading: boolean;
  favoriteActive: boolean;
  refreshRemaining: number;
  onRefresh: () => void;
  onOpenParticipation: () => void;
  participationOpen: boolean;
  onToggleFavorite: () => void;
  tabs?: ReactNode;
}) {
  const [activeRankQueue, setActiveRankQueue] = useState<string>();
  const refreshDisabled = loading || refreshRemaining > 0;
  const refreshCoolingDown = refreshRemaining > 0;
  const soloStats = soloRankStats(profile);
  const flexStats = flexRankStats(profile);
  const rank5v5Stats = ranked5v5Stats(profile);
  const masteryChampionArt = assetUrl(profile.topChampions[0]?.splashUrl ?? profile.topChampions[0]?.loadingUrl);
  const registeredStreamerStream = visibleStreamerStream(profile.twitchStream);
  const profileLinks = profileLinksFromStream(registeredStreamerStream);
  const supportingProfileLinks = profileLinks.filter((link) => (
    link.url !== registeredStreamerStream?.channelUrl
    && profileLinkPlatformClass(link.platform, link.url) !== "twitch"
  ));
  const fetchedAtText = `${formatRelativeDate(profile.fetchedAt)} ${t().profileFetchedAgo}`;
  const streamerProfileIconUrl = assetUrl(registeredStreamerStream?.profileImageUrl);
  const streamerSpotlight = registeredStreamerStream ? {
    isLive: registeredStreamerStream.isLive,
    eyebrow: t().streamerRecordSpotlight,
    displayName: registeredStreamerStream.twitchDisplayName,
    statusLabel: registeredStreamerStream.isLive ? t().streamerLiveNow : t().streamerOfflineNow,
    title: registeredStreamerStream.title,
    channelUrl: registeredStreamerStream.channelUrl,
    channelActionLabel: t().streamerWatch,
    participationActionLabel: participationOpen ? t().streamerParticipationApply : t().streamerParticipationView,
    supportingLinks: supportingProfileLinks,
    metrics: [
      {
        id: "current-game",
        label: t().ingame,
        value: profile.liveGame.isLive ? t().currentlyInGame : t().notInGame,
        tone: profile.liveGame.isLive ? "live" as const : "neutral" as const
      },
      ...(registeredStreamerStream.isLive && registeredStreamerStream.viewerCount !== undefined ? [{
        id: "viewers",
        label: t().twitchViewers,
        value: formatNumber(registeredStreamerStream.viewerCount),
        tone: "live" as const
      }] : []),
      {
        id: "participation",
        label: t().participationHeaderNav,
        value: participationOpen ? t().participationOpen : t().participationClosed,
        tone: participationOpen ? "live" as const : "neutral" as const
      }
    ]
  } : undefined;
  const streamerCast = registeredStreamerStream ? (
    <FeatureProfileStreamerCast
      channelUrl={registeredStreamerStream.channelUrl}
      gameName={registeredStreamerStream.gameName}
      isInGame={profile.liveGame.isLive}
      isLive={registeredStreamerStream.isLive}
      links={supportingProfileLinks}
      onOpenParticipation={onOpenParticipation}
      participationOpen={participationOpen}
      previewUrl={safeTwitchStreamPreviewUrl(registeredStreamerStream.thumbnailUrl)}
      renderLinkIcon={(link) => (
        <ProfileLinkIcon
          href={link.url}
          label={link.label}
          platform={profileLinkPlatformClass(link.platform, link.url)}
          url={link.url}
        />
      )}
      text={{
        ingameLabel: t().ingame,
        ingameNotice: t().streamerIngameNotice,
        liveBadge: "LIVE",
        liveHeading: t().streamerCastLive,
        offlineHeading: t().streamerCastRecent,
        offlineLabel: t().streamerOfflineNow,
        participationLabel: participationOpen ? t().streamerParticipationApply : t().streamerParticipationView,
        previewUnavailableLabel: t().streamerCastPreviewUnavailable,
        thumbnailLabel: t().streamerCastThumbnailLabel,
        // 좁은 폭에서 버튼 밖으로 넘치지 않도록 라벨은 "Twitch" 만 씁니다.
        watchAriaLabel: t().streamerWatch,
        watchLabel: t().streamerWatchShort,
      }}
      title={registeredStreamerStream.title}
      uptimeLabel={registeredStreamerStream.isLive
        ? streamerUptimeLabel(registeredStreamerStream.startedAt)
        : registeredStreamerStream.startedAt
          ? `${formatRelativeDate(registeredStreamerStream.startedAt)} ${t().streamerLastLive}`
          : undefined}
      viewersLabel={registeredStreamerStream.viewerCount !== undefined
        ? `${formatNumber(registeredStreamerStream.viewerCount)}${t().streamerViewersSuffix}`
        : undefined}
    />
  ) : undefined;
  const rankQueues = profileHeroRankQueues(profile);
  // 랭크가 있는 큐를 기본 선택합니다. 전부 언랭크면 솔로랭크를 보여 줍니다.
  const defaultRankQueueId = rankQueues.find((queue) => queue.ranked)?.id ?? rankQueues[0]?.id ?? "solo";
  const selectedRankQueueId = rankQueues.some((queue) => queue.id === activeRankQueue)
    ? activeRankQueue ?? defaultRankQueueId
    : defaultRankQueueId;
  const heroTrend = profileHeroRankTrend(profile);

  const normalizedPlatform = normalizeLolPlatformId(profile.lolPlatform) ?? DEFAULT_PUBLIC_LOL_PLATFORM;
  const canonicalProfilePath = localizedPublicUrlForCurrentLocale(
    publicSummonerPath(profile.riotId, normalizedPlatform),
  );
  const canonicalProfileUrl = typeof window === "undefined"
    ? `https://yoro.gg${canonicalProfilePath}`
    : new URL(canonicalProfilePath, window.location.origin).href;
  const shareTitle = activePublicLocale === "ja"
    ? `${profile.riotId} 戦績 | YORO.gg`
    : `${profile.riotId} 전적 | YORO.gg`;
  return (
    <FeatureProfileTopPanel
      displayName={profile.gameName}
      displayTagLabel={`#${profile.tagLine}`}
      favoriteActionLabel={favoriteActive ? t().favoriteRemove : t().favoriteAdd}
      favoriteActive={favoriteActive}
      favoriteAriaLabel={favoriteActive ? t().favoriteRemove : t().favoriteAdd}
      fetchedAtText={fetchedAtText}
      gameName={profile.gameName}
      loading={loading}
      masteryChampionArt={masteryChampionArt}
      onRefresh={onRefresh}
      onToggleFavorite={onToggleFavorite}
      mainRoleLabel={profile.roleAnalysis ? mainRoleLabel(profile.roleAnalysis.mainRole) : undefined}
      profileIconUrl={streamerProfileIconUrl ?? assetUrl(profile.profileIconUrl)}
      profileMetaLabel={undefined}
      profileLinks={<ProfileLinkIcons links={profileLinks} />}
      rankSection={(
        <FeatureProfileHeroRank
          activeQueueId={selectedRankQueueId}
          onSelectQueue={setActiveRankQueue}
          onViewRecentMatches={() => document.getElementById("public-recent-matches")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          queues={rankQueues}
          text={{
            lpTrendLabel: `${t().rankLpTrendLabel} · ${t().period30}`,
            queueSwitcherLabel: t().rankQueueSwitcher,
            unrankedTitle: t().rankUnrankedTitle,
            viewRecentMatchesLabel: t().rankViewRecentMatches,
          }}
          trend={heroTrend}
        />
      )}
      channelAriaLabel={registeredStreamerStream ? `${registeredStreamerStream.twitchDisplayName} · ${t().streamerWatch}` : undefined}
      liveStatus={registeredStreamerStream ? {
        isLive: registeredStreamerStream.isLive,
        label: registeredStreamerStream.isLive
          ? `LIVE${registeredStreamerStream.viewerCount !== undefined ? ` · ${formatNumber(registeredStreamerStream.viewerCount)}` : ""}`
          : t().streamerOfflineNow,
      } : undefined}
      channelName={registeredStreamerStream?.twitchDisplayName}
      channelUrl={registeredStreamerStream?.channelUrl}
      streamerCast={streamerCast}
      summonerLevelAriaLabel={profile.summonerLevel ? `${t().profileSummonerLevel} ${profile.summonerLevel}` : undefined}
      summonerLevelLabel={profile.summonerLevel ? `Lv.${formatNumber(profile.summonerLevel)}` : undefined}
      tabs={tabs}
      topChampions={profileHeroTopChampions(profile)}
      refreshButtonLabel={loading ? t().searching : t().refreshProfile}
      refreshCooldownLabel={formatCooldown(refreshRemaining)}
      refreshCoolingDown={refreshCoolingDown}
      refreshDisabled={refreshDisabled}
      refreshTitle={refreshCoolingDown ? `${formatCooldown(refreshRemaining)} ${t().refreshAvailableIn}` : t().refreshProfile}
      seasonBadges={null}
      shareAction={(
        <PublicProfileShareButton
          copiedLabel={t().shareRecordCopied}
          copyFailedLabel={t().shareRecordCopyFailed}
          label={t().shareRecord}
          text={`${profile.riotId}${t().shareRecordText}`}
          title={shareTitle}
          url={canonicalProfileUrl}
        />
      )}
      streamerSpotlight={streamerSpotlight}
      tagLine={profile.tagLine}
      text={profileTopPanelText()}
      onOpenParticipation={registeredStreamerStream ? onOpenParticipation : undefined}
    />
  );
}

function PublicMoreFeatures() {
  const features = [
    { title: t().aiFeatureTitle, body: t().aiFeatureBody, action: t().viewAnalysis },
    { title: t().positionFeatureTitle, body: t().positionFeatureBody, action: t().checkFeature },
    { title: t().overlayFeatureTitle, body: t().overlayFeatureBody, action: t().createFeature },
    { title: t().shareFeatureTitle, body: t().shareFeatureBody, action: t().createFeature }
  ];
  return (
    <section id="public-more-features" className="public-panel public-more-features">
      <div className="public-section-head">
        <h2  >{t().moreFeatures}</h2>
        <span  >{t().folded}</span>
      </div>
      <div className="public-more-feature-grid">
        {features.map((feature, index) => (
          <article key={feature.title}>
            <span aria-hidden="true">{index + 1}</span>
            <div>
              <strong>{feature.title}</strong>
              <p>{feature.body}</p>
              <button type="button">{feature.action}</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PublicProfileTabs({
  activeTab,
  onChange,
  onParticipation
}: {
  activeTab: PublicProfileTab;
  onChange: (tab: PublicProfileTab) => void;
  onParticipation: () => void;
}) {
  const openStats = () => {
    onChange("overview");
    window.requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      document.getElementById("public-stats")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
  };
  return (
    <nav className="public-profile-hero-nav" aria-label={t().profileSummary}>
      <button type="button" aria-current={activeTab === "overview" ? "page" : undefined} onClick={() => onChange("overview")}>{t().matchHistoryTab}</button>
      <button type="button" aria-current={activeTab === "champions" ? "page" : undefined} onClick={() => onChange("champions")}>{t().championAnalysis}</button>
      <button type="button" aria-current={activeTab === "ingame" ? "page" : undefined} onClick={() => onChange("ingame")}>{t().ingame}</button>
      <button type="button" onClick={onParticipation}>{t().participationHeaderNav}</button>
      <button type="button" onClick={openStats}>{t().stats}</button>
    </nav>
  );
}

function PublicProfileErrorState({ error }: { error: string }) {
  if (!error) return null;
  return (
    <EmptyState className="public-profile-shared-error" variant="error">
      <EmptyStateIcon>!</EmptyStateIcon>
      <EmptyStateTitle as="h2"  >
        {t().searchFailed}
      </EmptyStateTitle>
      <EmptyStateDescription>{error}</EmptyStateDescription>
    </EmptyState>
  );
}

function RankSummaryPanel({ profile }: { profile: PublicLolProfile }) {
  const stats = soloRankStats(profile);
  const tierIcon = assetUrl(stats?.tierIconUrl);
  return (
    <section className="public-panel public-rank-summary-panel">
      <div className="public-section-head">
        <h2  >{t().soloRank}</h2>
        <span>{stats ? `${stats.wins}${activePublicLocale === "ja" ? "勝" : "승"} ${stats.losses}${activePublicLocale === "ja" ? "敗" : "패"}` : t().noData}</span>
      </div>
      <div className="public-rank-summary-main">
        {tierIcon ? <img src={tierIcon} alt="" /> : <div className="public-rank-fallback">{stats?.tier?.slice(0, 1) ?? "U"}</div>}
        <div>
          <strong>{rankLabel(stats)}</strong>
          <span>{stats ? `${stats.leaguePoints} LP` : t().noData}</span>
          <p>{stats ? `${t().winRate} ${stats.winRate}% · ${gamesText(totalGames(stats))}` : t().noData}</p>
        </div>
      </div>
      <div className="public-rank-track" aria-label={t().rankTrend}>
        {["P4", "P3", "P2", "P1", "E4"].map((step, index) => (
          <span className={index < 3 ? "passed" : index === 3 ? "current" : ""} key={step}>{step}</span>
        ))}
      </div>
      <div className={`public-rank-mini-chart ${rankTrendTierClass(stats)}`}>
        <LpTrendLineChart profile={profile} compact />
      </div>
    </section>
  );
}

function FlexRankPlaceholder() {
  return (
    <section className="public-panel public-rank-summary-panel compact">
      <div className="public-section-head">
        <h2  >{t().flexRank}</h2>
      </div>
      <div className="public-rank-summary-main">
        <div className="public-rank-fallback">U</div>
        <div>
          <strong>{t().unranked}</strong>
          <span>{t().noData}</span>
        </div>
      </div>
    </section>
  );
}

/* 지표별 참조 최대치. 동티어 백분위가 없을 때 막대 길이를 만드는 기준입니다.
   백분위(benchmarkRatio)가 들어오면 이 값 대신 그 기준을 씁니다. */
const METRIC_SCALE_MAX = {
  kda: 6,
  killParticipation: 100,
  csPerMinute: 10,
  damageShare: 40,
  visionScore: 40,
} as const;

function metricRatio(value: number | undefined, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

/** rankHistory 의 연속한 두 점 차이가 곧 LP 변동입니다. 최신 3건만 씁니다. */
function profileLpChangeEntries(profile: PublicLolProfile): ProfileLpChangeEntry[] {
  const history = [...(profile.rankHistory ?? [])]
    .filter((point) => Number.isFinite(Date.parse(point.date)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const entries: ProfileLpChangeEntry[] = [];
  for (let index = history.length - 1; index > 0 && entries.length < 3; index -= 1) {
    const current = history[index];
    const previous = history[index - 1];
    if (!current || !previous) continue;
    const delta = current.leaguePoints - previous.leaguePoints;
    if (delta === 0) continue;
    entries.push({
      key: `${current.date}:${index}`,
      dateLabel: formatDate(current.date).split(" ")[0] ?? formatDate(current.date),
      delta,
      deltaLabel: `${delta > 0 ? "+" : ""}${delta} LP`,
      rangeLabel: `${previous.leaguePoints} → ${current.leaguePoints} LP`,
    });
  }
  return entries;
}

/** 히어로 LP 추이(ProfileHeroRank.tsx 의 LpSparkline)와 같은 규칙입니다 —
 * 구간은 "도착 지점" 티어색으로 칠하고, 이미 지난 구간은 되돌아가 다시 칠하지
 * 않습니다. 색은 20-profile-platform.css 의 .public-profile-platform-v2 에
 * 있는 --tier-lp-* 를 씁니다(히어로 크레스트의 --tier-color 와 같은 값). */
function ProfileSidebarLpChart({ points }: { points: Array<{ value: number; tierKey: string }> }) {
  const gradientId = useId();
  const width = 256;
  const height = 104;
  const pad = 4;
  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const span = Math.max(1, max - min);
  const coords = points.map((point, index) => ({
    x: pad + (index * (width - pad * 2)) / Math.max(1, points.length - 1),
    y: height - pad - ((point.value - min) / span) * (height - pad * 2),
    tierKey: point.tierKey,
  }));
  const segments = coords.slice(1).map((to, index) => ({ from: coords[index]!, to }));
  const area = `${pad},${height - pad} ${coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ")} ${width - pad},${height - pad}`;
  const last = coords.at(-1) ?? { x: pad, y: height - pad, tierKey: "unranked" };
  const colorOf = (tierKey: string) => `var(--tier-lp-${tierKey}, var(--tier-color))`;
  const gradientStops = segments.slice(0, -1).flatMap((segment, index) => {
    const boundaryOffset = (segment.to.x / width) * 100;
    return [
      <stop key={`${index}-out`} offset={`${boundaryOffset.toFixed(1)}%`} stopColor={colorOf(segment.to.tierKey)} />,
      <stop key={`${index}-in`} offset={`${boundaryOffset.toFixed(1)}%`} stopColor={colorOf(segments[index + 1]!.to.tierKey)} />,
    ];
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${t().rankLpTrendLabel} ${t().period30}`}>
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={gradientId} x1="0" x2={width} y1="0" y2="0">
          <stop offset="0%" stopColor={colorOf(segments[0]?.to.tierKey ?? last.tierKey)} />
          {gradientStops}
          <stop offset="100%" stopColor={colorOf(segments.at(-1)?.to.tierKey ?? last.tierKey)} />
        </linearGradient>
      </defs>
      <line className="grid" x1="0" y1={height * .34} x2={width} y2={height * .34} strokeDasharray="3 4" />
      <line className="grid" x1="0" y1={height * .67} x2={width} y2={height * .67} strokeDasharray="3 4" />
      <polygon className="area" fill={`url(#${gradientId})`} points={area} />
      {segments.map((segment, index) => (
        <line
          key={index}
          stroke={colorOf(segment.to.tierKey)}
          strokeLinecap="round"
          strokeWidth="2"
          x1={segment.from.x.toFixed(1)}
          x2={segment.to.x.toFixed(1)}
          y1={segment.from.y.toFixed(1)}
          y2={segment.to.y.toFixed(1)}
        />
      ))}
      {coords.slice(1, -1).map((point, index) => (
        point.tierKey !== coords[index]!.tierKey ? (
          <circle
            className="tier-change"
            cx={point.x.toFixed(1)}
            cy={point.y.toFixed(1)}
            key={`change-${index}`}
            r="3.5"
            stroke={colorOf(point.tierKey)}
          />
        ) : null
      ))}
      <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} fill={colorOf(last.tierKey)} r="3.5" />
    </svg>
  );
}

function OverviewMetricPanel({ profile }: { profile: PublicLolProfile }) {
  const summary = profile.summary;
  const aggregateSummary = summarizeMatches(recentAnalysisMatches(profile));
  const aggregateGrade = aggregatePerformanceGrade(profile);
  const aggregateScore = aggregatePerformanceScore(profile);
  const trend = rankTrendLine(profile);
  const soloStats = soloRankStats(profile) ?? profile.rankedStats;
  const lpEntries = profileLpChangeEntries(profile);
  const mainRole = profile.roleAnalysis?.mainRole;

  const metrics: ProfileMetricRow[] = [
    { key: "kda", label: t().kda, value: formatDecimal(summary.averageKda, 2), ratio: metricRatio(summary.averageKda, METRIC_SCALE_MAX.kda) },
    { key: "kill-participation", label: t().killParticipation, value: formatPercent(summary.averageKillParticipation), ratio: metricRatio(summary.averageKillParticipation, METRIC_SCALE_MAX.killParticipation) },
    { key: "cs-per-minute", label: t().perMinuteCs, value: formatDecimal(summary.averageCsPerMinute, 1), ratio: metricRatio(summary.averageCsPerMinute, METRIC_SCALE_MAX.csPerMinute) },
    { key: "damage-share", label: t().matchStatDamageShare, value: formatPercent(summary.averageDamageShare), ratio: metricRatio(summary.averageDamageShare, METRIC_SCALE_MAX.damageShare) },
    { key: "vision", label: t().vision, value: formatDecimal(summary.averageVisionScore, 1), ratio: metricRatio(summary.averageVisionScore, METRIC_SCALE_MAX.visionScore) },
  ];

  const roles: ProfileRoleEntry[] = profile.rolePerformance.slice(0, 5).map((role) => ({
    key: role.role,
    label: mainRoleLabel(role.role),
    icon: <RoleIcon role={role.role} />,
    isMain: role.role === mainRole,
    winRate: role.winRate,
    winRateLabel: formatPercent(role.winRate),
    recordLabel: winLossText(role.wins, role.games),
    kdaLabel: formatDecimal(role.averageKda, 1),
  }));

  return (
    <section id="public-stats" className="public-overview-dashboard-panel">
      <FeatureProfileMetricProfileCard
        grade={aggregateGrade}
        gradeClassName={metricToneClass(scoreTone(aggregateScore))}
        metrics={metrics}
        sampleShort={aggregateSummary.recentGames > 0 && aggregateSummary.recentGames < 10}
        score={aggregateScore}
        text={{
          gradeAriaLabel: t().aggregateGrade,
          noBenchmarkNotice: t().metricNoBenchmark,
          sampleShortNotice: `${t().metricSampleShort} · ${t().metricSampleNeeded.replace("{count}", String(Math.max(0, 10 - aggregateSummary.recentGames)))}`,
          title: t().metricProfileTitle,
        }}
      />

      <FeatureProfileLpRecordCard
        changeLabel={trend ? (trend.change === 0 ? t().lpNoChange : `${trend.change > 0 ? "+" : ""}${trend.change} LP`) : undefined}
        changeTone={trend ? (trend.change > 0 ? "up" : trend.change < 0 ? "down" : "flat") : "flat"}
        chart={trend && trend.points.length > 1 ? (
          <ProfileSidebarLpChart points={trend.points.map((point) => ({ value: point.value, tierKey: tierKeyFromScore(point.value) }))} />
        ) : undefined}
        currentLabel={soloStats ? `${rankTierLabel(soloStats)} ${soloStats.leaguePoints} LP` : t().unranked}
        entries={lpEntries}
        recordCount={trend?.sampleCount ?? 0}
        text={{
          emptyDescription: t().lpRecordEmptyDescription,
          emptyTitle: t().lpRecordEmptyTitle,
          periodLabel: t().period30,
          recordCountLabel: t().lpRecordCount,
          title: t().lpRecordTitle,
        }}
      />

      <FeatureProfileRoleCard
        roles={roles}
        text={{
          emptyLabel: t().noData,
          mainTag: t().roleMainTag,
          periodLabel: `${t().recentGames} ${profile.summary.recentGames}${t().games}`,
          title: t().rolePanelTitle,
        }}
      />
    </section>
  );
}

function PublicSidebar({
  activeTarget,
  favorites,
  theme,
  onHome,
  onOpenPremium,
  onNavigate,
  onPickFavorite,
  onTheme
}: {
  activeTarget: PublicNavTarget;
  favorites: PublicFavorite[];
  theme: PublicTheme;
  onHome: () => void;
  onOpenPremium: () => void;
  onNavigate: (target: PublicNavTarget) => void;
  onPickFavorite: (favorite: PublicFavorite) => void;
  onTheme: () => void;
}) {
  const items: Array<{ target: PublicNavTarget; icon: string; label: string; badge?: string }> = [
    { target: "search", icon: "⌕", label: t().searchNav },
    { target: "ranking", icon: "⌂", label: t().home },
    { target: "community", icon: "☆", label: t().favorite },
    { target: "ingame", icon: "◉", label: t().liveGame, badge: "12" },
    { target: "ranking", icon: "♕", label: t().ranking },
    { target: "champion", icon: "♛", label: t().championAnalysis },
    { target: "stats", icon: "▥", label: t().stats }
  ];
  return (
    <aside className="public-sidebar">
      <button className="public-sidebar-brand" type="button" onClick={onHome}>
        <img className="public-brand-logo" src="/images/yorogg-mark.png" alt={t().brand} />
      </button>
      <nav aria-label="YORO.gg">
        {items.map((item, index) => (
          <button className={activeTarget === item.target ? "active" : ""} type="button" onClick={() => onNavigate(item.target)} key={`${item.target}:${item.label}:${index}`}>
            <span aria-hidden="true">{item.icon}</span>
            <strong>{item.label}</strong>
            {item.badge ? <em>{item.badge}</em> : null}
          </button>
        ))}
      </nav>
      <section className="public-sidebar-favorites" aria-label={t().favoritesTitle}>
        <div>
          <strong  >{t().favoritesTitle}</strong>
          <span>{favorites.length}</span>
        </div>
        {favorites.length === 0 ? (
          <p  >{t().noFavorites}</p>
        ) : (
          <ul>
            {favorites.slice(0, 5).map((favorite) => (
              <li key={normalizeSuggestionKey(favorite)}>
                <button type="button" onClick={() => onPickFavorite(favorite)}>
                  <span>
                    {favorite.profileIconUrl ? <img src={assetUrl(favorite.profileIconUrl)} alt="" /> : favorite.gameName.slice(0, 1).toUpperCase()}
                  </span>
                  <strong>{favorite.gameName}</strong>
                  <small>#{favorite.tagLine}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="public-premium-card">
        <strong  >{t().premiumTitle}</strong>
        <p  >{t().premiumBody}</p>
        <button type="button" onClick={onOpenPremium}  >{t().premiumCta}</button>
      </div>
      <div className="public-sidebar-footer">
        <span>{t().version} 25.10</span>
        <button type="button" aria-label={t().darkMode} aria-pressed={theme === "dark"} onClick={onTheme}>{theme === "dark" ? "☾" : "☼"}</button>
      </div>
    </aside>
  );
}

function PublicFilterPanel({
  filters,
  champions,
  onChange,
  onReset
}: {
  filters: PublicMatchFilters;
  champions: LolChampionSummary[];
  onChange: (filters: PublicMatchFilters) => void;
  onReset: () => void;
}) {
  return (
    <div className="public-popover public-filter-popover">
      <div className="public-popover-head">
        <strong  >{t().filterTitle}</strong>
        <button type="button" onClick={onReset}  >{t().resetFilter}</button>
      </div>
      <label>
        <span  >{t().queueFilter}</span>
        <select value={filters.queue} onChange={(event) => onChange({ ...filters, queue: event.target.value as MatchQueueFilter })}>
          <option value="all">{t().allQueues}</option>
          <option value="solo">{t().soloQueue}</option>
          <option value="flex">{t().flexQueue}</option>
          <option value="ranked5v5">{t().ranked5v5}</option>
          <option value="normal">{t().normalQueue}</option>
          <option value="aram">{t().aramQueue}</option>
          <option value="aramMayhem">{t().aramMayhemQueue}</option>
        </select>
      </label>
      <ChampionFilterSelect
        allLabel={t().allChampions}
        label={t().championFilter}
        labelJa={publicI18n.ja.championFilter}
        labelKo={publicI18n.ko.championFilter}
        onChange={(championId) => onChange({ ...filters, championId })}
        options={champions.map((champion) => ({
          value: String(champion.championId),
          label: championName(champion),
          iconUrl: assetUrl(champion.iconUrl),
          fallbackLabel: championName(champion).slice(0, 1)
        }))}
        value={filters.championId}
      />
      <label>
        <span  >{t().periodFilter}</span>
        <select value={filters.period} onChange={(event) => onChange({ ...filters, period: event.target.value as MatchPeriodFilter })}>
          <option value="all">{t().periodAll}</option>
          <option value="7d">{t().period7}</option>
          <option value="30d">{t().period30}</option>
        </select>
      </label>
    </div>
  );
}

function PublicMatchFilterBar({
  filters,
  champions,
  onChange,
  onReset,
  resultSummary
}: {
  filters: PublicMatchFilters;
  champions: LolChampionSummary[];
  onChange: (filters: PublicMatchFilters) => void;
  onReset: () => void;
  resultSummary?: ReactNode;
}) {
  const filterActive = hasActiveFilters(filters);
  const championOptions = champions.map((champion) => ({
    value: String(champion.championId),
    label: championName(champion),
    iconUrl: assetUrl(champion.iconUrl),
    fallbackLabel: championName(champion).slice(0, 1)
  }));
  const text: PublicMatchFilterBarText = {
    filter: {
      label: t().filter,
      ko: publicI18n.ko.filter,
      ja: publicI18n.ja.filter
    },
    activeFilter: t().activeFilter,
    queueFilter: {
      label: t().queueFilter,
      ko: publicI18n.ko.queueFilter,
      ja: publicI18n.ja.queueFilter
    },
    championFilter: {
      label: t().championFilter,
      ko: publicI18n.ko.championFilter,
      ja: publicI18n.ja.championFilter
    },
    periodFilter: {
      label: t().periodFilter,
      ko: publicI18n.ko.periodFilter,
      ja: publicI18n.ja.periodFilter
    },
    resetFilter: {
      label: t().resetFilter,
      ko: publicI18n.ko.resetFilter,
      ja: publicI18n.ja.resetFilter
    },
    allQueues: t().allQueues,
    soloQueue: t().soloQueue,
    flexQueue: t().flexQueue,
    ranked5v5: t().ranked5v5,
    normalQueue: t().normalQueue,
    aramQueue: t().aramQueue,
    aramMayhemQueue: t().aramMayhemQueue,
    allChampions: t().allChampions,
    periodAll: t().periodAll,
    period7: t().period7,
    period30: t().period30,
    queueGroupLabel: t().matchFilterQueueGroup
  };
  return (
    <FeaturePublicMatchFilterBar
      championOptions={championOptions}
      filterActive={filterActive}
      filters={filters}
      onChampionChange={(championId) => onChange({ ...filters, championId })}
      onPeriodChange={(period) => onChange({ ...filters, period: period as MatchPeriodFilter })}
      onQueueChange={(queue) => onChange({ ...filters, queue: queue as MatchQueueFilter })}
      onReset={onReset}
      resultSummary={resultSummary}
      resultSummaryLabel={t().matchFilterResultSummary}
      text={text}
    />
  );
}

function PublicAppHeader({
  locale,
  profile,
  twitchStatus,
  activePage,
  activeTarget,
  showSearch = true,
  showFilters = true,
  query,
  loading,
  platform,
  platformOptions,
  suggestions,
  recentSearches = [],
  favorites = [],
  searchPanelRequest,
  filters,
  champions,
  onHome,
  onQuery,
  onPlatformChange,
  onClear,
  onSubmit,
  onPickSuggestion,
  onPage,
  onLocale,
  onAutoLocale,
  onTwitchLogin,
  onStreamerRegister,
  onStreamerRecord,
  onTwitchLogout,
  onFilters,
  onResetFilters
}: {
  locale: PublicLocale;
  profile: PublicLolProfile | null;
  twitchStatus: PublicTwitchViewerStatus;
  activePage: PublicMainPage;
  activeTarget: PublicNavTarget;
  showSearch?: boolean;
  showFilters?: boolean;
  query: string;
  loading: boolean;
  platform: LolPlatformId;
  platformOptions: readonly SearchFormPlatformOption[];
  suggestions: SearchSuggestion[];
  recentSearches?: SearchSuggestion[];
  favorites?: PublicFavorite[];
  searchPanelRequest?: SearchFormPanelRequest;
  filters: PublicMatchFilters;
  champions: LolChampionSummary[];
  onHome: () => void;
  onQuery: (value: string) => void;
  onPlatformChange: (platform: LolPlatformId) => void;
  onClear: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPickSuggestion: (suggestion: SearchSuggestion) => void;
  onPage: (page: PublicMainPage) => void;
  onLocale: (locale: PublicLocale) => void;
  onAutoLocale: () => void;
  onTwitchLogin: () => void;
  onStreamerRegister: () => void;
  onStreamerRecord: () => void;
  onTwitchLogout: () => void;
  onFilters: (filters: PublicMatchFilters) => void;
  onResetFilters: () => void;
}) {
  return (
    <FeaturePublicAppHeader
      locale={locale}
      twitchStatus={twitchStatus}
      activePage={activePage}
      activeTarget={activeTarget}
      showSearch={showSearch}
      showFilters={showFilters}
      filterActive={hasActiveFilters(filters)}
      searchContent={showSearch ? (
        <SearchForm
          query={query}
          loading={loading}
          platform={platform}
          platformOptions={platformOptions}
          onQuery={onQuery}
          onPlatformChange={onPlatformChange}
          onClear={onClear}
          onSubmit={onSubmit}
          suggestions={suggestions}
          recentSearches={recentSearches}
          favorites={favorites}
          panelRequest={searchPanelRequest}
          onPickSuggestion={onPickSuggestion}
        />
      ) : undefined}
      filterContent={<PublicFilterPanel filters={filters} champions={champions} onChange={onFilters} onReset={onResetFilters} />}
      onHome={onHome}
      onPage={onPage}
      onLocale={onLocale}
      onAutoLocale={onAutoLocale}
      onTwitchLogin={onTwitchLogin}
      onStreamerRegister={onStreamerRegister}
      onStreamerRecord={onStreamerRecord}
      onTwitchLogout={onTwitchLogout}
    />
  );
}

function PublicStreamerRegistrationScreen({
  status,
  onLogin,
  onBack,
  onSubmitted
}: {
  status: PublicTwitchViewerStatus;
  onLogin: () => void;
  onBack: () => void;
  onSubmitted: (request: StreamerRiotIdRequest) => void;
}) {
  const [riotIdDraft, setRiotIdDraft] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestError, setRequestError] = useState("");

  async function submitStreamerRiotIdRequest(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const riotId = riotIdDraft.trim();
    if (!riotId) return;
    setRequestBusy(true);
    setRequestMessage("");
    setRequestError("");
    try {
      const request = await requestPublicStreamerRiotId(riotId);
      setRiotIdDraft(`${request.riotGameName}#${request.riotTagLine}`);
      setRequestMessage(request.status === "approved" ? t().streamerRiotRequestApproved : t().streamerRiotRequestSent);
      onSubmitted(request);
    } catch (submitError) {
      setRequestError(submitError instanceof Error ? submitError.message : t().searchFailed);
    } finally {
      setRequestBusy(false);
    }
  }

  return (
    <section className="public-streamer-register-screen">
      <div className="public-streamer-register-card">
        <button className="public-back-button" type="button" onClick={onBack}>{t().streamerRiotRegisterBack}</button>
        <div className="public-streamer-register-head">
          <span className="public-streamer-register-avatar">
            {status.user?.profileImageUrl ? <img src={status.user.profileImageUrl} alt="" /> : <TwitchGlitchIcon />}
          </span>
          <div>
            <h1>{t().streamerRiotRegister}</h1>
            <p>{t().streamerRiotRegisterDescription}</p>
            {status.user ? <small>@{status.user.login}</small> : null}
          </div>
        </div>
        {!status.configured ? (
          <p className="public-empty">{t().twitchNotConfigured}</p>
        ) : !status.connected ? (
          <div className="public-streamer-register-login">
            <p>{t().twitchLoginRequired}</p>
            <button type="button" onClick={onLogin}>{t().twitchViewerLogin}</button>
          </div>
        ) : (
          <form className="public-streamer-riot-request standalone" onSubmit={(event) => void submitStreamerRiotIdRequest(event)}>
            <div>
              <strong  >{t().streamerRiotRequestTitle}</strong>
              <small  >{t().streamerRiotRequestBody}</small>
            </div>
            <label>
              <span className="sr-only">{t().streamerRiotRequestPlaceholder}</span>
              <input
                value={riotIdDraft}
                placeholder={t().streamerRiotRequestPlaceholder}
                onChange={(event) => setRiotIdDraft(event.target.value)}
                autoComplete="off"
              />
            </label>
            <button type="submit" disabled={requestBusy || !riotIdDraft.trim()}>
              {requestBusy ? t().streamerRiotRequestSubmitting : t().streamerRiotRequestSubmit}
            </button>
            {requestMessage ? <p className="public-form-message">{requestMessage}</p> : null}
            {requestError ? <p className="public-error">{requestError}</p> : null}
          </form>
        )}
      </div>
    </section>
  );
}

const PUBLIC_PARTICIPATION_ROLES: LolRole[] = ["fill", "top", "jungle", "mid", "adc", "support"];

function publicParticipationRoleLabel(role?: LolRole | string): string {
  switch (role) {
    case "top":
      return t().roleTop;
    case "jungle":
      return t().roleJungle;
    case "mid":
      return t().roleMid;
    case "adc":
      return t().roleAdc;
    case "support":
      return t().roleSupport;
    case "fill":
    default:
      return t().participationRoleFill;
  }
}

function publicParticipationRankText(item: PublicParticipationQueueItem): string {
  if (!item.rankedStats || item.rankedStats.tier === "UNRANKED") return t().participationRankPending;
  return rankLabel(item.rankedStats);
}

function publicParticipationStatusTone(status: ParticipationStatus): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "verified" || status === "checked_in" || status === "played") return "success";
  if (status === "selected" || status === "invited" || status === "in_game") return "info";
  if (status === "pending" || status === "waitlisted") return "warning";
  if (status === "cancelled" || status === "no_show" || status === "rejected" || status === "blocked" || status === "skipped") return "danger";
  return "neutral";
}

const PUBLIC_PARTICIPATION_STATUS_LABEL_KEYS: Record<ParticipationStatus, PublicTextKey> = {
  pending: "participationStatusPending",
  verified: "participationStatusVerified",
  waitlisted: "participationStatusWaitlisted",
  selected: "participationStatusSelected",
  checked_in: "participationStatusCheckedIn",
  invited: "participationStatusInvited",
  in_game: "participationStatusInGame",
  played: "participationStatusPlayed",
  skipped: "participationStatusSkipped",
  cancelled: "participationStatusCancelled",
  no_show: "participationStatusNoShow",
  rejected: "participationStatusRejected",
  blocked: "participationStatusBlocked",
};

function publicParticipationStatusLabel(status: ParticipationStatus): string {
  return publicText(PUBLIC_PARTICIPATION_STATUS_LABEL_KEYS[status]);
}

function publicParticipationIsActiveStatus(status: ParticipationStatus): boolean {
  return isViewerParticipationActive(status);
}

type PublicParticipationConfirmAction = "cancel";

/** 대기열에서 뷰어 주변만 남길 때 쓰는 창 크기입니다. */
const PUBLIC_PARTICIPATION_QUEUE_WINDOW = 5;

const PUBLIC_PARTICIPATION_ROLE_SHORT_KEYS: Record<LolRole, PublicTextKey> = {
  unknown: "participationRoleAny",
  fill: "participationRoleAny",
  top: "roleTop",
  jungle: "roleJungle",
  mid: "roleMid",
  adc: "roleAdc",
  support: "roleSupport",
};

/** 6열 버튼에 들어가야 하므로 "상관없음" 대신 짧은 라벨을 씁니다. */
function publicParticipationRoleShortLabel(role: LolRole): string {
  return publicText(PUBLIC_PARTICIPATION_ROLE_SHORT_KEYS[role]);
}

const PUBLIC_PARTICIPATION_PHASE_LABEL_KEYS: Record<ViewerQueuePhase, PublicTextKey> = {
  checking: "participationChecking",
  waiting: "participationStatusWaitlisted",
  soon: "participationTurnSoon",
  playing: "participationStatusInGame",
  done: "participationStatusPlayed",
  ended: "participationEnded",
};

function publicParticipationPhaseLabel(phase: ViewerQueuePhase): string {
  return publicText(PUBLIC_PARTICIPATION_PHASE_LABEL_KEYS[phase]);
}

/** 대기열 행의 오른쪽에 붙는 짧은 상태. 값이 없으면 티어·포지션을 보여줍니다. */
function publicParticipationRowStatus(
  status: ParticipationStatus
): { label: string; tone: "info" | "warn" | "good" | "mute" } | undefined {
  if (status === "in_game") return { label: t().participationStatusInGame, tone: "info" };
  // "곧 내 차례" 는 뷰어 자신의 행에만 씁니다. 남의 행에는 서버 상태 그대로 둡니다.
  if (status === "selected" || status === "checked_in" || status === "invited") {
    return { label: t().participationStatusSelected, tone: "warn" };
  }
  if (status === "pending") return { label: t().participationChecking, tone: "mute" };
  return undefined;
}

/** "Platinum II · 미드" 한 줄. 티어가 없으면 확인 대기로 둡니다. */
function publicParticipationRowDetail(item: PublicParticipationQueueItem): string {
  const tier = !item.rankedStats || item.rankedStats.tier === "UNRANKED"
    ? t().participationRankPending
    : rankTierLabel(item.rankedStats);
  const role = item.preferredRole ?? item.requestedRole;
  return role ? `${tier} · ${publicParticipationRoleLabel(role)}` : tier;
}

function PublicParticipationJoinPage({
  status,
  participation,
  discovery,
  loading,
  error,
  riotId,
  role,
  joining,
  cancelling,
  message,
  selectedStreamerId,
  onRefresh,
  onLogin,
  onStreamerClear,
  onStreamerSelect,
  onRiotIdChange,
  onRoleChange,
  onSubmit,
  onCancel,
}: {
  status: PublicTwitchViewerStatus;
  participation: PublicParticipationStateResponse | null;
  discovery: PublicParticipationDiscoveryResponse | null;
  loading: boolean;
  error: string;
  riotId: string;
  role: LolRole;
  joining: boolean;
  cancelling: boolean;
  message: string;
  selectedStreamerId: string;
  onRefresh: () => void;
  onLogin: () => void;
  onStreamerClear: () => void;
  onStreamerSelect: (streamer: PublicParticipationStreamer) => void;
  onRiotIdChange: (value: string) => void;
  onRoleChange: (value: LolRole) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const feedbackKey = error || message;
  const [pendingAction, setPendingAction] = useState<PublicParticipationConfirmAction | null>(null);
  const [dismissedFeedbackKey, setDismissedFeedbackKey] = useState("");
  const [riotIdError, setRiotIdError] = useState("");
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(() => (
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  ));
  const statusHeadingRef = useRef<HTMLDivElement>(null);
  const previousPhaseRef = useRef<ViewerQueuePhase>();

  const streamers = useMemo(() => {
    const candidates = [
      ...(Array.isArray(participation?.streamers) ? participation.streamers : []),
      ...(status.connected && discovery
        ? [
          ...(Array.isArray(discovery.followedRecruiting) ? discovery.followedRecruiting : []),
          ...(Array.isArray(discovery.followedOfflineRecruiting) ? discovery.followedOfflineRecruiting : [])
        ]
        : [])
    ];
    const directlySelected = participation
      ? (Array.isArray(participation.streamers) ? participation.streamers : []).find((streamer) => (
          streamer.publicSessionId === participation.publicSessionId
          || streamer.id === participation.selectedStreamerId
        ))
      : undefined;
    if (directlySelected) candidates.push(directlySelected);
    return [...new Map(candidates.map((streamer) => [streamer.publicSessionId ?? streamer.id, streamer])).values()];
  }, [discovery, participation, status.connected]);

  const selectedStreamer = selectedStreamerId
    ? streamers.find((streamer) => streamer.id === selectedStreamerId)
    : undefined;
  const effectiveSelectedStreamerId = selectedStreamer?.id ?? "";
  const hasSelectedParticipationState = Boolean(
    effectiveSelectedStreamerId && participation?.selectedStreamerId === effectiveSelectedStreamerId
  );
  const queue = hasSelectedParticipationState ? participation?.queue ?? [] : [];
  const isOpen = hasSelectedParticipationState && Boolean(participation?.isOpen);
  const viewerEntry = hasSelectedParticipationState ? participation?.viewerEntry : undefined;
  const viewerPhase = viewerEntry ? getViewerQueuePhase(viewerEntry.status) : undefined;
  const viewerActive = viewerEntry ? publicParticipationIsActiveStatus(viewerEntry.status) : false;
  const canJoin = isOpen && Boolean(selectedStreamer);
  const canRejoin = status.connected && canJoin && Boolean(
    viewerEntry && (viewerEntry.status === "played" || viewerEntry.status === "skipped")
  );
  const maxQueueSize = participation?.maxQueueSize ?? 0;

  /* 접었을 때도 내 순번은 반드시 보이도록 뷰어 주변을 창으로 잘라 냅니다. */
  const visibleQueue = useMemo(() => {
    if (queueExpanded || queue.length <= PUBLIC_PARTICIPATION_QUEUE_WINDOW) return queue;
    const viewerIndex = queue.findIndex((item) => item.isViewer);
    if (viewerIndex < 0) return queue.slice(0, PUBLIC_PARTICIPATION_QUEUE_WINDOW);
    // 진행 중인 맨 앞 두 명은 늘 남기고, 나머지 자리로 내 주변을 보여줍니다.
    const head = queue.slice(0, 2);
    const start = Math.min(
      Math.max(2, viewerIndex - 1),
      Math.max(2, queue.length - (PUBLIC_PARTICIPATION_QUEUE_WINDOW - head.length))
    );
    const tail = queue.slice(start, start + (PUBLIC_PARTICIPATION_QUEUE_WINDOW - head.length));
    return [...head, ...tail.filter((item) => !head.includes(item))];
  }, [queue, queueExpanded]);

  /* 잘라 낸 자리에 "⋯" 를 넣기 위해 끊긴 지점을 찾습니다. */
  const queueGapPositions = useMemo(() => {
    const gaps: number[] = [];
    for (let index = 1; index < visibleQueue.length; index += 1) {
      const previous = visibleQueue[index - 1];
      const current = visibleQueue[index];
      if (previous && current && current.position - previous.position > 1) gaps.push(previous.position);
    }
    return gaps;
  }, [visibleQueue]);

  const hiddenQueueCount = Math.max(0, queue.length - visibleQueue.length);
  const currentParticipant = queue.find((item) => item.status === "in_game");
  const currentParticipantLabel = currentParticipant?.twitchUserName ?? t().participationCurrentPlayerEmpty;
  const viewerQueueAhead = viewerEntry ? Math.max(0, viewerEntry.position - 1) : 0;
  const sessionStatusLabel = selectedStreamer?.sessionStatus === "in_game"
    ? t().participationSessionInGame
    : selectedStreamer?.sessionStatus === "completed"
      ? t().participationSessionCompleted
      : isOpen
        ? t().participationSessionRecruiting
        : t().participationSessionClosed;
  const sessionStatusTone = selectedStreamer?.sessionStatus === "in_game"
    ? "info" as const
    : selectedStreamer?.sessionStatus === "completed"
      ? "mute" as const
      : isOpen
        ? "good" as const
        : "warn" as const;

  const openStreamers = streamers.filter((streamer) => streamer.isOpen);
  const closedStreamers = status.connected ? discovery?.followedLiveButClosed ?? [] : [];

  useEffect(() => {
    if (feedbackKey) setDismissedFeedbackKey("");
  }, [feedbackKey]);

  useEffect(() => {
    setQueueExpanded(false);
  }, [effectiveSelectedStreamerId, participation?.publicSessionId]);

  /* 상태가 바뀌면 그 사실을 알립니다. 체크인이 없어졌으므로 시간 제한 안내는 없습니다. */
  useEffect(() => {
    if (!viewerPhase || previousPhaseRef.current === viewerPhase) return;
    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = viewerPhase;
    statusHeadingRef.current?.focus();
    if (notificationPermission !== "granted" || !previousPhase) return;
    const body = viewerPhase === "soon"
      ? t().participationNotificationSelected
      : viewerPhase === "playing"
        ? t().participationNotificationInGame
        : viewerPhase === "done"
          ? t().participationNotificationComplete
          : "";
    if (body) new Notification(t().participationMyStatusTitle, { body });
  }, [notificationPermission, viewerPhase]);

  useEffect(() => {
    if (!viewerEntry) return;
    if (!riotId.trim()) onRiotIdChange(viewerEntry.riotId);
    const nextRole = viewerEntry.preferredRole ?? viewerEntry.requestedRole;
    if (nextRole && role !== nextRole) onRoleChange(nextRole as LolRole);
  }, [onRiotIdChange, onRoleChange, riotId, role, viewerEntry]);

  function requestJoin(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsedRiotId = parseRiotIdDetailed(riotId);
    if (!parsedRiotId.ok) {
      setRiotIdError(t().participationRiotIdFormatError);
      return;
    }
    setRiotIdError("");
    onSubmit();
  }

  async function toggleNotifications(): Promise<void> {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    if (notificationPermission === "granted") return;
    setNotificationPermission(await Notification.requestPermission());
  }

  function streamerOption(streamer: PublicParticipationStreamer): ParticipationStreamerOption {
    return {
      key: streamer.publicSessionId ?? streamer.id,
      id: streamer.id,
      displayName: streamer.twitchDisplayName,
      avatar: streamer.twitchProfileImageUrl
        ? <img alt="" src={assetUrl(streamer.twitchProfileImageUrl)} />
        : streamer.twitchDisplayName.slice(0, 1),
      isLive: streamer.isLive === true,
      isOpen: streamer.isOpen,
      queueSize: streamer.queueSize,
      maxQueueSize: streamer.maxQueueSize ?? maxQueueSize,
    };
  }

  return (
    <section className={`public-participation-shell ${selectedStreamer && viewerActive ? "has-side" : ""}`}>
      {!error && status.configured && !status.connected ? (
        <EmptyState className="public-participation-shared-empty" variant="streamer">
          <EmptyStateIcon><TwitchGlitchIcon /></EmptyStateIcon>
          <EmptyStateTitle as="h3">{t().participationLoginDiscoveryTitle}</EmptyStateTitle>
          <EmptyStateActions>
            <Button type="button" onClick={onLogin}>{t().twitchViewerLogin}</Button>
          </EmptyStateActions>
        </EmptyState>
      ) : null}

      {error ? (
        <EmptyState as="div" className="public-participation-shared-empty" variant="error">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle as="h3">{t().searchFailed}</EmptyStateTitle>
          <EmptyStateDescription>{error}</EmptyStateDescription>
          <EmptyStateActions>
            <Button type="button" variant="secondary" onClick={onRefresh}>{t().participationRetry}</Button>
          </EmptyStateActions>
        </EmptyState>
      ) : null}

      {selectedStreamer ? (
        <ParticipationStreamerSwitcher
          avatar={selectedStreamer.twitchProfileImageUrl
            ? <img alt="" src={assetUrl(selectedStreamer.twitchProfileImageUrl)} />
            : selectedStreamer.twitchDisplayName.slice(0, 1)}
          displayName={selectedStreamer.twitchDisplayName}
          isLive={selectedStreamer.isLive === true}
          onChange={onStreamerClear}
          onRefresh={onRefresh}
          sessionLabel={sessionStatusLabel}
          sessionTone={sessionStatusTone}
          text={{
            changeLabel: t().participationChangeStreamer,
            liveLabel: t().streamerLiveNow,
            offlineLabel: t().twitchOfflineShort,
            refreshLabel: t().participationRefresh,
            watchAriaLabel: t().participationTwitchOpen,
            watchLabel: "Twitch",
          }}
          watchUrl={selectedStreamer.twitchLogin ? `https://www.twitch.tv/${selectedStreamer.twitchLogin}` : undefined}
        />
      ) : (
        <ParticipationStreamerPicks
          closedOptions={closedStreamers.map(streamerOption)}
          onSelect={(id) => {
            const next = streamers.find((streamer) => streamer.id === id);
            if (next) onStreamerSelect(next);
          }}
          options={openStreamers.map(streamerOption)}
          selectedId={effectiveSelectedStreamerId}
          text={{
            closedLabel: t().participationClosed,
            countLabel: t().participationStreamerCount,
            emptyLabel: t().participationNoOpenStreamer,
            title: t().participationStreamerTitle,
          }}
        />
      )}

      {selectedStreamer && viewerEntry && viewerPhase && viewerActive ? (
        <div ref={statusHeadingRef} tabIndex={-1}>
          <ParticipationMyStatus
            aheadLabel={viewerQueueAhead > 0
              ? t().participationQueueAheadShort.replace("{count}", formatNumber(viewerQueueAhead))
              : t().participationQueueAheadNone}
            canCancel={canCancelViewerQueue(viewerEntry.status)}
            cancelling={cancelling}
            capacityLabel={`${formatNumber(participation?.summary.active ?? 0)} / ${formatNumber(maxQueueSize)}`}
            currentPlayerLabel={currentParticipantLabel}
            notificationsEnabled={notificationPermission === "granted"}
            onCancel={() => setPendingAction("cancel")}
            onToggleNotifications={notificationPermission === "unsupported" ? undefined : () => void toggleNotifications()}
            phase={viewerPhase}
            phaseLabel={publicParticipationPhaseLabel(viewerPhase)}
            position={viewerEntry.position}
            text={{
              cancelLabel: t().participationCancel,
              cancellingLabel: t().participationCancelling,
              capacityLabel: t().participationCapacityLabel,
              currentPlayerLabel: t().participationCurrentPlayerLabel,
              notifyOffLabel: t().participationNotificationsEnable,
              notifyOnLabel: t().participationNotificationsEnabled,
            }}
          />
        </div>
      ) : null}

      {selectedStreamer && !viewerActive ? (
        <form className="public-participation-join" onSubmit={requestJoin}>
          <div className="public-participation-queue-head">
            <h3>{t().participationJoinTitle}</h3>
            <span className="public-participation-tag" data-tone={isOpen ? "good" : "warn"}>
              {isOpen ? t().participationSessionRecruiting : t().participationSessionClosed}
            </span>
          </div>

          {status.connected ? (
            <>
              <input
                aria-label={t().participationRiotIdLabel}
                autoComplete="off"
                className="public-participation-join-input"
                disabled={!canJoin || joining}
                id="public-participation-riot-id"
                onChange={(event) => {
                  setRiotIdError("");
                  onRiotIdChange(event.currentTarget.value);
                }}
                placeholder={t().participationRiotIdPlaceholder}
                value={riotId}
              />
              {riotIdError ? <p className="public-participation-join-error" role="alert">{riotIdError}</p> : null}

              <div aria-label={t().participationRoleLabel} className="public-participation-roles" role="group">
                {PUBLIC_PARTICIPATION_ROLES.map((item) => (
                  <button
                    aria-pressed={role === item}
                    className={`public-participation-role ${role === item ? "is-active" : ""}`}
                    disabled={!canJoin || joining}
                    key={item}
                    onClick={() => onRoleChange(item)}
                    title={publicParticipationRoleLabel(item)}
                    type="button"
                  >
                    <RoleIcon role={item} />
                    {publicParticipationRoleShortLabel(item)}
                  </button>
                ))}
              </div>

              <button
                className="public-participation-submit"
                disabled={!canJoin || joining || !riotId.trim()}
                type="submit"
              >
                {joining
                  ? t().participationSubmitting
                  : canRejoin ? t().participationRejoin : t().participationSubmit}
              </button>
            </>
          ) : (
            <Button type="button" onClick={onLogin}>{t().twitchViewerLogin}</Button>
          )}
        </form>
      ) : null}

      {selectedStreamer ? (
        <ParticipationQueueList
          expanded={queueExpanded}
          gapAfterPositions={queueGapPositions}
          hiddenCount={hiddenQueueCount}
          onToggle={() => setQueueExpanded((current) => !current)}
          rows={visibleQueue.map((item) => {
            const rowStatus = publicParticipationRowStatus(item.status);
            return {
              champions: (item.topChampions ?? []).slice(0, 2).map((champion) => ({
                iconUrl: champion.iconUrl ? assetUrl(champion.iconUrl) : undefined,
                key: String(champion.championId),
              })),
              detail: publicParticipationRowDetail(item),
              isViewer: item.isViewer,
              key: `${item.position}-${item.twitchUserName}`,
              name: item.isViewer ? t().participationViewerBadge : item.twitchUserName,
              position: item.position,
              statusLabel: item.isViewer && viewerPhase
                ? publicParticipationPhaseLabel(viewerPhase)
                : rowStatus?.label,
              statusTone: item.isViewer ? "brand" : rowStatus?.tone,
            };
          })}
          text={{
            emptyLabel: t().participationQueueEmpty,
            gapLabel: "⋯",
            lessLabel: t().participationQueueShowLess,
            moreLabel: t().participationQueueMore.replace("{count}", formatNumber(hiddenQueueCount)),
            title: t().participationQueueTitle,
          }}
          totalCount={queue.length}
        />
      ) : null}

      <Modal
        closeOnBackdrop
        onOpenChange={(open) => {
          if (!open && !joining && !cancelling) setPendingAction(null);
        }}
        open={Boolean(pendingAction)}
        size="md"
      >
        <ModalHeader>
          <ModalTitle>{t().participationCancelConfirmTitle}</ModalTitle>
          <ModalDescription>{t().participationCancelConfirmDescription}</ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Button
            disabled={!pendingAction}
            loading={cancelling}
            onClick={() => {
              if (pendingAction === "cancel") onCancel();
              setPendingAction(null);
            }}
            variant="danger"
          >
            {t().participationConfirm}
          </Button>
          <ModalCloseButton aria-label={t().participationClose} disabled={joining || cancelling}>
            {t().participationClose}
          </ModalCloseButton>
        </ModalFooter>
      </Modal>

      <ToastProvider position="bottom-right">
        <ToastViewport className="public-participation-toast-viewport">
          {feedbackKey && dismissedFeedbackKey !== feedbackKey ? (
            <Toast
              autoDismiss
              key={feedbackKey}
              onOpenChange={(open) => {
                if (!open) setDismissedFeedbackKey(feedbackKey);
              }}
              tone={error ? "danger" : "success"}
            >
              <ToastTitle>{error ? t().searchFailed : t().participationJoinTitle}</ToastTitle>
              <ToastDescription>{feedbackKey}</ToastDescription>
              <ToastCloseButton aria-label={t().participationClose}>×</ToastCloseButton>
            </Toast>
          ) : null}
        </ToastViewport>
      </ToastProvider>
    </section>
  );
}

function PublicTwitchFollowedPanel({
  status,
  followed,
  loading,
  error,
  title = t().twitchFollowedTitle,
  titleKo = publicI18n.ko.twitchFollowedTitle,
  titleJa = publicI18n.ja.twitchFollowedTitle,
  subtitle = t().twitchFollowedSubtitle,
  subtitleKo = publicI18n.ko.twitchFollowedSubtitle,
  subtitleJa = publicI18n.ja.twitchFollowedSubtitle,
  onLogin,
  onRefresh,
  onSearch
}: {
  status: PublicTwitchViewerStatus;
  followed: PublicTwitchFollowedLolResponse | null;
  loading: boolean;
  error: string;
  title?: string;
  titleKo?: string;
  titleJa?: string;
  subtitle?: string;
  subtitleKo?: string;
  subtitleJa?: string;
  onLogin: () => void;
  onRefresh: () => void;
  onSearch: (riotId: string) => void;
}) {
  const followedChannels = followed?.channels ?? [];
  const isFollowedLoading = loading && status.connected && followedChannels.length === 0;

  return (
    <section id="public-twitch-followed" className="public-panel public-twitch-followed-panel public-streamers-shared-panel">
      <PageHeader as="div" className="public-section-head public-streamers-shared-header" layout="split">
        <PageHeaderEyebrow>
          <StatusPill size="sm" tone={status.connected ? "streamer" : "warning"}>
            {status.connected ? status.user?.displayName ?? "Twitch" : t().twitchViewerLogin}
          </StatusPill>
        </PageHeaderEyebrow>
        <PageHeaderTitle as="h2"  >{title}</PageHeaderTitle>
        <PageHeaderDescription  >{subtitle}</PageHeaderDescription>
        <PageHeaderActions className="public-twitch-followed-actions">
          {status.connected ? (
            <Button type="button" variant="primary" size="sm" onClick={onRefresh} loading={loading} disabled={loading}>{loading ? t().searching : t().twitchFollowedRefresh}</Button>
          ) : (
            <Button type="button" variant="primary" size="sm" onClick={onLogin} disabled={!status.configured}>{t().twitchViewerLogin}</Button>
          )}
        </PageHeaderActions>
      </PageHeader>

      {!status.configured ? (
        <EmptyState as="div" className="public-streamers-shared-empty" variant="streamer">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle as="h3"  >{t().twitchNotConfigured}</EmptyStateTitle>
        </EmptyState>
      ) : !status.connected ? (
        <EmptyState as="div" className="public-streamers-shared-empty" variant="streamer">
          <EmptyStateIcon>?</EmptyStateIcon>
          <EmptyStateTitle as="h3"  >{t().twitchLoginRequired}</EmptyStateTitle>
        </EmptyState>
      ) : (
        <>
          {error ? (
            <EmptyState as="div" className="public-streamers-shared-empty public-streamers-shared-error" variant="error">
              <EmptyStateIcon>!</EmptyStateIcon>
              <EmptyStateTitle as="h3"  >{t().searchFailed}</EmptyStateTitle>
              <EmptyStateDescription>{error}</EmptyStateDescription>
            </EmptyState>
          ) : null}
          {isFollowedLoading ? (
            <div className="public-twitch-followed-list public-streamers-shared-loading" aria-busy="true">
              {Array.from({ length: 4 }, (_, index) => (
                <SkeletonCard className="public-streamers-shared-skeleton-card" key={index} loadingLabel={t().searching} size="md">
                  <SkeletonAvatar size="md" />
                  <SkeletonText lines={2} size="sm" />
                  <SkeletonButton size="sm" />
                </SkeletonCard>
              ))}
            </div>
          ) : null}
          {followedChannels.length === 0 && !loading ? (
            <EmptyState as="div" className="public-streamers-shared-empty" variant="streamer">
              <EmptyStateIcon>?</EmptyStateIcon>
              <EmptyStateTitle as="h3"  >{t().twitchFollowedEmpty}</EmptyStateTitle>
            </EmptyState>
          ) : null}
          <div
            aria-label={title}
            className="public-twitch-followed-list public-twitch-followed-scroll"
            role="region"
            tabIndex={followedChannels.length > 0 ? 0 : undefined}
          >
            {followedChannels.map((channel) => (
              <Card as="article" className={`public-streamers-shared-card ${channel.riotId ? "linked" : ""}`} key={channel.twitchUserId} padding="md" variant={channel.riotId ? "interactive" : "default"}>
                <div className="public-twitch-channel-main">
                  <span className="public-twitch-channel-avatar">
                    {channel.profileImageUrl ? <img src={channel.profileImageUrl} alt="" /> : channel.twitchDisplayName.slice(0, 1).toUpperCase()}
                    <i className={channel.isLive ? "live" : ""} />
                  </span>
                  <div>
                    <strong>{channel.twitchDisplayName}</strong>
                    <small>@{channel.twitchLogin}</small>
                    <StatusPill size="sm" tone={channel.isLive ? "live" : "neutral"}>{channel.isLive ? t().twitchLive : formatDate(channel.followedAt)}</StatusPill>
                  </div>
                </div>
                <div className="public-twitch-channel-meta">
                  {channel.riotId ? (
                    <>
                      <span>{channel.riotGameName ?? channel.riotId}{channel.riotTagLine ? <small>#{channel.riotTagLine}</small> : null}</span>
                      <Badge size="sm" tone={sharedRankTone(channel.rankedStats)}>{rankLabel(channel.rankedStats)}</Badge>
                    </>
                  ) : (
                    <Badge className="muted" size="sm" tone="warning">{t().twitchFollowedNoRiot}</Badge>
                  )}
                </div>
                <div className="public-twitch-channel-actions">
                  {channel.channelUrl ? <Button as="a" href={channel.channelUrl} target="_blank" rel="noreferrer" variant="secondary" size="sm">{t().openTwitch}</Button> : null}
                  {channel.riotId ? <Button type="button" variant="primary" size="sm" onClick={() => onSearch(channel.riotId!)}>{t().viewRecord}</Button> : null}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** 목록을 접었을 때 먼저 보여 줄 오프라인 인원입니다. */
const STREAMER_OFFLINE_PREVIEW = 5;

function PublicSubscriptionsPage({
  twitchStatus,
  followed,
  loading,
  error,
  onLogin,
  onRefresh,
  onSearch
}: {
  twitchStatus: PublicTwitchViewerStatus;
  followed: PublicTwitchFollowedLolResponse | null;
  loading: boolean;
  error: string;
  onLogin: () => void;
  onRefresh: () => void;
  onSearch: (riotId: string) => void;
}) {
  const [filter, setFilter] = useState<StreamerFilter>("all");
  const [sortByRank, setSortByRank] = useState(false);
  const [offlineExpanded, setOfflineExpanded] = useState(false);

  const channels = useMemo(() => followed?.channels ?? [], [followed]);
  const subscriptions = followed?.subscriptions ?? [];
  const buckets = useMemo(
    () => streamerBuckets(channels, filter, sortByRank),
    [channels, filter, sortByRank]
  );

  const cardText = {
    liveLabel: t().twitchLive,
    noRankLabel: t().streamerNoRankShort,
    profileLabel: t().viewRecord,
    watchLabel: "Twitch",
  };

  function toView(channel: PublicTwitchFollowedLolChannel): StreamerChannelView {
    const ranked = channel.rankedStats && channel.rankedStats.tier !== "UNRANKED" ? channel.rankedStats : undefined;
    return {
      avatar: channel.profileImageUrl
        ? <img alt="" src={assetUrl(channel.profileImageUrl)} />
        : channel.twitchDisplayName.slice(0, 1).toUpperCase(),
      channelUrl: channel.channelUrl,
      displayName: channel.twitchDisplayName,
      isLive: channel.isLive,
      key: channel.twitchUserId,
      login: channel.twitchLogin,
      onOpenProfile: channel.riotId ? () => onSearch(channel.riotId as string) : undefined,
      previewUrl: safeTwitchStreamPreviewUrl(channel.thumbnailUrl),
      rankClassName: ranked ? rankBadgeClass(ranked) : undefined,
      rankLabel: ranked ? rankTierLabel(ranked) : undefined,
      riotId: channel.riotId,
      subLabel: formatDate(channel.followedAt),
      title: channel.title,
      uptimeLabel: streamerUptimeLabel(channel.startedAt),
      viewersLabel: channel.viewerCount === undefined
        ? undefined
        : `${formatNumber(channel.viewerCount)}${t().streamerViewersUnit}`,
    };
  }

  const visibleOffline = offlineExpanded
    ? buckets.offline
    : buckets.offline.slice(0, STREAMER_OFFLINE_PREVIEW);
  const hiddenOffline = Math.max(0, buckets.offline.length - visibleOffline.length);

  return (
    <section className="public-streamer-shell" id="public-twitch-followed">
      <div className="public-streamer-section-head is-page">
        <h2>{t().streamersNav}</h2>
        <span className="public-streamer-count">{buckets.counts.all}</span>
        <Button
          className="public-streamer-refresh"
          disabled={loading}
          loading={loading}
          onClick={onRefresh}
          size="sm"
          type="button"
          variant="secondary"
        >
          {t().twitchFollowedRefresh}
        </Button>
      </div>

      {!twitchStatus.configured ? (
        <EmptyState as="div" className="public-streamers-shared-empty" variant="streamer">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle as="h3">{t().twitchNotConfigured}</EmptyStateTitle>
        </EmptyState>
      ) : !twitchStatus.connected ? (
        <EmptyState as="div" className="public-streamers-shared-empty" variant="streamer">
          <EmptyStateIcon><TwitchGlitchIcon /></EmptyStateIcon>
          <EmptyStateTitle as="h3">{t().twitchLoginRequired}</EmptyStateTitle>
          <EmptyStateActions>
            <Button onClick={onLogin} type="button">{t().twitchViewerLogin}</Button>
          </EmptyStateActions>
        </EmptyState>
      ) : error ? (
        <EmptyState as="div" className="public-streamers-shared-empty public-streamers-shared-error" variant="error">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle as="h3">{t().searchFailed}</EmptyStateTitle>
          <EmptyStateDescription>{error}</EmptyStateDescription>
          <EmptyStateActions>
            <Button onClick={onRefresh} type="button" variant="secondary">{t().participationRetry}</Button>
          </EmptyStateActions>
        </EmptyState>
      ) : (
        <>
          <StreamerFilterBar
            onSelect={(id) => setFilter(id as StreamerFilter)}
            onToggleSort={() => setSortByRank((current) => !current)}
            options={[
              { id: "live", label: t().streamerFilterLiveOnly.replace("{count}", formatNumber(buckets.counts.live)), live: true },
              { id: "all", label: t().streamerFilterAll.replace("{count}", formatNumber(buckets.counts.all)) },
              { id: "linked", label: t().streamerFilterLinked.replace("{count}", formatNumber(buckets.counts.linked)) },
            ]}
            selectedId={filter}
            sortByRank={sortByRank}
            sortLabel={t().streamerSortByRank}
          />

          {buckets.counts.all === 0 ? (
            <EmptyState as="div" className="public-streamers-shared-empty" variant="streamer">
              <EmptyStateIcon>?</EmptyStateIcon>
              <EmptyStateTitle as="h3">{t().twitchFollowedEmpty}</EmptyStateTitle>
            </EmptyState>
          ) : (
            <div className="public-streamer-body">
              <div className="public-streamer-section">
                {buckets.live.length > 0 ? (
                  <>
                    <div className="public-streamer-section-head">
                      <h3>{t().streamerLiveNowSection}</h3>
                      <span className="public-streamer-tag" data-tone="live">
                        <i aria-hidden="true" />{formatNumber(buckets.live.length)}
                      </span>
                    </div>
                    <div className="public-streamer-live-grid">
                      {buckets.live.map((channel) => (
                        <StreamerLiveCard channel={toView(channel)} key={channel.twitchUserId} text={cardText} />
                      ))}
                    </div>
                  </>
                ) : null}

                {buckets.offline.length > 0 ? (
                  <>
                    <div className="public-streamer-section-head">
                      <h3>{t().streamerOfflineSection}</h3>
                      <span className="public-streamer-count">{buckets.offline.length}</span>
                    </div>
                    <ol className="public-streamer-rows">
                      {visibleOffline.map((channel) => (
                        <StreamerRow channel={toView(channel)} key={channel.twitchUserId} text={cardText} />
                      ))}
                    </ol>
                    {hiddenOffline > 0 || offlineExpanded ? (
                      <button
                        aria-expanded={offlineExpanded}
                        className="public-streamer-more"
                        onClick={() => setOfflineExpanded((current) => !current)}
                        type="button"
                      >
                        {offlineExpanded
                          ? t().participationQueueShowLess
                          : t().participationQueueMore.replace("{count}", formatNumber(hiddenOffline))}
                      </button>
                    ) : null}
                  </>
                ) : null}

                {buckets.live.length === 0 && buckets.offline.length === 0 ? (
                  <p className="public-streamer-empty">{t().twitchFollowedEmpty}</p>
                ) : null}
              </div>

              <details className="public-streamer-side" open>
                <summary>
                  {t().subscriptionsTitle}
                  <span className="public-streamer-count">{subscriptions.length}</span>
                </summary>
                {followed && !followed.subscriptionScopeGranted ? (
                  <p className="public-streamer-empty">{t().subscriptionMissingScope}</p>
                ) : subscriptions.length === 0 ? (
                  <p className="public-streamer-empty">{t().subscriptionsEmpty}</p>
                ) : subscriptions.slice(0, 8).map((subscription) => (
                  <a
                    className="public-streamer-sub"
                    href={subscription.channelUrl}
                    key={`subscription:${subscription.twitchUserId}`}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    <span className="public-streamer-avatar">
                      {subscription.profileImageUrl
                        ? <img alt="" src={assetUrl(subscription.profileImageUrl)} />
                        : subscription.twitchDisplayName.slice(0, 1).toUpperCase()}
                    </span>
                    <b>{subscription.twitchDisplayName}</b>
                    <small>{subscription.tierLabel}{subscription.isGift ? ` · ${t().subscriptionGift}` : ""}</small>
                  </a>
                ))}
              </details>
            </div>
          )}
        </>
      )}
    </section>
  );
}

type CommunityToast = {
  title: string;
  description: string;
  tone: ToastTone;
};

function communityPostLimitState(category: CommunityPostCategory, twitchStatus: PublicTwitchViewerStatus, posts: CommunityPost[]) {
  const isParty = category === "party";
  const ownCategoryPosts = twitchStatus.user
    ? posts.filter((post) => post.authorTwitchUserId === twitchStatus.user?.id && communityPostCategory(post) === category)
    : [];
  const myPost = ownCategoryPosts[0];
  const recentPartyPostCount = isParty
    ? ownCategoryPosts.filter((post) => {
      const createdMs = Date.parse(post.createdAt);
      return Number.isFinite(createdMs) && Date.now() - createdMs < PARTY_COMMUNITY_POST_TTL_MS;
    }).length
    : 0;
  const partyLimitReached = isParty && recentPartyPostCount >= PARTY_COMMUNITY_POST_LIMIT;
  const serverLimitReached = !isParty && Boolean(myPost);
  return {
    isParty,
    myPost,
    recentPartyPostCount,
    partyLimitReached,
    serverLimitReached,
    postLimitReached: partyLimitReached || serverLimitReached
  };
}

function CommunityToastLayer({
  toast,
  onDismiss
}: {
  toast: CommunityToast | null;
  onDismiss: () => void;
}) {
  return (
    <ToastProvider position="bottom-right">
      <ToastViewport className="public-community-shared-toast-viewport">
        {toast ? (
          <Toast autoDismiss onDismiss={onDismiss} tone={toast.tone}>
            <ToastTitle>{toast.title}</ToastTitle>
            <ToastDescription>{toast.description}</ToastDescription>
            <ToastCloseButton aria-label={t().participationClose}>×</ToastCloseButton>
          </Toast>
        ) : null}
      </ToastViewport>
    </ToastProvider>
  );
}

function PublicCommunityPage({
  category,
  twitchStatus,
  posts,
  loading,
  error,
  toast,
  onRefresh,
  onWrite,
  onOpenPost,
  onDismissToast
}: {
  category: CommunityPostCategory;
  twitchStatus: PublicTwitchViewerStatus;
  posts: CommunityPost[];
  loading: boolean;
  error: string;
  toast: CommunityToast | null;
  onRefresh: () => void;
  onWrite: () => void;
  onOpenPost: (post: CommunityPost) => void;
  onDismissToast: () => void;
}) {
  const isParty = category === "party";
  const visiblePosts = posts.filter((post) => communityPostCategory(post) === category);
  const hasOwnServerPost = !isParty && Boolean(twitchStatus.user && visiblePosts.some((post) => post.authorTwitchUserId === twitchStatus.user?.id));
  const commentCount = visiblePosts.reduce((sum, post) => sum + (post.comments?.length ?? 0), 0);
  const tagCount = visiblePosts.reduce((sum, post) => sum + post.tags.length, 0);
  const pageTitle = isParty ? t().communityPartyRecruit : t().communityServerRecruit;
  const pageSubtitle = isParty ? t().communityPartySubtitle : t().communityServerSubtitle;
  const listTitle = isParty ? t().communityPartyListTitle : t().communityListTitle;
  const writeLabel = isParty ? t().communityPartyWriteButton : hasOwnServerPost ? t().communityEditButton : t().communityServerWriteButton;

  return (
    <AppShell
      as="section"
      className={`public-panel public-menu-page-panel public-community-page public-community-shared-shell list-only ${isParty ? "party" : "server"}`}
      mainId={`public-community-${category}-main`}
      showSkipLink={false}
      sidebarMode="drawer"
      variant="public"
    >
      <AppShellHeader as="div" className="public-community-shared-header">
        <PageHeader as="div" layout="split">
          <PageHeaderEyebrow  >
            {t().community}
          </PageHeaderEyebrow>
          <PageHeaderTitle
            as="h2"


          >
            {pageTitle}
          </PageHeaderTitle>
          <PageHeaderDescription


          >
            {pageSubtitle}
          </PageHeaderDescription>
          <PageHeaderStatus>
            <StatusPill tone={isParty ? "streamer" : "info"}>
              {isParty ? t().communityPartyRecruit : t().communityServerRecruit}
            </StatusPill>
          </PageHeaderStatus>
          <PageHeaderActions>
            <Button type="button" variant="secondary" loading={loading} onClick={onRefresh}  >
              {t().twitchFollowedRefresh}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={onWrite}


            >
              {writeLabel}
            </Button>
          </PageHeaderActions>
        </PageHeader>
      </AppShellHeader>

      <AppShellSidebar as="nav" className="public-community-shared-sidebar">
        <Navigation aria-label={t().community} variant="public">
          <NavigationSection title={t().community}>
            <NavigationItem active={!isParty} as="button" disabled={isParty} badge={<NavigationBadge>{!isParty ? visiblePosts.length : ""}</NavigationBadge>}>
              {t().communityServerRecruit}
            </NavigationItem>
            <NavigationItem active={isParty} as="button" disabled={!isParty} badge={<NavigationBadge>{isParty ? visiblePosts.length : ""}</NavigationBadge>}>
              {t().communityPartyRecruit}
            </NavigationItem>
          </NavigationSection>
          <NavigationSection title={listTitle}>
            <NavigationItem as="button" onClick={onRefresh} disabled={loading} badge={<NavigationBadge>{commentCount}</NavigationBadge>}>
              {t().communityCommentsTitle}
            </NavigationItem>
          </NavigationSection>
        </Navigation>
      </AppShellSidebar>

      <AppShellMain as="div" className="public-community-shared-main" id={`public-community-${category}-main`}>
        <div className="public-community-shared-metrics">
          <Metric label={listTitle} value={visiblePosts.length} tone={isParty ? "streamer" : "info"} size="sm" />
          <Metric label={t().communityCommentsTitle} value={commentCount} tone="neutral" size="sm" />
          <Metric label={t().communityTagsLabel} value={tagCount} tone="success" size="sm" />
        </div>

        {loading ? (
          <div className={isParty ? "public-party-post-list" : "public-community-post-grid"} role="status" aria-label={t().searching}>
            <SkeletonCard loadingLabel={t().searching} />
            <SkeletonCard loadingLabel={t().searching} />
            <SkeletonCard loadingLabel={t().searching} />
          </div>
        ) : null}

        {!loading && error ? (
          <EmptyState variant="error" as="div">
            <EmptyStateIcon>!</EmptyStateIcon>
            <EmptyStateTitle as="h3">{t().communityLoadFailed}</EmptyStateTitle>
            <EmptyStateDescription>{error}</EmptyStateDescription>
            <EmptyStateActions>
              <Button type="button" variant="secondary" onClick={onRefresh}>{t().twitchFollowedRefresh}</Button>
            </EmptyStateActions>
          </EmptyState>
        ) : null}

        {!loading && !error && visiblePosts.length === 0 ? (
          <EmptyState variant="community" as="div">
            <EmptyStateIcon>+</EmptyStateIcon>
            <EmptyStateTitle as="h3"  >
              {t().communityEmpty}
            </EmptyStateTitle>
            <EmptyStateDescription>{pageSubtitle}</EmptyStateDescription>
            <EmptyStateActions>
              <Button type="button" variant="primary" onClick={onWrite}>{writeLabel}</Button>
            </EmptyStateActions>
          </EmptyState>
        ) : null}

        {!loading && !error && visiblePosts.length > 0 ? (
          <div className={isParty ? "public-party-post-list public-community-shared-post-list" : "public-community-post-grid public-community-shared-post-grid"}>
            {visiblePosts.map((post) => {
              const postTags = post.tags.length ? post.tags : [post.partyMode, post.partyRole].filter((tag): tag is string => Boolean(tag));
              return (
                <Card
                  className={isParty ? "public-party-post public-community-shared-post-card" : post.imageUrl ? "public-community-post public-community-shared-post-card has-image" : "public-community-post public-community-shared-post-card"}
                  key={post.id}
                  onClick={() => onOpenPost(post)}
                  padding="lg"
                  variant="interactive"
                >
                  {post.imageUrl && !isParty ? (
                    <div className="public-community-post-media" aria-hidden="true">
                      <img src={assetUrl(post.imageUrl)} alt="" />
                    </div>
                  ) : null}
                  <CardHeader className="public-community-shared-post-header">
                    <span className="public-community-avatar">
                      {post.authorProfileImageUrl ? <img src={post.authorProfileImageUrl} alt="" /> : <em>{post.authorDisplayName.slice(0, 1).toUpperCase()}</em>}
                    </span>
                    <div>
                      <CardTitle as="h3">{post.title}</CardTitle>
                      <CardDescription>@{post.authorTwitchLogin} · {formatRelativeDate(post.createdAt)}</CardDescription>
                    </div>
                    <StatusPill size="sm" tone={isParty ? "streamer" : "info"}>
                      {isParty ? t().communityPartyRecruit : t().communityServerRecruit}
                    </StatusPill>
                  </CardHeader>
                  <CardContent className="public-community-shared-post-content">
                    <p>{post.body}</p>
                    <div className="public-community-post-meta">
                      {post.riotGameName && post.riotTagLine ? <Badge tone="info">{t().communityRecordLabel} {post.riotGameName}#{post.riotTagLine}</Badge> : null}
                      {postTags.slice(0, 4).map((tag) => <Badge tone="neutral" key={`${post.id}:${tag}`}>#{publicOptionLabel(PARTY_TAG_OPTIONS, tag)}</Badge>)}
                    </div>
                    <div className="public-community-shared-card-metrics">
                      <Metric label={t().communityCommentsTitle} value={post.comments?.length ?? 0} tone="neutral" size="sm" />
                      <Metric label={t().communityTagsLabel} value={postTags.length} tone="success" size="sm" />
                      {isParty ? (
                        <Metric label={t().communityPartyCapacityLabel} value={post.partyCapacity ? `1 / ${post.partyCapacity}` : "-"} tone="streamer" size="sm" />
                      ) : (
                        <Metric label={t().communityRecordLabel} value={post.riotGameName && post.riotTagLine ? "OK" : "-"} tone={post.riotGameName && post.riotTagLine ? "info" : "neutral"} size="sm" />
                      )}
                    </div>
                  </CardContent>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={(event: MouseEvent<HTMLButtonElement>) => {
                      event.stopPropagation();
                      onOpenPost(post);
                    }}
                  >
                    {t().viewAnalysis}
                  </Button>
                </Card>
              );
            })}
          </div>
        ) : null}
      </AppShellMain>
      <CommunityToastLayer toast={toast} onDismiss={onDismissToast} />
    </AppShell>
  );
}

function PublicCommunityWritePage({
  category,
  twitchStatus,
  posts,
  editingPost,
  error,
  submitting,
  toast,
  onLogin,
  onBack,
  onSubmit,
  onDismissToast
}: {
  category: CommunityPostCategory;
  twitchStatus: PublicTwitchViewerStatus;
  posts: CommunityPost[];
  editingPost?: CommunityPost;
  error: string;
  submitting: boolean;
  toast: CommunityToast | null;
  onLogin: () => void;
  onBack: () => void;
  onSubmit: (input: CommunityPostSubmitInput) => Promise<boolean>;
  onDismissToast: () => void;
}) {
  const isParty = category === "party";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [riotId, setRiotId] = useState("");
  const [tags, setTags] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [partyTier, setPartyTier] = useState("");
  const [partyRole, setPartyRole] = useState("");
  const [partyMode, setPartyMode] = useState("");
  const [partyVoice, setPartyVoice] = useState("");
  const [partyCapacity, setPartyCapacity] = useState("4");
  const [riotCheckStatus, setRiotCheckStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [riotCheckMessage, setRiotCheckMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const { myPost, recentPartyPostCount, postLimitReached, partyLimitReached } = communityPostLimitState(category, twitchStatus, posts);
  const isEditingServerPost = !isParty && Boolean(editingPost);
  const canSubmit = Boolean(title.trim() && body.trim()) && (!postLimitReached || isEditingServerPost) && !submitting;

  useEffect(() => {
    if (isEditingServerPost && editingPost) {
      setTitle(editingPost.title);
      setBody(editingPost.body);
      setRiotId(communityPostRiotId(editingPost) ?? "");
      setTags(editingPost.tags.join(", "));
      setSelectedTags([]);
      setImageFile(null);
      setRiotCheckStatus("idle");
      setRiotCheckMessage("");
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    setTitle("");
    setBody("");
    setRiotId("");
    setTags("");
    setSelectedTags([]);
    setImageFile(null);
    setPartyTier("");
    setPartyRole("");
    setPartyMode("");
    setPartyVoice("");
    setPartyCapacity("4");
    setRiotCheckStatus("idle");
    setRiotCheckMessage("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  }, [category, editingPost?.id, isEditingServerPost]);

  function updateRiotId(value: string): void {
    setRiotId(value);
    setRiotCheckStatus("idle");
    setRiotCheckMessage("");
  }

  function togglePartyTag(value: string): void {
    setSelectedTags((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function checkRiotId(): Promise<void> {
    const parsed = splitRiotIdText(riotId);
    if (!parsed) {
      setRiotCheckStatus("invalid");
      setRiotCheckMessage(t().communityRiotIdInvalid);
      return;
    }
    setRiotCheckStatus("checking");
    setRiotCheckMessage("");
    try {
      const profile = await searchProfile(`${parsed.gameName}#${parsed.tagLine}`);
      setRiotId(`${profile.gameName}#${profile.tagLine}`);
      setRiotCheckStatus("valid");
      setRiotCheckMessage(`${t().communityRiotIdValid} ${profile.gameName}#${profile.tagLine}`);
    } catch {
      setRiotCheckStatus("invalid");
      setRiotCheckMessage(t().communityRiotIdInvalid);
    }
  }

  function communitySubmitInput(): CommunityPostSubmitInput {
    return {
      category,
      title,
      body,
      riotId,
      tags: isParty ? selectedTags.join(",") : tags,
      imageFile,
      partyTier: isParty ? partyTier : undefined,
      partyRole: isParty ? partyRole : undefined,
      partyMode: isParty ? partyMode : undefined,
      partyVoice: isParty ? partyVoice : undefined,
      partyCapacity: isParty ? Number(partyCapacity) || undefined : undefined
    };
  }

  async function submitConfirmed(): Promise<void> {
    if (!canSubmit) return;
    const created = await onSubmit({
      ...communitySubmitInput()
    });
    if (!created) return;
    setConfirmOpen(false);
    setTitle("");
    setBody("");
    setRiotId("");
    setTags("");
    setSelectedTags([]);
    setImageFile(null);
    setPartyTier("");
    setPartyRole("");
    setPartyMode("");
    setPartyVoice("");
    setPartyCapacity("4");
    if (imageInputRef.current) imageInputRef.current.value = "";
    onBack();
  }

  function submitPost(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSubmit) return;
    setConfirmOpen(true);
  }

  return (
    <AppShell
      as="section"
      className={`public-panel public-menu-page-panel public-community-write-page public-community-shared-shell ${isParty ? "party" : "server"}`}
      mainId="public-community-write-main"
      showSkipLink={false}
      sidebarMode="drawer"
      variant="public"
    >
      <AppShellHeader as="div" className="public-community-shared-header">
        <PageHeader as="div" layout="split">
          <PageHeaderEyebrow  >{t().community}</PageHeaderEyebrow>
          <PageHeaderTitle
            as="h2"


          >
            {isParty ? t().communityPartyWriteTitle : isEditingServerPost ? t().communityEditTitle : t().communityWriteTitle}
          </PageHeaderTitle>
          <PageHeaderDescription


          >
            {isParty ? t().communityPartySubtitle : t().communityServerSubtitle}
          </PageHeaderDescription>
          <PageHeaderStatus>
            <StatusPill tone={isParty ? "streamer" : "info"}>
              {isEditingServerPost ? t().communityEditTitle : isParty ? t().communityPartyRecruit : t().communityServerRecruit}
            </StatusPill>
          </PageHeaderStatus>
          <PageHeaderActions>
            <Button type="button" variant="secondary" onClick={onBack}  >
              {t().communityBackToList}
            </Button>
          </PageHeaderActions>
        </PageHeader>
      </AppShellHeader>

      <AppShellSidebar as="nav" className="public-community-shared-sidebar">
        <Navigation aria-label={t().community} variant="public">
          <NavigationSection title={t().community}>
            <NavigationItem active as="button" badge={<NavigationBadge>{isParty ? t().communityPartyRecruit : t().communityServerRecruit}</NavigationBadge>}>
              {isEditingServerPost ? t().communityEditTitle : t().communityWriteTitle}
            </NavigationItem>
          </NavigationSection>
        </Navigation>
      </AppShellSidebar>

      <AppShellMain as="div" className="public-community-shared-main" id="public-community-write-main">
        <Card className="public-community-compose standalone public-community-shared-compose" padding="lg" variant="glass">
          {!twitchStatus.connected ? (
            <EmptyState variant="community" as="div">
              <EmptyStateIcon>TV</EmptyStateIcon>
              <EmptyStateTitle as="h3"  >
                {t().communityLoginRequired}
              </EmptyStateTitle>
              <EmptyStateActions>
                <Button type="button" variant="primary" onClick={onLogin}  >
                  {t().twitchViewerLogin}
                </Button>
              </EmptyStateActions>
            </EmptyState>
          ) : postLimitReached && !isEditingServerPost ? (
            <EmptyState variant="community" as="div">
              <EmptyStateIcon>!</EmptyStateIcon>
              <EmptyStateTitle as="h3">{partyLimitReached ? t().communityPartyLimitReached : t().communityAlreadyPosted}</EmptyStateTitle>
              <EmptyStateDescription>
                {isParty ? `${recentPartyPostCount} / ${PARTY_COMMUNITY_POST_LIMIT} · ${t().communityPartyAutoDeleteNotice}` : myPost?.title ?? t().communityAlreadyPosted}
              </EmptyStateDescription>
              <EmptyStateActions>
                <Button type="button" variant="secondary" onClick={onBack}>{t().communityBackToList}</Button>
              </EmptyStateActions>
            </EmptyState>
          ) : (
            <form className="public-community-form public-community-shared-form" onSubmit={submitPost}>
              {error ? (
                <EmptyState variant="error" as="div">
                  <EmptyStateIcon>!</EmptyStateIcon>
                  <EmptyStateTitle as="h3">{t().searchFailed}</EmptyStateTitle>
                  <EmptyStateDescription>{error}</EmptyStateDescription>
                </EmptyState>
              ) : null}
              {isParty ? (
                <StatusPill tone="info"  >
                  {t().communityPartyAutoDeleteNotice}
                </StatusPill>
              ) : null}
              <FormField required>
                <FormLabel  >{t().communityTitleLabel}</FormLabel>
                <FormControl>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.currentTarget.value)}
                    maxLength={80}
                    placeholder={isParty ? t().communityPartyTitlePlaceholder : t().communityTitlePlaceholder}


                    required
                  />
                </FormControl>
              </FormField>
              <FormField required>
                <FormLabel  >{t().communityBodyLabel}</FormLabel>
                <FormControl>
                  <Textarea
                    value={body}
                    onChange={(event) => setBody(event.currentTarget.value)}
                    maxLength={1000}
                    rows={isParty ? 5 : 6}
                    placeholder={isParty ? t().communityPartyBodyPlaceholder : t().communityBodyPlaceholder}


                    required
                  />
                </FormControl>
              </FormField>
              {isParty ? (
                <div className="public-party-option-grid public-community-shared-option-grid">
                  <FormField>
                    <FormLabel  >{t().communityPartyTierLabel}</FormLabel>
                    <FormControl>
                      <Select value={partyTier} onChange={(event) => setPartyTier(event.currentTarget.value)}>
                        <option value="">{t().communitySelectPlaceholder}</option>
                        {PARTY_TIER_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option[activePublicLocale]}</option>)}
                      </Select>
                    </FormControl>
                  </FormField>
                  <FormField>
                    <FormLabel  >{t().communityPartyRoleLabel}</FormLabel>
                    <FormControl>
                      <Select value={partyRole} onChange={(event) => setPartyRole(event.currentTarget.value)}>
                        <option value="">{t().communitySelectPlaceholder}</option>
                        {PARTY_ROLE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option[activePublicLocale]}</option>)}
                      </Select>
                    </FormControl>
                  </FormField>
                  <FormField>
                    <FormLabel  >{t().communityPartyModeLabel}</FormLabel>
                    <FormControl>
                      <Select value={partyMode} onChange={(event) => setPartyMode(event.currentTarget.value)}>
                        <option value="">{t().communitySelectPlaceholder}</option>
                        {PARTY_MODE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option[activePublicLocale]}</option>)}
                      </Select>
                    </FormControl>
                  </FormField>
                  <FormField>
                    <FormLabel  >{t().communityPartyVoiceLabel}</FormLabel>
                    <FormControl>
                      <Select value={partyVoice} onChange={(event) => setPartyVoice(event.currentTarget.value)}>
                        <option value="">{t().communitySelectPlaceholder}</option>
                        {PARTY_VOICE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option[activePublicLocale]}</option>)}
                      </Select>
                    </FormControl>
                  </FormField>
                  <FormField>
                    <FormLabel  >{t().communityPartyCapacityLabel}</FormLabel>
                    <FormControl>
                      <Input type="number" min={2} max={10} value={partyCapacity} onChange={(event) => setPartyCapacity(event.currentTarget.value)} />
                    </FormControl>
                  </FormField>
                </div>
              ) : null}
              <FormField>
                <FormLabel  >{t().communityRiotIdLabel}</FormLabel>
                <FormControl className={`public-community-riot-check ${riotCheckStatus}`}>
                  <Input
                    value={riotId}
                    onChange={(event) => updateRiotId(event.currentTarget.value)}
                    maxLength={80}
                    placeholder={t().communityRiotIdPlaceholder}


                  />
                  <Button type="button" variant="secondary" onClick={checkRiotId} disabled={!riotId.trim() || riotCheckStatus === "checking"}>
                    {riotCheckStatus === "checking" ? t().communityRiotIdChecking : t().communityRiotIdCheck}
                  </Button>
                </FormControl>
                {riotCheckMessage ? <FormHint className={`public-community-riot-message ${riotCheckStatus}`}>{riotCheckMessage}</FormHint> : null}
              </FormField>
              {isParty ? (
                <FormField>
                  <FormLabel  >{t().communityTagsLabel}</FormLabel>
                  <FormControl className="public-community-tag-picker">
                    {PARTY_TAG_OPTIONS.map((option) => (
                      <Button
                        className={selectedTags.includes(option.value) ? "active" : ""}
                        type="button"
                        variant={selectedTags.includes(option.value) ? "primary" : "ghost"}
                        size="sm"
                        onClick={() => togglePartyTag(option.value)}
                        key={option.value}
                      >
                        #{option[activePublicLocale]}
                      </Button>
                    ))}
                  </FormControl>
                </FormField>
              ) : (
                <FormField>
                  <FormLabel  >{t().communityTagsLabel}</FormLabel>
                  <FormControl>
                    <Input
                      value={tags}
                      onChange={(event) => setTags(event.currentTarget.value)}
                      maxLength={120}
                      placeholder={t().communityTagsPlaceholder}


                    />
                  </FormControl>
                </FormField>
              )}
              <FormField className="public-community-file-field">
                <FormLabel  >{t().communityImageLabel}</FormLabel>
                <FormControl className="public-community-file-control">
                  <Button type="button" variant="secondary" onClick={() => imageInputRef.current?.click()}>
                    {t().communityImageChoose}
                  </Button>
                  <strong>{imageFile ? `${t().communityImageSelected}: ${imageFile.name}` : t().communityImageEmpty}</strong>
                </FormControl>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={(event) => setImageFile(event.currentTarget.files?.[0] ?? null)}
                />
                <FormHint


                >
                  {isEditingServerPost ? t().communityImageReplaceHelp : t().communityImageHelp}
                </FormHint>
              </FormField>
              <Button type="submit" variant="primary" loading={submitting} disabled={!canSubmit}>
                {submitting ? (isEditingServerPost ? t().communityUpdating : t().communitySubmitting) : isEditingServerPost ? t().communityUpdateSubmit : t().communitySubmit}
              </Button>
            </form>
          )}
        </Card>
      </AppShellMain>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} closeDisabled={submitting} loading={submitting} size="sm">
        <ModalHeader>
          <ModalTitle>{isEditingServerPost ? t().communityUpdateSubmit : t().communitySubmit}</ModalTitle>
          <ModalCloseButton aria-label={t().participationClose} disabled={submitting}>×</ModalCloseButton>
        </ModalHeader>
        <ModalContent>
          <ModalDescription>{title}</ModalDescription>
        </ModalContent>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>
            {t().participationClose}
          </Button>
          <Button type="button" variant="primary" loading={submitting} onClick={() => void submitConfirmed()}>
            {t().participationConfirm}
          </Button>
        </ModalFooter>
      </Modal>
      <CommunityToastLayer toast={toast} onDismiss={onDismissToast} />
    </AppShell>
  );
}

function PublicCommunityDetailPage({
  post,
  profileState,
  twitchStatus,
  commentSubmitting,
  commentError,
  reportSubmitting,
  reportError,
  toast,
  onLogin,
  onBack,
  onSearchRiotId,
  onSubmitComment,
  onSubmitReport,
  onDismissToast
}: {
  post: CommunityPost | undefined;
  profileState: CommunityPostProfileState;
  twitchStatus: PublicTwitchViewerStatus;
  commentSubmitting: boolean;
  commentError: string;
  reportSubmitting: boolean;
  reportError: string;
  toast: CommunityToast | null;
  onLogin: () => void;
  onBack: () => void;
  onSearchRiotId: (riotId: string) => void;
  onSubmitComment: (postId: string, body: string) => Promise<void>;
  onSubmitReport: (postId: string, input: CommunityPostReportCreateInput) => Promise<boolean>;
  onDismissToast: () => void;
}) {
  const [commentBody, setCommentBody] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<CommunityPostReportCreateInput["reason"]>("spam");
  const [reportDetail, setReportDetail] = useState("");
  const riotId = communityPostRiotId(post);
  const profile = profileState.profile;
  const primaryRank = profile ? soloRankStats(profile) ?? flexRankStats(profile) ?? ranked5v5Stats(profile) ?? profile.rankedStats : undefined;
  const topChampions = profile?.topChampions.slice(0, 5) ?? [];
  const isParty = communityPostCategory(post) === "party";
  const comments = post?.comments ?? [];

  async function submitComment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!post || !commentBody.trim() || commentSubmitting) return;
    await onSubmitComment(post.id, commentBody);
    setCommentBody("");
  }

  async function submitReport(): Promise<void> {
    if (!post || reportSubmitting) return;
    const submitted = await onSubmitReport(post.id, { reason: reportReason, detail: reportDetail.trim() || undefined });
    if (submitted) {
      setReportOpen(false);
      setReportDetail("");
      setReportReason("spam");
    }
  }

  return (
    <AppShell
      as="section"
      className="public-panel public-menu-page-panel public-community-detail-page public-community-shared-shell"
      mainId="public-community-detail-main"
      showSkipLink={false}
      sidebarMode="drawer"
      variant="public"
    >
      <AppShellHeader as="div" className="public-community-shared-header">
        <PageHeader as="div" layout="split">
          <PageHeaderEyebrow  >{t().community}</PageHeaderEyebrow>
          <PageHeaderTitle as="h2"  >
            {t().communityDetailTitle}
          </PageHeaderTitle>
          <PageHeaderDescription>
            {post ? `${post.authorDisplayName} · ${formatPublicDateTime(post.createdAt)}` : "YORO.gg"}
          </PageHeaderDescription>
          <PageHeaderStatus>
            <StatusPill tone={isParty ? "streamer" : "info"}>
              {isParty ? t().communityPartyRecruit : t().communityServerRecruit}
            </StatusPill>
          </PageHeaderStatus>
          <PageHeaderActions>
            {post && twitchStatus.user?.id !== post.authorTwitchUserId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => twitchStatus.connected ? setReportOpen(true) : onLogin()}


              >
                {t().communityReport}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={onBack}  >
              {t().communityBackToList}
            </Button>
          </PageHeaderActions>
        </PageHeader>
      </AppShellHeader>

      <AppShellSidebar as="nav" className="public-community-shared-sidebar">
        <Navigation aria-label={t().communityDetailTitle} variant="public">
          <NavigationSection title={t().community}>
            <NavigationItem active as="button" badge={<NavigationBadge>{isParty ? t().communityPartyRecruit : t().communityServerRecruit}</NavigationBadge>}>
              {t().communityDetailTitle}
            </NavigationItem>
            <NavigationItem as="button" disabled badge={<NavigationBadge>{comments.length}</NavigationBadge>}>
              {t().communityCommentsTitle}
            </NavigationItem>
          </NavigationSection>
        </Navigation>
      </AppShellSidebar>

      <AppShellMain as="div" className="public-community-shared-main" id="public-community-detail-main">
      {!post ? (
        <EmptyState variant="community" as="div">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle as="h3"  >
            {t().communityEmpty}
          </EmptyStateTitle>
          <EmptyStateActions>
            <Button type="button" variant="secondary" onClick={onBack}>{t().communityBackToList}</Button>
          </EmptyStateActions>
        </EmptyState>
      ) : (
        <div className="public-community-detail-layout public-community-shared-detail-layout">
          {riotId ? (
            <Card as="aside" className="public-community-record-strip public-community-shared-record-card" padding="lg" variant="glass">
              <CardHeader className="public-community-shared-record-head">
                <div>
                  <CardTitle as="h3"  >
                    {t().communityRecordPreview}
                  </CardTitle>
                  <CardDescription>{riotId}</CardDescription>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => onSearchRiotId(riotId)}  >
                  {t().viewRecord}
                </Button>
              </CardHeader>
              <CardContent>
              {profileState.status === "loading" ? (
                <SkeletonCard loadingLabel={t().communityRecordLoading} />
              ) : profileState.status === "error" ? (
                <EmptyState variant="error" as="div">
                  <EmptyStateIcon>!</EmptyStateIcon>
                  <EmptyStateTitle as="h3">{t().communityRecordFailed}</EmptyStateTitle>
                  <EmptyStateDescription>{profileState.error || t().communityRecordFailed}</EmptyStateDescription>
                </EmptyState>
              ) : profile ? (
                <div className="public-community-record-inline">
                  <div className="public-community-record-main">
                    {profile.profileIconUrl ? <img src={assetUrl(profile.profileIconUrl)} alt="" /> : <span>{profile.gameName.slice(0, 1).toUpperCase()}</span>}
                    <div>
                      <strong>{profile.gameName}<small>#{profile.tagLine}</small></strong>
                      <em>{rankLabel(primaryRank)}</em>
                    </div>
                  </div>
                  <div className="public-community-record-stats compact public-community-shared-card-metrics">
                    <Metric
                      label={t().recentGames}
                      value={`${profile.summary.recentWins}${activePublicLocale === "ja" ? "勝" : "승"} ${Math.max(0, profile.summary.recentGames - profile.summary.recentWins)}${activePublicLocale === "ja" ? "敗" : "패"}`}
                      description={formatPercent(profile.summary.recentWinRate)}
                      tone={profile.summary.recentWinRate >= 55 ? "success" : profile.summary.recentWinRate >= 45 ? "neutral" : "warning"}
                      size="sm"
                    />
                    <Metric
                      label={t().kda}
                      value={formatDecimal(profile.summary.averageKda)}
                      description={`${profile.summary.totalKills} / ${profile.summary.totalDeaths} / ${profile.summary.totalAssists}`}
                      tone={(profile.summary.averageKda ?? 0) >= 3 ? "success" : (profile.summary.averageKda ?? 0) >= 2 ? "neutral" : "warning"}
                      size="sm"
                    />
                  </div>
                  <div className="public-community-record-champions">
                    {topChampions.length > 0 ? topChampions.map((champion) => (
                      champion.iconUrl ? <img src={assetUrl(champion.iconUrl)} alt={championName(champion)} title={championName(champion)} key={champion.championId} /> : null
                    )) : <small>{t().noData}</small>}
                  </div>
                </div>
              ) : (
                <EmptyState variant="search" as="div">
                  <EmptyStateIcon>?</EmptyStateIcon>
                  <EmptyStateTitle as="h3">{t().noData}</EmptyStateTitle>
                </EmptyState>
              )}
              </CardContent>
            </Card>
          ) : null}
          <Card as="article" className="public-community-detail-article public-community-shared-detail-article" padding="lg" variant="glass">
            <CardHeader className="public-community-shared-detail-head">
              <span className="public-community-avatar">
                {post.authorProfileImageUrl ? <img src={post.authorProfileImageUrl} alt="" /> : <em>{post.authorDisplayName.slice(0, 1).toUpperCase()}</em>}
              </span>
              <div>
                <CardTitle as="h3">{post.title}</CardTitle>
                <CardDescription>
                  {post.authorDisplayName} · @{post.authorTwitchLogin}{post.authorRiotGameName && post.authorRiotTagLine ? ` · ${post.authorRiotGameName}#${post.authorRiotTagLine}` : ""}
                </CardDescription>
              </div>
              <StatusPill size="sm" tone={isParty ? "streamer" : "info"}>
                {isParty ? t().communityPartyRecruit : t().communityServerRecruit}
              </StatusPill>
            </CardHeader>
            <CardContent className="public-community-shared-detail-content">
            <p>{post.body}</p>
            {post.imageUrl ? (
              <div className="public-community-detail-media">
                <img src={assetUrl(post.imageUrl)} alt={post.imageAlt ?? ""} />
              </div>
            ) : null}
            <div className="public-community-post-meta">
              {riotId ? <Badge tone="info">{t().communityRecordLabel} {riotId}</Badge> : null}
              {post.tags.map((tag) => <Badge tone="neutral" key={`${post.id}:detail:${tag}`}>#{publicOptionLabel(PARTY_TAG_OPTIONS, tag)}</Badge>)}
            </div>
            <div className="public-community-shared-card-metrics">
              <Metric label={t().communityCommentsTitle} value={comments.length} tone="neutral" size="sm" />
              <Metric label={t().communityTagsLabel} value={post.tags.length} tone="success" size="sm" />
              {isParty ? (
                <Metric label={t().communityPartyCapacityLabel} value={post.partyCapacity ? `1 / ${post.partyCapacity}` : "-"} tone="streamer" size="sm" />
              ) : (
                <Metric label={t().communityRecordLabel} value={riotId ? "OK" : "-"} tone={riotId ? "info" : "neutral"} size="sm" />
              )}
            </div>
            {isParty ? (
              <Card as="section" className="public-community-comments public-community-shared-comments" padding="md" variant="default">
                <CardHeader className="public-community-comments-head">
                  <CardTitle as="h4"  >{t().communityCommentsTitle}</CardTitle>
                  <Badge tone="info">{comments.length}</Badge>
                </CardHeader>
                {comments.length > 0 ? (
                  <div className="public-community-comment-list">
                    {comments.map((comment) => (
                      <Card as="article" className="public-community-comment" padding="sm" variant="glass" key={comment.id}>
                        <span className="public-community-avatar">
                          {comment.authorProfileImageUrl ? <img src={comment.authorProfileImageUrl} alt="" /> : <em>{comment.authorDisplayName.slice(0, 1).toUpperCase()}</em>}
                        </span>
                        <div>
                          <header>
                            <strong>{comment.authorDisplayName}</strong>
                            <small>@{comment.authorTwitchLogin} · {formatRelativeDate(comment.createdAt)}</small>
                          </header>
                          <p>{comment.body}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <EmptyState variant="community" as="div">
                    <EmptyStateIcon>+</EmptyStateIcon>
                    <EmptyStateTitle as="h4"  >
                      {t().communityCommentEmpty}
                    </EmptyStateTitle>
                  </EmptyState>
                )}
                {commentError ? (
                  <EmptyState variant="error" as="div">
                    <EmptyStateIcon>!</EmptyStateIcon>
                    <EmptyStateTitle as="h4">{t().communityCommentFailed}</EmptyStateTitle>
                    <EmptyStateDescription>{commentError}</EmptyStateDescription>
                  </EmptyState>
                ) : null}
                {twitchStatus.connected ? (
                  <form className="public-community-comment-form public-community-shared-form" onSubmit={submitComment}>
                    <span className="public-community-avatar">
                      {twitchStatus.user?.profileImageUrl ? <img src={twitchStatus.user.profileImageUrl} alt="" /> : <em>{twitchStatus.user?.displayName?.slice(0, 1).toUpperCase() ?? "T"}</em>}
                    </span>
                    <FormField required>
                      <FormControl>
                        <Textarea
                          value={commentBody}
                          onChange={(event) => setCommentBody(event.currentTarget.value)}
                          maxLength={500}
                          rows={3}
                          placeholder={t().communityCommentPlaceholder}


                          required
                        />
                      </FormControl>
                    </FormField>
                    <Button type="submit" variant="primary" loading={commentSubmitting} disabled={!commentBody.trim() || commentSubmitting}>
                      {commentSubmitting ? t().communityCommentSubmitting : t().communityCommentSubmit}
                    </Button>
                  </form>
                ) : (
                  <EmptyState variant="community" as="div" className="public-community-login public-community-comment-login">
                    <EmptyStateIcon>TV</EmptyStateIcon>
                    <EmptyStateTitle as="h4"  >
                      {t().communityCommentLoginRequired}
                    </EmptyStateTitle>
                    <EmptyStateActions>
                      <Button type="button" variant="primary" onClick={onLogin}  >
                        {t().twitchViewerLogin}
                      </Button>
                    </EmptyStateActions>
                  </EmptyState>
                )}
              </Card>
            ) : null}
            </CardContent>
          </Card>
        </div>
      )}
      </AppShellMain>
      <Modal open={reportOpen} loading={reportSubmitting} onClose={() => setReportOpen(false)} size="sm">
        <ModalHeader>
          <ModalTitle>{t().communityReportTitle}</ModalTitle>
          <ModalCloseButton aria-label={t().participationClose} onClick={() => setReportOpen(false)}>×</ModalCloseButton>
        </ModalHeader>
        <ModalContent>
          <ModalDescription>{t().communityReportDescription}</ModalDescription>
          {reportError ? <FormError>{reportError}</FormError> : null}
          <FormField required>
            <FormLabel>{t().communityReportReason}</FormLabel>
            <FormControl>
              <Select value={reportReason} onChange={(event) => setReportReason(event.currentTarget.value as CommunityPostReportCreateInput["reason"])}>
                <option value="spam">{t().communityReportSpam}</option>
                <option value="harassment">{t().communityReportHarassment}</option>
                <option value="privacy">{t().communityReportPrivacy}</option>
                <option value="other">{t().communityReportOther}</option>
              </Select>
            </FormControl>
          </FormField>
          <FormField>
            <FormLabel>{t().communityReportDetail}</FormLabel>
            <FormControl>
              <Textarea
                value={reportDetail}
                onChange={(event) => setReportDetail(event.currentTarget.value)}
                maxLength={500}
                rows={4}
                placeholder={t().communityReportDetailPlaceholder}
              />
            </FormControl>
          </FormField>
        </ModalContent>
        <ModalFooter>
          <Button type="button" variant="secondary" disabled={reportSubmitting} onClick={() => setReportOpen(false)}>{t().participationClose}</Button>
          <Button type="button" variant="danger" loading={reportSubmitting} onClick={() => void submitReport()}>
            {reportSubmitting ? t().communityReportSubmitting : t().communityReportSubmit}
          </Button>
        </ModalFooter>
      </Modal>
      <CommunityToastLayer toast={toast} onDismiss={onDismissToast} />
    </AppShell>
  );
}

function formatPublicDateTime(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(activePublicLocale === "ja" ? "ja-JP" : "ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

const PUBLIC_PRIVACY_SECTIONS: Array<{ title: PublicTextKey; body: PublicTextKey }> = [
  { title: "privacyCollectedTitle", body: "privacyCollectedBody" },
  { title: "privacyCollectionMethodTitle", body: "privacyCollectionMethodBody" },
  { title: "privacyPurposeTitle", body: "privacyPurposeBody" },
  { title: "privacyLegalBasisTitle", body: "privacyLegalBasisBody" },
  { title: "privacyRetentionTitle", body: "privacyRetentionBody" },
  { title: "privacyDeletionTitle", body: "privacyDeletionBody" },
  { title: "privacyThirdPartyTitle", body: "privacyThirdPartyBody" },
  { title: "privacyProcessorsTitle", body: "privacyProcessorsBody" },
  { title: "privacyCookiesTitle", body: "privacyCookiesBody" },
  { title: "privacyRightsTitle", body: "privacyRightsBody" },
  { title: "privacyChildrenTitle", body: "privacyChildrenBody" },
  { title: "privacySecurityTitle", body: "privacySecurityBody" },
  { title: "privacyAutomatedDecisionTitle", body: "privacyAutomatedDecisionBody" },
  { title: "privacyIncidentTitle", body: "privacyIncidentBody" },
  { title: "privacyChangesTitle", body: "privacyChangesBody" }
];

const PUBLIC_TERMS_SECTIONS: Array<{ title: PublicTextKey; body: PublicTextKey }> = [
  { title: "termsAcceptanceTitle", body: "termsAcceptanceBody" },
  { title: "termsEligibilityTitle", body: "termsEligibilityBody" },
  { title: "termsAccountTitle", body: "termsAccountBody" },
  { title: "termsServiceTitle", body: "termsServiceBody" },
  { title: "termsUserContentTitle", body: "termsUserContentBody" },
  { title: "termsProhibitedTitle", body: "termsProhibitedBody" },
  { title: "termsParticipationTitle", body: "termsParticipationBody" },
  { title: "termsDataTitle", body: "termsDataBody" },
  { title: "termsIntellectualPropertyTitle", body: "termsIntellectualPropertyBody" },
  { title: "termsSuspensionTitle", body: "termsSuspensionBody" },
  { title: "termsLiabilityTitle", body: "termsLiabilityBody" },
  { title: "termsChangesTitle", body: "termsChangesBody" },
  { title: "termsGoverningLawTitle", body: "termsGoverningLawBody" },
  { title: "termsContactTitle", body: "termsContactBody" }
];

function PublicLegalText({ textKey, as = "p" }: { textKey: PublicTextKey; as?: "p" | "span" | "strong" | "h1" | "h2" }) {
  const props = { "data-ko": publicKoText(textKey), "data-ja": publicJaText(textKey) };
  const content = publicText(textKey);
  if (as === "h1") return <h1 {...props}>{content}</h1>;
  if (as === "h2") return <h2 {...props}>{content}</h2>;
  if (as === "span") return <span {...props}>{content}</span>;
  if (as === "strong") return <strong {...props}>{content}</strong>;
  return <p {...props}>{content}</p>;
}

function publicLegalRuntimeValue(valueKo: string, valueJa = valueKo): { ko: string; ja: string; current: string } {
  const ko = valueKo.trim() || publicI18n.ko.legalNotConfigured;
  const ja = valueJa.trim() || publicI18n.ja.legalNotConfigured;
  return { ko, ja, current: activePublicLocale === "ja" ? ja : ko };
}

function PublicLegalRuntimeLine({
  labelKey,
  valueKo,
  valueJa
}: {
  labelKey: PublicTextKey;
  valueKo: string;
  valueJa?: string;
}) {
  const value = publicLegalRuntimeValue(valueKo, valueJa);
  return (
    <div className="public-legal-runtime-row">
      <PublicLegalText textKey={labelKey} as="strong" />
      <span  >{value.current}</span>
    </div>
  );
}

function PublicLegalRuntimeDetails({ page }: { page: Exclude<PublicLegalPageKey, "contact"> }) {
  const minimumAgeKo = `만 ${PUBLIC_LEGAL_CONFIG.minimumAge}세 이상`;
  const minimumAgeJa = `${PUBLIC_LEGAL_CONFIG.minimumAge}歳以上`;
  const retentionKo = `${PUBLIC_LEGAL_CONFIG.supportMailboxRetentionDays}일`;
  const retentionJa = `${PUBLIC_LEGAL_CONFIG.supportMailboxRetentionDays}日`;

  return (
    <article className="public-legal-runtime-details">
      <PublicLegalText textKey="legalOperatorTitle" as="h2" />
      <div className="public-legal-runtime-grid">
        <PublicLegalRuntimeLine labelKey="legalOperatorNameLabel" valueKo={PUBLIC_LEGAL_CONFIG.operatorName} />
        <PublicLegalRuntimeLine labelKey="legalContactAddressLabel" valueKo={PUBLIC_LEGAL_CONFIG.contactAddress} />
        <PublicLegalRuntimeLine labelKey="legalPrivacyOfficerLabel" valueKo={PUBLIC_LEGAL_CONFIG.privacyOfficerName} />
        <PublicLegalRuntimeLine labelKey="legalContactEmailLabel" valueKo={PUBLIC_CONTACT_EMAIL} />
        {PUBLIC_LEGAL_CONFIG.contactPhone ? (
          <PublicLegalRuntimeLine labelKey="legalContactPhoneLabel" valueKo={PUBLIC_LEGAL_CONFIG.contactPhone} />
        ) : null}
        <PublicLegalRuntimeLine labelKey="legalMinimumAgeLabel" valueKo={minimumAgeKo} valueJa={minimumAgeJa} />
        <PublicLegalRuntimeLine labelKey="legalSupportRetentionLabel" valueKo={retentionKo} valueJa={retentionJa} />
        {page === "privacy" ? (
          <>
            <PublicLegalRuntimeLine labelKey="legalProcessorsLabel" valueKo={PUBLIC_LEGAL_CONFIG.processorsKo} valueJa={PUBLIC_LEGAL_CONFIG.processorsJa} />
            <PublicLegalRuntimeLine labelKey="legalCrossBorderLabel" valueKo={PUBLIC_LEGAL_CONFIG.crossBorderTransferKo} valueJa={PUBLIC_LEGAL_CONFIG.crossBorderTransferJa} />
          </>
        ) : (
          <>
            <PublicLegalRuntimeLine labelKey="legalGoverningLawLabel" valueKo={PUBLIC_LEGAL_CONFIG.governingLawKo} valueJa={PUBLIC_LEGAL_CONFIG.governingLawJa} />
            <PublicLegalRuntimeLine labelKey="legalDisputeVenueLabel" valueKo={PUBLIC_LEGAL_CONFIG.disputeVenueKo} valueJa={PUBLIC_LEGAL_CONFIG.disputeVenueJa} />
          </>
        )}
      </div>
    </article>
  );
}

function PublicLegalPage({ page }: { page: PublicLegalPageKey }) {
  const titleKey: PublicTextKey = page === "privacy" ? "privacyTitle" : page === "terms" ? "termsTitle" : "contactTitle";
  const introKey: PublicTextKey = page === "privacy" ? "privacyIntro" : page === "terms" ? "termsIntro" : "contactIntro";
  const sections = page === "privacy" ? PUBLIC_PRIVACY_SECTIONS : page === "terms" ? PUBLIC_TERMS_SECTIONS : [];
  const mailHref = `mailto:${PUBLIC_CONTACT_EMAIL}?subject=${encodeURIComponent(publicText("contactMailSubject"))}`;
  const effectiveDateKo = `${publicI18n.ko.legalEffectiveDate}: ${PUBLIC_LEGAL_CONFIG.effectiveDate || publicI18n.ko.legalNotConfigured}`;
  const effectiveDateJa = `${publicI18n.ja.legalEffectiveDate}: ${PUBLIC_LEGAL_CONFIG.effectiveDate || publicI18n.ja.legalNotConfigured}`;

  return (
    <section className="public-legal-page public-panel">
      <div className="public-legal-hero">
        <span className="public-section-kicker"  >{t().brand}</span>
        <PublicLegalText textKey={titleKey} as="h1" />
        <PublicLegalText textKey={introKey} />
        <span  >{activePublicLocale === "ja" ? effectiveDateJa : effectiveDateKo}</span>
      </div>

      {page === "contact" ? (
        <div className="public-contact-card">
          <PublicLegalText textKey="contactTemporaryNotice" />
          <div>
            <PublicLegalText textKey="contactEmailLabel" as="strong" />
            <a href={mailHref}>{PUBLIC_CONTACT_EMAIL}</a>
          </div>
          <a className="public-contact-mail-button" href={mailHref}  >
            {t().contactEmailButton}
          </a>
        </div>
      ) : (
        <div className="public-legal-sections">
          <aside className="public-legal-notice">
            <PublicLegalText textKey={PUBLIC_LEGAL_CONFIG.configured ? "legalOperationalNotice" : "legalDraftNotice"} />
          </aside>
          <PublicLegalRuntimeDetails page={page} />
          {sections.map((section) => (
            <article key={section.title}>
              <PublicLegalText textKey={section.title} as="h2" />
              <PublicLegalText textKey={section.body} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function publicSiteFooterText(): PublicSiteFooterText {
  return {
    privacy: {
      label: t().footerPrivacy,
      ko: publicI18n.ko.footerPrivacy,
      ja: publicI18n.ja.footerPrivacy,
    },
    terms: {
      label: t().footerTerms,
      ko: publicI18n.ko.footerTerms,
      ja: publicI18n.ja.footerTerms,
    },
    contact: {
      label: t().footerContact,
      ko: publicI18n.ko.footerContact,
      ja: publicI18n.ja.footerContact,
    },
    riotDisclaimer: {
      label: t().footerRiotDisclaimer,
      ko: publicI18n.ko.footerRiotDisclaimer,
      ja: publicI18n.ja.footerRiotDisclaimer,
    },
    copyright: {
      label: t().footerCopyright,
      ko: publicI18n.ko.footerCopyright,
      ja: publicI18n.ja.footerCopyright,
    },
  };
}

function PublicPremiumDialog({
  open,
  onClose,
  onOpenAdmin
}: {
  open: boolean;
  onClose: () => void;
  onOpenAdmin: () => void;
}) {
  return (
    <Modal className="public-premium-dialog" open={open} onClose={onClose} size="sm">
      <ModalHeader>
        <ModalTitle>{t().premiumNoticeTitle}</ModalTitle>
        <ModalCloseButton aria-label={t().clearSearch} onClick={onClose}>×</ModalCloseButton>
      </ModalHeader>
      <ModalContent>
        <ModalDescription>{t().premiumNoticeBody}</ModalDescription>
      </ModalContent>
      <ModalFooter>
        <Button type="button" onClick={onClose} size="md" variant="tertiary">{t().folded}</Button>
        <Button type="button" onClick={onOpenAdmin} size="md" variant="primary">{t().openStreamerLogin}</Button>
      </ModalFooter>
    </Modal>
  );
}

function RoleDistribution({ profile }: { profile: PublicLolProfile }) {
  const maxGames = Math.max(1, ...profile.rolePerformance.map((role) => role.games));
  return (
    <section className="public-panel public-role-distribution">
      <div className="public-section-head">
        <h2  >{t().roleDistribution}</h2>
        <span>{profile.summary.recentGames}{t().games}</span>
      </div>
      <div className="public-role-bars">
        {profile.rolePerformance.length === 0 ? <p className="public-empty">{t().noData}</p> : profile.rolePerformance.map((role) => (
          <article className="public-role-bar-row" key={role.role}>
            <span>{mainRoleLabel(role.role)}</span>
            <div className="public-role-track">
              <i className="win" style={{ width: barWidth(role.wins, maxGames) }} />
              <i className="loss" style={{ width: barWidth(Math.max(0, role.games - role.wins), maxGames) }} />
            </div>
            <strong>{role.games}{t().games}</strong>
            <small>{winLossText(role.wins, role.games)} · {formatPercent(role.winRate)}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function RecentRecords({ profile }: { profile: PublicLolProfile }) {
  return (
    <section className="public-panel public-record-panel">
      <div className="public-section-head">
        <h2  >{t().recentRecords}</h2>
        <span>{profile.summary.recentGames}{t().games}</span>
      </div>
      <div className="public-record-list">
        {recentRecords(profile).map((record) => (
          <article className="public-record-card" key={record.title}>
            {record.champion?.splashUrl ? <img src={record.champion.splashUrl} alt="" /> : null}
            <div>
              <span>{record.title}</span>
              <strong>{recordValue(record)}</strong>
              <small>{record.unit} · {record.match ? championName(record.match.champion) : t().noData}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function dataDragonVersionFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.match(/\/cdn\/([^/]+)\//)?.[1];
}

function recentMatchDataDragonVersion(match: PublicLolRecentMatch): string | undefined {
  return dataDragonVersionFromUrl(match.champion.iconUrl) ?? match.items.map((item) => dataDragonVersionFromUrl(item.iconUrl)).find(Boolean);
}

function profileDataDragonVersion(profile: PublicLolProfile): string | undefined {
  return dataDragonVersionFromUrl(profile.profileIconUrl) ??
    profile.topChampions.map((champion) => dataDragonVersionFromUrl(champion.iconUrl)).find(Boolean) ??
    profile.recentMatches.map((match) => recentMatchDataDragonVersion(match)).find(Boolean);
}

function summonerSpellIconUrl(spellId: number, version?: string): string | undefined {
  const spellFile = SUMMONER_SPELL_FILE_BY_ID[spellId];
  return spellFile && version ? `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${spellFile}.png` : undefined;
}

function fixedRecentItemSlots(items: PublicLolRecentMatch["items"], count = 7): Array<PublicLolRecentMatch["items"][number] | undefined> {
  const slots = Array<PublicLolRecentMatch["items"][number] | undefined>(count).fill(undefined);
  items.forEach((item, index) => {
    const slot = item.slot >= 0 && item.slot < count ? item.slot : index;
    if (slot >= 0 && slot < count && !slots[slot]) slots[slot] = item;
  });
  return slots;
}

function buildParticipantKey(participant: Pick<PublicLolMatchBuildParticipant, "participantId" | "riotId" | "champion">): string {
  return participant.participantId !== undefined
    ? `participant:${participant.participantId}`
    : `${participant.riotId ?? "unknown"}:${participant.champion.championId}`;
}

function defaultBuildParticipantKey(
  match: PublicLolRecentMatch,
  build: PublicLolMatchBuildResponse | undefined,
  targetRiotId?: string
): string | undefined {
  const target = match.teams.flatMap((team) => team.players).find((player) => player.isTarget);
  if (target?.participantId !== undefined) return `participant:${target.participantId}`;
  const normalizedTargetRiotId = normalizeRiotId(target?.riotId ?? targetRiotId ?? "");
  const targetBuild = build?.participants.find((participant) => (
    participant.riotId && normalizedTargetRiotId && normalizeRiotId(participant.riotId) === normalizedTargetRiotId
  ));
  return targetBuild ? buildParticipantKey(targetBuild) : build?.participants[0] ? buildParticipantKey(build.participants[0]) : undefined;
}

function abilityName(skill: PublicLolMatchBuildSkillEvent): string {
  if (activePublicLocale === "ja") return skill.nameJa ?? skill.nameKo ?? skill.key;
  return skill.nameKo ?? skill.nameJa ?? skill.key;
}

type PublicRuneCatalogRune = {
  id: number;
  key?: string;
  icon?: string;
  name?: string;
};

type PublicRuneCatalogSlot = {
  runes?: PublicRuneCatalogRune[];
};

type PublicRuneCatalogStyle = {
  id: number;
  key?: string;
  icon?: string;
  name?: string;
  slots?: PublicRuneCatalogSlot[];
};

type PublicStatShardOption = {
  runeId: number;
  matchRuneIds?: number[];
  category: "offense" | "flex" | "defense";
  nameKo: string;
  nameJa: string;
  iconUrl: string;
};

const RUNE_CATALOG_CACHE = new Map<string, Promise<PublicRuneCatalogStyle[]>>();

const STAT_SHARD_OPTIONS: PublicStatShardOption[] = [
  {
    runeId: 5008,
    category: "offense",
    nameKo: "적응형 능력치",
    nameJa: "アダプティブフォース",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAdaptiveForceIcon.png"
  },
  {
    runeId: 5005,
    category: "offense",
    nameKo: "공격 속도",
    nameJa: "攻撃速度",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAttackSpeedIcon.png"
  },
  {
    runeId: 5007,
    category: "offense",
    nameKo: "스킬 가속",
    nameJa: "スキルヘイスト",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsCDRScalingIcon.png"
  },
  {
    runeId: 5008,
    category: "flex",
    nameKo: "적응형 능력치",
    nameJa: "アダプティブフォース",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsAdaptiveForceIcon.png"
  },
  {
    runeId: 5002,
    category: "flex",
    nameKo: "방어력",
    nameJa: "物理防御",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsArmorIcon.png"
  },
  {
    runeId: 5003,
    category: "flex",
    nameKo: "마법 저항력",
    nameJa: "魔法防御",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsMagicResIcon.png"
  },
  {
    runeId: 5001,
    matchRuneIds: [5001, 5011],
    category: "defense",
    nameKo: "체력",
    nameJa: "体力",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsHealthScalingIcon.png"
  },
  {
    runeId: 5002,
    category: "defense",
    nameKo: "방어력",
    nameJa: "物理防御",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsArmorIcon.png"
  },
  {
    runeId: 5003,
    category: "defense",
    nameKo: "마법 저항력",
    nameJa: "魔法防御",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/StatModsMagicResIcon.png"
  }
];

function dataDragonRuneAssetUrl(path: string | undefined): string | undefined {
  return path ? `https://ddragon.leagueoflegends.com/cdn/img/${path}` : undefined;
}

function loadRuneCatalog(version: string, locale: PublicLocale): Promise<PublicRuneCatalogStyle[]> {
  const language = locale === "ja" ? "ja_JP" : "ko_KR";
  const cacheKey = `${version}:${language}`;
  const cached = RUNE_CATALOG_CACHE.get(cacheKey);
  if (cached) return cached;
  const request = fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/${language}/runesReforged.json`)
    .then((response) => response.ok ? response.json() : [])
    .then((data) => Array.isArray(data) ? data as PublicRuneCatalogStyle[] : [])
    .catch(() => []);
  RUNE_CATALOG_CACHE.set(cacheKey, request);
  return request;
}

function useRuneCatalog(version: string | undefined): PublicRuneCatalogStyle[] | undefined {
  const locale = activePublicLocale;
  const [catalog, setCatalog] = useState<PublicRuneCatalogStyle[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!version) {
      setCatalog(undefined);
      return () => {
        cancelled = true;
      };
    }
    setCatalog(undefined);
    loadRuneCatalog(version, locale).then((runes) => {
      if (!cancelled) setCatalog(runes.length > 0 ? runes : undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [version, locale]);

  return catalog;
}

function findRuneStyle(
  catalog: PublicRuneCatalogStyle[] | undefined,
  runes: PublicLolMatchParticipant["runes"],
  kind: "primary" | "secondary"
): PublicRuneCatalogStyle | undefined {
  const styleRune = runes.find((rune) => rune.kind === kind && rune.category === "style");
  if (styleRune) {
    const matchedStyle = catalog?.find((style) => style.id === styleRune.runeId);
    if (matchedStyle) return matchedStyle;
  }
  const selectedIds = new Set(runes.filter((rune) => rune.kind === kind && rune.category !== "style").map((rune) => rune.runeId));
  return catalog?.find((style) => style.slots?.some((slot) => slot.runes?.some((rune) => selectedIds.has(rune.id))));
}

function runeTreeColumnViewModel(
  kind: "primary" | "secondary",
  runes: PublicLolMatchParticipant["runes"],
  catalog: PublicRuneCatalogStyle[] | undefined
): RecentMatchBuildRuneColumn {
  const style = findRuneStyle(catalog, runes, kind);
  const styleRune = runes.find((rune) => rune.kind === kind && rune.category === "style");
  const selectedIds = new Set(runes.filter((rune) => rune.kind === kind && rune.category !== "style").map((rune) => rune.runeId));
  const fallbackRunes = runes.filter((rune) => rune.kind === kind && rune.category !== "style");
  const runeSlots = style?.slots?.length
    ? kind === "secondary"
      ? style.slots.slice(1)
      : style.slots
    : [];
  const title = style?.name ?? runeName(styleRune) ?? (kind === "primary" ? (activePublicLocale === "ja" ? "メインルーン" : "주 룬") : (activePublicLocale === "ja" ? "サブルーン" : "부 룬"));
  const styleIcon = dataDragonRuneAssetUrl(style?.icon) ?? styleRune?.iconUrl;

  const rows: RecentMatchBuildRuneRow[] = runeSlots.length ? runeSlots.map((slot, slotIndex) => ({
    key: `${kind}:slot:${slotIndex}`,
    className: "public-match-rune-row",
    slots: (slot.runes ?? []).map((rune): RecentMatchBuildRuneSlot => {
      const selected = selectedIds.has(rune.id);
      return {
        key: `${kind}:rune:${rune.id}`,
        className: selected ? "selected" : "",
        title: rune.name ?? `Rune ${rune.id}`,
        iconUrl: dataDragonRuneAssetUrl(rune.icon),
        fallbackLabel: String(rune.id)
      };
    })
  })) : [{
    key: `${kind}:fallback`,
    className: "public-match-rune-row fallback",
    slots: fallbackRunes.map((rune): RecentMatchBuildRuneSlot => ({
      key: `${kind}:fallback:${rune.runeId}`,
      className: "selected",
      title: runeName(rune),
      iconUrl: rune.iconUrl,
      fallbackLabel: String(rune.runeId)
    }))
  }];

  return {
    key: `rune-column:${kind}`,
    className: `public-match-rune-column ${kind}`,
    titleClassName: "public-match-rune-title",
    title,
    titleIcon: {
      className: `public-match-rune-style ${styleIcon ? "selected" : ""}`,
      title,
      iconUrl: styleIcon,
      fallbackLabel: title.slice(0, 1)
    },
    rows
  };
}

function runeShardColumnViewModel(runes: PublicLolMatchParticipant["runes"]): RecentMatchBuildRuneColumn {
  const selectedByCategory = new Map(
    runes
      .filter((rune) => rune.kind === "stat")
      .map((rune) => [rune.category, rune])
  );
  const categories: Array<PublicStatShardOption["category"]> = ["offense", "flex", "defense"];
  const shardTitle = activePublicLocale === "ja" ? "ステータスシャード" : "능력치 파편";
  return {
    key: "rune-column:shards",
    className: "public-match-rune-column shards",
    titleClassName: "public-match-rune-title text-only",
    title: shardTitle,
    rows: categories.map((category) => {
      const selected = selectedByCategory.get(category);
      return {
        key: `shard:${category}`,
        className: "public-match-rune-row shard-row",
        slots: STAT_SHARD_OPTIONS.filter((option) => option.category === category).map((option): RecentMatchBuildRuneSlot => {
          const active = selected ? [option.runeId, ...(option.matchRuneIds ?? [])].includes(selected.runeId) : false;
          const label = activePublicLocale === "ja" ? option.nameJa : option.nameKo;
          return {
            key: `${category}:${option.runeId}`,
            className: active ? "selected" : "",
            title: label,
            iconUrl: option.iconUrl,
            fallbackLabel: String(option.runeId)
          };
        })
      };
    })
  };
}

function matchRuneBoardViewModel(
  runes: PublicLolMatchParticipant["runes"],
  catalog: PublicRuneCatalogStyle[] | undefined
): RecentMatchBuildRuneColumn[] {
  if (runes.length === 0) return [];
  return [
    runeTreeColumnViewModel("primary", runes, catalog),
    runeTreeColumnViewModel("secondary", runes, catalog),
    runeShardColumnViewModel(runes)
  ];
}

function buildPanelBadgeViewModels(badges: PublicLolMatchBadge[] | undefined): RecentMatchBuildBadge[] {
  const allBadges = badges ?? [];
  const orderedBadges = allBadges;
  const maxVisibleBadges = 4;
  const visibleBadges = orderedBadges.slice(0, maxVisibleBadges);
  const overflowCount = Math.max(0, orderedBadges.length - visibleBadges.length);
  const badgeViewModels: RecentMatchBuildBadge[] = visibleBadges.map((badge) => ({
    key: `${badge.code}:${badge.score ?? ""}:${badge.rank ?? ""}`,
    className: `public-match-badge ${badge.code}`,
    label: matchBadgeLabel(badge.code),
    ko: matchBadgeLabel(badge.code, "ko"),
    ja: matchBadgeLabel(badge.code, "ja")
  }));
  if (overflowCount > 0) {
    badgeViewModels.push({
      key: `more:${overflowCount}`,
      className: "public-match-badge more",
      label: "...",
      ariaLabel: `${overflowCount} more`
    });
  }
  return badgeViewModels;
}

function recentMatchBuildViewModel({
  match,
  build,
  loading,
  error,
  selectedKey,
  hideRiotIds,
  runeCatalog
}: {
  match: PublicLolRecentMatch;
  build: PublicLolMatchBuildResponse | undefined;
  loading: boolean;
  error: string;
  selectedKey: string | undefined;
  hideRiotIds: boolean;
  runeCatalog: PublicRuneCatalogStyle[] | undefined;
}): RecentMatchBuildViewModel {
  if (loading && !build) return { state: "loading", message: t().buildLoading };
  if (error && !build) return { state: "error", message: error };
  const participants = build?.participants ?? [];
  const activeKey = selectedKey ?? defaultBuildParticipantKey(match, build);
  const selectedParticipant = participants.find((participant) => buildParticipantKey(participant) === activeKey) ?? participants[0];
  if (!selectedParticipant) return { state: "empty", message: t().noData };
  const selectedParticipantKey = buildParticipantKey(selectedParticipant);
  const selectedItems = selectedParticipant.items ?? [];
  const selectedItemEvents = selectedParticipant.itemEvents ?? [];
  const selectedSkillOrder = selectedParticipant.skillOrder ?? [];
  const selectedRunes = selectedParticipant.runes ?? [];
  const itemEvents = selectedItemEvents.length > 0
    ? selectedItemEvents
    : fixedRecentItemSlots(selectedItems, 7)
      .filter((item): item is PublicLolMatchBuildParticipant["items"][number] => Boolean(item))
      .map((item) => ({ itemId: item.itemId, iconUrl: item.iconUrl, timestampMs: Number.NaN }));
  const visibleSkillIcons = [...new Map(selectedSkillOrder.map((skill) => [skill.key, skill])).values()].slice(0, 4);
  const selectedParticipantLabel = selectedParticipant.riotId ?? championName(selectedParticipant.champion);
  return {
    state: "ready",
    ariaLabel: t().matchBuildTab,
    championAriaLabel: t().champion,
    itemsLabel: {
      label: t().items,
      ko: publicI18n.ko.items,
      ja: publicI18n.ja.items
    },
    skillBuildLabel: {
      label: activePublicLocale === "ja" ? "スキルビルド" : "스킬 빌드",
      ko: publicI18n.ko.matchBuildTab,
      ja: publicI18n.ja.matchBuildTab
    },
    runesLabel: {
      label: t().runes,
      ko: publicI18n.ko.runes,
      ja: publicI18n.ja.runes
    },
    skillOrderLabel: activePublicLocale === "ja" ? "スキル順" : "스킬 순서",
    noDataLabel: t().noData,
    participants: participants.map((participant) => {
      const key = buildParticipantKey(participant);
      const participantLabel = participant.riotId ?? championName(participant.champion);
      return {
        key,
        active: key === selectedParticipantKey,
        title: hideRiotIds ? maskedRiotIdName(participant.riotId, participantLabel) : participantLabel,
        championIconUrl: participant.champion.iconUrl,
        championFallback: championName(participant.champion).slice(0, 1),
        score: participant.score,
        scoreClassName: metricToneClass(scoreTone(participant.score))
      };
    }),
    itemSlots: itemEvents.slice(0, 24).map((item, index) => ({
      key: `${match.matchId}:build-event:${selectedParticipant.participantId ?? selectedParticipant.riotId}:${index}:${item.itemId}`,
      iconUrl: item.iconUrl,
      label: String(item.itemId),
      minuteLabel: formatBuildMinute(item.timestampMs)
    })),
    skillIcons: visibleSkillIcons.map((skill) => ({
      key: `${selectedParticipant.participantId}:skill-icon:${skill.key}`,
      title: abilityName(skill),
      iconUrl: skill.iconUrl,
      fallbackLabel: skill.key,
      skillKey: skill.key
    })),
    skillRows: (["Q", "W", "E", "R"] as const).map((key) => ({
      key,
      cells: Array.from({ length: 18 }).map((_, index) => {
        const level = index + 1;
        const skill = selectedSkillOrder.find((item) => item.level === level && item.key === key);
        return {
          key: `${selectedParticipant.participantId}:skill-level:${key}:${level}`,
          className: skill ? key.toLowerCase() : "",
          title: skill ? `${level} · ${abilityName(skill)}` : `${level}`,
          label: skill ? String(level) : ""
        };
      })
    })),
    runeColumns: matchRuneBoardViewModel(selectedRunes, runeCatalog),
    summary: {
      participantLabel: hideRiotIds ? maskedRiotIdName(selectedParticipant.riotId, selectedParticipantLabel) : selectedParticipantLabel,
      championLabel: championName(selectedParticipant.champion),
      scoreLabel: t().aiScore,
      badges: buildPanelBadgeViewModels(selectedParticipant.badges),
      metrics: {
        score: selectedParticipant.score
      }
    }
  };
}

function RecentMatchBuildPanel({
  match,
  build,
  loading,
  error,
  selectedKey,
  hideRiotIds,
  onSelect
}: {
  match: PublicLolRecentMatch;
  build: PublicLolMatchBuildResponse | undefined;
  loading: boolean;
  error: string;
  selectedKey: string | undefined;
  hideRiotIds: boolean;
  onSelect: (key: string) => void;
}) {
  const dataDragonVersion = build?.dataDragonVersion ?? recentMatchDataDragonVersion(match);
  const runeCatalog = useRuneCatalog(dataDragonVersion);
  const viewModel = recentMatchBuildViewModel({
    match,
    build,
    loading,
    error,
    selectedKey,
    hideRiotIds,
    runeCatalog
  });
  return <FeatureRecentMatchBuildPanel viewModel={viewModel} onSelectParticipant={onSelect} />;
}

function fixedTeamItemSlots(items: PublicLolMatchParticipant["items"]): Array<PublicLolMatchParticipant["items"][number] | undefined> {
  const slots = Array<PublicLolMatchParticipant["items"][number] | undefined>(7).fill(undefined);
  items.forEach((item, index) => {
    const slot = item.slot >= 0 && item.slot < slots.length ? item.slot : index;
    if (slot >= 0 && slot < slots.length && !slots[slot] && item.itemId > 0) slots[slot] = item;
  });
  return [0, 1, 2, 6, 3, 4, 5].map((slot) => slots[slot]);
}

function playerItemBuildSlotsViewModel(
  items: PublicLolMatchParticipant["items"],
  itemKey: string
): PlayerItemBuildSlotViewModel[] {
  const itemSlots = fixedTeamItemSlots(items);
  return itemSlots.map((item, index) => {
    if (!item) {
      return {
        key: `${itemKey}:${index}:empty`,
        className: "public-team-item-empty",
        ariaHidden: true
      };
    }
    return {
      key: `${itemKey}:${index}:${item.slot}:${item.itemId}`,
      className: "public-team-item-slot",
      iconUrl: item.iconUrl,
      fallbackLabel: String(item.itemId)
    };
  });
}

function playerItemBuildViewModel({
  items,
  itemKey
}: {
  items: PublicLolMatchParticipant["items"];
  itemKey: string;
}): PlayerItemBuildViewModel {
  return {
    ariaLabel: t().items,
    slots: playerItemBuildSlotsViewModel(items, itemKey)
  };
}

function PlayerItemBuild({ items, itemKey }: { items: PublicLolMatchParticipant["items"]; itemKey: string }) {
  const viewModel = playerItemBuildViewModel({ items, itemKey });
  return <FeaturePlayerItemBuild viewModel={viewModel} />;
}

function runeName(rune: PublicLolMatchParticipant["runes"][number] | undefined): string {
  if (!rune) return "-";
  if (activePublicLocale === "ja") return rune.nameJa ?? rune.nameKo ?? `Rune ${rune.runeId}`;
  return rune.nameKo ?? rune.nameJa ?? `Rune ${rune.runeId}`;
}

function playerSpellBuildSlotsViewModel(
  spells: number[] | undefined,
  dataDragonVersion: string | undefined
): PlayerLoadoutBuildSlotViewModel[] {
  const slots = [spells?.[0], spells?.[1]];
  return slots.map((spellId, index) => {
    if (!spellId) {
      return {
        key: `empty:${index}`,
        className: "public-team-spell-empty",
        ariaHidden: true
      };
    }
    return {
      key: `${spellId}:${index}`,
      className: "public-team-spell-slot",
      title: `Spell ${spellId}`,
      iconUrl: summonerSpellIconUrl(spellId, dataDragonVersion),
      fallbackLabel: String(spellId)
    };
  });
}

function playerRuneBuildSlotsViewModel(runes: PublicLolMatchParticipant["runes"] | undefined): PlayerLoadoutBuildSlotViewModel[] {
  const primary = runes?.find((rune) => rune.kind === "primary" && rune.category === "keystone") ??
    runes?.find((rune) => rune.kind === "primary" && rune.category !== "style") ??
    runes?.find((rune) => rune.kind === "primary") ??
    runes?.[0];
  const secondary = runes?.find((rune) => rune.kind === "secondary" && rune.category === "perk") ??
    runes?.find((rune) => rune.kind === "secondary" && rune.category !== "style") ??
    runes?.find((rune) => rune.kind === "secondary") ??
    runes?.find((rune) => rune !== primary);
  const slots = [primary, secondary];
  return slots.map((rune, index) => {
    if (!rune) {
      return {
        key: `empty:${index}`,
        className: "public-team-rune-empty",
        ariaHidden: true
      };
    }
    return {
      key: `${rune.runeId}:${rune.kind}:${rune.category ?? "unknown"}`,
      className: `public-team-rune-slot rune-${rune.kind}`,
      title: runeName(rune),
      iconUrl: rune.iconUrl,
      fallbackLabel: String(rune.runeId)
    };
  });
}

function playerLoadoutBuildViewModel({
  spells,
  runes,
  dataDragonVersion
}: {
  spells: number[] | undefined;
  runes: PublicLolMatchParticipant["runes"] | undefined;
  dataDragonVersion: string | undefined;
}): PlayerLoadoutBuildViewModel {
  return {
    ariaLabel: `${t().summonerSpells} / ${t().runes}`,
    spellsAriaLabel: t().summonerSpells,
    runesAriaLabel: t().runes,
    spellSlots: playerSpellBuildSlotsViewModel(spells, dataDragonVersion),
    runeSlots: playerRuneBuildSlotsViewModel(runes)
  };
}

function PlayerLoadoutBuild({
  spells,
  runes,
  dataDragonVersion
}: {
  spells: number[] | undefined;
  runes: PublicLolMatchParticipant["runes"] | undefined;
  dataDragonVersion: string | undefined;
}) {
  const viewModel = playerLoadoutBuildViewModel({ spells, runes, dataDragonVersion });
  return <FeaturePlayerLoadoutBuild viewModel={viewModel} />;
}

function riotIdAwardBadgeViewModels(badges?: PublicLolMatchBadge[]): SearchableRiotIdBadgeViewModel[] {
  const visibleBadges = matchHighlightBadges(badges);
  return visibleBadges.map((badge) => ({
    key: `${badge.code}:${badge.score ?? ""}:${badge.rank ?? ""}`,
    className: `public-riot-award-badge ${badge.code}`,
    label: matchBadgeLabel(badge.code),
    ko: matchBadgeLabel(badge.code, "ko"),
    ja: matchBadgeLabel(badge.code, "ja")
  }));
}

function teamCompareTeams(match: PublicLolRecentMatch): [PublicLolMatchTeamDetail, PublicLolMatchTeamDetail] | undefined {
  if (match.teams.length < 2) return undefined;
  const ally = match.teams.find((team) => team.players.some((player) => player.isTarget));
  const enemy = match.teams.find((team) => team !== ally);
  if (ally && enemy) return [enemy, ally];
  const fallbackLeft = match.teams[0];
  const fallbackRight = match.teams[1];
  if (!fallbackLeft || !fallbackRight) return undefined;
  return [fallbackLeft, fallbackRight];
}

function teamComparePercent(value: number, total: number): number {
  if (total <= 0) return 50;
  if (value <= 0) return 0;
  return Math.max(12, Math.min(88, (value / total) * 100));
}

function matchTeamCompareObjectivesViewModel(
  team: PublicLolMatchTeamDetail,
  side: "left" | "right"
): MatchTeamCompareTeamViewModel {
  return {
    side,
    label: teamLabel(team),
    resultSummary: `${resultLabel(team.result)} · ${team.kills}/${team.deaths}/${team.assists}`,
    objectivesAriaLabel: `${teamLabel(team)} ${t().objectives}`,
    objectives: teamCompareObjectiveKeys.map((key): MatchTeamCompareObjectiveViewModel => ({
      key: `${team.teamId}:${key}`,
      className: `public-team-compare-objective ${key}`,
      title: objectiveLabels[activePublicLocale][key] ?? key,
      shortLabel: objectiveShortLabels[activePublicLocale][key],
      value: team.objectives?.[key] ?? 0
    }))
  };
}

function matchTeamCompareMetricViewModel(
  key: string,
  label: string,
  leftValue: number,
  rightValue: number
): MatchTeamCompareMetricViewModel {
  const total = Math.max(0, leftValue) + Math.max(0, rightValue);
  const leftWidth = teamComparePercent(leftValue, total);
  const rightWidth = total <= 0 ? 50 : Math.max(0, 100 - leftWidth);
  return {
    key,
    label,
    leftValueLabel: formatNumber(leftValue),
    rightValueLabel: formatNumber(rightValue),
    leftWidth,
    rightWidth
  };
}

function matchTeamCompareViewModel(match: PublicLolRecentMatch): MatchTeamCompareViewModel | undefined {
  const teams = teamCompareTeams(match);
  if (!teams) return undefined;
  const [leftTeam, rightTeam] = teams;
  return {
    ariaLabel: t().teamDetails,
    tabsLabel: t().teamComparisonTabs,
    objectivesLabel: t().objectives,
    leftTeam: matchTeamCompareObjectivesViewModel(leftTeam, "left"),
    rightTeam: matchTeamCompareObjectivesViewModel(rightTeam, "right"),
    metrics: [
      matchTeamCompareMetricViewModel("damage", t().totalDamage, leftTeam.damageDealtToChampions, rightTeam.damageDealtToChampions),
      matchTeamCompareMetricViewModel(
        "vision",
        t().vision,
        leftTeam.players.reduce((sum, player) => sum + (player.visionScore ?? 0), 0),
        rightTeam.players.reduce((sum, player) => sum + (player.visionScore ?? 0), 0)
      ),
      matchTeamCompareMetricViewModel("gold", t().totalGold, leftTeam.goldEarned, rightTeam.goldEarned)
    ]
  };
}

function MatchTeamCompare({ match }: { match: PublicLolRecentMatch }) {
  const viewModel = matchTeamCompareViewModel(match);
  return viewModel ? <FeatureMatchTeamCompare viewModel={viewModel} /> : null;
}

function searchableRiotIdViewModel({
  riotId,
  fallback,
  badges,
  streamer
}: {
  riotId: string | undefined;
  fallback: string;
  badges?: PublicLolMatchBadge[];
  streamer?: PublicLolTwitchStream;
}): SearchableRiotIdViewModel {
  const display = splitRiotId(riotId, fallback);
  const visibleStreamer = visibleStreamerStream(streamer);
  const title = riotId
    ? visibleStreamer
      ? `${t().twitchStreamer} · ${visibleStreamer.isLive ? t().twitchOnlineShort : t().twitchOfflineShort} · ${riotId}`
      : `${t().search}: ${riotId}`
    : undefined;
  return {
    kind: riotId ? "button" : "static",
    className: `${riotId ? "public-riot-id-link" : "public-riot-id-static"} ${visibleStreamer ? "streamer" : ""}`,
    name: display.name,
    tag: display.tag,
    riotId,
    title,
    badges: riotIdAwardBadgeViewModels(badges)
  };
}

function SearchableRiotId(props: {
  riotId: string | undefined;
  fallback: string;
  badges?: PublicLolMatchBadge[];
  streamer?: PublicLolTwitchStream;
  onSearch: (riotId: string) => void;
}) {
  const viewModel = searchableRiotIdViewModel(props);
  return (
    <FeatureSearchableRiotId viewModel={viewModel} onSearch={props.onSearch} />
  );
}

function teamChampionAvatarViewModel(
  player: PublicLolMatchParticipant,
  hideStreamerStatus = false
): TeamChampionAvatarViewModel {
  const stream = hideStreamerStatus ? undefined : visibleStreamerStream(player.twitchStream);
  const streamLabel = stream ? (stream.isLive ? t().twitchOnlineShort : t().twitchOfflineShort) : "";
  const streamStatusLabel = stream ? `${stream.twitchDisplayName} · ${streamLabel}` : "";
  return {
    className: `public-team-champion-avatar ${stream ? "streamer" : ""} ${stream?.isLive ? "live" : stream ? "offline" : ""}`,
    championIconUrl: player.champion.iconUrl,
    fallbackLabel: championName(player.champion).slice(0, 1),
    streamBadge: stream ? {
      title: streamStatusLabel,
      ariaLabel: streamStatusLabel
    } : undefined
  };
}

function MatchTeamDetails({
  match,
  rankDetail,
  rankLoading,
  hideRiotIds,
  onSearchRiotId
}: {
  match: PublicLolRecentMatch;
  rankDetail?: PublicLolMatchRankResponse;
  rankLoading?: boolean;
  hideRiotIds: boolean;
  onSearchRiotId: (riotId: string) => void;
}) {
  if (match.teams.length === 0) return null;
  const maxDamage = matchTeamTotal(match, (player) => player.damageDealtToChampions);
  const maxCs = matchTeamTotal(match, (player) => player.cs);
  const maxVision = matchTeamTotal(match, (player) => player.visionScore);
  const dataDragonVersion = recentMatchDataDragonVersion(match);
  const teams: MatchTeamDetailsTeam[] = match.teams.map((team, teamIndex) => {
    const teamRankStats = team.players.map((player, index) => matchRankForPlayer(rankDetail, team.teamId, player, index));
    const tierSummary = rankLoading
      ? t().tierLoading
      : rankDetail
        ? `${t().averageTier} ${averageTierLabel(teamRankStats)}`
        : t().tierUnavailable;
    return {
      key: `${match.matchId}:${team.teamId}`,
      className: `public-team-card ${team.players.some((player) => player.isTarget) ? "ally" : "enemy"}`,
      label: teamLabel(team),
      resultSummary: `${resultLabel(team.result)} · ${team.kills}/${team.deaths}/${team.assists}`,
      summary: (
        <>
          {t().totalGold} {formatNumber(team.goldEarned)} · {t().totalDamage} {formatNumber(team.damageDealtToChampions)} · {t().totalKill} {formatNumber(team.kills)}
        </>
      ),
      tierSummary,
      players: team.players.map((player, index) => {
        const rankedStats = teamRankStats[index];
        const playerHighlightClass = matchHighlightClass(player.badges);
        const playerHighlightBadges = matchHighlightBadges(player.badges);
        const visibleStreamer = hideRiotIds ? undefined : visibleStreamerStream(player.twitchStream);
        const streamerBadgeTitle = visibleStreamer
          ? `${t().twitchStreamer} · ${visibleStreamer.isLive ? t().twitchOnlineShort : t().twitchOfflineShort}`
          : undefined;
        return {
          key: `${match.matchId}:${team.teamId}:${player.riotId ?? championName(player.champion)}`,
          className: `public-team-player ${player.isTarget ? "target" : ""} ${playerHighlightClass}`,
          championAvatar: teamChampionAvatarViewModel(player, hideRiotIds),
          loadout: <PlayerLoadoutBuild spells={player.summonerSpells} runes={player.runes} dataDragonVersion={dataDragonVersion} />,
          rank: {
            className: rankTierClass(rankedStats, rankLoading ? "loading" : rankedStats ? "ready" : "unknown"),
            title: rankLoading ? t().tierLoading : rankedStats ? rankLabel(rankedStats) : t().tierUnavailable,
            label: matchRankBadgeLabel(rankedStats, rankLoading)
          },
          streamerBadge: visibleStreamer && streamerBadgeTitle ? {
            title: streamerBadgeTitle,
          } : undefined,
          riotId: searchableRiotIdViewModel({
            riotId: hideRiotIds ? undefined : player.riotId,
            fallback: hideRiotIds ? maskedRiotIdName(player.riotId, playerDisplayName(player)) : playerDisplayName(player),
            badges: playerHighlightBadges,
            streamer: hideRiotIds ? undefined : player.twitchStream
          }),
          mobileKda: {
            score: `${player.kills}/${player.deaths}/${player.assists}`,
            metric: <KdaMetricText value={player.kda} />
          },
          itemBuild: <PlayerItemBuild items={player.items} itemKey={`${match.matchId}:${team.teamId}:${player.riotId ?? championName(player.champion)}`} />,
          kda: {
            score: `${player.kills}/${player.deaths}/${player.assists}`,
            metric: <KdaMetricText value={player.kda} />
          },
          stats: {
            damage: publicTeamMetricStatViewModel({
              value: player.damageDealtToChampions,
              total: maxDamage,
              tone: "damage",
              label: t().totalDamage,
              labelClassName: metricToneClass(teamShareTone(player.damageShare))
            }),
            cs: publicTeamMetricStatViewModel({
              value: player.cs,
              total: maxCs,
              tone: "cs",
              label: activePublicLocale === "ja" ? `CS · ${formatDecimal(player.csPerMinute, 1)}/分` : `CS · ${formatDecimal(player.csPerMinute, 1)}/분`,
              labelClassName: metricToneClass(csTone(player.csPerMinute))
            }),
            vision: publicTeamMetricStatViewModel({
              value: player.visionScore,
              total: maxVision,
              tone: "vision",
              label: `${t().vision} · ${activePublicLocale === "ja" ? `${formatDecimal(player.visionScorePerMinute, 2)}/分` : `${formatDecimal(player.visionScorePerMinute, 2)}/분`}`
            })
          }
        };
      }),
      compareAfter: teamIndex === 0 && match.teams.length > 1 ? <MatchTeamCompare match={match} /> : undefined
    };
  });

  return (
    <FeatureMatchTeamDetails ariaLabel={t().teamDetails} kdaLabel={t().kda} onSearchRiotId={onSearchRiotId} teams={teams} />
  );
}

function currentGameTeamLabel(teamId: number): string {
  if (teamId === 100) return t().blueTeam;
  if (teamId === 200) return t().redTeam;
  return `${t().teamDetails} ${teamId}`;
}

function currentGameQueueLabel(liveGame: PublicLolCurrentGame): string {
  return liveGame.queueId
    ? queueLabels[activePublicLocale][liveGame.queueId] ?? `${t().queue} ${liveGame.queueId}`
    : liveGame.gameMode ?? "-";
}

function IngamePanel({ profile, onSearchRiotId }: { profile: PublicLolProfile; onSearchRiotId: (riotId: string) => void }) {
  const liveGame = profile.liveGame;
  const isLive = liveGame?.isLive === true;
  const isChecking = liveGame?.status === "checking";
  const isUnavailable = liveGame?.status === "unavailable";
  const participants = liveGame?.participants ?? [];
  const teamIds = [...new Set(participants.map((participant) => participant.teamId))].sort((a, b) => a - b);
  const spellVersion = profileDataDragonVersion(profile);
  const averageTier = averageTierLabel(participants.map((participant) => participant.rankedStats));
  const expectedParticipants = Math.max(10, participants.length);
  return (
    <section id="public-ingame" className={`public-panel public-ingame-panel ${isLive ? "live" : isChecking ? "checking" : isUnavailable ? "unavailable" : "offline"}`} aria-busy={isChecking}>
      <div className="public-ingame-status-head">
        <div>
          <h2  >{t().currentGameStatus}</h2>
          <span className={`public-ingame-live-state ${isLive ? "live" : isChecking ? "checking" : isUnavailable ? "unavailable" : "offline"}`} role={isChecking ? "status" : undefined}>
            <i />
            {isLive ? t().currentlyInGame : isChecking ? t().currentGameChecking : isUnavailable ? t().currentGameUnavailable : t().notInGame}
          </span>
        </div>
        <small>{t().currentGameUpdated} {formatRelativeDate(liveGame?.fetchedAt)}</small>
      </div>
      {!isLive ? (
        <div className="public-ingame-empty">
          <strong  >
            {isChecking ? t().currentGameChecking : isUnavailable ? t().currentGameUnavailable : t().notInGame}
          </strong>
          {isChecking ? <small>{t().currentGameCheckingDetail}</small> : null}
          {isUnavailable ? <small>{t().currentGameUnavailableDetail}</small> : null}
          <small>{t().currentGamePlatform} {liveGame?.lolPlatform ?? profile.lolPlatform}</small>
          <small>{t().fetchedAt} {formatDate(liveGame?.fetchedAt)}</small>
        </div>
      ) : (
        <>
          <div className="public-ingame-summary">
            <div className="public-ingame-summary-card">
              <span>{t().currentGameMode}</span>
              <strong>{currentGameQueueLabel(liveGame)}</strong>
              <small>{liveGame.gameMode ?? "-"}</small>
            </div>
            <div className="public-ingame-summary-card">
              <span>{t().currentGameParticipants}</span>
              <strong>{participants.length} / {expectedParticipants}</strong>
              <small>{t().currentGameReady}</small>
            </div>
            <div className="public-ingame-summary-card">
              <span>{t().currentGameDuration}</span>
              <strong>{formatDuration(liveGame.gameLengthSeconds)}</strong>
              <small>{t().currentlyInGame}</small>
            </div>
            <div className="public-ingame-summary-card">
              <span>{t().currentGameAverageTier}</span>
              <strong>{averageTier}</strong>
              <small>{t().currentGamePlatform} {liveGame.lolPlatform ?? profile.lolPlatform}</small>
            </div>
          </div>
          <div className="public-ingame-teams">
            {teamIds.map((teamId) => (
              <article className={teamId === 100 ? "blue" : teamId === 200 ? "red" : ""} key={`current-game:${teamId}`}>
                <div className="public-ingame-team-head">
                  <strong>{currentGameTeamLabel(teamId)}</strong>
                  <span>{participants.filter((participant) => participant.teamId === teamId).length}/5</span>
                </div>
                <div className="public-ingame-table-head">
                  <span>{t().summonerResults}</span>
                  <span>{t().champion}</span>
                  <span>{t().summonerSpells}</span>
                  <span>{t().tier}</span>
                </div>
                <div className="public-ingame-player-list">
                  {participants.filter((participant) => participant.teamId === teamId).map((participant, index) => {
                    const spellIcons = participant.summonerSpells
                      .map((spellId) => ({ spellId, iconUrl: summonerSpellIconUrl(spellId, spellVersion) }))
                      .slice(0, 2);
                    return (
                      <div className={participant.isTarget ? "target" : ""} key={`${teamId}:${participant.riotId ?? participant.champion.championId}:${index}`}>
                        <div className="public-ingame-summoner-cell">
                          {participant.champion.iconUrl ? <img src={participant.champion.iconUrl} alt="" /> : <span>{championName(participant.champion).slice(0, 1)}</span>}
                          <div>
                            <SearchableRiotId riotId={participant.riotId} fallback={participant.isTarget ? profile.riotId : championName(participant.champion)} onSearch={onSearchRiotId} />
                            {participant.profileIconUrl ? <small><img src={assetUrl(participant.profileIconUrl)} alt="" /> {participant.bot ? t().currentGameBot : t().currentGameReady}</small> : null}
                          </div>
                        </div>
                        <div className="public-ingame-champion-cell">
                          <strong>{championName(participant.champion)}</strong>
                          <small>{participant.isTarget ? t().currentlyInGame : t().currentGameReady}</small>
                        </div>
                        <div className="public-ingame-spell-cell">
                          {spellIcons.length > 0 ? spellIcons.map((spell) => (
                            <span key={`${participant.riotId ?? index}:spell:${spell.spellId}`}>
                              {spell.iconUrl ? <img src={spell.iconUrl} alt="" /> : spell.spellId}
                            </span>
                          )) : (
                            <>
                              <span>-</span>
                              <span>-</span>
                            </>
                          )}
                        </div>
                        <div className="public-ingame-rank-cell">
                          <span className={rankTierClass(participant.rankedStats, participant.rankedStats ? "ready" : "unknown")}>{matchRankBadgeLabel(participant.rankedStats)}</span>
                          <small>{rankLabel(participant.rankedStats)}</small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
          <div className="public-ingame-bottom-summary">
            <div>
              <span>{t().currentGamePlatform}</span>
              <strong>{liveGame.lolPlatform ?? profile.lolPlatform}</strong>
            </div>
            <div>
              <span>{t().currentGameUpdated}</span>
              <strong>{formatDate(liveGame.fetchedAt)}</strong>
            </div>
            <div>
              <span>{t().currentGameAverageTier}</span>
              <strong>{averageTier}</strong>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function RecentMatches({
  profile,
  filters,
  champions,
  onSearchRiotId,
  onFilters,
  onResetFilters,
  onLoadMore,
  onLoadMoreIntent,
  loadingMore = false,
  moreError = ""
}: {
  profile: PublicLolProfile;
  filters: PublicMatchFilters;
  champions: LolChampionSummary[];
  onSearchRiotId: (riotId: string) => void;
  onFilters: (filters: PublicMatchFilters) => void;
  onResetFilters: () => void;
  onLoadMore?: () => void;
  onLoadMoreIntent?: () => void;
  loadingMore?: boolean;
  moreError?: string;
}) {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [expandedMatchViews, setExpandedMatchViews] = useState<Record<string, PublicExpandedMatchView>>({});
  const [matchRanks, setMatchRanks] = useState<Record<string, PublicLolMatchRankResponse>>({});
  const [matchRankLoading, setMatchRankLoading] = useState<Record<string, boolean>>({});
  const [matchDetails, setMatchDetails] = useState<Record<string, PublicLolMatchTeamsResponse>>({});
  const [matchDetailLoading, setMatchDetailLoading] = useState<Record<string, boolean>>({});
  const [matchDetailErrors, setMatchDetailErrors] = useState<Record<string, string>>({});
  const matchDetailControllers = useRef(new Map<string, AbortController>());
  const [matchBuilds, setMatchBuilds] = useState<Record<string, PublicLolMatchBuildResponse>>({});
  const [matchBuildLoading, setMatchBuildLoading] = useState<Record<string, boolean>>({});
  const [matchBuildErrors, setMatchBuildErrors] = useState<Record<string, string>>({});
  const [selectedBuildParticipantKeys, setSelectedBuildParticipantKeys] = useState<Record<string, string>>({});
  const [hiddenRiotIdMatches, setHiddenRiotIdMatches] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedMatchId(null);
    setExpandedMatchViews({});
    setMatchRanks({});
    setMatchRankLoading({});
    matchDetailControllers.current.forEach((controller) => controller.abort());
    matchDetailControllers.current.clear();
    setMatchDetails({});
    setMatchDetailLoading({});
    setMatchDetailErrors({});
    setMatchBuilds({});
    setMatchBuildLoading({});
    setMatchBuildErrors({});
    setSelectedBuildParticipantKeys({});
    setHiddenRiotIdMatches({});
    return () => {
      matchDetailControllers.current.forEach((controller) => controller.abort());
      matchDetailControllers.current.clear();
    };
  }, [profile.riotId, profile.refreshAvailableAt]);

  async function ensureMatchDetail(match: PublicLolRecentMatch): Promise<void> {
    if (
      (match.teams?.length ?? 0) > 0
      || matchDetails[match.matchId]
      || matchDetailLoading[match.matchId]
      || matchDetailControllers.current.has(match.matchId)
    ) return;
    const controller = new AbortController();
    matchDetailControllers.current.set(match.matchId, controller);
    setMatchDetailLoading((current) => ({ ...current, [match.matchId]: true }));
    setMatchDetailErrors((current) => ({ ...current, [match.matchId]: "" }));
    try {
      const response = await getPublicLolMatchDetail(match.matchId, profile.riotId, controller.signal);
      setMatchDetails((current) => ({ ...current, [match.matchId]: response }));
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error && error.message ? error.message : t().matchDetailLoadFailed;
      setMatchDetailErrors((current) => ({ ...current, [match.matchId]: message }));
    } finally {
      if (matchDetailControllers.current.get(match.matchId) === controller) {
        matchDetailControllers.current.delete(match.matchId);
        setMatchDetailLoading((current) => ({ ...current, [match.matchId]: false }));
      }
    }
  }

  async function ensureMatchRanks(matchId: string): Promise<void> {
    if (matchRanks[matchId] || matchRankLoading[matchId]) return;
    setMatchRankLoading((current) => ({ ...current, [matchId]: true }));
    try {
      const response = await getPublicLolMatchRanks(matchId);
      setMatchRanks((current) => ({ ...current, [matchId]: response }));
    } catch {
      // 티어 조회 실패는 전적 상세 자체를 숨기지 않습니다.
    } finally {
      setMatchRankLoading((current) => ({ ...current, [matchId]: false }));
    }
  }

  async function ensureMatchBuild(match: PublicLolRecentMatch): Promise<void> {
    if (matchBuilds[match.matchId] || matchBuildLoading[match.matchId]) return;
    setMatchBuildLoading((current) => ({ ...current, [match.matchId]: true }));
    setMatchBuildErrors((current) => ({ ...current, [match.matchId]: "" }));
    try {
      const response = await getPublicLolMatchBuild(match.matchId);
      setMatchBuilds((current) => ({ ...current, [match.matchId]: response }));
      setSelectedBuildParticipantKeys((current) => current[match.matchId]
        ? current
        : { ...current, [match.matchId]: defaultBuildParticipantKey(match, response, profile.riotId) ?? "" });
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t().buildLoadFailed;
      setMatchBuildErrors((current) => ({ ...current, [match.matchId]: message }));
    } finally {
      setMatchBuildLoading((current) => ({ ...current, [match.matchId]: false }));
    }
  }

  const matchRows = profile.recentMatches.map((match) => {
          const expanded = expandedMatchId === match.matchId;
          const expandedView = expandedMatchViews[match.matchId] ?? "record";
          const highlightClass = matchHighlightClass(match.badges);
          const rankDetail = matchRanks[match.matchId];
          const rankLoading = Boolean(matchRankLoading[match.matchId]);
          const matchDetail = matchDetails[match.matchId];
          const detailLoading = Boolean(matchDetailLoading[match.matchId]);
          const detailError = matchDetailErrors[match.matchId] ?? "";
          const hydratedMatch = matchDetail && Array.isArray(matchDetail.teams)
            ? { ...match, teams: matchDetail.teams }
            : match;
          const build = matchBuilds[match.matchId];
          const buildLoading = Boolean(matchBuildLoading[match.matchId]);
          const buildError = matchBuildErrors[match.matchId] ?? "";
          const hideRiotIds = Boolean(hiddenRiotIdMatches[match.matchId]);
          const dataDragonVersion = recentMatchDataDragonVersion(match);
          const recentItemSlots = fixedRecentItemSlots(match.items, 7);
          const aiScore = matchAiScore(match);
          const scoreGrade = recentMatchScoreGrade(aiScore);
          const targetRunes = match.runes ?? [];
          const spellItems: RecentMatchRowMediaItem[] = match.summonerSpells.slice(0, 2).map((spellId) => {
            const iconUrl = summonerSpellIconUrl(spellId, dataDragonVersion);
            return {
              key: `${match.matchId}:spell:${spellId}`,
              className: "spell",
              label: `${t().summonerSpells} ${spellId}`,
              content: iconUrl ? <img src={iconUrl} alt="" /> : spellId
            };
          });
          playerRuneBuildSlotsViewModel(targetRunes)
            .filter((rune) => rune.iconUrl)
            .forEach((rune) => spellItems.push({
              key: `${match.matchId}:rune:${rune.key}`,
              className: "rune",
              label: rune.title ?? t().runes,
              content: <img src={rune.iconUrl} alt="" />
            }));
          // 모든 지표 셀은 "값 위 / 라벨 아래" 한 규칙을 씁니다. 비율 지표에는 게이지를 붙여
          // 수치를 읽지 않아도 크기가 보이게 합니다.
          const matchMetrics: RecentMatchRowMetric[] = [
            {
              key: "kill-participation",
              label: t().killParticipation,
              labelShort: t().matchStatKillParticipationShort,
              ratio: match.killParticipation,
              value: <span className={metricToneClass(percentTone(match.killParticipation))}>{formatPercent(match.killParticipation)}</span>
            },
            {
              key: "cs",
              label: "CS",
              labelSuffix: ` · ${formatDecimal(match.csPerMinute, 1)}${t().matchStatPerMinuteSuffix}`,
              title: `CS · ${t().perMinuteCs} ${formatDecimal(match.csPerMinute, 1)}`,
              value: <span className={metricToneClass(csTone(match.csPerMinute))}>{formatNumber(match.cs)}</span>
            },
            {
              key: "damage-share",
              label: t().matchStatDamageShare,
              labelShort: t().matchStatDamageShareShort,
              ratio: match.damageShare,
              value: <span className={metricToneClass(percentTone(match.damageShare))}>{formatPercent(match.damageShare)}</span>
            }
          ];
          const itemSlotMediaItem = (item: PublicLolRecentMatch["items"][number] | undefined, index: number): RecentMatchRowMediaItem => {
            const itemName = activePublicLocale === "ja"
              ? item?.nameJa ?? item?.nameKo
              : item?.nameKo ?? item?.nameJa;
            return {
              key: `${match.matchId}:inline:${index}:${item?.itemId ?? "empty"}`,
              className: [item ? "" : "empty", index === 6 ? "ward" : ""].filter(Boolean).join(" "),
              focusable: Boolean(item),
              label: itemName ?? (item ? t().unknownItem : `${t().items} ${index + 1}`),
              content: item ? item.iconUrl ? <img src={item.iconUrl} alt="" /> : itemName ?? t().unknownItem : null
            };
          };
          // 앞 6칸은 장비, 마지막 칸은 장신구입니다. 형태를 나눠 한 덩어리로 읽히지 않게 합니다.
          const inlineItemSlots: RecentMatchRowMediaItem[] = recentItemSlots.slice(0, 6).map(itemSlotMediaItem);
          const trinketSlot = itemSlotMediaItem(recentItemSlots[6], 6);
          // 목록 응답의 teams 는 비어 있고 경기를 펼칠 때 채워집니다. 데이터가 있을 때만 그립니다.
          const compositionTeams = (hydratedMatch.teams ?? []).filter((team) => team.players.length > 0);
          const targetTeamId = compositionTeams
            .find((team) => team.players.some((player) => player.isTarget))?.teamId;
          const teamMember = (player: PublicLolMatchParticipant, side: string, index: number): RecentMatchRowTeamMember => ({
            key: `${match.matchId}:${side}:${index}:${player.champion.championId}`,
            label: player.isTarget ? `${t().matchTeamSelf} · ${championName(player.champion)}` : championName(player.champion),
            isTarget: player.isTarget,
            content: player.champion.iconUrl
              ? <img src={player.champion.iconUrl} alt="" />
              : <i aria-hidden="true">{championName(player.champion).slice(0, 1)}</i>
          });
          const allyPlayers = compositionTeams.find((team) => team.teamId === targetTeamId)?.players ?? [];
          const opponentPlayers = compositionTeams.find((team) => team.teamId !== targetTeamId)?.players ?? [];
          const teams: RecentMatchRowTeams | undefined = allyPlayers.length > 0 && opponentPlayers.length > 0
            ? {
              allies: allyPlayers.map((player, index) => teamMember(player, "ally", index)),
              opponents: opponentPlayers.map((player, index) => teamMember(player, "foe", index)),
              compositionLabel: t().matchTeamComposition,
              alliesLabel: t().matchTeamAllies,
              opponentsLabel: t().matchTeamOpponents
            }
            : undefined;
          const expandedPanelText: RecentMatchExpandedPanelText = {
            matchDetails: t().matchDetails,
            recordTab: {
              label: t().matchRecordTab,
              ko: publicI18n.ko.matchRecordTab,
              ja: publicI18n.ja.matchRecordTab
            },
            buildTab: {
              label: t().matchBuildTab,
              ko: publicI18n.ko.matchBuildTab,
              ja: publicI18n.ja.matchBuildTab
            },
            maskToggle: {
              label: hideRiotIds ? t().riotIdMaskOn : t().riotIdMaskOff,
              ko: hideRiotIds ? publicI18n.ko.riotIdMaskOn : publicI18n.ko.riotIdMaskOff,
              ja: hideRiotIds ? publicI18n.ja.riotIdMaskOn : publicI18n.ja.riotIdMaskOff
            }
          };
          const recordContent = (hydratedMatch.teams?.length ?? 0) > 0 ? (
            <MatchTeamDetails match={hydratedMatch} rankDetail={rankDetail} rankLoading={rankLoading} hideRiotIds={hideRiotIds} onSearchRiotId={onSearchRiotId} />
          ) : detailLoading ? (
            <SkeletonCard loadingLabel={t().matchDetailLoading} size="md">
              <SkeletonText lines={4} />
            </SkeletonCard>
          ) : detailError ? (
            <EmptyState as="div" variant="error">
              <EmptyStateIcon>!</EmptyStateIcon>
              <EmptyStateTitle as="h3">{t().matchDetailLoadFailed}</EmptyStateTitle>
              <EmptyStateDescription>{detailError}</EmptyStateDescription>
              <EmptyStateActions>
                <Button type="button" variant="secondary" onClick={() => void ensureMatchDetail(match)}>
                  {t().retryMatchDetail}
                </Button>
              </EmptyStateActions>
            </EmptyState>
          ) : null;
          const expandedPanel = expanded ? (
            <FeatureRecentMatchExpandedPanel
              activeView={expandedView}
              content={expandedView === "record" ? recordContent : (
                <RecentMatchBuildPanel
                  match={match}
                  build={build}
                  loading={buildLoading}
                  error={buildError}
                  selectedKey={selectedBuildParticipantKeys[match.matchId]}
                  hideRiotIds={hideRiotIds}
                  onSelect={(key) => setSelectedBuildParticipantKeys((current) => ({ ...current, [match.matchId]: key }))}
                />
              )}
              hideRiotIds={hideRiotIds}
              onBuild={() => {
                setExpandedMatchViews((current) => ({ ...current, [match.matchId]: "build" }));
                void ensureMatchBuild(match);
              }}
              onRecord={() => {
                setExpandedMatchViews((current) => ({ ...current, [match.matchId]: "record" }));
                void ensureMatchDetail(match);
                void ensureMatchRanks(match.matchId);
              }}
              onToggleMask={() => setHiddenRiotIdMatches((current) => ({ ...current, [match.matchId]: !current[match.matchId] }))}
              text={expandedPanelText}
            />
          ) : undefined;
          return (
            <FeatureRecentMatchRow
              scoreDescription={{
                label: t().aiScoreDescription,
                ko: publicI18n.ko.aiScoreDescription,
                ja: publicI18n.ja.aiScoreDescription
              }}
              championFallback={championName(match.champion).slice(0, 1)}
              championIconUrl={match.champion.iconUrl}
              championName={championName(match.champion)}
              championRoleLabel={mainRoleLabel(match.position)}
              championLevelLabel={formatNumber(match.championLevel)}
              expanded={expanded}
              expandedPanel={expandedPanel}
              expandAriaLabel={expanded ? t().collapseMatch : t().expandMatch}
              highlightClass={highlightClass}
              itemSlots={inlineItemSlots}
              itemsLabel={t().items}
              kdaMetric={<KdaMetricText value={match.kda} />}
              kdaScore={(
                <>
                  <span>{match.kills}</span><i>/</i><span className="deaths">{match.deaths}</span><i>/</i><span>{match.assists}</span>
                </>
              )}
              key={match.matchId}
              matchAriaLabel={`${resultLabel(match.result)} · ${championName(match.champion)} · ${match.kills}/${match.deaths}/${match.assists}`}
              metrics={matchMetrics}
              onToggleExpand={() => {
                const opening = expandedMatchId !== match.matchId;
                setExpandedMatchId(opening ? match.matchId : null);
                if (opening) {
                  setExpandedMatchViews((current) => ({ ...current, [match.matchId]: "record" }));
                  void ensureMatchDetail(match);
                  void ensureMatchRanks(match.matchId);
                }
              }}
              queueLabel={match.queueId ? queueLabels[activePublicLocale][match.queueId] ?? `${t().queue} ${match.queueId}` : "-"}
              result={match.result}
              resultDurationLabel={formatDuration(match.durationSeconds)}
              resultLabel={resultLabel(match.result)}
              resultShortLabel={resultShortLabel(match.result)}
              scoreAriaLabel={`${t().aggregateGrade} ${scoreGrade}`}
              scoreClassName={metricToneClass(scoreTone(aiScore))}
              scoreGrade={scoreGrade}
              spellItems={spellItems}
              startedAtLabel={formatRelativeDate(match.startedAt)}
              startedAtTimeLabel={formatMatchTime(match.startedAt)}
              summonerSpellsLabel={`${t().summonerSpells} / ${t().runes}`}
              teams={teams}
              trinketSlot={trinketSlot}
            />
          );
        });
  const shareMatches: RecentMatchShareItem[] = profile.recentMatches.slice(0, 8).map((match) => {
    const aiScore = matchAiScore(match);
    const highlight = matchHighlightBadges(match.badges)[0]?.code;
    return {
      key: match.matchId,
      result: match.result,
      resultLabel: resultLabel(match.result),
      championName: championName(match.champion),
      championIconUrl: match.champion.iconUrl,
      queueLabel: match.queueId ? queueLabels[activePublicLocale][match.queueId] ?? `${t().queue} ${match.queueId}` : "-",
      kda: `${formatNumber(match.kills)} / ${formatNumber(match.deaths)} / ${formatNumber(match.assists)}`,
      kdaMetric: `${formatDecimal(match.kda, 2)} KDA`,
      grade: recentMatchScoreGrade(aiScore),
      score: aiScore,
      ...(highlight === "mvp" || highlight === "ace" ? { highlight } : {}),
      itemIconUrls: fixedRecentItemSlots(match.items, 7)
        .flatMap((item) => item?.iconUrl ? [item.iconUrl] : []),
      durationLabel: formatDuration(match.durationSeconds),
      startedAtLabel: formatRelativeDate(match.startedAt),
    };
  });
  const text: RecentMatchesPanelText = {
    title: {
      label: t().recentGames,
      ko: publicI18n.ko.recentGames,
      ja: publicI18n.ja.recentGames
    },
    emptyTitle: {
      label: t().noData,
      ko: publicI18n.ko.noData,
      ja: publicI18n.ja.noData
    },
    emptyDescription: {
      label: t().recentGames,
      ko: publicI18n.ko.recentGames,
      ja: publicI18n.ja.recentGames
    },
    loadingMoreMatches: t().loadingMoreMatches,
    loadMoreMatches: t().loadMoreMatches,
    noMoreMatches: {
      label: t().noMoreMatches,
      ko: publicI18n.ko.noMoreMatches,
      ja: publicI18n.ja.noMoreMatches
    },
    loadFailedTitle: {
      label: t().matchListLoadFailed,
      ko: publicI18n.ko.matchListLoadFailed,
      ja: publicI18n.ja.matchListLoadFailed
    },
    retry: t().matchListRetry
  };
  // 리스트 바로 위에 승률·평균 KDA·주력 챔피언만 압축해 올립니다.
  // 사이드바의 심화 분석과 중복되지 않도록 3종으로 제한합니다.
  const recentWins = profile.summary.recentWins;
  const recentLosses = Math.max(0, profile.summary.recentGames - recentWins);
  const summaryChampions: RecentMatchesSummaryChampion[] = profile.championPerformance
    .slice(0, 3)
    .map((entry) => ({
      key: String(entry.champion.championId),
      name: championName(entry.champion),
      iconUrl: assetUrl(entry.champion.iconUrl),
      fallbackLabel: championName(entry.champion).slice(0, 1),
      metaLabel: `${entry.games}${t().games} ${formatPercent(entry.winRate)}`
    }));
  const summaryStrip = profile.summary.recentGames > 0 ? (
    <RecentMatchesSummaryStrip
      averageKdaLabel={formatDecimal(profile.summary.averageKda, 2)}
      champions={summaryChampions}
      losses={recentLosses}
      text={{
        winRateLabel: t().matchSummaryRecentWinRate,
        winsLabel: t().win.slice(0, 1),
        lossesLabel: t().loss.slice(0, 1),
        averageKdaLabel: t().matchSummaryAverageKda,
        topChampionsLabel: t().matchSummaryTopChampions
      }}
      winRateCaption={`${t().recentGames} ${profile.summary.recentGames}${t().games}`}
      winRatePercent={Math.round(profile.summary.recentWinRate ?? 0)}
      wins={recentWins}
    />
  ) : undefined;
  const filterResultSummary = profile.summary.recentGames > 0 ? (
    <>
      <b>{profile.summary.recentGames}{t().games}</b>
      <span aria-hidden="true" className="public-match-filter-summary-dot" />
      <span className="public-match-filter-summary-win">{recentWins}{t().win.slice(0, 1)}</span>
      {" "}
      <span className="public-match-filter-summary-loss">{recentLosses}{t().loss.slice(0, 1)}</span>
      <span aria-hidden="true" className="public-match-filter-summary-dot" />
      {t().winRate} <b>{formatPercent(profile.summary.recentWinRate)}</b>
      <span aria-hidden="true" className="public-match-filter-summary-dot" />
      {t().matchSummaryAverageKda} <b>{formatDecimal(profile.summary.averageKda, 2)}</b>
    </>
  ) : undefined;
  const canLoadMore = Boolean(profile.hasMoreRecentMatches && onLoadMore);
  const shareStreamer = visibleStreamerStream(profile.twitchStream);
  const shareProfileImageUrl = assetUrl(shareStreamer?.profileImageUrl) ?? assetUrl(profile.profileIconUrl);
  const shareMasteryChampionArtUrl = assetUrl(
    profile.topChampions[0]?.splashUrl ?? profile.topChampions[0]?.loadingUrl,
  );
  return (
    <FeatureRecentMatchesPanel
      canLoadMore={canLoadMore}
      filterBar={(
        <PublicMatchFilterBar
          champions={champions}
          filters={filters}
          onChange={onFilters}
          onReset={onResetFilters}
          resultSummary={filterResultSummary}
        />
      )}
      initialLoading={loadingMore && profile.recentMatches.length === 0}
      isEmpty={profile.recentMatches.length === 0}
      loadingMore={loadingMore}
      matchCount={`${profile.summary.recentGames}${t().games}`}
      matchRows={matchRows}
      summaryStrip={summaryStrip}
      shareAction={(
        <RecentMatchesShareActions
          matches={shareMatches}
          masteryChampionArtUrl={shareMasteryChampionArtUrl}
          profileImageUrl={shareProfileImageUrl}
          riotId={profile.riotId}
          text={{
            title: t().matchShareTitle,
            description: t().matchShareDescription,
            download: t().matchShareDownload,
            share: t().matchShareNative,
            preparing: t().matchSharePreparing,
            saved: t().matchShareSaved,
            shared: t().matchShareShared,
            failed: t().matchShareFailed,
            recentMatches: t().matchShareRecentMatches,
            games: t().games,
            generatedBy: t().matchShareGeneratedBy,
            wins: t().matchShareWins,
            losses: t().matchShareLosses,
            winRate: t().matchShareWinRate,
          }}
        />
      )}
      moreError={moreError}
      loadMoreKey={`${profile.lolPlatform}:${profile.riotId}:${profile.nextRecentMatchStart ?? profile.recentMatches.length}`}
      onLoadMore={onLoadMore}
      onLoadMoreIntent={onLoadMoreIntent}
      showNoMore={!canLoadMore && profile.recentMatches.length > 0}
      text={text}
    />
  );
}

function ChampionMastery({ profile }: { profile: PublicLolProfile }) {
  const rows = championAnalysisRows(profile).slice(0, 5);
  const maxMasteryPoints = championAnalysisMax(rows, (row) => row.masteryPoints);
  return (
    <section id="public-champions" className="public-panel public-champion-mastery-panel">
      <div className="public-section-head">
        <h2  >{t().championMasteryTop5}</h2>
        <span  >{t().masteryBasis}</span>
      </div>
      <div className="public-champion-top-grid">
        {rows.length === 0 ? <p className="public-empty">{t().noData}</p> : rows.map((row, index) => {
          const champion = row.champion;
          const artUrl = assetUrl(champion.loadingUrl ?? champion.splashUrl ?? champion.iconUrl);
          const performance = row.performance;
          return (
            <article className="public-champion-top-card" key={champion.championId}>
              <span className="public-champion-top-rank">{row.masteryRank ?? index + 1}</span>
              <div className="public-champion-top-art">
                {artUrl ? <img src={artUrl} alt="" /> : <span>{championName(champion).slice(0, 1)}</span>}
              </div>
              <strong>{championName(champion)}</strong>
              <small>{t().mastery} Lv.{formatNumber(row.masteryLevel)}</small>
              <b>{formatNumber(row.masteryPoints)}</b>
              <em className={metricToneClass(percentTone(performance?.winRate))}>{performance ? `${formatPercent(performance.winRate)} · ${gamesText(performance.games)}` : t().masteryPoint}</em>
              <div className="public-champion-progress" aria-hidden="true">
                <i style={{ width: barWidth(row.masteryPoints, maxMasteryPoints) }} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DetailedPerformance({ profile }: { profile: PublicLolProfile }) {
  const rows = championAnalysisRows(profile);
  const maxGames = championAnalysisMax(rows, (row) => row.performance?.games);
  const maxWins = championAnalysisMax(rows, (row) => row.performance?.wins);
  const maxKda = championAnalysisMax(rows, (row) => row.performance?.averageKda);
  const maxCs = championAnalysisMax(rows, (row) => row.performance?.averageCsPerMinute);
  const maxDpm = championAnalysisMax(rows, (row) => row.performance?.averageDamagePerMinute);
  const maxMasteryPoints = championAnalysisMax(rows, (row) => row.masteryPoints);
  return (
    <section className="public-panel public-detail-analysis-panel">
      <div className="public-section-head">
        <h2  >{t().championDetailStats}</h2>
        <span>{profile.summary.recentGames}{t().games}</span>
      </div>
      <div className="public-champion-analysis-table" aria-label={t().recentChampionStats}>
        <div className="public-champion-analysis-head">
          <span>{t().champion}</span>
          <span>{t().gamesPlayed}</span>
          <span>{t().wins}</span>
          <span>{t().kda}</span>
          <span>{t().averageCsPerMinute}</span>
          <span>DPM</span>
          <span>{t().masteryPoint}</span>
        </div>
        {rows.length === 0 ? <p className="public-empty">{t().noData}</p> : rows.map((row) => {
          const performance = row.performance;
          const champion = row.champion;
          return (
            <article className="public-champion-analysis-row" key={champion.championId}>
              <div className="public-champion-analysis-name">
                {champion.iconUrl ? <img src={champion.iconUrl} alt="" /> : <span>{championName(champion).slice(0, 1)}</span>}
                <div>
                  <strong>{championName(champion)}</strong>
                  <small>{t().mastery} Lv.{formatNumber(row.masteryLevel)}</small>
                </div>
              </div>
              <div className="public-champion-analysis-metric">
                <strong>{performance ? gamesText(performance.games) : "-"}</strong>
                <span><i style={{ width: barWidth(performance?.games, maxGames) }} /></span>
              </div>
              <div className="public-champion-analysis-metric">
                <strong className={metricToneClass(percentTone(performance?.winRate))}>{performance ? `${winsText(performance.wins)} · ${formatPercent(performance.winRate)}` : "-"}</strong>
                <span><i className="win" style={{ width: barWidth(performance?.wins, maxWins) }} /></span>
              </div>
              <div className="public-champion-analysis-metric kda">
                <strong>{performance ? <KdaMetricText value={performance.averageKda} /> : "-"}</strong>
                <span><i style={{ width: barWidth(performance?.averageKda, maxKda) }} /></span>
              </div>
              <div className="public-champion-analysis-metric">
                <strong className={metricToneClass(csTone(performance?.averageCsPerMinute))}>{formatDecimal(performance?.averageCsPerMinute, 1)}</strong>
                <span><i style={{ width: barWidth(performance?.averageCsPerMinute, maxCs) }} /></span>
              </div>
              <div className="public-champion-analysis-metric">
                <strong className={metricToneClass(damagePerMinuteTone(performance?.averageDamagePerMinute))}>{formatNumber(performance?.averageDamagePerMinute)}</strong>
                <span><i style={{ width: barWidth(performance?.averageDamagePerMinute, maxDpm) }} /></span>
              </div>
              <div className="public-champion-analysis-metric">
                <strong>{formatNumber(row.masteryPoints)}</strong>
                <span><i style={{ width: barWidth(row.masteryPoints, maxMasteryPoints) }} /></span>
              </div>
            </article>
          );
        })}
      </div>
      <div className="public-performance-block">
        <h3  >{t().rolePerformance}</h3>
        <div className="public-role-chip-list">
          {profile.rolePerformance.length === 0 ? <p className="public-empty">{t().noData}</p> : profile.rolePerformance.map((item) => (
            <article className="public-role-chip" key={item.role}>
              <span>{mainRoleLabel(item.role)}</span>
              <strong>{gamesText(item.games)}</strong>
              <small>
                <span className={metricToneClass(percentTone(item.winRate))}>{formatPercent(item.winRate)}</span>
                {" · "}
                <KdaMetricText value={item.averageKda} />
              </small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AnalysisPanel({ profile }: { profile: PublicLolProfile }) {
  const topChampion = profile.topChampions[0];
  const strongestChampion = profile.championPerformance[0];
  const strongestRole = profile.rolePerformance[0];
  return (
    <section id="public-ingame" className="public-panel public-analysis-panel">
      <div className="public-section-head">
        <h2  >{t().analysis}</h2>
      </div>
      <div className="public-insight-list">
        <article>
          <strong>{analysisRoleTitle(profile.roleAnalysis?.mainRole)}</strong>
          <p>{profile.roleAnalysis ? analysisRoleBody(profile.roleAnalysis.sampleSize, profile.roleAnalysis.confidence) : t().noData}</p>
        </article>
        <article>
          <strong>{analysisMasteryTitle(topChampion)}</strong>
          <p>{topChampion ? analysisMasteryBody(topChampion) : t().noData}</p>
        </article>
        <article>
          <strong>{analysisRecentTitle(profile.summary.recentWinRate)}</strong>
          <p>{analysisRecentBody(profile)}</p>
        </article>
        <article>
          <strong>{analysisChampionTitle(strongestChampion)}</strong>
          <p>{strongestChampion ? analysisChampionBody(strongestChampion) : t().noData}</p>
        </article>
        <article>
          <strong>{analysisRolePerformanceTitle(strongestRole)}</strong>
          <p>{strongestRole ? analysisRolePerformanceBody(strongestRole) : t().noData}</p>
        </article>
      </div>
    </section>
  );
}

function PublicTopbar({
  locale,
  onHome,
  onOpenAdmin,
  onLocale,
  onAutoLocale,
  onNavigate
}: {
  locale: PublicLocale;
  onHome: () => void;
  onOpenAdmin: () => void;
  onLocale: (locale: PublicLocale) => void;
  onAutoLocale: () => void;
  onNavigate: (target: PublicNavTarget) => void;
}) {
  return (
    <header className="public-topbar">
      <button className="public-brand" type="button" onClick={onHome}>
        <img className="public-brand-logo" src="/images/yorogg-mark.png" alt={t().brand} />
      </button>
      <nav aria-label="YORO.gg">
        <button type="button" onClick={() => onNavigate("search")}  >{t().searchNav}</button>
        <button type="button" onClick={() => onNavigate("ranking")}  >{t().ranking}</button>
        <button type="button" onClick={() => onNavigate("champion")}  >{t().championAnalysis}</button>
        <button type="button" onClick={() => onNavigate("stats")}  >{t().stats}</button>
        <button type="button" onClick={() => onNavigate("promotion")}  >{t().promotion}</button>
        <button type="button" onClick={() => onNavigate("community")}  >{t().community}</button>
      </nav>
      <div className="public-top-actions">
        <PublicLocaleSelector locale={locale} onLocale={onLocale} onAutoLocale={onAutoLocale} />
        <button className="public-theme-button" type="button" aria-label={t().darkMode}>●</button>
        <button className="public-login-button" type="button" onClick={onOpenAdmin}  >{t().login}</button>
      </div>
    </header>
  );
}

function PublicMobileNav({ onNavigate }: { onNavigate: (target: PublicNavTarget) => void }) {
  return (
    <nav className="public-mobile-nav" aria-label="YORO.gg mobile">
      <button type="button" onClick={() => onNavigate("search")}>
        <span aria-hidden="true">⌂</span>
        <strong  >{t().searchNav}</strong>
      </button>
      <button type="button" onClick={() => onNavigate("ranking")}>
        <span aria-hidden="true">◴</span>
        <strong  >{t().ranking}</strong>
      </button>
      <button type="button" onClick={() => onNavigate("champion")}>
        <span aria-hidden="true">♛</span>
        <strong  >{t().championAnalysis}</strong>
      </button>
      <button type="button" onClick={() => onNavigate("ingame")}>
        <span aria-hidden="true">▣</span>
        <strong  >{t().ingame}</strong>
      </button>
      <button type="button" onClick={() => onNavigate("community")}>
        <span aria-hidden="true">⋯</span>
        <strong  >{t().moreMenu}</strong>
      </button>
    </nav>
  );
}

export function PublicLolPage({
  onOpenAdmin
}: {
  onOpenAdmin: () => void;
}) {
  const initialSummonerRoute = publicSummonerRouteFromPath();
  const initialRouteRiotId = initialSummonerRoute?.riotId;
  const { locale, changeLocale, autoDetectLocale } = usePublicLocale(loadPublicLocalePreference);
  setActivePublicLocale(locale);
  const platformOptions = useMemo(() => localizedPlatformOptions(locale), [locale]);
  const [selectedLolPlatform, setSelectedLolPlatform] = useState<LolPlatformId>(
    () => initialSummonerRoute?.lolPlatform ?? DEFAULT_PUBLIC_LOL_PLATFORM
  );
  const [query, setQuery] = useState(() => initialRouteRiotId ?? "");
  const [profile, setProfile] = useState<PublicLolProfile | null>(null);
  const [loading, setLoading] = useState(() => Boolean(initialRouteRiotId));
  const [loadingMoreMatches, setLoadingMoreMatches] = useState(false);
  const [moreMatchesError, setMoreMatchesError] = useState("");
  const [error, setError] = useState("");
  const profileSearchAbortRef = useRef<AbortController | undefined>(undefined);
  const profileSearchSequenceRef = useRef(0);
  const loadMoreAbortRef = useRef<AbortController | undefined>(undefined);
  const loadMoreSequenceRef = useRef(0);
  const loadMoreInFlightKeyRef = useRef<string | undefined>(undefined);
  const queueFilterAbortRef = useRef<AbortController | undefined>(undefined);
  const queueFilterSequenceRef = useRef(0);
  const [recentSearches, setRecentSearches] = useState<SearchSuggestion[]>(() => readRecentSearches());
  const [favorites, setFavorites] = useState<PublicFavorite[]>(() => readFavorites());
  const { theme, toggleTheme } = usePublicTheme();
  const [filters, setFilters] = useState<PublicMatchFilters>(DEFAULT_MATCH_FILTERS);
  const [queueMatchPages, setQueueMatchPages] = useState<Partial<Record<MatchQueueFilter, PublicLolMatchPageResponse>>>({});
  const [loadingQueueMatches, setLoadingQueueMatches] = useState(false);
  const [remoteSuggestions, setRemoteSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchPanelRequest, setSearchPanelRequest] = useState<SearchFormPanelRequest>();
  const [profileTab, setProfileTab] = useState<PublicProfileTab>("overview");
  const initialPublicRoute = publicPageRouteFromPath();
  const [activeMainPage, setActiveMainPage] = useState<PublicMainPage>(initialPublicRoute?.page ?? "search");
  const [activeNav, setActiveNav] = useState<PublicNavTarget>("search");
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [streamerRegisterOpen, setStreamerRegisterOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [twitchStatus, setTwitchStatus] = useState<PublicTwitchViewerStatus>(() => (
    peekPublicTwitchStatus() ?? {
      connected: false,
      configured: false,
      requiredScopes: [],
      missingScopes: []
    }
  ));
  const [followedLol, setFollowedLol] = useState<PublicTwitchFollowedLolResponse | null>(
    () => peekPublicTwitchFollowedChannels() ?? null,
  );
  const [followedLoading, setFollowedLoading] = useState(
    () => Boolean(peekPublicTwitchStatus()?.connected && !peekPublicTwitchFollowedChannels()),
  );
  const [followedError, setFollowedError] = useState("");
  const twitchOAuthReturnRef = useRef(
    isTwitchAccountOAuthReturn(window.location.search)
      || new URLSearchParams(window.location.search).get("viewer_twitch") === "connected"
  );
  const [twitchOAuthSettling, setTwitchOAuthSettling] = useState(
    twitchOAuthReturnRef.current
  );
  const followedLolRequestRef = useRef<{
    includeSubscriptions: boolean;
    promise: Promise<void>;
  } | null>(null);
  /* 팔로우 목록 자동 로드의 시도 횟수와 예약된 재시도입니다.
     요청이 실패하면 followedLol 이 비어 있는 채로 followedLoading 만 false 가 되어
     아래 effect 가 다시 조건을 통과합니다. 시도 횟수를 따로 세지 않으면
     렌더 속도만큼(실측 초당 약 500회) 재요청이 반복됩니다. */
  const followedLolAttemptRef = useRef(0);
  const followedLolRetryTimerRef = useRef<number>();
  const [publicParticipation, setPublicParticipation] = useState<PublicParticipationStateResponse | null>(null);
  const [publicParticipationDiscovery, setPublicParticipationDiscovery] = useState<PublicParticipationDiscoveryResponse | null>(null);
  const [publicParticipationLoading, setPublicParticipationLoading] = useState(false);
  const [publicParticipationError, setPublicParticipationError] = useState("");
  const [publicParticipationJoinRiotId, setPublicParticipationJoinRiotId] = useState("");
  const [publicParticipationJoinRole, setPublicParticipationJoinRole] = useState<LolRole>("fill");
  const [publicParticipationJoining, setPublicParticipationJoining] = useState(false);
  const [publicParticipationCancelling, setPublicParticipationCancelling] = useState(false);
  const [publicParticipationMessage, setPublicParticipationMessage] = useState("");
  const [publicParticipationStreamerId, setPublicParticipationStreamerId] = useState("");
  const [publicParticipationSessionId, setPublicParticipationSessionId] = useState(
    () => new URLSearchParams(window.location.search).get("session")?.trim() ?? ""
  );
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communitySubmitting, setCommunitySubmitting] = useState(false);
  const [communityCommentSubmitting, setCommunityCommentSubmitting] = useState(false);
  const [communityReportSubmitting, setCommunityReportSubmitting] = useState(false);
  const [communityError, setCommunityError] = useState("");
  const [communityCommentError, setCommunityCommentError] = useState("");
  const [communityReportError, setCommunityReportError] = useState("");
  const [communityToast, setCommunityToast] = useState<CommunityToast | null>(null);
  const [selectedCommunityPostId, setSelectedCommunityPostId] = useState<string | undefined>(initialPublicRoute?.postId);
  const [communityPostProfile, setCommunityPostProfile] = useState<CommunityPostProfileState>({ status: "idle" });
  const storedSuggestions = useMemo(() => {
    const unique = new Map<string, SearchSuggestion>();
    for (const suggestion of [...favorites, ...recentSearches]) {
      const key = normalizeSuggestionKey(suggestion);
      if (!unique.has(key)) unique.set(key, suggestion);
    }
    return [...unique.values()];
  }, [favorites, recentSearches]);
  const suggestions = useMemo(
    () => buildSuggestions(query, storedSuggestions, remoteSuggestions, selectedLolPlatform),
    [query, storedSuggestions, remoteSuggestions, selectedLolPlatform]
  );
  const visibleSuggestions = query.trim() && query.trim() !== profile?.riotId ? suggestions : [];
  const homeLiveStreamers = useMemo<PublicHomeLiveStreamer[]>(() => {
    const streamers = new Map<string, PublicHomeLiveStreamer>();
    for (const channel of followedLol?.channels ?? []) {
      if (!channel.isLive) continue;
      const key = channel.twitchUserId || channel.riotId || channel.twitchLogin;
      if (!key || streamers.has(key)) continue;
      streamers.set(key, {
        id: key,
        name: channel.twitchDisplayName,
        nameJa: channel.twitchDisplayName,
        primaryMeta: channel.rankedStats ? rankLabel(channel.rankedStats) : channel.riotId ?? channel.gameName ?? "League of Legends",
        primaryMetaJa: channel.rankedStats ? rankLabel(channel.rankedStats) : channel.riotId ?? channel.gameName ?? "League of Legends",
        secondaryMeta: channel.viewerCount !== undefined ? `${formatNumber(channel.viewerCount)} ${t().twitchViewers}` : channel.title,
        secondaryMetaJa: channel.viewerCount !== undefined ? `${formatNumber(channel.viewerCount)} ${t().twitchViewers}` : channel.title,
        server: channel.riotTagLine ? `${channel.riotTagLine} Server` : "JP Server",
        avatarLabel: channel.twitchDisplayName.slice(0, 1),
        avatarUrl: assetUrl(channel.profileImageUrl),
        previewLabel: locale === "ja"
          ? `${channel.twitchDisplayName}の配信プレビュー`
          : `${channel.twitchDisplayName} 방송 미리보기`,
        previewUrl: safeTwitchStreamPreviewUrl(channel.thumbnailUrl),
        channelUrl: channel.channelUrl ?? (channel.twitchLogin ? `https://www.twitch.tv/${channel.twitchLogin}` : undefined),
        statusLabel: "LIVE",
        statusKo: "LIVE",
        statusJa: "LIVE",
      });
    }
    return [...streamers.values()].slice(0, 12);
  }, [followedLol, locale]);
  const matchSourceProfile = useMemo(() => {
    if (!profile) return null;
    const queuePage = filters.queue === "all" ? undefined : queueMatchPages[filters.queue];
    if (!queuePage) return profile;
    return {
      ...profile,
      recentMatches: queuePage.recentMatches,
      recentMatchStart: queuePage.recentMatchStart,
      nextRecentMatchStart: queuePage.nextRecentMatchStart,
      hasMoreRecentMatches: queuePage.hasMoreRecentMatches,
      fetchedAt: queuePage.fetchedAt
    };
  }, [filters.queue, profile, queueMatchPages]);
  const visibleProfile = useMemo(() => {
    if (!matchSourceProfile) return null;
    return profileWithMatches(matchSourceProfile, filteredMatches(matchSourceProfile, filters));
  }, [matchSourceProfile, filters]);
  const selectedCommunityPost = useMemo(
    () => communityPosts.find((post) => post.id === selectedCommunityPostId),
    [communityPosts, selectedCommunityPostId]
  );
  const refreshRemaining = refreshRemainingMs(profile, nowTick);
  const availableChampions = useMemo(() => {
    const unique = new Map<number, LolChampionSummary>();
    for (const match of matchSourceProfile?.recentMatches ?? []) {
      if (!unique.has(match.champion.championId)) unique.set(match.champion.championId, match.champion);
    }
    return [...unique.values()].sort((a, b) => championName(a).localeCompare(championName(b)));
  }, [matchSourceProfile]);

  useEffect(() => () => {
    profileSearchAbortRef.current?.abort();
    loadMoreAbortRef.current?.abort();
    queueFilterAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    queueFilterAbortRef.current?.abort();
    queueFilterAbortRef.current = undefined;
    queueFilterSequenceRef.current += 1;
    setMoreMatchesError("");
    if (!profile || filters.queue === "all") {
      setLoadingQueueMatches(false);
      return undefined;
    }
    const platform = normalizeLolPlatformId(profile.lolPlatform) ?? selectedLolPlatform;
    const cached = queueMatchPages[filters.queue];
    if (
      cached
      && cached.riotId === profile.riotId
      && normalizeLolPlatformId(cached.lolPlatform) === platform
    ) {
      setLoadingQueueMatches(false);
      return undefined;
    }

    const controller = new AbortController();
    const requestSequence = queueFilterSequenceRef.current;
    queueFilterAbortRef.current = controller;
    setLoadingQueueMatches(true);
    void getPublicLolMatchPage(profile.riotId, 0, platform, controller.signal, filters.queue)
      .then((page) => {
        if (controller.signal.aborted || requestSequence !== queueFilterSequenceRef.current) return;
        setQueueMatchPages((current) => ({ ...current, [filters.queue]: page }));
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted || requestSequence !== queueFilterSequenceRef.current) return;
        setMoreMatchesError(requestError instanceof Error ? requestError.message : t().searchFailed);
      })
      .finally(() => {
        if (queueFilterAbortRef.current === controller) queueFilterAbortRef.current = undefined;
        if (requestSequence === queueFilterSequenceRef.current) setLoadingQueueMatches(false);
      });
    return () => controller.abort();
  }, [filters.queue, profile?.riotId, profile?.lolPlatform, queueMatchPages, selectedLolPlatform]);

  useEffect(() => {
    const unprefixedPath = stripPublicLocalePrefix(window.location.pathname);
    const canonicalPath = isLocalizablePublicPath(unprefixedPath)
      ? localizedPublicUrl(unprefixedPath, locale)
      : localizedPublicUrl("/", locale);
    const canonicalUrl = new URL(canonicalPath, window.location.origin).href;
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const openGraphUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    canonical?.setAttribute("href", canonicalUrl);
    openGraphUrl?.setAttribute("content", canonicalUrl);
  }, [activeMainPage, locale, profile?.riotId, selectedCommunityPostId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewerConnected = twitchOAuthReturnRef.current;
    if (viewerConnected) invalidatePublicTwitchClientCache();
    const initialRequest = loadTwitchViewer(viewerConnected);
    let disposed = false;
    let retryTimer: number | undefined;
    if (viewerConnected) {
      params.delete("viewer_twitch");
      params.delete("account");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
      void initialRequest.finally(() => {
        if (disposed) return;
        retryTimer = window.setTimeout(() => {
          void loadTwitchViewer(true).finally(() => {
            if (!disposed) setTwitchOAuthSettling(false);
          });
        }, 350);
      });
    }
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    if (!twitchStatus.connected) {
      followedLolAttemptRef.current = 0;
      setFollowedLol(null);
      return undefined;
    }
    if (followedLol || followedLoading) return undefined;
    if (followedLolAttemptRef.current >= FOLLOWED_LOL_MAX_ATTEMPTS) return undefined;

    const attempt = followedLolAttemptRef.current;
    followedLolAttemptRef.current = attempt + 1;
    if (attempt === 0) {
      void loadFollowedLol();
      return undefined;
    }

    // 첫 시도가 실패한 뒤에는 간격을 두고 다시 시도합니다.
    const delay = Math.min(
      FOLLOWED_LOL_RETRY_MAX_MS,
      FOLLOWED_LOL_RETRY_BASE_MS * 2 ** (attempt - 1)
    );
    followedLolRetryTimerRef.current = window.setTimeout(() => {
      followedLolRetryTimerRef.current = undefined;
      void loadFollowedLol();
    }, delay);
    return () => {
      if (followedLolRetryTimerRef.current === undefined) return;
      window.clearTimeout(followedLolRetryTimerRef.current);
      followedLolRetryTimerRef.current = undefined;
    };
  }, [twitchStatus.connected, followedLol, followedLoading]);

  useEffect(() => {
    if (activeMainPage !== "subscriptions" || !twitchStatus.connected) return;
    void loadFollowedLol(false, true);
  }, [activeMainPage, twitchStatus.connected]);

  useEffect(() => {
    if (activeMainPage !== "followJoin") return undefined;
    void loadPublicParticipationState();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadPublicParticipationState(true);
      }
    }, 15_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void loadPublicParticipationState(true);
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [activeMainPage, twitchStatus.connected, publicParticipationStreamerId, publicParticipationSessionId]);

  useEffect(() => {
    if (activeMainPage !== "patch" && activeMainPage !== "communityParty" && activeMainPage !== "communityServerWrite" && activeMainPage !== "communityPartyWrite") return;
    void loadCommunityPosts(communityPageCategory(activeMainPage));
  }, [activeMainPage]);

  useEffect(() => {
    if (refreshRemainingMs(profile, Date.now()) <= 0) return undefined;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [profile?.refreshAvailableAt]);

  useEffect(() => {
    if (!profile?.riotId) return undefined;
    const controller = new AbortController();
    const syncStreamerStatus = async () => {
      try {
        const platform = normalizeLolPlatformId(profile.lolPlatform) ?? selectedLolPlatform;
        const next = await getPublicLolProfileDynamicState(profile.riotId, controller.signal, platform);
        if (controller.signal.aborted) return;
        setProfile((current) => current ? profileWithDynamicState(current, next) : current);
      } catch {
        // 실시간 상태 갱신 실패는 전적 화면 사용을 막지 않습니다.
      }
    };
    const timer = window.setInterval(() => {
      void syncStreamerStatus();
    }, 30_000);
    void syncStreamerStatus();
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [profile?.riotId, profile?.lolPlatform, selectedLolPlatform]);

  useEffect(() => {
    const loadFromPath = (replaceUrl = true) => {
      const route = publicPageRouteFromPath();
      if (route && route.page !== "search") {
        setProfile(null);
        setError("");
        setActiveMainPage(route.page);
        setActiveNav(route.page === "palworld" || route.page === "privacy" || route.page === "terms" || route.page === "contact" ? "search" : "community");
        setStreamerRegisterOpen(false);
        if (route.page === "followJoin") {
          setPublicParticipationSessionId(new URLSearchParams(window.location.search).get("session")?.trim() ?? "");
        }
        if (route.postId) {
          setSelectedCommunityPostId(route.postId);
          void getPublicCommunityPosts().then((posts) => {
            setCommunityPosts(posts);
            const post = posts.find((candidate) => candidate.id === route.postId);
            if (post) void loadCommunityPostProfile(post);
          }).catch((requestError) => {
            setCommunityError(requestError instanceof Error ? requestError.message : t().communityLoadFailed);
          });
        }
        return;
      }
      const summonerRoute = publicSummonerRouteFromPath();
      if (!summonerRoute) {
        setProfile(null);
        setError("");
        setFilters(DEFAULT_MATCH_FILTERS);
        setStreamerRegisterOpen(false);
        setSelectedCommunityPostId(undefined);
        setCommunityPostProfile({ status: "idle" });
        setActiveMainPage("search");
        setActiveNav("search");
        return;
      }
      setSelectedLolPlatform(summonerRoute.lolPlatform);
      setQuery(summonerRoute.riotId);
      void runSearch(summonerRoute.riotId, { replaceUrl, platform: summonerRoute.lolPlatform });
    };
    loadFromPath(true);
    const handlePopState = () => {
      loadFromPath(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2 || normalizedQuery === profile?.riotId) {
      setRemoteSuggestions([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void searchSuggestions(normalizedQuery, controller.signal, selectedLolPlatform)
        .then(setRemoteSuggestions)
        .catch((suggestionError) => {
          if (suggestionError instanceof DOMException && suggestionError.name === "AbortError") return;
          setRemoteSuggestions([]);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, profile?.riotId, selectedLolPlatform]);

  async function loadTwitchViewer(force = false): Promise<void> {
    setFollowedError("");
    try {
      const status = await getPublicTwitchStatus(undefined, { force });
      setTwitchStatus(status);
      if (status.connected) {
        await loadFollowedLol(force);
      } else {
        setFollowedLol(null);
        setPublicParticipation(null);
        setPublicParticipationDiscovery(null);
        setPublicParticipationMessage("");
      }
    } catch (requestError) {
      setFollowedError(requestError instanceof Error ? requestError.message : t().searchFailed);
    }
  }

  async function loadFollowedLol(force = false, includeSubscriptions = false): Promise<void> {
    const pending = followedLolRequestRef.current;
    if (pending) {
      await pending.promise;
      if (!includeSubscriptions || pending.includeSubscriptions) return;
    }
    const request = (async () => {
    setFollowedLoading(true);
    setFollowedError("");
    try {
      const response = await getPublicTwitchFollowedChannels(undefined, {
        force,
        includeSubscriptions,
      });
      setFollowedLol(response);
      if (!response.connected) {
        setTwitchStatus((current) => ({ ...current, connected: false }));
      }
    } catch (requestError) {
      setFollowedError(requestError instanceof Error ? requestError.message : t().searchFailed);
    } finally {
      setFollowedLoading(false);
    }
    })();
    followedLolRequestRef.current = { includeSubscriptions, promise: request };
    try {
      await request;
    } finally {
      if (followedLolRequestRef.current?.promise === request) followedLolRequestRef.current = null;
    }
  }

  async function loadPublicParticipationState(silent = false): Promise<void> {
    if (!silent) setPublicParticipationLoading(true);
    setPublicParticipationError("");
    try {
      const discoveryRequest = getPublicParticipationDiscovery().catch(() => null);
      const response = await getPublicParticipationState(
        publicParticipationStreamerId || undefined,
        publicParticipationSessionId || undefined
      );
      const discovery = await discoveryRequest;
      setPublicParticipation(response);
      setPublicParticipationDiscovery(discovery);
      if (response.publicSessionId && response.publicSessionId !== publicParticipationSessionId) {
        setPublicParticipationSessionId(response.publicSessionId);
      }
      setPublicParticipationStreamerId((current) => {
        if (response.selectedStreamerId) return response.selectedStreamerId;
        return current && !response.streamers.some((streamer) => streamer.id === current) ? "" : current;
      });
      setTwitchStatus((current) => current.connected === response.connected ? current : { ...current, connected: response.connected });
    } catch (requestError) {
      if (!silent) {
        setPublicParticipationError(requestError instanceof Error ? requestError.message : t().participationLoadFailed);
      }
    } finally {
      if (!silent) setPublicParticipationLoading(false);
    }
  }

  async function submitPublicParticipation(): Promise<void> {
    if (!publicParticipationStreamerId) {
      setPublicParticipationError(t().participationSelectStreamerTitle);
      return;
    }
    setPublicParticipationJoining(true);
    setPublicParticipationError("");
    setPublicParticipationMessage("");
    try {
      const response = await postPublicParticipationJoin({
        riotId: publicParticipationJoinRiotId,
        role: publicParticipationJoinRole,
        streamerId: publicParticipationStreamerId,
        publicSessionId: (publicParticipation?.publicSessionId ?? publicParticipationSessionId) || undefined,
        rejoin: publicParticipation?.viewerEntry?.status === "played" || publicParticipation?.viewerEntry?.status === "skipped"
      });
      setPublicParticipation(response.state);
      if (response.state.selectedStreamerId) setPublicParticipationStreamerId(response.state.selectedStreamerId);
      setPublicParticipationMessage(response.alreadyJoined ? t().participationAlreadyJoined : t().participationJoinComplete);
      if (!response.alreadyJoined) {
        trackGoogleAnalyticsEvent("participation_join", {
          join_type: ["played", "skipped"].includes(publicParticipation?.viewerEntry?.status ?? "") ? "rejoin" : "join"
        });
      }
    } catch (requestError) {
      setPublicParticipationError(requestError instanceof Error ? requestError.message : t().participationJoinFailed);
    } finally {
      setPublicParticipationJoining(false);
    }
  }

  async function cancelPublicParticipation(): Promise<void> {
    if (!publicParticipationStreamerId) {
      setPublicParticipationError(t().participationSelectStreamerTitle);
      return;
    }
    setPublicParticipationCancelling(true);
    setPublicParticipationError("");
    setPublicParticipationMessage("");
    try {
      const response = await postPublicParticipationCancel({
        streamerId: publicParticipationStreamerId,
        publicSessionId: (publicParticipation?.publicSessionId ?? publicParticipationSessionId) || undefined
      });
      setPublicParticipation(response.state);
      if (response.state.selectedStreamerId) setPublicParticipationStreamerId(response.state.selectedStreamerId);
      setPublicParticipationMessage(t().participationCancelComplete);
    } catch (requestError) {
      setPublicParticipationError(requestError instanceof Error ? requestError.message : t().participationCancelFailed);
    } finally {
      setPublicParticipationCancelling(false);
    }
  }



  function clearPublicParticipationStreamer(): void {
    setPublicParticipationStreamerId("");
    setPublicParticipationSessionId("");
    const url = new URL(window.location.href);
    url.searchParams.delete("session");
    url.searchParams.delete("streamerId");
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function selectPublicParticipationStreamer(streamer: PublicParticipationStreamer): void {
    setPublicParticipationStreamerId(streamer.id);
    const publicSessionId = streamer.publicSessionId ?? "";
    setPublicParticipationSessionId(publicSessionId);
    const url = new URL(window.location.href);
    if (publicSessionId) url.searchParams.set("session", publicSessionId);
    else url.searchParams.delete("session");
    url.searchParams.delete("streamerId");
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function loadCommunityPosts(category: CommunityPostCategory = communityPageCategory(activeMainPage)): Promise<void> {
    setCommunityLoading(true);
    setCommunityError("");
    try {
      setCommunityPosts(await getPublicCommunityPosts(category));
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t().communityLoadFailed;
      setCommunityError(message);
      setCommunityToast({
        title: t().communityLoadFailed,
        description: message,
        tone: "danger"
      });
    } finally {
      setCommunityLoading(false);
    }
  }

  async function loadCommunityPostProfile(post: CommunityPost): Promise<void> {
    const riotId = communityPostRiotId(post);
    if (!riotId) {
      setCommunityPostProfile({ status: "idle" });
      return;
    }
    setCommunityPostProfile({ riotId, status: "loading" });
    try {
      const nextProfile = await searchProfile(riotId);
      setCommunityPostProfile({ riotId, status: "ready", profile: nextProfile });
    } catch (requestError) {
      setCommunityPostProfile({
        riotId,
        status: "error",
        error: requestError instanceof Error ? requestError.message : t().communityRecordFailed
      });
    }
  }

  async function submitCommunityPost(input: CommunityPostSubmitInput): Promise<boolean> {
    setCommunitySubmitting(true);
    setCommunityError("");
    try {
      setCommunityPosts(await createPublicCommunityPost(input));
      setCommunityToast({
        title: t().communitySubmit,
        description: input.title,
        tone: "success"
      });
      return true;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t().searchFailed;
      setCommunityError(message);
      setCommunityToast({
        title: t().searchFailed,
        description: message,
        tone: "danger"
      });
      return false;
    } finally {
      setCommunitySubmitting(false);
    }
  }

  async function updateCommunityServerPost(postId: string, input: CommunityPostSubmitInput): Promise<boolean> {
    setCommunitySubmitting(true);
    setCommunityError("");
    try {
      setCommunityPosts(await updatePublicCommunityPost(postId, input));
      setCommunityToast({
        title: t().communityUpdateSubmit,
        description: input.title,
        tone: "success"
      });
      return true;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t().searchFailed;
      setCommunityError(message);
      setCommunityToast({
        title: t().searchFailed,
        description: message,
        tone: "danger"
      });
      return false;
    } finally {
      setCommunitySubmitting(false);
    }
  }

  async function submitCommunityComment(postId: string, body: string): Promise<void> {
    setCommunityCommentSubmitting(true);
    setCommunityCommentError("");
    try {
      setCommunityPosts(await createPublicCommunityComment(postId, body));
      setCommunityToast({
        title: t().communityCommentSubmit,
        description: t().communityCommentsTitle,
        tone: "success"
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t().communityCommentFailed;
      setCommunityCommentError(message);
      setCommunityToast({
        title: t().communityCommentFailed,
        description: message,
        tone: "danger"
      });
    } finally {
      setCommunityCommentSubmitting(false);
    }
  }

  async function submitCommunityReport(postId: string, input: CommunityPostReportCreateInput): Promise<boolean> {
    setCommunityReportSubmitting(true);
    setCommunityReportError("");
    try {
      await createPublicCommunityReport(postId, input);
      setCommunityToast({
        title: t().communityReport,
        description: t().communityReportSuccess,
        tone: "success"
      });
      return true;
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : t().communityReportFailed;
      setCommunityReportError(message);
      setCommunityToast({
        title: t().communityReportFailed,
        description: message,
        tone: "danger"
      });
      return false;
    } finally {
      setCommunityReportSubmitting(false);
    }
  }

  function startTwitchLogin(): void {
    const params = new URLSearchParams(window.location.search);
    params.delete("viewer_twitch");
    const query = params.toString();
    const returnTo = `${window.location.pathname}${query ? `?${query}` : ""}`;
    trackGoogleAnalyticsEvent("twitch_click", { link_context: "viewer_login" });
    window.location.href = publicTwitchLoginUrl(returnTo);
  }

  function openStreamerRegisterScreen(): void {
    if (!twitchStatus.connected) {
      if (twitchStatus.configured) startTwitchLogin();
      return;
    }
    setStreamerRegisterOpen(true);
    setActiveNav("community");
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  function openStreamerRecord(): void {
    const request = twitchStatus.streamerRiotRequest;
    if (request?.status !== "approved") return;
    const riotId = `${request.riotGameName}#${request.riotTagLine}`;
    setStreamerRegisterOpen(false);
    setActiveMainPage("search");
    setQuery(riotId);
    void runSearch(riotId);
  }

  function searchFollowedRiotId(riotId: string): void {
    setStreamerRegisterOpen(false);
    setActiveMainPage("search");
    setActiveNav("search");
    setQuery(riotId);
    void runSearch(riotId);
  }

  function openCommunityPost(post: CommunityPost): void {
    setStreamerRegisterOpen(false);
    setSelectedCommunityPostId(post.id);
    setCommunityCommentError("");
    setActiveMainPage("communityDetail");
    setActiveNav("community");
    setPublicPath(publicPathForPage("communityDetail", { postId: post.id }) ?? "/community/server");
    void loadCommunityPostProfile(post);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  function openSearchPanelTab(tab: SearchFormPanelRequest["tab"]): void {
    setStreamerRegisterOpen(false);
    setSelectedCommunityPostId(undefined);
    setCommunityPostProfile({ status: "idle" });
    setCommunityCommentError("");
    setActiveMainPage("search");
    setActiveNav("search");
    if (!profile) setPublicPath("/");
    setSearchPanelRequest((current) => ({
      tab,
      nonce: (current?.nonce ?? 0) + 1
    }));
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.getElementById("public-search-input")?.focus();
      document.getElementById("public-ranking-search-input")?.focus();
    }, 0);
  }

  function changeMainPage(page: PublicMainPage): void {
    if (page === "search") {
      resetHome();
      window.setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        document.getElementById("public-search-input")?.focus();
      }, 0);
      return;
    }
    if (page !== "communityDetail") {
      setSelectedCommunityPostId(undefined);
      setCommunityPostProfile({ status: "idle" });
      setCommunityCommentError("");
    }
    setActiveMainPage(page);
    setStreamerRegisterOpen(false);
    const legalPath = publicLegalPath(page);
    if (legalPath) {
      setActiveNav("search");
      setPublicPath(legalPath);
    } else {
      setActiveNav(page === "palworld" ? "search" : "community");
      const pagePath = publicPathForPage(page);
      if (pagePath) setPublicPath(pagePath);
    }
    if (legalPath) {
      // 법적 페이지는 공개 정적 성격의 화면이라 별도 데이터 로딩이 필요하지 않습니다.
    }
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
  }

  async function disconnectTwitchViewer(): Promise<void> {
    await logoutPublicTwitch();
    setTwitchStatus({
      connected: false,
      configured: true,
      requiredScopes: ["user:read:follows", "user:read:subscriptions"],
      missingScopes: ["user:read:follows", "user:read:subscriptions"]
    });
    setFollowedLol(null);
    setPublicParticipation(null);
    setPublicParticipationMessage("");
    setPublicParticipationJoinRiotId("");
    setStreamerRegisterOpen(false);
  }

  function toggleFavorite(): void {
    if (!profile) return;
    const favorite = favoriteFromProfile(profile);
    const active = isFavoriteProfile(favorites, profile);
    const next = active
      ? favorites.filter((item) => normalizeSuggestionKey(item) !== normalizeSuggestionKey(favorite))
      : prependFavorite(favorites, favorite);
    writeFavorites(next);
    setFavorites(next);
    if (!active) {
      trackGoogleAnalyticsEvent("streamer_follow", {
        favorite_type: profile.twitchStream ? "registered_streamer" : "summoner"
      });
    }
  }

  async function runSearch(
    value: string,
    options: { updateUrl?: boolean; replaceUrl?: boolean; refresh?: boolean; platform?: LolPlatformId } = {}
  ): Promise<void> {
    const requestedPlatform = options.platform ?? selectedLolPlatform;
    const riotId = riotIdQuery(value, requestedPlatform);
    if (!riotId) return;
    const updateUrl = options.updateUrl !== false;
    profileSearchAbortRef.current?.abort();
    loadMoreAbortRef.current?.abort();
    queueFilterAbortRef.current?.abort();
    loadMoreAbortRef.current = undefined;
    queueFilterAbortRef.current = undefined;
    loadMoreInFlightKeyRef.current = undefined;
    loadMoreSequenceRef.current += 1;
    queueFilterSequenceRef.current += 1;
    setLoadingMoreMatches(false);
    setLoadingQueueMatches(false);
    setQueueMatchPages({});
    if (options.refresh) invalidatePublicLolMatchPageCache(riotId, requestedPlatform);
    const controller = new AbortController();
    const requestSequence = profileSearchSequenceRef.current + 1;
    profileSearchAbortRef.current = controller;
    profileSearchSequenceRef.current = requestSequence;
    setLoading(true);
    setError("");
    setMoreMatchesError("");
    try {
      const result = await searchProfile(riotId, {
        refresh: options.refresh,
        signal: controller.signal,
        platform: requestedPlatform
      });
      if (requestSequence !== profileSearchSequenceRef.current) return;
      setProfile((current) => options.refresh
        ? profileWithPreservedStreamerStateAfterRefresh(current, result)
        : result);
      setNowTick(Date.now());
      setProfileTab("overview");
      setFilters(DEFAULT_MATCH_FILTERS);
      setStreamerRegisterOpen(false);
      setActiveMainPage("search");
      setActiveNav("search");
      setQuery(result.riotId);
      const resultPlatform = normalizeLolPlatformId(result.lolPlatform) ?? requestedPlatform;
      setSelectedLolPlatform(resultPlatform);
      if (updateUrl) setPublicPath(publicSummonerPath(result.riotId, resultPlatform), options.replaceUrl);
      saveRecentSearch(result);
      setRecentSearches(readRecentSearches());
      setFavorites((current) => {
        const favorite = favoriteFromProfile(result);
        if (!current.some((item) => normalizeSuggestionKey(item) === normalizeSuggestionKey(favorite))) return current;
        const next = prependFavorite(current, favorite);
        writeFavorites(next);
        return next;
      });
    } catch (requestError) {
      if (controller.signal.aborted || requestSequence !== profileSearchSequenceRef.current) return;
      if (!options.refresh) setProfile(null);
      setError(requestError instanceof Error ? requestError.message : t().searchFailed);
    } finally {
      if (requestSequence === profileSearchSequenceRef.current) {
        profileSearchAbortRef.current = undefined;
        setLoading(false);
      }
    }
  }

  async function loadMoreRecentMatches(): Promise<void> {
    if (!profile || loadingMoreMatches || loadingQueueMatches) return;
    const queue = filters.queue;
    const activePage = queue === "all" ? undefined : queueMatchPages[queue];
    const pagination = activePage ?? profile;
    if (queue !== "all" && !activePage) return;
    if (!pagination.hasMoreRecentMatches) return;
    const nextStart = pagination.nextRecentMatchStart ?? pagination.recentMatches.length;
    const platform = normalizeLolPlatformId(profile.lolPlatform) ?? selectedLolPlatform;
    const requestKey = `${platform}:${profile.riotId}:${queue}:${nextStart}`;
    if (loadMoreInFlightKeyRef.current === requestKey) return;
    loadMoreAbortRef.current?.abort();
    const controller = new AbortController();
    const requestSequence = loadMoreSequenceRef.current + 1;
    loadMoreAbortRef.current = controller;
    loadMoreSequenceRef.current = requestSequence;
    loadMoreInFlightKeyRef.current = requestKey;
    setLoadingMoreMatches(true);
    setMoreMatchesError("");
    try {
      const page = await getPublicLolMatchPage(profile.riotId, nextStart, platform, controller.signal, queue);
      if (controller.signal.aborted || requestSequence !== loadMoreSequenceRef.current) return;
      if (queue === "all") {
        setProfile((current) => {
          if (!current || current.riotId !== profile.riotId || normalizeLolPlatformId(current.lolPlatform) !== platform) return current;
          return profileWithAdditionalMatchPage(current, page);
        });
      } else {
        setQueueMatchPages((current) => {
          const currentPage = current[queue];
          return currentPage
            ? { ...current, [queue]: matchPageWithAdditionalPage(currentPage, page) }
            : { ...current, [queue]: page };
        });
      }
    } catch (requestError) {
      if (controller.signal.aborted || requestSequence !== loadMoreSequenceRef.current) return;
      setMoreMatchesError(requestError instanceof Error ? requestError.message : t().searchFailed);
    } finally {
      if (loadMoreAbortRef.current === controller) loadMoreAbortRef.current = undefined;
      if (loadMoreInFlightKeyRef.current === requestKey) loadMoreInFlightKeyRef.current = undefined;
      if (requestSequence === loadMoreSequenceRef.current) setLoadingMoreMatches(false);
    }
  }

  function prefetchNextRecentMatches(): void {
    if (!profile || loadingMoreMatches || loadingQueueMatches) return;
    const queue = filters.queue;
    const activePage = queue === "all" ? undefined : queueMatchPages[queue];
    const pagination = activePage ?? profile;
    if (queue !== "all" && !activePage) return;
    if (!pagination.hasMoreRecentMatches) return;
    const nextStart = pagination.nextRecentMatchStart ?? pagination.recentMatches.length;
    const platform = normalizeLolPlatformId(profile.lolPlatform) ?? selectedLolPlatform;
    void prefetchPublicLolMatchPage(profile.riotId, nextStart, platform, queue).catch(() => undefined);
  }

	  function searchRiotId(riotId: string): void {
    setQuery(riotId);
    void runSearch(riotId);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const riotIdInput = event.currentTarget.elements.namedItem("riotId");
    const riotId = riotIdInput instanceof HTMLInputElement ? riotIdInput.value : query;
    setQuery(riotId);
    await runSearch(riotId);
  }

  function pickSuggestion(suggestion: SearchSuggestion): void {
    const riotId = suggestionRiotId(suggestion);
    const platform = normalizeLolPlatformId(suggestion.lolPlatform) ?? selectedLolPlatform;
    setSelectedLolPlatform(platform);
    setQuery(riotId);
    void runSearch(riotId, { platform });
  }

  function changeLolPlatform(platform: LolPlatformId): void {
    if (platform === selectedLolPlatform) return;
    profileSearchAbortRef.current?.abort();
    profileSearchAbortRef.current = undefined;
    profileSearchSequenceRef.current += 1;
    loadMoreAbortRef.current?.abort();
    queueFilterAbortRef.current?.abort();
    loadMoreAbortRef.current = undefined;
    queueFilterAbortRef.current = undefined;
    loadMoreInFlightKeyRef.current = undefined;
    loadMoreSequenceRef.current += 1;
    queueFilterSequenceRef.current += 1;
    setSelectedLolPlatform(platform);
    setLoading(false);
    setLoadingMoreMatches(false);
    setLoadingQueueMatches(false);
    setQueueMatchPages({});
    setMoreMatchesError("");
    setRemoteSuggestions([]);
    setError("");
    if (profile && normalizeLolPlatformId(profile.lolPlatform) !== platform) {
      setProfile(null);
      setFilters(DEFAULT_MATCH_FILTERS);
      setPublicPath("/", true);
    }
  }

	  function clearSearch(): void {
	    setQuery("");
	    setError("");
    setMoreMatchesError("");
	    setRemoteSuggestions([]);
	  }

	  function resetHome(): void {
	    setProfile(null);
	    setError("");
    setMoreMatchesError("");
    setQueueMatchPages({});
    setLoadingQueueMatches(false);
    setFilters(DEFAULT_MATCH_FILTERS);
    setStreamerRegisterOpen(false);
    setSelectedCommunityPostId(undefined);
    setCommunityPostProfile({ status: "idle" });
    setActiveMainPage("search");
    setActiveNav("search");
    setPublicPath("/");
  }

  function navigatePublic(target: PublicNavTarget): void {
    setStreamerRegisterOpen(false);
    setActiveNav(target);
    if (profile) {
      if (target === "champion") setProfileTab("champions");
      if (target === "ingame") setProfileTab("ingame");
      if (target === "ranking" || target === "stats") setProfileTab("overview");
    }
    const targetId = !profile || target === "search"
      ? "public-search"
      : target === "ranking"
        ? "public-ranking"
        : target === "champion"
          ? "public-champions"
          : target === "ingame"
            ? "public-ingame"
            : target === "community"
              ? "public-saved-data"
              : target === "promotion"
              ? "public-more-features"
              : "public-stats";
    window.setTimeout(() => {
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        if (targetId === "public-search") document.getElementById("public-search-input")?.focus();
      }
    }, 0);
  }

  function renderMainMenuPage() {
    if (activeMainPage === "palworld") {
      return (
        <section
          className="public-game-empty-page"
          aria-label={t().palworld}
          data-ko={publicI18n.ko.palworld}
          data-ja={publicI18n.ja.palworld}
        />
      );
    }
    if (activeMainPage === "privacy" || activeMainPage === "terms" || activeMainPage === "contact") {
      return <PublicLegalPage page={activeMainPage} />;
    }
    if (activeMainPage === "subscriptions") {
      return (
        <PublicSubscriptionsPage
          twitchStatus={twitchStatus}
          followed={followedLol}
          loading={followedLoading || twitchOAuthSettling}
          error={twitchOAuthSettling ? "" : followedError}
          onLogin={startTwitchLogin}
          onRefresh={() => void loadFollowedLol(true, true)}
          onSearch={searchFollowedRiotId}
        />
      );
    }
    if (activeMainPage === "followJoin") {
      return (
        <PublicParticipationJoinPage
          status={twitchStatus}
          participation={publicParticipation}
          discovery={publicParticipationDiscovery}
          loading={publicParticipationLoading}
          error={publicParticipationError}
          riotId={publicParticipationJoinRiotId}
          role={publicParticipationJoinRole}
          joining={publicParticipationJoining}
          cancelling={publicParticipationCancelling}
          message={publicParticipationMessage}
          selectedStreamerId={publicParticipationStreamerId}
          onRefresh={() => void loadPublicParticipationState()}
          onLogin={startTwitchLogin}
          onStreamerClear={clearPublicParticipationStreamer}
          onStreamerSelect={selectPublicParticipationStreamer}
          onRiotIdChange={setPublicParticipationJoinRiotId}
          onRoleChange={setPublicParticipationJoinRole}
          onSubmit={submitPublicParticipation}
          onCancel={() => void cancelPublicParticipation()}
        />
      );
    }
    if (activeMainPage === "aram") {
      return <PublicAramPage />;
    }
    if (activeMainPage === "patch" || activeMainPage === "communityParty") {
      const category = communityPageCategory(activeMainPage);
      return (
        <PublicCommunityPage
          category={category}
          twitchStatus={twitchStatus}
          posts={communityPosts}
          loading={communityLoading}
          error={communityError}
          toast={communityToast}
          onRefresh={() => void loadCommunityPosts(category)}
          onWrite={() => changeMainPage(category === "party" ? "communityPartyWrite" : "communityServerWrite")}
          onOpenPost={openCommunityPost}
          onDismissToast={() => setCommunityToast(null)}
        />
      );
    }
    if (activeMainPage === "communityServerWrite" || activeMainPage === "communityPartyWrite") {
      const category = communityPageCategory(activeMainPage);
      const editingPost = category === "server" && twitchStatus.user
        ? communityPosts.find((post) => post.authorTwitchUserId === twitchStatus.user?.id && communityPostCategory(post) === "server")
        : undefined;
      return (
        <PublicCommunityWritePage
          category={category}
          twitchStatus={twitchStatus}
          posts={communityPosts}
          editingPost={editingPost}
          error={communityError}
          submitting={communitySubmitting}
          toast={communityToast}
          onLogin={startTwitchLogin}
          onBack={() => changeMainPage(category === "party" ? "communityParty" : "patch")}
          onSubmit={(input) => editingPost ? updateCommunityServerPost(editingPost.id, input) : submitCommunityPost(input)}
          onDismissToast={() => setCommunityToast(null)}
        />
      );
    }
    if (activeMainPage === "communityDetail") {
      return (
        <PublicCommunityDetailPage
          post={selectedCommunityPost}
          profileState={communityPostProfile}
          twitchStatus={twitchStatus}
          commentSubmitting={communityCommentSubmitting}
          commentError={communityCommentError}
          reportSubmitting={communityReportSubmitting}
          reportError={communityReportError}
          toast={communityToast}
          onLogin={startTwitchLogin}
          onBack={() => changeMainPage(communityPostCategory(selectedCommunityPost) === "party" ? "communityParty" : "patch")}
          onSearchRiotId={searchFollowedRiotId}
          onSubmitComment={submitCommunityComment}
          onSubmitReport={submitCommunityReport}
          onDismissToast={() => setCommunityToast(null)}
        />
      );
    }
    return null;
  }

  if (streamerRegisterOpen) {
    return (
      <AppShell
        className={`public-lol-shell public-dashboard-shell public-home-shell theme-${theme}`}
        mainId="public-streamer-register-main"
        sidebarMode="none"
        skipLinkLabel={t().skipToContent}
        variant="public"
      >
        <AppShellHeader as="div">
          <PublicAppHeader
            locale={locale}
            profile={profile}
            twitchStatus={twitchStatus}
            activePage={activeMainPage}
            activeTarget={activeNav}
            onHome={() => changeMainPage("search")}
            showSearch={false}
            showFilters={false}
            query={query}
            loading={loading}
            platform={selectedLolPlatform}
            platformOptions={platformOptions}
            suggestions={visibleSuggestions}
            recentSearches={recentSearches}
            favorites={favorites}
            searchPanelRequest={searchPanelRequest}
            filters={filters}
            champions={availableChampions}
            onQuery={setQuery}
            onPlatformChange={changeLolPlatform}
            onClear={clearSearch}
            onSubmit={(event) => void submit(event)}
            onPickSuggestion={pickSuggestion}
            onPage={changeMainPage}
            onLocale={changeLocale}
            onAutoLocale={autoDetectLocale}
            onTwitchLogin={startTwitchLogin}
            onStreamerRegister={openStreamerRegisterScreen}
            onStreamerRecord={openStreamerRecord}
            onTwitchLogout={() => void disconnectTwitchViewer()}
            onFilters={setFilters}
            onResetFilters={() => setFilters(DEFAULT_MATCH_FILTERS)}
          />
        </AppShellHeader>
        <AppShellMain className="public-app-main" id="public-streamer-register-main">
          <PublicStreamerRegistrationScreen
            status={twitchStatus}
            onLogin={startTwitchLogin}
            onBack={() => setStreamerRegisterOpen(false)}
            onSubmitted={(request) => {
              setTwitchStatus((current) => ({ ...current, streamerRiotRequest: request }));
              void loadFollowedLol(true);
            }}
          />
        </AppShellMain>
        <PublicSiteFooter onPage={changeMainPage} text={publicSiteFooterText()} />
        <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
      </AppShell>
    );
  }

  if (!profile && activeMainPage === "search" && !loading) {
    return (
      <AppShell
        className={`public-lol-shell public-dashboard-shell public-home-shell public-home-shared-shell theme-${theme}`}
        mainId="public-search-main"
        sidebarMode="none"
        skipLinkLabel={t().skipToContent}
        variant="public"
      >
        <AppShellHeader as="div" className="public-home-shared-header">
          <PublicAppHeader
            locale={locale}
            profile={profile}
            twitchStatus={twitchStatus}
            activePage={activeMainPage}
            activeTarget={activeNav}
            onHome={() => changeMainPage("search")}
            showSearch={false}
            showFilters={false}
            query={query}
            loading={loading}
            platform={selectedLolPlatform}
            platformOptions={platformOptions}
            suggestions={visibleSuggestions}
            recentSearches={recentSearches}
            favorites={favorites}
            searchPanelRequest={searchPanelRequest}
            filters={filters}
            champions={availableChampions}
            onQuery={setQuery}
            onPlatformChange={changeLolPlatform}
            onClear={clearSearch}
            onSubmit={(event) => void submit(event)}
            onPickSuggestion={pickSuggestion}
            onPage={changeMainPage}
            onLocale={changeLocale}
            onAutoLocale={autoDetectLocale}
            onTwitchLogin={startTwitchLogin}
            onStreamerRegister={openStreamerRegisterScreen}
            onStreamerRecord={openStreamerRecord}
            onTwitchLogout={() => void disconnectTwitchViewer()}
            onFilters={setFilters}
            onResetFilters={() => setFilters(DEFAULT_MATCH_FILTERS)}
          />
        </AppShellHeader>
        <AppShellMain className="public-home-shared-main" id="public-search-main">
          <PublicHomeSearchPanel
            liveLoading={followedLoading || twitchOAuthSettling}
            liveStreamers={homeLiveStreamers}
            loading={loading}
            onPage={changeMainPage}
            onShowStreamers={() => changeMainPage("subscriptions")}
            searchForm={
              <SearchForm
                loading={loading}
                platform={selectedLolPlatform}
                platformOptions={platformOptions}
                onClear={clearSearch}
                onPickSuggestion={pickSuggestion}
                onQuery={setQuery}
                onPlatformChange={changeLolPlatform}
                onSubmit={(event) => void submit(event)}
                query={query}
                suggestions={visibleSuggestions}
                recentSearches={recentSearches}
                favorites={favorites}
                panelRequest={searchPanelRequest}
                variant="homeShared"
              />
            }
            text={publicHomeSearchPanelText(selectedLolPlatform, locale)}
          />
        </AppShellMain>
        <PublicSiteFooter onPage={changeMainPage} text={publicSiteFooterText()} />
        <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
      </AppShell>
    );
  }

  if (activeMainPage !== "search" || !profile) {
    return (
      <AppShell
        className={`public-lol-shell public-dashboard-shell theme-${theme}`}
        mainId="public-main"
        sidebarMode="none"
        skipLinkLabel={t().skipToContent}
        variant="public"
      >
        <AppShellHeader as="div" className="public-standard-header-frame">
          <PublicAppHeader
            locale={locale}
            profile={profile}
            twitchStatus={twitchStatus}
            activePage={activeMainPage}
            activeTarget={activeNav}
            onHome={() => changeMainPage("search")}
            showFilters={false}
            query={query}
            loading={loading}
            platform={selectedLolPlatform}
            platformOptions={platformOptions}
            suggestions={visibleSuggestions}
            recentSearches={recentSearches}
            favorites={favorites}
            searchPanelRequest={searchPanelRequest}
            filters={filters}
            champions={availableChampions}
            onQuery={setQuery}
            onPlatformChange={changeLolPlatform}
            onClear={clearSearch}
            onSubmit={(event) => void submit(event)}
            onPickSuggestion={pickSuggestion}
            onPage={changeMainPage}
            onLocale={changeLocale}
            onAutoLocale={autoDetectLocale}
            onTwitchLogin={startTwitchLogin}
            onStreamerRegister={openStreamerRegisterScreen}
            onStreamerRecord={openStreamerRecord}
            onTwitchLogout={() => void disconnectTwitchViewer()}
            onFilters={setFilters}
            onResetFilters={() => setFilters(DEFAULT_MATCH_FILTERS)}
          />
        </AppShellHeader>
        <AppShellMain className="public-app-main" id="public-main">
          {loading ? <SeigaSearchLoader /> : null}
          <div className="public-profile-layout">
            <div className="public-dashboard-content-grid">
              <section className="public-dashboard-center">
                {error ? <p className="public-error">{error}</p> : null}
                {renderMainMenuPage()}
              </section>
            </div>
          </div>
        </AppShellMain>
        <PublicSiteFooter onPage={changeMainPage} text={publicSiteFooterText()} />
        <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
      </AppShell>
    );
  }

  const activeProfile = visibleProfile ?? profile;
  const favoriteActive = isFavoriteProfile(favorites, profile);

  return (
    <AppShell
      className={`public-lol-shell public-dashboard-shell public-profile-shared-shell ${activeProfile ? "public-profile-platform-v2" : ""} theme-${theme}`}
      mainId="public-profile-main"
      sidebarMode="none"
      skipLinkLabel={t().skipToContent}
      variant="public"
    >
      <AppShellHeader as="div" className="public-profile-shared-header public-standard-header-frame">
        <PublicAppHeader
          locale={locale}
          profile={profile}
          twitchStatus={twitchStatus}
          activePage={activeMainPage}
          activeTarget={activeNav}
          onHome={() => changeMainPage("search")}
          showFilters={false}
          query={query}
          loading={loading}
          platform={selectedLolPlatform}
          platformOptions={platformOptions}
          suggestions={visibleSuggestions}
          recentSearches={recentSearches}
          favorites={favorites}
          searchPanelRequest={searchPanelRequest}
          filters={filters}
          champions={availableChampions}
          onQuery={setQuery}
          onPlatformChange={changeLolPlatform}
          onClear={clearSearch}
          onSubmit={(event) => void submit(event)}
          onPickSuggestion={pickSuggestion}
          onPage={changeMainPage}
          onLocale={changeLocale}
          onAutoLocale={autoDetectLocale}
          onTwitchLogin={startTwitchLogin}
          onStreamerRegister={openStreamerRegisterScreen}
          onStreamerRecord={openStreamerRecord}
          onTwitchLogout={() => void disconnectTwitchViewer()}
          onFilters={setFilters}
          onResetFilters={() => setFilters(DEFAULT_MATCH_FILTERS)}
        />
      </AppShellHeader>
      <AppShellMain className="public-profile-shared-main" id="public-profile-main">
        <div className="public-profile-layout">
          <div className="public-dashboard-content-grid">
            <section className="public-dashboard-center">
              {activeMainPage === "search" ? (
                <>
                  <ProfileTopPanel
                    profile={activeProfile}
                    loading={loading}
                    favoriteActive={favoriteActive}
                    refreshRemaining={refreshRemaining}
                    onRefresh={() => void runSearch(profile.riotId, { refresh: true })}
                    onOpenParticipation={() => changeMainPage("followJoin")}
                    participationOpen={Boolean(publicParticipation?.streamers.some((streamer) => (
                      streamer.isOpen
                      && streamer.twitchUserId === activeProfile.twitchStream?.twitchUserId
                    )))}
                    onToggleFavorite={toggleFavorite}
                    tabs={<PublicProfileTabs activeTab={profileTab} onChange={setProfileTab} onParticipation={() => changeMainPage("followJoin")} />}
                  />
                  <PublicProfileErrorState error={error} />

                  {profileTab === "overview" ? (
                    <div className="public-overview-search-layout">
                      <OverviewMetricPanel profile={activeProfile} />
                      <div className="public-overview-results-column">
                        <RecentMatches
                          profile={activeProfile}
                          filters={filters}
                          champions={availableChampions}
                          onSearchRiotId={searchRiotId}
                          onFilters={setFilters}
                          onResetFilters={() => setFilters(DEFAULT_MATCH_FILTERS)}
                          onLoadMore={() => void loadMoreRecentMatches()}
                          onLoadMoreIntent={prefetchNextRecentMatches}
                          loadingMore={loadingMoreMatches || loadingQueueMatches}
                          moreError={moreMatchesError}
                        />
                      </div>
                    </div>
                  ) : null}

                  {profileTab === "champions" ? (
                    <>
                      <ChampionMastery profile={activeProfile} />
                      <DetailedPerformance profile={activeProfile} />
                    </>
                  ) : null}

	                {profileTab === "ingame" ? (
	                  <>
		                    <IngamePanel profile={activeProfile} onSearchRiotId={searchRiotId} />
	                  </>
                  ) : null}

                  <PublicMoreFeatures />
                </>
              ) : (
                <>
                  <PublicProfileErrorState error={error} />
                  {renderMainMenuPage()}
                </>
              )}
            </section>
          </div>
        </div>
      </AppShellMain>
      <PublicSiteFooter onPage={changeMainPage} text={publicSiteFooterText()} />
      <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
    </AppShell>
  );
}
