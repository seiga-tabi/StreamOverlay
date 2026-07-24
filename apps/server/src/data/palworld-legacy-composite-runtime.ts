import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { validatePalworldCompositeRuntimeManifest } from "@streamops/shared";
import { loadPalworldMapMarkerArtifact } from "./palworld-map-marker-artifact.js";
import { loadPalworldSpawnArtifact } from "./palworld-spawn-artifact.js";

export const PALWORLD_LEGACY_COMPOSITE_SCHEMA_VERSION = 3 as const;
export const PALWORLD_LEGACY_COMPOSITE_SCHEMA_VERSIONS = [1, 2, 3] as const;
export const PALWORLD_LEGACY_COMPOSITE_DOMAIN_STATES = [
  "active",
  "candidate",
  "unavailable"
] as const;

const REQUIRED_ARTIFACTS = [
  ["source-lock", "sources.lock.json"],
  ["paldex", "paldex.json"],
  ["paldex-manifest", "manifest.json"],
  ["pal-images-manifest", "images-manifest.json"],
  ["image-use-policy", "image-use-policy.json"],
  ["catalog", "catalog.json"],
  ["catalog-manifest", "catalog-manifest.json"],
  ["item-images-manifest", "item-images-manifest.json"],
  ["element-images-manifest", "element-images-manifest.json"],
  ["map-images-manifest", "map-images-manifest.json"],
  ["breeding", "breeding.json"],
  ["breeding-manifest", "breeding-manifest.json"],
  ["locale-manifest", "locales/manifest.json"],
  ["locale-glossary", "locales/glossary.json"],
  ["locale-ko", "locales/ko.json"],
  ["locale-ja", "locales/ja.json"],
  ["reviewed-item-aliases", "locales/reviewed-item-aliases.json"]
] as const;

const LEGACY_V2_REQUIRED_ARTIFACTS = REQUIRED_ARTIFACTS.filter(
  ([kind]) => kind !== "map-images-manifest"
);

const LEGACY_V1_REQUIRED_ARTIFACTS = [
  ["source-lock", "sources.lock.json"],
  ["paldex", "paldex.json"],
  ["paldex-manifest", "manifest.json"],
  ["pal-images-manifest", "images-manifest.json"],
  ["import-report", "import-report.json"],
  ["image-use-policy", "image-use-policy.json"],
  ["catalog", "catalog.json"],
  ["catalog-manifest", "catalog-manifest.json"],
  ["item-images-manifest", "item-images-manifest.json"],
  ["element-images-manifest", "element-images-manifest.json"],
  ["breeding", "breeding.json"],
  ["breeding-manifest", "breeding-manifest.json"],
  ["breeding-import-report", "breeding-import-report.json"],
  ["locale-manifest", "locales/manifest.json"],
  ["locale-glossary", "locales/glossary.json"],
  ["locale-ko", "locales/ko.json"],
  ["locale-ja", "locales/ja.json"],
  ["reviewed-item-aliases", "locales/reviewed-item-aliases.json"]
] as const;

const OPTIONAL_ACTIVE_ARTIFACTS = {
  mapMarkers: [
    ["map-markers", "map-markers.json"],
    ["map-markers-manifest", "map-markers-manifest.json"]
  ],
  mapSpawns: [
    ["map-spawns", "map-spawns.json"],
    ["map-spawns-manifest", "map-spawns-manifest.json"]
  ]
} as const;

export const PALWORLD_LEGACY_COMPOSITE_ARTIFACT_KINDS = [
  ...REQUIRED_ARTIFACTS.map(([kind]) => kind),
  ...LEGACY_V2_REQUIRED_ARTIFACTS.map(([kind]) => kind),
  ...LEGACY_V1_REQUIRED_ARTIFACTS.map(([kind]) => kind),
  ...OPTIONAL_ACTIVE_ARTIFACTS.mapMarkers.map(([kind]) => kind),
  ...OPTIONAL_ACTIVE_ARTIFACTS.mapSpawns.map(([kind]) => kind)
] as const;

