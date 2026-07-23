import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PALWORLD_SNAPSHOT } from "../data/palworld-snapshot.js";
import type { PalworldCatalogArtifact } from "../data/palworld-catalog-artifact.js";
import {
  loadPalworldReviewedItemAliases,
  localizedReviewedItemsByCanonicalId,
} from "../data/palworld-reviewed-item-aliases.js";

export const PALWORLD_TRANSLATION_SCHEMA_VERSION = 1 as const;
export const PALWORLD_TRANSLATION_RELEASE = "1.0.1" as const;
export const PALWORLD_TRANSLATION_BATCH_SIZE = 150 as const;
export const PALWORLD_TRANSLATION_FIXED_TIME = "2026-07-22T00:00:00.000Z" as const;
export const PALWORLD_TRANSLATION_SOURCE_ANOMALY_NOTE = "source_anomaly_preserved" as const;
export const PALWORLD_TRANSLATION_MISSING_SOURCE_MARKER = {
  ko: "[원문 누락]",
  ja: "[原文欠落]",
} as const;

export type TranslationLocale = "ko" | "ja";
export type TranslationKind = "pal" | "item" | "skill";
export type TranslationFieldName = "name" | "description" | "passiveAbility";
export type TranslationReviewStatus = "human_reviewed" | "machine_assisted";

export interface TranslationSourceField {
  sourceText: string;
  sourceSha256: string;
}

export type TranslationSourceAnomalyCode =
  | "empty_parentheses"
  | "missing_value_before_period"
  | "missing_value_before_comma";

export interface TranslationSourceAnomaly {
  codes: TranslationSourceAnomalyCode[];
  missingSlotCount: number;
}

export interface TranslationCorpusRecord {
  id: string;
  kind: TranslationKind;
  fields: Partial<Record<TranslationFieldName, TranslationSourceField>>;
}

export interface TranslationField {
  sourceSha256: string;
  text: string;
  status: TranslationReviewStatus;
  note?: string;
}

export interface TranslationRecord {
  id: string;
  kind: TranslationKind;
  fields: Partial<Record<TranslationFieldName, TranslationField>>;
}

export interface TranslationSnapshot {
  schemaVersion: 1;
  release: string;
  locale: TranslationLocale;
  sourceCatalogSha256: string;
  sourcePaldexSha256: string;
  sourceRevision: string;
  translationRevision: string;
  translationMethod: "machine_assisted" | "human_reviewed" | "mixed";
  translationStatus: "complete" | "incomplete";
  translatedAt: string;
  reviewedAt: string | null;
  records: TranslationRecord[];
}

interface CatalogEntity {
  id?: unknown;
  nameEn?: unknown;
  descriptionEn?: unknown;
  passiveAbility?: unknown;
}

interface CatalogArtifact {
  release?: unknown;
  metadata?: { sourceRevision?: unknown };
  items?: unknown;
  skills?: unknown;
}

interface PaldexArtifact {
  release?: unknown;
  records?: unknown;
}

interface PaldexEntity extends CatalogEntity {
  nameKo?: unknown;
  nameJa?: unknown;
}

export interface TranslationSources {
  catalog: CatalogArtifact;
  paldex: PaldexArtifact;
  catalogSha256: string;
  paldexSha256: string;
  sourceRevision: string;
  corpus: TranslationCorpusRecord[];
  reviewedNames: Array<{
    kind: "pal" | "item";
    id: string;
    en: string;
    ko: string;
    ja: string;
    sourceSha256: string;
  }>;
}

export interface TranslationNameCollision {
  kind: TranslationKind;
  english: string;
  ids: string[];
}

export interface TranslationNameCollisionOverride {
  kind: TranslationKind;
  english: string;
  ids: string[];
  resolution: "translate_each_canonical_id";
  reason: string;
}

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const RELEASE_ROOT = path.join(SERVER_ROOT, "data", "palworld", PALWORLD_TRANSLATION_RELEASE);
export const LOCALES_ROOT = path.join(RELEASE_ROOT, "locales");
export const SOURCE_BATCH_ROOT = path.join(LOCALES_ROOT, "source-batches");
export const CANDIDATE_ROOT = path.join(LOCALES_ROOT, "candidates");
export const GLOSSARY_OVERRIDE_FILE = path.join(LOCALES_ROOT, "glossary-overrides.json");

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const FIELD_ORDER: readonly TranslationFieldName[] = ["name", "description", "passiveAbility"];
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_TRANSLATION_LENGTH = 4_000;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const HTML_PATTERN = /<\/?[a-z][^>]*>|<script\b|javascript:/iu;
const EMPTY_PARENTHESES_PATTERN = /\(\)/gu;
const MISSING_VALUE_BEFORE_PERIOD_PATTERN = /(?:^|\s)\.(?=\s|$)/gu;
const MISSING_VALUE_BEFORE_COMMA_PATTERN = /(?:^|\s),(?=\s|$)/gu;
const PLACEHOLDER_RESIDUE_PATTERN = /XQZ|missing\s+source\s+value|ソース値が不足|원문\s*값\s*누락/iu;
const KOREAN_SCRIPT_PATTERN = /[\p{Script=Hangul}]/u;
const JAPANESE_SCRIPT_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const MACHINE_NAME_DENYLIST: Readonly<Record<TranslationLocale, ReadonlySet<string>>> = {
  ko: new Set(["회사 소개", "지금 연락"]),
  ja: new Set(["クアッドマックス", "夏期マックス", "サドル。"]),
};
const MACHINE_NAME_STRUCTURE_TOKENS = [
  { english: "Schematic", ko: ["설계도"], ja: ["設計図"] },
  { english: "Saddle", ko: ["안장"], ja: ["サドル", "鞍"] },
  { english: "Ring", ko: ["반지", "링"], ja: ["指輪", "リング"] },
  { english: "Meat", ko: ["고기", "육"], ja: ["肉", "ミート"] },
  { english: "Egg", ko: ["알", "달걀"], ja: ["卵", "タマゴ", "エッグ"] },
  { english: "Charm", ko: ["부적"], ja: ["お守り", "チャーム"] },
  { english: "Sphere", ko: ["스피어"], ja: ["スフィア"] },
] as const;

