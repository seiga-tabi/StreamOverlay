import assert from "node:assert/strict";
import test from "node:test";
import {
  validateValorantAgentCatalogResponse,
  validateValorantLeaderboardResponse,
  validateValorantStreamerListResponse,
  validateValorantStreamerMatchesResponse
} from "../dist/valorant.js";

const localized = { ko: "한국어", ja: "日本語" };
const metadata = {
  gameVersion: "12.08",
  sourceName: "Riot Games Public Content Catalog",
  sourceUrl: "https://valorant.dyn.riotcdn.net/x/content-catalog/catalog.zip",
  extractedAt: "2026-08-11T00:00:00.000Z",
  verifiedAt: "2026-08-11T00:00:00.000Z",
  license: "Riot Games 공개 콘텐츠 정책"
};

test("발로란트 카탈로그 계약은 exact page와 로컬 이미지 URL만 허용한다", () => {
  const response = {
    state: "ready",
    items: [{
      id: "agent-id",
      name: localized,
      role: { id: "role-id", name: localized },
      description: localized,
      skills: [{ key: "C", name: localized, description: localized }],
      imageUrl: "/images/valorant/12.08/agents/agent-id.webp"
    }],
    offset: 0,
    limit: 50,
    total: 1,
    returned: 1,
    hasMore: false,
    metadata
  };
  assert.equal(validateValorantAgentCatalogResponse(response).ok, true);
  assert.equal(validateValorantAgentCatalogResponse({
    ...response,
    items: [{ ...response.items[0], imageUrl: "https://cdn.example/agent.png" }]
  }).ok, false);
  assert.equal(validateValorantAgentCatalogResponse({ state: "data_unavailable", extra: true }).ok, false);
});

test("발로란트 리더보드는 익명 계정의 Riot ID와 원본 식별자를 거부한다", () => {
  const base = {
    state: "ready",
    act: { id: "d816f426-48ea-f052-117f-9697a155b319", name: localized },
    acts: [{ id: "d816f426-48ea-f052-117f-9697a155b319", name: localized }],
    region: "kr",
    entries: [{ rank: 1, anonymous: true, rankedRating: 900, wins: 10 }],
    updatedAt: "2026-08-11T00:00:00.000Z"
  };
  assert.equal(validateValorantLeaderboardResponse(base).ok, true);
  assert.equal(validateValorantLeaderboardResponse({
    ...base,
    entries: [{ ...base.entries[0], riotId: "Secret#KR1" }]
  }).ok, false);
  assert.equal(validateValorantLeaderboardResponse({
    ...base,
    entries: [{ ...base.entries[0], puuid: "private" }]
  }).ok, false);
  assert.equal(validateValorantLeaderboardResponse({
    ...base,
    act: { ...base.act, id: "------------------------------------" }
  }).ok, false);
});

test("발로란트 스트리머 목록과 전적 계약은 공개 필드만 허용한다", () => {
  assert.equal(validateValorantStreamerListResponse({
    state: "ready",
    streamers: [{ id: "a".repeat(32), displayName: "스트리머", riotTag: "Player#KR1" }]
  }).ok, true);
  const response = {
    state: "ready",
    profile: { displayName: "스트리머", riotTag: "Player#KR1", consentBadge: true },
    offset: 0,
    limit: 20,
    total: 1,
    returned: 1,
    hasMore: false,
    matches: [{
      matchId: "match_1",
      queue: { id: "competitive", name: localized },
      map: { id: "map-id", name: localized },
      agent: { id: "agent-id", name: localized },
      win: true,
      roundsWon: 13,
      roundsLost: 9,
      kills: 20,
      deaths: 15,
      assists: 4,
      headshotPercent: null,
      startedAt: "2026-08-11T00:00:00.000Z",
      durationSeconds: 2100
    }]
  };
  assert.equal(validateValorantStreamerMatchesResponse(response).ok, true);
  assert.equal(validateValorantStreamerMatchesResponse({
    ...response,
    profile: { ...response.profile, puuid: "private" }
  }).ok, false);
});
