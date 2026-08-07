import { expect, test, type Page, type Route } from "@playwright/test";

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

function json(route: Route, body: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(body)
  });
}

async function installStableBrowserEnvironment(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const fixedNow = new Date("2026-07-15T00:00:00.000Z").valueOf();
    Date.now = () => fixedNow;
  });
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
  await page.route("**/api/lol/suggestions**", async (route) => {
    await json(route, {
      suggestions: [{
        gameName: "YORO QA",
        tagLine: "KR1",
        source: "recommended",
        lolPlatform: "kr",
      }],
    });
  });
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

  const searchInput = page.getByRole("searchbox", { name: "Riot ID 입력" });
  await searchInput.fill("YORO");
  await expect(page.locator(".public-suggestion-panel")).toBeVisible();
  await serverButton.click();
  await expect(page.locator(".public-server-menu")).toBeVisible();
  await expect(page.locator(".public-suggestion-panel")).toHaveCount(0);
  await searchInput.focus();
  await expect(page.locator(".public-server-menu")).toHaveCount(0);
  await expect(page.locator(".public-suggestion-panel")).toBeVisible();
  await expect(page.getByText("검색 실패", { exact: true })).toHaveCount(0);
  await expect(page.getByText("표시할 데이터가 없습니다.", { exact: true })).toHaveCount(0);
});

test("최근 검색과 즐겨찾기를 반복 전환해도 동일 소환사는 한 번만 표시한다", async ({ page }) => {
  await page.addInitScript(() => {
    const duplicate = {
      gameName: "せいが",
      tagLine: "SEI",
      source: "recent",
      lolPlatform: "jp1",
    };
    window.localStorage.setItem("loltrace.recent.jp", JSON.stringify([
      duplicate,
      { ...duplicate, gameName: " せいが ", tagLine: "sei" },
    ]));
    window.localStorage.setItem("loltrace.favorites.jp", JSON.stringify([
      duplicate,
      { ...duplicate, tagLine: "sei" },
    ]));
  });
  await page.goto("/ko/");

  await page.getByRole("searchbox", { name: "Riot ID 입력" }).focus();
  const panel = page.locator(".public-suggestion-panel");
  const recentTab = panel.getByRole("tab", { name: /최근 검색/u });
  const favoritesTab = panel.getByRole("tab", { name: /즐겨찾기/u });
  await expect(panel).toHaveCount(1);
  await expect(panel.getByRole("option")).toHaveCount(1);

  for (let index = 0; index < 3; index += 1) {
    await favoritesTab.click();
    await expect(favoritesTab).toHaveAttribute("aria-selected", "true");
    await expect(panel.getByRole("option")).toHaveCount(1);
    await recentTab.click();
    await expect(recentTab).toHaveAttribute("aria-selected", "true");
    await expect(panel.getByRole("option")).toHaveCount(1);
  }
});

