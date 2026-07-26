import { createHash } from "node:crypto";
import { lstat, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  assertPalworldPakCandidateArtifact,
  assertPalworldTranslationSnapshot,
  validatePalworldPassiveEffect,
  type PalworldPassiveEffect,
  type PalworldTranslationField,
  type PalworldTranslationFieldValue,
  type PalworldTranslationLocale,
  type PalworldTranslationOfficialSourceField,
  type PalworldTranslationRecord,
  type PalworldTranslationRecordKind,
  type PalworldTranslationSnapshot,
  type PalworldTranslationSourceRecord,
} from "@streamops/shared";
import {
  assertPalworldCatalogArtifact,
  type PalworldCatalogArtifact,
} from "./palworld-catalog-artifact.js";
import {
  assertPalworldPaldexArtifact,
  type PalworldPaldexArtifact,
} from "./palworld-paldex-artifact.js";
import { assertPalworldPakBlockedCandidateManifest } from "./palworld-pak-runtime-manifest.js";
import {
  palworldTranslationLocalizedValueFor,
  palworldTranslationOfficialLocaleValue,
  palworldTranslationSourceIdentityJoinRule,
  type PalworldTranslationActiveEntity,
  type PalworldTranslationCandidateEntity,
  type PalworldTranslationCandidateLocaleRecord,
  type PalworldTranslationLocalizedCandidateValue,
  type PalworldTranslationReviewJsonRecord,
  type PalworldTranslationSourceIdentityJoinRule,
} from "./palworld-translation-review.js";

const OVERLAY_SCHEMA_VERSION = 1 as const;
const OVERLAY_STATUS = "translation_compatibility_only" as const;
const OVERLAY_SCOPE = "official_locale_exact_join" as const;
const JOIN_RULE = "canonical_id_source_internal_id_message_key_exact" as const;
const PARTNER_JOIN_RULE =
  "partner_pal_id_source_internal_id_message_key_exact" as const;
const ACTIVE_SKILL_JOIN_RULE =
  "legacy_active_pal_level_assignment_exact" as const;
const PASSIVE_SKILL_JOIN_RULE =
  "legacy_passive_public_id_prefix_exact" as const;
const ACTIVE_SKILL_MAPPING_JOIN_RULE = "pal_id_unlock_level_exact" as const;
const ACTIVE_SKILL_EVIDENCE_STATUS = "translation_compatibility_only" as const;
const PASSIVE_SKILL_EVIDENCE_STATUS = "translation_compatibility_only" as const;
const PASSIVE_SKILL_MAPPING_JOIN_RULE =
  "passive_source_row_public_id_prefix_exact" as const;
const MAX_JSON_BYTES = 64 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,191}$/u;
const SAFE_MESSAGE_KEY_PATTERN = /^[A-Za-z0-9_]+$/u;
const SAFE_REVIEWER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/u;
const STRICT_RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const LOCALES = ["ko", "ja"] as const;
const KINDS = ["pal", "item", "skill"] as const;
const FIELDS = ["name", "description", "passiveAbility"] as const;

type JsonRecord = Record<string, unknown>;
type OfficialJoinRule =
  | typeof JOIN_RULE
  | typeof PARTNER_JOIN_RULE
  | typeof ACTIVE_SKILL_JOIN_RULE
  | typeof PASSIVE_SKILL_JOIN_RULE;
type OfficialSourceIdentityJoinRule =
  | PalworldTranslationSourceIdentityJoinRule
  | "assignment_identity_exact"
  | "legacy_public_id_prefix_exact";

export type PalworldOfficialLocaleSourceField = {
  locale: PalworldTranslationLocale;
  kind: PalworldTranslationRecordKind;
  id: string;
  field: PalworldTranslationField;
  activeSourceInternalId: string;
  candidateCanonicalId: string;
  candidateSourceInternalId: string;
  sourceIdentityJoinRule: OfficialSourceIdentityJoinRule;
  joinRule: OfficialJoinRule;
  messageKey: string;
  text: string;
  textSha256: string;
  status: "source_provided";
  richTextStatus: "resolved";
  sourceMember: string;
  sourceMemberSha256: string;
};

export type PalworldOfficialLocaleSourceFieldsArtifact = {
  schemaVersion: 1;
  release: string;
  status: typeof OVERLAY_STATUS;
  scope: typeof OVERLAY_SCOPE;
  candidateId: string;
  sourceCatalogSha256: string;
  sourcePaldexSha256: string;
  candidateLocaleSha256: Record<PalworldTranslationLocale, string>;
  records: PalworldOfficialLocaleSourceField[];
  counts: {
    total: number;
    byLocale: Record<PalworldTranslationLocale, number>;
    byKind: Record<PalworldTranslationRecordKind, number>;
    byField: Record<PalworldTranslationField, number>;
  };
};

export type PalworldOfficialLocaleCompatibilityArtifact = {
  schemaVersion: 1;
  release: string;
  status: typeof OVERLAY_STATUS;
  scope: typeof OVERLAY_SCOPE;
  reviewedAt: string;
  reviewer: string;
  evidenceChecksum: string;
  usageBasis: "operator_reference_use";
  rightsVerified: false;
  candidateRuntimeActivationGranted: false;
  fuzzyMatchingUsed: false;
  inputs: {
    active: {
      catalogSha256: string;
      paldexSha256: string;
      corpusSha256: string;
      localeSha256: Record<PalworldTranslationLocale, string>;
      glossarySha256: string;
      sourceRevision: string;
      translationRevision: string;
    };
    candidate: {
      candidateId: string;
      activationEligible: false;
      activationBlockers: string[];
      artifactSha256: {
        runtimeManifest: string;
        importReport: string;
        sourceLock: string;
        paldex: string;
        items: string;
        skills: string;
        localeKo: string;
        localeJa: string;
      };
      sourceArchives: Array<{
        role: "primary" | "asset_overlay";
        sha256: string;
        bytes: number;
      }>;
      archive: {
        sha256: string;
        bytes: number;
        fileCount: number;
      };
      mappings: Record<string, string>;
      activeSkillLocaleMapSha256?: string;
      passiveSkillLocaleMapSha256?: string;
    };
  };
  outputs: {
    officialSourceFieldsSha256: string;
    activeSkillEvidenceSha256?: string;
    passiveSkillEvidenceSha256?: string;
    localeSha256: Record<PalworldTranslationLocale, string>;
    manifestSha256: string;
    translationRevision: string;
  };
  counts: {
    officialExactResolved: Record<PalworldTranslationLocale, number>;
    officialUnresolved: Record<PalworldTranslationLocale, number>;
    officialUnjoined: Record<PalworldTranslationLocale, number>;
    humanReviewedPreserved: Record<PalworldTranslationLocale, number>;
    humanReviewedSuperseded: Record<PalworldTranslationLocale, number>;
    machineAssistedExcluded: Record<PalworldTranslationLocale, number>;
    sourceProvidedExcluded: Record<PalworldTranslationLocale, number>;
    outputRecords: Record<PalworldTranslationLocale, number>;
  };
};

export type PalworldLegacyActiveSkillLocaleMap = {
  schemaVersion: 1;
  activeRelease: string;
  candidateId: string;
  joinRule: typeof ACTIVE_SKILL_MAPPING_JOIN_RULE;
  activeCatalogSha256: string;
  candidateSkillsSha256: string;
  candidateImportReportSha256: string;
  sourceArchiveSha256: string;
  reviewedExceptions: Array<{
    legacySkillId: string;
    candidateSkillId: string;
    field: "power";
    activeValue: number;
    candidateValue: number;
    reason: string;
    reviewStatus: "approved";
  }>;
};

export type PalworldLegacyPassiveSkillLocaleMap = {
  schemaVersion: 1;
  activeRelease: string;
  candidateId: string;
  joinRule: typeof PASSIVE_SKILL_MAPPING_JOIN_RULE;
  activeCatalogSha256: string;
  candidateSkillsSha256: string;
  candidateImportReportSha256: string;
  sourceArchiveSha256: string;
  entries: Array<{
    legacySkillId: string;
    candidateSkillId: string;
    candidateSourceRowId: string;
    reason: string;
    reviewStatus: "approved";
  }>;
};

export type PalworldActiveSkillLocaleEvidence = {
  schemaVersion: 1;
  release: string;
  status: typeof ACTIVE_SKILL_EVIDENCE_STATUS;
  candidateId: string;
  joinRule: typeof ACTIVE_SKILL_MAPPING_JOIN_RULE;
  inputs: {
    activeCatalogSha256: string;
    candidateSkillsSha256: string;
    candidateImportReportSha256: string;
    sourceArchiveSha256: string;
    mappingSha256: string;
  };
  counts: {
    activeSkills: number;
    assignmentEvidence: number;
    singleTargetSkills: number;
    multiTargetSkills: number;
    reviewedExceptions: number;
  };
  reviewedExceptions: PalworldLegacyActiveSkillLocaleMap["reviewedExceptions"];
  entries: Array<{
    legacySkillId: string;
    candidateSkillIds: string[];
    guard: "exact_stats" | "reviewed_exception";
    legacyStats: {
      element: string;
      power: number;
      cooldownSeconds: number;
    };
    candidateStats: Array<{
      candidateSkillId: string;
      element: string;
      power: number;
      cooldownSeconds: number;
    }>;
    localePayloadSha256: Record<PalworldTranslationLocale, string>;
    assignments: Array<{
      palId: string;
      unlockLevel: number;
      candidateSkillId: string;
      candidateSourceRowId: string;
    }>;
  }>;
};

export type PalworldPassiveSkillLocaleEvidence = {
  schemaVersion: 2;
  release: string;
  status: typeof PASSIVE_SKILL_EVIDENCE_STATUS;
  candidateId: string;
  joinRule: typeof PASSIVE_SKILL_MAPPING_JOIN_RULE;
  inputs: {
    activeCatalogSha256: string;
    candidateSkillsSha256: string;
    candidateImportReportSha256: string;
    sourceArchiveSha256: string;
    mappingSha256: string;
  };
  counts: {
    activePassiveSkills: number;
    exactMatches: number;
    officialNames: number;
    compatibleDescriptions: number;
    missingSourceDescriptions: number;
    numericMismatchDescriptions: number;
    compatibleEffects: number;
    sourceMismatchEffects: number;
    effectRows: number;
  };
  entries: Array<{
    legacySkillId: string;
    candidateSkillId: string;
    candidateSourceRowId: string;
    candidateSourceInternalId: string;
    expectedLegacyIdPrefix: string;
    joinGuard: "legacy_public_id_prefix_exact";
    nameLocalePayloadSha256: Record<PalworldTranslationLocale, string>;
    effectState: "available" | "source_mismatch";
    effectsPayloadSha256: string;
    effects: PalworldPassiveEffect[];
    description: {
      status: "compatible" | "missing_source" | "numeric_mismatch";
      legacyNumbers: number[];
      candidateNumbers: Record<PalworldTranslationLocale, number[]>;
      localePayloadSha256?: Record<PalworldTranslationLocale, string>;
    };
  }>;
};

export type PalworldOfficialLocaleManifest = {
  schemaVersion: 1;
  release: string;
  sourceCatalogSha256: string;
  sourcePaldexSha256: string;
  glossarySha256: string;
  sourceRevision: string;
  translationRevision: string;
  generatedAt: string;
  locales: Record<PalworldTranslationLocale, {
    file: "ko.json" | "ja.json";
    sha256: string;
    recordCount: number;
  }>;
};

export type PalworldOfficialLocaleCoverageArtifact = {
  schemaVersion: 1;
  release: string;
  locale: PalworldTranslationLocale;
  sourceCatalogSha256: string;
  sourcePaldexSha256: string;
  translationRevision: string;
  translationStatus: "complete" | "incomplete";
  coverage: {
    byKind: Record<PalworldTranslationRecordKind, Record<
      PalworldTranslationField,
      { translated: number; total: number }
    >>;
    translated: number;
    total: number;
    missing: number;
    status: {
      source_provided: number;
      human_reviewed: number;
      machine_assisted: number;
    };
  };
  contentSha256: string;
};

export type PalworldOfficialLocaleOverlayArtifacts = {
  officialSourceFields: PalworldOfficialLocaleSourceFieldsArtifact;
  activeSkillEvidence: PalworldActiveSkillLocaleEvidence;
  passiveSkillEvidence: PalworldPassiveSkillLocaleEvidence;
  compatibility: PalworldOfficialLocaleCompatibilityArtifact;
  snapshots: Record<PalworldTranslationLocale, PalworldTranslationSnapshot>;
  coverage: Record<PalworldTranslationLocale, PalworldOfficialLocaleCoverageArtifact>;
  manifest: PalworldOfficialLocaleManifest;
};

export type BuildPalworldOfficialLocaleOverlayOptions = {
  activeReleaseRoot: string;
  candidateRoot: string;
  reviewedAt: string;
  reviewer: string;
  evidenceChecksum: string;
  activeSkillMappingFile: string;
  passiveSkillMappingFile: string;
};

type FileInput = {
  raw: JsonRecord;
  bytes: Buffer;
  sha256: string;
};

type ActiveManifest = PalworldOfficialLocaleManifest;

type ActiveCorpus = {
  schemaVersion: 1;
  release: string;
  sourceCatalogSha256: string;
  sourcePaldexSha256: string;
  sourceRevision: string;
  extractedAt: string;
  records: Array<{
    id: string;
    kind: PalworldTranslationRecordKind;
    fields: Partial<Record<PalworldTranslationField, {
      sourceText: string;
      sourceSha256: string;
    }>>;
  }>;
};

type CandidateSourceLock = {
  candidateId: string;
  release: string | null;
  archive: {
    sha256: string;
    bytes: number;
    fileCount: number;
  };
  sourceArchives: Array<{
    role: "primary" | "asset_overlay";
    sha256: string;
    bytes: number;
  }>;
  mappings: Record<string, string>;
};

type CandidateActiveSkill = {
  id: string;
  sourceRowId: string;
  sourceInternalId: string;
  element: string;
  power: number;
  cooldownSeconds: number;
  name: PalworldTranslationLocalizedCandidateValue;
  description: PalworldTranslationLocalizedCandidateValue;
};

type CandidateActiveAssignment = {
  sourceRowId: string;
  palId: string;
  activeSkillId: string;
  level: number;
};

type ActiveSkillLocaleResolution = {
  evidence: PalworldActiveSkillLocaleEvidence;
  byLegacySkillId: ReadonlyMap<string, {
    candidates: readonly CandidateActiveSkill[];
  }>;
};

type CandidatePassiveSkill = {
  id: string;
  sourceRowId: string;
  sourceInternalId: string;
  name: PalworldTranslationLocalizedCandidateValue;
  description: PalworldTranslationLocalizedCandidateValue;
  effects: PalworldPassiveEffect[];
};

type PassiveSkillLocaleResolution = {
  evidence: PalworldPassiveSkillLocaleEvidence;
  byLegacySkillId: ReadonlyMap<string, {
    candidate: CandidatePassiveSkill;
    descriptionCompatible: boolean;
  }>;
};

