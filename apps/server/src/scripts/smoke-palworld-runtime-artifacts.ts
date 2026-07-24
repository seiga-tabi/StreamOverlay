import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  PALWORLD_ACTIVE_RUNTIME_FILE,
  loadPalworldActiveRuntime
} from "../data/palworld-active-runtime.js";
import { loadPalworldCatalogRuntimeSource } from "../data/palworld-catalog-artifact.js";
import { loadPalworldBreedingRuntimeSource } from "../data/palworld-breeding-artifact.js";
import { loadPalworldPaldexRuntimeRelease } from "../data/palworld-paldex-adapter.js";
import { loadPalworldPaldexStagedRelease } from "../data/palworld-paldex-loader.js";
import {
  PALWORLD_PAK_RUNTIME_MANIFEST_FILE,
  validatePalworldPakCandidateStagingRoot,
  type PalworldPakRuntimeManifest
} from "../data/palworld-pak-runtime-manifest.js";
import {
  createPalworldTranslationValidationContext,
  loadPalworldTranslationBundle
} from "../data/palworld-translation-artifact.js";
import { loadPalworldReviewedItemAliases } from "../data/palworld-reviewed-item-aliases.js";
import { PalworldBreedingEngine } from "../services/palworld-breeding-engine.js";
import {
  PALWORLD_MAP_MARKER_ARTIFACT_FILE,
  PALWORLD_MAP_MARKER_MANIFEST_FILE,
  loadPalworldMapMarkerArtifact
} from "../data/palworld-map-marker-artifact.js";
import {
  PALWORLD_MAP_IMAGE_MANIFEST_FILE,
  loadPalworldMapImageManifest
} from "../data/palworld-map-image-manifest.js";
import {
  PALWORLD_SPAWN_ARTIFACT_FILE,
  PALWORLD_SPAWN_MANIFEST_FILE,
  createPalworldSpawnProvider,
  loadPalworldSpawnArtifact
} from "../data/palworld-spawn-artifact.js";

const REQUIRED_LEGACY_RELEASE_FILES = [
  "sources.lock.json",
  "paldex.json",
  "manifest.json",
  "images-manifest.json",
  "image-use-policy.json",
  "catalog.json",
  "catalog-manifest.json",
  "item-images-manifest.json",
  "element-images-manifest.json",
  PALWORLD_MAP_IMAGE_MANIFEST_FILE,
  "breeding.json",
  "breeding-manifest.json",
] as const;

const LEGACY_MAP_MARKER_FILES = [
  PALWORLD_MAP_MARKER_ARTIFACT_FILE,
  PALWORLD_MAP_MARKER_MANIFEST_FILE
] as const;

const LEGACY_SPAWN_FILES = [
  PALWORLD_SPAWN_ARTIFACT_FILE,
  PALWORLD_SPAWN_MANIFEST_FILE
] as const;

const REQUIRED_TRANSLATION_RUNTIME_FILES = [
  "manifest.json",
  "glossary.json",
  "ko.json",
  "ja.json",
  "reviewed-item-aliases.json"
] as const;

const REQUIRED_LEGACY_MAPPING_FILES = [
  "public-id-map.json",
  "elements.json",
  "work-suitabilities.json",
  "exclusions.json",
  "image-overrides.json",
  "image-source-map.json"
] as const;

const CONTENT_HASH_WEBP_PATTERN = /^[a-f0-9]{64}\.webp$/u;
const FORBIDDEN_RUNTIME_FILE_PATTERN =
  /\.(?:zip|png|uasset|uexp|ubulk|usmap)$/iu;

export type PalworldRuntimeLayout =
  | {
      kind: "pak";
      release: string;
      releaseDirectory: string;
      releaseRoot: string;
      manifest: PalworldPakRuntimeManifest;
    }
  | {
      kind: "legacy";
      release: string;
      releaseDirectory: string;
      releaseRoot: string;
      compositeArtifactFiles?: readonly string[];
    };

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function assertRegularRuntimeFile(filePath: string, label: string): Promise<void> {
  const info = await lstat(filePath);
  if (info.isSymbolicLink() || !info.isFile()) {
    throw new Error(`${label}가 regular file이 아닙니다.`);
  }
}

