import {
  PALWORLD_ELEMENTS,
  PALWORLD_IMAGE_ASSET_STATUSES,
  PALWORLD_IMAGE_POLICY_STATUSES,
  PALWORLD_IMAGE_USAGE_BASES,
  PALWORLD_WORK_SUITABILITY_TYPES,
  type PalworldElement,
  type PalworldImageAssetStatus,
  type PalworldImagePolicyStatus,
  type PalworldImageUsageBasis,
  type PalworldPalStats,
  type PalworldWorkSuitability,
  type PalworldWorkSuitabilityType
} from "@streamops/shared";

export const PALWORLD_PALDEX_RELEASE = "1.0.1";
export const PALWORLD_PALDEX_STEAM_BUILD_ID = "24181105";
export const PALWORLD_PALDEX_EXPECTED_COUNT = 287;
export const PALWORLD_PALDEX_EXPECTED_NORMAL_COUNT = 203;
export const PALWORLD_PALDEX_EXPECTED_VARIANT_COUNT = 84;
export const PALWORLD_PAL_IMAGE_PREFIX = `/images/palworld/${PALWORLD_PALDEX_RELEASE}/pals/`;
export const PALWORLD_PAL_IMAGE_MAX_BYTES = 512 * 1024;
export const PALWORLD_PAL_IMAGE_MAX_DIMENSION = 512;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const PUBLIC_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const INTERNAL_ID_PATTERN = /^[A-Za-z0-9_]+$/u;
const IMAGE_URL_PATTERN = /^\/images\/palworld\/1\.0\.1\/pals\/([a-f0-9]{64})\.webp$/u;

export type PalworldPaldexSkillRecord = {
  id: string;
  type: "active" | "partner";
  nameEn: string;
  descriptionEn?: string;
  element?: PalworldElement;
  power?: number;
  cooldownSeconds?: number;
  unlockLevel?: number;
};

export type PalworldPaldexDropRecord = {
  itemId?: string;
  itemSourceInternalId?: string;
  nameEn: string;
  minimum: number;
  maximum: number;
  rate: number;
};

export type PalworldPaldexRecord = {
  id: string;
  sourceInternalId: string;
  number: number;
  nameKo: string;
  nameJa: string;
  nameEn: string;
  variantType: "normal" | "variant";
  elements: PalworldElement[];
  rarity: number;
  stats: PalworldPalStats;
  workSuitabilities: PalworldWorkSuitability[];
  breedingPower: number;
  nocturnal: boolean;
  descriptionEn?: string;
  partnerSkill?: PalworldPaldexSkillRecord;
  activeSkills: PalworldPaldexSkillRecord[];
  drops: PalworldPaldexDropRecord[];
  specialParentPairs: Array<{
    parentAId: string;
    parentBId: string;
    parentAGender?: "male" | "female";
    parentBGender?: "male" | "female";
  }>;
  imageUrl?: string;
};

export type PalworldPaldexArtifact = {
  schemaVersion: 2;
  release: string;
  steamBuildId: string;
  metadata: {
    gameVersion: string;
    sourceName: string;
    sourceUrl: string;
    sourceRevision: string;
    extractedAt: string;
    verifiedAt: string;
    license: string;
  };
  detailProvenance?: {
    sourceName: string;
    sourceRevision: string;
    sourceChecksum: string;
    gameVersion: string;
    license: string;
    rightsVerified: false;
    breedingSourceName: string;
    breedingSourceRevision: string;
    breedingSourceChecksum: string;
    exactPalDetails: number;
    palDetailsWithoutSource: number;
    specialBreedingPairs: number;
    unresolvedBreedingReferences: number;
    genderedBreedingPairs: number;
  };
  records: PalworldPaldexRecord[];
};

export type PalworldImageManifestEntry = {
  palId: string;
  sourceInternalId: string;
  status: "blocked_by_license" | "operator_acknowledged" | "ready";
  sourceName: string;
  sourceUrl?: string;
  sourceReference?: string;
  sourceRevision: string;
  license: string;
  usageBasis: PalworldImageUsageBasis;
  retrievedAt: string | null;
  originalSha256: string | null;
  generatedSha256: string | null;
  originalFileName: string;
  outputFileName: string | null;
  outputMime: "image/webp" | null;
  outputWidth: number | null;
  outputHeight: number | null;
  outputBytes: number | null;
  imageUrl: string | null;
};

export type PalworldImagesManifest = {
  schemaVersion: 1;
  release: string;
  revision: string;
  status: PalworldImageAssetStatus;
  rightsReview: {
    status: "blocked_by_license" | "operator_acknowledged" | "ready";
    reviewedAt: string;
    reasonCode: string;
    evidenceUrls: string[];
  };
  entries: PalworldImageManifestEntry[];
};

export type PalworldPaldexReleaseManifest = {
  schemaVersion: 1;
  release: string;
  generatedAt: string;
  sourceLockSha256: string;
  paldexSha256: string;
  imagesManifestSha256: string;
  importReportSha256: string;
  imageUsePolicySha256: string | null;
  imageSourceMapSha256: string | null;
  mappingSha256: {
    publicIdMap: string;
    elements: string;
    workSuitabilities: string;
    exclusions: string;
    imageOverrides: string;
  };
  counts: {
    pals: number;
    normal: number;
    variant: number;
    imageMappings: number;
    readyImages: number;
    uniqueImageFiles: number;
  };
  dataIntegrityGate: {
    passed: boolean;
    status: "ready" | "invalid";
    failures: string[];
    checks: {
      pals: number;
      normal: number;
      variant: number;
      missingNameKo: number;
      missingNameJa: number;
      missingNameEn: number;
      missingRequiredStats: number;
      missingBreedingPower: number;
      unknownEnums: number;
      idCollisions: number;
      aliasCollisions: number;
      sourceChecksumVerified: boolean;
      mappingChecksumsVerified: boolean;
      artifactChecksumsVerified: boolean;
    };
  };
  imageAssetGate: {
    passed: boolean;
    status: PalworldImageAssetStatus;
    policyStatus: PalworldImagePolicyStatus;
    failures: string[];
    technicalPassed: boolean;
    publicActivationAllowed: boolean;
    rightsVerified: boolean;
    usageBasis: PalworldImageUsageBasis;
    readyImages: number;
    fallbackPals: number;
    publicNoticeRequired: boolean;
  };
  runtimeActivation: boolean;
};

