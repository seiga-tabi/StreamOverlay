import test from "node:test";
import assert from "node:assert/strict";

const {
  REACTION_TIER_TABLE,
  parseReactionSubmission,
  reactionAnonymousLabel,
  reactionPercentile,
  reactionTierDistribution,
  reactionTierForAverage,
} = await import("../dist/services/reaction-records.js");
const {
  reactionShareRouteForPath,
  reactionShareSeoMetadata,
} = await import("../dist/routes/public-seo.js");

function submission(overrides = {}) {
  return { averageMs: 200, samples: [190, 200, 210, 195, 205], identity: "public", ...overrides };
}

test("티어 경계는 프런트 REACTION_TIER_TABLE 과 같은 값이다", () => {
  /* 단일 원본은 apps/dashboard/src/features/public-games/registry.ts 입니다.
     서버가 OG 메타에 티어를 새기느라 복제했으므로, 한쪽만 바꾸면 공유 이미지와
     화면 배지가 어긋납니다. 값 자체를 여기서 고정합니다. */
  assert.deepEqual(
    REACTION_TIER_TABLE.map((tier) => [tier.key, tier.maxMs]),
    [
      ["challenger", 160], ["grandmaster", 175], ["master", 190], ["diamond", 205],
      ["emerald", 220], ["gold", 240], ["silver", 265], ["bronze", 300],
      ["iron", Number.POSITIVE_INFINITY],
    ],
  );
  /* 경계값은 "이하"가 그 티어입니다. */
  assert.equal(reactionTierForAverage(160).key, "challenger");
  assert.equal(reactionTierForAverage(161).key, "grandmaster");
  assert.equal(reactionTierForAverage(300).key, "bronze");
  assert.equal(reactionTierForAverage(301).key, "iron");
  assert.equal(reactionTierForAverage(9_999).key, "iron");
});

test("등록 입력은 samples 평균과 대조해 조작된 기록을 거른다", () => {
  assert.deepEqual(parseReactionSubmission(submission()), {
    averageMs: 200,
    samples: [190, 200, 210, 195, 205],
    identity: "public",
  });

  /* 클라이언트가 보낸 평균만 믿으면 임의 기록을 올릴 수 있습니다. */
  assert.equal(parseReactionSubmission(submission({ averageMs: 130 })), undefined);
  /* 반올림 오차 ±1 은 허용합니다. */
  assert.ok(parseReactionSubmission(submission({ averageMs: 201 })));
  assert.equal(parseReactionSubmission(submission({ averageMs: 202 })), undefined);

  /* 개수·범위 경계 */
  assert.equal(parseReactionSubmission(submission({ samples: [200, 200, 200, 200] })), undefined);
  assert.equal(parseReactionSubmission(submission({ samples: [119, 200, 200, 200, 200] })), undefined);
  assert.equal(parseReactionSubmission(submission({ samples: [5_001, 200, 200, 200, 200] })), undefined);
  assert.equal(
    parseReactionSubmission({ averageMs: 2_400, samples: [2_400, 2_400, 2_400, 2_400, 2_400], identity: "public" }),
    undefined,
    "평균 상한 2000ms 초과는 거부",
  );

  /* identity 는 두 값만 */
  assert.equal(parseReactionSubmission(submission({ identity: "secret" })), undefined);
  assert.equal(parseReactionSubmission(submission({ identity: undefined })), undefined);

  /* 형식 자체가 아닌 값 */
  assert.equal(parseReactionSubmission(null), undefined);
  assert.equal(parseReactionSubmission("200"), undefined);
  assert.equal(parseReactionSubmission(submission({ samples: [Number.NaN, 200, 200, 200, 200] })), undefined);
});

test("백분위는 표본이 2명 이상일 때만 계산한다", () => {
  assert.equal(reactionPercentile(1, 100), 1);
  assert.equal(reactionPercentile(50, 100), 50);
  assert.equal(reactionPercentile(100, 100), 100);
  /* 1위는 올림해도 상위 1% 로 보여야 합니다. */
  assert.equal(reactionPercentile(1, 3), 34);
  /* 혼자이거나 기록이 없으면 의미가 없어 생략합니다(프런트 옵셔널). */
  assert.equal(reactionPercentile(1, 1), undefined);
  assert.equal(reactionPercentile(1, 0), undefined);
});

