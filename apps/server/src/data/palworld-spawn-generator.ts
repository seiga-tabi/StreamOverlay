import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import {
  PALWORLD_PAL_SPAWN_GRID_SIZE,
  type PalworldPalSpawnPoint
} from "@streamops/shared";
import {
  assertPalworldPaldexArtifact,
  type PalworldPaldexArtifact
} from "./palworld-paldex-artifact.js";
import {
  normalizedPalworldMainMapCoordinate
} from "./palworld-map-marker-generator.js";
import {
  createPalworldSpawnArtifact,
  type PalworldSpawnArtifact
} from "./palworld-spawn-artifact.js";
import {
  withPalworldPakArchive,
  type PalworldPakExportMetadata,
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

type SpawnAlias = {
  stage: "source_character" | "canonical_tribe";
  sourceId: string;
  targetSourceInternalId: string;
  reason: string;
  reviewStatus: "approved";
};

type SpawnExclusion = {
  sourceCharacterId: string;
  reason: string;
  reviewStatus: "approved";
};

type SpawnLevelRangeCorrection = {
  sourceRowId: string;
  slot: 1 | 2 | 3;
  sourceCharacterId: string;
  sourceMinimum: number;
  sourceMaximum: number;
  correctedMinimum: number;
  correctedMaximum: number;
  reason: string;
  reviewStatus: "approved";
};

type SpawnExpectedCounts = {
  placementRows: number;
  wildSpawnerRows: number;
  matchedPlacementRows: number;
  unmatchedPlacementRows: number;
  unresolvedPalOccurrences: number;
  eligibleOccurrences: number;
  palCount: number;
  placementLinks: number;
  clusteredPoints: number;
};

export type PalworldSpawnMapping = {
  schemaVersion: 1;
  targetGameVersion: string;
  sourceArchiveSha256: string;
  palTable: SourceFileLock;
  placementTable: SourceFileLock;
  wildSpawnerTable: SourceFileLock;
  targetMapAsset: {
    imageUrl: string;
    sha256: string;
    width: number;
    height: number;
  };
  verification: {
    status: "exact_spawner_join_and_grid_reviewed";
    revision: string;
    gridSize: typeof PALWORLD_PAL_SPAWN_GRID_SIZE;
    compatibilityBasis: "exact_active_paldex_join_and_map_geometry";
  };
  filters: {
    worldName: "PL_MainWorld5";
    placementType: "EPalSpawnerPlacementType::Field";
    spawnerType: "EPalSpawnedCharacterType::Common";
    minimumWeightExclusive: 0;
  };
  expectedCounts: SpawnExpectedCounts;
  world: {
    id: "main";
    horizontalAxis: "world_y";
    verticalAxis: "world_x";
    invertHorizontal: false;
    invertVertical: true;
    sourceBounds: SourceBounds;
  };
  treeBounds: SourceBounds;
  aliases: SpawnAlias[];
  exclusions: SpawnExclusion[];
  levelRangeCorrections: SpawnLevelRangeCorrection[];
};

export type PalworldSpawnGenerationResult = {
  artifact: PalworldSpawnArtifact;
  counts: SpawnExpectedCounts;
};

type ParsedPlacement = {
  sourceRowId: string;
  spawnerName: string;
  spawnerType: string;
  worldName: string;
  placementType: string;
  position: { x: number; y: number };
};

type ParsedSpawnSlot = {
  sourceCharacterId: string;
  minimumLevel: number;
  maximumLevel: number;
  minimumCount: number;
  maximumCount: number;
};

type ParsedWildSpawner = {
  sourceRowId: string;
  spawnerName: string;
  spawnerType: string;
  weight: number;
  onlyTime: "EPalOneDayTimeType::Undefined" | "EPalOneDayTimeType::Night";
  slots: ParsedSpawnSlot[];
};

type PlacementLink = {
  palId: string;
  sourceInternalId: string;
  placementRowId: string;
  normalizedX: number;
  normalizedY: number;
  minimumLevel: number;
  maximumLevel: number;
  daytime: boolean;
  nighttime: boolean;
};

function fail(pathName: string, message: string): never {
  throw new TypeError(`${pathName}: ${message}`);
}

function recordAt(value: unknown, pathName: string): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(pathName, "객체여야 합니다.");
  }
  return value as JsonRecord;
}

