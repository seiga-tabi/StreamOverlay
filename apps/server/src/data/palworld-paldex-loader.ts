import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PALWORLD_PALDEX_EXPECTED_COUNT,
  PalworldPaldexValidationError,
  assertPalworldImagesManifest,
  assertPalworldPaldexArtifact,
  assertPalworldPaldexReleaseManifest,
  type PalworldImagesManifest,
  type PalworldPaldexArtifact,
  type PalworldPaldexReleaseManifest
} from "./palworld-paldex-artifact.js";
import { validatePalworldImageFiles } from "./palworld-image-import.js";
import {
  PALWORLD_PALDEX_IMAGE_ROOT,
  PALWORLD_PALDEX_MAPPING_ROOT,
  PALWORLD_PALDEX_RELEASE_ROOT,
  assertPalworldPaldexSourceLock,
  sha256Bytes,
  type PalworldPaldexSourceLock
} from "./palworld-paldex-import.js";

export type PalworldPaldexStagedRelease = {
  artifact: PalworldPaldexArtifact;
  imagesManifest: PalworldImagesManifest;
  manifest: PalworldPaldexReleaseManifest;
  dataIntegrityReady: boolean;
  imageAssetsReady: boolean;
  releaseReady: boolean;
};

async function readJsonWithBytes(filePath: string): Promise<{ bytes: Buffer; value: unknown }> {
  const bytes = await readFile(filePath);
  return { bytes, value: JSON.parse(bytes.toString("utf8")) as unknown };
}

export function assertPalworldImageRightsGate(input: {
  sourceLock: PalworldPaldexSourceLock;
  imagesManifest: PalworldImagesManifest;
  manifest: PalworldPaldexReleaseManifest;
}): void {
  if (input.sourceLock.imageRightsReview.status !== "blocked_by_license") return;
  const expectedEvidenceUrls = input.sourceLock.imageRightsReview.evidence.map((evidence) => evidence.url);
  const candidateFileBaseUrl = `${input.sourceLock.imageRightsReview.candidateDirectoryUrl.replace("/tree/", "/blob/")}/`;
  const rightsGateWasBypassed = input.imagesManifest.status !== "blocked_by_license"
    || input.imagesManifest.rightsReview.status !== "blocked_by_license"
    || input.imagesManifest.rightsReview.reasonCode !== input.sourceLock.imageRightsReview.reasonCode
    || JSON.stringify(input.imagesManifest.rightsReview.evidenceUrls) !== JSON.stringify(expectedEvidenceUrls)
    || input.imagesManifest.entries.some((entry) =>
      entry.status !== "blocked_by_license"
      || entry.sourceName !== input.sourceLock.imageRightsReview.candidateSourceName
      || entry.sourceRevision !== input.sourceLock.imageRightsReview.candidateSourceRevision
      || entry.license !== input.sourceLock.imageRightsReview.license
      || !entry.sourceUrl.startsWith(candidateFileBaseUrl)
    )
    || input.manifest.imageAssetGate.passed
    || input.manifest.imageAssetGate.status !== "blocked_by_license";
  if (rightsGateWasBypassed) {
    throw new PalworldPaldexValidationError("검증되지 않은 이미지 권리 상태로 image asset gate를 통과할 수 없습니다.");
  }
}

function assertManifestCounts(input: {
  artifact: PalworldPaldexArtifact;
  imagesManifest: PalworldImagesManifest;
  manifest: PalworldPaldexReleaseManifest;
  readyImages: number;
  uniqueImageFiles: number;
}): void {
  const normal = input.artifact.records.filter((pal) => pal.variantType === "normal").length;
  const variant = input.artifact.records.length - normal;
  const expected = {
    pals: input.artifact.records.length,
    normal,
    variant,
    imageMappings: input.imagesManifest.entries.length,
    readyImages: input.readyImages,
    uniqueImageFiles: input.uniqueImageFiles
  };
  for (const [field, value] of Object.entries(expected)) {
    if (input.manifest.counts[field as keyof typeof expected] !== value) {
      throw new PalworldPaldexValidationError(`manifest.counts.${field}: 실제 artifact와 일치하지 않습니다.`);
    }
  }
  if (expected.pals !== PALWORLD_PALDEX_EXPECTED_COUNT) throw new PalworldPaldexValidationError("최종 Pal 수가 287개가 아닙니다.");
}

