import { createHash } from "node:crypto";
import {
  assertPalworldMapLocationsArtifact,
  assertPalworldMapLocationsArtifactManifest,
  PALWORLD_MAP_LOCATION_CATEGORIES,
  type PalworldMapLocationArtifactEntry,
  type PalworldMapLocationCategory,
  type PalworldMapLocationCategoryCounts,
  type PalworldMapLocationsArtifact,
  type PalworldMapLocationsArtifactManifest
} from "@streamops/shared";
import {
  normalizedPalworldMainMapCoordinate,
  type PalworldMapMarkerMapping
} from "./palworld-map-marker-generator.js";
import {
  palworldMapMarkerTransformChecksum
} from "./palworld-map-marker-compatibility.js";
import {
  withPalworldPakArchive,
  type PalworldPakArchiveMember,
  type PalworldPakArchiveReader
} from "./palworld-pak-preflight.js";
import {
  assertPalworldMapLocationsCompatibilityApproval,
  palworldMapLocationsCompatibilityEvidenceChecksum,
  type PalworldMapLocationsCompatibilityApproval
} from "./palworld-map-locations-artifact.js";
import type {
  PalworldMapImageManifest
} from "./palworld-map-image-manifest.js";

export const PALWORLD_MAP_WORLD_EXPORT_SHA256 =
  "344628b020ffc8ee4642188e356013fc3e955f2ec8addf5ae384786c494f6186";
export const PALWORLD_MAP_LOCATION_ARTIFACT_FILE = "map-locations.json";
export const PALWORLD_MAP_LOCATION_MANIFEST_FILE = "map-locations-manifest.json";
export const PALWORLD_MAP_LOCATION_REPORT_FILE = "map-locations-import-report.json";
export const PALWORLD_MAP_LOCATION_COMPATIBILITY_FILE =
  "map-locations-compatibility.json";

const SOURCE_CATEGORIES = PALWORLD_MAP_LOCATION_CATEGORIES;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RELEASE_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const SOURCE_CLASS_PATTERN = /^[A-Za-z0-9_]+$/u;
const SAFE_SUBTYPE_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/u;
const SAFE_MEMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/u;
const SOURCE_ACTOR_PATTERN = /^[A-Za-z0-9_:-]{1,160}$/u;
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const MAIN_GRID_PACKAGE_PREFIX =
  "/Game/Pal/Maps/MainWorld_5/PL_MainWorld5/_Generated_/MainGrid_";
const MAIN_GRID_MEMBER_PREFIX =
  "MainWorld_5/PL_MainWorld5/_Generated_/MainGrid_";

type JsonRecord = Record<string, unknown>;

type SourceMemberLock = {
  member: string;
  sha256: string;
};

type SourceClassMapping = {
  sourceClass: string;
  category: PalworldMapLocationCategory;
  subtype: string;
};

type CandidateFamily = {
  id: string;
  sourceClassTokens: string[];
};

export type PalworldMapLocationClassMapping = {
  schemaVersion: 2;
  targetGameVersion: string;
  sourceArchiveSha256: typeof PALWORLD_MAP_WORLD_EXPORT_SHA256;
  indexMember: SourceMemberLock;
  transformEvidence: {
    member: string;
    sha256: string;
    transformSha256: string;
    revision: string;
    targetMapAssetSha256: string;
  };
  treeTransformEvidence: {
    sourceMapAssetMember: string;
    sourceMapAssetSha256: string;
    targetMapAssetSha256: string;
    revision: string;
  };
  classes: SourceClassMapping[];
  expectedSourceCounts: Record<PalworldMapLocationCategory, number>;
  candidateFamilies: CandidateFamily[];
  compatibilityApproval: {
    reviewedAt: string;
    reviewer: string;
  };
};

export type PalworldMapLocationCounts = {
  selectedMembers: number;
  actorsScanned: number;
  sourceActors: number;
  included: number;
  treeIncluded: number;
  treeExcluded: number;
  coordinateUnresolved: number;
  outOfBoundsExcluded: number;
  exactDuplicates: number;
  byCategory: Record<PalworldMapLocationCategory, {
    sourceActors: number;
    included: number;
    treeIncluded: number;
    treeExcluded: number;
    coordinateUnresolved: number;
    outOfBoundsExcluded: number;
    exactDuplicates: number;
  }>;
};

export type PalworldMapLocationImportReport = {
  schemaVersion: 2;
  targetGameVersion: string;
  activation: "candidate";
  source: {
    archiveSha256: string;
    archiveBytes: number;
    indexMember: string;
    indexMemberSha256: string;
    memberInventorySha256: string;
    selectedMemberCount: number;
  };
  checksums: {
    mappingSha256: string;
    transformMappingSha256: string;
    transformSha256: string;
    targetMapAssetSha256: string;
    treeTargetMapAssetSha256: string;
  };
  counts: PalworldMapLocationCounts;
  candidatesExcluded: Array<{
    family: string;
    actors: number;
    sourceClasses: Array<{
      sourceClass: string;
      actors: number;
    }>;
    reason: "semantic_mapping_not_verified";
  }>;
  exclusions: {
    treeWorld: Array<{
      sourceActorId: string;
      sourceClass: string;
      category: PalworldMapLocationCategory;
    }>;
    outsideKnownWorlds: Array<{
      sourceActorId: string;
      sourceClass: string;
      category: PalworldMapLocationCategory;
    }>;
    coordinateUnresolved: Array<{
      sourceActorId: string;
      sourceClass: string;
      category: PalworldMapLocationCategory;
      reason: "attached_parent_coordinate_unresolved";
      detailCode:
        | "parent_pitch_roll_unsupported"
        | "parent_transform_cycle"
        | "parent_transform_depth_exceeded";
    }>;
  };
  excludedByReason: {
    tree_world_without_active_map: number;
    outside_verified_main_and_tree_bounds: number;
    attached_parent_coordinate_unresolved: number;
  };
  integrityAudit: {
    exactCoordinateCollisions: number;
    reusedLevelObjectInstanceIds: number;
    fastTravelPointIds: number;
    noteRowNames: number;
  };
  gates: {
    exactArchiveChecksum: "passed";
    safeMemberInventory: "passed";
    exactClassAllowlist: "passed";
    rootComponentResolution: "passed";
    sourceCounts: "passed";
    mainMapTransform: "passed";
    treeMapTransform: "passed";
    sourceMetadata: "blocked";
    activation: "candidate";
  };
};

export type PalworldMapLocationGenerationResult = {
  artifact: PalworldMapLocationsArtifact;
  report: PalworldMapLocationImportReport;
  mappingSha256: string;
};

type MutableCategoryCounts =
  PalworldMapLocationCounts["byCategory"][PalworldMapLocationCategory];

function fail(pathName: string, message: string): never {
  throw new TypeError(`${pathName}: ${message}`);
}

