import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const {
  PalworldPakSnapshotAdapterError,
  adaptPalworldPakCandidateToSnapshot,
  deterministicPalworldPakSnapshotJson,
  writePalworldPakSnapshotArtifact
} = await import("../dist/data/palworld-pak-snapshot-adapter.js");
const { PALWORLD_SNAPSHOT } = await import("../dist/data/palworld-snapshot.js");
const {
  PALWORLD_PAK_RUNTIME_MANIFEST_FILE,
  deterministicPalworldPakRuntimeManifestJson,
  validatePalworldPakCandidateStagingRoot
} = await import("../dist/data/palworld-pak-runtime-manifest.js");
const {
  loadPalworldPakShadowRuntimeFromStagingRoot
} = await import("../dist/data/palworld-pak-shadow-runtime.js");

const REQUIRED_FILES = [
  "paldex.json",
  "items.json",
  "skills.json",
  "breeding.json",
  "locales/ko.json",
  "locales/ja.json",
  "locales/en.json",
  "assets-manifest.json",
  "map-manifest.json",
  "source-lock.json"
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function adapterInput(overrides = {}) {
  const artifacts = Object.fromEntries(REQUIRED_FILES.map((file) => [file, "{}"]));
  const artifactSha256 = Object.fromEntries(
    REQUIRED_FILES.map((file) => [file, sha256(artifacts[file])])
  );
  return {
    identity: {
      candidateId: `candidate-${"a".repeat(16)}`,
      release: "2.0.0",
      gameVersion: "2.0.0",
      steamBuildId: "30000000",
      importRevision: "operator-pak-2.0.0-r1",
      publicSourceUrl: "https://example.invalid/palworld/operator-pak-export",
      verifiedAt: "2026-07-23T00:00:00.000Z"
    },
    artifacts,
    artifactSha256,
    ...overrides
  };
}

function canonicalFixture() {
  const archiveSha256 = "a".repeat(64);
  const mappingsSha256 = "b".repeat(64);
  const candidateId = `candidate-${archiveSha256.slice(0, 16)}`;
  const release = "2.0.0";
  const sourceMembers = {
    ko: {
      member: "Pal/Content/L10N/ko/Pal/DataTable/Text/Fixture.json",
      sha256: "c".repeat(64),
      bytes: 100
    },
    ja: {
      member: "Pal/Content/Pal/DataTable/Text/Fixture.json",
      sha256: "d".repeat(64),
      bytes: 100
    },
    en: {
      member: "Pal/Content/L10N/en/Pal/DataTable/Text/Fixture.json",
      sha256: "e".repeat(64),
      bytes: 100
    }
  };
  const includedFiles = Object.values(sourceMembers)
    .sort((left, right) => left.member.localeCompare(right.member, "en"));
  const provenance = {
    id: `operator_pak_export:${archiveSha256.slice(0, 16)}`,
    type: "operator_pak_export",
    archiveSha256,
    gameVersion: release,
    steamBuildId: "30000000",
    fmodelVersion: "FModel-4.0",
    exportedAt: "2026-07-23T00:00:00.000Z",
    mappingsSha256,
    includedFiles,
    rightsVerified: false,
    usageBasis: "operator_reference_use"
  };
  const metadata = {
    candidateId,
    sourceType: "operator_pak_export",
    release,
    gameVersion: release,
    steamBuildId: "30000000",
    fmodelVersion: "FModel-4.0",
    exportedAt: "2026-07-23T00:00:00.000Z",
    mappingsSha256
  };
  const common = {
    schemaVersion: 1,
    candidateId,
    release,
    metadata,
    provenance
  };
  const localeRecords = {
    ko: new Map(),
    ja: new Map(),
    en: new Map()
  };
  const localized = (sourceField, messageKey, values, richText = false) => {
    const result = {
      messageKey,
      sourceField,
      ko: values.ko,
      ja: values.ja,
      en: values.en,
      koStatus: "source_provided",
      jaStatus: "source_provided",
      enStatus: "source_provided"
    };
    for (const locale of ["ko", "ja", "en"]) {
      const text = values[locale];
      const source = sourceMembers[locale];
      localeRecords[locale].set(`${sourceField}\0${messageKey}`, {
        messageKey,
        field: sourceField,
        text,
        valueSha256: sha256(text),
        status: "source_provided",
        sourceMember: source.member,
        sourceMemberSha256: source.sha256
      });
      if (richText) {
        result[`${locale}RichTextStatus`] = "resolved";
        result[`${locale}RichText`] = {
          tokens: [{ type: "text", text, styles: [] }],
          unresolved: []
        };
      }
    }
    return result;
  };
  const palNameOne = localized("pal_name", "PAL_NAME_ONE", {
    ko: "첫 번째 팰",
    ja: "最初のパル",
    en: "First Pal"
  });
  const palNameTwo = localized("pal_name", "PAL_NAME_TWO", {
    ko: "두 번째 팰",
    ja: "二番目のパル",
    en: "Second Pal"
  });
  const palDescriptionOne = localized("pal_description", "PAL_DESC_ONE", {
    ko: "첫 번째 팰 설명",
    ja: "最初のパルの説明",
    en: "First Pal description"
  }, true);
  const palDescriptionTwo = localized("pal_description", "PAL_DESC_TWO", {
    ko: "두 번째 팰 설명",
    ja: "二番目のパルの説明",
    en: "Second Pal description"
  }, true);
  const activatedOne = localized("pal_first_activated", "PAL_ACTIVE_ONE", {
    ko: "첫 발견",
    ja: "初発見",
    en: "First discovery"
  });
  const activatedTwo = localized("pal_first_activated", "PAL_ACTIVE_TWO", {
    ko: "두 번째 발견",
    ja: "二番目の発見",
    en: "Second discovery"
  });
  const itemName = localized("item_name", "ITEM_NAME_ONE", {
    ko: "시험 재료",
    ja: "試験素材",
    en: "Test Material"
  });
  const itemDescription = localized("item_description", "ITEM_DESC_ONE", {
    ko: "시험용 제작 재료",
    ja: "試験用の製作素材",
    en: "A test crafting material"
  }, true);
  const activeName = localized("skill_name", "SKILL_NAME_WATER_JET", {
    ko: "워터 제트",
    ja: "ウォータージェット",
    en: "Aqua Jet"
  });
  const activeDescription = localized("skill_description", "SKILL_DESC_WATER_JET", {
    ko: "물을 발사한다",
    ja: "水を発射する",
    en: "Fires water"
  }, true);
  const passiveName = localized("skill_name", "SKILL_NAME_BRAVE", {
    ko: "용감",
    ja: "勇敢",
    en: "Brave"
  });
  const passiveDescription = localized("skill_description", "SKILL_DESC_BRAVE", {
    ko: "공격력이 증가한다",
    ja: "攻撃力が上がる",
    en: "Raises attack"
  }, true);
  const partnerNameOne = localized("skill_name", "PARTNER_NAME_ONE", {
    ko: "첫 번째 동료",
    ja: "最初の相棒",
    en: "First Partner"
  });
  const partnerDescriptionOne = localized("skill_description", "PARTNER_DESC_ONE", {
    ko: "첫 번째 파트너 스킬",
    ja: "最初のパートナースキル",
    en: "First partner skill"
  }, true);
  const partnerNameTwo = localized("skill_name", "PARTNER_NAME_TWO", {
    ko: "두 번째 동료",
    ja: "二番目の相棒",
    en: "Second Partner"
  });
  const partnerDescriptionTwo = localized("skill_description", "PARTNER_DESC_TWO", {
    ko: "두 번째 파트너 스킬",
    ja: "二番目のパートナースキル",
    en: "Second partner skill"
  }, true);
  const stats = {
    hp: 100,
    meleeAttack: 90,
    shotAttack: 110,
    defense: 80,
    walkSpeed: 100,
    runSpeed: 200,
    rideSprintSpeed: 300,
    stamina: 100,
    food: 5
  };
  const palRecord = ({
    id,
    sourceInternalId,
    number,
    name,
    description,
    firstActivatedInfo,
    partnerSkillId,
    partnerName,
    partnerDescription,
    drops
  }) => ({
    id,
    idStatus: "existing_exact",
    canonicalJoinRule: "source_row_equals_tribe",
    sourceRowId: sourceInternalId,
    sourceInternalId,
    tribe: sourceInternalId,
    bpClass: `BP_${sourceInternalId}_C`,
    bpClassAsset: null,
    number,
    suffix: "",
    variantType: "normal",
    rarity: 1,
    elements: ["water"],
    sourceElements: ["Water"],
    stats,
    nocturnal: false,
    workSuitabilities: [{ type: "handiwork", level: 1 }],
    sourceOnlyWorkSuitabilities: [],
    partnerSkill: {
      id: partnerSkillId,
      name: partnerName,
      parameterSourceRowId: null,
      description: partnerDescription
    },
    activeSkillAssignmentIds: ["active-water-jet"],
    drops,
    breeding: {
      combiRank: number * 100,
      combiDuplicatePriority: number,
      ignoreCombi: false,
      maleProbability: 50
    },
    name,
    description,
    firstActivatedInfo
  });
  const paldex = {
    ...common,
    records: [
      palRecord({
        id: "pal-one",
        sourceInternalId: "PalOne",
        number: 1,
        name: palNameOne,
        description: palDescriptionOne,
        firstActivatedInfo: activatedOne,
        partnerSkillId: "partner-pal-one",
        partnerName: partnerNameOne,
        partnerDescription: partnerDescriptionOne,
        drops: [{
          sourceRowId: "PalOne000",
          itemSourceInternalId: "ItemOne",
          itemId: "item-one",
          rate: 50,
          min: 1,
          max: 2
        }]
      }),
      palRecord({
        id: "pal-two",
        sourceInternalId: "PalTwo",
        number: 2,
        name: palNameTwo,
        description: palDescriptionTwo,
        firstActivatedInfo: activatedTwo,
        partnerSkillId: "partner-pal-two",
        partnerName: partnerNameTwo,
        partnerDescription: partnerDescriptionTwo,
        drops: []
      })
    ],
    exclusions: []
  };
  const items = {
    ...common,
    records: [{
      id: "item-one",
      sourceInternalId: "ItemOne",
      typeA: "Material",
      typeB: "MaterialMonster",
      rarity: 1,
      rank: 1,
      maxStack: 999,
      weight: 1,
      price: 10,
      durability: 0,
      legalInGame: true,
      iconName: null,
      iconSourceMember: null,
      recipes: [{
        sourceRowId: "RecipeItemOne",
        resultCount: 1,
        workAmount: 10,
        materials: [{
          sourceInternalId: "ItemOne",
          itemId: "item-one",
          count: 2
        }]
      }],
      technology: [{
        sourceRowId: "TechnologyItemOne",
        unlockLevel: 1,
        tier: 1,
        cost: 1
      }],
      dropPalIds: ["pal-one"],
      name: itemName,
      description: itemDescription
    }]
  };
  const assignments = [
    ["PalOne", "pal-one", "ActiveAssignmentOne"],
    ["PalTwo", "pal-two", "ActiveAssignmentTwo"]
  ].map(([palSourceInternalId, palId, sourceRowId]) => ({
    sourceRowId,
    palSourceInternalId,
    palId,
    activeSkillSourceInternalId: "WaterJet",
    activeSkillId: "active-water-jet",
    level: 1,
    sourceTable: "Pal/DataTable/DT_PalActiveSkill.json",
    status: "resolved"
  }));
  const skills = {
    ...common,
    records: [
      {
        id: "active-water-jet",
        sourceRowId: "WaterJet",
        sourceInternalId: "WaterJet",
        type: "active",
        sourceElement: "Water",
        element: "water",
        power: 30,
        cooldownSeconds: 2,
        relatedPalIds: ["pal-one", "pal-two"],
        name: activeName,
        description: activeDescription
      },
      {
        id: "partner-pal-one",
        sourceRowId: "PartnerPalOne",
        sourceInternalId: "PartnerPalOne",
        type: "partner",
        relatedPalIds: ["pal-one"],
        name: partnerNameOne,
        description: partnerDescriptionOne
      },
      {
        id: "partner-pal-two",
        sourceRowId: "PartnerPalTwo",
        sourceInternalId: "PartnerPalTwo",
        type: "partner",
        relatedPalIds: ["pal-two"],
        name: partnerNameTwo,
        description: partnerDescriptionTwo
      },
      {
        id: "passive-brave",
        sourceRowId: "Brave",
        sourceInternalId: "Brave",
        type: "passive",
        rank: 1,
        effects: [{ type: "ShotAttack", value: 10, target: "ToSelf" }],
        name: passiveName,
        description: passiveDescription
      }
    ],
    assignments,
    excludedEggAssignments: []
  };
  const parameters = [
    ["pal-one", "PalOne", 100, 1],
    ["pal-two", "PalTwo", 200, 2]
  ].map(([palId, sourceInternalId, combiRank, priority]) => ({
    palId,
    sourceRowId: sourceInternalId,
    sourceInternalId,
    tribe: sourceInternalId,
    bpClass: `BP_${sourceInternalId}_C`,
    combiRank,
    combiDuplicatePriority: priority,
    ignoreCombi: false,
    maleProbability: 50,
    variantType: "normal"
  }));
  const breeding = {
    ...common,
    parameters,
    specialRules: [{
      sourceRowId: "SpecialOne",
      parentAId: "pal-one",
      parentASourceInternalId: "PalOne",
      parentBId: "pal-two",
      parentBSourceInternalId: "PalTwo",
      childId: "pal-one",
      childSourceInternalId: "PalOne",
      parentAGender: "male",
      parentBGender: "female",
      special: true
    }],
    excludedSourceRows: [],
    sourceMissingSourceRows: [],
    duplicateSourceRows: [],
    unresolvedSourceRows: [],
    computedResultCount: 3
  };
  const localeArtifact = (locale) => ({
    ...common,
    locale,
    status: "source_provided",
    sourceArchiveSha256: archiveSha256,
    languageVerified: true,
    records: [...localeRecords[locale].values()]
      .sort((left, right) =>
        `${left.field}\0${left.messageKey}`.localeCompare(
          `${right.field}\0${right.messageKey}`,
          "en"
        )
      ),
    coverage: {
      inputRows: localeRecords[locale].size,
      includedRows: localeRecords[locale].size,
      placeholderRows: 0,
      invalidRows: 0,
      duplicateMessageKeys: 0
    }
  });
  const assets = {
    ...common,
    status: "candidate_incomplete",
    importMode: "validation_only",
    transform: {
      tool: "sharp",
      sharpVersion: "0.35.3",
      libvipsVersion: "8.17.3",
      resizeFit: "inside",
      withoutEnlargement: true,
      iconWebp: {
        quality: 90,
        alphaQuality: 100,
        effort: 6,
        smartSubsample: true
      },
      mapWebp: {
        quality: 85,
        alphaQuality: 100,
        effort: 6,
        smartSubsample: true
      },
      metadataPolicy: "strip"
    },
    images: [],
    failures: [],
    missing: {
      pals: ["PalOne", "PalTwo"],
      items: ["item-one"],
      work: "blocked_pending_semantic_mapping",
      skillUnmappedCount: 4
    },
    unmappedSourceImages: {
      skillIcons: [],
      palIcons: []
    }
  };
  const map = {
    ...common,
    status: "blocked",
    variants: []
  };
  const sourceLock = {
    ...common,
    archive: {
      sha256: archiveSha256,
      bytes: 1_000,
      fileCount: includedFiles.length
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
    includedFiles
  };
  const values = {
    "paldex.json": paldex,
    "items.json": items,
    "skills.json": skills,
    "breeding.json": breeding,
    "locales/ko.json": localeArtifact("ko"),
    "locales/ja.json": localeArtifact("ja"),
    "locales/en.json": localeArtifact("en"),
    "assets-manifest.json": assets,
    "map-manifest.json": map,
    "source-lock.json": sourceLock
  };
  const artifacts = Object.fromEntries(
    Object.entries(values).map(([file, value]) => [file, JSON.stringify(value)])
  );
  return {
    input: {
      identity: {
        candidateId,
        release,
        gameVersion: release,
        steamBuildId: provenance.steamBuildId,
        importRevision: "operator-pak-2.0.0-r1",
        publicSourceUrl: "https://example.invalid/palworld/operator-pak-export",
        verifiedAt: "2026-07-23T01:00:00.000Z"
      },
      artifacts,
      artifactSha256: Object.fromEntries(
        Object.entries(artifacts).map(([file, value]) => [file, sha256(value)])
      )
    },
    values
  };
}

function replaceArtifact(fixture, file, mutate) {
  const value = structuredClone(fixture.values[file]);
  mutate(value);
  fixture.values[file] = value;
  fixture.input.artifacts[file] = JSON.stringify(value);
  fixture.input.artifactSha256[file] = sha256(fixture.input.artifacts[file]);
}

test("snapshot JSON은 객체 key 순서와 무관하게 결정적이다", () => {
  const first = deterministicPalworldPakSnapshotJson(PALWORLD_SNAPSHOT);
  const reordered = Object.fromEntries(
    Object.entries(structuredClone(PALWORLD_SNAPSHOT)).reverse()
  );
  const second = deterministicPalworldPakSnapshotJson(reordered);

  assert.equal(second, first);
  assert.equal(sha256(second), sha256(first));
});

test("canonical PAK candidate를 전체 참조를 보존한 snapshot으로 변환한다", () => {
  const first = adaptPalworldPakCandidateToSnapshot(canonicalFixture().input);
  const second = adaptPalworldPakCandidateToSnapshot(canonicalFixture().input);

  assert.equal(first.snapshot.metadata.gameVersion, "2.0.0");
  assert.equal(first.snapshot.metadata.release, "2.0.0");
  assert.equal(first.snapshot.metadata.steamBuildId, "30000000");
  assert.equal(first.snapshot.metadata.sourceName, "operator_provided_pak_export");
  assert.equal(first.snapshot.pals.length, 2);
  assert.equal(first.snapshot.items.length, 1);
  assert.equal(first.snapshot.skills.length, 4);
  assert.equal(first.snapshot.breedingPairs.length, 3);
  assert.equal(first.breedingSource.specialRules.length, 1);
  assert.equal(first.report.unresolvedActiveAssignments, 0);
  assert.equal(first.report.unresolvedSpecialBreedingRows, 0);
  assert.equal(first.gates.dataIntegrity.passed, true);
  assert.equal(first.gates.imageAssets.status, "blocked_by_license");
  assert.equal(first.gates.imageAssets.technicalPassed, false);
  assert.equal(first.gates.imageAssets.rightsVerified, false);
  assert.equal(first.report.technicalPalImages, 0);
  assert.equal(first.report.technicalItemImages, 0);
  assert.equal(first.report.technicalElementImages, 0);
  assert.equal(first.report.technicalWorkImages, 0);
  assert.equal(first.report.technicalSkillImages, 0);
  assert.equal(first.report.technicalMapImages, 0);
  assert.equal(first.report.publicPalImages, 0);
  assert.equal(first.report.publicItemImages, 0);
  assert.equal(first.report.fallbackPals, 2);
  assert.equal(first.report.fallbackItems, 1);
  assert.equal(first.report.fallbackElements, 9);
  assert.equal(first.report.fallbackWorkSuitabilities, 12);
  assert.equal(first.report.fallbackSkills, 4);
  assert.equal(first.report.fallbackMap, 1);
  assert.equal(first.snapshot.pals[0].translation.name.ko, "source_provided");
  assert.equal(first.snapshot.items[0].translation.name.ja, "source_provided");
  assert.equal(first.snapshot.skills[0].sourceInternalId, "WaterJet");
  assert.equal(first.snapshot.items[0].recipes[0].materials[0].item.id, "item-one");
  assert.equal(first.snapshot.pals[0].dropDetails[0].item.id, "item-one");
  assert.equal(first.snapshot.pals[0].activeSkills[0].id, "active-waterjet");
  assert.equal(Object.hasOwn(first.snapshot.pals[0], "sourceInternalId"), false);
  assert.deepEqual(first.sourceInternalIds, {
    "pal-one": "PalOne",
    "pal-two": "PalTwo"
  });
  assert.equal(
    deterministicPalworldPakSnapshotJson(first.snapshot),
    deterministicPalworldPakSnapshotJson(second.snapshot)
  );
});

test("결정적 snapshot artifact를 디스크 staging에서 재검증해 shadow API service를 구성한다", async () => {
  const root = await mkdtemp(
    path.join(await realpath(tmpdir()), "palworld-pak-shadow-staging-")
  );
  try {
    const fixture = canonicalFixture();
    const adapted = adaptPalworldPakCandidateToSnapshot(fixture.input);
    const snapshotBytes = Buffer.from(
      deterministicPalworldPakSnapshotJson(adapted.snapshot)
    );
    const {
      schemaVersion,
      candidateId,
      release,
      metadata,
      provenance
    } = fixture.values["paldex.json"];
    const importReport = {
      schemaVersion,
      candidateId,
      release,
      metadata,
      provenance,
      status: "blocked_candidate",
      activationEligible: false,
      blockers: ["PALWORLD_IMAGE_RELEASE_BLOCKED_BY_LICENSE"],
      counts: {},
      sourceCounts: {},
      localeCoverage: {},
      domainLocaleCoverage: {},
      detailCoverage: {},
      imageCoverage: {},
      sourceDomainCounts: {},
      richTextIssues: [],
      sourceImageResolutionDistribution: {},
      sourceReferenceGaps: {},
      publicIdMapping: {},
      skillIdMigration: {},
      technologyAudit: {},
      unresolved: {},
      excluded: {},
      aliasApplications: [],
      staleAliases: [],
      reviewedExclusions: [],
      palIconOverrides: [],
      sourceTablePalIconReferences: {},
      imageAssetFailures: [],
      limitations: []
    };
    const files = new Map([
      ...Object.entries(fixture.input.artifacts)
        .map(([file, value]) => [file, Buffer.from(value)]),
      ["snapshot.json", snapshotBytes],
      ["import-report.json", Buffer.from(JSON.stringify(importReport))]
    ]);
    const kindByFile = new Map([
      ["snapshot.json", "snapshot"],
      ["paldex.json", "paldex"],
      ["items.json", "items"],
      ["skills.json", "skills"],
      ["breeding.json", "breeding"],
      ["locales/ko.json", "locale-ko"],
      ["locales/ja.json", "locale-ja"],
      ["locales/en.json", "locale-en"],
      ["assets-manifest.json", "assets-manifest"],
      ["map-manifest.json", "map-manifest"],
      ["source-lock.json", "source-lock"],
      ["import-report.json", "import-report"]
    ]);
    for (const [file, bytes] of files) {
      const target = path.join(root, ...file.split("/"));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    const full = (available, total) => ({
      available,
      missing: total - available,
      total
    });
    const manifest = {
      schemaVersion: 1,
      release: "2.0.0",
      gameVersion: "2.0.0",
      steamBuildId: "30000000",
      source: {
        type: "operator_pak_export",
        archiveSha256: "a".repeat(64),
        importRevision: "operator-pak-2.0.0-r1",
        license: "RIGHTS_NOT_INDEPENDENTLY_VERIFIED",
        usageBasis: "operator_reference_use",
        rightsVerified: false
      },
      activation: {
        pals: "ready",
        items: "ready",
        skills: "ready",
        breeding: "ready",
        localizationKo: "ready",
        localizationJa: "ready",
        localizationEn: "ready",
        palImages: "blocked",
        itemImages: "blocked",
        elementImages: "blocked",
        workImages: "blocked",
        skillImages: "blocked",
        map: "blocked"
      },
      counts: {
        pals: 2,
        items: 1,
        skills: 4,
        breedingResults: 3,
        specialBreedingRules: 1
      },
      coverage: {
        pals: full(2, 2),
        items: full(1, 1),
        skills: full(4, 4),
        breeding: full(3, 3),
        localizationKo: full(7, 7),
        localizationJa: full(7, 7),
        localizationEn: full(7, 7),
        palImages: full(0, 2),
        itemImages: full(0, 1),
        elementImages: full(0, 9),
        workImages: full(0, 12),
        skillImages: full(0, 4),
        map: full(0, 1)
      },
      artifacts: [...files.entries()].map(([file, bytes]) => ({
        kind: kindByFile.get(file),
        file,
        sha256: sha256(bytes),
        bytes: bytes.length
      }))
    };
    await writeFile(
      path.join(root, PALWORLD_PAK_RUNTIME_MANIFEST_FILE),
      deterministicPalworldPakRuntimeManifestJson(manifest)
    );

    const validated = await validatePalworldPakCandidateStagingRoot({
      stagingRoot: root,
      expectedRelease: "2.0.0",
      expectedGameVersion: "2.0.0",
      expectedSteamBuildId: "30000000"
    });
    const snapshotArtifact = validated.verifiedArtifacts
      .find((artifact) => artifact.kind === "snapshot");
    assert.ok(snapshotArtifact);
    assert.equal(snapshotArtifact.sha256, sha256(snapshotBytes));
    assert.equal(
      await readFile(path.join(root, "snapshot.json"), "utf8"),
      deterministicPalworldPakSnapshotJson(adapted.snapshot)
    );

    const shadow = await loadPalworldPakShadowRuntimeFromStagingRoot({
      stagingRoot: root
    });
    assert.equal(shadow.manifest.release, "2.0.0");
    assert.equal(shadow.service.meta().counts.pals, 2);
    assert.equal(shadow.service.getPal("pal-one").nameKo, "첫 번째 팰");
    assert.equal(shadow.service.getItem("item-one").nameJa, "試験素材");
    assert.equal(
      shadow.service.getSkill("active-waterjet").nameKo,
      "워터 제트"
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("candidate의 orphan·duplicate·NaN 값을 Shared exact validator 전에 통과시키지 않는다", () => {
  const orphan = canonicalFixture();
  replaceArtifact(orphan, "items.json", (value) => {
    value.records[0].recipes[0].materials[0].itemId = "missing-item";
  });
  assert.throws(
    () => adaptPalworldPakCandidateToSnapshot(orphan.input),
    /고아 item 참조/u
  );

  const duplicate = canonicalFixture();
  replaceArtifact(duplicate, "paldex.json", (value) => {
    value.records.push(structuredClone(value.records[0]));
  });
  assert.throws(
    () => adaptPalworldPakCandidateToSnapshot(duplicate.input),
    /중복/u
  );

  const nonFinite = canonicalFixture();
  replaceArtifact(nonFinite, "items.json", (value) => {
    value.records[0].price = null;
  });
  assert.throws(
    () => adaptPalworldPakCandidateToSnapshot(nonFinite.input),
    /숫자여야 합니다/u
  );

  for (const token of ["NaN", "Infinity"]) {
    const invalidJsonNumber = canonicalFixture();
    invalidJsonNumber.input.artifacts["items.json"] =
      invalidJsonNumber.input.artifacts["items.json"]
        .replace('"price":10', `"price":${token}`);
    invalidJsonNumber.input.artifactSha256["items.json"] = sha256(
      invalidJsonNumber.input.artifacts["items.json"]
    );
    assert.throws(
      () => adaptPalworldPakCandidateToSnapshot(invalidJsonNumber.input),
      /올바른 JSON이어야 합니다/u
    );
  }
});

test("stale locale·placeholder·공식 EN 누락을 fail-closed 처리한다", () => {
  const stale = canonicalFixture();
  replaceArtifact(stale, "locales/ko.json", (value) => {
    value.records[0].text = `${value.records[0].text} 변조`;
  });
  assert.throws(
    () => adaptPalworldPakCandidateToSnapshot(stale.input),
    /stale locale checksum/u
  );

  const placeholder = canonicalFixture();
  replaceArtifact(placeholder, "locales/ja.json", (value) => {
    value.records[0].text = "-";
    value.records[0].valueSha256 = sha256("-");
  });
  assert.throws(
    () => adaptPalworldPakCandidateToSnapshot(placeholder.input),
    /placeholder/u
  );

  const missingEn = canonicalFixture();
  replaceArtifact(missingEn, "locales/en.json", (value) => {
    value.status = "missing";
    value.languageVerified = false;
    value.records = [];
    value.coverage = {
      inputRows: 0,
      includedRows: 0,
      placeholderRows: 0,
      invalidRows: 0,
      duplicateMessageKeys: 0
    };
  });
  assert.throws(
    () => adaptPalworldPakCandidateToSnapshot(missingEn.input),
    (error) =>
      error instanceof PalworldPakSnapshotAdapterError
      && error.code === "OFFICIAL_EN_LOCALE_NOT_PROVIDED"
  );
});

test("snapshot writer는 검증된 JSON을 생성하고 기존 파일을 덮어쓰지 않는다", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "palworld-pak-snapshot-"));
  try {
    const result = await writePalworldPakSnapshotArtifact({
      outputRoot: root,
      snapshot: PALWORLD_SNAPSHOT
    });
    const bytes = await readFile(path.join(root, "snapshot.json"));
    assert.equal(result.sha256, sha256(bytes));
    assert.equal(result.bytes, bytes.length);
    assert.match(bytes.toString("utf8"), /\n$/u);

    await assert.rejects(
      () => writePalworldPakSnapshotArtifact({
        outputRoot: root,
        snapshot: PALWORLD_SNAPSHOT
      }),
      /기존 artifact를 덮어쓰지 않습니다/u
    );
    const entries = await import("node:fs/promises").then(({ readdir }) =>
      readdir(root)
    );
    assert.deepEqual(entries, ["snapshot.json"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("snapshot writer는 symlink output root를 거부한다", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "palworld-pak-snapshot-link-"));
  const actual = path.join(parent, "actual");
  const linked = path.join(parent, "linked");
  try {
    await mkdir(actual);
    await symlink(actual, linked, "dir");
    assert.equal((await lstat(linked)).isSymbolicLink(), true);
    await assert.rejects(
      () => writePalworldPakSnapshotArtifact({
        outputRoot: linked,
        snapshot: PALWORLD_SNAPSHOT
      }),
      /symlink가 아닌 directory/u
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("adapter는 release metadata가 없거나 서로 다르면 artifact를 읽기 전에 차단한다", () => {
  const missing = adapterInput();
  missing.identity.release = "";
  missing.identity.gameVersion = "";
  missing.identity.steamBuildId = "";
  assert.throws(
    () => adaptPalworldPakCandidateToSnapshot(missing),
    (error) =>
      error instanceof PalworldPakSnapshotAdapterError
      && error.code === "PALWORLD_PAK_RELEASE_METADATA_REQUIRED"
  );

  const mismatch = adapterInput();
  mismatch.identity.gameVersion = "2.0.1";
  assert.throws(
    () => adaptPalworldPakCandidateToSnapshot(mismatch),
    (error) =>
      error instanceof PalworldPakSnapshotAdapterError
      && error.code === "PALWORLD_PAK_RELEASE_METADATA_REQUIRED"
  );
});

test("adapter는 artifact checksum 변조와 candidate unknown field를 fail-closed 처리한다", () => {
  const tampered = adapterInput();
  tampered.artifactSha256["paldex.json"] = "b".repeat(64);
  assert.throws(
    () => adaptPalworldPakCandidateToSnapshot(tampered),
    /선언된 SHA-256과 실제 artifact bytes가 일치하지 않습니다/u
  );

  const unknownField = adapterInput();
  unknownField.artifacts["paldex.json"] = JSON.stringify({ unknown: true });
  unknownField.artifactSha256["paldex.json"] = sha256(
    unknownField.artifacts["paldex.json"]
  );
  assert.throws(
    () => adaptPalworldPakCandidateToSnapshot(unknownField),
    /허용되지 않은 필드/u
  );
});

test("adapter는 metadata가 비어 있는 candidate를 별도 안전 코드로 차단한다", () => {
  const blocked = adapterInput();
  blocked.artifacts["paldex.json"] = JSON.stringify({
    schemaVersion: 1,
    candidateId: blocked.identity.candidateId,
    release: null,
    metadata: {
      candidateId: blocked.identity.candidateId,
      sourceType: "operator_pak_export",
      release: null,
      gameVersion: null,
      steamBuildId: null,
      fmodelVersion: null,
      exportedAt: null,
      mappingsSha256: null
    }
  });
  blocked.artifactSha256["paldex.json"] = sha256(
    blocked.artifacts["paldex.json"]
  );
  assert.throws(
    () => adaptPalworldPakCandidateToSnapshot(blocked),
    (error) =>
      error instanceof PalworldPakSnapshotAdapterError
      && error.code === "PALWORLD_PAK_RELEASE_METADATA_REQUIRED"
  );
});
