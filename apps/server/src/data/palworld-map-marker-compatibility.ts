import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { assertPalworldMapImageManifest } from "./palworld-map-image-manifest.js";
import {
  assertPalworldMapMarkerArtifactManifest,
  PALWORLD_MAP_MARKER_ARTIFACT_FILE,
  PALWORLD_MAP_MARKER_MANIFEST_FILE,
  type PalworldMapCoordinateTransform,
  type PalworldMapMarkerArtifact
} from "./palworld-map-marker-artifact.js";
import { assertPalworldPaldexArtifact } from "./palworld-paldex-artifact.js";

export const PALWORLD_MAP_MARKER_COMPATIBILITY_FILE =
  "map-markers-compatibility.json";

const MAX_APPROVAL_BYTES = 64 * 1024;
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 512 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RELEASE_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const SOURCE_MEMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/u;
const REVIEWER_PATTERN = /^[a-z0-9][a-z0-9._-]{2,79}$/u;
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

type SourceFileEvidence = {
  member: string;
  sha256: string;
};

export type PalworldMapMarkerCompatibilityApproval = {
  schemaVersion: 2;
  release: string;
  status: "operator_acknowledged";
  decision: "allow_exact_checksum_compatibility_display";
  sourceVersionVerified: false;
  compatibilityBasis: "exact_map_geometry_and_coordinate_transform";
  sourceArchiveSha256: string;
  sourceTables: {
    bossTable: SourceFileEvidence;
    worldMapTable: SourceFileEvidence;
  };
  sourceMapAsset: SourceFileEvidence;
  sourceTreeMapAsset: SourceFileEvidence;
  mappingsEvidence: {
    archiveSha256: string;
    member: string;
    sha256: string;
  };
  generationMappingSha256: string;
  paldexSha256: string;
  targetPaldexSteamBuildId: string;
  markerArtifactSha256: string;
  markerManifestSha256: string;
  mapImagesManifestSha256: string;
  targetMapAssetSha256: string;
  targetTreeMapAssetSha256: string;
  transformRevision: string;
  transformSha256: string;
  treeTransformRevision: string;
  treeTransformSha256: string;
  counts: {
    sourceRows: number;
    nonPalRows: number;
    mainMarkers: number;
    treeMarkers: number;
    exactJoinMismatches: 0;
  };
  reviewedAt: string;
  reviewer: string;
  evidenceChecksum: string;
  rightsVerified: false;
  usageBasis: "operator_reference_use";
};

export type PalworldMapMarkerCompatibilityAuthorization = Readonly<{
  approval: PalworldMapMarkerCompatibilityApproval;
  approvalSha256: string;
  artifactSha256: string;
}>;

const verifiedAuthorizations = new WeakSet<object>();

