import { expect, test, type Page } from "@playwright/test";

/* 마인크래프트 공개 페이지 — 위키 셸 + 2단계 카탈로그(조합법·아이템·인챈트) 기능 검증.
   카탈로그 응답은 shared strict validator(packages/shared/src/minecraft.ts)를 그대로
   통과하는 mock 픽스처로 제공합니다 — pagination 수식·metadata 필드가 조금이라도
   어긋나면 클라이언트가 오류 화면을 그리므로 픽스처 자체가 계약 회귀 테스트입니다. */

const SOURCE_REVISION = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const TEST_TEXTURE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X2n44wAAAABJRU5ErkJggg==",
  "base64",
);

type LocalizedName = {
  en: string;
  ko: string;
  ja: string;
  status: { ko: "source_provided" | "source_language_fallback"; ja: "source_provided" | "source_language_fallback" };
};

/* ko/ja 번역이 없으면 validator 규칙대로 en 원문 + source_language_fallback 로 만듭니다. */
function localized(en: string, ko?: string, ja?: string): LocalizedName {
  return {
    en,
    ko: ko ?? en,
    ja: ja ?? en,
    status: {
      ko: ko ? "source_provided" : "source_language_fallback",
      ja: ja ? "source_provided" : "source_language_fallback",
    },
  };
}

function reference(id: string, en: string, ko?: string, ja?: string) {
  return { id, name: localized(en, ko, ja) };
}

const FIXTURE_ITEMS = [
  {
    id: "diamond_sword",
    numericId: 1,
    name: localized("Diamond Sword", "다이아몬드 검", "ダイヤモンドの剣"),
    stackSize: 1,
    maxDurability: 1561,
    enchantCategoryIds: ["weapon"],
  },
  ...Array.from({ length: 59 }, (_, index) => ({
    id: `fixture_item_${index}`,
    numericId: index + 2,
    name: localized(`Fixture Item ${index}`),
    stackSize: 64,
    enchantCategoryIds: [],
  })),
];

const FIXTURE_RECIPES = [
  {
    id: "diamond_sword",
    type: "crafting",
    result: { item: reference("diamond_sword", "Diamond Sword", "다이아몬드 검", "ダイヤモンドの剣"), count: 1 },
    ingredients: [
      { item: reference("diamond", "Diamond", "다이아몬드", "ダイヤモンド"), count: 2 },
      { item: reference("stick", "Stick", "막대기", "棒"), count: 1 },
    ],
    /* 3×1 최소 shape — 클라이언트가 제작대와 같은 3×3(9슬롯)로 정규화하는지 검증합니다. */
    shape: [
      [reference("diamond", "Diamond", "다이아몬드", "ダイヤモンド")],
      [reference("diamond", "Diamond", "다이아몬드", "ダイヤモンド")],
      [reference("stick", "Stick", "막대기", "棒")],
    ],
  },
  {
    id: "mossy_cobblestone",
    type: "crafting",
    result: { item: reference("mossy_cobblestone", "Mossy Cobblestone"), count: 1 },
    ingredients: [
      { item: reference("cobblestone", "Cobblestone", "조약돌", "丸石"), count: 1 },
      { item: reference("vine", "Vine"), count: 1 },
    ],
  },
];

const FIXTURE_ENCHANTS = [
  {
    id: "sharpness",
    numericId: 1,
    name: localized("Sharpness", "날카로움", "ダメージ増加"),
    maxLevel: 5,
    minCost: { a: 11, b: 1 },
    maxCost: { a: 11, b: 21 },
    treasureOnly: false,
    curse: false,
    categoryId: "weapon",
    weight: 10,
    tradeable: true,
    discoverable: true,
    incompatibleIds: ["smite", "bane_of_arthropods"],
  },
  {
    id: "binding_curse",
    numericId: 2,
    name: localized("Curse of Binding"),
    maxLevel: 1,
    minCost: { a: 25, b: 0 },
    maxCost: { a: 50, b: 0 },
    treasureOnly: true,
    curse: true,
    categoryId: "wearable",
    weight: 1,
    tradeable: false,
    discoverable: true,
    incompatibleIds: [],
  },
];

