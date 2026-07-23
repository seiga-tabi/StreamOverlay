import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import {
  validatePalworldTranslationSnapshot,
  type PalworldTranslationField,
  type PalworldTranslationFieldValue,
  type PalworldTranslationLocale,
  type PalworldTranslationRecordKind,
  type PalworldTranslationSnapshot,
  type PalworldTranslationSourceField,
  type PalworldTranslationSourceRecord,
  type PalworldTranslationValidationContext
} from "@streamops/shared";
import {
  PALWORLD_CATALOG_RELEASE,
  type PalworldCatalogArtifact
} from "./palworld-catalog-artifact.js";
import type { PalworldPaldexRuntimeRelease } from "./palworld-paldex-adapter.js";
import { PALWORLD_SNAPSHOT } from "./palworld-snapshot.js";
import {
  localizedReviewedItemsByCanonicalId,
  type PalworldReviewedItemAlias
} from "./palworld-reviewed-item-aliases.js";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/u;
const MAX_TRANSLATION_FILE_BYTES = 32 * 1024 * 1024;
const MAX_MANIFEST_FILE_BYTES = 128 * 1024;
const MAX_GLOSSARY_FILE_BYTES = 4 * 1024 * 1024;
const LOCALE_FILES: Readonly<Record<PalworldTranslationLocale, string>> = {
  ko: "ko.json",
  ja: "ja.json"
};

export const PALWORLD_TRANSLATION_DIRECTORY = "locales";
export const PALWORLD_TRANSLATION_MANIFEST_FILE = "manifest.json";
export const PALWORLD_TRANSLATION_GLOSSARY_FILE = "glossary.json";

export type PalworldTranslationLoadErrorCode =
  | "PALWORLD_TRANSLATION_MISSING"
  | "PALWORLD_TRANSLATION_MANIFEST_INVALID"
  | "PALWORLD_TRANSLATION_GLOSSARY_INVALID"
  | "PALWORLD_TRANSLATION_LOCALE_INVALID";

export type PalworldTranslationLocaleLoadState = {
  status: "loaded" | "missing" | "invalid";
  errorCode?: PalworldTranslationLoadErrorCode;
  staleSourceHash: boolean;
};

export type PalworldTranslationBundle = {
  snapshots: Partial<Record<PalworldTranslationLocale, PalworldTranslationSnapshot>>;
  states: Record<PalworldTranslationLocale, PalworldTranslationLocaleLoadState>;
};

type CanonicalReviewedName = {
  kind: "pal" | "item";
  id: string;
  en: string;
  ko: string;
  ja: string;
  sourceSha256: string;
};

type PalworldTranslationRuntimeContext = PalworldTranslationValidationContext & {
  reviewedNames: readonly CanonicalReviewedName[];
};

type TranslationManifest = {
  schemaVersion: 1;
  release: string;
  sourceCatalogSha256: string;
  sourcePaldexSha256: string;
  glossarySha256: string;
  sourceRevision: string;
  translationRevision: string;
  generatedAt: string;
  locales: Record<PalworldTranslationLocale, {
    file: string;
    sha256: string;
    recordCount: number;
  }>;
};

type EnglishCopyAllowlistEntry = {
  locale: PalworldTranslationLocale;
  kind: PalworldTranslationRecordKind;
  id: string;
  field: PalworldTranslationField;
  reason: string;
};

class PalworldTranslationArtifactError extends Error {
  constructor(
    readonly safeCode: Exclude<PalworldTranslationLoadErrorCode, "PALWORLD_TRANSLATION_MISSING">,
    message: string,
    readonly staleSourceHash = false
  ) {
    super(message);
    this.name = "PalworldTranslationArtifactError";
  }
}

function fail(
  code: Exclude<PalworldTranslationLoadErrorCode, "PALWORLD_TRANSLATION_MISSING">,
  pathName: string,
  message: string,
  staleSourceHash = false
): never {
  throw new PalworldTranslationArtifactError(code, `${pathName}: ${message}`, staleSourceHash);
}

