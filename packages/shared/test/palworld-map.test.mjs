import test from "node:test";
import assert from "node:assert/strict";
import {
  PALWORLD_PAL_SPAWN_GRID_SIZE,
  assertPalworldMapLocationsArtifact,
  validatePalworldMapLocationsArtifact,
  validatePalworldMapLocationsArtifactManifest,
  validatePalworldMapLocationsResponse,
  assertPalworldPalSpawnResponse,
  validatePalworldPalSpawnResponse,
  validatePalworldMapMarkersResponse
} from "../dist/index.js";

const metadata = {
  gameVersion: "1.0.1",
  sourceName: "고정 Palworld release",
  sourceUrl: "https://github.com/example/palworld-source",
  sourceRevision: "fixed-revision",
  extractedAt: "2026-07-20T00:00:00.000Z",
  verifiedAt: "2026-07-21T00:00:00.000Z",
  license: "RIGHTS_NOT_INDEPENDENTLY_VERIFIED",
  rightsVerified: false
};

const pal = {
  id: "anubis",
  number: 100,
  nameKo: "아누비스",
  nameJa: "アヌビス",
  nameEn: "Anubis",
  elements: ["ground"]
};

const overlay = {
  schemaVersion: 1,
  technicalStatus: "ready",
  sourceType: "operator_pak_export",
  archiveSha256: "a".repeat(64),
  sourceMember: "Pal/DataTable/UI/DT_BossSpawnerLoactionData.json",
  sourceMemberSha256: "b".repeat(64),
  targetMapAssetSha256: "c".repeat(64),
  sourceGameVersion: null,
  sourceSteamBuildId: null,
  targetGameVersion: metadata.gameVersion,
  compatibilityBasis: "exact_map_geometry_and_coordinate_transform",
  transformRevision: "main-map-transform-v1",
  rightsVerified: false,
  usageBasis: "operator_reference_use"
};

const spawnOverlay = {
  ...overlay,
  compatibilityBasis: "exact_active_paldex_join_and_map_geometry",
  sourceGameVersion: metadata.gameVersion,
  sourceSteamBuildId: "24181105"
};
const compatibilitySpawnOverlay = {
  ...overlay,
  compatibilityBasis: "exact_active_paldex_join_and_map_geometry",
  activationBasis: "versioned_compatibility_approval",
  compatibilityApprovalSha256: "d".repeat(64)
};
const locationOverlay = {
  ...overlay,
  compatibilityBasis: "exact_world_actor_join_and_map_geometry",
  activationBasis: "versioned_compatibility_approval",
  compatibilityApprovalSha256: "e".repeat(64)
};

const marker = {
  id: "main-anubis-001",
  sourceRowId: "Boss_Anubis",
  sourceInternalId: "Anubis",
  pal,
  level: 47,
  normalizedX: 0.25,
  normalizedY: 0.75
};

const spawnPoint = {
  id: "main-anubis-08-24",
  cellX: 8,
  cellY: 24,
  normalizedX: 0.265625,
  normalizedY: 0.765625,
  placementCount: 7,
  minimumLevel: 20,
  maximumLevel: 24,
  daytime: true,
  nighttime: false
};

test("Palworld 지도 marker 응답은 unavailable과 ready 상태를 구분한다", () => {
  assert.equal(validatePalworldMapMarkersResponse({
    state: "data_unavailable",
    world: "main",
    markers: [],
    metadata
  }).ok, true);
  assert.equal(validatePalworldMapMarkersResponse({
    state: "ready",
    world: "main",
    markers: [marker],
    metadata,
    overlay
  }).ok, true);
});

