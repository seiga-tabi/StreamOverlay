import type { PublicLolRecentMatch, PublicLolRolePerformance } from "../types/public-lol";

/* 프로필 공유 카드의 라인·챔피언 집계 — 목업 docs/mockups/lol-profile-share-card.html §④.
 *
 * 라인별 주력 챔피언은 서버 계약을 늘리지 않고 이미 받은 최근 경기(recentMatches)를
 * position×champion 으로 집계합니다(옵션 A). 표본이 "불러온 최근 경기"뿐이라
 * 카드 푸터에 "최근 N경기 기준"을 반드시 함께 그립니다 — 시즌 전체로 오해되면
 * 안 됩니다. 시즌 집계가 필요해지면 서버 계약(옵션 B)으로 승격합니다. */

export type ProfileShareLaneChampion = {
  championId: number;
  name: string;
  iconUrl?: string;
  games: number;
  wins: number;
  winRate: number;
};

export type ProfileShareLaneStat = {
  role: string;
  games: number;
  wins: number;
  winRate: number;
  kda: number;
  champions: ProfileShareLaneChampion[];
};

/** 라인 표기를 하나로 모읍니다 — MID/MIDDLE, BOTTOM/ADC, UTILITY/SUPPORT 가 섞여 옵니다. */
export function normalizeShareRole(role: string | undefined): string {
  const value = (role ?? "").toUpperCase();
  if (value === "MID") return "MIDDLE";
  if (value === "ADC") return "BOTTOM";
  if (value === "SUPPORT") return "UTILITY";
  return value;
}

/** 부 라인으로 인정하는 최소 표본 — 이보다 적으면 카드에서 블록을 생략합니다(목업 §⑤). */
export const PROFILE_SHARE_MIN_SUB_LANE_GAMES = 3;

/**
 * rolePerformance(서버 집계)로 주·부 라인을 정하고, 각 라인의 주력 챔피언을
 * 최근 경기에서 집계합니다. rolePerformance 가 비어 있으면 최근 경기만으로
 * 라인 순위를 만들어 폴백합니다(둘 다 없으면 undefined — 빈 블록을 그리지 않습니다).
 */
export function profileShareLanes(
  rolePerformance: PublicLolRolePerformance[],
  recentMatches: PublicLolRecentMatch[],
  championName: (champion: PublicLolRecentMatch["champion"]) => string,
): { main?: ProfileShareLaneStat; sub?: ProfileShareLaneStat } {
  const byRole = new Map<string, { games: number; wins: number; kdaSum: number; champions: Map<number, ProfileShareLaneChampion> }>();

  for (const match of recentMatches) {
    const role = normalizeShareRole(match.position);
    if (!role || role === "UNKNOWN") continue;
    const bucket = byRole.get(role) ?? { games: 0, wins: 0, kdaSum: 0, champions: new Map() };
    bucket.games += 1;
    if (match.result === "win") bucket.wins += 1;
    bucket.kdaSum += Number.isFinite(match.kda) ? match.kda : 0;
    const championId = match.champion.championId;
    const champion = bucket.champions.get(championId) ?? {
      championId,
      name: championName(match.champion),
      iconUrl: match.champion.iconUrl,
      games: 0,
      wins: 0,
      winRate: 0,
    };
    champion.games += 1;
    if (match.result === "win") champion.wins += 1;
    champion.winRate = Math.round((champion.wins / champion.games) * 100);
    bucket.champions.set(championId, champion);
    byRole.set(role, bucket);
  }

  /* 라인 순위는 서버 집계(rolePerformance)를 우선합니다 — 표본이 최근 경기보다 넓습니다.
     동률이면 승률이 높은 쪽이 주 라인(목업 §④). */
  const ranked = rolePerformance.length > 0
    ? [...rolePerformance]
      .map((entry) => ({ role: normalizeShareRole(entry.role), games: entry.games, wins: entry.wins, winRate: entry.winRate }))
      .filter((entry) => entry.role && entry.role !== "UNKNOWN" && entry.games > 0)
      .sort((a, b) => (b.games - a.games) || (b.winRate - a.winRate))
    : [...byRole.entries()]
      .map(([role, bucket]) => ({
        role,
        games: bucket.games,
        wins: bucket.wins,
        winRate: Math.round((bucket.wins / bucket.games) * 100),
      }))
      .sort((a, b) => (b.games - a.games) || (b.winRate - a.winRate));

  const performanceByRole = new Map(
    rolePerformance.map((entry) => [normalizeShareRole(entry.role), entry] as const),
  );
  const toLane = (entry: { role: string; games: number; wins: number; winRate: number }): ProfileShareLaneStat => {
    const bucket = byRole.get(entry.role);
    const champions = [...(bucket?.champions.values() ?? [])]
      .sort((a, b) => (b.games - a.games) || (b.winRate - a.winRate))
      .slice(0, 3);
    return {
      role: entry.role,
      games: entry.games,
      wins: entry.wins,
      winRate: Math.round(entry.winRate),
      /* KDA 는 라인 성과(games·winRate)와 같은 표본에서 와야 카드 한 줄이 앞뒤가
         맞습니다 — rolePerformance 가 있으면 그 평균 KDA, 없으면 최근 경기 평균. */
      kda: performanceByRole.get(entry.role)?.averageKda
        ?? (bucket && bucket.games > 0 ? bucket.kdaSum / bucket.games : 0),
      champions,
    };
  };

  const main = ranked[0] ? toLane(ranked[0]) : undefined;
  const subCandidate = ranked[1] ? toLane(ranked[1]) : undefined;
  const sub = subCandidate && subCandidate.games >= PROFILE_SHARE_MIN_SUB_LANE_GAMES ? subCandidate : undefined;
  return { main, sub };
}
