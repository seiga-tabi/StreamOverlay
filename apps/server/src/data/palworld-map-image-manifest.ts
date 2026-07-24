import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

export const PALWORLD_MAP_IMAGE_MANIFEST_FILE = "map-images-manifest.json";

const RELEASE_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const CONTENT_HASH_WEBP_PATTERN = /^[a-f0-9]{64}\.webp$/u;
const MAX_MANIFEST_BYTES = 64 * 1024;

export type PalworldMapImageManifest = {
  schemaVersion: 1;
  release: string;
  kind: "maps";
  status: "operator_acknowledged";
  sourceType: "operator_pak_export";
  sourceArchiveSha256: string;
  usageBasis: "operator_reference_use";
  rightsVerified: false;
  entries: Array<{
    id: string;
    sourceMember: string;
    sourceSha256: string;
    outputSha256: string;
    outputFileName: string;
    outputWidth: number;
    outputHeight: number;
    outputBytes: number;
    imageUrl: string;
  }>;
};

function fail(pathName: string, message: string): never {
  throw new Error(`${pathName}: ${message}`);
}

function exactRecord(
  value: unknown,
  pathName: string,
  keys: readonly string[]
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(pathName, "객체여야 합니다.");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(keys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${pathName}.${key}`, "허용되지 않은 필드입니다.");
  }
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) fail(`${pathName}.${key}`, "필수 필드가 없습니다.");
  }
  return record;
}

function sha256At(value: unknown, pathName: string): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    fail(pathName, "소문자 64자리 SHA-256이어야 합니다.");
  }
  return value;
}

function integerAt(
  value: unknown,
  pathName: string,
  minimum: number,
  maximum: number
): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    fail(pathName, `${minimum}~${maximum} 범위의 정수여야 합니다.`);
  }
  return value;
}

export function assertPalworldMapImageManifest(
  value: unknown,
  expectedRelease?: string
): PalworldMapImageManifest {
  const root = exactRecord(value, "mapImagesManifest", [
    "schemaVersion",
    "release",
    "kind",
    "status",
    "sourceType",
    "sourceArchiveSha256",
    "usageBasis",
    "rightsVerified",
    "entries"
  ]);
  if (root.schemaVersion !== 1) fail("mapImagesManifest.schemaVersion", "1이어야 합니다.");
  if (
    typeof root.release !== "string"
    || !RELEASE_PATTERN.test(root.release)
    || (expectedRelease !== undefined && root.release !== expectedRelease)
  ) {
    fail("mapImagesManifest.release", "active release와 일치해야 합니다.");
  }
  if (
    root.kind !== "maps"
    || root.status !== "operator_acknowledged"
    || root.sourceType !== "operator_pak_export"
    || root.usageBasis !== "operator_reference_use"
    || root.rightsVerified !== false
  ) {
    fail(
      "mapImagesManifest",
      "운영자 참조 사용 상태와 rightsVerified=false를 유지해야 합니다."
    );
  }
  sha256At(root.sourceArchiveSha256, "mapImagesManifest.sourceArchiveSha256");
  if (!Array.isArray(root.entries) || root.entries.length < 1 || root.entries.length > 8) {
    fail("mapImagesManifest.entries", "1~8개의 지도 이미지 배열이어야 합니다.");
  }
  const ids: string[] = [];
  const imageUrls = new Set<string>();
  const entries = root.entries.map((value, index) => {
    const pathName = `mapImagesManifest.entries[${index}]`;
    const entry = exactRecord(value, pathName, [
      "id",
      "sourceMember",
      "sourceSha256",
      "outputSha256",
      "outputFileName",
      "outputWidth",
      "outputHeight",
      "outputBytes",
      "imageUrl"
    ]);
    if (
      typeof entry.id !== "string"
      || !/^[a-z][a-z0-9-]{0,31}$/u.test(entry.id)
    ) {
      fail(`${pathName}.id`, "안전한 canonical map ID여야 합니다.");
    }
    if (
      typeof entry.sourceMember !== "string"
      || entry.sourceMember.length < 1
      || entry.sourceMember.length > 512
      || entry.sourceMember.startsWith("/")
      || entry.sourceMember.includes("\\")
      || entry.sourceMember.includes("%")
      || path.posix.normalize(entry.sourceMember) !== entry.sourceMember
      || entry.sourceMember.split("/").some((segment) =>
        segment.length === 0 || segment === "." || segment === ".."
      )
      || !entry.sourceMember.toLowerCase().endsWith(".png")
    ) {
      fail(`${pathName}.sourceMember`, "고정 archive 내부의 안전한 PNG 경로여야 합니다.");
    }
    const sourceSha256 = sha256At(entry.sourceSha256, `${pathName}.sourceSha256`);
    const outputSha256 = sha256At(entry.outputSha256, `${pathName}.outputSha256`);
    if (
      typeof entry.outputFileName !== "string"
      || !CONTENT_HASH_WEBP_PATTERN.test(entry.outputFileName)
      || entry.outputFileName !== `${outputSha256}.webp`
    ) {
      fail(`${pathName}.outputFileName`, "실제 output SHA-256 기반 WebP 파일명이어야 합니다.");
    }
    const expectedUrl = `/images/palworld/${root.release}/maps/${entry.outputFileName}`;
    if (entry.imageUrl !== expectedUrl) {
      fail(`${pathName}.imageUrl`, "active release의 maps content-hash URL이어야 합니다.");
    }
    const outputWidth = integerAt(entry.outputWidth, `${pathName}.outputWidth`, 1, 8192);
    const outputHeight = integerAt(entry.outputHeight, `${pathName}.outputHeight`, 1, 8192);
    const outputBytes = integerAt(
      entry.outputBytes,
      `${pathName}.outputBytes`,
      20,
      32 * 1024 * 1024
    );
    if (ids.includes(entry.id) || imageUrls.has(expectedUrl)) {
      fail(pathName, "map ID와 image URL은 중복될 수 없습니다.");
    }
    ids.push(entry.id);
    imageUrls.add(expectedUrl);
    return {
      id: entry.id,
      sourceMember: entry.sourceMember,
      sourceSha256,
      outputSha256,
      outputFileName: entry.outputFileName,
      outputWidth,
      outputHeight,
      outputBytes,
      imageUrl: expectedUrl
    };
  });
  if (JSON.stringify(ids) !== JSON.stringify([...ids].sort())) {
    fail("mapImagesManifest.entries", "canonical map ID 순으로 정렬해야 합니다.");
  }
  return Object.freeze({
    schemaVersion: 1,
    release: root.release,
    kind: "maps",
    status: "operator_acknowledged",
    sourceType: "operator_pak_export",
    sourceArchiveSha256: root.sourceArchiveSha256,
    usageBasis: "operator_reference_use",
    rightsVerified: false,
    entries
  }) as PalworldMapImageManifest;
}

export async function loadPalworldMapImageManifest(
  releaseRoot: string,
  expectedRelease: string
): Promise<PalworldMapImageManifest> {
  const filePath = path.resolve(releaseRoot, PALWORLD_MAP_IMAGE_MANIFEST_FILE);
  const before = await lstat(filePath);
  if (
    before.isSymbolicLink()
    || !before.isFile()
    || before.size < 2
    || before.size > MAX_MANIFEST_BYTES
    || await realpath(filePath) !== filePath
  ) {
    fail("mapImagesManifest", "symlink가 아닌 안전한 크기의 canonical JSON이어야 합니다.");
  }
  const handle = await open(
    filePath,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
  );
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile()
      || opened.dev !== before.dev
      || opened.ino !== before.ino
      || opened.size !== before.size
    ) {
      fail("mapImagesManifest", "검증 중 파일이 변경되었습니다.");
    }
    return assertPalworldMapImageManifest(
      JSON.parse(await handle.readFile("utf8")) as unknown,
      expectedRelease
    );
  } finally {
    await handle.close();
  }
}