test("Palworld 지도 marker 응답은 unknown field와 잘못된 provenance를 거부한다", () => {
  const ready = {
    state: "ready",
    world: "main",
    markers: [marker],
    metadata,
    overlay
  };
  assert.equal(validatePalworldMapMarkersResponse({ ...ready, extra: true }).ok, false);
  assert.equal(validatePalworldMapMarkersResponse({
    ...ready,
    overlay: { ...overlay, rightsVerified: true }
  }).ok, false);
  assert.equal(validatePalworldMapMarkersResponse({
    ...ready,
    overlay: { ...overlay, targetGameVersion: "9.9.9" }
  }).ok, false);
  assert.equal(validatePalworldMapMarkersResponse({
    ...ready,
    markers: [{ ...marker, normalizedX: Number.NaN }]
  }).ok, false);
  assert.equal(validatePalworldMapMarkersResponse({
    ...ready,
    markers: [marker, { ...marker, id: "main-anubis-002" }]
  }).ok, false);
});

test("data_unavailable 지도 응답은 candidate provenance나 marker를 노출하지 않는다", () => {
  assert.equal(validatePalworldMapMarkersResponse({
    state: "data_unavailable",
    world: "tree",
    markers: [],
    metadata,
    overlay: spawnOverlay
  }).ok, false);
  assert.equal(validatePalworldMapMarkersResponse({
    state: "data_unavailable",
    world: "tree",
    markers: [marker],
    metadata
  }).ok, false);
});

test("Pal별 일반 스폰 응답은 ready, confirmed_empty, data_unavailable을 구분한다", () => {
  const ready = {
    state: "ready",
    world: "main",
    palId: "anubis",
    gridSize: PALWORLD_PAL_SPAWN_GRID_SIZE,
    totalPlacements: 7,
    points: [spawnPoint],
    metadata,
    overlay: spawnOverlay
  };
  assert.deepEqual(assertPalworldPalSpawnResponse(ready), ready);
  assert.equal(validatePalworldPalSpawnResponse({
    ...ready,
    state: "confirmed_empty",
    totalPlacements: 0,
    points: []
  }).ok, true);
  assert.equal(validatePalworldPalSpawnResponse({
    ...ready,
    state: "data_unavailable",
    totalPlacements: 0,
    points: [],
    overlay: undefined
  }).ok, true);
  assert.equal(validatePalworldPalSpawnResponse({
    ...ready,
    overlay: compatibilitySpawnOverlay
  }).ok, true);
});

