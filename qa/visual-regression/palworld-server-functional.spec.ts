import { expect, test, type Page, type Route } from "@playwright/test";

const removedPalworldServerPath = "/dashboard/test_streamer/sdk_testdashboard123/palworld/server";
const canonicalFollowersPath = "/dashboard/test_streamer/sdk_testdashboard123/followers";

const emptyFollowers = {
  summary: {
    knownFollowers: 0,
    activeFollowers: 0,
    unfollowed: 0,
    newFollowers7d: 0,
    observedGenreFollowers: 0
  },
  followers: [],
  recentFollowers: [],
  recentUnfollowers: [],
  topObservedGenres: [],
  dataNotes: [],
  oauth: {
    state: "disconnected",
    missingScopes: []
  }
};

async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body)
  });
}

async function preparePage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("loltrace.locale", "ko");
  });

  await page.route("**/dashboard/config.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: `window.__STREAMOPS_CONFIG__ = {
        apiBase: "http://localhost:3000",
        wsBase: "ws://localhost:3000",
        dashboardAuthRequired: true
      };`
    });
  });

  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/dashboard/auth/status") {
      await fulfillJson(route, {
        required: true,
        configured: true,
        authenticated: true,
        role: "streamer",
        csrfToken: "dashboard-qa-csrf",
        streamer: {
          twitchUserId: "qa-test-streamer",
          twitchLogin: "test_streamer",
          twitchDisplayName: "Test Streamer",
          riotGameName: "YORO QA",
          riotTagLine: "JP1",
          dashboardEnabled: true,
          dashboardSlug: "test_streamer",
          dashboardKey: "sdk_testdashboard123",
          dashboardPath: "/dashboard/test_streamer/sdk_testdashboard123"
        }
      });
      return;
    }
    if (url.pathname === "/api/followers") {
      await fulfillJson(route, emptyFollowers);
      return;
    }
    if (url.pathname === "/api/public/locale") {
      await fulfillJson(route, { locale: "ko" });
      return;
    }
    await fulfillJson(route, {});
  });
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "중복 실행을 피하고 viewport를 spec 내부에서 검증합니다.");
});

test("삭제된 Palworld 서버 상태 경로는 tenant를 유지한 팔로워 관리로 대체 이동한다", async ({ page }) => {
  await preparePage(page);
  await page.goto(`${removedPalworldServerPath}?dashboardKey=복제금지#legacy`);

  await expect(page).toHaveURL(new RegExp(`${canonicalFollowersPath.replaceAll("/", "\\/")}$`));
  await expect(page.getByRole("heading", { name: "팔로워 관리", exact: true })).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "대시보드 메뉴" });
  await expect(navigation.locator("button.nav-item")).toHaveCount(2);
  await expect(navigation.getByRole("button", { name: "팔로워 관리" })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByRole("button", { name: "내 Riot ID" })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "서버 상태" })).toHaveCount(0);
  await expect(page.getByText("Palworld 서버 상태")).toHaveCount(0);
});

test("간소화된 방송인 메뉴와 팔로워 화면은 요구 viewport에서 가로 overflow가 없다", async ({ page }) => {
  await preparePage(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1_024 },
    { width: 1_024, height: 768 },
    { width: 1_440, height: 1_000 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(removedPalworldServerPath);
    await expect(page).toHaveURL(new RegExp(`${canonicalFollowersPath.replaceAll("/", "\\/")}$`));
    await expect(page.getByRole("heading", { name: "팔로워 관리", exact: true })).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }
});
