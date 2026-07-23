import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const {
  PALWORLD_PAK_BLOCKED_CANDIDATE_MANIFEST_FILE,
  PalworldPakRuntimeManifestError,
  assertPalworldPakBlockedCandidateManifest,
  deterministicPalworldPakBlockedCandidateManifestJson,
  validatePalworldPakBlockedCandidateStagingRoot
} = await import("../dist/data/palworld-pak-runtime-manifest.js");
const {
  loadPalworldPakShadowRuntime,
  PalworldPakShadowRuntimeError
} = await import("../dist/data/palworld-pak-shadow-runtime.js");

const ARCHIVE_SHA256 = "a".repeat(64);
const CANDIDATE_ID = `candidate-${ARCHIVE_SHA256.slice(0, 16)}`;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function baseManifest(artifactBytes, assetBytes) {
  const assetSha256 = sha256(assetBytes);
  return {
    schemaVersion: 1,
    candidateId: CANDIDATE_ID,
    release: null,
    gameVersion: null,
    steamBuildId: null,
    source: {
      id: `operator_pak_export:${ARCHIVE_SHA256.slice(0, 16)}`,
      type: "operator_pak_export",
      archiveSha256: ARCHIVE_SHA256,
      gameVersion: null,
      steamBuildId: null,
      fmodelVersion: null,
      exportedAt: null,
      mappingsSha256: null,
      rightsVerified: false,
      usageBasis: "operator_reference_use"
    },
    activationEligible: false,
    activation: {
      pals: "candidate",
      items: "candidate",
      skills: "candidate",
      breeding: "blocked",
      localizationKo: "candidate",
      localizationJa: "candidate",
      localizationEn: "blocked",
      palImages: "blocked",
      itemImages: "blocked",
      elementImages: "blocked",
      workImages: "blocked",
      skillImages: "blocked",
      map: "blocked"
    },
    blockers: [
      "EXPORT_METADATA_NOT_PROVIDED",
      "ITEM_ICON_EXPORT_INCOMPLETE"
    ],
    counts: {
      rawPalRows: 303,
      canonicalPals: 288,
      excludedPalRows: 15,
      reviewedPublicIds: 287,
      generatedPublicIds: 1,
      rawItemRows: 2_466,
      legalItems: 1_891,
      excludedItemRows: 575,
      activeSkills: 375,
      sourcePassiveSkills: 1_905,
      visiblePassiveSkills: 115,
      excludedPassiveSkills: 1_790,
      partnerSkills: 288,
      legacySkills: 566,
      mappedLegacySkills: 0,
      unresolvedLegacySkills: 566,
      activeAssignments: 5_772,
      resolvedActiveAssignments: 5_700,
      excludedActiveAssignments: 72,
      publicResolvedActiveAssignments: 5_700,
      publicExcludedActiveAssignments: 60,
      sourceMissingActiveAssignments: 12,
      unresolvedActiveAssignments: 0,
      eggAssignments: 7_111,
      palsWithActiveAssignments: 283,
      palsWithoutActiveAssignments: 5,
      sourceSpecialBreedingRows: 258,
      resolvedSpecialBreedingRules: 184,
      publicResolvedSpecialBreedingRows: 184,
      publicExcludedSpecialBreedingRows: 72,
      sourceMissingSpecialBreedingRows: 0,
      duplicateSpecialBreedingRows: 1,
      unresolvedSpecialBreedingRows: 1,
      computedBreedingResults: 41_617
    },
    localeCoverage: {
      ko: { names: 2_609, descriptions: 2_560 },
      ja: { names: 2_608, descriptions: 2_560 },
      en: { names: 0, descriptions: 0 },
      placeholdersExcluded: { ko: 708, ja: 678, en: 0 },
      unresolvedRichText: { ko: 3, ja: 2, en: 0 }
    },
    imageCoverage: {
      pals: { available: 1, missing: 287, total: 288 },
      items: { available: 0, missing: 1_891, total: 1_891 },
      elements: { available: 0, missing: 9, total: 9 },
      work: { available: 0, missing: 15, total: 15 },
      skills: { available: 0, missing: 778, total: 778 },
      map: { available: 0, missing: 1, total: 1 }
    },
    mappingChecksums: {
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
    artifacts: [
      {
        file: "import-report.json",
        sha256: sha256(artifactBytes),
        bytes: artifactBytes.length
      }
    ],
    assets: [
      {
        id: "lamball",
        kind: "pal",
        file: `assets/pal/${assetSha256}.webp`,
        sha256: assetSha256,
        bytes: assetBytes.length
      }
    ]
  };
}

function fixtureArtifact(release = null, candidateId = CANDIDATE_ID) {
  return Buffer.from(`${JSON.stringify({
    schemaVersion: 1,
    candidateId,
    release,
    status: "blocked"
  }, null, 2)}\n`, "utf8");
}

function fixtureWebp() {
  const bytes = Buffer.alloc(12);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(4, 4);
  bytes.write("WEBP", 8, "ascii");
  return bytes;
}

test("blocked candidate manifest는 snapshot adapter 결과가 있어도 shadow runtime을 열지 않는다", () => {
  const artifactBytes = fixtureArtifact();
  const assetBytes = fixtureWebp();
  const blocked = baseManifest(artifactBytes, assetBytes);
  assert.throws(
    () => loadPalworldPakShadowRuntime({
      manifest: blocked,
      adapted: {}
    }),
    (error) =>
      error instanceof PalworldPakShadowRuntimeError
      && error.code === "PALWORLD_PAK_SHADOW_CANDIDATE_BLOCKED"
      && error.message.includes("EXPORT_METADATA_NOT_PROVIDED")
  );
});

async function writeStagingFixture(context, options = {}) {
  const stagingRoot = await mkdtemp(
    path.join(await realpath(tmpdir()), "streamops-pak-blocked-")
  );
  context.after(() => rm(stagingRoot, { recursive: true, force: true }));
  const assetBytes = options.assetBytes ?? fixtureWebp();
  const assetSha256 = sha256(assetBytes);
  const source = baseManifest(fixtureArtifact(), assetBytes).source;
  const metadata = {
    candidateId: CANDIDATE_ID,
    sourceType: "operator_pak_export",
    release: null,
    gameVersion: null,
    steamBuildId: null,
    fmodelVersion: null,
    exportedAt: null,
    mappingsSha256: null
  };
  const common = {
    schemaVersion: 1,
    candidateId: CANDIDATE_ID,
    release: null,
    metadata,
    provenance: source
  };
  const zeroCounts = Object.fromEntries(
    Object.keys(baseManifest(fixtureArtifact(), assetBytes).counts)
      .map((key) => [key, 0])
  );
  const zeroLocaleCoverage = {
    ko: { names: 0, descriptions: 0 },
    ja: { names: 0, descriptions: 0 },
    en: { names: 0, descriptions: 0 },
    placeholdersExcluded: { ko: 0, ja: 0, en: 0 },
    unresolvedRichText: { ko: 0, ja: 0, en: 0 }
  };
  const zeroImageCoverage = {
    pals: { available: 0, missing: 0, total: 0 },
    items: { available: 0, missing: 0, total: 0 },
    elements: { available: 1, missing: 0, total: 1 },
    work: { available: 0, missing: 0, total: 0 },
    skills: { available: 0, missing: 0, total: 0 },
    map: { available: 0, missing: 0, total: 0 }
  };
  const image = {
    id: "neutral",
    kind: "element",
    sourceMember: "Pal/Texture/UI/InGame/T_Icon_element_s_00.png",
    sourceSha256: "9".repeat(64),
    sourceWidth: 1,
    sourceHeight: 1,
    outputFile: `assets/element/${assetSha256}.webp`,
    outputSha256: assetSha256,
    outputMime: "image/webp",
    outputWidth: 1,
    outputHeight: 1,
    outputBytes: assetBytes.length
  };
  const locale = (name) => ({
    ...common,
    locale: name,
    status: name === "ko" && options.localeRecord !== undefined
      ? "source_provided"
      : "missing",
    sourceArchiveSha256: ARCHIVE_SHA256,
    languageVerified: name === "ko" && options.localeRecord !== undefined,
    records: name === "ko" && options.localeRecord !== undefined
      ? [options.localeRecord]
      : [],
    coverage: {
      inputRows: name === "ko" && options.localeRecord !== undefined ? 1 : 0,
      includedRows: name === "ko" && options.localeRecord !== undefined ? 1 : 0,
      placeholderRows: 0,
      invalidRows: 0,
      duplicateMessageKeys: 0
    }
  });
  const mappingChecksums = baseManifest(fixtureArtifact(), assetBytes).mappingChecksums;
  const artifacts = new Map([
    ["paldex.json", { ...common, records: [], exclusions: [] }],
    ["items.json", { ...common, records: [] }],
    ["skills.json", {
      ...common,
      records: [],
      assignments: [],
      excludedEggAssignments: []
    }],
    ["breeding.json", {
      ...common,
      parameters: [],
      specialRules: [],
      excludedSourceRows: [],
      sourceMissingSourceRows: [],
      duplicateSourceRows: [],
      unresolvedSourceRows: [],
      computedResultCount: 0
    }],
    ["locales/ko.json", locale("ko")],
    ["locales/ja.json", locale("ja")],
    ["locales/en.json", locale("en")],
    ["assets-manifest.json", {
      ...common,
      status: "candidate_incomplete",
      importMode: "converted",
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
          quality: 84,
          alphaQuality: 100,
          effort: 6,
          smartSubsample: true
        },
        metadataPolicy: "strip"
      },
      images: [image],
      failures: [],
      missing: {
        pals: [],
        items: [],
        work: "blocked_pending_semantic_mapping",
        skillUnmappedCount: 0
      },
      unmappedSourceImages: {
        skillIcons: [],
        palIcons: []
      }
    }],
    ["map-manifest.json", { ...common, status: "blocked", variants: [] }],
    ["import-report.json", {
      ...common,
      status: "blocked_candidate",
      activationEligible: false,
      blockers: ["EXPORT_METADATA_NOT_PROVIDED"],
      counts: zeroCounts,
      sourceCounts: {},
      localeCoverage: zeroLocaleCoverage,
      domainLocaleCoverage: {},
      detailCoverage: {},
      imageCoverage: zeroImageCoverage,
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
    }],
    ["source-lock.json", {
      ...common,
      archive: {
        sha256: ARCHIVE_SHA256,
        bytes: 1,
        fileCount: 1
      },
      mappings: mappingChecksums,
      includedFiles: options.localeRecord === undefined
        ? []
        : [{
            member: options.localeRecord.sourceMember,
            sha256: options.localeRecord.sourceMemberSha256,
            bytes: 1
          }]
    }]
  ]);
  const artifactEntries = [];
  for (const [file, value] of artifacts) {
    const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
    const absolute = path.join(stagingRoot, ...file.split("/"));
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes);
    artifactEntries.push({
      file,
      sha256: sha256(bytes),
      bytes: bytes.length
    });
  }
  const manifest = {
    ...baseManifest(fixtureArtifact(), assetBytes),
    blockers: ["EXPORT_METADATA_NOT_PROVIDED"],
    counts: zeroCounts,
    localeCoverage: zeroLocaleCoverage,
    imageCoverage: zeroImageCoverage,
    mappingChecksums,
    artifacts: artifactEntries,
    assets: [{
      id: image.id,
      kind: image.kind,
      file: image.outputFile,
      sha256: image.outputSha256,
      bytes: image.outputBytes
    }]
  };
  const artifactFile = path.join(stagingRoot, "import-report.json");
  const assetFile = path.join(stagingRoot, ...image.outputFile.split("/"));
  await mkdir(path.dirname(assetFile), { recursive: true });
  await writeFile(assetFile, assetBytes);
  await writeFile(
    path.join(stagingRoot, PALWORLD_PAK_BLOCKED_CANDIDATE_MANIFEST_FILE),
    deterministicPalworldPakBlockedCandidateManifestJson(manifest)
  );
  return { stagingRoot, manifest, artifactFile, assetFile };
}

