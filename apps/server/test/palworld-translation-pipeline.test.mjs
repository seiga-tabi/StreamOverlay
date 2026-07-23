import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const {
  PALWORLD_TRANSLATION_MISSING_SOURCE_MARKER,
  PALWORLD_TRANSLATION_SOURCE_ANOMALY_NOTE,
  analyzeTranslationSource,
  assertStrictMachineNameQualityForImport,
  assertReviewedNameRecords,
  assertUniqueSortedTranslationRecords,
  mergeTranslationRecords,
  sha256,
  stableJson,
  translationNameCollisions,
  validateNameCollisionOverrides,
  validateTranslationRecord,
} = await import("../dist/scripts/palworld-translation-artifacts.js");
const {
  validatePalworldReviewedItemAliases
} = await import("../dist/data/palworld-reviewed-item-aliases.js");

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localeRoot = path.join(serverRoot, "data", "palworld", "1.0.1", "locales");

function sourceRecord(options = {}) {
  const { id = "test-item", kind = "item", name = "Test Item" } = options;
  const description = Object.hasOwn(options, "description") ? options.description : "A useful item.";
  return {
    id,
    kind,
    fields: {
      name: { sourceText: name, sourceSha256: sha256(name) },
      ...(description === undefined ? {} : {
        description: { sourceText: description, sourceSha256: sha256(description) },
      }),
    },
  };
}

function translationRecord(source, {
  name = "테스트 아이템",
  description = "유용한 아이템이다.",
  status = "machine_assisted",
  note,
} = {}) {
  return {
    id: source.id,
    kind: source.kind,
    fields: {
      name: { sourceSha256: source.fields.name.sourceSha256, text: name, status },
      ...(source.fields.description === undefined ? {} : {
        description: {
          sourceSha256: source.fields.description.sourceSha256,
          text: description,
          status,
          ...(note === undefined ? {} : { note }),
        },
      }),
    },
  };
}

test("번역 후보 validator는 orphan, stale hash, 영어 복사, HTML과 제어문자를 fail-closed 처리한다", () => {
  const source = sourceRecord();
  const sourceByIdentity = new Map([[`${source.kind}:${source.id}`, source]]);
  const valid = translationRecord(source);
  assert.equal(validateTranslationRecord(valid, "ko", sourceByIdentity, new Set(), "candidate").id, source.id);
  assert.throws(
    () => validateTranslationRecord({ ...valid, id: "orphan" }, "ko", sourceByIdentity, new Set(), "candidate"),
    /존재하지 않는 canonical ID/u,
  );
  assert.throws(
    () => validateTranslationRecord({ ...valid, fields: { ...valid.fields, name: { ...valid.fields.name, sourceSha256: "a".repeat(64) } } }, "ko", sourceByIdentity, new Set(), "candidate"),
    /원문 hash/u,
  );
  assert.throws(
    () => validateTranslationRecord({ ...valid, fields: { ...valid.fields, name: { ...valid.fields.name, text: source.fields.name.sourceText } } }, "ko", sourceByIdentity, new Set(), "candidate"),
    /영어 원문과 동일/u,
  );
  assert.doesNotThrow(() => validateTranslationRecord(
    { ...valid, fields: { ...valid.fields, name: { ...valid.fields.name, text: source.fields.name.sourceText } } },
    "ko",
    sourceByIdentity,
    new Set(["ko:item:test-item:name"]),
    "candidate",
  ));
  assert.throws(
    () => validateTranslationRecord({ ...valid, fields: { ...valid.fields, description: { ...valid.fields.description, text: "<script>alert(1)</script>" } } }, "ko", sourceByIdentity, new Set(), "candidate"),
    /HTML 또는 script/u,
  );
  assert.throws(
    () => validateTranslationRecord({ ...valid, fields: { ...valid.fields, description: { ...valid.fields.description, text: "잘못된\u0001문자" } } }, "ko", sourceByIdentity, new Set(), "candidate"),
    /제어문자/u,
  );
  assert.throws(
    () => validateTranslationRecord({ ...valid, unexpected: true }, "ko", sourceByIdentity, new Set(), "candidate"),
    /허용되지 않은 필드/u,
  );
  const nameOnlySource = sourceRecord({ description: undefined });
  const nameOnlyMap = new Map([["item:test-item", nameOnlySource]]);
  assert.throws(
    () => validateTranslationRecord(valid, "ko", nameOnlyMap, new Set(), "candidate"),
    /원문에 없는 필드/u,
  );

  const numberedSource = sourceRecord({ description: "Attack +10% for 3 seconds." });
  const numberedMap = new Map([["item:test-item", numberedSource]]);
  assert.throws(
    () => validateTranslationRecord(
      translationRecord(numberedSource, { description: "3초 동안 공격력 +20%." }),
      "ko",
      numberedMap,
      new Set(),
      "candidate",
    ),
    /숫자 값·횟수·등장 순서/u,
  );
});

