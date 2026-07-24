import { createHash } from "node:crypto";
import { lstat, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { assertPalworldPakCandidateArtifact } from "@streamops/shared";
import {
  analyzeTranslationSource,
  type TranslationFieldName,
  type TranslationSourceAnomalyCode,
} from "../scripts/palworld-translation-artifacts.js";

const REVIEW_SCHEMA_VERSION = 1 as const;
const REVIEW_STATUS = "pending_operator_review" as const;
const REVIEW_BATCH_ID = "source-anomaly-0001" as const;
const REVIEW_JOIN_RULE =
  "canonical_id_source_internal_id_message_key_exact" as const;
const MAX_JSON_BYTES = 64 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SAFE_MESSAGE_KEY_PATTERN = /^[A-Za-z0-9_]+$/u;
const STRICT_RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

type JsonRecord = Record<string, unknown>;
type ReviewLocale = "ko" | "ja";
type ReviewKind = "pal" | "item" | "skill";
type ReviewField = "name" | "description" | "passiveAbility";

type ReviewSourceIdentity = {
  active: {
    release: string;
    sourceRevision: string;
    catalogSha256: string;
    paldexSha256: string;
    translationRevision: string;
    localeSha256: {
      ko: string;
      ja: string;
    };
  };
  candidate: {
    candidateId: string;
    release: string | null;
    archiveSha256: string;
    mappingsSha256: string | null;
    activationEligible: false;
    activationBlockers: string[];
  };
};

type OfficialExactCount = {
  joined: number;
  resolved: number;
  unresolved: number;
  unjoined: number;
};

export type PalworldTranslationReviewSummary = {
  schemaVersion: 1;
  release: string;
  status: typeof REVIEW_STATUS;
  preparedAt: string;
  source: ReviewSourceIdentity;
  counts: {
    machineAssisted: Record<ReviewLocale, number>;
    humanReviewed: Record<ReviewLocale, number>;
    sourceAnomalies: {
      fields: number;
      missingSlots: number;
      uniqueSourceSha256: number;
    };
    officialExact: Record<ReviewLocale, OfficialExactCount>;
  };
  limitations: {
    officialCandidateActivationBlocked: true;
    humanReviewStatusChanged: false;
    fuzzyMatchingUsed: false;
    unjoinedReason: string;
  };
};

type CurrentLocaleValue = {
  sourceSha256: string;
  text: string;
  textSha256: string;
  status: "machine_assisted";
  note: string | null;
};

type OfficialLocaleValue = {
  text: string;
  valueSha256: string;
  sourceValueSha256: string;
  status: "source_provided";
  richTextStatus: "resolved";
  sourceMember: string;
  sourceMemberSha256: string;
};

type SourceAnomalyAffectedEntry = {
  kind: "item";
  id: string;
  sourceInternalId: string;
  field: "description";
  current: {
    ko: CurrentLocaleValue;
    ja: CurrentLocaleValue;
  };
  official: {
    joinRule: typeof REVIEW_JOIN_RULE;
    messageKey: string;
    ko: OfficialLocaleValue;
    ja: OfficialLocaleValue;
  };
  decision: typeof REVIEW_STATUS;
};

type SourceAnomalyGroup = {
  sourceSha256: string;
  sourceText: string;
  codes: TranslationSourceAnomalyCode[];
  missingSlotCountPerField: number;
  affected: SourceAnomalyAffectedEntry[];
};

export type PalworldTranslationSourceAnomalyBatch = {
  schemaVersion: 1;
  release: string;
  batchId: typeof REVIEW_BATCH_ID;
  status: typeof REVIEW_STATUS;
  preparedAt: string;
  source: ReviewSourceIdentity;
  cursor: {
    strategy: "source_sha256_fanout_desc";
    groupOffset: 0;
    groupLimit: number;
    totalGroups: number;
  };
  counts: {
    groups: number;
    affectedFields: number;
    missingSlots: number;
    officialKoResolved: number;
    officialJaResolved: number;
  };
  groups: SourceAnomalyGroup[];
};

export type PalworldTranslationReviewArtifacts = {
  summary: PalworldTranslationReviewSummary;
  sourceAnomalyBatch: PalworldTranslationSourceAnomalyBatch;
};

export type BuildPalworldTranslationReviewArtifactsOptions = {
  activeReleaseRoot: string;
  candidateRoot: string;
  preparedAt: string;
  sourceGroupLimit?: number;
};

type ActiveField = {
  sourceSha256: string;
  text: string;
  status: "machine_assisted" | "human_reviewed";
  note?: string;
};

type ActiveRecord = {
  id: string;
  kind: ReviewKind;
  fields: Partial<Record<ReviewField, ActiveField>>;
};

type CorpusField = {
  sourceText: string;
  sourceSha256: string;
};

type CorpusRecord = {
  id: string;
  kind: ReviewKind;
  fields: Partial<Record<ReviewField, CorpusField>>;
};

type LocalizedCandidateValue = {
  messageKey: string;
  sourceField: string;
  ko: string | null;
  ja: string | null;
  koStatus: "source_provided" | "missing_source";
  jaStatus: "source_provided" | "missing_source";
  koRichTextStatus?: "resolved" | "unresolved" | "placeholder";
  jaRichTextStatus?: "resolved" | "unresolved" | "placeholder";
};

type CandidateEntity = {
  id: string;
  sourceInternalId: string;
  type?: string;
  relatedPalIds?: string[];
  name?: LocalizedCandidateValue;
  description?: LocalizedCandidateValue;
};

type ActiveEntity = {
  id: string;
  sourceInternalId?: string;
  type?: string;
};

type CandidateLocaleRecord = {
  messageKey: string;
  field: string;
  text: string;
  valueSha256: string;
  status: "source_provided";
  sourceMember: string;
  sourceMemberSha256: string;
};

function fail(message: string): never {
  throw new TypeError(`Palworld 번역 검수 artifact 오류: ${message}`);
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
  ) {
    fail(`${pathName}는 올바른 문자열이어야 합니다.`);
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    fail(`${pathName}에 제어문자를 허용하지 않습니다.`);
  }
  return value;
}

function nullableStringAt(
  value: unknown,
  pathName: string,
  maximum = 65_536,
): string | null {
  return value === null ? null : stringAt(value, pathName, maximum, false);
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
    fail(`${pathName}는 ${minimum}~${maximum} 범위의 정수여야 합니다.`);
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

function arrayAt(value: unknown, pathName: string, maximum = 100_000): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) {
    fail(`${pathName}는 최대 ${maximum}개의 배열이어야 합니다.`);
  }
  return value;
}

function safeIdAt(value: unknown, pathName: string): string {
  const result = stringAt(value, pathName, 128);
  if (!SAFE_ID_PATTERN.test(result)) fail(`${pathName} canonical ID가 올바르지 않습니다.`);
  return result;
}

function reviewKindAt(value: unknown, pathName: string): ReviewKind {
  if (value !== "pal" && value !== "item" && value !== "skill") {
    fail(`${pathName} kind가 올바르지 않습니다.`);
  }
  return value;
}

