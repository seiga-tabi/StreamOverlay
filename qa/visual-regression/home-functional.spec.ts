import { expect, test, type Page, type Route } from "@playwright/test";
import { auditContrast, formatFindings } from "./contrast";

/* 루트 홈(yoro.gg/) — 목업 캔버스 "YORO 홈 리디자인" v8.
 *
 * 이 스펙이 지키는 것: 홈은 검색이 먼저 뜨고, 데이터 섹션이 실패해도 검색은 살아
 * 있으며, 다크·라이트 양쪽에서 글자가 읽히고, 좁은 화면에서 가로로 넘치지 않는다.
 *
 * 대비를 렌더된 픽셀로 재는 이유: 이 화면은 다크가 기본이고 muted 계열 글자가
 * 많아 토큰만 봐서는 미달을 못 잡습니다(패치 노트·스트리머 화면과 같은 검사).
 */

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json; charset=utf-8", body: JSON.stringify(body) });
}

/** 홈이 쓰는 기존 공개 API 계약만 흉내 냅니다 — 신규 endpoint 는 없습니다. */
async function installFixtures(page: Page, options: { live?: boolean; dataDown?: boolean } = {}) {
  await page.route("**/api/public/twitch/status*", async (route) => json(route, options.live
    ? {
      connected: true,
      configured: true,
      requiredScopes: [],
      missingScopes: [],
      user: { id: "v1", login: "cookie", displayName: "쿠키맛젤리" },
    }
    : { connected: false, configured: true, requiredScopes: [], missingScopes: [] }));

  /* 응답 형태는 팰월드 스펙이 쓰는 것과 같습니다(parsePublicTwitchFollowed 계약). */
  const liveChannels = [{
    twitchUserId: "55",
    twitchLogin: "bamtol",
    twitchDisplayName: "밤톨",
    profileImageUrl: "/images/yorogg-mark.png",
    followedAt: "2026-08-01T00:00:00.000Z",
    isLive: true,
    channelUrl: "https://www.twitch.tv/bamtol",
    gameName: "League of Legends",
    title: "정글 동선 설명하면서 갑니다",
    viewerCount: 1234,
    thumbnailUrl: "https://static-cdn.jtvnw.net/previews-ttv/live_user_bamtol-{width}x{height}.jpg",
  }];
  await page.route("**/api/public/twitch/followed-lol*", async (route) => json(route, {
    connected: options.live === true,
    total: options.live ? liveChannels.length : 0,
    truncated: false,
    matchedCount: options.live ? liveChannels.length : 0,
    subscriptionScopeGranted: true,
    subscriptions: [],
    channels: options.live ? liveChannels : [],
  }));

  await page.route("**/api/public/aram/augments*", async (route) => (options.dataDown
    ? json(route, { error: "unavailable" }, 503)
    : json(route, {
      status: "ready",
      augments: [
        { id: 1, name: "가시 갑옷", rarity: "silver" },
        { id: 2, name: "황금 방패", rarity: "gold" },
        { id: 3, name: "프리즘 방패", rarity: "prismatic" },
      ],
    })));

  await page.route("**/api/palworld/pals*", async (route) => (options.dataDown
    ? json(route, { error: "unavailable" }, 503)
    : json(route, {
      items: [],
      total: 0,
      facets: { elements: [{ value: "fire", count: 42 }, { value: "water", count: 31 }] },
    })));

  /* 외부 이미지는 실제로 받지 않습니다 — 네트워크 없이도 같은 결과가 나와야 합니다. */
  await page.route(/^https:\/\/(?!127\.0\.0\.1)/, async (route) => {
    if (route.request().resourceType() === "image") {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64"
        ),
      });
      return;
    }
    await route.fulfill({ status: 204, body: "" });
  });
}

test("루트는 LoL 홈이 아니라 전용 메인 홈을 그린다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installFixtures(page);
  await page.goto("/ko/");

  await expect(page.locator(".yoro-home-shell")).toBeVisible();
  /* LoL 홈의 껍데기가 여기 섞여 있으면 두 화면이 같은 주소를 다투는 상태입니다. */
  await expect(page.locator(".public-home-shared-shell")).toHaveCount(0);
  await expect(page.locator("main#yoro-home-main")).toBeVisible();
  expect(errors).toEqual([]);
});

