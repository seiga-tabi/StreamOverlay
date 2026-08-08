import { expect, test, type Page, type Route } from "@playwright/test";

const installedGuild = {
  id: "123456789012345678",
  name: "YORO 검증용 Discord 서버 이름이 매우 길어도 전체 너비를 확장하지 않습니다",
  manageable: true as const,
  botInstalled: true as const,
};

const missingGuild = {
  id: "223456789012345678",
  name: "Bot 설치 대기 서버",
  manageable: true as const,
  botInstalled: false as const,
};

const organization = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "YORO 검증 Organization",
  role: "owner" as const,
};

function json(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Credentials": "true",
    },
    body: JSON.stringify(body),
  });
}

async function installBaseRoutes(page: Page): Promise<void> {
  await page.route("**/dashboard/config.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: "window.__STREAMOPS_CONFIG__ = {};",
    });
  });
  await page.route("**/api/public/locale", async (route) => {
    await json(route, { locale: "ko" });
  });
  await page.route("**/api/public/twitch/status", async (route) => {
    await json(route, {
      connected: false,
      configured: false,
      requiredScopes: [],
      missingScopes: [],
    });
  });
}

async function installAuthenticatedAccountRoute(page: Page): Promise<void> {
  await page.route("**/api/account/session", async (route) => {
    await json(route, {
      authenticated: true,
      csrfToken: "yoro-csrf",
      authenticationProvider: "discord",
      identities: [{
        provider: "discord",
        displayName: "Dashboard 검증 사용자",
        connectedAt: "2026-07-30T00:00:00.000Z",
        lastAuthenticatedAt: "2026-07-30T00:00:00.000Z",
      }],
      preferences: {
        locale: "ko",
        defaultDashboardPage: "overview",
        reducedMotion: false,
      },
    });
  });
}

async function useLocale(page: Page, locale: "ko" | "ja"): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem("loltrace.locale", value);
    window.localStorage.setItem("preferredLanguage", value);
  }, locale);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= viewportWidth + 1) return [];
    return Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const style = window.getComputedStyle(element);
        return {
          name: element.className || element.tagName,
          right: Math.round(element.getBoundingClientRect().right),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          display: style.display,
          flexDirection: style.flexDirection,
          flexWrap: style.flexWrap,
          position: style.position,
        };
      })
      .filter((entry) =>
        entry.right > viewportWidth + 1
        || entry.scrollWidth > entry.clientWidth + 1
      )
      .slice(0, 8);
  })).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("yoro.google.consent.v1", "denied");
  });
  await installBaseRoutes(page);
  await useLocale(page, "ko");
});

test("Public /bot 헤더는 로그인 선택과 Discord YORO Bot 아이콘만 표시한다", async ({ page }) => {
  await page.goto("/bot");
  const header = page.locator(".public-game-header");
  await expect(header.getByText("설정 명령 구현됨 · 운영 활성화 필요")).toHaveCount(0);

  if ((page.viewportSize()?.width ?? 0) <= 768) {
    await header.getByRole("button", { name: "메뉴 열기" }).click();
    const mobileMenu = page.locator(".public-bottom-sheet");
    await expect(mobileMenu.getByRole("button", { name: "Discord 로그인" })).toBeVisible();
    await expect(mobileMenu.getByRole("button", { name: "Twitch 로그인" })).toBeVisible();
    await expect(
      mobileMenu.locator('.public-game-selector-logo.is-yoro-bot[src*="discord-symbol-blurple"]')
    ).toBeVisible();
  } else {
    const login = header.getByRole("button", { name: "로그인", exact: true });
    await login.click();
    await expect(header.getByRole("menuitem", { name: "Discord 로그인" })).toBeVisible();
    await expect(header.getByRole("menuitem", { name: "Twitch 로그인" })).toBeVisible();
    await expect(
      header.locator('.public-game-selector-logo.is-yoro-bot[src*="discord-symbol-blurple"]')
    ).toBeVisible();
  }

  await expectNoHorizontalOverflow(page);
});

