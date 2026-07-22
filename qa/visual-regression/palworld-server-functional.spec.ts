import { expect, test, type Page, type Route } from "@playwright/test";

const canonicalPath = "/dashboard/test_streamer/sdk_testdashboard123/palworld/server";
const dashboardPath = "/dashboard/test_streamer/sdk_testdashboard123";
const serverUrl = "https://palworld.example.com:8212";
const rejectedServerUrl = "https://blocked-palworld.example.com";
const testSecret = "qa-only-admin-secret";
const csrfToken = "palworld-qa-csrf";
const checkedAt = "2026-07-22T03:04:05.000Z";

type ServerMode = "unconfigured" | "checking" | "online" | "degraded" | "auth_failed" | "unreachable";

type ObservedRequest = {
  method: string;
  pathname: string;
  search: string;
  headers: Record<string, string>;
  body?: string;
};

type PalworldApiFixture = {
  requests: ObservedRequest[];
  responseBodies: string[];
  refreshCalls: number;
  removeCalls: number;
  dashboardGets: number;
  setMode(mode: ServerMode): void;
};

const diagnosticKeys = [
  "url_policy",
  "dns_tcp",
  "tls",
  "basic_auth",
  "info",
  "metrics",
  "schema"
] as const;

const onlineInfo = {
  serverName: "YORO Palworld QA",
  version: "v1.0.0"
};

const onlineMetrics = {
  serverFps: 57,
  currentPlayers: 10,
  maxPlayers: 32,
  frameTimeMs: 16.77,
  uptimeSeconds: 93_900,
  baseCampCount: 8,
  gameDays: 24
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

function diagnostics(
  failedKey?: (typeof diagnosticKeys)[number],
  errorCode?: string
): Array<{ key: string; state: string; errorCode?: string }> {
  const failedIndex = failedKey ? diagnosticKeys.indexOf(failedKey) : -1;
  return diagnosticKeys.map((key, index) => {
    if (failedIndex < 0) return { key, state: "passed" };
    if (index < failedIndex) return { key, state: "passed" };
    if (index === failedIndex) return { key, state: "failed", ...(errorCode ? { errorCode } : {}) };
    return { key, state: "skipped" };
  });
}

function connection(configured: boolean) {
  return configured
    ? {
        configured: true,
        baseUrl: serverUrl,
        passwordConfigured: true,
        updatedAt: checkedAt
      }
    : {
        configured: false,
        passwordConfigured: false
      };
}

function statusForMode(mode: ServerMode) {
  if (mode === "unconfigured") {
    return {
      state: "not_configured",
      errorCode: "not_configured",
      consecutiveFailures: 0,
      diagnostics: diagnosticKeys.map((key) => ({ key, state: "skipped" }))
    };
  }
  if (mode === "auth_failed") {
    return {
      state: "auth_failed",
      errorCode: "auth_failed",
      checkedAt,
      consecutiveFailures: 1,
      diagnostics: diagnostics("basic_auth", "auth_failed")
    };
  }
  if (mode === "checking") {
    return {
      state: "checking",
      consecutiveFailures: 0,
      diagnostics: diagnosticKeys.map((key) => ({ key, state: "pending" }))
    };
  }
  if (mode === "degraded") {
    return {
      state: "degraded",
      errorCode: "request_timeout",
      checkedAt,
      lastSuccessAt: "2026-07-22T02:54:05.000Z",
      latencyMs: 5_000,
      consecutiveFailures: 1,
      info: onlineInfo,
      metrics: onlineMetrics,
      diagnostics: diagnostics("metrics", "request_timeout")
    };
  }
  if (mode === "unreachable") {
    return {
      state: "unreachable",
      errorCode: "connection_failed",
      checkedAt,
      lastSuccessAt: "2026-07-22T02:54:05.000Z",
      latencyMs: 5_000,
      consecutiveFailures: 3,
      info: onlineInfo,
      metrics: onlineMetrics,
      diagnostics: diagnostics("dns_tcp", "connection_failed")
    };
  }
  return {
    state: "online",
    checkedAt,
    lastSuccessAt: checkedAt,
    latencyMs: 42,
    consecutiveFailures: 0,
    info: onlineInfo,
    metrics: onlineMetrics,
    diagnostics: diagnostics()
  };
}

function dashboardResponse(mode: ServerMode) {
  const configured = mode !== "unconfigured";
  return {
    enabled: true,
    pollIntervalSeconds: 5,
    registrationPolicy: {
      publicHttpsSelfService: true,
      publicHttpsPort: 443,
      privateNetworkRequiresOperatorApproval: true
    },
    connection: connection(configured),
    status: statusForMode(mode)
  };
}

async function fulfillJson(
  route: Route,
  body: unknown,
  responseBodies: string[],
  status = 200
): Promise<void> {
  const serialized = JSON.stringify(body);
  responseBodies.push(serialized);
  await route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: serialized
  });
}

