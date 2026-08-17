import type { LolChampionSummary } from "@streamops/shared";
import type {
  MatchPeriodFilter,
  MatchQueueFilter,
  PublicChampionAnalysisRow,
  PublicLolChampionPerformance,
  PublicLolMatchPageResponse,
  PublicLolMatchBadge,
  PublicLolProfile,
  PublicLolRecentMatch,
  PublicLolRolePerformance,
  PublicMatchFilters,
} from "../types/public-lol";

export function compactMatchBadgeSelection(badges: PublicLolMatchBadge[]): {
  visibleBadges: PublicLolMatchBadge[];
  overflowCount: number;
} {
  const priorityBadge = badges.find((badge) => badge.code === "mvp")
    ?? badges.find((badge) => badge.code === "ace");
  const visibleBadges = priorityBadge ? [priorityBadge] : [];
  return {
    visibleBadges,
    overflowCount: Math.max(0, badges.length - visibleBadges.length)
  };
}

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

/* 챔피언 분석 리디자인(목업 lol-champion-analysis-redesign.html v3)의 데이터 계층.
 * 최근 성과가 있는 행(games desc)과 숙련도만 있는 ghost 행을 분리합니다 —
 * 이전 UI 처럼 한 표에 섞으면 최근 미플레이 챔피언이 "-" 를 반복해 표가 비어 보입니다. */
export function championAnalysisTableRows(profile: PublicLolProfile): {
  active: PublicChampionAnalysisRow[];
  ghosts: PublicChampionAnalysisRow[];
} {
  const rows = championAnalysisRows(profile);
  const active = rows
    .filter((row) => row.performance)
    .sort((a, b) =>
      (b.performance!.games - a.performance!.games) ||
      (b.performance!.winRate - a.performance!.winRate) ||
      ((b.masteryPoints ?? 0) - (a.masteryPoints ?? 0))
    );
  const ghosts = rows
    .filter((row) => !row.performance)
    .sort((a, b) => (b.masteryPoints ?? 0) - (a.masteryPoints ?? 0));
  return { active, ghosts };
}

export const CHAMPION_FORM_MIN_GAMES = 3;

/* ── 시그니처 빌드(목업 lol-signature-builds.html v4) ──────────────────────
 * 숙련도 상위 챔피언의 "룬 페이지별 조건부 아이템 채용률"을 이미 받은
 * 최근 매치의 items·runes 로만 집계합니다(추가 API 없음, 서버 계약 그대로).
 * 아이템 채용률의 분모는 전체 게임이 아니라 그 룬 페이지를 채용한 게임 수입니다. */

export const SIGNATURE_BUILD_MIN_GAMES = 2;
export const SIGNATURE_BUILD_MAX_CHAMPIONS = 3;
export const SIGNATURE_BUILD_MAX_GHOSTS = 2;
const SIGNATURE_BUILD_MAX_GROUPS = 2;
const SIGNATURE_BUILD_MAX_ITEMS = 5;
/* 트링킷(장신구) 슬롯 — 빌드가 아니므로 집계에서 제외합니다. */
const TRINKET_SLOT = 6;

/* 신발 강조 표시용 정적 ID 집합 — 응답에 아이템 태그가 없어 ID 로 식별합니다.
 * 표시(테두리 강조)에만 쓰며 집계·정렬에는 영향이 없어, 신규 신발이 나와도
 * 강조만 빠질 뿐 데이터는 정상 표시됩니다. */
const BOOT_ITEM_IDS = new Set([1001, 2422, 3005, 3006, 3009, 3010, 3013, 3020, 3047, 3111, 3117, 3158]);

export function isBootItem(itemId: number): boolean {
  return BOOT_ITEM_IDS.has(itemId);
}

type SignatureRune = { runeId: number; nameKo?: string; nameJa?: string; iconUrl?: string };

export type SignatureBuildItemStat = {
  itemId: number;
  nameKo?: string;
  nameJa?: string;
  iconUrl?: string;
  games: number;
};

export type SignatureBuildGroup = {
  key: string;
  keystone?: SignatureRune;
  primaryStyle?: SignatureRune;
  secondaryStyle?: SignatureRune;
  games: number;
  wins: number;
  items: SignatureBuildItemStat[];
};

export type SignatureBuildEntry = {
  champion: LolChampionSummary;
  masteryRank?: number;
  masteryLevel?: number;
  masteryPoints?: number;
  games: number;
  wins: number;
  winRate: number;
  groups: SignatureBuildGroup[];
  /* 상위 그룹에 들지 못한 게임 수("기타 조합"). */
  otherGames: number;
};

