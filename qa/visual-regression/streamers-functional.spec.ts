import { expect, test, type Page, type Route } from "@playwright/test";
import { auditContrast, formatFindings } from "./contrast";

/* 스트리머 추천 게시판 — 목업 docs/mockups/streamer-board.
 *
 * 서버 API 는 아직 handoff 대상이라 여기서 계약대로 mock 합니다. 이 스펙이
 * 지키는 것은 화면 규칙입니다: 게임 표기는 항상 보이고, 전적 줄은 리그 오브
 * 레전드 글에만 붙으며, 채널 주소만 로그인 뒤로 갑니다.
 */

/* 글 id → 정규화된 채널 키. 서버가 중복을 판정하는 기준을 여기서 흉내 냅니다. */
const CHANNEL_KEYS: Record<string, string> = { bamtol: "twitch:bamtol", hangyeoul: "chzzk:hangyeoul" };

const POST_LOL = {
  id: "bamtol",
  streamerName: "밤톨",
  platform: "twitch",
  live: true,
  games: ["lol"],
  tags: ["칼바람 나락"],
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
  votes: 98,
  commentCount: 0,
  authorName: "눈사람공장",
  createdAt: "2026-08-18T00:00:00.000Z",
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json; charset=utf-8", body: JSON.stringify(body) });
}