function recordAt(value: unknown, pathName: string, allowedKeys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("PALWORLD_TRANSLATION_MANIFEST_INVALID", pathName, "객체여야 합니다.");
  }
  const valueRecord = value as Record<string, unknown>;
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(valueRecord)) {
    if (!allowed.has(key)) fail("PALWORLD_TRANSLATION_MANIFEST_INVALID", `${pathName}.${key}`, "허용되지 않은 필드입니다.");
  }
  return valueRecord;
}

function stringAt(value: unknown, pathName: string, maxLength = 256): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength || value.includes("\0")) {
    fail("PALWORLD_TRANSLATION_MANIFEST_INVALID", pathName, `비어 있지 않은 ${maxLength}자 이하 문자열이어야 합니다.`);
  }
  return value;
}

function shaAt(value: unknown, pathName: string): string {
  const hash = stringAt(value, pathName, 64);
  if (!SHA256_PATTERN.test(hash)) fail("PALWORLD_TRANSLATION_MANIFEST_INVALID", pathName, "소문자 64자리 SHA-256이어야 합니다.");
  return hash;
}

function isoAt(value: unknown, pathName: string): string {
  const text = stringAt(value, pathName, 64);
  if (Number.isNaN(Date.parse(text))) fail("PALWORLD_TRANSLATION_MANIFEST_INVALID", pathName, "올바른 ISO 날짜여야 합니다.");
  return text;
}

