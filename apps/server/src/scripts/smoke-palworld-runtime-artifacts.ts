import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPalworldCatalogRuntimeSource } from "../data/palworld-catalog-artifact.js";
import { PALWORLD_PALDEX_EXPECTED_COUNT } from "../data/palworld-paldex-artifact.js";
import { loadPalworldPaldexStagedRelease } from "../data/palworld-paldex-loader.js";

const REQUIRED_RELEASE_FILES = [
  "sources.lock.json",
  "paldex.json",
  "manifest.json",
  "images-manifest.json",
  "import-report.json",
  "image-use-policy.json",
  "catalog.json",
  "catalog-manifest.json",
  "item-images-manifest.json",
  "element-images-manifest.json"
] as const;

const EXPECTED_ATLAS_ARCHIVE_SHA256 = "8869d768d80d24e8443e6a82a3be338a092b4a656d77d6938a5265c3e2a164bb";
const EXPECTED_PYPAL_ARCHIVE_SHA256 = "42676bdc3ecb6820e31fe8f18c875ba7ac226de5de78ddf966a92808709d5115";
const EXPECTED_ATLAS_STEAM_BUILD_ID = "24181105";
const EXPECTED_PYPAL_REVISION = "db70ea654aea70c4b1a4b0045bccfe58164cf01a";
const EXPECTED_PYPAL_GAME_DATA_VERSION = "1.0.1.100619";

const REQUIRED_MAPPING_FILES = [
  "public-id-map.json",
  "elements.json",
  "work-suitabilities.json",
  "exclusions.json",
  "image-overrides.json",
  "image-source-map.json"
] as const;

async function assertRegularRuntimeFile(filePath: string, label: string): Promise<void> {
  const info = await lstat(filePath);
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new Error(`${label}가 regular file이 아닙니다.`);
  }
}

async function assertExactRuntimeFiles(directory: string, expectedFiles: readonly string[], label: string): Promise<void> {
  const actualFiles = (await readdir(directory)).sort();
  const expected = [...expectedFiles].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expected)) {
    throw new Error(`${label}에 런타임 불필요 파일이 포함되어 있습니다.`);
  }
}

export async function assertRepresentativeRuntimeImages(input: {
  imageRoot: string;
  activeImages: ReadonlyArray<{ outputFileName: string | null }>;
}): Promise<void> {
  if (input.activeImages.length === 0) return;
  const indexes = new Set([0, Math.floor(input.activeImages.length / 2), input.activeImages.length - 1]);
  await Promise.all([...indexes].map(async (index) => {
    const entry = input.activeImages[index];
    if (!entry?.outputFileName || !/^[a-f0-9]{64}\.webp$/u.test(entry.outputFileName)) {
      throw new Error("활성 이미지의 content-hash 파일명이 올바르지 않습니다.");
    }
    await assertRegularRuntimeFile(
      path.join(input.imageRoot, entry.outputFileName),
      `Palworld runtime image ${index + 1}`
    );
  }));
}