test("Public /bot은 최소 권한 Bot 설치와 Dashboard CTA를 제공한다", async ({ page }) => {
  await page.goto("/bot");
  const install = page.getByRole("link", { name: "Discord 서버에 YORO Bot 추가" }).first();
  const dashboard = page.getByRole("link", { name: "대시보드 보기" });
  await expect(install).toHaveAttribute("href", "/api/discord/bot/install");
  await expect(install).toHaveAttribute("target", "_blank");
  await expect(install).toHaveAttribute("rel", /noopener/u);
  await expect(dashboard).toHaveAttribute("href", "/dashboard");
  await install.focus();
  await expect(install).toBeFocused();
  await expectNoHorizontalOverflow(page);
});

test("Public /bot은 일본어 CTA를 동일한 안전한 내부 경로로 제공한다", async ({ page }) => {
  await useLocale(page, "ja");
  await page.goto("/bot");
  await expect(page.getByRole("link", { name: "DiscordサーバーにYORO Botを追加" }).first())
    .toHaveAttribute("href", "/api/discord/bot/install");
  await expect(page.getByRole("link", { name: "Dashboardを見る" }))
    .toHaveAttribute("href", "/dashboard");
  await expectNoHorizontalOverflow(page);
});

test("/login은 Discord와 Twitch를 하나의 YORO 계정 로그인 수단으로 제공한다", async ({ page }) => {
  await page.route("**/api/account/session", async (route) => {
    await json(route, { authenticated: false });
  });
  await page.goto("/login?return_to=/dashboard/organizations");

  await expect(page.getByRole("heading", { level: 1, name: "YORO.gg 로그인" }))
    .toBeVisible();
  const discordHref = await page.getByRole("link", { name: /Discord로 계속하기/u })
    .getAttribute("href");
  const twitchHref = await page.getByRole("link", { name: /Twitch로 계속하기/u })
    .getAttribute("href");
  const discordUrl = new URL(discordHref ?? "", page.url());
  const twitchUrl = new URL(twitchHref ?? "", page.url());
  expect(discordUrl.pathname).toBe("/api/account/oauth/discord/start");
  expect(twitchUrl.pathname).toBe("/api/account/oauth/twitch/start");
  expect(discordUrl.searchParams.get("purpose")).toBe("login");
  expect(twitchUrl.searchParams.get("purpose")).toBe("login");
  expect(discordUrl.searchParams.get("return_to")).toBe("/dashboard/organizations");
  expect(twitchUrl.searchParams.get("return_to")).toBe("/dashboard/organizations");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("/dashboard는 모든 YORO 로그인 사용자에게 계정·Organization·개인 설정을 제공한다", async ({ page }) => {
  let savedPreferences: unknown;
  await page.route("**/api/account/session", async (route) => {
    await json(route, {
      authenticated: true,
      csrfToken: "yoro-csrf",
      authenticationProvider: "discord",
      identities: [{
        provider: "discord",
        displayName: "Dashboard 검증 사용자",
        avatarUrl:
          "https://cdn.discordapp.com/avatars/987654321098765432/0123456789abcdef.png?size=64",
        connectedAt: "2026-07-30T00:00:00.000Z",
        lastAuthenticatedAt: "2026-07-30T00:00:00.000Z",
      }],
      preferences: {
        locale: "ko",
        defaultDashboardPage: "overview",
        reducedMotion: false,
      },
    });
  });
  await page.route("**/api/discord/management/session", async (route) => {
    await json(route, {
      authenticated: true,
      csrfToken: "management-csrf",
      organizations: [organization],
    });
  });
  await page.route("**/api/account/preferences", async (route) => {
    savedPreferences = route.request().postDataJSON();
    expect(route.request().headers()["x-yoro-csrf"]).toBe("yoro-csrf");
    await json(route, { preferences: savedPreferences });
  });

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Dashboard 검증 사용자"
  );
  await expect(page.getByText("YORO 검증 Organization", { exact: true })).toBeVisible();
  const dashboardNavigation = page.getByRole("navigation", {
    name: "YORO.gg Dashboard",
  });
  const mobile = (page.viewportSize()?.width ?? 0) <= 800;
  if (mobile) {
    const menuButton = page.getByRole("button", {
      name: "Dashboard 메뉴 열기",
    });
    await expect(dashboardNavigation).not.toBeVisible();
    await menuButton.click();
    await expect(dashboardNavigation).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dashboardNavigation).not.toBeVisible();
    await expect(menuButton).toBeFocused();
    await menuButton.click();
  } else {
    const geometry = await page.locator(".yoro-dashboard-shell").evaluate((shell) => {
      const sidebar = shell.querySelector<HTMLElement>(".yoro-dashboard-sidebar");
      const main = shell.querySelector<HTMLElement>(".yoro-dashboard-main");
      if (!sidebar || !main) return undefined;
      const sidebarBounds = sidebar.getBoundingClientRect();
      const mainBounds = main.getBoundingClientRect();
      const availableCenter = sidebarBounds.right
        + (document.documentElement.clientWidth - sidebarBounds.right) / 2;
      return {
        sidebarWidth: sidebarBounds.width,
        mainCenterDelta: Math.abs(
          mainBounds.left + mainBounds.width / 2 - availableCenter
        ),
      };
    });
    expect(geometry?.sidebarWidth).toBeGreaterThanOrEqual(280);
    expect(geometry?.mainCenterDelta).toBeLessThanOrEqual(1);
  }
  await expect(
    dashboardNavigation.getByRole("button", { name: "연결 계정" })
  ).toBeVisible();
  await dashboardNavigation.getByRole("button", { name: "개인 설정" }).click();
  await expect(page).toHaveURL(/\/dashboard\/settings$/u);
  await page.getByLabel("기본 Dashboard 화면").selectOption("account");
  await page.getByLabel("화면 전환 효과 줄이기").check();
  await page.getByLabel("표시 언어").selectOption("ja");
  await page.getByRole("button", { name: "設定を保存" }).click();
  await expect.poll(() => savedPreferences).toEqual({
    locale: "ja",
    defaultDashboardPage: "account",
    reducedMotion: true,
  });
  await expect(page.getByText("個人設定を保存しました。")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("팔로워 관리는 통합 Dashboard의 어두운 카드와 반응형 레이아웃을 사용한다", async ({ page }) => {
  await page.route("**/api/account/session", async (route) => {
    await json(route, {
      authenticated: true,
      csrfToken: "yoro-csrf",
      authenticationProvider: "twitch",
      identities: [{
        provider: "twitch",
        displayName: "팔로워 화면 검증 사용자",
        connectedAt: "2026-07-30T00:00:00.000Z",
        lastAuthenticatedAt: "2026-07-30T00:00:00.000Z",
      }],
      preferences: {
        locale: "ko",
        defaultDashboardPage: "overview",
        reducedMotion: false,
      },
    });
  });
  await page.route("**/api/discord/management/session", async (route) => {
    await json(route, {
      authenticated: true,
      csrfToken: "management-csrf",
      organizations: [],
    });
  });
  await page.route("**/api/account/streamer", async (route) => {
    await json(route, {
      twitchConnected: true,
      twitchPermissionReady: true,
      approval: {
        status: "approved",
        enabled: true,
      },
      followerPermission: {
        state: "connected",
        missingScopes: [],
      },
      profile: {
        twitchLogin: "followers_test",
        twitchDisplayName: "팔로워 화면 검증 사용자",
      },
      summary: {
        activeFollowers: 2,
        knownFollowers: 2,
        lastSnapshotAt: "2026-07-30T00:00:00.000Z",
      },
    });
  });
  const follower = (id: string, name: string) => ({
    userId: id,
    userLogin: name.toLowerCase(),
    userName: name,
    followedAt: "2026-07-29T00:00:00.000Z",
    firstSeenAt: "2026-07-29T00:00:00.000Z",
    lastSeenAt: "2026-07-30T00:00:00.000Z",
    status: "following",
    source: "snapshot",
    activity: {
      chatMessages: 1,
      participationEntries: 0,
      total: 1,
      genres: { "채팅 참여": 1 },
    },
  });
  await page.route("**/api/account/streamer/followers", async (route) => {
    const followers = [
      follower("1001", "Follower One"),
      follower("1002", "Follower Two"),
    ];
    await json(route, {
      oauth: {
        state: "connected",
        missingScopes: [],
      },
      summary: {
        activeFollowers: 2,
        knownFollowers: 2,
        unfollowed: 0,
        newFollowers7d: 2,
        observedGenreFollowers: 2,
      },
      followers,
      recentFollowers: followers,
      recentUnfollowers: [],
      topObservedGenres: [{ name: "채팅 참여", count: 2 }],
      lastSnapshotAt: "2026-07-30T00:00:00.000Z",
      lastSnapshotTotal: 2,
      lastSnapshotTruncated: false,
      dataNotes: ["팔로우 취소는 관측된 snapshot 차이로 추정합니다."],
    });
  });

  await page.goto("/dashboard/streaming/followers");
  await expect(page.getByRole("heading", { level: 1, name: "팔로워 관리" }))
    .toBeVisible();
  await expect(page.locator(".followers-metrics > article")).toHaveCount(5);
  await expect(page.locator(".followers-card strong", {
    hasText: "Follower One",
  }).first()).toBeVisible();
  await expect(page.getByText("팔로우 취소로 추정된 사용자가 없습니다."))
    .toBeVisible();

  const presentation = await page.locator(".followers-card").first().evaluate((card) => {
    const style = window.getComputedStyle(card);
    return {
      backgroundImage: style.backgroundImage,
      color: style.color,
      borderColor: style.borderColor,
    };
  });
  expect(presentation.backgroundImage).toContain("linear-gradient");
  expect(presentation.color).toBe("rgb(244, 246, 251)");
  expect(presentation.borderColor).not.toBe("rgb(255, 255, 255)");

  const recentCards = page.locator(".followers-grid").first().locator(".followers-card");
  const cardHeights = await recentCards.evaluateAll((cards) => (
    cards.map((card) => Math.round(card.getBoundingClientRect().height))
  ));
  expect(cardHeights).toHaveLength(2);
  expect(cardHeights[1]).toBeLessThan(360);
  await expectNoHorizontalOverflow(page);
});

test("/dashboard는 session이 없으면 token 없는 통합 로그인 링크만 제공한다", async ({ page }) => {
  await page.route("**/api/account/session", async (route) => {
    await json(route, { authenticated: false });
  });
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", {
    level: 1,
    name: "YORO.gg 로그인이 필요합니다.",
  })).toBeVisible();
  const login = page.getByRole("link", { name: "로그인", exact: true });
  await expect(login).toHaveAttribute("href", "/login?return_to=/dashboard");
  expect((await login.getAttribute("href")) ?? "").not.toMatch(/token|organizationId/u);
  await expectNoHorizontalOverflow(page);
});

