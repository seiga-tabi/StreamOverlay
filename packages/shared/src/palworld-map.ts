import {
  validatePalworldDataMetadata,
  validatePalworldPalReference,
  type PalworldDataMetadata,
  type PalworldPalReference,
  type PalworldValidationResult
} from "./palworld.js";

export const PALWORLD_MAP_WORLDS = ["main", "tree"] as const;
export const PALWORLD_MAP_MARKER_STATES = ["ready", "data_unavailable"] as const;
export const PALWORLD_PAL_SPAWN_STATES = [
  "ready",
  "confirmed_empty",
  "data_unavailable"
] as const;
export const PALWORLD_MAP_LOCATION_CATEGORIES = [
  "fast-travel",
  "dungeon",
  "egg",
  "skill-fruit",
  "lifmunk",
  "journal",
  "resource"
] as const;
export const PALWORLD_MAP_LOCATION_STATES = [
  "ready",
  "confirmed_empty",
  "data_unavailable"
] as const;
export const PALWORLD_MAP_OVERLAY_COMPATIBILITY_BASES = [
  "exact_map_geometry_and_coordinate_transform",
  "exact_active_paldex_join_and_map_geometry",
  "exact_world_actor_join_and_map_geometry"
] as const;
export const PALWORLD_MAP_OVERLAY_ACTIVATION_BASES = [
  "source_metadata",
  "versioned_compatibility_approval"
] as const;
export const PALWORLD_PAL_SPAWN_GRID_SIZE = 32;
export const PALWORLD_MAP_LOCATION_MAX_RESPONSE = 5_000;
export const PALWORLD_MAP_LOCATION_MAX_ARTIFACT_ENTRIES = 50_000;

export type PalworldMapWorld = (typeof PALWORLD_MAP_WORLDS)[number];
export type PalworldMapMarkerState = (typeof PALWORLD_MAP_MARKER_STATES)[number];
export type PalworldPalSpawnState = (typeof PALWORLD_PAL_SPAWN_STATES)[number];
export type PalworldMapLocationCategory =
  (typeof PALWORLD_MAP_LOCATION_CATEGORIES)[number];
export type PalworldMapLocationState =
  (typeof PALWORLD_MAP_LOCATION_STATES)[number];
export type PalworldMapOverlayCompatibilityBasis =
  (typeof PALWORLD_MAP_OVERLAY_COMPATIBILITY_BASES)[number];
export type PalworldMapOverlayActivationBasis =
  (typeof PALWORLD_MAP_OVERLAY_ACTIVATION_BASES)[number];

export type PalworldMapMarker = {
  id: string;
  sourceRowId: string;
  sourceInternalId: string;
  pal: PalworldPalReference;
  level: number;
  normalizedX: number;
  normalizedY: number;
};

export type PalworldMapOverlayProvenance = {
  schemaVersion: 1;
  technicalStatus: "ready";
  sourceType: "operator_pak_export";
  archiveSha256: string;
  sourceMember: string;
  sourceMemberSha256: string;
  targetMapAssetSha256: string;
  sourceGameVersion: string | null;
  sourceSteamBuildId: string | null;
  targetGameVersion: string;
  compatibilityBasis: PalworldMapOverlayCompatibilityBasis;
  transformRevision: string;
  rightsVerified: false;
  usageBasis: "operator_reference_use";
  activationBasis?: PalworldMapOverlayActivationBasis;
  compatibilityApprovalSha256?: string;
};

export type PalworldMapMarkersResponse = {
  state: PalworldMapMarkerState;
  world: PalworldMapWorld;
  markers: PalworldMapMarker[];
  metadata: PalworldDataMetadata;
  overlay?: PalworldMapOverlayProvenance;
};

export type PalworldPalSpawnPoint = {
  id: string;
  cellX: number;
  cellY: number;
  normalizedX: number;
  normalizedY: number;
  placementCount: number;
  minimumLevel: number;
  maximumLevel: number;
  daytime: boolean;
  nighttime: boolean;
};

export type PalworldPalSpawnResponse = {
  state: PalworldPalSpawnState;
  world: PalworldMapWorld;
  palId: string;
  gridSize: typeof PALWORLD_PAL_SPAWN_GRID_SIZE;
  totalPlacements: number;
  points: PalworldPalSpawnPoint[];
  metadata: PalworldDataMetadata;
  overlay?: PalworldMapOverlayProvenance;
};

export type PalworldMapLocation = {
  id: string;
  category: PalworldMapLocationCategory;
  subtype: string;
  normalizedX: number;
  normalizedY: number;
};

export type PalworldMapLocationsResponse = {
  state: PalworldMapLocationState;
  world: PalworldMapWorld;
  layers: PalworldMapLocationCategory[];
  offset: number;
  limit: number;
  total: number;
  returned: number;
  hasMore: boolean;
  locations: PalworldMapLocation[];
  metadata: PalworldDataMetadata;
  overlay?: PalworldMapOverlayProvenance;
};

export type PalworldMapLocationArtifactTransform = {
  status: "verified";
  revision: string;
  horizontalAxis: "world_x" | "world_y";
  verticalAxis: "world_x" | "world_y";
  invertHorizontal: boolean;
  invertVertical: boolean;
  sourceBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
};

export type PalworldMapLocationArtifactEntry = {
  id: string;
  sourceActorId: string;
  sourceClass: string;
  sourceMemberPath: string;
  sourceActorExportIndex: number;
  sourceInstanceId: string | null;
  category: PalworldMapLocationCategory;
  subtype: string;
  normalizedX: number;
  normalizedY: number;
};

export type PalworldMapLocationCategoryCounts = Record<
  PalworldMapLocationCategory,
  number
>;

export type PalworldMapLocationArtifactWorld = {
  world: PalworldMapWorld;
  targetMapAssetSha256: string;
  transform: PalworldMapLocationArtifactTransform;
  locationCount: number;
  categoryCounts: PalworldMapLocationCategoryCounts;
  locations: PalworldMapLocationArtifactEntry[];
};

export type PalworldMapLocationsArtifact = {
  schemaVersion: 1;
  targetGameVersion: string;
  activation: "candidate" | "active";
  source: {
    sourceType: "operator_pak_export";
    archiveSha256: string;
    indexMember: string;
    indexMemberSha256: string;
    memberInventorySha256: string;
    selectedMemberCount: number;
    sourceGameVersion: string | null;
    sourceSteamBuildId: string | null;
    rightsVerified: false;
    usageBasis: "operator_reference_use";
  };
  totalLocations: number;
  worlds: PalworldMapLocationArtifactWorld[];
};

export type PalworldMapLocationsArtifactManifest = {
  schemaVersion: 1;
  targetGameVersion: string;
  artifactFile: "map-locations.json";
  artifactSha256: string;
};