async function assertRuntimeDirectory(directory: string, label: string): Promise<void> {
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error(`${label}가 directory가 아닙니다.`);
  }
}

async function assertExactRuntimeFiles(
  directory: string,
  expectedFiles: readonly string[],
  label: string
): Promise<void> {
  const actualFiles = (await readdir(directory)).sort();
  const expected = [...expectedFiles].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expected)) {
    throw new Error(`${label}에 manifest allowlist 밖의 파일이 포함되어 있습니다.`);
  }
}

export async function resolvePalworldRuntimeLayout(
  repositoryRoot: string
): Promise<PalworldRuntimeLayout> {
  const dataRoot = path.join(repositoryRoot, "apps/server/data/palworld");
  const active = await loadPalworldActiveRuntime({ dataRoot });
  if (active.manifest.releaseDirectory.split("/")[0] === "runtime") {
    throw new Error("active release directory는 runtime selector directory와 분리되어야 합니다.");
  }
  if (active.manifest.format === "operator_pak_v1") {
    const validated = await validatePalworldPakCandidateStagingRoot({
      stagingRoot: active.releaseRoot,
      expectedRelease: active.manifest.release,
      expectedGameVersion: active.manifest.release
    });
    return {
      kind: "pak",
      release: validated.manifest.release,
      releaseDirectory: active.manifest.releaseDirectory,
      releaseRoot: active.releaseRoot,
      manifest: validated.manifest
    };
  }
  return {
    kind: "legacy",
    release: active.manifest.release,
    releaseDirectory: active.manifest.releaseDirectory,
    releaseRoot: active.releaseRoot,
    ...(active.manifest.format === "legacy_composite_v2"
      ? {
          compositeArtifactFiles: active.manifest.composite.artifacts.map(
            (artifact) => artifact.file
          )
        }
      : {})
  };
}

export async function assertRepresentativeRuntimeImages(input: {
  imageRoot: string;
  activeImages: ReadonlyArray<{ outputFileName: string | null }>;
}): Promise<void> {
  if (input.activeImages.length === 0) return;
  const indexes = new Set([0, Math.floor(input.activeImages.length / 2), input.activeImages.length - 1]);
  await Promise.all([...indexes].map(async (index) => {
    const entry = input.activeImages[index];
    if (!entry?.outputFileName || !CONTENT_HASH_WEBP_PATTERN.test(entry.outputFileName)) {
      throw new Error("활성 이미지의 content-hash 파일명이 올바르지 않습니다.");
    }
    await assertRegularRuntimeFile(
      path.join(input.imageRoot, entry.outputFileName),
      `Palworld runtime image ${index + 1}`
    );
  }));
}

