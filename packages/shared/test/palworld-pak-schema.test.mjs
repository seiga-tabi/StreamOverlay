import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  assertPalworldPakCandidateArtifact,
  assertPalworldSourceProvenance,
  validatePalworldDataCoverage,
  validatePalworldSkill,
  validatePalworldSourceProvenance,
  validatePalworldTranslationSnapshot
} from "../dist/index.js";

const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");

const candidateProvenance = {
  id: `operator_pak_export:${"a".repeat(16)}`,
  type: "operator_pak_export",
  archiveSha256: "a".repeat(64),
  gameVersion: null,
  steamBuildId: null,
  fmodelVersion: null,
  exportedAt: null,
  mappingsSha256: null,
  includedFiles: [
    {
      member: "Pal/Content/DataTable/DT_ItemDataTable.json",
      sha256: "b".repeat(64),
      bytes: 1234
    },
    {
      member: "Pal/Content/L10N/ko/Pal/DataTable/Text/DT_ItemNameText_Common.json",
      sha256: "c".repeat(64),
      bytes: 5678
    }
  ],
  rightsVerified: false,
  usageBasis: "operator_reference_use"
};

const completeProvenance = {
  ...candidateProvenance,
  gameVersion: "1.0.1",
  steamBuildId: "12345678",
  fmodelVersion: "4.6.1",
  exportedAt: "2026-07-22T01:02:03.000Z",
  mappingsSha256: "d".repeat(64)
};

function sourceLockArtifact(metadataOverrides = {}) {
  return {
    schemaVersion: 1,
    candidateId: `candidate-${"a".repeat(16)}`,
    release: "1.0.1",
    metadata: {
      candidateId: `candidate-${"a".repeat(16)}`,
      sourceType: "operator_pak_export",
      release: "1.0.1",
      gameVersion: completeProvenance.gameVersion,
      steamBuildId: completeProvenance.steamBuildId,
      fmodelVersion: completeProvenance.fmodelVersion,
      exportedAt: completeProvenance.exportedAt,
      mappingsSha256: completeProvenance.mappingsSha256,
      ...metadataOverrides
    },
    provenance: completeProvenance,
    archive: {
      sha256: completeProvenance.archiveSha256,
      bytes: 6912,
      fileCount: completeProvenance.includedFiles.length
    },
    mappings: {
      publicIdMap: "1".repeat(64),
      aliases: "2".repeat(64),
      palIconOverrides: "3".repeat(64),
      elementIconMap: "4".repeat(64),
      workIconMap: "5".repeat(64),
      skillIconMap: "6".repeat(64),
      publicActiveSkillAllowlist: "7".repeat(64),
      exclusions: "8".repeat(64),
      legacySkillCatalog: "9".repeat(64)
    },
    includedFiles: completeProvenance.includedFiles
  };
}

test("operator PAK provenance는 metadata 미제공 candidate와 완비된 고정 source를 검증한다", () => {
  assert.equal(validatePalworldSourceProvenance(candidateProvenance).ok, true);
  assert.deepEqual(assertPalworldSourceProvenance(candidateProvenance), candidateProvenance);
  assert.equal(validatePalworldSourceProvenance(completeProvenance).ok, true);
});

test("operator PAK provenance는 unknown field, 부분 metadata와 권리 오표시를 거부한다", () => {
  assert.equal(validatePalworldSourceProvenance({ ...candidateProvenance, unknown: true }).ok, false);
  assert.equal(validatePalworldSourceProvenance({
    ...candidateProvenance,
    id: `operator_pak_export:${"b".repeat(16)}`
  }).ok, false);
  assert.equal(validatePalworldSourceProvenance({
    ...candidateProvenance,
    gameVersion: "1.0.1"
  }).ok, false);
  const { fmodelVersion: _fmodelVersion, ...withoutFmodelVersion } = candidateProvenance;
  assert.equal(validatePalworldSourceProvenance(withoutFmodelVersion).ok, false);
  assert.equal(validatePalworldSourceProvenance({
    ...candidateProvenance,
    archiveSha256: "A".repeat(64)
  }).ok, false);
  assert.equal(validatePalworldSourceProvenance({
    ...candidateProvenance,
    rightsVerified: true
  }).ok, false);
  assert.equal(validatePalworldSourceProvenance({
    ...candidateProvenance,
    usageBasis: "rights_verified"
  }).ok, false);
});

