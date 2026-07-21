import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const {
  DashboardSessionStore,
  STREAMER_DASHBOARD_SESSION_COOKIE
} = await import("../dist/security/auth.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");
const {
  StreamerFollowerAuthError
} = await import("../dist/services/streamer-follower-auth.js");
const { Store } = await import("../dist/services/store.js");

const DASHBOARD_ORIGIN = "http://localhost:3000";
const FOLLOWER_SCOPE = "moderator:read:followers";
const STREAMER_A_ID = "1001";
const STREAMER_B_ID = "2002";

const previousConfig = {
  localNoAuth: appConfig.security.localNoAuth,
  corsOrigins: [...appConfig.security.corsOrigins],
  nodeEnv: appConfig.nodeEnv,
  sessionTtl: appConfig.security.dashboardSessionTtlMs
};

before(() => {
  appConfig.security.localNoAuth = false;
  appConfig.security.corsOrigins = [DASHBOARD_ORIGIN];
  appConfig.nodeEnv = "development";
  appConfig.security.dashboardSessionTtlMs = 60_000;
});

beforeEach(() => {
  resetSecurityRateLimiters();
});

after(() => {
  appConfig.security.localNoAuth = previousConfig.localNoAuth;
  appConfig.security.corsOrigins = previousConfig.corsOrigins;
  appConfig.nodeEnv = previousConfig.nodeEnv;
  appConfig.security.dashboardSessionTtlMs = previousConfig.sessionTtl;
  resetSecurityRateLimiters();
});

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

function approveStreamer(store, twitchUserId, twitchLogin) {
  const request = store.upsertStreamerRiotIdRequest({
    twitchUserId,
    twitchLogin,
    twitchDisplayName: twitchLogin,
    riotGameName: twitchLogin,
    riotTagLine: "JP1"
  });
  store.resolveStreamerRiotIdRequest({
    requestId: request.id,
    decision: "approved",
    reviewer: "follower-http-test"
  });
  const enabled = store.setStreamerRiotIdDashboardEnabled({
    requestId: request.id,
    dashboardEnabled: true,
    reviewer: "follower-http-test"
  });
  assert.ok(enabled?.dashboardSlug);
  assert.ok(enabled?.dashboardKey);
  return enabled;
}

function setupTenants() {
  const store = new Store();
  const tenantA = approveStreamer(store, STREAMER_A_ID, "streamera");
  const tenantB = approveStreamer(store, STREAMER_B_ID, "streamerb");
  const sessions = new DashboardSessionStore();
  const sessionA = sessions.create({ role: "streamer", twitchUserId: STREAMER_A_ID });
  const sessionB = sessions.create({ role: "streamer", twitchUserId: STREAMER_B_ID });
  return { store, tenantA, tenantB, sessions, sessionA, sessionB };
}

function streamerHeaders(session, tenant, stateChanging = false, overrides = {}) {
  return {
    cookie: `${STREAMER_DASHBOARD_SESSION_COOKIE}=${session.id}`,
    origin: DASHBOARD_ORIGIN,
    "x-streamops-dashboard-surface": "streamer",
    "x-streamops-streamer-slug": tenant.dashboardSlug,
    "x-streamops-dashboard-key": tenant.dashboardKey,
    ...(stateChanging ? { "x-streamops-csrf": session.csrfToken } : {}),
    ...overrides
  };
}

async function request(handler, session, tenant, method, url, body, headerOverrides = {}) {
  const req = createRequest(
    method,
    url,
    body,
    streamerHeaders(session, tenant, method !== "GET", headerOverrides)
  );
  const res = createResponse();
  await handler(req, res);
  return res;
}

function connectedOAuthStatus() {
  return {
    state: "connected",
    missingScopes: [],
    tokenExpiresAt: "2099-01-01T00:00:00.000Z"
  };
}

function connectedFollowerAuth() {
  return {
    async getStatus() {
      return connectedOAuthStatus();
    },
    async getAccessContext(ownerId) {
      return {
        clientId: "follower-client",
        accessToken: `private-access-token-${ownerId}`,
        scopes: [FOLLOWER_SCOPE],
        broadcasterId: ownerId
      };
    }
  };
}

function handlerInput(store, sessions, streamerFollowerAuth, twitch) {
  return {
    store,
    sessions,
    streamerFollowerAuth,
    twitch,
    twitchAuth: {},
    actions: { async dispatchOne() {} }
  };
}

