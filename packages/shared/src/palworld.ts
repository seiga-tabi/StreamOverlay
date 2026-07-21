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

export type PalworldElement = (typeof PALWORLD_ELEMENTS)[number];
export type PalworldWorkSuitabilityType = (typeof PALWORLD_WORK_SUITABILITY_TYPES)[number];
export type PalworldVariantType = (typeof PALWORLD_VARIANT_TYPES)[number];
export type PalworldSkillType = (typeof PALWORLD_SKILL_TYPES)[number];
export type PalworldItemCategory = (typeof PALWORLD_ITEM_CATEGORIES)[number];
export type PalworldAcquisitionType = (typeof PALWORLD_ACQUISITION_TYPES)[number];
export type PalworldGender = (typeof PALWORLD_GENDERS)[number];

export type PalworldDataMetadata = {
  gameVersion: string;
  sourceName: string;
  sourceUrl: string;
  sourceRevision: string;
  extractedAt: string;
  verifiedAt: string;
  license: string;
};

export type PalworldWorkSuitability = {
  type: PalworldWorkSuitabilityType;
  level: number;
};

export type PalworldSkill = {
  id: string;
  type: PalworldSkillType;
  nameKo: string;
  nameJa: string;
  nameEn: string;
  descriptionKo: string;
  descriptionJa: string;
  descriptionEn?: string;
  element?: PalworldElement;
  power?: number;
  cooldownSeconds?: number;
  unlockLevel?: number;
};

export type PalworldPalReference = {
  id: string;
  number: number;
  nameKo: string;
  nameJa: string;
  nameEn: string;
  imageUrl?: string;
  elements: PalworldElement[];
};

export type PalworldItemReference = {
  id: string;
  nameKo: string;
  nameJa: string;
  nameEn: string;
  imageUrl?: string;
};

export type PalworldFacilityReference = {
  id: string;
  nameKo: string;
  nameJa: string;
  nameEn: string;
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
};

export type PalworldPalBreedingInfo = {
  breedingPower?: number;
  specialParentPairs: Array<{
    parentAId: string;
    parentBId: string;
  }>;
};

export type PalworldPalDetail = PalworldPalSummary & {
  stats: PalworldPalStats;
  partnerSkill?: PalworldSkill;
  activeSkills: PalworldSkill[];
  drops: PalworldItemReference[];
  breeding: PalworldPalBreedingInfo;
  metadata: PalworldDataMetadata;
};

export type PalworldItemSummary = PalworldItemReference & {
  category: PalworldItemCategory;
  rarity: number;
  descriptionKo: string;
  descriptionJa: string;
  descriptionEn?: string;
  sellPrice?: number;
  technologyLevel?: number;
};

export type PalworldCraftingMaterial = {
  item: PalworldItemReference;
  quantity: number;
};

export type PalworldAcquisitionMethod = {
  type: PalworldAcquisitionType;
  labelKo: string;
  labelJa: string;
  labelEn?: string;
  locationKo?: string;
  locationJa?: string;
  locationEn?: string;
};

export type PalworldItemDetail = PalworldItemSummary & {
  craftingMaterials: PalworldCraftingMaterial[];
  craftingFacility?: PalworldFacilityReference;
  dropPals: PalworldPalReference[];
  acquisitionMethods: PalworldAcquisitionMethod[];
  relatedItems: PalworldItemReference[];
  metadata: PalworldDataMetadata;
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
  };
};

export type PalworldBreedingResultResponse = {
  parentA: PalworldPalReference;
  parentB: PalworldPalReference;
  result: PalworldBreedingPair | null;
  metadata: PalworldDataMetadata;
};

export type PalworldBreedingParentsResponse = PalworldPaginatedResponse<PalworldBreedingPair> & {
  child: PalworldPalReference;
};

