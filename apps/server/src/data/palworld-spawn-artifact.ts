import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertPalworldPalSpawnResponse,
  PALWORLD_MAP_WORLDS,
  PALWORLD_PAL_SPAWN_GRID_SIZE,
  type PalworldDataMetadata,
  type PalworldMapWorld,
  type PalworldPalSpawnPoint,
  type PalworldPalSpawnResponse
} from "@streamops/shared";
import type { PalworldDataService } from "../services/palworld-data.js";
import type { PalworldMapCoordinateTransform } from "./palworld-map-marker-artifact.js";

export const PALWORLD_SPAWN_ARTIFACT_FILE = "map-spawns.json";
export const PALWORLD_SPAWN_MANIFEST_FILE = "map-spawns-manifest.json";

const MAX_ARTIFACT_BYTES = 32 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_MAP_ASSET_BYTES = 16 * 1024 * 1024;
const MAX_PALS = 500;
const MAX_POINTS_PER_PAL = PALWORLD_PAL_SPAWN_GRID_SIZE ** 2;
const MAX_PLACEMENTS = 100_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/u;
const SAFE_SOURCE_ID_PATTERN = /^[A-Za-z0-9_]{1,160}$/u;
const RELEASE_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const SOURCE_MEMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/u;

export type PalworldSpawnArtifactSource = {
  sourceType: "operator_pak_export";
  archiveSha256: string;
  placementTableMember: string;
  placementTableSha256: string;
  wildSpawnerTableMember: string;
  wildSpawnerTableSha256: string;
  palTableMember: string;
  palTableSha256: string;
  sourceGameVersion: string | null;
  sourceSteamBuildId: string | null;
  compatibilityBasis: "exact_active_paldex_join_and_map_geometry";
  rightsVerified: false;
  usageBasis: "operator_reference_use";
};

export type PalworldSpawnArtifactPal = {
  palId: string;
  sourceInternalId: string;
  totalPlacements: number;
  points: PalworldPalSpawnPoint[];
};

export type PalworldSpawnArtifactWorld = {
  world: PalworldMapWorld;
  targetMapAssetSha256: string;
  transform: PalworldMapCoordinateTransform;
  pals: PalworldSpawnArtifactPal[];
};

export type PalworldSpawnArtifact = {
  schemaVersion: 1;
  targetGameVersion: string;
  activation: "candidate" | "active";
  source: PalworldSpawnArtifactSource;
  gridSize: typeof PALWORLD_PAL_SPAWN_GRID_SIZE;
  worlds: PalworldSpawnArtifactWorld[];
};

export type PalworldSpawnArtifactManifest = {
  schemaVersion: 1;
  targetGameVersion: string;
  artifactFile: typeof PALWORLD_SPAWN_ARTIFACT_FILE;
  artifactSha256: string;
};

export type PalworldSpawnProvider = {
  response(
    world: PalworldMapWorld,
    palId: string,
    metadata: PalworldDataMetadata
  ): PalworldPalSpawnResponse;
};

export class PalworldSpawnArtifactError extends Error {
  readonly code = "PALWORLD_SPAWN_ARTIFACT_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PalworldSpawnArtifactError";
  }
}

function fail(pathName: string, message: string): never {
  throw new PalworldSpawnArtifactError(`${pathName}: ${message}`);
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
  if (!SHA256_PATTERN.test(checksum)) {
    fail(pathName, "소문자 64자리 SHA-256 hex여야 합니다.");
  }
  return checksum;
}

function integerAt(value: unknown, pathName: string, minimum: number, maximum: number): number {
  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || value < minimum
    || value > maximum
  ) {
    fail(pathName, `${minimum} 이상 ${maximum} 이하의 정수여야 합니다.`);
  }
  return value;
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