test("모바일 메뉴와 LoL 검색 입력은 상단 레이어·자동 확대·입력 폭을 안전하게 유지한다", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/ko/");

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await page.setViewportSize(viewport);
    const serverButton = page.getByRole("button", { name: "검색 서버" });
    const searchInput = page.getByRole("searchbox", { name: "Riot ID 입력" });
    const metrics = await page.locator(".public-home-shared-search-form").evaluate((form) => {
      const server = form.querySelector<HTMLElement>(".public-home-shared-server");
      const input = form.querySelector<HTMLInputElement>(".public-home-shared-input");
      if (!server || !input) return null;
      return {
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        fontSize: Number.parseFloat(window.getComputedStyle(input).fontSize),
        inputWidth: input.getBoundingClientRect().width,
        serverWidth: server.getBoundingClientRect().width,
      };
    });

    await expect(serverButton).toBeVisible();
    await expect(searchInput).toBeVisible();
    expect(metrics).not.toBeNull();
    expect(metrics?.fontSize).toBeGreaterThanOrEqual(16);
    expect(metrics?.serverWidth).toBeLessThanOrEqual(56);
    expect(metrics?.inputWidth).toBeGreaterThanOrEqual(150);
    expect(metrics?.documentOverflow).toBeLessThanOrEqual(0);

    const typography = await page.locator("main").evaluate((main) => {
      const heading = main.querySelector<HTMLElement>("h1");
      const sectionHeading = main.querySelector<HTMLElement>("h2");
      return {
        heading: Number.parseFloat(heading ? window.getComputedStyle(heading).fontSize : "0"),
        sectionHeading: Number.parseFloat(sectionHeading ? window.getComputedStyle(sectionHeading).fontSize : "0"),
      };
    });
    expect(typography.heading).toBeLessThanOrEqual(24);
    expect(typography.sectionHeading).toBeLessThanOrEqual(18);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/lol/summoners/jp/YORO%20QA-JP1");
  const menuButton = page.getByRole("button", { name: "메뉴 열기", exact: true });
  await menuButton.click();

  const sheet = page.locator(".public-bottom-sheet");
  const closeButton = sheet.getByRole("button", { name: "메뉴 닫기", exact: true });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute("data-sheet-state", "open");
  await expect(closeButton).toBeVisible();
  await expect.poll(() => closeButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const topElement = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return topElement === button || button.contains(topElement);
  })).toBe(true);
  const layerState = await closeButton.evaluate((button) => {
    const sheetElement = button.closest<HTMLElement>(".public-bottom-sheet");
    const headerElement = document.querySelector<HTMLElement>(".public-game-header");
    return {
      headerZIndex: Number.parseFloat(headerElement ? window.getComputedStyle(headerElement).zIndex : "0"),
      sheetZIndex: Number.parseFloat(sheetElement ? window.getComputedStyle(sheetElement).zIndex : "0"),
    };
  });
  expect(layerState.sheetZIndex).toBeGreaterThan(layerState.headerZIndex);

  await closeButton.click();
  await expect(sheet).toHaveCount(0);
  await expect(menuButton).toBeFocused();
});

test("Public Profile", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/lol/summoners/jp/YORO%20QA-JP1");
  await expect(page.locator(".public-profile-shared-shell")).toBeVisible();
  await assertStableSurface(page, errors, "public-profile.png");
});

