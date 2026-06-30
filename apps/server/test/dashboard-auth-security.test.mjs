import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const { DashboardSessionStore, DASHBOARD_SESSION_COOKIE, authorizeHttpRequest } = await import("../dist/security/auth.js");
const { PUBLIC_TWITCH_VIEWER_SESSION_COOKIE } = await import("../dist/services/public-twitch-auth.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");

const DASHBOARD_ORIGIN = "http://localhost:3000";
const AUTH_TOKEN = "dashboard_auth_token_for_security_tests_1234567890";

function createRequest(method, url, body, headers = {}) {
  return {
    method,
    url,
    headers,
    socket: { remoteAddress: "127.0.0.1" },
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body));
    }
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

function cookieHeader(setCookie) {
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.equal(typeof value, "string");
  return value.split(";")[0];
}

async function withAuthConfig(run) {
  const previous = {
    token: appConfig.security.dashboardAuthToken,
    localNoAuth: appConfig.security.localNoAuth,
    corsOrigins: [...appConfig.security.corsOrigins],
    nodeEnv: appConfig.nodeEnv,
    sessionTtl: appConfig.security.dashboardSessionTtlMs
  };
  resetSecurityRateLimiters();
  appConfig.security.dashboardAuthToken = AUTH_TOKEN;
  appConfig.security.localNoAuth = false;
  appConfig.security.corsOrigins = [DASHBOARD_ORIGIN];
  appConfig.nodeEnv = "development";
  appConfig.security.dashboardSessionTtlMs = 60_000;
  try {
    await run();
  } finally {
    appConfig.security.dashboardAuthToken = previous.token;
    appConfig.security.localNoAuth = previous.localNoAuth;
    appConfig.security.corsOrigins = previous.corsOrigins;
    appConfig.nodeEnv = previous.nodeEnv;
    appConfig.security.dashboardSessionTtlMs = previous.sessionTtl;
    resetSecurityRateLimiters();
  }
}

function handlerWithSessionStore(sessionStore, dispatched = []) {
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: {
      async dispatchOne(action, ctx, reason) {
        dispatched.push({ action, ctx, reason });
      }
    },
    sessions: sessionStore
  });
}

const testAction = {
  type: "overlay.banner",
  title: "인증 테스트",
  message: "CSRF 검증용 action입니다.",
  variant: "info",
  durationMs: 1000,
  source: "security.test"
};

test("dashboard token이 없고 local no-auth가 아니면 로그인 상태로 처리하지 않는다", async () => {
  await withAuthConfig(async () => {
    appConfig.security.dashboardAuthToken = "";
    appConfig.security.localNoAuth = false;
    const handler = handlerWithSessionStore(new DashboardSessionStore());

    const statusReq = createRequest("GET", "/api/dashboard/auth/status", undefined, { origin: DASHBOARD_ORIGIN });
    const statusRes = createResponse();
    await handler(statusReq, statusRes);

    assert.equal(statusRes.statusCode, 200);
    assert.deepEqual(JSON.parse(statusRes.body), {
      required: true,
      configured: false,
      authenticated: false
    });

    const loginReq = createRequest("POST", "/api/dashboard/auth/check", { token: "anything" }, { origin: DASHBOARD_ORIGIN });
    const loginRes = createResponse();
    await handler(loginReq, loginRes);

    assert.equal(loginRes.statusCode, 401);
    assert.deepEqual(JSON.parse(loginRes.body), {
      required: true,
      configured: false,
      authenticated: false
    });

    const apiReq = createRequest("GET", "/api/status", undefined, { origin: DASHBOARD_ORIGIN });
    const apiRes = createResponse();
    await handler(apiReq, apiRes);

    assert.equal(apiRes.statusCode, 401);
    assert.equal(JSON.parse(apiRes.body).code, "AUTH_REQUIRED");
  });
});

test("공개 LoL 전적 API는 dashboard 세션 없이 접근할 수 있다", async () => {
  await withAuthConfig(async () => {
    const handler = handlerWithSessionStore(new DashboardSessionStore());
    const req = createRequest("GET", "/api/lol/profile?riotId=HideOnBush%23JP1", undefined, { origin: DASHBOARD_ORIGIN });
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 503);
    assert.match(JSON.parse(res.body).error, /Riot API client/);
  });
});

test("공개 LoL 전적 API는 JP1이 아닌 tagLine도 허용한다", async () => {
  await withAuthConfig(async () => {
    const handler = handlerWithSessionStore(new DashboardSessionStore());
    const req = createRequest("GET", "/api/lol/profile?riotId=HideOnBush%23KR1", undefined, { origin: DASHBOARD_ORIGIN });
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 503);
    assert.match(JSON.parse(res.body).error, /Riot API client/);
  });
});

test("공개 Twitch 팔로우 전적 API는 viewer 세션으로 팔로우 방송인 Riot ID를 매칭한다", async () => {
  await withAuthConfig(async () => {
    const handler = createHttpHandler({
      store: {
        getParticipationQueue() {
          return [{
            id: "entry-1",
            twitchUserId: "55",
            twitchUserName: "Streamer",
            riotGameName: "Seiga",
            riotTagLine: "JP1",
            rankedStats: { queueType: "RANKED_SOLO_5x5", tier: "DIAMOND", rank: "II", leaguePoints: 35, wins: 12, losses: 8, winRate: 60 },
            status: "played",
            createdAt: "2026-06-26T00:00:00.000Z",
            updatedAt: "2026-06-26T00:00:00.000Z"
          }];
        }
      },
      twitchAuth: {
        async getStatus() {
          return { connected: false };
        }
      },
      publicTwitchAuth: {
        async getAccessContext(sessionId) {
          assert.equal(sessionId, "viewer-session");
          return {
            clientId: "client-id",
            accessToken: "viewer-access",
            userId: "999",
            scopes: ["user:read:follows", "user:read:subscriptions"]
          };
        }
      },
      twitch: {
        async getFollowedChannels(context, limit) {
          assert.equal(context.userId, "999");
          assert.equal(limit, 100);
          return {
            total: 1,
            truncated: false,
            channels: [{
              broadcasterId: "55",
              broadcasterLogin: "streamer",
              broadcasterName: "Streamer",
              profileImageUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/streamer.png",
              followedAt: "2026-06-26T00:00:00Z"
            }]
          };
        },
        async getStreamsByUserIds(_context, userIds) {
          assert.deepEqual(userIds, ["55"]);
          return new Map([["55", {
            userId: "55",
            userLogin: "streamer",
            userName: "Streamer",
            title: "랭크 방송",
            gameName: "League of Legends",
            viewerCount: 77,
            startedAt: "2026-06-26T01:00:00Z"
          }]]);
        },
        async checkUserSubscriptions(context, broadcasterIds) {
          assert.equal(context.userId, "999");
          assert.deepEqual(broadcasterIds, ["55"]);
          return new Map([["55", {
            broadcasterId: "55",
            broadcasterLogin: "streamer",
            broadcasterName: "Streamer",
            tier: "1000",
            isGift: false
          }]]);
        }
      },
      actions: {
        async dispatchOne() {}
      },
      sessions: new DashboardSessionStore()
    });
    const req = createRequest("GET", "/api/public/twitch/followed-lol", undefined, {
      origin: DASHBOARD_ORIGIN,
      cookie: `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=viewer-session`
    });
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.connected, true);
    assert.equal(body.matchedCount, 1);
    assert.equal(body.channels[0].riotId, "Seiga#JP1");
    assert.equal(body.channels[0].isLive, true);
    assert.equal(body.channels[0].profileImageUrl, "https://static-cdn.jtvnw.net/jtv_user_pictures/streamer.png");
    assert.equal(body.channels[0].rankedStats.tier, "DIAMOND");
    assert.equal(body.subscriptionScopeGranted, true);
    assert.equal(body.subscriptions[0].twitchUserId, "55");
    assert.equal(body.subscriptions[0].tierLabel, "Tier 1");
  });
});