test("Organization이 없는 YORO 로그인 사용자는 웹 claim 후 Dashboard에 자동 진입한다", async ({ page }) => {
  await installAuthenticatedAccountRoute(page);
  let claimed = false;
  let claimRequests = 0;
  let releaseClaim: (() => void) | undefined;
  const claimGate = new Promise<void>((resolve) => {
    releaseClaim = resolve;
  });
  await page.route("**/api/discord/management/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/discord/management/session") {
      await json(route, claimed
        ? { authenticated: true, csrfToken: "management-csrf", organizations: [organization] }
        : { authenticated: true, csrfToken: "management-csrf", organizations: [] });
      return;
    }
    if (url.pathname === "/api/discord/management/connect/session") {
      await json(route, {
        authenticated: true,
        csrfToken: "connect-csrf",
        installedGuilds: [installedGuild],
        missingBotGuilds: [missingGuild],
        organizations: [],
      });
      return;
    }
    if (url.pathname === "/api/discord/management/guilds/claim") {
      claimRequests += 1;
      expect(route.request().method()).toBe("POST");
      expect(route.request().headers()["x-discord-csrf"]).toBe("connect-csrf");
      expect(route.request().postDataJSON()).toEqual({ guildId: installedGuild.id });
      await claimGate;
      claimed = true;
      await json(route, {
        completed: true,
        guild: { id: installedGuild.id, name: installedGuild.name },
        organization,
      });
      return;
    }
    if (
      url.pathname
      === `/api/discord/management/organizations/${organization.id}/game-servers`
    ) {
      await json(route, { items: [] });
      return;
    }
    await json(route, { code: "not_found" }, 404);
  });

  await page.goto("/dashboard/organizations?connect=select");
  const group = page.getByRole("group", { name: "연결 가능한 Discord 서버" });
  const guildOption = group.getByRole("radio");
  await expect(guildOption).toBeChecked();
  await expect(group.getByTitle(installedGuild.name)).toBeVisible();
  await expect(page.getByText("Bot 설치 대기 서버")).toBeVisible();

  const claim = page.getByRole("button", { name: "선택한 Discord 서버 연결" });
  await claim.click();
  await expect(claim).toBeDisabled();
  releaseClaim?.();
  await expect(
    page.getByRole("heading", { name: "Organization 개요", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Bot 제어 열기" })).toBeVisible();
  await expect(page.getByRole("link", { name: "서버 관리 열기" })).toBeVisible();
  await expect(page.getByText("Discord 서버 연결이 완료되었습니다.")).toHaveCount(1);
  expect(claimRequests).toBe(1);
  await expect(page).toHaveURL(
    `/dashboard/organizations?organization=${organization.id}`
  );
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Organization 개요", exact: true })
  ).toBeVisible();
  await page.goto("/bot");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Organization 개요", exact: true })
  ).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/bot$/u);
});

