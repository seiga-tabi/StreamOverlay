import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const {
  PALWORLD_PALDEX_EXPECTED_COUNT,
  PalworldPaldexValidationError,
  assertPalworldImagesManifest,
  assertPalworldPaldexArtifact,
  assertPalworldPaldexReleaseManifest
} = await import("../dist/data/palworld-paldex-artifact.js");
const {
  assertPalworldPaldexExclusions,
  assertPalworldPaldexSourceLock,
  deterministicJson,
  publicIdFromEnglishName,
  readPalworldSourceResponseBytes,
  sha256Bytes
} = await import("../dist/data/palworld-paldex-import.js");
const {
  assertPalworldImageRightsGate,
  loadPalworldPaldexStagedRelease
} = await import("../dist/data/palworld-paldex-loader.js");

const releaseRoot = new URL("../data/palworld/1.0.1/", import.meta.url);
const mappingRoot = new URL("../src/data/palworld-mappings/", import.meta.url);

async function json(name, root = releaseRoot) {
  return JSON.parse(await readFile(new URL(name, root), "utf8"));
}

function streamedResponse(chunks, headers = {}) {
  const state = { cancelled: false };
  let index = 0;
  const body = new ReadableStream({
    pull(controller) {
      const chunk = chunks[index];
      index += 1;
      if (chunk === undefined) controller.close();
      else controller.enqueue(Buffer.from(chunk));
    },
    cancel() {
      state.cancelled = true;
    }
  });
  return { response: new Response(body, { headers }), state };
}

test("고정 v1.0.1 artifact는 287종·일반 203종·변종 84종을 포함한다", async () => {
  const release = await loadPalworldPaldexStagedRelease();
  assert.equal(release.artifact.records.length, 287);
  assert.equal(release.artifact.records.filter((pal) => pal.variantType === "normal").length, 203);
  assert.equal(release.artifact.records.filter((pal) => pal.variantType === "variant").length, 84);
  assert.equal(release.artifact.records.every((pal) => pal.nameKo && pal.nameJa && pal.nameEn), true);
  assert.equal(release.artifact.records.every((pal) => typeof pal.nocturnal === "boolean"), true);
  assert.equal(release.artifact.records.every((pal) => Object.values(pal.stats).every(Number.isFinite)), true);
  assert.equal(Math.max(...release.artifact.records.flatMap((pal) => pal.workSuitabilities.map((work) => work.level))), 8);
  assert.equal(release.dataIntegrityReady, true);
  assert.equal(release.imageAssetsReady, false);
  assert.equal(release.releaseReady, false);
  assert.equal(release.manifest.dataIntegrityGate.passed, true);
  assert.equal(release.manifest.dataIntegrityGate.status, "ready");
  assert.deepEqual(release.manifest.dataIntegrityGate.failures, []);
  assert.deepEqual(release.manifest.dataIntegrityGate.checks, {
    pals: 287,
    normal: 203,
    variant: 84,
    missingNameKo: 0,
    missingNameJa: 0,
    missingNameEn: 0,
    missingRequiredStats: 0,
    missingBreedingPower: 0,
    unknownEnums: 0,
    idCollisions: 0,
    aliasCollisions: 0,
    sourceChecksumVerified: true,
    mappingChecksumsVerified: true,
    artifactChecksumsVerified: true
  });
  assert.deepEqual(release.manifest.imageAssetGate, {
    passed: false,
    status: "blocked_by_license",
    failures: ["PAL_IMAGE_REDISTRIBUTION_PERMISSION_NOT_VERIFIED", "PAL_IMAGE_FILES_NOT_INCLUDED"],
    readyImages: 0,
    fallbackPals: 287
  });
  assert.equal(release.manifest.runtimeActivation, true);
});

