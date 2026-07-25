import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertPalworldTranslationSnapshot } from "@streamops/shared";
import {
  LOCALES_ROOT,
  PALWORLD_TRANSLATION_FIXED_TIME,
  PALWORLD_TRANSLATION_RELEASE,
  PALWORLD_TRANSLATION_SCHEMA_VERSION,
  assertReviewedNameRecords,
  assertUniqueSortedTranslationRecords,
  atomicWriteJson,
  independentOfficialSourceFieldsForRecords,
  loadIndependentOfficialSourceFields,
  loadTranslationSources,
  readIdenticalAllowlist,
  readReviewedGlossaryTerms,
  readReviewedNames,
  sha256,
  stableJson,
  translationCoverage,
  translationMethodForStatusCounts,
  validateTranslationRecord,
  type TranslationLocale,
  type TranslationRecord,
  type TranslationSnapshot
} from "./palworld-translation-artifacts.js";

const TRANSLATION_REVISION = "verified-locales-only-v1";

function exactSnapshot(value: unknown, locale: TranslationLocale): TranslationSnapshot {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${locale}.json은 객체여야 합니다.`);
  }
  const snapshot = value as Partial<TranslationSnapshot>;
  const allowed = new Set([
    "schemaVersion",
    "release",
    "locale",
    "sourceCatalogSha256",
    "sourcePaldexSha256",
    "sourceRevision",
    "translationRevision",
    "translationMethod",
    "translationStatus",
    "translatedAt",
    "reviewedAt",
    "records"
  ]);
  for (const key of Object.keys(snapshot)) {
    if (!allowed.has(key)) throw new TypeError(`${locale}.json.${key}는 허용되지 않은 필드입니다.`);
  }
  if (
    snapshot.schemaVersion !== PALWORLD_TRANSLATION_SCHEMA_VERSION
    || snapshot.release !== PALWORLD_TRANSLATION_RELEASE
    || snapshot.locale !== locale
    || !Array.isArray(snapshot.records)
  ) {
    throw new TypeError(`${locale}.json header가 현재 release와 일치하지 않습니다.`);
  }
  return snapshot as TranslationSnapshot;
}

function withoutMachineFields(records: readonly TranslationRecord[]): {
  records: TranslationRecord[];
  removedFields: number;
} {
  let removedFields = 0;
  const filtered = records.flatMap((record) => {
    const fields = Object.fromEntries(
      Object.entries(record.fields).filter(([, field]) => {
        if (field?.status !== "machine_assisted") return true;
        removedFields += 1;
        return false;
      })
    ) as TranslationRecord["fields"];
    return Object.keys(fields).length === 0
      ? []
      : [{ ...record, fields }];
  });
  return { records: filtered, removedFields };
}

async function createLocale(
  locale: TranslationLocale,
  context: Awaited<ReturnType<typeof loadTranslationSources>>,
  identicalAllowlist: ReadonlySet<string>,
  reviewedNames: ReadonlyMap<string, string>,
  reviewedTerms: ReadonlyMap<string, string>,
  independentOfficialSourceFields: Awaited<
    ReturnType<typeof loadIndependentOfficialSourceFields>
  >,
): Promise<{
  snapshot: TranslationSnapshot;
  coverage: ReturnType<typeof translationCoverage>;
  removedFields: number;
}> {
  const current = exactSnapshot(
    JSON.parse(await readFile(path.join(LOCALES_ROOT, `${locale}.json`), "utf8")) as unknown,
    locale
  );
  if (
    current.sourceCatalogSha256 !== context.catalogSha256
    || current.sourcePaldexSha256 !== context.paldexSha256
    || current.sourceRevision !== context.sourceRevision
  ) {
    throw new TypeError(`${locale}.json source identity가 현재 catalog와 일치하지 않습니다.`);
  }
  const sourceByIdentity = new Map(
    context.corpus.map((record) => [`${record.kind}:${record.id}`, record])
  );
  const validated = current.records.map((record, index) =>
    validateTranslationRecord(
      record,
      locale,
      sourceByIdentity,
      identicalAllowlist,
      `${locale}.records[${index}]`,
      reviewedNames,
      reviewedTerms
    ));
  const filtered = withoutMachineFields(validated);
  assertUniqueSortedTranslationRecords(filtered.records, `${locale}.records`);
  assertReviewedNameRecords(filtered.records, locale, reviewedNames);
  if (
    filtered.records.some((record) =>
      Object.values(record.fields).some((field) => field?.status === "machine_assisted"))
  ) {
    throw new TypeError(`${locale}.json에 기계 보조 번역이 남아 있습니다.`);
  }
  const coverage = translationCoverage(filtered.records, context.corpus);
  if (
    coverage.status.machine_assisted !== 0
    || coverage.status.human_reviewed + coverage.status.source_provided === 0
  ) {
    throw new TypeError(`${locale}.json 번역 상태 집계가 공식·검수 번역 전용 정책과 일치하지 않습니다.`);
  }
  const translationMethod = translationMethodForStatusCounts(coverage.status);
  const snapshot: TranslationSnapshot = {
    schemaVersion: PALWORLD_TRANSLATION_SCHEMA_VERSION,
    release: PALWORLD_TRANSLATION_RELEASE,
    locale,
    sourceCatalogSha256: context.catalogSha256,
    sourcePaldexSha256: context.paldexSha256,
    sourceRevision: context.sourceRevision,
    translationRevision: TRANSLATION_REVISION,
    translationMethod,
    translationStatus: coverage.missing === 0 ? "complete" : "incomplete",
    translatedAt: PALWORLD_TRANSLATION_FIXED_TIME,
    reviewedAt: coverage.status.human_reviewed > 0
      ? PALWORLD_TRANSLATION_FIXED_TIME
      : null,
    records: filtered.records
  };
  assertPalworldTranslationSnapshot(snapshot, {
    release: PALWORLD_TRANSLATION_RELEASE,
    sourceCatalogSha256: context.catalogSha256,
    sourcePaldexSha256: context.paldexSha256,
    sourceRevision: context.sourceRevision,
    records: context.corpus.map((record) => ({
      id: record.id,
      kind: record.kind,
      fields: Object.fromEntries(
        Object.entries(record.fields).map(([field, value]) => [field, {
          text: value?.sourceText,
          sha256: value?.sourceSha256
        }])
      ) as never
    })),
    officialSourceFields: independentOfficialSourceFieldsForRecords(
      locale,
      filtered.records,
      independentOfficialSourceFields,
    ),
    englishCopyAllowlist: [...identicalAllowlist]
      .filter((key) => key.startsWith(`${locale}:`))
      .map((key) => key.slice(locale.length + 1))
  });
  return { snapshot, coverage, removedFields: filtered.removedFields };
}

async function main(): Promise<void> {
  const context = await loadTranslationSources();
  const [identicalAllowlist, reviewedNames, reviewedTerms, glossaryBytes] = await Promise.all([
    readIdenticalAllowlist(),
    readReviewedNames(),
    readReviewedGlossaryTerms(),
    readFile(path.join(LOCALES_ROOT, "glossary.json"))
  ]);
  const independentOfficialSourceFields =
    await loadIndependentOfficialSourceFields({
      release: PALWORLD_TRANSLATION_RELEASE,
      sourceCatalogSha256: context.catalogSha256,
      sourcePaldexSha256: context.paldexSha256,
    });
  const generated = await Promise.all(
    (["ko", "ja"] as const).map((locale) =>
      createLocale(
        locale,
        context,
        identicalAllowlist,
        reviewedNames,
        reviewedTerms,
        independentOfficialSourceFields,
      ))
  );

  // locale 두 개를 모두 메모리에서 검증한 뒤 manifest를 마지막에 게시합니다.
  for (const [index, locale] of (["ko", "ja"] as const).entries()) {
    const artifact = generated[index]!;
    await atomicWriteJson(path.join(LOCALES_ROOT, `${locale}.json`), artifact.snapshot);
    await atomicWriteJson(path.join(LOCALES_ROOT, `${locale}-coverage.json`), {
      schemaVersion: PALWORLD_TRANSLATION_SCHEMA_VERSION,
      release: PALWORLD_TRANSLATION_RELEASE,
      locale,
      sourceCatalogSha256: context.catalogSha256,
      sourcePaldexSha256: context.paldexSha256,
      translationRevision: artifact.snapshot.translationRevision,
      translationStatus: artifact.snapshot.translationStatus,
      coverage: artifact.coverage,
      contentSha256: sha256(stableJson(artifact.snapshot.records))
    });
  }

  const localeManifest = Object.fromEntries(
    await Promise.all((["ko", "ja"] as const).map(async (locale, index) => {
      const bytes = await readFile(path.join(LOCALES_ROOT, `${locale}.json`));
      return [locale, {
        file: `${locale}.json`,
        sha256: sha256(bytes),
        recordCount: generated[index]!.snapshot.records.length
      }];
    }))
  );
  await atomicWriteJson(path.join(LOCALES_ROOT, "manifest.json"), {
    schemaVersion: PALWORLD_TRANSLATION_SCHEMA_VERSION,
    release: PALWORLD_TRANSLATION_RELEASE,
    sourceCatalogSha256: context.catalogSha256,
    sourcePaldexSha256: context.paldexSha256,
    glossarySha256: sha256(glossaryBytes),
    sourceRevision: context.sourceRevision,
    translationRevision: TRANSLATION_REVISION,
    generatedAt: PALWORLD_TRANSLATION_FIXED_TIME,
    locales: localeManifest
  });
  process.stdout.write(`${JSON.stringify({
    release: PALWORLD_TRANSLATION_RELEASE,
    translationRevision: TRANSLATION_REVISION,
    machineAssisted: 0,
    locales: Object.fromEntries(
      (["ko", "ja"] as const).map((locale, index) => [locale, {
        records: generated[index]!.snapshot.records.length,
        removedFields: generated[index]!.removedFields,
        retainedSourceProvidedFields: generated[index]!.coverage.status.source_provided,
        retainedHumanReviewedFields: generated[index]!.coverage.status.human_reviewed,
        fallbackFields: generated[index]!.coverage.missing
      }])
    )
  }, null, 2)}\n`);
}

await main();
