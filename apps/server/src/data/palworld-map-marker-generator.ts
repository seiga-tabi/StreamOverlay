import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { assertPalworldPaldexArtifact, type PalworldPaldexArtifact } from "./palworld-paldex-artifact.js";
import {
  createPalworldMapMarkerArtifact,
  type PalworldMapCoordinateTransform,
  type PalworldMapMarkerArtifact
} from "./palworld-map-marker-artifact.js";
import {
  withPalworldPakArchive,
  type PalworldPakArchiveReader
} from "./palworld-pak-preflight.js";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_MEMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/u;
const SAFE_SOURCE_ID_PATTERN = /^[A-Za-z0-9_]+$/u;
const SAFE_PUBLIC_ASSET_PATTERN =
  /^\/images\/palworld\/([0-9]+\.[0-9]+\.[0-9]+)\/maps\/([a-f0-9]{64})\.webp$/u;

type JsonRecord = Record<string, unknown>;

type SourceFileLock = {
  member: string;
  sha256: string;
};

type SourceBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type MapMarkerAlias = {
  sourceCharacterId: string;
  sourceInternalId: string;
  reason: string;
  reviewStatus: "approved";
};

export type PalworldMapMarkerMapping = {
  schemaVersion: 1;
  targetGameVersion: string;
  sourceArchiveSha256: string;
  bossTable: SourceFileLock;
  worldMapTable: SourceFileLock;
  sourceMapAsset: SourceFileLock;
  targetMapAsset: {
    imageUrl: string;
    sha256: string;
    width: number;
    height: number;
  };
  verification: {
    status: "source_bounds_and_biome_anchors_reviewed";
    revision: string;
    coordinateCrossCheckRows: number;
    maximumPixelError: number;
  };
  expectedCounts: {
    sourceRows: number;
    nonPalRows: number;
    mainMarkers: number;
    treeMarkers: number;
  };
  world: {
    id: "main";
    sourceRowId: "MainMap";
    horizontalAxis: "world_y";
    verticalAxis: "world_x";
    invertHorizontal: false;
    invertVertical: true;
    sourceBounds: SourceBounds;
  };
  treeBounds: SourceBounds;
  aliases: MapMarkerAlias[];
};

export type PalworldMapMarkerGenerationResult = {
  artifact: PalworldMapMarkerArtifact;
  counts: {
    sourceRows: number;
    nonPalRows: number;
    mainMarkers: number;
    treeMarkers: number;
  };
};

function fail(pathName: string, message: string): never {
  throw new TypeError(`${pathName}: ${message}`);
}