async function readRegularFile(filePath: string, maxBytes: number): Promise<Buffer> {
  const canonicalPath = path.resolve(filePath);
  const parentPath = path.dirname(canonicalPath);
  const parentInfo = await lstat(parentPath);
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink() || await realpath(parentPath) !== parentPath) {
    fail("PALWORLD_TRANSLATION_MANIFEST_INVALID", "locales", "symlink가 아닌 canonical directory여야 합니다.");
  }
  const info = await lstat(canonicalPath);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 2 || info.size > maxBytes) {
    fail("PALWORLD_TRANSLATION_MANIFEST_INVALID", path.basename(canonicalPath), "허용 크기의 regular file이어야 합니다.");
  }
  const handle = await open(canonicalPath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== info.dev || opened.ino !== info.ino || opened.size !== info.size) {
      fail("PALWORLD_TRANSLATION_MANIFEST_INVALID", path.basename(canonicalPath), "검사한 파일과 열린 파일이 일치하지 않습니다.");
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

function parseJson(buffer: Buffer, pathName: string): unknown {
  try {
    return JSON.parse(buffer.toString("utf8")) as unknown;
  } catch {
    fail("PALWORLD_TRANSLATION_MANIFEST_INVALID", pathName, "올바른 JSON이어야 합니다.");
  }
}

function assertManifest(value: unknown): TranslationManifest {
  const root = recordAt(value, "translationManifest", [
    "schemaVersion",
    "release",
    "sourceCatalogSha256",
    "sourcePaldexSha256",
    "glossarySha256",
    "sourceRevision",
    "translationRevision",
    "generatedAt",
    "locales"
  ]);
  if (root.schemaVersion !== 1) {
    fail("PALWORLD_TRANSLATION_MANIFEST_INVALID", "translationManifest.schemaVersion", "1이어야 합니다.");
  }
  if (root.release !== PALWORLD_CATALOG_RELEASE) {
    fail("PALWORLD_TRANSLATION_MANIFEST_INVALID", "translationManifest.release", "고정 release와 일치해야 합니다.", true);
  }
  shaAt(root.sourceCatalogSha256, "translationManifest.sourceCatalogSha256");
  shaAt(root.sourcePaldexSha256, "translationManifest.sourcePaldexSha256");
  shaAt(root.glossarySha256, "translationManifest.glossarySha256");
  stringAt(root.sourceRevision, "translationManifest.sourceRevision");
  stringAt(root.translationRevision, "translationManifest.translationRevision");
  isoAt(root.generatedAt, "translationManifest.generatedAt");
  const locales = recordAt(root.locales, "translationManifest.locales", ["ko", "ja"]);
  for (const locale of ["ko", "ja"] as const) {
    const entry = recordAt(locales[locale], `translationManifest.locales.${locale}`, ["file", "sha256", "recordCount"]);
    if (entry.file !== LOCALE_FILES[locale]) {
      fail("PALWORLD_TRANSLATION_MANIFEST_INVALID", `translationManifest.locales.${locale}.file`, "고정 locale 파일명이어야 합니다.");
    }
    shaAt(entry.sha256, `translationManifest.locales.${locale}.sha256`);
    if (!Number.isInteger(entry.recordCount) || (entry.recordCount as number) < 0 || (entry.recordCount as number) > 100_000) {
      fail("PALWORLD_TRANSLATION_MANIFEST_INVALID", `translationManifest.locales.${locale}.recordCount`, "허용 범위 정수여야 합니다.");
    }
  }
  return root as TranslationManifest;
}

function assertGlossary(value: unknown): {
  sourceCatalogSha256: string;
  sourcePaldexSha256: string;
  reviewedNames: Map<string, { kind: "pal" | "item"; id: string; en: string; ko: string; ja: string; sourceSha256: string }>;
  allowlist: EnglishCopyAllowlistEntry[];
} {
  const root = recordAt(value, "translationGlossary", [
    "schemaVersion",
    "release",
    "sourceCatalogSha256",
    "sourcePaldexSha256",
    "generatedAt",
    "reviewedNames",
    "palNames",
    "terms",
    "nameCollisions",
    "englishCopyAllowlist"
  ]);
  if (root.schemaVersion !== 1) {
    fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", "translationGlossary.schemaVersion", "1이어야 합니다.");
  }
  if (root.release !== PALWORLD_CATALOG_RELEASE) {
    fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", "translationGlossary.release", "고정 release와 일치해야 합니다.", true);
  }
  if (
    (!Array.isArray(root.reviewedNames) && !Array.isArray(root.palNames))
    || (root.reviewedNames !== undefined && root.palNames !== undefined)
    || !Array.isArray(root.terms)
    || !Array.isArray(root.nameCollisions)
    || !Array.isArray(root.englishCopyAllowlist)
  ) {
    fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", "translationGlossary", "고정 release glossary schema와 일치해야 합니다.");
  }
  const sourceCatalogSha256 = shaAt(root.sourceCatalogSha256, "translationGlossary.sourceCatalogSha256");
  const sourcePaldexSha256 = shaAt(root.sourcePaldexSha256, "translationGlossary.sourcePaldexSha256");
  isoAt(root.generatedAt, "translationGlossary.generatedAt");
  const reviewedNameEntries = (root.reviewedNames ?? root.palNames) as unknown[];
  const legacyPalNames = root.reviewedNames === undefined;
  if (reviewedNameEntries.length > 10_000 || root.terms.length > 10_000 || root.nameCollisions.length > 10_000) {
    fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", "translationGlossary", "glossary collection 크기 제한을 초과했습니다.");
  }
  const reviewedNameIds = new Set<string>();
  const reviewedNames = new Map<string, { kind: "pal" | "item"; id: string; en: string; ko: string; ja: string; sourceSha256: string }>();
  for (const [index, valueEntry] of reviewedNameEntries.entries()) {
    const entryPath = `translationGlossary.reviewedNames[${index}]`;
    const entry = recordAt(valueEntry, entryPath, legacyPalNames
      ? ["id", "en", "ko", "ja", "sourceSha256"]
      : ["kind", "id", "en", "ko", "ja", "sourceSha256"]);
    const kind = legacyPalNames ? "pal" : entry.kind;
    if (kind !== "pal" && kind !== "item") {
      fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `${entryPath}.kind`, "pal 또는 item이어야 합니다.");
    }
    const id = stringAt(entry.id, `${entryPath}.id`, 80);
    const identity = `${kind}:${id}`;
    if (!ID_PATTERN.test(id) || reviewedNameIds.has(identity)) {
      fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `${entryPath}.id`, "고유 canonical kind:id여야 합니다.");
    }
    reviewedNameIds.add(identity);
    const en = stringAt(entry.en, `${entryPath}.en`, 256);
    const ko = stringAt(entry.ko, `${entryPath}.ko`, 256);
    const ja = stringAt(entry.ja, `${entryPath}.ja`, 256);
    const sourceHash = shaAt(entry.sourceSha256, `${entryPath}.sourceSha256`);
    if (createHash("sha256").update(en, "utf8").digest("hex") !== sourceHash) {
      fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `${entryPath}.sourceSha256`, "영문 이름 hash와 일치하지 않습니다.");
    }
    reviewedNames.set(identity, { kind, id, en, ko, ja, sourceSha256: sourceHash });
  }
  const termKeys = new Set<string>();
  const termTranslations = new Map<string, { ko: string; ja: string }>();
  for (const [index, valueEntry] of root.terms.entries()) {
    const entry = recordAt(valueEntry, `translationGlossary.terms[${index}]`, ["key", "en", "ko", "ja", "domain"]);
    const key = stringAt(entry.key, `translationGlossary.terms[${index}].key`, 128);
    if (termKeys.has(key)) fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `translationGlossary.terms[${index}].key`, "중복 용어 key입니다.");
    termKeys.add(key);
    const en = stringAt(entry.en, `translationGlossary.terms[${index}].en`, 256);
    const ko = stringAt(entry.ko, `translationGlossary.terms[${index}].ko`, 256);
    const ja = stringAt(entry.ja, `translationGlossary.terms[${index}].ja`, 256);
    stringAt(entry.domain, `translationGlossary.terms[${index}].domain`, 256);
    const existing = termTranslations.get(en);
    if (existing !== undefined && (existing.ko !== ko || existing.ja !== ja)) {
      fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `translationGlossary.terms[${index}]`, "같은 영문 용어의 locale 번역이 충돌합니다.");
    }
    termTranslations.set(en, { ko, ja });
  }
  const collisionKeys = new Set<string>();
  for (const [index, valueEntry] of root.nameCollisions.entries()) {
    const entry = recordAt(valueEntry, `translationGlossary.nameCollisions[${index}]`, ["kind", "english", "ids"]);
    if (entry.kind !== "pal" && entry.kind !== "item" && entry.kind !== "skill") {
      fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `translationGlossary.nameCollisions[${index}].kind`, "허용된 kind가 아닙니다.");
    }
    const english = stringAt(entry.english, `translationGlossary.nameCollisions[${index}].english`, 256);
    if (!Array.isArray(entry.ids) || entry.ids.length < 2 || entry.ids.length > 100) {
      fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `translationGlossary.nameCollisions[${index}].ids`, "2~100개 ID 배열이어야 합니다.");
    }
    const ids = entry.ids.map((idValue, idIndex) => {
      const id = stringAt(idValue, `translationGlossary.nameCollisions[${index}].ids[${idIndex}]`, 80);
      if (!ID_PATTERN.test(id)) fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `translationGlossary.nameCollisions[${index}].ids[${idIndex}]`, "canonical ID 형식이어야 합니다.");
      return id;
    });
    if (new Set(ids).size !== ids.length) {
      fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `translationGlossary.nameCollisions[${index}].ids`, "중복 ID가 있습니다.");
    }
    const collisionKey = `${entry.kind}:${english}`;
    if (collisionKeys.has(collisionKey)) {
      fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `translationGlossary.nameCollisions[${index}]`, "중복 충돌 기록입니다.");
    }
    collisionKeys.add(collisionKey);
  }
  if (root.englishCopyAllowlist.length > 10_000) {
    fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", "translationGlossary.englishCopyAllowlist", "최대 10000개까지 허용됩니다.");
  }
  const seen = new Set<string>();
  const allowlist = root.englishCopyAllowlist.map((valueEntry, index) => {
    const entry = recordAt(valueEntry, `translationGlossary.englishCopyAllowlist[${index}]`, [
      "locale",
      "kind",
      "id",
      "field",
      "reason"
    ]);
    if (entry.locale !== "ko" && entry.locale !== "ja") {
      fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `translationGlossary.englishCopyAllowlist[${index}].locale`, "ko 또는 ja여야 합니다.");
    }
    if (entry.kind !== "pal" && entry.kind !== "item" && entry.kind !== "skill") {
      fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `translationGlossary.englishCopyAllowlist[${index}].kind`, "허용된 kind가 아닙니다.");
    }
    const id = stringAt(entry.id, `translationGlossary.englishCopyAllowlist[${index}].id`, 80);
    if (!ID_PATTERN.test(id)) {
      fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `translationGlossary.englishCopyAllowlist[${index}].id`, "canonical ID 형식이어야 합니다.");
    }
    if (entry.field !== "name" && entry.field !== "description" && entry.field !== "passiveAbility") {
      fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `translationGlossary.englishCopyAllowlist[${index}].field`, "허용된 번역 필드가 아닙니다.");
    }
    const reason = stringAt(entry.reason, `translationGlossary.englishCopyAllowlist[${index}].reason`, 500);
    const key = `${entry.locale}:${entry.kind}:${id}:${entry.field}`;
    if (seen.has(key)) fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `translationGlossary.englishCopyAllowlist[${index}]`, "중복 예외입니다.");
    seen.add(key);
    return {
      locale: entry.locale,
      kind: entry.kind,
      id,
      field: entry.field,
      reason
    } as EnglishCopyAllowlistEntry;
  });
  return { sourceCatalogSha256, sourcePaldexSha256, reviewedNames, allowlist };
}

