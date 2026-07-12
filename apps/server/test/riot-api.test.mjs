import test from "node:test";
import assert from "node:assert/strict";

process.env.RIOT_API_KEY = "riot-test-key";
process.env.RIOT_ACCOUNT_REGION = "asia";
process.env.RIOT_LOL_PLATFORM = "kr";

const { RiotApiClient, RiotApiHttpError, RiotApiNetworkError, RiotRateLimitError, RiotRequestLimiter } = await import("../dist/services/riot-api.js");
const { appConfig } = await import("../dist/config.js");

const originalFetch = globalThis.fetch;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test.after(() => {
  globalThis.fetch = originalFetch;
});

test("RiotApiClient는 Riot ID와 랭크 전적을 조회한다", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), token: init?.headers?.["X-Riot-Token"] });
    const target = String(url);
    if (target.includes("/riot/account/v1/accounts/by-riot-id/")) {
      return jsonResponse({ puuid: "puuid-1", gameName: "HideOnBush", tagLine: "KR1" });
    }
    if (target.includes("/lol/summoner/v4/summoners/by-puuid/")) {
      return jsonResponse({
        puuid: "puuid-1",
        profileIconId: 29,
        revisionDate: 1,
        summonerLevel: 421
      });
    }
    if (target.includes("/lol/league/v4/entries/by-puuid/")) {
      return jsonResponse([
        { queueType: "RANKED_FLEX_SR", tier: "EMERALD", rank: "IV", leaguePoints: 11, wins: 44, losses: 39 },
        { queueType: "RANKED_SOLO_5x5", tier: "DIAMOND", rank: "II", leaguePoints: 64, wins: 92, losses: 74 }
      ]);
    }
    return jsonResponse({ status: { message: "not found" } }, 404);
  };

  const client = new RiotApiClient();
  const account = await client.getAccountByRiotId("HideOnBush", "KR1");
  const stats = await client.getRankedStatsByPuuid("puuid-1");

  assert.equal(account?.puuid, "puuid-1");
  assert.equal(stats?.queueType, "RANKED_SOLO_5x5");
  assert.equal(stats?.tier, "DIAMOND");
  assert.equal(stats?.rank, "II");
  assert.equal(stats?.leaguePoints, 64);
  assert.equal(stats?.wins, 92);
  assert.equal(stats?.losses, 74);
  assert.equal(stats?.winRate, 55);
  assert.equal(stats?.summonerLevel, 421);
  assert.equal(stats?.tierIconUrl, "/riot/ranked-emblems/diamond.png?v=ranked-emblems-1");
  assert.ok(calls.some((call) => call.url.startsWith("https://asia.api.riotgames.com/riot/account/v1/")));
  assert.ok(calls.some((call) => call.url.startsWith("https://kr.api.riotgames.com/lol/summoner/v4/")));
  assert.ok(calls.some((call) => call.url.startsWith("https://kr.api.riotgames.com/lol/league/v4/entries/by-puuid/")));
  assert.equal(calls.some((call) => call.url.includes("/lol/league/v4/entries/by-summoner/")), false);
  assert.ok(calls.every((call) => call.token === "riot-test-key"));
});

test("RiotApiClient는 솔로랭크, 자유랭크, 5v5 랭크를 각각 반환한다", async () => {
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/lol/summoner/v4/summoners/by-puuid/")) {
      return jsonResponse({
        puuid: "puuid-three-ranks",
        profileIconId: 31,
        revisionDate: 1,
        summonerLevel: 512
      });
    }
    if (target.includes("/lol/league/v4/entries/by-puuid/")) {
      return jsonResponse([
        { queueType: "RANKED_TEAM_5x5", tier: "GOLD", rank: "I", leaguePoints: 22, wins: 20, losses: 10 },
        { queueType: "RANKED_FLEX_SR", tier: "EMERALD", rank: "IV", leaguePoints: 11, wins: 44, losses: 39 },
        { queueType: "RANKED_SOLO_5x5", tier: "DIAMOND", rank: "II", leaguePoints: 64, wins: 92, losses: 74 }
      ]);
    }
    return jsonResponse({ status: { message: "not found" } }, 404);
  };

  const client = new RiotApiClient();
  const stats = await client.getRankedQueueStatsByPuuid("puuid-three-ranks");

  assert.equal(stats.solo?.queueType, "RANKED_SOLO_5x5");
  assert.equal(stats.flex?.queueType, "RANKED_FLEX_SR");
  assert.equal(stats.ranked5v5?.queueType, "RANKED_TEAM_5x5");
  assert.equal(stats.ranked5v5?.tier, "GOLD");
  assert.equal(stats.ranked5v5?.summonerLevel, 512);
  assert.equal(stats.primary?.queueType, "RANKED_SOLO_5x5");
});

