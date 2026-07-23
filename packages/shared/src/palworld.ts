export const PALWORLD_ELEMENTS = [
  "neutral",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "ground",
  "dark",
  "dragon"
] as const;

export const PALWORLD_WORK_SUITABILITY_TYPES = [
  "kindling",
  "watering",
  "planting",
  "generating_electricity",
  "handiwork",
  "gathering",
  "lumbering",
  "mining",
  "medicine_production",
  "cooling",
  "transporting",
  "farming"
] as const;

export const PALWORLD_VARIANT_TYPES = ["normal", "variant", "special"] as const;
export const PALWORLD_SKILL_TYPES = ["partner", "active", "passive"] as const;
export const PALWORLD_LOCALIZATION_LANGUAGES = ["ko", "ja", "en"] as const;
export const PALWORLD_LOCALIZATION_FIELD_STATUSES = [
  "localized",
  "source_language_fallback",
  "unavailable"
] as const;
export const PALWORLD_TRANSLATION_LOCALES = ["ko", "ja"] as const;
export const PALWORLD_TRANSLATION_RECORD_KINDS = ["pal", "item", "skill"] as const;
export const PALWORLD_TRANSLATION_FIELDS = ["name", "description", "passiveAbility"] as const;
export const PALWORLD_TRANSLATION_STATUSES = [
  "source_provided",
  "machine_assisted",
  "human_reviewed"
] as const;
export const PALWORLD_TRANSLATION_DISPLAY_STATUSES = [
  "source_provided",
  "machine_assisted",
  "human_reviewed",
  "source_language_fallback",
  "missing_source"
] as const;
export const PALWORLD_TRANSLATION_METHODS = [
  "source_provided",
  "machine_assisted",
  "human_reviewed",
  "mixed"
] as const;
export const PALWORLD_TRANSLATION_SNAPSHOT_STATUSES = ["complete", "incomplete"] as const;
export const PALWORLD_TRANSLATION_SOURCE_ANOMALY_NOTE = "source_anomaly_preserved" as const;
export const PALWORLD_TRANSLATION_MISSING_SOURCE_MARKERS = {
  ko: "[원문 누락]",
  ja: "[原文欠落]"
} as const;
const PALWORLD_TRANSLATION_PLACEHOLDER_RESIDUE_PATTERN = /XQZ|missing\s+source\s+value|ソース値が不足|원문\s*값\s*누락/iu;
export const PALWORLD_ITEM_CATEGORIES = [
  "material",
  "consumable",
  "weapon",
  "armor",
  "accessory",
  "sphere",
  "ammo",
  "food",
  "medicine",
  "key_item",
  "building",
  "other"
] as const;
export const PALWORLD_ACQUISITION_TYPES = ["craft", "drop", "merchant", "chest", "gathering", "quest", "other"] as const;
export const PALWORLD_GENDERS = ["any", "male", "female"] as const;
export const PALWORLD_BREEDING_GENDERS = ["male", "female"] as const;
export const PALWORLD_BREEDING_RESOLUTION_STATES = [
  "resolved",
  "requires_gender",
  "not_found",
  "data_unavailable"
] as const;
export const PALWORLD_DOMAIN_STATUSES = ["ready", "sample", "incomplete"] as const;
export const PALWORLD_IMAGE_ASSET_STATUSES = [
  "blocked_by_license",
  "operator_acknowledged",
  "partial",
  "ready"
] as const;
export const PALWORLD_IMAGE_POLICY_STATUSES = [
  "missing",
  "blocked_by_license",
  "operator_acknowledged",
  "rights_verified"
] as const;
export const PALWORLD_IMAGE_USAGE_BASES = ["none", "operator_reference_use", "rights_verified"] as const;
export const PALWORLD_SOURCE_TYPES = ["operator_pak_export"] as const;
export const PALWORLD_PUBLIC_NOTICE_KO = "비공식 팰월드 데이터베이스 · 데이터/이미지 출처 Palworld · Pocketpair";
export const PALWORLD_PUBLIC_NOTICE_JA = "非公式パルワールドデータベース・データ／画像出典 Palworld・Pocketpair";

export type PalworldElement = (typeof PALWORLD_ELEMENTS)[number];
export type PalworldWorkSuitabilityType = (typeof PALWORLD_WORK_SUITABILITY_TYPES)[number];
export type PalworldVariantType = (typeof PALWORLD_VARIANT_TYPES)[number];
export type PalworldSkillType = (typeof PALWORLD_SKILL_TYPES)[number];
export type PalworldLocalizationLanguage = (typeof PALWORLD_LOCALIZATION_LANGUAGES)[number];
export type PalworldLocalizationFieldStatus = (typeof PALWORLD_LOCALIZATION_FIELD_STATUSES)[number];
export type PalworldTranslationLocale = (typeof PALWORLD_TRANSLATION_LOCALES)[number];
export type PalworldTranslationRecordKind = (typeof PALWORLD_TRANSLATION_RECORD_KINDS)[number];
export type PalworldTranslationField = (typeof PALWORLD_TRANSLATION_FIELDS)[number];
export type PalworldTranslationStatus = (typeof PALWORLD_TRANSLATION_STATUSES)[number];
export type PalworldTranslationDisplayStatus = (typeof PALWORLD_TRANSLATION_DISPLAY_STATUSES)[number];
export type PalworldTranslationMethod = (typeof PALWORLD_TRANSLATION_METHODS)[number];
export type PalworldTranslationSnapshotStatus = (typeof PALWORLD_TRANSLATION_SNAPSHOT_STATUSES)[number];
export type PalworldItemCategory = (typeof PALWORLD_ITEM_CATEGORIES)[number];
export type PalworldAcquisitionType = (typeof PALWORLD_ACQUISITION_TYPES)[number];
export type PalworldGender = (typeof PALWORLD_GENDERS)[number];
export type PalworldBreedingGender = (typeof PALWORLD_BREEDING_GENDERS)[number];
export type PalworldBreedingResolutionState = (typeof PALWORLD_BREEDING_RESOLUTION_STATES)[number];
export type PalworldDomainStatus = (typeof PALWORLD_DOMAIN_STATUSES)[number];
export type PalworldImageAssetStatus = (typeof PALWORLD_IMAGE_ASSET_STATUSES)[number];
export type PalworldImagePolicyStatus = (typeof PALWORLD_IMAGE_POLICY_STATUSES)[number];
export type PalworldImageUsageBasis = (typeof PALWORLD_IMAGE_USAGE_BASES)[number];
export type PalworldSourceType = (typeof PALWORLD_SOURCE_TYPES)[number];

export type PalworldSourceIncludedFile = {
  member: string;
  sha256: string;
  bytes: number;
};

/**
 * 운영자가 제공한 FModel export의 출처 정보입니다.
 *
 * candidate 단계에서는 검증 가능한 외부 metadata가 없을 수 있으므로 version 관련
 * 필드는 모두 null일 수 있습니다. 일부 값만 채우는 것은 validator가 거부합니다.
 */
export type PalworldOperatorPakExportProvenance = {
  id: string;
  type: "operator_pak_export";
  archiveSha256: string;
  gameVersion: string | null;
  steamBuildId: string | null;
  fmodelVersion: string | null;
  exportedAt: string | null;
  mappingsSha256: string | null;
  includedFiles?: PalworldSourceIncludedFile[];
  rightsVerified: false;
  usageBasis: "operator_reference_use";
};

export type PalworldSourceProvenance = PalworldOperatorPakExportProvenance;

export type PalworldDataMetadata = {
  gameVersion: string;
  sourceName: string;
  sourceUrl: string;
  sourceRevision: string;
  sourceChecksum?: string;
  extractedAt: string;
  verifiedAt: string;
  license: string;
  rightsVerified?: boolean;
};

export type PalworldDomainCoverage = {
  status: PalworldDomainStatus;
  recordCount: number;
  metadata: PalworldDataMetadata;
};

export type PalworldDomainCoverageMap = {
  pals: PalworldDomainCoverage;
  items: PalworldDomainCoverage;
  breeding: PalworldDomainCoverage;
  skills?: PalworldDomainCoverage;
};

export type PalworldSearchDomainCoverageMap = Pick<PalworldDomainCoverageMap, "pals" | "items">;

export type PalworldRuntimeGates = {
  dataIntegrity: {
    passed: boolean;
    status: "ready" | "unavailable";
  };
  imageAssets: {
    status: PalworldImageAssetStatus;
    policyStatus: PalworldImagePolicyStatus;
    technicalPassed: boolean;
    publicActivationAllowed: boolean;
    rightsVerified: boolean;
    usageBasis: PalworldImageUsageBasis;
    readyImages: number;
    fallbackPals: number;
    publicNoticeRequired: boolean;
  };
};

export type PalworldWorkSuitability = {
  type: PalworldWorkSuitabilityType;
  level: number;
};

export type PalworldLocalizationFallback = {
  sourceLanguage: PalworldLocalizationLanguage;
  ko: PalworldLocalizationFieldStatus;
  ja: PalworldLocalizationFieldStatus;
};

export type PalworldTranslationLocaleStatus = {
  ko: PalworldTranslationDisplayStatus;
  ja: PalworldTranslationDisplayStatus;
};

/** API 레코드의 필드별 표시 언어 상태입니다. 기존 localization 필드와 additive하게 사용합니다. */
export type PalworldTranslationDisplayState = {
  name?: PalworldTranslationLocaleStatus;
  description?: PalworldTranslationLocaleStatus;
  passiveAbility?: PalworldTranslationLocaleStatus;
  label?: PalworldTranslationLocaleStatus;
  location?: PalworldTranslationLocaleStatus;
};

export type PalworldSkill = {
  id: string;
  sourceInternalId?: string;
  type: PalworldSkillType;
  nameKo?: string;
  nameJa?: string;
  nameEn: string;
  descriptionKo?: string;
  descriptionJa?: string;
  descriptionEn?: string;
  element?: PalworldElement;
  power?: number;
  cooldownSeconds?: number;
  unlockLevel?: number;
  passiveTier?: number;
  passiveAbility?: string;
  passiveAbilityKo?: string;
  passiveAbilityJa?: string;
  localization?: PalworldLocalizationFallback;
  translation?: PalworldTranslationDisplayState;
};

export type PalworldSkillSummary = PalworldSkill & {
  relatedPalCount: number;
};

export type PalworldElementDefinition = {
  id: PalworldElement;
  nameKo: string;
  nameJa: string;
  nameEn: string;
  iconUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
};

export type PalworldPalReference = {
  id: string;
  number: number;
  nameKo: string;
  nameJa: string;
  nameEn: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  elements: PalworldElement[];
  translation?: PalworldTranslationDisplayState;
};

export type PalworldItemReference = {
  id: string;
  nameKo?: string;
  nameJa?: string;
  nameEn: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  localization?: PalworldLocalizationFallback;
  translation?: PalworldTranslationDisplayState;
};

export type PalworldPalDrop = {
  item: PalworldItemReference;
  minQuantity: number;
  maxQuantity: number;
  dropRatePercent?: number;
};

export type PalworldFacilityReference = {
  id: string;
  nameKo?: string;
  nameJa?: string;
  nameEn: string;
  localization?: PalworldLocalizationFallback;
};

export type PalworldPalSummary = PalworldPalReference & {
  rarity: number;
  variantType: PalworldVariantType;
  workSuitabilities: PalworldWorkSuitability[];
};

export type PalworldPalStats = {
  hp: number;
  attack: number;
  defense: number;
  moveSpeed: number;
  stamina: number;
  meleeAttack?: number;
  shotAttack?: number;
  walkSpeed?: number;
  runSpeed?: number;
  rideSprintSpeed?: number;
  food?: number;
};

export type PalworldPalBreedingInfo = {
  breedingPower?: number;
  specialParentPairs: Array<{
    parentAId: string;
    parentBId: string;
    parentAGender?: PalworldBreedingGender;
    parentBGender?: PalworldBreedingGender;
    parentA?: PalworldPalReference;
    parentB?: PalworldPalReference;
  }>;
};

export type PalworldPalDetail = PalworldPalSummary & {
  descriptionKo?: string;
  descriptionJa?: string;
  descriptionEn?: string;
  localization?: PalworldLocalizationFallback;
  stats: PalworldPalStats;
  nocturnal: boolean;
  partnerSkill?: PalworldSkill;
  activeSkills: PalworldSkill[];
  drops: PalworldItemReference[];
  dropDetails?: PalworldPalDrop[];
  breeding: PalworldPalBreedingInfo;
  metadata: PalworldDataMetadata;
};

export type PalworldItemSummary = PalworldItemReference & {
  category: PalworldItemCategory;
  rarity: number;
  descriptionKo?: string;
  descriptionJa?: string;
  descriptionEn?: string;
  sellPrice?: number;
  technologyLevel?: number;
};

export type PalworldCraftingMaterial = {
  item: PalworldItemReference;
  quantity: number;
};

export type PalworldItemRecipe = {
  sourceRowId: string;
  resultCount: number;
  workAmount?: number;
  materials: PalworldCraftingMaterial[];
};

export type PalworldItemTechnologyUnlock = {
  sourceRowId: string;
  unlockLevel: number;
  tier: number;
  cost: number;
};

export type PalworldAcquisitionMethod = {
  type: PalworldAcquisitionType;
  labelKo?: string;
  labelJa?: string;
  labelEn: string;
  locationKo?: string;
  locationJa?: string;
  locationEn?: string;
  localization?: PalworldLocalizationFallback;
  translation?: PalworldTranslationDisplayState;
};

export type PalworldItemDetail = PalworldItemSummary & {
  sourceInternalId?: string;
  weight?: number;
  maxStack?: number;
  durability?: number;
  localization?: PalworldLocalizationFallback;
  craftingMaterials: PalworldCraftingMaterial[];
  recipes?: PalworldItemRecipe[];
  technologyUnlocks?: PalworldItemTechnologyUnlock[];
  craftingFacility?: PalworldFacilityReference;
  dropPals: PalworldPalReference[];
  acquisitionMethods: PalworldAcquisitionMethod[];
  relatedItems: PalworldItemReference[];
  metadata: PalworldDataMetadata;
};

export type PalworldSkillAssignment = {
  pal: PalworldPalReference;
  unlockLevel?: number;
};

export type PalworldSkillDetail = PalworldSkillSummary & {
  relatedPals: PalworldSkillAssignment[];
  metadata: PalworldDataMetadata;
};

export type PalworldCoverageCount = {
  available: number;
  missing: number;
  total: number;
};

export type PalworldTranslationDomainCoverage = {
  palNames: PalworldCoverageCount;
  palDescriptions: PalworldCoverageCount;
  itemNames: PalworldCoverageCount;
  itemDescriptions: PalworldCoverageCount;
  skillNames: PalworldCoverageCount;
  skillDescriptions: PalworldCoverageCount;
  skillPassiveAbilities: PalworldCoverageCount;
  sourceProvided?: number;
  humanReviewed: number;
  machineAssisted: number;
  sourceLanguageFallback: number;
  missingSource: number;
  placeholderExcluded?: number;
  unresolvedRichText?: number;
  staleSourceHash: number;
};

export type PalworldTranslationCoverage = {
  ko: PalworldTranslationDomainCoverage;
  ja: PalworldTranslationDomainCoverage;
};

export type PalworldDataCoverage = {
  palDetails: PalworldCoverageCount;
  itemDetails: PalworldCoverageCount;
  skillDetails: PalworldCoverageCount;
  palDescriptions: PalworldCoverageCount;
  palStats: PalworldCoverageCount;
  partnerSkills: PalworldCoverageCount;
  activeSkills: PalworldCoverageCount;
  palDrops: PalworldCoverageCount;
  breedingFields: PalworldCoverageCount;
  itemDescriptions: PalworldCoverageCount;
  craftingRecipes: PalworldCoverageCount;
  craftingFacilities: PalworldCoverageCount;
  dropPals: PalworldCoverageCount;
  technologyLevels: PalworldCoverageCount;
  prices: PalworldCoverageCount;
  durability: PalworldCoverageCount;
  acquisitionMethods: PalworldCoverageCount;
  skillDescriptions: PalworldCoverageCount;
  relatedPals: PalworldCoverageCount;
  palImages: PalworldCoverageCount;
  itemImages: PalworldCoverageCount;
  elementImages: PalworldCoverageCount;
  localization: {
    ko: PalworldCoverageCount;
    ja: PalworldCoverageCount;
    en: PalworldCoverageCount;
  };
  translations?: PalworldTranslationCoverage;
};

export type PalworldTranslationFieldValue = {
  sourceSha256: string;
  /**
   * 공식 PAK locale(source_provided)의 exact message key입니다.
   * machine-assisted/human-reviewed 필드에는 사용하지 않습니다.
   */
  sourceMessageKey?: string;
  /** 공식 locale 값이 들어 있던 ZIP 내부 source member입니다. */
  sourceMember?: string;
  /** sourceMember 원본 bytes의 SHA-256입니다. */
  sourceMemberSha256?: string;
  text: string;
  status: PalworldTranslationStatus;
  note?: string;
};

export type PalworldTranslationRecord = {
  id: string;
  kind: PalworldTranslationRecordKind;
  fields: Partial<Record<PalworldTranslationField, PalworldTranslationFieldValue>>;
};

export type PalworldTranslationMetadata = {
  schemaVersion: 1;
  release: string;
  locale: PalworldTranslationLocale;
  sourceCatalogSha256: string;
  sourcePaldexSha256: string;
  sourceRevision: string;
  translationRevision: string;
  translationMethod: PalworldTranslationMethod;
  translationStatus: PalworldTranslationSnapshotStatus;
  translatedAt: string;
  reviewedAt: string | null;
};

export type PalworldTranslationSnapshot = PalworldTranslationMetadata & {
  records: PalworldTranslationRecord[];
};

export type PalworldTranslationSourceField = {
  text: string;
  sha256: string;
};

export type PalworldTranslationSourceRecord = {
  id: string;
  kind: PalworldTranslationRecordKind;
  fields: Partial<Record<PalworldTranslationField, PalworldTranslationSourceField>>;
};

/**
 * 공식 PAK locale을 canonical 공개 ID에 exact join한 검증 context입니다.
 *
 * `textSha256`은 정규화된 locale 값의 SHA-256이며, `sourceMemberSha256`은
 * FModel export JSON member 원본 bytes의 SHA-256입니다.
 */
export type PalworldTranslationOfficialSourceField = {
  locale: PalworldTranslationLocale;
  kind: PalworldTranslationRecordKind;
  id: string;
  field: PalworldTranslationField;
  messageKey: string;
  text: string;
  textSha256: string;
  sourceMember: string;
  sourceMemberSha256: string;
};

/**
 * locale artifact를 canonical 영어 source와 의미 검증할 때 사용하는 고정 context입니다.
 * englishCopyAllowlist는 `kind:id:field` exact key만 허용합니다.
 */
export type PalworldTranslationValidationContext = {
  release: string;
  sourceCatalogSha256: string;
  sourcePaldexSha256: string;
  sourceRevision: string;
  records: readonly PalworldTranslationSourceRecord[];
  officialSourceFields?: readonly PalworldTranslationOfficialSourceField[];
  englishCopyAllowlist?: readonly string[];
};

export type PalworldBreedingPalParameters = {
  palId: string;
  sourceRowId?: string;
  sourceInternalId: string;
  tribe: string;
  bpClass?: string;
  combiRank: number;
  combiDuplicatePriority: number;
  ignoreCombi?: boolean;
  maleProbability: number;
  variantType: Extract<PalworldVariantType, "normal" | "variant">;
};

export type PalworldBreedingSpecialRule = {
  parentAId: string;
  parentASourceInternalId: string;
  parentBId: string;
  parentBSourceInternalId: string;
  childId: string;
  childSourceInternalId: string;
  parentAGender?: PalworldBreedingGender;
  parentBGender?: PalworldBreedingGender;
};

export type PalworldBreedingDataSnapshot = {
  schemaVersion: 1;
  release: string;
  metadata: {
    gameVersion: string;
    steamBuildId: string;
    sourceRevision: string;
  } & (
    | {
        sourceType?: "legacy_catalog";
        sourceChecksums: {
          atlasPals: string;
          atlasBreeding: string;
          palCalc: string;
          catalog: string;
        };
      }
    | {
        sourceType: "operator_pak_export";
        sourceChecksums: {
          archive: string;
          breedingArtifact: string;
        };
      }
  );
  parameters: PalworldBreedingPalParameters[];
  specialRules: PalworldBreedingSpecialRule[];
};

export type PalworldBreedingPair = {
  id: string;
  parentA: PalworldPalReference;
  parentB: PalworldPalReference;
  child: PalworldPalReference;
  isSpecial: boolean;
  genderCondition?: {
    parentA: PalworldGender;
    parentB: PalworldGender;
  };
};

export type PalworldSearchResult = {
  query: string;
  total: number;
  pals: PalworldPalSummary[];
  items: PalworldItemSummary[];
  metadata: PalworldDataMetadata;
  domains: PalworldSearchDomainCoverageMap;
};

export type PalworldPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type PalworldPaginatedResponse<T> = {
  items: T[];
  pagination: PalworldPagination;
  metadata: PalworldDataMetadata;
};

export type PalworldMetaResponse = {
  metadata: PalworldDataMetadata;
  counts: {
    pals: number;
    items: number;
    breedingPairs: number;
    skills?: number;
  };
  domains: PalworldDomainCoverageMap;
  gates: PalworldRuntimeGates;
  coverage?: PalworldDataCoverage;
};

export type PalworldBreedingResultResponse = {
  parentA: PalworldPalReference;
  parentB: PalworldPalReference;
  result: PalworldBreedingPair | null;
  state: PalworldBreedingResolutionState;
  alternatives: PalworldBreedingPair[];
  metadata: PalworldDataMetadata;
};