test("data integrity와 image asset gate는 서로 독립된 coverage를 보고한다", async () => {
  const report = await json("import-report.json");
  assert.deepEqual(report.output, {
    pals: 287,
    normal: 203,
    variant: 84,
    missingNameKo: 0,
    missingNameJa: 0,
    missingNameEn: 0,
    unknownEnums: 0,
    missingRequiredStats: 0,
    missingBreedingPower: 0,
    idCollisions: 0,
    aliasCollisions: 0
  });
  assert.equal(report.dataIntegrityGate.passed, true);
  assert.equal(report.dataIntegrityGate.status, "ready");
  assert.deepEqual(report.dataIntegrityGate.failures, []);
  assert.deepEqual(report.dataIntegrityGate.checks, {
    pals: 287,
    normal: 203,
    variant: 84,
    missingNameKo: 0,
    missingNameJa: 0,
    missingNameEn: 0,
    missingRequiredStats: 0,
    missingBreedingPower: 0,
    unknownEnums: 0,
    idCollisions: 0,
    aliasCollisions: 0,
    sourceChecksumVerified: true,
    mappingChecksumsVerified: true,
    artifactChecksumsVerified: true
  });
  assert.deepEqual(report.images, {
    status: "blocked_by_license",
    mappedPals: 287,
    readyImages: 0,
    uniqueImageFiles: 0,
    fallbackPals: 287
  });
  assert.equal(report.imageAssetGate.passed, false);
  assert.equal(report.imageAssetGate.status, "blocked_by_license");
  assert.equal(report.imageAssetGate.readyImages, 0);
  assert.equal(report.imageAssetGate.fallbackPals, 287);
  assert.equal(report.runtimeActivation, true);
});

test("source lock은 고정 revision·checksum·원본 개수를 검증한다", async () => {
  const sourceBytes = await readFile(new URL("sources.lock.json", releaseRoot));
  const lock = assertPalworldPaldexSourceLock(JSON.parse(sourceBytes.toString("utf8")));
  assert.deepEqual(lock.sources.map((source) => [source.id, source.recordCount]), [["atlas-pals", 289], ["palcalc-db", 299]]);
  assert.equal(lock.sources[0].sha256, "57fb4bf837061c1160d5f72755152245fe793e1b0073328714efd63c65ba5b47");
  assert.equal(lock.sources[1].sha256, "803d891afdb18bd00e24332844a7276bbe5c0855170ef90ef142f2f4d7698ed1");
  const manifest = await json("manifest.json");
  assert.equal(manifest.sourceLockSha256, sha256Bytes(sourceBytes));

  assert.throws(() => assertPalworldPaldexSourceLock({ ...lock, unknown: true }), /schema에 없는/);
  assert.throws(() => assertPalworldPaldexSourceLock({ ...lock, sources: [{ ...lock.sources[0], sha256: "0".repeat(64) }, lock.sources[1]] }), /고정된 revision|고정된 revision|코드에 고정된/);
});

test("source fetch body는 Content-Length 누락·압축 응답에서도 고정 byte 상한을 즉시 적용한다", async () => {
  const exact = streamedResponse(["ab", "c"]);
  assert.equal(
    (await readPalworldSourceResponseBytes(exact.response, 3, "fixture-exact")).toString("utf8"),
    "abc"
  );
  assert.equal(exact.state.cancelled, false);

  const missingLength = streamedResponse(["ab", "cd", "읽으면 안 되는 후속 chunk"]);
  await assert.rejects(
    readPalworldSourceResponseBytes(missingLength.response, 3, "fixture-missing-length"),
    /고정 byte 제한을 초과/
  );
  assert.equal(missingLength.state.cancelled, true);

  const compressed = streamedResponse(["ab", "cd", "읽으면 안 되는 후속 chunk"], {
    "content-encoding": "gzip",
    "content-length": "2"
  });
  await assert.rejects(
    readPalworldSourceResponseBytes(compressed.response, 3, "fixture-compressed"),
    /고정 byte 제한을 초과/
  );
  assert.equal(compressed.state.cancelled, true);
});

