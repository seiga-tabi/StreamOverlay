import { expect, test, type Page, type Route } from "@playwright/test";
import { resolve } from "node:path";
import { PALWORLD_PUBLIC_NOTICE_JA, PALWORLD_PUBLIC_NOTICE_KO } from "@streamops/shared";
import type {
  PalworldBreedingPair,
  PalworldDataMetadata,
  PalworldItemDetail,
  PalworldItemSummary,
  PalworldPaginatedResponse,
  PalworldPalDetail,
  PalworldPalReference,
  PalworldPalSummary,
} from "@streamops/shared";

const metadata: PalworldDataMetadata = {
  gameVersion: "1.0.1",
  sourceName: "Palworld fixed release artifact",
  sourceUrl: "https://github.com/seiga-tabi/StreamOverlay/blob/main/apps/server/data/palworld/1.0.1/sources.lock.json",
  sourceRevision: "fixed-source-revision",
  extractedAt: "2026-07-21T00:00:00.000Z",
  verifiedAt: "2026-07-21T00:00:00.000Z",
  license: "Test-only Pal text fixture",
};

const sampleMetadata: PalworldDataMetadata = {
  gameVersion: "sample-baseline",
  sourceName: "StreamOverlay curated sample snapshot",
  sourceUrl: "https://github.com/seiga-tabi/StreamOverlay/blob/main/apps/server/src/data/PALWORLD_DATA.md",
  sourceRevision: "streamops-palworld-sample-2026-07-21",
  extractedAt: "2026-07-21T00:00:00.000Z",
  verifiedAt: "2026-07-21T00:00:00.000Z",
  license: "저장소 작성 샘플. 교배 구조 참고: tylercamp/palcalc MIT.",
};

const READY_PAL_IMAGE_URL = `/images/palworld/1.0.1/pals/${"a".repeat(64)}.webp`;
const LOCAL_WEBP_FIXTURE = resolve("apps/dashboard/public/images/yorogg-logo.webp");

const pals: PalworldPalDetail[] = [
  {
    id: "penking",
    number: 11,
    nameKo: "펭킹",
    nameJa: "キャプペン",
    nameEn: "Penking",
    imageUrl: READY_PAL_IMAGE_URL,
    elements: ["water", "ice"],
    rarity: 6,
    variantType: "normal",
    workSuitabilities: [
      { type: "watering", level: 2 },
      { type: "mining", level: 2 },
    ],
    stats: { hp: 95, attack: 95, defense: 95, moveSpeed: 450, stamina: 100 },
    nocturnal: false,
    partnerSkill: {
      id: "penking-partner-skill",
      type: "partner",
      nameKo: "펭킹 파트너 스킬",
      nameJa: "キャプペンのパートナースキル",
      nameEn: "Penking Partner Skill",
      descriptionKo: "펭킹의 고유 능력입니다.",
      descriptionJa: "キャプペンの固有能力です。",
    },
    activeSkills: [],
    drops: [],
    breeding: { breedingPower: 520, specialParentPairs: [] },
    metadata,
  },
  {
    id: "bushi",
    number: 72,
    nameKo: "불무사",
    nameJa: "ツジギリ",
    nameEn: "Bushi",
    elements: ["fire"],
    rarity: 7,
    variantType: "normal",
    workSuitabilities: [
      { type: "kindling", level: 2 },
      { type: "lumbering", level: 3 },
    ],
    stats: { hp: 80, attack: 125, defense: 80, moveSpeed: 600, stamina: 100 },
    nocturnal: false,
    partnerSkill: {
      id: "bushi-partner-skill",
      type: "partner",
      nameKo: "불무사 파트너 스킬",
      nameJa: "ツジギリのパートナースキル",
      nameEn: "Bushi Partner Skill",
      descriptionKo: "불무사의 고유 능력입니다.",
      descriptionJa: "ツジギリの固有能力です。",
    },
    activeSkills: [],
    drops: [],
    breeding: { breedingPower: 640, specialParentPairs: [] },
    metadata,
  },
  {
    id: "anubis",
    number: 100,
    nameKo: "아누비스",
    nameJa: "アヌビス",
    nameEn: "Anubis",
    elements: ["ground"],
    rarity: 10,
    variantType: "special",
    workSuitabilities: [
      { type: "handiwork", level: 4 },
      { type: "mining", level: 3 },
    ],
    stats: { hp: 120, attack: 130, defense: 100, moveSpeed: 800, stamina: 100 },
    nocturnal: true,
    partnerSkill: {
      id: "anubis-partner-skill",
      type: "partner",
      nameKo: "아누비스 파트너 스킬",
      nameJa: "アヌビスのパートナースキル",
      nameEn: "Anubis Partner Skill",
      descriptionKo: "아누비스의 고유 능력입니다.",
      descriptionJa: "アヌビスの固有能力です。",
    },
    activeSkills: [
      {
        id: "stone-blast",
        type: "active",
        nameKo: "스톤 샷",
        nameJa: "ストーンショット",
        nameEn: "Stone Blast",
        descriptionKo: "바위 탄환으로 피해를 줍니다.",
        descriptionJa: "岩の弾でダメージを与えます。",
        element: "ground",
        power: 30,
        cooldownSeconds: 2,
      },
    ],
    drops: [
      {
        id: "ancient-technology-parts",
        nameKo: "고대 문명의 부품",
        nameJa: "古代文明の部品",
        nameEn: "Ancient Civilization Parts",
      },
    ],
    breeding: {
      breedingPower: 570,
      specialParentPairs: [{ parentAId: "penking", parentBId: "bushi" }],
    },
    metadata,
  },
];

