import {
  LOL_CHAMPION_BUILD_STATS_MAX_ITEM_GROUPS,
  LOL_CHAMPION_BUILD_STATS_MAX_RUNE_GROUPS,
  LOL_CHAMPION_BUILD_STATS_MAX_SPELL_GROUPS,
  LOL_CHAMPION_BUILD_STATS_MIN_GROUP_PICK_RATE,
  LOL_CHAMPION_BUILD_STATS_MIN_GROUP_WIN_RATE_GAMES,
  isLolChampionBuildStatsPosition,
  type LolChampionBuildStatsPosition,
  type LolChampionBuildStatsPositionGroup,
  type LolChampionItemBuildGroup,
  type LolChampionRuneBuildGroup,
  type LolChampionSpellBuildGroup
} from "@streamops/shared";
import { SafeDatabaseError } from "../errors.js";
import { repositoryQuery, type RepositoryQueryable } from "./types.js";

export type ChampionMatchBuildRecord = {
  matchId: string;
  puuid: string;
  championId: number;
  teamPosition: string;
  queueId: number;
  patch: string;
  win: boolean;
  observedTier?: string;
  keystonePerkId?: number;
  primaryStyleId?: number;
  subStyleId?: number;
  summonerSpell1?: number;
  summonerSpell2?: number;
  items: readonly (number | undefined)[];
  matchCreatedAt: string;
};

const INSERT_COLUMNS = 20;

function requireIsoTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
  }
  return value;
}

export async function recordChampionMatchBuilds(
  queryable: RepositoryQueryable,
  records: readonly ChampionMatchBuildRecord[]
): Promise<void> {
  if (records.length === 0) return;

  const values: unknown[] = [];
  const tuples = records.map((record, rowIndex) => {
    if (record.items.length !== 6) {
      throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
    }
    values.push(
      record.matchId,
      record.puuid,
      record.championId,
      record.teamPosition,
      record.queueId,
      record.patch,
      record.win,
      record.observedTier ?? null,
      record.keystonePerkId ?? null,
      record.primaryStyleId ?? null,
      record.subStyleId ?? null,
      record.summonerSpell1 ?? null,
      record.summonerSpell2 ?? null,
      ...record.items.map((item) => item ?? null),
      requireIsoTimestamp(record.matchCreatedAt)
    );
    const firstParameter = rowIndex * INSERT_COLUMNS + 1;
    const placeholders = Array.from(
      { length: INSERT_COLUMNS },
      (_, columnIndex) => `$${firstParameter + columnIndex}`
    );
    return `(${placeholders.join(", ")})`;
  });

  await repositoryQuery(
    queryable,
    `INSERT INTO lol_champion_match_builds (
       match_id, puuid, champion_id, team_position, queue_id, patch, win,
       observed_tier, keystone_perk_id, primary_style_id, sub_style_id,
       summoner_spell_1, summoner_spell_2,
       item_0, item_1, item_2, item_3, item_4, item_5, match_created_at
     ) VALUES ${tuples.join(", ")}
     ON CONFLICT (match_id, puuid) DO NOTHING`,
    values
  );
}

export async function countChampionMatchBuildsOlderThan(
  queryable: RepositoryQueryable,
  cutoffIso: string
): Promise<number> {
  const result = await repositoryQuery<{ count: string }>(
    queryable,
    `SELECT COUNT(*)::TEXT AS count
       FROM lol_champion_match_builds
      WHERE match_created_at < $1::TIMESTAMPTZ`,
    [requireIsoTimestamp(cutoffIso)]
  );
  const count = Number(result.rows[0]?.count ?? "0");
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new SafeDatabaseError("DATABASE_INTERNAL_ERROR", false);
  }
  return count;
}

