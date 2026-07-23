import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const {
  PALWORLD_PAK_RUNTIME_DOMAINS,
  PALWORLD_PAK_RUNTIME_MANIFEST_FILE,
  assertPalworldPakRuntimeManifest,
  assertPalworldPakRuntimeRelativeFile,
  deterministicPalworldPakRuntimeManifestJson,
  validatePalworldPakCandidateStagingRoot
} = await import("../dist/data/palworld-pak-runtime-manifest.js");

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const CANDIDATE_ID = `candidate-${SHA_A.slice(0, 16)}`;

function coverage(available, missing, total) {
  return { available, missing, total };
}

function baseManifest() {
  return {
    schemaVersion: 1,
    release: "2.0.0",
    gameVersion: "2.0.0",
    steamBuildId: "30000000",
    source: {
      type: "operator_pak_export",
      archiveSha256: SHA_A,
      importRevision: "operator-pak-2.0.0-r1",
      license: "RIGHTS_NOT_INDEPENDENTLY_VERIFIED",
      usageBasis: "operator_reference_use",
      rightsVerified: false
    },
    activation: {
      pals: "candidate",
      items: "blocked",
      skills: "blocked",
      breeding: "blocked",
      localizationKo: "blocked",
      localizationJa: "blocked",
      localizationEn: "blocked",
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
      skills: 1,
      breedingResults: 3,
      specialBreedingRules: 1
    },
    coverage: {
      pals: coverage(2, 0, 2),
      items: coverage(1, 0, 1),
      skills: coverage(1, 0, 1),
      breeding: coverage(3, 0, 3),
      localizationKo: coverage(0, 4, 4),
      localizationJa: coverage(0, 4, 4),
      localizationEn: coverage(0, 4, 4),
      palImages: coverage(1, 1, 2),
      itemImages: coverage(0, 1, 1),
      elementImages: coverage(0, 9, 9),
      workImages: coverage(0, 12, 12),
      skillImages: coverage(0, 1, 1),
      map: coverage(0, 1, 1)
    },
    artifacts: [
      {
        kind: "paldex",
        file: "paldex.json",
        sha256: SHA_A,
        bytes: 2
      },
      {
        kind: "import-report",
        file: "reports/import-report.json",
        sha256: SHA_B,
        bytes: 2
      }
    ]
  };
}

test("PAK runtime candidate manifest는 exact schema와 안전한 provenance를 검증한다", () => {
  const manifest = assertPalworldPakRuntimeManifest(baseManifest());
  assert.equal(manifest.release, "2.0.0");
  assert.equal(manifest.gameVersion, manifest.release);
  assert.equal(manifest.source.type, "operator_pak_export");
  assert.equal(manifest.source.rightsVerified, false);
  assert.equal(manifest.source.usageBasis, "operator_reference_use");
  assert.deepEqual(Object.keys(manifest.activation), [...PALWORLD_PAK_RUNTIME_DOMAINS]);
  assert.deepEqual(manifest.artifacts.map((artifact) => artifact.kind), ["import-report", "paldex"]);

  for (const mutate of [
    (value) => { value.unknown = true; },
    (value) => { value.source.unknown = true; },
    (value) => { value.activation.unknown = "blocked"; },
    (value) => { value.counts.unknown = 0; },
    (value) => { value.coverage.pals.unknown = 0; },
    (value) => { value.artifacts[0].unknown = true; }
  ]) {
    const invalid = structuredClone(baseManifest());
    mutate(invalid);
    assert.throws(
      () => assertPalworldPakRuntimeManifest(invalid),
      /허용되지 않은 필드/u
    );
  }
});