async function installStableEnvironment(page: Page): Promise<void> {
  await page.addInitScript((snapshot) => {
    localStorage.setItem("loltrace.locale", "ko");
    const fixedNow = new Date("2026-07-22T03:04:05.000Z").valueOf();
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

      constructor(url: string | URL) {
        const state = window as typeof window & { __palworldQaWebSocketUrls?: string[] };
        state.__palworldQaWebSocketUrls = [...(state.__palworldQaWebSocketUrls ?? []), String(url)];
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
}

async function installPalworldApiFixture(
  page: Page,
  initialMode: ServerMode
): Promise<PalworldApiFixture> {
  let mode = initialMode;
  const requests: ObservedRequest[] = [];
  const responseBodies: string[] = [];
  const fixture: PalworldApiFixture = {
    requests,
    responseBodies,
    refreshCalls: 0,
    removeCalls: 0,
    dashboardGets: 0,
    setMode(nextMode) {
      mode = nextMode;
    }
  };

  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({
      method: request.method(),
      pathname: url.pathname,
      search: url.search,
      headers: request.headers(),
      ...(request.postData() === null ? {} : { body: request.postData() ?? undefined })
    });

    if (url.pathname === "/api/dashboard/auth/status") {
      await fulfillJson(route, {
        required: true,
        configured: true,
        authenticated: true,
        role: "streamer",
        csrfToken,
        streamer: {
          twitchUserId: "qa-test-streamer",
          twitchLogin: "test_streamer",
          twitchDisplayName: "Test Streamer",
          riotGameName: "YORO QA",
          riotTagLine: "JP1",
          dashboardEnabled: true,
          dashboardSlug: "test_streamer",
          dashboardKey: "sdk_testdashboard123",
          dashboardPath
        }
      }, responseBodies);
      return;
    }

    if (url.pathname === "/api/dashboard/palworld-server" && request.method() === "GET") {
      fixture.dashboardGets += 1;
      await fulfillJson(route, dashboardResponse(mode), responseBodies);
      return;
    }

    if (url.pathname === "/api/dashboard/palworld-server/test") {
      const body = JSON.parse(request.postData() ?? "{}") as { baseUrl?: unknown };
      if (body.baseUrl === rejectedServerUrl) {
        await fulfillJson(route, {
          error: "허용된 Palworld REST API URL을 입력해야 합니다.",
          code: "origin_not_allowed"
        }, responseBodies, 400);
        return;
      }
      await fulfillJson(route, {
        connection: {
          configured: false,
          baseUrl: serverUrl,
          passwordConfigured: true
        },
        status: statusForMode("online")
      }, responseBodies);
      return;
    }

    if (url.pathname === "/api/dashboard/palworld-server/save") {
      mode = "online";
      await fulfillJson(route, dashboardResponse(mode), responseBodies);
      return;
    }

    if (url.pathname === "/api/dashboard/palworld-server/refresh") {
      fixture.refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 180));
      await fulfillJson(route, dashboardResponse(mode), responseBodies);
      return;
    }

    if (url.pathname === "/api/dashboard/palworld-server/remove") {
      fixture.removeCalls += 1;
      mode = "unconfigured";
      await fulfillJson(route, dashboardResponse(mode), responseBodies);
      return;
    }

    if (url.pathname === "/api/public/locale") {
      await fulfillJson(route, { locale: "ko" }, responseBodies);
      return;
    }

    await fulfillJson(route, {}, responseBodies);
  });

  return fixture;
}

async function preparePage(page: Page, initialMode: ServerMode): Promise<PalworldApiFixture> {
  await installStableEnvironment(page);
  return await installPalworldApiFixture(page, initialMode);
}

function runtimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return errors;
}

function assertTenantHeaders(fixture: PalworldApiFixture): void {
  const authRequests = fixture.requests.filter((request) => request.pathname === "/api/dashboard/auth/status");
  expect(authRequests.length).toBeGreaterThan(0);
  expect(authRequests.every((request) => request.search.includes("surface=streamer"))).toBe(true);

  const protectedRequests = fixture.requests.filter((request) =>
    request.pathname.startsWith("/api/dashboard/palworld-server")
  );
  expect(protectedRequests.length).toBeGreaterThan(0);
  for (const request of protectedRequests) {
    expect(request.headers["x-streamops-dashboard-surface"]).toBe("streamer");
    expect(request.headers["x-streamops-streamer-slug"]).toBe("test_streamer");
    expect(request.headers["x-streamops-dashboard-key"]).toBe("sdk_testdashboard123");
    if (request.method === "POST") {
      expect(request.headers["x-streamops-csrf"]).toBe(csrfToken);
      expect(request.headers["content-type"]).toContain("application/json");
    }
  }
}

