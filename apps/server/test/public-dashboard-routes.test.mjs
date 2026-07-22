import test from "node:test";
import assert from "node:assert/strict";

const { isPublicDashboardAppRoute } = await import("../dist/routing/public-dashboard-routes.js");

test("공개 페이지 URL을 Dashboard SPA 진입 경로로 허용한다", () => {
  for (const pathname of [
    "/lol",
    "/lol/summoners/jp/test-JP1",
    "/follow",
    "/participation",
    "/community/server",
    "/community/server/write",
    "/community/party",
    "/community/posts/post-1",
    "/lol/tournaments",
    "/lol/tournaments/cup/bracket",
    "/palworld",
    "/palworld/pals",
    "/palworld/breeding",
    "/palworld/items",
    "/palworld/map",
    "/palworld/search",
    "/privacy",
    "/terms",
    "/contact"
  ]) {
    assert.equal(isPublicDashboardAppRoute(pathname), true, pathname);
  }
});

test("API와 Dashboard 내부 URL은 공개 SPA 경로로 오인하지 않는다", () => {
  for (const pathname of ["/api/public/community/posts", "/palworldish", "/dashboard", "/admin", "/overlay"]) {
    assert.equal(isPublicDashboardAppRoute(pathname), false, pathname);
  }
});
