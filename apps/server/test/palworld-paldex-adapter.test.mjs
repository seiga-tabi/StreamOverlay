import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  adaptPalworldPaldexArtifact,
  loadPalworldPaldexRuntimeRelease
} = await import("../dist/data/palworld-paldex-adapter.js");
const { assertPalworldPaldexArtifact } = await import("../dist/data/palworld-paldex-artifact.js");
const releaseRoot = new URL("../data/palworld/1.0.1/", import.meta.url);
const artifact = JSON.parse(readFileSync(new URL("paldex.json", releaseRoot), "utf8"));

test("기본 Pal artifact adapter는 287종의 canonical 수치와 internal ID를 분리한다", () => {
  const adapted = adaptPalworldPaldexArtifact(artifact);
  assert.equal(adapted.metadata.gameVersion, "1.0.1");
  assert.equal(adapted.pals.length, 287);
  assert.equal(adapted.sourceInternalIds.lamball, "SheepBall");

  const [first, middle, last] = [
    adapted.pals[0],
    adapted.pals[143],
    adapted.pals[286]
  ];
  assert.deepEqual([first.id, middle.id, last.id], ["lamball", "rayhound", "panthalus"]);
  for (const pal of adapted.pals) {
    assert.equal("sourceInternalId" in pal, false);
    assert.equal(Number.isFinite(pal.stats.hp), true);
    assert.equal(Number.isInteger(pal.breedingPower), true);
    assert.equal(pal.imageUrl, undefined);
  }
  assert.equal(first.descriptionEn.length > 0, true);
  assert.equal(first.partnerSkill.type, "partner");
  assert.equal(first.activeSkills.length, 7);
  assert.deepEqual(first.rawDrops.map((drop) => drop.itemId), ["wool", "meat-sheep-ball"]);
});

test("Paldex v2는 고정 출처·상세 coverage와 특수 교배 성별 조건을 보존한다", () => {
  assert.equal(artifact.schemaVersion, 2);
  assert.deepEqual(artifact.detailProvenance, {
    sourceName: "pyPalworldAPI 0.2.0",
    sourceRevision: "db70ea654aea70c4b1a4b0045bccfe58164cf01a",
    sourceChecksum: "42676bdc3ecb6820e31fe8f18c875ba7ac226de5de78ddf966a92808709d5115",
    gameVersion: "1.0.1.100619",
    license: "MIT_CODE_ONLY_GAME_ASSET_RIGHTS_NOT_VERIFIED",
    rightsVerified: false,
    breedingSourceName: "Awy64/palworld-atlas-data breeding.json",
    breedingSourceRevision: "24181105",
    breedingSourceChecksum: "8869d768d80d24e8443e6a82a3be338a092b4a656d77d6938a5265c3e2a164bb",
    exactPalDetails: 270,
    palDetailsWithoutSource: 17,
    specialBreedingPairs: 79,
    unresolvedBreedingReferences: 75,
    genderedBreedingPairs: 2
  });
  assert.equal(artifact.records.filter((pal) => pal.descriptionEn).length, 268);
  assert.equal(artifact.records.filter((pal) => pal.partnerSkill).length, 270);
  assert.equal(artifact.records.reduce((total, pal) => total + pal.activeSkills.length, 0), 1_869);
  assert.equal(artifact.records.reduce((total, pal) => total + pal.drops.length, 0), 541);
  assert.equal(artifact.records.reduce((total, pal) => total + pal.specialParentPairs.length, 0), 79);

  const adapted = adaptPalworldPaldexArtifact(artifact);
  const genderedPairs = adapted.pals.flatMap((pal) => pal.specialParentPairs.map((pair) => ({
    childId: pal.id,
    ...pair
  }))).filter((pair) => pair.parentAGender || pair.parentBGender);
  assert.deepEqual(genderedPairs, [
    {
      childId: "wixen-noct",
      parentAId: "katress",
      parentBId: "wixen",
      parentAGender: "male",
      parentBGender: "female"
    },
    {
      childId: "katress-ignis",
      parentAId: "katress",
      parentBId: "wixen",
      parentAGender: "female",
      parentBGender: "male"
    }
  ]);
});

test("Paldex v2 validator는 특수 교배 orphan과 provenance coverage 변조를 거부한다", () => {
  const orphan = structuredClone(artifact);
  orphan.records.find((pal) => pal.specialParentPairs.length > 0).specialParentPairs[0].parentAId = "missing-pal";
  assert.throws(() => assertPalworldPaldexArtifact(orphan), /도감에 없는 부모 Pal 참조/u);

  const wrongCoverage = structuredClone(artifact);
  wrongCoverage.detailProvenance.specialBreedingPairs = 78;
  assert.throws(() => assertPalworldPaldexArtifact(wrongCoverage), /실제 특수 교배 수와 일치/u);
});

test("adapter 결과는 중첩 객체까지 immutable이다", () => {
  const adapted = adaptPalworldPaldexArtifact(artifact);
  assert.equal(Object.isFrozen(adapted), true);
  assert.equal(Object.isFrozen(adapted.pals), true);
  assert.equal(Object.isFrozen(adapted.pals[0]), true);
  assert.equal(Object.isFrozen(adapted.pals[0].stats), true);
  assert.equal(Object.isFrozen(adapted.pals[0].activeSkills), true);
  assert.equal(Object.isFrozen(adapted.sourceInternalIds), true);
  assert.throws(() => {
    adapted.pals[0].nameKo = "변조";
  }, TypeError);
});

test("adapter는 명시적으로 승인되지 않은 artifact imageUrl을 runtime에 전달하지 않는다", () => {
  const withUnapprovedImage = structuredClone(artifact);
  withUnapprovedImage.records[0].imageUrl = `/images/palworld/1.0.1/pals/${"a".repeat(64)}.webp`;
  const adapted = adaptPalworldPaldexArtifact(withUnapprovedImage);
  assert.equal(adapted.pals[0].imageUrl, undefined);
});

test("runtime release는 data gate와 image gate를 독립적으로 노출한다", async () => {
  const release = await loadPalworldPaldexRuntimeRelease();
  assert.equal(release.dataIntegrityGate.passed, true);
  assert.equal(release.dataIntegrityGate.status, "ready");
  assert.deepEqual(
    [release.dataIntegrityGate.counts.pals, release.dataIntegrityGate.counts.normal, release.dataIntegrityGate.counts.variant],
    [287, 203, 84]
  );
  assert.equal(release.dataIntegrityGate.checksumsVerified, true);
  assert.deepEqual(release.imageAssetGate, {
    status: "partial",
    policyStatus: "operator_acknowledged",
    technicalPassed: true,
    publicActivationAllowed: true,
    rightsVerified: false,
    usageBasis: "operator_reference_use",
    readyImages: 272,
    fallbackPals: 15,
    publicNoticeRequired: true
  });
});