test("blocked candidate manifest는 null metadata와 operator PAK source를 exact schema로 검증한다", () => {
  const artifact = fixtureArtifact();
  const webp = fixtureWebp();
  const manifest = assertPalworldPakBlockedCandidateManifest(baseManifest(artifact, webp));

  assert.equal(manifest.release, null);
  assert.equal(manifest.gameVersion, null);
  assert.equal(manifest.steamBuildId, null);
  assert.equal(manifest.source.gameVersion, null);
  assert.equal(manifest.source.steamBuildId, null);
  assert.equal(manifest.source.fmodelVersion, null);
  assert.equal(manifest.source.mappingsSha256, null);
  assert.equal(manifest.source.rightsVerified, false);
  assert.equal(manifest.activationEligible, false);
  assert.ok(Object.isFrozen(manifest));

  for (const mutate of [
    (value) => { value.unknown = true; },
    (value) => { value.activation.unknown = "blocked"; },
    (value) => { value.localeCoverage.ko.unknown = 0; },
    (value) => { value.imageCoverage.pals.unknown = 0; },
    (value) => { value.mappingChecksums.unknown = "0".repeat(64); },
    (value) => { value.artifacts[0].unknown = true; },
    (value) => { value.assets[0].unknown = true; },
    (value) => { value.source.unknown = true; }
  ]) {
    const invalid = structuredClone(baseManifest(artifact, webp));
    mutate(invalid);
    assert.throws(
      () => assertPalworldPakBlockedCandidateManifest(invalid),
      /허용되지 않은 필드/u
    );
  }
});

