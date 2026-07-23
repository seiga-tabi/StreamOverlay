import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import {
  PALWORLD_PAK_CANDIDATE_ARTIFACT_FILES,
  assertPalworldPakCandidateArtifact,
  assertPalworldSourceProvenance,
  type PalworldPakCandidateArtifactFile,
  type PalworldSourceProvenance
} from "@streamops/shared";

export const PALWORLD_PAK_RUNTIME_MANIFEST_FILE = "runtime-manifest.json";
export const PALWORLD_PAK_BLOCKED_CANDIDATE_MANIFEST_FILE =
  "runtime-manifest.candidate.json";
export const PALWORLD_PAK_RUNTIME_MANIFEST_SCHEMA_VERSION = 1 as const;

export const PALWORLD_PAK_RUNTIME_ACTIVATION_STATES = [
  "blocked",
  "candidate",
  "ready"
] as const;

export const PALWORLD_PAK_RUNTIME_DOMAINS = [
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

export const PALWORLD_PAK_RUNTIME_ARTIFACT_KINDS = [
  "paldex",
  "catalog",
  "items",
  "skills",
  "breeding",
  "locale-ko",
  "locale-ja",
  "locale-en",
  "pal-images-manifest",
  "item-images-manifest",
  "element-images-manifest",
  "work-images-manifest",
  "skill-images-manifest",
  "map-manifest",
  "import-report"
] as const;

export type PalworldPakRuntimeActivationState =
  (typeof PALWORLD_PAK_RUNTIME_ACTIVATION_STATES)[number];
export type PalworldPakRuntimeDomain =
  (typeof PALWORLD_PAK_RUNTIME_DOMAINS)[number];
export type PalworldPakRuntimeArtifactKind =
  (typeof PALWORLD_PAK_RUNTIME_ARTIFACT_KINDS)[number];

export type PalworldPakRuntimeCoverageCount = {
  available: number;
  missing: number;
  total: number;
};

export type PalworldPakRuntimeManifest = {
  schemaVersion: 1;
  release: string;
  gameVersion: string;
  steamBuildId: string;
  source: {
    type: "operator_pak_export";
    archiveSha256: string;
    importRevision: string;
    license: "RIGHTS_NOT_INDEPENDENTLY_VERIFIED";
    usageBasis: "operator_reference_use";
    rightsVerified: false;
  };
  activation: Record<PalworldPakRuntimeDomain, PalworldPakRuntimeActivationState>;
  counts: {
    pals: number;
    items: number;
    skills: number;
    breedingResults: number;
    specialBreedingRules: number;
  };
  coverage: Record<PalworldPakRuntimeDomain, PalworldPakRuntimeCoverageCount>;
  artifacts: Array<{
    kind: PalworldPakRuntimeArtifactKind;
    file: string;
    sha256: string;
    bytes: number;
  }>;
};

export type PalworldPakCandidateStagingValidationResult = {
  manifest: PalworldPakRuntimeManifest;
  verifiedArtifacts: ReadonlyArray<{
    kind: PalworldPakRuntimeArtifactKind;
    file: string;
    sha256: string;
    bytes: number;
  }>;
};

const MANIFEST_MAX_BYTES = 256 * 1024;
const ARTIFACT_MAX_BYTES = 256 * 1024 * 1024;
const MAX_COUNT = 100_000_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RELEASE_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const STEAM_BUILD_ID_PATTERN = /^[1-9]\d{0,19}$/u;
const IMPORT_REVISION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const SAFE_RELATIVE_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*\.json$/u;

const REQUIRED_ARTIFACTS_BY_DOMAIN: Readonly<
  Record<PalworldPakRuntimeDomain, ReadonlyArray<ReadonlyArray<PalworldPakRuntimeArtifactKind>>>
> = {
  pals: [["paldex"]],
  items: [["items", "catalog"]],
  skills: [["skills", "catalog"]],
  breeding: [["breeding"]],
  localizationKo: [["locale-ko"]],
  localizationJa: [["locale-ja"]],
  localizationEn: [["locale-en"]],
  palImages: [["pal-images-manifest"]],
  itemImages: [["item-images-manifest"]],
  elementImages: [["element-images-manifest"]],
  workImages: [["work-images-manifest"]],
  skillImages: [["skill-images-manifest"]],
  map: [["map-manifest"]]
};

export class PalworldPakRuntimeManifestError extends Error {
  readonly code = "PALWORLD_PAK_RUNTIME_MANIFEST_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PalworldPakRuntimeManifestError";
  }
}

function fail(pathName: string, message: string): never {
  throw new PalworldPakRuntimeManifestError(`${pathName}: ${message}`);
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

function stringAt(value: unknown, pathName: string, maxLength: number): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > maxLength
    || value.trim() !== value
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    fail(pathName, `앞뒤 공백과 제어문자가 없는 ${maxLength}자 이하 문자열이어야 합니다.`);
  }
  return value;
}

function integerAt(value: unknown, pathName: string, max = MAX_COUNT): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > max) {
    fail(pathName, `0~${max} 범위의 안전한 정수여야 합니다.`);
  }
  return value as number;
}

function positiveIntegerAt(value: unknown, pathName: string, max: number): number {
  const result = integerAt(value, pathName, max);
  if (result === 0) fail(pathName, `1~${max} 범위의 안전한 정수여야 합니다.`);
  return result;
}

function sha256At(value: unknown, pathName: string): string {
  const sha256 = stringAt(value, pathName, 64);
  if (!SHA256_PATTERN.test(sha256)) fail(pathName, "소문자 64자리 SHA-256이어야 합니다.");
  return sha256;
}

function releaseAt(value: unknown, pathName: string): string {
  const release = stringAt(value, pathName, 64);
  if (!RELEASE_PATTERN.test(release)) fail(pathName, "major.minor.patch 형식이어야 합니다.");
  return release;
}

function steamBuildIdAt(value: unknown, pathName: string): string {
  const steamBuildId = stringAt(value, pathName, 20);
  if (!STEAM_BUILD_ID_PATTERN.test(steamBuildId)) {
    fail(pathName, "0으로 시작하지 않는 20자리 이하 숫자 문자열이어야 합니다.");
  }
  return steamBuildId;
}

export function assertPalworldPakRuntimeRelativeFile(
  value: unknown,
  pathName = "artifact.file"
): string {
  const file = stringAt(value, pathName, 240);
  if (
    !SAFE_RELATIVE_FILE_PATTERN.test(file)
    || file.startsWith("/")
    || file.includes("\\")
    || file.includes("%")
    || file.includes("//")
    || file === PALWORLD_PAK_RUNTIME_MANIFEST_FILE
  ) {
    fail(pathName, "runtime release 내부의 안전한 상대 JSON 경로여야 합니다.");
  }
  const segments = file.split("/");
  if (
    segments.some((segment) =>
      segment.length === 0
      || segment === "."
      || segment === ".."
      || segment.startsWith(".")
    )
    || path.posix.normalize(file) !== file
  ) {
    fail(pathName, "dot segment 또는 비정규 경로를 포함할 수 없습니다.");
  }
  return file;
}

