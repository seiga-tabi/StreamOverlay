import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

const {
  buildPalworldOfficialLocaleOverlay,
  serializePalworldOfficialLocaleOverlayArtifact,
} = await import("../dist/data/palworld-official-locale-overlay.js");
const {
  loadPalworldOfficialLocaleRuntimeOverlay,
} = await import("../dist/data/palworld-official-locale-runtime.js");
const {
  deterministicPalworldActiveRuntimeManifestJson,
  loadPalworldActiveRuntime,
} = await import("../dist/data/palworld-active-runtime.js");
const {
  loadPalworldCatalogDataSource,
} = await import("../dist/data/palworld-catalog-artifact.js");
const {
  createPalworldLegacyCompositeRuntimeManifest,
} = await import("../dist/data/palworld-legacy-composite-runtime.js");
const {
  loadPalworldPaldexRuntimeRelease,
} = await import("../dist/data/palworld-paldex-adapter.js");
const {
  createPalworldTranslationValidationContext,
  loadPalworldTranslationBundle,
} = await import("../dist/data/palworld-translation-artifact.js");
const {
  loadPalworldReviewedItemAliases,
} = await import("../dist/data/palworld-reviewed-item-aliases.js");
const {
  loadPalworldDataService,
} = await import("../dist/services/palworld-data.js");

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const activeReleaseRoot = path.join(serverRoot, "data", "palworld", "1.0.1");
const candidateRoot = path.join(
  serverRoot,
  "data",
  "palworld",
  "candidates",
  "candidate-1248184a4b527d94-delta-2108e7bd60291174",
);
const activeSkillMappingFile = path.join(
  serverRoot,
  "src",
  "data",
  "palworld-pak-mappings",
  "legacy-active-skill-locale-map.json",
);
const passiveSkillMappingFile = path.join(
  serverRoot,
  "src",
  "data",
  "palworld-pak-mappings",
  "legacy-passive-skill-locale-map.json",
);
const temporaryRoots = [];
let built;
let expected;

async function writeOverlayFiles(root) {
  await mkdir(path.join(root, "locales"), { recursive: true });
  await Promise.all([
    writeFile(
      path.join(root, "locales", "official-source-fields.json"),
      serializePalworldOfficialLocaleOverlayArtifact(built.officialSourceFields),
      "utf8",
    ),
    writeFile(
      path.join(root, "locales", "official-locale-compatibility.json"),
      serializePalworldOfficialLocaleOverlayArtifact(built.compatibility),
      "utf8",
    ),
    writeFile(
      path.join(root, "locales", "official-active-skill-evidence.json"),
      serializePalworldOfficialLocaleOverlayArtifact(built.activeSkillEvidence),
      "utf8",
    ),
    writeFile(
      path.join(root, "locales", "official-passive-skill-evidence.json"),
      serializePalworldOfficialLocaleOverlayArtifact(built.passiveSkillEvidence),
      "utf8",
    ),
    writeFile(
      path.join(root, "locales", "ko.json"),
      serializePalworldOfficialLocaleOverlayArtifact(built.snapshots.ko),
      "utf8",
    ),
    writeFile(
      path.join(root, "locales", "ja.json"),
      serializePalworldOfficialLocaleOverlayArtifact(built.snapshots.ja),
      "utf8",
    ),
    writeFile(
      path.join(root, "locales", "manifest.json"),
      serializePalworldOfficialLocaleOverlayArtifact(built.manifest),
      "utf8",
    ),
    cp(
      path.join(activeReleaseRoot, "locales", "glossary.json"),
      path.join(root, "locales", "glossary.json"),
    ),
  ]);
}

async function writeOverlayFixture() {
  const root = await realpath(
    await mkdtemp(path.join(await realpath(tmpdir()), "palworld-official-runtime-")),
  );
  temporaryRoots.push(root);
  await writeOverlayFiles(root);
  return root;
}

async function writeFullReleaseFixture() {
  const temporaryRoot = await realpath(
    await mkdtemp(path.join(await realpath(tmpdir()), "palworld-official-service-")),
  );
  temporaryRoots.push(temporaryRoot);
  const root = path.join(temporaryRoot, "release");
  await cp(activeReleaseRoot, root, { recursive: true });
  await writeOverlayFiles(root);
  return root;
}