function runeOfMatch(match: PublicLolRecentMatch, kind: "primary" | "secondary", category: "keystone" | "style"): SignatureRune | undefined {
  /* 타입상 필수지만 과거 캐시·부분 응답에서 빠질 수 있어 방어합니다(빈 배열 = 룬 없음 → 기타 그룹행). */
  const rune = (match.runes ?? []).find((entry) => entry.kind === kind && entry.category === category);
  if (!rune) return undefined;
  return { runeId: rune.runeId, nameKo: rune.nameKo, nameJa: rune.nameJa, iconUrl: rune.iconUrl };
}

function buildGroupsFromMatches(matches: PublicLolRecentMatch[]): { groups: SignatureBuildGroup[]; otherGames: number } {
  const grouped = new Map<string, { keystone?: SignatureRune; primaryStyle?: SignatureRune; secondaryStyle?: SignatureRune; matches: PublicLolRecentMatch[] }>();
  for (const match of matches) {
    const keystone = runeOfMatch(match, "primary", "keystone");
    const primaryStyle = runeOfMatch(match, "primary", "style");
    const secondaryStyle = runeOfMatch(match, "secondary", "style");
    /* keystone 이 없는 매치(룬 데이터 누락)는 그룹을 만들지 않고 "기타"로 보냅니다. */
    const key = keystone ? `${keystone.runeId}:${primaryStyle?.runeId ?? 0}:${secondaryStyle?.runeId ?? 0}` : "";
    if (!key) continue;
    const existing = grouped.get(key) ?? { keystone, primaryStyle, secondaryStyle, matches: [] };
    existing.matches.push(match);
    grouped.set(key, existing);
  }

  const candidates = [...grouped.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .filter((group) => group.matches.length >= SIGNATURE_BUILD_MIN_GAMES)
    .sort((a, b) =>
      (b.matches.length - a.matches.length) ||
      (b.matches.filter((match) => match.result === "win").length - a.matches.filter((match) => match.result === "win").length)
    )
    .slice(0, SIGNATURE_BUILD_MAX_GROUPS);

  const groups = candidates.map((group) => {
    const itemCounts = new Map<number, SignatureBuildItemStat>();
    for (const match of group.matches) {
      /* 같은 매치에 같은 아이템 중복 슬롯(소모품 등)은 1회로 셉니다. */
      const seen = new Set<number>();
      for (const item of match.items ?? []) {
        if (item.slot === TRINKET_SLOT || item.itemId <= 0 || seen.has(item.itemId)) continue;
        seen.add(item.itemId);
        const existing = itemCounts.get(item.itemId) ?? { itemId: item.itemId, nameKo: item.nameKo, nameJa: item.nameJa, iconUrl: item.iconUrl, games: 0 };
        existing.games += 1;
        itemCounts.set(item.itemId, existing);
      }
    }
    return {
      key: group.key,
      keystone: group.keystone,
      primaryStyle: group.primaryStyle,
      secondaryStyle: group.secondaryStyle,
      games: group.matches.length,
      wins: group.matches.filter((match) => match.result === "win").length,
      items: [...itemCounts.values()].sort((a, b) => b.games - a.games).slice(0, SIGNATURE_BUILD_MAX_ITEMS)
    };
  });

  const coveredGames = groups.reduce((sum, group) => sum + group.games, 0);
  return { groups, otherGames: matches.length - coveredGames };
}

export function signatureBuilds(profile: PublicLolProfile): {
  entries: SignatureBuildEntry[];
  ghosts: PublicChampionAnalysisRow[];
} {
  const rows = championAnalysisRows(profile);
  const matchesByChampion = new Map<number, PublicLolRecentMatch[]>();
  for (const match of profile.recentMatches) {
    const list = matchesByChampion.get(match.champion.championId) ?? [];
    list.push(match);
    matchesByChampion.set(match.champion.championId, list);
  }

  /* 후보 = 숙련도/성과 행(숙련도 순) + 행에 없지만 최근 매치에만 있는 챔피언(게임 수 순).
     championPerformance 가 아직 안 채워진 호출 경로에서도 매치만으로 동작해야 합니다. */
  const covered = new Set(rows.map((row) => row.champion.championId));
  const matchOnly = [...matchesByChampion.entries()]
    .filter(([championId]) => !covered.has(championId))
    .sort((a, b) => b[1].length - a[1].length)
    .map(([, list]) => ({ champion: list[0]!.champion } as PublicChampionAnalysisRow));
  const candidates = [...rows, ...matchOnly];

  const entries: SignatureBuildEntry[] = [];
  const ghosts: PublicChampionAnalysisRow[] = [];
  for (const row of candidates) {
    const matches = matchesByChampion.get(row.champion.championId) ?? [];
    if (matches.length >= SIGNATURE_BUILD_MIN_GAMES) {
      if (entries.length >= SIGNATURE_BUILD_MAX_CHAMPIONS) continue;
      const wins = matches.filter((match) => match.result === "win").length;
      const { groups, otherGames } = buildGroupsFromMatches(matches);
      entries.push({
        champion: row.champion,
        masteryRank: row.masteryRank,
        masteryLevel: row.masteryLevel,
        masteryPoints: row.masteryPoints,
        games: matches.length,
        wins,
        winRate: Math.round((wins / matches.length) * 100),
        groups,
        otherGames
      });
    } else if (row.masteryRank !== undefined && ghosts.length < SIGNATURE_BUILD_MAX_GHOSTS) {
      /* 숙련도 상위인데 최근 표본이 부족한 챔피언 — 펼칠 내용이 없는 ghost 행. */
      ghosts.push(row);
    }
  }
  return { entries, ghosts };
}

/* 스포트라이트 — 시그니처(숙련도 1위, 항상 topChampions[0] 기준)와
 * 최근 폼(3게임 이상 중 최고 승률, 동률이면 게임 수 많은 쪽). 표본 3게임 미만은
 * 폼으로 세우지 않습니다(1승 0패 100% 같은 과신 방지). 시그니처와 같은 챔피언은
 * 폼 후보에서 제외합니다 — 두 타일이 같은 챔피언이면 중복 정보라, 시그니처 타일이
 * 이미 최근 승률을 보여주므로 폼은 그다음으로 잘 풀리는 챔피언을 세웁니다. */
export function championSpotlights(profile: PublicLolProfile): {
  signature?: PublicChampionAnalysisRow;
  form?: PublicLolChampionPerformance;
} {
  const rows = championAnalysisRows(profile);
  const signature = rows.find((row) => row.masteryRank === 1);
  let form: PublicLolChampionPerformance | undefined;
  for (const performance of profile.championPerformance) {
    if (performance.games < CHAMPION_FORM_MIN_GAMES) continue;
    if (signature && performance.champion.championId === signature.champion.championId) continue;
    if (!form || performance.winRate > form.winRate || (performance.winRate === form.winRate && performance.games > form.games)) {
      form = performance;
    }
  }
  return { signature, form };
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
  /* 710 = 신규 특별 랭크 모드(실측) — 솔로·자유는 각자 칩이 담당합니다. */
  if (queue === "ranked5v5") return match.queueId === 710;
  if (queue === "normal") return match.queueId === 400 || match.queueId === 430;
  if (queue === "aram") return match.queueId === 450;
  /* 2300 = 아수라장 실측 id(2026-08-17) — queues.json 의 2400 문서값과 다릅니다. */
  if (queue === "aramMayhem") return match.queueId === 2300;
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
    (filters.championId === "all" || String(match.champion.championId) === filters.championId) &&
    (filters.augmentId === undefined || (match.augments ?? []).includes(filters.augmentId))
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

export function matchPageWithAdditionalPage(
  current: PublicLolMatchPageResponse,
  page: PublicLolMatchPageResponse
): PublicLolMatchPageResponse {
  const matches = new Map<string, PublicLolRecentMatch>();
  for (const match of current.recentMatches) matches.set(match.matchId, match);
  for (const match of page.recentMatches) matches.set(match.matchId, match);
  return {
    ...current,
    fetchedAt: page.fetchedAt,
    recentMatches: [...matches.values()],
    recentMatchStart: 0,
    nextRecentMatchStart: page.nextRecentMatchStart,
    hasMoreRecentMatches: page.hasMoreRecentMatches
  };
}

export function profileWithDynamicState(
  profile: PublicLolProfile,
  next: Pick<PublicLolProfile, "riotId" | "twitchStream" | "liveGame" | "refreshAvailableAt">
): PublicLolProfile {
  if (profile.riotId !== next.riotId) return profile;
  return {
    ...profile,
    twitchStream: next.twitchStream,
    liveGame: next.liveGame,
    ...(Object.prototype.hasOwnProperty.call(next, "refreshAvailableAt")
      ? { refreshAvailableAt: next.refreshAvailableAt }
      : {})
  };
}

export function profileWithPreservedStreamerStateAfterRefresh(
  current: PublicLolProfile | null,
  refreshed: PublicLolProfile
): PublicLolProfile {
  if (
    !current
    || current.riotId !== refreshed.riotId
    || current.lolPlatform !== refreshed.lolPlatform
    || Object.prototype.hasOwnProperty.call(refreshed, "twitchStream")
  ) {
    return refreshed;
  }
  return {
    ...refreshed,
    twitchStream: current.twitchStream
  };
}

export function hasActiveFilters(filters: PublicMatchFilters): boolean {
  return filters.queue !== "all" || filters.championId !== "all" || filters.period !== "all";
}