function objectAt(value: unknown, pathName: string, keys: readonly string[]): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(pathName, "객체여야 합니다.");
  }
  const record = value as JsonRecord;
  const allowed = new Set(keys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${pathName}.${key}`, "허용되지 않은 필드입니다.");
  }
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) fail(`${pathName}.${key}`, "필수 필드가 없습니다.");
  }
  return record;
}

function textAt(value: unknown, pathName: string, maximum = 512): string {
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
  const checksum = textAt(value, pathName, 64);
  if (!SHA256_PATTERN.test(checksum)) fail(pathName, "소문자 64자리 SHA-256 hex여야 합니다.");
  return checksum;
}

function integerAt(value: unknown, pathName: string, minimum: number, maximum: number): number {
  if (
    typeof value !== "number"
    || !Number.isInteger(value)
    || value < minimum
    || value > maximum
  ) {
    fail(pathName, `${minimum} 이상 ${maximum} 이하 정수여야 합니다.`);
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
    fail(pathName, `${minimum} 이상 ${maximum} 이하 유한한 숫자여야 합니다.`);
  }
  return value;
}

function sourceFileAt(value: unknown, pathName: string): SourceFileLock {
  const record = objectAt(value, pathName, ["member", "sha256"]);
  const member = textAt(record.member, `${pathName}.member`);
  if (
    !SAFE_MEMBER_PATTERN.test(member)
    || member.startsWith("/")
    || member.includes("\\")
    || member.includes("%")
    || member.includes("//")
    || member.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    fail(`${pathName}.member`, "안전한 ZIP 상대 경로여야 합니다.");
  }
  return {
    member,
    sha256: sha256At(record.sha256, `${pathName}.sha256`)
  };
}

function boundsAt(value: unknown, pathName: string): SourceBounds {
  const record = objectAt(value, pathName, ["minX", "maxX", "minY", "maxY"]);
  const bounds = {
    minX: finiteAt(record.minX, `${pathName}.minX`, -100_000_000, 100_000_000),
    maxX: finiteAt(record.maxX, `${pathName}.maxX`, -100_000_000, 100_000_000),
    minY: finiteAt(record.minY, `${pathName}.minY`, -100_000_000, 100_000_000),
    maxY: finiteAt(record.maxY, `${pathName}.maxY`, -100_000_000, 100_000_000)
  };
  if (bounds.minX >= bounds.maxX || bounds.minY >= bounds.maxY) {
    fail(pathName, "최솟값은 최댓값보다 작아야 합니다.");
  }
  return bounds;
}

export function assertPalworldMapMarkerMapping(value: unknown): PalworldMapMarkerMapping {
  const root = objectAt(value, "mapping", [
    "schemaVersion",
    "targetGameVersion",
    "sourceArchiveSha256",
    "bossTable",
    "worldMapTable",
    "sourceMapAsset",
    "targetMapAsset",
    "verification",
    "expectedCounts",
    "world",
    "treeBounds",
    "aliases"
  ]);
  if (root.schemaVersion !== 1) fail("mapping.schemaVersion", "1이어야 합니다.");
  const targetGameVersion = textAt(root.targetGameVersion, "mapping.targetGameVersion", 64);
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(targetGameVersion)) {
    fail("mapping.targetGameVersion", "semver 형식이어야 합니다.");
  }
  const targetMapAsset = objectAt(root.targetMapAsset, "mapping.targetMapAsset", [
    "imageUrl",
    "sha256",
    "width",
    "height"
  ]);
  const imageUrl = textAt(targetMapAsset.imageUrl, "mapping.targetMapAsset.imageUrl");
  const imageMatch = imageUrl.match(SAFE_PUBLIC_ASSET_PATTERN);
  const targetMapSha256 = sha256At(targetMapAsset.sha256, "mapping.targetMapAsset.sha256");
  if (!imageMatch || imageMatch[1] !== targetGameVersion || imageMatch[2] !== targetMapSha256) {
    fail(
      "mapping.targetMapAsset.imageUrl",
      "target release와 content hash가 일치하는 로컬 Palworld map URL이어야 합니다."
    );
  }
  const verification = objectAt(root.verification, "mapping.verification", [
    "status",
    "revision",
    "coordinateCrossCheckRows",
    "maximumPixelError"
  ]);
  if (verification.status !== "source_bounds_and_biome_anchors_reviewed") {
    fail(
      "mapping.verification.status",
      "source_bounds_and_biome_anchors_reviewed여야 합니다."
    );
  }
  const expectedCounts = objectAt(root.expectedCounts, "mapping.expectedCounts", [
    "sourceRows",
    "nonPalRows",
    "mainMarkers",
    "treeMarkers"
  ]);
  const world = objectAt(root.world, "mapping.world", [
    "id",
    "sourceRowId",
    "horizontalAxis",
    "verticalAxis",
    "invertHorizontal",
    "invertVertical",
    "sourceBounds"
  ]);
  if (
    world.id !== "main"
    || world.sourceRowId !== "MainMap"
    || world.horizontalAxis !== "world_y"
    || world.verticalAxis !== "world_x"
    || world.invertHorizontal !== false
    || world.invertVertical !== true
  ) {
    fail("mapping.world", "검증된 MainMap 축·반전 계약과 일치해야 합니다.");
  }
  if (!Array.isArray(root.aliases) || root.aliases.length > 50) {
    fail("mapping.aliases", "50개 이하 배열이어야 합니다.");
  }
  const aliases = root.aliases.map((valueAtIndex, index) => {
    const alias = objectAt(valueAtIndex, `mapping.aliases[${index}]`, [
      "sourceCharacterId",
      "sourceInternalId",
      "reason",
      "reviewStatus"
    ]);
    const sourceCharacterId = textAt(
      alias.sourceCharacterId,
      `mapping.aliases[${index}].sourceCharacterId`,
      160
    );
    const sourceInternalId = textAt(
      alias.sourceInternalId,
      `mapping.aliases[${index}].sourceInternalId`,
      160
    );
    if (
      !SAFE_SOURCE_ID_PATTERN.test(sourceCharacterId)
      || !SAFE_SOURCE_ID_PATTERN.test(sourceInternalId)
      || alias.reviewStatus !== "approved"
    ) {
      fail(`mapping.aliases[${index}]`, "검수된 exact internal ID alias여야 합니다.");
    }
    return {
      sourceCharacterId,
      sourceInternalId,
      reason: textAt(alias.reason, `mapping.aliases[${index}].reason`, 256),
      reviewStatus: "approved" as const
    };
  });
  if (
    new Set(aliases.map((alias) => alias.sourceCharacterId)).size !== aliases.length
  ) {
    fail("mapping.aliases", "sourceCharacterId가 중복됐습니다.");
  }
  return {
    schemaVersion: 1,
    targetGameVersion,
    sourceArchiveSha256: sha256At(
      root.sourceArchiveSha256,
      "mapping.sourceArchiveSha256"
    ),
    bossTable: sourceFileAt(root.bossTable, "mapping.bossTable"),
    worldMapTable: sourceFileAt(root.worldMapTable, "mapping.worldMapTable"),
    sourceMapAsset: sourceFileAt(root.sourceMapAsset, "mapping.sourceMapAsset"),
    targetMapAsset: {
      imageUrl,
      sha256: targetMapSha256,
      width: integerAt(targetMapAsset.width, "mapping.targetMapAsset.width", 1, 16_384),
      height: integerAt(targetMapAsset.height, "mapping.targetMapAsset.height", 1, 16_384)
    },
    verification: {
      status: "source_bounds_and_biome_anchors_reviewed",
      revision: textAt(verification.revision, "mapping.verification.revision", 128),
      coordinateCrossCheckRows: integerAt(
        verification.coordinateCrossCheckRows,
        "mapping.verification.coordinateCrossCheckRows",
        1,
        100_000
      ),
      maximumPixelError: finiteAt(
        verification.maximumPixelError,
        "mapping.verification.maximumPixelError",
        0,
        1
      )
    },
    expectedCounts: {
      sourceRows: integerAt(expectedCounts.sourceRows, "mapping.expectedCounts.sourceRows", 1, 10_000),
      nonPalRows: integerAt(expectedCounts.nonPalRows, "mapping.expectedCounts.nonPalRows", 0, 10_000),
      mainMarkers: integerAt(expectedCounts.mainMarkers, "mapping.expectedCounts.mainMarkers", 1, 500),
      treeMarkers: integerAt(expectedCounts.treeMarkers, "mapping.expectedCounts.treeMarkers", 0, 500)
    },
    world: {
      id: "main",
      sourceRowId: "MainMap",
      horizontalAxis: "world_y",
      verticalAxis: "world_x",
      invertHorizontal: false,
      invertVertical: true,
      sourceBounds: boundsAt(world.sourceBounds, "mapping.world.sourceBounds")
    },
    treeBounds: boundsAt(root.treeBounds, "mapping.treeBounds"),
    aliases
  };
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function lockedMemberBytes(
  reader: PalworldPakArchiveReader,
  source: SourceFileLock
): Promise<Buffer> {
  const bytes = await reader.readBytes(source.member);
  if (sha256Bytes(bytes) !== source.sha256) {
    fail(source.member, "mapping에 고정된 SHA-256과 일치하지 않습니다.");
  }
  return bytes;
}

function positionAt(value: unknown, pathName: string): { x: number; y: number } {
  const record = objectAt(value, pathName, ["X", "Y", "Z"]);
  return {
    x: finiteAt(record.X, `${pathName}.X`, -100_000_000, 100_000_000),
    y: finiteAt(record.Y, `${pathName}.Y`, -100_000_000, 100_000_000)
  };
}

function inside(position: { x: number; y: number }, bounds: SourceBounds): boolean {
  return position.x >= bounds.minX
    && position.x <= bounds.maxX
    && position.y >= bounds.minY
    && position.y <= bounds.maxY;
}

function roundedCoordinate(value: number): number {
  return Number(value.toFixed(9));
}

export function normalizedPalworldMainMapCoordinate(
  position: { x: number; y: number },
  bounds: SourceBounds
): { normalizedX: number; normalizedY: number } {
  if (!inside(position, bounds)) {
    fail("coordinate", "MainMap source bounds 밖의 좌표입니다.");
  }
  return {
    normalizedX: roundedCoordinate((position.y - bounds.minY) / (bounds.maxY - bounds.minY)),
    normalizedY: roundedCoordinate((bounds.maxX - position.x) / (bounds.maxX - bounds.minX))
  };
}

function assertWorldMapBounds(
  rows: JsonRecord,
  mapping: PalworldMapMarkerMapping
): void {
  const mainMap = objectAt(rows[mapping.world.sourceRowId], "worldMap.Rows.MainMap", [
    "minMapTextureBlockSize",
    "mapBlockNum",
    "MaskTextureSize",
    "landScapeRealPositionMin",
    "landScapeRealPositionMax",
    "textureDataMap",
    "DefaultMaskTexture",
    "AlternativeTrackingLocationId",
    "WorldMapPriority"
  ]);
  const minimum = positionAt(
    mainMap.landScapeRealPositionMin,
    "worldMap.Rows.MainMap.landScapeRealPositionMin"
  );
  const maximum = positionAt(
    mainMap.landScapeRealPositionMax,
    "worldMap.Rows.MainMap.landScapeRealPositionMax"
  );
  const expected = mapping.world.sourceBounds;
  if (
    minimum.x !== expected.minX
    || maximum.x !== expected.maxX
    || minimum.y !== expected.minY
    || maximum.y !== expected.maxY
  ) {
    fail("mapping.world.sourceBounds", "FModel WorldMap DataTable 경계와 일치하지 않습니다.");
  }
  const tree = objectAt(rows.Tree, "worldMap.Rows.Tree", [
    "minMapTextureBlockSize",
    "mapBlockNum",
    "MaskTextureSize",
    "landScapeRealPositionMin",
    "landScapeRealPositionMax",
    "textureDataMap",
    "DefaultMaskTexture",
    "AlternativeTrackingLocationId",
    "WorldMapPriority"
  ]);
  const treeMinimum = positionAt(
    tree.landScapeRealPositionMin,
    "worldMap.Rows.Tree.landScapeRealPositionMin"
  );
  const treeMaximum = positionAt(
    tree.landScapeRealPositionMax,
    "worldMap.Rows.Tree.landScapeRealPositionMax"
  );
  if (
    treeMinimum.x !== mapping.treeBounds.minX
    || treeMaximum.x !== mapping.treeBounds.maxX
    || treeMinimum.y !== mapping.treeBounds.minY
    || treeMaximum.y !== mapping.treeBounds.maxY
  ) {
    fail("mapping.treeBounds", "FModel Tree DataTable 경계와 일치하지 않습니다.");
  }
}

function internalIdForBoss(
  characterId: string,
  aliases: ReadonlyMap<string, string>
): string {
  const alias = aliases.get(characterId);
  if (alias !== undefined) return alias;
  if (!characterId.startsWith("BOSS_")) {
    fail(characterId, "검수된 BOSS_ 구조 또는 explicit alias가 아닙니다.");
  }
  const sourceInternalId = characterId.slice("BOSS_".length);
  if (!SAFE_SOURCE_ID_PATTERN.test(sourceInternalId)) {
    fail(characterId, "안전한 sourceInternalId로 정규화할 수 없습니다.");
  }
  return sourceInternalId;
}

export function buildPalworldMapMarkerArtifact(input: {
  mapping: PalworldMapMarkerMapping;
  paldex: PalworldPaldexArtifact;
  bossRows: JsonRecord;
  worldMapRows: JsonRecord;
}): PalworldMapMarkerGenerationResult {
  const mapping = assertPalworldMapMarkerMapping(input.mapping);
  const paldex = assertPalworldPaldexArtifact(input.paldex);
  if (paldex.release !== mapping.targetGameVersion) {
    fail("mapping.targetGameVersion", "활성 Paldex release와 일치하지 않습니다.");
  }
  assertWorldMapBounds(input.worldMapRows, mapping);
  const palByInternalId = new Map(
    paldex.records.map((pal) => [pal.sourceInternalId, pal])
  );
  const aliases = new Map(
    mapping.aliases.map((alias) => [alias.sourceCharacterId, alias.sourceInternalId])
  );
  const usedAliases = new Set<string>();
  const markers: PalworldMapMarkerArtifact["worlds"][number]["markers"] = [];
  let nonPalRows = 0;
  let treeMarkers = 0;
  for (const [sourceRowId, value] of Object.entries(input.bossRows)) {
    const row = objectAt(value, `boss.Rows.${sourceRowId}`, [
      "SpawnerID",
      "CharacterID",
      "Location",
      "Level"
    ]);
    textAt(row.SpawnerID, `boss.Rows.${sourceRowId}.SpawnerID`, 160);
    const characterId = textAt(
      row.CharacterID,
      `boss.Rows.${sourceRowId}.CharacterID`,
      160
    );
    const position = positionAt(row.Location, `boss.Rows.${sourceRowId}.Location`);
    const level = integerAt(row.Level, `boss.Rows.${sourceRowId}.Level`, 1, 100);
    if (characterId === "None") {
      nonPalRows += 1;
      continue;
    }
    const sourceInternalId = internalIdForBoss(characterId, aliases);
    if (aliases.has(characterId)) usedAliases.add(characterId);
    const pal = palByInternalId.get(sourceInternalId);
    if (!pal) {
      fail(
        `boss.Rows.${sourceRowId}.CharacterID`,
        `${sourceInternalId}가 활성 Paldex에 exact join되지 않습니다.`
      );
    }
    if (inside(position, mapping.treeBounds)) {
      treeMarkers += 1;
      continue;
    }
    const coordinate = normalizedPalworldMainMapCoordinate(
      position,
      mapping.world.sourceBounds
    );
    markers.push({
      id: `main-${sourceRowId.padStart(3, "0")}-${pal.id}`,
      sourceRowId,
      sourceInternalId,
      palId: pal.id,
      level,
      ...coordinate
    });
  }
  const counts = {
    sourceRows: Object.keys(input.bossRows).length,
    nonPalRows,
    mainMarkers: markers.length,
    treeMarkers
  };
  for (const [field, expected] of Object.entries(mapping.expectedCounts)) {
    if (counts[field as keyof typeof counts] !== expected) {
      fail(`mapping.expectedCounts.${field}`, `실제 집계 ${counts[field as keyof typeof counts]}와 다릅니다.`);
    }
  }
  if (
    usedAliases.size !== aliases.size
    || [...aliases.keys()].some((sourceId) => !usedAliases.has(sourceId))
  ) {
    fail("mapping.aliases", "사용되지 않는 explicit alias가 있습니다.");
  }
  const transform: PalworldMapCoordinateTransform = {
    status: "verified",
    revision: mapping.verification.revision,
    horizontalAxis: mapping.world.horizontalAxis,
    verticalAxis: mapping.world.verticalAxis,
    invertHorizontal: mapping.world.invertHorizontal,
    invertVertical: mapping.world.invertVertical,
    sourceBounds: { ...mapping.world.sourceBounds }
  };
  const artifact = createPalworldMapMarkerArtifact({
    schemaVersion: 1,
    targetGameVersion: mapping.targetGameVersion,
    activation: "active",
    source: {
      sourceType: "operator_pak_export",
      archiveSha256: mapping.sourceArchiveSha256,
      sourceMember: mapping.bossTable.member,
      sourceMemberSha256: mapping.bossTable.sha256,
      sourceGameVersion: null,
      sourceSteamBuildId: null,
      rightsVerified: false,
      usageBasis: "operator_reference_use"
    },
    worlds: [{
      world: "main",
      targetMapAssetSha256: mapping.targetMapAsset.sha256,
      transform,
      markers
    }]
  });
  return { artifact, counts };
}

async function assertRegularFileSha256(
  filePath: string,
  expectedSha256: string
): Promise<void> {
  const resolved = path.resolve(filePath);
  const info = await lstat(resolved);
  if (!info.isFile() || info.isSymbolicLink() || await realpath(resolved) !== resolved) {
    fail(filePath, "symlink가 아닌 canonical regular file이어야 합니다.");
  }
  const bytes = await readFile(resolved);
  if (sha256Bytes(bytes) !== expectedSha256) {
    fail(filePath, "고정 content SHA-256과 일치하지 않습니다.");
  }
}

export async function generatePalworldMapMarkerArtifact(input: {
  archivePath: string;
  mapping: PalworldMapMarkerMapping;
  paldexPath: string;
  targetMapPath: string;
}): Promise<PalworldMapMarkerGenerationResult> {
  const mapping = assertPalworldMapMarkerMapping(input.mapping);
  await assertRegularFileSha256(input.targetMapPath, mapping.targetMapAsset.sha256);
  const paldex = assertPalworldPaldexArtifact(
    JSON.parse(await readFile(input.paldexPath, "utf8")) as unknown
  );
  return await withPalworldPakArchive(
    input.archivePath,
    { expectedSha256: mapping.sourceArchiveSha256 },
    async (reader) => {
      const [bossBytes, worldMapBytes] = await Promise.all([
        lockedMemberBytes(reader, mapping.bossTable),
        lockedMemberBytes(reader, mapping.worldMapTable),
        lockedMemberBytes(reader, mapping.sourceMapAsset)
      ]);
      const parseRows = async (source: SourceFileLock, bytes: Buffer): Promise<JsonRecord> => {
        const tableRows = await reader.readDataTable(source.member);
        if (sha256Bytes(bytes) !== source.sha256) {
          fail(source.member, "DataTable checksum이 검증 중 변경되었습니다.");
        }
        return tableRows;
      };
      const [bossRows, worldMapRows] = await Promise.all([
        parseRows(mapping.bossTable, bossBytes),
        parseRows(mapping.worldMapTable, worldMapBytes)
      ]);
      return buildPalworldMapMarkerArtifact({
        mapping,
        paldex,
        bossRows,
        worldMapRows
      });
    }
  );
}
