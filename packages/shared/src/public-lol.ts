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

/* 챔피언 상세(GET /api/lol/champion-detail) — 목업
 * `docs/mockups/lol-champion-detail-skills-stats.approved-spec.html` §11 제안 1.
 *
 * 화면 하나가 네 종류(패시브·스킬·기본 스탯·패치 변경)를 동시에 쓰므로 요청을
 * 하나로 묶습니다. 이름·설명은 목록 API 와 같은 ko/ja/en 3언어 동시 응답이라
 * locale 파라미터가 없고, 그래서 응답 하나를 모든 언어가 공유합니다(공용 캐시).
 *
 * tooltip 은 싣지 않습니다 — `{{ rbasedamage }}` 같은 미해결 변수가 그대로 있어
 * 화면에 깨진 문장이 됩니다. 서버가 아예 보내지 않으면 프런트가 실수로 렌더할
 * 여지도 없습니다(목업 §11). */
export type LolChampionSpellKey = "Q" | "W" | "E" | "R";

export type LolChampionPassiveDetail = {
  nameKo: string;
  nameJa?: string;
  nameEn?: string;
  descriptionKo?: string;
  descriptionJa?: string;
  descriptionEn?: string;
  iconUrl?: string;
};

export type LolChampionSpellDetail = {
  /** spells 배열 순서(0~3)를 서버가 Q/W/E/R 로 옮긴 값입니다. */
  key: LolChampionSpellKey;
  spellId: string;
  nameKo: string;
  nameJa?: string;
  nameEn?: string;
  descriptionKo?: string;
  descriptionJa?: string;
  descriptionEn?: string;
  /** 레벨별 쿨타임(초). 슬래시 접기와 단위(초/秒/s)는 화면이 붙입니다. */
  cooldown?: number[];
  /** Data Dragon costBurn 원본("55/65/75/85/95"). 값이 모두 같으면 이미 접혀 옵니다.
   *  소모값이 0 인 스킬(체력을 쓰거나 무소모)에는 이 필드가 없습니다. */
  costBurn?: string;
  /** 소모 자원 이름("마나"/"マナ"/"Mana"). ddragon 의 costType 은 미해결 템플릿
   *  (" {{ cost }}")으로 오므로 챔피언 partype 에서 가져오며, ddragon 이
   *  "{{ abilityresourcename }}" 로 그 자리를 가리키는 스킬에만 붙습니다. */
  costTypeKo?: string;
  costTypeJa?: string;
  costTypeEn?: string;
  /** 레벨별 사거리. "self" 처럼 숫자가 아닌 응답은 생략합니다. */
  range?: number[];
  iconUrl?: string;
};

/** 스킬 수치 변경 — 이번 범위는 쿨타임 하나뿐입니다(목업 §11). */
export type LolChampionPatchSpellFieldChange = {
  field: "cooldown";
  from: number[];
  to: number[];
};

export type LolChampionPatchSpellChange = {
  key: LolChampionSpellKey;
  /** 쿨타임은 값이 작아져야 강화입니다 — 스탯과 극성이 반대입니다(목업 §06). */
  direction: "buff" | "nerf";
  fields: LolChampionPatchSpellFieldChange[];
};

export type LolChampionPatchStatChange = {
  /** Data Dragon 스탯 키(hp·armor…). 화면 라벨은 프런트가 붙입니다. */
  stat: string;
  from: number;
  to: number;
  direction: "buff" | "nerf" | "adjust";
};

/** 이번 패치의 이 챔피언 변경. 변경이 없으면 응답에서 이 필드 자체가 빠집니다. */
export type LolChampionPatchChanges = {
  patchVersion: string;
  /** [이전, 현재] Data Dragon 버전. 무엇과 무엇을 비교했는지 밝힙니다. */
  comparedVersions: [string, string];
  stats: LolChampionPatchStatChange[];
  spells: LolChampionPatchSpellChange[];
};

export type LolChampionDetailResponse = {
  championId: number;
  championKey: string;
  /** 아이콘 URL 조립·캐시 검증용 Data Dragon 버전("16.x.y"). */
  dataDragonVersion: string;
  passive?: LolChampionPassiveDetail;
  spells: LolChampionSpellDetail[];
  /** Data Dragon stats 20키 그대로. 라벨은 붙이지 않습니다(언어를 섞지 않습니다). */
  baseStats: Record<string, number>;
  patchChanges?: LolChampionPatchChanges;
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