function fail(message: string): never {
  throw new TypeError(`Palworld 번역 artifact 오류: ${message}`);
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function matchCount(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length;
}

const NUMERIC_UNIT_PATTERN = /(?:(?<![A-Za-z])(lv\.?|levels?|레벨|レベル)\s*)?(\d+(?:[.,]\d+)*)(?:\s*-?\s*(milliseconds?|ms|seconds?|secs?|s|minutes?|mins?|hours?|hrs?|days?|years?|kilograms?|kg|grams?|g|kilometers?|km|meters?|m|%|[x×]|lv\.?|levels?|units?|shots?|times?|킬로그램|그램|킬로미터|미터|밀리초|초|분|시간|일|년|레벨|배|단위|발|회|キログラム|グラム|キロメートル|メートル|ミリ秒|秒|分|時間|日|年|レベル|倍|単位|発|回))?(?![A-Za-z0-9])/giu;

function canonicalUnit(value: string | undefined): string {
  const unit = value?.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\./gu, "");
  if (!unit) return "";
  if (unit === "%") return "%";
  if (unit === "x" || unit === "×" || unit === "배" || unit === "倍") return "x";
  if (["kg", "kilogram", "kilograms", "킬로그램", "キログラム"].includes(unit)) return "kg";
  if (["g", "gram", "grams", "그램", "グラム"].includes(unit)) return "g";
  if (["km", "kilometer", "kilometers", "킬로미터", "キロメートル"].includes(unit)) return "km";
  if (["m", "meter", "meters", "미터", "メートル"].includes(unit)) return "m";
  if (["ms", "millisecond", "milliseconds", "밀리초", "ミリ秒"].includes(unit)) return "ms";
  if (["s", "sec", "secs", "second", "seconds", "초", "秒"].includes(unit)) return "s";
  if (["min", "mins", "minute", "minutes", "분", "分"].includes(unit)) return "min";
  if (["hr", "hrs", "hour", "hours", "시간", "時間"].includes(unit)) return "h";
  if (["day", "days", "일", "日"].includes(unit)) return "day";
  if (["year", "years", "년", "年"].includes(unit)) return "year";
  if (["lv", "level", "levels", "레벨", "レベル"].includes(unit)) return "level";
  if (["unit", "units", "단위", "単位"].includes(unit)) return "unit";
  if (["shot", "shots", "발", "発"].includes(unit)) return "shot";
  if (["time", "times", "회", "回"].includes(unit)) return "times";
  return unit;
}

function numericSignature(value: string): { numbers: string[]; boundUnits: string[] } {
  const numbers: string[] = [];
  const boundUnits: string[] = [];
  for (const match of value.normalize("NFKC").matchAll(NUMERIC_UNIT_PATTERN)) {
    const number = match[2]!;
    const unit = canonicalUnit(match[1] ?? match[3]);
    numbers.push(number);
    boundUnits.push(`${number}|${unit}`);
  }
  return { numbers, boundUnits };
}

function glossaryTermAppearsInName(sourceText: string, englishTerm: string): boolean {
  const escaped = englishTerm.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "u").test(sourceText);
}

function canonicalMachineName(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function englishNameContainsCanonicalName(sourceText: string, canonicalName: string): boolean {
  const escaped = canonicalName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "iu").test(sourceText);
}

function visibleCharacterCount(value: string): number {
  return Array.from(value.normalize("NFKC").replace(/\s+/gu, " ").trim()).length;
}

function hasLocaleScript(value: string, locale: TranslationLocale): boolean {
  return (locale === "ko" ? KOREAN_SCRIPT_PATTERN : JAPANESE_SCRIPT_PATTERN).test(value);
}

function hasDegenerateRepeatedNgram(value: string): boolean {
  const characters = Array.from(value.normalize("NFKC").replace(/\s+/gu, " ").trim());
  for (const gramLength of [3, 4]) {
    for (let offset = 0; offset + gramLength * 3 <= characters.length; offset += 1) {
      const gram = characters.slice(offset, offset + gramLength).join("");
      let repetitions = 1;
      while (
        offset + gramLength * (repetitions + 1) <= characters.length
        && characters.slice(
          offset + gramLength * repetitions,
          offset + gramLength * (repetitions + 1),
        ).join("") === gram
      ) {
        repetitions += 1;
      }
      if (repetitions >= 3 && gramLength * repetitions >= 12) return true;
    }
  }
  return false;
}

function sourceClauseCount(value: string): number {
  return value.split(/[.!?;:]+/u).map((part) => part.trim()).filter(Boolean).length;
}

