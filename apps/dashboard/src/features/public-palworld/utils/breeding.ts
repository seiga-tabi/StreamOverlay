import type { PalworldBreedingGender } from "@streamops/shared";

export type PalworldBreedingMode = "parents" | "child";

export type PalworldBreedingQueryState = {
  mode: PalworldBreedingMode;
  parentA?: string;
  parentB?: string;
  parentAGender?: PalworldBreedingGender;
  parentBGender?: PalworldBreedingGender;
  child?: string;
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
  const parentAGender = explicitGender(singleValue(params, "parentAGender"));
  const parentBGender = explicitGender(singleValue(params, "parentBGender"));
  const pageValue = singleValue(params, "page");
  const page = pageValue === undefined || mode === "parents" ? 1 : Number(pageValue);

  if (
    parentA === null
    || parentB === null
    || child === null
    || parentAGender === null
    || parentBGender === null
    || pageValue === null
    || !Number.isSafeInteger(page)
    || page < 1
    || page > 1_000_000
    || (parentA !== undefined && !validId(parentA))
    || (parentB !== undefined && !validId(parentB))
    || (child !== undefined && !validId(child))
    || (parentAGender !== undefined && parentA === undefined)
    || (parentBGender !== undefined && parentB === undefined)
  ) {
    return { ok: false, state: fallback };
  }

  if (mode === "parents") {
    if (child !== undefined || pageValue !== undefined) return { ok: false, state: fallback };
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
