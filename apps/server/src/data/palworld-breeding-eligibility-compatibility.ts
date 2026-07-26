import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PalworldBreedingPalParameter } from "./palworld-breeding-artifact.js";

export const PALWORLD_BREEDING_ELIGIBILITY_COMPATIBILITY_FILE =
  "breeding-eligibility-compatibility.json";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
export const PALWORLD_BREEDING_ELIGIBILITY_COMPATIBILITY_PATH = path.join(
  REPOSITORY_ROOT,
  "apps/server/src/data/palworld-mappings",
  PALWORLD_BREEDING_ELIGIBILITY_COMPATIBILITY_FILE
);

const MAX_ARTIFACT_BYTES = 64 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const INTERNAL_ID_PATTERN = /^[A-Za-z0-9_]+$/u;
const PUBLIC_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CANDIDATE_ID_PATTERN = /^candidate-[a-f0-9]{16}$/u;
const CANDIDATE_DIRECTORY_PATTERN =
  /^candidate-[a-f0-9]{16}-delta-[a-f0-9]{16}$/u;
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export type PalworldBreedingEligibilityCompatibilityArtifact = {
  schemaVersion: 1;
  release: "1.0.1";
  status: "operator_acknowledged";
  decision: "allow_exact_breeding_eligibility_overlay";
  sourceVersionVerified: false;
  compatibilityBasis: "exact_common_pal_parameter_join";
  sourceArchiveSha256: string;
  sourceTable: {
    member: "Pal/DataTable/Character/DT_PalMonsterParameter_Common.json";
    sha256: string;
  };
  candidate: {
    directory: string;
    id: string;
    breedingSha256: string;
  };
  activeInputs: {
    paldexSha256: string;
    publicIdMapSha256: string;
  };
  verification: {
    activeParameters: 287;
    candidateParameters: 288;
    commonParameters: 287;
    exactParameterMismatches: 0;
    expectedGeneralCandidates: 183;
  };
  overrides: [{
    palId: "panthalus";
    sourceInternalId: "KingWhale";
    field: "ignoreCombi";
    value: true;
    reason: string;
  }];
  reviewedAt: string;
  reviewer: string;
  evidenceChecksum: string;
  rightsVerified: false;
  usageBasis: "operator_reference_use";
};

export type PalworldBreedingEligibilityCandidate = {
  metadata: {
    candidateId: string;
  };
  provenance: {
    archiveSha256: string;
    includedFiles: Array<{
      member: string;
      sha256: string;
    }>;
  };
  parameters: Array<{
    palId: string;
    sourceRowId: string;
    sourceInternalId: string;
    combiRank: number;
    combiDuplicatePriority: number;
    ignoreCombi: boolean;
  }>;
  specialRules: Array<{
    childId: string;
  }>;
};

export type PalworldBreedingEligibilityVerification = Readonly<{
  artifact: Readonly<PalworldBreedingEligibilityCompatibilityArtifact>;
  artifactSha256: string;
  candidate: Readonly<PalworldBreedingEligibilityCandidate>;
}>;

function fail(pathName: string, message: string): never {
  throw new TypeError(`${pathName}: ${message}`);
}

function exactObject(
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
    fail(pathName, `${minimum}~${maximum} 정수여야 합니다.`);
  }
  return value;
}

function deterministicJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Bytes(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function palworldBreedingEligibilityEvidenceChecksum(
  artifact: Omit<
    PalworldBreedingEligibilityCompatibilityArtifact,
    "evidenceChecksum"
  >
): string {
  return sha256Bytes(deterministicJson(artifact));
}

export function assertPalworldBreedingEligibilityCompatibilityArtifact(
  value: unknown
): PalworldBreedingEligibilityCompatibilityArtifact {
  const root = exactObject(value, "breedingEligibilityCompatibility", [
    "schemaVersion",
    "release",
    "status",
    "decision",
    "sourceVersionVerified",
    "compatibilityBasis",
    "sourceArchiveSha256",
    "sourceTable",
    "candidate",
    "activeInputs",
    "verification",
    "overrides",
    "reviewedAt",
    "reviewer",
    "evidenceChecksum",
    "rightsVerified",
    "usageBasis"
  ]);
  if (
    root.schemaVersion !== 1
    || root.release !== "1.0.1"
    || root.status !== "operator_acknowledged"
    || root.decision !== "allow_exact_breeding_eligibility_overlay"
    || root.sourceVersionVerified !== false
    || root.compatibilityBasis !== "exact_common_pal_parameter_join"
    || root.rightsVerified !== false
    || root.usageBasis !== "operator_reference_use"
  ) {
    fail(
      "breedingEligibilityCompatibility",
      "고정 release의 source 버전 미확인·운영자 참조 호환성 승인 상태여야 합니다."
    );
  }
  const sourceArchiveSha256 = sha256At(
    root.sourceArchiveSha256,
    "breedingEligibilityCompatibility.sourceArchiveSha256"
  );
  const sourceTable = exactObject(
    root.sourceTable,
    "breedingEligibilityCompatibility.sourceTable",
    ["member", "sha256"]
  );
  if (
    sourceTable.member
    !== "Pal/DataTable/Character/DT_PalMonsterParameter_Common.json"
  ) {
    fail(
      "breedingEligibilityCompatibility.sourceTable.member",
      "고정 DT_PalMonsterParameter_Common member여야 합니다."
    );
  }
  const sourceTableSha256 = sha256At(
    sourceTable.sha256,
    "breedingEligibilityCompatibility.sourceTable.sha256"
  );
  const candidate = exactObject(
    root.candidate,
    "breedingEligibilityCompatibility.candidate",
    ["directory", "id", "breedingSha256"]
  );
  const candidateDirectory = textAt(
    candidate.directory,
    "breedingEligibilityCompatibility.candidate.directory",
    80
  );
  if (!CANDIDATE_DIRECTORY_PATTERN.test(candidateDirectory)) {
    fail(
      "breedingEligibilityCompatibility.candidate.directory",
      "고정 candidate directory 형식이어야 합니다."
    );
  }
  const candidateId = textAt(
    candidate.id,
    "breedingEligibilityCompatibility.candidate.id",
    80
  );
  if (!CANDIDATE_ID_PATTERN.test(candidateId)) {
    fail(
      "breedingEligibilityCompatibility.candidate.id",
      "고정 candidate ID 형식이어야 합니다."
    );
  }
  const candidateBreedingSha256 = sha256At(
    candidate.breedingSha256,
    "breedingEligibilityCompatibility.candidate.breedingSha256"
  );
  const activeInputs = exactObject(
    root.activeInputs,
    "breedingEligibilityCompatibility.activeInputs",
    ["paldexSha256", "publicIdMapSha256"]
  );
  const paldexSha256 = sha256At(
    activeInputs.paldexSha256,
    "breedingEligibilityCompatibility.activeInputs.paldexSha256"
  );
  const publicIdMapSha256 = sha256At(
    activeInputs.publicIdMapSha256,
    "breedingEligibilityCompatibility.activeInputs.publicIdMapSha256"
  );
  const verification = exactObject(
    root.verification,
    "breedingEligibilityCompatibility.verification",
    [
      "activeParameters",
      "candidateParameters",
      "commonParameters",
      "exactParameterMismatches",
      "expectedGeneralCandidates"
    ]
  );
  const activeParameters = integerAt(
    verification.activeParameters,
    "breedingEligibilityCompatibility.verification.activeParameters",
    1,
    10_000
  );
  const candidateParameters = integerAt(
    verification.candidateParameters,
    "breedingEligibilityCompatibility.verification.candidateParameters",
    1,
    10_000
  );
  const commonParameters = integerAt(
    verification.commonParameters,
    "breedingEligibilityCompatibility.verification.commonParameters",
    1,
    10_000
  );
  const exactParameterMismatches = integerAt(
    verification.exactParameterMismatches,
    "breedingEligibilityCompatibility.verification.exactParameterMismatches",
    0,
    10_000
  );
  const expectedGeneralCandidates = integerAt(
    verification.expectedGeneralCandidates,
    "breedingEligibilityCompatibility.verification.expectedGeneralCandidates",
    1,
    10_000
  );
  if (
    activeParameters !== 287
    || candidateParameters !== 288
    || commonParameters !== 287
    || exactParameterMismatches !== 0
    || expectedGeneralCandidates !== 183
  ) {
    fail(
      "breedingEligibilityCompatibility.verification",
      "검수된 287/288 exact parameter 및 일반 후보 183종 계약과 일치해야 합니다."
    );
  }
  if (!Array.isArray(root.overrides) || root.overrides.length !== 1) {
    fail(
      "breedingEligibilityCompatibility.overrides",
      "검수된 단일 override만 허용합니다."
    );
  }
  const override = exactObject(
    root.overrides[0],
    "breedingEligibilityCompatibility.overrides[0]",
    ["palId", "sourceInternalId", "field", "value", "reason"]
  );
  if (
    override.palId !== "panthalus"
    || override.sourceInternalId !== "KingWhale"
    || override.field !== "ignoreCombi"
    || override.value !== true
  ) {
    fail(
      "breedingEligibilityCompatibility.overrides[0]",
      "검수된 panthalus/KingWhale ignoreCombi=true만 허용합니다."
    );
  }
  const reason = textAt(
    override.reason,
    "breedingEligibilityCompatibility.overrides[0].reason",
    512
  );
  const reviewedAt = textAt(
    root.reviewedAt,
    "breedingEligibilityCompatibility.reviewedAt",
    64
  );
  if (
    !RFC3339_PATTERN.test(reviewedAt)
    || !Number.isFinite(Date.parse(reviewedAt))
  ) {
    fail(
      "breedingEligibilityCompatibility.reviewedAt",
      "밀리초를 포함한 UTC RFC3339 시각이어야 합니다."
    );
  }
  const reviewer = textAt(
    root.reviewer,
    "breedingEligibilityCompatibility.reviewer",
    80
  );
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/u.test(reviewer)) {
    fail(
      "breedingEligibilityCompatibility.reviewer",
      "안전한 운영자 식별자여야 합니다."
    );
  }
  const evidenceChecksum = sha256At(
    root.evidenceChecksum,
    "breedingEligibilityCompatibility.evidenceChecksum"
  );
  const artifactWithoutChecksum = {
    schemaVersion: 1 as const,
    release: "1.0.1" as const,
    status: "operator_acknowledged" as const,
    decision: "allow_exact_breeding_eligibility_overlay" as const,
    sourceVersionVerified: false as const,
    compatibilityBasis: "exact_common_pal_parameter_join" as const,
    sourceArchiveSha256,
    sourceTable: {
      member:
        "Pal/DataTable/Character/DT_PalMonsterParameter_Common.json" as const,
      sha256: sourceTableSha256
    },
    candidate: {
      directory: candidateDirectory,
      id: candidateId,
      breedingSha256: candidateBreedingSha256
    },
    activeInputs: {
      paldexSha256,
      publicIdMapSha256
    },
    verification: {
      activeParameters: 287 as const,
      candidateParameters: 288 as const,
      commonParameters: 287 as const,
      exactParameterMismatches: 0 as const,
      expectedGeneralCandidates: 183 as const
    },
    overrides: [{
      palId: "panthalus" as const,
      sourceInternalId: "KingWhale" as const,
      field: "ignoreCombi" as const,
      value: true as const,
      reason
    }] as [PalworldBreedingEligibilityCompatibilityArtifact["overrides"][0]],
    reviewedAt,
    reviewer,
    rightsVerified: false as const,
    usageBasis: "operator_reference_use" as const
  } satisfies Omit<
    PalworldBreedingEligibilityCompatibilityArtifact,
    "evidenceChecksum"
  >;
  if (
    evidenceChecksum
    !== palworldBreedingEligibilityEvidenceChecksum(artifactWithoutChecksum)
  ) {
    fail(
      "breedingEligibilityCompatibility.evidenceChecksum",
      "artifact evidence와 일치하지 않습니다."
    );
  }
  return {
    ...artifactWithoutChecksum,
    evidenceChecksum
  };
}