function reviewFieldAt(value: string, pathName: string): ReviewField {
  if (value !== "name" && value !== "description" && value !== "passiveAbility") {
    fail(`${pathName} field가 올바르지 않습니다.`);
  }
  return value;
}

async function readJsonFile(filePath: string): Promise<{ raw: JsonRecord; bytes: Buffer }> {
  const [linkInfo, fileInfo] = await Promise.all([lstat(filePath), stat(filePath)]);
  if (
    linkInfo.isSymbolicLink()
    || !fileInfo.isFile()
    || fileInfo.size <= 0
    || fileInfo.size > MAX_JSON_BYTES
  ) {
    fail(`${path.basename(filePath)} 파일 형식 또는 크기가 올바르지 않습니다.`);
  }
  const bytes = await readFile(filePath);
  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(`${path.basename(filePath)}는 올바른 JSON이 아닙니다.`);
  }
  if (!isRecord(value)) fail(`${path.basename(filePath)} 루트는 객체여야 합니다.`);
  return { raw: value, bytes };
}

function activeRecordsAt(value: unknown, pathName: string): ActiveRecord[] {
  return arrayAt(value, pathName).map((input, index) => {
    const entryPath = `${pathName}[${index}]`;
    const record = recordAt(input, entryPath, ["id", "kind", "fields"]);
    const fieldsRecord = recordAt(
      record.fields,
      `${entryPath}.fields`,
      ["name", "description", "passiveAbility"],
    );
    const fields: ActiveRecord["fields"] = {};
    for (const [fieldName, rawField] of Object.entries(fieldsRecord)) {
      const field = reviewFieldAt(fieldName, `${entryPath}.fields`);
      const valueRecord = recordAt(
        rawField,
        `${entryPath}.fields.${field}`,
        ["sourceSha256", "text", "status", "note"],
      );
      if (
        valueRecord.status !== "machine_assisted"
        && valueRecord.status !== "human_reviewed"
      ) {
        fail(`${entryPath}.fields.${field}.status가 올바르지 않습니다.`);
      }
      fields[field] = {
        sourceSha256: sha256At(
          valueRecord.sourceSha256,
          `${entryPath}.fields.${field}.sourceSha256`,
        ),
        text: stringAt(valueRecord.text, `${entryPath}.fields.${field}.text`, 65_536, false),
        status: valueRecord.status,
        ...(valueRecord.note === undefined
          ? {}
          : { note: stringAt(valueRecord.note, `${entryPath}.fields.${field}.note`, 1_024) }),
      };
    }
    return {
      id: safeIdAt(record.id, `${entryPath}.id`),
      kind: reviewKindAt(record.kind, `${entryPath}.kind`),
      fields,
    };
  });
}

function corpusRecordsAt(value: unknown, pathName: string): CorpusRecord[] {
  return arrayAt(value, pathName).map((input, index) => {
    const entryPath = `${pathName}[${index}]`;
    const record = recordAt(input, entryPath, ["id", "kind", "fields"]);
    const fieldsRecord = recordAt(
      record.fields,
      `${entryPath}.fields`,
      ["name", "description", "passiveAbility"],
    );
    const fields: CorpusRecord["fields"] = {};
    for (const [fieldName, rawField] of Object.entries(fieldsRecord)) {
      const field = reviewFieldAt(fieldName, `${entryPath}.fields`);
      const valueRecord = recordAt(
        rawField,
        `${entryPath}.fields.${field}`,
        ["sourceText", "sourceSha256"],
      );
      const sourceText = stringAt(
        valueRecord.sourceText,
        `${entryPath}.fields.${field}.sourceText`,
        65_536,
        false,
      );
      const sourceSha256 = sha256At(
        valueRecord.sourceSha256,
        `${entryPath}.fields.${field}.sourceSha256`,
      );
      if (sha256(sourceText) !== sourceSha256) {
        fail(`${entryPath}.fields.${field} 원문 hash가 일치하지 않습니다.`);
      }
      fields[field] = { sourceText, sourceSha256 };
    }
    return {
      id: safeIdAt(record.id, `${entryPath}.id`),
      kind: reviewKindAt(record.kind, `${entryPath}.kind`),
      fields,
    };
  });
}

function activeEntitiesAt(value: unknown, pathName: string): ActiveEntity[] {
  return arrayAt(value, pathName).map((input, index) => {
    if (!isRecord(input)) fail(`${pathName}[${index}]는 객체여야 합니다.`);
    return {
      id: safeIdAt(input.id, `${pathName}[${index}].id`),
      ...(typeof input.sourceInternalId === "string"
        ? {
            sourceInternalId: stringAt(
              input.sourceInternalId,
              `${pathName}[${index}].sourceInternalId`,
              192,
            ),
          }
        : {}),
      ...(typeof input.type === "string"
        ? { type: stringAt(input.type, `${pathName}[${index}].type`, 32) }
        : {}),
    };
  });
}