function sourceField(text: string): PalworldTranslationSourceField {
  return {
    text,
    sha256: createHash("sha256").update(text, "utf8").digest("hex")
  };
}

export function createPalworldTranslationValidationContext(input: {
  catalog: PalworldCatalogArtifact;
  catalogSha256: string;
  paldex: PalworldPaldexRuntimeRelease;
  paldexSha256: string;
  reviewedItemAliases?: readonly PalworldReviewedItemAlias[];
  englishCopyAllowlist?: readonly string[];
}): PalworldTranslationRuntimeContext {
  const palDetailsById = new Map(input.catalog.palDetails.map((detail) => [detail.palId, detail]));
  const records: PalworldTranslationSourceRecord[] = [
    ...input.paldex.pals.map((pal) => ({
      id: pal.id,
      kind: "pal" as const,
      fields: {
        name: sourceField(pal.nameEn),
        ...(palDetailsById.get(pal.id)?.descriptionEn === undefined ? {} : {
          description: sourceField(palDetailsById.get(pal.id)!.descriptionEn!)
        })
      }
    })),
    ...input.catalog.items.map((item) => ({
      id: item.id,
      kind: "item" as const,
      fields: {
        name: sourceField(item.nameEn),
        ...(item.descriptionEn === undefined ? {} : { description: sourceField(item.descriptionEn) })
      }
    })),
    ...input.catalog.skills.map((skill) => ({
      id: skill.id,
      kind: "skill" as const,
      fields: {
        name: sourceField(skill.nameEn),
        ...(skill.descriptionEn === undefined ? {} : { description: sourceField(skill.descriptionEn) }),
        ...(skill.passiveAbility === undefined ? {} : { passiveAbility: sourceField(skill.passiveAbility) })
      }
    }))
  ].sort((left, right) => `${left.kind}:${left.id}` < `${right.kind}:${right.id}` ? -1 : 1);
  const sourceNames = new Map(records.map((record) => [`${record.kind}:${record.id}`, record.fields.name!]));
  const aliasedLocalizedItems = localizedReviewedItemsByCanonicalId(input.reviewedItemAliases ?? []);
  const reviewedNames: CanonicalReviewedName[] = [
    ...input.paldex.pals.map((pal) => ({
      kind: "pal" as const,
      id: pal.id,
      en: pal.nameEn,
      ko: pal.nameKo,
      ja: pal.nameJa,
      sourceSha256: sourceNames.get(`pal:${pal.id}`)!.sha256,
    })),
    ...PALWORLD_SNAPSHOT.items.flatMap((item) => {
      const source = sourceNames.get(`item:${item.id}`);
      if (source === undefined) return [];
      if (item.nameKo === undefined || item.nameJa === undefined) return [];
      // Canonical catalog가 갱신되어 기존 locale item의 영문 이름과 달라진 경우에는
      // 이 항목을 검수 이름으로 신뢰하지 않는다. 이후 glossary 집합 검증이 번역
      // artifact만 stale 상태로 차단하며, 공개 Palworld 기본 데이터는 계속 제공한다.
      if (source.text !== item.nameEn) return [];
      return [{
        kind: "item" as const,
        id: item.id,
        en: item.nameEn,
        ko: item.nameKo,
        ja: item.nameJa,
        sourceSha256: source.sha256,
      }];
    }),
    ...(input.reviewedItemAliases ?? []).map((alias) => {
      const item = aliasedLocalizedItems.get(alias.canonicalId);
      const source = sourceNames.get(`item:${alias.canonicalId}`);
      if (
        item === undefined
        || item.nameKo === undefined
        || item.nameJa === undefined
        || source === undefined
        || source.text !== alias.nameEn
      ) {
        throw new TypeError(`Palworld 검수 아이템 alias가 canonical source와 일치하지 않습니다: ${alias.canonicalId}`);
      }
      return {
        kind: "item" as const,
        id: alias.canonicalId,
        en: alias.nameEn,
        ko: item.nameKo,
        ja: item.nameJa,
        sourceSha256: source.sha256,
      };
    }),
  ].sort((left, right) => `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`, "en"));
  return {
    release: PALWORLD_CATALOG_RELEASE,
    sourceCatalogSha256: input.catalogSha256,
    sourcePaldexSha256: input.paldexSha256,
    sourceRevision: input.catalog.metadata.sourceRevision,
    records,
    reviewedNames,
    ...(input.englishCopyAllowlist === undefined ? {} : { englishCopyAllowlist: [...input.englishCopyAllowlist] })
  };
}