export async function deleteChampionMatchBuildsOlderThan(
  queryable: RepositoryQueryable,
  cutoffIso: string
): Promise<number> {
  const result = await repositoryQuery(
    queryable,
    `DELETE FROM lol_champion_match_builds
      WHERE match_created_at < $1::TIMESTAMPTZ`,
    [requireIsoTimestamp(cutoffIso)]
  );
  return result.rowCount ?? 0;
}

/* ── 글로벌 빌드 통계 조회 ─────────────────────────────────────────────
 *
 * 집계는 SQL 이 아니라 애플리케이션에서 합니다. 아이템 6종·스펠 2종은 "슬롯 순서
 * 무관" 조합 키가 필요한데, 그걸 SQL 로 쓰면 unnest/array_agg 중첩으로 읽기
 * 어려워집니다. 대신 최근 5,000게임만 받아 TypeScript 로 묶어 애플리케이션
 * 메모리 사용량을 제한합니다. 행 조회는 lookup 인덱스
 * (champion_id, team_position, queue_id, patch) 를 그대로 탑니다. */

export type ChampionBuildStatsQuery = {
  championId: number;
  teamPosition: LolChampionBuildStatsPosition;
  queueId: number;
  patch: string;
};

export type ChampionBuildStatsResult = {
  totalGames: number;
  wins: number;
  runeGroups: LolChampionRuneBuildGroup[];
  itemGroups: LolChampionItemBuildGroup[];
  spellGroups: LolChampionSpellBuildGroup[];
  otherRuneGames: number;
  otherItemGames: number;
  otherSpellGames: number;
  positions: LolChampionBuildStatsPositionGroup[];
};

export type ChampionBuildStatsReader = {
  query(params: ChampionBuildStatsQuery): Promise<ChampionBuildStatsResult>;
};

/** 집계 입력 행 — SELECT 컬럼과 1:1. 테스트에서 직접 만들어 넣을 수 있게 export. */
export type ChampionBuildStatsRow = {
  win: boolean;
  keystone_perk_id: number | null;
  primary_style_id: number | null;
  sub_style_id: number | null;
  summoner_spell_1: number | null;
  summoner_spell_2: number | null;
  item_0: number | null;
  item_1: number | null;
  item_2: number | null;
  item_3: number | null;
  item_4: number | null;
  item_5: number | null;
};

type PositionCountRow = {
  team_position: string;
  games: string;
  wins: string;
};

type GroupAccumulator<T> = { key: string; games: number; wins: number; payload: T };

const PATCH_PATTERN = /^\d{1,3}\.\d{1,3}$/u;
const CHAMPION_BUILD_STATS_SAMPLE_LIMIT = 5_000;
export const CHAMPION_BUILD_STATS_CACHE_TTL_MS = 30 * 60 * 1000;

function requireQuery(params: ChampionBuildStatsQuery): ChampionBuildStatsQuery {
  if (
    !Number.isSafeInteger(params.championId)
    || params.championId <= 0
    || !isLolChampionBuildStatsPosition(params.teamPosition)
    || !Number.isSafeInteger(params.queueId)
    || params.queueId <= 0
    || !PATCH_PATTERN.test(params.patch)
  ) {
    throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
  }
  return params;
}

