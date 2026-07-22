import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const {
  PALWORLD_IMAGE_SOURCE_MAX_BYTES,
  collectPalworldRuntimeImageUrls,
  convertPalworldSourceToWebp,
  importOperatorAcknowledgedPalworldImage,
  inspectPalworldSourceImage,
  inspectPalworldWebp,
  readPalworldSourceImage,
  validatePalworldImageFiles
} = await import("../dist/data/palworld-image-import.js");
const { crc32 } = await import("../dist/data/palworld-source-archive.js");

const ONE_BY_ONE_WEBP = Buffer.from("UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=", "base64");
const ONE_BY_ONE_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

const operatorPolicy = {
  schemaVersion: 1,
  release: "1.0.1",
  status: "operator_acknowledged",
  usageBasis: "operator_reference_use",
  sourceType: "operator_controlled_server_export",
  sourceDescription: "운영자 테스트 이미지",
  acknowledgedAt: "2026-07-22T00:00:00.000Z",
  publicNoticeKo: "비공식 팰월드 데이터베이스 · 데이터/이미지 출처 Palworld · Pocketpair",
  publicNoticeJa: "非公式パルワールドデータベース・データ／画像出典 Palworld・Pocketpair",
  takedownContact: "support@yoro.gg",
  allowPublicDisplay: true,
  allowSelfHosting: true,
  allowResize: true,
  allowWebpConversion: true,
  rightsVerified: false
};

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
    status: "operator_acknowledged",
    sourceName: "운영자 테스트 fixture",
    sourceReference: `operator-export-${palId}`,
    sourceRevision: "fixture-1",
    license: "RIGHTS_NOT_INDEPENDENTLY_VERIFIED",
    usageBasis: "operator_reference_use",
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
    status: "operator_acknowledged",
    rightsReview: {
      status: "operator_acknowledged",
      reviewedAt: "2026-07-22T00:00:00.000Z",
      reasonCode: "OPERATOR_REFERENCE_USE",
      evidenceUrls: []
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
  await assert.rejects(validatePalworldImageFiles({ manifest: manifest([entry]), imageRoot: root, overrides: noOverrides }), /파일명과 일치/);
});