export type PalworldDataSnapshot = {
  metadata: PalworldDataMetadata;
  pals: PalworldPalDetail[];
  items: PalworldItemDetail[];
  breedingPairs: PalworldBreedingPair[];
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
const MAX_WORK_LEVEL = 5;
const MAX_STAT_VALUE = 1_000_000;

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

function optionalAssetPathAt(value: unknown, path: string): PalworldValidationResult<string | undefined> {
  if (value === undefined) return valid(undefined);
  const stringResult = stringAt(value, path, MAX_URL_LENGTH);
  if (!stringResult.ok) return stringResult;
  try {
    const decoded = decodeURIComponent(stringResult.data);
    if (
      stringResult.data.startsWith("/") &&
      !stringResult.data.startsWith("//") &&
      !decoded.includes("..") &&
      !decoded.includes("\\") &&
      !decoded.includes("\0")
    ) {
      return stringResult;
    }
  } catch {
    return invalid(path, "올바른 asset 경로여야 합니다.");
  }
  return invalid(path, "외부 hotlink가 아닌 안전한 동일 출처 절대 경로여야 합니다.");
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

function validateMetadataAt(value: unknown, path: string): PalworldValidationResult<PalworldDataMetadata> {
  const record = recordAt(value, path, [
    "gameVersion",
    "sourceName",
    "sourceUrl",
    "sourceRevision",
    "extractedAt",
    "verifiedAt",
    "license"
  ]);
  if (!record.ok) return record;
  const candidate = record.data;
  for (const field of ["gameVersion", "sourceName", "sourceRevision", "license"] as const) {
    const result = stringAt(candidate[field], `${path}.${field}`);
    if (!result.ok) return result;
  }
  const sourceUrl = httpsUrlAt(candidate.sourceUrl, `${path}.sourceUrl`);
  if (!sourceUrl.ok) return sourceUrl;
  for (const field of ["extractedAt", "verifiedAt"] as const) {
    const result = isoDateAt(candidate[field], `${path}.${field}`);
    if (!result.ok) return result;
  }
  return valid(candidate as PalworldDataMetadata);
}

function validateWorkSuitabilityAt(value: unknown, path: string): PalworldValidationResult<PalworldWorkSuitability> {
  const record = recordAt(value, path, ["type", "level"]);
  if (!record.ok) return record;
  const type = enumAt(record.data.type, `${path}.type`, PALWORLD_WORK_SUITABILITY_TYPES);
  if (!type.ok) return type;
  const level = integerAt(record.data.level, `${path}.level`, 1, MAX_WORK_LEVEL);
  return level.ok ? valid(record.data as PalworldWorkSuitability) : level;
}

function validateSkillAt(value: unknown, path: string): PalworldValidationResult<PalworldSkill> {
  const record = recordAt(value, path, [
    "id",
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
    "unlockLevel"
  ]);
  if (!record.ok) return record;
  const candidate = record.data;
  const id = idAt(candidate.id, `${path}.id`);
  if (!id.ok) return id;
  const type = enumAt(candidate.type, `${path}.type`, PALWORLD_SKILL_TYPES);
  if (!type.ok) return type;
  for (const field of ["nameKo", "nameJa", "nameEn"] as const) {
    const result = stringAt(candidate[field], `${path}.${field}`);
    if (!result.ok) return result;
  }
  for (const field of ["descriptionKo", "descriptionJa"] as const) {
    const result = stringAt(candidate[field], `${path}.${field}`, MAX_DESCRIPTION_LENGTH);
    if (!result.ok) return result;
  }
  const descriptionEn = optionalStringAt(candidate.descriptionEn, `${path}.descriptionEn`, MAX_DESCRIPTION_LENGTH);
  if (!descriptionEn.ok) return descriptionEn;
  if (candidate.element !== undefined) {
    const element = enumAt(candidate.element, `${path}.element`, PALWORLD_ELEMENTS);
    if (!element.ok) return element;
  }
  for (const [field, max] of [
    ["power", MAX_STAT_VALUE],
    ["cooldownSeconds", 3_600],
    ["unlockLevel", 100]
  ] as const) {
    if (candidate[field] !== undefined) {
      const result = finiteNumberAt(candidate[field], `${path}.${field}`, 0, max);
      if (!result.ok) return result;
    }
  }
  return valid(candidate as PalworldSkill);
}

function validatePalReferenceAt(value: unknown, path: string): PalworldValidationResult<PalworldPalReference> {
  const record = recordAt(value, path, ["id", "number", "nameKo", "nameJa", "nameEn", "imageUrl", "elements"]);
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
  const imageUrl = optionalAssetPathAt(candidate.imageUrl, `${path}.imageUrl`);
  if (!imageUrl.ok) return imageUrl;
  const elements = arrayAt(candidate.elements, `${path}.elements`, 2, (entry, entryPath) =>
    enumAt(entry, entryPath, PALWORLD_ELEMENTS)
  );
  if (!elements.ok) return elements;
  return elements.data.length > 0 ? valid(candidate as PalworldPalReference) : invalid(`${path}.elements`, "하나 이상의 속성이 필요합니다.");
}

function validateItemReferenceAt(value: unknown, path: string): PalworldValidationResult<PalworldItemReference> {
  const record = recordAt(value, path, ["id", "nameKo", "nameJa", "nameEn", "imageUrl"]);
  if (!record.ok) return record;
  const candidate = record.data;
  const id = idAt(candidate.id, `${path}.id`);
  if (!id.ok) return id;
  for (const field of ["nameKo", "nameJa", "nameEn"] as const) {
    const result = stringAt(candidate[field], `${path}.${field}`);
    if (!result.ok) return result;
  }
  const imageUrl = optionalAssetPathAt(candidate.imageUrl, `${path}.imageUrl`);
  return imageUrl.ok ? valid(candidate as PalworldItemReference) : imageUrl;
}

function validateFacilityReferenceAt(value: unknown, path: string): PalworldValidationResult<PalworldFacilityReference> {
  const record = recordAt(value, path, ["id", "nameKo", "nameJa", "nameEn"]);
  if (!record.ok) return record;
  const id = idAt(record.data.id, `${path}.id`);
  if (!id.ok) return id;
  for (const field of ["nameKo", "nameJa", "nameEn"] as const) {
    const result = stringAt(record.data[field], `${path}.${field}`, MAX_NAME_LENGTH);
    if (!result.ok) return result;
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
    "elements",
    "rarity",
    "variantType",
    "workSuitabilities"
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
      elements: candidate.elements
    },
    path
  );
  if (!reference.ok) return reference;
  const rarity = integerAt(candidate.rarity, `${path}.rarity`, 1, MAX_RARITY);
  if (!rarity.ok) return rarity;
  const variantType = enumAt(candidate.variantType, `${path}.variantType`, PALWORLD_VARIANT_TYPES);
  if (!variantType.ok) return variantType;
  const work = arrayAt(candidate.workSuitabilities, `${path}.workSuitabilities`, PALWORLD_WORK_SUITABILITY_TYPES.length, validateWorkSuitabilityAt);
  return work.ok ? valid(candidate as PalworldPalSummary) : work;
}

function validateStatsAt(value: unknown, path: string): PalworldValidationResult<PalworldPalStats> {
  const record = recordAt(value, path, ["hp", "attack", "defense", "moveSpeed", "stamina"]);
  if (!record.ok) return record;
  for (const field of ["hp", "attack", "defense", "moveSpeed", "stamina"] as const) {
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
    const pair = recordAt(entry, entryPath, ["parentAId", "parentBId"]);
    if (!pair.ok) return pair;
    for (const field of ["parentAId", "parentBId"] as const) {
      const result = idAt(pair.data[field], `${entryPath}.${field}`);
      if (!result.ok) return result;
    }
    return valid(pair.data as { parentAId: string; parentBId: string });
  });
  return pairs.ok ? valid(record.data as PalworldPalBreedingInfo) : pairs;
}

