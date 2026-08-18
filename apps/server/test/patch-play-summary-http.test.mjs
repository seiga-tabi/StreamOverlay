import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const { requiredHttpPrincipal } = await import("../dist/security/auth.js");
const { PATCH_PLAY_SAMPLE_LIMIT, parsePatchPlaySummary } = await import("@streamops/shared");

const PUUID = "p".repeat(78);

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

function createRequest(method, url, headers = {}) {
  return {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator]() {}
  };
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      this.body = String(chunk);
    }
  };
}

/* 실측한 gameVersion 모양을 그대로 씁니다: 같은 패치에 build 가 여러 개입니다. */
function match(matchId, gameVersion, won, championId = 1, queueId = 420) {
  return {
    metadata: { matchId, participants: [PUUID] },
    info: {
      gameCreation: Date.UTC(2026, 6, 20),
      gameDuration: 1800,
      gameVersion,
      queueId,
      mapId: 11,
      participants: [{
        puuid: PUUID,
        championId,
        championName: "Annie",
        teamId: 100,
        win: won,
        kills: 1,
        deaths: 1,
        assists: 1
      }]
    }
  };
}

const MATCHES = [
  match("KR_1", "16.15.788.4269", true, 1),
  match("KR_2", "16.15.788.4269", true, 1),
  match("KR_3", "16.15.760.5228", false, 64),
  match("KR_4", "16.14.760.9485", true, 78),
  match("KR_5", "16.14.760.9485", false, 78),
  match("KR_6", "16.14.760.9485", false, 254),
  match("KR_7", "16.14.760.9485", false, 12)
];

function riotClient(overrides = {}) {
  const calls = { matchIds: 0, details: 0, accounts: 0 };
  return {
    calls,
    isConfigured: () => true,
    /* 실제 RiotApiClient 가 가진 method 입니다. 없으면 기본 platform 을 못 고릅니다. */
    routingStatus: () => ({ lolPlatform: "kr" }),
    async getAccountByRiotId(gameName, tagLine) {
      calls.accounts += 1;
      return { puuid: PUUID, gameName, tagLine };
    },
    async getSummonerByPuuid() {
      return { puuid: PUUID };
    },
    async getRecentMatchIdsByPuuid(_puuid, count) {
      calls.matchIds += 1;
      assert.ok(count <= PATCH_PLAY_SAMPLE_LIMIT, "표본 상한을 넘겨 요청하지 않는다");
      return MATCHES.map((item) => item.metadata.matchId);
    },
    async getMatch(matchId) {
      calls.details += 1;
      return MATCHES.find((item) => item.metadata.matchId === matchId) ?? null;
    },
    ...overrides
  };
}

function handlerWith(riot) {
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    ...(riot ? { riot } : {})
  });
}

async function get(handler, url) {
  const res = createResponse();
  await handler(createRequest("GET", url), res);
  return res;
}

test("패치별 전적은 로그인 없이 볼 수 있는 GET 전용 endpoint 다", () => {
  assert.equal(requiredHttpPrincipal("GET", "/api/public/patch-notes/summary"), "PUBLIC");
  assert.notEqual(requiredHttpPrincipal("POST", "/api/public/patch-notes/summary"), "PUBLIC");
});

test("gameVersion 의 major.minor 로 묶어 패치별 승률을 낸다", async () => {
  const riot = riotClient();
  const res = await get(handlerWith(riot), "/api/public/patch-notes/summary?riotId=YORO%23KR1&platform=kr");
  assert.equal(res.statusCode, 200);
  const summary = parsePatchPlaySummary(JSON.parse(res.body));
  assert.ok(summary, "shared parser 를 통과해야 한다");
  assert.equal(summary.sampledMatches, MATCHES.length);
  assert.deepEqual(summary.patches.map(({ topChampions, ...record }) => record), [
    /* 같은 패치의 build 두 개(788·760)가 한 칸으로 묶입니다. */
    { patchKey: "16.15", games: 3, wins: 2, winRate: 66.7 },
    { patchKey: "16.14", games: 4, wins: 1, winRate: 25 }
  ]);
  /* 최신 패치가 먼저 와야 화면이 다시 정렬하지 않습니다. */
  assert.equal(summary.patches[0].patchKey, "16.15");
  assert.equal(summary.gameName, "YORO");
  assert.equal(summary.tagLine, "KR1");
});

test("개인 전적이라 공용 캐시에 남기지 않는다", async () => {
  const res = await get(handlerWith(riotClient()), "/api/public/patch-notes/summary?riotId=YORO%23KR1&platform=kr");
  assert.match(res.headers["Cache-Control"], /^private,/u);
});

test("같은 Riot ID를 다시 물어도 Riot을 다시 부르지 않는다", async () => {
  const riot = riotClient();
  const handler = handlerWith(riot);
  await get(handler, "/api/public/patch-notes/summary?riotId=YORO%23KR1&platform=kr");
  const afterFirst = { ...riot.calls };
  await get(handler, "/api/public/patch-notes/summary?riotId=YORO%23KR1&platform=kr");
  assert.deepEqual({ ...riot.calls }, afterFirst);
});