function validateMachineTranslationQuality(
  sourceText: string,
  translatedText: string,
  locale: TranslationLocale,
  allowEnglishCopy: boolean,
  pathName: string,
): void {
  if (!allowEnglishCopy && !hasLocaleScript(translatedText, locale)) {
    fail(`${pathName}에 ${locale === "ko" ? "한국어" : "일본어"} 문자가 없습니다.`);
  }
  if (hasDegenerateRepeatedNgram(translatedText)) {
    fail(`${pathName}에 연속 n-gram 반복 퇴행이 있습니다.`);
  }
  const sourceLength = visibleCharacterCount(sourceText);
  const targetLength = visibleCharacterCount(translatedText);
  if (sourceLength >= 20 && targetLength >= 80 && targetLength > sourceLength * 2.5) {
    fail(`${pathName} 길이가 영어 원문보다 과도하게 증가했습니다.`);
  }
  if (
    sourceLength >= 120
    && sourceClauseCount(sourceText) >= 3
    && targetLength <= 24
    && targetLength < sourceLength * 0.2
  ) {
    fail(`${pathName}이 지나치게 짧아 영어 원문의 절 대부분이 유실되었습니다.`);
  }
}

export function analyzeTranslationSource(value: string): TranslationSourceAnomaly {
  const emptyParentheses = matchCount(value, EMPTY_PARENTHESES_PATTERN);
  const missingBeforePeriod = matchCount(value, MISSING_VALUE_BEFORE_PERIOD_PATTERN);
  const missingBeforeComma = matchCount(value, MISSING_VALUE_BEFORE_COMMA_PATTERN);
  const codes: TranslationSourceAnomalyCode[] = [];
  if (emptyParentheses > 0) codes.push("empty_parentheses");
  if (missingBeforePeriod > 0) codes.push("missing_value_before_period");
  if (missingBeforeComma > 0) codes.push("missing_value_before_comma");
  return {
    codes,
    missingSlotCount: emptyParentheses + missingBeforePeriod + missingBeforeComma,
  };
}

function requiredString(value: unknown, field: string, maximum = MAX_TRANSLATION_LENGTH): string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || value.length > maximum) {
    fail(`${field}는 앞뒤 공백 없는 1~${maximum}자 문자열이어야 합니다.`);
  }
  if (CONTROL_CHARACTER_PATTERN.test(value)) fail(`${field}에 제어문자를 허용하지 않습니다.`);
  return value;
}

function optionalSourceText(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredString(value, field);
}

function entityId(value: unknown, field: string): string {
  const result = requiredString(value, field, 128);
  if (!ID_PATTERN.test(result)) fail(`${field} 형식이 올바르지 않습니다.`);
  return result;
}

function assertPlainObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${field}는 객체여야 합니다.`);
  return value as Record<string, unknown>;
}

function assertOnlyKeys(value: Record<string, unknown>, keys: readonly string[], field: string): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${field}.${key}는 허용되지 않은 필드입니다.`);
  }
}

async function readBoundedJson<T>(filePath: string): Promise<{ value: T; bytes: Buffer }> {
  const linkStat = await lstat(filePath);
  const fileStat = await stat(filePath);
  if (linkStat.isSymbolicLink() || !fileStat.isFile() || fileStat.size <= 0 || fileStat.size > MAX_SOURCE_BYTES) {
    fail(`${path.basename(filePath)} 크기 또는 파일 형식이 올바르지 않습니다.`);
  }
  const bytes = await readFile(filePath);
  try {
    return { value: JSON.parse(bytes.toString("utf8")) as T, bytes };
  } catch {
    fail(`${path.basename(filePath)}가 올바른 JSON이 아닙니다.`);
  }
}

function sourceFields(entity: CatalogEntity, pathName: string): Partial<Record<TranslationFieldName, TranslationSourceField>> {
  const fields: Partial<Record<TranslationFieldName, TranslationSourceField>> = {};
  const values: Array<[TranslationFieldName, unknown]> = [
    ["name", entity.nameEn],
    ["description", entity.descriptionEn],
    ["passiveAbility", entity.passiveAbility],
  ];
  for (const [field, input] of values) {
    const sourceText = optionalSourceText(input, `${pathName}.${field}En`);
    if (sourceText !== undefined) fields[field] = { sourceText, sourceSha256: sha256(sourceText) };
  }
  if (!fields.name) fail(`${pathName}.nameEn이 없습니다.`);
  return fields;
}

function compareRecords(left: TranslationCorpusRecord, right: TranslationCorpusRecord): number {
  return `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`, "en");
}

export function compareTranslationRecords(left: TranslationRecord, right: TranslationRecord): number {
  return `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`, "en");
}

export function translationNameCollisions(corpus: readonly TranslationCorpusRecord[]): TranslationNameCollision[] {
  const occurrences = new Map<string, TranslationNameCollision>();
  for (const record of corpus) {
    const english = record.fields.name?.sourceText;
    if (!english) continue;
    const key = `${record.kind}\u0000${english}`;
    const existing = occurrences.get(key) ?? { kind: record.kind, english, ids: [] };
    existing.ids.push(record.id);
    occurrences.set(key, existing);
  }
  return [...occurrences.values()]
    .filter((entry) => entry.ids.length > 1)
    .map((entry) => ({ ...entry, ids: [...entry.ids].sort((left, right) => left.localeCompare(right, "en")) }))
    .sort((left, right) => left.kind.localeCompare(right.kind, "en") || left.english.localeCompare(right.english, "en"));
}

