/**
 * 시청자 참여 관리 콘솔(v2) 동작 회귀.
 *
 * 이 화면은 로그인 뒤에만 열려 시각 회귀 baseline이 없습니다. 대신 정보 구조의
 * 핵심 계약을 동작으로 고정합니다 — 수치의 단일 출처, 대기열 → 슬롯 방향,
 * 후보 담기의 추적 가능성, 단계별 주행동 색, 위험 행동 분리, 모바일 단일 액션 바.
 */
import { expect, test, type Page, type Route } from "@playwright/test";

async function json(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    headers: {
      "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type,x-yoro-csrf",
    },
    body: JSON.stringify(body)
  });
}

function entry(id: string, name: string, status: string, position: number) {
  return {
    id,
    position,
    twitchUserId: `u-${id}`,
    twitchUserName: name,
    status,
    game: "lol",
    riotId: `${name}#KR1`,
    preferredRole: "mid",
    createdAt: "2026-08-11T09:00:00.000Z",
    updatedAt: "2026-08-11T09:00:00.000Z"
  };
}

function participationState(queue: unknown[], sessionStatus = "recruiting") {
  return {
    isOpen: sessionStatus === "recruiting",
    revision: 4,
    queue,
    activeQueue: [],
    session: {
      streamerId: "streamer-1",
      sessionId: "sess-1",
      publicSessionId: "pub-1",
      game: "lol",
      status: sessionStatus,
      listingVisibility: "public",
      maxQueueSize: 50,
      checkInSeconds: 60,
      allowRejoin: true,
      createdAt: "2026-08-11T08:00:00.000Z",
      updatedAt: "2026-08-11T09:00:00.000Z"
    },
    summary: { total: 20, active: 3, waiting: 12, selected: 0, checkedIn: 2, noShow: 0, played: 8 }
  };
}

async function installRoutes(page: Page, state: unknown): Promise<void> {
  await page.route("**/dashboard/config.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: "window.__STREAMOPS_CONFIG__ = {};" });
  });
  await page.route("**/api/public/locale", async (route) => json(route, { locale: "ko" }));
  await page.route("**/api/public/twitch/status", async (route) => (
    json(route, { connected: false, configured: false, requiredScopes: [], missingScopes: [] })
  ));
  await page.route("**/api/account/session", async (route) => json(route, {
    authenticated: true,
    csrfToken: "yoro-csrf",
    authenticationProvider: "twitch",
    identities: [{ provider: "twitch", displayName: "검증 스트리머", connectedAt: "2026-07-30T00:00:00.000Z", lastAuthenticatedAt: "2026-07-30T00:00:00.000Z" }],
    preferences: { locale: "ko", defaultDashboardPage: "overview", reducedMotion: false }
  }));
  // 참여 관리 화면은 스트리머 승인 상태에서만 열립니다.
  await page.route("**/api/account/streamer", async (route) => json(route, {
    twitchConnected: true,
    twitchPermissionReady: true,
    approval: { status: "approved", enabled: true, requestedAt: "2026-07-30T00:00:00.000Z", reviewedAt: "2026-07-30T00:00:00.000Z" },
    followerPermission: { state: "connected" },
    profile: { twitchLogin: "verifier", twitchDisplayName: "검증 스트리머" },
    summary: { activeFollowers: 120, knownFollowers: 150, newFollowers7d: 4 }
  }));
  await page.route("**/api/account/streamer/twitch-extension", async (route) => {
    const saved = route.request().method() === "PUT"
      ? await route.request().postDataJSON()
      : {
          display: {
            joinButton: true,
            game: true,
            waitingCount: true,
            myPosition: true,
            cancelButton: true,
            nextState: true
          },
          inactiveBehavior: "hide",
          extensionType: "panel"
        };
    await json(route, {
      ...saved,
      configured: true,
      connectionState: "connected",
      revision: route.request().method() === "PUT" ? 2 : 1,
      updatedAt: "2026-08-11T09:00:00.000Z"
    });
  });
  await page.route("**/api/discord/management/session", async (route) => (
    json(route, { authenticated: true, csrfToken: "management-csrf", organizations: [] })
  ));
  await page.route("**/api/account/streamer/participation/announcement", async (route) => (
    json(route, { announcement: null })
  ));
  await page.route("**/api/account/streamer/participation", async (route) => json(route, state));
}