export function assertPalworldMapLocationMapImageEvidence(input: {
  mapping: PalworldMapLocationClassMapping;
  mapImagesManifest: PalworldMapImageManifest;
}): void {
  const mapping = assertPalworldMapLocationClassMapping(input.mapping);
  const manifest = input.mapImagesManifest;
  if (manifest.release !== mapping.targetGameVersion) {
    fail(
      "mapImagesManifest.release",
      "지도 위치 taxonomy의 target release와 일치하지 않습니다."
    );
  }
  const mainEntry = manifest.entries.find((entry) => entry.id === "main");
  if (
    mainEntry === undefined
    || mainEntry.outputSha256
      !== mapping.transformEvidence.targetMapAssetSha256
  ) {
    fail(
      "mapImagesManifest.entries.main",
      "MainMap transform evidence와 output asset이 일치하지 않습니다."
    );
  }
  const treeEntry = manifest.entries.find((entry) => entry.id === "tree");
  if (
    treeEntry === undefined
    || treeEntry.sourceMember
      !== mapping.treeTransformEvidence.sourceMapAssetMember
    || treeEntry.sourceSha256
      !== mapping.treeTransformEvidence.sourceMapAssetSha256
    || treeEntry.outputSha256
      !== mapping.treeTransformEvidence.targetMapAssetSha256
  ) {
    fail(
      "mapImagesManifest.entries.tree",
      "세계수 source member·source SHA-256·output SHA-256 evidence가 일치하지 않습니다."
    );
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactRecordAt(
  value: unknown,
  pathName: string,
  requiredKeys: readonly string[]
): JsonRecord {
  if (!isRecord(value)) fail(pathName, "객체여야 합니다.");
  const allowed = new Set(requiredKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${pathName}.${key}`, "허용되지 않은 필드입니다.");
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(value, key)) fail(`${pathName}.${key}`, "필수 필드가 없습니다.");
  }
  return value;
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

function integerAt(
  value: unknown,
  pathName: string,
  minimum: number,
  maximum: number
): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    fail(pathName, `${minimum}~${maximum} 범위의 정수여야 합니다.`);
  }
  return value;
}

function sha256At(value: unknown, pathName: string): string {
  const checksum = textAt(value, pathName, 64);
  if (!SHA256_PATTERN.test(checksum)) {
    fail(pathName, "소문자 64자리 SHA-256이어야 합니다.");
  }
  return checksum;
}

function sourceMemberAt(value: unknown, pathName: string): string {
  const member = textAt(value, pathName, 512);
  if (
    !SAFE_MEMBER_PATTERN.test(member)
    || member.startsWith("/")
    || member.includes("\\")
    || member.includes("%")
    || member.includes("//")
    || member.split("/").some((segment) =>
      segment.length === 0 || segment === "." || segment === ".."
    )
  ) {
    fail(pathName, "안전한 archive 상대 경로여야 합니다.");
  }
  return member;
}

function sourceMemberLockAt(value: unknown, pathName: string): SourceMemberLock {
  const record = exactRecordAt(value, pathName, ["member", "sha256"]);
  return {
    member: sourceMemberAt(record.member, `${pathName}.member`),
    sha256: sha256At(record.sha256, `${pathName}.sha256`)
  };
}

function emptyCategoryCounts(): Record<
  PalworldMapLocationCategory,
  MutableCategoryCounts
> {
  return Object.fromEntries(
    SOURCE_CATEGORIES.map((category) => [
      category,
      {
        sourceActors: 0,
        included: 0,
        treeIncluded: 0,
        treeExcluded: 0,
        coordinateUnresolved: 0,
        outOfBoundsExcluded: 0,
        exactDuplicates: 0
      }
    ])
  ) as Record<PalworldMapLocationCategory, MutableCategoryCounts>;
}

export function deterministicMapLocationJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function palworldMapLocationSha256(
  bytes: Uint8Array | string
): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertPalworldMapLocationClassMapping(
  value: unknown
): PalworldMapLocationClassMapping {
  const root = exactRecordAt(value, "locationMapping", [
    "schemaVersion",
    "targetGameVersion",
    "sourceArchiveSha256",
    "indexMember",
    "transformEvidence",
    "treeTransformEvidence",
    "classes",
    "expectedSourceCounts",
    "candidateFamilies",
    "compatibilityApproval"
  ]);
  if (root.schemaVersion !== 2) fail("locationMapping.schemaVersion", "2여야 합니다.");
  const targetGameVersion = textAt(
    root.targetGameVersion,
    "locationMapping.targetGameVersion",
    64
  );
  if (!RELEASE_PATTERN.test(targetGameVersion)) {
    fail("locationMapping.targetGameVersion", "major.minor.patch 형식이어야 합니다.");
  }
  const sourceArchiveSha256 = sha256At(
    root.sourceArchiveSha256,
    "locationMapping.sourceArchiveSha256"
  );
  if (sourceArchiveSha256 !== PALWORLD_MAP_WORLD_EXPORT_SHA256) {
    fail(
      "locationMapping.sourceArchiveSha256",
      "검수된 Maps.zip 고정 SHA-256과 일치해야 합니다."
    );
  }
  const indexMember = sourceMemberLockAt(
    root.indexMember,
    "locationMapping.indexMember"
  );
  const transform = exactRecordAt(
    root.transformEvidence,
    "locationMapping.transformEvidence",
    [
      "member",
      "sha256",
      "transformSha256",
      "revision",
      "targetMapAssetSha256"
    ]
  );
  const treeTransform = exactRecordAt(
    root.treeTransformEvidence,
    "locationMapping.treeTransformEvidence",
    [
      "sourceMapAssetMember",
      "sourceMapAssetSha256",
      "targetMapAssetSha256",
      "revision"
    ]
  );
  if (!Array.isArray(root.classes) || root.classes.length === 0 || root.classes.length > 256) {
    fail("locationMapping.classes", "1~256개 배열이어야 합니다.");
  }
  const classes = root.classes.map((entry, index) => {
    const record = exactRecordAt(entry, `locationMapping.classes[${index}]`, [
      "sourceClass",
      "category",
      "subtype"
    ]);
    const sourceClass = textAt(
      record.sourceClass,
      `locationMapping.classes[${index}].sourceClass`,
      160
    );
    if (!SOURCE_CLASS_PATTERN.test(sourceClass)) {
      fail(
        `locationMapping.classes[${index}].sourceClass`,
        "exact FModel actor class여야 합니다."
      );
    }
    if (
      typeof record.category !== "string"
      || !(SOURCE_CATEGORIES as readonly string[]).includes(record.category)
    ) {
      fail(
        `locationMapping.classes[${index}].category`,
        "허용된 지도 category여야 합니다."
      );
    }
    const subtype = textAt(
      record.subtype,
      `locationMapping.classes[${index}].subtype`,
      80
    );
    if (!SAFE_SUBTYPE_PATTERN.test(subtype)) {
      fail(
        `locationMapping.classes[${index}].subtype`,
        "안전한 소문자 subtype이어야 합니다."
      );
    }
    return {
      sourceClass,
      category: record.category as PalworldMapLocationCategory,
      subtype
    };
  });
  if (new Set(classes.map((entry) => entry.sourceClass)).size !== classes.length) {
    fail("locationMapping.classes", "sourceClass가 중복됐습니다.");
  }
  const expectedRecord = exactRecordAt(
    root.expectedSourceCounts,
    "locationMapping.expectedSourceCounts",
    SOURCE_CATEGORIES
  );
  const expectedSourceCounts = Object.fromEntries(
    SOURCE_CATEGORIES.map((category) => [
      category,
      integerAt(
        expectedRecord[category],
        `locationMapping.expectedSourceCounts.${category}`,
        0,
        100_000
      )
    ])
  ) as Record<PalworldMapLocationCategory, number>;
  if (
    !Array.isArray(root.candidateFamilies)
    || root.candidateFamilies.length > 20
  ) {
    fail("locationMapping.candidateFamilies", "20개 이하 배열이어야 합니다.");
  }
  const candidateFamilies = root.candidateFamilies.map((entry, index) => {
    const record = exactRecordAt(
      entry,
      `locationMapping.candidateFamilies[${index}]`,
      ["id", "sourceClassTokens"]
    );
    const id = textAt(
      record.id,
      `locationMapping.candidateFamilies[${index}].id`,
      80
    );
    if (!SAFE_SUBTYPE_PATTERN.test(id)) {
      fail(`locationMapping.candidateFamilies[${index}].id`, "안전한 ID여야 합니다.");
    }
    if (
      !Array.isArray(record.sourceClassTokens)
      || record.sourceClassTokens.length === 0
      || record.sourceClassTokens.length > 20
    ) {
      fail(
        `locationMapping.candidateFamilies[${index}].sourceClassTokens`,
        "1~20개 배열이어야 합니다."
      );
    }
    const tokens = record.sourceClassTokens.map((token, tokenIndex) =>
      textAt(
        token,
        `locationMapping.candidateFamilies[${index}].sourceClassTokens[${tokenIndex}]`,
        80
      )
    );
    return { id, sourceClassTokens: tokens };
  });
  if (
    new Set(candidateFamilies.map((entry) => entry.id)).size
    !== candidateFamilies.length
  ) {
    fail("locationMapping.candidateFamilies", "family ID가 중복됐습니다.");
  }
  const approval = exactRecordAt(
    root.compatibilityApproval,
    "locationMapping.compatibilityApproval",
    ["reviewedAt", "reviewer"]
  );
  const reviewedAt = textAt(
    approval.reviewedAt,
    "locationMapping.compatibilityApproval.reviewedAt",
    64
  );
  if (!RFC3339_PATTERN.test(reviewedAt)) {
    fail(
      "locationMapping.compatibilityApproval.reviewedAt",
      "밀리초와 Z를 포함한 RFC3339 시각이어야 합니다."
    );
  }
  const reviewer = textAt(
    approval.reviewer,
    "locationMapping.compatibilityApproval.reviewer",
    80
  );
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/u.test(reviewer)) {
    fail(
      "locationMapping.compatibilityApproval.reviewer",
      "안전한 검수자 식별자여야 합니다."
    );
  }
  return {
    schemaVersion: 2,
    targetGameVersion,
    sourceArchiveSha256: PALWORLD_MAP_WORLD_EXPORT_SHA256,
    indexMember,
    transformEvidence: {
      member: sourceMemberAt(
        transform.member,
        "locationMapping.transformEvidence.member"
      ),
      sha256: sha256At(
        transform.sha256,
        "locationMapping.transformEvidence.sha256"
      ),
      transformSha256: sha256At(
        transform.transformSha256,
        "locationMapping.transformEvidence.transformSha256"
      ),
      revision: textAt(
        transform.revision,
        "locationMapping.transformEvidence.revision",
        128
      ),
      targetMapAssetSha256: sha256At(
        transform.targetMapAssetSha256,
        "locationMapping.transformEvidence.targetMapAssetSha256"
      )
    },
    treeTransformEvidence: {
      sourceMapAssetMember: sourceMemberAt(
        treeTransform.sourceMapAssetMember,
        "locationMapping.treeTransformEvidence.sourceMapAssetMember"
      ),
      sourceMapAssetSha256: sha256At(
        treeTransform.sourceMapAssetSha256,
        "locationMapping.treeTransformEvidence.sourceMapAssetSha256"
      ),
      targetMapAssetSha256: sha256At(
        treeTransform.targetMapAssetSha256,
        "locationMapping.treeTransformEvidence.targetMapAssetSha256"
      ),
      revision: textAt(
        treeTransform.revision,
        "locationMapping.treeTransformEvidence.revision",
        128
      )
    },
    classes,
    expectedSourceCounts,
    candidateFamilies,
    compatibilityApproval: { reviewedAt, reviewer }
  };
}

function objectPathIndex(
  value: unknown,
  pathName: string,
  maximum: number
): number {
  const reference = exactRecordAt(value, pathName, [
    "ObjectName",
    "ObjectPath"
  ]);
  textAt(reference.ObjectName, `${pathName}.ObjectName`, 512);
  const objectPath = textAt(reference.ObjectPath, `${pathName}.ObjectPath`, 768);
  const match = objectPath.match(/\.(\d+)$/u);
  if (!match) fail(`${pathName}.ObjectPath`, "FModel export index가 없습니다.");
  return integerAt(
    Number(match[1]),
    `${pathName}.ObjectPath`,
    0,
    Math.max(0, maximum - 1)
  );
}

function finiteCoordinate(
  value: unknown,
  pathName: string
): { x: number; y: number } {
  if (!isRecord(value)) fail(pathName, "좌표 객체여야 합니다.");
  for (const axis of ["X", "Y"] as const) {
    if (
      typeof value[axis] !== "number"
      || !Number.isFinite(value[axis])
      || Math.abs(value[axis]) > 100_000_000
    ) {
      fail(`${pathName}.${axis}`, "유한한 world 좌표여야 합니다.");
    }
  }
  return { x: value.X as number, y: value.Y as number };
}

type Transform2d = {
  x: number;
  y: number;
  xx: number;
  xy: number;
  yx: number;
  yy: number;
};

type AttachedParentCoordinateErrorCode =
  | "parent_pitch_roll_unsupported"
  | "parent_transform_cycle"
  | "parent_transform_depth_exceeded";

class AttachedParentCoordinateError extends Error {
  readonly code: AttachedParentCoordinateErrorCode;

  constructor(code: AttachedParentCoordinateErrorCode, message: string) {
    super(message);
    this.name = "AttachedParentCoordinateError";
    this.code = code;
  }
}

function componentAtReference(
  exports: unknown[],
  value: unknown,
  pathName: string
): { component: JsonRecord; index: number } {
  const reference = exactRecordAt(value, pathName, [
    "ObjectName",
    "ObjectPath"
  ]);
  const objectName = textAt(
    reference.ObjectName,
    `${pathName}.ObjectName`,
    512
  );
  const index = objectPathIndex(reference, pathName, exports.length);
  const component = isRecord(exports[index])
    ? exports[index]
    : fail(pathName, "참조한 export가 객체가 아닙니다.");
  const componentType = textAt(
    component.Type,
    `${pathName}.Referenced.Type`,
    160
  );
  const componentName = textAt(
    component.Name,
    `${pathName}.Referenced.Name`,
    160
  );
  if (
    !/Component$/u.test(componentType)
    || !objectName.startsWith(`${componentType}'`)
    || !objectName.endsWith(`.${componentName}'`)
  ) {
    fail(pathName, "참조가 exact component type·name과 일치하지 않습니다.");
  }
  return { component, index };
}

function relativeCoordinate(
  value: unknown,
  pathName: string,
  allowDefault: boolean
): { x: number; y: number } {
  if (value === undefined && allowDefault) return { x: 0, y: 0 };
  return finiteCoordinate(value, pathName);
}

function finiteNumberAt(
  value: unknown,
  pathName: string,
  maximumAbsolute: number
): number {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || Math.abs(value) > maximumAbsolute
  ) {
    fail(pathName, `절댓값 ${maximumAbsolute} 이하의 유한한 수여야 합니다.`);
  }
  return value;
}

function componentLocalLinear(
  properties: JsonRecord,
  pathName: string
): Pick<Transform2d, "xx" | "xy" | "yx" | "yy"> {
  let yaw = 0;
  if (properties.RelativeRotation !== undefined) {
    if (!isRecord(properties.RelativeRotation)) {
      fail(`${pathName}.RelativeRotation`, "회전 객체여야 합니다.");
    }
    const pitch = finiteNumberAt(
      properties.RelativeRotation.Pitch,
      `${pathName}.RelativeRotation.Pitch`,
      360_000
    );
    yaw = finiteNumberAt(
      properties.RelativeRotation.Yaw,
      `${pathName}.RelativeRotation.Yaw`,
      360_000
    );
    const roll = finiteNumberAt(
      properties.RelativeRotation.Roll,
      `${pathName}.RelativeRotation.Roll`,
      360_000
    );
    if (Math.abs(pitch) > 0.000001 || Math.abs(roll) > 0.000001) {
      throw new AttachedParentCoordinateError(
        "parent_pitch_roll_unsupported",
        "부모 component의 pitch 또는 roll이 0이 아니어서 2D 지도 좌표를 확정할 수 없습니다."
      );
    }
  }
  let scaleX = 1;
  let scaleY = 1;
  if (properties.RelativeScale3D !== undefined) {
    if (!isRecord(properties.RelativeScale3D)) {
      fail(`${pathName}.RelativeScale3D`, "scale 객체여야 합니다.");
    }
    scaleX = finiteNumberAt(
      properties.RelativeScale3D.X,
      `${pathName}.RelativeScale3D.X`,
      10_000
    );
    scaleY = finiteNumberAt(
      properties.RelativeScale3D.Y,
      `${pathName}.RelativeScale3D.Y`,
      10_000
    );
    finiteNumberAt(
      properties.RelativeScale3D.Z,
      `${pathName}.RelativeScale3D.Z`,
      10_000
    );
  }
  const radians = yaw * (Math.PI / 180);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    xx: cosine * scaleX,
    xy: -sine * scaleY,
    yx: sine * scaleX,
    yy: cosine * scaleY
  };
}