export async function loadTranslationSources(): Promise<TranslationSources> {
  const catalogResult = await readBoundedJson<CatalogArtifact>(path.join(RELEASE_ROOT, "catalog.json"));
  const paldexResult = await readBoundedJson<PaldexArtifact>(path.join(RELEASE_ROOT, "paldex.json"));
  const catalog = catalogResult.value;
  const paldex = paldexResult.value;
  if (catalog.release !== PALWORLD_TRANSLATION_RELEASE || paldex.release !== PALWORLD_TRANSLATION_RELEASE) {
    fail(`release는 ${PALWORLD_TRANSLATION_RELEASE}여야 합니다.`);
  }
  if (!Array.isArray(catalog.items) || !Array.isArray(catalog.skills) || !Array.isArray(paldex.records)) {
    fail("catalog 또는 Paldex collection이 없습니다.");
  }
  const sourceRevision = requiredString(catalog.metadata?.sourceRevision, "catalog.metadata.sourceRevision", 256);
  const corpus: TranslationCorpusRecord[] = [];
  const reviewedNames: TranslationSources["reviewedNames"] = [];
  const seen = new Set<string>();

  const add = (kind: TranslationKind, entity: CatalogEntity, index: number): void => {
    const id = entityId(entity.id, `${kind}[${index}].id`);
    const identity = `${kind}:${id}`;
    if (seen.has(identity)) fail(`중복 canonical ID가 있습니다: ${identity}`);
    seen.add(identity);
    corpus.push({ id, kind, fields: sourceFields(entity, `${kind}[${index}]`) });
  };

  (paldex.records as PaldexEntity[]).forEach((pal, index) => {
    add("pal", pal, index);
    const en = requiredString(pal.nameEn, `pal[${index}].nameEn`, 128);
    const ko = requiredString(pal.nameKo, `pal[${index}].nameKo`, 128);
    const ja = requiredString(pal.nameJa, `pal[${index}].nameJa`, 128);
    reviewedNames.push({ kind: "pal", id: entityId(pal.id, `pal[${index}].id`), en, ko, ja, sourceSha256: sha256(en) });
  });
  (catalog.items as CatalogEntity[]).forEach((item, index) => add("item", item, index));
  (catalog.skills as CatalogEntity[]).forEach((skill, index) => add("skill", skill, index));
  const catalogItemsById = new Map((catalog.items as CatalogEntity[]).map((item, index) => [
    entityId(item.id, `item[${index}].id`),
    item,
  ]));
  const reviewedItemAliases = await loadPalworldReviewedItemAliases(
    RELEASE_ROOT,
    catalog as PalworldCatalogArtifact,
  );
  const aliasedLocalizedItems = localizedReviewedItemsByCanonicalId(reviewedItemAliases);
  for (const localizedItem of PALWORLD_SNAPSHOT.items) {
    const canonicalItem = catalogItemsById.get(localizedItem.id);
    if (canonicalItem === undefined) continue;
    const en = requiredString(canonicalItem.nameEn, `item.${localizedItem.id}.nameEn`, 128);
    if (en !== localizedItem.nameEn) fail(`item:${localizedItem.id}의 기존 locale 이름과 canonical 영문 이름이 일치하지 않습니다.`);
    if (localizedItem.nameKo === undefined || localizedItem.nameJa === undefined) continue;
    reviewedNames.push({
      kind: "item",
      id: localizedItem.id,
      en,
      ko: requiredString(localizedItem.nameKo, `localizedItem.${localizedItem.id}.nameKo`, 128),
      ja: requiredString(localizedItem.nameJa, `localizedItem.${localizedItem.id}.nameJa`, 128),
      sourceSha256: sha256(en),
    });
  }
  for (const alias of reviewedItemAliases) {
    const localizedItem = aliasedLocalizedItems.get(alias.canonicalId);
    const canonicalItem = catalogItemsById.get(alias.canonicalId);
    if (
      localizedItem === undefined
      || canonicalItem === undefined
      || canonicalItem.nameEn !== alias.nameEn
      || localizedItem.nameKo === undefined
      || localizedItem.nameJa === undefined
    ) {
      fail(`item:${alias.canonicalId}의 검수 alias가 canonical item과 일치하지 않습니다.`);
    }
    reviewedNames.push({
      kind: "item",
      id: alias.canonicalId,
      en: alias.nameEn,
      ko: requiredString(localizedItem.nameKo, `localizedItem.${alias.canonicalId}.nameKo`, 128),
      ja: requiredString(localizedItem.nameJa, `localizedItem.${alias.canonicalId}.nameJa`, 128),
      sourceSha256: sha256(alias.nameEn),
    });
  }
  corpus.sort(compareRecords);
  reviewedNames.sort((left, right) => `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`, "en"));
  return {
    catalog,
    paldex,
    catalogSha256: sha256(catalogResult.bytes),
    paldexSha256: sha256(paldexResult.bytes),
    sourceRevision,
    corpus,
    reviewedNames,
  };
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o755 });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, stableJson(value), { encoding: "utf8", mode: 0o644 });
  await rename(temporaryPath, filePath);
}

export function sortedFields<T>(fields: Partial<Record<TranslationFieldName, T>>): Partial<Record<TranslationFieldName, T>> {
  const result: Partial<Record<TranslationFieldName, T>> = {};
  for (const key of FIELD_ORDER) if (fields[key] !== undefined) result[key] = fields[key];
  return result;
}