test("manifest는 5개 고정 mapping checksum을 기록하고 byte 변조를 감지한다", async () => {
  const manifest = await json("manifest.json");
  const mappingFiles = {
    publicIdMap: "public-id-map.json",
    elements: "elements.json",
    workSuitabilities: "work-suitabilities.json",
    exclusions: "exclusions.json",
    imageOverrides: "image-overrides.json"
  };
  for (const [field, fileName] of Object.entries(mappingFiles)) {
    const bytes = await readFile(new URL(fileName, mappingRoot));
    assert.equal(manifest.mappingSha256[field], sha256Bytes(bytes));
  }

  const tamperedMappingRoot = await mkdtemp(path.join(tmpdir(), "palworld-mapping-tamper-"));
  for (const fileName of Object.values(mappingFiles)) {
    await copyFile(new URL(fileName, mappingRoot), path.join(tamperedMappingRoot, fileName));
  }
  const tamperedPath = path.join(tamperedMappingRoot, mappingFiles.elements);
  const originalText = await readFile(tamperedPath, "utf8");
  await writeFile(tamperedPath, `${originalText}\n`, "utf8");
  await assert.rejects(
    loadPalworldPaldexStagedRelease({ mappingRoot: tamperedMappingRoot }),
    /manifest\.mappingSha256\.elements: mapping checksum이 일치하지 않습니다/
  );
});

