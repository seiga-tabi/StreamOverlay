import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const {
  assertPalworldMapMarkerMapping,
  assertPalworldMapMarkerWorldsMapping,
  normalizedPalworldMainMapCoordinate
} = await import("../dist/data/palworld-map-marker-generator.js");
const {
  loadPalworldMapMarkerArtifact
} = await import("../dist/data/palworld-map-marker-artifact.js");

const releaseRoot = fileURLToPath(new URL("../data/palworld/1.0.1/", import.meta.url));
const mappingPath = fileURLToPath(
  new URL("../src/data/palworld-map-mappings/map-marker-worlds.json", import.meta.url)
);
const legacyTransformPath = fileURLToPath(
  new URL("../src/data/palworld-map-mappings/main-map-transform.json", import.meta.url)
);

test("검수된 FModel MainMap 좌표 변환은 사막 보스 anchor와 일치한다", async () => {
  const mapping = assertPalworldMapMarkerMapping(
    JSON.parse(await readFile(mappingPath, "utf8"))
  );
  assert.deepEqual(
    normalizedPalworldMainMapCoordinate(
      { x: 97_716.31, y: 307_499.7 },
      mapping.world.sourceBounds
    ),
    {
      normalizedX: 0.712244409,
      normalizedY: 0.173718726
    }
  );
  assert.throws(
    () => normalizedPalworldMainMapCoordinate(
      { x: 10_000_000, y: 10_000_000 },
      mapping.world.sourceBounds
    ),
    /bounds/u
  );
});

test("MainMap·Tree marker artifact는 checksum과 exact Pal join을 보존하고 provenance 누락을 candidate로 유지한다", async () => {
  const artifactBytes = await readFile(path.join(releaseRoot, "map-markers.json"));
  const manifest = JSON.parse(
    await readFile(path.join(releaseRoot, "map-markers-manifest.json"), "utf8")
  );
  assert.equal(
    createHash("sha256").update(artifactBytes).digest("hex"),
    manifest.artifactSha256
  );
  const artifact = JSON.parse(artifactBytes.toString("utf8"));
  const main = artifact.worlds.find((world) => world.world === "main");
  const tree = artifact.worlds.find((world) => world.world === "tree");
  assert.ok(main);
  assert.ok(tree);
  assert.equal(main.markers.length, 83);
  assert.equal(tree.markers.length, 7);
  assert.equal(new Set(main.markers.map((marker) => marker.sourceRowId)).size, 83);
  assert.equal(new Set(main.markers.map((marker) => marker.id)).size, 83);
  assert.deepEqual(
    main.markers.find((marker) => marker.sourceInternalId === "Suzaku"),
    {
      id: "main-023-suzaku",
      sourceRowId: "23",
      sourceInternalId: "Suzaku",
      palId: "suzaku",
      level: 45,
      normalizedX: 0.712244409,
      normalizedY: 0.173718726
    }
  );
  assert.deepEqual(tree.markers, [
    {
      id: "tree-015-dualith",
      sourceRowId: "15",
      sourceInternalId: "GrassGolem",
      palId: "dualith",
      level: 75,
      normalizedX: 0.559563133,
      normalizedY: 0.502340571
    },
    {
      id: "tree-016-celesdir-noct",
      sourceRowId: "16",
      sourceInternalId: "WhiteDeer_Dark",
      palId: "celesdir-noct",
      level: 79,
      normalizedX: 0.266304268,
      normalizedY: 0.493592688
    },
    {
      id: "tree-017-whalaska-ignis",
      sourceRowId: "17",
      sourceInternalId: "IceNarwhal_Fire",
      palId: "whalaska-ignis",
      level: 74,
      normalizedX: 0.691841649,
      normalizedY: 0.474662738
    },
    {
      id: "tree-018-mycora",
      sourceRowId: "18",
      sourceInternalId: "MushroomLady",
      palId: "mycora",
      level: 78,
      normalizedX: 0.361726405,
      normalizedY: 0.675996278
    },
    {
      id: "tree-019-moldron-cryst",
      sourceRowId: "19",
      sourceInternalId: "VolcanoDragon_Ice",
      palId: "moldron-cryst",
      level: 78,
      normalizedX: 0.248033189,
      normalizedY: 0.343123257
    },
    {
      id: "tree-020-renjishi",
      sourceRowId: "20",
      sourceInternalId: "KabukiMan",
      palId: "renjishi",
      level: 78,
      normalizedX: 0.720117321,
      normalizedY: 0.257614169
    },
    {
      id: "tree-021-aegidron",
      sourceRowId: "21",
      sourceInternalId: "DomeArmorDragon",
      palId: "aegidron",
      level: 79,
      normalizedX: 0.270628297,
      normalizedY: 0.578026489
    }
  ]);
  assert.equal(artifact.source.sourceGameVersion, null);
  assert.equal(artifact.source.sourceSteamBuildId, null);
  assert.equal(artifact.source.rightsVerified, false);
  const loaded = await loadPalworldMapMarkerArtifact(releaseRoot);
  assert.equal(
    loaded.activation,
    "candidate",
    "source metadata가 없는 artifact는 loader에서 active로 승격되면 안 됩니다."
  );
});

test("지도 mapping은 unknown field와 지도 content hash 불일치를 거부한다", async () => {
  const value = JSON.parse(await readFile(mappingPath, "utf8"));
  assert.throws(
    () => assertPalworldMapMarkerMapping({ ...value, extra: true }),
    /허용되지 않은/u
  );
  assert.throws(
    () => assertPalworldMapMarkerMapping({
      ...value,
      targetMapAsset: {
        ...value.targetMapAsset,
        sha256: "0".repeat(64)
      }
    }),
    /content hash/u
  );
  assert.throws(
    () => assertPalworldMapMarkerMapping({
      ...value,
      treeVerification: {
        ...value.treeVerification,
        coordinateCrossCheckRows: 6
      }
    }),
    /Tree marker 전체 수/u
  );
  const legacyMapping = assertPalworldMapMarkerMapping(
    JSON.parse(await readFile(legacyTransformPath, "utf8"))
  );
  assert.equal(legacyMapping.schemaVersion, 1);
  assert.throws(
    () => assertPalworldMapMarkerWorldsMapping(legacyMapping),
    /schema 2 mapping/u
  );
});
