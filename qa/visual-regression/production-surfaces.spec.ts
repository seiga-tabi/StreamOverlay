import { expect, test, type Page, type Route } from "@playwright/test";

const overlayBaseUrl = "http://127.0.0.1:4174";
const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

const profileFixture = {
  status: "ready",
  riotId: "YORO QA#JP1",
  gameName: "YORO QA",
  tagLine: "JP1",
  accountRegion: "asia",
  lolPlatform: "jp1",
  summonerLevel: 180,
  topChampions: [],
  recentMatches: [],
  liveGame: {
    isLive: false,
    status: "not_found",
    participants: [],
    fetchedAt: "2026-07-15T00:00:00.000Z"
  },
  recentMatchStart: 0,
  hasMoreRecentMatches: false,
  summary: {
    recentGames: 0,
    recentWins: 0,
    recentWinRate: 0,
    totalKills: 0,
    totalDeaths: 0,
    totalAssists: 0
  },
  championPerformance: [],
  rolePerformance: [],
  fetchedAt: "2026-07-15T00:00:00.000Z"
};

const dashboardSnapshot = {
  type: "dashboard.snapshot",
  status: {
    server: "online",
    twitch: "connected",
    stream: "offline",
    bridge: "disconnected",
    obs: "unknown",
    participation: "closed"
  },
  events: [],
  actions: [],
  participationQueue: [],
  participationState: {
    isOpen: false,
    queue: [],
    activeQueue: [],
    summary: { total: 0, active: 0, waiting: 0, selected: 0, checkedIn: 0, noShow: 0, played: 0 }
  }
};

function json(route: Route, body: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body)
  });
}

async function installStableBrowserEnvironment(page: Page): Promise<void> {
  await page.addInitScript((snapshot) => {
    const fixedNow = new Date("2026-07-15T00:00:00.000Z").valueOf();
    Date.now = () => fixedNow;

    class StableWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readonly CONNECTING = 0;
      readonly OPEN = 1;
      readonly CLOSING = 2;
      readonly CLOSED = 3;
      readyState = StableWebSocket.CONNECTING;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor() {
        window.setTimeout(() => {
          this.readyState = StableWebSocket.OPEN;
          this.onopen?.(new Event("open"));
          this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(snapshot) }));
        }, 0);
      }

      send(): void {}

      close(): void {
        this.readyState = StableWebSocket.CLOSED;
        this.onclose?.(new CloseEvent("close"));
      }

      addEventListener(): void {}
      removeEventListener(): void {}
      dispatchEvent(): boolean { return true; }
    }

    Object.defineProperty(window, "WebSocket", { configurable: true, value: StableWebSocket });
  }, dashboardSnapshot);
}

async function installDashboardApiFixtures(page: Page): Promise<void> {
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/public/locale") {
      await json(route, { locale: "ko" });
      return;
    }
    if (url.pathname === "/api/public/twitch/status") {
      await json(route, {
        connected: false,
        configured: true,
        requiredScopes: [],
        streamers: [],
        queue: [],
        maxQueueSize: 100,
        updatedAt: "2026-07-15T00:00:00.000Z"
      });
      return;
    }
    if (url.pathname === "/api/lol/profile") {
      await json(route, profileFixture);
      return;
    }
    if (url.pathname === "/api/dashboard/auth/status") {
      await json(route, {
        required: true,
        configured: true,
        authenticated: true,
        role: "streamer",
        csrfToken: "visual-fixture",
        streamer: {
          twitchUserId: "visual-streamer",
          twitchLogin: "yoro_visual",
          twitchDisplayName: "YORO Visual",
          riotGameName: "YORO QA",
          riotTagLine: "JP1"
        }
      });
      return;
    }
    if (url.pathname === "/api/twitch/status") {
      await json(route, {
        configured: true,
        connected: true,
        state: "connected",
        eventSub: { websocket: "connected" }
      });
      return;
    }
    await json(route, {});
  });

  await page.route("**/dashboard/config.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: "window.__STREAMOPS_CONFIG__ = {};"
    });
  });

  await page.route("**/overlay/config.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: "window.__STREAMOPS_CONFIG__ = {};"
    });
  });
}

async function installExternalImageFixture(page: Page): Promise<void> {
  await page.route(/^https:\/\/.+/, async (route) => {
    const resourceType = route.request().resourceType();
    if (resourceType === "image") {
      await route.fulfill({ status: 200, contentType: "image/png", body: transparentPng });
      return;
    }
    if (resourceType === "script") {
      await route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
      return;
    }
    if (resourceType === "stylesheet") {
      await route.fulfill({ status: 200, contentType: "text/css", body: "" });
      return;
    }
    await route.fulfill({ status: 204, body: "" });
  });
}

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return errors;
}

async function assertStableSurface(page: Page, errors: string[], screenshotName: string): Promise<void> {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    window.scrollTo(0, 0);
  });

  const diagnostics = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    brokenImages: [...document.images]
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src || image.alt)
  }));

  expect(diagnostics.scrollWidth, "문서에 수평 overflow가 없어야 합니다.").toBeLessThanOrEqual(diagnostics.viewportWidth);
  expect(diagnostics.brokenImages, "깨진 이미지가 없어야 합니다.").toEqual([]);
  expect(errors, "console 또는 page runtime 오류가 없어야 합니다.").toEqual([]);
  await expect(page).toHaveScreenshot(screenshotName, { fullPage: true });
}

test.beforeEach(async ({ page }) => {
  await installStableBrowserEnvironment(page);
  await installDashboardApiFixtures(page);
  await installExternalImageFixture(page);
});

test("Public Home", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/");
  await expect(page.locator(".public-home-shared-shell")).toBeVisible();
  await assertStableSurface(page, errors, "public-home.png");
});

test("Public Profile", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/lol/summoners/jp/YORO%20QA-JP1");
  await expect(page.locator(".public-profile-shared-shell")).toBeVisible();
  await assertStableSurface(page, errors, "public-profile.png");
});

test("Dashboard", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/dashboard");
  await expect(page.locator(".dashboard-shared-shell")).toBeVisible();
  await assertStableSurface(page, errors, "dashboard.png");
});

test("Overlay", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto(`${overlayBaseUrl}/?mode=events&mock=1&preview=1`);
  await expect(page.locator(".overlay-root")).toBeVisible();
  await expect(page.locator(".banner")).toBeVisible();
  await assertStableSurface(page, errors, "overlay.png");
});
