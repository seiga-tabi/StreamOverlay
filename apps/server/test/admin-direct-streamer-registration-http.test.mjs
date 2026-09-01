import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const { DashboardSessionStore } = await import("../dist/security/auth.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");
const { Store } = await import("../dist/services/store.js");

const DASHBOARD_ORIGIN = "http://localhost:3000";
const FULL_ADMIN_TOKEN = "full_admin_token_for_direct_registration_tests_1234567890";
const REGISTER_PATH = "/api/participation/streamer-riot-id-requests/admin-register";

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
    sessionTtl: appConfig.security.dashboardSessionTtlMs,
    databaseEnabled: appConfig.database.enabled
  };
  resetSecurityRateLimiters();
  appConfig.security.dashboardAuthToken = FULL_ADMIN_TOKEN;
  appConfig.security.localNoAuth = false;
  appConfig.security.corsOrigins = [DASHBOARD_ORIGIN];
  appConfig.nodeEnv = "development";
  appConfig.security.dashboardSessionTtlMs = 60_000;
  appConfig.database.enabled = false;
  try {
    await run();
  } finally {
    appConfig.security.dashboardAuthToken = previous.token;
    appConfig.security.localNoAuth = previous.localNoAuth;
    appConfig.security.corsOrigins = previous.corsOrigins;
    appConfig.nodeEnv = previous.nodeEnv;
    appConfig.security.dashboardSessionTtlMs = previous.sessionTtl;
    appConfig.database.enabled = previous.databaseEnabled;
    resetSecurityRateLimiters();
  }
}

async function withTempStore(run) {
  const dir = mkdtempSync(path.join(tmpdir(), "admin-direct-registration-test-"));
  const store = new Store({
    adminAccountStatePath: path.join(dir, "admin-accounts.json"),
    streamerRiotIdStatePath: path.join(dir, "streamer-riot-ids.json")
  });
  try {
    return await run(store);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function handlerFor(store, overrides = {}) {
  const sessions = new DashboardSessionStore();
  const handler = createHttpHandler({
    store,
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    sessions,
    twitch: {
      async getUserProfilesByLogins(logins) {
        const profiles = new Map([
          ["direct_streamer", {
            id: "99000123",
            login: "direct_streamer",
            displayName: "Direct Streamer",
            profileImageUrl: "https://static-cdn.jtvnw.net/direct-streamer.png"
          }],
          ["alice", {
            id: "99000124",
            login: "alice",
            displayName: "Alice",
            profileImageUrl: "https://static-cdn.jtvnw.net/alice.png"
          }],
          ["bob", {
            id: "99000125",
            login: "bob",
            displayName: "Bob",
            profileImageUrl: "https://static-cdn.jtvnw.net/bob.png"
          }]
        ]);
        return new Map(logins.flatMap((login) => {
          const profile = profiles.get(login);
          return profile ? [[login, profile]] : [];
        }));
      }
    },
    riot: {
      isConfigured() { return false; },
      routingStatus() {
        return { configured: false, source: "default", accountRegion: "asia", lolPlatform: "kr" };
      }
    },
    ...overrides
  });
  return { handler, sessions };
}

async function login(handler, token) {
  const request = createRequest("POST", "/api/dashboard/auth/check", { token }, { origin: DASHBOARD_ORIGIN });
  const response = createResponse();
  await handler(request, response);
  assert.equal(response.statusCode, 200, response.body);
  const body = JSON.parse(response.body);
  return {
    cookie: cookieHeader(response.headers["Set-Cookie"]),
    csrf: body.csrfToken
  };
}

async function postAs(handler, body, session) {
  const request = createRequest("POST", REGISTER_PATH, body, {
    origin: DASHBOARD_ORIGIN,
    cookie: session.cookie,
    "x-streamops-csrf": session.csrf,
    "x-streamops-dashboard-surface": "admin"
  });
  const response = createResponse();
  await handler(request, response);
  return response;
}

async function get(handler, url) {
  const request = createRequest("GET", url, undefined, { host: "localhost" });
  const response = createResponse();
  await handler(request, response);
  return response;
}

function approveStreamer(store, input) {
  const pending = store.upsertStreamerRiotIdRequest(input);
  const approved = store.resolveStreamerRiotIdRequest({
    requestId: pending.id,
    decision: "approved",
    reviewer: "test"
  });
  assert.ok(approved);
  return approved;
}

const validBody = {
  twitchLogin: "direct_streamer",
  riotGameName: "Direct Player",
  riotTagLine: "KR1"
};

test("streamer_approval 관리자는 Twitch 계정을 확인해 스트리머를 즉시 승인 등록한다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const token = "sub-admin-direct-registration-token";
    store.createAdminAccount({
      label: "직접 등록 운영자",
      tokenHash: store.hashAdminToken(token),
      permissions: ["streamer_approval"]
    });
    const audits = [];
    const completions = [];
    const { handler } = handlerFor(store, {
      adminAuditLogs: {
        async beginGlobalMutation(input) {
          audits.push(input);
          return { mutationId: "3b525f40-90b7-4b6e-b2ef-e083f66cda86" };
        },
        async completeGlobalMutation(input) {
          completions.push(input);
        }
      }
    });
    const session = await login(handler, token);

    const response = await postAs(handler, validBody, session);
    assert.equal(response.statusCode, 200, response.body);
    const body = JSON.parse(response.body);
    assert.equal(body.request.status, "approved");
    assert.equal(body.request.twitchLogin, "direct_streamer");
    assert.equal(body.request.riotGameName, "Direct Player");
    assert.equal(body.request.riotTagLine, "KR1");
    assert.equal(body.request.note, "관리자 직접 등록");
    assert.equal(body.requests.length, 1);
    assert.deepEqual(audits.map(({ action, metadata }) => ({ action, metadata })), [{
      action: "streamer.riot_id_request.resolved",
      metadata: { decision: "approved", noteProvided: true }
    }]);
    assert.deepEqual(completions, [{
      mutationId: "3b525f40-90b7-4b6e-b2ef-e083f66cda86",
      outcome: "succeeded"
    }]);
  });
}));