export type PalworldMapLocationDiagnostics = {
  state: "ready" | "data_unavailable";
  total: number;
  categoryCounts: PalworldMapLocationCategoryCounts;
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/u;
const SOURCE_MEMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/u;
const GAME_VERSION_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const STEAM_BUILD_ID_PATTERN = /^[1-9]\d{0,19}$/u;
const MAX_MARKERS = 500;
const MAX_PAL_SPAWN_POINTS = PALWORLD_PAL_SPAWN_GRID_SIZE ** 2;
const MAX_PAL_SPAWN_PLACEMENTS = 100_000;

function valid<T>(data: T): PalworldValidationResult<T> {
  return { ok: true, data };
}

function invalid<T>(path: string, message: string): PalworldValidationResult<T> {
  return { ok: false, error: `${path}: ${message}` };
}

function recordAt(
  value: unknown,
  path: string,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = []
): PalworldValidationResult<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return invalid(path, "객체여야 합니다.");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) return invalid(`${path}.${key}`, "허용되지 않은 필드입니다.");
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(record, key)) return invalid(`${path}.${key}`, "필수 필드가 없습니다.");
  }
  return valid(record);
}

function stringAt(value: unknown, path: string, maximum = 256): PalworldValidationResult<string> {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > maximum
    || value.trim() !== value
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return invalid(path, `앞뒤 공백과 제어문자가 없는 ${maximum}자 이하 문자열이어야 합니다.`);
  }
  return valid(value);
}

function sha256At(value: unknown, path: string): PalworldValidationResult<string> {
  const result = stringAt(value, path, 64);
  return result.ok && SHA256_PATTERN.test(result.data)
    ? result
    : invalid(path, "소문자 64자리 SHA-256 hex여야 합니다.");
}

function worldAt(value: unknown, path: string): PalworldValidationResult<PalworldMapWorld> {
  return typeof value === "string" && (PALWORLD_MAP_WORLDS as readonly string[]).includes(value)
    ? valid(value as PalworldMapWorld)
    : invalid(path, "main 또는 tree여야 합니다.");
}

function finiteNumberAt(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number
): PalworldValidationResult<number> {
  return typeof value === "number"
    && Number.isFinite(value)
    && value >= minimum
    && value <= maximum
    ? valid(value)
    : invalid(path, `${minimum} 이상 ${maximum} 이하의 유한한 숫자여야 합니다.`);
}

function sourceMemberAt(
  value: unknown,
  path: string
): PalworldValidationResult<string> {
  const member = stringAt(value, path, 512);
  if (
    !member.ok
    || !SOURCE_MEMBER_PATTERN.test(member.data)
    || member.data.startsWith("/")
    || member.data.includes("\\")
    || member.data.includes("%")
    || member.data.includes("//")
    || member.data.split("/").some((part) =>
      part.length === 0 || part === "." || part === ".."
    )
  ) {
    return invalid(path, "안전한 archive 상대 경로여야 합니다.");
  }
  return member;
}

function validateOverlayAt(
  value: unknown,
  path: string
): PalworldValidationResult<PalworldMapOverlayProvenance> {
  const record = recordAt(value, path, [
    "schemaVersion",
    "technicalStatus",
    "sourceType",
    "archiveSha256",
    "sourceMember",
    "sourceMemberSha256",
    "targetMapAssetSha256",
    "sourceGameVersion",
    "sourceSteamBuildId",
    "targetGameVersion",
    "compatibilityBasis",
    "transformRevision",
    "rightsVerified",
    "usageBasis"
  ], [
    "activationBasis",
    "compatibilityApprovalSha256"
  ]);
  if (!record.ok) return record;
  if (record.data.schemaVersion !== 1) {
    return invalid(`${path}.schemaVersion`, "1이어야 합니다.");
  }
  if (record.data.technicalStatus !== "ready") {
    return invalid(`${path}.technicalStatus`, "overlay 기술 검증 완료 상태인 ready여야 합니다.");
  }
  if (record.data.sourceType !== "operator_pak_export") {
    return invalid(`${path}.sourceType`, "operator_pak_export여야 합니다.");
  }
  for (const field of [
    "archiveSha256",
    "sourceMemberSha256",
    "targetMapAssetSha256"
  ] as const) {
    const checksum = sha256At(record.data[field], `${path}.${field}`);
    if (!checksum.ok) return checksum;
  }
  const sourceMember = stringAt(record.data.sourceMember, `${path}.sourceMember`, 512);
  if (
    !sourceMember.ok
    || !SOURCE_MEMBER_PATTERN.test(sourceMember.data)
    || sourceMember.data.startsWith("/")
    || sourceMember.data.includes("\\")
    || sourceMember.data.includes("%")
    || sourceMember.data.includes("//")
    || sourceMember.data.split("/").some((part) => part === "." || part === "..")
  ) {
    return invalid(`${path}.sourceMember`, "안전한 archive 상대 경로여야 합니다.");
  }
  for (const field of ["sourceGameVersion", "sourceSteamBuildId"] as const) {
    if (record.data[field] === null) continue;
    const text = stringAt(record.data[field], `${path}.${field}`, 128);
    if (!text.ok) return text;
  }
  for (const field of ["targetGameVersion", "transformRevision"] as const) {
    const text = stringAt(record.data[field], `${path}.${field}`, 128);
    if (!text.ok) return text;
  }
  if (
    !PALWORLD_MAP_OVERLAY_COMPATIBILITY_BASES.includes(
      record.data.compatibilityBasis as PalworldMapOverlayCompatibilityBasis
    )
  ) {
    return invalid(
      `${path}.compatibilityBasis`,
      "검증된 지도 geometry/coordinate transform 또는 활성 도감 exact join 호환성 근거여야 합니다."
    );
  }
  if (
    record.data.activationBasis !== undefined
    && !PALWORLD_MAP_OVERLAY_ACTIVATION_BASES.includes(
      record.data.activationBasis as PalworldMapOverlayActivationBasis
    )
  ) {
    return invalid(
      `${path}.activationBasis`,
      "source_metadata 또는 versioned_compatibility_approval이어야 합니다."
    );
  }
  if (record.data.compatibilityApprovalSha256 !== undefined) {
    const approvalChecksum = sha256At(
      record.data.compatibilityApprovalSha256,
      `${path}.compatibilityApprovalSha256`
    );
    if (!approvalChecksum.ok) return approvalChecksum;
  }
  if (
    record.data.activationBasis === "versioned_compatibility_approval"
    && record.data.compatibilityApprovalSha256 === undefined
  ) {
    return invalid(
      `${path}.compatibilityApprovalSha256`,
      "versioned compatibility approval checksum이 필요합니다."
    );
  }
  if (
    record.data.activationBasis !== "versioned_compatibility_approval"
    && record.data.compatibilityApprovalSha256 !== undefined
  ) {
    return invalid(
      `${path}.compatibilityApprovalSha256`,
      "versioned compatibility approval 상태에서만 사용할 수 있습니다."
    );
  }
  if (record.data.rightsVerified !== false) {
    return invalid(`${path}.rightsVerified`, "독립적으로 확인되지 않은 권리를 true로 표시할 수 없습니다.");
  }
  if (record.data.usageBasis !== "operator_reference_use") {
    return invalid(`${path}.usageBasis`, "operator_reference_use여야 합니다.");
  }
  return valid(record.data as PalworldMapOverlayProvenance);
}

