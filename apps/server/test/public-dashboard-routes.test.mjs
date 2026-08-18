import test from "node:test";
import assert from "node:assert/strict";

const {
  isPublicDashboardAppRoute,
  publicUrlLocaleFromPathname,
  stripPublicUrlLocalePrefix
} = await import("../dist/routing/public-dashboard-routes.js");

test("공개 페이지 URL을 Dashboard SPA 진입 경로로 허용한다", () => {
  for (const pathname of [
    "/lol",
    "/bot",
    "/bot/",
    "/bot/getting-started",
    "/bot/getting-started/",
    "/bot/commands",
    "/bot/commands/",
    "/bot/game-files",
    "/bot/game-files/",
    "/bot/features",
    "/bot/features/",
    "/bot/connect",
    "/bot/connect/",
    "/bot/dedicated-server",
    "/bot/dedicated-server/",
    "/login",
    "/login/",
    "/account",
    "/account/connections/",
    "/lol/summoners/jp/test-JP1",
    "/follow",
    "/participation",
    "/patch-notes",
    "/lol/aram",
    "/palworld",
    "/palworld/pals",
    "/palworld/breeding",
    "/palworld/items",
    "/palworld/technology",
    "/palworld/skills",
    "/palworld/map",
    "/palworld/search",
    "/valorant",
    "/valorant/agents",
    "/valorant/weapons",
    "/valorant/maps",
    "/valorant/ranked",
    "/minecraft",
    "/minecraft/recipes",
    "/minecraft/items",
    "/minecraft/enchants",
    "/minecraft/library",
    "/minecraft/patch-notes",
    /* 미니게임 — /games/ranking 누락으로 새로고침 404 실사례(2026-08-17).
       프런트 라우트가 늘면 이 목록과 exact/prefix 원본을 함께 갱신할 것. */
    "/games",
    "/games/",
    "/games/reaction",
    "/games/reaction/",
    "/games/ranking",
    "/games/ranking/",
    "/games/reaction/r/a8x2k1",
    "/privacy",
    "/terms",
    "/contact"
  ]) {
    assert.equal(isPublicDashboardAppRoute(pathname), true, pathname);
  }
});

test("한국어·일본어·영어 공개 URL만 언어 prefix 아래에서 SPA 경로로 허용한다", () => {
  for (const pathname of [
    "/ko",
    "/ko/",
    "/ja/",
    /* en(2026-08-18 · 팰월드 우선) — 팰월드 경로는 영어 메타를, 그 외는 ko 메타를 냅니다. */
    "/en/",
    "/en/palworld",
    "/en/palworld/pals",
    "/en/palworld/breeding",
    "/en/palworld/pals/lamball",
    "/ko/lol/summoners/jp/test-JP1",
    "/ja/bot/commands",
    "/ko/games/ranking",
    "/ja/games/ranking",
    "/ja/games/reaction/r/a8x2k1",
    "/ko/palworld/items",
    "/ja/valorant/agents",
    "/ko/minecraft/recipes",
    "/ja/minecraft/enchants",
    "/ja/privacy"
  ]) {
    assert.equal(isPublicDashboardAppRoute(pathname), true, pathname);
  }
  for (const pathname of ["/fr/", "/en/dashboard", "/ko/dashboard", "/ja/login", "/ko/account", "/ko/api/palworld/meta"]) {
    assert.equal(isPublicDashboardAppRoute(pathname), false, pathname);
  }
  assert.equal(publicUrlLocaleFromPathname("/ja/palworld"), "ja");
  assert.equal(publicUrlLocaleFromPathname("/japanese"), undefined);
  assert.equal(stripPublicUrlLocalePrefix("/ko/palworld"), "/palworld");
  assert.equal(stripPublicUrlLocalePrefix("/ja"), "/");
  assert.equal(stripPublicUrlLocalePrefix("/en/palworld"), "/palworld");
  /* en 은 서빙되는 로케일입니다. 영어 본문이 없는 섹션을 ko 로 접는 판단은
     public-seo 의 servedSeoLocale 이 맡고, 여기서는 prefix 그대로 돌려줍니다. */
  assert.equal(publicUrlLocaleFromPathname("/en/palworld"), "en");
  assert.equal(publicUrlLocaleFromPathname("/en/lol"), "en");
});

test("API와 Dashboard 내부 URL 및 존재하지 않는 게임 URL은 공개 SPA 경로로 오인하지 않는다", () => {
  for (const pathname of ["/api/public/patch-notes", "/palworldish", "/palworld/streamers", "/palworld/not-a-real-page", "/valorant/not-a-real-page", "/minecraft/not-a-real-page", "/dashboard", "/setup/discord", "/bot/manage", "/admin", "/overlay"]) {
    assert.equal(isPublicDashboardAppRoute(pathname), false, pathname);
  }
});
