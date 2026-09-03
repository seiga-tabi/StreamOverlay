import test, { after, before } from "node:test";
import assert from "node:assert/strict";

/* GET /api/lol/champion-build-stats — 챔피언 글로벌 빌드 통계 읽기 계약.
 *
 * 저장소는 인메모리 페이크를 주입합니다. 여기서 검증할 것은 SQL 이 아니라 라우트
 * 계약(입력 검증 · 패치 자동 결정 · 표본 부족 분기 · Data Dragon 보강 · 캐시 헤더)
 * 입니다. 집계 규칙은 champion-build-stats-repository.test.mjs 가 담당합니다. */

const { createHttpHandler, parsePublicLolChampionBuildStatsRequest } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");

const previousAuthConfig = {
  localNoAuth: appConfig.security.localNoAuth,
  dashboardAuthToken: appConfig.security.dashboardAuthToken
};

before(() => {
  appConfig.security.localNoAuth = true;
  appConfig.security.dashboardAuthToken = "";
});

after(() => {
  appConfig.security.localNoAuth = previousAuthConfig.localNoAuth;
  appConfig.security.dashboardAuthToken = previousAuthConfig.dashboardAuthToken;
});

function createRequest(method, url) {
  return { method, url, headers: { host: "yoro.gg" }, async *[Symbol.asyncIterator]() {} };
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers ?? {};
    },
    end(chunk = "") {
      this.body = String(chunk ?? "");
    }
  };
}

async function get(handler, url) {
  const res = createResponse();
  await handler(createRequest("GET", url), res);
  let json;
  try {
    json = res.body ? JSON.parse(res.body) : undefined;
  } catch {
    json = undefined;
  }
  return { status: res.statusCode, headers: res.headers, json };
}

function readyStats(totalGames = 120) {
  return {
    totalGames,
    wins: 66,
    runeGroups: [
      { key: "rune:8112:8100:8300", games: 80, pickRate: 66.7, winRate: 56.3, keystonePerkId: 8112, primaryStyleId: 8100, subStyleId: 8300 },
      { key: "rune:8010:8000:8300", games: 15, pickRate: 12.5, winRate: undefined, keystonePerkId: 8010, primaryStyleId: 8000, subStyleId: 8300 }
    ],
    itemGroups: [
      { key: "item:1001-3157", games: 40, pickRate: 33.3, winRate: 55, itemIds: [1001, 3157] }
    ],
    spellGroups: [
      { key: "spell:4-14", games: 100, pickRate: 83.3, winRate: 55, summonerSpell1: 4, summonerSpell2: 14 }
    ],
    otherRuneGames: 25,
    otherItemGames: 80,
    otherSpellGames: 20,
    positions: [
      { teamPosition: "MIDDLE", games: totalGames, winRate: 55 },
      { teamPosition: "TOP", games: 8, winRate: undefined }
    ]
  };
}