export async function smokePalworldRuntimeArtifacts(options: {
  repositoryRoot?: string;
} = {}): Promise<void> {
  const repositoryRoot = options.repositoryRoot ?? fileURLToPath(new URL("../../../../", import.meta.url));
  const releaseRoot = path.join(repositoryRoot, "apps/server/data/palworld/1.0.1");
  const mappingRoot = path.join(repositoryRoot, "apps/server/src/data/palworld-mappings");
  const imageRoot = path.join(repositoryRoot, "apps/dashboard/dist/images/palworld/1.0.1/pals");
  const itemImageRoot = path.join(repositoryRoot, "apps/dashboard/dist/images/palworld/1.0.1/items");
  const elementImageRoot = path.join(repositoryRoot, "apps/dashboard/dist/images/palworld/1.0.1/elements");

  await Promise.all([
    ...REQUIRED_RELEASE_FILES.map((fileName) =>
      assertRegularRuntimeFile(path.join(releaseRoot, fileName), `Palworld release ${fileName}`)
    ),
    ...REQUIRED_MAPPING_FILES.map((fileName) =>
      assertRegularRuntimeFile(path.join(mappingRoot, fileName), `Palworld mapping ${fileName}`)
    )
  ]);
  await Promise.all([
    assertExactRuntimeFiles(releaseRoot, REQUIRED_RELEASE_FILES, "Palworld release"),
    assertExactRuntimeFiles(mappingRoot, REQUIRED_MAPPING_FILES, "Palworld mapping")
  ]);

  const release = await loadPalworldPaldexStagedRelease({ releaseRoot, mappingRoot, imageRoot });
  if (release.artifact.records.length !== PALWORLD_PALDEX_EXPECTED_COUNT) {
    throw new Error(`Pal artifact 수가 ${PALWORLD_PALDEX_EXPECTED_COUNT}개가 아닙니다.`);
  }

  const activeImages = release.imagesManifest.entries.filter((entry) =>
    entry.status === "operator_acknowledged" || entry.status === "ready"
  );
  if (activeImages.length !== release.manifest.imageAssetGate.readyImages) {
    throw new Error("활성 이미지 수가 release manifest와 일치하지 않습니다.");
  }
  await assertRepresentativeRuntimeImages({ imageRoot, activeImages });

  const catalog = await loadPalworldCatalogRuntimeSource(releaseRoot, {
    itemImageRoot,
    elementImageRoot
  });
  const expectedSkillCount = catalog.catalog.coverage.activeSkills
    + catalog.catalog.coverage.partnerSkills
    + catalog.catalog.coverage.passiveSkills;
  if (catalog.catalog.skills.length !== expectedSkillCount) {
    throw new Error("스킬 수가 catalog coverage와 일치하지 않습니다.");
  }
  if (catalog.catalog.items.length !== catalog.catalog.coverage.runtimeItems) {
    throw new Error("아이템 수가 catalog coverage와 일치하지 않습니다.");
  }
  if (catalog.catalog.elements.length !== 9 || catalog.elementImagesManifest.entries.length !== 9) {
    throw new Error("속성 정의와 아이콘은 각각 9개여야 합니다.");
  }
  if (catalog.itemImagesManifest.entries.length !== catalog.catalog.coverage.itemImages) {
    throw new Error("아이템 이미지 수가 catalog coverage와 일치하지 않습니다.");
  }
  if (
    catalog.catalog.provenance.atlasArchiveSha256 !== EXPECTED_ATLAS_ARCHIVE_SHA256
    || catalog.catalog.provenance.pyPalArchiveSha256 !== EXPECTED_PYPAL_ARCHIVE_SHA256
    || catalog.catalog.provenance.atlasSteamBuildId !== EXPECTED_ATLAS_STEAM_BUILD_ID
    || catalog.catalog.provenance.pyPalRevision !== EXPECTED_PYPAL_REVISION
    || catalog.catalog.provenance.pyPalGameDataVersion !== EXPECTED_PYPAL_GAME_DATA_VERSION
  ) {
    throw new Error("고정 Palworld source provenance와 일치하지 않습니다.");
  }

  console.log(
    `[palworld-data] runtime artifact smoke 완료: ${release.artifact.records.length}종, `
    + `Pal 이미지 ${activeImages.length}개, 아이템 ${catalog.catalog.items.length}개, `
    + `스킬 ${catalog.catalog.skills.length}개, 속성 아이콘 ${catalog.catalog.elements.length}개, `
    + `fallback ${release.manifest.imageAssetGate.fallbackPals}개`
  );
}

const isDirectExecution = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  try {
    await smokePalworldRuntimeArtifacts();
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 검증 오류";
    console.error(`[palworld-data] runtime artifact smoke 실패: ${message}`);
    process.exitCode = 1;
  }
}