function validateMarkerAt(
  value: unknown,
  path: string
): PalworldValidationResult<PalworldMapMarker> {
  const record = recordAt(value, path, [
    "id",
    "sourceRowId",
    "sourceInternalId",
    "pal",
    "level",
    "normalizedX",
    "normalizedY"
  ]);
  if (!record.ok) return record;
  const id = stringAt(record.data.id, `${path}.id`, 80);
  if (!id.ok || !ID_PATTERN.test(id.data)) {
    return invalid(`${path}.id`, "안전한 소문자 canonical ID여야 합니다.");
  }
  for (const field of ["sourceRowId", "sourceInternalId"] as const) {
    const sourceId = stringAt(record.data[field], `${path}.${field}`, 160);
    if (!sourceId.ok) return sourceId;
  }
  const pal = validatePalworldPalReference(record.data.pal);
  if (!pal.ok) return invalid(`${path}.pal`, pal.error);
  const level = finiteNumberAt(record.data.level, `${path}.level`, 1, 100);
  if (!level.ok || !Number.isInteger(level.data)) {
    return invalid(`${path}.level`, "1 이상 100 이하의 정수여야 합니다.");
  }
  for (const field of ["normalizedX", "normalizedY"] as const) {
    const coordinate = finiteNumberAt(record.data[field], `${path}.${field}`, 0, 1);
    if (!coordinate.ok) return coordinate;
  }
  return valid(record.data as PalworldMapMarker);
}

function integerAt(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number
): PalworldValidationResult<number> {
  const result = finiteNumberAt(value, path, minimum, maximum);
  return result.ok && Number.isInteger(result.data)
    ? result
    : invalid(path, `${minimum} 이상 ${maximum} 이하의 정수여야 합니다.`);
}

function booleanAt(value: unknown, path: string): PalworldValidationResult<boolean> {
  return typeof value === "boolean"
    ? valid(value)
    : invalid(path, "boolean이어야 합니다.");
}

function validatePalSpawnPointAt(
  value: unknown,
  path: string
): PalworldValidationResult<PalworldPalSpawnPoint> {
  const record = recordAt(value, path, [
    "id",
    "cellX",
    "cellY",
    "normalizedX",
    "normalizedY",
    "placementCount",
    "minimumLevel",
    "maximumLevel",
    "daytime",
    "nighttime"
  ]);
  if (!record.ok) return record;
  const id = stringAt(record.data.id, `${path}.id`, 80);
  if (!id.ok || !ID_PATTERN.test(id.data)) {
    return invalid(`${path}.id`, "안전한 소문자 canonical ID여야 합니다.");
  }
  const cellX = integerAt(
    record.data.cellX,
    `${path}.cellX`,
    0,
    PALWORLD_PAL_SPAWN_GRID_SIZE - 1
  );
  if (!cellX.ok) return cellX;
  const cellY = integerAt(
    record.data.cellY,
    `${path}.cellY`,
    0,
    PALWORLD_PAL_SPAWN_GRID_SIZE - 1
  );
  if (!cellY.ok) return cellY;
  const normalizedX = finiteNumberAt(record.data.normalizedX, `${path}.normalizedX`, 0, 1);
  if (!normalizedX.ok) return normalizedX;
  const normalizedY = finiteNumberAt(record.data.normalizedY, `${path}.normalizedY`, 0, 1);
  if (!normalizedY.ok) return normalizedY;
  const expectedCellX = Math.min(
    PALWORLD_PAL_SPAWN_GRID_SIZE - 1,
    Math.floor(normalizedX.data * PALWORLD_PAL_SPAWN_GRID_SIZE)
  );
  const expectedCellY = Math.min(
    PALWORLD_PAL_SPAWN_GRID_SIZE - 1,
    Math.floor(normalizedY.data * PALWORLD_PAL_SPAWN_GRID_SIZE)
  );
  if (cellX.data !== expectedCellX || cellY.data !== expectedCellY) {
    return invalid(path, "정규화 좌표가 지정된 grid cell 범위와 일치해야 합니다.");
  }
  const placementCount = integerAt(
    record.data.placementCount,
    `${path}.placementCount`,
    1,
    MAX_PAL_SPAWN_PLACEMENTS
  );
  if (!placementCount.ok) return placementCount;
  const minimumLevel = integerAt(record.data.minimumLevel, `${path}.minimumLevel`, 1, 100);
  if (!minimumLevel.ok) return minimumLevel;
  const maximumLevel = integerAt(record.data.maximumLevel, `${path}.maximumLevel`, 1, 100);
  if (!maximumLevel.ok) return maximumLevel;
  if (minimumLevel.data > maximumLevel.data) {
    return invalid(`${path}.maximumLevel`, "minimumLevel 이상이어야 합니다.");
  }
  const daytime = booleanAt(record.data.daytime, `${path}.daytime`);
  if (!daytime.ok) return daytime;
  const nighttime = booleanAt(record.data.nighttime, `${path}.nighttime`);
  if (!nighttime.ok) return nighttime;
  if (!daytime.data && !nighttime.data) {
    return invalid(path, "daytime 또는 nighttime 중 하나 이상이 true여야 합니다.");
  }
  return valid(record.data as PalworldPalSpawnPoint);
}