test("blocked candidate manifest는 manifest와 source의 version metadata가 함께 일치해야 한다", () => {
  const artifact = fixtureArtifact();
  const webp = fixtureWebp();

  const manifestOnlyVersion = structuredClone(baseManifest(artifact, webp));
  manifestOnlyVersion.release = "0.7.2";
  manifestOnlyVersion.gameVersion = "0.7.2";
  manifestOnlyVersion.steamBuildId = "24681012";
  assert.throws(
    () => assertPalworldPakBlockedCandidateManifest(manifestOnlyVersion),
    /manifest version metadata와 일치/u
  );

  const partialSourceMetadata = structuredClone(baseManifest(artifact, webp));
  partialSourceMetadata.source.gameVersion = "0.7.2";
  assert.throws(
    () => assertPalworldPakBlockedCandidateManifest(partialSourceMetadata),
    /metadata는 모두 제공하거나 candidate에서 모두 null/u
  );

  const partialManifestMetadata = structuredClone(baseManifest(artifact, webp));
  partialManifestMetadata.release = "0.7.2";
  partialManifestMetadata.gameVersion = "0.7.2";
  assert.throws(
    () => assertPalworldPakBlockedCandidateManifest(partialManifestMetadata),
    /version metadata는 함께 제공/u
  );
});