test("번역 후보 validator는 locale script와 길이·반복·절 유실 퇴행을 차단한다", () => {
  const nameSource = sourceRecord({ description: undefined });
  const nameSourceByIdentity = new Map([["item:test-item", nameSource]]);
  assert.throws(
    () => validateTranslationRecord(
      translationRecord(nameSource, { name: "Translated Item" }),
      "ko",
      nameSourceByIdentity,
      new Set(),
      "candidate",
    ),
    /한국어 문자가 없습니다/u,
  );
  assert.doesNotThrow(() => validateTranslationRecord(
    translationRecord(nameSource, { name: "Test Item", status: "machine_assisted" }),
    "ko",
    nameSourceByIdentity,
    new Set(["ko:item:test-item:name"]),
    "candidate",
  ));
  assert.doesNotThrow(() => validateTranslationRecord(
    translationRecord(nameSource, { name: "Reviewed Item", status: "human_reviewed" }),
    "ko",
    nameSourceByIdentity,
    new Set(),
    "candidate",
  ));
  assert.throws(
    () => validateTranslationRecord(
      translationRecord(nameSource, { name: "Translated Item" }),
      "ja",
      nameSourceByIdentity,
      new Set(),
      "candidate",
    ),
    /일본어 문자가 없습니다/u,
  );
  assert.doesNotThrow(() => validateTranslationRecord(
    translationRecord(nameSource, { name: "短剣" }),
    "ja",
    nameSourceByIdentity,
    new Set(),
    "candidate",
  ));

  const expansionSource = sourceRecord({ description: "This source sentence has enough content." });
  const expansionMap = new Map([["item:test-item", expansionSource]]);
  const expanded = "이 번역문은 원문의 의미보다 불필요하게 길어졌으며 관련 없는 표현을 계속 추가하여 검증 기준을 넘는다. 또한 전혀 필요하지 않은 문장을 여러 방식으로 이어 붙여 원문보다 지나치게 큰 결과를 의도적으로 만든다. 마지막으로 또 다른 무관한 설명을 덧붙여 품질 저하를 확실히 재현한다.";
  assert.throws(
    () => validateTranslationRecord(translationRecord(expansionSource, { description: expanded }), "ko", expansionMap, new Set(), "candidate"),
    /과도하게 증가/u,
  );

  const repeatedSource = sourceRecord({ description: "A normal source description without repeated degeneration." });
  const repeatedMap = new Map([["item:test-item", repeatedSource]]);
  assert.throws(
    () => validateTranslationRecord(translationRecord(repeatedSource, { description: "가나다가나다가나다가나다" }), "ko", repeatedMap, new Set(), "candidate"),
    /n-gram 반복 퇴행/u,
  );

  const lossSourceText = "The first clause explains the primary effect of this item in enough detail to be meaningful. The second clause describes an important limitation that must remain visible. The third clause states how the effect ends and why the player should care.";
  const lossSource = sourceRecord({ description: lossSourceText });
  const lossMap = new Map([["item:test-item", lossSource]]);
  assert.throws(
    () => validateTranslationRecord(translationRecord(lossSource, { description: "설명이 대부분 유실되었다." }), "ko", lossMap, new Set(), "candidate"),
    /절 대부분이 유실/u,
  );
});

