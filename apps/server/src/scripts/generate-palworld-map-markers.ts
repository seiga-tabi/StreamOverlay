import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generatePalworldMapMarkerArtifact,
  assertPalworldMapMarkerMapping
} from "../data/palworld-map-marker-generator.js";
import {
  PALWORLD_MAP_MARKER_ARTIFACT_FILE,
  PALWORLD_MAP_MARKER_MANIFEST_FILE,
  assertPalworldMapMarkerArtifactManifest,
  createPalworldMapMarkerArtifact,
  loadPalworldMapMarkerArtifact
} from "../data/palworld-map-marker-artifact.js";
import {
  deterministicJson,
  sha256Bytes,
  writeFileAtomic
} from "../data/palworld-paldex-import.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const DEFAULT_RELEASE_ROOT = path.join(
  REPOSITORY_ROOT,
  "apps/server/data/palworld/1.0.1"
);
const DEFAULT_MAPPING_PATH = path.join(
  REPOSITORY_ROOT,
  "apps/server/src/data/palworld-map-mappings/main-map-transform.json"
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
};

function parseArguments(argv: string[]): Arguments {
  let archivePath: string | undefined;
  let releaseRoot = DEFAULT_RELEASE_ROOT;
  let mappingPath = DEFAULT_MAPPING_PATH;
  let dashboardStaticRoot = DEFAULT_DASHBOARD_STATIC_ROOT;
  let activate = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--activate") {
      activate = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value) throw new TypeError(`${argument}: 값이 필요합니다.`);
    if (argument === "--archive") archivePath = path.resolve(value);
    else if (argument === "--release-root") releaseRoot = path.resolve(value);
    else if (argument === "--mapping") mappingPath = path.resolve(value);
    else if (argument === "--dashboard-static-root") dashboardStaticRoot = path.resolve(value);
    else throw new TypeError(`${argument}: 허용되지 않은 인자입니다.`);
    index += 1;
  }
  if (!archivePath) {
    throw new TypeError(
      "사용법: generate:palworld-map-markers -- --archive <Content.zip> "
      + "[--release-root <release>] [--mapping <mapping.json>] "
      + "[--dashboard-static-root <public-or-dist>] [--activate]"
    );
  }
  return {
    archivePath,
    releaseRoot,
    mappingPath,
    dashboardStaticRoot,
    activate
  };
}

try {
  const args = parseArguments(process.argv.slice(2));
  const mapping = assertPalworldMapMarkerMapping(
    JSON.parse(await readFile(args.mappingPath, "utf8")) as unknown
  );
  const targetMapPath = path.resolve(
    args.dashboardStaticRoot,
    `.${mapping.targetMapAsset.imageUrl}`
  );
  if (!targetMapPath.startsWith(`${path.resolve(args.dashboardStaticRoot)}${path.sep}`)) {
    throw new TypeError("target map asset이 Dashboard static root 밖을 가리킵니다.");
  }
  const result = await generatePalworldMapMarkerArtifact({
    archivePath: args.archivePath,
    mapping,
    paldexPath: path.join(args.releaseRoot, "paldex.json"),
    targetMapPath
  });
  const firstArtifactText = deterministicJson(result.artifact);
  const secondArtifactText = deterministicJson(
    createPalworldMapMarkerArtifact(
      JSON.parse(firstArtifactText) as typeof result.artifact
    )
  );
  if (firstArtifactText !== secondArtifactText) {
    throw new Error("동일 입력 artifact가 byte-for-byte 결정적이지 않습니다.");
  }
  const manifest = assertPalworldMapMarkerArtifactManifest({
    schemaVersion: 1,
    targetGameVersion: mapping.targetGameVersion,
    artifactFile: PALWORLD_MAP_MARKER_ARTIFACT_FILE,
    artifactSha256: sha256Bytes(Buffer.from(firstArtifactText, "utf8"))
  });
  const manifestText = deterministicJson(manifest);
  const stagingRoot = await mkdtemp(path.join(path.dirname(args.releaseRoot), ".map-markers-"));
  try {
    await Promise.all([
      writeFile(
        path.join(stagingRoot, PALWORLD_MAP_MARKER_ARTIFACT_FILE),
        firstArtifactText,
        { encoding: "utf8", mode: 0o644 }
      ),
      writeFile(
        path.join(stagingRoot, PALWORLD_MAP_MARKER_MANIFEST_FILE),
        manifestText,
        { encoding: "utf8", mode: 0o644 }
      )
    ]);
    await loadPalworldMapMarkerArtifact(stagingRoot);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }

  if (args.activate) {
    if (result.artifact.activation !== "active") {
      throw new Error(
        "source gameVersion과 Steam build ID가 검증되지 않은 marker candidate는 활성화할 수 없습니다."
      );
    }
    await writeFileAtomic(
      path.join(args.releaseRoot, PALWORLD_MAP_MARKER_ARTIFACT_FILE),
      firstArtifactText
    );
    // Manifest를 마지막에 교체하여 기존 runtime provider가 불완전한 artifact를 참조하지 않게 한다.
    await writeFileAtomic(
      path.join(args.releaseRoot, PALWORLD_MAP_MARKER_MANIFEST_FILE),
      manifestText
    );
    await loadPalworldMapMarkerArtifact(args.releaseRoot);
  }

  process.stdout.write(
    `[palworld-map] ${args.activate ? "active artifact 게시 완료" : "검증 전용 생성 완료"}: `
    + `source ${result.counts.sourceRows}행, MainMap 보스 ${result.counts.mainMarkers}개, `
    + `Tree 보스 ${result.counts.treeMarkers}개, 비 Pal ${result.counts.nonPalRows}개\n`
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "알 수 없는 지도 marker 생성 오류";
  process.stderr.write(`[PALWORLD_MAP_MARKER_GENERATION_FAILED] ${message}\n`);
  process.exitCode = 1;
}