function missingBundle(): PalworldTranslationBundle {
  return {
    snapshots: {},
    states: {
      ko: { status: "missing", errorCode: "PALWORLD_TRANSLATION_MISSING", staleSourceHash: false },
      ja: { status: "missing", errorCode: "PALWORLD_TRANSLATION_MISSING", staleSourceHash: false }
    }
  };
}

function invalidBundle(error: PalworldTranslationArtifactError): PalworldTranslationBundle {
  return {
    snapshots: {},
    states: {
      ko: { status: "invalid", errorCode: error.safeCode, staleSourceHash: error.staleSourceHash },
      ja: { status: "invalid", errorCode: error.safeCode, staleSourceHash: error.staleSourceHash }
    }
  };
}

function scopedArtifactError(
  error: unknown,
  safeCode: Exclude<PalworldTranslationLoadErrorCode, "PALWORLD_TRANSLATION_MISSING">,
  message: string
): PalworldTranslationArtifactError {
  if (error instanceof PalworldTranslationArtifactError) {
    return new PalworldTranslationArtifactError(safeCode, message, error.staleSourceHash);
  }
  return new PalworldTranslationArtifactError(safeCode, message);
}

type ReviewedNameEntry = { kind: "pal" | "item"; id: string; en: string; ko: string; ja: string; sourceSha256: string };