export type PalworldBreedingParentsResponse = PalworldPaginatedResponse<PalworldBreedingPair> & {
  child: PalworldPalReference;
  state: Exclude<PalworldBreedingResolutionState, "requires_gender">;
};

export type PalworldDataSnapshot = {
  metadata: PalworldDataMetadata;
  pals: PalworldPalDetail[];
  items: PalworldItemDetail[];
  breedingPairs: PalworldBreedingPair[];
  skills?: PalworldSkillDetail[];
  elements?: PalworldElementDefinition[];
};

export type PalworldValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type PalworldValidator<T> = (value: unknown) => PalworldValidationResult<T>;

const MAX_ID_LENGTH = 80;
const MAX_NAME_LENGTH = 256;
const MAX_DESCRIPTION_LENGTH = 4_000;
const MAX_URL_LENGTH = 2_048;
const MAX_API_COLLECTION_SIZE = 200;
const MAX_SNAPSHOT_COLLECTION_SIZE = 100_000;
const MAX_RARITY = 20;
const MAX_WORK_LEVEL = 8;
const MAX_STAT_VALUE = 1_000_000;
const MAX_RELATED_PALS = 10_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const PALWORLD_TRANSLATION_MESSAGE_KEY_PATTERN = /^[A-Za-z0-9_]+$/u;
const PALWORLD_SKILL_KEYS = [
  "id",
  "sourceInternalId",
  "type",
  "nameKo",
  "nameJa",
  "nameEn",
  "descriptionKo",
  "descriptionJa",
  "descriptionEn",
  "element",
  "power",
  "cooldownSeconds",
  "unlockLevel",
  "passiveTier",
  "passiveAbility",
  "passiveAbilityKo",
  "passiveAbilityJa",
  "localization",
  "translation"
] as const;

function valid<T>(data: T): PalworldValidationResult<T> {
  return { ok: true, data };
}

function invalid<T>(path: string, message: string): PalworldValidationResult<T> {
  return { ok: false, error: `${path}: ${message}` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function recordAt(value: unknown, path: string, allowedKeys: readonly string[]): PalworldValidationResult<Record<string, unknown>> {
  if (!isRecord(value)) return invalid(path, "객체여야 합니다.");
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) return invalid(`${path}.${key}`, "허용되지 않은 필드입니다.");
  }
  return valid(value);
}

function stringAt(value: unknown, path: string, maxLength = MAX_NAME_LENGTH, allowEmpty = false): PalworldValidationResult<string> {
  if (typeof value !== "string") return invalid(path, "문자열이어야 합니다.");
  if (!allowEmpty && value.trim().length === 0) return invalid(path, "비어 있지 않은 문자열이어야 합니다.");
  if (value.length > maxLength) return invalid(path, `${maxLength}자 이하여야 합니다.`);
  return valid(value);
}

function optionalStringAt(value: unknown, path: string, maxLength = MAX_NAME_LENGTH): PalworldValidationResult<string | undefined> {
  return value === undefined ? valid(undefined) : stringAt(value, path, maxLength);
}

function idAt(value: unknown, path: string): PalworldValidationResult<string> {
  const result = stringAt(value, path, MAX_ID_LENGTH);
  if (!result.ok) return result;
  if (!/^[a-z0-9][a-z0-9_-]*$/u.test(result.data)) {
    return invalid(path, "소문자 영문·숫자로 시작하고 소문자 영문·숫자·_·-만 포함해야 합니다.");
  }
  return result;
}

function translationMessageKeyAt(
  value: unknown,
  path: string
): PalworldValidationResult<string> {
  const result = stringAt(value, path, 192);
  if (!result.ok) return result;
  return PALWORLD_TRANSLATION_MESSAGE_KEY_PATTERN.test(result.data)
    ? result
    : invalid(path, "영문·숫자·_로 구성된 exact locale message key여야 합니다.");
}

function translationSourceMemberAt(
  value: unknown,
  path: string
): PalworldValidationResult<string> {
  const result = stringAt(value, path, 512);
  if (!result.ok) return result;
  if (
    result.data.trim() !== result.data
    || result.data.startsWith("/")
    || /[\u0000-\u001f\u007f\\%]/u.test(result.data)
    || result.data.includes("//")
    || result.data.split("/").some((segment) =>
      segment.length === 0 || segment === "." || segment === ".."
    )
  ) {
    return invalid(path, "archive 내부의 안전한 정규 상대 경로여야 합니다.");
  }
  return result;
}

function sourceInternalIdAt(value: unknown, path: string): PalworldValidationResult<string> {
  const result = stringAt(value, path, MAX_ID_LENGTH);
  if (!result.ok) return result;
  return /^[A-Za-z0-9_]+$/u.test(result.data)
    ? result
    : invalid(path, "영문·숫자·_로 구성된 고정 원본 internal ID여야 합니다.");
}

function finiteNumberAt(value: unknown, path: string, min: number, max: number): PalworldValidationResult<number> {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return invalid(path, `${min} 이상 ${max} 이하 숫자여야 합니다.`);
  }
  return valid(value);
}

function integerAt(value: unknown, path: string, min: number, max: number): PalworldValidationResult<number> {
  const result = finiteNumberAt(value, path, min, max);
  if (!result.ok) return result;
  return Number.isInteger(result.data) ? valid(result.data) : invalid(path, "정수여야 합니다.");
}

function booleanAt(value: unknown, path: string): PalworldValidationResult<boolean> {
  return typeof value === "boolean" ? valid(value) : invalid(path, "boolean이어야 합니다.");
}

function enumAt<T extends readonly string[]>(value: unknown, path: string, values: T): PalworldValidationResult<T[number]> {
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) {
    return invalid(path, "허용 목록에 없는 값입니다.");
  }
  return valid(value as T[number]);
}

function isoDateAt(value: unknown, path: string): PalworldValidationResult<string> {
  const stringResult = stringAt(value, path, 64);
  if (!stringResult.ok) return stringResult;
  return Number.isNaN(Date.parse(stringResult.data)) ? invalid(path, "올바른 날짜 문자열이어야 합니다.") : stringResult;
}

function httpsUrlAt(value: unknown, path: string): PalworldValidationResult<string> {
  const stringResult = stringAt(value, path, MAX_URL_LENGTH);
  if (!stringResult.ok) return stringResult;
  try {
    const parsed = new URL(stringResult.data);
    return parsed.protocol === "https:" ? stringResult : invalid(path, "https URL이어야 합니다.");
  } catch {
    return invalid(path, "올바른 URL이어야 합니다.");
  }
}