test("공개 LoL 전적 API는 솔로랭크, 자유랭크, 5v5 랭크를 모두 응답한다", async () => {
  await withAuthConfig(async () => {
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      },
      sessions: new DashboardSessionStore(),
      riot: {
        isConfigured() {
          return true;
        },
        routingStatus() {
          return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" };
        },
        async getAccountByRiotId(gameName, tagLine) {
          return { puuid: "three-ranks-puuid", gameName, tagLine };
        },
        async getRankedQueueStatsByPuuid() {
          return {
            solo: { queueType: "RANKED_SOLO_5x5", tier: "DIAMOND", rank: "II", leaguePoints: 64, wins: 92, losses: 74, winRate: 55, fetchedAt: "2026-06-26T00:00:00.000Z" },
            flex: { queueType: "RANKED_FLEX_SR", tier: "EMERALD", rank: "IV", leaguePoints: 11, wins: 44, losses: 39, winRate: 53, fetchedAt: "2026-06-26T00:00:00.000Z" },
            ranked5v5: { queueType: "RANKED_TEAM_5x5", tier: "GOLD", rank: "I", leaguePoints: 22, wins: 20, losses: 10, winRate: 67, fetchedAt: "2026-06-26T00:00:00.000Z" },
            primary: { queueType: "RANKED_SOLO_5x5", tier: "DIAMOND", rank: "II", leaguePoints: 64, wins: 92, losses: 74, winRate: 55, fetchedAt: "2026-06-26T00:00:00.000Z" }
          };
        },
        async getLadderRankByPuuid() {
          return undefined;
        },
        async getChampionMasteryTopByPuuid() {
          return [];
        },
        async getRecentMatchIdsByPuuid() {
          return [];
        }
      }
    });
    const req = createRequest("GET", "/api/lol/profile?riotId=HideOnBush%23KR1", undefined, { origin: DASHBOARD_ORIGIN });
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.rankedQueues.solo.queueType, "RANKED_SOLO_5x5");
    assert.equal(body.rankedQueues.flex.queueType, "RANKED_FLEX_SR");
    assert.equal(body.rankedQueues.ranked5v5.queueType, "RANKED_TEAM_5x5");
  });
});

test("공개 LoL 경기 티어 API는 펼친 경기 참가자 랭크만 조회하고 PUUID를 노출하지 않는다", async () => {
  await withAuthConfig(async () => {
    const rankedCalls = [];
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      },
      sessions: new DashboardSessionStore(),
      riot: {
        isConfigured() {
          return true;
        },
        routingStatus() {
          return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" };
        },
        async getMatch(matchId) {
          assert.equal(matchId, "JP1_100");
          return {
            metadata: { matchId: "JP1_100", participants: ["ally-puuid", "enemy-puuid"] },
            info: {
              participants: [
                { puuid: "ally-puuid", teamId: 100, championId: 103, riotIdGameName: "Ally", riotIdTagline: "JP1", individualPosition: "MIDDLE" },
                { puuid: "enemy-puuid", teamId: 200, championId: 238, riotIdGameName: "Enemy", riotIdTagline: "JP1", individualPosition: "TOP" }
              ]
            }
          };
        },
        async getRankedStatsByPuuid(puuid) {
          rankedCalls.push(puuid);
          return puuid === "ally-puuid"
            ? { queueType: "RANKED_SOLO_5x5", tier: "DIAMOND", rank: "II", leaguePoints: 64, wins: 92, losses: 74, winRate: 55, fetchedAt: "2026-06-26T00:00:00.000Z" }
            : { queueType: "RANKED_SOLO_5x5", tier: "GOLD", rank: "I", leaguePoints: 22, wins: 40, losses: 35, winRate: 53, fetchedAt: "2026-06-26T00:00:00.000Z" };
        }
      }
    });
    const req = createRequest("GET", "/api/lol/match-ranks?matchId=JP1_100", undefined, { origin: DASHBOARD_ORIGIN });
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.matchId, "JP1_100");
    assert.deepEqual(rankedCalls.sort(), ["ally-puuid", "enemy-puuid"]);
    assert.deepEqual(body.participants.map((item) => ({
      riotId: item.riotId,
      teamId: item.teamId,
      championId: item.championId,
      position: item.position,
      tier: item.rankedStats?.tier
    })), [
      { riotId: "Ally#JP1", teamId: 100, championId: 103, position: "MIDDLE", tier: "DIAMOND" },
      { riotId: "Enemy#JP1", teamId: 200, championId: 238, position: "TOP", tier: "GOLD" }
    ]);
    assert.equal(JSON.stringify(body).includes("puuid"), false);
  });
});

test("공개 LoL 경기 티어 API는 Riot 랭크 조회 실패 시 저장된 랭크를 fallback으로 사용한다", async () => {
  await withAuthConfig(async () => {
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      },
      sessions: new DashboardSessionStore(),
      profileRepository: {
        getByRiotId(gameName, tagLine) {
          if (gameName === "Ally" && tagLine === "JP1") {
            return {
              rankedStats: {
                queueType: "RANKED_SOLO_5x5",
                tier: "PLATINUM",
                rank: "II",
                leaguePoints: 58,
                wins: 80,
                losses: 70,
                winRate: 53,
                fetchedAt: "2026-06-26T00:00:00.000Z"
              }
            };
          }
          return undefined;
        }
      },
      riot: {
        isConfigured() {
          return true;
        },
        routingStatus() {
          return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" };
        },
        async getMatch(matchId) {
          return {
            metadata: { matchId, participants: ["ally-puuid", "enemy-puuid"] },
            info: {
              participants: [
                { puuid: "ally-puuid", teamId: 100, championId: 103, riotIdGameName: "Ally", riotIdTagline: "JP1", individualPosition: "MIDDLE" },
                { puuid: "enemy-puuid", teamId: 200, championId: 238, riotIdGameName: "Enemy", riotIdTagline: "JP1", individualPosition: "TOP" }
              ]
            }
          };
        },
        async getRankedStatsByPuuid() {
          throw new Error("Riot 랭크 조회 실패");
        }
      }
    });
    const req = createRequest("GET", "/api/lol/match-ranks?matchId=JP1_101", undefined, { origin: DASHBOARD_ORIGIN });
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.participants[0].rankedStats.tier, "PLATINUM");
    assert.equal(body.participants[1].rankedStats, undefined);
    assert.equal(JSON.stringify(body).includes("puuid"), false);
  });
});