function fail(message: string): never {
  throw new TypeError(`Palworld 공식 locale overlay 오류: ${message}`);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function recordAt(
  value: unknown,
  pathName: string,
  allowedKeys: readonly string[],
): JsonRecord {
  if (!isRecord(value)) fail(`${pathName}는 객체여야 합니다.`);
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${pathName}.${key}는 허용되지 않은 필드입니다.`);
  }
  return value;
}

function stringAt(
  value: unknown,
  pathName: string,
  maximum = 65_536,
  trim = true,
): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > maximum
    || (trim && value.trim() !== value)
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  ) {
    fail(`${pathName}는 올바른 문자열이어야 합니다.`);
  }
  return value;
}

function sha256At(value: unknown, pathName: string): string {
  const result = stringAt(value, pathName, 64);
  if (!SHA256_PATTERN.test(result)) fail(`${pathName}는 SHA-256이어야 합니다.`);
  return result;
}

function integerAt(
  value: unknown,
  pathName: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    fail(`${pathName}는 ${minimum}~${maximum} 범위 정수여야 합니다.`);
  }
  return value;
}

function finiteNumberAt(
  value: unknown,
  pathName: string,
  minimum = -1_000_000,
  maximum = 1_000_000,
): number {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || value < minimum
    || value > maximum
    || Object.is(value, -0)
  ) {
    fail(`${pathName}는 ${minimum}~${maximum} 범위 유한 숫자여야 합니다.`);
  }
  return value;
}

function strictTimestampAt(value: unknown, pathName: string): string {
  const result = stringAt(value, pathName, 64);
  if (!STRICT_RFC3339_PATTERN.test(result) || !Number.isFinite(Date.parse(result))) {
    fail(`${pathName}는 strict RFC3339 UTC 시각이어야 합니다.`);
  }
  return result;
}

function safeIdAt(value: unknown, pathName: string): string {
  const result = stringAt(value, pathName, 192);
  if (!SAFE_ID_PATTERN.test(result)) fail(`${pathName} canonical ID가 올바르지 않습니다.`);
  return result;
}

function safeSourceMemberAt(value: unknown, pathName: string): string {
  const result = stringAt(value, pathName, 1_024);
  if (
    path.isAbsolute(result)
    || result.includes("\\")
    || result.includes("%")
    || result.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    fail(`${pathName}는 안전한 archive 상대 경로여야 합니다.`);
  }
  return result;
}

function arrayAt(value: unknown, pathName: string, maximum = 100_000): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) {
    fail(`${pathName}는 최대 ${maximum}개 배열이어야 합니다.`);
  }
  return value;
}

function sortedUniqueMap<T>(
  values: readonly T[],
  keyOf: (value: T) => string,
  pathName: string,
): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const key = keyOf(value);
    if (result.has(key)) fail(`${pathName}에 중복 key가 있습니다: ${key}`);
    result.set(key, value);
  }
  return result;
}

async function readJsonFile(filePath: string): Promise<FileInput> {
  const resolved = path.resolve(filePath);
  const [linkInfo, fileInfo] = await Promise.all([lstat(resolved), stat(resolved)]);
  if (
    linkInfo.isSymbolicLink()
    || !fileInfo.isFile()
    || fileInfo.size < 2
    || fileInfo.size > MAX_JSON_BYTES
  ) {
    fail(`${path.basename(resolved)} 파일 형식 또는 크기가 올바르지 않습니다.`);
  }
  const bytes = await readFile(resolved);
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(`${path.basename(resolved)}는 올바른 JSON이 아닙니다.`);
  }
  if (!isRecord(value)) fail(`${path.basename(resolved)} 루트는 객체여야 합니다.`);
  return { raw: value, bytes, sha256: sha256(bytes) };
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function legacyPublicId(sourceInternalId: string): string {
  const result = sourceInternalId
    .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
    .replace(/[^A-Za-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLocaleLowerCase("en-US");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(result)) {
    fail(`legacy public ID를 만들 수 없습니다: ${sourceInternalId}`);
  }
  return result;
}

function numericMeaningSequence(value: string | undefined): number[] {
  if (value === undefined) return [];
  return [...value.matchAll(/-?\d+(?:\.\d+)?/gu)].map((match) => {
    const number = Number(match[0]);
    if (!Number.isFinite(number)) fail("패시브 설명 숫자는 유한해야 합니다.");
    return number;
  });
}

function activeManifestAt(value: unknown): ActiveManifest {
  const root = recordAt(value, "activeLocaleManifest", [
    "schemaVersion",
    "release",
    "sourceCatalogSha256",
    "sourcePaldexSha256",
    "glossarySha256",
    "sourceRevision",
    "translationRevision",
    "generatedAt",
    "locales",
  ]);
  if (root.schemaVersion !== 1) fail("activeLocaleManifest.schemaVersion은 1이어야 합니다.");
  const locales = recordAt(root.locales, "activeLocaleManifest.locales", LOCALES);
  const parsedLocales = {} as ActiveManifest["locales"];
  for (const locale of LOCALES) {
    const entry = recordAt(locales[locale], `activeLocaleManifest.locales.${locale}`, [
      "file",
      "sha256",
      "recordCount",
    ]);
    const expectedFile = `${locale}.json` as "ko.json" | "ja.json";
    if (entry.file !== expectedFile) {
      fail(`activeLocaleManifest.locales.${locale}.file이 올바르지 않습니다.`);
    }
    parsedLocales[locale] = {
      file: expectedFile,
      sha256: sha256At(entry.sha256, `activeLocaleManifest.locales.${locale}.sha256`),
      recordCount: integerAt(
        entry.recordCount,
        `activeLocaleManifest.locales.${locale}.recordCount`,
        0,
        100_000,
      ),
    };
  }
  return {
    schemaVersion: 1,
    release: stringAt(root.release, "activeLocaleManifest.release", 64),
    sourceCatalogSha256: sha256At(
      root.sourceCatalogSha256,
      "activeLocaleManifest.sourceCatalogSha256",
    ),
    sourcePaldexSha256: sha256At(
      root.sourcePaldexSha256,
      "activeLocaleManifest.sourcePaldexSha256",
    ),
    glossarySha256: sha256At(
      root.glossarySha256,
      "activeLocaleManifest.glossarySha256",
    ),
    sourceRevision: stringAt(
      root.sourceRevision,
      "activeLocaleManifest.sourceRevision",
      256,
    ),
    translationRevision: stringAt(
      root.translationRevision,
      "activeLocaleManifest.translationRevision",
      256,
    ),
    generatedAt: strictTimestampAt(
      root.generatedAt,
      "activeLocaleManifest.generatedAt",
    ),
    locales: parsedLocales,
  };
}

function activeCorpusAt(value: unknown): ActiveCorpus {
  const root = recordAt(value, "activeCorpus", [
    "schemaVersion",
    "release",
    "sourceCatalogSha256",
    "sourcePaldexSha256",
    "sourceRevision",
    "extractedAt",
    "records",
  ]);
  if (root.schemaVersion !== 1) fail("activeCorpus.schemaVersion은 1이어야 합니다.");
  const records = arrayAt(root.records, "activeCorpus.records").map((input, index) => {
    const entryPath = `activeCorpus.records[${index}]`;
    const record = recordAt(input, entryPath, ["id", "kind", "fields"]);
    if (!KINDS.includes(record.kind as PalworldTranslationRecordKind)) {
      fail(`${entryPath}.kind가 올바르지 않습니다.`);
    }
    const kind = record.kind as PalworldTranslationRecordKind;
    const fieldsRecord = recordAt(record.fields, `${entryPath}.fields`, FIELDS);
    const fields: ActiveCorpus["records"][number]["fields"] = {};
    for (const [fieldName, rawField] of Object.entries(fieldsRecord)) {
      if (!FIELDS.includes(fieldName as PalworldTranslationField)) {
        fail(`${entryPath}.fields.${fieldName}가 올바르지 않습니다.`);
      }
      if (kind !== "skill" && fieldName === "passiveAbility") {
        fail(`${entryPath}.fields.passiveAbility는 skill에만 허용됩니다.`);
      }
      const field = recordAt(
        rawField,
        `${entryPath}.fields.${fieldName}`,
        ["sourceText", "sourceSha256"],
      );
      const sourceText = stringAt(
        field.sourceText,
        `${entryPath}.fields.${fieldName}.sourceText`,
        65_536,
        false,
      );
      const sourceSha256 = sha256At(
        field.sourceSha256,
        `${entryPath}.fields.${fieldName}.sourceSha256`,
      );
      if (sha256(sourceText) !== sourceSha256) {
        fail(`${entryPath}.fields.${fieldName} 원문 hash가 일치하지 않습니다.`);
      }
      fields[fieldName as PalworldTranslationField] = {
        sourceText,
        sourceSha256,
      };
    }
    if (Object.keys(fields).length === 0) fail(`${entryPath}.fields가 비어 있습니다.`);
    return {
      id: safeIdAt(record.id, `${entryPath}.id`),
      kind,
      fields,
    };
  });
  let previousIdentity = "";
  const seen = new Set<string>();
  for (const [index, record] of records.entries()) {
    const identity = `${record.kind}:${record.id}`;
    if (
      seen.has(identity)
      || (previousIdentity !== "" && previousIdentity.localeCompare(identity, "en") >= 0)
    ) {
      fail(`activeCorpus.records[${index}]가 중복되었거나 정렬되지 않았습니다.`);
    }
    seen.add(identity);
    previousIdentity = identity;
  }
  return {
    schemaVersion: 1,
    release: stringAt(root.release, "activeCorpus.release", 64),
    sourceCatalogSha256: sha256At(
      root.sourceCatalogSha256,
      "activeCorpus.sourceCatalogSha256",
    ),
    sourcePaldexSha256: sha256At(
      root.sourcePaldexSha256,
      "activeCorpus.sourcePaldexSha256",
    ),
    sourceRevision: stringAt(root.sourceRevision, "activeCorpus.sourceRevision", 256),
    extractedAt: strictTimestampAt(root.extractedAt, "activeCorpus.extractedAt"),
    records,
  };
}

function candidateLocaleRecordsAt(
  value: unknown,
  pathName: string,
): PalworldTranslationCandidateLocaleRecord[] {
  return arrayAt(value, pathName).map((input, index) => {
    const entryPath = `${pathName}[${index}]`;
    const record = recordAt(input, entryPath, [
      "messageKey",
      "field",
      "text",
      "valueSha256",
      "status",
      "sourceMember",
      "sourceMemberSha256",
    ]);
    if (record.status !== "source_provided") {
      fail(`${entryPath}.status는 source_provided여야 합니다.`);
    }
    const messageKey = stringAt(record.messageKey, `${entryPath}.messageKey`, 192);
    if (!SAFE_MESSAGE_KEY_PATTERN.test(messageKey)) {
      fail(`${entryPath}.messageKey 형식이 올바르지 않습니다.`);
    }
    const text = stringAt(record.text, `${entryPath}.text`, 65_536, false);
    const valueSha256 = sha256At(record.valueSha256, `${entryPath}.valueSha256`);
    if (sha256(text) !== valueSha256) fail(`${entryPath}.valueSha256가 일치하지 않습니다.`);
    return {
      messageKey,
      field: stringAt(record.field, `${entryPath}.field`, 64),
      text,
      valueSha256,
      status: "source_provided",
      sourceMember: safeSourceMemberAt(
        record.sourceMember,
        `${entryPath}.sourceMember`,
      ),
      sourceMemberSha256: sha256At(
        record.sourceMemberSha256,
        `${entryPath}.sourceMemberSha256`,
      ),
    };
  });
}

function candidateEntitiesAt(
  values: unknown,
  pathName: string,
): PalworldTranslationCandidateEntity[] {
  return arrayAt(values, pathName).map((input, index) => {
    if (!isRecord(input)) fail(`${pathName}[${index}]는 객체여야 합니다.`);
    const parseLocalized = (
      raw: unknown,
      fieldPath: string,
    ): PalworldTranslationLocalizedCandidateValue | undefined => {
      if (raw === undefined) return undefined;
      if (!isRecord(raw)) fail(`${fieldPath}는 객체여야 합니다.`);
      const readStatus = (
        locale: PalworldTranslationLocale,
      ): "source_provided" | "missing_source" => {
        const status = raw[`${locale}Status`];
        if (status !== "source_provided" && status !== "missing_source") {
          fail(`${fieldPath}.${locale}Status가 올바르지 않습니다.`);
        }
        return status;
      };
      const readRich = (
        locale: PalworldTranslationLocale,
      ): "resolved" | "unresolved" | "placeholder" | undefined => {
        const status = raw[`${locale}RichTextStatus`];
        if (status === undefined) return undefined;
        if (status !== "resolved" && status !== "unresolved" && status !== "placeholder") {
          fail(`${fieldPath}.${locale}RichTextStatus가 올바르지 않습니다.`);
        }
        return status;
      };
      const ko = raw.ko === null
        ? null
        : stringAt(raw.ko, `${fieldPath}.ko`, 65_536, false);
      const ja = raw.ja === null
        ? null
        : stringAt(raw.ja, `${fieldPath}.ja`, 65_536, false);
      const koRich = readRich("ko");
      const jaRich = readRich("ja");
      return {
        messageKey: stringAt(raw.messageKey, `${fieldPath}.messageKey`, 192),
        sourceField: stringAt(raw.sourceField, `${fieldPath}.sourceField`, 64),
        ko,
        ja,
        koStatus: readStatus("ko"),
        jaStatus: readStatus("ja"),
        ...(koRich === undefined ? {} : { koRichTextStatus: koRich }),
        ...(jaRich === undefined ? {} : { jaRichTextStatus: jaRich }),
      };
    };
    return {
      id: stringAt(input.id, `${pathName}[${index}].id`, 192),
      sourceInternalId: stringAt(
        input.sourceInternalId,
        `${pathName}[${index}].sourceInternalId`,
        192,
      ),
      ...(typeof input.type === "string"
        ? { type: stringAt(input.type, `${pathName}[${index}].type`, 32) }
        : {}),
      ...(Array.isArray(input.relatedPalIds)
        ? {
            relatedPalIds: input.relatedPalIds.map((id, relatedIndex) =>
              safeIdAt(id, `${pathName}[${index}].relatedPalIds[${relatedIndex}]`)),
          }
        : {}),
      ...(input.name === undefined
        ? {}
        : { name: parseLocalized(input.name, `${pathName}[${index}].name`)! }),
      ...(input.description === undefined
        ? {}
        : {
            description: parseLocalized(
              input.description,
              `${pathName}[${index}].description`,
            )!,
          }),
    };
  });
}

function candidateActiveSkillsAt(
  candidateSkills: JsonRecord,
): {
  skills: CandidateActiveSkill[];
  assignments: CandidateActiveAssignment[];
} {
  const localizedById = sortedUniqueMap(
    candidateEntitiesAt(candidateSkills.records, "candidate.skills.records")
      .filter((record) => record.type === "active"),
    (record) => record.id,
    "candidate.skills.activeRecords",
  );
  const skills = arrayAt(
    candidateSkills.records,
    "candidate.skills.records",
  ).flatMap((input, index): CandidateActiveSkill[] => {
    if (!isRecord(input) || input.type !== "active") return [];
    const entryPath = `candidate.skills.records[${index}]`;
    const id = candidateCanonicalIdAt(input.id, `${entryPath}.id`);
    const localized = localizedById.get(id);
    if (
      localized?.name === undefined
      || localized.description === undefined
    ) {
      fail(`${entryPath} active skill 공식 이름/설명이 없습니다.`);
    }
    return [{
      id,
      sourceRowId: stringAt(input.sourceRowId, `${entryPath}.sourceRowId`, 192),
      sourceInternalId: stringAt(
        input.sourceInternalId,
        `${entryPath}.sourceInternalId`,
        192,
      ),
      element: stringAt(input.element, `${entryPath}.element`, 32),
      power: integerAt(input.power, `${entryPath}.power`, 0, 100_000),
      cooldownSeconds: integerAt(
        input.cooldownSeconds,
        `${entryPath}.cooldownSeconds`,
        0,
        100_000,
      ),
      name: localized.name,
      description: localized.description,
    }];
  });
  const skillIds = new Set(skills.map((skill) => skill.id));
  const assignments = arrayAt(
    candidateSkills.assignments,
    "candidate.skills.assignments",
    100_000,
  ).flatMap((input, index): CandidateActiveAssignment[] => {
    if (!isRecord(input) || input.status !== "resolved") return [];
    const entryPath = `candidate.skills.assignments[${index}]`;
    const activeSkillId = candidateCanonicalIdAt(
      input.activeSkillId,
      `${entryPath}.activeSkillId`,
    );
    if (!skillIds.has(activeSkillId)) {
      fail(`${entryPath}.activeSkillId가 active skill을 참조하지 않습니다.`);
    }
    return [{
      sourceRowId: stringAt(input.sourceRowId, `${entryPath}.sourceRowId`, 192),
      palId: safeIdAt(input.palId, `${entryPath}.palId`),
      activeSkillId,
      level: integerAt(input.level, `${entryPath}.level`, 0, 1_000),
    }];
  });
  return {
    skills: [...skills].sort((left, right) => left.id.localeCompare(right.id, "en")),
    assignments: [...assignments].sort((left, right) =>
      `${left.palId}\0${String(left.level).padStart(4, "0")}`.localeCompare(
        `${right.palId}\0${String(right.level).padStart(4, "0")}`,
        "en",
      )),
  };
}

function candidatePassiveSkillsAt(
  candidateSkills: JsonRecord,
): CandidatePassiveSkill[] {
  const localizedById = sortedUniqueMap(
    candidateEntitiesAt(candidateSkills.records, "candidate.skills.records")
      .filter((record) => record.type === "passive"),
    (record) => record.id,
    "candidate.skills.passiveRecords",
  );
  const skills = arrayAt(
    candidateSkills.records,
    "candidate.skills.records",
  ).flatMap((input, index): CandidatePassiveSkill[] => {
    if (!isRecord(input) || input.type !== "passive") return [];
    const entryPath = `candidate.skills.records[${index}]`;
    const id = candidateCanonicalIdAt(input.id, `${entryPath}.id`);
    const sourceRowId = stringAt(
      input.sourceRowId,
      `${entryPath}.sourceRowId`,
      192,
    );
    const sourceInternalId = stringAt(
      input.sourceInternalId,
      `${entryPath}.sourceInternalId`,
      192,
    );
    const localized = localizedById.get(id);
    if (
      id !== `passive:${sourceRowId}`
      || sourceRowId !== sourceInternalId
      || localized?.type !== "passive"
      || localized.name === undefined
      || localized.description === undefined
    ) {
      fail(`${entryPath} passive skill source identity 또는 locale이 올바르지 않습니다.`);
    }
    const effects = arrayAt(
      input.effects,
      `${entryPath}.effects`,
      4,
    ).map((effect, effectIndex): PalworldPassiveEffect => {
      const effectPath = `${entryPath}.effects[${effectIndex}]`;
      const effectRoot = recordAt(effect, effectPath, ["type", "value", "target"]);
      const parsed = {
        type: stringAt(effectRoot.type, `${effectPath}.type`, 96),
        value: finiteNumberAt(effectRoot.value, `${effectPath}.value`),
        target: stringAt(effectRoot.target, `${effectPath}.target`, 64),
      };
      const validated = validatePalworldPassiveEffect(parsed);
      if (!validated.ok) {
        fail(`${effectPath} Shared 원본 효과 검증에 실패했습니다: ${validated.error}`);
      }
      return validated.data;
    });
    if (effects.length === 0) {
      fail(`${entryPath}.effects에 하나 이상의 원본 효과가 필요합니다.`);
    }
    const effectKeys = effects.map((effect) => `${effect.type}\0${effect.target}`);
    if (new Set(effectKeys).size !== effectKeys.length) {
      fail(`${entryPath}.effects에 중복 type·target 조합이 있습니다.`);
    }
    return [{
      id,
      sourceRowId,
      sourceInternalId,
      name: localized.name,
      description: localized.description,
      effects,
    }];
  });
  return [...skills].sort((left, right) => left.id.localeCompare(right.id, "en"));
}

function officialActiveSkillPayload(input: {
  skill: CandidateActiveSkill;
  locale: PalworldTranslationLocale;
  localeRecords: ReadonlyMap<string, PalworldTranslationCandidateLocaleRecord>;
}): {
  hash: string;
  name: ReturnType<typeof palworldTranslationOfficialLocaleValue>;
  description: ReturnType<typeof palworldTranslationOfficialLocaleValue>;
} {
  const name = palworldTranslationOfficialLocaleValue(
    input.skill.name,
    input.locale,
    input.localeRecords,
    true,
  );
  const description = palworldTranslationOfficialLocaleValue(
    input.skill.description,
    input.locale,
    input.localeRecords,
    true,
  );
  if (
    name === undefined
    || description === undefined
    || input.skill.name[`${input.locale}Status`] !== "source_provided"
    || input.skill.description[`${input.locale}Status`] !== "source_provided"
    || input.skill.description[`${input.locale}RichTextStatus`] !== "resolved"
  ) {
    fail(`${input.skill.id} ${input.locale} 공식 name/description이 resolved source_provided가 아닙니다.`);
  }
  return {
    // Pal별 sourceInternalId/message key가 다르더라도 공개 locale payload가
    // byte-for-byte 같을 때만 하나의 legacy skill 번역으로 병합합니다.
    hash: sha256(canonicalJson({
      name: name.text,
      description: description.text,
    })),
    name,
    description,
  };
}

function buildActiveSkillLocaleResolution(input: {
  catalog: PalworldCatalogArtifact;
  candidateSkills: JsonRecord;
  candidateId: string;
  sourceArchiveSha256: string;
  activeCatalogSha256: string;
  candidateSkillsSha256: string;
  candidateImportReportSha256: string;
  mapping: PalworldLegacyActiveSkillLocaleMap;
  mappingSha256: string;
  localeByKey: Record<
    PalworldTranslationLocale,
    ReadonlyMap<string, PalworldTranslationCandidateLocaleRecord>
  >;
}): ActiveSkillLocaleResolution {
  if (
    input.mapping.activeRelease !== input.catalog.release
    || input.mapping.candidateId !== input.candidateId
    || input.mapping.activeCatalogSha256 !== input.activeCatalogSha256
    || input.mapping.candidateSkillsSha256 !== input.candidateSkillsSha256
    || input.mapping.candidateImportReportSha256 !== input.candidateImportReportSha256
    || input.mapping.sourceArchiveSha256 !== input.sourceArchiveSha256
  ) {
    fail("active skill locale map의 release/candidate/checksum pin이 실제 입력과 다릅니다.");
  }
  const candidate = candidateActiveSkillsAt(input.candidateSkills);
  const candidateById = sortedUniqueMap(
    candidate.skills,
    (skill) => skill.id,
    "candidate.activeSkills",
  );
  const candidateAssignmentByPalLevel = sortedUniqueMap(
    candidate.assignments,
    (assignment) =>
      `${assignment.palId}\0${String(assignment.level).padStart(4, "0")}`,
    "candidate.activeAssignments.palLevel",
  );
  const legacyActiveSkills = input.catalog.skills
    .filter((skill) => skill.type === "active")
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
  const legacyAssignmentsBySkill = new Map<
    string,
    typeof input.catalog.skillAssignments
  >();
  for (const assignment of input.catalog.skillAssignments) {
    if (assignment.kind !== "active") continue;
    legacyAssignmentsBySkill.set(assignment.skillId, [
      ...(legacyAssignmentsBySkill.get(assignment.skillId) ?? []),
      assignment,
    ]);
  }
  const byLegacySkillId = new Map<string, {
    candidates: readonly CandidateActiveSkill[];
  }>();
  const entries: PalworldActiveSkillLocaleEvidence["entries"] = [];
  for (const legacySkill of legacyActiveSkills) {
    const legacyAssignments = [...(legacyAssignmentsBySkill.get(legacySkill.id) ?? [])]
      .sort((left, right) =>
        `${left.palId}\0${String(left.unlockLevel ?? -1).padStart(4, "0")}`
          .localeCompare(
            `${right.palId}\0${String(right.unlockLevel ?? -1).padStart(4, "0")}`,
            "en",
          ));
    if (
      legacyAssignments.length === 0
      || legacyAssignments.some((assignment) => assignment.unlockLevel === undefined)
    ) {
      fail(`${legacySkill.id} active assignment에 unlockLevel이 없습니다.`);
    }
    const assignmentEvidence = legacyAssignments.map((assignment) => {
      const unlockLevel = assignment.unlockLevel!;
      const candidateAssignment = candidateAssignmentByPalLevel.get(
        `${assignment.palId}\0${String(unlockLevel).padStart(4, "0")}`,
      );
      if (candidateAssignment === undefined) {
        fail(`${legacySkill.id} ${assignment.palId} Lv.${unlockLevel} candidate assignment가 없습니다.`);
      }
      return {
        palId: assignment.palId,
        unlockLevel,
        candidateSkillId: candidateAssignment.activeSkillId,
        candidateSourceRowId: candidateAssignment.sourceRowId,
      };
    });
    const candidateSkillIds = [...new Set(
      assignmentEvidence.map((assignment) => assignment.candidateSkillId),
    )].sort((left, right) => left.localeCompare(right, "en"));
    const targets = candidateSkillIds.map((id) =>
      candidateById.get(id)
      ?? fail(`${legacySkill.id} candidate active skill 참조가 없습니다: ${id}`));
    const payloadSha256 = {} as Record<PalworldTranslationLocale, string>;
    for (const locale of LOCALES) {
      const hashes = targets.map((skill) =>
        officialActiveSkillPayload({
          skill,
          locale,
          localeRecords: input.localeByKey[locale],
        }).hash);
      if (new Set(hashes).size !== 1) {
        fail(`${legacySkill.id} multi-target ${locale} 공식 locale payload가 동일하지 않습니다.`);
      }
      payloadSha256[locale] = hashes[0]!;
    }
    const candidateStats = targets.map((target) => ({
      candidateSkillId: target.id,
      element: target.element,
      power: target.power,
      cooldownSeconds: target.cooldownSeconds,
    }));
    const legacyStats = {
      element: legacySkill.element!,
      power: legacySkill.power!,
      cooldownSeconds: legacySkill.cooldownSeconds!,
    };
    const mismatches = candidateStats.flatMap((stats) => {
      const result: Array<{
        candidateSkillId: string;
        field: "element" | "power" | "cooldownSeconds";
      }> = [];
      if (stats.element !== legacyStats.element) {
        result.push({ candidateSkillId: stats.candidateSkillId, field: "element" });
      }
      if (stats.power !== legacyStats.power) {
        result.push({ candidateSkillId: stats.candidateSkillId, field: "power" });
      }
      if (stats.cooldownSeconds !== legacyStats.cooldownSeconds) {
        result.push({
          candidateSkillId: stats.candidateSkillId,
          field: "cooldownSeconds",
        });
      }
      return result;
    });
    const exceptions = input.mapping.reviewedExceptions.filter((exception) =>
      exception.legacySkillId === legacySkill.id);
    if (
      mismatches.length !== exceptions.length
      || mismatches.some((mismatch) =>
        !exceptions.some((exception) =>
          exception.candidateSkillId === mismatch.candidateSkillId
          && exception.field === mismatch.field
          && exception.activeValue === legacyStats.power
          && exception.candidateValue
            === candidateStats.find((stats) =>
              stats.candidateSkillId === mismatch.candidateSkillId)!.power))
    ) {
      fail(`${legacySkill.id} stats guard 불일치가 reviewed exception과 다릅니다.`);
    }
    byLegacySkillId.set(legacySkill.id, { candidates: targets });
    entries.push({
      legacySkillId: legacySkill.id,
      candidateSkillIds,
      guard: mismatches.length === 0 ? "exact_stats" : "reviewed_exception",
      legacyStats,
      candidateStats,
      localePayloadSha256: payloadSha256,
      assignments: assignmentEvidence,
    });
  }
  for (const exception of input.mapping.reviewedExceptions) {
    if (!entries.some((entry) =>
      entry.legacySkillId === exception.legacySkillId
      && entry.candidateSkillIds.includes(exception.candidateSkillId)
      && entry.guard === "reviewed_exception")) {
      fail(`사용되지 않은 active skill reviewed exception입니다: ${exception.legacySkillId}`);
    }
  }
  const evidence = assertPalworldActiveSkillLocaleEvidenceArtifact({
    schemaVersion: 1,
    release: input.catalog.release,
    status: ACTIVE_SKILL_EVIDENCE_STATUS,
    candidateId: input.candidateId,
    joinRule: ACTIVE_SKILL_MAPPING_JOIN_RULE,
    inputs: {
      activeCatalogSha256: input.activeCatalogSha256,
      candidateSkillsSha256: input.candidateSkillsSha256,
      candidateImportReportSha256: input.candidateImportReportSha256,
      sourceArchiveSha256: input.sourceArchiveSha256,
      mappingSha256: input.mappingSha256,
    },
    counts: {
      activeSkills: entries.length,
      assignmentEvidence: entries.reduce(
        (sum, entry) => sum + entry.assignments.length,
        0,
      ),
      singleTargetSkills: entries.filter((entry) =>
        entry.candidateSkillIds.length === 1).length,
      multiTargetSkills: entries.filter((entry) =>
        entry.candidateSkillIds.length > 1).length,
      reviewedExceptions: input.mapping.reviewedExceptions.length,
    },
    reviewedExceptions: input.mapping.reviewedExceptions,
    entries,
  });
  return { evidence, byLegacySkillId };
}

function buildPassiveSkillLocaleResolution(input: {
  catalog: PalworldCatalogArtifact;
  candidateSkills: JsonRecord;
  candidateId: string;
  sourceArchiveSha256: string;
  activeCatalogSha256: string;
  candidateSkillsSha256: string;
  candidateImportReportSha256: string;
  mapping: PalworldLegacyPassiveSkillLocaleMap;
  mappingSha256: string;
  localeByKey: Record<
    PalworldTranslationLocale,
    ReadonlyMap<string, PalworldTranslationCandidateLocaleRecord>
  >;
}): PassiveSkillLocaleResolution {
  if (
    input.mapping.activeRelease !== input.catalog.release
    || input.mapping.candidateId !== input.candidateId
    || input.mapping.activeCatalogSha256 !== input.activeCatalogSha256
    || input.mapping.candidateSkillsSha256 !== input.candidateSkillsSha256
    || input.mapping.candidateImportReportSha256
      !== input.candidateImportReportSha256
    || input.mapping.sourceArchiveSha256 !== input.sourceArchiveSha256
  ) {
    fail("passive skill locale map의 release/candidate/checksum pin이 실제 입력과 다릅니다.");
  }
  const candidates = candidatePassiveSkillsAt(input.candidateSkills);
  const candidateById = sortedUniqueMap(
    candidates,
    (candidate) => candidate.id,
    "candidate.passiveSkills",
  );
  const legacySkills = input.catalog.skills
    .filter((skill) => skill.type === "passive")
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
  const legacyById = sortedUniqueMap(
    legacySkills,
    (skill) => skill.id,
    "active.passiveSkills",
  );
  if (
    input.mapping.entries.length !== legacySkills.length
    || input.mapping.entries.some((entry) => !legacyById.has(entry.legacySkillId))
    || legacySkills.some((skill) =>
      !input.mapping.entries.some((entry) => entry.legacySkillId === skill.id))
  ) {
    fail("passive skill locale map은 active passive skill 전체를 정확히 포함해야 합니다.");
  }
  const byLegacySkillId = new Map<string, {
    candidate: CandidatePassiveSkill;
    descriptionCompatible: boolean;
  }>();
  const usedCandidateIds = new Set<string>();
  const entries: PalworldPassiveSkillLocaleEvidence["entries"] = [];

  for (const mappingEntry of input.mapping.entries) {
    const legacySkill = legacyById.get(mappingEntry.legacySkillId)
      ?? fail(`${mappingEntry.legacySkillId} active passive skill이 없습니다.`);
    const candidate = candidateById.get(mappingEntry.candidateSkillId)
      ?? fail(`${mappingEntry.candidateSkillId} candidate passive skill이 없습니다.`);
    if (candidate.sourceRowId !== mappingEntry.candidateSourceRowId) {
      fail(`${legacySkill.id} mapping source row가 candidate와 일치하지 않습니다.`);
    }
    if (usedCandidateIds.has(candidate.id)) {
      fail(`${candidate.id} candidate passive skill이 중복 연결되었습니다.`);
    }
    usedCandidateIds.add(candidate.id);
    const expectedLegacyIdPrefix =
      `passive-${legacyPublicId(`Passive_${candidate.sourceRowId}`).slice(0, 84)}-`;
    const escapedPrefix = expectedLegacyIdPrefix.replace(
      /[.*+?^${}()|[\]\\]/gu,
      "\\$&",
    );
    if (
      !new RegExp(`^${escapedPrefix}[a-f0-9]{10}$`, "u")
        .test(legacySkill.id)
    ) {
      fail(`${legacySkill.id} legacy passive ID 형식이 exact prefix와 일치하지 않습니다.`);
    }

    const nameLocalePayloadSha256 =
      {} as Record<PalworldTranslationLocale, string>;
    const officialDescriptions = {} as Record<
      PalworldTranslationLocale,
      ReturnType<typeof palworldTranslationOfficialLocaleValue>
    >;
    for (const locale of LOCALES) {
      const name = palworldTranslationOfficialLocaleValue(
        candidate.name,
        locale,
        input.localeByKey[locale],
        true,
      );
      if (
        name === undefined
        || candidate.name[`${locale}Status`] !== "source_provided"
      ) {
        fail(`${candidate.id} ${locale} 공식 passive 이름이 source_provided가 아닙니다.`);
      }
      nameLocalePayloadSha256[locale] = sha256(name.text);
      officialDescriptions[locale] = palworldTranslationOfficialLocaleValue(
        candidate.description,
        locale,
        input.localeByKey[locale],
        true,
      );
    }

    const legacyNumbers = numericMeaningSequence(legacySkill.descriptionEn);
    const candidateNumbers = {
      ko: numericMeaningSequence(officialDescriptions.ko?.text),
      ja: numericMeaningSequence(officialDescriptions.ja?.text),
    };
    const descriptionHasSource = LOCALES.every((locale) =>
      officialDescriptions[locale] !== undefined
      && candidate.description[`${locale}Status`] === "source_provided"
      && candidate.description[`${locale}RichTextStatus`] === "resolved");
    const descriptionCompatible = descriptionHasSource
      && canonicalJson(candidateNumbers.ko) === canonicalJson(legacyNumbers)
      && canonicalJson(candidateNumbers.ja) === canonicalJson(legacyNumbers);
    const descriptionStatus = !descriptionHasSource
      ? "missing_source" as const
      : descriptionCompatible
        ? "compatible" as const
        : "numeric_mismatch" as const;
    const candidateEffectNumbers = candidate.effects.map((effect) => effect.value);
    const effectState =
      descriptionStatus === "numeric_mismatch"
      || (
        descriptionStatus === "missing_source"
        && canonicalJson(candidateEffectNumbers) !== canonicalJson(legacyNumbers)
      )
        ? "source_mismatch" as const
        : "available" as const;

    byLegacySkillId.set(legacySkill.id, {
      candidate,
      descriptionCompatible,
    });
    entries.push({
      legacySkillId: legacySkill.id,
      candidateSkillId: candidate.id,
      candidateSourceRowId: candidate.sourceRowId,
      candidateSourceInternalId: candidate.sourceInternalId,
      expectedLegacyIdPrefix,
      joinGuard: "legacy_public_id_prefix_exact",
      nameLocalePayloadSha256,
      effectState,
      effectsPayloadSha256: sha256(canonicalJson(candidate.effects)),
      effects: candidate.effects.map((effect) => ({ ...effect })),
      description: {
        status: descriptionStatus,
        legacyNumbers,
        candidateNumbers,
        ...(descriptionCompatible
          ? {
              localePayloadSha256: {
                ko: sha256(officialDescriptions.ko!.text),
                ja: sha256(officialDescriptions.ja!.text),
              },
            }
          : {}),
      },
    });
  }

  const evidence = assertPalworldPassiveSkillLocaleEvidenceArtifact({
    schemaVersion: 2,
    release: input.catalog.release,
    status: PASSIVE_SKILL_EVIDENCE_STATUS,
    candidateId: input.candidateId,
    joinRule: PASSIVE_SKILL_MAPPING_JOIN_RULE,
    inputs: {
      activeCatalogSha256: input.activeCatalogSha256,
      candidateSkillsSha256: input.candidateSkillsSha256,
      candidateImportReportSha256: input.candidateImportReportSha256,
      sourceArchiveSha256: input.sourceArchiveSha256,
      mappingSha256: input.mappingSha256,
    },
    counts: {
      activePassiveSkills: legacySkills.length,
      exactMatches: entries.length,
      officialNames: entries.length,
      compatibleDescriptions: entries.filter((entry) =>
        entry.description.status === "compatible").length,
      missingSourceDescriptions: entries.filter((entry) =>
        entry.description.status === "missing_source").length,
      numericMismatchDescriptions: entries.filter((entry) =>
        entry.description.status === "numeric_mismatch").length,
      compatibleEffects: entries.filter((entry) =>
        entry.effectState === "available").length,
      sourceMismatchEffects: entries.filter((entry) =>
        entry.effectState === "source_mismatch").length,
      effectRows: entries.reduce((sum, entry) => sum + entry.effects.length, 0),
    },
    entries,
  });
  return { evidence, byLegacySkillId };
}

function sourceLockAt(value: unknown): CandidateSourceLock {
  const root = value as JsonRecord;
  const candidateId = stringAt(root.candidateId, "sourceLock.candidateId", 64);
  const archive = recordAt(root.archive, "sourceLock.archive", [
    "sha256",
    "bytes",
    "fileCount",
  ]);
  const sourceArchives = arrayAt(
    root.sourceArchives,
    "sourceLock.sourceArchives",
    8,
  ).map((input, index) => {
    const entry = recordAt(input, `sourceLock.sourceArchives[${index}]`, [
      "role",
      "sha256",
      "bytes",
    ]);
    if (entry.role !== "primary" && entry.role !== "asset_overlay") {
      fail(`sourceLock.sourceArchives[${index}].role이 올바르지 않습니다.`);
    }
    const role = entry.role as "primary" | "asset_overlay";
    return {
      role,
      sha256: sha256At(entry.sha256, `sourceLock.sourceArchives[${index}].sha256`),
      bytes: integerAt(
        entry.bytes,
        `sourceLock.sourceArchives[${index}].bytes`,
        1,
        8 * 1024 * 1024 * 1024,
      ),
    };
  });
  if (
    sourceArchives.filter((entry) => entry.role === "primary").length !== 1
    || sourceArchives.filter((entry) => entry.role === "asset_overlay").length > 1
  ) {
    fail("sourceLock.sourceArchives role이 중복되었거나 primary가 없습니다.");
  }
  const primary = sourceArchives.find((entry) => entry.role === "primary")!;
  const parsedArchive = {
    sha256: sha256At(archive.sha256, "sourceLock.archive.sha256"),
    bytes: integerAt(archive.bytes, "sourceLock.archive.bytes", 1, 8 * 1024 * 1024 * 1024),
    fileCount: integerAt(archive.fileCount, "sourceLock.archive.fileCount", 1, 1_000_000),
  };
  if (
    primary.sha256 !== parsedArchive.sha256
    || primary.bytes !== parsedArchive.bytes
  ) {
    fail("sourceLock.archive와 primary source archive가 일치하지 않습니다.");
  }
  const mappingsInput = recordAt(root.mappings, "sourceLock.mappings", [
    "publicIdMap",
    "publicIdExtensions",
    "aliases",
    "palIconOverrides",
    "elementIconMap",
    "workIconMap",
    "skillIconMap",
    "publicActiveSkillAllowlist",
    "exclusions",
    "legacySkillCatalog",
  ]);
  const mappings: Record<string, string> = {};
  for (const key of Object.keys(mappingsInput).sort((left, right) =>
    left.localeCompare(right, "en"))) {
    mappings[key] = sha256At(mappingsInput[key], `sourceLock.mappings.${key}`);
  }
  return {
    candidateId,
    release: root.release === null
      ? null
      : stringAt(root.release, "sourceLock.release", 64),
    archive: parsedArchive,
    sourceArchives,
    mappings,
  };
}

function localeAt(value: unknown, pathName: string): PalworldTranslationLocale {
  if (value !== "ko" && value !== "ja") fail(`${pathName} locale이 올바르지 않습니다.`);
  return value;
}

function kindAt(value: unknown, pathName: string): PalworldTranslationRecordKind {
  if (!KINDS.includes(value as PalworldTranslationRecordKind)) {
    fail(`${pathName} kind가 올바르지 않습니다.`);
  }
  return value as PalworldTranslationRecordKind;
}

function fieldAt(value: unknown, pathName: string): PalworldTranslationField {
  if (!FIELDS.includes(value as PalworldTranslationField)) {
    fail(`${pathName} field가 올바르지 않습니다.`);
  }
  return value as PalworldTranslationField;
}

function candidateCanonicalIdAt(value: unknown, pathName: string): string {
  const result = stringAt(value, pathName, 192);
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,191}$/u.test(result)) {
    fail(`${pathName} candidate canonical ID가 올바르지 않습니다.`);
  }
  return result;
}

export function assertPalworldLegacyActiveSkillLocaleMap(
  value: unknown,
): PalworldLegacyActiveSkillLocaleMap {
  const root = recordAt(value, "legacyActiveSkillLocaleMap", [
    "schemaVersion",
    "activeRelease",
    "candidateId",
    "joinRule",
    "activeCatalogSha256",
    "candidateSkillsSha256",
    "candidateImportReportSha256",
    "sourceArchiveSha256",
    "reviewedExceptions",
  ]);
  if (
    root.schemaVersion !== 1
    || root.joinRule !== ACTIVE_SKILL_MAPPING_JOIN_RULE
  ) {
    fail("legacyActiveSkillLocaleMap identity가 올바르지 않습니다.");
  }
  let previous = "";
  const reviewedExceptions = arrayAt(
    root.reviewedExceptions,
    "legacyActiveSkillLocaleMap.reviewedExceptions",
    100,
  ).map((input, index) => {
    const entryPath = `legacyActiveSkillLocaleMap.reviewedExceptions[${index}]`;
    const entry = recordAt(input, entryPath, [
      "legacySkillId",
      "candidateSkillId",
      "field",
      "activeValue",
      "candidateValue",
      "reason",
      "reviewStatus",
    ]);
    const legacySkillId = safeIdAt(entry.legacySkillId, `${entryPath}.legacySkillId`);
    const candidateSkillId = candidateCanonicalIdAt(
      entry.candidateSkillId,
      `${entryPath}.candidateSkillId`,
    );
    const identity = `${legacySkillId}\0${candidateSkillId}`;
    if (
      previous !== ""
      && previous.localeCompare(identity, "en") >= 0
    ) {
      fail(`${entryPath}가 중복되었거나 정렬되지 않았습니다.`);
    }
    previous = identity;
    if (
      !legacySkillId.startsWith("active-")
      || !candidateSkillId.startsWith("active:")
      || entry.field !== "power"
      || entry.reviewStatus !== "approved"
    ) {
      fail(`${entryPath}는 승인된 active skill power 예외여야 합니다.`);
    }
    const activeValue = integerAt(entry.activeValue, `${entryPath}.activeValue`, 0, 100_000);
    const candidateValue = integerAt(
      entry.candidateValue,
      `${entryPath}.candidateValue`,
      0,
      100_000,
    );
    if (activeValue === candidateValue) {
      fail(`${entryPath}는 실제 수치 불일치만 승인할 수 있습니다.`);
    }
    return {
      legacySkillId,
      candidateSkillId,
      field: "power" as const,
      activeValue,
      candidateValue,
      reason: stringAt(entry.reason, `${entryPath}.reason`, 1_000),
      reviewStatus: "approved" as const,
    };
  });
  if (reviewedExceptions.length === 0) {
    fail("legacyActiveSkillLocaleMap에는 검토된 수치 예외가 필요합니다.");
  }
  return {
    schemaVersion: 1,
    activeRelease: stringAt(root.activeRelease, "legacyActiveSkillLocaleMap.activeRelease", 64),
    candidateId: stringAt(root.candidateId, "legacyActiveSkillLocaleMap.candidateId", 64),
    joinRule: ACTIVE_SKILL_MAPPING_JOIN_RULE,
    activeCatalogSha256: sha256At(
      root.activeCatalogSha256,
      "legacyActiveSkillLocaleMap.activeCatalogSha256",
    ),
    candidateSkillsSha256: sha256At(
      root.candidateSkillsSha256,
      "legacyActiveSkillLocaleMap.candidateSkillsSha256",
    ),
    candidateImportReportSha256: sha256At(
      root.candidateImportReportSha256,
      "legacyActiveSkillLocaleMap.candidateImportReportSha256",
    ),
    sourceArchiveSha256: sha256At(
      root.sourceArchiveSha256,
      "legacyActiveSkillLocaleMap.sourceArchiveSha256",
    ),
    reviewedExceptions,
  };
}

export function assertPalworldLegacyPassiveSkillLocaleMap(
  value: unknown,
): PalworldLegacyPassiveSkillLocaleMap {
  const root = recordAt(value, "legacyPassiveSkillLocaleMap", [
    "schemaVersion",
    "activeRelease",
    "candidateId",
    "joinRule",
    "activeCatalogSha256",
    "candidateSkillsSha256",
    "candidateImportReportSha256",
    "sourceArchiveSha256",
    "entries",
  ]);
  if (
    root.schemaVersion !== 1
    || root.joinRule !== PASSIVE_SKILL_MAPPING_JOIN_RULE
  ) {
    fail("legacyPassiveSkillLocaleMap identity가 올바르지 않습니다.");
  }
  let previousIdentity = "";
  const seenCandidates = new Set<string>();
  const entries = arrayAt(
    root.entries,
    "legacyPassiveSkillLocaleMap.entries",
    1_000,
  ).map((input, index) => {
    const entryPath = `legacyPassiveSkillLocaleMap.entries[${index}]`;
    const entry = recordAt(input, entryPath, [
      "legacySkillId",
      "candidateSkillId",
      "candidateSourceRowId",
      "reason",
      "reviewStatus",
    ]);
    const legacySkillId = safeIdAt(entry.legacySkillId, `${entryPath}.legacySkillId`);
    const candidateSkillId = candidateCanonicalIdAt(
      entry.candidateSkillId,
      `${entryPath}.candidateSkillId`,
    );
    const candidateSourceRowId = stringAt(
      entry.candidateSourceRowId,
      `${entryPath}.candidateSourceRowId`,
      192,
    );
    const expectedLegacyIdPrefix =
      `passive-${legacyPublicId(`Passive_${candidateSourceRowId}`).slice(0, 84)}-`;
    const escapedPrefix = expectedLegacyIdPrefix.replace(
      /[.*+?^${}()|[\]\\]/gu,
      "\\$&",
    );
    const identity = `${legacySkillId}\0${candidateSkillId}`;
    if (
      previousIdentity !== ""
      && previousIdentity.localeCompare(identity, "en") >= 0
    ) {
      fail(`${entryPath}가 중복되었거나 정렬되지 않았습니다.`);
    }
    previousIdentity = identity;
    if (
      !new RegExp(`^${escapedPrefix}[a-f0-9]{10}$`, "u").test(legacySkillId)
      || candidateSkillId !== `passive:${candidateSourceRowId}`
      || seenCandidates.has(candidateSkillId)
      || entry.reviewStatus !== "approved"
    ) {
      fail(`${entryPath}의 passive exact mapping이 올바르지 않습니다.`);
    }
    seenCandidates.add(candidateSkillId);
    return {
      legacySkillId,
      candidateSkillId,
      candidateSourceRowId,
      reason: stringAt(entry.reason, `${entryPath}.reason`, 1_000),
      reviewStatus: "approved" as const,
    };
  });
  if (entries.length === 0) {
    fail("legacyPassiveSkillLocaleMap.entries가 비었습니다.");
  }
  return {
    schemaVersion: 1,
    activeRelease: stringAt(
      root.activeRelease,
      "legacyPassiveSkillLocaleMap.activeRelease",
      64,
    ),
    candidateId: stringAt(
      root.candidateId,
      "legacyPassiveSkillLocaleMap.candidateId",
      64,
    ),
    joinRule: PASSIVE_SKILL_MAPPING_JOIN_RULE,
    activeCatalogSha256: sha256At(
      root.activeCatalogSha256,
      "legacyPassiveSkillLocaleMap.activeCatalogSha256",
    ),
    candidateSkillsSha256: sha256At(
      root.candidateSkillsSha256,
      "legacyPassiveSkillLocaleMap.candidateSkillsSha256",
    ),
    candidateImportReportSha256: sha256At(
      root.candidateImportReportSha256,
      "legacyPassiveSkillLocaleMap.candidateImportReportSha256",
    ),
    sourceArchiveSha256: sha256At(
      root.sourceArchiveSha256,
      "legacyPassiveSkillLocaleMap.sourceArchiveSha256",
    ),
    entries,
  };
}

export function assertPalworldActiveSkillLocaleEvidenceArtifact(
  value: unknown,
): PalworldActiveSkillLocaleEvidence {
  const root = recordAt(value, "activeSkillLocaleEvidence", [
    "schemaVersion",
    "release",
    "status",
    "candidateId",
    "joinRule",
    "inputs",
    "counts",
    "reviewedExceptions",
    "entries",
  ]);
  if (
    root.schemaVersion !== 1
    || root.status !== ACTIVE_SKILL_EVIDENCE_STATUS
    || root.joinRule !== ACTIVE_SKILL_MAPPING_JOIN_RULE
  ) {
    fail("activeSkillLocaleEvidence identity가 올바르지 않습니다.");
  }
  const inputs = recordAt(root.inputs, "activeSkillLocaleEvidence.inputs", [
    "activeCatalogSha256",
    "candidateSkillsSha256",
    "candidateImportReportSha256",
    "sourceArchiveSha256",
    "mappingSha256",
  ]);
  const parsedInputs = {
    activeCatalogSha256: sha256At(
      inputs.activeCatalogSha256,
      "activeSkillLocaleEvidence.inputs.activeCatalogSha256",
    ),
    candidateSkillsSha256: sha256At(
      inputs.candidateSkillsSha256,
      "activeSkillLocaleEvidence.inputs.candidateSkillsSha256",
    ),
    candidateImportReportSha256: sha256At(
      inputs.candidateImportReportSha256,
      "activeSkillLocaleEvidence.inputs.candidateImportReportSha256",
    ),
    sourceArchiveSha256: sha256At(
      inputs.sourceArchiveSha256,
      "activeSkillLocaleEvidence.inputs.sourceArchiveSha256",
    ),
    mappingSha256: sha256At(
      inputs.mappingSha256,
      "activeSkillLocaleEvidence.inputs.mappingSha256",
    ),
  };
  const mapping = assertPalworldLegacyActiveSkillLocaleMap({
    schemaVersion: 1,
    activeRelease: root.release,
    candidateId: root.candidateId,
    joinRule: root.joinRule,
    activeCatalogSha256: parsedInputs.activeCatalogSha256,
    candidateSkillsSha256: parsedInputs.candidateSkillsSha256,
    candidateImportReportSha256: parsedInputs.candidateImportReportSha256,
    sourceArchiveSha256: parsedInputs.sourceArchiveSha256,
    reviewedExceptions: root.reviewedExceptions,
  });
  let previousSkill = "";
  let assignmentCount = 0;
  let singleTargetSkills = 0;
  let multiTargetSkills = 0;
  const entries = arrayAt(
    root.entries,
    "activeSkillLocaleEvidence.entries",
    1_000,
  ).map((input, index) => {
    const entryPath = `activeSkillLocaleEvidence.entries[${index}]`;
    const entry = recordAt(input, entryPath, [
      "legacySkillId",
      "candidateSkillIds",
      "guard",
      "legacyStats",
      "candidateStats",
      "localePayloadSha256",
      "assignments",
    ]);
    const legacySkillId = safeIdAt(entry.legacySkillId, `${entryPath}.legacySkillId`);
    if (
      !legacySkillId.startsWith("active-")
      || (previousSkill !== "" && previousSkill.localeCompare(legacySkillId, "en") >= 0)
    ) {
      fail(`${entryPath}.legacySkillId가 중복/비정렬이거나 active ID가 아닙니다.`);
    }
    previousSkill = legacySkillId;
    const candidateSkillIds = arrayAt(
      entry.candidateSkillIds,
      `${entryPath}.candidateSkillIds`,
      16,
    ).map((id, targetIndex) =>
      candidateCanonicalIdAt(id, `${entryPath}.candidateSkillIds[${targetIndex}]`));
    if (
      candidateSkillIds.length === 0
      || new Set(candidateSkillIds).size !== candidateSkillIds.length
      || candidateSkillIds.some((id, targetIndex) =>
        !id.startsWith("active:")
        || (targetIndex > 0
          && candidateSkillIds[targetIndex - 1]!.localeCompare(id, "en") >= 0))
    ) {
      fail(`${entryPath}.candidateSkillIds가 비었거나 중복/비정렬입니다.`);
    }
    if (candidateSkillIds.length === 1) singleTargetSkills += 1;
    else multiTargetSkills += 1;
    if (entry.guard !== "exact_stats" && entry.guard !== "reviewed_exception") {
      fail(`${entryPath}.guard가 올바르지 않습니다.`);
    }
    const legacyStatsRaw = recordAt(entry.legacyStats, `${entryPath}.legacyStats`, [
      "element",
      "power",
      "cooldownSeconds",
    ]);
    const legacyStats = {
      element: stringAt(legacyStatsRaw.element, `${entryPath}.legacyStats.element`, 32),
      power: integerAt(legacyStatsRaw.power, `${entryPath}.legacyStats.power`, 0, 100_000),
      cooldownSeconds: integerAt(
        legacyStatsRaw.cooldownSeconds,
        `${entryPath}.legacyStats.cooldownSeconds`,
        0,
        100_000,
      ),
    };
    let previousCandidateStats = "";
    const candidateStats = arrayAt(
      entry.candidateStats,
      `${entryPath}.candidateStats`,
      16,
    ).map((raw, statsIndex) => {
      const statsPath = `${entryPath}.candidateStats[${statsIndex}]`;
      const stats = recordAt(raw, statsPath, [
        "candidateSkillId",
        "element",
        "power",
        "cooldownSeconds",
      ]);
      const candidateSkillId = candidateCanonicalIdAt(
        stats.candidateSkillId,
        `${statsPath}.candidateSkillId`,
      );
      if (
        previousCandidateStats !== ""
        && previousCandidateStats.localeCompare(candidateSkillId, "en") >= 0
      ) {
        fail(`${statsPath}.candidateSkillId가 중복되었거나 비정렬입니다.`);
      }
      previousCandidateStats = candidateSkillId;
      return {
        candidateSkillId,
        element: stringAt(stats.element, `${statsPath}.element`, 32),
        power: integerAt(stats.power, `${statsPath}.power`, 0, 100_000),
        cooldownSeconds: integerAt(
          stats.cooldownSeconds,
          `${statsPath}.cooldownSeconds`,
          0,
          100_000,
        ),
      };
    });
    if (
      canonicalJson(candidateStats.map((stats) => stats.candidateSkillId))
        !== canonicalJson(candidateSkillIds)
    ) {
      fail(`${entryPath}.candidateStats가 candidateSkillIds와 일치하지 않습니다.`);
    }
    const mismatches = candidateStats.flatMap((stats) => {
      const fields = [] as Array<"element" | "power" | "cooldownSeconds">;
      if (stats.element !== legacyStats.element) fields.push("element");
      if (stats.power !== legacyStats.power) fields.push("power");
      if (stats.cooldownSeconds !== legacyStats.cooldownSeconds) {
        fields.push("cooldownSeconds");
      }
      return fields.map((field) => ({ candidateSkillId: stats.candidateSkillId, field }));
    });
    const exceptions = mapping.reviewedExceptions.filter((exception) =>
      exception.legacySkillId === legacySkillId);
    if (
      (mismatches.length === 0 && entry.guard !== "exact_stats")
      || (mismatches.length > 0 && entry.guard !== "reviewed_exception")
      || mismatches.length !== exceptions.length
      || mismatches.some((mismatch) =>
        !exceptions.some((exception) =>
          exception.candidateSkillId === mismatch.candidateSkillId
          && exception.field === mismatch.field
          && exception.activeValue === legacyStats.power
          && exception.candidateValue
            === candidateStats.find((stats) =>
              stats.candidateSkillId === mismatch.candidateSkillId)!.power))
    ) {
      fail(`${entryPath}.guard와 reviewed exception이 수치 차이와 일치하지 않습니다.`);
    }
    const localePayloadRaw = recordAt(
      entry.localePayloadSha256,
      `${entryPath}.localePayloadSha256`,
      LOCALES,
    );
    const localePayloadSha256 = {
      ko: sha256At(localePayloadRaw.ko, `${entryPath}.localePayloadSha256.ko`),
      ja: sha256At(localePayloadRaw.ja, `${entryPath}.localePayloadSha256.ja`),
    };
    let previousAssignment = "";
    const assignments = arrayAt(
      entry.assignments,
      `${entryPath}.assignments`,
      10_000,
    ).map((raw, assignmentIndex) => {
      const assignmentPath = `${entryPath}.assignments[${assignmentIndex}]`;
      const assignment = recordAt(raw, assignmentPath, [
        "palId",
        "unlockLevel",
        "candidateSkillId",
        "candidateSourceRowId",
      ]);
      const parsed = {
        palId: safeIdAt(assignment.palId, `${assignmentPath}.palId`),
        unlockLevel: integerAt(
          assignment.unlockLevel,
          `${assignmentPath}.unlockLevel`,
          0,
          1_000,
        ),
        candidateSkillId: candidateCanonicalIdAt(
          assignment.candidateSkillId,
          `${assignmentPath}.candidateSkillId`,
        ),
        candidateSourceRowId: stringAt(
          assignment.candidateSourceRowId,
          `${assignmentPath}.candidateSourceRowId`,
          192,
        ),
      };
      const identity = `${parsed.palId}\0${String(parsed.unlockLevel).padStart(4, "0")}`;
      if (previousAssignment !== "" && previousAssignment.localeCompare(identity, "en") >= 0) {
        fail(`${assignmentPath}가 중복되었거나 비정렬입니다.`);
      }
      previousAssignment = identity;
      if (!candidateSkillIds.includes(parsed.candidateSkillId)) {
        fail(`${assignmentPath}.candidateSkillId가 entry target에 없습니다.`);
      }
      return parsed;
    });
    if (assignments.length === 0) fail(`${entryPath}.assignments가 비었습니다.`);
    assignmentCount += assignments.length;
    return {
      legacySkillId,
      candidateSkillIds,
      guard: entry.guard as "exact_stats" | "reviewed_exception",
      legacyStats,
      candidateStats,
      localePayloadSha256,
      assignments,
    };
  });
  const countsRaw = recordAt(root.counts, "activeSkillLocaleEvidence.counts", [
    "activeSkills",
    "assignmentEvidence",
    "singleTargetSkills",
    "multiTargetSkills",
    "reviewedExceptions",
  ]);
  const counts = {
    activeSkills: integerAt(countsRaw.activeSkills, "activeSkillLocaleEvidence.counts.activeSkills"),
    assignmentEvidence: integerAt(
      countsRaw.assignmentEvidence,
      "activeSkillLocaleEvidence.counts.assignmentEvidence",
    ),
    singleTargetSkills: integerAt(
      countsRaw.singleTargetSkills,
      "activeSkillLocaleEvidence.counts.singleTargetSkills",
    ),
    multiTargetSkills: integerAt(
      countsRaw.multiTargetSkills,
      "activeSkillLocaleEvidence.counts.multiTargetSkills",
    ),
    reviewedExceptions: integerAt(
      countsRaw.reviewedExceptions,
      "activeSkillLocaleEvidence.counts.reviewedExceptions",
    ),
  };
  if (
    counts.activeSkills !== entries.length
    || counts.assignmentEvidence !== assignmentCount
    || counts.singleTargetSkills !== singleTargetSkills
    || counts.multiTargetSkills !== multiTargetSkills
    || counts.reviewedExceptions !== mapping.reviewedExceptions.length
    || counts.singleTargetSkills + counts.multiTargetSkills !== counts.activeSkills
  ) {
    fail("activeSkillLocaleEvidence counts가 실제 entries와 일치하지 않습니다.");
  }
  return {
    schemaVersion: 1,
    release: mapping.activeRelease,
    status: ACTIVE_SKILL_EVIDENCE_STATUS,
    candidateId: mapping.candidateId,
    joinRule: ACTIVE_SKILL_MAPPING_JOIN_RULE,
    inputs: parsedInputs,
    counts,
    reviewedExceptions: mapping.reviewedExceptions,
    entries,
  };
}

export function assertPalworldPassiveSkillLocaleEvidenceArtifact(
  value: unknown,
): PalworldPassiveSkillLocaleEvidence {
  const root = recordAt(value, "passiveSkillLocaleEvidence", [
    "schemaVersion",
    "release",
    "status",
    "candidateId",
    "joinRule",
    "inputs",
    "counts",
    "entries",
  ]);
  if (
    root.schemaVersion !== 2
    || root.status !== PASSIVE_SKILL_EVIDENCE_STATUS
    || root.joinRule !== PASSIVE_SKILL_MAPPING_JOIN_RULE
  ) {
    fail("passiveSkillLocaleEvidence identity가 올바르지 않습니다.");
  }
  const inputRoot = recordAt(root.inputs, "passiveSkillLocaleEvidence.inputs", [
    "activeCatalogSha256",
    "candidateSkillsSha256",
    "candidateImportReportSha256",
    "sourceArchiveSha256",
    "mappingSha256",
  ]);
  const inputs = {
    activeCatalogSha256: sha256At(
      inputRoot.activeCatalogSha256,
      "passiveSkillLocaleEvidence.inputs.activeCatalogSha256",
    ),
    candidateSkillsSha256: sha256At(
      inputRoot.candidateSkillsSha256,
      "passiveSkillLocaleEvidence.inputs.candidateSkillsSha256",
    ),
    candidateImportReportSha256: sha256At(
      inputRoot.candidateImportReportSha256,
      "passiveSkillLocaleEvidence.inputs.candidateImportReportSha256",
    ),
    sourceArchiveSha256: sha256At(
      inputRoot.sourceArchiveSha256,
      "passiveSkillLocaleEvidence.inputs.sourceArchiveSha256",
    ),
    mappingSha256: sha256At(
      inputRoot.mappingSha256,
      "passiveSkillLocaleEvidence.inputs.mappingSha256",
    ),
  };
  let previousLegacySkillId = "";
  const seenCandidateSkillIds = new Set<string>();
  const entries = arrayAt(
    root.entries,
    "passiveSkillLocaleEvidence.entries",
    1_000,
  ).map((input, index) => {
    const entryPath = `passiveSkillLocaleEvidence.entries[${index}]`;
    const entry = recordAt(input, entryPath, [
      "legacySkillId",
      "candidateSkillId",
      "candidateSourceRowId",
      "candidateSourceInternalId",
      "expectedLegacyIdPrefix",
      "joinGuard",
      "nameLocalePayloadSha256",
      "effectState",
      "effectsPayloadSha256",
      "effects",
      "description",
    ]);
    const legacySkillId = safeIdAt(entry.legacySkillId, `${entryPath}.legacySkillId`);
    const candidateSkillId = candidateCanonicalIdAt(
      entry.candidateSkillId,
      `${entryPath}.candidateSkillId`,
    );
    const candidateSourceRowId = stringAt(
      entry.candidateSourceRowId,
      `${entryPath}.candidateSourceRowId`,
      192,
    );
    const candidateSourceInternalId = stringAt(
      entry.candidateSourceInternalId,
      `${entryPath}.candidateSourceInternalId`,
      192,
    );
    const expectedLegacyIdPrefix = stringAt(
      entry.expectedLegacyIdPrefix,
      `${entryPath}.expectedLegacyIdPrefix`,
      192,
    );
    const calculatedPrefix =
      `passive-${legacyPublicId(`Passive_${candidateSourceRowId}`).slice(0, 84)}-`;
    const escapedPrefix = calculatedPrefix.replace(
      /[.*+?^${}()|[\]\\]/gu,
      "\\$&",
    );
    if (
      (previousLegacySkillId !== ""
        && previousLegacySkillId.localeCompare(legacySkillId, "en") >= 0)
      || seenCandidateSkillIds.has(candidateSkillId)
      || candidateSkillId !== `passive:${candidateSourceRowId}`
      || candidateSourceInternalId !== candidateSourceRowId
      || expectedLegacyIdPrefix !== calculatedPrefix
      || !new RegExp(`^${escapedPrefix}[a-f0-9]{10}$`, "u").test(legacySkillId)
      || entry.joinGuard !== "legacy_public_id_prefix_exact"
    ) {
      fail(`${entryPath}의 passive exact join evidence가 올바르지 않습니다.`);
    }
    previousLegacySkillId = legacySkillId;
    seenCandidateSkillIds.add(candidateSkillId);
    const nameHashes = recordAt(
      entry.nameLocalePayloadSha256,
      `${entryPath}.nameLocalePayloadSha256`,
      LOCALES,
    );
    const nameLocalePayloadSha256 = {
      ko: sha256At(nameHashes.ko, `${entryPath}.nameLocalePayloadSha256.ko`),
      ja: sha256At(nameHashes.ja, `${entryPath}.nameLocalePayloadSha256.ja`),
    };
    if (
      entry.effectState !== "available"
      && entry.effectState !== "source_mismatch"
    ) {
      fail(`${entryPath}.effectState가 올바르지 않습니다.`);
    }
    const effectState = entry.effectState as
      | "available"
      | "source_mismatch";
    const effects = arrayAt(
      entry.effects,
      `${entryPath}.effects`,
      4,
    ).map((effect, effectIndex): PalworldPassiveEffect => {
      const validated = validatePalworldPassiveEffect(effect);
      if (!validated.ok) {
        fail(
          `${entryPath}.effects[${effectIndex}] Shared 원본 효과 검증에 실패했습니다: `
          + validated.error,
        );
      }
      return validated.data;
    });
    if (effects.length === 0) {
      fail(`${entryPath}.effects에 하나 이상의 원본 효과가 필요합니다.`);
    }
    const effectKeys = effects.map((effect) => `${effect.type}\0${effect.target}`);
    if (new Set(effectKeys).size !== effectKeys.length) {
      fail(`${entryPath}.effects에 중복 type·target 조합이 있습니다.`);
    }
    const effectsPayloadSha256 = sha256At(
      entry.effectsPayloadSha256,
      `${entryPath}.effectsPayloadSha256`,
    );
    if (effectsPayloadSha256 !== sha256(canonicalJson(effects))) {
      fail(`${entryPath}.effectsPayloadSha256가 실제 효과 payload와 일치하지 않습니다.`);
    }
    const descriptionRoot = recordAt(entry.description, `${entryPath}.description`, [
      "status",
      "legacyNumbers",
      "candidateNumbers",
      "localePayloadSha256",
    ]);
    if (
      descriptionRoot.status !== "compatible"
      && descriptionRoot.status !== "missing_source"
      && descriptionRoot.status !== "numeric_mismatch"
    ) {
      fail(`${entryPath}.description.status가 올바르지 않습니다.`);
    }
    const descriptionStatus = descriptionRoot.status as
      | "compatible"
      | "missing_source"
      | "numeric_mismatch";
    const numberArray = (value: unknown, pathName: string): number[] =>
      arrayAt(value, pathName, 64).map((number, numberIndex) =>
        finiteNumberAt(number, `${pathName}[${numberIndex}]`));
    const legacyNumbers = numberArray(
      descriptionRoot.legacyNumbers,
      `${entryPath}.description.legacyNumbers`,
    );
    const candidateNumbersRoot = recordAt(
      descriptionRoot.candidateNumbers,
      `${entryPath}.description.candidateNumbers`,
      LOCALES,
    );
    const candidateNumbers = {
      ko: numberArray(
        candidateNumbersRoot.ko,
        `${entryPath}.description.candidateNumbers.ko`,
      ),
      ja: numberArray(
        candidateNumbersRoot.ja,
        `${entryPath}.description.candidateNumbers.ja`,
      ),
    };
    const numbersMatch = LOCALES.every((locale) =>
      canonicalJson(candidateNumbers[locale]) === canonicalJson(legacyNumbers));
    let localePayloadSha256:
      | Record<PalworldTranslationLocale, string>
      | undefined;
    if (descriptionRoot.localePayloadSha256 !== undefined) {
      const hashes = recordAt(
        descriptionRoot.localePayloadSha256,
        `${entryPath}.description.localePayloadSha256`,
        LOCALES,
      );
      localePayloadSha256 = {
        ko: sha256At(hashes.ko, `${entryPath}.description.localePayloadSha256.ko`),
        ja: sha256At(hashes.ja, `${entryPath}.description.localePayloadSha256.ja`),
      };
    }
    if (
      (descriptionStatus === "compatible"
        && (!numbersMatch || localePayloadSha256 === undefined))
      || (descriptionStatus === "numeric_mismatch"
        && (numbersMatch || localePayloadSha256 !== undefined))
      || (descriptionStatus === "missing_source"
        && localePayloadSha256 !== undefined)
    ) {
      fail(`${entryPath}.description 상태와 수치/hash evidence가 일치하지 않습니다.`);
    }
    const candidateEffectNumbers = effects.map((effect) => effect.value);
    const expectedEffectState =
      descriptionStatus === "numeric_mismatch"
      || (
        descriptionStatus === "missing_source"
        && canonicalJson(candidateEffectNumbers) !== canonicalJson(legacyNumbers)
      )
        ? "source_mismatch"
        : "available";
    if (effectState !== expectedEffectState) {
      fail(`${entryPath}.effectState가 설명·원본 효과 수치 evidence와 일치하지 않습니다.`);
    }
    return {
      legacySkillId,
      candidateSkillId,
      candidateSourceRowId,
      candidateSourceInternalId,
      expectedLegacyIdPrefix,
      joinGuard: "legacy_public_id_prefix_exact" as const,
      nameLocalePayloadSha256,
      effectState,
      effectsPayloadSha256,
      effects,
      description: {
        status: descriptionStatus,
        legacyNumbers,
        candidateNumbers,
        ...(localePayloadSha256 === undefined ? {} : { localePayloadSha256 }),
      },
    };
  });
  const countsRoot = recordAt(root.counts, "passiveSkillLocaleEvidence.counts", [
    "activePassiveSkills",
    "exactMatches",
    "officialNames",
    "compatibleDescriptions",
    "missingSourceDescriptions",
    "numericMismatchDescriptions",
    "compatibleEffects",
    "sourceMismatchEffects",
    "effectRows",
  ]);
  const counts = {
    activePassiveSkills: integerAt(
      countsRoot.activePassiveSkills,
      "passiveSkillLocaleEvidence.counts.activePassiveSkills",
    ),
    exactMatches: integerAt(
      countsRoot.exactMatches,
      "passiveSkillLocaleEvidence.counts.exactMatches",
    ),
    officialNames: integerAt(
      countsRoot.officialNames,
      "passiveSkillLocaleEvidence.counts.officialNames",
    ),
    compatibleDescriptions: integerAt(
      countsRoot.compatibleDescriptions,
      "passiveSkillLocaleEvidence.counts.compatibleDescriptions",
    ),
    missingSourceDescriptions: integerAt(
      countsRoot.missingSourceDescriptions,
      "passiveSkillLocaleEvidence.counts.missingSourceDescriptions",
    ),
    numericMismatchDescriptions: integerAt(
      countsRoot.numericMismatchDescriptions,
      "passiveSkillLocaleEvidence.counts.numericMismatchDescriptions",
    ),
    compatibleEffects: integerAt(
      countsRoot.compatibleEffects,
      "passiveSkillLocaleEvidence.counts.compatibleEffects",
    ),
    sourceMismatchEffects: integerAt(
      countsRoot.sourceMismatchEffects,
      "passiveSkillLocaleEvidence.counts.sourceMismatchEffects",
    ),
    effectRows: integerAt(
      countsRoot.effectRows,
      "passiveSkillLocaleEvidence.counts.effectRows",
    ),
  };
  if (
    counts.activePassiveSkills !== entries.length
    || counts.exactMatches !== entries.length
    || counts.officialNames !== entries.length
    || counts.compatibleDescriptions
      !== entries.filter((entry) => entry.description.status === "compatible").length
    || counts.missingSourceDescriptions
      !== entries.filter((entry) => entry.description.status === "missing_source").length
    || counts.numericMismatchDescriptions
      !== entries.filter((entry) => entry.description.status === "numeric_mismatch").length
    || counts.compatibleEffects
      !== entries.filter((entry) => entry.effectState === "available").length
    || counts.sourceMismatchEffects
      !== entries.filter((entry) => entry.effectState === "source_mismatch").length
    || counts.effectRows
      !== entries.reduce((sum, entry) => sum + entry.effects.length, 0)
    || counts.compatibleDescriptions
      + counts.missingSourceDescriptions
      + counts.numericMismatchDescriptions !== entries.length
    || counts.compatibleEffects + counts.sourceMismatchEffects !== entries.length
  ) {
    fail("passiveSkillLocaleEvidence counts가 실제 entries와 일치하지 않습니다.");
  }
  return {
    schemaVersion: 2,
    release: stringAt(root.release, "passiveSkillLocaleEvidence.release", 64),
    status: PASSIVE_SKILL_EVIDENCE_STATUS,
    candidateId: stringAt(
      root.candidateId,
      "passiveSkillLocaleEvidence.candidateId",
      64,
    ),
    joinRule: PASSIVE_SKILL_MAPPING_JOIN_RULE,
    inputs,
    counts,
    entries,
  };
}

export function assertPalworldOfficialLocaleSourceFieldsArtifact(
  value: unknown,
): PalworldOfficialLocaleSourceFieldsArtifact {
  const root = recordAt(value, "officialSourceFields", [
    "schemaVersion",
    "release",
    "status",
    "scope",
    "candidateId",
    "sourceCatalogSha256",
    "sourcePaldexSha256",
    "candidateLocaleSha256",
    "records",
    "counts",
  ]);
  if (
    root.schemaVersion !== OVERLAY_SCHEMA_VERSION
    || root.status !== OVERLAY_STATUS
    || root.scope !== OVERLAY_SCOPE
  ) {
    fail("officialSourceFields identity가 올바르지 않습니다.");
  }
  const localeSha = recordAt(
    root.candidateLocaleSha256,
    "officialSourceFields.candidateLocaleSha256",
    LOCALES,
  );
  const seen = new Set<string>();
  let previousIdentity = "";
  const records = arrayAt(
    root.records,
    "officialSourceFields.records",
    100_000,
  ).map((input, index): PalworldOfficialLocaleSourceField => {
    const entryPath = `officialSourceFields.records[${index}]`;
    const record = recordAt(input, entryPath, [
      "locale",
      "kind",
      "id",
      "field",
      "activeSourceInternalId",
      "candidateCanonicalId",
      "candidateSourceInternalId",
      "sourceIdentityJoinRule",
      "joinRule",
      "messageKey",
      "text",
      "textSha256",
      "status",
      "richTextStatus",
      "sourceMember",
      "sourceMemberSha256",
    ]);
    const locale = localeAt(record.locale, `${entryPath}.locale`);
    const kind = kindAt(record.kind, `${entryPath}.kind`);
    const id = safeIdAt(record.id, `${entryPath}.id`);
    const field = fieldAt(record.field, `${entryPath}.field`);
    if (kind !== "skill" && field === "passiveAbility") {
      fail(`${entryPath}.field passiveAbility는 skill에만 허용됩니다.`);
    }
    const candidateCanonicalId = candidateCanonicalIdAt(
      record.candidateCanonicalId,
      `${entryPath}.candidateCanonicalId`,
    );
    const sourceIdentityJoinRule = record.sourceIdentityJoinRule;
    if (
      sourceIdentityJoinRule !== "source_internal_id_exact"
      && sourceIdentityJoinRule !== "versioned_alias_exact"
      && sourceIdentityJoinRule !== "assignment_identity_exact"
      && sourceIdentityJoinRule !== "legacy_public_id_prefix_exact"
    ) {
      fail(`${entryPath}.sourceIdentityJoinRule이 올바르지 않습니다.`);
    }
    if (
      record.joinRule !== JOIN_RULE
      && record.joinRule !== PARTNER_JOIN_RULE
      && record.joinRule !== ACTIVE_SKILL_JOIN_RULE
      && record.joinRule !== PASSIVE_SKILL_JOIN_RULE
    ) {
      fail(`${entryPath}.joinRule이 올바르지 않습니다.`);
    }
    if (
      record.joinRule === PARTNER_JOIN_RULE
      && (
        kind !== "skill"
        || !id.startsWith("partner-")
        || candidateCanonicalId !== `partner:${id.slice("partner-".length)}`
      )
    ) {
      fail(`${entryPath}.joinRule과 partner canonical ID가 일치하지 않습니다.`);
    }
    if (
      record.joinRule === JOIN_RULE
      && candidateCanonicalId !== id
    ) {
      fail(`${entryPath}.candidateCanonicalId는 active canonical ID와 같아야 합니다.`);
    }
    if (
      record.joinRule === ACTIVE_SKILL_JOIN_RULE
      && (
        kind !== "skill"
        || !id.startsWith("active-")
        || !candidateCanonicalId.startsWith("active:")
        || sourceIdentityJoinRule !== "assignment_identity_exact"
      )
    ) {
      fail(`${entryPath}.joinRule과 legacy active assignment identity가 일치하지 않습니다.`);
    }
    if (
      record.joinRule === PASSIVE_SKILL_JOIN_RULE
      && (
        kind !== "skill"
        || !id.startsWith("passive-")
        || !candidateCanonicalId.startsWith("passive:")
        || sourceIdentityJoinRule !== "legacy_public_id_prefix_exact"
      )
    ) {
      fail(`${entryPath}.joinRule과 legacy passive exact mapping이 일치하지 않습니다.`);
    }
    const messageKey = stringAt(record.messageKey, `${entryPath}.messageKey`, 192);
    if (!SAFE_MESSAGE_KEY_PATTERN.test(messageKey)) {
      fail(`${entryPath}.messageKey 형식이 올바르지 않습니다.`);
    }
    const text = stringAt(record.text, `${entryPath}.text`, 65_536, false);
    const textSha256 = sha256At(record.textSha256, `${entryPath}.textSha256`);
    if (sha256(text) !== textSha256) fail(`${entryPath}.textSha256가 일치하지 않습니다.`);
    if (record.status !== "source_provided" || record.richTextStatus !== "resolved") {
      fail(`${entryPath}는 resolved source_provided여야 합니다.`);
    }
    const identity = `${locale}:${kind}:${id}:${field}`;
    if (
      seen.has(identity)
      || (previousIdentity !== "" && previousIdentity.localeCompare(identity, "en") >= 0)
    ) {
      fail(`${entryPath}가 중복되었거나 정렬되지 않았습니다.`);
    }
    seen.add(identity);
    previousIdentity = identity;
    return {
      locale,
      kind,
      id,
      field,
      activeSourceInternalId: stringAt(
        record.activeSourceInternalId,
        `${entryPath}.activeSourceInternalId`,
        192,
      ),
      candidateCanonicalId,
      candidateSourceInternalId: stringAt(
        record.candidateSourceInternalId,
        `${entryPath}.candidateSourceInternalId`,
        192,
      ),
      sourceIdentityJoinRule,
      joinRule: record.joinRule,
      messageKey,
      text,
      textSha256,
      status: "source_provided",
      richTextStatus: "resolved",
      sourceMember: safeSourceMemberAt(
        record.sourceMember,
        `${entryPath}.sourceMember`,
      ),
      sourceMemberSha256: sha256At(
        record.sourceMemberSha256,
        `${entryPath}.sourceMemberSha256`,
      ),
    };
  });
  const countsRoot = recordAt(root.counts, "officialSourceFields.counts", [
    "total",
    "byLocale",
    "byKind",
    "byField",
  ]);
  const countGroups = {
    byLocale: {
      keys: LOCALES,
      value: countsRoot.byLocale,
      count: (record: PalworldOfficialLocaleSourceField, key: string) =>
        record.locale === key,
    },
    byKind: {
      keys: KINDS,
      value: countsRoot.byKind,
      count: (record: PalworldOfficialLocaleSourceField, key: string) =>
        record.kind === key,
    },
    byField: {
      keys: FIELDS,
      value: countsRoot.byField,
      count: (record: PalworldOfficialLocaleSourceField, key: string) =>
        record.field === key,
    },
  } as const;
  const parsedCounts = {} as {
    byLocale: Record<PalworldTranslationLocale, number>;
    byKind: Record<PalworldTranslationRecordKind, number>;
    byField: Record<PalworldTranslationField, number>;
  };
  for (const [groupName, group] of Object.entries(countGroups)) {
    const valueRecord = recordAt(
      group.value,
      `officialSourceFields.counts.${groupName}`,
      group.keys,
    );
    const target: Record<string, number> = {};
    for (const key of group.keys) {
      const count = integerAt(
        valueRecord[key],
        `officialSourceFields.counts.${groupName}.${key}`,
      );
      const actual = records.filter((record) => group.count(record, key)).length;
      if (count !== actual) {
        fail(`officialSourceFields.counts.${groupName}.${key}가 일치하지 않습니다.`);
      }
      target[key] = count;
    }
    (parsedCounts as unknown as Record<string, unknown>)[groupName] = target;
  }
  const total = integerAt(countsRoot.total, "officialSourceFields.counts.total");
  if (total !== records.length) fail("officialSourceFields.counts.total이 일치하지 않습니다.");
  return {
    schemaVersion: 1,
    release: stringAt(root.release, "officialSourceFields.release", 64),
    status: OVERLAY_STATUS,
    scope: OVERLAY_SCOPE,
    candidateId: stringAt(root.candidateId, "officialSourceFields.candidateId", 64),
    sourceCatalogSha256: sha256At(
      root.sourceCatalogSha256,
      "officialSourceFields.sourceCatalogSha256",
    ),
    sourcePaldexSha256: sha256At(
      root.sourcePaldexSha256,
      "officialSourceFields.sourcePaldexSha256",
    ),
    candidateLocaleSha256: {
      ko: sha256At(localeSha.ko, "officialSourceFields.candidateLocaleSha256.ko"),
      ja: sha256At(localeSha.ja, "officialSourceFields.candidateLocaleSha256.ja"),
    },
    records,
    counts: {
      total,
      byLocale: parsedCounts.byLocale,
      byKind: parsedCounts.byKind,
      byField: parsedCounts.byField,
    },
  };
}

export function assertPalworldOfficialLocaleManifest(
  value: unknown,
): PalworldOfficialLocaleManifest {
  return activeManifestAt(value);
}

function buildCoverage(
  snapshot: PalworldTranslationSnapshot,
  corpus: ActiveCorpus,
): PalworldOfficialLocaleCoverageArtifact {
  const translated = new Map<string, PalworldTranslationFieldValue>();
  for (const record of snapshot.records) {
    for (const [field, value] of Object.entries(record.fields) as Array<[
      PalworldTranslationField,
      PalworldTranslationFieldValue,
    ]>) {
      translated.set(`${record.kind}:${record.id}:${field}`, value);
    }
  }
  const sourceFieldKeys = new Set(
    corpus.records.flatMap((record) =>
      Object.keys(record.fields).map((field) =>
        `${record.kind}:${record.id}:${field}`)),
  );
  for (const [key, value] of translated) {
    if (value.status === "source_provided") sourceFieldKeys.add(key);
  }
  const byKind = Object.fromEntries(KINDS.map((kind) => {
    return [kind, Object.fromEntries(FIELDS.map((field) => [
      field,
      {
        translated: [...sourceFieldKeys].filter((key) =>
          key.startsWith(`${kind}:`)
          && key.endsWith(`:${field}`)
          && translated.has(key)).length,
        total: [...sourceFieldKeys].filter((key) =>
          key.startsWith(`${kind}:`) && key.endsWith(`:${field}`)).length,
      },
    ]))];
  })) as PalworldOfficialLocaleCoverageArtifact["coverage"]["byKind"];
  const total = sourceFieldKeys.size;
  const status = {
    source_provided: 0,
    human_reviewed: 0,
    machine_assisted: 0,
  };
  for (const value of translated.values()) status[value.status] += 1;
  return {
    schemaVersion: 1,
    release: snapshot.release,
    locale: snapshot.locale,
    sourceCatalogSha256: snapshot.sourceCatalogSha256,
    sourcePaldexSha256: snapshot.sourcePaldexSha256,
    translationRevision: snapshot.translationRevision,
    translationStatus: snapshot.translationStatus,
    coverage: {
      byKind,
      translated: translated.size,
      total,
      missing: total - translated.size,
      status,
    },
    contentSha256: sha256(canonicalJson(snapshot.records)),
  };
}

export function assertPalworldOfficialLocaleCoverageArtifact(
  value: unknown,
  expected?: {
    snapshot: PalworldTranslationSnapshot;
    corpus: ActiveCorpus;
  },
): PalworldOfficialLocaleCoverageArtifact {
  const root = recordAt(value, "officialLocaleCoverage", [
    "schemaVersion",
    "release",
    "locale",
    "sourceCatalogSha256",
    "sourcePaldexSha256",
    "translationRevision",
    "translationStatus",
    "coverage",
    "contentSha256",
  ]);
  if (root.schemaVersion !== 1) fail("officialLocaleCoverage.schemaVersion은 1이어야 합니다.");
  if (root.translationStatus !== "complete" && root.translationStatus !== "incomplete") {
    fail("officialLocaleCoverage.translationStatus가 올바르지 않습니다.");
  }
  const coverageRoot = recordAt(root.coverage, "officialLocaleCoverage.coverage", [
    "byKind",
    "translated",
    "total",
    "missing",
    "status",
  ]);
  const byKindRoot = recordAt(
    coverageRoot.byKind,
    "officialLocaleCoverage.coverage.byKind",
    KINDS,
  );
  const byKind = {} as PalworldOfficialLocaleCoverageArtifact["coverage"]["byKind"];
  for (const kind of KINDS) {
    const fields = recordAt(
      byKindRoot[kind],
      `officialLocaleCoverage.coverage.byKind.${kind}`,
      FIELDS,
    );
    byKind[kind] = {} as PalworldOfficialLocaleCoverageArtifact["coverage"]["byKind"][typeof kind];
    for (const field of FIELDS) {
      const count = recordAt(
        fields[field],
        `officialLocaleCoverage.coverage.byKind.${kind}.${field}`,
        ["translated", "total"],
      );
      const translated = integerAt(
        count.translated,
        `officialLocaleCoverage.coverage.byKind.${kind}.${field}.translated`,
      );
      const total = integerAt(
        count.total,
        `officialLocaleCoverage.coverage.byKind.${kind}.${field}.total`,
      );
      if (translated > total) fail("officialLocaleCoverage translated가 total보다 큽니다.");
      byKind[kind][field] = { translated, total };
    }
  }
  const statusRoot = recordAt(
    coverageRoot.status,
    "officialLocaleCoverage.coverage.status",
    ["source_provided", "human_reviewed", "machine_assisted"],
  );
  const translated = integerAt(
    coverageRoot.translated,
    "officialLocaleCoverage.coverage.translated",
  );
  const total = integerAt(coverageRoot.total, "officialLocaleCoverage.coverage.total");
  const missing = integerAt(
    coverageRoot.missing,
    "officialLocaleCoverage.coverage.missing",
  );
  const status = {
    source_provided: integerAt(
      statusRoot.source_provided,
      "officialLocaleCoverage.coverage.status.source_provided",
    ),
    human_reviewed: integerAt(
      statusRoot.human_reviewed,
      "officialLocaleCoverage.coverage.status.human_reviewed",
    ),
    machine_assisted: integerAt(
      statusRoot.machine_assisted,
      "officialLocaleCoverage.coverage.status.machine_assisted",
    ),
  };
  if (
    translated + missing !== total
    || Object.values(status).reduce((sum, count) => sum + count, 0) !== translated
    || Object.values(byKind).reduce(
      (sum, fields) =>
        sum + Object.values(fields).reduce((fieldSum, count) => fieldSum + count.total, 0),
      0,
    ) !== total
  ) {
    fail("officialLocaleCoverage 집계가 일치하지 않습니다.");
  }
  const artifact: PalworldOfficialLocaleCoverageArtifact = {
    schemaVersion: 1,
    release: stringAt(root.release, "officialLocaleCoverage.release", 64),
    locale: localeAt(root.locale, "officialLocaleCoverage.locale"),
    sourceCatalogSha256: sha256At(
      root.sourceCatalogSha256,
      "officialLocaleCoverage.sourceCatalogSha256",
    ),
    sourcePaldexSha256: sha256At(
      root.sourcePaldexSha256,
      "officialLocaleCoverage.sourcePaldexSha256",
    ),
    translationRevision: stringAt(
      root.translationRevision,
      "officialLocaleCoverage.translationRevision",
      256,
    ),
    translationStatus: root.translationStatus,
    coverage: { byKind, translated, total, missing, status },
    contentSha256: sha256At(
      root.contentSha256,
      "officialLocaleCoverage.contentSha256",
    ),
  };
  if (expected !== undefined) {
    const rebuilt = buildCoverage(expected.snapshot, expected.corpus);
    if (canonicalJson(artifact) !== canonicalJson(rebuilt)) {
      fail("officialLocaleCoverage가 snapshot/corpus 집계와 일치하지 않습니다.");
    }
  }
  return artifact;
}

export type PalworldOfficialLocaleCompatibilityExpectedOutputs = {
  officialSourceFields: string | Uint8Array;
  activeSkillEvidence?: string | Uint8Array;
  passiveSkillEvidence?: string | Uint8Array;
  ko: string | Uint8Array;
  ja: string | Uint8Array;
  manifest: string | Uint8Array;
};

export function assertPalworldOfficialLocaleCompatibilityArtifact(
  value: unknown,
  expectedOutputs?: PalworldOfficialLocaleCompatibilityExpectedOutputs,
): PalworldOfficialLocaleCompatibilityArtifact {
  const root = recordAt(value, "officialLocaleCompatibility", [
    "schemaVersion",
    "release",
    "status",
    "scope",
    "reviewedAt",
    "reviewer",
    "evidenceChecksum",
    "usageBasis",
    "rightsVerified",
    "candidateRuntimeActivationGranted",
    "fuzzyMatchingUsed",
    "inputs",
    "outputs",
    "counts",
  ]);
  if (
    root.schemaVersion !== OVERLAY_SCHEMA_VERSION
    || root.status !== OVERLAY_STATUS
    || root.scope !== OVERLAY_SCOPE
    || root.usageBasis !== "operator_reference_use"
    || root.rightsVerified !== false
    || root.candidateRuntimeActivationGranted !== false
    || root.fuzzyMatchingUsed !== false
  ) {
    fail("officialLocaleCompatibility 안전 상태가 올바르지 않습니다.");
  }
  const reviewer = stringAt(root.reviewer, "officialLocaleCompatibility.reviewer", 64);
  if (!SAFE_REVIEWER_PATTERN.test(reviewer)) {
    fail("officialLocaleCompatibility.reviewer 형식이 올바르지 않습니다.");
  }
  const inputs = recordAt(root.inputs, "officialLocaleCompatibility.inputs", [
    "active",
    "candidate",
  ]);
  const active = recordAt(inputs.active, "officialLocaleCompatibility.inputs.active", [
    "catalogSha256",
    "paldexSha256",
    "corpusSha256",
    "localeSha256",
    "glossarySha256",
    "sourceRevision",
    "translationRevision",
  ]);
  const activeLocale = recordAt(
    active.localeSha256,
    "officialLocaleCompatibility.inputs.active.localeSha256",
    LOCALES,
  );
  const candidate = recordAt(
    inputs.candidate,
    "officialLocaleCompatibility.inputs.candidate",
    [
      "candidateId",
      "activationEligible",
      "activationBlockers",
      "artifactSha256",
      "sourceArchives",
      "archive",
      "mappings",
      "activeSkillLocaleMapSha256",
      "passiveSkillLocaleMapSha256",
    ],
  );
  if (candidate.activationEligible !== false) {
    fail("officialLocaleCompatibility candidate activationEligible는 false여야 합니다.");
  }
  const activationBlockers = arrayAt(
    candidate.activationBlockers,
    "officialLocaleCompatibility.inputs.candidate.activationBlockers",
    100,
  ).map((entry, index) =>
    stringAt(
      entry,
      `officialLocaleCompatibility.inputs.candidate.activationBlockers[${index}]`,
      128,
    ));
  if (
    activationBlockers.length === 0
    || new Set(activationBlockers).size !== activationBlockers.length
    || [...activationBlockers].sort((left, right) =>
      left.localeCompare(right, "en")).some((entry, index) =>
      entry !== activationBlockers[index])
  ) {
    fail("officialLocaleCompatibility activationBlockers가 비었거나 중복/비정렬입니다.");
  }
  const artifactShaInput = recordAt(
    candidate.artifactSha256,
    "officialLocaleCompatibility.inputs.candidate.artifactSha256",
    [
      "runtimeManifest",
      "importReport",
      "sourceLock",
      "paldex",
      "items",
      "skills",
      "localeKo",
      "localeJa",
    ],
  );
  const artifactSha256 = {
    runtimeManifest: sha256At(artifactShaInput.runtimeManifest, "artifactSha256.runtimeManifest"),
    importReport: sha256At(artifactShaInput.importReport, "artifactSha256.importReport"),
    sourceLock: sha256At(artifactShaInput.sourceLock, "artifactSha256.sourceLock"),
    paldex: sha256At(artifactShaInput.paldex, "artifactSha256.paldex"),
    items: sha256At(artifactShaInput.items, "artifactSha256.items"),
    skills: sha256At(artifactShaInput.skills, "artifactSha256.skills"),
    localeKo: sha256At(artifactShaInput.localeKo, "artifactSha256.localeKo"),
    localeJa: sha256At(artifactShaInput.localeJa, "artifactSha256.localeJa"),
  };
  const sourceArchives = arrayAt(
    candidate.sourceArchives,
    "officialLocaleCompatibility.inputs.candidate.sourceArchives",
    8,
  ).map((input, index) => {
    const entry = recordAt(
      input,
      `officialLocaleCompatibility.inputs.candidate.sourceArchives[${index}]`,
      ["role", "sha256", "bytes"],
    );
    if (entry.role !== "primary" && entry.role !== "asset_overlay") {
      fail(`officialLocaleCompatibility sourceArchives[${index}].role이 올바르지 않습니다.`);
    }
    const role = entry.role as "primary" | "asset_overlay";
    return {
      role,
      sha256: sha256At(entry.sha256, `sourceArchives[${index}].sha256`),
      bytes: integerAt(entry.bytes, `sourceArchives[${index}].bytes`, 1, 8 * 1024 * 1024 * 1024),
    };
  });
  if (
    sourceArchives.filter((entry) => entry.role === "primary").length !== 1
    || sourceArchives.filter((entry) => entry.role === "asset_overlay").length > 1
    || sourceArchives.some((entry, index) =>
      index > 0 && sourceArchives[index - 1]!.role.localeCompare(entry.role, "en") >= 0)
  ) {
    fail("officialLocaleCompatibility sourceArchives role이 중복되었거나 비정렬입니다.");
  }
  const archiveInput = recordAt(
    candidate.archive,
    "officialLocaleCompatibility.inputs.candidate.archive",
    ["sha256", "bytes", "fileCount"],
  );
  const archive = {
    sha256: sha256At(archiveInput.sha256, "candidate.archive.sha256"),
    bytes: integerAt(archiveInput.bytes, "candidate.archive.bytes", 1, 8 * 1024 * 1024 * 1024),
    fileCount: integerAt(archiveInput.fileCount, "candidate.archive.fileCount", 1, 1_000_000),
  };
  const primary = sourceArchives.find((entry) => entry.role === "primary");
  if (primary?.sha256 !== archive.sha256 || primary.bytes !== archive.bytes) {
    fail("officialLocaleCompatibility archive와 primary source가 일치하지 않습니다.");
  }
  const mappingInput = recordAt(
    candidate.mappings,
    "officialLocaleCompatibility.inputs.candidate.mappings",
    [
      "aliases",
      "elementIconMap",
      "exclusions",
      "legacySkillCatalog",
      "palIconOverrides",
      "publicActiveSkillAllowlist",
      "publicIdExtensions",
      "publicIdMap",
      "skillIconMap",
      "workIconMap",
    ],
  );
  const mappings: Record<string, string> = {};
  let previousMappingKey = "";
  for (const key of Object.keys(mappingInput)) {
    if (previousMappingKey !== "" && previousMappingKey.localeCompare(key, "en") >= 0) {
      fail("officialLocaleCompatibility mappings는 key 오름차순이어야 합니다.");
    }
    previousMappingKey = key;
    mappings[key] = sha256At(mappingInput[key], `candidate.mappings.${key}`);
  }
  const outputs = recordAt(root.outputs, "officialLocaleCompatibility.outputs", [
    "officialSourceFieldsSha256",
    "activeSkillEvidenceSha256",
    "passiveSkillEvidenceSha256",
    "localeSha256",
    "manifestSha256",
    "translationRevision",
  ]);
  const outputLocale = recordAt(
    outputs.localeSha256,
    "officialLocaleCompatibility.outputs.localeSha256",
    LOCALES,
  );
  const parsedOutputs = {
    officialSourceFieldsSha256: sha256At(
      outputs.officialSourceFieldsSha256,
      "outputs.officialSourceFieldsSha256",
    ),
    ...(outputs.activeSkillEvidenceSha256 === undefined
      ? {}
      : {
          activeSkillEvidenceSha256: sha256At(
            outputs.activeSkillEvidenceSha256,
            "outputs.activeSkillEvidenceSha256",
          ),
        }),
    ...(outputs.passiveSkillEvidenceSha256 === undefined
      ? {}
      : {
          passiveSkillEvidenceSha256: sha256At(
            outputs.passiveSkillEvidenceSha256,
            "outputs.passiveSkillEvidenceSha256",
          ),
        }),
    localeSha256: {
      ko: sha256At(outputLocale.ko, "outputs.localeSha256.ko"),
      ja: sha256At(outputLocale.ja, "outputs.localeSha256.ja"),
    },
    manifestSha256: sha256At(outputs.manifestSha256, "outputs.manifestSha256"),
    translationRevision: stringAt(
      outputs.translationRevision,
      "outputs.translationRevision",
      256,
    ),
  };
  if (
    (candidate.activeSkillLocaleMapSha256 === undefined)
      !== (parsedOutputs.activeSkillEvidenceSha256 === undefined)
  ) {
    fail("active skill locale map과 evidence checksum은 함께 있어야 합니다.");
  }
  if (
    (candidate.passiveSkillLocaleMapSha256 === undefined)
      !== (parsedOutputs.passiveSkillEvidenceSha256 === undefined)
  ) {
    fail("passive skill locale map과 evidence checksum은 함께 있어야 합니다.");
  }
  if (expectedOutputs !== undefined) {
    if (
      (expectedOutputs.activeSkillEvidence === undefined)
        !== (parsedOutputs.activeSkillEvidenceSha256 === undefined)
    ) {
      fail("검증 대상 active skill evidence bytes가 compatibility와 일치하지 않습니다.");
    }
    if (
      (expectedOutputs.passiveSkillEvidence === undefined)
        !== (parsedOutputs.passiveSkillEvidenceSha256 === undefined)
    ) {
      fail("검증 대상 passive skill evidence bytes가 compatibility와 일치하지 않습니다.");
    }
    const expectedHashes = {
      officialSourceFieldsSha256: sha256(expectedOutputs.officialSourceFields),
      ...(expectedOutputs.activeSkillEvidence === undefined
        ? {}
        : { activeSkillEvidenceSha256: sha256(expectedOutputs.activeSkillEvidence) }),
      ...(expectedOutputs.passiveSkillEvidence === undefined
        ? {}
        : { passiveSkillEvidenceSha256: sha256(expectedOutputs.passiveSkillEvidence) }),
      localeSha256: {
        ko: sha256(expectedOutputs.ko),
        ja: sha256(expectedOutputs.ja),
      },
      manifestSha256: sha256(expectedOutputs.manifest),
    };
    if (
      parsedOutputs.officialSourceFieldsSha256
        !== expectedHashes.officialSourceFieldsSha256
      || parsedOutputs.activeSkillEvidenceSha256
        !== expectedHashes.activeSkillEvidenceSha256
      || parsedOutputs.passiveSkillEvidenceSha256
        !== expectedHashes.passiveSkillEvidenceSha256
      || parsedOutputs.localeSha256.ko !== expectedHashes.localeSha256.ko
      || parsedOutputs.localeSha256.ja !== expectedHashes.localeSha256.ja
      || parsedOutputs.manifestSha256 !== expectedHashes.manifestSha256
    ) {
      fail("officialLocaleCompatibility output checksum이 실제 bytes와 일치하지 않습니다.");
    }
  }
  const countsRoot = recordAt(root.counts, "officialLocaleCompatibility.counts", [
    "officialExactResolved",
    "officialUnresolved",
    "officialUnjoined",
    "humanReviewedPreserved",
    "humanReviewedSuperseded",
    "machineAssistedExcluded",
    "sourceProvidedExcluded",
    "outputRecords",
  ]);
  const counts = {} as PalworldOfficialLocaleCompatibilityArtifact["counts"];
  for (const key of [
    "officialExactResolved",
    "officialUnresolved",
    "officialUnjoined",
    "humanReviewedPreserved",
    "humanReviewedSuperseded",
    "machineAssistedExcluded",
    "sourceProvidedExcluded",
    "outputRecords",
  ] as const) {
    const values = recordAt(countsRoot[key], `counts.${key}`, LOCALES);
    counts[key] = {
      ko: integerAt(values.ko, `counts.${key}.ko`),
      ja: integerAt(values.ja, `counts.${key}.ja`),
    };
  }
  return {
    schemaVersion: 1,
    release: stringAt(root.release, "officialLocaleCompatibility.release", 64),
    status: OVERLAY_STATUS,
    scope: OVERLAY_SCOPE,
    reviewedAt: strictTimestampAt(
      root.reviewedAt,
      "officialLocaleCompatibility.reviewedAt",
    ),
    reviewer,
    evidenceChecksum: sha256At(
      root.evidenceChecksum,
      "officialLocaleCompatibility.evidenceChecksum",
    ),
    usageBasis: "operator_reference_use",
    rightsVerified: false,
    candidateRuntimeActivationGranted: false,
    fuzzyMatchingUsed: false,
    inputs: {
      active: {
        catalogSha256: sha256At(active.catalogSha256, "active.catalogSha256"),
        paldexSha256: sha256At(active.paldexSha256, "active.paldexSha256"),
        corpusSha256: sha256At(active.corpusSha256, "active.corpusSha256"),
        localeSha256: {
          ko: sha256At(activeLocale.ko, "active.localeSha256.ko"),
          ja: sha256At(activeLocale.ja, "active.localeSha256.ja"),
        },
        glossarySha256: sha256At(active.glossarySha256, "active.glossarySha256"),
        sourceRevision: stringAt(active.sourceRevision, "active.sourceRevision", 256),
        translationRevision: stringAt(
          active.translationRevision,
          "active.translationRevision",
          256,
        ),
      },
      candidate: {
        candidateId: stringAt(candidate.candidateId, "candidate.candidateId", 64),
        activationEligible: false,
        activationBlockers,
        artifactSha256,
        sourceArchives,
        archive,
        mappings,
        ...(candidate.activeSkillLocaleMapSha256 === undefined
          ? {}
          : {
              activeSkillLocaleMapSha256: sha256At(
                candidate.activeSkillLocaleMapSha256,
                "candidate.activeSkillLocaleMapSha256",
              ),
            }),
        ...(candidate.passiveSkillLocaleMapSha256 === undefined
          ? {}
          : {
              passiveSkillLocaleMapSha256: sha256At(
                candidate.passiveSkillLocaleMapSha256,
                "candidate.passiveSkillLocaleMapSha256",
              ),
            }),
      },
    },
    outputs: parsedOutputs,
    counts,
  };
}

export function serializePalworldOfficialLocaleOverlayArtifact(
  value:
    | PalworldOfficialLocaleSourceFieldsArtifact
    | PalworldActiveSkillLocaleEvidence
    | PalworldPassiveSkillLocaleEvidence
    | PalworldOfficialLocaleCompatibilityArtifact
    | PalworldOfficialLocaleCoverageArtifact
    | PalworldOfficialLocaleManifest
    | PalworldTranslationSnapshot,
): string {
  const valueRecord = value as unknown as JsonRecord;
  if (
    isRecord(valueRecord)
    && valueRecord.status === ACTIVE_SKILL_EVIDENCE_STATUS
    && Object.hasOwn(valueRecord, "entries")
    && valueRecord.joinRule === ACTIVE_SKILL_MAPPING_JOIN_RULE
  ) {
    return canonicalJson(assertPalworldActiveSkillLocaleEvidenceArtifact(value));
  }
  if (
    isRecord(valueRecord)
    && valueRecord.status === PASSIVE_SKILL_EVIDENCE_STATUS
    && Object.hasOwn(valueRecord, "entries")
    && valueRecord.joinRule === PASSIVE_SKILL_MAPPING_JOIN_RULE
  ) {
    return canonicalJson(assertPalworldPassiveSkillLocaleEvidenceArtifact(value));
  }
  if (
    isRecord(valueRecord)
    && valueRecord.scope === OVERLAY_SCOPE
    && Object.hasOwn(valueRecord, "candidateId")
  ) {
    return canonicalJson(assertPalworldOfficialLocaleSourceFieldsArtifact(value));
  }
  if (
    isRecord(valueRecord)
    && valueRecord.scope === OVERLAY_SCOPE
    && Object.hasOwn(valueRecord, "reviewer")
  ) {
    return canonicalJson(assertPalworldOfficialLocaleCompatibilityArtifact(value));
  }
  if (isRecord(valueRecord) && Object.hasOwn(valueRecord, "locales")) {
    return canonicalJson(assertPalworldOfficialLocaleManifest(value));
  }
  if (isRecord(valueRecord) && Object.hasOwn(valueRecord, "coverage")) {
    return canonicalJson(assertPalworldOfficialLocaleCoverageArtifact(value));
  }
  return canonicalJson(assertPalworldTranslationSnapshot(value));
}

function officialSourceFieldForShared(
  record: PalworldOfficialLocaleSourceField,
): PalworldTranslationOfficialSourceField {
  return {
    locale: record.locale,
    kind: record.kind,
    id: record.id,
    field: record.field,
    messageKey: record.messageKey,
    text: record.text,
    textSha256: record.textSha256,
    sourceMember: record.sourceMember,
    sourceMemberSha256: record.sourceMemberSha256,
  };
}

function candidateArtifactHashesAt(
  runtimeManifest: JsonRecord,
): ReadonlyMap<string, { sha256: string; bytes: number }> {
  return sortedUniqueMap(
    arrayAt(runtimeManifest.artifacts, "candidate.runtimeManifest.artifacts", 100)
      .map((input, index) => {
        const record = recordAt(
          input,
          `candidate.runtimeManifest.artifacts[${index}]`,
          ["file", "sha256", "bytes"],
        );
        return {
          file: stringAt(
            record.file,
            `candidate.runtimeManifest.artifacts[${index}].file`,
            128,
          ),
          sha256: sha256At(
            record.sha256,
            `candidate.runtimeManifest.artifacts[${index}].sha256`,
          ),
          bytes: integerAt(
            record.bytes,
            `candidate.runtimeManifest.artifacts[${index}].bytes`,
            1,
            128 * 1024 * 1024,
          ),
        };
      }),
    (entry) => entry.file,
    "candidate.runtimeManifest.artifacts",
  );
}

function activeEntityMaps(
  catalog: PalworldCatalogArtifact,
  paldex: PalworldPaldexArtifact,
): {
  activePalById: ReadonlyMap<string, PalworldTranslationActiveEntity>;
  activeItemById: ReadonlyMap<string, PalworldTranslationActiveEntity>;
  activeSkillById: ReadonlyMap<string, PalworldTranslationActiveEntity>;
} {
  return {
    activePalById: sortedUniqueMap(
      paldex.records.map((record) => ({
        id: record.id,
        sourceInternalId: record.sourceInternalId,
      })),
      (record) => record.id,
      "active.paldex.records",
    ),
    activeItemById: sortedUniqueMap(
      catalog.items.map((record) => ({
        id: record.id,
        sourceInternalId: record.sourceInternalId,
      })),
      (record) => record.id,
      "active.catalog.items",
    ),
    activeSkillById: sortedUniqueMap(
      catalog.skills.map((record) => ({
        id: record.id,
        type: record.type,
      })),
      (record) => record.id,
      "active.catalog.skills",
    ),
  };
}

function candidateEntityInfo(input: {
  kind: PalworldTranslationRecordKind;
  id: string;
  activePalById: ReadonlyMap<string, PalworldTranslationActiveEntity>;
  activeItemById: ReadonlyMap<string, PalworldTranslationActiveEntity>;
  candidatePalById: ReadonlyMap<string, PalworldTranslationCandidateEntity>;
  candidateItemById: ReadonlyMap<string, PalworldTranslationCandidateEntity>;
  candidateSkillById: ReadonlyMap<string, PalworldTranslationCandidateEntity>;
  activeSkillCompatibilityByLegacyId: ReadonlyMap<string, {
    candidates: readonly CandidateActiveSkill[];
  }>;
  passiveSkillCompatibilityByLegacyId: ReadonlyMap<string, {
    candidate: CandidatePassiveSkill;
    descriptionCompatible: boolean;
  }>;
  aliasApplications: readonly PalworldTranslationReviewJsonRecord[];
}): {
  activeSourceInternalId: string;
  candidateCanonicalId: string;
  candidateSourceInternalId: string;
  sourceIdentityJoinRule: OfficialSourceIdentityJoinRule;
  joinRule: OfficialJoinRule;
} | undefined {
  if (input.kind === "pal" || input.kind === "item") {
    const active = input.kind === "pal"
      ? input.activePalById.get(input.id)
      : input.activeItemById.get(input.id);
    const candidate = input.kind === "pal"
      ? input.candidatePalById.get(input.id)
      : input.candidateItemById.get(input.id);
    if (active?.sourceInternalId === undefined || candidate === undefined) return undefined;
    const sourceIdentityJoinRule = palworldTranslationSourceIdentityJoinRule(
      active.sourceInternalId,
      candidate.sourceInternalId,
      input.aliasApplications,
    );
    if (sourceIdentityJoinRule === undefined) return undefined;
    return {
      activeSourceInternalId: active.sourceInternalId,
      candidateCanonicalId: candidate.id,
      candidateSourceInternalId: candidate.sourceInternalId,
      sourceIdentityJoinRule,
      joinRule: JOIN_RULE,
    };
  }
  if (input.id.startsWith("active-")) {
    const resolution = input.activeSkillCompatibilityByLegacyId.get(input.id);
    const candidate = resolution?.candidates[0];
    if (candidate === undefined) return undefined;
    return {
      activeSourceInternalId: input.id,
      candidateCanonicalId: candidate.id,
      candidateSourceInternalId: candidate.sourceInternalId,
      sourceIdentityJoinRule: "assignment_identity_exact",
      joinRule: ACTIVE_SKILL_JOIN_RULE,
    };
  }
  if (input.id.startsWith("passive-")) {
    const resolution = input.passiveSkillCompatibilityByLegacyId.get(input.id);
    if (resolution === undefined) return undefined;
    return {
      activeSourceInternalId: input.id,
      candidateCanonicalId: resolution.candidate.id,
      candidateSourceInternalId: resolution.candidate.sourceInternalId,
      sourceIdentityJoinRule: "legacy_public_id_prefix_exact",
      joinRule: PASSIVE_SKILL_JOIN_RULE,
    };
  }
  if (!input.id.startsWith("partner-")) return undefined;
  const palId = input.id.slice("partner-".length);
  if (!SAFE_ID_PATTERN.test(palId)) return undefined;
  const activePal = input.activePalById.get(palId);
  const candidate = input.candidateSkillById.get(`partner:${palId}`);
  if (
    activePal?.sourceInternalId === undefined
    || candidate?.type !== "partner"
    || candidate.relatedPalIds?.length !== 1
    || candidate.relatedPalIds[0] !== palId
  ) {
    return undefined;
  }
  const sourceIdentityJoinRule = palworldTranslationSourceIdentityJoinRule(
    activePal.sourceInternalId,
    candidate.sourceInternalId,
    input.aliasApplications,
  );
  if (sourceIdentityJoinRule === undefined) return undefined;
  return {
    activeSourceInternalId: activePal.sourceInternalId,
    candidateCanonicalId: candidate.id,
    candidateSourceInternalId: candidate.sourceInternalId,
    sourceIdentityJoinRule,
    joinRule: PARTNER_JOIN_RULE,
  };
}

export async function buildPalworldOfficialLocaleOverlay(
  options: BuildPalworldOfficialLocaleOverlayOptions,
): Promise<PalworldOfficialLocaleOverlayArtifacts> {
  const reviewedAt = strictTimestampAt(options.reviewedAt, "options.reviewedAt");
  const reviewer = stringAt(options.reviewer, "options.reviewer", 64);
  if (!SAFE_REVIEWER_PATTERN.test(reviewer)) fail("options.reviewer 형식이 올바르지 않습니다.");
  const evidenceChecksum = sha256At(
    options.evidenceChecksum,
    "options.evidenceChecksum",
  );
  if (/^0{64}$/u.test(evidenceChecksum)) fail("options.evidenceChecksum은 0 hash일 수 없습니다.");

  const activeReleaseRoot = path.resolve(options.activeReleaseRoot);
  const candidateRoot = path.resolve(options.candidateRoot);
  const [
    activeCatalogFile,
    activePaldexFile,
    activeCorpusFile,
    activeKoFile,
    activeJaFile,
    activeManifestFile,
    activeGlossaryFile,
    candidatePaldexFile,
    candidateItemsFile,
    candidateSkillsFile,
    candidateKoFile,
    candidateJaFile,
    candidateReportFile,
    candidateSourceLockFile,
    candidateRuntimeManifestFile,
    activeSkillMappingFile,
    passiveSkillMappingFile,
  ] = await Promise.all([
    readJsonFile(path.join(activeReleaseRoot, "catalog.json")),
    readJsonFile(path.join(activeReleaseRoot, "paldex.json")),
    readJsonFile(path.join(activeReleaseRoot, "locales", "corpus.json")),
    readJsonFile(path.join(activeReleaseRoot, "locales", "ko.json")),
    readJsonFile(path.join(activeReleaseRoot, "locales", "ja.json")),
    readJsonFile(path.join(activeReleaseRoot, "locales", "manifest.json")),
    readJsonFile(path.join(activeReleaseRoot, "locales", "glossary.json")),
    readJsonFile(path.join(candidateRoot, "paldex.json")),
    readJsonFile(path.join(candidateRoot, "items.json")),
    readJsonFile(path.join(candidateRoot, "skills.json")),
    readJsonFile(path.join(candidateRoot, "locales", "ko.json")),
    readJsonFile(path.join(candidateRoot, "locales", "ja.json")),
    readJsonFile(path.join(candidateRoot, "import-report.json")),
    readJsonFile(path.join(candidateRoot, "source-lock.json")),
    readJsonFile(path.join(candidateRoot, "runtime-manifest.candidate.json")),
    readJsonFile(path.resolve(options.activeSkillMappingFile)),
    readJsonFile(path.resolve(options.passiveSkillMappingFile)),
  ]);

  const catalog = assertPalworldCatalogArtifact(activeCatalogFile.raw);
  const paldex = assertPalworldPaldexArtifact(activePaldexFile.raw);
  const corpus = activeCorpusAt(activeCorpusFile.raw);
  const activeManifest = activeManifestAt(activeManifestFile.raw);
  const activeSnapshots = {
    ko: assertPalworldTranslationSnapshot(activeKoFile.raw),
    ja: assertPalworldTranslationSnapshot(activeJaFile.raw),
  };
  if (
    catalog.release !== paldex.release
    || corpus.release !== catalog.release
    || activeManifest.release !== catalog.release
    || activeSnapshots.ko.release !== catalog.release
    || activeSnapshots.ja.release !== catalog.release
    || activeManifest.sourceCatalogSha256 !== activeCatalogFile.sha256
    || activeManifest.sourcePaldexSha256 !== activePaldexFile.sha256
    || corpus.sourceCatalogSha256 !== activeCatalogFile.sha256
    || corpus.sourcePaldexSha256 !== activePaldexFile.sha256
    || corpus.sourceRevision !== catalog.metadata.sourceRevision
    || activeManifest.sourceRevision !== catalog.metadata.sourceRevision
    || activeManifest.locales.ko.sha256 !== activeKoFile.sha256
    || activeManifest.locales.ja.sha256 !== activeJaFile.sha256
    || activeManifest.glossarySha256 !== activeGlossaryFile.sha256
  ) {
    fail("active release의 catalog/Paldex/corpus/locale manifest checksum이 일치하지 않습니다.");
  }
  for (const locale of LOCALES) {
    const snapshot = activeSnapshots[locale];
    const expectedFile = locale === "ko" ? activeKoFile : activeJaFile;
    if (
      snapshot.locale !== locale
      || snapshot.sourceCatalogSha256 !== activeCatalogFile.sha256
      || snapshot.sourcePaldexSha256 !== activePaldexFile.sha256
      || snapshot.sourceRevision !== catalog.metadata.sourceRevision
      || snapshot.translationRevision !== activeManifest.translationRevision
      || snapshot.records.length !== activeManifest.locales[locale].recordCount
      || expectedFile.sha256 !== activeManifest.locales[locale].sha256
    ) {
      fail(`active ${locale} locale identity가 manifest와 일치하지 않습니다.`);
    }
  }

  const candidateId = stringAt(
    candidateReportFile.raw.candidateId,
    "candidate.importReport.candidateId",
    64,
  );
  const candidateRelease = candidateReportFile.raw.release === null
    ? null
    : stringAt(candidateReportFile.raw.release, "candidate.importReport.release", 64);
  const candidateContext = { candidateId, release: candidateRelease };
  const candidateReport = assertPalworldPakCandidateArtifact(
    "import-report.json",
    candidateReportFile.raw,
    candidateContext,
  ) as JsonRecord;
  const candidatePaldex = assertPalworldPakCandidateArtifact(
    "paldex.json",
    candidatePaldexFile.raw,
    candidateContext,
  ) as JsonRecord;
  const candidateItems = assertPalworldPakCandidateArtifact(
    "items.json",
    candidateItemsFile.raw,
    candidateContext,
  ) as JsonRecord;
  const candidateSkills = assertPalworldPakCandidateArtifact(
    "skills.json",
    candidateSkillsFile.raw,
    candidateContext,
  ) as JsonRecord;
  const candidateLocales = {
    ko: assertPalworldPakCandidateArtifact(
      "locales/ko.json",
      candidateKoFile.raw,
      candidateContext,
    ) as JsonRecord,
    ja: assertPalworldPakCandidateArtifact(
      "locales/ja.json",
      candidateJaFile.raw,
      candidateContext,
    ) as JsonRecord,
  };
  const candidateSourceLock = assertPalworldPakCandidateArtifact(
    "source-lock.json",
    candidateSourceLockFile.raw,
    candidateContext,
  ) as JsonRecord;
  const candidateRuntimeManifest = assertPalworldPakBlockedCandidateManifest(
    candidateRuntimeManifestFile.raw,
  ) as unknown as JsonRecord;
  if (
    candidateReport.activationEligible !== false
    || candidateRuntimeManifest.activationEligible !== false
  ) {
    fail("이 overlay는 activation blocker가 있는 candidate에만 사용할 수 있습니다.");
  }
  const activationBlockers = arrayAt(
    candidateReport.blockers,
    "candidate.importReport.blockers",
    100,
  ).map((entry, index) =>
    stringAt(entry, `candidate.importReport.blockers[${index}]`, 128))
    .sort((left, right) => left.localeCompare(right, "en"));
  const runtimeBlockers = arrayAt(
    candidateRuntimeManifest.blockers,
    "candidate.runtimeManifest.blockers",
    100,
  ).map((entry, index) =>
    stringAt(entry, `candidate.runtimeManifest.blockers[${index}]`, 128))
    .sort((left, right) => left.localeCompare(right, "en"));
  if (
    activationBlockers.length === 0
    || JSON.stringify(activationBlockers) !== JSON.stringify(runtimeBlockers)
  ) {
    fail("candidate import report와 runtime manifest blocker가 일치하지 않습니다.");
  }

  const sourceLock = sourceLockAt(candidateSourceLock);
  if (sourceLock.candidateId !== candidateId || sourceLock.release !== candidateRelease) {
    fail("candidate source lock identity가 일치하지 않습니다.");
  }
  const activeSkillMapping = assertPalworldLegacyActiveSkillLocaleMap(
    activeSkillMappingFile.raw,
  );
  const passiveSkillMapping = assertPalworldLegacyPassiveSkillLocaleMap(
    passiveSkillMappingFile.raw,
  );
  const runtimeArtifactHashes = candidateArtifactHashesAt(candidateRuntimeManifest);
  const candidateFiles: Record<string, FileInput> = {
    "import-report.json": candidateReportFile,
    "source-lock.json": candidateSourceLockFile,
    "paldex.json": candidatePaldexFile,
    "items.json": candidateItemsFile,
    "skills.json": candidateSkillsFile,
    "locales/ko.json": candidateKoFile,
    "locales/ja.json": candidateJaFile,
  };
  for (const [fileName, file] of Object.entries(candidateFiles)) {
    const expected = runtimeArtifactHashes.get(fileName);
    if (expected?.sha256 !== file.sha256 || expected.bytes !== file.bytes.length) {
      fail(`candidate runtime manifest artifact가 실제 파일과 일치하지 않습니다: ${fileName}`);
    }
  }
  const runtimeMappings = recordAt(
    candidateRuntimeManifest.mappingChecksums,
    "candidate.runtimeManifest.mappingChecksums",
    Object.keys(sourceLock.mappings),
  );
  for (const [key, value] of Object.entries(sourceLock.mappings)) {
    if (runtimeMappings[key] !== value) {
      fail(`candidate mapping checksum이 일치하지 않습니다: ${key}`);
    }
  }

  for (const locale of LOCALES) {
    if (
      candidateLocales[locale].status !== "source_provided"
      || candidateLocales[locale].languageVerified !== true
      || candidateLocales[locale].sourceArchiveSha256 !== sourceLock.archive.sha256
    ) {
      fail(`candidate ${locale} 공식 locale source 상태가 올바르지 않습니다.`);
    }
  }
  const provenance = isRecord(candidateReport.provenance)
    ? candidateReport.provenance
    : fail("candidate import-report provenance가 없습니다.");
  const includedFiles = sortedUniqueMap(
    arrayAt(provenance.includedFiles, "candidate.provenance.includedFiles")
      .map((input, index) => {
        const record = recordAt(
          input,
          `candidate.provenance.includedFiles[${index}]`,
          ["member", "sha256", "bytes"],
        );
        return {
          member: safeSourceMemberAt(
            record.member,
            `candidate.provenance.includedFiles[${index}].member`,
          ),
          sha256: sha256At(
            record.sha256,
            `candidate.provenance.includedFiles[${index}].sha256`,
          ),
        };
      }),
    (entry) => entry.member,
    "candidate.provenance.includedFiles",
  );
  const candidateLocaleRecords = {
    ko: candidateLocaleRecordsAt(candidateLocales.ko.records, "candidate.ko.records"),
    ja: candidateLocaleRecordsAt(candidateLocales.ja.records, "candidate.ja.records"),
  };
  for (const locale of LOCALES) {
    for (const record of candidateLocaleRecords[locale]) {
      if (includedFiles.get(record.sourceMember)?.sha256 !== record.sourceMemberSha256) {
        fail(`candidate ${locale} source member hash가 provenance와 일치하지 않습니다.`);
      }
    }
  }

  const activeMaps = activeEntityMaps(catalog, paldex);
  const aliasApplications = arrayAt(
    candidateReport.aliasApplications,
    "candidate.importReport.aliasApplications",
    10_000,
  ).map((entry, index) =>
    isRecord(entry)
      ? entry
      : fail(`candidate.importReport.aliasApplications[${index}]가 객체가 아닙니다.`));
  const candidateMaps = {
    candidatePalById: sortedUniqueMap(
      candidateEntitiesAt(candidatePaldex.records, "candidate.paldex.records"),
      (record) => record.id,
      "candidate.paldex.records",
    ),
    candidateItemById: sortedUniqueMap(
      candidateEntitiesAt(candidateItems.records, "candidate.items.records"),
      (record) => record.id,
      "candidate.items.records",
    ),
    candidateSkillById: sortedUniqueMap(
      candidateEntitiesAt(candidateSkills.records, "candidate.skills.records"),
      (record) => record.id,
      "candidate.skills.records",
    ),
  };
  const localeByKey = {
    ko: sortedUniqueMap(
      candidateLocaleRecords.ko,
      (record) => `${record.field}:${record.messageKey}`,
      "candidate.ko.records",
    ),
    ja: sortedUniqueMap(
      candidateLocaleRecords.ja,
      (record) => `${record.field}:${record.messageKey}`,
      "candidate.ja.records",
    ),
  };
  const activeSkillResolution = buildActiveSkillLocaleResolution({
    catalog,
    candidateSkills,
    candidateId,
    sourceArchiveSha256: sourceLock.archive.sha256,
    activeCatalogSha256: activeCatalogFile.sha256,
    candidateSkillsSha256: candidateSkillsFile.sha256,
    candidateImportReportSha256: candidateReportFile.sha256,
    mapping: activeSkillMapping,
    mappingSha256: activeSkillMappingFile.sha256,
    localeByKey,
  });
  const passiveSkillResolution = buildPassiveSkillLocaleResolution({
    catalog,
    candidateSkills,
    candidateId,
    sourceArchiveSha256: sourceLock.archive.sha256,
    activeCatalogSha256: activeCatalogFile.sha256,
    candidateSkillsSha256: candidateSkillsFile.sha256,
    candidateImportReportSha256: candidateReportFile.sha256,
    mapping: passiveSkillMapping,
    mappingSha256: passiveSkillMappingFile.sha256,
    localeByKey,
  });
  const lookupSources = {
    ...activeMaps,
    ...candidateMaps,
    activeSkillCompatibilityByLegacyId:
      activeSkillResolution.byLegacySkillId,
    passiveSkillCompatibilityByLegacyId:
      passiveSkillResolution.byLegacySkillId,
    aliasApplications,
  };
  const officialRecords: PalworldOfficialLocaleSourceField[] = [];
  const officialUnresolved = { ko: 0, ja: 0 };
  const officialUnjoined = { ko: 0, ja: 0 };
  for (const sourceRecord of corpus.records) {
    for (const field of Object.keys(sourceRecord.fields) as PalworldTranslationField[]) {
      const activeSkillCandidate = sourceRecord.kind === "skill"
        && sourceRecord.id.startsWith("active-")
        ? activeSkillResolution.byLegacySkillId
            .get(sourceRecord.id)?.candidates[0]
        : undefined;
      const passiveSkillResolutionEntry = sourceRecord.kind === "skill"
        && sourceRecord.id.startsWith("passive-")
        ? passiveSkillResolution.byLegacySkillId.get(sourceRecord.id)
        : undefined;
      const localized = activeSkillCandidate !== undefined
        ? field === "name"
          ? activeSkillCandidate.name
          : field === "description"
            ? activeSkillCandidate.description
            : undefined
        : passiveSkillResolutionEntry !== undefined
          ? field === "name"
            ? passiveSkillResolutionEntry.candidate.name
            : field === "description"
              && passiveSkillResolutionEntry.descriptionCompatible
              ? passiveSkillResolutionEntry.candidate.description
              : undefined
          : palworldTranslationLocalizedValueFor(
              sourceRecord.kind,
              sourceRecord.id,
              field,
              lookupSources,
            );
      const entityInfo = candidateEntityInfo({
        kind: sourceRecord.kind,
        id: sourceRecord.id,
        ...activeMaps,
        ...candidateMaps,
        activeSkillCompatibilityByLegacyId:
          activeSkillResolution.byLegacySkillId,
        passiveSkillCompatibilityByLegacyId:
          passiveSkillResolution.byLegacySkillId,
        aliasApplications,
      });
      if (localized === undefined || entityInfo === undefined) {
        for (const locale of LOCALES) officialUnjoined[locale] += 1;
        continue;
      }
      for (const locale of LOCALES) {
        const official = palworldTranslationOfficialLocaleValue(
          localized,
          locale,
          localeByKey[locale],
          true,
        );
        if (official === undefined) {
          const localeRecord = localeByKey[locale]
            .get(`${localized.sourceField}:${localized.messageKey}`);
          const localeStatus = localized[`${locale}Status`];
          const localeText = localized[locale];
          const richTextStatus = localized[`${locale}RichTextStatus`] ?? "resolved";
          if (
            localeStatus === "source_provided"
            && typeof localeText === "string"
            && localeText.length > 0
            && localeRecord !== undefined
            && richTextStatus !== "resolved"
          ) {
            officialUnresolved[locale] += 1;
          } else {
            officialUnjoined[locale] += 1;
          }
          continue;
        }
        officialRecords.push({
          locale,
          kind: sourceRecord.kind,
          id: sourceRecord.id,
          field,
          ...entityInfo,
          messageKey: localized.messageKey,
          text: official.text,
          textSha256: official.valueSha256,
          status: "source_provided",
          richTextStatus: "resolved",
          sourceMember: official.sourceMember,
          sourceMemberSha256: official.sourceMemberSha256,
        });
      }
    }
  }
  // Legacy catalog에 영문 설명 필드가 없어 기존 corpus가 만들지 못한 partner
  // 설명도 candidate의 exact Pal/sourceInternalId join과 양쪽 공식 locale member
  // checksum이 모두 검증된 경우에만 source_provided로 추가합니다. candidate 전체
  // runtime을 활성화하거나 표시 이름으로 연결하지 않습니다.
  for (const skill of catalog.skills) {
    if (
      skill.type !== "partner"
      || skill.descriptionEn !== undefined
      || !skill.id.startsWith("partner-")
    ) {
      continue;
    }
    const palId = skill.id.slice("partner-".length);
    const candidate = candidateMaps.candidateSkillById.get(`partner:${palId}`);
    const localized = candidate?.description;
    const entityInfo = candidateEntityInfo({
      kind: "skill",
      id: skill.id,
      ...activeMaps,
      ...candidateMaps,
      activeSkillCompatibilityByLegacyId:
        activeSkillResolution.byLegacySkillId,
      passiveSkillCompatibilityByLegacyId:
        passiveSkillResolution.byLegacySkillId,
      aliasApplications,
    });
    if (localized === undefined || entityInfo === undefined) continue;
    const officialByLocale = Object.fromEntries(
      LOCALES.map((locale) => [
        locale,
        palworldTranslationOfficialLocaleValue(
          localized,
          locale,
          localeByKey[locale],
          true,
        ),
      ]),
    ) as Record<
      PalworldTranslationLocale,
      ReturnType<typeof palworldTranslationOfficialLocaleValue>
    >;
    if (LOCALES.some((locale) => officialByLocale[locale] === undefined)) {
      continue;
    }
    for (const locale of LOCALES) {
      const official = officialByLocale[locale]!;
      officialRecords.push({
        locale,
        kind: "skill",
        id: skill.id,
        field: "description",
        ...entityInfo,
        messageKey: localized.messageKey,
        text: official.text,
        textSha256: official.valueSha256,
        status: "source_provided",
        richTextStatus: "resolved",
        sourceMember: official.sourceMember,
        sourceMemberSha256: official.sourceMemberSha256,
      });
    }
  }
  officialRecords.sort((left, right) =>
    `${left.locale}:${left.kind}:${left.id}:${left.field}`.localeCompare(
      `${right.locale}:${right.kind}:${right.id}:${right.field}`,
      "en",
    ));
  const officialSourceFields: PalworldOfficialLocaleSourceFieldsArtifact = {
    schemaVersion: 1,
    release: catalog.release,
    status: OVERLAY_STATUS,
    scope: OVERLAY_SCOPE,
    candidateId,
    sourceCatalogSha256: activeCatalogFile.sha256,
    sourcePaldexSha256: activePaldexFile.sha256,
    candidateLocaleSha256: {
      ko: candidateKoFile.sha256,
      ja: candidateJaFile.sha256,
    },
    records: officialRecords,
    counts: {
      total: officialRecords.length,
      byLocale: {
        ko: officialRecords.filter((record) => record.locale === "ko").length,
        ja: officialRecords.filter((record) => record.locale === "ja").length,
      },
      byKind: {
        pal: officialRecords.filter((record) => record.kind === "pal").length,
        item: officialRecords.filter((record) => record.kind === "item").length,
        skill: officialRecords.filter((record) => record.kind === "skill").length,
      },
      byField: {
        name: officialRecords.filter((record) => record.field === "name").length,
        description: officialRecords.filter((record) => record.field === "description").length,
        passiveAbility: officialRecords.filter(
          (record) => record.field === "passiveAbility",
        ).length,
      },
    },
  };
  const validatedOfficialSourceFields =
    assertPalworldOfficialLocaleSourceFieldsArtifact(officialSourceFields);
  const officialSourceFieldsText = canonicalJson(validatedOfficialSourceFields);
  const officialSourceFieldsSha256 = sha256(officialSourceFieldsText);
  const activeSkillEvidenceText = canonicalJson(activeSkillResolution.evidence);
  const activeSkillEvidenceSha256 = sha256(activeSkillEvidenceText);
  const passiveSkillEvidenceText = canonicalJson(passiveSkillResolution.evidence);
  const passiveSkillEvidenceSha256 = sha256(passiveSkillEvidenceText);
  const translationRevision =
    `official-locale-overlay-${officialSourceFieldsSha256.slice(0, 16)}`
    + `-${evidenceChecksum.slice(0, 8)}`;

  const sourceRecords: PalworldTranslationSourceRecord[] = corpus.records.map((record) => ({
    id: record.id,
    kind: record.kind,
    fields: Object.fromEntries(
      Object.entries(record.fields).map(([field, source]) => [
        field,
        {
          text: source!.sourceText,
          sha256: source!.sourceSha256,
        },
      ]),
    ),
  }));
  const sharedOfficialFields = officialRecords.map(officialSourceFieldForShared);
  const snapshots = {} as Record<PalworldTranslationLocale, PalworldTranslationSnapshot>;
  const humanReviewedPreserved = { ko: 0, ja: 0 };
  const humanReviewedSuperseded = { ko: 0, ja: 0 };
  const machineAssistedExcluded = { ko: 0, ja: 0 };
  const sourceProvidedExcluded = { ko: 0, ja: 0 };
  for (const locale of LOCALES) {
    const fieldsByRecord = new Map<string, {
      id: string;
      kind: PalworldTranslationRecordKind;
      fields: Partial<Record<PalworldTranslationField, PalworldTranslationFieldValue>>;
    }>();
    const existingHumanFields = new Set<string>();
    for (const record of activeSnapshots[locale].records) {
      for (const [field, value] of Object.entries(record.fields) as Array<[
        PalworldTranslationField,
        PalworldTranslationFieldValue,
      ]>) {
        if (value.status === "machine_assisted") {
          machineAssistedExcluded[locale] += 1;
          continue;
        }
        if (value.status === "source_provided") {
          sourceProvidedExcluded[locale] += 1;
          continue;
        }
        const identity = `${record.kind}:${record.id}`;
        const target = fieldsByRecord.get(identity) ?? {
          id: record.id,
          kind: record.kind,
          fields: {},
        };
        target.fields[field] = { ...value };
        fieldsByRecord.set(identity, target);
        existingHumanFields.add(`${identity}:${field}`);
      }
    }
    for (const official of officialRecords.filter((record) => record.locale === locale)) {
      const identity = `${official.kind}:${official.id}`;
      const fieldIdentity = `${identity}:${official.field}`;
      const target = fieldsByRecord.get(identity) ?? {
        id: official.id,
        kind: official.kind,
        fields: {},
      };
      if (existingHumanFields.delete(fieldIdentity)) {
        humanReviewedSuperseded[locale] += 1;
      }
      target.fields[official.field] = {
        sourceSha256: official.textSha256,
        sourceMessageKey: official.messageKey,
        sourceMember: official.sourceMember,
        sourceMemberSha256: official.sourceMemberSha256,
        text: official.text,
        status: "source_provided",
      };
      fieldsByRecord.set(identity, target);
    }
    humanReviewedPreserved[locale] = existingHumanFields.size;
    const records = [...fieldsByRecord.values()]
      .filter((record) => Object.keys(record.fields).length > 0)
      .sort((left, right) =>
        `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`, "en"))
      .map((record): PalworldTranslationRecord => ({
        id: record.id,
        kind: record.kind,
        fields: Object.fromEntries(
          FIELDS.flatMap((field) =>
            record.fields[field] === undefined
              ? []
              : [[field, record.fields[field]]]),
        ),
      }));
    const statusCounts = records
      .flatMap((record) => Object.values(record.fields))
      .reduce((result, field) => {
        if (field !== undefined) result.add(field.status);
        return result;
      }, new Set<string>());
    const translationMethod = statusCounts.size > 1
      ? "mixed"
      : statusCounts.has("source_provided")
        ? "source_provided"
        : "human_reviewed";
    const snapshot: PalworldTranslationSnapshot = {
      schemaVersion: 1,
      release: catalog.release,
      locale,
      sourceCatalogSha256: activeCatalogFile.sha256,
      sourcePaldexSha256: activePaldexFile.sha256,
      sourceRevision: catalog.metadata.sourceRevision,
      translationRevision,
      translationMethod,
      translationStatus: "incomplete",
      translatedAt: reviewedAt,
      reviewedAt,
      records,
    };
    snapshots[locale] = assertPalworldTranslationSnapshot(snapshot, {
      release: catalog.release,
      sourceCatalogSha256: activeCatalogFile.sha256,
      sourcePaldexSha256: activePaldexFile.sha256,
      sourceRevision: catalog.metadata.sourceRevision,
      records: sourceRecords,
      officialSourceFields: sharedOfficialFields,
    });
  }

  const snapshotTexts = {
    ko: canonicalJson(snapshots.ko),
    ja: canonicalJson(snapshots.ja),
  };
  const coverage = {
    ko: assertPalworldOfficialLocaleCoverageArtifact(
      buildCoverage(snapshots.ko, corpus),
      { snapshot: snapshots.ko, corpus },
    ),
    ja: assertPalworldOfficialLocaleCoverageArtifact(
      buildCoverage(snapshots.ja, corpus),
      { snapshot: snapshots.ja, corpus },
    ),
  };
  const manifest: PalworldOfficialLocaleManifest = {
    schemaVersion: 1,
    release: catalog.release,
    sourceCatalogSha256: activeCatalogFile.sha256,
    sourcePaldexSha256: activePaldexFile.sha256,
    glossarySha256: activeGlossaryFile.sha256,
    sourceRevision: catalog.metadata.sourceRevision,
    translationRevision,
    generatedAt: reviewedAt,
    locales: {
      ko: {
        file: "ko.json",
        sha256: sha256(snapshotTexts.ko),
        recordCount: snapshots.ko.records.length,
      },
      ja: {
        file: "ja.json",
        sha256: sha256(snapshotTexts.ja),
        recordCount: snapshots.ja.records.length,
      },
    },
  };
  const validatedManifest = assertPalworldOfficialLocaleManifest(manifest);
  const manifestText = canonicalJson(validatedManifest);

  const compatibility: PalworldOfficialLocaleCompatibilityArtifact = {
    schemaVersion: 1,
    release: catalog.release,
    status: OVERLAY_STATUS,
    scope: OVERLAY_SCOPE,
    reviewedAt,
    reviewer,
    evidenceChecksum,
    usageBasis: "operator_reference_use",
    rightsVerified: false,
    candidateRuntimeActivationGranted: false,
    fuzzyMatchingUsed: false,
    inputs: {
      active: {
        catalogSha256: activeCatalogFile.sha256,
        paldexSha256: activePaldexFile.sha256,
        corpusSha256: activeCorpusFile.sha256,
        localeSha256: {
          ko: activeKoFile.sha256,
          ja: activeJaFile.sha256,
        },
        glossarySha256: activeGlossaryFile.sha256,
        sourceRevision: catalog.metadata.sourceRevision,
        translationRevision: activeManifest.translationRevision,
      },
      candidate: {
        candidateId,
        activationEligible: false,
        activationBlockers,
        artifactSha256: {
          runtimeManifest: candidateRuntimeManifestFile.sha256,
          importReport: candidateReportFile.sha256,
          sourceLock: candidateSourceLockFile.sha256,
          paldex: candidatePaldexFile.sha256,
          items: candidateItemsFile.sha256,
          skills: candidateSkillsFile.sha256,
          localeKo: candidateKoFile.sha256,
          localeJa: candidateJaFile.sha256,
        },
        sourceArchives: [...sourceLock.sourceArchives]
          .sort((left, right) => left.role.localeCompare(right.role, "en")),
        archive: sourceLock.archive,
        mappings: sourceLock.mappings,
        activeSkillLocaleMapSha256: activeSkillMappingFile.sha256,
        passiveSkillLocaleMapSha256: passiveSkillMappingFile.sha256,
      },
    },
    outputs: {
      officialSourceFieldsSha256,
      activeSkillEvidenceSha256,
      passiveSkillEvidenceSha256,
      localeSha256: {
        ko: sha256(snapshotTexts.ko),
        ja: sha256(snapshotTexts.ja),
      },
      manifestSha256: sha256(manifestText),
      translationRevision,
    },
    counts: {
      officialExactResolved: {
        ko: officialRecords.filter((record) => record.locale === "ko").length,
        ja: officialRecords.filter((record) => record.locale === "ja").length,
      },
      officialUnresolved,
      officialUnjoined,
      humanReviewedPreserved,
      humanReviewedSuperseded,
      machineAssistedExcluded,
      sourceProvidedExcluded,
      outputRecords: {
        ko: snapshots.ko.records.length,
        ja: snapshots.ja.records.length,
      },
    },
  };
  const validatedCompatibility =
    assertPalworldOfficialLocaleCompatibilityArtifact(compatibility, {
      officialSourceFields: officialSourceFieldsText,
      activeSkillEvidence: activeSkillEvidenceText,
      passiveSkillEvidence: passiveSkillEvidenceText,
      ko: snapshotTexts.ko,
      ja: snapshotTexts.ja,
      manifest: manifestText,
    });
  return {
    officialSourceFields: validatedOfficialSourceFields,
    activeSkillEvidence: activeSkillResolution.evidence,
    passiveSkillEvidence: passiveSkillResolution.evidence,
    compatibility: validatedCompatibility,
    snapshots,
    coverage,
    manifest: validatedManifest,
  };
}