function assertHumanReviewedNames(
  snapshot: PalworldTranslationSnapshot,
  locale: PalworldTranslationLocale,
  glossaryNames: ReadonlyMap<string, ReviewedNameEntry>
): void {
  const snapshotNames = new Map<string, PalworldTranslationFieldValue>();
  for (const record of snapshot.records) {
    const name = record.fields.name;
    if (name === undefined) continue;
    const identity = `${record.kind}:${record.id}`;
    snapshotNames.set(identity, name);
    if (name.status !== "human_reviewed") continue;
    const expected = glossaryNames.get(identity)?.[locale];
    if (expected === undefined || name.text !== expected) {
      fail(
        "PALWORLD_TRANSLATION_LOCALE_INVALID",
        `${locale}.records.${record.id}.fields.name`,
        "human_reviewed 이름이 고정 glossary와 일치하지 않습니다."
      );
    }
  }
  for (const [identity, glossary] of glossaryNames) {
    const name = snapshotNames.get(identity);
    if (name?.status !== "human_reviewed" || name.text !== glossary[locale]) {
      fail("PALWORLD_TRANSLATION_LOCALE_INVALID", `${locale}.records.${identity}.fields.name`, "검수 이름이 locale snapshot에서 human_reviewed로 고정되지 않았습니다.");
    }
  }
}

