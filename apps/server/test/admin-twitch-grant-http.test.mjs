import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const { DashboardSessionStore } = await import("../dist/security/auth.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");
const { Store } = await import("../dist/services/store.js");
const { PUBLIC_TWITCH_VIEWER_SESSION_COOKIE } = await import("../dist/services/public-twitch-auth.js");
const { YORO_SESSION_COOKIE } = await import("../dist/services/yoro-account-service.js");

const DASHBOARD_ORIGIN = "http://localhost:3000";
const FULL_ADMIN_TOKEN = "full_admin_token_for_twitch_grant_tests_1234567890";
const STREAMER_TWITCH_USER_ID = "777000777";
const VIEWER_SESSION_ID = "viewer-session-777";
const GRANT_PATH = "/api/participation/streamer-riot-id-requests/grant-admin";
const REVOKE_PATH = "/api/participation/streamer-riot-id-requests/revoke-admin";
const LIST_PATH = "/api/participation/streamer-riot-id-requests";

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
  const dir = mkdtempSync(path.join(tmpdir(), "admin-twitch-grant-test-"));
  const adminAccountStatePath = path.join(dir, "admin-accounts.json");
  const streamerRiotIdStatePath = path.join(dir, "streamer-riot-ids.json");
  const store = new Store({ adminAccountStatePath, streamerRiotIdStatePath });
  try {
    return await run(store, { adminAccountStatePath, streamerRiotIdStatePath });
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
    publicTwitchAuth: {
      async getStatus(sessionId) {
        if (sessionId !== VIEWER_SESSION_ID) return { connected: false, configured: true, requiredScopes: [], missingScopes: [] };
        return {
          connected: true,
          configured: true,
          requiredScopes: [],
          missingScopes: [],
          user: { id: STREAMER_TWITCH_USER_ID, login: "granted_streamer", displayName: "Granted Streamer" }
        };
      }
    },
    ...overrides
  });
  return { handler, sessions };
}

/* 대표 계정 요청을 만들고 승인 + 대시보드 접근까지 켭니다(스트리머 surface 로그인 전제). */
function seedApprovedStreamer(store, overrides = {}) {
  const created = store.upsertStreamerRiotIdRequest({
    twitchUserId: STREAMER_TWITCH_USER_ID,
    twitchLogin: "granted_streamer",
    twitchDisplayName: "Granted Streamer",
    riotGameName: "Granted Streamer",
    riotTagLine: "KR1",
    ...overrides
  });
  const approved = store.resolveStreamerRiotIdRequest({ requestId: created.id, decision: "approved", reviewer: "test" });
  assert.ok(approved);
  const enabled = store.setStreamerRiotIdDashboardEnabled({ requestId: created.id, dashboardEnabled: true, reviewer: "test" });
  assert.ok(enabled);
  return enabled;
}

async function loginWithToken(handler, token) {
  const req = createRequest("POST", "/api/dashboard/auth/check", { token }, { origin: DASHBOARD_ORIGIN });
  const res = createResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 200, res.body);
  return { cookie: cookieHeader(res.headers["Set-Cookie"]), csrf: JSON.parse(res.body).csrfToken, body: JSON.parse(res.body) };
}

async function loginSubAdmin(store, handler, token) {
  const tokenHash = store.hashAdminToken(token);
  store.createAdminAccount({ label: "서브 운영자", tokenHash, permissions: ["streamer_approval"] });
  return loginWithToken(handler, token);
}

async function postAs(handler, pathname, body, session) {
  const req = createRequest("POST", pathname, body, {
    origin: DASHBOARD_ORIGIN,
    cookie: session.cookie,
    "x-streamops-csrf": session.csrf,
    "x-streamops-dashboard-surface": "admin"
  });
  const res = createResponse();
  await handler(req, res);
  return res;
}

async function getAs(handler, pathname, session) {
  const req = createRequest("GET", pathname, undefined, {
    origin: DASHBOARD_ORIGIN,
    cookie: session.cookie,
    "x-streamops-dashboard-surface": "admin"
  });
  const res = createResponse();
  await handler(req, res);
  return res;
}