export type PalworldLegacyCompositeDomainState =
  (typeof PALWORLD_LEGACY_COMPOSITE_DOMAIN_STATES)[number];

export type PalworldLegacyCompositeArtifactKind =
  (typeof PALWORLD_LEGACY_COMPOSITE_ARTIFACT_KINDS)[number];

export type PalworldLegacyCompositeRuntimeManifest = {
  schemaVersion: 1 | 2 | 3;
  release: string;
  artifacts: Array<{
    kind: PalworldLegacyCompositeArtifactKind;
    file: string;
    sha256: string;
  }>;
  availability: {
    mapMarkers: PalworldLegacyCompositeDomainState;
    mapSpawns: PalworldLegacyCompositeDomainState;
    workImages: "candidate" | "unavailable";
    skillImages: "candidate" | "unavailable";
  };
};

const RELEASE_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;

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

function stateAt(
  value: unknown,
  pathName: string
): PalworldLegacyCompositeDomainState {
  if (
    !(PALWORLD_LEGACY_COMPOSITE_DOMAIN_STATES as readonly unknown[])
      .includes(value)
  ) {
    fail(pathName, "active, candidate 또는 unavailable이어야 합니다.");
  }
  return value as PalworldLegacyCompositeDomainState;
}

function expectedArtifactsForAvailability(
  availability: PalworldLegacyCompositeRuntimeManifest["availability"],
  schemaVersion: PalworldLegacyCompositeRuntimeManifest["schemaVersion"]
): ReadonlyArray<readonly [PalworldLegacyCompositeArtifactKind, string]> {
  return [
    ...(schemaVersion === 1
      ? LEGACY_V1_REQUIRED_ARTIFACTS
      : schemaVersion === 2
        ? LEGACY_V2_REQUIRED_ARTIFACTS
        : REQUIRED_ARTIFACTS),
    ...(availability.mapMarkers === "active"
      ? OPTIONAL_ACTIVE_ARTIFACTS.mapMarkers
      : []),
    ...(availability.mapSpawns === "active"
      ? OPTIONAL_ACTIVE_ARTIFACTS.mapSpawns
      : [])
  ];
}

