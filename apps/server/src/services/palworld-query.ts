import {
  PALWORLD_ACQUISITION_TYPES,
  PALWORLD_ELEMENTS,
  PALWORLD_ITEM_CATEGORIES,
  PALWORLD_SKILL_TYPES,
  PALWORLD_VARIANT_TYPES,
  PALWORLD_WORK_SUITABILITY_TYPES
} from "@streamops/shared";

const MAX_SEARCH_LENGTH = 80;
const MAX_ID_LENGTH = 80;
const MAX_PAGE = 10_000;

const PAL_LIST_QUERY_KEYS = new Set([
  "q",
  "element",
  "work",
  "rarity",
  "variant",
  "sort",
  "order",
  "page",
  "limit"
]);
const ITEM_LIST_QUERY_KEYS = new Set([
  "q",
  "category",
  "rarity",
  "acquisition",
  "sort",
  "order",
  "page",
  "limit"
]);
const SKILL_LIST_QUERY_KEYS = new Set([
  "q",
  "type",
  "element",
  "sort",
  "order",
  "page",
  "limit"
]);
const SEARCH_QUERY_KEYS = new Set(["q", "limit"]);
const BREEDING_QUERY_KEYS = new Set(["parentA", "parentB"]);
const BREEDING_PARENTS_QUERY_KEYS = new Set(["child", "page", "limit"]);

export const PALWORLD_WORK_TYPES = PALWORLD_WORK_SUITABILITY_TYPES;
export const PALWORLD_PAL_SORTS = ["number", "name", "rarity"] as const;
export const PALWORLD_ITEM_SORTS = ["name", "rarity", "price", "technologyLevel"] as const;
export const PALWORLD_SKILL_SORTS = ["name", "power", "unlockLevel"] as const;

export {
  PALWORLD_ACQUISITION_TYPES,
  PALWORLD_ELEMENTS,
  PALWORLD_ITEM_CATEGORIES,
  PALWORLD_VARIANT_TYPES
};

export type PalworldSortOrder = "asc" | "desc";

export type PalworldPalListQuery = {
  q?: string;
  element?: (typeof PALWORLD_ELEMENTS)[number];
  work?: (typeof PALWORLD_WORK_TYPES)[number];
  rarity?: number;
  variant?: (typeof PALWORLD_VARIANT_TYPES)[number];
  sort: (typeof PALWORLD_PAL_SORTS)[number];
  order: PalworldSortOrder;
  page: number;
  limit: number;
};

export type PalworldItemListQuery = {
  q?: string;
  category?: (typeof PALWORLD_ITEM_CATEGORIES)[number];
  rarity?: number;
  acquisition?: (typeof PALWORLD_ACQUISITION_TYPES)[number];
  sort: (typeof PALWORLD_ITEM_SORTS)[number];
  order: PalworldSortOrder;
  page: number;
  limit: number;
};

export type PalworldSkillListQuery = {
  q?: string;
  type?: (typeof PALWORLD_SKILL_TYPES)[number];
  element?: (typeof PALWORLD_ELEMENTS)[number];
  sort: (typeof PALWORLD_SKILL_SORTS)[number];
  order: PalworldSortOrder;
  page: number;
  limit: number;
};

export type PalworldSearchQuery = {
  q: string;
  limit: number;
};

export type PalworldBreedingQuery = {
  parentA: string;
  parentB: string;
};

export type PalworldBreedingParentsQuery = {
  child: string;
  page: number;
  limit: number;
};

export class PalworldQueryError extends Error {
  readonly code = "PALWORLD_INVALID_QUERY";

  constructor(readonly publicMessage: string) {
    super(publicMessage);
    this.name = "PalworldQueryError";
  }
}

export function normalizePalworldSearchTerm(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

function assertKnownKeys(params: URLSearchParams, allowed: ReadonlySet<string>): void {
  for (const key of params.keys()) {
    if (!allowed.has(key)) {
      throw new PalworldQueryError(`지원하지 않는 query parameter입니다: ${key}`);
    }
    if (params.getAll(key).length > 1) {
      throw new PalworldQueryError(`query parameter는 한 번만 지정할 수 있습니다: ${key}`);
    }
  }
}

function optionalText(params: URLSearchParams, key: string): string | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  const value = raw.trim().replace(/\s+/gu, " ");
  if (!value) return undefined;
  if (value.length > MAX_SEARCH_LENGTH || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new PalworldQueryError(`${key} 값이 너무 길거나 허용되지 않는 문자를 포함합니다.`);
  }
  return value;
}

function requiredId(params: URLSearchParams, key: string): string {
  const value = optionalText(params, key);
  if (!value) throw new PalworldQueryError(`${key} 값이 필요합니다.`);
  return parsePalworldId(value, key);
}