function fail(pathName: string, message: string): never {
  throw new TypeError(`${pathName}: ${message}`);
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
    if (!allowed.has(key)) {
      fail(`${pathName}.${key}`, "허용되지 않은 필드입니다.");
    }
  }
  for (const key of requiredKeys) {
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
    fail(pathName, `앞뒤 공백과 제어문자가 없는 ${maximum}자 이하 문자열이어야 합니다.`);
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

function sourceMemberAt(value: unknown, pathName: string): string {
  const member = textAt(value, pathName, 512);
  if (
    !SOURCE_MEMBER_PATTERN.test(member)
    || member.startsWith("/")
    || member.includes("\\")
    || member.includes("%")
    || member.includes("//")
    || member.split("/").some((segment) =>
      segment.length === 0 || segment === "." || segment === ".."
    )
  ) {
    fail(pathName, "안전한 archive 상대 경로여야 합니다.");
  }
  return member;
}

function sourceFileEvidenceAt(
  value: unknown,
  pathName: string
): SourceFileEvidence {
  const record = recordAt(value, pathName, ["member", "sha256"]);
  return {
    member: sourceMemberAt(record.member, `${pathName}.member`),
    sha256: sha256At(record.sha256, `${pathName}.sha256`)
  };
}

function deterministicJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Bytes(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function palworldMapMarkerTransformChecksum(
  transform: PalworldMapCoordinateTransform
): string {
  return sha256Bytes(deterministicJson(transform));
}

export function palworldMapMarkerCompatibilityEvidenceChecksum(
  approval: Omit<PalworldMapMarkerCompatibilityApproval, "evidenceChecksum">
): string {
  return sha256Bytes(deterministicJson(approval));
}

export function assertPalworldMapMarkerCompatibilityApproval(
  value: unknown
): PalworldMapMarkerCompatibilityApproval {
  const root = recordAt(value, "mapMarkerCompatibility", [
    "schemaVersion",
    "release",
    "status",
    "decision",
    "sourceVersionVerified",
    "compatibilityBasis",
    "sourceArchiveSha256",
    "sourceTables",
    "sourceMapAsset",
    "sourceTreeMapAsset",
    "mappingsEvidence",
    "generationMappingSha256",
    "paldexSha256",
    "targetPaldexSteamBuildId",
    "markerArtifactSha256",
    "markerManifestSha256",
    "mapImagesManifestSha256",
    "targetMapAssetSha256",
    "targetTreeMapAssetSha256",
    "transformRevision",
    "transformSha256",
    "treeTransformRevision",
    "treeTransformSha256",
    "counts",
    "reviewedAt",
    "reviewer",
    "evidenceChecksum",
    "rightsVerified",
    "usageBasis"
  ]);
  if (root.schemaVersion !== 2) {
    fail("mapMarkerCompatibility.schemaVersion", "2여야 합니다.");
  }
  const release = textAt(root.release, "mapMarkerCompatibility.release", 64);
  if (!RELEASE_PATTERN.test(release)) {
    fail("mapMarkerCompatibility.release", "major.minor.patch 형식이어야 합니다.");
  }
  if (
    root.status !== "operator_acknowledged"
    || root.decision !== "allow_exact_checksum_compatibility_display"
    || root.sourceVersionVerified !== false
    || root.compatibilityBasis !== "exact_map_geometry_and_coordinate_transform"
    || root.rightsVerified !== false
    || root.usageBasis !== "operator_reference_use"
  ) {
    fail(
      "mapMarkerCompatibility",
      "source 버전 미확인·운영자 참조 사용·checksum 호환성 승인 상태를 유지해야 합니다."
    );
  }
  const sourceTablesRecord = recordAt(
    root.sourceTables,
    "mapMarkerCompatibility.sourceTables",
    ["bossTable", "worldMapTable"]
  );
  const sourceTables = {
    bossTable: sourceFileEvidenceAt(
      sourceTablesRecord.bossTable,
      "mapMarkerCompatibility.sourceTables.bossTable"
    ),
    worldMapTable: sourceFileEvidenceAt(
      sourceTablesRecord.worldMapTable,
      "mapMarkerCompatibility.sourceTables.worldMapTable"
    )
  };
  const sourceMapAsset = sourceFileEvidenceAt(
    root.sourceMapAsset,
    "mapMarkerCompatibility.sourceMapAsset"
  );
  const sourceTreeMapAsset = sourceFileEvidenceAt(
    root.sourceTreeMapAsset,
    "mapMarkerCompatibility.sourceTreeMapAsset"
  );
  const mappingsRecord = recordAt(
    root.mappingsEvidence,
    "mapMarkerCompatibility.mappingsEvidence",
    ["archiveSha256", "member", "sha256"]
  );
  const mappingsEvidence = {
    archiveSha256: sha256At(
      mappingsRecord.archiveSha256,
      "mapMarkerCompatibility.mappingsEvidence.archiveSha256"
    ),
    member: sourceMemberAt(
      mappingsRecord.member,
      "mapMarkerCompatibility.mappingsEvidence.member"
    ),
    sha256: sha256At(
      mappingsRecord.sha256,
      "mapMarkerCompatibility.mappingsEvidence.sha256"
    )
  };
  const steamBuildId = textAt(
    root.targetPaldexSteamBuildId,
    "mapMarkerCompatibility.targetPaldexSteamBuildId",
    20
  );
  if (!/^[1-9][0-9]{0,19}$/u.test(steamBuildId)) {
    fail(
      "mapMarkerCompatibility.targetPaldexSteamBuildId",
      "0으로 시작하지 않는 20자리 이하 숫자여야 합니다."
    );
  }
  const transformRevision = textAt(
    root.transformRevision,
    "mapMarkerCompatibility.transformRevision",
    128
  );
  const treeTransformRevision = textAt(
    root.treeTransformRevision,
    "mapMarkerCompatibility.treeTransformRevision",
    128
  );
  const countsRecord = recordAt(
    root.counts,
    "mapMarkerCompatibility.counts",
    [
      "sourceRows",
      "nonPalRows",
      "mainMarkers",
      "treeMarkers",
      "exactJoinMismatches"
    ]
  );
  const counts = {
    sourceRows: integerAt(
      countsRecord.sourceRows,
      "mapMarkerCompatibility.counts.sourceRows",
      1,
      10_000
    ),
    nonPalRows: integerAt(
      countsRecord.nonPalRows,
      "mapMarkerCompatibility.counts.nonPalRows",
      0,
      10_000
    ),
    mainMarkers: integerAt(
      countsRecord.mainMarkers,
      "mapMarkerCompatibility.counts.mainMarkers",
      1,
      500
    ),
    treeMarkers: integerAt(
      countsRecord.treeMarkers,
      "mapMarkerCompatibility.counts.treeMarkers",
      0,
      500
    ),
    exactJoinMismatches: integerAt(
      countsRecord.exactJoinMismatches,
      "mapMarkerCompatibility.counts.exactJoinMismatches",
      0,
      0
    ) as 0
  };
  if (
    counts.sourceRows
    !== counts.nonPalRows + counts.mainMarkers + counts.treeMarkers
  ) {
    fail(
      "mapMarkerCompatibility.counts",
      "source row 수는 non-Pal·MainMap·Tree marker 집계와 정확히 일치해야 합니다."
    );
  }
  const reviewedAt = textAt(
    root.reviewedAt,
    "mapMarkerCompatibility.reviewedAt",
    32
  );
  if (
    !RFC3339_PATTERN.test(reviewedAt)
    || Number.isNaN(Date.parse(reviewedAt))
    || new Date(reviewedAt).toISOString() !== reviewedAt
  ) {
    fail(
      "mapMarkerCompatibility.reviewedAt",
      "밀리초와 Z를 포함한 strict RFC3339 시각이어야 합니다."
    );
  }
  const reviewer = textAt(
    root.reviewer,
    "mapMarkerCompatibility.reviewer",
    80
  );
  if (!REVIEWER_PATTERN.test(reviewer)) {
    fail(
      "mapMarkerCompatibility.reviewer",
      "안전한 소문자 reviewer 식별자여야 합니다."
    );
  }
  const approval = {
    schemaVersion: 2,
    release,
    status: "operator_acknowledged",
    decision: "allow_exact_checksum_compatibility_display",
    sourceVersionVerified: false,
    compatibilityBasis: "exact_map_geometry_and_coordinate_transform",
    sourceArchiveSha256: sha256At(
      root.sourceArchiveSha256,
      "mapMarkerCompatibility.sourceArchiveSha256"
    ),
    sourceTables,
    sourceMapAsset,
    sourceTreeMapAsset,
    mappingsEvidence,
    generationMappingSha256: sha256At(
      root.generationMappingSha256,
      "mapMarkerCompatibility.generationMappingSha256"
    ),
    paldexSha256: sha256At(
      root.paldexSha256,
      "mapMarkerCompatibility.paldexSha256"
    ),
    targetPaldexSteamBuildId: steamBuildId,
    markerArtifactSha256: sha256At(
      root.markerArtifactSha256,
      "mapMarkerCompatibility.markerArtifactSha256"
    ),
    markerManifestSha256: sha256At(
      root.markerManifestSha256,
      "mapMarkerCompatibility.markerManifestSha256"
    ),
    mapImagesManifestSha256: sha256At(
      root.mapImagesManifestSha256,
      "mapMarkerCompatibility.mapImagesManifestSha256"
    ),
    targetMapAssetSha256: sha256At(
      root.targetMapAssetSha256,
      "mapMarkerCompatibility.targetMapAssetSha256"
    ),
    targetTreeMapAssetSha256: sha256At(
      root.targetTreeMapAssetSha256,
      "mapMarkerCompatibility.targetTreeMapAssetSha256"
    ),
    transformRevision,
    transformSha256: sha256At(
      root.transformSha256,
      "mapMarkerCompatibility.transformSha256"
    ),
    treeTransformRevision,
    treeTransformSha256: sha256At(
      root.treeTransformSha256,
      "mapMarkerCompatibility.treeTransformSha256"
    ),
    counts,
    reviewedAt,
    reviewer,
    evidenceChecksum: sha256At(
      root.evidenceChecksum,
      "mapMarkerCompatibility.evidenceChecksum"
    ),
    rightsVerified: false,
    usageBasis: "operator_reference_use"
  } satisfies PalworldMapMarkerCompatibilityApproval;
  const { evidenceChecksum, ...withoutEvidenceChecksum } = approval;
  const expectedEvidenceChecksum =
    palworldMapMarkerCompatibilityEvidenceChecksum(withoutEvidenceChecksum);
  if (evidenceChecksum !== expectedEvidenceChecksum) {
    fail(
      "mapMarkerCompatibility.evidenceChecksum",
      "고정된 compatibility evidence와 일치하지 않습니다."
    );
  }
  return approval;
}

async function readSafeFile(
  filePath: string,
  maximumBytes: number
): Promise<Buffer> {
  const resolved = path.resolve(filePath);
  const before = await lstat(resolved);
  if (
    before.isSymbolicLink()
    || !before.isFile()
    || before.size < 1
    || before.size > maximumBytes
  ) {
    fail(filePath, "symlink가 아닌 안전한 크기의 regular file이어야 합니다.");
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
      fail(filePath, "검증 중 파일이 변경되었습니다.");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      !after.isFile()
      || after.dev !== opened.dev
      || after.ino !== opened.ino
      || after.size !== opened.size
    ) {
      fail(filePath, "검증 중 파일이 변경되었습니다.");
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

function assertArtifactRelation(
  approval: PalworldMapMarkerCompatibilityApproval,
  artifact: PalworldMapMarkerArtifact
): void {
  if (
    artifact.activation !== "candidate"
    || artifact.targetGameVersion !== approval.release
    || artifact.source.sourceGameVersion !== null
    || artifact.source.sourceSteamBuildId !== null
  ) {
    fail(
      "mapMarkerCompatibility",
      "source 버전이 없는 동일 release candidate에만 compatibility approval을 적용할 수 있습니다."
    );
  }
  if (
    artifact.source.archiveSha256 !== approval.sourceArchiveSha256
    || artifact.source.sourceMember !== approval.sourceTables.bossTable.member
    || artifact.source.sourceMemberSha256
      !== approval.sourceTables.bossTable.sha256
    || artifact.source.rightsVerified !== false
    || artifact.source.usageBasis !== approval.usageBasis
  ) {
    fail(
      "mapMarkerCompatibility.sourceTables",
      "승인된 source archive와 boss table checksum이 marker artifact와 일치하지 않습니다."
    );
  }
  const mainWorlds = artifact.worlds.filter((world) => world.world === "main");
  const treeWorlds = artifact.worlds.filter((world) => world.world === "tree");
  if (
    artifact.worlds.length !== 2
    || mainWorlds.length !== 1
    || treeWorlds.length !== 1
    || mainWorlds[0]!.targetMapAssetSha256
      !== approval.targetMapAssetSha256
    || treeWorlds[0]!.targetMapAssetSha256
      !== approval.targetTreeMapAssetSha256
    || mainWorlds[0]!.transform.status !== "verified"
    || treeWorlds[0]!.transform.status !== "verified"
    || mainWorlds[0]!.transform.revision !== approval.transformRevision
    || treeWorlds[0]!.transform.revision
      !== approval.treeTransformRevision
    || palworldMapMarkerTransformChecksum(mainWorlds[0]!.transform)
      !== approval.transformSha256
    || palworldMapMarkerTransformChecksum(treeWorlds[0]!.transform)
      !== approval.treeTransformSha256
  ) {
    fail(
      "mapMarkerCompatibility.targetMapAssetSha256",
      "승인된 MainMap·Tree asset과 exact verified transform이 필요합니다."
    );
  }
  if (
    mainWorlds[0]!.markers.length !== approval.counts.mainMarkers
    || treeWorlds[0]!.markers.length !== approval.counts.treeMarkers
    || approval.counts.exactJoinMismatches !== 0
  ) {
    fail(
      "mapMarkerCompatibility.counts",
      "승인된 source·non-Pal·MainMap·Tree marker 집계와 일치하지 않습니다."
    );
  }
}

export async function loadPalworldMapMarkerCompatibilityAuthorization(input: {
  releaseRoot: string;
  artifact: PalworldMapMarkerArtifact;
  expectedApprovalSha256: string;
}): Promise<PalworldMapMarkerCompatibilityAuthorization> {
  const releaseRoot = path.resolve(input.releaseRoot);
  const [
    approvalBytes,
    artifactBytes,
    artifactManifestBytes,
    paldexBytes,
    mapImagesManifestBytes
  ] = await Promise.all([
    readSafeFile(
      path.join(releaseRoot, PALWORLD_MAP_MARKER_COMPATIBILITY_FILE),
      MAX_APPROVAL_BYTES
    ),
    readSafeFile(
      path.join(releaseRoot, PALWORLD_MAP_MARKER_ARTIFACT_FILE),
      MAX_ARTIFACT_BYTES
    ),
    readSafeFile(
      path.join(releaseRoot, PALWORLD_MAP_MARKER_MANIFEST_FILE),
      MAX_MANIFEST_BYTES
    ),
    readSafeFile(path.join(releaseRoot, "paldex.json"), MAX_ARTIFACT_BYTES),
    readSafeFile(
      path.join(releaseRoot, "map-images-manifest.json"),
      MAX_MANIFEST_BYTES
    )
  ]);
  if (!SHA256_PATTERN.test(input.expectedApprovalSha256)) {
    fail(
      "mapMarkerCompatibility.expectedApprovalSha256",
      "active composite가 고정한 소문자 64자리 SHA-256이어야 합니다."
    );
  }
  const approvalSha256 = sha256Bytes(approvalBytes);
  if (approvalSha256 !== input.expectedApprovalSha256) {
    fail(
      "mapMarkerCompatibility.expectedApprovalSha256",
      "active composite가 고정한 approval checksum과 일치하지 않습니다."
    );
  }
  const approval = assertPalworldMapMarkerCompatibilityApproval(
    JSON.parse(approvalBytes.toString("utf8")) as unknown
  );
  const artifactSha256 = sha256Bytes(artifactBytes);
  if (artifactSha256 !== approval.markerArtifactSha256) {
    fail(
      "mapMarkerCompatibility.markerArtifactSha256",
      "실제 marker artifact와 일치하지 않습니다."
    );
  }
  if (sha256Bytes(artifactManifestBytes) !== approval.markerManifestSha256) {
    fail(
      "mapMarkerCompatibility.markerManifestSha256",
      "실제 marker manifest와 일치하지 않습니다."
    );
  }
  const artifactManifest = assertPalworldMapMarkerArtifactManifest(
    JSON.parse(artifactManifestBytes.toString("utf8")) as unknown
  );
  if (
    artifactManifest.targetGameVersion !== approval.release
    || artifactManifest.artifactFile !== PALWORLD_MAP_MARKER_ARTIFACT_FILE
    || artifactManifest.artifactSha256 !== artifactSha256
  ) {
    fail(
      "mapMarkerManifest",
      "승인된 candidate artifact를 정확히 가리키는 manifest여야 합니다."
    );
  }
  const paldexSha256 = sha256Bytes(paldexBytes);
  if (paldexSha256 !== approval.paldexSha256) {
    fail(
      "mapMarkerCompatibility.paldexSha256",
      "실제 활성 Paldex와 일치하지 않습니다."
    );
  }
  const paldex = assertPalworldPaldexArtifact(
    JSON.parse(paldexBytes.toString("utf8")) as unknown
  );
  if (
    paldex.release !== approval.release
    || paldex.steamBuildId !== approval.targetPaldexSteamBuildId
  ) {
    fail(
      "mapMarkerCompatibility.targetPaldexSteamBuildId",
      "승인 대상 활성 Paldex identity와 일치하지 않습니다."
    );
  }
  if (
    sha256Bytes(mapImagesManifestBytes)
    !== approval.mapImagesManifestSha256
  ) {
    fail(
      "mapMarkerCompatibility.mapImagesManifestSha256",
      "실제 지도 이미지 manifest와 일치하지 않습니다."
    );
  }
  const mapImages = assertPalworldMapImageManifest(
    JSON.parse(mapImagesManifestBytes.toString("utf8")) as unknown,
    approval.release
  );
  if (
    mapImages.sourceArchiveSha256 !== approval.sourceArchiveSha256
    || !mapImages.entries.some((entry) =>
      entry.id === "main"
      && entry.sourceMember === approval.sourceMapAsset.member
      && entry.sourceSha256 === approval.sourceMapAsset.sha256
      && entry.outputSha256 === approval.targetMapAssetSha256
    )
    || !mapImages.entries.some((entry) =>
      entry.id === "tree"
      && entry.sourceMember === approval.sourceTreeMapAsset.member
      && entry.sourceSha256 === approval.sourceTreeMapAsset.sha256
      && entry.outputSha256 === approval.targetTreeMapAssetSha256
    )
  ) {
    fail(
      "mapMarkerCompatibility.targetMapAssetSha256",
      "승인된 source와 output MainMap·Tree asset이 지도 이미지 manifest에 없습니다."
    );
  }
  assertArtifactRelation(approval, input.artifact);
  const authorization = Object.freeze({
    approval,
    approvalSha256,
    artifactSha256
  });
  verifiedAuthorizations.add(authorization);
  return authorization;
}

export function assertPalworldMapMarkerCompatibilityAuthorization(
  value: PalworldMapMarkerCompatibilityAuthorization | undefined,
  artifact: PalworldMapMarkerArtifact
): PalworldMapMarkerCompatibilityAuthorization {
  if (
    value === undefined
    || !verifiedAuthorizations.has(value)
    || value.artifactSha256 !== sha256Bytes(deterministicJson(artifact))
  ) {
    fail(
      "mapMarkerCompatibility",
      "검증된 versioned compatibility authorization이 필요합니다."
    );
  }
  assertArtifactRelation(value.approval, artifact);
  return value;
}
