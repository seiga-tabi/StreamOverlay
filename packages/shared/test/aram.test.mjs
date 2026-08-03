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
