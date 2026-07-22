import {
  assertPalworldImagesManifest,
  assertPalworldPaldexArtifact,
  assertPalworldPaldexReleaseManifest,
  type PalworldImageManifestEntry,
  type PalworldImagesManifest,
  type PalworldPaldexArtifact,
  type PalworldPaldexReleaseManifest
} from "./palworld-paldex-artifact.js";
import {
  assertPalworldImageSourceMap,
  assertPalworldImageUsePolicy,
  palworldImageSourceReference,
  type PalworldImageSourceMap,
  type PalworldImageUsePolicy
} from "./palworld-image-policy.js";
import { deterministicJson, sha256Text } from "./palworld-paldex-import.js";

export const PALWORLD_IMAGE_CONVERTER = "sharp@0.35.3";

export type ImportedPalworldImage = {
  palId: string;
  sourceFileName: string;
  originalSha256: string;
  generatedSha256: string;
  outputFileName: string;
  outputWidth: number;
  outputHeight: number;
  outputBytes: number;
  imageUrl: string;
};

export type PalworldImageReleaseTexts = {
  artifact: PalworldPaldexArtifact;
  imagesManifest: PalworldImagesManifest;
  report: Record<string, unknown>;
  manifest: PalworldPaldexReleaseManifest;
  paldexText: string;
  imagesText: string;
  reportText: string;
  manifestText: string;
};

function fail(message: string): never {
  throw new TypeError(message);
}

function withValidatedImageUrl(
  pal: PalworldPaldexArtifact["records"][number],
  imageUrl: string | undefined
): PalworldPaldexArtifact["records"][number] {
  const { imageUrl: _previousImageUrl, ...textRecord } = pal;
  return { ...textRecord, ...(imageUrl ? { imageUrl } : {}) };
}

function buildEntry(input: {
  pal: PalworldPaldexArtifact["records"][number];
  mapping?: PalworldImageSourceMap["entries"][number];
  imported?: ImportedPalworldImage;
  policy: PalworldImageUsePolicy;
}): PalworldImageManifestEntry {
  const sourcePrefix = input.policy.sourceType === "operator_provided_archive"
    ? "operator-archive"
    : "operator-export";
  const sourceRevision = input.mapping?.sourceRevision ?? `${sourcePrefix}-unmapped`;
  const originalFileName = input.mapping?.sourceFileName ?? "not-mapped";
  const common = {
    palId: input.pal.id,
    sourceInternalId: input.pal.sourceInternalId,
    sourceName: input.policy.sourceDescription,
    sourceReference: palworldImageSourceReference(input.policy.sourceType, input.pal.sourceInternalId),
    sourceRevision,
    license: "RIGHTS_NOT_INDEPENDENTLY_VERIFIED",
    originalFileName
  } as const;
  if (!input.imported) {
    return {
      ...common,
      status: "blocked_by_license",
      usageBasis: "none",
      retrievedAt: null,
      originalSha256: null,
      generatedSha256: null,
      outputFileName: null,
      outputMime: null,
      outputWidth: null,
      outputHeight: null,
      outputBytes: null,
      imageUrl: null
    };
  }
  if (!input.mapping || input.mapping.sourceFileName !== input.imported.sourceFileName) {
    fail(`${input.pal.id}: import 결과와 source mapping이 일치하지 않습니다.`);
  }
  if (input.policy.status === "blocked_by_license") fail("차단된 policy로 이미지 entry를 활성화할 수 없습니다.");
  const rightsVerified = input.policy.status === "ready";
  return {
    ...common,
    status: rightsVerified ? "ready" : "operator_acknowledged",
    license: rightsVerified ? "RIGHTS_VERIFIED_BY_IMAGE_USE_POLICY" : "RIGHTS_NOT_INDEPENDENTLY_VERIFIED",
    usageBasis: rightsVerified ? "rights_verified" : "operator_reference_use",
    retrievedAt: input.policy.acknowledgedAt,
    originalSha256: input.imported.originalSha256,
    generatedSha256: input.imported.generatedSha256,
    outputFileName: input.imported.outputFileName,
    outputMime: "image/webp",
    outputWidth: input.imported.outputWidth,
    outputHeight: input.imported.outputHeight,
    outputBytes: input.imported.outputBytes,
    imageUrl: input.imported.imageUrl
  };
}

