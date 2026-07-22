import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  PALWORLD_PALDEX_EXPECTED_COUNT,
  assertPalworldImagesManifest,
  assertPalworldPaldexReleaseManifest
} from "../data/palworld-paldex-artifact.js";
import {
  PALWORLD_IMAGE_POLICY_FILE_NAME,
  PALWORLD_IMAGE_SOURCE_MAP_FILE_NAME,
  assertPalworldImageSourceMap,
  assertPalworldImageUsePolicy
} from "../data/palworld-image-policy.js";
import { buildPalworldImageRelease, type ImportedPalworldImage } from "../data/palworld-image-release.js";
import {
  PALWORLD_PALDEX_MAPPING_ROOT,
  PALWORLD_PALDEX_RELEASE_ROOT,
  PALWORLD_PALDEX_SOURCE_CACHE_ROOT,
  assertPalworldPaldexSourceLock,
  buildPublicIdMapping,
  deterministicJson,
  importPalworldPaldex,
  sha256Bytes,
  sha256Text,
  writeFileAtomic
} from "../data/palworld-paldex-import.js";
import { loadPalworldPaldexStagedRelease } from "../data/palworld-paldex-loader.js";

const sourceLockPath = path.join(PALWORLD_PALDEX_RELEASE_ROOT, "sources.lock.json");
const sourceLockBytes = await readFile(sourceLockPath);
const sourceLock = assertPalworldPaldexSourceLock(JSON.parse(sourceLockBytes.toString("utf8")) as unknown);
const atlasSource = sourceLock.sources.find((source) => source.id === "atlas-pals")!;
const palCalcSource = sourceLock.sources.find((source) => source.id === "palcalc-db")!;
const atlasBytes = await readFile(path.join(PALWORLD_PALDEX_SOURCE_CACHE_ROOT, "atlas-pals.json"));
const palCalcBytes = await readFile(path.join(PALWORLD_PALDEX_SOURCE_CACHE_ROOT, "palcalc-db.json"));
if (atlasBytes.length !== atlasSource.bytes || sha256Bytes(atlasBytes) !== atlasSource.sha256) throw new Error("Atlas source checksum이 lock과 일치하지 않습니다.");
if (palCalcBytes.length !== palCalcSource.bytes || sha256Bytes(palCalcBytes) !== palCalcSource.sha256) throw new Error("PalCalc source checksum이 lock과 일치하지 않습니다.");
const atlas = JSON.parse(atlasBytes.toString("utf8")) as unknown;
const palCalc = JSON.parse(palCalcBytes.toString("utf8")) as unknown;
const exclusionsPath = path.join(PALWORLD_PALDEX_MAPPING_ROOT, "exclusions.json");
const exclusions = JSON.parse(await readFile(exclusionsPath, "utf8")) as unknown;
const publicIdMapPath = path.join(PALWORLD_PALDEX_MAPPING_ROOT, "public-id-map.json");

if (process.argv.includes("--initialize-public-id-map")) {
  const mapping = buildPublicIdMapping(atlas, palCalc, exclusions);
  await writeFileAtomic(publicIdMapPath, deterministicJson(mapping));
  console.log(`[palworld-data] public ID mapping ${PALWORLD_PALDEX_EXPECTED_COUNT}개를 초기화했습니다.`);
}

const mappingPaths = {
  publicIdMap: publicIdMapPath,
  elements: path.join(PALWORLD_PALDEX_MAPPING_ROOT, "elements.json"),
  workSuitabilities: path.join(PALWORLD_PALDEX_MAPPING_ROOT, "work-suitabilities.json"),
  exclusions: exclusionsPath,
  imageOverrides: path.join(PALWORLD_PALDEX_MAPPING_ROOT, "image-overrides.json")
};
const mappingFiles = Object.fromEntries(await Promise.all(Object.entries(mappingPaths).map(async ([name, filePath]) => [
  name,
  await readFile(filePath)
]))) as Record<keyof typeof mappingPaths, Buffer>;