test("RiotApiClient는 랭크 기록이 없으면 UNRANKED 전적을 반환한다", async () => {
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/lol/summoner/v4/summoners/by-puuid/")) {
      return jsonResponse({
        puuid: "puuid-2",
        profileIconId: 30,
        revisionDate: 1,
        summonerLevel: 89
      });
    }
    if (target.includes("/lol/league/v4/entries/by-puuid/")) return jsonResponse([]);
    return jsonResponse({ status: { message: "not found" } }, 404);
  };

  const client = new RiotApiClient();
  const stats = await client.getRankedStatsByPuuid("puuid-2");

  assert.equal(stats?.queueType, "UNRANKED");
  assert.equal(stats?.tier, "UNRANKED");
  assert.equal(stats?.summonerLevel, 89);
  assert.equal(stats?.winRate, 0);
  assert.equal(stats?.tierIconUrl, undefined);
});

test("RiotApiClient는 리그 목록에서 방송자 래더 순위를 계산한다", async () => {
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/lol/summoner/v4/summoners/by-puuid/")) {
      return jsonResponse({
        id: "summoner-target",
        puuid: "puuid-1",
        profileIconId: 29,
        revisionDate: 1,
        summonerLevel: 421
      });
    }
    if (target.includes("/lol/league/v4/entries/by-puuid/")) {
      return jsonResponse([
        {
          leagueId: "league-diamond-1",
          summonerId: "summoner-target",
          queueType: "RANKED_SOLO_5x5",
          tier: "DIAMOND",
          rank: "II",
          leaguePoints: 64,
          wins: 92,
          losses: 74
        }
      ]);
    }
    if (target.includes("/lol/league/v4/leagues/league-diamond-1")) {
      return jsonResponse({
        leagueId: "league-diamond-1",
        entries: [
          { summonerId: "summoner-a", leaguePoints: 90, rank: "II", wins: 100, losses: 70 },
          { summonerId: "summoner-target", leaguePoints: 64, rank: "II", wins: 92, losses: 74 },
          { summonerId: "summoner-b", leaguePoints: 64, rank: "II", wins: 80, losses: 70 }
        ]
      });
    }
    return jsonResponse({ status: { message: "not found" } }, 404);
  };

  const client = new RiotApiClient();
  const rank = await client.getLadderRankByPuuid("puuid-1", ["RANKED_SOLO_5x5"]);

  assert.equal(rank, 2);
});

test("RiotApiClient는 리그 목록 식별자가 없어도 랭크 수치로 래더 순위를 계산한다", async () => {
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/lol/summoner/v4/summoners/by-puuid/")) {
      return jsonResponse({
        puuid: "puuid-1",
        profileIconId: 29,
        revisionDate: 1,
        summonerLevel: 421
      });
    }
    if (target.includes("/lol/league/v4/entries/by-puuid/")) {
      return jsonResponse([
        {
          leagueId: "league-diamond-1",
          queueType: "RANKED_SOLO_5x5",
          tier: "DIAMOND",
          rank: "II",
          leaguePoints: 64,
          wins: 92,
          losses: 74
        }
      ]);
    }
    if (target.includes("/lol/league/v4/leagues/league-diamond-1")) {
      return jsonResponse({
        leagueId: "league-diamond-1",
        entries: [
          { leaguePoints: 90, rank: "II", wins: 100, losses: 70 },
          { leaguePoints: 64, rank: "II", wins: 92, losses: 74 },
          { leaguePoints: 64, rank: "II", wins: 80, losses: 70 }
        ]
      });
    }
    return jsonResponse({ status: { message: "not found" } }, 404);
  };

  const client = new RiotApiClient();
  const rank = await client.getLadderRankByPuuid("puuid-1", ["RANKED_SOLO_5x5"]);

  assert.equal(rank, 2);
});