const items: PalworldItemDetail[] = [
  {
    id: "pal-sphere",
    nameKo: "Pal 스피어",
    nameJa: "パルスフィア",
    nameEn: "Pal Sphere",
    category: "sphere",
    rarity: 1,
    descriptionKo: "낮은 등급의 Pal 포획에 사용하는 기본 스피어입니다.",
    descriptionJa: "低ランクのパル捕獲に使う基本スフィアです。",
    descriptionEn: "A basic sphere used to capture lower-tier Pals.",
    sellPrice: 10,
    technologyLevel: 2,
    craftingMaterials: [
      {
        item: {
          id: "paldium-fragment",
          nameKo: "팰지움 파편",
          nameJa: "パルジウムの欠片",
          nameEn: "Paldium Fragment",
        },
        quantity: 1,
      },
    ],
    craftingFacility: {
      id: "primitive-workbench",
      nameKo: "원시적인 작업대",
      nameJa: "原始的な作業台",
      nameEn: "Primitive Workbench",
    },
    dropPals: [],
    acquisitionMethods: [
      {
        type: "craft",
        labelKo: "작업대에서 제작",
        labelJa: "作業台で製作",
        labelEn: "Crafted at a workbench",
      },
    ],
    relatedItems: [],
    metadata: sampleMetadata,
  },
  {
    id: "ancient-technology-parts",
    nameKo: "고대 문명의 부품",
    nameJa: "古代文明の部品",
    nameEn: "Ancient Civilization Parts",
    category: "key_item",
    rarity: 4,
    descriptionKo: "고대 기술 장비 제작에 사용하는 희귀 부품입니다.",
    descriptionJa: "古代技術装備の製作に使う希少な部品です。",
    descriptionEn: "Rare parts used to craft ancient technology gear.",
    craftingMaterials: [],
    dropPals: [palReference("anubis")],
    acquisitionMethods: [
      {
        type: "drop",
        labelKo: "강력한 Pal 보상에서 획득",
        labelJa: "強力なパルの報酬から入手",
        labelEn: "Obtained from powerful Pals",
      },
    ],
    relatedItems: [],
    metadata: sampleMetadata,
  },
];

const breedingPair: PalworldBreedingPair = {
  id: "penking-bushi-anubis",
  parentA: palReference("penking"),
  parentB: palReference("bushi"),
  child: palReference("anubis"),
  isSpecial: true,
};

const apiRequestUrls = new WeakMap<Page, string[]>();

function palReference(id: string): PalworldPalReference {
  const pal = pals.find((candidate) => candidate.id === id);
  if (!pal) throw new TypeError(`테스트 Pal fixture를 찾을 수 없습니다: ${id}`);
  return {
    id: pal.id,
    number: pal.number,
    nameKo: pal.nameKo,
    nameJa: pal.nameJa,
    nameEn: pal.nameEn,
    ...(pal.imageUrl ? { imageUrl: pal.imageUrl } : {}),
    elements: [...pal.elements],
  };
}

