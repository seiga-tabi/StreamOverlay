import test, { after, before } from "node:test";
import assert from "node:assert/strict";

/* 홈 카테고리 타일의 트위치 박스아트(안 B — 2026-08-22 handoff).
 *
 * 여기서 지키는 것:
 * 1. box_art_url 템플릿은 285x380(타일 3:4 원본)으로 치환된다.
 * 2. 트위치의 「박스아트 없음」 패드(404_boxart)는 null 로 정규화된다 — 프런트 폴백.
 * 3. 성공은 길게 캐시된다 — 홈 트래픽이 helix 호출로 증폭되지 않는다.
 * 4. Twitch 미구성·실패에도 200 — 이 응답이 홈을 막지 않는다.
 */

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { GameBoxartService } = await import("../dist/services/game-boxart.js");
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

function handlerWith({ gameBoxart } = {}) {
  return createHttpHandler({
    store: { getParticipationQueue: () => [] },
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    logger: { event: () => {}, error: () => {} },
    ...(gameBoxart ? { gameBoxart } : {})
  });
}

const HELIX_GAMES = {
  data: [
    { id: "21779", name: "League of Legends", box_art_url: "https://static-cdn.jtvnw.net/ttv-boxart/21779-{width}x{height}.jpg" },
    { id: "1234", name: "Palworld", box_art_url: "https://static-cdn.jtvnw.net/ttv-boxart/404_boxart-{width}x{height}.jpg" },
    { id: "516575", name: "VALORANT", box_art_url: "https://static-cdn.jtvnw.net/ttv-boxart/516575-{width}x{height}.jpg" },
    { id: "27471", name: "Minecraft", box_art_url: "http://static-cdn.jtvnw.net/ttv-boxart/27471-{width}x{height}.jpg" }
  ]
};

test("박스아트 템플릿은 285x380 으로 치환되고, 패드·비-https 는 null 로 정규화된다", async () => {
  let calls = 0;
  const service = new GameBoxartService({
    async getGamesByNames(names) {
      calls += 1;
      assert.deepEqual(names, ["League of Legends", "Palworld", "VALORANT", "Minecraft"]);
      return HELIX_GAMES;
    }
  });
  const entries = await service.getBoxart();
  assert.deepEqual(entries, [
    { key: "lol", boxArtUrl: "https://static-cdn.jtvnw.net/ttv-boxart/21779-285x380.jpg" },
    /* 팰월드: 트위치가 실제로 패드 이미지를 주는 케이스(handoff 실측) — null 폴백. */
    { key: "palworld", boxArtUrl: null },
    { key: "valorant", boxArtUrl: "https://static-cdn.jtvnw.net/ttv-boxart/516575-285x380.jpg" },
    /* http 는 버린다 — 혼합 콘텐츠를 프런트로 넘기지 않는다. */
    { key: "minecraft", boxArtUrl: null }
  ]);

  /* 성공 캐시 — 재조회는 helix 를 다시 부르지 않는다. */
  await service.getBoxart();
  assert.equal(calls, 1);
});

test("Twitch 미구성이면 전부 null 이고, 실패는 짧게 캐시돼 재시도된다", async () => {
  const unconfigured = new GameBoxartService(undefined);
  const entries = await unconfigured.getBoxart();
  assert.equal(entries.length, 4);
  assert.ok(entries.every((entry) => entry.boxArtUrl === null));

  let now = 0;
  let calls = 0;
  const flaky = new GameBoxartService({
    async getGamesByNames() {
      calls += 1;
      return { data: [] };
    }
  }, () => now);
  await flaky.getBoxart();
  await flaky.getBoxart();
  assert.equal(calls, 1, "실패도 TTL 안에서는 캐시된다");
  now = 6 * 60 * 1000;
  await flaky.getBoxart();
  assert.equal(calls, 2, "실패 TTL(5분)이 지나면 재시도한다");
});

test("GET /api/public/game-boxart 는 익명 200 이고 공용 캐시 헤더를 갖는다", async () => {
  const gameBoxart = new GameBoxartService({
    async getGamesByNames() {
      return HELIX_GAMES;
    }
  });
  const result = await get(handlerWith({ gameBoxart }), "/api/public/game-boxart");
  assert.equal(result.status, 200);
  assert.equal(result.json.games.length, 4);
  assert.equal(result.json.games[0].key, "lol");
  assert.match(result.json.games[0].boxArtUrl, /285x380\.jpg$/u);
  assert.match(result.headers["Cache-Control"] ?? result.headers["cache-control"] ?? "", /public, max-age=3600/u);
});

test("서비스 미주입이어도 200 빈 목록 — 홈을 막지 않는다", async () => {
  const result = await get(handlerWith({}), "/api/public/game-boxart");
  assert.equal(result.status, 200);
  assert.deepEqual(result.json.games, []);
});