test("RiotApiClient는 현재 진행 중인 게임을 PUUID로 조회한다", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), token: init?.headers?.["X-Riot-Token"] });
    if (String(url).includes("/lol/spectator/v5/active-games/by-summoner/")) {
      return jsonResponse({
        gameId: 123456789,
        gameStartTime: 1760000000000,
        gameMode: "CLASSIC",
        participants: [
          { puuid: "streamer-puuid", championId: 103, teamId: 100 }
        ]
      });
    }
    return jsonResponse({ status: { message: "not found" } }, 404);
  };

  const client = new RiotApiClient();
  const game = await client.getCurrentGameByPuuid("streamer-puuid");

  assert.equal(game?.gameId, 123456789);
  assert.equal(game?.participants[0].puuid, "streamer-puuid");
  assert.ok(calls[0].url.startsWith("https://kr.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/"));
  assert.equal(calls[0].token, "riot-test-key");
});

test("RiotApiClient는 웹 저장 key를 env보다 우선 사용한다", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), token: init?.headers?.["X-Riot-Token"] });
    return jsonResponse({ puuid: "puuid-runtime", gameName: "Runtime", tagLine: "KR1" });
  };

  const client = new RiotApiClient({
    getApiKey() {
      return "RGAPI-runtime-secret-key";
    },
    getUpdatedAt() {
      return "2026-06-22T00:00:00.000Z";
    },
    setApiKey() {
      throw new Error("setApiKey가 호출되면 안 됩니다.");
    },
    clearApiKey() {
      throw new Error("clearApiKey가 호출되면 안 됩니다.");
    }
  });

  const account = await client.getAccountByRiotId("Runtime", "KR1");
  const status = client.credentialStatus();

  assert.equal(account?.puuid, "puuid-runtime");
  assert.equal(calls[0].token, "RGAPI-runtime-secret-key");
  assert.equal(status.source, "runtime");
  assert.equal(status.maskedKey, "RGAPI-...-key");
  assert.equal(status.updatedAt, "2026-06-22T00:00:00.000Z");
});

test("RiotApiClient는 일본 서버 별칭 jp를 jp1 host로 정규화한다", async () => {
  const previousPlatform = appConfig.riot.lolPlatform;
  const calls = [];
  try {
    appConfig.riot.lolPlatform = "jp";
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), token: init?.headers?.["X-Riot-Token"] });
      return jsonResponse({
        gameId: 123456789,
        gameStartTime: 1760000000000,
        gameMode: "CLASSIC",
        participants: []
      });
    };

    const client = new RiotApiClient();
    await client.getCurrentGameByPuuid("streamer-puuid");

    assert.ok(calls[0].url.startsWith("https://jp1.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/"));
    assert.equal(calls[0].token, "riot-test-key");
  } finally {
    appConfig.riot.lolPlatform = previousPlatform;
  }
});

test("RiotApiClient는 enabledQueues를 Match-V5 queue query로 전달하고 중복 match id를 제거한다", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), token: init?.headers?.["X-Riot-Token"] });
    const target = String(url);
    if (target.includes("queue=420")) return jsonResponse(["KR_1", "KR_2"]);
    if (target.includes("queue=440")) return jsonResponse(["KR_2", "KR_3"]);
    return jsonResponse([]);
  };

  const client = new RiotApiClient();
  const ids = await client.getRecentMatchIdsByPuuid("puuid-queue", 20, [420, 440, 420]);

  assert.deepEqual(ids, ["KR_1", "KR_2", "KR_3"]);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.url.startsWith("https://asia.api.riotgames.com/lol/match/v5/")));
  assert.ok(calls.some((call) => call.url.includes("queue=420")));
  assert.ok(calls.some((call) => call.url.includes("queue=440")));
});