export class PalworldPaldexValidationError extends Error {
  readonly code = "PALWORLD_PALDEX_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PalworldPaldexValidationError";
  }
}

function fail(path: string, message: string): never {
  throw new PalworldPaldexValidationError(`${path}: ${message}`);
}

function recordAt(value: unknown, path: string, allowedKeys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(path, "객체여야 합니다.");
  const record = value as Record<string, unknown>;
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, "허용되지 않은 필드입니다.");
  }
  return record;
}

function stringAt(value: unknown, path: string, maxLength = 512): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    fail(path, `비어 있지 않은 ${maxLength}자 이하 문자열이어야 합니다.`);
  }
  return value;
}

function integerAt(value: unknown, path: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    fail(path, `${min} 이상 ${max} 이하 정수여야 합니다.`);
  }
  return value as number;
}

function numberAt(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail(path, `${min} 이상 ${max} 이하 유한 숫자여야 합니다.`);
  }
  return value;
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "boolean이어야 합니다.");
  return value;
}

function isoDateAt(value: unknown, path: string): string {
  const text = stringAt(value, path, 64);
  if (Number.isNaN(Date.parse(text))) fail(path, "올바른 날짜 문자열이어야 합니다.");
  return text;
}

function httpsUrlAt(value: unknown, path: string): string {
  const text = stringAt(value, path, 2048);
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "https:") fail(path, "https URL이어야 합니다.");
  } catch (error) {
    if (error instanceof PalworldPaldexValidationError) throw error;
    fail(path, "올바른 URL이어야 합니다.");
  }
  return text;
}

function sha256At(value: unknown, path: string): string {
  const text = stringAt(value, path, 64);
  if (!SHA256_PATTERN.test(text)) fail(path, "64자리 소문자 SHA-256이어야 합니다.");
  return text;
}

function nullableStringAt(value: unknown, path: string, maxLength = 2048): string | null {
  return value === null ? null : stringAt(value, path, maxLength);
}

function nullableIntegerAt(value: unknown, path: string, min: number, max: number): number | null {
  return value === null ? null : integerAt(value, path, min, max);
}

function assertArray(value: unknown, path: string, maxLength: number): unknown[] {
  if (!Array.isArray(value) || value.length > maxLength) fail(path, `최대 ${maxLength}개 배열이어야 합니다.`);
  return value;
}

function codePointCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertPaldexSkillRecord(
  value: unknown,
  path: string,
  expectedType: "active" | "partner"
): PalworldPaldexSkillRecord {
  const skill = recordAt(value, path, [
    "id",
    "type",
    "nameEn",
    "descriptionEn",
    "element",
    "power",
    "cooldownSeconds",
    "unlockLevel"
  ]);
  const id = stringAt(skill.id, `${path}.id`, 128);
  if (!PUBLIC_ID_PATTERN.test(id)) fail(`${path}.id`, "안정적인 소문자 kebab-case skill ID여야 합니다.");
  if (skill.type !== expectedType) fail(`${path}.type`, `${expectedType}여야 합니다.`);
  stringAt(skill.nameEn, `${path}.nameEn`, 256);
  if (skill.descriptionEn !== undefined) stringAt(skill.descriptionEn, `${path}.descriptionEn`, 8_192);
  if (skill.element !== undefined) {
    if (typeof skill.element !== "string" || !(PALWORLD_ELEMENTS as readonly string[]).includes(skill.element)) {
      fail(`${path}.element`, "알 수 없는 속성입니다.");
    }
  }
  if (expectedType === "active") {
    integerAt(skill.power, `${path}.power`, 0, 100_000);
    numberAt(skill.cooldownSeconds, `${path}.cooldownSeconds`, 0, 100_000);
    integerAt(skill.unlockLevel, `${path}.unlockLevel`, 0, 1_000);
  } else if (
    skill.element !== undefined
    || skill.power !== undefined
    || skill.cooldownSeconds !== undefined
    || skill.unlockLevel !== undefined
  ) {
    fail(path, "partner skill에는 active skill 전용 수치를 지정할 수 없습니다.");
  }
  return value as PalworldPaldexSkillRecord;
}