function resolveComponentTransform(
  exports: unknown[],
  component: JsonRecord,
  componentIndex: number,
  pathName: string,
  cache: Map<number, Transform2d>,
  active: Set<number>,
  depth: number
): Transform2d {
  const cached = cache.get(componentIndex);
  if (cached) return cached;
  if (depth > 64) {
    throw new AttachedParentCoordinateError(
      "parent_transform_depth_exceeded",
      "부모 component 체인이 안전한 최대 깊이를 초과했습니다."
    );
  }
  if (active.has(componentIndex)) {
    throw new AttachedParentCoordinateError(
      "parent_transform_cycle",
      "부모 component 체인에 순환 참조가 있습니다."
    );
  }
  active.add(componentIndex);
  try {
    const properties = isRecord(component.Properties)
      ? component.Properties
      : fail(`${pathName}.Properties`, "객체여야 합니다.");
    const localPosition = relativeCoordinate(
      properties.RelativeLocation,
      `${pathName}.Properties.RelativeLocation`,
      true
    );
    const localLinear = componentLocalLinear(
      properties,
      `${pathName}.Properties`
    );
    let result: Transform2d;
    if (properties.AttachParent === undefined) {
      result = {
        x: localPosition.x,
        y: localPosition.y,
        ...localLinear
      };
    } else {
      const parentReference = componentAtReference(
        exports,
        properties.AttachParent,
        `${pathName}.Properties.AttachParent`
      );
      const parent = resolveComponentTransform(
        exports,
        parentReference.component,
        parentReference.index,
        `${pathName}.Parent[${parentReference.index}]`,
        cache,
        active,
        depth + 1
      );
      result = {
        x: parent.x
          + (parent.xx * localPosition.x)
          + (parent.xy * localPosition.y),
        y: parent.y
          + (parent.yx * localPosition.x)
          + (parent.yy * localPosition.y),
        xx: (parent.xx * localLinear.xx) + (parent.xy * localLinear.yx),
        xy: (parent.xx * localLinear.xy) + (parent.xy * localLinear.yy),
        yx: (parent.yx * localLinear.xx) + (parent.yy * localLinear.yx),
        yy: (parent.yx * localLinear.xy) + (parent.yy * localLinear.yy)
      };
    }
    cache.set(componentIndex, result);
    return result;
  } finally {
    active.delete(componentIndex);
  }
}

