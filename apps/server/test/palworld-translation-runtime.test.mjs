import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const { adaptPalworldCatalog } = await import("../dist/data/palworld-catalog-adapter.js");
const { loadPalworldCatalogDataSource } = await import("../dist/data/palworld-catalog-artifact.js");
const { PALWORLD_SNAPSHOT } = await import("../dist/data/palworld-snapshot.js");
const { loadPalworldPaldexRuntimeRelease } = await import("../dist/data/palworld-paldex-adapter.js");
const {
  createPalworldTranslationValidationContext,
  loadPalworldTranslationBundle
} = await import("../dist/data/palworld-translation-artifact.js");
const {
  loadPalworldReviewedItemAliases
} = await import("../dist/data/palworld-reviewed-item-aliases.js");
const { loadPalworldDataService } = await import("../dist/services/palworld-data.js");

const releaseRoot = fileURLToPath(new URL("../data/palworld/1.0.1/", import.meta.url));
const temporaryRoots = [];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function fixture() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "streamops-palworld-translations-")));
  temporaryRoots.push(root);
  const target = path.join(root, "release");
  cpSync(releaseRoot, target, { recursive: true });
  return target;
}

async function canonicalContext(root = releaseRoot) {
  const [catalogSource, paldex] = await Promise.all([
    loadPalworldCatalogDataSource(root),
    loadPalworldPaldexRuntimeRelease({ releaseRoot: root })
  ]);
  const reviewedItemAliases = await loadPalworldReviewedItemAliases(root, catalogSource.catalog);
  return {
    catalogSource,
    paldex,
    reviewedItemAliases,
    context: createPalworldTranslationValidationContext({
      catalog: catalogSource.catalog,
      catalogSha256: catalogSource.manifest.catalogSha256,
      paldex,
      paldexSha256: paldex.manifest.paldexSha256,
      reviewedItemAliases
    })
  };
}

