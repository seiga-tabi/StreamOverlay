import test from "node:test";
import assert from "node:assert/strict";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const {
  DashboardSessionStore,
  STREAMER_DASHBOARD_SESSION_COOKIE
} = await import("../dist/security/auth.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");
const { Store } = await import("../dist/services/store.js");

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

function approveStreamer(store, twitchUserId, riotGameName) {
  const request = store.upsertStreamerRiotIdRequest({
    twitchUserId,
    twitchLogin: twitchUserId,
    twitchDisplayName: twitchUserId,
    riotGameName,
    riotTagLine: "JP1"
  });
  store.resolveStreamerRiotIdRequest({
    requestId: request.id,
    decision: "approved",
    reviewer: "test"
  });
  store.setStreamerRiotIdDashboardEnabled({
    requestId: request.id,
    dashboardEnabled: true,
    reviewer: "test"
  });
}

function streamerHeaders(session, stateChanging = false) {
  return {
    cookie: `${STREAMER_DASHBOARD_SESSION_COOKIE}=${session.id}`,
    origin: DASHBOARD_ORIGIN,
    "x-streamops-dashboard-surface": "streamer",
    ...(stateChanging ? { "x-streamops-csrf": session.csrfToken } : {})
  };
}

async function request(handler, session, method, url, body) {
  const req = createRequest(method, url, body, streamerHeaders(session, method !== "GET"));
  const res = createResponse();
  await handler(req, res);
  return res;
}

test("LoL 방송 운영 API는 인증 세션 기준으로 스트리머 데이터 소유권을 격리한다", async () => {
  const previous = {
    localNoAuth: appConfig.security.localNoAuth,
    corsOrigins: [...appConfig.security.corsOrigins],
    nodeEnv: appConfig.nodeEnv,
    sessionTtl: appConfig.security.dashboardSessionTtlMs
  };
  resetSecurityRateLimiters();
  appConfig.security.localNoAuth = false;
  appConfig.security.corsOrigins = [DASHBOARD_ORIGIN];
  appConfig.nodeEnv = "development";
  appConfig.security.dashboardSessionTtlMs = 60_000;

  try {
    const store = new Store();
    approveStreamer(store, "streamer-a", "StreamerA");
    approveStreamer(store, "streamer-b", "StreamerB");
    store.setLolAutomationSettings("streamer-b", { announceInChat: false });
    store.startParticipationSession("streamer-b", {
      riotGameName: "StreamerB",
      riotTagLine: "JP1",
      capturedAt: new Date().toISOString()
    });
    const streamerBEntry = store.addParticipation(store.makeParticipationEntry({
      twitchUserId: "viewer-b",
      twitchUserName: "ViewerB",
      riotGameName: "ViewerB",
      riotTagLine: "JP1",
      preferredRole: "fill",
      status: "waitlisted",
      source: "dashboard"
    }), "streamer-b");

    const sessions = new DashboardSessionStore();
    const streamerASession = sessions.create({ role: "streamer", twitchUserId: "streamer-a" });
    const handler = createHttpHandler({
      store,
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      sessions
    });

    const initialStateRes = await request(handler, streamerASession, "GET", "/api/lol-operations");
    assert.equal(initialStateRes.statusCode, 200);
    const initialState = JSON.parse(initialStateRes.body);
    assert.equal(initialState.identity.twitchUserId, "streamer-a");
    assert.equal(initialState.participation.queue.length, 0);

    const updateRes = await request(handler, streamerASession, "POST", "/api/lol-operations/automation", {
      streamerId: "streamer-b",
      announceInChat: true
    });
    assert.equal(updateRes.statusCode, 200);
    assert.equal(store.getLolAutomationSettings("streamer-a").announceInChat, true);
    assert.equal(store.getLolAutomationSettings("streamer-b").announceInChat, false);

    const foreignEntryRes = await request(handler, streamerASession, "POST", "/api/lol-operations/participation/entry-status", {
      entryId: streamerBEntry.id,
      status: "checked_in"
    });
    assert.equal(foreignEntryRes.statusCode, 404);
    assert.equal(store.getParticipationQueue("streamer-b")[0]?.status, "waitlisted");
  } finally {
    appConfig.security.localNoAuth = previous.localNoAuth;
    appConfig.security.corsOrigins = previous.corsOrigins;
    appConfig.nodeEnv = previous.nodeEnv;
    appConfig.security.dashboardSessionTtlMs = previous.sessionTtl;
    resetSecurityRateLimiters();
  }
});