export function assertPalworldPaldexRecord(value: unknown, path = "record"): PalworldPaldexRecord {
  const record = recordAt(value, path, [
    "id",
    "sourceInternalId",
    "number",
    "nameKo",
    "nameJa",
    "nameEn",
    "variantType",
    "elements",
    "rarity",
    "stats",
    "workSuitabilities",
    "breedingPower",
    "nocturnal",
    "descriptionEn",
    "partnerSkill",
    "activeSkills",
    "drops",
    "specialParentPairs",
    "imageUrl"
  ]);
  const id = stringAt(record.id, `${path}.id`, 96);
  if (!PUBLIC_ID_PATTERN.test(id)) fail(`${path}.id`, "안정적인 소문자 kebab-case public ID여야 합니다.");
  const sourceInternalId = stringAt(record.sourceInternalId, `${path}.sourceInternalId`, 128);
  if (!INTERNAL_ID_PATTERN.test(sourceInternalId)) fail(`${path}.sourceInternalId`, "고정 원본 internal ID 형식이 아닙니다.");
  integerAt(record.number, `${path}.number`, 1, 10_000);
  for (const field of ["nameKo", "nameJa", "nameEn"] as const) stringAt(record[field], `${path}.${field}`, 160);
  if (record.variantType !== "normal" && record.variantType !== "variant") fail(`${path}.variantType`, "normal 또는 variant여야 합니다.");

  const elements = assertArray(record.elements, `${path}.elements`, 2);
  if (elements.length === 0) fail(`${path}.elements`, "하나 이상의 속성이 필요합니다.");
  const elementSet = new Set<PalworldElement>();
  for (const [index, element] of elements.entries()) {
    if (typeof element !== "string" || !(PALWORLD_ELEMENTS as readonly string[]).includes(element)) {
      fail(`${path}.elements[${index}]`, "알 수 없는 속성입니다.");
    }
    if (elementSet.has(element as PalworldElement)) fail(`${path}.elements[${index}]`, "중복 속성입니다.");
    elementSet.add(element as PalworldElement);
  }

  integerAt(record.rarity, `${path}.rarity`, 1, 20);
  const stats = recordAt(record.stats, `${path}.stats`, ["hp", "attack", "defense", "moveSpeed", "stamina"]);
  for (const field of ["hp", "attack", "defense", "moveSpeed", "stamina"] as const) {
    integerAt(stats[field], `${path}.stats.${field}`, 0, 1_000_000);
  }

  const workSuitabilities = assertArray(record.workSuitabilities, `${path}.workSuitabilities`, PALWORLD_WORK_SUITABILITY_TYPES.length);
  const workTypes = new Set<PalworldWorkSuitabilityType>();
  for (const [index, entry] of workSuitabilities.entries()) {
    const work = recordAt(entry, `${path}.workSuitabilities[${index}]`, ["type", "level"]);
    if (typeof work.type !== "string" || !(PALWORLD_WORK_SUITABILITY_TYPES as readonly string[]).includes(work.type)) {
      fail(`${path}.workSuitabilities[${index}].type`, "알 수 없는 작업 적성입니다.");
    }
    if (workTypes.has(work.type as PalworldWorkSuitabilityType)) fail(`${path}.workSuitabilities[${index}].type`, "중복 작업 적성입니다.");
    workTypes.add(work.type as PalworldWorkSuitabilityType);
    integerAt(work.level, `${path}.workSuitabilities[${index}].level`, 1, 8);
  }
  integerAt(record.breedingPower, `${path}.breedingPower`, 0, 1_000_000);
  booleanAt(record.nocturnal, `${path}.nocturnal`);
  if (record.descriptionEn !== undefined) stringAt(record.descriptionEn, `${path}.descriptionEn`, 8_192);
  if (record.partnerSkill !== undefined) assertPaldexSkillRecord(record.partnerSkill, `${path}.partnerSkill`, "partner");
  const activeSkillIds: string[] = [];
  for (const [index, skill] of assertArray(record.activeSkills, `${path}.activeSkills`, 64).entries()) {
    activeSkillIds.push(assertPaldexSkillRecord(skill, `${path}.activeSkills[${index}]`, "active").id);
  }
  const activeSkillSet = new Set(activeSkillIds);
  if (activeSkillSet.size !== activeSkillIds.length) fail(`${path}.activeSkills`, "중복 active skill 배정입니다.");
  for (const [index, rawDrop] of assertArray(record.drops, `${path}.drops`, 128).entries()) {
    const dropPath = `${path}.drops[${index}]`;
    const drop = recordAt(rawDrop, dropPath, ["itemId", "itemSourceInternalId", "nameEn", "minimum", "maximum", "rate"]);
    if ((drop.itemId === undefined) !== (drop.itemSourceInternalId === undefined)) {
      fail(dropPath, "itemId와 itemSourceInternalId는 함께 제공해야 합니다.");
    }
    if (drop.itemId !== undefined) {
      const itemId = stringAt(drop.itemId, `${dropPath}.itemId`, 128);
      if (!PUBLIC_ID_PATTERN.test(itemId)) fail(`${dropPath}.itemId`, "안정적인 소문자 kebab-case item ID여야 합니다.");
      const itemSourceInternalId = stringAt(drop.itemSourceInternalId, `${dropPath}.itemSourceInternalId`, 128);
      if (!INTERNAL_ID_PATTERN.test(itemSourceInternalId)) fail(`${dropPath}.itemSourceInternalId`, "고정 원본 internal ID 형식이 아닙니다.");
    }
    stringAt(drop.nameEn, `${dropPath}.nameEn`, 256);
    const minimum = integerAt(drop.minimum, `${dropPath}.minimum`, 0, 1_000_000);
    const maximum = integerAt(drop.maximum, `${dropPath}.maximum`, 0, 1_000_000);
    if (maximum < minimum) fail(dropPath, "maximum은 minimum 이상이어야 합니다.");
    numberAt(drop.rate, `${dropPath}.rate`, 0, 100);
  }
  for (const [index, rawPair] of assertArray(record.specialParentPairs, `${path}.specialParentPairs`, 128).entries()) {
    const pairPath = `${path}.specialParentPairs[${index}]`;
    const pair = recordAt(rawPair, pairPath, ["parentAId", "parentBId", "parentAGender", "parentBGender"]);
    for (const field of ["parentAId", "parentBId"] as const) {
      const parentId = stringAt(pair[field], `${pairPath}.${field}`, 128);
      if (!PUBLIC_ID_PATTERN.test(parentId)) fail(`${pairPath}.${field}`, "안정적인 소문자 kebab-case Pal ID여야 합니다.");
    }
    for (const field of ["parentAGender", "parentBGender"] as const) {
      if (pair[field] !== undefined && pair[field] !== "male" && pair[field] !== "female") {
        fail(`${pairPath}.${field}`, "male 또는 female이어야 합니다.");
      }
    }
  }
  if (record.imageUrl !== undefined) {
    const imageUrl = stringAt(record.imageUrl, `${path}.imageUrl`, 256);
    if (!IMAGE_URL_PATTERN.test(imageUrl)) fail(`${path}.imageUrl`, "고정 release의 content-hash WebP 경로여야 합니다.");
  }
  return value as PalworldPaldexRecord;
}

