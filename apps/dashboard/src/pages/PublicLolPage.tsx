import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { LolChampionSummary, LolPerformanceStats, LolRankHistoryPoint, LolRankedStats, LolRoleAnalysis, StreamerRiotIdRequest } from "@streamops/shared";
import { apiBase } from "../api/client";

type PublicLolMatchParticipant = {
  riotId?: string;
  isTarget: boolean;
  champion: LolChampionSummary;
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

type PublicLolMatchBadgeCode = "mvp" | "ace" | "unstoppable" | "tenacity" | "damage_carry" | "objective" | "vision";

type PublicLolMatchBadge = {
  code: PublicLolMatchBadgeCode;
  score?: number;
  rank?: number;
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
  badges?: PublicLolMatchBadge[];
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

type PublicProfileLink = {
  id?: string;
  url: string;
  label: string;
  platform?: string;
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
  profileLinks?: PublicProfileLink[];
  channelUrl?: string;
  title?: string;
  gameName?: string;
  viewerCount?: number;
  startedAt?: string;
  thumbnailUrl?: string;
  source: "participation" | "connected_streamer" | "approved_streamer";
};

type PublicTwitchViewerStatus = {
  connected: boolean;
  configured: boolean;
  requiredScopes: string[];
  missingScopes: string[];
  user?: {
    id: string;
    login: string;
    displayName: string;
    profileImageUrl?: string;
  };
  tokenExpiresAt?: string;
  streamerRiotRequest?: StreamerRiotIdRequest;
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

type PublicTwitchFollowedLolResponse = {
  connected: boolean;
  total?: number;
  truncated: boolean;
  matchedCount: number;
  channels: PublicTwitchFollowedLolChannel[];
};

type PublicLolCurrentGameParticipant = {
  riotId?: string;
  isTarget: boolean;
  teamId: number;
  champion: LolChampionSummary;
};

type PublicLolCurrentGame = {
  isLive: boolean;
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

type PublicRecentRecord = {
  title: string;
  value: number | undefined;
  unit: string;
  match?: PublicLolRecentMatch;
  champion?: LolChampionSummary;
};

type PublicTrendPoint = {
  key: string;
  x: number;
  y: number;
  value: number;
  label: string;
  result: PublicLolRecentMatch["result"];
};

type PublicTrendLine = {
  points: PublicTrendPoint[];
  linePoints: string;
  areaPath: string;
  minLabel: string;
  maxLabel: string;
};

type PublicLolProfile = {
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

type SearchSuggestion = {
  gameName: string;
  tagLine: string;
  source: "input" | "recommended" | "recent" | "verified";
  profileIconUrl?: string;
  summonerLevel?: number;
  lolPlatform?: string;
  rankedStats?: LolRankedStats;
  lastSeenAt?: string;
};

type PublicNavTarget = "search" | "ranking" | "champion" | "stats" | "ingame" | "promotion" | "community";
type PublicProfileTab = "overview" | "champions" | "ingame";
type PublicTheme = "light" | "dark";
type MatchQueueFilter = "all" | "solo" | "flex" | "ranked5v5" | "normal" | "aram";
type MatchPeriodFilter = "all" | "7d" | "30d";
type PublicMatchFilters = {
  queue: MatchQueueFilter;
  championId: string;
  period: MatchPeriodFilter;
};
type PublicFavorite = SearchSuggestion;
type PublicNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

const RECENT_SEARCH_STORAGE_KEY = "loltrace.recent.jp";
const FAVORITE_STORAGE_KEY = "loltrace.favorites.jp";
const THEME_STORAGE_KEY = "loltrace.theme";
const LOCALE_STORAGE_KEY = "loltrace.locale";
const NOTIFICATION_STORAGE_KEY = "loltrace.notifications";
const MAX_RECENT_SEARCHES = 8;
const MAX_FAVORITES = 24;
const MAX_NOTIFICATIONS = 16;
const MAX_SEARCH_SUGGESTIONS = 6;
const PUBLIC_SUMMONER_ROUTE_PREFIX = "/lol/summoners/jp/";
const DEFAULT_MATCH_FILTERS: PublicMatchFilters = {
  queue: "all",
  championId: "all",
  period: "all"
};
const publicI18n = {
  ko: {
    brand: "LOLTRACE",
    tagline: "JP 서버 전적 검색과 방송 분석을 한 화면에서 확인합니다.",
    searchPlaceholder: "JP 서버 닉네임#태그 검색",
    search: "검색",
    searching: "검색 중",
    clearSearch: "검색어 지우기",
    searchServer: "검색 서버",
    jpServer: "일본 서버",
    language: "언어",
    languageMenu: "언어 선택",
    languageKo: "한국어",
    languageJa: "일본어",
    summonerResults: "소환사",
    relatedSummoners: "연관 닉네임",
    inputSearch: "입력값",
    verifiedSearch: "확인됨",
    recommended: "추천",
    recentSearch: "최근 검색",
    login: "방송 관리 로그인",
    heroTitle: "소환사 전적을 빠르게 찾고, 핵심 흐름만 읽으세요.",
    heroDescription: "랭크, 최근 경기, 챔피언 숙련도, 포지션 성향을 검색 결과 화면에 정리합니다.",
    sample: "예시 검색",
    jpOnly: "JP 서버 고정 · 태그 자유",
    home: "홈",
    liveGame: "라이브게임",
    filter: "필터",
    online: "온라인",
    premiumTitle: "LOLTRACE Premium",
    premiumBody: "광고 제거, 상세 통계, 프로 리플레이 등 프리미엄 기능을 경험해보세요.",
    premiumCta: "프리미엄 업그레이드",
    version: "버전",
    notifications: "알림",
    profileSummary: "플레이어 요약",
    recentGames: "최근 게임",
    recent20Games: "최근 20게임",
    topChampions: "챔피언 숙련도",
    analysis: "핵심 분석",
    detailAnalysis: "상세 분석",
    matchDetails: "경기 상세",
    expandMatch: "경기 상세 펼치기",
    collapseMatch: "경기 상세 접기",
    aiScore: "점수",
    mvpBadge: "MVP",
    aceBadge: "ACE",
    unstoppableBadge: "저지불가",
    tenacityBadge: "강인함",
    damageCarryBadge: "딜량 우수",
    objectiveBadge: "오브젝트",
    visionBadge: "시야 장악",
    teamDetails: "팀 상세",
    allyTeam: "아군 팀",
    enemyTeam: "상대 팀",
    tier: "티어",
    averageTier: "평균 티어",
    tierLoading: "티어 불러오는 중",
    tierUnavailable: "티어 확인 불가",
    knownTier: "확인된 티어",
    roleDistribution: "포지션 분포",
    recentRecords: "최근 최고 기록",
    bestKills: "최고 킬",
    bestKda: "최고 KDA",
    bestDamage: "최고 딜량",
    bestCs: "최고 CS",
    bestVision: "최고 시야",
    unitKill: "킬",
    unitDamage: "딜",
    unitPoint: "점",
    total: "합계",
    perMinute: "분당",
    teamShare: "팀 비중",
    championPerformance: "챔피언별 최근 성과",
    rolePerformance: "포지션별 최근 성과",
    opponent: "상대",
    items: "아이템",
    damage: "딜량",
    damageTaken: "받은 피해",
    damageShare: "팀 딜 비중",
    gold: "골드",
    vision: "시야",
    objectives: "오브젝트",
    wards: "와드",
    deathTime: "사망 시간",
    popularChampions: "인기 챔피언",
    trendChampions: "트렌드 챔피언",
    friendsLive: "친구 라이브",
    patchSummary: "패치 요약",
    duoRecommendation: "듀오 추천",
    lpTrend: "LP 변화 추이",
    aggregatePerformance: "종합 성과",
    roleWinRate: "포지션별 승률",
    details: "자세히 보기",
    searchNav: "검색",
    ranking: "랭킹",
    overview: "종합",
    championAnalysis: "챔피언 분석",
    ingame: "인게임",
    stats: "통계",
    promotion: "프로모션",
    community: "커뮤니티",
    multimatch: "멀티서치",
    darkMode: "다크 모드",
    moreMenu: "더보기",
    favorite: "즐겨찾기",
    refreshProfile: "전적 갱신",
    moreFeatures: "더 많은 기능",
    aiFeatureTitle: "분석",
    aiFeatureBody: "최근 20게임을 분석하여 플레이 스타일과 개선점을 정리합니다.",
    positionFeatureTitle: "포지션 분석",
    positionFeatureBody: "포지션별 플레이 성향과 승률, KDA를 확인합니다.",
    overlayFeatureTitle: "스트리머 오버레이",
    overlayFeatureBody: "방송에 사용할 전적 오버레이를 생성할 수 있습니다.",
    shareFeatureTitle: "전적 공유 카드",
    shareFeatureBody: "SNS에 공유할 깔끔한 전적 카드를 만듭니다.",
    viewAnalysis: "분석 보기",
    checkFeature: "확인하기",
    createFeature: "만들기",
    folded: "접기",
    killParticipation: "킬 관여율",
    supportBannerTitle: "이 자리는 여러분의 응원을 위한 공간입니다.",
    supportBannerBody: "선수 생일, 스트리머 홍보, 팬 배너를 노출할 수 있는 영역입니다.",
    supportBannerCta: "배너 신청",
    currentSeason: "현재 시즌",
    flexRank: "자유랭크",
    ranked5v5: "5v5 랭크",
    rankTrend: "랭크 흐름",
    emptyTitle: "JP 서버 Riot ID를 입력하면 전적 카드가 열립니다.",
    emptyDescription: "tagLine은 JP1 외 다른 값도 검색할 수 있습니다.",
    win: "승리",
    loss: "패배",
    unknown: "기록 없음",
    unranked: "언랭크",
    level: "레벨",
    ladderRank: "래더 순위",
    noData: "표시할 데이터가 없습니다.",
    kda: "KDA",
    winRate: "승률",
    average: "평균",
    mainRole: "주 포지션",
    confidence: "신뢰도",
    mastery: "숙련도",
    masteryPoint: "숙련도 점수",
    games: "게임",
    live: "준비됨",
    soloRank: "솔로랭크",
    fetchedAt: "갱신",
    route: "서버",
    queue: "큐",
    queueType: "큐 타입",
    recentForm: "최근 흐름",
    searchFailed: "검색에 실패했습니다.",
    riotMissing: "Riot API key가 설정되어 있지 않습니다. 방송 관리 로그인 후 설정 화면에서 key를 저장해주세요.",
    filterTitle: "전적 필터",
    queueFilter: "큐 필터",
    championFilter: "챔피언 필터",
    periodFilter: "기간 필터",
    allQueues: "전체 큐",
    soloQueue: "솔로랭크",
    flexQueue: "자유랭크",
    normalQueue: "일반",
    aramQueue: "칼바람",
    allChampions: "모든 챔피언",
    periodAll: "전체 기간",
    period7: "최근 7일",
    period30: "최근 30일",
    resetFilter: "필터 초기화",
    activeFilter: "필터 적용 중",
    favoritesTitle: "즐겨찾기",
    noFavorites: "저장된 즐겨찾기가 없습니다.",
    favoriteAdd: "즐겨찾기 추가",
    favoriteRemove: "즐겨찾기 해제",
    favoriteAdded: "즐겨찾기에 추가했습니다.",
    favoriteRemoved: "즐겨찾기에서 해제했습니다.",
    notificationsEmpty: "새 알림이 없습니다.",
    markAllRead: "모두 읽음",
    premiumNoticeTitle: "프리미엄 기능 안내",
    premiumNoticeBody: "결제/구독은 아직 연결되지 않았습니다. 현재는 방송 관리 로그인으로 이동합니다.",
    openStreamerLogin: "방송 관리 열기",
    savedData: "저장된 데이터",
    cachedRanking: "저장된 검색 기반 랭킹",
    liveDataNotice: "실시간 친구/전체 자동완성은 Riot 공개 API 제한으로 자체 DB가 쌓인 데이터만 표시합니다.",
    refreshAvailableIn: "후 가능",
    twitchLive: "방송 중",
    twitchOffline: "스트리머 오프라인",
    twitchStreamer: "Twitch 스트리머",
    twitchViewers: "시청자",
    openTwitch: "Twitch 열기",
    profileLinks: "프로필 링크",
    twitchViewerLogin: "Twitch 로그인",
    twitchViewerLogout: "Twitch 로그아웃",
    twitchFollowedTitle: "팔로우 방송인 전적",
    twitchFollowedSubtitle: "Twitch에서 팔로우 중인 방송인 중 Riot ID가 연결된 채널을 보여줍니다.",
    twitchFollowedLinked: "전적 연결",
    twitchFollowedRefresh: "새로고침",
    twitchFollowedEmpty: "팔로우 목록에서 전적이 연결된 방송인을 찾지 못했습니다.",
    twitchFollowedNoRiot: "Riot ID 미연결",
    twitchLoginRequired: "Twitch 로그인 후 팔로우 중인 방송인의 전적을 확인할 수 있습니다.",
    twitchNotConfigured: "Twitch 공개 로그인이 아직 설정되지 않았습니다.",
    streamerRiotRequestTitle: "내 Riot ID 등록 요청",
    streamerRiotRequestBody: "관리자가 확인하면 팔로워들이 Twitch 팔로우 목록에서 내 전적을 바로 볼 수 있습니다.",
    streamerRiotRequestPlaceholder: "게임명#태그",
    streamerRiotRequestSubmit: "등록 요청",
    streamerRiotRequestSubmitting: "요청 중",
    streamerRiotRequestSent: "등록 요청을 보냈습니다. 관리자 승인 후 반영됩니다.",
    streamerRiotRequestApproved: "이미 승인된 Riot ID입니다.",
    streamerRiotRegister: "스트리머 등록",
    streamerRiotRegisterDescription: "내 Twitch 계정과 Riot ID를 연결해 팔로워에게 전적과 오버레이를 보여줍니다.",
    streamerRiotRegisterBack: "돌아가기",
    streamerDashboardOpen: "대시보드 열기",
    streamerRecordOpen: "내 전적 보기",
    twitchProfileMenu: "Twitch 프로필 메뉴",
    twitchFollowedOpen: "팔로우 전적 보기",
    viewRecord: "전적 보기",
    loadMoreMatches: "더보기",
    loadingMoreMatches: "불러오는 중",
    noMoreMatches: "더 이상 표시할 전적이 없습니다.",
    currentGameStatus: "실시간 게임 상태",
    currentlyInGame: "게임중입니다",
    notInGame: "게임중이 아닙니다",
    currentGameParticipants: "참가자",
    blueTeam: "블루 팀",
    redTeam: "레드 팀"
  },
  ja: {
    brand: "LOLTRACE",
    tagline: "JP サーバー戦績検索と配信分析を一つの画面で確認します。",
    searchPlaceholder: "JP サーバー ニックネーム#タグ検索",
    search: "検索",
    searching: "検索中",
    clearSearch: "検索語を削除",
    searchServer: "検索サーバー",
    jpServer: "日本サーバー",
    language: "言語",
    languageMenu: "言語選択",
    languageKo: "韓国語",
    languageJa: "日本語",
    summonerResults: "サモナー",
    relatedSummoners: "関連ニックネーム",
    inputSearch: "入力値",
    verifiedSearch: "確認済み",
    recommended: "おすすめ",
    recentSearch: "最近の検索",
    login: "配信管理ログイン",
    heroTitle: "サモナー戦績を素早く見つけ、重要な流れだけを読み取れます。",
    heroDescription: "ランク、最近の試合、チャンピオン熟練度、ポジション傾向を検索結果に整理します。",
    sample: "検索例",
    jpOnly: "JP サーバー固定 · タグ自由",
    home: "ホーム",
    liveGame: "ライブゲーム",
    filter: "フィルター",
    online: "オンライン",
    premiumTitle: "LOLTRACE Premium",
    premiumBody: "広告非表示、詳細統計、プロリプレイなどのプレミアム機能を体験できます。",
    premiumCta: "プレミアムにアップグレード",
    version: "バージョン",
    notifications: "通知",
    profileSummary: "プレイヤー概要",
    recentGames: "最近の試合",
    recent20Games: "最近20試合",
    topChampions: "チャンピオン熟練度",
    analysis: "主要分析",
    detailAnalysis: "詳細分析",
    matchDetails: "試合詳細",
    expandMatch: "試合詳細を開く",
    collapseMatch: "試合詳細を閉じる",
    aiScore: "スコア",
    mvpBadge: "MVP",
    aceBadge: "ACE",
    unstoppableBadge: "止められない",
    tenacityBadge: "粘り強さ",
    damageCarryBadge: "ダメージ優秀",
    objectiveBadge: "オブジェクト",
    visionBadge: "視界掌握",
    teamDetails: "チーム詳細",
    allyTeam: "味方チーム",
    enemyTeam: "相手チーム",
    tier: "ティア",
    averageTier: "平均ティア",
    tierLoading: "ティア読み込み中",
    tierUnavailable: "ティア確認不可",
    knownTier: "確認済みティア",
    roleDistribution: "ポジション分布",
    recentRecords: "最近の最高記録",
    bestKills: "最高キル",
    bestKda: "最高 KDA",
    bestDamage: "最高ダメージ",
    bestCs: "最高 CS",
    bestVision: "最高視界",
    unitKill: "キル",
    unitDamage: "ダメージ",
    unitPoint: "点",
    total: "合計",
    perMinute: "分あたり",
    teamShare: "チーム比率",
    championPerformance: "チャンピオン別最近成績",
    rolePerformance: "ポジション別最近成績",
    opponent: "相手",
    items: "アイテム",
    damage: "ダメージ",
    damageTaken: "受けたダメージ",
    damageShare: "チームダメージ比率",
    gold: "ゴールド",
    vision: "視界",
    objectives: "オブジェクト",
    wards: "ワード",
    deathTime: "死亡時間",
    popularChampions: "人気チャンピオン",
    trendChampions: "トレンドチャンピオン",
    friendsLive: "フレンドライブ",
    patchSummary: "パッチまとめ",
    duoRecommendation: "デュオおすすめ",
    lpTrend: "LP推移",
    aggregatePerformance: "総合成績",
    roleWinRate: "ポジション別勝率",
    details: "詳細を見る",
    searchNav: "検索",
    ranking: "ランキング",
    overview: "総合",
    championAnalysis: "チャンピオン分析",
    ingame: "インゲーム",
    stats: "統計",
    promotion: "プロモーション",
    community: "コミュニティ",
    multimatch: "マルチサーチ",
    darkMode: "ダークモード",
    moreMenu: "もっと見る",
    favorite: "お気に入り",
    refreshProfile: "戦績更新",
    moreFeatures: "さらに使える機能",
    aiFeatureTitle: "分析",
    aiFeatureBody: "最近20試合からプレイスタイルと改善点を整理します。",
    positionFeatureTitle: "ポジション分析",
    positionFeatureBody: "ポジション別の傾向、勝率、KDAを確認します。",
    overlayFeatureTitle: "配信者オーバーレイ",
    overlayFeatureBody: "配信で使える戦績オーバーレイを生成できます。",
    shareFeatureTitle: "戦績共有カード",
    shareFeatureBody: "SNSで共有できる見やすい戦績カードを作ります。",
    viewAnalysis: "分析を見る",
    checkFeature: "確認する",
    createFeature: "作成する",
    folded: "閉じる",
    killParticipation: "キル関与率",
    supportBannerTitle: "この枠は皆さんの応援のためのスペースです。",
    supportBannerBody: "選手の誕生日、配信者PR、ファンバナーを表示できます。",
    supportBannerCta: "バナー申請",
    currentSeason: "現在のシーズン",
    flexRank: "フレックスランク",
    ranked5v5: "5v5 ランク",
    rankTrend: "ランク推移",
    emptyTitle: "JP サーバー Riot ID を入力すると戦績カードが開きます。",
    emptyDescription: "tagLine は JP1 以外の値も検索できます。",
    win: "勝利",
    loss: "敗北",
    unknown: "記録なし",
    unranked: "アンランク",
    level: "レベル",
    ladderRank: "ラダー順位",
    noData: "表示できるデータがありません。",
    kda: "KDA",
    winRate: "勝率",
    average: "平均",
    mainRole: "メインロール",
    confidence: "信頼度",
    mastery: "熟練度",
    masteryPoint: "熟練度ポイント",
    games: "試合",
    live: "準備済み",
    soloRank: "ソロランク",
    fetchedAt: "更新",
    route: "サーバー",
    queue: "キュー",
    queueType: "キュータイプ",
    recentForm: "最近の流れ",
    searchFailed: "検索に失敗しました。",
    riotMissing: "Riot API key が設定されていません。配信管理にログインして設定画面から key を保存してください。",
    filterTitle: "戦績フィルター",
    queueFilter: "キューフィルター",
    championFilter: "チャンピオンフィルター",
    periodFilter: "期間フィルター",
    allQueues: "全キュー",
    soloQueue: "ソロランク",
    flexQueue: "フレックスランク",
    normalQueue: "ノーマル",
    aramQueue: "ARAM",
    allChampions: "すべてのチャンピオン",
    periodAll: "全期間",
    period7: "直近7日",
    period30: "直近30日",
    resetFilter: "フィルター初期化",
    activeFilter: "フィルター適用中",
    favoritesTitle: "お気に入り",
    noFavorites: "保存されたお気に入りがありません。",
    favoriteAdd: "お気に入り追加",
    favoriteRemove: "お気に入り解除",
    favoriteAdded: "お気に入りに追加しました。",
    favoriteRemoved: "お気に入りから解除しました。",
    notificationsEmpty: "新しい通知はありません。",
    markAllRead: "すべて既読",
    premiumNoticeTitle: "プレミアム機能案内",
    premiumNoticeBody: "決済/購読はまだ接続されていません。現在は配信管理ログインへ移動します。",
    openStreamerLogin: "配信管理を開く",
    savedData: "保存データ",
    cachedRanking: "保存済み検索ベースランキング",
    liveDataNotice: "リアルタイム友達/全体オートコンプリートは Riot 公開 API の制限により、蓄積済みデータのみ表示します。",
    refreshAvailableIn: "後に可能",
    twitchLive: "配信中",
    twitchOffline: "配信者オフライン",
    twitchStreamer: "Twitch 配信者",
    twitchViewers: "視聴者",
    openTwitch: "Twitch を開く",
    profileLinks: "プロフィールリンク",
    twitchViewerLogin: "Twitch ログイン",
    twitchViewerLogout: "Twitch ログアウト",
    twitchFollowedTitle: "フォロー配信者の戦績",
    twitchFollowedSubtitle: "Twitchでフォロー中の配信者から Riot ID が紐づいたチャンネルを表示します。",
    twitchFollowedLinked: "戦績連携",
    twitchFollowedRefresh: "更新",
    twitchFollowedEmpty: "フォロー一覧から戦績連携済みの配信者が見つかりません。",
    twitchFollowedNoRiot: "Riot ID 未連携",
    twitchLoginRequired: "Twitchログイン後、フォロー中の配信者の戦績を確認できます。",
    twitchNotConfigured: "Twitch公開ログインがまだ設定されていません。",
    streamerRiotRequestTitle: "自分の Riot ID 登録申請",
    streamerRiotRequestBody: "管理者が確認すると、フォロワーの Twitch フォロー一覧からあなたの戦績を見られます。",
    streamerRiotRequestPlaceholder: "ゲーム名#タグ",
    streamerRiotRequestSubmit: "登録申請",
    streamerRiotRequestSubmitting: "申請中",
    streamerRiotRequestSent: "登録申請を送信しました。管理者承認後に反映されます。",
    streamerRiotRequestApproved: "すでに承認済みの Riot ID です。",
    streamerRiotRegister: "配信者登録",
    streamerRiotRegisterDescription: "自分の Twitch アカウントと Riot ID を連携し、フォロワーに戦績とオーバーレイを表示します。",
    streamerRiotRegisterBack: "戻る",
    streamerDashboardOpen: "ダッシュボードを開く",
    streamerRecordOpen: "自分の戦績を見る",
    twitchProfileMenu: "Twitch プロフィールメニュー",
    twitchFollowedOpen: "フォロー戦績を見る",
    viewRecord: "戦績を見る",
    loadMoreMatches: "もっと見る",
    loadingMoreMatches: "読み込み中",
    noMoreMatches: "これ以上表示できる戦績はありません。",
    currentGameStatus: "リアルタイムゲーム状態",
    currentlyInGame: "ゲーム中です",
    notInGame: "ゲーム中ではありません",
    currentGameParticipants: "参加者",
    blueTeam: "ブルーチーム",
    redTeam: "レッドチーム"
  }
} as const;

type PublicLocale = keyof typeof publicI18n;
type PublicText = (typeof publicI18n)[PublicLocale];

let activePublicLocale: PublicLocale = "ko";

function t(): PublicText {
  return publicI18n[activePublicLocale];
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

function isPublicLocale(value: unknown): value is PublicLocale {
  return value === "ko" || value === "ja";
}

function readStoredLocale(): PublicLocale | undefined {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isPublicLocale(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

function saveStoredLocale(locale: PublicLocale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // 언어 저장 실패는 화면 사용을 막지 않습니다.
  }
}

function detectBrowserPublicLocale(): PublicLocale {
  const lang = document.documentElement.lang || navigator.language || "";
  return lang.toLocaleLowerCase().startsWith("ja") ? "ja" : "ko";
}

function detectPublicLocale(): PublicLocale {
  return readStoredLocale() ?? detectBrowserPublicLocale();
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

const tierLabels: Record<string, string> = {
  IRON: "Iron",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  EMERALD: "Emerald",
  DIAMOND: "Diamond",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
  CHALLENGER: "Challenger",
  UNRANKED: "Unranked"
};

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
    UTILITY: "サポート",
    SUPPORT: "サポート",
    FILL: "どこでも",
    UNKNOWN: "不明"
  }
};

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

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown; message?: unknown };
    if (typeof body.error === "string") return body.error.includes("Riot API key") ? t().riotMissing : body.error;
    if (typeof body.message === "string") return body.message;
  } catch {
    return `${response.status}`;
  }
  return `${response.status}`;
}

async function searchProfile(riotId: string, options: { refresh?: boolean } = {}): Promise<PublicLolProfile> {
  const params = new URLSearchParams({ riotId });
  if (options.refresh) params.set("refresh", "1");
  const response = await fetch(`${apiBase}/api/lol/profile?${params.toString()}`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as PublicLolProfile;
}

async function getPublicLolMatchPage(riotId: string, start: number): Promise<PublicLolMatchPageResponse> {
  const params = new URLSearchParams({ riotId, start: String(Math.max(0, Math.trunc(start))) });
  const response = await fetch(`${apiBase}/api/lol/matches?${params.toString()}`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as PublicLolMatchPageResponse;
}

async function getPublicLolMatchRanks(matchId: string): Promise<PublicLolMatchRankResponse> {
  const response = await fetch(`${apiBase}/api/lol/match-ranks?matchId=${encodeURIComponent(matchId)}`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as PublicLolMatchRankResponse;
}

async function searchSuggestions(query: string, signal: AbortSignal): Promise<SearchSuggestion[]> {
  const response = await fetch(`${apiBase}/api/lol/suggestions?q=${encodeURIComponent(query)}`, {
    credentials: "include",
    signal
  });
  if (!response.ok) return [];
  const body = await response.json() as { suggestions?: SearchSuggestion[] };
  return Array.isArray(body.suggestions) ? body.suggestions : [];
}

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

function normalizedTagLine(value: string): string {
  return value.trim().normalize("NFKC").toUpperCase();
}

function looksLikeSpaceSeparatedTagLine(value: string): boolean {
  const tagLine = normalizedTagLine(value);
  return tagLine.length > 0 && tagLine.length <= 10 && /^[\p{L}\p{N}_-]+$/u.test(tagLine) && /[\p{N}_-]/u.test(tagLine);
}

function jpRiotIdQuery(value: string): string {
  const normalized = value.trim().normalize("NFKC").replace(/＃/g, "#");
  if (!normalized) return "";
  if (normalized.includes("#")) {
    const hashIndex = normalized.lastIndexOf("#");
    const gameName = normalized.slice(0, hashIndex).trim().replace(/\s+/g, " ");
    const tagLine = normalizedTagLine(normalized.slice(hashIndex + 1));
    return gameName && tagLine ? `${gameName}#${tagLine}` : normalized;
  }
  const parts = normalized.split(/\s+/);
  const possibleTag = parts.at(-1);
  if (possibleTag && looksLikeSpaceSeparatedTagLine(possibleTag) && parts.length > 1) {
    return `${parts.slice(0, -1).join(" ")}#${normalizedTagLine(possibleTag)}`;
  }
  return `${normalized.replace(/\s+/g, " ")}#JP1`;
}

function splitRiotIdText(riotId: string): { gameName: string; tagLine: string } | undefined {
  const normalized = riotId.trim().normalize("NFKC").replace(/＃/g, "#");
  const hashIndex = normalized.lastIndexOf("#");
  if (hashIndex <= 0 || hashIndex === normalized.length - 1) return undefined;
  const gameName = normalized.slice(0, hashIndex).trim().replace(/\s+/g, " ");
  const tagLine = normalizedTagLine(normalized.slice(hashIndex + 1));
  return gameName && tagLine ? { gameName, tagLine } : undefined;
}

function publicSummonerPath(riotId: string): string {
  const parsed = splitRiotIdText(jpRiotIdQuery(riotId));
  if (!parsed) return "/";
  return `${PUBLIC_SUMMONER_ROUTE_PREFIX}${encodeURIComponent(`${parsed.gameName}-${parsed.tagLine}`)}`;
}

function riotIdFromPublicSummonerPath(pathname: string = window.location.pathname): string | undefined {
  if (!pathname.startsWith(PUBLIC_SUMMONER_ROUTE_PREFIX)) return undefined;
  const slug = pathname.slice(PUBLIC_SUMMONER_ROUTE_PREFIX.length).split("/")[0];
  if (!slug) return undefined;
  const decoded = decodeURIComponent(slug).trim().normalize("NFKC").replace(/＃/g, "#");
  if (decoded.includes("#")) return jpRiotIdQuery(decoded);
  const separatorIndex = decoded.lastIndexOf("-");
  if (separatorIndex <= 0 || separatorIndex === decoded.length - 1) return undefined;
  const gameName = decoded.slice(0, separatorIndex).trim();
  const tagLine = normalizedTagLine(decoded.slice(separatorIndex + 1));
  return gameName && tagLine ? `${gameName}#${tagLine}` : undefined;
}

function setPublicPath(pathname: string, replace = false): void {
  const nextPath = pathname || "/";
  if (window.location.pathname === nextPath) return;
  if (replace) {
    window.history.replaceState({}, "", nextPath);
    return;
  }
  window.history.pushState({}, "", nextPath);
}

function suggestionRiotId(suggestion: SearchSuggestion): string {
  return `${suggestion.gameName}#${suggestion.tagLine}`;
}

function normalizeSuggestionKey(suggestion: SearchSuggestion): string {
  return suggestionRiotId(suggestion).toLocaleLowerCase();
}

function readRecentSearches(): SearchSuggestion[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY) ?? "[]") as Array<Partial<SearchSuggestion>>;
    return parsed
      .map((item) => ({
        gameName: typeof item.gameName === "string" ? item.gameName.trim() : "",
        tagLine: typeof item.tagLine === "string" ? normalizedTagLine(item.tagLine) : "JP1",
        source: "recent" as const,
        profileIconUrl: typeof item.profileIconUrl === "string" ? item.profileIconUrl : undefined,
        summonerLevel: typeof item.summonerLevel === "number" ? item.summonerLevel : undefined,
        lolPlatform: typeof item.lolPlatform === "string" ? item.lolPlatform : undefined,
        rankedStats: item.rankedStats && typeof item.rankedStats === "object" ? item.rankedStats as LolRankedStats : undefined,
        lastSeenAt: typeof item.lastSeenAt === "string" ? item.lastSeenAt : undefined
      }))
      .filter((item) => item.gameName && item.tagLine)
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

function saveRecentSearch(profile: PublicLolProfile): void {
  try {
    const next: SearchSuggestion = {
      gameName: profile.gameName,
      tagLine: normalizedTagLine(profile.tagLine),
      source: "recent",
      profileIconUrl: profile.profileIconUrl,
      summonerLevel: profile.summonerLevel,
      lolPlatform: profile.lolPlatform,
      rankedStats: profile.rankedStats,
      lastSeenAt: profile.fetchedAt
    };
    const recent = readRecentSearches().filter((item) => normalizeSuggestionKey(item) !== normalizeSuggestionKey(next));
    window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify([next, ...recent].slice(0, MAX_RECENT_SEARCHES)));
  } catch {
    // 최근 검색 저장 실패는 전적 조회 흐름을 막지 않습니다.
  }
}

function readStoredTheme(): PublicTheme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function readFavorites(): PublicFavorite[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITE_STORAGE_KEY) ?? "[]") as Array<Partial<PublicFavorite>>;
    return parsed
      .map((item) => ({
        gameName: typeof item.gameName === "string" ? item.gameName.trim() : "",
        tagLine: typeof item.tagLine === "string" ? normalizedTagLine(item.tagLine) : "JP1",
        source: "recent" as const,
        profileIconUrl: typeof item.profileIconUrl === "string" ? item.profileIconUrl : undefined,
        summonerLevel: typeof item.summonerLevel === "number" ? item.summonerLevel : undefined,
        lolPlatform: typeof item.lolPlatform === "string" ? item.lolPlatform : undefined,
        rankedStats: item.rankedStats && typeof item.rankedStats === "object" ? item.rankedStats as LolRankedStats : undefined,
        lastSeenAt: typeof item.lastSeenAt === "string" ? item.lastSeenAt : undefined
      }))
      .filter((item) => item.gameName && item.tagLine)
      .slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

function writeFavorites(favorites: PublicFavorite[]): void {
  try {
    window.localStorage.setItem(FAVORITE_STORAGE_KEY, JSON.stringify(favorites.slice(0, MAX_FAVORITES)));
  } catch {
    // 즐겨찾기 저장 실패는 전적 화면 사용을 막지 않습니다.
  }
}

function favoriteFromProfile(profile: PublicLolProfile): PublicFavorite {
  return {
    gameName: profile.gameName,
    tagLine: normalizedTagLine(profile.tagLine),
    source: "recent",
    profileIconUrl: profile.profileIconUrl,
    summonerLevel: profile.summonerLevel,
    lolPlatform: profile.lolPlatform,
    rankedStats: profile.rankedStats,
    lastSeenAt: profile.fetchedAt
  };
}

function isFavoriteProfile(favorites: PublicFavorite[], profile: PublicLolProfile): boolean {
  const key = normalizeSuggestionKey(favoriteFromProfile(profile));
  return favorites.some((favorite) => normalizeSuggestionKey(favorite) === key);
}

function readNotifications(): PublicNotification[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(NOTIFICATION_STORAGE_KEY) ?? "[]") as Array<Partial<PublicNotification>>;
    return parsed
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : cryptoRandomId(),
        title: typeof item.title === "string" ? item.title : "",
        body: typeof item.body === "string" ? item.body : "",
        createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        read: item.read === true
      }))
      .filter((item) => item.title || item.body)
      .slice(0, MAX_NOTIFICATIONS);
  } catch {
    return [];
  }
}