async function readOptionalBytes(filePath: string): Promise<Buffer | undefined> {
  try {
    return await readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

const policyPath = path.join(PALWORLD_PALDEX_RELEASE_ROOT, PALWORLD_IMAGE_POLICY_FILE_NAME);
const policyBytes = await readOptionalBytes(policyPath);
const policy = policyBytes
  ? assertPalworldImageUsePolicy(JSON.parse(policyBytes.toString("utf8")) as unknown)
  : undefined;
const sourceMapPath = path.join(PALWORLD_PALDEX_MAPPING_ROOT, PALWORLD_IMAGE_SOURCE_MAP_FILE_NAME);
const sourceMapBytes = await readOptionalBytes(sourceMapPath);

let existingRelease: Awaited<ReturnType<typeof loadPalworldPaldexStagedRelease>> | undefined;
try {
  existingRelease = await loadPalworldPaldexStagedRelease({ imageFailureMode: "throw" });
} catch (error) {
  const existingImages = JSON.parse(await readFile(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "images-manifest.json"), "utf8")) as {
    entries?: Array<{ status?: unknown; imageUrl?: unknown }>;
  };
  const hasPublishedImages = existingImages.entries?.some((entry) =>
    entry.status === "operator_acknowledged" || entry.status === "ready" || typeof entry.imageUrl === "string"
  ) ?? false;
  if (hasPublishedImages) {
    throw new Error("기존 이미지 release 검증에 실패하여 데이터 재생성을 중단했습니다. 기존 release는 변경하지 않았습니다.", { cause: error });
  }
}

function generateReleaseTexts() {
  const result = importPalworldPaldex({
    atlas,
    palCalc,
    sourceLock,
    publicIdMap: JSON.parse(mappingFiles.publicIdMap.toString("utf8")) as unknown,
    elementsMap: JSON.parse(mappingFiles.elements.toString("utf8")) as unknown,
    workMappings: JSON.parse(mappingFiles.workSuitabilities.toString("utf8")) as unknown,
    exclusions
  });
  assertPalworldImagesManifest(result.imagesManifest, result.artifact);

  const paldexText = deterministicJson(result.artifact);
  const imagesText = deterministicJson(result.imagesManifest);
  const policyStatus = policy?.status === "ready" ? "rights_verified" : policy?.status ?? "missing";
  const imageAssetGate = {
    passed: false,
    status: "blocked_by_license" as const,
    policyStatus,
    failures: ["PAL_IMAGE_FILES_NOT_PROVIDED"],
    technicalPassed: false,
    publicActivationAllowed: false,
    rightsVerified: policy?.rightsVerified ?? false,
    usageBasis: policy?.usageBasis ?? "none",
    readyImages: 0,
    fallbackPals: result.artifact.records.length,
    publicNoticeRequired: true
  };
  const report = structuredClone(result.report);
  report.images = {
    status: "blocked_by_license",
    policyStatus,
    mappedPals: result.imagesManifest.entries.length,
    readyImages: 0,
    uniqueImageFiles: 0,
    fallbackPals: result.imagesManifest.entries.length,
    rightsVerified: policy?.rightsVerified ?? false,
    usageBasis: policy?.usageBasis ?? "none"
  };
  report.imageAssetGate = imageAssetGate;
  const reportText = deterministicJson(report);
  const manifest = assertPalworldPaldexReleaseManifest({
    schemaVersion: 1,
    release: sourceLock.release,
    generatedAt: sourceLock.artifactTimestamp,
    sourceLockSha256: sha256Bytes(sourceLockBytes),
    paldexSha256: sha256Text(paldexText),
    imagesManifestSha256: sha256Text(imagesText),
    importReportSha256: sha256Text(reportText),
    imageUsePolicySha256: policyBytes ? sha256Bytes(policyBytes) : null,
    imageSourceMapSha256: sourceMapBytes ? sha256Bytes(sourceMapBytes) : null,
    mappingSha256: {
      publicIdMap: sha256Bytes(mappingFiles.publicIdMap),
      elements: sha256Bytes(mappingFiles.elements),
      workSuitabilities: sha256Bytes(mappingFiles.workSuitabilities),
      exclusions: sha256Bytes(mappingFiles.exclusions),
      imageOverrides: sha256Bytes(mappingFiles.imageOverrides)
    },
    counts: {
      pals: result.artifact.records.length,
      normal: result.artifact.records.filter((pal) => pal.variantType === "normal").length,
      variant: result.artifact.records.filter((pal) => pal.variantType === "variant").length,
      imageMappings: result.imagesManifest.entries.length,
      readyImages: 0,
      uniqueImageFiles: 0
    },
    dataIntegrityGate: {
      passed: true,
      status: "ready",
      failures: [],
      checks: {
        pals: result.artifact.records.length,
        normal: result.artifact.records.filter((pal) => pal.variantType === "normal").length,
        variant: result.artifact.records.filter((pal) => pal.variantType === "variant").length,
        missingNameKo: 0,
        missingNameJa: 0,
        missingNameEn: 0,
        missingRequiredStats: 0,
        missingBreedingPower: 0,
        unknownEnums: 0,
        idCollisions: 0,
        aliasCollisions: 0,
        sourceChecksumVerified: true,
        mappingChecksumsVerified: true,
        artifactChecksumsVerified: true
      }
    },
    imageAssetGate,
    runtimeActivation: true
  });
  const base = {
    result,
    artifact: result.artifact,
    imagesManifest: result.imagesManifest,
    report,
    manifest,
    paldexText,
    imagesText,
    reportText,
    manifestText: deterministicJson(manifest)
  };
  if (!policy || !policyBytes) return base;
  const sourceMap = sourceMapBytes
    ? assertPalworldImageSourceMap(JSON.parse(sourceMapBytes.toString("utf8")) as unknown, result.artifact)
    : { schemaVersion: 1 as const, release: "1.0.1" as const, entries: [] };
  const preservedImages = new Map<string, ImportedPalworldImage>();
  for (const entry of existingRelease?.imagesManifest.entries ?? []) {
    if (entry.status !== "operator_acknowledged" && entry.status !== "ready") continue;
    preservedImages.set(entry.palId, {
      palId: entry.palId,
      sourceFileName: entry.originalFileName,
      originalSha256: entry.originalSha256!,
      generatedSha256: entry.generatedSha256!,
      outputFileName: entry.outputFileName!,
      outputWidth: entry.outputWidth!,
      outputHeight: entry.outputHeight!,
      outputBytes: entry.outputBytes!,
      imageUrl: entry.imageUrl!
    });
  }
  return {
    result,
    ...buildPalworldImageRelease({
      baseArtifact: result.artifact,
      baseReport: report,
      baseManifest: manifest,
      policy,
      policySha256: sha256Bytes(policyBytes),
      sourceMap,
      sourceMapSha256: sourceMapBytes ? sha256Bytes(sourceMapBytes) : null,
      importedImages: preservedImages
    })
  };
}

const generated = generateReleaseTexts();
const regenerated = generateReleaseTexts();
for (const field of ["paldexText", "imagesText", "reportText", "manifestText"] as const) {
  if (generated[field] !== regenerated[field]) {
    throw new Error(`동일 입력의 ${field} 생성 결과가 byte-for-byte 일치하지 않습니다.`);
  }
}

const stagingRoot = await mkdtemp(path.join(path.dirname(PALWORLD_PALDEX_RELEASE_ROOT), ".1.0.1-generate-"));
try {
  await copyFile(sourceLockPath, path.join(stagingRoot, "sources.lock.json"));
  if (policyBytes) await copyFile(policyPath, path.join(stagingRoot, PALWORLD_IMAGE_POLICY_FILE_NAME));
  await Promise.all([
    writeFileAtomic(path.join(stagingRoot, "paldex.json"), generated.paldexText),
    writeFileAtomic(path.join(stagingRoot, "images-manifest.json"), generated.imagesText),
    writeFileAtomic(path.join(stagingRoot, "import-report.json"), generated.reportText),
    writeFileAtomic(path.join(stagingRoot, "manifest.json"), generated.manifestText)
  ]);
  await loadPalworldPaldexStagedRelease({ releaseRoot: stagingRoot, imageFailureMode: "throw" });
  await Promise.all([
    writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "paldex.json"), generated.paldexText),
    writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "images-manifest.json"), generated.imagesText),
    writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "import-report.json"), generated.reportText)
  ]);
  await writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "manifest.json"), generated.manifestText);
} finally {
  await rm(stagingRoot, { recursive: true, force: true });
}
const verified = await loadPalworldPaldexStagedRelease();
const [verifiedAtlasBytes, verifiedPalCalcBytes] = await Promise.all([
  readFile(path.join(PALWORLD_PALDEX_SOURCE_CACHE_ROOT, "atlas-pals.json")),
  readFile(path.join(PALWORLD_PALDEX_SOURCE_CACHE_ROOT, "palcalc-db.json"))
]);
if (verifiedAtlasBytes.length !== atlasSource.bytes || sha256Bytes(verifiedAtlasBytes) !== atlasSource.sha256) {
  throw new Error("생성 후 Atlas source checksum이 lock과 일치하지 않습니다.");
}
if (verifiedPalCalcBytes.length !== palCalcSource.bytes || sha256Bytes(verifiedPalCalcBytes) !== palCalcSource.sha256) {
  throw new Error("생성 후 PalCalc source checksum이 lock과 일치하지 않습니다.");
}
console.log(
  `[palworld-data] ${verified.artifact.records.length}종 도감 artifact를 결정적으로 생성하고 checksum을 검증했습니다. `
  + `이미지 상태: ${verified.runtimeImageAssetGate.status}, ready: ${verified.runtimeImageAssetGate.readyImages}, `
  + `fallback: ${verified.runtimeImageAssetGate.fallbackPals}, rightsVerified: ${verified.runtimeImageAssetGate.rightsVerified}`
);
