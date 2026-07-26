import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { assertPalworldMapImageManifest } from "./palworld-map-image-manifest.js";
import { assertPalworldPaldexArtifact } from "./palworld-paldex-artifact.js";
import type { PalworldSpawnArtifact } from "./palworld-spawn-artifact.js";

export const PALWORLD_SPAWN_COMPATIBILITY_FILE =
  "map-spawns-compatibility.json";

const MAX_APPROVAL_BYTES = 64 * 1024;
const MAX_ARTIFACT_BYTES = 32 * 1024 * 1024;
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

export type PalworldSpawnCompatibilityApproval = {
  schemaVersion: 1;
  release: string;
  status: "operator_acknowledged";
  decision: "allow_exact_checksum_compatibility_display";
  sourceVersionVerified: false;
  compatibilityBasis: "exact_active_paldex_join_and_map_geometry";
  sourceArchiveSha256: string;
  sourceTables: {
    placementTable: SourceFileEvidence;
    wildSpawnerTable: SourceFileEvidence;
    palTable: SourceFileEvidence;
    distributionTable: SourceFileEvidence;
  };
  mappingsEvidence: {
    archiveSha256: string;
    member: string;
    sha256: string;
  };
  generationMappingSha256: string;
  paldexSha256: string;
  targetPaldexSteamBuildId: string;
  spawnArtifactSha256: string;
  spawnManifestSha256: string;
  mapImagesManifestSha256: string;
  targetMapAssetSha256: string;
  transformRevision: string;
  counts: {
    palCount: number;
    placementLinks: number;
    clusteredPoints: number;
    unresolvedPalOccurrences: number;
    exactJoinMismatches: 0;
  };
  reviewedAt: string;
  reviewer: string;
  evidenceChecksum: string;
  rightsVerified: false;
  usageBasis: "operator_reference_use";
};