export function validatePalworldMapMarkersResponse(
  value: unknown
): PalworldValidationResult<PalworldMapMarkersResponse> {
  const record = recordAt(
    value,
    "response",
    ["state", "world", "markers", "metadata"],
    ["overlay"]
  );
  if (!record.ok) return record;
  if (
    typeof record.data.state !== "string"
    || !(PALWORLD_MAP_MARKER_STATES as readonly string[]).includes(record.data.state)
  ) {
    return invalid("response.state", "ready 또는 data_unavailable이어야 합니다.");
  }
  const state = record.data.state as PalworldMapMarkerState;
  const world = worldAt(record.data.world, "response.world");
  if (!world.ok) return world;
  if (!Array.isArray(record.data.markers) || record.data.markers.length > MAX_MARKERS) {
    return invalid("response.markers", `최대 ${MAX_MARKERS}개의 배열이어야 합니다.`);
  }
  const ids = new Set<string>();
  const sourceRows = new Set<string>();
  let previousId = "";
  for (const [index, valueAtIndex] of record.data.markers.entries()) {
    const marker = validateMarkerAt(valueAtIndex, `response.markers[${index}]`);
    if (!marker.ok) return marker;
    if (ids.has(marker.data.id)) {
      return invalid(`response.markers[${index}].id`, "중복 marker ID입니다.");
    }
    if (sourceRows.has(marker.data.sourceRowId)) {
      return invalid(`response.markers[${index}].sourceRowId`, "중복 source row ID입니다.");
    }
    if (marker.data.id <= previousId) {
      return invalid(`response.markers[${index}].id`, "marker ID 기준 결정적 오름차순이어야 합니다.");
    }
    ids.add(marker.data.id);
    sourceRows.add(marker.data.sourceRowId);
    previousId = marker.data.id;
  }
  const metadata = validatePalworldDataMetadata(record.data.metadata);
  if (!metadata.ok) return invalid("response.metadata", metadata.error);
  if (state === "data_unavailable") {
    if (record.data.markers.length !== 0 || record.data.overlay !== undefined) {
      return invalid("response", "data_unavailable 상태에는 marker와 overlay를 포함할 수 없습니다.");
    }
  } else {
    if (record.data.markers.length === 0 || record.data.overlay === undefined) {
      return invalid("response", "ready 상태에는 하나 이상의 marker와 overlay가 필요합니다.");
    }
    const overlay = validateOverlayAt(record.data.overlay, "response.overlay");
    if (!overlay.ok) return overlay;
    if (
      overlay.data.compatibilityBasis
      !== "exact_map_geometry_and_coordinate_transform"
    ) {
      return invalid(
        "response.overlay.compatibilityBasis",
        "필드 보스 marker는 검증된 지도 geometry/coordinate transform 근거여야 합니다."
      );
    }
    if (overlay.data.targetGameVersion !== metadata.data.gameVersion) {
      return invalid(
        "response.overlay.targetGameVersion",
        "활성 Palworld gameVersion과 일치해야 합니다."
      );
    }
  }
  return valid(record.data as PalworldMapMarkersResponse);
}

export function assertPalworldMapMarkersResponse(value: unknown): PalworldMapMarkersResponse {
  const result = validatePalworldMapMarkersResponse(value);
  if (!result.ok) {
    throw new TypeError(`Palworld 지도 marker 응답 검증에 실패했습니다. ${result.error}`);
  }
  return result.data;
}

export function validatePalworldPalSpawnResponse(
  value: unknown
): PalworldValidationResult<PalworldPalSpawnResponse> {
  const record = recordAt(
    value,
    "response",
    [
      "state",
      "world",
      "palId",
      "gridSize",
      "totalPlacements",
      "points",
      "metadata"
    ],
    ["overlay"]
  );
  if (!record.ok) return record;
  if (
    typeof record.data.state !== "string"
    || !(PALWORLD_PAL_SPAWN_STATES as readonly string[]).includes(record.data.state)
  ) {
    return invalid(
      "response.state",
      "ready, confirmed_empty 또는 data_unavailable이어야 합니다."
    );
  }
  const state = record.data.state as PalworldPalSpawnState;
  const world = worldAt(record.data.world, "response.world");
  if (!world.ok) return world;
  const palId = stringAt(record.data.palId, "response.palId", 80);
  if (!palId.ok || !ID_PATTERN.test(palId.data)) {
    return invalid("response.palId", "안전한 소문자 canonical Pal ID여야 합니다.");
  }
  if (record.data.gridSize !== PALWORLD_PAL_SPAWN_GRID_SIZE) {
    return invalid(
      "response.gridSize",
      `${PALWORLD_PAL_SPAWN_GRID_SIZE}이어야 합니다.`
    );
  }
  const totalPlacements = integerAt(
    record.data.totalPlacements,
    "response.totalPlacements",
    0,
    MAX_PAL_SPAWN_PLACEMENTS
  );
  if (!totalPlacements.ok) return totalPlacements;
  if (!Array.isArray(record.data.points) || record.data.points.length > MAX_PAL_SPAWN_POINTS) {
    return invalid(
      "response.points",
      `최대 ${MAX_PAL_SPAWN_POINTS}개의 배열이어야 합니다.`
    );
  }
  const ids = new Set<string>();
  const cells = new Set<string>();
  let previousId = "";
  let placementSum = 0;
  for (const [index, valueAtIndex] of record.data.points.entries()) {
    const point = validatePalSpawnPointAt(valueAtIndex, `response.points[${index}]`);
    if (!point.ok) return point;
    if (ids.has(point.data.id)) {
      return invalid(`response.points[${index}].id`, "중복 spawn point ID입니다.");
    }
    const cellKey = `${point.data.cellX}:${point.data.cellY}`;
    if (cells.has(cellKey)) {
      return invalid(`response.points[${index}]`, "같은 grid cell에 중복 spawn point가 있습니다.");
    }
    if (point.data.id <= previousId) {
      return invalid(
        `response.points[${index}].id`,
        "spawn point ID 기준 결정적 오름차순이어야 합니다."
      );
    }
    ids.add(point.data.id);
    cells.add(cellKey);
    previousId = point.data.id;
    placementSum += point.data.placementCount;
  }
  if (placementSum !== totalPlacements.data) {
    return invalid(
      "response.totalPlacements",
      "각 spawn point의 placementCount 합계와 일치해야 합니다."
    );
  }
  const metadata = validatePalworldDataMetadata(record.data.metadata);
  if (!metadata.ok) return invalid("response.metadata", metadata.error);
  if (state === "data_unavailable") {
    if (
      record.data.points.length !== 0
      || totalPlacements.data !== 0
      || record.data.overlay !== undefined
    ) {
      return invalid(
        "response",
        "data_unavailable 상태에는 spawn point, placement 또는 overlay를 포함할 수 없습니다."
      );
    }
  } else {
    const expectsPoints = state === "ready";
    if (
      (expectsPoints && record.data.points.length === 0)
      || (!expectsPoints && record.data.points.length !== 0)
      || record.data.overlay === undefined
    ) {
      return invalid(
        "response",
        expectsPoints
          ? "ready 상태에는 하나 이상의 spawn point와 overlay가 필요합니다."
          : "confirmed_empty 상태에는 point 없이 overlay가 필요합니다."
      );
    }
    const overlay = validateOverlayAt(record.data.overlay, "response.overlay");
    if (!overlay.ok) return overlay;
    if (
      overlay.data.compatibilityBasis
      !== "exact_active_paldex_join_and_map_geometry"
    ) {
      return invalid(
        "response.overlay.compatibilityBasis",
        "일반 스폰은 활성 도감 exact join과 검증된 지도 geometry 근거여야 합니다."
      );
    }
    const sourceGameVersion = overlay.data.sourceGameVersion;
    const sourceSteamBuildId = overlay.data.sourceSteamBuildId;
    const hasSourceMetadata = sourceGameVersion !== null
      && sourceSteamBuildId !== null;
    const usesCompatibilityApproval =
      overlay.data.activationBasis === "versioned_compatibility_approval"
      && overlay.data.compatibilityApprovalSha256 !== undefined;
    if (!hasSourceMetadata && !usesCompatibilityApproval) {
      return invalid(
        "response.overlay",
        "검증된 source metadata 또는 checksum으로 고정된 versioned compatibility approval이 필요합니다."
      );
    }
    if (hasSourceMetadata) {
      if (overlay.data.activationBasis === "versioned_compatibility_approval") {
        return invalid(
          "response.overlay.activationBasis",
          "source metadata가 있으면 compatibility approval 대체 경로를 사용할 수 없습니다."
        );
      }
      if (sourceGameVersion !== overlay.data.targetGameVersion) {
        return invalid(
          "response.overlay.sourceGameVersion",
          "targetGameVersion과 일치해야 합니다."
        );
      }
      if (!/^[1-9][0-9]{0,19}$/u.test(sourceSteamBuildId)) {
        return invalid(
          "response.overlay.sourceSteamBuildId",
          "0으로 시작하지 않는 20자리 이하 숫자 Steam build ID여야 합니다."
        );
      }
    } else if (
      sourceGameVersion !== null
      || sourceSteamBuildId !== null
    ) {
      return invalid(
        "response.overlay",
        "source gameVersion과 Steam build ID는 함께 설정하거나 함께 null이어야 합니다."
      );
    }
    if (overlay.data.targetGameVersion !== metadata.data.gameVersion) {
      return invalid(
        "response.overlay.targetGameVersion",
        "활성 Palworld gameVersion과 일치해야 합니다."
      );
    }
  }
  return valid(record.data as PalworldPalSpawnResponse);
}

