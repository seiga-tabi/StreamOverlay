import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const { PUBLIC_TWITCH_VIEWER_SESSION_COOKIE } = await import("../dist/services/public-twitch-auth.js");
const { Store } = await import("../dist/services/store.js");
const { DashboardSessionStore } = await import("../dist/security/auth.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");

const DASHBOARD_ORIGIN = "http://localhost:3000";

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

async function withAuthConfig(run) {
  const previous = {
    localNoAuth: appConfig.security.localNoAuth,
    corsOrigins: [...appConfig.security.corsOrigins],
    nodeEnv: appConfig.nodeEnv,
    sessionTtl: appConfig.security.dashboardSessionTtlMs,
    databaseEnabled: appConfig.database.enabled
  };
  resetSecurityRateLimiters();
  appConfig.security.localNoAuth = false;
  appConfig.security.corsOrigins = [DASHBOARD_ORIGIN];
  appConfig.nodeEnv = "development";
  appConfig.security.dashboardSessionTtlMs = 60_000;
  // /api/account/streamer/participation/* 는 YORO 계정 세션 경로라 database.enabled가
  // 꺼져 있으면 yoroAccounts를 넘겨도 503 feature_unavailable로 막힙니다.
  appConfig.database.enabled = true;
  try {
    await run();
  } finally {
    appConfig.security.localNoAuth = previous.localNoAuth;
    appConfig.security.corsOrigins = previous.corsOrigins;
    appConfig.nodeEnv = previous.nodeEnv;
    appConfig.security.dashboardSessionTtlMs = previous.sessionTtl;
    appConfig.database.enabled = previous.databaseEnabled;
    resetSecurityRateLimiters();
  }
}

/**
 * 대시보드의 ParticipationManagementPage.tsx는 YORO 계정 세션
 * (/api/account/streamer/participation/*)을 통해서만 참여 세션을 조작합니다 —
 * 예전 /api/lol-operations/* 경로와는 다른 인증 경로라 yoroAccounts mock이 필요합니다.
 */
function yoroAccountsFor(twitchUserId, csrfToken) {
  return {
    async authenticateForManagement(cookieValue) {
      assert.equal(cookieValue, "yoro-session");
      return { userId: "11111111-1111-4111-8111-111111111111", csrfToken, csrfTokenHash: Buffer.alloc(32) };
    },
    async session(cookieValue) {
      assert.equal(cookieValue, "yoro-session");
      return {
        authenticated: true,
        csrfToken,
        authenticationProvider: "twitch",
        identities: [],
        preferences: { locale: "ko", defaultDashboardPage: "overview", reducedMotion: false }
      };
    },
    async getTwitchAccessContext(cookieValue) {
      assert.equal(cookieValue, "yoro-session");
      return {
        clientId: "client-id",
        accessToken: "access-token",
        userId: twitchUserId,
        scopes: [],
        user: { id: twitchUserId, login: twitchUserId, displayName: twitchUserId },
        tokenExpiresAt: "2026-08-10T00:00:00.000Z"
      };
    }
  };
}

function approveStreamer(store, twitchUserId, riotGameName) {
  const request = store.upsertStreamerRiotIdRequest({
    twitchUserId,
    twitchLogin: twitchUserId,
    twitchDisplayName: twitchUserId,
    riotGameName,
    riotTagLine: "JP1"
  });
  store.resolveStreamerRiotIdRequest({ requestId: request.id, decision: "approved", reviewer: "test" });
  store.setStreamerRiotIdDashboardEnabled({ requestId: request.id, dashboardEnabled: true, reviewer: "test" });
  return request;
}

test("참여 세션 시작은 game을 저장하고, 생략하면 lol로 기본값을 채운다", async () => {
  await withAuthConfig(async () => {
    const csrfToken = "csrf_value_for_game_start_test_1234567890";
    const store = new Store();
    approveStreamer(store, "pal-streamer", "PalStreamer");
    const handler = createHttpHandler({
      store,
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      sessions: new DashboardSessionStore(),
      discordDatabaseReady: () => true,
      yoroAccounts: yoroAccountsFor("pal-streamer", csrfToken)
    });
    const headers = { cookie: "yoro_session=yoro-session", origin: DASHBOARD_ORIGIN, "x-yoro-csrf": csrfToken };

    const palworldStart = await (async () => {
      const req = createRequest("POST", "/api/account/streamer/participation/session", { action: "start", game: "palworld" }, headers);
      const res = createResponse();
      await handler(req, res);
      return res;
    })();
    assert.equal(palworldStart.statusCode, 200, palworldStart.body);
    assert.equal(store.getParticipationSession("pal-streamer")?.game, "palworld");

    await (async () => {
      const req = createRequest("POST", "/api/account/streamer/participation/session", { action: "finish" }, headers);
      const res = createResponse();
      await handler(req, res);
      return res;
    })();

    const defaultStart = await (async () => {
      const req = createRequest("POST", "/api/account/streamer/participation/session", { action: "start" }, headers);
      const res = createResponse();
      await handler(req, res);
      return res;
    })();
    assert.equal(defaultStart.statusCode, 200, defaultStart.body);
    assert.equal(store.getParticipationSession("pal-streamer")?.game, "lol");
  });
});

