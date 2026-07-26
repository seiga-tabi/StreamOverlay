import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  assertPalworldBreedingEligibilityCompatibilityArtifact,
  loadPalworldBreedingEligibilityCompatibility,
  palworldBreedingEligibilityEvidenceChecksum,
  verifyPalworldBreedingEligibilityCompatibility
} = await import(
  "../dist/data/palworld-breeding-eligibility-compatibility.js"
);

const releaseRoot = new URL("../data/palworld/1.0.1/", import.meta.url);
const candidateRoot = new URL(
  "../data/palworld/candidates/"
    + "candidate-1248184a4b527d94-delta-2108e7bd60291174/",
  import.meta.url
);
const mappingUrl = new URL(
  "../src/data/palworld-mappings/"
    + "breeding-eligibility-compatibility.json",
  import.meta.url
);
const publicIdMapUrl = new URL(
  "../src/data/palworld-mappings/public-id-map.json",
  import.meta.url
);

const [
  compatibilityBytes,
  candidateBytes,
  activePaldexBytes,
  publicIdMapBytes,
  activeBreedingBytes
] = await Promise.all([
  readFile(mappingUrl),
  readFile(new URL("breeding.json", candidateRoot)),
  readFile(new URL("paldex.json", releaseRoot)),
  readFile(publicIdMapUrl),
  readFile(new URL("breeding.json", releaseRoot))
]);
const compatibility = JSON.parse(compatibilityBytes.toString("utf8"));
const activeBreeding = JSON.parse(activeBreedingBytes.toString("utf8"));

test("교배 eligibility 호환성은 고정 candidate와 active 공통 287종을 exact 검증한다", async () => {
  const loaded = await loadPalworldBreedingEligibilityCompatibility();
  assert.deepEqual(loaded.artifact, compatibility);
  const verified = verifyPalworldBreedingEligibilityCompatibility({
    artifact: loaded.artifact,
    artifactBytes: loaded.bytes,
    candidateBytes,
    activePaldexBytes,
    publicIdMapBytes,
    activeParameters: activeBreeding.parameters
  });
  assert.equal(verified.candidate.parameters.length, 288);
  assert.deepEqual(verified.artifact.verification, {
    activeParameters: 287,
    candidateParameters: 288,
    commonParameters: 287,
    exactParameterMismatches: 0,
    expectedGeneralCandidates: 183
  });
  assert.deepEqual(verified.artifact.overrides, [{
    palId: "panthalus",
    sourceInternalId: "KingWhale",
    field: "ignoreCombi",
    value: true,
    reason:
      "고정 operator PAK DT_PalMonsterParameter_Common exact row의 "
      + "IgnoreCombi=true를 공통 287종 검증 후 적용합니다."
  }]);
});

test("호환성 artifact는 unknown field와 evidence checksum 변조를 거부한다", () => {
  assert.throws(
    () => assertPalworldBreedingEligibilityCompatibilityArtifact({
      ...compatibility,
      unexpected: true
    }),
    /허용되지 않은 필드/u
  );
  assert.throws(
    () => assertPalworldBreedingEligibilityCompatibilityArtifact({
      ...compatibility,
      evidenceChecksum: "0".repeat(64)
    }),
    /evidence/u
  );
});

test("candidate·active·source provenance checksum 변조는 fail-closed 처리한다", () => {
  assert.throws(
    () => verifyPalworldBreedingEligibilityCompatibility({
      artifact: compatibility,
      artifactBytes: compatibilityBytes,
      candidateBytes: Buffer.concat([candidateBytes, Buffer.from(" ")]),
      activePaldexBytes,
      publicIdMapBytes,
      activeParameters: activeBreeding.parameters
    }),
    /candidate breeding checksum/u
  );
  assert.throws(
    () => verifyPalworldBreedingEligibilityCompatibility({
      artifact: compatibility,
      artifactBytes: compatibilityBytes,
      candidateBytes,
      activePaldexBytes: Buffer.concat([
        activePaldexBytes,
        Buffer.from(" ")
      ]),
      publicIdMapBytes,
      activeParameters: activeBreeding.parameters
    }),
    /active Paldex checksum/u
  );

  const {
    evidenceChecksum: _previousEvidenceChecksum,
    ...changedEvidence
  } = compatibility;
  const changedWithoutChecksum = {
    ...changedEvidence,
    sourceArchiveSha256: "a".repeat(64)
  };
  const changed = {
    ...changedWithoutChecksum,
    evidenceChecksum:
      palworldBreedingEligibilityEvidenceChecksum(changedWithoutChecksum)
  };
  assert.throws(
    () => verifyPalworldBreedingEligibilityCompatibility({
      artifact: changed,
      artifactBytes: Buffer.from(`${JSON.stringify(changed, null, 2)}\n`),
      candidateBytes,
      activePaldexBytes,
      publicIdMapBytes,
      activeParameters: activeBreeding.parameters
    }),
    /source archive/u
  );
});

test("공통 Pal의 canonical ID·source row·rank·priority 불일치는 차단한다", () => {
  const tamperedParameters = activeBreeding.parameters.map(
    (parameter, index) =>
      index === 0
        ? { ...parameter, combiRank: parameter.combiRank + 1 }
        : parameter
  );
  assert.throws(
    () => verifyPalworldBreedingEligibilityCompatibility({
      artifact: compatibility,
      artifactBytes: compatibilityBytes,
      candidateBytes,
      activePaldexBytes,
      publicIdMapBytes,
      activeParameters: tamperedParameters
    }),
    /exact join/u
  );
});
