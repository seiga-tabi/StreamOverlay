import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const {
  assertPalworldBreedingArtifact,
  loadPalworldBreedingRuntimeSource,
  palworldBreedingSourceChecksumsSha256
} = await import("../dist/data/palworld-breeding-artifact.js");

const releaseRoot = new URL("../data/palworld/1.0.1/", import.meta.url);
const artifact = JSON.parse(await readFile(new URL("breeding.json", releaseRoot), "utf8"));

test("고정 교배 artifact는 source 수량과 field limitation을 정확히 보존한다", async () => {
  const loaded = await loadPalworldBreedingRuntimeSource(releaseRoot.pathname);
  assert.equal(loaded.artifact.parameters.length, 287);
  assert.equal(loaded.artifact.specialRules.length, 184);
  assert.deepEqual(loaded.manifest.counts, {
    parameters: 287,
    sourceSpecialRows: 257,
    includedSpecialRows: 184,
    includedSelfRules: 103,
    includedNonSelfRules: 81,
    genderedRules: 2,
    unresolvedSourceRows: 73
  });
  assert.equal(loaded.report.status, "incomplete");
  assert.deepEqual(loaded.report.fieldCoverage.ignoreCombi, { available: 1, missing: 286, total: 287 });
  assert.equal(
    loaded.artifact.parameters.find((parameter) =>
      parameter.palId === "panthalus"
    )?.ignoreCombi,
    true
  );
  assert.ok(loaded.report.limitations.includes("IGNORE_COMBI_NOT_AVAILABLE_IN_LOCKED_COMPACT_SOURCE"));
  assert.deepEqual(loaded.artifact.metadata.sourceChecksums, {
    atlasPals: "57fb4bf837061c1160d5f72755152245fe793e1b0073328714efd63c65ba5b47",
    atlasBreeding: "dc39e4c8646eaa7f61573d832dcb854d31184713dfc815e0221dc83d947ae559",
    palCalc: "803d891afdb18bd00e24332844a7276bbe5c0855170ef90ef142f2f4d7698ed1",
    catalog: "9ee539c494a9785680a56d96c0dff810ee5433ff1f3f75628be238b7cf268552",
    breedingSourceAliases: "8992fac459283350bade62cd2618fbc0adf4648dac2049d667319fcd1b8c6817",
    breedingEligibilityCompatibility: "b67fe710e5ce4032a845be3facf45df75be46727cfe0e813ef9196c44ecb6b40",
    candidateBreeding: "a52de9c23598bd1e5bba6ddc664e965cac5ec3a95dd39b2839a8b193533a1e9c"
  });
  assert.equal(
    loaded.manifest.sourceChecksumsSha256,
    palworldBreedingSourceChecksumsSha256(
      loaded.artifact.metadata.sourceChecksums
    )
  );
});

test("active composite selector는 source identity가 포함된 교배 artifact와 manifest를 exact pin한다", async () => {
  const active = JSON.parse(await readFile(
    new URL("../data/palworld/runtime/active-manifest.json", import.meta.url),
    "utf8"
  ));
  const checksumFor = async (fileName) => createHash("sha256")
    .update(await readFile(new URL(fileName, releaseRoot)))
    .digest("hex");
  assert.equal(
    active.composite.artifacts.find((entry) => entry.kind === "breeding")?.sha256,
    await checksumFor("breeding.json")
  );
  assert.equal(
    active.composite.artifacts.find((entry) =>
      entry.kind === "breeding-manifest"
    )?.sha256,
    await checksumFor("breeding-manifest.json")
  );
});

test("교배 artifact validator는 unknown field, NaN, 고아 참조, 잘못된 성별과 중복 조건을 거부한다", () => {
  const unknown = structuredClone(artifact);
  unknown.unexpected = true;
  assert.throws(() => assertPalworldBreedingArtifact(unknown), /허용되지 않은 필드/u);

  const nan = structuredClone(artifact);
  nan.parameters[0].combiRank = Number.NaN;
  assert.throws(() => assertPalworldBreedingArtifact(nan), /정수/u);

  const orphan = structuredClone(artifact);
  orphan.specialRules[0].childId = "unknown-pal";
  assert.throws(() => assertPalworldBreedingArtifact(orphan), /존재하지 않는 canonical Pal/u);

  const gender = structuredClone(artifact);
  gender.specialRules[0].parentAGender = "unknown";
  assert.throws(() => assertPalworldBreedingArtifact(gender), /male 또는 female/u);

  const duplicate = structuredClone(artifact);
  duplicate.specialRules.splice(1, 0, structuredClone(duplicate.specialRules[0]));
  assert.throws(() => assertPalworldBreedingArtifact(duplicate), /중복|정렬/u);

  const missingCompatibilityChecksum = structuredClone(artifact);
  delete missingCompatibilityChecksum.metadata.sourceChecksums
    .breedingEligibilityCompatibility;
  assert.throws(
    () => assertPalworldBreedingArtifact(missingCompatibilityChecksum),
    /breedingEligibilityCompatibility.*필수/u
  );
});

test("runtime loader는 breeding artifact checksum 변조를 거부한다", async (context) => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "palworld-breeding-checksum-"));
  context.after(async () => rm(temporaryRoot, { recursive: true, force: true }));
  for (const fileName of ["breeding.json", "breeding-manifest.json", "breeding-import-report.json"]) {
    await copyFile(new URL(fileName, releaseRoot), path.join(temporaryRoot, fileName));
  }
  const breedingPath = path.join(temporaryRoot, "breeding.json");
  const bytes = await readFile(breedingPath);
  bytes[bytes.length - 2] = bytes[bytes.length - 2] === 0x7d ? 0x20 : 0x7d;
  await writeFile(breedingPath, bytes);
  await assert.rejects(
    () => loadPalworldBreedingRuntimeSource(temporaryRoot),
    /checksum/u
  );
});

test("runtime loader는 artifact hash를 다시 맞춰도 source checksum identity 변조를 거부한다", async (context) => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "palworld-breeding-provenance-"));
  context.after(async () => rm(temporaryRoot, { recursive: true, force: true }));
  for (const fileName of ["breeding.json", "breeding-manifest.json", "breeding-import-report.json"]) {
    await copyFile(new URL(fileName, releaseRoot), path.join(temporaryRoot, fileName));
  }
  const modifiedArtifact = structuredClone(artifact);
  modifiedArtifact.metadata.sourceChecksums.candidateBreeding = "0".repeat(64);
  const artifactText = `${JSON.stringify(modifiedArtifact, null, 2)}\n`;
  await writeFile(path.join(temporaryRoot, "breeding.json"), artifactText);
  const manifestPath = path.join(temporaryRoot, "breeding-manifest.json");
  const modifiedManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  modifiedManifest.breedingSha256 = createHash("sha256")
    .update(artifactText)
    .digest("hex");
  await writeFile(
    manifestPath,
    `${JSON.stringify(modifiedManifest, null, 2)}\n`
  );
  await assert.rejects(
    () => loadPalworldBreedingRuntimeSource(temporaryRoot),
    /source checksum identity/u
  );
});
