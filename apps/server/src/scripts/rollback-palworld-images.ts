import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildPalworldImageRollback
} from "../data/palworld-image-release.js";
import {
  PALWORLD_IMAGE_POLICY_FILE_NAME,
  assertPalworldImageUsePolicy
} from "../data/palworld-image-policy.js";
import {
  PALWORLD_PALDEX_RELEASE,
  assertPalworldImagesManifest,
  assertPalworldPaldexArtifact,
  assertPalworldPaldexReleaseManifest
} from "../data/palworld-paldex-artifact.js";
import {
  PALWORLD_PALDEX_PUBLIC_IMAGE_ROOT,
  PALWORLD_PALDEX_MAPPING_ROOT,
  PALWORLD_PALDEX_RELEASE_ROOT,
  deterministicJson,
  sha256Text,
  writeFileAtomic
} from "../data/palworld-paldex-import.js";
import { loadPalworldPaldexStagedRelease } from "../data/palworld-paldex-loader.js";

function fail(message: string): never {
  throw new Error(message);
}

async function readJson(name: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path.join(PALWORLD_PALDEX_RELEASE_ROOT, name), "utf8")) as unknown;
  } catch {
    fail(`${name}을 읽거나 검증할 수 없습니다.`);
  }
}

async function main(): Promise<void> {
const argv = process.argv.slice(2);
if (argv.length !== 2 || argv[0] !== "--release" || argv[1] !== PALWORLD_PALDEX_RELEASE) {
  fail(`사용법: rollback:palworld-images --release ${PALWORLD_PALDEX_RELEASE}`);
}

const [artifactValue, imagesValue, reportValue, manifestValue, policyValue, sourceLockText] = await Promise.all([
  readJson("paldex.json"),
  readJson("images-manifest.json"),
  readJson("import-report.json"),
  readJson("manifest.json"),
  readJson(PALWORLD_IMAGE_POLICY_FILE_NAME),
  readFile(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "sources.lock.json"), "utf8")
]);
const currentArtifact = assertPalworldPaldexArtifact(artifactValue);
const currentImages = assertPalworldImagesManifest(imagesValue, currentArtifact);
const currentManifest = assertPalworldPaldexReleaseManifest(manifestValue);
const currentPolicy = assertPalworldImageUsePolicy(policyValue);
const blockedPolicy = assertPalworldImageUsePolicy({
  ...currentPolicy,
  status: "blocked_by_license",
  usageBasis: "none",
  allowPublicDisplay: false,
  allowSelfHosting: false,
  allowResize: false,
  allowWebpConversion: false,
  rightsVerified: false
});
const policyText = deterministicJson(blockedPolicy);
const rollback = buildPalworldImageRollback({
  artifact: currentArtifact,
  imagesManifest: currentImages,
  report: reportValue as Record<string, unknown>,
  manifest: currentManifest,
  blockedPolicy,
  policySha256: sha256Text(policyText)
});
const stagingReleaseRoot = await mkdtemp(path.join(path.dirname(PALWORLD_PALDEX_RELEASE_ROOT), ".palworld-release-rollback-"));
try {
  await Promise.all([
    writeFileAtomic(path.join(stagingReleaseRoot, "paldex.json"), rollback.paldexText),
    writeFileAtomic(path.join(stagingReleaseRoot, "images-manifest.json"), rollback.imagesText),
    writeFileAtomic(path.join(stagingReleaseRoot, "import-report.json"), rollback.reportText),
    writeFileAtomic(path.join(stagingReleaseRoot, "manifest.json"), rollback.manifestText),
    writeFileAtomic(path.join(stagingReleaseRoot, PALWORLD_IMAGE_POLICY_FILE_NAME), policyText),
    writeFileAtomic(path.join(stagingReleaseRoot, "sources.lock.json"), sourceLockText)
  ]);
  await loadPalworldPaldexStagedRelease({
    releaseRoot: stagingReleaseRoot,
    imageRoot: PALWORLD_PALDEX_PUBLIC_IMAGE_ROOT,
    mappingRoot: PALWORLD_PALDEX_MAPPING_ROOT,
    // 롤백은 보존된 미참조 이미지 파일이 손상돼도 공개 참조 제거를 우선해야 한다.
    imageFailureMode: "fallback"
  });
  await writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, PALWORLD_IMAGE_POLICY_FILE_NAME), policyText);
  await Promise.all([
    writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "paldex.json"), rollback.paldexText),
    writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "images-manifest.json"), rollback.imagesText),
    writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "import-report.json"), rollback.reportText)
  ]);
  await writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "manifest.json"), rollback.manifestText);
  await loadPalworldPaldexStagedRelease({ imageRoot: PALWORLD_PALDEX_PUBLIC_IMAGE_ROOT, imageFailureMode: "fallback" });
  console.log(`[palworld-images] 공개 이미지 참조를 0개로 전환했습니다. Pal 텍스트 ${currentArtifact.records.length}종은 유지됩니다.`);
} finally {
  await rm(stagingReleaseRoot, { recursive: true, force: true });
}
}

void main().catch(() => {
  console.error("[palworld-images] rollback에 실패했습니다. 현재 release artifact 검증 결과를 확인하세요.");
  process.exitCode = 1;
});
