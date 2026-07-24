import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertPalworldMapMarkersResponse,
  PALWORLD_MAP_WORLDS,
  type PalworldDataMetadata,
  type PalworldMapMarkersResponse,
  type PalworldMapWorld,
  type PalworldPalDetail
} from "@streamops/shared";
import type { PalworldDataService } from "../services/palworld-data.js";

export const PALWORLD_MAP_MARKER_ARTIFACT_FILE = "map-markers.json";
export const PALWORLD_MAP_MARKER_MANIFEST_FILE = "map-markers-manifest.json";

const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_MAP_ASSET_BYTES = 16 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/u;
const RELEASE_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const SOURCE_MEMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/u;

export type PalworldMapMarkerArtifactEntry = {
  id: string;
  sourceRowId: string;
  sourceInternalId: string;
  palId: string;
  level: number;
  normalizedX: number;
  normalizedY: number;
};

export type PalworldMapCoordinateTransform = {
  status: "pending" | "verified";
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

export type PalworldMapMarkerArtifactWorld = {
  world: PalworldMapWorld;
  targetMapAssetSha256: string;
  transform: PalworldMapCoordinateTransform;
  markers: PalworldMapMarkerArtifactEntry[];
};

export type PalworldMapMarkerArtifact = {
  schemaVersion: 1;
  targetGameVersion: string;
  activation: "candidate" | "active";
  source: {
    sourceType: "operator_pak_export";
    archiveSha256: string;
    sourceMember: string;
    sourceMemberSha256: string;
    sourceGameVersion: string | null;
    sourceSteamBuildId: string | null;
    rightsVerified: false;
    usageBasis: "operator_reference_use";
  };
  worlds: PalworldMapMarkerArtifactWorld[];
};

export type PalworldMapMarkerArtifactManifest = {
  schemaVersion: 1;
  targetGameVersion: string;
  artifactFile: typeof PALWORLD_MAP_MARKER_ARTIFACT_FILE;
  artifactSha256: string;
};

export type PalworldMapMarkerProvider = {
  response(
    world: PalworldMapWorld,
    metadata: PalworldDataMetadata
  ): PalworldMapMarkersResponse;
};

export class PalworldMapMarkerArtifactError extends Error {
  readonly code = "PALWORLD_MAP_MARKER_ARTIFACT_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PalworldMapMarkerArtifactError";
  }
}

function fail(pathName: string, message: string): never {
  throw new PalworldMapMarkerArtifactError(`${pathName}: ${message}`);
}