test("Bot 설치 관찰 polling은 설치 확인 후 중단하며 무한 반복하지 않는다", async ({ page }) => {
  await installAuthenticatedAccountRoute(page);
  let connectRequests = 0;
  await page.clock.install();
  await page.route("**/api/discord/management/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/discord/management/session") {
      await json(route, { authenticated: false });
      return;
    }
    if (url.pathname === "/api/discord/management/connect/session") {
      connectRequests += 1;
      await json(route, {
        authenticated: true,
        csrfToken: "connect-csrf",
        installedGuilds: connectRequests >= 3 ? [installedGuild] : [],
        missingBotGuilds: connectRequests >= 3 ? [] : [missingGuild],
        organizations: [],
      });
      return;
    }
    await json(route, { code: "not_found" }, 404);
  });

  await page.goto("/dashboard/organizations?connect=select");
  await expect(page.getByText("Bot 설치 확인 중")).toBeVisible();
  expect(connectRequests).toBe(1);
  await page.clock.runFor(4_100);
  await expect(page.getByRole("radio")).toBeVisible();
  expect(connectRequests).toBeGreaterThanOrEqual(3);
  const requestsAfterInstallationConfirmed = connectRequests;
  await page.clock.runFor(20_000);
  expect(connectRequests).toBe(requestsAfterInstallationConfirmed);
});