function palSummary(pal: PalworldPalDetail): PalworldPalSummary {
  return {
    id: pal.id,
    number: pal.number,
    nameKo: pal.nameKo,
    nameJa: pal.nameJa,
    nameEn: pal.nameEn,
    ...(pal.imageUrl ? { imageUrl: pal.imageUrl } : {}),
    elements: [...pal.elements],
    rarity: pal.rarity,
    variantType: pal.variantType,
    workSuitabilities: pal.workSuitabilities.map((work) => ({ ...work })),
  };
}

function itemSummary(item: PalworldItemDetail): PalworldItemSummary {
  return {
    id: item.id,
    nameKo: item.nameKo,
    nameJa: item.nameJa,
    nameEn: item.nameEn,
    category: item.category,
    rarity: item.rarity,
    descriptionKo: item.descriptionKo,
    descriptionJa: item.descriptionJa,
    ...(item.descriptionEn ? { descriptionEn: item.descriptionEn } : {}),
    ...(item.sellPrice === undefined ? {} : { sellPrice: item.sellPrice }),
    ...(item.technologyLevel === undefined ? {} : { technologyLevel: item.technologyLevel }),
  };
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

function aliases(id: string): string[] {
  return [id, id.replaceAll("-", "_"), id.replaceAll("_", "-")];
}

function matches(query: string, values: Array<string | number>): boolean {
  const term = normalize(query);
  return values.some((value) => normalize(String(value)).includes(term));
}

function pageResponse<T>(allItems: T[], url: URL, responseMetadata = metadata): PalworldPaginatedResponse<T> {
  const requestedPage = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("limit") ?? "24");
  const totalPages = Math.ceil(allItems.length / pageSize);
  const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  return {
    items: allItems.slice((page - 1) * pageSize, page * pageSize),
    pagination: {
      page,
      pageSize,
      total: allItems.length,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    metadata: responseMetadata,
  };
}

function filteredPals(url: URL): PalworldPalSummary[] {
  const query = url.searchParams.get("q");
  const element = url.searchParams.get("element");
  const work = url.searchParams.get("work");
  const rarity = url.searchParams.get("rarity");
  const variant = url.searchParams.get("variant");
  const sort = url.searchParams.get("sort") ?? "number";
  return pals
    .filter((pal) => !query || matches(query, [...aliases(pal.id), pal.number, `#${pal.number}`, pal.nameKo, pal.nameJa, pal.nameEn]))
    .filter((pal) => !element || pal.elements.includes(element as never))
    .filter((pal) => !work || pal.workSuitabilities.some((entry) => entry.type === work))
    .filter((pal) => !rarity || pal.rarity === Number(rarity))
    .filter((pal) => !variant || pal.variantType === variant)
    .sort((left, right) => {
      if (sort === "rarity") return left.rarity - right.rarity || left.number - right.number;
      if (sort === "name") return left.nameKo.localeCompare(right.nameKo);
      return left.number - right.number;
    })
    .map(palSummary);
}

function filteredItems(url: URL): PalworldItemSummary[] {
  const query = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  const rarity = url.searchParams.get("rarity");
  const acquisition = url.searchParams.get("acquisition");
  const sort = url.searchParams.get("sort") ?? "name";
  return items
    .filter((item) => !query || matches(query, [...aliases(item.id), item.nameKo, item.nameJa, item.nameEn]))
    .filter((item) => !category || item.category === category)
    .filter((item) => !rarity || item.rarity === Number(rarity))
    .filter((item) => !acquisition || item.acquisitionMethods.some((method) => method.type === acquisition))
    .sort((left, right) => {
      if (sort === "rarity") return left.rarity - right.rarity;
      if (sort === "price") return (left.sellPrice ?? Number.MAX_SAFE_INTEGER) - (right.sellPrice ?? Number.MAX_SAFE_INTEGER);
      if (sort === "technologyLevel") return (left.technologyLevel ?? Number.MAX_SAFE_INTEGER) - (right.technologyLevel ?? Number.MAX_SAFE_INTEGER);
      return left.nameKo.localeCompare(right.nameKo);
    })
    .map(itemSummary);
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=86400" },
    body: JSON.stringify(body),
  });
}

