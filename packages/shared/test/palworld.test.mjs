import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  assertPalworldDataSnapshot,
  validatePalworldBreedingDataSnapshot,
  validatePalworldBreedingParentsResponse,
  validatePalworldBreedingResultResponse,
  validatePalworldCompositeRuntimeManifest,
  validatePalworldDataCoverage,
  validatePalworldDataMetadata,
  validatePalworldDataSnapshot,
  validatePalworldElementDefinition,
  validatePalworldItemDetail,
  validatePalworldMetaResponse,
  validatePalworldItemSummary,
  validatePalworldLocalizationFallback,
  validatePalworldReleaseIdentity,
  validatePalworldPalDrop,
  validatePalworldPaginatedResponse,
  validatePalworldPalDetail,
  validatePalworldPalListFacets,
  validatePalworldPalListResponse,
  validatePalworldPalSummary,
  validatePalworldSearchResult,
  validatePalworldSkill,
  validatePalworldSkillAssignment,
  validatePalworldSkillDetail,
  validatePalworldSkillSummary,
  validatePalworldTranslationSnapshot
} from "../dist/index.js";

const metadata = {
  gameVersion: "0.6.2",
  release: "0.6.2",
  steamBuildId: "12345678",
  sourceName: "StreamOps Palworld 정규화 스냅샷",
  sourceUrl: "https://github.com/tylercamp/palcalc",
  sourceRevision: "test-revision",
  extractedAt: "2026-07-20T00:00:00.000Z",
  verifiedAt: "2026-07-21T00:00:00.000Z",
  license: "MIT (교배 데이터), 자체 보유 게임 데이터 (나머지 데이터)"
};

const searchDomains = {
  pals: { status: "ready", recordCount: 1, metadata },
  items: { status: "sample", recordCount: 1, metadata }
};

const palImageHash = "a".repeat(64);
const palImageUrl = `/images/palworld/${metadata.gameVersion}/pals/${palImageHash}.webp`;
const itemImageHash = "b".repeat(64);
const itemImageUrl = `/images/palworld/${metadata.gameVersion}/items/${itemImageHash}.webp`;
const elementImageHash = "c".repeat(64);
const elementImageUrl = `/images/palworld/${metadata.gameVersion}/elements/${elementImageHash}.webp`;

const englishFallback = {
  sourceLanguage: "en",
  ko: "source_language_fallback",
  ja: "source_language_fallback"
};

const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");

const translationSource = {
  release: "1.0.1",
  sourceCatalogSha256: "d".repeat(64),
  sourcePaldexSha256: "e".repeat(64),
  sourceRevision: "translation-source-revision",
  records: [
    {
      id: "test-item",
      kind: "item",
      fields: {
        name: { text: "Test Item", sha256: sha256("Test Item") },
        description: { text: "A safe test item.", sha256: sha256("A safe test item.") }
      }
    },
    {
      id: "test-skill",
      kind: "skill",
      fields: {
        name: { text: "Test Skill", sha256: sha256("Test Skill") },
        description: { text: "A safe test skill.", sha256: sha256("A safe test skill.") },
        passiveAbility: { text: "Attack +10%", sha256: sha256("Attack +10%") }
      }
    }
  ]
};

const translationSnapshot = {
  schemaVersion: 1,
  release: translationSource.release,
  locale: "ko",
  sourceCatalogSha256: translationSource.sourceCatalogSha256,
  sourcePaldexSha256: translationSource.sourcePaldexSha256,
  sourceRevision: translationSource.sourceRevision,
  translationRevision: "test-translation-v1",
  translationMethod: "machine_assisted",
  translationStatus: "complete",
  translatedAt: "2026-07-22T00:00:00.000Z",
  reviewedAt: null,
  records: [
    {
      id: "test-item",
      kind: "item",
      fields: {
        name: {
          sourceSha256: sha256("Test Item"),
          text: "테스트 아이템",
          status: "machine_assisted"
        },
        description: {
          sourceSha256: sha256("A safe test item."),
          text: "안전한 테스트 아이템이다.",
          status: "machine_assisted"
        }
      }
    },
    {
      id: "test-skill",
      kind: "skill",
      fields: {
        name: {
          sourceSha256: sha256("Test Skill"),
          text: "테스트 스킬",
          status: "machine_assisted"
        },
        description: {
          sourceSha256: sha256("A safe test skill."),
          text: "안전한 테스트 스킬이다.",
          status: "machine_assisted"
        },
        passiveAbility: {
          sourceSha256: sha256("Attack +10%"),
          text: "공격력 +10%",
          status: "machine_assisted"
        }
      }
    }
  ]
};

test("KO·JA 번역 snapshot은 canonical source와 필드별 상태를 엄격하게 검증한다", () => {
  assert.equal(validatePalworldTranslationSnapshot(translationSnapshot, translationSource).ok, true);
  assert.equal(validatePalworldTranslationSnapshot({
    ...translationSnapshot,
    locale: "ja",
    records: translationSnapshot.records.map((record) => ({
      ...record,
      fields: Object.fromEntries(Object.entries(record.fields).map(([field, value]) => [
        field,
        { ...value, text: `日本語訳-${record.id}-${field}${field === "passiveAbility" ? "-10%" : ""}` }
      ]))
    }))
  }, translationSource).ok, true);
  assert.equal(validatePalworldTranslationSnapshot({ ...translationSnapshot, locale: "en" }, translationSource).ok, false);
  assert.equal(validatePalworldTranslationSnapshot({ ...translationSnapshot, unexpected: true }, translationSource).ok, false);
});

test("번역 snapshot은 중복·orphan·stale hash·원문 없는 필드·완료 누락을 차단한다", () => {
  const duplicate = structuredClone(translationSnapshot);
  duplicate.records.push(structuredClone(duplicate.records[1]));
  assert.equal(validatePalworldTranslationSnapshot(duplicate, translationSource).ok, false);

  const orphan = structuredClone(translationSnapshot);
  orphan.records[0].id = "orphan-item";
  assert.equal(validatePalworldTranslationSnapshot(orphan, translationSource).ok, false);

  const stale = structuredClone(translationSnapshot);
  stale.records[0].fields.name.sourceSha256 = "f".repeat(64);
  assert.equal(validatePalworldTranslationSnapshot(stale, translationSource).ok, false);

  const sourceMissing = structuredClone(translationSnapshot);
  sourceMissing.records[0].fields.passiveAbility = {
    sourceSha256: sha256("unknown"),
    text: "추정하지 않은 값",
    status: "machine_assisted"
  };
  assert.equal(validatePalworldTranslationSnapshot(sourceMissing, translationSource).ok, false);

  const incomplete = structuredClone(translationSnapshot);
  delete incomplete.records[1].fields.description;
  assert.equal(validatePalworldTranslationSnapshot(incomplete, translationSource).ok, false);
  assert.equal(validatePalworldTranslationSnapshot({ ...translationSnapshot, release: "9.9.9" }, translationSource).ok, false);
});

test("번역 snapshot은 영문 복사·HTML·제어문자·잘못된 상태를 차단하고 exact glossary 예외만 허용한다", () => {
  const copied = structuredClone(translationSnapshot);
  copied.records[0].fields.name.text = "Test Item";
  assert.equal(validatePalworldTranslationSnapshot(copied, translationSource).ok, false);
  assert.equal(validatePalworldTranslationSnapshot(copied, {
    ...translationSource,
    englishCopyAllowlist: ["item:test-item:name"]
  }).ok, true);
  assert.equal(validatePalworldTranslationSnapshot(copied, {
    ...translationSource,
    englishCopyAllowlist: ["item:missing:name"]
  }).ok, false);

  for (const text of ["<script>alert(1)</script>", "javascript:alert(1)", "제어\u0001문자"] ) {
    const unsafe = structuredClone(translationSnapshot);
    unsafe.records[0].fields.description.text = text;
    assert.equal(validatePalworldTranslationSnapshot(unsafe, translationSource).ok, false, text);
  }
  const invalidStatus = structuredClone(translationSnapshot);
  invalidStatus.records[0].fields.name.status = "official";
  assert.equal(validatePalworldTranslationSnapshot(invalidStatus, translationSource).ok, false);

  const changedNumber = structuredClone(translationSnapshot);
  changedNumber.records[1].fields.passiveAbility.text = "공격력 +20%";
  assert.equal(validatePalworldTranslationSnapshot(changedNumber, translationSource).ok, false);
});