test("candidate artifact metadata는 operator provenance와 exact 일치해야 한다", () => {
  const context = {
    candidateId: `candidate-${"a".repeat(16)}`,
    release: "1.0.1"
  };
  assert.doesNotThrow(() =>
    assertPalworldPakCandidateArtifact(
      "source-lock.json",
      sourceLockArtifact(),
      context
    )
  );
  assert.throws(
    () => assertPalworldPakCandidateArtifact(
      "source-lock.json",
      sourceLockArtifact({ mappingsSha256: "e".repeat(64) }),
      context
    ),
    /operator provenance의 고정 source metadata와 일치/
  );
});

test("operator PAK provenance의 includedFiles는 안전하고 결정적인 상대 경로만 허용한다", () => {
  assert.equal(validatePalworldSourceProvenance({
    ...candidateProvenance,
    includedFiles: [
      {
        member: "../Content/escape.json",
        sha256: "b".repeat(64),
        bytes: 1
      }
    ]
  }).ok, false);
  assert.equal(validatePalworldSourceProvenance({
    ...candidateProvenance,
    includedFiles: [...candidateProvenance.includedFiles].reverse()
  }).ok, false);
  assert.equal(validatePalworldSourceProvenance({
    ...candidateProvenance,
    includedFiles: [{
      ...candidateProvenance.includedFiles[0],
      unexpected: true
    }]
  }).ok, false);
});

test("source_provided 표시 상태는 영어 원문 없이 공식 KO·JA locale 값을 허용한다", () => {
  const officialSkill = {
    id: "official-skill",
    type: "active",
    nameKo: "공식 스킬",
    nameJa: "公式スキル",
    nameEn: "Official Skill",
    descriptionKo: "공식 한국어 설명",
    descriptionJa: "公式日本語説明",
    translation: {
      name: { ko: "source_provided", ja: "source_provided" },
      description: { ko: "source_provided", ja: "source_provided" }
    }
  };
  assert.equal(validatePalworldSkill(officialSkill).ok, true);
  assert.equal(validatePalworldSkill({
    ...officialSkill,
    descriptionJa: undefined
  }).ok, false);
});

test("source_provided translation snapshot은 공식 source 상태와 method 일치를 검증한다", () => {
  const officialText = "공식 한국어 이름";
  const sourceMember = "L10N/ko/Pal/DataTable/Text/DT_ItemNameText_Common.json";
  const sourceMemberSha256 = "c".repeat(64);
  const snapshot = {
    schemaVersion: 1,
    release: "pak-candidate",
    locale: "ko",
    sourceCatalogSha256: "a".repeat(64),
    sourcePaldexSha256: "b".repeat(64),
    sourceRevision: "operator-pak-export",
    translationRevision: "official-ko-v1",
    translationMethod: "source_provided",
    translationStatus: "incomplete",
    translatedAt: "2026-07-22T01:02:03.000Z",
    reviewedAt: null,
    records: [{
      id: "official-item",
      kind: "item",
      fields: {
        name: {
          sourceSha256: sha256(officialText),
          sourceMessageKey: "ITEM_NAME_OfficialItem",
          sourceMember,
          sourceMemberSha256,
          text: officialText,
          status: "source_provided"
        }
      }
    }]
  };
  assert.equal(validatePalworldTranslationSnapshot(snapshot).ok, true);
  const context = {
    release: snapshot.release,
    sourceCatalogSha256: snapshot.sourceCatalogSha256,
    sourcePaldexSha256: snapshot.sourcePaldexSha256,
    sourceRevision: snapshot.sourceRevision,
    records: [],
    officialSourceFields: [{
      locale: "ko",
      kind: "item",
      id: "official-item",
      field: "name",
      messageKey: "ITEM_NAME_OfficialItem",
      text: officialText,
      textSha256: sha256(officialText),
      sourceMember,
      sourceMemberSha256
    }]
  };
  assert.equal(validatePalworldTranslationSnapshot(snapshot, context).ok, true);
  assert.equal(validatePalworldTranslationSnapshot({
    ...snapshot,
    records: [{
      ...snapshot.records[0],
      fields: {
        name: {
          ...snapshot.records[0].fields.name,
          sourceMessageKey: "ITEM_NAME_Tampered"
        }
      }
    }]
  }, context).ok, false);
  assert.equal(validatePalworldTranslationSnapshot({
    ...snapshot,
    records: [{
      ...snapshot.records[0],
      fields: {
        name: {
          ...snapshot.records[0].fields.name,
          sourceMemberSha256: "d".repeat(64)
        }
      }
    }]
  }, context).ok, false);
  assert.equal(validatePalworldTranslationSnapshot(snapshot, {
    ...context,
    officialSourceFields: []
  }).ok, false);
  assert.equal(validatePalworldTranslationSnapshot({
    ...snapshot,
    translationMethod: "machine_assisted"
  }).ok, false);
});