test("번역 후보 validator는 숫자 순서와 kg·초·레벨·배율 단위 결합을 보존한다", () => {
  const source = sourceRecord({
    description: "Deals 10% damage for 3 seconds at Lv. 5 and weighs 2 kg at 4x speed."
  });
  const sourceByIdentity = new Map([["item:test-item", source]]);
  const valid = translationRecord(source, {
    description: "10% 피해를 3초 동안 주고 5레벨에서 무게는 2kg이며 속도는 4×이다."
  });
  assert.doesNotThrow(() => validateTranslationRecord(valid, "ko", sourceByIdentity, new Set(), "candidate"));
  assert.throws(
    () => validateTranslationRecord(translationRecord(source, {
      description: "3초 동안 10% 피해를 주고 5레벨에서 무게는 2kg이며 속도는 4×이다."
    }), "ko", sourceByIdentity, new Set(), "candidate"),
    /등장 순서/u,
  );
  assert.throws(
    () => validateTranslationRecord(translationRecord(source, {
      description: "10% 피해를 3분 동안 주고 5레벨에서 무게는 2kg이며 속도는 4×이다."
    }), "ko", sourceByIdentity, new Set(), "candidate"),
    /인접 단위/u,
  );
});

test("신규 import 이름 gate는 대표 오류 문자열을 차단하지만 legacy record validator는 계속 감사할 수 있다", () => {
  const cases = [
    { locale: "ko", text: "회사 소개" },
    { locale: "ko", text: "지금 연락" },
    { locale: "ja", text: "クアッドマックス" },
    { locale: "ja", text: "夏期マックス" },
    { locale: "ja", text: "サドル。" },
  ];
  for (const { locale, text } of cases) {
    const source = sourceRecord({ description: undefined });
    const sourceByIdentity = new Map([["item:test-item", source]]);
    const candidate = translationRecord(source, { name: text });
    assert.doesNotThrow(
      () => validateTranslationRecord(candidate, locale, sourceByIdentity, new Set(), "candidate"),
    );
    const validated = validateTranslationRecord(candidate, locale, sourceByIdentity, new Set(), "candidate");
    assert.throws(
      () => assertStrictMachineNameQualityForImport([validated], locale, [source], new Map()),
      /금지된 기계 보조 번역 문자열/u,
    );
  }
});

test("신규 import 이름 gate는 서로 다른 영어 이름이 동일한 machine locale 이름으로 붕괴하는 것을 차단한다", () => {
  const firstSource = sourceRecord({ id: "first-item", name: "First Item", description: undefined });
  const secondSource = sourceRecord({ id: "second-item", name: "Second Item", description: undefined });
  const sources = [firstSource, secondSource];
  const sourceByIdentity = new Map(sources.map((source) => [`${source.kind}:${source.id}`, source]));
  const records = sources.map((source) => validateTranslationRecord(
    translationRecord(source, { name: "같은 아이템" }),
    "ko",
    sourceByIdentity,
    new Set(),
    `candidate.${source.id}`,
  ));
  assert.throws(
    () => assertStrictMachineNameQualityForImport(records, "ko", sources, new Map()),
    /서로 다른 영어 원문이 같은 ko 기계 이름/u,
  );
});