/* Twitch OAuth(공개 뷰어 세션)만 들고 관리자 콘솔 status를 확인하는 요청. */
async function adminStatusWithTwitchLogin(handler) {
  const req = createRequest("GET", "/api/dashboard/auth/status?surface=admin", undefined, {
    origin: DASHBOARD_ORIGIN,
    cookie: `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=${VIEWER_SESSION_ID}`,
    "x-streamops-dashboard-surface": "admin"
  });
  const res = createResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 200, res.body);
  return res;
}

/* YORO 계정 세션만 들고 관리자 콘솔 status를 확인하는 요청. */
async function adminStatusWithYoroLogin(handler, sessionCookie = "yoro-session-cookie") {
  const req = createRequest("GET", "/api/dashboard/auth/status?surface=admin", undefined, {
    origin: DASHBOARD_ORIGIN,
    cookie: `${YORO_SESSION_COOKIE}=${sessionCookie}`,
    "x-streamops-dashboard-surface": "admin"
  });
  const res = createResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 200, res.body);
  return res;
}

async function streamerStatusWithTwitchLogin(handler) {
  const req = createRequest("GET", "/api/dashboard/auth/status?surface=streamer", undefined, {
    origin: DASHBOARD_ORIGIN,
    cookie: `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=${VIEWER_SESSION_ID}`,
    "x-streamops-dashboard-surface": "streamer"
  });
  const res = createResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 200, res.body);
  return res;
}

test("full_admin이 승인된 스트리머에게 grant-admin하면 Twitch 로그인만으로 streamer_approval admin 세션이 발급된다", () => withTempStore(async (store, paths) => {
  await withAuthConfig(async () => {
    const request = seedApprovedStreamer(store);
    const { handler } = handlerFor(store);
    const fullAdmin = await loginWithToken(handler, FULL_ADMIN_TOKEN);

    /* 부여 전: 목록은 isAdmin=false, Twitch 로그인은 관리자 콘솔에서 미인증 */
    const beforeList = await getAs(handler, LIST_PATH, fullAdmin);
    assert.equal(beforeList.statusCode, 200, beforeList.body);
    assert.equal(JSON.parse(beforeList.body).requests[0].isAdmin, false);
    assert.equal(Object.hasOwn(JSON.parse(beforeList.body).requests[0], "twitchUserId"), false);
    const beforeStatus = await adminStatusWithTwitchLogin(handler);
    assert.equal(JSON.parse(beforeStatus.body).authenticated, false);

    const grantRes = await postAs(handler, GRANT_PATH, { requestId: request.id }, fullAdmin);
    assert.equal(grantRes.statusCode, 200, grantRes.body);
    const grantBody = JSON.parse(grantRes.body);
    assert.equal(grantBody.request.id, request.id);
    assert.equal(grantBody.request.isAdmin, true);
    assert.equal(grantBody.requests[0].isAdmin, true);
    assert.equal(Object.hasOwn(grantBody.request, "twitchUserId"), false);

    /* 저장 파일: twitchUserId 기반 레코드에는 tokenHash가 없어야 한다 */
    const persisted = JSON.parse(readFileSync(paths.adminAccountStatePath, "utf8"));
    assert.equal(persisted.accounts.length, 1);
    assert.equal(persisted.accounts[0].twitchUserId, STREAMER_TWITCH_USER_ID);
    assert.equal(Object.hasOwn(persisted.accounts[0], "tokenHash"), false);
    assert.deepEqual(persisted.accounts[0].permissions, ["streamer_approval"]);

    /* 중복 부여는 idempotent — 같은 계정 id, 에러 없음 */
    const againRes = await postAs(handler, GRANT_PATH, { requestId: request.id }, fullAdmin);
    assert.equal(againRes.statusCode, 200, againRes.body);
    assert.equal(JSON.parse(readFileSync(paths.adminAccountStatePath, "utf8")).accounts.length, 1);

    /* Twitch OAuth 로그인 → admin 세션 승격 */
    const statusRes = await adminStatusWithTwitchLogin(handler);
    const statusBody = JSON.parse(statusRes.body);
    assert.equal(statusBody.authenticated, true);
    assert.equal(statusBody.role, "admin");
    assert.deepEqual(statusBody.permissions, ["streamer_approval"]);
    assert.equal(statusBody.adminAccountId, persisted.accounts[0].id);
    assert.equal(statusBody.adminAccountLabel, "Granted Streamer");
    assert.equal(typeof statusBody.csrfToken, "string");
    const grantedSession = { cookie: cookieHeader(statusRes.headers["Set-Cookie"]), csrf: statusBody.csrfToken };
    assert.match(grantedSession.cookie, /^streamops_admin_session=/u);

    /* 승격된 세션은 streamer_approval 엔드포인트를 통과한다 */
    const listAsGranted = await getAs(handler, LIST_PATH, grantedSession);
    assert.equal(listAsGranted.statusCode, 200, listAsGranted.body);

    /* 스트리머 surface는 그대로 streamer 세션 — 두 세션은 공존한다 */
    const streamerStatus = await streamerStatusWithTwitchLogin(handler);
    assert.equal(JSON.parse(streamerStatus.body).role, "streamer");
  });
}));

