import test from "node:test";
import assert from "node:assert/strict";
import {
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

const marker = {
  id: "main-anubis-001",
  sourceRowId: "Boss_Anubis",
  sourceInternalId: "Anubis",
  pal,
  level: 47,
  normalizedX: 0.25,
  normalizedY: 0.75
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
    overlay
  }).ok, false);
  assert.equal(validatePalworldMapMarkersResponse({
    state: "data_unavailable",
    world: "tree",
    markers: [marker],
    metadata
  }).ok, false);
});