test("신규 import 이름 gate는 구조 토큰과 canonical Pal 검수 이름을 보존한다", () => {
  const lamball = sourceRecord({ id: "lamball", kind: "pal", name: "Lamball", description: undefined });
  const reviewedNames = new Map([
    ["ko:pal:lamball", "도로롱"],
    ["ja:pal:lamball", "モコロン"],
  ]);
  const structureCases = [
    { english: "Lamball Saddle Schematic 2", ko: "도로롱 안장 설계도 2", ja: "モコロンのサドル設計図2" },
    { english: "Lamball Ring 1", ko: "도로롱 반지 1", ja: "モコロンの指輪1" },
    { english: "Lamball Meat", ko: "도로롱 고기", ja: "モコロンの肉" },
    { english: "Lamball Egg", ko: "도로롱 알", ja: "モコロンの卵" },
    { english: "Lamball Charm", ko: "도로롱 부적", ja: "モコロンのお守り" },
    { english: "Lamball Sphere", ko: "도로롱 스피어", ja: "モコロンのスフィア" },
  ];
  for (const [index, entry] of structureCases.entries()) {
    const source = sourceRecord({
      id: `structured-${index}`,
      name: entry.english,
      description: undefined,
    });
    const corpus = [lamball, source];
    const sourceByIdentity = new Map(corpus.map((record) => [`${record.kind}:${record.id}`, record]));
    for (const locale of ["ko", "ja"]) {
      const validated = validateTranslationRecord(
        translationRecord(source, { name: entry[locale] }),
        locale,
        sourceByIdentity,
        new Set(),
        "candidate",
      );
      assert.doesNotThrow(
        () => assertStrictMachineNameQualityForImport([validated], locale, corpus, reviewedNames),
      );
    }
  }

  const saddle = sourceRecord({ id: "bad-saddle", name: "Lamball Saddle", description: undefined });
  const corpus = [lamball, saddle];
  const sourceByIdentity = new Map(corpus.map((record) => [`${record.kind}:${record.id}`, record]));
  const missingPal = validateTranslationRecord(
    translationRecord(saddle, { name: "램볼 안장" }),
    "ko",
    sourceByIdentity,
    new Set(),
    "candidate",
  );
  assert.throws(
    () => assertStrictMachineNameQualityForImport([missingPal], "ko", corpus, reviewedNames),
    /canonical Pal lamball/u,
  );
  const missingToken = validateTranslationRecord(
    translationRecord(saddle, { name: "도로롱 탈것" }),
    "ko",
    sourceByIdentity,
    new Set(),
    "candidate",
  );
  assert.throws(
    () => assertStrictMachineNameQualityForImport([missingToken], "ko", corpus, reviewedNames),
    /구조 토큰 Saddle/u,
  );
});

test("검수된 Pal 이름은 glossary 값과 정확히 일치해야 한다", () => {
  const source = sourceRecord({ id: "lamball", kind: "pal", name: "Lamball", description: undefined });
  const sourceByIdentity = new Map([["pal:lamball", source]]);
  const reviewedNames = new Map([["ko:pal:lamball", "도로롱"]]);
  const candidate = translationRecord(source, { name: "도로롱", status: "human_reviewed" });
  assert.doesNotThrow(() => validateTranslationRecord(candidate, "ko", sourceByIdentity, new Set(), "candidate", reviewedNames));
  assert.throws(
    () => validateTranslationRecord(translationRecord(source, { name: "램볼", status: "human_reviewed" }), "ko", sourceByIdentity, new Set(), "candidate", reviewedNames),
    /glossary 이름/u,
  );
});

test("검수된 item 이름도 exact kind:id로 human-reviewed seed에 고정한다", () => {
  const source = sourceRecord({ id: "wood", kind: "item", name: "Wood", description: undefined });
  const sourceByIdentity = new Map([["item:wood", source]]);
  const reviewedNames = new Map([
    ["ko:item:wood", "목재"],
    ["ja:item:wood", "木材"],
  ]);
  const human = translationRecord(source, { name: "목재", status: "human_reviewed" });
  assert.doesNotThrow(() => validateTranslationRecord(human, "ko", sourceByIdentity, new Set(), "candidate", reviewedNames));
  assert.doesNotThrow(() => assertReviewedNameRecords([human], "ko", reviewedNames));
  assert.throws(
    () => assertReviewedNameRecords([translationRecord(source, { name: "나무", status: "machine_assisted" })], "ko", reviewedNames),
    /human_reviewed glossary/u,
  );
});