export function validateTranslationRecord(
  input: unknown,
  locale: TranslationLocale,
  sourceByIdentity: ReadonlyMap<string, TranslationCorpusRecord>,
  identicalAllowlist: ReadonlySet<string>,
  pathName: string,
  reviewedNames: ReadonlyMap<string, string> = new Map(),
  reviewedTerms: ReadonlyMap<string, string> = new Map(),
): TranslationRecord {
  const record = assertPlainObject(input, pathName);
  assertOnlyKeys(record, ["id", "kind", "fields"], pathName);
  const id = entityId(record.id, `${pathName}.id`);
  if (record.kind !== "pal" && record.kind !== "item" && record.kind !== "skill") fail(`${pathName}.kind가 올바르지 않습니다.`);
  const kind = record.kind;
  const source = sourceByIdentity.get(`${kind}:${id}`);
  if (!source) fail(`${pathName}가 존재하지 않는 canonical ID를 참조합니다.`);
  const inputFields = assertPlainObject(record.fields, `${pathName}.fields`);
  assertOnlyKeys(inputFields, FIELD_ORDER, `${pathName}.fields`);
  const fields: TranslationRecord["fields"] = {};
  for (const fieldName of FIELD_ORDER) {
    const inputField = inputFields[fieldName];
    if (inputField === undefined) continue;
    const sourceField = source.fields[fieldName];
    if (!sourceField) fail(`${pathName}.fields.${fieldName}은 원문에 없는 필드입니다.`);
    const field = assertPlainObject(inputField, `${pathName}.fields.${fieldName}`);
    assertOnlyKeys(field, ["sourceSha256", "text", "status", "note"], `${pathName}.fields.${fieldName}`);
    const sourceSha256 = requiredString(field.sourceSha256, `${pathName}.fields.${fieldName}.sourceSha256`, 64);
    if (!SHA256_PATTERN.test(sourceSha256) || sourceSha256 !== sourceField.sourceSha256) {
      fail(`${pathName}.fields.${fieldName} 원문 hash가 현재 source와 일치하지 않습니다.`);
    }
    const text = requiredString(field.text, `${pathName}.fields.${fieldName}.text`);
    if (HTML_PATTERN.test(text)) fail(`${pathName}.fields.${fieldName}.text에 HTML 또는 script를 허용하지 않습니다.`);
    if (text === sourceField.sourceText && !identicalAllowlist.has(`${locale}:${kind}:${id}:${fieldName}`)) {
      fail(`${pathName}.fields.${fieldName}.text가 영어 원문과 동일합니다.`);
    }
    const translatedNumbers = numericSignature(text);
    const sourceNumbers = numericSignature(sourceField.sourceText);
    if (translatedNumbers.numbers.join("\u0000") !== sourceNumbers.numbers.join("\u0000")) {
      fail(`${pathName}.fields.${fieldName}.text가 원문의 숫자 값·횟수·등장 순서를 보존하지 않았습니다.`);
    }
    if ([...translatedNumbers.boundUnits].sort().join("\u0000") !== [...sourceNumbers.boundUnits].sort().join("\u0000")) {
      fail(`${pathName}.fields.${fieldName}.text가 원문의 숫자와 인접 단위 결합을 보존하지 않았습니다.`);
    }
    if (field.status !== "human_reviewed" && field.status !== "machine_assisted") {
      fail(`${pathName}.fields.${fieldName}.status가 올바르지 않습니다.`);
    }
    if (field.status === "machine_assisted") {
      validateMachineTranslationQuality(
        sourceField.sourceText,
        text,
        locale,
        identicalAllowlist.has(`${locale}:${kind}:${id}:${fieldName}`),
        `${pathName}.fields.${fieldName}.text`,
      );
    }
    const note = field.note === undefined ? undefined : requiredString(field.note, `${pathName}.fields.${fieldName}.note`, 500);
    const reviewedName = fieldName === "name" ? reviewedNames.get(`${locale}:${kind}:${id}`) : undefined;
    if (reviewedName !== undefined && field.status === "human_reviewed" && text !== reviewedName) {
      fail(`${pathName}.fields.name.text가 검수된 glossary 이름과 일치하지 않습니다.`);
    }
    if (fieldName === "name") {
      for (const [termKey, reviewedTerm] of reviewedTerms) {
        const prefix = `${locale}:`;
        if (!termKey.startsWith(prefix)) continue;
        const englishTerm = termKey.slice(prefix.length);
        if (glossaryTermAppearsInName(sourceField.sourceText, englishTerm) && !text.includes(reviewedTerm)) {
          fail(`${pathName}.fields.${fieldName}.text가 검수된 glossary 용어 ${englishTerm} → ${reviewedTerm}을 보존하지 않았습니다.`);
        }
      }
    }
    const anomaly = analyzeTranslationSource(sourceField.sourceText);
    if (PLACEHOLDER_RESIDUE_PATTERN.test(text)) {
      fail(`${pathName}.fields.${fieldName}.text에 번역 중간 placeholder가 남아 있습니다.`);
    }
    const marker = PALWORLD_TRANSLATION_MISSING_SOURCE_MARKER[locale];
    const markerCount = text.split(marker).length - 1;
    if (markerCount !== anomaly.missingSlotCount) {
      fail(`${pathName}.fields.${fieldName}의 locale marker 수는 손상 원문의 ${anomaly.missingSlotCount}개 누락 위치와 정확히 일치해야 합니다.`);
    }
    if (anomaly.missingSlotCount > 0) {
      if (!note?.includes(PALWORLD_TRANSLATION_SOURCE_ANOMALY_NOTE)) {
        fail(`${pathName}.fields.${fieldName}은 손상 원문의 ${anomaly.missingSlotCount}개 누락 위치를 ${marker}와 ${PALWORLD_TRANSLATION_SOURCE_ANOMALY_NOTE} note로 보존해야 합니다.`);
      }
    }
    fields[fieldName] = { sourceSha256, text, status: field.status, ...(note ? { note } : {}) };
  }
  if (Object.keys(fields).length === 0) fail(`${pathName}.fields가 비어 있습니다.`);
  return { id, kind, fields: sortedFields(fields) };
}

