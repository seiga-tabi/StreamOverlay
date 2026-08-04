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
  await page.addInitScript(() => {
    window.localStorage.setItem("yoro.google.consent.v1", "denied");
  });
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

test("메인 검색바는 서버 목록을 열고 선택한 플랫폼 색상과 값을 반영한다", async ({ page }) => {
  await page.goto("/ko/");

  const serverButton = page.getByRole("button", { name: "검색 서버" });
  await expect(serverButton).toBeVisible();
  const selectedBadge = serverButton.locator(".public-server-badge");
  const japaneseBadgeColor = await selectedBadge.evaluate((element) => getComputedStyle(element).backgroundColor);
  await serverButton.click();

  const koreanServer = page.getByRole("option", { name: /KR 한국 서버/u });
  await expect(koreanServer).toBeVisible();
  await expect(koreanServer.locator(".public-server-badge")).toHaveAttribute("data-platform", "kr");
  await koreanServer.click();

  await expect(serverButton).toContainText("KR");
  await expect(serverButton).toHaveAttribute("data-platform", "kr");
  const koreanBadgeColor = await selectedBadge.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(koreanBadgeColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(koreanBadgeColor).not.toBe(japaneseBadgeColor);
  await expect(page.getByRole("option", { name: /KR 한국 서버/u })).toHaveCount(0);
  await expect(page.getByText("검색 실패", { exact: true })).toHaveCount(0);
  await expect(page.getByText("표시할 데이터가 없습니다.", { exact: true })).toHaveCount(0);
});

test("Public Profile", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/lol/summoners/jp/YORO%20QA-JP1");
  await expect(page.locator(".public-profile-shared-shell")).toBeVisible();
  await assertStableSurface(page, errors, "public-profile.png");
});

