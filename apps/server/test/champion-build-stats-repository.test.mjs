import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAMPION_BUILD_STATS_CACHE_TTL_MS,
  aggregateChampionBuildStatsRows,
  countChampionMatchBuildsOlderThan,
  createChampionBuildStatsReader,
  deleteChampionMatchBuildsOlderThan,
  queryChampionBuildStats,
  recordChampionMatchBuilds
} from "../dist/database/repositories/champion-build-stats-repository.js";

function record(overrides = {}) {
  return {
    matchId: "KR_123",
    puuid: "puuid-1",
    championId: 103,
    teamPosition: "MIDDLE",
    queueId: 420,
    patch: "14.18",
    win: true,
    items: [1001, 3157, undefined, undefined, undefined, undefined],
    matchCreatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

test("챔피언 빌드 레코드는 한 쿼리로 저장하고 UNIQUE 충돌을 무시한다", async () => {
  const calls = [];
  const queryable = {
    async query(text, values) {
      calls.push({ text, values });
      return { rows: [], rowCount: 2 };
    }
  };

  await recordChampionMatchBuilds(queryable, [
    record(),
    record({ matchId: "KR_124", puuid: "puuid-2", championId: 266 })
  ]);

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /ON CONFLICT \(match_id, puuid\) DO NOTHING/u);
  assert.match(calls[0].text, /VALUES \(\$1,.*\), \(\$21,/su);
  assert.equal(calls[0].values.length, 40);
});

test("빈 챔피언 빌드 배열은 Database를 호출하지 않는다", async () => {
  const queryable = {
    async query() {
      assert.fail("빈 배열에서는 query가 호출되면 안 됩니다.");
    }
  };
  await recordChampionMatchBuilds(queryable, []);
});

test("보존 조회와 삭제는 같은 strict cutoff 조건을 사용한다", async () => {
  const cutoffIso = "2026-06-01T00:00:00.000Z";
  const calls = [];
  const queryable = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("COUNT(*)")) return { rows: [{ count: "3" }], rowCount: 1 };
      return { rows: [], rowCount: 3 };
    }
  };

  assert.equal(await countChampionMatchBuildsOlderThan(queryable, cutoffIso), 3);
  assert.equal(await deleteChampionMatchBuildsOlderThan(queryable, cutoffIso), 3);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.match(call.text, /match_created_at < \$1::TIMESTAMPTZ/u);
    assert.deepEqual(call.values, [cutoffIso]);
  }
});

/* ── 글로벌 빌드 통계 조회 ─────────────────────────────────────────── */

function statsRow(overrides = {}) {
  return {
    win: true,
    keystone_perk_id: 8112,
    primary_style_id: 8100,
    sub_style_id: 8300,
    summoner_spell_1: 4,
    summoner_spell_2: 14,
    item_0: 3157,
    item_1: 1001,
    item_2: null,
    item_3: null,
    item_4: null,
    item_5: null,
    ...overrides
  };
}

function repeat(count, factory) {
  return Array.from({ length: count }, (_, index) => factory(index));
}

test("빌드 집계는 아이템 슬롯 순서·스펠 순서와 무관하게 같은 조합으로 묶는다", () => {
  const rows = [
    ...repeat(30, () => statsRow({ item_0: 3157, item_1: 1001, summoner_spell_1: 4, summoner_spell_2: 14 })),
    ...repeat(20, () => statsRow({ item_0: 1001, item_1: 3157, summoner_spell_1: 14, summoner_spell_2: 4, win: false }))
  ];
  const stats = aggregateChampionBuildStatsRows(rows);

  assert.equal(stats.totalGames, 50);
  assert.equal(stats.wins, 30);
  assert.equal(stats.itemGroups.length, 1);
  assert.deepEqual(stats.itemGroups[0].itemIds, [1001, 3157]);
  assert.equal(stats.itemGroups[0].games, 50);
  assert.equal(stats.itemGroups[0].pickRate, 100);
  assert.equal(stats.itemGroups[0].winRate, 60);
  assert.equal(stats.spellGroups.length, 1);
  assert.deepEqual([stats.spellGroups[0].summonerSpell1, stats.spellGroups[0].summonerSpell2], [4, 14]);
  assert.equal(stats.runeGroups.length, 1);
  assert.equal(stats.runeGroups[0].keystonePerkId, 8112);
  assert.equal(stats.otherItemGames, 0);
  assert.equal(stats.otherSpellGames, 0);
  assert.equal(stats.otherRuneGames, 0);
});