async function assertExactStaticAssetUrls(input: {
  releaseStaticRoot: string;
  release: string;
  expectedUrls: ReadonlySet<string>;
}): Promise<void> {
  const expectedPrefix = `/images/palworld/${input.release}/`;
  const expectedByDirectory = new Map<string, Set<string>>();
  for (const imageUrl of input.expectedUrls) {
    if (!imageUrl.startsWith(expectedPrefix)) {
      throw new Error("Palworld static asset URL의 release가 active release와 일치하지 않습니다.");
    }
    const relative = imageUrl.slice(expectedPrefix.length);
    const segments = relative.split("/");
    if (
      segments.length !== 2
      || !["pals", "items", "elements", "work", "skills", "maps"].includes(segments[0]!)
      || !CONTENT_HASH_WEBP_PATTERN.test(segments[1]!)
    ) {
      throw new Error("Palworld static asset URL이 허용된 content-hash 경로가 아닙니다.");
    }
    const names = expectedByDirectory.get(segments[0]!) ?? new Set<string>();
    names.add(segments[1]!);
    expectedByDirectory.set(segments[0]!, names);
  }
  await assertRuntimeDirectory(input.releaseStaticRoot, "Palworld release static asset");
  await assertExactRuntimeFiles(
    input.releaseStaticRoot,
    [...expectedByDirectory.keys()],
    "Palworld release static asset"
  );
  for (const [directoryName, expectedNames] of expectedByDirectory) {
    const directory = path.join(input.releaseStaticRoot, directoryName);
    await assertRuntimeDirectory(directory, `Palworld ${directoryName} static asset`);
    await assertExactRuntimeFiles(
      directory,
      [...expectedNames],
      `Palworld ${directoryName} static asset`
    );
    for (const fileName of expectedNames) {
      const filePath = path.join(directory, fileName);
      await assertRegularRuntimeFile(filePath, `Palworld ${directoryName}/${fileName}`);
      const bytes = await readFile(filePath);
      if (
        bytes.length < 20
        || bytes.subarray(0, 4).toString("ascii") !== "RIFF"
        || bytes.subarray(8, 12).toString("ascii") !== "WEBP"
        || createHash("sha256").update(bytes).digest("hex") !== fileName.slice(0, 64)
      ) {
        throw new Error(
          `Palworld ${directoryName}/${fileName} bytes가 content hash WebP와 일치하지 않습니다.`
        );
      }
    }
  }
}

async function assertNoRawRuntimeFiles(root: string): Promise<void> {
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) {
        throw new Error("Palworld runtime bundle에 symlink가 포함되어 있습니다.");
      }
      if (info.isDirectory()) {
        if (entry.name === "_imports" || entry.name === "candidate" || entry.name === "source-cache") {
          throw new Error("Palworld runtime bundle에 source/candidate directory가 포함되어 있습니다.");
        }
        await visit(absolute);
      } else if (!info.isFile()) {
        throw new Error("Palworld runtime bundle에는 regular file과 directory만 허용됩니다.");
      } else if (
        entry.name === "runtime-manifest.candidate.json"
        || FORBIDDEN_RUNTIME_FILE_PATTERN.test(entry.name)
      ) {
        throw new Error("Palworld runtime bundle에 raw source/candidate 파일이 포함되어 있습니다.");
      }
    }
  }
  await visit(root);
}

