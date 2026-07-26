import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { PalworldBreedingEngine } = await import("../dist/services/palworld-breeding-engine.js");
const artifact = JSON.parse(
  await readFile(new URL("../data/palworld/1.0.1/breeding.json", import.meta.url), "utf8")
);
const candidateArtifact = JSON.parse(
  await readFile(
    new URL(
      "../data/palworld/candidates/"
        + "candidate-1248184a4b527d94-delta-2108e7bd60291174/"
        + "breeding.json",
      import.meta.url
    ),
    "utf8"
  )
);
const engine = new PalworldBreedingEngine(artifact);
const codePointCompare = (left, right) =>
  left < right ? -1 : left > right ? 1 : 0;

test("일반 CombiRank 계산은 최신 고정 source의 동률 우선순위를 적용한다", () => {
  assert.deepEqual(engine.resolve({ parentAId: "penking", parentBId: "bushi" }), {
    state: "resolved",
    result: {
      parentAId: "penking",
      parentBId: "bushi",
      childId: "sibelyx",
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

test("일반 후보는 모든 특수 결과와 승인된 IgnoreCombi Pal을 제외한다", () => {
  const specialChildren = new Set(
    artifact.specialRules.map((rule) => rule.childId)
  );
  const expectedCandidates = artifact.parameters.filter((parameter) =>
    !specialChildren.has(parameter.palId)
    && parameter.ignoreCombi !== true
  );
  assert.equal(specialChildren.size, 103);
  assert.equal(expectedCandidates.length, 183);
  assert.equal(engine.generalCandidateCount, expectedCandidates.length);
  assert.equal(
    artifact.parameters.find((parameter) =>
      parameter.palId === "panthalus"
    )?.ignoreCombi,
    true
  );
});

test("특수 교배는 일반 계산보다 우선하고 부모 순서 교환을 지원한다", () => {
  const direct = engine.resolve({ parentAId: "relaxaurus", parentBId: "sparkit" });
  const swapped = engine.resolve({ parentAId: "sparkit", parentBId: "relaxaurus" });
  assert.equal(direct.result?.childId, "relaxaurus-lux");
  assert.equal(direct.result?.isSpecial, true);
  assert.equal(swapped.result?.childId, "relaxaurus-lux");
  assert.equal(swapped.result?.parentAId, "sparkit");
});

test("versioned exact alias로 복구한 Fuack 특수 교배 2건을 우선 적용한다", () => {
  assert.equal(
    engine.resolve({
      parentAId: "broncherry",
      parentBId: "fuack"
    }).result?.childId,
    "broncherry-aqua"
  );
  assert.equal(
    engine.resolve({
      parentAId: "fuack",
      parentBId: "flambelle"
    }).result?.childId,
    "fuack-ignis"
  );
  assert.equal(
    engine.resolve({
      parentAId: "flambelle",
      parentBId: "fuack"
    }).result?.childId,
    "fuack-ignis"
  );
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

test("선택 부모 index는 self 조합을 중복하지 않고 특수·성별 대안을 보존한다", () => {
  const lamballPartners = engine.partners("lamball");
  const lamballSelfPairs = lamballPartners.filter((pair) =>
    pair.parentAId === "lamball" && pair.parentBId === "lamball"
  );
  assert.equal(lamballSelfPairs.length, 1);
  assert.equal(lamballSelfPairs[0]?.childId, "lamball");
  assert.equal(
    lamballPartners.every((pair) => pair.parentAId === "lamball" || pair.parentBId === "lamball"),
    true
  );

  const genderAlternatives = engine.partners("katress").filter((pair) =>
    (pair.parentAId === "katress" && pair.parentBId === "wixen")
    || (pair.parentAId === "wixen" && pair.parentBId === "katress")
  );
  assert.deepEqual(
    genderAlternatives.map((pair) => [pair.childId, pair.parentAGender, pair.parentBGender]),
    [
      ["katress-ignis", "female", "male"],
      ["wixen-noct", "male", "female"]
    ]
  );
  assert.deepEqual(engine.partners("unknown-pal"), []);
  assert.deepEqual(engine.partners("lamball"), lamballPartners);
});

test("공통 287종의 전체 부모 결과는 고정 PAK candidate와 일치한다", () => {
  const activeById = new Map(
    artifact.parameters.map((parameter) => [parameter.palId, parameter])
  );
  const candidateComparable = {
    ...artifact,
    parameters: candidateArtifact.parameters
      .filter((parameter) => activeById.has(parameter.palId))
      .map((parameter) => {
        const active = activeById.get(parameter.palId);
        return {
          palId: parameter.palId,
          sourceRowId: parameter.sourceRowId,
          sourceInternalId: active.sourceInternalId,
          tribe: parameter.tribe,
          bpClass: parameter.bpClass,
          combiRank: parameter.combiRank,
          combiDuplicatePriority: parameter.combiDuplicatePriority,
          ignoreCombi: parameter.ignoreCombi,
          maleProbability: parameter.maleProbability / 100,
          variantType: parameter.variantType
        };
      })
      .sort((left, right) => codePointCompare(left.palId, right.palId)),
    specialRules: candidateArtifact.specialRules
      .map((rule) => ({
        parentAId: rule.parentAId,
        parentASourceInternalId:
          activeById.get(rule.parentAId).sourceInternalId,
        parentBId: rule.parentBId,
        parentBSourceInternalId:
          activeById.get(rule.parentBId).sourceInternalId,
        childId: rule.childId,
        childSourceInternalId:
          activeById.get(rule.childId).sourceInternalId,
        ...(rule.parentAGender === undefined
          ? {}
          : { parentAGender: rule.parentAGender }),
        ...(rule.parentBGender === undefined
          ? {}
          : { parentBGender: rule.parentBGender })
      }))
      .sort((left, right) =>
        codePointCompare(left.childId, right.childId)
        || codePointCompare(left.parentAId, right.parentAId)
        || codePointCompare(left.parentBId, right.parentBId)
        || codePointCompare(
          left.parentAGender ?? "",
          right.parentAGender ?? ""
        )
        || codePointCompare(
          left.parentBGender ?? "",
          right.parentBGender ?? ""
        )
      )
  };
  const candidateEngine = new PalworldBreedingEngine(candidateComparable);
  assert.equal(candidateEngine.generalCandidateCount, 183);

  let mismatches = 0;
  for (
    let parentAIndex = 0;
    parentAIndex < artifact.parameters.length;
    parentAIndex += 1
  ) {
    for (
      let parentBIndex = parentAIndex;
      parentBIndex < artifact.parameters.length;
      parentBIndex += 1
    ) {
      const parentAId = artifact.parameters[parentAIndex].palId;
      const parentBId = artifact.parameters[parentBIndex].palId;
      if (
        JSON.stringify(engine.resolve({ parentAId, parentBId }))
        !== JSON.stringify(candidateEngine.resolve({ parentAId, parentBId }))
      ) {
        mismatches += 1;
      }
    }
  }
  assert.equal(mismatches, 0);
});

test("기존 eligibility 규칙은 고정 PAK 결과와 1,734조합이 달랐다", () => {
  const nonSelfSpecialChildren = new Set(
    artifact.specialRules
      .filter((rule) =>
        !(
          rule.parentAId === rule.parentBId
          && rule.parentAId === rule.childId
        )
      )
      .map((rule) => rule.childId)
  );
  const oldCandidates = artifact.parameters.filter((parameter) =>
    !nonSelfSpecialChildren.has(parameter.palId)
  );
  const specialPairKeys = new Set(
    artifact.specialRules.map((rule) =>
      rule.parentAId <= rule.parentBId
        ? `${rule.parentAId}\0${rule.parentBId}`
        : `${rule.parentBId}\0${rule.parentAId}`
    )
  );
  const oldGeneralChild = (parentA, parentB) => {
    const targetRank = Math.floor(
      (parentA.combiRank + parentB.combiRank + 1) / 2
    );
    return oldCandidates
      .map((candidate) => ({
        candidate,
        distance: Math.abs(candidate.combiRank - targetRank)
      }))
      .sort((left, right) =>
        left.distance - right.distance
        || right.candidate.combiDuplicatePriority
          - left.candidate.combiDuplicatePriority
        || Number(left.candidate.variantType === "variant")
          - Number(right.candidate.variantType === "variant")
        || codePointCompare(left.candidate.palId, right.candidate.palId)
      )[0].candidate.palId;
  };

  let mismatches = 0;
  for (
    let parentAIndex = 0;
    parentAIndex < artifact.parameters.length;
    parentAIndex += 1
  ) {
    for (
      let parentBIndex = parentAIndex + 1;
      parentBIndex < artifact.parameters.length;
      parentBIndex += 1
    ) {
      const parentA = artifact.parameters[parentAIndex];
      const parentB = artifact.parameters[parentBIndex];
      const pairKey = parentA.palId <= parentB.palId
        ? `${parentA.palId}\0${parentB.palId}`
        : `${parentB.palId}\0${parentA.palId}`;
      if (specialPairKeys.has(pairKey)) continue;
      if (
        oldGeneralChild(parentA, parentB)
        !== engine.resolve({
          parentAId: parentA.palId,
          parentBId: parentB.palId
        }).result?.childId
      ) {
        mismatches += 1;
      }
    }
  }
  assert.equal(mismatches, 1_734);
});
