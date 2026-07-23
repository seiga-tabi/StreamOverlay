import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertPalworldTranslationSnapshot } from "@streamops/shared";
import {
  LOCALES_ROOT,
  PALWORLD_TRANSLATION_FIXED_TIME,
  PALWORLD_TRANSLATION_RELEASE,
  PALWORLD_TRANSLATION_SCHEMA_VERSION,
  atomicWriteJson,
  loadTranslationSources,
  mergeTranslationRecords,
  readCandidateRecords,
  readIdenticalAllowlist,
  readNameCollisionOverrides,
  readReviewedGlossaryTerms,
  readReviewedNames,
  assertStrictMachineNameQualityForImport,
  assertReviewedNameRecords,
  sha256,
  stableJson,
  translationNameCollisions,
  translationCoverage,
  validateTranslationRecord,
  type TranslationLocale,
  type TranslationSnapshot,
} from "./palworld-translation-artifacts.js";

function localeArgument(): TranslationLocale {
  const index = process.argv.indexOf("--locale");
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (value !== "ko" && value !== "ja") throw new TypeError("--locale은 ko 또는 ja여야 합니다.");
  return value;
}

function revisionArgument(): string {
  const index = process.argv.indexOf("--revision");
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value)) {
    throw new TypeError("--revision에 고정된 번역 revision을 명시해야 합니다.");
  }
  return value;
}

async function writeRuntimeManifestIfReady(
  expectedRevision: string,
  sourceCatalogSha256: string,
  sourcePaldexSha256: string,
  sourceRevision: string,
): Promise<void> {
  const glossaryBytes = await readFile(path.join(LOCALES_ROOT, "glossary.json"));
  const locales: Record<string, { file: string; sha256: string; recordCount: number }> = {};
  for (const locale of ["ko", "ja"] as const) {
    let bytes: Buffer;
    try {
      bytes = await readFile(path.join(LOCALES_ROOT, `${locale}.json`));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    const snapshot = JSON.parse(bytes.toString("utf8")) as Partial<TranslationSnapshot>;
    if (snapshot.translationRevision !== expectedRevision
      || snapshot.sourceCatalogSha256 !== sourceCatalogSha256
      || snapshot.sourcePaldexSha256 !== sourcePaldexSha256
      || snapshot.sourceRevision !== sourceRevision
      || !Array.isArray(snapshot.records)) return;
    locales[locale] = { file: `${locale}.json`, sha256: sha256(bytes), recordCount: snapshot.records.length };
  }
  await atomicWriteJson(path.join(LOCALES_ROOT, "manifest.json"), {
    schemaVersion: PALWORLD_TRANSLATION_SCHEMA_VERSION,
    release: PALWORLD_TRANSLATION_RELEASE,
    sourceCatalogSha256,
    sourcePaldexSha256,
    glossarySha256: sha256(glossaryBytes),
    sourceRevision,
    translationRevision: expectedRevision,
    generatedAt: PALWORLD_TRANSLATION_FIXED_TIME,
    locales,
  });
}

async function main(): Promise<void> {
  const locale = localeArgument();
  const translationRevision = revisionArgument();
  const sources = await loadTranslationSources();
  const sourceByIdentity = new Map(sources.corpus.map((record) => [`${record.kind}:${record.id}`, record]));
  const identicalAllowlist = await readIdenticalAllowlist();
  const reviewedNames = await readReviewedNames();
  const reviewedTerms = await readReviewedGlossaryTerms();
  await readNameCollisionOverrides(translationNameCollisions(sources.corpus));
  const candidateInputs = await readCandidateRecords(locale);
  const validatedCandidates = [];
  const candidateErrors: string[] = [];
  for (const [index, input] of candidateInputs.entries()) {
    try {
      validatedCandidates.push(validateTranslationRecord(
        input,
        locale,
        sourceByIdentity,
        identicalAllowlist,
        `candidates[${index}]`,
        reviewedNames,
        reviewedTerms,
      ));
    } catch (error) {
      const candidate = input as { kind?: unknown; id?: unknown };
      const identity = typeof candidate.kind === "string" && typeof candidate.id === "string"
        ? `${candidate.kind}:${candidate.id}`
        : `candidates[${index}]`;
      candidateErrors.push(`${identity}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (candidateErrors.length > 0) {
    throw new TypeError(
      `Palworld 번역 후보 ${candidateErrors.length}개가 검증에 실패했습니다.\n${candidateErrors.slice(0, 200).join("\n")}`
    );
  }
  const records = mergeTranslationRecords(validatedCandidates);
  assertReviewedNameRecords(records, locale, reviewedNames);
  assertStrictMachineNameQualityForImport(records, locale, sources.corpus, reviewedNames);
  const coverage = translationCoverage(records, sources.corpus);
  const statuses = coverage.status;
  const translationMethod = statuses.human_reviewed > 0 && statuses.machine_assisted > 0
    ? "mixed"
    : statuses.human_reviewed > 0 ? "human_reviewed" : "machine_assisted";
  const contentHash = sha256(stableJson(records));
  const snapshot: TranslationSnapshot = {
    schemaVersion: PALWORLD_TRANSLATION_SCHEMA_VERSION,
    release: PALWORLD_TRANSLATION_RELEASE,
    locale,
    sourceCatalogSha256: sources.catalogSha256,
    sourcePaldexSha256: sources.paldexSha256,
    sourceRevision: sources.sourceRevision,
    translationRevision,
    translationMethod,
    translationStatus: coverage.missing === 0 ? "complete" : "incomplete",
    translatedAt: PALWORLD_TRANSLATION_FIXED_TIME,
    reviewedAt: statuses.human_reviewed > 0 ? PALWORLD_TRANSLATION_FIXED_TIME : null,
    records,
  };
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
  await atomicWriteJson(path.join(LOCALES_ROOT, `${locale}.json`), snapshot);
  await atomicWriteJson(path.join(LOCALES_ROOT, `${locale}-coverage.json`), {
    schemaVersion: PALWORLD_TRANSLATION_SCHEMA_VERSION,
    release: PALWORLD_TRANSLATION_RELEASE,
    locale,
    sourceCatalogSha256: sources.catalogSha256,
    sourcePaldexSha256: sources.paldexSha256,
    translationRevision: snapshot.translationRevision,
    translationStatus: snapshot.translationStatus,
    coverage,
    contentSha256: contentHash,
  });
  await writeRuntimeManifestIfReady(translationRevision, sources.catalogSha256, sources.paldexSha256, sources.sourceRevision);
  process.stdout.write(`${JSON.stringify({ locale, revision: snapshot.translationRevision, status: snapshot.translationStatus, coverage }, null, 2)}\n`);
}

await main();
