import { constants as fsConstants } from "node:fs";
import { link, lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import {
  importOperatorAcknowledgedPalworldImage,
  inspectPalworldWebp,
  palworldSourceImageExists,
  validatePalworldImageFiles
} from "../data/palworld-image-import.js";
import {
  buildPalworldImageRelease,
  type ImportedPalworldImage
} from "../data/palworld-image-release.js";
import {
  PALWORLD_IMAGE_POLICY_FILE_NAME,
  PALWORLD_IMAGE_SOURCE_MAP_FILE_NAME,
  assertPalworldImageSourceMap,
  assertPalworldImageUsePolicy
} from "../data/palworld-image-policy.js";
import {
  PALWORLD_PAL_IMAGE_MAX_BYTES,
  PALWORLD_PALDEX_RELEASE,
  assertPalworldPaldexArtifact,
  assertPalworldPaldexReleaseManifest
} from "../data/palworld-paldex-artifact.js";
import {
  PALWORLD_PALDEX_PUBLIC_IMAGE_ROOT,
  PALWORLD_PALDEX_MAPPING_ROOT,
  PALWORLD_PALDEX_RELEASE_ROOT,
  deterministicJson,
  sha256Bytes,
  writeFileAtomic
} from "../data/palworld-paldex-import.js";
import { loadPalworldPaldexStagedRelease } from "../data/palworld-paldex-loader.js";

type Arguments = {
  release: string;
  sourceDir: string;
  mapping: string;
  policy: string;
};

function fail(message: string): never {
  throw new Error(message);
}

function parseArguments(argv: string[]): Arguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key || !value || !["--release", "--source-dir", "--mapping", "--policy"].includes(key) || values.has(key)) {
      fail("사용법: import:palworld-images -- --release 1.0.1 --source-dir <directory> --mapping <mapping.json> --policy <policy.json>");
    }
    values.set(key, value);
  }
  const release = values.get("--release");
  const sourceDir = values.get("--source-dir");
  const mapping = values.get("--mapping");
  const policy = values.get("--policy");
  if (!release || !sourceDir || !mapping || !policy || values.size !== 4) fail("필수 CLI 인자가 없습니다.");
  if (release !== PALWORLD_PALDEX_RELEASE) fail(`release는 ${PALWORLD_PALDEX_RELEASE}이어야 합니다.`);
  const expectedMapping = path.join(PALWORLD_PALDEX_MAPPING_ROOT, PALWORLD_IMAGE_SOURCE_MAP_FILE_NAME);
  const expectedPolicy = path.join(PALWORLD_PALDEX_RELEASE_ROOT, PALWORLD_IMAGE_POLICY_FILE_NAME);
  if (path.resolve(mapping) !== expectedMapping || path.resolve(policy) !== expectedPolicy) {
    fail("고정 release의 image source mapping과 image-use-policy 경로만 사용할 수 있습니다.");
  }
  return { release, sourceDir, mapping: expectedMapping, policy: expectedPolicy };
}

async function readJson(filePath: string, label: string): Promise<{ bytes: Buffer; value: unknown }> {
  try {
    const bytes = await readFile(filePath);
    return { bytes, value: JSON.parse(bytes.toString("utf8")) as unknown };
  } catch {
    fail(`${label} 파일을 읽거나 검증할 수 없습니다.`);
  }
}