const FIXTURE_METADATA = {
  schemaVersion: 1,
  gameVersion: "1.21.11",
  sourceName: "minecraft-data",
  sourceUrl: "https://github.com/PrismarineJS/minecraft-data",
  sourcePackageVersion: "3.90.0",
  sourceRevision: SOURCE_REVISION,
  generatedAt: "2026-08-12T00:00:00.000Z",
  license: "MIT",
  coverage: {
    items: FIXTURE_ITEMS.length,
    recipes: FIXTURE_RECIPES.length,
    enchants: FIXTURE_ENCHANTS.length,
    excludedRecipes: 0,
    localizedItemNamesKo: 1,
    localizedItemNamesJa: 1,
    localizedEnchantNamesKo: 1,
    localizedEnchantNamesJa: 1,
    recipeTypes: {
      crafting: "ready",
      smelting: "not_provided_by_source",
      brewing: "not_provided_by_source",
      smithing: "not_provided_by_source",
      stonecutting: "not_provided_by_source",
    },
  },
};

/* 서버와 같은 방식으로 q·page·limit 를 해석해 pagination 수식을 항상 만족시킵니다. */
function catalogPayload(url: URL, source: ReadonlyArray<{ id: string; name?: LocalizedName; result?: { item: { name: LocalizedName } } }>) {
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const page = Number(url.searchParams.get("page") ?? "1");
  const limit = Number(url.searchParams.get("limit") ?? "50");
  const filtered = q
    ? source.filter((entry) => {
        const name = entry.name ?? entry.result?.item.name;
        return entry.id.includes(q)
          || name?.en.toLowerCase().includes(q)
          || name?.ko.toLowerCase().includes(q)
          || name?.ja.toLowerCase().includes(q);
      })
    : source;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const items = filtered.slice((page - 1) * limit, page * limit);
  return {
    state: "ready",
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      returned: items.length,
      hasNextPage: page < totalPages,
    },
    metadata: FIXTURE_METADATA,
  };
}

async function mockMinecraftCatalog(page: Page): Promise<void> {
  await page.route(/\/api\/minecraft\/(items|recipes|enchants)/u, async (route) => {
    const url = new URL(route.request().url());
    const source = url.pathname.endsWith("/items")
      ? FIXTURE_ITEMS
      : url.pathname.endsWith("/recipes")
        ? FIXTURE_RECIPES
        : FIXTURE_ENCHANTS;
    await route.fulfill({ json: catalogPayload(url, source) });
  });
}

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
  /* 실제 텍스처 CDN에 테스트가 의존하지 않도록 같은 origin 계약만 유지한 1px PNG로 대체합니다. */
  await page.route("https://assets.mcasset.cloud/**", async (route) => {
    await route.fulfill({ body: TEST_TEXTURE_PNG, contentType: "image/png", status: 200 });
  });
});