function exactRecordAt(
  value: unknown,
  pathName: string,
  keys: readonly string[]
): JsonRecord {
  const record = recordAt(value, pathName);
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

function plainTextAt(value: unknown, pathName: string, maximum = 512): string {
  if (
    typeof value !== "string"
    || value.length > maximum
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    fail(pathName, `제어문자가 없는 ${maximum}자 이하 문자열이어야 합니다.`);
  }
  return value;
}

function sourceIdAt(value: unknown, pathName: string): string {
  const sourceId = textAt(value, pathName, 160);
  if (!SAFE_SOURCE_ID_PATTERN.test(sourceId)) {
    fail(pathName, "안전한 source internal ID여야 합니다.");
  }
  return sourceId;
}

function sha256At(value: unknown, pathName: string): string {
  const checksum = textAt(value, pathName, 64);
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

function integerAt(value: unknown, pathName: string, minimum: number, maximum: number): number {
  const result = finiteAt(value, pathName, minimum, maximum);
  if (!Number.isSafeInteger(result)) fail(pathName, "안전한 정수여야 합니다.");
  return result;
}

function booleanAt(value: unknown, pathName: string): boolean {
  if (typeof value !== "boolean") fail(pathName, "boolean이어야 합니다.");
  return value;
}

function sourceFileAt(value: unknown, pathName: string): SourceFileLock {
  const record = exactRecordAt(value, pathName, ["member", "sha256"]);
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
  return { member, sha256: sha256At(record.sha256, `${pathName}.sha256`) };
}

function boundsAt(value: unknown, pathName: string): SourceBounds {
  const record = exactRecordAt(value, pathName, ["minX", "maxX", "minY", "maxY"]);
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

export function assertPalworldSpawnMapping(value: unknown): PalworldSpawnMapping {
  const root = exactRecordAt(value, "mapping", [
    "schemaVersion",
    "targetGameVersion",
    "sourceArchiveSha256",
    "palTable",
    "placementTable",
    "wildSpawnerTable",
    "targetMapAsset",
    "verification",
    "filters",
    "expectedCounts",
    "world",
    "treeBounds",
    "aliases",
    "exclusions",
    "levelRangeCorrections"
  ]);
  if (root.schemaVersion !== 1) fail("mapping.schemaVersion", "1이어야 합니다.");
  const targetGameVersion = textAt(root.targetGameVersion, "mapping.targetGameVersion", 64);
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(targetGameVersion)) {
    fail("mapping.targetGameVersion", "semver 형식이어야 합니다.");
  }
  const targetMapAsset = exactRecordAt(root.targetMapAsset, "mapping.targetMapAsset", [
    "imageUrl",
    "sha256",
    "width",
    "height"
  ]);
  const imageUrl = textAt(targetMapAsset.imageUrl, "mapping.targetMapAsset.imageUrl");
  const imageSha256 = sha256At(targetMapAsset.sha256, "mapping.targetMapAsset.sha256");
  const imageMatch = imageUrl.match(SAFE_PUBLIC_ASSET_PATTERN);
  if (!imageMatch || imageMatch[1] !== targetGameVersion || imageMatch[2] !== imageSha256) {
    fail(
      "mapping.targetMapAsset.imageUrl",
      "target release와 content hash가 일치하는 로컬 Palworld map URL이어야 합니다."
    );
  }
  const verification = exactRecordAt(root.verification, "mapping.verification", [
    "status",
    "revision",
    "gridSize",
    "compatibilityBasis"
  ]);
  if (
    verification.status !== "exact_spawner_join_and_grid_reviewed"
    || verification.gridSize !== PALWORLD_PAL_SPAWN_GRID_SIZE
    || verification.compatibilityBasis !== "exact_active_paldex_join_and_map_geometry"
  ) {
    fail(
      "mapping.verification",
      "활성 도감 exact join, 검증된 지도 geometry와 32×32 grid 계약이어야 합니다."
    );
  }
  const filters = exactRecordAt(root.filters, "mapping.filters", [
    "worldName",
    "placementType",
    "spawnerType",
    "minimumWeightExclusive"
  ]);
  if (
    filters.worldName !== "PL_MainWorld5"
    || filters.placementType !== "EPalSpawnerPlacementType::Field"
    || filters.spawnerType !== "EPalSpawnedCharacterType::Common"
    || filters.minimumWeightExclusive !== 0
  ) {
    fail("mapping.filters", "검증된 MainWorld 일반 필드 스폰 filter와 일치해야 합니다.");
  }
  const expected = exactRecordAt(root.expectedCounts, "mapping.expectedCounts", [
    "placementRows",
    "wildSpawnerRows",
    "matchedPlacementRows",
    "unmatchedPlacementRows",
    "unresolvedPalOccurrences",
    "eligibleOccurrences",
    "palCount",
    "placementLinks",
    "clusteredPoints"
  ]);
  const expectedCounts = Object.fromEntries(
    Object.entries(expected).map(([key, count]) => [
      key,
      integerAt(count, `mapping.expectedCounts.${key}`, 0, 100_000)
    ])
  ) as SpawnExpectedCounts;
  if (
    expectedCounts.placementRows < 1
    || expectedCounts.wildSpawnerRows < 1
    || expectedCounts.palCount < 1
    || expectedCounts.placementLinks < 1
    || expectedCounts.clusteredPoints < 1
  ) {
    fail("mapping.expectedCounts", "source와 공개 스폰 기대 수는 1개 이상이어야 합니다.");
  }
  const world = exactRecordAt(root.world, "mapping.world", [
    "id",
    "horizontalAxis",
    "verticalAxis",
    "invertHorizontal",
    "invertVertical",
    "sourceBounds"
  ]);
  if (
    world.id !== "main"
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
    const alias = exactRecordAt(valueAtIndex, `mapping.aliases[${index}]`, [
      "stage",
      "sourceId",
      "targetSourceInternalId",
      "reason",
      "reviewStatus"
    ]);
    if (
      alias.stage !== "source_character"
      && alias.stage !== "canonical_tribe"
    ) {
      fail(`mapping.aliases[${index}].stage`, "허용된 exact join 단계가 아닙니다.");
    }
    if (alias.reviewStatus !== "approved") {
      fail(`mapping.aliases[${index}].reviewStatus`, "approved여야 합니다.");
    }
    return {
      stage: alias.stage as SpawnAlias["stage"],
      sourceId: sourceIdAt(alias.sourceId, `mapping.aliases[${index}].sourceId`),
      targetSourceInternalId: sourceIdAt(
        alias.targetSourceInternalId,
        `mapping.aliases[${index}].targetSourceInternalId`
      ),
      reason: textAt(alias.reason, `mapping.aliases[${index}].reason`, 256),
      reviewStatus: "approved" as const
    };
  });
  const aliasKeys = aliases.map((alias) => `${alias.stage}\0${alias.sourceId}`);
  if (new Set(aliasKeys).size !== aliases.length) {
    fail("mapping.aliases", "stage/sourceId가 중복됐습니다.");
  }
  if (!Array.isArray(root.exclusions) || root.exclusions.length > 50) {
    fail("mapping.exclusions", "50개 이하 배열이어야 합니다.");
  }
  const exclusions = root.exclusions.map((valueAtIndex, index) => {
    const exclusion = exactRecordAt(
      valueAtIndex,
      `mapping.exclusions[${index}]`,
      ["sourceCharacterId", "reason", "reviewStatus"]
    );
    if (exclusion.reviewStatus !== "approved") {
      fail(`mapping.exclusions[${index}].reviewStatus`, "approved여야 합니다.");
    }
    return {
      sourceCharacterId: sourceIdAt(
        exclusion.sourceCharacterId,
        `mapping.exclusions[${index}].sourceCharacterId`
      ),
      reason: textAt(exclusion.reason, `mapping.exclusions[${index}].reason`, 256),
      reviewStatus: "approved" as const
    };
  });
  if (
    new Set(exclusions.map((exclusion) => exclusion.sourceCharacterId)).size
    !== exclusions.length
  ) {
    fail("mapping.exclusions", "sourceCharacterId가 중복됐습니다.");
  }
  if (!Array.isArray(root.levelRangeCorrections) || root.levelRangeCorrections.length > 50) {
    fail("mapping.levelRangeCorrections", "50개 이하 배열이어야 합니다.");
  }
  const levelRangeCorrections = root.levelRangeCorrections.map((valueAtIndex, index) => {
    const correction = exactRecordAt(
      valueAtIndex,
      `mapping.levelRangeCorrections[${index}]`,
      [
        "sourceRowId",
        "slot",
        "sourceCharacterId",
        "sourceMinimum",
        "sourceMaximum",
        "correctedMinimum",
        "correctedMaximum",
        "reason",
        "reviewStatus"
      ]
    );
    const slot = integerAt(
      correction.slot,
      `mapping.levelRangeCorrections[${index}].slot`,
      1,
      3
    ) as 1 | 2 | 3;
    const sourceMinimum = integerAt(
      correction.sourceMinimum,
      `mapping.levelRangeCorrections[${index}].sourceMinimum`,
      0,
      100
    );
    const sourceMaximum = integerAt(
      correction.sourceMaximum,
      `mapping.levelRangeCorrections[${index}].sourceMaximum`,
      0,
      100
    );
    const correctedMinimum = integerAt(
      correction.correctedMinimum,
      `mapping.levelRangeCorrections[${index}].correctedMinimum`,
      1,
      100
    );
    const correctedMaximum = integerAt(
      correction.correctedMaximum,
      `mapping.levelRangeCorrections[${index}].correctedMaximum`,
      1,
      100
    );
    if (
      correction.reviewStatus !== "approved"
      || sourceMinimum <= sourceMaximum
      || correctedMinimum > correctedMaximum
    ) {
      fail(
        `mapping.levelRangeCorrections[${index}]`,
        "source 역전과 검수된 정상 correction 범위를 명시해야 합니다."
      );
    }
    return {
      sourceRowId: sourceIdAt(
        correction.sourceRowId,
        `mapping.levelRangeCorrections[${index}].sourceRowId`
      ),
      slot,
      sourceCharacterId: sourceIdAt(
        correction.sourceCharacterId,
        `mapping.levelRangeCorrections[${index}].sourceCharacterId`
      ),
      sourceMinimum,
      sourceMaximum,
      correctedMinimum,
      correctedMaximum,
      reason: textAt(
        correction.reason,
        `mapping.levelRangeCorrections[${index}].reason`,
        256
      ),
      reviewStatus: "approved" as const
    };
  });
  const correctionKeys = levelRangeCorrections.map((correction) =>
    `${correction.sourceRowId}\0${correction.slot}`
  );
  if (new Set(correctionKeys).size !== levelRangeCorrections.length) {
    fail("mapping.levelRangeCorrections", "sourceRowId/slot이 중복됐습니다.");
  }
  return {
    schemaVersion: 1,
    targetGameVersion,
    sourceArchiveSha256: sha256At(
      root.sourceArchiveSha256,
      "mapping.sourceArchiveSha256"
    ),
    palTable: sourceFileAt(root.palTable, "mapping.palTable"),
    placementTable: sourceFileAt(root.placementTable, "mapping.placementTable"),
    wildSpawnerTable: sourceFileAt(root.wildSpawnerTable, "mapping.wildSpawnerTable"),
    targetMapAsset: {
      imageUrl,
      sha256: imageSha256,
      width: integerAt(targetMapAsset.width, "mapping.targetMapAsset.width", 1, 16_384),
      height: integerAt(targetMapAsset.height, "mapping.targetMapAsset.height", 1, 16_384)
    },
    verification: {
      status: "exact_spawner_join_and_grid_reviewed",
      revision: textAt(verification.revision, "mapping.verification.revision", 128),
      gridSize: PALWORLD_PAL_SPAWN_GRID_SIZE,
      compatibilityBasis: "exact_active_paldex_join_and_map_geometry"
    },
    filters: {
      worldName: "PL_MainWorld5",
      placementType: "EPalSpawnerPlacementType::Field",
      spawnerType: "EPalSpawnedCharacterType::Common",
      minimumWeightExclusive: 0
    },
    expectedCounts,
    world: {
      id: "main",
      horizontalAxis: "world_y",
      verticalAxis: "world_x",
      invertHorizontal: false,
      invertVertical: true,
      sourceBounds: boundsAt(world.sourceBounds, "mapping.world.sourceBounds")
    },
    treeBounds: boundsAt(root.treeBounds, "mapping.treeBounds"),
    aliases,
    exclusions,
    levelRangeCorrections
  };
}

function sha256Bytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
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

function enumSuffix(value: unknown, pathName: string): string {
  const raw = textAt(value, pathName, 192);
  const suffix = raw.includes("::") ? raw.slice(raw.lastIndexOf("::") + 2) : raw;
  return sourceIdAt(suffix, pathName);
}

function parsePosition(value: unknown, pathName: string): { x: number; y: number } {
  const position = exactRecordAt(value, pathName, ["X", "Y", "Z"]);
  finiteAt(position.Z, `${pathName}.Z`, -100_000_000, 100_000_000);
  return {
    x: finiteAt(position.X, `${pathName}.X`, -100_000_000, 100_000_000),
    y: finiteAt(position.Y, `${pathName}.Y`, -100_000_000, 100_000_000)
  };
}

function parsePlacementRows(rows: JsonRecord): ParsedPlacement[] {
  return Object.entries(rows)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([sourceRowId, raw]) => {
      const pathName = `placement.Rows.${sourceRowId}`;
      const row = exactRecordAt(raw, pathName, [
        "InstanceName",
        "SpawnerName",
        "SpawnerType",
        "PlacementType",
        "Location",
        "RadiusType",
        "StaticRadius",
        "WorldName",
        "LayerNames",
        "SpawnerClass",
        "RespawnCoolTime"
      ]);
      plainTextAt(row.InstanceName, `${pathName}.InstanceName`, 256);
      const spawnerName = textAt(row.SpawnerName, `${pathName}.SpawnerName`, 160);
      const spawnerType = textAt(row.SpawnerType, `${pathName}.SpawnerType`, 96);
      if (![
        "EPalSpawnedCharacterType::Common",
        "EPalSpawnedCharacterType::FieldBoss",
        "EPalSpawnedCharacterType::ImprisonmentBoss",
        "EPalSpawnedCharacterType::RandomDungeonBoss"
      ].includes(spawnerType)) {
        fail(`${pathName}.SpawnerType`, "알 수 없는 spawner type입니다.");
      }
      const placementType = textAt(row.PlacementType, `${pathName}.PlacementType`, 96);
      if (![
        "EPalSpawnerPlacementType::Dungeon",
        "EPalSpawnerPlacementType::DungeonBoss",
        "EPalSpawnerPlacementType::Field",
        "EPalSpawnerPlacementType::FieldBoss",
        "EPalSpawnerPlacementType::ImprisonmentBoss"
      ].includes(placementType)) {
        fail(`${pathName}.PlacementType`, "알 수 없는 placement type입니다.");
      }
      textAt(row.RadiusType, `${pathName}.RadiusType`, 96);
      finiteAt(row.StaticRadius, `${pathName}.StaticRadius`, 0, 10_000_000);
      const worldName = textAt(row.WorldName, `${pathName}.WorldName`, 96);
      if (!Array.isArray(row.LayerNames) || row.LayerNames.length > 32) {
        fail(`${pathName}.LayerNames`, "32개 이하 배열이어야 합니다.");
      }
      row.LayerNames.forEach((layer, index) =>
        textAt(layer, `${pathName}.LayerNames[${index}]`, 160)
      );
      const spawnerClass = exactRecordAt(row.SpawnerClass, `${pathName}.SpawnerClass`, [
        "AssetPathName",
        "SubPathString"
      ]);
      textAt(spawnerClass.AssetPathName, `${pathName}.SpawnerClass.AssetPathName`, 512);
      if (typeof spawnerClass.SubPathString !== "string") {
        fail(`${pathName}.SpawnerClass.SubPathString`, "문자열이어야 합니다.");
      }
      finiteAt(row.RespawnCoolTime, `${pathName}.RespawnCoolTime`, 0, 100_000_000);
      return {
        sourceRowId: textAt(sourceRowId, `${pathName}.sourceRowId`, 160),
        spawnerName,
        spawnerType,
        worldName,
        placementType,
        position: parsePosition(row.Location, `${pathName}.Location`)
      };
    });
}