export function assertPalworldLegacyCompositeRuntimeManifest(
  value: unknown
): PalworldLegacyCompositeRuntimeManifest {
  const shared = validatePalworldCompositeRuntimeManifest(value);
  if (!shared.ok) {
    fail("legacyComposite", `Shared composite 검증에 실패했습니다. ${shared.error}`);
  }
  const record = exactRecord(value, "legacyComposite", [
    "schemaVersion",
    "release",
    "artifacts",
    "availability"
  ]);
  if (
    !(PALWORLD_LEGACY_COMPOSITE_SCHEMA_VERSIONS as readonly unknown[])
      .includes(record.schemaVersion)
  ) {
    fail("legacyComposite.schemaVersion", "1, 2 또는 3이어야 합니다.");
  }
  const schemaVersion = record.schemaVersion as 1 | 2 | 3;
  if (
    typeof record.release !== "string"
    || !RELEASE_PATTERN.test(record.release)
  ) {
    fail("legacyComposite.release", "major.minor.patch 형식이어야 합니다.");
  }
  const availabilityRecord = exactRecord(
    record.availability,
    "legacyComposite.availability",
    ["mapMarkers", "mapSpawns", "workImages", "skillImages"]
  );
  const mapMarkers = stateAt(
    availabilityRecord.mapMarkers,
    "legacyComposite.availability.mapMarkers"
  );
  const mapSpawns = stateAt(
    availabilityRecord.mapSpawns,
    "legacyComposite.availability.mapSpawns"
  );
  const workImages = stateAt(
    availabilityRecord.workImages,
    "legacyComposite.availability.workImages"
  );
  const skillImages = stateAt(
    availabilityRecord.skillImages,
    "legacyComposite.availability.skillImages"
  );
  if (workImages === "active" || skillImages === "active") {
    fail(
      "legacyComposite.availability",
      "legacy composite v1은 release별 manifest가 없는 work/skill image를 활성화할 수 없습니다."
    );
  }
  const availability = {
    mapMarkers,
    mapSpawns,
    workImages,
    skillImages
  } satisfies PalworldLegacyCompositeRuntimeManifest["availability"];
  if (!Array.isArray(record.artifacts)) {
    fail("legacyComposite.artifacts", "배열이어야 합니다.");
  }
  const artifacts = record.artifacts.map((entry, index) => {
    const artifact = exactRecord(
      entry,
      `legacyComposite.artifacts[${index}]`,
      ["kind", "file", "sha256"]
    );
    if (
      !(PALWORLD_LEGACY_COMPOSITE_ARTIFACT_KINDS as readonly unknown[])
        .includes(artifact.kind)
    ) {
      fail(
        `legacyComposite.artifacts[${index}].kind`,
        "허용된 legacy runtime artifact kind여야 합니다."
      );
    }
    if (
      typeof artifact.file !== "string"
      || artifact.file.length === 0
      || artifact.file.startsWith("/")
      || artifact.file.includes("\\")
      || artifact.file.includes("%")
      || path.posix.normalize(artifact.file) !== artifact.file
      || artifact.file.split("/").some((segment) =>
        segment.length === 0 || segment === "." || segment === ".."
      )
    ) {
      fail(
        `legacyComposite.artifacts[${index}].file`,
        "release root 내부의 안전한 상대 경로여야 합니다."
      );
    }
    if (
      typeof artifact.sha256 !== "string"
      || !SHA256_PATTERN.test(artifact.sha256)
    ) {
      fail(
        `legacyComposite.artifacts[${index}].sha256`,
        "소문자 64자리 SHA-256이어야 합니다."
      );
    }
    return {
      kind: artifact.kind as PalworldLegacyCompositeArtifactKind,
      file: artifact.file,
      sha256: artifact.sha256
    };
  });
  const expected = expectedArtifactsForAvailability(availability, schemaVersion);
  if (artifacts.length !== expected.length) {
    fail(
      "legacyComposite.artifacts",
      "availability에 맞는 exact runtime artifact 집합이어야 합니다."
    );
  }
  for (const [index, [expectedKind, expectedFile]] of expected.entries()) {
    const artifact = artifacts[index];
    if (artifact?.kind !== expectedKind || artifact.file !== expectedFile) {
      fail(
        `legacyComposite.artifacts[${index}]`,
        `${expectedKind}:${expectedFile} 순서와 일치해야 합니다.`
      );
    }
  }
  if (
    new Set(artifacts.map((artifact) => artifact.kind)).size !== artifacts.length
    || new Set(artifacts.map((artifact) => artifact.file)).size !== artifacts.length
    || new Set(artifacts.map((artifact) => artifact.sha256)).size !== artifacts.length
  ) {
    fail(
      "legacyComposite.artifacts",
      "kind, file 및 checksum은 중복될 수 없습니다."
    );
  }
  return Object.freeze({
    schemaVersion,
    release: record.release,
    artifacts,
    availability: Object.freeze(availability)
  });
}