test("영문 원문이 검수된 glossary 용어와 정확히 일치하면 locale 용어를 강제한다", () => {
  const source = sourceRecord({ id: "fire-item", name: "Fire", description: undefined });
  const sourceByIdentity = new Map([["item:fire-item", source]]);
  const reviewedTerms = new Map([["ko:Fire", "불"]]);
  assert.doesNotThrow(() => validateTranslationRecord(
    translationRecord(source, { name: "불" }),
    "ko",
    sourceByIdentity,
    new Set(),
    "candidate",
    new Map(),
    reviewedTerms,
  ));
  assert.throws(
    () => validateTranslationRecord(
      translationRecord(source, { name: "화염" }),
      "ko",
      sourceByIdentity,
      new Set(),
      "candidate",
      new Map(),
      reviewedTerms,
    ),
    /glossary 용어/u,
  );
  const compoundSource = sourceRecord({ id: "fire-bow", name: "Fire Bow", description: undefined });
  const compoundMap = new Map([["item:fire-bow", compoundSource]]);
  assert.doesNotThrow(() => validateTranslationRecord(
    translationRecord(compoundSource, { name: "불의 활" }),
    "ko",
    compoundMap,
    new Set(),
    "candidate",
    new Map(),
    reviewedTerms,
  ));
  assert.throws(() => validateTranslationRecord(
    translationRecord(compoundSource, { name: "화염의 활" }),
    "ko",
    compoundMap,
    new Set(),
    "candidate",
    new Map(),
    reviewedTerms,
  ), /Fire → 불/u);
});

test("placeholder 손상 원문은 locale marker와 안전 note 없이 번역할 수 없다", () => {
  const damaged = "Can be crafted at .\nWhen in inventory, unlocks recipe for ().";
  const anomaly = analyzeTranslationSource(damaged);
  assert.deepEqual(anomaly, {
    codes: ["empty_parentheses", "missing_value_before_period"],
    missingSlotCount: 2,
  });
  const source = sourceRecord({ description: damaged });
  const sourceByIdentity = new Map([["item:test-item", source]]);
  const marker = PALWORLD_TRANSLATION_MISSING_SOURCE_MARKER.ko;
  const safeCandidate = translationRecord(source, {
    description: `제작 위치: ${marker}. 소지하면 ${marker} 레시피를 해금한다.`,
    note: `offline-model; ${PALWORLD_TRANSLATION_SOURCE_ANOMALY_NOTE}`,
  });
  assert.doesNotThrow(() => validateTranslationRecord(safeCandidate, "ko", sourceByIdentity, new Set(), "candidate"));
  assert.throws(
    () => validateTranslationRecord(translationRecord(source, { description: `제작 위치: ${marker}.`, note: PALWORLD_TRANSLATION_SOURCE_ANOMALY_NOTE }), "ko", sourceByIdentity, new Set(), "candidate"),
    /2개 누락 위치/u,
  );
  assert.throws(
    () => validateTranslationRecord(translationRecord(source, { description: `${marker} ${marker}` }), "ko", sourceByIdentity, new Set(), "candidate"),
    /source_anomaly_preserved note/u,
  );
  assert.throws(
    () => validateTranslationRecord(translationRecord(source, { description: `${marker} ${marker} ${marker}`, note: PALWORLD_TRANSLATION_SOURCE_ANOMALY_NOTE }), "ko", sourceByIdentity, new Set(), "candidate"),
    /정확히 일치/u,
  );
  assert.throws(
    () => validateTranslationRecord(translationRecord(source, { description: `XQZVALUEXQZ ${marker} ${marker}`, note: PALWORLD_TRANSLATION_SOURCE_ANOMALY_NOTE }), "ko", sourceByIdentity, new Set(), "candidate"),
    /중간 placeholder/u,
  );
});