test("blocked candidate manifest는 특수 교배와 active assignment 분류 합계 변조를 차단한다", () => {
  const artifact = fixtureArtifact();
  const webp = fixtureWebp();

  const badBreeding = structuredClone(baseManifest(artifact, webp));
  badBreeding.counts.unresolvedSpecialBreedingRows -= 1;
  assert.throws(
    () => assertPalworldPakBlockedCandidateManifest(badBreeding),
    /특수 교배 source 행 분류 합계/u
  );

  const badAssignments = structuredClone(baseManifest(artifact, webp));
  badAssignments.counts.excludedActiveAssignments -= 1;
  assert.throws(
    () => assertPalworldPakBlockedCandidateManifest(badAssignments),
    /active assignment 분류 합계/u
  );

  const badDetailedAssignments = structuredClone(baseManifest(artifact, webp));
  badDetailedAssignments.counts.sourceMissingActiveAssignments -= 1;
  assert.throws(
    () => assertPalworldPakBlockedCandidateManifest(badDetailedAssignments),
    /공개\/제외\/source 누락\/unresolved 분류 합계/u
  );

  const badDetailedBreeding = structuredClone(baseManifest(artifact, webp));
  badDetailedBreeding.counts.publicExcludedSpecialBreedingRows -= 1;
  assert.throws(
    () => assertPalworldPakBlockedCandidateManifest(badDetailedBreeding),
    /특수 교배 source 행 분류 합계/u
  );

  const badPalAssignmentCoverage = structuredClone(baseManifest(artifact, webp));
  badPalAssignmentCoverage.counts.palsWithoutActiveAssignments -= 1;
  assert.throws(
    () => assertPalworldPakBlockedCandidateManifest(badPalAssignmentCoverage),
    /Pal active assignment coverage 합계/u
  );

  const badSkillImageTotal = structuredClone(baseManifest(artifact, webp));
  badSkillImageTotal.imageCoverage.skills.total -= 1;
  badSkillImageTotal.imageCoverage.skills.missing -= 1;
  assert.throws(
    () => assertPalworldPakBlockedCandidateManifest(badSkillImageTotal),
    /record count 기준 이미지 total/u
  );
});

