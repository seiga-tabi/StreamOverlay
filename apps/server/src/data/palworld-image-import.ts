import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { link, lstat, mkdir, open, readdir, realpath, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PALWORLD_PAL_IMAGE_MAX_BYTES,
  PALWORLD_PAL_IMAGE_MAX_DIMENSION,
  PALWORLD_PAL_IMAGE_PREFIX,
  PalworldPaldexValidationError,
  palworldImageHashFromUrl,
  type PalworldImagesManifest
} from "./palworld-paldex-artifact.js";
import {
  assertPalworldImageUsePolicy,
  type PalworldImageUsePolicy
} from "./palworld-image-policy.js";
import { crc32 } from "./palworld-source-archive.js";

const WEBP_METADATA_CHUNKS = new Set(["EXIF", "XMP ", "ICCP", "ANIM", "ANMF"]);
const WEBP_ALLOWED_CHUNKS = new Set(["VP8X", "VP8 ", "VP8L", "ALPH"]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const PALWORLD_IMAGE_SOURCE_MAX_BYTES = 16 * 1024 * 1024;
export const PALWORLD_IMAGE_SOURCE_MAX_DIMENSION = 8_192;
export const PALWORLD_IMAGE_SOURCE_MAX_PIXELS = 16_777_216;
export const PALWORLD_IMAGE_WEBP_QUALITIES = [90, 84, 78, 72] as const;
export const PALWORLD_IMAGE_WEBP_ALPHA_QUALITY = 100;
export const PALWORLD_IMAGE_WEBP_EFFORT = 6;

export type PalworldSourceImageInspection = {
  mime: "image/png" | "image/webp";
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export type PalworldWebpInspection = {
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

function fail(message: string): never {
  throw new PalworldPaldexValidationError(message);
}

function readUint24LE(buffer: Buffer, offset: number): number {
  return buffer[offset]! | (buffer[offset + 1]! << 8) | (buffer[offset + 2]! << 16);
}

function assertSourceDimensions(width: number, height: number): void {
  if (
    !Number.isInteger(width)
    || !Number.isInteger(height)
    || width < 1
    || height < 1
    || width > PALWORLD_IMAGE_SOURCE_MAX_DIMENSION
    || height > PALWORLD_IMAGE_SOURCE_MAX_DIMENSION
    || width * height > PALWORLD_IMAGE_SOURCE_MAX_PIXELS
  ) {
    fail(
      `원본 이미지는 각 변 ${PALWORLD_IMAGE_SOURCE_MAX_DIMENSION}px 이하, 총 ${PALWORLD_IMAGE_SOURCE_MAX_PIXELS} pixels 이하여야 합니다.`
    );
  }
}

function inspectPngContainer(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 33 || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    fail("PNG MIME signature가 올바르지 않습니다.");
  }
  let offset = 8;
  let dimensions: { width: number; height: number } | undefined;
  let sawEnd = false;
  while (offset + 12 <= buffer.length) {
    const chunkSize = buffer.readUInt32BE(offset);
    const chunkType = buffer.toString("ascii", offset + 4, offset + 8);
    const dataOffset = offset + 8;
    const nextOffset = dataOffset + chunkSize + 4;
    if (nextOffset > buffer.length) fail("PNG chunk 범위가 파일을 벗어납니다.");
    const expectedCrc = buffer.readUInt32BE(dataOffset + chunkSize);
    const actualCrc = crc32(buffer.subarray(offset + 4, dataOffset + chunkSize));
    if (actualCrc !== expectedCrc) fail(`PNG ${chunkType} chunk CRC32가 일치하지 않습니다.`);
    if (offset === 8 && (chunkType !== "IHDR" || chunkSize !== 13)) fail("PNG IHDR가 올바르지 않습니다.");
    if (chunkType === "IHDR") {
      if (dimensions) fail("PNG IHDR가 중복됩니다.");
      dimensions = { width: buffer.readUInt32BE(dataOffset), height: buffer.readUInt32BE(dataOffset + 4) };
    }
    if (chunkType === "acTL") fail("animated PNG를 허용하지 않습니다.");
    if (chunkType === "IEND") {
      if (chunkSize !== 0 || nextOffset !== buffer.length) fail("PNG IEND 뒤에 바이트를 허용하지 않습니다.");
      sawEnd = true;
      break;
    }
    offset = nextOffset;
  }
  if (!dimensions || !sawEnd) fail("PNG 필수 chunk를 확인할 수 없습니다.");
  assertSourceDimensions(dimensions.width, dimensions.height);
  return dimensions;
}

function inspectSourceWebpContainer(buffer: Buffer): void {
  if (buffer.length < 20 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    fail("WebP MIME signature가 올바르지 않습니다.");
  }
  if (buffer.readUInt32LE(4) + 8 !== buffer.length) fail("WebP RIFF 크기와 실제 파일 크기가 다릅니다.");
  let hasPayload = false;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkName = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const nextOffset = offset + 8 + chunkSize + (chunkSize % 2);
    if (nextOffset > buffer.length) fail("WebP chunk 범위가 파일을 벗어납니다.");
    if (chunkName === "ANIM" || chunkName === "ANMF") fail("animated WebP를 허용하지 않습니다.");
    if (chunkName === "VP8X" && (buffer[offset + 8]! & 0x02) !== 0) fail("animated WebP를 허용하지 않습니다.");
    if (chunkName === "VP8 " || chunkName === "VP8L") hasPayload = true;
    offset = nextOffset;
  }
  if (offset !== buffer.length || !hasPayload) fail("WebP 이미지 payload를 확인할 수 없습니다.");
}

export async function inspectPalworldSourceImage(
  buffer: Buffer,
  sourceFileName: string
): Promise<PalworldSourceImageInspection> {
  if (buffer.length < 1 || buffer.length > PALWORLD_IMAGE_SOURCE_MAX_BYTES) {
    fail(`원본 이미지 파일은 ${PALWORLD_IMAGE_SOURCE_MAX_BYTES} bytes 이하여야 합니다.`);
  }
  const extension = path.extname(sourceFileName);
  let expectedMime: PalworldSourceImageInspection["mime"];
  if (extension === ".png") {
    inspectPngContainer(buffer);
    expectedMime = "image/png";
  } else if (extension === ".webp") {
    inspectSourceWebpContainer(buffer);
    expectedMime = "image/webp";
  } else {
    fail("원본 확장자는 .png 또는 .webp여야 합니다.");
  }
  const { default: sharp } = await import("sharp");
  let metadata;
  try {
    metadata = await sharp(buffer, {
      animated: true,
      failOn: "warning",
      limitInputPixels: PALWORLD_IMAGE_SOURCE_MAX_PIXELS
    }).metadata();
  } catch {
    fail(`원본 이미지 decoder 검증에 실패했습니다: ${path.basename(sourceFileName)}`);
  }
  const actualMime = metadata.format === "png" ? "image/png" : metadata.format === "webp" ? "image/webp" : undefined;
  if (actualMime !== expectedMime) fail("파일 확장자와 실제 MIME 형식이 일치하지 않습니다.");
  if ((metadata.pages ?? 1) !== 1) fail("animated 이미지를 허용하지 않습니다.");
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  assertSourceDimensions(width, height);
  return {
    mime: actualMime,
    width,
    height,
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex")
  };
}

function inspectVp8(buffer: Buffer, dataOffset: number, chunkSize: number): { width: number; height: number } {
  if (chunkSize < 10 || dataOffset + 10 > buffer.length) fail("WebP VP8 payload가 손상되었습니다.");
  if (buffer[dataOffset + 3] !== 0x9d || buffer[dataOffset + 4] !== 0x01 || buffer[dataOffset + 5] !== 0x2a) {
    fail("WebP VP8 frame signature가 올바르지 않습니다.");
  }
  return {
    width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
    height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff
  };
}

function inspectVp8l(buffer: Buffer, dataOffset: number, chunkSize: number): { width: number; height: number } {
  if (chunkSize < 5 || dataOffset + 5 > buffer.length || buffer[dataOffset] !== 0x2f) fail("WebP VP8L payload가 손상되었습니다.");
  const byte1 = buffer[dataOffset + 1]!;
  const byte2 = buffer[dataOffset + 2]!;
  const byte3 = buffer[dataOffset + 3]!;
  const byte4 = buffer[dataOffset + 4]!;
  return {
    width: 1 + byte1 + ((byte2 & 0x3f) << 8),
    height: 1 + (byte2 >> 6) + (byte3 << 2) + ((byte4 & 0x0f) << 10)
  };
}

export function inspectPalworldWebp(buffer: Buffer): PalworldWebpInspection {
  if (buffer.length > PALWORLD_PAL_IMAGE_MAX_BYTES) fail(`WebP 파일은 ${PALWORLD_PAL_IMAGE_MAX_BYTES} bytes 이하여야 합니다.`);
  if (buffer.length < 20 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    fail("WebP MIME signature가 올바르지 않습니다.");
  }
  const declaredSize = buffer.readUInt32LE(4) + 8;
  if (declaredSize !== buffer.length) fail("WebP RIFF 크기와 실제 파일 크기가 다릅니다.");

  let dimensions: { width: number; height: number } | undefined;
  let hasImagePayload = false;
  let hasExtendedHeader = false;
  let offset = 12;
  for (; offset + 8 <= buffer.length;) {
    const chunkName = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    const paddedSize = chunkSize + (chunkSize % 2);
    if (dataOffset + paddedSize > buffer.length) fail("WebP chunk 범위가 파일을 벗어납니다.");
    if (WEBP_METADATA_CHUNKS.has(chunkName)) fail(`애니메이션 또는 불필요한 metadata chunk를 허용하지 않습니다: ${chunkName.trim()}`);
    if (!WEBP_ALLOWED_CHUNKS.has(chunkName)) fail(`허용되지 않은 WebP chunk입니다: ${chunkName.trim()}`);
    if (chunkName === "VP8X") {
      if (hasExtendedHeader || offset !== 12 || chunkSize !== 10) fail("WebP VP8X header가 올바르지 않습니다.");
      hasExtendedHeader = true;
      const flags = buffer[dataOffset]!;
      if ((flags & 0x02) !== 0) fail("애니메이션 WebP를 허용하지 않습니다.");
      if ((flags & 0x2c) !== 0) fail("WebP metadata flag를 허용하지 않습니다.");
      if ((flags & 0xc1) !== 0) fail("WebP VP8X reserved flag가 설정되어 있습니다.");
      dimensions = {
        width: 1 + readUint24LE(buffer, dataOffset + 4),
        height: 1 + readUint24LE(buffer, dataOffset + 7)
      };
    } else if (chunkName === "VP8 ") {
      const payloadDimensions = inspectVp8(buffer, dataOffset, chunkSize);
      if (hasImagePayload) fail("WebP 이미지 payload는 하나만 허용됩니다.");
      if (dimensions && (dimensions.width !== payloadDimensions.width || dimensions.height !== payloadDimensions.height)) {
        fail("WebP VP8X 크기와 이미지 payload 크기가 다릅니다.");
      }
      dimensions = payloadDimensions;
      hasImagePayload = true;
    } else if (chunkName === "VP8L") {
      const payloadDimensions = inspectVp8l(buffer, dataOffset, chunkSize);
      if (hasImagePayload) fail("WebP 이미지 payload는 하나만 허용됩니다.");
      if (dimensions && (dimensions.width !== payloadDimensions.width || dimensions.height !== payloadDimensions.height)) {
        fail("WebP VP8X 크기와 이미지 payload 크기가 다릅니다.");
      }
      dimensions = payloadDimensions;
      hasImagePayload = true;
    }
    offset = dataOffset + paddedSize;
  }
  if (offset !== buffer.length) fail("WebP chunk 뒤에 해석되지 않은 바이트가 있습니다.");
  if (!hasImagePayload || !dimensions || dimensions.width < 1 || dimensions.height < 1) fail("WebP 이미지 payload와 크기를 확인할 수 없습니다.");
  if (dimensions.width > PALWORLD_PAL_IMAGE_MAX_DIMENSION || dimensions.height > PALWORLD_PAL_IMAGE_MAX_DIMENSION) {
    fail(`WebP 크기는 ${PALWORLD_PAL_IMAGE_MAX_DIMENSION}×${PALWORLD_PAL_IMAGE_MAX_DIMENSION} 이하여야 합니다.`);
  }
  return {
    ...dimensions,
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex")
  };
}

async function readRegularFile(filePath: string): Promise<Buffer> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const info = await handle.stat();
    if (!info.isFile()) fail(`regular file만 허용됩니다: ${path.basename(filePath)}`);
    if (info.size < 1 || info.size > PALWORLD_PAL_IMAGE_MAX_BYTES) {
      fail(`WebP 파일은 ${PALWORLD_PAL_IMAGE_MAX_BYTES} bytes 이하여야 합니다: ${path.basename(filePath)}`);
    }
    return await handle.readFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ELOOP") fail(`symlink 파일은 허용되지 않습니다: ${path.basename(filePath)}`);
    throw error;
  } finally {
    await handle?.close();
  }
}

