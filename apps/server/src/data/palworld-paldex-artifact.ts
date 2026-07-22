import {
  PALWORLD_ELEMENTS,
  PALWORLD_WORK_SUITABILITY_TYPES,
  validatePalworldPalDetail,
  type PalworldElement,
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
  imageUrl?: string;
};

export type PalworldPaldexArtifact = {
  schemaVersion: 1;
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
  records: PalworldPaldexRecord[];
};

export type PalworldImageManifestEntry = {
  palId: string;
  sourceInternalId: string;
  status: "ready" | "blocked_by_license";
  sourceName: string;
  sourceUrl: string;
  sourceRevision: string;
  license: string;
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
  status: "ready" | "partial" | "blocked_by_license";
  rightsReview: {
    status: "approved" | "blocked_by_license";
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
    status: "ready" | "blocked_by_license";
    failures: string[];
    readyImages: number;
    fallbackPals: number;
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
  if (record.imageUrl !== undefined) {
    const imageUrl = stringAt(record.imageUrl, `${path}.imageUrl`, 256);
    if (!IMAGE_URL_PATTERN.test(imageUrl)) fail(`${path}.imageUrl`, "고정 release의 content-hash WebP 경로여야 합니다.");
  }
  return value as PalworldPaldexRecord;
}

export function assertPalworldPaldexArtifact(value: unknown): PalworldPaldexArtifact {
  const artifact = recordAt(value, "paldex", ["schemaVersion", "release", "steamBuildId", "metadata", "records"]);
  if (artifact.schemaVersion !== 1) fail("paldex.schemaVersion", "1이어야 합니다.");
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

  const records = assertArray(artifact.records, "paldex.records", PALWORLD_PALDEX_EXPECTED_COUNT);
  if (records.length !== PALWORLD_PALDEX_EXPECTED_COUNT) fail("paldex.records", `${PALWORLD_PALDEX_EXPECTED_COUNT}개여야 합니다.`);
  const validated = records.map((entry, index) => assertPalworldPaldexRecord(entry, `paldex.records[${index}]`));
  const ids = new Set<string>();
  const internalIds = new Set<string>();
  let normal = 0;
  let variant = 0;
  for (const [index, entry] of validated.entries()) {
    const sharedValidation = validatePalworldPalDetail({
      id: entry.id,
      number: entry.number,
      nameKo: entry.nameKo,
      nameJa: entry.nameJa,
      nameEn: entry.nameEn,
      ...(entry.imageUrl === undefined ? {} : { imageUrl: entry.imageUrl }),
      elements: entry.elements,
      rarity: entry.rarity,
      variantType: entry.variantType,
      workSuitabilities: entry.workSuitabilities,
      stats: entry.stats,
      nocturnal: entry.nocturnal,
      activeSkills: [],
      drops: [],
      breeding: { breedingPower: entry.breedingPower, specialParentPairs: [] },
      metadata
    });
    if (!sharedValidation.ok) fail(`paldex.records[${index}]`, `Shared PalworldPalDetail schema 검증 실패: ${sharedValidation.error}`);
    if (ids.has(entry.id)) fail(`paldex.records[${index}].id`, "중복 public ID입니다.");
    if (internalIds.has(entry.sourceInternalId)) fail(`paldex.records[${index}].sourceInternalId`, "중복 internal ID입니다.");
    ids.add(entry.id);
    internalIds.add(entry.sourceInternalId);
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
  return value as PalworldPaldexArtifact;
}

export function assertPalworldImagesManifest(value: unknown, paldex: PalworldPaldexArtifact): PalworldImagesManifest {
  const manifest = recordAt(value, "imagesManifest", ["schemaVersion", "release", "revision", "status", "rightsReview", "entries"]);
  if (manifest.schemaVersion !== 1) fail("imagesManifest.schemaVersion", "1이어야 합니다.");
  if (manifest.release !== PALWORLD_PALDEX_RELEASE) fail("imagesManifest.release", "고정 release와 일치해야 합니다.");
  stringAt(manifest.revision, "imagesManifest.revision", 256);
  if (!["ready", "partial", "blocked_by_license"].includes(String(manifest.status))) fail("imagesManifest.status", "허용된 상태가 아닙니다.");
  const rights = recordAt(manifest.rightsReview, "imagesManifest.rightsReview", ["status", "reviewedAt", "reasonCode", "evidenceUrls"]);
  if (rights.status !== "approved" && rights.status !== "blocked_by_license") fail("imagesManifest.rightsReview.status", "허용된 상태가 아닙니다.");
  isoDateAt(rights.reviewedAt, "imagesManifest.rightsReview.reviewedAt");
  stringAt(rights.reasonCode, "imagesManifest.rightsReview.reasonCode", 128);
  const evidenceUrls = assertArray(rights.evidenceUrls, "imagesManifest.rightsReview.evidenceUrls", 16);
  if (evidenceUrls.length === 0) fail("imagesManifest.rightsReview.evidenceUrls", "권리 판단 근거가 하나 이상 필요합니다.");
  evidenceUrls.forEach((url, index) => httpsUrlAt(url, `imagesManifest.rightsReview.evidenceUrls[${index}]`));

  const entries = assertArray(manifest.entries, "imagesManifest.entries", PALWORLD_PALDEX_EXPECTED_COUNT);
  if (entries.length !== paldex.records.length) fail("imagesManifest.entries", "모든 Pal의 명시적 이미지 mapping이 필요합니다.");
  const palById = new Map(paldex.records.map((pal) => [pal.id, pal]));
  const seen = new Set<string>();
  let readyCount = 0;
  let blockedCount = 0;
  for (const [index, rawEntry] of entries.entries()) {
    const path = `imagesManifest.entries[${index}]`;
    const entry = recordAt(rawEntry, path, [
      "palId",
      "sourceInternalId",
      "status",
      "sourceName",
      "sourceUrl",
      "sourceRevision",
      "license",
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
    httpsUrlAt(entry.sourceUrl, `${path}.sourceUrl`);
    stringAt(entry.sourceRevision, `${path}.sourceRevision`, 128);
    stringAt(entry.license, `${path}.license`, 256);
    stringAt(entry.originalFileName, `${path}.originalFileName`, 256);

    if (entry.status === "ready") {
      readyCount += 1;
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
      fail(`${path}.status`, "ready 또는 blocked_by_license여야 합니다.");
    }
  }
  if (manifest.status === "ready" && readyCount !== entries.length) fail("imagesManifest.status", "모든 이미지가 ready여야 합니다.");
  if (manifest.status === "blocked_by_license" && blockedCount !== entries.length) fail("imagesManifest.status", "모든 이미지가 권리 차단 상태여야 합니다.");
  if (manifest.status === "partial" && (readyCount === 0 || blockedCount === 0)) fail("imagesManifest.status", "ready와 blocked_by_license entry가 모두 있어야 합니다.");
  if (rights.status === "blocked_by_license" && readyCount > 0) fail("imagesManifest.rightsReview.status", "권리 승인 전 이미지를 포함할 수 없습니다.");
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

  const imageGate = recordAt(manifest.imageAssetGate, "manifest.imageAssetGate", ["passed", "status", "failures", "readyImages", "fallbackPals"]);
  booleanAt(imageGate.passed, "manifest.imageAssetGate.passed");
  if (imageGate.status !== "ready" && imageGate.status !== "blocked_by_license") fail("manifest.imageAssetGate.status", "허용된 상태가 아닙니다.");
  const imageFailures = assertArray(imageGate.failures, "manifest.imageAssetGate.failures", 64);
  imageFailures.forEach((failure, index) => stringAt(failure, `manifest.imageAssetGate.failures[${index}]`, 256));
  if (imageGate.passed !== (imageGate.status === "ready")) fail("manifest.imageAssetGate", "passed와 status가 일치해야 합니다.");
  if (imageGate.passed && imageFailures.length > 0) fail("manifest.imageAssetGate.failures", "ready 상태에서는 비어 있어야 합니다.");
  if (!imageGate.passed && imageFailures.length === 0) fail("manifest.imageAssetGate.failures", "차단 사유가 하나 이상 필요합니다.");
  integerAt(imageGate.readyImages, "manifest.imageAssetGate.readyImages", 0, PALWORLD_PALDEX_EXPECTED_COUNT);
  integerAt(imageGate.fallbackPals, "manifest.imageAssetGate.fallbackPals", 0, PALWORLD_PALDEX_EXPECTED_COUNT);

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
