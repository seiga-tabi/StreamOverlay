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
export const PALWORLD_MAP_OVERLAY_COMPATIBILITY_BASES = [
  "exact_map_geometry_and_coordinate_transform",
  "exact_active_paldex_join_and_map_geometry"
] as const;
export const PALWORLD_PAL_SPAWN_GRID_SIZE = 32;

export type PalworldMapWorld = (typeof PALWORLD_MAP_WORLDS)[number];
export type PalworldMapMarkerState = (typeof PALWORLD_MAP_MARKER_STATES)[number];
export type PalworldPalSpawnState = (typeof PALWORLD_PAL_SPAWN_STATES)[number];
export type PalworldMapOverlayCompatibilityBasis =
  (typeof PALWORLD_MAP_OVERLAY_COMPATIBILITY_BASES)[number];

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

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/u;
const SOURCE_MEMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/u;
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
    if (
      overlay.data.sourceGameVersion === null
      || overlay.data.sourceSteamBuildId === null
    ) {
      return invalid(
        "response.overlay",
        "ready 또는 confirmed_empty 일반 스폰에는 검증된 source gameVersion과 Steam build ID가 필요합니다."
      );
    }
    if (overlay.data.sourceGameVersion !== overlay.data.targetGameVersion) {
      return invalid(
        "response.overlay.sourceGameVersion",
        "targetGameVersion과 일치해야 합니다."
      );
    }
    if (!/^[1-9][0-9]{0,19}$/u.test(overlay.data.sourceSteamBuildId)) {
      return invalid(
        "response.overlay.sourceSteamBuildId",
        "0으로 시작하지 않는 20자리 이하 숫자 Steam build ID여야 합니다."
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
