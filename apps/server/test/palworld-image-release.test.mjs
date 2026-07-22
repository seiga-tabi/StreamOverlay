import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  buildPalworldImageRelease,
  buildPalworldImageRollback
} = await import("../dist/data/palworld-image-release.js");
const { inspectPalworldWebp } = await import("../dist/data/palworld-image-import.js");
const {
  assertPalworldImagesManifest,
  assertPalworldPaldexArtifact,
  assertPalworldPaldexReleaseManifest
} = await import("../dist/data/palworld-paldex-artifact.js");

const releaseRoot = new URL("../data/palworld/1.0.1/", import.meta.url);
const artifact = assertPalworldPaldexArtifact(JSON.parse(await readFile(new URL("paldex.json", releaseRoot), "utf8")));
const baseReport = JSON.parse(await readFile(new URL("import-report.json", releaseRoot), "utf8"));
const baseManifest = assertPalworldPaldexReleaseManifest(JSON.parse(await readFile(new URL("manifest.json", releaseRoot), "utf8")));
const policy = JSON.parse(await readFile(new URL("image-use-policy.json", releaseRoot), "utf8"));
const ONE_BY_ONE_WEBP = Buffer.from("UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=", "base64");
const inspection = inspectPalworldWebp(ONE_BY_ONE_WEBP);
const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

function partialRelease() {
  const first = artifact.records[0];
  const staleHash = "f".repeat(64);
  return buildPalworldImageRelease({
    baseArtifact: {
      ...artifact,
      records: artifact.records.map((pal, index) => index === 1
        ? { ...pal, imageUrl: `/images/palworld/1.0.1/pals/${staleHash}.webp` }
        : pal)
    },
    baseReport,
    baseManifest,
    policy,
    policySha256: hashA,
    sourceMap: {
      schemaVersion: 1,
      release: "1.0.1",
      entries: [{
        palId: first.id,
        sourceInternalId: first.sourceInternalId,
        sourceFileName: "lamball.webp",
        sourceRevision: "pypalworldapi-0.2.0-fixture",
        sourceKind: policy.sourceType
      }]
    },
    sourceMapSha256: hashB,
    importedImages: new Map([[first.id, {
      palId: first.id,
      sourceFileName: "lamball.webp",
      originalSha256: inspection.sha256,
      generatedSha256: inspection.sha256,
      outputFileName: `${inspection.sha256}.webp`,
      outputWidth: inspection.width,
      outputHeight: inspection.height,
      outputBytes: inspection.bytes,
      imageUrl: `/images/palworld/1.0.1/pals/${inspection.sha256}.webp`
    }]])
  });
}

test("partial image release는 검증된 URL만 병합하고 기존 미검증 URL을 제거한다", () => {
  const release = partialRelease();
  assert.equal(release.manifest.imageAssetGate.status, "partial");
  assert.equal(release.manifest.imageAssetGate.technicalPassed, true);
  assert.equal(release.manifest.imageAssetGate.publicActivationAllowed, true);
  assert.equal(release.manifest.imageAssetGate.rightsVerified, false);
  assert.equal(release.manifest.imageAssetGate.readyImages, 1);
  assert.equal(release.manifest.imageAssetGate.fallbackPals, 286);
  assert.equal(release.artifact.records[0].imageUrl?.endsWith(`${inspection.sha256}.webp`), true);
  assert.equal(release.artifact.records[1].imageUrl, undefined);
  assert.equal(release.imagesManifest.entries[0].sourceUrl, undefined);
  assert.equal(release.imagesManifest.entries[0].sourceReference, `operator-archive-${artifact.records[0].sourceInternalId}`);
  assert.equal(release.imagesManifest.entries[0].license, "RIGHTS_NOT_INDEPENDENTLY_VERIFIED");
  assert.equal(release.imagesManifest.entries[0].usageBasis, "operator_reference_use");
  assert.equal(release.report.images.converter.tool, "sharp@0.35.3");
});

test("같은 입력의 image release 생성은 byte-for-byte 결정적이다", () => {
  const first = partialRelease();
  const second = partialRelease();
  for (const key of ["paldexText", "imagesText", "reportText", "manifestText"]) {
    assert.equal(first[key], second[key]);
  }
});

test("rollback은 imageUrl 참조만 제거하고 287종 텍스트 artifact를 유지한다", () => {
  const active = partialRelease();
  const blockedPolicy = {
    ...policy,
    status: "blocked_by_license",
    usageBasis: "none",
    allowPublicDisplay: false,
    allowSelfHosting: false,
    allowResize: false,
    allowWebpConversion: false,
    rightsVerified: false
  };
  const rollback = buildPalworldImageRollback({
    artifact: active.artifact,
    imagesManifest: assertPalworldImagesManifest(active.imagesManifest, active.artifact),
    report: active.report,
    manifest: active.manifest,
    blockedPolicy,
    policySha256: "c".repeat(64)
  });
  assert.equal(rollback.artifact.records.length, 287);
  assert.equal(rollback.artifact.records.every((pal) => pal.imageUrl === undefined), true);
  assert.equal(rollback.imagesManifest.entries.every((entry) => entry.status === "blocked_by_license"), true);
  assert.equal(rollback.manifest.imageAssetGate.status, "blocked_by_license");
  assert.equal(rollback.manifest.imageAssetGate.readyImages, 0);
  assert.equal(rollback.manifest.imageAssetGate.fallbackPals, 287);
});