function optionalEnum<const T extends readonly string[]>(
  params: URLSearchParams,
  key: string,
  allowed: T
): T[number] | undefined {
  const value = optionalText(params, key);
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T[number])) {
    throw new PalworldQueryError(`${key} 값이 허용 목록에 없습니다.`);
  }
  return value as T[number];
}

function integerParam(
  params: URLSearchParams,
  key: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = params.get(key);
  if (raw === null || raw === "") return fallback;
  if (!/^\d+$/u.test(raw)) throw new PalworldQueryError(`${key} 값은 정수여야 합니다.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new PalworldQueryError(`${key} 값은 ${min} 이상 ${max} 이하여야 합니다.`);
  }
  return value;
}

function optionalRarity(params: URLSearchParams, min: 0 | 1): number | undefined {
  const raw = params.get("rarity");
  if (raw === null || !raw.trim()) return undefined;
  if (!/^\d+$/u.test(raw)) throw new PalworldQueryError("rarity 값은 정수여야 합니다.");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > 20) {
    throw new PalworldQueryError(`rarity 값은 ${min} 이상 20 이하여야 합니다.`);
  }
  return value;
}

function pagination(params: URLSearchParams, defaultLimit: number): { page: number; limit: number } {
  return {
    page: integerParam(params, "page", 1, 1, MAX_PAGE),
    limit: integerParam(params, "limit", defaultLimit, 1, 100)
  };
}

export function parsePalworldId(value: string, label = "id"): string {
  const normalized = value.trim().toLocaleLowerCase();
  if (!normalized || normalized.length > MAX_ID_LENGTH || !/^[a-z0-9][a-z0-9_-]*$/u.test(normalized)) {
    throw new PalworldQueryError(`${label} 형식이 올바르지 않습니다.`);
  }
  return normalized;
}

export function parsePalworldPalListQuery(params: URLSearchParams): PalworldPalListQuery {
  assertKnownKeys(params, PAL_LIST_QUERY_KEYS);
  return {
    q: optionalText(params, "q"),
    element: optionalEnum(params, "element", PALWORLD_ELEMENTS),
    work: optionalEnum(params, "work", PALWORLD_WORK_TYPES),
    rarity: optionalRarity(params, 1),
    variant: optionalEnum(params, "variant", PALWORLD_VARIANT_TYPES),
    sort: optionalEnum(params, "sort", PALWORLD_PAL_SORTS) ?? "number",
    order: optionalEnum(params, "order", ["asc", "desc"] as const) ?? "asc",
    ...pagination(params, 24)
  };
}

export function parsePalworldItemListQuery(params: URLSearchParams): PalworldItemListQuery {
  assertKnownKeys(params, ITEM_LIST_QUERY_KEYS);
  return {
    q: optionalText(params, "q"),
    category: optionalEnum(params, "category", PALWORLD_ITEM_CATEGORIES),
    rarity: optionalRarity(params, 0),
    acquisition: optionalEnum(params, "acquisition", PALWORLD_ACQUISITION_TYPES),
    sort: optionalEnum(params, "sort", PALWORLD_ITEM_SORTS) ?? "name",
    order: optionalEnum(params, "order", ["asc", "desc"] as const) ?? "asc",
    ...pagination(params, 24)
  };
}

export function parsePalworldSkillListQuery(params: URLSearchParams): PalworldSkillListQuery {
  assertKnownKeys(params, SKILL_LIST_QUERY_KEYS);
  return {
    q: optionalText(params, "q"),
    type: optionalEnum(params, "type", PALWORLD_SKILL_TYPES),
    element: optionalEnum(params, "element", PALWORLD_ELEMENTS),
    sort: optionalEnum(params, "sort", PALWORLD_SKILL_SORTS) ?? "name",
    order: optionalEnum(params, "order", ["asc", "desc"] as const) ?? "asc",
    ...pagination(params, 24)
  };
}

export function parsePalworldSearchQuery(params: URLSearchParams): PalworldSearchQuery {
  assertKnownKeys(params, SEARCH_QUERY_KEYS);
  const q = optionalText(params, "q");
  if (!q) throw new PalworldQueryError("q 검색어가 필요합니다.");
  return {
    q,
    limit: integerParam(params, "limit", 20, 1, 50)
  };
}

export function parsePalworldBreedingQuery(params: URLSearchParams): PalworldBreedingQuery {
  assertKnownKeys(params, BREEDING_QUERY_KEYS);
  return {
    parentA: requiredId(params, "parentA"),
    parentB: requiredId(params, "parentB")
  };
}

export function parsePalworldBreedingParentsQuery(params: URLSearchParams): PalworldBreedingParentsQuery {
  assertKnownKeys(params, BREEDING_PARENTS_QUERY_KEYS);
  return {
    child: requiredId(params, "child"),
    ...pagination(params, 20)
  };
}
