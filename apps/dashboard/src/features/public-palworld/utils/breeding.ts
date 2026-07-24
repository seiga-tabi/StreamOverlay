import {
  PALWORLD_BREEDING_PAIR_TYPES,
  type PalworldBreedingGender,
  type PalworldBreedingPair,
  type PalworldBreedingPairType,
} from "@streamops/shared";

export type PalworldBreedingMode = "parents" | "child";

export type PalworldBreedingQueryState = {
  mode: PalworldBreedingMode;
  parentA?: string;
  parentB?: string;
  parentAGender?: PalworldBreedingGender;
  parentBGender?: PalworldBreedingGender;
  child?: string;
  type?: PalworldBreedingPairType;
  page: number;
};

export type PalworldBreedingQueryResult =
  | { ok: true; state: PalworldBreedingQueryState }
  | { ok: false; state: PalworldBreedingQueryState };

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
  const fallback: PalworldBreedingQueryState = { mode: "parents", page: 1 };
  const modeValue = singleValue(params, "mode");
  if (modeValue === null || (modeValue !== undefined && modeValue !== "parents" && modeValue !== "child")) {
    return { ok: false, state: fallback };
  }
  const mode: PalworldBreedingMode = modeValue ?? "parents";
  const parentA = singleValue(params, "parentA");
  const parentB = singleValue(params, "parentB");
  const child = singleValue(params, "child");
  const type = singleValue(params, "type");
  const parentAGender = explicitGender(singleValue(params, "parentAGender"));
  const parentBGender = explicitGender(singleValue(params, "parentBGender"));
  const pageValue = singleValue(params, "page");
  const page = pageValue === undefined || mode === "parents" ? 1 : Number(pageValue);

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
  ) {
    return { ok: false, state: fallback };
  }

  if (mode === "parents") {
    if (child !== undefined || type !== undefined || pageValue !== undefined) return { ok: false, state: fallback };
    return {
      ok: true,
      state: {
        mode,
        ...(parentA ? { parentA } : {}),
        ...(parentB ? { parentB } : {}),
        ...(parentAGender ? { parentAGender } : {}),
        ...(parentBGender ? { parentBGender } : {}),
        page: 1,
      },
    };
  }

  if (
    parentA !== undefined
    || parentB !== undefined
    || parentAGender !== undefined
    || parentBGender !== undefined
  ) {
    return { ok: false, state: fallback };
  }
  return {
    ok: true,
    state: {
      mode,
      ...(child ? { child } : {}),
      ...(type && type !== "all" ? { type: type as PalworldBreedingPairType } : {}),
      page,
    },
  };
}

export function palworldBreedingParams(
  current: URLSearchParams,
  state: PalworldBreedingQueryState,
): URLSearchParams {
  const params = new URLSearchParams(current);
  for (const key of BREEDING_QUERY_KEYS) params.delete(key);
  params.set("mode", state.mode);
  if (state.mode === "parents") {
    if (state.parentA) params.set("parentA", state.parentA);
    if (state.parentB) params.set("parentB", state.parentB);
    if (state.parentAGender) params.set("parentAGender", state.parentAGender);
    if (state.parentBGender) params.set("parentBGender", state.parentBGender);
    return params;
  }
  if (state.child) params.set("child", state.child);
  if (state.type && state.type !== "all") params.set("type", state.type);
  if (state.page > 1) params.set("page", String(state.page));
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

export function breedingPairGendersForParents(
  pair: PalworldBreedingPair,
  parentAId: string,
  parentBId: string,
): { parentAGender: PalworldBreedingGender; parentBGender: PalworldBreedingGender } | undefined {
  const condition = pair.genderCondition;
  if (!condition || condition.parentA === "any" || condition.parentB === "any") return undefined;
  if (pair.parentA.id === parentAId && pair.parentB.id === parentBId) {
    return {
      parentAGender: condition.parentA,
      parentBGender: condition.parentB,
    };
  }
  if (pair.parentA.id === parentBId && pair.parentB.id === parentAId) {
    return {
      parentAGender: condition.parentB,
      parentBGender: condition.parentA,
    };
  }
  return undefined;
}
