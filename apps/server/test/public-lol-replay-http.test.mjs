import test, { after, before } from "node:test";
import assert from "node:assert/strict";

/* 경기 응답의 다시보기(replay) 필드 — 목업 page-4 v34.
 *
 * 여기서 지키는 것:
 * 1. 스트리머로 연동되지 않은 프로필에는 Twitch 를 부르지 않는다(대부분이 여기 해당).
 * 2. Twitch 가 흔들려도 경기 목록은 그대로 나간다 — 버튼만 사라진다.
 * 3. 잘못된 지점으로 보내느니 필드를 빼고 보낸다.
 */

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

const MATCH_START = "2026-08-19T11:00:00.000Z";
const VOD_START = "2026-08-19T10:00:00.000Z";

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
  return { status: res.statusCode, json };
}

/** Riot 대역 — 경기 한 판만 있는 계정. */
function fakeRiot() {
  return {
    isConfigured: () => true,
    async getAccountByRiotId(gameName, tagLine) {
      return { puuid: "puuid-1", gameName, tagLine };
    },
    async getRecentMatchIdsByPuuid() {
      return ["KR_1"];
    },
    async getMatch() {
      return {
        metadata: { matchId: "KR_1", participants: ["puuid-1"] },
        info: {
          gameCreation: Date.parse(MATCH_START),
          gameStartTimestamp: Date.parse(MATCH_START),
          gameDuration: 1800,
          queueId: 420,
          gameMode: "CLASSIC",
          gameType: "MATCHED_GAME",
          mapId: 11,
          participants: [{
            puuid: "puuid-1",
            championId: 78,
            championName: "Poppy",
            teamId: 100,
            win: true,
            kills: 5,
            deaths: 2,
            assists: 9,
            champLevel: 16,
            totalMinionsKilled: 120,
            neutralMinionsKilled: 20,
            goldEarned: 12000,
            totalDamageDealtToChampions: 20000,
            visionScore: 30,
            riotIdGameName: "밤톨",
            riotIdTagline: "KR1"
          }],
          teams: [{ teamId: 100, win: true }, { teamId: 200, win: false }]
        }
      };
    },
    async getRankedStatsByPuuidWithoutSummoner() {
      return undefined;
    },
    async getRankedStatsByPuuid() {
      return undefined;
    }
  };
}

function handlerWith({ twitch, store = {}, logger } = {}) {
  return createHttpHandler({
    store: { getParticipationQueue: () => [], ...store },
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    logger: logger ?? { event: () => {}, error: () => {} },
    riot: fakeRiot(),
    ...(twitch ? { twitch } : {})
  });
}

test("스트리머로 연동되지 않은 프로필에는 Twitch 를 부르지 않는다", async () => {
  /* 대부분의 프로필이 여기 해당합니다 — 매 조회마다 Twitch 를 부르면 예산만 씁니다. */
  let calls = 0;
  const twitch = {
    async getArchiveVideosByUserId() {
      calls += 1;
      return { state: "ready", status: 200, count: 0, payload: { data: [] } };
    }
  };
  const result = await get(handlerWith({ twitch }), "/api/lol/matches?riotId=%EB%B0%A4%ED%86%A8%23KR1&platform=kr");
  assert.equal(result.status, 200);
  assert.equal(result.json.recentMatches.length, 1);
  assert.equal(result.json.recentMatches[0].replay, undefined);
  assert.equal(calls, 0, "연동이 없으면 아카이브를 조회하지 않습니다");
});

test("Twitch 가 없어도 경기 목록은 그대로 나간다", async () => {
  const result = await get(handlerWith(), "/api/lol/matches?riotId=%EB%B0%A4%ED%86%A8%23KR1&platform=kr");
  assert.equal(result.status, 200);
  assert.equal(result.json.recentMatches.length, 1);
  assert.equal(result.json.recentMatches[0].replay, undefined);
});

test("연동된 스트리머의 경기에는 다시보기 지점이 붙는다", async () => {
  /* 참여 큐에 Riot ID 가 등록된 계정을 스트리머로 봅니다(기존 매칭 경로). */
  const store = {
    getParticipationQueue: () => [{
      riotGameName: "밤톨",
      riotTagLine: "KR1",
      twitchUserId: "55",
      twitchLogin: "bamtol",
      twitchDisplayName: "밤톨"
    }]
  };
  let asked;
  const events = [];
  const twitch = {
    async getArchiveVideosByUserId(userId) {
      asked = userId;
      const data = [{ id: "9001", created_at: VOD_START, duration: "3h", type: "archive" }];
      return { state: "ready", status: 200, count: data.length, payload: { data } };
    }
  };
  const result = await get(
    handlerWith({ twitch, store, logger: { event: (event) => events.push(event), error: () => {} } }),
    "/api/lol/matches?riotId=%EB%B0%A4%ED%86%A8%23KR1&platform=kr"
  );
  assert.equal(result.status, 200);
  assert.equal(asked, "55", "연동된 채널의 아카이브를 조회해야 합니다");
  const replay = result.json.recentMatches[0]?.replay;
  assert.ok(replay, "연동된 스트리머의 경기에는 다시보기가 붙어야 합니다");
  assert.equal(replay.vodId, "9001");
  /* 방송 시작 1시간 뒤 경기 — 밴픽 끝자락부터 보이도록 조금 당깁니다. */
  assert.equal(replay.offsetSeconds, 3600 - 30);
  const archiveEvent = events.find((event) => event.type === "twitch.archive_videos_request");
  assert.equal(archiveEvent.state, "ready");
  assert.equal(archiveEvent.archiveCount, 1);
  assert.match(archiveEvent.twitchUserKey, /^[a-f0-9]{16}$/u);
  assert.notEqual(archiveEvent.twitchUserKey, "55", "원본 Twitch user id를 로그에 남기면 안 됩니다");
  assert.deepEqual(
    events.find((event) => event.type === "public_lol.replays_matched"),
    {
      type: "public_lol.replays_matched",
      twitchUserKey: archiveEvent.twitchUserKey,
      matchedCount: 1,
      totalMatches: 1
    }
  );
});

test("아카이브 조회가 실패해도 경기 목록은 살아 있다", async () => {
  const store = {
    getParticipationQueue: () => [{
      riotGameName: "밤톨",
      riotTagLine: "KR1",
      twitchUserId: "55",
      twitchLogin: "bamtol",
      twitchDisplayName: "밤톨"
    }]
  };
  const events = [];
  const twitch = {
    async getArchiveVideosByUserId() {
      return { state: "failed", reason: "http_503", status: 503 };
    }
  };
  const result = await get(
    handlerWith({ twitch, store, logger: { event: (event) => events.push(event), error: () => {} } }),
    "/api/lol/matches?riotId=%EB%B0%A4%ED%86%A8%23KR1&platform=kr"
  );
  assert.equal(result.status, 200);
  assert.equal(result.json.recentMatches.length, 1);
  assert.equal(result.json.recentMatches[0].replay, undefined);
  const archiveEvent = events.find((event) => event.type === "twitch.archive_videos_request");
  assert.equal(archiveEvent.reason, "http_503");
  assert.equal(archiveEvent.status, 503);
  assert.equal(events.find((event) => event.type === "twitch.vod_index_loaded")?.cacheTtlMs, 30_000);
  assert.equal(events.find((event) => event.type === "public_lol.replays_matched")?.matchedCount, 0);
});
