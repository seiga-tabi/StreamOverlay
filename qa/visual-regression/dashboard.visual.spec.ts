import { expect, test, type Page, type Route } from "@playwright/test";

async function json(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body)
  });
}

async function prepareDeterministicPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.__STREAMOPS_CONFIG__ = {
      apiBase: "",
      wsBase: "",
      dashboardAuthRequired: true,
      legal: { configured: false }
    };
  });
  await page.route("**/dashboard/config.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: "window.__STREAMOPS_CONFIG__={apiBase:'',wsBase:'',dashboardAuthRequired:true,legal:{configured:false}};"
    });
  });
  await page.route("**/api/public/locale", (route) => json(route, { locale: "ko" }));
  await page.route("**/api/public/twitch/status", (route) => json(route, {
    connected: false,
    configured: true,
    requiredScopes: [],
    missingScopes: []
  }));
  await page.route("**/api/dashboard/auth/status**", (route) => json(route, {
    required: true,
    configured: true,
    authenticated: false
  }));
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
}

async function stabilize(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.documentElement.dataset.visualRegression = "true";
  });
}

test.beforeEach(async ({ page }) => {
  await prepareDeterministicPage(page);
});

test("Public Home 화면", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#public-search-main")).toBeVisible();
  await stabilize(page);
  await expect(page).toHaveScreenshot("public-home.png", { fullPage: true });
});

test("Admin 로그인 화면", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByText(/관리자 로그인|管理者ログイン/)).toBeVisible();
  await stabilize(page);
  await expect(page).toHaveScreenshot("admin-login.png", { fullPage: true });
});