function assertSourceFileName(fileName: string): void {
  if (
    fileName.length < 1
    || fileName.length > 255
    || fileName.includes("\0")
    || fileName.includes("..")
    || fileName.includes("/")
    || fileName.includes("\\")
    || fileName.includes("%")
    || fileName.startsWith(".")
    || fileName.endsWith(".")
    || fileName.trim() !== fileName
    || !/\.(?:png|webp)$/u.test(fileName)
  ) {
    fail("sourceFileName에 경로 traversal 또는 허용되지 않은 확장자가 있습니다.");
  }
}

export async function assertPalworldSourceRoot(sourceRoot: string): Promise<string> {
  const resolvedRoot = path.resolve(sourceRoot);
  try {
    const info = await lstat(resolvedRoot);
    if (info.isSymbolicLink() || !info.isDirectory()) fail("source root는 symlink가 아닌 directory여야 합니다.");
    const canonicalRoot = await realpath(resolvedRoot);
    if (canonicalRoot !== resolvedRoot) fail("source root 또는 상위 경로의 symlink를 허용하지 않습니다.");
    return canonicalRoot;
  } catch (error) {
    if (error instanceof PalworldPaldexValidationError) throw error;
    fail("source root를 안전하게 확인할 수 없습니다.");
  }
}

export async function palworldSourceImageExists(sourceRoot: string, sourceFileName: string): Promise<boolean> {
  assertSourceFileName(sourceFileName);
  const canonicalRoot = await assertPalworldSourceRoot(sourceRoot);
  const candidate = path.resolve(canonicalRoot, sourceFileName);
  if (path.dirname(candidate) !== canonicalRoot) fail("source root 밖의 파일을 읽을 수 없습니다.");
  try {
    const info = await lstat(candidate);
    if (info.isSymbolicLink()) fail(`symlink 파일은 허용되지 않습니다: ${path.basename(sourceFileName)}`);
    if (!info.isFile()) fail(`regular file만 허용됩니다: ${path.basename(sourceFileName)}`);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    if (error instanceof PalworldPaldexValidationError) throw error;
    fail(`source 파일을 확인할 수 없습니다: ${path.basename(sourceFileName)}`);
  }
}