async function publishContentHashFiles(stagingRoot: string): Promise<void> {
  await mkdir(PALWORLD_PALDEX_PUBLIC_IMAGE_ROOT, { recursive: true, mode: 0o755 });
  const outputRootInfo = await lstat(PALWORLD_PALDEX_PUBLIC_IMAGE_ROOT);
  if (outputRootInfo.isSymbolicLink() || !outputRootInfo.isDirectory()) {
    fail("공개 이미지 root는 symlink가 아닌 directory여야 합니다.");
  }
  if (await realpath(PALWORLD_PALDEX_PUBLIC_IMAGE_ROOT) !== path.resolve(PALWORLD_PALDEX_PUBLIC_IMAGE_ROOT)) {
    fail("공개 이미지 root 또는 상위 경로의 symlink를 허용하지 않습니다.");
  }
  for (const fileName of await readdir(stagingRoot)) {
    if (!/^[a-f0-9]{64}\.webp$/u.test(fileName)) fail("staging에 허용되지 않은 이미지 파일이 있습니다.");
    const source = path.join(stagingRoot, fileName);
    const destination = path.join(PALWORLD_PALDEX_PUBLIC_IMAGE_ROOT, fileName);
    try {
      await link(source, destination);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const destinationInfo = await lstat(destination);
      if (
        destinationInfo.isSymbolicLink()
        || !destinationInfo.isFile()
        || destinationInfo.size < 1
        || destinationInfo.size > PALWORLD_PAL_IMAGE_MAX_BYTES
      ) {
        fail("기존 content-hash 경로는 크기 제한 내 regular file이어야 합니다.");
      }
      const handle = await open(destination, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
      let existingBytes: Buffer;
      try {
        const openedInfo = await handle.stat();
        if (
          !openedInfo.isFile()
          || openedInfo.dev !== destinationInfo.dev
          || openedInfo.ino !== destinationInfo.ino
          || openedInfo.size !== destinationInfo.size
        ) {
          fail("검사 중 기존 content-hash 파일이 변경되었습니다.");
        }
        existingBytes = await handle.readFile();
      } finally {
        await handle.close();
      }
      const existing = inspectPalworldWebp(existingBytes);
      if (`${existing.sha256}.webp` !== fileName) fail("기존 content-hash 파일 내용이 다릅니다.");
    }
  }
}

async function main(): Promise<void> {
const args = parseArguments(process.argv.slice(2));
const [paldexFile, reportFile, manifestFile, policyFile, mappingFile, overridesFile] = await Promise.all([
  readJson(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "paldex.json"), "paldex"),
  readJson(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "import-report.json"), "import report"),
  readJson(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "manifest.json"), "release manifest"),
  readJson(args.policy, "image-use-policy"),
  readJson(args.mapping, "image-source-map"),
  readJson(path.join(PALWORLD_PALDEX_MAPPING_ROOT, "image-overrides.json"), "image overrides")
]);
const artifact = assertPalworldPaldexArtifact(paldexFile.value);
const manifest = assertPalworldPaldexReleaseManifest(manifestFile.value);
const policy = assertPalworldImageUsePolicy(policyFile.value);
if (policy.status !== "operator_acknowledged" && policy.status !== "ready") {
  fail("image-use-policy가 공개 반입을 허용하지 않습니다.");
}
const sourceMap = assertPalworldImageSourceMap(mappingFile.value, artifact);
if (deterministicJson(policyFile.value) !== policyFile.bytes.toString("utf8")) fail("image-use-policy는 결정적 JSON 형식이어야 합니다.");
if (deterministicJson(mappingFile.value) !== mappingFile.bytes.toString("utf8")) fail("image-source-map은 결정적 JSON 형식이어야 합니다.");