test("Guild claim 오류는 내부 tenant 정보를 노출하지 않고 안전한 한국어 상태로 표시한다", async ({ page }) => {
  await installAuthenticatedAccountRoute(page);
  let failure: { status: number; code: string } | "network" = {
    status: 409,
    code: "guild_already_connected",
  };
  await page.route("**/api/discord/management/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/discord/management/session") {
      await json(route, { authenticated: false });
      return;
    }
    if (url.pathname === "/api/discord/management/connect/session") {
      await json(route, {
        authenticated: true,
        csrfToken: "connect-csrf",
        installedGuilds: [installedGuild],
        missingBotGuilds: [],
        organizations: [],
      });
      return;
    }
    if (url.pathname === "/api/discord/management/guilds/claim") {
      if (failure === "network") {
        await route.abort("connectionfailed");
      } else {
        await json(route, { error: "연결할 수 없습니다.", code: failure.code }, failure.status);
      }
      return;
    }
    await json(route, { code: "not_found" }, 404);
  });

  const cases = [
    [{ status: 409, code: "guild_already_connected" }, "이미 다른 Organization에 연결"],
    [{ status: 403, code: "guild_permission_required" }, "관리할 권한이 없습니다"],
    [{ status: 409, code: "bot_installation_required" }, "Bot 설치 확인 중"],
    [{ status: 409, code: "entitlement_exceeded" }, "게임 서버는 1개만"],
    [{ status: 409, code: "setup_session_expired" }, "연결 session이 만료"],
    [{ status: 503, code: "database_unavailable" }, "관리 기능을 사용할 수 없습니다"],
    ["network", "관리 기능을 사용할 수 없습니다"],
  ] as const;

  for (const [nextFailure, message] of cases) {
    failure = nextFailure;
    await page.goto("/dashboard/organizations?connect=select");
    await page.getByRole("button", { name: "선택한 Discord 서버 연결" }).click();
    const alert = page.getByRole("alert");
    await expect(alert).toContainText(message);
    await expect(alert).not.toContainText(
      "11111111-1111-4111-8111-111111111111"
    );
    await expect(alert).not.toContainText("owner");
  }
});