export function assertPalworldPaldexArtifact(value: unknown): PalworldPaldexArtifact {
  const artifact = recordAt(value, "paldex", ["schemaVersion", "release", "steamBuildId", "metadata", "detailProvenance", "records"]);
  if (artifact.schemaVersion !== 2) fail("paldex.schemaVersion", "2여야 합니다.");
  if (artifact.release !== PALWORLD_PALDEX_RELEASE) fail("paldex.release", `${PALWORLD_PALDEX_RELEASE}이어야 합니다.`);
  if (artifact.steamBuildId !== PALWORLD_PALDEX_STEAM_BUILD_ID) fail("paldex.steamBuildId", "고정 Steam Build ID와 일치해야 합니다.");
  const metadata = recordAt(artifact.metadata, "paldex.metadata", [
    "gameVersion",
    "sourceName",
    "sourceUrl",
    "sourceRevision",
    "extractedAt",
    "verifiedAt",
    "license"
  ]);
  if (metadata.gameVersion !== PALWORLD_PALDEX_RELEASE) fail("paldex.metadata.gameVersion", "release와 일치해야 합니다.");
  for (const field of ["sourceName", "sourceRevision", "license"] as const) stringAt(metadata[field], `paldex.metadata.${field}`, 512);
  httpsUrlAt(metadata.sourceUrl, "paldex.metadata.sourceUrl");
  isoDateAt(metadata.extractedAt, "paldex.metadata.extractedAt");
  isoDateAt(metadata.verifiedAt, "paldex.metadata.verifiedAt");
  let expectedDetailedRecords: number | undefined;
  let expectedSpecialBreedingPairs: number | undefined;
  let expectedGenderedBreedingPairs: number | undefined;
  if (artifact.detailProvenance !== undefined) {
    const provenance = recordAt(artifact.detailProvenance, "paldex.detailProvenance", [
      "sourceName",
      "sourceRevision",
      "sourceChecksum",
      "gameVersion",
      "license",
      "rightsVerified",
      "breedingSourceName",
      "breedingSourceRevision",
      "breedingSourceChecksum",
      "exactPalDetails",
      "palDetailsWithoutSource",
      "specialBreedingPairs",
      "unresolvedBreedingReferences",
      "genderedBreedingPairs"
    ]);
    for (const field of ["sourceName", "sourceRevision", "gameVersion", "license"] as const) {
      stringAt(provenance[field], `paldex.detailProvenance.${field}`, 512);
    }
    sha256At(provenance.sourceChecksum, "paldex.detailProvenance.sourceChecksum");
    stringAt(provenance.breedingSourceName, "paldex.detailProvenance.breedingSourceName", 512);
    stringAt(provenance.breedingSourceRevision, "paldex.detailProvenance.breedingSourceRevision", 128);
    sha256At(provenance.breedingSourceChecksum, "paldex.detailProvenance.breedingSourceChecksum");
    if (provenance.rightsVerified !== false) fail("paldex.detailProvenance.rightsVerified", "독립 권리 확인 전에는 false여야 합니다.");
    const exact = integerAt(provenance.exactPalDetails, "paldex.detailProvenance.exactPalDetails", 0, PALWORLD_PALDEX_EXPECTED_COUNT);
    const missing = integerAt(provenance.palDetailsWithoutSource, "paldex.detailProvenance.palDetailsWithoutSource", 0, PALWORLD_PALDEX_EXPECTED_COUNT);
    if (exact + missing !== PALWORLD_PALDEX_EXPECTED_COUNT) fail("paldex.detailProvenance", "Pal 상세 coverage 합계가 287이어야 합니다.");
    expectedSpecialBreedingPairs = integerAt(provenance.specialBreedingPairs, "paldex.detailProvenance.specialBreedingPairs", 0, 1_000);
    integerAt(provenance.unresolvedBreedingReferences, "paldex.detailProvenance.unresolvedBreedingReferences", 0, 1_000);
    expectedGenderedBreedingPairs = integerAt(provenance.genderedBreedingPairs, "paldex.detailProvenance.genderedBreedingPairs", 0, 1_000);
    expectedDetailedRecords = exact;
  }

  const records = assertArray(artifact.records, "paldex.records", PALWORLD_PALDEX_EXPECTED_COUNT);
  if (records.length !== PALWORLD_PALDEX_EXPECTED_COUNT) fail("paldex.records", `${PALWORLD_PALDEX_EXPECTED_COUNT}개여야 합니다.`);
  const validated = records.map((entry, index) => assertPalworldPaldexRecord(entry, `paldex.records[${index}]`));
  const ids = new Set<string>();
  const internalIds = new Set<string>();
  let normal = 0;
  let variant = 0;
  let detailedRecords = 0;
  for (const [index, entry] of validated.entries()) {
    if (ids.has(entry.id)) fail(`paldex.records[${index}].id`, "중복 public ID입니다.");
    if (internalIds.has(entry.sourceInternalId)) fail(`paldex.records[${index}].sourceInternalId`, "중복 internal ID입니다.");
    ids.add(entry.id);
    internalIds.add(entry.sourceInternalId);
    if (
      entry.descriptionEn !== undefined
      || entry.partnerSkill !== undefined
      || entry.activeSkills.length > 0
      || entry.drops.length > 0
    ) detailedRecords += 1;
    if (entry.variantType === "normal") normal += 1;
    else variant += 1;
    if (index > 0) {
      const previous = validated[index - 1]!;
      const order = previous.number - entry.number
        || (previous.variantType === entry.variantType ? 0 : previous.variantType === "normal" ? -1 : 1)
        || codePointCompare(previous.sourceInternalId, entry.sourceInternalId);
      if (order > 0) fail(`paldex.records[${index}]`, "도감 번호·종류·internal ID 순으로 결정적 정렬되어야 합니다.");
    }
  }
  if (normal !== PALWORLD_PALDEX_EXPECTED_NORMAL_COUNT || variant !== PALWORLD_PALDEX_EXPECTED_VARIANT_COUNT) {
    fail("paldex.records", `일반종 ${PALWORLD_PALDEX_EXPECTED_NORMAL_COUNT}개와 변종 ${PALWORLD_PALDEX_EXPECTED_VARIANT_COUNT}개여야 합니다.`);
  }
  if (expectedDetailedRecords !== undefined && detailedRecords !== expectedDetailedRecords) {
    fail("paldex.detailProvenance.exactPalDetails", "실제 상세 record 수와 일치해야 합니다.");
  }
  const specialParentPairs = validated.flatMap((record) => record.specialParentPairs);
  for (const [index, pair] of specialParentPairs.entries()) {
    if (!ids.has(pair.parentAId) || !ids.has(pair.parentBId)) {
      fail(`paldex.specialParentPairs[${index}]`, "도감에 없는 부모 Pal 참조입니다.");
    }
  }
  if (expectedSpecialBreedingPairs !== undefined && expectedGenderedBreedingPairs !== undefined) {
    if (specialParentPairs.length !== expectedSpecialBreedingPairs) {
      fail("paldex.detailProvenance.specialBreedingPairs", "실제 특수 교배 수와 일치해야 합니다.");
    }
    const gendered = specialParentPairs.filter((pair) => pair.parentAGender || pair.parentBGender).length;
    if (gendered !== expectedGenderedBreedingPairs) {
      fail("paldex.detailProvenance.genderedBreedingPairs", "실제 성별 조건 교배 수와 일치해야 합니다.");
    }
  }
  return value as PalworldPaldexArtifact;
}