const PALWORLD_PAL_IMAGE_PATH_PATTERN = /^\/images\/palworld\/((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\/pals\/[a-f0-9]{64}\.webp$/u;
const PALWORLD_ITEM_IMAGE_PATH_PATTERN = /^\/images\/palworld\/((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\/items\/[a-f0-9]{64}\.webp$/u;
const PALWORLD_ELEMENT_IMAGE_PATH_PATTERN = /^\/images\/palworld\/((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\/elements\/[a-f0-9]{64}\.webp$/u;

function palImageVersion(value: string): string | undefined {
  return value.match(PALWORLD_PAL_IMAGE_PATH_PATTERN)?.[1];
}

function itemImageVersion(value: string): string | undefined {
  return value.match(PALWORLD_ITEM_IMAGE_PATH_PATTERN)?.[1];
}

function elementImageVersion(value: string): string | undefined {
  return value.match(PALWORLD_ELEMENT_IMAGE_PATH_PATTERN)?.[1];
}

function optionalPalImagePathAt(value: unknown, path: string): PalworldValidationResult<string | undefined> {
  if (value === undefined) return valid(undefined);
  const stringResult = stringAt(value, path, MAX_URL_LENGTH);
  if (!stringResult.ok) return stringResult;
  return palImageVersion(stringResult.data) === undefined
    ? invalid(path, "Pal 이미지는 버전과 SHA-256 content hash가 포함된 허용 경로의 WebP 파일이어야 합니다.")
    : stringResult;
}

function optionalItemImagePathAt(value: unknown, path: string): PalworldValidationResult<string | undefined> {
  if (value === undefined) return valid(undefined);
  const stringResult = stringAt(value, path, MAX_URL_LENGTH);
  if (!stringResult.ok) return stringResult;
  return itemImageVersion(stringResult.data) === undefined
    ? invalid(path, "고정 버전의 동일 출처 item content-hash WebP 경로여야 합니다.")
    : stringResult;
}

function optionalElementImagePathAt(value: unknown, path: string): PalworldValidationResult<string | undefined> {
  if (value === undefined) return valid(undefined);
  const stringResult = stringAt(value, path, MAX_URL_LENGTH);
  if (!stringResult.ok) return stringResult;
  return elementImageVersion(stringResult.data) === undefined
    ? invalid(path, "속성 아이콘은 버전과 SHA-256 content hash가 포함된 허용 경로의 WebP 파일이어야 합니다.")
    : stringResult;
}

function validateOptionalImageDimensionsAt(
  record: Record<string, unknown>,
  path: string,
  imageField: "imageUrl" | "iconUrl"
): PalworldValidationResult<true> {
  const hasWidth = record.imageWidth !== undefined;
  const hasHeight = record.imageHeight !== undefined;
  if (hasWidth !== hasHeight) {
    return invalid(path, "imageWidth와 imageHeight는 함께 제공해야 합니다.");
  }
  if (!hasWidth) return valid(true);
  if (record[imageField] === undefined) {
    return invalid(path, `${imageField} 없이 이미지 크기만 제공할 수 없습니다.`);
  }
  const width = integerAt(record.imageWidth, `${path}.imageWidth`, 1, 8_192);
  if (!width.ok) return width;
  const height = integerAt(record.imageHeight, `${path}.imageHeight`, 1, 8_192);
  return height.ok ? valid(true) : height;
}

function arrayAt<T>(
  value: unknown,
  path: string,
  maxLength: number,
  validator: (entry: unknown, path: string) => PalworldValidationResult<T>
): PalworldValidationResult<T[]> {
  if (!Array.isArray(value)) return invalid(path, "배열이어야 합니다.");
  if (value.length > maxLength) return invalid(path, `최대 ${maxLength}개까지 허용됩니다.`);
  for (const [index, entry] of value.entries()) {
    const result = validator(entry, `${path}[${index}]`);
    if (!result.ok) return result;
  }
  return valid(value as T[]);
}

function uniqueStringsAt(values: readonly string[], path: string, label: string): PalworldValidationResult<true> {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value)) return invalid(`${path}[${index}]`, `중복 ${label}입니다: ${value}`);
    seen.add(value);
  }
  return valid(true);
}

function validateMetadataAt(value: unknown, path: string): PalworldValidationResult<PalworldDataMetadata> {
  const record = recordAt(value, path, [
    "gameVersion",
    "sourceName",
    "sourceUrl",
    "sourceRevision",
    "sourceChecksum",
    "extractedAt",
    "verifiedAt",
    "license",
    "rightsVerified"
  ]);
  if (!record.ok) return record;
  const candidate = record.data;
  for (const field of ["gameVersion", "sourceName", "sourceRevision", "license"] as const) {
    const result = stringAt(candidate[field], `${path}.${field}`);
    if (!result.ok) return result;
  }
  const sourceUrl = httpsUrlAt(candidate.sourceUrl, `${path}.sourceUrl`);
  if (!sourceUrl.ok) return sourceUrl;
  if (candidate.sourceChecksum !== undefined) {
    const checksum = stringAt(candidate.sourceChecksum, `${path}.sourceChecksum`, 64);
    if (!checksum.ok) return checksum;
    if (!SHA256_PATTERN.test(checksum.data)) {
      return invalid(`${path}.sourceChecksum`, "소문자 64자리 SHA-256 hex여야 합니다.");
    }
  }
  for (const field of ["extractedAt", "verifiedAt"] as const) {
    const result = isoDateAt(candidate[field], `${path}.${field}`);
    if (!result.ok) return result;
  }
  if (candidate.rightsVerified !== undefined) {
    const rightsVerified = booleanAt(candidate.rightsVerified, `${path}.rightsVerified`);
    if (!rightsVerified.ok) return rightsVerified;
  }
  return valid(candidate as PalworldDataMetadata);
}

function validateSourceProvenanceAt(
  value: unknown,
  path: string
): PalworldValidationResult<PalworldSourceProvenance> {
  const record = recordAt(value, path, [
    "id",
    "type",
    "archiveSha256",
    "gameVersion",
    "steamBuildId",
    "fmodelVersion",
    "exportedAt",
    "mappingsSha256",
    "includedFiles",
    "rightsVerified",
    "usageBasis"
  ]);
  if (!record.ok) return record;
  for (const field of [
    "id",
    "type",
    "archiveSha256",
    "gameVersion",
    "steamBuildId",
    "fmodelVersion",
    "exportedAt",
    "mappingsSha256",
    "rightsVerified",
    "usageBasis"
  ] as const) {
    if (!Object.hasOwn(record.data, field)) {
      return invalid(`${path}.${field}`, "필수 필드입니다.");
    }
  }

  const id = stringAt(record.data.id, `${path}.id`, 96);
  if (!id.ok) return id;
  if (!/^operator_pak_export:[a-f0-9]{16,64}$/u.test(id.data)) {
    return invalid(`${path}.id`, "operator_pak_export와 source checksum으로 만든 고정 ID여야 합니다.");
  }
  const type = enumAt(record.data.type, `${path}.type`, PALWORLD_SOURCE_TYPES);
  if (!type.ok) return type;
  const archiveSha256 = stringAt(record.data.archiveSha256, `${path}.archiveSha256`, 64);
  if (!archiveSha256.ok) return archiveSha256;
  if (!SHA256_PATTERN.test(archiveSha256.data)) {
    return invalid(`${path}.archiveSha256`, "소문자 64자리 SHA-256 hex여야 합니다.");
  }
  if (id.data !== `operator_pak_export:${archiveSha256.data.slice(0, 16)}`) {
    return invalid(
      `${path}.id`,
      "archiveSha256 앞 16자리에서 만든 고정 provenance ID여야 합니다."
    );
  }

  const metadataFields = [
    "gameVersion",
    "steamBuildId",
    "fmodelVersion",
    "exportedAt",
    "mappingsSha256"
  ] as const;
  const nullMetadataCount = metadataFields.filter((field) => record.data[field] === null).length;
  if (nullMetadataCount !== 0 && nullMetadataCount !== metadataFields.length) {
    return invalid(path, "버전 metadata는 모두 제공하거나 candidate에서 모두 null로 유지해야 합니다.");
  }
  if (nullMetadataCount === 0) {
    const gameVersion = stringAt(record.data.gameVersion, `${path}.gameVersion`, 64);
    if (!gameVersion.ok) return gameVersion;
    if (!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/u.test(gameVersion.data)) {
      return invalid(`${path}.gameVersion`, "제어문자와 공백이 없는 고정 게임 버전이어야 합니다.");
    }
    const steamBuildId = stringAt(record.data.steamBuildId, `${path}.steamBuildId`, 20);
    if (!steamBuildId.ok) return steamBuildId;
    if (!/^[1-9][0-9]{0,19}$/u.test(steamBuildId.data)) {
      return invalid(`${path}.steamBuildId`, "0으로 시작하지 않는 숫자 Steam Build ID여야 합니다.");
    }
    const exportedAt = isoDateAt(record.data.exportedAt, `${path}.exportedAt`);
    if (!exportedAt.ok) return exportedAt;
    const mappingsSha256 = stringAt(record.data.mappingsSha256, `${path}.mappingsSha256`, 64);
    if (!mappingsSha256.ok) return mappingsSha256;
    if (!SHA256_PATTERN.test(mappingsSha256.data)) {
      return invalid(`${path}.mappingsSha256`, "소문자 64자리 SHA-256 hex여야 합니다.");
    }
  }
  if (record.data.fmodelVersion !== null) {
    const fmodelVersion = stringAt(record.data.fmodelVersion, `${path}.fmodelVersion`, 64);
    if (!fmodelVersion.ok) return fmodelVersion;
    if (!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/u.test(fmodelVersion.data)) {
      return invalid(`${path}.fmodelVersion`, "제어문자와 공백이 없는 고정 FModel 버전이어야 합니다.");
    }
  }

  if (record.data.includedFiles !== undefined) {
    const includedFiles = arrayAt<PalworldSourceIncludedFile>(
      record.data.includedFiles,
      `${path}.includedFiles`,
      MAX_SNAPSHOT_COLLECTION_SIZE,
      (entry, entryPath) => {
        const file = recordAt(entry, entryPath, ["member", "sha256", "bytes"]);
        if (!file.ok) return file;
        for (const field of ["member", "sha256", "bytes"] as const) {
          if (!Object.hasOwn(file.data, field)) return invalid(`${entryPath}.${field}`, "필수 필드입니다.");
        }
        const member = stringAt(file.data.member, `${entryPath}.member`, 512);
        if (!member.ok) return member;
        if (
          member.data.trim() !== member.data
          || /[\u0000-\u001f\u007f\\%]/u.test(member.data)
          || member.data.startsWith("/")
          || member.data.includes("//")
          || member.data.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
        ) {
          return invalid(`${entryPath}.member`, "archive 내부의 안전한 정규 상대 경로여야 합니다.");
        }
        const sha256 = stringAt(file.data.sha256, `${entryPath}.sha256`, 64);
        if (!sha256.ok) return sha256;
        if (!SHA256_PATTERN.test(sha256.data)) {
          return invalid(`${entryPath}.sha256`, "소문자 64자리 SHA-256 hex여야 합니다.");
        }
        const bytes = integerAt(file.data.bytes, `${entryPath}.bytes`, 0, 1_073_741_824);
        return bytes.ok ? valid(file.data as PalworldSourceIncludedFile) : bytes;
      }
    );
    if (!includedFiles.ok) return includedFiles;
    let previousMember: string | undefined;
    for (const [index, file] of includedFiles.data.entries()) {
      if (previousMember !== undefined && file.member <= previousMember) {
        return invalid(
          `${path}.includedFiles[${index}].member`,
          "중복 없이 member 오름차순으로 정렬되어야 합니다."
        );
      }
      previousMember = file.member;
    }
  }

  if (record.data.rightsVerified !== false) {
    return invalid(`${path}.rightsVerified`, "operator PAK export는 권리 확인 완료로 표시할 수 없습니다.");
  }
  if (record.data.usageBasis !== "operator_reference_use") {
    return invalid(`${path}.usageBasis`, "operator_reference_use여야 합니다.");
  }
  return valid(record.data as PalworldSourceProvenance);
}

function validateLocalizationFallbackAt(
  value: unknown,
  path: string
): PalworldValidationResult<PalworldLocalizationFallback> {
  const record = recordAt(value, path, ["sourceLanguage", "ko", "ja"]);
  if (!record.ok) return record;
  const sourceLanguage = enumAt(record.data.sourceLanguage, `${path}.sourceLanguage`, PALWORLD_LOCALIZATION_LANGUAGES);
  if (!sourceLanguage.ok) return sourceLanguage;
  for (const field of ["ko", "ja"] as const) {
    const status = enumAt(record.data[field], `${path}.${field}`, PALWORLD_LOCALIZATION_FIELD_STATUSES);
    if (!status.ok) return status;
  }
  return valid(record.data as PalworldLocalizationFallback);
}

function validateTranslationLocaleStatusAt(
  value: unknown,
  path: string,
  availability: { ko: boolean; ja: boolean; en: boolean }
): PalworldValidationResult<PalworldTranslationLocaleStatus> {
  const record = recordAt(value, path, ["ko", "ja"]);
  if (!record.ok) return record;
  for (const locale of PALWORLD_TRANSLATION_LOCALES) {
    const status = enumAt(record.data[locale], `${path}.${locale}`, PALWORLD_TRANSLATION_DISPLAY_STATUSES);
    if (!status.ok) return status;
    if (
      (status.data === "human_reviewed" || status.data === "machine_assisted")
      && (!availability.en || !availability[locale])
    ) {
      return invalid(`${path}.${locale}`, "번역 상태에는 영어 원문과 해당 언어 값이 모두 필요합니다.");
    }
    if (status.data === "source_provided" && !availability[locale]) {
      return invalid(`${path}.${locale}`, "공식 source locale 상태에는 해당 언어 값이 필요합니다.");
    }
    if (status.data === "source_language_fallback" && (!availability.en || availability[locale])) {
      return invalid(`${path}.${locale}`, "영문 원문 fallback에는 영어 값이 있고 해당 언어 값은 없어야 합니다.");
    }
    if (status.data === "missing_source" && (availability.en || availability[locale])) {
      return invalid(`${path}.${locale}`, "원문과 번역이 모두 없을 때만 missing_source를 사용할 수 있습니다.");
    }
  }
  return valid(record.data as PalworldTranslationLocaleStatus);
}

function validateTranslationDisplayStateAt(
  value: unknown,
  path: string,
  allowedFields: readonly (keyof PalworldTranslationDisplayState)[],
  requiredField: keyof PalworldTranslationDisplayState,
  availability: Partial<Record<keyof PalworldTranslationDisplayState, { ko: boolean; ja: boolean; en: boolean }>>
): PalworldValidationResult<PalworldTranslationDisplayState> {
  const record = recordAt(value, path, allowedFields);
  if (!record.ok) return record;
  if (record.data[requiredField] === undefined) {
    return invalid(`${path}.${requiredField}`, "필수 번역 표시 상태가 필요합니다.");
  }
  for (const field of allowedFields) {
    if (record.data[field] === undefined) continue;
    const fieldAvailability = availability[field];
    if (fieldAvailability === undefined) return invalid(`${path}.${field}`, "허용되지 않은 번역 필드입니다.");
    const status = validateTranslationLocaleStatusAt(record.data[field], `${path}.${field}`, fieldAvailability);
    if (!status.ok) return status;
  }
  return valid(record.data as PalworldTranslationDisplayState);
}

function validateDomainCoverageAt(value: unknown, path: string): PalworldValidationResult<PalworldDomainCoverage> {
  const record = recordAt(value, path, ["status", "recordCount", "metadata"]);
  if (!record.ok) return record;
  const status = enumAt(record.data.status, `${path}.status`, PALWORLD_DOMAIN_STATUSES);
  if (!status.ok) return status;
  const recordCount = integerAt(record.data.recordCount, `${path}.recordCount`, 0, 100_000_000);
  if (!recordCount.ok) return recordCount;
  const metadata = validateMetadataAt(record.data.metadata, `${path}.metadata`);
  return metadata.ok ? valid(record.data as PalworldDomainCoverage) : metadata;
}

function validateWorkSuitabilityAt(value: unknown, path: string): PalworldValidationResult<PalworldWorkSuitability> {
  const record = recordAt(value, path, ["type", "level"]);
  if (!record.ok) return record;
  const type = enumAt(record.data.type, `${path}.type`, PALWORLD_WORK_SUITABILITY_TYPES);
  if (!type.ok) return type;
  const level = integerAt(record.data.level, `${path}.level`, 1, MAX_WORK_LEVEL);
  return level.ok ? valid(record.data as PalworldWorkSuitability) : level;
}

function validateLocalizationConsistencyAt(
  localization: PalworldLocalizationFallback,
  path: string,
  availability: { ko: boolean; ja: boolean; en: boolean }
): PalworldValidationResult<PalworldLocalizationFallback> {
  for (const locale of ["ko", "ja"] as const) {
    const status = localization[locale];
    if (status === "localized" && !availability[locale]) {
      return invalid(`${path}.${locale}`, "localized 상태에는 해당 언어 데이터가 필요합니다.");
    }
    if (status === "source_language_fallback") {
      if (localization.sourceLanguage === locale) {
        return invalid(`${path}.${locale}`, "원문 언어와 같은 언어에는 fallback 상태를 사용할 수 없습니다.");
      }
      if (!availability[localization.sourceLanguage]) {
        return invalid(`${path}.${locale}`, "fallback에 사용할 원문 언어 데이터가 필요합니다.");
      }
    }
  }
  return valid(localization);
}

function validateSkillAt(value: unknown, path: string): PalworldValidationResult<PalworldSkill> {
  const record = recordAt(value, path, PALWORLD_SKILL_KEYS);
  if (!record.ok) return record;
  const candidate = record.data;
  const id = idAt(candidate.id, `${path}.id`);
  if (!id.ok) return id;
  if (candidate.sourceInternalId !== undefined) {
    const sourceInternalId = sourceInternalIdAt(
      candidate.sourceInternalId,
      `${path}.sourceInternalId`
    );
    if (!sourceInternalId.ok) return sourceInternalId;
  }
  const type = enumAt(candidate.type, `${path}.type`, PALWORLD_SKILL_TYPES);
  if (!type.ok) return type;
  const nameEn = stringAt(candidate.nameEn, `${path}.nameEn`);
  if (!nameEn.ok) return nameEn;
  for (const field of ["nameKo", "nameJa"] as const) {
    const result = optionalStringAt(candidate[field], `${path}.${field}`);
    if (!result.ok) return result;
  }
  for (const field of ["descriptionKo", "descriptionJa"] as const) {
    const result = optionalStringAt(candidate[field], `${path}.${field}`, MAX_DESCRIPTION_LENGTH);
    if (!result.ok) return result;
  }
  const descriptionEn = optionalStringAt(candidate.descriptionEn, `${path}.descriptionEn`, MAX_DESCRIPTION_LENGTH);
  if (!descriptionEn.ok) return descriptionEn;
  const hasAnyDescription = candidate.descriptionKo !== undefined
    || candidate.descriptionJa !== undefined
    || candidate.descriptionEn !== undefined;
  if (candidate.element !== undefined) {
    const element = enumAt(candidate.element, `${path}.element`, PALWORLD_ELEMENTS);
    if (!element.ok) return element;
  }
  for (const [field, max] of [
    ["power", MAX_STAT_VALUE],
    ["cooldownSeconds", 3_600]
  ] as const) {
    if (candidate[field] !== undefined) {
      const result = finiteNumberAt(candidate[field], `${path}.${field}`, 0, max);
      if (!result.ok) return result;
    }
  }
  if (candidate.unlockLevel !== undefined) {
    const unlockLevel = integerAt(candidate.unlockLevel, `${path}.unlockLevel`, 0, 100);
    if (!unlockLevel.ok) return unlockLevel;
  }
  if (candidate.passiveTier !== undefined) {
    if (type.data !== "passive") return invalid(`${path}.passiveTier`, "passive 스킬에만 사용할 수 있습니다.");
    const passiveTier = integerAt(candidate.passiveTier, `${path}.passiveTier`, -10, 10);
    if (!passiveTier.ok) return passiveTier;
  }
  if (candidate.passiveAbility !== undefined) {
    if (type.data !== "passive") return invalid(`${path}.passiveAbility`, "passive 스킬에만 사용할 수 있습니다.");
    const passiveAbility = stringAt(candidate.passiveAbility, `${path}.passiveAbility`, MAX_DESCRIPTION_LENGTH);
    if (!passiveAbility.ok) return passiveAbility;
  }
  for (const field of ["passiveAbilityKo", "passiveAbilityJa"] as const) {
    if (candidate[field] === undefined) continue;
    if (type.data !== "passive") return invalid(`${path}.${field}`, "passive 스킬에만 사용할 수 있습니다.");
    const passiveAbility = stringAt(candidate[field], `${path}.${field}`, MAX_DESCRIPTION_LENGTH);
    if (!passiveAbility.ok) return passiveAbility;
  }
  if (candidate.localization !== undefined) {
    const localization = validateLocalizationFallbackAt(candidate.localization, `${path}.localization`);
    if (!localization.ok) return localization;
    const consistent = validateLocalizationConsistencyAt(localization.data, `${path}.localization`, {
      ko: candidate.nameKo !== undefined && (!hasAnyDescription || candidate.descriptionKo !== undefined),
      ja: candidate.nameJa !== undefined && (!hasAnyDescription || candidate.descriptionJa !== undefined),
      en: candidate.nameEn !== undefined && (!hasAnyDescription || candidate.descriptionEn !== undefined)
    });
    if (!consistent.ok) return consistent;
  } else if (
    candidate.nameKo === undefined ||
    candidate.nameJa === undefined ||
    candidate.descriptionKo === undefined ||
    candidate.descriptionJa === undefined
  ) {
    return invalid(`${path}.localization`, "한국어·일본어 데이터가 없으면 fallback 상태를 명시해야 합니다.");
  }
  if (candidate.translation !== undefined) {
    const translation = validateTranslationDisplayStateAt(
      candidate.translation,
      `${path}.translation`,
      ["name", "description", "passiveAbility"],
      "name",
      {
        name: { ko: candidate.nameKo !== undefined, ja: candidate.nameJa !== undefined, en: true },
        description: {
          ko: candidate.descriptionKo !== undefined,
          ja: candidate.descriptionJa !== undefined,
          en: candidate.descriptionEn !== undefined
        },
        passiveAbility: {
          ko: candidate.passiveAbilityKo !== undefined,
          ja: candidate.passiveAbilityJa !== undefined,
          en: candidate.passiveAbility !== undefined
        }
      }
    );
    if (!translation.ok) return translation;
  }
  return valid(candidate as PalworldSkill);
}

function validatePalReferenceAt(value: unknown, path: string): PalworldValidationResult<PalworldPalReference> {
  const record = recordAt(value, path, [
    "id",
    "number",
    "nameKo",
    "nameJa",
    "nameEn",
    "imageUrl",
    "imageWidth",
    "imageHeight",
    "elements",
    "translation"
  ]);
  if (!record.ok) return record;
  const candidate = record.data;
  const id = idAt(candidate.id, `${path}.id`);
  if (!id.ok) return id;
  const number = integerAt(candidate.number, `${path}.number`, 1, 10_000);
  if (!number.ok) return number;
  for (const field of ["nameKo", "nameJa", "nameEn"] as const) {
    const result = stringAt(candidate[field], `${path}.${field}`);
    if (!result.ok) return result;
  }
  const imageUrl = optionalPalImagePathAt(candidate.imageUrl, `${path}.imageUrl`);
  if (!imageUrl.ok) return imageUrl;
  const dimensions = validateOptionalImageDimensionsAt(candidate, path, "imageUrl");
  if (!dimensions.ok) return dimensions;
  const elements = arrayAt(candidate.elements, `${path}.elements`, 2, (entry, entryPath) =>
    enumAt(entry, entryPath, PALWORLD_ELEMENTS)
  );
  if (!elements.ok) return elements;
  if (elements.data.length === 0) return invalid(`${path}.elements`, "하나 이상의 속성이 필요합니다.");
  const uniqueElements = uniqueStringsAt(elements.data, `${path}.elements`, "속성");
  if (!uniqueElements.ok) return uniqueElements;
  if (candidate.translation !== undefined) {
    const translation = validateTranslationDisplayStateAt(
      candidate.translation,
      `${path}.translation`,
      ["name"],
      "name",
      { name: { ko: true, ja: true, en: true } }
    );
    if (!translation.ok) return translation;
  }
  return valid(candidate as PalworldPalReference);
}

function validateElementDefinitionAt(value: unknown, path: string): PalworldValidationResult<PalworldElementDefinition> {
  const record = recordAt(value, path, ["id", "nameKo", "nameJa", "nameEn", "iconUrl", "imageWidth", "imageHeight"]);
  if (!record.ok) return record;
  const id = enumAt(record.data.id, `${path}.id`, PALWORLD_ELEMENTS);
  if (!id.ok) return id;
  for (const field of ["nameKo", "nameJa", "nameEn"] as const) {
    const name = stringAt(record.data[field], `${path}.${field}`);
    if (!name.ok) return name;
  }
  const iconUrl = optionalElementImagePathAt(record.data.iconUrl, `${path}.iconUrl`);
  if (!iconUrl.ok) return iconUrl;
  const dimensions = validateOptionalImageDimensionsAt(record.data, path, "iconUrl");
  return dimensions.ok ? valid(record.data as PalworldElementDefinition) : dimensions;
}

function validateItemReferenceAt(value: unknown, path: string): PalworldValidationResult<PalworldItemReference> {
  const record = recordAt(value, path, [
    "id",
    "nameKo",
    "nameJa",
    "nameEn",
    "imageUrl",
    "imageWidth",
    "imageHeight",
    "localization",
    "translation"
  ]);
  if (!record.ok) return record;
  const candidate = record.data;
  const id = idAt(candidate.id, `${path}.id`);
  if (!id.ok) return id;
  const nameEn = stringAt(candidate.nameEn, `${path}.nameEn`);
  if (!nameEn.ok) return nameEn;
  for (const field of ["nameKo", "nameJa"] as const) {
    const result = optionalStringAt(candidate[field], `${path}.${field}`);
    if (!result.ok) return result;
  }
  const imageUrl = optionalItemImagePathAt(candidate.imageUrl, `${path}.imageUrl`);
  if (!imageUrl.ok) return imageUrl;
  const dimensions = validateOptionalImageDimensionsAt(candidate, path, "imageUrl");
  if (!dimensions.ok) return dimensions;
  if (candidate.localization !== undefined) {
    const localization = validateLocalizationFallbackAt(candidate.localization, `${path}.localization`);
    if (!localization.ok) return localization;
    const consistent = validateLocalizationConsistencyAt(localization.data, `${path}.localization`, {
      ko: candidate.nameKo !== undefined,
      ja: candidate.nameJa !== undefined,
      en: true
    });
    if (!consistent.ok) return consistent;
  } else if (candidate.nameKo === undefined || candidate.nameJa === undefined) {
    return invalid(`${path}.localization`, "한국어·일본어 이름이 없으면 fallback 상태를 명시해야 합니다.");
  }
  if (candidate.translation !== undefined) {
    const translation = validateTranslationDisplayStateAt(
      candidate.translation,
      `${path}.translation`,
      ["name"],
      "name",
      {
        name: {
          ko: candidate.nameKo !== undefined,
          ja: candidate.nameJa !== undefined,
          en: true
        }
      }
    );
    if (!translation.ok) return translation;
  }
  return valid(candidate as PalworldItemReference);
}

function validateFacilityReferenceAt(value: unknown, path: string): PalworldValidationResult<PalworldFacilityReference> {
  const record = recordAt(value, path, ["id", "nameKo", "nameJa", "nameEn", "localization"]);
  if (!record.ok) return record;
  const id = idAt(record.data.id, `${path}.id`);
  if (!id.ok) return id;
  const nameEn = stringAt(record.data.nameEn, `${path}.nameEn`, MAX_NAME_LENGTH);
  if (!nameEn.ok) return nameEn;
  for (const field of ["nameKo", "nameJa"] as const) {
    const result = optionalStringAt(record.data[field], `${path}.${field}`, MAX_NAME_LENGTH);
    if (!result.ok) return result;
  }
  if (record.data.localization !== undefined) {
    const localization = validateLocalizationFallbackAt(record.data.localization, `${path}.localization`);
    if (!localization.ok) return localization;
    const consistent = validateLocalizationConsistencyAt(localization.data, `${path}.localization`, {
      ko: record.data.nameKo !== undefined,
      ja: record.data.nameJa !== undefined,
      en: true
    });
    if (!consistent.ok) return consistent;
  } else if (record.data.nameKo === undefined || record.data.nameJa === undefined) {
    return invalid(`${path}.localization`, "한국어·일본어 이름이 없으면 fallback 상태를 명시해야 합니다.");
  }
  return valid(record.data as PalworldFacilityReference);
}

function validatePalSummaryAt(value: unknown, path: string): PalworldValidationResult<PalworldPalSummary> {
  const record = recordAt(value, path, [
    "id",
    "number",
    "nameKo",
    "nameJa",
    "nameEn",
    "imageUrl",
    "imageWidth",
    "imageHeight",
    "elements",
    "rarity",
    "variantType",
    "workSuitabilities",
    "translation"
  ]);
  if (!record.ok) return record;
  const candidate = record.data;
  const reference = validatePalReferenceAt(
    {
      id: candidate.id,
      number: candidate.number,
      nameKo: candidate.nameKo,
      nameJa: candidate.nameJa,
      nameEn: candidate.nameEn,
      ...(candidate.imageUrl === undefined ? {} : { imageUrl: candidate.imageUrl }),
      ...(candidate.imageWidth === undefined ? {} : { imageWidth: candidate.imageWidth }),
      ...(candidate.imageHeight === undefined ? {} : { imageHeight: candidate.imageHeight }),
      elements: candidate.elements,
      ...(candidate.translation === undefined ? {} : {
        translation: { name: (candidate.translation as PalworldTranslationDisplayState).name }
      })
    },
    path
  );
  if (!reference.ok) return reference;
  const rarity = integerAt(candidate.rarity, `${path}.rarity`, 1, MAX_RARITY);
  if (!rarity.ok) return rarity;
  const variantType = enumAt(candidate.variantType, `${path}.variantType`, PALWORLD_VARIANT_TYPES);
  if (!variantType.ok) return variantType;
  const work = arrayAt(candidate.workSuitabilities, `${path}.workSuitabilities`, PALWORLD_WORK_SUITABILITY_TYPES.length, validateWorkSuitabilityAt);
  if (!work.ok) return work;
  const uniqueWork = uniqueStringsAt(work.data.map((entry) => entry.type), `${path}.workSuitabilities`, "작업 적성");
  return uniqueWork.ok ? valid(candidate as PalworldPalSummary) : uniqueWork;
}

function validateStatsAt(value: unknown, path: string): PalworldValidationResult<PalworldPalStats> {
  const record = recordAt(value, path, [
    "hp",
    "attack",
    "defense",
    "moveSpeed",
    "stamina",
    "meleeAttack",
    "shotAttack",
    "walkSpeed",
    "runSpeed",
    "rideSprintSpeed",
    "food"
  ]);
  if (!record.ok) return record;
  for (const field of ["hp", "attack", "defense", "moveSpeed", "stamina"] as const) {
    const result = finiteNumberAt(record.data[field], `${path}.${field}`, 0, MAX_STAT_VALUE);
    if (!result.ok) return result;
  }
  for (const field of [
    "meleeAttack",
    "shotAttack",
    "walkSpeed",
    "runSpeed",
    "rideSprintSpeed",
    "food"
  ] as const) {
    if (record.data[field] === undefined) continue;
    const result = finiteNumberAt(record.data[field], `${path}.${field}`, 0, MAX_STAT_VALUE);
    if (!result.ok) return result;
  }
  return valid(record.data as PalworldPalStats);
}

function validateBreedingInfoAt(value: unknown, path: string): PalworldValidationResult<PalworldPalBreedingInfo> {
  const record = recordAt(value, path, ["breedingPower", "specialParentPairs"]);
  if (!record.ok) return record;
  if (record.data.breedingPower !== undefined) {
    const power = integerAt(record.data.breedingPower, `${path}.breedingPower`, 0, MAX_STAT_VALUE);
    if (!power.ok) return power;
  }
  const pairs = arrayAt(record.data.specialParentPairs, `${path}.specialParentPairs`, MAX_API_COLLECTION_SIZE, (entry, entryPath) => {
    const pair = recordAt(entry, entryPath, [
      "parentAId",
      "parentBId",
      "parentAGender",
      "parentBGender",
      "parentA",
      "parentB"
    ]);
    if (!pair.ok) return pair;
    for (const field of ["parentAId", "parentBId"] as const) {
      const result = idAt(pair.data[field], `${entryPath}.${field}`);
      if (!result.ok) return result;
    }
    for (const field of ["parentAGender", "parentBGender"] as const) {
      if (pair.data[field] === undefined) continue;
      const result = enumAt(pair.data[field], `${entryPath}.${field}`, PALWORLD_BREEDING_GENDERS);
      if (!result.ok) return result;
    }
    for (const [referenceField, idField] of [
      ["parentA", "parentAId"],
      ["parentB", "parentBId"]
    ] as const) {
      if (pair.data[referenceField] === undefined) continue;
      const reference = validatePalReferenceAt(pair.data[referenceField], `${entryPath}.${referenceField}`);
      if (!reference.ok) return reference;
      if (reference.data.id !== pair.data[idField]) {
        return invalid(`${entryPath}.${referenceField}.id`, `${idField}와 일치해야 합니다.`);
      }
    }
    return valid(pair.data as {
      parentAId: string;
      parentBId: string;
      parentAGender?: PalworldBreedingGender;
      parentBGender?: PalworldBreedingGender;
      parentA?: PalworldPalReference;
      parentB?: PalworldPalReference;
    });
  });
  return pairs.ok ? valid(record.data as PalworldPalBreedingInfo) : pairs;
}

function validatePalDropAt(value: unknown, path: string): PalworldValidationResult<PalworldPalDrop> {
  const record = recordAt(value, path, ["item", "minQuantity", "maxQuantity", "dropRatePercent"]);
  if (!record.ok) return record;
  const item = validateItemReferenceAt(record.data.item, `${path}.item`);
  if (!item.ok) return item;
  const minQuantity = integerAt(record.data.minQuantity, `${path}.minQuantity`, 1, 1_000_000);
  if (!minQuantity.ok) return minQuantity;
  const maxQuantity = integerAt(record.data.maxQuantity, `${path}.maxQuantity`, 1, 1_000_000);
  if (!maxQuantity.ok) return maxQuantity;
  if (maxQuantity.data < minQuantity.data) {
    return invalid(`${path}.maxQuantity`, "minQuantity 이상이어야 합니다.");
  }
  if (record.data.dropRatePercent !== undefined) {
    const dropRate = finiteNumberAt(record.data.dropRatePercent, `${path}.dropRatePercent`, 0, 100);
    if (!dropRate.ok) return dropRate;
  }
  return valid(record.data as PalworldPalDrop);
}

function validatePalDetailAt(value: unknown, path: string): PalworldValidationResult<PalworldPalDetail> {
  const record = recordAt(value, path, [
    "id",
    "number",
    "nameKo",
    "nameJa",
    "nameEn",
    "imageUrl",
    "imageWidth",
    "imageHeight",
    "elements",
    "rarity",
    "variantType",
    "workSuitabilities",
    "descriptionKo",
    "descriptionJa",
    "descriptionEn",
    "localization",
    "translation",
    "stats",
    "nocturnal",
    "partnerSkill",
    "activeSkills",
    "drops",
    "dropDetails",
    "breeding",
    "metadata"
  ]);
  if (!record.ok) return record;
  const candidate = record.data;
  const summary = validatePalSummaryAt(
    {
      id: candidate.id,
      number: candidate.number,
      nameKo: candidate.nameKo,
      nameJa: candidate.nameJa,
      nameEn: candidate.nameEn,
      ...(candidate.imageUrl === undefined ? {} : { imageUrl: candidate.imageUrl }),
      ...(candidate.imageWidth === undefined ? {} : { imageWidth: candidate.imageWidth }),
      ...(candidate.imageHeight === undefined ? {} : { imageHeight: candidate.imageHeight }),
      elements: candidate.elements,
      rarity: candidate.rarity,
      variantType: candidate.variantType,
      workSuitabilities: candidate.workSuitabilities,
      ...(candidate.translation === undefined ? {} : {
        translation: { name: (candidate.translation as PalworldTranslationDisplayState).name }
      })
    },
    path
  );
  if (!summary.ok) return summary;
  for (const field of ["descriptionKo", "descriptionJa", "descriptionEn"] as const) {
    const description = optionalStringAt(candidate[field], `${path}.${field}`, MAX_DESCRIPTION_LENGTH);
    if (!description.ok) return description;
  }
  const hasDescription = candidate.descriptionKo !== undefined || candidate.descriptionJa !== undefined || candidate.descriptionEn !== undefined;
  if (candidate.localization !== undefined) {
    const localization = validateLocalizationFallbackAt(candidate.localization, `${path}.localization`);
    if (!localization.ok) return localization;
    const consistent = validateLocalizationConsistencyAt(localization.data, `${path}.localization`, {
      ko: candidate.descriptionKo !== undefined,
      ja: candidate.descriptionJa !== undefined,
      en: candidate.descriptionEn !== undefined
    });
    if (!consistent.ok) return consistent;
  } else if (hasDescription && (candidate.descriptionKo === undefined || candidate.descriptionJa === undefined)) {
    return invalid(`${path}.localization`, "한국어·일본어 설명이 없으면 fallback 상태를 명시해야 합니다.");
  }
  if (candidate.translation !== undefined) {
    const translation = validateTranslationDisplayStateAt(
      candidate.translation,
      `${path}.translation`,
      ["name", "description"],
      "name",
      {
        name: { ko: true, ja: true, en: true },
        description: {
          ko: candidate.descriptionKo !== undefined,
          ja: candidate.descriptionJa !== undefined,
          en: candidate.descriptionEn !== undefined
        }
      }
    );
    if (!translation.ok) return translation;
  }
  const stats = validateStatsAt(candidate.stats, `${path}.stats`);
  if (!stats.ok) return stats;
  const nocturnal = booleanAt(candidate.nocturnal, `${path}.nocturnal`);
  if (!nocturnal.ok) return nocturnal;
  if (candidate.partnerSkill !== undefined) {
    const partnerSkill = validateSkillAt(candidate.partnerSkill, `${path}.partnerSkill`);
    if (!partnerSkill.ok) return partnerSkill;
    if (partnerSkill.data.type !== "partner") return invalid(`${path}.partnerSkill.type`, "partner여야 합니다.");
  }
  const activeSkills = arrayAt(candidate.activeSkills, `${path}.activeSkills`, 64, validateSkillAt);
  if (!activeSkills.ok) return activeSkills;
  for (const [index, activeSkill] of activeSkills.data.entries()) {
    if (activeSkill.type !== "active") {
      return invalid(`${path}.activeSkills[${index}].type`, "active여야 합니다.");
    }
  }
  const uniqueActiveSkills = uniqueStringsAt(activeSkills.data.map((skill) => skill.id), `${path}.activeSkills`, "active skill");
  if (!uniqueActiveSkills.ok) return uniqueActiveSkills;
  const drops = arrayAt(candidate.drops, `${path}.drops`, MAX_API_COLLECTION_SIZE, validateItemReferenceAt);
  if (!drops.ok) return drops;
  const uniqueDrops = uniqueStringsAt(drops.data.map((drop) => drop.id), `${path}.drops`, "drop 아이템");
  if (!uniqueDrops.ok) return uniqueDrops;
  if (candidate.dropDetails !== undefined) {
    const dropDetails = arrayAt(candidate.dropDetails, `${path}.dropDetails`, MAX_API_COLLECTION_SIZE, validatePalDropAt);
    if (!dropDetails.ok) return dropDetails;
    const dropIds = new Set(drops.data.map((drop) => drop.id));
    const detailedIds = new Set<string>();
    for (const [index, detail] of dropDetails.data.entries()) {
      if (!dropIds.has(detail.item.id)) {
        return invalid(`${path}.dropDetails[${index}].item`, "drops에 포함된 아이템이어야 합니다.");
      }
      if (detailedIds.has(detail.item.id)) {
        return invalid(`${path}.dropDetails[${index}].item.id`, "중복 drop 상세입니다.");
      }
      detailedIds.add(detail.item.id);
    }
  }
  const breeding = validateBreedingInfoAt(candidate.breeding, `${path}.breeding`);
  if (!breeding.ok) return breeding;
  const metadata = validateMetadataAt(candidate.metadata, `${path}.metadata`);
  return metadata.ok ? valid(candidate as PalworldPalDetail) : metadata;
}

function validateItemSummaryAt(value: unknown, path: string): PalworldValidationResult<PalworldItemSummary> {
  const record = recordAt(value, path, [
    "id",
    "nameKo",
    "nameJa",
    "nameEn",
    "imageUrl",
    "imageWidth",
    "imageHeight",
    "localization",
    "category",
    "rarity",
    "descriptionKo",
    "descriptionJa",
    "descriptionEn",
    "sellPrice",
    "technologyLevel",
    "translation"
  ]);
  if (!record.ok) return record;
  const candidate = record.data;
  const reference = validateItemReferenceAt(
    {
      id: candidate.id,
      nameKo: candidate.nameKo,
      nameJa: candidate.nameJa,
      nameEn: candidate.nameEn,
      ...(candidate.imageUrl === undefined ? {} : { imageUrl: candidate.imageUrl }),
      ...(candidate.imageWidth === undefined ? {} : { imageWidth: candidate.imageWidth }),
      ...(candidate.imageHeight === undefined ? {} : { imageHeight: candidate.imageHeight }),
      ...(candidate.localization === undefined ? {} : { localization: candidate.localization }),
      ...(candidate.translation === undefined ? {} : {
        translation: { name: (candidate.translation as PalworldTranslationDisplayState).name }
      })
    },
    path
  );
  if (!reference.ok) return reference;
  const category = enumAt(candidate.category, `${path}.category`, PALWORLD_ITEM_CATEGORIES);
  if (!category.ok) return category;
  const rarity = integerAt(candidate.rarity, `${path}.rarity`, 0, MAX_RARITY);
  if (!rarity.ok) return rarity;
  for (const field of ["descriptionKo", "descriptionJa"] as const) {
    const result = optionalStringAt(candidate[field], `${path}.${field}`, MAX_DESCRIPTION_LENGTH);
    if (!result.ok) return result;
  }
  const descriptionEn = optionalStringAt(candidate.descriptionEn, `${path}.descriptionEn`, MAX_DESCRIPTION_LENGTH);
  if (!descriptionEn.ok) return descriptionEn;
  if (candidate.descriptionKo === undefined && candidate.descriptionJa === undefined && candidate.descriptionEn === undefined) {
    return invalid(path, "하나 이상의 언어로 된 아이템 설명이 필요합니다.");
  }
  if (candidate.localization !== undefined) {
    const localization = validateLocalizationFallbackAt(candidate.localization, `${path}.localization`);
    if (!localization.ok) return localization;
    const consistent = validateLocalizationConsistencyAt(localization.data, `${path}.localization`, {
      ko: candidate.nameKo !== undefined && candidate.descriptionKo !== undefined,
      ja: candidate.nameJa !== undefined && candidate.descriptionJa !== undefined,
      en: candidate.nameEn !== undefined && candidate.descriptionEn !== undefined
    });
    if (!consistent.ok) return consistent;
  } else if (
    candidate.nameKo === undefined ||
    candidate.nameJa === undefined ||
    candidate.descriptionKo === undefined ||
    candidate.descriptionJa === undefined
  ) {
    return invalid(`${path}.localization`, "한국어·일본어 데이터가 없으면 fallback 상태를 명시해야 합니다.");
  }
  if (candidate.translation !== undefined) {
    const translation = validateTranslationDisplayStateAt(
      candidate.translation,
      `${path}.translation`,
      ["name", "description"],
      "name",
      {
        name: {
          ko: candidate.nameKo !== undefined,
          ja: candidate.nameJa !== undefined,
          en: true
        },
        description: {
          ko: candidate.descriptionKo !== undefined,
          ja: candidate.descriptionJa !== undefined,
          en: candidate.descriptionEn !== undefined
        }
      }
    );
    if (!translation.ok) return translation;
  }
  for (const [field, max] of [
    ["sellPrice", 1_000_000_000],
    ["technologyLevel", 100]
  ] as const) {
    if (candidate[field] !== undefined) {
      const result = integerAt(candidate[field], `${path}.${field}`, 0, max);
      if (!result.ok) return result;
    }
  }
  return valid(candidate as PalworldItemSummary);
}

function validateCraftingMaterialAt(value: unknown, path: string): PalworldValidationResult<PalworldCraftingMaterial> {
  const record = recordAt(value, path, ["item", "quantity"]);
  if (!record.ok) return record;
  const item = validateItemReferenceAt(record.data.item, `${path}.item`);
  if (!item.ok) return item;
  const quantity = integerAt(record.data.quantity, `${path}.quantity`, 1, 1_000_000);
  return quantity.ok ? valid(record.data as PalworldCraftingMaterial) : quantity;
}

function validateItemRecipeAt(
  value: unknown,
  path: string
): PalworldValidationResult<PalworldItemRecipe> {
  const record = recordAt(value, path, [
    "sourceRowId",
    "resultCount",
    "workAmount",
    "materials"
  ]);
  if (!record.ok) return record;
  const sourceRowId = sourceInternalIdAt(record.data.sourceRowId, `${path}.sourceRowId`);
  if (!sourceRowId.ok) return sourceRowId;
  const resultCount = integerAt(record.data.resultCount, `${path}.resultCount`, 1, 100_000_000);
  if (!resultCount.ok) return resultCount;
  if (record.data.workAmount !== undefined) {
    const workAmount = finiteNumberAt(
      record.data.workAmount,
      `${path}.workAmount`,
      0,
      1_000_000_000_000
    );
    if (!workAmount.ok) return workAmount;
  }
  const materials = arrayAt(
    record.data.materials,
    `${path}.materials`,
    MAX_API_COLLECTION_SIZE,
    validateCraftingMaterialAt
  );
  if (!materials.ok) return materials;
  const uniqueMaterials = uniqueStringsAt(
    materials.data.map((material) => material.item.id),
    `${path}.materials`,
    "제작 재료"
  );
  return uniqueMaterials.ok ? valid(record.data as PalworldItemRecipe) : uniqueMaterials;
}

function validateItemTechnologyUnlockAt(
  value: unknown,
  path: string
): PalworldValidationResult<PalworldItemTechnologyUnlock> {
  const record = recordAt(value, path, [
    "sourceRowId",
    "unlockLevel",
    "tier",
    "cost"
  ]);
  if (!record.ok) return record;
  const sourceRowId = sourceInternalIdAt(record.data.sourceRowId, `${path}.sourceRowId`);
  if (!sourceRowId.ok) return sourceRowId;
  for (const [field, maximum] of [
    ["unlockLevel", 1_000],
    ["tier", 1_000],
    ["cost", 1_000_000]
  ] as const) {
    const result = integerAt(record.data[field], `${path}.${field}`, 0, maximum);
    if (!result.ok) return result;
  }
  return valid(record.data as PalworldItemTechnologyUnlock);
}

function validateAcquisitionMethodAt(value: unknown, path: string): PalworldValidationResult<PalworldAcquisitionMethod> {
  const record = recordAt(value, path, [
    "type",
    "labelKo",
    "labelJa",
    "labelEn",
    "locationKo",
    "locationJa",
    "locationEn",
    "localization",
    "translation"
  ]);
  if (!record.ok) return record;
  const type = enumAt(record.data.type, `${path}.type`, PALWORLD_ACQUISITION_TYPES);
  if (!type.ok) return type;
  const labelEn = stringAt(record.data.labelEn, `${path}.labelEn`, MAX_DESCRIPTION_LENGTH);
  if (!labelEn.ok) return labelEn;
  for (const field of ["labelKo", "labelJa"] as const) {
    const result = optionalStringAt(record.data[field], `${path}.${field}`, MAX_DESCRIPTION_LENGTH);
    if (!result.ok) return result;
  }
  for (const field of ["locationKo", "locationJa", "locationEn"] as const) {
    const result = optionalStringAt(record.data[field], `${path}.${field}`, MAX_DESCRIPTION_LENGTH);
    if (!result.ok) return result;
  }
  if (record.data.localization !== undefined) {
    const localization = validateLocalizationFallbackAt(record.data.localization, `${path}.localization`);
    if (!localization.ok) return localization;
    const consistent = validateLocalizationConsistencyAt(localization.data, `${path}.localization`, {
      ko: record.data.labelKo !== undefined,
      ja: record.data.labelJa !== undefined,
      en: true
    });
    if (!consistent.ok) return consistent;
  } else if (record.data.labelKo === undefined || record.data.labelJa === undefined) {
    return invalid(`${path}.localization`, "한국어·일본어 안내가 없으면 fallback 상태를 명시해야 합니다.");
  }
  if (record.data.translation !== undefined) {
    const translation = validateTranslationDisplayStateAt(
      record.data.translation,
      `${path}.translation`,
      ["label", "location"],
      "label",
      {
        label: {
          ko: record.data.labelKo !== undefined,
          ja: record.data.labelJa !== undefined,
          en: true
        },
        location: {
          ko: record.data.locationKo !== undefined,
          ja: record.data.locationJa !== undefined,
          en: record.data.locationEn !== undefined
        }
      }
    );
    if (!translation.ok) return translation;
  }
  return valid(record.data as PalworldAcquisitionMethod);
}

function validateItemDetailAt(value: unknown, path: string): PalworldValidationResult<PalworldItemDetail> {
  const record = recordAt(value, path, [
    "id",
    "nameKo",
    "nameJa",
    "nameEn",
    "imageUrl",
    "imageWidth",
    "imageHeight",
    "localization",
    "category",
    "rarity",
    "descriptionKo",
    "descriptionJa",
    "descriptionEn",
    "sellPrice",
    "technologyLevel",
    "sourceInternalId",
    "weight",
    "maxStack",
    "durability",
    "craftingMaterials",
    "recipes",
    "technologyUnlocks",
    "craftingFacility",
    "dropPals",
    "acquisitionMethods",
    "relatedItems",
    "metadata",
    "translation"
  ]);
  if (!record.ok) return record;
  const candidate = record.data;
  const summary = validateItemSummaryAt(
    {
      id: candidate.id,
      nameKo: candidate.nameKo,
      nameJa: candidate.nameJa,
      nameEn: candidate.nameEn,
      ...(candidate.imageUrl === undefined ? {} : { imageUrl: candidate.imageUrl }),
      ...(candidate.imageWidth === undefined ? {} : { imageWidth: candidate.imageWidth }),
      ...(candidate.imageHeight === undefined ? {} : { imageHeight: candidate.imageHeight }),
      ...(candidate.localization === undefined ? {} : { localization: candidate.localization }),
      category: candidate.category,
      rarity: candidate.rarity,
      descriptionKo: candidate.descriptionKo,
      descriptionJa: candidate.descriptionJa,
      ...(candidate.descriptionEn === undefined ? {} : { descriptionEn: candidate.descriptionEn }),
      ...(candidate.sellPrice === undefined ? {} : { sellPrice: candidate.sellPrice }),
      ...(candidate.technologyLevel === undefined ? {} : { technologyLevel: candidate.technologyLevel }),
      ...(candidate.translation === undefined ? {} : { translation: candidate.translation })
    },
    path
  );
  if (!summary.ok) return summary;
  if (candidate.sourceInternalId !== undefined) {
    const sourceInternalId = sourceInternalIdAt(candidate.sourceInternalId, `${path}.sourceInternalId`);
    if (!sourceInternalId.ok) return sourceInternalId;
  }
  if (candidate.weight !== undefined) {
    const weight = finiteNumberAt(candidate.weight, `${path}.weight`, 0, 1_000_000);
    if (!weight.ok) return weight;
  }
  for (const [field, max] of [
    ["maxStack", 100_000_000],
    ["durability", 1_000_000_000]
  ] as const) {
    if (candidate[field] !== undefined) {
      const result = integerAt(candidate[field], `${path}.${field}`, 0, max);
      if (!result.ok) return result;
    }
  }
  const materials = arrayAt(candidate.craftingMaterials, `${path}.craftingMaterials`, MAX_API_COLLECTION_SIZE, validateCraftingMaterialAt);
  if (!materials.ok) return materials;
  const uniqueMaterials = uniqueStringsAt(materials.data.map((material) => material.item.id), `${path}.craftingMaterials`, "제작 재료");
  if (!uniqueMaterials.ok) return uniqueMaterials;
  if (candidate.recipes !== undefined) {
    const recipes = arrayAt(
      candidate.recipes,
      `${path}.recipes`,
      MAX_API_COLLECTION_SIZE,
      validateItemRecipeAt
    );
    if (!recipes.ok) return recipes;
    const sourceRows = uniqueStringsAt(
      recipes.data.map((recipe) => recipe.sourceRowId),
      `${path}.recipes`,
      "제작법 source row"
    );
    if (!sourceRows.ok) return sourceRows;
  }
  if (candidate.technologyUnlocks !== undefined) {
    const technologyUnlocks = arrayAt(
      candidate.technologyUnlocks,
      `${path}.technologyUnlocks`,
      MAX_API_COLLECTION_SIZE,
      validateItemTechnologyUnlockAt
    );
    if (!technologyUnlocks.ok) return technologyUnlocks;
    const sourceRows = uniqueStringsAt(
      technologyUnlocks.data.map((unlock) => unlock.sourceRowId),
      `${path}.technologyUnlocks`,
      "기술 source row"
    );
    if (!sourceRows.ok) return sourceRows;
  }
  if (candidate.craftingFacility !== undefined) {
    const facility = validateFacilityReferenceAt(candidate.craftingFacility, `${path}.craftingFacility`);
    if (!facility.ok) return facility;
  }
  const dropPals = arrayAt(candidate.dropPals, `${path}.dropPals`, MAX_API_COLLECTION_SIZE, validatePalReferenceAt);
  if (!dropPals.ok) return dropPals;
  const uniqueDropPals = uniqueStringsAt(dropPals.data.map((pal) => pal.id), `${path}.dropPals`, "drop Pal");
  if (!uniqueDropPals.ok) return uniqueDropPals;
  const methods = arrayAt(candidate.acquisitionMethods, `${path}.acquisitionMethods`, MAX_API_COLLECTION_SIZE, validateAcquisitionMethodAt);
  if (!methods.ok) return methods;
  const relatedItems = arrayAt(candidate.relatedItems, `${path}.relatedItems`, MAX_API_COLLECTION_SIZE, validateItemReferenceAt);
  if (!relatedItems.ok) return relatedItems;
  const uniqueRelatedItems = uniqueStringsAt(relatedItems.data.map((item) => item.id), `${path}.relatedItems`, "관련 아이템");
  if (!uniqueRelatedItems.ok) return uniqueRelatedItems;
  const metadata = validateMetadataAt(candidate.metadata, `${path}.metadata`);
  return metadata.ok ? valid(candidate as PalworldItemDetail) : metadata;
}

function skillValueFromRecord(record: Record<string, unknown>): Record<string, unknown> {
  const skill: Record<string, unknown> = {};
  for (const key of PALWORLD_SKILL_KEYS) {
    if (record[key] !== undefined) skill[key] = record[key];
  }
  return skill;
}

function validateSkillSummaryAt(value: unknown, path: string): PalworldValidationResult<PalworldSkillSummary> {
  const record = recordAt(value, path, [...PALWORLD_SKILL_KEYS, "relatedPalCount"]);
  if (!record.ok) return record;
  const skill = validateSkillAt(skillValueFromRecord(record.data), path);
  if (!skill.ok) return skill;
  const relatedPalCount = integerAt(record.data.relatedPalCount, `${path}.relatedPalCount`, 0, MAX_RELATED_PALS);
  return relatedPalCount.ok ? valid(record.data as PalworldSkillSummary) : relatedPalCount;
}

function validateSkillAssignmentAt(value: unknown, path: string): PalworldValidationResult<PalworldSkillAssignment> {
  const record = recordAt(value, path, ["pal", "unlockLevel"]);
  if (!record.ok) return record;
  const pal = validatePalReferenceAt(record.data.pal, `${path}.pal`);
  if (!pal.ok) return pal;
  if (record.data.unlockLevel !== undefined) {
    const unlockLevel = integerAt(record.data.unlockLevel, `${path}.unlockLevel`, 0, 100);
    if (!unlockLevel.ok) return unlockLevel;
  }
  return valid(record.data as PalworldSkillAssignment);
}

function validateSkillDetailAt(value: unknown, path: string): PalworldValidationResult<PalworldSkillDetail> {
  const record = recordAt(value, path, [...PALWORLD_SKILL_KEYS, "relatedPalCount", "relatedPals", "metadata"]);
  if (!record.ok) return record;
  const summary = validateSkillSummaryAt(
    { ...skillValueFromRecord(record.data), relatedPalCount: record.data.relatedPalCount },
    path
  );
  if (!summary.ok) return summary;
  const relatedPals = arrayAt(record.data.relatedPals, `${path}.relatedPals`, MAX_RELATED_PALS, validateSkillAssignmentAt);
  if (!relatedPals.ok) return relatedPals;
  if (relatedPals.data.length !== summary.data.relatedPalCount) {
    return invalid(`${path}.relatedPalCount`, "relatedPals 수와 일치해야 합니다.");
  }
  const seenPalIds = new Set<string>();
  for (const [index, assignment] of relatedPals.data.entries()) {
    if (seenPalIds.has(assignment.pal.id)) {
      return invalid(`${path}.relatedPals[${index}].pal.id`, "중복 Pal 배정입니다.");
    }
    seenPalIds.add(assignment.pal.id);
  }
  const metadata = validateMetadataAt(record.data.metadata, `${path}.metadata`);
  return metadata.ok ? valid(record.data as PalworldSkillDetail) : metadata;
}

function validateCoverageCountAt(value: unknown, path: string): PalworldValidationResult<PalworldCoverageCount> {
  const record = recordAt(value, path, ["available", "missing", "total"]);
  if (!record.ok) return record;
  for (const field of ["available", "missing", "total"] as const) {
    const count = integerAt(record.data[field], `${path}.${field}`, 0, 100_000_000);
    if (!count.ok) return count;
  }
  if ((record.data.available as number) + (record.data.missing as number) !== record.data.total) {
    return invalid(path, "available과 missing의 합은 total과 같아야 합니다.");
  }
  return valid(record.data as PalworldCoverageCount);
}

function validateTranslationDomainCoverageAt(
  value: unknown,
  path: string
): PalworldValidationResult<PalworldTranslationDomainCoverage> {
  const record = recordAt(value, path, [
    "palNames",
    "palDescriptions",
    "itemNames",
    "itemDescriptions",
    "skillNames",
    "skillDescriptions",
    "skillPassiveAbilities",
    "sourceProvided",
    "humanReviewed",
    "machineAssisted",
    "sourceLanguageFallback",
    "missingSource",
    "placeholderExcluded",
    "unresolvedRichText",
    "staleSourceHash"
  ]);
  if (!record.ok) return record;
  for (const field of [
    "palNames",
    "palDescriptions",
    "itemNames",
    "itemDescriptions",
    "skillNames",
    "skillDescriptions",
    "skillPassiveAbilities"
  ] as const) {
    const count = validateCoverageCountAt(record.data[field], `${path}.${field}`);
    if (!count.ok) return count;
  }
  for (const field of [
    "sourceProvided",
    "humanReviewed",
    "machineAssisted",
    "sourceLanguageFallback",
    "missingSource",
    "placeholderExcluded",
    "unresolvedRichText",
    "staleSourceHash"
  ] as const) {
    if (record.data[field] === undefined && (
      field === "sourceProvided"
      || field === "placeholderExcluded"
      || field === "unresolvedRichText"
    )) {
      continue;
    }
    const count = integerAt(record.data[field], `${path}.${field}`, 0, 100_000_000);
    if (!count.ok) return count;
  }
  const fieldCoverages = [
    "palNames",
    "palDescriptions",
    "itemNames",
    "itemDescriptions",
    "skillNames",
    "skillDescriptions",
    "skillPassiveAbilities"
  ].map((field) => record.data[field] as PalworldCoverageCount);
  const fieldTotal = fieldCoverages.reduce((sum, coverage) => sum + coverage.total, 0);
  const availableTotal = fieldCoverages.reduce((sum, coverage) => sum + coverage.available, 0);
  const missingTotal = fieldCoverages.reduce((sum, coverage) => sum + coverage.missing, 0);
  if (
    ((record.data.sourceProvided as number | undefined) ?? 0)
    + (record.data.humanReviewed as number)
    + (record.data.machineAssisted as number)
    !== availableTotal
  ) {
    return invalid(path, "필드 available 합과 sourceProvided·humanReviewed·machineAssisted 합이 일치해야 합니다.");
  }
  if ((record.data.sourceLanguageFallback as number) !== missingTotal) {
    return invalid(path, "필드 missing 합과 sourceLanguageFallback이 일치해야 합니다.");
  }
  for (const field of ["placeholderExcluded", "unresolvedRichText"] as const) {
    const count = record.data[field] as number | undefined;
    if (count !== undefined && count > fieldTotal) {
      return invalid(`${path}.${field}`, "전체 locale 필드 수보다 클 수 없습니다.");
    }
  }
  if ((record.data.staleSourceHash as number) !== 0 && (record.data.staleSourceHash as number) !== fieldTotal) {
    return invalid(`${path}.staleSourceHash`, "stale source hash는 0 또는 전체 번역 필드 수여야 합니다.");
  }
  return valid(record.data as PalworldTranslationDomainCoverage);
}

function validateDataCoverageAt(value: unknown, path: string): PalworldValidationResult<PalworldDataCoverage> {
  const record = recordAt(value, path, [
    "palDetails",
    "itemDetails",
    "skillDetails",
    "palDescriptions",
    "palStats",
    "partnerSkills",
    "activeSkills",
    "palDrops",
    "breedingFields",
    "itemDescriptions",
    "craftingRecipes",
    "craftingFacilities",
    "dropPals",
    "technologyLevels",
    "prices",
    "durability",
    "acquisitionMethods",
    "skillDescriptions",
    "relatedPals",
    "palImages",
    "itemImages",
    "elementImages",
    "localization",
    "translations"
  ]);
  if (!record.ok) return record;
  for (const field of [
    "palDetails",
    "itemDetails",
    "skillDetails",
    "palDescriptions",
    "palStats",
    "partnerSkills",
    "activeSkills",
    "palDrops",
    "breedingFields",
    "itemDescriptions",
    "craftingRecipes",
    "craftingFacilities",
    "dropPals",
    "technologyLevels",
    "prices",
    "durability",
    "acquisitionMethods",
    "skillDescriptions",
    "relatedPals",
    "palImages",
    "itemImages",
    "elementImages"
  ] as const) {
    const count = validateCoverageCountAt(record.data[field], `${path}.${field}`);
    if (!count.ok) return count;
  }
  const localization = recordAt(record.data.localization, `${path}.localization`, ["ko", "ja", "en"]);
  if (!localization.ok) return localization;
  for (const field of ["ko", "ja", "en"] as const) {
    const count = validateCoverageCountAt(localization.data[field], `${path}.localization.${field}`);
    if (!count.ok) return count;
  }
  if (record.data.translations !== undefined) {
    const translations = recordAt(record.data.translations, `${path}.translations`, ["ko", "ja"]);
    if (!translations.ok) return translations;
    for (const locale of PALWORLD_TRANSLATION_LOCALES) {
      const localeCoverage = validateTranslationDomainCoverageAt(
        translations.data[locale],
        `${path}.translations.${locale}`
      );
      if (!localeCoverage.ok) return localeCoverage;
    }
  }
  return valid(record.data as PalworldDataCoverage);
}

function validateBreedingPairAt(value: unknown, path: string): PalworldValidationResult<PalworldBreedingPair> {
  const record = recordAt(value, path, ["id", "parentA", "parentB", "child", "isSpecial", "genderCondition"]);
  if (!record.ok) return record;
  const candidate = record.data;
  const id = idAt(candidate.id, `${path}.id`);
  if (!id.ok) return id;
  for (const field of ["parentA", "parentB", "child"] as const) {
    const result = validatePalReferenceAt(candidate[field], `${path}.${field}`);
    if (!result.ok) return result;
  }
  if (typeof candidate.isSpecial !== "boolean") return invalid(`${path}.isSpecial`, "boolean이어야 합니다.");
  if (candidate.genderCondition !== undefined) {
    const gender = recordAt(candidate.genderCondition, `${path}.genderCondition`, ["parentA", "parentB"]);
    if (!gender.ok) return gender;
    for (const field of ["parentA", "parentB"] as const) {
      const result = enumAt(gender.data[field], `${path}.genderCondition.${field}`, PALWORLD_GENDERS);
      if (!result.ok) return result;
    }
  }
  return valid(candidate as PalworldBreedingPair);
}

function validatePaginationAt(value: unknown, path: string): PalworldValidationResult<PalworldPagination> {
  const record = recordAt(value, path, ["page", "pageSize", "total", "totalPages", "hasNextPage", "hasPreviousPage"]);
  if (!record.ok) return record;
  for (const [field, min, max] of [
    ["page", 1, 1_000_000],
    ["pageSize", 1, MAX_API_COLLECTION_SIZE],
    ["total", 0, 100_000_000],
    ["totalPages", 0, 100_000_000]
  ] as const) {
    const result = integerAt(record.data[field], `${path}.${field}`, min, max);
    if (!result.ok) return result;
  }
  for (const field of ["hasNextPage", "hasPreviousPage"] as const) {
    if (typeof record.data[field] !== "boolean") return invalid(`${path}.${field}`, "boolean이어야 합니다.");
  }
  const page = record.data.page as number;
  const pageSize = record.data.pageSize as number;
  const total = record.data.total as number;
  const totalPages = record.data.totalPages as number;
  const expectedTotalPages = Math.ceil(total / pageSize);
  if (totalPages !== expectedTotalPages) {
    return invalid(`${path}.totalPages`, `total과 pageSize로 계산한 ${expectedTotalPages}이어야 합니다.`);
  }
  if (totalPages === 0 && page !== 1) return invalid(`${path}.page`, "결과가 없을 때는 1이어야 합니다.");
  if (totalPages > 0 && page > totalPages) return invalid(`${path}.page`, "totalPages보다 클 수 없습니다.");
  const expectedHasNextPage = page < totalPages;
  if (record.data.hasNextPage !== expectedHasNextPage) {
    return invalid(`${path}.hasNextPage`, `${expectedHasNextPage}여야 합니다.`);
  }
  const expectedHasPreviousPage = page > 1;
  if (record.data.hasPreviousPage !== expectedHasPreviousPage) {
    return invalid(`${path}.hasPreviousPage`, `${expectedHasPreviousPage}여야 합니다.`);
  }
  return valid(record.data as PalworldPagination);
}

function validatePageItemCountAt(
  itemCount: number,
  pagination: PalworldPagination,
  path: string
): PalworldValidationResult<number> {
  const offset = (pagination.page - 1) * pagination.pageSize;
  const expectedPageItems = Math.min(pagination.pageSize, Math.max(0, pagination.total - offset));
  if (itemCount !== expectedPageItems) {
    return invalid(path, `pagination 기준 결과 수인 ${expectedPageItems}개여야 합니다.`);
  }
  return valid(itemCount);
}

export function validatePalworldDataMetadata(value: unknown): PalworldValidationResult<PalworldDataMetadata> {
  return validateMetadataAt(value, "metadata");
}

export function validatePalworldSourceProvenance(
  value: unknown
): PalworldValidationResult<PalworldSourceProvenance> {
  return validateSourceProvenanceAt(value, "provenance");
}

export function assertPalworldSourceProvenance(value: unknown): PalworldSourceProvenance {
  const result = validatePalworldSourceProvenance(value);
  if (!result.ok) throw new TypeError(`Palworld source provenance 검증에 실패했습니다. ${result.error}`);
  return result.data;
}

export function validatePalworldLocalizationFallback(
  value: unknown
): PalworldValidationResult<PalworldLocalizationFallback> {
  return validateLocalizationFallbackAt(value, "localization");
}

export function validatePalworldSkill(value: unknown): PalworldValidationResult<PalworldSkill> {
  return validateSkillAt(value, "skill");
}

export function validatePalworldSkillSummary(value: unknown): PalworldValidationResult<PalworldSkillSummary> {
  return validateSkillSummaryAt(value, "skill");
}

export function validatePalworldSkillAssignment(value: unknown): PalworldValidationResult<PalworldSkillAssignment> {
  return validateSkillAssignmentAt(value, "assignment");
}

export function validatePalworldSkillDetail(value: unknown): PalworldValidationResult<PalworldSkillDetail> {
  return validateSkillDetailAt(value, "skill");
}

export function validatePalworldElementDefinition(value: unknown): PalworldValidationResult<PalworldElementDefinition> {
  return validateElementDefinitionAt(value, "element");
}

export function validatePalworldPalDrop(value: unknown): PalworldValidationResult<PalworldPalDrop> {
  return validatePalDropAt(value, "drop");
}

export function validatePalworldDataCoverage(value: unknown): PalworldValidationResult<PalworldDataCoverage> {
  return validateDataCoverageAt(value, "coverage");
}

function validateTranslationArtifactTextAt(
  value: unknown,
  path: string,
  maxLength: number
): PalworldValidationResult<string> {
  const text = stringAt(value, path, maxLength);
  if (!text.ok) return text;
  if (text.data.trim() !== text.data) {
    return invalid(path, "앞뒤 공백을 포함할 수 없습니다.");
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(text.data)) {
    return invalid(path, "제어문자를 포함할 수 없습니다.");
  }
  if (/<\s*\/?\s*[a-z][^>]*>|<script\b|javascript:/iu.test(text.data)) {
    return invalid(path, "HTML markup을 포함할 수 없습니다.");
  }
  return text;
}

function translationSourceMissingSlotCount(value: string): number {
  return [...value.matchAll(/\(\)/gu)].length
    + [...value.matchAll(/(?:^|\s)\.(?=\s|$)/gu)].length
    + [...value.matchAll(/(?:^|\s),(?=\s|$)/gu)].length;
}

const TRANSLATION_NUMERIC_UNIT_PATTERN = /(?:(?<![A-Za-z])(lv\.?|levels?|레벨|レベル)\s*)?(\d+(?:[.,]\d+)*)(?:\s*-?\s*(milliseconds?|ms|seconds?|secs?|s|minutes?|mins?|hours?|hrs?|days?|years?|kilograms?|kg|grams?|g|kilometers?|km|meters?|m|%|[x×]|lv\.?|levels?|units?|shots?|times?|킬로그램|그램|킬로미터|미터|밀리초|초|분|시간|일|년|레벨|배|단위|발|회|キログラム|グラム|キロメートル|メートル|ミリ秒|秒|分|時間|日|年|レベル|倍|単位|発|回))?(?![A-Za-z0-9])/giu;

function canonicalTranslationUnit(value: string | undefined): string {
  const unit = value?.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\./gu, "");
  if (!unit) return "";
  if (unit === "%") return "%";
  if (unit === "x" || unit === "×" || unit === "배" || unit === "倍") return "x";
  if (["kg", "kilogram", "kilograms", "킬로그램", "キログラム"].includes(unit)) return "kg";
  if (["g", "gram", "grams", "그램", "グラム"].includes(unit)) return "g";
  if (["km", "kilometer", "kilometers", "킬로미터", "キロメートル"].includes(unit)) return "km";
  if (["m", "meter", "meters", "미터", "メートル"].includes(unit)) return "m";
  if (["ms", "millisecond", "milliseconds", "밀리초", "ミリ秒"].includes(unit)) return "ms";
  if (["s", "sec", "secs", "second", "seconds", "초", "秒"].includes(unit)) return "s";
  if (["min", "mins", "minute", "minutes", "분", "分"].includes(unit)) return "min";
  if (["hr", "hrs", "hour", "hours", "시간", "時間"].includes(unit)) return "h";
  if (["day", "days", "일", "日"].includes(unit)) return "day";
  if (["year", "years", "년", "年"].includes(unit)) return "year";
  if (["lv", "level", "levels", "레벨", "レベル"].includes(unit)) return "level";
  if (["unit", "units", "단위", "単位"].includes(unit)) return "unit";
  if (["shot", "shots", "발", "発"].includes(unit)) return "shot";
  if (["time", "times", "회", "回"].includes(unit)) return "times";
  return unit;
}

function translationNumericSignature(value: string): { numbers: string[]; boundUnits: string[] } {
  const numbers: string[] = [];
  const boundUnits: string[] = [];
  for (const match of value.normalize("NFKC").matchAll(TRANSLATION_NUMERIC_UNIT_PATTERN)) {
    const number = match[2]!;
    const unit = canonicalTranslationUnit(match[1] ?? match[3]);
    numbers.push(number);
    boundUnits.push(`${number}|${unit}`);
  }
  return { numbers, boundUnits };
}

const TRANSLATION_KOREAN_SCRIPT_PATTERN = /[\p{Script=Hangul}]/u;
const TRANSLATION_JAPANESE_SCRIPT_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

function translationVisibleCharacterCount(value: string): number {
  return Array.from(value.normalize("NFKC").replace(/\s+/gu, " ").trim()).length;
}

function translationHasLocaleScript(value: string, locale: PalworldTranslationLocale): boolean {
  return (locale === "ko" ? TRANSLATION_KOREAN_SCRIPT_PATTERN : TRANSLATION_JAPANESE_SCRIPT_PATTERN).test(value);
}

function translationHasDegenerateRepeatedNgram(value: string): boolean {
  const characters = Array.from(value.normalize("NFKC").replace(/\s+/gu, " ").trim());
  for (const gramLength of [3, 4]) {
    for (let offset = 0; offset + gramLength * 3 <= characters.length; offset += 1) {
      const gram = characters.slice(offset, offset + gramLength).join("");
      let repetitions = 1;
      while (
        offset + gramLength * (repetitions + 1) <= characters.length
        && characters.slice(
          offset + gramLength * repetitions,
          offset + gramLength * (repetitions + 1)
        ).join("") === gram
      ) {
        repetitions += 1;
      }
      if (repetitions >= 3 && gramLength * repetitions >= 12) return true;
    }
  }
  return false;
}

function translationSourceClauseCount(value: string): number {
  return value.split(/[.!?;:]+/u).map((part) => part.trim()).filter(Boolean).length;
}

function validateMachineTranslationQualityAt(
  sourceText: string,
  translatedText: string,
  locale: PalworldTranslationLocale,
  allowEnglishCopy: boolean,
  path: string
): PalworldValidationResult<string> {
  if (!allowEnglishCopy && !translationHasLocaleScript(translatedText, locale)) {
    return invalid(path, `${locale === "ko" ? "한국어" : "일본어"} 문자가 없습니다.`);
  }
  if (translationHasDegenerateRepeatedNgram(translatedText)) {
    return invalid(path, "연속 n-gram 반복 퇴행이 있습니다.");
  }
  const sourceLength = translationVisibleCharacterCount(sourceText);
  const targetLength = translationVisibleCharacterCount(translatedText);
  if (sourceLength >= 20 && targetLength >= 80 && targetLength > sourceLength * 2.5) {
    return invalid(path, "길이가 영어 원문보다 과도하게 증가했습니다.");
  }
  if (
    sourceLength >= 120
    && translationSourceClauseCount(sourceText) >= 3
    && targetLength <= 24
    && targetLength < sourceLength * 0.2
  ) {
    return invalid(path, "지나치게 짧아 영어 원문의 절 대부분이 유실되었습니다.");
  }
  return valid(translatedText);
}

function translationSourceKey(kind: PalworldTranslationRecordKind, id: string): string {
  return `${kind}:${id}`;
}

function translationFieldKey(
  kind: PalworldTranslationRecordKind,
  id: string,
  field: PalworldTranslationField
): string {
  return `${kind}:${id}:${field}`;
}

export function validatePalworldTranslationSnapshot(
  value: unknown,
  context?: PalworldTranslationValidationContext
): PalworldValidationResult<PalworldTranslationSnapshot> {
  const root = recordAt(value, "translation", [
    "schemaVersion",
    "release",
    "locale",
    "sourceCatalogSha256",
    "sourcePaldexSha256",
    "sourceRevision",
    "translationRevision",
    "translationMethod",
    "translationStatus",
    "translatedAt",
    "reviewedAt",
    "records"
  ]);
  if (!root.ok) return root;
  if (root.data.schemaVersion !== 1) return invalid("translation.schemaVersion", "1이어야 합니다.");
  for (const field of ["release", "sourceRevision", "translationRevision"] as const) {
    const result = stringAt(root.data[field], `translation.${field}`, 256);
    if (!result.ok) return result;
  }
  const locale = enumAt(root.data.locale, "translation.locale", PALWORLD_TRANSLATION_LOCALES);
  if (!locale.ok) return locale;
  for (const field of ["sourceCatalogSha256", "sourcePaldexSha256"] as const) {
    const hash = stringAt(root.data[field], `translation.${field}`, 64);
    if (!hash.ok) return hash;
    if (!SHA256_PATTERN.test(hash.data)) return invalid(`translation.${field}`, "소문자 64자리 SHA-256 hex여야 합니다.");
  }
  const method = enumAt(root.data.translationMethod, "translation.translationMethod", PALWORLD_TRANSLATION_METHODS);
  if (!method.ok) return method;
  const snapshotStatus = enumAt(
    root.data.translationStatus,
    "translation.translationStatus",
    PALWORLD_TRANSLATION_SNAPSHOT_STATUSES
  );
  if (!snapshotStatus.ok) return snapshotStatus;
  const translatedAt = isoDateAt(root.data.translatedAt, "translation.translatedAt");
  if (!translatedAt.ok) return translatedAt;
  if (root.data.reviewedAt !== null) {
    const reviewedAt = isoDateAt(root.data.reviewedAt, "translation.reviewedAt");
    if (!reviewedAt.ok) return reviewedAt;
  }

  const records = arrayAt<PalworldTranslationRecord>(
    root.data.records,
    "translation.records",
    MAX_SNAPSHOT_COLLECTION_SIZE,
    (entry, entryPath) => {
    const record = recordAt(entry, entryPath, ["id", "kind", "fields"]);
    if (!record.ok) return record;
    const id = idAt(record.data.id, `${entryPath}.id`);
    if (!id.ok) return id;
    const kind = enumAt(record.data.kind, `${entryPath}.kind`, PALWORLD_TRANSLATION_RECORD_KINDS);
    if (!kind.ok) return kind;
    const allowedFields: readonly PalworldTranslationField[] = kind.data === "skill"
      ? PALWORLD_TRANSLATION_FIELDS
      : ["name", "description"];
    const fields = recordAt(record.data.fields, `${entryPath}.fields`, allowedFields);
    if (!fields.ok) return fields;
    const presentFields = allowedFields.filter((field) => fields.data[field] !== undefined);
    if (presentFields.length === 0) return invalid(`${entryPath}.fields`, "하나 이상의 번역 필드가 필요합니다.");
    for (const field of presentFields) {
      const fieldValue = recordAt(
        fields.data[field],
        `${entryPath}.fields.${field}`,
        [
          "sourceSha256",
          "sourceMessageKey",
          "sourceMember",
          "sourceMemberSha256",
          "text",
          "status",
          "note"
        ]
      );
      if (!fieldValue.ok) return fieldValue;
      const sourceSha256 = stringAt(
        fieldValue.data.sourceSha256,
        `${entryPath}.fields.${field}.sourceSha256`,
        64
      );
      if (!sourceSha256.ok) return sourceSha256;
      if (!SHA256_PATTERN.test(sourceSha256.data)) {
        return invalid(`${entryPath}.fields.${field}.sourceSha256`, "소문자 64자리 SHA-256 hex여야 합니다.");
      }
      const text = validateTranslationArtifactTextAt(
        fieldValue.data.text,
        `${entryPath}.fields.${field}.text`,
        field === "name" ? MAX_NAME_LENGTH : MAX_DESCRIPTION_LENGTH
      );
      if (!text.ok) return text;
      const fieldStatus = enumAt(
        fieldValue.data.status,
        `${entryPath}.fields.${field}.status`,
        PALWORLD_TRANSLATION_STATUSES
      );
      if (!fieldStatus.ok) return fieldStatus;
      const officialMetadataFields = [
        "sourceMessageKey",
        "sourceMember",
        "sourceMemberSha256"
      ] as const;
      if (fieldStatus.data === "source_provided") {
        for (const metadataField of officialMetadataFields) {
          if (!Object.hasOwn(fieldValue.data, metadataField)) {
            return invalid(
              `${entryPath}.fields.${field}.${metadataField}`,
              "공식 source locale 필드에는 exact 출처 정보가 필요합니다."
            );
          }
        }
        const messageKey = translationMessageKeyAt(
          fieldValue.data.sourceMessageKey,
          `${entryPath}.fields.${field}.sourceMessageKey`
        );
        if (!messageKey.ok) return messageKey;
        const sourceMember = translationSourceMemberAt(
          fieldValue.data.sourceMember,
          `${entryPath}.fields.${field}.sourceMember`
        );
        if (!sourceMember.ok) return sourceMember;
        const sourceMemberSha256 = stringAt(
          fieldValue.data.sourceMemberSha256,
          `${entryPath}.fields.${field}.sourceMemberSha256`,
          64
        );
        if (!sourceMemberSha256.ok) return sourceMemberSha256;
        if (!SHA256_PATTERN.test(sourceMemberSha256.data)) {
          return invalid(
            `${entryPath}.fields.${field}.sourceMemberSha256`,
            "소문자 64자리 SHA-256 hex여야 합니다."
          );
        }
      } else if (
        officialMetadataFields.some((metadataField) =>
          Object.hasOwn(fieldValue.data, metadataField)
        )
      ) {
        return invalid(
          `${entryPath}.fields.${field}`,
          "공식 source 출처 정보는 source_provided 필드에만 사용할 수 있습니다."
        );
      }
      if (fieldValue.data.note !== undefined) {
        const note = validateTranslationArtifactTextAt(
          fieldValue.data.note,
          `${entryPath}.fields.${field}.note`,
          1_000
        );
        if (!note.ok) return note;
      }
    }
      return valid(record.data as PalworldTranslationRecord);
    }
  );
  if (!records.ok) return records;

  const seenRecords = new Set<string>();
  let previousKey: string | undefined;
  let sourceProvided = 0;
  let machineAssisted = 0;
  let humanReviewed = 0;
  for (const [index, record] of records.data.entries()) {
    const key = translationSourceKey(record.kind, record.id);
    if (seenRecords.has(key)) return invalid(`translation.records[${index}]`, `중복 canonical ID입니다: ${key}`);
    if (previousKey !== undefined && key <= previousKey) {
      return invalid(`translation.records[${index}]`, "kind:id 오름차순으로 정렬되어야 합니다.");
    }
    seenRecords.add(key);
    previousKey = key;
    for (const field of Object.values(record.fields)) {
      if (field?.status === "source_provided") sourceProvided += 1;
      if (field?.status === "human_reviewed") humanReviewed += 1;
      if (field?.status === "machine_assisted") machineAssisted += 1;
    }
  }
  if (
    method.data === "source_provided"
    && (sourceProvided === 0 || machineAssisted > 0 || humanReviewed > 0)
  ) {
    return invalid(
      "translation.translationMethod",
      "source_provided에는 공식 source 필드만 있어야 합니다."
    );
  }
  if (method.data === "machine_assisted" && (sourceProvided > 0 || humanReviewed > 0)) {
    return invalid(
      "translation.translationMethod",
      "source_provided 또는 human_reviewed 필드가 있으면 machine_assisted일 수 없습니다."
    );
  }
  if (method.data === "human_reviewed" && (sourceProvided > 0 || machineAssisted > 0)) {
    return invalid(
      "translation.translationMethod",
      "source_provided 또는 machine_assisted 필드가 있으면 human_reviewed일 수 없습니다."
    );
  }
  if (
    method.data === "mixed"
    && [sourceProvided, machineAssisted, humanReviewed].filter((count) => count > 0).length < 2
  ) {
    return invalid("translation.translationMethod", "mixed에는 서로 다른 번역 상태가 두 종류 이상 필요합니다.");
  }
  if (humanReviewed > 0 && root.data.reviewedAt === null) {
    return invalid("translation.reviewedAt", "human_reviewed 필드가 있으면 검수 시각이 필요합니다.");
  }

  if (context !== undefined) {
    const contextRelease = stringAt(context.release, "translationContext.release", 256);
    if (!contextRelease.ok) return contextRelease;
    if (root.data.release !== contextRelease.data) {
      return invalid("translation.release", "현재 canonical release와 일치하지 않습니다.");
    }
    if (!SHA256_PATTERN.test(context.sourceCatalogSha256) || !SHA256_PATTERN.test(context.sourcePaldexSha256)) {
      return invalid("translationContext", "canonical source checksum이 올바른 SHA-256이 아닙니다.");
    }
    if (root.data.sourceCatalogSha256 !== context.sourceCatalogSha256) {
      return invalid("translation.sourceCatalogSha256", "현재 catalog checksum과 일치하지 않습니다.");
    }
    if (root.data.sourcePaldexSha256 !== context.sourcePaldexSha256) {
      return invalid("translation.sourcePaldexSha256", "현재 Paldex checksum과 일치하지 않습니다.");
    }
    if (root.data.sourceRevision !== context.sourceRevision) {
      return invalid("translation.sourceRevision", "현재 source revision과 일치하지 않습니다.");
    }
    const sourceByKey = new Map<string, PalworldTranslationSourceRecord>();
    for (const [index, source] of context.records.entries()) {
      const sourceId = idAt(source.id, `translationContext.records[${index}].id`);
      if (!sourceId.ok) return sourceId;
      const sourceKind = enumAt(
        source.kind,
        `translationContext.records[${index}].kind`,
        PALWORLD_TRANSLATION_RECORD_KINDS
      );
      if (!sourceKind.ok) return sourceKind;
      const key = translationSourceKey(source.kind, source.id);
      if (sourceByKey.has(key)) return invalid(`translationContext.records[${index}]`, `중복 source ID입니다: ${key}`);
      sourceByKey.set(key, source);
      const sourceFields = Object.entries(source.fields) as Array<[
        PalworldTranslationField,
        PalworldTranslationSourceField
      ]>;
      if (sourceFields.length === 0) {
        return invalid(`translationContext.records[${index}].fields`, "하나 이상의 영문 원문 필드가 필요합니다.");
      }
      for (const [field, sourceField] of sourceFields) {
        if (!PALWORLD_TRANSLATION_FIELDS.includes(field)) {
          return invalid(`translationContext.records[${index}].fields.${field}`, "허용되지 않은 source 필드입니다.");
        }
        if (source.kind !== "skill" && field === "passiveAbility") {
          return invalid(
            `translationContext.records[${index}].fields.${field}`,
            "passiveAbility 원문은 스킬에만 사용할 수 있습니다."
          );
        }
        const sourceText = stringAt(
          sourceField.text,
          `translationContext.records[${index}].fields.${field}.text`,
          field === "name" ? MAX_NAME_LENGTH : MAX_DESCRIPTION_LENGTH
        );
        if (!sourceText.ok) return sourceText;
        if (!SHA256_PATTERN.test(sourceField.sha256)) {
          return invalid(`translationContext.records[${index}].fields.${field}.sha256`, "올바른 SHA-256이 아닙니다.");
        }
      }
    }
    const officialSourceByKey = new Map<
      string,
      PalworldTranslationOfficialSourceField
    >();
    for (const [index, official] of (context.officialSourceFields ?? []).entries()) {
      const officialPath = `translationContext.officialSourceFields[${index}]`;
      const officialLocale = enumAt(
        official.locale,
        `${officialPath}.locale`,
        PALWORLD_TRANSLATION_LOCALES
      );
      if (!officialLocale.ok) return officialLocale;
      const officialKind = enumAt(
        official.kind,
        `${officialPath}.kind`,
        PALWORLD_TRANSLATION_RECORD_KINDS
      );
      if (!officialKind.ok) return officialKind;
      const officialId = idAt(official.id, `${officialPath}.id`);
      if (!officialId.ok) return officialId;
      if (!PALWORLD_TRANSLATION_FIELDS.includes(official.field)) {
        return invalid(`${officialPath}.field`, "허용되지 않은 공식 locale 필드입니다.");
      }
      if (official.kind !== "skill" && official.field === "passiveAbility") {
        return invalid(`${officialPath}.field`, "passiveAbility 공식 locale은 스킬에만 사용할 수 있습니다.");
      }
      const messageKey = translationMessageKeyAt(
        official.messageKey,
        `${officialPath}.messageKey`
      );
      if (!messageKey.ok) return messageKey;
      const text = validateTranslationArtifactTextAt(
        official.text,
        `${officialPath}.text`,
        official.field === "name" ? MAX_NAME_LENGTH : MAX_DESCRIPTION_LENGTH
      );
      if (!text.ok) return text;
      if (!SHA256_PATTERN.test(official.textSha256)) {
        return invalid(`${officialPath}.textSha256`, "올바른 SHA-256이 아닙니다.");
      }
      const sourceMember = translationSourceMemberAt(
        official.sourceMember,
        `${officialPath}.sourceMember`
      );
      if (!sourceMember.ok) return sourceMember;
      if (!SHA256_PATTERN.test(official.sourceMemberSha256)) {
        return invalid(`${officialPath}.sourceMemberSha256`, "올바른 SHA-256이 아닙니다.");
      }
      const officialKey = `${official.locale}:${translationFieldKey(
        official.kind,
        official.id,
        official.field
      )}`;
      if (officialSourceByKey.has(officialKey)) {
        return invalid(officialPath, `중복 공식 locale 필드입니다: ${officialKey}`);
      }
      officialSourceByKey.set(officialKey, official);
    }
    const equalAllowlist = new Set<string>();
    for (const [index, key] of (context.englishCopyAllowlist ?? []).entries()) {
      const keyText = stringAt(key, `translationContext.englishCopyAllowlist[${index}]`, 256);
      if (!keyText.ok) return keyText;
      if (equalAllowlist.has(keyText.data)) {
        return invalid(`translationContext.englishCopyAllowlist[${index}]`, "중복 glossary 예외입니다.");
      }
      const [kind, id, field, ...extra] = keyText.data.split(":");
      if (
        extra.length > 0
        || !PALWORLD_TRANSLATION_RECORD_KINDS.includes(kind as PalworldTranslationRecordKind)
        || !PALWORLD_TRANSLATION_FIELDS.includes(field as PalworldTranslationField)
        || sourceByKey.get(`${kind}:${id}`)?.fields[field as PalworldTranslationField] === undefined
      ) {
        return invalid(`translationContext.englishCopyAllowlist[${index}]`, "canonical 영문 원문 필드와 일치해야 합니다.");
      }
      equalAllowlist.add(keyText.data);
    }
    const translatedFieldKeys = new Set<string>();
    for (const [index, record] of records.data.entries()) {
      const source = sourceByKey.get(translationSourceKey(record.kind, record.id));
      for (const [field, translation] of Object.entries(record.fields) as Array<[
        PalworldTranslationField,
        PalworldTranslationFieldValue
      ]>) {
        const fieldKey = translationFieldKey(record.kind, record.id, field);
        if (translation.status === "source_provided") {
          const official = officialSourceByKey.get(`${locale.data}:${fieldKey}`);
          if (official === undefined) {
            return invalid(
              `translation.records[${index}].fields.${field}`,
              "검증 context에 exact 공식 locale source가 없습니다."
            );
          }
          if (
            translation.sourceMessageKey !== official.messageKey
            || translation.text !== official.text
            || translation.sourceSha256 !== official.textSha256
            || translation.sourceMember !== official.sourceMember
            || translation.sourceMemberSha256 !== official.sourceMemberSha256
          ) {
            return invalid(
              `translation.records[${index}].fields.${field}`,
              "공식 locale의 message key·값·member checksum과 일치하지 않습니다."
            );
          }
          translatedFieldKeys.add(fieldKey);
          continue;
        }
        if (!source) {
          return invalid(`translation.records[${index}]`, "canonical 영문 source에 없는 orphan ID입니다.");
        }
        const sourceField = source.fields[field];
        if (!sourceField) {
          return invalid(`translation.records[${index}].fields.${field}`, "영문 원문이 없는 필드를 번역할 수 없습니다.");
        }
        if (translation.sourceSha256 !== sourceField.sha256) {
          return invalid(`translation.records[${index}].fields.${field}.sourceSha256`, "현재 영문 원문 hash와 일치하지 않습니다.");
        }
        const normalizedTranslation = translation.text.normalize("NFKC").trim().toLocaleLowerCase("en-US");
        const normalizedSource = sourceField.text.normalize("NFKC").trim().toLocaleLowerCase("en-US");
        if (normalizedTranslation === normalizedSource && !equalAllowlist.has(fieldKey)) {
          return invalid(`translation.records[${index}].fields.${field}.text`, "영문 원문 복사는 명시적 glossary 예외만 허용됩니다.");
        }
        if (translation.status === "machine_assisted") {
          const quality = validateMachineTranslationQualityAt(
            sourceField.text,
            translation.text,
            locale.data,
            equalAllowlist.has(fieldKey),
            `translation.records[${index}].fields.${field}.text`
          );
          if (!quality.ok) return quality;
        }
        const translatedNumbers = translationNumericSignature(translation.text);
        const sourceNumbers = translationNumericSignature(sourceField.text);
        if (translatedNumbers.numbers.join("\u0000") !== sourceNumbers.numbers.join("\u0000")) {
          return invalid(
            `translation.records[${index}].fields.${field}.text`,
            "영문 원문의 숫자 표기를 같은 값·횟수·등장 순서로 보존해야 합니다."
          );
        }
        if (
          [...translatedNumbers.boundUnits].sort().join("\u0000")
          !== [...sourceNumbers.boundUnits].sort().join("\u0000")
        ) {
          return invalid(
            `translation.records[${index}].fields.${field}.text`,
            "영문 원문의 숫자와 인접 단위 결합을 보존해야 합니다."
          );
        }
        const missingSourceSlots = translationSourceMissingSlotCount(sourceField.text);
        if (PALWORLD_TRANSLATION_PLACEHOLDER_RESIDUE_PATTERN.test(translation.text)) {
          return invalid(
            `translation.records[${index}].fields.${field}.text`,
            "번역 중간 placeholder가 남아 있습니다."
          );
        }
        const marker = PALWORLD_TRANSLATION_MISSING_SOURCE_MARKERS[locale.data];
        const markerCount = translation.text.split(marker).length - 1;
        if (markerCount !== missingSourceSlots) {
          return invalid(
            `translation.records[${index}].fields.${field}.text`,
            `locale 누락 marker 수는 영문 원문의 누락 위치 ${missingSourceSlots}개와 정확히 일치해야 합니다.`
          );
        }
        if (missingSourceSlots > 0) {
          if (
            !translation.note?.includes(PALWORLD_TRANSLATION_SOURCE_ANOMALY_NOTE)
          ) {
            return invalid(
              `translation.records[${index}].fields.${field}`,
              `손상된 영문 원문의 ${missingSourceSlots}개 누락 위치를 locale marker와 note로 보존해야 합니다.`
            );
          }
        }
        translatedFieldKeys.add(fieldKey);
      }
    }
    if (snapshotStatus.data === "complete") {
      for (const source of context.records) {
        for (const field of Object.keys(source.fields) as PalworldTranslationField[]) {
          const key = translationFieldKey(source.kind, source.id, field);
          if (!translatedFieldKeys.has(key)) {
            return invalid("translation.translationStatus", `complete snapshot에 번역이 누락되었습니다: ${key}`);
          }
        }
      }
    }
  }
  return valid(root.data as PalworldTranslationSnapshot);
}

export function assertPalworldTranslationSnapshot(
  value: unknown,
  context?: PalworldTranslationValidationContext
): PalworldTranslationSnapshot {
  const result = validatePalworldTranslationSnapshot(value, context);
  if (!result.ok) throw new TypeError(`Palworld 번역 스냅샷 검증에 실패했습니다. ${result.error}`);
  return result.data;
}

export function validatePalworldPalSummary(value: unknown): PalworldValidationResult<PalworldPalSummary> {
  return validatePalSummaryAt(value, "pal");
}

export function validatePalworldPalDetail(value: unknown): PalworldValidationResult<PalworldPalDetail> {
  return validatePalDetailAt(value, "pal");
}

export function validatePalworldItemSummary(value: unknown): PalworldValidationResult<PalworldItemSummary> {
  return validateItemSummaryAt(value, "item");
}

export function validatePalworldItemDetail(value: unknown): PalworldValidationResult<PalworldItemDetail> {
  return validateItemDetailAt(value, "item");
}

export function validatePalworldBreedingDataSnapshot(
  value: unknown
): PalworldValidationResult<PalworldBreedingDataSnapshot> {
  const root = recordAt(value, "breeding", [
    "schemaVersion",
    "release",
    "metadata",
    "parameters",
    "specialRules"
  ]);
  if (!root.ok) return root;
  const schemaVersion = integerAt(root.data.schemaVersion, "breeding.schemaVersion", 1, 1);
  if (!schemaVersion.ok) return schemaVersion;
  const release = stringAt(root.data.release, "breeding.release", 64);
  if (!release.ok) return release;
  const metadata = recordAt(root.data.metadata, "breeding.metadata", [
    "gameVersion",
    "steamBuildId",
    "sourceRevision",
    "sourceType",
    "sourceChecksums"
  ]);
  if (!metadata.ok) return metadata;
  const gameVersion = stringAt(metadata.data.gameVersion, "breeding.metadata.gameVersion", 64);
  if (!gameVersion.ok) return gameVersion;
  if (gameVersion.data !== release.data) {
    return invalid("breeding.metadata.gameVersion", "release와 일치해야 합니다.");
  }
  for (const field of ["steamBuildId", "sourceRevision"] as const) {
    const result = stringAt(metadata.data[field], `breeding.metadata.${field}`, field === "sourceRevision" ? 512 : 64);
    if (!result.ok) return result;
  }
  const sourceType = metadata.data.sourceType;
  if (
    sourceType !== undefined
    && sourceType !== "legacy_catalog"
    && sourceType !== "operator_pak_export"
  ) {
    return invalid("breeding.metadata.sourceType", "허용된 교배 원본 종류가 아닙니다.");
  }
  const checksumFields = sourceType === "operator_pak_export"
    ? ["archive", "breedingArtifact"] as const
    : ["atlasPals", "atlasBreeding", "palCalc", "catalog"] as const;
  const checksums = recordAt(
    metadata.data.sourceChecksums,
    "breeding.metadata.sourceChecksums",
    checksumFields
  );
  if (!checksums.ok) return checksums;
  for (const field of checksumFields) {
    const result = stringAt(checksums.data[field], `breeding.metadata.sourceChecksums.${field}`, 64);
    if (!result.ok) return result;
    if (!SHA256_PATTERN.test(result.data)) {
      return invalid(`breeding.metadata.sourceChecksums.${field}`, "소문자 64자리 SHA-256이어야 합니다.");
    }
  }

  const parameters = arrayAt(
    root.data.parameters,
    "breeding.parameters",
    10_000,
    (entry, path) => {
      const record = recordAt(entry, path, [
        "palId",
        "sourceRowId",
        "sourceInternalId",
        "tribe",
        "bpClass",
        "combiRank",
        "combiDuplicatePriority",
        "ignoreCombi",
        "maleProbability",
        "variantType"
      ]);
      if (!record.ok) return record;
      const palId = idAt(record.data.palId, `${path}.palId`);
      if (!palId.ok) return palId;
      const sourceInternalId = sourceInternalIdAt(record.data.sourceInternalId, `${path}.sourceInternalId`);
      if (!sourceInternalId.ok) return sourceInternalId;
      if (record.data.sourceRowId !== undefined) {
        const sourceRowId = sourceInternalIdAt(record.data.sourceRowId, `${path}.sourceRowId`);
        if (!sourceRowId.ok) return sourceRowId;
      }
      const tribe = sourceInternalIdAt(record.data.tribe, `${path}.tribe`);
      if (!tribe.ok) return tribe;
      if (record.data.bpClass !== undefined) {
        const bpClass = sourceInternalIdAt(record.data.bpClass, `${path}.bpClass`);
        if (!bpClass.ok) return bpClass;
      }
      const combiRank = integerAt(record.data.combiRank, `${path}.combiRank`, 1, MAX_STAT_VALUE);
      if (!combiRank.ok) return combiRank;
      const priority = integerAt(
        record.data.combiDuplicatePriority,
        `${path}.combiDuplicatePriority`,
        0,
        1_000_000_000
      );
      if (!priority.ok) return priority;
      if (record.data.ignoreCombi !== undefined) {
        const ignoreCombi = booleanAt(record.data.ignoreCombi, `${path}.ignoreCombi`);
        if (!ignoreCombi.ok) return ignoreCombi;
      }
      const maleProbability = finiteNumberAt(record.data.maleProbability, `${path}.maleProbability`, 0, 1);
      if (!maleProbability.ok) return maleProbability;
      const variantType = enumAt(record.data.variantType, `${path}.variantType`, ["normal", "variant"] as const);
      if (!variantType.ok) return variantType;
      return valid(record.data as PalworldBreedingPalParameters);
    }
  );
  if (!parameters.ok) return parameters;
  if (parameters.data.length === 0) return invalid("breeding.parameters", "최소 한 개 Pal이 필요합니다.");
  const palIds = new Set<string>();
  const sourceIds = new Set<string>();
  let previousPalId = "";
  for (const [index, parameter] of parameters.data.entries()) {
    if (parameter.palId <= previousPalId) {
      return invalid(`breeding.parameters[${index}].palId`, "중복 없이 public ID 순서로 정렬되어야 합니다.");
    }
    if (palIds.has(parameter.palId) || sourceIds.has(parameter.sourceInternalId)) {
      return invalid(`breeding.parameters[${index}]`, "Pal ID 또는 source internal ID가 중복됩니다.");
    }
    previousPalId = parameter.palId;
    palIds.add(parameter.palId);
    sourceIds.add(parameter.sourceInternalId);
  }
  const parametersById = new Map(parameters.data.map((entry) => [entry.palId, entry]));

  const specialRules = arrayAt(
    root.data.specialRules,
    "breeding.specialRules",
    10_000,
    (entry, path) => {
      const record = recordAt(entry, path, [
        "parentAId",
        "parentASourceInternalId",
        "parentBId",
        "parentBSourceInternalId",
        "childId",
        "childSourceInternalId",
        "parentAGender",
        "parentBGender"
      ]);
      if (!record.ok) return record;
      for (const field of ["parentAId", "parentBId", "childId"] as const) {
        const result = idAt(record.data[field], `${path}.${field}`);
        if (!result.ok) return result;
      }
      for (const field of [
        "parentASourceInternalId",
        "parentBSourceInternalId",
        "childSourceInternalId"
      ] as const) {
        const result = sourceInternalIdAt(record.data[field], `${path}.${field}`);
        if (!result.ok) return result;
      }
      for (const field of ["parentAGender", "parentBGender"] as const) {
        if (record.data[field] === undefined) continue;
        const result = enumAt(record.data[field], `${path}.${field}`, PALWORLD_BREEDING_GENDERS);
        if (!result.ok) return result;
      }
      return valid(record.data as PalworldBreedingSpecialRule);
    }
  );
  if (!specialRules.ok) return specialRules;
  const conditionKeys = new Set<string>();
  let previousRuleKey = "";
  for (const [index, rule] of specialRules.data.entries()) {
    for (const [idField, sourceField] of [
      ["parentAId", "parentASourceInternalId"],
      ["parentBId", "parentBSourceInternalId"],
      ["childId", "childSourceInternalId"]
    ] as const) {
      const parameter = parametersById.get(rule[idField]);
      if (!parameter) return invalid(`breeding.specialRules[${index}].${idField}`, "고아 Pal 참조입니다.");
      if (parameter.sourceInternalId !== rule[sourceField]) {
        return invalid(`breeding.specialRules[${index}].${sourceField}`, "canonical Pal source internal ID와 일치해야 합니다.");
      }
    }
    const orderKey = [
      rule.childId,
      rule.parentAId,
      rule.parentBId,
      rule.parentAGender ?? "",
      rule.parentBGender ?? ""
    ].join("\0");
    if (orderKey <= previousRuleKey) {
      return invalid(`breeding.specialRules[${index}]`, "중복 없이 결정적 순서로 정렬되어야 합니다.");
    }
    previousRuleKey = orderKey;
    const direct = rule.parentAId <= rule.parentBId;
    const conditionKey = direct
      ? [rule.parentAId, rule.parentBId, rule.parentAGender ?? "", rule.parentBGender ?? ""].join("\0")
      : [rule.parentBId, rule.parentAId, rule.parentBGender ?? "", rule.parentAGender ?? ""].join("\0");
    if (conditionKeys.has(conditionKey)) {
      return invalid(`breeding.specialRules[${index}]`, "동일한 부모·성별 조건에 결과가 충돌합니다.");
    }
    conditionKeys.add(conditionKey);
  }
  return valid(root.data as PalworldBreedingDataSnapshot);
}

export function validatePalworldBreedingPair(value: unknown): PalworldValidationResult<PalworldBreedingPair> {
  return validateBreedingPairAt(value, "breedingPair");
}

export function validatePalworldPagination(value: unknown): PalworldValidationResult<PalworldPagination> {
  return validatePaginationAt(value, "pagination");
}

export function validatePalworldPaginatedResponse<T>(
  value: unknown,
  itemValidator: PalworldValidator<T>
): PalworldValidationResult<PalworldPaginatedResponse<T>> {
  const record = recordAt(value, "response", ["items", "pagination", "metadata"]);
  if (!record.ok) return record;
  const items = arrayAt(record.data.items, "response.items", MAX_API_COLLECTION_SIZE, (entry, path) => {
    const result = itemValidator(entry);
    return result.ok ? result : invalid(path, result.error);
  });
  if (!items.ok) return items;
  const pagination = validatePaginationAt(record.data.pagination, "response.pagination");
  if (!pagination.ok) return pagination;
  const itemCount = validatePageItemCountAt(items.data.length, pagination.data, "response.items");
  if (!itemCount.ok) return itemCount;
  const metadata = validateMetadataAt(record.data.metadata, "response.metadata");
  return metadata.ok ? valid(record.data as PalworldPaginatedResponse<T>) : metadata;
}

export function validatePalworldMetaResponse(value: unknown): PalworldValidationResult<PalworldMetaResponse> {
  const record = recordAt(value, "response", ["metadata", "counts", "domains", "gates", "coverage"]);
  if (!record.ok) return record;
  const metadata = validateMetadataAt(record.data.metadata, "response.metadata");
  if (!metadata.ok) return metadata;
  const counts = recordAt(record.data.counts, "response.counts", ["pals", "items", "breedingPairs", "skills"]);
  if (!counts.ok) return counts;
  for (const field of ["pals", "items", "breedingPairs"] as const) {
    const result = integerAt(counts.data[field], `response.counts.${field}`, 0, 100_000_000);
    if (!result.ok) return result;
  }
  if (counts.data.skills !== undefined) {
    const skills = integerAt(counts.data.skills, "response.counts.skills", 0, 100_000_000);
    if (!skills.ok) return skills;
  }
  const domains = recordAt(record.data.domains, "response.domains", ["pals", "items", "breeding", "skills"]);
  if (!domains.ok) return domains;
  for (const field of ["pals", "items", "breeding"] as const) {
    const result = validateDomainCoverageAt(domains.data[field], `response.domains.${field}`);
    if (!result.ok) return result;
  }
  if ((counts.data.skills === undefined) !== (domains.data.skills === undefined)) {
    return invalid("response.domains.skills", "counts.skills와 함께 제공해야 합니다.");
  }
  if (domains.data.skills !== undefined) {
    const skills = validateDomainCoverageAt(domains.data.skills, "response.domains.skills");
    if (!skills.ok) return skills;
  }
  const palDomain = domains.data.pals as PalworldDomainCoverage;
  if (
    palDomain.metadata.gameVersion !== metadata.data.gameVersion ||
    palDomain.metadata.sourceRevision !== metadata.data.sourceRevision
  ) {
    return invalid("response.domains.pals.metadata", "최상위 metadata와 활성 Pal 데이터 출처가 일치해야 합니다.");
  }
  const expectedCounts = {
    pals: counts.data.pals,
    items: counts.data.items,
    breeding: counts.data.breedingPairs
  };
  for (const field of ["pals", "items", "breeding"] as const) {
    const domain = domains.data[field] as PalworldDomainCoverage;
    if (domain.recordCount !== expectedCounts[field]) {
      return invalid(`response.domains.${field}.recordCount`, "counts의 해당 도메인 수와 일치해야 합니다.");
    }
  }
  if (
    domains.data.skills !== undefined &&
    (domains.data.skills as PalworldDomainCoverage).recordCount !== counts.data.skills
  ) {
    return invalid("response.domains.skills.recordCount", "counts.skills와 일치해야 합니다.");
  }
  if (counts.data.skills !== undefined && record.data.coverage === undefined) {
    return invalid("response.coverage", "스킬 도메인을 제공할 때는 상세·이미지·현지화 coverage가 필요합니다.");
  }
  let validatedCoverage: PalworldDataCoverage | undefined;
  if (record.data.coverage !== undefined) {
    const coverage = validateDataCoverageAt(record.data.coverage, "response.coverage");
    if (!coverage.ok) return coverage;
    validatedCoverage = coverage.data;
    const expectedTotals = {
      palDetails: counts.data.pals as number,
      itemDetails: counts.data.items as number,
      skillDetails: (counts.data.skills as number | undefined) ?? 0,
      palDescriptions: counts.data.pals as number,
      palStats: counts.data.pals as number,
      partnerSkills: counts.data.pals as number,
      activeSkills: counts.data.pals as number,
      palDrops: counts.data.pals as number,
      breedingFields: counts.data.pals as number,
      itemDescriptions: counts.data.items as number,
      craftingRecipes: counts.data.items as number,
      craftingFacilities: counts.data.items as number,
      dropPals: counts.data.items as number,
      technologyLevels: counts.data.items as number,
      prices: counts.data.items as number,
      durability: counts.data.items as number,
      acquisitionMethods: counts.data.items as number,
      skillDescriptions: (counts.data.skills as number | undefined) ?? 0,
      relatedPals: (counts.data.skills as number | undefined) ?? 0,
      palImages: counts.data.pals as number,
      itemImages: counts.data.items as number
    };
    for (const field of [
      "palDetails",
      "itemDetails",
      "skillDetails",
      "palDescriptions",
      "palStats",
      "partnerSkills",
      "activeSkills",
      "palDrops",
      "breedingFields",
      "itemDescriptions",
      "craftingRecipes",
      "craftingFacilities",
      "dropPals",
      "technologyLevels",
      "prices",
      "durability",
      "acquisitionMethods",
      "skillDescriptions",
      "relatedPals",
      "palImages",
      "itemImages"
    ] as const) {
      if (coverage.data[field].total !== expectedTotals[field]) {
        return invalid(`response.coverage.${field}.total`, "counts의 해당 레코드 수와 일치해야 합니다.");
      }
    }
    if (coverage.data.elementImages.total > PALWORLD_ELEMENTS.length) {
      return invalid("response.coverage.elementImages.total", `최대 ${PALWORLD_ELEMENTS.length}개까지 허용됩니다.`);
    }
    const localizedRecordTotal = (counts.data.pals as number)
      + (counts.data.items as number)
      + ((counts.data.skills as number | undefined) ?? 0);
    for (const locale of ["ko", "ja", "en"] as const) {
      if (coverage.data.localization[locale].total !== localizedRecordTotal) {
        return invalid(
          `response.coverage.localization.${locale}.total`,
          "Pal·아이템·스킬 레코드 수의 합과 일치해야 합니다."
        );
      }
    }
    if (coverage.data.translations !== undefined) {
      for (const locale of PALWORLD_TRANSLATION_LOCALES) {
        const translated = coverage.data.translations[locale];
        if (translated.palNames.total !== counts.data.pals) {
          return invalid(`response.coverage.translations.${locale}.palNames.total`, "counts.pals와 일치해야 합니다.");
        }
        if (translated.itemNames.total !== counts.data.items) {
          return invalid(`response.coverage.translations.${locale}.itemNames.total`, "counts.items와 일치해야 합니다.");
        }
        if (translated.skillNames.total !== ((counts.data.skills as number | undefined) ?? 0)) {
          return invalid(`response.coverage.translations.${locale}.skillNames.total`, "counts.skills와 일치해야 합니다.");
        }
        if (translated.palDescriptions.total > (counts.data.pals as number)) {
          return invalid(`response.coverage.translations.${locale}.palDescriptions.total`, "Pal 수보다 클 수 없습니다.");
        }
        if (translated.itemDescriptions.total > (counts.data.items as number)) {
          return invalid(`response.coverage.translations.${locale}.itemDescriptions.total`, "아이템 수보다 클 수 없습니다.");
        }
        if (translated.skillDescriptions.total > ((counts.data.skills as number | undefined) ?? 0)) {
          return invalid(`response.coverage.translations.${locale}.skillDescriptions.total`, "스킬 수보다 클 수 없습니다.");
        }
        if (translated.skillPassiveAbilities.total > ((counts.data.skills as number | undefined) ?? 0)) {
          return invalid(`response.coverage.translations.${locale}.skillPassiveAbilities.total`, "스킬 수보다 클 수 없습니다.");
        }
      }
    }
  }
  const gates = recordAt(record.data.gates, "response.gates", ["dataIntegrity", "imageAssets"]);
  if (!gates.ok) return gates;
  const dataIntegrity = recordAt(gates.data.dataIntegrity, "response.gates.dataIntegrity", ["passed", "status"]);
  if (!dataIntegrity.ok) return dataIntegrity;
  const dataIntegrityPassed = booleanAt(dataIntegrity.data.passed, "response.gates.dataIntegrity.passed");
  if (!dataIntegrityPassed.ok) return dataIntegrityPassed;
  if (dataIntegrity.data.status !== "ready" && dataIntegrity.data.status !== "unavailable") {
    return invalid("response.gates.dataIntegrity.status", "ready 또는 unavailable이어야 합니다.");
  }
  if (dataIntegrityPassed.data !== (dataIntegrity.data.status === "ready")) {
    return invalid("response.gates.dataIntegrity", "passed와 status가 일치해야 합니다.");
  }
  const imageAssets = recordAt(gates.data.imageAssets, "response.gates.imageAssets", [
    "status",
    "policyStatus",
    "technicalPassed",
    "publicActivationAllowed",
    "rightsVerified",
    "usageBasis",
    "readyImages",
    "fallbackPals",
    "publicNoticeRequired"
  ]);
  if (!imageAssets.ok) return imageAssets;
  if (!(PALWORLD_IMAGE_ASSET_STATUSES as readonly unknown[]).includes(imageAssets.data.status)) {
    return invalid("response.gates.imageAssets.status", "허용된 이미지 상태가 아닙니다.");
  }
  if (!(PALWORLD_IMAGE_POLICY_STATUSES as readonly unknown[]).includes(imageAssets.data.policyStatus)) {
    return invalid("response.gates.imageAssets.policyStatus", "허용된 이미지 정책 상태가 아닙니다.");
  }
  for (const field of ["technicalPassed", "publicActivationAllowed", "rightsVerified", "publicNoticeRequired"] as const) {
    const result = booleanAt(imageAssets.data[field], `response.gates.imageAssets.${field}`);
    if (!result.ok) return result;
  }
  if (!(PALWORLD_IMAGE_USAGE_BASES as readonly unknown[]).includes(imageAssets.data.usageBasis)) {
    return invalid("response.gates.imageAssets.usageBasis", "허용된 이미지 사용 근거가 아닙니다.");
  }
  for (const field of ["readyImages", "fallbackPals"] as const) {
    const result = integerAt(imageAssets.data[field], `response.gates.imageAssets.${field}`, 0, 100_000_000);
    if (!result.ok) return result;
  }
  if ((imageAssets.data.readyImages as number) + (imageAssets.data.fallbackPals as number) !== counts.data.pals) {
    return invalid("response.gates.imageAssets", "readyImages와 fallbackPals의 합은 Pal 수와 같아야 합니다.");
  }
  if (
    validatedCoverage !== undefined &&
    (
      validatedCoverage.palImages.available !== imageAssets.data.readyImages ||
      validatedCoverage.palImages.missing !== imageAssets.data.fallbackPals
    )
  ) {
    return invalid("response.coverage.palImages", "Pal 이미지 coverage와 runtime image gate가 일치해야 합니다.");
  }
  const status = imageAssets.data.status as PalworldImageAssetStatus;
  const policyStatus = imageAssets.data.policyStatus as PalworldImagePolicyStatus;
  const technicalPassed = imageAssets.data.technicalPassed as boolean;
  const publicActivationAllowed = imageAssets.data.publicActivationAllowed as boolean;
  const rightsVerified = imageAssets.data.rightsVerified as boolean;
  const usageBasis = imageAssets.data.usageBasis as PalworldImageUsageBasis;
  const readyImages = imageAssets.data.readyImages as number;
  const fallbackPals = imageAssets.data.fallbackPals as number;
  if (imageAssets.data.publicNoticeRequired !== true) {
    return invalid("response.gates.imageAssets.publicNoticeRequired", "공개 Palworld 페이지에는 출처 공지가 필요합니다.");
  }
  if (status === "blocked_by_license") {
    const blockedUsageIsConsistent = policyStatus === "missing"
      ? usageBasis === "none"
      : policyStatus === "blocked_by_license"
        ? usageBasis === "none"
        : policyStatus === "operator_acknowledged"
          ? !rightsVerified && usageBasis === "operator_reference_use"
          : policyStatus === "rights_verified" && rightsVerified && usageBasis === "rights_verified";
    if (technicalPassed || publicActivationAllowed || !blockedUsageIsConsistent || readyImages !== 0) {
      return invalid("response.gates.imageAssets", "blocked_by_license 상태와 기술·권리·공개 사용 정보가 일치해야 합니다.");
    }
  } else if (status === "partial") {
    const partialUsageIsConsistent = policyStatus === "operator_acknowledged"
      ? !rightsVerified && usageBasis === "operator_reference_use"
      : policyStatus === "rights_verified" && rightsVerified && usageBasis === "rights_verified";
    if (!technicalPassed || !publicActivationAllowed || !partialUsageIsConsistent || readyImages === 0 || fallbackPals === 0) {
      return invalid("response.gates.imageAssets", "partial 상태는 검증된 일부 이미지만 공개 가능한 상태여야 합니다.");
    }
  } else if (status === "operator_acknowledged") {
    if (policyStatus !== "operator_acknowledged" || !technicalPassed || !publicActivationAllowed || rightsVerified || usageBasis !== "operator_reference_use" || fallbackPals !== 0) {
      return invalid("response.gates.imageAssets", "operator_acknowledged 상태는 권리 검증 없이 운영자 사용 확인과 전체 기술 검증만 통과해야 합니다.");
    }
  } else if (policyStatus !== "rights_verified" || !technicalPassed || !publicActivationAllowed || !rightsVerified || usageBasis !== "rights_verified" || fallbackPals !== 0) {
    return invalid("response.gates.imageAssets", "ready 상태는 별도 권리 검증과 전체 기술 검증을 모두 통과해야 합니다.");
  }
  return valid(record.data as PalworldMetaResponse);
}

export function validatePalworldSearchResult(value: unknown): PalworldValidationResult<PalworldSearchResult> {
  const record = recordAt(value, "searchResult", ["query", "total", "pals", "items", "metadata", "domains"]);
  if (!record.ok) return record;
  const query = stringAt(record.data.query, "searchResult.query", MAX_NAME_LENGTH, true);
  if (!query.ok) return query;
  const total = integerAt(record.data.total, "searchResult.total", 0, 100_000_000);
  if (!total.ok) return total;
  const pals = arrayAt(record.data.pals, "searchResult.pals", MAX_API_COLLECTION_SIZE, validatePalSummaryAt);
  if (!pals.ok) return pals;
  const items = arrayAt(record.data.items, "searchResult.items", MAX_API_COLLECTION_SIZE, validateItemSummaryAt);
  if (!items.ok) return items;
  if (total.data < pals.data.length + items.data.length) {
    return invalid("searchResult.total", "반환된 Pal과 아이템 결과 수의 합 이상이어야 합니다.");
  }
  const metadata = validateMetadataAt(record.data.metadata, "searchResult.metadata");
  if (!metadata.ok) return metadata;
  const domains = recordAt(record.data.domains, "searchResult.domains", ["pals", "items"]);
  if (!domains.ok) return domains;
  for (const field of ["pals", "items"] as const) {
    const result = validateDomainCoverageAt(domains.data[field], `searchResult.domains.${field}`);
    if (!result.ok) return result;
    const returnedCount = field === "pals" ? pals.data.length : items.data.length;
    if (result.data.recordCount < returnedCount) {
      return invalid(`searchResult.domains.${field}.recordCount`, "반환된 검색 결과 수 이상이어야 합니다.");
    }
  }
  const palDomain = domains.data.pals as PalworldDomainCoverage;
  if (
    palDomain.metadata.gameVersion !== metadata.data.gameVersion ||
    palDomain.metadata.sourceRevision !== metadata.data.sourceRevision
  ) {
    return invalid("searchResult.domains.pals.metadata", "최상위 metadata와 활성 Pal 데이터 출처가 일치해야 합니다.");
  }
  return valid(record.data as PalworldSearchResult);
}

export function validatePalworldBreedingResultResponse(
  value: unknown
): PalworldValidationResult<PalworldBreedingResultResponse> {
  const record = recordAt(value, "response", [
    "parentA",
    "parentB",
    "result",
    "state",
    "alternatives",
    "metadata"
  ]);
  if (!record.ok) return record;
  const parentA = validatePalReferenceAt(record.data.parentA, "response.parentA");
  if (!parentA.ok) return parentA;
  const parentB = validatePalReferenceAt(record.data.parentB, "response.parentB");
  if (!parentB.ok) return parentB;
  const state = enumAt(
    record.data.state,
    "response.state",
    PALWORLD_BREEDING_RESOLUTION_STATES
  );
  if (!state.ok) return state;
  const alternatives = arrayAt(
    record.data.alternatives,
    "response.alternatives",
    MAX_API_COLLECTION_SIZE,
    validateBreedingPairAt
  );
  if (!alternatives.ok) return alternatives;
  const validateRequestedParents = (
    rawPair: unknown,
    path: string
  ): PalworldValidationResult<PalworldBreedingPair> => {
    const result = validateBreedingPairAt(rawPair, path);
    if (!result.ok) return result;
    const directOrder = result.data.parentA.id === parentA.data.id && result.data.parentB.id === parentB.data.id;
    const reverseOrder = result.data.parentA.id === parentB.data.id && result.data.parentB.id === parentA.data.id;
    if (!directOrder && !reverseOrder) {
      return invalid(path, "요청한 부모 Pal 조합과 일치해야 합니다.");
    }
    const expectedParentA = directOrder ? parentA.data : parentB.data;
    const expectedParentB = directOrder ? parentB.data : parentA.data;
    const parentAReference = validateCanonicalPalReferenceAt(result.data.parentA, expectedParentA, `${path}.parentA`);
    if (!parentAReference.ok) return parentAReference;
    const parentBReference = validateCanonicalPalReferenceAt(result.data.parentB, expectedParentB, `${path}.parentB`);
    if (!parentBReference.ok) return parentBReference;
    return valid(result.data);
  };
  if (record.data.result !== null) {
    const result = validateRequestedParents(record.data.result, "response.result");
    if (!result.ok) return result;
  }
  for (const [index, alternative] of alternatives.data.entries()) {
    const result = validateRequestedParents(alternative, `response.alternatives[${index}]`);
    if (!result.ok) return result;
  }
  if (state.data === "resolved") {
    if (record.data.result === null || alternatives.data.length !== 0) {
      return invalid("response.state", "resolved 상태는 단일 result와 빈 alternatives를 가져야 합니다.");
    }
  } else if (state.data === "requires_gender") {
    if (record.data.result !== null || alternatives.data.length < 2) {
      return invalid("response.state", "requires_gender 상태는 둘 이상의 alternatives를 가져야 합니다.");
    }
  } else if (record.data.result !== null || alternatives.data.length !== 0) {
    return invalid("response.state", `${state.data} 상태에는 result 또는 alternatives가 없어야 합니다.`);
  }
  const metadata = validateMetadataAt(record.data.metadata, "response.metadata");
  return metadata.ok ? valid(record.data as PalworldBreedingResultResponse) : metadata;
}

export function validatePalworldBreedingParentsResponse(
  value: unknown
): PalworldValidationResult<PalworldBreedingParentsResponse> {
  const record = recordAt(value, "response", ["child", "items", "pagination", "state", "metadata"]);
  if (!record.ok) return record;
  const child = validatePalReferenceAt(record.data.child, "response.child");
  if (!child.ok) return child;
  const items = arrayAt(record.data.items, "response.items", MAX_API_COLLECTION_SIZE, validateBreedingPairAt);
  if (!items.ok) return items;
  const pagination = validatePaginationAt(record.data.pagination, "response.pagination");
  if (!pagination.ok) return pagination;
  const itemCount = validatePageItemCountAt(items.data.length, pagination.data, "response.items");
  if (!itemCount.ok) return itemCount;
  const state = enumAt(record.data.state, "response.state", [
    "resolved",
    "not_found",
    "data_unavailable"
  ] as const);
  if (!state.ok) return state;
  if (state.data === "resolved" && pagination.data.total === 0) {
    return invalid("response.state", "resolved 상태에는 하나 이상의 부모 조합이 필요합니다.");
  }
  if (state.data !== "resolved" && pagination.data.total !== 0) {
    return invalid("response.state", `${state.data} 상태에는 부모 조합이 없어야 합니다.`);
  }
  for (const [index, pair] of items.data.entries()) {
    const childReference = validateCanonicalPalReferenceAt(pair.child, child.data, `response.items[${index}].child`);
    if (!childReference.ok) return childReference;
  }
  const metadata = validateMetadataAt(record.data.metadata, "response.metadata");
  return metadata.ok ? valid(record.data as PalworldBreedingParentsResponse) : metadata;
}

function identifierAliases(id: string): string[] {
  const normalized = id.toLocaleLowerCase();
  return [...new Set([
    normalized,
    normalized.replaceAll("_", "-"),
    normalized.replaceAll("-", "_")
  ])];
}

function validateUniqueIds<T extends { id: string }>(entries: T[], path: string): PalworldValidationResult<T[]> {
  const seenAliases = new Map<string, string>();
  for (const [index, entry] of entries.entries()) {
    for (const alias of identifierAliases(entry.id)) {
      const existingId = seenAliases.get(alias);
      if (existingId !== undefined) {
        const kind = existingId === entry.id ? "중복 ID" : "ID alias 충돌";
        return invalid(`${path}[${index}].id`, `${kind}입니다: ${existingId}, ${entry.id}`);
      }
      seenAliases.set(alias, entry.id);
    }
  }
  return valid(entries);
}

function validateCanonicalPalReferenceAt(
  reference: PalworldPalReference,
  canonical: PalworldPalReference,
  path: string
): PalworldValidationResult<PalworldPalReference> {
  for (const field of ["id", "number", "nameKo", "nameJa", "nameEn", "imageUrl", "imageWidth", "imageHeight"] as const) {
    if (reference[field] !== canonical[field]) {
      return invalid(`${path}.${field}`, "canonical Pal 레코드와 일치해야 합니다.");
    }
  }
  if (
    reference.elements.length !== canonical.elements.length ||
    reference.elements.some((element, index) => element !== canonical.elements[index])
  ) {
    return invalid(`${path}.elements`, "canonical Pal 레코드와 일치해야 합니다.");
  }
  if (!sameTranslationLocaleStatus(reference.translation?.name, canonical.translation?.name)) {
    return invalid(`${path}.translation.name`, "canonical Pal 레코드와 일치해야 합니다.");
  }
  return valid(reference);
}

function sameLocalizationFallback(
  left: PalworldLocalizationFallback | undefined,
  right: PalworldLocalizationFallback | undefined
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.sourceLanguage === right.sourceLanguage && left.ko === right.ko && left.ja === right.ja;
}

function sameTranslationLocaleStatus(
  left: PalworldTranslationLocaleStatus | undefined,
  right: PalworldTranslationLocaleStatus | undefined
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.ko === right.ko && left.ja === right.ja;
}

function validateCanonicalItemReferenceAt(
  reference: PalworldItemReference,
  canonical: PalworldItemReference,
  path: string
): PalworldValidationResult<PalworldItemReference> {
  for (const field of ["id", "nameKo", "nameJa", "nameEn", "imageUrl", "imageWidth", "imageHeight"] as const) {
    if (reference[field] !== canonical[field]) {
      return invalid(`${path}.${field}`, "canonical 아이템 레코드와 일치해야 합니다.");
    }
  }
  if (!sameLocalizationFallback(reference.localization, canonical.localization)) {
    return invalid(`${path}.localization`, "canonical 아이템 레코드와 일치해야 합니다.");
  }
  if (!sameTranslationLocaleStatus(reference.translation?.name, canonical.translation?.name)) {
    return invalid(`${path}.translation.name`, "canonical 아이템 레코드와 일치해야 합니다.");
  }
  return valid(reference);
}

function validateCanonicalSkillAt(
  skill: PalworldSkill,
  canonical: PalworldSkillDetail,
  path: string
): PalworldValidationResult<PalworldSkill> {
  for (const field of [
    "id",
    "sourceInternalId",
    "type",
    "nameKo",
    "nameJa",
    "nameEn",
    "descriptionKo",
    "descriptionJa",
    "descriptionEn",
    "element",
    "power",
    "cooldownSeconds",
    "passiveTier",
    "passiveAbility",
    "passiveAbilityKo",
    "passiveAbilityJa"
  ] as const) {
    if (skill[field] !== canonical[field]) {
      return invalid(`${path}.${field}`, "canonical 스킬 레코드와 일치해야 합니다.");
    }
  }
  if (!sameLocalizationFallback(skill.localization, canonical.localization)) {
    return invalid(`${path}.localization`, "canonical 스킬 레코드와 일치해야 합니다.");
  }
  for (const field of ["name", "description", "passiveAbility"] as const) {
    if (!sameTranslationLocaleStatus(skill.translation?.[field], canonical.translation?.[field])) {
      return invalid(`${path}.translation.${field}`, "canonical 스킬 레코드와 일치해야 합니다.");
    }
  }
  return valid(skill);
}

function sameSnapshotMetadata(metadata: PalworldDataMetadata, detailMetadata: PalworldDataMetadata): boolean {
  return (
    metadata.gameVersion === detailMetadata.gameVersion
    && metadata.sourceName === detailMetadata.sourceName
    && metadata.sourceUrl === detailMetadata.sourceUrl
    && metadata.sourceRevision === detailMetadata.sourceRevision
    && metadata.sourceChecksum === detailMetadata.sourceChecksum
    && metadata.extractedAt === detailMetadata.extractedAt
    && metadata.verifiedAt === detailMetadata.verifiedAt
    && metadata.license === detailMetadata.license
    && metadata.rightsVerified === detailMetadata.rightsVerified
  );
}

export function validatePalworldDataSnapshot(value: unknown): PalworldValidationResult<PalworldDataSnapshot> {
  const record = recordAt(value, "snapshot", ["metadata", "pals", "items", "breedingPairs", "skills", "elements"]);
  if (!record.ok) return record;
  const metadata = validateMetadataAt(record.data.metadata, "snapshot.metadata");
  if (!metadata.ok) return metadata;
  const pals = arrayAt(record.data.pals, "snapshot.pals", MAX_SNAPSHOT_COLLECTION_SIZE, validatePalDetailAt);
  if (!pals.ok) return pals;
  const items = arrayAt(record.data.items, "snapshot.items", MAX_SNAPSHOT_COLLECTION_SIZE, validateItemDetailAt);
  if (!items.ok) return items;
  const pairs = arrayAt(record.data.breedingPairs, "snapshot.breedingPairs", MAX_SNAPSHOT_COLLECTION_SIZE, validateBreedingPairAt);
  if (!pairs.ok) return pairs;
  const skills = record.data.skills === undefined
    ? valid<PalworldSkillDetail[]>([])
    : arrayAt(record.data.skills, "snapshot.skills", MAX_SNAPSHOT_COLLECTION_SIZE, validateSkillDetailAt);
  if (!skills.ok) return skills;
  const elements = record.data.elements === undefined
    ? valid<PalworldElementDefinition[]>([])
    : arrayAt(record.data.elements, "snapshot.elements", PALWORLD_ELEMENTS.length, validateElementDefinitionAt);
  if (!elements.ok) return elements;
  const uniquePals = validateUniqueIds(pals.data, "snapshot.pals");
  if (!uniquePals.ok) return uniquePals;
  const uniqueItems = validateUniqueIds(items.data, "snapshot.items");
  if (!uniqueItems.ok) return uniqueItems;
  const uniquePairs = validateUniqueIds(pairs.data, "snapshot.breedingPairs");
  if (!uniquePairs.ok) return uniquePairs;
  const uniqueSkills = validateUniqueIds(skills.data, "snapshot.skills");
  if (!uniqueSkills.ok) return uniqueSkills;
  const uniqueElements = validateUniqueIds(elements.data, "snapshot.elements");
  if (!uniqueElements.ok) return uniqueElements;

  const palsById = new Map(pals.data.map((pal) => [pal.id, pal]));
  const itemsById = new Map(items.data.map((item) => [item.id, item]));
  const skillsById = new Map(skills.data.map((skill) => [skill.id, skill]));
  const elementsById = new Map(elements.data.map((element) => [element.id, element]));
  const hasSkillCollection = record.data.skills !== undefined;
  const hasElementCollection = record.data.elements !== undefined;
  for (const [index, pal] of pals.data.entries()) {
    if (!sameSnapshotMetadata(metadata.data, pal.metadata)) {
      return invalid(
        `snapshot.pals[${index}].metadata`,
        "snapshot과 metadata가 같아야 합니다."
      );
    }
    if (pal.imageUrl !== undefined && palImageVersion(pal.imageUrl) !== metadata.data.gameVersion) {
      return invalid(
        `snapshot.pals[${index}].imageUrl`,
        "Pal 이미지 경로 버전은 snapshot metadata.gameVersion과 같아야 합니다."
      );
    }
    if (hasElementCollection) {
      for (const element of pal.elements) {
        if (!elementsById.has(element)) {
          return invalid(`snapshot.pals[${index}].elements`, `정의되지 않은 속성 참조입니다: ${element}`);
        }
      }
    }
    if (hasSkillCollection && pal.partnerSkill !== undefined) {
      const canonicalSkill = skillsById.get(pal.partnerSkill.id);
      if (!canonicalSkill) {
        return invalid(`snapshot.pals[${index}].partnerSkill`, `존재하지 않는 스킬 참조입니다: ${pal.partnerSkill.id}`);
      }
      const canonical = validateCanonicalSkillAt(pal.partnerSkill, canonicalSkill, `snapshot.pals[${index}].partnerSkill`);
      if (!canonical.ok) return canonical;
      const assignment = canonicalSkill.relatedPals.find((entry) => entry.pal.id === pal.id);
      if (!assignment) {
        return invalid(`snapshot.pals[${index}].partnerSkill`, "canonical 스킬의 relatedPals에 현재 Pal이 필요합니다.");
      }
    }
    if (hasSkillCollection) {
      for (const [skillIndex, activeSkill] of pal.activeSkills.entries()) {
        const canonicalSkill = skillsById.get(activeSkill.id);
        if (!canonicalSkill) {
          return invalid(`snapshot.pals[${index}].activeSkills[${skillIndex}]`, `존재하지 않는 스킬 참조입니다: ${activeSkill.id}`);
        }
        const canonical = validateCanonicalSkillAt(activeSkill, canonicalSkill, `snapshot.pals[${index}].activeSkills[${skillIndex}]`);
        if (!canonical.ok) return canonical;
        const assignment = canonicalSkill.relatedPals.find((entry) => entry.pal.id === pal.id);
        if (!assignment) {
          return invalid(`snapshot.pals[${index}].activeSkills[${skillIndex}]`, "canonical 스킬의 relatedPals에 현재 Pal이 필요합니다.");
        }
        if (assignment.unlockLevel !== activeSkill.unlockLevel) {
          return invalid(`snapshot.pals[${index}].activeSkills[${skillIndex}].unlockLevel`, "canonical 스킬 배정과 일치해야 합니다.");
        }
      }
    }
    for (const [dropIndex, drop] of pal.drops.entries()) {
      const canonicalItem = itemsById.get(drop.id);
      if (!canonicalItem) {
        return invalid(`snapshot.pals[${index}].drops[${dropIndex}]`, `존재하지 않는 아이템 참조입니다: ${drop.id}`);
      }
      const reference = validateCanonicalItemReferenceAt(drop, canonicalItem, `snapshot.pals[${index}].drops[${dropIndex}]`);
      if (!reference.ok) return reference;
      if (!canonicalItem.dropPals.some((entry) => entry.id === pal.id)) {
        return invalid(
          `snapshot.pals[${index}].drops[${dropIndex}]`,
          `canonical 아이템의 dropPals 역참조가 없습니다: ${pal.id} -> ${drop.id}`
        );
      }
    }
    for (const [dropIndex, drop] of (pal.dropDetails ?? []).entries()) {
      const canonicalItem = itemsById.get(drop.item.id);
      if (!canonicalItem) {
        return invalid(`snapshot.pals[${index}].dropDetails[${dropIndex}].item`, `존재하지 않는 아이템 참조입니다: ${drop.item.id}`);
      }
      const reference = validateCanonicalItemReferenceAt(
        drop.item,
        canonicalItem,
        `snapshot.pals[${index}].dropDetails[${dropIndex}].item`
      );
      if (!reference.ok) return reference;
    }
    for (const specialPair of pal.breeding.specialParentPairs) {
      if (!palsById.has(specialPair.parentAId) || !palsById.has(specialPair.parentBId)) {
        return invalid(`snapshot.pals[${index}].breeding.specialParentPairs`, "존재하지 않는 부모 Pal 참조가 있습니다.");
      }
    }
  }
  for (const [index, item] of items.data.entries()) {
    if (!sameSnapshotMetadata(metadata.data, item.metadata)) {
      return invalid(
        `snapshot.items[${index}].metadata`,
        "snapshot과 metadata가 같아야 합니다."
      );
    }
    if (item.imageUrl !== undefined && itemImageVersion(item.imageUrl) !== metadata.data.gameVersion) {
      return invalid(
        `snapshot.items[${index}].imageUrl`,
        "아이템 이미지 경로 버전은 snapshot metadata.gameVersion과 같아야 합니다."
      );
    }
    for (const [materialIndex, material] of item.craftingMaterials.entries()) {
      const canonicalItem = itemsById.get(material.item.id);
      if (!canonicalItem) {
        return invalid(`snapshot.items[${index}].craftingMaterials[${materialIndex}].item`, `존재하지 않는 아이템 참조입니다: ${material.item.id}`);
      }
      const reference = validateCanonicalItemReferenceAt(
        material.item,
        canonicalItem,
        `snapshot.items[${index}].craftingMaterials[${materialIndex}].item`
      );
      if (!reference.ok) return reference;
    }
    for (const [recipeIndex, recipe] of (item.recipes ?? []).entries()) {
      for (const [materialIndex, material] of recipe.materials.entries()) {
        const canonicalItem = itemsById.get(material.item.id);
        if (!canonicalItem) {
          return invalid(
            `snapshot.items[${index}].recipes[${recipeIndex}].materials[${materialIndex}].item`,
            `존재하지 않는 아이템 참조입니다: ${material.item.id}`
          );
        }
        const reference = validateCanonicalItemReferenceAt(
          material.item,
          canonicalItem,
          `snapshot.items[${index}].recipes[${recipeIndex}].materials[${materialIndex}].item`
        );
        if (!reference.ok) return reference;
      }
    }
    for (const [relatedIndex, related] of item.relatedItems.entries()) {
      const canonicalItem = itemsById.get(related.id);
      if (!canonicalItem) {
        return invalid(`snapshot.items[${index}].relatedItems[${relatedIndex}]`, `존재하지 않는 아이템 참조입니다: ${related.id}`);
      }
      const reference = validateCanonicalItemReferenceAt(
        related,
        canonicalItem,
        `snapshot.items[${index}].relatedItems[${relatedIndex}]`
      );
      if (!reference.ok) return reference;
    }
    for (const [palIndex, palReference] of item.dropPals.entries()) {
      const canonicalPal = palsById.get(palReference.id);
      if (!canonicalPal) {
        return invalid(`snapshot.items[${index}].dropPals[${palIndex}]`, `존재하지 않는 Pal 참조입니다: ${palReference.id}`);
      }
      const reference = validateCanonicalPalReferenceAt(
        palReference,
        canonicalPal,
        `snapshot.items[${index}].dropPals[${palIndex}]`
      );
      if (!reference.ok) return reference;
      if (!canonicalPal.drops.some((drop) => drop.id === item.id)) {
        return invalid(
          `snapshot.items[${index}].dropPals[${palIndex}]`,
          `canonical Pal의 drops 역참조가 없습니다: ${palReference.id} -> ${item.id}`
        );
      }
    }
  }
  for (const [index, pair] of pairs.data.entries()) {
    for (const field of ["parentA", "parentB", "child"] as const) {
      const palReference = pair[field];
      const canonicalPal = palsById.get(palReference.id);
      if (!canonicalPal) {
        return invalid(`snapshot.breedingPairs[${index}].${field}`, `존재하지 않는 Pal 참조입니다: ${palReference.id}`);
      }
      const reference = validateCanonicalPalReferenceAt(
        palReference,
        canonicalPal,
        `snapshot.breedingPairs[${index}].${field}`
      );
      if (!reference.ok) return reference;
    }
  }
  for (const [index, skill] of skills.data.entries()) {
    if (!sameSnapshotMetadata(metadata.data, skill.metadata)) {
      return invalid(
        `snapshot.skills[${index}].metadata`,
        "snapshot과 metadata가 같아야 합니다."
      );
    }
    if (hasElementCollection && skill.element !== undefined && !elementsById.has(skill.element)) {
      return invalid(`snapshot.skills[${index}].element`, `정의되지 않은 속성 참조입니다: ${skill.element}`);
    }
    for (const [assignmentIndex, assignment] of skill.relatedPals.entries()) {
      const canonicalPal = palsById.get(assignment.pal.id);
      if (!canonicalPal) {
        return invalid(
          `snapshot.skills[${index}].relatedPals[${assignmentIndex}].pal`,
          `존재하지 않는 Pal 참조입니다: ${assignment.pal.id}`
        );
      }
      const reference = validateCanonicalPalReferenceAt(
        assignment.pal,
        canonicalPal,
        `snapshot.skills[${index}].relatedPals[${assignmentIndex}].pal`
      );
      if (!reference.ok) return reference;
      if (skill.type === "partner" && canonicalPal.partnerSkill?.id !== skill.id) {
        return invalid(
          `snapshot.skills[${index}].relatedPals[${assignmentIndex}]`,
          "related Pal의 partnerSkill과 일치해야 합니다."
        );
      }
      if (skill.type === "active") {
        const activeSkill = canonicalPal.activeSkills.find((entry) => entry.id === skill.id);
        if (!activeSkill) {
          return invalid(
            `snapshot.skills[${index}].relatedPals[${assignmentIndex}]`,
            "related Pal의 activeSkills에 현재 스킬이 필요합니다."
          );
        }
        if (activeSkill.unlockLevel !== assignment.unlockLevel) {
          return invalid(
            `snapshot.skills[${index}].relatedPals[${assignmentIndex}].unlockLevel`,
            "related Pal의 스킬 해금 레벨과 일치해야 합니다."
          );
        }
      }
    }
  }
  for (const [index, element] of elements.data.entries()) {
    if (element.iconUrl !== undefined && elementImageVersion(element.iconUrl) !== metadata.data.gameVersion) {
      return invalid(
        `snapshot.elements[${index}].iconUrl`,
        "속성 아이콘 경로 버전은 snapshot metadata.gameVersion과 같아야 합니다."
      );
    }
  }
  return valid(record.data as PalworldDataSnapshot);
}

export function assertPalworldDataSnapshot(value: unknown): PalworldDataSnapshot {
  const result = validatePalworldDataSnapshot(value);
  if (!result.ok) throw new TypeError(`Palworld 데이터 스냅샷 검증에 실패했습니다. ${result.error}`);
  return result.data;
}