function parseWildSpawnerRows(
  rows: JsonRecord,
  corrections: readonly SpawnLevelRangeCorrection[],
  usedCorrections: Set<string>
): ParsedWildSpawner[] {
  const correctionByKey = new Map(
    corrections.map((correction) => [
      `${correction.sourceRowId}\0${correction.slot}`,
      correction
    ])
  );
  const keys = [
    "SpawnerName",
    "SpawnerType",
    "Weight",
    "OnlyTime",
    "OnlyWeather",
    "Pal_1",
    "NPC_1",
    "LvMin_1",
    "LvMax_1",
    "NumMin_1",
    "NumMax_1",
    "Pal_2",
    "NPC_2",
    "LvMin_2",
    "LvMax_2",
    "NumMin_2",
    "NumMax_2",
    "Pal_3",
    "NPC_3",
    "LvMin_3",
    "LvMax_3",
    "NumMin_3",
    "NumMax_3",
    "bIsAllowRandomizer",
    "bHasWorldTreeAura"
  ] as const;
  return Object.entries(rows)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([sourceRowId, raw]) => {
      const pathName = `wildSpawner.Rows.${sourceRowId}`;
      const row = exactRecordAt(raw, pathName, keys);
      const spawnerType = textAt(row.SpawnerType, `${pathName}.SpawnerType`, 96);
      if (![
        "EPalSpawnedCharacterType::Common",
        "EPalSpawnedCharacterType::FieldBoss",
        "EPalSpawnedCharacterType::ImprisonmentBoss",
        "EPalSpawnedCharacterType::RandomDungeonBoss"
      ].includes(spawnerType)) {
        fail(`${pathName}.SpawnerType`, "알 수 없는 spawner type입니다.");
      }
      const onlyTime = textAt(row.OnlyTime, `${pathName}.OnlyTime`, 96);
      if (
        onlyTime !== "EPalOneDayTimeType::Undefined"
        && onlyTime !== "EPalOneDayTimeType::Night"
      ) {
        fail(`${pathName}.OnlyTime`, "지원하지 않는 시간 조건입니다.");
      }
      if (row.OnlyWeather !== "EPalWeatherConditionType::Undefined") {
        fail(`${pathName}.OnlyWeather`, "날씨 조건은 현재 공개 spawn schema에서 지원하지 않습니다.");
      }
      const slots: ParsedSpawnSlot[] = [];
      for (let slot = 1; slot <= 3; slot += 1) {
        const sourceCharacterId = sourceIdAt(
          row[`Pal_${slot}`],
          `${pathName}.Pal_${slot}`
        );
        sourceIdAt(row[`NPC_${slot}`], `${pathName}.NPC_${slot}`);
        const sourceMinimumLevel = integerAt(
          row[`LvMin_${slot}`],
          `${pathName}.LvMin_${slot}`,
          0,
          100
        );
        const sourceMaximumLevel = integerAt(
          row[`LvMax_${slot}`],
          `${pathName}.LvMax_${slot}`,
          0,
          100
        );
        const correctionKey = `${sourceRowId}\0${slot}`;
        const correction = correctionByKey.get(correctionKey);
        if (
          correction !== undefined
          && (
            correction.sourceCharacterId !== sourceCharacterId
            || correction.sourceMinimum !== sourceMinimumLevel
            || correction.sourceMaximum !== sourceMaximumLevel
          )
        ) {
          fail(
            `mapping.levelRangeCorrections.${sourceRowId}.${slot}`,
            "고정 source character/level 값과 일치하지 않습니다."
          );
        }
        if (correction !== undefined) usedCorrections.add(correctionKey);
        const minimumLevel = correction?.correctedMinimum ?? sourceMinimumLevel;
        const maximumLevel = correction?.correctedMaximum ?? sourceMaximumLevel;
        const minimumCount = integerAt(row[`NumMin_${slot}`], `${pathName}.NumMin_${slot}`, 0, 100);
        const maximumCount = integerAt(row[`NumMax_${slot}`], `${pathName}.NumMax_${slot}`, 0, 100);
        if (minimumLevel > maximumLevel || minimumCount > maximumCount) {
          fail(`${pathName}.Pal_${slot}`, "level 또는 spawn count 범위가 뒤집혔습니다.");
        }
        if (sourceCharacterId !== "None") {
          slots.push({
            sourceCharacterId,
            minimumLevel,
            maximumLevel,
            minimumCount,
            maximumCount
          });
        }
      }
      booleanAt(row.bIsAllowRandomizer, `${pathName}.bIsAllowRandomizer`);
      booleanAt(row.bHasWorldTreeAura, `${pathName}.bHasWorldTreeAura`);
      return {
        sourceRowId: textAt(sourceRowId, `${pathName}.sourceRowId`, 160),
        spawnerName: textAt(row.SpawnerName, `${pathName}.SpawnerName`, 160),
        spawnerType,
        weight: finiteAt(row.Weight, `${pathName}.Weight`, 0, 100_000),
        onlyTime,
        slots
      } as ParsedWildSpawner;
    });
}