async function assertNoHorizontalOverflowOrClippedButtons(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const hasHorizontalScrollAncestor = (element: HTMLElement): boolean => {
      let parent = element.parentElement;
      while (parent) {
        const style = getComputedStyle(parent);
        if ((style.overflowX === "auto" || style.overflowX === "scroll")
          && parent.scrollWidth > parent.clientWidth) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };
    const clippedButtons = [...document.querySelectorAll<HTMLElement>("button")]
      .filter((button) => {
        const style = getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .flatMap((button) => {
        const rect = button.getBoundingClientRect();
        return (rect.left < -1 || rect.right > window.innerWidth + 1) && !hasHorizontalScrollAncestor(button)
          ? [{ text: button.textContent?.trim() ?? "", left: rect.left, right: rect.right }]
          : [];
      });
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      clippedButtons
    };
  });
  expect(result.scrollWidth, "문서에 가로 overflow가 없어야 합니다.").toBeLessThanOrEqual(result.clientWidth);
  expect(result.clippedButtons, "화면 밖으로 잘린 버튼이 없어야 합니다.").toEqual([]);
}

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "중복 실행을 피하고 viewport를 spec 내부에서 검증합니다.");
});

test("Palworld 서버 등록·검사·저장·갱신·삭제와 tenant 보안 헤더", async ({ page }) => {
  test.setTimeout(45_000);
  const fixture = await preparePage(page, "unconfigured");
  const errors = runtimeErrors(page);

  await page.goto(canonicalPath);
  await expect(page).toHaveURL(new RegExp(`${canonicalPath.replaceAll("/", "\\/")}$`));
  await expect(page.getByRole("heading", { name: "Palworld 서버 상태" })).toBeVisible();
  await expect(page.getByText("전용 서버 연결 정보가 없습니다.")).toBeVisible();

  const socketUrls = await page.evaluate(() =>
    (window as typeof window & { __palworldQaWebSocketUrls?: string[] }).__palworldQaWebSocketUrls ?? []
  );
  expect(socketUrls.some((url) =>
    url.includes("surface=streamer")
      && url.includes("streamerSlug=test_streamer")
      && url.includes("dashboardKey=sdk_testdashboard123")
  )).toBe(true);

  await page.getByRole("button", { name: "운영 현황", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${dashboardPath.replaceAll("/", "\\/")}$`));
  await expect(page.getByRole("heading", { name: "방송 운영 대시보드" })).toBeVisible();
  const dashboardGetsAfterUnmount = fixture.dashboardGets;
  await page.waitForTimeout(5_200);
  expect(fixture.dashboardGets, "페이지를 벗어나면 자동 polling timer가 정리되어야 합니다.").toBe(dashboardGetsAfterUnmount);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${canonicalPath.replaceAll("/", "\\/")}$`));
  await expect(page.getByRole("heading", { name: "Palworld 서버 상태" })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`${dashboardPath.replaceAll("/", "\\/")}$`));
  await page.getByRole("button", { name: "서버 상태", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${canonicalPath.replaceAll("/", "\\/")}$`));

  const baseUrlInput = page.getByLabel("REST API 주소");
  const passwordInput = page.getByLabel("Palworld AdminPassword");
  await baseUrlInput.fill(serverUrl);
  await passwordInput.fill(testSecret);
  await page.getByRole("button", { name: "연결 테스트" }).click();
  await expect(page.getByText("연결 테스트 완료", { exact: true })).toBeVisible();
  await expect(page.getByText("YORO Palworld QA")).toBeVisible();
  await expect(page.locator(".palworld-server-metrics").getByText("10 / 32")).toBeVisible();
  await expect(passwordInput).toHaveValue("");

  await passwordInput.fill(testSecret);
  await page.getByRole("button", { name: "설정 저장" }).click();
  await expect(page.getByText("연결 설정 저장 완료", { exact: true })).toBeVisible();
  await expect(passwordInput).toHaveValue("");
  await expect(page.getByText("57", { exact: true })).toBeVisible();
  await expect(page.getByText("16.77 ms", { exact: true })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(testSecret);
  expect(await page.content()).not.toContain(testSecret);
  expect(fixture.responseBodies.some((body) => body.includes(testSecret))).toBe(false);

  const refreshButton = page.getByRole("button", { name: "상태 새로고침" });
  await refreshButton.evaluate((button) => {
    button.click();
    button.click();
  });
  await expect.poll(() => fixture.refreshCalls).toBe(1);
  await expect(page.getByText("서버 상태 갱신 완료", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "언어 선택" }).click();
  await page.locator('[role="menuitemradio"][aria-label^="JP "]').click();
  await expect(page.getByRole("heading", { name: "Palworld サーバー状態" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await page.getByRole("button", { name: "言語選択" }).click();
  await page.locator('[role="menuitemradio"][aria-label^="KR "]').click();
  await expect(page.getByRole("heading", { name: "Palworld 서버 상태" })).toBeVisible();

  const toastCloseButton = page.getByRole("button", { name: "알림 닫기" });
  if (await toastCloseButton.isVisible()) await toastCloseButton.click();
  await page.getByRole("button", { name: "연결 설정 삭제" }).click();
  const dialog = page.getByRole("dialog", { name: "전용 서버 연결 설정을 삭제할까요?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "설정 삭제" }).click();
  await expect(page.getByText("연결 설정 삭제 완료", { exact: true })).toBeVisible();
  await expect(page.getByText("전용 서버 연결 정보가 없습니다.")).toBeVisible();
  expect(fixture.removeCalls).toBe(1);

  const testRequest = fixture.requests.find((request) => request.pathname.endsWith("/test"));
  const saveRequest = fixture.requests.find((request) => request.pathname.endsWith("/save"));
  expect(JSON.parse(testRequest?.body ?? "{}")).toEqual({ baseUrl: serverUrl, adminPassword: testSecret });
  expect(JSON.parse(saveRequest?.body ?? "{}")).toEqual({ baseUrl: serverUrl, adminPassword: testSecret });
  assertTenantHeaders(fixture);
  expect(errors).toEqual([]);
});

test("Palworld 확인 중·degraded·인증 실패·연결 불가 상태를 안전하게 표시한다", async ({ page }) => {
  const fixture = await preparePage(page, "auth_failed");
  const errors = runtimeErrors(page);

  await page.goto(canonicalPath);
  await expect(page.getByText("인증 실패", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("auth_failed");
  await expect(page.getByRole("alert")).toContainText("Palworld AdminPassword 인증에 실패했습니다.");

  fixture.setMode("checking");
  await page.reload();
  await expect(page.getByText("확인 중", { exact: true }).first()).toBeVisible();

  fixture.setMode("degraded");
  await page.reload();
  await expect(page.getByText("일부 확인 실패", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("request_timeout");
  await expect(page.getByRole("alert")).toContainText("전용 서버 응답 시간이 초과되었습니다.");

  fixture.setMode("unreachable");
  await page.reload();
  await expect(page.getByText("연결할 수 없음", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("connection_failed");
  await expect(page.getByRole("alert")).toContainText("전용 서버에 연결하지 못했습니다.");
  assertTenantHeaders(fixture);
  expect(errors).toEqual([]);
});

test("Palworld AdminPassword는 요청 실패와 페이지 unmount 후 다시 표시되지 않는다", async ({ page }) => {
  const fixture = await preparePage(page, "unconfigured");
  const errors = runtimeErrors(page);

  await page.goto(canonicalPath);
  const baseUrlInput = page.getByLabel("REST API 주소");
  const passwordInput = page.getByLabel("Palworld AdminPassword");
  await baseUrlInput.fill(rejectedServerUrl);
  await passwordInput.fill(testSecret);
  await page.getByRole("button", { name: "연결 테스트" }).click();
  await expect(page.getByRole("alert")).toContainText("공개 HTTPS 자가 등록 조건을 충족하지 않습니다");
  await expect(passwordInput).toHaveValue("");
  expect(await page.content()).not.toContain(testSecret);

  await passwordInput.fill(testSecret);
  await page.getByRole("button", { name: "운영 현황", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${dashboardPath.replaceAll("/", "\\/")}$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${canonicalPath.replaceAll("/", "\\/")}$`));
  await expect(page.getByLabel("Palworld AdminPassword")).toHaveValue("");
  expect(await page.content()).not.toContain(testSecret);
  assertTenantHeaders(fixture);
  expect(errors).toEqual([
    "console: Failed to load resource: the server responded with a status of 400 (Bad Request)"
  ]);
});

test("Palworld 서버 상태 화면은 지정 viewport에서 가로 overflow와 잘린 버튼이 없다", async ({ page }) => {
  await preparePage(page, "online");
  const errors = runtimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1_024 },
    { width: 1_440, height: 1_000 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(canonicalPath);
    await expect(page.getByRole("heading", { name: "Palworld 서버 상태" })).toBeVisible();
    await expect(page.getByText("YORO Palworld QA")).toBeVisible();
    await assertNoHorizontalOverflowOrClippedButtons(page);
    const navigation = page.getByRole("navigation", { name: "대시보드 메뉴" });
    const navigationButtons = navigation.locator("button.nav-item");
    await navigationButtons.last().scrollIntoViewIfNeeded();
    await expect(navigationButtons.last()).toBeInViewport();
    await navigationButtons.first().scrollIntoViewIfNeeded();
    await expect(navigationButtons.first()).toBeInViewport();
  }
  expect(errors).toEqual([]);
});