export type PalworldSpawnCompatibilityAuthorization = Readonly<{
  approval: PalworldSpawnCompatibilityApproval;
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

function evidencePayload(
  approval: Omit<PalworldSpawnCompatibilityApproval, "evidenceChecksum">
): unknown {
  return approval;
}

export function palworldSpawnCompatibilityEvidenceChecksum(
  approval: Omit<PalworldSpawnCompatibilityApproval, "evidenceChecksum">
): string {
  return sha256Bytes(deterministicJson(evidencePayload(approval)));
}

export function createPalworldSpawnCompatibilityApproval(input: {
  previousApproval: PalworldSpawnCompatibilityApproval;
  mapImagesManifestSha256: string;
}): PalworldSpawnCompatibilityApproval {
  const previousApproval = assertPalworldSpawnCompatibilityApproval(
    input.previousApproval
  );
  const mapImagesManifestSha256 = sha256At(
    input.mapImagesManifestSha256,
    "mapImagesManifestSha256"
  );
  const {
    evidenceChecksum: _previousEvidenceChecksum,
    ...previousEvidence
  } = previousApproval;
  const evidence = {
    ...previousEvidence,
    mapImagesManifestSha256
  };
  return assertPalworldSpawnCompatibilityApproval({
    ...evidence,
    evidenceChecksum: palworldSpawnCompatibilityEvidenceChecksum(evidence)
  });
}

export function assertPalworldSpawnCompatibilityApproval(
  value: unknown
): PalworldSpawnCompatibilityApproval {
  const root = recordAt(value, "spawnCompatibility", [
    "schemaVersion",
    "release",
    "status",
    "decision",
    "sourceVersionVerified",
    "compatibilityBasis",
    "sourceArchiveSha256",
    "sourceTables",
    "mappingsEvidence",
    "generationMappingSha256",
    "paldexSha256",
    "targetPaldexSteamBuildId",
    "spawnArtifactSha256",
    "spawnManifestSha256",
    "mapImagesManifestSha256",
    "targetMapAssetSha256",
    "transformRevision",
    "counts",
    "reviewedAt",
    "reviewer",
    "evidenceChecksum",
    "rightsVerified",
    "usageBasis"
  ]);
  if (root.schemaVersion !== 1) {
    fail("spawnCompatibility.schemaVersion", "1이어야 합니다.");
  }
  const release = textAt(root.release, "spawnCompatibility.release", 64);
  if (!RELEASE_PATTERN.test(release)) {
    fail("spawnCompatibility.release", "major.minor.patch 형식이어야 합니다.");
  }
  if (
    root.status !== "operator_acknowledged"
    || root.decision !== "allow_exact_checksum_compatibility_display"
    || root.sourceVersionVerified !== false
    || root.compatibilityBasis !== "exact_active_paldex_join_and_map_geometry"
    || root.rightsVerified !== false
    || root.usageBasis !== "operator_reference_use"
  ) {
    fail(
      "spawnCompatibility",
      "source 버전 미확인·운영자 참조 사용·checksum 호환성 승인 상태를 유지해야 합니다."
    );
  }
  const sourceTablesRecord = recordAt(
    root.sourceTables,
    "spawnCompatibility.sourceTables",
    [
      "placementTable",
      "wildSpawnerTable",
      "palTable",
      "distributionTable"
    ]
  );
  const sourceTables = {
    placementTable: sourceFileEvidenceAt(
      sourceTablesRecord.placementTable,
      "spawnCompatibility.sourceTables.placementTable"
    ),
    wildSpawnerTable: sourceFileEvidenceAt(
      sourceTablesRecord.wildSpawnerTable,
      "spawnCompatibility.sourceTables.wildSpawnerTable"
    ),
    palTable: sourceFileEvidenceAt(
      sourceTablesRecord.palTable,
      "spawnCompatibility.sourceTables.palTable"
    ),
    distributionTable: sourceFileEvidenceAt(
      sourceTablesRecord.distributionTable,
      "spawnCompatibility.sourceTables.distributionTable"
    )
  };
  const mappingsRecord = recordAt(
    root.mappingsEvidence,
    "spawnCompatibility.mappingsEvidence",
    ["archiveSha256", "member", "sha256"]
  );
  const mappingsEvidence = {
    archiveSha256: sha256At(
      mappingsRecord.archiveSha256,
      "spawnCompatibility.mappingsEvidence.archiveSha256"
    ),
    member: sourceMemberAt(
      mappingsRecord.member,
      "spawnCompatibility.mappingsEvidence.member"
    ),
    sha256: sha256At(
      mappingsRecord.sha256,
      "spawnCompatibility.mappingsEvidence.sha256"
    )
  };
  const steamBuildId = textAt(
    root.targetPaldexSteamBuildId,
    "spawnCompatibility.targetPaldexSteamBuildId",
    20
  );
  if (!/^[1-9][0-9]{0,19}$/u.test(steamBuildId)) {
    fail(
      "spawnCompatibility.targetPaldexSteamBuildId",
      "0으로 시작하지 않는 20자리 이하 숫자여야 합니다."
    );
  }
  const transformRevision = textAt(
    root.transformRevision,
    "spawnCompatibility.transformRevision",
    128
  );
  const countsRecord = recordAt(root.counts, "spawnCompatibility.counts", [
    "palCount",
    "placementLinks",
    "clusteredPoints",
    "unresolvedPalOccurrences",
    "exactJoinMismatches"
  ]);
  const counts = {
    palCount: integerAt(
      countsRecord.palCount,
      "spawnCompatibility.counts.palCount",
      1,
      500
    ),
    placementLinks: integerAt(
      countsRecord.placementLinks,
      "spawnCompatibility.counts.placementLinks",
      1,
      100_000
    ),
    clusteredPoints: integerAt(
      countsRecord.clusteredPoints,
      "spawnCompatibility.counts.clusteredPoints",
      1,
      500_000
    ),
    unresolvedPalOccurrences: integerAt(
      countsRecord.unresolvedPalOccurrences,
      "spawnCompatibility.counts.unresolvedPalOccurrences",
      0,
      100_000
    ),
    exactJoinMismatches: integerAt(
      countsRecord.exactJoinMismatches,
      "spawnCompatibility.counts.exactJoinMismatches",
      0,
      0
    ) as 0
  };
  const reviewedAt = textAt(
    root.reviewedAt,
    "spawnCompatibility.reviewedAt",
    32
  );
  if (
    !RFC3339_PATTERN.test(reviewedAt)
    || Number.isNaN(Date.parse(reviewedAt))
    || new Date(reviewedAt).toISOString() !== reviewedAt
  ) {
    fail(
      "spawnCompatibility.reviewedAt",
      "밀리초와 Z를 포함한 strict RFC3339 시각이어야 합니다."
    );
  }
  const reviewer = textAt(root.reviewer, "spawnCompatibility.reviewer", 80);
  if (!REVIEWER_PATTERN.test(reviewer)) {
    fail(
      "spawnCompatibility.reviewer",
      "안전한 소문자 reviewer 식별자여야 합니다."
    );
  }
  const approval = {
    schemaVersion: 1,
    release,
    status: "operator_acknowledged",
    decision: "allow_exact_checksum_compatibility_display",
    sourceVersionVerified: false,
    compatibilityBasis: "exact_active_paldex_join_and_map_geometry",
    sourceArchiveSha256: sha256At(
      root.sourceArchiveSha256,
      "spawnCompatibility.sourceArchiveSha256"
    ),
    sourceTables,
    mappingsEvidence,
    generationMappingSha256: sha256At(
      root.generationMappingSha256,
      "spawnCompatibility.generationMappingSha256"
    ),
    paldexSha256: sha256At(
      root.paldexSha256,
      "spawnCompatibility.paldexSha256"
    ),
    targetPaldexSteamBuildId: steamBuildId,
    spawnArtifactSha256: sha256At(
      root.spawnArtifactSha256,
      "spawnCompatibility.spawnArtifactSha256"
    ),
    spawnManifestSha256: sha256At(
      root.spawnManifestSha256,
      "spawnCompatibility.spawnManifestSha256"
    ),
    mapImagesManifestSha256: sha256At(
      root.mapImagesManifestSha256,
      "spawnCompatibility.mapImagesManifestSha256"
    ),
    targetMapAssetSha256: sha256At(
      root.targetMapAssetSha256,
      "spawnCompatibility.targetMapAssetSha256"
    ),
    transformRevision,
    counts,
    reviewedAt,
    reviewer,
    evidenceChecksum: sha256At(
      root.evidenceChecksum,
      "spawnCompatibility.evidenceChecksum"
    ),
    rightsVerified: false,
    usageBasis: "operator_reference_use"
  } satisfies PalworldSpawnCompatibilityApproval;
  const { evidenceChecksum, ...withoutEvidenceChecksum } = approval;
  const expectedEvidenceChecksum =
    palworldSpawnCompatibilityEvidenceChecksum(withoutEvidenceChecksum);
  if (evidenceChecksum !== expectedEvidenceChecksum) {
    fail(
      "spawnCompatibility.evidenceChecksum",
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
  approval: PalworldSpawnCompatibilityApproval,
  artifact: PalworldSpawnArtifact
): void {
  if (
    artifact.activation !== "candidate"
    || artifact.targetGameVersion !== approval.release
    || artifact.source.sourceGameVersion !== null
    || artifact.source.sourceSteamBuildId !== null
  ) {
    fail(
      "spawnCompatibility",
      "source 버전이 없는 동일 release candidate에만 compatibility approval을 적용할 수 있습니다."
    );
  }
  if (
    artifact.source.archiveSha256 !== approval.sourceArchiveSha256
    || artifact.source.placementTableMember
      !== approval.sourceTables.placementTable.member
    || artifact.source.placementTableSha256
      !== approval.sourceTables.placementTable.sha256
    || artifact.source.wildSpawnerTableMember
      !== approval.sourceTables.wildSpawnerTable.member
    || artifact.source.wildSpawnerTableSha256
      !== approval.sourceTables.wildSpawnerTable.sha256
    || artifact.source.palTableMember !== approval.sourceTables.palTable.member
    || artifact.source.palTableSha256 !== approval.sourceTables.palTable.sha256
    || artifact.source.compatibilityBasis !== approval.compatibilityBasis
  ) {
    fail(
      "spawnCompatibility.sourceTables",
      "승인된 source archive/member checksum과 spawn artifact가 일치하지 않습니다."
    );
  }
  const worlds = artifact.worlds.filter((world) => world.world === "main");
  if (
    worlds.length !== 1
    || worlds[0]!.targetMapAssetSha256 !== approval.targetMapAssetSha256
    || worlds[0]!.transform.status !== "verified"
    || worlds[0]!.transform.revision !== approval.transformRevision
  ) {
    fail(
      "spawnCompatibility.targetMapAssetSha256",
      "승인된 MainMap asset과 verified transform이 필요합니다."
    );
  }
  const palCount = worlds[0]!.pals.length;
  const placementLinks = worlds[0]!.pals.reduce(
    (total, pal) => total + pal.totalPlacements,
    0
  );
  const clusteredPoints = worlds[0]!.pals.reduce(
    (total, pal) => total + pal.points.length,
    0
  );
  if (
    palCount !== approval.counts.palCount
    || placementLinks !== approval.counts.placementLinks
    || clusteredPoints !== approval.counts.clusteredPoints
    || approval.counts.exactJoinMismatches !== 0
  ) {
    fail(
      "spawnCompatibility.counts",
      "승인된 Pal·placement·cluster 집계와 일치하지 않습니다."
    );
  }
}

export async function loadPalworldSpawnCompatibilityAuthorization(input: {
  releaseRoot: string;
  artifact: PalworldSpawnArtifact;
  expectedApprovalSha256: string;
}): Promise<PalworldSpawnCompatibilityAuthorization> {
  const releaseRoot = path.resolve(input.releaseRoot);
  const [
    approvalBytes,
    artifactBytes,
    artifactManifestBytes,
    paldexBytes,
    mapImagesManifestBytes
  ] = await Promise.all([
    readSafeFile(
      path.join(releaseRoot, PALWORLD_SPAWN_COMPATIBILITY_FILE),
      MAX_APPROVAL_BYTES
    ),
    readSafeFile(
      path.join(releaseRoot, "map-spawns.json"),
      MAX_ARTIFACT_BYTES
    ),
    readSafeFile(
      path.join(releaseRoot, "map-spawns-manifest.json"),
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
      "spawnCompatibility.expectedApprovalSha256",
      "active composite가 고정한 소문자 64자리 SHA-256이어야 합니다."
    );
  }
  const approvalSha256 = sha256Bytes(approvalBytes);
  if (approvalSha256 !== input.expectedApprovalSha256) {
    fail(
      "spawnCompatibility.expectedApprovalSha256",
      "active composite가 고정한 approval checksum과 일치하지 않습니다."
    );
  }
  const approval = assertPalworldSpawnCompatibilityApproval(
    JSON.parse(approvalBytes.toString("utf8")) as unknown
  );
  const artifactSha256 = sha256Bytes(artifactBytes);
  if (artifactSha256 !== approval.spawnArtifactSha256) {
    fail(
      "spawnCompatibility.spawnArtifactSha256",
      "실제 spawn artifact와 일치하지 않습니다."
    );
  }
  if (sha256Bytes(artifactManifestBytes) !== approval.spawnManifestSha256) {
    fail(
      "spawnCompatibility.spawnManifestSha256",
      "실제 spawn manifest와 일치하지 않습니다."
    );
  }
  const artifactManifest = recordAt(
    JSON.parse(artifactManifestBytes.toString("utf8")) as unknown,
    "spawnManifest",
    ["schemaVersion", "targetGameVersion", "artifactFile", "artifactSha256"]
  );
  if (
    artifactManifest.schemaVersion !== 1
    || artifactManifest.targetGameVersion !== approval.release
    || artifactManifest.artifactFile !== "map-spawns.json"
    || artifactManifest.artifactSha256 !== artifactSha256
  ) {
    fail(
      "spawnManifest",
      "승인된 candidate artifact를 정확히 가리키는 manifest여야 합니다."
    );
  }
  const paldexSha256 = sha256Bytes(paldexBytes);
  if (paldexSha256 !== approval.paldexSha256) {
    fail(
      "spawnCompatibility.paldexSha256",
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
      "spawnCompatibility.targetPaldexSteamBuildId",
      "승인 대상 활성 Paldex identity와 일치하지 않습니다."
    );
  }
  if (
    sha256Bytes(mapImagesManifestBytes)
    !== approval.mapImagesManifestSha256
  ) {
    fail(
      "spawnCompatibility.mapImagesManifestSha256",
      "실제 지도 이미지 manifest와 일치하지 않습니다."
    );
  }
  const mapImages = assertPalworldMapImageManifest(
    JSON.parse(mapImagesManifestBytes.toString("utf8")) as unknown,
    approval.release
  );
  if (
    !mapImages.entries.some((entry) =>
      entry.id === "main"
      && entry.outputSha256 === approval.targetMapAssetSha256
    )
  ) {
    fail(
      "spawnCompatibility.targetMapAssetSha256",
      "승인된 MainMap asset이 지도 이미지 manifest에 없습니다."
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

export function assertPalworldSpawnCompatibilityAuthorization(
  value: PalworldSpawnCompatibilityAuthorization | undefined,
  artifact: PalworldSpawnArtifact
): PalworldSpawnCompatibilityAuthorization {
  if (
    value === undefined
    || !verifiedAuthorizations.has(value)
    || value.artifactSha256 !== sha256Bytes(deterministicJson(artifact))
  ) {
    fail(
      "spawnCompatibility",
      "검증된 versioned compatibility authorization이 필요합니다."
    );
  }
  assertArtifactRelation(value.approval, artifact);
  return value;
}
