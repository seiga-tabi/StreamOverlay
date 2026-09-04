import test, { after, before } from "node:test";
import assert from "node:assert/strict";

/* GET /api/lol/champion-detail — 챔피언 상세(스킬·기본 스탯·이번 패치 변경) 계약.
 *
 * 승인 스펙 `docs/mockups/lol-champion-detail-skills-stats.approved-spec.html` §11.
 * Data Dragon 과 패치 요약 서비스는 페이크를 주입합니다. 여기서 검증할 것은
 * 네트워크가 아니라 라우트 계약입니다 — 입력 검증, tooltip 미포함, 패치 변경 결합,
 * 변경 없음(필드 부재), 그리고 패치 비교가 실패해도 스킬·스탯은 나간다는 fail-soft.
 * 쿨타임 비교 규칙 자체는 patch-change-summary.test.mjs 가 담당합니다. */

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

/* 쿨타임 비교용 두 시점. 이전 패치는 R 이 140/120/100 이었다고 둡니다(강화). */
const COOLDOWNS_BY_VERSION = {
  "16.16.1": new Map([["Q", [7, 7, 7, 7, 7]], ["W", [9, 8, 7, 6, 5]], ["E", [12, 12, 12, 12, 12]], ["R", [140, 120, 100]]]),
  "16.17.1": new Map([["Q", [7, 7, 7, 7, 7]], ["W", [9, 8, 7, 6, 5]], ["E", [12, 12, 12, 12, 12]], ["R", [130, 110, 90]]])
};

function fakeDataDragon({ version = "16.17.1", cooldowns = COOLDOWNS_BY_VERSION, localesComplete = true } = {}) {
  const calls = { cooldowns: [] };
  return {
    calls,
    async getLatestVersion() {
      return version;
    },
    async getChampionAbilityDetails(championId) {
      return championId === 103 ? { ...AHRI_ABILITIES, localesComplete } : undefined;
    },
    async getChampionBaseStats(championId) {
      return championId === 103 ? AHRI_STATS : undefined;
    },
    async getChampionSpellCooldowns(championKey, requestedVersion) {
      calls.cooldowns.push([championKey, requestedVersion]);
      return cooldowns[requestedVersion] ?? new Map();
    }
  };
}

function fakePatchNotes(notes = [
  { slug: "p-26-17", title: "패치 26.17", publishedAt: "2026-09-01T00:00:00.000Z", url: "https://example.test/26.17", patchVersion: "26.17", dataDragonVersion: "16.17.1" },
  { slug: "p-26-16", title: "패치 26.16", publishedAt: "2026-08-18T00:00:00.000Z", url: "https://example.test/26.16", patchVersion: "26.16", dataDragonVersion: "16.16.1" }
]) {
  return { async getFeed() { return { schemaVersion: 1, locale: "ko", fetchedAt: "2026-09-01T00:00:00.000Z", stale: false, notes }; } };
}

function fakePatchChangeSummary(championChanges = []) {
  const calls = [];
  return {
    calls,
    async summaryFor(patchVersion, locale) {
      calls.push([patchVersion, locale]);
      if (championChanges.length === 0) return undefined;
      return {
        patchVersion,
        comparedVersions: ["16.16.1", "16.17.1"],
        systemChanges: [],
        championChanges,
        itemChanges: [],
        skillChangesIncluded: false
      };
    }
  };
}