export function assertPalworldImagesManifest(value: unknown, paldex: PalworldPaldexArtifact): PalworldImagesManifest {
  const manifest = recordAt(value, "imagesManifest", ["schemaVersion", "release", "revision", "status", "rightsReview", "entries"]);
  if (manifest.schemaVersion !== 1) fail("imagesManifest.schemaVersion", "1이어야 합니다.");
  if (manifest.release !== PALWORLD_PALDEX_RELEASE) fail("imagesManifest.release", "고정 release와 일치해야 합니다.");
  stringAt(manifest.revision, "imagesManifest.revision", 256);
  if (!(PALWORLD_IMAGE_ASSET_STATUSES as readonly unknown[]).includes(manifest.status)) fail("imagesManifest.status", "허용된 상태가 아닙니다.");
  const rights = recordAt(manifest.rightsReview, "imagesManifest.rightsReview", ["status", "reviewedAt", "reasonCode", "evidenceUrls"]);
  if (!["blocked_by_license", "operator_acknowledged", "ready"].includes(String(rights.status))) fail("imagesManifest.rightsReview.status", "허용된 상태가 아닙니다.");
  isoDateAt(rights.reviewedAt, "imagesManifest.rightsReview.reviewedAt");
  stringAt(rights.reasonCode, "imagesManifest.rightsReview.reasonCode", 128);
  const evidenceUrls = assertArray(rights.evidenceUrls, "imagesManifest.rightsReview.evidenceUrls", 16);
  if (
    rights.status === "blocked_by_license"
    && rights.reasonCode !== "OPERATOR_PUBLIC_DISPLAY_DISABLED"
    && evidenceUrls.length === 0
  ) fail("imagesManifest.rightsReview.evidenceUrls", "차단 판단 근거가 하나 이상 필요합니다.");
  evidenceUrls.forEach((url, index) => httpsUrlAt(url, `imagesManifest.rightsReview.evidenceUrls[${index}]`));

  const entries = assertArray(manifest.entries, "imagesManifest.entries", PALWORLD_PALDEX_EXPECTED_COUNT);
  if (entries.length !== paldex.records.length) fail("imagesManifest.entries", "모든 Pal의 명시적 이미지 mapping이 필요합니다.");
  const palById = new Map(paldex.records.map((pal) => [pal.id, pal]));
  const seen = new Set<string>();
  let activatedCount = 0;
  let operatorCount = 0;
  let rightsReadyCount = 0;
  let blockedCount = 0;
  for (const [index, rawEntry] of entries.entries()) {
    const path = `imagesManifest.entries[${index}]`;
    const entry = recordAt(rawEntry, path, [
      "palId",
      "sourceInternalId",
      "status",
      "sourceName",
      "sourceUrl",
      "sourceReference",
      "sourceRevision",
      "license",
      "usageBasis",
      "retrievedAt",
      "originalSha256",
      "generatedSha256",
      "originalFileName",
      "outputFileName",
      "outputMime",
      "outputWidth",
      "outputHeight",
      "outputBytes",
      "imageUrl"
    ]);
    const palId = stringAt(entry.palId, `${path}.palId`, 96);
    if (paldex.records[index]?.id !== palId) fail(`${path}.palId`, "도감과 같은 결정적 순서여야 합니다.");
    const pal = palById.get(palId);
    if (!pal) fail(`${path}.palId`, "도감에 존재하지 않는 Pal입니다.");
    if (seen.has(palId)) fail(`${path}.palId`, "중복 이미지 mapping입니다.");
    seen.add(palId);
    if (entry.sourceInternalId !== pal.sourceInternalId) fail(`${path}.sourceInternalId`, "도감 internal ID와 일치해야 합니다.");
    stringAt(entry.sourceName, `${path}.sourceName`, 256);
    if ((entry.sourceUrl === undefined) === (entry.sourceReference === undefined)) {
      fail(path, "sourceUrl 또는 sourceReference 중 정확히 하나가 필요합니다.");
    }
    if (entry.sourceUrl !== undefined) httpsUrlAt(entry.sourceUrl, `${path}.sourceUrl`);
    if (entry.sourceReference !== undefined) {
      const reference = stringAt(entry.sourceReference, `${path}.sourceReference`, 256);
      if (reference.includes("\0") || reference.includes("/") || reference.includes("\\") || reference.includes("..") || reference.includes("%") || reference.includes("://")) {
        fail(`${path}.sourceReference`, "공개 가능한 불투명 source reference여야 합니다.");
      }
    }
    stringAt(entry.sourceRevision, `${path}.sourceRevision`, 128);
    stringAt(entry.license, `${path}.license`, 256);
    if (!(PALWORLD_IMAGE_USAGE_BASES as readonly unknown[]).includes(entry.usageBasis)) fail(`${path}.usageBasis`, "허용된 사용 근거가 아닙니다.");
    stringAt(entry.originalFileName, `${path}.originalFileName`, 256);

    if (entry.status === "operator_acknowledged" || entry.status === "ready") {
      activatedCount += 1;
      if (entry.status === "operator_acknowledged") {
        operatorCount += 1;
        if (entry.usageBasis !== "operator_reference_use" || entry.license !== "RIGHTS_NOT_INDEPENDENTLY_VERIFIED") {
          fail(path, "운영자 확인 이미지는 비독립 권리 검증 상태와 operator_reference_use만 사용할 수 있습니다.");
        }
        if (entry.sourceUrl !== undefined || entry.sourceReference === undefined) {
          fail(path, "운영자가 제공한 로컬 이미지 출처는 외부 URL 대신 sourceReference를 사용해야 합니다.");
        }
      } else {
        rightsReadyCount += 1;
        if (entry.usageBasis !== "rights_verified") fail(`${path}.usageBasis`, "ready 이미지는 rights_verified여야 합니다.");
      }
      isoDateAt(entry.retrievedAt, `${path}.retrievedAt`);
      sha256At(entry.originalSha256, `${path}.originalSha256`);
      const generatedSha = sha256At(entry.generatedSha256, `${path}.generatedSha256`);
      const outputFileName = stringAt(entry.outputFileName, `${path}.outputFileName`, 80);
      if (outputFileName !== `${generatedSha}.webp`) fail(`${path}.outputFileName`, "생성 SHA-256 content hash와 일치해야 합니다.");
      if (entry.outputMime !== "image/webp") fail(`${path}.outputMime`, "image/webp여야 합니다.");
      integerAt(entry.outputWidth, `${path}.outputWidth`, 1, PALWORLD_PAL_IMAGE_MAX_DIMENSION);
      integerAt(entry.outputHeight, `${path}.outputHeight`, 1, PALWORLD_PAL_IMAGE_MAX_DIMENSION);
      integerAt(entry.outputBytes, `${path}.outputBytes`, 1, PALWORLD_PAL_IMAGE_MAX_BYTES);
      const imageUrl = stringAt(entry.imageUrl, `${path}.imageUrl`, 256);
      if (imageUrl !== `${PALWORLD_PAL_IMAGE_PREFIX}${outputFileName}`) fail(`${path}.imageUrl`, "동일 출처 content-hash 경로와 일치해야 합니다.");
      if (pal.imageUrl !== imageUrl) fail(`${path}.imageUrl`, "도감 imageUrl과 일치해야 합니다.");
    } else if (entry.status === "blocked_by_license") {
      blockedCount += 1;
      if (entry.usageBasis !== "none") fail(`${path}.usageBasis`, "차단된 이미지는 사용 근거가 none이어야 합니다.");
      for (const field of [
        "retrievedAt",
        "originalSha256",
        "generatedSha256",
        "outputFileName",
        "outputMime",
        "outputWidth",
        "outputHeight",
        "outputBytes",
        "imageUrl"
      ] as const) {
        if (entry[field] !== null) fail(`${path}.${field}`, "권리 차단 상태에서는 null이어야 합니다.");
      }
      if (pal.imageUrl !== undefined) fail(`${path}.imageUrl`, "권리 차단 Pal에는 imageUrl을 넣을 수 없습니다.");
    } else {
      fail(`${path}.status`, "blocked_by_license, operator_acknowledged 또는 ready여야 합니다.");
    }
  }
  if (manifest.status === "ready" && rightsReadyCount !== entries.length) fail("imagesManifest.status", "모든 이미지가 권리 검증 ready여야 합니다.");
  if (manifest.status === "operator_acknowledged" && operatorCount !== entries.length) fail("imagesManifest.status", "모든 이미지가 운영자 확인 상태여야 합니다.");
  if (manifest.status === "blocked_by_license" && blockedCount !== entries.length) fail("imagesManifest.status", "모든 이미지가 권리 차단 상태여야 합니다.");
  if (
    manifest.status === "partial"
    && (activatedCount === 0 || blockedCount === 0 || (operatorCount > 0 && rightsReadyCount > 0))
  ) fail("imagesManifest.status", "한 가지 사용 근거로 검증된 이미지와 fallback entry가 모두 있어야 합니다.");
  if (rights.status === "blocked_by_license" && activatedCount > 0) fail("imagesManifest.rightsReview.status", "공개 사용 확인 전 이미지를 포함할 수 없습니다.");
  if (rights.status === "operator_acknowledged" && (rightsReadyCount > 0 || activatedCount !== operatorCount)) fail("imagesManifest.rightsReview.status", "운영자 확인 상태에서 권리 검증 ready 이미지를 포함할 수 없습니다.");
  if (rights.status === "ready" && (operatorCount > 0 || activatedCount !== rightsReadyCount || rightsReadyCount === 0)) fail("imagesManifest.rightsReview.status", "권리 검증 상태에서는 활성 이미지가 모두 ready여야 합니다.");
  return value as PalworldImagesManifest;
}