test("RiotRequestLimiter는 host별 window limit를 넘지 않도록 요청 시작을 지연한다", async () => {
  const startedAt = [];
  const limiter = new RiotRequestLimiter({
    windows: [{ limit: 2, windowMs: 40 }],
    maxQueueSize: 10
  });
  const started = Date.now();

  await Promise.all([0, 1, 2].map((value) => limiter.schedule("kr.api.riotgames.com", async () => {
    startedAt.push(Date.now() - started);
    return value;
  })));

  assert.equal(startedAt.length, 3);
  assert.ok(startedAt[0] < 30);
  assert.ok(startedAt[1] < 30);
  assert.ok(startedAt[2] >= 35);
});

test("RiotApiClient는 429 Retry-After 동안 같은 host 요청을 멈춘다", async () => {
  const calledAt = [];
  let calls = 0;
  globalThis.fetch = async () => {
    calledAt.push(Date.now());
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ status: { message: "Rate limit exceeded" } }), {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": "0.05"
        }
      });
    }
    return jsonResponse({
      puuid: "puuid-after-retry",
      profileIconId: 30,
      revisionDate: 1,
      summonerLevel: 89
    });
  };

  const client = new RiotApiClient(undefined, {
    rateLimiter: new RiotRequestLimiter({
      windows: [{ limit: 100, windowMs: 1_000 }],
      maxQueueSize: 10
    })
  });

  await assert.rejects(
    () => client.getSummonerByPuuid("puuid-rate-limited"),
    (error) => {
      assert.ok(error instanceof RiotRateLimitError);
      assert.equal(error.retryAfterMs, 50);
      return true;
    }
  );
  const summoner = await client.getSummonerByPuuid("puuid-after-retry");

  assert.equal(summoner?.puuid, "puuid-after-retry");
  assert.equal(calledAt.length, 2);
  assert.ok(calledAt[1] - calledAt[0] >= 45);
});

test("RiotApiClient는 HTTP 실패에 route와 host를 포함하되 token은 포함하지 않는다", async () => {
  globalThis.fetch = async () => jsonResponse({ status: { message: "Forbidden" } }, 403);

  const client = new RiotApiClient();
  await assert.rejects(
    () => client.getSummonerByPuuid("puuid-403"),
    (error) => {
      assert.ok(error instanceof RiotApiHttpError);
      assert.equal(error.status, 403);
      assert.equal(error.route, "summoner.by_puuid");
      assert.equal(error.host, "kr.api.riotgames.com");
      assert.match(error.message, /403/);
      assert.doesNotMatch(error.message, /riot-test-key/);
      return true;
    }
  );
});

test("RiotApiClient는 network 실패에 원인 code와 host를 포함한다", async () => {
  globalThis.fetch = async () => {
    const error = new TypeError("fetch failed");
    error.cause = Object.assign(new Error("getaddrinfo ENOTFOUND kr.api.riotgames.com"), { code: "ENOTFOUND" });
    throw error;
  };

  const client = new RiotApiClient();
  await assert.rejects(
    () => client.getChampionMasteryTopByPuuid("puuid-network"),
    (error) => {
      assert.ok(error instanceof RiotApiNetworkError);
      assert.equal(error.route, "champion_mastery.top");
      assert.equal(error.host, "kr.api.riotgames.com");
      assert.equal(error.causeCode, "ENOTFOUND");
      assert.match(error.message, /ENOTFOUND/);
      assert.doesNotMatch(error.message, /riot-test-key/);
      return true;
    }
  );
});

test("RiotApiClient는 응답이 없는 외부 요청을 timeout으로 중단한다", async () => {
  const previousTimeout = appConfig.riot.apiTimeoutMs;
  const keepAlive = setTimeout(() => undefined, 1_000);
  appConfig.riot.apiTimeoutMs = 10;
  globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  });
  try {
    const client = new RiotApiClient();
    await assert.rejects(
      () => client.getAccountByRiotId("Timeout", "JP1"),
      (error) => error instanceof RiotApiNetworkError && /timed out|timeout/i.test(error.message)
    );
  } finally {
    clearTimeout(keepAlive);
    appConfig.riot.apiTimeoutMs = previousTimeout;
  }
});