export function buildPalworldImageRelease(input: {
  baseArtifact: PalworldPaldexArtifact;
  baseReport: Record<string, unknown>;
  baseManifest: PalworldPaldexReleaseManifest;
  policy: PalworldImageUsePolicy;
  policySha256: string;
  sourceMap: PalworldImageSourceMap;
  sourceMapSha256: string | null;
  importedImages: ReadonlyMap<string, ImportedPalworldImage>;
}): PalworldImageReleaseTexts {
  const policy = assertPalworldImageUsePolicy(input.policy);
  const baseArtifact = assertPalworldPaldexArtifact(input.baseArtifact);
  const sourceMap = assertPalworldImageSourceMap(input.sourceMap, baseArtifact);
  if (sourceMap.entries.some((entry) => entry.sourceKind !== policy.sourceType)) {
    fail("image source mapping과 image-use-policy의 출처 종류가 일치하지 않습니다.");
  }
  const mappingByPalId = new Map(sourceMap.entries.map((entry) => [entry.palId, entry]));
  for (const [palId, imported] of input.importedImages) {
    if (!mappingByPalId.has(palId)) fail(`${palId}: source mapping이 없는 import 결과입니다.`);
    if (imported.palId !== palId) fail(`${palId}: import 결과의 canonical Pal ID가 일치하지 않습니다.`);
  }
  const entries = baseArtifact.records.map((pal) => buildEntry({
    pal,
    mapping: mappingByPalId.get(pal.id),
    imported: input.importedImages.get(pal.id),
    policy
  }));
  const readyImages = entries.filter((entry) => entry.status !== "blocked_by_license").length;
  const fallbackPals = entries.length - readyImages;
  const uniqueImageFiles = new Set(entries.flatMap((entry) => entry.generatedSha256 ? [entry.generatedSha256] : [])).size;
  const status: PalworldImagesManifest["status"] = readyImages === 0
    ? "blocked_by_license"
    : fallbackPals > 0
      ? "partial"
      : policy.rightsVerified
        ? "ready"
        : "operator_acknowledged";
  const imagesManifest = assertPalworldImagesManifest({
    schemaVersion: 1,
    release: baseArtifact.release,
    revision: input.sourceMapSha256 ? `operator-images@${input.sourceMapSha256}` : "operator-images-unmapped",
    status,
    rightsReview: {
      status: policy.status,
      reviewedAt: policy.acknowledgedAt,
      reasonCode: policy.rightsVerified ? "RIGHTS_VERIFIED_BY_POLICY" : "OPERATOR_REFERENCE_USE",
      evidenceUrls: []
    },
    entries
  }, {
    ...baseArtifact,
    records: baseArtifact.records.map((pal) => withValidatedImageUrl(pal, input.importedImages.get(pal.id)?.imageUrl))
  });
  const artifact = assertPalworldPaldexArtifact({
    ...baseArtifact,
    records: baseArtifact.records.map((pal) => withValidatedImageUrl(pal, input.importedImages.get(pal.id)?.imageUrl))
  });
  const technicalPassed = readyImages > 0;
  const publicActivationAllowed = technicalPassed && policy.status !== "blocked_by_license";
  const imageAssetGate: PalworldPaldexReleaseManifest["imageAssetGate"] = {
    passed: technicalPassed && publicActivationAllowed,
    status,
    policyStatus: policy.status === "ready" ? "rights_verified" : policy.status,
    failures: readyImages === 0
      ? ["PAL_IMAGE_FILES_NOT_PROVIDED"]
      : fallbackPals > 0
        ? ["PAL_IMAGE_COVERAGE_PARTIAL"]
        : [],
    technicalPassed,
    publicActivationAllowed,
    rightsVerified: policy.rightsVerified,
    usageBasis: policy.usageBasis,
    readyImages,
    fallbackPals,
    publicNoticeRequired: true
  };
  const report = structuredClone(input.baseReport);
  report.images = {
    status,
    policyStatus: imageAssetGate.policyStatus,
    sourceMappings: sourceMap.entries.length,
    mappedPals: entries.length,
    readyImages,
    uniqueImageFiles,
    fallbackPals,
    rightsVerified: policy.rightsVerified,
    usageBasis: policy.usageBasis,
    converter: {
      tool: PALWORLD_IMAGE_CONVERTER,
      maxDimension: 512,
      maxOutputBytes: 524288,
      webpQualities: [90, 84, 78, 72],
      alphaQuality: 100,
      effort: 6,
      resizeFit: "inside",
      metadata: "stripped"
    }
  };
  report.imageAssetGate = imageAssetGate;
  const paldexText = deterministicJson(artifact);
  const imagesText = deterministicJson(imagesManifest);
  const reportText = deterministicJson(report);
  const manifest = assertPalworldPaldexReleaseManifest({
    ...input.baseManifest,
    paldexSha256: sha256Text(paldexText),
    imagesManifestSha256: sha256Text(imagesText),
    importReportSha256: sha256Text(reportText),
    imageUsePolicySha256: input.policySha256,
    imageSourceMapSha256: input.sourceMapSha256,
    counts: {
      ...input.baseManifest.counts,
      imageMappings: entries.length,
      readyImages,
      uniqueImageFiles
    },
    imageAssetGate
  });
  const manifestText = deterministicJson(manifest);
  return { artifact, imagesManifest, report, manifest, paldexText, imagesText, reportText, manifestText };
}