async function validateLegacyRuntime(
  repositoryRoot: string,
  layout: Extract<PalworldRuntimeLayout, { kind: "legacy" }>,
  staticDirectory: "dist" | "public",
  requireExactRuntimeDirectories: boolean
): Promise<void> {
  const releaseRoot = layout.releaseRoot;
  const translationRoot = path.join(releaseRoot, "locales");
  const mappingRoot = path.join(repositoryRoot, "apps/server/src/data/palworld-mappings");
  const staticRoot = path.join(
    repositoryRoot,
    `apps/dashboard/${staticDirectory}/images/palworld`,
    layout.release
  );
  const imageRoot = path.join(staticRoot, "pals");
  const itemImageRoot = path.join(staticRoot, "items");
  const elementImageRoot = path.join(staticRoot, "elements");
  const markerFilePresence = await Promise.all(
    LEGACY_MAP_MARKER_FILES.map((file) => pathExists(path.join(releaseRoot, file)))
  );
  const spawnFilePresence = await Promise.all(
    LEGACY_SPAWN_FILES.map((file) => pathExists(path.join(releaseRoot, file)))
  );
  if (markerFilePresence.some(Boolean) && !markerFilePresence.every(Boolean)) {
    throw new Error("Palworld marker artifact와 manifest는 함께 존재해야 합니다.");
  }
  if (spawnFilePresence.some(Boolean) && !spawnFilePresence.every(Boolean)) {
    throw new Error("Palworld spawn artifact와 manifest는 함께 존재해야 합니다.");
  }
  const hasMapMarkers = markerFilePresence.every(Boolean);
  const hasMapSpawns = spawnFilePresence.every(Boolean);
  const compositeFiles = layout.compositeArtifactFiles;
  const runtimeReleaseFiles = compositeFiles === undefined
    ? [
        ...REQUIRED_LEGACY_RELEASE_FILES,
        ...(hasMapMarkers ? LEGACY_MAP_MARKER_FILES : []),
        ...(hasMapSpawns ? LEGACY_SPAWN_FILES : [])
      ]
    : compositeFiles.filter((file) => !file.startsWith("locales/"));
  const runtimeTranslationFiles = compositeFiles === undefined
    ? [...REQUIRED_TRANSLATION_RUNTIME_FILES]
    : compositeFiles
        .filter((file) => file.startsWith("locales/"))
        .map((file) => file.slice("locales/".length));

  await Promise.all([
    assertRuntimeDirectory(translationRoot, "Palworld translation runtime"),
    ...runtimeReleaseFiles.map((fileName) =>
      assertRegularRuntimeFile(path.join(releaseRoot, fileName), `Palworld release ${fileName}`)
    ),
    ...runtimeTranslationFiles.map((fileName) =>
      assertRegularRuntimeFile(path.join(translationRoot, fileName), `Palworld translation ${fileName}`)
    ),
    ...REQUIRED_LEGACY_MAPPING_FILES.map((fileName) =>
      assertRegularRuntimeFile(path.join(mappingRoot, fileName), `Palworld mapping ${fileName}`)
    )
  ]);
  if (requireExactRuntimeDirectories) {
    await Promise.all([
      assertExactRuntimeFiles(
        releaseRoot,
        [...runtimeReleaseFiles, "locales"],
        "Palworld release"
      ),
      assertExactRuntimeFiles(translationRoot, runtimeTranslationFiles, "Palworld translation runtime"),
      assertExactRuntimeFiles(mappingRoot, REQUIRED_LEGACY_MAPPING_FILES, "Palworld mapping"),
      assertExactRuntimeFiles(
        path.join(repositoryRoot, `apps/dashboard/${staticDirectory}/images/palworld`),
        [layout.release],
        "Palworld static asset root"
      )
    ]);
  }

  const release = await loadPalworldPaldexStagedRelease({
    releaseRoot,
    mappingRoot,
    imageRoot,
    requireImportReport: !requireExactRuntimeDirectories
  });
  if (release.artifact.records.length !== release.manifest.counts.pals) {
    throw new Error("Pal artifact 수가 release manifest와 일치하지 않습니다.");
  }

  const activeImages = release.imagesManifest.entries.filter((entry) =>
    entry.status === "operator_acknowledged" || entry.status === "ready"
  );
  if (activeImages.length !== release.manifest.imageAssetGate.readyImages) {
    throw new Error("활성 이미지 수가 release manifest와 일치하지 않습니다.");
  }
  await assertRepresentativeRuntimeImages({ imageRoot, activeImages });

  const runtimeRelease = await loadPalworldPaldexRuntimeRelease({ releaseRoot, mappingRoot, imageRoot });
  const breedingSource = await loadPalworldBreedingRuntimeSource(releaseRoot, {
    requireImportReport: !requireExactRuntimeDirectories
  });
  const breedingEngine = new PalworldBreedingEngine(breedingSource.artifact);
  if (
    breedingSource.artifact.parameters.length !== breedingSource.manifest.counts.parameters
    || breedingSource.artifact.specialRules.length
      !== breedingSource.manifest.counts.includedSelfRules
        + breedingSource.manifest.counts.includedNonSelfRules
    || breedingEngine.pairCount < 1
  ) {
    throw new Error("교배 runtime artifact 수량 또는 reverse index가 manifest와 일치하지 않습니다.");
  }

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
  if (catalog.elementImagesManifest.entries.length !== catalog.catalog.elements.length) {
    throw new Error("속성 정의와 아이콘 수가 일치하지 않습니다.");
  }
  if (catalog.itemImagesManifest.entries.length !== catalog.catalog.coverage.itemImages) {
    throw new Error("아이템 이미지 수가 catalog coverage와 일치하지 않습니다.");
  }

  const translations = await loadPalworldTranslationBundle({
    releaseRoot,
    context: createPalworldTranslationValidationContext({
      catalog: catalog.catalog,
      catalogSha256: catalog.manifest.catalogSha256,
      paldex: runtimeRelease,
      paldexSha256: release.manifest.paldexSha256,
      reviewedItemAliases: await loadPalworldReviewedItemAliases(releaseRoot, catalog.catalog)
    })
  });
  if (
    translations.states.ko.status !== "loaded"
    || translations.states.ja.status !== "loaded"
    || translations.snapshots.ko === undefined
    || translations.snapshots.ja === undefined
  ) {
    throw new Error("한국어·일본어 번역 runtime artifact 검증에 실패했습니다.");
  }
  const mapImagesManifest = await loadPalworldMapImageManifest(
    releaseRoot,
    layout.release
  );
  const expectedStaticUrls = new Set<string>([
    ...activeImages.flatMap((entry) => entry.imageUrl === null ? [] : [entry.imageUrl]),
    ...catalog.itemImagesManifest.entries.map((entry) => entry.imageUrl),
    ...catalog.elementImagesManifest.entries.map((entry) => entry.imageUrl),
    ...mapImagesManifest.entries.map((entry) => entry.imageUrl)
  ]);
  await assertExactStaticAssetUrls({
    releaseStaticRoot: staticRoot,
    release: layout.release,
    expectedUrls: expectedStaticUrls
  });
  for (const entry of mapImagesManifest.entries) {
    const bytes = await readFile(
      path.join(staticRoot, "maps", entry.outputFileName)
    );
    if (bytes.length !== entry.outputBytes) {
      throw new Error("Palworld map image manifest bytes와 실제 WebP 크기가 일치하지 않습니다.");
    }
  }
  let mainMapMarkers: Awaited<ReturnType<typeof loadPalworldMapMarkerArtifact>>["worlds"][number] | undefined;
  if (hasMapMarkers) {
    try {
      const mapMarkers = await loadPalworldMapMarkerArtifact(releaseRoot);
      mainMapMarkers = mapMarkers.worlds.find((world) => world.world === "main");
      if (!mainMapMarkers || mainMapMarkers.markers.length < 1) {
        throw new Error("MainMap 보스 marker runtime artifact가 비어 있습니다.");
      }
      const mapAssetPath = path.join(
        staticRoot,
        "maps",
        `${mainMapMarkers.targetMapAssetSha256}.webp`
      );
      if (
        !mapImagesManifest.entries.some((entry) =>
          entry.outputSha256 === mainMapMarkers?.targetMapAssetSha256
        )
      ) {
        throw new Error("Palworld marker가 composite map image manifest 밖의 지도를 참조합니다.");
      }
      await assertRegularRuntimeFile(mapAssetPath, "Palworld MainMap 정적 WebP");
      const mapAssetBytes = await readFile(mapAssetPath);
      if (
        createHash("sha256").update(mapAssetBytes).digest("hex")
          !== mainMapMarkers.targetMapAssetSha256
      ) {
        throw new Error("Palworld MainMap marker가 참조하는 정적 WebP hash가 일치하지 않습니다.");
      }
    } catch (error) {
      if (requireExactRuntimeDirectories) throw error;
      mainMapMarkers = undefined;
    }
  }
  let mainMapSpawns: Awaited<ReturnType<typeof loadPalworldSpawnArtifact>>["worlds"][number] | undefined;
  if (hasMapSpawns) {
    try {
      const mapSpawns = await loadPalworldSpawnArtifact(releaseRoot);
      if (mapSpawns.activation !== "active") {
        throw new Error("runtime bundle의 일반 스폰 artifact는 activation=active여야 합니다.");
      }
      mainMapSpawns = mapSpawns.worlds.find((world) => world.world === "main");
      if (
        !mainMapSpawns
        || mainMapSpawns.pals.length < 1
        || mainMapSpawns.pals.every((pal) => pal.points.length === 0)
      ) {
        throw new Error("MainMap 일반 스폰 runtime artifact가 비어 있습니다.");
      }
      if (
        mainMapMarkers
        && mainMapSpawns.targetMapAssetSha256 !== mainMapMarkers.targetMapAssetSha256
      ) {
        throw new Error("일반 스폰과 보스 marker의 MainMap asset hash가 일치하지 않습니다.");
      }
      for (const pal of mainMapSpawns.pals) {
        if (runtimeRelease.sourceInternalIds[pal.palId] !== pal.sourceInternalId) {
          throw new Error(
            "일반 스폰 Pal ID와 sourceInternalId가 active Paldex exact join과 일치하지 않습니다."
          );
        }
      }
    } catch (error) {
      if (requireExactRuntimeDirectories) throw error;
      mainMapSpawns = undefined;
    }
  }

  console.log(
    `[palworld-data] legacy runtime artifact smoke 완료: release ${layout.release}, `
    + `${release.artifact.records.length}종, Pal 이미지 ${activeImages.length}개, `
    + `아이템 ${catalog.catalog.items.length}개, 스킬 ${catalog.catalog.skills.length}개, `
    + `교배 결과 ${breedingEngine.pairCount}개, MainMap 보스 ${mainMapMarkers?.markers.length ?? 0}개, `
    + `일반 스폰 Pal ${mainMapSpawns?.pals.length ?? 0}종, `
    + `fallback ${release.manifest.imageAssetGate.fallbackPals}개`
  );
}