async function writeActiveDataRootFixture() {
  const dataRoot = await realpath(
    await mkdtemp(path.join(await realpath(tmpdir()), "palworld-active-locale-")),
  );
  temporaryRoots.push(dataRoot);
  const releaseRoot = path.join(dataRoot, "1.0.1");
  await cp(activeReleaseRoot, releaseRoot, { recursive: true });
  await writeOverlayFiles(releaseRoot);
  const runtimeRoot = path.join(dataRoot, "runtime");
  await mkdir(runtimeRoot, { recursive: true });
  const composite = await createPalworldLegacyCompositeRuntimeManifest({
    releaseRoot,
    release: "1.0.1",
    workImages: "candidate",
  });
  const releaseManifestBytes = await readFile(
    path.join(releaseRoot, "manifest.json"),
  );
  const activeManifest = {
    schemaVersion: 2,
    format: "legacy_composite_v2",
    release: "1.0.1",
    releaseDirectory: "1.0.1",
    manifestFile: "manifest.json",
    manifestSha256: createHash("sha256")
      .update(releaseManifestBytes)
      .digest("hex"),
    composite,
  };
  await writeFile(
    path.join(runtimeRoot, "active-manifest.json"),
    deterministicPalworldActiveRuntimeManifestJson(activeManifest),
    "utf8",
  );
  return { dataRoot, releaseRoot };
}

before(async () => {
  built = await buildPalworldOfficialLocaleOverlay({
    activeReleaseRoot,
    candidateRoot,
    reviewedAt: "2026-07-25T00:00:00.000Z",
    reviewer: "operator-locale-review",
    evidenceChecksum: "1".repeat(64),
    activeSkillMappingFile,
    passiveSkillMappingFile,
  });
  expected = {
    expectedRelease: built.manifest.release,
    expectedCatalogSha256: built.manifest.sourceCatalogSha256,
    expectedPaldexSha256: built.manifest.sourcePaldexSha256,
    expectedSourceRevision: built.manifest.sourceRevision,
  };
});

