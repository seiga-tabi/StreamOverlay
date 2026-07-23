import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import type { PalworldPakArchiveReader } from "./palworld-pak-preflight.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_ICON_DIMENSION = 4_096;
const MAX_MAP_DIMENSION = 8_192;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export const PALWORLD_PAK_IMAGE_TRANSFORM = Object.freeze({
  tool: "sharp",
  sharpVersion: sharp.versions.sharp,
  libvipsVersion: sharp.versions.vips,
  resizeFit: "inside",
  withoutEnlargement: true,
  iconWebp: {
    quality: 90,
    alphaQuality: 100,
    effort: 6,
    smartSubsample: true
  },
  mapWebp: {
    quality: 84,
    alphaQuality: 100,
    effort: 6,
    smartSubsample: true
  },
  metadataPolicy: "strip"
} as const);

export type PalworldPakAssetKind = "pal" | "item" | "element" | "work" | "skill" | "map";

export type PalworldPakCandidateImageAsset = {
  id: string;
  kind: PalworldPakAssetKind;
  sourceMember: string;
  sourceSha256: string;
  sourceWidth: number;
  sourceHeight: number;
  outputFile: string;
  outputSha256: string;
  outputMime: "image/webp";
  outputWidth: number;
  outputHeight: number;
  outputBytes: number;
};

export type PalworldPakPngInfo = {
  width: number;
  height: number;
  hasAlpha: boolean;
};

export class PalworldPakAssetError extends Error {
  readonly code = "PALWORLD_PAK_ASSET_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PalworldPakAssetError";
  }
}

function fail(message: string): never {
  throw new PalworldPakAssetError(message);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function validatePalworldPakPngBytes(
  bytes: Buffer,
  maximumDimension = MAX_MAP_DIMENSION
): PalworldPakPngInfo {
  if (!Buffer.isBuffer(bytes) || bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    fail("PNG signature가 올바르지 않습니다.");
  }
  if (
    !Number.isSafeInteger(maximumDimension)
    || maximumDimension < 1
    || maximumDimension > MAX_MAP_DIMENSION
  ) {
    fail("PNG dimension 제한이 올바르지 않습니다.");
  }
  let offset = 8;
  let width: number | undefined;
  let height: number | undefined;
  let colorType: number | undefined;
  let sawIend = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) fail("PNG chunk header가 잘렸습니다.");
    const length = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) fail("PNG chunk payload가 잘렸습니다.");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const typeAndData = bytes.subarray(offset + 4, offset + 8 + length);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + length);
    if (crc32(typeAndData) !== expectedCrc) fail(`PNG ${type} chunk CRC가 일치하지 않습니다.`);
    if (offset === 8 && (type !== "IHDR" || length !== 13)) {
      fail("PNG 첫 chunk는 13-byte IHDR이어야 합니다.");
    }
    if (type === "IHDR") {
      if (width !== undefined) fail("PNG IHDR chunk가 중복됩니다.");
      width = bytes.readUInt32BE(offset + 8);
      height = bytes.readUInt32BE(offset + 12);
      colorType = bytes[offset + 17];
      if (
        width < 1
        || height < 1
        || width > maximumDimension
        || height > maximumDimension
      ) {
        fail(`PNG 픽셀 크기가 ${maximumDimension}×${maximumDimension} 제한을 벗어납니다.`);
      }
    }
    if (type === "acTL") fail("animated PNG는 허용하지 않습니다.");
    if (type === "IEND") {
      if (length !== 0) fail("PNG IEND chunk 크기가 올바르지 않습니다.");
      sawIend = true;
      offset = chunkEnd;
      break;
    }
    offset = chunkEnd;
  }
  if (!sawIend || offset !== bytes.length || width === undefined || height === undefined) {
    fail("PNG가 완전한 단일 이미지가 아닙니다.");
  }
  return {
    width,
    height,
    hasAlpha: colorType === 4 || colorType === 6
  };
}