/** 2열 레이아웃 검증용 — 프로젝트 뷰포트와 무관하게 같은 조건으로 확인합니다. */
const DESKTOP_VIEWPORT = { width: 1440, height: 1000 };

const RECRUIT_QUEUE = [
  entry("c1", "하늘구름", "checked_in", 0),
  entry("w1", "구름달빛", "verified", 1),
  entry("w2", "새벽비", "verified", 2),
  entry("w3", "모래시계", "verified", 3),
  entry("w4", "바람소리", "verified", 4),
  entry("w5", "별헤는밤", "verified", 5),
  entry("w6", "푸른잔디", "verified", 6),
  entry("w7", "노을빛", "verified", 7),
  entry("w8", "밤하늘", "verified", 8),
  entry("h1", "지난참가자", "played", 9)
];

test("콘솔 v2 — 모집 중 데스크톱", async ({ page }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await installRoutes(page, participationState(RECRUIT_QUEUE));
  await page.goto("/dashboard/streaming/participation");

  const statusbar = page.locator(".participation-console-statusbar");
  await expect(statusbar).toBeVisible();
  await expect(statusbar).toContainText("모집 중");
  // 수치는 상태 줄 한 곳에서만 나옵니다.
  await expect(statusbar.locator(".participation-console-stats")).toContainText("슬롯");
  await expect(statusbar.locator(".participation-console-stats")).toContainText("8");
  await expect(statusbar.locator(".participation-console-stats")).toContainText("8");

  await expect(page.locator(".participation-console-queue")).toBeVisible();
  await expect(page.locator(".participation-console-slots")).toBeVisible();
  // 빈 슬롯이 실제로 그려집니다.
  await expect(page.locator(".participation-console-slot.is-empty").first()).toBeVisible();
  // 위험 영역이 분리되어 있습니다.
  await expect(page.locator(".participation-console-danger")).toContainText("세션 종료");
  // 대기열은 기본 6명까지만 펼칩니다.
  await expect(page.locator(".participation-console-queue > .participation-console-rows > .participation-console-row")).toHaveCount(6);
  // 접기 버튼이 나머지 인원을 알려 줍니다.
  await expect(page.locator(".participation-console-queue-foot")).toContainText("나머지 2명");
});

test("콘솔 v2 — 후보를 담으면 대기열 행 상태가 바뀌고 주행동이 확정으로 바뀐다", async ({ page }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  // 확정된 참가자가 있으면 서버 규칙(배치 1회)상 선정이 잠기므로 대기자만 둡니다.
  await installRoutes(page, participationState(RECRUIT_QUEUE.filter((e) => e.status === "verified")));
  await page.goto("/dashboard/streaming/participation");

  const firstRow = page.locator(".participation-console-queue > .participation-console-rows > .participation-console-row").first();
  await firstRow.getByRole("button", { name: "선정" }).click();

  // 담긴 신청자는 목록에서 사라지지 않고 상태만 바뀝니다.
  await expect(firstRow).toHaveClass(/is-picked/u);
  await expect(firstRow).toContainText("슬롯에 담김");
  await expect(firstRow.getByRole("button", { name: "되돌리기" })).toBeVisible();
  // 슬롯 열에 후보로 나타납니다.
  await expect(page.locator('.participation-console-slot[data-variant="candidate"]')).toHaveCount(1);
  // 주행동이 "선정 확정"으로 바뀝니다.
  const primary = page.locator(".participation-console-slots .participation-console-primary");
  await expect(primary).toContainText("선정 확정");
  await expect(primary).toHaveAttribute("data-tone", "pick");
});