test("streamer_approval 권한이 없는 관리자 세션은 직접 등록할 수 없다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const token = "profile-only-admin-direct-registration-token";
    store.createAdminAccount({
      label: "프로필 전용 운영자",
      tokenHash: store.hashAdminToken(token),
      permissions: ["streamer_profiles:write"]
    });
    const { handler } = handlerFor(store);
    const session = await login(handler, token);

    const response = await postAs(handler, validBody, session);
    assert.equal(response.statusCode, 403, response.body);
    assert.equal(store.listStreamerRiotIdRequests().length, 0);
  });
}));

test("존재하지 않는 Twitch 로그인명은 400으로 거부한다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const { handler } = handlerFor(store);
    const session = await login(handler, FULL_ADMIN_TOKEN);

    const response = await postAs(handler, { ...validBody, twitchLogin: "missing_streamer" }, session);
    assert.equal(response.statusCode, 400, response.body);
    assert.equal(JSON.parse(response.body).code, "twitch_user_not_found");
    assert.equal(store.listStreamerRiotIdRequests().length, 0);
  });
}));

test("같은 Twitch 계정과 Riot ID를 다시 직접 등록해도 승인 row를 중복 생성하지 않는다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const { handler } = handlerFor(store);
    const session = await login(handler, FULL_ADMIN_TOKEN);

    const first = await postAs(handler, validBody, session);
    const firstBody = JSON.parse(first.body);
    assert.ok(store.setStreamerRiotIdDashboardEnabled({
      requestId: firstBody.request.id,
      dashboardEnabled: true,
      reviewer: "test"
    }));
    const second = await postAs(handler, validBody, session);
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(second.statusCode, 200, second.body);
    const secondBody = JSON.parse(second.body);
    assert.equal(secondBody.request.id, firstBody.request.id);
    assert.equal(secondBody.request.status, "approved");
    assert.equal(secondBody.request.dashboardEnabled, true);
    assert.equal(secondBody.requests.length, 1);
    assert.equal(store.listApprovedStreamerRiotIds().length, 1);
  });
}));