export function buildPalworldImageRollback(input: {
  artifact: PalworldPaldexArtifact;
  imagesManifest: PalworldImagesManifest;
  report: Record<string, unknown>;
  manifest: PalworldPaldexReleaseManifest;
  blockedPolicy: PalworldImageUsePolicy;
  policySha256: string;
}): PalworldImageReleaseTexts {
  const policy = assertPalworldImageUsePolicy(input.blockedPolicy);
  if (policy.status !== "blocked_by_license") fail("rollback policy는 blocked_by_license여야 합니다.");
  const artifact = assertPalworldPaldexArtifact({
    ...input.artifact,
    records: input.artifact.records.map(({ imageUrl: _imageUrl, ...pal }) => pal)
  });
  const imagesManifest = assertPalworldImagesManifest({
    ...input.imagesManifest,
    status: "blocked_by_license",
    rightsReview: {
      status: "blocked_by_license",
      reviewedAt: policy.acknowledgedAt,
      reasonCode: "OPERATOR_PUBLIC_DISPLAY_DISABLED",
      evidenceUrls: []
    },
    entries: input.imagesManifest.entries.map((entry) => ({
      palId: entry.palId,
      sourceInternalId: entry.sourceInternalId,
      status: "blocked_by_license",
      sourceName: entry.sourceName,
      ...(entry.sourceReference
        ? { sourceReference: entry.sourceReference }
        : { sourceReference: palworldImageSourceReference(policy.sourceType, entry.sourceInternalId) }),
      sourceRevision: entry.sourceRevision,
      license: entry.license,
      usageBasis: "none",
      retrievedAt: null,
      originalSha256: null,
      generatedSha256: null,
      originalFileName: entry.originalFileName,
      outputFileName: null,
      outputMime: null,
      outputWidth: null,
      outputHeight: null,
      outputBytes: null,
      imageUrl: null
    }))
  }, artifact);
  const imageAssetGate: PalworldPaldexReleaseManifest["imageAssetGate"] = {
    passed: false,
    status: "blocked_by_license",
    policyStatus: "blocked_by_license",
    failures: ["PAL_IMAGE_PUBLIC_DISPLAY_DISABLED_BY_OPERATOR"],
    technicalPassed: false,
    publicActivationAllowed: false,
    rightsVerified: false,
    usageBasis: "none",
    readyImages: 0,
    fallbackPals: artifact.records.length,
    publicNoticeRequired: true
  };
  const report = structuredClone(input.report);
  report.images = {
    status: "blocked_by_license",
    mappedPals: artifact.records.length,
    readyImages: 0,
    uniqueImageFiles: 0,
    fallbackPals: artifact.records.length,
    retainedContentHashFiles: true
  };
  report.imageAssetGate = imageAssetGate;
  const paldexText = deterministicJson(artifact);
  const imagesText = deterministicJson(imagesManifest);
  const reportText = deterministicJson(report);
  const manifest = assertPalworldPaldexReleaseManifest({
    ...input.manifest,
    paldexSha256: sha256Text(paldexText),
    imagesManifestSha256: sha256Text(imagesText),
    importReportSha256: sha256Text(reportText),
    imageUsePolicySha256: input.policySha256,
    counts: {
      ...input.manifest.counts,
      imageMappings: artifact.records.length,
      readyImages: 0,
      uniqueImageFiles: 0
    },
    imageAssetGate
  });
  const manifestText = deterministicJson(manifest);
  return { artifact, imagesManifest, report, manifest, paldexText, imagesText, reportText, manifestText };
}
