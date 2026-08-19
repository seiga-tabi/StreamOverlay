import { expect, test, type Page, type Route } from "@playwright/test";
import { auditContrast, formatFindings } from "./contrast";

/* 스트리머 추천 게시판 — 목업 docs/mockups/streamer-board.
 *
 * 서버 API 는 아직 handoff 대상이라 여기서 계약대로 mock 합니다. 이 스펙이
 * 지키는 것은 화면 규칙입니다: 게임 표기는 항상 보이고, 전적 줄은 리그 오브
 * 레전드 글에만 붙으며, 채널 주소만 로그인 뒤로 갑니다.
 */

const POST_LOL = {
  id: "bamtol",
  streamerName: "밤톨",
  platform: "twitch",
  live: true,
  games: ["lol"],
  tags: ["칼바람 나락"],
  reason: "정글 동선을 하나하나 설명하면서 플레이합니다.",
  votes: 142,
  commentCount: 2,
  authorName: "쿠키맛젤리",
  createdAt: "2026-08-19T00:00:00.000Z",
  lolProfile: {
    riotId: "밤톨#KR1", tier: "다이아 2", winRate: 57.1, wins: 24, losses: 18,
    recentResults: ["win", "win", "loss", "win", "win"],
  },
};

const POST_PALWORLD = {
  id: "hangyeoul",
  streamerName: "한겨울",
  platform: "chzzk",
  live: false,
  games: ["palworld"],
  tags: [],
  reason: "건축 위주 팰월드 방송입니다.",
  votes: 98,
  commentCount: 0,
  authorName: "눈사람공장",
  createdAt: "2026-08-18T00:00:00.000Z",
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json; charset=utf-8", body: JSON.stringify(body) });
}

async function installFixtures(page: Page, options: { loggedIn?: boolean; failList?: boolean } = {}) {
  const channel = options.loggedIn ? { channelUrl: "https://twitch.tv/bamtol" } : {};
  if (options.loggedIn) {
    /* 계정 세션 — identities 가 없으면 훅이 응답을 버리고 비로그인으로 떨어집니다. */
    await page.route("**/api/account/session*", async (route) => json(route, {
      authenticated: true,
      csrfToken: "test-token",
      authenticationProvider: "twitch",
      identities: [{ provider: "twitch", id: "u1", login: "cookie", displayName: "쿠키맛젤리" }],
    }));
  }
  await page.route("**/api/public/streamers**", async (route) => {
    const url = new URL(route.request().url());
    if (options.failList) {
      await json(route, { error: "unavailable" }, 503);
      return;
    }
    if (/\/api\/public\/streamers\/[^/]+$/u.test(url.pathname)) {
      await json(route, {
        post: { ...POST_LOL, ...channel },
        comments: [
          { id: "c1", anonymous: false, authorName: "사분면", body: "시야 순서 설명이 좋았습니다.", createdAt: "2026-08-19T01:00:00.000Z" },
          { id: "c2", anonymous: true, body: "칼바람도 해설이 촘촘합니다.", createdAt: "2026-08-19T02:00:00.000Z" },
        ],
      });
      return;
    }
    await json(route, {
      total: 2,
      liveCount: 1,
      posts: [{ ...POST_LOL, ...channel }, { ...POST_PALWORLD, ...(options.loggedIn ? { channelUrl: "https://chzzk.naver.com/hangyeoul" } : {}) }],
    });
  });
  await page.route(/^https:\/\/(?!127\.0\.0\.1)/, async (route) => {
    if (route.request().resourceType() === "image") {
      await route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
      return;
    }
    await route.fulfill({ status: 204, body: "" });
  });
}

test("비로그인 목록은 게임 표기를 보여 주고 채널 주소만 가린다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installFixtures(page);
  await page.goto("/ko/streamers");

  await expect(page.getByRole("heading", { level: 1, name: "스트리머 추천" })).toBeVisible();
  /* 게임 표기는 로그인 여부와 무관합니다 — 범위 nav 가 의미를 가지려면 보여야 합니다. */
  await expect(page.getByText("리그 오브 레전드", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("팰월드", { exact: true }).last()).toBeVisible();
  /* 전적 줄은 LoL 글에만. */
  await expect(page.getByText("밤톨#KR1")).toBeVisible();
  await expect(page.getByText("솔로랭크 57.1% · 24승 18패")).toBeVisible();
  /* 채널 주소는 두 글 모두 잠깁니다. */
  await expect(page.getByText("채널 주소 — 로그인 후 공개")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("로그인 상태에서는 채널 주소가 열리고 글쓰기가 살아난다", async ({ page }) => {
  await installFixtures(page, { loggedIn: true });
  await page.goto("/ko/streamers");
  await expect(page.getByText("채널 주소 — 로그인 후 공개")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /twitch\.tv\/bamtol/u })).toBeVisible();
});

test("검색과 필터는 요청 query 로 나간다", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/public/streamers")) requests.push(request.url());
  });
  await installFixtures(page);
  await page.goto("/ko/streamers");
  await expect(page.getByRole("heading", { level: 2, name: "밤톨" })).toBeVisible();

  await page.getByRole("button", { name: "LIVE만" }).click();
  await expect.poll(() => requests.some((url) => url.includes("live=true"))).toBe(true);

  await page.getByPlaceholder("스트리머 이름이나 추천 이유로 검색").fill("정글");
  await expect.poll(() => requests.some((url) => url.includes("q=%EC%A0%95%EA%B8%80"))).toBe(true);
});