function activationAt(
  value: unknown,
  pathName: string
): Record<PalworldPakRuntimeDomain, PalworldPakRuntimeActivationState> {
  const record = recordAt(value, pathName, PALWORLD_PAK_RUNTIME_DOMAINS);
  const result = {} as Record<PalworldPakRuntimeDomain, PalworldPakRuntimeActivationState>;
  for (const domain of PALWORLD_PAK_RUNTIME_DOMAINS) {
    if (!(PALWORLD_PAK_RUNTIME_ACTIVATION_STATES as readonly unknown[]).includes(record[domain])) {
      fail(`${pathName}.${domain}`, "blocked, candidate 또는 ready여야 합니다.");
    }
    result[domain] = record[domain] as PalworldPakRuntimeActivationState;
  }
  return result;
}

function coverageAt(
  value: unknown,
  pathName: string
): Record<PalworldPakRuntimeDomain, PalworldPakRuntimeCoverageCount> {
  const record = recordAt(value, pathName, PALWORLD_PAK_RUNTIME_DOMAINS);
  const result = {} as Record<PalworldPakRuntimeDomain, PalworldPakRuntimeCoverageCount>;
  for (const domain of PALWORLD_PAK_RUNTIME_DOMAINS) {
    const coverage = recordAt(
      record[domain],
      `${pathName}.${domain}`,
      ["available", "missing", "total"]
    );
    const available = integerAt(coverage.available, `${pathName}.${domain}.available`);
    const missing = integerAt(coverage.missing, `${pathName}.${domain}.missing`);
    const total = integerAt(coverage.total, `${pathName}.${domain}.total`);
    if (available + missing !== total) {
      fail(`${pathName}.${domain}`, "available과 missing의 합이 total과 일치해야 합니다.");
    }
    result[domain] = { available, missing, total };
  }
  return result;
}

function assertCoverageTotals(
  counts: PalworldPakRuntimeManifest["counts"],
  coverage: PalworldPakRuntimeManifest["coverage"]
): void {
  const expectedTotals: ReadonlyArray<
    readonly [PalworldPakRuntimeDomain, number]
  > = [
    ["pals", counts.pals],
    ["items", counts.items],
    ["skills", counts.skills],
    ["breeding", counts.breedingResults],
    ["palImages", counts.pals],
    ["itemImages", counts.items],
    ["skillImages", counts.skills]
  ];
  for (const [domain, expected] of expectedTotals) {
    if (coverage[domain].total !== expected) {
      fail(`manifest.coverage.${domain}.total`, `manifest.counts 기준 ${expected}이어야 합니다.`);
    }
  }
  const localizedRecords = counts.pals + counts.items + counts.skills;
  for (const domain of [
    "localizationKo",
    "localizationJa",
    "localizationEn"
  ] as const) {
    if (coverage[domain].total !== localizedRecords) {
      fail(`manifest.coverage.${domain}.total`, `Pal·아이템·스킬 합계 ${localizedRecords}이어야 합니다.`);
    }
  }
  if (counts.specialBreedingRules > counts.breedingResults) {
    fail("manifest.counts.specialBreedingRules", "전체 교배 결과 수보다 클 수 없습니다.");
  }
  if (coverage.map.total !== 1) {
    fail("manifest.coverage.map.total", "월드 지도 대상은 정확히 1개여야 합니다.");
  }
}

function artifactsAt(
  value: unknown,
  pathName: string
): PalworldPakRuntimeManifest["artifacts"] {
  if (!Array.isArray(value) || value.length === 0 || value.length > PALWORLD_PAK_RUNTIME_ARTIFACT_KINDS.length) {
    fail(pathName, `1~${PALWORLD_PAK_RUNTIME_ARTIFACT_KINDS.length}개 배열이어야 합니다.`);
  }
  const kinds = new Set<PalworldPakRuntimeArtifactKind>();
  const files = new Set<string>();
  const artifacts = value.map((raw, index) => {
    const entryPath = `${pathName}[${index}]`;
    const entry = recordAt(raw, entryPath, ["kind", "file", "sha256", "bytes"]);
    if (!(PALWORLD_PAK_RUNTIME_ARTIFACT_KINDS as readonly unknown[]).includes(entry.kind)) {
      fail(`${entryPath}.kind`, "runtime artifact allowlist에 없는 종류입니다.");
    }
    const kind = entry.kind as PalworldPakRuntimeArtifactKind;
    const file = assertPalworldPakRuntimeRelativeFile(entry.file, `${entryPath}.file`);
    if (kinds.has(kind)) fail(`${entryPath}.kind`, "artifact kind가 중복됩니다.");
    if (files.has(file)) fail(`${entryPath}.file`, "artifact 경로가 중복됩니다.");
    kinds.add(kind);
    files.add(file);
    return {
      kind,
      file,
      sha256: sha256At(entry.sha256, `${entryPath}.sha256`),
      bytes: positiveIntegerAt(entry.bytes, `${entryPath}.bytes`, ARTIFACT_MAX_BYTES)
    };
  });
  if (!kinds.has("import-report")) {
    fail(pathName, "검증 가능한 import-report artifact가 필요합니다.");
  }
  return artifacts.sort((left, right) =>
    (left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0)
    || (left.file < right.file ? -1 : left.file > right.file ? 1 : 0)
  );
}

function assertActivationArtifacts(
  activation: PalworldPakRuntimeManifest["activation"],
  coverage: PalworldPakRuntimeManifest["coverage"],
  artifacts: PalworldPakRuntimeManifest["artifacts"]
): void {
  const kinds = new Set(artifacts.map((artifact) => artifact.kind));
  for (const domain of PALWORLD_PAK_RUNTIME_DOMAINS) {
    const state = activation[domain];
    if (state === "ready") {
      if (coverage[domain].total === 0 || coverage[domain].missing !== 0) {
        fail(`manifest.activation.${domain}`, "ready 상태는 대상이 존재하고 coverage 누락이 없어야 합니다.");
      }
    }
    if (state === "blocked") continue;
    for (const alternatives of REQUIRED_ARTIFACTS_BY_DOMAIN[domain]) {
      if (!alternatives.some((kind) => kinds.has(kind))) {
        fail(
          `manifest.activation.${domain}`,
          `${alternatives.join(" 또는 ")} artifact가 필요합니다.`
        );
      }
    }
  }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value as object)) return value;
  seen.add(value as object);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