test("runtime 이미지 검증은 누락된 파일만 fallback으로 낮추고 다른 Pal 이미지는 유지한다", async () => {
  const root = await makeSafeTempDirectory("palworld-image-runtime-fallback-");
  const firstInspection = inspectPalworldWebp(ONE_BY_ONE_WEBP);
  const secondWebp = withVp8x(0);
  const secondInspection = inspectPalworldWebp(secondWebp);
  const first = readyEntry(firstInspection, "lamball");
  const second = readyEntry(secondInspection, "cattiva");
  await writeFile(path.join(root, first.outputFileName), ONE_BY_ONE_WEBP);
  await writeFile(path.join(root, second.outputFileName), secondWebp);

  const complete = await collectPalworldRuntimeImageUrls({ manifest: manifest([first, second]), imageRoot: root });
  assert.deepEqual(Object.keys(complete.imageUrls).sort(), ["cattiva", "lamball"]);

  await unlink(path.join(root, first.outputFileName));
  const partial = await collectPalworldRuntimeImageUrls({ manifest: manifest([first, second]), imageRoot: root });
  assert.deepEqual(partial.imageUrls, { cattiva: second.imageUrl });
  assert.equal(partial.readyImages, 1);
  assert.equal(partial.uniqueImageFiles, 1);
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

test("동일 이미지 공유는 hash와 Pal 목록이 정확한 명시적 override에만 허용한다", async () => {
  const root = await makeSafeTempDirectory("palworld-image-explicit-duplicate-");
  const inspection = inspectPalworldWebp(ONE_BY_ONE_WEBP);
  const lamball = readyEntry(inspection);
  const cattiva = readyEntry(inspection, "cattiva");
  await writeFile(path.join(root, lamball.outputFileName), ONE_BY_ONE_WEBP);
  const overrides = {
    version: 1,
    release: "1.0.1",
    sharedImages: [{
      generatedSha256: inspection.sha256,
      palIds: ["lamball", "cattiva"],
      reasonKo: "테스트에서 두 canonical Pal의 명시적 공유를 검증합니다."
    }]
  };
  assert.deepEqual(await validatePalworldImageFiles({
    manifest: manifest([lamball, cattiva]),
    imageRoot: root,
    overrides
  }), {
    readyImages: 2,
    uniqueImageFiles: 1
  });

  const wrongPalList = structuredClone(overrides);
  wrongPalList.sharedImages[0].palIds = ["lamball", "foxparks"];
  await assert.rejects(validatePalworldImageFiles({
    manifest: manifest([lamball, cattiva]),
    imageRoot: root,
    overrides: wrongPalList
  }), /Pal 목록이 실제 mapping과 다릅니다/);
});

test("운영자 사용 확인 없이는 maintenance 이미지 import도 차단한다", async () => {
  const root = await makeSafeTempDirectory("palworld-image-import-");
  const source = path.join(root, "source.webp");
  const output = path.join(root, "output");
  await writeFile(source, ONE_BY_ONE_WEBP);
  await mkdir(output);
  await assert.rejects(importOperatorAcknowledgedPalworldImage({
    sourceRoot: root,
    sourceFileName: "source.webp",
    imageRoot: output,
    policy: {
      ...operatorPolicy,
      status: "blocked_by_license",
      usageBasis: "none",
      allowPublicDisplay: false,
      allowSelfHosting: false,
      allowResize: false,
      allowWebpConversion: false
    }
  }), /운영자 사용 확인/);
});

test("이미지가 없는 blocked manifest는 fallback을 위해 빈 이미지 root를 허용한다", async () => {
  const root = path.join(await makeSafeTempDirectory("palworld-image-blocked-"), "not-created");
  const blockedManifest = manifest([]);
  blockedManifest.status = "blocked_by_license";
  blockedManifest.rightsReview.status = "blocked_by_license";
  blockedManifest.rightsReview.evidenceUrls = ["https://example.com/review"];
  assert.deepEqual(await validatePalworldImageFiles({ manifest: blockedManifest, imageRoot: root, overrides: noOverrides }), {
    readyImages: 0,
    uniqueImageFiles: 0
  });
});

test("원본 PNG/WebP signature·animation·크기 상한을 변환 전에 검사한다", async () => {
  assert.equal((await inspectPalworldSourceImage(ONE_BY_ONE_PNG, "pal.png")).mime, "image/png");
  assert.equal((await inspectPalworldSourceImage(ONE_BY_ONE_WEBP, "pal.webp")).mime, "image/webp");
  await assert.rejects(inspectPalworldSourceImage(ONE_BY_ONE_WEBP, "pal.png"), /PNG MIME signature/);
  await assert.rejects(inspectPalworldSourceImage(Buffer.alloc(PALWORLD_IMAGE_SOURCE_MAX_BYTES + 1), "pal.png"), /bytes 이하/);
  await assert.rejects(inspectPalworldSourceImage(withVp8x(0x02), "pal.webp"), /animated WebP/);

  const oversizedPng = Buffer.from(ONE_BY_ONE_PNG);
  oversizedPng.writeUInt32BE(8193, 16);
  oversizedPng.writeUInt32BE(crc32(oversizedPng.subarray(12, 29)), 29);
  await assert.rejects(inspectPalworldSourceImage(oversizedPng, "pal.png"), /각 변 8192px 이하/);

  const animationChunk = Buffer.alloc(20);
  animationChunk.writeUInt32BE(8, 0);
  animationChunk.write("acTL", 4, "ascii");
  animationChunk.writeUInt32BE(crc32(animationChunk.subarray(4, 16)), 16);
  const animatedPng = Buffer.concat([ONE_BY_ONE_PNG.subarray(0, ONE_BY_ONE_PNG.length - 12), animationChunk, ONE_BY_ONE_PNG.subarray(ONE_BY_ONE_PNG.length - 12)]);
  await assert.rejects(inspectPalworldSourceImage(animatedPng, "pal.png"), /animated PNG/);
});

test("source root traversal·percent 우회·symlink를 거부하고 절대경로를 오류에 노출하지 않는다", async () => {
  const root = await makeSafeTempDirectory("palworld-source-root-");
  const outside = await makeSafeTempDirectory("palworld-source-outside-");
  await writeFile(path.join(outside, "pal.png"), ONE_BY_ONE_PNG);
  await symlink(path.join(outside, "pal.png"), path.join(root, "linked.png"));
  for (const fileName of ["../pal.png", "folder\\pal.png", "%2e%2e.png"]) {
    await assert.rejects(readPalworldSourceImage(root, fileName), /traversal|허용되지 않은/);
  }
  await assert.rejects(readPalworldSourceImage(root, "linked.png"), (error) => {
    assert.match(error.message, /symlink/);
    assert.equal(error.message.includes(root), false);
    assert.equal(error.message.includes(outside), false);
    return true;
  });
});

test("고정 sharp 변환은 metadata를 제거하고 content-hash WebP를 덮어쓰지 않는다", async () => {
  const root = await makeSafeTempDirectory("palworld-convert-");
  const output = path.join(root, "output");
  await writeFile(path.join(root, "pal.png"), ONE_BY_ONE_PNG);
  const converted = await convertPalworldSourceToWebp({ source: ONE_BY_ONE_PNG, sourceFileName: "pal.png" });
  assert.equal(converted.width, 1);
  assert.equal(converted.height, 1);
  assert.equal(converted.bytes <= 512 * 1024, true);
  assert.equal(inspectPalworldWebp(converted.output).sha256, converted.sha256);

  const imported = await importOperatorAcknowledgedPalworldImage({
    sourceRoot: root,
    sourceFileName: "pal.png",
    imageRoot: output,
    policy: operatorPolicy
  });
  assert.equal(imported.outputFileName, `${imported.sha256}.webp`);
  assert.equal(imported.imageUrl, `/images/palworld/1.0.1/pals/${imported.outputFileName}`);
  const repeated = await importOperatorAcknowledgedPalworldImage({
    sourceRoot: root,
    sourceFileName: "pal.png",
    imageRoot: output,
    policy: operatorPolicy
  });
  assert.equal(repeated.sha256, imported.sha256);
});

test("rollback 뒤 참조되지 않은 안전한 content-hash 파일을 cache 보존용으로 허용한다", async () => {
  const root = await makeSafeTempDirectory("palworld-image-retained-");
  const inspection = inspectPalworldWebp(ONE_BY_ONE_WEBP);
  await writeFile(path.join(root, `${inspection.sha256}.webp`), ONE_BY_ONE_WEBP);
  const blockedManifest = manifest([]);
  blockedManifest.status = "blocked_by_license";
  blockedManifest.rightsReview.status = "blocked_by_license";
  blockedManifest.rightsReview.evidenceUrls = ["https://example.com/review"];
  const retainedOverride = {
    version: 1,
    release: "1.0.1",
    sharedImages: [{
      generatedSha256: inspection.sha256,
      palIds: ["lamball", "cattiva"],
      reasonKo: "rollback 전에 사용하던 명시적 공유 기록입니다."
    }]
  };
  assert.deepEqual(await validatePalworldImageFiles({ manifest: blockedManifest, imageRoot: root, overrides: retainedOverride }), {
    readyImages: 0,
    uniqueImageFiles: 0
  });
});