function validatePalDetailAt(value: unknown, path: string): PalworldValidationResult<PalworldPalDetail> {
  const record = recordAt(value, path, [
    "id",
    "number",
    "nameKo",
    "nameJa",
    "nameEn",
    "imageUrl",
    "elements",
    "rarity",
    "variantType",
    "workSuitabilities",
    "stats",
    "partnerSkill",
    "activeSkills",
    "drops",
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
      elements: candidate.elements,
      rarity: candidate.rarity,
      variantType: candidate.variantType,
      workSuitabilities: candidate.workSuitabilities
    },
    path
  );
  if (!summary.ok) return summary;
  const stats = validateStatsAt(candidate.stats, `${path}.stats`);
  if (!stats.ok) return stats;
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
  const drops = arrayAt(candidate.drops, `${path}.drops`, MAX_API_COLLECTION_SIZE, validateItemReferenceAt);
  if (!drops.ok) return drops;
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
    "category",
    "rarity",
    "descriptionKo",
    "descriptionJa",
    "descriptionEn",
    "sellPrice",
    "technologyLevel"
  ]);
  if (!record.ok) return record;
  const candidate = record.data;
  const reference = validateItemReferenceAt(
    {
      id: candidate.id,
      nameKo: candidate.nameKo,
      nameJa: candidate.nameJa,
      nameEn: candidate.nameEn,
      ...(candidate.imageUrl === undefined ? {} : { imageUrl: candidate.imageUrl })
    },
    path
  );
  if (!reference.ok) return reference;
  const category = enumAt(candidate.category, `${path}.category`, PALWORLD_ITEM_CATEGORIES);
  if (!category.ok) return category;
  const rarity = integerAt(candidate.rarity, `${path}.rarity`, 1, MAX_RARITY);
  if (!rarity.ok) return rarity;
  for (const field of ["descriptionKo", "descriptionJa"] as const) {
    const result = stringAt(candidate[field], `${path}.${field}`, MAX_DESCRIPTION_LENGTH);
    if (!result.ok) return result;
  }
  const descriptionEn = optionalStringAt(candidate.descriptionEn, `${path}.descriptionEn`, MAX_DESCRIPTION_LENGTH);
  if (!descriptionEn.ok) return descriptionEn;
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