test("번역 snapshot은 숫자 등장 순서와 숫자-단위 결합을 보존한다", () => {
  const sourceText = "Deals 10% damage for 3 seconds at Lv. 5 and weighs 2 kg at 4x speed.";
  const source = {
    release: "1.0.1",
    sourceCatalogSha256: "a".repeat(64),
    sourcePaldexSha256: "b".repeat(64),
    sourceRevision: "numeric-units-v1",
    records: [{
      id: "numeric-item",
      kind: "item",
      fields: { description: { text: sourceText, sha256: sha256(sourceText) } }
    }]
  };
  const snapshotWith = (text) => ({
    schemaVersion: 1,
    release: source.release,
    locale: "ko",
    sourceCatalogSha256: source.sourceCatalogSha256,
    sourcePaldexSha256: source.sourcePaldexSha256,
    sourceRevision: source.sourceRevision,
    translationRevision: "numeric-units-translation-v1",
    translationMethod: "machine_assisted",
    translationStatus: "complete",
    translatedAt: "2026-07-22T00:00:00.000Z",
    reviewedAt: null,
    records: [{
      id: "numeric-item",
      kind: "item",
      fields: {
        description: {
          sourceSha256: sha256(sourceText),
          text,
          status: "machine_assisted"
        }
      }
    }]
  });
  assert.equal(validatePalworldTranslationSnapshot(
    snapshotWith("10% 피해를 3초 동안 주고 5레벨에서 무게는 2kg이며 속도는 4×이다."),
    source
  ).ok, true);
  assert.equal(validatePalworldTranslationSnapshot(
    snapshotWith("3초 동안 10% 피해를 주고 5레벨에서 무게는 2kg이며 속도는 4×이다."),
    source
  ).ok, false);
  assert.equal(validatePalworldTranslationSnapshot(
    snapshotWith("10% 피해를 3분 동안 주고 5레벨에서 무게는 2kg이며 속도는 4×이다."),
    source
  ).ok, false);
  assert.equal(validatePalworldTranslationSnapshot(
    snapshotWith("10% 피해를 3초 동안 주고 5레벨에서 무게는 2이며 속도는 4×이다."),
    source
  ).ok, false);
});

test("Shared 번역 snapshot validator는 runtime locale script와 길이·반복·절 유실 퇴행을 차단한다", () => {
  const sourceText = "The first clause explains the primary effect of this item in enough detail to be meaningful. The second clause describes an important limitation that must remain visible. The third clause states how the effect ends and why the player should care.";
  const source = {
    release: "1.0.1",
    sourceCatalogSha256: "a".repeat(64),
    sourcePaldexSha256: "b".repeat(64),
    sourceRevision: "quality-gate-v1",
    records: [{
      id: "quality-item",
      kind: "item",
      fields: { description: { text: sourceText, sha256: sha256(sourceText) } }
    }]
  };
  const snapshotWith = (text, { locale = "ko", status = "machine_assisted" } = {}) => ({
    schemaVersion: 1,
    release: source.release,
    locale,
    sourceCatalogSha256: source.sourceCatalogSha256,
    sourcePaldexSha256: source.sourcePaldexSha256,
    sourceRevision: source.sourceRevision,
    translationRevision: "quality-gate-translation-v1",
    translationMethod: status,
    translationStatus: "complete",
    translatedAt: "2026-07-22T00:00:00.000Z",
    reviewedAt: status === "human_reviewed" ? "2026-07-22T00:00:00.000Z" : null,
    records: [{
      id: "quality-item",
      kind: "item",
      fields: {
        description: { sourceSha256: sha256(sourceText), text, status }
      }
    }]
  });

  assert.equal(validatePalworldTranslationSnapshot(snapshotWith("Translated text without target script."), source).ok, false);
  assert.equal(validatePalworldTranslationSnapshot(snapshotWith("Reviewed English wording.", { status: "human_reviewed" }), source).ok, true);
  assert.equal(validatePalworldTranslationSnapshot(snapshotWith("일본어 문자가 없는 번역이다.", { locale: "ja" }), source).ok, false);
  assert.equal(validatePalworldTranslationSnapshot(snapshotWith("三つの節を保った自然な日本語の説明であり、元の情報を省略せずに伝える。重要な制限も示し、効果が終了する条件も説明する。", { locale: "ja" }), source).ok, true);
  assert.equal(validatePalworldTranslationSnapshot(snapshotWith("가나다가나다가나다가나다"), source).ok, false);
  assert.equal(validatePalworldTranslationSnapshot(snapshotWith("설명이 대부분 유실되었다."), source).ok, false);

  const longSourceText = "This source sentence has enough content.";
  const longSource = {
    ...source,
    records: [{
      id: "quality-item",
      kind: "item",
      fields: { description: { text: longSourceText, sha256: sha256(longSourceText) } }
    }]
  };
  const expanded = "이 번역문은 원문의 의미보다 불필요하게 길어졌으며 관련 없는 표현을 계속 추가하여 검증 기준을 넘는다. 또한 전혀 필요하지 않은 문장을 여러 방식으로 이어 붙여 원문보다 지나치게 큰 결과를 의도적으로 만든다. 마지막으로 또 다른 무관한 설명을 덧붙여 품질 저하를 확실히 재현한다.";
  const expandedSnapshot = snapshotWith(expanded);
  expandedSnapshot.records[0].fields.description.sourceSha256 = sha256(longSourceText);
  assert.equal(validatePalworldTranslationSnapshot(expandedSnapshot, longSource).ok, false);

  const exactEnglishSource = {
    ...source,
    records: [{
      id: "quality-item",
      kind: "item",
      fields: { description: { text: "Keep As English", sha256: sha256("Keep As English") } }
    }]
  };
  const allowlisted = snapshotWith("Keep As English");
  allowlisted.records[0].fields.description.sourceSha256 = sha256("Keep As English");
  assert.equal(validatePalworldTranslationSnapshot(allowlisted, {
    ...exactEnglishSource,
    englishCopyAllowlist: ["item:quality-item:description"]
  }).ok, true);
});

test("손상된 영어 source의 누락 슬롯은 locale marker와 고정 note로 보존해야 한다", () => {
  const sourceText = "Increases attack by  . Leaves ().";
  const source = {
    release: "1.0.1",
    sourceCatalogSha256: "a".repeat(64),
    sourcePaldexSha256: "b".repeat(64),
    sourceRevision: "source-anomaly-v1",
    records: [{
      id: "anomalous-skill",
      kind: "skill",
      fields: { description: { text: sourceText, sha256: sha256(sourceText) } }
    }]
  };
  const snapshotWith = (text, note) => ({
    schemaVersion: 1,
    release: source.release,
    locale: "ko",
    sourceCatalogSha256: source.sourceCatalogSha256,
    sourcePaldexSha256: source.sourcePaldexSha256,
    sourceRevision: source.sourceRevision,
    translationRevision: "source-anomaly-translation-v1",
    translationMethod: "machine_assisted",
    translationStatus: "complete",
    translatedAt: "2026-07-22T00:00:00.000Z",
    reviewedAt: null,
    records: [{
      id: "anomalous-skill",
      kind: "skill",
      fields: {
        description: {
          sourceSha256: sha256(sourceText),
          text,
          status: "machine_assisted",
          ...(note === undefined ? {} : { note })
        }
      }
    }]
  });
  assert.equal(validatePalworldTranslationSnapshot(
    snapshotWith("공격력이 [원문 누락] 증가한다. [원문 누락]을 남긴다."),
    source
  ).ok, false);
  assert.equal(validatePalworldTranslationSnapshot(
    snapshotWith("공격력이 [원문 누락] 증가한다.", "source_anomaly_preserved"),
    source
  ).ok, false);
  assert.equal(validatePalworldTranslationSnapshot(
    snapshotWith("공격력이 [원문 누락] 증가한다. [원문 누락]을 남긴다.", "source_anomaly_preserved"),
    source
  ).ok, true);
  assert.equal(validatePalworldTranslationSnapshot(
    snapshotWith("[원문 누락] 공격력이 [원문 누락] 증가한다. [원문 누락]을 남긴다.", "source_anomaly_preserved"),
    source
  ).ok, false);
  assert.equal(validatePalworldTranslationSnapshot(
    snapshotWith("공격력이 XQZVALUEXQZ 증가한다. [원문 누락] [원문 누락]", "source_anomaly_preserved"),
    source
  ).ok, false);
});