export async function readPalworldSourceImage(sourceRoot: string, sourceFileName: string): Promise<Buffer> {
  assertSourceFileName(sourceFileName);
  const canonicalRoot = await assertPalworldSourceRoot(sourceRoot);
  const candidate = path.resolve(canonicalRoot, sourceFileName);
  if (path.dirname(candidate) !== canonicalRoot) fail("source root 밖의 파일을 읽을 수 없습니다.");
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const info = await lstat(candidate);
    if (info.isSymbolicLink()) fail(`symlink 파일은 허용되지 않습니다: ${path.basename(sourceFileName)}`);
    if (!info.isFile()) fail(`regular file만 허용됩니다: ${path.basename(sourceFileName)}`);
    if (info.size < 1 || info.size > PALWORLD_IMAGE_SOURCE_MAX_BYTES) {
      fail(`원본 이미지 파일은 ${PALWORLD_IMAGE_SOURCE_MAX_BYTES} bytes 이하여야 합니다: ${path.basename(sourceFileName)}`);
    }
    handle = await open(candidate, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const openedInfo = await handle.stat();
    if (!openedInfo.isFile() || openedInfo.dev !== info.dev || openedInfo.ino !== info.ino || openedInfo.size !== info.size) {
      fail(`검사 중 source 파일이 변경되었습니다: ${path.basename(sourceFileName)}`);
    }
    return await handle.readFile();
  } catch (error) {
    if (error instanceof PalworldPaldexValidationError) throw error;
    if ((error as NodeJS.ErrnoException).code === "ELOOP") {
      fail(`symlink 파일은 허용되지 않습니다: ${path.basename(sourceFileName)}`);
    }
    return fail(`source 파일을 읽을 수 없습니다: ${path.basename(sourceFileName)}`);
  } finally {
    await handle?.close();
  }
}

