import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertPalworldPaldexReleaseManifest } from "./palworld-paldex-artifact.js";
import {
  validatePalworldPakCandidateStagingRoot,
  type PalworldPakRuntimeManifest
} from "./palworld-pak-runtime-manifest.js";

export const PALWORLD_ACTIVE_RUNTIME_SCHEMA_VERSION = 1 as const;
export const PALWORLD_ACTIVE_RUNTIME_FILE = "active-manifest.json";
export const PALWORLD_RUNTIME_FORMATS = [
  "legacy_release_v1",
  "operator_pak_v1"
] as const;
export const PALWORLD_OPERATOR_ACTIVE_REQUIRED_DOMAINS = [
  "pals",
  "items",
  "skills",
  "breeding",
  "localizationKo",
  "localizationJa",
  "localizationEn",
  "palImages",
  "itemImages",
  "elementImages",
  "workImages",
  "skillImages",
  "map"
] as const;

export type PalworldRuntimeFormat = (typeof PALWORLD_RUNTIME_FORMATS)[number];

export type PalworldActiveRuntimeManifest = {
  schemaVersion: 1;
  format: PalworldRuntimeFormat;
  release: string;
  releaseDirectory: string;
  manifestFile: "manifest.json" | "runtime-manifest.json";
  manifestSha256: string;
};

export type PalworldActiveRuntime = {
  manifest: PalworldActiveRuntimeManifest;
  dataRoot: string;
  releaseRoot: string;
  releaseManifestPath: string;
};

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
export const PALWORLD_DATA_ROOT = path.join(
  REPOSITORY_ROOT,
  "apps/server/data/palworld"
);
export const PALWORLD_ACTIVE_RUNTIME_PATH = path.join(
  PALWORLD_DATA_ROOT,
  "runtime",
  PALWORLD_ACTIVE_RUNTIME_FILE
);

const ACTIVE_MANIFEST_MAX_BYTES = 64 * 1024;
const RELEASE_MANIFEST_MAX_BYTES = 512 * 1024;
const RELEASE_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_DIRECTORY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,239}$/u;

export class PalworldActiveRuntimeError extends Error {
  readonly code = "PALWORLD_ACTIVE_RUNTIME_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PalworldActiveRuntimeError";
  }
}

export class PalworldPakPublicActivationError extends Error {
  readonly code:
    | "PALWORLD_PAK_RUNTIME_NOT_READY"
    | "PALWORLD_IMAGE_RELEASE_BLOCKED_BY_LICENSE";

  constructor(
    code: PalworldPakPublicActivationError["code"],
    message: string
  ) {
    super(message);
    this.name = "PalworldPakPublicActivationError";
    this.code = code;
  }
}

function fail(pathName: string, message: string): never {
  throw new PalworldActiveRuntimeError(`${pathName}: ${message}`);
}

/**
 * operator PAK schema v1의 public activation finalizer입니다.
 *
 * schema v1은 `RIGHTS_NOT_INDEPENDENTLY_VERIFIED` provenance만 허용하고
 * versioned image-use-policy 증빙을 포함하지 않습니다. 따라서 기술 gate가 모두
 * ready여도 공개 이미지·지도 활성화는 fail-closed 처리합니다. 향후 release별
 * 권리 policy artifact가 exact schema에 추가되기 전에는 이 검증을 완화하지 않습니다.
 */
export function finalizePalworldPakRuntimeForPublicActivation(
  manifest: PalworldPakRuntimeManifest
): PalworldPakRuntimeManifest {
  for (const domain of PALWORLD_OPERATOR_ACTIVE_REQUIRED_DOMAINS) {
    if (manifest.activation[domain] !== "ready") {
      throw new PalworldPakPublicActivationError(
        "PALWORLD_PAK_RUNTIME_NOT_READY",
        `runtime-manifest.activation.${domain}: 공개 API 필수 domain이 ready가 아닙니다.`
      );
    }
  }
  throw new PalworldPakPublicActivationError(
    "PALWORLD_IMAGE_RELEASE_BLOCKED_BY_LICENSE",
    "PALWORLD_IMAGE_RELEASE_BLOCKED_BY_LICENSE: operator PAK runtime schema v1에는 release별 이미지 권리 policy 증빙이 없습니다."
  );
}