test("data/image gate coverage 숫자 변조를 실제 artifact와 대조해 거부한다", async () => {
  const tamperedReleaseRoot = await mkdtemp(path.join(tmpdir(), "palworld-gate-tamper-"));
  for (const fileName of ["sources.lock.json", "paldex.json", "images-manifest.json", "import-report.json", "manifest.json"]) {
    await copyFile(new URL(fileName, releaseRoot), path.join(tamperedReleaseRoot, fileName));
  }
  const manifestPath = path.join(tamperedReleaseRoot, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.dataIntegrityGate.checks.pals = 286;
  await writeFile(manifestPath, deterministicJson(manifest), "utf8");
  await assert.rejects(
    loadPalworldPaldexStagedRelease({ releaseRoot: tamperedReleaseRoot }),
    /dataIntegrityGate\.checks\.pals: 실제 검증 결과와 일치하지 않습니다/
  );

  manifest.dataIntegrityGate.checks.pals = 287;
  manifest.imageAssetGate.fallbackPals = 286;
  await writeFile(manifestPath, deterministicJson(manifest), "utf8");
  await assert.rejects(
    loadPalworldPaldexStagedRelease({ releaseRoot: tamperedReleaseRoot }),
    /imageAssetGate\.fallbackPals: 실제 fallback 수와 일치하지 않습니다/
  );
});

test("public ID mapping은 287개 exact internal ID를 안정적으로 보존한다", async () => {
  const artifact = assertPalworldPaldexArtifact(await json("paldex.json"));
  const mapping = await json("public-id-map.json", mappingRoot);
  assert.equal(mapping.entries.length, PALWORLD_PALDEX_EXPECTED_COUNT);
  const byInternalId = new Map(mapping.entries.map((entry) => [entry.sourceInternalId, entry.publicId]));
  assert.equal(byInternalId.size, PALWORLD_PALDEX_EXPECTED_COUNT);
  for (const pal of artifact.records) assert.equal(byInternalId.get(pal.sourceInternalId), pal.id);
  assert.equal(publicIdFromEnglishName("Relaxaurus Lux"), "relaxaurus-lux");
});

test("exclusions에는 중복·미확인·이벤트 레코드 13개의 사유가 모두 기록된다", async () => {
  const exclusions = await json("exclusions.json", mappingRoot);
  assert.equal(assertPalworldPaldexExclusions(exclusions).size, 13);
  assert.equal(exclusions.entries.length, 13);
  assert.equal(exclusions.entries.every((entry) => entry.sourceInternalId && entry.reasonCode && entry.reasonKo), true);
  const ids = new Set(exclusions.entries.map((entry) => entry.sourceInternalId));
  assert.equal(ids.has("PlantSlime_Flower"), true);
  assert.equal(ids.has("WorldTreeDragon"), true);
  assert.equal([...ids].filter((id) => id.startsWith("Yakushima")).length, 11);

  const missingEvent = structuredClone(exclusions);
  missingEvent.entries.pop();
  assert.throws(() => assertPalworldPaldexExclusions(missingEvent), /13개/);

  const replacedPal = structuredClone(exclusions);
  replacedPal.entries[0].sourceInternalId = "BluePlatypus_Fire";
  assert.throws(() => assertPalworldPaldexExclusions(replacedPal), /고정된 제외/);
});

test("이미지 manifest는 287개 명시적 mapping을 권리 차단 상태로 유지한다", async () => {
  const artifact = assertPalworldPaldexArtifact(await json("paldex.json"));
  const images = assertPalworldImagesManifest(await json("images-manifest.json"), artifact);
  assert.equal(images.entries.length, 287);
  assert.equal(images.entries.every((entry) => entry.status === "blocked_by_license"), true);
  assert.equal(images.entries.every((entry) => entry.license === "UNVERIFIED_FOR_POCKETPAIR_GAME_ASSETS"), true);
  assert.equal(images.entries.every((entry) => entry.imageUrl === null && entry.generatedSha256 === null), true);
  assert.equal(artifact.records.every((pal) => pal.imageUrl === undefined), true);
  assert.equal(images.entries.every((entry) => entry.sourceUrl.startsWith("https://github.com/tylercamp/palcalc/blob/")), true);
});

test("source lock의 권리가 차단된 동안 image asset gate를 승인 상태로 바꿀 수 없다", async () => {
  const sourceLock = assertPalworldPaldexSourceLock(await json("sources.lock.json"));
  const artifact = assertPalworldPaldexArtifact(await json("paldex.json"));
  const imagesManifest = assertPalworldImagesManifest(await json("images-manifest.json"), artifact);
  const manifest = assertPalworldPaldexReleaseManifest(await json("manifest.json"));
  assert.doesNotThrow(() => assertPalworldImageRightsGate({ sourceLock, imagesManifest, manifest }));

  const unverifiedApproval = structuredClone(imagesManifest);
  unverifiedApproval.rightsReview.status = "approved";
  assert.throws(
    () => assertPalworldImageRightsGate({ sourceLock, imagesManifest: unverifiedApproval, manifest }),
    /권리 상태/
  );

  const unverifiedReadyGate = structuredClone(manifest);
  unverifiedReadyGate.imageAssetGate = { passed: true, status: "ready", failures: [] };
  assert.throws(
    () => assertPalworldImageRightsGate({ sourceLock, imagesManifest, manifest: unverifiedReadyGate }),
    /권리 상태/
  );
});

test("이미지 권리 metadata 누락과 외부·traversal imageUrl을 거부한다", async () => {
  const artifact = assertPalworldPaldexArtifact(await json("paldex.json"));
  const images = await json("images-manifest.json");
  const missingLicense = structuredClone(images);
  delete missingLicense.entries[0].license;
  assert.throws(() => assertPalworldImagesManifest(missingLicense, artifact), PalworldPaldexValidationError);

  const external = structuredClone(artifact);
  external.records[0].imageUrl = "https://external.example/pal.webp";
  assert.throws(() => assertPalworldPaldexArtifact(external), /content-hash WebP/);
  const traversal = structuredClone(artifact);
  traversal.records[0].imageUrl = "/images/palworld/1.0.1/pals/../pal.webp";
  assert.throws(() => assertPalworldPaldexArtifact(traversal), /content-hash WebP/);
});

test("생성 JSON은 동일 입력을 두 번 직렬화해도 byte-for-byte 동일하다", async () => {
  for (const name of ["paldex.json", "images-manifest.json", "import-report.json", "manifest.json"]) {
    const bytes = await readFile(new URL(name, releaseRoot));
    const parsed = JSON.parse(bytes.toString("utf8"));
    assert.equal(deterministicJson(parsed), bytes.toString("utf8"));
    assert.equal(deterministicJson(JSON.parse(deterministicJson(parsed))), bytes.toString("utf8"));
  }
});

test("권리 gate를 release 모드에서 우회할 수 없다", async () => {
  await assert.rejects(loadPalworldPaldexStagedRelease({ requireReleaseReady: true }), /PALWORLD_IMAGE_RELEASE_BLOCKED_BY_LICENSE/);
});
