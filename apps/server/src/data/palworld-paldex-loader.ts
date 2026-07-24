import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PalworldRuntimeGates } from "@streamops/shared";
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
import { collectPalworldRuntimeImageUrls, validatePalworldImageFiles } from "./palworld-image-import.js";
import {
  PALWORLD_IMAGE_POLICY_FILE_NAME,
  PALWORLD_IMAGE_SOURCE_MAP_FILE_NAME,
  assertPalworldImageSourceMap,
  assertPalworldImageUsePolicy,
  palworldImageSourceReference,
  type PalworldImageUsePolicy
} from "./palworld-image-policy.js";
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
  runtimeImageUrls: Readonly<Record<string, string>>;
  runtimeImageDimensions: Readonly<Record<string, { width: number; height: number }>>;
  runtimeImageAssetGate: PalworldRuntimeGates["imageAssets"];
};

export type PalworldPaldexRuntimeSource = Pick<
  PalworldPaldexStagedRelease,
  "artifact" | "manifest" | "dataIntegrityReady" | "runtimeImageUrls" | "runtimeImageDimensions" | "runtimeImageAssetGate"
>;

async function readJsonWithBytes(filePath: string): Promise<{ bytes: Buffer; value: unknown }> {
  const bytes = await readFile(filePath);
  return { bytes, value: JSON.parse(bytes.toString("utf8")) as unknown };
}

