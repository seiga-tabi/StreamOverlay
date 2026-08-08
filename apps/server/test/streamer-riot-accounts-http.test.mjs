import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const { ADMIN_DASHBOARD_SESSION_COOKIE, DashboardSessionStore } = await import("../dist/security/auth.js");
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

/* 승인된 스트리머(twitch userId "12345")로 로그인한 YORO 세션 mock. */
function createYoroAccounts(csrfToken) {
  return {
    async authenticateForManagement(cookieValue) {
      if (cookieValue !== "yoro-session") return undefined;
      return {
        userId: "11111111-1111-4111-8111-111111111111",
        csrfToken,
        csrfTokenHash: Buffer.alloc(32)
      };
    },
    async session(cookieValue) {
      if (cookieValue !== "yoro-session") return undefined;
      return {
        authenticated: true,
        csrfToken,
        authenticationProvider: "twitch",
        identities: [],
        preferences: { locale: "ko", defaultDashboardPage: "overview", reducedMotion: false }
      };
    },
    async getTwitchAccessContext(cookieValue) {
      if (cookieValue !== "yoro-session") return undefined;
      return {
        clientId: "client-id",
        accessToken: "access-token",
        userId: "12345",
        scopes: [],
        user: { id: "12345", login: "streamer", displayName: "Streamer" },
        tokenExpiresAt: "2026-08-10T00:00:00.000Z"
      };
    }
  };
}

function approveStreamer(store, twitchUserId, twitchLogin, riotGameName, riotTagLine) {
  const request = store.upsertStreamerRiotIdRequest({
    twitchUserId,
    twitchLogin,
    twitchDisplayName: twitchLogin,
    riotGameName,
    riotTagLine
  });
  store.resolveStreamerRiotIdRequest({ requestId: request.id, decision: "approved", reviewer: "test" });
  return request;
}

