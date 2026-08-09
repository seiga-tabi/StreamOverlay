import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("LoL 추가 전적 미리 준비와 클릭 요청은 하나의 네트워크 요청을 공유한다", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  Object.assign(globalThis, {
    window: {
      __STREAMOPS_CONFIG__: { apiBase: "http://localhost:3000" }
    } as unknown as Window
  });

  const page = {
    status: "ready" as const,
    riotId: "HideOnBush#KR1",
    gameName: "HideOnBush",
    tagLine: "KR1",
    accountRegion: "asia",
    lolPlatform: "kr",
    recentMatches: [],
    recentMatchStart: 10,
    nextRecentMatchStart: 20,
    hasMoreRecentMatches: true,
    fetchedAt: "2026-08-04T00:00:00.000Z"
  };
  let fetchCount = 0;
  let releaseFetch: (() => void) | undefined;
  const fetchGate = new Promise<void>((resolve) => {
    releaseFetch = resolve;
  });
  globalThis.fetch = async () => {
    fetchCount += 1;
    await fetchGate;
    return new Response(JSON.stringify(page), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const {
      getPublicLolMatchPage,
      invalidatePublicLolMatchPageCache,
      prefetchPublicLolMatchPage
    } = await import("../src/features/public-lol/api/lol");
    const prefetch = prefetchPublicLolMatchPage("HideOnBush#KR1", 10, "kr");
    const click = getPublicLolMatchPage("HideOnBush#KR1", 10, "kr");
    releaseFetch?.();
    const [, response] = await Promise.all([prefetch, click]);

    assert.equal(fetchCount, 1);
    assert.equal(response.recentMatchStart, 10);
    assert.equal((await getPublicLolMatchPage("HideOnBush#KR1", 10, "kr")).recentMatchStart, 10);
    assert.equal(fetchCount, 1, "준비된 페이지는 메모리 캐시에서 즉시 반환해야 한다");

    invalidatePublicLolMatchPageCache("HideOnBush#KR1", "kr");
    await getPublicLolMatchPage("HideOnBush#KR1", 10, "kr");
    assert.equal(fetchCount, 2, "전적 갱신 뒤에는 이전 추가 페이지 캐시를 재사용하면 안 된다");
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(globalThis, { window: originalWindow });
  }
});

test("칼바람과 솔로랭크 전적은 서로 다른 query와 캐시로 조회한다", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  Object.assign(globalThis, {
    window: {
      __STREAMOPS_CONFIG__: { apiBase: "http://localhost:3000" }
    } as unknown as Window
  });

  const requestedUrls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);
    const queue = new URL(url).searchParams.get("queue");
    return new Response(JSON.stringify({
      status: "ready",
      riotId: "AramPlayer#JP1",
      gameName: "AramPlayer",
      tagLine: "JP1",
      accountRegion: "asia",
      lolPlatform: "jp1",
      recentMatches: [],
      recentMatchStart: 0,
      nextRecentMatchStart: 10,
      hasMoreRecentMatches: false,
      fetchedAt: queue === "aram" ? "2026-08-06T00:00:00.000Z" : "2026-08-06T00:01:00.000Z"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const { getPublicLolMatchPage, invalidatePublicLolMatchPageCache } = await import("../src/features/public-lol/api/lol");
    invalidatePublicLolMatchPageCache("AramPlayer#JP1", "jp1");

    const aram = await getPublicLolMatchPage("AramPlayer#JP1", 0, "jp1", undefined, "aram");
    const solo = await getPublicLolMatchPage("AramPlayer#JP1", 0, "jp1", undefined, "solo");
    const cachedSolo = await getPublicLolMatchPage("AramPlayer#JP1", 0, "jp1", undefined, "solo");

    assert.equal(aram.fetchedAt, "2026-08-06T00:00:00.000Z");
    assert.equal(solo.fetchedAt, "2026-08-06T00:01:00.000Z");
    assert.equal(cachedSolo.fetchedAt, solo.fetchedAt);
    assert.equal(requestedUrls.length, 2);
    assert.equal(new URL(requestedUrls[0]!).searchParams.get("queue"), "aram");
    assert.equal(new URL(requestedUrls[1]!).searchParams.get("queue"), "solo");
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(globalThis, { window: originalWindow });
  }
});

test("match-ranks API는 Shared schema를 벗어난 응답을 티어 섹션 오류로 격리한다", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  Object.assign(globalThis, {
    window: {
      __STREAMOPS_CONFIG__: { apiBase: "http://localhost:3000" }
    } as unknown as Window
  });
  const valid = {
    status: "ready",
    matchId: "JP1_123",
    participants: [{ championId: 1 }],
    fetchedAt: "2026-08-08T00:00:00.000Z"
  };
  try {
    const { getPublicLolMatchRanks } = await import("../src/features/public-lol/api/lol");
    globalThis.fetch = async () => new Response(JSON.stringify(valid), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    assert.deepEqual(await getPublicLolMatchRanks(valid.matchId), valid);

    globalThis.fetch = async () => new Response(JSON.stringify({
      ...valid,
      participants: [{ championId: "손상" }]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    await assert.rejects(getPublicLolMatchRanks(valid.matchId));

    globalThis.fetch = async () => new Response(JSON.stringify({
      ...valid,
      matchId: "JP1_999"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    await assert.rejects(getPublicLolMatchRanks(valid.matchId));
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(globalThis, { window: originalWindow });
  }
});

test("match-ranks 오류는 전적 상세를 유지하고 티어 섹션에 안전하게 안내한다", () => {
  const source = readFileSync(new URL("../src/pages/PublicLolPage.tsx", import.meta.url), "utf8");
  assert.match(source, /<MatchLaneCompareView[\s\S]*\{rankError \? <FormError role="status">\{rankError\}<\/FormError> : null\}/u);
  assert.match(source, /setMatchRankErrors\(\(current\) => \(\{ \.\.\.current, \[matchId\]: t\(\)\.tierUnavailable \}\)\)/u);
});
