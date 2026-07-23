import assert from "node:assert/strict";
import test from "node:test";
import type { PalworldItemSummary, PalworldPalSummary } from "@streamops/shared";
import { getPalworldBreeding, getPalworldMeta, getPalworldSkill, getPalworldSkills, PalworldApiError, PALWORLD_VERSION_MISMATCH_EVENT, searchPalworld } from "../src/features/public-palworld/api/palworld";
import { setPublicPath } from "../src/features/public-lol/utils/routes";
import { clearPalworldBreedingParams, palworldBreedingParams, parsePalworldBreedingQuery, swapBreedingParents } from "../src/features/public-palworld/utils/breeding";
import { isKnownPalworldPagePath, isPalworldPath, palworldPageFromPath, palworldPathForPage, palworldTwitchReturnTo, palworldUrl } from "../src/features/public-palworld/utils/routes";
import { matchesPalworldItem, matchesPalworldPal, normalizePalworldSearch } from "../src/features/public-palworld/utils/search";
import { resolvePalworldDescription, resolvePalworldLocalizedText, resolvePalworldName } from "../src/features/public-palworld/utils/localization";
import { palworldSeoMetadata } from "../src/features/public-palworld/utils/seo";
import { palworldHomeLiveStreamerCards, sortedFollowedTwitchChannels } from "../src/features/public-palworld/utils/streamers";
import { getPublicTwitchFollowedChannels, getPublicTwitchStatus, logoutPublicTwitch, publicTwitchLoginUrl } from "../src/features/public-twitch/api";

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
  assert.equal(palworldPageFromPath("/palworld/streamers"), "streamers");
  assert.equal(palworldPageFromPath("/palworld/pals/"), "pals");
  assert.equal(palworldPageFromPath("/palworld/breeding"), "breeding");
  assert.equal(palworldPageFromPath("/palworld/items"), "items");
  assert.equal(palworldPageFromPath("/palworld/skills"), "skills");
  assert.equal(palworldPageFromPath("/palworld/map"), "map");
  assert.equal(palworldPageFromPath("/palworld/search"), "search");
  assert.equal(palworldPathForPage("pals"), "/palworld/pals");
  assert.equal(palworldPathForPage("streamers"), "/palworld/streamers");
  assert.equal(palworldPathForPage("map"), "/palworld/map");
  assert.equal(palworldPathForPage("skills"), "/palworld/skills");
  assert.equal(palworldUrl("search", new URLSearchParams({ q: "아누비스" })), "/palworld/search?q=%EC%95%84%EB%88%84%EB%B9%84%EC%8A%A4");
  assert.equal(isPalworldPath("/palworld/items"), true);
  assert.equal(isPalworldPath("/lol/summoners/jp/test-JP1"), false);
  assert.equal(isKnownPalworldPagePath("/palworld/breeding"), true);
  assert.equal(isKnownPalworldPagePath("/palworld/breeding/"), true);
  assert.equal(isKnownPalworldPagePath("/palworld/not-a-page"), false);
});

test("Palworld Twitch 복귀 경로는 허용된 현재 경로와 기존 query만 보존한다", () => {
  assert.equal(palworldTwitchReturnTo("/palworld", ""), "/palworld");
  assert.equal(palworldTwitchReturnTo("/palworld/streamers", "?view=all"), "/palworld/streamers?view=all");
  assert.equal(palworldTwitchReturnTo("/palworld/map", ""), "/palworld/map");
  assert.equal(palworldTwitchReturnTo("/palworld/skills", "?type=active"), "/palworld/skills?type=active");
  assert.equal(palworldTwitchReturnTo("/palworld/search", "?q=%EC%95%84%EB%88%84%EB%B9%84%EC%8A%A4&viewer_twitch=connected"), "/palworld/search?q=%EC%95%84%EB%88%84%EB%B9%84%EC%8A%A4");
  assert.equal(palworldTwitchReturnTo("//evil.example", "?q=x"), "/palworld");
  assert.equal(palworldTwitchReturnTo("/palworld\\streamers", ""), "/palworld");
  assert.match(publicTwitchLoginUrl("/palworld/search?q=Pal"), /\/api\/public\/twitch\/auth\/start\?return_to=%2Fpalworld%2Fsearch%3Fq%3DPal$/u);
});