export function assertPalworldPalSpawnResponse(value: unknown): PalworldPalSpawnResponse {
  const result = validatePalworldPalSpawnResponse(value);
  if (!result.ok) {
    throw new TypeError(`Palworld Pal spawn 응답 검증에 실패했습니다. ${result.error}`);
  }
  return result.data;
}

function locationCategoryAt(
  value: unknown,
  path: string
): PalworldValidationResult<PalworldMapLocationCategory> {
  return typeof value === "string"
    && (PALWORLD_MAP_LOCATION_CATEGORIES as readonly string[]).includes(value)
    ? valid(value as PalworldMapLocationCategory)
    : invalid(path, "허용된 지도 위치 카테고리여야 합니다.");
}

function validateLocationAt(
  value: unknown,
  path: string
): PalworldValidationResult<PalworldMapLocation> {
  const record = recordAt(value, path, [
    "id",
    "category",
    "subtype",
    "normalizedX",
    "normalizedY"
  ]);
  if (!record.ok) return record;
  const id = stringAt(record.data.id, `${path}.id`, 80);
  if (!id.ok || !ID_PATTERN.test(id.data)) {
    return invalid(`${path}.id`, "안전한 소문자 canonical ID여야 합니다.");
  }
  const category = locationCategoryAt(record.data.category, `${path}.category`);
  if (!category.ok) return category;
  const subtype = stringAt(record.data.subtype, `${path}.subtype`, 80);
  if (!subtype.ok || !ID_PATTERN.test(subtype.data)) {
    return invalid(`${path}.subtype`, "안전한 소문자 canonical subtype이어야 합니다.");
  }
  for (const field of ["normalizedX", "normalizedY"] as const) {
    const coordinate = finiteNumberAt(record.data[field], `${path}.${field}`, 0, 1);
    if (!coordinate.ok) return coordinate;
  }
  return valid(record.data as PalworldMapLocation);
}

function validateLocationCategoryCountsAt(
  value: unknown,
  path: string,
  maximum: number
): PalworldValidationResult<PalworldMapLocationCategoryCounts> {
  const record = recordAt(value, path, PALWORLD_MAP_LOCATION_CATEGORIES);
  if (!record.ok) return record;
  const counts = {} as PalworldMapLocationCategoryCounts;
  for (const category of PALWORLD_MAP_LOCATION_CATEGORIES) {
    const count = integerAt(
      record.data[category],
      `${path}.${category}`,
      0,
      maximum
    );
    if (!count.ok) return count;
    counts[category] = count.data;
  }
  return valid(counts);
}

function validateLocationArtifactTransformAt(
  value: unknown,
  path: string
): PalworldValidationResult<PalworldMapLocationArtifactTransform> {
  const record = recordAt(value, path, [
    "status",
    "revision",
    "horizontalAxis",
    "verticalAxis",
    "invertHorizontal",
    "invertVertical",
    "sourceBounds"
  ]);
  if (!record.ok) return record;
  if (record.data.status !== "verified") {
    return invalid(`${path}.status`, "verified여야 합니다.");
  }
  const revision = stringAt(record.data.revision, `${path}.revision`, 128);
  if (!revision.ok) return revision;
  for (const field of ["horizontalAxis", "verticalAxis"] as const) {
    if (record.data[field] !== "world_x" && record.data[field] !== "world_y") {
      return invalid(`${path}.${field}`, "world_x 또는 world_y여야 합니다.");
    }
  }
  if (record.data.horizontalAxis === record.data.verticalAxis) {
    return invalid(path, "수평축과 수직축은 서로 달라야 합니다.");
  }
  for (const field of ["invertHorizontal", "invertVertical"] as const) {
    const flag = booleanAt(record.data[field], `${path}.${field}`);
    if (!flag.ok) return flag;
  }
  const bounds = recordAt(record.data.sourceBounds, `${path}.sourceBounds`, [
    "minX",
    "maxX",
    "minY",
    "maxY"
  ]);
  if (!bounds.ok) return bounds;
  const parsedBounds: Record<string, number> = {};
  for (const field of ["minX", "maxX", "minY", "maxY"] as const) {
    const coordinate = finiteNumberAt(
      bounds.data[field],
      `${path}.sourceBounds.${field}`,
      -1_000_000_000,
      1_000_000_000
    );
    if (!coordinate.ok) return coordinate;
    parsedBounds[field] = coordinate.data;
  }
  if (
    parsedBounds.minX! >= parsedBounds.maxX!
    || parsedBounds.minY! >= parsedBounds.maxY!
  ) {
    return invalid(`${path}.sourceBounds`, "최솟값은 최댓값보다 작아야 합니다.");
  }
  return valid(record.data as PalworldMapLocationArtifactTransform);
}