test("선정은 게임별 진행 인원 정원(LoL 방송인 포함 5명)을 서버가 강제한다", async () => {
  await withAuthConfig(async () => {
    const csrfToken = "csrf_value_for_capacity_test_1234567890";
    const store = new Store();
    approveStreamer(store, "cap-streamer", "CapStreamer");
    store.startParticipationSession("cap-streamer", {
      riotGameName: "CapStreamer",
      riotTagLine: "JP1",
      capturedAt: new Date().toISOString()
    }, { game: "lol" });

    const entryIds = [];
    for (let index = 1; index <= 5; index += 1) {
      const entry = store.addParticipation(store.makeParticipationEntry({
        twitchUserId: `viewer-${index}`,
        twitchUserName: `Viewer${index}`,
        game: "lol",
        riotGameName: `Viewer${index}`,
        riotTagLine: "JP1",
        preferredRole: "fill",
        status: "verified",
        source: "dashboard"
      }), "cap-streamer");
      entryIds.push(entry.id);
    }

    const handler = createHttpHandler({
      store,
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      sessions: new DashboardSessionStore(),
      discordDatabaseReady: () => true,
      yoroAccounts: yoroAccountsFor("cap-streamer", csrfToken)
    });
    const headers = { cookie: "yoro_session=yoro-session", origin: DASHBOARD_ORIGIN, "x-yoro-csrf": csrfToken };

    // 5명을 한 번에 선정하려 하면 정원(방송인 1 + 시청자 4)을 넘어 바로 막힙니다.
    const overCapacityReq = createRequest("POST", "/api/account/streamer/participation/entry-status", {
      entryIds,
      status: "selected"
    }, headers);
    const overCapacityRes = createResponse();
    await handler(overCapacityReq, overCapacityRes);
    assert.equal(overCapacityRes.statusCode, 409);
    assert.equal(JSON.parse(overCapacityRes.body).code, "PARTICIPATION_CAPACITY_FULL");
    assert.equal(store.getParticipationQueue("cap-streamer").filter((entry) => entry.status === "selected").length, 0);

    // 4명까지는 LoL 정원 안에서 한 번에 선정할 수 있습니다.
    const withinReq = createRequest("POST", "/api/account/streamer/participation/entry-status", {
      entryIds: entryIds.slice(0, 4),
      status: "selected"
    }, headers);
    const withinRes = createResponse();
    await handler(withinReq, withinRes);
    assert.equal(withinRes.statusCode, 200, withinRes.body);
    assert.equal(
      store.getParticipationQueue("cap-streamer").filter((entry) => entry.status === "selected").length,
      4
    );

    // 정원이 이미 다 찼으므로 다음 선정은 (사유가 정원 초과이든 현재 참가자
    // 처리 중이든) 어느 쪽이든 계속 막혀야 하며, 5번째 참가자 상태는 그대로입니다.
    const blockedReq = createRequest("POST", "/api/account/streamer/participation/entry-status", {
      entryId: entryIds[4],
      status: "selected"
    }, headers);
    const blockedRes = createResponse();
    await handler(blockedReq, blockedRes);
    assert.equal(blockedRes.statusCode, 409);
    assert.equal(store.getParticipationQueue("cap-streamer").find((entry) => entry.id === entryIds[4])?.status, "verified");
  });
});