test("Palworld LIVE 목록은 Twitch user ID로 중복 제거하고 LIVE만 최대 12개 표시한다", () => {
  const channels = Array.from({ length: 14 }, (_, index) => ({
    twitchUserId: `user-${index}`,
    twitchLogin: `streamer_${index}`,
    twitchDisplayName: `Streamer ${index}`,
    followedAt: "2026-07-22T00:00:00.000Z",
    isLive: index !== 13,
    gameName: index % 2 === 0 ? "Palworld" : "Just Chatting",
    title: `방송 ${index}`,
    viewerCount: index * 10,
  }));
  channels.splice(1, 0, { ...channels[0], twitchDisplayName: "중복 채널" });
  const cards = palworldHomeLiveStreamerCards(channels, "ko");
  assert.equal(cards.length, 12);
  assert.equal(cards.filter((card) => card.id === "user-0").length, 1);
  assert.equal(cards[0]?.primaryMeta, "Palworld");
  assert.match(cards[0]?.secondaryMeta ?? "", /방송 0 · 0명 시청/u);
  assert.equal(cards.some((card) => card.id === "user-13"), false);

  const sorted = sortedFollowedTwitchChannels([channels.at(-1)!, channels[2]]);
  assert.equal(sorted[0]?.isLive, true);
  assert.equal(sorted.at(-1)?.isLive, false);
});

test("공개 Twitch 상태·팔로우·로그아웃 요청은 공유 session cookie를 포함한다", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  Object.assign(globalThis, {
    fetch: async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (String(url).endsWith("/status")) return new Response(JSON.stringify({ connected: false, configured: true, requiredScopes: [], missingScopes: [] }), { status: 200 });
      if (String(url).includes("followed-lol")) return new Response(JSON.stringify({ connected: true, truncated: false, matchedCount: 0, subscriptionScopeGranted: false, subscriptions: [], channels: [] }), { status: 200 });
      return new Response(null, { status: 204 });
    },
  });
  try {
    await getPublicTwitchStatus();
    await getPublicTwitchFollowedChannels();
    await logoutPublicTwitch();
    assert.deepEqual(requests.map((request) => request.init?.credentials), ["include", "include", "include"]);
    assert.equal(requests[2]?.init?.method, "POST");
    assert.match(requests[1]?.url ?? "", /followed-lol\?limit=100$/u);
  } finally {
    Object.assign(globalThis, { fetch: originalFetch });
  }
});

