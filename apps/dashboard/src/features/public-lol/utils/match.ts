import type { LolChampionSummary } from "@streamops/shared";
import type {
  MatchPeriodFilter,
  MatchQueueFilter,
  PublicChampionAnalysisRow,
  PublicLolChampionPerformance,
  PublicLolMatchPageResponse,
  PublicLolProfile,
  PublicLolRecentMatch,
  PublicLolRolePerformance,
  PublicMatchFilters,
} from "../types/public-lol";

export function safeRecordValue(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : -1;
}

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function averageNumbers(values: Array<number | undefined>, digits: number): number | undefined {
  const numeric = values.filter((value): value is number => value !== undefined && Number.isFinite(value));
  if (numeric.length === 0) return undefined;
  return roundTo(numeric.reduce((sum, value) => sum + value, 0) / numeric.length, digits);
}

export function kdaFromTotals(kills: number, deaths: number, assists: number): number {
  return roundTo(deaths <= 0 ? kills + assists : (kills + assists) / deaths, 2);
}

export function winRateFromTotals(wins: number, games: number): number {
  if (games <= 0) return 0;
  return Math.round((wins / games) * 100);
}

export function summarizeMatches(matches: PublicLolRecentMatch[]): PublicLolProfile["summary"] {
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

export function championPerformanceFromMatches(matches: PublicLolRecentMatch[]): PublicLolChampionPerformance[] {
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

export function championAnalysisRows(profile: PublicLolProfile): PublicChampionAnalysisRow[] {
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

export function championAnalysisMax(rows: PublicChampionAnalysisRow[], value: (row: PublicChampionAnalysisRow) => number | undefined): number {
  return Math.max(1, ...rows.map((row) => value(row) ?? 0));
}

export function rolePerformanceFromMatches(matches: PublicLolRecentMatch[]): PublicLolRolePerformance[] {
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

export function queueMatchesFilter(match: PublicLolRecentMatch, queue: MatchQueueFilter): boolean {
  if (queue === "all") return true;
  if (queue === "solo") return match.queueId === 420;
  if (queue === "flex") return match.queueId === 440;
  if (queue === "ranked5v5") return match.queueId === 42 || match.queueId === 6;
  if (queue === "normal") return match.queueId === 400 || match.queueId === 430;
  if (queue === "aram") return match.queueId === 450;
  return true;
}

export function periodMatchesFilter(match: PublicLolRecentMatch, period: MatchPeriodFilter): boolean {
  if (period === "all") return true;
  const startedAt = Date.parse(match.startedAt ?? "");
  if (!Number.isFinite(startedAt)) return false;
  const days = period === "7d" ? 7 : 30;
  return Date.now() - startedAt <= days * 24 * 60 * 60 * 1000;
}

export function filteredMatches(profile: PublicLolProfile, filters: PublicMatchFilters): PublicLolRecentMatch[] {
  return profile.recentMatches.filter((match) => (
    queueMatchesFilter(match, filters.queue) &&
    periodMatchesFilter(match, filters.period) &&
    (filters.championId === "all" || String(match.champion.championId) === filters.championId)
  ));
}

export function profileWithMatches(profile: PublicLolProfile, matches: PublicLolRecentMatch[]): PublicLolProfile {
  return {
    ...profile,
    recentMatches: matches,
    summary: summarizeMatches(matches),
    championPerformance: championPerformanceFromMatches(matches),
    rolePerformance: rolePerformanceFromMatches(matches)
  };
}

export function profileWithAdditionalMatchPage(profile: PublicLolProfile, page: PublicLolMatchPageResponse): PublicLolProfile {
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

export function profileWithDynamicState(profile: PublicLolProfile, next: PublicLolProfile): PublicLolProfile {
  if (profile.riotId !== next.riotId) return profile;
  return {
    ...profile,
    twitchStream: next.twitchStream,
    liveGame: next.liveGame,
    refreshAvailableAt: next.refreshAvailableAt
  };
}

export function hasActiveFilters(filters: PublicMatchFilters): boolean {
  return filters.queue !== "all" || filters.championId !== "all" || filters.period !== "all";
}
