import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { PalworldBreedingEngine } = await import("../dist/services/palworld-breeding-engine.js");
const artifact = JSON.parse(
  await readFile(new URL("../data/palworld/1.0.1/breeding.json", import.meta.url), "utf8")
);
const engine = new PalworldBreedingEngine(artifact);

test("일반 CombiRank 계산은 최신 고정 source의 동률 우선순위를 적용한다", () => {
  assert.deepEqual(engine.resolve({ parentAId: "penking", parentBId: "bushi" }), {
    state: "resolved",
    result: {
      parentAId: "penking",
      parentBId: "bushi",
      childId: "xenovader",
      isSpecial: false
    },
    alternatives: []
  });
});

test("동일 부모는 부모 Pal 자신을 반환한다", () => {
  const result = engine.resolve({ parentAId: "lamball", parentBId: "lamball" });
  assert.equal(result.result?.childId, "lamball");
  assert.equal(result.result?.isSpecial, false);
});

test("일반 후보에서는 non-self 특수 결과만 제외하고 canonical self 규칙은 제외하지 않는다", () => {
  const nonSelfSpecialChildren = new Set(
    artifact.specialRules
      .filter((rule) => !(rule.parentAId === rule.parentBId && rule.parentAId === rule.childId))
      .map((rule) => rule.childId)
  );
  assert.equal(nonSelfSpecialChildren.size, 79);
  assert.equal(engine.generalCandidateCount, artifact.parameters.length - nonSelfSpecialChildren.size);
  assert.equal(engine.generalCandidateCount, 208);
});

test("특수 교배는 일반 계산보다 우선하고 부모 순서 교환을 지원한다", () => {
  const direct = engine.resolve({ parentAId: "relaxaurus", parentBId: "sparkit" });
  const swapped = engine.resolve({ parentAId: "sparkit", parentBId: "relaxaurus" });
  assert.equal(direct.result?.childId, "relaxaurus-lux");
  assert.equal(direct.result?.isSpecial, true);
  assert.equal(swapped.result?.childId, "relaxaurus-lux");
  assert.equal(swapped.result?.parentAId, "sparkit");
});

test("성별 미지정 특수 교배는 임의 선택하지 않고 alternatives를 반환한다", () => {
  const result = engine.resolve({ parentAId: "katress", parentBId: "wixen" });
  assert.equal(result.state, "requires_gender");
  assert.deepEqual(
    result.alternatives.map((entry) => [entry.childId, entry.parentAGender, entry.parentBGender]),
    [
      ["katress-ignis", "female", "male"],
      ["wixen-noct", "male", "female"]
    ]
  );
});

test("성별 조건은 부모 순서와 함께 교환되고 불일치 조건은 결과 없음이다", () => {
  const direct = engine.resolve({
    parentAId: "katress",
    parentBId: "wixen",
    parentAGender: "male",
    parentBGender: "female"
  });
  assert.equal(direct.state, "resolved");
  assert.equal(direct.result?.childId, "wixen-noct");

  const swapped = engine.resolve({
    parentAId: "wixen",
    parentBId: "katress",
    parentAGender: "female",
    parentBGender: "male"
  });
  assert.deepEqual(
    [swapped.result?.childId, swapped.result?.parentAGender, swapped.result?.parentBGender],
    ["wixen-noct", "female", "male"]
  );
  assert.equal(engine.resolve({
    parentAId: "katress",
    parentBId: "wixen",
    parentAGender: "male",
    parentBGender: "male"
  }).state, "not_found");
});

test("reverse index는 시작 시 precompute되며 전체 unordered 부모 조합을 보존한다", () => {
  assert.equal(engine.pairCount, 41_329);
  const anubisParents = engine.parents("anubis");
  assert.equal(anubisParents.length, 234);
  assert.ok(anubisParents.every((pair) => pair.childId === "anubis"));
  assert.deepEqual(engine.parents("unknown-pal"), []);
});
