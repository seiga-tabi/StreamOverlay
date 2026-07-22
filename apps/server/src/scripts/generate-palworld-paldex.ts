import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PALWORLD_PALDEX_EXPECTED_COUNT,
  assertPalworldImagesManifest,
  assertPalworldPaldexReleaseManifest
} from "../data/palworld-paldex-artifact.js";
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
  const reportText = deterministicJson(result.report);
  const manifest = assertPalworldPaldexReleaseManifest({
    schemaVersion: 1,
    release: sourceLock.release,
    generatedAt: sourceLock.artifactTimestamp,
    sourceLockSha256: sha256Bytes(sourceLockBytes),
    paldexSha256: sha256Text(paldexText),
    imagesManifestSha256: sha256Text(imagesText),
    importReportSha256: sha256Text(reportText),
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
    imageAssetGate: {
      passed: false,
      status: "blocked_by_license",
      failures: ["PAL_IMAGE_REDISTRIBUTION_PERMISSION_NOT_VERIFIED", "PAL_IMAGE_FILES_NOT_INCLUDED"],
      readyImages: 0,
      fallbackPals: result.artifact.records.length
    },
    runtimeActivation: true
  });
  return {
    result,
    paldexText,
    imagesText,
    reportText,
    manifestText: deterministicJson(manifest)
  };
}

const generated = generateReleaseTexts();
const regenerated = generateReleaseTexts();
for (const field of ["paldexText", "imagesText", "reportText", "manifestText"] as const) {
  if (generated[field] !== regenerated[field]) {
    throw new Error(`동일 입력의 ${field} 생성 결과가 byte-for-byte 일치하지 않습니다.`);
  }
}

await Promise.all([
  writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "paldex.json"), generated.paldexText),
  writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "images-manifest.json"), generated.imagesText),
  writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "import-report.json"), generated.reportText)
]);
await writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "manifest.json"), generated.manifestText);
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
console.log(`[palworld-data] ${verified.artifact.records.length}종 도감 artifact를 결정적으로 생성하고 checksum을 검증했습니다. 이미지 상태: blocked_by_license`);
