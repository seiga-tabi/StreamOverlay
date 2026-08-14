import { expect, test } from "@playwright/test";

/* 발로란트 공개 페이지 — 준비 단계 셸의 기능 검증.
   데이터 화면은 /api/valorant/* contract 이후라 여기서는 라우팅·i18n·
   정직한 준비 중 상태·외부 origin 0·overflow 를 검증합니다. */

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
  /* 앱 전역 gtag.js 는 consent denied 로도 로드되고 드물게 샘플링 진단 beacon
     (googletagmanager.com/a)을 이미지 요청으로 쏩니다 — "외부 origin 요청 0" 검사의
     간헐 실패 원인이라 빈 JS 로 대체합니다(abort 는 콘솔 오류 0 단언을 깨뜨립니다). GA 동작은 전용 consent 스펙이 검증합니다. */
  await page.route("https://www.googletagmanager.com/**", (route) => route.fulfill({
    contentType: "application/javascript; charset=utf-8",
    body: "/* gtag stubbed in tests */",
  }));
});

test("발로란트 홈은 정책 3단 모델을 렌더하고 외부 origin 요청과 가로 overflow가 없다", async ({ page }) => {
  /* 이미지·폰트·미디어는 로컬 자산만 씁니다(gtag 스크립트는 consent mode 로 별도 관리). */
  const externalAssets: string[] = [];
  page.on("request", (request) => {
    if (!["image", "font", "media"].includes(request.resourceType())) return;
    if (!request.url().startsWith("http://127.0.0.1")) externalAssets.push(request.url());
  });
  await page.goto("/valorant");
  await expect(page.getByRole("heading", { name: "스트리머 전적부터 요원 데이터까지" })).toBeVisible();
  await expect(page.getByText("준비 중 — Riot 프로덕션 승인 진행 단계")).toBeVisible();
  await expect(page.getByRole("heading", { name: "스트리머 전적", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "내 전적", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "경쟁전 리더보드", exact: true })).toBeVisible();
  await expect(page.getByText(/본인이 동의\(RSO\)한 계정의 전적만 공개/u)).toBeVisible();
  expect(externalAssets).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  /* 셸이 상속시키는 밝은 제목색이 밝은 카드 배경과 겹쳤던 회귀(2026-08-10) 방지 —
     주요 텍스트는 실제 배경 대비 AA(4.5:1) 이상이어야 합니다. */
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
      ".valorant-hero__title",
      ".valorant-hero > p",
      ".valorant-model-card > h3",
      ".valorant-model-card > p",
      ".valorant-policy-note",
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

test("발로란트 메뉴는 준비 중 화면과 홈 복귀·404·직접 URL을 지원한다", async ({ page }) => {
  await page.goto("/valorant");
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 768;
  const nav = isMobile
    ? page.getByTestId("valorant-bottom-tab-bar")
    : page.getByTestId("valorant-secondary-nav");
  await expect(nav.getByRole("button", { name: "홈" })).toHaveAttribute("aria-current", "page");
  /* 모바일은 하단 탭바 단일 nav — 상단 가로 nav 와 이중 표시 금지(2026-08-15 결함 회귀 방지) */
  if (isMobile) await expect(page.getByTestId("valorant-secondary-nav")).toBeHidden();
  else await expect(page.getByTestId("valorant-bottom-tab-bar")).toBeHidden();

  await nav.getByRole("button", { name: "요원" }).click();
  await expect(page).toHaveURL(/\/valorant\/agents$/u);
  await expect(page.getByText("요원 도감을 준비하고 있습니다")).toBeVisible();
  await expect(nav.getByRole("button", { name: "요원" })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("button", { name: "랭킹" }).click();
  await expect(page).toHaveURL(/\/valorant\/ranked$/u);
  await expect(page.getByText(/익명으로 표시됩니다/u)).toBeVisible();

  await page.getByRole("button", { name: "발로란트 홈으로" }).click();
  await expect(page).toHaveURL(/\/valorant$/u);
  await expect(page.getByRole("heading", { name: "스트리머 전적부터 요원 데이터까지" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/valorant\/ranked$/u);
  await expect(page.getByText("경쟁전 리더보드를 준비하고 있습니다")).toBeVisible();

  await page.goto("/valorant/weapons");
  await expect(page.getByText("무기 정보를 준비하고 있습니다")).toBeVisible();
  await page.goto("/valorant/agents/jett");
  await expect(page.getByText("페이지를 찾을 수 없습니다.")).toBeVisible();
});

test("발로란트 일본어 경로는 ja 문구와 canonical을 유지한다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("loltrace.locale", "ja");
  });
  await page.goto("/ja/valorant");
  await expect(page.getByRole("heading", { name: "配信者の戦績からエージェントデータまで" })).toBeVisible();
  await expect(page.getByText(/本人が同意\(RSO\)したアカウントの戦績のみ公開/u)).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://yoro.gg/ja/valorant",
  );
  await page.goto("/ja/valorant/maps");
  await expect(page.getByText("マップ情報を準備しています")).toBeVisible();
});

test("게임 선택기에서 발로란트로 이동하고 다시 다른 게임으로 돌아온다", async ({ page }) => {
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 768;
  test.skip(isMobile, "모바일은 통합 메뉴 시트 경로를 쓰므로 데스크톱 드롭다운만 검증합니다.");
  await page.goto("/palworld");
  await page.getByRole("button", { name: "게임 메뉴" }).click();
  await page.getByRole("option", { name: "발로란트 선택" }).click();
  await expect(page).toHaveURL(/\/valorant$/u);
  await expect(page.getByRole("heading", { name: "스트리머 전적부터 요원 데이터까지" })).toBeVisible();
  await page.getByRole("button", { name: "게임 메뉴" }).click();
  await page.getByRole("option", { name: "Palworld 선택" }).click();
  await expect(page).toHaveURL(/\/palworld$/u);
});