test("채용률 10% 미만 조합은 '그 외'로 합산하고 표본 20게임 미만 조합의 승률은 숨긴다", () => {
  const rows = [
    ...repeat(70, () => statsRow({ keystone_perk_id: 8112 })),
    ...repeat(15, () => statsRow({ keystone_perk_id: 8010 })),
    ...repeat(9, () => statsRow({ keystone_perk_id: 8021 })),
    ...repeat(6, () => statsRow({ keystone_perk_id: null }))
  ];
  const stats = aggregateChampionBuildStatsRows(rows);

  assert.equal(stats.totalGames, 100);
  assert.deepEqual(stats.runeGroups.map((group) => group.keystonePerkId), [8112, 8010]);
  assert.equal(stats.runeGroups[0].winRate, 100);
  assert.equal(stats.runeGroups[1].pickRate, 15);
  assert.equal(stats.runeGroups[1].winRate, undefined, "15게임 조합은 승률을 노출하지 않는다");
  assert.equal(stats.otherRuneGames, 15, "9% 조합 9게임 + 룬 누락 6게임");
});

test("룬 5 · 아이템 4 · 스펠 3 상한을 넘는 조합은 게임 수 순으로 잘라 '그 외'에 더한다", () => {
  const rows = [];
  for (let variant = 0; variant < 6; variant += 1) {
    rows.push(...repeat(10, () => statsRow({
      keystone_perk_id: 8100 + variant,
      item_0: 3000 + variant,
      item_1: null,
      summoner_spell_1: 1,
      summoner_spell_2: 10 + variant
    })));
  }
  const stats = aggregateChampionBuildStatsRows(rows);

  assert.equal(stats.totalGames, 60);
  assert.equal(stats.runeGroups.length, 5);
  assert.equal(stats.itemGroups.length, 4);
  assert.equal(stats.spellGroups.length, 3);
  assert.equal(stats.otherRuneGames, 10);
  assert.equal(stats.otherItemGames, 20);
  assert.equal(stats.otherSpellGames, 30);
  /* 동률이면 키 오름차순 — 요청 간 순서가 흔들리지 않는다. */
  assert.deepEqual(stats.runeGroups.map((group) => group.keystonePerkId), [8100, 8101, 8102, 8103, 8104]);
});

test("빈 표본은 0 게임과 빈 그룹으로 집계된다", () => {
  const stats = aggregateChampionBuildStatsRows([]);
  assert.equal(stats.totalGames, 0);
  assert.deepEqual(stats.runeGroups, []);
  assert.deepEqual(stats.itemGroups, []);
  assert.deepEqual(stats.spellGroups, []);
});

test("queryChampionBuildStats 는 lookup 인덱스 조건으로 행을 읽고 포지션 분포를 함께 돌려준다", async () => {
  const calls = [];
  const queryable = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("GROUP BY team_position")) {
        return {
          rows: [
            { team_position: "MIDDLE", games: "40", wins: "22" },
            { team_position: "TOP", games: "12", wins: "5" },
            { team_position: "Invalid", games: "3", wins: "1" }
          ],
          rowCount: 3
        };
      }
      return { rows: repeat(40, (index) => statsRow({ win: index < 22 })), rowCount: 40 };
    }
  };

  const stats = await queryChampionBuildStats(queryable, { championId: 103, teamPosition: "MIDDLE", queueId: 420, patch: "15.17" });

  assert.equal(calls.length, 2);
  const rowsCall = calls.find((call) => !call.text.includes("GROUP BY"));
  assert.match(rowsCall.text, /champion_id = \$1 AND team_position = \$2 AND queue_id = \$3 AND patch = \$4/u);
  assert.match(rowsCall.text, /ORDER BY match_created_at DESC\s+LIMIT 5000/u);
  assert.doesNotMatch(rowsCall.text, /SELECT[^]*match_created_at[^]*FROM/u);
  assert.deepEqual(rowsCall.values, [103, "MIDDLE", 420, "15.17"]);
  const positionsCall = calls.find((call) => call.text.includes("GROUP BY"));
  assert.deepEqual(positionsCall.values, [103, 420, "15.17"]);

  assert.equal(stats.totalGames, 40);
  assert.equal(stats.wins, 22);
  assert.deepEqual(stats.positions, [
    { teamPosition: "MIDDLE", games: 40, winRate: 55 },
    { teamPosition: "TOP", games: 12, winRate: undefined }
  ]);
});

test("queryChampionBuildStats 는 잘못된 파라미터를 DB 에 보내지 않는다", async () => {
  const queryable = {
    async query() {
      assert.fail("잘못된 입력에서는 query가 호출되면 안 됩니다.");
    }
  };
  for (const params of [
    { championId: 0, teamPosition: "MIDDLE", queueId: 420, patch: "15.17" },
    { championId: 103, teamPosition: "mid", queueId: 420, patch: "15.17" },
    { championId: 103, teamPosition: "MIDDLE", queueId: -1, patch: "15.17" },
    { championId: 103, teamPosition: "MIDDLE", queueId: 420, patch: "15.17.1" }
  ]) {
    await assert.rejects(queryChampionBuildStats(queryable, params), (error) => error.code === "DATABASE_INVALID_INPUT");
  }
  const reader = createChampionBuildStatsReader(queryable);
  await assert.rejects(reader.query({ championId: 103, teamPosition: "MIDDLE", queueId: 420, patch: "x" }));
});

