import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  adaptPalworldPaldexArtifact,
  loadPalworldPaldexRuntimeRelease
} = await import("../dist/data/palworld-paldex-adapter.js");
const { validatePalworldPalDetail } = await import("@streamops/shared");

const releaseRoot = new URL("../data/palworld/1.0.1/", import.meta.url);
const artifact = JSON.parse(readFileSync(new URL("paldex.json", releaseRoot), "utf8"));

test("artifact adapter는 287종을 Shared snapshot으로 명시 변환하고 internal ID를 분리한다", () => {
  const adapted = adaptPalworldPaldexArtifact(artifact);
  assert.equal(adapted.snapshot.metadata.gameVersion, "1.0.1");
  assert.equal(adapted.snapshot.pals.length, 287);
  assert.equal(adapted.snapshot.items.length, 0);
  assert.equal(adapted.snapshot.breedingPairs.length, 0);
  assert.equal(adapted.sourceInternalIds.lamball, "SheepBall");

  const [first, middle, last] = [
    adapted.snapshot.pals[0],
    adapted.snapshot.pals[143],
    adapted.snapshot.pals[286]
  ];
  assert.deepEqual([first.id, middle.id, last.id], ["lamball", "rayhound", "panthalus"]);
  for (const pal of adapted.snapshot.pals) {
    assert.equal(validatePalworldPalDetail(pal).ok, true);
    assert.equal("sourceInternalId" in pal, false);
    assert.equal(pal.partnerSkill, undefined);
    assert.deepEqual(pal.activeSkills, []);
    assert.deepEqual(pal.drops, []);
    assert.deepEqual(pal.breeding.specialParentPairs, []);
    assert.equal(pal.imageUrl, undefined);
  }
});

test("adapter 결과는 중첩 객체까지 immutable이다", () => {
  const adapted = adaptPalworldPaldexArtifact(artifact);
  assert.equal(Object.isFrozen(adapted), true);
  assert.equal(Object.isFrozen(adapted.snapshot), true);
  assert.equal(Object.isFrozen(adapted.snapshot.pals), true);
  assert.equal(Object.isFrozen(adapted.snapshot.pals[0]), true);
  assert.equal(Object.isFrozen(adapted.snapshot.pals[0].stats), true);
  assert.equal(Object.isFrozen(adapted.sourceInternalIds), true);
  assert.throws(() => {
    adapted.snapshot.pals[0].nameKo = "변조";
  }, TypeError);
});

test("adapter는 명시적으로 승인되지 않은 artifact imageUrl을 runtime에 전달하지 않는다", () => {
  const withUnapprovedImage = structuredClone(artifact);
  withUnapprovedImage.records[0].imageUrl = `/images/palworld/1.0.1/pals/${"a".repeat(64)}.webp`;
  const adapted = adaptPalworldPaldexArtifact(withUnapprovedImage);
  assert.equal(adapted.snapshot.pals[0].imageUrl, undefined);
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
    status: "blocked_by_license",
    policyStatus: "operator_acknowledged",
    technicalPassed: false,
    publicActivationAllowed: false,
    rightsVerified: false,
    usageBasis: "operator_reference_use",
    readyImages: 0,
    fallbackPals: 287,
    publicNoticeRequired: true
  });
});