export function assertPalworldPakRuntimeManifest(value: unknown): PalworldPakRuntimeManifest {
  const root = recordAt(value, "manifest", [
    "schemaVersion",
    "release",
    "gameVersion",
    "steamBuildId",
    "source",
    "activation",
    "counts",
    "coverage",
    "artifacts"
  ]);
  if (root.schemaVersion !== PALWORLD_PAK_RUNTIME_MANIFEST_SCHEMA_VERSION) {
    fail("manifest.schemaVersion", "1이어야 합니다.");
  }
  const release = releaseAt(root.release, "manifest.release");
  const gameVersion = releaseAt(root.gameVersion, "manifest.gameVersion");
  if (gameVersion !== release) fail("manifest.gameVersion", "release와 정확히 일치해야 합니다.");
  const steamBuildId = steamBuildIdAt(root.steamBuildId, "manifest.steamBuildId");

  const source = recordAt(root.source, "manifest.source", [
    "type",
    "archiveSha256",
    "importRevision",
    "license",
    "usageBasis",
    "rightsVerified"
  ]);
  if (source.type !== "operator_pak_export") {
    fail("manifest.source.type", "operator_pak_export이어야 합니다.");
  }
  const archiveSha256 = sha256At(source.archiveSha256, "manifest.source.archiveSha256");
  const importRevision = stringAt(source.importRevision, "manifest.source.importRevision", 128);
  if (!IMPORT_REVISION_PATTERN.test(importRevision)) {
    fail("manifest.source.importRevision", "경로가 아닌 소문자 revision 식별자여야 합니다.");
  }
  if (
    source.license !== "RIGHTS_NOT_INDEPENDENTLY_VERIFIED"
    || source.usageBasis !== "operator_reference_use"
    || source.rightsVerified !== false
  ) {
    fail("manifest.source", "비독립 권리 확인과 운영자 참조 사용 상태를 유지해야 합니다.");
  }

  const activation = activationAt(root.activation, "manifest.activation");
  const countRecord = recordAt(root.counts, "manifest.counts", [
    "pals",
    "items",
    "skills",
    "breedingResults",
    "specialBreedingRules"
  ]);
  const counts = {
    pals: integerAt(countRecord.pals, "manifest.counts.pals"),
    items: integerAt(countRecord.items, "manifest.counts.items"),
    skills: integerAt(countRecord.skills, "manifest.counts.skills"),
    breedingResults: integerAt(
      countRecord.breedingResults,
      "manifest.counts.breedingResults"
    ),
    specialBreedingRules: integerAt(
      countRecord.specialBreedingRules,
      "manifest.counts.specialBreedingRules"
    )
  };
  const coverage = coverageAt(root.coverage, "manifest.coverage");
  assertCoverageTotals(counts, coverage);
  const artifacts = artifactsAt(root.artifacts, "manifest.artifacts");
  assertActivationArtifacts(activation, coverage, artifacts);

  return deepFreeze({
    schemaVersion: PALWORLD_PAK_RUNTIME_MANIFEST_SCHEMA_VERSION,
    release,
    gameVersion,
    steamBuildId,
    source: {
      type: "operator_pak_export",
      archiveSha256,
      importRevision,
      license: "RIGHTS_NOT_INDEPENDENTLY_VERIFIED",
      usageBasis: "operator_reference_use",
      rightsVerified: false
    },
    activation,
    counts,
    coverage,
    artifacts
  });
}

export function deterministicPalworldPakRuntimeManifestJson(value: unknown): string {
  return `${JSON.stringify(assertPalworldPakRuntimeManifest(value), null, 2)}\n`;
}

async function readRegularFile(
  filePath: string,
  maxBytes: number,
  pathName: string
): Promise<Buffer> {
  const resolved = path.resolve(filePath);
  const before = await lstat(resolved);
  if (
    before.isSymbolicLink()
    || !before.isFile()
    || before.size < 1
    || before.size > maxBytes
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

async function collectCandidateFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) fail("stagingRoot", "symlink entry를 포함할 수 없습니다.");
      if (info.isDirectory()) {
        await visit(absolute);
      } else if (info.isFile()) {
        files.push(path.relative(root, absolute).split(path.sep).join("/"));
      } else {
        fail("stagingRoot", "regular file과 directory만 포함할 수 있습니다.");
      }
    }
  }
  await visit(root);
  return files.sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function assertArtifactIdentity(
  value: unknown,
  artifact: PalworldPakRuntimeManifest["artifacts"][number],
  manifest: PalworldPakRuntimeManifest
): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`artifact.${artifact.kind}`, "JSON object여야 합니다.");
  }
  const record = value as Record<string, unknown>;
  if (record.release !== manifest.release) {
    fail(`artifact.${artifact.kind}.release`, "candidate manifest release와 일치해야 합니다.");
  }
  const metadata = record.metadata;
  if (metadata !== undefined) {
    if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
      fail(`artifact.${artifact.kind}.metadata`, "객체여야 합니다.");
    }
    const metadataRecord = metadata as Record<string, unknown>;
    if (
      metadataRecord.gameVersion !== undefined
      && metadataRecord.gameVersion !== manifest.gameVersion
    ) {
      fail(`artifact.${artifact.kind}.metadata.gameVersion`, "candidate gameVersion과 일치해야 합니다.");
    }
    if (
      metadataRecord.steamBuildId !== undefined
      && metadataRecord.steamBuildId !== manifest.steamBuildId
    ) {
      fail(`artifact.${artifact.kind}.metadata.steamBuildId`, "candidate Steam build ID와 일치해야 합니다.");
    }
  }
  if (record.gameVersion !== undefined && record.gameVersion !== manifest.gameVersion) {
    fail(`artifact.${artifact.kind}.gameVersion`, "candidate gameVersion과 일치해야 합니다.");
  }
  if (record.steamBuildId !== undefined && record.steamBuildId !== manifest.steamBuildId) {
    fail(`artifact.${artifact.kind}.steamBuildId`, "candidate Steam build ID와 일치해야 합니다.");
  }
}

const CANDIDATE_ARTIFACT_FILE_BY_RUNTIME_KIND = {
  paldex: "paldex.json",
  items: "items.json",
  skills: "skills.json",
  breeding: "breeding.json",
  "locale-ko": "locales/ko.json",
  "locale-ja": "locales/ja.json",
  "locale-en": "locales/en.json",
  "map-manifest": "map-manifest.json",
  "import-report": "import-report.json"
} as const satisfies Partial<
  Record<PalworldPakRuntimeArtifactKind, PalworldPakCandidateArtifactFile>
>;

