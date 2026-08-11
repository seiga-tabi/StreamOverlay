import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { ValorantPublicCatalogService } from "../dist/services/valorant-public-catalog.js";
import { ValorantPublicService, ValorantPublicQueryError } from "../dist/services/valorant-public-service.js";

const catalog = ValorantPublicCatalogService.load();
const registry = { listApprovedMainStreamerRiotIds: () => [] };
const userId = "11111111-1111-4111-8111-111111111111";
const puuid = "riot-puuid-value_abcdefghijklmnopqrstuvwxyz1234567890";

function eligiblePool() {
  return {
    async query() {
      return {
        rows: [{
          user_id: userId,
          riot_puuid: puuid,
          riot_display_name: "Player#KR1",
          twitch_user_id: "123456789",
          twitch_display_name: "스트리머",
          consented_at: new Date("2026-08-11T00:00:00.000Z")
        }],
        rowCount: 1
      };
    }
  };
}

const approvedRegistry = {
  listApprovedMainStreamerRiotIds: () => [{
    twitchUserId: "123456789",
    twitchDisplayName: "스트리머"
  }]
};

function matchDetail() {
  return {
    matchInfo: {
      matchId: "match_1",
      mapId: "unknown-map",
      queueId: "competitive",
      gameStartMillis: 1786406400000,
      gameLengthMillis: 2_100_000
    },
    players: [{
      puuid,
      teamId: "Blue",
      characterId: "unknown-agent",
      stats: {}
    }],
    teams: [{ teamId: "Blue", won: true, roundsWon: 13, roundsPlayed: 22 }]
  };
}

test("공식 발로란트 카탈로그 artifact를 strict 검증하고 페이지 처리한다", () => {
  const agents = catalog.agents(new URLSearchParams("offset=0&limit=10"));
  const weapons = catalog.weapons(new URLSearchParams());
  const maps = catalog.maps(new URLSearchParams());
  assert.equal(agents.state, "ready");
  assert.equal(agents.items.length, 10);
  assert.equal(agents.total, 29);
  assert.equal(weapons.state, "ready");
  assert.equal(weapons.total, 20);
  assert.equal(maps.state, "ready");
  assert.equal(maps.total, 12);
  assert.throws(
    () => catalog.agents(new URLSearchParams("limit=10&limit=20")),
    (error) => error.code === "invalid_query"
  );
});

test("카탈로그 loader는 acts·queues의 unknown field와 잘못된 ID를 fail-closed한다", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "yoro-valorant-catalog-"));
  try {
    const source = JSON.parse(readFileSync(
      path.resolve("apps/server/data/valorant/public-content-12.08.json"),
      "utf8"
    ));
    source.acts[0].id = "------------------------------------";
    source.queues[0].unknown = "blocked";
    const artifactPath = path.join(directory, "invalid.json");
    writeFileSync(artifactPath, JSON.stringify(source));
    assert.throws(
      () => ValorantPublicCatalogService.load(artifactPath),
      (error) => error.code === "artifact_unavailable"
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Riot 프로덕션 승인 전 endpoint는 외부 호출 없이 approval_pending만 반환한다", async () => {
  let fetchCalls = 0;
  const service = new ValorantPublicService({
    registry,
    catalog,
    approved: false,
    apiKey: "not-used",
    currentActId: "d816f426-48ea-f052-117f-9697a155b319",
    platform: "kr",
    timeoutMs: 1000,
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("unexpected_fetch");
    }
  });
  assert.deepEqual(await service.leaderboard(new URLSearchParams()), { state: "approval_pending" });
  assert.deepEqual(await service.streamers(), { state: "approval_pending" });
  assert.deepEqual(
    await service.streamerMatches("a".repeat(32), new URLSearchParams()),
    { state: "approval_pending" }
  );
  assert.equal(fetchCalls, 0);
});

