import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const { AdminAuditLogRepository } = await import("../dist/database/repositories/admin-audit-log-repository.js");
const { DashboardSessionStore } = await import("../dist/security/auth.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");
const { Store } = await import("../dist/services/store.js");

const DASHBOARD_ORIGIN = "http://localhost:3000";
const FULL_ADMIN_TOKEN = "full_admin_token_for_partial_permission_tests_1234567890";

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

function csrfFromLoginBody(loginRes) {
  return JSON.parse(loginRes.body).csrfToken;
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
  appConfig.security.dashboardAuthToken = FULL_ADMIN_TOKEN;
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

async function withTempStore(run) {
  const dir = mkdtempSync(path.join(tmpdir(), "admin-accounts-test-"));
  const adminAccountStatePath = path.join(dir, "admin-accounts.json");
  const store = new Store({ adminAccountStatePath });
  try {
    return await run(store, adminAccountStatePath);
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
  const req = createRequest("POST", "/api/dashboard/auth/check", { token }, { origin: DASHBOARD_ORIGIN });
  const res = createResponse();
  await handler(req, res);
  return res;
}

test("서브 관리자 계정 토큰으로 로그인하면 permissions가 실린 세션이 발급된다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const tokenHash = store.hashAdminToken("sub-account-token-aaa");
    store.createAdminAccount({ label: "김운영", tokenHash, permissions: ["streamer_approval"] });
    const { handler } = handlerFor(store);

    const loginRes = await login(handler, "sub-account-token-aaa");
    assert.equal(loginRes.statusCode, 200);
    const body = JSON.parse(loginRes.body);
    assert.equal(body.authenticated, true);
    assert.equal(body.role, "admin");
    assert.deepEqual(body.permissions, ["streamer_approval"]);
  });
}));

test("서브 관리자는 부여된 권한(streamer_approval) 엔드포인트만 통과하고 그 외는 403이다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const tokenHash = store.hashAdminToken("sub-account-token-bbb");
    store.createAdminAccount({ label: "김운영", tokenHash, permissions: ["streamer_approval"] });
    const { handler } = handlerFor(store);

    const loginRes = await login(handler, "sub-account-token-bbb");
    const sessionCookie = cookieHeader(loginRes.headers["Set-Cookie"]);
    const csrfToken = csrfFromLoginBody(loginRes);

    const allowedReq = createRequest("GET", "/api/participation/streamer-riot-id-requests", undefined, {
      origin: DASHBOARD_ORIGIN,
      cookie: sessionCookie
    });
    const allowedRes = createResponse();
    await handler(allowedReq, allowedRes);
    assert.equal(allowedRes.statusCode, 200, allowedRes.body);

    /* 권한 밖 관리자 엔드포인트(감사로그)는 세분화 권한이 없으니 403이어야
       합니다 — 화이트리스트 밖은 fail-closed. */
    const deniedReq = createRequest("GET", "/api/admin/audit-logs", undefined, {
      origin: DASHBOARD_ORIGIN,
      cookie: sessionCookie,
      "x-streamops-csrf": csrfToken
    });
    const deniedRes = createResponse();
    await handler(deniedReq, deniedRes);
    assert.equal(deniedRes.statusCode, 403);
  });
}));

test("prototype 이름을 permissions로 가진 세션도 인가 규칙을 우회하지 못한다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const { handler, sessions } = handlerFor(store);
    const session = sessions.create({
      role: "admin",
      permissions: ["toString"]
    });
    const request = createRequest("GET", "/api/participation/streamer-riot-id-requests", undefined, {
      origin: DASHBOARD_ORIGIN,
      cookie: `streamops_admin_session=${session.id}`
    });
    const response = createResponse();
    await handler(request, response);
    assert.equal(response.statusCode, 403, response.body);
  });
}));