function assertCanonicalGlossaryReviewedNames(
  glossaryNames: ReadonlyMap<string, ReviewedNameEntry>,
  context: PalworldTranslationRuntimeContext
): void {
  const canonicalNames = new Map(context.reviewedNames.map((entry) => [`${entry.kind}:${entry.id}`, entry]));
  if (glossaryNames.size !== canonicalNames.size) {
    fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", "translationGlossary.reviewedNames", "canonical Pal 및 exact item 검수 이름 집합과 일치하지 않습니다.", true);
  }
  for (const [identity, glossary] of glossaryNames) {
    const canonical = canonicalNames.get(identity);
    if (
      canonical === undefined
      || glossary.en !== canonical.en
      || glossary.ko !== canonical.ko
      || glossary.ja !== canonical.ja
      || glossary.sourceSha256 !== canonical.sourceSha256
    ) {
      fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", `translationGlossary.reviewedNames.${identity}`, "canonical kind:id·영문·KO·JA 이름·source hash와 일치하지 않습니다.", true);
    }
  }
}

export async function loadPalworldTranslationBundle(input: {
  releaseRoot: string;
  context: PalworldTranslationRuntimeContext;
}): Promise<PalworldTranslationBundle> {
  const localeRoot = path.resolve(input.releaseRoot, PALWORLD_TRANSLATION_DIRECTORY);
  let manifestBuffer: Buffer;
  try {
    manifestBuffer = await readRegularFile(
      path.join(localeRoot, PALWORLD_TRANSLATION_MANIFEST_FILE),
      MAX_MANIFEST_FILE_BYTES
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return missingBundle();
    const safeError = error instanceof PalworldTranslationArtifactError
      ? error
      : new PalworldTranslationArtifactError("PALWORLD_TRANSLATION_MANIFEST_INVALID", "번역 manifest를 읽을 수 없습니다.");
    return invalidBundle(safeError);
  }
  try {
    const manifest = assertManifest(parseJson(manifestBuffer, PALWORLD_TRANSLATION_MANIFEST_FILE));
    if (
      manifest.sourceCatalogSha256 !== input.context.sourceCatalogSha256
      || manifest.sourcePaldexSha256 !== input.context.sourcePaldexSha256
      || manifest.sourceRevision !== input.context.sourceRevision
    ) {
      fail("PALWORLD_TRANSLATION_MANIFEST_INVALID", "translationManifest", "현재 source와 일치하지 않습니다.", true);
    }
    let glossary: ReturnType<typeof assertGlossary>;
    try {
      const glossaryBuffer = await readRegularFile(
        path.join(localeRoot, PALWORLD_TRANSLATION_GLOSSARY_FILE),
        MAX_GLOSSARY_FILE_BYTES
      );
      const glossaryHash = createHash("sha256").update(glossaryBuffer).digest("hex");
      if (glossaryHash !== manifest.glossarySha256) {
        fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", "translationGlossary", "manifest checksum과 일치하지 않습니다.");
      }
      glossary = assertGlossary(parseJson(glossaryBuffer, PALWORLD_TRANSLATION_GLOSSARY_FILE));
    } catch (error) {
      throw scopedArtifactError(
        error,
        "PALWORLD_TRANSLATION_GLOSSARY_INVALID",
        "번역 glossary를 읽거나 검증할 수 없습니다."
      );
    }
    if (
      glossary.sourceCatalogSha256 !== input.context.sourceCatalogSha256
      || glossary.sourcePaldexSha256 !== input.context.sourcePaldexSha256
    ) {
      fail("PALWORLD_TRANSLATION_GLOSSARY_INVALID", "translationGlossary", "현재 catalog/Paldex checksum과 일치하지 않습니다.", true);
    }
    assertCanonicalGlossaryReviewedNames(glossary.reviewedNames, input.context);
    const snapshots: Partial<Record<PalworldTranslationLocale, PalworldTranslationSnapshot>> = {};
    const states = {} as Record<PalworldTranslationLocale, PalworldTranslationLocaleLoadState>;
    for (const locale of ["ko", "ja"] as const) {
      try {
        const localeBuffer = await readRegularFile(
          path.join(localeRoot, LOCALE_FILES[locale]),
          MAX_TRANSLATION_FILE_BYTES
        );
        const localeHash = createHash("sha256").update(localeBuffer).digest("hex");
        if (localeHash !== manifest.locales[locale].sha256) {
          fail("PALWORLD_TRANSLATION_LOCALE_INVALID", locale, "manifest checksum과 일치하지 않습니다.");
        }
        const result = validatePalworldTranslationSnapshot(
          parseJson(localeBuffer, LOCALE_FILES[locale]),
          {
            ...input.context,
            englishCopyAllowlist: glossary.allowlist
              .filter((entry) => entry.locale === locale)
              .map((entry) => `${entry.kind}:${entry.id}:${entry.field}`)
          }
        );
        if (!result.ok) {
          const stale = /translation\.(?:release|source(?:CatalogSha256|PaldexSha256|Revision|Sha256))/u.test(result.error);
          fail("PALWORLD_TRANSLATION_LOCALE_INVALID", locale, "locale artifact 검증에 실패했습니다.", stale);
        }
        if (
          result.data.release !== PALWORLD_CATALOG_RELEASE
          || result.data.locale !== locale
          || result.data.translationRevision !== manifest.translationRevision
          || result.data.records.length !== manifest.locales[locale].recordCount
        ) {
          fail("PALWORLD_TRANSLATION_LOCALE_INVALID", locale, "manifest metadata와 일치하지 않습니다.");
        }
        assertHumanReviewedNames(result.data, locale, glossary.reviewedNames);
        snapshots[locale] = result.data;
        states[locale] = { status: "loaded", staleSourceHash: false };
      } catch (error) {
        const safeError = scopedArtifactError(
          error,
          "PALWORLD_TRANSLATION_LOCALE_INVALID",
          `${locale} locale artifact를 읽거나 검증할 수 없습니다.`
        );
        states[locale] = {
          status: "invalid",
          errorCode: safeError.safeCode,
          staleSourceHash: safeError.staleSourceHash
        };
      }
    }
    return { snapshots, states };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return missingBundle();
    const safeError = error instanceof PalworldTranslationArtifactError
      ? error
      : new PalworldTranslationArtifactError("PALWORLD_TRANSLATION_MANIFEST_INVALID", "번역 manifest를 읽을 수 없습니다.");
    return invalidBundle(safeError);
  }
}