test.after(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

test("고정 KO·JA locale artifact는 canonical hash 검증 후 독립적으로 로드된다", async () => {
  const { context } = await canonicalContext();
  const bundle = await loadPalworldTranslationBundle({ releaseRoot, context });
  assert.deepEqual(bundle.states, {
    ko: { status: "loaded", staleSourceHash: false },
    ja: { status: "loaded", staleSourceHash: false }
  });
  assert.equal(bundle.snapshots.ko.locale, "ko");
  assert.equal(bundle.snapshots.ja.locale, "ja");
  assert.equal(bundle.snapshots.ko.records.length > 0, true);
  assert.equal(bundle.snapshots.ja.records.length > 0, true);
});

test("한 locale 파일이 손상되어도 다른 locale과 Palworld catalog runtime은 유지된다", async () => {
  const root = fixture();
  writeFileSync(path.join(root, "locales", "ko.json"), "{손상된 locale", "utf8");
  const { context } = await canonicalContext(root);
  const bundle = await loadPalworldTranslationBundle({ releaseRoot: root, context });
  assert.equal(bundle.states.ko.status, "invalid");
  assert.equal(bundle.states.ko.errorCode, "PALWORLD_TRANSLATION_LOCALE_INVALID");
  assert.equal(bundle.states.ko.staleSourceHash, false);
  assert.equal(bundle.snapshots.ko, undefined);
  assert.equal(bundle.states.ja.status, "loaded");
  assert.equal(bundle.snapshots.ja.locale, "ja");

  const reported = [];
  const service = await loadPalworldDataService({
    releaseRoot: root,
    catalogRoot: root,
    onTranslationState(locale, state) {
      reported.push({ locale, ...state });
    }
  });
  assert.equal(service.meta().counts.pals, 287);
  assert.deepEqual(reported.map(({ locale, status, errorCode }) => ({ locale, status, errorCode })), [
    { locale: "ko", status: "invalid", errorCode: "PALWORLD_TRANSLATION_LOCALE_INVALID" },
    { locale: "ja", status: "loaded", errorCode: undefined }
  ]);
  assert.equal(JSON.stringify(reported).includes("손상된 locale"), false);
});

test("glossary가 누락되면 번역만 안전하게 차단하고 safe error code를 반환한다", async () => {
  const root = fixture();
  rmSync(path.join(root, "locales", "glossary.json"));
  const { context } = await canonicalContext(root);
  const bundle = await loadPalworldTranslationBundle({ releaseRoot: root, context });
  assert.deepEqual(bundle.states, {
    ko: {
      status: "invalid",
      errorCode: "PALWORLD_TRANSLATION_GLOSSARY_INVALID",
      staleSourceHash: false
    },
    ja: {
      status: "invalid",
      errorCode: "PALWORLD_TRANSLATION_GLOSSARY_INVALID",
      staleSourceHash: false
    }
  });
  assert.deepEqual(bundle.snapshots, {});
});

test("glossary 본문 변조는 runtime manifest checksum으로 차단한다", async () => {
  const root = fixture();
  const glossaryPath = path.join(root, "locales", "glossary.json");
  const glossary = JSON.parse(readFileSync(glossaryPath, "utf8"));
  glossary.terms[0].ko = "변조된 용어";
  writeFileSync(glossaryPath, `${JSON.stringify(glossary, null, 2)}\n`, "utf8");
  const { context } = await canonicalContext(root);
  const bundle = await loadPalworldTranslationBundle({ releaseRoot: root, context });
  assert.equal(bundle.states.ko.errorCode, "PALWORLD_TRANSLATION_GLOSSARY_INVALID");
  assert.equal(bundle.states.ja.errorCode, "PALWORLD_TRANSLATION_GLOSSARY_INVALID");
});

test("glossary source catalog checksum 변조는 manifest hash를 함께 바꿔도 fail-closed 처리한다", async () => {
  const root = fixture();
  const glossaryPath = path.join(root, "locales", "glossary.json");
  const manifestPath = path.join(root, "locales", "manifest.json");
  const glossary = JSON.parse(readFileSync(glossaryPath, "utf8"));
  glossary.sourceCatalogSha256 = "f".repeat(64);
  const glossaryBytes = Buffer.from(`${JSON.stringify(glossary, null, 2)}\n`, "utf8");
  writeFileSync(glossaryPath, glossaryBytes);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.glossarySha256 = sha256(glossaryBytes);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const { context } = await canonicalContext(root);
  const bundle = await loadPalworldTranslationBundle({ releaseRoot: root, context });
  assert.equal(bundle.states.ko.errorCode, "PALWORLD_TRANSLATION_GLOSSARY_INVALID");
  assert.equal(bundle.states.ko.staleSourceHash, true);
  assert.equal(bundle.states.ja.staleSourceHash, true);
});

test("human-reviewed Pal 이름은 locale checksum을 갱신해도 glossary 이름과 다르면 차단한다", async () => {
  const root = fixture();
  const localePath = path.join(root, "locales", "ko.json");
  const manifestPath = path.join(root, "locales", "manifest.json");
  const snapshot = JSON.parse(readFileSync(localePath, "utf8"));
  const record = snapshot.records.find((entry) => entry.kind === "pal" && entry.fields.name?.status === "human_reviewed");
  assert.ok(record);
  record.fields.name.text = `${record.fields.name.text} 변조`;
  const localeBytes = Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  writeFileSync(localePath, localeBytes);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.locales.ko.sha256 = sha256(localeBytes);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const { context } = await canonicalContext(root);
  const bundle = await loadPalworldTranslationBundle({ releaseRoot: root, context });
  assert.equal(bundle.states.ko.errorCode, "PALWORLD_TRANSLATION_LOCALE_INVALID");
  assert.equal(bundle.states.ja.status, "loaded");
});

test("glossary·locale·manifest를 함께 변조해도 Pal ID·영문·source hash를 canonical context와 대조한다", async () => {
  const root = fixture();
  const glossaryPath = path.join(root, "locales", "glossary.json");
  const localePath = path.join(root, "locales", "ko.json");
  const manifestPath = path.join(root, "locales", "manifest.json");
  const glossary = JSON.parse(readFileSync(glossaryPath, "utf8"));
  const snapshot = JSON.parse(readFileSync(localePath, "utf8"));
  const palName = glossary.reviewedNames.find((entry) => entry.kind === "pal");
  assert.ok(palName);
  const record = snapshot.records.find((entry) => entry.kind === "pal" && entry.id === palName.id);
  assert.ok(record?.fields.name);
  palName.ko = `${palName.ko} 변조`;
  record.fields.name.text = palName.ko;
  const glossaryBytes = Buffer.from(`${JSON.stringify(glossary, null, 2)}\n`, "utf8");
  const localeBytes = Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  writeFileSync(glossaryPath, glossaryBytes);
  writeFileSync(localePath, localeBytes);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.glossarySha256 = sha256(glossaryBytes);
  manifest.locales.ko.sha256 = sha256(localeBytes);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const { context } = await canonicalContext(root);
  const bundle = await loadPalworldTranslationBundle({ releaseRoot: root, context });
  assert.equal(bundle.states.ko.errorCode, "PALWORLD_TRANSLATION_GLOSSARY_INVALID");
  assert.equal(bundle.states.ko.staleSourceHash, true);
  assert.equal(bundle.states.ja.errorCode, "PALWORLD_TRANSLATION_GLOSSARY_INVALID");
});

test("canonical item 영문 이름이 바뀌면 번역만 stale로 차단하고 validation context 생성은 유지한다", async () => {
  const { catalogSource, paldex, reviewedItemAliases } = await canonicalContext();
  const localizedIds = new Set(PALWORLD_SNAPSHOT.items.map((item) => item.id));
  const reviewedItem = catalogSource.catalog.items.find((item) => localizedIds.has(item.id));
  assert.ok(reviewedItem);
  const changedCatalog = structuredClone(catalogSource.catalog);
  const changedItem = changedCatalog.items.find((item) => item.id === reviewedItem.id);
  assert.ok(changedItem);
  changedItem.nameEn = `${changedItem.nameEn} Changed`;
  const context = createPalworldTranslationValidationContext({
    catalog: changedCatalog,
    catalogSha256: catalogSource.manifest.catalogSha256,
    paldex,
    paldexSha256: paldex.manifest.paldexSha256,
    reviewedItemAliases
  });

  assert.equal(context.reviewedNames.some((entry) => entry.kind === "item" && entry.id === reviewedItem.id), false);
  const bundle = await loadPalworldTranslationBundle({ releaseRoot, context });
  assert.deepEqual(bundle.snapshots, {});
  assert.equal(bundle.states.ko.errorCode, "PALWORLD_TRANSLATION_GLOSSARY_INVALID");
  assert.equal(bundle.states.ko.staleSourceHash, true);
  assert.equal(bundle.states.ja.errorCode, "PALWORLD_TRANSLATION_GLOSSARY_INVALID");
  assert.equal(bundle.states.ja.staleSourceHash, true);
});

test("canonical source hash가 오래된 manifest는 두 locale을 차단하고 stale coverage만 기록한다", async () => {
  const root = fixture();
  const manifestPath = path.join(root, "locales", "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.sourceCatalogSha256 = "f".repeat(64);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const reported = [];
  const service = await loadPalworldDataService({
    releaseRoot: root,
    catalogRoot: root,
    onTranslationState(locale, state) {
      reported.push({ locale, ...state });
    }
  });
  const meta = service.meta();
  assert.equal(meta.counts.pals, 287);
  assert.equal(meta.coverage.translations.ko.staleSourceHash > 0, true);
  assert.equal(meta.coverage.translations.ja.staleSourceHash > 0, true);
  assert.deepEqual(reported.map(({ status, errorCode, staleSourceHash }) => ({ status, errorCode, staleSourceHash })), [
    {
      status: "invalid",
      errorCode: "PALWORLD_TRANSLATION_MANIFEST_INVALID",
      staleSourceHash: true
    },
    {
      status: "invalid",
      errorCode: "PALWORLD_TRANSLATION_MANIFEST_INVALID",
      staleSourceHash: true
    }
  ]);
});

test("runtime adapter는 미검수 machine 이름을 영문 fallback으로 격리하고 설명 번역은 유지한다", async () => {
  const { catalogSource, paldex, context, reviewedItemAliases } = await canonicalContext();
  const localizedIds = new Set(PALWORLD_SNAPSHOT.items.map((item) => item.id));
  const item = catalogSource.catalog.items.find((candidate) => !localizedIds.has(candidate.id));
  assert.ok(item);
  const koSnapshot = {
    schemaVersion: 1,
    release: context.release,
    locale: "ko",
    sourceCatalogSha256: context.sourceCatalogSha256,
    sourcePaldexSha256: context.sourcePaldexSha256,
    sourceRevision: context.sourceRevision,
    translationRevision: "runtime-merge-test-v1",
    translationMethod: "machine_assisted",
    translationStatus: "incomplete",
    translatedAt: "2026-07-22T00:00:00.000Z",
    reviewedAt: null,
    records: [{
      id: item.id,
      kind: "item",
      fields: {
        name: {
          sourceSha256: createHash("sha256").update(item.nameEn, "utf8").digest("hex"),
          text: "노출하면 안 되는 미검수 이름",
          status: "machine_assisted"
        },
        description: {
          sourceSha256: createHash("sha256").update(item.descriptionEn, "utf8").digest("hex"),
          text: "검증용 번역 설명",
          status: "machine_assisted"
        }
      }
    }]
  };
  const adapted = adaptPalworldCatalog({
    basePaldex: paldex,
    catalog: catalogSource.catalog,
    catalogChecksum: catalogSource.manifest.catalogSha256,
    localizedSnapshot: PALWORLD_SNAPSHOT,
    sourceInternalIds: paldex.sourceInternalIds,
    translations: {
      snapshots: { ko: koSnapshot },
      staleSourceHash: { ko: false, ja: false }
    },
    reviewedItemAliases,
    sourceChecksum: "a".repeat(64)
  });
  const merged = adapted.snapshot.items.find((candidate) => candidate.id === item.id);
  assert.equal(merged.nameKo, undefined);
  assert.equal(merged.descriptionKo, "검증용 번역 설명");
  assert.equal(merged.nameEn, item.nameEn);
  assert.equal(merged.translation.name.ko, "source_language_fallback");
  assert.equal(merged.translation.description.ko, "machine_assisted");
  assert.equal(merged.translation.name.ja, "source_language_fallback");
  assert.equal(adapted.coverage.translations.ko.itemNames.missing > 0, true);
});

test("현재 미검수 item·skill machine 이름과 대표 오류 문자열은 runtime 이름으로 노출되지 않는다", async () => {
  const service = await loadPalworldDataService();
  const forbidden = ["회사 소개", "지금 연락", "クアッドマックス", "夏期マックス", "サドル。"];
  for (const locale of ["ko", "ja"]) {
    const snapshot = JSON.parse(readFileSync(path.join(releaseRoot, "locales", `${locale}.json`), "utf8"));
    const machineNames = snapshot.records.filter((record) =>
      (record.kind === "item" || record.kind === "skill")
      && record.fields.name?.status === "machine_assisted"
    );
    assert.equal(machineNames.length, 2_403);
    for (const record of machineNames) {
      const runtime = record.kind === "item" ? service.getItem(record.id) : service.getSkill(record.id);
      assert.equal(locale === "ko" ? runtime.nameKo : runtime.nameJa, undefined, `${locale}:${record.kind}:${record.id}`);
      assert.equal(runtime.nameEn.length > 0, true);
    }
  }
  const badNames = [];
  for (const locale of ["ko", "ja"]) {
    const snapshot = JSON.parse(readFileSync(path.join(releaseRoot, "locales", `${locale}.json`), "utf8"));
    for (const record of snapshot.records) {
      if (forbidden.includes(record.fields.name?.text)) badNames.push(record.fields.name.text);
    }
  }
  assert.equal(badNames.length > 0, true, "regression fixture가 실제 문제 문자열을 포함해야 합니다.");
});

test("versioned exact alias는 기존 검수 아이템 10개의 locale 이름을 human_reviewed로 유지한다", async () => {
  const service = await loadPalworldDataService();
  const expected = new Map([
    ["copper-ingot", ["금속 주괴", "金属インゴット"]],
    ["copper-ore", ["금속 광석", "金属鉱石"]],
    ["pal-crystal-ex", ["고대 문명의 부품", "古代文明の部品"]],
    ["pal-crystal-s", ["팰지움 파편", "パルジウムの欠片"]],
    ["pal-sphere-mega", ["메가 스피어", "メガスフィア"]],
  ]);
  for (const [id, [ko, ja]] of expected) {
    const item = service.getItem(id);
    assert.equal(item.nameKo, ko);
    assert.equal(item.nameJa, ja);
    assert.deepEqual(item.translation.name, { ko: "human_reviewed", ja: "human_reviewed" });
  }
});

test("meta locale coverage는 데이터 수와 번역·fallback·missing-source 집계를 일관되게 제공한다", async () => {
  const service = await loadPalworldDataService();
  const meta = service.meta();
  for (const locale of ["ko", "ja"]) {
    const translated = meta.coverage.translations[locale];
    assert.equal(translated.palNames.total, meta.counts.pals);
    assert.equal(translated.itemNames.total, meta.counts.items);
    assert.equal(translated.skillNames.total, meta.counts.skills);
    assert.equal(translated.palDescriptions.total <= meta.counts.pals, true);
    assert.equal(translated.itemDescriptions.total <= meta.counts.items, true);
    assert.equal(translated.skillDescriptions.total <= meta.counts.skills, true);
    assert.equal(translated.skillPassiveAbilities.total <= meta.counts.skills, true);
    assert.equal(translated.palNames.available + translated.palNames.missing, translated.palNames.total);
    const fieldCoverages = [
      translated.palNames,
      translated.palDescriptions,
      translated.itemNames,
      translated.itemDescriptions,
      translated.skillNames,
      translated.skillDescriptions,
      translated.skillPassiveAbilities
    ];
    assert.equal(
      translated.humanReviewed + translated.machineAssisted,
      fieldCoverages.reduce((sum, field) => sum + field.available, 0)
    );
    assert.equal(
      translated.sourceLanguageFallback,
      fieldCoverages.reduce((sum, field) => sum + field.missing, 0)
    );
  }
});
