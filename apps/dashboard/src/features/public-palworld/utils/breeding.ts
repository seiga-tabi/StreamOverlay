import {
  PALWORLD_BREEDING_PAIR_TYPES,
  type PalworldBreedingGender,
  type PalworldBreedingPair,
  type PalworldBreedingPairType,
  type PalworldGender,
  type PalworldPalReference,
} from "@streamops/shared";

export type PalworldBreedingQueryState = {
  parentA?: string;
  parentB?: string;
  parentAGender?: PalworldBreedingGender;
  parentBGender?: PalworldBreedingGender;
  child?: string;
  type?: PalworldBreedingPairType;
  page: number;
};

export type PalworldBreedingQueryResult =
  | { ok: true; state: PalworldBreedingQueryState; legacy: boolean }
  | { ok: false; state: PalworldBreedingQueryState; legacy: boolean };

const BREEDING_QUERY_KEYS = [
  "mode",
  "parentA",
  "parentB",
  "parentAGender",
  "parentBGender",
  "child",
  "type",
  "page",
] as const;
const PALWORLD_PUBLIC_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/u;
const EXPLICIT_GENDERS = new Set<PalworldBreedingGender>(["male", "female"]);

function singleValue(params: URLSearchParams, key: string): string | undefined | null {
  const values = params.getAll(key);
  if (values.length > 1) return null;
  const value = values[0]?.trim();
  return value || undefined;
}

function validId(value: string | undefined | null): value is string {
  return typeof value === "string" && PALWORLD_PUBLIC_ID_PATTERN.test(value);
}

function explicitGender(value: string | undefined | null): PalworldBreedingGender | undefined | null {
  if (value === undefined) return undefined;
  if (value === null || !EXPLICIT_GENDERS.has(value as PalworldBreedingGender)) return null;
  return value as PalworldBreedingGender;
}

export function parsePalworldBreedingQuery(params: URLSearchParams): PalworldBreedingQueryResult {
  const fallback: PalworldBreedingQueryState = { page: 1 };
  const modeValue = singleValue(params, "mode");
  const legacy = modeValue !== undefined && modeValue !== null;
  if (modeValue === null || (legacy && modeValue !== "parents" && modeValue !== "child")) {
    return { ok: false, state: fallback, legacy: false };
  }
  const parentA = singleValue(params, "parentA");
  const parentB = singleValue(params, "parentB");
  const child = singleValue(params, "child");
  const type = singleValue(params, "type");
  const parentAGender = explicitGender(singleValue(params, "parentAGender"));
  const parentBGender = explicitGender(singleValue(params, "parentBGender"));
  const pageValue = singleValue(params, "page");
  const page = pageValue === undefined ? 1 : Number(pageValue);

  if (
    parentA === null
    || parentB === null
    || child === null
    || type === null
    || parentAGender === null
    || parentBGender === null
    || pageValue === null
    || !Number.isSafeInteger(page)
    || page < 1
    || page > 10_000
    || (parentA !== undefined && !validId(parentA))
    || (parentB !== undefined && !validId(parentB))
    || (child !== undefined && !validId(child))
    || (type !== undefined && !PALWORLD_BREEDING_PAIR_TYPES.includes(type as PalworldBreedingPairType))
    || (parentAGender !== undefined && parentA === undefined)
    || (parentBGender !== undefined && parentB === undefined)
    /* 세 슬롯이 모두 차면 계산 방향이 정해지지 않으므로 잘못된 링크로 처리합니다. */
    || (parentA !== undefined && parentB !== undefined && child !== undefined)
    || (child === undefined && (type !== undefined || pageValue !== undefined))
  ) {
    return { ok: false, state: fallback, legacy: false };
  }

  /* 이전 URL(mode=…)은 슬롯 상태로 그대로 옮기되, 당시 규칙 밖의 조합은 계속 거부합니다. */
  if (legacy && modeValue === "parents" && child !== undefined) return { ok: false, state: fallback, legacy: false };
  if (
    legacy
    && modeValue === "child"
    && (parentA !== undefined || parentB !== undefined)
  ) {
    return { ok: false, state: fallback, legacy: false };
  }

  return {
    ok: true,
    state: {
      ...(parentA ? { parentA } : {}),
      ...(parentB ? { parentB } : {}),
      ...(parentAGender ? { parentAGender } : {}),
      ...(parentBGender ? { parentBGender } : {}),
      ...(child ? { child } : {}),
      ...(child && type && type !== "all" ? { type: type as PalworldBreedingPairType } : {}),
      page: child ? page : 1,
    },
    legacy,
  };
}