test("손상된 Twitch 성공 응답은 렌더 데이터로 전달하지 않고 안전하게 거부한다", async () => {
  const originalFetch = globalThis.fetch;
  let responseKind: "status" | "followed" = "status";
  Object.assign(globalThis, {
    fetch: async () => new Response(JSON.stringify(responseKind === "status" ? {
      connected: true,
      configured: true,
      requiredScopes: [],
      missingScopes: [],
      user: { id: "viewer", login: null, displayName: "Viewer" },
    } : {
      connected: true,
      truncated: false,
      matchedCount: 0,
      subscriptionScopeGranted: false,
      subscriptions: [],
      channels: [{ twitchUserId: null, twitchLogin: "broken", twitchDisplayName: "Broken", followedAt: "2026-07-22T00:00:00.000Z", isLive: true }],
    }), { status: 200 }),
  });
  try {
    await assert.rejects(getPublicTwitchStatus(), /사용자 응답 형식/u);
    responseKind = "followed";
    await assert.rejects(getPublicTwitchFollowedChannels(), /팔로우 채널 응답 형식/u);
  } finally {
    Object.assign(globalThis, { fetch: originalFetch });
  }
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

test("번역 snapshot 상태에 따라 현지어·영어 fallback·원문 없음 상태를 구분한다", () => {
  const translated = {
    nameKo: "번역 아이템",
    nameJa: "翻訳アイテム",
    nameEn: "Translated Item",
    descriptionKo: "한국어로 번역된 설명이다.",
    descriptionJa: "日本語に翻訳された説明です。",
    descriptionEn: "Source description.",
    translation: {
      name: { ko: "machine_assisted" as const, ja: "machine_assisted" as const },
      description: { ko: "machine_assisted" as const, ja: "machine_assisted" as const },
    },
  };
  assert.deepEqual(resolvePalworldName(translated, "ko"), { text: "번역 아이템", status: "machine_assisted" });
  assert.deepEqual(resolvePalworldDescription(translated, "ja"), { text: "日本語に翻訳された説明です。", status: "machine_assisted" });
  assert.deepEqual(resolvePalworldName({
    nameKo: "팰 스피어",
    nameJa: "パルスフィア",
    nameEn: "Pal Sphere",
    translation: { name: { ko: "source_provided", ja: "source_provided" } },
  }, "ja"), { text: "パルスフィア", status: "source_provided" });
  assert.deepEqual(resolvePalworldName({ nameEn: "English Only" }, "ko"), { text: "English Only", status: "source_language_fallback" });
  assert.deepEqual(resolvePalworldName({
    nameKo: "노출하면 안 되는 오래된 기계번역",
    nameEn: "Safe English Name",
    translation: { name: { ko: "source_language_fallback", ja: "missing_source" } },
  }, "ko"), { text: "Safe English Name", status: "source_language_fallback" });
  assert.deepEqual(resolvePalworldLocalizedText({}, "description", "ja", undefined, undefined), { text: "", status: "missing_source" });
});

test("추가된 한국어·일본어 번역 이름은 기존 이름 검색에 포함된다", () => {
  const translatedItem: PalworldItemSummary = {
    id: "translated_item",
    nameKo: "고대의 번역석",
    nameJa: "古代の翻訳石",
    nameEn: "Ancient Translation Stone",
    category: "material",
    rarity: 1,
    translation: {
      name: { ko: "machine_assisted", ja: "machine_assisted" },
      description: { ko: "missing_source", ja: "missing_source" },
    },
  };
  assert.equal(matchesPalworldItem(translatedItem, "번역석"), true);
  assert.equal(matchesPalworldItem(translatedItem, "翻訳石"), true);
  assert.equal(matchesPalworldItem(translatedItem, "translation stone"), true);
});

test("빈 통합 검색어는 네트워크 요청 전에 거부한다", async () => {
  await assert.rejects(searchPalworld("   "), /검색어/);
});

test("Palworld API client는 network·timeout·손상 응답을 결과 없음과 구분한다", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  Object.assign(globalThis, {
    window: {
      __STREAMOPS_CONFIG__: { apiBase: "http://localhost:3000" },
      dispatchEvent: () => true,
    } as unknown as Window,
  });
  try {
    Object.assign(globalThis, {
      fetch: async () => {
        throw new TypeError("network unavailable");
      },
    });
    await assert.rejects(
      () => searchPalworld("도로롱"),
      (error: unknown) => error instanceof PalworldApiError
        && error.status === 0
        && error.code === "PALWORLD_NETWORK_ERROR",
    );

    Object.assign(globalThis, {
      fetch: async () => new Response("{", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    });
    await assert.rejects(
      () => searchPalworld("도로롱"),
      (error: unknown) => error instanceof PalworldApiError
        && error.status === 502
        && error.code === "PALWORLD_RESPONSE_INVALID",
    );

    Object.assign(globalThis, {
      setTimeout: ((handler: TimerHandler) => {
        queueMicrotask(() => {
          if (typeof handler === "function") handler();
        });
        return 1;
      }) as typeof globalThis.setTimeout,
      clearTimeout: (() => undefined) as typeof globalThis.clearTimeout,
      fetch: async (_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
    });
    await assert.rejects(
      () => searchPalworld("도로롱"),
      (error: unknown) => error instanceof PalworldApiError
        && error.status === 504
        && error.code === "PALWORLD_REQUEST_TIMEOUT",
    );
  } finally {
    Object.assign(globalThis, {
      window: originalWindow,
      fetch: originalFetch,
      setTimeout: originalSetTimeout,
      clearTimeout: originalClearTimeout,
    });
  }
});

test("Palworld SEO metadata는 locale과 route를 반영하고 상세 query 대신 base page를 canonical로 사용한다", () => {
  const koreanHome = palworldSeoMetadata("home", "ko");
  const japaneseBreeding = palworldSeoMetadata("breeding", "ja");
  const search = palworldSeoMetadata("search", "ko");
  assert.equal(koreanHome.canonicalUrl, "https://yoro.gg/palworld");
  assert.match(koreanHome.title, /펠월드 데이터베이스/u);
  assert.match(koreanHome.description, /Pal/u);
  assert.equal(japaneseBreeding.canonicalUrl, "https://yoro.gg/palworld/breeding");
  assert.match(japaneseBreeding.title, /配合組み合わせ/u);
  assert.match(japaneseBreeding.description, /親/u);
  assert.equal(search.canonicalUrl, "https://yoro.gg/palworld/search");
  assert.doesNotMatch(search.canonicalUrl, /\?/u);
});

test("스킬 목록과 상세 API는 shared validator를 통과한 데이터만 반환한다", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const metadata = {
    gameVersion: "1.0.1.100619",
    sourceName: "고정 스킬 데이터",
    sourceUrl: "https://example.com/palworld-skills",
    sourceRevision: "db70ea654aea70c4b1a4b0045bccfe58164cf01a",
    extractedAt: "2026-07-22T00:00:00.000Z",
    verifiedAt: "2026-07-22T00:00:00.000Z",
    license: "테스트 전용",
  };
  const summary = {
    id: "active-fire-ball-fire-45-2",
    type: "active",
    nameEn: "Fire Ball",
    descriptionEn: "Flame attack",
    element: "fire",
    power: 45,
    cooldownSeconds: 2,
    relatedPalCount: 1,
    localization: { sourceLanguage: "en", ko: "source_language_fallback", ja: "source_language_fallback" },
  };
  const requested: string[] = [];
  Object.assign(globalThis, {
    window: { __STREAMOPS_CONFIG__: { apiBase: "http://localhost:3000" }, dispatchEvent: () => true } as unknown as Window,
    fetch: async (url: string | URL | Request) => {
      requested.push(String(url));
      const body = String(url).includes("/skills/")
        ? { ...summary, relatedPals: [{ pal: { id: "foxparks", number: 5, nameKo: "파비오", nameJa: "キツネビ", nameEn: "Foxparks", elements: ["fire"] } }], metadata }
        : { items: [summary], pagination: { page: 1, pageSize: 24, total: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false }, metadata };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  try {
    const list = await getPalworldSkills(new URLSearchParams("type=active&element=fire&sort=power&order=desc&limit=24"));
    const detail = await getPalworldSkill(summary.id);
    assert.equal(list.items[0]?.nameEn, "Fire Ball");
    assert.equal(detail.relatedPals[0]?.pal.id, "foxparks");
    assert.match(requested[0] ?? "", /\/api\/palworld\/skills\?type=active&element=fire&sort=power&order=desc&limit=24$/u);
    assert.match(requested[1] ?? "", /\/api\/palworld\/skills\/active-fire-ball-fire-45-2$/u);
  } finally {
    Object.assign(globalThis, { window: originalWindow, fetch: originalFetch });
  }
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

test("교배 URL query는 exact ID·성별·mode·page만 상태로 복원한다", () => {
  const direct = parsePalworldBreedingQuery(new URLSearchParams("mode=parents&parentA=lamball&parentB=cattiva&parentAGender=male&parentBGender=female"));
  assert.deepEqual(direct, {
    ok: true,
    state: {
      mode: "parents",
      parentA: "lamball",
      parentB: "cattiva",
      parentAGender: "male",
      parentBGender: "female",
      page: 1,
    },
  });
  assert.deepEqual(parsePalworldBreedingQuery(new URLSearchParams("mode=child&child=anubis&page=2")), {
    ok: true,
    state: { mode: "child", child: "anubis", page: 2 },
  });
  for (const invalid of [
    "mode=unknown",
    "mode=parents&parentA=Anubis",
    "mode=parents&parentA=anubis&parentAGender=unknown",
    "mode=parents&parentA=anubis&parentA=cattiva",
    "mode=child&child=anubis&page=0",
    "mode=child&child=anubis&parentA=lamball",
  ]) {
    assert.equal(parsePalworldBreedingQuery(new URLSearchParams(invalid)).ok, false, invalid);
  }
});

test("교배 URL 직렬화와 초기화는 Modal 등 다른 query를 보존한다", () => {
  const current = new URLSearchParams("pal=anubis&mode=parents&parentA=lamball&parentB=cattiva");
  const child = palworldBreedingParams(current, { mode: "child", child: "anubis", page: 3 });
  assert.equal(child.get("pal"), "anubis");
  assert.equal(child.get("mode"), "child");
  assert.equal(child.get("child"), "anubis");
  assert.equal(child.get("page"), "3");
  assert.equal(child.has("parentA"), false);
  assert.equal(clearPalworldBreedingParams(child).toString(), "pal=anubis");
});

test("교배 API는 optional 성별 query를 전달하고 503 code를 보존한다", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  Object.assign(globalThis, {
    window: {
      __STREAMOPS_CONFIG__: { apiBase: "http://localhost:3000" },
      dispatchEvent: () => true,
    } as unknown as Window,
    fetch: async (url: string | URL | Request) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify({
        error: "PALWORLD_DATA_UNAVAILABLE",
        message: "Palworld 데이터를 사용할 수 없습니다.",
      }), { status: 503, headers: { "content-type": "application/json" } });
    },
  });
  try {
    await assert.rejects(
      () => getPalworldBreeding("lamball", "cattiva", {
        parentAGender: "male",
        parentBGender: "female",
      }),
      (error: unknown) => error instanceof PalworldApiError
        && error.status === 503
        && error.code === "PALWORLD_DATA_UNAVAILABLE",
    );
    const url = new URL(requestedUrl);
    assert.equal(url.searchParams.get("parentA"), "lamball");
    assert.equal(url.searchParams.get("parentB"), "cattiva");
    assert.equal(url.searchParams.get("parentAGender"), "male");
    assert.equal(url.searchParams.get("parentBGender"), "female");
  } finally {
    Object.assign(globalThis, { window: originalWindow, fetch: originalFetch });
  }
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
          imageAssets: {
            status: "blocked_by_license",
            policyStatus: "operator_acknowledged",
            technicalPassed: false,
            publicActivationAllowed: false,
            rightsVerified: false,
            usageBasis: "operator_reference_use",
            readyImages: 0,
            fallbackPals: 1,
            publicNoticeRequired: true,
          },
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