function assertGateCoverage(input: {
  artifact: PalworldPaldexArtifact;
  manifest: PalworldPaldexReleaseManifest;
  readyImages: number;
}): void {
  const records = input.artifact.records;
  const expectedChecks: PalworldPaldexReleaseManifest["dataIntegrityGate"]["checks"] = {
    pals: records.length,
    normal: records.filter((pal) => pal.variantType === "normal").length,
    variant: records.filter((pal) => pal.variantType === "variant").length,
    missingNameKo: records.filter((pal) => pal.nameKo.trim().length === 0).length,
    missingNameJa: records.filter((pal) => pal.nameJa.trim().length === 0).length,
    missingNameEn: records.filter((pal) => pal.nameEn.trim().length === 0).length,
    missingRequiredStats: records.filter((pal) =>
      ![pal.stats.hp, pal.stats.attack, pal.stats.defense, pal.stats.moveSpeed, pal.stats.stamina].every(Number.isInteger)
    ).length,
    missingBreedingPower: records.filter((pal) => !Number.isInteger(pal.breedingPower)).length,
    unknownEnums: 0,
    idCollisions: records.length - new Set(records.map((pal) => pal.id)).size,
    aliasCollisions: 0,
    sourceChecksumVerified: true,
    mappingChecksumsVerified: true,
    artifactChecksumsVerified: true
  };
  for (const [field, expected] of Object.entries(expectedChecks)) {
    if (input.manifest.dataIntegrityGate.checks[field as keyof typeof expectedChecks] !== expected) {
      throw new PalworldPaldexValidationError(`manifest.dataIntegrityGate.checks.${field}: 실제 검증 결과와 일치하지 않습니다.`);
    }
  }
  const fallbackPals = records.length - input.readyImages;
  if (input.manifest.imageAssetGate.readyImages !== input.readyImages) {
    throw new PalworldPaldexValidationError("manifest.imageAssetGate.readyImages: 실제 이미지 수와 일치하지 않습니다.");
  }
  if (input.manifest.imageAssetGate.fallbackPals !== fallbackPals) {
    throw new PalworldPaldexValidationError("manifest.imageAssetGate.fallbackPals: 실제 fallback 수와 일치하지 않습니다.");
  }
}