async function installApiFixtures(page: Page): Promise<void> {
  const requests: string[] = [];
  apiRequestUrls.set(page, requests);
  await page.route(`**${READY_PAL_IMAGE_URL}`, async (route) => {
    await route.fulfill({
      path: LOCAL_WEBP_FIXTURE,
      contentType: "image/webp",
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    });
  });
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const url = new URL(route.request().url());
    requests.push(`${url.pathname}${url.search}`);

    if (url.pathname === "/api/palworld/meta") {
      await json(route, {
        metadata,
        counts: { pals: 287, items: 10, breedingPairs: 3 },
        domains: {
          pals: { status: "ready", recordCount: 287, metadata },
          items: { status: "sample", recordCount: 10, metadata: sampleMetadata },
          breeding: { status: "sample", recordCount: 3, metadata: sampleMetadata },
        },
        gates: {
          dataIntegrity: { passed: true, status: "ready" },
          imageAssets: {
            status: "partial",
            policyStatus: "operator_acknowledged",
            technicalPassed: true,
            publicActivationAllowed: true,
            rightsVerified: false,
            usageBasis: "operator_reference_use",
            readyImages: 1,
            fallbackPals: 286,
            publicNoticeRequired: true,
          },
        },
      });
      return;
    }
    if (url.pathname === "/api/palworld/search") {
      const query = url.searchParams.get("q") ?? "";
      const matchedPals = filteredPals(new URL(`/palworld?q=${encodeURIComponent(query)}`, url.origin));
      const matchedItems = filteredItems(new URL(`/palworld?q=${encodeURIComponent(query)}`, url.origin));
      await json(route, {
        query: query.trim().replace(/\s+/gu, " "),
        total: matchedPals.length + matchedItems.length,
        pals: matchedPals,
        items: matchedItems,
        metadata,
        domains: {
          pals: { status: "ready", recordCount: 287, metadata },
          items: { status: "sample", recordCount: 10, metadata: sampleMetadata },
        },
      });
      return;
    }
    if (url.pathname === "/api/palworld/pals") {
      await json(route, pageResponse(filteredPals(url), url));
      return;
    }
    if (url.pathname === "/api/palworld/items") {
      await json(route, pageResponse(filteredItems(url), url, sampleMetadata));
      return;
    }
    if (url.pathname === "/api/palworld/breeding/parents") {
      const child = aliases(url.searchParams.get("child") ?? "").find((id) => id === "anubis");
      await json(route, {
        child: palReference(child ?? "anubis"),
        ...pageResponse(child ? [breedingPair] : [], url, sampleMetadata),
      });
      return;
    }
    if (url.pathname === "/api/palworld/breeding") {
      const parentAId = aliases(url.searchParams.get("parentA") ?? "").find((id) => pals.some((pal) => pal.id === id));
      const parentBId = aliases(url.searchParams.get("parentB") ?? "").find((id) => pals.some((pal) => pal.id === id));
      if (!parentAId || !parentBId) {
        await json(route, { error: "PALWORLD_NOT_FOUND", message: "Pal을 찾을 수 없습니다." }, 404);
        return;
      }
      const isSupported = new Set([parentAId, parentBId]).size === 2
        && [parentAId, parentBId].every((id) => id === "penking" || id === "bushi");
      await json(route, {
        parentA: palReference(parentAId),
        parentB: palReference(parentBId),
        result: isSupported ? breedingPair : null,
        metadata: sampleMetadata,
      });
      return;
    }

    const palMatch = url.pathname.match(/^\/api\/palworld\/pals\/([^/]+)$/u);
    if (palMatch?.[1]) {
      const id = decodeURIComponent(palMatch[1]);
      const pal = pals.find((candidate) => aliases(candidate.id).includes(id));
      await json(route, pal ?? { error: "PALWORLD_NOT_FOUND", message: "Pal을 찾을 수 없습니다." }, pal ? 200 : 404);
      return;
    }
    const itemMatch = url.pathname.match(/^\/api\/palworld\/items\/([^/]+)$/u);
    if (itemMatch?.[1]) {
      const id = decodeURIComponent(itemMatch[1]);
      const item = items.find((candidate) => aliases(candidate.id).includes(id));
      await json(route, item ?? { error: "PALWORLD_NOT_FOUND", message: "아이템을 찾을 수 없습니다." }, item ? 200 : 404);
      return;
    }

    if (url.pathname === "/api/public/locale") {
      await json(route, { locale: "ko" });
      return;
    }
    if (url.pathname === "/api/public/twitch/status") {
      await json(route, {
        connected: false,
        configured: true,
        requiredScopes: [],
        missingScopes: [],
        streamers: [],
        queue: [],
        maxQueueSize: 100,
        updatedAt: "2026-07-21T00:00:00.000Z",
      });
      return;
    }
    if (url.pathname === "/api/public/tournaments") {
      await json(route, { tournaments: [] });
      return;
    }
    if (url.pathname === "/api/public/community/posts") {
      await json(route, { posts: [] });
      return;
    }
    await json(route, {});
  });
}

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return errors;
}