function assertArtifactByKind(
  value: unknown,
  artifact: PalworldPakRuntimeManifest["artifacts"][number],
  manifest: PalworldPakRuntimeManifest
): void {
  assertArtifactIdentity(value, artifact, manifest);
  const candidateFile = CANDIDATE_ARTIFACT_FILE_BY_RUNTIME_KIND[artifact.kind as
    keyof typeof CANDIDATE_ARTIFACT_FILE_BY_RUNTIME_KIND];
  if (candidateFile === undefined) {
    fail(
      `artifact.${artifact.kind}`,
      "신규 operator PAK runtime용 exact validator가 없어 staging을 활성화할 수 없습니다."
    );
  }
  try {
    assertPalworldPakCandidateArtifact(candidateFile, value, {
      candidateId: `candidate-${manifest.source.archiveSha256.slice(0, 16)}`,
      release: manifest.release
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "artifact schema 검증에 실패했습니다.";
    fail(`artifact.${artifact.kind}`, message);
  }
}

export async function validatePalworldPakCandidateStagingRoot(input: {
  stagingRoot: string;
  expectedRelease?: string;
  expectedGameVersion?: string;
  expectedSteamBuildId?: string;
}): Promise<PalworldPakCandidateStagingValidationResult> {
  const stagingRoot = path.resolve(input.stagingRoot);
  const rootInfo = await lstat(stagingRoot);
  if (
    rootInfo.isSymbolicLink()
    || !rootInfo.isDirectory()
    || await realpath(stagingRoot) !== stagingRoot
  ) {
    fail("stagingRoot", "symlink가 아닌 canonical directory여야 합니다.");
  }

  const manifestPath = path.join(stagingRoot, PALWORLD_PAK_RUNTIME_MANIFEST_FILE);
  const manifestBytes = await readRegularFile(
    manifestPath,
    MANIFEST_MAX_BYTES,
    "runtimeManifest"
  );
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(manifestBytes.toString("utf8")) as unknown;
  } catch {
    fail("runtimeManifest", "올바른 JSON이어야 합니다.");
  }
  const manifest = assertPalworldPakRuntimeManifest(rawManifest);
  if (manifestBytes.toString("utf8") !== deterministicPalworldPakRuntimeManifestJson(manifest)) {
    fail("runtimeManifest", "결정적 직렬화 bytes와 일치해야 합니다.");
  }
  if (input.expectedRelease !== undefined && manifest.release !== input.expectedRelease) {
    fail("runtimeManifest.release", "기대한 release와 일치하지 않습니다.");
  }
  if (
    input.expectedGameVersion !== undefined
    && manifest.gameVersion !== input.expectedGameVersion
  ) {
    fail("runtimeManifest.gameVersion", "기대한 gameVersion과 일치하지 않습니다.");
  }
  if (
    input.expectedSteamBuildId !== undefined
    && manifest.steamBuildId !== input.expectedSteamBuildId
  ) {
    fail("runtimeManifest.steamBuildId", "기대한 Steam build ID와 일치하지 않습니다.");
  }

  const expectedFiles = [
    PALWORLD_PAK_RUNTIME_MANIFEST_FILE,
    ...manifest.artifacts.map((artifact) => artifact.file)
  ].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  const actualFiles = await collectCandidateFiles(stagingRoot);
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    fail("stagingRoot", "manifest allowlist와 실제 파일 집합이 일치하지 않습니다.");
  }

  const verifiedArtifacts = [];
  for (const artifact of manifest.artifacts) {
    const absolute = path.resolve(stagingRoot, ...artifact.file.split("/"));
    if (!absolute.startsWith(`${stagingRoot}${path.sep}`)) {
      fail(`artifact.${artifact.kind}.file`, "staging root 밖으로 벗어날 수 없습니다.");
    }
    const bytes = await readRegularFile(
      absolute,
      ARTIFACT_MAX_BYTES,
      `artifact.${artifact.kind}`
    );
    if (bytes.length !== artifact.bytes) {
      fail(`artifact.${artifact.kind}.bytes`, "실제 파일 크기와 일치하지 않습니다.");
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== artifact.sha256) {
      fail(`artifact.${artifact.kind}.sha256`, "실제 파일 checksum과 일치하지 않습니다.");
    }
    let artifactJson: unknown;
    try {
      artifactJson = JSON.parse(bytes.toString("utf8")) as unknown;
    } catch {
      fail(`artifact.${artifact.kind}`, "올바른 JSON이어야 합니다.");
    }
    assertArtifactByKind(artifactJson, artifact, manifest);
    verifiedArtifacts.push({ ...artifact });
  }

  return deepFreeze({
    manifest,
    verifiedArtifacts
  });
}

