import test from "node:test";
import assert from "node:assert/strict";
import {
  PALWORLD_PAL_SPAWN_GRID_SIZE,
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
  compatibilityBasis: "exact_active_paldex_join_and_map_geometry"
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
});