async function installFixtures(page: Page, options: { loggedIn?: boolean; viewerOnly?: boolean; failList?: boolean; duplicateOnPost?: boolean } = {}) {
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
  if (options.viewerOnly) {
    /* 공개 Twitch 뷰어 세션만 있는 상태 — LoL 화면에서 로그인한 사람이 이 경우입니다. */
    await page.route("**/api/account/session*", async (route) => json(route, { authenticated: false, identities: [] }));
    await page.route("**/api/public/twitch/status*", async (route) => json(route, {
      connected: true,
      configured: true,
      requiredScopes: [],
      missingScopes: [],
      user: { id: "v1", login: "cookie", displayName: "쿠키맛젤리" },
    }));
  }
  await page.route("**/api/public/streamers**", async (route) => {
    const url = new URL(route.request().url());
    if (options.failList) {
      await json(route, { error: "unavailable" }, 503);
      return;
    }
    if (route.request().method() === "POST" && url.pathname.endsWith("/api/public/streamers")) {
      if (options.duplicateOnPost) {
        await json(route, { error: "duplicate_channel", existing: { postId: "bamtol", streamerName: "밤톨" } }, 409);
        return;
      }
      await json(route, { ok: true }, 201);
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
    const posts = [
      { ...POST_LOL, ...channel },
      { ...POST_PALWORLD, ...(options.loggedIn ? { channelUrl: "https://chzzk.naver.com/hangyeoul" } : {}) },
    ];
    /* 채널 조회는 서버가 정규화 키로 거릅니다 — 목록 전체를 돌려주면 안 됩니다. */
    const channelKey = url.searchParams.get("channel");
    const visible = channelKey ? posts.filter((post) => CHANNEL_KEYS[post.id] === channelKey) : posts;
    await json(route, {
      total: visible.length,
      liveCount: visible.filter((post) => post.live).length,
      posts: visible,
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

  await page.getByPlaceholder("스트리머 이름이나 태그로 검색").fill("정글");
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

test("공개 Twitch 뷰어 세션만 있어도 글쓰기가 열린다", async ({ page }) => {
  /* 공개 페이지의 로그인 상태는 계정 세션과 뷰어 세션 둘입니다. 계정 세션만 보면
     LoL 화면에서 로그인한 사람이 여기서만 "로그인이 필요합니다" 를 만납니다(실사례). */
  await installFixtures(page, { viewerOnly: true });
  await page.goto("/ko/streamers/new");
  await expect(page.locator(".streamers-form")).toBeVisible();
  await expect(page.getByText("추천 글은 로그인 후에 쓸 수 있습니다.")).toHaveCount(0);
});

test("비로그인은 글쓰기가 잠긴 채로 남는다", async ({ page }) => {
  await installFixtures(page);
  await page.goto("/ko/streamers/new");
  await expect(page.getByText("추천 글은 로그인 후에 쓸 수 있습니다.")).toBeVisible();
  await expect(page.locator(".streamers-form")).toHaveCount(0);
});

/* ── 한 채널은 글 하나 ─────────────────────────────────────────
 * 같은 채널이 여러 글로 갈라지면 목록이 같은 이름으로 중복되고 추천 수도 흩어집니다.
 * 미리 조회가 먼저 알려 주고, 최종 판정은 등록 요청(409)이 합니다. */

async function fillCompose(page: Page, channelUrl: string) {
  await page.goto("/ko/streamers/new");
  await page.getByLabel("스트리머 이름").fill("밤톨");
  await page.getByLabel("채널 주소").fill(channelUrl);
  await page.locator('.streamers-form__games .streamers-chip[data-game="lol"]').click();
}

test("이미 등록된 채널은 미리 알려 주고 등록을 막는다", async ({ page }) => {
  await installFixtures(page, { loggedIn: true });
  /* 목록의 글은 https://twitch.tv/bamtol 입니다 — 대소문자·www·끝 슬래시가 달라도 같은 채널입니다. */
  await fillCompose(page, "https://www.twitch.tv/BamTol/");

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("밤톨 채널은 이미 등록돼 있습니다.");
  await expect(alert.getByRole("link", { name: "등록된 글 보기" })).toHaveAttribute("href", "/ko/streamers/bamtol");
  await expect(page.getByRole("button", { name: "등록" })).toBeDisabled();
});

test("등록되지 않은 채널은 그대로 열려 있고 추천 이유를 묻지 않는다", async ({ page }) => {
  await installFixtures(page, { loggedIn: true });
  await fillCompose(page, "https://twitch.tv/saebyeok");

  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "등록" })).toBeEnabled();
  /* 같은 채널을 여러 사람이 추천하므로 개인의 추천 이유는 글에 두지 않습니다. */
  await expect(page.getByText("추천 이유")).toHaveCount(0);
  await expect(page.locator(".streamers-form textarea")).toHaveCount(0);
});

test("미리 조회가 놓쳐도 서버가 중복을 잡으면 그 글로 안내한다", async ({ page }) => {
  /* 두 사람이 동시에 같은 채널을 올리는 경우 — 조회 시점에는 없고 등록 시점에는 있습니다. */
  await installFixtures(page, { loggedIn: true, duplicateOnPost: true });
  await fillCompose(page, "https://twitch.tv/saebyeok");
  await page.getByRole("button", { name: "등록" }).click();

  await expect(page.getByRole("alert")).toContainText("밤톨 채널은 이미 등록돼 있습니다.");
  await expect(page).toHaveURL(/\/ko\/streamers\/new$/u);
  await expect(page.getByRole("button", { name: "등록" })).toBeDisabled();
});

/* ── 링크는 로케일을 지킨다 ────────────────────────────────────
 * href 는 새 탭·링크 복사·크롤러가 그대로 씁니다. 로케일이 빠지면 일본어로 보던
 * 사람이 보낸 링크가 받는 쪽에서 한국어로 열립니다. */

test("일본어 화면의 글 링크와 공유 주소는 ja 를 유지한다", async ({ page }) => {
  await installFixtures(page, { loggedIn: true });
  await page.goto("/ja/streamers");

  const card = page.locator(".streamers-card a").first();
  await expect(card).toHaveAttribute("href", "/ja/streamers/bamtol");
  await card.click();
  await expect(page).toHaveURL(/\/ja\/streamers\/bamtol$/u);

  /* canonical 은 목록이 아니라 이 글이어야 합니다. */
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://yoro.gg/ja/streamers/bamtol",
  );
  /* X 로 나가는 주소도 마찬가지입니다 — 받는 사람이 일본어로 열어야 합니다. */
  await page.getByRole("button", { name: "共有" }).click();
  const share = page.locator('a[href^="https://x.com/intent/post"]');
  /* origin 은 실행 환경(127.0.0.1)이라 보지 않고, 경로가 ja 를 지키는지만 봅니다. */
  await expect(share).toHaveAttribute("href", /url=[^&]*%2Fja%2Fstreamers%2Fbamtol(&|$)/u);
});

test("일본어 화면의 중복 안내 링크도 ja 를 유지한다", async ({ page }) => {
  await installFixtures(page, { loggedIn: true });
  await page.goto("/ja/streamers/new");
  await page.getByLabel("配信者名").fill("밤톨");
  await page.getByLabel("チャンネルURL").fill("https://www.twitch.tv/BamTol/");

  const alert = page.getByRole("alert");
  await expect(alert).toContainText("すでに登録されています");
  await expect(alert.getByRole("link")).toHaveAttribute("href", "/ja/streamers/bamtol");
});