async function collectManifestImageUrls(
  releaseRoot: string,
  manifest: PalworldPakRuntimeManifest
): Promise<Set<string>> {
  const urls = new Set<string>();
  const expectedPrefix = `/images/palworld/${manifest.release}/`;
  const imagePattern = new RegExp(
    `^/images/palworld/${manifest.release.replaceAll(".", "\\.")}/`
    + "(?:pals|items|elements|work|skills|maps)/[a-f0-9]{64}\\.webp$",
    "u"
  );
  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      if (value.startsWith("/images/palworld/")) {
        if (!value.startsWith(expectedPrefix) || !imagePattern.test(value)) {
          throw new Error("active manifest artifact에 안전하지 않은 Palworld image URL이 있습니다.");
        }
        urls.add(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const nested of value) visit(nested);
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const nested of Object.values(value as Record<string, unknown>)) visit(nested);
    }
  };
  for (const artifact of manifest.artifacts) {
    const value = JSON.parse(
      await readFile(path.join(releaseRoot, ...artifact.file.split("/")), "utf8")
    ) as unknown;
    visit(value);
  }
  return urls;
}

async function assertPakRuntimeStaticAssets(
  repositoryRoot: string,
  staticDirectory: "dist" | "public",
  layout: Extract<PalworldRuntimeLayout, { kind: "pak" }>
): Promise<void> {
  const expectedUrls = await collectManifestImageUrls(layout.releaseRoot, layout.manifest);
  const palworldRoot = path.join(
    repositoryRoot,
    `apps/dashboard/${staticDirectory}/images/palworld`
  );
  if (expectedUrls.size === 0) {
    if (await pathExists(palworldRoot) && (await readdir(palworldRoot)).length !== 0) {
      throw new Error("active manifest에 없는 Palworld static asset이 포함되어 있습니다.");
    }
    return;
  }
  await assertExactRuntimeFiles(palworldRoot, [layout.release], "Palworld static asset root");
  await assertExactStaticAssetUrls({
    releaseStaticRoot: path.join(palworldRoot, layout.release),
    release: layout.release,
    expectedUrls
  });
}