export function assertPalworldPaldexReleaseManifest(value: unknown): PalworldPaldexReleaseManifest {
  const manifest = recordAt(value, "manifest", [
    "schemaVersion",
    "release",
    "generatedAt",
    "sourceLockSha256",
    "paldexSha256",
    "imagesManifestSha256",
    "importReportSha256",
    "imageUsePolicySha256",
    "imageSourceMapSha256",
    "mappingSha256",
    "counts",
    "dataIntegrityGate",
    "imageAssetGate",
    "runtimeActivation"
  ]);
  if (manifest.schemaVersion !== 1) fail("manifest.schemaVersion", "1이어야 합니다.");
  if (manifest.release !== PALWORLD_PALDEX_RELEASE) fail("manifest.release", "고정 release와 일치해야 합니다.");
  isoDateAt(manifest.generatedAt, "manifest.generatedAt");
  for (const field of ["sourceLockSha256", "paldexSha256", "imagesManifestSha256", "importReportSha256"] as const) {
    sha256At(manifest[field], `manifest.${field}`);
  }
  for (const field of ["imageUsePolicySha256", "imageSourceMapSha256"] as const) {
    if (manifest[field] !== null) sha256At(manifest[field], `manifest.${field}`);
  }
  const mappingSha256 = recordAt(manifest.mappingSha256, "manifest.mappingSha256", [
    "publicIdMap",
    "elements",
    "workSuitabilities",
    "exclusions",
    "imageOverrides"
  ]);
  for (const field of ["publicIdMap", "elements", "workSuitabilities", "exclusions", "imageOverrides"] as const) {
    sha256At(mappingSha256[field], `manifest.mappingSha256.${field}`);
  }
  const counts = recordAt(manifest.counts, "manifest.counts", ["pals", "normal", "variant", "imageMappings", "readyImages", "uniqueImageFiles"]);
  for (const field of ["pals", "normal", "variant", "imageMappings", "readyImages", "uniqueImageFiles"] as const) {
    integerAt(counts[field], `manifest.counts.${field}`, 0, PALWORLD_PALDEX_EXPECTED_COUNT);
  }
  const dataGate = recordAt(manifest.dataIntegrityGate, "manifest.dataIntegrityGate", ["passed", "status", "failures", "checks"]);
  booleanAt(dataGate.passed, "manifest.dataIntegrityGate.passed");
  if (dataGate.status !== "ready" && dataGate.status !== "invalid") fail("manifest.dataIntegrityGate.status", "허용된 상태가 아닙니다.");
  const dataFailures = assertArray(dataGate.failures, "manifest.dataIntegrityGate.failures", 64);
  dataFailures.forEach((failure, index) => stringAt(failure, `manifest.dataIntegrityGate.failures[${index}]`, 256));
  if (dataGate.passed !== (dataGate.status === "ready")) fail("manifest.dataIntegrityGate", "passed와 status가 일치해야 합니다.");
  if (dataGate.passed && dataFailures.length > 0) fail("manifest.dataIntegrityGate.failures", "ready 상태에서는 비어 있어야 합니다.");
  if (!dataGate.passed && dataFailures.length === 0) fail("manifest.dataIntegrityGate.failures", "차단 사유가 하나 이상 필요합니다.");
  const dataChecks = recordAt(dataGate.checks, "manifest.dataIntegrityGate.checks", [
    "pals",
    "normal",
    "variant",
    "missingNameKo",
    "missingNameJa",
    "missingNameEn",
    "missingRequiredStats",
    "missingBreedingPower",
    "unknownEnums",
    "idCollisions",
    "aliasCollisions",
    "sourceChecksumVerified",
    "mappingChecksumsVerified",
    "artifactChecksumsVerified"
  ]);
  for (const field of [
    "pals",
    "normal",
    "variant",
    "missingNameKo",
    "missingNameJa",
    "missingNameEn",
    "missingRequiredStats",
    "missingBreedingPower",
    "unknownEnums",
    "idCollisions",
    "aliasCollisions"
  ] as const) {
    integerAt(dataChecks[field], `manifest.dataIntegrityGate.checks.${field}`, 0, PALWORLD_PALDEX_EXPECTED_COUNT);
  }
  for (const field of ["sourceChecksumVerified", "mappingChecksumsVerified", "artifactChecksumsVerified"] as const) {
    booleanAt(dataChecks[field], `manifest.dataIntegrityGate.checks.${field}`);
  }

  const imageGate = recordAt(manifest.imageAssetGate, "manifest.imageAssetGate", [
    "passed",
    "status",
    "policyStatus",
    "failures",
    "technicalPassed",
    "publicActivationAllowed",
    "rightsVerified",
    "usageBasis",
    "readyImages",
    "fallbackPals",
    "publicNoticeRequired"
  ]);
  booleanAt(imageGate.passed, "manifest.imageAssetGate.passed");
  if (!(PALWORLD_IMAGE_ASSET_STATUSES as readonly unknown[]).includes(imageGate.status)) fail("manifest.imageAssetGate.status", "허용된 상태가 아닙니다.");
  if (!(PALWORLD_IMAGE_POLICY_STATUSES as readonly unknown[]).includes(imageGate.policyStatus)) fail("manifest.imageAssetGate.policyStatus", "허용된 정책 상태가 아닙니다.");
  const imageFailures = assertArray(imageGate.failures, "manifest.imageAssetGate.failures", 64);
  imageFailures.forEach((failure, index) => stringAt(failure, `manifest.imageAssetGate.failures[${index}]`, 256));
  for (const field of ["technicalPassed", "publicActivationAllowed", "rightsVerified", "publicNoticeRequired"] as const) {
    booleanAt(imageGate[field], `manifest.imageAssetGate.${field}`);
  }
  if (!(PALWORLD_IMAGE_USAGE_BASES as readonly unknown[]).includes(imageGate.usageBasis)) fail("manifest.imageAssetGate.usageBasis", "허용된 사용 근거가 아닙니다.");
  const readyImages = integerAt(imageGate.readyImages, "manifest.imageAssetGate.readyImages", 0, PALWORLD_PALDEX_EXPECTED_COUNT);
  const fallbackPals = integerAt(imageGate.fallbackPals, "manifest.imageAssetGate.fallbackPals", 0, PALWORLD_PALDEX_EXPECTED_COUNT);
  if (readyImages + fallbackPals !== counts.pals) fail("manifest.imageAssetGate", "readyImages와 fallbackPals의 합이 Pal 수와 일치해야 합니다.");
  if (imageGate.publicNoticeRequired !== true) fail("manifest.imageAssetGate.publicNoticeRequired", "공개 Palworld 출처 공지가 필요합니다.");
  if (imageGate.passed !== (imageGate.technicalPassed && imageGate.publicActivationAllowed)) {
    fail("manifest.imageAssetGate.passed", "기술 검증과 공개 활성화 상태가 일치해야 합니다.");
  }
  const policyStatus = imageGate.policyStatus as PalworldImagePolicyStatus;
  if (policyStatus === "missing") {
    if (manifest.imageUsePolicySha256 !== null || imageGate.usageBasis !== "none" || imageGate.status !== "blocked_by_license") {
      fail("manifest.imageAssetGate.policyStatus", "policy 누락 상태와 hash·사용 근거·차단 상태가 일치해야 합니다.");
    }
  } else if (manifest.imageUsePolicySha256 === null) {
    fail("manifest.imageUsePolicySha256", "policy 상태에는 고정 policy checksum이 필요합니다.");
  }
  if (readyImages > 0 && manifest.imageSourceMapSha256 === null) {
    fail("manifest.imageSourceMapSha256", "활성 이미지에는 고정 source mapping checksum이 필요합니다.");
  }
  if (imageGate.status === "blocked_by_license") {
    const usageMatchesPolicy = policyStatus === "operator_acknowledged"
      ? imageGate.usageBasis === "operator_reference_use"
      : policyStatus === "rights_verified"
        ? imageGate.rightsVerified && imageGate.usageBasis === "rights_verified"
        : (policyStatus === "missing" || policyStatus === "blocked_by_license") && !imageGate.rightsVerified && imageGate.usageBasis === "none";
    if (imageGate.technicalPassed || imageGate.publicActivationAllowed || !usageMatchesPolicy || readyImages !== 0 || imageFailures.length === 0) {
      fail("manifest.imageAssetGate", "차단 상태의 기술·권리·coverage 정보가 일치하지 않습니다.");
    }
  } else if (imageGate.status === "partial") {
    const partialUsageIsConsistent = policyStatus === "operator_acknowledged"
      ? !imageGate.rightsVerified && imageGate.usageBasis === "operator_reference_use"
      : policyStatus === "rights_verified" && imageGate.rightsVerified && imageGate.usageBasis === "rights_verified";
    if (!imageGate.technicalPassed || !imageGate.publicActivationAllowed || !partialUsageIsConsistent || readyImages === 0 || fallbackPals === 0 || imageFailures.length === 0) {
      fail("manifest.imageAssetGate", "partial 상태는 한 가지 사용 근거의 일부 이미지만 기술 검증을 통과해야 합니다.");
    }
  } else if (imageGate.status === "operator_acknowledged") {
    if (policyStatus !== "operator_acknowledged" || !imageGate.technicalPassed || !imageGate.publicActivationAllowed || imageGate.rightsVerified || imageGate.usageBasis !== "operator_reference_use" || fallbackPals !== 0 || imageFailures.length > 0) {
      fail("manifest.imageAssetGate", "운영자 확인 상태의 기술·권리·coverage 정보가 일치하지 않습니다.");
    }
  } else if (policyStatus !== "rights_verified" || !imageGate.technicalPassed || !imageGate.publicActivationAllowed || !imageGate.rightsVerified || imageGate.usageBasis !== "rights_verified" || fallbackPals !== 0 || imageFailures.length > 0) {
    fail("manifest.imageAssetGate", "ready 상태는 별도 권리 검증과 전체 기술 검증을 통과해야 합니다.");
  }

  const runtimeActivation = booleanAt(manifest.runtimeActivation, "manifest.runtimeActivation");
  if (runtimeActivation !== dataGate.passed) {
    fail("manifest.runtimeActivation", "dataIntegrityGate 통과 상태와 일치해야 합니다.");
  }
  return value as PalworldPaldexReleaseManifest;
}

export function palworldImageHashFromUrl(imageUrl: string): string | undefined {
  return IMAGE_URL_PATTERN.exec(imageUrl)?.[1];
}

export function palworldPaldexRecordOrder(left: PalworldPaldexRecord, right: PalworldPaldexRecord): number {
  return left.number - right.number
    || (left.variantType === right.variantType ? 0 : left.variantType === "normal" ? -1 : 1)
    || codePointCompare(left.sourceInternalId, right.sourceInternalId);
}