function parseCandidate(value: unknown): PalworldBreedingEligibilityCandidate {
  const root = exactObject(value, "candidateBreeding", [
    "schemaVersion",
    "candidateId",
    "release",
    "metadata",
    "provenance",
    "parameters",
    "specialRules",
    "sourceMissingSourceRows",
    "unresolvedSourceRows",
    "excludedSourceRows",
    "duplicateSourceRows",
    "computedResultCount"
  ]);
  if (root.schemaVersion !== 1) {
    fail("candidateBreeding.schemaVersion", "1이어야 합니다.");
  }
  const metadata = root.metadata;
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    fail("candidateBreeding.metadata", "객체여야 합니다.");
  }
  const candidateId = textAt(
    root.candidateId,
    "candidateBreeding.metadata.candidateId",
    80
  );
  if (
    (metadata as Record<string, unknown>).candidateId !== candidateId
    || root.release !== null
  ) {
    fail(
      "candidateBreeding.metadata",
      "candidate ID가 일치하고 미검증 release는 null이어야 합니다."
    );
  }
  if (
    root.provenance === null
    || typeof root.provenance !== "object"
    || Array.isArray(root.provenance)
  ) {
    fail("candidateBreeding.provenance", "객체여야 합니다.");
  }
  const provenanceRecord = root.provenance as Record<string, unknown>;
  const archiveSha256 = sha256At(
    provenanceRecord.archiveSha256,
    "candidateBreeding.provenance.archiveSha256"
  );
  if (
    !Array.isArray(provenanceRecord.includedFiles)
    || provenanceRecord.includedFiles.length > 20_000
  ) {
    fail(
      "candidateBreeding.provenance.includedFiles",
      "최대 20,000개 배열이어야 합니다."
    );
  }
  const includedFiles = provenanceRecord.includedFiles.map(
    (value, index) => {
      if (
        value === null
        || typeof value !== "object"
        || Array.isArray(value)
      ) {
        fail(
          `candidateBreeding.provenance.includedFiles[${index}]`,
          "객체여야 합니다."
        );
      }
      const record = value as Record<string, unknown>;
      return {
        member: textAt(
          record.member,
          `candidateBreeding.provenance.includedFiles[${index}].member`,
          512
        ),
        sha256: sha256At(
          record.sha256,
          `candidateBreeding.provenance.includedFiles[${index}].sha256`
        )
      };
    }
  );
  if (!Array.isArray(root.parameters) || root.parameters.length > 10_000) {
    fail("candidateBreeding.parameters", "최대 10,000개 배열이어야 합니다.");
  }
  const parameters = root.parameters.map((value, index) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      fail(`candidateBreeding.parameters[${index}]`, "객체여야 합니다.");
    }
    const record = value as Record<string, unknown>;
    const palId = textAt(
      record.palId,
      `candidateBreeding.parameters[${index}].palId`,
      128
    );
    if (!PUBLIC_ID_PATTERN.test(palId)) {
      fail(
        `candidateBreeding.parameters[${index}].palId`,
        "canonical public ID여야 합니다."
      );
    }
    const sourceInternalId = textAt(
      record.sourceInternalId,
      `candidateBreeding.parameters[${index}].sourceInternalId`,
      128
    );
    if (!INTERNAL_ID_PATTERN.test(sourceInternalId)) {
      fail(
        `candidateBreeding.parameters[${index}].sourceInternalId`,
        "source internal ID여야 합니다."
      );
    }
    const sourceRowId = textAt(
      record.sourceRowId,
      `candidateBreeding.parameters[${index}].sourceRowId`,
      128
    );
    if (!INTERNAL_ID_PATTERN.test(sourceRowId)) {
      fail(
        `candidateBreeding.parameters[${index}].sourceRowId`,
        "source row ID여야 합니다."
      );
    }
    if (typeof record.ignoreCombi !== "boolean") {
      fail(
        `candidateBreeding.parameters[${index}].ignoreCombi`,
        "boolean이어야 합니다."
      );
    }
    return {
      palId,
      sourceRowId,
      sourceInternalId,
      combiRank: integerAt(
        record.combiRank,
        `candidateBreeding.parameters[${index}].combiRank`,
        1,
        1_000_000
      ),
      combiDuplicatePriority: integerAt(
        record.combiDuplicatePriority,
        `candidateBreeding.parameters[${index}].combiDuplicatePriority`,
        0,
        1_000_000_000
      ),
      ignoreCombi: record.ignoreCombi
    };
  });
  if (new Set(parameters.map((entry) => entry.palId)).size !== parameters.length) {
    fail("candidateBreeding.parameters", "canonical Pal ID가 중복됩니다.");
  }
  if (!Array.isArray(root.specialRules) || root.specialRules.length > 10_000) {
    fail("candidateBreeding.specialRules", "최대 10,000개 배열이어야 합니다.");
  }
  const specialRules = root.specialRules.map((value, index) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      fail(`candidateBreeding.specialRules[${index}]`, "객체여야 합니다.");
    }
    const childId = textAt(
      (value as Record<string, unknown>).childId,
      `candidateBreeding.specialRules[${index}].childId`,
      128
    );
    if (!PUBLIC_ID_PATTERN.test(childId)) {
      fail(
        `candidateBreeding.specialRules[${index}].childId`,
        "canonical public ID여야 합니다."
      );
    }
    return { childId };
  });
  return {
    metadata: { candidateId },
    provenance: { archiveSha256, includedFiles },
    parameters,
    specialRules
  };
}