test("관리자 계정 상태 파일은 permissions를 알려진 값 화이트리스트로 필터링한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "admin-accounts-invalid-permissions-"));
  const adminAccountStatePath = path.join(dir, "admin-accounts.json");
  const failures = [];
  try {
    writeFileSync(adminAccountStatePath, JSON.stringify({
      version: 1,
      accounts: [{
        id: "invalid-permission-account",
        label: "권한검증",
        tokenHash: "a".repeat(64),
        permissions: ["streamer_approval", "unknown_permission"],
        createdAt: "2026-08-31T00:00:00.000Z"
      }]
    }));
    const store = new Store({
      adminAccountStatePath,
      onPersistenceError(failure) {
        failures.push(failure);
      }
    });
    assert.deepEqual(store.listActiveAdminAccountIds(), ["invalid-permission-account"]);
    assert.deepEqual(store.listAdminAccounts()[0]?.permissions, ["streamer_approval"]);
    assert.equal(failures.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("다른 Store 인스턴스가 비활성화한 서브 관리자 계정은 새로 로그인할 수 없다", () => withTempStore(async (store, adminAccountStatePath) => {
  await withAuthConfig(async () => {
    const tokenHash = store.hashAdminToken("sub-account-token-ccc");
    const account = store.createAdminAccount({ label: "퇴사자", tokenHash, permissions: ["streamer_approval"] });
    const { handler } = handlerFor(store);
    const externalStore = new Store({ adminAccountStatePath });
    externalStore.setAdminAccountDisabled(account.id, true);

    const loginRes = await login(handler, "sub-account-token-ccc");
    assert.equal(loginRes.statusCode, 401);
    assert.equal(JSON.parse(loginRes.body).authenticated, false);
  });
}));

test("다른 Store 인스턴스가 계정을 비활성화하면 다음 요청에서 그 계정의 기존 세션을 모두 회수한다", () => withTempStore(async (store, adminAccountStatePath) => {
  await withAuthConfig(async () => {
    const token = "sub-account-token-session-revocation";
    const account = store.createAdminAccount({
      label: "세션회수",
      tokenHash: store.hashAdminToken(token),
      permissions: ["streamer_approval"]
    });
    const { handler } = handlerFor(store);
    const firstLogin = await login(handler, token);
    const secondLogin = await login(handler, token);
    assert.equal(firstLogin.statusCode, 200);
    assert.equal(secondLogin.statusCode, 200);

    const externalStore = new Store({ adminAccountStatePath });
    externalStore.setAdminAccountDisabled(account.id, true);

    for (const loginResponse of [firstLogin, secondLogin]) {
      const request = createRequest("GET", "/api/participation/streamer-riot-id-requests", undefined, {
        origin: DASHBOARD_ORIGIN,
        cookie: cookieHeader(loginResponse.headers["Set-Cookie"])
      });
      const response = createResponse();
      await handler(request, response);
      assert.equal(response.statusCode, 401, response.body);
    }
  });
}));

test("서브 계정의 resolve와 dashboard-access 감사 metadata는 안정적인 account ID를 보존한다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const previousDatabaseEnabled = appConfig.database.enabled;
    appConfig.database.enabled = true;
    try {
      const token = "sub-account-token-audit-id";
      const account = store.createAdminAccount({
        label: "김운영",
        tokenHash: store.hashAdminToken(token),
        permissions: ["streamer_approval"]
      });
      const pending = store.upsertStreamerRiotIdRequest({
        twitchUserId: "123456789",
        twitchLogin: "audit_streamer",
        twitchDisplayName: "감사 스트리머",
        riotGameName: "Audit Streamer",
        riotTagLine: "KR1"
      });
      const queries = [];
      const adminAuditLogs = new AdminAuditLogRepository({
        async query(text, values) {
          queries.push({ text, values });
          return { rows: [], rowCount: 1 };
        }
      });
      const { handler } = handlerFor(store, {
        adminAuditLogs,
        discordDatabaseReady: () => true
      });
      const loginResponse = await login(handler, token);
      assert.equal(loginResponse.statusCode, 200, loginResponse.body);

      const resolveRequest = createRequest(
        "POST",
        "/api/participation/streamer-riot-id-requests/resolve",
        { requestId: pending.id, decision: "approved" },
        {
          origin: DASHBOARD_ORIGIN,
          cookie: cookieHeader(loginResponse.headers["Set-Cookie"]),
          "x-streamops-csrf": csrfFromLoginBody(loginResponse)
        }
      );
      const resolveResponse = createResponse();
      await handler(resolveRequest, resolveResponse);
      assert.equal(resolveResponse.statusCode, 200, resolveResponse.body);

      const dashboardAccessRequest = createRequest(
        "POST",
        "/api/participation/streamer-riot-id-requests/dashboard-access",
        { requestId: pending.id, dashboardEnabled: false },
        {
          origin: DASHBOARD_ORIGIN,
          cookie: cookieHeader(loginResponse.headers["Set-Cookie"]),
          "x-streamops-csrf": csrfFromLoginBody(loginResponse)
        }
      );
      const dashboardAccessResponse = createResponse();
      await handler(dashboardAccessRequest, dashboardAccessResponse);
      assert.equal(dashboardAccessResponse.statusCode, 200, dashboardAccessResponse.body);

      const inserts = queries.filter(({ text }) => text.includes("INSERT INTO admin_audit_logs"));
      assert.equal(inserts.length, 2);
      assert.deepEqual(inserts.map((insert) => JSON.parse(insert.values[6])), [
        {
          decision: "approved",
          noteProvided: false,
          adminAccountId: account.id
        },
        {
          dashboardEnabled: false,
          noteProvided: false,
          adminAccountId: account.id
        }
      ]);
    } finally {
      appConfig.database.enabled = previousDatabaseEnabled;
    }
  });
}));

