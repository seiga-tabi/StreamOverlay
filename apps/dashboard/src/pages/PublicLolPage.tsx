import { LolChrome, lolSubnavActive } from "../features/public-home/components/LolChrome";
import { LolBottomTabBar } from "../features/public-home/components/HomeTabBar";
import { lolHomeI18n } from "../features/public-home/i18n/lol-home-i18n";
import { Fragment, useEffect, useId, useMemo, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import {
  normalizeLolPlatformId,
  parseRiotIdDetailed,
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
  getPublicTwitchFollowedChannels,
  getPublicTwitchStatus,
  logoutPublicTwitch,
  peekPublicTwitchFollowedChannels,
  peekPublicTwitchStatus,
} from "../features/public-twitch/api";
import { safeTwitchStreamPreviewUrl } from "../features/public-twitch/stream-preview";
import { useViewerTwitchOAuthReturn } from "../shared/useViewerTwitchOAuthReturn";
import { usePublicAccountLogin } from "../shared/public-account-login";
import { withLolDailySummaryBars } from "../features/public-lol/components/LolDailySummaryBar";
import { LolAugmentIcon } from "../features/public-lol/components/LolAugmentIcon";
import { publicLiveText } from "../shared/public-live-streamers";
import { streamerBuckets, type StreamerFilter } from "../features/public-lol/utils/streamers";
import { arenaPlacementClass, isArenaQueue, matchGap } from "../features/public-lol/utils/match-lanes";
import {
  ProfileShareActions,
  type ProfileShareCard,
  type ProfileShareLane,
  type ProfileShareNotice,
} from "../features/public-lol/components/ProfileShareActions";
import { profileShareLanes } from "../features/public-lol/utils/profile-share";
import { RecentMatchesShareActions, type RecentMatchShareItem } from "../features/public-lol/components/RecentMatchesShareActions";
import { ArenaStandings } from "../features/public-lol/components/ArenaStandings";
import { ProfileLinkIcon, profileLinkPlatformFromUrl, profileLinkPlatformClass } from "../components/ProfileLinkIcon";
import { AppShell, AppShellMain, AppShellSidebar } from "../shared/ui/AppShell";
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
  PublicBottomTabBar,
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
  ProfilePlaytimeCard as FeatureProfilePlaytimeCard,
  ProfileRoleCard as FeatureProfileRoleCard,
  ProfileStreamerCast as FeatureProfileStreamerCast,
  ProfileMetricStrip as FeatureProfileMetricStrip,
  ProfileTopPanel as FeatureProfileTopPanel,
  PublicProfileShareButton,
  MatchBuildBoard as FeatureMatchBuildBoard,
  RecentMatchBuildRuneBoard as FeatureRecentMatchBuildRuneBoard,
  MatchTeamDetails as FeatureMatchTeamDetails,
  LpTrendLineChart,
  RecentMatchBuildPanel as FeatureRecentMatchBuildPanel,
  RecentMatchExpandedPanel as FeatureRecentMatchExpandedPanel,
  RecentMatchRow as FeatureRecentMatchRow,
  recentMatchScoreGrade,
  RecentMatchesPanel as FeatureRecentMatchesPanel,
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
import { platformTimezoneLabel, playtimeSummary, type PlaytimeBandKey } from "../features/public-lol/utils/playtime";
import { publicContentLocale,
  activePublicLocale,
  publicI18n,
  publicJaText,
  publicKoText,
  publicText,
  setActivePublicLocale,
  t,
  type PublicLocale,
  type PublicTextKey, publicIntlLocale, publicLocaleText, } from "../features/public-lol/i18n/public-lol-i18n";
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
  publicSummonerTokenPath,
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
  PUBLIC_LOL_HOME_PATH,
  publicLegalPath,
  publicPageRouteFromPath,
  publicPathForPage,
  setPublicPath,
  type PublicLegalPageKey,
} from "../features/public-lol/utils/routes";
import { PublicAramPage } from "../features/public-lol/pages/PublicAramPage";
import { PublicPatchNotesPage } from "../features/public-lol/pages/PublicPatchNotesPage";
import {
  favoriteFromProfile,
  isFavoriteProfile,
  prependFavorite,
  readFavorites,
  readRecentSearches,
  saveRecentSearch,
  writeFavorites,
} from "../features/public-lol/utils/storage";
import { readMiniGameBest, reactionTierLabel, REACTION_TIER_TABLE } from "../features/public-games/registry";
import { usePublicLocale } from "../features/public-lol/hooks/usePublicLocale";
import { usePublicTheme } from "../features/public-lol/hooks/usePublicTheme";
import {
  championAnalysisTableRows,
  championSpotlights,
  isBootItem,
  SIGNATURE_BUILD_MAX_ITEMS,
  signatureBuilds,
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
  55: "Summoner_UltBookSmitePlaceholder",
  /* 아레나 전용(2026-08-18 실측 — 미매핑으로 스펠이 숫자로 노출되던 결함). */
  2201: "SummonerCherryHold",
  2202: "SummonerCherryFlash"
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
  return option ? option[publicContentLocale(activePublicLocale)] : value;
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

/* LoL 로컬 표는 ko·ja 만 유지 — en 은 publicContentLocale 축소로 ko 폴백(팰월드 우선 단계). */
const queueLabels: Record<"ko" | "ja" | "en", Record<number, string>> = {
  ko: {
    6: "5v5 랭크",
    42: "5v5 랭크",
    /* 710 = 신규 특별 랭크 모드(2026-08-17 맹금류애니비아 실데이터로 확인) */
    710: "5vs5 랭크",
    2300: "증강 칼바람",
    /* 아레나 명칭은 cdragon queues.json 공식 표기(2026-08-18 확인). */
    1700: "아레나",
    1710: "아레나",
    1750: "아레나 3x6",
    400: "일반 교차",
    420: "솔로랭크",
    430: "일반",
    440: "자유랭크",
    450: "칼바람"
  },
  ja: {
    6: "5v5 ランク",
    42: "5v5 ランク",
    710: "5vs5 ランク",
    2300: "オーグメントARAM",
    1700: "アリーナ",
    1710: "アリーナ",
    1750: "アリーナ 3x6",
    400: "ノーマルドラフト",
    420: "ソロランク",
    430: "ノーマル",
    440: "フレックスランク",
    450: "ランダムミッド"
  },
  en: {
    6: "5v5 Ranked",
    42: "5v5 Ranked",
    710: "5vs5 Ranked",
    2300: "Augment ARAM",
    1700: "Arena",
    1710: "Arena",
    1750: "Arena 3x6",
    400: "Normal Draft",
    420: "Ranked Solo",
    430: "Normal",
    440: "Ranked Flex",
    450: "ARAM"
  }
};

const roleLabels: Record<"ko" | "ja" | "en", Record<string, string>> = {
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
  },
  en: {
    TOP: "Top",
    JUNGLE: "Jungle",
    MIDDLE: "Mid",
    MID: "Mid",
    BOTTOM: "ADC",
    ADC: "ADC",
    UTILITY: "Support",
    SUPPORT: "Support",
    FILL: "Fill",
    UNKNOWN: "Unknown"
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

const objectiveLabels: Record<"ko" | "ja", Record<string, string>> = {
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

/* 증강 숫자 id → 픽·승 집계(아수라장 큐 2300 매치만) — 도감 카드 "내 전적" 배지의 데이터원. */
export function aramAugmentStatsFromMatches(
  matches: readonly PublicLolRecentMatch[],
): Map<number, { picks: number; wins: number }> {
  const stats = new Map<number, { picks: number; wins: number }>();
  for (const match of matches) {
    if (match.queueId !== 2300 || !match.augments) continue;
    for (const augmentId of match.augments) {
      const entry = stats.get(augmentId) ?? { picks: 0, wins: 0 };
      entry.picks += 1;
      if (match.result === "win") entry.wins += 1;
      stats.set(augmentId, entry);
    }
  }
  return stats;
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

/** 매치 행·공유 이미지의 승패 1글자 라벨 — 승/패·勝/敗·W/L(en 은 slice 로 만들면
    "Victory"→"V" 가 되어 게임 관례(W/L)와 어긋나 전용 키를 씁니다). */
function resultShortLabel(result: PublicLolRecentMatch["result"]): string {
  if (result === "win") return t().winShort;
  if (result === "loss") return t().lossShort;
  return "—";
}

function formatDate(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(publicIntlLocale(), { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatMatchDate(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(publicIntlLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatMatchTime(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(publicIntlLocale(), {
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
  return publicLocaleText(`${minutes}분`, `${minutes}分`, `${minutes}m`);
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
  /* en — 응답에 영문 표시명이 따로 없어 Data Dragon championKey("MissFortune")를
     대문자 경계로 띄웁니다. 아포스트로피류(Kha'Zix 등)는 근사 표기입니다. */
  if (locale === "en") {
    const englishName = champion.championKey?.replace(/([a-z])([A-Z])/g, "$1 $2");
    return englishName ?? champion.nameKo ?? champion.nameJa ?? `Champion ${champion.championId}`;
  }
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
    .map(([key, value]) => `${objectiveLabels[publicContentLocale(activePublicLocale)][key] ?? key} ${value}`);
  return entries.length > 0 ? entries.join(" · ") : "-";
}

function objectiveSummaryByOrder(objectives: Record<string, number> | undefined, keys: string[]): string {
  const entries = keys
    .map((key) => [key, objectives?.[key] ?? 0] as const)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${objectiveLabels[publicContentLocale(activePublicLocale)][key] ?? key} ${value}`);
  return entries.length > 0 ? entries.join(" · ") : "-";
}

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
  return publicLocaleText(`${wins}승 ${losses}패`, `${wins}勝 ${losses}敗`, `${wins}W ${losses}L`);
}

function gamesText(games: number): string {
  return `${games}${t().games}`;
}

function winsText(wins: number): string {
  return publicLocaleText(`${wins}승`, `${wins}勝`, `${wins}W`);
}

function ladderRankText(rank: number | undefined): string | undefined {
  if (!rank) return undefined;
  return publicLocaleText(`${t().ladderRank} ${formatNumber(rank)}위`, `${t().ladderRank} ${formatNumber(rank)}位`, `${t().ladderRank} #${formatNumber(rank)}`);
}

function perMinuteText(label: string, value: number | undefined, digits?: number): string {
  const formatted = digits === undefined ? formatNumber(value) : formatDecimal(value, digits);
  return publicLocaleText(`분당 ${label} ${formatted}`, `分あたり${label} ${formatted}`, `${label}/min ${formatted}`);
}

function killParticipationText(value: number | undefined): string {
  return publicLocaleText(`킬 관여 ${formatPercent(value)}`, `キル関与 ${formatPercent(value)}`, `Kill participation ${formatPercent(value)}`);
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
  if (!champion) return publicLocaleText("챔피언 숙련도 데이터가 없습니다.", "チャンピオン熟練度データがありません。", "No champion mastery data.");
  return publicLocaleText(`${championName(champion)} 숙련도가 높습니다.`, `${championName(champion)}の熟練度が高いです。`, `High mastery on ${championName(champion)}.`);
}

function analysisMasteryBody(champion: LolChampionSummary): string {
  return activePublicLocale === "ja"
    ? `${formatNumber(champion.masteryPoints)} ${t().masteryPoint}を保有しています。`
    : `${formatNumber(champion.masteryPoints)} ${t().masteryPoint}를 보유하고 있습니다.`;
}

function analysisRecentTitle(winRate: number): string {
  return publicLocaleText(`최근 전적 승률은 ${winRate}%입니다.`, `最近の勝率は${winRate}%です。`, `Recent win rate is ${winRate}%.`);
}

function analysisRecentBody(profile: PublicLolProfile): string {
  return activePublicLocale === "ja"
    ? `${gamesText(profile.summary.recentGames)}中${winsText(profile.summary.recentWins)}、平均 ${formatDecimal(profile.summary.averageKda)} KDA、平均ダメージ ${formatNumber(profile.summary.averageDamagePerMinute)} DPMです。`
    : `${gamesText(profile.summary.recentGames)} 중 ${winsText(profile.summary.recentWins)}, 평균 ${formatDecimal(profile.summary.averageKda)} KDA, 평균 딜량 ${formatNumber(profile.summary.averageDamagePerMinute)} DPM입니다.`;
}

function analysisChampionTitle(item: PublicLolChampionPerformance | undefined): string {
  if (!item) return publicLocaleText("최근 챔피언 성과 데이터가 없습니다.", "最近のチャンピオン成績データがありません。", "No recent champion performance data.");
  return publicLocaleText(`최근에는 ${championName(item.champion)} 성과가 가장 많습니다.`, `最近は${championName(item.champion)}の成績が最も多いです。`, `${championName(item.champion)} has the most recent games.`);
}

function analysisChampionBody(item: PublicLolChampionPerformance): string {
  return activePublicLocale === "ja"
    ? `${gamesText(item.games)} ${winsText(item.wins)}、${formatDecimal(item.averageKda)} KDA、勝率 ${formatPercent(item.winRate)}です。`
    : `${gamesText(item.games)} ${winsText(item.wins)}, ${formatDecimal(item.averageKda)} KDA, 승률 ${formatPercent(item.winRate)}입니다.`;
}

function analysisRolePerformanceTitle(item: PublicLolRolePerformance | undefined): string {
  if (!item) return publicLocaleText("포지션별 상세 데이터가 없습니다.", "ロール別詳細データがありません。", "No per-role detail data.");
  return publicLocaleText(`${mainRoleLabel(item.role)} 포지션 표본이 가장 많습니다.`, `${mainRoleLabel(item.role)}のサンプルが最も多いです。`, `${mainRoleLabel(item.role)} has the largest sample.`);
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

/* Twitch 링크 t 파라미터("1h02m03s") — 서버 twitch-vod-index 와 같은 표기입니다. */
function replayTimestampParam(offsetSeconds: number): string {
  const safe = Math.max(0, Math.trunc(offsetSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${hours}h${String(minutes).padStart(2, "0")}m${String(seconds).padStart(2, "0")}s`;
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

/* 검색 로딩 스피너(12px 선 아이콘) — 상태는 아이콘이 아니라 문장이 말합니다(목업 "검색 중"). */
function SkeletonSpinnerIcon({ size = 12 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" viewBox="0 0 24 24" width={size}>
      <path d="M12 3 a 9 9 0 0 1 9 9" opacity=".9" />
      <circle cx="12" cy="12" r="9" opacity=".25" />
    </svg>
  );
}

/* 처음 여는 프로필은 티어를 모릅니다 — 특정 엠블럼 대신 같은 40×44 자리에
   중립 육각 실루엣만 둡니다(목업 "검색 중" §티어 ①). */
function SkeletonTierSilhouette() {
  return (
    <svg aria-hidden="true" fill="none" height="44" viewBox="0 0 40 44" width="40">
      <path d="M20 2 L37 12 V30 L20 42 L3 30 V12 Z" stroke="var(--profile-sk-hi)" strokeWidth="1.5" />
      <path d="M20 10 L29 16 V26 L20 32 L11 26 V16 Z" stroke="var(--profile-sk)" strokeWidth="1" />
    </svg>
  );
}

/* 검색 중 스켈레톤 — 목업 page-4 "검색 중 — 데스크톱/모바일". 완성 화면과 같은
   자리·같은 크기의 자리표시(전면 오버레이 금지). 탭은 데이터 없이도 그릴 수
   있으니 실물을 그리고, 스켈레톤 블록은 스크린리더가 읽지 않게 aria-hidden. */
function ProfileSearchSkeleton({ riotId }: { riotId: string }) {
  const statusText = riotId ? `${t().searchLoadingStatus} · ${riotId}` : t().searchLoadingStatus;
  const queueChips = [t().allQueues, t().normalQueue, t().soloQueue, t().flexQueue, t().ranked5v5, t().arenaQueue, t().aramQueue];
  const rankCard = (key: number) => (
    <div className="public-profile-skel-panel public-profile-skel-rank" key={key}>
      <span className="public-skel" style={{ width: "3.875rem", height: ".6875rem" }} />
      <div className="public-profile-skel-rank-row">
        <SkeletonTierSilhouette />
        <span className="public-skel public-skel--circle" style={{ width: "3rem", height: "3rem" }} />
        <div className="public-profile-skel-rank-copy">
          <span className="public-skel" style={{ width: "6.75rem", height: "1rem" }} />
          <span className="public-skel" style={{ width: "9.25rem", height: ".75rem" }} />
        </div>
      </div>
      <span className="public-skel" style={{ width: "100%", height: "2.25rem" }} />
    </div>
  );
  const matchRow = (key: number, dim: boolean) => (
    <div className={`public-profile-skel-panel public-profile-skel-row${dim ? " is-dim" : ""}`} key={key}>
      <div className="public-profile-skel-row-result">
        <span className="public-skel" style={{ width: "2.875rem", height: ".9375rem" }} />
        <span className="public-skel" style={{ width: "3.875rem", height: ".6875rem" }} />
        <span className="public-skel public-profile-skel-desktop" style={{ width: "4.375rem", height: ".6875rem" }} />
      </div>
      <span className="public-skel public-skel--circle" style={{ width: "2.75rem", height: "2.75rem", flex: "none" }} />
      <div className="public-profile-skel-row-copy">
        <span className="public-skel" style={{ width: "5.375rem", height: ".9375rem" }} />
        <span className="public-skel" style={{ width: "6.5rem", height: ".6875rem" }} />
      </div>
      <div className="public-profile-skel-row-copy public-profile-skel-desktop">
        <span className="public-skel" style={{ width: "7rem", height: ".75rem" }} />
        <span className="public-skel" style={{ width: "6rem", height: ".6875rem" }} />
      </div>
      <div aria-hidden="true" className="public-profile-skel-items public-profile-skel-desktop">
        {[0, 1, 2, 3, 4, 5].map((slot) => (
          <span className="public-skel" key={slot} style={{ width: "1.25rem", height: "1.25rem" }} />
        ))}
        <span className="public-skel public-skel--circle" style={{ width: "1.25rem", height: "1.25rem", marginLeft: ".375rem" }} />
      </div>
      <div className="public-profile-skel-row-teams">
        <span className="public-skel public-profile-skel-team public-profile-skel-desktop" />
        <span className="public-skel public-profile-skel-team" />
      </div>
    </div>
  );
  return (
    <div className="public-profile-skel">
      <div className="public-profile-skel-head">
        <span aria-hidden="true" className="public-skel public-skel--circle public-profile-skel-avatar" />
        <div className="public-profile-skel-name">
          <div aria-hidden="true" className="public-profile-skel-name-bars">
            <span className="public-skel" style={{ width: "9.5rem", height: "1.5rem" }} />
            <span className="public-skel" style={{ width: "3.25rem", height: ".9375rem" }} />
            <span className="public-skel" style={{ width: "2.125rem", height: "1.125rem" }} />
          </div>
          {/* 상태는 스피너가 아니라 문장으로 — 무엇을 기다리는지 여기서 읽힙니다. */}
          <p aria-live="polite" className="public-profile-skel-status" role="status">
            <SkeletonSpinnerIcon />
            {statusText}
          </p>
        </div>
        <div aria-hidden="true" className="public-profile-skel-actions">
          <span className="public-skel" style={{ width: "2.75rem", height: "2.75rem" }} />
          <span className="public-skel" style={{ width: "2.75rem", height: "2.75rem" }} />
          <span className="public-skel" style={{ width: "2.75rem", height: "2.75rem" }} />
          <span className="public-skel" style={{ width: "6.75rem", height: "2.75rem" }} />
        </div>
      </div>

      <div aria-hidden="true" className="public-profile-skel-ranks">
        {[0, 1, 2].map((index) => rankCard(index))}
      </div>

      <div aria-hidden="true" className="public-profile-skel-panel public-profile-skel-summary">
        <span className="public-skel" style={{ width: "4.125rem", height: ".6875rem" }} />
        <span className="public-skel" style={{ width: "2.625rem", height: ".875rem" }} />
        <span className="public-skel" style={{ width: "5.375rem", height: ".75rem" }} />
        <span className="public-skel public-profile-skel-desktop" style={{ width: "10.5rem", height: ".75rem" }} />
        <span className="public-skel public-profile-skel-desktop" style={{ width: "4.875rem", height: ".75rem" }} />
      </div>

      {/* 탭은 실물 — 자리가 잡혀 있어야 도착 순간 덜 튑니다(목업). */}
      <PublicProfileTabs activeTab="overview" onChange={() => undefined} />

      <div className="public-profile-skel-body">
        <div className="public-profile-skel-main">
          <div aria-hidden="true" className="public-profile-skel-panel public-profile-skel-strip">
            <span className="public-skel public-skel--circle" style={{ width: "3.25rem", height: "3.25rem", flex: "none" }} />
            <div className="public-profile-skel-row-copy">
              <span className="public-skel" style={{ width: "5.25rem", height: ".875rem" }} />
              <span className="public-skel" style={{ width: "3.875rem", height: ".6875rem" }} />
            </div>
            <div className="public-profile-skel-strip-chips public-profile-skel-desktop">
              <span className="public-skel" style={{ width: "8rem", height: "1.625rem" }} />
              <span className="public-skel" style={{ width: "8rem", height: "1.625rem" }} />
              <span className="public-skel" style={{ width: "8rem", height: "1.625rem" }} />
            </div>
          </div>

          {/* 필터 칩은 실물이되 아직 누를 수 없는 상태 — 44px 터치 타깃 유지. */}
          <div aria-hidden="true" className="public-profile-skel-chips">
            {queueChips.map((label) => (
              <span className="public-profile-skel-chip" key={label}>{label}</span>
            ))}
          </div>

          <div aria-hidden="true" className="public-profile-skel-rows">
            {matchRow(0, false)}
            {matchRow(1, false)}
            {matchRow(2, true)}
          </div>
        </div>

        <div aria-hidden="true" className="public-profile-skel-side">
          <div className="public-profile-skel-panel">
            <span className="public-skel" style={{ width: "4.625rem", height: ".875rem" }} />
            <span className="public-skel" style={{ width: "100%", height: "2.75rem", marginTop: ".75rem" }} />
            <span className="public-skel" style={{ width: "100%", height: "2.75rem", marginTop: ".625rem" }} />
          </div>
          <div className="public-profile-skel-panel">
            <span className="public-skel" style={{ width: "5.75rem", height: ".875rem" }} />
            <span className="public-skel" style={{ width: "100%", height: "2.125rem", marginTop: ".75rem" }} />
            <span className="public-skel" style={{ width: "100%", height: "2.125rem", marginTop: ".625rem" }} />
          </div>
        </div>
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
    /* LIVE 레일 문구의 단일 원본은 shared/public-live-streamers.tsx —
       LoL 홈은 등록 스트리머 데이터라 registered 변형을 씁니다. */
    liveTitle: publicLiveText(publicContentLocale(activePublicLocale), "registeredTitle"),
    livePrevious: publicLiveText(publicContentLocale(activePublicLocale), "previous"),
    liveNext: publicLiveText(publicContentLocale(activePublicLocale), "next"),
    liveViewAll: publicLiveText(publicContentLocale(activePublicLocale), "viewAll"),
    liveWatch: publicLiveText(publicContentLocale(activePublicLocale), "watch"),
    liveEmptyTitle: publicLiveText(publicContentLocale(activePublicLocale), "registeredEmptyTitle"),
    liveEmptyDescription: publicLiveText(publicContentLocale(activePublicLocale), "registeredEmptyDescription"),
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
    patchNotesTitle: {
      label: t().homePatchNotesTitle,
      ko: publicI18n.ko.homePatchNotesTitle,
      ja: publicI18n.ja.homePatchNotesTitle,
    },
    patchNotesDescription: {
      label: t().homePatchNotesDescription,
      ko: publicI18n.ko.homePatchNotesDescription,
      ja: publicI18n.ja.homePatchNotesDescription,
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
  const winLabel = publicLocaleText("승", "勝", "W");
  const lossLabel = publicLocaleText("패", "敗", "L");
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

/* 최근 20경기 요약 바 — 목업 page-4: 랭크 3카드 아래 전폭 한 줄.
   [최근 N경기 | 승률 | X승 Y패 | · KDA · K/D/A | · 킬관여]. 승/패만 전용색. */
function ProfileRecentSummaryBar({ profile }: { profile: PublicLolProfile }) {
  const summary = profile.summary;
  if (!summary || summary.recentGames <= 0) return null;
  const games = summary.recentGames;
  const losses = Math.max(0, games - summary.recentWins);
  const winLabel = publicLocaleText("승", "勝", "W");
  const lossLabel = publicLocaleText("패", "敗", "L");
  const per = (total: number) => (total / games).toFixed(1);
  return (
    <div className="public-hero-summary-bar">
      <span className="public-hero-summary-bar-label">{gamesText(games)}</span>
      <b>{formatPercent(summary.recentWinRate)}</b>
      <span className="public-hero-summary-bar-record">
        <em>{summary.recentWins}{winLabel}</em>
        {" "}
        <i>{losses}{lossLabel}</i>
      </span>
      {summary.averageKda !== undefined ? (
        <>
          <span aria-hidden="true" className="public-hero-summary-bar-dot">·</span>
          <span>
            KDA <b>{summary.averageKda.toFixed(2)}</b>
            {` · ${per(summary.totalKills)} / ${per(summary.totalDeaths)} / ${per(summary.totalAssists)}`}
          </span>
        </>
      ) : null}
      {summary.averageKillParticipation !== undefined ? (
        <>
          <span aria-hidden="true" className="public-hero-summary-bar-dot">·</span>
          <span>{t().killParticipation} {formatPercent(summary.averageKillParticipation)}</span>
        </>
      ) : null}
    </div>
  );
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
  onOpenIngame,
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
  /** 방송 카드 '인게임 보기'(목업 §D) — 인게임 탭으로 전환합니다. */
  onOpenIngame?: () => void;
  participationOpen: boolean;
  onToggleFavorite: () => void;
  tabs?: ReactNode;
}) {
  const [activeRankQueue, setActiveRankQueue] = useState<string>();
  const [shareNotice, setShareNotice] = useState<(ProfileShareNotice & { id: number }) | null>(null);
  const shareNoticeSequenceRef = useRef(0);
  const refreshDisabled = loading || refreshRemaining > 0;
  const showShareNotice = (notice: ProfileShareNotice | null) => {
    if (!notice) {
      setShareNotice(null);
      return;
    }
    shareNoticeSequenceRef.current += 1;
    setShareNotice({ ...notice, id: shareNoticeSequenceRef.current });
  };
  /* 프로필 공유 카드(2026-08-18) — 기존 "전적 공유"(링크 복사) 버튼을 대체합니다.
     설계·검증: docs/mockups/lol-profile-share-card.html v1.3.
     라인별 주력 챔피언은 이미 받은 recentMatches 집계라 서버 계약 변경이 없습니다.
     이 패널이 받는 profile 은 필터가 반영된 뷰(profileWithMatches)라 rolePerformance
     도 최근 경기 기준입니다 — 카드 푸터의 "최근 N경기 기준"과 같은 표본이라
     라인 성과와 챔피언 판수가 서로 어긋나지 않습니다. */
  const shareLaneStats = profileShareLanes(profile.rolePerformance, profile.recentMatches, championName);
  const shareLane = (stat: typeof shareLaneStats.main): ProfileShareLane | undefined => stat
    ? {
      iconUrl: roleIconAssets[roleIconKey(stat.role)],
      roleLabel: mainRoleLabel(stat.role),
      games: stat.games,
      winRate: stat.winRate,
      kda: stat.kda,
      champions: stat.champions.map((champion) => ({
        name: champion.name,
        iconUrl: assetUrl(champion.iconUrl),
        games: champion.games,
        winRate: champion.winRate,
      })),
    }
    : undefined;
  const shareCardStreamer = visibleStreamerStream(profile.twitchStream);
  /* 티어는 솔로랭크 우선, 없으면 자유랭크 폴백 — 둘 다 없으면 언랭크 표기(목업 §⑤). */
  const shareRankedStats = soloRankStats(profile) ?? flexRankStats(profile) ?? profile.rankedStats;
  const shareQueueLabel = shareRankedStats?.queueType === "RANKED_FLEX_SR"
    ? t().flexQueue
    : shareRankedStats?.queueType === "RANKED_SOLO_5x5" ? t().soloQueue : undefined;
  const profileShareCard: ProfileShareCard = {
    riotId: profile.riotId,
    ...(shareRankedStats && shareRankedStats.queueType !== "UNRANKED"
      ? {
        tierLabel: rankTierLabel(shareRankedStats),
        tierIconUrl: assetUrl(shareRankedStats.tierIconUrl),
        leaguePoints: shareRankedStats.leaguePoints,
        wins: shareRankedStats.wins,
        losses: shareRankedStats.losses,
        winRate: Math.round(shareRankedStats.winRate),
      }
      : {}),
    ...(profile.summonerLevel !== undefined ? { summonerLevel: profile.summonerLevel } : {}),
    ...(shareQueueLabel ? { queueLabel: shareQueueLabel } : {}),
    ...(assetUrl(shareCardStreamer?.profileImageUrl) ?? assetUrl(profile.profileIconUrl)
      ? { profileImageUrl: (assetUrl(shareCardStreamer?.profileImageUrl) ?? assetUrl(profile.profileIconUrl))! }
      : {}),
    ...(assetUrl(profile.topChampions[0]?.splashUrl ?? profile.topChampions[0]?.loadingUrl)
      ? { masteryChampionArtUrl: assetUrl(profile.topChampions[0]?.splashUrl ?? profile.topChampions[0]?.loadingUrl)! }
      : {}),
    ...(shareLane(shareLaneStats.main) ? { mainLane: shareLane(shareLaneStats.main)! } : {}),
    ...(shareLane(shareLaneStats.sub) ? { subLane: shareLane(shareLaneStats.sub)! } : {}),
    ...(shareCardStreamer
      ? {
        streamer: {
          displayName: shareCardStreamer.twitchDisplayName,
          isLive: shareCardStreamer.isLive,
          ...(shareCardStreamer.twitchLogin ? { channelLabel: `twitch.tv/${shareCardStreamer.twitchLogin}` } : {}),
          ...(shareCardStreamer.profileImageUrl ? { profileImageUrl: assetUrl(shareCardStreamer.profileImageUrl)! } : {}),
          ...(shareCardStreamer.isLive && shareCardStreamer.title ? { title: shareCardStreamer.title } : {}),
        },
      }
      : {}),
  };
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
      onOpenIngame={onOpenIngame}
      onOpenParticipation={onOpenParticipation}
      participationOpen={participationOpen}
      previewUrl={safeTwitchStreamPreviewUrl(registeredStreamerStream.thumbnailUrl)}
      text={{
        ingameLabel: t().ingame,
        ingameNotice: t().streamerIngameNotice,
        ingameViewLabel: t().castIngameView,
        participationOpenLabel: t().participationOpen,
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
    publicSummonerTokenPath(profile.profileToken, normalizedPlatform),
  );
  const canonicalProfileUrl = typeof window === "undefined"
    ? `https://yoro.gg${canonicalProfilePath}`
    : new URL(canonicalProfilePath, window.location.origin).href;
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
      serverChipLabel={PUBLIC_LOL_PLATFORM_OPTIONS.find((option) => option.id === normalizeLolPlatformId(profile.lolPlatform))?.code}
      profileIconUrl={streamerProfileIconUrl ?? assetUrl(profile.profileIconUrl)}
      profileMetaLabel={undefined}
      profileLinks={<ProfileLinkIcons links={profileLinks} />}
      rankSection={(
        <FeatureProfileHeroRank
          activeQueueId={selectedRankQueueId}
          /* 숙련도 top3(목업 §2-7) — 스트리머 3열 격자의 네 번째 칸. hero 배경
             아트(masteryChampionArt)와 같은 profile.topChampions 를 씁니다.
             숙련도 응답이면 레벨 칩+점수, 최근 경기 대체면 판수만 — 없는 쪽은
             줄 자체를 그리지 않습니다. */
          masteryChampions={registeredStreamerStream
            ? profile.topChampions.slice(0, 3).map((champion) => ({
              key: String(champion.championId),
              name: championName(champion),
              fallbackLabel: championName(champion).slice(0, 1).toUpperCase(),
              ...(assetUrl(champion.iconUrl) ? { iconUrl: assetUrl(champion.iconUrl)! } : {}),
              ...(champion.masteryLevel !== undefined ? { levelLabel: `M${champion.masteryLevel}` } : {}),
              ...(champion.masteryPoints !== undefined
                ? { detailLabel: `${formatNumber(champion.masteryPoints)}${t().masteryPointsSuffix}` }
                : champion.games !== undefined ? { detailLabel: gamesText(champion.games) } : {}),
            }))
            : undefined}
          onSelectQueue={setActiveRankQueue}
          onViewRecentMatches={() => document.getElementById("public-recent-matches")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          queues={rankQueues}
          text={{
            lpTrendLabel: `${t().rankLpTrendLabel} · ${t().period30}`,
            masteryTitle: t().masteryChampionsTitle,
            queueSwitcherLabel: t().rankQueueSwitcher,
            unrankedTitle: t().rankUnrankedTitle,
            viewRecentMatchesLabel: t().rankViewRecentMatches,
          }}
          trend={heroTrend}
        />
      )}
      summaryBar={<ProfileRecentSummaryBar profile={profile} />}
      channelAriaLabel={registeredStreamerStream ? `${registeredStreamerStream.twitchDisplayName} · ${t().streamerWatch}` : undefined}
      liveStatus={registeredStreamerStream ? {
        isLive: registeredStreamerStream.isLive,
        label: registeredStreamerStream.isLive
          ? `LIVE${registeredStreamerStream.viewerCount !== undefined ? ` · ${formatNumber(registeredStreamerStream.viewerCount)}` : ""}`
          : t().streamerOfflineNow,
      } : undefined}
      channelName={registeredStreamerStream?.twitchDisplayName}
      channelUrl={registeredStreamerStream?.channelUrl}
      recentFormLabel={registeredStreamerStream ? t().recent20Games : undefined}
      recentFormResults={registeredStreamerStream
        ? (profile.recentMatches ?? [])
          .filter((entry): entry is typeof entry & { result: "win" | "loss" } =>
            entry.result === "win" || entry.result === "loss")
          .slice(0, 10)
          .map((entry) => entry.result)
        : undefined}
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
        <ToastProvider duration={3_500} position="top-center">
          <ProfileShareActions
            card={profileShareCard}
            compact
            onNotice={showShareNotice}
            text={{
              title: t().profileShareTitle,
              description: t().profileShareDescription,
              download: t().profileShareDownload,
              share: t().profileShareButton,
              preparing: t().profileSharePreparing,
              saved: t().profileShareSaved,
              shared: t().profileShareShared,
              failed: t().profileShareFailed,
              mainLane: t().profileShareMainLane,
              subLane: t().profileShareSubLane,
              unranked: t().profileShareUnranked,
              levelPrefix: "Lv.",
              games: t().games,
              sampleNote: t().profileShareSample.replace("{count}", String(profile.recentMatches.length)),
              liveBadge: t().profileShareLive,
            }}
          />
          {/* 프로필 공유는 이미지, 링크 복사는 현재 주소를 클립보드에 저장합니다. */}
          <PublicProfileShareButton
            copiedLabel={t().shareRecordCopied}
            copyFailedLabel={t().shareRecordCopyFailed}
            label={t().shareProfileLink}
            onNotice={showShareNotice}
            url={canonicalProfileUrl}
          />
          <ToastViewport className="public-profile-share-toast-viewport">
            {shareNotice ? (
              <Toast
                autoDismiss
                key={shareNotice.id}
                loading={shareNotice.tone === "info"}
                onDismiss={() => {
                  setShareNotice((current) => current?.id === shareNotice.id ? null : current);
                }}
                tone={shareNotice.tone}
              >
                <ToastTitle>{shareNotice.message}</ToastTitle>
                {shareNotice.tone !== "info" ? (
                  <ToastCloseButton aria-label={t().participationClose}>×</ToastCloseButton>
                ) : null}
              </Toast>
            ) : null}
          </ToastViewport>
        </ToastProvider>
      )}
      streamerSpotlight={streamerSpotlight}
      tagLine={profile.tagLine}
      text={profileTopPanelText()}
      onOpenParticipation={registeredStreamerStream ? onOpenParticipation : undefined}
    />
  );
}

/* 더 많은 기능(목업 §3-6) — 죽은 기능 소개 대신 다른 화면 진입 칩 묶음.
   '접기'는 실제로 접히는 토글입니다. */
function PublicMoreFeatures() {
  const [folded, setFolded] = useState(false);
  const chips = [
    { key: "participation", label: t().moreFeatureParticipation, href: "/participation" },
    { key: "aram", label: t().moreFeatureAram, href: "/lol/aram" },
    { key: "patch-notes", label: t().moreFeaturePatchNotes, href: "/patch-notes" },
    { key: "streamers", label: t().moreFeatureStreamers, href: "/follow" },
  ];
  return (
    <section className="public-more-links" id="public-more-features">
      <div className="public-more-links-head">
        <h2>{t().moreFeatures}</h2>
        <button aria-expanded={!folded} onClick={() => setFolded((current) => !current)} type="button">
          {t().folded}
        </button>
      </div>
      {!folded ? (
        <div className="public-more-links-chips">
          {chips.map((chip) => (
            <a href={localizedPublicUrlForCurrentLocale(chip.href)} key={chip.key}>{chip.label}</a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PublicProfileTabs({
  activeTab,
  onChange
}: {
  activeTab: PublicProfileTab;
  onChange: (tab: PublicProfileTab) => void;
}) {
  /* 통계는 목업 lol-signature-builds v5 부터 사이드바 스크롤이 아니라 본문 탭입니다.
     참여는 프로필 탭이 아니라 상단 메뉴(시청자 참여)가 전담합니다 — 목업 v25. */
  return (
    <nav className="public-profile-hero-nav" aria-label={t().profileSummary}>
      <button type="button" aria-current={activeTab === "overview" ? "page" : undefined} onClick={() => onChange("overview")}>{t().matchHistoryTab}</button>
      <button type="button" aria-current={activeTab === "champions" ? "page" : undefined} onClick={() => onChange("champions")}>
        {/* 모바일 4칸 균등 분할(목업)에서 잘리지 않게 축약 표기로 교체합니다. */}
        <span className="public-profile-tab-full">{t().championAnalysis}</span>
        <span aria-hidden="true" className="public-profile-tab-short">{t().champion}</span>
      </button>
      <button type="button" aria-current={activeTab === "ingame" ? "page" : undefined} onClick={() => onChange("ingame")}>{t().ingame}</button>
      <button type="button" aria-current={activeTab === "stats" ? "page" : undefined} onClick={() => onChange("stats")}>{t().stats}</button>
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
        <span>{stats ? `${stats.wins}${publicLocaleText("승", "勝", "W")} ${stats.losses}${publicLocaleText("패", "敗", "L")}` : t().noData}</span>
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
/* 플레이 시간대 — 요약(utils/playtime)을 표시 문구로 조립해 카드에 넘깁니다.
   근거: docs/mockups/lol-profile-playtime-card.html (v2). */
const PLAYTIME_BAND_LABEL_KEY: Record<PlaytimeBandKey, "playtimeBandDawn" | "playtimeBandMorning" | "playtimeBandDay" | "playtimeBandAfternoon" | "playtimeBandEvening" | "playtimeBandNight"> = {
  dawn: "playtimeBandDawn",
  morning: "playtimeBandMorning",
  day: "playtimeBandDay",
  afternoon: "playtimeBandAfternoon",
  evening: "playtimeBandEvening",
  night: "playtimeBandNight"
};

function playtimeHourText(hour: number): string {
  /* "02–06"처럼 한 자리는 0을 붙입니다 — 목업 표기 그대로. */
  return hour < 10 ? `0${hour}` : String(hour);
}

function playtimeRangeLabel(bandKey: PlaytimeBandKey, startHour: number): string {
  const endHour = (startHour + 4) % 24;
  return t().playtimeRange
    .replace("{label}", t()[PLAYTIME_BAND_LABEL_KEY[bandKey]])
    .replace("{start}", playtimeHourText(startHour))
    .replace("{end}", playtimeHourText(endHour));
}

function ProfilePlaytimeSection({ profile }: { profile: PublicLolProfile }) {
  const summary = playtimeSummary(profile.recentMatches, profile.lolPlatform);
  const peakRate = summary.peakWinRate;
  const bandShortLabel = (bandKey: PlaytimeBandKey, startHour: number): string =>
    `${t()[PLAYTIME_BAND_LABEL_KEY[bandKey]]} ${playtimeHourText(startHour)}\u2013${playtimeHourText((startHour + 4) % 24)}`;

  return (
    <FeatureProfilePlaytimeCard
      axisLabels={[t().playtimeAxisStart, "6", "12", "18", "24"]}
      bands={summary.others.map((band) => ({
        key: band.key,
        label: bandShortLabel(band.key, band.startHour),
        winRate: band.winRate,
        games: band.games,
        statLabel: t().playtimeBandStat
          .replace("{rate}", String(band.winRate))
          .replace("{games}", String(band.games))
      }))}
      daytime={summary.daytime}
      footLabel={summary.totalGames > 0 && summary.thinSample
        ? t().playtimeThinFoot
        : summary.insight
          ? t().playtimeInsight
            .replace("{band}", bandShortLabel(summary.insight.band.key, summary.insight.band.startHour))
            .replace("{diff}", String(summary.insight.diffPoints))
          : undefined}
      hourly={summary.hourly}
      peakLabel={summary.peak ? playtimeRangeLabel(summary.peak.key, summary.peak.startHour) : undefined}
      peakMetaLabel={summary.peak
        ? summary.thinSample
          ? t().playtimePeakMetaThin.replace("{games}", String(summary.peak.games))
          : t().playtimePeakMeta
            .replace("{games}", String(summary.peak.games))
            .replace("{share}", String(summary.peakShare))
        : undefined}
      peakStartHour={summary.peak?.startHour}
      peakWinRate={peakRate}
      peakWinRateTone={peakRate === undefined || peakRate === 50 ? "flat" : peakRate > 50 ? "up" : "down"}
      text={{
        title: t().playtimeTitle,
        /* 빈 상태에서 "최근 0경기"는 어색합니다 — LP 카드처럼 기간 pill 로 둡니다. */
        pillLabel: summary.totalGames === 0
          ? t().period30
          : t().playtimePill
            .replace("{count}", String(summary.totalGames))
            .replace("{tz}", platformTimezoneLabel(profile.lolPlatform)),
        peakZoneLabel: t().playtimePeakZone,
        winRateLabel: t().playtimeWinRate,
        stripAriaLabel: t().playtimeStripAria,
        emptyTitle: t().playtimeEmptyTitle,
        emptyDescription: t().playtimeEmptyDescription
      }}
    />
  );
}

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
/* 같이 플레이한 소환사 — LP 기록 아래 독립 파츠(목업 lol-frequent-teammates §②).
   같은 경기+같은 팀 기준 서버 집계(함께 2게임 이상만) · 행 클릭 = 해당 소환사 전적으로 이동.
   데이터가 없으면 카드 자체를 그리지 않습니다(빈 카드 노이즈 금지). */
function ProfileFrequentTeammatesCard({ profile }: { profile: PublicLolProfile }) {
  const teammates = profile.frequentTeammates ?? [];
  if (teammates.length === 0) return null;
  return (
    <article aria-labelledby="frequent-teammates-title" className="public-profile-side-card public-frequent-teammates" data-testid="frequent-teammates-card">
      <div className="public-profile-side-head">
        <h2 id="frequent-teammates-title">{t().frequentTeammatesTitle}</h2>
        <span className="public-profile-side-pill">
          {t().frequentTeammatesSample.replace("{count}", String(profile.summary.recentGames))}
        </span>
      </div>
      <ul>
        {teammates.map((mate) => {
          const winRate = Math.round((mate.wins / mate.games) * 100);
          const profileHref = localizedPublicUrlForCurrentLocale(
            `/lol/summoners/${profile.lolPlatform}/${encodeURIComponent(`${mate.gameName}-${mate.tagLine}`)}`
          );
          return (
            <li key={`${mate.gameName}#${mate.tagLine}`.toLowerCase()}>
              <a href={profileHref}>
                <span className="public-frequent-teammates__who">
                  <b>{mate.gameName}<i>#{mate.tagLine}</i></b>
                  {mate.lastPlayedAt ? (
                    <small>
                      {t().frequentTeammatesLast}{" "}
                      {new Intl.DateTimeFormat(publicIntlLocale(), { month: "long", day: "numeric" })
                        .format(new Date(mate.lastPlayedAt))}
                    </small>
                  ) : null}
                </span>
                <span aria-hidden="true" className="public-frequent-teammates__bar">
                  <i style={{ width: `${winRate}%` }} />
                </span>
                <span className="public-frequent-teammates__stat">
                  <b className={winRate >= 60 ? "is-hot" : winRate <= 40 ? "is-cold" : ""}>{winRate}%</b>
                  {t().frequentTeammatesGames.replace("{count}", String(mate.games))}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="public-profile-side-foot">{t().frequentTeammatesFoot}</p>
    </article>
  );
}

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
          vectorEffect="non-scaling-stroke"
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

/* 시그니처 빌드 패널(2026-08-17) — 목업 docs/mockups/lol-signature-builds.html v5.
 * 통계 탭(profileTab "stats")의 본문 대형 패널 — 챔피언 분석과 같은 영역·문법.
 * 아코디언: 기본은 챔피언 목록(+대표 빌드 미리보기), 클릭 시 룬 페이지별 조건부
 * 아이템 채용률을 펼칩니다(단일 펼침). 데이터는 utils/match.ts 의 signatureBuilds 가
 * 전담하며 추가 API 호출이 없습니다. */

function sigLocaleName(entry: { nameKo?: string; nameJa?: string } | undefined, fallback: string): string {
  if (!entry) return fallback;
  if (activePublicLocale === "ja") return entry.nameJa ?? entry.nameKo ?? fallback;
  return entry.nameKo ?? entry.nameJa ?? fallback;
}

/* 미니게임 랩 배너(목업 reaction-test.html v3 §⑤) — 통계 탭 하단.
 * 뷰어 본인의 브라우저 기록(localStorage)이라 남의 프로필에서도 항상 "내 기록"이며,
 * 문구로 그 사실을 명확히 합니다. 발견 동선이 목적이라 기록이 없어도 항상 렌더합니다. */
function MiniGamesLabBanner() {
  const best = useMemo(() => readMiniGameBest("reaction"), []);
  const tier = best?.tierKey ? REACTION_TIER_TABLE.find((entry) => entry.key === best.tierKey) : undefined;
  const href = localizedPublicUrlForCurrentLocale("/games/reaction");
  return (
    <a className="public-sig-lab" data-testid="mini-games-lab-banner" href={href}>
      {/* 이모지 금지 규칙 — 목업의 16px 그리드 선 아이콘(stroke 1.2)으로 대체. */}
      <span aria-hidden="true" className="public-sig-lab-icon">
        <svg fill="none" height="16" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.2" viewBox="0 0 24 24" width="16">
          <path d="M13 2 L 5 13 h 6 l -1 9 8 -11 h -6 z" />
        </svg>
      </span>
      <span className="public-sig-lab-text">
        {/* 모바일(≤30rem)은 1행 유지를 위해 짧은 제목으로 교체하고 부제를 숨깁니다. */}
        <b>
          <span className="public-sig-lab-title-full">{t().miniGamesLabTitle}</span>
          <span aria-hidden="true" className="public-sig-lab-title-short">{t().miniGamesLabTitleShort}</span>
        </b>
        <small>{best ? t().miniGamesLabNote : t().miniGamesLabEmpty}</small>
      </span>
      {best ? (
        <span className="public-sig-lab-record">
          <b>
            {Math.round(best.score)}ms
            {tier ? <span className="public-sig-lab-record-tier"> · <i aria-hidden="true" className="games-tdot" style={{ background: tier.color }} /><span className="public-sig-lab-record-tiername"> {reactionTierLabel(tier, publicContentLocale(activePublicLocale))}</span></span> : null}
          </b>
          <small>{t().miniGamesLabBest}</small>
        </span>
      ) : null}
      <span className="public-sig-lab-cta">{t().miniGamesLabCta}</span>
    </a>
  );
}

function SignatureBuildsPanel({
  profile,
  onChampionPick
}: {
  profile: PublicLolProfile;
  onChampionPick: (championId: number) => void;
}) {
  const { entries, ghosts } = useMemo(() => signatureBuilds(profile), [profile]);
  const [openChampionId, setOpenChampionId] = useState<number | null>(null);

  const winRateTone = (winRate: number, games: number) =>
    games >= 3 ? metricToneClass(percentTone(winRate)) : metricToneClass(undefined);

  const head = (
    <div className="public-champ-head">
      <h2>{t().sigBuildsTitle}</h2>
      <span className="public-champ-pill">{t().champAnalysisPill.replace("{count}", String(profile.summary.recentGames))}</span>
    </div>
  );

  if (entries.length === 0) {
    return (
      <section className="public-champ-panel public-sig-panel" id="public-sig-builds">
        {head}
        <div className="public-champ-empty">
          <strong>{t().sigBuildsEmptyTitle}</strong>
          <span>{t().sigBuildsEmptyDescription}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="public-champ-panel public-sig-panel" id="public-sig-builds">
      {head}

      <div className="public-sig-list">
        {entries.map((entry) => {
          const open = openChampionId === entry.champion.championId;
          const detailId = `public-sig-detail-${entry.champion.championId}`;
          const masteryMeta = entry.masteryRank !== undefined && entry.masteryPoints !== undefined
            ? t().sigBuildsMasteryMeta.replace("{rank}", String(entry.masteryRank)).replace("{points}", formatNumber(entry.masteryPoints))
            : undefined;
          const topGroup = entry.groups[0];
          const previewRunes = topGroup
            ? [sigLocaleName(topGroup.primaryStyle, ""), sigLocaleName(topGroup.secondaryStyle, "")].filter(Boolean).join("+")
            : "";
          return (
            <div className={`public-sig-entry${open ? " is-open" : ""}`} key={entry.champion.championId}>
              <button
                aria-controls={detailId}
                aria-expanded={open}
                className="public-sig-row"
                onClick={() => setOpenChampionId(open ? null : entry.champion.championId)}
                type="button"
              >
                <span className="public-sig-ava" data-lv={entry.masteryLevel !== undefined ? `Lv.${entry.masteryLevel}` : undefined}>
                  {entry.champion.iconUrl ? <img alt="" src={assetUrl(entry.champion.iconUrl)} /> : <span>{championName(entry.champion).slice(0, 1)}</span>}
                </span>
                <span className="public-sig-id">
                  <b>{championName(entry.champion)}</b>
                  <small>{[masteryMeta, gamesText(entry.games)].filter(Boolean).join(" · ")}</small>
                </span>
                {topGroup ? (
                  <span aria-hidden="true" className="public-sig-preview">
                    <span className="public-sig-preview-keystone">
                      {topGroup.keystone?.iconUrl ? <img alt="" src={assetUrl(topGroup.keystone.iconUrl)} /> : null}
                    </span>
                    {topGroup.items.slice(0, 3).map((item) => (
                      <span className="public-sig-preview-item" key={item.itemId}>
                        {item.iconUrl ? <img alt="" src={assetUrl(item.iconUrl)} /> : null}
                      </span>
                    ))}
                    <small>
                      {sigLocaleName(topGroup.keystone, "-")}
                      {previewRunes ? ` · ${previewRunes}` : ""}
                      {entry.groups.length > 1 ? ` ${t().sigBuildsPreviewMore.replace("{count}", String(entry.groups.length - 1))}` : ""}
                    </small>
                  </span>
                ) : null}
                <span className="public-sig-rate">
                  <b className={winRateTone(entry.winRate, entry.games)}>{formatPercent(entry.winRate)}</b>
                  <small>
                    <span className="is-win">{winsText(entry.wins)}</span>{" "}
                    <span className="is-loss">{entry.games - entry.wins}{publicLocaleText("패", "敗", "L")}</span>
                  </small>
                </span>
                <span aria-hidden="true" className="public-sig-chev" />
              </button>

              <div className="public-sig-detail-wrap" id={detailId}>
                <div className="public-sig-detail" hidden={!open}>
                  {entry.groups.length > 0 ? (
                    <div className="public-sig-bgrid" data-solo={entry.groups.length === 1 ? "true" : undefined}>
                      {entry.groups.map((group, index) => {
                        const pickRate = Math.round((group.games / entry.games) * 100);
                        const groupWinRate = Math.round((group.wins / group.games) * 100);
                        return (
                          <div className={`public-sig-build${index > 0 ? " is-alt" : ""}`} key={group.key}>
                            <div className="public-sig-build-head">
                              <span className="public-sig-build-no">{t().sigBuildsBuildLabel.replace("{n}", String(index + 1))}</span>
                              <span className="public-sig-rune">
                                <span className="public-sig-keystone">
                                  {group.keystone?.iconUrl ? <img alt="" src={assetUrl(group.keystone.iconUrl)} /> : <span>{sigLocaleName(group.keystone, "?").slice(0, 2)}</span>}
                                </span>
                                <span className="public-sig-rune-names">
                                  <b>{sigLocaleName(group.keystone, "-")}</b>
                                  {group.primaryStyle || group.secondaryStyle ? (
                                    <small>
                                      {[sigLocaleName(group.primaryStyle, ""), sigLocaleName(group.secondaryStyle, "")].filter(Boolean).join(" + ")}
                                    </small>
                                  ) : null}
                                </span>
                              </span>
                              <span className="public-sig-build-pick">
                                <b>{t().sigBuildsPickStat.replace("{picked}", String(group.games)).replace("{total}", String(entry.games)).replace("{rate}", String(pickRate))}</b>
                                <small className={winRateTone(groupWinRate, group.games)}>{t().sigBuildsPickWinRate.replace("{rate}", String(groupWinRate))}</small>
                              </span>
                            </div>
                            <span aria-hidden="true" className="public-sig-build-bar"><i style={{ width: `${pickRate}%` }} /></span>
                            {group.items.length > 0 ? (
                              <>
                                <span className="public-sig-items-label">{t().sigBuildsItemsLabel}</span>
                                <div className="public-sig-items">
                                  {group.items.map((item) => (
                                    <span
                                      className={`public-sig-item${isBootItem(item.itemId) ? " is-boots" : ""}`}
                                      key={item.itemId}
                                      title={`${sigLocaleName(item, `#${item.itemId}`)} · ${Math.round((item.games / group.games) * 100)}% (${item.games}/${group.games})`}
                                    >
                                      <i>{item.iconUrl ? <img alt="" src={assetUrl(item.iconUrl)} /> : sigLocaleName(item, `#${item.itemId}`).slice(0, 4)}</i>
                                      <b>{Math.round((item.games / group.games) * 100)}%</b>
                                      <small>{item.games}/{group.games}</small>
                                    </span>
                                  ))}
                                  {/* 미구매 슬롯 — 점선 테두리 빈 칸으로 패딩(목업). */}
                                  {Array.from({ length: Math.max(0, SIGNATURE_BUILD_MAX_ITEMS - group.items.length) }, (_, slot) => (
                                    <span aria-hidden="true" className="public-sig-item is-empty" key={`empty:${slot}`}>
                                      <i />
                                    </span>
                                  ))}
                                </div>
                              </>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="public-sig-detail-foot">
                    {entry.otherGames > 0 ? (
                      <span className="public-sig-other">{t().sigBuildsOther.replace("{count}", String(entry.otherGames))}</span>
                    ) : null}
                    <button className="public-sig-view" onClick={() => onChampionPick(entry.champion.championId)} type="button">
                      {t().sigBuildsView.replace("{name}", championName(entry.champion))}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {ghosts.map((row) => (
          <div className="public-sig-entry is-ghost" key={row.champion.championId}>
            <div className="public-sig-row">
              <span className="public-sig-ava" data-lv={row.masteryLevel !== undefined ? `Lv.${row.masteryLevel}` : undefined}>
                {row.champion.iconUrl ? <img alt="" src={assetUrl(row.champion.iconUrl)} /> : <span>{championName(row.champion).slice(0, 1)}</span>}
              </span>
              <span className="public-sig-id">
                <b>{championName(row.champion)}</b>
                <small>
                  {row.masteryRank !== undefined
                    ? `${t().sigBuildsMasteryMeta.replace("{rank}", String(row.masteryRank)).replace("{points}", formatNumber(row.masteryPoints))} · ${t().sigBuildsNoRecent}`
                    : t().sigBuildsNoRecent}
                </small>
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="public-sig-foot">{openChampionId === null ? t().sigBuildsFootIdle : t().sigBuildsFootOpen}</p>
    </section>
  );
}

/* 사이드바 최근 챔피언(목업 §2H) — 행 52px · 아바타 32px 원형 · 우측 N승 M패 전용색. */
function ProfileRecentChampionsSideCard({ profile }: { profile: PublicLolProfile }) {
  const champions = profile.championPerformance.slice(0, 3);
  if (champions.length === 0) return null;
  const lossLabel = publicLocaleText("패", "敗", "L");
  return (
    <article className="public-profile-side-card public-profile-recent-champs">
      <div className="public-profile-side-head">
        <h2>{t().recentChampionsTitle}</h2>
        <span className="public-profile-side-pill">{gamesText(profile.summary.recentGames)}</span>
      </div>
      <ul>
        {champions.map((entry) => {
          const losses = entry.games - entry.wins;
          return (
            <li key={entry.champion.championId}>
              <span className="public-profile-recent-champs__ava">
                {entry.champion.iconUrl
                  ? <img alt="" src={assetUrl(entry.champion.iconUrl)} />
                  : <span>{championName(entry.champion).slice(0, 1)}</span>}
              </span>
              <span className="public-profile-recent-champs__who">
                <b>{championName(entry.champion)}</b>
                <small>{gamesText(entry.games)} · KDA {formatDecimal(entry.averageKda, 1)}</small>
              </span>
              <span className="public-profile-recent-champs__rec">
                {entry.wins > 0 ? <em>{winsText(entry.wins)}</em> : null}
                {" "}
                {losses > 0 ? <i>{losses}{lossLabel}</i> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

/* LP 기록 큐 탭(목업 §3-7) — 탭 자체가 큐별 30일 증감이라 고르기 전에도 비교됩니다.
   rankHistory 가 솔로 단일 시계열이라(§4) 자유·5:5 는 증감 "—" + 빈 상태만 둡니다. */
type LpRecordQueueId = "solo" | "flex" | "ranked5v5";

function OverviewMetricPanel({ profile }: { profile: PublicLolProfile }) {
  const summary = profile.summary;
  const aggregateSummary = summarizeMatches(recentAnalysisMatches(profile));
  const aggregateGrade = aggregatePerformanceGrade(profile);
  const aggregateScore = aggregatePerformanceScore(profile);
  const trend = rankTrendLine(profile);
  const soloStats = soloRankStats(profile) ?? profile.rankedStats;
  const lpEntries = profileLpChangeEntries(profile);
  const mainRole = profile.roleAnalysis?.mainRole;
  const [lpQueue, setLpQueue] = useState<LpRecordQueueId>("solo");
  const lpQueueDefs: Array<{ id: LpRecordQueueId; label: string; stats?: LolRankedStats }> = [
    { id: "solo", label: t().soloRank, stats: soloStats },
    { id: "flex", label: t().flexRank, stats: flexRankStats(profile) },
    { id: "ranked5v5", label: t().ranked5v5, stats: ranked5v5Stats(profile) },
  ];
  const lpSelected = lpQueueDefs.find((queue) => queue.id === lpQueue) ?? lpQueueDefs[0]!;
  const lpSelectedRanked = lpSelected.stats !== undefined && lpSelected.stats.tier !== "UNRANKED";
  const lpSoloSelected = lpQueue === "solo";

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
      {/* 목업 §2H 순서: LP 기록 → 플레이 시간대 → 최근 20경기 지표 →
          함께 플레이 → 최근 챔피언 → 포지션. */}
      <FeatureProfileLpRecordCard
        changeLabel={lpSoloSelected && trend
          ? (trend.change === 0 ? t().lpNoChange : `${trend.change > 0 ? "+" : ""}${trend.change} LP`)
          : undefined}
        changeTone={lpSoloSelected && trend ? (trend.change > 0 ? "up" : trend.change < 0 ? "down" : "flat") : "flat"}
        chart={lpSoloSelected && trend && trend.points.length > 1 ? (
          <ProfileSidebarLpChart points={trend.points.map((point) => ({ value: point.value, tierKey: tierKeyFromScore(point.value) }))} />
        ) : undefined}
        currentLabel={lpSelectedRanked && lpSelected.stats
          ? `${rankTierLabel(lpSelected.stats)} ${lpSelected.stats.leaguePoints} LP`
          : t().unranked}
        currentTierKey={lpSelectedRanked && lpSelected.stats ? lpSelected.stats.tier.toLocaleLowerCase() : undefined}
        entries={lpSoloSelected ? lpEntries : []}
        queueTabs={(
          <div aria-label={t().rankQueueSwitcher} className="public-profile-lp-queues" role="tablist">
            {lpQueueDefs.map((queue) => {
              const active = queue.id === lpQueue;
              /* 큐별 30일 증감 — rankHistory 가 솔로 단일 시계열이라(§4)
                 자유·5:5 는 "—" 를 둡니다. 가짜 수치를 만들지 않습니다. */
              const delta = queue.id === "solo" && trend
                ? (trend.change === 0 ? "0 LP" : `${trend.change > 0 ? "+" : ""}${trend.change} LP`)
                : undefined;
              const deltaTone = queue.id === "solo" && trend
                ? (trend.change > 0 ? "up" : trend.change < 0 ? "down" : "flat")
                : "flat";
              return (
                <button
                  aria-selected={active}
                  className={active ? "is-active" : ""}
                  key={queue.id}
                  onClick={() => setLpQueue(queue.id)}
                  role="tab"
                  type="button"
                >
                  <span>{queue.label}</span>
                  {delta !== undefined
                    ? <b data-tone={deltaTone}>{delta}</b>
                    : <b data-tone="flat">—</b>}
                </button>
              );
            })}
          </div>
        )}
        recordCount={lpSoloSelected ? trend?.sampleCount ?? 0 : 0}
        text={{
          emptyDescription: t().lpRecordEmptyDescription,
          emptyTitle: t().lpRecordEmptyTitle,
          periodLabel: t().period30,
          recordCountLabel: t().lpRecordCount,
          title: t().lpRecordTitle,
        }}
      />

      <ProfilePlaytimeSection profile={profile} />

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

      <ProfileFrequentTeammatesCard profile={profile} />

      <ProfileRecentChampionsSideCard profile={profile} />

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
          <option value="normal">{t().normalQueue}</option>
          <option value="solo">{t().soloQueue}</option>
          <option value="flex">{t().flexQueue}</option>
          <option value="ranked5v5">{t().ranked5v5}</option>
          <option value="arena">{t().arenaQueue}</option>
          <option value="aram">{t().aramQueue}</option>
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
  championPerformance,
  totalGames,
  onChange,
  onReset,
  resultSummary
}: {
  filters: PublicMatchFilters;
  champions: LolChampionSummary[];
  /* 목업 §2-4 — 목록 행의 경기수·승률. profile.championPerformance(주력 챔피언
     칩과 같은 배열, 모집단 동일)를 championId 로 이어 붙입니다. 서버 계약 불변. */
  championPerformance?: PublicLolChampionPerformance[];
  totalGames?: number;
  onChange: (filters: PublicMatchFilters) => void;
  onReset: () => void;
  resultSummary?: ReactNode;
}) {
  const filterActive = hasActiveFilters(filters);
  const performanceById = new Map(
    (championPerformance ?? []).map((entry) => [entry.champion.championId, entry]),
  );
  const championOptions = champions.map((champion) => {
    const performance = performanceById.get(champion.championId);
    return {
      value: String(champion.championId),
      label: championName(champion),
      iconUrl: assetUrl(champion.iconUrl),
      fallbackLabel: championName(champion).slice(0, 1),
      /* 값이 없는 챔피언은 필드를 아예 두지 않아 메타 줄이 비워집니다. */
      ...(performance ? { games: performance.games, winRate: performance.winRate } : {}),
    };
  });
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
    arenaQueue: t().arenaQueue,
    aramQueue: t().aramQueue,
    allChampions: t().allChampions,
    periodAll: t().periodAll,
    period7: t().period7,
    period30: t().period30,
    queueGroupLabel: t().matchFilterQueueGroup,
    gamesSuffix: t().games,
    championsEmptyTitle: t().championFilterEmptyTitle,
    championsEmptyHint: t().championFilterEmptyHint
  };
  return (
    <FeaturePublicMatchFilterBar
      championAllGames={totalGames}
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

/* 상단바는 LolChrome(1행 HomeHeader + 2행 LolSubnav) 한 벌로 통일 — 구
   PublicAppHeader 래퍼는 제거했습니다(docs/handoffs/2026-08-21-app-header-shared-prompt.md). */

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

/** 티어·포지션 칸의 조각들. 한 줄로 합치지 않는 이유는 티어에만 색을 주기
    때문입니다(목업 §색 — 색은 행이 아니라 티어 글자와 상태 칩에만). */
function publicParticipationRowDetail(item: PublicParticipationQueueItem): {
  tierLabel: string;
  tierKey?: string;
  roleLabel?: string;
} {
  const ranked = !item.rankedStats || item.rankedStats.tier === "UNRANKED" ? undefined : item.rankedStats;
  const role = item.preferredRole ?? item.requestedRole;
  return {
    tierLabel: ranked ? rankTierLabel(ranked) : t().participationRankPending,
    ...(ranked ? { tierKey: ranked.tier.toLocaleLowerCase() } : {}),
    ...(role ? { roleLabel: publicParticipationRoleLabel(role) } : {})
  };
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
      {/* 방송인이 이미 선택된 화면(?session= 링크 등)에서는 참여 등록 패널이 로그인
          안내를 담당합니다 — 그때 이 배너까지 그리면 Twitch 로그인 버튼이 두 개가
          됩니다(2026-08-23 운영 실측). 방송인이 없을 때는 여기가 유일한 진입점이라
          그대로 남깁니다. */}
      {!error && status.configured && !status.connected && !selectedStreamer ? (
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
          loading={loading}
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
            checkedInLabel={formatNumber(participation?.summary.checkedIn ?? 0)}
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
              checkedInLabel: t().participationCheckedInLabel,
              currentPlayerLabel: t().participationCurrentPlayerLabel,
              notificationsDescription: t().participationNotificationsDescription,
              notificationsTitle: t().participationNotificationsTitle,
              notifyOffLabel: t().participationNotificationsEnable,
              notifyOnLabel: t().participationNotificationsEnabled,
              positionUnit: t().participationPositionUnit,
              waitingLabel: t().participationWaitingLabel,
            }}
            waitingLabel={formatNumber(participation?.summary.waiting ?? 0)}
          />
        </div>
      ) : null}

      {selectedStreamer && !viewerActive ? (
        <form className="public-participation-join" onSubmit={requestJoin}>
          <div className="public-participation-join-head">
            <span aria-hidden="true" className="public-participation-join-head-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            </span>
            <h3>{t().participationJoinTitle}</h3>
            <span className="public-participation-tag" data-tone={isOpen ? "good" : "warn"}>
              {isOpen ? t().participationSessionRecruiting : t().participationSessionClosed}
            </span>
          </div>

          {status.connected ? (
            <>
              <div className="public-participation-field">
                <label className="public-participation-field-label" htmlFor="public-participation-riot-id">
                  {t().participationRiotIdLabel}
                </label>
                <input
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
              </div>

              <div className="public-participation-field">
                <span className="public-participation-field-label" id="public-participation-role-label">
                  {t().participationRoleLabel}
                </span>
                <div aria-labelledby="public-participation-role-label" className="public-participation-roles" role="group">
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
              </div>

              <button
                className="public-participation-submit"
                disabled={!canJoin || joining || !riotId.trim()}
                type="submit"
              >
                {joining
                  ? t().participationSubmitting
                  : canRejoin ? t().participationRejoin : t().participationSubmit}
                {!joining ? (
                  <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
                ) : null}
              </button>
            </>
          ) : (
            /* 로그인 버튼만 있으면 왜 필요한지 말하지 않습니다(목업 「참여 · 로그인 전」). */
            <div className="public-participation-login">
              <span aria-hidden="true" className="public-participation-login-icon">
                <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" viewBox="0 0 24 24" width="20">
                  <rect height="11" rx="2" width="18" x="3" y="11" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <b>{t().participationLoginRequiredTitle}</b>
              <span>{t().participationLoginRequiredBody}</span>
              <Button type="button" onClick={onLogin}>{t().twitchViewerLogin}</Button>
            </div>
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
            const name = item.isViewer ? t().participationViewerBadge : item.twitchUserName;
            return {
              /* 아바타 이미지는 대기열 응답에 없습니다 — 스트리머 전환 바와 같은
                 방식으로 이름 첫 글자를 씁니다(가짜 이미지를 만들지 않습니다). */
              avatar: name.slice(0, 1).toLocaleUpperCase(),
              champions: (item.topChampions ?? []).slice(0, 2).map((champion) => ({
                iconUrl: champion.iconUrl ? assetUrl(champion.iconUrl) : undefined,
                key: String(champion.championId),
              })),
              ...publicParticipationRowDetail(item),
              isViewer: item.isViewer,
              key: `${item.position}-${item.twitchUserName}`,
              name,
              position: item.position,
              statusLabel: item.isViewer && viewerPhase
                ? publicParticipationPhaseLabel(viewerPhase)
                : rowStatus?.label,
              statusTone: item.isViewer ? "brand" : rowStatus?.tone,
            };
          })}
          text={{
            colChampion: t().champion,
            colOrder: t().participationQueueColOrder,
            colStatus: t().participationQueueColStatus,
            /* 「티어 · 포지션」은 기존 두 키의 조합입니다 — 새 키를 만들지 않습니다. */
            colTier: `${t().tier} · ${t().rolePanelTitle}`,
            colViewer: t().participationQueueColViewer,
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

function formatPublicDateTime(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(publicIntlLocale(), {
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
  const title = style?.name ?? runeName(styleRune) ?? (kind === "primary" ? publicLocaleText("주 룬", "メインルーン", "Primary rune") : publicLocaleText("부 룬", "サブルーン", "Secondary rune"));
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
  const shardTitle = publicLocaleText("능력치 파편", "ステータスシャード", "Stat shards");
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
      label: publicLocaleText("스킬 빌드", "スキルビルド", "Skill build"),
      ko: publicI18n.ko.matchBuildTab,
      ja: publicI18n.ja.matchBuildTab
    },
    runesLabel: {
      label: t().runes,
      ko: publicI18n.ko.runes,
      ja: publicI18n.ja.runes
    },
    skillOrderLabel: publicLocaleText("스킬 순서", "スキル順", "Skill order"),
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
  if (viewModel.state !== "ready") {
    return <FeatureRecentMatchBuildPanel viewModel={viewModel} onSelectParticipant={onSelect} />;
  }

  // 선택된 참가자를 뷰모델에서 되찾아 머리말에 씁니다.
  const selected = viewModel.participants.find((participant) => participant.active) ?? viewModel.participants[0];
  const allyTeamId = match.teams.find((team) => team.players.some((player) => player.isTarget))?.teamId;
  const buildParticipants = build?.participants ?? [];
  const isAlly = (key: string) => {
    const participant = buildParticipants.find((item) => buildParticipantKey(item) === key);
    return allyTeamId === undefined ? true : participant?.teamId === allyTeamId;
  };
  const selectedBuild = buildParticipants.find((item) => buildParticipantKey(item) === selected?.key);

  return (
    <FeatureMatchBuildBoard
      headline={{
        championIcon: selectedBuild?.champion.iconUrl
          ? <img alt="" src={assetUrl(selectedBuild.champion.iconUrl)} />
          : undefined,
        championName: viewModel.summary.championLabel,
        detail: `${viewModel.summary.scoreLabel} ${formatNumber(selectedBuild?.score ?? 0)}`,
        name: viewModel.summary.participantLabel,
        // 룬은 아래 룬 보드가 맡습니다. 머리말에는 소환사 주문만 둡니다.
        spells: (selectedBuild?.summonerSpells ?? []).length > 0
          ? (
            <>
              {(selectedBuild?.summonerSpells ?? []).slice(0, 2).map((spellId) => (
                <img alt="" key={spellId} src={summonerSpellIconUrl(spellId, dataDragonVersion)} />
              ))}
            </>
          )
          : undefined
      }}
      items={viewModel.itemSlots.map((item) => ({
        icon: item.iconUrl ? <img alt="" src={item.iconUrl} /> : undefined,
        key: item.key,
        timeLabel: item.minuteLabel === "-" ? undefined : item.minuteLabel
      }))}
      onSelectParticipant={onSelect}
      participants={viewModel.participants.map((participant) => ({
        championIcon: participant.championIconUrl
          ? <img alt="" src={participant.championIconUrl} />
          : undefined,
        isAlly: isAlly(participant.key),
        isSelected: participant.active,
        key: participant.key,
        label: participant.title,
        score: participant.score
      }))}
      runes={<FeatureRecentMatchBuildRuneBoard label={viewModel.runesLabel} noDataLabel={viewModel.noDataLabel} runeColumns={viewModel.runeColumns} />}
      skills={(["Q", "W", "E", "R"] as const).map((key) => ({
        key,
        levels: (viewModel.skillRows.find((row) => row.key === key)?.cells ?? [])
          .map((cell, index) => (cell.label ? index + 1 : 0))
          .filter((level) => level > 0)
      }))}
      text={{
        allyLabel: t().buildAllyTeam,
        ariaLabel: viewModel.ariaLabel,
        enemyLabel: t().buildEnemyTeam,
        itemsLabel: t().buildItemOrder,
        noTimeLabel: t().buildNoTime,
        runesLabel: viewModel.runesLabel.label,
        skillsLabel: viewModel.skillOrderLabel
      }}
    />
  );
}

/* 와드(장신구, Riot slot 6)는 항상 마지막 칸입니다(후속 §1-3) — 접힌 행의
   trinketSlot 분리와 같은 규칙. 순서를 다시 섞으면 10명의 와드가 네 번째에
   끼어들어 열이 어긋납니다. 빈 칸은 자리를 지킵니다(세로 정렬). */
function fixedTeamItemSlots(items: PublicLolMatchParticipant["items"]): Array<PublicLolMatchParticipant["items"][number] | undefined> {
  const slots = Array<PublicLolMatchParticipant["items"][number] | undefined>(7).fill(undefined);
  items.forEach((item, index) => {
    const slot = item.slot >= 0 && item.slot < slots.length ? item.slot : index;
    if (slot >= 0 && slot < slots.length && !slots[slot] && item.itemId > 0) slots[slot] = item;
  });
  return [0, 1, 2, 3, 4, 5, 6].map((slot) => slots[slot]);
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

/* 팀 비교 뷰모델·컴포넌트는 후속 §1-4 에서 제거했습니다. */

function searchableRiotIdViewModel({
  riotId,
  fallback,
  badges,
  streamer,
  lolPlatform
}: {
  riotId: string | undefined;
  fallback: string;
  badges?: PublicLolMatchBadge[];
  streamer?: PublicLolTwitchStream;
  /* 주면 이름이 그 사람 전적 페이지로 가는 새 탭 링크가 됩니다(전적 행).
     같은 경기의 참가자는 같은 플랫폼이라 이 프로필의 플랫폼을 그대로 씁니다.
     주지 않으면 지금처럼 화면 안에서 검색합니다(현재 게임 패널). */
  lolPlatform?: string;
}): SearchableRiotIdViewModel {
  const display = splitRiotId(riotId, fallback);
  const visibleStreamer = visibleStreamerStream(streamer);
  const href = riotId && lolPlatform
    ? localizedPublicUrlForCurrentLocale(
        publicSummonerPath(riotId, normalizeLolPlatformId(lolPlatform) ?? DEFAULT_PUBLIC_LOL_PLATFORM)
      )
    : undefined;
  const title = riotId
    ? visibleStreamer
      ? `${t().twitchStreamer} · ${visibleStreamer.isLive ? t().twitchOnlineShort : t().twitchOfflineShort} · ${riotId}`
      : `${href ? t().openProfileNewTab : t().search}: ${riotId}`
    : undefined;
  return {
    kind: riotId ? "button" : "static",
    className: `${riotId ? "public-riot-id-link" : "public-riot-id-static"} ${visibleStreamer ? "streamer" : ""}`,
    name: display.name,
    tag: display.tag,
    riotId,
    href,
    title,
    badges: riotIdAwardBadgeViewModels(badges)
  };
}

function SearchableRiotId(props: {
  riotId: string | undefined;
  fallback: string;
  badges?: PublicLolMatchBadge[];
  streamer?: PublicLolTwitchStream;
  /* 주면 이름이 새 탭 전적 링크가 됩니다 — searchableRiotIdViewModel 참고. */
  lolPlatform?: string;
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

/* 팀 격차 스트립 — 골드·딜·오브젝트 격차와 내 순위(목업 v28 요약 카드).
   기존 라인 비교의 gap 카드 문법(public-md-gap)을 그대로 승계합니다. */
type MatchGapCard = { key: string; label: string; tone?: "up" | "down" | "flat"; value: string };

function MatchGapStrip({ match }: { match: PublicLolRecentMatch }) {
  const gap = matchGap(match);
  if (!gap) return null;
  const signed = (value: number) => `${value > 0 ? "+" : ""}${formatNumber(value)}`;
  const tone = (value: number) => (value > 0 ? "up" as const : value < 0 ? "down" as const : "flat" as const);
  const gapCards: MatchGapCard[] = [
    { key: "gold", label: t().goldGap, tone: tone(gap.gold), value: signed(gap.gold) },
    { key: "damage", label: t().damageGap, tone: tone(gap.damage), value: signed(gap.damage) },
    {
      key: "objective",
      label: t().objectiveGap,
      tone: tone(gap.objectives.ally - gap.objectives.enemy),
      value: `${formatNumber(gap.objectives.ally)} : ${formatNumber(gap.objectives.enemy)}`
    },
    ...(gap.myRank
      ? [{
        key: "rank",
        label: t().myTeamRank,
        value: t().teamRankValue.replace("{rank}", String(gap.myRank)).replace("{total}", String(gap.teamSize))
      }]
      : [])
  ];
  if (gapCards.length === 0) return null;
  return (
    <dl className="public-md-gap">
      {gapCards.map((card) => (
        <div key={card.key}>
          <dt>{card.label}</dt>
          <dd data-tone={card.tone ?? "flat"}>{card.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MatchTeamDetails({
  match,
  rankDetail,
  rankLoading,
  hideRiotIds,
  lolPlatform,
  onSearchRiotId
}: {
  match: PublicLolRecentMatch;
  rankDetail?: PublicLolMatchRankResponse;
  rankLoading?: boolean;
  hideRiotIds: boolean;
  /* 참가자 이름을 새 탭 전적 링크로 만들 플랫폼(사용자 요청 2026-08-24). */
  lolPlatform?: string;
  onSearchRiotId: (riotId: string) => void;
}) {
  if (match.teams.length === 0) return null;
  const maxDamage = matchTeamTotal(match, (player) => player.damageDealtToChampions);
  const dataDragonVersion = recentMatchDataDragonVersion(match);
  /* 본인 팀이 식별될 때만 상대 팀을 접을 수 있게 표시합니다(목업 §3-1) —
     대상이 없는 경기에서 두 팀을 모두 접어 버리지 않기 위한 가드입니다. */
  const hasTargetTeam = match.teams.some((team) => team.players.some((player) => player.isTarget));
  const teams: MatchTeamDetailsTeam[] = match.teams.map((team) => {
    const teamRankStats = team.players.map((player, index) => matchRankForPlayer(rankDetail, team.teamId, player, index));
    const tierSummary = rankLoading
      ? t().tierLoading
      : rankDetail
        ? `${t().averageTier} ${averageTierLabel(teamRankStats)}`
        : t().tierUnavailable;
    const isAllyTeam = team.players.some((player) => player.isTarget);
    return {
      key: `${match.matchId}:${team.teamId}`,
      className: `public-team-card ${isAllyTeam ? "ally" : "enemy"}`,
      enemy: hasTargetTeam && !isAllyTeam,
      /* 목업 v28 팀 헤더는 진영명(블루/레드) — 아군 여부는 테두리 대신 본인 행 강조로 구분. */
      label: team.teamId === 100 ? t().blueTeam : team.teamId === 200 ? t().redTeam : teamLabel(team),
      /* 결과 단어만 승/패 전용색 — 합계 KDA 는 무채(목업 v28 팀 헤더). */
      resultSummary: (
        <>
          <b className={`public-team-result ${team.result}`}>{resultLabel(team.result)}</b>
          {` · ${team.kills}/${team.deaths}/${team.assists}`}
        </>
      ),
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
            live: visibleStreamer.isLive
          } : undefined,
          riotId: searchableRiotIdViewModel({
            riotId: hideRiotIds ? undefined : player.riotId,
            fallback: hideRiotIds ? maskedRiotIdName(player.riotId, playerDisplayName(player)) : playerDisplayName(player),
            badges: playerHighlightBadges,
            streamer: hideRiotIds ? undefined : player.twitchStream,
            lolPlatform
          }),
          mobileKda: {
            /* 모바일 한 줄 행은 "KDA" 글자 없이 수치만 — 이름 열(≈65px)에서
               라벨이 아이템 열을 침범했습니다(사용자 지시 2026-08-21).
               맥락은 aria-label(kdaLabel)이 계속 알립니다. */
            score: `${player.kills}/${player.deaths}/${player.assists}`,
            metric: <span className={metricToneClass(kdaTone(player.kda))}>{formatDecimal(player.kda, 2)}</span>
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
              label: t().teamColDamage,
              labelClassName: metricToneClass(teamShareTone(player.damageShare))
            }),
            /* CS·시야는 값 + 보조 줄 한 셀(목업 §2-3) — 트랙은 피해량에만 둡니다. */
            csVision: {
              value: formatNumber(player.cs),
              sub: `${formatDecimal(player.csPerMinute, 1)}${t().matchStatPerMinuteSuffix} · ${t().vision} ${formatNumber(player.visionScore)}`
            },
            /* 모바일 두 줄 카드의 아랫줄 — 지표를 숨기지 않고 되살립니다(목업 모바일). */
            mobileMetrics: {
              label: (
                <>
                  {t().teamColDamage} <b>{formatNumber(player.damageDealtToChampions)}</b>
                  {" · CS "}<b>{formatNumber(player.cs)}</b>
                  {` · ${t().vision} `}<b>{formatNumber(player.visionScore)}</b>
                </>
              ),
              fillWidth: barWidth(player.damageDealtToChampions, maxDamage)
            }
          }
        };
      }),
      /* 팀 비교 막대는 후속 §1-4 에서 삭제 — 요약 4칸(MatchGapStrip)과 같은 값의
         중복이었고 두 팀 카드 사이의 흐름을 끊었습니다. */
    };
  });

  return (
    <FeatureMatchTeamDetails
      ariaLabel={t().teamDetails}
      columns={{
        champion: t().teamColChampion,
        summoner: t().teamColSummoner,
        kda: t().kda,
        damage: t().teamColDamage,
        csVision: t().teamColCsVision,
        items: t().arenaColItems
      }}
      enemyToggleLabel={t().enemyTeam}
      kdaLabel={t().kda}
      onSearchRiotId={onSearchRiotId}
      teams={teams}
    />
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

/* 인게임 — 목업 "LoL 탭 리디자인"(인게임 · 게임 중 / 대기·확인·오류 보드).
 *
 * 클래스는 .public-ingame-board 이하 신설 네임스페이스입니다 — 02-legacy 의
 * .public-ingame-panel/-empty/-teams 파스텔 !important 58건과 셀렉터를 아예
 * 공유하지 않아, 39-ink-ingame.css 가 pages layer 에서 !important 없이 단독
 * 소유합니다(§4 소유자 전략).
 *
 * 데이터 사실(목업과 의도적으로 다른 부분):
 * - 룬: PublicLolCurrentGameParticipant 에 runes 가 없어 룬 원을 그리지 않습니다.
 * - 챔피언 레벨·포지션: 실시간 데이터에 없어 배지·라벨을 만들지 않습니다.
 * - '최근 20경기' 칸: rankedStats 는 해당 큐 시즌 누적이라 '시즌 전적'으로 표기. */
function IngamePanel({
  profile,
  onSearchRiotId,
  onRecheck
}: {
  profile: PublicLolProfile;
  onSearchRiotId: (riotId: string) => void;
  onRecheck?: () => void;
}) {
  const liveGame = profile.liveGame;
  const isLive = liveGame?.isLive === true;
  const isChecking = liveGame?.status === "checking";
  const isUnavailable = liveGame?.status === "unavailable";
  const state = isLive ? "live" : isChecking ? "checking" : isUnavailable ? "unavailable" : "offline";
  const participants = liveGame?.participants ?? [];
  /* 목업은 아군 팀을 항상 왼쪽(먼저)에 둡니다. */
  const allyTeamId = participants.find((participant) => participant.isTarget)?.teamId;
  const teamIds = [...new Set(participants.map((participant) => participant.teamId))]
    .sort((a, b) => (a === allyTeamId ? -1 : b === allyTeamId ? 1 : a - b));
  const spellVersion = profileDataDragonVersion(profile);
  const expectedParticipants = Math.max(10, participants.length);
  const platformLabel = liveGame?.lolPlatform ?? profile.lolPlatform;
  /* 이름 링크에 쓸 플랫폼. platformLabel 은 화면 표시용이라 알 수 없는 값이 올 수
     있고, 그대로 넘기면 publicSummonerPath 의 기본값(jp1)으로 조용히 새어
     엉뚱한 서버의 전적을 엽니다 — 그럴 때는 이 프로필의 플랫폼으로 떨어뜨립니다. */
  const linkPlatform = normalizeLolPlatformId(platformLabel) ? platformLabel : profile.lolPlatform;
  /* 모바일: 상대 팀은 접혀 있고 토글로 펼칩니다(목업 모바일 보드). */
  const [enemyOpen, setEnemyOpen] = useState(false);

  return (
    <section aria-busy={isChecking} className={`public-ingame-board ${state}`} id="public-ingame">
      <div className="public-ingame-status">
        <div className="public-ingame-head">
          <h2>{t().currentGameStatus}</h2>
          <span className={`public-ingame-state ${state}`} role={isChecking ? "status" : undefined}>
            <i aria-hidden="true" />
            {isLive ? t().currentlyInGame : isChecking ? t().currentGameChecking : isUnavailable ? t().currentGameUnavailable : t().notInGame}
          </span>
          <span className="public-ingame-auto">{t().ingameAutoRefresh}</span>
          <small className="public-ingame-meta">
            {t().currentGameUpdated} {formatRelativeDate(liveGame?.fetchedAt)} · {t().currentGamePlatform} {platformLabel}
          </small>
        </div>

        {!isLive ? (
        <div className="public-ingame-idle">
          {/* 수묵 붓선(목업) — 흰 그라데이션 박스 자리의 장식. */}
          <svg aria-hidden="true" className="public-ingame-ink" viewBox="0 0 220 60">
            <path d="M8 42 C 60 10, 120 52, 212 20" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M16 50 C 70 26, 130 58, 206 32" fill="none" opacity=".6" stroke="currentColor" strokeWidth=".6" />
          </svg>
          <strong>{isChecking ? t().currentGameChecking : isUnavailable ? t().currentGameUnavailable : t().notInGame}</strong>
          {isChecking ? <small>{t().currentGameCheckingDetail}</small> : null}
          {isUnavailable ? <small>{t().currentGameUnavailableDetail}</small> : null}
          <small>{t().currentGamePlatform} {platformLabel} · {t().fetchedAt} {formatDate(liveGame?.fetchedAt)}</small>
          {isChecking ? (
            <span aria-hidden="true" className="public-ingame-progress"><i /></span>
          ) : (
            <div className="public-ingame-idle-actions">
              <button className="public-ingame-recheck" onClick={() => onRecheck?.()} type="button">
                <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" viewBox="0 0 24 24" width="13">
                  <path d="M20 11A8 8 0 0 0 6.3 6.3L3 9" />
                  <path d="M3 4v5h5" />
                  <path d="M4 13a8 8 0 0 0 13.7 4.7L21 15" />
                  <path d="M21 20v-5h-5" />
                </svg>
                {t().matchListRetry}
              </button>
            </div>
          )}
        </div>
        ) : (
          /* 상태 헤드 4칸 — 카드 4장 대신 분할선 한 줄, 경과만 22px(목업). */
          <div className="public-ingame-facts">
            <div className="public-ingame-fact is-elapsed">
              <span>{t().currentGameDuration}</span>
              <strong>{formatDuration(liveGame.gameLengthSeconds)}</strong>
            </div>
            <div className="public-ingame-fact">
              <span>{t().currentGameMode}</span>
              <strong>{currentGameQueueLabel(liveGame)}</strong>
            </div>
            <div className="public-ingame-fact">
              <span>{t().currentGameParticipants}</span>
              <strong>
                {participants.length} / {expectedParticipants}
                {participants.length >= expectedParticipants ? <small>{t().ingameAllConnected}</small> : null}
              </strong>
            </div>
            <div className="public-ingame-fact">
              <span>{t().currentGameAverageTier}</span>
              <strong>{averageTierLabel(participants.map((participant) => participant.rankedStats))}</strong>
            </div>
          </div>
        )}
      </div>

      {isLive ? (
        <div className="public-ingame-sides">
            {teamIds.map((teamId) => {
              const isAlly = allyTeamId !== undefined && teamId === allyTeamId;
              const members = participants.filter((participant) => participant.teamId === teamId);
              const sideAverageTier = averageTierLabel(members.map((participant) => participant.rankedStats));
              const collapsed = !isAlly && !enemyOpen;
              return (
                <article
                  className={`public-ingame-side ${isAlly ? "is-ally" : "is-enemy"}${collapsed ? " is-collapsed" : ""}`}
                  key={`current-game:${teamId}`}
                >
                  <div className="public-ingame-side-head">
                    <i aria-hidden="true" className="public-ingame-side-mark" />
                    <b>{allyTeamId === undefined ? currentGameTeamLabel(teamId) : isAlly ? t().allyTeam : t().enemyTeam}</b>
                    <span>{members.length}/5 · {t().currentGameAverageTier} {sideAverageTier}</span>
                    <em className="public-ingame-side-chip">{currentGameTeamLabel(teamId)}</em>
                    {!isAlly ? (
                      <button
                        aria-expanded={enemyOpen}
                        className="public-ingame-enemy-toggle"
                        onClick={() => setEnemyOpen((current) => !current)}
                        type="button"
                      >
                        {t().enemyTeam}
                        <svg aria-hidden="true" fill="none" height="5" stroke="currentColor" strokeWidth="1" viewBox="0 0 8 5" width="8">
                          <path d="M1 1 L 4 4 L 7 1" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  <div aria-hidden="true" className="public-ingame-cols">
                    <span>{t().champion}</span>
                    <span>{t().summonerResults}</span>
                    <span>{t().ingameSpellsShort}</span>
                    <span data-cell="tier">{t().tier}</span>
                    <span data-cell="record">{t().ingameSeasonRecord}</span>
                  </div>
                  <div className="public-ingame-rows">
                    {members.map((participant, index) => {
                      const spellIcons = participant.summonerSpells
                        .map((spellId) => ({ spellId, iconUrl: summonerSpellIconUrl(spellId, spellVersion) }))
                        .slice(0, 2);
                      const stats = participant.rankedStats;
                      const hasRecord = stats !== undefined && stats.tier !== "UNRANKED" && stats.wins + stats.losses > 0;
                      return (
                        <div
                          className={`public-ingame-row${participant.isTarget ? " is-target" : ""}`}
                          key={`${teamId}:${participant.riotId ?? participant.champion.championId}:${index}`}
                        >
                          <span className="public-ingame-champ">
                            {participant.champion.iconUrl
                              ? <img alt="" src={participant.champion.iconUrl} />
                              : <span>{championName(participant.champion).slice(0, 1)}</span>}
                          </span>
                          <span className="public-ingame-name">
                            <span className="public-ingame-name-line">
                              <SearchableRiotId
                                fallback={participant.isTarget ? profile.riotId : championName(participant.champion)}
                                lolPlatform={linkPlatform}
                                onSearch={onSearchRiotId}
                                riotId={participant.riotId}
                              />
                              {participant.isTarget ? <em className="public-ingame-me">{t().matchTeamSelf}</em> : null}
                            </span>
                            <small>
                              {championName(participant.champion)}
                              {participant.bot ? ` · ${t().currentGameBot}` : ""}
                              {/* 모바일(<48rem)은 티어 열이 접히므로 여기로 병합합니다(목업 모바일). */}
                              {stats && stats.tier !== "UNRANKED"
                                ? <span className="public-ingame-name-tier"> · {matchRankBadgeLabel(stats)} {stats.leaguePoints} LP</span>
                                : <span className="public-ingame-name-tier"> · {t().unranked}</span>}
                            </small>
                          </span>
                          <span className="public-ingame-spells">
                            {spellIcons.length > 0 ? spellIcons.map((spell) => (
                              <i key={`${participant.riotId ?? index}:spell:${spell.spellId}`}>
                                {spell.iconUrl ? <img alt="" src={spell.iconUrl} /> : null}
                              </i>
                            )) : (
                              <>
                                <i />
                                <i />
                              </>
                            )}
                          </span>
                          <span className="public-ingame-tier">
                            {stats && stats.tier !== "UNRANKED" ? (
                              <>
                                <b>{matchRankBadgeLabel(stats)}</b>
                                <small>{stats.leaguePoints} LP</small>
                              </>
                            ) : (
                              <>
                                <b className="is-unranked">{t().unranked}</b>
                                <small>—</small>
                              </>
                            )}
                          </span>
                          <span className="public-ingame-record">
                            {hasRecord ? (
                              <>
                                <b>{formatPercent(stats.winRate)}</b>
                                <small>
                                  <span className="is-win">{winsText(stats.wins)}</span>{" "}
                                  <span className="is-loss">{stats.losses}{publicLocaleText("패", "敗", "L")}</span>
                                </small>
                              </>
                            ) : (
                              <small className="is-none">{t().unknown}</small>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
        </div>
      ) : null}
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
  const [matchRankErrors, setMatchRankErrors] = useState<Record<string, string>>({});
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
    setMatchRankErrors({});
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
    /* 목록 응답의 teams 는 행 표기용 '경량 요약'(아이템·지표 없음)이라 상세 로드
       완료의 증거가 아닙니다 — detail 캐시만 가드 기준으로 삼습니다. */
    if (
      matchDetails[match.matchId]
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
    setMatchRankErrors((current) => ({ ...current, [matchId]: "" }));
    try {
      const response = await getPublicLolMatchRanks(matchId);
      setMatchRanks((current) => ({ ...current, [matchId]: response }));
    } catch {
      // 티어 조회 실패는 전적 상세 자체를 숨기지 않습니다.
      setMatchRankErrors((current) => ({ ...current, [matchId]: t().tierUnavailable }));
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
          /* 아레나(1700/1710/1750) — placement 가 온 응답에서만 순위 문법으로 전환.
             구 서버·구 캐시(placement 없음)는 기존 승/패 행 그대로(fail-soft,
             목업 lol-arena-match-row.html §⑥). */
          const arenaPlacement = isArenaQueue(match.queueId) && typeof match.placement === "number" && match.placement >= 1
            ? Math.trunc(match.placement)
            : undefined;
          const arena = arenaPlacement !== undefined;
          const rankDetail = matchRanks[match.matchId];
          const rankLoading = Boolean(matchRankLoading[match.matchId]);
          const rankError = matchRankErrors[match.matchId] ?? "";
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
              className: iconUrl ? "spell" : "spell empty",
              label: `${t().summonerSpells} ${spellId}`,
              /* 미해석 스펠은 숫자 노출 금지 — 빈 프레임 + title(목업 v1.4 §⑦). */
              content: iconUrl ? <img src={iconUrl} alt="" /> : null
            };
          });
          /* 증강 픽 — 실게임 아이콘·희귀도 프레임(LolAugmentIcon), 픽 순서 배지.
             아레나는 6픽이라 스펠 열이 아니라 전용 3×2 격자(loadoutGridItems)로 갑니다. */
          const augmentItems: RecentMatchRowMediaItem[] = (match.augments ?? []).map((augmentId, augmentIndex) => ({
            key: `${match.matchId}:augment:${augmentId}:${augmentIndex}`,
            className: "augment",
            label: `${arena ? t().arenaColAugments : t().aramMayhemQueue} ${augmentIndex + 1}`,
            content: <LolAugmentIcon id={augmentId} order={arena ? undefined : augmentIndex + 1} />
          }));
          if (!arena) spellItems.push(...augmentItems);
          /* 아레나는 룬이 없음 — 잘못 채워진 응답이 와도 행에 그리지 않습니다(목업 v1.4). */
          playerRuneBuildSlotsViewModel(arena ? [] : targetRunes)
            .filter((rune) => rune.iconUrl)
            .forEach((rune) => spellItems.push({
              key: `${match.matchId}:rune:${rune.key}`,
              className: "rune",
              label: rune.title ?? t().runes,
              content: <img src={rune.iconUrl} alt="" />
            }));
          // 모든 지표 셀은 "값 위 / 라벨 아래" 한 규칙을 씁니다. 비율 지표에는 게이지를 붙여
          // 수치를 읽지 않아도 크기가 보이게 합니다.
          // 아레나는 CS·시야가 무의미 → 킬관여/딜비중/받은피해(목업 §②).
          const matchMetrics: RecentMatchRowMetric[] = arena ? [
            {
              key: "kill-participation",
              label: t().killParticipation,
              labelShort: t().matchStatKillParticipationShort,
              ratio: match.killParticipation,
              value: <span className={metricToneClass(percentTone(match.killParticipation))}>{formatPercent(match.killParticipation)}</span>
            },
            {
              key: "damage-share",
              label: t().matchStatDamageShare,
              labelShort: t().matchStatDamageShareShort,
              ratio: match.damageShare,
              /* 5인 지분에 승률용 percentTone(70/55/45/35)을 쓰면 excellent·good·
                 neutral 이 구조적으로 안 나옵니다(운영 19행 실측: bad 17 · warning 2).
                 펼침 패널 선수 줄과 같은 teamShareTone(23/17/12)으로 맞춥니다. */
              value: <span className={metricToneClass(teamShareTone(match.damageShare))}>{formatPercent(match.damageShare)}</span>
            },
            {
              key: "damage-taken",
              label: t().damageTaken,
              value: <span>{match.damageTaken !== undefined ? `${(match.damageTaken / 1_000).toFixed(1)}k` : "-"}</span>
            }
          ] : [
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
              /* 5인 지분에 승률용 percentTone(70/55/45/35)을 쓰면 excellent·good·
                 neutral 이 구조적으로 안 나옵니다(운영 19행 실측: bad 17 · warning 2).
                 펼침 패널 선수 줄과 같은 teamShareTone(23/17/12)으로 맞춥니다. */
              value: <span className={metricToneClass(teamShareTone(match.damageShare))}>{formatPercent(match.damageShare)}</span>
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
          // 아레나는 장신구 슬롯이 없어 6칸 고정(목업 §②).
          const inlineItemSlots: RecentMatchRowMediaItem[] = recentItemSlots.slice(0, 6).map(itemSlotMediaItem);
          const trinketSlot = arena ? undefined : itemSlotMediaItem(recentItemSlots[6], 6);
          // 목록 응답의 teams 는 비어 있고 경기를 펼칠 때 채워집니다. 데이터가 있을 때만 그립니다.
          /* 행의 팀원 2열은 '목록 응답'의 teams 만 씁니다(목업 "전적 행 — 네 가지
             수정" §2-2·§4). hydratedMatch(펼침 시 detail 병합)를 쓰면 펼쳐 본
             행에만 팀 열이 생겨 행마다 격자가 어긋납니다 — 목록 응답에 팀
             요약이 오면 모든 행이 한꺼번에 채워집니다. */
          const compositionTeams = (match.teams ?? []).filter((team) => team.players.length > 0);
          const targetTeamId = compositionTeams
            .find((team) => team.players.some((player) => player.isTarget))?.teamId;
          /* 팀원 열에 Riot ID 병기(목업 v30) — 가리기 ON이면 마스킹, 없으면 챔피언명. */
          const teamMemberName = (riotId: string | undefined, fallback: string): string =>
            hideRiotIds ? maskedRiotIdName(riotId, fallback) : splitRiotId(riotId, fallback).name;
          /* 이름 → 그 사람 전적(새 탭). 가리기 ON 이면 링크도 함께 없앱니다 —
             마스킹된 이름 옆에 진짜 Riot ID 가 담긴 주소를 남기면 가리기가 무의미해집니다. */
          const teamMemberLink = (riotId: string | undefined): Pick<RecentMatchRowTeamMember, "nameHref" | "nameTitle"> =>
            hideRiotIds || !riotId
              ? {}
              : {
                nameHref: localizedPublicUrlForCurrentLocale(
                  publicSummonerPath(riotId, normalizeLolPlatformId(profile.lolPlatform) ?? DEFAULT_PUBLIC_LOL_PLATFORM)
                ),
                nameTitle: `${t().openProfileNewTab}: ${riotId}`
              };
          const teamMember = (player: PublicLolMatchParticipant, side: string, index: number): RecentMatchRowTeamMember => ({
            key: `${match.matchId}:${side}:${index}:${player.champion.championId}`,
            label: player.isTarget ? `${t().matchTeamSelf} · ${championName(player.champion)}` : championName(player.champion),
            name: teamMemberName(player.riotId, championName(player.champion)),
            ...teamMemberLink(player.riotId),
            isTarget: player.isTarget,
            content: player.champion.iconUrl
              ? <img src={player.champion.iconUrl} alt="" />
              : <i aria-hidden="true">{championName(player.champion).slice(0, 1)}</i>
          });
          const allyPlayers = compositionTeams.find((team) => team.teamId === targetTeamId)?.players ?? [];
          const opponentPlayers = compositionTeams.find((team) => team.teamId !== targetTeamId)?.players ?? [];
          /* 아레나: 행에는 내 팀 3인 얼굴만 — 상대 챔피언은 행에서 제외(목업 v1.4,
             6팀 칩은 폭 과점·겹침으로 폐기). 6팀 구도는 확장 순위표가 전담합니다. */
          const arenaMyTeam = arena && match.arenaTeams && match.arenaTeams.length > 0
            ? match.arenaTeams.find((team) => team.players.some((player) => player.isTarget))
            : undefined;
          const teams: RecentMatchRowTeams | undefined = arenaMyTeam
            ? {
              allies: arenaMyTeam.players.map((player, index): RecentMatchRowTeamMember => ({
                key: `${match.matchId}:arena:ally:${index}`,
                label: player.isTarget ? `${t().matchTeamSelf} · ${championName(player.champion)}` : championName(player.champion),
                name: teamMemberName(player.riotId, championName(player.champion)),
                ...teamMemberLink(player.riotId),
                isTarget: player.isTarget,
                content: player.champion.iconUrl
                  ? <img src={player.champion.iconUrl} alt="" />
                  : <i aria-hidden="true">{championName(player.champion).slice(0, 1)}</i>
              })),
              opponents: [],
              compositionLabel: t().arenaTeamsLabel,
              alliesLabel: t().arenaMyTeam,
              opponentsLabel: ""
            }
            : !arena && allyPlayers.length > 0 && opponentPlayers.length > 0
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
          const recordContent = arena && match.arenaTeams && match.arenaTeams.length > 0 ? (
            <ArenaStandings hideRiotIds={hideRiotIds} teams={match.arenaTeams} />
          /* 목록의 경량 teams(행 표기용)로는 상세 테이블을 그리지 않습니다 —
             아이템·지표가 비어 부실 표가 잠깐 보입니다. detail 도착 기준. */
          ) : matchDetail && (hydratedMatch.teams?.length ?? 0) > 0 ? (
            <div className="public-md-record">
              <MatchGapStrip match={hydratedMatch} />
              <MatchTeamDetails match={hydratedMatch} rankDetail={rankDetail} rankLoading={rankLoading} hideRiotIds={hideRiotIds} lolPlatform={profile.lolPlatform} onSearchRiotId={onSearchRiotId} />
              {rankError ? <FormError role="status">{rankError}</FormError> : null}
            </div>
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
          /* 다시보기(목업 v27 행 ⑦ + v34 구현 노트) — 서버가 replay 를 준 경기만.
             행 요약은 클릭이 확장 토글이라 전파를 끊습니다. */
          const replayHref = match.replay
            ? `https://www.twitch.tv/videos/${encodeURIComponent(match.replay.vodId)}?t=${replayTimestampParam(match.replay.offsetSeconds)}`
            : undefined;
          const rowReplayAction = replayHref ? (
            <a
              className="public-match-card-replay"
              href={replayHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t().watchReplay}
              title={t().watchReplay}
              onClick={(event) => event.stopPropagation()}
            >
              <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 16 16" width="12">
                <path d="M4.5 2.5 L 12.5 8 L 4.5 13.5 Z" />
              </svg>
              {t().watchReplay}
            </a>
          ) : undefined;
          /* 다시보기가 없는 행(일반 유저·아카이브 없음)은 그 칸에 라인 아이콘을 놓습니다.
             포지션이 없는 큐(아레나)나 fill/unknown 은 자산이 없어 그대로 빕니다. */
          const laneIconSrc = arena ? undefined : roleIconAssets[roleIconKey(match.position)];
          const rowLaneMark = !replayHref && laneIconSrc ? (
            /* aria-hidden — 데스크톱 행에는 포지션 텍스트(.public-match-card-role)가
               이미 있어 읽어 주면 중복입니다. 모바일 상세용은 아래에서 이름을 줍니다. */
            <img aria-hidden="true" alt="" className="public-match-card-lane" src={laneIconSrc} />
          ) : undefined;
          const panelLaneMark = !replayHref && laneIconSrc ? (
            /* 모바일 행에는 포지션 텍스트가 없어 중복이 아닙니다 — 접근성 이름을 줍니다. */
            <img
              alt={mainRoleLabel(match.position)}
              className="public-md-lane"
              src={laneIconSrc}
              title={mainRoleLabel(match.position)}
            />
          ) : undefined;
          const panelReplayAction = replayHref ? (
            <a className="public-md-replay" href={replayHref} rel="noopener noreferrer" target="_blank">
              {t().watchReplay}
              <span aria-hidden="true"> ↗</span>
            </a>
          ) : undefined;
          const expandedPanel = expanded ? (
            <FeatureRecentMatchExpandedPanel
              activeView={expandedView}
              laneMark={panelLaneMark}
              replayAction={panelReplayAction}
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
              championRoleLabel={arena ? "" : mainRoleLabel(match.position)}
              championLevelLabel={formatNumber(match.championLevel)}
              expanded={expanded}
              expandedPanel={expandedPanel}
              laneMark={rowLaneMark}
              replayAction={rowReplayAction}
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
              hideScore={arena}
              loadoutGridItems={arena ? augmentItems : undefined}
              matchAriaLabel={`${arena ? t().arenaPlacement.replace("{n}", String(arenaPlacement)) : resultLabel(match.result)} · ${championName(match.champion)} · ${match.kills}/${match.deaths}/${match.assists}`}
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
              result={arena ? `arena ${arenaPlacementClass(arenaPlacement)}` : match.result}
              resultDurationLabel={formatDuration(match.durationSeconds)}
              resultLabel={arena ? t().arenaPlacement.replace("{n}", String(arenaPlacement)) : resultLabel(match.result)}
              /* 목업 행 결과열은 배지가 아니라 전용색 단어(승리/패배) — 축약형 대신 전체 라벨. */
              resultShortLabel={arena ? t().arenaPlacement.replace("{n}", String(arenaPlacement)) : resultLabel(match.result)}
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
  /* 그날의 종합(A안) — 로컬 날짜 경계마다 요약 바를 끼웁니다.
     요약은 보이는(필터 반영) 목록 합계 · docs/mockups/lol-daily-summary.html */
  const matchRowsWithDailySummaries = withLolDailySummaryBars(profile.recentMatches, matchRows);
  /* 공유 이미지는 요약(20경기)과 같은 수를 담습니다(목업 §2-7) — 현재 필터
     목록이 이미 갖고 있는 20경기를 그대로 쓰는 것이라 새 데이터가 아닙니다. */
  const shareMatches: RecentMatchShareItem[] = profile.recentMatches.slice(0, 20).map((match) => {
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
    /* 증강 칼바람(아수라장)은 Riot match-v5 에 기록되지 않음을 실측으로 확인
       (2026-08-17: 기본 ids 40경기 전수·큐 2300/2400 직접 조회 모두 부재).
       칩은 유지하되 빈 목록을 고장처럼 보이지 않게 미지원 사실을 정직하게 안내합니다. */
    emptyTitle: filters.queue === "aramMayhem"
      ? {
        label: t().aramMayhemUnsupportedTitle,
        ko: publicI18n.ko.aramMayhemUnsupportedTitle,
        ja: publicI18n.ja.aramMayhemUnsupportedTitle
      }
      : {
        label: t().noData,
        ko: publicI18n.ko.noData,
        ja: publicI18n.ja.noData
      },
    emptyDescription: filters.queue === "aramMayhem"
      ? {
        label: t().aramMayhemUnsupportedDescription,
        ko: publicI18n.ko.aramMayhemUnsupportedDescription,
        ja: publicI18n.ja.aramMayhemUnsupportedDescription
      }
      : {
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
      metaLabel: `${entry.games}${t().games}`,
      /* 목업 §3-2: 칩 안 승률만 전용색. */
      winRateLabel: formatPercent(entry.winRate),
      winRateTone: entry.winRate >= 50 ? "win" as const : "loss" as const
    }));
  const summaryStrip = profile.summary.recentGames > 0 ? (
    <RecentMatchesSummaryStrip
      averageKdaLabel={formatDecimal(profile.summary.averageKda, 2)}
      champions={summaryChampions}
      losses={recentLosses}
      text={{
        winRateLabel: t().matchSummaryRecentWinRate,
        winsLabel: t().winShort,
        lossesLabel: t().lossShort,
        averageKdaLabel: t().matchSummaryAverageKda,
        topChampionsLabel: t().matchSummaryTopChampions
      }}
      winRateCaption={`${t().recentGames} ${profile.summary.recentGames}${t().games}`}
      winRatePercent={Math.round(profile.summary.recentWinRate ?? 0)}
      wins={recentWins}
    />
  ) : undefined;
  const augmentFilterNotice = filters.augmentId !== undefined ? (
    <span className="public-match-augment-filter" data-testid="augment-filter-notice">
      <LolAugmentIcon id={filters.augmentId} />
      {t().augmentFilterActive}
      <button onClick={() => onFilters({ ...filters, augmentId: undefined })} type="button">
        {t().augmentFilterClear} ✕
      </button>
    </span>
  ) : undefined;
  const filterResultSummary = profile.summary.recentGames > 0 ? (
    <>
      <b>{profile.summary.recentGames}{t().games}</b>
      <span aria-hidden="true" className="public-match-filter-summary-dot" />
      <span className="public-match-filter-summary-win">{recentWins}{t().winShort}</span>
      {" "}
      <span className="public-match-filter-summary-loss">{recentLosses}{t().lossShort}</span>
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
          championPerformance={profile.championPerformance}
          filters={filters}
          onChange={onFilters}
          onReset={onResetFilters}
          totalGames={profile.summary.recentGames}
          /* 프래그먼트는 내용이 없어도 truthy — 빈 요약 컨테이너가 렌더되지 않게 조건부로 합칩니다. */
          resultSummary={augmentFilterNotice ? <>{filterResultSummary}{augmentFilterNotice}</> : filterResultSummary}
        />
      )}
      initialLoading={loadingMore && profile.recentMatches.length === 0}
      isEmpty={profile.recentMatches.length === 0}
      loadingMore={loadingMore}
      matchCount={`${profile.summary.recentGames}${t().games}`}
      matchRows={matchRowsWithDailySummaries}
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
            recordTitle: t().matchRecordTab,
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

/* 챔피언 분석 리디자인(2026-08-17) — 목업 docs/mockups/lol-champion-analysis-redesign.html v3.
 * legacy 의 흰 패널·파스텔 테이블(.public-panel + .public-champion-*) 대신 전적 카드·사이드바와
 * 같은 다크 문법의 .public-champ-* 네임스페이스를 pages layer(36-champion-analysis.css)에서
 * 단독 소유합니다. 서버 계약 변경 없음 — topChampions·championPerformance·rolePerformance 그대로. */

/* 목업(LoL 탭 리디자인): 6px 트랙 — 승(청자 채움) + 패(홍옥 42%) 분할.
 * 수치·승패 글자는 막대 안이 아니라 아래 줄(ChampionWinLossLine)에 둡니다. */
function ChampionSplitBar({ wins, losses }: { wins: number; losses: number }) {
  const games = wins + losses;
  const winShare = games > 0 ? Math.round((wins / games) * 100) : 0;
  return (
    <span aria-hidden="true" className="public-champ-split">
      <i style={{ width: `${winShare}%` }} />
      <em />
    </span>
  );
}

/* 막대 아래 줄 — % 무채 800 + N승(청자)/M패(홍옥) 글자(승패 데이터 전용색). */
function ChampionWinLossLine({ wins, losses, winRate }: { wins: number; losses: number; winRate: number }) {
  return (
    <small className="public-champ-wl">
      <b>{formatPercent(winRate)}</b>
      {wins > 0 ? <span className="is-win">{winsText(wins)}</span> : null}
      {losses > 0 ? <span className="is-loss">{losses}{publicLocaleText("패", "敗", "L")}</span> : null}
    </small>
  );
}

function championMasteryMeta(level: number | undefined, points: number | undefined): string | undefined {
  if (level === undefined && points === undefined) return undefined;
  return t().champSpotMasteryMeta.replace("{level}", formatNumber(level)).replace("{points}", formatNumber(points));
}

function ChampionAnalysisPanel({
  profile,
  onChampionPick
}: {
  profile: PublicLolProfile;
  onChampionPick: (championId: number) => void;
}) {
  const { active, ghosts } = championAnalysisTableRows(profile);
  const { signature, form } = championSpotlights(profile);
  const recentGames = profile.summary.recentGames;
  /* 정렬 칩(목업 §챔피언 표) — 기본은 게임 수 순(championAnalysisTableRows),
     누르면 승률순으로 재정렬합니다. */
  const [sortByWinRate, setSortByWinRate] = useState(false);
  const sortedActive = useMemo(() => sortByWinRate
    ? [...active].sort((a, b) =>
      (b.performance!.winRate - a.performance!.winRate) ||
      (b.performance!.games - a.performance!.games))
    : active, [active, sortByWinRate]);

  const head = (
    <div className="public-champ-head">
      <h2>{t().championAnalysis}</h2>
      <span className="public-champ-pill">{t().champAnalysisPill.replace("{count}", String(recentGames))}</span>
      {active.length > 1 ? (
        <button
          aria-pressed={sortByWinRate}
          className="public-champ-sort"
          onClick={() => setSortByWinRate((current) => !current)}
          type="button"
        >
          {t().champSortWinRate}
          <svg aria-hidden="true" fill="none" height="5" stroke="currentColor" strokeWidth="1" viewBox="0 0 8 5" width="8">
            <path d="M1 1 L 4 4 L 7 1" />
          </svg>
        </button>
      ) : null}
    </div>
  );

  if (!signature && active.length === 0 && ghosts.length === 0) {
    return (
      <section id="public-champions" className="public-champ-panel">
        {head}
        <div className="public-champ-empty">
          <strong>{t().champEmptyTitle}</strong>
          <span>{t().champEmptyDescription}</span>
        </div>
      </section>
    );
  }

  const signatureArt = signature ? assetUrl(signature.champion.iconUrl) : undefined;
  const formArt = form ? assetUrl(form.champion.iconUrl) : undefined;
  const signaturePerformance = signature?.performance;
  const signatureMeta = signature ? championMasteryMeta(signature.masteryLevel, signature.masteryPoints) : undefined;

  return (
    <section id="public-champions" className="public-champ-panel">
      {head}

      {signature || form ? (
        <div className="public-champ-spot">
          {signature ? (
            <article className="public-champ-spot-tile is-signature">
              <span className="public-champ-spot-tag">{t().champSpotSignatureTag}</span>
              <div className="public-champ-spot-body">
                <span className="public-champ-spot-ava">
                  {signatureArt ? <img alt="" src={signatureArt} /> : <span>{championName(signature.champion).slice(0, 1)}</span>}
                </span>
                <span className="public-champ-spot-id">
                  <b>{championName(signature.champion)}</b>
                  {signatureMeta ? <small>{signatureMeta}</small> : null}
                </span>
                {signaturePerformance ? (
                  <span className="public-champ-spot-num">
                    <span><b>{formatPercent(signaturePerformance.winRate)}</b> <small>{gamesText(signaturePerformance.games)}</small></span>
                    <span><b>{formatDecimal(signaturePerformance.averageKda, 1)}</b> <small>KDA</small></span>
                  </span>
                ) : null}
              </div>
              {/* 챔피언 아트 대신 우상단 수묵 선(목업) — 정보를 가리지 않는 장식. */}
              <svg aria-hidden="true" className="public-champ-spot-ink" viewBox="0 0 100 100">
                <circle cx="50" cy="50" fill="none" r="34" stroke="currentColor" strokeWidth=".7" />
                <path d="M22 62 C 40 30, 62 26, 80 40" fill="none" stroke="currentColor" strokeWidth=".7" />
                <path d="M26 74 C 46 46, 68 40, 84 52" fill="none" stroke="currentColor" strokeWidth=".7" />
              </svg>
            </article>
          ) : null}
          {form ? (
            <article className="public-champ-spot-tile is-form">
              <span className="public-champ-spot-tag">{t().champSpotFormTag.replace("{count}", String(recentGames))}</span>
              <div className="public-champ-spot-body">
                <span className="public-champ-spot-ava">
                  {formArt ? <img alt="" src={formArt} /> : <span>{championName(form.champion).slice(0, 1)}</span>}
                </span>
                <span className="public-champ-spot-id">
                  <b>{championName(form.champion)}</b>
                  <small>{t().champSpotFormMeta.replace("{count}", String(form.games))}</small>
                </span>
                <span className="public-champ-spot-num">
                  <span>
                    <b>{formatPercent(form.winRate)}</b>{" "}
                    <small className="is-win">{winsText(form.wins)}</small>{" "}
                    <small className="is-loss">{form.games - form.wins}{publicLocaleText("패", "敗", "L")}</small>
                  </span>
                  {form.averageDamagePerMinute !== undefined
                    ? <span><b>{formatNumber(form.averageDamagePerMinute)}</b> <small>DPM</small></span>
                    : <span><b>{formatDecimal(form.averageKda, 1)}</b> <small>KDA</small></span>}
                </span>
              </div>
              <svg aria-hidden="true" className="public-champ-spot-ink" viewBox="0 0 100 100">
                <circle cx="50" cy="50" fill="none" r="34" stroke="currentColor" strokeWidth=".7" />
                <path d="M30 30 L 70 70" fill="none" stroke="currentColor" strokeWidth=".7" />
                <path d="M70 30 L 30 70" fill="none" stroke="currentColor" strokeWidth=".7" />
              </svg>
            </article>
          ) : null}
        </div>
      ) : null}

      <div aria-label={t().recentChampionStats} className="public-champ-table">
        <div aria-hidden="true" className="public-champ-hrow">
          <span>#</span>
          <span>{t().champion}</span>
          <span>{t().champRecentWinRate}</span>
          <span data-cell="kda">KDA</span>
          <span data-cell="cs">{t().averageCsPerMinute}</span>
          <span data-cell="dpm">DPM</span>
          <span>{t().mastery}</span>
        </div>
        {sortedActive.map((row, index) => {
          const performance = row.performance!;
          const losses = performance.games - performance.wins;
          return (
            <button
              className={`public-champ-row${index < 3 ? " is-top3" : ""}`}
              key={row.champion.championId}
              onClick={() => onChampionPick(row.champion.championId)}
              type="button"
            >
              <span className="public-champ-rank">{index + 1}</span>
              <span className="public-champ-who">
                <span className="public-champ-ava" data-lv={row.masteryLevel !== undefined ? `Lv.${row.masteryLevel}` : undefined}>
                  {row.champion.iconUrl ? <img alt="" src={assetUrl(row.champion.iconUrl)} /> : <span>{championName(row.champion).slice(0, 1)}</span>}
                </span>
                <span className="public-champ-who-id">
                  <b>{championName(row.champion)}</b>
                  <small>{gamesText(performance.games)}{performance.games === 1 ? ` · ${t().champSampleShort}` : ""}</small>
                </span>
              </span>
              <span className="public-champ-wr">
                <ChampionSplitBar losses={losses} wins={performance.wins} />
                <ChampionWinLossLine losses={losses} winRate={performance.winRate} wins={performance.wins} />
              </span>
              <span className="public-champ-num" data-cell="kda">
                <b>{formatDecimal(performance.averageKda, 1)}</b>
                <i>KDA</i>
              </span>
              <span className="public-champ-num" data-cell="cs">
                <b>{formatDecimal(performance.averageCsPerMinute, 1)}</b>
                <i>{t().averageCsPerMinute}</i>
              </span>
              <span className="public-champ-num" data-cell="dpm">
                <b>{formatNumber(performance.averageDamagePerMinute)}</b>
                <i>DPM</i>
              </span>
              <span className="public-champ-mast">
                {row.masteryLevel !== undefined ? <b>Lv.{row.masteryLevel}</b> : <b>—</b>}
                {row.masteryPoints !== undefined ? <small>{formatNumber(row.masteryPoints)}</small> : null}
              </span>
            </button>
          );
        })}
        {/* 숙련도만 있는 챔피언 — 빈 값 행 반복 대신 칩 한 줄로 접습니다(목업). */}
        {ghosts.length > 0 ? (
          <div className="public-champ-ghost-strip">
            <span className="public-champ-ghost-label">{t().champGhostNote}</span>
            {ghosts.map((row) => (
              <span className="public-champ-ghost-chip" key={row.champion.championId}>
                <span className="public-champ-ghost-ava">
                  {row.champion.iconUrl ? <img alt="" src={assetUrl(row.champion.iconUrl)} /> : <span>{championName(row.champion).slice(0, 1)}</span>}
                </span>
                {championName(row.champion)}
                {row.masteryLevel !== undefined ? ` Lv.${row.masteryLevel}` : ""}
                {row.masteryPoints !== undefined ? ` · ${formatNumber(row.masteryPoints)}` : ""}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* 포지션별 최근 성과 — 목업(LoL 탭 리디자인)은 표 안 세로 4줄 대신 독립
 * 패널의 4열 그리드로 스캔선을 하나로 모읍니다. */
function ChampionRolesPanel({ profile }: { profile: PublicLolProfile }) {
  if (profile.rolePerformance.length === 0) return null;
  const mainRole = profile.roleAnalysis?.mainRole;
  return (
    <section className="public-champ-panel public-champ-roles-panel">
      <div className="public-champ-head">
        <h2>{t().rolePerformance}</h2>
        <span className="public-champ-pill">{t().champAnalysisPill.replace("{count}", String(profile.summary.recentGames))}</span>
      </div>
      <div className="public-champ-roles-grid">
        {profile.rolePerformance.map((item) => (
          <div className="public-champ-role-cell" key={item.role}>
            <span className="public-champ-role-name">
              <b>{mainRoleLabel(item.role)}</b>
              {mainRole !== undefined && item.role === mainRole ? <i>{t().mainRole}</i> : null}
            </span>
            <ChampionSplitBar losses={item.games - item.wins} wins={item.wins} />
            <span className="public-champ-role-stat">
              <b>{formatPercent(item.winRate)}</b>
              {" · KDA "}{formatDecimal(item.averageKda, 1)}{" · "}{gamesText(item.games)}
            </span>
          </div>
        ))}
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
  const [loading, setLoading] = useState(() => Boolean(initialSummonerRoute));
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
  /* 인게임 실시간 상태 재확인 — 30초 폴링 effect 가 채우고, 탭의 버튼이 호출합니다. */
  const liveStateRecheckRef = useRef<(() => void) | null>(null);
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
  const publicAccount = usePublicAccountLogin({
    viewerTwitch: {
      connected: twitchStatus.connected,
      ...(twitchStatus.user ? { user: twitchStatus.user } : {}),
      onDisconnect: disconnectPublicTwitchViewer
    },
    tracking: { linkContext: "viewer_login" }
  });
  const [followedLol, setFollowedLol] = useState<PublicTwitchFollowedLolResponse | null>(
    () => peekPublicTwitchFollowedChannels() ?? null,
  );
  const [followedLoading, setFollowedLoading] = useState(
    () => Boolean(peekPublicTwitchStatus()?.connected && !peekPublicTwitchFollowedChannels()),
  );
  const [followedError, setFollowedError] = useState("");
  /* OAuth 복귀 감지·마커 정리·초기/확정 재조회·settling 의 단일 원본 —
     shared/useViewerTwitchOAuthReturn.ts (팰월드 세션 훅과 공유). */
  const { settling: twitchOAuthSettling } = useViewerTwitchOAuthReturn({
    refresh: (force) => loadTwitchViewer(force),
  });
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
      /* 목록에 없는 경로의 폴백입니다. 루트는 /lol 로 넘기므로 여기도 /lol 입니다. */
      : localizedPublicUrl(PUBLIC_LOL_HOME_PATH, locale);
    const canonicalUrl = new URL(canonicalPath, window.location.origin).href;
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const openGraphUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    canonical?.setAttribute("href", canonicalUrl);
    openGraphUrl?.setAttribute("content", canonicalUrl);
  }, [activeMainPage, locale, profile?.riotId]);

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
    /* 인게임 탭의 '다시 시도' 버튼(목업)에서 즉시 재확인할 수 있게 노출합니다. */
    liveStateRecheckRef.current = () => void syncStreamerStatus();
    const timer = window.setInterval(() => {
      void syncStreamerStatus();
    }, 30_000);
    void syncStreamerStatus();
    return () => {
      liveStateRecheckRef.current = null;
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
        setActiveNav(route.page === "palworld" || route.page === "valorant" || route.page === "minecraft" || route.page === "privacy" || route.page === "terms" || route.page === "contact" ? "search" : "community");
        setStreamerRegisterOpen(false);
        if (route.page === "followJoin") {
          setPublicParticipationSessionId(new URLSearchParams(window.location.search).get("session")?.trim() ?? "");
        }
        return;
      }
      const summonerRoute = publicSummonerRouteFromPath();
      if (!summonerRoute) {
        setProfile(null);
        setError("");
        setFilters(DEFAULT_MATCH_FILTERS);
        setStreamerRegisterOpen(false);
        setActiveMainPage("search");
        setActiveNav("search");
        return;
      }
      setSelectedLolPlatform(summonerRoute.lolPlatform);
      setQuery(summonerRoute.riotId ?? "");
      void runSearch(summonerRoute.riotId ?? "", {
        replaceUrl,
        platform: summonerRoute.lolPlatform,
        profileToken: summonerRoute.profileToken,
      });
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

  function startTwitchLogin(): void {
    publicAccount.loginWithTwitch();
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

  function openSearchPanelTab(tab: SearchFormPanelRequest["tab"]): void {
    setStreamerRegisterOpen(false);
    setActiveMainPage("search");
    setActiveNav("search");
    if (!profile) setPublicPath(PUBLIC_LOL_HOME_PATH);
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
    setActiveMainPage(page);
    setStreamerRegisterOpen(false);
    const legalPath = publicLegalPath(page);
    if (legalPath) {
      setActiveNav("search");
      setPublicPath(legalPath);
    } else {
      setActiveNav(page === "palworld" || page === "valorant" || page === "minecraft" || page === "games" ? "search" : "community");
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

  /* 헤더 메뉴·하단 탭의 '홈'은 루트 메인 홈(/)으로 나갑니다 — LoL 홈(/lol)이 아니라.
     경로가 바뀌면 App 이 publicroutechange 로 재평가해 PublicHomePage 를 그립니다.
     증강 필터 → 전적처럼 화면 안에서 검색 뷰로 돌아오는 흐름은 이 함수를 거치지 않고
     changeMainPage("search")를 그대로 씁니다(로고 클릭도 LoL 홈 유지). */
  function navigateFromMenu(page: PublicMainPage): void {
    if (page === "search") {
      setPublicPath("/");
      return;
    }
    changeMainPage(page);
  }

  async function disconnectTwitchViewer(): Promise<void> {
    await publicAccount.logout();
  }

  async function disconnectPublicTwitchViewer(): Promise<void> {
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
    options: {
      updateUrl?: boolean;
      replaceUrl?: boolean;
      refresh?: boolean;
      platform?: LolPlatformId;
      profileToken?: string;
    } = {}
  ): Promise<void> {
    const requestedPlatform = options.platform ?? selectedLolPlatform;
    const riotId = options.profileToken ? "" : riotIdQuery(value, requestedPlatform);
    if (!riotId && !options.profileToken) return;
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
    if (options.refresh && riotId) invalidatePublicLolMatchPageCache(riotId, requestedPlatform);
    const controller = new AbortController();
    const requestSequence = profileSearchSequenceRef.current + 1;
    profileSearchAbortRef.current = controller;
    profileSearchSequenceRef.current = requestSequence;
    setLoading(true);
    setError("");
    setMoreMatchesError("");
    if (!options.refresh) {
      /* 검색 시작 즉시 프로필 셸로 전환합니다 — 암호화 링크로 들어오면 Riot ID는
         서버가 token을 해독한 응답을 받은 뒤에만 검색바에 표시합니다. */
      setActiveMainPage("search");
      setActiveNav("search");
      if (riotId) setQuery(riotId);
    }
    try {
      const result = await searchProfile(riotId, {
        refresh: options.refresh,
        signal: controller.signal,
        platform: requestedPlatform,
        profileToken: options.profileToken,
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
      if (updateUrl) setPublicPath(publicSummonerTokenPath(result.profileToken, resultPlatform), options.replaceUrl);
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
    setActiveMainPage("search");
    setActiveNav("search");
    setPublicPath(PUBLIC_LOL_HOME_PATH);
  }

  function navigatePublic(target: PublicNavTarget): void {
    setStreamerRegisterOpen(false);
    setActiveNav(target);
    if (profile) {
      if (target === "champion") setProfileTab("champions");
      if (target === "ingame") setProfileTab("ingame");
      if (target === "stats") setProfileTab("stats");
      if (target === "ranking") setProfileTab("overview");
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
    /* App 이 publicroutechange 로 게임 전용 페이지로 갈아끼우기 전의 순간 placeholder */
    if (activeMainPage === "palworld" || activeMainPage === "valorant" || activeMainPage === "minecraft") {
      const gameLabel = activeMainPage === "minecraft" ? "minecraft" : "palworld";
      return (
        <section
          className="public-game-empty-page"
          aria-label={t()[gameLabel]}
          data-ko={publicI18n.ko[gameLabel]}
          data-ja={publicI18n.ja[gameLabel]}
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
      /* 결합 ②: 검색된 프로필의 증강별 내 픽·승률을 도감에 전달(카탈로그 cdragonId 로 조인). */
      return (
        <PublicAramPage
          augmentStats={profile ? aramAugmentStatsFromMatches(profile.recentMatches) : undefined}
          onFilterAugment={profile ? (augmentId) => {
            /* 결합 ③: 도감에서 "이 증강 쓴 경기" → 전적 화면으로 이동하며 증강 필터 적용 */
            setFilters((current) => ({ ...current, augmentId }));
            changeMainPage("search");
          } : undefined}
        />
      );
    }
    if (activeMainPage === "patchNotes") {
      return <PublicPatchNotesPage locale={locale} />;
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
        {/* 상단바는 LolChrome 한 벌(통합 프롬프트 §2-1) — 화면별 헤더를 두지 않습니다. */}
        <LolChrome
          accountName={publicAccount.accountUser?.displayName}
          active="none"
          connected={publicAccount.yoroConnected}
          locale={locale}
          onLocale={changeLocale}
          onLoginOpen={startTwitchLogin}
          onLogout={() => void disconnectTwitchViewer()}
          onToggleTheme={toggleTheme}
        />
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
        <PublicBottomTabBar activePage={activeMainPage} activeTarget={activeNav} onPage={navigateFromMenu} />
        <PublicSiteFooter onPage={navigateFromMenu} text={publicSiteFooterText()} />
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
        {/* 검색 랜딩도 같은 LolChrome 한 벌 — 본문에 큰 검색 패널이 있어 헤더
            컴팩트 검색바(searchSlot)는 넣지 않습니다(공용 규격 프롬프트 §3). */}
        <LolChrome
          accountName={publicAccount.accountUser?.displayName}
          active="none"
          className="public-home-shared-header"
          connected={publicAccount.yoroConnected}
          locale={locale}
          onLocale={changeLocale}
          onLoginOpen={startTwitchLogin}
          onLogout={() => void disconnectTwitchViewer()}
          onToggleTheme={toggleTheme}
        />
        <AppShellMain className="public-home-shared-main" id="public-search-main">
          <PublicHomeSearchPanel
            liveLoading={followedLoading || twitchOAuthSettling}
            liveStreamers={homeLiveStreamers}
            loading={loading}
            onPage={navigateFromMenu}
            onShowStreamers={() => changeMainPage("subscriptions")}
            searchForm={
              <>
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
                {error ? <p className="public-error">{error}</p> : null}
              </>
            }
            searchQuickPicks={storedSuggestions.length > 0 ? (
              /* 재방문 지름길 — 즐겨찾기(★ 우선)·최근 검색을 검색바 아래 원터치 칩으로.
                 localStorage 기존 데이터만 사용 · 목업 lol-home-game-selector-redesign §③ */
              <div aria-label={t().homeQuickLabel} className="public-home-quick" role="group">
                <span className="public-home-quick__label">{t().homeQuickLabel}</span>
                {storedSuggestions.slice(0, 4).map((suggestion) => {
                  const key = normalizeSuggestionKey(suggestion);
                  const starred = favorites.some((favorite) => normalizeSuggestionKey(favorite) === key);
                  return (
                    <button key={key} onClick={() => pickSuggestion(suggestion)} type="button">
                      {starred ? <i aria-hidden="true">★</i> : null}
                      {suggestion.gameName}
                      <em>#{suggestion.tagLine}</em>
                    </button>
                  );
                })}
              </div>
            ) : undefined}
            text={publicHomeSearchPanelText(selectedLolPlatform, locale)}
          />
        </AppShellMain>
        <PublicBottomTabBar activePage={activeMainPage} activeTarget={activeNav} onPage={navigateFromMenu} />
        <PublicSiteFooter onPage={navigateFromMenu} text={publicSiteFooterText()} />
        <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
      </AppShell>
    );
  }

  /* 조기 반환은 두 상황만 담당합니다 — ① 검색이 아닌 메뉴 페이지, ② 검색
     랜딩(프로필도 로딩도 없는 상태). "검색 중인데 아직 프로필이 없는" 상태는
     아래 프로필 셸로 보내 스켈레톤을 그립니다(목업 "검색 중" — 로딩 화면과
     완성 화면의 레이아웃이 같아야 데이터 도착 순간 화면이 튀지 않습니다). */
  if (activeMainPage !== "search" || (!profile && !loading)) {
    return (
      <AppShell
        /* 패치 노트·시청자 참여·증강 칼바람은 전적 프로필과 같은 수묵 셸(platform-v2)을
           씁니다 — 셸 지면이 테마를 따라 뒤집히고(20-profile-platform.css), 상단 컴팩트
           검색바가 프로필과 같은 잉크 규격을 받습니다. 다른 메뉴 페이지는 각자 리스킨
           문서가 소유합니다. */
        className={`public-lol-shell public-dashboard-shell${["patchNotes", "followJoin", "aram"].includes(activeMainPage) ? " public-profile-platform-v2" : ""} theme-${theme}`}
        mainId="public-main"
        sidebarMode="none"
        skipLinkLabel={t().skipToContent}
        variant="public"
      >
        {/* 메뉴 페이지(스트리머·참여·칼바람·패치 노트 …)도 상단바 한 벌(LolChrome).
            검색바는 컴팩트 슬롯으로 유지합니다(공용 규격 프롬프트 §3). */}
        <LolChrome
          accountName={publicAccount.accountUser?.displayName}
          active={lolSubnavActive(activeMainPage)}
          className="public-standard-header-frame"
          connected={publicAccount.yoroConnected}
          locale={locale}
          onLocale={changeLocale}
          onLoginOpen={startTwitchLogin}
          onLogout={() => void disconnectTwitchViewer()}
          onToggleTheme={toggleTheme}
          searchSlot={(
            <div className="yoro-home-header-search">
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
              />
            </div>
          )}
        />
        <AppShellMain className="public-app-main" id="public-main">
          <div className="public-profile-layout">
            <div className="public-dashboard-content-grid">
              <section className="public-dashboard-center">
                {error ? <p className="public-error">{error}</p> : null}
                {renderMainMenuPage()}
              </section>
            </div>
          </div>
        </AppShellMain>
        <PublicBottomTabBar activePage={activeMainPage} activeTarget={activeNav} onPage={navigateFromMenu} />
        <PublicSiteFooter onPage={navigateFromMenu} text={publicSiteFooterText()} />
        <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
      </AppShell>
    );
  }

  const activeProfile = visibleProfile ?? profile;
  const favoriteActive = profile ? isFavoriteProfile(favorites, profile) : false;

  return (
    <AppShell
      /* platform-v2 는 프로필 유무와 무관하게 상시 — 먹 팔레트가 로딩 중에도
         적용되어야 데이터 도착 순간 지면색이 뒤집히지 않습니다(목업 "검색 중"). */
      className={`public-lol-shell public-dashboard-shell public-profile-shared-shell public-profile-platform-v2 theme-${theme}`}
      mainId="public-profile-main"
      sidebarMode="none"
      skipLinkLabel={t().skipToContent}
      variant="public"
    >
      {/* 상단 크롬 — 목업 page-4: LolChrome 한 벌(컴팩트 검색바 포함, 2행 활성 없음). */}
      <LolChrome
        accountName={publicAccount.accountUser?.displayName}
        active="none"
        connected={publicAccount.yoroConnected}
        locale={locale}
        onLocale={changeLocale}
        onLoginOpen={startTwitchLogin}
        onLogout={() => void disconnectTwitchViewer()}
        onToggleTheme={toggleTheme}
        searchSlot={(
          <div className="yoro-home-header-search">
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
            />
          </div>
        )}
      >
        {/* 진행 헤어라인 — 2행 메뉴 바로 아래 2px. 항상 렌더해 두고(도착 순간
            2px 이동 방지) 로딩 중에만 트랙·세그먼트를 보입니다(목업 "검색 중"). */}
        <div aria-hidden="true" className={`public-profile-progress${loading ? " is-active" : ""}`}><i /></div>
      </LolChrome>
      <AppShellMain className="public-profile-shared-main" id="public-profile-main">
        <div className="public-profile-layout">
          <div className="public-dashboard-content-grid">
            <section className="public-dashboard-center">
              {activeMainPage === "search" ? (
                !activeProfile ? (
                  /* 검색 중 + 프로필 없음 = 처음 여는 프로필. 같은 셸 안에서
                     스켈레톤만 그립니다(§3-2). 검색바에는 입력값이 남아 있습니다. */
                  <ProfileSearchSkeleton riotId={query} />
                ) : (
                <>
                  <ProfileTopPanel
                    profile={activeProfile}
                    loading={loading}
                    favoriteActive={favoriteActive}
                    refreshRemaining={refreshRemaining}
                    onRefresh={() => void runSearch(activeProfile.riotId, { refresh: true })}
                    onOpenParticipation={() => changeMainPage("followJoin")}
                    onOpenIngame={() => setProfileTab("ingame")}
                    participationOpen={Boolean(publicParticipation?.streamers.some((streamer) => (
                      streamer.isOpen
                      && streamer.twitchUserId === activeProfile.twitchStream?.twitchUserId
                    )))}
                    onToggleFavorite={toggleFavorite}
                    tabs={<PublicProfileTabs activeTab={profileTab} onChange={setProfileTab} />}
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
                      <ChampionAnalysisPanel
                        profile={activeProfile}
                        onChampionPick={(championId) => {
                          /* 챔피언 행 클릭 = 해당 챔피언으로 전적 필터 후 전적 탭 이동(기존 championFilter 재사용). */
                          setFilters({ ...DEFAULT_MATCH_FILTERS, championId: String(championId) });
                          setProfileTab("overview");
                        }}
                      />
                      <ChampionRolesPanel profile={activeProfile} />
                    </>
                  ) : null}

                  {profileTab === "stats" ? (
                    <>
                      <SignatureBuildsPanel
                        profile={activeProfile}
                        onChampionPick={(championId) => {
                          setFilters({ ...DEFAULT_MATCH_FILTERS, championId: String(championId) });
                          setProfileTab("overview");
                        }}
                      />
                      <MiniGamesLabBanner />
                    </>
                  ) : null}

	                {profileTab === "ingame" ? (
	                  <>
		                    <IngamePanel
		                      onRecheck={() => liveStateRecheckRef.current?.()}
		                      onSearchRiotId={searchRiotId}
		                      profile={activeProfile}
		                    />
	                  </>
                  ) : null}

                  <PublicMoreFeatures />
                </>
                )
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
      {/* 하단 탭바는 헤더가 아니라 AppShell 직계 자식으로 둡니다 — 전적검색 결과
          헤더의 backdrop-filter가 position:fixed 의 기준(containing block)을
          가로채 탭바를 화면 하단이 아닌 상단바 밑에 붙였습니다. */}
      {/* 모바일 하단 탭바 — 목업 page-4 크롬(홈·스트리머·참여·칼바람·패치노트, 활성 없음). */}
      <div className="yoro-home-chrome public-profile-ink-tabbar">
        <LolBottomTabBar active="none" text={lolHomeI18n[locale]} />
      </div>
      <PublicSiteFooter onPage={navigateFromMenu} text={publicSiteFooterText()} />
      <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
    </AppShell>
  );
}