test("위키 홈은 구성 소개와 비공식 고지를 렌더하고 외부 origin 요청·가로 overflow가 없다", async ({ page }) => {
  const externalAssets: string[] = [];
  page.on("request", (request) => {
    if (!["image", "font", "media"].includes(request.resourceType())) return;
    const url = request.url();
    /* 텍스처는 버전 고정 allowlist CDN(MinecraftItemImage)만 허용 — 그 외 외부 origin 은 0 */
    if (url.startsWith("http://127.0.0.1") || url.startsWith("https://assets.mcasset.cloud/")) return;
    externalAssets.push(url);
  });
  /* 카탈로그 API 실패 시나리오 — 홈은 준비 중 문구를 유지해야 합니다(가짜 수치 금지). */
  await page.route(/\/api\/minecraft\//u, async (route) => {
    await route.fulfill({ status: 503, json: { error: "unavailable" } });
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

  /* lazy 라우트 chunk 의 CSS link 는 렌더보다 늦게 적용될 수 있어,
     computed color 를 읽기 전에 페이지 스타일 적용을 먼저 기다립니다. */
  await expect(page.locator(".minecraft-page-section")).toHaveCSS(
    "background-color",
    "rgb(15, 23, 36)",
  );

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
      ".minecraft-core-card h3",
      ".minecraft-core-card > p",
      ".minecraft-aux-card__copy > strong",
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

test("위키 홈은 카탈로그 metadata 로 실제 수치를 보여 주고 카테고리 카드로 이동한다", async ({ page }) => {
  await mockMinecraftCatalog(page);
  await page.goto("/minecraft");
  await expect(page.getByTestId("minecraft-home-stats")).toHaveText(
    "Java 1.21.11 · minecraft-data (MIT) 기준",
  );
  /* 실카운트는 코어 카드에 배분 — fixture coverage: 아이템 60 · 조합법 2 · 인챈트 2 */
  const itemsCard = page.getByRole("link", { name: /아이템 · 도구/u });
  await expect(itemsCard.locator(".minecraft-core-card__count")).toHaveText("60개");
  await expect(page.getByRole("link", { name: /^조합법/u }).locator(".minecraft-core-card__count")).toHaveText("2개");
  await expect(page.getByRole("link", { name: /^인챈트/u }).locator(".minecraft-core-card__count")).toHaveText("2종");
  /* 준비 중 기능은 클릭 전에 배지로 보임 */
  await expect(page.getByRole("link", { name: /자료실/u }).getByText("준비 중")).toBeVisible();

  /* 본문 컨테이너 — 발로란트와 같은 78rem 중앙 규격(전폭 회귀 방지) */
  const section = await page.locator(".minecraft-page-section").boundingBox();
  const viewport = page.viewportSize();
  if (section && viewport) {
    expect(section.width).toBeLessThanOrEqual(78 * 16 + 1);
    if (viewport.width > 78 * 16) {
      expect(section.x).toBeGreaterThan(16);
      expect(Math.abs(section.x - (viewport.width - section.x - section.width))).toBeLessThanOrEqual(2);
    }
  }
  await itemsCard.click();
  await expect(page).toHaveURL(/\/minecraft\/items$/u);
  await expect(page.getByRole("heading", { name: "아이템", exact: true })).toBeVisible();
});

test("홈 검색은 스코프에 맞는 카탈로그 페이지의 ?q= 로 이동하고 초기 검색어가 적용된다", async ({ page }) => {
  await mockMinecraftCatalog(page);
  await page.goto("/minecraft");
  const search = page.getByRole("search", { name: "카탈로그 검색" }).getByRole("searchbox");
  await search.fill("다이아몬드 검");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page).toHaveURL(/\/minecraft\/recipes\?q=/u);
  await expect(page.getByTestId("minecraft-recipe-card")).toHaveCount(1);
  await expect(page.getByText("1개", { exact: true })).toBeVisible();

  /* 스코프 칩 전환 — 아이템 대상 검색 */
  await page.goBack();
  await page.getByRole("group", { name: "검색 대상" }).getByRole("button", { name: "아이템", exact: true }).click();
  await search.fill("다이아몬드 검");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page).toHaveURL(/\/minecraft\/items\?q=/u);
  await expect(page.getByTestId("minecraft-item-row")).toHaveCount(1);
});

test("조합법 페이지는 3×3 그리드·자유 배치·제공 유형 칩·미제공 캡션을 렌더한다", async ({ page }) => {
  await mockMinecraftCatalog(page);
  await page.goto("/minecraft/recipes");
  await expect(page.getByRole("heading", { name: "조합법", exact: true })).toBeVisible();
  await expect(page.getByText("2개", { exact: true })).toBeVisible();

  const shaped = page.getByTestId("minecraft-recipe-card").filter({ hasText: "다이아몬드 검" });
  await expect(shaped.getByRole("img", { name: "조합 배치" })).toBeVisible();
  /* 작은 shape 도 제작대와 같은 3×3(9슬롯)로 정규화되고, 결과 슬롯이 함께 보입니다. */
  await expect(shaped.locator(".minecraft-craft-grid .minecraft-craft-cell")).toHaveCount(9);
  await expect(shaped.locator(".minecraft-craft-out")).toBeVisible();
  await expect(shaped.getByRole("img", { name: "다이아몬드" }).first()).toBeVisible();
  await expect(shaped.locator('img[src*="/textures/item/diamond.png"]').first()).toBeVisible();
  await expect(shaped.getByText("막대기", { exact: false }).first()).toBeVisible();

  /* shapeless — 그리드 대신 재료 슬롯 나열 + 자유 배치 표기, 미번역 명칭은 EN 원문 + 배지 */
  const shapeless = page.getByTestId("minecraft-recipe-card").filter({ hasText: "Mossy Cobblestone" });
  await expect(shapeless.getByText("자유 배치")).toBeVisible();
  await expect(shapeless.locator(".minecraft-craft-shapeless__tiles .minecraft-craft-cell")).toHaveCount(2);
  await expect(shapeless.locator(".minecraft-craft-out")).toBeVisible();
  await expect(shapeless.getByTitle("공식 한국어 명칭 준비 전 — 영문 원문 표시")).toBeVisible();

  /* crafting 만 원천 제공 — 제공 유형만 칩으로, 미제공은 캡션 한 줄(2026-08-15 밀도 개선) */
  const chips = page.getByRole("group", { name: "레시피 유형" });
  await expect(chips.getByRole("button", { name: "제작", exact: true })).toBeEnabled();
  await expect(chips.getByRole("button", { name: /제련/u })).toHaveCount(0);
  await expect(page.getByText("원천 미제공: 제련 · 양조 · 대장장이 · 절단")).toBeVisible();
  await expect(page.getByText("데이터: minecraft-data (MIT) · Java 1.21.11", { exact: false })).toBeVisible();
});

test("아이템 텍스처가 item 경로에 없으면 block 경로를 시도하고 CDN 장애 시 자체 fallback을 표시한다", async ({ page }) => {
  await page.unroute("https://assets.mcasset.cloud/**");
  await page.route("https://assets.mcasset.cloud/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/textures/block/mossy_cobblestone.png")) {
      await route.fulfill({ body: TEST_TEXTURE_PNG, contentType: "image/png", status: 200 });
      return;
    }
    await route.fulfill({ body: "not found", contentType: "text/plain", status: 404 });
  });
  await mockMinecraftCatalog(page);
  await page.goto("/minecraft/recipes");

  const mossy = page.getByTestId("minecraft-recipe-card").filter({ hasText: "Mossy Cobblestone" });
  await expect(mossy.locator('img[src*="/textures/block/mossy_cobblestone.png"]')).toBeVisible();
  const vine = mossy.getByRole("img", { name: "Vine" });
  await expect(vine.locator(".minecraft-item-swatch__fallback")).toHaveText("Vi");
});

