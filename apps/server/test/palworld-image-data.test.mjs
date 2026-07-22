import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const {
  importApprovedPalworldWebp,
  inspectPalworldWebp,
  validatePalworldImageFiles
} = await import("../dist/data/palworld-image-import.js");

const ONE_BY_ONE_WEBP = Buffer.from("UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=", "base64");

function withVp8x(flags = 0, widthMinusOne = 0, heightMinusOne = 0) {
  const extendedHeader = Buffer.alloc(18);
  extendedHeader.write("VP8X", 0, "ascii");
  extendedHeader.writeUInt32LE(10, 4);
  extendedHeader[8] = flags;
  extendedHeader.writeUIntLE(widthMinusOne, 12, 3);
  extendedHeader.writeUIntLE(heightMinusOne, 15, 3);
  const result = Buffer.concat([ONE_BY_ONE_WEBP.subarray(0, 12), extendedHeader, ONE_BY_ONE_WEBP.subarray(12)]);
  result.writeUInt32LE(result.length - 8, 4);
  return result;
}

function readyEntry(inspection, palId = "lamball") {
  const fileName = `${inspection.sha256}.webp`;
  return {
    palId,
    sourceInternalId: palId === "lamball" ? "SheepBall" : "PinkCat",
    status: "ready",
    sourceName: "권리 승인 테스트 fixture",
    sourceUrl: "https://example.com/licensed-pal.webp",
    sourceRevision: "fixture-1",
    license: "TEST-LICENSE",
    retrievedAt: "2026-07-22T00:00:00.000Z",
    originalSha256: inspection.sha256,
    generatedSha256: inspection.sha256,
    originalFileName: `${palId}.webp`,
    outputFileName: fileName,
    outputMime: "image/webp",
    outputWidth: inspection.width,
    outputHeight: inspection.height,
    outputBytes: inspection.bytes,
    imageUrl: `/images/palworld/1.0.1/pals/${fileName}`
  };
}

function manifest(entries) {
  return {
    schemaVersion: 1,
    release: "1.0.1",
    revision: "fixture",
    status: "ready",
    rightsReview: {
      status: "approved",
      reviewedAt: "2026-07-22T00:00:00.000Z",
      reasonCode: "TEST_APPROVED",
      evidenceUrls: ["https://example.com/license"]
    },
    entries
  };
}

const noOverrides = { version: 1, release: "1.0.1", sharedImages: [] };

async function makeSafeTempDirectory(prefix) {
  return mkdtemp(path.join(await realpath(tmpdir()), prefix));
}

test("WebP MIME signature·픽셀 크기·content hash를 검증한다", () => {
  const inspected = inspectPalworldWebp(ONE_BY_ONE_WEBP);
  assert.deepEqual({ width: inspected.width, height: inspected.height, bytes: inspected.bytes }, { width: 1, height: 1, bytes: 38 });
  assert.match(inspected.sha256, /^[a-f0-9]{64}$/);
  assert.throws(() => inspectPalworldWebp(Buffer.from("not-a-webp")), /MIME signature/);
});

test("파일 크기·픽셀 크기·metadata·손상 payload를 거부한다", () => {
  assert.throws(() => inspectPalworldWebp(Buffer.alloc(512 * 1024 + 1)), /bytes 이하/);
  const oversized = Buffer.from(ONE_BY_ONE_WEBP);
  oversized[22] = 0x02;
  assert.throws(() => inspectPalworldWebp(oversized), /512×512 이하/);

  const withMetadata = Buffer.concat([ONE_BY_ONE_WEBP, Buffer.from("EXIF\0\0\0\0", "binary")]);
  withMetadata.writeUInt32LE(withMetadata.length - 8, 4);
  assert.throws(() => inspectPalworldWebp(withMetadata), /metadata chunk/);

  const corrupt = Buffer.from(ONE_BY_ONE_WEBP);
  corrupt[20] = 0x00;
  assert.throws(() => inspectPalworldWebp(corrupt), /VP8L payload/);

  assert.throws(() => inspectPalworldWebp(withVp8x(0x08)), /metadata flag/);
  assert.throws(() => inspectPalworldWebp(withVp8x(0, 1, 0)), /payload 크기/);
  const withUnknownChunk = Buffer.concat([ONE_BY_ONE_WEBP, Buffer.from("JUNK\0\0\0\0", "binary")]);
  withUnknownChunk.writeUInt32LE(withUnknownChunk.length - 8, 4);
  assert.throws(() => inspectPalworldWebp(withUnknownChunk), /허용되지 않은 WebP chunk/);
});

