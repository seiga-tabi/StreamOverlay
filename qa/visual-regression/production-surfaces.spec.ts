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

test("전적 직접 URL은 홈을 먼저 표시하지 않고 프로필 로딩 화면으로 진입한다", async ({ page }) => {
  let releaseProfileRequest: (() => void) | undefined;
  let markProfileRequestStarted: (() => void) | undefined;
  const profileRequestStarted = new Promise<void>((resolve) => {
    markProfileRequestStarted = resolve;
  });
  const profileRequestGate = new Promise<void>((resolve) => {
    releaseProfileRequest = resolve;
  });

  await page.route("**/api/lol/profile**", async (route) => {
    markProfileRequestStarted?.();
    await profileRequestGate;
    await json(route, profileFixture);
  });

  await page.goto("/ko/lol/summoners/jp/YORO%20QA-JP1");
  await profileRequestStarted;
  try {
    await expect(page.locator(".public-home-shared-shell")).toHaveCount(0);
    await expect(page.getByRole("status", { name: "검색 중" })).toBeVisible();
  } finally {
    releaseProfileRequest?.();
  }

  await expect(page.locator(".public-profile-shared-shell")).toBeVisible();
  await expect(page).toHaveURL(/\/ko\/lol\/summoners\/jp\/YORO%20QA-JP1$/u);
});

test("LoL 프로필 플랫폼은 주요 viewport에서 내부 탐색과 문서 폭을 유지한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 900 },
    { width: 1440, height: 1000 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/lol/summoners/jp/YORO%20QA-JP1");
    const profile = page.locator(".public-profile-platform-v2");
    const tabs = page.locator(".public-profile-tabs");
    const rankSection = page.locator(".public-profile-rank-section");
    const rankStrip = rankSection.locator(".public-profile-metric-strip");
    const recentMatches = page.locator("#public-recent-matches");
    const resultsColumn = page.locator(".public-overview-results-column");
    const aggregatePanel = page.locator(".public-overview-dashboard-panel");
    await expect(profile).toBeVisible();
    await expect(tabs.getByRole("button")).toHaveCount(5);
    await expect(rankSection).toBeVisible();
    await expect(rankSection.getByRole("heading", { name: "랭크 티어" })).toBeVisible();
    await expect(rankStrip.locator(".public-profile-metric-card")).toHaveCount(3);
    await expect(resultsColumn.locator(".public-profile-rank-section")).toHaveCount(1);
    await expect(resultsColumn.locator("#public-recent-matches")).toHaveCount(1);
    await expect(aggregatePanel).toHaveCount(1);
    await expect(page.locator(".public-profile-details-toggle")).toHaveCount(0);

    const rankPrecedesMatches = await page.evaluate(() => {
      const rank = document.querySelector(".public-profile-rank-section");
      const matches = document.querySelector("#public-recent-matches");
      return Boolean(rank && matches && (rank.compareDocumentPosition(matches) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(rankPrecedesMatches, "티어 영역은 최근 경기보다 앞에 배치되어야 합니다.").toBe(true);

    const [rankBox, matchesBox, aggregateBox] = await Promise.all([
      rankSection.boundingBox(),
      recentMatches.boundingBox(),
      aggregatePanel.boundingBox(),
    ]);
    expect(rankBox).not.toBeNull();
    expect(matchesBox).not.toBeNull();
    expect(Math.abs((rankBox?.width ?? 0) - (matchesBox?.width ?? 0)), "티어와 최근 경기 폭이 같아야 합니다.")
      .toBeLessThanOrEqual(1);
    if (viewport.width > 1152) {
      expect(aggregateBox).not.toBeNull();
      expect(Math.abs((aggregateBox?.y ?? 0) - (rankBox?.y ?? 0)), "종합 성과와 티어 영역의 시작 높이가 같아야 합니다.")
        .toBeLessThanOrEqual(1);
    }

    const diagnostics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(diagnostics.scrollWidth, `${viewport.width}px에서 문서 수평 overflow가 없어야 합니다.`)
      .toBeLessThanOrEqual(diagnostics.clientWidth);

    await tabs.getByRole("button").last().scrollIntoViewIfNeeded();
    await expect(tabs.getByRole("button").last()).toBeVisible();
    await rankSection.getByText("5v5 랭크", { exact: true }).scrollIntoViewIfNeeded();
    await expect(rankSection.getByText("5v5 랭크", { exact: true })).toBeVisible();
    await expect(recentMatches).toBeVisible();
  }

  expect(errors, "viewport 전환 중 runtime 오류가 없어야 합니다.").toEqual([]);
});

test("LoL 공개 하위 페이지는 화면 중앙에 배치된다", async ({ page }) => {
  const paths = [
    "/follow",
    "/participation",
    "/lol/tournaments/calendar",
    "/community/server",
    "/privacy",
    "/terms",
    "/contact",
  ];

  for (const path of paths) {
    await page.goto(path);
    const content = page.locator(".public-dashboard-center");
    await expect(content).toBeVisible();

    const geometry = await content.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const root = document.documentElement;
      return {
        centerDelta: Math.abs((bounds.left + bounds.width / 2) - root.clientWidth / 2),
        horizontalOverflow: root.scrollWidth - root.clientWidth,
      };
    });

    expect(geometry.centerDelta, `${path} 콘텐츠가 화면 중앙에 있어야 합니다.`).toBeLessThanOrEqual(1);
    expect(geometry.horizontalOverflow, `${path}에 수평 overflow가 없어야 합니다.`).toBeLessThanOrEqual(0);
  }
});

test("기존 스트리머 Dashboard 경로는 통합 Dashboard로 정리된다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto(
    "/dashboard/legacy_user/sdk_0123456789abcdefghijklmnopqrstuv/followers"
      + "?dashboardKey=복제금지#legacy"
  );
  await expect(page).toHaveURL(/\/dashboard\/streaming\/followers$/u);
  await expect(page.getByText("YORO DASHBOARD", { exact: true })).toBeVisible();
  await expect(page.locator(".app-shell-followers")).toHaveCount(0);
  expect(errors, "console 또는 page runtime 오류가 없어야 합니다.").toEqual([]);
});

test("Overlay", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto(`${overlayBaseUrl}/?mode=events&mock=1&preview=1`);
  await expect(page.locator(".overlay-root")).toBeVisible();
  await expect(page.locator(".banner")).toBeVisible();
  await assertStableSurface(page, errors, "overlay.png");
});