function recordAt(
  value: unknown,
  pathName: string,
  requiredKeys: readonly string[]
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(pathName, "객체여야 합니다.");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(requiredKeys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${pathName}.${key}`, "허용되지 않은 필드입니다.");
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(record, key)) fail(`${pathName}.${key}`, "필수 필드가 없습니다.");
  }
  return record;
}

function stringAt(value: unknown, pathName: string, maximum: number): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > maximum
    || value.trim() !== value
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    fail(pathName, `앞뒤 공백과 제어문자가 없는 ${maximum}자 이하 문자열이어야 합니다.`);
  }
  return value;
}

function safeReleaseDirectoryAt(value: unknown): string {
  const directory = stringAt(value, "activeManifest.releaseDirectory", 240);
  if (
    !SAFE_DIRECTORY_PATTERN.test(directory)
    || directory.startsWith("/")
    || directory.includes("\\")
    || directory.includes("%")
    || directory.includes("//")
    || path.posix.normalize(directory) !== directory
    || directory.split("/")[0] === "runtime"
    || directory.split("/").some((segment) =>
      segment.length === 0
      || segment === "."
      || segment === ".."
      || segment.startsWith(".")
    )
  ) {
    fail(
      "activeManifest.releaseDirectory",
      "runtime selector와 분리된 Palworld data root 내부의 안전한 상대 디렉터리여야 합니다."
    );
  }
  return directory;
}

export function assertPalworldActiveRuntimeManifest(
  value: unknown
): PalworldActiveRuntimeManifest {
  const record = recordAt(value, "activeManifest", [
    "schemaVersion",
    "format",
    "release",
    "releaseDirectory",
    "manifestFile",
    "manifestSha256"
  ]);
  if (record.schemaVersion !== PALWORLD_ACTIVE_RUNTIME_SCHEMA_VERSION) {
    fail("activeManifest.schemaVersion", "1이어야 합니다.");
  }
  if (!(PALWORLD_RUNTIME_FORMATS as readonly unknown[]).includes(record.format)) {
    fail(
      "activeManifest.format",
      "legacy_release_v1 또는 operator_pak_v1이어야 합니다."
    );
  }
  const format = record.format as PalworldRuntimeFormat;
  const release = stringAt(record.release, "activeManifest.release", 64);
  if (!RELEASE_PATTERN.test(release)) {
    fail("activeManifest.release", "major.minor.patch 형식이어야 합니다.");
  }
  const releaseDirectory = safeReleaseDirectoryAt(record.releaseDirectory);
  const expectedManifestFile = format === "legacy_release_v1"
    ? "manifest.json"
    : "runtime-manifest.json";
  if (record.manifestFile !== expectedManifestFile) {
    fail(
      "activeManifest.manifestFile",
      `${format} 형식은 ${expectedManifestFile}을 사용해야 합니다.`
    );
  }
  const manifestSha256 = stringAt(
    record.manifestSha256,
    "activeManifest.manifestSha256",
    64
  );
  if (!SHA256_PATTERN.test(manifestSha256)) {
    fail("activeManifest.manifestSha256", "소문자 64자리 SHA-256이어야 합니다.");
  }
  return Object.freeze({
    schemaVersion: PALWORLD_ACTIVE_RUNTIME_SCHEMA_VERSION,
    format,
    release,
    releaseDirectory,
    manifestFile: expectedManifestFile,
    manifestSha256
  });
}

export function deterministicPalworldActiveRuntimeManifestJson(
  value: unknown
): string {
  return `${JSON.stringify(assertPalworldActiveRuntimeManifest(value), null, 2)}\n`;
}

async function readCanonicalRegularFile(
  filePath: string,
  maximumBytes: number,
  pathName: string
): Promise<Buffer> {
  const resolved = path.resolve(filePath);
  const before = await lstat(resolved);
  if (
    before.isSymbolicLink()
    || !before.isFile()
    || before.size < 1
    || before.size > maximumBytes
    || await realpath(resolved) !== resolved
  ) {
    fail(pathName, "symlink가 아닌 안전한 크기의 canonical regular file이어야 합니다.");
  }
  const handle = await open(resolved, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile()
      || opened.dev !== before.dev
      || opened.ino !== before.ino
      || opened.size !== before.size
    ) {
      fail(pathName, "검증 중 파일이 변경되었습니다.");
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

function parseJson(bytes: Buffer, pathName: string): unknown {
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    fail(pathName, "올바른 JSON이어야 합니다.");
  }
}

export async function loadPalworldActiveRuntime(options: {
  dataRoot?: string;
  activeManifestPath?: string;
} = {}): Promise<PalworldActiveRuntime> {
  const dataRoot = path.resolve(options.dataRoot ?? PALWORLD_DATA_ROOT);
  const dataRootInfo = await lstat(dataRoot);
  if (
    dataRootInfo.isSymbolicLink()
    || !dataRootInfo.isDirectory()
    || await realpath(dataRoot) !== dataRoot
  ) {
    fail("dataRoot", "symlink가 아닌 canonical directory여야 합니다.");
  }
  const activeManifestPath = path.resolve(
    options.activeManifestPath
      ?? path.join(dataRoot, "runtime", PALWORLD_ACTIVE_RUNTIME_FILE)
  );
  if (!activeManifestPath.startsWith(`${dataRoot}${path.sep}`)) {
    fail("activeManifestPath", "Palworld data root 내부여야 합니다.");
  }
  const activeBytes = await readCanonicalRegularFile(
    activeManifestPath,
    ACTIVE_MANIFEST_MAX_BYTES,
    "activeManifest"
  );
  const manifest = assertPalworldActiveRuntimeManifest(
    parseJson(activeBytes, "activeManifest")
  );
  if (
    activeBytes.toString("utf8")
    !== deterministicPalworldActiveRuntimeManifestJson(manifest)
  ) {
    fail("activeManifest", "결정적 직렬화 bytes와 일치해야 합니다.");
  }

  const releaseRoot = path.resolve(
    dataRoot,
    ...manifest.releaseDirectory.split("/")
  );
  if (!releaseRoot.startsWith(`${dataRoot}${path.sep}`)) {
    fail("activeManifest.releaseDirectory", "Palworld data root 밖으로 벗어날 수 없습니다.");
  }
  const releaseInfo = await lstat(releaseRoot);
  if (
    releaseInfo.isSymbolicLink()
    || !releaseInfo.isDirectory()
    || await realpath(releaseRoot) !== releaseRoot
  ) {
    fail(
      "activeManifest.releaseDirectory",
      "symlink가 아닌 canonical release directory여야 합니다."
    );
  }
  const releaseManifestPath = path.join(releaseRoot, manifest.manifestFile);
  const releaseManifestBytes = await readCanonicalRegularFile(
    releaseManifestPath,
    RELEASE_MANIFEST_MAX_BYTES,
    "releaseManifest"
  );
  const actualSha256 = createHash("sha256")
    .update(releaseManifestBytes)
    .digest("hex");
  if (actualSha256 !== manifest.manifestSha256) {
    fail("activeManifest.manifestSha256", "실제 release manifest checksum과 일치하지 않습니다.");
  }

  if (manifest.format === "legacy_release_v1") {
    const releaseManifest = assertPalworldPaldexReleaseManifest(
      parseJson(releaseManifestBytes, "releaseManifest")
    );
    if (
      releaseManifest.release !== manifest.release
      || !releaseManifest.runtimeActivation
    ) {
      fail(
        "releaseManifest",
        "active release와 버전이 같고 runtimeActivation=true여야 합니다."
      );
    }
  } else {
    const validated = await validatePalworldPakCandidateStagingRoot({
      stagingRoot: releaseRoot,
      expectedRelease: manifest.release,
      expectedGameVersion: manifest.release
    });
    finalizePalworldPakRuntimeForPublicActivation(validated.manifest);
  }

  return Object.freeze({
    manifest,
    dataRoot,
    releaseRoot,
    releaseManifestPath
  });
}