test("manifest 파일 존재·hash·크기와 고아 파일을 검사한다", async () => {
  const root = await makeSafeTempDirectory("palworld-image-test-");
  const inspection = inspectPalworldWebp(ONE_BY_ONE_WEBP);
  const entry = readyEntry(inspection);
  await writeFile(path.join(root, entry.outputFileName), ONE_BY_ONE_WEBP);
  assert.deepEqual(await validatePalworldImageFiles({ manifest: manifest([entry]), imageRoot: root, overrides: noOverrides }), {
    readyImages: 1,
    uniqueImageFiles: 1
  });
  await writeFile(path.join(root, `${"f".repeat(64)}.webp`), ONE_BY_ONE_WEBP);
  await assert.rejects(validatePalworldImageFiles({ manifest: manifest([entry]), imageRoot: root, overrides: noOverrides }), /고아/);
});

test("누락·symlink·의도하지 않은 중복 이미지를 거부한다", async () => {
  const inspection = inspectPalworldWebp(ONE_BY_ONE_WEBP);
  const entry = readyEntry(inspection);
  const missingRoot = await makeSafeTempDirectory("palworld-image-missing-");
  await assert.rejects(validatePalworldImageFiles({ manifest: manifest([entry]), imageRoot: missingRoot, overrides: noOverrides }), /ENOENT/);

  const symlinkRoot = await makeSafeTempDirectory("palworld-image-symlink-");
  const target = path.join(symlinkRoot, "target.webp");
  await writeFile(target, ONE_BY_ONE_WEBP);
  await symlink(target, path.join(symlinkRoot, entry.outputFileName));
  await assert.rejects(validatePalworldImageFiles({ manifest: manifest([entry]), imageRoot: symlinkRoot, overrides: noOverrides }), /symlink 파일|regular file/);

  const rootSymlinkParent = await makeSafeTempDirectory("palworld-image-root-symlink-");
  const realRoot = path.join(rootSymlinkParent, "real");
  const linkedRoot = path.join(rootSymlinkParent, "linked");
  await mkdir(realRoot);
  await symlink(realRoot, linkedRoot);
  await assert.rejects(validatePalworldImageFiles({ manifest: manifest([]), imageRoot: linkedRoot, overrides: noOverrides }), /symlink가 아닌 directory/);

  const duplicateRoot = await makeSafeTempDirectory("palworld-image-duplicate-");
  await writeFile(path.join(duplicateRoot, entry.outputFileName), ONE_BY_ONE_WEBP);
  const duplicate = readyEntry(inspection, "cattiva");
  await assert.rejects(validatePalworldImageFiles({ manifest: manifest([entry, duplicate]), imageRoot: duplicateRoot, overrides: noOverrides }), /설명 없는 중복/);
});

test("권리 승인 없이는 build-time 이미지 import도 차단한다", async () => {
  const root = await makeSafeTempDirectory("palworld-image-import-");
  const source = path.join(root, "source.webp");
  const output = path.join(root, "output");
  await writeFile(source, ONE_BY_ONE_WEBP);
  await mkdir(output);
  await assert.rejects(importApprovedPalworldWebp({ sourceFile: source, imageRoot: output, rightsStatus: "blocked_by_license" }), /권리 승인 전/);
});

test("이미지가 없는 blocked manifest는 fallback을 위해 빈 이미지 root를 허용한다", async () => {
  const root = path.join(await makeSafeTempDirectory("palworld-image-blocked-"), "not-created");
  const blockedManifest = manifest([]);
  blockedManifest.status = "blocked_by_license";
  blockedManifest.rightsReview.status = "blocked_by_license";
  assert.deepEqual(await validatePalworldImageFiles({ manifest: blockedManifest, imageRoot: root, overrides: noOverrides }), {
    readyImages: 0,
    uniqueImageFiles: 0
  });
});