test("승인된 리더보드는 익명화와 safe DTO를 적용하고 PUUID를 버린다", async () => {
  let requestedUrl;
  let apiKeyHeader;
  const service = new ValorantPublicService({
    registry,
    catalog,
    approved: true,
    apiKey: "RGAPI-private",
    currentActId: "d816f426-48ea-f052-117f-9697a155b319",
    platform: "kr",
    timeoutMs: 1000,
    fetchImpl: async (url, init) => {
      requestedUrl = String(url);
      apiKeyHeader = init.headers["X-Riot-Token"];
      return new Response(JSON.stringify({
        players: [
          { puuid: "private-puuid", gameName: "Visible", tagLine: "KR1", leaderboardRank: 1, rankedRating: 900, numberOfWins: 10 },
          { puuid: "other-private", isAnonymized: true, leaderboardRank: 2, rankedRating: 800, numberOfWins: 8 }
        ]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });
  const response = await service.leaderboard(new URLSearchParams("region=kr"));
  assert.equal(response.state, "ready");
  assert.equal(response.entries[0].riotId, "Visible#KR1");
  assert.equal(response.entries[1].riotId, undefined);
  assert.equal(JSON.stringify(response).includes("puuid"), false);
  assert.match(requestedUrl, /^https:\/\/kr\.api\.riotgames\.com\/val\/ranked\/v1\/leaderboards\/by-act\//u);
  assert.match(requestedUrl, /[?&]size=200(?:&|$)/u);
  assert.match(requestedUrl, /[?&]startIndex=0(?:&|$)/u);
  assert.equal(apiKeyHeader, "RGAPI-private");
  await assert.rejects(
    () => service.leaderboard(new URLSearchParams("region=eu")),
    (error) => error instanceof ValorantPublicQueryError
  );
});

test("리더보드 top 500은 200개 단위로 제한하고 생략된 0 통계를 복원한다", async () => {
  const requestedPages = [];
  const service = new ValorantPublicService({
    registry,
    catalog,
    approved: true,
    apiKey: "RGAPI-private",
    currentActId: "d816f426-48ea-f052-117f-9697a155b319",
    platform: "kr",
    timeoutMs: 1000,
    fetchImpl: async (url) => {
      const parsed = new URL(String(url));
      const startIndex = Number(parsed.searchParams.get("startIndex"));
      const size = Number(parsed.searchParams.get("size"));
      requestedPages.push({ startIndex, size });
      return new Response(JSON.stringify({
        players: Array.from({ length: size }, (_, index) => ({
          leaderboardRank: startIndex + index + 1,
          isAnonymized: true
        }))
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  });
  const response = await service.leaderboard(new URLSearchParams());
  assert.equal(response.state, "ready");
  assert.equal(response.entries.length, 500);
  assert.deepEqual(requestedPages, [
    { startIndex: 0, size: 200 },
    { startIndex: 200, size: 200 },
    { startIndex: 400, size: 100 }
  ]);
  assert.deepEqual(response.entries[0], {
    rank: 1,
    anonymous: true,
    rankedRating: 0,
    wins: 0
  });
});

test("동의된 스트리머 전적은 대상 통계만 반환하고 PUUID를 노출하지 않는다", async () => {
  const service = new ValorantPublicService({
    pool: eligiblePool(),
    registry: approvedRegistry,
    catalog,
    approved: true,
    apiKey: "RGAPI-private",
    currentActId: "d816f426-48ea-f052-117f-9697a155b319",
    platform: "kr",
    timeoutMs: 1000,
    fetchImpl: async (url) => new Response(JSON.stringify(
      String(url).includes("matchlists/by-puuid")
        ? { history: [{ matchId: "match_1" }] }
        : matchDetail()
    ), { status: 200, headers: { "Content-Type": "application/json" } })
  });
  const [streamer] = (await service.streamers()).streamers;
  const response = await service.streamerMatches(streamer.id, new URLSearchParams());
  assert.equal(response.state, "ready");
  assert.equal(response.matches[0].kills, 0);
  assert.equal(response.matches[0].deaths, 0);
  assert.equal(response.matches[0].assists, 0);
  assert.equal(JSON.stringify(response).includes(puuid), false);
});

test("전적 조회 중 동의가 철회되면 진행 중 응답과 cache 저장을 폐기한다", async () => {
  let releaseDetail;
  let detailStarted;
  const detailStartedPromise = new Promise((resolve) => { detailStarted = resolve; });
  const detailPromise = new Promise((resolve) => { releaseDetail = resolve; });
  const service = new ValorantPublicService({
    pool: eligiblePool(),
    registry: approvedRegistry,
    catalog,
    approved: true,
    apiKey: "RGAPI-private",
    currentActId: "d816f426-48ea-f052-117f-9697a155b319",
    platform: "kr",
    timeoutMs: 1000,
    fetchImpl: async (url) => {
      if (String(url).includes("matchlists/by-puuid")) {
        return new Response(JSON.stringify({ history: [{ matchId: "match_1" }] }), { status: 200 });
      }
      detailStarted();
      const detail = await detailPromise;
      return new Response(JSON.stringify(detail), { status: 200 });
    }
  });
  const [streamer] = (await service.streamers()).streamers;
  const pending = service.streamerMatches(streamer.id, new URLSearchParams());
  await detailStartedPromise;
  service.invalidateUser(userId);
  releaseDetail(matchDetail());
  assert.equal(await pending, undefined);
});