function booleanAt(value: unknown, pathName: string): boolean {
  if (typeof value !== "boolean") fail(pathName, "boolean이어야 합니다.");
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

function validateSource(value: unknown): PalworldSpawnArtifactSource {
  const source = recordAt(value, "artifact.source", [
    "sourceType",
    "archiveSha256",
    "placementTableMember",
    "placementTableSha256",
    "wildSpawnerTableMember",
    "wildSpawnerTableSha256",
    "palTableMember",
    "palTableSha256",
    "sourceGameVersion",
    "sourceSteamBuildId",
    "compatibilityBasis",
    "rightsVerified",
    "usageBasis"
  ]);
  if (source.sourceType !== "operator_pak_export") {
    fail("artifact.source.sourceType", "operator_pak_export여야 합니다.");
  }
  sha256At(source.archiveSha256, "artifact.source.archiveSha256");
  for (const field of [
    "placementTableMember",
    "wildSpawnerTableMember",
    "palTableMember"
  ] as const) {
    sourceMemberAt(source[field], `artifact.source.${field}`);
  }
  for (const field of [
    "placementTableSha256",
    "wildSpawnerTableSha256",
    "palTableSha256"
  ] as const) {
    sha256At(source[field], `artifact.source.${field}`);
  }
  for (const field of ["sourceGameVersion", "sourceSteamBuildId"] as const) {
    if (source[field] !== null) {
      stringAt(source[field], `artifact.source.${field}`, 128);
    }
  }
  if (source.compatibilityBasis !== "exact_active_paldex_join_and_map_geometry") {
    fail(
      "artifact.source.compatibilityBasis",
      "활성 도감 exact join과 검증된 지도 geometry 근거여야 합니다."
    );
  }
  if (source.rightsVerified !== false) {
    fail("artifact.source.rightsVerified", "독립적으로 확인되지 않은 권리를 true로 표시할 수 없습니다.");
  }
  if (source.usageBasis !== "operator_reference_use") {
    fail("artifact.source.usageBasis", "operator_reference_use여야 합니다.");
  }
  return source as PalworldSpawnArtifactSource;
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

function validatePoint(value: unknown, pathName: string): PalworldPalSpawnPoint {
  const point = recordAt(value, pathName, [
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
  const id = stringAt(point.id, `${pathName}.id`, 80);
  if (!SAFE_ID_PATTERN.test(id)) {
    fail(`${pathName}.id`, "안전한 소문자 canonical ID여야 합니다.");
  }
  const cellX = integerAt(
    point.cellX,
    `${pathName}.cellX`,
    0,
    PALWORLD_PAL_SPAWN_GRID_SIZE - 1
  );
  const cellY = integerAt(
    point.cellY,
    `${pathName}.cellY`,
    0,
    PALWORLD_PAL_SPAWN_GRID_SIZE - 1
  );
  const normalizedX = finiteAt(point.normalizedX, `${pathName}.normalizedX`, 0, 1);
  const normalizedY = finiteAt(point.normalizedY, `${pathName}.normalizedY`, 0, 1);
  if (
    cellX !== Math.min(
      PALWORLD_PAL_SPAWN_GRID_SIZE - 1,
      Math.floor(normalizedX * PALWORLD_PAL_SPAWN_GRID_SIZE)
    )
    || cellY !== Math.min(
      PALWORLD_PAL_SPAWN_GRID_SIZE - 1,
      Math.floor(normalizedY * PALWORLD_PAL_SPAWN_GRID_SIZE)
    )
  ) {
    fail(pathName, "정규화 좌표와 grid cell이 일치해야 합니다.");
  }
  integerAt(point.placementCount, `${pathName}.placementCount`, 1, MAX_PLACEMENTS);
  const minimumLevel = integerAt(point.minimumLevel, `${pathName}.minimumLevel`, 1, 100);
  const maximumLevel = integerAt(point.maximumLevel, `${pathName}.maximumLevel`, 1, 100);
  if (minimumLevel > maximumLevel) {
    fail(`${pathName}.maximumLevel`, "minimumLevel 이상이어야 합니다.");
  }
  const daytime = booleanAt(point.daytime, `${pathName}.daytime`);
  const nighttime = booleanAt(point.nighttime, `${pathName}.nighttime`);
  if (!daytime && !nighttime) {
    fail(pathName, "daytime 또는 nighttime 중 하나 이상이 true여야 합니다.");
  }
  return point as unknown as PalworldPalSpawnPoint;
}

function validatePal(
  value: unknown,
  pathName: string
): PalworldSpawnArtifactPal {
  const pal = recordAt(value, pathName, [
    "palId",
    "sourceInternalId",
    "totalPlacements",
    "points"
  ]);
  const palId = stringAt(pal.palId, `${pathName}.palId`, 80);
  if (!SAFE_ID_PATTERN.test(palId)) {
    fail(`${pathName}.palId`, "안전한 소문자 canonical Pal ID여야 합니다.");
  }
  const sourceInternalId = stringAt(pal.sourceInternalId, `${pathName}.sourceInternalId`, 160);
  if (!SAFE_SOURCE_ID_PATTERN.test(sourceInternalId)) {
    fail(`${pathName}.sourceInternalId`, "안전한 source internal ID여야 합니다.");
  }
  const totalPlacements = integerAt(
    pal.totalPlacements,
    `${pathName}.totalPlacements`,
    1,
    MAX_PLACEMENTS
  );
  if (
    !Array.isArray(pal.points)
    || pal.points.length === 0
    || pal.points.length > MAX_POINTS_PER_PAL
  ) {
    fail(
      `${pathName}.points`,
      `1개 이상 ${MAX_POINTS_PER_PAL}개 이하의 배열이어야 합니다.`
    );
  }
  const ids = new Set<string>();
  const cells = new Set<string>();
  let previousId = "";
  let placementSum = 0;
  for (const [index, pointValue] of pal.points.entries()) {
    const point = validatePoint(pointValue, `${pathName}.points[${index}]`);
    const cell = `${point.cellX}:${point.cellY}`;
    if (ids.has(point.id)) fail(`${pathName}.points[${index}].id`, "중복 point ID입니다.");
    if (cells.has(cell)) fail(`${pathName}.points[${index}]`, "같은 grid cell이 중복됐습니다.");
    if (point.id <= previousId) {
      fail(`${pathName}.points[${index}].id`, "point ID 오름차순이어야 합니다.");
    }
    ids.add(point.id);
    cells.add(cell);
    previousId = point.id;
    placementSum += point.placementCount;
  }
  if (placementSum !== totalPlacements) {
    fail(`${pathName}.totalPlacements`, "point placementCount 합계와 일치해야 합니다.");
  }
  return pal as unknown as PalworldSpawnArtifactPal;
}

export function assertPalworldSpawnArtifact(value: unknown): PalworldSpawnArtifact {
  const artifact = recordAt(value, "artifact", [
    "schemaVersion",
    "targetGameVersion",
    "activation",
    "source",
    "gridSize",
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
  if (artifact.activation === "active") {
    if (
      source.sourceGameVersion === null
      || source.sourceSteamBuildId === null
    ) {
      fail(
        "artifact.source",
        "active artifact에는 검증된 source gameVersion과 Steam build ID가 필요합니다."
      );
    }
    if (source.sourceGameVersion !== targetGameVersion) {
      fail(
        "artifact.source.sourceGameVersion",
        "active artifact의 targetGameVersion과 일치해야 합니다."
      );
    }
  }
  if (artifact.gridSize !== PALWORLD_PAL_SPAWN_GRID_SIZE) {
    fail("artifact.gridSize", `${PALWORLD_PAL_SPAWN_GRID_SIZE}이어야 합니다.`);
  }
  if (!Array.isArray(artifact.worlds) || artifact.worlds.length === 0 || artifact.worlds.length > 2) {
    fail("artifact.worlds", "1개 이상 2개 이하의 배열이어야 합니다.");
  }
  const worlds = new Set<string>();
  let previousWorld = "";
  for (const [worldIndex, worldValue] of artifact.worlds.entries()) {
    const pathName = `artifact.worlds[${worldIndex}]`;
    const world = recordAt(worldValue, pathName, [
      "world",
      "targetMapAssetSha256",
      "transform",
      "pals"
    ]);
    if (
      typeof world.world !== "string"
      || !(PALWORLD_MAP_WORLDS as readonly string[]).includes(world.world)
    ) {
      fail(`${pathName}.world`, "main 또는 tree여야 합니다.");
    }
    if (worlds.has(world.world)) fail(`${pathName}.world`, "중복 world입니다.");
    if (world.world <= previousWorld) fail(`${pathName}.world`, "world 오름차순이어야 합니다.");
    worlds.add(world.world);
    previousWorld = world.world;
    sha256At(world.targetMapAssetSha256, `${pathName}.targetMapAssetSha256`);
    const transform = validateTransform(world.transform, `${pathName}.transform`);
    if (artifact.activation === "active" && transform.status !== "verified") {
      fail(`${pathName}.transform.status`, "active artifact는 verified 좌표 변환만 사용할 수 있습니다.");
    }
    if (!Array.isArray(world.pals) || world.pals.length === 0 || world.pals.length > MAX_PALS) {
      fail(`${pathName}.pals`, `1개 이상 ${MAX_PALS}개 이하의 배열이어야 합니다.`);
    }
    const palIds = new Set<string>();
    const sourceInternalIds = new Set<string>();
    let previousPalId = "";
    for (const [palIndex, palValue] of world.pals.entries()) {
      const pal = validatePal(palValue, `${pathName}.pals[${palIndex}]`);
      if (palIds.has(pal.palId)) {
        fail(`${pathName}.pals[${palIndex}].palId`, "중복 Pal ID입니다.");
      }
      if (sourceInternalIds.has(pal.sourceInternalId)) {
        fail(`${pathName}.pals[${palIndex}].sourceInternalId`, "중복 source internal ID입니다.");
      }
      if (pal.palId <= previousPalId) {
        fail(`${pathName}.pals[${palIndex}].palId`, "Pal ID 오름차순이어야 합니다.");
      }
      palIds.add(pal.palId);
      sourceInternalIds.add(pal.sourceInternalId);
      previousPalId = pal.palId;
    }
  }
  return artifact as unknown as PalworldSpawnArtifact;
}

export function createPalworldSpawnArtifact(value: PalworldSpawnArtifact): PalworldSpawnArtifact {
  const sorted = structuredClone(value);
  sorted.worlds.sort((left, right) =>
    left.world < right.world ? -1 : left.world > right.world ? 1 : 0
  );
  for (const world of sorted.worlds) {
    world.pals.sort((left, right) =>
      left.palId < right.palId ? -1 : left.palId > right.palId ? 1 : 0
    );
    for (const pal of world.pals) {
      pal.points.sort((left, right) =>
        left.id < right.id ? -1 : left.id > right.id ? 1 : 0
      );
    }
  }
  return assertPalworldSpawnArtifact(sorted);
}

export function assertPalworldSpawnArtifactManifest(
  value: unknown
): PalworldSpawnArtifactManifest {
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
  if (manifest.artifactFile !== PALWORLD_SPAWN_ARTIFACT_FILE) {
    fail("manifest.artifactFile", `${PALWORLD_SPAWN_ARTIFACT_FILE}이어야 합니다.`);
  }
  sha256At(manifest.artifactSha256, "manifest.artifactSha256");
  return manifest as unknown as PalworldSpawnArtifactManifest;
}

async function readRegularFile(filePath: string, maximumBytes: number): Promise<Buffer> {
  const stat = await lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > maximumBytes) {
    fail(filePath, `symlink가 아닌 1~${maximumBytes} bytes regular file이어야 합니다.`);
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

export async function loadPalworldSpawnArtifact(
  releaseRoot: string
): Promise<PalworldSpawnArtifact> {
  const manifest = assertPalworldSpawnArtifactManifest(
    JSON.parse(
      (
        await readRegularFile(
          path.join(releaseRoot, PALWORLD_SPAWN_MANIFEST_FILE),
          MAX_MANIFEST_BYTES
        )
      ).toString("utf8")
    )
  );
  const artifactBytes = await readRegularFile(
    path.join(releaseRoot, PALWORLD_SPAWN_ARTIFACT_FILE),
    MAX_ARTIFACT_BYTES
  );
  const artifactSha256 = createHash("sha256").update(artifactBytes).digest("hex");
  if (artifactSha256 !== manifest.artifactSha256) {
    fail("manifest.artifactSha256", "실제 artifact SHA-256과 일치하지 않습니다.");
  }
  const artifact = assertPalworldSpawnArtifact(JSON.parse(artifactBytes.toString("utf8")));
  if (artifact.targetGameVersion !== manifest.targetGameVersion) {
    fail("manifest.targetGameVersion", "artifact.targetGameVersion과 일치하지 않습니다.");
  }
  return artifact;
}

export function createPalworldSpawnProvider(input: {
  artifact: PalworldSpawnArtifact;
  palworldDataService: Pick<PalworldDataService, "getPal" | "sourceInternalIdForPal">;
}): PalworldSpawnProvider {
  const artifact = assertPalworldSpawnArtifact(input.artifact);
  if (artifact.activation !== "active") {
    fail("artifact.activation", "명시적으로 active인 artifact만 공개 API에 주입할 수 있습니다.");
  }
  const source = artifact.source;
  const worlds = new Map<
    PalworldMapWorld,
    {
      overlay: NonNullable<PalworldPalSpawnResponse["overlay"]>;
      pals: Map<string, PalworldSpawnArtifactPal>;
    }
  >();
  for (const world of artifact.worlds) {
    const pals = new Map<string, PalworldSpawnArtifactPal>();
    for (const entry of world.pals) {
      const pal = input.palworldDataService.getPal(entry.palId);
      if (pal.id !== entry.palId) {
        fail(
          `artifact.worlds.${world.world}.pals.${entry.palId}.palId`,
          "활성 Pal canonical ID와 일치하지 않습니다."
        );
      }
      const activeSourceInternalId = input.palworldDataService.sourceInternalIdForPal(entry.palId);
      if (activeSourceInternalId !== entry.sourceInternalId) {
        fail(
          `artifact.worlds.${world.world}.pals.${entry.palId}.sourceInternalId`,
          "활성 Pal sourceInternalId와 일치하지 않습니다."
        );
      }
      pals.set(entry.palId, entry);
    }
    worlds.set(world.world, {
      pals,
      overlay: {
        schemaVersion: 1,
        technicalStatus: "ready",
        sourceType: source.sourceType,
        archiveSha256: source.archiveSha256,
        sourceMember: source.placementTableMember,
        sourceMemberSha256: source.placementTableSha256,
        targetMapAssetSha256: world.targetMapAssetSha256,
        sourceGameVersion: source.sourceGameVersion,
        sourceSteamBuildId: source.sourceSteamBuildId,
        targetGameVersion: artifact.targetGameVersion,
        compatibilityBasis: source.compatibilityBasis,
        transformRevision: world.transform.revision,
        rightsVerified: source.rightsVerified,
        usageBasis: source.usageBasis
      }
    });
  }
  return {
    response(world, requestedPalId, metadata) {
      const pal = input.palworldDataService.getPal(requestedPalId);
      const canonicalPalId = pal.id;
      const worldEntry = worlds.get(world);
      if (!worldEntry) {
        return assertPalworldPalSpawnResponse({
          state: "data_unavailable",
          world,
          palId: canonicalPalId,
          gridSize: PALWORLD_PAL_SPAWN_GRID_SIZE,
          totalPlacements: 0,
          points: [],
          metadata
        });
      }
      const entry = worldEntry.pals.get(canonicalPalId);
      if (!entry) {
        return assertPalworldPalSpawnResponse({
          state: "confirmed_empty",
          world,
          palId: canonicalPalId,
          gridSize: PALWORLD_PAL_SPAWN_GRID_SIZE,
          totalPlacements: 0,
          points: [],
          metadata,
          overlay: worldEntry.overlay
        });
      }
      return assertPalworldPalSpawnResponse({
        state: "ready",
        world,
        palId: canonicalPalId,
        gridSize: PALWORLD_PAL_SPAWN_GRID_SIZE,
        totalPlacements: entry.totalPlacements,
        points: entry.points.map((point) => ({ ...point })),
        metadata,
        overlay: worldEntry.overlay
      });
    }
  };
}

export async function loadPalworldSpawnProvider(input: {
  releaseRoot: string;
  dashboardStaticRoot?: string;
  palworldDataService: Pick<PalworldDataService, "getPal" | "sourceInternalIdForPal">;
}): Promise<PalworldSpawnProvider> {
  const artifact = await loadPalworldSpawnArtifact(input.releaseRoot);
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
  return createPalworldSpawnProvider({
    artifact,
    palworldDataService: input.palworldDataService
  });
}
