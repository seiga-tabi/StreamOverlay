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
import {
  loadPalworldOfficialLocaleRuntimeOverlay
} from "../data/palworld-official-locale-runtime.js";
import { loadPalworldReviewedItemAliases } from "../data/palworld-reviewed-item-aliases.js";
import { PalworldBreedingEngine } from "../services/palworld-breeding-engine.js";
import {
  PALWORLD_MAP_MARKER_ARTIFACT_FILE,
  PALWORLD_MAP_MARKER_MANIFEST_FILE,
  loadPalworldMapMarkerArtifact
} from "../data/palworld-map-marker-artifact.js";
import {
  loadPalworldMapMarkerCompatibilityAuthorization
} from "../data/palworld-map-marker-compatibility.js";
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
import {
  loadPalworldSpawnCompatibilityAuthorization
} from "../data/palworld-spawn-compatibility.js";
import {
  loadPalworldCondensationRules
} from "../data/palworld-condensation-artifact.js";
import {
  loadPalworldWorkImageManifest
} from "../data/palworld-work-image-manifest.js";
import {
  PALWORLD_MAP_LOCATIONS_ARTIFACT_FILE,
  PALWORLD_MAP_LOCATIONS_MANIFEST_FILE,
  createPalworldMapLocationsProvider,
  loadPalworldMapLocationsArtifact,
  loadPalworldMapLocationsCompatibilityAuthorization
} from "../data/palworld-map-locations-artifact.js";
import {
  loadPalworldMapLayerIconManifest
} from "../data/palworld-map-layer-icon-manifest.js";
import {
  PALWORLD_TECHNOLOGY_BUILDINGS
} from "../data/palworld-technology-buildings.generated.js";
import { inspectPalworldWebp } from "../data/palworld-image-import.js";

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