export async function loadPalworldPaldexStagedRelease(options: {
  releaseRoot?: string;
  imageRoot?: string;
  mappingRoot?: string;
  requireReleaseReady?: boolean;
} = {}): Promise<PalworldPaldexStagedRelease> {
  const releaseRoot = options.releaseRoot ?? PALWORLD_PALDEX_RELEASE_ROOT;
  const imageRoot = options.imageRoot ?? PALWORLD_PALDEX_IMAGE_ROOT;
  const mappingRoot = options.mappingRoot ?? PALWORLD_PALDEX_MAPPING_ROOT;
  const [
    sourceLockFile,
    paldexFile,
    imagesFile,
    reportFile,
    manifestFile,
    publicIdMapFile,
    elementsFile,
    workSuitabilitiesFile,
    exclusionsFile,
    overridesFile
  ] = await Promise.all([
    readJsonWithBytes(path.join(releaseRoot, "sources.lock.json")),
    readJsonWithBytes(path.join(releaseRoot, "paldex.json")),
    readJsonWithBytes(path.join(releaseRoot, "images-manifest.json")),
    readFile(path.join(releaseRoot, "import-report.json")),
    readJsonWithBytes(path.join(releaseRoot, "manifest.json")),
    readJsonWithBytes(path.join(mappingRoot, "public-id-map.json")),
    readJsonWithBytes(path.join(mappingRoot, "elements.json")),
    readJsonWithBytes(path.join(mappingRoot, "work-suitabilities.json")),
    readJsonWithBytes(path.join(mappingRoot, "exclusions.json")),
    readJsonWithBytes(path.join(mappingRoot, "image-overrides.json"))
  ]);
  const sourceLock = assertPalworldPaldexSourceLock(sourceLockFile.value);
  const artifact = assertPalworldPaldexArtifact(paldexFile.value);
  const imagesManifest = assertPalworldImagesManifest(imagesFile.value, artifact);
  const manifest = assertPalworldPaldexReleaseManifest(manifestFile.value);
  assertPalworldImageRightsGate({ sourceLock, imagesManifest, manifest });
  const atlasSource = sourceLock.sources.find((source) => source.id === "atlas-pals")!;
  const palCalcSource = sourceLock.sources.find((source) => source.id === "palcalc-db")!;
  const expectedDataRevision = `atlas@${atlasSource.sourceRevision}+palcalc@${palCalcSource.sourceRevision}`;
  const expectedImageRevision = `palcalc-icons@${sourceLock.imageRightsReview.candidateSourceRevision}`;
  if (
    artifact.metadata.sourceRevision !== expectedDataRevision
    || artifact.metadata.extractedAt !== sourceLock.artifactTimestamp
    || artifact.metadata.verifiedAt !== sourceLock.verifiedAt
    || imagesManifest.revision !== expectedImageRevision
    || manifest.generatedAt !== sourceLock.artifactTimestamp
  ) {
    throw new PalworldPaldexValidationError("snapshot·image manifest·source lock revision이 일치하지 않습니다.");
  }
  const actualHashes = {
    sourceLockSha256: sha256Bytes(sourceLockFile.bytes),
    paldexSha256: sha256Bytes(paldexFile.bytes),
    imagesManifestSha256: sha256Bytes(imagesFile.bytes),
    importReportSha256: sha256Bytes(reportFile)
  };
  for (const [field, hash] of Object.entries(actualHashes)) {
    if (manifest[field as keyof typeof actualHashes] !== hash) {
      throw new PalworldPaldexValidationError(`manifest.${field}: checksum이 일치하지 않습니다.`);
    }
  }
  const actualMappingHashes = {
    publicIdMap: sha256Bytes(publicIdMapFile.bytes),
    elements: sha256Bytes(elementsFile.bytes),
    workSuitabilities: sha256Bytes(workSuitabilitiesFile.bytes),
    exclusions: sha256Bytes(exclusionsFile.bytes),
    imageOverrides: sha256Bytes(overridesFile.bytes)
  };
  for (const [field, hash] of Object.entries(actualMappingHashes)) {
    if (manifest.mappingSha256[field as keyof typeof actualMappingHashes] !== hash) {
      throw new PalworldPaldexValidationError(`manifest.mappingSha256.${field}: mapping checksum이 일치하지 않습니다.`);
    }
  }
  const imageCounts = await validatePalworldImageFiles({ manifest: imagesManifest, imageRoot, overrides: overridesFile.value });
  assertManifestCounts({ artifact, imagesManifest, manifest, ...imageCounts });
  assertGateCoverage({ artifact, manifest, readyImages: imageCounts.readyImages });
  const dataIntegrityReady = manifest.dataIntegrityGate.passed
    && manifest.dataIntegrityGate.status === "ready"
    && manifest.runtimeActivation;
  if (!dataIntegrityReady) {
    throw new PalworldPaldexValidationError("PALWORLD_DATA_INTEGRITY_GATE_FAILED");
  }
  const imageAssetsReady = manifest.imageAssetGate.passed
    && imagesManifest.status === "ready"
    && imageCounts.readyImages === PALWORLD_PALDEX_EXPECTED_COUNT;
  if (imageAssetsReady !== (manifest.imageAssetGate.status === "ready")) {
    throw new PalworldPaldexValidationError("image asset gate 상태와 이미지 artifact 상태가 일치하지 않습니다.");
  }
  if (options.requireReleaseReady && !imageAssetsReady) {
    throw new PalworldPaldexValidationError("PALWORLD_IMAGE_RELEASE_BLOCKED_BY_LICENSE");
  }
  return {
    artifact,
    imagesManifest,
    manifest,
    dataIntegrityReady,
    imageAssetsReady,
    releaseReady: imageAssetsReady
  };
}
