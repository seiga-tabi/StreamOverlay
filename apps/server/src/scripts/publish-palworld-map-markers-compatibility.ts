import { createHash } from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertPalworldMapMarkerArtifactManifest,
  createPalworldMapMarkerArtifact,
  loadPalworldMapMarkerArtifact,
  PALWORLD_MAP_MARKER_ARTIFACT_FILE,
  PALWORLD_MAP_MARKER_MANIFEST_FILE
} from "../data/palworld-map-marker-artifact.js";
import {
  assertPalworldMapMarkerCompatibilityApproval,
  loadPalworldMapMarkerCompatibilityAuthorization,
  palworldMapMarkerCompatibilityEvidenceChecksum,
  palworldMapMarkerTransformChecksum,
  PALWORLD_MAP_MARKER_COMPATIBILITY_FILE,
  type PalworldMapMarkerCompatibilityApproval
} from "../data/palworld-map-marker-compatibility.js";
import {
  assertPalworldMapMarkerWorldsMapping,
  generatePalworldMapMarkerArtifact
} from "../data/palworld-map-marker-generator.js";
import { assertPalworldPaldexArtifact } from "../data/palworld-paldex-artifact.js";
import {
  deterministicJson,
  sha256Bytes,
  writeFileAtomic
} from "../data/palworld-paldex-import.js";
import { withPalworldPakArchive } from "../data/palworld-pak-preflight.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const DEFAULT_RELEASE_ROOT = path.join(
  REPOSITORY_ROOT,
  "apps/server/data/palworld/1.0.1"
);
const DEFAULT_MAPPING_PATH = path.join(
  REPOSITORY_ROOT,
  "apps/server/src/data/palworld-map-mappings/map-marker-worlds.json"
);
const DEFAULT_DASHBOARD_STATIC_ROOT = path.join(
  REPOSITORY_ROOT,
  "apps/dashboard/public"
);
const DEFAULT_MAPPINGS_MEMBER = "Mappings101.usmap";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const REVIEWER_PATTERN = /^[a-z0-9][a-z0-9._-]{2,79}$/u;

type Arguments = {
  archivePath: string;
  dashboardStaticRoot: string;
  mappingPath: string;
  mappingsArchivePath: string;
  mappingsArchiveSha256: string;
  mappingsMember: string;
  publish: boolean;
  releaseRoot: string;
  reviewedAt: string;
  reviewer: string;
};

function parseArguments(argv: string[]): Arguments {
  let archivePath: string | undefined;
  let mappingsArchivePath: string | undefined;
  let mappingsArchiveSha256: string | undefined;
  let reviewedAt: string | undefined;
  let reviewer: string | undefined;
  let releaseRoot = DEFAULT_RELEASE_ROOT;
  let mappingPath = DEFAULT_MAPPING_PATH;
  let dashboardStaticRoot = DEFAULT_DASHBOARD_STATIC_ROOT;
  let mappingsMember = DEFAULT_MAPPINGS_MEMBER;
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
    else if (argument === "--mappings-archive") {
      mappingsArchivePath = path.resolve(value);
    } else if (argument === "--mappings-archive-sha256") {
      mappingsArchiveSha256 = value;
    } else if (argument === "--mappings-member") {
      mappingsMember = value;
    } else if (argument === "--reviewed-at") {
      reviewedAt = value;
    } else if (argument === "--reviewer") {
      reviewer = value;
    } else if (argument === "--release-root") {
      releaseRoot = path.resolve(value);
    } else if (argument === "--mapping") {
      mappingPath = path.resolve(value);
    } else if (argument === "--dashboard-static-root") {
      dashboardStaticRoot = path.resolve(value);
    } else {
      throw new TypeError(`${argument}: 허용되지 않은 인자입니다.`);
    }
    index += 1;
  }
  if (
    !archivePath
    || !mappingsArchivePath
    || !mappingsArchiveSha256
    || !reviewedAt
    || !reviewer
  ) {
    throw new TypeError(
      "사용법: publish:palworld-map-markers-compatibility -- "
      + "--archive <Content.zip> --mappings-archive <delta.zip> "
      + "--mappings-archive-sha256 <sha256> --reviewed-at <RFC3339> "
      + "--reviewer <id> [--publish]"
    );
  }
  if (!SHA256_PATTERN.test(mappingsArchiveSha256)) {
    throw new TypeError("--mappings-archive-sha256는 소문자 64자리 SHA-256이어야 합니다.");
  }
  if (
    !RFC3339_PATTERN.test(reviewedAt)
    || Number.isNaN(Date.parse(reviewedAt))
    || new Date(reviewedAt).toISOString() !== reviewedAt
  ) {
    throw new TypeError("--reviewed-at은 밀리초와 Z를 포함한 strict RFC3339여야 합니다.");
  }
  if (!REVIEWER_PATTERN.test(reviewer)) {
    throw new TypeError("--reviewer는 안전한 소문자 식별자여야 합니다.");
  }
  return {
    archivePath,
    dashboardStaticRoot,
    mappingPath,
    mappingsArchivePath,
    mappingsArchiveSha256,
    mappingsMember,
    publish,
    releaseRoot,
    reviewedAt,
    reviewer
  };
}