test("모바일 LoL 상단 탐색과 검색은 스크롤 방향에 따라 접히고 다시 펼쳐진다", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) > 768, "모바일 상단바 전용 검증");

  // 상단바 접힘은 스크롤 진행도에 연동됩니다. 전적이 없는 빈 프로필은 문서가 너무 짧아
  // 최종 상태까지 도달하지 못하므로, 실제 사용에 가까운 전적 목록을 채워 둡니다.
  await page.route("**/api/lol/profile**", async (route) => {
    await json(route, {
      ...profileFixture,
      recentMatches: Array.from({ length: 10 }, (_, index) => ({
        matchId: `JP1_2${index}`,
        champion: { championId: 238, championKey: "Zed", nameKo: "제드", nameJa: "ゼド" },
        queueId: 420,
        startedAt: "2026-07-14T04:20:00.000Z",
        durationSeconds: 1_610,
        result: index % 2 === 0 ? "win" : "loss",
        kills: 9, deaths: 3, assists: 6, kda: 5,
        championLevel: 18, cs: 210, csPerMinute: 7.8, killParticipation: 70,
        position: "MIDDLE",
        items: [], summonerSpells: [4, 14], badges: [], teams: [],
      })),
      summary: {
        recentGames: 10, recentWins: 5, recentWinRate: 50,
        totalKills: 90, totalDeaths: 30, totalAssists: 60,
      },
    });
  });

  await page.goto("/lol/summoners/jp/YORO%20QA-JP1");
  await expect(page.locator(".public-profile-shared-shell")).toBeVisible();
  const header = page.locator(".lol-public-game-header");
  const nav = header.locator(".public-game-header__nav-slot");
  const search = header.locator(".public-game-header__search-slot");

  await expect(nav).toBeVisible();
  await expect(search).toBeVisible();
  await expect(nav).not.toHaveCSS("transition-duration", "0s");

  await page.evaluate(() => window.scrollTo(0, 240));
  await expect(header).toHaveClass(/mobile-chrome-scrolled/u);
  await expect(nav).toHaveCSS("opacity", "0");
  await expect(search).toHaveCSS("opacity", "0");

  await page.evaluate(() => window.scrollBy(0, -48));
  await expect(header).not.toHaveClass(/mobile-chrome-scrolled/u);
  await expect(nav).toHaveCSS("opacity", "1");
  await expect(search).toHaveCSS("opacity", "1");

  // 천천히 내릴 때 상단바가 접혔다 펼쳐졌다를 반복하면 안 됩니다.
  // 접히면 문서가 슬롯 높이만큼 짧아지고 브라우저가 scroll 을 되돌리는데,
  // 그 반동이 리셋 구간(24px)에 닿으면 곧바로 다시 펼쳐져 왕복이 반복됩니다.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    (window as unknown as { __chromeLog: number[] }).__chromeLog = [];
    addEventListener("scroll", () => {
      const collapsed = document.querySelector(".lol-public-game-header")?.classList.contains("mobile-chrome-scrolled") ? 1 : 0;
      (window as unknown as { __chromeLog: number[] }).__chromeLog.push(collapsed);
    }, { passive: true });
  });
  await page.mouse.move(180, 600);
  for (let step = 0; step < 16; step += 1) {
    await page.mouse.wheel(0, 28);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1_200);
  const toggles = await page.evaluate(() => {
    const log = (window as unknown as { __chromeLog: number[] }).__chromeLog;
    let count = 0;
    for (let index = 1; index < log.length; index += 1) if (log[index] !== log[index - 1]) count += 1;
    return count;
  });
  expect(toggles, "천천히 내리는 동안 상단바 접힘 전환은 한 번이어야 합니다.").toBeLessThanOrEqual(1);
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

  const row = page.locator(".public-match-card").first();
  const item = row.locator(".public-match-card-item-grid > span").first();
  const score = row.locator(".public-match-card-score");
  const scoreTooltip = row.locator(".public-match-card-score-description");
  const expand = row.locator(".public-match-card-expand");
  const expandTooltip = row.locator(".public-match-card-expand-label");

  if (viewportWidth <= 768) {
    // 모바일은 3행 압축 카드입니다. 포트레이트가 1·2행을 관통하고
    // 등급은 행 가운데 열, KDA·상세 버튼은 그 오른쪽에 따로 섭니다.
    // (성과 묶음은 display: contents 라 자체 box 가 없습니다.)
    const portrait = row.locator(".public-match-card-portrait");
    const items = row.locator(".public-match-card-items");
    const [portraitBox, scoreBox, itemsBox] = await Promise.all([
      portrait.boundingBox(),
      score.boundingBox(),
      items.boundingBox(),
    ]);
    expect(portraitBox).not.toBeNull();
    expect(scoreBox).not.toBeNull();
    expect(itemsBox).not.toBeNull();
    await expect(row.locator(".public-match-card-perf")).toHaveCSS("display", "contents");
    expect(scoreBox?.x ?? 0, "등급 배지는 챔피언 묶음 오른쪽에 있어야 합니다.")
      .toBeGreaterThan((portraitBox?.x ?? 0) + (portraitBox?.width ?? 0));
    expect(itemsBox?.y ?? 0, "장비 행은 챔피언 묶음 아래에 있어야 합니다.")
      .toBeGreaterThanOrEqual((portraitBox?.y ?? 0) + (portraitBox?.height ?? 0) - 1);
    // 폭이 좁아지면 보조 문구·게이지·후행 지표를 접습니다.
    await expect(row.locator(".public-match-card-stat-bar")).toBeHidden();
    await expect(row.locator(".public-match-card-role")).toBeHidden();
    await expect(row.locator(".public-match-card-stats > span").nth(2)).toBeHidden();
  }

  const kdaFontSizes = await row.locator(".public-match-card-kda > strong").evaluate((element) => ({
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
  await page.route("**/api/lol/profile**", async (route) => {
    await json(route, {
      ...profileFixture,
      rankedStats: {
        queueType: "RANKED_SOLO_5x5",
        tier: "PLATINUM",
        rank: "II",
        leaguePoints: 99,
        wins: 37,
        losses: 35,
        rankScore: 2_499,
      },
      recentMatches: [{
        matchId: "JP1_1001",
        champion: { championId: 238, championKey: "Zed", nameKo: "제드", nameJa: "ゼド" },
        queueId: 420,
        startedAt: "2026-07-14T04:20:00.000Z",
        durationSeconds: 1_610,
        result: "win",
        kills: 12,
        deaths: 6,
        assists: 4,
        kda: 2.67,
        championLevel: 18,
        cs: 226,
        csPerMinute: 7.6,
        killParticipation: 33,
        position: "MIDDLE",
        items: [],
        summonerSpells: [4, 14],
        badges: [{ code: "mvp", rank: 1 }],
        teams: [],
      }],
      summary: {
        recentGames: 1,
        recentWins: 1,
        recentWinRate: 100,
        totalKills: 12,
        totalDeaths: 6,
        totalAssists: 4,
      },
      rolePerformance: [{ role: "MIDDLE", games: 1, wins: 1, winRate: 100 }],
    });
  });
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1180, height: 820 },
    { width: 1280, height: 900 },
    { width: 1344, height: 900 },
    { width: 1345, height: 900 },
    { width: 1366, height: 900 },
    { width: 1440, height: 1000 },
    { width: 1920, height: 1080 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/lol/summoners/jp/YORO%20QA-JP1");
    const profile = page.locator(".public-profile-platform-v2");
    // 랭크 티어는 별도 섹션이 아니라 히어로가 소유합니다.
    const hero = page.locator(".public-profile-hero");
    const tabs = hero.locator(".public-profile-hero-nav");
    const rankSection = hero.locator(".public-profile-hero-rank");
    const queueSwitcher = rankSection.locator(".public-profile-hero-queue");
    const recentMatches = page.locator("#public-recent-matches");
    const matchFilter = recentMatches.locator(".public-match-filter-panel");
    const resultsColumn = page.locator(".public-overview-results-column");
    const aggregatePanel = page.locator(".public-overview-dashboard-panel");
    // 사이드바는 지표 프로파일 · LP 기록 · 포지션 세 카드로 재구성했습니다.
    const metricCard = aggregatePanel.locator(".public-profile-metric-profile");
    const matchSummary = recentMatches.locator(".public-match-card-summary").first();
    await expect(profile).toBeVisible();
    await expect(tabs.getByRole("button")).toHaveCount(5);
    await expect(rankSection).toBeVisible();
    // 3개 큐를 균등 3등분하지 않고 세그먼트로 접습니다.
    await expect(queueSwitcher).toHaveCount(3);
    await expect(queueSwitcher.filter({ has: page.locator("[aria-pressed=\"true\"]") })).toHaveCount(0);
    await expect(page.locator(".public-profile-rank-section")).toHaveCount(0);
    await expect(resultsColumn.locator("#public-recent-matches")).toHaveCount(1);
    await expect(aggregatePanel).toHaveCount(1);
    await expect(aggregatePanel.locator(".public-profile-side-card")).toHaveCount(3);
    await expect(metricCard.locator(".public-profile-metric-row")).toHaveCount(5);
    // 동티어 비교 데이터가 없는 동안에는 기준선을 그리지 않습니다.
    await expect(metricCard.locator(".public-profile-metric-bar > i")).toHaveCount(0);
    await expect(page.locator(".public-profile-details-toggle")).toHaveCount(0);

    const heroPrecedesMatches = await page.evaluate(() => {
      const hero = document.querySelector(".public-profile-hero");
      const matches = document.querySelector("#public-recent-matches");
      return Boolean(hero && matches && (hero.compareDocumentPosition(matches) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(heroPrecedesMatches, "히어로(신원·랭크·탭)는 최근 경기보다 앞에 배치되어야 합니다.").toBe(true);

    // 탭은 히어로 카드 안쪽 마지막 행이어야 합니다.
    const tabsInsideHero = await page.evaluate(() => {
      const hero = document.querySelector(".public-profile-hero");
      const nav = document.querySelector(".public-profile-hero-nav");
      return Boolean(hero && nav && hero.contains(nav));
    });
    expect(tabsInsideHero, "프로필 탭은 히어로 카드 안에 있어야 합니다.").toBe(true);

    const [heroBox, matchesBox, aggregateBox] = await Promise.all([
      hero.boundingBox(),
      recentMatches.boundingBox(),
      aggregatePanel.boundingBox(),
    ]);
    expect(heroBox).not.toBeNull();
    expect(matchesBox).not.toBeNull();
    if (viewport.width > 1344) {
      expect(aggregateBox).not.toBeNull();
      expect(aggregateBox?.width ?? 0, "넓은 PC에서 요약 카드 열은 충분한 가로 폭을 확보해야 합니다.")
        .toBeGreaterThanOrEqual(288);
    }
    const heroOverflow = await hero.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(heroOverflow, `${viewport.width}px에서 히어로 내부에 수평 overflow가 없어야 합니다.`).toBeLessThanOrEqual(1);

    const metricOverflow = await metricCard.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      // 값 열 폭이 고정이라 막대 시작 x 는 모든 행에서 같아야 합니다.
      barLefts: [...new Set([...element.querySelectorAll(".public-profile-metric-bar")]
        .map((bar) => Math.round(bar.getBoundingClientRect().left)))].length,
    }));
    expect(metricOverflow.scrollWidth, `${viewport.width}px에서 지표 카드 내부가 잘리지 않아야 합니다.`)
      .toBeLessThanOrEqual(metricOverflow.clientWidth + 1);
    expect(metricOverflow.barLefts, `${viewport.width}px에서 지표 막대는 같은 x에서 시작해야 합니다.`).toBe(1);

    const diagnostics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(diagnostics.scrollWidth, `${viewport.width}px에서 문서 수평 overflow가 없어야 합니다.`)
      .toBeLessThanOrEqual(diagnostics.clientWidth);

    const matchRowDiagnostics = await matchSummary.evaluate((element) => {
      const rowRect = element.getBoundingClientRect();
      const visibleChildren = [...element.children].filter((child) => {
        const style = getComputedStyle(child);
        const rect = child.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      });
      return {
        outsideChildren: visibleChildren.filter((child) => {
          const rect = child.getBoundingClientRect();
          return rect.left < rowRect.left - 1 || rect.right > rowRect.right + 1;
        }).map((child) => child.className),
        overlappingChildren: visibleChildren.flatMap((child, index) => {
          const rect = child.getBoundingClientRect();
          return visibleChildren.slice(index + 1).flatMap((candidate) => {
            const candidateRect = candidate.getBoundingClientRect();
            const overlapWidth = Math.min(rect.right, candidateRect.right) - Math.max(rect.left, candidateRect.left);
            const overlapHeight = Math.min(rect.bottom, candidateRect.bottom) - Math.max(rect.top, candidateRect.top);
            return overlapWidth > 1 && overlapHeight > 1
              ? [`${child.className} / ${candidate.className}`]
              : [];
          });
        }),
      };
    });
    expect(matchRowDiagnostics.outsideChildren, `${viewport.width}px에서 전적 행 항목이 서로 밀려나지 않아야 합니다.`)
      .toEqual([]);
    expect(matchRowDiagnostics.overlappingChildren, `${viewport.width}px에서 전적 행 항목이 겹치지 않아야 합니다.`)
      .toEqual([]);

    if (viewport.width <= 430) {
      const championName = matchSummary.locator(".public-match-card-copy > strong");
      const highlightBadge = matchSummary.locator(".public-match-card-highlight");
      const [championNameBox, championBox, itemsBox, kdaBox, scoreBox, expandBox, statsBox] = await Promise.all([
        championName.boundingBox(),
        matchSummary.locator(".public-match-card-portrait").boundingBox(),
        matchSummary.locator(".public-match-card-items").boundingBox(),
        matchSummary.locator(".public-match-card-kda").boundingBox(),
        matchSummary.locator(".public-match-card-score").boundingBox(),
        matchSummary.locator(".public-match-card-expand").boundingBox(),
        matchSummary.locator(".public-match-card-stats").boundingBox(),
      ]);
      expect(championNameBox).not.toBeNull();
      if (await highlightBadge.count()) {
        const highlightBadgeBox = await highlightBadge.boundingBox();
        const badgeGap = (highlightBadgeBox?.x ?? 0) - ((championNameBox?.x ?? 0) + (championNameBox?.width ?? 0));
        expect(badgeGap, "MVP·ACE는 챔피언 이름 오른쪽에 있어야 합니다.").toBeGreaterThan(0);
        expect(badgeGap, "MVP·ACE는 챔피언 이름 바로 옆에 붙어야 합니다.").toBeLessThanOrEqual(8);
      }
      expect((itemsBox?.y ?? 0) - ((championBox?.y ?? 0) + (championBox?.height ?? 0)), "챔피언 묶음과 장비 행의 간격이 과도하지 않아야 합니다.")
        .toBeLessThanOrEqual(10);
      // 등급 배지는 행 가운데 열에 홀로 서고, 오른쪽에는 KDA 와 상세 버튼만 남습니다.
      expect(scoreBox?.x ?? 0, "등급 배지는 KDA 왼쪽에 있어야 합니다.")
        .toBeLessThanOrEqual((kdaBox?.x ?? 0) + 1);
      expect(kdaBox?.x ?? 0, "KDA는 등급 배지와 겹치지 않아야 합니다.")
        .toBeGreaterThanOrEqual((scoreBox?.x ?? 0) + (scoreBox?.width ?? 0));
      // 지표 행의 오른쪽 끝은 상세 버튼 오른쪽 끝과 같은 축입니다.
      expect(Math.abs(((statsBox?.x ?? 0) + (statsBox?.width ?? 0)) - ((expandBox?.x ?? 0) + (expandBox?.width ?? 0))), "지표와 상세 버튼의 오른쪽 끝이 같아야 합니다.")
        .toBeLessThanOrEqual(2);
      // KDA 는 상세 버튼 열 안쪽에 머물러 버튼과 맞닿지 않아야 합니다.
      expect((expandBox?.x ?? 0) - ((kdaBox?.x ?? 0) + (kdaBox?.width ?? 0)), "KDA와 상세 버튼 사이에 여백이 있어야 합니다.")
        .toBeGreaterThanOrEqual(2);
    }

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

  const hero = page.locator(".public-profile-hero");
  const identity = hero.locator(".public-profile-hero-identity");
  const artwork = hero.locator(".public-profile-hero-art");
  const cast = hero.locator(".public-profile-hero-cast");
  const channelChip = hero.locator(".public-profile-hero-channel");
  const livePill = hero.locator(".public-profile-hero-live-pill");

  await expect(identity.getByText("YORO QA", { exact: true })).toBeVisible();
  await expect(identity.getByText("#JP1", { exact: true })).toBeVisible();
  await expect(identity.getByRole("button", { name: "전적 갱신" })).toBeVisible();
  await expect(identity.getByRole("button", { name: "즐겨찾기 추가" })).toBeVisible();

  // 일러스트는 정보 뒤로 물러나고, 전경 텍스트는 흐려지지 않아야 합니다.
  const foreground = await hero.evaluate((element) => {
    const identityElement = element.querySelector<HTMLElement>(".public-profile-hero-identity");
    const artworkElement = element.querySelector<HTMLElement>(".public-profile-hero-art");
    return {
      identityZ: Number.parseInt(getComputedStyle(identityElement!).zIndex, 10),
      artworkZ: Number.parseInt(getComputedStyle(artworkElement!).zIndex, 10),
      identityOpacity: getComputedStyle(identityElement!).opacity,
      identityFilter: getComputedStyle(identityElement!).filter,
      artworkOpacity: Number.parseFloat(getComputedStyle(artworkElement!).opacity),
      artworkMask: getComputedStyle(artworkElement!).maskImage,
    };
  });
  expect(foreground.identityZ).toBeGreaterThan(foreground.artworkZ);
  expect(foreground.identityOpacity).toBe("1");
  expect(foreground.identityFilter).toBe("none");
  expect(foreground.artworkOpacity).toBeLessThan(1);
  expect(foreground.artworkMask).toContain("gradient");

  // 소환사 신원과 Twitch 채널이 같은 줄에서 이어져야 같은 사람으로 읽힙니다.
  await expect(channelChip).toBeVisible();
  await expect(livePill).toBeVisible();
  const [identityBox, castBox, heroBox, chipBox] = await Promise.all([
    identity.boundingBox(),
    cast.boundingBox(),
    hero.boundingBox(),
    channelChip.boundingBox(),
  ]);
  expect(identityBox).not.toBeNull();
  expect(castBox).not.toBeNull();
  expect(heroBox).not.toBeNull();
  expect(chipBox).not.toBeNull();
  expect(chipBox!.y, "채널 칩은 이름과 같은 줄에 있어야 합니다.")
    .toBeLessThan(identityBox!.y + identityBox!.height);
  // 방송 카드는 신원 행 아래 body 안에 있고 히어로 폭을 넘지 않습니다.
  expect(castBox!.y).toBeGreaterThanOrEqual(identityBox!.y + identityBox!.height - 1);
  expect(castBox!.x + castBox!.width).toBeLessThanOrEqual(heroBox!.x + heroBox!.width + 1);

  // 스트리머 히어로가 일반 프로필의 두 배로 부풀지 않아야 합니다.
  expect(heroBox!.height, "스트리머 히어로는 400px 를 넘지 않아야 합니다.").toBeLessThanOrEqual(400);

  // Twitch 버튼 라벨은 짧게 두고 설명은 aria-label 로 보냅니다.
  const watch = cast.locator("a.is-twitch");
  await expect(watch).toHaveText(/^Twitch$/u);
  await expect(watch).toHaveAttribute("aria-label", /Twitch/u);
  const watchOverflow = await watch.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(watchOverflow, "Twitch 버튼 글자가 버튼 밖으로 넘치지 않아야 합니다.").toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 390, height: 844 });
  const [mobileIdentityBox, mobileCastBox, mobileHeroBox] = await Promise.all([
    identity.boundingBox(),
    cast.boundingBox(),
    hero.boundingBox(),
  ]);
  expect(mobileIdentityBox).not.toBeNull();
  expect(mobileCastBox).not.toBeNull();
  expect(mobileCastBox!.y).toBeGreaterThanOrEqual(mobileIdentityBox!.y + mobileIdentityBox!.height);
  expect(mobileHeroBox!.height, "모바일 스트리머 히어로는 700px 를 넘지 않아야 합니다.").toBeLessThanOrEqual(700);
  const mobileWatchOverflow = await watch.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(mobileWatchOverflow, "390px 에서도 Twitch 버튼 글자가 넘치지 않아야 합니다.").toBeLessThanOrEqual(1);
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