async function assertHealthyDocument(page: Page, errors: string[]): Promise<void> {
  await page.waitForLoadState("networkidle");
  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  expect(dimensions.documentWidth, "페이지 전체에 수평 overflow가 없어야 합니다.").toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(errors, "console 또는 page runtime 오류가 없어야 합니다.").toEqual([]);
}

async function chooseGame(page: Page, game: "league" | "palworld"): Promise<void> {
  const optionName = game === "league" ? /리그 오브 레전드/u : /펠월드/u;
  if ((page.viewportSize()?.width ?? 1440) <= 600) {
    await page.locator(".public-mobile-menu-toggle").click();
    await page.locator(".public-mobile-game-tray").getByRole("option", { name: optionName }).click();
    return;
  }
  await page.locator(".public-game-selector-trigger").click();
  await page.locator(".public-game-selector-menu").getByRole("option", { name: optionName }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("loltrace.locale", "ko");
    window.localStorage.removeItem("preferredGame");
  });
  await page.route("**/dashboard/config.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: "window.__STREAMOPS_CONFIG__ = { apiBase: window.location.origin };",
    });
  });
  await installApiFixtures(page);
});

test("펠월드 홈은 Hero 검색만 표시하고 게임 선택으로 LoL과 왕복 이동한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld");

  await expect(page.locator(".palworld-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "펠월드 데이터베이스", level: 1 })).toBeVisible();
  await expect(page.getByTestId("hero-search")).toBeVisible();
  await expect(page.getByTestId("header-search")).toHaveCount(0);
  await expect(page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "홈" })).toHaveAttribute("aria-current", "page");
  const summaryMetrics = page.locator(".palworld-summary .yoro-metric");
  await expect(summaryMetrics).toHaveCount(4);
  await expect(summaryMetrics.nth(0)).toContainText("287");
  await expect(summaryMetrics.nth(0)).toContainText("준비 완료");
  await expect(summaryMetrics.nth(1)).toContainText("10");
  await expect(summaryMetrics.nth(1)).toContainText("샘플");
  await expect(summaryMetrics.nth(2)).toContainText("3");
  await expect(summaryMetrics.nth(2)).toContainText("샘플");
  await expect(summaryMetrics.nth(3)).toContainText("1");
  await expect(summaryMetrics.nth(3)).toContainText("286");
  await expect(summaryMetrics.nth(3)).toContainText("일부 이미지만 사용");
  await expect(summaryMetrics.nth(3)).toContainText("운영자 확인에 따른 사용");
  await expect(summaryMetrics.nth(3)).toContainText("독립적인 권리 확인 없음");
  await assertHealthyDocument(page, errors);

  await chooseGame(page, "league");
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.locator(".public-home-shared-shell")).toBeVisible();

  await chooseGame(page, "palworld");
  await expect(page).toHaveURL(/\/palworld$/u);
  await expect(page.locator(".palworld-shell")).toBeVisible();
  await expect(page.getByTestId("hero-search")).toBeVisible();
  await assertHealthyDocument(page, errors);
});