function resolveActorPosition(
  exports: unknown[],
  actor: JsonRecord,
  actorIndex: number,
  pathName: string,
  componentTransformCache: Map<number, Transform2d>
): { x: number; y: number } {
  const properties = isRecord(actor.Properties)
    ? actor.Properties
    : fail(`${pathName}.Properties`, "객체여야 합니다.");
  const rootReference = componentAtReference(
    exports,
    properties.RootComponent,
    `${pathName}.Properties.RootComponent`
  );
  const rootIndex = rootReference.index;
  const root = rootReference.component;
  const actorName = textAt(actor.Name, `${pathName}.Name`, 160);
  const outer = exactRecordAt(root.Outer, `${pathName}.RootComponent.Outer`, [
    "ObjectName",
    "ObjectPath"
  ]);
  const outerName = textAt(
    outer.ObjectName,
    `${pathName}.RootComponent.Outer.ObjectName`,
    512
  );
  if (!outerName.endsWith(`${actorName}'`)) {
    fail(
      `${pathName}.RootComponent.Outer`,
      "component가 해당 actor를 exact Outer로 참조하지 않습니다."
    );
  }
  const outerIndexMatch = textAt(
    outer.ObjectPath,
    `${pathName}.RootComponent.Outer.ObjectPath`,
    768
  ).match(/\.(\d+)$/u);
  if (!outerIndexMatch || Number(outerIndexMatch[1]) !== actorIndex) {
    fail(
      `${pathName}.RootComponent.Outer.ObjectPath`,
      "component가 원 actor export index를 exact 역참조하지 않습니다."
    );
  }
  const rootProperties = isRecord(root.Properties)
    ? root.Properties
    : fail(`${pathName}.RootComponent.Properties`, "객체여야 합니다.");
  const localPosition = relativeCoordinate(
    rootProperties.RelativeLocation,
    `${pathName}.RootComponent.Properties.RelativeLocation`,
    false
  );
  if (rootProperties.AttachParent === undefined) return localPosition;
  const parentReference = componentAtReference(
    exports,
    rootProperties.AttachParent,
    `${pathName}.RootComponent.Properties.AttachParent`
  );
  const parent = resolveComponentTransform(
    exports,
    parentReference.component,
    parentReference.index,
    `${pathName}.RootComponent.Parent[${parentReference.index}]`,
    componentTransformCache,
    new Set([rootIndex]),
    1
  );
  return {
    x: parent.x
      + (parent.xx * localPosition.x)
      + (parent.xy * localPosition.y),
    y: parent.y
      + (parent.yx * localPosition.x)
      + (parent.yy * localPosition.y)
  };
}