async function readOptionalJsonWithBytes(filePath: string): Promise<{ bytes: Buffer; value: unknown } | undefined> {
  try {
    return await readJsonWithBytes(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function readOptionalBytes(filePath: string): Promise<Buffer | undefined> {
  try {
    return await readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export function assertPalworldImageRightsGate(input: {
  sourceLock: PalworldPaldexSourceLock;
  imagesManifest: PalworldImagesManifest;
  manifest: PalworldPaldexReleaseManifest;
  policy?: PalworldImageUsePolicy;
}): void {
  const activatedEntries = input.imagesManifest.entries.filter((entry) =>
    entry.status === "operator_acknowledged" || entry.status === "ready"
  );
  if (activatedEntries.length > 0) {
    if (!input.policy || input.policy.status === "blocked_by_license") {
      throw new PalworldPaldexValidationError("운영자 image-use-policy 없이 이미지를 공개할 수 없습니다.");
    }
    if (input.policy.status === "operator_acknowledged" && activatedEntries.some((entry) => entry.status !== "operator_acknowledged")) {
      throw new PalworldPaldexValidationError("운영자 확인 policy에서 권리 검증 ready 이미지를 공개할 수 없습니다.");
    }
    if (input.policy.status === "ready" && activatedEntries.some((entry) => entry.status !== "ready")) {
      throw new PalworldPaldexValidationError("권리 검증 policy와 이미지 entry 상태가 일치하지 않습니다.");
    }
    return;
  }
  if (input.sourceLock.imageRightsReview.status !== "blocked_by_license") return;
  const expectedEvidenceUrls = input.sourceLock.imageRightsReview.evidence.map((evidence) => evidence.url);
  const candidateFileBaseUrl = `${input.sourceLock.imageRightsReview.candidateDirectoryUrl.replace("/tree/", "/blob/")}/`;
  const usesLegacyBlockedCandidates = input.imagesManifest.entries.every((entry) =>
    entry.status === "blocked_by_license"
    && entry.sourceName === input.sourceLock.imageRightsReview.candidateSourceName
    && entry.sourceRevision === input.sourceLock.imageRightsReview.candidateSourceRevision
    && entry.license === input.sourceLock.imageRightsReview.license
    && entry.sourceUrl?.startsWith(candidateFileBaseUrl)
  );
  if (!usesLegacyBlockedCandidates) {
    if (
      !input.policy
      || input.imagesManifest.status !== "blocked_by_license"
      || input.manifest.imageAssetGate.status !== "blocked_by_license"
      || input.manifest.imageAssetGate.publicActivationAllowed
      || input.manifest.imageAssetGate.readyImages !== 0
    ) {
      throw new PalworldPaldexValidationError("운영자 policy가 차단한 이미지 artifact 상태가 일치하지 않습니다.");
    }
    return;
  }
  const rightsGateWasBypassed = input.imagesManifest.status !== "blocked_by_license"
    || input.imagesManifest.rightsReview.status !== "blocked_by_license"
    || input.imagesManifest.rightsReview.reasonCode !== input.sourceLock.imageRightsReview.reasonCode
    || JSON.stringify(input.imagesManifest.rightsReview.evidenceUrls) !== JSON.stringify(expectedEvidenceUrls)
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

function assertDataGateCoverage(input: {
  artifact: PalworldPaldexArtifact;
  manifest: PalworldPaldexReleaseManifest;
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
}

function assertGateCoverage(input: {
  artifact: PalworldPaldexArtifact;
  manifest: PalworldPaldexReleaseManifest;
  readyImages: number;
}): void {
  assertDataGateCoverage(input);
  const fallbackPals = input.artifact.records.length - input.readyImages;
  if (input.manifest.imageAssetGate.readyImages !== input.readyImages) {
    throw new PalworldPaldexValidationError("manifest.imageAssetGate.readyImages: 실제 이미지 수와 일치하지 않습니다.");
  }
  if (input.manifest.imageAssetGate.fallbackPals !== fallbackPals) {
    throw new PalworldPaldexValidationError("manifest.imageAssetGate.fallbackPals: 실제 fallback 수와 일치하지 않습니다.");
  }
}

function imagePolicyStatus(policy: PalworldImageUsePolicy | undefined): PalworldRuntimeGates["imageAssets"]["policyStatus"] {
  if (!policy) return "missing";
  if (policy.status === "ready") return "rights_verified";
  return policy.status;
}

function runtimeImageAssetGate(input: {
  policy?: PalworldImageUsePolicy;
  readyImages: number;
  totalPals: number;
}): PalworldRuntimeGates["imageAssets"] {
  const policyStatus = imagePolicyStatus(input.policy);
  const fallbackPals = input.totalPals - input.readyImages;
  const usageBasis = input.policy?.usageBasis ?? "none";
  const rightsVerified = input.policy?.rightsVerified ?? false;
  const policyAllowsPublicDisplay = input.policy !== undefined
    && input.policy.status !== "blocked_by_license"
    && input.policy.allowPublicDisplay
    && input.policy.allowSelfHosting;
  const technicalPassed = input.readyImages > 0;
  const publicActivationAllowed = technicalPassed && policyAllowsPublicDisplay;
  const status = !publicActivationAllowed
    ? "blocked_by_license"
    : fallbackPals > 0
      ? "partial"
      : rightsVerified
        ? "ready"
        : "operator_acknowledged";
  return {
    status,
    policyStatus,
    technicalPassed,
    publicActivationAllowed,
    rightsVerified,
    usageBasis,
    readyImages: publicActivationAllowed ? input.readyImages : 0,
    fallbackPals: publicActivationAllowed ? fallbackPals : input.totalPals,
    publicNoticeRequired: true
  };
}

export async function loadPalworldPaldexStagedRelease(options: {
  releaseRoot?: string;
  imageRoot?: string;
  mappingRoot?: string;
  requireReleaseReady?: boolean;
  imageFailureMode?: "throw" | "fallback";
  requireImportReport?: boolean;
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
    overridesFile,
    policyFile,
    imageSourceMapFile
  ] = await Promise.all([
    readJsonWithBytes(path.join(releaseRoot, "sources.lock.json")),
    readJsonWithBytes(path.join(releaseRoot, "paldex.json")),
    readJsonWithBytes(path.join(releaseRoot, "images-manifest.json")),
    readOptionalBytes(path.join(releaseRoot, "import-report.json")),
    readJsonWithBytes(path.join(releaseRoot, "manifest.json")),
    readJsonWithBytes(path.join(mappingRoot, "public-id-map.json")),
    readJsonWithBytes(path.join(mappingRoot, "elements.json")),
    readJsonWithBytes(path.join(mappingRoot, "work-suitabilities.json")),
    readJsonWithBytes(path.join(mappingRoot, "exclusions.json")),
    readJsonWithBytes(path.join(mappingRoot, "image-overrides.json")),
    readOptionalJsonWithBytes(path.join(releaseRoot, PALWORLD_IMAGE_POLICY_FILE_NAME)),
    readOptionalJsonWithBytes(path.join(mappingRoot, PALWORLD_IMAGE_SOURCE_MAP_FILE_NAME))
  ]);
  const sourceLock = assertPalworldPaldexSourceLock(sourceLockFile.value);
  if (options.requireImportReport !== false && reportFile === undefined) {
    throw new PalworldPaldexValidationError("import-report.json: source 감사용 report가 없습니다.");
  }
  const artifact = assertPalworldPaldexArtifact(paldexFile.value);
  const imagesManifest = assertPalworldImagesManifest(imagesFile.value, artifact);
  const manifest = assertPalworldPaldexReleaseManifest(manifestFile.value);
  const policy = policyFile ? assertPalworldImageUsePolicy(policyFile.value) : undefined;
  const imageSourceMap = imageSourceMapFile ? assertPalworldImageSourceMap(imageSourceMapFile.value, artifact) : undefined;
  const actualPolicyHash = policyFile ? sha256Bytes(policyFile.bytes) : null;
  const actualSourceMapHash = imageSourceMapFile ? sha256Bytes(imageSourceMapFile.bytes) : null;
  if (manifest.imageUsePolicySha256 !== actualPolicyHash) {
    throw new PalworldPaldexValidationError("manifest.imageUsePolicySha256: policy checksum이 일치하지 않습니다.");
  }
  if (manifest.imageSourceMapSha256 !== actualSourceMapHash) {
    throw new PalworldPaldexValidationError("manifest.imageSourceMapSha256: image source mapping checksum이 일치하지 않습니다.");
  }
  const expectedPolicyStatus = imagePolicyStatus(policy);
  if (
    manifest.imageAssetGate.policyStatus !== expectedPolicyStatus
    || manifest.imageAssetGate.usageBasis !== (policy?.usageBasis ?? "none")
    || manifest.imageAssetGate.rightsVerified !== (policy?.rightsVerified ?? false)
  ) {
    throw new PalworldPaldexValidationError("manifest.imageAssetGate: 고정 image-use-policy와 일치하지 않습니다.");
  }
  if (manifest.imageAssetGate.readyImages > 0 && !imageSourceMap) {
    throw new PalworldPaldexValidationError("활성 이미지에는 검증된 image-source-map.json이 필요합니다.");
  }
  if (imageSourceMap) {
    if (policy && imageSourceMap.entries.some((mapping) => mapping.sourceKind !== policy.sourceType)) {
      throw new PalworldPaldexValidationError("image source mapping과 image-use-policy의 출처 종류가 일치하지 않습니다.");
    }
    const imageEntriesByPalId = new Map(imagesManifest.entries.map((entry) => [entry.palId, entry]));
    for (const [index, mapping] of imageSourceMap.entries.entries()) {
      const entry = imageEntriesByPalId.get(mapping.palId);
      if (
        !entry
        || entry.palId !== mapping.palId
        || entry.sourceInternalId !== mapping.sourceInternalId
        || entry.originalFileName !== mapping.sourceFileName
        || entry.sourceRevision !== mapping.sourceRevision
        || entry.sourceReference !== palworldImageSourceReference(mapping.sourceKind, mapping.sourceInternalId)
      ) {
        throw new PalworldPaldexValidationError(`imagesManifest.entries[${index}]: image source mapping provenance가 일치하지 않습니다.`);
      }
    }
  }
  assertPalworldImageRightsGate({ sourceLock, imagesManifest, manifest, policy });
  const atlasSource = sourceLock.sources.find((source) => source.id === "atlas-pals")!;
  const palCalcSource = sourceLock.sources.find((source) => source.id === "palcalc-db")!;
  const expectedDataRevision = `atlas@${atlasSource.sourceRevision}+palcalc@${palCalcSource.sourceRevision}`;
  const expectedLegacyImageRevision = `palcalc-icons@${sourceLock.imageRightsReview.candidateSourceRevision}`;
  const legacyCandidateBaseUrl = `${sourceLock.imageRightsReview.candidateDirectoryUrl.replace("/tree/", "/blob/")}/`;
  const usesOnlyLegacyBlockedEntries = imagesManifest.entries.every((entry) =>
    entry.status === "blocked_by_license" && entry.sourceUrl?.startsWith(legacyCandidateBaseUrl)
  );
  const expectedOperatorImageRevision = manifest.imageSourceMapSha256 === null
    ? "operator-images-unmapped"
    : `operator-images@${manifest.imageSourceMapSha256}`;
  if (
    artifact.metadata.sourceRevision !== expectedDataRevision
    || artifact.metadata.extractedAt !== sourceLock.artifactTimestamp
    || artifact.metadata.verifiedAt !== sourceLock.verifiedAt
    || (usesOnlyLegacyBlockedEntries && imagesManifest.revision !== expectedLegacyImageRevision)
    || (!usesOnlyLegacyBlockedEntries && imagesManifest.revision !== expectedOperatorImageRevision)
    || manifest.generatedAt !== sourceLock.artifactTimestamp
  ) {
    throw new PalworldPaldexValidationError("snapshot·image manifest·source lock revision이 일치하지 않습니다.");
  }
  const actualHashes = {
    sourceLockSha256: sha256Bytes(sourceLockFile.bytes),
    paldexSha256: sha256Bytes(paldexFile.bytes),
    imagesManifestSha256: sha256Bytes(imagesFile.bytes),
    ...(reportFile === undefined ? {} : {
      importReportSha256: sha256Bytes(reportFile)
    })
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
  const activatedEntries = imagesManifest.entries.filter((entry) =>
    entry.status === "operator_acknowledged" || entry.status === "ready"
  );
  const declaredImageCounts = {
    readyImages: activatedEntries.length,
    uniqueImageFiles: new Set(activatedEntries.map((entry) => entry.generatedSha256)).size
  };
  assertManifestCounts({ artifact, imagesManifest, manifest, ...declaredImageCounts });
  assertGateCoverage({ artifact, manifest, readyImages: declaredImageCounts.readyImages });
  let runtimeImages: Awaited<ReturnType<typeof collectPalworldRuntimeImageUrls>>;
  if (options.imageFailureMode === "fallback") {
    runtimeImages = manifest.imageAssetGate.publicActivationAllowed
      ? await collectPalworldRuntimeImageUrls({ manifest: imagesManifest, imageRoot })
      : { imageUrls: {}, readyImages: 0, uniqueImageFiles: 0 };
  } else {
    const verifiedImageCounts = await validatePalworldImageFiles({ manifest: imagesManifest, imageRoot, overrides: overridesFile.value });
    if (
      verifiedImageCounts.readyImages !== declaredImageCounts.readyImages
      || verifiedImageCounts.uniqueImageFiles !== declaredImageCounts.uniqueImageFiles
    ) {
      throw new PalworldPaldexValidationError("manifest 이미지 수와 검증된 정적 파일 수가 일치하지 않습니다.");
    }
    runtimeImages = {
      imageUrls: manifest.imageAssetGate.publicActivationAllowed
        ? Object.freeze(Object.fromEntries(activatedEntries.map((entry) => [entry.palId, entry.imageUrl!])))
        : {},
      ...verifiedImageCounts
    };
  }
  const dataIntegrityReady = manifest.dataIntegrityGate.passed
    && manifest.dataIntegrityGate.status === "ready"
    && manifest.runtimeActivation;
  if (!dataIntegrityReady) {
    throw new PalworldPaldexValidationError("PALWORLD_DATA_INTEGRITY_GATE_FAILED");
  }
  const runtimeGate = runtimeImageAssetGate({
    policy,
    readyImages: runtimeImages.readyImages,
    totalPals: artifact.records.length
  });
  if (options.imageFailureMode !== "fallback") {
    for (const field of [
      "status",
      "policyStatus",
      "technicalPassed",
      "publicActivationAllowed",
      "rightsVerified",
      "usageBasis",
      "readyImages",
      "fallbackPals",
      "publicNoticeRequired"
    ] as const) {
      if (runtimeGate[field] !== manifest.imageAssetGate[field]) {
        throw new PalworldPaldexValidationError(`manifest.imageAssetGate.${field}: 검증된 policy·이미지 상태와 일치하지 않습니다.`);
      }
    }
  }
  const imageAssetsReady = runtimeGate.publicActivationAllowed
    && runtimeGate.readyImages === PALWORLD_PALDEX_EXPECTED_COUNT
    && runtimeGate.fallbackPals === 0;
  if (options.requireReleaseReady && !imageAssetsReady) {
    throw new PalworldPaldexValidationError("PALWORLD_IMAGE_RELEASE_BLOCKED_BY_LICENSE");
  }
  return {
    artifact,
    imagesManifest,
    manifest,
    dataIntegrityReady,
    imageAssetsReady,
    releaseReady: imageAssetsReady,
    runtimeImageUrls: runtimeImages.imageUrls,
    runtimeImageDimensions: Object.freeze(Object.fromEntries(
      activatedEntries
        .filter((entry) => Object.hasOwn(runtimeImages.imageUrls, entry.palId))
        .map((entry) => [entry.palId, { width: entry.outputWidth!, height: entry.outputHeight! }])
    )),
    runtimeImageAssetGate: runtimeGate
  };
}

async function loadPalworldPaldexDataOnlyRuntimeFallback(options: {
  releaseRoot?: string;
  mappingRoot?: string;
}): Promise<PalworldPaldexRuntimeSource> {
  const releaseRoot = options.releaseRoot ?? PALWORLD_PALDEX_RELEASE_ROOT;
  const mappingRoot = options.mappingRoot ?? PALWORLD_PALDEX_MAPPING_ROOT;
  const [
    sourceLockFile,
    paldexFile,
    reportFile,
    manifestFile,
    publicIdMapFile,
    elementsFile,
    workSuitabilitiesFile,
    exclusionsFile
  ] = await Promise.all([
    readJsonWithBytes(path.join(releaseRoot, "sources.lock.json")),
    readJsonWithBytes(path.join(releaseRoot, "paldex.json")),
    readOptionalBytes(path.join(releaseRoot, "import-report.json")),
    readJsonWithBytes(path.join(releaseRoot, "manifest.json")),
    readJsonWithBytes(path.join(mappingRoot, "public-id-map.json")),
    readJsonWithBytes(path.join(mappingRoot, "elements.json")),
    readJsonWithBytes(path.join(mappingRoot, "work-suitabilities.json")),
    readJsonWithBytes(path.join(mappingRoot, "exclusions.json"))
  ]);
  const sourceLock = assertPalworldPaldexSourceLock(sourceLockFile.value);
  const artifact = assertPalworldPaldexArtifact(paldexFile.value);
  const manifest = assertPalworldPaldexReleaseManifest(manifestFile.value);
  const atlasSource = sourceLock.sources.find((source) => source.id === "atlas-pals")!;
  const palCalcSource = sourceLock.sources.find((source) => source.id === "palcalc-db")!;
  const expectedRevision = `atlas@${atlasSource.sourceRevision}+palcalc@${palCalcSource.sourceRevision}`;
  if (
    artifact.metadata.sourceRevision !== expectedRevision
    || artifact.metadata.extractedAt !== sourceLock.artifactTimestamp
    || artifact.metadata.verifiedAt !== sourceLock.verifiedAt
    || manifest.generatedAt !== sourceLock.artifactTimestamp
  ) {
    throw new PalworldPaldexValidationError("Palworld data snapshot과 고정 source revision이 일치하지 않습니다.");
  }
  const dataHashes = {
    sourceLockSha256: sha256Bytes(sourceLockFile.bytes),
    paldexSha256: sha256Bytes(paldexFile.bytes),
    ...(reportFile === undefined ? {} : {
      importReportSha256: sha256Bytes(reportFile)
    })
  };
  for (const [field, hash] of Object.entries(dataHashes)) {
    if (manifest[field as keyof typeof dataHashes] !== hash) {
      throw new PalworldPaldexValidationError(`manifest.${field}: data checksum이 일치하지 않습니다.`);
    }
  }
  const mappingHashes = {
    publicIdMap: sha256Bytes(publicIdMapFile.bytes),
    elements: sha256Bytes(elementsFile.bytes),
    workSuitabilities: sha256Bytes(workSuitabilitiesFile.bytes),
    exclusions: sha256Bytes(exclusionsFile.bytes)
  };
  for (const [field, hash] of Object.entries(mappingHashes)) {
    if (manifest.mappingSha256[field as keyof typeof mappingHashes] !== hash) {
      throw new PalworldPaldexValidationError(`manifest.mappingSha256.${field}: mapping checksum이 일치하지 않습니다.`);
    }
  }
  const normal = artifact.records.filter((pal) => pal.variantType === "normal").length;
  if (
    manifest.counts.pals !== artifact.records.length
    || manifest.counts.normal !== normal
    || manifest.counts.variant !== artifact.records.length - normal
  ) {
    throw new PalworldPaldexValidationError("manifest.counts: Pal 텍스트 artifact 집계와 일치하지 않습니다.");
  }
  assertDataGateCoverage({ artifact, manifest });
  const dataIntegrityReady = manifest.dataIntegrityGate.passed
    && manifest.dataIntegrityGate.status === "ready"
    && manifest.runtimeActivation;
  if (!dataIntegrityReady) throw new PalworldPaldexValidationError("PALWORLD_DATA_INTEGRITY_GATE_FAILED");

  let policy: PalworldImageUsePolicy | undefined;
  try {
    const policyFile = await readOptionalJsonWithBytes(path.join(releaseRoot, PALWORLD_IMAGE_POLICY_FILE_NAME));
    if (policyFile && manifest.imageUsePolicySha256 === sha256Bytes(policyFile.bytes)) {
      policy = assertPalworldImageUsePolicy(policyFile.value);
    }
  } catch {
    policy = undefined;
  }
  return {
    artifact,
    manifest,
    dataIntegrityReady,
    runtimeImageUrls: {},
    runtimeImageDimensions: {},
    runtimeImageAssetGate: runtimeImageAssetGate({
      policy,
      readyImages: 0,
      totalPals: artifact.records.length
    })
  };
}

export async function loadPalworldPaldexRuntimeSource(options: {
  releaseRoot?: string;
  imageRoot?: string;
  mappingRoot?: string;
} = {}): Promise<PalworldPaldexRuntimeSource> {
  try {
    return await loadPalworldPaldexStagedRelease({
      ...options,
      imageFailureMode: "fallback",
      requireImportReport: false
    });
  } catch {
    return loadPalworldPaldexDataOnlyRuntimeFallback(options);
  }
}
