import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePatchChangeSummary,
  patchStatLabel,
} from "../src/features/public-lol/types/patch-change-summary";

/* 패치 변경 요약 파서 — 목업 docs/mockups/lol-patch-summary-share.html v1.2 §④ 계약.
   서버가 아직 이 계약을 구현하지 않아, 화면이 검증되지 않은 값으로 "이 패치가
   이렇게 바뀌었다"를 말하지 않게 하는 것이 이 파서의 일입니다. */

const validSummary = {
  patchVersion: "26.16",
  comparedVersions: ["16.15.1", "16.16.1"],
  systemChanges: [{ stat: "spellblock", from: 30, to: 33, championCount: 27 }],
  championChanges: [{
    championId: 78,
    name: "뽀삐",
    iconUrl: "https://cdn/Poppy.png",
    direction: "buff",
    changes: [{ stat: "mp", from: 280, to: 300 }],
  }],
  itemChanges: [{ itemId: 3068, name: "태양불꽃 방패", kind: "price", from: 2700, to: 2800 }],
  skillChangesIncluded: false,
};

test("패치 요약: 정상 응답을 그대로 통과시킨다", () => {
  const summary = parsePatchChangeSummary(validSummary);
  assert.ok(summary);
  assert.equal(summary.patchVersion, "26.16");
  assert.deepEqual(summary.comparedVersions, ["16.15.1", "16.16.1"]);
  assert.equal(summary.systemChanges[0]?.championCount, 27);
  assert.equal(summary.championChanges[0]?.direction, "buff");
  assert.equal(summary.itemChanges[0]?.to, 2800);
  /* 스킬 변경 미포함을 응답이 밝힙니다 — 화면이 한계 문구를 지어내지 않게 합니다. */
  assert.equal(summary.skillChangesIncluded, false);
});

test("패치 요약: 형식을 벗어난 응답은 통째로 버린다", () => {
  assert.equal(parsePatchChangeSummary(undefined), undefined);
  assert.equal(parsePatchChangeSummary({ ...validSummary, patchVersion: "26" }), undefined);
  assert.equal(parsePatchChangeSummary({ ...validSummary, comparedVersions: ["16.16.1"] }), undefined);
  /* 세 목록이 모두 비면 보여 줄 것이 없습니다 — 빈 패널을 그리지 않습니다. */
  assert.equal(
    parsePatchChangeSummary({ ...validSummary, systemChanges: [], championChanges: [], itemChanges: [] }),
    undefined,
  );
});

test("패치 요약: 앞뒤가 맞지 않는 항목만 골라 버린다", () => {
  const summary = parsePatchChangeSummary({
    ...validSummary,
    systemChanges: [
      { stat: "spellblock", from: 30, to: 33, championCount: 27 },
      /* 변화가 없는 항목은 요약이 아닙니다. */
      { stat: "armor", from: 30, to: 30, championCount: 9 },
      /* 챔피언 수가 없으면 "몇 명이 받았는지"를 화면이 말할 수 없습니다. */
      { stat: "hp", from: 600, to: 620 },
    ],
    championChanges: [
      { championId: 78, name: "뽀삐", direction: "buff", changes: [{ stat: "mp", from: 280, to: 300 }] },
      /* 알 수 없는 방향은 버프/너프 배지를 만들 수 없습니다. */
      { championId: 1, name: "애니", direction: "unknown", changes: [{ stat: "hp", from: 1, to: 2 }] },
      /* 변경 목록이 비면 조정 내용이 없는 것입니다. */
      { championId: 2, name: "올라프", direction: "nerf", changes: [] },
    ],
    itemChanges: [
      { itemId: 3068, name: "태양불꽃 방패", kind: "price", from: 2700, to: 2800 },
      /* 가격 변경인데 값이 없으면 화면이 "→" 만 그리게 됩니다. */
      { itemId: 3153, name: "몰락한 왕의 검", kind: "price" },
    ],
  });
  assert.ok(summary);
  assert.equal(summary.systemChanges.length, 1);
  assert.equal(summary.championChanges.length, 1);
  assert.equal(summary.itemChanges.length, 1);
});

test("패치 요약: 스탯 라벨은 화면이 붙이고 모르는 키는 그대로 쓴다", () => {
  assert.equal(patchStatLabel("spellblock", "ko"), "마법 저항력");
  assert.equal(patchStatLabel("spellblock", "ja"), "魔法防御");
  assert.equal(patchStatLabel("attackdamage", "ko"), "공격력");
  /* 새 스탯이 생겨도 화면이 빈 라벨을 그리지 않습니다. */
  assert.equal(patchStatLabel("brandNewStat", "ko"), "brandNewStat");
});
