import {
  validatePalworldDataMetadata,
  validatePalworldPalReference,
  type PalworldDataMetadata,
  type PalworldPalReference,
  type PalworldValidationResult
} from "./palworld.js";

export const PALWORLD_MAP_WORLDS = ["main", "tree"] as const;
export const PALWORLD_MAP_MARKER_STATES = ["ready", "data_unavailable"] as const;

export type PalworldMapWorld = (typeof PALWORLD_MAP_WORLDS)[number];
export type PalworldMapMarkerState = (typeof PALWORLD_MAP_MARKER_STATES)[number];

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
  compatibilityBasis: "exact_map_geometry_and_coordinate_transform";
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

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/u;
const SOURCE_MEMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/u;
const MAX_MARKERS = 500;

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
  if (record.data.compatibilityBasis !== "exact_map_geometry_and_coordinate_transform") {
    return invalid(
      `${path}.compatibilityBasis`,
      "exact_map_geometry_and_coordinate_transform이어야 합니다."
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