test("candidate 병합은 batch 순서와 무관하고 human-reviewed를 우선한다", () => {
  const sourceA = sourceRecord({ id: "a-item" });
  const sourceB = sourceRecord({ id: "b-item" });
  const machineA = translationRecord(sourceA, { name: "기계 A", description: "기계 설명 A" });
  const reviewedA = translationRecord(sourceA, { name: "검수 A", description: "검수 설명 A", status: "human_reviewed" });
  const machineB = translationRecord(sourceB, { name: "기계 B", description: "기계 설명 B" });
  const forward = mergeTranslationRecords([machineA, machineB, reviewedA]);
  const reverse = mergeTranslationRecords([reviewedA, machineB, machineA]);
  assert.equal(stableJson(forward), stableJson(reverse));
  assert.equal(forward[0].id, "a-item");
  assert.equal(forward[0].fields.name.text, "검수 A");
  assert.throws(
    () => mergeTranslationRecords([machineA, translationRecord(sourceA, { name: "서로 다른 A", description: "기계 설명 A" })]),
    /같은 우선순위/u,
  );
});

test("최종 snapshot record는 중복 없이 canonical 순서여야 한다", () => {
  const first = translationRecord(sourceRecord({ id: "a-item" }));
  const second = translationRecord(sourceRecord({ id: "b-item" }));
  assert.doesNotThrow(() => assertUniqueSortedTranslationRecords([first, second]));
  assert.throws(() => assertUniqueSortedTranslationRecords([first, first]), /중복 canonical ID/u);
  assert.throws(() => assertUniqueSortedTranslationRecords([second, first]), /정렬/u);
});

test("모든 이름 충돌은 명시적인 ID별 override를 요구한다", () => {
  const corpus = [
    sourceRecord({ id: "a", name: "Shared Name", description: undefined }),
    sourceRecord({ id: "b", name: "Shared Name", description: undefined }),
  ];
  const collisions = translationNameCollisions(corpus);
  const artifact = {
    schemaVersion: 1,
    release: "1.0.1",
    generatedAt: "2026-07-22T00:00:00.000Z",
    overrides: [{
      kind: "item",
      english: "Shared Name",
      ids: ["a", "b"],
      resolution: "translate_each_canonical_id",
      reason: "서로 다른 canonical ID이므로 자동 전파하지 않는다.",
    }],
  };
  assert.equal(validateNameCollisionOverrides(collisions, artifact).length, 1);
  assert.throws(() => validateNameCollisionOverrides(collisions, { ...artifact, overrides: [] }), /override가 누락/u);
  assert.throws(
    () => validateNameCollisionOverrides(collisions, { ...artifact, overrides: [{ ...artifact.overrides[0], ids: ["b", "a"] }] }),
    /ids 순서/u,
  );
});