const palReference = {
  id: "anubis",
  number: 100,
  nameKo: "아누비스",
  nameJa: "アヌビス",
  nameEn: "Anubis",
  imageUrl: palImageUrl,
  elements: ["ground"]
};

const itemReference = {
  id: "pal_sphere",
  nameKo: "팰 스피어",
  nameJa: "パルスフィア",
  nameEn: "Pal Sphere",
  imageUrl: itemImageUrl
};

const pal = {
  ...palReference,
  rarity: 10,
  variantType: "normal",
  workSuitabilities: [
    { type: "handiwork", level: 4 },
    { type: "mining", level: 3 }
  ],
  stats: { hp: 120, attack: 130, defense: 100, moveSpeed: 800, stamina: 100 },
  nocturnal: false,
  partnerSkill: {
    id: "guardian_of_the_desert",
    type: "partner",
    nameKo: "사막의 수호신",
    nameJa: "砂漠の守護神",
    nameEn: "Guardian of the Desert",
    descriptionKo: "함께 싸우는 동안 플레이어에게 땅 속성을 부여합니다.",
    descriptionJa: "共に戦っている間、プレイヤーの攻撃に地属性を付与します。",
    element: "ground"
  },
  activeSkills: [],
  drops: [itemReference],
  breeding: { breedingPower: 570, specialParentPairs: [{ parentAId: "anubis", parentBId: "anubis" }] },
  metadata
};

const item = {
  ...itemReference,
  category: "sphere",
  rarity: 1,
  descriptionKo: "Pal을 포획하는 데 사용하는 기본 스피어입니다.",
  descriptionJa: "パルを捕獲するための基本的なスフィアです。",
  descriptionEn: "A basic sphere used to capture Pals.",
  sellPrice: 10,
  technologyLevel: 2,
  craftingMaterials: [{ item: itemReference, quantity: 1 }],
  craftingFacility: {
    id: "primitive_workbench",
    nameKo: "원시 작업대",
    nameJa: "原始的な作業台",
    nameEn: "Primitive Workbench"
  },
  dropPals: [palReference],
  acquisitionMethods: [
    {
      type: "craft",
      labelKo: "원시 작업대에서 제작",
      labelJa: "原始的な作業台で作成",
      labelEn: "Craft at a Primitive Workbench"
    }
  ],
  relatedItems: [],
  metadata
};

const breedingPair = {
  id: "anubis-anubis-anubis",
  parentA: palReference,
  parentB: palReference,
  child: palReference,
  isSpecial: false
};

const activeSkill = {
  id: "sand-blast-ground-40-4",
  type: "active",
  nameEn: "Sand Blast",
  descriptionEn: "Hurls sticky mud at an enemy.",
  element: "ground",
  power: 40,
  cooldownSeconds: 4,
  localization: englishFallback
};

const activeSkillDetail = {
  ...activeSkill,
  relatedPalCount: 1,
  relatedPals: [{ pal: palReference, unlockLevel: 1 }],
  metadata
};

test("원본에 설명이 없는 스킬은 이름 fallback 상태를 유지한 채 검증된다", () => {
  const result = validatePalworldSkill({
    id: "partner-hangyu",
    type: "partner",
    nameEn: "Flying Trapeze",
    localization: englishFallback
  });
  assert.equal(result.ok, true, result.ok ? "" : result.error);
});

const elementDefinition = {
  id: "ground",
  nameKo: "땅",
  nameJa: "地",
  nameEn: "Ground",
  iconUrl: elementImageUrl,
  imageWidth: 64,
  imageHeight: 64
};

const coverage = {
  palDetails: { available: 1, missing: 0, total: 1 },
  itemDetails: { available: 1, missing: 0, total: 1 },
  skillDetails: { available: 1, missing: 0, total: 1 },
  palDescriptions: { available: 0, missing: 1, total: 1 },
  palStats: { available: 1, missing: 0, total: 1 },
  partnerSkills: { available: 1, missing: 0, total: 1 },
  activeSkills: { available: 0, missing: 1, total: 1 },
  palDrops: { available: 1, missing: 0, total: 1 },
  breedingFields: { available: 1, missing: 0, total: 1 },
  itemDescriptions: { available: 1, missing: 0, total: 1 },
  craftingRecipes: { available: 1, missing: 0, total: 1 },
  craftingFacilities: { available: 1, missing: 0, total: 1 },
  dropPals: { available: 1, missing: 0, total: 1 },
  technologyLevels: { available: 1, missing: 0, total: 1 },
  prices: { available: 1, missing: 0, total: 1 },
  durability: { available: 0, missing: 1, total: 1 },
  acquisitionMethods: { available: 1, missing: 0, total: 1 },
  skillDescriptions: { available: 1, missing: 0, total: 1 },
  relatedPals: { available: 1, missing: 0, total: 1 },
  palImages: { available: 1, missing: 0, total: 1 },
  itemImages: { available: 1, missing: 0, total: 1 },
  elementImages: { available: 1, missing: 8, total: 9 },
  localization: {
    ko: { available: 2, missing: 1, total: 3 },
    ja: { available: 2, missing: 1, total: 3 },
    en: { available: 3, missing: 0, total: 3 }
  }
};

const snapshot = {
  metadata,
  pals: [pal],
  items: [item],
  breedingPairs: [breedingPair]
};

test("Palworld 메타데이터는 출처와 버전 검증 정보를 요구한다", () => {
  assert.equal(validatePalworldDataMetadata(metadata).ok, true);
  assert.equal(validatePalworldReleaseIdentity({
    gameVersion: metadata.gameVersion,
    release: metadata.release,
    steamBuildId: metadata.steamBuildId,
    sourceRevision: metadata.sourceRevision
  }).ok, true);
  assert.equal(validatePalworldDataMetadata({
    ...metadata,
    sourceChecksum: "d".repeat(64),
    rightsVerified: false
  }).ok, true);
  assert.equal(validatePalworldDataMetadata({ ...metadata, sourceChecksum: "D".repeat(64) }).ok, false);
  assert.equal(validatePalworldDataMetadata({ ...metadata, rightsVerified: "false" }).ok, false);
  assert.equal(validatePalworldDataMetadata({ ...metadata, sourceUrl: "http://example.com/data" }).ok, false);
  assert.equal(validatePalworldDataMetadata({ ...metadata, verifiedAt: "잘못된 날짜" }).ok, false);
  assert.equal(validatePalworldDataMetadata({ ...metadata, verifiedAt: "2026-07-21 00:00:00Z" }).ok, false);
  assert.equal(validatePalworldDataMetadata({
    ...metadata,
    verifiedAt: "2026-07-19T23:59:59.000Z"
  }).ok, false);
  assert.equal(validatePalworldDataMetadata({ ...metadata, release: "잘못된 release" }).ok, false);
  assert.equal(validatePalworldDataMetadata({ ...metadata, steamBuildId: "012345678" }).ok, false);
  assert.equal(validatePalworldDataMetadata({ ...metadata, steamBuildId: undefined }).ok, false);
  assert.equal(validatePalworldDataMetadata({ ...metadata, release: undefined }).ok, false);
  assert.equal(validatePalworldReleaseIdentity({
    gameVersion: metadata.gameVersion,
    release: metadata.release,
    steamBuildId: metadata.steamBuildId,
    sourceRevision: metadata.sourceRevision,
    sourceName: metadata.sourceName
  }).ok, false);
  assert.equal(validatePalworldDataMetadata({ ...metadata, unknown: true }).ok, false);
});