test("PAK runtime candidate manifest는 release·Steam build·checksum·권리 상태를 엄격히 검증한다", () => {
  for (const [mutate, pattern] of [
    [(value) => { value.gameVersion = "2.0.1"; }, /release와 정확히 일치/u],
    [(value) => { value.release = "latest"; }, /major\.minor\.patch/u],
    [(value) => { value.steamBuildId = "030000000"; }, /0으로 시작하지 않는/u],
    [(value) => { value.source.archiveSha256 = "A".repeat(64); }, /SHA-256/u],
    [(value) => { value.source.importRevision = "/operator/pak"; }, /revision 식별자/u],
    [(value) => { value.source.type = "atlas"; }, /operator_pak_export/u],
    [(value) => { value.source.rightsVerified = true; }, /비독립 권리 확인/u],
    [(value) => { value.source.usageBasis = "rights_verified"; }, /비독립 권리 확인/u]
  ]) {
    const invalid = structuredClone(baseManifest());
    mutate(invalid);
    assert.throws(() => assertPalworldPakRuntimeManifest(invalid), pattern);
  }
});

test("PAK runtime artifact 경로는 traversal·absolute·backslash·percent 우회를 거부한다", () => {
  assert.equal(assertPalworldPakRuntimeRelativeFile("locales/ko.json"), "locales/ko.json");
  for (const candidate of [
    "../paldex.json",
    "/paldex.json",
    "locales\\ko.json",
    "locales/%2e%2e/paldex.json",
    "locales//ko.json",
    "./paldex.json",
    ".hidden/paldex.json",
    PALWORLD_PAK_RUNTIME_MANIFEST_FILE
  ]) {
    assert.throws(
      () => assertPalworldPakRuntimeRelativeFile(candidate),
      /안전한 상대 JSON 경로|dot segment/u
    );
  }
});

test("PAK runtime manifest는 coverage·activation·artifact allowlist 불변식을 검증한다", () => {
  const badCoverage = structuredClone(baseManifest());
  badCoverage.coverage.pals.missing = 1;
  assert.throws(
    () => assertPalworldPakRuntimeManifest(badCoverage),
    /available과 missing의 합/u
  );

  const badTotal = structuredClone(baseManifest());
  badTotal.coverage.itemImages.total = 2;
  badTotal.coverage.itemImages.missing = 2;
  assert.throws(
    () => assertPalworldPakRuntimeManifest(badTotal),
    /manifest\.counts 기준/u
  );

  const incompleteReady = structuredClone(baseManifest());
  incompleteReady.activation.palImages = "ready";
  incompleteReady.artifacts.push({
    kind: "pal-images-manifest",
    file: "images/pals.json",
    sha256: "c".repeat(64),
    bytes: 2
  });
  assert.throws(
    () => assertPalworldPakRuntimeManifest(incompleteReady),
    /coverage 누락/u
  );

  const missingCandidateArtifact = structuredClone(baseManifest());
  missingCandidateArtifact.activation.items = "candidate";
  assert.throws(
    () => assertPalworldPakRuntimeManifest(missingCandidateArtifact),
    /items 또는 catalog artifact/u
  );

  const unknownKind = structuredClone(baseManifest());
  unknownKind.artifacts[0].kind = "raw-pak";
  assert.throws(
    () => assertPalworldPakRuntimeManifest(unknownKind),
    /allowlist에 없는/u
  );

  const duplicateKind = structuredClone(baseManifest());
  duplicateKind.artifacts.push({
    kind: "paldex",
    file: "other-paldex.json",
    sha256: "c".repeat(64),
    bytes: 2
  });
  assert.throws(
    () => assertPalworldPakRuntimeManifest(duplicateKind),
    /artifact kind가 중복/u
  );
});

test("PAK runtime manifest 직렬화는 입력 key와 artifact 순서와 무관하게 결정적이다", () => {
  const first = baseManifest();
  const second = {
    artifacts: [...first.artifacts].reverse().map((artifact) => ({
      bytes: artifact.bytes,
      sha256: artifact.sha256,
      file: artifact.file,
      kind: artifact.kind
    })),
    coverage: Object.fromEntries(
      Object.entries(first.coverage).reverse().map(([key, value]) => [
        key,
        { total: value.total, missing: value.missing, available: value.available }
      ])
    ),
    counts: {
      specialBreedingRules: first.counts.specialBreedingRules,
      breedingResults: first.counts.breedingResults,
      skills: first.counts.skills,
      items: first.counts.items,
      pals: first.counts.pals
    },
    activation: Object.fromEntries(Object.entries(first.activation).reverse()),
    source: {
      rightsVerified: false,
      usageBasis: "operator_reference_use",
      license: "RIGHTS_NOT_INDEPENDENTLY_VERIFIED",
      importRevision: first.source.importRevision,
      archiveSha256: first.source.archiveSha256,
      type: "operator_pak_export"
    },
    steamBuildId: first.steamBuildId,
    gameVersion: first.gameVersion,
    release: first.release,
    schemaVersion: 1
  };
  assert.equal(
    deterministicPalworldPakRuntimeManifestJson(first),
    deterministicPalworldPakRuntimeManifestJson(second)
  );
});