test("공개 LoL 전적 더보기 API는 start offset으로 이전 20게임을 조회한다", async () => {
  await withAuthConfig(async () => {
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      },
      sessions: new DashboardSessionStore(),
      dataDragon: {
        async getLatestVersion() {
          return "16.11.1";
        },
        async mapChampionSummary(input) {
          return {
            championId: input.championId,
            championKey: `Champion${input.championId}`,
            nameKo: `챔피언 ${input.championId}`
          };
        }
      },
      riot: {
        isConfigured() {
          return true;
        },
        routingStatus() {
          return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" };
        },
        async getAccountByRiotId(gameName, tagLine) {
          return { puuid: "target-puuid", gameName, tagLine };
        },
        async getRecentMatchIdsByPuuid(puuid, count, queueIds, start) {
          assert.equal(puuid, "target-puuid");
          assert.equal(count, 20);
          assert.deepEqual(queueIds ?? [], []);
          assert.equal(start, 20);
          return ["older-match"];
        },
        async getMatch(matchId) {
          assert.equal(matchId, "older-match");
          return {
            metadata: { matchId, participants: ["target-puuid"] },
            info: {
              gameCreation: 1760000000000,
              gameDuration: 1800,
              queueId: 420,
              teams: [{ teamId: 100, win: true, objectives: {} }],
              participants: [{
                puuid: "target-puuid",
                teamId: 100,
                championId: 103,
                championName: "Ahri",
                individualPosition: "MIDDLE",
                kills: 3,
                deaths: 1,
                assists: 4,
                win: true
              }]
            }
          };
        }
      }
    });
    const req = createRequest("GET", "/api/lol/matches?riotId=HideOnBush%23KR1&start=20", undefined, { origin: DASHBOARD_ORIGIN });
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.recentMatchStart, 20);
    assert.equal(body.hasMoreRecentMatches, false);
    assert.deepEqual(body.recentMatches.map((match) => match.matchId), ["older-match"]);
  });
});

test("공개 LoL 전적 API는 현재 게임 중 상태를 응답하고 PUUID를 노출하지 않는다", async () => {
  await withAuthConfig(async () => {
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      },
      sessions: new DashboardSessionStore(),
      dataDragon: {
        async getLatestVersion() {
          return "16.11.1";
        },
        async mapChampionSummary(input) {
          return {
            championId: input.championId,
            championKey: `Champion${input.championId}`,
            nameKo: `챔피언 ${input.championId}`
          };
        }
      },
      riot: {
        isConfigured() {
          return true;
        },
        routingStatus() {
          return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" };
        },
        async getAccountByRiotId(gameName, tagLine) {
          return { puuid: "target-puuid", gameName, tagLine };
        },
        async getRankedStatsByPuuid(puuid) {
          if (puuid === "target-puuid") {
            return {
              queueType: "RANKED_SOLO_5x5",
              tier: "EMERALD",
              rank: "IV",
              leaguePoints: 76,
              wins: 10,
              losses: 8,
              winRate: 56,
              profileIconId: 498,
              fetchedAt: "2026-06-30T00:00:00.000Z"
            };
          }
          if (puuid === "enemy-puuid") {
            return {
              queueType: "RANKED_SOLO_5x5",
              tier: "PLATINUM",
              rank: "II",
              leaguePoints: 20,
              wins: 12,
              losses: 10,
              winRate: 55,
              profileIconId: 29,
              fetchedAt: "2026-06-30T00:00:00.000Z"
            };
          }
          return undefined;
        },
        async getLadderRankByPuuid() {
          return undefined;
        },
        async getChampionMasteryTopByPuuid() {
          return [];
        },
        async getRecentMatchIdsByPuuid() {
          return [];
        },
        async getCurrentGameByPuuid(puuid) {
          assert.equal(puuid, "target-puuid");
          return {
            gameId: 123456,
            gameStartTime: 1760000000000,
            gameLength: 600,
            gameMode: "CLASSIC",
            gameQueueConfigId: 420,
            participants: [
              { puuid: "target-puuid", riotId: "HideOnBush#KR1", teamId: 100, championId: 103, spell1Id: 4, spell2Id: 14, profileIconId: 498 },
              { puuid: "enemy-puuid", riotId: "Enemy#JP1", teamId: 200, championId: 238, spell1Id: 4, spell2Id: 3, profileIconId: 29 }
            ]
          };
        }
      }
    });
    const req = createRequest("GET", "/api/lol/profile?riotId=HideOnBush%23KR1", undefined, { origin: DASHBOARD_ORIGIN });
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.liveGame.isLive, true);
    assert.equal(body.liveGame.status, "live");
    assert.equal(body.liveGame.lolPlatform, "jp1");
    assert.equal(body.liveGame.queueId, 420);
    assert.equal(body.liveGame.participants[0].isTarget, true);
    assert.equal(body.liveGame.participants[0].riotId, "HideOnBush#KR1");
    assert.deepEqual(body.liveGame.participants[0].summonerSpells, [4, 14]);
    assert.equal(body.liveGame.participants[0].rankedStats.tier, "EMERALD");
    assert.equal(body.liveGame.participants[0].profileIconUrl, "https://ddragon.leagueoflegends.com/cdn/16.11.1/img/profileicon/498.png");
    assert.equal(JSON.stringify(body.liveGame).includes("puuid"), false);
  });
});