function validateAcquisitionMethodAt(value: unknown, path: string): PalworldValidationResult<PalworldAcquisitionMethod> {
  const record = recordAt(value, path, [
    "type",
    "labelKo",
    "labelJa",
    "labelEn",
    "locationKo",
    "locationJa",
    "locationEn"
  ]);
  if (!record.ok) return record;
  const type = enumAt(record.data.type, `${path}.type`, PALWORLD_ACQUISITION_TYPES);
  if (!type.ok) return type;
  for (const field of ["labelKo", "labelJa"] as const) {
    const result = stringAt(record.data[field], `${path}.${field}`, MAX_DESCRIPTION_LENGTH);
    if (!result.ok) return result;
  }
  for (const field of ["labelEn", "locationKo", "locationJa", "locationEn"] as const) {
    const result = optionalStringAt(record.data[field], `${path}.${field}`, MAX_DESCRIPTION_LENGTH);
    if (!result.ok) return result;
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
    "category",
    "rarity",
    "descriptionKo",
    "descriptionJa",
    "descriptionEn",
    "sellPrice",
    "technologyLevel",
    "craftingMaterials",
    "craftingFacility",
    "dropPals",
    "acquisitionMethods",
    "relatedItems",
    "metadata"
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
      category: candidate.category,
      rarity: candidate.rarity,
      descriptionKo: candidate.descriptionKo,
      descriptionJa: candidate.descriptionJa,
      ...(candidate.descriptionEn === undefined ? {} : { descriptionEn: candidate.descriptionEn }),
      ...(candidate.sellPrice === undefined ? {} : { sellPrice: candidate.sellPrice }),
      ...(candidate.technologyLevel === undefined ? {} : { technologyLevel: candidate.technologyLevel })
    },
    path
  );
  if (!summary.ok) return summary;
  const materials = arrayAt(candidate.craftingMaterials, `${path}.craftingMaterials`, MAX_API_COLLECTION_SIZE, validateCraftingMaterialAt);
  if (!materials.ok) return materials;
  if (candidate.craftingFacility !== undefined) {
    const facility = validateFacilityReferenceAt(candidate.craftingFacility, `${path}.craftingFacility`);
    if (!facility.ok) return facility;
  }
  const dropPals = arrayAt(candidate.dropPals, `${path}.dropPals`, MAX_API_COLLECTION_SIZE, validatePalReferenceAt);
  if (!dropPals.ok) return dropPals;
  const methods = arrayAt(candidate.acquisitionMethods, `${path}.acquisitionMethods`, MAX_API_COLLECTION_SIZE, validateAcquisitionMethodAt);
  if (!methods.ok) return methods;
  const relatedItems = arrayAt(candidate.relatedItems, `${path}.relatedItems`, MAX_API_COLLECTION_SIZE, validateItemReferenceAt);
  if (!relatedItems.ok) return relatedItems;
  const metadata = validateMetadataAt(candidate.metadata, `${path}.metadata`);
  return metadata.ok ? valid(candidate as PalworldItemDetail) : metadata;
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