function follower(userName, followedAt = "2026-07-01T00:00:00.000Z") {
  return {
    userId: "9009",
    userLogin: userName.toLowerCase(),
    userName,
    followedAt
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("팔로워 GET API는 인증 principal별 데이터와 동일 follower ID를 독립적으로 반환한다", async () => {
  const { store, tenantA, tenantB, sessions, sessionA, sessionB } = setupTenants();
  store.recordFollower({
    broadcasterUserId: STREAMER_A_ID,
    ...follower("ViewerForA"),
    source: "eventsub"
  });
  store.recordFollower({
    broadcasterUserId: STREAMER_B_ID,
    ...follower("ViewerForB", "2026-07-02T00:00:00.000Z"),
    source: "eventsub"
  });

  const handler = createHttpHandler(handlerInput(store, sessions, connectedFollowerAuth()));
  const aRes = await request(
    handler,
    sessionA,
    tenantA,
    "GET",
    `/api/followers?broadcasterId=${STREAMER_B_ID}`,
    undefined,
    { "x-broadcaster-id": STREAMER_B_ID }
  );
  const bRes = await request(handler, sessionB, tenantB, "GET", "/api/followers", undefined);

  assert.equal(aRes.statusCode, 200);
  assert.equal(bRes.statusCode, 200);
  const aBody = JSON.parse(aRes.body);
  const bBody = JSON.parse(bRes.body);
  assert.deepEqual(aBody.followers.map((item) => item.userName), ["ViewerForA"]);
  assert.deepEqual(bBody.followers.map((item) => item.userName), ["ViewerForB"]);
  assert.equal(aBody.followers[0].userId, bBody.followers[0].userId);
  assert.equal(aBody.oauth.state, "connected");
  assert.equal(bBody.oauth.state, "connected");
  assert.doesNotMatch(aRes.body, /private-access-token|refreshToken/);
  assert.doesNotMatch(bRes.body, /private-access-token|refreshToken/);
});

test("팔로워 API는 다른 tenant slug 또는 dashboard key 접근을 거부한다", async () => {
  const { store, tenantA, tenantB, sessions, sessionA } = setupTenants();
  const handler = createHttpHandler(handlerInput(store, sessions, connectedFollowerAuth()));

  const foreignTenantRes = await request(handler, sessionA, tenantB, "GET", "/api/followers", undefined);
  assert.equal(foreignTenantRes.statusCode, 403);
  assert.equal(JSON.parse(foreignTenantRes.body).code, "STREAMER_TENANT_MISMATCH");

  const wrongKeyRes = await request(
    handler,
    sessionA,
    tenantA,
    "POST",
    "/api/followers/refresh",
    {},
    { "x-streamops-dashboard-key": "sdk_wrong_key" }
  );
  assert.equal(wrongKeyRes.statusCode, 403);
  assert.equal(JSON.parse(wrongKeyRes.body).code, "STREAMER_TENANT_MISMATCH");
});

test("팔로워 refresh는 principal broadcaster만 조회하고 cooldown을 tenant별로 격리한다", async () => {
  const { store, tenantA, tenantB, sessions, sessionA, sessionB } = setupTenants();
  const calls = [];
  const twitch = {
    async getChannelFollowersForBroadcaster(context, broadcasterId, limit) {
      calls.push({ context, broadcasterId, limit });
      return {
        followers: [follower(broadcasterId === STREAMER_A_ID ? "RefreshedForA" : "RefreshedForB")],
        total: 1,
        truncated: false
      };
    }
  };
  const handler = createHttpHandler(handlerInput(store, sessions, connectedFollowerAuth(), twitch));

  const aFirst = await request(
    handler,
    sessionA,
    tenantA,
    "POST",
    `/api/followers/refresh?limit=50&broadcasterId=${STREAMER_B_ID}`,
    { broadcasterId: STREAMER_B_ID },
    { "x-broadcaster-id": STREAMER_B_ID }
  );
  const aCooldown = await request(handler, sessionA, tenantA, "POST", "/api/followers/refresh?limit=50", {});
  const bFirst = await request(handler, sessionB, tenantB, "POST", "/api/followers/refresh?limit=50", {});
  const bCooldown = await request(handler, sessionB, tenantB, "POST", "/api/followers/refresh?limit=50", {});

  assert.equal(aFirst.statusCode, 200);
  assert.equal(bFirst.statusCode, 200);
  assert.equal(aCooldown.headers["X-StreamOps-Cache"], "cooldown");
  assert.equal(bCooldown.headers["X-StreamOps-Cache"], "cooldown");
  assert.deepEqual(calls.map((call) => call.broadcasterId), [STREAMER_A_ID, STREAMER_B_ID]);
  assert.deepEqual(calls.map((call) => call.limit), [50, 50]);
  assert.equal(calls[0].context.broadcasterId, STREAMER_A_ID);
  assert.equal(calls[1].context.broadcasterId, STREAMER_B_ID);
  assert.deepEqual(store.getFollowerManagementState(STREAMER_A_ID).followers.map((item) => item.userName), ["RefreshedForA"]);
  assert.deepEqual(store.getFollowerManagementState(STREAMER_B_ID).followers.map((item) => item.userName), ["RefreshedForB"]);
  assert.doesNotMatch(aFirst.body, /private-access-token|refreshToken/);
});

test("팔로워 refresh in-flight 요청은 같은 tenant에서만 공유되고 다른 tenant는 독립 실행된다", async () => {
  const { store, tenantA, tenantB, sessions, sessionA, sessionB } = setupTenants();
  const invokedA = deferred();
  const invokedB = deferred();
  const resultA = deferred();
  const resultB = deferred();
  const calls = [];
  const twitch = {
    async getChannelFollowersForBroadcaster(_context, broadcasterId) {
      calls.push(broadcasterId);
      if (broadcasterId === STREAMER_A_ID) {
        invokedA.resolve();
        return resultA.promise;
      }
      invokedB.resolve();
      return resultB.promise;
    }
  };
  const handler = createHttpHandler(handlerInput(store, sessions, connectedFollowerAuth(), twitch));

  const aFirstPromise = request(handler, sessionA, tenantA, "POST", "/api/followers/refresh", {});
  await invokedA.promise;
  const aSharedPromise = request(handler, sessionA, tenantA, "POST", "/api/followers/refresh", {});
  const bFirstPromise = request(handler, sessionB, tenantB, "POST", "/api/followers/refresh", {});
  await invokedB.promise;
  const callsWhilePending = [...calls];

  resultA.resolve({ followers: [follower("PendingForA")], total: 1, truncated: false });
  resultB.resolve({ followers: [follower("PendingForB")], total: 1, truncated: false });
  const [aFirst, aShared, bFirst] = await Promise.all([aFirstPromise, aSharedPromise, bFirstPromise]);

  assert.deepEqual(callsWhilePending, [STREAMER_A_ID, STREAMER_B_ID]);
  assert.deepEqual(calls, [STREAMER_A_ID, STREAMER_B_ID]);
  assert.equal(aFirst.statusCode, 200);
  assert.equal(aShared.statusCode, 200);
  assert.equal(bFirst.statusCode, 200);
  assert.equal(aShared.headers["X-StreamOps-Cache"], "in-flight");
  assert.equal(JSON.parse(aShared.body).followers[0].userName, "PendingForA");
  assert.equal(JSON.parse(bFirst.body).followers[0].userName, "PendingForB");
});

test("팔로워 refresh는 limit과 OAuth 미연결, scope 부족, token 만료를 안정적인 code로 구분한다", async () => {
  const { store, tenantA, sessions, sessionA } = setupTenants();
  let state = "disconnected";
  let accessContextCalls = 0;
  const followerAuth = {
    async getStatus() {
      if (state === "missing_scopes") return { state, missingScopes: [FOLLOWER_SCOPE] };
      if (state === "token_expired") {
        return { state, missingScopes: [], error: "token이 만료되었습니다." };
      }
      return { state: "disconnected", missingScopes: [FOLLOWER_SCOPE] };
    },
    async getAccessContext() {
      accessContextCalls += 1;
      if (state === "missing_scopes") {
        throw new StreamerFollowerAuthError(
          "MISSING_SCOPES",
          "Twitch 팔로워 조회 scope가 부족합니다.",
          [FOLLOWER_SCOPE]
        );
      }
      if (state === "token_expired") {
        throw new StreamerFollowerAuthError("TOKEN_EXPIRED", "Twitch 팔로워 관리 token이 만료되었습니다.");
      }
      throw new StreamerFollowerAuthError("NOT_CONNECTED", "Twitch 팔로워 관리 운영 권한이 연결되지 않았습니다.");
    }
  };
  let twitchCalls = 0;
  const handler = createHttpHandler(handlerInput(store, sessions, followerAuth, {
    async getChannelFollowersForBroadcaster() {
      twitchCalls += 1;
      return { followers: [], total: 0, truncated: false };
    }
  }));

  for (const invalidLimit of ["0", "5001", "abc", "1.5"]) {
    const invalidRes = await request(
      handler,
      sessionA,
      tenantA,
      "POST",
      `/api/followers/refresh?limit=${encodeURIComponent(invalidLimit)}`,
      {}
    );
    assert.equal(invalidRes.statusCode, 400);
    assert.equal(JSON.parse(invalidRes.body).code, "INVALID_FOLLOWER_LIMIT");
  }
  assert.equal(accessContextCalls, 0);

  const disconnectedStateRes = await request(handler, sessionA, tenantA, "GET", "/api/followers", undefined);
  assert.equal(JSON.parse(disconnectedStateRes.body).oauth.state, "disconnected");
  const disconnectedRefreshRes = await request(handler, sessionA, tenantA, "POST", "/api/followers/refresh", {});
  assert.equal(disconnectedRefreshRes.statusCode, 409);
  assert.equal(JSON.parse(disconnectedRefreshRes.body).code, "FOLLOWER_OAUTH_REQUIRED");

  state = "missing_scopes";
  const missingScopeStateRes = await request(handler, sessionA, tenantA, "GET", "/api/followers", undefined);
  assert.equal(JSON.parse(missingScopeStateRes.body).oauth.state, "missing_scopes");
  const missingScopeRefreshRes = await request(handler, sessionA, tenantA, "POST", "/api/followers/refresh", {});
  assert.equal(missingScopeRefreshRes.statusCode, 403);
  assert.equal(JSON.parse(missingScopeRefreshRes.body).code, "FOLLOWER_SCOPE_MISSING");
  assert.deepEqual(JSON.parse(missingScopeRefreshRes.body).missingScopes, [FOLLOWER_SCOPE]);

  state = "token_expired";
  const expiredStateRes = await request(handler, sessionA, tenantA, "GET", "/api/followers", undefined);
  assert.equal(JSON.parse(expiredStateRes.body).oauth.state, "token_expired");
  const expiredRefreshRes = await request(handler, sessionA, tenantA, "POST", "/api/followers/refresh", {});
  assert.equal(expiredRefreshRes.statusCode, 409);
  assert.equal(JSON.parse(expiredRefreshRes.body).code, "FOLLOWER_TOKEN_EXPIRED");
  assert.equal(twitchCalls, 0);
});

test("팔로워 OAuth start는 인증 principal 소유자만 사용하고 token 또는 사용자 ID를 응답하지 않는다", async () => {
  const { store, tenantA, sessions, sessionA } = setupTenants();
  let captured;
  const followerAuth = {
    ...connectedFollowerAuth(),
    createAuthorizationUrl(ownerId, options) {
      captured = { ownerId, options };
      return "https://id.twitch.tv/oauth2/authorize?client_id=follower-client&scope=moderator%3Aread%3Afollowers&state=opaque";
    }
  };
  const handler = createHttpHandler(handlerInput(store, sessions, followerAuth));
  const res = await request(
    handler,
    sessionA,
    tenantA,
    "POST",
    `/api/followers/oauth/start?broadcasterId=${STREAMER_B_ID}`,
    {
      ownerId: STREAMER_B_ID,
      broadcasterId: STREAMER_B_ID,
      accessToken: "must-not-appear",
      refreshToken: "must-not-appear"
    },
    { "x-broadcaster-id": STREAMER_B_ID }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(captured.ownerId, STREAMER_A_ID);
  const returnUrl = new URL(captured.options.returnUrl);
  assert.equal(returnUrl.pathname, `/dashboard/${tenantA.dashboardSlug}/${tenantA.dashboardKey}/followers`);
  assert.equal(returnUrl.searchParams.get("twitch"), "connected");
  const body = JSON.parse(res.body);
  assert.deepEqual(Object.keys(body), ["url"]);
  assert.equal(new URL(body.url).origin, "https://id.twitch.tv");
  assert.doesNotMatch(res.body, /must-not-appear|private-access-token|refreshToken/);
  assert.doesNotMatch(res.body, new RegExp(`${STREAMER_A_ID}|${STREAMER_B_ID}`));
});
