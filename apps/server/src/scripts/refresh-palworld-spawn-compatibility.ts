import { createHash } from "node:crypto";
import {
  copyFile,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadPalworldSpawnArtifact,
  PALWORLD_SPAWN_ARTIFACT_FILE,
  PALWORLD_SPAWN_MANIFEST_FILE
} from "../data/palworld-spawn-artifact.js";
import {
  assertPalworldSpawnCompatibilityApproval,
  createPalworldSpawnCompatibilityApproval,
  loadPalworldSpawnCompatibilityAuthorization,
  PALWORLD_SPAWN_COMPATIBILITY_FILE
} from "../data/palworld-spawn-compatibility.js";
import {
  deterministicJson,
  writeFileAtomic
} from "../data/palworld-paldex-import.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const DEFAULT_RELEASE_ROOT = path.join(
  REPOSITORY_ROOT,
  "apps/server/data/palworld/1.0.1"
);
const MAP_IMAGES_MANIFEST_FILE = "map-images-manifest.json";
const PALDEX_FILE = "paldex.json";

function checksum(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseArguments(argv: string[]): {
  releaseRoot: string;
  publish: boolean;
} {
  let releaseRoot = DEFAULT_RELEASE_ROOT;
  let publish = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--publish") {
      publish = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value) throw new TypeError(`${argument}: 값이 필요합니다.`);
    if (argument === "--release-root") {
      releaseRoot = path.resolve(value);
    } else {
      throw new TypeError(`${argument}: 허용되지 않은 인자입니다.`);
    }
    index += 1;
  }
  return { releaseRoot, publish };
}

try {
  const args = parseArguments(process.argv.slice(2));
  const [previousBytes, mapImagesManifestBytes] = await Promise.all([
    readFile(path.join(args.releaseRoot, PALWORLD_SPAWN_COMPATIBILITY_FILE)),
    readFile(path.join(args.releaseRoot, MAP_IMAGES_MANIFEST_FILE))
  ]);
  const previousApproval = assertPalworldSpawnCompatibilityApproval(
    JSON.parse(previousBytes.toString("utf8")) as unknown
  );
  const approval = createPalworldSpawnCompatibilityApproval({
    previousApproval,
    mapImagesManifestSha256: checksum(mapImagesManifestBytes)
  });
  const approvalText = deterministicJson(approval);
  const approvalSha256 = checksum(approvalText);
  const stagingRoot = await mkdtemp(
    path.join(path.dirname(args.releaseRoot), ".map-spawns-compatible-")
  );
  try {
    await Promise.all([
      copyFile(
        path.join(args.releaseRoot, PALWORLD_SPAWN_ARTIFACT_FILE),
        path.join(stagingRoot, PALWORLD_SPAWN_ARTIFACT_FILE)
      ),
      copyFile(
        path.join(args.releaseRoot, PALWORLD_SPAWN_MANIFEST_FILE),
        path.join(stagingRoot, PALWORLD_SPAWN_MANIFEST_FILE)
      ),
      copyFile(
        path.join(args.releaseRoot, PALDEX_FILE),
        path.join(stagingRoot, PALDEX_FILE)
      ),
      writeFile(
        path.join(stagingRoot, MAP_IMAGES_MANIFEST_FILE),
        mapImagesManifestBytes,
        { mode: 0o644 }
      ),
      writeFile(
        path.join(stagingRoot, PALWORLD_SPAWN_COMPATIBILITY_FILE),
        approvalText,
        { encoding: "utf8", mode: 0o644 }
      )
    ]);
    const artifact = await loadPalworldSpawnArtifact(stagingRoot);
    await loadPalworldSpawnCompatibilityAuthorization({
      releaseRoot: stagingRoot,
      artifact,
      expectedApprovalSha256: approvalSha256
    });
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
  if (args.publish) {
    await writeFileAtomic(
      path.join(args.releaseRoot, PALWORLD_SPAWN_COMPATIBILITY_FILE),
      approvalText
    );
  }
  process.stdout.write(
    `[palworld-spawns] map image compatibility ${
      args.publish ? "게시 완료" : "검증 완료"
    }: ${approvalSha256}\n`
  );
} catch (error) {
  const message = error instanceof Error
    ? error.message
    : "알 수 없는 spawn compatibility 갱신 오류";
  process.stderr.write(
    `[PALWORLD_SPAWN_COMPATIBILITY_REFRESH_FAILED] ${message}\n`
  );
  process.exitCode = 1;
}