export function validatePalworldSkill(value: unknown): PalworldValidationResult<PalworldSkill> {
  return validateSkillAt(value, "skill");
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
  const record = recordAt(value, "response", ["metadata", "counts"]);
  if (!record.ok) return record;
  const metadata = validateMetadataAt(record.data.metadata, "response.metadata");
  if (!metadata.ok) return metadata;
  const counts = recordAt(record.data.counts, "response.counts", ["pals", "items", "breedingPairs"]);
  if (!counts.ok) return counts;
  for (const field of ["pals", "items", "breedingPairs"] as const) {
    const result = integerAt(counts.data[field], `response.counts.${field}`, 0, 100_000_000);
    if (!result.ok) return result;
  }
  return valid(record.data as PalworldMetaResponse);
}

export function validatePalworldSearchResult(value: unknown): PalworldValidationResult<PalworldSearchResult> {
  const record = recordAt(value, "searchResult", ["query", "total", "pals", "items", "metadata"]);
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
  return metadata.ok ? valid(record.data as PalworldSearchResult) : metadata;
}

export function validatePalworldBreedingResultResponse(
  value: unknown
): PalworldValidationResult<PalworldBreedingResultResponse> {
  const record = recordAt(value, "response", ["parentA", "parentB", "result", "metadata"]);
  if (!record.ok) return record;
  const parentA = validatePalReferenceAt(record.data.parentA, "response.parentA");
  if (!parentA.ok) return parentA;
  const parentB = validatePalReferenceAt(record.data.parentB, "response.parentB");
  if (!parentB.ok) return parentB;
  if (record.data.result !== null) {
    const result = validateBreedingPairAt(record.data.result, "response.result");
    if (!result.ok) return result;
    const directOrder = result.data.parentA.id === parentA.data.id && result.data.parentB.id === parentB.data.id;
    const reverseOrder = result.data.parentA.id === parentB.data.id && result.data.parentB.id === parentA.data.id;
    if (!directOrder && !reverseOrder) {
      return invalid("response.result", "요청한 부모 Pal 조합과 일치해야 합니다.");
    }
    const expectedParentA = directOrder ? parentA.data : parentB.data;
    const expectedParentB = directOrder ? parentB.data : parentA.data;
    const parentAReference = validateCanonicalPalReferenceAt(result.data.parentA, expectedParentA, "response.result.parentA");
    if (!parentAReference.ok) return parentAReference;
    const parentBReference = validateCanonicalPalReferenceAt(result.data.parentB, expectedParentB, "response.result.parentB");
    if (!parentBReference.ok) return parentBReference;
  }
  const metadata = validateMetadataAt(record.data.metadata, "response.metadata");
  return metadata.ok ? valid(record.data as PalworldBreedingResultResponse) : metadata;
}

