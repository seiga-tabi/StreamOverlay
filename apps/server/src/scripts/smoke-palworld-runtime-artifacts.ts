import { PALWORLD_PALDEX_EXPECTED_COUNT } from "../data/palworld-paldex-artifact.js";
import { loadPalworldPaldexStagedRelease } from "../data/palworld-paldex-loader.js";

try {
  const release = await loadPalworldPaldexStagedRelease();
  if (release.artifact.records.length !== PALWORLD_PALDEX_EXPECTED_COUNT) {
    throw new Error(`Pal artifact 수가 ${PALWORLD_PALDEX_EXPECTED_COUNT}개가 아닙니다.`);
  }
  console.log(`[palworld-data] runtime artifact smoke 완료: ${release.artifact.records.length}종`);
} catch (error) {
  const message = error instanceof Error ? error.message : "알 수 없는 검증 오류";
  console.error(`[palworld-data] runtime artifact smoke 실패: ${message}`);
  process.exitCode = 1;
}
