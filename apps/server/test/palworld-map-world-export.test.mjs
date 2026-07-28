import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const {
  assertPalworldMapLocationMapImageEvidence,
  assertPalworldMapLocationClassMapping,
  deterministicMapLocationJson,
  PALWORLD_MAP_WORLD_EXPORT_SHA256
} = await import("../dist/data/palworld-map-world-export.js");
const {
  assertPalworldMapImageManifest
} = await import("../dist/data/palworld-map-image-manifest.js");
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
    npc: 8,
    egg: 1816,
    "skill-fruit": 47,
    treasure: 1511,
    lifmunk: 407,
    journal: 64,
    resource: 15682
  });
  assert.equal(mapping.classes.length, 90);
  assert.equal(
    mapping.classes.filter((entry) => entry.category === "npc").length,
    5
  );
  assert.equal(
    mapping.classes.filter((entry) => entry.category === "treasure").length,
    18
  );
  assert.equal(
    mapping.classes.filter((entry) => entry.category === "resource").length,
    20
  );
  assert.equal(
    mapping.candidateFamilies.some((entry) => entry.id === "resource"),
    false
  );
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

test("세계수 transform evidence는 map image manifest의 source·output hash와 exact join한다", async () => {
  const [mappingRaw, manifestRaw] = await Promise.all([
    readFile(mappingPath, "utf8").then(JSON.parse),
    readFile(
      path.join(releaseRoot, "map-images-manifest.json"),
      "utf8"
    ).then(JSON.parse)
  ]);
  const mapping = assertPalworldMapLocationClassMapping(mappingRaw);
  const manifest = assertPalworldMapImageManifest(manifestRaw, "1.0.1");
  assert.doesNotThrow(() =>
    assertPalworldMapLocationMapImageEvidence({
      mapping,
      mapImagesManifest: manifest
    })
  );
  assert.throws(
    () => assertPalworldMapLocationMapImageEvidence({
      mapping,
      mapImagesManifest: {
        ...manifest,
        entries: manifest.entries.map((entry) =>
          entry.id === "tree"
            ? { ...entry, sourceSha256: "0".repeat(64) }
            : entry
        )
      }
    }),
    /세계수 source member·source SHA-256·output SHA-256 evidence/u
  );
  assert.throws(
    () => assertPalworldMapLocationMapImageEvidence({
      mapping,
      mapImagesManifest: {
        ...manifest,
        entries: manifest.entries.map((entry) =>
          entry.id === "tree"
            ? { ...entry, outputSha256: "0".repeat(64) }
            : entry
        )
      }
    }),
    /세계수 source member·source SHA-256·output SHA-256 evidence/u
  );
});