test("composite runtime manifest는 exact artifact·checksum·candidate 상태를 검증한다", () => {
  const composite = {
    schemaVersion: 3,
    release: "1.0.1",
    artifacts: [
      {
        kind: "catalog",
        file: "catalog.json",
        sha256: "a".repeat(64)
      },
      {
        kind: "map-images-manifest",
        file: "map-images-manifest.json",
        sha256: "b".repeat(64)
      }
    ],
    availability: {
      mapMarkers: "candidate",
      mapSpawns: "candidate",
      workImages: "candidate",
      skillImages: "unavailable"
    }
  };
  assert.equal(validatePalworldCompositeRuntimeManifest(composite).ok, true);
  assert.equal(validatePalworldCompositeRuntimeManifest({
    ...composite,
    artifacts: [
      composite.artifacts[0],
      { ...composite.artifacts[1], sha256: composite.artifacts[0].sha256 }
    ]
  }).ok, false);
  assert.equal(validatePalworldCompositeRuntimeManifest({
    ...composite,
    artifacts: [{ ...composite.artifacts[0], file: "../catalog.json" }]
  }).ok, false);
  assert.equal(validatePalworldCompositeRuntimeManifest({
    ...composite,
    availability: { ...composite.availability, mapSpawns: "ready" }
  }).ok, false);
  assert.equal(validatePalworldCompositeRuntimeManifest({
    ...composite,
    unknown: true
  }).ok, false);
});

test("현지화 fallback은 원문 언어와 KO·JA 표시 상태를 엄격하게 검증한다", () => {
  assert.equal(validatePalworldLocalizationFallback(englishFallback).ok, true);
  assert.equal(validatePalworldLocalizationFallback({ ...englishFallback, sourceLanguage: "zh-Hans" }).ok, false);
  assert.equal(validatePalworldLocalizationFallback({ ...englishFallback, ko: "machine_translated" }).ok, false);
  assert.equal(validatePalworldLocalizationFallback({ ...englishFallback, extra: true }).ok, false);
});

test("Palworld meta는 도메인별 coverage와 provenance를 검증한다", () => {
  const {
    release: _activeRelease,
    steamBuildId: _activeSteamBuildId,
    ...legacyMetadata
  } = metadata;
  const sampleMetadata = {
    ...legacyMetadata,
    gameVersion: "sample-baseline",
    sourceRevision: "sample-revision"
  };
  const response = {
    metadata,
    counts: { pals: 287, items: 10, breedingPairs: 3 },
    domains: {
      pals: { status: "ready", recordCount: 287, metadata },
      items: { status: "sample", recordCount: 10, metadata, domainMetadata: sampleMetadata },
      breeding: { status: "sample", recordCount: 3, metadata, domainMetadata: sampleMetadata }
    },
    gates: {
      dataIntegrity: { passed: true, status: "ready" },
      imageAssets: {
        status: "blocked_by_license",
        policyStatus: "missing",
        technicalPassed: false,
        publicActivationAllowed: false,
        rightsVerified: false,
        usageBasis: "none",
        readyImages: 0,
        fallbackPals: 287,
        publicNoticeRequired: true
      }
    }
  };
  assert.equal(validatePalworldMetaResponse(response).ok, true);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    domains: { ...response.domains, pals: { ...response.domains.pals, recordCount: 286 } }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    domains: { ...response.domains, pals: { ...response.domains.pals, metadata: sampleMetadata } }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    domains: {
      ...response.domains,
      pals: {
        ...response.domains.pals,
        metadata: { ...metadata, release: "0.6.3" }
      }
    }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    domains: {
      ...response.domains,
      pals: {
        ...response.domains.pals,
        metadata: { ...metadata, steamBuildId: "12345679" }
      }
    }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    domains: { ...response.domains, items: { ...response.domains.items, status: "complete" } }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    gates: { ...response.gates, imageAssets: { ...response.gates.imageAssets, fallbackPals: 286 } }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    gates: {
      ...response.gates,
      imageAssets: {
        ...response.gates.imageAssets,
        status: "operator_acknowledged",
        policyStatus: "operator_acknowledged",
        technicalPassed: true,
        publicActivationAllowed: true,
        usageBasis: "operator_reference_use",
        readyImages: 287,
        fallbackPals: 0
      }
    }
  }).ok, true);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    gates: {
      ...response.gates,
      imageAssets: {
        ...response.gates.imageAssets,
        policyStatus: "operator_acknowledged",
        usageBasis: "operator_reference_use"
      }
    }
  }).ok, true);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    gates: {
      ...response.gates,
      imageAssets: {
        ...response.gates.imageAssets,
        status: "partial",
        policyStatus: "rights_verified",
        technicalPassed: true,
        publicActivationAllowed: true,
        rightsVerified: true,
        usageBasis: "rights_verified",
        readyImages: 286,
        fallbackPals: 1
      }
    }
  }).ok, true);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    gates: {
      ...response.gates,
      imageAssets: {
        ...response.gates.imageAssets,
        status: "operator_acknowledged",
        policyStatus: "operator_acknowledged",
        technicalPassed: true,
        publicActivationAllowed: true,
        rightsVerified: true,
        usageBasis: "operator_reference_use",
        readyImages: 287,
        fallbackPals: 0
      }
    }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    gates: {
      ...response.gates,
      imageAssets: {
        ...response.gates.imageAssets,
        status: "ready",
        policyStatus: "rights_verified",
        technicalPassed: true,
        publicActivationAllowed: true,
        rightsVerified: false,
        usageBasis: "rights_verified",
        readyImages: 287,
        fallbackPals: 0
      }
    }
  }).ok, false);
});

test("스킬 summary와 detail은 영어 원문 fallback과 관련 Pal 배정을 검증한다", () => {
  const summary = { ...activeSkill, relatedPalCount: 1 };
  assert.equal(validatePalworldSkill(activeSkill).ok, true);
  assert.equal(validatePalworldSkillSummary(summary).ok, true);
  assert.equal(validatePalworldSkillAssignment(activeSkillDetail.relatedPals[0]).ok, true);
  assert.equal(validatePalworldSkillDetail(activeSkillDetail).ok, true);

  const { localization: _localization, ...withoutFallback } = activeSkill;
  assert.equal(validatePalworldSkill(withoutFallback).ok, false);
  assert.equal(validatePalworldSkill({ ...activeSkill, unlockLevel: 1.5 }).ok, false);
  assert.equal(validatePalworldSkill({ ...activeSkill, power: Number.POSITIVE_INFINITY }).ok, false);
  assert.equal(validatePalworldSkill({ ...activeSkill, passiveTier: 2 }).ok, false);
  assert.equal(validatePalworldSkill({ ...activeSkill, unknown: true }).ok, false);
  assert.equal(validatePalworldSkill({
    ...activeSkill,
    nameKo: "모래 돌풍",
    translation: { name: { ko: "source_language_fallback", ja: "source_language_fallback" } }
  }).ok, false);
  assert.equal(validatePalworldSkill({
    id: "partner-invalid-source",
    type: "partner",
    nameEn: "Partner Skill",
    descriptionKo: "영어 원문 없이 만든 설명이다.",
    translation: {
      name: { ko: "source_language_fallback", ja: "source_language_fallback" },
      description: { ko: "machine_assisted", ja: "missing_source" }
    }
  }).ok, false);
  assert.equal(validatePalworldSkillDetail({ ...activeSkillDetail, relatedPalCount: 2 }).ok, false);
  assert.equal(validatePalworldSkillDetail({
    ...activeSkillDetail,
    relatedPalCount: 2,
    relatedPals: [...activeSkillDetail.relatedPals, activeSkillDetail.relatedPals[0]]
  }).ok, false);
  assert.equal(validatePalworldSkillAssignment({ ...activeSkillDetail.relatedPals[0], unlockLevel: 101 }).ok, false);
});

