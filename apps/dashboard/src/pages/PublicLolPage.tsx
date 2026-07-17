import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import type { CommunityPost, CommunityPostCategory, CommunityPostReportCreateInput, LolChampionSummary, LolPerformanceStats, LolRankHistoryPoint, LolRankedStats, LolRole, LolRoleAnalysis, ParticipationStatus, StreamerRiotIdRequest, StreamerTournament } from "@streamops/shared";
import { apiBase } from "../api/client";
import { publicLegalRuntimeConfig } from "../runtime-config";
import {
  createPublicCommunityComment,
  createPublicCommunityPost,
  createPublicCommunityReport,
  getPublicCommunityPosts,
  updatePublicCommunityPost,
  type CommunityPostSubmitInput
} from "../features/public-lol/api/community";
import { ProfileLinkIcon, profileLinkPlatformFromUrl, profileLinkPlatformClass } from "../components/ProfileLinkIcon";
import { AppShell, AppShellFooter, AppShellHeader, AppShellMain, AppShellSidebar } from "../shared/ui/AppShell";
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
  getPublicLolMatchPage,
  getPublicLolMatchRanks,
  PublicHomeSearchPanel,
  PublicAppHeader as FeaturePublicAppHeader,
  PublicLocaleSelector,
  ChampionFilterSelect,
  PublicSiteFooter,
  PlayerItemBuild as FeaturePlayerItemBuild,
  PlayerLoadoutBuild as FeaturePlayerLoadoutBuild,
  PublicMatchFilterBar as FeaturePublicMatchFilterBar,
  ProfileMetricStrip as FeatureProfileMetricStrip,
  ProfileRecentChampionsCard as FeatureProfileRecentChampionsCard,
  ProfileTopPanel as FeatureProfileTopPanel,
  MatchTeamCompare as FeatureMatchTeamCompare,
  MatchTeamDetails as FeatureMatchTeamDetails,
  LpTrendLineChart,
  RecentMatchBuildPanel as FeatureRecentMatchBuildPanel,
  RecentMatchExpandedPanel as FeatureRecentMatchExpandedPanel,
  RecentMatchRow as FeatureRecentMatchRow,
  RecentMatchesPanel as FeatureRecentMatchesPanel,
  SearchForm as FeatureSearchForm,
  SearchableRiotId as FeatureSearchableRiotId,
  searchProfile,
  searchSuggestions,
  readPublicApiErrorMessage as readErrorMessage,
  type PublicMatchFilterBarText,
  type ProfileRecentChampionItem,
  type ProfileRecentChampionsCardText,
  type ProfileRecentChampionsStreamInfo,
  type ProfileRecentChampionsStreamStatus,
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
  type RecentMatchRowMediaItem,
  type RecentMatchesPanelText,
  type SearchFormProps,
  type SearchFormPanelRequest,
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
  PublicParticipationStateResponse,
  PublicParticipationJoinResponse,
  PublicParticipationCancelResponse,
  PublicLolCurrentGameParticipant,
  PublicLolCurrentGame,
  PublicLolMatchPageResponse,
  PublicRecentRecord,
  PublicRecentChampionSummary,
  PublicLolProfile,
  TournamentPlayerProfileState,
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
  jpRiotIdQuery,
  normalizeRiotId,
  normalizeSuggestionKey,
  normalizedTagLine,
  publicSummonerPath,
  riotIdFromPublicSummonerPath,
  searchTextForMatch,
  splitRiotIdText,
  suggestionRiotId,
} from "../features/public-lol/utils/riot-id";
import { formatCooldown, formatDecimal, formatDuration, formatNumber, formatPercent, refreshRemainingMs } from "../features/public-lol/utils/format";
import {
  isPublicLocale,
} from "../features/public-lol/utils/locale";
import {
  PUBLIC_TOURNAMENT_CALENDAR_PATH,
  PUBLIC_TOURNAMENT_LIST_PATH,
  publicLegalPath,
  publicPageRouteFromPath,
  publicPathForPage,
  publicTournamentDetailPath,
  setPublicPath,
  tournamentRouteFromPublicPath,
  type PublicLegalPageKey,
} from "../features/public-lol/utils/routes";
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
  profileWithAdditionalMatchPage,
  profileWithDynamicState,
  profileWithMatches,
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
  rankTrendTierClass,
  shortRankLabel,
  totalGames,
} from "../features/public-lol/utils/rank";