export type PalworldConvertedImage = PalworldWebpInspection & {
  originalMime: "image/png" | "image/webp";
  originalBytes: number;
  originalSha256: string;
  output: Buffer;
};

export async function convertPalworldSourceToWebp(input: {
  source: Buffer;
  sourceFileName: string;
}): Promise<PalworldConvertedImage> {
  const sourceInspection = await inspectPalworldSourceImage(input.source, input.sourceFileName);
  const { default: sharp } = await import("sharp");
  let output: Buffer | undefined;
  for (const quality of PALWORLD_IMAGE_WEBP_QUALITIES) {
    const candidate = await sharp(input.source, {
      animated: false,
      failOn: "warning",
      limitInputPixels: PALWORLD_IMAGE_SOURCE_MAX_PIXELS
    })
      .rotate()
      .resize({
        width: PALWORLD_PAL_IMAGE_MAX_DIMENSION,
        height: PALWORLD_PAL_IMAGE_MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
        kernel: "lanczos3"
      })
      .webp({
        quality,
        alphaQuality: PALWORLD_IMAGE_WEBP_ALPHA_QUALITY,
        effort: PALWORLD_IMAGE_WEBP_EFFORT,
        lossless: false,
        nearLossless: false,
        smartSubsample: false,
        preset: "picture"
      })
      .toBuffer();
    if (candidate.length <= PALWORLD_PAL_IMAGE_MAX_BYTES) {
      output = candidate;
      break;
    }
  }
  if (!output) fail(`변환된 WebP가 ${PALWORLD_PAL_IMAGE_MAX_BYTES} bytes 제한을 초과합니다.`);
  const outputInspection = inspectPalworldWebp(output);
  return {
    ...outputInspection,
    originalMime: sourceInspection.mime,
    originalBytes: sourceInspection.bytes,
    originalSha256: sourceInspection.sha256,
    output
  };
}