test("콘솔 v2 — 게임 중에는 주행동 색과 잠금 안내가 바뀐다", async ({ page }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  const inGame = [
    entry("g1", "하늘구름", "in_game", 0),
    entry("g2", "모래시계", "in_game", 1),
    ...RECRUIT_QUEUE.slice(1, 5)
  ];
  await installRoutes(page, participationState(inGame, "in_game"));
  await page.goto("/dashboard/streaming/participation");

  const primary = page.locator(".participation-console-slots .participation-console-primary");
  await expect(primary).toContainText("게임 종료 처리");
  await expect(primary).toHaveAttribute("data-tone", "finish");
  // 잠금 이유가 문장으로 보입니다.
  await expect(page.locator(".participation-console-lock")).toContainText("게임이 끝나면");
});

test("콘솔 v2 — 모바일은 슬롯 요약 + 하단 바 한 벌", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installRoutes(page, participationState(RECRUIT_QUEUE));
  await page.goto("/dashboard/streaming/participation");

  await expect(page.locator(".participation-console-slots-toggle")).toBeVisible();
  const mobilebar = page.locator(".participation-console-mobilebar");
  await expect(mobilebar).toBeVisible();
  // 주행동은 화면에 한 벌만 보입니다(이전에는 두 벌이 렌더됐습니다).
  await expect(page.locator(".participation-console-primary:visible")).toHaveCount(1);
  // 가로 스크롤이 생기지 않아야 합니다.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("Twitch Extension 카드 — 설정이 실컴포넌트 Live Preview 에 즉시 반영된다", async ({ page }) => {
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await installRoutes(page, participationState(RECRUIT_QUEUE));
  await page.goto("/dashboard/streaming/participation");

  const card = page.getByTestId("twitch-extension-card");
  await card.scrollIntoViewIfNeeded();
  /* 연동 배지는 저장 API의 실제 connectionState를 반영합니다. */
  await expect(card.getByText("연동됨")).toBeVisible();

  /* 기본 미리보기 = Panel · 모집 중(실 Viewer 컴포넌트, ko 카피) */
  const preview = page.getByTestId("twitch-extension-preview");
  await expect(preview.getByTestId("twitch-ext-panel")).toBeVisible();
  await expect(preview.getByText("참가 모집 중")).toBeVisible();
  await expect(preview.getByRole("button", { name: "참가하기" })).toBeVisible();
  await expect(preview.getByText("League of Legends")).toBeVisible();

  /* 표시 토글 → 즉시 반영: 현재 게임 끄기 */
  await card.getByText("현재 게임", { exact: true }).click();
  await expect(preview.getByText("League of Legends")).toHaveCount(0);
  await card.getByRole("button", { name: "설정 저장" }).click();
  await expect(card.getByText("저장했습니다.")).toBeVisible();

  /* 상태 시뮬레이터: NEXT — lavender ring 카드 */
  await card.getByRole("button", { name: "NEXT", exact: true }).click();
  await expect(preview.getByText("당신 차례입니다!")).toBeVisible();

  /* NEXT 표시 끄기 → 참가 완료로 강등 */
  await card.getByText("NEXT 상태", { exact: true }).click();
  await expect(preview.getByText("당신 차례입니다!")).toHaveCount(0);
  await expect(preview.getByText("참가 신청 완료")).toBeVisible();
  await expect(preview.getByText("#3")).toBeVisible();

  /* 모집 없음 + Extension 숨기기(기본) → 숨김 안내 */
  await card.getByRole("button", { name: "모집 없음", exact: true }).click();
  await expect(preview.getByText("모집이 없어 Extension 이 숨겨진 상태입니다.")).toBeVisible();
  /* 모집 없음 표시로 전환 → no_session 패널 */
  await card.getByRole("button", { name: "모집 없음 표시" }).click();
  await expect(preview.getByText("지금 진행 중인 참가 모집이 없습니다.")).toBeVisible();

  /* Overlay 타입 → 미니 방송 화면 위 위젯 + (모집 중일 때) collapsed pill */
  await card.getByRole("button", { name: "모집 중", exact: true }).click();
  await card.getByText("Video Overlay", { exact: false }).click();
  await expect(preview.locator(".twitch-ext-card__video")).toBeVisible();
  await expect(preview.getByText(/참가 모집 중 · 4명/u)).toBeVisible();
});