test("생성된 위치 artifact는 raw 19,857건을 MainMap과 세계수 지도에 정확히 분리한다", async () => {
  const [artifactBytes, manifest, report] = await Promise.all([
    readFile(path.join(releaseRoot, "map-locations.json")),
    readFile(path.join(releaseRoot, "map-locations-manifest.json"), "utf8")
      .then(JSON.parse),
    readFile(path.join(releaseRoot, "map-locations-import-report.json"), "utf8")
      .then(JSON.parse)
  ]);
  const artifact = await loadPalworldMapLocationsArtifact(releaseRoot);
  assert.equal(artifact.totalLocations, 19834);
  assert.equal(artifact.worlds.length, 2);
  assert.equal(artifact.worlds[0].world, "main");
  assert.equal(artifact.worlds[0].locationCount, 19603);
  assert.deepEqual(artifact.worlds[0].categoryCounts, {
    "fast-travel": 137,
    dungeon: 170,
    npc: 8,
    egg: 1786,
    "skill-fruit": 35,
    treasure: 1473,
    lifmunk: 360,
    journal: 55,
    resource: 15579
  });
  assert.equal(artifact.worlds[1].world, "tree");
  assert.equal(artifact.worlds[1].locationCount, 231);
  assert.deepEqual(artifact.worlds[1].categoryCounts, {
    "fast-travel": 15,
    dungeon: 0,
    npc: 0,
    egg: 30,
    "skill-fruit": 12,
    treasure: 38,
    lifmunk: 47,
    journal: 9,
    resource: 80
  });
  assert.equal(report.counts.sourceActors, 19857);
  assert.equal(report.excludedByReason.tree_world_without_active_map, 0);
  assert.equal(report.excludedByReason.attached_parent_coordinate_unresolved, 0);
  assert.equal(report.counts.exactDuplicates, 23);
  assert.equal(
    report.excludedByReason.outside_verified_main_and_tree_bounds,
    0
  );
  assert.equal(report.integrityAudit.exactCoordinateCollisions, 23);
  assert.equal(report.integrityAudit.reusedLevelObjectInstanceIds, 2126);
  assert.equal(
    report.counts.byCategory.resource.included
      + report.counts.byCategory.resource.treeIncluded
      + report.counts.byCategory.resource.coordinateUnresolved
      + report.counts.byCategory.resource.outOfBoundsExcluded
      + report.counts.byCategory.resource.exactDuplicates,
    15682
  );
  assert.equal(
    report.counts.byCategory.npc.included
      + report.counts.byCategory.npc.treeIncluded,
    8
  );
  assert.equal(
    report.counts.byCategory.treasure.included
      + report.counts.byCategory.treasure.treeIncluded,
    1511
  );
  assert.equal(sha256(artifactBytes), manifest.artifactSha256);
  assert.equal(
    deterministicMapLocationJson(JSON.parse(artifactBytes.toString("utf8"))),
    artifactBytes.toString("utf8")
  );
  const subtypeCounts = new Map();
  for (const entry of artifact.worlds.flatMap((world) => world.locations)) {
    subtypeCounts.set(entry.subtype, (subtypeCounts.get(entry.subtype) ?? 0) + 1);
  }
  assert.equal(subtypeCounts.get("statue-lifmunk"), 155);
  assert.equal(subtypeCounts.get("statue-lamball"), 30);
  assert.equal(subtypeCounts.get("statue-pengullet"), 30);
  assert.equal(subtypeCounts.get("statue-munchill"), 30);
  assert.equal(subtypeCounts.get("statue-rooby"), 30);
  assert.equal(subtypeCounts.get("statue-herbil"), 30);
  assert.equal(subtypeCounts.get("statue-tanzee"), 30);
  assert.equal(subtypeCounts.get("statue-depresso"), 30);
  assert.equal(subtypeCounts.get("statue-lunaris"), 4);
  assert.equal(subtypeCounts.get("statue-relaxaurus"), 4);
  assert.equal(subtypeCounts.get("statue-yakumo"), 4);
  assert.equal(subtypeCounts.get("ancient-beast-bone"), 10);
  assert.equal(subtypeCounts.get("ancient-tree-bark"), 10);
  assert.deepEqual(
    new Set(
      artifact.worlds
        .flatMap((world) => world.locations)
        .filter((entry) => entry.category === "resource")
        .map((entry) => entry.subtype)
    ),
    new Set([
      "ancient-beast-bone",
      "ancient-tree-bark",
      "night-stone",
      "pal-crystal",
      "coal",
      "copper-ore",
      "iron-ore",
      "quartz",
      "stone",
      "sky-island-ore",
      "sulfur",
      "world-tree-ore"
    ])
  );
});

test("stable ID는 archive·member·export index를 사용하고 서로 다른 위치의 재사용 instance ID를 보존한다", async () => {
  const artifact = await loadPalworldMapLocationsArtifact(releaseRoot);
  const locations = artifact.worlds.flatMap((world) => world.locations);
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
    artifact.worlds.flatMap((world) => world.locations).some((entry) =>
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
  assert.equal(provider.diagnostics().total, 19834);
  assert.equal(authorization.approval.importAudit.sourceRawExact, 19857);
  assert.equal(authorization.approval.importAudit.mainIncluded, 19603);
  assert.equal(authorization.approval.importAudit.treeIncluded, 231);
  assert.equal(authorization.approval.importAudit.treeExcluded, 0);
  assert.equal(authorization.approval.importAudit.coordinateUnresolved, 0);
  assert.equal(authorization.approval.importAudit.exactDuplicates, 23);
  assert.equal(
    provider.response(
      "tree",
      ["resource"],
      0,
      100,
      {
        gameVersion: "1.0.1",
        sourceRevision: "fixture-revision",
        sourceName: "fixture",
        sourceUrl: "https://example.invalid/palworld-map-fixture",
        extractedAt: "2026-07-25T00:00:00.000Z",
        verifiedAt: "2026-07-25T00:00:00.000Z",
        license: "fixture",
        rightsVerified: false
      }
    ).total,
    80
  );
  assert.equal(authorization.approval.rightsVerified, false);
  assert.equal(authorization.approval.sourceVersionVerified, false);
});
