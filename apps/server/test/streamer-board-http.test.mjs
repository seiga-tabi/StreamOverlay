import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/* 스트리머 추천 게시판 API 계약 — 계약 원본 packages/shared/src/streamer-board.ts.
 *
 * 여기서 지키는 것은 세 가지입니다.
 * 1. 목록과 글은 비로그인도 본다. 로그인 뒤로 가는 것은 채널 주소 하나다.
 * 2. 쓰기는 두 로그인 상태 모두 인정한다(YORO 계정 세션 · 공개 Twitch 뷰어 세션).
 *    한쪽만 인정하면 화면에는 글쓰기가 열려 있는데 저장만 401 로 실패합니다.
 * 3. 한 채널은 글 하나. 판정은 저장소가 하고 라우트는 409 로 옮긴다.
 */

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const { requiredHttpPrincipal } = await import("../dist/security/auth.js");
const { StreamerChannelTakenError } = await import("../dist/database/repositories/streamer-board-repository.js");
const { SafeDatabaseError } = await import("../dist/database/errors.js");
const { DashboardSessionStore } = await import("../dist/security/auth.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");
const { Store } = await import("../dist/services/store.js");
const { PUBLIC_TWITCH_VIEWER_SESSION_COOKIE } = await import("../dist/services/public-twitch-auth.js");

const previousAuthConfig = {
  localNoAuth: appConfig.security.localNoAuth,
  dashboardAuthToken: appConfig.security.dashboardAuthToken,
};

before(() => {
  appConfig.security.localNoAuth = true;
  appConfig.security.dashboardAuthToken = "";
});

after(() => {
  appConfig.security.localNoAuth = previousAuthConfig.localNoAuth;
  appConfig.security.dashboardAuthToken = previousAuthConfig.dashboardAuthToken;
});

/* 쓰기는 신뢰 Origin 을 요구합니다(CSRF). 설정에 있는 값을 그대로 씁니다. */
const TRUSTED_ORIGIN = appConfig.security.corsOrigins[0];

const POST = {
  id: "bamtol",
  channelKey: "twitch:bamtol",
  streamerName: "밤톨",
  platform: "twitch",
  channelUrl: "https://www.twitch.tv/bamtol",
  games: ["lol"],
  tags: ["칼바람 나락"],
  votes: 142,
  voted: false,
  commentCount: 1,
  authorName: "쿠키맛젤리",
  createdAt: "2026-08-19T00:00:00.000Z",
  registeredByAdmin: false,
  active: true,
};

const OFFICIAL_POST = {
  ...POST,
  id: "official-bamtol",
  registeredByAdmin: true,
  officialProfile: { handle: "bamtol", seoSlug: "bamtol", liveStatusSupported: true },
};

function createRequest(method, url, body, headers = {}) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  return {
    method,
    url,
    headers: { origin: TRUSTED_ORIGIN, "content-type": "application/json", ...headers },
    socket: { remoteAddress: "127.0.0.1" },
    async *[Symbol.asyncIterator]() {
      if (payload) yield Buffer.from(payload);
    },
  };
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers ?? {};
    },
    end(chunk = "") {
      this.body = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("binary");
    },
  };
}

async function call(handler, method, url, body, headers) {
  const res = createResponse();
  await handler(createRequest(method, url, body, headers), res);
  let json;
  try {
    json = res.body ? JSON.parse(res.body) : undefined;
  } catch {
    json = undefined;
  }
  return { status: res.statusCode, headers: res.headers, json, raw: res.body };
}