function validateLocationArtifactEntryAt(
  value: unknown,
  path: string
): PalworldValidationResult<PalworldMapLocationArtifactEntry> {
  const record = recordAt(value, path, [
    "id",
    "sourceActorId",
    "sourceClass",
    "sourceMemberPath",
    "sourceActorExportIndex",
    "sourceInstanceId",
    "category",
    "subtype",
    "normalizedX",
    "normalizedY"
  ]);
  if (!record.ok) return record;
  const publicLocation = validateLocationAt({
    id: record.data.id,
    category: record.data.category,
    subtype: record.data.subtype,
    normalizedX: record.data.normalizedX,
    normalizedY: record.data.normalizedY
  }, path);
  if (!publicLocation.ok) return publicLocation;
  for (const field of ["sourceActorId", "sourceClass"] as const) {
    const sourceValue = stringAt(record.data[field], `${path}.${field}`, 256);
    if (!sourceValue.ok) return sourceValue;
  }
  const sourceMember = sourceMemberAt(
    record.data.sourceMemberPath,
    `${path}.sourceMemberPath`
  );
  if (!sourceMember.ok) return sourceMember;
  const sourceActorExportIndex = integerAt(
    record.data.sourceActorExportIndex,
    `${path}.sourceActorExportIndex`,
    0,
    1_000_000
  );
  if (!sourceActorExportIndex.ok) return sourceActorExportIndex;
  if (record.data.sourceInstanceId !== null) {
    const instanceId = stringAt(
      record.data.sourceInstanceId,
      `${path}.sourceInstanceId`,
      160
    );
    if (!instanceId.ok) return instanceId;
  }
  return valid(record.data as PalworldMapLocationArtifactEntry);
}

export function validatePalworldMapLocationsArtifact(
  value: unknown
): PalworldValidationResult<PalworldMapLocationsArtifact> {
  const root = recordAt(value, "mapLocationsArtifact", [
    "schemaVersion",
    "targetGameVersion",
    "activation",
    "source",
    "totalLocations",
    "worlds"
  ]);
  if (!root.ok) return root;
  if (root.data.schemaVersion !== 1) {
    return invalid("mapLocationsArtifact.schemaVersion", "1이어야 합니다.");
  }
  const targetGameVersion = stringAt(
    root.data.targetGameVersion,
    "mapLocationsArtifact.targetGameVersion",
    64
  );
  if (!targetGameVersion.ok || !GAME_VERSION_PATTERN.test(targetGameVersion.data)) {
    return invalid(
      "mapLocationsArtifact.targetGameVersion",
      "major.minor.patch 형식이어야 합니다."
    );
  }
  if (root.data.activation !== "candidate" && root.data.activation !== "active") {
    return invalid(
      "mapLocationsArtifact.activation",
      "candidate 또는 active여야 합니다."
    );
  }
  const source = recordAt(root.data.source, "mapLocationsArtifact.source", [
    "sourceType",
    "archiveSha256",
    "indexMember",
    "indexMemberSha256",
    "memberInventorySha256",
    "selectedMemberCount",
    "sourceGameVersion",
    "sourceSteamBuildId",
    "rightsVerified",
    "usageBasis"
  ]);
  if (!source.ok) return source;
  if (source.data.sourceType !== "operator_pak_export") {
    return invalid(
      "mapLocationsArtifact.source.sourceType",
      "operator_pak_export여야 합니다."
    );
  }
  for (const field of [
    "archiveSha256",
    "indexMemberSha256",
    "memberInventorySha256"
  ] as const) {
    const checksum = sha256At(
      source.data[field],
      `mapLocationsArtifact.source.${field}`
    );
    if (!checksum.ok) return checksum;
  }
  const indexMember = sourceMemberAt(
    source.data.indexMember,
    "mapLocationsArtifact.source.indexMember"
  );
  if (!indexMember.ok) return indexMember;
  const selectedMemberCount = integerAt(
    source.data.selectedMemberCount,
    "mapLocationsArtifact.source.selectedMemberCount",
    1,
    20_000
  );
  if (!selectedMemberCount.ok) return selectedMemberCount;
  const sourceGameVersion = source.data.sourceGameVersion;
  const sourceSteamBuildId = source.data.sourceSteamBuildId;
  if ((sourceGameVersion === null) !== (sourceSteamBuildId === null)) {
    return invalid(
      "mapLocationsArtifact.source",
      "source gameVersion과 Steam build ID는 함께 설정하거나 함께 null이어야 합니다."
    );
  }
  if (sourceGameVersion !== null) {
    const version = stringAt(
      sourceGameVersion,
      "mapLocationsArtifact.source.sourceGameVersion",
      64
    );
    if (!version.ok || !GAME_VERSION_PATTERN.test(version.data)) {
      return invalid(
        "mapLocationsArtifact.source.sourceGameVersion",
        "major.minor.patch 형식이어야 합니다."
      );
    }
    const build = stringAt(
      sourceSteamBuildId,
      "mapLocationsArtifact.source.sourceSteamBuildId",
      20
    );
    if (!build.ok || !STEAM_BUILD_ID_PATTERN.test(build.data)) {
      return invalid(
        "mapLocationsArtifact.source.sourceSteamBuildId",
        "0으로 시작하지 않는 20자리 이하 숫자 Steam build ID여야 합니다."
      );
    }
  }
  if (root.data.activation === "active") {
    if (
      sourceGameVersion !== targetGameVersion.data
      || sourceSteamBuildId === null
    ) {
      return invalid(
        "mapLocationsArtifact.activation",
        "active 상태에는 target과 일치하는 source version 및 Steam build ID가 필요합니다."
      );
    }
  }
  if (source.data.rightsVerified !== false) {
    return invalid(
      "mapLocationsArtifact.source.rightsVerified",
      "독립적으로 확인되지 않은 권리를 true로 표시할 수 없습니다."
    );
  }
  if (source.data.usageBasis !== "operator_reference_use") {
    return invalid(
      "mapLocationsArtifact.source.usageBasis",
      "operator_reference_use여야 합니다."
    );
  }
  const totalLocations = integerAt(
    root.data.totalLocations,
    "mapLocationsArtifact.totalLocations",
    0,
    PALWORLD_MAP_LOCATION_MAX_ARTIFACT_ENTRIES
  );
  if (!totalLocations.ok) return totalLocations;
  if (!Array.isArray(root.data.worlds) || root.data.worlds.length > PALWORLD_MAP_WORLDS.length) {
    return invalid(
      "mapLocationsArtifact.worlds",
      `최대 ${PALWORLD_MAP_WORLDS.length}개의 배열이어야 합니다.`
    );
  }
  const worldIds = new Set<PalworldMapWorld>();
  const locationIds = new Set<string>();
  const sourceActors = new Set<string>();
  let previousWorldIndex = -1;
  let actualTotal = 0;
  for (const [worldIndex, valueAtIndex] of root.data.worlds.entries()) {
    const path = `mapLocationsArtifact.worlds[${worldIndex}]`;
    const worldRecord = recordAt(valueAtIndex, path, [
      "world",
      "targetMapAssetSha256",
      "transform",
      "locationCount",
      "categoryCounts",
      "locations"
    ]);
    if (!worldRecord.ok) return worldRecord;
    const world = worldAt(worldRecord.data.world, `${path}.world`);
    if (!world.ok) return world;
    const canonicalWorldIndex = PALWORLD_MAP_WORLDS.indexOf(world.data);
    if (canonicalWorldIndex <= previousWorldIndex || worldIds.has(world.data)) {
      return invalid(`${path}.world`, "world는 중복 없이 canonical 순서여야 합니다.");
    }
    previousWorldIndex = canonicalWorldIndex;
    worldIds.add(world.data);
    const mapSha = sha256At(
      worldRecord.data.targetMapAssetSha256,
      `${path}.targetMapAssetSha256`
    );
    if (!mapSha.ok) return mapSha;
    const transform = validateLocationArtifactTransformAt(
      worldRecord.data.transform,
      `${path}.transform`
    );
    if (!transform.ok) return transform;
    const locationCount = integerAt(
      worldRecord.data.locationCount,
      `${path}.locationCount`,
      0,
      PALWORLD_MAP_LOCATION_MAX_ARTIFACT_ENTRIES
    );
    if (!locationCount.ok) return locationCount;
    const categoryCounts = validateLocationCategoryCountsAt(
      worldRecord.data.categoryCounts,
      `${path}.categoryCounts`,
      PALWORLD_MAP_LOCATION_MAX_ARTIFACT_ENTRIES
    );
    if (!categoryCounts.ok) return categoryCounts;
    if (
      !Array.isArray(worldRecord.data.locations)
      || worldRecord.data.locations.length !== locationCount.data
    ) {
      return invalid(
        `${path}.locations`,
        "locationCount와 같은 길이의 배열이어야 합니다."
      );
    }
    const observedCounts = Object.fromEntries(
      PALWORLD_MAP_LOCATION_CATEGORIES.map((category) => [category, 0])
    ) as PalworldMapLocationCategoryCounts;
    let previousLocationId = "";
    for (const [index, entryValue] of worldRecord.data.locations.entries()) {
      const entryPath = `${path}.locations[${index}]`;
      const entry = validateLocationArtifactEntryAt(entryValue, entryPath);
      if (!entry.ok) return entry;
      if (entry.data.id <= previousLocationId || locationIds.has(entry.data.id)) {
        return invalid(
          `${entryPath}.id`,
          "location ID는 전체 artifact에서 중복 없이 결정적 오름차순이어야 합니다."
        );
      }
      const sourceActorKey =
        `${entry.data.sourceMemberPath}\u0000${entry.data.sourceActorExportIndex}`;
      if (sourceActors.has(sourceActorKey)) {
        return invalid(
          entryPath,
          "같은 source member의 actor export index가 중복되었습니다."
        );
      }
      previousLocationId = entry.data.id;
      locationIds.add(entry.data.id);
      sourceActors.add(sourceActorKey);
      observedCounts[entry.data.category] += 1;
    }
    for (const category of PALWORLD_MAP_LOCATION_CATEGORIES) {
      if (observedCounts[category] !== categoryCounts.data[category]) {
        return invalid(
          `${path}.categoryCounts.${category}`,
          "실제 location 카테고리 수와 일치해야 합니다."
        );
      }
    }
    if (
      Object.values(categoryCounts.data).reduce((sum, count) => sum + count, 0)
      !== locationCount.data
    ) {
      return invalid(`${path}.categoryCounts`, "합계가 locationCount와 일치해야 합니다.");
    }
    actualTotal += locationCount.data;
  }
  if (actualTotal !== totalLocations.data) {
    return invalid(
      "mapLocationsArtifact.totalLocations",
      "world별 locationCount 합계와 일치해야 합니다."
    );
  }
  return valid(root.data as PalworldMapLocationsArtifact);
}