test("게임 범위 nav 는 query 를 바꾸고 목록을 좁힌다", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/public/streamers")) requests.push(request.url());
  });
  await installFixtures(page);
  await page.goto("/ko/streamers");
  await page.getByTestId("streamers-secondary-nav").getByRole("button", { name: "팰월드" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("game")).toBe("palworld");
  await expect.poll(() => requests.some((url) => url.includes("game=palworld"))).toBe(true);
});

test("상세는 전적 프로필과 댓글을 보여 주고 익명 댓글을 구분한다", async ({ page }) => {
  await installFixtures(page, { loggedIn: true });
  await page.goto("/ko/streamers/bamtol");
  await expect(page.getByRole("heading", { level: 1, name: "밤톨" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "전적 프로필" })).toBeVisible();
  await expect(page.getByText("사분면")).toBeVisible();
  /* 익명 댓글은 이름 없이 익명 표기로만 나옵니다. */
  await expect(page.getByText("익명").first()).toBeVisible();
});

test("목록을 불러오지 못하면 오류 화면과 재시도를 낸다", async ({ page }) => {
  await installFixtures(page, { failList: true });
  await page.goto("/ko/streamers");
  await expect(page.getByRole("alert")).toContainText("추천 글을 불러오지 못했습니다.");
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
});

test("알 수 없는 하위 경로는 404 화면으로 닫는다", async ({ page }) => {
  await installFixtures(page);
  await page.goto("/ko/streamers/bam/tol");
  await expect(page.getByRole("alert")).toContainText("찾을 수 없는 페이지입니다.");
});

test("일본어 경로는 ja 문구로 나온다", async ({ page }) => {
  await installFixtures(page);
  await page.goto("/ja/streamers");
  await expect(page.getByRole("heading", { level: 1, name: "配信者おすすめ" })).toBeVisible();
  await expect(page.getByText("チャンネルURL — ログイン後に表示").first()).toBeVisible();
});

test("좁은 화면에서 카드가 넘치지 않는다", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) > 768, "모바일 폭 전용 확인");
  await installFixtures(page);
  await page.goto("/ko/streamers");
  await expect(page.getByRole("heading", { level: 2, name: "밤톨" })).toBeVisible();
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll(".streamers-card, .streamers-filters, .streamers-page__head")]
      .filter((element) => element.getBoundingClientRect().right > width + 1)
      .map((element) => element.className);
  });
  expect(overflow).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("글자는 렌더된 픽셀 기준으로 AA 대비를 지킨다", async ({ page }) => {
  /* 다크 지면 위 카드라 muted 계열이 쉽게 미달합니다 — 화면 픽셀로 잽니다
     (패치 노트 화면과 같은 검사). */
  await installFixtures(page, { loggedIn: true });
  await page.goto("/ko/streamers");
  await expect(page.getByRole("heading", { level: 2, name: "밤톨" })).toBeVisible();
  const audit = await auditContrast(page, ".streamers-page-section");
  expect(formatFindings(audit.failures)).toEqual([]);
});

test("주력 게임 칩은 한 줄짜리 칩으로 그려지고 고른 것만 강조된다", async ({ page }) => {
  /* 폼의 광범위 선택자(.streamers-form label · input)가 칩과 그 안의 체크박스를
     덮어써서, 칩이 세로 블록(126×81)이 되고 체크박스가 입력 필드(92×48)로
     부풀었던 회귀입니다. 렌더된 크기로 잠급니다. */
  await installFixtures(page, { loggedIn: true });
  await page.goto("/ko/streamers/new");

  const chip = page.locator(".streamers-form__games .streamers-chip").first();
  await expect(chip).toBeVisible();

  const layout = await chip.evaluate((element) => {
    const input = element.querySelector(".streamers-chip__check")!;
    const box = element.getBoundingClientRect();
    const inputBox = input.getBoundingClientRect();
    return {
      display: getComputedStyle(element).display,
      height: Math.round(box.height),
      inputWidth: Math.round(inputBox.width),
      inputHeight: Math.round(inputBox.height),
    };
  });
  expect(layout.display).toBe("flex");
  /* 손가락 목표(44px)는 지키되 세로로 무너지지 않아야 합니다. */
  expect(layout.height).toBeGreaterThanOrEqual(44);
  expect(layout.height).toBeLessThanOrEqual(56);
  expect(layout.inputWidth).toBeLessThanOrEqual(20);
  expect(layout.inputHeight).toBeLessThanOrEqual(20);

  /* 고르기 전에는 중립, 고르면 강조 — 목록 칩과 달리 여기서는 선택이 정보입니다. */
  const tint = () => chip.evaluate((element) => getComputedStyle(element).backgroundColor);
  const before = await tint();
  /* 사용자가 누르는 것은 칩 라벨입니다 — 입력 상자는 접근성용으로 숨겨 둡니다. */
  await chip.click();
  await expect(chip.locator("input")).toBeChecked();
  expect(await tint()).not.toBe(before);
});