/** 저장소 대역. 실제 SQL 은 별도 테스트가 보고, 여기서는 라우트 계약만 봅니다. */
function fakeBoard(overrides = {}) {
  return {
    calls: [],
    async list(query, viewer) {
      this.calls.push(["list", query, viewer]);
      return { posts: [POST], total: 1, liveCount: 0 };
    },
    async findPost(postId, viewer) {
      this.calls.push(["findPost", postId, viewer]);
      return postId === POST.id ? POST : undefined;
    },
    async findOfficialProfile(platform, seoSlug, viewer) {
      this.calls.push(["findOfficialProfile", platform, seoSlug, viewer]);
      return platform === "twitch" && seoSlug === "bamtol" ? OFFICIAL_POST : undefined;
    },
    async listOfficialProfiles() {
      this.calls.push(["listOfficialProfiles"]);
      return [OFFICIAL_POST];
    },
    async createOfficialProfile(draft) {
      this.calls.push(["createOfficialProfile", draft]);
      return { ...OFFICIAL_POST, ...draft, officialProfile: draft.officialProfile };
    },
    async updateOfficialProfile(postId, draft) {
      this.calls.push(["updateOfficialProfile", postId, draft]);
      return postId === OFFICIAL_POST.id ? { ...OFFICIAL_POST, ...draft } : undefined;
    },
    async deactivateOfficialProfile(postId) {
      this.calls.push(["deactivateOfficialProfile", postId]);
      return postId === OFFICIAL_POST.id ? { ...OFFICIAL_POST, active: false } : undefined;
    },
    async reactivateOfficialProfile(postId) {
      this.calls.push(["reactivateOfficialProfile", postId]);
      return postId === OFFICIAL_POST.id ? { ...OFFICIAL_POST, active: true } : undefined;
    },
    async comments() {
      return [
        { id: "c1", authorName: "사분면", anonymous: false, body: "좋았습니다.", createdAt: "2026-08-19T01:00:00.000Z" },
        { id: "c2", anonymous: true, body: "익명입니다.", createdAt: "2026-08-19T02:00:00.000Z" },
      ];
    },
    async twitchChannelKeys() {
      return [POST.channelKey];
    },
    async createPost(draft, author) {
      this.calls.push(["createPost", draft, author]);
      return { ...POST, ...draft, id: "newpost" };
    },
    async vote(postId) {
      this.calls.push(["vote", postId]);
      return { votes: 143 };
    },
    async createComment(postId, draft, author) {
      this.calls.push(["createComment", postId, draft, author]);
      return { id: "c3", anonymous: draft.anonymous, ...(draft.anonymous ? {} : { authorName: author.displayName }), body: draft.body, createdAt: "2026-08-19T03:00:00.000Z" };
    },
    async reportComment(postId, commentId, reason) {
      this.calls.push(["reportComment", postId, commentId, reason]);
      return true;
    },
    ...overrides,
  };
}

/** 로그인 상태 두 가지를 각각 흉내 냅니다. */
function handlerWith({ board = fakeBoard(), session } = {}) {
  const user = { id: "4211", login: "cookie", displayName: "쿠키맛젤리" };
  const yoroAccounts = session === "yoro"
    ? { async getTwitchAccessContext() { return { user, tokenExpiresAt: Date.now() + 60_000 }; } }
    : { async getTwitchAccessContext() { return undefined; } };
  const publicTwitchAuth = {
    async getStatus() {
      return session === "viewer"
        ? { connected: true, configured: true, requiredScopes: [], missingScopes: [], user }
        : { connected: false, configured: true, requiredScopes: [], missingScopes: [] };
    },
  };
  return {
    board,
    handler: createHttpHandler({
      store: {},
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      yoroAccounts,
      publicTwitchAuth,
      streamerBoard: board,
    }),
  };
}