const LEGACY_MAP_LOCATION_FILES = [
  PALWORLD_MAP_LOCATIONS_ARTIFACT_FILE,
  PALWORLD_MAP_LOCATIONS_MANIFEST_FILE
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
      compositeSchemaVersion?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
      markerCompatibilityApprovalSha256?: string;
      spawnCompatibilityApprovalSha256?: string;
      mapLocationsCompatibilityApprovalSha256?: string;
      condensationRulesSha256?: string;
      mapLayerIconsManifestSha256?: string;
      workImagesManifestSha256?: string;
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
          ),
          compositeSchemaVersion: active.manifest.composite.schemaVersion,
          ...(active.manifest.composite.artifacts.find(
            (artifact) => artifact.kind === "map-markers-compatibility"
          )?.sha256 === undefined
            ? {}
            : {
                markerCompatibilityApprovalSha256:
                  active.manifest.composite.artifacts.find(
                    (artifact) =>
                      artifact.kind === "map-markers-compatibility"
                  )!.sha256
              }),
          ...(active.manifest.composite.artifacts.find(
            (artifact) => artifact.kind === "map-spawns-compatibility"
          )?.sha256 === undefined
            ? {}
            : {
                spawnCompatibilityApprovalSha256:
                  active.manifest.composite.artifacts.find(
                    (artifact) =>
                      artifact.kind === "map-spawns-compatibility"
                  )!.sha256
              }),
          ...(active.manifest.composite.artifacts.find(
            (artifact) => artifact.kind === "map-locations-compatibility"
          )?.sha256 === undefined
            ? {}
            : {
                mapLocationsCompatibilityApprovalSha256:
                  active.manifest.composite.artifacts.find(
                    (artifact) =>
                      artifact.kind === "map-locations-compatibility"
                  )!.sha256
              }),
          ...(active.manifest.composite.artifacts.find(
            (artifact) => artifact.kind === "condensation-rules"
          )?.sha256 === undefined
            ? {}
            : {
                condensationRulesSha256:
                  active.manifest.composite.artifacts.find(
                    (artifact) => artifact.kind === "condensation-rules"
                  )!.sha256
              }),
          ...(active.manifest.composite.artifacts.find(
            (artifact) => artifact.kind === "map-layer-icons-manifest"
          )?.sha256 === undefined
            ? {}
            : {
                mapLayerIconsManifestSha256:
                  active.manifest.composite.artifacts.find(
                    (artifact) =>
                      artifact.kind === "map-layer-icons-manifest"
                  )!.sha256
              }),
          ...(active.manifest.composite.artifacts.find(
            (artifact) => artifact.kind === "work-images-manifest"
          )?.sha256 === undefined
            ? {}
            : {
                workImagesManifestSha256:
                  active.manifest.composite.artifacts.find(
                    (artifact) => artifact.kind === "work-images-manifest"
                  )!.sha256
              })
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
  const expectedFilesByDirectory = new Map<string, Set<string>>();
  const expectedChildrenByDirectory = new Map<string, Set<string>>();
  for (const imageUrl of input.expectedUrls) {
    if (!imageUrl.startsWith(expectedPrefix)) {
      throw new Error("Palworld static asset URL의 release가 active release와 일치하지 않습니다.");
    }
    const relative = imageUrl.slice(expectedPrefix.length);
    const segments = relative.split("/");
    const isCatalogAsset = (
      segments.length !== 2
        ? false
        : [
        "pals",
        "items",
        "elements",
        "work",
        "skills",
        "maps",
        "map-icons"
      ].includes(segments[0]!)
    );
    const isTechnologyAsset = (
      segments.length === 4
      && segments[0] === "technology"
      && segments[1] === "assets"
      && segments[2] === "item"
    );
    const fileName = segments.at(-1);
    if (
      (!isCatalogAsset && !isTechnologyAsset)
      || fileName === undefined
      || !CONTENT_HASH_WEBP_PATTERN.test(fileName)
    ) {
      throw new Error("Palworld static asset URL이 허용된 content-hash 경로가 아닙니다.");
    }
    const directorySegments = segments.slice(0, -1);
    const directoryName = directorySegments.join("/");
    const names = expectedFilesByDirectory.get(directoryName) ?? new Set<string>();
    names.add(fileName);
    expectedFilesByDirectory.set(directoryName, names);
    for (let index = 0; index < directorySegments.length; index += 1) {
      const parent = directorySegments.slice(0, index).join("/");
      const children = expectedChildrenByDirectory.get(parent) ?? new Set<string>();
      children.add(directorySegments[index]!);
      expectedChildrenByDirectory.set(parent, children);
    }
  }
  await assertRuntimeDirectory(input.releaseStaticRoot, "Palworld release static asset");
  const rootEntries = expectedChildrenByDirectory.get("") ?? new Set<string>();
  await assertExactRuntimeFiles(input.releaseStaticRoot, [...rootEntries], "Palworld release static asset");
  const directories = new Set([
    ...expectedFilesByDirectory.keys(),
    ...[...expectedChildrenByDirectory.keys()].filter(Boolean)
  ]);
  for (const directoryName of directories) {
    const directory = path.join(input.releaseStaticRoot, directoryName);
    await assertRuntimeDirectory(directory, `Palworld ${directoryName} static asset`);
    const expectedNames = expectedFilesByDirectory.get(directoryName) ?? new Set<string>();
    const expectedChildren = expectedChildrenByDirectory.get(directoryName) ?? new Set<string>();
    await assertExactRuntimeFiles(
      directory,
      [...expectedChildren, ...expectedNames],
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
  const locationFilePresence = await Promise.all(
    LEGACY_MAP_LOCATION_FILES.map((file) =>
      pathExists(path.join(releaseRoot, file))
    )
  );
  if (markerFilePresence.some(Boolean) && !markerFilePresence.every(Boolean)) {
    throw new Error("Palworld marker artifact와 manifest는 함께 존재해야 합니다.");
  }
  if (spawnFilePresence.some(Boolean) && !spawnFilePresence.every(Boolean)) {
    throw new Error("Palworld spawn artifact와 manifest는 함께 존재해야 합니다.");
  }
  if (
    locationFilePresence.some(Boolean)
    && !locationFilePresence.every(Boolean)
  ) {
    throw new Error("Palworld 위치 artifact와 manifest는 함께 존재해야 합니다.");
  }
  const hasMapMarkers = markerFilePresence.every(Boolean);
  const hasMapSpawns = spawnFilePresence.every(Boolean);
  const hasMapLocations = locationFilePresence.every(Boolean);
  const compositeFiles = layout.compositeArtifactFiles;
  const runtimeReleaseFiles = compositeFiles === undefined
    ? [
        ...REQUIRED_LEGACY_RELEASE_FILES,
        ...(hasMapMarkers ? LEGACY_MAP_MARKER_FILES : []),
        ...(hasMapSpawns ? LEGACY_SPAWN_FILES : []),
        ...(hasMapLocations ? LEGACY_MAP_LOCATION_FILES : [])
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
  if ((layout.compositeSchemaVersion ?? 0) >= 7) {
    if (
      layout.condensationRulesSha256 === undefined
      || runtimeRelease.metadata.steamBuildId === undefined
    ) {
      throw new Error("농축 규칙 checksum 또는 active Steam Build ID가 없습니다.");
    }
    await loadPalworldCondensationRules({
      releaseRoot,
      expectedRelease: runtimeRelease.metadata.gameVersion,
      expectedSteamBuildId: runtimeRelease.metadata.steamBuildId,
      expectedSourceRevision: runtimeRelease.metadata.sourceRevision,
      expectedPaldexSha256: release.manifest.paldexSha256,
      expectedArtifactSha256: layout.condensationRulesSha256
    });
  }
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

  const officialLocaleOverlay = (layout.compositeSchemaVersion ?? 0) >= 4
    ? await loadPalworldOfficialLocaleRuntimeOverlay({
        releaseRoot,
        expectedRelease: runtimeRelease.metadata.gameVersion,
        expectedCatalogSha256: catalog.manifest.catalogSha256,
        expectedPaldexSha256: release.manifest.paldexSha256,
        expectedSourceRevision: catalog.catalog.metadata.sourceRevision
      })
    : undefined;
  const translations = await loadPalworldTranslationBundle({
    releaseRoot,
    context: createPalworldTranslationValidationContext({
      catalog: catalog.catalog,
      catalogSha256: catalog.manifest.catalogSha256,
      paldex: runtimeRelease,
      paldexSha256: release.manifest.paldexSha256,
      reviewedItemAliases: await loadPalworldReviewedItemAliases(releaseRoot, catalog.catalog),
      ...(officialLocaleOverlay === undefined
        ? {}
        : {
            officialSourceFields:
              officialLocaleOverlay.officialSourceFields
          })
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
  const workImagesManifest = layout.workImagesManifestSha256 === undefined
    ? undefined
    : await loadPalworldWorkImageManifest(releaseRoot, layout.release);
  const mapLayerIconsManifest =
    layout.mapLayerIconsManifestSha256 === undefined
      ? undefined
      : await loadPalworldMapLayerIconManifest(releaseRoot, layout.release);
  if (workImagesManifest !== undefined && staticDirectory === "public") {
    const mappingBytes = await readFile(
      path.join(
        repositoryRoot,
        "apps/server/src/data/palworld-pak-mappings/work-icon-map.json"
      )
    );
    if (
      createHash("sha256").update(mappingBytes).digest("hex")
      !== workImagesManifest.mappingSha256
    ) {
      throw new Error(
        "Palworld work image manifest의 mapping checksum이 검수 mapping과 일치하지 않습니다."
      );
    }
  }
  const expectedStaticUrls = new Set<string>([
    ...activeImages.flatMap((entry) => entry.imageUrl === null ? [] : [entry.imageUrl]),
    ...catalog.itemImagesManifest.entries.map((entry) => entry.imageUrl),
    ...catalog.elementImagesManifest.entries.map((entry) => entry.imageUrl),
    ...mapImagesManifest.entries.map((entry) => entry.imageUrl),
    ...(mapLayerIconsManifest?.entries.map((entry) => entry.imageUrl) ?? []),
    ...(workImagesManifest?.entries.map((entry) => entry.imageUrl) ?? []),
    ...PALWORLD_TECHNOLOGY_BUILDINGS.map((entry) => entry.imageUrl)
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
    if (
      bytes.length !== entry.outputBytes
      || bytes.length < 20
      || bytes.toString("ascii", 0, 4) !== "RIFF"
      || bytes.toString("ascii", 8, 12) !== "WEBP"
      || bytes.readUInt32LE(4) + 8 !== bytes.length
      || createHash("sha256").update(bytes).digest("hex")
        !== entry.outputSha256
    ) {
      throw new Error(
        "Palworld map image manifest와 실제 WebP hash·크기가 일치하지 않습니다."
      );
    }
  }
  for (const entry of workImagesManifest?.entries ?? []) {
    const bytes = await readFile(
      path.join(staticRoot, "work", entry.outputFileName)
    );
    if (bytes.length !== entry.outputBytes) {
      throw new Error(
        "Palworld work image manifest bytes와 실제 WebP 크기가 일치하지 않습니다."
      );
    }
  }
  for (const entry of mapLayerIconsManifest?.entries ?? []) {
    const bytes = await readFile(
      path.join(staticRoot, "map-icons", entry.outputFileName)
    );
    const inspection = inspectPalworldWebp(bytes);
    if (
      inspection.bytes !== entry.outputBytes
      || inspection.sha256 !== entry.outputSha256
      || inspection.width !== entry.outputWidth
      || inspection.height !== entry.outputHeight
    ) {
      throw new Error(
        "Palworld 지도 필터 아이콘 manifest bytes와 실제 WebP가 일치하지 않습니다."
      );
    }
  }
  let mainMapMarkers: Awaited<ReturnType<typeof loadPalworldMapMarkerArtifact>>["worlds"][number] | undefined;
  let treeMapMarkers: Awaited<ReturnType<typeof loadPalworldMapMarkerArtifact>>["worlds"][number] | undefined;
  if (hasMapMarkers) {
    try {
      const mapMarkers = await loadPalworldMapMarkerArtifact(releaseRoot);
      if (mapMarkers.activation === "candidate") {
        if (layout.markerCompatibilityApprovalSha256 === undefined) {
          throw new Error(
            "candidate 보스 marker는 active composite가 고정한 compatibility approval 없이는 runtime에 포함할 수 없습니다."
          );
        }
        await loadPalworldMapMarkerCompatibilityAuthorization({
          releaseRoot,
          artifact: mapMarkers,
          expectedApprovalSha256:
            layout.markerCompatibilityApprovalSha256
        });
      } else if (mapMarkers.activation !== "active") {
        throw new Error(
          "runtime bundle의 보스 marker artifact에는 active 상태 또는 검증된 compatibility approval이 필요합니다."
        );
      }
      mainMapMarkers = mapMarkers.worlds.find((world) => world.world === "main");
      if (!mainMapMarkers || mainMapMarkers.markers.length < 1) {
        throw new Error("MainMap 보스 marker runtime artifact가 비어 있습니다.");
      }
      treeMapMarkers = mapMarkers.worlds.find((world) => world.world === "tree");
      if (!treeMapMarkers || treeMapMarkers.markers.length < 1) {
        throw new Error("세계수 보스 marker runtime artifact가 비어 있습니다.");
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
      if (treeMapMarkers !== undefined) {
        const treeMapAsset = mapImagesManifest.entries.find(
          (entry) => entry.id === "tree"
        );
        if (
          treeMapAsset === undefined
          || treeMapAsset.outputSha256 !== treeMapMarkers.targetMapAssetSha256
        ) {
          throw new Error(
            "Palworld 세계수 marker와 composite map image manifest가 일치하지 않습니다."
          );
        }
      }
    } catch (error) {
      if (requireExactRuntimeDirectories) throw error;
      mainMapMarkers = undefined;
      treeMapMarkers = undefined;
    }
  }
  let mainMapSpawns: Awaited<ReturnType<typeof loadPalworldSpawnArtifact>>["worlds"][number] | undefined;
  if (hasMapSpawns) {
    try {
      const mapSpawns = await loadPalworldSpawnArtifact(releaseRoot);
      if (mapSpawns.activation === "candidate") {
        if (layout.spawnCompatibilityApprovalSha256 === undefined) {
          throw new Error(
            "candidate 일반 스폰은 active composite가 고정한 compatibility approval 없이는 runtime에 포함할 수 없습니다."
          );
        }
        await loadPalworldSpawnCompatibilityAuthorization({
          releaseRoot,
          artifact: mapSpawns,
          expectedApprovalSha256:
            layout.spawnCompatibilityApprovalSha256
        });
      } else if (mapSpawns.activation !== "active") {
        throw new Error(
          "runtime bundle의 일반 스폰 artifact에는 active 상태 또는 검증된 compatibility approval이 필요합니다."
        );
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
  let mainMapLocations:
    Awaited<ReturnType<typeof loadPalworldMapLocationsArtifact>>["worlds"][number]
    | undefined;
  let treeMapLocationCount = 0;
  if (hasMapLocations) {
    try {
      const mapLocations = await loadPalworldMapLocationsArtifact(releaseRoot);
      const compatibilityAuthorization =
        mapLocations.activation === "candidate"
          ? layout.mapLocationsCompatibilityApprovalSha256 === undefined
            ? undefined
            : await loadPalworldMapLocationsCompatibilityAuthorization({
                releaseRoot,
                artifact: mapLocations,
                expectedApprovalSha256:
                  layout.mapLocationsCompatibilityApprovalSha256
              })
          : undefined;
      if (
        mapLocations.activation === "candidate"
        && compatibilityAuthorization === undefined
      ) {
        throw new Error(
          "candidate 지도 위치는 active composite가 고정한 compatibility approval 없이는 runtime에 포함할 수 없습니다."
        );
      }
      const provider = createPalworldMapLocationsProvider({
        artifact: mapLocations,
        ...(compatibilityAuthorization === undefined
          ? {}
          : { compatibilityAuthorization })
      });
      mainMapLocations = mapLocations.worlds.find(
        (world) => world.world === "main"
      );
      const treeMapLocations = mapLocations.worlds.find(
        (world) => world.world === "tree"
      );
      if (
        !mainMapLocations
        || mainMapLocations.locations.length < 1
        || !treeMapLocations
        || treeMapLocations.locations.length < 1
        || provider.diagnostics().total !== mapLocations.totalLocations
      ) {
        throw new Error(
          "MainMap·세계수 지도 위치 runtime artifact가 비었거나 diagnostics count가 다릅니다."
        );
      }
      treeMapLocationCount = treeMapLocations.locations.length;
      if (
        mainMapMarkers
        && mainMapLocations.targetMapAssetSha256
          !== mainMapMarkers.targetMapAssetSha256
      ) {
        throw new Error(
          "지도 위치와 보스 marker의 MainMap asset hash가 일치하지 않습니다."
        );
      }
      if (
        mainMapSpawns
        && mainMapLocations.targetMapAssetSha256
          !== mainMapSpawns.targetMapAssetSha256
      ) {
        throw new Error(
          "지도 위치와 일반 스폰의 MainMap asset hash가 일치하지 않습니다."
        );
      }
      if (
        treeMapMarkers
        && treeMapLocations.targetMapAssetSha256
          !== treeMapMarkers.targetMapAssetSha256
      ) {
        throw new Error(
          "지도 위치와 보스 marker의 세계수 map asset hash가 일치하지 않습니다."
        );
      }
      if (
        !mapImagesManifest.entries.some((entry) =>
          entry.outputSha256 === mainMapLocations?.targetMapAssetSha256
        )
      ) {
        throw new Error(
          "지도 위치가 composite map image manifest 밖의 지도를 참조합니다."
        );
      }
      const treeMapAsset = mapImagesManifest.entries.find(
        (entry) => entry.id === "tree"
      );
      if (
        treeMapAsset === undefined
        || treeMapAsset.outputSha256
          !== treeMapLocations.targetMapAssetSha256
      ) {
        throw new Error(
          "세계수 지도 위치와 composite map image manifest의 tree asset이 일치하지 않습니다."
        );
      }
      const treeMapAssetPath = path.join(
        staticRoot,
        "maps",
        treeMapAsset.outputFileName
      );
      await assertRegularRuntimeFile(
        treeMapAssetPath,
        "Palworld 세계수 정적 WebP"
      );
      const treeMapAssetBytes = await readFile(treeMapAssetPath);
      const treeMapAssetSha256 = createHash("sha256")
        .update(treeMapAssetBytes)
        .digest("hex");
      if (
        treeMapAssetSha256 !== treeMapLocations.targetMapAssetSha256
        || treeMapAssetSha256 !== treeMapAsset.outputSha256
        || treeMapAssetBytes.length !== treeMapAsset.outputBytes
        || treeMapAssetBytes.length < 20
        || treeMapAssetBytes.toString("ascii", 0, 4) !== "RIFF"
        || treeMapAssetBytes.toString("ascii", 8, 12) !== "WEBP"
        || treeMapAssetBytes.readUInt32LE(4) + 8
          !== treeMapAssetBytes.length
      ) {
        throw new Error(
          "세계수 지도 위치가 참조하는 실제 WebP hash·크기가 일치하지 않습니다."
        );
      }
      const representativeIndexes = new Set([
        0,
        Math.floor(mainMapLocations.locations.length / 2),
        mainMapLocations.locations.length - 1
      ]);
      for (const index of representativeIndexes) {
        const location = mainMapLocations.locations[index];
        if (
          location === undefined
          || location.normalizedX < 0
          || location.normalizedX > 1
          || location.normalizedY < 0
          || location.normalizedY > 1
        ) {
          throw new Error(
            "지도 위치 대표 좌표가 정규화 범위를 벗어났습니다."
          );
        }
      }
    } catch (error) {
      if (requireExactRuntimeDirectories) throw error;
      mainMapLocations = undefined;
    }
  }

  console.log(
    `[palworld-data] legacy runtime artifact smoke 완료: release ${layout.release}, `
    + `${release.artifact.records.length}종, Pal 이미지 ${activeImages.length}개, `
    + `아이템 ${catalog.catalog.items.length}개, 스킬 ${catalog.catalog.skills.length}개, `
    + `지도 필터 아이콘 ${mapLayerIconsManifest?.entries.length ?? 0}개, `
    + `작업 적성 아이콘 ${workImagesManifest?.entries.length ?? 0}개, `
    + `교배 결과 ${breedingEngine.pairCount}개, `
    + `MainMap 보스 ${mainMapMarkers?.markers.length ?? 0}개, `
    + `Tree 보스 ${treeMapMarkers?.markers.length ?? 0}개, `
    + `일반 스폰 Pal ${mainMapSpawns?.pals.length ?? 0}종, `
    + `지도 위치 Main ${mainMapLocations?.locations.length ?? 0}개·`
    + `Tree ${treeMapLocationCount}개, `
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
    + "(?:pals|items|elements|work|skills|maps|map-icons)/[a-f0-9]{64}\\.webp$",
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
  for (const entry of PALWORLD_TECHNOLOGY_BUILDINGS) {
    expectedUrls.add(entry.imageUrl);
  }
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
          if (spawns.activation === "active") {
            optionalRuntimeFiles.push(...LEGACY_SPAWN_FILES);
          }
        } catch {
          // candidate 또는 손상된 spawn은 selector가 없는 legacy bundle에서 제외합니다.
        }
        try {
          const locations = await loadPalworldMapLocationsArtifact(
            layout.releaseRoot
          );
          if (locations.activation === "active") {
            optionalRuntimeFiles.push(...LEGACY_MAP_LOCATION_FILES);
          }
        } catch {
          // candidate 또는 손상된 위치 artifact는 legacy bundle에서 제외합니다.
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
