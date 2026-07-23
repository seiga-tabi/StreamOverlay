import path from "node:path";
import { mkdir, readFile, readdir, unlink } from "node:fs/promises";
import {
  CANDIDATE_ROOT,
  GLOSSARY_OVERRIDE_FILE,
  LOCALES_ROOT,
  PALWORLD_TRANSLATION_BATCH_SIZE,
  PALWORLD_TRANSLATION_FIXED_TIME,
  PALWORLD_TRANSLATION_RELEASE,
  PALWORLD_TRANSLATION_SCHEMA_VERSION,
  SOURCE_BATCH_ROOT,
  atomicWriteJson,
  analyzeTranslationSource,
  loadTranslationSources,
  readNameCollisionOverrides,
  sha256,
  translationNameCollisions,
  type TranslationCorpusRecord,
  type TranslationFieldName,
} from "./palworld-translation-artifacts.js";

const FIELD_ORDER: readonly TranslationFieldName[] = ["name", "description", "passiveAbility"];

const TERMS = [
  ["element.neutral", "Neutral", "무속성", "無属性", "element"],
  ["element.fire", "Fire", "불", "炎", "element"],
  ["element.water", "Water", "물", "水", "element"],
  ["element.electric", "Electric", "번개", "雷", "element"],
  ["element.grass", "Grass", "풀", "草", "element"],
  ["element.ice", "Ice", "얼음", "氷", "element"],
  ["element.ground", "Ground", "땅", "地", "element"],
  ["element.dark", "Dark", "어둠", "闇", "element"],
  ["element.dragon", "Dragon", "용", "竜", "element"],
  ["work.kindling", "Kindling", "불 피우기", "火おこし", "work"],
  ["work.watering", "Watering", "관개", "水やり", "work"],
  ["work.planting", "Planting", "파종", "種まき", "work"],
  ["work.generating_electricity", "Generating Electricity", "발전", "発電", "work"],
  ["work.handiwork", "Handiwork", "수작업", "手作業", "work"],
  ["work.gathering", "Gathering", "채집", "採集", "work"],
  ["work.lumbering", "Lumbering", "벌목", "伐採", "work"],
  ["work.mining", "Mining", "채굴", "採掘", "work"],
  ["work.medicine_production", "Medicine Production", "제약", "製薬", "work"],
  ["work.cooling", "Cooling", "냉각", "冷却", "work"],
  ["work.transporting", "Transporting", "운반", "運搬", "work"],
  ["work.farming", "Farming", "목장", "牧場", "work"],
  ["skill.active", "Active Skill", "액티브 스킬", "アクティブスキル", "skill"],
  ["skill.partner", "Partner Skill", "파트너 스킬", "パートナースキル", "skill"],
  ["skill.passive", "Passive Skill", "패시브 스킬", "パッシブスキル", "skill"],
  ["category.material", "Material", "재료", "素材", "item-category"],
  ["category.consumable", "Consumable", "소모품", "消耗品", "item-category"],
  ["category.weapon", "Weapon", "무기", "武器", "item-category"],
  ["category.armor", "Armor", "방어구", "防具", "item-category"],
  ["category.accessory", "Accessory", "액세서리", "アクセサリー", "item-category"],
  ["category.sphere", "Pal Sphere", "Pal 스피어", "パルスフィア", "item-category"],
  ["category.ammo", "Ammo", "탄약", "弾薬", "item-category"],
  ["category.food", "Food", "식량", "食料", "item-category"],
  ["category.medicine", "Medicine", "약", "薬", "item-category"],
  ["category.key_item", "Key Item", "중요 아이템", "大事なもの", "item-category"],
  ["category.building", "Building", "건축", "建築", "item-category"],
  ["category.other", "Other", "기타", "その他", "item-category"],
] as const;

