import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const {
  assertPalworldMapMarkerMapping,
  normalizedPalworldMainMapCoordinate
} = await import("../dist/data/palworld-map-marker-generator.js");
const {
  loadPalworldMapMarkerArtifact
} = await import("../dist/data/palworld-map-marker-artifact.js");

const releaseRoot = fileURLToPath(new URL("../data/palworld/1.0.1/", import.meta.url));
const mappingPath = fileURLToPath(
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

test("게시된 MainMap marker artifact는 checksum과 83개 exact Pal join을 보존한다", async () => {
  const artifactBytes = await readFile(path.join(releaseRoot, "map-markers.json"));
  const manifest = JSON.parse(
    await readFile(path.join(releaseRoot, "map-markers-manifest.json"), "utf8")
  );
  assert.equal(
    createHash("sha256").update(artifactBytes).digest("hex"),
    manifest.artifactSha256
  );
  const artifact = await loadPalworldMapMarkerArtifact(releaseRoot);
  const main = artifact.worlds.find((world) => world.world === "main");
  assert.ok(main);
  assert.equal(main.markers.length, 83);
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
  assert.equal(artifact.source.sourceGameVersion, null);
  assert.equal(artifact.source.sourceSteamBuildId, null);
  assert.equal(artifact.source.rightsVerified, false);
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
});