test("Palworld 서버 관리는 활성 서버 한 개와 삭제 흐름만 표시한다", async ({ page }) => {
  await installAuthenticatedAccountRoute(page);
  const activeServer = {
    id: "33333333-3333-4333-8333-333333333333",
    displayName: "운영 Palworld 서버",
    gameType: "palworld",
    region: "asia",
    connectionType: "rest",
    connectionStatus: "not_configured",
    isEnabled: true,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
  };
  const disabledServer = {
    ...activeServer,
    id: "44444444-4444-4444-8444-444444444444",
    displayName: "과거 비활성 서버",
    connectionStatus: "revoked",
    isEnabled: false,
  };
  let deleted = false;
  let refreshed = 0;
  await page.route("**/api/discord/management/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/discord/management/session") {
      await json(route, {
        authenticated: true,
        csrfToken: "management-csrf",
        organizations: [organization],
      });
      return;
    }
    const listPath =
      `/api/discord/management/organizations/${organization.id}/game-servers`;
    if (url.pathname === listPath) {
      await json(route, { items: [disabledServer, activeServer] });
      return;
    }
    if (
      url.pathname === `${listPath}/${activeServer.id}/palworld-rest`
      || url.pathname === `${listPath}/${activeServer.id}/palworld-rest/refresh`
    ) {
      if (url.pathname.endsWith("/refresh")) refreshed += 1;
      await json(route, {
        enabled: true,
        pollIntervalSeconds: 30,
        registrationPolicy: {
          publicHttpsSelfService: true,
          publicHttpsPort: 443,
          privateNetworkRequiresOperatorApproval: true,
        },
        connection: {
          configured: true,
          baseUrl: "https://pal.example.com",
          passwordConfigured: true,
          updatedAt: "2026-07-30T00:00:00.000Z",
        },
        status: {
          state: "online",
          checkedAt: "2026-07-30T00:00:00.000Z",
          lastSuccessAt: "2026-07-30T00:00:00.000Z",
          latencyMs: 20,
          consecutiveFailures: 0,
          info: { serverName: "검증 서버", version: "v0.6.6" },
          metrics: {
            serverFps: 60,
            currentPlayers: 1,
            maxPlayers: 32,
            frameTimeMs: 16.67,
            uptimeSeconds: 3600,
            baseCampCount: 2,
            gameDays: 20,
          },
          diagnostics: [
            "url_policy",
            "dns_tcp",
            "tls",
            "basic_auth",
            "info",
            "metrics",
            "schema",
          ].map((key) => ({ key, state: "skipped" })),
        },
      });
      return;
    }
    if (
      url.pathname === `${listPath}/${activeServer.id}`
      && route.request().method() === "DELETE"
    ) {
      expect(route.request().headers()["x-discord-csrf"]).toBe("management-csrf");
      deleted = true;
      await route.fulfill({ status: 204 });
      return;
    }
    await json(route, { code: "not_found" }, 404);
  });

  await page.goto(
    `/dashboard/organizations/servers?organization=${organization.id}`
  );
  await expect(
    page.getByRole("heading", { name: "Palworld 서버 관리" })
  ).toBeVisible();
  await expect(page.getByText(activeServer.displayName)).toBeVisible();
  await expect(page.getByText(disabledServer.displayName)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Palworld REST 서버 등록" })).toHaveCount(0);
  await expect(page.locator(".bot-management-organization-card")).toHaveCount(0);
  const refreshButton = page.getByRole("button", { name: "상태 새로고침" });
  await expect(refreshButton).toHaveCount(1);
  await refreshButton.click();
  await expect.poll(() => refreshed).toBe(1);

  await page.getByRole("button", { name: "서버 삭제" }).click();
  await expect(page.locator(".bot-management-delete-confirmation")).toContainText(
    "저장된 REST 연결도 함께 삭제"
  );
  await page.getByRole("button", { name: "삭제 확인" }).click();
  await expect.poll(() => deleted).toBe(true);
  await expect(page.getByText(activeServer.displayName)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Palworld REST 서버 등록" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Discord Bot 제어는 플레이어 명령과 응답 후 삭제 설정을 revision과 함께 저장한다", async ({ page }) => {
  await installAuthenticatedAccountRoute(page);
  let revision = 3;
  let playerCommandEnabled = false;
  let deleteInvocationAfterReply = false;
  let updateRequests = 0;
  await page.route("**/api/discord/management/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/discord/management/session") {
      await json(route, {
        authenticated: true,
        csrfToken: "management-csrf",
        organizations: [organization]
      });
      return;
    }
    if (
      url.pathname
      === `/api/discord/management/organizations/${organization.id}/bot-control`
    ) {
      if (route.request().method() === "PATCH") {
        updateRequests += 1;
        expect(route.request().headers()["x-discord-csrf"]).toBe("management-csrf");
        const body = route.request().postDataJSON();
        expect(body.expectedRevision).toBe(revision);
        playerCommandEnabled = body.playerCommandEnabled;
        deleteInvocationAfterReply = body.deleteInvocationAfterReply;
        revision += 1;
      }
      await json(route, {
        organizationId: organization.id,
        role: "owner",
        globalPrefixCommandsEnabled: true,
        installation: {
          guildId: "123456789012345678",
          guildDisplayName: "검증 Discord 서버",
          applicationId: "234567890123456789",
          status: "active"
        },
        modules: [{
          id: "palworld.status",
          version: 1,
          enabled: true
        }],
        settings: {
          publicCommandsEnabled: true,
          palworldStatusEnabled: true,
          statusCommandEnabled: true,
          playerCommandEnabled,
          guideCommandEnabled: true,
          deleteInvocationAfterReply,
          participationAnnounceEnabled: false,
          preferredLocale: "ko",
          statusFields: {
            players: true,
            version: true,
            latency: true,
            observedAt: true
          },
          revision
        }
      });
      return;
    }
    await json(route, { code: "not_found" }, 404);
  });

  await page.goto(
    `/dashboard/organizations/bot?organization=${organization.id}`
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Discord Bot 제어" })
  ).toBeVisible();
  await page.getByRole("tab", { name: "명령" }).click();
  await expect(page.getByText(
    /작성자에게만 보이는 응답은 Discord의 제한상/u
  )).toBeVisible();
  const playerCommand = page.getByRole("checkbox", { name: /!yoro player/u });
  await expect(playerCommand).not.toBeChecked();
  await playerCommand.check();
  await page.getByRole("tab", { name: "고급" }).click();
  const deleteInvocation = page.getByRole("checkbox", {
    name: "Bot 응답 후 사용한 명령어 삭제"
  });
  await expect(deleteInvocation).not.toBeChecked();
  await deleteInvocation.check();
  await expect(
    page.getByRole("link", { name: "메시지 관리 권한 승인" })
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Bot 설정 저장" }).click();
  await expect(page.getByText("Discord Bot 설정을 저장했습니다.")).toBeVisible();
  await expect(page.getByText("설정 revision: 4")).toBeVisible();
  await expect(deleteInvocation).toBeChecked();
  expect(updateRequests).toBe(1);
  await expectNoHorizontalOverflow(page);
});

const responsiveViewports = {
  "desktop-chromium": [
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 1000 },
  ],
  "mobile-chromium": [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ],
} as const;

test("/bot과 통합 Organization Dashboard는 요구 viewport에서 focus와 overflow를 유지한다", async ({ page }, testInfo) => {
  await installAuthenticatedAccountRoute(page);
  await page.route("**/api/discord/management/session", async (route) => {
    await json(route, { authenticated: false });
  });
  await page.route("**/api/discord/management/connect/session", async (route) => {
    await json(route, { authenticated: false });
  });
  const viewports = responsiveViewports[
    testInfo.project.name as keyof typeof responsiveViewports
  ] ?? responsiveViewports["desktop-chromium"];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/bot");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto("/dashboard/organizations");
    const login = page.getByRole("button", { name: "Discord로 로그인하고 서버 선택" });
    await expect(login).toBeVisible();
    await login.focus();
    await expect(login).toBeFocused();
    await expectNoHorizontalOverflow(page);
  }
});