function candidateCommon() {
  return {
    schemaVersion: 1,
    candidateId: CANDIDATE_ID,
    release: "2.0.0",
    metadata: {
      candidateId: CANDIDATE_ID,
      sourceType: "operator_pak_export",
      release: "2.0.0",
      gameVersion: "2.0.0",
      steamBuildId: "30000000",
      fmodelVersion: "1.0.0",
      exportedAt: "2026-07-23T00:00:00.000Z",
      mappingsSha256: SHA_C
    },
    provenance: {
      id: `operator_pak_export:${SHA_A.slice(0, 16)}`,
      type: "operator_pak_export",
      archiveSha256: SHA_A,
      gameVersion: "2.0.0",
      steamBuildId: "30000000",
      fmodelVersion: "1.0.0",
      exportedAt: "2026-07-23T00:00:00.000Z",
      mappingsSha256: SHA_C,
      rightsVerified: false,
      usageBasis: "operator_reference_use"
    }
  };
}

function runtimeArtifact(kind) {
  const common = candidateCommon();
  if (kind === "paldex") {
    return {
      ...common,
      records: [],
      exclusions: []
    };
  }
  if (kind === "items") {
    return {
      ...common,
      records: []
    };
  }
  if (kind === "skills") {
    return {
      ...common,
      records: [],
      assignments: [],
      excludedEggAssignments: []
    };
  }
  if (kind === "breeding") {
    return {
      ...common,
      parameters: [],
      specialRules: [],
      duplicateSourceRows: [],
      unresolvedSourceRows: [],
      computedResultCount: 0
    };
  }
  if (kind === "locale-ko" || kind === "locale-ja" || kind === "locale-en") {
    return {
      ...common,
      locale: kind.slice("locale-".length),
      status: "missing",
      sourceArchiveSha256: SHA_A,
      languageVerified: false,
      records: [],
      coverage: {
        inputRows: 0,
        includedRows: 0,
        placeholderRows: 0,
        invalidRows: 0,
        duplicateMessageKeys: 0
      }
    };
  }
  if (kind === "map-manifest") {
    return {
      ...common,
      status: "blocked",
      variants: []
    };
  }
  if (kind === "import-report") {
    return {
      ...common,
      status: "blocked_candidate",
      activationEligible: false,
      blockers: ["ITEM_ICON_EXPORT_INCOMPLETE"],
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
  }
  return {
    ...common,
    kind
  };
}

function artifactBytes(kind, overrides = {}) {
  return Buffer.from(`${JSON.stringify({
    ...runtimeArtifact(kind),
    ...overrides
  })}\n`);
}

function withArtifactChecksums(manifest, files) {
  const next = structuredClone(manifest);
  next.artifacts = next.artifacts.map((artifact) => {
    const bytes = files.get(artifact.file);
    assert.ok(bytes);
    return {
      ...artifact,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length
    };
  });
  return next;
}

async function createValidStagingRoot() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "palworld-pak-runtime-"));
  const files = new Map([
    ["paldex.json", artifactBytes("paldex")],
    ["reports/import-report.json", artifactBytes("import-report")]
  ]);
  const manifest = withArtifactChecksums(baseManifest(), files);
  for (const [file, bytes] of files) {
    const absolute = path.join(root, ...file.split("/"));
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes);
  }
  await writeFile(
    path.join(root, PALWORLD_PAK_RUNTIME_MANIFEST_FILE),
    deterministicPalworldPakRuntimeManifestJson(manifest)
  );
  return { root, manifest, files };
}