test("공개 LoL 전적 캐시는 인게임 상태만 짧게 다시 조회한다", async () => {
  await withAuthConfig(async () => {
    const originalDateNow = Date.now;
    let now = 1_000_000;
    Date.now = () => now;
    try {
      let accountLookups = 0;
      let currentGameLookups = 0;
      const handler = createHttpHandler({
        store: {},
        twitchAuth: {},
        actions: {
          async dispatchOne() {}
        },
        sessions: new DashboardSessionStore(),
        dataDragon: {
          async mapChampionSummary(input) {
            return {
              championId: input.championId,
              championKey: `Champion${input.championId}`,
              nameKo: `챔피언 ${input.championId}`
            };
          }
        },
        riot: {
          isConfigured() {
            return true;
          },
          routingStatus() {
            return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" };
          },
          async getAccountByRiotId(gameName, tagLine) {
            accountLookups += 1;
            return { puuid: "cached-live-puuid", gameName, tagLine };
          },
          async getRankedStatsByPuuid() {
            return undefined;
          },
          async getLadderRankByPuuid() {
            return undefined;
          },
          async getChampionMasteryTopByPuuid() {
            return [];
          },
          async getRecentMatchIdsByPuuid() {
            return [];
          },
          async getCurrentGameByPuuid(puuid) {
            assert.equal(puuid, "cached-live-puuid");
            currentGameLookups += 1;
            if (currentGameLookups === 1) return null;
            return {
              gameId: 987654,
              gameStartTime: 1760000000000,
              gameLength: 300,
              gameMode: "CLASSIC",
              gameQueueConfigId: 420,
              participants: [
                { puuid: "cached-live-puuid", riotId: "HideOnBush#KR1", teamId: 100, championId: 103 }
              ]
            };
          }
        }
      });

      const firstReq = createRequest("GET", "/api/lol/profile?riotId=HideOnBush%23KR1", undefined, { origin: DASHBOARD_ORIGIN });
      const firstRes = createResponse();
      await handler(firstReq, firstRes);

      now += 6_000;

      const secondReq = createRequest("GET", "/api/lol/profile?riotId=hideonbush%23kr1", undefined, { origin: DASHBOARD_ORIGIN });
      const secondRes = createResponse();
      await handler(secondReq, secondRes);

      assert.equal(firstRes.statusCode, 200);
      assert.equal(secondRes.statusCode, 200);
      assert.equal(JSON.parse(firstRes.body).liveGame.status, "not_found");
      assert.equal(JSON.parse(secondRes.body).liveGame.status, "live");
      assert.equal(accountLookups, 1);
      assert.equal(currentGameLookups, 2);
    } finally {
      Date.now = originalDateNow;
    }
  });
});

test("공개 LoL 연관검색 API는 정확한 Riot ID를 실제 계정으로 확인한다", async () => {
  await withAuthConfig(async () => {
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      },
      sessions: new DashboardSessionStore(),
      riot: {
        isConfigured() {
          return true;
        },
        routingStatus() {
          return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" };
        },
        async getAccountByRiotId(gameName, tagLine) {
          assert.equal(gameName, "HideOnBush");
          assert.equal(tagLine, "KR1");
          return { puuid: "target-puuid", gameName, tagLine };
        }
      }
    });
    const req = createRequest("GET", "/api/lol/suggestions?q=HideOnBush%23KR1", undefined, { origin: DASHBOARD_ORIGIN });
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body).suggestions.map((item) => ({
      riotId: item.riotId,
      source: item.source,
      lolPlatform: item.lolPlatform
    })), [
      { riotId: "HideOnBush#KR1", source: "verified", lolPlatform: "jp1" }
    ]);
  });
});

test("공개 LoL 연관검색 API는 정확한 Riot ID 후보에 티어와 소환사 아이콘을 포함한다", async () => {
  await withAuthConfig(async () => {
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      },
      sessions: new DashboardSessionStore(),
      dataDragon: {
        async getLatestVersion() {
          return "16.11.1";
        }
      },
      riot: {
        isConfigured() {
          return true;
        },
        routingStatus() {
          return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" };
        },
        async getAccountByRiotId(gameName, tagLine) {
          return { puuid: "suggestion-puuid", gameName, tagLine };
        },
        async getRankedStatsByPuuid(puuid) {
          assert.equal(puuid, "suggestion-puuid");
          return {
            queueType: "RANKED_SOLO_5x5",
            tier: "PLATINUM",
            rank: "II",
            leaguePoints: 58,
            wins: 80,
            losses: 70,
            winRate: 53,
            summonerLevel: 156,
            profileIconId: 498,
            fetchedAt: "2026-06-26T00:00:00.000Z"
          };
        }
      }
    });
    const req = createRequest("GET", "/api/lol/suggestions?q=Seiga%23JP1", undefined, { origin: DASHBOARD_ORIGIN });
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    const [suggestion] = JSON.parse(res.body).suggestions;
    assert.equal(suggestion.riotId, "Seiga#JP1");
    assert.equal(suggestion.rankedStats.tier, "PLATINUM");
    assert.equal(suggestion.rankedStats.rank, "II");
    assert.equal(suggestion.profileIconUrl, "https://ddragon.leagueoflegends.com/cdn/16.11.1/img/profileicon/498.png");
  });
});