test("YORO 계정 세션의 Twitch identity로도 권한이 제한된 admin 세션이 발급된다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const grantedAccount = store.grantAdminAccountToTwitchUser({
      twitchUserId: STREAMER_TWITCH_USER_ID,
      label: "YORO 연결 관리자",
      permissions: ["streamer_approval"]
    });
    const seenCookies = [];
    let viewerStatusCalls = 0;
    const { handler } = handlerFor(store, {
      publicTwitchAuth: {
        async getStatus() {
          viewerStatusCalls += 1;
          return { connected: false, configured: true, requiredScopes: [], missingScopes: [] };
        }
      },
      yoroAccounts: {
        async twitchUserIdForSession(cookieValue) {
          seenCookies.push(cookieValue);
          return STREAMER_TWITCH_USER_ID;
        }
      }
    });

    const statusRes = await adminStatusWithYoroLogin(handler);
    const statusBody = JSON.parse(statusRes.body);
    assert.equal(statusBody.authenticated, true);
    assert.equal(statusBody.role, "admin");
    assert.deepEqual(statusBody.permissions, ["streamer_approval"]);
    assert.equal(statusBody.adminAccountId, grantedAccount.id);
    assert.equal(statusBody.adminAccountLabel, "YORO 연결 관리자");
    assert.equal(typeof statusBody.csrfToken, "string");
    assert.match(cookieHeader(statusRes.headers["Set-Cookie"]), /^streamops_admin_session=/u);
    assert.deepEqual(seenCookies, ["yoro-session-cookie"]);
    assert.equal(viewerStatusCalls, 0);
  });
}));

test("YORO 계정의 Twitch 미연결·관리자 미부여·세션 조회 실패는 안전하게 미인증으로 남는다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    for (const result of [undefined, "999000999", new Error("session lookup failed")]) {
      const { handler } = handlerFor(store, {
        yoroAccounts: {
          async twitchUserIdForSession() {
            if (result instanceof Error) throw result;
            return result;
          }
        }
      });
      const statusRes = await adminStatusWithYoroLogin(handler);
      assert.equal(JSON.parse(statusRes.body).authenticated, false);
      assert.equal(statusRes.headers["Set-Cookie"], undefined);
    }
  });
}));

test("서브 관리자(streamer_approval만 가진 세션)는 grant-admin/revoke-admin을 호출할 수 없다(403)", () => withTempStore(async (store, paths) => {
  await withAuthConfig(async () => {
    const request = seedApprovedStreamer(store);
    const { handler } = handlerFor(store);
    const subAdmin = await loginSubAdmin(store, handler, "sub-admin-token-grant-test");
    assert.deepEqual(subAdmin.body.permissions, ["streamer_approval"]);

    /* 서브 관리자도 목록은 볼 수 있다 — 부여/회수만 막혀야 한다 */
    const listRes = await getAs(handler, LIST_PATH, subAdmin);
    assert.equal(listRes.statusCode, 200, listRes.body);

    const grantRes = await postAs(handler, GRANT_PATH, { requestId: request.id }, subAdmin);
    assert.equal(grantRes.statusCode, 403, grantRes.body);
    const revokeRes = await postAs(handler, REVOKE_PATH, { requestId: request.id }, subAdmin);
    assert.equal(revokeRes.statusCode, 403, revokeRes.body);

    /* 부여 상태는 바뀌지 않았다(저장 파일에는 CLI 서브 계정 1건만) */
    const persisted = JSON.parse(readFileSync(paths.adminAccountStatePath, "utf8"));
    assert.equal(persisted.accounts.length, 1);
    assert.equal(Object.hasOwn(persisted.accounts[0], "twitchUserId"), false);
    const afterList = await getAs(handler, LIST_PATH, subAdmin);
    assert.equal(JSON.parse(afterList.body).requests[0].isAdmin, false);
  });
}));

