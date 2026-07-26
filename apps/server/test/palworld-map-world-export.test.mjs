import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const {
  assertPalworldMapLocationClassMapping,
  deterministicMapLocationJson,
  PALWORLD_MAP_WORLD_EXPORT_SHA256
} = await import("../dist/data/palworld-map-world-export.js");
const {
  createPalworldMapLocationsProvider,
  loadPalworldMapLocationsArtifact,
  loadPalworldMapLocationsCompatibilityAuthorization
} = await import("../dist/data/palworld-map-locations-artifact.js");

const releaseRoot = fileURLToPath(
  new URL("../data/palworld/1.0.1/", import.meta.url)
);
const mappingPath = fileURLToPath(
  new URL(
    "../src/data/palworld-map-mappings/location-classes.json",
    import.meta.url
  )
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("Maps.zip 위치 taxonomy는 exact actor class와 고정 원본 수량을 검증한다", async () => {
  const raw = JSON.parse(await readFile(mappingPath, "utf8"));
  const mapping = assertPalworldMapLocationClassMapping(raw);
  assert.equal(mapping.sourceArchiveSha256, PALWORLD_MAP_WORLD_EXPORT_SHA256);
  assert.deepEqual(mapping.expectedSourceCounts, {
    "fast-travel": 152,
    dungeon: 170,
    egg: 1816,
    "skill-fruit": 47,
    lifmunk: 407,
    journal: 64
  });
  assert.equal(
    new Set(mapping.classes.map((entry) => entry.sourceClass)).size,
    mapping.classes.length
  );
  assert.throws(
    () => assertPalworldMapLocationClassMapping({ ...raw, unexpected: true }),
    /허용되지 않은 필드/u
  );
  assert.throws(
    () => assertPalworldMapLocationClassMapping({
      ...raw,
      sourceArchiveSha256: "0".repeat(64)
    }),
    /Maps\.zip 고정 SHA-256/u
  );
});

test("생성된 MainMap 위치 artifact는 raw 2656건 중 2543건을 포함하고 Tree 113건을 분리한다", async () => {
  const [artifactBytes, manifest, report] = await Promise.all([
    readFile(path.join(releaseRoot, "map-locations.json")),
    readFile(path.join(releaseRoot, "map-locations-manifest.json"), "utf8")
      .then(JSON.parse),
    readFile(path.join(releaseRoot, "map-locations-import-report.json"), "utf8")
      .then(JSON.parse)
  ]);
  const artifact = await loadPalworldMapLocationsArtifact(releaseRoot);
  assert.equal(artifact.totalLocations, 2543);
  assert.equal(artifact.worlds.length, 1);
  assert.equal(artifact.worlds[0].world, "main");
  assert.equal(artifact.worlds[0].locationCount, 2543);
  assert.deepEqual(artifact.worlds[0].categoryCounts, {
    "fast-travel": 137,
    dungeon: 170,
    egg: 1786,
    "skill-fruit": 35,
    lifmunk: 360,
    journal: 55
  });
  assert.equal(report.counts.sourceActors, 2656);
  assert.equal(report.excludedByReason.tree_world_without_active_map, 113);
  assert.equal(
    report.excludedByReason.outside_verified_main_and_tree_bounds,
    0
  );
  assert.equal(report.integrityAudit.exactCoordinateCollisions, 0);
  assert.equal(report.integrityAudit.reusedLevelObjectInstanceIds, 3);
  assert.equal(sha256(artifactBytes), manifest.artifactSha256);
  assert.equal(
    deterministicMapLocationJson(JSON.parse(artifactBytes.toString("utf8"))),
    artifactBytes.toString("utf8")
  );
  const subtypeCounts = new Map();
  for (const entry of artifact.worlds[0].locations) {
    subtypeCounts.set(entry.subtype, (subtypeCounts.get(entry.subtype) ?? 0) + 1);
  }
  assert.equal(subtypeCounts.get("statue-lifmunk"), 140);
  assert.equal(subtypeCounts.get("statue-lamball"), 30);
  assert.equal(subtypeCounts.get("statue-pengullet"), 30);
  assert.equal(subtypeCounts.get("statue-munchill"), 30);
  assert.equal(subtypeCounts.get("statue-rooby"), 30);
  assert.equal(subtypeCounts.get("statue-herbil"), 30);
  assert.equal(subtypeCounts.get("statue-tanzee"), 30);
  assert.equal(subtypeCounts.get("statue-depresso"), 30);
  assert.equal(subtypeCounts.get("statue-lunaris"), 4);
  assert.equal(subtypeCounts.get("statue-relaxaurus"), 4);
  assert.equal(subtypeCounts.get("statue-yakumo"), 2);
});

test("stable ID는 archive·member·export index를 사용하고 재사용 instance ID를 dedupe하지 않는다", async () => {
  const artifact = await loadPalworldMapLocationsArtifact(releaseRoot);
  const locations = artifact.worlds[0].locations;
  for (const location of locations.slice(0, 50)) {
    const digest = sha256(
      `${PALWORLD_MAP_WORLD_EXPORT_SHA256}\0`
      + `${location.sourceMemberPath}\0${location.sourceActorExportIndex}`
    ).slice(0, 20);
    assert.equal(location.id, `${location.category}-${digest}`);
  }
  assert.equal(
    new Set(
      locations.map((entry) =>
        `${entry.sourceMemberPath}\0${entry.sourceActorExportIndex}`
      )
    ).size,
    locations.length
  );
  const byInstance = new Map();
  for (const entry of locations) {
    if (entry.sourceInstanceId === null) continue;
    byInstance.set(
      entry.sourceInstanceId,
      [...(byInstance.get(entry.sourceInstanceId) ?? []), entry]
    );
  }
  const reused = [...byInstance.values()].find((entries) => entries.length > 1);
  assert.ok(reused, "서로 다른 위치에서 재사용된 instance ID fixture가 있어야 합니다.");
  assert.ok(
    new Set(
      reused.map((entry) =>
        `${entry.sourceMemberPath}\0${entry.sourceActorExportIndex}`
      )
    ).size > 1
  );
});

test("additional warp 33건은 candidate report에 남기고 runtime 위치에는 포함하지 않는다", async () => {
  const [artifact, report] = await Promise.all([
    loadPalworldMapLocationsArtifact(releaseRoot),
    readFile(
      path.join(releaseRoot, "map-locations-import-report.json"),
      "utf8"
    ).then(JSON.parse)
  ]);
  const additionalWarp = report.candidatesExcluded.find(
    (entry) => entry.family === "additional-warp"
  );
  assert.equal(additionalWarp?.actors, 33);
  assert.equal(
    artifact.worlds[0].locations.some((entry) =>
      entry.sourceClass === "BP_DimensionWarpPoint_C"
      || entry.sourceClass === "BP_LevelObject_WarpPointDestination_C"
      || entry.sourceClass
        === "BP_LevelObject_WarpPointDestination_WorldTreeEntrance_C"
    ),
    false
  );
});

test("candidate는 exact-checksum compatibility authorization으로만 provider가 된다", async () => {
  const [artifact, approvalBytes] = await Promise.all([
    loadPalworldMapLocationsArtifact(releaseRoot),
    readFile(path.join(releaseRoot, "map-locations-compatibility.json"))
  ]);
  assert.throws(
    () => createPalworldMapLocationsProvider({ artifact }),
    /candidate 단독/u
  );
  const authorization =
    await loadPalworldMapLocationsCompatibilityAuthorization({
      releaseRoot,
      artifact,
      expectedApprovalSha256: sha256(approvalBytes)
    });
  const provider = createPalworldMapLocationsProvider({
    artifact,
    compatibilityAuthorization: authorization
  });
  assert.equal(provider.diagnostics().total, 2543);
  assert.equal(authorization.approval.importAudit.sourceRawExact, 2656);
  assert.equal(authorization.approval.importAudit.treeExcluded, 113);
  assert.equal(authorization.approval.rightsVerified, false);
  assert.equal(authorization.approval.sourceVersionVerified, false);
});