test("Pal 필터 query를 유지하고 카드·ESC·직접 URL 상세 Modal을 지원한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld/pals?element=ground&work=mining&sort=number");

  await expect(page.getByTestId("header-search")).toBeVisible();
  await expect(page.getByTestId("hero-search")).toHaveCount(0);
  await expect(page.getByLabel("속성")).toHaveValue("ground");
  await expect(page.getByLabel("작업 적성")).toHaveValue("mining");
  await expect(page.getByLabel("정렬")).toHaveValue("number");
  const anubisCard = page.getByTestId("pal-card").filter({ hasText: "아누비스" });
  await expect(anubisCard).toBeVisible();

  await anubisCard.click();
  await expect(page).toHaveURL(/pal=anubis/u);
  await expect(page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "아누비스" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pal-detail-modal")).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.has("pal")).toBe(false);

  await page.goto("/palworld/pals?pal=anubis");
  const directDialog = page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "아누비스" });
  await expect(directDialog).toBeVisible();
  await expect(directDialog).toContainText("アヌビス");
  const koreanNocturnal = directDialog.locator(".palworld-data-row").filter({ hasText: "야행성" });
  await expect(koreanNocturnal).toContainText("예");
  await expect(apiRequestUrls.get(page) ?? []).toContain("/api/palworld/pals/anubis");
  await page.keyboard.press("Escape");
  await page.locator(".public-locale-button").click();
  await page.getByRole("menuitemradio", { name: /JP/u }).click();
  await page.getByTestId("pal-card").filter({ hasText: "アヌビス" }).click();
  const japaneseDialog = page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "アヌビス" });
  const japaneseNocturnal = japaneseDialog.locator(".palworld-data-row").filter({ hasText: "夜行性" });
  await expect(japaneseNocturnal).toContainText("はい");
  await assertHealthyDocument(page, errors);
});

test("underscore 아이템 ID의 직접 URL로 아이템 상세 Modal을 연다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld/items?item=pal_sphere");

  await expect(page.getByTestId("header-search")).toBeVisible();
  const dialog = page.getByTestId("item-detail-modal").getByRole("dialog", { name: "Pal 스피어" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("パルスフィア");
  await expect(dialog.getByText("pal-sphere", { exact: true })).toBeVisible();
  const coverage = page.getByTestId("palworld-items-coverage");
  await expect(coverage).toContainText("샘플");
  await expect(coverage).toContainText("Pal 1.0.1 전체 아이템 데이터가 아닙니다");
  await expect(coverage).toContainText("StreamOverlay curated sample snapshot");
  await expect(apiRequestUrls.get(page) ?? []).toContain("/api/palworld/items/pal_sphere");
  await expect(page.getByText("응답 데이터 버전이 서로 다릅니다. 새로고침해 주세요.")).toHaveCount(0);
  await assertHealthyDocument(page, errors);
});

test("아이템 상세의 관련 Pal 링크는 이미지와 fallback을 유지하며 Pal 상세로 이동한다", async ({ page }) => {
  await page.goto("/palworld/items?item=ancient-technology-parts");

  const itemDialog = page.getByTestId("item-detail-modal").getByRole("dialog", { name: "고대 문명의 부품" });
  const relatedPal = itemDialog.locator(".palworld-related-pal-link").filter({ hasText: "아누비스" });
  await expect(relatedPal).toBeVisible();
  await expect(relatedPal.getByRole("img", { name: "아누비스 · 이미지 준비 중" })).toBeVisible();
  await relatedPal.click();
  await expect(page).toHaveURL(/\/palworld\/pals\?pal=anubis/u);
  await expect(page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "아누비스" })).toBeVisible();
});