test("Twitch 부여로 승격된 admin 세션도 다른 계정에 권한을 부여·회수할 수 없다(권한 상승 방지)", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const request = seedApprovedStreamer(store);
    const other = store.upsertStreamerRiotIdRequest({
      twitchUserId: "888000888",
      twitchLogin: "other_streamer",
      twitchDisplayName: "Other Streamer",
      riotGameName: "Other Streamer",
      riotTagLine: "KR1"
    });
    assert.ok(store.resolveStreamerRiotIdRequest({ requestId: other.id, decision: "approved", reviewer: "test" }));
    const { handler } = handlerFor(store);
    const fullAdmin = await loginWithToken(handler, FULL_ADMIN_TOKEN);
    assert.equal((await postAs(handler, GRANT_PATH, { requestId: request.id }, fullAdmin)).statusCode, 200);

    const statusRes = await adminStatusWithTwitchLogin(handler);
    const granted = { cookie: cookieHeader(statusRes.headers["Set-Cookie"]), csrf: JSON.parse(statusRes.body).csrfToken };

    const grantOther = await postAs(handler, GRANT_PATH, { requestId: other.id }, granted);
    assert.equal(grantOther.statusCode, 403, grantOther.body);
    const revokeSelf = await postAs(handler, REVOKE_PATH, { requestId: request.id }, granted);
    assert.equal(revokeSelf.statusCode, 403, revokeSelf.body);

    const listRes = await getAs(handler, LIST_PATH, fullAdmin);
    const byId = new Map(JSON.parse(listRes.body).requests.map((item) => [item.id, item]));
    assert.equal(byId.get(request.id).isAdmin, true);
    assert.equal(byId.get(other.id).isAdmin, false);
  });
}));

test("스트리머 role 세션은 grant-admin을 호출할 수 없다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    const request = seedApprovedStreamer(store);
    const { handler } = handlerFor(store);
    const streamerStatus = await streamerStatusWithTwitchLogin(handler);
    const streamerBody = JSON.parse(streamerStatus.body);
    assert.equal(streamerBody.role, "streamer");
    const streamerSession = { cookie: cookieHeader(streamerStatus.headers["Set-Cookie"]), csrf: streamerBody.csrfToken };

    const req = createRequest("POST", GRANT_PATH, { requestId: request.id }, {
      origin: DASHBOARD_ORIGIN,
      cookie: streamerSession.cookie,
      "x-streamops-csrf": streamerSession.csrf,
      "x-streamops-dashboard-surface": "streamer"
    });
    const res = createResponse();
    await handler(req, res);
    assert.equal(res.statusCode, 403, res.body);
  });
}));

