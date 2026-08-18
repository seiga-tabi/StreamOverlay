import type { PublicLolMatchParticipant, PublicLolMatchTeamDetail, PublicLolRecentMatch } from "../types/public-lol";

/* 전적 상세의 라인 1:1 매칭과 팀 격차 계산.
 *
 * 기존 화면은 우리 팀 5명을 세로로, 상대 5명을 그 아래 따로 나열해서
 * "내 미드 vs 상대 미드"를 보려면 화면을 위아래로 오가며 눈으로 맞춰야 했습니다.
 * 상세를 펼치는 이유 1순위가 그 비교이므로 같은 포지션끼리 한 행에 놓습니다.
 */

const LANE_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;

export type LanePosition = (typeof LANE_ORDER)[number];

export type LanePair = {
  position: LanePosition | "UNKNOWN";
  ally?: PublicLolMatchParticipant;
  enemy?: PublicLolMatchParticipant;
  /** 두 사람 사이의 비율(0~100). 상대가 없으면 100입니다. */
  damageShare: { ally: number; enemy: number };
  goldShare: { ally: number; enemy: number };
};

function normalizedPosition(value: string | undefined): LanePosition | "UNKNOWN" {
  if (!value) return "UNKNOWN";
  const upper = value.toUpperCase();
  if (upper === "MID") return "MIDDLE";
  if (upper === "ADC" || upper === "BOT") return "BOTTOM";
  if (upper === "SUPPORT") return "UTILITY";
  return (LANE_ORDER as readonly string[]).includes(upper) ? upper as LanePosition : "UNKNOWN";
}

/** 두 값의 비율. 둘 다 0이면 50:50 으로 둡니다(막대가 사라지지 않게). */
function ratio(left: number, right: number): { ally: number; enemy: number } {
  const total = Math.max(0, left) + Math.max(0, right);
  if (total <= 0) return { ally: 50, enemy: 50 };
  return {
    ally: Math.round((Math.max(0, left) / total) * 100),
    enemy: Math.round((Math.max(0, right) / total) * 100),
  };
}

function allyTeam(match: PublicLolRecentMatch): PublicLolMatchTeamDetail | undefined {
  return match.teams.find((team) => team.players.some((player) => player.isTarget));
}

/**
 * 같은 포지션끼리 짝지어 반환합니다.
 * 포지션 정보가 없는 큐(칼바람 등)는 순서대로 짝짓습니다.
 */
export function matchLanePairs(match: PublicLolRecentMatch): LanePair[] {
  const ally = allyTeam(match) ?? match.teams[0];
  const enemy = match.teams.find((team) => team !== ally);
  if (!ally) return [];

  const allyPlayers = [...ally.players];
  const enemyPlayers = [...(enemy?.players ?? [])];
  const hasPositions = allyPlayers.some((player) => normalizedPosition(player.position) !== "UNKNOWN");

  if (!hasPositions) {
    // 칼바람처럼 포지션이 없으면 명단 순서대로 맞춥니다.
    return allyPlayers.map((player, index) => {
      const foe = enemyPlayers[index];
      return {
        position: "UNKNOWN" as const,
        ally: player,
        enemy: foe,
        damageShare: ratio(player.damageDealtToChampions ?? 0, foe?.damageDealtToChampions ?? 0),
        goldShare: ratio(player.goldEarned ?? 0, foe?.goldEarned ?? 0),
      };
    });
  }

  const takeByPosition = (players: PublicLolMatchParticipant[], position: LanePosition) => {
    const index = players.findIndex((player) => normalizedPosition(player.position) === position);
    return index >= 0 ? players.splice(index, 1)[0] : undefined;
  };

  const pairs: LanePair[] = LANE_ORDER.map((position) => {
    const a = takeByPosition(allyPlayers, position);
    const e = takeByPosition(enemyPlayers, position);
    return {
      position,
      ally: a,
      enemy: e,
      damageShare: ratio(a?.damageDealtToChampions ?? 0, e?.damageDealtToChampions ?? 0),
      goldShare: ratio(a?.goldEarned ?? 0, e?.goldEarned ?? 0),
    };
  });

  // 포지션이 비어 남은 사람은 뒤에 순서대로 붙입니다.
  const leftovers = Math.max(allyPlayers.length, enemyPlayers.length);
  for (let index = 0; index < leftovers; index += 1) {
    const a = allyPlayers[index];
    const e = enemyPlayers[index];
    if (!a && !e) continue;
    pairs.push({
      position: "UNKNOWN",
      ally: a,
      enemy: e,
      damageShare: ratio(a?.damageDealtToChampions ?? 0, e?.damageDealtToChampions ?? 0),
      goldShare: ratio(a?.goldEarned ?? 0, e?.goldEarned ?? 0),
    });
  }

  return pairs.filter((pair) => pair.ally || pair.enemy);
}

