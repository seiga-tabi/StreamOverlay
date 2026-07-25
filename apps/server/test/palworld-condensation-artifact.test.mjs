import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const {
  PALWORLD_CONDENSATION_RULES_FILE,
  PalworldCondensationArtifactError,
  assertPalworldCondensationRulesArtifact,
  createPalworldPalCondensationProfile,
  loadPalworldCondensationRules
} = await import("../dist/data/palworld-condensation-artifact.js");

const temporaryRoots = [];
const release = "1.0.1";
const steamBuildId = "24181105";
const sourceRevision =
  "atlas@0385b3fd8bd757240d4a2c79615145122669abd5+palcalc@211dd9fe520cbff9c5e3b9f8ec4f132669869714";
const paldexSha256 = "a".repeat(64);

function artifact() {
  return {
    schemaVersion: 1,
    release,
    steamBuildId,
    sourceRevision,
    paldexSha256,
    status: "operator_reviewed_compatibility",
    evidence: {
      kind: "operator_provided_reference",
      evidenceSha256: "b".repeat(64),
      reviewedAt: "2026-07-24T00:12:16Z",
      reviewer: "operator"
    },
    statRule: {
      affectedStats: [
        "hp",
        "attack",
        "defense",
        "meleeAttack",
        "shotAttack"
      ],
      stages: [
        { stars: 0, bonusPercent: 0 },
        { stars: 1, bonusPercent: 5 },
        { stars: 2, bonusPercent: 10 },
        { stars: 3, bonusPercent: 15 },
        { stars: 4, bonusPercent: 20 }
      ]
    },
    workSuitabilityRule: {
      status: "unresolved_rule"
    }
  };
}