test("전적 아이템·점수·상세 Tooltip은 이름과 안정적인 레이어를 유지한다", async ({ page }) => {
  await page.route("**/api/lol/match-ranks**", async (route) => {
    await json(route, {
      status: "ready",
      matchId: "JP1_1001",
      participants: [],
      fetchedAt: "2026-07-15T00:00:00.000Z",
    });
  });
  await page.route("**/api/lol/profile**", async (route) => {
    await json(route, {
      ...profileFixture,
      recentMatches: [{
        matchId: "JP1_1001",
        champion: { championId: 238, championKey: "Zed", nameKo: "제드", nameJa: "ゼド" },
        queueId: 420,
        startedAt: "2026-07-14T04:20:00.000Z",
        durationSeconds: 1_610,
        result: "win",
        kills: 9,
        deaths: 0,
        assists: 6,
        kda: 15,
        championLevel: 18,
        cs: 210,
        csPerMinute: 7.8,
        killParticipation: 70,
        position: "MIDDLE",
        items: [{
          slot: 0,
          itemId: 3157,
          iconUrl: "https://example.com/3157.png",
          nameKo: "존야의 모래시계",
          nameJa: "ゾーニャの砂時計",
        }],
        summonerSpells: [4, 14],
        badges: [],
        teams: [],
      }],
      summary: {
        recentGames: 1,
        recentWins: 1,
        recentWinRate: 100,
        totalKills: 9,
        totalDeaths: 0,
        totalAssists: 6,
      },
    });
  });

  await page.goto("/lol/summoners/jp/YORO%20QA-JP1");
  await expect(page.locator(".public-profile-shared-shell")).toBeVisible({ timeout: 15_000 });
  const viewportWidth = page.viewportSize()?.width ?? 1440;

  const row = page.locator(".public-match-row").first();
  const item = row.locator(".public-match-inline-items > span").first();
  const score = row.locator(".public-match-score");
  const scoreTooltip = row.locator(".public-match-score-description");
  const expand = row.locator(".public-match-expand");
  const expandTooltip = row.locator(".public-match-expand-label");

  if (viewportWidth <= 768) {
    const championMedia = row.locator(".public-champion-cell > :is(img, span)").first();
    const championCopy = row.locator(".public-champion-copy");
    const mobileLoadout = row.locator(".public-match-mobile-spells");
    const spellColumn = mobileLoadout.locator(".public-match-loadout-column.spells");
    const runeColumn = mobileLoadout.locator(".public-match-loadout-column.runes");
    const mobileLoadoutItems = mobileLoadout.locator(".public-match-loadout-column > span");
    await expect(row.locator(".public-match-meta")).toBeHidden();
    await expect(mobileLoadoutItems).toHaveCount(2);

    const championBox = await championMedia.boundingBox();
    const championCopyBox = await championCopy.boundingBox();
    const loadoutBox = await mobileLoadout.boundingBox();
    const loadoutItemBox = await mobileLoadoutItems.first().boundingBox();
    const spellItemBoxes = await spellColumn.locator(":scope > span").evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    }));
    expect(championBox).not.toBeNull();
    expect(championCopyBox).not.toBeNull();
    expect(loadoutBox).not.toBeNull();
    expect(loadoutItemBox).not.toBeNull();
    expect(loadoutBox?.x ?? -1).toBeGreaterThanOrEqual((championBox?.x ?? 0) + (championBox?.width ?? 0));
    expect(championCopyBox?.x ?? -1).toBeGreaterThanOrEqual((loadoutBox?.x ?? 0) + (loadoutBox?.width ?? 0));
    expect(Math.abs((loadoutItemBox?.width ?? 0) * 2 - (championBox?.width ?? 0))).toBeLessThanOrEqual(1);
    expect(spellItemBoxes[1]?.x).toBe(spellItemBoxes[0]?.x);
    expect(spellItemBoxes[1]?.y ?? 0).toBeGreaterThan(spellItemBoxes[0]?.y ?? 0);
    await expect(spellColumn).toHaveCSS("grid-template-rows", "24px 24px");
    await expect(runeColumn).toHaveCSS("grid-template-rows", "24px 24px");
    await expect(row.locator(".public-kda")).toHaveCSS("text-align", "center");
  }

  const kdaFontSizes = await row.locator(".public-kda > strong").evaluate((element) => ({
    number: getComputedStyle(element.querySelector("span")!).fontSize,
    separator: getComputedStyle(element.querySelector("i")!).fontSize,
  }));
  expect(kdaFontSizes.number).toBe(kdaFontSizes.separator);

  await expect(item).toHaveAttribute("data-tooltip", "존야의 모래시계");
  await expect(item).not.toHaveAttribute("data-tooltip", /3157|ID/u);

  await score.hover();
  await expect(scoreTooltip).toBeVisible();
  const scoreBox = await score.boundingBox();
  const scoreTooltipBox = await scoreTooltip.boundingBox();
  expect(scoreBox).not.toBeNull();
  expect(scoreTooltipBox).not.toBeNull();
  expect(scoreTooltipBox?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect((scoreTooltipBox?.x ?? 0) + (scoreTooltipBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth);
  expect(scoreTooltipBox?.y ?? -1).toBeGreaterThanOrEqual((scoreBox?.y ?? 0) + (scoreBox?.height ?? 0));

  const expandBefore = await expand.boundingBox();
  await expand.hover();
  if (viewportWidth > 768) {
    await expect(expandTooltip).toBeVisible();
    const expandTooltipBox = await expandTooltip.boundingBox();
    expect(expandTooltipBox).not.toBeNull();
    expect(expandTooltipBox?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((expandTooltipBox?.x ?? 0) + (expandTooltipBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth);
    expect(expandTooltipBox?.width ?? 0).toBeGreaterThan(expandTooltipBox?.height ?? 0);
    await expect(expandTooltip).toHaveCSS("transform", "none");
  } else {
    await expect(expandTooltip).toBeHidden();
  }

  await expand.click();
  await expect(row.locator(".public-match-expanded")).toBeVisible();
  if (viewportWidth > 768) {
    await expect(expandTooltip).toHaveCSS("transform", "none");
  }
  const expandAfter = await expand.boundingBox();
  expect(expandBefore).not.toBeNull();
  expect(expandAfter).not.toBeNull();
  expect(Math.abs((expandAfter?.x ?? 0) - (expandBefore?.x ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((expandAfter?.width ?? 0) - (expandBefore?.width ?? 0))).toBeLessThanOrEqual(1);
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
    const matchFilter = recentMatches.locator(".public-match-filter-bar");
    const resultsColumn = page.locator(".public-overview-results-column");
    const aggregatePanel = page.locator(".public-overview-dashboard-panel");
    const aggregateCard = aggregatePanel.locator(".public-aggregate-card");
    await expect(profile).toBeVisible();
    await expect(tabs.getByRole("button")).toHaveCount(5);
    await expect(rankSection).toBeVisible();
    await expect(rankSection.getByRole("heading", { name: "랭크 티어" })).toBeVisible();
    await expect(rankStrip.locator(".public-profile-metric-card")).toHaveCount(3);
    await expect(resultsColumn.locator(".public-profile-rank-section")).toHaveCount(1);
    await expect(resultsColumn.locator("#public-recent-matches")).toHaveCount(1);
    await expect(aggregatePanel).toHaveCount(1);
    await expect(aggregateCard.locator(".public-aggregate-insights")).toHaveCount(0);
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

    const aggregateOverflow = await aggregateCard.locator(".public-aggregate-hero").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(aggregateOverflow.scrollWidth, `${viewport.width}px에서 종합 성과 내부가 잘리지 않아야 합니다.`)
      .toBeLessThanOrEqual(aggregateOverflow.clientWidth + 1);

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
    await expect(matchFilter).toBeVisible();
    await expect(matchFilter).toHaveCSS("position", viewport.width <= 768 ? "static" : "sticky");
  }

  expect(errors, "viewport 전환 중 runtime 오류가 없어야 합니다.").toEqual([]);
});

test("스트리머 프로필은 정보 전경을 선명하게 유지하고 일러스트와 상태 패널만 분리한다", async ({ page }) => {
  await page.route("**/api/lol/profile**", async (route) => {
    await json(route, {
      ...profileFixture,
      profileIconUrl: "https://example.com/profile.png",
      rankedStats: {
        queueType: "RANKED_SOLO_5x5",
        tier: "PLATINUM",
        rank: "II",
        leaguePoints: 99,
        wins: 37,
        losses: 35,
        rankScore: 2_499,
      },
      topChampions: [{
        championId: 238,
        championKey: "Zed",
        nameKo: "제드",
        splashUrl: "https://example.com/zed-splash.png",
      }],
      twitchStream: {
        matched: true,
        isLive: false,
        twitchUserId: "streamer-1",
        twitchLogin: "yoro",
        twitchDisplayName: "YORO Streamer",
        profileImageUrl: "https://example.com/streamer.png",
        channelUrl: "https://www.twitch.tv/yoro",
        source: "approved_streamer",
      },
    });
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/lol/summoners/jp/YORO%20QA-JP1");

  const hero = page.locator(".public-profile-platform-hero");
  const main = hero.locator(".public-profile-top-main");
  const identity = hero.locator(".public-profile-top-content");
  const artwork = hero.locator(".public-profile-mastery-art");
  const spotlight = hero.locator(".public-profile-streamer-spotlight");

  await expect(identity.getByText("YORO QA", { exact: true })).toBeVisible();
  await expect(identity.getByText("#JP1", { exact: true })).toBeVisible();
  await expect(identity.getByRole("button", { name: "전적 갱신" })).toBeVisible();
  await expect(identity.getByRole("button", { name: "즐겨찾기 추가" })).toBeVisible();

  const foreground = await hero.evaluate((element) => {
    const mainElement = element.querySelector<HTMLElement>(".public-profile-top-main");
    const contentElement = element.querySelector<HTMLElement>(".public-profile-top-content");
    const artworkElement = element.querySelector<HTMLElement>(".public-profile-mastery-art");
    return {
      overlayZ: Number.parseInt(getComputedStyle(element, "::after").zIndex, 10),
      mainZ: Number.parseInt(getComputedStyle(mainElement!).zIndex, 10),
      contentOpacity: getComputedStyle(contentElement!).opacity,
      contentFilter: getComputedStyle(contentElement!).filter,
      artworkFilter: getComputedStyle(artworkElement!).filter,
    };
  });
  expect(foreground.mainZ).toBeGreaterThan(foreground.overlayZ);
  expect(foreground.contentOpacity).toBe("1");
  expect(foreground.contentFilter).toBe("none");
  expect(foreground.artworkFilter).toContain("blur(");

  const [identityBox, spotlightBox, mainBox] = await Promise.all([
    identity.boundingBox(),
    spotlight.boundingBox(),
    main.boundingBox(),
  ]);
  expect(identityBox).not.toBeNull();
  expect(spotlightBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(spotlightBox!.x).toBeGreaterThan(identityBox!.x + identityBox!.width);
  expect(spotlightBox!.width).toBeLessThanOrEqual(352);
  expect(Math.abs((spotlightBox!.x + spotlightBox!.width) - (mainBox!.x + mainBox!.width))).toBeLessThanOrEqual(24);

  await page.setViewportSize({ width: 390, height: 844 });
  const [mobileIdentityBox, mobileSpotlightBox] = await Promise.all([
    identity.boundingBox(),
    spotlight.boundingBox(),
  ]);
  expect(mobileIdentityBox).not.toBeNull();
  expect(mobileSpotlightBox).not.toBeNull();
  expect(mobileSpotlightBox!.y).toBeGreaterThanOrEqual(mobileIdentityBox!.y + mobileIdentityBox!.height);
  expect(Math.abs(mobileSpotlightBox!.width - mobileIdentityBox!.width)).toBeLessThanOrEqual(1);
});

test("LoL 공개 하위 페이지는 화면 중앙에 배치된다", async ({ page }) => {
  const paths = [
    "/follow",
    "/participation",
    "/lol/aram",
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