export function assertPalworldMapLocationsArtifact(
  value: unknown
): PalworldMapLocationsArtifact {
  const result = validatePalworldMapLocationsArtifact(value);
  if (!result.ok) {
    throw new TypeError(
      `Palworld 지도 위치 artifact 검증에 실패했습니다. ${result.error}`
    );
  }
  return result.data;
}

export function validatePalworldMapLocationsArtifactManifest(
  value: unknown
): PalworldValidationResult<PalworldMapLocationsArtifactManifest> {
  const record = recordAt(value, "mapLocationsManifest", [
    "schemaVersion",
    "targetGameVersion",
    "artifactFile",
    "artifactSha256"
  ]);
  if (!record.ok) return record;
  if (record.data.schemaVersion !== 1) {
    return invalid("mapLocationsManifest.schemaVersion", "1이어야 합니다.");
  }
  const version = stringAt(
    record.data.targetGameVersion,
    "mapLocationsManifest.targetGameVersion",
    64
  );
  if (!version.ok || !GAME_VERSION_PATTERN.test(version.data)) {
    return invalid(
      "mapLocationsManifest.targetGameVersion",
      "major.minor.patch 형식이어야 합니다."
    );
  }
  if (record.data.artifactFile !== "map-locations.json") {
    return invalid(
      "mapLocationsManifest.artifactFile",
      "map-locations.json이어야 합니다."
    );
  }
  const checksum = sha256At(
    record.data.artifactSha256,
    "mapLocationsManifest.artifactSha256"
  );
  if (!checksum.ok) return checksum;
  return valid(record.data as PalworldMapLocationsArtifactManifest);
}

export function assertPalworldMapLocationsArtifactManifest(
  value: unknown
): PalworldMapLocationsArtifactManifest {
  const result = validatePalworldMapLocationsArtifactManifest(value);
  if (!result.ok) {
    throw new TypeError(
      `Palworld 지도 위치 manifest 검증에 실패했습니다. ${result.error}`
    );
  }
  return result.data;
}