/**
 * 신규 import에만 적용하는 이름 의미 품질 gate입니다.
 *
 * 기존 감사용 locale artifact validator는 과거 상태를 계속 읽을 수 있어야 하므로
 * 이 검사는 validateTranslationRecord에 합치지 않고 import 직전에 명시적으로 호출합니다.
 */
export function assertStrictMachineNameQualityForImport(
  records: readonly TranslationRecord[],
  locale: TranslationLocale,
  corpus: readonly TranslationCorpusRecord[],
  reviewedNames: ReadonlyMap<string, string>,
): void {
  const sourceByIdentity = new Map(corpus.map((record) => [`${record.kind}:${record.id}`, record]));
  const reviewedPals = corpus
    .filter((record) => record.kind === "pal")
    .map((record) => {
      const english = record.fields.name?.sourceText;
      const localized = reviewedNames.get(`${locale}:pal:${record.id}`);
      return english && localized ? { id: record.id, english, localized } : undefined;
    })
    .filter((value): value is { id: string; english: string; localized: string } => value !== undefined)
    .sort((left, right) => right.english.length - left.english.length || left.id.localeCompare(right.id, "en"));
  const machineNamesByLocaleText = new Map<string, {
    identity: string;
    sourceText: string;
  }>();

  for (const record of records) {
    if (record.kind !== "item" && record.kind !== "skill") continue;
    const name = record.fields.name;
    if (name?.status !== "machine_assisted") continue;
    const identity = `${record.kind}:${record.id}`;
    const sourceText = sourceByIdentity.get(identity)?.fields.name?.sourceText;
    if (sourceText === undefined) fail(`${identity}:name의 canonical 영어 원문이 없습니다.`);
    const translatedText = canonicalMachineName(name.text);

    if (MACHINE_NAME_DENYLIST[locale].has(translatedText)) {
      fail(`${identity}:name에 금지된 기계 보조 번역 문자열이 있습니다: ${translatedText}`);
    }

    for (const token of MACHINE_NAME_STRUCTURE_TOKENS) {
      if (!englishNameContainsCanonicalName(sourceText, token.english)) continue;
      if (!token[locale].some((localizedToken) => translatedText.includes(localizedToken))) {
        fail(`${identity}:name이 구조 토큰 ${token.english}의 ${locale} 의미를 보존하지 않았습니다.`);
      }
    }

    for (const pal of reviewedPals) {
      if (
        englishNameContainsCanonicalName(sourceText, pal.english)
        && !translatedText.includes(canonicalMachineName(pal.localized))
      ) {
        fail(`${identity}:name이 canonical Pal ${pal.id}의 검수 ${locale} 이름을 보존하지 않았습니다.`);
      }
    }

    const collisionKey = translatedText.toLocaleLowerCase(locale === "ko" ? "ko-KR" : "ja-JP");
    const existing = machineNamesByLocaleText.get(collisionKey);
    if (existing !== undefined && existing.sourceText !== sourceText) {
      fail(
        `${identity}:name과 ${existing.identity}:name의 서로 다른 영어 원문이 같은 ${locale} 기계 이름으로 합쳐졌습니다.`,
      );
    }
    machineNamesByLocaleText.set(collisionKey, { identity, sourceText });
  }
}

export function mergeTranslationRecords(records: readonly TranslationRecord[]): TranslationRecord[] {
  const merged = new Map<string, TranslationRecord>();
  for (const record of records) {
    const identity = `${record.kind}:${record.id}`;
    const current = merged.get(identity) ?? { id: record.id, kind: record.kind, fields: {} };
    for (const fieldName of FIELD_ORDER) {
      const incoming = record.fields[fieldName];
      if (!incoming) continue;
      const existing = current.fields[fieldName];
      if (!existing) {
        current.fields[fieldName] = incoming;
        continue;
      }
      if (existing.sourceSha256 !== incoming.sourceSha256) fail(`${identity}:${fieldName}의 원문 hash가 candidate 사이에서 충돌합니다.`);
      if (existing.status === "human_reviewed" && incoming.status === "machine_assisted") continue;
      if (existing.status === "machine_assisted" && incoming.status === "human_reviewed") {
        current.fields[fieldName] = incoming;
        continue;
      }
      if (existing.text !== incoming.text || existing.note !== incoming.note) {
        fail(`${identity}:${fieldName}에 같은 우선순위의 서로 다른 번역이 있습니다.`);
      }
    }
    merged.set(identity, current);
  }
  return [...merged.values()].sort(compareTranslationRecords).map((record) => ({
    ...record,
    fields: sortedFields(record.fields),
  }));
}

export function assertUniqueSortedTranslationRecords(records: readonly TranslationRecord[], pathName = "records"): void {
  let previous = "";
  const seen = new Set<string>();
  for (const [index, record] of records.entries()) {
    const identity = `${record.kind}:${record.id}`;
    if (seen.has(identity)) fail(`${pathName}[${index}]에 중복 canonical ID가 있습니다: ${identity}`);
    if (previous && previous.localeCompare(identity, "en") >= 0) fail(`${pathName}는 canonical ID 순으로 정렬되어야 합니다.`);
    seen.add(identity);
    previous = identity;
  }
}

