import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { loadPalworldDataService } = await import("../dist/services/palworld-data.js");
const { appConfig } = await import("../dist/config.js");
const {
  ADMIN_DASHBOARD_SESSION_COOKIE,
  DashboardSessionStore,
  STREAMER_DASHBOARD_SESSION_COOKIE
} = await import("../dist/security/auth.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");
const {
  PalworldServerMonitorRateLimitError
} = await import("../dist/services/palworld-server-monitor.js");
const { Store } = await import("../dist/services/store.js");
const palworldDataService = await loadPalworldDataService();

const DASHBOARD_ORIGIN = "http://localhost:3000";
const STREAMER_A_ID = "palworld-owner-a";
const STREAMER_B_ID = "palworld-owner-b";
const DIAGNOSTIC_KEYS = ["url_policy", "dns_tcp", "tls", "basic_auth", "info", "metrics", "schema"];

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
    reviewer: "palworld-server-http-test"
  });
  const enabled = store.setStreamerRiotIdDashboardEnabled({
    requestId: request.id,
    dashboardEnabled: true,
    reviewer: "palworld-server-http-test"
  });
  assert.ok(enabled?.dashboardSlug);
  assert.ok(enabled?.dashboardKey);
  return enabled;
}

function setupTenants() {
  const store = new Store();
  const tenantA = approveStreamer(store, STREAMER_A_ID, "palworlda");
  const tenantB = approveStreamer(store, STREAMER_B_ID, "palworldb");
  const sessions = new DashboardSessionStore();
  const sessionA = sessions.create({ role: "streamer", twitchUserId: STREAMER_A_ID });
  const sessionB = sessions.create({ role: "streamer", twitchUserId: STREAMER_B_ID });
  const adminSession = sessions.create({ role: "admin" });
  return { store, tenantA, tenantB, sessions, sessionA, sessionB, adminSession };
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

function adminHeaders(session, stateChanging = false) {
  return {
    cookie: `${ADMIN_DASHBOARD_SESSION_COOKIE}=${session.id}`,
    origin: DASHBOARD_ORIGIN,
    "x-streamops-dashboard-surface": "admin",
    ...(stateChanging ? { "x-streamops-csrf": session.csrfToken } : {})
  };
}

async function send(handler, method, url, body, headers = {}) {
  const req = createRequest(method, url, body, headers);
  const res = createResponse();
  await handler(req, res);
  return res;
}

function diagnostics(state = "passed") {
  return DIAGNOSTIC_KEYS.map((key) => ({ key, state }));
}

function onlineStatus(ownerId) {
  return {
    state: "online",
    checkedAt: "2026-07-22T10:00:00.000Z",
    lastSuccessAt: "2026-07-22T10:00:00.000Z",
    latencyMs: 32,
    consecutiveFailures: 0,
    info: { serverName: `server-${ownerId}`, version: "v0.6.6" },
    metrics: {
      serverFps: 60,
      currentPlayers: 2,
      maxPlayers: 32,
      frameTimeMs: 16.67,
      uptimeSeconds: 3600,
      baseCampCount: 3,
      gameDays: 40
    },
    diagnostics: diagnostics()
  };
}

function configuredResponse(ownerId, status = onlineStatus(ownerId)) {
  return {
    enabled: true,
    pollIntervalSeconds: 30,
    connection: {
      configured: true,
      baseUrl: `https://${ownerId}.example.com:8212`,
      passwordConfigured: true,
      updatedAt: "2026-07-22T09:00:00.000Z"
    },
    status
  };
}

function removedResponse() {
  return {
    enabled: true,
    pollIntervalSeconds: 30,
    connection: { configured: false, passwordConfigured: false },
    status: {
      state: "not_configured",
      errorCode: "not_configured",
      consecutiveFailures: 0,
      diagnostics: diagnostics("skipped")
    }
  };
}

function monitorStub(overrides = {}) {
  const calls = [];
  return {
    calls,
    getDashboardResponse(ownerId) {
      calls.push({ method: "get", ownerId });
      return configuredResponse(ownerId);
    },
    async testConnection(ownerId, input) {
      calls.push({ method: "test", ownerId, input });
      return {
        connection: {
          configured: false,
          baseUrl: input.baseUrl,
          passwordConfigured: true
        },
        status: onlineStatus(ownerId)
      };
    },
    async saveConnection(ownerId, input) {
      calls.push({ method: "save", ownerId, input });
      return configuredResponse(ownerId);
    },
    async refresh(ownerId) {
      calls.push({ method: "refresh", ownerId });
      return configuredResponse(ownerId);
    },
    async removeConnection(ownerId) {
      calls.push({ method: "remove", ownerId });
      return removedResponse();
    },
    ...overrides
  };
}

function handlerInput(store, sessions, monitor, logger, extra = {}) {
  return {
    store,
    sessions,
    palworldServerMonitor: monitor,
    logger,
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    palworldDataService,
    ...extra
  };
}

test("GET API는 인증 principal의 owner만 monitor에 전달하고 tenant별 응답을 분리한다", async () => {
  const { store, tenantA, tenantB, sessions, sessionA, sessionB } = setupTenants();
  const monitor = monitorStub();
  const handler = createHttpHandler(handlerInput(store, sessions, monitor));

  const responseA = await send(
    handler,
    "GET",
    "/api/dashboard/palworld-server",
    undefined,
    streamerHeaders(sessionA, tenantA)
  );
  const responseB = await send(
    handler,
    "GET",
    "/api/dashboard/palworld-server",
    undefined,
    streamerHeaders(sessionB, tenantB)
  );

  assert.equal(responseA.statusCode, 200);
  assert.equal(responseB.statusCode, 200);
  assert.equal(JSON.parse(responseA.body).status.info.serverName, `server-${STREAMER_A_ID}`);
  assert.equal(JSON.parse(responseB.body).status.info.serverName, `server-${STREAMER_B_ID}`);
  assert.deepEqual(monitor.calls.map((call) => call.ownerId), [STREAMER_A_ID, STREAMER_B_ID]);
  assert.equal(responseA.headers["Cache-Control"], "no-store");
  assert.equal(responseB.headers["Cache-Control"], "no-store");
});

test("connection body는 unknown owner 필드를 거부하고 blank password를 omitted로 정규화한다", async () => {
  const { store, tenantA, sessions, sessionA } = setupTenants();
  const monitor = monitorStub();
  const handler = createHttpHandler(handlerInput(store, sessions, monitor));
  const headers = streamerHeaders(sessionA, tenantA, true);

  const rejected = await send(
    handler,
    "POST",
    "/api/dashboard/palworld-server/test",
    { baseUrl: "https://palworld.example.com:8212", streamerId: STREAMER_B_ID },
    headers
  );
  assert.equal(rejected.statusCode, 400);
  assert.equal(JSON.parse(rejected.body).code, "invalid_request");
  assert.equal(monitor.calls.length, 0);

  const accepted = await send(
    handler,
    "POST",
    "/api/dashboard/palworld-server/test",
    { baseUrl: "https://palworld.example.com:8212", adminPassword: "   " },
    headers
  );
  assert.equal(accepted.statusCode, 200);
  assert.deepEqual(monitor.calls[0], {
    method: "test",
    ownerId: STREAMER_A_ID,
    input: { baseUrl: "https://palworld.example.com:8212" }
  });
  assert.doesNotMatch(accepted.body, /adminPassword|super-secret|private-password/i);
});

test("query와 owner 선택 header 및 refresh body를 통한 tenant 선택을 차단한다", async () => {
  const { store, tenantA, sessions, sessionA } = setupTenants();
  const monitor = monitorStub();
  const handler = createHttpHandler(handlerInput(store, sessions, monitor));

  const query = await send(
    handler,
    "GET",
    `/api/dashboard/palworld-server?streamerId=${STREAMER_B_ID}`,
    undefined,
    streamerHeaders(sessionA, tenantA)
  );
  const header = await send(
    handler,
    "GET",
    "/api/dashboard/palworld-server",
    undefined,
    streamerHeaders(sessionA, tenantA, false, { "x-broadcaster-id": STREAMER_B_ID })
  );
  const body = await send(
    handler,
    "POST",
    "/api/dashboard/palworld-server/refresh",
    { ownerId: STREAMER_B_ID },
    streamerHeaders(sessionA, tenantA, true)
  );

  for (const response of [query, header, body]) {
    assert.equal(response.statusCode, 400);
    assert.equal(JSON.parse(response.body).code, "invalid_request");
  }
  assert.equal(monitor.calls.length, 0);
});

test("다른 tenant dashboard key와 admin 및 public 접근을 거부한다", async () => {
  const { store, tenantA, tenantB, sessions, sessionA, adminSession } = setupTenants();
  const monitor = monitorStub();
  const handler = createHttpHandler(handlerInput(store, sessions, monitor));

  const foreignTenant = await send(
    handler,
    "GET",
    "/api/dashboard/palworld-server",
    undefined,
    streamerHeaders(sessionA, tenantB)
  );
  const wrongKey = await send(
    handler,
    "GET",
    "/api/dashboard/palworld-server",
    undefined,
    streamerHeaders(sessionA, tenantA, false, { "x-streamops-dashboard-key": "sdk_wrong_key" })
  );
  const admin = await send(
    handler,
    "GET",
    "/api/dashboard/palworld-server",
    undefined,
    adminHeaders(adminSession)
  );
  const publicResponse = await send(handler, "GET", "/api/dashboard/palworld-server");

  assert.equal(foreignTenant.statusCode, 403);
  assert.equal(JSON.parse(foreignTenant.body).code, "STREAMER_TENANT_MISMATCH");
  assert.equal(wrongKey.statusCode, 403);
  assert.equal(JSON.parse(wrongKey.body).code, "STREAMER_TENANT_MISMATCH");
  assert.equal(admin.statusCode, 403);
  assert.equal(publicResponse.statusCode, 401);
  assert.equal(monitor.calls.length, 0);
});

test("허용되지 않은 method와 추가 URL 경로를 차단한다", async () => {
  const { store, tenantA, sessions, sessionA } = setupTenants();
  const monitor = monitorStub();
  const handler = createHttpHandler(handlerInput(store, sessions, monitor));

  const wrongMethod = await send(
    handler,
    "POST",
    "/api/dashboard/palworld-server",
    {},
    streamerHeaders(sessionA, tenantA, true)
  );
  const extraPath = await send(
    handler,
    "GET",
    `/api/dashboard/palworld-server/${STREAMER_B_ID}`,
    undefined,
    streamerHeaders(sessionA, tenantA)
  );

  assert.equal(wrongMethod.statusCode, 403);
  assert.equal(extraPath.statusCode, 403);
  assert.equal(monitor.calls.length, 0);
});

test("POST API는 기존 Origin과 CSRF 검증을 유지한다", async () => {
  const { store, tenantA, sessions, sessionA } = setupTenants();
  const monitor = monitorStub();
  const handler = createHttpHandler(handlerInput(store, sessions, monitor));
  const body = { baseUrl: "https://palworld.example.com:8212", adminPassword: "private-password" };

  const missingOriginHeaders = streamerHeaders(sessionA, tenantA, true);
  delete missingOriginHeaders.origin;
  const missingOrigin = await send(
    handler,
    "POST",
    "/api/dashboard/palworld-server/save",
    body,
    missingOriginHeaders
  );
  const missingCsrfHeaders = streamerHeaders(sessionA, tenantA, false);
  const missingCsrf = await send(
    handler,
    "POST",
    "/api/dashboard/palworld-server/save",
    body,
    missingCsrfHeaders
  );

  assert.equal(missingOrigin.statusCode, 403);
  assert.equal(JSON.parse(missingOrigin.body).code, "ORIGIN_DENIED");
  assert.equal(missingCsrf.statusCode, 403);
  assert.equal(JSON.parse(missingCsrf.body).code, "CSRF_REQUIRED");
  assert.equal(monitor.calls.length, 0);
});

test("monitor rate limit은 429와 Retry-After로 안전하게 변환한다", async () => {
  const { store, tenantA, sessions, sessionA } = setupTenants();
  const monitor = monitorStub({
    async refresh() {
      throw new PalworldServerMonitorRateLimitError(17);
    }
  });
  const handler = createHttpHandler(handlerInput(store, sessions, monitor));
  const response = await send(
    handler,
    "POST",
    "/api/dashboard/palworld-server/refresh",
    {},
    streamerHeaders(sessionA, tenantA, true)
  );

  assert.equal(response.statusCode, 429);
  assert.equal(response.headers["Retry-After"], "17");
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(JSON.parse(response.body).code, "rate_limited");
});

test("upstream 인증 실패와 timeout은 HTTP 200 domain status로 반환한다", async () => {
  const { store, tenantA, sessions, sessionA } = setupTenants();
  const authStatus = {
    state: "auth_failed",
    errorCode: "auth_failed",
    checkedAt: "2026-07-22T10:00:00.000Z",
    consecutiveFailures: 1,
    diagnostics: DIAGNOSTIC_KEYS.map((key) => ({
      key,
      state: key === "basic_auth" ? "failed" : key === "url_policy" || key === "dns_tcp" || key === "tls" ? "passed" : "skipped",
      ...(key === "basic_auth" ? { errorCode: "auth_failed" } : {})
    }))
  };
  const timeoutStatus = {
    state: "degraded",
    errorCode: "request_timeout",
    checkedAt: "2026-07-22T10:01:00.000Z",
    consecutiveFailures: 1,
    diagnostics: DIAGNOSTIC_KEYS.map((key) => ({
      key,
      state: key === "dns_tcp" ? "failed" : key === "url_policy" ? "passed" : "skipped",
      ...(key === "dns_tcp" ? { errorCode: "request_timeout" } : {})
    }))
  };
  let refreshCount = 0;
  const monitor = monitorStub({
    async refresh(ownerId) {
      refreshCount += 1;
      return configuredResponse(ownerId, refreshCount === 1 ? authStatus : timeoutStatus);
    }
  });
  const handler = createHttpHandler(handlerInput(store, sessions, monitor));
  const headers = streamerHeaders(sessionA, tenantA, true);

  const authFailure = await send(handler, "POST", "/api/dashboard/palworld-server/refresh", {}, headers);
  resetSecurityRateLimiters();
  const timeout = await send(handler, "POST", "/api/dashboard/palworld-server/refresh", {}, headers);

  assert.equal(authFailure.statusCode, 200);
  assert.equal(JSON.parse(authFailure.body).status.errorCode, "auth_failed");
  assert.equal(timeout.statusCode, 200);
  assert.equal(JSON.parse(timeout.body).status.errorCode, "request_timeout");
});

test("잘못된 monitor 응답과 예외 원문에서 비밀번호·내부 IP를 노출하지 않는다", async () => {
  const { store, tenantA, sessions, sessionA } = setupTenants();
  const logs = [];
  const monitor = monitorStub({
    async testConnection(ownerId, input) {
      return {
        connection: {
          configured: false,
          baseUrl: input.baseUrl,
          passwordConfigured: true
        },
        status: onlineStatus(ownerId),
        adminPassword: "super-secret-password"
      };
    },
    async refresh() {
      throw new Error("10.0.0.99 super-secret-password upstream failed");
    }
  });
  const handler = createHttpHandler(handlerInput(store, sessions, monitor, {
    error(entry) {
      logs.push(entry);
    }
  }));
  const headers = streamerHeaders(sessionA, tenantA, true);

  const invalidResponse = await send(
    handler,
    "POST",
    "/api/dashboard/palworld-server/test",
    { baseUrl: "https://palworld.example.com:8212", adminPassword: "super-secret-password" },
    headers
  );
  resetSecurityRateLimiters();
  const exception = await send(handler, "POST", "/api/dashboard/palworld-server/refresh", {}, headers);

  assert.equal(invalidResponse.statusCode, 500);
  assert.equal(exception.statusCode, 500);
  assert.doesNotMatch(invalidResponse.body, /super-secret|10\.0\.0\.99|palworld\.example/i);
  assert.doesNotMatch(exception.body, /super-secret|10\.0\.0\.99|upstream/i);
  assert.doesNotMatch(JSON.stringify(logs), /super-secret|10\.0\.0\.99|upstream/i);
});

test("monitor 미주입 시 strict disabled 응답을 반환하고 공개 Palworld DB API는 유지한다", async () => {
  const { store, tenantA, sessions, sessionA } = setupTenants();
  const handler = createHttpHandler(handlerInput(store, sessions));

  const disabled = await send(
    handler,
    "GET",
    "/api/dashboard/palworld-server",
    undefined,
    streamerHeaders(sessionA, tenantA)
  );
  const publicMeta = await send(handler, "GET", "/api/palworld/meta");

  assert.equal(disabled.statusCode, 200);
  const disabledBody = JSON.parse(disabled.body);
  assert.equal(disabledBody.enabled, false);
  assert.equal(disabledBody.connection.configured, false);
  assert.equal(disabledBody.status.errorCode, "disabled");
  assert.equal(disabledBody.status.diagnostics.length, DIAGNOSTIC_KEYS.length);
  assert.equal(disabled.headers["Cache-Control"], "no-store");
  assert.equal(publicMeta.statusCode, 200);
  assert.ok(JSON.parse(publicMeta.body).metadata);
});

test("Palworld subsystem 준비 실패는 안전한 운영 상태별 응답으로 구분한다", async () => {
  const { store, tenantA, sessions, sessionA } = setupTenants();
  const headers = streamerHeaders(sessionA, tenantA);

  for (const errorCode of ["config_missing", "config_invalid", "policy_missing", "key_missing", "key_invalid"]) {
    const handler = createHttpHandler(handlerInput(store, sessions, undefined, undefined, {
      palworldServerUnavailableCode: errorCode
    }));
    const response = await send(handler, "GET", "/api/dashboard/palworld-server", undefined, headers);
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(body.enabled, false);
    assert.equal(body.status.errorCode, errorCode);
    assert.doesNotMatch(response.body, /\/run\/secrets|\/app\/\.streamops|ciphertext|authorization/i);

    const postResponse = await send(
      handler,
      "POST",
      "/api/dashboard/palworld-server/refresh",
      {},
      streamerHeaders(sessionA, tenantA, true)
    );
    assert.equal(postResponse.statusCode, 503, postResponse.body);
    assert.equal(JSON.parse(postResponse.body).code, errorCode);
    assert.equal(postResponse.headers["Cache-Control"], "no-store");
  }
});

test("Palworld config 오류와 원격 probe 오류는 health readiness에 포함되지 않는다", async () => {
  const { store, sessions } = setupTenants();
  const monitor = monitorStub({
    async refresh() {
      throw new Error("upstream unavailable");
    }
  });
  const handler = createHttpHandler(handlerInput(store, sessions, monitor, undefined, {
    palworldServerUnavailableCode: "config_invalid",
    readiness: () => ({ ok: true, checks: { persistenceHealthy: true }, errors: [] })
  }));

  const response = await send(handler, "GET", "/health/ready");
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).status, "ready");
});
