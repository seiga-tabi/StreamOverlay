import { expect, test } from "@playwright/test";

/* 마인크래프트 공개 페이지 — 준비 단계 셸(위키 메인)의 기능 검증.
   데이터 화면은 /api/minecraft/* 카탈로그 contract 이후라 여기서는 라우팅·i18n·
   정직한 준비 중 상태·외부 origin 0·overflow·대비를 검증합니다. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("loltrace.locale", "ko");
    window.localStorage.setItem("yoro.google.consent.v1", "denied");
    window.localStorage.removeItem("preferredGame");
  });
  await page.route("**/dashboard/config.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: "window.__STREAMOPS_CONFIG__ = { apiBase: window.location.origin };",
    });
  });
});

test("위키 홈은 구성 소개와 비공식 고지를 렌더하고 외부 origin 요청·가로 overflow가 없다", async ({ page }) => {
  const externalAssets: string[] = [];
  page.on("request", (request) => {
    if (!["image", "font", "media"].includes(request.resourceType())) return;
    if (!request.url().startsWith("http://127.0.0.1")) externalAssets.push(request.url());
  });
  await page.goto("/minecraft");
  await expect(page.getByRole("heading", { name: "무엇이든 찾는 마인크래프트 위키" })).toBeVisible();
  await expect(page.getByText("준비 중 — 카탈로그 파이프라인 연결 단계")).toBeVisible();
  await expect(page.getByRole("heading", { name: "조합법", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "아이템 · 도구", exact: true })).toBeVisible();
  await expect(page.getByText(/Mojang Synergies AB 의 상표/u)).toBeVisible();
  expect(externalAssets).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  /* 주요 텍스트 대비 AA(4.5:1) — 발로란트 2026-08-10 대비 회귀 방지와 같은 계약. */
  const contrasts = await page.evaluate(() => {
    const luminance = (channel: number[]) => {
      const [r, g, b] = channel.map((value) => {
        value /= 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const parse = (color: string) => (color.match(/[\d.]+/gu) ?? []).slice(0, 3).map(Number);
    const backgroundOf = (element: Element | null) => {
      for (let node = element; node; node = node.parentElement) {
        const background = getComputedStyle(node).backgroundColor;
        if (background && background !== "rgba(0, 0, 0, 0)") return background;
      }
      return "rgb(128, 128, 128)";
    };
    return [
      ".minecraft-hero__title",
      ".minecraft-hero > p",
      ".minecraft-category-card > h3",
      ".minecraft-category-card > p",
      ".minecraft-unofficial-note",
    ].map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, ratio: 0 };
      const text = luminance(parse(getComputedStyle(element).color));
      const surface = luminance(parse(backgroundOf(element)));
      return {
        selector,
        ratio: (Math.max(text, surface) + 0.05) / (Math.min(text, surface) + 0.05),
      };
    });
  });
  for (const entry of contrasts) {
    expect(entry.ratio, entry.selector).toBeGreaterThanOrEqual(4.5);
  }
});

test("마인크래프트 메뉴는 준비 중 화면과 홈 복귀·404·직접 URL을 지원한다", async ({ page }) => {
  await page.goto("/minecraft");
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 768;
  const nav = isMobile
    ? page.getByTestId("minecraft-bottom-tab-bar")
    : page.getByTestId("minecraft-secondary-nav");
  await expect(nav.getByRole("button", { name: "위키" })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("button", { name: "조합법" }).click();
  await expect(page).toHaveURL(/\/minecraft\/recipes$/u);
  await expect(page.getByText("조합법 위키를 준비하고 있습니다")).toBeVisible();
  await expect(nav.getByRole("button", { name: "조합법" })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("button", { name: "자료실" }).click();
  await expect(page).toHaveURL(/\/minecraft\/library$/u);
  await expect(page.getByText(/파일은 호스팅하지 않고 공식 출처로만/u)).toBeVisible();

  await page.getByRole("button", { name: "위키 홈으로" }).click();
  await expect(page).toHaveURL(/\/minecraft$/u);
  await expect(page.getByRole("heading", { name: "무엇이든 찾는 마인크래프트 위키" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/minecraft\/library$/u);

  await page.goto("/minecraft/patch-notes");
  await expect(page.getByText("패치 노트를 준비하고 있습니다")).toBeVisible();
  await page.goto("/minecraft/recipes/diamond-sword");
  await expect(page.getByText("페이지를 찾을 수 없습니다.")).toBeVisible();
});

test("마인크래프트 일본어 경로는 ja 문구와 canonical을 유지한다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("loltrace.locale", "ja");
  });
  await page.goto("/ja/minecraft");
  await expect(page.getByRole("heading", { name: "なんでも探せるマインクラフト Wiki" })).toBeVisible();
  await expect(page.getByText(/Mojang Synergies AB の商標/u)).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://yoro.gg/ja/minecraft",
  );
  await page.goto("/ja/minecraft/enchants");
  await expect(page.getByText("エンチャント Wiki を準備しています")).toBeVisible();
});

test("게임 선택기에서 마인크래프트로 이동하고 다시 다른 게임으로 돌아온다", async ({ page }) => {
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 768;
  test.skip(isMobile, "모바일은 통합 메뉴 시트 경로를 쓰므로 데스크톱 드롭다운만 검증합니다.");
  await page.goto("/palworld");
  await page.getByRole("button", { name: "게임 메뉴" }).click();
  await page.getByRole("option", { name: "마인크래프트 선택" }).click();
  await expect(page).toHaveURL(/\/minecraft$/u);
  await expect(page.getByRole("heading", { name: "무엇이든 찾는 마인크래프트 위키" })).toBeVisible();
  await page.getByRole("button", { name: "게임 메뉴" }).click();
  await page.getByRole("option", { name: "Palworld 선택" }).click();
  await expect(page).toHaveURL(/\/palworld$/u);
});