function candidateEntitiesAt(value: unknown, pathName: string): CandidateEntity[] {
  return arrayAt(value, pathName).map((input, index) => {
    if (!isRecord(input)) fail(`${pathName}[${index}]는 객체여야 합니다.`);
    const parseLocalized = (
      raw: unknown,
      fieldPath: string,
    ): LocalizedCandidateValue | undefined => {
      if (raw === undefined) return undefined;
      if (!isRecord(raw)) fail(`${fieldPath}는 객체여야 합니다.`);
      const status = (locale: ReviewLocale): "source_provided" | "missing_source" => {
        const valueStatus = raw[`${locale}Status`];
        if (valueStatus !== "source_provided" && valueStatus !== "missing_source") {
          fail(`${fieldPath}.${locale}Status가 올바르지 않습니다.`);
        }
        return valueStatus;
      };
      const rich = (
        locale: ReviewLocale,
      ): "resolved" | "unresolved" | "placeholder" | undefined => {
        const valueStatus = raw[`${locale}RichTextStatus`];
        if (valueStatus === undefined) return undefined;
        if (
          valueStatus !== "resolved"
          && valueStatus !== "unresolved"
          && valueStatus !== "placeholder"
        ) {
          fail(`${fieldPath}.${locale}RichTextStatus가 올바르지 않습니다.`);
        }
        return valueStatus;
      };
      return {
        messageKey: stringAt(raw.messageKey, `${fieldPath}.messageKey`, 192),
        sourceField: stringAt(raw.sourceField, `${fieldPath}.sourceField`, 64),
        ko: nullableStringAt(raw.ko, `${fieldPath}.ko`),
        ja: nullableStringAt(raw.ja, `${fieldPath}.ja`),
        koStatus: status("ko"),
        jaStatus: status("ja"),
        ...(rich("ko") === undefined ? {} : { koRichTextStatus: rich("ko") }),
        ...(rich("ja") === undefined ? {} : { jaRichTextStatus: rich("ja") }),
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

function candidateLocaleRecordsAt(
  value: unknown,
  pathName: string,
): CandidateLocaleRecord[] {
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
    const text = stringAt(record.text, `${entryPath}.text`, 65_536, false);
    const valueSha256 = sha256At(record.valueSha256, `${entryPath}.valueSha256`);
    if (sha256(text) !== valueSha256) fail(`${entryPath} 값 hash가 일치하지 않습니다.`);
    return {
      messageKey: stringAt(record.messageKey, `${entryPath}.messageKey`, 192),
      field: stringAt(record.field, `${entryPath}.field`, 64),
      text,
      valueSha256,
      status: "source_provided",
      sourceMember: stringAt(record.sourceMember, `${entryPath}.sourceMember`, 1_024),
      sourceMemberSha256: sha256At(
        record.sourceMemberSha256,
        `${entryPath}.sourceMemberSha256`,
      ),
    };
  });
}

function uniqueMap<T>(
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

function sourceIdentityMatches(
  activeSourceInternalId: string | undefined,
  candidateSourceInternalId: string,
  aliasApplications: readonly JsonRecord[],
): boolean {
  if (activeSourceInternalId === candidateSourceInternalId) return true;
  if (activeSourceInternalId === undefined) return false;
  return aliasApplications.some((entry) =>
    entry.sourceId === activeSourceInternalId
    && entry.targetId === candidateSourceInternalId
    && typeof entry.applications === "number"
    && entry.applications > 0
    && (
      entry.domain === "active_assignment_pal_reference"
      || entry.domain === "public_id_source"
    ));
}

function localizedValueFor(
  kind: ReviewKind,
  id: string,
  field: ReviewField,
  sources: {
    activePalById: ReadonlyMap<string, ActiveEntity>;
    activeItemById: ReadonlyMap<string, ActiveEntity>;
    activeSkillById: ReadonlyMap<string, ActiveEntity>;
    candidatePalById: ReadonlyMap<string, CandidateEntity>;
    candidateItemById: ReadonlyMap<string, CandidateEntity>;
    candidateSkillById: ReadonlyMap<string, CandidateEntity>;
    aliasApplications: readonly JsonRecord[];
  },
): LocalizedCandidateValue | undefined {
  if (field === "passiveAbility") return undefined;
  if (kind === "item") {
    const active = sources.activeItemById.get(id);
    const candidate = sources.candidateItemById.get(id);
    if (
      active === undefined
      || candidate === undefined
      || !sourceIdentityMatches(
        active.sourceInternalId,
        candidate.sourceInternalId,
        sources.aliasApplications,
      )
    ) {
      return undefined;
    }
    return candidate[field];
  }
  if (kind === "pal") {
    const active = sources.activePalById.get(id);
    const candidate = sources.candidatePalById.get(id);
    if (
      active === undefined
      || candidate === undefined
      || !sourceIdentityMatches(
        active.sourceInternalId,
        candidate.sourceInternalId,
        sources.aliasApplications,
      )
    ) {
      return undefined;
    }
    return candidate[field];
  }
  const activeSkill = sources.activeSkillById.get(id);
  if (
    activeSkill?.type !== "partner"
    || !id.startsWith("partner-")
  ) {
    return undefined;
  }
  const palId = id.slice("partner-".length);
  if (!SAFE_ID_PATTERN.test(palId)) return undefined;
  const activePal = sources.activePalById.get(palId);
  const candidate = sources.candidateSkillById.get(`partner:${palId}`);
  if (
    activePal === undefined
    || candidate?.type !== "partner"
    || candidate.relatedPalIds?.length !== 1
    || candidate.relatedPalIds[0] !== palId
    || !sourceIdentityMatches(
      activePal.sourceInternalId,
      candidate.sourceInternalId,
      sources.aliasApplications,
    )
  ) {
    return undefined;
  }
  return candidate[field];
}

function officialLocaleValue(
  localized: LocalizedCandidateValue,
  locale: ReviewLocale,
  localeByKey: ReadonlyMap<string, CandidateLocaleRecord>,
  requireResolved: boolean,
): OfficialLocaleValue | undefined {
  const text = localized[locale];
  const status = localized[`${locale}Status`];
  const localeRecord = localeByKey.get(`${localized.sourceField}:${localized.messageKey}`);
  if (
    status !== "source_provided"
    || typeof text !== "string"
    || text.length === 0
    || localeRecord === undefined
    || localeRecord.status !== "source_provided"
  ) {
    return undefined;
  }
  const richTextStatus = localized[`${locale}RichTextStatus`] ?? "resolved";
  if (requireResolved && richTextStatus !== "resolved") return undefined;
  if (richTextStatus !== "resolved") return undefined;
  return {
    text,
    valueSha256: sha256(text),
    sourceValueSha256: localeRecord.valueSha256,
    status: "source_provided",
    richTextStatus: "resolved",
    sourceMember: localeRecord.sourceMember,
    sourceMemberSha256: localeRecord.sourceMemberSha256,
  };
}

function isOfficialJoined(
  localized: LocalizedCandidateValue,
  locale: ReviewLocale,
  localeByKey: ReadonlyMap<string, CandidateLocaleRecord>,
): { joined: boolean; resolved: boolean } {
  const text = localized[locale];
  const status = localized[`${locale}Status`];
  const localeRecord = localeByKey.get(`${localized.sourceField}:${localized.messageKey}`);
  if (
    status !== "source_provided"
    || typeof text !== "string"
    || text.length === 0
    || localeRecord === undefined
    || localeRecord.status !== "source_provided"
  ) {
    return { joined: false, resolved: false };
  }
  return {
    joined: true,
    resolved: (localized[`${locale}RichTextStatus`] ?? "resolved") === "resolved",
  };
}

function sourceIdentityFromArtifacts(input: {
  activeRelease: string;
  activeSourceRevision: string;
  activeTranslationRevision: string;
  catalogSha256: string;
  paldexSha256: string;
  koSha256: string;
  jaSha256: string;
  candidateReport: JsonRecord;
}): ReviewSourceIdentity {
  const report = input.candidateReport;
  const provenance = isRecord(report.provenance)
    ? report.provenance
    : fail("candidate import-report.provenance가 없습니다.");
  const blockers = arrayAt(report.blockers, "candidate.importReport.blockers", 100)
    .map((value, index) =>
      stringAt(value, `candidate.importReport.blockers[${index}]`, 128));
  if (report.activationEligible !== false || blockers.length === 0) {
    fail("활성화 가능한 candidate는 pending 검수 artifact의 입력으로 사용할 수 없습니다.");
  }
  const candidateRelease = report.release === null
    ? null
    : stringAt(report.release, "candidate.importReport.release", 64);
  const mappingsSha256 = provenance.mappingsSha256 === null
    ? null
    : sha256At(
      provenance.mappingsSha256,
      "candidate.importReport.provenance.mappingsSha256",
    );
  return {
    active: {
      release: input.activeRelease,
      sourceRevision: input.activeSourceRevision,
      catalogSha256: input.catalogSha256,
      paldexSha256: input.paldexSha256,
      translationRevision: input.activeTranslationRevision,
      localeSha256: {
        ko: input.koSha256,
        ja: input.jaSha256,
      },
    },
    candidate: {
      candidateId: stringAt(report.candidateId, "candidate.importReport.candidateId", 64),
      release: candidateRelease,
      archiveSha256: sha256At(
        provenance.archiveSha256,
        "candidate.importReport.provenance.archiveSha256",
      ),
      mappingsSha256,
      activationEligible: false,
      activationBlockers: blockers,
    },
  };
}

function assertSourceIdentity(
  value: unknown,
  pathName: string,
  expectedRelease: string,
): ReviewSourceIdentity {
  const source = recordAt(value, pathName, ["active", "candidate"]);
  const active = recordAt(source.active, `${pathName}.active`, [
    "release",
    "sourceRevision",
    "catalogSha256",
    "paldexSha256",
    "translationRevision",
    "localeSha256",
  ]);
  const release = stringAt(active.release, `${pathName}.active.release`, 64);
  if (release !== expectedRelease) fail(`${pathName}.active.release가 일치하지 않습니다.`);
  const localeSha = recordAt(active.localeSha256, `${pathName}.active.localeSha256`, [
    "ko",
    "ja",
  ]);
  const candidate = recordAt(source.candidate, `${pathName}.candidate`, [
    "candidateId",
    "release",
    "archiveSha256",
    "mappingsSha256",
    "activationEligible",
    "activationBlockers",
  ]);
  if (candidate.activationEligible !== false) {
    fail(`${pathName}.candidate.activationEligible는 false여야 합니다.`);
  }
  const blockers = arrayAt(
    candidate.activationBlockers,
    `${pathName}.candidate.activationBlockers`,
    100,
  ).map((entry, index) =>
    stringAt(entry, `${pathName}.candidate.activationBlockers[${index}]`, 128));
  if (blockers.length === 0 || new Set(blockers).size !== blockers.length) {
    fail(`${pathName}.candidate.activationBlockers가 비었거나 중복되었습니다.`);
  }
  return {
    active: {
      release,
      sourceRevision: stringAt(
        active.sourceRevision,
        `${pathName}.active.sourceRevision`,
        256,
      ),
      catalogSha256: sha256At(
        active.catalogSha256,
        `${pathName}.active.catalogSha256`,
      ),
      paldexSha256: sha256At(
        active.paldexSha256,
        `${pathName}.active.paldexSha256`,
      ),
      translationRevision: stringAt(
        active.translationRevision,
        `${pathName}.active.translationRevision`,
        256,
      ),
      localeSha256: {
        ko: sha256At(localeSha.ko, `${pathName}.active.localeSha256.ko`),
        ja: sha256At(localeSha.ja, `${pathName}.active.localeSha256.ja`),
      },
    },
    candidate: {
      candidateId: stringAt(
        candidate.candidateId,
        `${pathName}.candidate.candidateId`,
        64,
      ),
      release: candidate.release === null
        ? null
        : stringAt(candidate.release, `${pathName}.candidate.release`, 64),
      archiveSha256: sha256At(
        candidate.archiveSha256,
        `${pathName}.candidate.archiveSha256`,
      ),
      mappingsSha256: candidate.mappingsSha256 === null
        ? null
        : sha256At(
          candidate.mappingsSha256,
          `${pathName}.candidate.mappingsSha256`,
        ),
      activationEligible: false,
      activationBlockers: blockers,
    },
  };
}

function assertCurrentLocaleValue(
  value: unknown,
  pathName: string,
  expectedSourceSha256: string,
): CurrentLocaleValue {
  const field = recordAt(value, pathName, [
    "sourceSha256",
    "text",
    "textSha256",
    "status",
    "note",
  ]);
  const sourceSha256 = sha256At(field.sourceSha256, `${pathName}.sourceSha256`);
  if (sourceSha256 !== expectedSourceSha256) {
    fail(`${pathName}.sourceSha256가 원문 hash와 일치하지 않습니다.`);
  }
  const text = stringAt(field.text, `${pathName}.text`, 65_536, false);
  const textSha256 = sha256At(field.textSha256, `${pathName}.textSha256`);
  if (sha256(text) !== textSha256) fail(`${pathName}.text hash가 일치하지 않습니다.`);
  if (field.status !== "machine_assisted") {
    fail(`${pathName}.status는 machine_assisted여야 합니다.`);
  }
  return {
    sourceSha256,
    text,
    textSha256,
    status: "machine_assisted",
    note: field.note === null
      ? null
      : stringAt(field.note, `${pathName}.note`, 1_024),
  };
}

function assertOfficialLocaleValue(
  value: unknown,
  pathName: string,
): OfficialLocaleValue {
  const field = recordAt(value, pathName, [
    "text",
    "valueSha256",
    "sourceValueSha256",
    "status",
    "richTextStatus",
    "sourceMember",
    "sourceMemberSha256",
  ]);
  const text = stringAt(field.text, `${pathName}.text`, 65_536, false);
  const valueSha256 = sha256At(field.valueSha256, `${pathName}.valueSha256`);
  if (sha256(text) !== valueSha256) fail(`${pathName}.value hash가 일치하지 않습니다.`);
  if (field.status !== "source_provided") {
    fail(`${pathName}.status는 source_provided여야 합니다.`);
  }
  if (field.richTextStatus !== "resolved") {
    fail(`${pathName}.richTextStatus는 resolved여야 합니다.`);
  }
  const sourceMember = stringAt(field.sourceMember, `${pathName}.sourceMember`, 1_024);
  if (
    path.isAbsolute(sourceMember)
    || sourceMember.includes("\\")
    || sourceMember.split("/").some((part) => part === ".." || part === "")
  ) {
    fail(`${pathName}.sourceMember 경로가 안전하지 않습니다.`);
  }
  return {
    text,
    valueSha256,
    sourceValueSha256: sha256At(
      field.sourceValueSha256,
      `${pathName}.sourceValueSha256`,
    ),
    status: "source_provided",
    richTextStatus: "resolved",
    sourceMember,
    sourceMemberSha256: sha256At(
      field.sourceMemberSha256,
      `${pathName}.sourceMemberSha256`,
    ),
  };
}

export function assertPalworldTranslationReviewSummary(
  value: unknown,
): PalworldTranslationReviewSummary {
  const root = recordAt(value, "translationReviewSummary", [
    "schemaVersion",
    "release",
    "status",
    "preparedAt",
    "source",
    "counts",
    "limitations",
  ]);
  if (root.schemaVersion !== REVIEW_SCHEMA_VERSION) {
    fail("translationReviewSummary.schemaVersion이 올바르지 않습니다.");
  }
  const release = stringAt(root.release, "translationReviewSummary.release", 64);
  if (root.status !== REVIEW_STATUS) {
    fail("translationReviewSummary.status가 올바르지 않습니다.");
  }
  const source = assertSourceIdentity(root.source, "translationReviewSummary.source", release);
  const counts = recordAt(root.counts, "translationReviewSummary.counts", [
    "machineAssisted",
    "humanReviewed",
    "sourceAnomalies",
    "officialExact",
  ]);
  const readLocales = (
    input: unknown,
    pathName: string,
  ): Record<ReviewLocale, number> => {
    const record = recordAt(input, pathName, ["ko", "ja"]);
    return {
      ko: integerAt(record.ko, `${pathName}.ko`),
      ja: integerAt(record.ja, `${pathName}.ja`),
    };
  };
  const machineAssisted = readLocales(
    counts.machineAssisted,
    "translationReviewSummary.counts.machineAssisted",
  );
  const humanReviewed = readLocales(
    counts.humanReviewed,
    "translationReviewSummary.counts.humanReviewed",
  );
  const anomalies = recordAt(
    counts.sourceAnomalies,
    "translationReviewSummary.counts.sourceAnomalies",
    ["fields", "missingSlots", "uniqueSourceSha256"],
  );
  const exactRoot = recordAt(
    counts.officialExact,
    "translationReviewSummary.counts.officialExact",
    ["ko", "ja"],
  );
  const officialExact = Object.fromEntries((["ko", "ja"] as const).map((locale) => {
    const exact = recordAt(
      exactRoot[locale],
      `translationReviewSummary.counts.officialExact.${locale}`,
      ["joined", "resolved", "unresolved", "unjoined"],
    );
    const result: OfficialExactCount = {
      joined: integerAt(exact.joined, `officialExact.${locale}.joined`),
      resolved: integerAt(exact.resolved, `officialExact.${locale}.resolved`),
      unresolved: integerAt(exact.unresolved, `officialExact.${locale}.unresolved`),
      unjoined: integerAt(exact.unjoined, `officialExact.${locale}.unjoined`),
    };
    if (
      result.joined !== result.resolved + result.unresolved
      || machineAssisted[locale] !== result.joined + result.unjoined
    ) {
      fail(`translationReviewSummary.counts.officialExact.${locale} 집계가 일치하지 않습니다.`);
    }
    return [locale, result];
  })) as Record<ReviewLocale, OfficialExactCount>;
  const limitations = recordAt(
    root.limitations,
    "translationReviewSummary.limitations",
    [
      "officialCandidateActivationBlocked",
      "humanReviewStatusChanged",
      "fuzzyMatchingUsed",
      "unjoinedReason",
    ],
  );
  if (
    limitations.officialCandidateActivationBlocked !== true
    || limitations.humanReviewStatusChanged !== false
    || limitations.fuzzyMatchingUsed !== false
  ) {
    fail("translationReviewSummary.limitations 안전 상태가 올바르지 않습니다.");
  }
  return {
    schemaVersion: 1,
    release,
    status: REVIEW_STATUS,
    preparedAt: strictTimestampAt(
      root.preparedAt,
      "translationReviewSummary.preparedAt",
    ),
    source,
    counts: {
      machineAssisted,
      humanReviewed,
      sourceAnomalies: {
        fields: integerAt(anomalies.fields, "sourceAnomalies.fields"),
        missingSlots: integerAt(anomalies.missingSlots, "sourceAnomalies.missingSlots"),
        uniqueSourceSha256: integerAt(
          anomalies.uniqueSourceSha256,
          "sourceAnomalies.uniqueSourceSha256",
        ),
      },
      officialExact,
    },
    limitations: {
      officialCandidateActivationBlocked: true,
      humanReviewStatusChanged: false,
      fuzzyMatchingUsed: false,
      unjoinedReason: stringAt(
        limitations.unjoinedReason,
        "translationReviewSummary.limitations.unjoinedReason",
        512,
      ),
    },
  };
}

export function assertPalworldTranslationSourceAnomalyBatch(
  value: unknown,
): PalworldTranslationSourceAnomalyBatch {
  const root = recordAt(value, "translationSourceAnomalyBatch", [
    "schemaVersion",
    "release",
    "batchId",
    "status",
    "preparedAt",
    "source",
    "cursor",
    "counts",
    "groups",
  ]);
  if (root.schemaVersion !== 1 || root.batchId !== REVIEW_BATCH_ID) {
    fail("translationSourceAnomalyBatch identity가 올바르지 않습니다.");
  }
  if (root.status !== REVIEW_STATUS) {
    fail("translationSourceAnomalyBatch.status가 올바르지 않습니다.");
  }
  const release = stringAt(root.release, "translationSourceAnomalyBatch.release", 64);
  const source = assertSourceIdentity(
    root.source,
    "translationSourceAnomalyBatch.source",
    release,
  );
  const cursor = recordAt(root.cursor, "translationSourceAnomalyBatch.cursor", [
    "strategy",
    "groupOffset",
    "groupLimit",
    "totalGroups",
  ]);
  if (
    cursor.strategy !== "source_sha256_fanout_desc"
    || cursor.groupOffset !== 0
  ) {
    fail("translationSourceAnomalyBatch.cursor가 올바르지 않습니다.");
  }
  const groupLimit = integerAt(cursor.groupLimit, "cursor.groupLimit", 1, 150);
  const totalGroups = integerAt(cursor.totalGroups, "cursor.totalGroups", 1, 100_000);
  const rawGroups = arrayAt(root.groups, "translationSourceAnomalyBatch.groups", groupLimit);
  const seenGroups = new Set<string>();
  let previousFanout = Number.MAX_SAFE_INTEGER;
  let previousSourceSha256 = "";
  const groups = rawGroups.map((input, groupIndex): SourceAnomalyGroup => {
    const groupPath = `translationSourceAnomalyBatch.groups[${groupIndex}]`;
    const group = recordAt(input, groupPath, [
      "sourceSha256",
      "sourceText",
      "codes",
      "missingSlotCountPerField",
      "affected",
    ]);
    const sourceSha256 = sha256At(group.sourceSha256, `${groupPath}.sourceSha256`);
    if (seenGroups.has(sourceSha256)) fail(`${groupPath} source hash가 중복되었습니다.`);
    seenGroups.add(sourceSha256);
    const sourceText = stringAt(group.sourceText, `${groupPath}.sourceText`, 65_536, false);
    if (sha256(sourceText) !== sourceSha256) {
      fail(`${groupPath} 원문 hash가 일치하지 않습니다.`);
    }
    const detected = analyzeTranslationSource(sourceText);
    const codes = arrayAt(group.codes, `${groupPath}.codes`, 3).map((code, codeIndex) => {
      if (
        code !== "empty_parentheses"
        && code !== "missing_value_before_period"
        && code !== "missing_value_before_comma"
      ) {
        fail(`${groupPath}.codes[${codeIndex}]가 올바르지 않습니다.`);
      }
      return code;
    });
    if (JSON.stringify(codes) !== JSON.stringify(detected.codes)) {
      fail(`${groupPath}.codes가 원문 분석과 일치하지 않습니다.`);
    }
    const missingSlotCountPerField = integerAt(
      group.missingSlotCountPerField,
      `${groupPath}.missingSlotCountPerField`,
      1,
      100,
    );
    if (missingSlotCountPerField !== detected.missingSlotCount) {
      fail(`${groupPath}.missingSlotCountPerField가 원문 분석과 일치하지 않습니다.`);
    }
    const rawAffected = arrayAt(group.affected, `${groupPath}.affected`, 100_000);
    if (
      rawAffected.length > previousFanout
      || (
        rawAffected.length === previousFanout
        && previousSourceSha256.localeCompare(sourceSha256, "en") >= 0
      )
    ) {
      fail("translationSourceAnomalyBatch.groups는 fan-out 내림차순과 hash 오름차순으로 정렬되어야 합니다.");
    }
    previousFanout = rawAffected.length;
    previousSourceSha256 = sourceSha256;
    let previousIdentity = "";
    const seenAffected = new Set<string>();
    const affected = rawAffected.map((rawEntry, affectedIndex): SourceAnomalyAffectedEntry => {
      const entryPath = `${groupPath}.affected[${affectedIndex}]`;
      const entry = recordAt(rawEntry, entryPath, [
        "kind",
        "id",
        "sourceInternalId",
        "field",
        "current",
        "official",
        "decision",
      ]);
      if (entry.kind !== "item" || entry.field !== "description") {
        fail(`${entryPath}는 item.description이어야 합니다.`);
      }
      const id = safeIdAt(entry.id, `${entryPath}.id`);
      if (seenAffected.has(id) || (previousIdentity && previousIdentity.localeCompare(id, "en") >= 0)) {
        fail(`${entryPath} affected 항목이 중복되었거나 정렬되지 않았습니다.`);
      }
      seenAffected.add(id);
      previousIdentity = id;
      const current = recordAt(entry.current, `${entryPath}.current`, ["ko", "ja"]);
      const official = recordAt(entry.official, `${entryPath}.official`, [
        "joinRule",
        "messageKey",
        "ko",
        "ja",
      ]);
      if (official.joinRule !== REVIEW_JOIN_RULE) {
        fail(`${entryPath}.official.joinRule이 올바르지 않습니다.`);
      }
      const messageKey = stringAt(
        official.messageKey,
        `${entryPath}.official.messageKey`,
        192,
      );
      if (!SAFE_MESSAGE_KEY_PATTERN.test(messageKey)) {
        fail(`${entryPath}.official.messageKey 형식이 올바르지 않습니다.`);
      }
      if (entry.decision !== REVIEW_STATUS) {
        fail(`${entryPath}.decision이 올바르지 않습니다.`);
      }
      return {
        kind: "item",
        id,
        sourceInternalId: stringAt(
          entry.sourceInternalId,
          `${entryPath}.sourceInternalId`,
          192,
        ),
        field: "description",
        current: {
          ko: assertCurrentLocaleValue(
            current.ko,
            `${entryPath}.current.ko`,
            sourceSha256,
          ),
          ja: assertCurrentLocaleValue(
            current.ja,
            `${entryPath}.current.ja`,
            sourceSha256,
          ),
        },
        official: {
          joinRule: REVIEW_JOIN_RULE,
          messageKey,
          ko: assertOfficialLocaleValue(official.ko, `${entryPath}.official.ko`),
          ja: assertOfficialLocaleValue(official.ja, `${entryPath}.official.ja`),
        },
        decision: REVIEW_STATUS,
      };
    });
    return {
      sourceSha256,
      sourceText,
      codes,
      missingSlotCountPerField,
      affected,
    };
  });
  const countsRecord = recordAt(root.counts, "translationSourceAnomalyBatch.counts", [
    "groups",
    "affectedFields",
    "missingSlots",
    "officialKoResolved",
    "officialJaResolved",
  ]);
  const affectedFields = groups.reduce((sum, group) => sum + group.affected.length, 0);
  const missingSlots = groups.reduce(
    (sum, group) => sum + (group.affected.length * group.missingSlotCountPerField),
    0,
  );
  const expectedCounts = {
    groups: groups.length,
    affectedFields,
    missingSlots,
    officialKoResolved: affectedFields,
    officialJaResolved: affectedFields,
  };
  for (const [key, expected] of Object.entries(expectedCounts)) {
    if (integerAt(countsRecord[key], `counts.${key}`) !== expected) {
      fail(`translationSourceAnomalyBatch.counts.${key} 집계가 일치하지 않습니다.`);
    }
  }
  return {
    schemaVersion: 1,
    release,
    batchId: REVIEW_BATCH_ID,
    status: REVIEW_STATUS,
    preparedAt: strictTimestampAt(root.preparedAt, "translationSourceAnomalyBatch.preparedAt"),
    source,
    cursor: {
      strategy: "source_sha256_fanout_desc",
      groupOffset: 0,
      groupLimit,
      totalGroups,
    },
    counts: expectedCounts,
    groups,
  };
}

export function serializePalworldTranslationReviewArtifact(
  value: PalworldTranslationReviewSummary | PalworldTranslationSourceAnomalyBatch,
): string {
  const validated = "batchId" in value
    ? assertPalworldTranslationSourceAnomalyBatch(value)
    : assertPalworldTranslationReviewSummary(value);
  return `${JSON.stringify(validated, null, 2)}\n`;
}

export async function buildPalworldTranslationReviewArtifacts(
  options: BuildPalworldTranslationReviewArtifactsOptions,
): Promise<PalworldTranslationReviewArtifacts> {
  strictTimestampAt(options.preparedAt, "options.preparedAt");
  const sourceGroupLimit = integerAt(
    options.sourceGroupLimit ?? 25,
    "options.sourceGroupLimit",
    1,
    150,
  );
  const activeReleaseRoot = path.resolve(options.activeReleaseRoot);
  const candidateRoot = path.resolve(options.candidateRoot);

  const [
    catalogFile,
    paldexFile,
    corpusFile,
    koFile,
    jaFile,
    candidatePaldexFile,
    candidateItemsFile,
    candidateSkillsFile,
    candidateKoFile,
    candidateJaFile,
    candidateReportFile,
  ] = await Promise.all([
    readJsonFile(path.join(activeReleaseRoot, "catalog.json")),
    readJsonFile(path.join(activeReleaseRoot, "paldex.json")),
    readJsonFile(path.join(activeReleaseRoot, "locales", "corpus.json")),
    readJsonFile(path.join(activeReleaseRoot, "locales", "ko.json")),
    readJsonFile(path.join(activeReleaseRoot, "locales", "ja.json")),
    readJsonFile(path.join(candidateRoot, "paldex.json")),
    readJsonFile(path.join(candidateRoot, "items.json")),
    readJsonFile(path.join(candidateRoot, "skills.json")),
    readJsonFile(path.join(candidateRoot, "locales", "ko.json")),
    readJsonFile(path.join(candidateRoot, "locales", "ja.json")),
    readJsonFile(path.join(candidateRoot, "import-report.json")),
  ]);

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
  const candidateKo = assertPalworldPakCandidateArtifact(
    "locales/ko.json",
    candidateKoFile.raw,
    candidateContext,
  ) as JsonRecord;
  const candidateJa = assertPalworldPakCandidateArtifact(
    "locales/ja.json",
    candidateJaFile.raw,
    candidateContext,
  ) as JsonRecord;

  const activeRelease = stringAt(catalogFile.raw.release, "catalog.release", 64);
  if (paldexFile.raw.release !== activeRelease) {
    fail("active catalog과 Paldex release가 일치하지 않습니다.");
  }
  const metadata = isRecord(catalogFile.raw.metadata)
    ? catalogFile.raw.metadata
    : fail("catalog.metadata가 없습니다.");
  const sourceRevision = stringAt(
    metadata.sourceRevision,
    "catalog.metadata.sourceRevision",
    256,
  );
  const activeLocales = {
    ko: activeRecordsAt(koFile.raw.records, "active.ko.records"),
    ja: activeRecordsAt(jaFile.raw.records, "active.ja.records"),
  };
  for (const locale of ["ko", "ja"] as const) {
    const raw = locale === "ko" ? koFile.raw : jaFile.raw;
    if (
      raw.release !== activeRelease
      || raw.sourceCatalogSha256 !== sha256(catalogFile.bytes)
      || raw.sourcePaldexSha256 !== sha256(paldexFile.bytes)
    ) {
      fail(`active ${locale} locale source identity가 일치하지 않습니다.`);
    }
  }
  const translationRevision = stringAt(
    koFile.raw.translationRevision,
    "active.ko.translationRevision",
    256,
  );
  if (jaFile.raw.translationRevision !== translationRevision) {
    fail("active KO/JA translationRevision이 일치하지 않습니다.");
  }
  const corpus = corpusRecordsAt(corpusFile.raw.records, "active.corpus.records");
  const corpusByIdentity = uniqueMap(
    corpus,
    (record) => `${record.kind}:${record.id}`,
    "active.corpus.records",
  );
  const activeLocaleByIdentity = {
    ko: uniqueMap(
      activeLocales.ko,
      (record) => `${record.kind}:${record.id}`,
      "active.ko.records",
    ),
    ja: uniqueMap(
      activeLocales.ja,
      (record) => `${record.kind}:${record.id}`,
      "active.ja.records",
    ),
  };
  for (const locale of ["ko", "ja"] as const) {
    for (const record of activeLocales[locale]) {
      const source = corpusByIdentity.get(`${record.kind}:${record.id}`);
      if (source === undefined) fail(`active ${locale} locale에 orphan record가 있습니다.`);
      for (const [fieldName, field] of Object.entries(record.fields)) {
        const sourceField = source.fields[fieldName as ReviewField];
        if (sourceField === undefined || sourceField.sourceSha256 !== field.sourceSha256) {
          fail(`active ${locale}:${record.kind}:${record.id}:${fieldName} source hash가 일치하지 않습니다.`);
        }
      }
    }
  }

  const activePalRecords = activeEntitiesAt(paldexFile.raw.records, "active.paldex.records");
  const activeItemRecords = activeEntitiesAt(catalogFile.raw.items, "active.catalog.items");
  const activeSkillRecords = activeEntitiesAt(catalogFile.raw.skills, "active.catalog.skills");
  const candidatePalRecords = candidateEntitiesAt(
    candidatePaldex.records,
    "candidate.paldex.records",
  );
  const candidateItemRecords = candidateEntitiesAt(
    candidateItems.records,
    "candidate.items.records",
  );
  const candidateSkillRecords = candidateEntitiesAt(
    candidateSkills.records,
    "candidate.skills.records",
  );
  const candidateLocaleRecords = {
    ko: candidateLocaleRecordsAt(candidateKo.records, "candidate.ko.records"),
    ja: candidateLocaleRecordsAt(candidateJa.records, "candidate.ja.records"),
  };
  const candidateProvenance = isRecord(candidateReport.provenance)
    ? candidateReport.provenance
    : fail("candidate.importReport.provenance가 없습니다.");
  const includedFiles = uniqueMap(
    arrayAt(
      candidateProvenance.includedFiles,
      "candidate.importReport.provenance.includedFiles",
      100_000,
    ).map((input, index) => {
      const entry = recordAt(
        input,
        `candidate.importReport.provenance.includedFiles[${index}]`,
        ["member", "sha256", "bytes"],
      );
      return {
        member: stringAt(
          entry.member,
          `candidate.importReport.provenance.includedFiles[${index}].member`,
          1_024,
        ),
        sha256: sha256At(
          entry.sha256,
          `candidate.importReport.provenance.includedFiles[${index}].sha256`,
        ),
      };
    }),
    (entry) => entry.member,
    "candidate.importReport.provenance.includedFiles",
  );
  for (const locale of ["ko", "ja"] as const) {
    for (const record of candidateLocaleRecords[locale]) {
      if (includedFiles.get(record.sourceMember)?.sha256 !== record.sourceMemberSha256) {
        fail(
          `candidate ${locale} locale source member checksum이 import report와 일치하지 않습니다: ${record.sourceMember}`,
        );
      }
    }
  }
  const candidateLocaleByKey = {
    ko: uniqueMap(
      candidateLocaleRecords.ko,
      (record) => `${record.field}:${record.messageKey}`,
      "candidate.ko.records",
    ),
    ja: uniqueMap(
      candidateLocaleRecords.ja,
      (record) => `${record.field}:${record.messageKey}`,
      "candidate.ja.records",
    ),
  };
  const aliasApplications = arrayAt(
    candidateReport.aliasApplications,
    "candidate.importReport.aliasApplications",
    10_000,
  ).map((entry, index) =>
    isRecord(entry)
      ? entry
      : fail(`candidate.importReport.aliasApplications[${index}]가 객체가 아닙니다.`));
  const lookupSources = {
    activePalById: uniqueMap(activePalRecords, (record) => record.id, "active.paldex.records"),
    activeItemById: uniqueMap(activeItemRecords, (record) => record.id, "active.catalog.items"),
    activeSkillById: uniqueMap(activeSkillRecords, (record) => record.id, "active.catalog.skills"),
    candidatePalById: uniqueMap(
      candidatePalRecords,
      (record) => record.id,
      "candidate.paldex.records",
    ),
    candidateItemById: uniqueMap(
      candidateItemRecords,
      (record) => record.id,
      "candidate.items.records",
    ),
    candidateSkillById: uniqueMap(
      candidateSkillRecords,
      (record) => record.id,
      "candidate.skills.records",
    ),
    aliasApplications,
  };

  const machineAssisted = { ko: 0, ja: 0 };
  const humanReviewed = { ko: 0, ja: 0 };
  const officialExact: Record<ReviewLocale, OfficialExactCount> = {
    ko: { joined: 0, resolved: 0, unresolved: 0, unjoined: 0 },
    ja: { joined: 0, resolved: 0, unresolved: 0, unjoined: 0 },
  };
  for (const locale of ["ko", "ja"] as const) {
    for (const record of activeLocales[locale]) {
      for (const [fieldName, field] of Object.entries(record.fields)) {
        if (field.status === "human_reviewed") {
          humanReviewed[locale] += 1;
          continue;
        }
        machineAssisted[locale] += 1;
        const localized = localizedValueFor(
          record.kind,
          record.id,
          fieldName as ReviewField,
          lookupSources,
        );
        if (localized === undefined) {
          officialExact[locale].unjoined += 1;
          continue;
        }
        const result = isOfficialJoined(
          localized,
          locale,
          candidateLocaleByKey[locale],
        );
        if (!result.joined) {
          officialExact[locale].unjoined += 1;
          continue;
        }
        officialExact[locale].joined += 1;
        if (result.resolved) officialExact[locale].resolved += 1;
        else officialExact[locale].unresolved += 1;
      }
    }
  }

  const anomalyGroups = new Map<string, SourceAnomalyGroup>();
  let totalAnomalyFields = 0;
  let totalMissingSlots = 0;
  for (const corpusRecord of corpus) {
    for (const [fieldName, sourceField] of Object.entries(corpusRecord.fields)) {
      const anomaly = analyzeTranslationSource(sourceField.sourceText);
      if (anomaly.missingSlotCount === 0) continue;
      totalAnomalyFields += 1;
      totalMissingSlots += anomaly.missingSlotCount;
      if (corpusRecord.kind !== "item" || fieldName !== "description") {
        fail(`현재 검수 pipeline이 지원하지 않는 source anomaly가 있습니다: ${corpusRecord.kind}:${corpusRecord.id}:${fieldName}`);
      }
      const activeItem = lookupSources.activeItemById.get(corpusRecord.id);
      const candidateItem = lookupSources.candidateItemById.get(corpusRecord.id);
      if (
        activeItem?.sourceInternalId === undefined
        || candidateItem === undefined
        || !sourceIdentityMatches(
          activeItem.sourceInternalId,
          candidateItem.sourceInternalId,
          aliasApplications,
        )
        || candidateItem.description === undefined
      ) {
        fail(`source anomaly item을 candidate에 exact join할 수 없습니다: ${corpusRecord.id}`);
      }
      const koCurrent = activeLocaleByIdentity.ko
        .get(`item:${corpusRecord.id}`)?.fields.description;
      const jaCurrent = activeLocaleByIdentity.ja
        .get(`item:${corpusRecord.id}`)?.fields.description;
      if (
        koCurrent?.status !== "machine_assisted"
        || jaCurrent?.status !== "machine_assisted"
        || koCurrent.sourceSha256 !== sourceField.sourceSha256
        || jaCurrent.sourceSha256 !== sourceField.sourceSha256
      ) {
        fail(`source anomaly locale 상태가 일치하지 않습니다: ${corpusRecord.id}`);
      }
      const koOfficial = officialLocaleValue(
        candidateItem.description,
        "ko",
        candidateLocaleByKey.ko,
        true,
      );
      const jaOfficial = officialLocaleValue(
        candidateItem.description,
        "ja",
        candidateLocaleByKey.ja,
        true,
      );
      if (koOfficial === undefined || jaOfficial === undefined) {
        fail(`source anomaly의 공식 KO/JA rich text를 해결할 수 없습니다: ${corpusRecord.id}`);
      }
      const group = anomalyGroups.get(sourceField.sourceSha256) ?? {
        sourceSha256: sourceField.sourceSha256,
        sourceText: sourceField.sourceText,
        codes: anomaly.codes,
        missingSlotCountPerField: anomaly.missingSlotCount,
        affected: [],
      };
      if (
        group.sourceText !== sourceField.sourceText
        || group.missingSlotCountPerField !== anomaly.missingSlotCount
      ) {
        fail(`동일 source hash의 원문 또는 anomaly 분석이 충돌합니다: ${sourceField.sourceSha256}`);
      }
      group.affected.push({
        kind: "item",
        id: corpusRecord.id,
        sourceInternalId: candidateItem.sourceInternalId,
        field: "description",
        current: {
          ko: {
            sourceSha256: koCurrent.sourceSha256,
            text: koCurrent.text,
            textSha256: sha256(koCurrent.text),
            status: "machine_assisted",
            note: koCurrent.note ?? null,
          },
          ja: {
            sourceSha256: jaCurrent.sourceSha256,
            text: jaCurrent.text,
            textSha256: sha256(jaCurrent.text),
            status: "machine_assisted",
            note: jaCurrent.note ?? null,
          },
        },
        official: {
          joinRule: REVIEW_JOIN_RULE,
          messageKey: candidateItem.description.messageKey,
          ko: koOfficial,
          ja: jaOfficial,
        },
        decision: REVIEW_STATUS,
      });
      anomalyGroups.set(sourceField.sourceSha256, group);
    }
  }
  const sortedAnomalyGroups = [...anomalyGroups.values()]
    .map((group) => ({
      ...group,
      affected: [...group.affected].sort((left, right) =>
        left.id.localeCompare(right.id, "en")),
    }))
    .sort((left, right) =>
      right.affected.length - left.affected.length
      || left.sourceSha256.localeCompare(right.sourceSha256, "en"));
  const selectedGroups = sortedAnomalyGroups.slice(0, sourceGroupLimit);
  const source = sourceIdentityFromArtifacts({
    activeRelease,
    activeSourceRevision: sourceRevision,
    activeTranslationRevision: translationRevision,
    catalogSha256: sha256(catalogFile.bytes),
    paldexSha256: sha256(paldexFile.bytes),
    koSha256: sha256(koFile.bytes),
    jaSha256: sha256(jaFile.bytes),
    candidateReport,
  });
  const summary: PalworldTranslationReviewSummary = {
    schemaVersion: 1,
    release: activeRelease,
    status: REVIEW_STATUS,
    preparedAt: options.preparedAt,
    source,
    counts: {
      machineAssisted,
      humanReviewed,
      sourceAnomalies: {
        fields: totalAnomalyFields,
        missingSlots: totalMissingSlots,
        uniqueSourceSha256: sortedAnomalyGroups.length,
      },
      officialExact,
    },
    limitations: {
      officialCandidateActivationBlocked: true,
      humanReviewStatusChanged: false,
      fuzzyMatchingUsed: false,
      unjoinedReason:
        "legacy active/passive skill에는 검증된 sourceInternalId·messageKey migration이 없어 공식 locale과 연결하지 않았습니다.",
    },
  };
  const affectedFields = selectedGroups.reduce(
    (sum, group) => sum + group.affected.length,
    0,
  );
  const sourceAnomalyBatch: PalworldTranslationSourceAnomalyBatch = {
    schemaVersion: 1,
    release: activeRelease,
    batchId: REVIEW_BATCH_ID,
    status: REVIEW_STATUS,
    preparedAt: options.preparedAt,
    source,
    cursor: {
      strategy: "source_sha256_fanout_desc",
      groupOffset: 0,
      groupLimit: sourceGroupLimit,
      totalGroups: sortedAnomalyGroups.length,
    },
    counts: {
      groups: selectedGroups.length,
      affectedFields,
      missingSlots: selectedGroups.reduce(
        (sum, group) => sum + group.affected.length * group.missingSlotCountPerField,
        0,
      ),
      officialKoResolved: affectedFields,
      officialJaResolved: affectedFields,
    },
    groups: selectedGroups,
  };
  return {
    summary: assertPalworldTranslationReviewSummary(summary),
    sourceAnomalyBatch:
      assertPalworldTranslationSourceAnomalyBatch(sourceAnomalyBatch),
  };
}