export function verifyPalworldBreedingEligibilityCompatibility(input: {
  artifact: PalworldBreedingEligibilityCompatibilityArtifact;
  artifactBytes: Uint8Array;
  candidateBytes: Uint8Array;
  activePaldexBytes: Uint8Array;
  publicIdMapBytes: Uint8Array;
  activeParameters: readonly PalworldBreedingPalParameter[];
}): PalworldBreedingEligibilityVerification {
  const artifact =
    assertPalworldBreedingEligibilityCompatibilityArtifact(input.artifact);
  if (
    sha256Bytes(input.candidateBytes)
    !== artifact.candidate.breedingSha256
  ) {
    fail("candidateBreeding", "고정 candidate breeding checksum과 다릅니다.");
  }
  if (
    sha256Bytes(input.activePaldexBytes)
    !== artifact.activeInputs.paldexSha256
  ) {
    fail("activePaldex", "승인된 active Paldex checksum과 다릅니다.");
  }
  if (
    sha256Bytes(input.publicIdMapBytes)
    !== artifact.activeInputs.publicIdMapSha256
  ) {
    fail("publicIdMap", "승인된 public ID mapping checksum과 다릅니다.");
  }
  const candidate = parseCandidate(
    JSON.parse(Buffer.from(input.candidateBytes).toString("utf8")) as unknown
  );
  if (
    candidate.metadata.candidateId !== artifact.candidate.id
    || input.activeParameters.length
      !== artifact.verification.activeParameters
    || candidate.parameters.length
      !== artifact.verification.candidateParameters
  ) {
    fail(
      "breedingEligibilityCompatibility.verification",
      "승인된 active/candidate parameter 수와 다릅니다."
    );
  }
  const sourceTableEntries = candidate.provenance.includedFiles.filter(
    (entry) => entry.member === artifact.sourceTable.member
  );
  if (
    candidate.provenance.archiveSha256 !== artifact.sourceArchiveSha256
    || sourceTableEntries.length !== 1
    || sourceTableEntries[0]?.sha256 !== artifact.sourceTable.sha256
  ) {
    fail(
      "candidateBreeding.provenance",
      "승인된 source archive와 DT_PalMonsterParameter member evidence가 다릅니다."
    );
  }
  const candidateById = new Map(
    candidate.parameters.map((parameter) => [parameter.palId, parameter])
  );
  let commonParameters = 0;
  let exactParameterMismatches = 0;
  for (const active of input.activeParameters) {
    const compared = candidateById.get(active.palId);
    if (!compared) {
      exactParameterMismatches += 1;
      continue;
    }
    commonParameters += 1;
    if (
      compared.sourceRowId !== active.sourceInternalId
      || compared.combiRank !== active.combiRank
      || compared.combiDuplicatePriority !== active.combiDuplicatePriority
    ) {
      exactParameterMismatches += 1;
    }
  }
  const candidateOnly = candidate.parameters
    .filter((entry) =>
      !input.activeParameters.some((active) => active.palId === entry.palId)
    )
    .map((entry) => entry.palId)
    .sort();
  if (
    commonParameters !== artifact.verification.commonParameters
    || exactParameterMismatches
      !== artifact.verification.exactParameterMismatches
    || candidateOnly.length !== 1
    || candidateOnly[0] !== "world-tree-dragon"
  ) {
    fail(
      "breedingEligibilityCompatibility.verification",
      "active/candidate 공통 Pal parameter exact join 계약과 다릅니다."
    );
  }
  const approved = artifact.overrides[0];
  const approvedCandidate = candidateById.get(approved.palId);
  const approvedActive = input.activeParameters.find(
    (entry) => entry.palId === approved.palId
  );
  if (
    !approvedCandidate
    || !approvedActive
    || approvedCandidate.sourceRowId !== approved.sourceInternalId
    || approvedActive.sourceInternalId !== approved.sourceInternalId
    || approvedCandidate.ignoreCombi !== true
  ) {
    fail(
      "breedingEligibilityCompatibility.overrides[0]",
      "승인된 candidate의 panthalus ignoreCombi evidence와 다릅니다."
    );
  }
  const specialChildren = new Set(
    candidate.specialRules.map((rule) => rule.childId)
  );
  const generalCandidates = candidate.parameters.filter((parameter) =>
    parameter.palId !== "world-tree-dragon"
    && !specialChildren.has(parameter.palId)
    && parameter.ignoreCombi !== true
  ).length;
  if (
    generalCandidates
    !== artifact.verification.expectedGeneralCandidates
  ) {
    fail(
      "breedingEligibilityCompatibility.verification.expectedGeneralCandidates",
      "고정 candidate의 일반 교배 후보 수와 다릅니다."
    );
  }
  return Object.freeze({
    artifact: Object.freeze(artifact),
    artifactSha256: sha256Bytes(input.artifactBytes),
    candidate: Object.freeze(candidate)
  });
}

export async function loadPalworldBreedingEligibilityCompatibility(): Promise<{
  artifact: PalworldBreedingEligibilityCompatibilityArtifact;
  bytes: Buffer;
}> {
  const resolved = path.resolve(
    PALWORLD_BREEDING_ELIGIBILITY_COMPATIBILITY_PATH
  );
  const info = await lstat(resolved);
  if (
    info.isSymbolicLink()
    || !info.isFile()
    || info.size < 1
    || info.size > MAX_ARTIFACT_BYTES
    || await realpath(resolved) !== resolved
  ) {
    fail(
      "breedingEligibilityCompatibility",
      "안전한 크기의 canonical regular file이어야 합니다."
    );
  }
  const bytes = await readFile(resolved);
  return {
    artifact: assertPalworldBreedingEligibilityCompatibilityArtifact(
      JSON.parse(bytes.toString("utf8")) as unknown
    ),
    bytes
  };
}
