import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import {
  assertPalworldMapLocationsArtifact,
  assertPalworldMapLocationsArtifactManifest,
  assertPalworldMapLocationsResponse,
  PALWORLD_MAP_LOCATION_CATEGORIES,
  type PalworldDataMetadata,
  type PalworldMapLocationCategory,
  type PalworldMapLocationCategoryCounts,
  type PalworldMapLocationDiagnostics,
  type PalworldMapLocationsArtifact,
  type PalworldMapLocationsResponse,
  type PalworldMapWorld
} from "@streamops/shared";

export const PALWORLD_MAP_LOCATIONS_ARTIFACT_FILE = "map-locations.json";
export const PALWORLD_MAP_LOCATIONS_MANIFEST_FILE =
  "map-locations-manifest.json";
export const PALWORLD_MAP_LOCATIONS_COMPATIBILITY_FILE =
  "map-locations-compatibility.json";

const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_APPROVAL_BYTES = 64 * 1024;
const MAX_MAP_ASSET_BYTES = 32 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RELEASE_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const REVIEWER_PATTERN = /^[a-z0-9][a-z0-9._-]{2,79}$/u;
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

type CompatibilityWorld = {
  world: PalworldMapWorld;
  targetMapAssetSha256: string;
  transformRevision: string;
};

type CompatibilityImportAudit = {
  sourceRawExact: number;
  mainIncluded: number;
  treeExcluded: number;
  outOfBoundsExcluded: number;
  exactDuplicates: number;
  taxonomyMappingSha256: string;
  transformMappingSha256: string;
};

export type PalworldMapLocationsCompatibilityApproval = {
  schemaVersion: 1;
  release: string;
  status: "operator_acknowledged";
  decision: "allow_exact_checksum_compatibility_display";
  sourceVersionVerified: false;
  compatibilityBasis: "exact_world_actor_join_and_map_geometry";
  sourceArchiveSha256: string;
  indexMemberSha256: string;
  memberInventorySha256: string;
  mapLocationsArtifactSha256: string;
  mapLocationsManifestSha256: string;
  selectedMemberCount: number;
  totalLocations: number;
  categoryCounts: PalworldMapLocationCategoryCounts;
  worlds: CompatibilityWorld[];
  importAudit: CompatibilityImportAudit;
  reviewedAt: string;
  reviewer: string;
  evidenceChecksum: string;
  rightsVerified: false;
  usageBasis: "operator_reference_use";
};

export type PalworldMapLocationsCompatibilityAuthorization = Readonly<{
  approval: PalworldMapLocationsCompatibilityApproval;
  approvalSha256: string;
  artifactSha256: string;
}>;

export type PalworldMapLocationsProvider = {
  response(
    world: PalworldMapWorld,
    layers: readonly PalworldMapLocationCategory[],
    offset: number,
    limit: number,
    metadata: PalworldDataMetadata
  ): PalworldMapLocationsResponse;
  diagnostics(): PalworldMapLocationDiagnostics;
};

export class PalworldMapLocationsArtifactError extends Error {
  readonly code:
    | "PALWORLD_MAP_LOCATIONS_ARTIFACT_INVALID"
    | "PALWORLD_MAP_LOCATIONS_ARTIFACT_NOT_ACTIVE";

  constructor(
    message: string,
    code:
      | "PALWORLD_MAP_LOCATIONS_ARTIFACT_INVALID"
      | "PALWORLD_MAP_LOCATIONS_ARTIFACT_NOT_ACTIVE" =
        "PALWORLD_MAP_LOCATIONS_ARTIFACT_INVALID"
  ) {
    super(message);
    this.name = "PalworldMapLocationsArtifactError";
    this.code = code;
  }
}

const verifiedAuthorizations = new WeakSet<object>();

function fail(pathName: string, message: string): never {
  throw new PalworldMapLocationsArtifactError(`${pathName}: ${message}`);
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
    if (!Object.hasOwn(record, key)) {
      fail(`${pathName}.${key}`, "필수 필드가 없습니다.");
    }
  }
  return record;
}

function textAt(value: unknown, pathName: string, maximum: number): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > maximum
    || value.trim() !== value
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    fail(
      pathName,
      `앞뒤 공백과 제어문자가 없는 ${maximum}자 이하 문자열이어야 합니다.`
    );
  }
  return value;
}