test("revoke-admin은 이미 발급된 admin 세션을 즉시 무효화하고 Twitch 로그인은 streamer role로 돌아간다", () => withTempStore(async (store, paths) => {
  await withAuthConfig(async () => {
    const request = seedApprovedStreamer(store);
    const { handler } = handlerFor(store);
    const fullAdmin = await loginWithToken(handler, FULL_ADMIN_TOKEN);
    assert.equal((await postAs(handler, GRANT_PATH, { requestId: request.id }, fullAdmin)).statusCode, 200);

    const statusRes = await adminStatusWithTwitchLogin(handler);
    const statusBody = JSON.parse(statusRes.body);
    const granted = { cookie: cookieHeader(statusRes.headers["Set-Cookie"]), csrf: statusBody.csrfToken };
    assert.equal((await getAs(handler, LIST_PATH, granted)).statusCode, 200);

    const revokeRes = await postAs(handler, REVOKE_PATH, { requestId: request.id }, fullAdmin);
    assert.equal(revokeRes.statusCode, 200, revokeRes.body);
    const revokeBody = JSON.parse(revokeRes.body);
    assert.equal(revokeBody.request.isAdmin, false);
    assert.equal(revokeBody.requests[0].isAdmin, false);

    /* 이미 발급된 admin 세션은 다음 요청부터 401 */
    const afterRevoke = await getAs(handler, LIST_PATH, granted);
    assert.equal(afterRevoke.statusCode, 401, afterRevoke.body);

    /* 저장 파일에서 레코드가 제거됐고, Twitch 로그인은 관리자 콘솔에서 미인증 */
    assert.deepEqual(JSON.parse(readFileSync(paths.adminAccountStatePath, "utf8")).accounts, []);
    const adminStatus = await adminStatusWithTwitchLogin(handler);
    assert.equal(JSON.parse(adminStatus.body).authenticated, false);

    /* 스트리머 surface는 원래대로 streamer 세션 */
    const streamerStatus = await streamerStatusWithTwitchLogin(handler);
    assert.equal(JSON.parse(streamerStatus.body).role, "streamer");

    /* 부여가 없는 상태에서의 회수는 idempotent */
    const revokeAgain = await postAs(handler, REVOKE_PATH, { requestId: request.id }, fullAdmin);
    assert.equal(revokeAgain.statusCode, 200, revokeAgain.body);

    /* full_admin 세션은 회수의 영향을 받지 않는다 */
    assert.equal((await getAs(handler, LIST_PATH, fullAdmin)).statusCode, 200);
  });
}));

test("grant-admin은 승인된 대표 계정 요청에만 허용된다(pending·rejected·서브 계정·미존재 거부)", () => withTempStore(async (store, paths) => {
  await withAuthConfig(async () => {
    const pending = store.upsertStreamerRiotIdRequest({
      twitchUserId: "111000111",
      twitchLogin: "pending_streamer",
      twitchDisplayName: "Pending Streamer",
      riotGameName: "Pending Streamer",
      riotTagLine: "KR1"
    });
    const rejectedCreated = store.upsertStreamerRiotIdRequest({
      twitchUserId: "222000222",
      twitchLogin: "rejected_streamer",
      twitchDisplayName: "Rejected Streamer",
      riotGameName: "Rejected Streamer",
      riotTagLine: "KR1"
    });
    const rejected = store.resolveStreamerRiotIdRequest({ requestId: rejectedCreated.id, decision: "rejected", reviewer: "test" });
    const main = seedApprovedStreamer(store);
    const subResult = store.addStreamerSubRiotIdRequest({
      twitchUserId: STREAMER_TWITCH_USER_ID,
      twitchLogin: "granted_streamer",
      twitchDisplayName: "Granted Streamer",
      riotGameName: "Granted Sub",
      riotTagLine: "KR1"
    }, { approvalMode: "owner_self_service" });
    assert.equal(subResult.ok, true);
    assert.equal(subResult.request.status, "approved");
    assert.equal(subResult.request.accountRole, "sub");

    const { handler } = handlerFor(store);
    const fullAdmin = await loginWithToken(handler, FULL_ADMIN_TOKEN);

    const pendingRes = await postAs(handler, GRANT_PATH, { requestId: pending.id }, fullAdmin);
    assert.equal(pendingRes.statusCode, 400, pendingRes.body);
    assert.equal(JSON.parse(pendingRes.body).code, "ADMIN_GRANT_REQUIRES_APPROVAL");

    const rejectedRes = await postAs(handler, GRANT_PATH, { requestId: rejected.id }, fullAdmin);
    assert.equal(rejectedRes.statusCode, 400, rejectedRes.body);
    assert.equal(JSON.parse(rejectedRes.body).code, "ADMIN_GRANT_REQUIRES_APPROVAL");

    const subRes = await postAs(handler, GRANT_PATH, { requestId: subResult.request.id }, fullAdmin);
    assert.equal(subRes.statusCode, 400, subRes.body);
    assert.equal(JSON.parse(subRes.body).code, "ADMIN_GRANT_MAIN_ACCOUNT_ONLY");

    const missingRes = await postAs(handler, GRANT_PATH, { requestId: "riotreq-does-not-exist" }, fullAdmin);
    assert.equal(missingRes.statusCode, 404, missingRes.body);

    const badBodyRes = await postAs(handler, GRANT_PATH, { requestId: 42 }, fullAdmin);
    assert.equal(badBodyRes.statusCode, 400, badBodyRes.body);

    /* 거부된 호출은 아무 것도 저장하지 않는다 */
    let persistedAccounts = [];
    try {
      persistedAccounts = JSON.parse(readFileSync(paths.adminAccountStatePath, "utf8")).accounts;
    } catch (error) {
      assert.equal(error.code, "ENOENT");
    }
    assert.deepEqual(persistedAccounts, []);

    /* 대표 계정에 부여하면 같은 twitchUserId의 서브 row도 isAdmin=true로 표시된다 */
    assert.equal((await postAs(handler, GRANT_PATH, { requestId: main.id }, fullAdmin)).statusCode, 200);
    const listRes = await getAs(handler, LIST_PATH, fullAdmin);
    const byId = new Map(JSON.parse(listRes.body).requests.map((item) => [item.id, item]));
    assert.equal(byId.get(main.id).isAdmin, true);
    assert.equal(byId.get(subResult.request.id).isAdmin, true);
    assert.equal(byId.get(pending.id).isAdmin, false);
  });
}));