test("아이템 페이지는 검색·페이지네이션(더 보기)·빈 결과를 처리한다", async ({ page }) => {
  await mockMinecraftCatalog(page);
  await page.goto("/minecraft/items");
  await expect(page.getByText("60개", { exact: true })).toBeVisible();
  await expect(page.getByTestId("minecraft-item-row")).toHaveCount(50);

  await page.getByRole("button", { name: "더 보기" }).click();
  await expect(page.getByTestId("minecraft-item-row")).toHaveCount(60);
  await expect(page.getByText("모든 결과를 불러왔습니다.")).toBeVisible();

  const search = page.getByRole("searchbox", { name: "카탈로그 검색" });
  await search.fill("다이아몬드 검");
  await search.press("Enter");
  await expect(page.getByTestId("minecraft-item-row")).toHaveCount(1);
  await expect(page.getByText("묶음 1")).toBeVisible();
  await expect(page.getByText("내구도 1,561").or(page.getByText("내구도 1561"))).toBeVisible();

  /* 목업 도구 상세의 "적용 가능 인챈트" — enchantCategoryIds(weapon) × 인챈트 교차 참조 */
  await page.getByText("인챈트 1종", { exact: true }).click();
  await expect(page.getByTestId("minecraft-item-row").getByText("날카로움")).toBeVisible();

  await search.fill("존재하지않는아이템");
  await search.press("Enter");
  await expect(page.getByText("검색 결과가 없습니다.")).toBeVisible();
});

