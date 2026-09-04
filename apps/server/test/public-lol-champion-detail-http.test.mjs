import test, { after, before } from "node:test";
import assert from "node:assert/strict";

/* GET /api/lol/champion-detail — 챔피언 상세(스킬·기본 스탯) 계약.
 *
 * 승인 스펙 `docs/mockups/lol-champion-detail-skills-stats.approved-spec.html` §11.
 * Data Dragon 페이크를 주입하고 입력 검증, tooltip 미포함, 스킬·기본 스탯 응답을
 * 검증합니다. */

const { createHttpHandler } = await import("../dist/routes/http-api.js");
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

/* 값은 실제 Data Dragon 응답(16.17.1 · ko_KR · 아리 championId 103)에서 가져왔습니다 —
   스펙 §02·§04 가 화면에 그린 것과 같은 수치입니다. */
const AHRI_ABILITIES = {
  championKey: "Ahri",
  passive: {
    nameKo: "정기 흡수",
    descriptionKo: "아리가 미니언 또는 몬스터를 9마리 처치하면 체력을 회복합니다.<br>아리가 적 챔피언 처치에 관여하면 더 많은 체력을 회복합니다.",
    iconUrl: "https://ddragon.test/passive/Ahri_SoulEater2.png"
  },
  spells: [
    { key: "Q", spellId: "AhriOrbofDeception", nameKo: "현혹의 구슬", descriptionKo: "아리가 구슬을 던지고 다시 받습니다.", cooldown: [7, 7, 7, 7, 7], costBurn: "55/65/75/85/95", costTypeKo: "마나", range: [970, 970, 970, 970, 970] },
    { key: "W", spellId: "AhriFoxFire", nameKo: "여우불", descriptionKo: "아리의 이동 속도가 잠시 동안 크게 증가합니다.", cooldown: [9, 8, 7, 6, 5], costBurn: "30", costTypeKo: "마나", range: [700, 700, 700, 700, 700] },
    { key: "E", spellId: "AhriSeduce", nameKo: "매혹", descriptionKo: "아리가 입맞춤을 날려 피해를 주며 맞은 적을 홀립니다.", cooldown: [12, 12, 12, 12, 12], costBurn: "60", costTypeKo: "마나", range: [975, 975, 975, 975, 975] },
    { key: "R", spellId: "AhriTumble", nameKo: "혼령 질주", descriptionKo: "아리가 전방으로 질주합니다.", cooldown: [130, 110, 90], costBurn: "100", costTypeKo: "마나", range: [450, 450, 450] }
  ]
};

const AHRI_STATS = {
  hp: 590, hpperlevel: 104, hpregen: 2.5, hpregenperlevel: 0.6,
  mp: 418, mpperlevel: 25, mpregen: 8, mpregenperlevel: 0.8,
  attackdamage: 53, attackdamageperlevel: 0, attackspeed: 0.668, attackspeedperlevel: 2.2,
  armor: 21, armorperlevel: 4.2, spellblock: 30, spellblockperlevel: 1.3,
  movespeed: 330, attackrange: 550, crit: 0, critperlevel: 0
};

function fakeDataDragon({ version = "16.17.1", localesComplete = true } = {}) {
  return {
    async getLatestVersion() {
      return version;
    },
    async getChampionAbilityDetails(championId) {
      return championId === 103 ? { ...AHRI_ABILITIES, localesComplete } : undefined;
    },
    async getChampionBaseStats(championId) {
      return championId === 103 ? AHRI_STATS : undefined;
    }
  };
}

function setup({ dataDragon = fakeDataDragon() } = {}) {
  const handler = createHttpHandler({ dataDragon });
  return { handler, dataDragon };
}

test("championId 가 없거나 양의 정수가 아니면 400 과 안전한 코드로 답한다", async () => {
  const { handler } = setup();
  for (const query of ["", "?championId=", "?championId=abc", "?championId=-3", "?championId=0"]) {
    const response = await get(handler, `/api/lol/champion-detail${query}`);
    assert.equal(response.status, 400);
    assert.equal(response.json.code, "LOL_CHAMPION_DETAIL_INPUT_INVALID");
  }
});

test("정상 응답은 패시브·스킬·기본 스탯 20키를 담고 1시간 공개 캐시 헤더를 낸다", async () => {
  const { handler } = setup();
  const response = await get(handler, "/api/lol/champion-detail?championId=103");

  assert.equal(response.status, 200);
  assert.equal(response.headers["Cache-Control"], "public, max-age=3600, stale-while-revalidate=86400");

  const body = response.json;
  assert.equal(body.championId, 103);
  assert.equal(body.championKey, "Ahri");
  assert.equal(body.dataDragonVersion, "16.17.1");
  assert.equal(body.passive.nameKo, "정기 흡수");
  assert.deepEqual(body.spells.map((spell) => spell.key), ["Q", "W", "E", "R"]);
  assert.deepEqual(body.spells[0].cooldown, [7, 7, 7, 7, 7]);
  /* 소모값은 Data Dragon 이 이미 접어 준 문자열 그대로입니다(파싱하지 않습니다). */
  assert.equal(body.spells[0].costBurn, "55/65/75/85/95");
  assert.equal(body.spells[1].costBurn, "30");
  assert.equal(Object.keys(body.baseStats).length, 20);
  assert.equal(body.baseStats.hp, 590);
  assert.equal(body.baseStats.critperlevel, 0);
  /* tooltip 은 계약에 없습니다 — 미해결 변수를 화면에 흘리지 않기 위해서입니다. */
  for (const spell of body.spells) assert.equal(spell.tooltip, undefined);
});

test("일본어 또는 영어 상세를 못 받았으면 200 응답을 공개 캐시하지 않는다", async () => {
  const { handler } = setup({ dataDragon: fakeDataDragon({ localesComplete: false }) });
  const response = await get(handler, "/api/lol/champion-detail?championId=103");

  assert.equal(response.status, 200);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(response.json.passive.nameKo, "정기 흡수");
  assert.equal(response.json.spells.length, 4);
});

test("없는 championId 는 404, Data Dragon 이 없으면 503 이다", async () => {
  const { handler } = setup();
  const notFound = await get(handler, "/api/lol/champion-detail?championId=999999");
  assert.equal(notFound.status, 404);
  assert.equal(notFound.json.code, "LOL_CHAMPION_NOT_FOUND");

  const unavailable = await get(createHttpHandler({}), "/api/lol/champion-detail?championId=103");
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.json.code, "LOL_CHAMPION_DETAIL_UNAVAILABLE");
});