test("검색은 게임별로 실제 경로로 보낸다", async ({ page }) => {
  await installFixtures(page);
  await page.goto("/ko/");

  /* 히어로 입력은 type="search" 가 아니라 role 이 textbox 입니다 — 클래스로 잡습니다. */
  const search = page.locator(".yoro-home-search-input");
  await search.fill("밤톨#KR1");
  await search.press("Enter");
  /* 태그를 적었으면 그대로, 안 적었으면 서버 기본 태그가 붙습니다. */
  await expect(page).toHaveURL(/\/lol\/summoners\//u);
});

test("데이터 섹션이 죽어도 검색은 살아 있다", async ({ page }) => {
  /* 홈의 핵심은 검색입니다 — 차트 API 가 흔들려도 같이 넘어가면 안 됩니다. */
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installFixtures(page, { dataDown: true });
  await page.goto("/ko/");

  await expect(page.locator(".yoro-home-search-input")).toBeVisible();
  await expect(page.locator(".yoro-home-shell")).toBeVisible();
  expect(errors).toEqual([]);
});

test("지금 방송 중은 로그인 전과 라이브 상태를 구분해 그린다", async ({ page }) => {
  await installFixtures(page);
  await page.goto("/ko/");
  const liveCards = page.locator(".yoro-home-live-card");
  await expect(liveCards).toHaveCount(0);

  await installFixtures(page, { live: true });
  await page.goto("/ko/");
  await expect(page.getByText("밤톨", { exact: true }).first()).toBeVisible();
});

test("글자는 렌더된 픽셀 기준으로 AA 대비를 지킨다 (다크·라이트)", async ({ page }) => {
  await installFixtures(page, { live: true });
  await page.goto("/ko/");
  await expect(page.locator(".yoro-home-shell")).toBeVisible();

  const dark = await auditContrast(page, ".yoro-home-shell");
  expect(formatFindings(dark.failures)).toEqual([]);

  /* 라이트도 같은 기준입니다 — 백자 지면 위 옅은 먹빛이 쉽게 미달합니다. */
  await page.evaluate(() => {
    document.documentElement.dataset.publicTheme = "light";
    document.querySelector(".yoro-home-shell")?.classList.replace("theme-dark", "theme-light");
  });
  const light = await auditContrast(page, ".yoro-home-shell");
  expect(formatFindings(light.failures)).toEqual([]);
});

test("좁은 화면에서 가로로 넘치지 않는다", async ({ page }) => {
  await installFixtures(page, { live: true });
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/ko/");
    await expect(page.locator(".yoro-home-shell")).toBeVisible();
    /* 실제 증상은 "페이지가 옆으로 스크롤된다" 입니다. 붓 마크는 일부러 밖으로
       흘러나가되 잘려야 하고(clip), clip 은 getBoundingClientRect 를 바꾸지 않으므로
       요소 사각형이 아니라 문서 폭으로 잽니다. */
    const scroll = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scroll.scrollWidth, `width=${width}`).toBeLessThanOrEqual(scroll.clientWidth);

    /* 손이 닿는 것(글자·버튼·링크)은 잘리면 안 됩니다 — 장식만 흘러나갑니다. */
    const clipped = await page.evaluate(() => {
      const limit = document.documentElement.clientWidth;
      return [...document.querySelectorAll(".yoro-home-shell a, .yoro-home-shell button, .yoro-home-shell input")]
        .filter((element) => element.getBoundingClientRect().right > limit + 1)
        .map((element) => `${element.tagName.toLowerCase()}.${element.getAttribute("class") ?? ""}`)
        .slice(0, 5);
    });
    expect(clipped, `width=${width}`).toEqual([]);
  }
});

test("일본어와 영어 경로는 각 언어로 그린다", async ({ page }) => {
  await installFixtures(page);
  await page.goto("/ja/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");

  /* /en 은 서버도 영어로 서빙합니다(canonical·hreflang 포함) — 화면만 영어면
     크롤러가 한국어의 중복으로 보고 색인에서 뺍니다. */
  await page.goto("/en/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
