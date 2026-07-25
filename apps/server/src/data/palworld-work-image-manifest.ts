import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import {
  PALWORLD_WORK_SUITABILITY_TYPES,
  type PalworldWorkSuitabilityType
} from "@streamops/shared";

export const PALWORLD_WORK_IMAGE_MANIFEST_FILE = "work-images-manifest.json";

const RELEASE_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const CONTENT_HASH_WEBP_PATTERN = /^[a-f0-9]{64}\.webp$/u;
const MAX_MANIFEST_BYTES = 128 * 1024;

export type PalworldWorkImageManifest = {
  schemaVersion: 1;
  release: string;
  kind: "work";
  status: "operator_acknowledged";
  sourceType: "operator_pak_export";
  sourceArchiveSha256: string;
  mappingSha256: string;
  usageBasis: "operator_reference_use";
  rightsVerified: false;
  entries: Array<{
    id: PalworldWorkSuitabilityType;
    sourceMember: string;
    sourceSha256: string;
    outputSha256: string;
    outputFileName: string;
    outputWidth: 64;
    outputHeight: 64;
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

function sourceMemberAt(value: unknown, pathName: string): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 512
    || value.startsWith("/")
    || value.includes("\\")
    || value.includes("%")
    || /[\u0000-\u001f\u007f]/u.test(value)
    || path.posix.normalize(value) !== value
    || value.split("/").some((segment) =>
      segment.length === 0 || segment === "." || segment === ".."
    )
    || !value.toLowerCase().endsWith(".png")
  ) {
    fail(pathName, "고정 archive 내부의 안전한 PNG 경로여야 합니다.");
  }
  return value;
}

function outputBytesAt(value: unknown, pathName: string): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || value < 20
    || value > 512 * 1024
  ) {
    fail(pathName, "20 bytes~512 KiB 범위의 정수여야 합니다.");
  }
  return value;
}

