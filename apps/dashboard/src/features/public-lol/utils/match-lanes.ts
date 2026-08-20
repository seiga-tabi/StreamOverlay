import type { PublicLolMatchTeamDetail, PublicLolRecentMatch } from "../types/public-lol";

/* 전적 상세의 팀 격차 계산과 큐 판별.
 *
 * 라인 1:1 비교(matchLanePairs)는 목업 v28 에서 블루/레드 팀 상세로 대체되어
 * 제거했습니다 — 격차 스트립(matchGap)과 큐 판별 유틸만 남습니다. */

export type MatchGap = {
  gold: number;
  damage: number;
  objectives: { ally: number; enemy: number };
  /** 우리 팀 안에서 내 딜량 순위(1부터). 대상이 없으면 undefined. */
  myRank?: number;
  teamSize: number;
};

function allyTeam(match: PublicLolRecentMatch): PublicLolMatchTeamDetail | undefined {
  return match.teams.find((team) => team.players.some((player) => player.isTarget)) ?? match.teams[0];
}

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