test("서브 Riot 계정 API는 세션·CSRF·소유권을 검증하고 계정 목록을 관리한다", async (t) => {
  const previousDatabaseEnabled = appConfig.database.enabled;
  appConfig.database.enabled = true;
  t.after(() => {
    appConfig.database.enabled = previousDatabaseEnabled;
  });
  const csrfToken = crypto.randomBytes(16).toString("hex");
  const store = new Store();
  approveStreamer(store, "12345", "streamer", "Main", "KR1");
  const otherApproved = approveStreamer(store, "99999", "other", "Other", "JP1");
  const otherSub = store.addStreamerSubRiotIdRequest({
    twitchUserId: "99999",
    twitchLogin: "other",
    twitchDisplayName: "other",
    riotGameName: "OtherSub",
    riotTagLine: "JP2"
  });
  assert.equal(otherSub.ok, true);

  const handler = createHttpHandler({
    store,
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    sessions: new DashboardSessionStore(),
    discordDatabaseReady: () => true,
    yoroAccounts: createYoroAccounts(csrfToken)
  });
  const authedHeaders = (mutation = false) => ({
    cookie: "yoro_session=yoro-session",
    ...(mutation ? { origin: DASHBOARD_ORIGIN, "x-yoro-csrf": csrfToken } : {})
  });
  const send = async (method, url, body, headers) => {
    const res = createResponse();
    await handler(createRequest(method, url, body, headers), res);
    return res;
  };

  // 세션 없이 접근 → 401
  const unauthenticated = await send("GET", "/api/account/streamer/riot-ids");
  assert.equal(unauthenticated.statusCode, 401);

  // CSRF 없이 mutation → 403
  const noCsrf = await send(
    "POST",
    "/api/account/streamer/riot-ids",
    { riotId: "Smurf#KR2" },
    { cookie: "yoro_session=yoro-session", origin: DASHBOARD_ORIGIN }
  );
  assert.equal(noCsrf.statusCode, 403);

  // 목록: 대표 계정 1개
  const initial = await send("GET", "/api/account/streamer/riot-ids", undefined, authedHeaders());
  assert.equal(initial.statusCode, 200);
  const initialBody = JSON.parse(initial.body);
  assert.equal(initialBody.accounts.length, 1);
  assert.equal(initialBody.accounts[0].isMain, true);
  assert.equal(initialBody.accounts[0].riotId, "Main#KR1");
  assert.equal(initialBody.limit.sub, 4);

  // 서브 추가 → pending row
  const added = await send("POST", "/api/account/streamer/riot-ids", { riotId: "Smurf#KR2" }, authedHeaders(true));
  assert.equal(added.statusCode, 200);
  const addedBody = JSON.parse(added.body);
  assert.equal(addedBody.accounts.length, 2);
  const pendingSub = addedBody.accounts.find((account) => !account.isMain);
  assert.equal(pendingSub.status, "pending");

  // 다른 스트리머가 이미 등록한 ID → 409 riot_id_taken (소유자 정보 비노출)
  const taken = await send("POST", "/api/account/streamer/riot-ids", { riotId: "OtherSub#JP2" }, authedHeaders(true));
  assert.equal(taken.statusCode, 409);
  assert.equal(JSON.parse(taken.body).code, "riot_id_taken");
  assert.doesNotMatch(taken.body, /other/i);

  // 승인 전 대표 지정 → 409
  const premature = await send(
    "POST",
    "/api/account/streamer/riot-ids/main",
    { accountId: pendingSub.id },
    authedHeaders(true)
  );
  assert.equal(premature.statusCode, 409);
  assert.equal(JSON.parse(premature.body).code, "not_approved_account");

  // 관리자 승인 후 대표 지정 → 대표 교체
  store.resolveStreamerRiotIdRequest({ requestId: pendingSub.id, decision: "approved", reviewer: "test" });
  const swapped = await send(
    "POST",
    "/api/account/streamer/riot-ids/main",
    { accountId: pendingSub.id },
    authedHeaders(true)
  );
  assert.equal(swapped.statusCode, 200);
  const swappedBody = JSON.parse(swapped.body);
  const newMain = swappedBody.accounts.find((account) => account.isMain);
  assert.equal(newMain.riotId, "Smurf#KR2");

  // 다른 스트리머 계정은 대표 지정·삭제 불가(404 — 존재 여부만 노출)
  const foreignMain = await send(
    "POST",
    "/api/account/streamer/riot-ids/main",
    { accountId: otherApproved.id },
    authedHeaders(true)
  );
  assert.equal(foreignMain.statusCode, 404);
  const foreignDelete = await send(
    "DELETE",
    `/api/account/streamer/riot-ids/${otherSub.request.id}`,
    undefined,
    authedHeaders(true)
  );
  assert.equal(foreignDelete.statusCode, 404);

  // 대표 계정 삭제 → 409
  const deleteMain = await send(
    "DELETE",
    `/api/account/streamer/riot-ids/${newMain.id}`,
    undefined,
    authedHeaders(true)
  );
  assert.equal(deleteMain.statusCode, 409);
  assert.equal(JSON.parse(deleteMain.body).code, "cannot_delete_main");

  // 대표에서 내려온 계정은 삭제 가능
  const demoted = swappedBody.accounts.find((account) => !account.isMain);
  const removed = await send(
    "DELETE",
    `/api/account/streamer/riot-ids/${demoted.id}`,
    undefined,
    authedHeaders(true)
  );
  assert.equal(removed.statusCode, 200);
  assert.equal(JSON.parse(removed.body).accounts.length, 1);
});