test("공개 LoL 전적 API는 실제 경기 상세 지표를 응답한다", async () => {
  await withAuthConfig(async () => {
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      },
      sessions: new DashboardSessionStore(),
      dataDragon: {
        async getLatestVersion() {
          return "15.1.1";
        },
        async mapChampionSummary(input) {
          return {
            championId: input.championId,
            championKey: `Champion${input.championId}`,
            nameKo: `챔피언 ${input.championId}`,
            iconUrl: `/champion/${input.championId}.png`
          };
        }
      },
      riot: {
        isConfigured() {
          return true;
        },
        routingStatus() {
          return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" };
        },
        async getAccountByRiotId(gameName, tagLine) {
          assert.equal(gameName, "HideOnBush");
          assert.equal(tagLine, "KR1");
          return { puuid: "target-puuid", gameName, tagLine };
        },
        async getRankedStatsByPuuid() {
          return {
            queueType: "RANKED_SOLO_5x5",
            tier: "DIAMOND",
            rank: "I",
            leaguePoints: 77,
            wins: 120,
            losses: 100,
            winRate: 55,
            summonerLevel: 501,
            profileIconId: 29,
            fetchedAt: "2026-06-25T00:00:00.000Z"
          };
        },
        async getLadderRankByPuuid() {
          return 42;
        },
        async getChampionMasteryTopByPuuid() {
          return [{ championId: 103, championLevel: 7, championPoints: 123456 }];
        },
        async getRecentMatchIdsByPuuid() {
          return ["JP1_100"];
        },
        async getMatch() {
          return {
            metadata: { matchId: "JP1_100", participants: ["target-puuid", "ally-puuid", "opponent-puuid"] },
            info: {
              gameCreation: 1760000000000,
              gameDuration: 1800,
              gameMode: "CLASSIC",
              gameType: "MATCHED_GAME",
              queueId: 420,
              mapId: 11,
              teams: [
                { teamId: 100, win: true, objectives: { dragon: { kills: 3 }, tower: { kills: 8 } } },
                { teamId: 200, win: false, objectives: { dragon: { kills: 1 }, tower: { kills: 4 } } }
              ],
              participants: [
                {
                  puuid: "target-puuid",
                  riotIdGameName: "HideOnBush",
                  riotIdTagline: "KR1",
                  teamId: 100,
                  championId: 103,
                  championName: "Ahri",
                  champLevel: 15,
                  individualPosition: "MIDDLE",
                  kills: 8,
                  deaths: 2,
                  assists: 7,
                  win: true,
                  goldEarned: 12000,
                  totalDamageDealtToChampions: 24000,
                  totalDamageDealtToObjectives: 5400,
                  totalDamageTaken: 18000,
                  totalMinionsKilled: 180,
                  neutralMinionsKilled: 10,
                  visionScore: 22,
                  wardsPlaced: 8,
                  wardsKilled: 3,
                  detectorWardsPlaced: 2,
                  largestMultiKill: 3,
                  turretKills: 1,
                  inhibitorKills: 1,
                  totalTimeSpentDead: 42,
                  item0: 1055,
                  item1: 6672,
                  summoner1Id: 4,
                  summoner2Id: 14,
                  challenges: {
                    killParticipation: 0.75,
                    damagePerMinute: 800,
                    goldPerMinute: 400,
                    soloKills: 2,
                    visionScorePerMinute: 0.73
                  }
                },
                {
                  puuid: "ally-puuid",
                  teamId: 100,
                  championId: 111,
                  championName: "Nautilus",
                  individualPosition: "UTILITY",
                  kills: 2,
                  deaths: 4,
                  assists: 12,
                  totalDamageDealtToChampions: 16000,
                  totalDamageDealtToObjectives: 1200,
                  goldEarned: 8200
                },
                {
                  puuid: "opponent-puuid",
	                  riotIdGameName: "EnemyMid",
	                  riotIdTagline: "JP1",
	                  teamId: 200,
                  championId: 84,
                  championName: "Akali",
                  individualPosition: "MIDDLE",
	                  kills: 0,
	                  deaths: 12,
	                  assists: 0,
	                  win: false,
	                  totalDamageDealtToChampions: 0,
	                  totalDamageDealtToObjectives: 0,
	                  goldEarned: 4200
                }
              ]
            }
          };
        }
      }
    });
    const req = createRequest("GET", "/api/lol/profile?riotId=HideOnBush%23KR1", undefined, { origin: DASHBOARD_ORIGIN });
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.summary.averageDamagePerMinute, 800);
    assert.equal(body.summary.averageKillParticipation, 75);
    assert.equal(body.summary.averageDamageShare, 60);
    assert.equal(body.championPerformance[0].champion.nameKo, "챔피언 103");
    assert.equal(body.rolePerformance[0].role, "MIDDLE");
    assert.equal(body.recentMatches[0].damageDealtToChampions, 24000);
    assert.equal(body.recentMatches[0].items[0].iconUrl, "https://ddragon.leagueoflegends.com/cdn/15.1.1/img/item/1055.png");
    assert.deepEqual(body.recentMatches[0].summonerSpells, [4, 14]);
	    assert.equal(body.recentMatches[0].team.objectives.dragon, 3);
	    assert.equal(body.recentMatches[0].opponent.riotId, "EnemyMid#JP1");
	    assert.deepEqual(body.recentMatches[0].badges.map((badge) => badge.code), ["mvp", "unstoppable", "tenacity", "damage_carry"]);
    assert.equal(body.recentMatches[0].teams[0].players.length, 2);
    assert.equal(body.recentMatches[0].teams[0].players[0].isTarget, true);
    assert.equal(body.recentMatches[0].teams[0].players[0].badges[0].code, "mvp");
    assert.deepEqual(body.recentMatches[0].teams[1].players[0].badges.map((badge) => badge.code), []);
    assert.equal(body.recentMatches[0].teams[0].players[0].damageObjectiveShare, 81.8);
    assert.equal(body.recentMatches[0].teams[0].damageDealtToObjectives, 6600);
  });
});

test("공개 LoL 전적 API는 시참 기록과 Riot ID가 일치하면 Twitch 방송 상태를 응답한다", async () => {
  await withAuthConfig(async () => {
    const handler = createHttpHandler({
      store: {
        getParticipationQueue() {
          return [{
            riotGameName: "HideOnBush",
            riotTagLine: "KR1",
            twitchUserId: "1234",
            twitchUserName: "hideonbush",
            status: "played",
            updatedAt: "2026-06-26T00:00:00.000Z"
          }];
        }
      },
      twitchAuth: {},
      twitch: {
        async getStreamByUserId(userId) {
          assert.equal(userId, "1234");
          return {
            userId,
            userLogin: "hideonbush",
            userName: "Hide on bush",
            title: "랭크 방송",
            gameName: "League of Legends",
            viewerCount: 123,
            startedAt: "2026-06-26T01:00:00.000Z"
          };
        },
        async getUserProfile(userId) {
          assert.equal(userId, "1234");
          return {
            login: "hideonbush",
            displayName: "Hide on bush",
            profileImageUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/hideonbush.png"
          };
        }
      },
      actions: {
        async dispatchOne() {}
      },
      sessions: new DashboardSessionStore(),
      riot: {
        isConfigured() {
          return true;
        },
        routingStatus() {
          return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" };
        },
        async getAccountByRiotId(gameName, tagLine) {
          return { puuid: "target-puuid", gameName, tagLine };
        },
        async getRankedStatsByPuuid() {
          return undefined;
        },
        async getLadderRankByPuuid() {
          return undefined;
        },
        async getChampionMasteryTopByPuuid() {
          return [];
        },
        async getRecentMatchIdsByPuuid() {
          return [];
        }
      }
    });

    const req = createRequest("GET", "/api/lol/profile?riotId=HideOnBush%23KR1", undefined, { origin: DASHBOARD_ORIGIN });
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.twitchStream.isLive, true);
    assert.equal(body.twitchStream.source, "participation");
    assert.equal(body.twitchStream.twitchDisplayName, "Hide on bush");
    assert.equal(body.twitchStream.channelUrl, "https://www.twitch.tv/hideonbush");
    assert.equal(body.twitchStream.viewerCount, 123);
  });
});