function fakeDataDragon(version = "15.17.1") {
  return {
    async getLatestVersion() {
      return version;
    },
    async mapRuneSummaries(runeIds) {
      return runeIds.map((runeId) => ({
        runeId,
        nameKo: `룬${runeId}`,
        nameJa: `ルーン${runeId}`,
        iconUrl: `https://ddragon.leagueoflegends.com/cdn/img/perk/${runeId}.png`
      }));
    },
    async mapItemSummaries(itemIds) {
      return itemIds.map((itemId) => ({ itemId, nameKo: `아이템${itemId}`, iconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png` }));
    }
  };
}

function setup({ stats = readyStats(), dataDragon = fakeDataDragon(), reader } = {}) {
  const calls = [];
  const championBuildStats = reader ?? {
    async query(params) {
      calls.push(params);
      return stats;
    }
  };
  const handler = createHttpHandler({ championBuildStats, dataDragon });
  return { handler, calls };
}

test("parsePublicLolChampionBuildStatsRequest 는 대문자 포지션과 양의 정수만 받고 queueId 기본값은 솔로랭크다", () => {
  assert.deepEqual(
    parsePublicLolChampionBuildStatsRequest(new URLSearchParams({ championId: "103", teamPosition: "MIDDLE" })),
    { championId: 103, teamPosition: "MIDDLE", queueId: 420 }
  );
  assert.deepEqual(
    parsePublicLolChampionBuildStatsRequest(new URLSearchParams({ championId: "103", teamPosition: "UTILITY", queueId: "440" })),
    { championId: 103, teamPosition: "UTILITY", queueId: 440 }
  );
  for (const params of [
    { teamPosition: "MIDDLE" },
    { championId: "abc", teamPosition: "MIDDLE" },
    { championId: "-1", teamPosition: "MIDDLE" },
    { championId: "103" },
    { championId: "103", teamPosition: "middle" },
    { championId: "103", teamPosition: "SUPPORT" },
    { championId: "103", teamPosition: "MIDDLE", queueId: "0" },
    { championId: "103", teamPosition: "MIDDLE", queueId: "solo" }
  ]) {
    assert.throws(
      () => parsePublicLolChampionBuildStatsRequest(new URLSearchParams(params)),
      (error) => error.status === 400 && error.payload.code === "LOL_CHAMPION_BUILD_STATS_INPUT_INVALID"
    );
  }
});

test("입력이 잘못되면 400 과 안전한 오류 코드로 답하고 저장소를 호출하지 않는다", async () => {
  const { handler, calls } = setup();
  const missing = await get(handler, "/api/lol/champion-build-stats?teamPosition=MIDDLE");
  assert.equal(missing.status, 400);
  assert.equal(missing.json.code, "LOL_CHAMPION_BUILD_STATS_INPUT_INVALID");
  const lowercase = await get(handler, "/api/lol/champion-build-stats?championId=103&teamPosition=mid");
  assert.equal(lowercase.status, 400);
  assert.equal(lowercase.json.code, "LOL_CHAMPION_BUILD_STATS_INPUT_INVALID");
  assert.equal(calls.length, 0);
});

test("정상 응답은 최신 패치를 서버가 정하고 Data Dragon 이름·아이콘을 붙이며 1800초 공개 캐시 헤더를 낸다", async () => {
  const { handler, calls } = setup();
  const response = await get(handler, "/api/lol/champion-build-stats?championId=103&teamPosition=MIDDLE");

  assert.equal(response.status, 200);
  assert.equal(response.headers["Cache-Control"], "public, max-age=1800, stale-while-revalidate=3600");
  assert.equal(response.headers.ETag, undefined);
  assert.deepEqual(calls, [{ championId: 103, teamPosition: "MIDDLE", queueId: 420, patch: "15.17" }]);

  const body = response.json;
  assert.equal(body.sampleInsufficient, false);
  assert.equal(body.championId, 103);
  assert.equal(body.teamPosition, "MIDDLE");
  assert.equal(body.queueId, 420);
  assert.equal(body.patch, "15.17");
  assert.equal(body.dataDragonVersion, "15.17.1");
  assert.equal(body.totalGames, 120);
  assert.equal(body.winRate, 55);
  assert.ok(Number.isFinite(Date.parse(body.updatedAt)));
  assert.equal(body.runeGroups.length, 2);
  assert.deepEqual(body.runeGroups[0].keystone, {
    id: 8112,
    nameKo: "룬8112",
    nameJa: "ルーン8112",
    iconUrl: "https://ddragon.leagueoflegends.com/cdn/img/perk/8112.png"
  });
  assert.equal(body.runeGroups[0].primaryStyle.id, 8100);
  assert.equal(body.runeGroups[0].subStyle.id, 8300);
  assert.equal(body.runeGroups[1].winRate, undefined, "표본 20게임 미만 조합은 승률을 생략한다");
  assert.deepEqual(body.itemGroups[0].items.map((item) => item.id), [1001, 3157]);
  assert.equal(body.itemGroups[0].items[0].nameKo, "아이템1001");
  assert.deepEqual(body.spellGroups[0], { key: "spell:4-14", games: 100, pickRate: 83.3, winRate: 55, summonerSpell1: 4, summonerSpell2: 14 });
  assert.equal(body.otherRuneGames, 25);
  assert.equal(body.otherItemGames, 80);
  assert.equal(body.otherSpellGames, 20);
  assert.deepEqual(body.positions.map((entry) => entry.teamPosition), ["MIDDLE", "TOP"]);
});

test("queueId 를 주면 그 큐로 조회한다", async () => {
  const { handler, calls } = setup();
  const response = await get(handler, "/api/lol/champion-build-stats?championId=103&teamPosition=TOP&queueId=440");
  assert.equal(response.status, 200);
  assert.equal(calls[0].queueId, 440);
  assert.equal(response.json.queueId, 440);
});

test("전체 표본이 30게임 미만이면 sampleInsufficient 와 totalGames 만 담아 200 으로 답한다", async () => {
  const { handler } = setup({ stats: readyStats(12) });
  const response = await get(handler, "/api/lol/champion-build-stats?championId=103&teamPosition=MIDDLE");

  assert.equal(response.status, 200);
  assert.equal(response.headers["Cache-Control"], "public, max-age=1800, stale-while-revalidate=3600");
  assert.equal(response.json.sampleInsufficient, true);
  assert.equal(response.json.totalGames, 12);
  assert.equal(response.json.patch, "15.17");
  assert.equal(response.json.runeGroups, undefined);
  assert.equal(response.json.itemGroups, undefined);
  assert.equal(response.json.spellGroups, undefined);
  assert.equal(response.json.winRate, undefined);
  assert.ok(Array.isArray(response.json.positions));
});

test("Data Dragon 이 실패하면 id 만으로 응답한다(부가 정보라 500 을 내지 않는다)", async () => {
  const dataDragon = {
    async getLatestVersion() {
      return "15.17.1";
    },
    async mapRuneSummaries() {
      throw new Error("ddragon down");
    },
    async mapItemSummaries() {
      throw new Error("ddragon down");
    }
  };
  const { handler } = setup({ dataDragon });
  const response = await get(handler, "/api/lol/champion-build-stats?championId=103&teamPosition=MIDDLE");
  assert.equal(response.status, 200);
  assert.equal(response.json.runeGroups[0].keystone, undefined);
  assert.equal(response.json.runeGroups[0].keystonePerkId, 8112);
  assert.deepEqual(response.json.itemGroups[0].items, [{ id: 1001 }, { id: 3157 }]);
});

test("패치를 정할 수 없거나 저장소가 없으면 503 으로 닫는다", async () => {
  const noDataDragon = createHttpHandler({ championBuildStats: { async query() { return readyStats(); } } });
  const noPatch = await get(noDataDragon, "/api/lol/champion-build-stats?championId=103&teamPosition=MIDDLE");
  assert.equal(noPatch.status, 503);
  assert.equal(noPatch.json.code, "LOL_CHAMPION_BUILD_STATS_PATCH_UNAVAILABLE");

  const noReader = createHttpHandler({ dataDragon: fakeDataDragon() });
  const unavailable = await get(noReader, "/api/lol/champion-build-stats?championId=103&teamPosition=MIDDLE");
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.json.code, "LOL_CHAMPION_BUILD_STATS_UNAVAILABLE");
});
