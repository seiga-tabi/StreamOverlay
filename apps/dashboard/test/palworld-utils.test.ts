import assert from "node:assert/strict";
import test from "node:test";
import type { PalworldItemSummary, PalworldPalSummary } from "@streamops/shared";
import { getPalworldMeta, getPalworldSkill, getPalworldSkills, PALWORLD_VERSION_MISMATCH_EVENT, searchPalworld } from "../src/features/public-palworld/api/palworld";
import { setPublicPath } from "../src/features/public-lol/utils/routes";
import { swapBreedingParents } from "../src/features/public-palworld/utils/breeding";
import { isPalworldPath, palworldPageFromPath, palworldPathForPage, palworldTwitchReturnTo, palworldUrl } from "../src/features/public-palworld/utils/routes";
import { matchesPalworldItem, matchesPalworldPal, normalizePalworldSearch } from "../src/features/public-palworld/utils/search";
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

test("빈 통합 검색어는 네트워크 요청 전에 거부한다", async () => {
  await assert.rejects(searchPalworld("   "), /검색어/);
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