const TOURNAMENT_PLAYER_PROFILE_LIMIT = 30;
const TOURNAMENT_PLAYER_PROFILE_CONCURRENCY = 3;
const tournamentPlayerProfileCache = new Map<string, TournamentPlayerProfileState>();

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
    450: "칼바람"
  },
  ja: {
    6: "5v5 ランク",
    42: "5v5 ランク",
    400: "ノーマルドラフト",
    420: "ソロランク",
    430: "ノーマル",
    440: "フレックスランク",
    450: "ARAM"
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

async function getPublicTwitchStatus(): Promise<PublicTwitchViewerStatus> {
  const response = await fetch(`${apiBase}/api/public/twitch/status`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as PublicTwitchViewerStatus;
}

async function getPublicTwitchFollowedLol(): Promise<PublicTwitchFollowedLolResponse> {
  const response = await fetch(`${apiBase}/api/public/twitch/followed-lol?limit=100`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as PublicTwitchFollowedLolResponse;
}

async function getPublicParticipationState(streamerId?: string): Promise<PublicParticipationStateResponse> {
  const query = streamerId ? `?streamerId=${encodeURIComponent(streamerId)}` : "";
  const response = await fetch(`${apiBase}/api/public/participation/state${query}`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as PublicParticipationStateResponse;
}

async function postPublicParticipationJoin(input: { riotId: string; role: LolRole; streamerId?: string }): Promise<PublicParticipationJoinResponse> {
  const response = await fetch(`${apiBase}/api/public/participation/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as PublicParticipationJoinResponse;
}

async function postPublicParticipationCancel(input: { streamerId?: string }): Promise<PublicParticipationCancelResponse> {
  const response = await fetch(`${apiBase}/api/public/participation/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as PublicParticipationCancelResponse;
}

async function getPublicTournaments(): Promise<StreamerTournament[]> {
  const response = await fetch(`${apiBase}/api/public/tournaments`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const body = await response.json() as { tournaments?: StreamerTournament[] };
  return Array.isArray(body.tournaments) ? body.tournaments : [];
}

async function getPublicTournament(slug: string): Promise<StreamerTournament> {
  const response = await fetch(`${apiBase}/api/public/tournaments/${encodeURIComponent(slug)}`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const body = await response.json() as { tournament?: StreamerTournament };
  if (!body.tournament) throw new Error(t().searchFailed);
  return body.tournament;
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

async function logoutPublicTwitch(): Promise<void> {
  await fetch(`${apiBase}/api/public/twitch/logout`, {
    method: "POST",
    credentials: "include"
  });
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

function formatDate(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(activePublicLocale === "ja" ? "ja-JP" : "ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
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

function CsPerMinuteMetricText({ value }: { value: number | undefined }) {
  const metric = <span className={metricToneClass(csTone(value))}>{formatDecimal(value, 1)}</span>;
  return activePublicLocale === "ja" ? <>分あたりCS {metric}</> : <>분당 CS {metric}</>;
}

function KillParticipationMetricText({ value }: { value: number | undefined }) {
  const metric = <span className={metricToneClass(percentTone(value))}>{formatPercent(value)}</span>;
  return activePublicLocale === "ja" ? <>キル関与 {metric}</> : <>킬 관여 {metric}</>;
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

function searchFormText(): SearchFormText {
  return {
    searchServer: t().searchServer,
    jpServer: {
      label: t().jpServer,
      ko: publicI18n.ko.jpServer,
      ja: publicI18n.ja.jpServer
    },
    searchPlaceholder: {
      label: t().searchPlaceholder,
      ko: publicI18n.ko.searchPlaceholder,
      ja: publicI18n.ja.searchPlaceholder
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

function publicHomeSearchPanelText(): PublicHomeSearchPanelText {
  return {
    eyebrow: {
      label: "YORO.gg",
      ko: "YORO.gg",
      ja: "YORO.gg",
    },
    title: {
      label: t().emptyTitle,
      ko: publicI18n.ko.emptyTitle,
      ja: publicI18n.ja.emptyTitle,
    },
    description: {
      label: t().emptyDescription,
      ko: publicI18n.ko.emptyDescription,
      ja: publicI18n.ja.emptyDescription,
    },
    loadingStatus: {
      label: t().searching,
      ko: publicI18n.ko.searching,
      ja: publicI18n.ja.searching,
    },
    readyStatus: {
      label: t().jpServer,
      ko: publicI18n.ko.jpServer,
      ja: publicI18n.ja.jpServer,
    },
    errorTitle: {
      label: t().searchFailed,
      ko: publicI18n.ko.searchFailed,
      ja: publicI18n.ja.searchFailed,
    },
    emptyTitle: {
      label: t().noData,
      ko: publicI18n.ko.noData,
      ja: publicI18n.ja.noData,
    },
    emptyDescription: {
      label: t().emptyDescription,
      ko: publicI18n.ko.emptyDescription,
      ja: publicI18n.ja.emptyDescription,
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

function ProfileRecentChampionsCard({ champions, stream }: { champions: PublicRecentChampionSummary[]; stream?: PublicLolTwitchStream }) {
  const winLabel = activePublicLocale === "ja" ? "勝" : "승";
  const lossLabel = activePublicLocale === "ja" ? "敗" : "패";
  const visibleStream = visibleStreamerStream(stream);
  const streamStatus: ProfileRecentChampionsStreamStatus | undefined = visibleStream ? {
    label: visibleStream.isLive ? t().twitchLive : t().twitchOfflineShort,
    ko: visibleStream.isLive ? publicI18n.ko.twitchLive : publicI18n.ko.twitchOfflineShort,
    ja: visibleStream.isLive ? publicI18n.ja.twitchLive : publicI18n.ja.twitchOfflineShort,
    tone: visibleStream.isLive ? "live" : "neutral",
    title: `${visibleStream.twitchDisplayName} · ${visibleStream.isLive ? t().twitchLive : t().twitchOfflineShort}`
  } : undefined;
  const streamInfo: ProfileRecentChampionsStreamInfo | undefined = visibleStream && streamStatus ? {
    isLive: visibleStream.isLive,
    displayName: visibleStream.twitchDisplayName,
    login: visibleStream.twitchLogin,
    avatarUrl: assetUrl(visibleStream.profileImageUrl),
    avatarFallback: visibleStream.twitchDisplayName.slice(0, 1),
    title: visibleStream.title,
    gameName: visibleStream.gameName,
    viewerLabel: visibleStream.isLive && visibleStream.viewerCount !== undefined ? `${formatNumber(visibleStream.viewerCount)} ${t().twitchViewers}` : undefined,
    status: streamStatus
  } : undefined;
  const championItems: ProfileRecentChampionItem[] = champions.map((item) => {
    const name = championName(item.champion);
    const iconUrl = assetUrl(item.champion.iconUrl);
    return {
      key: item.champion.championId,
      name,
      iconUrl,
      fallbackLabel: name.slice(0, 1),
      recordLabel: `${formatPercent(item.winRate)} (${item.wins}${winLabel} / ${item.losses}${lossLabel})`,
      score: formatDecimal(item.averageKda),
      scoreClassName: metricToneClass(kdaTone(item.averageKda)),
      ratingLabel: `${t().kda} ${t().rating}`
    };
  });
  const text: ProfileRecentChampionsCardText = {
    title: {
      label: streamInfo ? (activePublicLocale === "ja" ? "配信情報" : "방송 정보") : t().recentChampionsTitle,
      ko: streamInfo ? "방송 정보" : publicI18n.ko.recentChampionsTitle,
      ja: streamInfo ? "配信情報" : publicI18n.ja.recentChampionsTitle
    },
    period: t().recentChampionsPeriod,
    emptyTitle: {
      label: t().noData,
      ko: publicI18n.ko.noData,
      ja: publicI18n.ja.noData
    },
    emptyDescription: {
      label: t().recentChampionsEmpty,
      ko: publicI18n.ko.recentChampionsEmpty,
      ja: publicI18n.ja.recentChampionsEmpty
    }
  };
  return (
    <FeatureProfileRecentChampionsCard champions={championItems} streamInfo={streamInfo} streamStatus={streamStatus} text={text} />
  );
}

function ProfileMetricStrip({ profile }: { profile: PublicLolProfile }) {
  const recentChampions = recentChampionSummaries(profile.recentMatches);
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
      tone,
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

  const metricCards = [
    rankMetricCard({ key: "solo-rank", tone: "blue", icon: "S", title: t().soloRank, stats: soloRankStats(profile) }),
    rankMetricCard({ key: "flex-rank", tone: "green", icon: "F", title: t().flexRank, stats: flexRankStats(profile) }),
    rankMetricCard({ key: "ranked-5v5", tone: "purple", icon: "5", title: t().ranked5v5, stats: ranked5v5Stats(profile) })
  ];

  return (
    <FeatureProfileMetricStrip
      ariaLabel={t().profileSummary}
      cards={metricCards}
      recentChampionsCard={<ProfileRecentChampionsCard champions={recentChampions} stream={profile.twitchStream} />}
    />
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
    ranking: t().ranking,
    cachedRanking: {
      label: t().cachedRanking,
      ko: publicI18n.ko.cachedRanking,
      ja: publicI18n.ja.cachedRanking
    },
    liveDataNotice: {
      label: t().liveDataNotice,
      ko: publicI18n.ko.liveDataNotice,
      ja: publicI18n.ja.liveDataNotice
    },
    serverLabel: t().jpServer,
    searching: t().searching,
    showDetails: { label: t().details, ko: publicI18n.ko.details, ja: publicI18n.ja.details },
    hideDetails: { label: t().folded, ko: publicI18n.ko.folded, ja: publicI18n.ja.folded },
    recentMatches: { label: t().recentGames, ko: publicI18n.ko.recentGames, ja: publicI18n.ja.recentGames }
  };
}

function ProfileTopPanel({
  profile,
  loading,
  favoriteActive,
  query,
  suggestions,
  recentSearches = [],
  favorites = [],
  refreshRemaining,
  onClear,
  onPickSuggestion,
  onQuery,
  onRefresh,
  onSubmit,
  onToggleFavorite
}: {
  profile: PublicLolProfile;
  loading: boolean;
  favoriteActive: boolean;
  query: string;
  suggestions: SearchSuggestion[];
  recentSearches?: SearchSuggestion[];
  favorites?: PublicFavorite[];
  refreshRemaining: number;
  onClear: () => void;
  onPickSuggestion: (suggestion: SearchSuggestion) => void;
  onQuery: (value: string) => void;
  onRefresh: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleFavorite: () => void;
}) {
  const refreshDisabled = loading || refreshRemaining > 0;
  const refreshCoolingDown = refreshRemaining > 0;
  const soloStats = soloRankStats(profile);
  const flexStats = flexRankStats(profile);
  const rank5v5Stats = ranked5v5Stats(profile);
  const masteryChampionArt = assetUrl(profile.topChampions[0]?.splashUrl ?? profile.topChampions[0]?.loadingUrl);
  const registeredStreamerStream = visibleStreamerStream(profile.twitchStream);
  const profileLinks = profileLinksFromStream(registeredStreamerStream);
  const primaryRank = soloStats ?? flexStats ?? rank5v5Stats ?? profile.rankedStats;
  const primaryRankClassName = `tier-${primaryRank?.tier ? primaryRank.tier.toLocaleLowerCase() : "unranked"}`;
  const fetchedAtText = `${t().fetchedAt} ${formatDate(profile.fetchedAt)}`;
  const streamerProfileIconUrl = assetUrl(registeredStreamerStream?.profileImageUrl);
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
      metricStrip={<ProfileMetricStrip profile={profile} />}
      onRefresh={onRefresh}
      onToggleFavorite={onToggleFavorite}
      primaryRankClassName={primaryRankClassName}
      primaryRankLabel={rankLabel(primaryRank)}
      primaryRankTone={sharedRankTone(primaryRank)}
      profileIconUrl={streamerProfileIconUrl ?? assetUrl(profile.profileIconUrl)}
      profileMetaLabel={undefined}
      profileLinks={<ProfileLinkIcons links={profileLinks} />}
      refreshButtonLabel={loading ? t().searching : t().refreshProfile}
      refreshCooldownLabel={formatCooldown(refreshRemaining)}
      refreshCoolingDown={refreshCoolingDown}
      refreshDisabled={refreshDisabled}
      refreshTitle={refreshCoolingDown ? `${formatCooldown(refreshRemaining)} ${t().refreshAvailableIn}` : t().refreshProfile}
      searchForm={(
        <SearchForm
          controlId="public-ranking-search-input"
          loading={loading}
          onClear={onClear}
          onPickSuggestion={onPickSuggestion}
          onQuery={onQuery}
          onSubmit={onSubmit}
          query={query}
          suggestions={suggestions}
          recentSearches={recentSearches}
          favorites={favorites}
          variant="rankingShared"
        />
      )}
      seasonBadges={null}
      tagLine={profile.tagLine}
      text={profileTopPanelText()}
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
  onChange
}: {
  activeTab: PublicProfileTab;
  onChange: (tab: PublicProfileTab) => void;
}) {
  return (
    <nav className="public-profile-tabs" aria-label={t().profileSummary}>
      <Button type="button" className={activeTab === "overview" ? "active" : ""} onClick={() => onChange("overview")}   size="md" variant={activeTab === "overview" ? "secondary" : "ghost"}>{t().overview}</Button>
      <Button type="button" className={activeTab === "champions" ? "active" : ""} onClick={() => onChange("champions")}   size="md" variant={activeTab === "champions" ? "secondary" : "ghost"}>{t().championAnalysis}</Button>
      <Button type="button" className={activeTab === "ingame" ? "active" : ""} onClick={() => onChange("ingame")}   size="md" variant={activeTab === "ingame" ? "secondary" : "ghost"}>{t().ingame}</Button>
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

function OverviewMetricPanel({ profile }: { profile: PublicLolProfile }) {
  const roles = profile.rolePerformance.slice(0, 5);
  const aggregateSummary = summarizeMatches(recentAnalysisMatches(profile));
  const recentLosses = Math.max(0, aggregateSummary.recentGames - aggregateSummary.recentWins);
  const aggregateRank = soloRankStats(profile) ?? flexRankStats(profile) ?? profile.rankedStats;
  const aggregateTierIcon = assetUrl(aggregateRank?.tierIconUrl);
  const aggregateGrade = aggregatePerformanceGrade(profile);
  const aggregateScore = aggregatePerformanceScore(profile);
  const winRate = Math.max(0, Math.min(100, aggregateSummary.recentWinRate));
  return (
    <section id="public-stats" className="public-overview-dashboard-panel">
      <Card as="article" className="public-panel public-aggregate-card public-profile-shared-card" padding="md" variant="elevated">
        <div className="public-section-head">
          <h2  >
            <span className="public-aggregate-title-icon" aria-hidden="true"><i /><i /><i /></span>
            {t().aggregatePerformance}
          </h2>
          <Badge size="sm" tone="info">{aggregateSummary.recentGames}{t().games}</Badge>
        </div>
        <div className="public-aggregate-hero">
          <div className="public-aggregate-emblem" aria-hidden="true">
            {aggregateTierIcon ? <img src={aggregateTierIcon} alt="" /> : <span>{aggregateGrade}</span>}
          </div>
          <div className="public-aggregate-grade">
            <span  >{t().aggregateGrade}</span>
            <strong className={metricToneClass(scoreTone(aggregateScore))}>{aggregateGrade}</strong>
            <div className="public-aggregate-record">
              <b>{aggregateSummary.recentWins}{activePublicLocale === "ja" ? "勝" : "승"}</b>
              <b>{recentLosses}{activePublicLocale === "ja" ? "敗" : "패"}</b>
            </div>
            <small>{gamesText(aggregateSummary.recentGames)} · {t().aiScore} {aggregateScore}</small>
          </div>
          <div className="public-aggregate-winrate" aria-label={`${t().winRate} ${formatPercent(winRate)}`}>
            <svg viewBox="0 0 120 120" role="img">
              <circle className="track" cx="60" cy="60" r="48" pathLength="100" />
              <circle className="value" cx="60" cy="60" r="48" pathLength="100" strokeDasharray={`${winRate} 100`} />
            </svg>
            <div>
              <span>{t().winRate}</span>
              <strong className={metricToneClass(percentTone(winRate))}>{formatPercent(winRate)}</strong>
            </div>
          </div>
        </div>
      </Card>
      <Card as="article" className="public-panel public-lp-trend-card public-profile-shared-card" padding="md" variant="elevated">
        <div className="public-section-head">
          <h2  >{t().lpTrend}</h2>
          <StatusPill size="sm" tone="info"  >{t().period30}</StatusPill>
        </div>
        <div className={`public-lp-chart ${rankTrendTierClass(profile.rankedStats)}`}>
          <LpTrendLineChart profile={profile} />
        </div>
      </Card>
      <Card as="article" className="public-panel public-role-win-card public-profile-shared-card" padding="md" variant="elevated">
        <div className="public-section-head">
          <h2  >{t().roleWinRate}</h2>
          <Badge size="sm" tone="info">{profile.summary.recentGames}{t().games}</Badge>
        </div>
        <div className="public-role-win-list">
          {roles.length === 0 ? (
            <EmptyState className="public-profile-shared-empty-inline" variant="search">
              <EmptyStateIcon>?</EmptyStateIcon>
              <EmptyStateTitle as="h3"  >{t().noData}</EmptyStateTitle>
              <EmptyStateDescription>{t().roleWinRate}</EmptyStateDescription>
            </EmptyState>
          ) : roles.map((role) => (
            <div key={role.role}>
              <span className="public-role-win-label" title={mainRoleLabel(role.role)}>
                <RoleIcon role={role.role} />
                <b>{mainRoleLabel(role.role)}</b>
              </span>
              <div><i style={{ width: barWidth(role.winRate, 100) }} /></div>
              <strong className={metricToneClass(percentTone(role.winRate))}>{formatPercent(role.winRate)}</strong>
              <small>{winLossText(role.wins, role.games)}</small>
            </div>
          ))}
        </div>
      </Card>
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
  onReset
}: {
  filters: PublicMatchFilters;
  champions: LolChampionSummary[];
  onChange: (filters: PublicMatchFilters) => void;
  onReset: () => void;
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
    allChampions: t().allChampions,
    periodAll: t().periodAll,
    period7: t().period7,
    period30: t().period30
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
  suggestions,
  recentSearches = [],
  favorites = [],
  searchPanelRequest,
  filters,
  champions,
  onHome,
  onQuery,
  onClear,
  onSubmit,
  onPickSuggestion,
  onPage,
  onLocale,
  onAutoLocale,
  onTwitchLogin,
  onStreamerRegister,
  onStreamerDashboard,
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
  suggestions: SearchSuggestion[];
  recentSearches?: SearchSuggestion[];
  favorites?: PublicFavorite[];
  searchPanelRequest?: SearchFormPanelRequest;
  filters: PublicMatchFilters;
  champions: LolChampionSummary[];
  onHome: () => void;
  onQuery: (value: string) => void;
  onClear: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPickSuggestion: (suggestion: SearchSuggestion) => void;
  onPage: (page: PublicMainPage) => void;
  onLocale: (locale: PublicLocale) => void;
  onAutoLocale: () => void;
  onTwitchLogin: () => void;
  onStreamerRegister: () => void;
  onStreamerDashboard: () => void;
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
          onQuery={onQuery}
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
      onStreamerDashboard={onStreamerDashboard}
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
            {status.user?.profileImageUrl ? <img src={status.user.profileImageUrl} alt="" /> : "T"}
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
  return status === "pending"
    || status === "verified"
    || status === "waitlisted"
    || status === "selected"
    || status === "checked_in"
    || status === "invited"
    || status === "in_game";
}

type PublicParticipationConfirmAction = "join" | "cancel";

function PublicParticipationJoinPage({
  status,
  participation,
  loading,
  error,
  riotId,
  role,
  joining,
  cancelling,
  message,
  selectedStreamerId,
  onRefresh,
  onStreamerSelect,
  onRiotIdChange,
  onRoleChange,
  onSubmit,
  onCancel
}: {
  status: PublicTwitchViewerStatus;
  participation: PublicParticipationStateResponse | null;
  loading: boolean;
  error: string;
  riotId: string;
  role: LolRole;
  joining: boolean;
  cancelling: boolean;
  message: string;
  selectedStreamerId: string;
  onRefresh: () => void;
  onStreamerSelect: (streamerId: string) => void;
  onRiotIdChange: (value: string) => void;
  onRoleChange: (value: LolRole) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const feedbackKey = error || message;
  const [pendingAction, setPendingAction] = useState<PublicParticipationConfirmAction | null>(null);
  const [dismissedFeedbackKey, setDismissedFeedbackKey] = useState("");
  const previousViewerEntryRef = useRef<PublicParticipationViewerEntry | null>(null);
  const streamers = participation?.streamers ?? [];
  const selectedStreamer = selectedStreamerId
    ? streamers.find((streamer) => streamer.id === selectedStreamerId)
    : undefined;
  const effectiveSelectedStreamerId = selectedStreamer?.id ?? "";
  const hasSelectedParticipationState = Boolean(
    effectiveSelectedStreamerId && participation?.selectedStreamerId === effectiveSelectedStreamerId
  );
  const queue = hasSelectedParticipationState ? participation?.queue ?? [] : [];
  const isOpen = hasSelectedParticipationState && Boolean(participation?.isOpen);
  const viewerEntry = hasSelectedParticipationState
    ? participation?.viewerEntry
    : undefined;
  const activeViewerEntry = viewerEntry && publicParticipationIsActiveStatus(viewerEntry.status) ? viewerEntry : undefined;
  const canJoin = isOpen && Boolean(selectedStreamer);
  const streamerCountLabel = streamers.length > 0
    ? `${formatNumber(streamers.length)} ${t().participationStreamerCount}`
    : t().participationNoOpenStreamer;
  const isStreamerSelectionLoading = loading && streamers.length === 0;
  const isQueueLoading = loading && queue.length === 0;
  const confirmTitle = pendingAction === "join" ? t().participationJoinConfirmTitle : t().participationCancelConfirmTitle;
  const confirmDescription = pendingAction === "join" ? t().participationJoinConfirmDescription : t().participationCancelConfirmDescription;
  const canRejoin = status.connected && canJoin && !activeViewerEntry && Boolean(previousViewerEntryRef.current || viewerEntry);
  const submitLabel = canRejoin ? t().participationRejoin : t().participationSubmit;

  useEffect(() => {
    if (feedbackKey) setDismissedFeedbackKey("");
  }, [feedbackKey]);

  useEffect(() => {
    previousViewerEntryRef.current = null;
  }, [effectiveSelectedStreamerId]);

  useEffect(() => {
    if (!viewerEntry) return;
    previousViewerEntryRef.current = viewerEntry;
    if (!riotId.trim()) onRiotIdChange(viewerEntry.riotId);
    const nextRole = viewerEntry.preferredRole ?? viewerEntry.requestedRole;
    if (nextRole && role !== nextRole) onRoleChange(nextRole as LolRole);
  }, [onRiotIdChange, onRoleChange, riotId, role, viewerEntry]);

  function requestJoin(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setPendingAction("join");
  }

  function confirmPendingAction(): void {
    if (pendingAction === "join") onSubmit();
    if (pendingAction === "cancel") onCancel();
    setPendingAction(null);
  }

  return (
    <section className="public-panel public-menu-page-panel public-participation-page public-streamer-detail-shared-page">
      <PageHeader className="public-section-head public-participation-shared-header" layout="split">
        <PageHeaderTitle as="h2"  >{t().followJoinTitle}</PageHeaderTitle>
        <PageHeaderDescription  >{t().followJoinSubtitle}</PageHeaderDescription>
        <PageHeaderActions className="public-participation-actions">
          <Button className="public-participation-shared-action" variant="secondary" size="sm" type="button" onClick={onRefresh} loading={loading} disabled={loading}>
            {loading ? t().searching : t().participationRefresh}
          </Button>
        </PageHeaderActions>
      </PageHeader>

      {!status.configured ? (
        <EmptyState className="public-participation-shared-empty" variant="streamer">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle as="h3"  >{t().twitchNotConfigured}</EmptyStateTitle>
        </EmptyState>
      ) : null}
      <section className="public-participation-streamer-select public-participation-shared-select" aria-busy={isStreamerSelectionLoading ? true : undefined}>
        <div className="public-participation-streamer-head">
          <div>
            <strong>{t().participationStreamerTitle}</strong>
            <p>{t().participationStreamerSubtitle}</p>
          </div>
          <Badge size="md" tone={streamers.length > 0 ? "streamer" : "warning"}>{streamerCountLabel}</Badge>
        </div>
        <div className="public-participation-streamer-list">
          {isStreamerSelectionLoading ? (
            Array.from({ length: 3 }, (_, index) => (
              <SkeletonCard className="public-participation-streamer-card public-participation-shared-streamer-skeleton" key={index} loadingLabel={t().searching} size="md">
                <SkeletonAvatar size="md" />
                <SkeletonText lines={2} size="sm" />
                <SkeletonButton size="sm" />
              </SkeletonCard>
            ))
          ) : streamers.map((streamer) => (
            <Card
              key={streamer.id}
              aria-pressed={streamer.id === effectiveSelectedStreamerId}
              className={`public-participation-streamer-card public-participation-shared-streamer-card ${streamer.id === effectiveSelectedStreamerId ? "active" : ""}`}
              onClick={() => onStreamerSelect(streamer.id)}
              padding="md"
              renderRoot={({ children, className, ...rootProps }) => (
                <button {...rootProps} className={className} type="button">
                  {children}
                </button>
              )}
              variant="interactive"
            >
              <span className="public-participation-streamer-avatar">
                {streamer.twitchProfileImageUrl ? (
                  <img src={assetUrl(streamer.twitchProfileImageUrl)} alt="" />
                ) : (
                  (streamer.twitchDisplayName || streamer.riotId || "S").slice(0, 1)
                )}
              </span>
              <span className="public-participation-streamer-info">
                <strong>{streamer.twitchDisplayName}</strong>
                <small>{streamer.riotId ?? t().participationRankPending}</small>
              </span>
              <span className="public-participation-streamer-meta">
                <StatusPill size="sm" tone={streamer.isOpen ? "success" : "warning"}>{t().participationStreamerOpen}</StatusPill>
                <Metric
                  label={t().participationQueueTitle}
                  value={`${formatNumber(streamer.queueSize)} / ${formatNumber(participation?.maxQueueSize ?? 0)}`}
                  tone={streamer.queueSize > 0 ? "info" : "neutral"}
                  size="sm"
                />
              </span>
            </Card>
          ))}
          {!isStreamerSelectionLoading && streamers.length === 0 ? (
            <EmptyState as="div" className="public-participation-no-streamer public-participation-shared-empty" variant="streamer">
              <EmptyStateIcon>?</EmptyStateIcon>
              <EmptyStateTitle as="h3">{t().participationNoOpenStreamer}</EmptyStateTitle>
            </EmptyState>
          ) : null}
        </div>
      </section>

      {error ? (
        <EmptyState as="div" className="public-participation-shared-empty public-participation-shared-error" variant="error">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle as="h3"  >{t().searchFailed}</EmptyStateTitle>
          <EmptyStateDescription>{error}</EmptyStateDescription>
        </EmptyState>
      ) : null}
      {message ? <StatusPill className="public-participation-message" tone="success">{message}</StatusPill> : null}

      {selectedStreamer ? (
      <div className="public-participation-layout">
        <Card as="article" className="public-participation-card public-participation-shared-card" padding="lg" variant="glass">
          <CardHeader>
            <CardTitle as="h3">{t().participationJoinTitle}</CardTitle>
          </CardHeader>
          <CardContent>
          {!status.connected ? (
            <div className="public-participation-current">
              <strong>{t().participationNeedLogin}</strong>
            </div>
          ) : activeViewerEntry ? (
            <div className="public-participation-current">
              <Badge tone="streamer">{t().participationViewerBadge}</Badge>
              <strong>{activeViewerEntry.riotId}</strong>
              <small>{t().participationPosition} {formatNumber(activeViewerEntry.position)} · {publicParticipationRoleLabel(activeViewerEntry.preferredRole ?? activeViewerEntry.requestedRole)}</small>
              <Button variant="danger" type="button" onClick={() => setPendingAction("cancel")} loading={cancelling} disabled={cancelling}>
                {cancelling ? t().participationCancelling : t().participationCancel}
              </Button>
            </div>
          ) : (
            <form className="public-participation-form" onSubmit={requestJoin}>
              {canRejoin ? (
                <div className="public-participation-rejoin-note">
                  <Badge tone="streamer">{t().participationRejoin}</Badge>
                  <span>{t().participationEndedRejoin}</span>
                </div>
              ) : null}
              <FormField controlId="public-participation-riot-id" disabled={!canJoin || joining} required>
                <FormLabel>{t().participationRiotIdLabel}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    disabled={!canJoin || joining}
                    id="public-participation-riot-id"
                    onChange={(event) => onRiotIdChange(event.currentTarget.value)}
                    placeholder={t().participationRiotIdPlaceholder}
                    value={riotId}
                  />
                </FormControl>
              </FormField>
              <FormField controlId="public-participation-role" disabled={!canJoin || joining}>
                <FormLabel>{t().participationRoleLabel}</FormLabel>
                <FormControl>
                  <Select id="public-participation-role" value={role} onChange={(event) => onRoleChange(event.currentTarget.value as LolRole)} disabled={!canJoin || joining}>
                  {PUBLIC_PARTICIPATION_ROLES.map((item) => (
                    <option key={item} value={item}>{publicParticipationRoleLabel(item)}</option>
                  ))}
                  </Select>
                </FormControl>
              </FormField>
              <Button type="submit" loading={joining} disabled={!canJoin || joining || !riotId.trim()}>
                {joining ? t().participationSubmitting : submitLabel}
              </Button>
            </form>
          )}
          </CardContent>
        </Card>

        <Card as="article" className="public-participation-card public-participation-shared-card" padding="lg" variant="glass">
          <CardHeader>
            <CardTitle as="h3">{selectedStreamer ? `${selectedStreamer.twitchDisplayName} · ${t().participationQueueTitle}` : t().participationQueueTitle}</CardTitle>
            {selectedStreamer ? (
              <CardDescription>{selectedStreamer.riotId ?? t().participationRankPending}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
          {isQueueLoading ? (
            <SkeletonCard className="public-participation-shared-queue-skeleton" loadingLabel={t().searching} size="md">
              <SkeletonText lines={3} size="md" />
            </SkeletonCard>
          ) : null}
          {queue.length === 0 && !loading ? (
            <EmptyState as="div" className="public-participation-shared-empty" variant="streamer">
              <EmptyStateIcon>?</EmptyStateIcon>
              <EmptyStateTitle as="h3">{t().participationQueueEmpty}</EmptyStateTitle>
            </EmptyState>
          ) : null}
          <div className="public-participation-queue-list">
            {queue.map((item) => (
              <Card as="article" className={`public-participation-queue-row ${item.isViewer ? "viewer" : ""}`} key={`${item.position}-${item.twitchUserName}`} padding="sm" variant={item.isViewer ? "interactive" : "default"}>
                <span
                  aria-label={`${t().participationPosition} ${formatNumber(item.position)}`}
                  className="public-participation-position"
                >
                  #{formatNumber(item.position)}
                </span>
                <div className="public-participation-queue-main">
                  <strong>{item.twitchUserName}</strong>
                  <div className="public-participation-queue-tags">
                    <StatusPill size="sm" tone={publicParticipationStatusTone(item.status)}>{publicParticipationStatusLabel(item.status)}</StatusPill>
                    <Badge size="sm" tone={sharedRankTone(item.rankedStats, !item.rankedStats)}>{publicParticipationRankText(item)}</Badge>
                    <Badge size="sm" tone="info">{publicParticipationRoleLabel(item.preferredRole ?? item.requestedRole ?? item.mainRole)}</Badge>
                    {item.isViewer ? <Badge className="viewer" size="sm" tone="streamer">{t().participationViewerBadge}</Badge> : null}
                  </div>
                </div>
                <div className="public-participation-queue-champions" aria-hidden="true">
                  {(item.topChampions ?? []).slice(0, 3).map((champion) => (
                    <img key={champion.championId} src={assetUrl(champion.iconUrl)} alt="" />
                  ))}
                  {(item.topChampions ?? []).length === 0 ? <em>?</em> : null}
                </div>
              </Card>
            ))}
          </div>
          </CardContent>
        </Card>
      </div>
      ) : streamers.length > 0 && !loading ? (
        <EmptyState as="div" className="public-participation-shared-empty" variant="streamer">
          <EmptyStateIcon>?</EmptyStateIcon>
          <EmptyStateTitle as="h3">{t().participationSelectStreamerTitle}</EmptyStateTitle>
          <EmptyStateDescription>{t().participationSelectStreamerDescription}</EmptyStateDescription>
        </EmptyState>
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
          <ModalTitle>{confirmTitle}</ModalTitle>
          <ModalDescription>{confirmDescription}</ModalDescription>
        </ModalHeader>
        <ModalContent>
          <div className="public-participation-confirm-summary">
            {pendingAction === "join" ? (
              <>
                <Badge tone="streamer">{selectedStreamer?.twitchDisplayName ?? t().participationStreamerTitle}</Badge>
                <strong>{riotId}</strong>
                <span>{publicParticipationRoleLabel(role)}</span>
              </>
            ) : viewerEntry ? (
              <>
                <Badge tone="danger">{t().participationCancel}</Badge>
                <strong>{viewerEntry.riotId}</strong>
                <span>{t().participationPosition} {formatNumber(viewerEntry.position)}</span>
              </>
            ) : null}
          </div>
        </ModalContent>
        <ModalFooter>
          <Button
            disabled={!pendingAction}
            loading={pendingAction === "join" ? joining : cancelling}
            onClick={confirmPendingAction}
            variant={pendingAction === "cancel" ? "danger" : "primary"}
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
      <PageHeader className="public-section-head public-streamers-shared-header" layout="split">
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
  const subscriptions = followed?.subscriptions ?? [];
  return (
    <section className="public-panel public-saved-data-panel public-menu-page-panel public-subscriptions-page">
      <div className="public-section-head">
        <h2  >{t().subscriptionStatus}</h2>
        <span>{subscriptions.length}</span>
      </div>
      <div className="public-subscriptions-layout">
        <article className="public-subscriptions-card">
          <strong  >{t().subscriptionsTitle}</strong>
          <p  >{t().subscriptionsSubtitle}</p>
          {!twitchStatus.connected ? (
            <p className="public-empty">{t().twitchLoginRequired}</p>
          ) : followed && !followed.subscriptionScopeGranted ? (
            <p className="public-empty">{t().subscriptionMissingScope}</p>
          ) : subscriptions.length === 0 ? (
            <p className="public-empty">{t().subscriptionsEmpty}</p>
          ) : subscriptions.slice(0, 8).map((subscription) => (
            <a className="public-subscription-row" href={subscription.channelUrl} target="_blank" rel="noreferrer" key={`subscription:${subscription.twitchUserId}`}>
              {subscription.profileImageUrl ? <img src={subscription.profileImageUrl} alt="" /> : <em>{subscription.twitchDisplayName.slice(0, 1).toUpperCase()}</em>}
              <strong>{subscription.twitchDisplayName}<small>@{subscription.twitchLogin}</small></strong>
              <span>
                <b>{subscription.tierLabel}</b>
                {subscription.isGift ? <small>{t().subscriptionGift}</small> : null}
              </span>
            </a>
          ))}
        </article>
        <PublicTwitchFollowedPanel
          status={twitchStatus}
          followed={followed}
          loading={loading}
          error={error}
          onLogin={onLogin}
          onRefresh={onRefresh}
          onSearch={onSearch}
        />
      </div>
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
      <AppShellHeader className="public-community-shared-header">
        <PageHeader layout="split">
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

      <AppShellMain className="public-community-shared-main" id={`public-community-${category}-main`}>
        <div className="public-community-shared-metrics">
          <Metric label={listTitle} value={visiblePosts.length} tone={isParty ? "streamer" : "info"} size="sm" />
          <Metric label={t().communityCommentsTitle} value={commentCount} tone="neutral" size="sm" />
          <Metric label={t().communityTagsLabel} value={tagCount} tone="success" size="sm" />
        </div>

        {loading ? (
          <div className={isParty ? "public-party-post-list" : "public-community-post-grid"} role="status" aria-label={t().tournamentPlayerRecordLoading}>
            <SkeletonCard loadingLabel={t().tournamentPlayerRecordLoading} />
            <SkeletonCard loadingLabel={t().tournamentPlayerRecordLoading} />
            <SkeletonCard loadingLabel={t().tournamentPlayerRecordLoading} />
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
      <AppShellHeader className="public-community-shared-header">
        <PageHeader layout="split">
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

      <AppShellMain className="public-community-shared-main" id="public-community-write-main">
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
      <AppShellHeader className="public-community-shared-header">
        <PageHeader layout="split">
          <PageHeaderEyebrow  >{t().community}</PageHeaderEyebrow>
          <PageHeaderTitle as="h2"  >
            {t().communityDetailTitle}
          </PageHeaderTitle>
          <PageHeaderDescription>
            {post ? `${post.authorDisplayName} · ${formatTournamentDateTime(post.createdAt)}` : "YORO.gg"}
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

      <AppShellMain className="public-community-shared-main" id="public-community-detail-main">
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

function formatTournamentDate(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(activePublicLocale === "ja" ? "ja-JP" : "ko-KR", {
    month: "2-digit",
    day: "2-digit"
  });
}

function formatTournamentTime(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(activePublicLocale === "ja" ? "ja-JP" : "ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTournamentDateTime(value: string | undefined): string {
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

function formatTournamentTeamName(value: string | undefined): string {
  const name = value?.trim();
  if (!name || name === "-" || /^tbd$/i.test(name) || name === "미정" || name === "未定") return t().tournamentTbd;
  return name;
}

function formatTournamentRoundName(round: string | undefined): string {
  const value = round?.trim();
  if (!value) return t().tournamentTbd;
  const numeric = value.match(/^(\d+)\s*(?:경기|試合|match|Match|MATCH)$/);
  if (numeric) return activePublicLocale === "ja" ? `${numeric[1]}試合` : `${numeric[1]}경기`;
  const normalized = value.toLocaleLowerCase();
  if (["16강", "round of 16", "best 16", "ベスト16"].includes(normalized)) return t().tournamentRound16;
  if (["8강", "quarterfinal", "quarterfinals", "best 8", "ベスト8"].includes(normalized)) return t().tournamentRound8;
  if (["4강", "semifinal", "semifinals", "semi finals", "準決勝"].includes(normalized)) return t().tournamentRound4;
  if (["결승", "final", "finals", "決勝"].includes(normalized)) return t().tournamentFinal;
  return value;
}

function tournamentDescriptionText(value: string | undefined, fallback: string): string {
  const description = value?.trim();
  if (!description || description === "." || description === "。" || description === "-") return fallback;
  return description;
}

function tournamentRoundNames(tournament: StreamerTournament): string[] {
  const rounds = tournament.matches.map((match) => match.round).filter(Boolean);
  return [...new Set(rounds)].length ? [...new Set(rounds)] : [t().tournamentRound16];
}

function firstRoundDate(tournament: StreamerTournament, round: string): string {
  const match = tournament.matches.find((item) => item.round === round && item.scheduledAt);
  return formatTournamentDate(match?.scheduledAt);
}

type PublicTournamentMatch = StreamerTournament["matches"][number];

function isTournamentMatchNumberRound(value: string | undefined): boolean {
  return /^(\d+)\s*(?:경기|試合|match)$/i.test(value?.trim() ?? "");
}

function formatTournamentBracketStageName(round: string | undefined, index: number, total: number): string {
  if (index === total - 1 && total > 1) return t().tournamentFinal;
  if (isTournamentMatchNumberRound(round)) return activePublicLocale === "ja" ? `${index + 1}ラウンド` : `${index + 1}라운드`;
  return formatTournamentRoundName(round);
}

function tournamentBracketRoundPoint(index: number, total: number): number {
  if (total > 1 && index === total - 1) return 40;
  return [5, 10, 20][Math.min(Math.max(index, 0), 2)] ?? 5;
}

function tournamentMatchWinnerTeamId(match: PublicTournamentMatch): string | undefined {
  if (match.winnerTeamId) return match.winnerTeamId;
  if (match.status !== "completed" || match.scoreA === undefined || match.scoreB === undefined || match.scoreA === match.scoreB) return undefined;
  return match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
}

function tournamentMatchSideClass(teamId: string | undefined, winnerTeamId: string | undefined, hasScore: boolean): string {
  if (!teamId || !winnerTeamId) return "";
  if (teamId === winnerTeamId) return "winner";
  return hasScore ? "loser" : "";
}

type TournamentTeamRecord = {
  id: string;
  team: string;
  seed: number;
  win: number;
  loss: number;
  point: number;
};

function buildTournamentTeamRecords(tournament: StreamerTournament | undefined): TournamentTeamRecord[] {
  if (!tournament) return [];
  const records = new Map(tournament.teams.map((team) => [team.id, { id: team.id, team: team.name, seed: team.seed ?? 999, win: 0, loss: 0, point: 0 }]));
  for (const match of tournament.matches) {
    if (match.status !== "completed" || !match.teamAId || !match.teamBId) continue;
    const teamA = records.get(match.teamAId);
    const teamB = records.get(match.teamBId);
    if (!teamA || !teamB) continue;
    const scoreA = match.scoreA ?? 0;
    const scoreB = match.scoreB ?? 0;
    teamA.point += scoreA - scoreB;
    teamB.point += scoreB - scoreA;
    const teamAWon = match.winnerTeamId === match.teamAId || (!match.winnerTeamId && scoreA > scoreB);
    const teamBWon = match.winnerTeamId === match.teamBId || (!match.winnerTeamId && scoreB > scoreA);
    if (teamAWon) {
      teamA.win += 1;
      teamB.loss += 1;
    } else if (teamBWon) {
      teamB.win += 1;
      teamA.loss += 1;
    }
  }
  return [...records.values()]
    .sort((a, b) => b.win - a.win || b.point - a.point || a.seed - b.seed);
}

function buildTournamentStandings(tournament: StreamerTournament | undefined): Array<{ rank: number; team: string; win: number; loss: number; point: string }> {
  return buildTournamentTeamRecords(tournament)
    .map((record, index) => ({
      rank: index + 1,
      team: record.team,
      win: record.win,
      loss: record.loss,
      point: record.point > 0 ? `+${record.point}` : String(record.point)
    }));
}

function buildTournamentTeamGroups(tournament: StreamerTournament | undefined): Array<{ label: string; teams: StreamerTournament["teams"] }> {
  if (!tournament) return [];
  const teams = [...tournament.teams].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999) || a.name.localeCompare(b.name));
  if (teams.length <= 8) return [{ label: t().tournamentAllTeams, teams }];
  const midpoint = Math.ceil(teams.length / 2);
  return [
    { label: "GROUP A", teams: teams.slice(0, midpoint) },
    { label: "GROUP B", teams: teams.slice(midpoint) }
  ].filter((group) => group.teams.length > 0);
}

function tournamentTeamNextMatch(tournament: StreamerTournament, teamId: string): string {
  const teamById = new Map(tournament.teams.map((team) => [team.id, team]));
  const next = [...tournament.matches]
    .filter((match) => match.status !== "completed" && (match.teamAId === teamId || match.teamBId === teamId))
    .sort((a, b) => (Date.parse(a.scheduledAt ?? "") || Number.MAX_SAFE_INTEGER) - (Date.parse(b.scheduledAt ?? "") || Number.MAX_SAFE_INTEGER))[0];
  if (!next) return t().tournamentNoMatch;
  const opponentId = next.teamAId === teamId ? next.teamBId : next.teamAId;
  const opponent = opponentId ? teamById.get(opponentId)?.name : undefined;
  const prefix = opponent ? `${t().tournamentVs} ${opponent}` : formatTournamentRoundName(next.round);
  return `${prefix} · ${formatTournamentDateTime(next.scheduledAt)}`;
}

function tournamentPlayerProfileQuery(riotId: string | undefined): string | undefined {
  if (!riotId) return undefined;
  const query = jpRiotIdQuery(riotId);
  return splitRiotIdText(query) ? query : undefined;
}

function tournamentPlayerProfileKey(riotId: string | undefined): string | undefined {
  const query = tournamentPlayerProfileQuery(riotId);
  return query ? normalizeRiotId(query) : undefined;
}

function tournamentPlayerDisplayName(riotId: string, profile: PublicLolProfile | undefined): { name: string; tag?: string } {
  if (profile) return { name: profile.gameName, tag: profile.tagLine };
  const parsed = splitRiotIdText(jpRiotIdQuery(riotId));
  return parsed ? { name: parsed.gameName, tag: parsed.tagLine } : { name: riotId };
}

function tournamentBestRankStats(profile: PublicLolProfile | undefined): LolRankedStats | undefined {
  if (!profile) return undefined;
  const candidates = [soloRankStats(profile), flexRankStats(profile), ranked5v5Stats(profile), profile.rankedStats]
    .filter((stats): stats is LolRankedStats => Boolean(stats && stats.tier !== "UNRANKED"));
  return candidates.sort((a, b) => rankScore(b) - rankScore(a))[0];
}

function tournamentPrimaryRankStats(profile: PublicLolProfile | undefined): LolRankedStats | undefined {
  if (!profile) return undefined;
  return soloRankStats(profile) ?? profile.rankedStats ?? flexRankStats(profile) ?? ranked5v5Stats(profile);
}

function tournamentPlayerWinSummary(profile: PublicLolProfile | undefined): { wins: number; losses: number; winRate: number } | undefined {
  if (!profile) return undefined;
  const ranked = tournamentPrimaryRankStats(profile);
  if (ranked && totalGames(ranked) > 0) {
    return { wins: ranked.wins, losses: ranked.losses, winRate: ranked.winRate };
  }
  const wins = profile.summary.recentWins;
  const games = profile.summary.recentGames;
  return games > 0 ? { wins, losses: Math.max(0, games - wins), winRate: profile.summary.recentWinRate } : undefined;
}

type TournamentCalendarEvent = {
  id: string;
  tournament: StreamerTournament;
  matchId?: string;
  title: string;
  round: string;
  startsAt: Date;
  time: string;
  status: "scheduled" | "live" | "completed";
};

function tournamentDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function tournamentMonthTitle(date: Date): string {
  return date.toLocaleDateString(activePublicLocale === "ja" ? "ja-JP" : "ko-KR", {
    year: "numeric",
    month: "long"
  });
}

function tournamentCalendarWeekdays(): string[] {
  return activePublicLocale === "ja"
    ? ["日", "月", "火", "水", "木", "金", "土"]
    : ["일", "월", "화", "수", "목", "금", "토"];
}

function buildTournamentCalendarEvents(tournaments: StreamerTournament[]): TournamentCalendarEvent[] {
  const events: TournamentCalendarEvent[] = [];
  for (const tournament of tournaments) {
    const teamById = new Map(tournament.teams.map((team) => [team.id, team]));
    const matches = tournament.matches.filter((match) => match.scheduledAt);
    for (const match of matches) {
      const startsAt = new Date(match.scheduledAt ?? "");
      if (Number.isNaN(startsAt.getTime())) continue;
      const teamA = match.teamAId ? teamById.get(match.teamAId)?.name : undefined;
      const teamB = match.teamBId ? teamById.get(match.teamBId)?.name : undefined;
      const title = teamA || teamB ? `${formatTournamentTeamName(teamA)} ${t().tournamentVs} ${formatTournamentTeamName(teamB)}` : tournament.title;
      events.push({
        id: `${tournament.id}:${match.id}`,
        tournament,
        matchId: match.id,
        title,
        round: formatTournamentRoundName(match.round || tournament.formatLabel || t().tournamentScheduleTitle),
        startsAt,
        time: formatTournamentTime(match.scheduledAt),
        status: match.status
      });
    }
    if (matches.length === 0 && tournament.startsAt) {
      const startsAt = new Date(tournament.startsAt);
      if (!Number.isNaN(startsAt.getTime())) {
        events.push({
          id: `${tournament.id}:start`,
          tournament,
          title: tournament.title,
          round: tournament.formatLabel || t().tournamentScheduleTitle,
          startsAt,
          time: formatTournamentTime(tournament.startsAt),
          status: "scheduled"
        });
      }
    }
  }
  return events.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function tournamentCalendarBaseDate(events: TournamentCalendarEvent[]): Date {
  const now = new Date();
  const next = events.find((event) => event.startsAt.getTime() >= now.getTime());
  return next?.startsAt ?? events[0]?.startsAt ?? now;
}

function buildTournamentCalendarDays(events: TournamentCalendarEvent[], baseDate: Date): Array<{ date: Date; outside: boolean; today: boolean; events: TournamentCalendarEvent[] }> {
  const monthStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const todayKey = tournamentDateKey(new Date());
  const eventsByDate = new Map<string, TournamentCalendarEvent[]>();
  for (const event of events) {
    const key = tournamentDateKey(event.startsAt);
    eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), event]);
  }
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = tournamentDateKey(date);
    return {
      date,
      outside: date.getMonth() !== baseDate.getMonth(),
      today: key === todayKey,
      events: eventsByDate.get(key) ?? []
    };
  });
}

function PublicTournamentCalendarPage({
  tournaments,
  loading,
  error,
  onSelectTournament,
  onOpenList
}: {
  tournaments: StreamerTournament[];
  loading: boolean;
  error: string;
  onSelectTournament: (slug: string) => void;
  onOpenList: () => void;
}) {
  const events = buildTournamentCalendarEvents(tournaments);
  const baseDate = tournamentCalendarBaseDate(events);
  const days = buildTournamentCalendarDays(events, baseDate);
  const upcoming = events.filter((event) => event.status !== "completed").slice(0, 6);

  return (
    <AppShell
      as="section"
      className="public-panel public-menu-page-panel public-tournament-calendar-page public-tournament-shared-shell"
      mainId="public-tournament-calendar-main"
      showSkipLink={false}
      sidebarMode="drawer"
      variant="public"
    >
      <AppShellHeader className="public-tournament-shared-header">
        <PageHeader layout="split">
          <PageHeaderEyebrow  >
            {t().contentMenu}
          </PageHeaderEyebrow>
          <PageHeaderTitle as="h2"  >
            {t().tournamentCalendarTitle}
          </PageHeaderTitle>
          <PageHeaderDescription  >
            {t().tournamentCalendarSubtitle}
          </PageHeaderDescription>
          <PageHeaderStatus>
            <Badge tone="info">{events.length} {t().tournamentMatchCount}</Badge>
          </PageHeaderStatus>
          <PageHeaderActions>
            <Button type="button" variant="secondary" onClick={onOpenList}  >
              {t().tournamentList}
            </Button>
          </PageHeaderActions>
        </PageHeader>
      </AppShellHeader>
      <AppShellMain className="public-tournament-shared-main" id="public-tournament-calendar-main">
        {loading ? (
          <div className="public-tournament-shared-loading" role="status" aria-label={t().searching}>
            <SkeletonCard loadingLabel={t().searching} />
            <SkeletonCard loadingLabel={t().searching} />
          </div>
        ) : null}
        {!loading && error ? (
          <EmptyState variant="error" as="div">
            <EmptyStateIcon>!</EmptyStateIcon>
            <EmptyStateTitle as="h3">{t().tournamentCalendarTitle}</EmptyStateTitle>
            <EmptyStateDescription>{error}</EmptyStateDescription>
            <EmptyStateActions>
              <Button type="button" variant="secondary" onClick={onOpenList}>{t().tournamentList}</Button>
            </EmptyStateActions>
          </EmptyState>
        ) : null}
        {!loading && !error && events.length === 0 ? (
          <EmptyState variant="tournament" as="div">
            <EmptyStateIcon>+</EmptyStateIcon>
            <EmptyStateTitle as="h3">{t().tournamentCalendarEmpty}</EmptyStateTitle>
          </EmptyState>
        ) : null}
        {!loading && !error && events.length > 0 ? (
          <div className="public-tournament-calendar-layout public-tournament-shared-calendar-layout">
            <Card as="section" className="public-tournament-calendar-card" padding="lg" variant="glass">
              <CardHeader className="public-tournament-calendar-title">
                <CardTitle as="h3">{tournamentMonthTitle(baseDate)}</CardTitle>
                <Badge tone="neutral">{events.length} {t().tournamentMatchCount}</Badge>
              </CardHeader>
              <CardContent className="public-tournament-calendar-grid">
                {tournamentCalendarWeekdays().map((weekday) => <b key={weekday}>{weekday}</b>)}
                {days.map((day) => (
                  <div className={`public-tournament-calendar-day ${day.outside ? "outside" : ""} ${day.today ? "today" : ""}`} key={tournamentDateKey(day.date)}>
                    <strong>{day.date.getDate()}</strong>
                    <div>
                      {day.events.slice(0, 3).map((event) => (
                        <Button
                          className={event.status}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectTournament(event.tournament.slug)}
                          key={event.id}
                        >
                          <span>{event.time}</span>
                          <em>{event.tournament.title}</em>
                          <small>{event.round}</small>
                        </Button>
                      ))}
                      {day.events.length > 3 ? <i>+{day.events.length - 3}</i> : null}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card as="aside" className="public-tournament-upcoming-card" padding="lg" variant="elevated">
              <CardHeader className="public-tournament-card-head">
                <CardTitle as="h3"  >
                  {t().tournamentUpcoming}
                </CardTitle>
                <StatusPill tone="info">{upcoming.length}</StatusPill>
              </CardHeader>
              <CardContent className="public-tournament-shared-upcoming-list">
                {upcoming.length === 0 ? (
                  <EmptyState variant="tournament" as="div">
                    <EmptyStateTitle as="h3">{t().tournamentCalendarEmpty}</EmptyStateTitle>
                  </EmptyState>
                ) : upcoming.map((event) => (
                  <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    onClick={() => onSelectTournament(event.tournament.slug)}
                    key={event.id}
                  >
                    <time>{formatTournamentDateTime(event.startsAt.toISOString())}</time>
                    <strong>{event.title}</strong>
                    <span>{event.tournament.title} · {event.round}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </AppShellMain>
    </AppShell>
  );
}

function PublicTournamentListPage({
  tournaments,
  loading,
  error,
  onSelectTournament,
  onOpenCalendar
}: {
  tournaments: StreamerTournament[];
  loading: boolean;
  error: string;
  onSelectTournament: (slug: string) => void;
  onOpenCalendar: () => void;
}) {
  return (
    <AppShell
      as="section"
      className="public-panel public-menu-page-panel public-tournament-list-page public-tournament-shared-shell"
      mainId="public-tournament-list-main"
      showSkipLink={false}
      sidebarMode="drawer"
      variant="public"
    >
      <AppShellHeader className="public-tournament-shared-header">
        <PageHeader layout="split">
          <PageHeaderEyebrow  >
            {t().contentMenu}
          </PageHeaderEyebrow>
          <PageHeaderTitle as="h2"  >
            {t().tournamentListTitle}
          </PageHeaderTitle>
          <PageHeaderDescription  >
            {t().tournamentListSubtitle}
          </PageHeaderDescription>
          <PageHeaderStatus>
            <Badge tone="streamer">{tournaments.length} {t().tournamentTeamUnit}</Badge>
          </PageHeaderStatus>
          <PageHeaderActions>
            <Button type="button" variant="secondary" onClick={onOpenCalendar}  >
              {t().tournamentCalendar}
            </Button>
          </PageHeaderActions>
        </PageHeader>
      </AppShellHeader>
      <AppShellMain className="public-tournament-shared-main" id="public-tournament-list-main">
        {loading ? (
          <div className="public-tournament-list-grid">
            <SkeletonCard loadingLabel={t().searching} />
            <SkeletonCard loadingLabel={t().searching} />
            <SkeletonCard loadingLabel={t().searching} />
          </div>
        ) : null}
        {!loading && error ? (
          <EmptyState variant="error" as="div">
            <EmptyStateIcon>!</EmptyStateIcon>
            <EmptyStateTitle as="h3">{t().tournamentListTitle}</EmptyStateTitle>
            <EmptyStateDescription>{error}</EmptyStateDescription>
          </EmptyState>
        ) : null}
        {!loading && !error && tournaments.length === 0 ? (
          <EmptyState variant="tournament" as="div">
            <EmptyStateIcon>+</EmptyStateIcon>
            <EmptyStateTitle as="h3">{t().tournamentListEmpty}</EmptyStateTitle>
            <EmptyStateActions>
              <Button type="button" variant="secondary" onClick={onOpenCalendar}>{t().tournamentCalendar}</Button>
            </EmptyStateActions>
          </EmptyState>
        ) : null}
        {!loading && !error && tournaments.length > 0 ? (
          <div className="public-tournament-list-grid">
            {tournaments.map((tournament) => {
              const liveCount = tournament.matches.filter((match) => match.status === "live").length;
              const completedCount = tournament.matches.filter((match) => match.status === "completed").length;
              const statusLabel = liveCount > 0 ? t().tournamentLive : completedCount === tournament.matches.length && tournament.matches.length > 0 ? t().tournamentCompleted : t().tournamentUpcoming;
              const statusTone = liveCount > 0 ? "live" : completedCount === tournament.matches.length && tournament.matches.length > 0 ? "success" : "info";
              return (
                <Card className="public-tournament-list-card" key={tournament.id} padding="lg" variant="interactive">
                  <CardHeader>
                    <div>
                      <StatusPill size="sm" tone={statusTone}>{statusLabel}</StatusPill>
                      <CardTitle as="h3">{tournament.title}</CardTitle>
                      <CardDescription>{tournamentDescriptionText(tournament.description, t().tournamentSubtitle)}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="public-tournament-shared-metrics">
                    <Metric label={t().tournamentPeriod} value={`${formatTournamentDate(tournament.startsAt)} ~ ${formatTournamentDate(tournament.endsAt)}`} tone="neutral" size="sm" />
                    <Metric label={t().tournamentTeams} value={`${tournament.teams.length} ${t().tournamentTeamUnit}`} tone="streamer" size="sm" />
                    <Metric label={t().tournamentMatchCount} value={tournament.matches.length} tone="info" size="sm" />
                  </CardContent>
                  <Button type="button" onClick={() => onSelectTournament(tournament.slug)}  >
                    {t().tournamentOpenDetail}
                  </Button>
                </Card>
              );
            })}
          </div>
        ) : null}
      </AppShellMain>
    </AppShell>
  );
}

function PublicTournamentPage({
  page,
  onPage,
  tournaments,
  selectedSlug,
  loading,
  error,
  onSelectTournament
}: {
  page: Extract<PublicMainPage, "tournamentNews" | "tournamentTeams" | "tournamentBracket" | "tournamentSchedule">;
  onPage: (page: PublicMainPage) => void;
  tournaments: StreamerTournament[];
  selectedSlug?: string;
  loading: boolean;
  error: string;
  onSelectTournament: (slug: string) => void;
}) {
  const tabs: Array<{ page: Extract<PublicMainPage, "tournamentNews" | "tournamentTeams" | "tournamentBracket" | "tournamentSchedule">; label: string; ko: string; ja: string }> = [
    { page: "tournamentNews", label: t().tournamentNews, ko: publicI18n.ko.tournamentNews, ja: publicI18n.ja.tournamentNews },
    { page: "tournamentTeams", label: t().tournamentTeamGroups, ko: publicI18n.ko.tournamentTeamGroups, ja: publicI18n.ja.tournamentTeamGroups },
    { page: "tournamentBracket", label: t().tournamentBracket, ko: publicI18n.ko.tournamentBracket, ja: publicI18n.ja.tournamentBracket },
    { page: "tournamentSchedule", label: t().tournamentScheduleRanking, ko: publicI18n.ko.tournamentScheduleRanking, ja: publicI18n.ja.tournamentScheduleRanking }
  ];
  const tournament = tournaments.find((item) => item.slug === selectedSlug) ?? tournaments[0];
  const teamById = new Map(tournament?.teams.map((team) => [team.id, team]) ?? []);
  const scheduleItems = (tournament?.matches ?? [])
    .map((match) => {
      const teamA = match.teamAId ? teamById.get(match.teamAId) : undefined;
      const teamB = match.teamBId ? teamById.get(match.teamBId) : undefined;
      return {
        id: match.id,
        teamA: formatTournamentTeamName(teamA?.name),
        teamB: formatTournamentTeamName(teamB?.name),
        time: formatTournamentDateTime(match.scheduledAt),
        round: formatTournamentRoundName(match.round),
        live: match.status === "live",
        format: match.format || "BO3",
        score: match.scoreA !== undefined || match.scoreB !== undefined ? `${match.scoreA ?? 0}:${match.scoreB ?? 0}` : "-",
        sortKey: Date.parse(match.scheduledAt ?? "") || Number.MAX_SAFE_INTEGER
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey);
  const notices = (tournament?.news ?? []).map((item) => ({ title: item.title, date: formatTournamentDate(item.publishedAt) }));
  const news = tournament?.news ?? [];
  const standings = buildTournamentStandings(tournament);
  const teamRecords = buildTournamentTeamRecords(tournament);
  const recordByTeamId = new Map(teamRecords.map((record) => [record.id, record]));
  const teamGroups = buildTournamentTeamGroups(tournament);
  const bracketRounds = tournament ? tournamentRoundNames(tournament) : [];
  const tournamentPlayerQueries = useMemo(() => {
    if (page !== "tournamentTeams") return [];
    const unique = new Map<string, string>();
    for (const team of tournament?.teams ?? []) {
      for (const player of team.players ?? []) {
        const query = tournamentPlayerProfileQuery(player.riotId);
        const key = tournamentPlayerProfileKey(player.riotId);
        if (query && key && !unique.has(key)) unique.set(key, query);
      }
    }
    return [...unique.entries()]
      .slice(0, TOURNAMENT_PLAYER_PROFILE_LIMIT)
      .map(([key, query]) => ({ key, query }));
  }, [page, tournament]);
  const tournamentPlayerQueryKey = tournamentPlayerQueries.map((item) => item.key).join("|");
  const [tournamentPlayerProfiles, setTournamentPlayerProfiles] = useState<Record<string, TournamentPlayerProfileState>>({});

  useEffect(() => {
    let cancelled = false;
    const entries = tournamentPlayerQueries;
    setTournamentPlayerProfiles(() => {
      const next: Record<string, TournamentPlayerProfileState> = {};
      for (const entry of entries) {
        next[entry.key] = tournamentPlayerProfileCache.get(entry.key) ?? { status: "loading" };
      }
      return next;
    });
    const missing = entries.filter((entry) => !tournamentPlayerProfileCache.has(entry.key));
    void (async () => {
      for (let index = 0; index < missing.length; index += TOURNAMENT_PLAYER_PROFILE_CONCURRENCY) {
        const batch = missing.slice(index, index + TOURNAMENT_PLAYER_PROFILE_CONCURRENCY);
        await Promise.all(batch.map(async (entry) => {
          let state: TournamentPlayerProfileState;
          try {
            state = { status: "ready", profile: await searchProfile(entry.query) };
          } catch (error) {
            state = { status: "error", error: error instanceof Error ? error.message : String(error) };
          }
          tournamentPlayerProfileCache.set(entry.key, state);
          if (!cancelled) {
            setTournamentPlayerProfiles((current) => ({ ...current, [entry.key]: state }));
          }
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentPlayerQueryKey]);

  const avatar = (teamName: string) => {
    const team = tournament?.teams.find((item) => item.name === teamName);
    return (
      <span className="public-tournament-avatar" aria-hidden="true">
        {team?.avatarUrl ? <img src={team.avatarUrl} alt="" /> : teamName.slice(0, 1)}
      </span>
    );
  };
  const liveMatchCount = tournament?.matches.filter((match) => match.status === "live").length ?? 0;
  const completedMatchCount = tournament?.matches.filter((match) => match.status === "completed").length ?? 0;
  const tournamentStatusLabel = liveMatchCount > 0
    ? t().tournamentLive
    : tournament && completedMatchCount === tournament.matches.length && tournament.matches.length > 0
      ? t().tournamentCompleted
      : t().tournamentUpcoming;
  const tournamentStatusTone = liveMatchCount > 0
    ? "live"
    : tournament && completedMatchCount === tournament.matches.length && tournament.matches.length > 0
      ? "success"
      : "info";

  return (
    <AppShell
      as="section"
      className="public-panel public-menu-page-panel public-tournament-page public-tournament-shared-shell"
      mainId="public-tournament-detail-main"
      showSkipLink={false}
      variant="public"
    >
      <AppShellHeader className="public-tournament-shared-header">
        <PageHeader layout="split">
          <PageHeaderEyebrow  >
            {t().contentMenu}
          </PageHeaderEyebrow>
          <PageHeaderTitle as="h2">{tournament?.title ?? t().tournamentTitle}</PageHeaderTitle>
          <PageHeaderDescription>
            {tournamentDescriptionText(tournament?.description, t().tournamentSubtitle)}
          </PageHeaderDescription>
          <PageHeaderStatus>
            <StatusPill tone={tournamentStatusTone}>{tournamentStatusLabel}</StatusPill>
          </PageHeaderStatus>
          <PageHeaderActions>
            <FormField className="public-tournament-shared-selector">
              <FormLabel  >
                {t().tournamentSelect}
              </FormLabel>
              <FormControl>
                <Select value={tournament?.slug ?? ""} onChange={(event) => onSelectTournament(event.target.value)} disabled={loading || tournaments.length === 0}>
                  {tournaments.map((item) => <option value={item.slug} key={item.id}>{item.title}</option>)}
                </Select>
              </FormControl>
            </FormField>
          </PageHeaderActions>
        </PageHeader>
      </AppShellHeader>

      <AppShellSidebar as="nav" className="public-tournament-shared-sidebar">
        <Navigation aria-label={t().contentMenu} variant="public">
          <NavigationSection title={t().tournamentTitle}>
            {tabs.map((tab) => (
              <NavigationItem active={page === tab.page} as="button" onClick={() => onPage(tab.page)} key={tab.page}>
                <span  >{tab.label}</span>
              </NavigationItem>
            ))}
          </NavigationSection>
          <NavigationSection title={t().tournamentScheduleTitle}>
            <NavigationItem as="button" onClick={() => onPage("tournamentSchedule")} badge={<NavigationBadge>{scheduleItems.length}</NavigationBadge>}>
              {t().tournamentMatchCount}
            </NavigationItem>
          </NavigationSection>
        </Navigation>
      </AppShellSidebar>

      <AppShellMain className="public-tournament-shared-main" id="public-tournament-detail-main">
        {loading ? (
          <div className="public-tournament-shared-loading" role="status" aria-label={t().searching}>
            <SkeletonCard loadingLabel={t().searching} />
            <SkeletonText lines={4} />
          </div>
        ) : null}
        {!loading && error ? (
          <EmptyState variant="error" as="div">
            <EmptyStateIcon>!</EmptyStateIcon>
            <EmptyStateTitle as="h3">{t().tournamentTitle}</EmptyStateTitle>
            <EmptyStateDescription>{error}</EmptyStateDescription>
          </EmptyState>
        ) : null}
        {!loading && !error && !tournament ? (
          <EmptyState variant="tournament" as="div"  >
            <EmptyStateIcon>+</EmptyStateIcon>
            <EmptyStateTitle as="h3">{t().tournamentEmpty}</EmptyStateTitle>
          </EmptyState>
        ) : null}

        {tournament ? (
          <Card className="public-tournament-hero public-tournament-shared-hero" padding="lg" variant="glass">
            <CardHeader>
              <div>
                <Badge tone="streamer">{t().contentMenu}</Badge>
                <CardTitle as="h3">{tournament.title}</CardTitle>
                <CardDescription>{tournamentDescriptionText(tournament.description, t().tournamentSubtitle)}</CardDescription>
              </div>
              <StatusPill tone={tournamentStatusTone}>{tournamentStatusLabel}</StatusPill>
            </CardHeader>
            <CardContent className="public-tournament-hero-stats public-tournament-shared-metrics">
              <Metric label={t().tournamentPeriod} value={`${formatTournamentDate(tournament.startsAt)} ~ ${formatTournamentDate(tournament.endsAt)}`} tone="neutral" size="sm" />
              <Metric label={t().tournamentTeams} value={`${tournament.teams.length} ${t().tournamentTeamUnit}`} tone="streamer" size="sm" />
              <Metric label={t().tournamentFormat} value={tournament.formatLabel || "-"} tone="info" size="sm" />
              <Metric label={t().tournamentPrize} value={tournament.prizeLabel || "-"} tone="warning" size="sm" />
            </CardContent>
          </Card>
        ) : null}

      {tournament && page === "tournamentBracket" ? (
        <div className="public-tournament-layout public-tournament-layout--full">
          <div className="public-tournament-main">
            <div className="public-tournament-title-row">
              <div>
                <h2  >{t().tournamentBracket}</h2>
                <p>{tournamentDescriptionText(tournament.description, t().tournamentBracketIntro)}</p>
              </div>
            </div>
            <div className={`public-tournament-bracket rounds-${Math.min(Math.max(bracketRounds.length, 1), 4)}`} aria-label={t().tournamentBracket}>
              {bracketRounds.map((round, roundIndex) => {
                const roundMatches = tournament.matches.filter((match) => match.round === round);
                const isLastRound = roundIndex === bracketRounds.length - 1;
                const roundPoint = tournamentBracketRoundPoint(roundIndex, bracketRounds.length);
                return (
                <div className={`public-tournament-round ${isLastRound ? "final-round" : ""} ${roundIndex > 0 ? `future round-${roundIndex + 1}` : ""}`} key={round}>
                  <strong>
                    <span>{formatTournamentBracketStageName(round, roundIndex, bracketRounds.length)}</span>
                    <small>{roundPoint}{t().tournamentPointPerPick}</small>
                  </strong>
                  {roundMatches.map((match, matchIndex) => {
                    const teamA = match.teamAId ? teamById.get(match.teamAId) : undefined;
                    const teamB = match.teamBId ? teamById.get(match.teamBId) : undefined;
                    const teamAName = formatTournamentTeamName(teamA?.name);
                    const teamBName = formatTournamentTeamName(teamB?.name);
                    const isTbd = !teamA || !teamB;
                    const winnerTeamId = tournamentMatchWinnerTeamId(match);
                    const hasScore = match.scoreA !== undefined || match.scoreB !== undefined || match.status === "completed";
                    const pairClass = isLastRound
                      ? "connector-none"
                      : matchIndex % 2 === 0 && matchIndex + 1 < roundMatches.length
                        ? "pair-top"
                        : matchIndex % 2 === 1
                          ? "pair-bottom"
                          : "pair-solo";
                    return (
                      <article className={`public-tournament-match-card ${isTbd ? "tbd" : ""} ${match.status} ${pairClass} ${winnerTeamId ? "advanced" : ""}`} key={match.id}>
                        <span className="public-tournament-match-result-label">{t().tournamentFinalResult}</span>
                        <div className={`public-tournament-match-team ${!teamA ? "pending" : ""} ${tournamentMatchSideClass(match.teamAId, winnerTeamId, hasScore)}`}>
                          {winnerTeamId === match.teamAId ? <span className="public-tournament-match-point">+{roundPoint}</span> : null}
                          <b>{teamA?.seed ?? "-"}</b>
                          {avatar(teamAName)}
                          <span className="public-tournament-match-name">{teamAName}</span>
                          {match.status === "live" && winnerTeamId !== match.teamAId ? <span className="public-tournament-match-state">{t().tournamentLiveShort}</span> : null}
                          {winnerTeamId === match.teamAId ? <span className="public-tournament-match-check">✓</span> : null}
                          <i>{match.scoreA ?? "-"}</i>
                        </div>
                        <small className="public-tournament-match-vs">{t().tournamentVs}</small>
                        <div className={`public-tournament-match-team ${!teamB ? "pending" : ""} ${tournamentMatchSideClass(match.teamBId, winnerTeamId, hasScore)}`}>
                          {winnerTeamId === match.teamBId ? <span className="public-tournament-match-point">+{roundPoint}</span> : null}
                          <b>{teamB?.seed ?? "-"}</b>
                          {avatar(teamBName)}
                          <span className="public-tournament-match-name">{teamBName}</span>
                          {winnerTeamId === match.teamBId ? <span className="public-tournament-match-check">✓</span> : null}
                          <i>{match.scoreB ?? "-"}</i>
                        </div>
                        <time>{formatTournamentTime(match.scheduledAt)}<small>{match.format ?? "BO3"}</small><em>{firstRoundDate(tournament, round)}</em></time>
                      </article>
                    );
                  })}
                </div>
              );})}
              <div className="public-tournament-winner" aria-hidden="true">🏆</div>
            </div>
            <div className="public-tournament-info-grid">
              {[
                [t().tournamentPeriod, `${formatTournamentDate(tournament.startsAt)} ~ ${formatTournamentDate(tournament.endsAt)}`, "▦"],
                [t().tournamentTeams, `${tournament.teams.length} ${t().tournamentTeamUnit}`, "●"],
                [t().tournamentFormat, tournament.formatLabel || "-", "◈"],
                [t().tournamentPrize, tournament.prizeLabel || "-", "◇"]
              ].map(([label, value, icon]) => (
                <article key={label}>
                  <span aria-hidden="true">{icon}</span>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {tournament && page === "tournamentTeams" ? (
        <div className="public-tournament-single-column">
          <TournamentTeamsPanel
            tournament={tournament}
            groups={teamGroups}
            recordByTeamId={recordByTeamId}
            playerProfiles={tournamentPlayerProfiles}
            avatar={avatar}
          />
        </div>
      ) : null}

      {tournament && page === "tournamentSchedule" ? (
        <div className="public-tournament-two-column">
          <TournamentScheduleCard upcoming={scheduleItems} avatar={avatar} expanded />
          <Card className="public-tournament-card public-tournament-standings" padding="lg" variant="glass">
            <CardHeader className="public-tournament-card-head">
              <CardTitle as="h3"  >{t().tournamentStandingsTitle}</CardTitle>
              <Badge tone="neutral">{tournament.title}</Badge>
            </CardHeader>
            <CardContent>
            {standings.map((team) => (
              <div className="public-tournament-standing-row" key={team.team}>
                <b>{team.rank}</b>
                {avatar(team.team)}
                <strong>{team.team}</strong>
                <span>{team.win}{t().tournamentWin} {team.loss}{t().tournamentLoss}</span>
                <em>{team.point}</em>
              </div>
            ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tournament && page === "tournamentNews" ? (
        <div className="public-tournament-news-grid">
          {news.map((item, index) => (
            <Card className="public-tournament-news-card" key={item.title} padding="lg" variant="glass">
              <CardHeader>
                <Badge tone="info">NEWS {index + 1}</Badge>
                <time>{formatTournamentDate(item.publishedAt)}</time>
              </CardHeader>
              <CardContent>
                <CardTitle as="h3">{item.title}</CardTitle>
                <CardDescription>{item.body}</CardDescription>
              </CardContent>
            </Card>
          ))}
          <TournamentNoticeCard notices={notices} />
        </div>
      ) : null}
      </AppShellMain>
    </AppShell>
  );
}

function TournamentScheduleCard({
  upcoming,
  avatar,
  expanded = false
}: {
  upcoming: Array<{ id: string; teamA: string; teamB: string; time: string; round: string; live: boolean; format: string; score: string }>;
  avatar: (team: string) => ReactNode;
  expanded?: boolean;
}) {
  return (
    <Card className={`public-tournament-card public-tournament-schedule ${expanded ? "expanded" : ""}`} padding="lg" variant="glass">
      <CardHeader className="public-tournament-card-head">
        <CardTitle as="h3"  >{t().tournamentScheduleTitle}</CardTitle>
        <Button type="button" variant="ghost" size="sm"  >{t().tournamentAllView} ›</Button>
      </CardHeader>
      <CardContent>
      {upcoming.map((match) => (
        <div className="public-tournament-schedule-row" key={match.id}>
          <time>{match.time}<small>{match.round} {match.format}</small></time>
          <div>
            <span>{avatar(match.teamA)}<strong>{match.teamA}</strong>{match.live ? <em>{t().tournamentLiveShort}</em> : null}</span>
            <small>{t().tournamentVs}</small>
            <span>{avatar(match.teamB)}<strong>{match.teamB}</strong></span>
          </div>
          <b>{match.score}</b>
        </div>
      ))}
      </CardContent>
    </Card>
  );
}

function TournamentTeamsPanel({
  tournament,
  groups,
  recordByTeamId,
  playerProfiles,
  avatar
}: {
  tournament: StreamerTournament;
  groups: Array<{ label: string; teams: StreamerTournament["teams"] }>;
  recordByTeamId: Map<string, TournamentTeamRecord>;
  playerProfiles: Record<string, TournamentPlayerProfileState>;
  avatar: (team: string) => ReactNode;
}) {
  return (
    <Card className="public-tournament-card public-tournament-team-panel" padding="lg" variant="glass">
      <CardHeader className="public-tournament-card-head">
        <CardTitle as="h3"  >{t().tournamentTeamGroups}</CardTitle>
        <StatusPill tone="streamer">{tournament.teams.length} {t().tournamentTeamUnit}</StatusPill>
      </CardHeader>
      <CardContent className="public-tournament-team-groups">
        {groups.map((group) => (
          <section className="public-tournament-team-group" key={group.label}>
            <h3>{group.label}</h3>
            <div className="public-tournament-team-grid">
              {group.teams.map((team) => {
                const record = recordByTeamId.get(team.id);
                return (
                  <article className="public-tournament-team-card" key={team.id}>
                    <div className="public-tournament-team-card-head">
                      {avatar(team.name)}
                      <div>
                        <strong>{team.name}</strong>
                        <small>
                          {t().tournamentSeed} {team.seed ?? "-"}
                          {team.twitchLogin ? ` · Twitch @${team.twitchLogin}` : ""}
                          {team.riotId ? ` · ${team.riotId}` : ""}
                        </small>
                      </div>
                      <b>{record?.win ?? 0}{t().tournamentWin} {record?.loss ?? 0}{t().tournamentLoss}</b>
                      <em>{t().tournamentPoint} {record?.point && record.point > 0 ? `+${record.point}` : record?.point ?? 0}</em>
                    </div>
                    <span>{t().tournamentUpcomingMatch}: {tournamentTeamNextMatch(tournament, team.id)}</span>
                    <div className="public-tournament-player-table" role="table" aria-label={`${team.name} ${t().tournamentTeamRecord}`}>
                      <div className="public-tournament-player-table-head" role="row">
                        <span role="columnheader">#</span>
                        <span role="columnheader">{t().tournamentPlayerColumn}</span>
                        <span role="columnheader">{t().tournamentPlayerTier}</span>
                        <span role="columnheader">{t().tournamentPlayerWinRate}</span>
                        <span role="columnheader">{t().tournamentPlayerRole}</span>
                        <span role="columnheader">{t().tournamentPlayerMost}</span>
                        <span role="columnheader">{t().tournamentPlayerHighTier}</span>
                        <span role="columnheader">{t().tournamentPlayerScore}</span>
                      </div>
                      {(team.players ?? []).length === 0 ? (
                        <p className="public-tournament-player-empty">{t().tournamentNoPlayers}</p>
                      ) : (team.players ?? []).map((player) => {
                        const key = tournamentPlayerProfileKey(player.riotId);
                        const state = key ? playerProfiles[key] ?? tournamentPlayerProfileCache.get(key) : undefined;
                        return <TournamentPlayerRecordRow player={player} state={state} key={player.id} />;
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

function TournamentPlayerRecordRow({
  player,
  state
}: {
  player: NonNullable<StreamerTournament["teams"][number]["players"]>[number];
  state: TournamentPlayerProfileState | undefined;
}) {
  const profile = state?.status === "ready" ? state.profile : undefined;
  const rank = tournamentPrimaryRankStats(profile);
  const bestRank = tournamentBestRankStats(profile);
  const display = tournamentPlayerDisplayName(player.riotId, profile);
  const winSummary = tournamentPlayerWinSummary(profile);
  const role = profile?.roleAnalysis?.mainRole ?? player.role;
  const champions = profile?.topChampions.slice(0, 5) ?? [];
  const score = profile ? aggregatePerformanceScore(profile) : undefined;
  const rankLoading = !state || state.status === "loading";
  const failed = state?.status === "error";

  return (
    <div className={`public-tournament-player-row ${failed ? "failed" : ""}`} role="row">
      <span className="public-tournament-player-role" role="cell">{mainRoleLabel(player.role)}</span>
      <span className="public-tournament-player-main" role="cell">
        <span className="public-tournament-player-avatar">
          {profile?.profileIconUrl ? <img src={assetUrl(profile.profileIconUrl)} alt="" /> : display.name.slice(0, 1).toUpperCase()}
        </span>
        <span>
          <strong>{display.name}</strong>
          <small>{display.tag ? `#${display.tag}` : player.riotId}{player.leader ? <em>{t().tournamentLeader}</em> : null}</small>
        </span>
      </span>
      <span className="public-tournament-player-tier" role="cell">
        <b
          className={rankTierClass(rank, rankLoading ? "loading" : rank ? "ready" : "unknown")}
          title={rankLoading ? t().tournamentPlayerRecordLoading : failed ? t().tournamentPlayerRecordFailed : rankLabel(rank)}
        >
          {rankLoading ? "..." : matchRankBadgeLabel(rank)}
        </b>
        <small>{rank && rank.tier !== "UNRANKED" ? `${rank.leaguePoints} LP` : failed ? t().tournamentPlayerRecordFailed : ""}</small>
      </span>
      <span className="public-tournament-player-winrate" role="cell">
        {winSummary ? (
          <>
            <span><i style={{ width: `${Math.max(8, Math.min(92, winSummary.winRate))}%` }} /></span>
            <small>{winSummary.wins} / {winSummary.losses} · <b className={metricToneClass(percentTone(winSummary.winRate))}>{formatPercent(winSummary.winRate, 1)}</b></small>
          </>
        ) : <small>{rankLoading ? t().tournamentPlayerRecordLoading : "-"}</small>}
      </span>
      <span className="public-tournament-player-role-icon" role="cell" title={mainRoleLabel(role)}>
        <RoleIcon role={role} />
        <small>{mainRoleLabel(role)}</small>
      </span>
      <span className="public-tournament-player-most" role="cell">
        {champions.length > 0 ? champions.map((champion) => (
          champion.iconUrl ? <img src={assetUrl(champion.iconUrl)} alt={championName(champion)} title={championName(champion)} key={champion.championId} /> : null
        )) : <small>{rankLoading ? t().tournamentPlayerRecordLoading : "-"}</small>}
      </span>
      <span className="public-tournament-player-high" role="cell">
        <b className={rankTrendTierClass(bestRank)}>{bestRank ? rankLabel(bestRank).replace(/\s+\d+\s*LP$/i, "") : rankLoading ? "..." : t().unranked}</b>
      </span>
      <span className={`public-tournament-player-score ${metricToneClass(scoreTone(score))}`} role="cell">
        {score !== undefined ? score : rankLoading ? "..." : "-"}
      </span>
    </div>
  );
}

function TournamentNoticeCard({ notices }: { notices: Array<{ title: string; date: string }> }) {
  return (
    <Card className="public-tournament-card public-tournament-notices" padding="lg" variant="glass">
      <CardHeader className="public-tournament-card-head">
        <CardTitle as="h3"  >{t().tournamentNotice}</CardTitle>
        <Button type="button" variant="ghost" size="sm"  >{t().tournamentAllView} ›</Button>
      </CardHeader>
      <CardContent>
      {notices.map((notice) => (
        <div className="public-tournament-notice-row" key={notice.title}>
          <span>{notice.title}</span>
          <time>{notice.date}</time>
        </div>
      ))}
      </CardContent>
    </Card>
  );
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
  if (!open) return null;
  return (
    <div className="public-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="public-dialog" role="dialog" aria-modal="true" aria-labelledby="public-premium-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="public-section-head">
          <h2 id="public-premium-title"  >{t().premiumNoticeTitle}</h2>
          <button type="button" onClick={onClose} aria-label={t().clearSearch}>×</button>
        </div>
        <p  >{t().premiumNoticeBody}</p>
        <div className="public-dialog-actions">
          <button type="button" onClick={onOpenAdmin}  >{t().openStreamerLogin}</button>
          <button type="button" onClick={onClose}  >{t().folded}</button>
        </div>
      </section>
    </div>
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

function MatchBadges({ badges, compact = false }: { badges?: PublicLolMatchBadge[]; compact?: boolean }) {
  const allBadges = badges ?? [];
  const priorityBadge = compact ? allBadges.find((badge) => badge.code === "mvp" || badge.code === "ace") : undefined;
  const orderedBadges = priorityBadge ? [priorityBadge, ...allBadges.filter((badge) => badge !== priorityBadge)] : allBadges;
  const maxVisibleBadges = compact ? 1 : 4;
  const visibleBadges = orderedBadges.slice(0, maxVisibleBadges);
  const overflowCount = Math.max(0, orderedBadges.length - visibleBadges.length);
  if (visibleBadges.length === 0) return null;
  return (
    <div className={`public-match-badges ${compact ? "compact" : ""}`}>
      {visibleBadges.map((badge) => (
        <span
          className={`public-match-badge ${badge.code}`}
          key={`${badge.code}:${badge.score ?? ""}:${badge.rank ?? ""}`}


        >
          {matchBadgeLabel(badge.code)}
        </span>
      ))}
      {overflowCount > 0 ? <span className="public-match-badge more" aria-label={`${overflowCount} more`}>...</span> : null}
    </div>
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

function fixedRecentItemSlots(items: PublicLolRecentMatch["items"], count = 6): Array<PublicLolRecentMatch["items"][number] | undefined> {
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

function defaultBuildParticipantKey(match: PublicLolRecentMatch, build: PublicLolMatchBuildResponse | undefined): string | undefined {
  const target = match.teams.flatMap((team) => team.players).find((player) => player.isTarget);
  if (target?.participantId !== undefined) return `participant:${target.participantId}`;
  const targetBuild = build?.participants.find((participant) => participant.riotId && target?.riotId && normalizeRiotId(participant.riotId) === normalizeRiotId(target.riotId));
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
    leftTeam: matchTeamCompareObjectivesViewModel(leftTeam, "left"),
    rightTeam: matchTeamCompareObjectivesViewModel(rightTeam, "right"),
    metrics: [
      matchTeamCompareMetricViewModel("kills", t().totalKill, leftTeam.kills, rightTeam.kills),
      matchTeamCompareMetricViewModel("damage", t().totalDamage, leftTeam.damageDealtToChampions, rightTeam.damageDealtToChampions)
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
            label: "T",
            ko: "T",
            ja: "T"
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
  const isUnavailable = liveGame?.status === "unavailable";
  const participants = liveGame?.participants ?? [];
  const teamIds = [...new Set(participants.map((participant) => participant.teamId))].sort((a, b) => a - b);
  const spellVersion = profileDataDragonVersion(profile);
  const averageTier = averageTierLabel(participants.map((participant) => participant.rankedStats));
  const expectedParticipants = Math.max(10, participants.length);
  return (
    <section id="public-ingame" className={`public-panel public-ingame-panel ${isLive ? "live" : isUnavailable ? "unavailable" : "offline"}`}>
      <div className="public-ingame-status-head">
        <div>
          <h2  >{t().currentGameStatus}</h2>
          <span className={`public-ingame-live-state ${isLive ? "live" : isUnavailable ? "unavailable" : "offline"}`}>
            <i />
            {isLive ? t().currentlyInGame : isUnavailable ? t().currentGameUnavailable : t().notInGame}
          </span>
        </div>
        <small>{t().currentGameUpdated} {formatRelativeDate(liveGame?.fetchedAt)}</small>
      </div>
      {!isLive ? (
        <div className="public-ingame-empty">
          <strong  >
            {isUnavailable ? t().currentGameUnavailable : t().notInGame}
          </strong>
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
  loadingMore?: boolean;
  moreError?: string;
}) {
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [expandedMatchViews, setExpandedMatchViews] = useState<Record<string, PublicExpandedMatchView>>({});
  const [matchRanks, setMatchRanks] = useState<Record<string, PublicLolMatchRankResponse>>({});
  const [matchRankLoading, setMatchRankLoading] = useState<Record<string, boolean>>({});
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
    setMatchBuilds({});
    setMatchBuildLoading({});
    setMatchBuildErrors({});
    setSelectedBuildParticipantKeys({});
    setHiddenRiotIdMatches({});
  }, [profile.riotId, profile.refreshAvailableAt]);

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
        : { ...current, [match.matchId]: defaultBuildParticipantKey(match, response) ?? "" });
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
          const build = matchBuilds[match.matchId];
          const buildLoading = Boolean(matchBuildLoading[match.matchId]);
          const buildError = matchBuildErrors[match.matchId] ?? "";
          const hideRiotIds = Boolean(hiddenRiotIdMatches[match.matchId]);
          const dataDragonVersion = recentMatchDataDragonVersion(match);
          const recentItemSlots = fixedRecentItemSlots(match.items, 6);
          const aiScore = matchAiScore(match);
          const targetRunes = match.teams.flatMap((team) => team.players).find((player) => player.isTarget)?.runes ?? [];
          const spellItems: RecentMatchRowMediaItem[] = match.summonerSpells.slice(0, 2).map((spellId) => {
            const iconUrl = summonerSpellIconUrl(spellId, dataDragonVersion);
            return {
              key: `${match.matchId}:spell:${spellId}`,
              content: iconUrl ? <img src={iconUrl} alt="" /> : spellId
            };
          });
          targetRunes
            .filter((rune) => rune.kind !== "stat" && rune.iconUrl)
            .slice(0, 2)
            .forEach((rune) => spellItems.push({
              key: `${match.matchId}:rune:${rune.runeId}`,
              className: "rune",
              content: <img src={rune.iconUrl} alt="" />
            }));
          const placementLabel = matchPlacementLabel(match.badges);
          const inlineItemSlots: RecentMatchRowMediaItem[] = recentItemSlots.map((item, index) => ({
            key: `${match.matchId}:inline:${index}:${item?.itemId ?? "empty"}`,
            className: item ? "" : "empty",
            content: item ? item.iconUrl ? <img src={item.iconUrl} alt="" /> : item.itemId : null
          }));
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
          const expandedPanel = expanded ? (
            <FeatureRecentMatchExpandedPanel
              activeView={expandedView}
              content={expandedView === "record" ? (
                <MatchTeamDetails match={match} rankDetail={rankDetail} rankLoading={rankLoading} hideRiotIds={hideRiotIds} onSearchRiotId={onSearchRiotId} />
              ) : (
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
                void ensureMatchRanks(match.matchId);
              }}
              onToggleMask={() => setHiddenRiotIdMatches((current) => ({ ...current, [match.matchId]: !current[match.matchId] }))}
              text={expandedPanelText}
            />
          ) : undefined;
          return (
            <FeatureRecentMatchRow
              aiScore={aiScore}
              aiScoreText={{
                label: placementLabel,
                ko: matchPlacementLabel(match.badges, "ko"),
                ja: matchPlacementLabel(match.badges, "ja")
              }}
              badges={<MatchBadges badges={match.badges} compact />}
              championFallback={championName(match.champion).slice(0, 1)}
              championIconUrl={match.champion.iconUrl}
              championName={championName(match.champion)}
              championRoleLevel={`${mainRoleLabel(match.position)} · Lv.${formatNumber(match.championLevel)}`}
              csLabel={`CS ${formatNumber(match.cs)}`}
              csPerMinuteMetric={<CsPerMinuteMetricText value={match.csPerMinute} />}
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
              killParticipationMetric={<KillParticipationMetricText value={match.killParticipation} />}
              onToggleExpand={() => {
                const opening = expandedMatchId !== match.matchId;
                setExpandedMatchId(opening ? match.matchId : null);
                if (opening) {
                  setExpandedMatchViews((current) => ({ ...current, [match.matchId]: "record" }));
                  void ensureMatchRanks(match.matchId);
                }
              }}
              queueLabel={match.queueId ? queueLabels[activePublicLocale][match.queueId] ?? `${t().queue} ${match.queueId}` : "-"}
              relativeLabel={formatRelativeDate(match.startedAt)}
              result={match.result}
              resultDurationLabel={formatDuration(match.durationSeconds)}
              resultLabel={resultLabel(match.result)}
              scoreClassName={metricToneClass(scoreTone(aiScore))}
              spellItems={spellItems}
              startedAtLabel={formatDate(match.startedAt)}
              summonerSpellsLabel={t().summonerSpells}
            />
	          );
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
    }
  };
  const canLoadMore = Boolean(profile.hasMoreRecentMatches && onLoadMore);
  return (
    <FeatureRecentMatchesPanel
      canLoadMore={canLoadMore}
      filterBar={<PublicMatchFilterBar filters={filters} champions={champions} onChange={onFilters} onReset={onResetFilters} />}
      isEmpty={profile.recentMatches.length === 0}
      loadingMore={loadingMore}
      matchCount={`${profile.summary.recentGames}${t().games}`}
      matchRows={matchRows}
      moreError={moreError}
      onLoadMore={onLoadMore}
      showNoMore={!canLoadMore && profile.recentMatches.length >= 20}
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
  onOpenAdmin,
  onOpenStreamerDashboard
}: {
  onOpenAdmin: () => void;
  onOpenStreamerDashboard: () => void;
}) {
  const { locale, changeLocale, autoDetectLocale } = usePublicLocale(loadPublicLocalePreference);
  setActivePublicLocale(locale);
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<PublicLolProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMoreMatches, setLoadingMoreMatches] = useState(false);
  const [moreMatchesError, setMoreMatchesError] = useState("");
  const [error, setError] = useState("");
  const [recentSearches, setRecentSearches] = useState<SearchSuggestion[]>(() => readRecentSearches());
  const [favorites, setFavorites] = useState<PublicFavorite[]>(() => readFavorites());
  const { theme, toggleTheme } = usePublicTheme();
  const [filters, setFilters] = useState<PublicMatchFilters>(DEFAULT_MATCH_FILTERS);
  const [remoteSuggestions, setRemoteSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchPanelRequest, setSearchPanelRequest] = useState<SearchFormPanelRequest>();
  const [profileTab, setProfileTab] = useState<PublicProfileTab>("overview");
  const initialPublicRoute = publicPageRouteFromPath();
  const [activeMainPage, setActiveMainPage] = useState<PublicMainPage>(initialPublicRoute?.page ?? "search");
  const [activeNav, setActiveNav] = useState<PublicNavTarget>("search");
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [streamerRegisterOpen, setStreamerRegisterOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [twitchStatus, setTwitchStatus] = useState<PublicTwitchViewerStatus>({
    connected: false,
    configured: false,
    requiredScopes: [],
    missingScopes: []
  });
  const [followedLol, setFollowedLol] = useState<PublicTwitchFollowedLolResponse | null>(null);
  const [followedLoading, setFollowedLoading] = useState(false);
  const [followedError, setFollowedError] = useState("");
  const followedLolRequestRef = useRef<Promise<void> | null>(null);
  const [publicParticipation, setPublicParticipation] = useState<PublicParticipationStateResponse | null>(null);
  const [publicParticipationLoading, setPublicParticipationLoading] = useState(false);
  const [publicParticipationError, setPublicParticipationError] = useState("");
  const [publicParticipationJoinRiotId, setPublicParticipationJoinRiotId] = useState("");
  const [publicParticipationJoinRole, setPublicParticipationJoinRole] = useState<LolRole>("fill");
  const [publicParticipationJoining, setPublicParticipationJoining] = useState(false);
  const [publicParticipationCancelling, setPublicParticipationCancelling] = useState(false);
  const [publicParticipationMessage, setPublicParticipationMessage] = useState("");
  const [publicParticipationStreamerId, setPublicParticipationStreamerId] = useState("");
  const [publicTournaments, setPublicTournaments] = useState<StreamerTournament[]>([]);
  const [publicTournamentSlug, setPublicTournamentSlug] = useState<string | undefined>(() => tournamentRouteFromPublicPath()?.slug);
  const [publicTournamentLoading, setPublicTournamentLoading] = useState(false);
  const [publicTournamentError, setPublicTournamentError] = useState("");
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
  const suggestions = useMemo(() => buildSuggestions(query, storedSuggestions, remoteSuggestions), [query, storedSuggestions, remoteSuggestions]);
  const visibleSuggestions = query.trim() && query.trim() !== profile?.riotId ? suggestions : [];
  const homeLiveStreamers = useMemo<PublicHomeLiveStreamer[]>(() => {
    const streamers = new Map<string, PublicHomeLiveStreamer>();
    for (const channel of followedLol?.channels ?? []) {
      if (!channel.isLive) continue;
      const key = channel.twitchUserId || channel.riotId || channel.twitchLogin;
      if (!key) continue;
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
        channelUrl: channel.channelUrl ?? (channel.twitchLogin ? `https://www.twitch.tv/${channel.twitchLogin}` : undefined),
        statusLabel: "LIVE",
        statusKo: "LIVE",
        statusJa: "LIVE",
      });
    }
    return [...streamers.values()].slice(0, 12);
  }, [followedLol, locale]);
  const visibleProfile = useMemo(() => {
    if (!profile) return null;
    return profileWithMatches(profile, filteredMatches(profile, filters));
  }, [profile, filters]);
  const selectedCommunityPost = useMemo(
    () => communityPosts.find((post) => post.id === selectedCommunityPostId),
    [communityPosts, selectedCommunityPostId]
  );
  const refreshRemaining = refreshRemainingMs(profile, nowTick);
  const availableChampions = useMemo(() => {
    const unique = new Map<number, LolChampionSummary>();
    for (const match of profile?.recentMatches ?? []) {
      if (!unique.has(match.champion.championId)) unique.set(match.champion.championId, match.champion);
    }
    return [...unique.values()].sort((a, b) => championName(a).localeCompare(championName(b)));
  }, [profile]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewerConnected = params.get("viewer_twitch") === "connected";
    void loadTwitchViewer();
    let retryTimer: number | undefined;
    if (viewerConnected) {
      retryTimer = window.setTimeout(() => {
        void loadTwitchViewer();
      }, 350);
      params.delete("viewer_twitch");
      const nextQuery = params.toString();
      const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }
    return () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    if (!twitchStatus.connected) {
      setFollowedLol(null);
      return;
    }
    if (!twitchStatus.connected || followedLol || followedLoading) return;
    void loadFollowedLol();
  }, [twitchStatus.connected, followedLol, followedLoading]);

  useEffect(() => {
    if (activeMainPage !== "followJoin") return undefined;
    void loadPublicParticipationState();
    const timer = window.setInterval(() => {
      void loadPublicParticipationState(true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [activeMainPage, twitchStatus.connected, publicParticipationStreamerId]);

  useEffect(() => {
    if (!activeMainPage.startsWith("tournament")) return;
    if (publicTournaments.length > 0 || publicTournamentLoading) return;
    if (publicTournamentError) return;
    void loadPublicTournaments();
  }, [activeMainPage, publicTournaments.length, publicTournamentLoading, publicTournamentError]);

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
    if (!profile?.twitchStream?.twitchUserId) return undefined;
    let cancelled = false;
    const syncStreamerStatus = async () => {
      try {
        const next = await searchProfile(profile.riotId);
        if (cancelled) return;
        setProfile((current) => current ? profileWithDynamicState(current, next) : current);
      } catch {
        // Twitch 상태 갱신 실패는 전적 화면 사용을 막지 않습니다.
      }
    };
    const timer = window.setInterval(() => {
      void syncStreamerStatus();
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [profile?.riotId, profile?.twitchStream?.twitchUserId]);

  useEffect(() => {
    const loadFromPath = (replaceUrl = true) => {
      const route = publicPageRouteFromPath();
      if (route && route.page !== "search") {
        setProfile(null);
        setError("");
        setActiveMainPage(route.page);
        setActiveNav(route.page === "palworld" || route.page === "privacy" || route.page === "terms" || route.page === "contact" ? "search" : "community");
        setStreamerRegisterOpen(false);
        if (route.slug || route.page.startsWith("tournament")) {
          setPublicTournamentSlug(route.slug);
          void loadPublicTournaments(route.slug);
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
      const riotId = riotIdFromPublicSummonerPath();
      if (!riotId) {
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
      setQuery(riotId);
      void runSearch(riotId, { replaceUrl });
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
      void searchSuggestions(normalizedQuery, controller.signal)
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
  }, [query, profile?.riotId]);

  async function loadTwitchViewer(): Promise<void> {
    setFollowedError("");
    try {
      const status = await getPublicTwitchStatus();
      setTwitchStatus(status);
      if (status.connected) {
        await loadFollowedLol();
      } else {
        setFollowedLol(null);
        setPublicParticipation(null);
        setPublicParticipationMessage("");
      }
    } catch (requestError) {
      setFollowedError(requestError instanceof Error ? requestError.message : t().searchFailed);
    }
  }

  async function loadFollowedLol(): Promise<void> {
    if (followedLolRequestRef.current) return followedLolRequestRef.current;
    const request = (async () => {
    setFollowedLoading(true);
    setFollowedError("");
    try {
      const response = await getPublicTwitchFollowedLol();
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
    followedLolRequestRef.current = request;
    try {
      await request;
    } finally {
      if (followedLolRequestRef.current === request) followedLolRequestRef.current = null;
    }
  }

  async function loadPublicParticipationState(silent = false): Promise<void> {
    if (!silent) setPublicParticipationLoading(true);
    setPublicParticipationError("");
    try {
      const response = await getPublicParticipationState(publicParticipationStreamerId || undefined);
      setPublicParticipation(response);
      setPublicParticipationStreamerId((current) => (
        current && !response.streamers.some((streamer) => streamer.id === current) ? "" : current
      ));
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
        streamerId: publicParticipationStreamerId
      });
      setPublicParticipation(response.state);
      if (response.state.selectedStreamerId) setPublicParticipationStreamerId(response.state.selectedStreamerId);
      setPublicParticipationMessage(response.alreadyJoined ? t().participationAlreadyJoined : t().participationJoinComplete);
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
        streamerId: publicParticipationStreamerId
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

  async function loadPublicTournaments(preferredSlug?: string): Promise<void> {
    setPublicTournamentLoading(true);
    setPublicTournamentError("");
    try {
      const list = await getPublicTournaments();
      let nextList = list;
      if (preferredSlug && !list.some((item) => item.slug === preferredSlug)) {
        const detail = await getPublicTournament(preferredSlug);
        nextList = [detail, ...list.filter((item) => item.id !== detail.id)];
      }
      setPublicTournaments(nextList);
      setPublicTournamentSlug((current) => preferredSlug || current || nextList[0]?.slug);
    } catch (requestError) {
      setPublicTournamentError(requestError instanceof Error ? requestError.message : t().searchFailed);
    } finally {
      setPublicTournamentLoading(false);
    }
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
    window.location.href = `${apiBase}/api/public/twitch/auth/start`;
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

  function openTournamentDetail(slug: string, page: Extract<PublicMainPage, "tournamentNews" | "tournamentTeams" | "tournamentBracket" | "tournamentSchedule"> = "tournamentBracket"): void {
    setStreamerRegisterOpen(false);
    setActiveMainPage(page);
    setActiveNav("community");
    setPublicTournamentSlug(slug);
    setPublicPath(publicTournamentDetailPath(slug, page));
    void loadPublicTournaments(slug);
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
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
    } else if (page.startsWith("tournament")) {
      const nextSlug = publicTournamentSlug || publicTournaments[0]?.slug;
      if (page === "tournamentCalendar") {
        setPublicPath(PUBLIC_TOURNAMENT_CALENDAR_PATH);
      } else if (page === "tournamentList") {
        setPublicPath(PUBLIC_TOURNAMENT_LIST_PATH);
      } else {
        setPublicPath(nextSlug ? publicTournamentDetailPath(nextSlug, page) : PUBLIC_TOURNAMENT_LIST_PATH);
      }
      void loadPublicTournaments(nextSlug);
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
  }

	  async function runSearch(
	    value: string,
	    options: { updateUrl?: boolean; replaceUrl?: boolean; refresh?: boolean } = {}
	  ): Promise<void> {
    const riotId = jpRiotIdQuery(value);
    if (!riotId) return;
    const updateUrl = options.updateUrl !== false;
	    setLoading(true);
	    setError("");
    setMoreMatchesError("");
	    try {
      const result = await searchProfile(riotId, { refresh: options.refresh });
      setProfile(result);
      setNowTick(Date.now());
      setProfileTab("overview");
      setFilters(DEFAULT_MATCH_FILTERS);
      setStreamerRegisterOpen(false);
      setActiveMainPage("search");
      setActiveNav("search");
      setQuery(result.riotId);
      if (updateUrl) setPublicPath(publicSummonerPath(result.riotId), options.replaceUrl);
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
      if (!options.refresh) setProfile(null);
      setError(requestError instanceof Error ? requestError.message : t().searchFailed);
    } finally {
      setLoading(false);
	    }
	  }

  async function loadMoreRecentMatches(): Promise<void> {
    if (!profile || loadingMoreMatches || !profile.hasMoreRecentMatches) return;
    const nextStart = profile.nextRecentMatchStart ?? profile.recentMatches.length;
    setLoadingMoreMatches(true);
    setMoreMatchesError("");
    try {
      const page = await getPublicLolMatchPage(profile.riotId, nextStart);
      setProfile((current) => current ? profileWithAdditionalMatchPage(current, page) : current);
    } catch (requestError) {
      setMoreMatchesError(requestError instanceof Error ? requestError.message : t().searchFailed);
    } finally {
      setLoadingMoreMatches(false);
    }
  }

	  function searchRiotId(riotId: string): void {
    window.open(publicSummonerPath(riotId), "_blank", "noopener,noreferrer");
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
    setQuery(riotId);
    void runSearch(riotId);
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
          loading={followedLoading}
          error={followedError}
          onLogin={startTwitchLogin}
          onRefresh={() => void loadFollowedLol()}
          onSearch={searchFollowedRiotId}
        />
      );
    }
    if (activeMainPage === "followJoin") {
      return (
        <PublicParticipationJoinPage
          status={twitchStatus}
          participation={publicParticipation}
          loading={publicParticipationLoading}
          error={publicParticipationError}
          riotId={publicParticipationJoinRiotId}
          role={publicParticipationJoinRole}
          joining={publicParticipationJoining}
          cancelling={publicParticipationCancelling}
          message={publicParticipationMessage}
          selectedStreamerId={publicParticipationStreamerId}
          onRefresh={() => void loadPublicParticipationState()}
          onStreamerSelect={setPublicParticipationStreamerId}
          onRiotIdChange={setPublicParticipationJoinRiotId}
          onRoleChange={setPublicParticipationJoinRole}
          onSubmit={submitPublicParticipation}
          onCancel={() => void cancelPublicParticipation()}
        />
      );
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
    if (activeMainPage === "tournamentCalendar") {
      return (
        <PublicTournamentCalendarPage
          tournaments={publicTournaments}
          loading={publicTournamentLoading}
          error={publicTournamentError}
          onSelectTournament={(slug) => openTournamentDetail(slug)}
          onOpenList={() => changeMainPage("tournamentList")}
        />
      );
    }
    if (activeMainPage === "tournamentList") {
      return (
        <PublicTournamentListPage
          tournaments={publicTournaments}
          loading={publicTournamentLoading}
          error={publicTournamentError}
          onSelectTournament={(slug) => openTournamentDetail(slug)}
          onOpenCalendar={() => changeMainPage("tournamentCalendar")}
        />
      );
    }
    if (activeMainPage === "tournamentNews" || activeMainPage === "tournamentTeams" || activeMainPage === "tournamentBracket" || activeMainPage === "tournamentSchedule") {
      return (
        <PublicTournamentPage
          page={activeMainPage}
          onPage={(page) => {
            if (page === "tournamentNews" || page === "tournamentTeams" || page === "tournamentBracket" || page === "tournamentSchedule") {
              const slug = publicTournamentSlug || publicTournaments[0]?.slug;
              if (slug) openTournamentDetail(slug, page);
              else changeMainPage("tournamentList");
            } else {
              changeMainPage(page);
            }
          }}
          tournaments={publicTournaments}
          selectedSlug={publicTournamentSlug}
          loading={publicTournamentLoading}
          error={publicTournamentError}
          onSelectTournament={(slug) => {
            if (slug) openTournamentDetail(slug, activeMainPage);
          }}
        />
      );
    }
    return null;
  }

  if (streamerRegisterOpen) {
    return (
      <main className={`public-lol-shell public-dashboard-shell public-home-shell theme-${theme}`}>
        <section className="public-app-main">
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
            suggestions={visibleSuggestions}
            recentSearches={recentSearches}
            favorites={favorites}
            searchPanelRequest={searchPanelRequest}
            filters={filters}
            champions={availableChampions}
            onQuery={setQuery}
            onClear={clearSearch}
            onSubmit={(event) => void submit(event)}
            onPickSuggestion={pickSuggestion}
            onPage={changeMainPage}
            onLocale={changeLocale}
            onAutoLocale={autoDetectLocale}
            onTwitchLogin={startTwitchLogin}
            onStreamerRegister={openStreamerRegisterScreen}
            onStreamerDashboard={onOpenStreamerDashboard}
            onStreamerRecord={openStreamerRecord}
            onTwitchLogout={() => void disconnectTwitchViewer()}
            onFilters={setFilters}
            onResetFilters={() => setFilters(DEFAULT_MATCH_FILTERS)}
          />
          <PublicStreamerRegistrationScreen
            status={twitchStatus}
            onLogin={startTwitchLogin}
            onBack={() => setStreamerRegisterOpen(false)}
            onSubmitted={(request) => {
              setTwitchStatus((current) => ({ ...current, streamerRiotRequest: request }));
              void loadFollowedLol();
            }}
          />
        </section>
        <PublicSiteFooter onPage={changeMainPage} text={publicSiteFooterText()} />
        <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
      </main>
    );
  }

  if (!profile && activeMainPage === "search") {
    return (
      <AppShell
        className={`public-lol-shell public-dashboard-shell public-home-shell public-home-shared-shell theme-${theme}`}
        renderRoot={({ children, ...rootProps }) => <main {...rootProps}>{children}</main>}
        showSkipLink={false}
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
            suggestions={visibleSuggestions}
            recentSearches={recentSearches}
            favorites={favorites}
            searchPanelRequest={searchPanelRequest}
            filters={filters}
            champions={availableChampions}
            onQuery={setQuery}
            onClear={clearSearch}
            onSubmit={(event) => void submit(event)}
            onPickSuggestion={pickSuggestion}
            onPage={changeMainPage}
            onLocale={changeLocale}
            onAutoLocale={autoDetectLocale}
            onTwitchLogin={startTwitchLogin}
            onStreamerRegister={openStreamerRegisterScreen}
            onStreamerDashboard={onOpenStreamerDashboard}
            onStreamerRecord={openStreamerRecord}
            onTwitchLogout={() => void disconnectTwitchViewer()}
            onFilters={setFilters}
            onResetFilters={() => setFilters(DEFAULT_MATCH_FILTERS)}
          />
        </AppShellHeader>
        <AppShellMain className="public-home-shared-main" id="public-search-main">
          <PublicHomeSearchPanel
            error={error}
            liveLoading={followedLoading}
            liveStreamers={homeLiveStreamers}
            loading={loading}
            onShowStreamers={() => changeMainPage("subscriptions")}
            searchForm={
              <SearchForm
                loading={loading}
                onClear={clearSearch}
                onPickSuggestion={pickSuggestion}
                onQuery={setQuery}
                onSubmit={(event) => void submit(event)}
                query={query}
                suggestions={visibleSuggestions}
                recentSearches={recentSearches}
                favorites={favorites}
                panelRequest={searchPanelRequest}
                variant="homeShared"
              />
            }
            showEmptyResult={query.trim().length > 0 && !loading && !error && visibleSuggestions.length === 0}
            text={publicHomeSearchPanelText()}
          />
        </AppShellMain>
        <AppShellFooter as="div" className="public-home-shared-footer">
          <PublicSiteFooter onPage={changeMainPage} text={publicSiteFooterText()} />
        </AppShellFooter>
        <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
      </AppShell>
    );
  }

  if (activeMainPage !== "search" || !profile) {
    return (
      <main className={`public-lol-shell public-dashboard-shell theme-${theme}`}>
        <div className="public-standard-header-frame">
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
            suggestions={visibleSuggestions}
            recentSearches={recentSearches}
            favorites={favorites}
            searchPanelRequest={searchPanelRequest}
            filters={filters}
            champions={availableChampions}
            onQuery={setQuery}
            onClear={clearSearch}
            onSubmit={(event) => void submit(event)}
            onPickSuggestion={pickSuggestion}
            onPage={changeMainPage}
            onLocale={changeLocale}
            onAutoLocale={autoDetectLocale}
            onTwitchLogin={startTwitchLogin}
            onStreamerRegister={openStreamerRegisterScreen}
            onStreamerDashboard={onOpenStreamerDashboard}
            onStreamerRecord={openStreamerRecord}
            onTwitchLogout={() => void disconnectTwitchViewer()}
            onFilters={setFilters}
            onResetFilters={() => setFilters(DEFAULT_MATCH_FILTERS)}
          />
        </div>
        <section className="public-app-main">
          {loading ? <SeigaSearchLoader /> : null}
          <div className="public-profile-layout">
            <div className="public-dashboard-content-grid">
              <section className="public-dashboard-center">
                {error ? <p className="public-error">{error}</p> : null}
                {renderMainMenuPage()}
              </section>
            </div>
          </div>
        </section>
        <PublicSiteFooter onPage={changeMainPage} text={publicSiteFooterText()} />
        <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
      </main>
    );
  }

  const activeProfile = visibleProfile ?? profile;
  const favoriteActive = isFavoriteProfile(favorites, profile);

  return (
    <AppShell
      className={`public-lol-shell public-dashboard-shell public-profile-shared-shell theme-${theme}`}
      mainId="public-profile-main"
      renderRoot={({ children, ...rootProps }) => <main {...rootProps}>{children}</main>}
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
          suggestions={visibleSuggestions}
          recentSearches={recentSearches}
          favorites={favorites}
          searchPanelRequest={searchPanelRequest}
          filters={filters}
          champions={availableChampions}
          onQuery={setQuery}
          onClear={clearSearch}
          onSubmit={(event) => void submit(event)}
          onPickSuggestion={pickSuggestion}
          onPage={changeMainPage}
          onLocale={changeLocale}
          onAutoLocale={autoDetectLocale}
          onTwitchLogin={startTwitchLogin}
          onStreamerRegister={openStreamerRegisterScreen}
          onStreamerDashboard={onOpenStreamerDashboard}
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
                    query={query}
                    suggestions={visibleSuggestions}
                    recentSearches={recentSearches}
                    favorites={favorites}
                    refreshRemaining={refreshRemaining}
                    onClear={clearSearch}
                    onPickSuggestion={pickSuggestion}
                    onQuery={setQuery}
                    onRefresh={() => void runSearch(profile.riotId, { refresh: true })}
                    onSubmit={(event) => void submit(event)}
                    onToggleFavorite={toggleFavorite}
                  />
                  <PublicProfileErrorState error={error} />
                  <PublicProfileTabs activeTab={profileTab} onChange={setProfileTab} />

	                {profileTab === "overview" ? (
	                  <div className="public-overview-search-layout">
	                    <OverviewMetricPanel profile={activeProfile} />
		                <RecentMatches
                          profile={activeProfile}
                          filters={filters}
                          champions={availableChampions}
                          onSearchRiotId={searchRiotId}
                          onFilters={setFilters}
                          onResetFilters={() => setFilters(DEFAULT_MATCH_FILTERS)}
                          onLoadMore={() => void loadMoreRecentMatches()}
                          loadingMore={loadingMoreMatches}
                          moreError={moreMatchesError}
                        />
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
      <AppShellFooter as="div" className="public-profile-shared-footer">
        <PublicSiteFooter onPage={changeMainPage} text={publicSiteFooterText()} />
      </AppShellFooter>
      <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
    </AppShell>
  );
}
