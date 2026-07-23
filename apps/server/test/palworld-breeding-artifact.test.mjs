import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const {
  assertPalworldBreedingArtifact,
  loadPalworldBreedingRuntimeSource
} = await import("../dist/data/palworld-breeding-artifact.js");

const releaseRoot = new URL("../data/palworld/1.0.1/", import.meta.url);
const artifact = JSON.parse(await readFile(new URL("breeding.json", releaseRoot), "utf8"));

test("고정 교배 artifact는 source 수량과 field limitation을 정확히 보존한다", async () => {
  const loaded = await loadPalworldBreedingRuntimeSource(releaseRoot.pathname);
  assert.equal(loaded.artifact.parameters.length, 287);
  assert.equal(loaded.artifact.specialRules.length, 182);
  assert.deepEqual(loaded.manifest.counts, {
    parameters: 287,
    sourceSpecialRows: 257,
    includedSpecialRows: 182,
    includedSelfRules: 103,
    includedNonSelfRules: 79,
    genderedRules: 2,
    unresolvedSourceRows: 75
  });
  assert.equal(loaded.report.status, "incomplete");
  assert.deepEqual(loaded.report.fieldCoverage.ignoreCombi, { available: 0, missing: 287, total: 287 });
  assert.ok(loaded.report.limitations.includes("IGNORE_COMBI_NOT_AVAILABLE_IN_LOCKED_COMPACT_SOURCE"));
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