test("속성 정의는 고정 버전 content-hash 아이콘과 이미지 크기 쌍만 허용한다", () => {
  assert.equal(validatePalworldElementDefinition(elementDefinition).ok, true);
  assert.equal(validatePalworldElementDefinition({ ...elementDefinition, iconUrl: itemImageUrl }).ok, false);
  assert.equal(validatePalworldElementDefinition({ ...elementDefinition, imageHeight: undefined }).ok, false);
  assert.equal(validatePalworldElementDefinition({ ...elementDefinition, imageWidth: 0 }).ok, false);
  assert.equal(validatePalworldElementDefinition({ ...elementDefinition, imageWidth: 8_193 }).ok, false);
  assert.equal(validatePalworldElementDefinition({ ...elementDefinition, unknown: true }).ok, false);
});

test("도메인 coverage는 available·missing·total 불변식을 검증한다", () => {
  assert.equal(validatePalworldDataCoverage(coverage).ok, true);
  assert.equal(validatePalworldDataCoverage({
    ...coverage,
    palDetails: { available: 1, missing: 1, total: 1 }
  }).ok, false);
  assert.equal(validatePalworldDataCoverage({
    ...coverage,
    craftingRecipes: undefined
  }).ok, false);
  assert.equal(validatePalworldDataCoverage({ ...coverage, unknown: true }).ok, false);
});

test("locale별 번역 coverage는 필드 coverage와 번역 상태 집계를 엄격하게 검증한다", () => {
  const localeCoverage = {
    palNames: { available: 1, missing: 0, total: 1 },
    palDescriptions: { available: 1, missing: 0, total: 1 },
    itemNames: { available: 1, missing: 0, total: 1 },
    itemDescriptions: { available: 1, missing: 0, total: 1 },
    skillNames: { available: 1, missing: 0, total: 1 },
    skillDescriptions: { available: 1, missing: 0, total: 1 },
    skillPassiveAbilities: { available: 1, missing: 0, total: 1 },
    humanReviewed: 2,
    machineAssisted: 5,
    sourceLanguageFallback: 0,
    missingSource: 0,
    staleSourceHash: 0
  };
  const translatedCoverage = {
    ...coverage,
    translations: { ko: localeCoverage, ja: localeCoverage }
  };
  assert.equal(validatePalworldDataCoverage(translatedCoverage).ok, true);
  assert.equal(validatePalworldDataCoverage({
    ...translatedCoverage,
    translations: {
      ...translatedCoverage.translations,
      ko: { ...localeCoverage, machineAssisted: Number.NaN }
    }
  }).ok, false);
  assert.equal(validatePalworldDataCoverage({
    ...translatedCoverage,
    translations: {
      ...translatedCoverage.translations,
      ko: { ...localeCoverage, machineAssisted: 4 }
    }
  }).ok, false);
  assert.equal(validatePalworldDataCoverage({
    ...translatedCoverage,
    translations: {
      ...translatedCoverage.translations,
      ko: { ...localeCoverage, staleSourceHash: 1 }
    }
  }).ok, false);
  assert.equal(validatePalworldDataCoverage({
    ...translatedCoverage,
    translations: {
      ...translatedCoverage.translations,
      ja: { ...localeCoverage, unsafe: true }
    }
  }).ok, false);
});

test("Palworld meta는 optional 스킬 도메인과 상세 coverage를 counts에 맞춰 검증한다", () => {
  const response = {
    metadata,
    counts: { pals: 1, items: 1, breedingPairs: 1, skills: 1 },
    domains: {
      pals: { status: "ready", recordCount: 1, metadata },
      items: { status: "ready", recordCount: 1, metadata },
      breeding: { status: "ready", recordCount: 1, metadata },
      skills: { status: "incomplete", recordCount: 1, metadata }
    },
    gates: {
      dataIntegrity: { passed: true, status: "ready" },
      imageAssets: {
        status: "operator_acknowledged",
        policyStatus: "operator_acknowledged",
        technicalPassed: true,
        publicActivationAllowed: true,
        rightsVerified: false,
        usageBasis: "operator_reference_use",
        readyImages: 1,
        fallbackPals: 0,
        publicNoticeRequired: true
      }
    },
    coverage
  };
  assert.equal(validatePalworldMetaResponse(response).ok, true);
  assert.equal(validatePalworldMetaResponse({ ...response, coverage: undefined }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    counts: { ...response.counts, skills: 2 }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    domains: { ...response.domains, skills: undefined }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    coverage: { ...coverage, itemImages: { available: 1, missing: 1, total: 2 } }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    coverage: { ...coverage, craftingRecipes: { available: 1, missing: 1, total: 2 } }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    coverage: { ...coverage, palImages: { available: 0, missing: 1, total: 1 } }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    coverage: {
      ...coverage,
      localization: {
        ...coverage.localization,
        ko: { available: 1, missing: 1, total: 2 }
      }
    }
  }).ok, false);
});

test("Pal summary는 한국어·일본어·영어 이름과 안전한 로컬 이미지를 검증한다", () => {
  const summary = {
    ...palReference,
    rarity: 10,
    variantType: "normal",
    workSuitabilities: [{ type: "handiwork", level: 4 }]
  };
  assert.equal(validatePalworldPalSummary(summary).ok, true);
  for (const imageUrl of [
    "https://unapproved.example/anubis.webp",
    `/palworld/pals/${palImageHash}.webp`,
    `/images/palworld/${metadata.gameVersion}/items/${palImageHash}.webp`,
    `/images/palworld/${metadata.gameVersion}/pals/${palImageHash}.png`,
    `/images/palworld/${metadata.gameVersion}/pals/not-a-content-hash.webp`,
    `/images/palworld/${metadata.gameVersion}/pals/${palImageHash}.webp?cache=1`,
    `/images/palworld/${metadata.gameVersion}/pals/${palImageHash}.webp#fragment`,
    `/images/palworld/${metadata.gameVersion}/pals/../${palImageHash}.webp`,
    `/images/palworld/${metadata.gameVersion}/pals/%2e%2e/${palImageHash}.webp`
  ]) {
    assert.equal(validatePalworldPalSummary({ ...summary, imageUrl }).ok, false, imageUrl);
  }
  assert.equal(validatePalworldPalSummary({ ...summary, workSuitabilities: [{ type: "shell", level: 5 }] }).ok, false);
  assert.equal(validatePalworldPalSummary({ ...summary, workSuitabilities: [{ type: "handiwork", level: 8 }] }).ok, true);
  assert.equal(validatePalworldPalSummary({ ...summary, workSuitabilities: [{ type: "handiwork", level: 9 }] }).ok, false);
  assert.equal(validatePalworldPalSummary({ ...summary, elements: ["ground", "ground"] }).ok, false);
  assert.equal(validatePalworldPalSummary({
    ...summary,
    workSuitabilities: [{ type: "handiwork", level: 4 }, { type: "handiwork", level: 3 }]
  }).ok, false);
  assert.equal(validatePalworldPalSummary({ ...summary, id: "Anubis" }).ok, false);
  assert.equal(validatePalworldPalSummary({ ...summary, id: `a${"b".repeat(80)}` }).ok, false);
  assert.equal(validatePalworldPalSummary({ ...summary, imageWidth: 128, imageHeight: 128 }).ok, true);
  assert.equal(validatePalworldPalSummary({ ...summary, imageWidth: 128 }).ok, false);
  assert.equal(validatePalworldPalSummary({ ...summary, imageWidth: Number.NaN, imageHeight: 128 }).ok, false);
});