function actorSourceId(actor: JsonRecord, pathName: string): string {
  const name = textAt(actor.Name, `${pathName}.Name`, 160);
  if (!SOURCE_ACTOR_PATTERN.test(name)) {
    fail(`${pathName}.Name`, "안전한 source actor ID여야 합니다.");
  }
  return name;
}

function isActorExport(value: JsonRecord): boolean {
  if (!isRecord(value.Outer) || typeof value.Outer.ObjectName !== "string") {
    return false;
  }
  return value.Outer.ObjectName.startsWith("Level'");
}

function inside(
  position: { x: number; y: number },
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
): boolean {
  return position.x >= bounds.minX
    && position.x <= bounds.maxX
    && position.y >= bounds.minY
    && position.y <= bounds.maxY;
}

function artifactLocationId(
  category: PalworldMapLocationCategory,
  memberName: string,
  actorIndex: number
): string {
  const digest = palworldMapLocationSha256(
    `${PALWORLD_MAP_WORLD_EXPORT_SHA256}\u0000${memberName}\u0000${actorIndex}`
  ).slice(0, 20);
  return `${category}-${digest}`;
}

function rootCellMember(
  value: JsonRecord,
  pathName: string,
  rootExports: unknown[]
): string | undefined {
  if (value.Type !== "WorldPartitionLevelStreamingDynamic") return undefined;
  const properties = isRecord(value.Properties)
    ? value.Properties
    : fail(`${pathName}.Properties`, "객체여야 합니다.");
  const packageName = textAt(
    properties.PackageNameToLoad,
    `${pathName}.Properties.PackageNameToLoad`,
    768
  );
  if (!packageName.startsWith(MAIN_GRID_PACKAGE_PREFIX)) return undefined;
  if (!isRecord(properties.WorldAsset)) {
    fail(`${pathName}.Properties.WorldAsset`, "객체여야 합니다.");
  }
  const assetPathName = textAt(
    properties.WorldAsset.AssetPathName,
    `${pathName}.Properties.WorldAsset.AssetPathName`,
    768
  );
  if (assetPathName !== `${packageName}.PL_MainWorld5`) {
    fail(
      `${pathName}.Properties.WorldAsset.AssetPathName`,
      "PackageNameToLoad과 exact match하지 않습니다."
    );
  }
  const cellIndex = objectPathIndex(
    properties.StreamingCell,
    `${pathName}.Properties.StreamingCell`,
    rootExports.length
  );
  const cell = isRecord(rootExports[cellIndex])
    ? rootExports[cellIndex]
    : fail(`${pathName}.Properties.StreamingCell`, "cell export가 아닙니다.");
  if (cell.Type !== "WorldPartitionRuntimeLevelStreamingCell") {
    fail(
      `${pathName}.Properties.StreamingCell`,
      "WorldPartition runtime cell이 아닙니다."
    );
  }
  const cellProperties = isRecord(cell.Properties)
    ? cell.Properties
    : fail(`${pathName}.StreamingCell.Properties`, "객체여야 합니다.");
  const dynamicIndex = objectPathIndex(
    cellProperties.LevelStreaming,
    `${pathName}.StreamingCell.Properties.LevelStreaming`,
    rootExports.length
  );
  if (rootExports[dynamicIndex] !== value) {
    fail(
      `${pathName}.StreamingCell.Properties.LevelStreaming`,
      "streaming dynamic과 cell의 역참조가 일치하지 않습니다."
    );
  }
  const relative = packageName.slice(
    "/Game/Pal/Maps/".length
  );
  const member = `${relative}.json`;
  if (!member.startsWith(MAIN_GRID_MEMBER_PREFIX)) {
    fail(pathName, "MainGrid member 경로로 정규화할 수 없습니다.");
  }
  return sourceMemberAt(member, `${pathName}.member`);
}

function inventoryChecksum(
  members: readonly PalworldPakArchiveMember[]
): string {
  return palworldMapLocationSha256(
    deterministicMapLocationJson(
      members.map((member) => ({
        member: member.name,
        compressedBytes: member.compressedBytes,
        uncompressedBytes: member.uncompressedBytes
      }))
    )
  );
}

