import assert from "node:assert/strict";
import test from "node:test";
import type { PalworldItemSummary, PalworldPalSummary } from "@streamops/shared";
import { getPalworldMeta, PALWORLD_VERSION_MISMATCH_EVENT, searchPalworld } from "../src/features/public-palworld/api/palworld";
import { setPublicPath } from "../src/features/public-lol/utils/routes";
import { swapBreedingParents } from "../src/features/public-palworld/utils/breeding";
import { isPalworldPath, palworldPageFromPath, palworldPathForPage, palworldUrl } from "../src/features/public-palworld/utils/routes";
import { matchesPalworldItem, matchesPalworldPal, normalizePalworldSearch } from "../src/features/public-palworld/utils/search";

const anubis: PalworldPalSummary = {
  id: "anubis",
  number: 100,
  nameKo: "아누비스",
  nameJa: "アヌビス",
  nameEn: "Anubis",
  elements: ["ground"],
  rarity: 10,
  variantType: "normal",
  workSuitabilities: [{ type: "mining", level: 3 }],
};

const palSphere: PalworldItemSummary = {
  id: "pal_sphere",
  nameKo: "Pal 스피어",
  nameJa: "パルスフィア",
  nameEn: "Pal Sphere",
  category: "sphere",
  rarity: 1,
  descriptionKo: "Pal을 포획합니다.",
  descriptionJa: "パルを捕獲します。",
};

test("펠월드 공개 경로를 페이지 상태로 안정적으로 변환한다", () => {
  assert.equal(palworldPageFromPath("/palworld"), "home");
  assert.equal(palworldPageFromPath("/palworld/pals/"), "pals");
  assert.equal(palworldPageFromPath("/palworld/breeding"), "breeding");
  assert.equal(palworldPageFromPath("/palworld/items"), "items");
  assert.equal(palworldPageFromPath("/palworld/search"), "search");
  assert.equal(palworldPathForPage("pals"), "/palworld/pals");
  assert.equal(palworldUrl("search", new URLSearchParams({ q: "아누비스" })), "/palworld/search?q=%EC%95%84%EB%88%84%EB%B9%84%EC%8A%A4");
  assert.equal(isPalworldPath("/palworld/items"), true);
  assert.equal(isPalworldPath("/lol/summoners/jp/test-JP1"), false);
});

test("한국어·일본어·영어·ID·도감 번호 통합 검색을 정규화한다", () => {
  assert.equal(normalizePalworldSearch("  Pal   SPHERE  "), "pal sphere");
  assert.equal(matchesPalworldPal(anubis, "아누비스"), true);
  assert.equal(matchesPalworldPal(anubis, "アヌビス"), true);
  assert.equal(matchesPalworldPal(anubis, "ANUBIS"), true);
  assert.equal(matchesPalworldPal(anubis, "100"), true);
  assert.equal(matchesPalworldItem(palSphere, "pal_sphere"), true);
  assert.equal(matchesPalworldItem(palSphere, "パルスフィア"), true);
});

test("빈 통합 검색어는 네트워크 요청 전에 거부한다", async () => {
  await assert.rejects(searchPalworld("   "), /검색어/);
});