test("더 보기 도중 데이터 세대(sourceRevision)가 바뀌면 병합하지 않고 처음부터 다시 불러온다", async ({ page }) => {
  const NEXT_REVISION = "f".repeat(64);
  const NEXT_ITEMS = FIXTURE_ITEMS.slice(0, 55);
  let generation = 0;
  await page.route(/\/api\/minecraft\/(items|recipes|enchants)/u, async (route) => {
    const url = new URL(route.request().url());
    /* 첫 목록 요청은 구세대(60개), page=2 부터는 신세대(55개) 배포가 완료된 상황을 재현합니다. */
    if (url.searchParams.get("page") === "2") generation = 1;
    const payload = catalogPayload(url, generation === 0 ? FIXTURE_ITEMS : NEXT_ITEMS);
    await route.fulfill({
      json: generation === 0
        ? payload
        : {
            ...payload,
            metadata: {
              ...FIXTURE_METADATA,
              sourceRevision: NEXT_REVISION,
              coverage: { ...FIXTURE_METADATA.coverage, items: NEXT_ITEMS.length },
            },
          },
    });
  });
  await page.goto("/minecraft/items");
  await expect(page.getByText("60개", { exact: true })).toBeVisible();
  await expect(page.getByTestId("minecraft-item-row")).toHaveCount(50);
  await page.getByRole("button", { name: "더 보기" }).click();
  /* 세대 불일치 → page 2 를 병합하는 대신 신세대 page 1 로 리셋(총 개수도 신세대 기준) */
  await expect(page.getByText("55개", { exact: true })).toBeVisible();
  await expect(page.getByTestId("minecraft-item-row")).toHaveCount(50);
  /* 같은 세대끼리는 정상 누적 */
  await page.getByRole("button", { name: "더 보기" }).click();
  await expect(page.getByTestId("minecraft-item-row")).toHaveCount(55);
});

test("카탈로그 검색은 URL(?q=)과 동기화된다 — nav 재클릭·뒤로가기 포함", async ({ page }) => {
  await mockMinecraftCatalog(page);
  /* 딥링크: ?q= 가 목록·입력 모두에 적용 */
  await page.goto("/minecraft/items?q=%EB%8B%A4%EC%9D%B4%EC%95%84%EB%AA%AC%EB%93%9C%20%EA%B2%80");
  await expect(page.getByTestId("minecraft-item-row")).toHaveCount(1);
  const search = page.getByRole("searchbox", { name: "카탈로그 검색" });
  await expect(search).toHaveValue("다이아몬드 검");

  /* nav 로 같은 페이지 재클릭 → q 없는 URL → 목록·입력이 함께 초기화(과거: 필터 잔존 결함) */
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 768;
  const nav = isMobile
    ? page.getByTestId("minecraft-bottom-tab-bar")
    : page.getByTestId("minecraft-secondary-nav");
  await nav.getByRole("button", { name: "아이템" }).click();
  await expect(page).toHaveURL(/\/minecraft\/items$/u);
  await expect(page.getByTestId("minecraft-item-row")).toHaveCount(50);
  await expect(search).toHaveValue("");

  /* 페이지 내 검색 → URL 에 반영(공유·새로고침 가능) */
  await search.fill("다이아몬드 검");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/minecraft\/items\?q=/u);
  await expect(page.getByTestId("minecraft-item-row")).toHaveCount(1);

  /* 뒤로가기 → 검색 전 상태 복원 */
  await page.goBack();
  await expect(page).toHaveURL(/\/minecraft\/items$/u);
  await expect(page.getByTestId("minecraft-item-row")).toHaveCount(50);
});

test("인챈트 카드는 레벨·획득 경로·적용 대상·상충 명칭을 표기한다", async ({ page }) => {
  await mockMinecraftCatalog(page);
  await page.goto("/minecraft/enchants");
  const sharpness = page.getByTestId("minecraft-enchant-card").filter({ hasText: "날카로움" });
  await expect(sharpness.getByText("최대 Lv 5")).toBeVisible();
  await expect(sharpness.getByText("인챈트 테이블")).toBeVisible();
  await expect(sharpness.getByText("주민 거래")).toBeVisible();
  /* 카테고리는 ko 라벨(알려진 값) — 원시 코드 노출 금지 */
  await expect(sharpness.getByText("무기", { exact: true })).toBeVisible();
  /* 상충 ID 는 목록에 없으면 사람이 읽을 형태(EN)로 표기 */
  await expect(sharpness.getByText("Smite · Bane Of Arthropods")).toBeVisible();
  const curse = page.getByTestId("minecraft-enchant-card").filter({ hasText: "Curse of Binding" });
  await expect(curse.getByText("저주")).toBeVisible();
  await expect(curse.getByText("보물 전용")).toBeVisible();
  await expect(curse.getByText("거래 불가")).toBeVisible();
});

