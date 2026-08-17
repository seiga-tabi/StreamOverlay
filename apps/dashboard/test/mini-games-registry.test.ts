import assert from "node:assert/strict";
import test from "node:test";

import {
  MINI_GAMES,
  readMiniGameBest,
  reactionMsToNextTier,
  reactionTierForAverage,
  REACTION_TIER_TABLE,
  syncMiniGameBestFromServer,
  writeMiniGameBest,
} from "../src/features/public-games/registry";
import { gamesI18n } from "../src/features/public-games/i18n/games-i18n";
import { gamesSeoMetadata } from "../src/features/public-games/utils/seo";

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

test("syncMiniGameBestFromServer: 계정 기록이 더 빠를 때만 로컬 캐시에 합류한다", () => {
  withMemoryStorage(() => {
    const reaction = MINI_GAMES.find((game) => game.id === "reaction")!;
    // 새 기기(로컬 없음): 서버 기록 채택 → 기기 간 표시 일치.
    assert.equal(syncMiniGameBestFromServer(reaction, { score: 180, tierKey: "master" }), true);
    assert.equal(readMiniGameBest("reaction")?.score, 180);
    // 서버가 더 느리면(이 기기의 미등록 신기록) 로컬 유지 — 자동 등록은 하지 않는다.
    assert.equal(syncMiniGameBestFromServer(reaction, { score: 210, tierKey: "emerald" }), false);
    assert.equal(readMiniGameBest("reaction")?.score, 180);
    // 서버가 더 빠르면(다른 기기에서 갱신) 채택.
    assert.equal(syncMiniGameBestFromServer(reaction, { score: 165, tierKey: "grandmaster" }), true);
    assert.equal(readMiniGameBest("reaction")?.score, 165);
    // me 없음(비로그인·서버 미배포) → 무동작.
    assert.equal(syncMiniGameBestFromServer(reaction, undefined), false);
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

test("미니게임 SEO 문구는 서버 렌더 메타와 한 글자도 다르지 않다", () => {
  /* 서버가 준 title 을 applyGamesSeo 가 덮어쓰므로, 두 값이 다르면 크롤러가 받는
     HTML 과 최종 DOM 이 어긋납니다. 서버 쪽 원본은
     apps/server/src/routes/public-seo.ts 의 KOREAN_CONTENT/JAPANESE_CONTENT 이며,
     아래 기대값은 그 파일과 같은 문구를 그대로 옮긴 것입니다. 한쪽만 고치면
     이 테스트가 깨져 불일치를 즉시 잡습니다. */
  const expected = {
    ko: {
      hub: {
        title: "미니게임 | YORO.gg",
        description: "게이머 반사신경 훈련장 — 반응속도 테스트로 내 LoL 티어를 확인해 보세요.",
        canonicalUrl: "https://yoro.gg/ko/games",
      },
      reaction: {
        title: "반응속도 테스트 | YORO.gg",
        description: "초록 신호에 최대한 빨리! 5회 평균으로 LoL 티어 등급을 받아보세요.",
        canonicalUrl: "https://yoro.gg/ko/games/reaction",
      },
    },
    ja: {
      hub: {
        title: "ミニゲーム | YORO.gg",
        description: "ゲーマーの反射神経トレーニング — 反応速度テストで自分のLoLティアを確認しましょう。",
        canonicalUrl: "https://yoro.gg/ja/games",
      },
      reaction: {
        title: "反応速度テスト | YORO.gg",
        description: "緑の信号にできるだけ早く! 5回平均でLoLティア等級を確認しましょう。",
        canonicalUrl: "https://yoro.gg/ja/games/reaction",
      },
    },
  } as const;

  for (const locale of ["ko", "ja"] as const) {
    for (const page of ["hub", "reaction"] as const) {
      assert.deepEqual(gamesSeoMetadata(page, locale), expected[locale][page], `${locale}/${page}`);
    }
  }

  /* 화면 라벨과 SEO 제목은 일부러 다릅니다 — 네비는 짧게, 제목은 구체적으로.
     실수로 다시 navReaction 을 제목에 물리면 여기서 걸립니다. */
  assert.notEqual(gamesI18n.ko.navReaction, gamesI18n.ko.seoTitleReaction);
  assert.notEqual(gamesI18n.ja.navReaction, gamesI18n.ja.seoTitleReaction);
});