test("서브 계정은 자격 fallback·개명 선점·관리자 승인 세션 만료에 영향을 주지 않는다", async (t) => {
  const previous = {
    databaseEnabled: appConfig.database.enabled,
    token: appConfig.security.dashboardAuthToken,
    localNoAuth: appConfig.security.localNoAuth,
    corsOrigins: [...appConfig.security.corsOrigins],
    nodeEnv: appConfig.nodeEnv
  };
  appConfig.database.enabled = true;
  appConfig.security.dashboardAuthToken = "dashboard_auth_token_for_sub_account_tests_123";
  appConfig.security.localNoAuth = false;
  appConfig.security.corsOrigins = [DASHBOARD_ORIGIN];
  appConfig.nodeEnv = "development";
  t.after(() => {
    appConfig.database.enabled = previous.databaseEnabled;
    appConfig.security.dashboardAuthToken = previous.token;
    appConfig.security.localNoAuth = previous.localNoAuth;
    appConfig.security.corsOrigins = previous.corsOrigins;
    appConfig.nodeEnv = previous.nodeEnv;
  });

  const csrfToken = crypto.randomBytes(16).toString("hex");
  const store = new Store();
  const mainRequest = approveStreamer(store, "12345", "streamer", "Main", "KR1");
  const mySub = store.addStreamerSubRiotIdRequest({
    twitchUserId: "12345", twitchLogin: "streamer", twitchDisplayName: "Streamer",
    riotGameName: "MySub", riotTagLine: "KR2"
  });
  approveStreamer(store, "99999", "other", "Other", "JP1");

  const sessions = new DashboardSessionStore();
  const handler = createHttpHandler({
    store,
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    sessions,
    discordDatabaseReady: () => true,
    yoroAccounts: createYoroAccounts(csrfToken)
  });
  const yoroHeaders = (mutation = false) => ({
    cookie: "yoro_session=yoro-session",
    ...(mutation ? { origin: DASHBOARD_ORIGIN, "x-yoro-csrf": csrfToken } : {})
  });
  const send = async (method, url, body, headers) => {
    const res = createResponse();
    await handler(createRequest(method, url, body, headers), res);
    return res;
  };

  // [개명 선점 가드] 다른 스트리머의 ID → riot_id_taken, 자신의 서브 ID → riot_id_duplicated
  const renameTaken = await send("POST", "/api/account/streamer/riot-id", { riotId: "Other#JP1" }, yoroHeaders(true));
  assert.equal(renameTaken.statusCode, 409);
  assert.equal(JSON.parse(renameTaken.body).code, "riot_id_taken");
  const renameDuplicated = await send("POST", "/api/account/streamer/riot-id", { riotId: "MySub#KR2" }, yoroHeaders(true));
  assert.equal(renameDuplicated.statusCode, 409);
  assert.equal(JSON.parse(renameDuplicated.body).code, "riot_id_duplicated");

  // [관리자 서브 승인 시 세션 유지] 승인 전 스트리머 대시보드 세션을 만들고,
  // 관리자가 서브를 승인해도 그 세션이 만료되지 않아야 한다.
  const streamerSession = sessions.create({ role: "streamer", twitchUserId: "12345" });
  const adminSession = sessions.create({ role: "admin" });
  const adminHeaders = {
    origin: DASHBOARD_ORIGIN,
    cookie: `${ADMIN_DASHBOARD_SESSION_COOKIE}=${adminSession.id}`,
    "x-streamops-csrf": adminSession.csrfToken,
    "x-streamops-dashboard-surface": "admin"
  };
  const approveSub = await send(
    "POST",
    "/api/participation/streamer-riot-id-requests/resolve",
    { requestId: mySub.request.id, decision: "approved" },
    adminHeaders
  );
  assert.equal(approveSub.statusCode, 200);
  assert.notEqual(sessions.get(streamerSession.id), undefined, "서브 승인이 스트리머 세션을 만료시키면 안 됩니다.");

  // [자격 fallback 차단] 관리자가 대표를 거절하면, 승인된 서브가 남아 있어도
  // 스트리머 전용 API 자격이 유지되면 안 된다.
  store.resolveStreamerRiotIdRequest({ requestId: mainRequest.id, decision: "rejected", reviewer: "test" });
  const revoked = await send("GET", "/api/account/streamer/riot-ids", undefined, yoroHeaders());
  assert.equal(revoked.statusCode, 403);
  assert.equal(JSON.parse(revoked.body).code, "STREAMER_APPROVAL_REQUIRED");
});