export async function generatePalworldMapLocationCandidate(input: {
  archivePath: string;
  mapping: PalworldMapLocationClassMapping;
  mappingBytes: Uint8Array;
  transformMapping: PalworldMapMarkerMapping;
  transformMappingBytes: Uint8Array;
  mapImagesManifest: PalworldMapImageManifest;
}): Promise<PalworldMapLocationGenerationResult> {
  const mapping = assertPalworldMapLocationClassMapping(input.mapping);
  assertPalworldMapLocationMapImageEvidence({
    mapping,
    mapImagesManifest: input.mapImagesManifest
  });
  const mappingSha256 = palworldMapLocationSha256(input.mappingBytes);
  const transformMappingSha256 = palworldMapLocationSha256(
    input.transformMappingBytes
  );
  if (transformMappingSha256 !== mapping.transformEvidence.sha256) {
    fail(
      "locationMapping.transformEvidence.sha256",
      "실제 main-map-transform mapping과 일치하지 않습니다."
    );
  }
  if (
    input.transformMapping.targetGameVersion !== mapping.targetGameVersion
    || input.transformMapping.verification.revision
      !== mapping.transformEvidence.revision
    || input.transformMapping.targetMapAsset.sha256
      !== mapping.transformEvidence.targetMapAssetSha256
  ) {
    fail(
      "locationMapping.transformEvidence",
      "검증된 target release·transform revision·map asset과 일치하지 않습니다."
    );
  }
  const transform = {
    status: "verified" as const,
    revision: input.transformMapping.verification.revision,
    horizontalAxis: input.transformMapping.world.horizontalAxis,
    verticalAxis: input.transformMapping.world.verticalAxis,
    invertHorizontal: input.transformMapping.world.invertHorizontal,
    invertVertical: input.transformMapping.world.invertVertical,
    sourceBounds: { ...input.transformMapping.world.sourceBounds }
  };
  if (
    transform.horizontalAxis !== "world_y"
    || transform.verticalAxis !== "world_x"
    || transform.invertHorizontal !== false
    || transform.invertVertical !== true
  ) {
    fail("locationMapping.transformEvidence", "검증된 MainMap 축 계약이 아닙니다.");
  }
  const treeTransform = {
    status: "verified" as const,
    revision: mapping.treeTransformEvidence.revision,
    horizontalAxis: transform.horizontalAxis,
    verticalAxis: transform.verticalAxis,
    invertHorizontal: transform.invertHorizontal,
    invertVertical: transform.invertVertical,
    sourceBounds: { ...input.transformMapping.treeBounds }
  };
  if (
    palworldMapMarkerTransformChecksum(transform)
    !== mapping.transformEvidence.transformSha256
  ) {
    fail(
      "locationMapping.transformEvidence.transformSha256",
      "실제 좌표 transform checksum과 일치하지 않습니다."
    );
  }
  return await withPalworldPakArchive(
    input.archivePath,
    {
      expectedSha256: PALWORLD_MAP_WORLD_EXPORT_SHA256,
      profile: "fixed_map_world_export"
    },
    async (reader) => await buildFromWorldExport({
      reader,
      mapping,
      mappingSha256,
      transformMappingSha256,
      transform,
      treeTransform
    })
  );
}