function setup({ dataDragon = fakeDataDragon(), patchNotes = fakePatchNotes(), patchChangeSummary = fakePatchChangeSummary() } = {}) {
  const handler = createHttpHandler({ dataDragon, patchNotes, patchChangeSummary });
  return { handler, dataDragon, patchChangeSummary };
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

test("이번 패치에 변경이 있으면 스탯과 스킬 쿨타임을 함께 담는다", async () => {
  const { handler, dataDragon, patchChangeSummary } = setup({
    patchChangeSummary: fakePatchChangeSummary([
      { championId: 103, name: "아리", direction: "buff", changes: [{ stat: "hp", from: 590, to: 610 }] },
      { championId: 84, name: "아칼리", direction: "nerf", changes: [{ stat: "armor", from: 23, to: 21 }] }
    ])
  });
  const body = (await get(handler, "/api/lol/champion-detail?championId=103")).json;

  assert.equal(body.patchChanges.patchVersion, "26.17");
  assert.deepEqual(body.patchChanges.comparedVersions, ["16.16.1", "16.17.1"]);
  /* 다른 챔피언의 변경은 섞이지 않습니다. */
  assert.deepEqual(body.patchChanges.stats, [{ stat: "hp", from: 590, to: 610, direction: "buff" }]);
  /* 쿨타임은 값이 작아져야 강화입니다 — 140/120/100 → 130/110/90 은 buff 입니다. */
  assert.deepEqual(body.patchChanges.spells, [
    { key: "R", direction: "buff", fields: [{ field: "cooldown", from: [140, 120, 100], to: [130, 110, 90] }] }
  ]);
  /* 스탯 비교는 기존 패치 요약 서비스(6시간 캐시)를 재사용합니다 — 목록 배지와 같은 계산. */
  assert.deepEqual(patchChangeSummary.calls, [["26.17", "ko"]]);
  /* 쿨타임은 이전·현재 두 버전만 봅니다(이름 맵을 다시 받지 않도록 championKey 로). */
  assert.deepEqual(dataDragon.calls.cooldowns.map(([key]) => key), ["Ahri", "Ahri"]);
});

test("표시 버전과 패치 비교의 현재 버전이 다르면 patchChanges를 생략한다", async () => {
  const { handler } = setup({
    dataDragon: fakeDataDragon({ version: "16.17.2" }),
    patchChangeSummary: fakePatchChangeSummary([
      { championId: 103, name: "아리", direction: "buff", changes: [{ stat: "hp", from: 590, to: 610 }] }
    ])
  });
  const response = await get(handler, "/api/lol/champion-detail?championId=103");

  assert.equal(response.status, 200);
  assert.equal(response.json.dataDragonVersion, "16.17.2");
  assert.equal(response.json.patchChanges, undefined);
});

test("스탯도 스킬도 안 바뀌었으면 patchChanges 필드 자체가 없다", async () => {
  const { handler } = setup({
    dataDragon: fakeDataDragon({
      cooldowns: { "16.16.1": COOLDOWNS_BY_VERSION["16.17.1"], "16.17.1": COOLDOWNS_BY_VERSION["16.17.1"] }
    })
  });
  const body = (await get(handler, "/api/lol/champion-detail?championId=103")).json;

  /* "변경 없음"을 빈 배열이 아니라 필드 부재로 말합니다 — 화면은 배지·태그 없이 그립니다. */
  assert.equal(body.patchChanges, undefined);
  assert.equal(body.spells.length, 4);
  assert.equal(body.baseStats.hp, 590);
});

test("패치 비교가 실패해도 스킬·스탯은 그대로 나간다(fail-soft)", async () => {
  const { handler } = setup({
    patchChangeSummary: {
      async summaryFor() {
        throw new Error("patch feed down");
      }
    }
  });
  const response = await get(handler, "/api/lol/champion-detail?championId=103");

  assert.equal(response.status, 200);
  assert.equal(response.json.patchChanges, undefined);
  assert.equal(response.json.spells.length, 4);
  assert.equal(response.json.passive.nameKo, "정기 흡수");
});

test("패치 노트 서비스가 없으면 패치 변경 없이 200 으로 답한다", async () => {
  const handler = createHttpHandler({ dataDragon: fakeDataDragon() });
  const response = await get(handler, "/api/lol/champion-detail?championId=103");

  assert.equal(response.status, 200);
  assert.equal(response.json.patchChanges, undefined);
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