test("Pal 상세는 nocturnal boolean을 필수로 검증한다", () => {
  assert.equal(validatePalworldPalDetail(pal).ok, true);
  const { nocturnal: _nocturnal, ...withoutNocturnal } = pal;
  assert.equal(validatePalworldPalDetail(withoutNocturnal).ok, false);
  assert.equal(validatePalworldPalDetail({ ...pal, nocturnal: "false" }).ok, false);
  assert.equal(validatePalworldPalDetail({
    ...pal,
    descriptionEn: "A guardian Pal from the desert.",
    localization: englishFallback,
    dropDetails: [{ item: itemReference, minQuantity: 1, maxQuantity: 3, dropRatePercent: 25.5 }],
    breeding: {
      ...pal.breeding,
      specialParentPairs: [{
        parentAId: "anubis",
        parentBId: "anubis",
        parentAGender: "male",
        parentBGender: "female"
      }]
    }
  }).ok, true);
  assert.equal(validatePalworldPalDetail({
    ...pal,
    breeding: {
      ...pal.breeding,
      specialParentPairs: [{ parentAId: "anubis", parentBId: "anubis", parentAGender: "unknown" }]
    }
  }).ok, false);
});

test("Pal drop 상세는 수량 범위·확률·unknown field를 엄격하게 검증한다", () => {
  const drop = { item: itemReference, minQuantity: 1, maxQuantity: 3, dropRatePercent: 25.5 };
  assert.equal(validatePalworldPalDrop(drop).ok, true);
  assert.equal(validatePalworldPalDrop({ ...drop, maxQuantity: 0 }).ok, false);
  assert.equal(validatePalworldPalDrop({ ...drop, minQuantity: 4 }).ok, false);
  assert.equal(validatePalworldPalDrop({ ...drop, dropRatePercent: 100.1 }).ok, false);
  assert.equal(validatePalworldPalDrop({ ...drop, dropRatePercent: Number.NaN }).ok, false);
  assert.equal(validatePalworldPalDrop({ ...drop, raw: "금지" }).ok, false);
});

test("아이템 summary는 rarity 0과 고정 버전 item content-hash WebP만 허용한다", () => {
  const summary = {
    id: item.id,
    nameKo: item.nameKo,
    nameJa: item.nameJa,
    nameEn: item.nameEn,
    imageUrl: itemImageUrl,
    category: item.category,
    rarity: 0,
    descriptionKo: item.descriptionKo,
    descriptionJa: item.descriptionJa,
    descriptionEn: item.descriptionEn,
    sellPrice: item.sellPrice,
    technologyLevel: item.technologyLevel
  };
  assert.equal(validatePalworldItemSummary(summary).ok, true);
  for (const imageUrl of [
    "https://unapproved.example/item.webp",
    `/images/palworld/${metadata.gameVersion}/pals/${itemImageHash}.webp`,
    `/images/palworld/${metadata.gameVersion}/items/${itemImageHash}.png`,
    `/images/palworld/${metadata.gameVersion}/items/not-a-content-hash.webp`,
    `/images/palworld/${metadata.gameVersion}/items/${itemImageHash}.webp?cache=1`
  ]) {
    assert.equal(validatePalworldItemSummary({ ...summary, imageUrl }).ok, false, imageUrl);
  }
  assert.equal(validatePalworldItemSummary({ ...summary, rarity: -1 }).ok, false);
});

test("아이템은 KO·JA 원문이 없을 때 영어 fallback을 명시하고 상세 수치 범위를 지켜야 한다", () => {
  const englishOnlySummary = {
    id: item.id,
    nameEn: item.nameEn,
    imageUrl: item.imageUrl,
    imageWidth: 256,
    imageHeight: 256,
    localization: englishFallback,
    category: item.category,
    rarity: item.rarity,
    descriptionEn: item.descriptionEn,
    sellPrice: item.sellPrice,
    technologyLevel: item.technologyLevel
  };
  assert.equal(validatePalworldItemSummary(englishOnlySummary).ok, true);
  const { localization: _localization, ...withoutFallback } = englishOnlySummary;
  assert.equal(validatePalworldItemSummary(withoutFallback).ok, false);
  assert.equal(validatePalworldItemSummary({
    ...englishOnlySummary,
    localization: { ...englishFallback, ko: "localized" }
  }).ok, false);

  const detail = {
    ...item,
    sourceInternalId: "PalSphere",
    weight: 2.5,
    maxStack: 99,
    durability: 1_000
  };
  assert.equal(validatePalworldItemDetail(detail).ok, true);
  assert.equal(validatePalworldItemDetail({ ...detail, weight: Number.NaN }).ok, false);
  assert.equal(validatePalworldItemDetail({ ...detail, maxStack: 1.5 }).ok, false);
  assert.equal(validatePalworldItemDetail({ ...detail, durability: Number.POSITIVE_INFINITY }).ok, false);
  assert.equal(validatePalworldItemDetail({ ...detail, sourceInternalId: "../PalSphere" }).ok, false);
  assert.equal(validatePalworldItemDetail({ ...detail, sourceInternalId: "PalSphere-v2" }).ok, false);
  assert.equal(validatePalworldItemSummary({ ...englishOnlySummary, sourceInternalId: "PalSphere" }).ok, false);
  assert.equal(validatePalworldItemDetail({
    ...detail,
    craftingMaterials: [...detail.craftingMaterials, detail.craftingMaterials[0]]
  }).ok, false);
  assert.equal(validatePalworldItemDetail({ ...detail, dropPals: [...detail.dropPals, detail.dropPals[0]] }).ok, false);
});

test("Palworld 스냅샷은 정규화된 상세 데이터와 참조 무결성을 검증한다", () => {
  const result = validatePalworldDataSnapshot(snapshot);
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  assert.equal(assertPalworldDataSnapshot(snapshot).pals[0]?.nameJa, "アヌビス");

  const mismatchedProvenance = validatePalworldDataSnapshot({
    ...snapshot,
    pals: [{
      ...pal,
      metadata: {
        ...pal.metadata,
        sourceChecksum: "f".repeat(64)
      }
    }]
  });
  assert.equal(mismatchedProvenance.ok, false);
  assert.match(
    mismatchedProvenance.ok ? "" : mismatchedProvenance.error,
    /snapshot과 metadata가 같아야 합니다/
  );

  const missingItem = {
    ...snapshot,
    pals: [{ ...pal, drops: [{ ...itemReference, id: "missing_item" }] }]
  };
  const invalidReference = validatePalworldDataSnapshot(missingItem);
  assert.equal(invalidReference.ok, false);
  assert.match(invalidReference.ok ? "" : invalidReference.error, /존재하지 않는 아이템 참조/);

  const missingItemReverseReference = validatePalworldDataSnapshot({
    ...snapshot,
    items: [{ ...item, dropPals: [] }]
  });
  assert.equal(missingItemReverseReference.ok, false);
  assert.match(missingItemReverseReference.ok ? "" : missingItemReverseReference.error, /dropPals 역참조/);

  const missingPalReverseReference = validatePalworldDataSnapshot({
    ...snapshot,
    pals: [{ ...pal, drops: [] }]
  });
  assert.equal(missingPalReverseReference.ok, false);
  assert.match(missingPalReverseReference.ok ? "" : missingPalReverseReference.error, /drops 역참조/);

  assert.throws(
    () => assertPalworldDataSnapshot({ ...snapshot, pals: [pal, pal] }),
    /중복 ID/
  );

  const aliasA = {
    ...pal,
    id: "test-pal",
    number: 101,
    breeding: { ...pal.breeding, specialParentPairs: [{ parentAId: "test-pal", parentBId: "test-pal" }] }
  };
  const aliasB = {
    ...pal,
    id: "test_pal",
    number: 102,
    breeding: { ...pal.breeding, specialParentPairs: [{ parentAId: "test_pal", parentBId: "test_pal" }] }
  };
  const aliasCollision = validatePalworldDataSnapshot({ ...snapshot, pals: [pal, aliasA, aliasB] });
  assert.equal(aliasCollision.ok, false);
  assert.match(aliasCollision.ok ? "" : aliasCollision.error, /ID alias 충돌/);
});