function sourceInternalIdForSpawn(input: {
  sourceCharacterId: string;
  palRows: JsonRecord;
  aliases: ReadonlyMap<string, string>;
  usedAliases: Set<string>;
}): string | undefined {
  const sourceAliasKey = `source_character\0${input.sourceCharacterId}`;
  const sourceAlias = input.aliases.get(sourceAliasKey);
  if (sourceAlias !== undefined) {
    input.usedAliases.add(sourceAliasKey);
    return sourceAlias;
  }
  const sourcePal = input.palRows[input.sourceCharacterId];
  if (sourcePal === undefined) return undefined;
  const pal = recordAt(sourcePal, `pal.Rows.${input.sourceCharacterId}`);
  if (pal.IsPal !== true || typeof pal.ZukanIndex !== "number" || !Number.isFinite(pal.ZukanIndex)) {
    return undefined;
  }
  const tribe = enumSuffix(pal.Tribe, `pal.Rows.${input.sourceCharacterId}.Tribe`);
  const tribeAliasKey = `canonical_tribe\0${tribe}`;
  const tribeAlias = input.aliases.get(tribeAliasKey);
  if (tribeAlias !== undefined) {
    input.usedAliases.add(tribeAliasKey);
    return tribeAlias;
  }
  return tribe;
}