function fieldStatistics(corpus: readonly TranslationCorpusRecord[]) {
  const result: Record<string, unknown> = {};
  for (const kind of ["pal", "item", "skill"] as const) {
    const records = corpus.filter((record) => record.kind === kind);
    const kindResult: Record<string, unknown> = {};
    for (const field of FIELD_ORDER) {
      const values = records.flatMap((record) => {
        const value = record.fields[field]?.sourceText;
        return value === undefined ? [] : [value];
      });
      const occurrences = new Map<string, number>();
      for (const value of values) occurrences.set(value, (occurrences.get(value) ?? 0) + 1);
      const duplicateOccurrences = [...occurrences.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
      kindResult[field] = {
        records: values.length,
        unique: occurrences.size,
        duplicateOccurrences,
        characters: values.reduce((sum, value) => sum + [...value].length, 0),
        words: values.reduce((sum, value) => sum + value.trim().split(/\s+/u).length, 0),
        maximumCharacters: values.length === 0 ? 0 : Math.max(...values.map((value) => [...value].length)),
      };
    }
    result[kind] = kindResult;
  }
  return result;
}

function repeatedTexts(corpus: readonly TranslationCorpusRecord[]) {
  const occurrences = new Map<string, { kind: string; field: string; text: string; ids: string[] }>();
  for (const record of corpus) {
    for (const field of FIELD_ORDER) {
      const text = record.fields[field]?.sourceText;
      if (!text) continue;
      const key = `${record.kind}\u0000${field}\u0000${text}`;
      const existing = occurrences.get(key) ?? { kind: record.kind, field, text, ids: [] };
      existing.ids.push(record.id);
      occurrences.set(key, existing);
    }
  }
  return [...occurrences.values()]
    .filter((entry) => entry.ids.length > 1)
    .sort((left, right) => right.ids.length - left.ids.length || left.kind.localeCompare(right.kind, "en") || left.text.localeCompare(right.text, "en"))
    .slice(0, 200)
    .map((entry) => ({ ...entry, count: entry.ids.length }));
}

function sourceQuality(corpus: readonly TranslationCorpusRecord[]) {
  const records = corpus.flatMap((record) => FIELD_ORDER.flatMap((fieldName) => {
    const source = record.fields[fieldName];
    if (!source) return [];
    const anomaly = analyzeTranslationSource(source.sourceText);
    if (anomaly.missingSlotCount === 0) return [];
    return [{
      id: record.id,
      kind: record.kind,
      field: fieldName,
      sourceSha256: source.sourceSha256,
      codes: anomaly.codes,
      missingSlotCount: anomaly.missingSlotCount,
    }];
  }));
  return {
    policy: "preserve_missing_source_marker",
    markers: { ko: "[원문 누락]", ja: "[原文欠落]" },
    candidateNote: "source_anomaly_preserved",
    anomalousFields: records.length,
    missingSlots: records.reduce((sum, record) => sum + record.missingSlotCount, 0),
    records,
  };
}

async function main(): Promise<void> {
  const sources = await loadTranslationSources();
  const corpusArtifact = {
    schemaVersion: PALWORLD_TRANSLATION_SCHEMA_VERSION,
    release: PALWORLD_TRANSLATION_RELEASE,
    sourceCatalogSha256: sources.catalogSha256,
    sourcePaldexSha256: sources.paldexSha256,
    sourceRevision: sources.sourceRevision,
    extractedAt: PALWORLD_TRANSLATION_FIXED_TIME,
    records: sources.corpus,
  };
  await atomicWriteJson(path.join(LOCALES_ROOT, "corpus.json"), corpusArtifact);

  await mkdir(SOURCE_BATCH_ROOT, { recursive: true, mode: 0o755 });
  for (const name of await readdir(SOURCE_BATCH_ROOT)) {
    if (/^batch-\d{4}\.json$/u.test(name)) await unlink(path.join(SOURCE_BATCH_ROOT, name));
  }
  const batches = [];
  for (let offset = 0; offset < sources.corpus.length; offset += PALWORLD_TRANSLATION_BATCH_SIZE) {
    const index = offset / PALWORLD_TRANSLATION_BATCH_SIZE + 1;
    const records = sources.corpus.slice(offset, offset + PALWORLD_TRANSLATION_BATCH_SIZE);
    const name = `batch-${String(index).padStart(4, "0")}.json`;
    const value = {
      schemaVersion: PALWORLD_TRANSLATION_SCHEMA_VERSION,
      release: PALWORLD_TRANSLATION_RELEASE,
      sourceCatalogSha256: sources.catalogSha256,
      sourcePaldexSha256: sources.paldexSha256,
      batchIndex: index,
      records,
    };
    await atomicWriteJson(path.join(SOURCE_BATCH_ROOT, name), value);
    batches.push({ name, first: `${records[0]?.kind}:${records[0]?.id}`, last: `${records.at(-1)?.kind}:${records.at(-1)?.id}`, records: records.length, sha256: sha256(`${JSON.stringify(value, null, 2)}\n`) });
  }

  const collisions = translationNameCollisions(sources.corpus);
  await readNameCollisionOverrides(collisions);
  const glossaryOverrideSha256 = sha256(await readFile(GLOSSARY_OVERRIDE_FILE));
  const glossary = {
    schemaVersion: PALWORLD_TRANSLATION_SCHEMA_VERSION,
    release: PALWORLD_TRANSLATION_RELEASE,
    sourceCatalogSha256: sources.catalogSha256,
    sourcePaldexSha256: sources.paldexSha256,
    generatedAt: PALWORLD_TRANSLATION_FIXED_TIME,
    reviewedNames: sources.reviewedNames,
    terms: TERMS.map(([key, en, ko, ja, domain]) => ({ key, en, ko, ja, domain })),
    nameCollisions: collisions,
    englishCopyAllowlist: [],
  };
  await atomicWriteJson(path.join(LOCALES_ROOT, "glossary.json"), glossary);

  for (const locale of ["ko", "ja"] as const) {
    const fields = locale === "ko" ? "ko" : "ja";
    const records = sources.reviewedNames.map((reviewed) => ({
      id: reviewed.id,
      kind: reviewed.kind,
      fields: {
        name: {
          sourceSha256: reviewed.sourceSha256,
          text: reviewed[fields],
          status: "human_reviewed" as const,
          note: locale === "ko" ? "기존 canonical 데이터의 검수 이름" : "既存canonicalデータの確認済み名称",
        },
      },
    }));
    await atomicWriteJson(path.join(CANDIDATE_ROOT, locale, "batch-0000.json"), {
      schemaVersion: PALWORLD_TRANSLATION_SCHEMA_VERSION,
      locale,
      records,
    });
  }

  const statistics = fieldStatistics(sources.corpus);
  const fieldTotal = sources.corpus.reduce((sum, record) => sum + Object.keys(record.fields).length, 0);
  const sourceCharacters = sources.corpus.reduce((sum, record) => sum + Object.values(record.fields).reduce((fieldSum, field) => fieldSum + (field ? [...field.sourceText].length : 0), 0), 0);
  const report = {
    schemaVersion: PALWORLD_TRANSLATION_SCHEMA_VERSION,
    release: PALWORLD_TRANSLATION_RELEASE,
    sourceCatalogSha256: sources.catalogSha256,
    sourcePaldexSha256: sources.paldexSha256,
    generatedAt: PALWORLD_TRANSLATION_FIXED_TIME,
    records: sources.corpus.length,
    fields: fieldTotal,
    characters: sourceCharacters,
    statistics,
    repeatedTexts: repeatedTexts(sources.corpus),
    sourceQuality: sourceQuality(sources.corpus),
  };
  await atomicWriteJson(path.join(LOCALES_ROOT, "corpus-report.json"), report);
  await atomicWriteJson(path.join(LOCALES_ROOT, "corpus-manifest.json"), {
    schemaVersion: PALWORLD_TRANSLATION_SCHEMA_VERSION,
    release: PALWORLD_TRANSLATION_RELEASE,
    sourceCatalogSha256: sources.catalogSha256,
    sourcePaldexSha256: sources.paldexSha256,
    sourceRevision: sources.sourceRevision,
    generatedAt: PALWORLD_TRANSLATION_FIXED_TIME,
    batchSize: PALWORLD_TRANSLATION_BATCH_SIZE,
    batches,
    corpusSha256: sha256(`${JSON.stringify(corpusArtifact, null, 2)}\n`),
    glossarySha256: sha256(`${JSON.stringify(glossary, null, 2)}\n`),
    glossaryOverridesSha256: glossaryOverrideSha256,
    reportSha256: sha256(`${JSON.stringify(report, null, 2)}\n`),
  });

  process.stdout.write(`${JSON.stringify({ records: sources.corpus.length, fields: fieldTotal, characters: sourceCharacters, batches: batches.length, statistics }, null, 2)}\n`);
}

await main();