test("공개 LoL 전적 API는 승인 스트리머가 방송관리 연결 계정과 같아도 승인 정보와 링크를 유지한다", async () => {
  await withAuthConfig(async () => {
    const previousConfigDir = appConfig.paths.config;
    const previousStateDir = appConfig.paths.state;
    const configDir = mkdtempSync(path.join(tmpdir(), "streamops-approved-streamer-config-"));
    const stateDir = mkdtempSync(path.join(tmpdir(), "streamops-approved-streamer-state-"));
    try {
      mkdirSync(configDir, { recursive: true });
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(path.join(stateDir, "lol-game-monitor.json"), JSON.stringify({ streamerRiotId: "Seiga#sei" }));
      appConfig.paths.config = configDir;
      appConfig.paths.state = stateDir;
      const handler = createHttpHandler({
        store: {
          getParticipationQueue() {
            return [];
          },
          listApprovedStreamerRiotIds() {
            return [{
              id: "request-1",
              twitchUserId: "1234",
              twitchLogin: "seiga",
              twitchDisplayName: "西雅_せいが",
              twitchProfileImageUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/seiga.png",
              riotGameName: "Seiga",
              riotTagLine: "sei",
              normalizedRiotId: "seiga#sei",
              status: "approved",
              requestedAt: "2026-06-26T00:00:00.000Z",
              updatedAt: "2026-06-26T00:00:00.000Z",
              overlaySlug: "seiga",
              overlayKey: "overlay-key",
              profileLinkUrl: "https://www.youtube.com/@seiga",
              profileLinkLabel: "YouTube",
              profileLinks: [{
                id: "link-1",
                url: "https://www.youtube.com/@seiga",
                label: "YouTube",
                platform: "youtube"
              }]
            }];
          }
        },
        twitchAuth: {
          async getStatus() {
            return {
              broadcaster: {
                id: "1234",
                login: "seiga",
                displayName: "西雅_せいが",
                profileImageUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/seiga-live.png"
              }
            };
          }
        },
        twitch: {
          async getStreamByUserId(userId) {
            assert.equal(userId, "1234");
            return {
              userId,
              userLogin: "seiga",
              userName: "西雅_せいが",
              title: "랭크 방송",
              gameName: "League of Legends",
              viewerCount: 45,
              startedAt: "2026-06-26T01:00:00.000Z"
            };
          },
          async getUserProfile(userId) {
            assert.equal(userId, "1234");
            return {
              login: "seiga",
              displayName: "西雅_せいが",
              profileImageUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/seiga-live.png"
            };
          }
        },
        actions: {
          async dispatchOne() {}
        },
        sessions: new DashboardSessionStore(),
        riot: {
          isConfigured() {
            return true;
          },
          routingStatus() {
            return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" };
          },
          async getAccountByRiotId(gameName, tagLine) {
            return { puuid: "target-puuid", gameName, tagLine };
          },
          async getRankedStatsByPuuid() {
            return undefined;
          },
          async getLadderRankByPuuid() {
            return undefined;
          },
          async getChampionMasteryTopByPuuid() {
            return [];
          },
          async getRecentMatchIdsByPuuid() {
            return [];
          }
        }
      });

      const req = createRequest("GET", "/api/lol/profile?riotId=Seiga%23sei", undefined, { origin: DASHBOARD_ORIGIN });
      const res = createResponse();

      await handler(req, res);

      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.twitchStream.isLive, true);
      assert.equal(body.twitchStream.source, "approved_streamer");
      assert.equal(body.twitchStream.profileLinkUrl, "https://www.youtube.com/@seiga");
      assert.equal(body.twitchStream.profileLinks[0].label, "YouTube");
      assert.equal(body.twitchStream.channelUrl, "https://www.twitch.tv/seiga");
    } finally {
      appConfig.paths.config = previousConfigDir;
      appConfig.paths.state = previousStateDir;
      rmSync(configDir, { recursive: true, force: true });
      rmSync(stateDir, { recursive: true, force: true });
    }
  });
});

test("공개 LoL 전적 API는 같은 Riot ID 요청을 캐시하고 최근 경기를 최신순으로 정렬한다", async () => {
  await withAuthConfig(async () => {
    let accountLookups = 0;
    let matchLookups = 0;
    const savedProfiles = [];
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      },
      sessions: new DashboardSessionStore(),
      profileRepository: {
        getByPuuid() {
          return undefined;
        },
        getByRiotId() {
          return undefined;
        },
        searchByText() {
          return savedProfiles;
        },
        save(profile) {
          savedProfiles.push(profile);
          return profile;
        }
      },
      dataDragon: {
        async getLatestVersion() {
          return "15.1.1";
        },
        async mapChampionSummary(input) {
          return {
            championId: input.championId,
            championKey: `Champion${input.championId}`,
            nameKo: `챔피언 ${input.championId}`
          };
        }
      },
      riot: {
        isConfigured() {
          return true;
        },
        routingStatus() {
          return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" };
        },
        async getAccountByRiotId(gameName, tagLine) {
          accountLookups += 1;
          return { puuid: "target-puuid", gameName, tagLine };
        },
        async getRankedStatsByPuuid() {
          return undefined;
        },
        async getLadderRankByPuuid() {
          return undefined;
        },
        async getChampionMasteryTopByPuuid() {
          return [];
        },
        async getRecentMatchIdsByPuuid(_puuid, count, queueIds) {
          assert.equal(count, 20);
          assert.deepEqual(queueIds ?? [], []);
          return ["old-match", "new-match", "custom-match"];
        },
        async getMatch(matchId) {
          matchLookups += 1;
          const byId = {
            "old-match": { creation: 1000, queueId: 420, championId: 103 },
            "new-match": { creation: 3000, queueId: 440, championId: 84 },
            "custom-match": { creation: 5000, queueId: 900, championId: 1 }
          }[matchId];
          return {
            metadata: { matchId, participants: ["target-puuid"] },
            info: {
              gameCreation: byId.creation,
              gameDuration: 1800,
              queueId: byId.queueId,
              teams: [{ teamId: 100, win: true, objectives: {} }],
              participants: [{
                puuid: "target-puuid",
                teamId: 100,
                championId: byId.championId,
                championName: `Champion${byId.championId}`,
                individualPosition: "MIDDLE",
                kills: 1,
                deaths: 1,
                assists: 1,
                win: true
              }]
            }
          };
        }
      }
    });

    const firstReq = createRequest("GET", "/api/lol/profile?riotId=HideOnBush%23KR1", undefined, { origin: DASHBOARD_ORIGIN });
    const firstRes = createResponse();
    await handler(firstReq, firstRes);

    const secondReq = createRequest("GET", "/api/lol/profile?riotId=hideonbush%23kr1", undefined, { origin: DASHBOARD_ORIGIN });
    const secondRes = createResponse();
    await handler(secondReq, secondRes);

    assert.equal(firstRes.statusCode, 200);
    assert.equal(secondRes.statusCode, 200);
    assert.equal(accountLookups, 1);
    assert.equal(matchLookups, 3);
    const body = JSON.parse(firstRes.body);
    assert.deepEqual(body.recentMatches.map((match) => match.matchId), ["new-match", "old-match"]);
    assert.equal(savedProfiles[0].riotGameName, "HideOnBush");
  });
});