async function writeArtifact(value = artifact()) {
  const canonicalTmp = await realpath(tmpdir());
  const root = await mkdtemp(path.join(canonicalTmp, "palworld-condensation-"));
  temporaryRoots.push(root);
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  await writeFile(path.join(root, PALWORLD_CONDENSATION_RULES_FILE), bytes);
  return {
    root,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

function expectation(root, artifactSha256) {
  return {
    releaseRoot: root,
    expectedRelease: release,
    expectedSteamBuildId: steamBuildId,
    expectedSourceRevision: sourceRevision,
    expectedPaldexSha256: paldexSha256,
    expectedArtifactSha256: artifactSha256
  };
}

function pal() {
  return {
    id: "fixture-pal",
    number: 1,
    nameKo: "테스트 팰",
    nameJa: "テストパル",
    nameEn: "Fixture Pal",
    elements: ["neutral"],
    rarity: 1,
    variantType: "normal",
    stats: {
      hp: 101,
      attack: 80,
      defense: 70,
      moveSpeed: 300,
      stamina: 100,
      meleeAttack: 90
    },
    workSuitabilities: [
      { type: "handiwork", level: 2 }
    ],
    activeSkills: [],
    drops: [],
    nocturnal: false,
    metadata: {
      gameVersion: release,
      sourceName: "fixture",
      sourceUrl: "https://example.com/palworld-fixture",
      sourceRevision,
      extractedAt: "2026-07-24T00:00:00Z",
      verifiedAt: "2026-07-24T00:00:00Z",
      license: "fixture"
    },
    breeding: {
      specialParentPairs: []
    }
  };
}

test.after(async () => {
  for (const root of temporaryRoots) {
    await rm(root, { recursive: true, force: true });
  }
});

test("release에 고정된 농축 규칙을 로드하고 0★~4★ 능력치를 계산한다", async () => {
  const fixture = await writeArtifact();
  const loaded = await loadPalworldCondensationRules(
    expectation(fixture.root, fixture.sha256)
  );
  assert.equal(loaded.artifact.release, release);
  assert.equal(loaded.artifactSha256, fixture.sha256);
  assert.equal(loaded.artifact.workSuitabilityRule.status, "unresolved_rule");
  assert.equal(Object.isFrozen(loaded.artifact), true);
  assert.equal(Object.isFrozen(loaded.artifact.statRule), true);
  assert.equal(Object.isFrozen(loaded.artifact.statRule.stages), true);
  assert.throws(() => {
    loaded.artifact.statRule.stages[4].bonusPercent = 99;
  }, TypeError);

  const profile = createPalworldPalCondensationProfile(pal(), loaded);
  assert.equal(profile.availability, "available");
  assert.equal(profile.sourceRuleSha256, fixture.sha256);
  assert.deepEqual(
    profile.stages.map((stage) => [
      stage.stars,
      stage.characterRank,
      stage.partnerSkillRank
    ]),
    [
      [0, 1, 1],
      [1, 2, 2],
      [2, 3, 3],
      [3, 4, 4],
      [4, 5, 5]
    ]
  );
  assert.deepEqual(
    profile.stages[4].stats,
    [
      { stat: "hp", baseValue: 101, value: 121.2 },
      { stat: "attack", baseValue: 80, value: 96 },
      { stat: "defense", baseValue: 70, value: 84 },
      { stat: "meleeAttack", baseValue: 90, value: 108 }
    ]
  );
  assert.equal(
    profile.stages.some((stage) =>
      stage.stats.some((entry) => entry.stat === "moveSpeed")
    ),
    false
  );
  assert.equal(
    profile.stages.every((stage) => stage.workSuitabilities.length === 0),
    true
  );
});

test("artifact는 unknown field, 잘못된 단계 순서와 유한하지 않은 값을 거부한다", () => {
  const unknown = artifact();
  unknown.extra = true;
  assert.throws(
    () => assertPalworldCondensationRulesArtifact(unknown),
    PalworldCondensationArtifactError
  );

  const reordered = artifact();
  reordered.statRule.stages[1].stars = 2;
  assert.throws(
    () => assertPalworldCondensationRulesArtifact(reordered),
    /stages\[1\]\.stars/u
  );

  const infinite = artifact();
  infinite.statRule.stages[1].bonusPercent = Number.POSITIVE_INFINITY;
  assert.throws(
    () => assertPalworldCondensationRulesArtifact(infinite),
    /유한한 숫자/u
  );
});

test("release identity와 각 checksum이 다르면 fail-closed 처리한다", async () => {
  const fixture = await writeArtifact();
  const cases = [
    ["expectedRelease", "1.0.2", /release/u],
    ["expectedSteamBuildId", "24181106", /Steam build ID/u],
    ["expectedSourceRevision", `${sourceRevision}-other`, /source revision/u],
    ["expectedPaldexSha256", "c".repeat(64), /Paldex SHA-256/u],
    ["expectedArtifactSha256", "d".repeat(64), /artifact SHA-256/u]
  ];
  for (const [field, value, error] of cases) {
    const input = expectation(fixture.root, fixture.sha256);
    input[field] = value;
    await assert.rejects(
      () => loadPalworldCondensationRules(input),
      error
    );
  }
});

test("JSON 변조와 symlink artifact를 거부한다", async () => {
  const fixture = await writeArtifact();
  await writeFile(
    path.join(fixture.root, PALWORLD_CONDENSATION_RULES_FILE),
    "{\"schemaVersion\":1}\n",
    "utf8"
  );
  await assert.rejects(
    () =>
      loadPalworldCondensationRules(
        expectation(fixture.root, fixture.sha256)
      ),
    /artifact SHA-256/u
  );

  const targetFixture = await writeArtifact();
  const canonicalTmp = await realpath(tmpdir());
  const symlinkRoot = await mkdtemp(
    path.join(canonicalTmp, "palworld-condensation-link-")
  );
  temporaryRoots.push(symlinkRoot);
  await symlink(
    path.join(targetFixture.root, PALWORLD_CONDENSATION_RULES_FILE),
    path.join(symlinkRoot, PALWORLD_CONDENSATION_RULES_FILE)
  );
  await assert.rejects(
    () =>
      loadPalworldCondensationRules(
        expectation(symlinkRoot, targetFixture.sha256)
      ),
    /artifact를 안전하게 읽을 수 없습니다|canonical regular file/u
  );
});

test("직접 구성한 객체는 검증된 loader 결과처럼 주입할 수 없다", () => {
  assert.throws(
    () =>
      createPalworldPalCondensationProfile(pal(), {
        artifact: artifact(),
        artifactSha256: "e".repeat(64)
      }),
    /검증된 loader 결과/u
  );
});