test("grant-admin/revoke-admin은 Store 변경 전에 전역 감사를 시작하고 성공으로 확정한다", () => withTempStore(async (store) => {
  await withAuthConfig(async () => {
    appConfig.database.enabled = true;
    const request = seedApprovedStreamer(store);
    const sequence = [];
    const auditInputs = [];
    const completions = [];
    const originalGrant = store.grantAdminAccountToTwitchUser.bind(store);
    const originalRevoke = store.revokeAdminAccountFromTwitchUser.bind(store);
    store.grantAdminAccountToTwitchUser = (input) => {
      sequence.push("store:grant");
      return originalGrant(input);
    };
    store.revokeAdminAccountFromTwitchUser = (twitchUserId) => {
      sequence.push("store:revoke");
      return originalRevoke(twitchUserId);
    };
    const { handler } = handlerFor(store, {
      discordDatabaseReady: () => true,
      adminAuditLogs: {
        async list() {
          return { logs: [], page: { from: "2026-08-08T00:00:00.000Z", to: "2026-08-08T00:00:00.000Z", offset: 0, limit: 50, hasMore: false, truncated: false } };
        },
        async beginGlobalMutation(input) {
          sequence.push("begin");
          auditInputs.push(input);
          return { mutationId: `mutation-${auditInputs.length}` };
        },
        async completeGlobalMutation(input) {
          sequence.push("complete");
          completions.push(input);
        }
      }
    });
    const fullAdmin = await loginWithToken(handler, FULL_ADMIN_TOKEN);

    const grantRes = await postAs(handler, GRANT_PATH, { requestId: request.id }, fullAdmin);
    assert.equal(grantRes.statusCode, 200, grantRes.body);
    const revokeRes = await postAs(handler, REVOKE_PATH, { requestId: request.id }, fullAdmin);
    assert.equal(revokeRes.statusCode, 200, revokeRes.body);

    assert.deepEqual(sequence, ["begin", "store:grant", "complete", "begin", "store:revoke", "complete"]);
    assert.equal(auditInputs.length, 2);
    for (const input of auditInputs) {
      assert.equal(input.action, "streamer.admin_access.updated");
      assert.equal(input.targetIdentifier, request.id);
      assert.equal(input.actorMethod, "session");
      assert.match(input.actorSessionId, /^dashboard-session:/u);
      /* twitchUserId·계정 라벨 같은 식별 정보는 metadata에 남기지 않는다 */
      assert.deepEqual(Object.keys(input.metadata).sort(), ["granted"]);
    }
    assert.deepEqual(auditInputs.map((input) => input.metadata.granted), [true, false]);
    assert.deepEqual(completions, [
      { mutationId: "mutation-1", outcome: "succeeded" },
      { mutationId: "mutation-2", outcome: "succeeded" }
    ]);
  });
}));