test("기존 full_admin 토큰 로그인은 permissions 없이(전체 권한) 세션이 발급되어 하위호환을 유지한다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    /* 서브 계정이 등록돼 있어도 full_admin 토큰 매칭이 우선이며, 발급된
       세션은 permissions 필드가 없어 principalHasAdminPermission이 항상
       true를 반환합니다(기존 동작 그대로). */
    const tokenHash = store.hashAdminToken("unrelated-sub-account-token");
    store.createAdminAccount({ label: "다른 서브계정", tokenHash, permissions: ["streamer_approval"] });
    const { handler } = handlerFor(store);

    const loginRes = await login(handler, FULL_ADMIN_TOKEN);
    assert.equal(loginRes.statusCode, 200);
    const body = JSON.parse(loginRes.body);
    assert.equal(body.authenticated, true);
    assert.equal(body.role, "admin");
    /* permissions: undefined는 JSON 직렬화 과정에서 필드 자체가 생략됩니다
       (JS 표준 동작) — "필드가 없다"가 곧 "전체 권한"이라는 하위호환 계약이
       그대로 지켜지는지 확인합니다. */
    assert.equal(Object.hasOwn(body, "permissions"), false);
    const sessionCookie = cookieHeader(loginRes.headers["Set-Cookie"]);

    /* full_admin은 서브 계정 화이트리스트에 없는 감사로그 엔드포인트도
       계속 접근 가능해야 합니다(회귀 확인). */
    const auditReq = createRequest("GET", "/api/admin/audit-logs", undefined, {
      origin: DASHBOARD_ORIGIN,
      cookie: sessionCookie
    });
    const auditRes = createResponse();
    await handler(auditReq, auditRes);
    assert.notEqual(auditRes.statusCode, 403);
  });
}));

test("존재하지 않거나 틀린 토큰으로는 로그인할 수 없다(서브 계정 미스매치가 인증 우회로 이어지지 않는다)", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const tokenHash = store.hashAdminToken("real-sub-account-token");
    store.createAdminAccount({ label: "김운영", tokenHash, permissions: ["streamer_approval"] });
    const { handler } = handlerFor(store);

    const loginRes = await login(handler, "totally-wrong-token");
    assert.equal(loginRes.statusCode, 401);
    assert.equal(JSON.parse(loginRes.body).authenticated, false);
  });
}));

test("Store.createAdminAccount는 평문 토큰을 저장하지 않고 해시만 보관한다", () => withTempStore((store) => {
  const plainToken = "plain-text-token-should-never-be-persisted";
  const tokenHash = store.hashAdminToken(plainToken);
  const account = store.createAdminAccount({ label: "보안검증", tokenHash, permissions: ["streamer_approval"] });
  assert.equal(Object.hasOwn(account, "token"), false);
  assert.notEqual(account.tokenHash, plainToken);
  assert.equal(account.tokenHash, tokenHash);
  /* listAdminAccounts()로 노출되는 필드에도 평문 토큰이 없어야 합니다. */
  const listed = store.listAdminAccounts();
  assert.equal(listed.length, 1);
  assert.equal(Object.hasOwn(listed[0], "token"), false);
  assert.doesNotMatch(JSON.stringify(listed), new RegExp(plainToken));
}));

test("동일 토큰으로 계정을 두 번 생성할 수 없다", () => withTempStore((store) => {
  const tokenHash = store.hashAdminToken("duplicate-token");
  store.createAdminAccount({ label: "첫번째", tokenHash, permissions: ["streamer_approval"] });
  assert.throws(() => {
    store.createAdminAccount({ label: "두번째", tokenHash, permissions: ["streamer_approval"] });
  }, /이미 등록된 토큰/);
}));

test("setAdminAccountDisabled(false)로 다시 활성화하면 재로그인이 가능하다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const tokenHash = store.hashAdminToken("re-enable-token");
    const account = store.createAdminAccount({ label: "일시정지", tokenHash, permissions: ["streamer_approval"] });
    store.setAdminAccountDisabled(account.id, true);
    store.setAdminAccountDisabled(account.id, false);
    const { handler } = handlerFor(store);

    const loginRes = await login(handler, "re-enable-token");
    assert.equal(loginRes.statusCode, 200);
    assert.equal(JSON.parse(loginRes.body).authenticated, true);
  });
}));
