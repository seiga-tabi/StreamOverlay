import assert from "node:assert/strict";
import test from "node:test";
import { parsePublicLolMatchRankResponse } from "../dist/index.js";

const validResponse = {
  status: "ready",
  matchId: "JP1_123456789",
  participants: [{
    riotId: "Player#JP1",
    teamId: 100,
    championId: 1,
    position: "TOP",
    rankedStats: {
      queueType: "RANKED_SOLO_5x5",
      tier: "GOLD",
      rank: "II",
      leaguePoints: 42,
      wins: 20,
      losses: 10,
      winRate: 66.7,
      summonerLevel: 100,
      profileIconId: 123,
      tierIconUrl: "/images/ranks/gold.webp",
      fetchedAt: "2026-08-08T00:00:00.000Z"
    }
  }],
  fetchedAt: "2026-08-08T00:00:00.000Z"
};

test("공개 match-ranks parser는 exact 응답과 선택 필드를 검증한다", () => {
  assert.deepEqual(parsePublicLolMatchRankResponse(validResponse), validResponse);
  assert.deepEqual(parsePublicLolMatchRankResponse({
    ...validResponse,
    participants: [{ championId: 2 }]
  }), {
    ...validResponse,
    participants: [{ championId: 2 }]
  });
});

test("공개 match-ranks parser는 unknown field와 손상된 참가자·랭크를 거부한다", () => {
  assert.equal(parsePublicLolMatchRankResponse({ ...validResponse, token: "노출 금지" }), undefined);
  assert.equal(parsePublicLolMatchRankResponse({
    ...validResponse,
    participants: [{ ...validResponse.participants[0], championId: "1" }]
  }), undefined);
  assert.equal(parsePublicLolMatchRankResponse({
    ...validResponse,
    participants: [{
      ...validResponse.participants[0],
      rankedStats: { ...validResponse.participants[0].rankedStats, winRate: 101 }
    }]
  }), undefined);
  assert.equal(parsePublicLolMatchRankResponse({
    ...validResponse,
    participants: Array.from({ length: 21 }, () => ({ championId: 1 }))
  }), undefined);
  assert.equal(parsePublicLolMatchRankResponse({ ...validResponse, matchId: "JP1/123" }), undefined);
  assert.equal(parsePublicLolMatchRankResponse({ ...validResponse, fetchedAt: "1" }), undefined);
});