function checksum(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

try {
  const args = parseArguments(process.argv.slice(2));
  const mappingBytes = await readFile(args.mappingPath);
  const mapping = assertPalworldMapMarkerWorldsMapping(
    JSON.parse(mappingBytes.toString("utf8")) as unknown
  );
  const targetMapPath = path.resolve(
    args.dashboardStaticRoot,
    `.${mapping.targetMapAsset.imageUrl}`
  );
  const targetTreeMapPath = path.resolve(
    args.dashboardStaticRoot,
    `.${mapping.targetTreeMapAsset.imageUrl}`
  );
  if (
    !targetMapPath.startsWith(
      `${path.resolve(args.dashboardStaticRoot)}${path.sep}`
    )
    || !targetTreeMapPath.startsWith(
      `${path.resolve(args.dashboardStaticRoot)}${path.sep}`
    )
  ) {
    throw new TypeError("target map asset이 Dashboard static root 밖을 가리킵니다.");
  }
  const result = await generatePalworldMapMarkerArtifact({
    archivePath: args.archivePath,
    mapping,
    paldexPath: path.join(args.releaseRoot, "paldex.json"),
    targetMapPath,
    targetTreeMapPath
  });
  if (result.artifact.activation !== "candidate") {
    throw new TypeError(
      "이 명령은 source metadata가 없는 candidate marker에만 compatibility approval을 생성합니다."
    );
  }
  const artifactText = deterministicJson(result.artifact);
  const regeneratedText = deterministicJson(
    createPalworldMapMarkerArtifact(
      JSON.parse(artifactText) as typeof result.artifact
    )
  );
  if (artifactText !== regeneratedText) {
    throw new Error("동일 입력 marker artifact가 byte-for-byte 결정적이지 않습니다.");
  }
  const artifactSha256 = sha256Bytes(Buffer.from(artifactText, "utf8"));
  const manifest = assertPalworldMapMarkerArtifactManifest({
    schemaVersion: 1,
    targetGameVersion: mapping.targetGameVersion,
    artifactFile: PALWORLD_MAP_MARKER_ARTIFACT_FILE,
    artifactSha256
  });
  const manifestText = deterministicJson(manifest);
  const [paldexBytes, mapImagesManifestBytes, mappingsEvidence] =
    await Promise.all([
      readFile(path.join(args.releaseRoot, "paldex.json")),
      readFile(path.join(args.releaseRoot, "map-images-manifest.json")),
      withPalworldPakArchive(
        args.mappingsArchivePath,
        {
          expectedSha256: args.mappingsArchiveSha256,
          profile: "fixed_asset_overlay"
        },
        async (reader) => {
          const memberBytes = await reader.readBytes(
            args.mappingsMember,
            8 * 1024 * 1024
          );
          return {
            archiveSha256: reader.archiveSha256,
            member: args.mappingsMember,
            sha256: checksum(memberBytes)
          };
        }
      )
    ]);
  const paldex = assertPalworldPaldexArtifact(
    JSON.parse(paldexBytes.toString("utf8")) as unknown
  );
  if (paldex.release !== mapping.targetGameVersion) {
    throw new TypeError("활성 Paldex release와 marker mapping release가 다릅니다.");
  }
  const mainWorld = result.artifact.worlds.find(
    (world) => world.world === "main"
  );
  const treeWorld = result.artifact.worlds.find(
    (world) => world.world === "tree"
  );
  if (!mainWorld || !treeWorld) {
    throw new TypeError(
      "compatibility approval 대상 MainMap·Tree marker가 모두 필요합니다."
    );
  }
  const withoutEvidenceChecksum = {
    schemaVersion: 2,
    release: mapping.targetGameVersion,
    status: "operator_acknowledged",
    decision: "allow_exact_checksum_compatibility_display",
    sourceVersionVerified: false,
    compatibilityBasis: "exact_map_geometry_and_coordinate_transform",
    sourceArchiveSha256: mapping.sourceArchiveSha256,
    sourceTables: {
      bossTable: { ...mapping.bossTable },
      worldMapTable: { ...mapping.worldMapTable }
    },
    sourceMapAsset: { ...mapping.sourceMapAsset },
    sourceTreeMapAsset: { ...mapping.sourceTreeMapAsset },
    mappingsEvidence,
    generationMappingSha256: checksum(mappingBytes),
    paldexSha256: checksum(paldexBytes),
    targetPaldexSteamBuildId: paldex.steamBuildId,
    markerArtifactSha256: artifactSha256,
    markerManifestSha256: checksum(manifestText),
    mapImagesManifestSha256: checksum(mapImagesManifestBytes),
    targetMapAssetSha256: mainWorld.targetMapAssetSha256,
    targetTreeMapAssetSha256: treeWorld.targetMapAssetSha256,
    transformRevision: mainWorld.transform.revision,
    transformSha256: palworldMapMarkerTransformChecksum(
      mainWorld.transform
    ),
    treeTransformRevision: treeWorld.transform.revision,
    treeTransformSha256: palworldMapMarkerTransformChecksum(
      treeWorld.transform
    ),
    counts: {
      ...result.counts,
      exactJoinMismatches: 0
    },
    reviewedAt: args.reviewedAt,
    reviewer: args.reviewer,
    rightsVerified: false,
    usageBasis: "operator_reference_use"
  } satisfies Omit<
    PalworldMapMarkerCompatibilityApproval,
    "evidenceChecksum"
  >;
  const approval = assertPalworldMapMarkerCompatibilityApproval({
    ...withoutEvidenceChecksum,
    evidenceChecksum: palworldMapMarkerCompatibilityEvidenceChecksum(
      withoutEvidenceChecksum
    )
  });
  const approvalText = deterministicJson(approval);
  const approvalSha256 = checksum(approvalText);
  const stagingRoot = await mkdtemp(
    path.join(path.dirname(args.releaseRoot), ".map-markers-compatible-")
  );
  try {
    await Promise.all([
      writeFile(
        path.join(stagingRoot, PALWORLD_MAP_MARKER_ARTIFACT_FILE),
        artifactText,
        { encoding: "utf8", mode: 0o644 }
      ),
      writeFile(
        path.join(stagingRoot, PALWORLD_MAP_MARKER_MANIFEST_FILE),
        manifestText,
        { encoding: "utf8", mode: 0o644 }
      ),
      writeFile(
        path.join(stagingRoot, PALWORLD_MAP_MARKER_COMPATIBILITY_FILE),
        approvalText,
        { encoding: "utf8", mode: 0o644 }
      ),
      writeFile(path.join(stagingRoot, "paldex.json"), paldexBytes, {
        mode: 0o644
      }),
      writeFile(
        path.join(stagingRoot, "map-images-manifest.json"),
        mapImagesManifestBytes,
        { mode: 0o644 }
      )
    ]);
    const stagedArtifact = await loadPalworldMapMarkerArtifact(stagingRoot);
    await loadPalworldMapMarkerCompatibilityAuthorization({
      releaseRoot: stagingRoot,
      artifact: stagedArtifact,
      expectedApprovalSha256: approvalSha256
    });
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }

  if (args.publish) {
    await writeFileAtomic(
      path.join(args.releaseRoot, PALWORLD_MAP_MARKER_ARTIFACT_FILE),
      artifactText
    );
    await writeFileAtomic(
      path.join(args.releaseRoot, PALWORLD_MAP_MARKER_MANIFEST_FILE),
      manifestText
    );
    // 호환 승인 파일을 마지막에 게시한 뒤 active selector를 별도 원자 교체합니다.
    await writeFileAtomic(
      path.join(args.releaseRoot, PALWORLD_MAP_MARKER_COMPATIBILITY_FILE),
      approvalText
    );
    const publishedArtifact = await loadPalworldMapMarkerArtifact(
      args.releaseRoot
    );
    await loadPalworldMapMarkerCompatibilityAuthorization({
      releaseRoot: args.releaseRoot,
      artifact: publishedArtifact,
      expectedApprovalSha256: approvalSha256
    });
  }

  process.stdout.write(
    `[palworld-map] compatibility ${args.publish ? "게시" : "검증"} 완료: `
    + `MainMap ${result.counts.mainMarkers}개, Tree ${result.counts.treeMarkers}개, `
    + `approval ${approvalSha256}\n`
  );
} catch (error) {
  const message = error instanceof Error
    ? error.message
    : "알 수 없는 지도 marker compatibility 오류";
  process.stderr.write(
    `[PALWORLD_MAP_MARKER_COMPATIBILITY_FAILED] ${message}\n`
  );
  process.exitCode = 1;
}