function gridCell(value: number): number {
  return Math.min(
    PALWORLD_PAL_SPAWN_GRID_SIZE - 1,
    Math.floor(value * PALWORLD_PAL_SPAWN_GRID_SIZE)
  );
}

export function buildPalworldSpawnArtifact(input: {
  mapping: PalworldSpawnMapping;
  paldex: PalworldPaldexArtifact;
  palRows: JsonRecord;
  placementRows: JsonRecord;
  wildSpawnerRows: JsonRecord;
  activation?: "candidate" | "active";
  sourceMetadata?: PalworldPakExportMetadata;
}): PalworldSpawnGenerationResult {
  const mapping = assertPalworldSpawnMapping(input.mapping);
  const paldex = assertPalworldPaldexArtifact(input.paldex);
  if (paldex.release !== mapping.targetGameVersion) {
    fail("mapping.targetGameVersion", "활성 Paldex release와 일치하지 않습니다.");
  }
  const activation = input.activation ?? "candidate";
  if (activation === "active") {
    if (input.sourceMetadata === undefined) {
      fail(
        "sourceMetadata",
        "active spawn artifact에는 검증된 PAK export metadata가 필요합니다."
      );
    }
    if (input.sourceMetadata.gameVersion !== mapping.targetGameVersion) {
      fail(
        "sourceMetadata.gameVersion",
        "활성 Paldex release와 정확히 일치해야 합니다."
      );
    }
    if (input.sourceMetadata.steamBuildId !== paldex.steamBuildId) {
      fail(
        "sourceMetadata.steamBuildId",
        "활성 Paldex Steam build ID와 정확히 일치해야 합니다."
      );
    }
  }
  const palsBySourceInternalId = new Map(
    paldex.records.map((pal) => [pal.sourceInternalId, pal])
  );
  const aliases = new Map(
    mapping.aliases.map((alias) => [
      `${alias.stage}\0${alias.sourceId}`,
      alias.targetSourceInternalId
    ])
  );
  for (const alias of mapping.aliases) {
    if (!palsBySourceInternalId.has(alias.targetSourceInternalId)) {
      fail(
        `mapping.aliases.${alias.sourceId}`,
        "활성 Paldex에 없는 targetSourceInternalId입니다."
      );
    }
  }
  const usedAliases = new Set<string>();
  const exclusions = new Map(
    mapping.exclusions.map((exclusion) => [exclusion.sourceCharacterId, exclusion])
  );
  const usedExclusions = new Set<string>();
  const usedCorrections = new Set<string>();
  const placements = parsePlacementRows(input.placementRows);
  const wildSpawners = parseWildSpawnerRows(
    input.wildSpawnerRows,
    mapping.levelRangeCorrections,
    usedCorrections
  );
  const wildBySpawnerName = new Map<string, ParsedWildSpawner[]>();
  for (const spawner of wildSpawners) {
    wildBySpawnerName.set(
      spawner.spawnerName,
      [...(wildBySpawnerName.get(spawner.spawnerName) ?? []), spawner]
    );
  }
  const links = new Map<string, PlacementLink>();
  let matchedPlacementRows = 0;
  let unresolvedPalOccurrences = 0;
  let eligibleOccurrences = 0;
  for (const placement of placements) {
    const definitions = wildBySpawnerName.get(placement.spawnerName);
    if (definitions !== undefined) matchedPlacementRows += 1;
    if (
      definitions === undefined
      || placement.worldName !== mapping.filters.worldName
      || placement.placementType !== mapping.filters.placementType
      || placement.spawnerType !== mapping.filters.spawnerType
      || inside(placement.position, mapping.treeBounds)
      || !inside(placement.position, mapping.world.sourceBounds)
    ) {
      continue;
    }
    const coordinate = normalizedPalworldMainMapCoordinate(
      placement.position,
      mapping.world.sourceBounds
    );
    for (const definition of definitions) {
      if (
        definition.spawnerType !== mapping.filters.spawnerType
        || definition.weight <= mapping.filters.minimumWeightExclusive
      ) {
        continue;
      }
      for (const slot of definition.slots) {
        if (slot.sourceCharacterId === "RowName") continue;
        if (
          slot.minimumLevel < 1
          || slot.maximumLevel < 1
          || slot.minimumCount < 1
          || slot.maximumCount < 1
        ) {
          fail(
            `wildSpawner.Rows.${definition.sourceRowId}.${slot.sourceCharacterId}`,
            "공개 Pal spawn slot은 양수 level과 count가 필요합니다."
          );
        }
        const sourceInternalId = sourceInternalIdForSpawn({
          sourceCharacterId: slot.sourceCharacterId,
          palRows: input.palRows,
          aliases,
          usedAliases
        });
        const pal = sourceInternalId === undefined
          ? undefined
          : palsBySourceInternalId.get(sourceInternalId);
        if (!sourceInternalId || !pal) {
          if (!exclusions.has(slot.sourceCharacterId)) {
            fail(
              `wildSpawner.Rows.${definition.sourceRowId}.${slot.sourceCharacterId}`,
              "활성 도감에 연결되지 않은 source ID는 검수된 exclusion이 필요합니다."
            );
          }
          usedExclusions.add(slot.sourceCharacterId);
          unresolvedPalOccurrences += 1;
          continue;
        }
        eligibleOccurrences += 1;
        const linkKey = `${pal.id}\0${placement.sourceRowId}`;
        const daytime = definition.onlyTime === "EPalOneDayTimeType::Undefined";
        const nighttime = true;
        const previous = links.get(linkKey);
        if (!previous) {
          links.set(linkKey, {
            palId: pal.id,
            sourceInternalId,
            placementRowId: placement.sourceRowId,
            ...coordinate,
            minimumLevel: slot.minimumLevel,
            maximumLevel: slot.maximumLevel,
            daytime,
            nighttime
          });
          continue;
        }
        if (
          previous.sourceInternalId !== sourceInternalId
          || previous.normalizedX !== coordinate.normalizedX
          || previous.normalizedY !== coordinate.normalizedY
        ) {
          fail(linkKey, "동일 Pal/placement key의 canonical 참조 또는 좌표가 충돌합니다.");
        }
        previous.minimumLevel = Math.min(previous.minimumLevel, slot.minimumLevel);
        previous.maximumLevel = Math.max(previous.maximumLevel, slot.maximumLevel);
        previous.daytime ||= daytime;
        previous.nighttime ||= nighttime;
      }
    }
  }
  if (
    usedAliases.size !== aliases.size
    || [...aliases.keys()].some((key) => !usedAliases.has(key))
  ) {
    fail("mapping.aliases", "사용되지 않는 explicit alias가 있습니다.");
  }
  if (
    usedCorrections.size !== mapping.levelRangeCorrections.length
    || mapping.levelRangeCorrections.some((correction) =>
      !usedCorrections.has(`${correction.sourceRowId}\0${correction.slot}`)
    )
  ) {
    fail("mapping.levelRangeCorrections", "사용되지 않는 level range correction이 있습니다.");
  }
  const bucketsByPal = new Map<string, Map<string, {
    sourceInternalId: string;
    cellX: number;
    cellY: number;
    sumX: number;
    sumY: number;
    placementCount: number;
    minimumLevel: number;
    maximumLevel: number;
    daytime: boolean;
    nighttime: boolean;
  }>>();
  for (const link of [...links.values()].sort((left, right) =>
    left.palId.localeCompare(right.palId, "en")
    || left.placementRowId.localeCompare(right.placementRowId, "en")
  )) {
    const cellX = gridCell(link.normalizedX);
    const cellY = gridCell(link.normalizedY);
    const cellKey = `${cellX}:${cellY}`;
    const palBuckets = bucketsByPal.get(link.palId) ?? new Map();
    const bucket = palBuckets.get(cellKey);
    if (!bucket) {
      palBuckets.set(cellKey, {
        sourceInternalId: link.sourceInternalId,
        cellX,
        cellY,
        sumX: link.normalizedX,
        sumY: link.normalizedY,
        placementCount: 1,
        minimumLevel: link.minimumLevel,
        maximumLevel: link.maximumLevel,
        daytime: link.daytime,
        nighttime: link.nighttime
      });
      bucketsByPal.set(link.palId, palBuckets);
      continue;
    }
    if (bucket.sourceInternalId !== link.sourceInternalId) {
      fail(link.palId, "grid bucket의 sourceInternalId가 충돌합니다.");
    }
    bucket.sumX += link.normalizedX;
    bucket.sumY += link.normalizedY;
    bucket.placementCount += 1;
    bucket.minimumLevel = Math.min(bucket.minimumLevel, link.minimumLevel);
    bucket.maximumLevel = Math.max(bucket.maximumLevel, link.maximumLevel);
    bucket.daytime ||= link.daytime;
    bucket.nighttime ||= link.nighttime;
  }
  const pals = [...bucketsByPal.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([palId, buckets]) => {
      const points: PalworldPalSpawnPoint[] = [...buckets.values()]
        .map((bucket) => ({
          id: `main-${palId}-${String(bucket.cellX).padStart(2, "0")}-${String(bucket.cellY).padStart(2, "0")}`,
          cellX: bucket.cellX,
          cellY: bucket.cellY,
          normalizedX: roundedCoordinate(bucket.sumX / bucket.placementCount),
          normalizedY: roundedCoordinate(bucket.sumY / bucket.placementCount),
          placementCount: bucket.placementCount,
          minimumLevel: bucket.minimumLevel,
          maximumLevel: bucket.maximumLevel,
          daytime: bucket.daytime,
          nighttime: bucket.nighttime
        }))
        .sort((left, right) => left.id.localeCompare(right.id, "en"));
      return {
        palId,
        sourceInternalId: points.length > 0
          ? buckets.values().next().value!.sourceInternalId
          : fail(palId, "빈 Pal spawn bucket입니다."),
        totalPlacements: points.reduce((total, point) => total + point.placementCount, 0),
        points
      };
    });
  const counts: SpawnExpectedCounts = {
    placementRows: placements.length,
    wildSpawnerRows: wildSpawners.length,
    matchedPlacementRows,
    unmatchedPlacementRows: placements.length - matchedPlacementRows,
    unresolvedPalOccurrences,
    eligibleOccurrences,
    palCount: pals.length,
    placementLinks: links.size,
    clusteredPoints: pals.reduce((total, pal) => total + pal.points.length, 0)
  };
  for (const exclusion of mapping.exclusions) {
    if (!usedExclusions.has(exclusion.sourceCharacterId)) {
      fail(
        `mapping.exclusions.${exclusion.sourceCharacterId}`,
        "실제 source에서 사용되지 않은 stale exclusion입니다."
      );
    }
  }
  for (const [field, expected] of Object.entries(mapping.expectedCounts)) {
    if (counts[field as keyof SpawnExpectedCounts] !== expected) {
      fail(
        `mapping.expectedCounts.${field}`,
        `실제 집계 ${counts[field as keyof SpawnExpectedCounts]}와 다릅니다.`
      );
    }
  }
  return {
    artifact: createPalworldSpawnArtifact({
      schemaVersion: 1,
      targetGameVersion: mapping.targetGameVersion,
      activation,
      source: {
        sourceType: "operator_pak_export",
        archiveSha256: mapping.sourceArchiveSha256,
        placementTableMember: mapping.placementTable.member,
        placementTableSha256: mapping.placementTable.sha256,
        wildSpawnerTableMember: mapping.wildSpawnerTable.member,
        wildSpawnerTableSha256: mapping.wildSpawnerTable.sha256,
        palTableMember: mapping.palTable.member,
        palTableSha256: mapping.palTable.sha256,
        sourceGameVersion: input.sourceMetadata?.gameVersion ?? null,
        sourceSteamBuildId: input.sourceMetadata?.steamBuildId ?? null,
        compatibilityBasis: mapping.verification.compatibilityBasis,
        rightsVerified: false,
        usageBasis: "operator_reference_use"
      },
      gridSize: PALWORLD_PAL_SPAWN_GRID_SIZE,
      worlds: [{
        world: "main",
        targetMapAssetSha256: mapping.targetMapAsset.sha256,
        transform: {
          status: "verified",
          revision: mapping.verification.revision,
          horizontalAxis: mapping.world.horizontalAxis,
          verticalAxis: mapping.world.verticalAxis,
          invertHorizontal: mapping.world.invertHorizontal,
          invertVertical: mapping.world.invertVertical,
          sourceBounds: { ...mapping.world.sourceBounds }
        },
        pals
      }]
    }),
    counts
  };
}