function sha256At(value: unknown, pathName: string): string {
  const checksum = textAt(value, pathName, 64);
  if (!SHA256_PATTERN.test(checksum)) {
    fail(pathName, "소문자 64자리 SHA-256이어야 합니다.");
  }
  return checksum;
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

function deterministicJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Bytes(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function emptyCategoryCounts(): PalworldMapLocationCategoryCounts {
  return Object.fromEntries(
    PALWORLD_MAP_LOCATION_CATEGORIES.map((category) => [category, 0])
  ) as PalworldMapLocationCategoryCounts;
}

function categoryCountsAt(
  value: unknown,
  pathName: string
): PalworldMapLocationCategoryCounts {
  const record = exactRecord(value, pathName, PALWORLD_MAP_LOCATION_CATEGORIES);
  const counts = emptyCategoryCounts();
  for (const category of PALWORLD_MAP_LOCATION_CATEGORIES) {
    counts[category] = integerAt(
      record[category],
      `${pathName}.${category}`,
      0,
      50_000
    );
  }
  return counts;
}

function approvalPayload(
  approval: Omit<PalworldMapLocationsCompatibilityApproval, "evidenceChecksum">
): unknown {
  return approval;
}

export function palworldMapLocationsCompatibilityEvidenceChecksum(
  approval: Omit<PalworldMapLocationsCompatibilityApproval, "evidenceChecksum">
): string {
  return sha256Bytes(deterministicJson(approvalPayload(approval)));
}

export function assertPalworldMapLocationsCompatibilityApproval(
  value: unknown
): PalworldMapLocationsCompatibilityApproval {
  const root = exactRecord(value, "mapLocationsCompatibility", [
    "schemaVersion",
    "release",
    "status",
    "decision",
    "sourceVersionVerified",
    "compatibilityBasis",
    "sourceArchiveSha256",
    "indexMemberSha256",
    "memberInventorySha256",
    "mapLocationsArtifactSha256",
    "mapLocationsManifestSha256",
    "selectedMemberCount",
    "totalLocations",
    "categoryCounts",
    "worlds",
    "importAudit",
    "reviewedAt",
    "reviewer",
    "evidenceChecksum",
    "rightsVerified",
    "usageBasis"
  ]);
  if (root.schemaVersion !== 1) {
    fail("mapLocationsCompatibility.schemaVersion", "1이어야 합니다.");
  }
  const release = textAt(root.release, "mapLocationsCompatibility.release", 64);
  if (!RELEASE_PATTERN.test(release)) {
    fail("mapLocationsCompatibility.release", "major.minor.patch 형식이어야 합니다.");
  }
  if (
    root.status !== "operator_acknowledged"
    || root.decision !== "allow_exact_checksum_compatibility_display"
    || root.sourceVersionVerified !== false
    || root.compatibilityBasis !== "exact_world_actor_join_and_map_geometry"
  ) {
    fail(
      "mapLocationsCompatibility",
      "source version 미확인 exact-checksum 호환성 승인 형식이어야 합니다."
    );
  }
  for (const field of [
    "sourceArchiveSha256",
    "indexMemberSha256",
    "memberInventorySha256",
    "mapLocationsArtifactSha256",
    "mapLocationsManifestSha256",
    "evidenceChecksum"
  ] as const) {
    sha256At(root[field], `mapLocationsCompatibility.${field}`);
  }
  const selectedMemberCount = integerAt(
    root.selectedMemberCount,
    "mapLocationsCompatibility.selectedMemberCount",
    1,
    20_000
  );
  const totalLocations = integerAt(
    root.totalLocations,
    "mapLocationsCompatibility.totalLocations",
    1,
    50_000
  );
  const categoryCounts = categoryCountsAt(
    root.categoryCounts,
    "mapLocationsCompatibility.categoryCounts"
  );
  if (
    Object.values(categoryCounts).reduce((sum, count) => sum + count, 0)
    !== totalLocations
  ) {
    fail(
      "mapLocationsCompatibility.categoryCounts",
      "합계가 totalLocations와 일치해야 합니다."
    );
  }
  if (!Array.isArray(root.worlds) || root.worlds.length < 1 || root.worlds.length > 2) {
    fail("mapLocationsCompatibility.worlds", "1~2개의 world 배열이어야 합니다.");
  }
  const worlds: CompatibilityWorld[] = [];
  let previousWorld = -1;
  for (const [index, valueAtIndex] of root.worlds.entries()) {
    const worldRecord = exactRecord(
      valueAtIndex,
      `mapLocationsCompatibility.worlds[${index}]`,
      ["world", "targetMapAssetSha256", "transformRevision"]
    );
    if (worldRecord.world !== "main" && worldRecord.world !== "tree") {
      fail(
        `mapLocationsCompatibility.worlds[${index}].world`,
        "main 또는 tree여야 합니다."
      );
    }
    const worldIndex = worldRecord.world === "main" ? 0 : 1;
    if (worldIndex <= previousWorld) {
      fail(
        `mapLocationsCompatibility.worlds[${index}].world`,
        "중복 없이 canonical 순서여야 합니다."
      );
    }
    previousWorld = worldIndex;
    worlds.push({
      world: worldRecord.world,
      targetMapAssetSha256: sha256At(
        worldRecord.targetMapAssetSha256,
        `mapLocationsCompatibility.worlds[${index}].targetMapAssetSha256`
      ),
      transformRevision: textAt(
        worldRecord.transformRevision,
        `mapLocationsCompatibility.worlds[${index}].transformRevision`,
        128
      )
    });
  }
  const importAuditRecord = exactRecord(
    root.importAudit,
    "mapLocationsCompatibility.importAudit",
    [
      "sourceRawExact",
      "mainIncluded",
      "treeExcluded",
      "outOfBoundsExcluded",
      "exactDuplicates",
      "taxonomyMappingSha256",
      "transformMappingSha256"
    ]
  );
  const importAudit: CompatibilityImportAudit = {
    sourceRawExact: integerAt(
      importAuditRecord.sourceRawExact,
      "mapLocationsCompatibility.importAudit.sourceRawExact",
      1,
      100_000
    ),
    mainIncluded: integerAt(
      importAuditRecord.mainIncluded,
      "mapLocationsCompatibility.importAudit.mainIncluded",
      1,
      50_000
    ),
    treeExcluded: integerAt(
      importAuditRecord.treeExcluded,
      "mapLocationsCompatibility.importAudit.treeExcluded",
      0,
      50_000
    ),
    outOfBoundsExcluded: integerAt(
      importAuditRecord.outOfBoundsExcluded,
      "mapLocationsCompatibility.importAudit.outOfBoundsExcluded",
      0,
      50_000
    ),
    exactDuplicates: integerAt(
      importAuditRecord.exactDuplicates,
      "mapLocationsCompatibility.importAudit.exactDuplicates",
      0,
      50_000
    ),
    taxonomyMappingSha256: sha256At(
      importAuditRecord.taxonomyMappingSha256,
      "mapLocationsCompatibility.importAudit.taxonomyMappingSha256"
    ),
    transformMappingSha256: sha256At(
      importAuditRecord.transformMappingSha256,
      "mapLocationsCompatibility.importAudit.transformMappingSha256"
    )
  };
  if (
    importAudit.mainIncluded !== totalLocations
    || importAudit.sourceRawExact
      !== importAudit.mainIncluded
        + importAudit.treeExcluded
        + importAudit.outOfBoundsExcluded
        + importAudit.exactDuplicates
  ) {
    fail(
      "mapLocationsCompatibility.importAudit",
      "source raw·MainMap 포함·제외·중복 count가 보존되어야 합니다."
    );
  }
  const reviewedAt = textAt(
    root.reviewedAt,
    "mapLocationsCompatibility.reviewedAt",
    32
  );
  if (
    !RFC3339_PATTERN.test(reviewedAt)
    || Number.isNaN(Date.parse(reviewedAt))
  ) {
    fail(
      "mapLocationsCompatibility.reviewedAt",
      "밀리초와 Z를 포함한 유효한 RFC3339 시각이어야 합니다."
    );
  }
  const reviewer = textAt(
    root.reviewer,
    "mapLocationsCompatibility.reviewer",
    80
  );
  if (!REVIEWER_PATTERN.test(reviewer)) {
    fail(
      "mapLocationsCompatibility.reviewer",
      "안전한 소문자 reviewer ID여야 합니다."
    );
  }
  if (root.rightsVerified !== false || root.usageBasis !== "operator_reference_use") {
    fail(
      "mapLocationsCompatibility",
      "권리 미확인 운영자 참조 사용 상태를 유지해야 합니다."
    );
  }
  const approval = {
    ...root,
    schemaVersion: 1,
    release,
    status: "operator_acknowledged",
    decision: "allow_exact_checksum_compatibility_display",
    sourceVersionVerified: false,
    compatibilityBasis: "exact_world_actor_join_and_map_geometry",
    selectedMemberCount,
    totalLocations,
    categoryCounts,
    worlds,
    importAudit,
    reviewedAt,
    reviewer,
    rightsVerified: false,
    usageBasis: "operator_reference_use"
  } as PalworldMapLocationsCompatibilityApproval;
  const { evidenceChecksum: _evidenceChecksum, ...evidence } = approval;
  const expectedEvidenceChecksum =
    palworldMapLocationsCompatibilityEvidenceChecksum(evidence);
  if (approval.evidenceChecksum !== expectedEvidenceChecksum) {
    fail(
      "mapLocationsCompatibility.evidenceChecksum",
      "승인 artifact의 결정적 evidence checksum과 일치하지 않습니다."
    );
  }
  return approval;
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
  const handle = await open(
    resolved,
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
      fail(pathName, "검증 중 파일이 변경되었습니다.");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      after.dev !== opened.dev
      || after.ino !== opened.ino
      || after.size !== opened.size
    ) {
      fail(pathName, "검증 중 파일이 변경되었습니다.");
    }
    return bytes;
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

export async function loadPalworldMapLocationsArtifact(
  releaseRoot: string
): Promise<PalworldMapLocationsArtifact> {
  const canonicalRoot = await realpath(path.resolve(releaseRoot));
  const [manifestBytes, artifactBytes] = await Promise.all([
    readCanonicalRegularFile(
      path.join(canonicalRoot, PALWORLD_MAP_LOCATIONS_MANIFEST_FILE),
      MAX_MANIFEST_BYTES,
      "mapLocationsManifest"
    ),
    readCanonicalRegularFile(
      path.join(canonicalRoot, PALWORLD_MAP_LOCATIONS_ARTIFACT_FILE),
      MAX_ARTIFACT_BYTES,
      "mapLocationsArtifact"
    )
  ]);
  const manifest = assertPalworldMapLocationsArtifactManifest(
    parseJson(manifestBytes, "mapLocationsManifest")
  );
  const artifactSha256 = sha256Bytes(artifactBytes);
  if (artifactSha256 !== manifest.artifactSha256) {
    fail(
      "mapLocationsManifest.artifactSha256",
      "실제 artifact SHA-256과 일치하지 않습니다."
    );
  }
  const artifact = assertPalworldMapLocationsArtifact(
    parseJson(artifactBytes, "mapLocationsArtifact")
  );
  if (artifact.targetGameVersion !== manifest.targetGameVersion) {
    fail(
      "mapLocationsManifest.targetGameVersion",
      "artifact targetGameVersion과 일치하지 않습니다."
    );
  }
  return artifact;
}

export async function loadPalworldMapLocationsCompatibilityAuthorization(input: {
  releaseRoot: string;
  artifact: PalworldMapLocationsArtifact;
  expectedApprovalSha256: string;
}): Promise<PalworldMapLocationsCompatibilityAuthorization> {
  const releaseRoot = await realpath(path.resolve(input.releaseRoot));
  const [approvalBytes, artifactBytes, manifestBytes] = await Promise.all([
    readCanonicalRegularFile(
      path.join(releaseRoot, PALWORLD_MAP_LOCATIONS_COMPATIBILITY_FILE),
      MAX_APPROVAL_BYTES,
      "mapLocationsCompatibility"
    ),
    readCanonicalRegularFile(
      path.join(releaseRoot, PALWORLD_MAP_LOCATIONS_ARTIFACT_FILE),
      MAX_ARTIFACT_BYTES,
      "mapLocationsArtifact"
    ),
    readCanonicalRegularFile(
      path.join(releaseRoot, PALWORLD_MAP_LOCATIONS_MANIFEST_FILE),
      MAX_MANIFEST_BYTES,
      "mapLocationsManifest"
    )
  ]);
  const approvalSha256 = sha256Bytes(approvalBytes);
  if (
    !SHA256_PATTERN.test(input.expectedApprovalSha256)
    || approvalSha256 !== input.expectedApprovalSha256
  ) {
    fail(
      "mapLocationsCompatibility",
      "active composite가 고정한 approval checksum과 일치하지 않습니다."
    );
  }
  const approval = assertPalworldMapLocationsCompatibilityApproval(
    parseJson(approvalBytes, "mapLocationsCompatibility")
  );
  const artifactSha256 = sha256Bytes(artifactBytes);
  const manifestSha256 = sha256Bytes(manifestBytes);
  if (
    approval.release !== input.artifact.targetGameVersion
    || approval.sourceArchiveSha256 !== input.artifact.source.archiveSha256
    || approval.indexMemberSha256 !== input.artifact.source.indexMemberSha256
    || approval.memberInventorySha256
      !== input.artifact.source.memberInventorySha256
    || approval.selectedMemberCount
      !== input.artifact.source.selectedMemberCount
    || approval.totalLocations !== input.artifact.totalLocations
    || input.artifact.worlds.length !== 1
    || input.artifact.worlds[0]?.world !== "main"
    || approval.importAudit.mainIncluded !== input.artifact.totalLocations
    || approval.mapLocationsArtifactSha256 !== artifactSha256
    || approval.mapLocationsManifestSha256 !== manifestSha256
  ) {
    fail(
      "mapLocationsCompatibility",
      "artifact/source/manifest exact checksum 및 count와 일치하지 않습니다."
    );
  }
  const aggregateCounts = emptyCategoryCounts();
  for (const world of input.artifact.worlds) {
    for (const category of PALWORLD_MAP_LOCATION_CATEGORIES) {
      aggregateCounts[category] += world.categoryCounts[category];
    }
  }
  for (const category of PALWORLD_MAP_LOCATION_CATEGORIES) {
    if (approval.categoryCounts[category] !== aggregateCounts[category]) {
      fail(
        `mapLocationsCompatibility.categoryCounts.${category}`,
        "artifact category count와 일치하지 않습니다."
      );
    }
  }
  const artifactWorlds = input.artifact.worlds.map((world) => ({
    world: world.world,
    targetMapAssetSha256: world.targetMapAssetSha256,
    transformRevision: world.transform.revision
  }));
  if (JSON.stringify(approval.worlds) !== JSON.stringify(artifactWorlds)) {
    fail(
      "mapLocationsCompatibility.worlds",
      "artifact world/map/transform과 exact 일치해야 합니다."
    );
  }
  const authorization = Object.freeze({
    approval,
    approvalSha256,
    artifactSha256
  });
  verifiedAuthorizations.add(authorization);
  return authorization;
}

export function createPalworldMapLocationsProvider(input: {
  artifact: PalworldMapLocationsArtifact;
  compatibilityAuthorization?: PalworldMapLocationsCompatibilityAuthorization;
}): PalworldMapLocationsProvider {
  const artifact = assertPalworldMapLocationsArtifact(input.artifact);
  if (
    artifact.activation === "candidate"
    && input.compatibilityAuthorization === undefined
  ) {
    throw new PalworldMapLocationsArtifactError(
      "artifact.activation: candidate 단독으로는 공개 API에 주입할 수 없습니다.",
      "PALWORLD_MAP_LOCATIONS_ARTIFACT_NOT_ACTIVE"
    );
  }
  if (artifact.activation === "candidate") {
    const authorization = input.compatibilityAuthorization;
    if (
      authorization === undefined
      || !verifiedAuthorizations.has(authorization)
      || authorization.artifactSha256
        !== authorization.approval.mapLocationsArtifactSha256
      || authorization.approval.sourceArchiveSha256
        !== artifact.source.archiveSha256
    ) {
      fail(
        "compatibilityAuthorization",
        "artifact exact checksum으로 검증된 authorization이어야 합니다."
      );
    }
  }
  if (
    artifact.activation === "active"
    && input.compatibilityAuthorization !== undefined
  ) {
    fail(
      "compatibilityAuthorization",
      "source metadata가 검증된 active artifact에는 compatibility approval을 사용할 수 없습니다."
    );
  }
  const worldEntries = new Map(
    artifact.worlds.map((world) => [world.world, world] as const)
  );
  const aggregateCounts = emptyCategoryCounts();
  for (const world of artifact.worlds) {
    for (const category of PALWORLD_MAP_LOCATION_CATEGORIES) {
      aggregateCounts[category] += world.categoryCounts[category];
    }
  }
  const diagnostics = Object.freeze({
    state: "ready" as const,
    total: artifact.totalLocations,
    categoryCounts: Object.freeze({ ...aggregateCounts })
  });
  return Object.freeze({
    response(world, layers, offset, limit, metadata) {
      const worldEntry = worldEntries.get(world);
      if (worldEntry === undefined) {
        return assertPalworldMapLocationsResponse({
          state: "data_unavailable",
          world,
          layers: [...layers],
          offset,
          limit,
          total: 0,
          returned: 0,
          hasMore: false,
          locations: [],
          metadata
        });
      }
      const selectedLayers = new Set(layers);
      const matching = worldEntry.locations.filter((entry) =>
        selectedLayers.has(entry.category)
      );
      const selected = matching.slice(offset, offset + limit).map((entry) => ({
        id: entry.id,
        category: entry.category,
        subtype: entry.subtype,
        normalizedX: entry.normalizedX,
        normalizedY: entry.normalizedY
      }));
      const returned = selected.length;
      const total = matching.length;
      return assertPalworldMapLocationsResponse({
        state: returned > 0 ? "ready" : "confirmed_empty",
        world,
        layers: [...layers],
        offset,
        limit,
        total,
        returned,
        hasMore: offset + returned < total,
        locations: selected,
        metadata,
        overlay: {
          schemaVersion: 1,
          technicalStatus: "ready",
          sourceType: artifact.source.sourceType,
          archiveSha256: artifact.source.archiveSha256,
          sourceMember: artifact.source.indexMember,
          sourceMemberSha256: artifact.source.indexMemberSha256,
          targetMapAssetSha256: worldEntry.targetMapAssetSha256,
          sourceGameVersion: artifact.source.sourceGameVersion,
          sourceSteamBuildId: artifact.source.sourceSteamBuildId,
          targetGameVersion: artifact.targetGameVersion,
          compatibilityBasis: "exact_world_actor_join_and_map_geometry",
          transformRevision: worldEntry.transform.revision,
          rightsVerified: false,
          usageBasis: "operator_reference_use",
          ...(input.compatibilityAuthorization === undefined
            ? { activationBasis: "source_metadata" as const }
            : {
                activationBasis: "versioned_compatibility_approval" as const,
                compatibilityApprovalSha256:
                  input.compatibilityAuthorization.approvalSha256
              })
        }
      });
    },
    diagnostics() {
      return {
        state: diagnostics.state,
        total: diagnostics.total,
        categoryCounts: { ...diagnostics.categoryCounts }
      };
    }
  });
}

export async function loadPalworldMapLocationsProvider(input: {
  releaseRoot: string;
  dashboardStaticRoot?: string;
  compatibilityApprovalSha256?: string;
}): Promise<PalworldMapLocationsProvider> {
  const artifact = await loadPalworldMapLocationsArtifact(input.releaseRoot);
  const compatibilityAuthorization = artifact.activation === "candidate"
    ? input.compatibilityApprovalSha256 === undefined
      ? undefined
      : await loadPalworldMapLocationsCompatibilityAuthorization({
          releaseRoot: input.releaseRoot,
          artifact,
          expectedApprovalSha256: input.compatibilityApprovalSha256
        })
    : undefined;
  if (
    artifact.activation === "active"
    && input.compatibilityApprovalSha256 !== undefined
  ) {
    fail(
      "compatibilityApprovalSha256",
      "active artifact에는 compatibility approval을 사용할 수 없습니다."
    );
  }
  if (input.dashboardStaticRoot !== undefined) {
    const dashboardStaticRoot = await realpath(
      path.resolve(input.dashboardStaticRoot)
    );
    for (const world of artifact.worlds) {
      const assetPath = path.join(
        dashboardStaticRoot,
        "images",
        "palworld",
        artifact.targetGameVersion,
        "maps",
        `${world.targetMapAssetSha256}.webp`
      );
      const bytes = await readCanonicalRegularFile(
        assetPath,
        MAX_MAP_ASSET_BYTES,
        `mapAsset.${world.world}`
      );
      if (
        sha256Bytes(bytes) !== world.targetMapAssetSha256
        || bytes.length < 12
        || bytes.subarray(0, 4).toString("ascii") !== "RIFF"
        || bytes.subarray(8, 12).toString("ascii") !== "WEBP"
      ) {
        fail(
          `artifact.worlds.${world.world}.targetMapAssetSha256`,
          "Dashboard에 게시된 정적 WebP 지도와 일치하지 않습니다."
        );
      }
    }
  }
  return createPalworldMapLocationsProvider({
    artifact,
    ...(compatibilityAuthorization === undefined
      ? {}
      : { compatibilityAuthorization })
  });
}