test("고정 corpus와 source batch manifest는 checksum과 canonical 순서를 보존한다", async () => {
  const [corpusBytes, manifestBytes, glossaryBytes, reportBytes, overridesBytes] = await Promise.all([
    readFile(path.join(localeRoot, "corpus.json")),
    readFile(path.join(localeRoot, "corpus-manifest.json")),
    readFile(path.join(localeRoot, "glossary.json")),
    readFile(path.join(localeRoot, "corpus-report.json")),
    readFile(path.join(localeRoot, "glossary-overrides.json")),
  ]);
  const corpus = JSON.parse(corpusBytes.toString("utf8"));
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const glossary = JSON.parse(glossaryBytes.toString("utf8"));
  const report = JSON.parse(reportBytes.toString("utf8"));
  assert.equal(manifest.corpusSha256, sha256(corpusBytes));
  assert.equal(manifest.glossarySha256, sha256(glossaryBytes));
  assert.equal(manifest.glossaryOverridesSha256, sha256(overridesBytes));
  assert.equal(manifest.reportSha256, sha256(reportBytes));
  assert.equal(report.sourceQuality.policy, "preserve_missing_source_marker");
  assert.equal(report.sourceQuality.anomalousFields > 0, true);
  assert.equal(report.sourceQuality.missingSlots >= report.sourceQuality.anomalousFields, true);
  validateNameCollisionOverrides(glossary.nameCollisions, JSON.parse(overridesBytes.toString("utf8")));
  assert.equal(glossary.reviewedNames.filter((entry) => entry.kind === "pal").length, 287);
  assert.deepEqual(
    glossary.reviewedNames.filter((entry) => entry.kind === "item").map((entry) => entry.id),
    [
      "copper-ingot",
      "copper-ore",
      "fiber",
      "leather",
      "pal-crystal-ex",
      "pal-crystal-s",
      "pal-sphere",
      "pal-sphere-mega",
      "stone",
      "wood",
    ]
  );
  for (const locale of ["ko", "ja"]) {
    const seed = JSON.parse(await readFile(path.join(localeRoot, "candidates", locale, "batch-0000.json"), "utf8"));
    assert.equal(seed.records.filter((entry) => entry.kind === "item").length, 10);
    assert.equal(seed.records.every((entry) => entry.fields.name.status === "human_reviewed"), true);
  }

  const batchedRecords = [];
  for (const [index, entry] of manifest.batches.entries()) {
    const bytes = await readFile(path.join(localeRoot, "source-batches", entry.name));
    const batch = JSON.parse(bytes.toString("utf8"));
    assert.equal(entry.name, `batch-${String(index + 1).padStart(4, "0")}.json`);
    assert.equal(entry.sha256, sha256(bytes));
    assert.equal(batch.batchIndex, index + 1);
    assert.equal(batch.records.length <= manifest.batchSize, true);
    batchedRecords.push(...batch.records);
  }
  assert.equal(stableJson(batchedRecords), stableJson(corpus.records));
  const identities = corpus.records.map((record) => `${record.kind}:${record.id}`);
  assert.deepEqual(identities, [...identities].sort((left, right) => left.localeCompare(right, "en")));
});

test("검수 아이템 alias는 release·canonical ID·sourceInternalId·영문 이름을 exact 검증한다", async () => {
  const [catalog, aliases] = await Promise.all([
    readFile(path.join(serverRoot, "data", "palworld", "1.0.1", "catalog.json"), "utf8").then(JSON.parse),
    readFile(path.join(localeRoot, "reviewed-item-aliases.json"), "utf8").then(JSON.parse),
  ]);
  const validated = validatePalworldReviewedItemAliases(aliases, catalog);
  assert.equal(validated.length, 5);
  assert.equal(validated.every((entry) => entry.release === "1.0.1"), true);
  assert.deepEqual(validated.map((entry) => entry.canonicalId), [
    "copper-ingot",
    "copper-ore",
    "pal-crystal-ex",
    "pal-crystal-s",
    "pal-sphere-mega",
  ]);
  const tampered = structuredClone(aliases);
  tampered.aliases[0].sourceInternalId = "WrongInternalId";
  assert.throws(
    () => validatePalworldReviewedItemAliases(tampered, catalog),
    /sourceInternalId·영문 이름/u,
  );
  assert.throws(
    () => validatePalworldReviewedItemAliases({ ...aliases, release: "latest" }, catalog),
    /header/u,
  );
  const mismatchedEntryRelease = structuredClone(aliases);
  mismatchedEntryRelease.aliases[0].release = "latest";
  assert.throws(
    () => validatePalworldReviewedItemAliases(mismatchedEntryRelease, catalog),
    /현재 catalog release/u,
  );
  assert.throws(
    () => validatePalworldReviewedItemAliases({ ...aliases, unexpected: true }, catalog),
    /허용되지 않은 필드/u,
  );
});