function successfulStatsQueryable(calls) {
  return {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("GROUP BY team_position")) {
        return { rows: [{ team_position: values[1] === 440 ? "TOP" : "MIDDLE", games: "1", wins: "1" }], rowCount: 1 };
      }
      return { rows: [statsRow()], rowCount: 1 };
    }
  };
}

test("빌드 통계 reader 는 같은 키의 캐시 히트만 재사용하고 다른 키는 새로 조회한다", async () => {
  const calls = [];
  const reader = createChampionBuildStatsReader(successfulStatsQueryable(calls));
  const middle = { championId: 103, teamPosition: "MIDDLE", queueId: 420, patch: "15.17" };

  const first = await reader.query(middle);
  const cached = await reader.query({ ...middle });
  assert.strictEqual(cached, first);
  assert.equal(calls.length, 2, "첫 캐시 미스에서 원시 행·포지션 쿼리만 실행해야 합니다.");

  await reader.query({ ...middle, teamPosition: "TOP" });
  await reader.query({ ...middle, queueId: 440 });
  await reader.query({ ...middle, patch: "15.18" });
  await reader.query({ ...middle, championId: 266 });
  assert.equal(calls.length, 10, "캐시 키 네 필드 중 하나라도 다르면 각각 새로 조회해야 합니다.");
});

test("빌드 통계 reader 는 30분 TTL이 만료되기 전까지 재사용하고 만료 시 갱신한다", async () => {
  let now = 10_000;
  const calls = [];
  const reader = createChampionBuildStatsReader(successfulStatsQueryable(calls), () => now);
  const params = { championId: 103, teamPosition: "MIDDLE", queueId: 420, patch: "15.17" };

  await reader.query(params);
  now += CHAMPION_BUILD_STATS_CACHE_TTL_MS - 1;
  await reader.query(params);
  assert.equal(calls.length, 2);

  now += 1;
  await reader.query(params);
  assert.equal(calls.length, 4, "정확히 30분이 지나면 만료된 결과를 다시 조회해야 합니다.");
});

test("빌드 통계 reader 는 같은 키의 동시 요청을 single-flight로 합친다", async () => {
  const calls = [];
  let releaseRows;
  const rowsReady = new Promise((resolve) => {
    releaseRows = resolve;
  });
  const queryable = {
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("GROUP BY team_position")) {
        return { rows: [{ team_position: "MIDDLE", games: "1", wins: "1" }], rowCount: 1 };
      }
      await rowsReady;
      return { rows: [statsRow()], rowCount: 1 };
    }
  };
  const reader = createChampionBuildStatsReader(queryable);
  const params = { championId: 103, teamPosition: "MIDDLE", queueId: 420, patch: "15.17" };

  const first = reader.query(params);
  const concurrent = reader.query({ ...params });
  assert.strictEqual(concurrent, first);
  assert.equal(calls.length, 2, "동시 요청이어도 원시 행·포지션 쿼리는 한 세트만 실행해야 합니다.");

  releaseRows();
  const [firstResult, concurrentResult] = await Promise.all([first, concurrent]);
  assert.strictEqual(concurrentResult, firstResult);
});

test("빌드 통계 reader 는 Database 미가용 실패를 캐시하지 않는다", async () => {
  let unavailable = true;
  let calls = 0;
  const queryable = {
    async query(text, values) {
      calls += 1;
      if (unavailable) throw Object.assign(new Error("database unavailable"), { code: "ECONNREFUSED" });
      if (text.includes("GROUP BY team_position")) {
        return { rows: [{ team_position: "MIDDLE", games: "1", wins: "1" }], rowCount: 1 };
      }
      return { rows: [statsRow()], rowCount: 1 };
    }
  };
  const reader = createChampionBuildStatsReader(queryable);
  const params = { championId: 103, teamPosition: "MIDDLE", queueId: 420, patch: "15.17" };

  await assert.rejects(reader.query(params), (error) => error.code === "DATABASE_UNAVAILABLE");
  assert.equal(calls, 2);

  unavailable = false;
  const recovered = await reader.query(params);
  assert.equal(recovered.totalGames, 1);
  assert.equal(calls, 4, "실패 결과가 캐시되지 않아 다음 요청이 Database를 다시 조회해야 합니다.");
});