test("확장 스냅샷은 스킬·속성·drop 상세의 양방향 참조 무결성을 검증한다", () => {
  const { partnerSkill: _partnerSkill, ...palWithoutPartnerSkill } = pal;
  const palWithSkill = {
    ...palWithoutPartnerSkill,
    descriptionEn: "A guardian Pal from the desert.",
    localization: englishFallback,
    activeSkills: [{ ...activeSkill, unlockLevel: 1 }],
    dropDetails: [{ item: itemReference, minQuantity: 1, maxQuantity: 3, dropRatePercent: 25.5 }]
  };
  const extendedSnapshot = {
    ...snapshot,
    pals: [palWithSkill],
    skills: [activeSkillDetail],
    elements: [elementDefinition]
  };
  const result = validatePalworldDataSnapshot(extendedSnapshot);
  assert.equal(result.ok, true, result.ok ? "" : result.error);

  const missingSkill = validatePalworldDataSnapshot({
    ...extendedSnapshot,
    pals: [{
      ...palWithSkill,
      activeSkills: [{ ...activeSkill, id: "missing-skill", unlockLevel: 1 }]
    }]
  });
  assert.equal(missingSkill.ok, false);
  assert.match(missingSkill.ok ? "" : missingSkill.error, /존재하지 않는 스킬 참조/);

  const duplicateSkill = validatePalworldDataSnapshot({
    ...extendedSnapshot,
    pals: [{ ...palWithSkill, activeSkills: [...palWithSkill.activeSkills, palWithSkill.activeSkills[0]] }]
  });
  assert.equal(duplicateSkill.ok, false);
  assert.match(duplicateSkill.ok ? "" : duplicateSkill.error, /중복 active skill/);

  const orphanAssignment = validatePalworldDataSnapshot({
    ...extendedSnapshot,
    skills: [{
      ...activeSkillDetail,
      relatedPalCount: 2,
      relatedPals: [
        ...activeSkillDetail.relatedPals,
        { pal: { ...palReference, id: "missing-pal" }, unlockLevel: 1 }
      ]
    }]
  });
  assert.equal(orphanAssignment.ok, false);
  assert.match(orphanAssignment.ok ? "" : orphanAssignment.error, /존재하지 않는 Pal 참조/);

  const missingElement = validatePalworldDataSnapshot({
    ...extendedSnapshot,
    elements: [{ ...elementDefinition, id: "fire" }]
  });
  assert.equal(missingElement.ok, false);
  assert.match(missingElement.ok ? "" : missingElement.error, /정의되지 않은 속성 참조/);

  const mismatchedDrop = validatePalworldDataSnapshot({
    ...extendedSnapshot,
    pals: [{
      ...palWithSkill,
      dropDetails: [{
        item: { ...itemReference, nameJa: "一致しない名前" },
        minQuantity: 1,
        maxQuantity: 1
      }]
    }]
  });
  assert.equal(mismatchedDrop.ok, false);
  assert.match(mismatchedDrop.ok ? "" : mismatchedDrop.error, /canonical 아이템 레코드/);
});

test("Pal 이미지 경로 버전은 snapshot gameVersion과 일치해야 한다", () => {
  const mismatchedMetadata = { ...metadata, gameVersion: "0.6.3" };
  const result = validatePalworldDataSnapshot({
    ...snapshot,
    metadata: mismatchedMetadata,
    pals: [{ ...pal, metadata: mismatchedMetadata }],
    items: [{ ...item, metadata: mismatchedMetadata }]
  });
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /imageUrl.*metadata\.gameVersion/);
});

test("스냅샷 내 Pal과 아이템 참조는 canonical 레코드 필드와 일치해야 한다", () => {
  const mismatchedItemReference = validatePalworldDataSnapshot({
    ...snapshot,
    pals: [{ ...pal, drops: [{ ...itemReference, nameJa: "一致しない名前" }] }]
  });
  assert.equal(mismatchedItemReference.ok, false);
  assert.match(mismatchedItemReference.ok ? "" : mismatchedItemReference.error, /canonical 아이템 레코드/);

  const mismatchedPalReference = validatePalworldDataSnapshot({
    ...snapshot,
    items: [{ ...item, dropPals: [{ ...palReference, number: 999 }] }]
  });
  assert.equal(mismatchedPalReference.ok, false);
  assert.match(mismatchedPalReference.ok ? "" : mismatchedPalReference.error, /canonical Pal 레코드/);

  const mismatchedBreedingReference = validatePalworldDataSnapshot({
    ...snapshot,
    breedingPairs: [{ ...breedingPair, child: { ...palReference, elements: ["fire"] } }]
  });
  assert.equal(mismatchedBreedingReference.ok, false);
  assert.match(mismatchedBreedingReference.ok ? "" : mismatchedBreedingReference.error, /canonical Pal 레코드/);
});

test("Pal 상세의 activeSkills에는 active 타입만 허용한다", () => {
  const invalidActiveSkill = {
    ...pal.partnerSkill,
    id: "not_active",
    type: "passive"
  };
  const result = validatePalworldDataSnapshot({
    ...snapshot,
    pals: [{ ...pal, activeSkills: [invalidActiveSkill] }]
  });
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /active여야 합니다/);
});

test("통합 검색 응답 total은 반환된 Pal과 아이템 결과 수 이상이어야 한다", () => {
  const palSummary = {
    id: pal.id,
    number: pal.number,
    nameKo: pal.nameKo,
    nameJa: pal.nameJa,
    nameEn: pal.nameEn,
    imageUrl: pal.imageUrl,
    elements: pal.elements,
    rarity: pal.rarity,
    variantType: pal.variantType,
    workSuitabilities: pal.workSuitabilities
  };
  const itemSummary = {
    id: item.id,
    nameKo: item.nameKo,
    nameJa: item.nameJa,
    nameEn: item.nameEn,
    imageUrl: item.imageUrl,
    category: item.category,
    rarity: item.rarity,
    descriptionKo: item.descriptionKo,
    descriptionJa: item.descriptionJa,
    descriptionEn: item.descriptionEn,
    sellPrice: item.sellPrice,
    technologyLevel: item.technologyLevel
  };
  assert.equal(validatePalworldSearchResult({
    query: "  アヌビス  ",
    total: 2,
    pals: [palSummary],
    items: [itemSummary],
    metadata,
    domains: searchDomains
  }).ok, true);
  assert.equal(validatePalworldSearchResult({
    query: "아누비스",
    total: 3,
    pals: [palSummary],
    items: [itemSummary],
    metadata,
    domains: searchDomains
  }).ok, true);
  assert.equal(validatePalworldSearchResult({
    query: "아누비스",
    total: 1,
    pals: [palSummary],
    items: [itemSummary],
    metadata,
    domains: searchDomains
  }).ok, false);

  assert.equal(validatePalworldSearchResult({
    query: "아누비스",
    total: 2,
    pals: [palSummary],
    items: [itemSummary],
    metadata
  }).ok, false);
});