export type MatchGap = {
  gold: number;
  damage: number;
  objectives: { ally: number; enemy: number };
  /** 우리 팀 안에서 내 딜량 순위(1부터). 대상이 없으면 undefined. */
  myRank?: number;
  teamSize: number;
};

const OBJECTIVE_KEYS = ["baron", "dragon", "tower", "inhibitor", "riftHerald", "horde", "atakhan"] as const;

function objectiveTotal(team: PublicLolMatchTeamDetail | undefined): number {
  if (!team?.objectives) return 0;
  return OBJECTIVE_KEYS.reduce((total, key) => total + (Number(team.objectives[key]) || 0), 0);
}

export function matchGap(match: PublicLolRecentMatch): MatchGap | undefined {
  const ally = allyTeam(match);
  const enemy = match.teams.find((team) => team !== ally);
  if (!ally) return undefined;

  const sorted = [...ally.players].sort(
    (a, b) => (b.damageDealtToChampions ?? 0) - (a.damageDealtToChampions ?? 0)
  );
  const myIndex = sorted.findIndex((player) => player.isTarget);

  return {
    gold: (ally.goldEarned ?? 0) - (enemy?.goldEarned ?? 0),
    damage: (ally.damageDealtToChampions ?? 0) - (enemy?.damageDealtToChampions ?? 0),
    objectives: { ally: objectiveTotal(ally), enemy: objectiveTotal(enemy) },
    myRank: myIndex >= 0 ? myIndex + 1 : undefined,
    teamSize: ally.players.length,
  };
}

/** 칼바람·격전처럼 CS·시야가 의미 없는 큐입니다. 1750 = 아레나 3x6(2026-08-18). */
const NO_FARM_QUEUES = new Set([65, 450, 720, 920, 2400, 1200, 1300, 1700, 1710, 1750]);

/* ── 아레나(순위전) — docs/mockups/lol-arena-match-row.html ──
 * 1700/1710 = 2인 아레나, 1750 = 아레나 3x6(3인×6팀). 승/패 대신 1~N위이며
 * raw win 은 우승 팀만 true 라 이분법 표시가 성립하지 않습니다. */
const ARENA_QUEUES = new Set([1700, 1710, 1750]);

export function isArenaQueue(queueId: number | undefined): boolean {
  return queueId !== undefined && ARENA_QUEUES.has(queueId);
}

/** 순위 → 행 톤. 상위 절반(6팀 기준 1~3위) win · 하위 loss, 1위는 골드 프레임 추가. */
export function arenaPlacementClass(placement: number): string {
  const base = placement <= 3 ? "win" : "loss";
  return placement === 1 ? `${base} arena-first` : base;
}

export function matchUsesFarmMetrics(queueId: number | undefined): boolean {
  return queueId === undefined ? true : !NO_FARM_QUEUES.has(queueId);
}

/** 아이템 구매 시각을 "12:34" 로 만듭니다. 값이 없으면 undefined 입니다. */
export function buildTimestampLabel(timestampMs: number | undefined): string | undefined {
  if (timestampMs === undefined || !Number.isFinite(timestampMs) || timestampMs < 0) return undefined;
  const totalSeconds = Math.floor(timestampMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