export function validatePalworldMapLocationsResponse(
  value: unknown
): PalworldValidationResult<PalworldMapLocationsResponse> {
  const record = recordAt(
    value,
    "response",
    [
      "state",
      "world",
      "layers",
      "offset",
      "limit",
      "total",
      "returned",
      "hasMore",
      "locations",
      "metadata"
    ],
    ["overlay"]
  );
  if (!record.ok) return record;
  if (
    typeof record.data.state !== "string"
    || !(PALWORLD_MAP_LOCATION_STATES as readonly string[]).includes(record.data.state)
  ) {
    return invalid(
      "response.state",
      "ready, confirmed_empty 또는 data_unavailable이어야 합니다."
    );
  }
  const state = record.data.state as PalworldMapLocationState;
  const world = worldAt(record.data.world, "response.world");
  if (!world.ok) return world;
  if (
    !Array.isArray(record.data.layers)
    || record.data.layers.length < 1
    || record.data.layers.length > PALWORLD_MAP_LOCATION_CATEGORIES.length
  ) {
    return invalid("response.layers", "하나 이상의 허용된 레이어 배열이어야 합니다.");
  }
  const layers: PalworldMapLocationCategory[] = [];
  let previousLayerIndex = -1;
  for (const [index, layerValue] of record.data.layers.entries()) {
    const layer = locationCategoryAt(layerValue, `response.layers[${index}]`);
    if (!layer.ok) return layer;
    const canonicalIndex = PALWORLD_MAP_LOCATION_CATEGORIES.indexOf(layer.data);
    if (canonicalIndex <= previousLayerIndex) {
      return invalid(
        `response.layers[${index}]`,
        "레이어는 중복 없이 canonical 순서여야 합니다."
      );
    }
    previousLayerIndex = canonicalIndex;
    layers.push(layer.data);
  }
  const offset = integerAt(
    record.data.offset,
    "response.offset",
    0,
    PALWORLD_MAP_LOCATION_MAX_ARTIFACT_ENTRIES
  );
  if (!offset.ok) return offset;
  const limit = integerAt(
    record.data.limit,
    "response.limit",
    1,
    PALWORLD_MAP_LOCATION_MAX_RESPONSE
  );
  if (!limit.ok) return limit;
  const total = integerAt(
    record.data.total,
    "response.total",
    0,
    PALWORLD_MAP_LOCATION_MAX_ARTIFACT_ENTRIES
  );
  if (!total.ok) return total;
  const returned = integerAt(
    record.data.returned,
    "response.returned",
    0,
    PALWORLD_MAP_LOCATION_MAX_RESPONSE
  );
  if (!returned.ok || returned.data > limit.data) {
    return invalid("response.returned", "limit 이하의 정수여야 합니다.");
  }
  const hasMore = booleanAt(record.data.hasMore, "response.hasMore");
  if (!hasMore.ok) return hasMore;
  if (
    !Array.isArray(record.data.locations)
    || record.data.locations.length !== returned.data
  ) {
    return invalid(
      "response.locations",
      "returned와 같은 길이의 배열이어야 합니다."
    );
  }
  const ids = new Set<string>();
  let previousId = "";
  for (const [index, locationValue] of record.data.locations.entries()) {
    const location = validateLocationAt(
      locationValue,
      `response.locations[${index}]`
    );
    if (!location.ok) return location;
    if (
      location.data.id <= previousId
      || ids.has(location.data.id)
    ) {
      return invalid(
        `response.locations[${index}].id`,
        "location ID 기준 중복 없는 결정적 오름차순이어야 합니다."
      );
    }
    if (!layers.includes(location.data.category)) {
      return invalid(
        `response.locations[${index}].category`,
        "요청한 layer에 포함되어야 합니다."
      );
    }
    ids.add(location.data.id);
    previousId = location.data.id;
  }
  if (hasMore.data !== (offset.data + returned.data < total.data)) {
    return invalid(
      "response.hasMore",
      "offset, returned 및 total에서 계산한 값과 일치해야 합니다."
    );
  }
  const metadata = validatePalworldDataMetadata(record.data.metadata);
  if (!metadata.ok) return invalid("response.metadata", metadata.error);
  if (state === "data_unavailable") {
    if (
      total.data !== 0
      || returned.data !== 0
      || hasMore.data
      || record.data.overlay !== undefined
    ) {
      return invalid(
        "response",
        "data_unavailable 상태에는 위치, count, overlay를 포함할 수 없습니다."
      );
    }
  } else {
    if (
      (state === "ready" && returned.data === 0)
      || (state === "confirmed_empty" && returned.data !== 0)
      || record.data.overlay === undefined
    ) {
      return invalid(
        "response",
        "ready는 위치를 포함하고 confirmed_empty는 빈 위치와 overlay를 포함해야 합니다."
      );
    }
    const overlay = validateOverlayAt(record.data.overlay, "response.overlay");
    if (!overlay.ok) return overlay;
    if (
      overlay.data.compatibilityBasis
      !== "exact_world_actor_join_and_map_geometry"
    ) {
      return invalid(
        "response.overlay.compatibilityBasis",
        "지도 위치는 world actor exact join과 검증된 지도 geometry 근거여야 합니다."
      );
    }
    if (overlay.data.targetGameVersion !== metadata.data.gameVersion) {
      return invalid(
        "response.overlay.targetGameVersion",
        "활성 Palworld gameVersion과 일치해야 합니다."
      );
    }
    const hasSourceMetadata =
      overlay.data.sourceGameVersion !== null
      && overlay.data.sourceSteamBuildId !== null;
    const usesCompatibilityApproval =
      overlay.data.activationBasis === "versioned_compatibility_approval"
      && overlay.data.compatibilityApprovalSha256 !== undefined;
    if (!hasSourceMetadata && !usesCompatibilityApproval) {
      return invalid(
        "response.overlay",
        "source metadata 또는 exact-checksum compatibility approval이 필요합니다."
      );
    }
    if (
      hasSourceMetadata
      && (
        overlay.data.sourceGameVersion !== metadata.data.gameVersion
        || overlay.data.activationBasis !== "source_metadata"
        || overlay.data.compatibilityApprovalSha256 !== undefined
      )
    ) {
      return invalid(
        "response.overlay",
        "source metadata 활성화는 active release와 일치하고 compatibility approval을 포함하지 않아야 합니다."
      );
    }
    if (
      usesCompatibilityApproval
      && (
        overlay.data.sourceGameVersion !== null
        || overlay.data.sourceSteamBuildId !== null
      )
    ) {
      return invalid(
        "response.overlay",
        "compatibility approval 활성화는 미확인 source version을 null로 유지해야 합니다."
      );
    }
  }
  return valid(record.data as PalworldMapLocationsResponse);
}

export function assertPalworldMapLocationsResponse(
  value: unknown
): PalworldMapLocationsResponse {
  const result = validatePalworldMapLocationsResponse(value);
  if (!result.ok) {
    throw new TypeError(
      `Palworld 지도 위치 응답 검증에 실패했습니다. ${result.error}`
    );
  }
  return result.data;
}