async function buildFromWorldExport(input: {
  reader: PalworldPakArchiveReader;
  mapping: PalworldMapLocationClassMapping;
  mappingSha256: string;
  transformMappingSha256: string;
  transform: PalworldMapLocationsArtifact["worlds"][number]["transform"];
  treeTransform: PalworldMapLocationsArtifact["worlds"][number]["transform"];
}): Promise<PalworldMapLocationGenerationResult> {
  const {
    reader,
    mapping,
    mappingSha256,
    transformMappingSha256,
    transform,
    treeTransform
  } = input;
  const treeBounds = treeTransform.sourceBounds;
  if (reader.archiveSha256 !== PALWORLD_MAP_WORLD_EXPORT_SHA256) {
    fail("archive", "검수된 Maps.zip 고정 SHA-256과 일치하지 않습니다.");
  }
  const indexBytes = await reader.readBytes(
    mapping.indexMember.member,
    400 * 1024 * 1024
  );
  if (palworldMapLocationSha256(indexBytes) !== mapping.indexMember.sha256) {
    fail(mapping.indexMember.member, "고정 index member checksum과 일치하지 않습니다.");
  }
  let rootExports: unknown;
  try {
    rootExports = JSON.parse(indexBytes.toString("utf8")) as unknown;
  } catch {
    fail(mapping.indexMember.member, "JSON을 파싱할 수 없습니다.");
  }
  if (!Array.isArray(rootExports)) {
    fail(mapping.indexMember.member, "FModel export 배열이어야 합니다.");
  }
  const selectedNames = new Set<string>([mapping.indexMember.member]);
  for (const [index, entry] of rootExports.entries()) {
    if (!isRecord(entry)) continue;
    const member = rootCellMember(
      entry,
      `${mapping.indexMember.member}[${index}]`,
      rootExports
    );
    if (member !== undefined) selectedNames.add(member);
  }
  const memberByName = new Map(
    reader.members.map((member) => [member.name, member])
  );
  const selectedMembers = [...selectedNames]
    .map((name) =>
      memberByName.get(name)
      ?? fail(name, "root World Partition index가 참조한 member가 없습니다.")
    )
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  const memberInventorySha256 = inventoryChecksum(selectedMembers);
  const classByName = new Map(
    mapping.classes.map((entry) => [entry.sourceClass, entry])
  );
  const categoryCounts = emptyCategoryCounts();
  const candidateCounts = new Map<string, Map<string, number>>(
    mapping.candidateFamilies.map((family) => [family.id, new Map()])
  );
  const locations: PalworldMapLocationArtifactEntry[] = [];
  const treeLocations: PalworldMapLocationArtifactEntry[] = [];
  const treeWorld: PalworldMapLocationImportReport["exclusions"]["treeWorld"] = [];
  const outsideKnownWorlds:
    PalworldMapLocationImportReport["exclusions"]["outsideKnownWorlds"] = [];
  const coordinateUnresolved:
    PalworldMapLocationImportReport["exclusions"]["coordinateUnresolved"] = [];
  const seenActors = new Set<string>();
  const coordinateKeys = new Set<string>();
  const exactPlacementKeys = new Set<string>();
  const instanceIds = new Map<string, number>();
  const fastTravelPointIds = new Set<string>();
  const noteRowNames = new Set<string>();
  let exactCoordinateCollisions = 0;
  let reusedLevelObjectInstanceIds = 0;
  let actorsScanned = 0;

  const visitExports = (exports: unknown[], memberName: string): void => {
    const componentTransformCache = new Map<number, Transform2d>();
    for (const [index, value] of exports.entries()) {
      if (!isRecord(value) || !isActorExport(value)) continue;
      actorsScanned += 1;
      const sourceClass = typeof value.Type === "string" ? value.Type : "";
      const classMapping = classByName.get(sourceClass);
      if (classMapping === undefined) {
        for (const family of mapping.candidateFamilies) {
          if (
            family.sourceClassTokens.some((token) => sourceClass.includes(token))
          ) {
            const classes = candidateCounts.get(family.id)!;
            classes.set(sourceClass, (classes.get(sourceClass) ?? 0) + 1);
          }
        }
        continue;
      }
      const classPath = textAt(
        value.Class,
        `${memberName}[${index}].Class`,
        768
      );
      if (!classPath.endsWith(`.${sourceClass}'`)) {
        fail(
          `${memberName}[${index}].Class`,
          "Type과 BlueprintGeneratedClass가 exact match하지 않습니다."
        );
      }
      const sourceActorId = actorSourceId(
        value,
        `${memberName}[${index}]`
      );
      const category = classMapping.category;
      const counts = categoryCounts[category];
      counts.sourceActors += 1;
      const sourceIdentity = `${memberName}\u0000${index}`;
      if (seenActors.has(sourceIdentity)) {
        counts.exactDuplicates += 1;
        continue;
      }
      seenActors.add(sourceIdentity);
      let position: { x: number; y: number };
      try {
        position = resolveActorPosition(
          exports,
          value,
          index,
          `${memberName}[${index}]`,
          componentTransformCache
        );
      } catch (error) {
        if (error instanceof AttachedParentCoordinateError) {
          counts.coordinateUnresolved += 1;
          coordinateUnresolved.push({
            sourceActorId,
            sourceClass,
            category,
            reason: "attached_parent_coordinate_unresolved",
            detailCode: error.code
          });
          continue;
        }
        throw error;
      }
      const coordinateKey = `${sourceClass}\u0000${position.x}\u0000${position.y}`;
      if (coordinateKeys.has(coordinateKey)) {
        exactCoordinateCollisions += 1;
      } else {
        coordinateKeys.add(coordinateKey);
      }
      const properties = isRecord(value.Properties) ? value.Properties : {};
      const sourceInstanceId =
        typeof properties.LevelObjectInstanceId === "string"
          ? textAt(
            properties.LevelObjectInstanceId,
            `${memberName}[${index}].Properties.LevelObjectInstanceId`,
            160
          )
          : null;
      if (sourceInstanceId !== null) {
        const exactPlacementKey =
          `${coordinateKey}\u0000${sourceInstanceId}`;
        if (exactPlacementKeys.has(exactPlacementKey)) {
          counts.exactDuplicates += 1;
          continue;
        }
        exactPlacementKeys.add(exactPlacementKey);
      }
      if (typeof properties.LevelObjectInstanceId === "string") {
        const prior = instanceIds.get(properties.LevelObjectInstanceId) ?? 0;
        if (prior > 0) reusedLevelObjectInstanceIds += 1;
        instanceIds.set(properties.LevelObjectInstanceId, prior + 1);
      }
      if (category === "fast-travel") {
        const fastTravelPointId = textAt(
          properties.FastTravelPointID,
          `${memberName}[${index}].Properties.FastTravelPointID`,
          160
        );
        if (fastTravelPointIds.has(fastTravelPointId)) {
          fail(
            `${memberName}[${index}].Properties.FastTravelPointID`,
            "중복 빠른 이동 지점 ID입니다."
          );
        }
        fastTravelPointIds.add(fastTravelPointId);
      }
      if (category === "journal") {
        const note = isRecord(properties.NoteRowName)
          ? properties.NoteRowName
          : fail(
            `${memberName}[${index}].Properties.NoteRowName`,
            "객체여야 합니다."
          );
        const noteRowName = textAt(
          note.Key,
          `${memberName}[${index}].Properties.NoteRowName.Key`,
          160
        );
        if (noteRowNames.has(noteRowName)) {
          fail(
            `${memberName}[${index}].Properties.NoteRowName.Key`,
            "중복 journal row입니다."
          );
        }
        noteRowNames.add(noteRowName);
      }
      const targetWorld = inside(position, treeBounds)
        ? "tree"
        : inside(position, transform.sourceBounds)
          ? "main"
          : undefined;
      if (targetWorld === undefined) {
        counts.outOfBoundsExcluded += 1;
        outsideKnownWorlds.push({ sourceActorId, sourceClass, category });
        continue;
      }
      const coordinate = normalizedPalworldMainMapCoordinate(
        position,
        targetWorld === "tree" ? treeTransform.sourceBounds : transform.sourceBounds
      );
      const entry = {
        id: artifactLocationId(category, memberName, index),
        sourceActorId,
        sourceClass,
        sourceMemberPath: memberName,
        sourceActorExportIndex: index,
        sourceInstanceId,
        category,
        subtype: classMapping.subtype,
        ...coordinate
      };
      if (targetWorld === "tree") {
        treeLocations.push(entry);
        counts.treeIncluded += 1;
      } else {
        locations.push(entry);
        counts.included += 1;
      }
    }
  };

  visitExports(rootExports, mapping.indexMember.member);
  rootExports = [];
  for (const member of selectedMembers) {
    if (member.name === mapping.indexMember.member) continue;
    const value = await reader.readJson(member.name);
    if (!Array.isArray(value)) {
      fail(member.name, "FModel export 배열이어야 합니다.");
    }
    visitExports(value, member.name);
  }

  for (const category of SOURCE_CATEGORIES) {
    const actual = categoryCounts[category].sourceActors;
    const expected = mapping.expectedSourceCounts[category];
    if (actual !== expected) {
      fail(
        `locationMapping.expectedSourceCounts.${category}`,
        `실제 exact actor ${actual}개와 고정 집계 ${expected}개가 다릅니다.`
      );
    }
  }
  locations.sort((left, right) => left.id.localeCompare(right.id, "en"));
  treeLocations.sort((left, right) => left.id.localeCompare(right.id, "en"));
  const allLocations = [...locations, ...treeLocations];
  if (
    new Set(allLocations.map((entry) => entry.id)).size !== allLocations.length
  ) {
    fail("artifact.worlds.locations", "생성 ID가 충돌했습니다.");
  }
  treeWorld.sort((left, right) =>
    left.sourceActorId.localeCompare(right.sourceActorId, "en")
  );
  outsideKnownWorlds.sort((left, right) =>
    left.sourceActorId.localeCompare(right.sourceActorId, "en")
  );
  coordinateUnresolved.sort((left, right) =>
    left.sourceActorId.localeCompare(right.sourceActorId, "en")
  );
  const counts: PalworldMapLocationCounts = {
    selectedMembers: selectedMembers.length,
    actorsScanned,
    sourceActors: SOURCE_CATEGORIES.reduce(
      (sum, category) => sum + categoryCounts[category].sourceActors,
      0
    ),
    included: locations.length,
    treeIncluded: treeLocations.length,
    treeExcluded: treeWorld.length,
    coordinateUnresolved: coordinateUnresolved.length,
    outOfBoundsExcluded: outsideKnownWorlds.length,
    exactDuplicates: SOURCE_CATEGORIES.reduce(
      (sum, category) => sum + categoryCounts[category].exactDuplicates,
      0
    ),
    byCategory: categoryCounts
  };
  if (
    counts.sourceActors
    !== counts.included
      + counts.treeIncluded
      + counts.treeExcluded
      + counts.coordinateUnresolved
      + counts.outOfBoundsExcluded
      + counts.exactDuplicates
  ) {
    fail("counts", "입력·포함·제외·중복 수량이 보존되지 않았습니다.");
  }
  const candidatesExcluded = mapping.candidateFamilies.map((family) => {
    const classCounts = candidateCounts.get(family.id)!;
    const sourceClasses = [...classCounts.entries()]
      .map(([sourceClass, actors]) => ({ sourceClass, actors }))
      .sort((left, right) => left.sourceClass.localeCompare(right.sourceClass, "en"));
    return {
      family: family.id,
      actors: sourceClasses.reduce((sum, entry) => sum + entry.actors, 0),
      sourceClasses,
      reason: "semantic_mapping_not_verified" as const
    };
  });
  const mainCategoryCounts = Object.fromEntries(
    SOURCE_CATEGORIES.map((category) => [
      category,
      categoryCounts[category].included
    ])
  ) as PalworldMapLocationCategoryCounts;
  const treeCategoryCounts = Object.fromEntries(
    SOURCE_CATEGORIES.map((category) => [
      category,
      categoryCounts[category].treeIncluded
    ])
  ) as PalworldMapLocationCategoryCounts;
  const artifact: PalworldMapLocationsArtifact = {
    schemaVersion: 1,
    targetGameVersion: mapping.targetGameVersion,
    activation: "candidate",
    source: {
      sourceType: "operator_pak_export",
      archiveSha256: PALWORLD_MAP_WORLD_EXPORT_SHA256,
      indexMember: mapping.indexMember.member,
      indexMemberSha256: mapping.indexMember.sha256,
      memberInventorySha256,
      selectedMemberCount: selectedMembers.length,
      sourceGameVersion: null,
      sourceSteamBuildId: null,
      rightsVerified: false,
      usageBasis: "operator_reference_use"
    },
    totalLocations: allLocations.length,
    worlds: [
      {
        world: "main",
        targetMapAssetSha256: mapping.transformEvidence.targetMapAssetSha256,
        transform,
        locationCount: locations.length,
        categoryCounts: mainCategoryCounts,
        locations
      },
      {
        world: "tree",
        targetMapAssetSha256:
          mapping.treeTransformEvidence.targetMapAssetSha256,
        transform: treeTransform,
        locationCount: treeLocations.length,
        categoryCounts: treeCategoryCounts,
        locations: treeLocations
      }
    ]
  };
  const report: PalworldMapLocationImportReport = {
    schemaVersion: 2,
    targetGameVersion: mapping.targetGameVersion,
    activation: "candidate",
    source: {
      archiveSha256: PALWORLD_MAP_WORLD_EXPORT_SHA256,
      archiveBytes: reader.archiveBytes,
      indexMember: mapping.indexMember.member,
      indexMemberSha256: mapping.indexMember.sha256,
      memberInventorySha256,
      selectedMemberCount: selectedMembers.length
    },
    checksums: {
      mappingSha256,
      transformMappingSha256,
      transformSha256: mapping.transformEvidence.transformSha256,
      targetMapAssetSha256: mapping.transformEvidence.targetMapAssetSha256,
      treeTargetMapAssetSha256:
        mapping.treeTransformEvidence.targetMapAssetSha256
    },
    counts,
    candidatesExcluded,
    exclusions: {
      treeWorld,
      outsideKnownWorlds,
      coordinateUnresolved
    },
    excludedByReason: {
      tree_world_without_active_map: treeWorld.length,
      outside_verified_main_and_tree_bounds: outsideKnownWorlds.length,
      attached_parent_coordinate_unresolved: coordinateUnresolved.length
    },
    integrityAudit: {
      exactCoordinateCollisions,
      reusedLevelObjectInstanceIds,
      fastTravelPointIds: fastTravelPointIds.size,
      noteRowNames: noteRowNames.size
    },
    gates: {
      exactArchiveChecksum: "passed",
      safeMemberInventory: "passed",
      exactClassAllowlist: "passed",
      rootComponentResolution: "passed",
      sourceCounts: "passed",
      mainMapTransform: "passed",
      treeMapTransform: "passed",
      sourceMetadata: "blocked",
      activation: "candidate"
    }
  };
  return {
    artifact: assertPalworldMapLocationsArtifact(artifact),
    report,
    mappingSha256
  };
}

