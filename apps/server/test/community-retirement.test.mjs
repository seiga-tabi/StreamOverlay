import test, { after, before } from "node:test";
import assert from "node:assert/strict";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const { requiredHttpPrincipal } = await import("../dist/security/auth.js");
const { isPublicDashboardAppRoute } = await import("../dist/routing/public-dashboard-routes.js");
const { PUBLIC_SITEMAP_STATIC_PATHS } = await import("../dist/routes/public-sitemap.js");
const { Store } = await import("../dist/services/store.js");

const previousAuthConfig = {
  localNoAuth: appConfig.security.localNoAuth,
  dashboardAuthToken: appConfig.security.dashboardAuthToken
};

before(() => {
  appConfig.security.localNoAuth = true;
  appConfig.security.dashboardAuthToken = "";
});

after(() => {
  appConfig.security.localNoAuth = previousAuthConfig.localNoAuth;
  appConfig.security.dashboardAuthToken = previousAuthConfig.dashboardAuthToken;
});

function createRequest(method, url, headers = {}) {
  return {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator]() {}
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

function handler() {
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} }
  });
}

async function request(method, url) {
  const res = createResponse();
  await handler()(createRequest(method, url), res);
  return res;
}

test("커뮤니티 URL은 404 가 아니라 패치 노트로 영구 이전된다", async () => {
  /* 색인과 북마크에 남아 있는 주소입니다. 404 로 두면 그 신호가 버려집니다. */
  for (const [from, to] of [
    ["/community", "/patch-notes"],
    ["/community/", "/patch-notes"],
    ["/community/server", "/patch-notes"],
    ["/community/party", "/patch-notes"],
    ["/community/server/write", "/patch-notes"],
    ["/community/posts/abc-123", "/patch-notes"],
    ["/ko/community/server", "/ko/patch-notes"],
    ["/ja/community/posts/abc-123", "/ja/patch-notes"]
  ]) {
    const res = await request("GET", from);
    assert.equal(res.statusCode, 308, from);
    assert.equal(res.headers.Location, to, from);
  }
});

test("이전 링크의 query 는 그대로 넘긴다", async () => {
  const res = await request("GET", "/ja/community/party?utm_source=x&q=%ED%85%8C%EC%8A%A4%ED%8A%B8");
  assert.equal(res.statusCode, 308);
  assert.equal(res.headers.Location, "/ja/patch-notes?utm_source=x&q=%ED%85%8C%EC%8A%A4%ED%8A%B8");
});

test("커뮤니티와 비슷하지만 다른 경로는 넘기지 않는다", async () => {
  const res = await request("GET", "/communitycenter");
  assert.notEqual(res.statusCode, 308);
});

test("커뮤니티 API는 더 이상 공개 endpoint 가 아니다", () => {
  for (const [method, pathname] of [
    ["GET", "/api/public/community/posts"],
    ["POST", "/api/public/community/posts"],
    ["PATCH", "/api/public/community/posts/post-1"],
    ["POST", "/api/public/community/posts/post-1/comments"],
    ["POST", "/api/public/community/posts/post-1/reports"],
    ["GET", "/api/community/moderation"]
  ]) {
    assert.notEqual(requiredHttpPrincipal(method, pathname), "PUBLIC", `${method} ${pathname}`);
  }
});

test("커뮤니티 API 호출은 404 로 끝난다", async () => {
  for (const [method, pathname] of [
    ["GET", "/api/public/community/posts"],
    ["POST", "/api/public/community/posts"],
    ["GET", "/api/community/moderation"]
  ]) {
    const res = await request(method, pathname);
    assert.equal(res.statusCode, 404, `${method} ${pathname}`);
  }
});

test("커뮤니티 경로는 SPA route 목록과 sitemap 에서 빠졌다", () => {
  for (const pathname of ["/community", "/community/server", "/community/posts/post-1", "/ko/community/party"]) {
    assert.equal(isPublicDashboardAppRoute(pathname), false, pathname);
  }
  assert.equal(isPublicDashboardAppRoute("/patch-notes"), true);
  assert.equal(PUBLIC_SITEMAP_STATIC_PATHS.includes("/patch-notes"), true);
  assert.equal(PUBLIC_SITEMAP_STATIC_PATHS.some((path) => path.startsWith("/community")), false);
});

test("Store 에는 커뮤니티 상태가 남아 있지 않다", () => {
  const store = new Store();
  for (const method of [
    "listCommunityPosts",
    "createCommunityPost",
    "updateCommunityPost",
    "addCommunityPostComment",
    "getCommunityModerationSnapshot",
    "setCommunityPostVisibility",
    "setCommunityUserSanction"
  ]) {
    assert.equal(typeof store[method], "undefined", method);
  }
  /* readiness 에서도 사라져야 운영 화면이 있지도 않은 scope 를 감시하지 않습니다. */
  assert.equal("community" in store.getReadiness().loadStates, false);
  store.close();
});
