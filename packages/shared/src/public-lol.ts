import type { LolChampionSummary, LolRankedStats } from "./participation.js";

const PUBLIC_LOL_RANK_QUEUES = [
  "RANKED_SOLO_5x5",
  "RANKED_FLEX_SR",
  "RANKED_TEAM_5x5",
  "UNRANKED"
] as const;

const PUBLIC_LOL_RANK_TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
  "UNRANKED"
] as const;

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

/* 전체 챔피언 목록(GET /api/lol/champions) — Data Dragon 챔피언 맵을 그대로 내보냅니다.
 *
 * 라인(탑·정글·미드·원딜·서포터) 대표 역할과 "최근 업데이트" 시각은 Data Dragon 이
 * 주지 않으므로 이 계약에 없습니다. 없는 값을 추정해 채우지 않습니다 — 역할 축이
 * 필요해지면 전적 집계(lol_champion_match_builds)의 포지션 분포를 내려주는 별도
 * 계약을 새로 맺어야 합니다. */
export type LolChampionListResponse = {
  /** 아이콘 URL 조립·캐시 검증용 Data Dragon 버전("15.x.y"). */
  dataDragonVersion: string;
  /** championId 오름차순이 아니라 Data Dragon 응답 순서 그대로(정렬은 화면이 정합니다). */
  champions: LolChampionSummary[];
};

function exactRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return Object.keys(record).every((key) => allowedKeys.includes(key)) ? record : undefined;
}

function boundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && !/[\u0000-\u001f\u007f]/u.test(value);
}

function isoTimestamp(value: unknown): value is string {
  if (!boundedString(value, 64)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function boundedInteger(value: unknown, maximum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum;
}

function parseLolRankedStats(value: unknown): LolRankedStats | undefined {
  const record = exactRecord(value, [
    "queueType",
    "tier",
    "rank",
    "leaguePoints",
    "wins",
    "losses",
    "winRate",
    "summonerLevel",
    "profileIconId",
    "tierIconUrl",
    "fetchedAt"
  ]);
  if (
    !record
    || !PUBLIC_LOL_RANK_QUEUES.includes(record.queueType as typeof PUBLIC_LOL_RANK_QUEUES[number])
    || !PUBLIC_LOL_RANK_TIERS.includes(record.tier as typeof PUBLIC_LOL_RANK_TIERS[number])
    || (record.rank !== undefined && !boundedString(record.rank, 16))
    || !boundedInteger(record.leaguePoints, 100_000)
    || !boundedInteger(record.wins, 10_000_000)
    || !boundedInteger(record.losses, 10_000_000)
    || typeof record.winRate !== "number"
    || !Number.isFinite(record.winRate)
    || record.winRate < 0
    || record.winRate > 100
    || (record.summonerLevel !== undefined && !boundedInteger(record.summonerLevel, 100_000))
    || (record.profileIconId !== undefined && !boundedInteger(record.profileIconId, 1_000_000_000))
    || (record.tierIconUrl !== undefined && !boundedString(record.tierIconUrl, 2_048))
    || !isoTimestamp(record.fetchedAt)
  ) return undefined;

  return {
    queueType: record.queueType as LolRankedStats["queueType"],
    tier: record.tier as LolRankedStats["tier"],
    ...(record.rank !== undefined ? { rank: record.rank as string } : {}),
    leaguePoints: record.leaguePoints as number,
    wins: record.wins as number,
    losses: record.losses as number,
    winRate: record.winRate,
    ...(record.summonerLevel !== undefined ? { summonerLevel: record.summonerLevel as number } : {}),
    ...(record.profileIconId !== undefined ? { profileIconId: record.profileIconId as number } : {}),
    ...(record.tierIconUrl !== undefined ? { tierIconUrl: record.tierIconUrl as string } : {}),
    fetchedAt: record.fetchedAt
  };
}

function parseMatchRankParticipant(value: unknown): PublicLolMatchRankParticipant | undefined {
  const record = exactRecord(value, ["riotId", "teamId", "championId", "position", "rankedStats"]);
  if (
    !record
    || (record.riotId !== undefined && !boundedString(record.riotId, 200))
    || (record.teamId !== undefined && !boundedInteger(record.teamId, 10_000))
    || !boundedInteger(record.championId, 100_000)
    || (record.position !== undefined && !boundedString(record.position, 32))
  ) return undefined;
  const rankedStats = record.rankedStats === undefined ? undefined : parseLolRankedStats(record.rankedStats);
  if (record.rankedStats !== undefined && !rankedStats) return undefined;
  return {
    ...(record.riotId !== undefined ? { riotId: record.riotId as string } : {}),
    ...(record.teamId !== undefined ? { teamId: record.teamId as number } : {}),
    championId: record.championId as number,
    ...(record.position !== undefined ? { position: record.position as string } : {}),
    ...(rankedStats ? { rankedStats } : {})
  };
}

/** 공개 match-ranks 응답을 exact·bounded schema로 검증합니다. */
export function parsePublicLolMatchRankResponse(value: unknown): PublicLolMatchRankResponse | undefined {
  const record = exactRecord(value, ["status", "matchId", "participants", "fetchedAt"]);
  if (
    !record
    || record.status !== "ready"
    || !boundedString(record.matchId, 96)
    || !/^[A-Z0-9_]+$/iu.test(record.matchId)
    || !Array.isArray(record.participants)
    || record.participants.length > 20
    || !isoTimestamp(record.fetchedAt)
  ) return undefined;
  const participants = record.participants.map(parseMatchRankParticipant);
  if (participants.some((participant) => !participant)) return undefined;
  return {
    status: "ready",
    matchId: record.matchId,
    participants: participants as PublicLolMatchRankParticipant[],
    fetchedAt: record.fetchedAt
  };
}