after(async () => {
  await Promise.all(
    temporaryRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("legacy 공식 locale runtime은 독립 active/passive evidence와 output checksum을 검증한다", async () => {
  const root = await writeOverlayFixture();
  const overlay = await loadPalworldOfficialLocaleRuntimeOverlay({
    releaseRoot: root,
    ...expected,
  });
  assert.equal(overlay.officialSourceFields.length, 10_696);
  assert.equal(overlay.sourceArtifact.counts.byLocale.ko, 5_348);
  assert.equal(overlay.sourceArtifact.counts.byLocale.ja, 5_348);
  assert.equal(overlay.activeSkillEvidence?.counts.activeSkills, 217);
  assert.equal(overlay.passiveSkillEvidence?.counts.activePassiveSkills, 79);
  assert.equal(overlay.passiveSkillEvidence?.counts.compatibleDescriptions, 50);
  assert.equal(overlay.compatibility.candidateRuntimeActivationGranted, false);
  assert.equal(overlay.compatibility.rightsVerified, false);

  const [catalog, paldex] = await Promise.all([
    loadPalworldCatalogDataSource(activeReleaseRoot),
    loadPalworldPaldexRuntimeRelease({ releaseRoot: activeReleaseRoot }),
  ]);
  const translations = await loadPalworldTranslationBundle({
    releaseRoot: root,
    context: createPalworldTranslationValidationContext({
      catalog: catalog.catalog,
      catalogSha256: catalog.manifest.catalogSha256,
      paldex,
      paldexSha256: paldex.manifest.paldexSha256,
      reviewedItemAliases: await loadPalworldReviewedItemAliases(
        activeReleaseRoot,
        catalog.catalog,
      ),
      officialSourceFields: overlay.officialSourceFields,
    }),
  });
  assert.equal(translations.states.ko.status, "loaded");
  assert.equal(translations.states.ja.status, "loaded");
  assert.equal(
    translations.snapshots.ko.records.some((record) =>
      Object.values(record.fields).some(
        (field) => field?.status === "source_provided",
      )),
    true,
  );
});

test("공식 locale output 한 건의 bytes 변조도 compatibility checksum에서 fail-closed 처리한다", async () => {
  const root = await writeOverlayFixture();
  const koPath = path.join(root, "locales", "ko.json");
  const bytes = await readFile(koPath);
  await writeFile(koPath, Buffer.concat([bytes, Buffer.from(" ", "utf8")]));
  await assert.rejects(
    loadPalworldOfficialLocaleRuntimeOverlay({
      releaseRoot: root,
      ...expected,
    }),
    /checksum|일치/u,
  );
});

test("active catalog·Paldex·release identity가 다르면 공식 locale overlay를 거부한다", async () => {
  const root = await writeOverlayFixture();
  await assert.rejects(
    loadPalworldOfficialLocaleRuntimeOverlay({
      releaseRoot: root,
      ...expected,
      expectedCatalogSha256: "f".repeat(64),
    }),
    /catalog checksum|sourceCatalogSha256/u,
  );
  await assert.rejects(
    loadPalworldOfficialLocaleRuntimeOverlay({
      releaseRoot: root,
      ...expected,
      expectedRelease: "9.9.9",
    }),
    /release/u,
  );
});

test("legacy composite v5 service는 공식 KO/JA 이름을 source_provided 상태로 공개한다", async () => {
  const root = await writeFullReleaseFixture();
  const service = await loadPalworldDataService({
    activeRuntime: {
      manifest: {
        format: "legacy_composite_v2",
        release: "1.0.1",
        composite: { schemaVersion: 5 },
      },
      releaseRoot: root,
    },
  });
  const item = service.getItem("pal-sphere");
  assert.equal(item.nameKo, "팰 스피어");
  assert.equal(item.nameJa, "パルスフィア");
  assert.equal(item.translation.name.ko, "source_provided");
  assert.equal(item.translation.name.ja, "source_provided");
  const pal = service.getPal("anubis");
  assert.equal(pal.nameKo, "아누비스");
  assert.equal(pal.nameJa, "アヌビス");
  assert.equal(pal.translation.name.ko, "source_provided");
  const partnerSkill = service.getSkill("partner-anubis");
  assert.equal(partnerSkill.nameKo, "사막의 수호신");
  assert.equal(partnerSkill.nameJa, "砂漠の守護神");
  assert.equal(partnerSkill.translation.name.ja, "source_provided");
  const activeSkill = service.getSkill("active-absolute-frost-8b7feb098a");
  assert.equal(activeSkill.nameKo, "프로스트 아웃");
  assert.equal(activeSkill.nameJa, "フロストアウト");
  assert.equal(activeSkill.translation.name.ko, "source_provided");
  assert.equal(activeSkill.translation.description.ja, "source_provided");
  const passiveSkill = service.getSkill("passive-passive-alien-7fa1e23436");
  assert.equal(passiveSkill.nameKo, "미지의 생체세포");
  assert.equal(passiveSkill.nameJa, "未知の生体細胞");
  assert.equal(passiveSkill.translation.name.ko, "source_provided");
  assert.equal(passiveSkill.translation.description.ja, "source_provided");
  const versionMismatchPassive = service.getSkill(
    "passive-passive-legend-8ff382798f",
  );
  assert.equal(versionMismatchPassive.nameKo, "전설");
  assert.equal(versionMismatchPassive.nameJa, "伝説");
  assert.notEqual(
    versionMismatchPassive.translation.description.ko,
    "source_provided",
  );
});

test("공식 locale evidence 손상은 번역만 invalid로 격리하고 Pal·Item·Skill catalog는 유지한다", async () => {
  const root = await writeFullReleaseFixture();
  const compatibilityPath = path.join(
    root,
    "locales",
    "official-locale-compatibility.json",
  );
  const compatibilityBytes = await readFile(compatibilityPath);
  await writeFile(
    compatibilityPath,
    Buffer.concat([compatibilityBytes, Buffer.from(" ", "utf8")]),
  );
  const reported = [];
  const service = await loadPalworldDataService({
    activeRuntime: {
      manifest: {
        format: "legacy_composite_v2",
        release: "1.0.1",
        composite: { schemaVersion: 5 },
      },
      releaseRoot: root,
    },
    onTranslationState(locale, state) {
      reported.push({ locale, ...state });
    },
  });
  const meta = service.meta();
  assert.equal(meta.counts.pals, 287);
  assert.equal(meta.counts.items, 1_847);
  assert.equal(meta.counts.skills, 566);
  assert.deepEqual(
    reported.map(({ locale, status, errorCode, staleSourceHash }) => ({
      locale,
      status,
      errorCode,
      staleSourceHash,
    })),
    [
      {
        locale: "ko",
        status: "invalid",
        errorCode: "PALWORLD_TRANSLATION_MANIFEST_INVALID",
        staleSourceHash: true,
      },
      {
        locale: "ja",
        status: "invalid",
        errorCode: "PALWORLD_TRANSLATION_MANIFEST_INVALID",
        staleSourceHash: true,
      },
    ],
  );
  assert.equal(service.listItems({ page: 1, limit: 1 }).items.length, 1);
  assert.equal(service.listSkills({ page: 1, limit: 1 }).items.length, 1);
});

test("startup defer mode는 locale checksum 손상을 실제 loader→service 경계에서 격리한다", async () => {
  const { dataRoot, releaseRoot } = await writeActiveDataRootFixture();
  const koPath = path.join(releaseRoot, "locales", "ko.json");
  const koBytes = await readFile(koPath);
  await writeFile(koPath, Buffer.concat([koBytes, Buffer.from(" ", "utf8")]));

  await assert.rejects(
    loadPalworldActiveRuntime({ dataRoot }),
    /checksum|일치/u,
    "기본 loader와 Docker smoke 경로는 locale 손상도 strict하게 차단해야 합니다.",
  );

  const activeRuntime = await loadPalworldActiveRuntime({
    dataRoot,
    deferTranslationArtifactIntegrity: true,
  });
  const reported = [];
  const service = await loadPalworldDataService({
    activeRuntime,
    onTranslationState(locale, state) {
      reported.push({ locale, ...state });
    },
  });
  const meta = service.meta();
  assert.equal(meta.counts.pals, 287);
  assert.equal(meta.counts.items, 1_847);
  assert.equal(meta.counts.skills, 566);
  assert.deepEqual(
    reported.map(({ locale, status, errorCode, staleSourceHash }) => ({
      locale,
      status,
      errorCode,
      staleSourceHash,
    })),
    [
      {
        locale: "ko",
        status: "invalid",
        errorCode: "PALWORLD_TRANSLATION_MANIFEST_INVALID",
        staleSourceHash: true,
      },
      {
        locale: "ja",
        status: "invalid",
        errorCode: "PALWORLD_TRANSLATION_MANIFEST_INVALID",
        staleSourceHash: true,
      },
    ],
  );
});

test("startup defer mode는 locale artifact 누락도 실제 loader→service 경계에서 격리한다", async () => {
  const { dataRoot, releaseRoot } = await writeActiveDataRootFixture();
  await rm(path.join(releaseRoot, "locales", "official-source-fields.json"));

  await assert.rejects(
    loadPalworldActiveRuntime({ dataRoot }),
    /ENOENT|no such file/u,
    "기본 loader와 Docker smoke 경로는 locale 누락도 strict하게 차단해야 합니다.",
  );

  const activeRuntime = await loadPalworldActiveRuntime({
    dataRoot,
    deferTranslationArtifactIntegrity: true,
  });
  const reported = [];
  const service = await loadPalworldDataService({
    activeRuntime,
    onTranslationState(locale, state) {
      reported.push({ locale, ...state });
    },
  });
  const meta = service.meta();
  assert.equal(meta.counts.pals, 287);
  assert.equal(meta.counts.items, 1_847);
  assert.equal(meta.counts.skills, 566);
  assert.deepEqual(
    reported.map(({ locale, status, errorCode }) => ({
      locale,
      status,
      errorCode,
    })),
    [
      {
        locale: "ko",
        status: "invalid",
        errorCode: "PALWORLD_TRANSLATION_MANIFEST_INVALID",
      },
      {
        locale: "ja",
        status: "invalid",
        errorCode: "PALWORLD_TRANSLATION_MANIFEST_INVALID",
      },
    ],
  );
});

test("startup defer mode에서도 catalog와 Paldex checksum 손상은 active runtime 전체를 차단한다", async () => {
  for (const file of ["catalog.json", "paldex.json"]) {
    const { dataRoot, releaseRoot } = await writeActiveDataRootFixture();
    const artifactPath = path.join(releaseRoot, file);
    const bytes = await readFile(artifactPath);
    await writeFile(
      artifactPath,
      Buffer.concat([bytes, Buffer.from(" ", "utf8")]),
    );
    await assert.rejects(
      loadPalworldActiveRuntime({
        dataRoot,
        deferTranslationArtifactIntegrity: true,
      }),
      /checksum|일치/u,
      `${file} 손상은 번역 격리 대상이 아니어야 합니다.`,
    );
  }
});
