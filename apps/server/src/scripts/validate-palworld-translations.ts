import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertPalworldTranslationSnapshot } from "@streamops/shared";
import {
  LOCALES_ROOT,
  PALWORLD_TRANSLATION_RELEASE,
  PALWORLD_TRANSLATION_SCHEMA_VERSION,
  loadTranslationSources,
  readIdenticalAllowlist,
  readNameCollisionOverrides,
  readReviewedGlossaryTerms,
  readReviewedNames,
  assertReviewedNameRecords,
  assertUniqueSortedTranslationRecords,
  translationNameCollisions,
  translationCoverage,
  validateTranslationRecord,
  sha256,
  stableJson,
  type TranslationLocale,
  type TranslationSnapshot,
} from "./palworld-translation-artifacts.js";

function expectSnapshotHeader(value: unknown, locale: TranslationLocale): TranslationSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${locale}.json은 객체여야 합니다.`);
  const snapshot = value as Partial<TranslationSnapshot>;
  const allowed = new Set(["schemaVersion", "release", "locale", "sourceCatalogSha256", "sourcePaldexSha256", "sourceRevision", "translationRevision", "translationMethod", "translationStatus", "translatedAt", "reviewedAt", "records"]);
  for (const key of Object.keys(snapshot)) if (!allowed.has(key)) throw new TypeError(`${locale}.json.${key}는 허용되지 않은 필드입니다.`);
  if (snapshot.schemaVersion !== PALWORLD_TRANSLATION_SCHEMA_VERSION || snapshot.release !== PALWORLD_TRANSLATION_RELEASE || snapshot.locale !== locale) {
    throw new TypeError(`${locale}.json header가 올바르지 않습니다.`);
  }
  if (!Array.isArray(snapshot.records)) throw new TypeError(`${locale}.json.records가 배열이 아닙니다.`);
  if (snapshot.translationMethod !== "machine_assisted" && snapshot.translationMethod !== "human_reviewed" && snapshot.translationMethod !== "mixed") {
    throw new TypeError(`${locale}.json.translationMethod가 올바르지 않습니다.`);
  }
  if (snapshot.translationStatus !== "complete" && snapshot.translationStatus !== "incomplete") throw new TypeError(`${locale}.json.translationStatus가 올바르지 않습니다.`);
  return snapshot as TranslationSnapshot;
}

async function validateLocale(locale: TranslationLocale, allowIncomplete: boolean) {
  const sources = await loadTranslationSources();
  const identicalAllowlist = await readIdenticalAllowlist();
  const reviewedNames = await readReviewedNames();
  const reviewedTerms = await readReviewedGlossaryTerms();
  await readNameCollisionOverrides(translationNameCollisions(sources.corpus));
  const sourceByIdentity = new Map(sources.corpus.map((record) => [`${record.kind}:${record.id}`, record]));
  const snapshot = expectSnapshotHeader(JSON.parse(await readFile(path.join(LOCALES_ROOT, `${locale}.json`), "utf8")), locale);
  if (snapshot.sourceCatalogSha256 !== sources.catalogSha256 || snapshot.sourcePaldexSha256 !== sources.paldexSha256 || snapshot.sourceRevision !== sources.sourceRevision) {
    throw new TypeError(`${locale}.json의 source hash 또는 revision이 현재 catalog와 일치하지 않습니다.`);
  }
  const identities = new Set<string>();
  const records = snapshot.records.map((record, index) => {
    const validated = validateTranslationRecord(record, locale, sourceByIdentity, identicalAllowlist, `${locale}.records[${index}]`, reviewedNames, reviewedTerms);
    const identity = `${validated.kind}:${validated.id}`;
    if (identities.has(identity)) throw new TypeError(`${locale}.json에 중복 record가 있습니다: ${identity}`);
    identities.add(identity);
    return validated;
  });
  assertUniqueSortedTranslationRecords(records, `${locale}.records`);
  assertReviewedNameRecords(records, locale, reviewedNames);
  const coverage = translationCoverage(records, sources.corpus);
  if (!allowIncomplete && coverage.missing !== 0) {
    throw new TypeError(`${locale}.json은 기본 검증에서 complete snapshot이어야 하지만 ${coverage.missing}개 필드가 누락되었습니다.`);
  }
  if (snapshot.translationStatus === "complete" && coverage.missing !== 0) throw new TypeError(`${locale}.json이 complete이지만 ${coverage.missing}개 필드가 누락되었습니다.`);
  if (snapshot.translationStatus === "incomplete" && coverage.missing === 0) throw new TypeError(`${locale}.json은 모든 필드가 있지만 incomplete로 표시되었습니다.`);
  const expectedMethod = coverage.status.human_reviewed > 0 && coverage.status.machine_assisted > 0
    ? "mixed"
    : coverage.status.human_reviewed > 0 ? "human_reviewed" : "machine_assisted";
  if (snapshot.translationMethod !== expectedMethod) throw new TypeError(`${locale}.json.translationMethod가 실제 field status와 일치하지 않습니다.`);
  assertPalworldTranslationSnapshot(snapshot, {
    release: PALWORLD_TRANSLATION_RELEASE,
    sourceCatalogSha256: sources.catalogSha256,
    sourcePaldexSha256: sources.paldexSha256,
    sourceRevision: sources.sourceRevision,
    records: sources.corpus.map((record) => ({
      id: record.id,
      kind: record.kind,
      fields: Object.fromEntries(Object.entries(record.fields).map(([field, value]) => [field, {
        text: value?.sourceText,
        sha256: value?.sourceSha256,
      }])) as never,
    })),
    englishCopyAllowlist: [...identicalAllowlist]
      .filter((key) => key.startsWith(`${locale}:`))
      .map((key) => key.slice(locale.length + 1)),
  });
  return { locale, revision: snapshot.translationRevision, status: snapshot.translationStatus, coverage };
}

function plainRecord(value: unknown, pathName: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${pathName}는 객체여야 합니다.`);
  return value as Record<string, unknown>;
}

function onlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[], pathName: string): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new TypeError(`${pathName}.${key}는 허용되지 않은 필드입니다.`);
}

async function validateGeneratedArtifactSet(results: Awaited<ReturnType<typeof validateLocale>>[]): Promise<void> {
  const sources = await loadTranslationSources();
  if (results.length !== 2 || results[0]?.revision !== results[1]?.revision) {
    throw new TypeError("KO/JA 번역 revision이 서로 일치해야 합니다.");
  }
  const manifest = plainRecord(JSON.parse(await readFile(path.join(LOCALES_ROOT, "manifest.json"), "utf8")), "manifest");
  onlyKeys(manifest, ["schemaVersion", "release", "sourceCatalogSha256", "sourcePaldexSha256", "glossarySha256", "sourceRevision", "translationRevision", "generatedAt", "locales"], "manifest");
  const glossary = plainRecord(JSON.parse(await readFile(path.join(LOCALES_ROOT, "glossary.json"), "utf8")), "glossary");
  const glossaryBytes = await readFile(path.join(LOCALES_ROOT, "glossary.json"));
  if (
    manifest.schemaVersion !== PALWORLD_TRANSLATION_SCHEMA_VERSION
    || manifest.release !== PALWORLD_TRANSLATION_RELEASE
    || manifest.sourceCatalogSha256 !== sources.catalogSha256
    || manifest.sourcePaldexSha256 !== sources.paldexSha256
    || manifest.glossarySha256 !== sha256(glossaryBytes)
    || manifest.sourceRevision !== sources.sourceRevision
    || manifest.translationRevision !== results[0]?.revision
  ) {
    throw new TypeError("manifest가 현재 source 또는 locale revision과 일치하지 않습니다.");
  }
  if (glossary.sourceCatalogSha256 !== sources.catalogSha256 || glossary.sourcePaldexSha256 !== sources.paldexSha256) {
    throw new TypeError("glossary source hash가 현재 catalog/Paldex와 일치하지 않습니다.");
  }
  const localeEntries = plainRecord(manifest.locales, "manifest.locales");
  onlyKeys(localeEntries, ["ko", "ja"], "manifest.locales");
  for (const result of results) {
    const locale = result.locale;
    const entry = plainRecord(localeEntries[locale], `manifest.locales.${locale}`);
    onlyKeys(entry, ["file", "sha256", "recordCount"], `manifest.locales.${locale}`);
    const localeBytes = await readFile(path.join(LOCALES_ROOT, `${locale}.json`));
    const snapshot = JSON.parse(localeBytes.toString("utf8")) as TranslationSnapshot;
    if (entry.file !== `${locale}.json` || entry.sha256 !== sha256(localeBytes) || entry.recordCount !== snapshot.records.length) {
      throw new TypeError(`manifest.locales.${locale}가 실제 locale artifact와 일치하지 않습니다.`);
    }
    const coverageArtifact = plainRecord(JSON.parse(await readFile(path.join(LOCALES_ROOT, `${locale}-coverage.json`), "utf8")), `${locale}-coverage`);
    onlyKeys(coverageArtifact, ["schemaVersion", "release", "locale", "sourceCatalogSha256", "sourcePaldexSha256", "translationRevision", "translationStatus", "coverage", "contentSha256"], `${locale}-coverage`);
    if (
      coverageArtifact.schemaVersion !== PALWORLD_TRANSLATION_SCHEMA_VERSION
      || coverageArtifact.release !== PALWORLD_TRANSLATION_RELEASE
      || coverageArtifact.locale !== locale
      || coverageArtifact.sourceCatalogSha256 !== sources.catalogSha256
      || coverageArtifact.sourcePaldexSha256 !== sources.paldexSha256
      || coverageArtifact.translationRevision !== snapshot.translationRevision
      || coverageArtifact.translationStatus !== snapshot.translationStatus
      || coverageArtifact.contentSha256 !== sha256(stableJson(snapshot.records))
      || stableJson(coverageArtifact.coverage) !== stableJson(result.coverage)
    ) {
      throw new TypeError(`${locale}-coverage.json이 현재 locale artifact 집계와 일치하지 않습니다.`);
    }
  }
}

const allowIncomplete = process.argv.includes("--allow-incomplete");
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== "--allow-incomplete");
if (unknownArguments.length > 0) throw new TypeError(`허용되지 않은 인자입니다: ${unknownArguments.join(", ")}`);
const results = [];
for (const locale of ["ko", "ja"] as const) results.push(await validateLocale(locale, allowIncomplete));
await validateGeneratedArtifactSet(results);
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
