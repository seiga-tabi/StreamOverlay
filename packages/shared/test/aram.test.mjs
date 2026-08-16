import test from "node:test";
import assert from "node:assert/strict";
import { parseAramAugmentCatalog } from "../dist/index.js";

const preparingCatalog = {
  schemaVersion: 1,
  mode: "aram_augments",
  status: "preparing",
  dataVersion: "candidate",
  sourceRevision: "not_imported",
  augments: []
};

test("증강 칼바람 준비 카탈로그를 검증한다", () => {
  assert.deepEqual(parseAramAugmentCatalog(preparingCatalog), preparingCatalog);
});

test("준비 상태에 실제 증강을 섞거나 ready 상태를 비워 둘 수 없다", () => {
  const augment = {
    id: "test-augment",
    nameKo: "테스트 증강",
    nameJa: "テストオーグメント",
    descriptionKo: "테스트 설명",
    descriptionJa: "テスト説明",
    rarity: "gold"
  };
  assert.equal(parseAramAugmentCatalog({ ...preparingCatalog, augments: [augment] }), undefined);
  assert.equal(parseAramAugmentCatalog({ ...preparingCatalog, status: "ready" }), undefined);
  assert.ok(parseAramAugmentCatalog({ ...preparingCatalog, status: "ready", augments: [augment] }));
});

test("unknown field, 중복 ID, 외부 아이콘 URL을 거부한다", () => {
  const augment = {
    id: "test-augment",
    nameKo: "테스트 증강",
    nameJa: "テストオーグメント",
    descriptionKo: "테스트 설명",
    descriptionJa: "テスト説明",
    rarity: "silver"
  };
  const ready = { ...preparingCatalog, status: "ready", augments: [augment] };
  assert.equal(parseAramAugmentCatalog({ ...ready, unknown: true }), undefined);
  assert.equal(parseAramAugmentCatalog({ ...ready, augments: [augment, augment] }), undefined);
  assert.equal(parseAramAugmentCatalog({ ...ready, augments: [{ ...augment, iconUrl: "https://example.com/icon.webp" }] }), undefined);
  assert.ok(parseAramAugmentCatalog({
    ...ready,
    augments: [{ ...augment, iconUrl: `/images/lol/aram/${"a".repeat(64)}.webp` }]
  }));
});

test("실제 CommunityDragon 4단계 등급(레전드 포함)을 허용한다", () => {
  const legendAugment = {
    id: "test-legend-augment",
    nameKo: "테스트 레전드 증강",
    nameJa: "テストレジェンドオーグメント",
    descriptionKo: "테스트 설명",
    descriptionJa: "テスト説明",
    rarity: "legend"
  };
  assert.ok(parseAramAugmentCatalog({ ...preparingCatalog, status: "ready", augments: [legendAugment] }));
});

test("cdragonId는 선택적인 양의 safe integer이며 카탈로그 안에서 중복될 수 없다", () => {
  const augment = {
    id: "test-augment",
    nameKo: "테스트 증강",
    nameJa: "テストオーグメント",
    descriptionKo: "테스트 설명",
    descriptionJa: "テスト説明",
    rarity: "gold"
  };
  const ready = { ...preparingCatalog, status: "ready" };
  assert.ok(parseAramAugmentCatalog({ ...ready, augments: [augment] }));
  assert.equal(
    parseAramAugmentCatalog({ ...ready, augments: [{ ...augment, cdragonId: 123 }] })?.augments[0]?.cdragonId,
    123
  );
  for (const cdragonId of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "123"]) {
    assert.equal(
      parseAramAugmentCatalog({ ...ready, augments: [{ ...augment, cdragonId }] }),
      undefined,
      `허용되지 않는 cdragonId=${cdragonId}`
    );
  }
  assert.equal(parseAramAugmentCatalog({
    ...ready,
    augments: [
      { ...augment, cdragonId: 123 },
      { ...augment, id: "another-augment", cdragonId: 123 }
    ]
  }), undefined);
});