export async function preparePalworldRuntimeBundle(input: {
  repositoryRoot: string;
  outputRoot: string;
}): Promise<{ kind: PalworldRuntimeLayout["kind"]; release: string }> {
  const repositoryRoot = path.resolve(input.repositoryRoot);
  const outputRoot = path.resolve(input.outputRoot);
  if (await pathExists(outputRoot)) {
    throw new Error("Palworld runtime bundle output은 기존 경로를 덮어쓸 수 없습니다.");
  }
  const outputParent = path.dirname(outputRoot);
  await mkdir(outputParent, { recursive: true });
  const canonicalParent = await realpath(outputParent);
  const staging = await mkdtemp(path.join(canonicalParent, ".palworld-runtime-"));
  try {
    const layout = await resolvePalworldRuntimeLayout(repositoryRoot);
    if (layout.kind === "legacy") {
      await validateLegacyRuntime(repositoryRoot, layout, "public", false);
    } else {
      await assertPakRuntimeStaticAssets(repositoryRoot, "public", layout);
    }

    const dataTarget = path.join(staging, "apps/server/data/palworld");
    const mappingTarget = path.join(
      staging,
      "apps/server/src/data/palworld-mappings"
    );
    await Promise.all([
      mkdir(dataTarget, { recursive: true }),
      mkdir(mappingTarget, { recursive: true })
    ]);
    const activeTargetRoot = path.join(dataTarget, "runtime");
    await mkdir(activeTargetRoot, { recursive: true });
    await copyFile(
      path.join(
        repositoryRoot,
        "apps/server/data/palworld/runtime",
        PALWORLD_ACTIVE_RUNTIME_FILE
      ),
      path.join(activeTargetRoot, PALWORLD_ACTIVE_RUNTIME_FILE)
    );

    if (layout.kind === "pak") {
      const runtimeTarget = path.join(
        dataTarget,
        ...layout.releaseDirectory.split("/")
      );
      await mkdir(runtimeTarget, { recursive: true });
      for (const file of [
        PALWORLD_PAK_RUNTIME_MANIFEST_FILE,
        ...layout.manifest.artifacts.map((artifact) => artifact.file)
      ]) {
        const target = path.join(runtimeTarget, ...file.split("/"));
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(path.join(layout.releaseRoot, ...file.split("/")), target);
      }
      await validatePalworldPakCandidateStagingRoot({ stagingRoot: runtimeTarget });
    } else {
      const releaseTarget = path.join(
        dataTarget,
        ...layout.releaseDirectory.split("/")
      );
      const translationTarget = path.join(releaseTarget, "locales");
      await mkdir(translationTarget, { recursive: true });
      const optionalRuntimeFiles: string[] = [];
      if (layout.compositeArtifactFiles === undefined) {
        try {
          await loadPalworldMapMarkerArtifact(layout.releaseRoot);
          optionalRuntimeFiles.push(...LEGACY_MAP_MARKER_FILES);
        } catch {
          // source provenance gate를 통과하지 못한 marker는 runtime bundle에서 제외합니다.
        }
        try {
          const spawns = await loadPalworldSpawnArtifact(layout.releaseRoot);
          if (spawns.activation === "active") optionalRuntimeFiles.push(...LEGACY_SPAWN_FILES);
        } catch {
          // candidate 또는 손상된 spawn은 runtime bundle에서 제외합니다.
        }
      }
      const releaseFiles = layout.compositeArtifactFiles === undefined
        ? [...REQUIRED_LEGACY_RELEASE_FILES, ...optionalRuntimeFiles]
        : layout.compositeArtifactFiles.filter((file) => !file.startsWith("locales/"));
      const translationFiles = layout.compositeArtifactFiles === undefined
        ? [...REQUIRED_TRANSLATION_RUNTIME_FILES]
        : layout.compositeArtifactFiles
            .filter((file) => file.startsWith("locales/"))
            .map((file) => file.slice("locales/".length));
      await Promise.all([
        ...releaseFiles.map((file) =>
          copyFile(path.join(layout.releaseRoot, file), path.join(releaseTarget, file))
        ),
        ...translationFiles.map((file) =>
          copyFile(path.join(layout.releaseRoot, "locales", file), path.join(translationTarget, file))
        ),
        ...REQUIRED_LEGACY_MAPPING_FILES.map((file) =>
          copyFile(
            path.join(repositoryRoot, "apps/server/src/data/palworld-mappings", file),
            path.join(mappingTarget, file)
          )
        )
      ]);
    }
    await loadPalworldActiveRuntime({ dataRoot: dataTarget });
    await assertNoRawRuntimeFiles(staging);
    await rename(staging, outputRoot);
    return { kind: layout.kind, release: layout.release };
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

async function assertPackagedActiveReleasePath(
  dataRoot: string,
  releaseDirectory: string
): Promise<void> {
  const segments = releaseDirectory.split("/");
  if (segments[0] === "runtime") {
    throw new Error("active release directory는 runtime selector directory와 분리되어야 합니다.");
  }
  let current = dataRoot;
  for (const [index, segment] of segments.entries()) {
    await assertExactRuntimeFiles(
      current,
      index === 0 ? ["runtime", segment!] : [segment!],
      "Palworld active release 경로"
    );
    current = path.join(current, segment!);
    await assertRuntimeDirectory(current, "Palworld active release 경로");
  }
  await assertExactRuntimeFiles(
    path.join(dataRoot, "runtime"),
    [PALWORLD_ACTIVE_RUNTIME_FILE],
    "Palworld active runtime selector"
  );
}

export async function smokePalworldRuntimeArtifacts(options: {
  repositoryRoot?: string;
} = {}): Promise<void> {
  const repositoryRoot = options.repositoryRoot
    ?? fileURLToPath(new URL("../../../../", import.meta.url));
  const layout = await resolvePalworldRuntimeLayout(repositoryRoot);
  const dataRoot = path.join(repositoryRoot, "apps/server/data/palworld");
  const mappingRoot = path.join(repositoryRoot, "apps/server/src/data/palworld-mappings");
  await assertPackagedActiveReleasePath(dataRoot, layout.releaseDirectory);

  if (layout.kind === "pak") {
    await assertRuntimeDirectory(mappingRoot, "Palworld runtime mapping root");
    await assertExactRuntimeFiles(mappingRoot, [], "Palworld runtime mapping root");
    await assertPakRuntimeStaticAssets(repositoryRoot, "dist", layout);
    if (
      layout.manifest.artifacts.some((artifact) => artifact.kind === "map-spawns")
    ) {
      const mapSpawns = await loadPalworldSpawnArtifact(layout.releaseRoot);
      if (mapSpawns.activation !== "active") {
        throw new Error(
          "active manifest의 일반 스폰 artifact는 activation=active여야 합니다."
        );
      }
      const mainMapSpawns = mapSpawns.worlds.find((world) => world.world === "main");
      if (
        !mainMapSpawns
        || mainMapSpawns.pals.length < 1
        || mainMapSpawns.pals.every((pal) => pal.points.length === 0)
      ) {
        throw new Error("operator PAK MainMap 일반 스폰 runtime artifact가 비어 있습니다.");
      }
      const { loadPalworldPakShadowRuntimeFromStagingRoot } = await import(
        "../data/palworld-pak-shadow-runtime.js"
      );
      const shadowRuntime = await loadPalworldPakShadowRuntimeFromStagingRoot({
        stagingRoot: layout.releaseRoot
      });
      createPalworldSpawnProvider({
        artifact: mapSpawns,
        palworldDataService: shadowRuntime.service
      });
    }
    console.log(
      `[palworld-data] active manifest runtime smoke 완료: release ${layout.release}, `
      + `artifact ${layout.manifest.artifacts.length}개`
    );
  } else {
    await validateLegacyRuntime(repositoryRoot, layout, "dist", true);
  }
  await assertNoRawRuntimeFiles(dataRoot);
}

const isDirectExecution = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 0) {
      await smokePalworldRuntimeArtifacts();
    } else if (args.length === 2 && args[0] === "--prepare-runtime-bundle") {
      await preparePalworldRuntimeBundle({
        repositoryRoot: fileURLToPath(new URL("../../../../", import.meta.url)),
        outputRoot: args[1]!
      });
    } else {
      throw new Error("사용법: smoke-palworld-runtime-artifacts [--prepare-runtime-bundle <output>]");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 검증 오류";
    console.error(`[palworld-data] runtime artifact smoke 실패: ${message}`);
    process.exitCode = 1;
  }
}
