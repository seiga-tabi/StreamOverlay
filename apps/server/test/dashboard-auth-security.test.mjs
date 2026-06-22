import test from "node:test";
import assert from "node:assert/strict";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const { DashboardSessionStore, DASHBOARD_SESSION_COOKIE } = await import("../dist/security/auth.js");
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
