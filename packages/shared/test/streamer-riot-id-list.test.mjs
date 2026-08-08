import test from "node:test";
import assert from "node:assert/strict";

const { parseStreamerRiotIdRequestListResponse } = await import("../dist/index.js");

function item(overrides = {}) {
  return {
    id: "request-1",
    twitchLogin: "streamer",
    twitchDisplayName: "Streamer",
    riotGameName: "Riot Player",
    riotTagLine: "JP1",
    status: "pending",
    requestedAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
    verification: {
      account: {
        state: "exists",
        evidence: "fresh_cache",
        observedAt: "2026-08-08T00:00:00.000Z"
      },
      rank: {
        queueType: "RANKED_SOLO_5x5",
        tier: "GOLD",
        rank: "II",
        leaguePoints: 30,
        fetchedAt: "2026-08-08T00:00:00.000Z"
      },
      lastPlayedAt: "2026-08-07T23:00:00.000Z",
      twitchDisplayNameComparison: {
        normalizedExactMatch: false,
        method: "nfkc_lowercase_ignore_whitespace"
      }
    },
    ...overrides
  };
}

test("관리자 Riot ID 목록 parser는 legacy 무인자 응답과 pagination 응답을 검증한다", () => {
  const legacy = parseStreamerRiotIdRequestListResponse({ requests: [item()] });
  assert.equal(legacy?.requests[0]?.id, "request-1");
  assert.equal(legacy?.requests[0]?.verification.rank?.tier, "GOLD");
  assert.equal(legacy?.pagination, undefined);

  const cursor = "opaque_cursor.signature";
  const paged = parseStreamerRiotIdRequestListResponse({
    requests: [item()],
    pagination: { limit: 50, total: 2, returned: 1, hasMore: true, nextCursor: cursor }
  });
  assert.equal(paged?.pagination?.nextCursor, cursor);
});

test("관리자 Riot ID 목록 parser는 capability·unknown 필드와 malformed verification을 거부한다", () => {
  assert.equal(parseStreamerRiotIdRequestListResponse({
    requests: [item({ dashboardKey: "capability-secret" })]
  }), undefined);
  assert.equal(parseStreamerRiotIdRequestListResponse({
    requests: [item({ updatedAt: "not-a-date" })]
  }), undefined);
  assert.equal(parseStreamerRiotIdRequestListResponse({
    requests: [item({ verification: { account: { state: "exists", evidence: "fresh_cache" } } })]
  }), undefined);
  assert.equal(parseStreamerRiotIdRequestListResponse({
    requests: [item()],
    pagination: { limit: 50, total: 2, returned: 1, hasMore: true }
  }), undefined);
});