async function decodedPngInfo(bytes: Buffer, maximumDimension: number): Promise<PalworldPakPngInfo> {
  const parsed = validatePalworldPakPngBytes(bytes, maximumDimension);
  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, {
      failOn: "error",
      limitInputPixels: maximumDimension * maximumDimension
    }).metadata();
  } catch {
    fail("PNG decode 검증에 실패했습니다.");
  }
  if (
    metadata.format !== "png"
    || metadata.width !== parsed.width
    || metadata.height !== parsed.height
    || (metadata.pages ?? 1) !== 1
  ) {
    fail("PNG decode metadata가 IHDR과 일치하지 않습니다.");
  }
  return parsed;
}

function safeAssetId(value: string): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 160
    || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u.test(value)
  ) {
    fail("asset ID가 안전한 canonical 식별자가 아닙니다.");
  }
  return value;
}

export async function importPalworldPakPngAsset(input: {
  reader: PalworldPakArchiveReader;
  memberName: string;
  id: string;
  kind: PalworldPakAssetKind;
  outputRoot: string;
  maximumOutputDimension: number;
}): Promise<PalworldPakCandidateImageAsset> {
  const id = safeAssetId(input.id);
  if (!input.reader.has(input.memberName) || !input.memberName.endsWith(".png")) {
    fail("참조한 PNG member가 archive에 없습니다.");
  }
  const sourceBytes = await input.reader.readBytes(input.memberName);
  const maximumSourceDimension = input.kind === "map" ? MAX_MAP_DIMENSION : MAX_ICON_DIMENSION;
  const sourceInfo = await decodedPngInfo(sourceBytes, maximumSourceDimension);
  if (
    !Number.isSafeInteger(input.maximumOutputDimension)
    || input.maximumOutputDimension < 1
    || input.maximumOutputDimension > maximumSourceDimension
  ) {
    fail("출력 dimension 제한이 올바르지 않습니다.");
  }
  let outputBytes: Buffer;
  try {
    outputBytes = await sharp(sourceBytes, {
      failOn: "error",
      limitInputPixels: maximumSourceDimension * maximumSourceDimension
    })
      .rotate()
      .resize({
        width: input.maximumOutputDimension,
        height: input.maximumOutputDimension,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp(input.kind === "map"
        ? PALWORLD_PAK_IMAGE_TRANSFORM.mapWebp
        : PALWORLD_PAK_IMAGE_TRANSFORM.iconWebp)
      .toBuffer();
  } catch {
    fail("PNG의 deterministic WebP 변환에 실패했습니다.");
  }
  if (outputBytes.length < 1 || outputBytes.length > MAX_OUTPUT_BYTES) {
    fail("WebP 출력 크기가 안전 제한을 벗어납니다.");
  }
  const outputMetadata = await sharp(outputBytes).metadata();
  if (
    outputMetadata.format !== "webp"
    || outputMetadata.width === undefined
    || outputMetadata.height === undefined
    || outputMetadata.width > sourceInfo.width
    || outputMetadata.height > sourceInfo.height
  ) {
    fail("WebP 출력이 원본을 업스케일했거나 형식 검증에 실패했습니다.");
  }
  const outputSha256 = sha256(outputBytes);
  if (!SHA256_PATTERN.test(outputSha256)) fail("WebP SHA-256 생성에 실패했습니다.");
  const outputFile = `assets/${input.kind}/${outputSha256}.webp`;
  const absoluteOutput = path.resolve(input.outputRoot, ...outputFile.split("/"));
  const resolvedRoot = path.resolve(input.outputRoot);
  if (!absoluteOutput.startsWith(`${resolvedRoot}${path.sep}`)) fail("asset 출력 경로가 staging root를 벗어납니다.");
  await mkdir(path.dirname(absoluteOutput), { recursive: true });
  try {
    await writeFile(absoluteOutput, outputBytes, { flag: "wx", mode: 0o644 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = await readFile(absoluteOutput);
    if (!existing.equals(outputBytes)) {
      fail("기존 content-hash WebP가 다른 bytes를 포함합니다.");
    }
  }
  return {
    id,
    kind: input.kind,
    sourceMember: input.memberName,
    sourceSha256: sha256(sourceBytes),
    sourceWidth: sourceInfo.width,
    sourceHeight: sourceInfo.height,
    outputFile,
    outputSha256,
    outputMime: "image/webp",
    outputWidth: outputMetadata.width,
    outputHeight: outputMetadata.height,
    outputBytes: outputBytes.length
  };
}
