import {
  lstat,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertPalworldSpawnMapping,
  generatePalworldSpawnArtifact
} from "../data/palworld-spawn-generator.js";
import {
  PALWORLD_SPAWN_ARTIFACT_FILE,
  PALWORLD_SPAWN_MANIFEST_FILE,
  assertPalworldSpawnArtifactManifest,
  createPalworldSpawnArtifact,
  loadPalworldSpawnArtifact
} from "../data/palworld-spawn-artifact.js";
import {
  deterministicJson,
  sha256Bytes,
  writeFileAtomic
} from "../data/palworld-paldex-import.js";
import {
  assertPalworldPakExportMetadata,
  type PalworldPakExportMetadata
} from "../data/palworld-pak-preflight.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const DEFAULT_RELEASE_ROOT = path.join(
  REPOSITORY_ROOT,
  "apps/server/data/palworld/1.0.1"
);
const DEFAULT_MAPPING_PATH = path.join(
  REPOSITORY_ROOT,
  "apps/server/src/data/palworld-map-mappings/main-map-spawns.json"
);
const DEFAULT_DASHBOARD_STATIC_ROOT = path.join(
  REPOSITORY_ROOT,
  "apps/dashboard/public"
);

type Arguments = {
  archivePath: string;
  releaseRoot: string;
  mappingPath: string;
  dashboardStaticRoot: string;
  activate: boolean;
  publishCandidate: boolean;
  metadataPath?: string;
  mappingsPath?: string;
};

function parseArguments(argv: string[]): Arguments {
  let archivePath: string | undefined;
  let releaseRoot = DEFAULT_RELEASE_ROOT;
  let mappingPath = DEFAULT_MAPPING_PATH;
  let dashboardStaticRoot = DEFAULT_DASHBOARD_STATIC_ROOT;
  let activate = false;
  let publishCandidate = false;
  let metadataPath: string | undefined;
  let mappingsPath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--activate") {
      activate = true;
      continue;
    }
    if (argument === "--publish-candidate") {
      publishCandidate = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value) throw new TypeError(`${argument}: 값이 필요합니다.`);
    if (argument === "--archive") archivePath = path.resolve(value);
    else if (argument === "--release-root") releaseRoot = path.resolve(value);
    else if (argument === "--mapping") mappingPath = path.resolve(value);
    else if (argument === "--dashboard-static-root") dashboardStaticRoot = path.resolve(value);
    else if (argument === "--metadata") metadataPath = path.resolve(value);
    else if (argument === "--mappings-usmap") mappingsPath = path.resolve(value);
    else throw new TypeError(`${argument}: 허용되지 않은 인자입니다.`);
    index += 1;
  }
  if (!archivePath) {
    throw new TypeError(
      "사용법: generate:palworld-spawns -- --archive <Content.zip> "
      + "[--release-root <release>] [--mapping <mapping.json>] "
      + "[--dashboard-static-root <public-or-dist>] "
      + "[--metadata <metadata.json> --mappings-usmap <Mappings.usmap>] "
      + "[--publish-candidate | --activate]"
    );
  }
  if (activate && publishCandidate) {
    throw new TypeError("--activate와 --publish-candidate는 동시에 사용할 수 없습니다.");
  }
  if ((metadataPath === undefined) !== (mappingsPath === undefined)) {
    throw new TypeError("--metadata와 --mappings-usmap은 함께 제공해야 합니다.");
  }
  if (activate && metadataPath === undefined) {
    throw new TypeError(
      "--activate에는 검증된 --metadata와 --mappings-usmap이 필요합니다."
    );
  }
  return {
    archivePath,
    releaseRoot,
    mappingPath,
    dashboardStaticRoot,
    activate,
    publishCandidate,
    metadataPath,
    mappingsPath
  };
}

async function readMetadata(metadataPath: string): Promise<PalworldPakExportMetadata> {
  const resolved = path.resolve(metadataPath);
  const info = await lstat(resolved);
  if (
    !info.isFile()
    || info.isSymbolicLink()
    || info.size < 1
    || info.size > 64 * 1024
    || await realpath(resolved) !== resolved
  ) {
    throw new TypeError(
      "metadata는 64 KiB 이하의 symlink가 아닌 canonical regular file이어야 합니다."
    );
  }
  return assertPalworldPakExportMetadata(
    JSON.parse(await readFile(resolved, "utf8")) as unknown
  );
}