test("부모 Pal 자동완성으로 교배 결과를 조회하고 부모 위치를 교환한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld/breeding");

  const coverage = page.getByTestId("palworld-breeding-coverage");
  await expect(coverage).toContainText("샘플");
  await expect(coverage).toContainText("Pal 1.0.1 전체 교배 데이터가 아닙니다");
  await expect(coverage).toContainText("StreamOverlay curated sample snapshot");

  const parentA = page.getByTestId("breeding-parent-a");
  const parentB = page.getByTestId("breeding-parent-b");
  await parentA.getByRole("searchbox").fill("펭킹");
  await parentA.getByRole("option", { name: /펭킹/u }).click();
  const parentImage = parentA.getByRole("img", { name: "펭킹" });
  await expect(parentImage).toBeVisible();
  await expect(parentImage).toHaveAttribute("src", READY_PAL_IMAGE_URL);
  await expect.poll(() => parentImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await parentB.getByRole("searchbox").fill("불무사");
  await parentB.getByRole("option", { name: /불무사/u }).click();

  const result = page.getByTestId("breeding-result");
  await expect(result).toContainText("특수 교배");
  await expect(result).toContainText("아누비스");
  await page.getByTestId("breeding-swap").click();
  await expect(parentA).toContainText("불무사");
  await expect(parentB).toContainText("펭킹");
  await expect.poll(() => (apiRequestUrls.get(page) ?? []).some((requestUrl) => {
    const url = new URL(requestUrl, "https://fixture.invalid");
    return url.pathname === "/api/palworld/breeding"
      && url.searchParams.get("parentA") === "bushi"
      && url.searchParams.get("parentB") === "penking";
  })).toBe(true);
  await assertHealthyDocument(page, errors);
});

test("Pal 이미지 404는 페이지 오류 없이 접근 가능한 fallback으로 전환한다", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route(`**${READY_PAL_IMAGE_URL}`, async (route) => {
    await route.fulfill({ status: 404, body: "" });
  });
  await page.goto("/palworld/pals?q=펭킹");

  const card = page.getByTestId("pal-card").filter({ hasText: "펭킹" });
  await expect(card).toBeVisible();
  await expect(card.locator("img")).toHaveCount(0);
  await expect(card.getByRole("img", { name: "펭킹 · 이미지 준비 중" })).toBeVisible();
  await card.click();
  const dialog = page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "펭킹" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("img")).toHaveCount(0);
  await expect(dialog.getByRole("img", { name: "펭킹 · 이미지 준비 중" })).toBeVisible();
  await expect(pageErrors).toEqual([]);
});

test("통합 검색은 한국어와 일본어 이름 결과를 표시한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto(`/palworld/search?q=${encodeURIComponent("아누비스")}`);

  await expect(page.getByRole("heading", { name: "아누비스", level: 1 })).toBeVisible();
  await expect(page.getByTestId("pal-card").filter({ hasText: "아누비스" })).toBeVisible();

  await page.locator(".public-locale-button").click();
  await page.getByRole("menuitemradio", { name: /JP/u }).click();
  const headerSearch = page.getByTestId("header-search").getByRole("searchbox");
  await headerSearch.fill("パルスフィア");
  await headerSearch.press("Enter");

  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("パルスフィア");
  await expect(page.getByRole("heading", { name: "パルスフィア", level: 1 })).toBeVisible();
  await expect(page.getByTestId("item-card").filter({ hasText: "パルスフィア" })).toBeVisible();
  const itemCoverage = page.getByTestId("palworld-items-coverage");
  await expect(itemCoverage).toContainText("サンプル");
  await expect(itemCoverage).toContainText("パル1.0.1の全アイテムデータではありません");
  await expect(itemCoverage).toContainText("StreamOverlay curated sample snapshot");
  await expect(page.getByText("応答データのバージョンが一致しません。更新してください。")).toHaveCount(0);
  await assertHealthyDocument(page, errors);
});

test("PC 화면에서 모든 펠월드 페이지 본문을 중앙 정렬한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const routes = [
    "/palworld",
    "/palworld/pals",
    "/palworld/breeding",
    "/palworld/items",
    `/palworld/search?q=${encodeURIComponent("아누비스")}`,
  ];

  for (const route of routes) {
    await page.goto(route);
    const main = page.locator(".palworld-main");
    await expect(main).toBeVisible();
    const bounds = await main.boundingBox();
    expect(bounds, `${route} 본문 영역을 측정할 수 있어야 합니다.`).not.toBeNull();
    const viewportCenter = (page.viewportSize()?.width ?? 0) / 2;
    const mainCenter = bounds!.x + (bounds!.width / 2);
    expect(Math.abs(mainCenter - viewportCenter), `${route} 본문 중심이 viewport 중심과 일치해야 합니다.`).toBeLessThanOrEqual(1);
  }
});