function allowedDuplicateHashes(value: unknown): Map<string, Set<string>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("image-overrides.json은 객체여야 합니다.");
  const root = value as Record<string, unknown>;
  if (Object.keys(root).some((key) => !["version", "release", "sharedImages"].includes(key))) {
    fail("image-overrides.json에 허용되지 않은 필드가 있습니다.");
  }
  if (root.version !== 1 || root.release !== "1.0.1" || !Array.isArray(root.sharedImages)) fail("image-overrides.json schema가 올바르지 않습니다.");
  const allowed = new Map<string, Set<string>>();
  for (const [index, entry] of root.sharedImages.entries()) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) fail(`sharedImages[${index}]는 객체여야 합니다.`);
    const record = entry as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.some((key) => !["generatedSha256", "palIds", "reasonKo"].includes(key))) fail(`sharedImages[${index}]에 허용되지 않은 필드가 있습니다.`);
    if (typeof record.generatedSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(record.generatedSha256)) fail(`sharedImages[${index}].generatedSha256가 올바르지 않습니다.`);
    if (!Array.isArray(record.palIds) || record.palIds.length < 2 || record.palIds.some((id) => typeof id !== "string")) fail(`sharedImages[${index}].palIds가 올바르지 않습니다.`);
    if (typeof record.reasonKo !== "string" || record.reasonKo.trim().length === 0) fail(`sharedImages[${index}].reasonKo가 필요합니다.`);
    const palIds = new Set(record.palIds as string[]);
    if (palIds.size !== record.palIds.length) fail(`sharedImages[${index}].palIds에 중복이 있습니다.`);
    if (allowed.has(record.generatedSha256)) fail(`sharedImages[${index}].generatedSha256가 중복됩니다.`);
    allowed.set(record.generatedSha256, palIds);
  }
  return allowed;
}