try {
  const args = parseArguments(process.argv.slice(2));
  const sourceMetadata = args.metadataPath === undefined
    ? undefined
    : await readMetadata(args.metadataPath);
  const mapping = assertPalworldSpawnMapping(
    JSON.parse(await readFile(args.mappingPath, "utf8")) as unknown
  );
  const targetMapPath = path.resolve(
    args.dashboardStaticRoot,
    `.${mapping.targetMapAsset.imageUrl}`
  );
  if (!targetMapPath.startsWith(`${path.resolve(args.dashboardStaticRoot)}${path.sep}`)) {
    throw new TypeError("target map asset이 Dashboard static root 밖을 가리킵니다.");
  }
  const result = await generatePalworldSpawnArtifact({
    archivePath: args.archivePath,
    mapping,
    paldexPath: path.join(args.releaseRoot, "paldex.json"),
    targetMapPath,
    activation: args.activate ? "active" : "candidate",
    sourceMetadata,
    mappingsPath: args.mappingsPath
  });
  const firstArtifactText = deterministicJson(result.artifact);
  const secondArtifactText = deterministicJson(
    createPalworldSpawnArtifact(
      JSON.parse(firstArtifactText) as typeof result.artifact
    )
  );
  if (firstArtifactText !== secondArtifactText) {
    throw new Error("동일 입력 spawn artifact가 byte-for-byte 결정적이지 않습니다.");
  }
  const manifest = assertPalworldSpawnArtifactManifest({
    schemaVersion: 1,
    targetGameVersion: mapping.targetGameVersion,
    artifactFile: PALWORLD_SPAWN_ARTIFACT_FILE,
    artifactSha256: sha256Bytes(Buffer.from(firstArtifactText, "utf8"))
  });
  const manifestText = deterministicJson(manifest);
  const stagingRoot = await mkdtemp(path.join(path.dirname(args.releaseRoot), ".map-spawns-"));
  try {
    await Promise.all([
      writeFile(
        path.join(stagingRoot, PALWORLD_SPAWN_ARTIFACT_FILE),
        firstArtifactText,
        { encoding: "utf8", mode: 0o644 }
      ),
      writeFile(
        path.join(stagingRoot, PALWORLD_SPAWN_MANIFEST_FILE),
        manifestText,
        { encoding: "utf8", mode: 0o644 }
      )
    ]);
    await loadPalworldSpawnArtifact(stagingRoot);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }

  if (args.activate || args.publishCandidate) {
    await writeFileAtomic(
      path.join(args.releaseRoot, PALWORLD_SPAWN_ARTIFACT_FILE),
      firstArtifactText
    );
    // Manifest를 마지막에 교체하여 기존 runtime이 불완전한 spawn artifact를 참조하지 않게 한다.
    await writeFileAtomic(
      path.join(args.releaseRoot, PALWORLD_SPAWN_MANIFEST_FILE),
      manifestText
    );
    await loadPalworldSpawnArtifact(args.releaseRoot);
  }

  process.stdout.write(
    `[palworld-spawns] ${
      args.activate
        ? "active artifact 게시 완료"
        : args.publishCandidate
          ? "candidate artifact 게시 완료"
          : "검증 전용 생성 완료"
    }: `
    + `Pal ${result.counts.palCount}종, 위치 ${result.counts.placementLinks}개, `
    + `32×32 cluster ${result.counts.clusteredPoints}개, `
    + `미해결 occurrence ${result.counts.unresolvedPalOccurrences}개, `
    + `분포 보조 검증 ${result.distributionAudit.sourceRows}행, `
    + `spawn Pal exact coverage ${result.distributionAudit.spawnPalsWithDistribution}`
    + `/${result.counts.palCount}종\n`
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "알 수 없는 일반 스폰 생성 오류";
  process.stderr.write(`[PALWORLD_SPAWN_GENERATION_FAILED] ${message}\n`);
  process.exitCode = 1;
}