test("통합 검색 응답은 Pal과 샘플 아이템의 상태·출처를 분리해 검증한다", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const metadata = {
    gameVersion: "1.0.1",
    sourceName: "고정 Pal 데이터",
    sourceUrl: "https://example.com/palworld-source",
    sourceRevision: "fixed-source-revision",
    extractedAt: "2026-07-01T00:00:00.000Z",
    verifiedAt: "2026-07-02T00:00:00.000Z",
    license: "테스트 전용",
  };
  const sampleMetadata = {
    ...metadata,
    gameVersion: "sample-baseline",
    sourceName: "샘플 아이템 데이터",
    sourceRevision: "sample-revision",
  };
  Object.assign(globalThis, {
    window: {
      __STREAMOPS_CONFIG__: { apiBase: "http://localhost:3000" },
      dispatchEvent: () => true,
    } as unknown as Window,
    fetch: async () => new Response(JSON.stringify({
      query: "Pal 스피어",
      total: 1,
      pals: [],
      items: [palSphere],
      metadata,
      domains: {
        pals: { status: "ready", recordCount: 287, metadata },
        items: { status: "sample", recordCount: 10, metadata: sampleMetadata },
      },
    }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  try {
    const result = await searchPalworld("Pal 스피어");
    assert.equal(result.domains.pals.status, "ready");
    assert.equal(result.domains.pals.metadata.gameVersion, "1.0.1");
    assert.equal(result.domains.items.status, "sample");
    assert.equal(result.domains.items.metadata.gameVersion, "sample-baseline");
    assert.equal(result.domains.items.metadata.sourceRevision, "sample-revision");
  } finally {
    Object.assign(globalThis, { window: originalWindow, fetch: originalFetch });
  }
});

test("교배 부모 위치 교환은 동일 부모도 안정적으로 처리한다", () => {
  assert.deepEqual(swapBreedingParents("a", "b"), ["b", "a"]);
  assert.deepEqual(swapBreedingParents("a", "a"), ["a", "a"]);
  assert.deepEqual(swapBreedingParents(null, "b"), ["b", null]);
});

test("LoL 게임 메뉴의 펠월드 경로 변경은 App 재평가 이벤트를 보낸다", () => {
  const originalWindow = globalThis.window;
  let pathname = "/";
  const events: string[] = [];
  const fakeWindow = {
    location: { get pathname() { return pathname; } },
    history: {
      pushState: (_state: unknown, _unused: string, url: string | URL | null) => { pathname = String(url); },
      replaceState: (_state: unknown, _unused: string, url: string | URL | null) => { pathname = String(url); },
    },
    dispatchEvent: (event: Event) => { events.push(event.type); return true; },
  } as unknown as Window;
  Object.assign(globalThis, { window: fakeWindow });
  try {
    setPublicPath("/palworld");
    assert.equal(pathname, "/palworld");
    assert.deepEqual(events, ["publicroutechange"]);
  } finally {
    Object.assign(globalThis, { window: originalWindow });
  }
});

test("서로 다른 API 데이터 버전을 받으면 불일치 UI 이벤트를 보낸다", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const events: string[] = [];
  const versions = ["v0.5.4", "v0.5.5"];
  Object.assign(globalThis, {
    window: {
      __STREAMOPS_CONFIG__: { apiBase: "http://localhost:3000" },
      dispatchEvent: (event: Event) => { events.push(event.type); return true; },
    } as unknown as Window,
    fetch: async () => {
      const gameVersion = versions.shift() ?? "v0.5.5";
      const metadata = {
        gameVersion,
        sourceName: "Curated test snapshot",
        sourceUrl: "https://example.com/source",
        sourceRevision: "test-revision",
        extractedAt: "2026-07-01T00:00:00.000Z",
        verifiedAt: "2026-07-02T00:00:00.000Z",
        license: "Test-only fixture",
      };
      return new Response(JSON.stringify({
        metadata,
        counts: { pals: 1, items: 1, breedingPairs: 1 },
        domains: {
          pals: { status: "ready", recordCount: 1, metadata },
          items: { status: "sample", recordCount: 1, metadata },
          breeding: { status: "sample", recordCount: 1, metadata },
        },
        gates: {
          dataIntegrity: { passed: true, status: "ready" },
          imageAssets: { passed: false, status: "blocked_by_license", readyImages: 0, fallbackPals: 1 },
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  try {
    await getPalworldMeta();
    await getPalworldMeta();
    assert.ok(events.includes(PALWORLD_VERSION_MISMATCH_EVENT));
  } finally {
    Object.assign(globalThis, { window: originalWindow, fetch: originalFetch });
  }
});