test("Pal별 일반 스폰 응답은 grid, count, level과 결정적 정렬을 검증한다", () => {
  const secondPoint = {
    ...spawnPoint,
    id: "main-anubis-09-24",
    cellX: 9,
    normalizedX: 0.296875,
    placementCount: 3,
    nighttime: true
  };
  const ready = {
    state: "ready",
    world: "main",
    palId: "anubis",
    gridSize: PALWORLD_PAL_SPAWN_GRID_SIZE,
    totalPlacements: 10,
    points: [spawnPoint, secondPoint],
    metadata,
    overlay: spawnOverlay
  };
  assert.equal(validatePalworldPalSpawnResponse(ready).ok, true);
  assert.equal(validatePalworldPalSpawnResponse({ ...ready, extra: true }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({ ...ready, palId: "Anubis" }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({ ...ready, gridSize: 16 }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...ready,
    totalPlacements: 9
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...ready,
    points: [{ ...spawnPoint, cellX: 9 }, secondPoint]
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...ready,
    points: [{ ...spawnPoint, normalizedX: Number.NaN }, secondPoint]
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...ready,
    points: [{ ...spawnPoint, maximumLevel: 19 }, secondPoint]
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...ready,
    points: [{ ...spawnPoint, daytime: false, nighttime: false }, secondPoint]
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...ready,
    points: [secondPoint, spawnPoint]
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...ready,
    points: [spawnPoint, { ...secondPoint, cellX: 8, normalizedX: spawnPoint.normalizedX }]
  }).ok, false);
});

test("Pal별 일반 스폰 상태는 검증된 overlay 공개 조건을 유지한다", () => {
  const base = {
    world: "main",
    palId: "anubis",
    gridSize: PALWORLD_PAL_SPAWN_GRID_SIZE,
    totalPlacements: 0,
    points: [],
    metadata
  };
  assert.equal(validatePalworldPalSpawnResponse({
    ...base,
    state: "confirmed_empty"
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...base,
    state: "data_unavailable",
    overlay
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...base,
    state: "confirmed_empty",
    overlay: { ...spawnOverlay, targetGameVersion: "9.9.9" }
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...base,
    state: "confirmed_empty",
    overlay: { ...spawnOverlay, sourceGameVersion: null }
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...base,
    state: "confirmed_empty",
    overlay: {
      ...compatibilitySpawnOverlay,
      compatibilityApprovalSha256: undefined
    }
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...base,
    state: "confirmed_empty",
    overlay: {
      ...compatibilitySpawnOverlay,
      sourceGameVersion: metadata.gameVersion,
      sourceSteamBuildId: "24181105"
    }
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...base,
    state: "confirmed_empty",
    overlay: { ...spawnOverlay, sourceGameVersion: "9.9.9" }
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...base,
    state: "confirmed_empty",
    overlay: { ...spawnOverlay, sourceSteamBuildId: "latest" }
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...base,
    state: "confirmed_empty",
    overlay: { ...spawnOverlay, sourceSteamBuildId: "012345" }
  }).ok, false);
  assert.equal(validatePalworldPalSpawnResponse({
    ...base,
    state: "confirmed_empty",
    overlay: { ...spawnOverlay, sourceSteamBuildId: "1".repeat(21) }
  }).ok, false);
});

const emptyLocationCounts = {
  "fast-travel": 0,
  dungeon: 0,
  egg: 0,
  "skill-fruit": 0,
  lifmunk: 0,
  journal: 0
};

const locationArtifact = {
  schemaVersion: 1,
  targetGameVersion: "1.0.1",
  activation: "candidate",
  source: {
    sourceType: "operator_pak_export",
    archiveSha256: "1".repeat(64),
    indexMember: "MainWorld_5/PL_MainWorld5.json",
    indexMemberSha256: "2".repeat(64),
    memberInventorySha256: "3".repeat(64),
    selectedMemberCount: 2,
    sourceGameVersion: null,
    sourceSteamBuildId: null,
    rightsVerified: false,
    usageBasis: "operator_reference_use"
  },
  totalLocations: 2,
  worlds: [{
    world: "main",
    targetMapAssetSha256: "4".repeat(64),
    transform: {
      status: "verified",
      revision: "main-map-fmodel-bounds-v1",
      horizontalAxis: "world_y",
      verticalAxis: "world_x",
      invertHorizontal: false,
      invertVertical: true,
      sourceBounds: {
        minX: -1_099_400,
        maxX: 349_400,
        minY: -724_400,
        maxY: 724_400
      }
    },
    locationCount: 2,
    categoryCounts: {
      ...emptyLocationCounts,
      egg: 1,
      "skill-fruit": 1
    },
    locations: [{
      id: "main-egg-001",
      sourceActorId: "bp_palmapobjectspawner_palegg_grass_grade_01_C_UAID_1",
      sourceClass: "bp_palmapobjectspawner_palegg_grass_grade_01_C",
      sourceMemberPath:
        "MainWorld_5/PL_MainWorld5/_Generated_/MainGrid_L0_X-1_Y1_DL0.json",
      sourceActorExportIndex: 0,
      sourceInstanceId: "7CB385AA-4E03D3EA-CEB917AE-81323B8F",
      category: "egg",
      subtype: "grass-grade-01",
      normalizedX: 0.25,
      normalizedY: 0.75
    }, {
      id: "main-skill-fruit-001",
      sourceActorId: "BP_SkillFruitsSpawner_Grass_C_UAID_2",
      sourceClass: "BP_SkillFruitsSpawner_Grass_C",
      sourceMemberPath:
        "MainWorld_5/PL_MainWorld5/_Generated_/MainGrid_L0_X1_Y1_DL0.json",
      sourceActorExportIndex: 7,
      sourceInstanceId: "7CB385AA-4E03D3EA-CEB917AE-81323B8F",
      category: "skill-fruit",
      subtype: "grass",
      normalizedX: 0.5,
      normalizedY: 0.5
    }]
  }]
};

test("Palworld 지도 위치 artifact는 exact source actor와 count를 검증한다", () => {
  assert.deepEqual(
    assertPalworldMapLocationsArtifact(locationArtifact),
    locationArtifact
  );
  assert.equal(validatePalworldMapLocationsArtifact({
    ...locationArtifact,
    unknown: true
  }).ok, false);
  assert.equal(validatePalworldMapLocationsArtifact({
    ...locationArtifact,
    totalLocations: 1
  }).ok, false);
  assert.equal(validatePalworldMapLocationsArtifact({
    ...locationArtifact,
    worlds: [{
      ...locationArtifact.worlds[0],
      locations: [
        locationArtifact.worlds[0].locations[0],
        {
          ...locationArtifact.worlds[0].locations[1],
          sourceMemberPath:
            locationArtifact.worlds[0].locations[0].sourceMemberPath,
          sourceActorExportIndex:
            locationArtifact.worlds[0].locations[0].sourceActorExportIndex
        }
      ]
    }]
  }).ok, false);
  assert.equal(validatePalworldMapLocationsArtifact({
    ...locationArtifact,
    worlds: [{
      ...locationArtifact.worlds[0],
      locations: [
        locationArtifact.worlds[0].locations[0],
        {
          ...locationArtifact.worlds[0].locations[1],
          normalizedX: Number.NaN
        }
      ]
    }]
  }).ok, false);
});

test("Palworld 지도 위치 manifest와 public response는 checksum·pagination을 검증한다", () => {
  assert.equal(validatePalworldMapLocationsArtifactManifest({
    schemaVersion: 1,
    targetGameVersion: "1.0.1",
    artifactFile: "map-locations.json",
    artifactSha256: "a".repeat(64)
  }).ok, true);
  assert.equal(validatePalworldMapLocationsArtifactManifest({
    schemaVersion: 1,
    targetGameVersion: "1.0.1",
    artifactFile: "map-locations.json",
    artifactSha256: "invalid"
  }).ok, false);
  const ready = {
    state: "ready",
    world: "main",
    layers: ["egg", "skill-fruit"],
    offset: 0,
    limit: 100,
    total: 2,
    returned: 2,
    hasMore: false,
    locations: locationArtifact.worlds[0].locations.map((entry) => ({
      id: entry.id,
      category: entry.category,
      subtype: entry.subtype,
      normalizedX: entry.normalizedX,
      normalizedY: entry.normalizedY
    })),
    metadata,
    overlay: locationOverlay
  };
  assert.equal(validatePalworldMapLocationsResponse(ready).ok, true);
  assert.equal(validatePalworldMapLocationsResponse({
    ...ready,
    layers: ["skill-fruit", "egg"]
  }).ok, false);
  assert.equal(validatePalworldMapLocationsResponse({
    ...ready,
    returned: 1
  }).ok, false);
  assert.equal(validatePalworldMapLocationsResponse({
    ...ready,
    overlay: {
      ...locationOverlay,
      sourceGameVersion: metadata.gameVersion,
      sourceSteamBuildId: "24181105",
      activationBasis: "source_metadata",
      compatibilityApprovalSha256: undefined
    }
  }).ok, true);
  assert.equal(validatePalworldMapLocationsResponse({
    ...ready,
    overlay: {
      ...locationOverlay,
      sourceGameVersion: "9.9.9",
      sourceSteamBuildId: "24181105",
      activationBasis: "source_metadata",
      compatibilityApprovalSha256: undefined
    }
  }).ok, false);
  assert.equal(validatePalworldMapLocationsResponse({
    ...ready,
    overlay: {
      ...locationOverlay,
      sourceGameVersion: metadata.gameVersion,
      sourceSteamBuildId: "24181105"
    }
  }).ok, false);
  assert.equal(validatePalworldMapLocationsResponse({
    ...ready,
    state: "data_unavailable",
    total: 0,
    returned: 0,
    locations: [],
    overlay: undefined
  }).ok, true);
});