export function translationCoverage(records: readonly TranslationRecord[], corpus: readonly TranslationCorpusRecord[]) {
  const translated = new Map<string, TranslationField>();
  for (const record of records) {
    for (const field of FIELD_ORDER) {
      const value = record.fields[field];
      if (value) translated.set(`${record.kind}:${record.id}:${field}`, value);
    }
  }
  const byKind = Object.fromEntries((["pal", "item", "skill"] as const).map((kind) => {
    const sourceRecords = corpus.filter((record) => record.kind === kind);
    const names = sourceRecords.filter((record) => record.fields.name).length;
    const descriptions = sourceRecords.filter((record) => record.fields.description).length;
    const passiveAbilities = sourceRecords.filter((record) => record.fields.passiveAbility).length;
    return [kind, {
      name: { translated: sourceRecords.filter((record) => translated.has(`${kind}:${record.id}:name`)).length, total: names },
      description: { translated: sourceRecords.filter((record) => translated.has(`${kind}:${record.id}:description`)).length, total: descriptions },
      passiveAbility: { translated: sourceRecords.filter((record) => translated.has(`${kind}:${record.id}:passiveAbility`)).length, total: passiveAbilities },
    }];
  }));
  const total = corpus.reduce((sum, record) => sum + Object.keys(record.fields).length, 0);
  const status = [...translated.values()].reduce((result, field) => {
    result[field.status] += 1;
    return result;
  }, { human_reviewed: 0, machine_assisted: 0 });
  return { byKind, translated: translated.size, total, missing: total - translated.size, status };
}

export async function readIdenticalAllowlist(): Promise<Set<string>> {
  const filePath = path.join(LOCALES_ROOT, "glossary.json");
  try {
    const { value } = await readBoundedJson<{ englishCopyAllowlist?: unknown }>(filePath);
    if (!Array.isArray(value.englishCopyAllowlist)) fail("glossary englishCopyAllowlist가 배열이 아닙니다.");
    const result = new Set<string>();
    for (const [index, input] of value.englishCopyAllowlist.entries()) {
      const entry = assertPlainObject(input, `englishCopyAllowlist[${index}]`);
      assertOnlyKeys(entry, ["locale", "kind", "id", "field", "reason"], `englishCopyAllowlist[${index}]`);
      if (entry.locale !== "ko" && entry.locale !== "ja") fail(`englishCopyAllowlist[${index}].locale가 올바르지 않습니다.`);
      if (entry.kind !== "pal" && entry.kind !== "item" && entry.kind !== "skill") fail(`englishCopyAllowlist[${index}].kind가 올바르지 않습니다.`);
      if (entry.field !== "name" && entry.field !== "description" && entry.field !== "passiveAbility") fail(`englishCopyAllowlist[${index}].field가 올바르지 않습니다.`);
      const id = entityId(entry.id, `englishCopyAllowlist[${index}].id`);
      requiredString(entry.reason, `englishCopyAllowlist[${index}].reason`, 500);
      result.add(`${entry.locale}:${entry.kind}:${id}:${entry.field}`);
    }
    return result;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Set();
    throw error;
  }
}

export async function readReviewedNames(): Promise<Map<string, string>> {
  const { value } = await readBoundedJson<{ reviewedNames?: unknown; palNames?: unknown }>(path.join(LOCALES_ROOT, "glossary.json"));
  const entries = Array.isArray(value.reviewedNames) ? value.reviewedNames : value.palNames;
  if (!Array.isArray(entries)) fail("glossary reviewedNames가 배열이 아닙니다.");
  const result = new Map<string, string>();
  for (const [index, input] of entries.entries()) {
    const entry = assertPlainObject(input, `reviewedNames[${index}]`);
    const legacy = value.reviewedNames === undefined;
    assertOnlyKeys(entry, legacy ? ["id", "en", "ko", "ja", "sourceSha256"] : ["kind", "id", "en", "ko", "ja", "sourceSha256"], `reviewedNames[${index}]`);
    const kind = legacy ? "pal" : entry.kind;
    if (kind !== "pal" && kind !== "item") fail(`reviewedNames[${index}].kind가 올바르지 않습니다.`);
    const id = entityId(entry.id, `reviewedNames[${index}].id`);
    requiredString(entry.en, `reviewedNames[${index}].en`, 128);
    const sourceSha256 = requiredString(entry.sourceSha256, `reviewedNames[${index}].sourceSha256`, 64);
    if (!SHA256_PATTERN.test(sourceSha256)) fail(`reviewedNames[${index}].sourceSha256가 올바르지 않습니다.`);
    for (const locale of ["ko", "ja"] as const) {
      const text = requiredString(entry[locale], `reviewedNames[${index}].${locale}`, 128);
      const identity = `${locale}:${kind}:${id}`;
      if (result.has(identity)) fail(`glossary에 중복 검수 이름이 있습니다: ${identity}`);
      result.set(identity, text);
    }
  }
  return result;
}

export function assertReviewedNameRecords(
  records: readonly TranslationRecord[],
  locale: TranslationLocale,
  reviewedNames: ReadonlyMap<string, string>,
): void {
  const recordsByIdentity = new Map(records.map((record) => [`${record.kind}:${record.id}`, record]));
  for (const [identity, expected] of reviewedNames) {
    if (!identity.startsWith(`${locale}:`)) continue;
    const canonicalIdentity = identity.slice(locale.length + 1);
    const name = recordsByIdentity.get(canonicalIdentity)?.fields.name;
    if (name?.status !== "human_reviewed" || name.text !== expected) {
      fail(`${canonicalIdentity}의 검수 이름이 human_reviewed glossary 값으로 고정되지 않았습니다.`);
    }
  }
}