test("공개 LoL 전적 갱신은 같은 Riot ID 기준 10분 쿨다운을 적용한다", async () => {
  await withAuthConfig(async () => {
    let accountLookups = 0;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      },
      sessions: new DashboardSessionStore(),
      riot: {
        isConfigured() {
          return true;
        },
        routingStatus() {
          return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" };
        },
        async getAccountByRiotId(gameName, tagLine) {
          accountLookups += 1;
          return { puuid: "refresh-target-puuid", gameName, tagLine };
        },
        async getRankedStatsByPuuid() {
          return {
            queueType: "RANKED_SOLO_5x5",
            tier: "EMERALD",
            rank: "II",
            leaguePoints: 33,
            wins: 12,
            losses: 8,
            winRate: 60,
            fetchedAt: "2026-06-26T00:00:00.000Z"
          };
        },
        async getLadderRankByPuuid() {
          return undefined;
        },
        async getChampionMasteryTopByPuuid() {
          return [];
        },
        async getRecentMatchIdsByPuuid() {
          return [];
        }
      }
    });

    const firstReq = createRequest("GET", "/api/lol/profile?riotId=HideOnBush%23KR1&refresh=1", undefined, { origin: DASHBOARD_ORIGIN });
    const firstRes = createResponse();
    await handler(firstReq, firstRes);

    const secondReq = createRequest("GET", "/api/lol/profile?riotId=hideonbush%23kr1&refresh=1", undefined, { origin: DASHBOARD_ORIGIN });
    const secondRes = createResponse();
    await handler(secondReq, secondRes);

    assert.equal(firstRes.statusCode, 200);
    assert.equal(typeof JSON.parse(firstRes.body).refreshAvailableAt, "string");
    assert.equal(secondRes.statusCode, 429);
    assert.equal(JSON.parse(secondRes.body).code, "REFRESH_COOLDOWN");
    assert.equal(accountLookups, 1);
  });
});

test("공개 LoL 전적 갱신은 더보기와 경기 티어 캐시를 무효화한다", async () => {
  await withAuthConfig(async () => {
    let olderPageLookups = 0;
    let rankLookups = 0;
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      },
      sessions: new DashboardSessionStore(),
      dataDragon: {
        async mapChampionSummary(input) {
          return {
            championId: input.championId,
            championKey: `Champion${input.championId}`,
            nameKo: `챔피언 ${input.championId}`
          };
        }
      },
      riot: {
        isConfigured() {
          return true;
        },
        routingStatus() {
          return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" };
        },
        async getAccountByRiotId(gameName, tagLine) {
          return { puuid: "refresh-cache-puuid", gameName, tagLine };
        },
        async getRankedStatsByPuuid(puuid) {
          if (puuid === "rank-cache-puuid") {
            rankLookups += 1;
            return {
              queueType: "RANKED_SOLO_5x5",
              tier: rankLookups === 1 ? "PLATINUM" : "DIAMOND",
              rank: "II",
              leaguePoints: 58,
              wins: 80,
              losses: 70,
              winRate: 53,
              fetchedAt: "2026-06-26T00:00:00.000Z"
            };
          }
          return undefined;
        },
        async getLadderRankByPuuid() {
          return undefined;
        },
        async getChampionMasteryTopByPuuid() {
          return [];
        },
        async getRecentMatchIdsByPuuid(_puuid, _count, _queueIds, start) {
          if (start === 20) {
            olderPageLookups += 1;
            return [olderPageLookups === 1 ? "stale-older-match" : "fresh-older-match"];
          }
          return [];
        },
        async getMatch(matchId) {
          if (matchId === "JP1_200") {
            return {
              metadata: { matchId, participants: ["rank-cache-puuid"] },
              info: {
                gameCreation: 1760000000000,
                gameDuration: 1800,
                queueId: 420,
                teams: [{ teamId: 100, win: true, objectives: {} }],
                participants: [{
                  puuid: "rank-cache-puuid",
                  teamId: 100,
                  championId: 103,
                  championName: "Ahri",
                  riotIdGameName: "RankCache",
                  riotIdTagline: "JP1",
                  individualPosition: "MIDDLE",
                  kills: 1,
                  deaths: 1,
                  assists: 1,
                  win: true
                }]
              }
            };
          }
          return {
            metadata: { matchId, participants: ["refresh-cache-puuid"] },
            info: {
              gameCreation: matchId === "fresh-older-match" ? 1760000001000 : 1760000000000,
              gameDuration: 1800,
              queueId: 420,
              teams: [{ teamId: 100, win: true, objectives: {} }],
              participants: [{
                puuid: "refresh-cache-puuid",
                teamId: 100,
                championId: 103,
                championName: "Ahri",
                individualPosition: "MIDDLE",
                kills: 1,
                deaths: 1,
                assists: 1,
                win: true
              }]
            }
          };
        }
      }
    });

    const firstPageReq = createRequest("GET", "/api/lol/matches?riotId=HideOnBush%23KR1&start=20", undefined, { origin: DASHBOARD_ORIGIN });
    const firstPageRes = createResponse();
    await handler(firstPageReq, firstPageRes);

    const firstRankReq = createRequest("GET", "/api/lol/match-ranks?matchId=JP1_200", undefined, { origin: DASHBOARD_ORIGIN });
    const firstRankRes = createResponse();
    await handler(firstRankReq, firstRankRes);

    const refreshReq = createRequest("GET", "/api/lol/profile?riotId=HideOnBush%23KR1&refresh=1", undefined, { origin: DASHBOARD_ORIGIN });
    const refreshRes = createResponse();
    await handler(refreshReq, refreshRes);

    const secondPageReq = createRequest("GET", "/api/lol/matches?riotId=HideOnBush%23KR1&start=20", undefined, { origin: DASHBOARD_ORIGIN });
    const secondPageRes = createResponse();
    await handler(secondPageReq, secondPageRes);

    const secondRankReq = createRequest("GET", "/api/lol/match-ranks?matchId=JP1_200", undefined, { origin: DASHBOARD_ORIGIN });
    const secondRankRes = createResponse();
    await handler(secondRankReq, secondRankRes);

    assert.equal(firstPageRes.statusCode, 200);
    assert.equal(firstRankRes.statusCode, 200);
    assert.equal(refreshRes.statusCode, 200);
    assert.equal(secondPageRes.statusCode, 200);
    assert.equal(secondRankRes.statusCode, 200);
    assert.deepEqual(JSON.parse(firstPageRes.body).recentMatches.map((match) => match.matchId), ["stale-older-match"]);
    assert.deepEqual(JSON.parse(secondPageRes.body).recentMatches.map((match) => match.matchId), ["fresh-older-match"]);
    assert.equal(JSON.parse(firstRankRes.body).participants[0].rankedStats.tier, "PLATINUM");
    assert.equal(JSON.parse(secondRankRes.body).participants[0].rankedStats.tier, "DIAMOND");
    assert.equal(olderPageLookups, 2);
    assert.equal(rankLookups, 2);
  });
});

