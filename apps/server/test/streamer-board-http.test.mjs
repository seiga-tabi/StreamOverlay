import test, { after, before } from "node:test";
import assert from "node:assert/strict";

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
};

function createRequest(method, url, body, headers = {}) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  return {
    method,
    url,
    headers: { origin: TRUSTED_ORIGIN, "content-type": "application/json", ...headers },
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
  assert.equal(requiredHttpPrincipal("POST", "/api/public/streamers/bamtol/vote"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("POST", "/api/public/streamers/bamtol/comments/c1/report"), "PUBLIC");
  /* 경로 모양이 다르면 공개 대상이 아닙니다. */
  assert.notEqual(requiredHttpPrincipal("GET", "/api/public/streamers/BAMTOL!/secret"), "PUBLIC");
});

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
