import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");

const APP_SHELL = "<!doctype html><html lang=\"ko\"><head>"
  + "<meta name=\"description\" content=\"home\">"
  + "<link rel=\"canonical\" href=\"https://yoro.gg/\">"
  + "<meta property=\"og:title\" content=\"home\">"
  + "<meta property=\"og:description\" content=\"home\">"
  + "<meta property=\"og:url\" content=\"https://yoro.gg/\">"
  + "<meta name=\"twitter:title\" content=\"home\">"
  + "<meta name=\"twitter:description\" content=\"home\">"
  + "<title>YORO.gg</title></head><body><div id=\"root\"></div></body></html>";

function createRequest(url) {
  return { method: "GET", url, headers: { host: "yoro.gg" }, async *[Symbol.asyncIterator]() {} };
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers ?? {};
    },
    end(chunk = "") {
      this.body = String(chunk ?? "");
    },
  };
}

async function get(handler, url) {
  const response = createResponse();
  await handler(createRequest(url), response);
  return response;
}

async function waitFor(predicate, message) {
  const deadline = Date.now() + 1_000;
  while (!predicate()) {
    if (Date.now() >= deadline) assert.fail(message);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

async function withDashboardStatic(run) {
  const previousDashboardStatic = appConfig.paths.dashboardStatic;
  const directory = mkdtempSync(path.join(tmpdir(), "streamops-public-lol-ssr-warm-"));
  try {
    mkdirSync(path.join(directory, "images"), { recursive: true });
    writeFileSync(path.join(directory, "images", "yorogg-og.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(path.join(directory, "index.html"), APP_SHELL);
    appConfig.paths.dashboardStatic = directory;
    await run();
  } finally {
    appConfig.paths.dashboardStatic = previousDashboardStatic;
    rmSync(directory, { recursive: true, force: true });
  }
}

function readyRiot(accountGate, calls) {
  const fetchedAt = new Date().toISOString();
  return {
    isConfigured: () => true,
    async getAccountByRiotId(gameName, tagLine) {
      calls.account += 1;
      await accountGate;
      return { puuid: "test-puuid", gameName, tagLine };
    },
    async getRankedStatsByPuuid() {
      return {
        queueType: "RANKED_SOLO_5x5",
        tier: "CHALLENGER",
        rank: "I",
        leaguePoints: 1234,
        wins: 20,
        losses: 10,
        winRate: 67,
        fetchedAt,
      };
    },
    async getChampionMasteryTopByPuuid() {
      return [];
    },
    async getRecentMatchIdsByPuuid() {
      return ["KR_1"];
    },
    async getMatch() {
      return {
        metadata: { matchId: "KR_1", participants: ["test-puuid"] },
        info: {
          gameCreation: Date.now(),
          gameDuration: 1_800,
          queueId: 420,
          gameMode: "CLASSIC",
          gameType: "MATCHED_GAME",
          mapId: 11,
          participants: [{
            puuid: "test-puuid",
            championId: 78,
            championName: "Poppy",
            teamId: 100,
            win: true,
            kills: 5,
            deaths: 2,
            assists: 9,
          }],
          teams: [{ teamId: 100, win: true }, { teamId: 200, win: false }],
        },
      };
    },
    routingStatus() {
      return { lolPlatform: "kr" };
    },
  };
}

test("SSR 캐시 미스는 즉시 noindex를 반환하고 백그라운드 예열 후 실데이터를 제공한다", async () => {
  await withDashboardStatic(async () => {
    let releaseAccount;
    const accountGate = new Promise((resolve) => { releaseAccount = resolve; });
    const calls = { account: 0 };
    const snapshots = [];
    const errors = [];
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      riot: readyRiot(accountGate, calls),
      logger: { event() {}, error(entry) { errors.push(entry); } },
      publicLolSnapshotStore: {
        async load() { return undefined; },
        async save(snapshot) { snapshots.push(snapshot); },
      },
    });
    const pathname = "/ko/lol/summoners/kr/CacheWarmTest-KR1";

    const firstResponses = await Promise.race([
      Promise.all([get(handler, pathname), get(handler, pathname)]),
      new Promise((_, reject) => setTimeout(() => reject(new Error("SSR 응답이 백그라운드 조회를 기다렸습니다.")), 500)),
    ]);

    for (const response of firstResponses) {
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["X-Robots-Tag"], "noindex, nofollow");
      assert.match(response.body, /<meta name="robots" content="noindex" \/>/u);
      assert.doesNotMatch(response.body, /Challenger 1,234 LP/u);
    }
    assert.equal(calls.account, 1, "동일 key의 동시 SSR 예열은 한 번만 Riot 조회해야 합니다");
    assert.equal(snapshots.length, 0, "첫 응답 시점에는 백그라운드 조회가 끝나지 않아야 합니다");

    releaseAccount();
    await waitFor(() => snapshots.length === 1, "백그라운드 프로필 빌드가 스냅샷을 저장하지 않았습니다.");
    assert.equal(errors.length, 0);

    const second = await get(handler, pathname);
    assert.equal(second.statusCode, 200);
    assert.equal(second.headers["X-Robots-Tag"], undefined);
    assert.doesNotMatch(second.body, /name="robots"/u);
    assert.match(second.body, /<title>CacheWarmTest#KR1 · Challenger 1,234 LP \| YORO\.gg<\/title>/u);
    assert.match(second.body, /최근 1게임 · 1승 0패 · 승률 100%/u);
    assert.match(second.body, /평균 KDA 7\.00/u);
    assert.equal(calls.account, 1, "두 번째 SSR은 예열된 캐시를 사용해야 합니다");
  });
});

test("형식이 유효하지 않은 경로는 조회하지 않고 존재하지 않는 Riot ID 실패는 응답과 분리한다", async () => {
  await withDashboardStatic(async () => {
    const errors = [];
    let accountCalls = 0;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      riot: {
        isConfigured: () => true,
        async getAccountByRiotId() {
          accountCalls += 1;
          return null;
        },
        routingStatus() {
          return { lolPlatform: "kr" };
        },
      },
      logger: { event() {}, error(entry) { errors.push(entry); } },
      publicLolSnapshotStore: { async load() { return undefined; }, async save() {} },
    });

    const malformed = await get(handler, "/ko/lol/summoners/kr/invalid");
    assert.equal(malformed.statusCode, 200);
    assert.equal(accountCalls, 0);

    const missing = await get(handler, "/ko/lol/summoners/kr/DefinitelyMissing-ZZ999");
    assert.equal(missing.statusCode, 200);
    assert.equal(missing.headers["X-Robots-Tag"], "noindex, nofollow");
    assert.match(missing.body, /<meta name="robots" content="noindex" \/>/u);
    await waitFor(
      () => errors.some((entry) => entry.type === "public_lol.social_metadata_background_build_failed"),
      "존재하지 않는 Riot ID의 백그라운드 실패 로그가 남지 않았습니다.",
    );
    assert.equal(accountCalls, 1);
  });
});
