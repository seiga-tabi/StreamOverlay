import assert from "node:assert/strict";
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
