import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const {
  assertPalworldSpawnMapping,
  buildPalworldSpawnArtifact
} = await import("../dist/data/palworld-spawn-generator.js");

const releasePaldexPath = fileURLToPath(
  new URL("../data/palworld/1.0.1/paldex.json", import.meta.url)
);
const mappingPath = fileURLToPath(
  new URL("../src/data/palworld-map-mappings/main-map-spawns.json", import.meta.url)
);

function placement(spawnerName, x = 0, y = 0) {
  return {
    InstanceName: "BP_TestSpawner_C",
    SpawnerName: spawnerName,
    SpawnerType: "EPalSpawnedCharacterType::Common",
    PlacementType: "EPalSpawnerPlacementType::Field",
    Location: { X: x, Y: y, Z: 0 },
    RadiusType: "EPalSpawnRadiusType::S",
    StaticRadius: 15_000,
    WorldName: "PL_MainWorld5",
    LayerNames: ["EnemySpawner_Test"],
    SpawnerClass: {
      AssetPathName: "/Game/Pal/Blueprint/Spawner/BP_Test.BP_Test_C",
      SubPathString: ""
    },
    RespawnCoolTime: 0
  };
}

function wild(spawnerName, {
  time = "EPalOneDayTimeType::Undefined",
  minimumLevel = 3,
  maximumLevel = 5
} = {}) {
  return {
    SpawnerName: spawnerName,
    SpawnerType: "EPalSpawnedCharacterType::Common",
    Weight: 100,
    OnlyTime: time,
    OnlyWeather: "EPalWeatherConditionType::Undefined",
    Pal_1: "BluePlatypus",
    NPC_1: "None",
    LvMin_1: minimumLevel,
    LvMax_1: maximumLevel,
    NumMin_1: 1,
    NumMax_1: 2,
    Pal_2: "None",
    NPC_2: "None",
    LvMin_2: 0,
    LvMax_2: 0,
    NumMin_2: 0,
    NumMax_2: 0,
    Pal_3: "None",
    NPC_3: "None",
    LvMin_3: 0,
    LvMax_3: 0,
    NumMin_3: 0,
    NumMax_3: 0,
    bIsAllowRandomizer: true,
    bHasWorldTreeAura: false
  };
}

test("일반 스폰 mapping은 고정 source와 검수된 correction만 허용한다", async () => {
  const mapping = JSON.parse(await readFile(mappingPath, "utf8"));
  assert.equal(assertPalworldSpawnMapping(mapping).expectedCounts.clusteredPoints, 3_784);
  assert.throws(
    () => assertPalworldSpawnMapping({ ...mapping, extra: true }),
    /허용되지 않은/u
  );
  assert.throws(
    () => assertPalworldSpawnMapping({
      ...mapping,
      levelRangeCorrections: [{
        ...mapping.levelRangeCorrections[0],
        sourceMinimum: 34,
        sourceMaximum: 35
      }]
    }),
    /source 역전/u
  );
});

test("동일 Pal/placement weighted row는 한 위치로 합치고 grid 출력을 결정적으로 생성한다", async () => {
  const [mappingValue, paldex] = await Promise.all([
    readFile(mappingPath, "utf8").then(JSON.parse),
    readFile(releasePaldexPath, "utf8").then(JSON.parse)
  ]);
  const mapping = assertPalworldSpawnMapping({
    ...mappingValue,
    expectedCounts: {
      placementRows: 1,
      wildSpawnerRows: 2,
      matchedPlacementRows: 1,
      unmatchedPlacementRows: 0,
      unresolvedPalOccurrences: 0,
      eligibleOccurrences: 2,
      palCount: 1,
      placementLinks: 1,
      clusteredPoints: 1
    },
    exclusions: [],
    levelRangeCorrections: []
  });
  const input = {
    mapping,
    paldex,
    palRows: {
      BluePlatypus: {
        IsPal: true,
        ZukanIndex: 5,
        Tribe: "EPalTribeID::Blueplatypus"
      }
    },
    placementRows: {
      "1": placement("test_grass")
    },
    wildSpawnerRows: {
      test_grass_day: wild("test_grass"),
      test_grass_night: wild("test_grass", {
        time: "EPalOneDayTimeType::Night",
        minimumLevel: 8,
        maximumLevel: 10
      })
    }
  };
  const first = buildPalworldSpawnArtifact(input);
  const second = buildPalworldSpawnArtifact(input);
  assert.deepEqual(first, second);
  assert.equal(first.artifact.activation, "candidate");
  assert.equal(first.artifact.source.sourceGameVersion, null);
  assert.equal(first.artifact.source.sourceSteamBuildId, null);
  assert.deepEqual(first.counts, mapping.expectedCounts);
  const pal = first.artifact.worlds[0].pals[0];
  assert.equal(pal.palId, "fuack");
  assert.equal(pal.sourceInternalId, "BluePlatypus");
  assert.equal(pal.totalPlacements, 1);
  assert.equal(pal.points.length, 1);
  assert.equal(pal.points[0].minimumLevel, 3);
  assert.equal(pal.points[0].maximumLevel, 10);
  assert.equal(pal.points[0].daytime, true);
  assert.equal(pal.points[0].nighttime, true);

  assert.throws(
    () => buildPalworldSpawnArtifact({ ...input, activation: "active" }),
    /metadata/u
  );
  const active = buildPalworldSpawnArtifact({
    ...input,
    activation: "active",
    sourceMetadata: {
      schemaVersion: 1,
      sourceType: "operator_pak_export",
      gameVersion: paldex.release,
      steamBuildId: paldex.steamBuildId,
      fmodelVersion: "4.1.2",
      exportedAt: "2026-07-24T00:00:00.000Z",
      mappingsSha256: "f".repeat(64)
    }
  });
  assert.equal(active.artifact.activation, "active");
  assert.equal(active.artifact.source.sourceGameVersion, paldex.release);
  assert.equal(active.artifact.source.sourceSteamBuildId, paldex.steamBuildId);
  assert.throws(
    () => buildPalworldSpawnArtifact({
      ...input,
      activation: "active",
      sourceMetadata: {
        schemaVersion: 1,
        sourceType: "operator_pak_export",
        gameVersion: paldex.release,
        steamBuildId: "99999999",
        fmodelVersion: "4.1.2",
        exportedAt: "2026-07-24T00:00:00.000Z",
        mappingsSha256: "f".repeat(64)
      }
    }),
    /Steam build ID/u
  );
});