const imageParent = path.dirname(PALWORLD_PALDEX_PUBLIC_IMAGE_ROOT);
await mkdir(imageParent, { recursive: true, mode: 0o755 });
const stagingImageRoot = await mkdtemp(path.join(imageParent, ".palworld-image-import-"));
const releaseParent = path.dirname(PALWORLD_PALDEX_RELEASE_ROOT);
const stagingReleaseRoot = await mkdtemp(path.join(releaseParent, ".palworld-release-import-"));
try {
  const importedImages = new Map<string, ImportedPalworldImage>();
  for (const mapping of sourceMap.entries) {
    if (!(await palworldSourceImageExists(args.sourceDir, mapping.sourceFileName))) continue;
    const imported = await importOperatorAcknowledgedPalworldImage({
      sourceRoot: args.sourceDir,
      sourceFileName: mapping.sourceFileName,
      imageRoot: stagingImageRoot,
      policy
    });
    importedImages.set(mapping.palId, {
      palId: mapping.palId,
      sourceFileName: mapping.sourceFileName,
      originalSha256: imported.originalSha256,
      generatedSha256: imported.sha256,
      outputFileName: imported.outputFileName,
      outputWidth: imported.width,
      outputHeight: imported.height,
      outputBytes: imported.bytes,
      imageUrl: imported.imageUrl
    });
  }
  if (importedImages.size === 0) fail("PALWORLD_IMAGE_SOURCE_FILES_NOT_FOUND");
  const release = buildPalworldImageRelease({
    baseArtifact: artifact,
    baseReport: reportFile.value as Record<string, unknown>,
    baseManifest: manifest,
    policy,
    policySha256: sha256Bytes(policyFile.bytes),
    sourceMap,
    sourceMapSha256: sha256Bytes(mappingFile.bytes),
    importedImages
  });
  const regenerated = buildPalworldImageRelease({
    baseArtifact: artifact,
    baseReport: reportFile.value as Record<string, unknown>,
    baseManifest: manifest,
    policy,
    policySha256: sha256Bytes(policyFile.bytes),
    sourceMap,
    sourceMapSha256: sha256Bytes(mappingFile.bytes),
    importedImages
  });
  for (const key of ["paldexText", "imagesText", "reportText", "manifestText"] as const) {
    if (release[key] !== regenerated[key]) fail(`${key} 재생성 결과가 byte-for-byte 일치하지 않습니다.`);
  }
  await validatePalworldImageFiles({
    manifest: release.imagesManifest,
    imageRoot: stagingImageRoot,
    overrides: overridesFile.value
  });
  await Promise.all([
    writeFileAtomic(path.join(stagingReleaseRoot, "paldex.json"), release.paldexText),
    writeFileAtomic(path.join(stagingReleaseRoot, "images-manifest.json"), release.imagesText),
    writeFileAtomic(path.join(stagingReleaseRoot, "import-report.json"), release.reportText),
    writeFileAtomic(path.join(stagingReleaseRoot, "manifest.json"), release.manifestText),
    writeFileAtomic(path.join(stagingReleaseRoot, PALWORLD_IMAGE_POLICY_FILE_NAME), policyFile.bytes.toString("utf8")),
    writeFileAtomic(
      path.join(stagingReleaseRoot, "sources.lock.json"),
      await readFile(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "sources.lock.json"), "utf8")
    )
  ]);
  await loadPalworldPaldexStagedRelease({
    releaseRoot: stagingReleaseRoot,
    imageRoot: stagingImageRoot,
    mappingRoot: PALWORLD_PALDEX_MAPPING_ROOT,
    imageFailureMode: "throw"
  });
  await publishContentHashFiles(stagingImageRoot);
  await Promise.all([
    writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "paldex.json"), release.paldexText),
    writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "images-manifest.json"), release.imagesText),
    writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "import-report.json"), release.reportText)
  ]);
  await writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "manifest.json"), release.manifestText);
  await loadPalworldPaldexStagedRelease({ imageRoot: PALWORLD_PALDEX_PUBLIC_IMAGE_ROOT, imageFailureMode: "throw" });
  console.log(`[palworld-images] 기술 검증 이미지 ${importedImages.size}개를 반입했습니다. fallback ${artifact.records.length - importedImages.size}개`);
} finally {
  await Promise.all([
    rm(stagingImageRoot, { recursive: true, force: true }),
    rm(stagingReleaseRoot, { recursive: true, force: true })
  ]);
}
}

void main().catch((error: unknown) => {
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{2,80}$/u.test(error.message) ? ` (${error.message})` : "";
  console.error(`[palworld-images] 반입에 실패했습니다${code}. mapping, policy 및 source 파일 검증 결과를 확인하세요.`);
  process.exitCode = 1;
});