async function lockedRows(
  reader: PalworldPakArchiveReader,
  source: SourceFileLock
): Promise<JsonRecord> {
  const bytes = await reader.readBytes(source.member);
  if (sha256Bytes(bytes) !== source.sha256) {
    fail(source.member, "mapping에 고정된 SHA-256과 일치하지 않습니다.");
  }
  return await reader.readDataTable(source.member);
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

export async function generatePalworldSpawnArtifact(input: {
  archivePath: string;
  mapping: PalworldSpawnMapping;
  paldexPath: string;
  targetMapPath: string;
  activation?: "candidate" | "active";
  sourceMetadata?: PalworldPakExportMetadata;
  mappingsPath?: string;
}): Promise<PalworldSpawnGenerationResult> {
  const mapping = assertPalworldSpawnMapping(input.mapping);
  await assertRegularFileSha256(input.targetMapPath, mapping.targetMapAsset.sha256);
  if (input.sourceMetadata !== undefined) {
    if (input.mappingsPath === undefined) {
      fail(
        "sourceMetadata",
        "metadata를 사용할 때는 checksum 검증할 Mappings.usmap이 필요합니다."
      );
    }
    await assertRegularFileSha256(
      input.mappingsPath,
      input.sourceMetadata.mappingsSha256
    );
  }
  if (input.activation === "active" && input.sourceMetadata === undefined) {
      fail(
        "activation",
        "active 게시에는 metadata와 해당 Mappings.usmap이 모두 필요합니다."
      );
  }
  const paldex = assertPalworldPaldexArtifact(
    JSON.parse(await readFile(input.paldexPath, "utf8")) as unknown
  );
  return await withPalworldPakArchive(
    input.archivePath,
    { expectedSha256: mapping.sourceArchiveSha256 },
    async (reader) => {
      const [palRows, placementRows, wildSpawnerRows] = await Promise.all([
        lockedRows(reader, mapping.palTable),
        lockedRows(reader, mapping.placementTable),
        lockedRows(reader, mapping.wildSpawnerTable)
      ]);
      return buildPalworldSpawnArtifact({
        mapping,
        paldex,
        palRows,
        placementRows,
        wildSpawnerRows,
        activation: input.activation,
        sourceMetadata: input.sourceMetadata
      });
    }
  );
}