export async function readReviewedGlossaryTerms(): Promise<Map<string, string>> {
  const { value } = await readBoundedJson<{ terms?: unknown }>(path.join(LOCALES_ROOT, "glossary.json"));
  if (!Array.isArray(value.terms)) fail("glossary terms가 배열이 아닙니다.");
  const result = new Map<string, string>();
  for (const [index, input] of value.terms.entries()) {
    const entry = assertPlainObject(input, `terms[${index}]`);
    assertOnlyKeys(entry, ["key", "en", "ko", "ja", "domain"], `terms[${index}]`);
    requiredString(entry.key, `terms[${index}].key`, 128);
    const en = requiredString(entry.en, `terms[${index}].en`, 256);
    requiredString(entry.domain, `terms[${index}].domain`, 256);
    for (const locale of ["ko", "ja"] as const) {
      const text = requiredString(entry[locale], `terms[${index}].${locale}`, 256);
      const identity = `${locale}:${en}`;
      const existing = result.get(identity);
      if (existing !== undefined && existing !== text) {
        fail(`glossary 용어가 충돌합니다: ${identity}`);
      }
      result.set(identity, text);
    }
  }
  return result;
}

export function validateNameCollisionOverrides(
  collisions: readonly TranslationNameCollision[],
  input: unknown,
): TranslationNameCollisionOverride[] {
  const artifact = assertPlainObject(input, "glossaryOverrides");
  assertOnlyKeys(artifact, ["schemaVersion", "release", "generatedAt", "overrides"], "glossaryOverrides");
  if (artifact.schemaVersion !== PALWORLD_TRANSLATION_SCHEMA_VERSION || artifact.release !== PALWORLD_TRANSLATION_RELEASE) {
    fail("glossaryOverrides header가 올바르지 않습니다.");
  }
  requiredString(artifact.generatedAt, "glossaryOverrides.generatedAt", 64);
  if (!Array.isArray(artifact.overrides) || artifact.overrides.length > 10_000) fail("glossaryOverrides.overrides가 올바르지 않습니다.");
  const expected = new Map(collisions.map((collision) => [`${collision.kind}:${collision.english}`, collision]));
  const seen = new Set<string>();
  const overrides: TranslationNameCollisionOverride[] = artifact.overrides.map((inputOverride, index): TranslationNameCollisionOverride => {
    const override = assertPlainObject(inputOverride, `glossaryOverrides.overrides[${index}]`);
    assertOnlyKeys(override, ["kind", "english", "ids", "resolution", "reason"], `glossaryOverrides.overrides[${index}]`);
    if (override.kind !== "pal" && override.kind !== "item" && override.kind !== "skill") fail(`glossaryOverrides.overrides[${index}].kind가 올바르지 않습니다.`);
    const kind = override.kind;
    const english = requiredString(override.english, `glossaryOverrides.overrides[${index}].english`, 256);
    const key = `${kind}:${english}`;
    const collision = expected.get(key);
    if (!collision || seen.has(key)) fail(`glossaryOverrides.overrides[${index}]가 현재 충돌 목록과 일치하지 않습니다.`);
    if (!Array.isArray(override.ids) || override.ids.length !== collision.ids.length) fail(`glossaryOverrides.overrides[${index}].ids가 올바르지 않습니다.`);
    const ids = override.ids.map((id, idIndex) => entityId(id, `glossaryOverrides.overrides[${index}].ids[${idIndex}]`));
    if (ids.some((id, idIndex) => id !== collision.ids[idIndex])) fail(`glossaryOverrides.overrides[${index}].ids 순서가 현재 충돌과 일치하지 않습니다.`);
    if (override.resolution !== "translate_each_canonical_id") fail(`glossaryOverrides.overrides[${index}].resolution이 올바르지 않습니다.`);
    const reason = requiredString(override.reason, `glossaryOverrides.overrides[${index}].reason`, 500);
    seen.add(key);
    return { kind, english, ids, resolution: "translate_each_canonical_id", reason };
  });
  if (seen.size !== expected.size) {
    const missing = [...expected.keys()].filter((key) => !seen.has(key));
    fail(`명시적인 이름 충돌 override가 누락되었습니다: ${missing.join(", ")}`);
  }
  return overrides;
}

export async function readNameCollisionOverrides(collisions: readonly TranslationNameCollision[]): Promise<TranslationNameCollisionOverride[]> {
  const { value } = await readBoundedJson<unknown>(GLOSSARY_OVERRIDE_FILE);
  return validateNameCollisionOverrides(collisions, value);
}

export async function readCandidateRecords(locale: TranslationLocale): Promise<unknown[]> {
  const directory = path.join(CANDIDATE_ROOT, locale);
  const names = (await readdir(directory)).filter((name) => /^batch-\d{4}\.json$/u.test(name)).sort();
  if (names.length === 0) fail(`${locale} candidate batch가 없습니다.`);
  const records: unknown[] = [];
  for (const name of names) {
    const { value } = await readBoundedJson<{ schemaVersion?: unknown; locale?: unknown; records?: unknown }>(path.join(directory, name));
    const batch = assertPlainObject(value, name);
    assertOnlyKeys(batch, ["schemaVersion", "locale", "records"], name);
    if (batch.schemaVersion !== PALWORLD_TRANSLATION_SCHEMA_VERSION || batch.locale !== locale || !Array.isArray(batch.records)) {
      fail(`${name} header가 올바르지 않습니다.`);
    }
    records.push(...batch.records);
  }
  return records;
}