test("승패를 모르는 경기는 표본에서 뺀다", async () => {
  const riot = riotClient({
    async getMatch(matchId) {
      const found = MATCHES.find((item) => item.metadata.matchId === matchId);
      if (matchId !== "KR_1") return found ?? null;
      /* 진행 중이거나 비정상 종료면 win 이 없습니다. 추측해서 채우지 않습니다. */
      return {
        ...found,
        info: { ...found.info, participants: [{ ...found.info.participants[0], win: undefined }] }
      };
    }
  });
  const res = await get(handlerWith(riot), "/api/public/patch-notes/summary?riotId=YORO%23KR1&platform=kr");
  const summary = parsePatchPlaySummary(JSON.parse(res.body));
  assert.ok(summary);
  assert.equal(summary.sampledMatches, MATCHES.length - 1);
  const { topChampions, ...record } = summary.patches[0];
  assert.deepEqual(record, { patchKey: "16.15", games: 2, wins: 1, winRate: 50 });
  /* 빠진 경기의 챔피언도 함께 빠집니다 — 승패를 모르니 승수도 셀 수 없습니다. */
  assert.deepEqual(topChampions, [
    { championId: 1, games: 1, wins: 1 },
    { championId: 64, games: 1, wins: 0 },
  ]);
});

test("gameVersion 이 없으면 패치를 지어내지 않는다", async () => {
  const riot = riotClient({
    async getMatch(matchId) {
      const found = MATCHES.find((item) => item.metadata.matchId === matchId);
      return { ...found, info: { ...found.info, gameVersion: undefined } };
    }
  });
  const res = await get(handlerWith(riot), "/api/public/patch-notes/summary?riotId=YORO%23KR1&platform=kr");
  const summary = parsePatchPlaySummary(JSON.parse(res.body));
  assert.ok(summary);
  assert.deepEqual(summary.patches, []);
  /* 표본은 세어 두어야 화면이 "집계할 경기가 없다"고 말할 수 있습니다. */
  assert.equal(summary.sampledMatches, MATCHES.length);
});

test("경기가 하나도 없어도 빈 요약을 정상 응답한다", async () => {
  const riot = riotClient({
    async getRecentMatchIdsByPuuid() {
      return [];
    }
  });
  const res = await get(handlerWith(riot), "/api/public/patch-notes/summary?riotId=YORO%23KR1&platform=kr");
  assert.equal(res.statusCode, 200);
  const summary = parsePatchPlaySummary(JSON.parse(res.body));
  assert.ok(summary);
  assert.equal(summary.sampledMatches, 0);
  assert.deepEqual(summary.patches, []);
});

test("Riot ID가 잘못됐거나 계정이 없으면 그렇게 답한다", async () => {
  const handler = handlerWith(riotClient());
  assert.equal((await get(handler, "/api/public/patch-notes/summary?riotId=&platform=kr")).statusCode, 400);
  assert.equal((await get(handler, "/api/public/patch-notes/summary?riotId=태그없음&platform=kr")).statusCode, 400);

  const missing = handlerWith(riotClient({
    async getAccountByRiotId() {
      return null;
    }
  }));
  assert.equal((await get(missing, "/api/public/patch-notes/summary?riotId=YORO%23KR1&platform=kr")).statusCode, 404);
});

test("Riot API를 쓸 수 없으면 503으로 알린다", async () => {
  assert.equal((await get(handlerWith(undefined), "/api/public/patch-notes/summary?riotId=YORO%23KR1&platform=kr")).statusCode, 503);
  const unconfigured = handlerWith(riotClient({ isConfigured: () => false }));
  assert.equal((await get(unconfigured, "/api/public/patch-notes/summary?riotId=YORO%23KR1&platform=kr")).statusCode, 503);
});

test("패치별 최다 사용 챔피언을 Riot 추가 호출 없이 함께 낸다", async () => {
  /* championId 는 승패를 꺼내며 이미 손에 든 participant 에 있습니다 — 같은 순회에서
     담을 뿐이라 matchIds·details 호출 수가 늘지 않아야 합니다. */
  const riot = riotClient();
  const res = await get(handlerWith(riot), "/api/public/patch-notes/summary?riotId=YORO%23KR1&platform=kr");
  const summary = parsePatchPlaySummary(JSON.parse(res.body));
  assert.ok(summary, "shared parser 를 통과해야 한다");
  assert.deepEqual(riot.calls, { matchIds: 1, details: MATCHES.length, accounts: 1 });

  const [recent, older] = summary.patches;
  assert.deepEqual(recent.topChampions, [
    { championId: 1, games: 2, wins: 2 },
    { championId: 64, games: 1, wins: 0 },
  ]);
  /* 상위 3개까지만 — 16.14 는 네 판이지만 챔피언은 78·254·12 세 종류입니다. */
  assert.deepEqual(older.topChampions, [
    { championId: 78, games: 2, wins: 1 },
    { championId: 12, games: 1, wins: 0 },
    { championId: 254, games: 1, wins: 0 },
  ]);
});