test("모든 Palworld 공개 경로 하단에 한국어·일본어 비공식 출처 공지를 표시한다", async ({ page }) => {
  const routes = [
    "/palworld",
    "/palworld/pals",
    "/palworld/breeding",
    "/palworld/items",
    `/palworld/search?q=${encodeURIComponent("아누비스")}`,
  ];

  for (const route of routes) {
    await page.goto(route);
    const koreanFooter = page.getByTestId("palworld-source-footer");
    await expect(koreanFooter).toBeVisible();
    await expect(koreanFooter.locator("p")).toHaveText(PALWORLD_PUBLIC_NOTICE_KO);
    await expect(koreanFooter.locator("p")).toHaveAttribute("data-ko", PALWORLD_PUBLIC_NOTICE_KO);
    await expect(koreanFooter.locator("p")).toHaveAttribute("data-ja", PALWORLD_PUBLIC_NOTICE_JA);
    await expect(koreanFooter.locator("a")).toHaveCount(2);
    await expect.poll(() => koreanFooter.evaluate((footer) => window.getComputedStyle(footer).position)).toBe("static");
    await expect(koreanFooter.getByRole("link", { name: /Palworld · 외부 사이트, 새 창에서 열기/u })).toHaveAttribute("target", "_blank");
    await expect(koreanFooter.getByRole("link", { name: /Pocketpair · 외부 사이트, 새 창에서 열기/u })).toHaveAttribute("rel", "noopener noreferrer");

    await page.locator(".public-locale-button").click();
    await page.getByRole("menuitemradio", { name: /JP/u }).click();
    const japaneseFooter = page.getByTestId("palworld-source-footer");
    await expect(japaneseFooter.locator("p")).toHaveText(PALWORLD_PUBLIC_NOTICE_JA);
    await expect(japaneseFooter.getByRole("link", { name: /Palworld · 外部サイト、新しいタブで開く/u })).toBeVisible();
  }
});

test("Palworld 화면은 외부 origin 이미지 요청 없이 카드·자동완성·상세·교배 이미지를 표시한다", async ({ page }) => {
  const imageRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image") imageRequests.push(request.url());
  });

  await page.goto("/palworld/pals?q=펭킹");
  const cardImage = page.getByTestId("pal-card").filter({ hasText: "펭킹" }).getByRole("img", { name: "펭킹" });
  await expect(cardImage).toBeVisible();
  await expect(cardImage).toHaveAttribute("src", READY_PAL_IMAGE_URL);
  await cardImage.click();
  await expect(page.getByTestId("pal-detail-modal").getByRole("img", { name: "펭킹" })).toBeVisible();
  await page.keyboard.press("Escape");

  const headerSearch = page.getByTestId("header-search").getByRole("searchbox");
  await headerSearch.fill("펭킹");
  await expect(page.getByTestId("header-search").getByRole("option", { name: /펭킹/u }).getByRole("img", { name: "펭킹" })).toBeVisible();

  await page.goto("/palworld/breeding");
  const parent = page.getByTestId("breeding-parent-a");
  await parent.getByRole("searchbox").fill("펭킹");
  await parent.getByRole("option", { name: /펭킹/u }).click();
  await expect(parent.getByRole("img", { name: "펭킹" })).toBeVisible();

  await page.locator(".public-locale-button").click();
  await page.getByRole("menuitemradio", { name: /JP/u }).click();
  const japaneseSearch = page.getByTestId("header-search").getByRole("searchbox");
  await japaneseSearch.fill("キャプペン");
  await japaneseSearch.press("Enter");
  await expect(page.getByRole("heading", { name: "キャプペン", level: 1 })).toBeVisible();
  await expect(page.getByTestId("pal-card").filter({ hasText: "キャプペン" }).getByRole("img", { name: "キャプペン" })).toBeVisible();

  const pageOrigin = new URL(page.url()).origin;
  expect(imageRequests.filter((requestUrl) => new URL(requestUrl).origin !== pageOrigin)).toEqual([]);
});

test("요구 화면 크기에서 페이지 overflow 없이 첫·마지막 메뉴를 선택한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/palworld/pals");
    await expect(page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "홈" })).toBeVisible();
    await page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "아이템" }).click();
    await expect(page).toHaveURL(/\/palworld\/items$/u);
    await expect(page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "아이템" })).toHaveAttribute("aria-current", "page");
    await assertHealthyDocument(page, errors);
  }
});