async function readCanonicalArtifact(
  releaseRoot: string,
  file: string
): Promise<Buffer> {
  const filePath = path.resolve(releaseRoot, ...file.split("/"));
  if (!filePath.startsWith(`${releaseRoot}${path.sep}`)) {
    fail(`legacyComposite.artifacts.${file}`, "release root 밖으로 벗어났습니다.");
  }
  const before = await lstat(filePath);
  if (
    before.isSymbolicLink()
    || !before.isFile()
    || before.size < 1
    || before.size > MAX_ARTIFACT_BYTES
    || await realpath(filePath) !== filePath
  ) {
    fail(
      `legacyComposite.artifacts.${file}`,
      "symlink가 아닌 안전한 크기의 canonical regular file이어야 합니다."
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
      fail(
        `legacyComposite.artifacts.${file}`,
        "검증 중 파일이 변경되었습니다."
      );
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      !after.isFile()
      || after.dev !== opened.dev
      || after.ino !== opened.ino
      || after.size !== opened.size
    ) {
      fail(
        `legacyComposite.artifacts.${file}`,
        "검증 중 파일이 변경되었습니다."
      );
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

async function inferredAvailability(
  releaseRoot: string
): Promise<Pick<
  PalworldLegacyCompositeRuntimeManifest["availability"],
  "mapMarkers" | "mapSpawns"
>> {
  let mapMarkers: PalworldLegacyCompositeDomainState = "unavailable";
  try {
    await loadPalworldMapMarkerArtifact(releaseRoot);
    mapMarkers = "active";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      mapMarkers = "candidate";
    }
  }
  let mapSpawns: PalworldLegacyCompositeDomainState = "unavailable";
  try {
    const artifact = await loadPalworldSpawnArtifact(releaseRoot);
    mapSpawns = artifact.activation === "active" ? "active" : "candidate";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      mapSpawns = "candidate";
    }
  }
  return { mapMarkers, mapSpawns };
}

export async function createPalworldLegacyCompositeRuntimeManifest(input: {
  releaseRoot: string;
  release: string;
  workImages?: "candidate" | "unavailable";
  skillImages?: "candidate" | "unavailable";
}): Promise<PalworldLegacyCompositeRuntimeManifest> {
  const releaseRoot = path.resolve(input.releaseRoot);
  const info = await lstat(releaseRoot);
  if (
    info.isSymbolicLink()
    || !info.isDirectory()
    || await realpath(releaseRoot) !== releaseRoot
  ) {
    fail("releaseRoot", "symlink가 아닌 canonical directory여야 합니다.");
  }
  const inferred = await inferredAvailability(releaseRoot);
  const availability = {
    ...inferred,
    workImages: input.workImages ?? "unavailable",
    skillImages: input.skillImages ?? "unavailable"
  } satisfies PalworldLegacyCompositeRuntimeManifest["availability"];
  const artifacts = await Promise.all(
    expectedArtifactsForAvailability(
      availability,
      PALWORLD_LEGACY_COMPOSITE_SCHEMA_VERSION
    ).map(async ([kind, file]) => ({
      kind,
      file,
      sha256: createHash("sha256")
        .update(await readCanonicalArtifact(releaseRoot, file))
        .digest("hex")
    }))
  );
  return assertPalworldLegacyCompositeRuntimeManifest({
    schemaVersion: PALWORLD_LEGACY_COMPOSITE_SCHEMA_VERSION,
    release: input.release,
    artifacts,
    availability
  });
}

export async function verifyPalworldLegacyCompositeRuntimeManifest(input: {
  releaseRoot: string;
  expectedRelease: string;
  manifest: unknown;
}): Promise<PalworldLegacyCompositeRuntimeManifest> {
  const manifest = assertPalworldLegacyCompositeRuntimeManifest(input.manifest);
  if (manifest.release !== input.expectedRelease) {
    fail(
      "legacyComposite.release",
      "active selector release와 일치해야 합니다."
    );
  }
  for (const artifact of manifest.artifacts) {
    const actual = createHash("sha256")
      .update(await readCanonicalArtifact(path.resolve(input.releaseRoot), artifact.file))
      .digest("hex");
    if (actual !== artifact.sha256) {
      fail(
        `legacyComposite.artifacts.${artifact.kind}`,
        "실제 artifact checksum과 일치하지 않습니다."
      );
    }
  }
  if (manifest.availability.mapMarkers === "active") {
    await loadPalworldMapMarkerArtifact(path.resolve(input.releaseRoot));
  }
  if (manifest.availability.mapSpawns === "active") {
    const spawns = await loadPalworldSpawnArtifact(path.resolve(input.releaseRoot));
    if (spawns.activation !== "active") {
      fail(
        "legacyComposite.availability.mapSpawns",
        "active 상태는 activation=active artifact를 요구합니다."
      );
    }
  }
  return manifest;
}
