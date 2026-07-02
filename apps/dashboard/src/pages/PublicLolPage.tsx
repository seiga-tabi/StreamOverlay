import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { CommunityPost, LolChampionSummary, LolPerformanceStats, LolRankHistoryPoint, LolRankedStats, LolRoleAnalysis, StreamerRiotIdRequest, StreamerTournament } from "@streamops/shared";
import { apiBase } from "../api/client";
import { ProfileLinkIcon, profileLinkPlatformFromUrl, profileLinkPlatformClass } from "../components/ProfileLinkIcon";

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
  runes: Array<{ runeId: number; nameKo?: string; nameJa?: string; iconUrl?: string; kind: "primary" | "secondary"; category?: "style" | "keystone" | "perk" }>;
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
  runes: PublicLolMatchParticipant["runes"];
  summonerSpells: number[];
  badges: PublicLolMatchBadge[];
};

type PublicLolMatchBuildResponse = {
  status: "ready";
  matchId: string;
  participants: PublicLolMatchBuildParticipant[];
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

type PublicChampionAnalysisRow = {
  champion: LolChampionSummary;
  masteryRank?: number;
  masteryLevel?: number;
  masteryPoints?: number;
  performance?: PublicLolChampionPerformance;
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
  yLabels: string[];
  startLabel: string;
  middleLabel: string;
  endLabel: string;
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

type TournamentPlayerProfileState = {
  status: "loading" | "ready" | "error";
  profile?: PublicLolProfile;
  error?: string;
};

const TOURNAMENT_PLAYER_PROFILE_LIMIT = 30;
const TOURNAMENT_PLAYER_PROFILE_CONCURRENCY = 3;
const tournamentPlayerProfileCache = new Map<string, TournamentPlayerProfileState>();

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
type PublicMainPage = "search" | "favorites" | "subscriptions" | "patch" | "tournamentCalendar" | "tournamentList" | "tournamentNews" | "tournamentTeams" | "tournamentBracket" | "tournamentSchedule";
type PublicProfileTab = "overview" | "champions" | "ingame";
type PublicExpandedMatchView = "record" | "build";
type PublicTheme = "light" | "dark";
type MatchQueueFilter = "all" | "solo" | "flex" | "ranked5v5" | "normal" | "aram";
type MatchPeriodFilter = "all" | "7d" | "30d";
type PublicMatchFilters = {
  queue: MatchQueueFilter;
  championId: string;
  period: MatchPeriodFilter;
};
type PublicFavorite = SearchSuggestion;

const RECENT_SEARCH_STORAGE_KEY = "loltrace.recent.jp";
const FAVORITE_STORAGE_KEY = "loltrace.favorites.jp";
const THEME_STORAGE_KEY = "loltrace.theme";
const LOCALE_STORAGE_KEY = "loltrace.locale";
const MAX_RECENT_SEARCHES = 8;
const MAX_FAVORITES = 24;
const MAX_SEARCH_SUGGESTIONS = 6;
const RECENT_ANALYSIS_MATCH_LIMIT = 20;
const LP_TREND_WINDOW_DAYS = 30;
const LP_TREND_WINDOW_MS = LP_TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const PUBLIC_SUMMONER_ROUTE_PREFIX = "/lol/summoners/jp/";
const PUBLIC_TOURNAMENT_ROUTE_PREFIX = "/lol/tournaments/";
const PUBLIC_TOURNAMENT_LIST_PATH = "/lol/tournaments";
const PUBLIC_TOURNAMENT_CALENDAR_PATH = "/lol/tournaments/calendar";
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
const publicI18n = {
  ko: {
    brand: "Seiga.GG",
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
    mobileMenu: "메뉴",
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
    premiumTitle: "Seiga.GG Premium",
    premiumBody: "광고 제거, 상세 통계, 프로 리플레이 등 프리미엄 기능을 경험해보세요.",
    premiumCta: "프리미엄 업그레이드",
    version: "버전",
    profileSummary: "플레이어 요약",
    recentGames: "최근 게임",
    recent20Games: "최근 20게임",
    justNow: "방금 전",
    minutesAgo: "분 전",
    hoursAgo: "시간 전",
    daysAgo: "일 전",
    topChampions: "챔피언 숙련도",
    analysis: "핵심 분석",
    detailAnalysis: "상세 분석",
    matchDetails: "경기 상세",
    matchRecordTab: "전적",
    matchBuildTab: "빌드",
    riotIdMaskOn: "가리기 ON",
    riotIdMaskOff: "가리기 OFF",
    buildLoading: "빌드 불러오는 중",
    buildLoadFailed: "빌드 정보를 불러오지 못했습니다.",
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
    champion: "챔피언",
    gamesPlayed: "게임 수",
    wins: "승리",
    championPerformance: "챔피언별 최근 성과",
    rolePerformance: "포지션별 최근 성과",
    opponent: "상대",
    items: "아이템",
    runes: "룬",
    summonerSpells: "소환사 주문",
    damage: "딜량",
    totalDamage: "총피해량",
    damageTaken: "받은 피해",
    damageShare: "팀 딜 비중",
    gold: "골드",
    vision: "시야",
    objectives: "오브젝트",
    wards: "와드",
    deathTime: "사망 시간",
    popularChampions: "인기 챔피언",
    lpTrend: "LP 변화 추이",
    aggregatePerformance: "종합 성과",
    aggregateGrade: "종합 등급",
    championMasteryTop5: "챔피언 숙련도 TOP 5",
    masteryBasis: "숙련도 기준",
    championDetailStats: "상세 분석",
    recentChampionStats: "최근 챔피언 성과",
    roleWinRate: "포지션별 승률",
    details: "자세히 보기",
    searchNav: "검색",
    contentMenu: "컨텐츠",
    tournamentCalendar: "대회일정",
    tournamentList: "대회 리스트",
    tournamentCalendarTitle: "대회 일정",
    tournamentListTitle: "전체 대회 리스트",
    tournamentCalendarSubtitle: "공개된 스트리머 대회의 경기 일정을 달력에서 확인하고 바로 상세 페이지로 이동할 수 있습니다.",
    tournamentListSubtitle: "현재 공개된 스트리머 대회를 한 곳에서 확인하고 대진표, 일정·순위, 뉴스를 볼 수 있습니다.",
    tournamentOpenDetail: "대회 보기",
    tournamentCalendarEmpty: "표시할 대회 일정이 없습니다.",
    tournamentListEmpty: "공개된 대회가 없습니다.",
    tournamentMatchCount: "경기",
    tournamentUpcoming: "예정 경기",
    tournamentLive: "진행 중",
    tournamentCompleted: "종료",
    tournamentBracket: "대진표",
    tournamentScheduleRanking: "일정·순위",
    tournamentNews: "뉴스",
    tournamentEmpty: "공개된 대회가 없습니다.",
    tournamentSelect: "대회 선택",
    tournamentTitle: "SEIGA CUP",
    tournamentSubtitle: "League of Legends 스트리머 토너먼트",
    tournamentBracketIntro: "총 16개 팀이 참가하는 스트리머 롤 토너먼트입니다. 최강의 스트리머 팀을 가려보세요.",
    tournamentScheduleTitle: "경기 일정",
    tournamentStandingsTitle: "순위",
    tournamentNewsTitle: "대회 뉴스",
    tournamentInfo: "대회 정보",
    tournamentPeriod: "대회 기간",
    tournamentTeams: "참가 팀",
    tournamentTeamUnit: "팀",
    tournamentAllTeams: "전체 팀",
    tournamentTeamGroups: "참가팀 현황",
    tournamentSeed: "시드",
    tournamentUpcomingMatch: "다음 경기",
    tournamentNoMatch: "예정 경기 없음",
    tournamentFormat: "경기 방식",
    tournamentPrize: "총 상금",
    tournamentTbd: "미정",
    tournamentVs: "VS",
    tournamentLiveShort: "LIVE",
    tournamentNotice: "최근 공지사항",
    tournamentAllView: "전체 보기",
    tournamentDownloadBracket: "전체 대진표 다운로드",
    tournamentRound16: "16강",
    tournamentRound8: "8강",
    tournamentRound4: "4강",
    tournamentFinal: "결승",
    tournamentWin: "승",
    tournamentLoss: "패",
    tournamentPoint: "득실",
    tournamentTeamRecord: "팀원 전적",
    tournamentPlayerColumn: "선수",
    tournamentPlayerTier: "티어",
    tournamentPlayerWinRate: "승률",
    tournamentPlayerRole: "포지션",
    tournamentPlayerMost: "모스트",
    tournamentPlayerHighTier: "최고 티어",
    tournamentPlayerScore: "점수",
    tournamentLeader: "팀장",
    tournamentPlayerRecordLoading: "전적 로딩 중",
    tournamentPlayerRecordFailed: "전적 확인 실패",
    tournamentNoPlayers: "등록된 선수가 없습니다.",
    ranking: "랭킹",
    overview: "종합",
    championAnalysis: "챔피언 분석",
    ingame: "인게임",
    stats: "통계",
    spectate: "관전하기",
    patchNotes: "커뮤니티",
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
    averageCsPerMinute: "평균 CS/분",
    perMinuteCs: "분당 CS",
    recentFlowBasis: "최근 흐름 기준",
    topPercentPrefix: "상위",
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
    premiumNoticeTitle: "프리미엄 기능 안내",
    premiumNoticeBody: "결제/구독은 아직 연결되지 않았습니다. 현재는 방송 관리 로그인으로 이동합니다.",
    openStreamerLogin: "방송 관리 열기",
    savedData: "저장된 데이터",
    cachedRanking: "저장된 검색 기반 랭킹",
    liveDataNotice: "실시간 친구/전체 자동완성은 Riot 공개 API 제한으로 자체 DB가 쌓인 데이터만 표시합니다.",
    subscriptionStatus: "구독현황",
    subscriptionsTitle: "구독 중인 방송인",
    subscriptionsSubtitle: "최근 Twitch 팔로우 기준",
    subscriptionsEmpty: "팔로우 목록에서 구독 중인 방송인을 찾지 못했습니다.",
    subscriptionMissingScope: "구독 상태 확인 권한이 필요합니다. Twitch를 다시 로그인해주세요.",
    subscriptionGift: "선물 구독",
    patchNotesPreparing: "커뮤니티 게시판을 준비 중입니다.",
    patchNotesPreparingBody: "Twitch 로그인 후 게시글을 작성할 수 있습니다.",
    communitySubtitle: "Twitch 로그인 후 자유롭게 글을 작성할 수 있습니다.",
    communityWriteTitle: "게시글 작성",
    communityListTitle: "최근 게시글",
    communityLoginRequired: "게시글 작성은 Twitch 로그인 후 사용할 수 있습니다.",
    communityTitleLabel: "제목",
    communityBodyLabel: "내용",
    communityTitlePlaceholder: "제목을 입력하세요",
    communityBodyPlaceholder: "내용을 입력하세요",
    communitySubmit: "게시하기",
    communitySubmitting: "게시 중",
    communityEmpty: "아직 게시글이 없습니다.",
    communityLoadFailed: "게시글을 불러오지 못했습니다.",
    refreshAvailableIn: "후 가능",
    twitchLive: "방송 중",
    twitchOffline: "스트리머 오프라인",
    twitchOnlineShort: "온라인",
    twitchOfflineShort: "오프라인",
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
    viewRecord: "전적 보기",
    loadMoreMatches: "더보기",
    loadingMoreMatches: "불러오는 중",
    noMoreMatches: "더 이상 표시할 전적이 없습니다.",
    currentGameStatus: "실시간 게임 상태",
    currentlyInGame: "게임중입니다",
    notInGame: "게임중이 아닙니다",
    currentGameUnavailable: "인게임 정보를 불러오지 못했습니다.",
    currentGameUnavailableDetail: "인게임 정보는 Riot Spectator API로 별도 조회됩니다.",
    currentGamePlatform: "조회 서버",
    currentGameParticipants: "참가자",
    currentGameMode: "모드",
    currentGameDuration: "진행 시간",
    currentGameUpdated: "마지막 업데이트",
    currentGameAverageTier: "평균 티어",
    currentGameReady: "분석 준비",
    currentGameBot: "봇",
    blueTeam: "블루 팀",
    redTeam: "레드 팀"
  },
  ja: {
    brand: "Seiga.GG",
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
    mobileMenu: "メニュー",
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
    premiumTitle: "Seiga.GG Premium",
    premiumBody: "広告非表示、詳細統計、プロリプレイなどのプレミアム機能を体験できます。",
    premiumCta: "プレミアムにアップグレード",
    version: "バージョン",
    profileSummary: "プレイヤー概要",
    recentGames: "最近の試合",
    recent20Games: "最近20試合",
    justNow: "たった今",
    minutesAgo: "分前",
    hoursAgo: "時間前",
    daysAgo: "日前",
    topChampions: "チャンピオン熟練度",
    analysis: "主要分析",
    detailAnalysis: "詳細分析",
    matchDetails: "試合詳細",
    matchRecordTab: "戦績",
    matchBuildTab: "ビルド",
    riotIdMaskOn: "非表示 ON",
    riotIdMaskOff: "非表示 OFF",
    buildLoading: "ビルド読み込み中",
    buildLoadFailed: "ビルド情報を読み込めませんでした。",
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
    champion: "チャンピオン",
    gamesPlayed: "試合数",
    wins: "勝利",
    championPerformance: "チャンピオン別最近成績",
    rolePerformance: "ポジション別最近成績",
    opponent: "相手",
    items: "アイテム",
    runes: "ルーン",
    summonerSpells: "サモナースペル",
    damage: "ダメージ",
    totalDamage: "総ダメージ",
    damageTaken: "受けたダメージ",
    damageShare: "チームダメージ比率",
    gold: "ゴールド",
    vision: "視界",
    objectives: "オブジェクト",
    wards: "ワード",
    deathTime: "死亡時間",
    popularChampions: "人気チャンピオン",
    lpTrend: "LP推移",
    aggregatePerformance: "総合成績",
    aggregateGrade: "総合グレード",
    championMasteryTop5: "チャンピオン熟練度 TOP 5",
    masteryBasis: "熟練度基準",
    championDetailStats: "詳細分析",
    recentChampionStats: "最近のチャンピオン成績",
    roleWinRate: "ポジション別勝率",
    details: "詳細を見る",
    searchNav: "検索",
    contentMenu: "コンテンツ",
    tournamentCalendar: "大会日程",
    tournamentList: "大会リスト",
    tournamentCalendarTitle: "大会日程",
    tournamentListTitle: "全大会リスト",
    tournamentCalendarSubtitle: "公開中の配信者大会の日程をカレンダーで確認し、詳細ページへ移動できます。",
    tournamentListSubtitle: "公開中の配信者大会を一覧で確認し、トーナメント表・日程順位・ニュースを見られます。",
    tournamentOpenDetail: "大会を見る",
    tournamentCalendarEmpty: "表示できる大会日程がありません。",
    tournamentListEmpty: "公開中の大会がありません。",
    tournamentMatchCount: "試合",
    tournamentUpcoming: "予定試合",
    tournamentLive: "進行中",
    tournamentCompleted: "終了",
    tournamentBracket: "トーナメント表",
    tournamentScheduleRanking: "日程・順位",
    tournamentNews: "ニュース",
    tournamentEmpty: "公開中の大会がありません。",
    tournamentSelect: "大会選択",
    tournamentTitle: "SEIGA CUP",
    tournamentSubtitle: "League of Legends 配信者トーナメント",
    tournamentBracketIntro: "全16チームが参加する配信者 LoL トーナメントです。最強の配信者チームを決めましょう。",
    tournamentScheduleTitle: "試合日程",
    tournamentStandingsTitle: "順位",
    tournamentNewsTitle: "大会ニュース",
    tournamentInfo: "大会情報",
    tournamentPeriod: "大会期間",
    tournamentTeams: "参加チーム",
    tournamentTeamUnit: "チーム",
    tournamentAllTeams: "全チーム",
    tournamentTeamGroups: "参加チーム状況",
    tournamentSeed: "シード",
    tournamentUpcomingMatch: "次の試合",
    tournamentNoMatch: "予定試合なし",
    tournamentFormat: "試合形式",
    tournamentPrize: "賞金総額",
    tournamentTbd: "未定",
    tournamentVs: "VS",
    tournamentLiveShort: "LIVE",
    tournamentNotice: "最近のお知らせ",
    tournamentAllView: "すべて見る",
    tournamentDownloadBracket: "全トーナメント表をダウンロード",
    tournamentRound16: "ベスト16",
    tournamentRound8: "ベスト8",
    tournamentRound4: "準決勝",
    tournamentFinal: "決勝",
    tournamentWin: "勝",
    tournamentLoss: "敗",
    tournamentPoint: "得失",
    tournamentTeamRecord: "チームメンバー戦績",
    tournamentPlayerColumn: "選手",
    tournamentPlayerTier: "ティア",
    tournamentPlayerWinRate: "勝率",
    tournamentPlayerRole: "ポジション",
    tournamentPlayerMost: "得意",
    tournamentPlayerHighTier: "最高ティア",
    tournamentPlayerScore: "スコア",
    tournamentLeader: "リーダー",
    tournamentPlayerRecordLoading: "戦績読み込み中",
    tournamentPlayerRecordFailed: "戦績確認失敗",
    tournamentNoPlayers: "登録済みの選手がいません。",
    ranking: "ランキング",
    overview: "総合",
    championAnalysis: "チャンピオン分析",
    ingame: "インゲーム",
    stats: "統計",
    spectate: "観戦",
    patchNotes: "コミュニティ",
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
    averageCsPerMinute: "平均CS/分",
    perMinuteCs: "分あたりCS",
    recentFlowBasis: "最近の流れ基準",
    topPercentPrefix: "上位",
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
    premiumNoticeTitle: "プレミアム機能案内",
    premiumNoticeBody: "決済/購読はまだ接続されていません。現在は配信管理ログインへ移動します。",
    openStreamerLogin: "配信管理を開く",
    savedData: "保存データ",
    cachedRanking: "保存済み検索ベースランキング",
    liveDataNotice: "リアルタイム友達/全体オートコンプリートは Riot 公開 API の制限により、蓄積済みデータのみ表示します。",
    subscriptionStatus: "サブスク状況",
    subscriptionsTitle: "サブスク中の配信者",
    subscriptionsSubtitle: "最近の Twitch フォロー基準",
    subscriptionsEmpty: "フォロー一覧からサブスク中の配信者を見つけられませんでした。",
    subscriptionMissingScope: "サブスク状態の確認権限が必要です。Twitch に再ログインしてください。",
    subscriptionGift: "ギフトサブスク",
    patchNotesPreparing: "コミュニティ掲示板を準備中です。",
    patchNotesPreparingBody: "Twitchログイン後、投稿を作成できます。",
    communitySubtitle: "Twitchログイン後、自由に投稿を作成できます。",
    communityWriteTitle: "投稿作成",
    communityListTitle: "最近の投稿",
    communityLoginRequired: "投稿作成は Twitch ログイン後に利用できます。",
    communityTitleLabel: "タイトル",
    communityBodyLabel: "内容",
    communityTitlePlaceholder: "タイトルを入力してください",
    communityBodyPlaceholder: "内容を入力してください",
    communitySubmit: "投稿する",
    communitySubmitting: "投稿中",
    communityEmpty: "まだ投稿がありません。",
    communityLoadFailed: "投稿を読み込めませんでした。",
    refreshAvailableIn: "後に可能",
    twitchLive: "配信中",
    twitchOffline: "配信者オフライン",
    twitchOnlineShort: "オンライン",
    twitchOfflineShort: "オフライン",
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
    viewRecord: "戦績を見る",
    loadMoreMatches: "もっと見る",
    loadingMoreMatches: "読み込み中",
    noMoreMatches: "これ以上表示できる戦績はありません。",
    currentGameStatus: "リアルタイムゲーム状態",
    currentlyInGame: "ゲーム中です",
    notInGame: "ゲーム中ではありません",
    currentGameUnavailable: "ゲーム中情報を読み込めませんでした。",
    currentGameUnavailableDetail: "ゲーム中情報は Riot Spectator API で別途取得します。",
    currentGamePlatform: "照会サーバー",
    currentGameParticipants: "参加者",
    currentGameMode: "モード",
    currentGameDuration: "進行時間",
    currentGameUpdated: "最終更新",
    currentGameAverageTier: "平均ティア",
    currentGameReady: "分析準備",
    currentGameBot: "ボット",
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

function clearStoredLocale(): void {
  try {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
  } catch {
    // 언어 저장소 삭제 실패는 화면 사용을 막지 않습니다.
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

async function getPublicLolMatchBuild(matchId: string): Promise<PublicLolMatchBuildResponse> {
  const response = await fetch(`${apiBase}/api/lol/match-build?matchId=${encodeURIComponent(matchId)}`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as PublicLolMatchBuildResponse;
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

async function getPublicCommunityPosts(): Promise<CommunityPost[]> {
  const response = await fetch(`${apiBase}/api/public/community/posts?limit=50`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const body = await response.json() as { posts?: CommunityPost[] };
  return Array.isArray(body.posts) ? body.posts : [];
}

async function createPublicCommunityPost(input: { title: string; body: string }): Promise<CommunityPost[]> {
  const response = await fetch(`${apiBase}/api/public/community/posts`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  const body = await response.json() as { posts?: CommunityPost[] };
  return Array.isArray(body.posts) ? body.posts : [];
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

function normalizeRiotId(riotId: string): string {
  return riotId.trim().normalize("NFKC").replace(/＃/g, "#").toLocaleLowerCase();
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

type PublicTournamentRoute = {
  page: Extract<PublicMainPage, "tournamentCalendar" | "tournamentList" | "tournamentNews" | "tournamentTeams" | "tournamentBracket" | "tournamentSchedule">;
  slug?: string;
};

function tournamentRouteFromPublicPath(pathname: string = window.location.pathname): PublicTournamentRoute | undefined {
  if (pathname === PUBLIC_TOURNAMENT_LIST_PATH || pathname === `${PUBLIC_TOURNAMENT_LIST_PATH}/`) {
    return { page: "tournamentList" };
  }
  if (pathname === PUBLIC_TOURNAMENT_CALENDAR_PATH || pathname === `${PUBLIC_TOURNAMENT_CALENDAR_PATH}/`) {
    return { page: "tournamentCalendar" };
  }
  if (!pathname.startsWith(PUBLIC_TOURNAMENT_ROUTE_PREFIX)) return undefined;
  const [slug, tab] = pathname.slice(PUBLIC_TOURNAMENT_ROUTE_PREFIX.length).split("/");
  if (!slug) return { page: "tournamentList" };
  const page =
    tab === "news" ? "tournamentNews" :
    tab === "teams" ? "tournamentTeams" :
    tab === "schedule" ? "tournamentSchedule" :
    "tournamentBracket";
  return { page, slug: decodeURIComponent(slug) };
}

function publicTournamentDetailPath(slug: string, page: PublicMainPage = "tournamentBracket"): string {
  const suffix =
    page === "tournamentNews" ? "/news" :
    page === "tournamentTeams" ? "/teams" :
    page === "tournamentSchedule" ? "/schedule" :
    "";
  return `${PUBLIC_TOURNAMENT_ROUTE_PREFIX}${encodeURIComponent(slug)}${suffix}`;
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

function rankTrendTierClass(stats: LolRankedStats | undefined): string {
  return `tier-${stats?.tier ? stats.tier.toLocaleLowerCase() : "unranked"}`;
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
  return new Intl.DateTimeFormat(activePublicLocale === "ja" ? "ja-JP" : "ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatShortDate(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(activePublicLocale === "ja" ? "ja-JP" : "ko-KR", { month: "numeric", day: "numeric" }).format(date);
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

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return "-";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.max(0, Math.floor(seconds % 60));
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatBuildMinute(timestampMs: number | undefined): string {
  if (timestampMs === undefined || !Number.isFinite(timestampMs)) return "-";
  const minutes = Math.max(0, Math.floor(timestampMs / 60_000));
  return activePublicLocale === "ja" ? `${minutes}分` : `${minutes}분`;
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

function metricToneClass(tone: MetricTone | undefined): string {
  return `metric-tone-${tone ?? "neutral"}`;
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

function championAnalysisRows(profile: PublicLolProfile): PublicChampionAnalysisRow[] {
  const rows = new Map<number, PublicChampionAnalysisRow>();
  profile.topChampions.forEach((champion, index) => {
    rows.set(champion.championId, {
      champion,
      masteryRank: index + 1,
      masteryLevel: champion.masteryLevel,
      masteryPoints: champion.masteryPoints
    });
  });
  profile.championPerformance.forEach((performance) => {
    const existing = rows.get(performance.champion.championId);
    rows.set(performance.champion.championId, {
      champion: existing?.champion ?? performance.champion,
      masteryRank: existing?.masteryRank,
      masteryLevel: existing?.masteryLevel ?? performance.champion.masteryLevel,
      masteryPoints: existing?.masteryPoints ?? performance.champion.masteryPoints,
      performance
    });
  });
  return [...rows.values()].sort((a, b) => {
    const rankDiff = (a.masteryRank ?? 999) - (b.masteryRank ?? 999);
    if (rankDiff !== 0) return rankDiff;
    return (b.performance?.games ?? 0) - (a.performance?.games ?? 0) || (b.masteryPoints ?? 0) - (a.masteryPoints ?? 0);
  });
}

function championAnalysisMax(rows: PublicChampionAnalysisRow[], value: (row: PublicChampionAnalysisRow) => number | undefined): number {
  return Math.max(1, ...rows.map((row) => value(row) ?? 0));
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

function profileWithDynamicState(profile: PublicLolProfile, next: PublicLolProfile): PublicLolProfile {
  if (profile.riotId !== next.riotId) return profile;
  return {
    ...profile,
    twitchStream: next.twitchStream,
    liveGame: next.liveGame,
    refreshAvailableAt: next.refreshAvailableAt
  };
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

function estimatedLpDelta(match: PublicLolRecentMatch): number {
  if (match.result === "win") return 20;
  if (match.result === "loss") return -18;
  return 0;
}

const rankTrendTierSteps = [
  { tier: "IRON", base: 0, code: "I" },
  { tier: "BRONZE", base: 400, code: "B" },
  { tier: "SILVER", base: 800, code: "S" },
  { tier: "GOLD", base: 1200, code: "G" },
  { tier: "PLATINUM", base: 1600, code: "P" },
  { tier: "EMERALD", base: 2000, code: "E" },
  { tier: "DIAMOND", base: 2400, code: "D" },
  { tier: "MASTER", base: 2800, code: "M" },
  { tier: "GRANDMASTER", base: 3200, code: "GM" },
  { tier: "CHALLENGER", base: 3600, code: "C" }
];

function rankTrendStepForScore(score: number): { tier: string; base: number; code: string } {
  return [...rankTrendTierSteps].reverse().find((item) => score >= item.base) ?? rankTrendTierSteps[0]!;
}

function rankTrendDivisionLabel(score: number): string {
  if (!Number.isFinite(score) || score <= 0) return "U";
  const step = rankTrendStepForScore(score);
  if (step.tier === "MASTER" || step.tier === "GRANDMASTER" || step.tier === "CHALLENGER") return step.code;
  const divisions = ["4", "3", "2", "1"];
  const division = divisions[Math.min(3, Math.floor(Math.max(0, score - step.base) / 100))] ?? "4";
  return `${step.code}${division}`;
}

function rankTrendPointLabel(score: number): string {
  const step = rankTrendStepForScore(score);
  const lp = Math.max(0, Math.round(score - step.base));
  if (step.tier === "MASTER" || step.tier === "GRANDMASTER" || step.tier === "CHALLENGER") {
    return `${rankTrendDivisionLabel(score)} ${lp} LP`;
  }
  return `${rankTrendDivisionLabel(score)} ${Math.min(99, lp % 100)} LP`;
}

function rankTrendAxisLabels(minScore: number, maxScore: number): string[] {
  const minTick = Math.floor(minScore / 100) * 100;
  const maxTick = Math.ceil(maxScore / 100) * 100;
  const middleTick = Math.round(((minTick + maxTick) / 2) / 100) * 100;
  return [maxTick, middleTick, minTick]
    .filter((value, index, values) => values.indexOf(value) === index)
    .map(rankTrendDivisionLabel);
}

function recentMatchesWithinWindow(matches: PublicLolRecentMatch[], windowMs: number): PublicLolRecentMatch[] {
  const cutoff = Date.now() - windowMs;
  return matches.filter((match) => {
    if (!match.startedAt) return false;
    const time = Date.parse(match.startedAt);
    return Number.isFinite(time) && time >= cutoff;
  });
}

function rankTrendLine(profile: PublicLolProfile): PublicTrendLine | undefined {
  const windowEnd = Date.now();
  const windowStart = windowEnd - LP_TREND_WINDOW_MS;
  const windowMiddle = windowStart + (LP_TREND_WINDOW_MS / 2);
  const currentRankScore = rankScore(profile.rankedStats);

  const storedRankSamples = (profile.rankHistory ?? [])
    .map((point, index) => {
      const startedAtMs = Date.parse(point.date);
      const value = Number.isFinite(point.rankScore) ? point.rankScore : undefined;
      if (!Number.isFinite(startedAtMs) || value === undefined) return undefined;
      return {
        key: `${profile.riotId}:rank-history:${point.date}:${index}`,
        value,
        label: rankTrendPointLabel(value),
        result: "unknown" as PublicLolRecentMatch["result"],
        startedAtMs
      };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point))
    .sort((a, b) => a.startedAtMs - b.startedAtMs);
  const baselineRankSample = storedRankSamples
    .filter((point) => point.startedAtMs < windowStart)
    .at(-1);
  const historySamples = [
    ...(baselineRankSample ? [{
      ...baselineRankSample,
      key: `${baselineRankSample.key}:window-start`,
      startedAtMs: windowStart
    }] : []),
    ...storedRankSamples.filter((point) => point.startedAtMs >= windowStart && point.startedAtMs <= windowEnd)
  ];
  const samples = historySamples.length >= 2 ? historySamples : (() => {
    const filteredMatches = recentMatchesWithinWindow(profile.recentMatches, LP_TREND_WINDOW_MS);
    const matches = (filteredMatches.length > 0 ? filteredMatches : profile.recentMatches.slice(0, RECENT_ANALYSIS_MATCH_LIMIT)).slice().reverse();
    if (matches.length === 0 && currentRankScore <= 0) return [];
    const totalDelta = matches.reduce((sum, match) => sum + estimatedLpDelta(match), 0);
    const startingRankScore = Math.max(0, currentRankScore - totalDelta);
    let runningRankScore = startingRankScore;
    const fallbackStepMs = matches.length > 1 ? LP_TREND_WINDOW_MS / (matches.length - 1) : 0;
    const matchSamples = matches.map((match, index) => {
      runningRankScore += estimatedLpDelta(match);
      const displayValue = Math.max(0, runningRankScore);
      const parsedStartedAt = Date.parse(match.startedAt ?? "");
      const startedAtMs = Number.isFinite(parsedStartedAt)
        ? parsedStartedAt
        : matches.length === 1 ? windowEnd : windowStart + fallbackStepMs * index;
      return {
        key: `${match.matchId}:lp:${index}`,
        value: displayValue,
        label: `${resultLabel(match.result)} · ${rankTrendPointLabel(displayValue)}`,
        result: match.result,
        startedAtMs
      };
    });
    const currentDisplayRankScore = currentRankScore > 0
      ? currentRankScore
      : matchSamples[matchSamples.length - 1]?.value ?? 0;
    return matchSamples.length > 0
      ? [
          {
            key: `${profile.riotId}:lp:start`,
            value: startingRankScore,
            label: rankTrendPointLabel(startingRankScore),
            result: "unknown" as PublicLolRecentMatch["result"],
            startedAtMs: windowStart
          },
          ...matchSamples,
          {
            key: `${profile.riotId}:lp:current`,
            value: currentDisplayRankScore,
            label: rankTrendPointLabel(currentDisplayRankScore),
            result: "unknown" as PublicLolRecentMatch["result"],
            startedAtMs: windowEnd
          }
        ]
      : [
          {
            key: `${profile.riotId}:lp:start`,
            value: currentRankScore,
            label: rankTrendPointLabel(currentRankScore),
            result: "unknown" as PublicLolRecentMatch["result"],
            startedAtMs: windowStart
          },
          {
            key: `${profile.riotId}:lp:current`,
            value: currentRankScore,
            label: rankTrendPointLabel(currentRankScore),
            result: "unknown" as PublicLolRecentMatch["result"],
            startedAtMs: windowEnd
          }
        ];
  })();

  if (samples.length === 0) return undefined;
  const width = 320;
  const height = 112;
  const padX = 26;
  const padY = 18;
  const rawMin = Math.min(...samples.map((point) => point.value));
  const rawMax = Math.max(...samples.map((point) => point.value));
  const min = Math.floor(rawMin / 100) * 100;
  const max = Math.ceil(rawMax / 100) * 100;
  const range = Math.max(1, max - min);
  const points = samples.map((point): PublicTrendPoint => {
    const rawTimeRatio = Number.isFinite(point.startedAtMs) ? (point.startedAtMs - windowStart) / LP_TREND_WINDOW_MS : 0;
    const timeRatio = Math.max(0, Math.min(1, rawTimeRatio));
    const x = padX + timeRatio * (width - padX * 2);
    const y = padY + (1 - ((point.value - min) / range)) * (height - padY * 2);
    return {
      key: point.key,
      x: roundTo(x, 1),
      y: roundTo(y, 1),
      value: point.value,
      label: point.label,
      result: point.result
    };
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
    yLabels: rankTrendAxisLabels(rawMin, rawMax),
    startLabel: formatShortDate(new Date(windowStart).toISOString()),
    middleLabel: formatShortDate(new Date(windowMiddle).toISOString()),
    endLabel: formatShortDate(new Date(windowEnd).toISOString())
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
  function submitFromKeyboard(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

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
            name="riotId"
            type="search"
            value={query}
            placeholder={t().searchPlaceholder}
            data-ko={publicI18n.ko.searchPlaceholder}
            data-ja={publicI18n.ja.searchPlaceholder}
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => onQuery(event.target.value)}
            onKeyDown={submitFromKeyboard}
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

function SeigaSearchLoader() {
  return (
    <div className="public-search-loading-overlay" role="status" aria-live="polite" aria-label={t().searching}>
      <div className="public-search-loading-card">
        <div className="seiga-logo-loader" aria-hidden="true">
          <div className="loader-aura" />
          <div className="loader-ring ring-outer" />
          <div className="loader-ring ring-inner" />
          <div className="loader-scan" />
          <div className="seiga-mark">
            <span className="mark-wing mark-left" />
            <span className="mark-wing mark-right" />
            <span className="mark-core" />
            <span className="mark-blade" />
            <span className="mark-gem" />
          </div>
        </div>
        <strong data-ko={publicI18n.ko.searching} data-ja={publicI18n.ja.searching}>{t().searching}</strong>
      </div>
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
        <span data-ko={publicI18n.ko.damage} data-ja={publicI18n.ja.damage}>{t().damage}</span>
        <strong className={metricToneClass(damagePerMinuteTone(summary.averageDamagePerMinute))}>{formatNumber(summary.averageDamagePerMinute)}</strong>
        <p>{perMinuteText(t().damage, summary.averageDamagePerMinute)} · {t().damageShare} {formatPercent(summary.averageDamageShare, 1)}</p>
      </article>
      <article className="public-stat-card">
        <span>CS / {t().gold}</span>
        <strong className={metricToneClass(csTone(summary.averageCsPerMinute))}>{formatDecimal(summary.averageCsPerMinute, 1)}</strong>
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
    .reduce<Array<{ year: string; label: string; tier?: string }>>((items, point) => {
      const year = String(new Date(point.date).getFullYear());
      if (!items.some((item) => item.year === year)) items.push({ year, label: rankPointLabel(point), tier: point.tier });
      return items;
    }, []);
  const fetchedYear = new Date(profile.fetchedAt).getFullYear();
  const seasonLabel = Number.isFinite(fetchedYear) ? `${fetchedYear}` : t().currentSeason;
  const badges = historyBadges.length > 0
    ? historyBadges
    : [{ year: seasonLabel, label: rankLabel(profile.rankedStats), tier: profile.rankedStats?.tier }];
  return (
    <div className="public-season-badges" aria-label={t().rankTrend}>
      {badges.map((badge) => (
        <span className={`tier-${badge.tier ? badge.tier.toLocaleLowerCase() : "unranked"}`} key={`${badge.year}:${badge.label}`}>
          {badge.year} {badge.label}
        </span>
      ))}
      <span className="recent-form">{t().recentForm} {winLossText(profile.summary.recentWins, profile.summary.recentGames)}</span>
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
        <small>
          {stats ? (
            <>
              {stats.leaguePoints} LP · <span className={metricToneClass(percentTone(stats.winRate))}>{t().winRate} {stats.winRate}%</span>
            </>
          ) : t().noData}
        </small>
      </div>
    </article>
  );
}

function TwitchStreamOverviewCard({ stream }: { stream: PublicLolTwitchStream | undefined }) {
  if (!stream) return null;
  const categoryLabel = stream.isLive ? stream.gameName : undefined;
  const viewerLabel = stream.isLive && stream.viewerCount !== undefined ? `${formatNumber(stream.viewerCount)} ${t().twitchViewers}` : undefined;
  const offlineLabel = !stream.isLive ? stream.twitchDisplayName : undefined;
  return (
    <article className={`public-rank-overview-card public-stream-overview-card ${stream.isLive ? "live" : "offline"}`}>
      {stream.profileImageUrl ? (
        <img src={assetUrl(stream.profileImageUrl)} alt="" />
      ) : (
        <div className={`public-rank-fallback public-stream-fallback ${stream.isLive ? "live" : ""}`}>TV</div>
      )}
      <div>
        <span data-ko={publicI18n.ko.twitchStreamer} data-ja={publicI18n.ja.twitchStreamer}>{t().twitchStreamer}</span>
        <strong data-ko={stream.isLive ? publicI18n.ko.twitchOnlineShort : publicI18n.ko.twitchOfflineShort} data-ja={stream.isLive ? publicI18n.ja.twitchOnlineShort : publicI18n.ja.twitchOfflineShort}>
          {stream.isLive ? t().twitchOnlineShort : t().twitchOfflineShort}
        </strong>
        <span className="public-stream-meta">
          {categoryLabel ? <small title={categoryLabel}>{categoryLabel}</small> : null}
          {viewerLabel ? <small title={viewerLabel}>{viewerLabel}</small> : null}
          {offlineLabel ? <small title={offlineLabel}>{offlineLabel}</small> : null}
        </span>
      </div>
    </article>
  );
}

function ProfileMetricStrip({ profile }: { profile: PublicLolProfile }) {
  const recentLosses = Math.max(0, profile.summary.recentGames - profile.summary.recentWins);
  const aiScore = averageAiScore(profile);
  const winLabel = activePublicLocale === "ja" ? "勝" : "승";
  const lossLabel = activePublicLocale === "ja" ? "敗" : "패";
  const metricCards = [
    {
      key: "kda",
      tone: "purple",
      icon: "K",
      title: `${t().average} ${t().kda}`,
      value: formatDecimal(profile.summary.averageKda),
      valueTone: metricToneClass(kdaTone(profile.summary.averageKda)),
      detail: `${profile.summary.totalKills} / ${profile.summary.totalDeaths} / ${profile.summary.totalAssists}`,
      progress: metricProgress(profile.summary.averageKda, 6),
      scale: ["0", "2.0", "4.0", "6.0+"],
      rank: topPercentText(metricTopPercent(profile.summary.averageKda, 3, 72))
    },
    {
      key: "cs",
      tone: "green",
      icon: "CS",
      title: t().averageCsPerMinute,
      value: formatDecimal(profile.summary.averageCsPerMinute, 1),
      valueTone: metricToneClass(csTone(profile.summary.averageCsPerMinute)),
      detail: t().perMinuteCs,
      progress: metricProgress(profile.summary.averageCsPerMinute, 8),
      scale: ["0", "4.0", "6.0", "8.0+"],
      rank: topPercentText(metricTopPercent(profile.summary.averageCsPerMinute, 7, 72))
    },
    {
      key: "win",
      tone: "blue",
      icon: activePublicLocale === "ja" ? "勝" : "승",
      title: t().winRate,
      value: formatPercent(profile.summary.recentWinRate),
      valueTone: metricToneClass(percentTone(profile.summary.recentWinRate)),
      detail: `${profile.summary.recentWins}${winLabel} ${recentLosses}${lossLabel}`,
      progress: metricProgress(profile.summary.recentWinRate, 100),
      scale: ["0%", "25%", "50%", "75%", "100%"],
      rank: topPercentText(metricTopPercent(profile.summary.recentWinRate, 95, 100))
    },
    {
      key: "score",
      tone: "orange",
      icon: activePublicLocale === "ja" ? "点" : "점",
      title: t().aiScore,
      value: String(aiScore),
      valueTone: metricToneClass(scoreTone(aiScore)),
      detail: t().recentFlowBasis,
      progress: metricProgress(aiScore, 100),
      scale: ["0", "25", "50", "75", "100"],
      rank: topPercentText(metricTopPercent(aiScore, 100, 88))
    }
  ];

  return (
    <div className="public-profile-metric-strip" aria-label={t().profileSummary}>
      {metricCards.map((card) => (
        <article className={`public-profile-metric-card ${card.tone}`} key={card.key}>
          <div className="public-profile-metric-head">
            <span className="public-profile-metric-icon" aria-hidden="true">{card.icon}</span>
            <span className="public-profile-metric-label">
              <span>{card.title}</span>
              <small aria-hidden="true">?</small>
            </span>
          </div>
          <strong className={card.valueTone}>{card.value}</strong>
          <small className="public-profile-metric-detail">{card.detail}</small>
          <div className="public-profile-metric-bar" aria-hidden="true">
            <i style={{ width: card.progress }} />
          </div>
          <div className="public-profile-metric-scale" aria-hidden="true">
            {card.scale.map((label) => <span key={`${card.key}:${label}`}>{label}</span>)}
          </div>
          <em>{card.rank}</em>
        </article>
      ))}
    </div>
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

function LpTrendLineChart({ profile, compact = false }: { profile: PublicLolProfile; compact?: boolean }) {
  const trend = rankTrendLine(profile);
  if (!trend) return <p className="public-empty">{t().noData}</p>;
  const latestPoint = trend.points[trend.points.length - 1];

  return (
    <>
      <svg className={`public-lp-line ${compact ? "compact" : ""}`} viewBox="0 0 320 112" role="img" aria-label={t().lpTrend} preserveAspectRatio="none">
        <path className="public-lp-line-area" d={trend.areaPath} />
        <polyline className="public-lp-line-stroke" points={trend.linePoints} />
        {trend.points.map((point) => (
          <g className={`public-lp-line-point ${point.result} ${point.key === latestPoint?.key ? "latest" : ""}`} key={point.key}>
            <circle cx={point.x} cy={point.y} r="4" />
            <title>{point.label}</title>
          </g>
        ))}
      </svg>
      {compact ? null : <div className="public-lp-chart-y-axis" aria-hidden="true">
        {trend.yLabels.map((label) => <span key={label}>{label}</span>)}
      </div>}
      {compact ? null : <div className="public-lp-chart-axis" aria-hidden="true">
        <span>{trend.startLabel}</span>
        <span>{trend.middleLabel}</span>
        <span>{trend.endLabel}</span>
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
  const registeredStreamerStream = visibleStreamerStream(profile.twitchStream);
  const profileLinks = profileLinksFromStream(registeredStreamerStream);
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
              <div className="public-refresh-stack">
                <ProfileLinkIcons links={profileLinks} />
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
                <span className="public-refresh-updated-at">{t().fetchedAt} {formatDate(profile.fetchedAt)}</span>
              </div>
              <button type="button" className="public-secondary-action" onClick={onToggleFavorite}>
                {favoriteActive ? t().favoriteRemove : t().favoriteAdd}
              </button>
            </div>
          </div>
        </div>
      </div>
      <aside className={`public-profile-top-side ${registeredStreamerStream ? "has-stream-status" : ""}`} aria-label={t().ranking}>
        <RankOverviewCard title={t().soloRank} stats={soloStats} fallback={!soloStats} />
        <RankOverviewCard title={t().flexRank} stats={flexStats} fallback={!flexStats} />
        <RankOverviewCard title={t().ranked5v5} stats={rank5v5Stats} fallback={!rank5v5Stats} />
        <TwitchStreamOverviewCard stream={registeredStreamerStream} />
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
  const aggregateSummary = summarizeMatches(recentAnalysisMatches(profile));
  const recentLosses = Math.max(0, aggregateSummary.recentGames - aggregateSummary.recentWins);
  const aggregateRank = soloRankStats(profile) ?? flexRankStats(profile) ?? profile.rankedStats;
  const aggregateTierIcon = assetUrl(aggregateRank?.tierIconUrl);
  const aggregateGrade = aggregatePerformanceGrade(profile);
  const aggregateScore = aggregatePerformanceScore(profile);
  const winRate = Math.max(0, Math.min(100, aggregateSummary.recentWinRate));
  return (
    <section id="public-stats" className="public-overview-dashboard-panel">
      <article className="public-panel public-aggregate-card">
        <div className="public-section-head">
          <h2 data-ko={publicI18n.ko.aggregatePerformance} data-ja={publicI18n.ja.aggregatePerformance}>
            <span className="public-aggregate-title-icon" aria-hidden="true"><i /><i /><i /></span>
            {t().aggregatePerformance}
          </h2>
          <span>{aggregateSummary.recentGames}{t().games}</span>
        </div>
        <div className="public-aggregate-hero">
          <div className="public-aggregate-emblem" aria-hidden="true">
            {aggregateTierIcon ? <img src={aggregateTierIcon} alt="" /> : <span>{aggregateGrade}</span>}
          </div>
          <div className="public-aggregate-grade">
            <span data-ko={publicI18n.ko.aggregateGrade} data-ja={publicI18n.ja.aggregateGrade}>{t().aggregateGrade}</span>
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
      </article>
      <article className="public-panel public-lp-trend-card">
        <div className="public-section-head">
          <h2 data-ko={publicI18n.ko.lpTrend} data-ja={publicI18n.ja.lpTrend}>{t().lpTrend}</h2>
          <span data-ko={publicI18n.ko.period30} data-ja={publicI18n.ja.period30}>{t().period30}</span>
        </div>
        <div className={`public-lp-chart ${rankTrendTierClass(profile.rankedStats)}`}>
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
        <img className="public-brand-logo" src="/images/seigagg-logo.png" alt={t().brand} />
      </button>
      <nav aria-label="Seiga.GG">
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

function PublicLocaleSelector({
  locale,
  onLocale,
  onAutoLocale: _onAutoLocale
}: {
  locale: PublicLocale;
  onLocale: (locale: PublicLocale) => void;
  onAutoLocale?: () => void;
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
        <i aria-hidden="true" />
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
              aria-label={`${option.code} ${option.label}`}
              onClick={() => selectLocale(option.locale)}
            >
              <strong>{option.code}</strong>
              <em aria-hidden="true">✓</em>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PublicHeaderMenu({
  activePage,
  activeTarget,
  onPage
}: {
  activePage: PublicMainPage;
  activeTarget: PublicNavTarget;
  onPage: (page: PublicMainPage) => void;
}) {
  const searchItem: { key: PublicMainPage; icon: string; ko: string; ja: string; label: string } = {
    key: "search",
    icon: "⌕",
    ko: publicI18n.ko.searchNav,
    ja: publicI18n.ja.searchNav,
    label: t().searchNav
  };
  const items: Array<{ key: PublicMainPage; icon: string; ko: string; ja: string; label: string }> = [
    { key: "favorites", icon: "☆", ko: publicI18n.ko.favoritesTitle, ja: publicI18n.ja.favoritesTitle, label: t().favoritesTitle },
    { key: "subscriptions", icon: "◆", ko: publicI18n.ko.subscriptionStatus, ja: publicI18n.ja.subscriptionStatus, label: t().subscriptionStatus },
    { key: "patch", icon: "▣", ko: publicI18n.ko.patchNotes, ja: publicI18n.ja.patchNotes, label: t().patchNotes }
  ];
  const contentPages: PublicMainPage[] = ["tournamentCalendar", "tournamentList", "tournamentNews", "tournamentTeams", "tournamentBracket", "tournamentSchedule"];
  const contentItems: Array<{ page: PublicMainPage; icon: string; ko: string; ja: string; label: string }> = [
    { page: "tournamentCalendar", icon: "◷", ko: publicI18n.ko.tournamentCalendar, ja: publicI18n.ja.tournamentCalendar, label: t().tournamentCalendar },
    { page: "tournamentList", icon: "▣", ko: publicI18n.ko.tournamentList, ja: publicI18n.ja.tournamentList, label: t().tournamentList }
  ];

  return (
    <nav className="public-header-nav" aria-label="Seiga.GG">
      <button className={activePage === "search" && activeTarget === "search" ? "active" : ""} type="button" onClick={() => onPage("search")}>
        <span aria-hidden="true">{searchItem.icon}</span>
        <strong data-ko={searchItem.ko} data-ja={searchItem.ja}>{searchItem.label}</strong>
      </button>
      <div className="public-header-menu-item">
        <button
          className={contentPages.includes(activePage) ? "active" : ""}
          type="button"
          aria-haspopup="menu"
          onClick={() => onPage("tournamentCalendar")}
        >
          <span aria-hidden="true">▦</span>
          <strong data-ko={publicI18n.ko.contentMenu} data-ja={publicI18n.ja.contentMenu}>{t().contentMenu}</strong>
        </button>
        <div className="public-header-submenu" role="menu" aria-label={t().contentMenu}>
          {contentItems.map((item) => (
            <button className={activePage === item.page ? "active" : ""} type="button" role="menuitem" onClick={() => onPage(item.page)} key={item.page}>
              <span aria-hidden="true">{item.icon}</span>
              <strong data-ko={item.ko} data-ja={item.ja}>{item.label}</strong>
            </button>
          ))}
        </div>
      </div>
      {items.map((item) => (
        <button className={activePage === item.key ? "active" : ""} type="button" onClick={() => onPage(item.key)} key={item.key}>
          <span aria-hidden="true">{item.icon}</span>
          <strong data-ko={item.ko} data-ja={item.ja}>{item.label}</strong>
        </button>
      ))}
    </nav>
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
  filters,
  champions,
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
  filters: PublicMatchFilters;
  champions: LolChampionSummary[];
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [twitchMenuOpen, setTwitchMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const twitchMenuCloseTimer = useRef<number | undefined>(undefined);
  const filterActive = hasActiveFilters(filters);
  const twitchUser = twitchStatus.connected ? twitchStatus.user : undefined;
  const approvedStreamerRequest = twitchStatus.streamerRiotRequest?.status === "approved" ? twitchStatus.streamerRiotRequest : undefined;
  const canRegisterStreamer = twitchStatus.streamerRiotRequest?.status !== "approved" && twitchStatus.streamerRiotRequest?.status !== "pending";
  const canOpenStreamerDashboard = Boolean(approvedStreamerRequest);
  const handleMenuPage = (page: PublicMainPage) => {
    onPage(page);
    setMobileMenuOpen(false);
  };

  function clearTwitchMenuCloseTimer(): void {
    if (twitchMenuCloseTimer.current === undefined) return;
    window.clearTimeout(twitchMenuCloseTimer.current);
    twitchMenuCloseTimer.current = undefined;
  }

  function scheduleTwitchMenuClose(): void {
    clearTwitchMenuCloseTimer();
    twitchMenuCloseTimer.current = window.setTimeout(() => {
      setTwitchMenuOpen(false);
      twitchMenuCloseTimer.current = undefined;
    }, 160);
  }

  useEffect(() => () => clearTwitchMenuCloseTimer(), []);

  return (
    <header id={showSearch ? "public-search" : undefined} className={`public-app-header ${showSearch ? "" : "home"} ${mobileMenuOpen ? "mobile-menu-open" : ""}`}>
      <div className="public-header-brand">
        <img className="public-brand-logo" src="/images/seigagg-logo.png" alt={t().brand} />
      </div>
      <button
        className="public-mobile-menu-toggle"
        type="button"
        aria-label={t().mobileMenu}
        aria-expanded={mobileMenuOpen}
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        <span aria-hidden="true" />
        <strong data-ko={publicI18n.ko.mobileMenu} data-ja={publicI18n.ja.mobileMenu}>{t().mobileMenu}</strong>
      </button>
      <PublicHeaderMenu activePage={activePage} activeTarget={activeTarget} onPage={handleMenuPage} />
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
      ) : null}
      <div className="public-header-tools">
        <PublicLocaleSelector locale={locale} onLocale={onLocale} onAutoLocale={onAutoLocale} />
        <div className="public-twitch-profile-wrap" onMouseEnter={clearTwitchMenuCloseTimer} onMouseLeave={scheduleTwitchMenuClose}>
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

function PublicFavoritesPage({
  favorites,
  onPick
}: {
  favorites: PublicFavorite[];
  onPick: (suggestion: SearchSuggestion) => void;
}) {
  return (
    <section className="public-panel public-saved-data-panel public-menu-page-panel">
      <div className="public-section-head">
        <h2 data-ko={publicI18n.ko.favoritesTitle} data-ja={publicI18n.ja.favoritesTitle}>{t().favoritesTitle}</h2>
        <span>{favorites.length}</span>
      </div>
      <div className="public-saved-grid single">
        <article className="public-favorites-card">
          <strong data-ko={publicI18n.ko.favoritesTitle} data-ja={publicI18n.ja.favoritesTitle}>{t().favoritesTitle}</strong>
          {favorites.length === 0 ? <p className="public-empty">{t().noFavorites}</p> : favorites.map((favorite) => (
            <button type="button" onClick={() => onPick(favorite)} key={`favorite:${normalizeSuggestionKey(favorite)}`}>
              {favorite.profileIconUrl ? <img src={assetUrl(favorite.profileIconUrl)} alt="" /> : <em>{favorite.gameName.slice(0, 1).toUpperCase()}</em>}
              <strong>{favorite.gameName}<small>#{favorite.tagLine}</small></strong>
              <b>{rankLabel(favorite.rankedStats)}</b>
            </button>
          ))}
        </article>
      </div>
    </section>
  );
}

function PublicSubscriptionsPage({
  twitchStatus,
  followed,
  loading,
  error,
  onLogin,
  onLogout,
  onRefresh,
  onSearch
}: {
  twitchStatus: PublicTwitchViewerStatus;
  followed: PublicTwitchFollowedLolResponse | null;
  loading: boolean;
  error: string;
  onLogin: () => void;
  onLogout: () => void;
  onRefresh: () => void;
  onSearch: (riotId: string) => void;
}) {
  const subscriptions = followed?.subscriptions ?? [];
  return (
    <section className="public-panel public-saved-data-panel public-menu-page-panel public-subscriptions-page">
      <div className="public-section-head">
        <h2 data-ko={publicI18n.ko.subscriptionStatus} data-ja={publicI18n.ja.subscriptionStatus}>{t().subscriptionStatus}</h2>
        <span>{subscriptions.length}</span>
      </div>
      <div className="public-subscriptions-layout">
        <article className="public-subscriptions-card">
          <strong data-ko={publicI18n.ko.subscriptionsTitle} data-ja={publicI18n.ja.subscriptionsTitle}>{t().subscriptionsTitle}</strong>
          <p data-ko={publicI18n.ko.subscriptionsSubtitle} data-ja={publicI18n.ja.subscriptionsSubtitle}>{t().subscriptionsSubtitle}</p>
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
          onLogout={onLogout}
          onRefresh={onRefresh}
          onSearch={onSearch}
        />
      </div>
    </section>
  );
}

function PublicCommunityPage({
  twitchStatus,
  posts,
  loading,
  error,
  submitting,
  onLogin,
  onRefresh,
  onSubmit
}: {
  twitchStatus: PublicTwitchViewerStatus;
  posts: CommunityPost[];
  loading: boolean;
  error: string;
  submitting: boolean;
  onLogin: () => void;
  onRefresh: () => void;
  onSubmit: (input: { title: string; body: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const canSubmit = twitchStatus.connected && title.trim().length > 0 && body.trim().length > 0 && !submitting;

  async function submitPost(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) return;
    await onSubmit({ title, body });
    setTitle("");
    setBody("");
  }

  return (
    <section className="public-panel public-menu-page-panel public-community-page">
      <div className="public-section-head">
        <h2 data-ko={publicI18n.ko.patchNotes} data-ja={publicI18n.ja.patchNotes}>{t().patchNotes}</h2>
        <span>Seiga.GG</span>
      </div>
      <p className="public-community-lead" data-ko={publicI18n.ko.communitySubtitle} data-ja={publicI18n.ja.communitySubtitle}>{t().communitySubtitle}</p>
      <div className="public-community-layout">
        <article className="public-community-compose">
          <div className="public-community-card-head">
            <strong data-ko={publicI18n.ko.communityWriteTitle} data-ja={publicI18n.ja.communityWriteTitle}>{t().communityWriteTitle}</strong>
          </div>
          {!twitchStatus.connected ? (
            <div className="public-community-login">
              <p data-ko={publicI18n.ko.communityLoginRequired} data-ja={publicI18n.ja.communityLoginRequired}>{t().communityLoginRequired}</p>
              <button type="button" onClick={onLogin} data-ko={publicI18n.ko.twitchViewerLogin} data-ja={publicI18n.ja.twitchViewerLogin}>{t().twitchViewerLogin}</button>
            </div>
          ) : (
            <form className="public-community-form" onSubmit={submitPost}>
              <label>
                <span data-ko={publicI18n.ko.communityTitleLabel} data-ja={publicI18n.ja.communityTitleLabel}>{t().communityTitleLabel}</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.currentTarget.value)}
                  maxLength={80}
                  placeholder={t().communityTitlePlaceholder}
                  data-ko={publicI18n.ko.communityTitlePlaceholder}
                  data-ja={publicI18n.ja.communityTitlePlaceholder}
                />
              </label>
              <label>
                <span data-ko={publicI18n.ko.communityBodyLabel} data-ja={publicI18n.ja.communityBodyLabel}>{t().communityBodyLabel}</span>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.currentTarget.value)}
                  maxLength={2000}
                  rows={8}
                  placeholder={t().communityBodyPlaceholder}
                  data-ko={publicI18n.ko.communityBodyPlaceholder}
                  data-ja={publicI18n.ja.communityBodyPlaceholder}
                />
              </label>
              <button type="submit" disabled={!canSubmit} data-ko={publicI18n.ko.communitySubmit} data-ja={publicI18n.ja.communitySubmit}>
                {submitting ? t().communitySubmitting : t().communitySubmit}
              </button>
            </form>
          )}
        </article>
        <article className="public-community-list">
          <div className="public-community-card-head">
            <strong data-ko={publicI18n.ko.communityListTitle} data-ja={publicI18n.ja.communityListTitle}>{t().communityListTitle}</strong>
            <button type="button" onClick={onRefresh} disabled={loading} data-ko={publicI18n.ko.twitchFollowedRefresh} data-ja={publicI18n.ja.twitchFollowedRefresh}>{t().twitchFollowedRefresh}</button>
          </div>
          {error ? <p className="public-community-error">{error}</p> : null}
          {loading ? (
            <p className="public-empty" data-ko={publicI18n.ko.tournamentPlayerRecordLoading} data-ja={publicI18n.ja.tournamentPlayerRecordLoading}>{t().tournamentPlayerRecordLoading}</p>
          ) : posts.length === 0 ? (
            <p className="public-empty" data-ko={publicI18n.ko.communityEmpty} data-ja={publicI18n.ja.communityEmpty}>{t().communityEmpty}</p>
          ) : posts.map((post) => (
            <section className="public-community-post" key={post.id}>
              <header>
                {post.authorProfileImageUrl ? <img src={post.authorProfileImageUrl} alt="" /> : <em>{post.authorDisplayName.slice(0, 1).toUpperCase()}</em>}
                <strong>
                  {post.authorDisplayName}
                  <small>@{post.authorTwitchLogin}{post.authorRiotGameName && post.authorRiotTagLine ? ` · ${post.authorRiotGameName}#${post.authorRiotTagLine}` : ""}</small>
                </strong>
                <time>{formatTournamentDateTime(post.createdAt)}</time>
              </header>
              <h3>{post.title}</h3>
              <p>{post.body}</p>
            </section>
          ))}
        </article>
      </div>
    </section>
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
    <section className="public-panel public-menu-page-panel public-tournament-calendar-page">
      <div className="public-tournament-page-head">
        <div>
          <span data-ko={publicI18n.ko.contentMenu} data-ja={publicI18n.ja.contentMenu}>{t().contentMenu}</span>
          <h2 data-ko={publicI18n.ko.tournamentCalendarTitle} data-ja={publicI18n.ja.tournamentCalendarTitle}>{t().tournamentCalendarTitle}</h2>
          <p data-ko={publicI18n.ko.tournamentCalendarSubtitle} data-ja={publicI18n.ja.tournamentCalendarSubtitle}>{t().tournamentCalendarSubtitle}</p>
        </div>
        <button type="button" onClick={onOpenList} data-ko={publicI18n.ko.tournamentList} data-ja={publicI18n.ja.tournamentList}>{t().tournamentList}</button>
      </div>
      {loading ? <div className="public-tournament-empty">{t().searching}</div> : null}
      {error ? <div className="public-tournament-empty error">{error}</div> : null}
      {!loading && !error && events.length === 0 ? <div className="public-tournament-empty">{t().tournamentCalendarEmpty}</div> : null}
      <div className="public-tournament-calendar-layout">
        <article className="public-tournament-calendar-card">
          <div className="public-tournament-calendar-title">
            <strong>{tournamentMonthTitle(baseDate)}</strong>
            <span>{events.length} {t().tournamentMatchCount}</span>
          </div>
          <div className="public-tournament-calendar-grid">
            {tournamentCalendarWeekdays().map((weekday) => <b key={weekday}>{weekday}</b>)}
            {days.map((day) => (
              <div className={`public-tournament-calendar-day ${day.outside ? "outside" : ""} ${day.today ? "today" : ""}`} key={tournamentDateKey(day.date)}>
                <strong>{day.date.getDate()}</strong>
                <div>
                  {day.events.slice(0, 3).map((event) => (
                    <button className={event.status} type="button" onClick={() => onSelectTournament(event.tournament.slug)} key={event.id}>
                      <span>{event.time}</span>
                      <em>{event.tournament.title}</em>
                      <small>{event.round}</small>
                    </button>
                  ))}
                  {day.events.length > 3 ? <i>+{day.events.length - 3}</i> : null}
                </div>
              </div>
            ))}
          </div>
        </article>
        <aside className="public-tournament-upcoming-card">
          <div className="public-tournament-card-head">
            <strong data-ko={publicI18n.ko.tournamentUpcoming} data-ja={publicI18n.ja.tournamentUpcoming}>{t().tournamentUpcoming}</strong>
            <span>{upcoming.length}</span>
          </div>
          {upcoming.length === 0 ? <p className="public-empty">{t().tournamentCalendarEmpty}</p> : upcoming.map((event) => (
            <button type="button" onClick={() => onSelectTournament(event.tournament.slug)} key={event.id}>
              <time>{formatTournamentDateTime(event.startsAt.toISOString())}</time>
              <strong>{event.title}</strong>
              <span>{event.tournament.title} · {event.round}</span>
            </button>
          ))}
        </aside>
      </div>
    </section>
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
    <section className="public-panel public-menu-page-panel public-tournament-list-page">
      <div className="public-tournament-page-head">
        <div>
          <span data-ko={publicI18n.ko.contentMenu} data-ja={publicI18n.ja.contentMenu}>{t().contentMenu}</span>
          <h2 data-ko={publicI18n.ko.tournamentListTitle} data-ja={publicI18n.ja.tournamentListTitle}>{t().tournamentListTitle}</h2>
          <p data-ko={publicI18n.ko.tournamentListSubtitle} data-ja={publicI18n.ja.tournamentListSubtitle}>{t().tournamentListSubtitle}</p>
        </div>
        <button type="button" onClick={onOpenCalendar} data-ko={publicI18n.ko.tournamentCalendar} data-ja={publicI18n.ja.tournamentCalendar}>{t().tournamentCalendar}</button>
      </div>
      {loading ? <div className="public-tournament-empty">{t().searching}</div> : null}
      {error ? <div className="public-tournament-empty error">{error}</div> : null}
      {!loading && !error && tournaments.length === 0 ? <div className="public-tournament-empty">{t().tournamentListEmpty}</div> : null}
      <div className="public-tournament-list-grid">
        {tournaments.map((tournament) => {
          const liveCount = tournament.matches.filter((match) => match.status === "live").length;
          const completedCount = tournament.matches.filter((match) => match.status === "completed").length;
          return (
            <article className="public-tournament-list-card" key={tournament.id}>
              <div>
                <span>{liveCount > 0 ? t().tournamentLive : completedCount === tournament.matches.length && tournament.matches.length > 0 ? t().tournamentCompleted : t().tournamentUpcoming}</span>
                <strong>{tournament.title}</strong>
                <p>{tournamentDescriptionText(tournament.description, t().tournamentSubtitle)}</p>
              </div>
              <dl>
                <div><dt>{t().tournamentPeriod}</dt><dd>{formatTournamentDate(tournament.startsAt)} ~ {formatTournamentDate(tournament.endsAt)}</dd></div>
                <div><dt>{t().tournamentTeams}</dt><dd>{tournament.teams.length} {t().tournamentTeamUnit}</dd></div>
                <div><dt>{t().tournamentMatchCount}</dt><dd>{tournament.matches.length}</dd></div>
              </dl>
              <button type="button" onClick={() => onSelectTournament(tournament.slug)} data-ko={publicI18n.ko.tournamentOpenDetail} data-ja={publicI18n.ja.tournamentOpenDetail}>{t().tournamentOpenDetail}</button>
            </article>
          );
        })}
      </div>
    </section>
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

  return (
    <section className="public-panel public-menu-page-panel public-tournament-page">
      <div className="public-tournament-head">
        <div className="public-tournament-brand">
          <span aria-hidden="true">♕</span>
          <div>
            <strong>{tournament?.title ?? t().tournamentTitle}</strong>
            <small>{tournamentDescriptionText(tournament?.description, t().tournamentSubtitle)}</small>
          </div>
        </div>
        <nav className="public-tournament-tabs" aria-label={t().contentMenu}>
          {tabs.map((tab) => (
            <button className={page === tab.page ? "active" : ""} type="button" onClick={() => onPage(tab.page)} key={tab.page}>
              <span data-ko={tab.ko} data-ja={tab.ja}>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="public-tournament-selector">
        <span data-ko={publicI18n.ko.tournamentSelect} data-ja={publicI18n.ja.tournamentSelect}>{t().tournamentSelect}</span>
        <select value={tournament?.slug ?? ""} onChange={(event) => onSelectTournament(event.target.value)} disabled={loading || tournaments.length === 0}>
          {tournaments.map((item) => <option value={item.slug} key={item.id}>{item.title}</option>)}
        </select>
      </div>

      {loading ? <div className="public-tournament-empty">{t().searching}</div> : null}
      {error ? <div className="public-tournament-empty error">{error}</div> : null}
      {!loading && !error && !tournament ? <div className="public-tournament-empty" data-ko={publicI18n.ko.tournamentEmpty} data-ja={publicI18n.ja.tournamentEmpty}>{t().tournamentEmpty}</div> : null}

      {tournament ? (
        <div className="public-tournament-hero">
          <div>
            <span>{t().contentMenu}</span>
            <h2>{tournament.title}</h2>
            <p>{tournamentDescriptionText(tournament.description, t().tournamentSubtitle)}</p>
          </div>
          <div className="public-tournament-hero-stats">
            <article><small>{t().tournamentPeriod}</small><strong>{formatTournamentDate(tournament.startsAt)} ~ {formatTournamentDate(tournament.endsAt)}</strong></article>
            <article><small>{t().tournamentTeams}</small><strong>{tournament.teams.length} {t().tournamentTeamUnit}</strong></article>
            <article><small>{t().tournamentFormat}</small><strong>{tournament.formatLabel || "-"}</strong></article>
            <article><small>{t().tournamentPrize}</small><strong>{tournament.prizeLabel || "-"}</strong></article>
          </div>
        </div>
      ) : null}

      {tournament && page === "tournamentBracket" ? (
        <div className="public-tournament-layout">
          <div className="public-tournament-main">
            <div className="public-tournament-title-row">
              <div>
                <h2 data-ko={publicI18n.ko.tournamentBracket} data-ja={publicI18n.ja.tournamentBracket}>{t().tournamentBracket}</h2>
                <p>{tournamentDescriptionText(tournament.description, t().tournamentBracketIntro)}</p>
              </div>
            </div>
            <div className={`public-tournament-bracket rounds-${Math.min(Math.max(bracketRounds.length, 1), 4)}`} aria-label={t().tournamentBracket}>
              {bracketRounds.map((round, roundIndex) => {
                const roundMatches = tournament.matches.filter((match) => match.round === round);
                const isLastRound = roundIndex === bracketRounds.length - 1;
                return (
                <div className={`public-tournament-round ${isLastRound ? "final-round" : ""} ${roundIndex > 0 ? `future round-${roundIndex + 1}` : ""}`} key={round}>
                  <strong>{formatTournamentBracketStageName(round, roundIndex, bracketRounds.length)}<small>{firstRoundDate(tournament, round)}</small></strong>
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
                        <div className={`${!teamA ? "pending" : ""} ${tournamentMatchSideClass(match.teamAId, winnerTeamId, hasScore)}`}>
                          <b>{teamA?.seed ?? "-"}</b>
                          {avatar(teamAName)}
                          <span>{teamAName}</span>
                          {match.status === "live" ? <em>{t().tournamentLiveShort}</em> : <i>{match.scoreA ?? "-"}</i>}
                        </div>
                        <small>{t().tournamentVs}</small>
                        <div className={`${!teamB ? "pending" : ""} ${tournamentMatchSideClass(match.teamBId, winnerTeamId, hasScore)}`}>
                          <b>{teamB?.seed ?? "-"}</b>
                          {avatar(teamBName)}
                          <span>{teamBName}</span>
                          <i>{match.scoreB ?? "-"}</i>
                        </div>
                        <time>{formatTournamentTime(match.scheduledAt)}<small>{match.format ?? "BO3"}</small></time>
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
          <aside className="public-tournament-side">
            <TournamentScheduleCard upcoming={scheduleItems.slice(0, 3)} avatar={avatar} />
            <TournamentNoticeCard notices={notices} />
          </aside>
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
          <article className="public-tournament-card public-tournament-standings">
            <div className="public-tournament-card-head">
              <strong data-ko={publicI18n.ko.tournamentStandingsTitle} data-ja={publicI18n.ja.tournamentStandingsTitle}>{t().tournamentStandingsTitle}</strong>
              <span>{tournament.title}</span>
            </div>
            {standings.map((team) => (
              <div className="public-tournament-standing-row" key={team.team}>
                <b>{team.rank}</b>
                {avatar(team.team)}
                <strong>{team.team}</strong>
                <span>{team.win}{t().tournamentWin} {team.loss}{t().tournamentLoss}</span>
                <em>{team.point}</em>
              </div>
            ))}
          </article>
        </div>
      ) : null}

      {tournament && page === "tournamentNews" ? (
        <div className="public-tournament-news-grid">
          {news.map((item, index) => (
            <article className="public-tournament-news-card" key={item.title}>
              <span>NEWS {index + 1}</span>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
              <time>{formatTournamentDate(item.publishedAt)}</time>
            </article>
          ))}
          <TournamentNoticeCard notices={notices} />
        </div>
      ) : null}
    </section>
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
    <article className={`public-tournament-card public-tournament-schedule ${expanded ? "expanded" : ""}`}>
      <div className="public-tournament-card-head">
        <strong data-ko={publicI18n.ko.tournamentScheduleTitle} data-ja={publicI18n.ja.tournamentScheduleTitle}>{t().tournamentScheduleTitle}</strong>
        <button type="button" data-ko={publicI18n.ko.tournamentAllView} data-ja={publicI18n.ja.tournamentAllView}>{t().tournamentAllView} ›</button>
      </div>
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
    </article>
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
    <article className="public-tournament-card public-tournament-team-panel">
      <div className="public-tournament-card-head">
        <strong data-ko={publicI18n.ko.tournamentTeamGroups} data-ja={publicI18n.ja.tournamentTeamGroups}>{t().tournamentTeamGroups}</strong>
        <span>{tournament.teams.length} {t().tournamentTeamUnit}</span>
      </div>
      <div className="public-tournament-team-groups">
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
      </div>
    </article>
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
    <article className="public-tournament-card public-tournament-notices">
      <div className="public-tournament-card-head">
        <strong data-ko={publicI18n.ko.tournamentNotice} data-ja={publicI18n.ja.tournamentNotice}>{t().tournamentNotice}</strong>
        <button type="button" data-ko={publicI18n.ko.tournamentAllView} data-ja={publicI18n.ja.tournamentAllView}>{t().tournamentAllView} ›</button>
      </div>
      {notices.map((notice) => (
        <div className="public-tournament-notice-row" key={notice.title}>
          <span>{notice.title}</span>
          <time>{notice.date}</time>
        </div>
      ))}
    </article>
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
          data-ko={matchBadgeLabel(badge.code, "ko")}
          data-ja={matchBadgeLabel(badge.code, "ja")}
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
  if (loading && !build) return <div className="public-match-build-state">{t().buildLoading}</div>;
  if (error && !build) return <div className="public-match-build-state error">{error}</div>;
  const participants = build?.participants ?? [];
  const activeKey = selectedKey ?? defaultBuildParticipantKey(match, build);
  const selectedParticipant = participants.find((participant) => buildParticipantKey(participant) === activeKey) ?? participants[0];
  if (!selectedParticipant) return <div className="public-match-build-state">{t().noData}</div>;
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
  return (
    <section className="public-match-build-panel" aria-label={t().matchBuildTab}>
      <div className="public-match-build-picker" role="listbox" aria-label={t().champion}>
        {participants.map((participant) => {
          const key = buildParticipantKey(participant);
          return (
            <button
              type="button"
              className={key === buildParticipantKey(selectedParticipant) ? "active" : ""}
              key={key}
              onClick={() => onSelect(key)}
              title={hideRiotIds ? "*" : participant.riotId ?? championName(participant.champion)}
            >
              {participant.champion.iconUrl ? <img src={participant.champion.iconUrl} alt="" /> : <span>{championName(participant.champion).slice(0, 1)}</span>}
              <strong className={metricToneClass(scoreTone(participant.score))}>{participant.score}</strong>
            </button>
          );
        })}
      </div>
      <div className="public-match-build-group items">
        <span data-ko={publicI18n.ko.items} data-ja={publicI18n.ja.items}>{t().items}</span>
        <div className="public-match-build-timeline">
          {itemEvents.length > 0 ? itemEvents.slice(0, 24).map((item, index) => (
            <div key={`${match.matchId}:build-event:${selectedParticipant.participantId ?? selectedParticipant.riotId}:${index}:${item.itemId}`}>
              <span>{item.iconUrl ? <img src={item.iconUrl} alt="" /> : item.itemId}</span>
              <small>{formatBuildMinute(item.timestampMs)}</small>
            </div>
          )) : <p className="public-empty">{t().noData}</p>}
        </div>
      </div>
      <div className="public-match-build-group skills">
        <span data-ko={publicI18n.ko.matchBuildTab} data-ja={publicI18n.ja.matchBuildTab}>{activePublicLocale === "ja" ? "スキルビルド" : "스킬 빌드"}</span>
        <div className="public-match-skill-build">
          <div className="public-match-skill-icons">
            {visibleSkillIcons.map((skill) => (
              <span key={`${selectedParticipant.participantId}:skill-icon:${skill.key}`} title={abilityName(skill)}>
                {skill.iconUrl ? <img src={skill.iconUrl} alt="" /> : skill.key}
                <b>{skill.key}</b>
              </span>
            ))}
          </div>
          <div className="public-match-skill-grid" aria-label={activePublicLocale === "ja" ? "スキル順" : "스킬 순서"}>
            {(["Q", "W", "E", "R"] as const).map((key) => (
              <Fragment key={`skill-row:${key}`}>
                <strong>{key}</strong>
                {Array.from({ length: 18 }).map((_, index) => {
                  const level = index + 1;
                  const skill = selectedSkillOrder.find((item) => item.level === level && item.key === key);
                  return (
                    <span className={skill ? key.toLowerCase() : ""} key={`${selectedParticipant.participantId}:skill-level:${key}:${level}`} title={skill ? `${level} · ${abilityName(skill)}` : `${level}`}>
                      {skill ? level : ""}
                    </span>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="public-match-build-group runes">
        <span data-ko={publicI18n.ko.runes} data-ja={publicI18n.ja.runes}>{t().runes}</span>
        <div className="public-match-build-runes">
          {selectedRunes.length > 0 ? selectedRunes.map((rune, index) => (
            <span className={`rune-${rune.kind}`} key={`${selectedParticipant.participantId}:rune:${rune.kind}:${rune.category ?? "unknown"}:${rune.runeId}:${index}`} title={runeName(rune)}>
              {rune.iconUrl ? <img src={rune.iconUrl} alt="" /> : rune.runeId}
              <small>{runeName(rune)}</small>
            </span>
          )) : <p className="public-empty">{t().noData}</p>}
        </div>
        <div className="public-match-build-summary">
          <strong>{hideRiotIds ? "*" : selectedParticipant.riotId ?? championName(selectedParticipant.champion)}</strong>
          <small>{championName(selectedParticipant.champion)} · {t().aiScore} {selectedParticipant.score}</small>
          <MatchBadges badges={selectedParticipant.badges} />
        </div>
      </div>
    </section>
  );
}

function fixedTeamItemSlots(items: PublicLolMatchParticipant["items"]): Array<PublicLolMatchParticipant["items"][number] | undefined> {
  const slots = Array<PublicLolMatchParticipant["items"][number] | undefined>(7).fill(undefined);
  items.forEach((item, index) => {
    const slot = item.slot >= 0 && item.slot < slots.length ? item.slot : index;
    if (slot >= 0 && slot < slots.length && !slots[slot] && item.itemId > 0) slots[slot] = item;
  });
  return [0, 1, 2, 6, 3, 4, 5].map((slot) => slots[slot]);
}

function PlayerItemBuild({ items, itemKey }: { items: PublicLolMatchParticipant["items"]; itemKey: string }) {
  const itemSlots = fixedTeamItemSlots(items);
  return (
    <div className="public-team-item-build" aria-label={t().items}>
      {itemSlots.map((item, index) => item ? (
        <span className="public-team-item-slot" key={`${itemKey}:${index}:${item.slot}:${item.itemId}`}>
          {item.iconUrl ? <img src={item.iconUrl} alt="" /> : item.itemId}
        </span>
      ) : (
        <span className="public-team-item-empty" key={`${itemKey}:${index}:empty`} aria-hidden="true" />
      ))}
    </div>
  );
}

function runeName(rune: PublicLolMatchParticipant["runes"][number] | undefined): string {
  if (!rune) return "-";
  if (activePublicLocale === "ja") return rune.nameJa ?? rune.nameKo ?? `Rune ${rune.runeId}`;
  return rune.nameKo ?? rune.nameJa ?? `Rune ${rune.runeId}`;
}

function PlayerSpellBuild({
  spells,
  dataDragonVersion
}: {
  spells: number[] | undefined;
  dataDragonVersion: string | undefined;
}) {
  const slots = [spells?.[0], spells?.[1]];
  return (
    <div className="public-team-spell-build" aria-label={t().summonerSpells}>
      {slots.map((spellId, index) => {
        const iconUrl = spellId ? summonerSpellIconUrl(spellId, dataDragonVersion) : undefined;
        return spellId ? (
          <span className="public-team-spell-slot" key={`${spellId}:${index}`} title={`Spell ${spellId}`}>
            {iconUrl ? <img src={iconUrl} alt="" /> : <b>{spellId}</b>}
          </span>
        ) : (
          <span className="public-team-spell-empty" key={`empty:${index}`} aria-hidden="true" />
        );
      })}
    </div>
  );
}

function PlayerRuneBuild({ runes }: { runes: PublicLolMatchParticipant["runes"] | undefined }) {
  const primary = runes?.find((rune) => rune.kind === "primary" && rune.category === "keystone") ??
    runes?.find((rune) => rune.kind === "primary" && rune.category !== "style") ??
    runes?.find((rune) => rune.kind === "primary") ??
    runes?.[0];
  const secondary = runes?.find((rune) => rune.kind === "secondary" && rune.category === "perk") ??
    runes?.find((rune) => rune.kind === "secondary" && rune.category !== "style") ??
    runes?.find((rune) => rune.kind === "secondary") ??
    runes?.find((rune) => rune !== primary);
  const slots = [primary, secondary];
  return (
    <div className="public-team-rune-build" aria-label={t().runes}>
      {slots.map((rune, index) => rune ? (
        <span className={`public-team-rune-slot rune-${rune.kind}`} key={`${rune.runeId}:${rune.kind}:${rune.category ?? "unknown"}`} title={runeName(rune)}>
          {rune.iconUrl ? <img src={rune.iconUrl} alt="" /> : <b>{rune.runeId}</b>}
        </span>
      ) : (
        <span className="public-team-rune-empty" key={`empty:${index}`} aria-hidden="true" />
      ))}
    </div>
  );
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
  return (
    <div className="public-team-loadout-build" aria-label={`${t().summonerSpells} / ${t().runes}`}>
      <PlayerSpellBuild spells={spells} dataDragonVersion={dataDragonVersion} />
      <PlayerRuneBuild runes={runes} />
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
  streamer,
  onSearch
}: {
  riotId: string | undefined;
  fallback: string;
  badges?: PublicLolMatchBadge[];
  streamer?: PublicLolTwitchStream;
  onSearch: (riotId: string) => void;
}) {
  const display = splitRiotId(riotId, fallback);
  const visibleStreamer = visibleStreamerStream(streamer);
  if (!riotId) {
    return (
      <strong className={`public-riot-id-static ${visibleStreamer ? "streamer" : ""}`}>
        <span className="public-riot-name">{display.name}</span>
        <RiotIdAwardBadges badges={badges} />
      </strong>
    );
  }
  return (
    <button
      className={`public-riot-id-link ${visibleStreamer ? "streamer" : ""}`}
      type="button"
      onClick={() => onSearch(riotId)}
      title={visibleStreamer ? `${t().twitchStreamer} · ${visibleStreamer.isLive ? t().twitchOnlineShort : t().twitchOfflineShort} · ${riotId}` : `${t().search}: ${riotId}`}
    >
      <span className="public-riot-name">{display.name}</span>
      {display.tag ? <span className="public-riot-tag-badge">{display.tag}</span> : null}
      <RiotIdAwardBadges badges={badges} />
    </button>
  );
}

function TeamChampionAvatar({ player }: { player: PublicLolMatchParticipant }) {
  const stream = visibleStreamerStream(player.twitchStream);
  const streamLabel = stream ? (stream.isLive ? t().twitchOnlineShort : t().twitchOfflineShort) : "";
  const streamStatusLabel = stream ? `${stream.twitchDisplayName} · ${streamLabel}` : "";
  return (
    <span className={`public-team-champion-avatar ${stream ? "streamer" : ""} ${stream?.isLive ? "live" : stream ? "offline" : ""}`}>
      {player.champion.iconUrl ? <img src={player.champion.iconUrl} alt="" /> : <span>{championName(player.champion).slice(0, 1)}</span>}
      {stream ? (
        <em title={streamStatusLabel} aria-label={streamStatusLabel} role="img" />
      ) : null}
    </span>
  );
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
  return (
    <div className="public-team-detail" aria-label={t().teamDetails}>
      {match.teams.map((team) => (
        <section className={`public-team-card ${team.players.some((player) => player.isTarget) ? "ally" : "enemy"}`} key={`${match.matchId}:${team.teamId}`}>
          {(() => {
            const teamRankStats = team.players.map((player, index) => matchRankForPlayer(rankDetail, team.teamId, player, index));
            const tierSummary = rankLoading
              ? t().tierLoading
              : rankDetail
                ? `${t().averageTier} ${averageTierLabel(teamRankStats)}`
                : t().tierUnavailable;
            return (
              <>
          <div className="public-team-head">
            <strong>{teamLabel(team)}</strong>
            <span>{resultLabel(team.result)} · {team.kills}/{team.deaths}/{team.assists}</span>
            <div className="public-team-head-summary">
              <small>{t().gold} {formatNumber(team.goldEarned)} · {t().damage} {formatNumber(team.damageDealtToChampions)} · {objectiveLabels[activePublicLocale].champion} {formatNumber(team.kills)}</small>
              <small>{objectiveSummaryByOrder(team.objectives, ["horde", "riftHerald", "dragon", "baron", "inhibitor", "tower"])}</small>
            </div>
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
	                    <TeamChampionAvatar player={player} />
                      <PlayerLoadoutBuild spells={player.summonerSpells} runes={player.runes} dataDragonVersion={dataDragonVersion} />
	                    <div className="public-team-player-copy">
	                      <div className="public-team-player-id-line">
	                        <span
                            className={rankTierClass(rankedStats, rankLoading ? "loading" : rankedStats ? "ready" : "unknown")}
                            title={rankLoading ? t().tierLoading : rankedStats ? rankLabel(rankedStats) : t().tierUnavailable}
                          >
                            {matchRankBadgeLabel(rankedStats, rankLoading)}
                          </span>
                          <span className="public-team-player-id-stack">
	                          <SearchableRiotId
                              riotId={hideRiotIds ? undefined : player.riotId}
                              fallback={hideRiotIds ? "*" : playerDisplayName(player)}
                              badges={playerHighlightBadges}
                              streamer={player.twitchStream}
                              onSearch={onSearchRiotId}
                            />
                            <span className="public-team-mobile-kda" aria-label={t().kda}>
                              <strong>{player.kills}/{player.deaths}/{player.assists}</strong>
                              <span><KdaMetricText value={player.kda} /></span>
                            </span>
                          </span>
	                      </div>
	                    </div>
	                  </div>
	                  <PlayerItemBuild items={player.items} itemKey={`${match.matchId}:${team.teamId}:${player.riotId ?? championName(player.champion)}`} />
	                  <div className="public-team-stat kda">
	                    <strong>{player.kills}/{player.deaths}/{player.assists}</strong>
	                    <span><KdaMetricText value={player.kda} /></span>
	                  </div>
                <div className="public-team-stat" style={{ background: heatBackground(player.damageDealtToChampions, maxDamage) }}>
                  <strong>{formatNumber(player.damageDealtToChampions)}</strong>
                  <span className={metricToneClass(teamShareTone(player.damageShare))}>{t().totalDamage}</span>
                </div>
                <div className="public-team-stat" style={{ background: heatBackground(player.cs, maxCs, "green") }}>
                  <strong>{formatNumber(player.cs)}</strong>
                  <span className={metricToneClass(csTone(player.csPerMinute))}>{activePublicLocale === "ja" ? `CS · ${formatDecimal(player.csPerMinute, 1)}/分` : `CS · ${formatDecimal(player.csPerMinute, 1)}/분`}</span>
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
          <h2 data-ko={publicI18n.ko.currentGameStatus} data-ja={publicI18n.ja.currentGameStatus}>{t().currentGameStatus}</h2>
          <span className={`public-ingame-live-state ${isLive ? "live" : isUnavailable ? "unavailable" : "offline"}`}>
            <i />
            {isLive ? t().currentlyInGame : isUnavailable ? t().currentGameUnavailable : t().notInGame}
          </span>
        </div>
        <small>{t().currentGameUpdated} {formatRelativeDate(liveGame?.fetchedAt)}</small>
      </div>
      {!isLive ? (
        <div className="public-ingame-empty">
          <strong data-ko={isUnavailable ? publicI18n.ko.currentGameUnavailable : publicI18n.ko.notInGame} data-ja={isUnavailable ? publicI18n.ja.currentGameUnavailable : publicI18n.ja.notInGame}>
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
          return (
            <article className={`public-match-row ${match.result} ${highlightClass} ${expanded ? "expanded" : ""}`} key={match.matchId}>
              <div className="public-match-summary">
                <div className="public-result">
                  <b className={`public-match-result-pill ${match.result}`}>{resultLabel(match.result)}</b>
                  <strong>{match.queueId ? queueLabels[activePublicLocale][match.queueId] ?? `${t().queue} ${match.queueId}` : "-"}</strong>
                  <span className="public-match-started">{formatDate(match.startedAt)}</span>
                  <small>{resultLabel(match.result)} · {formatDuration(match.durationSeconds)}</small>
                  <em className="public-match-relative">{formatRelativeDate(match.startedAt)}</em>
                </div>
                <div className={`public-champion-cell ${highlightClass}`}>
                  {match.champion.iconUrl ? <img src={match.champion.iconUrl} alt="" /> : <span>{championName(match.champion).slice(0, 1)}</span>}
                  {match.summonerSpells.length > 0 ? (
                    <div className="public-match-mobile-spells" aria-label={t().summonerSpells}>
                      {match.summonerSpells.slice(0, 2).map((spellId) => {
                        const iconUrl = summonerSpellIconUrl(spellId, dataDragonVersion);
                        return (
                          <span key={`${match.matchId}:spell:${spellId}`}>
                            {iconUrl ? <img src={iconUrl} alt="" /> : spellId}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                  <div>
                    <strong>{championName(match.champion)}</strong>
                    <small>{mainRoleLabel(match.position)} · Lv.{formatNumber(match.championLevel)}</small>
                  </div>
                </div>
                <div className="public-kda">
                  <strong>{match.kills} / {match.deaths} / {match.assists}</strong>
                  <span><KdaMetricText value={match.kda} /></span>
                  <MatchBadges badges={match.badges} compact />
                </div>
                <div className={`public-match-score ${metricToneClass(scoreTone(aiScore))}`}>
                  <span data-ko={publicI18n.ko.aiScore} data-ja={publicI18n.ja.aiScore}>{t().aiScore}</span>
                  <strong>{aiScore}</strong>
                </div>
                <div className="public-match-meta">
                  <span>CS {formatNumber(match.cs)}</span>
                  <span><CsPerMinuteMetricText value={match.csPerMinute} /></span>
                  <span><KillParticipationMetricText value={match.killParticipation} /></span>
                </div>
                <div className="public-match-inline-items" aria-label={t().items}>
                  {recentItemSlots.map((item, index) => (
                    <span className={item ? "" : "empty"} key={`${match.matchId}:inline:${index}:${item?.itemId ?? "empty"}`}>
                      {item ? item.iconUrl ? <img src={item.iconUrl} alt="" /> : item.itemId : null}
                    </span>
                  ))}
                </div>
                <div className={`public-match-impact ${match.result} ${metricToneClass(scoreTone(aiScore))}`}>
                  <strong>{aiScore}</strong>
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
                    if (opening) {
                      setExpandedMatchViews((current) => ({ ...current, [match.matchId]: "record" }));
                      void ensureMatchRanks(match.matchId);
                    }
                  }}
                >
                  <span aria-hidden="true" />
                </button>
              </div>

              {expanded ? (
                <div className="public-match-expanded">
                  <div className="public-match-expanded-toolbar">
                    <div className="public-match-expanded-tabs" role="tablist" aria-label={t().matchDetails}>
                      <button
                        type="button"
                        className={expandedView === "record" ? "active" : ""}
                        role="tab"
                        aria-selected={expandedView === "record"}
                        onClick={() => {
                          setExpandedMatchViews((current) => ({ ...current, [match.matchId]: "record" }));
                          void ensureMatchRanks(match.matchId);
                        }}
                        data-ko={publicI18n.ko.matchRecordTab}
                        data-ja={publicI18n.ja.matchRecordTab}
                      >
                        {t().matchRecordTab}
                      </button>
                      <button
                        type="button"
                        className={expandedView === "build" ? "active" : ""}
                        role="tab"
                        aria-selected={expandedView === "build"}
                        onClick={() => {
                          setExpandedMatchViews((current) => ({ ...current, [match.matchId]: "build" }));
                          void ensureMatchBuild(match);
                        }}
                        data-ko={publicI18n.ko.matchBuildTab}
                        data-ja={publicI18n.ja.matchBuildTab}
                      >
                        {t().matchBuildTab}
                      </button>
                    </div>
                    <button
                      type="button"
                      className={`public-match-id-mask-toggle ${hideRiotIds ? "active" : ""}`}
                      aria-pressed={hideRiotIds}
                      onClick={() => setHiddenRiotIdMatches((current) => ({ ...current, [match.matchId]: !current[match.matchId] }))}
                      data-ko={hideRiotIds ? publicI18n.ko.riotIdMaskOn : publicI18n.ko.riotIdMaskOff}
                      data-ja={hideRiotIds ? publicI18n.ja.riotIdMaskOn : publicI18n.ja.riotIdMaskOff}
                    >
                      {hideRiotIds ? t().riotIdMaskOn : t().riotIdMaskOff}
                    </button>
                  </div>
                  {expandedView === "record" ? (
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
  const rows = championAnalysisRows(profile).slice(0, 5);
  const maxMasteryPoints = championAnalysisMax(rows, (row) => row.masteryPoints);
  return (
    <section id="public-champions" className="public-panel public-champion-mastery-panel">
      <div className="public-section-head">
        <h2 data-ko={publicI18n.ko.championMasteryTop5} data-ja={publicI18n.ja.championMasteryTop5}>{t().championMasteryTop5}</h2>
        <span data-ko={publicI18n.ko.masteryBasis} data-ja={publicI18n.ja.masteryBasis}>{t().masteryBasis}</span>
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
        <h2 data-ko={publicI18n.ko.championDetailStats} data-ja={publicI18n.ja.championDetailStats}>{t().championDetailStats}</h2>
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
              <div className="public-champion-analysis-metric">
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
        <h3 data-ko={publicI18n.ko.rolePerformance} data-ja={publicI18n.ja.rolePerformance}>{t().rolePerformance}</h3>
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
        <img className="public-brand-logo" src="/images/seigagg-logo.png" alt={t().brand} />
      </button>
      <nav aria-label="Seiga.GG">
        <button type="button" onClick={() => onNavigate("search")} data-ko={publicI18n.ko.searchNav} data-ja={publicI18n.ja.searchNav}>{t().searchNav}</button>
        <button type="button" onClick={() => onNavigate("ranking")} data-ko={publicI18n.ko.ranking} data-ja={publicI18n.ja.ranking}>{t().ranking}</button>
        <button type="button" onClick={() => onNavigate("champion")} data-ko={publicI18n.ko.championAnalysis} data-ja={publicI18n.ja.championAnalysis}>{t().championAnalysis}</button>
        <button type="button" onClick={() => onNavigate("stats")} data-ko={publicI18n.ko.stats} data-ja={publicI18n.ja.stats}>{t().stats}</button>
        <button type="button" onClick={() => onNavigate("promotion")} data-ko={publicI18n.ko.promotion} data-ja={publicI18n.ja.promotion}>{t().promotion}</button>
        <button type="button" onClick={() => onNavigate("community")} data-ko={publicI18n.ko.community} data-ja={publicI18n.ja.community}>{t().community}</button>
      </nav>
      <div className="public-top-actions">
        <PublicLocaleSelector locale={locale} onLocale={onLocale} onAutoLocale={onAutoLocale} />
        <button className="public-theme-button" type="button" aria-label={t().darkMode}>●</button>
        <button className="public-login-button" type="button" onClick={onOpenAdmin} data-ko={publicI18n.ko.login} data-ja={publicI18n.ja.login}>{t().login}</button>
      </div>
    </header>
  );
}

function PublicMobileNav({ onNavigate }: { onNavigate: (target: PublicNavTarget) => void }) {
  return (
    <nav className="public-mobile-nav" aria-label="Seiga.GG mobile">
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
  const [filters, setFilters] = useState<PublicMatchFilters>(DEFAULT_MATCH_FILTERS);
  const [remoteSuggestions, setRemoteSuggestions] = useState<SearchSuggestion[]>([]);
  const [profileTab, setProfileTab] = useState<PublicProfileTab>("overview");
  const [activeMainPage, setActiveMainPage] = useState<PublicMainPage>("search");
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
  const [publicTournaments, setPublicTournaments] = useState<StreamerTournament[]>([]);
  const [publicTournamentSlug, setPublicTournamentSlug] = useState<string | undefined>(() => tournamentRouteFromPublicPath()?.slug);
  const [publicTournamentLoading, setPublicTournamentLoading] = useState(false);
  const [publicTournamentError, setPublicTournamentError] = useState("");
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communitySubmitting, setCommunitySubmitting] = useState(false);
  const [communityError, setCommunityError] = useState("");
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

  function autoDetectLocale(): void {
    clearStoredLocale();
    void loadPublicLocalePreference()
      .then((preferredLocale) => {
        setLocaleState(preferredLocale ?? detectBrowserPublicLocale());
      })
      .catch(() => {
        setLocaleState(detectBrowserPublicLocale());
      });
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
    if (activeMainPage !== "subscriptions") return;
    if (!twitchStatus.connected || followedLol || followedLoading) return;
    void loadFollowedLol();
  }, [activeMainPage, twitchStatus.connected, followedLol, followedLoading]);

  useEffect(() => {
    if (!activeMainPage.startsWith("tournament")) return;
    if (publicTournaments.length > 0 || publicTournamentLoading) return;
    if (publicTournamentError) return;
    void loadPublicTournaments();
  }, [activeMainPage, publicTournaments.length, publicTournamentLoading, publicTournamentError]);

  useEffect(() => {
    if (activeMainPage !== "patch") return;
    if (communityPosts.length > 0 || communityLoading) return;
    void loadCommunityPosts();
  }, [activeMainPage, communityPosts.length, communityLoading]);

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
      const tournamentRoute = tournamentRouteFromPublicPath();
      if (tournamentRoute) {
        setActiveMainPage(tournamentRoute.page);
        setActiveNav("community");
        setPublicTournamentSlug(tournamentRoute.slug);
        void loadPublicTournaments(tournamentRoute.slug);
        return;
      }
      const riotId = riotIdFromPublicSummonerPath();
      if (!riotId) return;
      setQuery(riotId);
      void runSearch(riotId, { replaceUrl });
    };
    loadFromPath(true);
    const handlePopState = () => {
      const tournamentRoute = tournamentRouteFromPublicPath();
      if (tournamentRoute) {
        setActiveMainPage(tournamentRoute.page);
        setActiveNav("community");
        setPublicTournamentSlug(tournamentRoute.slug);
        void loadPublicTournaments(tournamentRoute.slug);
        return;
      }
      const riotId = riotIdFromPublicSummonerPath();
      if (riotId) {
        setQuery(riotId);
        void runSearch(riotId, { updateUrl: false });
        return;
      }
      setProfile(null);
      setError("");
      setFilters(DEFAULT_MATCH_FILTERS);
      setStreamerRegisterOpen(false);
      setActiveMainPage("search");
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

  async function loadCommunityPosts(): Promise<void> {
    setCommunityLoading(true);
    setCommunityError("");
    try {
      setCommunityPosts(await getPublicCommunityPosts());
    } catch (requestError) {
      setCommunityError(requestError instanceof Error ? requestError.message : t().communityLoadFailed);
    } finally {
      setCommunityLoading(false);
    }
  }

  async function submitCommunityPost(input: { title: string; body: string }): Promise<void> {
    setCommunitySubmitting(true);
    setCommunityError("");
    try {
      setCommunityPosts(await createPublicCommunityPost(input));
    } catch (requestError) {
      setCommunityError(requestError instanceof Error ? requestError.message : t().searchFailed);
    } finally {
      setCommunitySubmitting(false);
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
    setActiveNav("community");
    if (page.startsWith("tournament")) {
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
    setStreamerRegisterOpen(false);
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
    if (activeMainPage === "favorites") {
      return <PublicFavoritesPage favorites={favorites} onPick={pickSuggestion} />;
    }
    if (activeMainPage === "subscriptions") {
      return (
        <PublicSubscriptionsPage
          twitchStatus={twitchStatus}
          followed={followedLol}
          loading={followedLoading}
          error={followedError}
          onLogin={startTwitchLogin}
          onLogout={() => void disconnectTwitchViewer()}
          onRefresh={() => void loadFollowedLol()}
          onSearch={searchFollowedRiotId}
        />
      );
    }
    if (activeMainPage === "patch") {
      return (
        <PublicCommunityPage
          twitchStatus={twitchStatus}
          posts={communityPosts}
          loading={communityLoading}
          error={communityError}
          submitting={communitySubmitting}
          onLogin={startTwitchLogin}
          onRefresh={() => void loadCommunityPosts()}
          onSubmit={submitCommunityPost}
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
            showSearch={false}
            showFilters={false}
            query={query}
            loading={loading}
            suggestions={visibleSuggestions}
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
        <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
      </main>
    );
  }

  if (!profile && activeMainPage === "search") {
    return (
      <main className={`public-lol-shell public-dashboard-shell public-home-shell theme-${theme}`}>
        <section className="public-app-main">
          <PublicAppHeader
            locale={locale}
            profile={profile}
            twitchStatus={twitchStatus}
            activePage={activeMainPage}
            activeTarget={activeNav}
            showSearch={false}
            showFilters={false}
            query={query}
            loading={loading}
            suggestions={visibleSuggestions}
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
          {loading ? <SeigaSearchLoader /> : null}
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

  if (!profile) {
    return (
      <main className={`public-lol-shell public-dashboard-shell theme-${theme}`}>
        <section className="public-app-main">
          <PublicAppHeader
            locale={locale}
            profile={profile}
            twitchStatus={twitchStatus}
            activePage={activeMainPage}
            activeTarget={activeNav}
            showFilters={false}
            query={query}
            loading={loading}
            suggestions={visibleSuggestions}
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
          activePage={activeMainPage}
          activeTarget={activeNav}
          showFilters={false}
          query={query}
          loading={loading}
          suggestions={visibleSuggestions}
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
        {loading ? <SeigaSearchLoader /> : null}

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
                    onToggleFavorite={toggleFavorite}
                  />
                  {error ? <p className="public-error">{error}</p> : null}
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
                  {error ? <p className="public-error">{error}</p> : null}
                  {renderMainMenuPage()}
                </>
              )}
            </section>
          </div>
        </div>
      </section>
      <PublicPremiumDialog open={premiumOpen} onClose={() => setPremiumOpen(false)} onOpenAdmin={onOpenAdmin} />
    </main>
  );
}