export function palworldBreedingParams(
  current: URLSearchParams,
  state: PalworldBreedingQueryState,
): URLSearchParams {
  const params = new URLSearchParams(current);
  for (const key of BREEDING_QUERY_KEYS) params.delete(key);
  if (state.parentA) params.set("parentA", state.parentA);
  if (state.parentB) params.set("parentB", state.parentB);
  if (state.parentA && state.parentAGender) params.set("parentAGender", state.parentAGender);
  if (state.parentB && state.parentBGender) params.set("parentBGender", state.parentBGender);
  if (state.child) params.set("child", state.child);
  if (state.child && state.type && state.type !== "all") params.set("type", state.type);
  if (state.child && state.page > 1) params.set("page", String(state.page));
  return params;
}

export function clearPalworldBreedingParams(current: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(current);
  for (const key of BREEDING_QUERY_KEYS) params.delete(key);
  return params;
}

export function swapBreedingParents<T>(parentA: T | null, parentB: T | null): [T | null, T | null] {
  return [parentB, parentA];
}

export function samePalworldBreedingPalId(
  left: string | undefined,
  right: string | undefined,
): boolean {
  if (left === undefined || right === undefined) return false;
  const normalizeAlias = (id: string): string => id.toLocaleLowerCase().replaceAll("_", "-");
  return normalizeAlias(left) === normalizeAlias(right);
}

export type OrientedBreedingPair = {
  selectedParent: PalworldPalReference;
  partnerParent: PalworldPalReference;
  child: PalworldPalReference;
  selectedParentGender?: PalworldGender;
  partnerParentGender?: PalworldGender;
  isSpecial: boolean;
};

export function orientBreedingPairForSelectedParent(
  pair: PalworldBreedingPair,
  selectedParentId: string,
): OrientedBreedingPair | undefined {
  if (samePalworldBreedingPalId(pair.parentA.id, selectedParentId)) {
    return {
      selectedParent: pair.parentA,
      partnerParent: pair.parentB,
      child: pair.child,
      ...(pair.genderCondition ? {
        selectedParentGender: pair.genderCondition.parentA,
        partnerParentGender: pair.genderCondition.parentB,
      } : {}),
      isSpecial: pair.isSpecial,
    };
  }
  if (samePalworldBreedingPalId(pair.parentB.id, selectedParentId)) {
    return {
      selectedParent: pair.parentB,
      partnerParent: pair.parentA,
      child: pair.child,
      ...(pair.genderCondition ? {
        selectedParentGender: pair.genderCondition.parentB,
        partnerParentGender: pair.genderCondition.parentA,
      } : {}),
      isSpecial: pair.isSpecial,
    };
  }
  return undefined;
}

export function breedingPairGendersForParents(
  pair: PalworldBreedingPair,
  parentAId: string,
  parentBId: string,
): { parentAGender: PalworldBreedingGender; parentBGender: PalworldBreedingGender } | undefined {
  const condition = pair.genderCondition;
  if (!condition || condition.parentA === "any" || condition.parentB === "any") return undefined;
  if (
    samePalworldBreedingPalId(pair.parentA.id, parentAId)
    && samePalworldBreedingPalId(pair.parentB.id, parentBId)
  ) {
    return {
      parentAGender: condition.parentA,
      parentBGender: condition.parentB,
    };
  }
  if (
    samePalworldBreedingPalId(pair.parentA.id, parentBId)
    && samePalworldBreedingPalId(pair.parentB.id, parentAId)
  ) {
    return {
      parentAGender: condition.parentB,
      parentBGender: condition.parentA,
    };
  }
  return undefined;
}