test("공개 LoL 연관검색 API는 저장된 프로필 캐시를 부분 검색 후보로 반환한다", async () => {
  await withAuthConfig(async () => {
    const handler = createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: {
        async dispatchOne() {}
      },
      sessions: new DashboardSessionStore(),
      profileRepository: {
        getByPuuid() {
          return undefined;
        },
        getByRiotId() {
          return undefined;
        },
        searchByText(query) {
          assert.equal(query, "hide");
          return [{
            riotPuuid: "target-puuid",
            riotGameName: "HideOnBush",
            riotTagLine: "KR1",
            riotIdKey: "hideonbush#kr1",
            status: "ready",
            rankedStats: {
              queueType: "RANKED_SOLO_5x5",
              tier: "DIAMOND",
              rank: "IV",
              leaguePoints: 54,
              wins: 12,
              losses: 8,
              winRate: 60,
              summonerLevel: 312,
              profileIconId: 29,
              fetchedAt: "2026-06-26T00:00:00.000Z"
            },
            analyzedAt: "2026-06-26T00:00:00.000Z"
          }];
        },
        save(profile) {
          return profile;
        }
      }
    });
    const req = createRequest("GET", "/api/lol/suggestions?q=hide", undefined, { origin: DASHBOARD_ORIGIN });
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    const suggestions = JSON.parse(res.body).suggestions;
    assert.deepEqual(suggestions.map((item) => item.riotId), ["HideOnBush#KR1"]);
    assert.equal(suggestions[0].rankedStats.tier, "DIAMOND");
    assert.equal(suggestions[0].rankedStats.rank, "IV");
    assert.equal(suggestions[0].summonerLevel, 312);
  });
});

test("dashboard 로그인은 HttpOnly cookie와 CSRF token을 발급하고 raw token을 응답에 남기지 않는다", async () => {
  await withAuthConfig(async () => {
    const sessions = new DashboardSessionStore();
    const handler = handlerWithSessionStore(sessions);

    const loginReq = createRequest("POST", "/api/dashboard/auth/check", { token: AUTH_TOKEN }, { origin: DASHBOARD_ORIGIN });
    const loginRes = createResponse();
    await handler(loginReq, loginRes);

    assert.equal(loginRes.statusCode, 200);
    assert.match(loginRes.headers["Set-Cookie"], new RegExp(`${DASHBOARD_SESSION_COOKIE}=`));
    assert.match(loginRes.headers["Set-Cookie"], /HttpOnly/);
    assert.match(loginRes.headers["Set-Cookie"], /SameSite=Strict/);
    assert.doesNotMatch(loginRes.headers["Set-Cookie"], new RegExp(AUTH_TOKEN));
    assert.doesNotMatch(loginRes.body, new RegExp(AUTH_TOKEN));

    const loginBody = JSON.parse(loginRes.body);
    assert.equal(loginBody.authenticated, true);
    assert.equal(typeof loginBody.csrfToken, "string");

    const statusReq = createRequest("GET", "/api/dashboard/auth/status", undefined, {
      cookie: cookieHeader(loginRes.headers["Set-Cookie"])
    });
    const statusRes = createResponse();
    await handler(statusReq, statusRes);

    const statusBody = JSON.parse(statusRes.body);
    assert.equal(statusBody.authenticated, true);
    assert.equal(statusBody.csrfToken, loginBody.csrfToken);
  });
});

test("session cookie 기반 state-changing API는 trusted Origin과 CSRF header를 요구한다", async () => {
  await withAuthConfig(async () => {
    const sessions = new DashboardSessionStore();
    const dispatched = [];
    const handler = handlerWithSessionStore(sessions, dispatched);

    const loginReq = createRequest("POST", "/api/dashboard/auth/check", { token: AUTH_TOKEN }, { origin: DASHBOARD_ORIGIN });
    const loginRes = createResponse();
    await handler(loginReq, loginRes);
    const cookie = cookieHeader(loginRes.headers["Set-Cookie"]);
    const csrfToken = JSON.parse(loginRes.body).csrfToken;

    const missingCsrfReq = createRequest("POST", "/api/actions/test", { action: testAction }, {
      cookie,
      origin: DASHBOARD_ORIGIN
    });
    const missingCsrfRes = createResponse();
    await handler(missingCsrfReq, missingCsrfRes);
    assert.equal(missingCsrfRes.statusCode, 403);
    assert.equal(JSON.parse(missingCsrfRes.body).code, "CSRF_REQUIRED");

    const badOriginReq = createRequest("POST", "/api/actions/test", { action: testAction }, {
      cookie,
      origin: "https://evil.example",
      "x-streamops-csrf": csrfToken
    });
    const badOriginRes = createResponse();
    await handler(badOriginReq, badOriginRes);
    assert.equal(badOriginRes.statusCode, 403);
    assert.equal(JSON.parse(badOriginRes.body).code, "ORIGIN_DENIED");

    const okReq = createRequest("POST", "/api/actions/test", { action: testAction }, {
      cookie,
      origin: DASHBOARD_ORIGIN,
      "x-streamops-csrf": csrfToken
    });
    const okRes = createResponse();
    await handler(okReq, okRes);
    assert.equal(okRes.statusCode, 200);
    assert.deepEqual(JSON.parse(okRes.body), { ok: true });
    assert.equal(dispatched.length, 1);
  });
});

test("내부 자동화용 bearer token 인증은 session CSRF 없이 사용할 수 있다", async () => {
  await withAuthConfig(async () => {
    const dispatched = [];
    const handler = handlerWithSessionStore(new DashboardSessionStore(), dispatched);
    const req = createRequest("POST", "/api/actions/test", { action: testAction }, {
      authorization: `Bearer ${AUTH_TOKEN}`
    });
    const res = createResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(dispatched.length, 1);
  });
});

test("스트리머 dashboard 세션은 허용된 운영 API만 사용할 수 있다", async () => {
  await withAuthConfig(async () => {
    const sessions = new DashboardSessionStore();
    const session = sessions.create({ role: "streamer", twitchUserId: "streamer-twitch-user" });
    const cookie = `${DASHBOARD_SESSION_COOKIE}=${session.id}`;

    const allowedReq = createRequest("GET", "/api/events/recent", undefined, { cookie });
    const allowed = authorizeHttpRequest(allowedReq, "/api/events/recent", sessions);
    assert.equal(allowed.ok, true);
    assert.equal(allowed.principal.type, "DASHBOARD_ADMIN");
    assert.equal(allowed.principal.role, "streamer");

    const allowedRiotIdUpdateReq = createRequest("POST", "/api/participation/streamer-riot-id", { riotId: "Seiga#JP1" }, {
      cookie,
      origin: DASHBOARD_ORIGIN,
      "x-streamops-csrf": session.csrfToken
    });
    const allowedRiotIdUpdate = authorizeHttpRequest(allowedRiotIdUpdateReq, "/api/participation/streamer-riot-id", sessions);
    assert.equal(allowedRiotIdUpdate.ok, true);

    const blockedReq = createRequest("POST", "/api/actions/test", { action: testAction }, {
      cookie,
      origin: DASHBOARD_ORIGIN,
      "x-streamops-csrf": session.csrfToken
    });
    const blocked = authorizeHttpRequest(blockedReq, "/api/actions/test", sessions);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.status, 403);
    assert.equal(blocked.code, "FORBIDDEN");
  });
});