async function imageRootExistsAndIsSafe(imageRoot: string): Promise<boolean> {
  try {
    const info = await lstat(imageRoot);
    if (info.isSymbolicLink() || !info.isDirectory()) fail("이미지 root는 symlink가 아닌 directory여야 합니다.");
    const resolvedRoot = path.resolve(imageRoot);
    const canonicalRoot = await realpath(imageRoot);
    if (canonicalRoot !== resolvedRoot) fail("이미지 root의 상위 경로에도 symlink를 허용하지 않습니다.");
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function validatePalworldImageFiles(input: {
  manifest: PalworldImagesManifest;
  imageRoot: string;
  overrides: unknown;
}): Promise<{ readyImages: number; uniqueImageFiles: number }> {
  const rootExists = await imageRootExistsAndIsSafe(input.imageRoot);
  const expectedFiles = new Set<string>();
  const palIdsByHash = new Map<string, string[]>();
  for (const entry of input.manifest.entries) {
    if (entry.status !== "operator_acknowledged" && entry.status !== "ready") continue;
    const fileName = entry.outputFileName!;
    const filePath = path.join(input.imageRoot, fileName);
    if (path.dirname(filePath) !== input.imageRoot) fail("이미지 파일 경로 traversal이 감지되었습니다.");
    if (!rootExists) fail("manifest가 참조한 이미지 root가 없습니다.");
    const buffer = await readRegularFile(filePath);
    const inspection = inspectPalworldWebp(buffer);
    if (inspection.sha256 !== entry.generatedSha256 || fileName !== `${inspection.sha256}.webp`) fail(`${fileName}: content hash가 일치하지 않습니다.`);
    if (inspection.width !== entry.outputWidth || inspection.height !== entry.outputHeight || inspection.bytes !== entry.outputBytes) {
      fail(`${fileName}: manifest 이미지 크기 또는 용량과 일치하지 않습니다.`);
    }
    if (entry.imageUrl !== `${PALWORLD_PAL_IMAGE_PREFIX}${fileName}` || palworldImageHashFromUrl(entry.imageUrl) !== inspection.sha256) {
      fail(`${fileName}: 동일 출처 imageUrl 또는 hash가 올바르지 않습니다.`);
    }
    expectedFiles.add(fileName);
    const palIds = palIdsByHash.get(inspection.sha256) ?? [];
    palIds.push(entry.palId);
    palIdsByHash.set(inspection.sha256, palIds);
  }

  let actualFiles: string[] = [];
  try {
    actualFiles = await readdir(input.imageRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const fileName of actualFiles) {
    if (!/^[a-f0-9]{64}\.webp$/u.test(fileName)) fail(`허용되지 않은 이미지 파일입니다: ${fileName}`);
    const retained = inspectPalworldWebp(await readRegularFile(path.join(input.imageRoot, fileName)));
    if (fileName !== `${retained.sha256}.webp`) fail(`보존된 content-hash 이미지가 파일명과 일치하지 않습니다: ${fileName}`);
  }

  const duplicateOverrides = allowedDuplicateHashes(input.overrides);
  for (const [hash, palIds] of palIdsByHash) {
    if (palIds.length <= 1) continue;
    const overridePalIds = duplicateOverrides.get(hash);
    if (!overridePalIds) fail(`설명 없는 중복 이미지입니다: ${hash}`);
    if (palIds.some((palId) => !overridePalIds.has(palId)) || overridePalIds.size !== palIds.length) {
      fail(`중복 이미지 override의 Pal 목록이 실제 mapping과 다릅니다: ${hash}`);
    }
  }
  return {
    readyImages: input.manifest.entries.filter((entry) => entry.status === "operator_acknowledged" || entry.status === "ready").length,
    uniqueImageFiles: expectedFiles.size
  };
}

export async function collectPalworldRuntimeImageUrls(input: {
  manifest: PalworldImagesManifest;
  imageRoot: string;
}): Promise<{ imageUrls: Readonly<Record<string, string>>; readyImages: number; uniqueImageFiles: number }> {
  let rootExists = false;
  try {
    rootExists = await imageRootExistsAndIsSafe(input.imageRoot);
  } catch {
    return { imageUrls: {}, readyImages: 0, uniqueImageFiles: 0 };
  }
  if (!rootExists) return { imageUrls: {}, readyImages: 0, uniqueImageFiles: 0 };

  const imageUrls: Record<string, string> = {};
  const hashes = new Set<string>();
  for (const entry of input.manifest.entries) {
    if (entry.status !== "operator_acknowledged" && entry.status !== "ready") continue;
    try {
      const fileName = entry.outputFileName!;
      const filePath = path.join(input.imageRoot, fileName);
      if (path.dirname(filePath) !== input.imageRoot) continue;
      const inspection = inspectPalworldWebp(await readRegularFile(filePath));
      if (
        inspection.sha256 !== entry.generatedSha256
        || fileName !== `${inspection.sha256}.webp`
        || inspection.width !== entry.outputWidth
        || inspection.height !== entry.outputHeight
        || inspection.bytes !== entry.outputBytes
        || entry.imageUrl !== `${PALWORLD_PAL_IMAGE_PREFIX}${fileName}`
        || palworldImageHashFromUrl(entry.imageUrl) !== inspection.sha256
      ) continue;
      imageUrls[entry.palId] = entry.imageUrl;
      hashes.add(inspection.sha256);
    } catch {
      // 배포 후 개별 이미지 오류는 해당 Pal만 fallback으로 낮추고 텍스트 데이터는 유지한다.
    }
  }
  return {
    imageUrls: Object.freeze(imageUrls),
    readyImages: Object.keys(imageUrls).length,
    uniqueImageFiles: hashes.size
  };
}

export async function importOperatorAcknowledgedPalworldImage(input: {
  sourceRoot: string;
  sourceFileName: string;
  imageRoot: string;
  policy: PalworldImageUsePolicy;
}): Promise<PalworldWebpInspection & {
  originalMime: "image/png" | "image/webp";
  originalBytes: number;
  originalSha256: string;
  outputFileName: string;
  imageUrl: string;
}> {
  const policy = assertPalworldImageUsePolicy(input.policy);
  if (policy.status !== "operator_acknowledged" && policy.status !== "ready") {
    fail("운영자 사용 확인 또는 별도 권리 검증 전에는 이미지 파일을 반입할 수 없습니다.");
  }
  const source = await readPalworldSourceImage(input.sourceRoot, input.sourceFileName);
  const converted = await convertPalworldSourceToWebp({ source, sourceFileName: input.sourceFileName });
  const inspection = converted;
  const outputFileName = `${inspection.sha256}.webp`;
  await mkdir(input.imageRoot, { recursive: true, mode: 0o755 });
  if (!(await imageRootExistsAndIsSafe(input.imageRoot))) fail("이미지 root를 만들 수 없습니다.");
  const finalPath = path.join(input.imageRoot, outputFileName);
  const temporaryPath = `${finalPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, converted.output, { mode: 0o644, flag: "wx" });
  try {
    await link(temporaryPath, finalPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = inspectPalworldWebp(await readRegularFile(finalPath));
    if (existing.sha256 !== inspection.sha256) fail("기존 content-hash 이미지 파일의 내용이 다릅니다.");
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
  return {
    ...inspection,
    originalMime: converted.originalMime,
    originalBytes: converted.originalBytes,
    originalSha256: converted.originalSha256,
    outputFileName,
    imageUrl: `${PALWORLD_PAL_IMAGE_PREFIX}${outputFileName}`
  };
}