test("candidate staging root는 exact file set·크기·checksum·release identity를 검증한다", async () => {
  const fixture = await createValidStagingRoot();
  try {
    const result = await validatePalworldPakCandidateStagingRoot({
      stagingRoot: fixture.root,
      expectedRelease: "2.0.0",
      expectedGameVersion: "2.0.0",
      expectedSteamBuildId: "30000000"
    });
    assert.equal(result.verifiedArtifacts.length, 2);
    assert.equal(result.manifest.source.type, "operator_pak_export");

    await writeFile(path.join(fixture.root, "paldex.json"), artifactBytes("changed"));
    await assert.rejects(
      validatePalworldPakCandidateStagingRoot({ stagingRoot: fixture.root }),
      /파일 크기|checksum/u
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("candidate staging root는 unlisted file·symlink·비결정적 manifest를 거부한다", async () => {
  const extraFixture = await createValidStagingRoot();
  try {
    await writeFile(path.join(extraFixture.root, "raw-source.json"), "{}");
    await assert.rejects(
      validatePalworldPakCandidateStagingRoot({ stagingRoot: extraFixture.root }),
      /allowlist와 실제 파일 집합/u
    );
  } finally {
    await rm(extraFixture.root, { recursive: true, force: true });
  }

  const symlinkFixture = await createValidStagingRoot();
  try {
    await rm(path.join(symlinkFixture.root, "paldex.json"));
    await symlink(
      path.join(symlinkFixture.root, "reports/import-report.json"),
      path.join(symlinkFixture.root, "paldex.json")
    );
    await assert.rejects(
      validatePalworldPakCandidateStagingRoot({ stagingRoot: symlinkFixture.root }),
      /symlink/u
    );
  } finally {
    await rm(symlinkFixture.root, { recursive: true, force: true });
  }

  const nonDeterministicFixture = await createValidStagingRoot();
  try {
    const manifestPath = path.join(
      nonDeterministicFixture.root,
      PALWORLD_PAK_RUNTIME_MANIFEST_FILE
    );
    const parsed = JSON.parse(await readFile(manifestPath, "utf8"));
    await writeFile(manifestPath, JSON.stringify(parsed));
    await assert.rejects(
      validatePalworldPakCandidateStagingRoot({ stagingRoot: nonDeterministicFixture.root }),
      /결정적 직렬화/u
    );
  } finally {
    await rm(nonDeterministicFixture.root, { recursive: true, force: true });
  }
});

test("candidate staging root는 artifact의 release·gameVersion·Steam build ID 불일치를 거부한다", async () => {
  for (const [overrides, pattern] of [
    [{ release: "2.0.1" }, /artifact\.paldex\.release/u],
    [{ metadata: { gameVersion: "2.0.1", steamBuildId: "30000000" } }, /gameVersion/u],
    [{ metadata: { gameVersion: "2.0.0", steamBuildId: "30000001" } }, /Steam build ID/u]
  ]) {
    const fixture = await createValidStagingRoot();
    try {
      const bytes = artifactBytes("paldex", overrides);
      const files = new Map(fixture.files);
      files.set("paldex.json", bytes);
      const manifest = withArtifactChecksums(baseManifest(), files);
      await writeFile(path.join(fixture.root, "paldex.json"), bytes);
      await writeFile(
        path.join(fixture.root, PALWORLD_PAK_RUNTIME_MANIFEST_FILE),
        deterministicPalworldPakRuntimeManifestJson(manifest)
      );
      await assert.rejects(
        validatePalworldPakCandidateStagingRoot({ stagingRoot: fixture.root }),
        pattern
      );
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});

test("candidate staging root는 artifact kind별 exact schema와 discriminator를 검증한다", async () => {
  const unknownFieldFixture = await createValidStagingRoot();
  try {
    const bytes = artifactBytes("paldex", { unknown: true });
    const files = new Map(unknownFieldFixture.files);
    files.set("paldex.json", bytes);
    const manifest = withArtifactChecksums(baseManifest(), files);
    await writeFile(path.join(unknownFieldFixture.root, "paldex.json"), bytes);
    await writeFile(
      path.join(unknownFieldFixture.root, PALWORLD_PAK_RUNTIME_MANIFEST_FILE),
      deterministicPalworldPakRuntimeManifestJson(manifest)
    );
    await assert.rejects(
      validatePalworldPakCandidateStagingRoot({ stagingRoot: unknownFieldFixture.root }),
      /artifact\.paldex.*허용되지 않은 필드/u
    );
  } finally {
    await rm(unknownFieldFixture.root, { recursive: true, force: true });
  }

  const wrongKindFixture = await createValidStagingRoot();
  try {
    const bytes = artifactBytes("import-report");
    const files = new Map(wrongKindFixture.files);
    files.set("paldex.json", bytes);
    const manifest = withArtifactChecksums(baseManifest(), files);
    await writeFile(path.join(wrongKindFixture.root, "paldex.json"), bytes);
    await writeFile(
      path.join(wrongKindFixture.root, PALWORLD_PAK_RUNTIME_MANIFEST_FILE),
      deterministicPalworldPakRuntimeManifestJson(manifest)
    );
    await assert.rejects(
      validatePalworldPakCandidateStagingRoot({ stagingRoot: wrongKindFixture.root }),
      /artifact\.paldex.*paldex\.status.*허용되지 않은 필드/u
    );
  } finally {
    await rm(wrongKindFixture.root, { recursive: true, force: true });
  }
});

test("candidate staging root는 지원되는 모든 artifact kind를 전용 validator로 dispatch한다", async () => {
  for (const [kind, file] of [
    ["items", "items.json"],
    ["skills", "skills.json"],
    ["breeding", "breeding.json"],
    ["locale-ko", "locales/ko.json"],
    ["locale-ja", "locales/ja.json"],
    ["locale-en", "locales/en.json"],
    ["map-manifest", "map-manifest.json"]
  ]) {
    const fixture = await createValidStagingRoot();
    try {
      const bytes = artifactBytes(kind);
      const files = new Map(fixture.files);
      files.set(file, bytes);
      const manifestInput = baseManifest();
      manifestInput.artifacts.push({
        kind,
        file,
        sha256: SHA_C,
        bytes: 2
      });
      const manifest = withArtifactChecksums(manifestInput, files);
      const absolute = path.join(fixture.root, ...file.split("/"));
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, bytes);
      await writeFile(
        path.join(fixture.root, PALWORLD_PAK_RUNTIME_MANIFEST_FILE),
        deterministicPalworldPakRuntimeManifestJson(manifest)
      );
      const result = await validatePalworldPakCandidateStagingRoot({
        stagingRoot: fixture.root
      });
      assert.ok(result.verifiedArtifacts.some((artifact) => artifact.kind === kind));
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});

test("candidate staging root는 신규 exact schema가 없는 legacy kind를 fail-closed한다", async () => {
  for (const [kind, file] of [
    ["catalog", "catalog.json"],
    ["pal-images-manifest", "images/pals.json"],
    ["item-images-manifest", "images/items.json"],
    ["element-images-manifest", "images/elements.json"],
    ["work-images-manifest", "images/work.json"],
    ["skill-images-manifest", "images/skills.json"]
  ]) {
    const fixture = await createValidStagingRoot();
    try {
      const bytes = artifactBytes(kind);
      const files = new Map(fixture.files);
      files.set(file, bytes);
      const manifestInput = baseManifest();
      manifestInput.artifacts.push({
        kind,
        file,
        sha256: SHA_C,
        bytes: 2
      });
      const manifest = withArtifactChecksums(manifestInput, files);
      const absolute = path.join(fixture.root, ...file.split("/"));
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, bytes);
      await writeFile(
        path.join(fixture.root, PALWORLD_PAK_RUNTIME_MANIFEST_FILE),
        deterministicPalworldPakRuntimeManifestJson(manifest)
      );
      await assert.rejects(
        validatePalworldPakCandidateStagingRoot({ stagingRoot: fixture.root }),
        new RegExp(`artifact\\.${kind}.*exact validator.*활성화할 수 없습니다`, "u")
      );
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});