test("정원에 여유가 있어도 이미 처리 중인 참가자가 있으면 다음 선정은 막힌다", async () => {
  await withAuthConfig(async () => {
    const csrfToken = "csrf_value_for_sequential_guard_test_1234567890";
    const store = new Store();
    approveStreamer(store, "seq-streamer", "SeqStreamer");
    store.startParticipationSession("seq-streamer", {
      riotGameName: "SeqStreamer",
      riotTagLine: "JP1",
      capturedAt: new Date().toISOString()
    }, { game: "lol" });

    const entries = [1, 2].map((index) => store.addParticipation(store.makeParticipationEntry({
      twitchUserId: `seq-viewer-${index}`,
      twitchUserName: `SeqViewer${index}`,
      game: "lol",
      riotGameName: `SeqViewer${index}`,
      riotTagLine: "JP1",
      preferredRole: "fill",
      status: "verified",
      source: "dashboard"
    }), "seq-streamer"));

    const handler = createHttpHandler({
      store,
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      sessions: new DashboardSessionStore(),
      discordDatabaseReady: () => true,
      yoroAccounts: yoroAccountsFor("seq-streamer", csrfToken)
    });
    const headers = { cookie: "yoro_session=yoro-session", origin: DASHBOARD_ORIGIN, "x-yoro-csrf": csrfToken };

    // 정원(4명)에는 한참 못 미치는 1명만 선정된 상태에서, 그 1명이 아직
    // 처리 중이면(진행 인원 여유와 무관하게) 다음 선정은 순차 처리 규칙으로 막힙니다.
    const firstReq = createRequest("POST", "/api/account/streamer/participation/entry-status", {
      entryId: entries[0].id,
      status: "selected"
    }, headers);
    const firstRes = createResponse();
    await handler(firstReq, firstRes);
    assert.equal(firstRes.statusCode, 200, firstRes.body);

    const secondReq = createRequest("POST", "/api/account/streamer/participation/entry-status", {
      entryId: entries[1].id,
      status: "selected"
    }, headers);
    const secondRes = createResponse();
    await handler(secondReq, secondRes);
    assert.equal(secondRes.statusCode, 409);
    assert.equal(JSON.parse(secondRes.body).code, "CURRENT_PARTICIPANT_ACTIVE");
  });
});

test("정원이 이미 다 찼으면 CURRENT_PARTICIPANT_ACTIVE 대신 정원 초과로 막힌다", async () => {
  await withAuthConfig(async () => {
    const csrfToken = "csrf_value_for_capacity_full_test_1234567890";
    const store = new Store();
    approveStreamer(store, "cap-streamer-2", "CapStreamer2");
    store.startParticipationSession("cap-streamer-2", {
      riotGameName: "CapStreamer2",
      riotTagLine: "JP1",
      capturedAt: new Date().toISOString()
    }, { game: "lol" });

    const verifiedEntries = [];
    for (let index = 1; index <= 5; index += 1) {
      const entry = store.addParticipation(store.makeParticipationEntry({
        twitchUserId: `viewer2-${index}`,
        twitchUserName: `Viewer2-${index}`,
        game: "lol",
        riotGameName: `Viewer2${index}`,
        riotTagLine: "JP1",
        preferredRole: "fill",
        status: "verified",
        source: "dashboard"
      }), "cap-streamer-2");
      verifiedEntries.push(entry);
    }
    // 4명을 먼저 selected -> checked_in 까지 진행시켜 두면(진행 중), 정원 자체가
    // 이미 다 찬 상태입니다 — CURRENT_PARTICIPANT_ACTIVE 가드와는 별개로 검증합니다.
    const selected = store.selectParticipants(verifiedEntries.slice(0, 4).map((entry) => entry.id), 60, "cap-streamer-2");
    assert.equal(selected?.length, 4);
    for (const entry of selected) {
      store.markParticipant(entry.id, "checked_in", "cap-streamer-2");
    }

    const handler = createHttpHandler({
      store,
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      sessions: new DashboardSessionStore(),
      discordDatabaseReady: () => true,
      yoroAccounts: yoroAccountsFor("cap-streamer-2", csrfToken)
    });
    const headers = { cookie: "yoro_session=yoro-session", origin: DASHBOARD_ORIGIN, "x-yoro-csrf": csrfToken };

    const req = createRequest("POST", "/api/account/streamer/participation/entry-status", {
      entryId: verifiedEntries[4].id,
      status: "selected"
    }, headers);
    const res = createResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 409);
    assert.equal(JSON.parse(res.body).code, "PARTICIPATION_CAPACITY_FULL");
  });
});

