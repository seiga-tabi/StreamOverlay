import test from "node:test";
import assert from "node:assert/strict";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const { DashboardSessionStore } = await import("../dist/security/auth.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");
const { parseStreamerRiotIdRequestListResponse } = await import("@streamops/shared");

const DASHBOARD_ORIGIN = "http://localhost:3000";

function createRequest(method, url, headers = {}) {
  return {
    method,
    url,
    headers,
    socket: { remoteAddress: "127.0.0.1" },
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

async function withAdminConfig(run) {
  const previous = {
    localNoAuth: appConfig.security.localNoAuth,
    corsOrigins: [...appConfig.security.corsOrigins],
    nodeEnv: appConfig.nodeEnv,
    lolPlatform: appConfig.riot.lolPlatform
  };
  resetSecurityRateLimiters();
  appConfig.security.localNoAuth = true;
  appConfig.security.corsOrigins = [DASHBOARD_ORIGIN];
  appConfig.nodeEnv = "development";
  appConfig.riot.lolPlatform = "jp1";
  try {
    await run();
  } finally {
    appConfig.security.localNoAuth = previous.localNoAuth;
    appConfig.security.corsOrigins = previous.corsOrigins;
    appConfig.nodeEnv = previous.nodeEnv;
    appConfig.riot.lolPlatform = previous.lolPlatform;
    resetSecurityRateLimiters();
  }
}

function iso(timestamp) {
  return new Date(timestamp).toISOString();
}

function riotIdKey(gameName, tagLine) {
  return `${gameName.trim()}#${tagLine.trim()}`.normalize("NFKC").toLocaleLowerCase();
}

function streamerRequest(index, overrides = {}) {
  const updatedAt = iso(Date.now() - index * 60_000);
  return {
    id: `request-${String(index).padStart(3, "0")}`,
    twitchUserId: `twitch-user-${index}`,
    twitchLogin: `streamer_${index}`,
    twitchDisplayName: `Streamer ${index}`,
    riotGameName: `Riot Player ${index}`,
    riotTagLine: "KR1",
    normalizedRiotId: riotIdKey(`Riot Player ${index}`, "KR1"),
    status: "pending",
    requestedAt: updatedAt,
    updatedAt,
    ...overrides
  };
}

function createListHandler({ requests, profiles = new Map(), repositoryFailures = new Set() }) {
  let riotCallCount = 0;
  const riot = new Proxy({}, {
    get() {
      return () => {
        riotCallCount += 1;
        throw new Error("관리자 목록에서 Riot API를 호출하면 안 됩니다.");
      };
    }
  });
  const handler = createHttpHandler({
    store: {
      listStreamerRiotIdRequests() {
        return requests.map((request) => ({ ...request }));
      }
    },
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    sessions: new DashboardSessionStore(),
    riot,
    profileRepository: {
      getByRiotId(gameName, tagLine) {
        const key = riotIdKey(gameName, tagLine);
        if (repositoryFailures.has(key)) throw new Error("cache read failed");
        return profiles.get(key);
      }
    }
  });
  return {
    getRiotCallCount: () => riotCallCount,
    async get(url) {
      const response = createResponse();
      await handler(createRequest("GET", url, { origin: DASHBOARD_ORIGIN }), response);
      return response;
    }
  };
}

test("관리자 Riot ID 요청 목록의 무인자 호출은 전체 목록을 유지하고 cache 사실만 덧붙인다", async () => {
  await withAdminConfig(async () => {
    const now = Date.now();
    const analyzedAt = iso(now - 2 * 60_000);
    const rankedAt = iso(now - 3 * 60_000);
    const lastPlayedAt = iso(now - 60 * 60_000);
    const requests = Array.from({ length: 55 }, (_, index) => streamerRequest(index));
    requests[0] = streamerRequest(0, {
      id: "verified-request",
      twitchDisplayName: "Ｆｏｏ Bar",
      riotGameName: "foo bar",
      normalizedRiotId: riotIdKey("foo bar", "KR1"),
      dashboardKey: "secret-dashboard-key"
    });
    const profiles = new Map([[riotIdKey("foo bar", "KR1"), {
      riotPuuid: "cached-puuid",
      riotGameName: "foo bar",
      riotTagLine: "KR1",
      riotIdKey: riotIdKey("foo bar", "KR1"),
      lolPlatform: "jp1",
      status: "ready",
      analyzedAt,
      rankedStats: {
        queueType: "RANKED_SOLO_5x5",
        tier: "DIAMOND",
        rank: "II",
        leaguePoints: 77,
        wins: 20,
        losses: 10,
        winRate: 66.7,
        fetchedAt: rankedAt
      },
      recentMatches: [{ championId: 103, nameKo: "아리", startedAt: lastPlayedAt, won: true }]
    }]]);
    const client = createListHandler({ requests, profiles });

    const legacyResponse = await client.get("/api/participation/streamer-riot-id-requests");
    assert.equal(legacyResponse.statusCode, 200);
    assert.equal(legacyResponse.headers["Cache-Control"], "no-store");
    const legacyBody = JSON.parse(legacyResponse.body);
    assert.ok(parseStreamerRiotIdRequestListResponse(legacyBody));
    assert.equal(legacyBody.requests.length, 55);
    assert.equal(Object.hasOwn(legacyBody, "pagination"), false);
    const verified = legacyBody.requests.find((request) => request.id === "verified-request");
    assert.deepEqual(verified.verification.account, {
      state: "exists",
      evidence: "fresh_cache",
      observedAt: analyzedAt
    });
    assert.deepEqual(verified.verification.rank, {
      queueType: "RANKED_SOLO_5x5",
      tier: "DIAMOND",
      rank: "II",
      leaguePoints: 77,
      fetchedAt: rankedAt
    });
    assert.equal(verified.verification.lastPlayedAt, lastPlayedAt);
    assert.equal(verified.verification.twitchDisplayNameComparison.normalizedExactMatch, true);

    const uncached = legacyBody.requests.find((request) => request.id === "request-001");
    assert.deepEqual(uncached.verification.account, { state: "unknown", evidence: "cache_miss" });
    assert.equal(Object.hasOwn(uncached.verification, "rank"), false);
    assert.equal(Object.hasOwn(uncached.verification, "lastPlayedAt"), false);

    const defaultPageResponse = await client.get("/api/participation/streamer-riot-id-requests?status=all");
    assert.equal(defaultPageResponse.statusCode, 200);
    const defaultPageBody = JSON.parse(defaultPageResponse.body);
    assert.equal(defaultPageBody.requests.length, 50);
    assert.equal(defaultPageBody.pagination.limit, 50);
    assert.equal(defaultPageBody.pagination.total, 55);
    assert.equal(defaultPageBody.pagination.returned, 50);
    assert.equal(defaultPageBody.pagination.hasMore, true);
    assert.equal(typeof defaultPageBody.pagination.nextCursor, "string");
    assert.notEqual(defaultPageBody.pagination.nextCursor, "request-049");
    assert.equal(Object.hasOwn(verified, "normalizedRiotId"), false);
    assert.equal(Object.hasOwn(verified, "dashboardKey"), false);
    assert.doesNotMatch(legacyResponse.body, /secret-dashboard-key/u);
    assert.equal(client.getRiotCallCount(), 0);
  });
});

test("관리자 Riot ID 요청 목록은 status·q·cursor·limit을 서버에서 검증하고 page를 고정한다", async () => {
  await withAdminConfig(async () => {
    const requests = [
      streamerRequest(0, { id: "alpha-new", twitchLogin: "alpha_one", twitchDisplayName: "Alpha One" }),
      streamerRequest(1, { id: "alpha-old", twitchLogin: "second", riotGameName: "Alpha Two", normalizedRiotId: riotIdKey("Alpha Two", "KR1") }),
      streamerRequest(2, { id: "beta", twitchLogin: "beta" }),
      streamerRequest(3, { id: "alpha-approved", twitchLogin: "alpha_done", status: "approved" })
    ];
    const client = createListHandler({ requests });

    const firstResponse = await client.get("/api/participation/streamer-riot-id-requests?status=pending&q=alpha&limit=1");
    assert.equal(firstResponse.statusCode, 200);
    const firstBody = JSON.parse(firstResponse.body);
    assert.ok(parseStreamerRiotIdRequestListResponse(firstBody));
    assert.deepEqual(firstBody.requests.map((request) => request.id), ["alpha-new"]);
    assert.equal(firstBody.pagination.limit, 1);
    assert.equal(firstBody.pagination.total, 2);
    assert.equal(firstBody.pagination.returned, 1);
    assert.equal(firstBody.pagination.hasMore, true);
    assert.equal(typeof firstBody.pagination.nextCursor, "string");
    assert.notEqual(firstBody.pagination.nextCursor, "alpha-new");

    const secondResponse = await client.get(
      `/api/participation/streamer-riot-id-requests?status=pending&q=alpha&limit=1&cursor=${encodeURIComponent(firstBody.pagination.nextCursor)}`
    );
    assert.equal(secondResponse.statusCode, 200);
    const secondBody = JSON.parse(secondResponse.body);
    assert.deepEqual(secondBody.requests.map((request) => request.id), ["alpha-old"]);
    assert.deepEqual(secondBody.pagination, { limit: 1, total: 2, returned: 1, hasMore: false });

    const cappedResponse = await client.get("/api/participation/streamer-riot-id-requests?limit=999");
    assert.equal(cappedResponse.statusCode, 200);
    assert.equal(JSON.parse(cappedResponse.body).pagination.limit, 100);

    const literalSearchResponse = await client.get(
      `/api/participation/streamer-riot-id-requests?q=${encodeURIComponent("alpha' OR 1=1 --")}`
    );
    assert.equal(literalSearchResponse.statusCode, 200);
    assert.equal(JSON.parse(literalSearchResponse.body).pagination.total, 0);

    const changedFilterResponse = await client.get(
      `/api/participation/streamer-riot-id-requests?status=pending&q=beta&cursor=${encodeURIComponent(firstBody.pagination.nextCursor)}`
    );
    assert.equal(changedFilterResponse.statusCode, 400);
    assert.equal(JSON.parse(changedFilterResponse.body).code, "INVALID_CURSOR");
    const cursor = firstBody.pagination.nextCursor;
    const tamperedCursor = `${cursor.slice(0, -1)}${cursor.endsWith("A") ? "B" : "A"}`;
    const tamperedResponse = await client.get(
      `/api/participation/streamer-riot-id-requests?status=pending&q=alpha&cursor=${encodeURIComponent(tamperedCursor)}`
    );
    assert.equal(tamperedResponse.statusCode, 400);
    assert.equal(JSON.parse(tamperedResponse.body).code, "INVALID_CURSOR");

    const invalidCases = [
      ["?foo=bar", "INVALID_QUERY_PARAMETER"],
      ["?status=pending&status=approved", "INVALID_QUERY_PARAMETER"],
      ["?q=alpha&q=beta", "INVALID_QUERY_PARAMETER"],
      ["?limit=10&limit=20", "INVALID_QUERY_PARAMETER"],
      ["?cursor=first&cursor=second", "INVALID_QUERY_PARAMETER"],
      ["?status=waiting", "INVALID_STATUS"],
      [`?q=${"x".repeat(101)}`, "INVALID_QUERY"],
      ["?limit=0", "INVALID_LIMIT"],
      ["?status=pending&cursor=missing", "INVALID_CURSOR"],
      ["?cursor=%20alpha-new", "INVALID_CURSOR"]
    ];
    for (const [query, expectedCode] of invalidCases) {
      const response = await client.get(`/api/participation/streamer-riot-id-requests${query}`);
      assert.equal(response.statusCode, 400);
      assert.equal(JSON.parse(response.body).code, expectedCode);
    }
    assert.equal(client.getRiotCallCount(), 0);
  });
});

test("관리자 verification은 명시적 계정 없음 cache만 not_found로 표시하고 stale·장애는 unknown으로 낮춘다", async () => {
  await withAdminConfig(async () => {
    const now = Date.now();
    const fresh = iso(now - 60_000);
    const stale = iso(now - 25 * 60 * 60_000);
    const requests = [
      streamerRequest(0, { id: "not-found", riotGameName: "Missing", normalizedRiotId: riotIdKey("Missing", "KR1") }),
      streamerRequest(1, { id: "api-failed", riotGameName: "ApiFailed", normalizedRiotId: riotIdKey("ApiFailed", "KR1") }),
      streamerRequest(2, { id: "stale", riotGameName: "Stale", normalizedRiotId: riotIdKey("Stale", "KR1") }),
      streamerRequest(3, { id: "wrong-shard", riotGameName: "WrongShard", normalizedRiotId: riotIdKey("WrongShard", "KR1") }),
      streamerRequest(4, { id: "legacy-message", riotGameName: "LegacyMessage", normalizedRiotId: riotIdKey("LegacyMessage", "KR1") }),
      streamerRequest(5, { id: "read-error", riotGameName: "ReadError", normalizedRiotId: riotIdKey("ReadError", "KR1") })
    ];
    const profiles = new Map([
      [riotIdKey("Missing", "KR1"), {
        riotPuuid: "missing",
        riotGameName: "Missing",
        riotTagLine: "KR1",
        riotIdKey: riotIdKey("Missing", "KR1"),
        lolPlatform: "jp1",
        status: "failed",
        analyzedAt: fresh,
        failureCode: "account_not_found",
        failedReason: "Riot 계정을 찾을 수 없습니다."
      }],
      [riotIdKey("ApiFailed", "KR1"), {
        riotPuuid: "api-failed",
        riotGameName: "ApiFailed",
        riotTagLine: "KR1",
        riotIdKey: riotIdKey("ApiFailed", "KR1"),
        lolPlatform: "jp1",
        status: "failed",
        analyzedAt: fresh,
        failedReason: "RIOT_API_KEY가 설정되지 않았습니다."
      }],
      [riotIdKey("Stale", "KR1"), {
        riotPuuid: "stale",
        riotGameName: "Stale",
        riotTagLine: "KR1",
        riotIdKey: riotIdKey("Stale", "KR1"),
        lolPlatform: "jp1",
        status: "ready",
        analyzedAt: stale,
        rankedStats: {
          queueType: "RANKED_SOLO_5x5",
          tier: "GOLD",
          leaguePoints: 1,
          wins: 1,
          losses: 1,
          winRate: 50,
          fetchedAt: stale
        },
        recentMatches: [{ championId: 1, nameKo: "애니", startedAt: stale, won: false }]
      }],
      [riotIdKey("WrongShard", "KR1"), {
        riotPuuid: "wrong-shard",
        riotGameName: "WrongShard",
        riotTagLine: "KR1",
        riotIdKey: riotIdKey("WrongShard", "KR1"),
        lolPlatform: "kr1",
        status: "ready",
        analyzedAt: fresh,
        rankedStats: {
          queueType: "RANKED_SOLO_5x5",
          tier: "MASTER",
          leaguePoints: 500,
          wins: 100,
          losses: 50,
          winRate: 66.7,
          fetchedAt: fresh
        },
        recentMatches: [{ championId: 2, nameKo: "올라프", startedAt: fresh, won: true }]
      }],
      [riotIdKey("LegacyMessage", "KR1"), {
        riotPuuid: "legacy-message",
        riotGameName: "LegacyMessage",
        riotTagLine: "KR1",
        riotIdKey: riotIdKey("LegacyMessage", "KR1"),
        lolPlatform: "jp1",
        status: "failed",
        analyzedAt: fresh,
        failedReason: "Riot 계정을 찾을 수 없습니다."
      }]
    ]);
    const client = createListHandler({
      requests,
      profiles,
      repositoryFailures: new Set([riotIdKey("ReadError", "KR1")])
    });

    const response = await client.get("/api/participation/streamer-riot-id-requests");
    assert.equal(response.statusCode, 200);
    const byId = new Map(JSON.parse(response.body).requests.map((request) => [request.id, request]));
    assert.deepEqual(byId.get("not-found").verification.account, {
      state: "not_found",
      evidence: "fresh_cache",
      observedAt: fresh
    });
    assert.deepEqual(byId.get("api-failed").verification.account, {
      state: "unknown",
      evidence: "fresh_cache",
      observedAt: fresh
    });
    assert.deepEqual(byId.get("stale").verification.account, {
      state: "unknown",
      evidence: "stale_cache",
      observedAt: stale
    });
    assert.equal(Object.hasOwn(byId.get("stale").verification, "rank"), false);
    assert.equal(Object.hasOwn(byId.get("stale").verification, "lastPlayedAt"), false);
    assert.equal(byId.get("wrong-shard").verification.account.state, "exists");
    assert.equal(Object.hasOwn(byId.get("wrong-shard").verification, "rank"), false);
    assert.equal(Object.hasOwn(byId.get("wrong-shard").verification, "lastPlayedAt"), false);
    assert.deepEqual(byId.get("legacy-message").verification.account, {
      state: "unknown",
      evidence: "fresh_cache",
      observedAt: fresh
    });
    assert.deepEqual(byId.get("read-error").verification.account, { state: "unknown", evidence: "cache_miss" });
    assert.doesNotMatch(response.body, /RIOT_API_KEY|cache read failed/u);
    assert.equal(client.getRiotCallCount(), 0);
  });
});