const count = (available, missing, total) => ({ available, missing, total });

function coverageWithOfficialSource() {
  const coverage = {
    palDetails: count(1, 0, 1),
    itemDetails: count(1, 0, 1),
    skillDetails: count(1, 0, 1),
    palDescriptions: count(1, 0, 1),
    palStats: count(1, 0, 1),
    partnerSkills: count(1, 0, 1),
    activeSkills: count(1, 0, 1),
    palDrops: count(1, 0, 1),
    breedingFields: count(1, 0, 1),
    itemDescriptions: count(1, 0, 1),
    craftingRecipes: count(1, 0, 1),
    craftingFacilities: count(0, 1, 1),
    dropPals: count(1, 0, 1),
    technologyLevels: count(1, 0, 1),
    prices: count(1, 0, 1),
    durability: count(1, 0, 1),
    acquisitionMethods: count(1, 0, 1),
    skillDescriptions: count(1, 0, 1),
    relatedPals: count(1, 0, 1),
    palImages: count(1, 0, 1),
    itemImages: count(0, 1, 1),
    elementImages: count(1, 8, 9),
    localization: {
      ko: count(3, 0, 3),
      ja: count(3, 0, 3),
      en: count(0, 3, 3)
    }
  };
  const locale = {
    palNames: count(1, 0, 1),
    palDescriptions: count(1, 0, 1),
    itemNames: count(1, 0, 1),
    itemDescriptions: count(1, 0, 1),
    skillNames: count(1, 0, 1),
    skillDescriptions: count(1, 0, 1),
    skillPassiveAbilities: count(0, 1, 1),
    sourceProvided: 6,
    humanReviewed: 0,
    machineAssisted: 0,
    sourceLanguageFallback: 1,
    missingSource: 0,
    placeholderExcluded: 2,
    unresolvedRichText: 1,
    staleSourceHash: 0
  };
  return { ...coverage, translations: { ko: locale, ja: locale } };
}

test("locale coverage는 공식 source, placeholder 제외와 unresolved rich text를 additive하게 검증한다", () => {
  const coverage = coverageWithOfficialSource();
  assert.equal(validatePalworldDataCoverage(coverage).ok, true);
  assert.equal(validatePalworldDataCoverage({
    ...coverage,
    translations: {
      ...coverage.translations,
      ko: { ...coverage.translations.ko, sourceProvided: 5 }
    }
  }).ok, false);
  assert.equal(validatePalworldDataCoverage({
    ...coverage,
    translations: {
      ...coverage.translations,
      ja: { ...coverage.translations.ja, unresolvedRichText: 8 }
    }
  }).ok, false);
});