test("게시판 경로는 공개로 통과시키고 세션 검사는 라우트가 한다", () => {
  /* PUBLIC 이 아니면 dashboard 토큰 없이는 목록조차 못 봅니다. */
  assert.equal(requiredHttpPrincipal("GET", "/api/public/streamers"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("POST", "/api/public/streamers"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("GET", "/api/public/streamers/bamtol"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("GET", "/api/public/streamers/profile/twitch/bamtol"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("POST", "/api/public/streamers/bamtol/vote"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("POST", "/api/public/streamers/bamtol/comments/c1/report"), "PUBLIC");
  /* 경로 모양이 다르면 공개 대상이 아닙니다. */
  assert.notEqual(requiredHttpPrincipal("GET", "/api/public/streamers/BAMTOL!/secret"), "PUBLIC");
});

test("공식 프로필 고정 URL API는 관리자 등록 메타데이터와 기존 댓글을 함께 돌려준다", async () => {
  const { handler, board } = handlerWith();
  const result = await call(handler, "GET", "/api/public/streamers/profile/twitch/bamtol");
  assert.equal(result.status, 200);
  assert.equal(result.json.post.registeredByAdmin, true);
  assert.deepEqual(result.json.post.officialProfile, OFFICIAL_POST.officialProfile);
  assert.equal(result.json.post.channelUrl, POST.channelUrl, "공식 프로필 채널은 비로그인에도 공개됩니다");
  assert.equal(result.json.comments.length, 2);
  assert.ok(board.calls.some(([name]) => name === "findOfficialProfile"));
});

test("관리자 공식 프로필 API는 생성·수정·비활성화를 지원하고 플랫폼별 라이브 정책을 강제한다", async () => {
  const { handler, board } = handlerWith();
  const listed = await call(handler, "GET", "/api/dashboard/streamer-profiles");
  assert.equal(listed.status, 200);
  assert.equal(listed.json.profiles.length, 1);

  const created = await call(handler, "POST", "/api/dashboard/streamer-profiles", {
    streamerName: "한겨울",
    platform: "chzzk",
    handle: "Hangyeoul",
    games: ["palworld"],
    liveStatusSupported: true,
  });
  assert.equal(created.status, 201);
  const createCall = board.calls.find(([name]) => name === "createOfficialProfile");
  assert.equal(createCall[1].channelKey, "chzzk:hangyeoul");
  assert.equal(createCall[1].officialProfile.seoSlug, "hangyeoul");
  assert.equal(createCall[1].officialProfile.liveStatusSupported, false, "치지직은 요청값과 무관하게 false입니다");

  const updated = await call(handler, "PUT", `/api/dashboard/streamer-profiles/${OFFICIAL_POST.id}`, {
    streamerName: "밤톨 새 이름",
    platform: "twitch",
    handle: "BamTol",
    games: ["lol"],
  });
  assert.equal(updated.status, 200);
  assert.equal(board.calls.find(([name]) => name === "updateOfficialProfile")[2].officialProfile.liveStatusSupported, true);

  const deactivated = await call(handler, "DELETE", `/api/dashboard/streamer-profiles/${OFFICIAL_POST.id}`);
  assert.equal(deactivated.status, 200);
  assert.equal(deactivated.json.profile.active, false);

  const reactivated = await call(handler, "PUT", `/api/dashboard/streamer-profiles/${OFFICIAL_POST.id}/reactivate`);
  assert.equal(reactivated.status, 200);
  assert.equal(reactivated.json.profile.active, true);
  assert.deepEqual(board.calls.at(-1), ["reactivateOfficialProfile", OFFICIAL_POST.id]);

  /* 재활성화는 비활성 공식 프로필에만 — 없는 글은 404 입니다. */
  assert.equal((await call(handler, "PUT", "/api/dashboard/streamer-profiles/nosuchpost/reactivate")).status, 404);
  /* 모르는 하위 경로와 잘못된 메서드는 저장소에 닿지 않습니다. */
  const before = board.calls.length;
  assert.equal((await call(handler, "PUT", `/api/dashboard/streamer-profiles/${OFFICIAL_POST.id}/unknown`)).status, 404);
  assert.equal((await call(handler, "PUT", `/api/dashboard/streamer-profiles/${OFFICIAL_POST.id}/reactivate/extra`)).status, 404);
  assert.equal((await call(handler, "GET", `/api/dashboard/streamer-profiles/${OFFICIAL_POST.id}/reactivate`)).status, 405);
  assert.equal(board.calls.length, before);
});

test("공식 프로필 페이지는 조회 실패와 없음을 구분한다 — DB 장애는 503, 없음은 404, 성공은 한 번만 조회", async () => {
  const failing = fakeBoard({
    async findOfficialProfile() {
      throw new SafeDatabaseError("DATABASE_UNAVAILABLE", true);
    },
  });
  const unavailable = await call(handlerWith({ board: failing }).handler, "GET", "/streamers/twitch/bamtol");
  assert.equal(unavailable.status, 503, "장애를 404 로 내면 검색엔진이 URL 을 지웁니다");
  assert.equal(unavailable.headers["Retry-After"], "600");
  assert.equal(unavailable.headers["Cache-Control"], "no-store");
  assert.match(unavailable.headers["X-Robots-Tag"], /noindex/u);

  const { handler, board } = handlerWith();
  const missing = await call(handler, "GET", "/streamers/twitch/nobody");
  assert.equal(missing.status, 404);
  assert.equal(missing.json.code, "NOT_FOUND");

  const found = await call(handler, "GET", "/streamers/twitch/bamtol");
  assert.equal(found.status, 200);
  assert.equal(
    board.calls.filter(([name, , seoSlug]) => name === "findOfficialProfile" && seoSlug === "bamtol").length,
    1,
    "SEO 메타데이터가 같은 프로필을 다시 조회하면 안 됩니다"
  );
});

/* ── 권한 경계 — localNoAuth 가 아닌 실제 세션으로 봅니다 ───────────────────── */

const DASHBOARD_TOKEN = "full_admin_token_for_streamer_profile_tests_1234567890";
const STREAMER_TWITCH_USER_ID = "777000777";
const VIEWER_SESSION_ID = "viewer-session-777";
const PROFILES_PATH = "/api/dashboard/streamer-profiles";

async function withSessionAuth(run) {
  const previous = {
    token: appConfig.security.dashboardAuthToken,
    localNoAuth: appConfig.security.localNoAuth,
    nodeEnv: appConfig.nodeEnv,
    sessionTtl: appConfig.security.dashboardSessionTtlMs,
    databaseEnabled: appConfig.database.enabled,
  };
  const dir = mkdtempSync(path.join(tmpdir(), "streamer-profiles-auth-test-"));
  resetSecurityRateLimiters();
  appConfig.security.dashboardAuthToken = DASHBOARD_TOKEN;
  appConfig.security.localNoAuth = false;
  appConfig.nodeEnv = "development";
  appConfig.security.dashboardSessionTtlMs = 60_000;
  appConfig.database.enabled = false;
  try {
    const store = new Store({
      adminAccountStatePath: path.join(dir, "admin-accounts.json"),
      streamerRiotIdStatePath: path.join(dir, "streamer-riot-ids.json"),
    });
    const board = fakeBoard();
    const handler = createHttpHandler({
      store,
      twitchAuth: {},
      actions: { async dispatchOne() {} },
      sessions: new DashboardSessionStore(),
      riot: {
        isConfigured() { return false; },
        routingStatus() {
          return { configured: false, source: "default", accountRegion: "asia", lolPlatform: "kr" };
        },
      },
      publicTwitchAuth: {
        async getStatus(sessionId) {
          if (sessionId !== VIEWER_SESSION_ID) return { connected: false, configured: true, requiredScopes: [], missingScopes: [] };
          return {
            connected: true,
            configured: true,
            requiredScopes: [],
            missingScopes: [],
            user: { id: STREAMER_TWITCH_USER_ID, login: "granted_streamer", displayName: "Granted Streamer" },
          };
        },
      },
      streamerBoard: board,
    });
    await run({ store, board, handler });
  } finally {
    appConfig.security.dashboardAuthToken = previous.token;
    appConfig.security.localNoAuth = previous.localNoAuth;
    appConfig.nodeEnv = previous.nodeEnv;
    appConfig.security.dashboardSessionTtlMs = previous.sessionTtl;
    appConfig.database.enabled = previous.databaseEnabled;
    resetSecurityRateLimiters();
    rmSync(dir, { recursive: true, force: true });
  }
}

function cookieHeader(setCookie) {
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  assert.equal(typeof value, "string");
  return value.split(";")[0];
}

/* 부분 권한 관리자 계정을 만들고 로그인한 세션(cookie·csrf)을 돌려줍니다. */
async function loginSubAdmin(store, handler, permissions) {
  const token = `sub-admin-${permissions.join("-").replaceAll(":", "_")}-token-1234567890`;
  store.createAdminAccount({ label: "서브 운영자", tokenHash: store.hashAdminToken(token), permissions });
  const login = await call(handler, "POST", "/api/dashboard/auth/check", { token });
  assert.equal(login.status, 200, login.raw);
  assert.deepEqual(login.json.permissions, permissions);
  return { cookie: cookieHeader(login.headers["Set-Cookie"]), csrf: login.json.csrfToken, surface: "admin" };
}

/* 승인·대시보드 허용된 스트리머의 Twitch 로그인으로 streamer role 세션을 얻습니다. */
async function loginStreamer(store, handler) {
  const created = store.upsertStreamerRiotIdRequest({
    twitchUserId: STREAMER_TWITCH_USER_ID,
    twitchLogin: "granted_streamer",
    twitchDisplayName: "Granted Streamer",
    riotGameName: "Granted Streamer",
    riotTagLine: "KR1",
  });
  assert.ok(store.resolveStreamerRiotIdRequest({ requestId: created.id, decision: "approved", reviewer: "test" }));
  assert.ok(store.setStreamerRiotIdDashboardEnabled({ requestId: created.id, dashboardEnabled: true, reviewer: "test" }));
  const status = await call(handler, "GET", "/api/dashboard/auth/status?surface=streamer", undefined, {
    cookie: `${PUBLIC_TWITCH_VIEWER_SESSION_COOKIE}=${VIEWER_SESSION_ID}`,
    "x-streamops-dashboard-surface": "streamer",
  });
  assert.equal(status.status, 200, status.raw);
  assert.equal(status.json.role, "streamer");
  return { cookie: cookieHeader(status.headers["Set-Cookie"]), csrf: status.json.csrfToken, surface: "streamer" };
}

function callAs(handler, session, method, url, body) {
  return call(handler, method, url, body, {
    cookie: session.cookie,
    "x-streamops-csrf": session.csrf,
    "x-streamops-dashboard-surface": session.surface,
  });
}

test("streamer_profiles:write 가 없는 관리자는 공식 프로필 API 전부에서 403 이고 저장소에 닿지 않는다", () => withSessionAuth(async ({ store, board, handler }) => {
  const approvalOnly = await loginSubAdmin(store, handler, ["streamer_approval"]);
  const draft = { streamerName: "한겨울", platform: "chzzk", handle: "Hangyeoul", games: ["palworld"] };
  const attempts = [
    ["GET", PROFILES_PATH],
    ["POST", PROFILES_PATH, draft],
    ["PUT", `${PROFILES_PATH}/${OFFICIAL_POST.id}`, draft],
    ["PUT", `${PROFILES_PATH}/${OFFICIAL_POST.id}/reactivate`],
    ["DELETE", `${PROFILES_PATH}/${OFFICIAL_POST.id}`],
  ];
  for (const [method, url, body] of attempts) {
    const result = await callAs(handler, approvalOnly, method, url, body);
    assert.equal(result.status, 403, `${method} ${url}: ${result.raw}`);
    assert.equal(result.json.code, "FORBIDDEN");
  }
  assert.equal(board.calls.length, 0, "권한 검사가 저장소 호출보다 먼저여야 합니다");

  /* 같은 구조에서 권한이 있는 관리자는 통과한다 — 위 403 이 설정 오류가 아니라는 대조군입니다. */
  const writer = await loginSubAdmin(store, handler, ["streamer_profiles:write"]);
  const listed = await callAs(handler, writer, "GET", PROFILES_PATH);
  assert.equal(listed.status, 200, listed.raw);
  assert.equal(listed.json.profiles.length, 1);
  const reactivated = await callAs(handler, writer, "PUT", `${PROFILES_PATH}/${OFFICIAL_POST.id}/reactivate`);
  assert.equal(reactivated.status, 200, reactivated.raw);
}));

test("스트리머 role 세션은 공식 프로필 API 를 호출할 수 없다(403)", () => withSessionAuth(async ({ store, board, handler }) => {
  const streamer = await loginStreamer(store, handler);
  const draft = { streamerName: "한겨울", platform: "chzzk", handle: "Hangyeoul", games: ["palworld"] };
  for (const [method, url, body] of [
    ["GET", PROFILES_PATH],
    ["POST", PROFILES_PATH, draft],
    ["PUT", `${PROFILES_PATH}/${OFFICIAL_POST.id}`, draft],
    ["PUT", `${PROFILES_PATH}/${OFFICIAL_POST.id}/reactivate`],
    ["DELETE", `${PROFILES_PATH}/${OFFICIAL_POST.id}`],
  ]) {
    const result = await callAs(handler, streamer, method, url, body);
    assert.equal(result.status, 403, `${method} ${url}: ${result.raw}`);
  }
  assert.equal(board.calls.length, 0);
}));

test("비로그인 목록은 게임 표기를 주고 채널 주소만 가린다", async () => {
  const { handler } = handlerWith();
  const result = await call(handler, "GET", "/api/public/streamers");
  assert.equal(result.status, 200);
  const post = result.json.posts[0];
  assert.equal(post.streamerName, "밤톨");
  assert.deepEqual(post.games, ["lol"]);
  assert.equal(post.channelUrl, undefined, "채널 주소는 로그인 뒤로 갑니다");
  /* 내부 값은 내보내지 않습니다. */
  assert.equal(post.channelKey, undefined);
  /* 사람마다 다른 응답이라 공용 캐시에 남기면 안 됩니다. */
  assert.match(String(result.headers["Cache-Control"] ?? ""), /no-store/u);
});

for (const session of ["yoro", "viewer"]) {
  test(`${session} 세션이면 채널 주소가 열리고 글을 쓸 수 있다`, async () => {
    /* 공개 화면의 로그인 상태는 두 가지입니다. 한쪽만 인정하면 LoL 화면에서 Twitch 로
       로그인한 사람이 여기서만 비로그인 취급을 받습니다(실사례). */
    const { handler, board } = handlerWith({ session });

    const list = await call(handler, "GET", "/api/public/streamers");
    assert.equal(list.json.posts[0].channelUrl, "https://www.twitch.tv/bamtol");

    const created = await call(handler, "POST", "/api/public/streamers", {
      streamerName: "새벽",
      platform: "twitch",
      channelUrl: "https://www.twitch.tv/Saebyeok/",
      games: ["lol"],
    });
    assert.equal(created.status, 201);
    const [, draft, author] = board.calls.find(([name]) => name === "createPost");
    /* 주소가 사실입니다 — 표기가 달라도 같은 채널 키로 저장합니다. */
    assert.equal(draft.channelKey, "twitch:saebyeok");
    assert.equal(draft.channelUrl, "https://www.twitch.tv/saebyeok");
    assert.equal(author.twitchUserId, "4211");
  });
}

test("비로그인 쓰기는 401 이고 저장소에 닿지 않는다", async () => {
  const { handler, board } = handlerWith();
  for (const [method, path, body] of [
    ["POST", "/api/public/streamers", { streamerName: "밤톨", platform: "twitch", channelUrl: "https://twitch.tv/bamtol", games: ["lol"] }],
    ["POST", "/api/public/streamers/bamtol/vote", {}],
    ["POST", "/api/public/streamers/bamtol/comments", { body: "좋아요", anonymous: false }],
    ["POST", "/api/public/streamers/bamtol/comments/c1/report", { reason: "spam" }],
  ]) {
    const result = await call(handler, method, path, body);
    assert.equal(result.status, 401, path);
  }
  assert.deepEqual(board.calls.filter(([name]) => name !== "list" && name !== "findPost"), []);
});

test("신뢰할 수 없는 Origin 의 쓰기는 403 이다", async () => {
  const { handler } = handlerWith({ session: "yoro" });
  const result = await call(
    handler,
    "POST",
    "/api/public/streamers/bamtol/vote",
    {},
    { origin: "https://evil.test" },
  );
  assert.equal(result.status, 403);
});

test("이미 등록된 채널은 409 로 막고 그 글을 알려 준다", async () => {
  const board = fakeBoard({
    async createPost() {
      throw new StreamerChannelTakenError({ postId: "bamtol", streamerName: "밤톨" });
    },
  });
  const { handler } = handlerWith({ board, session: "yoro" });
  const result = await call(handler, "POST", "/api/public/streamers", {
    streamerName: "밤톨",
    platform: "twitch",
    channelUrl: "https://www.twitch.tv/BamTol/",
    games: ["lol"],
  });
  assert.equal(result.status, 409);
  assert.equal(result.json.code, "duplicate_channel");
  /* 화면이 "등록된 글 보기" 로 연결할 수 있어야 합니다. */
  assert.deepEqual(result.json.existing, { postId: "bamtol", streamerName: "밤톨" });
});

test("채널이 아닌 주소와 빈 게임 목록은 400 이다", async () => {
  const { handler, board } = handlerWith({ session: "yoro" });
  for (const body of [
    { streamerName: "밤톨", channelUrl: "https://youtu.be/abc123", games: ["lol"] },
    { streamerName: "밤톨", channelUrl: "https://example.test/bamtol", games: ["lol"] },
    { streamerName: "밤톨", channelUrl: "https://twitch.tv/bamtol", games: [] },
    { streamerName: "", channelUrl: "https://twitch.tv/bamtol", games: ["lol"] },
  ]) {
    const result = await call(handler, "POST", "/api/public/streamers", body);
    assert.equal(result.status, 400, JSON.stringify(body));
  }
  assert.equal(board.calls.some(([name]) => name === "createPost"), false);
});

test("익명 댓글 응답에는 이름도 계정 식별자도 실리지 않는다", async () => {
  const { handler } = handlerWith({ session: "viewer" });
  const detail = await call(handler, "GET", "/api/public/streamers/bamtol");
  assert.equal(detail.status, 200);
  const [named, anonymous] = detail.json.comments;
  assert.equal(named.authorName, "사분면");
  assert.equal(anonymous.authorName, undefined);
  assert.equal(anonymous.anonymous, true);
  assert.equal(JSON.stringify(detail.json).includes("4211"), false, "Twitch 사용자 id 가 응답에 새면 안 됩니다");

  const created = await call(handler, "POST", "/api/public/streamers/bamtol/comments", {
    body: "익명으로 남깁니다.",
    anonymous: true,
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.comment.authorName, undefined);
});

test("없는 글은 404 이고 모르는 하위 경로도 404 다", async () => {
  const { handler } = handlerWith({ session: "yoro" });
  assert.equal((await call(handler, "GET", "/api/public/streamers/missing")).status, 404);
  assert.equal((await call(handler, "POST", "/api/public/streamers/bamtol/unknown", {})).status, 404);
  assert.equal((await call(handler, "DELETE", "/api/public/streamers/bamtol")).status, 404);
});

test("DB 가 없으면 503 이고 화면은 준비 중으로 닫는다", async () => {
  const handler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
  });
  const result = await call(handler, "GET", "/api/public/streamers");
  assert.equal(result.status, 503);
  assert.equal(result.json.code, "feature_unavailable");
});