test("티어 분포는 0인 티어도 자리를 지킨다", () => {
  const distribution = reactionTierDistribution([150, 155, 210, 400]);
  assert.equal(distribution.length, REACTION_TIER_TABLE.length);
  const byKey = Object.fromEntries(distribution.map((item) => [item.tierKey, item.count]));
  assert.equal(byKey.challenger, 2);
  assert.equal(byKey.emerald, 1);
  assert.equal(byKey.iron, 1);
  assert.equal(byKey.master, 0, "기록이 없는 티어도 0 으로 남습니다");
});

test("익명 라벨은 4자리 고정 폭이다", () => {
  assert.equal(reactionAnonymousLabel(4_821), "#4821");
  assert.equal(reactionAnonymousLabel(7), "#0007");
});

test("공유 경로는 id 형식이 맞을 때만 잡힌다", () => {
  assert.deepEqual(reactionShareRouteForPath("/ko/games/reaction/r/abcd1234efgh"), {
    locale: "ko",
    shareId: "abcd1234efgh",
  });
  assert.equal(reactionShareRouteForPath("/ja/games/reaction/r/abcd1234efgh")?.locale, "ja");
  /* 로케일 프리픽스가 없어도 기본 ko */
  assert.equal(reactionShareRouteForPath("/games/reaction/r/abcd1234efgh")?.locale, "ko");
  /* 너무 짧거나 허용 문자 밖이면 공유 경로가 아닙니다. */
  assert.equal(reactionShareRouteForPath("/ko/games/reaction/r/short"), undefined);
  assert.equal(reactionShareRouteForPath("/ko/games/reaction/r/has space12"), undefined);
  assert.equal(reactionShareRouteForPath("/ko/games/reaction"), undefined);
});

test("공유 메타는 기록·티어를 제목에 싣고 계정 단서를 남기지 않는다", () => {
  const ko = reactionShareSeoMetadata(
    { locale: "ko", shareId: "abcd1234efgh" },
    { averageMs: 187, tierKey: "master", tierEmoji: "🟣", tierLabel: "마스터", displayName: "YORO QA", percentile: 12 },
  );
  assert.equal(ko.title, "187ms · 🟣 마스터 — YORO.gg 반응속도");
  assert.equal(ko.description, "YORO QA의 기록 · 상위 12% · 나도 도전해 보세요");
  assert.equal(ko.imageUrl, "https://yoro.gg/images/yorogg-og-reaction-master.png");
  assert.equal(ko.canonicalUrl, "https://yoro.gg/ko/games/reaction/r/abcd1234efgh");

  const ja = reactionShareSeoMetadata(
    { locale: "ja", shareId: "abcd1234efgh" },
    { averageMs: 187, tierKey: "master", tierEmoji: "🟣", tierLabel: "マスター", percentile: 12 },
  );
  assert.equal(ja.title, "187ms · 🟣 マスター — YORO.gg 反応速度");
  /* 익명 기록은 이름 없이 고정 문구입니다. */
  assert.equal(ja.description, "匿名のチャレンジャーの記録 · 上位 12% · あなたも挑戦してみてください");
  assert.equal(ja.locale, "ja");
  /* 티어 이미지에 문구가 박혀 있어 ja 는 -ja 판을 내립니다. */
  assert.equal(ja.imageUrl, "https://yoro.gg/images/yorogg-og-reaction-master-ja.png");

  /* 표본이 얇아 백분위가 없으면 그 조각만 빠집니다. */
  const noPercentile = reactionShareSeoMetadata(
    { locale: "ko", shareId: "abcd1234efgh" },
    { averageMs: 187, tierKey: "master", tierEmoji: "🟣", tierLabel: "마스터" },
  );
  assert.equal(noPercentile.description, "익명의 도전자의 기록 · 나도 도전해 보세요");

  /* 이미지가 없는 티어는 게임 대표 이미지로 떨어집니다. */
  const unknownTier = reactionShareSeoMetadata(
    { locale: "ko", shareId: "abcd1234efgh" },
    { averageMs: 187, tierKey: "platinum", tierEmoji: "🔷", tierLabel: "플래티넘" },
  );
  assert.equal(unknownTier.imageUrl, "https://yoro.gg/images/yorogg-og-games.png");
  const unknownTierJa = reactionShareSeoMetadata(
    { locale: "ja", shareId: "abcd1234efgh" },
    { averageMs: 187, tierKey: "platinum", tierEmoji: "🔷", tierLabel: "プラチナ" },
  );
  assert.equal(unknownTierJa.imageUrl, "https://yoro.gg/images/yorogg-og-games-ja.png");
});
