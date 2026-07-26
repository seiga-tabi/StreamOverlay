import { randomBytes } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  rename,
  rm
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertPalworldMapLocationClassMapping,
  createPalworldMapLocationCompatibilityApproval,
  createPalworldMapLocationManifest,
  deterministicMapLocationJson,
  generatePalworldMapLocationCandidate,
  PALWORLD_MAP_LOCATION_ARTIFACT_FILE,
  PALWORLD_MAP_LOCATION_COMPATIBILITY_FILE,
  PALWORLD_MAP_LOCATION_MANIFEST_FILE,
  PALWORLD_MAP_LOCATION_REPORT_FILE
} from "../data/palworld-map-world-export.js";
import {
  assertPalworldMapMarkerMapping
} from "../data/palworld-map-marker-generator.js";
import {
  loadPalworldMapImageManifest
} from "../data/palworld-map-image-manifest.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const DEFAULT_RELEASE_ROOT = path.join(
  REPOSITORY_ROOT,
  "apps/server/data/palworld/1.0.1"
);
const DEFAULT_MAPPING_PATH = path.join(
  REPOSITORY_ROOT,
  "apps/server/src/data/palworld-map-mappings/location-classes.json"
);
const DEFAULT_TRANSFORM_MAPPING_PATH = path.join(
  REPOSITORY_ROOT,
  "apps/server/src/data/palworld-map-mappings/main-map-transform.json"
);

type Arguments = {
  archivePath: string;
  releaseRoot: string;
  mappingPath: string;
  transformMappingPath: string;
  publish: boolean;
};

function parseArguments(argv: string[]): Arguments {
  let archivePath: string | undefined;
  let releaseRoot = DEFAULT_RELEASE_ROOT;
  let mappingPath = DEFAULT_MAPPING_PATH;
  let transformMappingPath = DEFAULT_TRANSFORM_MAPPING_PATH;
  let publish = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--publish") {
      publish = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value) throw new TypeError(`${argument}: 값이 필요합니다.`);
    if (argument === "--archive") archivePath = path.resolve(value);
    else if (argument === "--release-root") releaseRoot = path.resolve(value);
    else if (argument === "--mapping") mappingPath = path.resolve(value);
    else if (argument === "--transform-mapping") {
      transformMappingPath = path.resolve(value);
    } else {
      throw new TypeError(`${argument}: 허용되지 않은 인자입니다.`);
    }
    index += 1;
  }
  if (!archivePath) {
    throw new TypeError(
      "사용법: import:palworld-map-locations -- --archive <Maps.zip> "
      + "[--release-root <release>] [--mapping <location-classes.json>] "
      + "[--transform-mapping <main-map-transform.json>] [--publish]"
    );
  }
  return {
    archivePath,
    releaseRoot,
    mappingPath,
    transformMappingPath,
    publish
  };
}

async function writeAtomicExclusive(
  filePath: string,
  contents: string
): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
  const handle = await open(temporaryPath, "wx", 0o644);
  try {
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
  await handle.close();
  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

let releaseLock:
  | { path: string; handle: Awaited<ReturnType<typeof open>> }
  | undefined;
try {
  const args = parseArguments(process.argv.slice(2));
  if (args.publish) {
    await mkdir(args.releaseRoot, { recursive: true });
    const lockPath = path.join(args.releaseRoot, ".map-locations-import.lock");
    const lockHandle = await open(lockPath, "wx", 0o600);
    await lockHandle.writeFile(`${process.pid}\n`, "utf8");
    releaseLock = { path: lockPath, handle: lockHandle };
  }
  const [mappingBytes, transformMappingBytes] = await Promise.all([
    readFile(args.mappingPath),
    readFile(args.transformMappingPath)
  ]);
  const mapping = assertPalworldMapLocationClassMapping(
    JSON.parse(mappingBytes.toString("utf8")) as unknown
  );
  const transformMapping = assertPalworldMapMarkerMapping(
    JSON.parse(transformMappingBytes.toString("utf8")) as unknown
  );
  const mapImagesManifest = await loadPalworldMapImageManifest(
    args.releaseRoot,
    mapping.targetGameVersion
  );
  const generate = async () => await generatePalworldMapLocationCandidate({
    archivePath: args.archivePath,
    mapping,
    mappingBytes,
    transformMapping,
    transformMappingBytes,
    mapImagesManifest
  });
  const first = await generate();
  const firstArtifactText = deterministicMapLocationJson(first.artifact);
  const firstReportText = deterministicMapLocationJson(first.report);
  const second = await generate();
  const secondArtifactText = deterministicMapLocationJson(second.artifact);
  const secondReportText = deterministicMapLocationJson(second.report);
  if (
    firstArtifactText !== secondArtifactText
    || firstReportText !== secondReportText
  ) {
    throw new Error(
      "동일 Maps.zip 입력의 artifact/report가 byte-for-byte 결정적이지 않습니다."
    );
  }
  const manifest = createPalworldMapLocationManifest({
    artifactText: firstArtifactText,
    report: first.report
  });
  const manifestText = deterministicMapLocationJson(manifest);
  const approval = createPalworldMapLocationCompatibilityApproval({
    mapping,
    manifest,
    manifestText,
    artifact: first.artifact,
    report: first.report
  });
  const approvalText = deterministicMapLocationJson(approval);

  if (args.publish) {
    await mkdir(args.releaseRoot, { recursive: true });
    // Candidate 본문과 report를 먼저 게시하고 manifest를 마지막에 교체합니다.
    await writeAtomicExclusive(
      path.join(args.releaseRoot, PALWORLD_MAP_LOCATION_ARTIFACT_FILE),
      firstArtifactText
    );
    await writeAtomicExclusive(
      path.join(args.releaseRoot, PALWORLD_MAP_LOCATION_REPORT_FILE),
      firstReportText
    );
    await writeAtomicExclusive(
      path.join(args.releaseRoot, PALWORLD_MAP_LOCATION_COMPATIBILITY_FILE),
      approvalText
    );
    await writeAtomicExclusive(
      path.join(args.releaseRoot, PALWORLD_MAP_LOCATION_MANIFEST_FILE),
      manifestText
    );
  }

  const counts = first.report.counts;
  process.stdout.write(
    `[palworld-map-locations] ${args.publish ? "candidate 게시 완료" : "검증 완료"}: `
    + `source ${counts.sourceActors}개, MainMap ${counts.included}개, `
    + `Tree ${counts.treeIncluded}개, 좌표 미해결 ${counts.coordinateUnresolved}개, `
    + `bounds 밖 ${counts.outOfBoundsExcluded}개, `
    + `selected member ${counts.selectedMembers}개\n`
  );
} catch (error) {
  const message = error instanceof Error
    ? error.message
    : "알 수 없는 지도 위치 import 오류";
  process.stderr.write(
    `[PALWORLD_MAP_LOCATION_IMPORT_FAILED] ${message}\n`
  );
  process.exitCode = 1;
} finally {
  if (releaseLock !== undefined) {
    await releaseLock.handle.close().catch(() => undefined);
    await rm(releaseLock.path, { force: true }).catch(() => undefined);
  }
}