export function validatePalworldBreedingParentsResponse(
  value: unknown
): PalworldValidationResult<PalworldBreedingParentsResponse> {
  const record = recordAt(value, "response", ["child", "items", "pagination", "metadata"]);
  if (!record.ok) return record;
  const child = validatePalReferenceAt(record.data.child, "response.child");
  if (!child.ok) return child;
  const items = arrayAt(record.data.items, "response.items", MAX_API_COLLECTION_SIZE, validateBreedingPairAt);
  if (!items.ok) return items;
  const pagination = validatePaginationAt(record.data.pagination, "response.pagination");
  if (!pagination.ok) return pagination;
  const itemCount = validatePageItemCountAt(items.data.length, pagination.data, "response.items");
  if (!itemCount.ok) return itemCount;
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
  for (const field of ["id", "number", "nameKo", "nameJa", "nameEn", "imageUrl"] as const) {
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
  return valid(reference);
}

function validateCanonicalItemReferenceAt(
  reference: PalworldItemReference,
  canonical: PalworldItemReference,
  path: string
): PalworldValidationResult<PalworldItemReference> {
  for (const field of ["id", "nameKo", "nameJa", "nameEn", "imageUrl"] as const) {
    if (reference[field] !== canonical[field]) {
      return invalid(`${path}.${field}`, "canonical 아이템 레코드와 일치해야 합니다.");
    }
  }
  return valid(reference);
}

function sameSnapshotMetadata(metadata: PalworldDataMetadata, detailMetadata: PalworldDataMetadata): boolean {
  return metadata.gameVersion === detailMetadata.gameVersion && metadata.sourceRevision === detailMetadata.sourceRevision;
}

export function validatePalworldDataSnapshot(value: unknown): PalworldValidationResult<PalworldDataSnapshot> {
  const record = recordAt(value, "snapshot", ["metadata", "pals", "items", "breedingPairs"]);
  if (!record.ok) return record;
  const metadata = validateMetadataAt(record.data.metadata, "snapshot.metadata");
  if (!metadata.ok) return metadata;
  const pals = arrayAt(record.data.pals, "snapshot.pals", MAX_SNAPSHOT_COLLECTION_SIZE, validatePalDetailAt);
  if (!pals.ok) return pals;
  const items = arrayAt(record.data.items, "snapshot.items", MAX_SNAPSHOT_COLLECTION_SIZE, validateItemDetailAt);
  if (!items.ok) return items;
  const pairs = arrayAt(record.data.breedingPairs, "snapshot.breedingPairs", MAX_SNAPSHOT_COLLECTION_SIZE, validateBreedingPairAt);
  if (!pairs.ok) return pairs;
  const uniquePals = validateUniqueIds(pals.data, "snapshot.pals");
  if (!uniquePals.ok) return uniquePals;
  const uniqueItems = validateUniqueIds(items.data, "snapshot.items");
  if (!uniqueItems.ok) return uniqueItems;
  const uniquePairs = validateUniqueIds(pairs.data, "snapshot.breedingPairs");
  if (!uniquePairs.ok) return uniquePairs;

  const palsById = new Map(pals.data.map((pal) => [pal.id, pal]));
  const itemsById = new Map(items.data.map((item) => [item.id, item]));
  for (const [index, pal] of pals.data.entries()) {
    if (!sameSnapshotMetadata(metadata.data, pal.metadata)) {
      return invalid(`snapshot.pals[${index}].metadata`, "snapshot과 gameVersion/sourceRevision이 같아야 합니다.");
    }
    for (const [dropIndex, drop] of pal.drops.entries()) {
      const canonicalItem = itemsById.get(drop.id);
      if (!canonicalItem) {
        return invalid(`snapshot.pals[${index}].drops[${dropIndex}]`, `존재하지 않는 아이템 참조입니다: ${drop.id}`);
      }
      const reference = validateCanonicalItemReferenceAt(drop, canonicalItem, `snapshot.pals[${index}].drops[${dropIndex}]`);
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
      return invalid(`snapshot.items[${index}].metadata`, "snapshot과 gameVersion/sourceRevision이 같아야 합니다.");
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
  return valid(record.data as PalworldDataSnapshot);
}

export function assertPalworldDataSnapshot(value: unknown): PalworldDataSnapshot {
  const result = validatePalworldDataSnapshot(value);
  if (!result.ok) throw new TypeError(`Palworld 데이터 스냅샷 검증에 실패했습니다. ${result.error}`);
  return result.data;
}