test("blocked candidate asset은 kind 디렉터리와 content-hash 파일명을 강제한다", () => {
  const artifact = fixtureArtifact();
  const webp = fixtureWebp();
  const invalid = structuredClone(baseManifest(artifact, webp));
  invalid.assets[0].file = `assets/pal/${"f".repeat(64)}.webp`;
  assert.throws(
    () => assertPalworldPakBlockedCandidateManifest(invalid),
    /content hash 파일명이 일치/u
  );
});

test("blocked candidate manifest JSON은 입력 object key 순서와 무관하게 결정적이다", () => {
  const artifact = fixtureArtifact();
  const webp = fixtureWebp();
  const first = baseManifest(artifact, webp);
  const reordered = {
    assets: first.assets,
    artifacts: first.artifacts,
    mappingChecksums: Object.fromEntries(Object.entries(first.mappingChecksums).reverse()),
    imageCoverage: Object.fromEntries(Object.entries(first.imageCoverage).reverse()),
    localeCoverage: {
      unresolvedRichText: first.localeCoverage.unresolvedRichText,
      placeholdersExcluded: first.localeCoverage.placeholdersExcluded,
      en: first.localeCoverage.en,
      ja: first.localeCoverage.ja,
      ko: first.localeCoverage.ko
    },
    counts: Object.fromEntries(Object.entries(first.counts).reverse()),
    blockers: first.blockers,
    activation: Object.fromEntries(Object.entries(first.activation).reverse()),
    activationEligible: first.activationEligible,
    source: first.source,
    steamBuildId: first.steamBuildId,
    gameVersion: first.gameVersion,
    release: first.release,
    candidateId: first.candidateId,
    schemaVersion: first.schemaVersion
  };

  assert.equal(
    deterministicPalworldPakBlockedCandidateManifestJson(reordered),
    deterministicPalworldPakBlockedCandidateManifestJson(first)
  );
});

test("blocked candidate staging은 allowlist된 JSON과 WebP의 bytes·hash·identity를 검증한다", async (context) => {
  const { stagingRoot, manifest } = await writeStagingFixture(context);
  const validated = await validatePalworldPakBlockedCandidateStagingRoot({
    stagingRoot,
    expectedCandidateId: CANDIDATE_ID
  });
  assert.deepEqual(validated, assertPalworldPakBlockedCandidateManifest(manifest));
});