function writeNotifications(notifications: PublicNotification[]): void {
  try {
    window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // 알림 저장 실패는 화면 동작에 영향을 주지 않습니다.
  }
}

function cryptoRandomId(): string {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

function searchTextForMatch(value: string): string {
  return value.trim().normalize("NFKC").replace("＃", "#").toLocaleLowerCase();
}

function inputSuggestion(query: string): SearchSuggestion | undefined {
  const riotId = jpRiotIdQuery(query);
  const hashIndex = riotId.lastIndexOf("#");
  if (hashIndex <= 0 || hashIndex === riotId.length - 1) return undefined;
  const gameName = riotId.slice(0, hashIndex).trim();
  const tagLine = normalizedTagLine(riotId.slice(hashIndex + 1));
  if (!gameName || !tagLine) return undefined;
  return { gameName, tagLine, source: "input" };
}

function buildSuggestions(query: string, recentSearches: SearchSuggestion[], remoteSuggestions: SearchSuggestion[]): SearchSuggestion[] {
  const searchText = searchTextForMatch(query);
  const direct = inputSuggestion(query);
  const merged = [...remoteSuggestions, direct, ...recentSearches].filter((suggestion): suggestion is SearchSuggestion => Boolean(suggestion));
  const unique = new Map<string, SearchSuggestion>();
  for (const suggestion of merged) {
    const key = normalizeSuggestionKey(suggestion);
    if (!unique.has(key)) unique.set(key, suggestion);
  }
  const values = [...unique.values()];
  if (!searchText) return values.slice(0, MAX_SEARCH_SUGGESTIONS);
  const tagOnly = searchText.startsWith("#") ? searchText.slice(1) : "";
  return values
    .filter((suggestion) => {
      if (suggestion.source === "input") return true;
      const riotId = suggestionRiotId(suggestion).toLocaleLowerCase();
      const gameName = suggestion.gameName.toLocaleLowerCase();
      const tagLine = suggestion.tagLine.toLocaleLowerCase();
      if (tagOnly) return tagLine.includes(tagOnly);
      return riotId.includes(searchText) || gameName.includes(searchText) || tagLine.includes(searchText);
    })
    .slice(0, MAX_SEARCH_SUGGESTIONS);
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

function rankLabel(stats: LolRankedStats | undefined): string {
  if (!stats || stats.tier === "UNRANKED") return t().unranked;
  return `${tierLabels[stats.tier] ?? stats.tier} ${stats.rank ?? ""} ${stats.leaguePoints} LP`.trim();
}

function rankPointLabel(point: LolRankHistoryPoint | undefined): string {
  if (!point || point.tier === "UNRANKED") return t().unranked;
  return `${tierLabels[point.tier] ?? point.tier} ${point.rank ?? ""} ${point.leaguePoints} LP`.trim();
}

function shortRankLabel(stats: LolRankedStats | undefined, emptyLabel = "JP", unrankedLabel = emptyLabel): string {
  if (!stats) return emptyLabel;
  if (stats.tier === "UNRANKED") return unrankedLabel;
  const tierInitials: Record<string, string> = {
    IRON: "I",
    BRONZE: "B",
    SILVER: "S",
    GOLD: "G",
    PLATINUM: "P",
    EMERALD: "E",
    DIAMOND: "D",
    MASTER: "M",
    GRANDMASTER: "GM",
    CHALLENGER: "C"
  };
  const rankNumbers: Record<string, string> = {
    I: "1",
    II: "2",
    III: "3",
    IV: "4"
  };
  const tier = tierInitials[stats.tier] ?? stats.tier.slice(0, 1);
  return `${tier}${stats.rank ? rankNumbers[stats.rank] ?? stats.rank : ""}`;
}

function rankBadgeClass(stats: LolRankedStats | undefined): string {
  return `public-suggestion-rank ${stats?.tier ? stats.tier.toLocaleLowerCase() : "platform"}`;
}

function rankTierClass(stats: LolRankedStats | undefined, state: "ready" | "loading" | "unknown" = "ready"): string {
  if (state === "loading") return "public-team-rank-badge loading";
  if (!stats) return "public-team-rank-badge unknown";
  return `public-team-rank-badge ${stats?.tier ? stats.tier.toLocaleLowerCase() : "unranked"}`;
}

function matchRankBadgeLabel(stats: LolRankedStats | undefined, loading = false): string {
  if (loading) return "...";
  return shortRankLabel(stats, "-", "U");
}

function totalGames(stats: LolRankedStats | undefined): number {
  return (stats?.wins ?? 0) + (stats?.losses ?? 0);
}

function rankScore(stats: LolRankedStats | undefined): number {
  if (!stats || stats.tier === "UNRANKED") return 0;
  const tierScore: Record<string, number> = {
    IRON: 0,
    BRONZE: 400,
    SILVER: 800,
    GOLD: 1200,
    PLATINUM: 1600,
    EMERALD: 2000,
    DIAMOND: 2400,
    MASTER: 2800,
    GRANDMASTER: 3200,
    CHALLENGER: 3600
  };
  const divisionScore: Record<string, number> = {
    IV: 0,
    III: 100,
    II: 200,
    I: 300
  };
  return (tierScore[stats.tier] ?? 0) + (stats.rank ? divisionScore[stats.rank] ?? 0 : 0) + stats.leaguePoints;
}

function rankLabelFromScore(score: number): string {
  if (!Number.isFinite(score) || score <= 0) return t().unranked;
  const tiers = [
    { tier: "IRON", base: 0 },
    { tier: "BRONZE", base: 400 },
    { tier: "SILVER", base: 800 },
    { tier: "GOLD", base: 1200 },
    { tier: "PLATINUM", base: 1600 },
    { tier: "EMERALD", base: 2000 },
    { tier: "DIAMOND", base: 2400 },
    { tier: "MASTER", base: 2800 },
    { tier: "GRANDMASTER", base: 3200 },
    { tier: "CHALLENGER", base: 3600 }
  ];
  const tier = [...tiers].reverse().find((item) => score >= item.base) ?? { tier: "IRON", base: 0 };
  if (tier.tier === "MASTER" || tier.tier === "GRANDMASTER" || tier.tier === "CHALLENGER") {
    return tierLabels[tier.tier] ?? tier.tier;
  }
  const remainder = Math.max(0, score - tier.base);
  const divisions = ["IV", "III", "II", "I"];
  const division = divisions[Math.min(3, Math.floor(remainder / 100))] ?? "IV";
  return `${tierLabels[tier.tier] ?? tier.tier} ${division}`;
}

function averageTierLabel(stats: Array<LolRankedStats | undefined>): string {
  const ranked = stats.filter((item): item is LolRankedStats => Boolean(item && item.tier !== "UNRANKED"));
  if (ranked.length === 0) return t().unranked;
  const averageScore = ranked.reduce((sum, item) => sum + rankScore(item), 0) / ranked.length;
  return rankLabelFromScore(averageScore);
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

function matchRankForOpponent(rankDetail: PublicLolMatchRankResponse | undefined, opponent: PublicLolRecentMatch["opponent"]): LolRankedStats | undefined {
  if (!rankDetail || !opponent) return undefined;
  const riotKey = opponent.riotId ? searchTextForMatch(opponent.riotId) : "";
  const participant = rankDetail.participants.find((item) => (
    (riotKey && item.riotId && searchTextForMatch(item.riotId) === riotKey) ||
    item.championId === opponent.champion.championId
  ));
  return participant?.rankedStats;
}

function resultLabel(result: PublicLolRecentMatch["result"]): string {
  if (result === "win") return t().win;
  if (result === "loss") return t().loss;
  return t().unknown;
}

function formatNumber(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatDecimal(value: number | undefined, digits = 2): string {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

function formatDate(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return "-";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.max(0, Math.floor(seconds % 60));
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function refreshRemainingMs(profile: PublicLolProfile | null, now: number): number {
  const availableAt = profile?.refreshAvailableAt ? Date.parse(profile.refreshAvailableAt) : 0;
  if (!Number.isFinite(availableAt)) return 0;
  return Math.max(0, availableAt - now);
}

function formatCooldown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatPercent(value: number | undefined, digits = 0): string {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toFixed(digits)}%`;
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

function safeRecordValue(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : -1;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function averageNumbers(values: Array<number | undefined>, digits: number): number | undefined {
  const numeric = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
  if (numeric.length === 0) return undefined;
  return roundTo(numeric.reduce((sum, value) => sum + value, 0) / numeric.length, digits);
}

function kdaFromTotals(kills: number, deaths: number, assists: number): number {
  return roundTo(deaths <= 0 ? kills + assists : (kills + assists) / deaths, 2);
}

function winRateFromTotals(wins: number, games: number): number {
  if (games <= 0) return 0;
  return Math.round((wins / games) * 100);
}

function summarizeMatches(matches: PublicLolRecentMatch[]): PublicLolProfile["summary"] {
  const recentWins = matches.filter((match) => match.result === "win").length;
  const totalKills = matches.reduce((sum, match) => sum + match.kills, 0);
  const totalDeaths = matches.reduce((sum, match) => sum + match.deaths, 0);
  const totalAssists = matches.reduce((sum, match) => sum + match.assists, 0);
  return {
    recentGames: matches.length,
    recentWins,
    recentWinRate: winRateFromTotals(recentWins, matches.length),
    averageKda: matches.length > 0 ? kdaFromTotals(totalKills, totalDeaths, totalAssists) : undefined,
    averageCsPerMinute: averageNumbers(matches.map((match) => match.csPerMinute), 1),
    averageKillParticipation: averageNumbers(matches.map((match) => match.killParticipation), 0),
    averageDamagePerMinute: averageNumbers(matches.map((match) => match.damagePerMinute), 0),
    averageDamageShare: averageNumbers(matches.map((match) => match.damageShare), 1),
    averageGoldPerMinute: averageNumbers(matches.map((match) => match.goldPerMinute), 0),
    averageVisionScore: averageNumbers(matches.map((match) => match.visionScore), 1),
    totalKills,
    totalDeaths,
    totalAssists
  };
}

function championPerformanceFromMatches(matches: PublicLolRecentMatch[]): PublicLolChampionPerformance[] {
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
    .sort((a, b) => b.games - a.games || b.wins - a.wins)
    .map((item) => ({
      champion: item.champion,
      games: item.games,
      wins: item.wins,
      winRate: winRateFromTotals(item.wins, item.games),
      averageKda: kdaFromTotals(item.kills, item.deaths, item.assists),
      averageCsPerMinute: averageNumbers(item.csPerMinute, 1),
      averageDamagePerMinute: averageNumbers(item.damagePerMinute, 0)
    }));
}

function rolePerformanceFromMatches(matches: PublicLolRecentMatch[]): PublicLolRolePerformance[] {
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
      winRate: winRateFromTotals(item.wins, item.games),
      averageKda: kdaFromTotals(item.kills, item.deaths, item.assists)
    }));
}

function queueMatchesFilter(match: PublicLolRecentMatch, queue: MatchQueueFilter): boolean {
  if (queue === "all") return true;
  if (queue === "solo") return match.queueId === 420;
  if (queue === "flex") return match.queueId === 440;
  if (queue === "ranked5v5") return match.queueId === 42 || match.queueId === 6;
  if (queue === "normal") return match.queueId === 400 || match.queueId === 430;
  if (queue === "aram") return match.queueId === 450;
  return true;
}

function periodMatchesFilter(match: PublicLolRecentMatch, period: MatchPeriodFilter): boolean {
  if (period === "all") return true;
  const startedAt = Date.parse(match.startedAt ?? "");
  if (!Number.isFinite(startedAt)) return false;
  const days = period === "7d" ? 7 : 30;
  return Date.now() - startedAt <= days * 24 * 60 * 60 * 1000;
}

function filteredMatches(profile: PublicLolProfile, filters: PublicMatchFilters): PublicLolRecentMatch[] {
  return profile.recentMatches.filter((match) => (
    queueMatchesFilter(match, filters.queue) &&
    periodMatchesFilter(match, filters.period) &&
    (filters.championId === "all" || String(match.champion.championId) === filters.championId)
  ));
}

function profileWithMatches(profile: PublicLolProfile, matches: PublicLolRecentMatch[]): PublicLolProfile {
  return {
    ...profile,
    recentMatches: matches,
    summary: summarizeMatches(matches),
    championPerformance: championPerformanceFromMatches(matches),
    rolePerformance: rolePerformanceFromMatches(matches)
  };
}

function profileWithAdditionalMatchPage(profile: PublicLolProfile, page: PublicLolMatchPageResponse): PublicLolProfile {
  const matches = new Map<string, PublicLolRecentMatch>();
  for (const match of profile.recentMatches) matches.set(match.matchId, match);
  for (const match of page.recentMatches) matches.set(match.matchId, match);
  return profileWithMatches({
    ...profile,
    fetchedAt: page.fetchedAt,
    recentMatchStart: 0,
    nextRecentMatchStart: page.nextRecentMatchStart,
    hasMoreRecentMatches: page.hasMoreRecentMatches
  }, [...matches.values()]);
}

function hasActiveFilters(filters: PublicMatchFilters): boolean {
  return filters.queue !== "all" || filters.championId !== "all" || filters.period !== "all";
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

function averageAiScore(profile: PublicLolProfile): number {
  if (profile.recentMatches.length === 0) return 0;
  return Math.round(profile.recentMatches.reduce((sum, match) => sum + matchAiScore(match), 0) / profile.recentMatches.length);
}

function estimatedLpDelta(match: PublicLolRecentMatch): number {
  if (match.result === "win") return 20;
  if (match.result === "loss") return -18;
  return 0;
}

function rankTrendLine(profile: PublicLolProfile): PublicTrendLine | undefined {
  const matches = profile.recentMatches.slice(0, 20).reverse();
  if (matches.length === 0) return undefined;
  const currentLp = profile.rankedStats?.leaguePoints ?? 0;
  const totalDelta = matches.reduce((sum, match) => sum + estimatedLpDelta(match), 0);
  let runningLp = currentLp - totalDelta;
  const samples = matches.map((match, index) => {
    runningLp += estimatedLpDelta(match);
    return {
      key: `${match.matchId}:lp:${index}`,
      value: runningLp,
      label: `${resultLabel(match.result)} · ${Math.max(0, Math.round(runningLp))} LP`,
      result: match.result
    };
  });

  if (samples.length === 0) return undefined;
  const width = 320;
  const height = 112;
  const padX = 14;
  const padY = 16;
  const min = Math.min(...samples.map((point) => point.value));
  const max = Math.max(...samples.map((point) => point.value));
  const range = Math.max(1, max - min);
  const points = samples.map((point, index): PublicTrendPoint => {
    const x = samples.length === 1
      ? width / 2
      : padX + (index / (samples.length - 1)) * (width - padX * 2);
    const y = padY + (1 - ((point.value - min) / range)) * (height - padY * 2);
    return { ...point, x: roundTo(x, 1), y: roundTo(y, 1) };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const baseY = height - padY;
  const areaPath = points.length === 1
    ? `M ${points[0]!.x} ${baseY} L ${points[0]!.x} ${points[0]!.y} L ${points[0]!.x} ${baseY} Z`
    : `M ${points[0]!.x} ${baseY} L ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${points[points.length - 1]!.x} ${baseY} Z`;

  return {
    points,
    linePoints,
    areaPath,
    minLabel: `${Math.max(0, Math.round(min))} LP`,
    maxLabel: `${Math.max(0, Math.round(max))} LP`
  };
}

function heatBackground(value: number | undefined, total: number, color: "blue" | "green" | "red" = "blue"): string {
  const width = barWidth(value, total);
  const rgba = color === "green" ? "34, 197, 94" : color === "red" ? "239, 68, 68" : "126, 225, 214";
  return `linear-gradient(90deg, rgba(${rgba}, .22) 0 ${width}, rgba(255, 255, 255, .035) ${width} 100%)`;
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

function SearchForm({
  query,
  loading,
  onQuery,
  onClear,
  onSubmit,
  suggestions,
  onPickSuggestion
}: {
  query: string;
  loading: boolean;
  onQuery: (value: string) => void;
  onClear: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  suggestions: SearchSuggestion[];
  onPickSuggestion: (suggestion: SearchSuggestion) => void;
}) {
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const hasQuery = query.trim().length > 0;

  return (
    <div className="public-search-wrap">
      <form className="public-search-form" onSubmit={onSubmit}>
        <div className="public-search-server">
          <button
            type="button"
            className="public-server-pill"
            aria-label={t().searchServer}
            aria-expanded={serverMenuOpen}
            onClick={() => setServerMenuOpen((open) => !open)}
            disabled={loading}
          >
            <strong>JP</strong>
            <span aria-hidden="true" />
          </button>
          {serverMenuOpen ? (
            <div className="public-server-menu" role="listbox" aria-label={t().searchServer}>
              <button type="button" role="option" aria-selected="true" onClick={() => setServerMenuOpen(false)}>
                <strong>JP</strong>
                <span data-ko={publicI18n.ko.jpServer} data-ja={publicI18n.ja.jpServer}>{t().jpServer}</span>
              </button>
            </div>
          ) : null}
        </div>
        <label className="public-search-field">
          <span className="sr-only" data-ko={publicI18n.ko.searchPlaceholder} data-ja={publicI18n.ja.searchPlaceholder}>{t().searchPlaceholder}</span>
          <input
            id="public-search-input"
            value={query}
            placeholder={t().searchPlaceholder}
            data-ko={publicI18n.ko.searchPlaceholder}
            data-ja={publicI18n.ja.searchPlaceholder}
            onChange={(event) => onQuery(event.target.value)}
            disabled={loading}
          />
        </label>
        <div className="public-search-actions">
          {hasQuery ? (
            <button
              type="button"
              className="public-search-icon-button public-search-clear"
              aria-label={t().clearSearch}
              onClick={onClear}
              disabled={loading}
            >
              <span aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="submit"
            className={`public-search-icon-button public-search-submit ${loading ? "loading" : ""}`}
            aria-label={loading ? t().searching : t().search}
            disabled={loading || !hasQuery}
          >
            <span aria-hidden="true" />
          </button>
        </div>
      </form>
      {suggestions.length > 0 ? (
        <div className="public-suggestion-panel">
          <div className="public-suggestion-title" data-ko={publicI18n.ko.summonerResults} data-ja={publicI18n.ja.summonerResults}>{t().summonerResults}</div>
          <div className="public-suggestion-list" role="listbox" aria-label={t().relatedSummoners}>
            {suggestions.map((suggestion) => (
              <button
                type="button"
                role="option"
                key={`${suggestion.source}:${suggestionRiotId(suggestion)}`}
                aria-label={`${suggestionRiotId(suggestion)} ${suggestionSourceLabel(suggestion)}`}
                title={suggestionSourceLabel(suggestion)}
                onClick={() => onPickSuggestion(suggestion)}
              >
                <span className="public-suggestion-avatar">
                  {suggestion.profileIconUrl ? <img src={assetUrl(suggestion.profileIconUrl)} alt="" /> : suggestion.gameName.slice(0, 1).toUpperCase()}
                </span>
                <span className={rankBadgeClass(suggestion.rankedStats)}>{shortRankLabel(suggestion.rankedStats)}</span>
                <span className="public-suggestion-name">
                  <span>{suggestion.gameName}</span>
                  <strong>#{suggestion.tagLine}</strong>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCards({ profile }: { profile: PublicLolProfile }) {
  const stats = profile.rankedStats;
  const performance = profile.performanceStats;
  const summary = profile.summary;
  return (
    <section id="public-stats" className="public-card-grid summary">
      <article className="public-stat-card">
        <span>{t().winRate}</span>
        <strong>{stats ? `${stats.winRate}%` : "-"}</strong>
        <p>{stats ? winLossText(stats.wins, stats.wins + stats.losses) : t().noData}</p>
      </article>
      <article className="public-stat-card">
        <span>{t().kda}</span>
        <strong>{formatDecimal(performance?.kda)}</strong>
        <p>{performance ? `${performance.averageKills} / ${performance.averageDeaths} / ${performance.averageAssists}` : t().noData}</p>
      </article>
      <article className="public-stat-card">
        <span>{t().mainRole}</span>
        <strong>{mainRoleLabel(profile.roleAnalysis?.mainRole)}</strong>
        <p>{profile.roleAnalysis ? `${t().confidence} ${profile.roleAnalysis.confidence}% · ${profile.roleAnalysis.sampleSize}${t().games}` : t().noData}</p>
      </article>
      <article className="public-stat-card">
        <span>{t().recentGames}</span>
        <strong>{summary.recentWinRate}%</strong>
        <p>{gamesText(summary.recentGames)} · {winsText(summary.recentWins)} · {summary.totalKills}/{summary.totalDeaths}/{summary.totalAssists}</p>
      </article>
      <article className="public-stat-card">
        <span data-ko={publicI18n.ko.damage} data-ja={publicI18n.ja.damage}>{t().damage}</span>
        <strong>{formatNumber(summary.averageDamagePerMinute)}</strong>
        <p>{perMinuteText(t().damage, summary.averageDamagePerMinute)} · {t().damageShare} {formatPercent(summary.averageDamageShare, 1)}</p>
      </article>
      <article className="public-stat-card">
        <span>CS / {t().gold}</span>
        <strong>{formatDecimal(summary.averageCsPerMinute, 1)}</strong>
        <p>{perMinuteText("CS", summary.averageCsPerMinute, 1)} · {perMinuteText(t().gold, summary.averageGoldPerMinute)}</p>
      </article>
      <article className="public-stat-card">
        <span data-ko={publicI18n.ko.vision} data-ja={publicI18n.ja.vision}>{t().vision}</span>
        <strong>{formatDecimal(summary.averageVisionScore, 1)}</strong>
        <p>{t().average} {t().vision} · {killParticipationText(summary.averageKillParticipation)}</p>
      </article>
    </section>
  );
}

function ProfileSeasonBadges({ profile }: { profile: PublicLolProfile }) {
  const historyBadges = [...(profile.rankHistory ?? [])]
    .filter((point) => Number.isFinite(Date.parse(point.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .reduce<Array<{ year: string; label: string }>>((items, point) => {
      const year = String(new Date(point.date).getFullYear());
      if (!items.some((item) => item.year === year)) items.push({ year, label: rankPointLabel(point) });
      return items;
    }, [])
    .slice(0, 3);
  const fetchedYear = new Date(profile.fetchedAt).getFullYear();
  const seasonLabel = Number.isFinite(fetchedYear) ? `${fetchedYear}` : t().currentSeason;
  const badges = historyBadges.length > 0
    ? historyBadges
    : [{ year: seasonLabel, label: rankLabel(profile.rankedStats) }];
  return (
    <div className="public-season-badges" aria-label={t().rankTrend}>
      {badges.map((badge) => <span key={`${badge.year}:${badge.label}`}>{badge.year} {badge.label}</span>)}
      <span>{t().recentForm} {winLossText(profile.summary.recentWins, profile.summary.recentGames)}</span>
    </div>
  );
}

function RankOverviewCard({
  title,
  stats,
  fallback = false
}: {
  title: string;
  stats: LolRankedStats | undefined;
  fallback?: boolean;
}) {
  const tierIcon = assetUrl(stats?.tierIconUrl);
  const unranked = fallback || !stats || stats.tier === "UNRANKED";
  return (
    <article className="public-rank-overview-card">
      {tierIcon ? <img src={tierIcon} alt="" /> : <div className="public-rank-fallback">{unranked ? "U" : stats?.tier?.slice(0, 1) ?? "U"}</div>}
      <div>
        <span>{title}</span>
        <strong>{unranked ? t().unranked : rankLabel(stats)}</strong>
        <small>{stats ? `${stats.leaguePoints} LP · ${t().winRate} ${stats.winRate}%` : t().noData}</small>
      </div>
    </article>
  );
}

function ProfileMetricStrip({ profile }: { profile: PublicLolProfile }) {
  const recentLosses = Math.max(0, profile.summary.recentGames - profile.summary.recentWins);
  return (
    <div className="public-profile-metric-strip" aria-label={t().profileSummary}>
      <article>
        <span>{t().recentGames}</span>
        <strong>{profile.summary.recentWins}{activePublicLocale === "ja" ? "勝" : "승"} {recentLosses}{activePublicLocale === "ja" ? "敗" : "패"}</strong>
        <small>{t().winRate} {formatPercent(profile.summary.recentWinRate)}</small>
      </article>
      <article>
        <span>{t().kda}</span>
        <strong>{formatDecimal(profile.summary.averageKda)}</strong>
        <small>{profile.summary.totalKills} / {profile.summary.totalDeaths} / {profile.summary.totalAssists}</small>
      </article>
      <article>
        <span data-ko={publicI18n.ko.killParticipation} data-ja={publicI18n.ja.killParticipation}>{t().killParticipation}</span>
        <strong>{formatPercent(profile.summary.averageKillParticipation)}</strong>
        <small>{t().average}</small>
      </article>
      <article>
        <span>{t().mainRole}</span>
        <strong>{mainRoleLabel(profile.roleAnalysis?.mainRole)}</strong>
        <small>{profile.roleAnalysis ? `${t().confidence} ${profile.roleAnalysis.confidence}%` : t().noData}</small>
      </article>
      <article>
        <span>{t().aiScore}</span>
        <strong>{averageAiScore(profile)}</strong>
        <small>{t().recentForm}</small>
      </article>
    </div>
  );
}

function profileLinkPlatformFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
    if (host.endsWith("twitch.tv")) return "twitch";
    if (host === "discord.gg" || host.endsWith("discord.com")) return "discord";
    if (host === "x.com" || host.endsWith("twitter.com")) return "x";
    if (host.endsWith("instagram.com")) return "instagram";
    if (host.endsWith("tiktok.com")) return "tiktok";
    if (host.endsWith("afreecatv.com") || host.endsWith("sooplive.co.kr")) return "soop";
  } catch {
    return "website";
  }
  return "website";
}

function profileLinkIconText(platform: string): string {
  const icons: Record<string, string> = {
    youtube: "YT",
    twitch: "TV",
    discord: "DC",
    x: "X",
    instagram: "IG",
    tiktok: "TT",
    soop: "SO",
    website: "LK"
  };
  return icons[platform] ?? "LK";
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

function ProfileLinkIcons({ links }: { links: PublicProfileLink[] }) {
  if (!links.length) return null;
  return (
    <span className="public-profile-link-icons" aria-label={t().profileLinks}>
      {links.map((link, index) => {
        const platform = (link.platform || profileLinkPlatformFromUrl(link.url)).toLowerCase().replace(/[^a-z0-9_-]/g, "") || "website";
        return (
          <a
            className={`public-profile-link-icon ${platform}`}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            title={link.label}
            aria-label={link.label}
            key={`${link.id ?? link.url}:${index}`}
          >
            {profileLinkIconText(platform)}
          </a>
        );
      })}
    </span>
  );
}

function TwitchStreamBadge({ stream }: { stream: PublicLolTwitchStream | undefined }) {
  if (!stream) return null;
  const profileLinks = profileLinksFromStream(stream);
  const label = stream.isLive ? t().twitchLive : t().twitchOffline;
  const meta = [
    stream.gameName,
    stream.viewerCount !== undefined ? `${formatNumber(stream.viewerCount)} ${t().twitchViewers}` : undefined,
    stream.isLive && stream.startedAt ? formatDate(stream.startedAt) : undefined
  ].filter(Boolean).join(" · ");
  const content = (
    <>
      <span className={`public-live-dot ${stream.isLive ? "live" : ""}`} aria-hidden="true" />
      {stream.profileImageUrl ? <img src={stream.profileImageUrl} alt="" /> : null}
      <span>
        <strong>{label}</strong>
        <small>{stream.twitchDisplayName}{meta ? ` · ${meta}` : ""}</small>
      </span>
      {stream.title ? <em>{stream.title}</em> : null}
    </>
  );
  return (
    <div
      className={`public-twitch-stream-badge ${stream.isLive ? "live" : "offline"}`}
      aria-label={`${t().twitchStreamer} ${label}`}
    >
      {content}
      {stream.channelUrl || profileLinks.length ? (
        <span className="public-twitch-stream-links">
          {stream.channelUrl ? <a href={stream.channelUrl} target="_blank" rel="noreferrer">{t().openTwitch}</a> : null}
          {profileLinks.map((link, index) => (
            <a href={link.url} target="_blank" rel="noreferrer" key={`${link.id ?? link.url}:${index}`}>{link.label}</a>
          ))}
        </span>
      ) : null}
    </div>
  );
}

function LpTrendLineChart({ profile, compact = false }: { profile: PublicLolProfile; compact?: boolean }) {
  const trend = rankTrendLine(profile);
  if (!trend) return <p className="public-empty">{t().noData}</p>;

  return (
    <>
      <svg className={`public-lp-line ${compact ? "compact" : ""}`} viewBox="0 0 320 112" role="img" aria-label={t().lpTrend} preserveAspectRatio="none">
        <path className="public-lp-line-area" d={trend.areaPath} />
        <polyline className="public-lp-line-stroke" points={trend.linePoints} />
        {trend.points.map((point) => (
          <g className={`public-lp-line-point ${point.result}`} key={point.key}>
            <circle cx={point.x} cy={point.y} r="4" />
            <title>{point.label}</title>
          </g>
        ))}
      </svg>
      {compact ? null : <div className="public-lp-chart-axis" aria-hidden="true">
        <span>{trend.minLabel}</span>
        <span>{trend.maxLabel}</span>
      </div>}
    </>
  );
}

function ProfileTopPanel({
  profile,
  loading,
  favoriteActive,
  refreshRemaining,
  onRefresh,
  onToggleFavorite
}: {
  profile: PublicLolProfile;
  loading: boolean;
  favoriteActive: boolean;
  refreshRemaining: number;
  onRefresh: () => void;
  onToggleFavorite: () => void;
}) {
  const refreshDisabled = loading || refreshRemaining > 0;
  const refreshCoolingDown = refreshRemaining > 0;
  const soloStats = soloRankStats(profile);
  const flexStats = flexRankStats(profile);
  const rank5v5Stats = ranked5v5Stats(profile);
  const masteryChampionArt = assetUrl(profile.topChampions[0]?.splashUrl ?? profile.topChampions[0]?.loadingUrl);
  const profileLinks = profileLinksFromStream(profile.twitchStream);
  return (
    <section id="public-ranking" className={`public-profile-top-grid ${masteryChampionArt ? "has-mastery-art" : ""}`}>
      {masteryChampionArt ? <img className="public-profile-mastery-art" src={masteryChampionArt} alt="" aria-hidden="true" /> : null}
      <div className="public-profile-top-main">
        <ProfileSeasonBadges profile={profile} />
        <div className="public-profile-top-content">
          <div className="public-avatar square">
            {profile.profileIconUrl ? <img src={assetUrl(profile.profileIconUrl)} alt="" /> : <span>{profile.gameName.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="public-profile-top-copy">
            <div className="public-profile-title-row">
              <h2>{profile.gameName}</h2>
              <span>#{profile.tagLine}</span>
              <button
                type="button"
                className={`public-favorite-button ${favoriteActive ? "active" : ""}`}
                aria-label={favoriteActive ? t().favoriteRemove : t().favoriteAdd}
                aria-pressed={favoriteActive}
                onClick={onToggleFavorite}
              >
                ★
              </button>
            </div>
            <div className="public-profile-actions">
              <button
                type="button"
                className={`public-refresh-button ${refreshCoolingDown ? "cooldown" : ""}`}
                onClick={onRefresh}
                disabled={refreshDisabled}
                title={refreshCoolingDown ? `${formatCooldown(refreshRemaining)} ${t().refreshAvailableIn}` : t().refreshProfile}
              >
                {refreshCoolingDown ? (
                  <strong>{formatCooldown(refreshRemaining)}</strong>
                ) : (
                  <>
                    <span aria-hidden="true">↻</span>
                    <strong>{loading ? t().searching : t().refreshProfile}</strong>
                  </>
                )}
              </button>
              <button type="button" className="public-secondary-action" onClick={onToggleFavorite}>
                {favoriteActive ? t().favoriteRemove : t().favoriteAdd}
              </button>
              <ProfileLinkIcons links={profileLinks} />
              <span>{t().fetchedAt} {formatDate(profile.fetchedAt)}</span>
            </div>
            <TwitchStreamBadge stream={profile.twitchStream} />
          </div>
        </div>
      </div>
      <aside className="public-profile-top-side" aria-label={t().ranking}>
        <RankOverviewCard title={t().soloRank} stats={soloStats} fallback={!soloStats} />
        <RankOverviewCard title={t().flexRank} stats={flexStats} fallback={!flexStats} />
        <RankOverviewCard title={t().ranked5v5} stats={rank5v5Stats} fallback={!rank5v5Stats} />
      </aside>
      <ProfileMetricStrip profile={profile} />
    </section>
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
        <h2 data-ko={publicI18n.ko.moreFeatures} data-ja={publicI18n.ja.moreFeatures}>{t().moreFeatures}</h2>
        <span data-ko={publicI18n.ko.folded} data-ja={publicI18n.ja.folded}>{t().folded}</span>
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
      <button type="button" className={activeTab === "overview" ? "active" : ""} onClick={() => onChange("overview")} data-ko={publicI18n.ko.overview} data-ja={publicI18n.ja.overview}>{t().overview}</button>
      <button type="button" className={activeTab === "champions" ? "active" : ""} onClick={() => onChange("champions")} data-ko={publicI18n.ko.championAnalysis} data-ja={publicI18n.ja.championAnalysis}>{t().championAnalysis}</button>
      <button type="button" className={activeTab === "ingame" ? "active" : ""} onClick={() => onChange("ingame")} data-ko={publicI18n.ko.ingame} data-ja={publicI18n.ja.ingame}>{t().ingame}</button>
    </nav>
  );
}

function RankSummaryPanel({ profile }: { profile: PublicLolProfile }) {
  const stats = soloRankStats(profile);
  const tierIcon = assetUrl(stats?.tierIconUrl);
  return (
    <section className="public-panel public-rank-summary-panel">
      <div className="public-section-head">
        <h2 data-ko={publicI18n.ko.soloRank} data-ja={publicI18n.ja.soloRank}>{t().soloRank}</h2>
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
      <div className="public-rank-mini-chart">
        <LpTrendLineChart profile={profile} compact />
      </div>
    </section>
  );
}

function FlexRankPlaceholder() {
  return (
    <section className="public-panel public-rank-summary-panel compact">
      <div className="public-section-head">
        <h2 data-ko={publicI18n.ko.flexRank} data-ja={publicI18n.ja.flexRank}>{t().flexRank}</h2>
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
  return (
    <section id="public-stats" className="public-overview-dashboard-panel">
      <article className="public-panel public-aggregate-card">
        <div className="public-section-head">
          <h2 data-ko={publicI18n.ko.aggregatePerformance} data-ja={publicI18n.ja.aggregatePerformance}>{t().aggregatePerformance}</h2>
          <span>{profile.summary.recentGames}{t().games}</span>
        </div>
        <div className="public-aggregate-grid">
          <div>
            <strong>{formatDecimal(profile.summary.averageKda)}</strong>
            <span>{t().average} KDA</span>
            <small>{profile.summary.totalKills} / {profile.summary.totalDeaths} / {profile.summary.totalAssists}</small>
          </div>
          <div>
            <strong>{formatDecimal(profile.summary.averageCsPerMinute, 1)}</strong>
            <span>{t().average} CS</span>
            <small>{activePublicLocale === "ja" ? "毎分" : "분당"}</small>
          </div>
          <div>
            <strong>{formatPercent(profile.summary.recentWinRate)}</strong>
            <span>{t().winRate}</span>
            <small>{winLossText(profile.summary.recentWins, profile.summary.recentGames)}</small>
          </div>
          <div>
            <strong>{averageAiScore(profile)}</strong>
            <span>{t().aiScore}</span>
            <small>{t().recentForm}</small>
          </div>
        </div>
      </article>
      <article className="public-panel public-lp-trend-card">
        <div className="public-section-head">
          <h2 data-ko={publicI18n.ko.lpTrend} data-ja={publicI18n.ja.lpTrend}>{t().lpTrend}</h2>
          <span data-ko={publicI18n.ko.recent20Games} data-ja={publicI18n.ja.recent20Games}>{t().recent20Games}</span>
        </div>
        <div className="public-lp-chart">
          <LpTrendLineChart profile={profile} />
        </div>
      </article>
      <article className="public-panel public-role-win-card">
        <div className="public-section-head">
          <h2 data-ko={publicI18n.ko.roleWinRate} data-ja={publicI18n.ja.roleWinRate}>{t().roleWinRate}</h2>
          <span>{profile.summary.recentGames}{t().games}</span>
        </div>
        <div className="public-role-win-list">
          {roles.length === 0 ? <p className="public-empty">{t().noData}</p> : roles.map((role) => (
            <div key={role.role}>
              <span>{mainRoleLabel(role.role)}</span>
              <div><i style={{ width: barWidth(role.winRate, 100) }} /></div>
              <strong>{formatPercent(role.winRate)}</strong>
              <small>{winLossText(role.wins, role.games)}</small>
            </div>
          ))}
        </div>
      </article>
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
        <span className="public-brand-mark">L</span>
        <strong data-ko={publicI18n.ko.brand} data-ja={publicI18n.ja.brand}>{t().brand}</strong>
      </button>
      <nav aria-label="LOLTRACE">
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
          <strong data-ko={publicI18n.ko.favoritesTitle} data-ja={publicI18n.ja.favoritesTitle}>{t().favoritesTitle}</strong>
          <span>{favorites.length}</span>
        </div>
        {favorites.length === 0 ? (
          <p data-ko={publicI18n.ko.noFavorites} data-ja={publicI18n.ja.noFavorites}>{t().noFavorites}</p>
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
        <strong data-ko={publicI18n.ko.premiumTitle} data-ja={publicI18n.ja.premiumTitle}>{t().premiumTitle}</strong>
        <p data-ko={publicI18n.ko.premiumBody} data-ja={publicI18n.ja.premiumBody}>{t().premiumBody}</p>
        <button type="button" onClick={onOpenPremium} data-ko={publicI18n.ko.premiumCta} data-ja={publicI18n.ja.premiumCta}>{t().premiumCta}</button>
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
        <strong data-ko={publicI18n.ko.filterTitle} data-ja={publicI18n.ja.filterTitle}>{t().filterTitle}</strong>
        <button type="button" onClick={onReset} data-ko={publicI18n.ko.resetFilter} data-ja={publicI18n.ja.resetFilter}>{t().resetFilter}</button>
      </div>
      <label>
        <span data-ko={publicI18n.ko.queueFilter} data-ja={publicI18n.ja.queueFilter}>{t().queueFilter}</span>
        <select value={filters.queue} onChange={(event) => onChange({ ...filters, queue: event.target.value as MatchQueueFilter })}>
          <option value="all">{t().allQueues}</option>
          <option value="solo">{t().soloQueue}</option>
          <option value="flex">{t().flexQueue}</option>
          <option value="ranked5v5">{t().ranked5v5}</option>
          <option value="normal">{t().normalQueue}</option>
          <option value="aram">{t().aramQueue}</option>
        </select>
      </label>
      <label>
        <span data-ko={publicI18n.ko.championFilter} data-ja={publicI18n.ja.championFilter}>{t().championFilter}</span>
        <select value={filters.championId} onChange={(event) => onChange({ ...filters, championId: event.target.value })}>
          <option value="all">{t().allChampions}</option>
          {champions.map((champion) => (
            <option value={String(champion.championId)} key={champion.championId}>{championName(champion)}</option>
          ))}
        </select>
      </label>
      <label>
        <span data-ko={publicI18n.ko.periodFilter} data-ja={publicI18n.ja.periodFilter}>{t().periodFilter}</span>
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
  return (
    <div className={`public-match-filter-bar ${filterActive ? "active" : ""}`}>
      <div className="public-match-filter-title">
        <span aria-hidden="true">▽</span>
        <strong data-ko={publicI18n.ko.filter} data-ja={publicI18n.ja.filter}>{filterActive ? t().activeFilter : t().filter}</strong>
      </div>
      <label>
        <span data-ko={publicI18n.ko.queueFilter} data-ja={publicI18n.ja.queueFilter}>{t().queueFilter}</span>
        <select value={filters.queue} onChange={(event) => onChange({ ...filters, queue: event.target.value as MatchQueueFilter })}>
          <option value="all">{t().allQueues}</option>
          <option value="solo">{t().soloQueue}</option>
          <option value="flex">{t().flexQueue}</option>
          <option value="ranked5v5">{t().ranked5v5}</option>
          <option value="normal">{t().normalQueue}</option>
          <option value="aram">{t().aramQueue}</option>
        </select>
      </label>
      <label>
        <span data-ko={publicI18n.ko.championFilter} data-ja={publicI18n.ja.championFilter}>{t().championFilter}</span>
        <select value={filters.championId} onChange={(event) => onChange({ ...filters, championId: event.target.value })}>
          <option value="all">{t().allChampions}</option>
          {champions.map((champion) => (
            <option value={String(champion.championId)} key={champion.championId}>{championName(champion)}</option>
          ))}
        </select>
      </label>
      <label>
        <span data-ko={publicI18n.ko.periodFilter} data-ja={publicI18n.ja.periodFilter}>{t().periodFilter}</span>
        <select value={filters.period} onChange={(event) => onChange({ ...filters, period: event.target.value as MatchPeriodFilter })}>
          <option value="all">{t().periodAll}</option>
          <option value="7d">{t().period7}</option>
          <option value="30d">{t().period30}</option>
        </select>
      </label>
      <button type="button" onClick={onReset} disabled={!filterActive} data-ko={publicI18n.ko.resetFilter} data-ja={publicI18n.ja.resetFilter}>
        {t().resetFilter}
      </button>
    </div>
  );
}

function PublicNotificationPanel({
  notifications,
  onMarkAllRead
}: {
  notifications: PublicNotification[];
  onMarkAllRead: () => void;
}) {
  return (
    <div className="public-popover public-notification-popover">
      <div className="public-popover-head">
        <strong data-ko={publicI18n.ko.notifications} data-ja={publicI18n.ja.notifications}>{t().notifications}</strong>
        <button type="button" onClick={onMarkAllRead} data-ko={publicI18n.ko.markAllRead} data-ja={publicI18n.ja.markAllRead}>{t().markAllRead}</button>
      </div>
      <div className="public-notification-list">
        {notifications.length === 0 ? (
          <p data-ko={publicI18n.ko.notificationsEmpty} data-ja={publicI18n.ja.notificationsEmpty}>{t().notificationsEmpty}</p>
        ) : notifications.map((notification) => (
          <article className={notification.read ? "read" : ""} key={notification.id}>
            <strong>{notification.title}</strong>
            <p>{notification.body}</p>
            <small>{formatDate(notification.createdAt)}</small>
          </article>
        ))}
      </div>
    </div>
  );
}

function PublicLocaleSelector({
  locale,
  onLocale
}: {
  locale: PublicLocale;
  onLocale: (locale: PublicLocale) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: Array<{ locale: PublicLocale; code: string; label: string }> = [
    { locale: "ko", code: "KR", label: t().languageKo },
    { locale: "ja", code: "JP", label: t().languageJa }
  ];
  const activeCode = locale === "ja" ? "JP" : "KR";
  function selectLocale(nextLocale: PublicLocale): void {
    onLocale(nextLocale);
    setOpen(false);
  }
  return (
    <div className="public-locale-menu">
      <button
        className="public-locale-button"
        type="button"
        aria-label={t().languageMenu}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="public-globe-icon" aria-hidden="true"><span /></span>
        <strong>{activeCode}</strong>
      </button>
      {open ? (
        <div className="public-locale-popover" role="menu" aria-label={t().language}>
          {options.map((option) => (
            <button
              key={option.locale}
              type="button"
              className={option.locale === locale ? "active" : ""}
              role="menuitemradio"
              aria-checked={option.locale === locale}
              onClick={() => selectLocale(option.locale)}
            >
              <span>{option.code}</span>
              <strong>{option.label}</strong>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PublicAppHeader({
  locale,
  profile,
  twitchStatus,
  showSearch = true,
  showFilters = true,
  query,
  loading,
  suggestions,
  filters,
  champions,
  notifications,
  onQuery,
  onClear,
  onSubmit,
  onPickSuggestion,
  onLocale,
  onTwitchLogin,
  onTwitchFollowed,
  onStreamerRegister,
  onStreamerDashboard,
  onStreamerRecord,
  onTwitchLogout,
  onFilters,
  onResetFilters,
  onMarkNotificationsRead
}: {
  locale: PublicLocale;
  profile: PublicLolProfile | null;
  twitchStatus: PublicTwitchViewerStatus;
  showSearch?: boolean;
  showFilters?: boolean;
  query: string;
  loading: boolean;
  suggestions: SearchSuggestion[];
  filters: PublicMatchFilters;
  champions: LolChampionSummary[];
  notifications: PublicNotification[];
  onQuery: (value: string) => void;
  onClear: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPickSuggestion: (suggestion: SearchSuggestion) => void;
  onLocale: (locale: PublicLocale) => void;
  onTwitchLogin: () => void;
  onTwitchFollowed: () => void;
  onStreamerRegister: () => void;
  onStreamerDashboard: () => void;
  onStreamerRecord: () => void;
  onTwitchLogout: () => void;
  onFilters: (filters: PublicMatchFilters) => void;
  onResetFilters: () => void;
  onMarkNotificationsRead: () => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [twitchMenuOpen, setTwitchMenuOpen] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const filterActive = hasActiveFilters(filters);
  const twitchUser = twitchStatus.connected ? twitchStatus.user : undefined;
  const approvedStreamerRequest = twitchStatus.streamerRiotRequest?.status === "approved" ? twitchStatus.streamerRiotRequest : undefined;
  const canRegisterStreamer = twitchStatus.streamerRiotRequest?.status !== "approved" && twitchStatus.streamerRiotRequest?.status !== "pending";
  const canOpenStreamerDashboard = Boolean(approvedStreamerRequest);
  return (
    <header id={showSearch ? "public-search" : undefined} className={`public-app-header ${showSearch ? "" : "home"}`}>
      {showSearch ? (
        <SearchForm
          query={query}
          loading={loading}
          onQuery={onQuery}
          onClear={onClear}
          onSubmit={onSubmit}
          suggestions={suggestions}
          onPickSuggestion={onPickSuggestion}
        />
      ) : (
        <div className="public-header-brand">
          <span className="public-brand-mark">L</span>
          <strong data-ko={publicI18n.ko.brand} data-ja={publicI18n.ja.brand}>{t().brand}</strong>
        </div>
      )}
      <div className="public-header-tools">
        <PublicLocaleSelector locale={locale} onLocale={onLocale} />
        {showSearch && twitchUser ? (
          <div className="public-header-popover-wrap">
            <button type="button" aria-label={t().notifications} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}>
              ♧{unreadCount > 0 ? <span>{unreadCount}</span> : null}
            </button>
            {notificationsOpen ? <PublicNotificationPanel notifications={notifications} onMarkAllRead={onMarkNotificationsRead} /> : null}
          </div>
        ) : null}
        <div className="public-twitch-profile-wrap">
          <button
            className={`public-twitch-login-chip ${twitchStatus.connected ? "connected" : ""}`}
            type="button"
            onClick={() => {
              if (!twitchStatus.connected) {
                onTwitchLogin();
                return;
              }
              setTwitchMenuOpen((open) => !open);
            }}
            disabled={!twitchStatus.configured}
            aria-expanded={twitchMenuOpen}
            title={twitchStatus.connected ? twitchStatus.user?.displayName ?? t().twitchViewerLogin : t().twitchLoginRequired}
          >
            {twitchStatus.user?.profileImageUrl ? <img src={twitchStatus.user.profileImageUrl} alt="" /> : <span aria-hidden="true">T</span>}
            <strong>{twitchStatus.connected ? twitchStatus.user?.displayName ?? t().twitchViewerLogin : t().twitchViewerLogin}</strong>
          </button>
          {twitchStatus.connected && twitchMenuOpen ? (
            <div className="public-twitch-profile-menu" role="menu" aria-label={t().twitchProfileMenu}>
              <div className="public-twitch-profile-menu-head">
                {twitchStatus.user?.profileImageUrl ? <img src={twitchStatus.user.profileImageUrl} alt="" /> : <span aria-hidden="true">T</span>}
                <div>
                  <strong>{twitchStatus.user?.displayName ?? twitchStatus.user?.login}</strong>
                  <small>@{twitchStatus.user?.login}</small>
                </div>
              </div>
              {canRegisterStreamer ? (
                <button type="button" role="menuitem" onClick={() => { setTwitchMenuOpen(false); onStreamerRegister(); }}>
                  {t().streamerRiotRegister}
                </button>
              ) : null}
              {canOpenStreamerDashboard ? (
                <button className="dashboard" type="button" role="menuitem" onClick={() => { setTwitchMenuOpen(false); onStreamerDashboard(); }}>
                  {t().streamerDashboardOpen}
                </button>
              ) : null}
              {approvedStreamerRequest ? (
                <button type="button" role="menuitem" onClick={() => { setTwitchMenuOpen(false); onStreamerRecord(); }}>
                  {t().streamerRecordOpen}
                </button>
              ) : null}
              <button type="button" role="menuitem" onClick={() => { setTwitchMenuOpen(false); onTwitchFollowed(); }}>
                {t().twitchFollowedOpen}
              </button>
              <button type="button" role="menuitem" onClick={() => { setTwitchMenuOpen(false); onTwitchLogout(); }}>
                {t().twitchViewerLogout}
              </button>
            </div>
          ) : null}
        </div>
        {showFilters ? <div className="public-header-popover-wrap">
          <button className={`public-filter-button ${filterActive ? "active" : ""}`} type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}>
            <span aria-hidden="true">▽</span>
            <strong data-ko={publicI18n.ko.filter} data-ja={publicI18n.ja.filter}>{filterActive ? t().activeFilter : t().filter}</strong>
          </button>
          {filterOpen ? (
            <PublicFilterPanel filters={filters} champions={champions} onChange={onFilters} onReset={onResetFilters} />
          ) : null}
        </div> : null}
      </div>
    </header>
  );
}

function PublicRightRail({ profile }: { profile: PublicLolProfile }) {
  const champions = profile.championPerformance.length > 0
    ? profile.championPerformance.slice(0, 5)
    : profile.topChampions.slice(0, 5).map((champion, index) => ({
      champion,
      games: Math.max(1, 8 - index),
      wins: Math.max(0, 5 - index),
      winRate: Math.max(45, 56 - index * 2),
      averageKda: Math.max(1.5, 3.2 - index * .25)
    }));
  const liveRows = profile.recentMatches.slice(0, 3);
  const duoRows = champions.slice(0, 2);
  return (
    <aside className="public-right-rail">
      <section className="public-panel public-rail-card public-trend-card">
        <div className="public-section-head">
          <h2 data-ko={publicI18n.ko.trendChampions} data-ja={publicI18n.ja.trendChampions}>{t().trendChampions}</h2>
          <span data-ko={publicI18n.ko.details} data-ja={publicI18n.ja.details}>{t().details}</span>
        </div>
        <div className="public-trend-list">
          {champions.map((item, index) => (
            <article key={`${item.champion.championId}:trend`}>
              <span>{index + 1}</span>
              {item.champion.iconUrl ? <img src={item.champion.iconUrl} alt="" /> : <em>{championName(item.champion).slice(0, 1)}</em>}
              <strong>{championName(item.champion)}</strong>
              <small>{t().winRate} {formatPercent(item.winRate, 1)}</small>
              <small>{gamesText(item.games)}</small>
            </article>
          ))}
        </div>
      </section>
      <section className="public-panel public-rail-card">
        <div className="public-section-head">
          <h2 data-ko={publicI18n.ko.friendsLive} data-ja={publicI18n.ja.friendsLive}>{t().friendsLive}</h2>
          <span data-ko={publicI18n.ko.details} data-ja={publicI18n.ja.details}>{t().details}</span>
        </div>
        <div className="public-live-list">
          {liveRows.length === 0 ? <p className="public-empty">{t().noData}</p> : liveRows.map((match) => (
            <article key={`${match.matchId}:live`}>
              {match.champion.iconUrl ? <img src={match.champion.iconUrl} alt="" /> : <span>{championName(match.champion).slice(0, 1)}</span>}
              <div>
                <strong>{match.opponent?.riotId ?? championName(match.champion)}</strong>
                <small>{match.queueId ? queueLabels[activePublicLocale][match.queueId] ?? t().queue : t().queue}</small>
              </div>
              <em>{t().live}</em>
            </article>
          ))}
        </div>
      </section>
      <section className="public-panel public-rail-card">
        <div className="public-section-head">
          <h2 data-ko={publicI18n.ko.patchSummary} data-ja={publicI18n.ja.patchSummary}>{t().patchSummary}</h2>
          <span>25.10</span>
        </div>
        <ul className="public-patch-list">
          <li>{activePublicLocale === "ja" ? "精密系ルーンの序盤効率が調整されました。" : "정밀 계열 룬 초반 효율이 조정되었습니다."}</li>
          <li>{activePublicLocale === "ja" ? "一部メイジの基本防御力が上昇しました。" : "일부 메이지 기본 방어력이 증가했습니다."}</li>
          <li>{activePublicLocale === "ja" ? "ドラゴン再出現待機時間が短縮されました。" : "드래곤 재등장 대기 시간이 단축되었습니다."}</li>
        </ul>
      </section>
      <section className="public-panel public-rail-card">
        <div className="public-section-head">
          <h2 data-ko={publicI18n.ko.duoRecommendation} data-ja={publicI18n.ja.duoRecommendation}>{t().duoRecommendation}</h2>
          <span>{mainRoleLabel(profile.roleAnalysis?.mainRole)}</span>
        </div>
        <div className="public-duo-list">
          {duoRows.map((item, index) => (
            <article key={`${item.champion.championId}:duo`}>
              {item.champion.iconUrl ? <img src={item.champion.iconUrl} alt="" /> : <span>{championName(item.champion).slice(0, 1)}</span>}
              <div>
                <strong>{championName(item.champion)}</strong>
                <small>{rankLabel(profile.rankedStats)}</small>
              </div>
              <em>{Math.max(72, 92 - index * 5)}%</em>
            </article>
          ))}
        </div>
      </section>
    </aside>
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
              <strong data-ko={publicI18n.ko.streamerRiotRequestTitle} data-ja={publicI18n.ja.streamerRiotRequestTitle}>{t().streamerRiotRequestTitle}</strong>
              <small data-ko={publicI18n.ko.streamerRiotRequestBody} data-ja={publicI18n.ja.streamerRiotRequestBody}>{t().streamerRiotRequestBody}</small>
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

function PublicTwitchFollowedPanel({
  status,
  followed,
  loading,
  error,
  onLogin,
  onLogout,
  onRefresh,
  onSearch
}: {
  status: PublicTwitchViewerStatus;
  followed: PublicTwitchFollowedLolResponse | null;
  loading: boolean;
  error: string;
  onLogin: () => void;
  onLogout: () => void;
  onRefresh: () => void;
  onSearch: (riotId: string) => void;
}) {
  const linkedChannels = followed?.channels.filter((channel) => Boolean(channel.riotId)) ?? [];
  const visibleChannels = followed?.channels.slice(0, 8) ?? [];

  return (
    <section id="public-twitch-followed" className="public-panel public-twitch-followed-panel">
      <div className="public-section-head">
        <div>
          <h2 data-ko={publicI18n.ko.twitchFollowedTitle} data-ja={publicI18n.ja.twitchFollowedTitle}>{t().twitchFollowedTitle}</h2>
          <p data-ko={publicI18n.ko.twitchFollowedSubtitle} data-ja={publicI18n.ja.twitchFollowedSubtitle}>{t().twitchFollowedSubtitle}</p>
        </div>
        <div className="public-twitch-followed-actions">
          {status.connected ? (
            <>
              <button type="button" onClick={onRefresh} disabled={loading}>{loading ? t().searching : t().twitchFollowedRefresh}</button>
              <button type="button" onClick={onLogout}>{t().twitchViewerLogout}</button>
            </>
          ) : (
            <button type="button" onClick={onLogin} disabled={!status.configured}>{t().twitchViewerLogin}</button>
          )}
        </div>
      </div>

      {!status.configured ? (
        <p className="public-empty" data-ko={publicI18n.ko.twitchNotConfigured} data-ja={publicI18n.ja.twitchNotConfigured}>{t().twitchNotConfigured}</p>
      ) : !status.connected ? (
        <p className="public-empty" data-ko={publicI18n.ko.twitchLoginRequired} data-ja={publicI18n.ja.twitchLoginRequired}>{t().twitchLoginRequired}</p>
      ) : (
        <>
          <div className="public-twitch-followed-summary">
            <span>{status.user?.displayName ?? status.user?.login}</span>
            <strong>{t().twitchFollowedLinked} {linkedChannels.length}</strong>
            <small>{followed?.total !== undefined ? `${formatNumber(followed.total)} Twitch` : ""}</small>
          </div>
          {error ? <p className="public-error">{error}</p> : null}
          {visibleChannels.length === 0 && !loading ? <p className="public-empty">{t().twitchFollowedEmpty}</p> : null}
          <div className="public-twitch-followed-list">
            {visibleChannels.map((channel) => (
              <article className={channel.riotId ? "linked" : ""} key={channel.twitchUserId}>
                <div className="public-twitch-channel-main">
                  <span className="public-twitch-channel-avatar">
                    {channel.profileImageUrl ? <img src={channel.profileImageUrl} alt="" /> : channel.twitchDisplayName.slice(0, 1).toUpperCase()}
                    <i className={channel.isLive ? "live" : ""} />
                  </span>
                  <div>
                    <strong>{channel.twitchDisplayName}</strong>
                    <small>@{channel.twitchLogin} · {channel.isLive ? t().twitchLive : formatDate(channel.followedAt)}</small>
                  </div>
                </div>
                <div className="public-twitch-channel-meta">
                  {channel.riotId ? (
                    <>
                      <span>{channel.riotGameName}<small>#{channel.riotTagLine}</small></span>
                      <em>{rankLabel(channel.rankedStats)}</em>
                    </>
                  ) : (
                    <span className="muted">{t().twitchFollowedNoRiot}</span>
                  )}
                </div>
                <div className="public-twitch-channel-actions">
                  {channel.channelUrl ? <a href={channel.channelUrl} target="_blank" rel="noreferrer">{t().openTwitch}</a> : null}
                  {channel.riotId ? <button type="button" onClick={() => onSearch(channel.riotId!)}>{t().viewRecord}</button> : null}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function PublicTwitchFollowedScreen({
  status,
  followed,
  loading,
  error,
  onLogin,
  onLogout,
  onRefresh,
  onSearch,
  onBack
}: {
  status: PublicTwitchViewerStatus;
  followed: PublicTwitchFollowedLolResponse | null;
  loading: boolean;
  error: string;
  onLogin: () => void;
  onLogout: () => void;
  onRefresh: () => void;
  onSearch: (riotId: string) => void;
  onBack: () => void;
}) {
  return (
    <section className="public-followed-screen">
      <div className="public-followed-screen-card">
        <button className="public-back-button" type="button" onClick={onBack}>{t().streamerRiotRegisterBack}</button>
        <PublicTwitchFollowedPanel
          status={status}
          followed={followed}
          loading={loading}
          error={error}
          onLogin={onLogin}
          onLogout={onLogout}
          onRefresh={onRefresh}
          onSearch={onSearch}
        />
      </div>
    </section>
  );
}

function PublicSavedDataPanel({
  favorites,
  recentSearches,
  onPick
}: {
  favorites: PublicFavorite[];
  recentSearches: SearchSuggestion[];
  onPick: (suggestion: SearchSuggestion) => void;
}) {
  const unique = new Map<string, SearchSuggestion>();
  for (const suggestion of [...favorites, ...recentSearches]) {
    const key = normalizeSuggestionKey(suggestion);
    if (!unique.has(key)) unique.set(key, suggestion);
  }
  const rankingRows = [...unique.values()]
    .sort((a, b) => rankScore(b.rankedStats) - rankScore(a.rankedStats) || suggestionRiotId(a).localeCompare(suggestionRiotId(b)))
    .slice(0, 8);
  return (
    <section id="public-saved-data" className="public-panel public-saved-data-panel">
      <div className="public-section-head">
        <h2 data-ko={publicI18n.ko.savedData} data-ja={publicI18n.ja.savedData}>{t().savedData}</h2>
        <span data-ko={publicI18n.ko.cachedRanking} data-ja={publicI18n.ja.cachedRanking}>{t().cachedRanking}</span>
      </div>
      <div className="public-saved-grid">
        <article>
          <strong data-ko={publicI18n.ko.ranking} data-ja={publicI18n.ja.ranking}>{t().ranking}</strong>
          {rankingRows.length === 0 ? <p className="public-empty">{t().noData}</p> : rankingRows.map((row, index) => (
            <button type="button" onClick={() => onPick(row)} key={`ranking:${normalizeSuggestionKey(row)}`}>
              <span>{index + 1}</span>
              {row.profileIconUrl ? <img src={assetUrl(row.profileIconUrl)} alt="" /> : <em>{row.gameName.slice(0, 1).toUpperCase()}</em>}
              <strong>{row.gameName}<small>#{row.tagLine}</small></strong>
              <b>{rankLabel(row.rankedStats)}</b>
            </button>
          ))}
        </article>
        <article>
          <strong data-ko={publicI18n.ko.favoritesTitle} data-ja={publicI18n.ja.favoritesTitle}>{t().favoritesTitle}</strong>
          {favorites.length === 0 ? <p className="public-empty">{t().noFavorites}</p> : favorites.map((favorite) => (
            <button type="button" onClick={() => onPick(favorite)} key={`favorite:${normalizeSuggestionKey(favorite)}`}>
              {favorite.profileIconUrl ? <img src={assetUrl(favorite.profileIconUrl)} alt="" /> : <em>{favorite.gameName.slice(0, 1).toUpperCase()}</em>}
              <strong>{favorite.gameName}<small>#{favorite.tagLine}</small></strong>
              <b>{rankLabel(favorite.rankedStats)}</b>
            </button>
          ))}
        </article>
        <article className="notice">
          <strong data-ko={publicI18n.ko.liveGame} data-ja={publicI18n.ja.liveGame}>{t().liveGame}</strong>
          <p data-ko={publicI18n.ko.liveDataNotice} data-ja={publicI18n.ja.liveDataNotice}>{t().liveDataNotice}</p>
        </article>
      </div>
    </section>
  );
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
          <h2 id="public-premium-title" data-ko={publicI18n.ko.premiumNoticeTitle} data-ja={publicI18n.ja.premiumNoticeTitle}>{t().premiumNoticeTitle}</h2>
          <button type="button" onClick={onClose} aria-label={t().clearSearch}>×</button>
        </div>
        <p data-ko={publicI18n.ko.premiumNoticeBody} data-ja={publicI18n.ja.premiumNoticeBody}>{t().premiumNoticeBody}</p>
        <div className="public-dialog-actions">
          <button type="button" onClick={onOpenAdmin} data-ko={publicI18n.ko.openStreamerLogin} data-ja={publicI18n.ja.openStreamerLogin}>{t().openStreamerLogin}</button>
          <button type="button" onClick={onClose} data-ko={publicI18n.ko.folded} data-ja={publicI18n.ja.folded}>{t().folded}</button>
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
        <h2 data-ko={publicI18n.ko.roleDistribution} data-ja={publicI18n.ja.roleDistribution}>{t().roleDistribution}</h2>
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
        <h2 data-ko={publicI18n.ko.recentRecords} data-ja={publicI18n.ja.recentRecords}>{t().recentRecords}</h2>
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
  const visibleBadges = (badges ?? []).slice(0, compact ? 3 : 4);
  if (visibleBadges.length === 0) return null;
  return (
    <div className={`public-match-badges ${compact ? "compact" : ""}`}>
      {visibleBadges.map((badge) => (
        <span
          className={`public-match-badge ${badge.code}`}
          key={`${badge.code}:${badge.score ?? ""}:${badge.rank ?? ""}`}
          data-ko={matchBadgeLabel(badge.code, "ko")}
          data-ja={matchBadgeLabel(badge.code, "ja")}
        >
          {matchBadgeLabel(badge.code)}
        </span>
      ))}
    </div>
  );
}

function PlayerItemBuild({ items, itemKey }: { items: PublicLolMatchParticipant["items"]; itemKey: string }) {
  return (
    <div className="public-team-item-build" aria-label={t().items}>
      {items.length > 0 ? items.map((item) => (
        <span className="public-team-item-slot" key={`${itemKey}:${item.slot}:${item.itemId}`}>
          {item.iconUrl ? <img src={item.iconUrl} alt="" /> : item.itemId}
        </span>
      )) : <span className="public-team-item-empty">-</span>}
    </div>
  );
}

function RiotIdAwardBadges({ badges }: { badges?: PublicLolMatchBadge[] }) {
  const visibleBadges = matchHighlightBadges(badges);
  if (visibleBadges.length === 0) return null;
  return (
    <span className="public-riot-award-badges">
      {visibleBadges.map((badge) => (
        <span
          className={`public-riot-award-badge ${badge.code}`}
          key={`${badge.code}:${badge.score ?? ""}:${badge.rank ?? ""}`}
          data-ko={matchBadgeLabel(badge.code, "ko")}
          data-ja={matchBadgeLabel(badge.code, "ja")}
        >
          {matchBadgeLabel(badge.code)}
        </span>
      ))}
    </span>
  );
}

function SearchableRiotId({
  riotId,
  fallback,
  badges,
  onSearch
}: {
  riotId: string | undefined;
  fallback: string;
  badges?: PublicLolMatchBadge[];
  onSearch: (riotId: string) => void;
}) {
  const display = splitRiotId(riotId, fallback);
  if (!riotId) {
    return (
      <strong className="public-riot-id-static">
        <span className="public-riot-name">{display.name}</span>
        <RiotIdAwardBadges badges={badges} />
      </strong>
    );
  }
  return (
    <button className="public-riot-id-link" type="button" onClick={() => onSearch(riotId)} title={`${t().search}: ${riotId}`}>
      <span className="public-riot-name">{display.name}</span>
      {display.tag ? <span className="public-riot-tag-badge">{display.tag}</span> : null}
      <RiotIdAwardBadges badges={badges} />
    </button>
  );
}

function MatchTeamDetails({
  match,
  rankDetail,
  rankLoading,
  onSearchRiotId
}: {
  match: PublicLolRecentMatch;
  rankDetail?: PublicLolMatchRankResponse;
  rankLoading?: boolean;
  onSearchRiotId: (riotId: string) => void;
}) {
  if (match.teams.length === 0) return null;
  const maxDamage = matchTeamTotal(match, (player) => player.damageDealtToChampions);
  const maxGold = matchTeamTotal(match, (player) => player.goldEarned);
  const maxVision = matchTeamTotal(match, (player) => player.visionScore);
  const maxTaken = matchTeamTotal(match, (player) => player.damageTaken);
  return (
    <div className="public-team-detail" aria-label={t().teamDetails}>
      {match.teams.map((team) => (
        <section className={`public-team-card ${team.players.some((player) => player.isTarget) ? "ally" : "enemy"}`} key={`${match.matchId}:${team.teamId}`}>
          {(() => {
            const teamRankStats = team.players.map((player, index) => matchRankForPlayer(rankDetail, team.teamId, player, index));
            const knownTierCount = teamRankStats.filter(Boolean).length;
            const tierSummary = rankLoading
              ? t().tierLoading
              : rankDetail
                ? `${t().averageTier} ${averageTierLabel(teamRankStats)} · ${t().knownTier} ${knownTierCount}/${team.players.length}`
                : `${t().tierUnavailable} · ${t().knownTier} 0/${team.players.length}`;
            return (
              <>
          <div className="public-team-head">
            <strong>{teamLabel(team)}</strong>
            <span>{resultLabel(team.result)} · {team.kills}/{team.deaths}/{team.assists}</span>
            <small>{t().gold} {formatNumber(team.goldEarned)} · {t().damage} {formatNumber(team.damageDealtToChampions)} · {objectiveSummary(team.objectives)}</small>
            <em>{tierSummary}</em>
          </div>
	          <div className="public-team-player-list">
	            {team.players.map((player, index) => {
	              const rankedStats = teamRankStats[index];
	              const playerHighlightClass = matchHighlightClass(player.badges);
	              const playerHighlightBadges = matchHighlightBadges(player.badges);
	              return (
	                <article className={`public-team-player ${player.isTarget ? "target" : ""} ${playerHighlightClass}`} key={`${match.matchId}:${team.teamId}:${player.riotId ?? championName(player.champion)}`}>
	                  <div className="public-team-player-main">
	                    {player.champion.iconUrl ? <img src={player.champion.iconUrl} alt="" /> : <span>{championName(player.champion).slice(0, 1)}</span>}
	                    <div className="public-team-player-copy">
	                      <SearchableRiotId riotId={player.riotId} fallback={playerDisplayName(player)} badges={playerHighlightBadges} onSearch={onSearchRiotId} />
	                      <div className="public-team-player-meta">
	                        <small>{mainRoleLabel(player.position)} · {championName(player.champion)} Lv.{formatNumber(player.championLevel)}</small>
	                        <span
                            className={rankTierClass(rankedStats, rankLoading ? "loading" : rankedStats ? "ready" : "unknown")}
                            title={rankLoading ? t().tierLoading : rankedStats ? rankLabel(rankedStats) : t().tierUnavailable}
                          >
                            {matchRankBadgeLabel(rankedStats, rankLoading)}
                          </span>
	                      </div>
	                    </div>
	                  </div>
	                  <PlayerItemBuild items={player.items} itemKey={`${match.matchId}:${team.teamId}:${player.riotId ?? championName(player.champion)}`} />
	                  <div className="public-team-stat kda">
	                    <strong>{player.kills}/{player.deaths}/{player.assists}</strong>
	                    <span>{formatDecimal(player.kda)} KDA</span>
	                  </div>
                <div className="public-team-stat" style={{ background: heatBackground(player.goldEarned, maxGold, "green") }}>
                  <strong>{formatNumber(player.goldEarned)}</strong>
                  <span>{t().gold} · {formatPercent(player.goldShare, 1)}</span>
                </div>
                <div className="public-team-stat" style={{ background: heatBackground(player.damageDealtToChampions, maxDamage) }}>
                  <strong>{formatNumber(player.damageDealtToChampions)}</strong>
                  <span>{t().damage} · {formatPercent(player.damageShare, 1)}</span>
                </div>
                <div className="public-team-stat" style={{ background: heatBackground(player.damageTaken, maxTaken, "red") }}>
                  <strong>{formatNumber(player.damageTaken)}</strong>
                  <span>{t().damageTaken} · {formatPercent(player.damageTakenShare, 1)}</span>
                </div>
                <div className="public-team-stat" style={{ background: heatBackground(player.visionScore, maxVision) }}>
                  <strong>{formatNumber(player.visionScore)}</strong>
                  <span>{t().vision} · {activePublicLocale === "ja" ? `${formatDecimal(player.visionScorePerMinute, 2)}/分` : `${formatDecimal(player.visionScorePerMinute, 2)}/분`}</span>
                </div>
              </article>
            );})}
          </div>
              </>
            );
          })()}
        </section>
      ))}
    </div>
	  );
	}

function currentGameTeamLabel(teamId: number): string {
  if (teamId === 100) return t().blueTeam;
  if (teamId === 200) return t().redTeam;
  return `${t().teamDetails} ${teamId}`;
}

function IngamePanel({ profile, onSearchRiotId }: { profile: PublicLolProfile; onSearchRiotId: (riotId: string) => void }) {
  const liveGame = profile.liveGame;
  const teamIds = [...new Set((liveGame?.participants ?? []).map((participant) => participant.teamId))].sort((a, b) => a - b);
  return (
    <section id="public-ingame" className={`public-panel public-ingame-panel ${liveGame?.isLive ? "live" : "offline"}`}>
      <div className="public-section-head">
        <h2 data-ko={publicI18n.ko.currentGameStatus} data-ja={publicI18n.ja.currentGameStatus}>{t().currentGameStatus}</h2>
        <span>{liveGame?.isLive ? t().currentlyInGame : t().notInGame}</span>
      </div>
      {!liveGame?.isLive ? (
        <div className="public-ingame-empty">
          <strong data-ko={publicI18n.ko.notInGame} data-ja={publicI18n.ja.notInGame}>{t().notInGame}</strong>
          <small>{t().fetchedAt} {formatDate(liveGame?.fetchedAt)}</small>
        </div>
      ) : (
        <>
          <div className="public-ingame-summary">
            <div>
              <span>{t().queue}</span>
              <strong>{liveGame.queueId ? queueLabels[activePublicLocale][liveGame.queueId] ?? `${t().queue} ${liveGame.queueId}` : liveGame.gameMode ?? "-"}</strong>
            </div>
            <div>
              <span>{t().currentGameParticipants}</span>
              <strong>{liveGame.participants.length}</strong>
            </div>
            <div>
              <span>{t().fetchedAt}</span>
              <strong>{formatDate(liveGame.fetchedAt)}</strong>
            </div>
            <div>
              <span>{t().perMinute}</span>
              <strong>{formatDuration(liveGame.gameLengthSeconds)}</strong>
            </div>
          </div>
          <div className="public-ingame-teams">
            {teamIds.map((teamId) => (
              <article key={`current-game:${teamId}`}>
                <div className="public-ingame-team-head">
                  <strong>{currentGameTeamLabel(teamId)}</strong>
                  <span>{liveGame.participants.filter((participant) => participant.teamId === teamId).length}</span>
                </div>
                <div className="public-ingame-player-list">
                  {liveGame.participants.filter((participant) => participant.teamId === teamId).map((participant, index) => (
                    <div className={participant.isTarget ? "target" : ""} key={`${teamId}:${participant.riotId ?? participant.champion.championId}:${index}`}>
                      {participant.champion.iconUrl ? <img src={participant.champion.iconUrl} alt="" /> : <span>{championName(participant.champion).slice(0, 1)}</span>}
                      <div>
                        <SearchableRiotId riotId={participant.riotId} fallback={participant.isTarget ? profile.riotId : championName(participant.champion)} onSearch={onSearchRiotId} />
                        <small>{championName(participant.champion)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
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
  const [matchRanks, setMatchRanks] = useState<Record<string, PublicLolMatchRankResponse>>({});
  const [matchRankLoading, setMatchRankLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedMatchId(null);
    setMatchRanks({});
    setMatchRankLoading({});
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

  return (
    <section className="public-panel public-matches-panel">
      <div className="public-section-head">
        <h2 data-ko={publicI18n.ko.recentGames} data-ja={publicI18n.ja.recentGames}>{t().recentGames}</h2>
        <span>{profile.summary.recentGames}{t().games}</span>
      </div>
      <PublicMatchFilterBar filters={filters} champions={champions} onChange={onFilters} onReset={onResetFilters} />
      <div className="public-match-list">
        {profile.recentMatches.length === 0 ? <p className="public-empty">{t().noData}</p> : profile.recentMatches.map((match) => {
          const expanded = expandedMatchId === match.matchId;
          const highlightClass = matchHighlightClass(match.badges);
          const rankDetail = matchRanks[match.matchId];
          const rankLoading = Boolean(matchRankLoading[match.matchId]);
          const opponentRank = matchRankForOpponent(rankDetail, match.opponent);
          return (
            <article className={`public-match-row ${match.result} ${highlightClass} ${expanded ? "expanded" : ""}`} key={match.matchId}>
              <div className="public-match-summary">
                <div className="public-result">
                  <strong>{match.queueId ? queueLabels[activePublicLocale][match.queueId] ?? `${t().queue} ${match.queueId}` : "-"}</strong>
                  <span>{formatDate(match.startedAt)}</span>
                  <small>{resultLabel(match.result)} · {formatDuration(match.durationSeconds)}</small>
                </div>
                <div className={`public-champion-cell ${highlightClass}`}>
                  {match.champion.iconUrl ? <img src={match.champion.iconUrl} alt="" /> : <span>{championName(match.champion).slice(0, 1)}</span>}
                  <div>
                    <strong>{championName(match.champion)}</strong>
                    <small>{mainRoleLabel(match.position)} · Lv.{formatNumber(match.championLevel)}</small>
                  </div>
                </div>
                <div className="public-kda">
                  <strong>{match.kills} / {match.deaths} / {match.assists}</strong>
                  <span>{formatDecimal(match.kda)} KDA</span>
                  <MatchBadges badges={match.badges} compact />
                </div>
                <div className="public-match-score">
                  <span data-ko={publicI18n.ko.aiScore} data-ja={publicI18n.ja.aiScore}>{t().aiScore}</span>
                  <strong>{matchAiScore(match)}</strong>
                </div>
                <div className="public-match-meta">
                  <span>CS {formatNumber(match.cs)}</span>
                  <span>{perMinuteText("CS", match.csPerMinute, 1)}</span>
                  <span>{killParticipationText(match.killParticipation)}</span>
                </div>
                <div className="public-match-inline-items" aria-label={t().items}>
                  {match.items.slice(0, 6).map((item) => (
                    <span key={`${match.matchId}:inline:${item.slot}:${item.itemId}`}>
                      {item.iconUrl ? <img src={item.iconUrl} alt="" /> : item.itemId}
                    </span>
                  ))}
                </div>
                <div className={`public-match-impact ${match.result}`}>
                  <strong>{matchAiScore(match)}</strong>
                  <span>{t().aiScore}</span>
                </div>
                <button
                  type="button"
                  className="public-match-expand"
                  aria-expanded={expanded}
                  aria-label={expanded ? t().collapseMatch : t().expandMatch}
                  onClick={() => {
                    const opening = expandedMatchId !== match.matchId;
                    setExpandedMatchId(opening ? match.matchId : null);
                    if (opening) void ensureMatchRanks(match.matchId);
                  }}
                >
                  <span aria-hidden="true" />
                </button>
              </div>

              {expanded ? (
                <div className="public-match-expanded">
                  <div className="public-match-detail">
                    <div className="public-match-loadout">
                      <div className="public-item-list" aria-label={t().items}>
                        {match.items.length > 0 ? match.items.map((item) => (
                          <span className="public-item-slot" key={`${match.matchId}:${item.slot}:${item.itemId}`}>
                            {item.iconUrl ? <img src={item.iconUrl} alt="" /> : item.itemId}
                          </span>
                        )) : <span className="public-item-empty">-</span>}
                      </div>
                      <MatchBadges badges={match.badges} />
                    </div>
                    <div className="public-detail-grid">
                      <span>{t().damage} {formatNumber(match.damageDealtToChampions)} · {perMinuteText(t().damage, match.damagePerMinute)}</span>
                      <span>{t().damageShare} {formatPercent(match.damageShare, 1)}</span>
                      <span>{t().gold} {formatNumber(match.goldEarned)} · {perMinuteText(t().gold, match.goldPerMinute)}</span>
                      <span>{t().vision} {formatNumber(match.visionScore)} · {t().wards} {formatNumber(match.wardsPlaced)} / {formatNumber(match.wardsKilled)}</span>
                      <span>{t().objectives} {objectiveSummary(match.team?.objectives)}</span>
                      <span>{t().deathTime} {formatDuration(match.totalTimeSpentDead)}</span>
                    </div>
	                    {match.opponent ? (
	                      <div className="public-opponent-cell">
	                        <span data-ko={publicI18n.ko.opponent} data-ja={publicI18n.ja.opponent}>{t().opponent}</span>
	                        {match.opponent.champion.iconUrl ? <img src={match.opponent.champion.iconUrl} alt="" /> : null}
	                        <div>
                            <SearchableRiotId riotId={match.opponent.riotId} fallback={championName(match.opponent.champion)} onSearch={onSearchRiotId} />
	                          <small>{championName(match.opponent.champion)} · {match.opponent.kills}/{match.opponent.deaths}/{match.opponent.assists} · {formatDecimal(match.opponent.kda)} KDA</small>
                            <span
                              className={rankTierClass(opponentRank, rankLoading ? "loading" : opponentRank ? "ready" : "unknown")}
                              title={rankLoading ? t().tierLoading : opponentRank ? rankLabel(opponentRank) : t().tierUnavailable}
                            >
                              {matchRankBadgeLabel(opponentRank, rankLoading)}
                            </span>
                          </div>
	                      </div>
	                    ) : null}
	                  </div>
	                  <MatchTeamDetails match={match} rankDetail={rankDetail} rankLoading={rankLoading} onSearchRiotId={onSearchRiotId} />
	                </div>
              ) : null}
            </article>
	          );
	        })}
	      </div>
      {moreError ? <p className="public-match-more-error">{moreError}</p> : null}
      {profile.hasMoreRecentMatches && onLoadMore ? (
        <div className="public-match-more">
          <button type="button" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? t().loadingMoreMatches : t().loadMoreMatches}
          </button>
        </div>
      ) : profile.recentMatches.length >= 20 ? (
        <p className="public-match-more-done" data-ko={publicI18n.ko.noMoreMatches} data-ja={publicI18n.ja.noMoreMatches}>{t().noMoreMatches}</p>
      ) : null}
	    </section>
	  );
	}

function ChampionMastery({ profile }: { profile: PublicLolProfile }) {
  return (
    <section id="public-champions" className="public-panel">
      <div className="public-section-head">
        <h2 data-ko={publicI18n.ko.topChampions} data-ja={publicI18n.ja.topChampions}>{t().topChampions}</h2>
      </div>
      <div className="public-champion-list">
        {profile.topChampions.length === 0 ? <p className="public-empty">{t().noData}</p> : profile.topChampions.map((champion) => (
          <article className="public-champion-row" key={champion.championId}>
            {champion.iconUrl ? <img src={champion.iconUrl} alt="" /> : <span>{championName(champion).slice(0, 1)}</span>}
            <div>
              <strong>{championName(champion)}</strong>
              <small>{t().mastery} Lv.{formatNumber(champion.masteryLevel)} · {formatNumber(champion.masteryPoints)} {t().masteryPoint}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DetailedPerformance({ profile }: { profile: PublicLolProfile }) {
  return (
    <section className="public-panel public-detail-analysis-panel">
      <div className="public-section-head">
        <h2 data-ko={publicI18n.ko.detailAnalysis} data-ja={publicI18n.ja.detailAnalysis}>{t().detailAnalysis}</h2>
        <span>{profile.summary.recentGames}{t().games}</span>
      </div>
      <div className="public-performance-block">
        <h3 data-ko={publicI18n.ko.championPerformance} data-ja={publicI18n.ja.championPerformance}>{t().championPerformance}</h3>
        <div className="public-performance-list">
          {profile.championPerformance.length === 0 ? <p className="public-empty">{t().noData}</p> : profile.championPerformance.map((item) => (
            <article className="public-performance-row" key={item.champion.championId}>
              {item.champion.iconUrl ? <img src={item.champion.iconUrl} alt="" /> : <span>{championName(item.champion).slice(0, 1)}</span>}
              <div>
                <strong>{championName(item.champion)}</strong>
                <small>{gamesText(item.games)} · {winsText(item.wins)} · {formatPercent(item.winRate)}</small>
              </div>
              <div>
                <strong>{formatDecimal(item.averageKda)} KDA</strong>
                <small>CS {formatDecimal(item.averageCsPerMinute, 1)} · DPM {formatNumber(item.averageDamagePerMinute)}</small>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="public-performance-block">
        <h3 data-ko={publicI18n.ko.rolePerformance} data-ja={publicI18n.ja.rolePerformance}>{t().rolePerformance}</h3>
        <div className="public-role-chip-list">
          {profile.rolePerformance.length === 0 ? <p className="public-empty">{t().noData}</p> : profile.rolePerformance.map((item) => (
            <article className="public-role-chip" key={item.role}>
              <span>{mainRoleLabel(item.role)}</span>
              <strong>{gamesText(item.games)}</strong>
              <small>{formatPercent(item.winRate)} · {formatDecimal(item.averageKda)} KDA</small>
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
        <h2 data-ko={publicI18n.ko.analysis} data-ja={publicI18n.ja.analysis}>{t().analysis}</h2>
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
  onNavigate
}: {
  locale: PublicLocale;
  onHome: () => void;
  onOpenAdmin: () => void;
  onLocale: (locale: PublicLocale) => void;
  onNavigate: (target: PublicNavTarget) => void;
}) {
  return (
    <header className="public-topbar">
      <button className="public-brand" type="button" onClick={onHome}>
        <span className="public-brand-mark">L</span>
        <strong data-ko={publicI18n.ko.brand} data-ja={publicI18n.ja.brand}>{t().brand}</strong>
      </button>
      <nav aria-label="LOLTRACE">
        <button type="button" onClick={() => onNavigate("search")} data-ko={publicI18n.ko.searchNav} data-ja={publicI18n.ja.searchNav}>{t().searchNav}</button>
        <button type="button" onClick={() => onNavigate("ranking")} data-ko={publicI18n.ko.ranking} data-ja={publicI18n.ja.ranking}>{t().ranking}</button>
        <button type="button" onClick={() => onNavigate("champion")} data-ko={publicI18n.ko.championAnalysis} data-ja={publicI18n.ja.championAnalysis}>{t().championAnalysis}</button>
        <button type="button" onClick={() => onNavigate("stats")} data-ko={publicI18n.ko.stats} data-ja={publicI18n.ja.stats}>{t().stats}</button>
        <button type="button" onClick={() => onNavigate("promotion")} data-ko={publicI18n.ko.promotion} data-ja={publicI18n.ja.promotion}>{t().promotion}</button>
        <button type="button" onClick={() => onNavigate("community")} data-ko={publicI18n.ko.community} data-ja={publicI18n.ja.community}>{t().community}</button>
      </nav>
      <div className="public-top-actions">
        <PublicLocaleSelector locale={locale} onLocale={onLocale} />
        <button className="public-theme-button" type="button" aria-label={t().darkMode}>●</button>
        <button className="public-login-button" type="button" onClick={onOpenAdmin} data-ko={publicI18n.ko.login} data-ja={publicI18n.ja.login}>{t().login}</button>
      </div>
    </header>
  );
}

function PublicMobileNav({ onNavigate }: { onNavigate: (target: PublicNavTarget) => void }) {
  return (
    <nav className="public-mobile-nav" aria-label="LOLTRACE mobile">
      <button type="button" onClick={() => onNavigate("search")}>
        <span aria-hidden="true">⌂</span>
        <strong data-ko={publicI18n.ko.searchNav} data-ja={publicI18n.ja.searchNav}>{t().searchNav}</strong>
      </button>
      <button type="button" onClick={() => onNavigate("ranking")}>
        <span aria-hidden="true">◴</span>
        <strong data-ko={publicI18n.ko.ranking} data-ja={publicI18n.ja.ranking}>{t().ranking}</strong>
      </button>
      <button type="button" onClick={() => onNavigate("champion")}>
        <span aria-hidden="true">♛</span>
        <strong data-ko={publicI18n.ko.championAnalysis} data-ja={publicI18n.ja.championAnalysis}>{t().championAnalysis}</strong>
      </button>
      <button type="button" onClick={() => onNavigate("ingame")}>
        <span aria-hidden="true">▣</span>
        <strong data-ko={publicI18n.ko.ingame} data-ja={publicI18n.ja.ingame}>{t().ingame}</strong>
      </button>
      <button type="button" onClick={() => onNavigate("community")}>
        <span aria-hidden="true">⋯</span>
        <strong data-ko={publicI18n.ko.moreMenu} data-ja={publicI18n.ja.moreMenu}>{t().moreMenu}</strong>
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
  const [locale, setLocaleState] = useState<PublicLocale>(() => detectPublicLocale());
  activePublicLocale = locale;
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<PublicLolProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMoreMatches, setLoadingMoreMatches] = useState(false);
  const [moreMatchesError, setMoreMatchesError] = useState("");
  const [error, setError] = useState("");
  const [recentSearches, setRecentSearches] = useState<SearchSuggestion[]>(() => readRecentSearches());
  const [favorites, setFavorites] = useState<PublicFavorite[]>(() => readFavorites());
  const [theme, setTheme] = useState<PublicTheme>(() => readStoredTheme());
  const [notifications, setNotifications] = useState<PublicNotification[]>(() => readNotifications());
  const [filters, setFilters] = useState<PublicMatchFilters>(DEFAULT_MATCH_FILTERS);
  const [remoteSuggestions, setRemoteSuggestions] = useState<SearchSuggestion[]>([]);
  const [profileTab, setProfileTab] = useState<PublicProfileTab>("overview");
  const [activeNav, setActiveNav] = useState<PublicNavTarget>("search");
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [streamerRegisterOpen, setStreamerRegisterOpen] = useState(false);
  const [followedScreenOpen, setFollowedScreenOpen] = useState(false);
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
  const visibleProfile = useMemo(() => {
    if (!profile) return null;
    return profileWithMatches(profile, filteredMatches(profile, filters));
  }, [profile, filters]);
  const refreshRemaining = refreshRemainingMs(profile, nowTick);
  const availableChampions = useMemo(() => {
    const unique = new Map<number, LolChampionSummary>();
    for (const match of profile?.recentMatches ?? []) {
      if (!unique.has(match.champion.championId)) unique.set(match.champion.championId, match.champion);
    }
    return [...unique.values()].sort((a, b) => championName(a).localeCompare(championName(b)));
  }, [profile]);

  function changeLocale(nextLocale: PublicLocale): void {
    setLocaleState(nextLocale);
    saveStoredLocale(nextLocale);
  }

  useEffect(() => {
    document.documentElement.lang = locale === "ja" ? "ja" : "ko";
  }, [locale]);

  useEffect(() => {
    if (readStoredLocale()) return undefined;
    const controller = new AbortController();
    void loadPublicLocalePreference(controller.signal)
      .then((preferredLocale) => {
        if (!preferredLocale || readStoredLocale()) return;
        setLocaleState(preferredLocale);
      })
      .catch(() => {
        // 지역 기반 언어 추정 실패 시 브라우저 언어 기본값을 유지합니다.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    void loadTwitchViewer();
  }, []);

  useEffect(() => {
    if (refreshRemainingMs(profile, Date.now()) <= 0) return undefined;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [profile?.refreshAvailableAt]);

  useEffect(() => {
    const loadFromPath = (replaceUrl = true) => {
      const riotId = riotIdFromPublicSummonerPath();
      if (!riotId) return;
      setQuery(riotId);
      void runSearch(riotId, { replaceUrl, notify: false });
    };
    loadFromPath(true);
    const handlePopState = () => {
      const riotId = riotIdFromPublicSummonerPath();
      if (riotId) {
        setQuery(riotId);
        void runSearch(riotId, { updateUrl: false, notify: false });
        return;
      }
      setProfile(null);
      setError("");
      setFilters(DEFAULT_MATCH_FILTERS);
      setStreamerRegisterOpen(false);
      setFollowedScreenOpen(false);
      setActiveNav("search");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.publicTheme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // 테마 저장 실패는 화면 사용을 막지 않습니다.
    }
  }, [theme]);

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

  function pushNotification(title: string, body: string): void {
    setNotifications((current) => {
      const next = [
        {
          id: cryptoRandomId(),
          title,
          body,
          createdAt: new Date().toISOString(),
          read: false
        },
        ...current
      ].slice(0, MAX_NOTIFICATIONS);
      writeNotifications(next);
      return next;
    });
  }

  function markNotificationsRead(): void {
    setNotifications((current) => {
      const next = current.map((notification) => ({ ...notification, read: true }));
      writeNotifications(next);
      return next;
    });
  }

  async function loadTwitchViewer(): Promise<void> {
    setFollowedError("");
    try {
      const status = await getPublicTwitchStatus();
      setTwitchStatus(status);
      if (status.connected) {
        await loadFollowedLol();
      } else {
        setFollowedLol(null);
      }
    } catch (requestError) {
      setFollowedError(requestError instanceof Error ? requestError.message : t().searchFailed);
    }
  }

  async function loadFollowedLol(): Promise<void> {
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
  }

  function startTwitchLogin(): void {
    window.location.href = `${apiBase}/api/public/twitch/auth/start`;
  }

  function openTwitchViewerPanel(): void {
    setStreamerRegisterOpen(false);
    setFollowedScreenOpen(false);
    if (!twitchStatus.connected) {
      if (twitchStatus.configured) startTwitchLogin();
      return;
    }
    setFollowedScreenOpen(true);
    setActiveNav("community");
    window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  function openStreamerRegisterScreen(): void {
    setFollowedScreenOpen(false);
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
    setFollowedScreenOpen(false);
    setQuery(riotId);
    void runSearch(riotId);
  }

  async function disconnectTwitchViewer(): Promise<void> {
    await logoutPublicTwitch();
    setTwitchStatus({ connected: false, configured: true, requiredScopes: ["user:read:follows"], missingScopes: ["user:read:follows"] });
    setFollowedLol(null);
    setStreamerRegisterOpen(false);
    setFollowedScreenOpen(false);
  }

  function toggleTheme(): void {
    setTheme((current) => current === "dark" ? "light" : "dark");
  }

  function toggleFavorite(): void {
    if (!profile) return;
    const favorite = favoriteFromProfile(profile);
    const active = isFavoriteProfile(favorites, profile);
    const next = active
      ? favorites.filter((item) => normalizeSuggestionKey(item) !== normalizeSuggestionKey(favorite))
      : [favorite, ...favorites.filter((item) => normalizeSuggestionKey(item) !== normalizeSuggestionKey(favorite))].slice(0, MAX_FAVORITES);
    writeFavorites(next);
    setFavorites(next);
    pushNotification(t().favoritesTitle, active ? t().favoriteRemoved : t().favoriteAdded);
  }

	  async function runSearch(
	    value: string,
	    options: { updateUrl?: boolean; replaceUrl?: boolean; notify?: boolean; refresh?: boolean } = {}
	  ): Promise<void> {
    const riotId = jpRiotIdQuery(value);
    if (!riotId) return;
    const updateUrl = options.updateUrl !== false;
    const notify = options.notify !== false;
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
      setFollowedScreenOpen(false);
      setActiveNav("search");
      setQuery(result.riotId);
      if (updateUrl) setPublicPath(publicSummonerPath(result.riotId), options.replaceUrl);
      saveRecentSearch(result);
      setRecentSearches(readRecentSearches());
      if (notify) pushNotification(t().search, `${result.riotId} ${t().fetchedAt} ${formatDate(result.fetchedAt)}`);
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
    await runSearch(query);
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
    setFollowedScreenOpen(false);
    setActiveNav("search");
    setPublicPath("/");
  }

  function navigatePublic(target: PublicNavTarget): void {
    setStreamerRegisterOpen(false);
    setFollowedScreenOpen(false);
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

  if (streamerRegisterOpen) {
    return (
      <main className={`public-lol-shell public-dashboard-shell public-home-shell theme-${theme}`}>
        <section className="public-app-main">
          <PublicAppHeader
            locale={locale}
            profile={profile}
            twitchStatus={twitchStatus}
            showSearch={false}
            showFilters={false}
            query={query}
            loading={loading}
            suggestions={visibleSuggestions}
            filters={filters}
            champions={availableChampions}
            notifications={notifications}
            onQuery={setQuery}
            onClear={clearSearch}
            onSubmit={(event) => void submit(event)}
            onPickSuggestion={pickSuggestion}
            onLocale={changeLocale}
            onTwitchLogin={openTwitchViewerPanel}
            onTwitchFollowed={openTwitchViewerPanel}
            onStreamerRegister={openStreamerRegisterScreen}
            onStreamerDashboard={onOpenStreamerDashboard}
            onStreamerRecord={openStreamerRecord}
            onTwitchLogout={() => void disconnectTwitchViewer()}
            onFilters={setFilters}
            onResetFilters={() => setFilters(DEFAULT_MATCH_FILTERS)}
            onMarkNotificationsRead={markNotificationsRead}
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
        <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
      </main>
    );
  }

  if (followedScreenOpen) {
    return (
      <main className={`public-lol-shell public-dashboard-shell public-home-shell theme-${theme}`}>
        <section className="public-app-main">
          <PublicAppHeader
            locale={locale}
            profile={profile}
            twitchStatus={twitchStatus}
            showSearch={false}
            showFilters={false}
            query={query}
            loading={loading}
            suggestions={visibleSuggestions}
            filters={filters}
            champions={availableChampions}
            notifications={notifications}
            onQuery={setQuery}
            onClear={clearSearch}
            onSubmit={(event) => void submit(event)}
            onPickSuggestion={pickSuggestion}
            onLocale={changeLocale}
            onTwitchLogin={openTwitchViewerPanel}
            onTwitchFollowed={openTwitchViewerPanel}
            onStreamerRegister={openStreamerRegisterScreen}
            onStreamerDashboard={onOpenStreamerDashboard}
            onStreamerRecord={openStreamerRecord}
            onTwitchLogout={() => void disconnectTwitchViewer()}
            onFilters={setFilters}
            onResetFilters={() => setFilters(DEFAULT_MATCH_FILTERS)}
            onMarkNotificationsRead={markNotificationsRead}
          />
          <PublicTwitchFollowedScreen
            status={twitchStatus}
            followed={followedLol}
            loading={followedLoading}
            error={followedError}
            onLogin={startTwitchLogin}
            onLogout={() => void disconnectTwitchViewer()}
            onRefresh={() => void loadFollowedLol()}
            onSearch={(riotId) => void runSearch(riotId)}
            onBack={() => setFollowedScreenOpen(false)}
          />
        </section>
        <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className={`public-lol-shell public-dashboard-shell public-home-shell theme-${theme}`}>
        <section className="public-app-main">
          <PublicAppHeader
            locale={locale}
            profile={profile}
            twitchStatus={twitchStatus}
            showSearch={false}
            showFilters={false}
            query={query}
            loading={loading}
            suggestions={visibleSuggestions}
            filters={filters}
            champions={availableChampions}
            notifications={notifications}
            onQuery={setQuery}
            onClear={clearSearch}
            onSubmit={(event) => void submit(event)}
            onPickSuggestion={pickSuggestion}
            onLocale={changeLocale}
            onTwitchLogin={openTwitchViewerPanel}
            onTwitchFollowed={openTwitchViewerPanel}
            onStreamerRegister={openStreamerRegisterScreen}
            onStreamerDashboard={onOpenStreamerDashboard}
            onStreamerRecord={openStreamerRecord}
            onTwitchLogout={() => void disconnectTwitchViewer()}
            onFilters={setFilters}
            onResetFilters={() => setFilters(DEFAULT_MATCH_FILTERS)}
            onMarkNotificationsRead={markNotificationsRead}
          />
          <section id="public-search" className="public-home-content public-dashboard-home">
            <div className="public-home-search-stage">
              <SearchForm
                query={query}
                loading={loading}
                onQuery={setQuery}
                onClear={clearSearch}
                onSubmit={(event) => void submit(event)}
                suggestions={visibleSuggestions}
                onPickSuggestion={pickSuggestion}
              />
            </div>
            {error ? <p className="public-error">{error}</p> : null}
          </section>
        </section>
        <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
      </main>
    );
  }

  const activeProfile = visibleProfile ?? profile;
  const favoriteActive = isFavoriteProfile(favorites, profile);

  return (
    <main className={`public-lol-shell public-dashboard-shell theme-${theme}`}>
      <section className="public-app-main">
        <PublicAppHeader
          locale={locale}
          profile={profile}
          twitchStatus={twitchStatus}
          showFilters={false}
          query={query}
          loading={loading}
          suggestions={visibleSuggestions}
          filters={filters}
          champions={availableChampions}
          notifications={notifications}
          onQuery={setQuery}
          onClear={clearSearch}
          onSubmit={(event) => void submit(event)}
          onPickSuggestion={pickSuggestion}
          onLocale={changeLocale}
          onTwitchLogin={openTwitchViewerPanel}
          onTwitchFollowed={openTwitchViewerPanel}
          onStreamerRegister={openStreamerRegisterScreen}
          onStreamerDashboard={onOpenStreamerDashboard}
          onStreamerRecord={openStreamerRecord}
          onTwitchLogout={() => void disconnectTwitchViewer()}
          onFilters={setFilters}
          onResetFilters={() => setFilters(DEFAULT_MATCH_FILTERS)}
          onMarkNotificationsRead={markNotificationsRead}
        />

        <div className="public-profile-layout">
          <div className="public-dashboard-content-grid">
            <section className="public-dashboard-center">
              <ProfileTopPanel
                profile={activeProfile}
                loading={loading}
                favoriteActive={favoriteActive}
                refreshRemaining={refreshRemaining}
                onRefresh={() => void runSearch(profile.riotId, { refresh: true })}
                onToggleFavorite={toggleFavorite}
              />
              {error ? <p className="public-error">{error}</p> : null}
              <PublicProfileTabs activeTab={profileTab} onChange={setProfileTab} />

	              {profileTab === "overview" ? (
	                <>
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
	                </>
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

              <PublicSavedDataPanel favorites={favorites} recentSearches={recentSearches} onPick={pickSuggestion} />
              <PublicMoreFeatures />
            </section>
            <PublicRightRail profile={activeProfile} />
          </div>
        </div>
      </section>
      <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
    </main>
  );
}
