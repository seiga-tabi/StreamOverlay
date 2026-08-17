import assert from "node:assert/strict";
import test from "node:test";

import {
  MINI_GAMES,
  readMiniGameBest,
  reactionMsToNextTier,
  reactionTierForAverage,
  REACTION_TIER_TABLE,
  writeMiniGameBest,
} from "../src/features/public-games/registry";

function withMemoryStorage<T>(run: () => T): T {
  const store = new Map<string, string>();
  const original = (globalThis as { window?: unknown }).window;
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
      },
    },
  });
  try {
    return run();
  } finally {
    Object.assign(globalThis, { window: original });
  }
}

test("REACTION_TIER_TABLE: 경계값이 오름차순이고 마지막은 무한대다", () => {
  for (let index = 1; index < REACTION_TIER_TABLE.length; index += 1) {
    assert.ok(REACTION_TIER_TABLE[index]!.maxMs > REACTION_TIER_TABLE[index - 1]!.maxMs);
  }
  assert.equal(REACTION_TIER_TABLE.at(-1)!.maxMs, Number.POSITIVE_INFINITY);
});

test("reactionTierForAverage: 경계 포함 매핑", () => {
  assert.equal(reactionTierForAverage(160).key, "challenger");
  assert.equal(reactionTierForAverage(161).key, "grandmaster");
  assert.equal(reactionTierForAverage(240).key, "gold");
  assert.equal(reactionTierForAverage(241).key, "silver");
  assert.equal(reactionTierForAverage(999).key, "iron");
});

test("reactionMsToNextTier: 상위 티어 경계까지의 ms, 챌린저는 없음", () => {
  const next = reactionMsToNextTier(228);
  assert.equal(next?.tier.key, "emerald");
  assert.equal(next?.deltaMs, 8);
  assert.equal(reactionMsToNextTier(150), undefined);
});

test("writeMiniGameBest: 낮을수록 좋은 점수만 갱신한다", () => {
  withMemoryStorage(() => {
    const reaction = MINI_GAMES.find((game) => game.id === "reaction")!;
    assert.equal(writeMiniGameBest(reaction, { score: 220, tierKey: "gold", at: "2026-08-17T00:00:00Z" }), true);
    // 더 느린 기록은 저장하지 않는다.
    assert.equal(writeMiniGameBest(reaction, { score: 240, tierKey: "gold", at: "2026-08-17T00:01:00Z" }), false);
    assert.equal(readMiniGameBest("reaction")?.score, 220);
    assert.equal(writeMiniGameBest(reaction, { score: 199, tierKey: "diamond", at: "2026-08-17T00:02:00Z" }), true);
    assert.equal(readMiniGameBest("reaction")?.score, 199);
  });
});

test("readMiniGameBest: 저장소 접근 불가·손상 데이터는 null(fail-open)", () => {
  const original = (globalThis as { window?: unknown }).window;
  Object.assign(globalThis, {
    window: { localStorage: { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } } },
  });
  try {
    assert.equal(readMiniGameBest("reaction"), null);
  } finally {
    Object.assign(globalThis, { window: original });
  }
  withMemoryStorage(() => {
    window.localStorage.setItem("yoro.games.reaction.best.v1", "{broken json");
    assert.equal(readMiniGameBest("reaction"), null);
  });
});