function positiveId(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function roundRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function groupWinRate(games: number, wins: number): number | undefined {
  return games >= LOL_CHAMPION_BUILD_STATS_MIN_GROUP_WIN_RATE_GAMES ? roundRate(wins, games) : undefined;
}

function accumulate<T>(
  groups: Map<string, GroupAccumulator<T>>,
  key: string,
  win: boolean,
  payload: () => T
): void {
  const existing = groups.get(key);
  if (existing) {
    existing.games += 1;
    if (win) existing.wins += 1;
    return;
  }
  groups.set(key, { key, games: 1, wins: win ? 1 : 0, payload: payload() });
}

/* 게임 수 내림차순 → 승수 내림차순 → 키 오름차순(결정적 순서). 채용률 하한과
   상위 N 을 적용해 표시 그룹만 남기고, 나머지 게임 수는 호출자가 "그 외"로 합산. */
function topGroups<T>(
  groups: Map<string, GroupAccumulator<T>>,
  totalGames: number,
  limit: number
): Array<GroupAccumulator<T> & { pickRate: number; winRate: number | undefined }> {
  return [...groups.values()]
    .sort((a, b) => (b.games - a.games) || (b.wins - a.wins) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((group) => ({ ...group, pickRate: roundRate(group.games, totalGames), winRate: groupWinRate(group.games, group.wins) }))
    .filter((group) => group.pickRate >= LOL_CHAMPION_BUILD_STATS_MIN_GROUP_PICK_RATE)
    .slice(0, limit);
}

function coveredGames(groups: readonly { games: number }[]): number {
  return groups.reduce((sum, group) => sum + group.games, 0);
}

/** 원시 행 → 룬/아이템/스펠 조합 집계. 순수 함수(DB 무관). */
export function aggregateChampionBuildStatsRows(
  rows: readonly ChampionBuildStatsRow[]
): Omit<ChampionBuildStatsResult, "positions"> {
  const totalGames = rows.length;
  let wins = 0;
  const runes = new Map<string, GroupAccumulator<{ keystonePerkId: number; primaryStyleId: number; subStyleId: number }>>();
  const items = new Map<string, GroupAccumulator<{ itemIds: number[] }>>();
  const spells = new Map<string, GroupAccumulator<{ summonerSpell1: number; summonerSpell2: number }>>();

  for (const row of rows) {
    const win = row.win === true;
    if (win) wins += 1;

    /* 키스톤이 없는 행(룬 데이터 누락)은 그룹을 만들지 않고 "그 외"에만 남깁니다. */
    const keystonePerkId = positiveId(row.keystone_perk_id);
    if (keystonePerkId !== undefined) {
      const primaryStyleId = positiveId(row.primary_style_id) ?? 0;
      const subStyleId = positiveId(row.sub_style_id) ?? 0;
      accumulate(runes, `rune:${keystonePerkId}:${primaryStyleId}:${subStyleId}`, win, () => ({ keystonePerkId, primaryStyleId, subStyleId }));
    }

    /* 같은 아이템이 두 슬롯에 있으면(소모품 등) 한 번만 셉니다 — 조합 키의 안정성. */
    const itemIds = [...new Set(
      [row.item_0, row.item_1, row.item_2, row.item_3, row.item_4, row.item_5]
        .map(positiveId)
        .filter((itemId): itemId is number => itemId !== undefined)
    )].sort((a, b) => a - b);
    if (itemIds.length > 0) {
      accumulate(items, `item:${itemIds.join("-")}`, win, () => ({ itemIds }));
    }

    const spellA = positiveId(row.summoner_spell_1);
    const spellB = positiveId(row.summoner_spell_2);
    if (spellA !== undefined && spellB !== undefined) {
      const summonerSpell1 = Math.min(spellA, spellB);
      const summonerSpell2 = Math.max(spellA, spellB);
      accumulate(spells, `spell:${summonerSpell1}-${summonerSpell2}`, win, () => ({ summonerSpell1, summonerSpell2 }));
    }
  }

  const runeGroups: LolChampionRuneBuildGroup[] = topGroups(runes, totalGames, LOL_CHAMPION_BUILD_STATS_MAX_RUNE_GROUPS)
    .map((group) => ({ key: group.key, games: group.games, pickRate: group.pickRate, winRate: group.winRate, ...group.payload }));
  const itemGroups: LolChampionItemBuildGroup[] = topGroups(items, totalGames, LOL_CHAMPION_BUILD_STATS_MAX_ITEM_GROUPS)
    .map((group) => ({ key: group.key, games: group.games, pickRate: group.pickRate, winRate: group.winRate, itemIds: [...group.payload.itemIds] }));
  const spellGroups: LolChampionSpellBuildGroup[] = topGroups(spells, totalGames, LOL_CHAMPION_BUILD_STATS_MAX_SPELL_GROUPS)
    .map((group) => ({ key: group.key, games: group.games, pickRate: group.pickRate, winRate: group.winRate, ...group.payload }));

  return {
    totalGames,
    wins,
    runeGroups,
    itemGroups,
    spellGroups,
    otherRuneGames: totalGames - coveredGames(runeGroups),
    otherItemGames: totalGames - coveredGames(itemGroups),
    otherSpellGames: totalGames - coveredGames(spellGroups)
  };
}

function parseCount(value: string | number | null | undefined): number {
  const count = Number(value ?? "0");
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new SafeDatabaseError("DATABASE_INTERNAL_ERROR", false);
  }
  return count;
}

export async function queryChampionBuildStats(
  queryable: RepositoryQueryable,
  params: ChampionBuildStatsQuery
): Promise<ChampionBuildStatsResult> {
  const { championId, teamPosition, queueId, patch } = requireQuery(params);

  const [rows, positionRows] = await Promise.all([
    repositoryQuery<ChampionBuildStatsRow>(
      queryable,
      `SELECT win, keystone_perk_id, primary_style_id, sub_style_id,
              summoner_spell_1, summoner_spell_2,
              item_0, item_1, item_2, item_3, item_4, item_5
         FROM lol_champion_match_builds
        WHERE champion_id = $1 AND team_position = $2 AND queue_id = $3 AND patch = $4
        ORDER BY match_created_at DESC
        LIMIT ${CHAMPION_BUILD_STATS_SAMPLE_LIMIT}`,
      [championId, teamPosition, queueId, patch]
    ),
    repositoryQuery<PositionCountRow>(
      queryable,
      `SELECT team_position,
              COUNT(*)::TEXT AS games,
              COUNT(*) FILTER (WHERE win)::TEXT AS wins
         FROM lol_champion_match_builds
        WHERE champion_id = $1 AND queue_id = $2 AND patch = $3
        GROUP BY team_position`,
      [championId, queueId, patch]
    )
  ]);

  const positions: LolChampionBuildStatsPositionGroup[] = positionRows.rows
    .filter((row) => isLolChampionBuildStatsPosition(row.team_position))
    .map((row) => {
      const games = parseCount(row.games);
      return { teamPosition: row.team_position, games, winRate: groupWinRate(games, parseCount(row.wins)) };
    })
    .sort((a, b) => (b.games - a.games) || a.teamPosition.localeCompare(b.teamPosition));

  return { ...aggregateChampionBuildStatsRows(rows.rows), positions };
}

/** index.ts 가 pool 로 만들어 HttpHandlerInput.championBuildStats 로 주입합니다. */
export function createChampionBuildStatsReader(
  queryable: RepositoryQueryable,
  now: () => number = Date.now
): ChampionBuildStatsReader {
  const cache = new Map<string, { result: ChampionBuildStatsResult; expiresAt: number }>();
  const inFlight = new Map<string, Promise<ChampionBuildStatsResult>>();

  return {
    query: (params) => {
      let validated: ChampionBuildStatsQuery;
      try {
        validated = requireQuery(params);
      } catch (error) {
        return Promise.reject(error);
      }
      const key = `${validated.championId}:${validated.teamPosition}:${validated.queueId}:${validated.patch}`;
      const cached = cache.get(key);
      if (cached && cached.expiresAt > now()) return Promise.resolve(cached.result);
      if (cached) cache.delete(key);

      const running = inFlight.get(key);
      if (running) return running;

      const request = queryChampionBuildStats(queryable, validated)
        .then((result) => {
          cache.set(key, { result, expiresAt: now() + CHAMPION_BUILD_STATS_CACHE_TTL_MS });
          return result;
        })
        .finally(() => {
          inFlight.delete(key);
        });
      inFlight.set(key, request);
      return request;
    }
  };
}