const BLOCKED_CANDIDATE_DOMAINS = [
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

const BLOCKED_CANDIDATE_COUNT_FIELDS = [
  "rawPalRows",
  "canonicalPals",
  "excludedPalRows",
  "reviewedPublicIds",
  "generatedPublicIds",
  "rawItemRows",
  "legalItems",
  "excludedItemRows",
  "activeSkills",
  "sourcePassiveSkills",
  "visiblePassiveSkills",
  "excludedPassiveSkills",
  "partnerSkills",
  "legacySkills",
  "mappedLegacySkills",
  "unresolvedLegacySkills",
  "activeAssignments",
  "resolvedActiveAssignments",
  "excludedActiveAssignments",
  "eggAssignments",
  "palsWithActiveAssignments",
  "palsWithoutActiveAssignments",
  "sourceSpecialBreedingRows",
  "resolvedSpecialBreedingRules",
  "duplicateSpecialBreedingRows",
  "unresolvedSpecialBreedingRows",
  "computedBreedingResults"
] as const;

const BLOCKED_CANDIDATE_IMAGE_DOMAINS = [
  "pals",
  "items",
  "elements",
  "work",
  "skills",
  "map"
] as const;

const BLOCKED_CANDIDATE_MAPPING_FIELDS = [
  "publicIdMap",
  "aliases",
  "palIconOverrides",
  "elementIconMap",
  "workIconMap",
  "skillIconMap",
  "exclusions",
  "legacySkillCatalog"
] as const;

const BLOCKED_CANDIDATE_ASSET_KINDS = [
  "pal",
  "item",
  "element",
  "work",
  "skill",
  "map"
] as const;

type BlockedCandidateDomain = (typeof BLOCKED_CANDIDATE_DOMAINS)[number];

export type PalworldPakBlockedCandidateManifest = {
  schemaVersion: 1;
  candidateId: string;
  release: string | null;
  gameVersion: string | null;
  steamBuildId: string | null;
  source: PalworldSourceProvenance;
  activationEligible: false;
  activation: Record<BlockedCandidateDomain, "blocked" | "candidate">;
  blockers: string[];
  counts: Record<(typeof BLOCKED_CANDIDATE_COUNT_FIELDS)[number], number>;
  localeCoverage: {
    ko: { names: number; descriptions: number };
    ja: { names: number; descriptions: number };
    en: { names: number; descriptions: number };
    placeholdersExcluded: { ko: number; ja: number; en: number };
    unresolvedRichText: { ko: number; ja: number; en: number };
  };
  imageCoverage: Record<
    (typeof BLOCKED_CANDIDATE_IMAGE_DOMAINS)[number],
    PalworldPakRuntimeCoverageCount
  >;
  mappingChecksums: Record<
    (typeof BLOCKED_CANDIDATE_MAPPING_FIELDS)[number],
    string
  >;
  artifacts: Array<{ file: string; sha256: string; bytes: number }>;
  assets: Array<{
    id: string;
    kind: (typeof BLOCKED_CANDIDATE_ASSET_KINDS)[number];
    file: string;
    sha256: string;
    bytes: number;
  }>;
};

function nullableStringAt(
  value: unknown,
  pathName: string,
  maxLength: number
): string | null {
  return value === null ? null : stringAt(value, pathName, maxLength);
}

function candidateRelativeFileAt(
  value: unknown,
  pathName: string,
  extension: ".json" | ".webp"
): string {
  const file = stringAt(value, pathName, 240);
  if (
    !file.endsWith(extension)
    || file.startsWith("/")
    || file.includes("\\")
    || file.includes("%")
    || file.includes("//")
    || path.posix.normalize(file) !== file
    || file.split("/").some((segment) =>
      segment.length === 0
      || segment === "."
      || segment === ".."
      || segment.startsWith(".")
    )
  ) {
    fail(pathName, `candidate 내부의 안전한 ${extension} 상대 경로여야 합니다.`);
  }
  return file;
}

function coverageCountAt(
  value: unknown,
  pathName: string
): PalworldPakRuntimeCoverageCount {
  const record = recordAt(value, pathName, ["available", "missing", "total"]);
  const available = integerAt(record.available, `${pathName}.available`);
  const missing = integerAt(record.missing, `${pathName}.missing`);
  const total = integerAt(record.total, `${pathName}.total`);
  if (available + missing !== total) {
    fail(pathName, "available과 missing의 합이 total과 일치해야 합니다.");
  }
  return { available, missing, total };
}

function localeCountAt(
  value: unknown,
  pathName: string
): { names: number; descriptions: number } {
  const record = recordAt(value, pathName, ["names", "descriptions"]);
  return {
    names: integerAt(record.names, `${pathName}.names`),
    descriptions: integerAt(record.descriptions, `${pathName}.descriptions`)
  };
}

function localeTripletAt(
  value: unknown,
  pathName: string
): { ko: number; ja: number; en: number } {
  const record = recordAt(value, pathName, ["ko", "ja", "en"]);
  return {
    ko: integerAt(record.ko, `${pathName}.ko`),
    ja: integerAt(record.ja, `${pathName}.ja`),
    en: integerAt(record.en, `${pathName}.en`)
  };
}

export function assertPalworldPakBlockedCandidateManifest(
  value: unknown
): PalworldPakBlockedCandidateManifest {
  const root = recordAt(value, "candidateManifest", [
    "schemaVersion",
    "candidateId",
    "release",
    "gameVersion",
    "steamBuildId",
    "source",
    "activationEligible",
    "activation",
    "blockers",
    "counts",
    "localeCoverage",
    "imageCoverage",
    "mappingChecksums",
    "artifacts",
    "assets"
  ]);
  if (root.schemaVersion !== 1) fail("candidateManifest.schemaVersion", "1이어야 합니다.");
  const candidateId = stringAt(root.candidateId, "candidateManifest.candidateId", 96);
  if (!/^candidate-[a-f0-9]{16}$/u.test(candidateId)) {
    fail("candidateManifest.candidateId", "source checksum 기반 candidate ID여야 합니다.");
  }
  const release = nullableStringAt(root.release, "candidateManifest.release", 64);
  const gameVersion = nullableStringAt(
    root.gameVersion,
    "candidateManifest.gameVersion",
    64
  );
  const steamBuildId = nullableStringAt(
    root.steamBuildId,
    "candidateManifest.steamBuildId",
    20
  );
  if ((release === null) !== (gameVersion === null) || release !== gameVersion) {
    fail("candidateManifest.release", "release와 gameVersion은 함께 null이거나 같은 값이어야 합니다.");
  }
  if ((release === null) !== (steamBuildId === null)) {
    fail("candidateManifest.steamBuildId", "version metadata는 함께 제공해야 합니다.");
  }
  const source = assertPalworldSourceProvenance(root.source);
  if (source.gameVersion !== gameVersion || source.steamBuildId !== steamBuildId) {
    fail("candidateManifest.source", "manifest version metadata와 일치해야 합니다.");
  }
  if (root.activationEligible !== false) {
    fail("candidateManifest.activationEligible", "blocked candidate는 false여야 합니다.");
  }
  const activationRecord = recordAt(
    root.activation,
    "candidateManifest.activation",
    BLOCKED_CANDIDATE_DOMAINS
  );
  const activation = {} as Record<BlockedCandidateDomain, "blocked" | "candidate">;
  for (const domain of BLOCKED_CANDIDATE_DOMAINS) {
    const state = activationRecord[domain];
    if (state !== "blocked" && state !== "candidate") {
      fail(`candidateManifest.activation.${domain}`, "blocked 또는 candidate여야 합니다.");
    }
    activation[domain] = state;
  }
  if (!Array.isArray(root.blockers) || root.blockers.length === 0 || root.blockers.length > 128) {
    fail("candidateManifest.blockers", "1~128개의 blocker 배열이어야 합니다.");
  }
  const blockers = root.blockers.map((value, index) =>
    stringAt(value, `candidateManifest.blockers[${index}]`, 96)
  );
  if (
    new Set(blockers).size !== blockers.length
    || blockers.some((blocker, index) => index > 0 && blocker <= blockers[index - 1]!)
  ) {
    fail("candidateManifest.blockers", "중복 없이 오름차순이어야 합니다.");
  }
  const countRecord = recordAt(
    root.counts,
    "candidateManifest.counts",
    BLOCKED_CANDIDATE_COUNT_FIELDS
  );
  const counts = {} as PalworldPakBlockedCandidateManifest["counts"];
  for (const field of BLOCKED_CANDIDATE_COUNT_FIELDS) {
    counts[field] = integerAt(countRecord[field], `candidateManifest.counts.${field}`);
  }
  if (
    counts.resolvedSpecialBreedingRules
      + counts.duplicateSpecialBreedingRows
      + counts.unresolvedSpecialBreedingRows
    !== counts.sourceSpecialBreedingRows
  ) {
    fail("candidateManifest.counts", "특수 교배 source 행 분류 합계가 일치해야 합니다.");
  }
  if (
    counts.resolvedActiveAssignments + counts.excludedActiveAssignments
    !== counts.activeAssignments
  ) {
    fail("candidateManifest.counts", "active assignment 분류 합계가 일치해야 합니다.");
  }
  if (
    counts.palsWithActiveAssignments + counts.palsWithoutActiveAssignments
    !== counts.canonicalPals
  ) {
    fail("candidateManifest.counts", "Pal active assignment coverage 합계가 일치해야 합니다.");
  }
  if (counts.reviewedPublicIds + counts.generatedPublicIds !== counts.canonicalPals) {
    fail("candidateManifest.counts", "Pal public ID 분류 합계가 일치해야 합니다.");
  }
  if (counts.legalItems + counts.excludedItemRows !== counts.rawItemRows) {
    fail("candidateManifest.counts", "item 입력/포함/제외 합계가 일치해야 합니다.");
  }
  if (
    counts.visiblePassiveSkills + counts.excludedPassiveSkills
    !== counts.sourcePassiveSkills
  ) {
    fail("candidateManifest.counts", "passive skill 입력/포함/제외 합계가 일치해야 합니다.");
  }
  if (counts.mappedLegacySkills + counts.unresolvedLegacySkills !== counts.legacySkills) {
    fail("candidateManifest.counts", "legacy skill migration 분류 합계가 일치해야 합니다.");
  }
  const localeRecord = recordAt(root.localeCoverage, "candidateManifest.localeCoverage", [
    "ko",
    "ja",
    "en",
    "placeholdersExcluded",
    "unresolvedRichText"
  ]);
  const localeCoverage = {
    ko: localeCountAt(localeRecord.ko, "candidateManifest.localeCoverage.ko"),
    ja: localeCountAt(localeRecord.ja, "candidateManifest.localeCoverage.ja"),
    en: localeCountAt(localeRecord.en, "candidateManifest.localeCoverage.en"),
    placeholdersExcluded: localeTripletAt(
      localeRecord.placeholdersExcluded,
      "candidateManifest.localeCoverage.placeholdersExcluded"
    ),
    unresolvedRichText: localeTripletAt(
      localeRecord.unresolvedRichText,
      "candidateManifest.localeCoverage.unresolvedRichText"
    )
  };
  const imageRecord = recordAt(
    root.imageCoverage,
    "candidateManifest.imageCoverage",
    BLOCKED_CANDIDATE_IMAGE_DOMAINS
  );
  const imageCoverage = {} as PalworldPakBlockedCandidateManifest["imageCoverage"];
  for (const domain of BLOCKED_CANDIDATE_IMAGE_DOMAINS) {
    imageCoverage[domain] = coverageCountAt(
      imageRecord[domain],
      `candidateManifest.imageCoverage.${domain}`
    );
  }
  if (
    imageCoverage.pals.total !== counts.canonicalPals
    || imageCoverage.items.total !== counts.legalItems
    || imageCoverage.skills.total
      !== counts.activeSkills + counts.visiblePassiveSkills + counts.partnerSkills
  ) {
    fail("candidateManifest.imageCoverage", "record count 기준 이미지 total과 일치해야 합니다.");
  }
  const mappingRecord = recordAt(
    root.mappingChecksums,
    "candidateManifest.mappingChecksums",
    BLOCKED_CANDIDATE_MAPPING_FIELDS
  );
  const mappingChecksums = {} as PalworldPakBlockedCandidateManifest["mappingChecksums"];
  for (const field of BLOCKED_CANDIDATE_MAPPING_FIELDS) {
    mappingChecksums[field] = sha256At(
      mappingRecord[field],
      `candidateManifest.mappingChecksums.${field}`
    );
  }
  if (!Array.isArray(root.artifacts) || root.artifacts.length === 0 || root.artifacts.length > 64) {
    fail("candidateManifest.artifacts", "1~64개의 JSON artifact 배열이어야 합니다.");
  }
  const artifactFiles = new Set<string>();
  const artifacts = root.artifacts.map((raw, index) => {
    const record = recordAt(raw, `candidateManifest.artifacts[${index}]`, [
      "file",
      "sha256",
      "bytes"
    ]);
    const file = candidateRelativeFileAt(
      record.file,
      `candidateManifest.artifacts[${index}].file`,
      ".json"
    );
    if (artifactFiles.has(file)) {
      fail(`candidateManifest.artifacts[${index}].file`, "중복 경로입니다.");
    }
    artifactFiles.add(file);
    return {
      file,
      sha256: sha256At(record.sha256, `candidateManifest.artifacts[${index}].sha256`),
      bytes: positiveIntegerAt(
        record.bytes,
        `candidateManifest.artifacts[${index}].bytes`,
        ARTIFACT_MAX_BYTES
      )
    };
  });
  if (!Array.isArray(root.assets) || root.assets.length > 10_000) {
    fail("candidateManifest.assets", "최대 10,000개의 WebP asset 배열이어야 합니다.");
  }
  const assetIdentities = new Set<string>();
  const assets = root.assets.map((raw, index) => {
    const record = recordAt(raw, `candidateManifest.assets[${index}]`, [
      "id",
      "kind",
      "file",
      "sha256",
      "bytes"
    ]);
    const id = stringAt(record.id, `candidateManifest.assets[${index}].id`, 160);
    if (!(BLOCKED_CANDIDATE_ASSET_KINDS as readonly unknown[]).includes(record.kind)) {
      fail(`candidateManifest.assets[${index}].kind`, "asset kind allowlist에 없습니다.");
    }
    const kind = record.kind as (typeof BLOCKED_CANDIDATE_ASSET_KINDS)[number];
    const identity = `${kind}\0${id}`;
    if (assetIdentities.has(identity)) {
      fail(`candidateManifest.assets[${index}]`, "kind/id가 중복됩니다.");
    }
    assetIdentities.add(identity);
    const file = candidateRelativeFileAt(
      record.file,
      `candidateManifest.assets[${index}].file`,
      ".webp"
    );
    const sha256 = sha256At(
      record.sha256,
      `candidateManifest.assets[${index}].sha256`
    );
    if (file !== `assets/${kind}/${sha256}.webp`) {
      fail(
        `candidateManifest.assets[${index}].file`,
        "asset kind 디렉터리와 실제 content hash 파일명이 일치해야 합니다."
      );
    }
    return {
      id,
      kind,
      file,
      sha256,
      bytes: positiveIntegerAt(
        record.bytes,
        `candidateManifest.assets[${index}].bytes`,
        ARTIFACT_MAX_BYTES
      )
    };
  });
  return deepFreeze({
    schemaVersion: 1,
    candidateId,
    release,
    gameVersion,
    steamBuildId,
    source,
    activationEligible: false,
    activation,
    blockers,
    counts,
    localeCoverage,
    imageCoverage,
    mappingChecksums,
    artifacts,
    assets
  });
}

export function deterministicPalworldPakBlockedCandidateManifestJson(
  value: unknown
): string {
  return `${JSON.stringify(assertPalworldPakBlockedCandidateManifest(value), null, 2)}\n`;
}

function candidateArray(
  artifacts: ReadonlyMap<string, Readonly<Record<string, unknown>>>,
  file: PalworldPakCandidateArtifactFile,
  field: string
): Array<Record<string, unknown>> {
  return (artifacts.get(file)?.[field] as Array<Record<string, unknown>> | undefined) ?? [];
}

function assertCandidateReferenceIntegrity(
  artifacts: ReadonlyMap<string, Readonly<Record<string, unknown>>>,
  manifest: PalworldPakBlockedCandidateManifest
): void {
  const pals = candidateArray(artifacts, "paldex.json", "records");
  const items = candidateArray(artifacts, "items.json", "records");
  const skills = candidateArray(artifacts, "skills.json", "records");
  const breedingParameters = candidateArray(
    artifacts,
    "breeding.json",
    "parameters"
  );
  const specialRules = candidateArray(artifacts, "breeding.json", "specialRules");
  const palIds = new Set(pals.map((entry) => entry.id as string));
  const itemIds = new Set(items.map((entry) => entry.id as string));
  const skillIds = new Set(skills.map((entry) => entry.id as string));
  const sourceLock = artifacts.get("source-lock.json")!;
  const includedSourceByMember = new Map(
    (sourceLock.includedFiles as Array<Record<string, unknown>>).map((entry) => [
      entry.member as string,
      entry
    ])
  );
  const localeSources = new Map<string, ReadonlyMap<string, Record<string, unknown>>>();
  for (const locale of ["ko", "ja", "en"] as const) {
    const localeArtifact = artifacts.get(`locales/${locale}.json`)!;
    if (localeArtifact.sourceArchiveSha256 !== manifest.source.archiveSha256) {
      fail(`locales.${locale}.sourceArchiveSha256`, "candidate source archive checksum과 일치해야 합니다.");
    }
    const records = localeArtifact.records as Array<Record<string, unknown>>;
    const recordsByKey = new Map<string, Record<string, unknown>>();
    for (const [index, record] of records.entries()) {
      const recordPath = `locales.${locale}.records[${index}]`;
      const sourceMember = includedSourceByMember.get(record.sourceMember as string);
      if (
        sourceMember === undefined
        || sourceMember.sha256 !== record.sourceMemberSha256
      ) {
        fail(`${recordPath}.sourceMemberSha256`, "source-lock의 exact member checksum과 일치해야 합니다.");
      }
      if (
        createHash("sha256").update(record.text as string, "utf8").digest("hex")
        !== record.valueSha256
      ) {
        fail(`${recordPath}.valueSha256`, "정규화된 공식 locale 값의 실제 SHA-256과 일치해야 합니다.");
      }
      recordsByKey.set(
        `${record.field as string}\0${record.messageKey as string}`,
        record
      );
    }
    localeSources.set(locale, recordsByKey);
  }
  const assertLocalizedValue = (
    value: unknown,
    pathName: string
  ): void => {
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => assertLocalizedValue(entry, `${pathName}[${index}]`));
      return;
    }
    const record = value as Record<string, unknown>;
    if (
      typeof record.messageKey === "string"
      && typeof record.sourceField === "string"
      && Object.hasOwn(record, "koStatus")
      && Object.hasOwn(record, "jaStatus")
      && Object.hasOwn(record, "enStatus")
    ) {
      const identity = `${record.sourceField}\0${record.messageKey}`;
      for (const locale of ["ko", "ja", "en"] as const) {
        const status = record[`${locale}Status`];
        const text = record[locale];
        const official = localeSources.get(locale)?.get(identity);
        if (status === "source_provided") {
          if (official === undefined || typeof text !== "string") {
            fail(`${pathName}.${locale}`, "exact 공식 locale message key와 연결되어야 합니다.");
          }
          const richStatus = record[`${locale}RichTextStatus`];
          if (richStatus === undefined && text !== official.text) {
            fail(`${pathName}.${locale}`, "공식 locale 원문 값과 정확히 일치해야 합니다.");
          }
        } else if (status === "missing_source" && official !== undefined) {
          fail(`${pathName}.${locale}Status`, "공식 locale source가 있는데 missing_source일 수 없습니다.");
        }
      }
      return;
    }
    for (const [key, nested] of Object.entries(record)) {
      assertLocalizedValue(nested, `${pathName}.${key}`);
    }
  };
  for (const [index, pal] of pals.entries()) {
    assertLocalizedValue(pal, `paldex.records[${index}]`);
  }
  for (const [index, item] of items.entries()) {
    assertLocalizedValue(item, `items.records[${index}]`);
  }
  for (const [index, skill] of skills.entries()) {
    assertLocalizedValue(skill, `skills.records[${index}]`);
  }
  if (
    pals.length !== manifest.counts.canonicalPals
    || items.length !== manifest.counts.legalItems
    || skills.filter((entry) => entry.type === "active").length
      !== manifest.counts.activeSkills
    || skills.filter((entry) => entry.type === "passive").length
      !== manifest.counts.visiblePassiveSkills
    || skills.filter((entry) => entry.type === "partner").length
      !== manifest.counts.partnerSkills
    || breedingParameters.length !== pals.length
    || specialRules.length !== manifest.counts.resolvedSpecialBreedingRules
  ) {
    fail("candidateArtifacts", "domain record 수가 candidate manifest count와 일치하지 않습니다.");
  }
  const requireReference = (
    ids: ReadonlySet<string>,
    value: unknown,
    pathName: string
  ): void => {
    if (typeof value !== "string" || !ids.has(value)) {
      fail(pathName, "canonical candidate reference가 아닙니다.");
    }
  };
  for (const [palIndex, pal] of pals.entries()) {
    const partnerSkill = pal.partnerSkill as Record<string, unknown>;
    requireReference(
      skillIds,
      partnerSkill.id,
      `paldex.records[${palIndex}].partnerSkill.id`
    );
    for (const [skillIndex, skillId] of (
      pal.activeSkillAssignmentIds as unknown[]
    ).entries()) {
      requireReference(
        skillIds,
        skillId,
        `paldex.records[${palIndex}].activeSkillAssignmentIds[${skillIndex}]`
      );
    }
    for (const [dropIndex, drop] of (
      pal.drops as Array<Record<string, unknown>>
    ).entries()) {
      if (drop.itemId !== null) {
        requireReference(
          itemIds,
          drop.itemId,
          `paldex.records[${palIndex}].drops[${dropIndex}].itemId`
        );
      }
    }
  }
  for (const [itemIndex, item] of items.entries()) {
    for (const [palIndex, palId] of (item.dropPalIds as unknown[]).entries()) {
      requireReference(
        palIds,
        palId,
        `items.records[${itemIndex}].dropPalIds[${palIndex}]`
      );
    }
    for (const [recipeIndex, recipe] of (
      item.recipes as Array<Record<string, unknown>>
    ).entries()) {
      for (const [materialIndex, material] of (
        recipe.materials as Array<Record<string, unknown>>
      ).entries()) {
        if (material.itemId !== null) {
          requireReference(
            itemIds,
            material.itemId,
            `items.records[${itemIndex}].recipes[${recipeIndex}].materials[${materialIndex}].itemId`
          );
        }
      }
    }
  }
  for (const [skillIndex, skill] of skills.entries()) {
    if (!Array.isArray(skill.relatedPalIds)) continue;
    for (const [palIndex, palId] of skill.relatedPalIds.entries()) {
      requireReference(
        palIds,
        palId,
        `skills.records[${skillIndex}].relatedPalIds[${palIndex}]`
      );
    }
  }
  for (const field of ["assignments", "excludedEggAssignments"] as const) {
    const assignments = candidateArray(artifacts, "skills.json", field);
    for (const [index, assignment] of assignments.entries()) {
      if (assignment.palId !== null) {
        requireReference(
          palIds,
          assignment.palId,
          `skills.${field}[${index}].palId`
        );
      }
      if (assignment.activeSkillId !== null) {
        requireReference(
          skillIds,
          assignment.activeSkillId,
          `skills.${field}[${index}].activeSkillId`
        );
      }
    }
  }
  const breedingPalIds = new Set(
    breedingParameters.map((entry) => entry.palId as string)
  );
  if (
    breedingPalIds.size !== palIds.size
    || [...palIds].some((id) => !breedingPalIds.has(id))
  ) {
    fail("breeding.parameters", "canonical Pal 전체와 정확히 일치해야 합니다.");
  }
  for (const [index, rule] of specialRules.entries()) {
    for (const field of ["parentAId", "parentBId", "childId"] as const) {
      requireReference(
        palIds,
        rule[field],
        `breeding.specialRules[${index}].${field}`
      );
    }
  }
  const assets = candidateArray(artifacts, "assets-manifest.json", "images");
  const assetByIdentity = new Map(
    manifest.assets.map((asset) => [`${asset.kind}\0${asset.id}`, asset])
  );
  if (assets.length !== manifest.assets.length) {
    fail("assets.images", "candidate manifest asset 선언 수와 일치해야 합니다.");
  }
  for (const [index, asset] of assets.entries()) {
    const kind = asset.kind as string;
    const id = asset.id as string;
    const declared = assetByIdentity.get(`${kind}\0${id}`);
    if (
      declared === undefined
      || declared.file !== asset.outputFile
      || declared.sha256 !== asset.outputSha256
      || declared.bytes !== asset.outputBytes
    ) {
      fail(`assets.images[${index}]`, "candidate manifest asset 선언과 일치해야 합니다.");
    }
    if (kind === "pal") {
      requireReference(palIds, id, `assets.images[${index}].id`);
    } else if (kind === "item") {
      requireReference(itemIds, id, `assets.images[${index}].id`);
    } else if (kind === "skill") {
      requireReference(skillIds, id, `assets.images[${index}].id`);
    }
  }
  const report = artifacts.get("import-report.json")!;
  if (
    JSON.stringify(report.counts) !== JSON.stringify(manifest.counts)
    || JSON.stringify(report.localeCoverage) !== JSON.stringify(manifest.localeCoverage)
    || JSON.stringify(report.imageCoverage) !== JSON.stringify(manifest.imageCoverage)
  ) {
    fail("importReport", "manifest count/coverage와 정확히 일치해야 합니다.");
  }
  const sourceLockArchive = sourceLock.archive as Record<string, unknown>;
  if (
    sourceLockArchive.sha256 !== manifest.source.archiveSha256
    || JSON.stringify(sourceLock.mappings) !== JSON.stringify(manifest.mappingChecksums)
  ) {
    fail("sourceLock", "manifest source/mapping checksum과 일치해야 합니다.");
  }
  for (const [file, artifact] of artifacts) {
    if (
      JSON.stringify(artifact.provenance)
      !== JSON.stringify(manifest.source)
    ) {
      fail(`candidateArtifact.${file}.provenance`, "manifest source와 정확히 일치해야 합니다.");
    }
  }
}

