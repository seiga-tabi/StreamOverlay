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

async function useLocale(page: Page, locale: "ko" | "ja"): Promise<void> {
  await page.addInitScript((value) => {
    window.localStorage.setItem("loltrace.locale", value);
    window.localStorage.setItem("preferredLanguage", value);
  }, locale);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  )).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await installBaseRoutes(page);
  await useLocale(page, "ko");
});

test("Public /bot은 최소 권한 Bot 설치와 Dashboard CTA를 제공한다", async ({ page }) => {
  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", "987654321098765432");
  authorizeUrl.searchParams.set("scope", "applications.commands bot");
  authorizeUrl.searchParams.set("permissions", "0");

  await page.route("**/api/discord/bot/install", async (route) => {
    await route.fulfill({
      status: 302,
      headers: {
        Location: authorizeUrl.toString(),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  });
  await page.route("https://discord.com/oauth2/authorize?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<title>Discord 설치 검증</title>",
    });
  });

  await page.goto("/bot");
  const install = page.getByRole("link", { name: "Discord 서버에 YORO Bot 추가" });
  const dashboard = page.getByRole("link", { name: "Dashboard 로그인" });
  await expect(install).toHaveAttribute("href", "/api/discord/bot/install");
  await expect(dashboard).toHaveAttribute("href", "/bot/manage");
  await install.focus();
  await expect(install).toBeFocused();
  await install.click();

  await expect(page).toHaveURL(/^https:\/\/discord\.com\/oauth2\/authorize/u);
  const target = new URL(page.url());
  expect(target.searchParams.get("client_id")).toBe("987654321098765432");
  expect(new Set((target.searchParams.get("scope") ?? "").split(" "))).toEqual(
    new Set(["bot", "applications.commands"])
  );
  expect(target.searchParams.get("permissions")).toBe("0");
  expect(target.searchParams.has("redirect_uri")).toBe(false);
  await expectNoHorizontalOverflow(page);
});

test("Public /bot은 일본어 CTA를 동일한 안전한 내부 경로로 제공한다", async ({ page }) => {
  await useLocale(page, "ja");
  await page.goto("/bot");
  await expect(page.getByRole("link", { name: "DiscordサーバーにYORO Botを追加" }))
    .toHaveAttribute("href", "/api/discord/bot/install");
  await expect(page.getByRole("link", { name: "Dashboardにログイン" }))
    .toHaveAttribute("href", "/bot/manage");
  await expectNoHorizontalOverflow(page);
});

test("/bot/manage 웹 claim은 CSRF와 최소 body로 연결한 뒤 Dashboard에 자동 진입한다", async ({ page }) => {
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
        : { authenticated: false });
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

  await page.goto("/bot/manage?connect=select");
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
    page.getByRole("heading", { name: "Palworld 게임 서버", exact: true })
  ).toBeVisible();
  await expect(page.getByText("Discord 서버 연결이 완료되었습니다.")).toHaveCount(1);
  expect(claimRequests).toBe(1);
  await expect(page).toHaveURL(/\/bot\/manage\?connect=select$/u);
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Palworld 게임 서버", exact: true })
  ).toBeVisible();
  await page.goto("/bot");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Palworld 게임 서버", exact: true })
  ).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/bot$/u);
});

test("Bot 설치 관찰 polling은 설치 확인 후 중단하며 무한 반복하지 않는다", async ({ page }) => {
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

  await page.goto("/bot/manage?connect=select");
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
    [{ status: 409, code: "entitlement_exceeded" }, "활성 게임 서버 1개"],
    [{ status: 409, code: "setup_session_expired" }, "연결 session이 만료"],
    [{ status: 503, code: "database_unavailable" }, "관리 기능을 사용할 수 없습니다"],
    ["network", "관리 기능을 사용할 수 없습니다"],
  ] as const;

  for (const [nextFailure, message] of cases) {
    failure = nextFailure;
    await page.goto("/bot/manage?connect=select");
    await page.getByRole("button", { name: "선택한 Discord 서버 연결" }).click();
    const alert = page.getByRole("alert");
    await expect(alert).toContainText(message);
    await expect(alert).not.toContainText(
      "11111111-1111-4111-8111-111111111111"
    );
    await expect(alert).not.toContainText("owner");
  }
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

test("/bot과 /bot/manage는 요구 viewport에서 focus와 overflow를 유지한다", async ({ page }, testInfo) => {
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
    await page.goto("/bot/manage");
    const login = page.getByRole("button", { name: "Discord로 로그인하고 서버 선택" });
    await expect(login).toBeVisible();
    await login.focus();
    await expect(login).toBeFocused();
    await expectNoHorizontalOverflow(page);
  }
});