test("감사 로그를 사용할 수 없으면 grant-admin은 503으로 거부되고 아무 것도 저장하지 않는다", () => withTempStore(async (store, paths) => {
  await withAuthConfig(async () => {
    appConfig.database.enabled = true;
    const request = seedApprovedStreamer(store);
    const { handler } = handlerFor(store, { discordDatabaseReady: () => false });
    const fullAdmin = await loginWithToken(handler, FULL_ADMIN_TOKEN);

    const grantRes = await postAs(handler, GRANT_PATH, { requestId: request.id }, fullAdmin);
    assert.equal(grantRes.statusCode, 503, grantRes.body);
    assert.equal(JSON.parse(grantRes.body).code, "AUDIT_LOGS_UNAVAILABLE");
    assert.throws(() => readFileSync(paths.adminAccountStatePath, "utf8"), { code: "ENOENT" });
    assert.equal(store.findActiveAdminAccountByTwitchUserId(STREAMER_TWITCH_USER_ID), undefined);
  });
}));

test("관리자 계정 상태 파일은 tokenHash·twitchUserId 계정이 공존하되 정확히 하나만 가진 레코드만 받는다", () => withTempStore(async (store, paths) => {
  const tokenHash = store.hashAdminToken("cli-sub-account-token");
  const cliAccount = store.createAdminAccount({ label: "CLI 서브", tokenHash, permissions: ["streamer_approval"] });
  const granted = store.grantAdminAccountToTwitchUser({
    twitchUserId: STREAMER_TWITCH_USER_ID,
    label: "Granted Streamer",
    permissions: ["streamer_approval"]
  });
  assert.notEqual(cliAccount.id, granted.id);

  /* 다른 프로세스(CLI)처럼 같은 파일을 새 Store로 읽어도 두 종류가 모두 복원된다 */
  const reloaded = new Store({ adminAccountStatePath: paths.adminAccountStatePath });
  assert.equal(reloaded.findAdminAccountByTokenHash(tokenHash)?.id, cliAccount.id);
  assert.equal(reloaded.findActiveAdminAccountByTwitchUserId(STREAMER_TWITCH_USER_ID)?.id, granted.id);
  assert.equal(reloaded.findAdminAccountByTokenHash(STREAMER_TWITCH_USER_ID), undefined);
  assert.deepEqual(reloaded.listActiveAdminAccountIds().sort(), [cliAccount.id, granted.id].sort());

  /* 비활성화된 부여는 "부여 없음"으로 판정되고, 재부여는 새 레코드 대신 다시 활성화한다 */
  assert.ok(reloaded.setAdminAccountDisabled(granted.id, true));
  assert.equal(reloaded.findActiveAdminAccountByTwitchUserId(STREAMER_TWITCH_USER_ID), undefined);
  const regranted = reloaded.grantAdminAccountToTwitchUser({
    twitchUserId: STREAMER_TWITCH_USER_ID,
    label: "Granted Streamer",
    permissions: ["streamer_approval"]
  });
  assert.equal(regranted.id, granted.id);
  assert.equal(regranted.disabled, false);
  assert.equal(reloaded.listAdminAccounts().length, 2);

  /* 회수는 레코드를 제거하고 제거된 계정을 돌려준다 */
  assert.equal(reloaded.revokeAdminAccountFromTwitchUser(STREAMER_TWITCH_USER_ID)?.id, granted.id);
  assert.equal(reloaded.revokeAdminAccountFromTwitchUser(STREAMER_TWITCH_USER_ID), undefined);
  assert.equal(reloaded.listAdminAccounts().length, 1);

  /* tokenHash와 twitchUserId를 동시에 가진 레코드는 fail-closed로 파일 전체를 거부한다 */
  writeFileSync(paths.adminAccountStatePath, `${JSON.stringify({
    version: 1,
    accounts: [{
      id: "ambiguous",
      label: "둘 다 가진 레코드",
      tokenHash,
      twitchUserId: STREAMER_TWITCH_USER_ID,
      permissions: ["streamer_approval"],
      createdAt: "2026-08-08T00:00:00.000Z"
    }]
  })}\n`);
  const ambiguous = new Store({ adminAccountStatePath: paths.adminAccountStatePath });
  assert.equal(ambiguous.findAdminAccountByTokenHash(tokenHash), undefined);
  assert.equal(ambiguous.findActiveAdminAccountByTwitchUserId(STREAMER_TWITCH_USER_ID), undefined);
}));