export async function validatePalworldPakBlockedCandidateStagingRoot(input: {
  stagingRoot: string;
  expectedCandidateId: string;
}): Promise<PalworldPakBlockedCandidateManifest> {
  const stagingRoot = path.resolve(input.stagingRoot);
  const rootInfo = await lstat(stagingRoot);
  if (
    rootInfo.isSymbolicLink()
    || !rootInfo.isDirectory()
    || await realpath(stagingRoot) !== stagingRoot
  ) {
    fail("stagingRoot", "symlink가 아닌 canonical directory여야 합니다.");
  }
  const manifestPath = path.join(
    stagingRoot,
    PALWORLD_PAK_BLOCKED_CANDIDATE_MANIFEST_FILE
  );
  const manifestBytes = await readRegularFile(
    manifestPath,
    MANIFEST_MAX_BYTES,
    "candidateManifest"
  );
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(manifestBytes.toString("utf8")) as unknown;
  } catch {
    fail("candidateManifest", "올바른 JSON이어야 합니다.");
  }
  const manifest = assertPalworldPakBlockedCandidateManifest(rawManifest);
  if (
    manifest.candidateId !== input.expectedCandidateId
    || manifestBytes.toString("utf8")
      !== deterministicPalworldPakBlockedCandidateManifestJson(manifest)
  ) {
    fail("candidateManifest", "기대한 ID와 결정적 JSON bytes가 일치해야 합니다.");
  }
  const expectedArtifactFiles = [...PALWORLD_PAK_CANDIDATE_ARTIFACT_FILES]
    .sort((left, right) => left.localeCompare(right, "en"));
  const declaredArtifactFiles = manifest.artifacts
    .map((artifact) => artifact.file)
    .sort((left, right) => left.localeCompare(right, "en"));
  if (
    JSON.stringify(declaredArtifactFiles)
    !== JSON.stringify(expectedArtifactFiles)
  ) {
    fail(
      "candidateManifest.artifacts",
      "blocked candidate artifact allowlist 전체와 정확히 일치해야 합니다."
    );
  }
  const expectedFiles = [
    PALWORLD_PAK_BLOCKED_CANDIDATE_MANIFEST_FILE,
    ...manifest.artifacts.map((artifact) => artifact.file),
    ...new Set(manifest.assets.map((asset) => asset.file))
  ].sort((left, right) => left.localeCompare(right, "en"));
  const actualFiles = await collectCandidateFiles(stagingRoot);
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    fail("stagingRoot", "candidate manifest allowlist와 실제 파일 집합이 일치하지 않습니다.");
  }
  const validatedArtifacts = new Map<
    string,
    Readonly<Record<string, unknown>>
  >();
  for (const artifact of manifest.artifacts) {
    const bytes = await readRegularFile(
      path.resolve(stagingRoot, ...artifact.file.split("/")),
      ARTIFACT_MAX_BYTES,
      `candidateArtifact.${artifact.file}`
    );
    if (
      bytes.length !== artifact.bytes
      || createHash("sha256").update(bytes).digest("hex") !== artifact.sha256
    ) {
      fail(`candidateArtifact.${artifact.file}`, "실제 bytes/hash와 일치하지 않습니다.");
    }
    let value: unknown;
    try {
      value = JSON.parse(bytes.toString("utf8")) as unknown;
    } catch {
      fail(`candidateArtifact.${artifact.file}`, "올바른 JSON이어야 합니다.");
    }
    const validated = assertPalworldPakCandidateArtifact(
      artifact.file as PalworldPakCandidateArtifactFile,
      value,
      {
        candidateId: manifest.candidateId,
        release: manifest.release
      }
    );
    validatedArtifacts.set(artifact.file, validated);
  }
  assertCandidateReferenceIntegrity(validatedArtifacts, manifest);
  const verifiedAssetFiles = new Map<string, { sha256: string; bytes: number }>();
  for (const asset of manifest.assets) {
    const previouslyVerified = verifiedAssetFiles.get(asset.file);
    if (
      previouslyVerified !== undefined
      && (
        previouslyVerified.sha256 !== asset.sha256
        || previouslyVerified.bytes !== asset.bytes
      )
    ) {
      fail(
        `candidateAsset.${asset.file}`,
        "같은 content-hash 파일의 checksum/bytes 선언이 서로 다릅니다."
      );
    }
    if (previouslyVerified !== undefined) continue;
    verifiedAssetFiles.set(asset.file, {
      sha256: asset.sha256,
      bytes: asset.bytes
    });
    const bytes = await readRegularFile(
      path.resolve(stagingRoot, ...asset.file.split("/")),
      ARTIFACT_MAX_BYTES,
      `candidateAsset.${asset.file}`
    );
    if (
      bytes.length !== asset.bytes
      || createHash("sha256").update(bytes).digest("hex") !== asset.sha256
      || bytes.length < 12
      || bytes.toString("ascii", 0, 4) !== "RIFF"
      || bytes.toString("ascii", 8, 12) !== "WEBP"
    ) {
      fail(`candidateAsset.${asset.file}`, "실제 WebP bytes/hash와 일치하지 않습니다.");
    }
  }
  return manifest;
}