test("다른 스트리머가 등록한 Riot ID는 409로 거부하고 기존 승인만 유지한다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const alice = approveStreamer(store, {
      twitchUserId: "99000124",
      twitchLogin: "alice",
      twitchDisplayName: "Alice",
      riotGameName: "Same",
      riotTagLine: "KR1"
    });
    const completions = [];
    const { handler } = handlerFor(store, {
      adminAuditLogs: {
        async beginGlobalMutation() {
          return { mutationId: "5c919c57-552a-4454-8181-aa2287dd19fc" };
        },
        async completeGlobalMutation(input) {
          completions.push(input);
        }
      }
    });
    const session = await login(handler, FULL_ADMIN_TOKEN);

    const response = await postAs(handler, {
      twitchLogin: "bob",
      riotGameName: "Same",
      riotTagLine: "KR1"
    }, session);

    assert.equal(response.statusCode, 409, response.body);
    assert.deepEqual(JSON.parse(response.body), {
      error: "이미 다른 스트리머가 등록한 Riot ID입니다.",
      code: "riot_id_taken"
    });
    const approved = store.listApprovedStreamerRiotIds()
      .filter((request) => request.normalizedRiotId === alice.normalizedRiotId);
    assert.equal(approved.length, 1);
    assert.equal(approved[0].twitchUserId, "99000124");
    assert.deepEqual(completions, [{
      mutationId: "5c919c57-552a-4454-8181-aa2287dd19fc",
      outcome: "failed"
    }]);
  });
}));

test("Riot ID 교체 등록은 이전 승인 row의 공개 프로필 캐시도 무효화한다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const previous = approveStreamer(store, {
      twitchUserId: "99000123",
      twitchLogin: "direct_streamer",
      twitchDisplayName: "Direct Streamer",
      riotGameName: "Old",
      riotTagLine: "KR1"
    });
    let accountLookups = 0;
    const riot = {
      isConfigured() { return true; },
      routingStatus() {
        return { configured: true, source: "test", accountRegion: "asia", lolPlatform: "kr" };
      },
      async getAccountByRiotId(gameName, tagLine) {
        accountLookups += 1;
        return { puuid: `puuid-${gameName.toLowerCase()}`, gameName, tagLine };
      },
      async getRankedStatsByPuuid() { return undefined; },
      async getChampionMasteryTopByPuuid() { return []; },
      async getRecentMatchIdsByPuuid() { return []; },
      async getMatch() { return null; }
    };
    const { handler } = handlerFor(store, { riot });
    const session = await login(handler, FULL_ADMIN_TOKEN);

    const firstProfile = await get(handler, "/api/lol/profile?riotId=Old%23KR1&platform=kr");
    assert.equal(firstProfile.statusCode, 200, firstProfile.body);
    assert.equal(accountLookups, 1);

    const response = await postAs(handler, {
      twitchLogin: "direct_streamer",
      riotGameName: "New",
      riotTagLine: "KR1"
    }, session);
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(JSON.parse(response.body).request.riotGameName, "New");

    const secondProfile = await get(handler, "/api/lol/profile?riotId=Old%23KR1&platform=kr");
    assert.equal(secondProfile.statusCode, 200, secondProfile.body);
    assert.equal(accountLookups, 2, "이전 Riot ID 캐시가 무효화되어 Riot 계정을 다시 조회해야 합니다");
    const previousAfterReplacement = store.listStreamerRiotIdRequests()
      .find((request) => request.id === previous.id);
    assert.equal(previousAfterReplacement.status, "rejected");
    assert.equal(store.listApprovedStreamerRiotIds().some((request) => (
      request.twitchUserId === "99000123"
      && request.riotGameName === "New"
      && request.riotTagLine === "KR1"
    )), true);
  });
}));
