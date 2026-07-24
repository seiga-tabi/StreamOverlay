export const PALWORLD_PALS_FILTER_KEYS = [
  "q",
  "element",
  "work",
  "rarity",
  "variant",
] as const;

export const PALWORLD_PALS_ROUTE_KEYS = [
  ...PALWORLD_PALS_FILTER_KEYS,
  "sort",
  "order",
  "page",
] as const;

export type PalworldPalsFilterKey = (typeof PALWORLD_PALS_FILTER_KEYS)[number];
export type PalworldPalsRouteKey = (typeof PALWORLD_PALS_ROUTE_KEYS)[number];

export function updatePalworldPalsParams(
  params: URLSearchParams,
  key: PalworldPalsRouteKey,
  value?: string,
): URLSearchParams {
  const next = new URLSearchParams(params);
  const normalized = value?.trim();
  if (normalized) next.set(key, normalized);
  else next.delete(key);
  if (key !== "page") next.delete("page");
  return next;
}

export function clearPalworldPalsFilterParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of PALWORLD_PALS_FILTER_KEYS) next.delete(key);
  next.delete("page");
  return next;
}

export function palworldPalsDetailFilterCount(params: URLSearchParams): number {
  return (["element", "work", "rarity", "variant"] as const)
    .filter((key) => Boolean(params.get(key)?.trim()))
    .length;
}