test("Palworld 공개 참여는 Riot 검증 없이 닉네임만으로 바로 대기열에 등록된다", async () => {
  const store = new Store();
  const streamerId = "pal-public-streamer";
  const session = store.startParticipationSession(streamerId, {
    riotGameName: "PalPublicStreamer",
    riotTagLine: "JP1",
    capturedAt: new Date().toISOString()
  }, { game: "palworld", maxQueueSize: 32 });
  store.setTwitchStreamLiveStatus({ twitchUserId: streamerId, isLive: true, source: "eventsub" });

  const publicTwitchAuth = {
    async getStatus() {
      return {
        connected: true,
        configured: true,
        requiredScopes: ["user:read:follows"],
        missingScopes: [],
        user: { id: "pal-viewer", login: "pal-viewer", displayName: "PalViewer" }
      };
    }
  };
  const handler = createHttpHandler({
    store,
    twitchAuth: {},
    publicTwitchAuth,
    actions: { async dispatchOne() {} }
  });
  const headers = {
    cookie: `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=pal-viewer-session`,
    origin: "http://localhost:3000"
  };

  const joinReq = createRequest("POST", `/api/public/participation/sessions/${encodeURIComponent(session.publicSessionId)}/join`, {
    palworldNickname: "동글이"
  }, headers);
  const joinRes = createResponse();
  await handler(joinReq, joinRes);

  assert.equal(joinRes.statusCode, 200, joinRes.body);
  const joined = JSON.parse(joinRes.body);
  assert.equal(joined.ok, true);
  assert.equal(joined.entry?.status, "waitlisted");
  assert.equal(joined.entry?.palworldNickname, "동글이");
  assert.equal(joined.entry?.riotId, undefined);

  const stored = store.getParticipationQueue(streamerId)[0];
  assert.equal(stored.game, "palworld");
  assert.equal(stored.palworldNickname, "동글이");
  assert.equal(stored.riotGameName, undefined);
  assert.equal(stored.status, "waitlisted");

  // 같은 Twitch 계정으로 다시 참여를 시도하면 새 항목을 만들지 않고 기존 참여로 처리합니다.
  const secondJoinReq = createRequest("POST", `/api/public/participation/sessions/${encodeURIComponent(session.publicSessionId)}/join`, {
    palworldNickname: "다른닉네임"
  }, headers);
  const secondJoinRes = createResponse();
  await handler(secondJoinReq, secondJoinRes);
  assert.equal(secondJoinRes.statusCode, 200);
  assert.equal(JSON.parse(secondJoinRes.body).alreadyJoined, true);
  assert.equal(store.getParticipationQueue(streamerId).length, 1);
});

test("Palworld 공개 참여는 닉네임이 없으면 거부된다", async () => {
  const store = new Store();
  const streamerId = "pal-empty-streamer";
  const session = store.startParticipationSession(streamerId, {
    riotGameName: "PalEmptyStreamer",
    riotTagLine: "JP1",
    capturedAt: new Date().toISOString()
  }, { game: "palworld" });
  store.setTwitchStreamLiveStatus({ twitchUserId: streamerId, isLive: true, source: "eventsub" });

  const publicTwitchAuth = {
    async getStatus() {
      return {
        connected: true,
        configured: true,
        requiredScopes: ["user:read:follows"],
        missingScopes: [],
        user: { id: "pal-viewer-2", login: "pal-viewer-2", displayName: "PalViewer2" }
      };
    }
  };
  const handler = createHttpHandler({
    store,
    twitchAuth: {},
    publicTwitchAuth,
    actions: { async dispatchOne() {} }
  });
  const headers = {
    cookie: `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=pal-viewer-2-session`,
    origin: "http://localhost:3000"
  };

  const joinReq = createRequest("POST", `/api/public/participation/sessions/${encodeURIComponent(session.publicSessionId)}/join`, {
    palworldNickname: "   "
  }, headers);
  const joinRes = createResponse();
  await handler(joinReq, joinRes);

  assert.equal(joinRes.statusCode, 400);
  assert.equal(store.getParticipationQueue(streamerId).length, 0);
});

test("game 필드가 없는 기존 저장 데이터는 불러올 때 lol로 정규화된다", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-legacy-participation-"));
  const filePath = path.join(dir, "runtime-state.json");
  try {
    const streamerId = "legacy-streamer";
    const legacyState = {
      version: 3,
      participation: { isOpen: false, revision: 0, queue: [] },
      participationByStreamer: {
        [streamerId]: {
          isOpen: true,
          revision: 1,
          session: {
            streamerId,
            sessionId: "partsession_legacy",
            publicSessionId: "ps_legacylegacylegacylegacylegacy1",
            status: "recruiting",
            listingVisibility: "public",
            maxQueueSize: 100,
            allowRejoin: true,
            checkInSeconds: 60,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          queue: [
            {
              id: "legacy-entry-1",
              twitchUserId: "legacy-viewer",
              twitchUserName: "LegacyViewer",
              riotGameName: "LegacyViewer",
              riotTagLine: "JP1",
              preferredRole: "fill",
              status: "waitlisted",
              source: "dashboard",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        }
      }
    };
    writeFileSync(filePath, JSON.stringify(legacyState), "utf8");

    const store = new Store({ runtimeStatePath: filePath });
    const session = store.getParticipationSession(streamerId);
    const queue = store.getParticipationQueue(streamerId);

    assert.equal(session?.game, "lol");
    assert.equal(queue[0]?.game, "lol");
    assert.equal(queue[0]?.riotGameName, "LegacyViewer");
    await store.closeAsync();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