test("페이지 응답은 item schema와 페이지 크기를 함께 검증한다", () => {
  const palSummary = {
    id: pal.id,
    number: pal.number,
    nameKo: pal.nameKo,
    nameJa: pal.nameJa,
    nameEn: pal.nameEn,
    imageUrl: pal.imageUrl,
    elements: pal.elements,
    rarity: pal.rarity,
    variantType: pal.variantType,
    workSuitabilities: pal.workSuitabilities
  };
  const result = validatePalworldPaginatedResponse({
    items: [palSummary],
    pagination: {
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    },
    metadata
  }, validatePalworldPalSummary);
  assert.equal(result.ok, true, result.ok ? "" : result.error);

  const inconsistentPages = validatePalworldPaginatedResponse({
    items: [palSummary],
    pagination: {
      page: 1,
      pageSize: 20,
      total: 21,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    },
    metadata
  }, validatePalworldPalSummary);
  assert.equal(inconsistentPages.ok, false);
  assert.match(inconsistentPages.ok ? "" : inconsistentPages.error, /totalPages/);

  const inconsistentFlags = validatePalworldPaginatedResponse({
    items: [palSummary],
    pagination: {
      page: 1,
      pageSize: 20,
      total: 21,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: false
    },
    metadata
  }, validatePalworldPalSummary);
  assert.equal(inconsistentFlags.ok, false);
  assert.match(inconsistentFlags.ok ? "" : inconsistentFlags.error, /hasNextPage/);

  const inconsistentItemCount = validatePalworldPaginatedResponse({
    items: [palSummary],
    pagination: {
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    },
    metadata
  }, validatePalworldPalSummary);
  assert.equal(inconsistentItemCount.ok, false);
  assert.match(inconsistentItemCount.ok ? "" : inconsistentItemCount.error, /결과 수/);

  const impossibleEmptyPage = validatePalworldPaginatedResponse({
    items: [],
    pagination: {
      page: 2,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: true
    },
    metadata
  }, validatePalworldPalSummary);
  assert.equal(impossibleEmptyPage.ok, false);
});

test("Pal 목록 facet 응답은 exact enum·중복·안전한 count를 검증한다", () => {
  const palSummary = {
    id: pal.id,
    number: pal.number,
    nameKo: pal.nameKo,
    nameJa: pal.nameJa,
    nameEn: pal.nameEn,
    imageUrl: pal.imageUrl,
    elements: pal.elements,
    rarity: pal.rarity,
    variantType: pal.variantType,
    workSuitabilities: pal.workSuitabilities
  };
  const facets = {
    elements: [{ value: "ground", count: 42 }],
    workSuitabilities: [{ value: "mining", count: 31 }],
    rarities: [{ value: 10, count: 18 }],
    variants: [{ value: "normal", count: 203 }]
  };
  const response = {
    items: [palSummary],
    pagination: {
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    },
    metadata,
    facets
  };

  assert.equal(validatePalworldPalListFacets(facets).ok, true);
  assert.equal(validatePalworldPalListResponse(response).ok, true);
  assert.equal(validatePalworldPalListResponse({ ...response, unexpected: true }).ok, false);
  assert.equal(validatePalworldPalListFacets({ ...facets, unexpected: [] }).ok, false);
  assert.equal(validatePalworldPalListFacets({
    ...facets,
    elements: [{ ...facets.elements[0], unexpected: true }]
  }).ok, false);
  assert.equal(validatePalworldPalListFacets({
    ...facets,
    elements: [...facets.elements, { value: "ground", count: 1 }]
  }).ok, false);

  for (const count of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(validatePalworldPalListFacets({
      ...facets,
      elements: [{ value: "ground", count }]
    }).ok, false);
  }

  for (const invalidFacets of [
    { ...facets, elements: [{ value: "wind", count: 1 }] },
    { ...facets, workSuitabilities: [{ value: "fishing", count: 1 }] },
    { ...facets, rarities: [{ value: 0, count: 1 }] },
    { ...facets, variants: [{ value: "boss", count: 1 }] }
  ]) {
    assert.equal(validatePalworldPalListFacets(invalidFacets).ok, false);
  }
});

test("교배 결과와 목표 Pal 부모 목록 응답 validator를 제공한다", () => {
  const resultResponse = {
    parentA: palReference,
    parentB: palReference,
    result: breedingPair,
    state: "resolved",
    alternatives: [],
    metadata
  };
  assert.equal(validatePalworldBreedingResultResponse(resultResponse).ok, true);
  assert.equal(validatePalworldBreedingResultResponse({
    ...resultResponse,
    result: { ...breedingPair, parentA: { ...palReference, nameKo: "불일치" } }
  }).ok, false);
  assert.equal(validatePalworldBreedingResultResponse({
    ...resultResponse,
    result: null,
    state: "requires_gender",
    alternatives: [
      { ...breedingPair, id: "gender-result-a" },
      { ...breedingPair, id: "gender-result-b" }
    ]
  }).ok, true);
  assert.equal(validatePalworldBreedingResultResponse({
    ...resultResponse,
    result: null,
    state: "resolved"
  }).ok, false);

  const parentsResponse = {
    child: palReference,
    items: [breedingPair],
    pagination: {
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    },
    state: "resolved",
    metadata
  };
  assert.equal(validatePalworldBreedingParentsResponse(parentsResponse).ok, true);
  assert.equal(validatePalworldBreedingParentsResponse({
    ...parentsResponse,
    child: { ...palReference, id: "lamball" }
  }).ok, false);
});

test("교배 data snapshot은 exact schema·수치·참조·조건 충돌을 검증한다", () => {
  const parameter = (palId, sourceInternalId, combiRank, priority) => ({
    palId,
    sourceInternalId,
    tribe: sourceInternalId,
    combiRank,
    combiDuplicatePriority: priority,
    maleProbability: 0.5,
    variantType: "normal"
  });
  const breedingSnapshot = {
    schemaVersion: 1,
    release: "1.0.1",
    metadata: {
      gameVersion: "1.0.1",
      steamBuildId: "24181105",
      sourceRevision: "atlas@fixed+palcalc@fixed",
      sourceChecksums: {
        atlasPals: "a".repeat(64),
        atlasBreeding: "b".repeat(64),
        palCalc: "c".repeat(64),
        catalog: "d".repeat(64)
      }
    },
    parameters: [
      parameter("katress", "CatMage", 900, 90_000),
      parameter("katress-ignis", "CatMage_Fire", 910, 91_000),
      parameter("wixen", "FoxMage", 880, 88_000)
    ],
    specialRules: [{
      parentAId: "katress",
      parentASourceInternalId: "CatMage",
      parentBId: "wixen",
      parentBSourceInternalId: "FoxMage",
      childId: "katress-ignis",
      childSourceInternalId: "CatMage_Fire",
      parentAGender: "female",
      parentBGender: "male"
    }]
  };
  assert.equal(validatePalworldBreedingDataSnapshot(breedingSnapshot).ok, true);
  assert.equal(validatePalworldBreedingDataSnapshot({ ...breedingSnapshot, unexpected: true }).ok, false);
  assert.equal(validatePalworldBreedingDataSnapshot({
    ...breedingSnapshot,
    parameters: breedingSnapshot.parameters.map((entry, index) => index === 0
      ? { ...entry, combiRank: Number.NaN }
      : entry)
  }).ok, false);
  assert.equal(validatePalworldBreedingDataSnapshot({
    ...breedingSnapshot,
    specialRules: [{ ...breedingSnapshot.specialRules[0], childId: "missing-pal" }]
  }).ok, false);
  assert.equal(validatePalworldBreedingDataSnapshot({
    ...breedingSnapshot,
    specialRules: [
      breedingSnapshot.specialRules[0],
      { ...breedingSnapshot.specialRules[0], childId: "wixen", childSourceInternalId: "FoxMage" }
    ]
  }).ok, false);
});