export function createPalworldMapLocationManifest(input: {
  artifactText: string;
  report: PalworldMapLocationImportReport;
}): PalworldMapLocationsArtifactManifest {
  return assertPalworldMapLocationsArtifactManifest({
    schemaVersion: 1,
    targetGameVersion: input.report.targetGameVersion,
    artifactFile: PALWORLD_MAP_LOCATION_ARTIFACT_FILE,
    artifactSha256: palworldMapLocationSha256(input.artifactText)
  });
}

export function createPalworldMapLocationCompatibilityApproval(input: {
  mapping: PalworldMapLocationClassMapping;
  manifest: PalworldMapLocationsArtifactManifest;
  manifestText: string;
  artifact: PalworldMapLocationsArtifact;
  report: PalworldMapLocationImportReport;
}): PalworldMapLocationsCompatibilityApproval {
  const mapping = assertPalworldMapLocationClassMapping(input.mapping);
  const mainWorld = input.artifact.worlds.find((world) => world.world === "main");
  const treeWorld = input.artifact.worlds.find((world) => world.world === "tree");
  if (!mainWorld || !treeWorld) {
    fail("artifact.worlds", "main과 tree world artifact가 모두 필요합니다.");
  }
  const aggregateCategoryCounts = Object.fromEntries(
    SOURCE_CATEGORIES.map((category) => [
      category,
      mainWorld.categoryCounts[category] + treeWorld.categoryCounts[category]
    ])
  ) as PalworldMapLocationCategoryCounts;
  const payload = {
    schemaVersion: 2 as const,
    release: mapping.targetGameVersion,
    status: "operator_acknowledged" as const,
    decision: "allow_exact_checksum_compatibility_display" as const,
    sourceVersionVerified: false as const,
    compatibilityBasis: "exact_world_actor_join_and_map_geometry" as const,
    sourceArchiveSha256: mapping.sourceArchiveSha256,
    indexMemberSha256: mapping.indexMember.sha256,
    memberInventorySha256: input.artifact.source.memberInventorySha256,
    mapLocationsArtifactSha256: input.manifest.artifactSha256,
    mapLocationsManifestSha256:
      palworldMapLocationSha256(input.manifestText),
    selectedMemberCount: input.artifact.source.selectedMemberCount,
    totalLocations: input.artifact.totalLocations,
    categoryCounts: aggregateCategoryCounts,
    worlds: input.artifact.worlds.map((world) => ({
      world: world.world,
      targetMapAssetSha256: world.targetMapAssetSha256,
      transformRevision: world.transform.revision
    })),
    importAudit: {
      sourceRawExact: input.report.counts.sourceActors,
      mainIncluded: input.report.counts.included,
      treeIncluded: input.report.counts.treeIncluded,
      treeExcluded: input.report.counts.treeExcluded,
      coordinateUnresolved: input.report.counts.coordinateUnresolved,
      outOfBoundsExcluded: input.report.counts.outOfBoundsExcluded,
      exactDuplicates: input.report.counts.exactDuplicates,
      taxonomyMappingSha256: input.report.checksums.mappingSha256,
      transformMappingSha256: input.report.checksums.transformMappingSha256
    },
    reviewedAt: mapping.compatibilityApproval.reviewedAt,
    reviewer: mapping.compatibilityApproval.reviewer,
    rightsVerified: false as const,
    usageBasis: "operator_reference_use" as const
  };
  return assertPalworldMapLocationsCompatibilityApproval({
    ...payload,
    evidenceChecksum:
      palworldMapLocationsCompatibilityEvidenceChecksum(payload)
  });
}