export function assertPalworldWorkImageManifest(
  value: unknown,
  expectedRelease?: string
): PalworldWorkImageManifest {
  const root = exactRecord(value, "workImagesManifest", [
    "schemaVersion",
    "release",
    "kind",
    "status",
    "sourceType",
    "sourceArchiveSha256",
    "mappingSha256",
    "usageBasis",
    "rightsVerified",
    "entries"
  ]);
  if (root.schemaVersion !== 1) {
    fail("workImagesManifest.schemaVersion", "1이어야 합니다.");
  }
  if (
    typeof root.release !== "string"
    || !RELEASE_PATTERN.test(root.release)
    || (expectedRelease !== undefined && root.release !== expectedRelease)
  ) {
    fail("workImagesManifest.release", "active release와 일치해야 합니다.");
  }
  if (
    root.kind !== "work"
    || root.status !== "operator_acknowledged"
    || root.sourceType !== "operator_pak_export"
    || root.usageBasis !== "operator_reference_use"
    || root.rightsVerified !== false
  ) {
    fail(
      "workImagesManifest",
      "운영자 참조 사용 상태와 rightsVerified=false를 유지해야 합니다."
    );
  }
  const sourceArchiveSha256 = sha256At(
    root.sourceArchiveSha256,
    "workImagesManifest.sourceArchiveSha256"
  );
  const mappingSha256 = sha256At(
    root.mappingSha256,
    "workImagesManifest.mappingSha256"
  );
  if (
    !Array.isArray(root.entries)
    || root.entries.length !== PALWORLD_WORK_SUITABILITY_TYPES.length
  ) {
    fail(
      "workImagesManifest.entries",
      `공개 작업 적성 ${PALWORLD_WORK_SUITABILITY_TYPES.length}종을 모두 포함해야 합니다.`
    );
  }

  const ids = new Set<PalworldWorkSuitabilityType>();
  const sourceMembers = new Set<string>();
  const imageUrls = new Set<string>();
  const entries = root.entries.map((value, index) => {
    const pathName = `workImagesManifest.entries[${index}]`;
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
      !PALWORLD_WORK_SUITABILITY_TYPES.includes(
        entry.id as PalworldWorkSuitabilityType
      )
    ) {
      fail(`${pathName}.id`, "공개 작업 적성 canonical ID여야 합니다.");
    }
    const id = entry.id as PalworldWorkSuitabilityType;
    const sourceMember = sourceMemberAt(
      entry.sourceMember,
      `${pathName}.sourceMember`
    );
    const sourceSha256 = sha256At(
      entry.sourceSha256,
      `${pathName}.sourceSha256`
    );
    const outputSha256 = sha256At(
      entry.outputSha256,
      `${pathName}.outputSha256`
    );
    if (
      typeof entry.outputFileName !== "string"
      || !CONTENT_HASH_WEBP_PATTERN.test(entry.outputFileName)
      || entry.outputFileName !== `${outputSha256}.webp`
    ) {
      fail(
        `${pathName}.outputFileName`,
        "실제 output SHA-256 기반 WebP 파일명이어야 합니다."
      );
    }
    if (entry.outputWidth !== 64 || entry.outputHeight !== 64) {
      fail(
        pathName,
        "작업 적성 아이콘 출력 크기는 64×64여야 합니다."
      );
    }
    const outputBytes = outputBytesAt(
      entry.outputBytes,
      `${pathName}.outputBytes`
    );
    const expectedUrl =
      `/images/palworld/${root.release}/work/${entry.outputFileName}`;
    if (entry.imageUrl !== expectedUrl) {
      fail(
        `${pathName}.imageUrl`,
        "active release의 work content-hash URL이어야 합니다."
      );
    }
    if (
      ids.has(id)
      || sourceMembers.has(sourceMember)
      || imageUrls.has(expectedUrl)
    ) {
      fail(
        pathName,
        "작업 적성 ID, source member 및 image URL은 중복될 수 없습니다."
      );
    }
    ids.add(id);
    sourceMembers.add(sourceMember);
    imageUrls.add(expectedUrl);
    return {
      id,
      sourceMember,
      sourceSha256,
      outputSha256,
      outputFileName: entry.outputFileName,
      outputWidth: 64 as const,
      outputHeight: 64 as const,
      outputBytes,
      imageUrl: expectedUrl
    };
  });
  const sortedIds = [...ids].sort((left, right) =>
    left.localeCompare(right, "en")
  );
  if (
    JSON.stringify(entries.map((entry) => entry.id))
    !== JSON.stringify(sortedIds)
  ) {
    fail(
      "workImagesManifest.entries",
      "canonical 작업 적성 ID 순으로 정렬해야 합니다."
    );
  }

  return Object.freeze({
    schemaVersion: 1,
    release: root.release,
    kind: "work",
    status: "operator_acknowledged",
    sourceType: "operator_pak_export",
    sourceArchiveSha256,
    mappingSha256,
    usageBasis: "operator_reference_use",
    rightsVerified: false,
    entries
  }) as PalworldWorkImageManifest;
}

export async function loadPalworldWorkImageManifest(
  releaseRoot: string,
  expectedRelease: string
): Promise<PalworldWorkImageManifest> {
  const filePath = path.resolve(releaseRoot, PALWORLD_WORK_IMAGE_MANIFEST_FILE);
  const before = await lstat(filePath);
  if (
    before.isSymbolicLink()
    || !before.isFile()
    || before.size < 2
    || before.size > MAX_MANIFEST_BYTES
    || await realpath(filePath) !== filePath
  ) {
    fail(
      "workImagesManifest",
      "symlink가 아닌 안전한 크기의 canonical JSON이어야 합니다."
    );
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
      fail("workImagesManifest", "검증 중 파일이 변경되었습니다.");
    }
    const manifest = assertPalworldWorkImageManifest(
      JSON.parse(await handle.readFile("utf8")) as unknown,
      expectedRelease
    );
    const after = await handle.stat();
    if (
      !after.isFile()
      || after.dev !== opened.dev
      || after.ino !== opened.ino
      || after.size !== opened.size
    ) {
      fail("workImagesManifest", "검증 중 파일이 변경되었습니다.");
    }
    return manifest;
  } finally {
    await handle.close();
  }
}
