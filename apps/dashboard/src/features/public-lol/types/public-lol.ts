import type { LolChampionSummary, LolPerformanceStats, LolRankHistoryPoint, LolRankedStats, LolRole, LolRoleAnalysis, ParticipationStatus, StreamerRiotIdRequest } from "@streamops/shared";

export type PublicLolMatchParticipant = {
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
  runes: Array<{
    runeId: number;
    nameKo?: string;
    nameJa?: string;
    iconUrl?: string;
    kind: "primary" | "secondary" | "stat";
    category?: "style" | "keystone" | "perk" | "offense" | "flex" | "defense";
  }>;
  badges?: PublicLolMatchBadge[];
};

export type PublicLolMatchTeamDetail = {
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

export type PublicLolMatchRankParticipant = {
  riotId?: string;
  teamId?: number;
  championId: number;
  position?: string;
  rankedStats?: LolRankedStats;
};

export type PublicLolMatchRankResponse = {
  status: "ready";
  matchId: string;
  participants: PublicLolMatchRankParticipant[];
  fetchedAt: string;
};

export type PublicLolMatchBuildItemEvent = {
  itemId: number;
  iconUrl?: string;
  timestampMs: number;
};

export type PublicLolMatchBuildSkillEvent = {
  slot: number;
  key: "Q" | "W" | "E" | "R";
  level: number;
  timestampMs: number;
  nameKo?: string;
  nameJa?: string;
  iconUrl?: string;
};

export type PublicLolMatchBuildParticipant = {
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

export type PublicLolMatchBuildResponse = {
  status: "ready";
  matchId: string;
  dataDragonVersion?: string;
  participants: PublicLolMatchBuildParticipant[];
  fetchedAt: string;
};

export type PublicLolMatchBadgeCode = "mvp" | "ace" | "unstoppable" | "tenacity" | "damage_carry" | "objective" | "vision";

export type PublicLolMatchBadge = {
  code: PublicLolMatchBadgeCode;
  score?: number;
  rank?: number;
};

export type PublicLolRecentMatch = {
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

export type PublicLolChampionPerformance = {
  champion: LolChampionSummary;
  games: number;
  wins: number;
  winRate: number;
  averageKda: number;
  averageCsPerMinute?: number;
  averageDamagePerMinute?: number;
};

export type PublicChampionAnalysisRow = {
  champion: LolChampionSummary;
  masteryRank?: number;
  masteryLevel?: number;
  masteryPoints?: number;
  performance?: PublicLolChampionPerformance;
};

export type PublicLolRolePerformance = {
  role: string;
  games: number;
  wins: number;
  winRate: number;
  averageKda: number;
};

export type PublicProfileLink = {
  id?: string;
  url: string;
  label: string;
  platform?: string;
};

export type PublicLolTwitchStream = {
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

export type PublicTwitchViewerStatus = {
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

export type PublicTwitchFollowedLolChannel = {
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

export type PublicTwitchSubscriptionChannel = {
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

export type PublicTwitchFollowedLolResponse = {
  connected: boolean;
  total?: number;
  truncated: boolean;
  matchedCount: number;
  subscriptionScopeGranted: boolean;
  subscriptions: PublicTwitchSubscriptionChannel[];
  channels: PublicTwitchFollowedLolChannel[];
};

export type PublicParticipationQueueItem = {
  position: number;
  twitchUserName: string;
  preferredRole?: LolRole;
  requestedRole?: LolRole;
  status: ParticipationStatus;
  profileStatus?: string;
  mainRole?: string;
  mainRoleConfidence?: number;
  rankedStats?: LolRankedStats;
  topChampions?: LolChampionSummary[];
  isViewer: boolean;
};

export type PublicParticipationViewerEntry = PublicParticipationQueueItem & {
  riotId: string;
  source: string;
};

export type PublicParticipationStreamer = {
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

export type PublicParticipationStateResponse = {
  connected: boolean;
  configured: boolean;
  isOpen: boolean;
  summary: {
    total: number;
    active: number;
    waiting: number;
    selected: number;
    checkedIn: number;
    noShow: number;
    played: number;
  };
  streamers: PublicParticipationStreamer[];
  selectedStreamerId?: string;
  queue: PublicParticipationQueueItem[];
  viewerEntry?: PublicParticipationViewerEntry;
  maxQueueSize: number;
  updatedAt: string;
};

export type PublicParticipationJoinResponse = {
  ok: true;
  alreadyJoined: boolean;
  reused: boolean;
  state: PublicParticipationStateResponse;
  entry?: PublicParticipationViewerEntry;
};

export type PublicParticipationCancelResponse = {
  ok: true;
  state: PublicParticipationStateResponse;
};

export type PublicLolCurrentGameParticipant = {
  riotId?: string;
  isTarget: boolean;
  teamId: number;
  summonerSpells: number[];
  profileIconUrl?: string;
  rankedStats?: LolRankedStats;
  bot?: boolean;
  champion: LolChampionSummary;
};

export type PublicLolCurrentGame = {
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

export type PublicLolMatchPageResponse = {
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

export type PublicRecentRecord = {
  title: string;
  value: number | undefined;
  unit: string;
  match?: PublicLolRecentMatch;
  champion?: LolChampionSummary;
};

export type PublicTrendPoint = {
  key: string;
  x: number;
  y: number;
  value: number;
  label: string;
  result: PublicLolRecentMatch["result"];
};

export type PublicTrendTierBand = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  className: string;
};

export type PublicTrendTierBoundary = {
  key: string;
  x1: number;
  x2: number;
  y: number;
};

export type PublicTrendLine = {
  points: PublicTrendPoint[];
  tierBands: PublicTrendTierBand[];
  tierBoundaries: PublicTrendTierBoundary[];
  linePoints: string;
  areaPath: string;
  yLabels: string[];
  startLabel: string;
  middleLabel: string;
  endLabel: string;
};

export type PublicRecentChampionSummary = {
  champion: LolChampionSummary;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  averageKda: number;
};

export type PublicLolProfile = {
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

export type TournamentPlayerProfileState = {
  status: "loading" | "ready" | "error";
  profile?: PublicLolProfile;
  error?: string;
};

export type CommunityPostProfileState = {
  riotId?: string;
  status: "idle" | "loading" | "ready" | "error";
  profile?: PublicLolProfile;
  error?: string;
};

export type SearchSuggestion = {
  gameName: string;
  tagLine: string;
  source: "input" | "recommended" | "recent" | "verified";
  profileIconUrl?: string;
  summonerLevel?: number;
  lolPlatform?: string;
  rankedStats?: LolRankedStats;
  lastSeenAt?: string;
};

export type PublicNavTarget = "search" | "ranking" | "champion" | "stats" | "ingame" | "promotion" | "community";

export type PublicMainPage = "search" | "subscriptions" | "followJoin" | "patch" | "communityParty" | "communityServerWrite" | "communityPartyWrite" | "communityDetail" | "tournamentCalendar" | "tournamentList" | "tournamentNews" | "tournamentTeams" | "tournamentBracket" | "tournamentSchedule" | "privacy" | "terms" | "contact";

export type PublicProfileTab = "overview" | "champions" | "ingame";

export type PublicExpandedMatchView = "record" | "build";

export type PublicTheme = "light" | "dark";

export type MatchQueueFilter = "all" | "solo" | "flex" | "ranked5v5" | "normal" | "aram";

export type MatchPeriodFilter = "all" | "7d" | "30d";

export type PublicMatchFilters = {
  queue: MatchQueueFilter;
  championId: string;
  period: MatchPeriodFilter;
};

export type PublicFavorite = SearchSuggestion & {
  recentGames?: number;
  recentWins?: number;
  recentWinRate?: number;
  averageKda?: number;
};