test("카탈로그는 오류·data_unavailable 상태를 정직하게 그리고 재시도로 복구한다", async ({ page }) => {
  let failing = true;
  await page.route(/\/api\/minecraft\/(items|recipes|enchants)/u, async (route) => {
    if (failing) {
      await route.fulfill({ status: 500, json: { error: "boom" } });
      return;
    }
    const url = new URL(route.request().url());
    await route.fulfill({ json: catalogPayload(url, FIXTURE_ENCHANTS) });
  });
  await page.goto("/minecraft/enchants");
  await expect(page.getByText("데이터를 불러오지 못했습니다.")).toBeVisible();
  failing = false;
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByTestId("minecraft-enchant-card")).toHaveCount(2);

  /* data_unavailable 상태 문구 — config.js mock 은 유지한 채 카탈로그 route 만 교체 */
  await page.unroute(/\/api\/minecraft\/(items|recipes|enchants)/u);
  await page.route(/\/api\/minecraft\/(items|recipes|enchants)/u, async (route) => {
    await route.fulfill({ json: { state: "data_unavailable" } });
  });
  await page.goto("/minecraft/items");
  await expect(page.getByText("카탈로그 데이터를 사용할 수 없습니다.")).toBeVisible();
});

test("마인크래프트 메뉴는 실데이터 화면과 준비 중 화면·404·직접 URL을 지원한다", async ({ page }) => {
  await mockMinecraftCatalog(page);
  await page.goto("/minecraft");
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 768;
  const nav = isMobile
    ? page.getByTestId("minecraft-bottom-tab-bar")
    : page.getByTestId("minecraft-secondary-nav");
  await expect(nav.getByRole("button", { name: "위키" })).toHaveAttribute("aria-current", "page");
  /* 모바일은 하단 탭바 단일 nav — 상단 가로 nav 와 이중 표시 금지(2026-08-15 결함 회귀 방지) */
  if (isMobile) await expect(page.getByTestId("minecraft-secondary-nav")).toBeHidden();
  else await expect(page.getByTestId("minecraft-bottom-tab-bar")).toBeHidden();

  await nav.getByRole("button", { name: "조합법" }).click();
  await expect(page).toHaveURL(/\/minecraft\/recipes$/u);
  await expect(page.getByTestId("minecraft-recipe-card").first()).toBeVisible();
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
  await mockMinecraftCatalog(page);
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
  await expect(page.getByRole("heading", { name: "エンチャント", exact: true })).toBeVisible();
  await expect(page.getByText("2件", { exact: true })).toBeVisible();
  await expect(page.getByText("最大 Lv 5")).toBeVisible();
});

test("게임 선택기에서 마인크래프트로 이동하고 다시 다른 게임으로 돌아온다", async ({ page }) => {
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 768;
  test.skip(isMobile, "모바일은 통합 메뉴 시트 경로를 쓰므로 데스크톱 드롭다운만 검증합니다.");
  await mockMinecraftCatalog(page);
  /* LoL 메인(/)은 PUBLIC_PAGE_PATHS 경유라 별도 경로 — minecraft 항목 누락 회귀 방지
     (2026-08-14: 맵 누락으로 메인에서만 선택이 무시되던 결함) */
  await page.goto("/");
  await page.getByRole("button", { name: "게임 메뉴" }).click();
  await page.getByRole("option", { name: "마인크래프트 선택" }).click();
  await expect(page).toHaveURL(/\/minecraft$/u);
  await expect(page.getByRole("heading", { name: "무엇이든 찾는 마인크래프트 위키" })).toBeVisible();

  await page.getByRole("button", { name: "게임 메뉴" }).click();
  await page.getByRole("option", { name: "Palworld 선택" }).click();
  await expect(page).toHaveURL(/\/palworld$/u);
  await page.getByRole("button", { name: "게임 메뉴" }).click();
  await page.getByRole("option", { name: "마인크래프트 선택" }).click();
  await expect(page).toHaveURL(/\/minecraft$/u);
  await expect(page.getByRole("heading", { name: "무엇이든 찾는 마인크래프트 위키" })).toBeVisible();
});