function recordAt(
  value: unknown,
  pathName: string,
  requiredKeys: readonly string[]
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(pathName, "객체여야 합니다.");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(requiredKeys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${pathName}.${key}`, "허용되지 않은 필드입니다.");
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(record, key)) fail(`${pathName}.${key}`, "필수 필드가 없습니다.");
  }
  return record;
}

function stringAt(value: unknown, pathName: string, maximum: number): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > maximum
    || value.trim() !== value
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    fail(pathName, `앞뒤 공백과 제어문자가 없는 ${maximum}자 이하 문자열이어야 합니다.`);
  }
  return value;
}

function sha256At(value: unknown, pathName: string): string {
  const checksum = stringAt(value, pathName, 64);
  if (!SHA256_PATTERN.test(checksum)) fail(pathName, "소문자 64자리 SHA-256 hex여야 합니다.");
  return checksum;
}

function finiteAt(value: unknown, pathName: string, minimum: number, maximum: number): number {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || value < minimum
    || value > maximum
  ) {
    fail(pathName, `${minimum} 이상 ${maximum} 이하의 유한한 숫자여야 합니다.`);
  }
  return value;
}

function sourceMemberAt(value: unknown, pathName: string): string {
  const member = stringAt(value, pathName, 512);
  if (
    !SOURCE_MEMBER_PATTERN.test(member)
    || member.startsWith("/")
    || member.includes("\\")
    || member.includes("%")
    || member.includes("//")
    || member.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    fail(pathName, "안전한 archive 상대 경로여야 합니다.");
  }
  return member;
}

function validateSource(value: unknown): PalworldMapMarkerArtifact["source"] {
  const source = recordAt(value, "artifact.source", [
    "sourceType",
    "archiveSha256",
    "sourceMember",
    "sourceMemberSha256",
    "sourceGameVersion",
    "sourceSteamBuildId",
    "rightsVerified",
    "usageBasis"
  ]);
  if (source.sourceType !== "operator_pak_export") {
    fail("artifact.source.sourceType", "operator_pak_export여야 합니다.");
  }
  sha256At(source.archiveSha256, "artifact.source.archiveSha256");
  sourceMemberAt(source.sourceMember, "artifact.source.sourceMember");
  sha256At(source.sourceMemberSha256, "artifact.source.sourceMemberSha256");
  for (const field of ["sourceGameVersion", "sourceSteamBuildId"] as const) {
    if (source[field] !== null) {
      stringAt(source[field], `artifact.source.${field}`, 64);
    }
  }
  if (source.rightsVerified !== false) {
    fail("artifact.source.rightsVerified", "독립적으로 확인되지 않은 권리를 true로 표시할 수 없습니다.");
  }
  if (source.usageBasis !== "operator_reference_use") {
    fail("artifact.source.usageBasis", "operator_reference_use여야 합니다.");
  }
  return source as PalworldMapMarkerArtifact["source"];
}

function validateTransform(
  value: unknown,
  pathName: string
): PalworldMapCoordinateTransform {
  const transform = recordAt(value, pathName, [
    "status",
    "revision",
    "horizontalAxis",
    "verticalAxis",
    "invertHorizontal",
    "invertVertical",
    "sourceBounds"
  ]);
  if (transform.status !== "pending" && transform.status !== "verified") {
    fail(`${pathName}.status`, "pending 또는 verified여야 합니다.");
  }
  stringAt(transform.revision, `${pathName}.revision`, 128);
  for (const field of ["horizontalAxis", "verticalAxis"] as const) {
    if (transform[field] !== "world_x" && transform[field] !== "world_y") {
      fail(`${pathName}.${field}`, "world_x 또는 world_y여야 합니다.");
    }
  }
  if (transform.horizontalAxis === transform.verticalAxis) {
    fail(pathName, "가로와 세로 축은 서로 달라야 합니다.");
  }
  for (const field of ["invertHorizontal", "invertVertical"] as const) {
    if (typeof transform[field] !== "boolean") {
      fail(`${pathName}.${field}`, "boolean이어야 합니다.");
    }
  }
  const bounds = recordAt(transform.sourceBounds, `${pathName}.sourceBounds`, [
    "minX",
    "maxX",
    "minY",
    "maxY"
  ]);
  for (const field of ["minX", "maxX", "minY", "maxY"] as const) {
    finiteAt(bounds[field], `${pathName}.sourceBounds.${field}`, -100_000_000, 100_000_000);
  }
  if (
    (bounds.minX as number) >= (bounds.maxX as number)
    || (bounds.minY as number) >= (bounds.maxY as number)
  ) {
    fail(`${pathName}.sourceBounds`, "최솟값은 최댓값보다 작아야 합니다.");
  }
  return transform as unknown as PalworldMapCoordinateTransform;
}

function validateEntry(
  value: unknown,
  pathName: string
): PalworldMapMarkerArtifactEntry {
  const entry = recordAt(value, pathName, [
    "id",
    "sourceRowId",
    "sourceInternalId",
    "palId",
    "level",
    "normalizedX",
    "normalizedY"
  ]);
  const id = stringAt(entry.id, `${pathName}.id`, 80);
  const palId = stringAt(entry.palId, `${pathName}.palId`, 80);
  if (!SAFE_ID_PATTERN.test(id)) fail(`${pathName}.id`, "안전한 소문자 canonical ID여야 합니다.");
  if (!SAFE_ID_PATTERN.test(palId)) fail(`${pathName}.palId`, "안전한 소문자 Pal ID여야 합니다.");
  stringAt(entry.sourceRowId, `${pathName}.sourceRowId`, 160);
  stringAt(entry.sourceInternalId, `${pathName}.sourceInternalId`, 160);
  const level = finiteAt(entry.level, `${pathName}.level`, 1, 100);
  if (!Number.isInteger(level)) fail(`${pathName}.level`, "정수여야 합니다.");
  finiteAt(entry.normalizedX, `${pathName}.normalizedX`, 0, 1);
  finiteAt(entry.normalizedY, `${pathName}.normalizedY`, 0, 1);
  return entry as unknown as PalworldMapMarkerArtifactEntry;
}

export function assertPalworldMapMarkerArtifact(value: unknown): PalworldMapMarkerArtifact {
  const artifact = recordAt(value, "artifact", [
    "schemaVersion",
    "targetGameVersion",
    "activation",
    "source",
    "worlds"
  ]);
  if (artifact.schemaVersion !== 1) fail("artifact.schemaVersion", "1이어야 합니다.");
  const targetGameVersion = stringAt(
    artifact.targetGameVersion,
    "artifact.targetGameVersion",
    64
  );
  if (!RELEASE_PATTERN.test(targetGameVersion)) {
    fail("artifact.targetGameVersion", "semver 형식이어야 합니다.");
  }
  if (artifact.activation !== "candidate" && artifact.activation !== "active") {
    fail("artifact.activation", "candidate 또는 active여야 합니다.");
  }
  const source = validateSource(artifact.source);
  if (!Array.isArray(artifact.worlds) || artifact.worlds.length === 0 || artifact.worlds.length > 2) {
    fail("artifact.worlds", "1개 이상 2개 이하의 배열이어야 합니다.");
  }
  const seenWorlds = new Set<string>();
  let previousWorld = "";
  for (const [worldIndex, valueAtIndex] of artifact.worlds.entries()) {
    const pathName = `artifact.worlds[${worldIndex}]`;
    const world = recordAt(valueAtIndex, pathName, [
      "world",
      "targetMapAssetSha256",
      "transform",
      "markers"
    ]);
    if (
      typeof world.world !== "string"
      || !(PALWORLD_MAP_WORLDS as readonly string[]).includes(world.world)
    ) {
      fail(`${pathName}.world`, "main 또는 tree여야 합니다.");
    }
    if (seenWorlds.has(world.world)) fail(`${pathName}.world`, "중복 world입니다.");
    if (world.world <= previousWorld) fail(`${pathName}.world`, "world 오름차순이어야 합니다.");
    seenWorlds.add(world.world);
    previousWorld = world.world;
    sha256At(world.targetMapAssetSha256, `${pathName}.targetMapAssetSha256`);
    const transform = validateTransform(world.transform, `${pathName}.transform`);
    if (artifact.activation === "active" && transform.status !== "verified") {
      fail(`${pathName}.transform.status`, "active artifact는 verified 좌표 변환만 사용할 수 있습니다.");
    }
    if (!Array.isArray(world.markers) || world.markers.length === 0 || world.markers.length > 500) {
      fail(`${pathName}.markers`, "1개 이상 500개 이하의 배열이어야 합니다.");
    }
    const ids = new Set<string>();
    const sourceRows = new Set<string>();
    let previousId = "";
    for (const [markerIndex, markerValue] of world.markers.entries()) {
      const marker = validateEntry(markerValue, `${pathName}.markers[${markerIndex}]`);
      if (ids.has(marker.id)) fail(`${pathName}.markers[${markerIndex}].id`, "중복 marker ID입니다.");
      if (sourceRows.has(marker.sourceRowId)) {
        fail(`${pathName}.markers[${markerIndex}].sourceRowId`, "중복 source row ID입니다.");
      }
      if (marker.id <= previousId) {
        fail(`${pathName}.markers[${markerIndex}].id`, "marker ID 오름차순이어야 합니다.");
      }
      ids.add(marker.id);
      sourceRows.add(marker.sourceRowId);
      previousId = marker.id;
    }
  }
  return artifact as unknown as PalworldMapMarkerArtifact;
}

export function createPalworldMapMarkerArtifact(
  value: PalworldMapMarkerArtifact
): PalworldMapMarkerArtifact {
  const sorted = structuredClone(value);
  sorted.worlds.sort((left, right) =>
    left.world < right.world ? -1 : left.world > right.world ? 1 : 0
  );
  for (const world of sorted.worlds) {
    world.markers.sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0
    );
  }
  return assertPalworldMapMarkerArtifact(sorted);
}

export function assertPalworldMapMarkerArtifactManifest(
  value: unknown
): PalworldMapMarkerArtifactManifest {
  const manifest = recordAt(value, "manifest", [
    "schemaVersion",
    "targetGameVersion",
    "artifactFile",
    "artifactSha256"
  ]);
  if (manifest.schemaVersion !== 1) fail("manifest.schemaVersion", "1이어야 합니다.");
  const targetGameVersion = stringAt(
    manifest.targetGameVersion,
    "manifest.targetGameVersion",
    64
  );
  if (!RELEASE_PATTERN.test(targetGameVersion)) {
    fail("manifest.targetGameVersion", "semver 형식이어야 합니다.");
  }
  if (manifest.artifactFile !== PALWORLD_MAP_MARKER_ARTIFACT_FILE) {
    fail("manifest.artifactFile", `${PALWORLD_MAP_MARKER_ARTIFACT_FILE}이어야 합니다.`);
  }
  sha256At(manifest.artifactSha256, "manifest.artifactSha256");
  return manifest as unknown as PalworldMapMarkerArtifactManifest;
}

async function readRegularFile(filePath: string, maximumBytes: number): Promise<Buffer> {
  const stat = await lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximumBytes) {
    fail(filePath, `symlink가 아닌 ${maximumBytes} bytes 이하 regular file이어야 합니다.`);
  }
  const handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const openedStat = await handle.stat();
    if (
      !openedStat.isFile()
      || openedStat.dev !== stat.dev
      || openedStat.ino !== stat.ino
      || openedStat.size !== stat.size
    ) {
      fail(filePath, "검증 중 파일 상태가 변경되었습니다.");
    }
    return await readFile(handle);
  } finally {
    await handle.close();
  }
}

export async function loadPalworldMapMarkerArtifact(
  releaseRoot: string
): Promise<PalworldMapMarkerArtifact> {
  const manifestPath = path.join(releaseRoot, PALWORLD_MAP_MARKER_MANIFEST_FILE);
  const artifactPath = path.join(releaseRoot, PALWORLD_MAP_MARKER_ARTIFACT_FILE);
  const manifest = assertPalworldMapMarkerArtifactManifest(
    JSON.parse((await readRegularFile(manifestPath, MAX_MANIFEST_BYTES)).toString("utf8"))
  );
  const artifactBytes = await readRegularFile(artifactPath, MAX_ARTIFACT_BYTES);
  const artifactChecksum = createHash("sha256").update(artifactBytes).digest("hex");
  if (artifactChecksum !== manifest.artifactSha256) {
    fail("manifest.artifactSha256", "실제 artifact SHA-256과 일치하지 않습니다.");
  }
  const artifact = assertPalworldMapMarkerArtifact(JSON.parse(artifactBytes.toString("utf8")));
  if (artifact.targetGameVersion !== manifest.targetGameVersion) {
    fail("manifest.targetGameVersion", "artifact.targetGameVersion과 일치하지 않습니다.");
  }
  return artifact;
}

function palReference(pal: PalworldPalDetail) {
  return {
    id: pal.id,
    number: pal.number,
    nameKo: pal.nameKo,
    nameJa: pal.nameJa,
    nameEn: pal.nameEn,
    ...(pal.imageUrl === undefined ? {} : { imageUrl: pal.imageUrl }),
    ...(pal.imageWidth === undefined ? {} : { imageWidth: pal.imageWidth }),
    ...(pal.imageHeight === undefined ? {} : { imageHeight: pal.imageHeight }),
    elements: [...pal.elements],
    ...(pal.translation?.name === undefined
      ? {}
      : { translation: { name: { ...pal.translation.name } } })
  };
}

export function createPalworldMapMarkerProvider(input: {
  artifact: PalworldMapMarkerArtifact;
  palworldDataService: Pick<PalworldDataService, "getPal" | "sourceInternalIdForPal">;
}): PalworldMapMarkerProvider {
  const artifact = assertPalworldMapMarkerArtifact(input.artifact);
  if (artifact.activation !== "active") {
    fail("artifact.activation", "명시적으로 active인 artifact만 공개 API에 주입할 수 있습니다.");
  }
  const responses = new Map<PalworldMapWorld, Omit<PalworldMapMarkersResponse, "metadata">>();
  for (const world of artifact.worlds) {
    const markers = world.markers.map((entry) => {
      const pal = input.palworldDataService.getPal(entry.palId);
      const activeSourceInternalId = input.palworldDataService.sourceInternalIdForPal(entry.palId);
      if (activeSourceInternalId !== entry.sourceInternalId) {
        fail(
          `artifact.worlds.${world.world}.markers.${entry.id}.sourceInternalId`,
          "활성 Pal sourceInternalId와 일치하지 않습니다."
        );
      }
      return {
        id: entry.id,
        sourceRowId: entry.sourceRowId,
        sourceInternalId: entry.sourceInternalId,
        pal: palReference(pal),
        level: entry.level,
        normalizedX: entry.normalizedX,
        normalizedY: entry.normalizedY
      };
    });
    responses.set(world.world, {
      state: "ready",
      world: world.world,
      markers,
      overlay: {
        schemaVersion: 1,
        technicalStatus: "ready",
        ...artifact.source,
        targetMapAssetSha256: world.targetMapAssetSha256,
        targetGameVersion: artifact.targetGameVersion,
        compatibilityBasis: "exact_map_geometry_and_coordinate_transform",
        transformRevision: world.transform.revision
      }
    });
  }
  return {
    response(world, metadata) {
      const response = responses.get(world);
      if (!response) {
        return assertPalworldMapMarkersResponse({
          state: "data_unavailable",
          world,
          markers: [],
          metadata
        });
      }
      return assertPalworldMapMarkersResponse({
        ...response,
        metadata
      });
    }
  };
}

export async function loadPalworldMapMarkerProvider(input: {
  releaseRoot: string;
  dashboardStaticRoot?: string;
  palworldDataService: Pick<PalworldDataService, "getPal" | "sourceInternalIdForPal">;
}): Promise<PalworldMapMarkerProvider> {
  const artifact = await loadPalworldMapMarkerArtifact(input.releaseRoot);
  if (input.dashboardStaticRoot !== undefined) {
    for (const world of artifact.worlds) {
      const assetPath = path.join(
        input.dashboardStaticRoot,
        "images",
        "palworld",
        artifact.targetGameVersion,
        "maps",
        `${world.targetMapAssetSha256}.webp`
      );
      const bytes = await readRegularFile(assetPath, MAX_MAP_ASSET_BYTES);
      const checksum = createHash("sha256").update(bytes).digest("hex");
      if (
        checksum !== world.targetMapAssetSha256
        || bytes.length < 12
        || bytes.subarray(0, 4).toString("ascii") !== "RIFF"
        || bytes.subarray(8, 12).toString("ascii") !== "WEBP"
      ) {
        fail(
          `artifact.worlds.${world.world}.targetMapAssetSha256`,
          "Dashboard에 게시된 정적 WebP 지도와 일치하지 않습니다."
        );
      }
    }
  }
  return createPalworldMapMarkerProvider({
    artifact,
    palworldDataService: input.palworldDataService
  });
}