test("blocked candidate staging은 allowlist 밖 파일과 JSON hash 변조를 차단한다", async (context) => {
  const allowlistFixture = await writeStagingFixture(context);
  await writeFile(path.join(allowlistFixture.stagingRoot, "unlisted.json"), "{}\n");
  await assert.rejects(
    validatePalworldPakBlockedCandidateStagingRoot({
      stagingRoot: allowlistFixture.stagingRoot,
      expectedCandidateId: CANDIDATE_ID
    }),
    /manifest allowlist와 실제 파일 집합/u
  );

  const hashFixture = await writeStagingFixture(context);
  await writeFile(hashFixture.artifactFile, fixtureArtifact(null, "candidate-bbbbbbbbbbbbbbbb"));
  await assert.rejects(
    validatePalworldPakBlockedCandidateStagingRoot({
      stagingRoot: hashFixture.stagingRoot,
      expectedCandidateId: CANDIDATE_ID
    }),
    /실제 bytes\/hash와 일치하지 않습니다/u
  );
});

test("blocked candidate staging은 checksum을 다시 맞춰도 domain unknown field를 거부한다", async (context) => {
  const fixture = await writeStagingFixture(context);
  const itemsPath = path.join(fixture.stagingRoot, "items.json");
  const items = JSON.parse(await readFile(itemsPath, "utf8"));
  items.unknown = true;
  const bytes = Buffer.from(`${JSON.stringify(items, null, 2)}\n`);
  await writeFile(itemsPath, bytes);
  const artifact = fixture.manifest.artifacts.find((entry) => entry.file === "items.json");
  artifact.sha256 = sha256(bytes);
  artifact.bytes = bytes.length;
  await writeFile(
    path.join(fixture.stagingRoot, PALWORLD_PAK_BLOCKED_CANDIDATE_MANIFEST_FILE),
    deterministicPalworldPakBlockedCandidateManifestJson(fixture.manifest)
  );
  await assert.rejects(
    validatePalworldPakBlockedCandidateStagingRoot({
      stagingRoot: fixture.stagingRoot,
      expectedCandidateId: CANDIDATE_ID
    }),
    /허용되지 않은 필드/u
  );
});

test("blocked candidate staging은 manifest checksum을 맞춰도 공식 locale 값 hash 변조를 차단한다", async (context) => {
  const localeRecord = {
    messageKey: "ITEM_NAME_Test",
    field: "item_name",
    text: "공식 이름",
    valueSha256: "f".repeat(64),
    status: "source_provided",
    sourceMember: "L10N/ko/Pal/DataTable/Text/DT_ItemNameText_Common.json",
    sourceMemberSha256: "e".repeat(64)
  };
  const fixture = await writeStagingFixture(context, { localeRecord });
  await assert.rejects(
    validatePalworldPakBlockedCandidateStagingRoot({
      stagingRoot: fixture.stagingRoot,
      expectedCandidateId: CANDIDATE_ID
    }),
    /공식 locale 값의 실제 SHA-256/u
  );
});

test("blocked candidate staging은 hash가 맞아도 WebP signature가 아닌 asset을 거부한다", async (context) => {
  const fakeWebp = Buffer.from("RIFF-not-a-WEBP-payload", "ascii");
  const { stagingRoot } = await writeStagingFixture(context, { assetBytes: fakeWebp });
  await assert.rejects(
    validatePalworldPakBlockedCandidateStagingRoot({
      stagingRoot,
      expectedCandidateId: CANDIDATE_ID
    }),
    (error) =>
      error instanceof PalworldPakRuntimeManifestError
      && /실제 WebP bytes\/hash와 일치하지 않습니다/u.test(error.message)
  );
});
