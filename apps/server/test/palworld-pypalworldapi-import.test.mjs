import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const importRoot = new URL("../data/palworld/_imports/pypalworldapi-0.2.0/", import.meta.url);
const releaseRoot = new URL("../data/palworld/1.0.1/", import.meta.url);
const mappingRoot = new URL("../src/data/palworld-mappings/", import.meta.url);
const publicMapRoot = new URL("../../dashboard/public/images/palworld/1.0.1/maps/", import.meta.url);

async function json(name, root) {
  return JSON.parse(await readFile(new URL(name, root), "utf8"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("pyPalworldAPI archive provenance는 고정 checksum과 선별 반입 결정을 보존한다", async () => {
  const provenance = await json("import-provenance.json", importRoot);
  const licenseBytes = await readFile(new URL("LICENSE", importRoot));

  assert.equal(provenance.schemaVersion, 1);
  assert.equal(provenance.source.archiveSha256, "42676bdc3ecb6820e31fe8f18c875ba7ac226de5de78ddf966a92808709d5115");
  assert.equal(provenance.source.sqlSha256, "aaa759027e63f13c33a1d581fd1efd4bf434472053a46e6967aad94333811f0d");
  assert.equal(sha256(licenseBytes), provenance.source.licenseFileSha256);
  assert.equal(provenance.archiveValidation.crcPassed, true);
  assert.equal(provenance.archiveValidation.unsafePaths, 0);
  assert.equal(provenance.archiveValidation.symbolicLinks, 0);
  assert.equal(provenance.dataInventory.koreanRows, 0);
  assert.equal(provenance.dataInventory.japaneseRows, 0);
  assert.equal(provenance.rights.gameAssetRightsVerified, false);
  assert.equal(provenance.itemImageAssessment.runtimeActivated, false);
  assert.equal(provenance.breedingAssessment.runtimeActivated, false);
});

test("월드 지도는 고정 원본에서 변환한 content-hash WebP 한 장만 공개한다", async () => {
  const provenance = await json("import-provenance.json", importRoot);
  const mapImport = provenance.mapImageImport;
  const mapBytes = await readFile(new URL(mapImport.outputFileName, publicMapRoot));

  assert.equal(provenance.dataInventory.mapImages, 821);
  assert.equal(mapImport.sourceFileName, "map_locations_fast_travel_world.png");
  assert.equal(mapImport.sourceSha256, "7cc1e96731ad18ebfaf8b86ab29c762b3e5a895248d0abdc78bd3b91f615778a");
  assert.equal(mapImport.outputWidth, 4096);
  assert.equal(mapImport.outputHeight, 4096);
  assert.equal(mapImport.outputBytes, mapBytes.length);
  assert.equal(mapBytes.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(mapBytes.subarray(8, 12).toString("ascii"), "WEBP");
  assert.equal(sha256(mapBytes), mapImport.outputSha256);
  assert.equal(mapImport.outputFileName, `${mapImport.outputSha256}.webp`);
  assert.equal(mapImport.usageBasis, "operator_reference_use");
  assert.equal(mapImport.rightsVerified, false);
  assert.equal(mapImport.publicNoticeRequired, true);
  assert.deepEqual(mapImport.rejectedSources, [{
    sourceFileName: "map_locations_fast_travel_tree.png",
    sourceSha256: "8538a624297d37f4f6c98afa6dd2c9f183713430a680fc6bbd234f8b793647c7",
    reasonCode: "PNG_DECODER_VALIDATION_FAILED"
  }]);
  assert.equal(mapImport.runtimeActivated, true);
});

test("Pal 이미지는 canonical exact mapping 272개만 활성화하고 누락 15개는 fallback으로 유지한다", async () => {
  const provenance = await json("import-provenance.json", importRoot);
  const mapping = await json("image-source-map.json", mappingRoot);
  const paldex = await json("paldex.json", releaseRoot);
  const manifest = await json("manifest.json", releaseRoot);
  const policy = await json("image-use-policy.json", releaseRoot);
  const mappedIds = new Set(mapping.entries.map((entry) => entry.palId));
  const fallbackIds = paldex.records.filter((pal) => !mappedIds.has(pal.id)).map((pal) => pal.id);

  assert.equal(policy.sourceType, "operator_provided_archive");
  assert.equal(policy.rightsVerified, false);
  assert.equal(mapping.entries.length, 272);
  assert.equal(new Set(mapping.entries.map((entry) => entry.sourceInternalId)).size, 272);
  assert.equal(mapping.entries.every((entry) => entry.sourceKind === policy.sourceType), true);
  assert.equal(mapping.entries.every((entry) => entry.sourceRevision.endsWith(provenance.source.archiveSha256)), true);
  assert.deepEqual(fallbackIds, provenance.palImageImport.missingPalIds);
  assert.equal(paldex.records.filter((pal) => pal.imageUrl).length, 272);
  assert.equal(manifest.imageAssetGate.status, "partial");
  assert.equal(manifest.imageAssetGate.readyImages, 272);
  assert.equal(manifest.imageAssetGate.fallbackPals, 15);
});

test("quarantine에는 전체 archive·SQL·원본 PNG를 복사하지 않는다", async () => {
  const names = await readdir(importRoot);
  assert.deepEqual(names.sort(), ["LICENSE", "import-provenance.json"]);
  assert.equal(names.some((name) => /\.(?:zip|sql|png)$/iu.test(name)), false);
});
