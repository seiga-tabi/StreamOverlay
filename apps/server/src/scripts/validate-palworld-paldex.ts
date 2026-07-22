import { PalworldPaldexValidationError } from "../data/palworld-paldex-artifact.js";
import { loadPalworldPaldexStagedRelease } from "../data/palworld-paldex-loader.js";

const requireReleaseReady = process.argv.includes("--release");
try {
  const release = await loadPalworldPaldexStagedRelease({ requireReleaseReady });
  console.log(`[palworld-data] 데이터 검증 완료: ${release.artifact.records.length}종`);
  console.log(`[palworld-data] data integrity gate: ${release.dataIntegrityReady ? "ready" : "invalid"}`);
  console.log(`[palworld-data] 이미지 mapping: ${release.imagesManifest.entries.length}개, ready: ${release.manifest.counts.readyImages}개`);
  console.log(
    `[palworld-data] image asset gate: ${release.runtimeImageAssetGate.status}, `
    + `policy: ${release.runtimeImageAssetGate.policyStatus}, rightsVerified: ${release.runtimeImageAssetGate.rightsVerified}, `
    + `fallback: ${release.runtimeImageAssetGate.fallbackPals}`
  );
} catch (error) {
  const code = error instanceof PalworldPaldexValidationError ? error.message : "PALWORLD_PALDEX_VALIDATION_FAILED";
  console.error(`[palworld-data] 검증 실패: ${code}`);
  process.exitCode = 1;
}
