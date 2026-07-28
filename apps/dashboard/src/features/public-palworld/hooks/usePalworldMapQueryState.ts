import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PALWORLD_MAP_MAX_ZOOM,
  PALWORLD_MAP_MIN_ZOOM,
} from "./usePalworldMapViewport";
import {
  PALWORLD_ROUTE_EVENT,
  palworldPathForPage,
  setPalworldUrl,
} from "../utils/routes";
import {
  PALWORLD_MAP_COLLECTIBLE_TYPE_IDS,
  isPalworldMapCollectibleTypeId,
  type PalworldMapCollectibleTypeId,
} from "../utils/map-collectible-types";

export const PALWORLD_MAP_LAYERS = [
  "boss",
  "spawn",
  "fast-travel",
  "dungeon",
  "npc",
  "egg",
  "lifmunk",
  "skill-fruit",
  "treasure",
  "journal",
  "resource",
] as const;
export const PALWORLD_MAP_WORLDS = ["main", "tree"] as const;
export const PALWORLD_MAP_PERIODS = ["all", "day", "night"] as const;

export type PalworldMapLayer = (typeof PALWORLD_MAP_LAYERS)[number];
export type PalworldMapWorld = (typeof PALWORLD_MAP_WORLDS)[number];
export type PalworldMapPeriod = (typeof PALWORLD_MAP_PERIODS)[number];

export type PalworldMapQueryState = {
  center?: {
    x: number;
    y: number;
  };
  focusPal?: string;
  layers: readonly PalworldMapLayer[];
  marker?: string;
  period: PalworldMapPeriod;
  types: readonly PalworldMapCollectibleTypeId[];
  world: PalworldMapWorld;
  zoom: number;
};

export type PalworldMapQueryPatch = {
  center?: PalworldMapQueryState["center"] | null;
  focusPal?: string | null;
  layers?: readonly PalworldMapLayer[];
  marker?: string | null;
  period?: PalworldMapPeriod;
  types?: readonly PalworldMapCollectibleTypeId[];
  world?: PalworldMapWorld;
  zoom?: number;
};

type PalworldMapLocationEventTarget = {
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
};

const PALWORLD_MAP_DEFAULT_LAYERS: readonly PalworldMapLayer[] = [
  "boss",
  "spawn",
];
const PALWORLD_MAP_PUBLIC_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/u;
const PALWORLD_MAP_NORMALIZED_COORDINATE_PATTERN =
  /^(?:0(?:\.\d{1,6})?|1(?:\.0{1,6})?)$/u;
const PALWORLD_MAP_ZOOM_PATTERN = /^(?:[1-4](?:\.\d{1,3})?|5(?:\.0{1,3})?)$/u;

function singleQueryValue(
  params: URLSearchParams,
  key: string,
): string | undefined {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : undefined;
}

function isPalworldMapPublicId(value: string): boolean {
  return PALWORLD_MAP_PUBLIC_ID_PATTERN.test(value);
}

function parseNormalizedCoordinate(value: string | undefined): number | undefined {
  if (value === undefined || !PALWORLD_MAP_NORMALIZED_COORDINATE_PATTERN.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : undefined;
}

function parseZoom(value: string | undefined): number | undefined {
  if (value === undefined || !PALWORLD_MAP_ZOOM_PATTERN.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed)
    && parsed >= PALWORLD_MAP_MIN_ZOOM
    && parsed <= PALWORLD_MAP_MAX_ZOOM
    ? parsed
    : undefined;
}

function parseLayers(value: string | undefined): readonly PalworldMapLayer[] {
  if (value === undefined) {
    return PALWORLD_MAP_DEFAULT_LAYERS;
  }
  if (value === "") {
    return [];
  }
  const values = value.split(",");
  if (
    values.some((layer) => !PALWORLD_MAP_LAYERS.includes(layer as PalworldMapLayer))
    || new Set(values).size !== values.length
  ) {
    return PALWORLD_MAP_DEFAULT_LAYERS;
  }
  return PALWORLD_MAP_LAYERS.filter((layer) => values.includes(layer));
}

function parseCollectibleTypes(
  value: string | undefined,
): readonly PalworldMapCollectibleTypeId[] {
  if (value === undefined) return PALWORLD_MAP_COLLECTIBLE_TYPE_IDS;
  if (value === "") return [];
  const values = value.split(",");
  if (
    values.some((typeId) => !isPalworldMapCollectibleTypeId(typeId))
    || new Set(values).size !== values.length
  ) {
    return PALWORLD_MAP_COLLECTIBLE_TYPE_IDS;
  }
  return PALWORLD_MAP_COLLECTIBLE_TYPE_IDS.filter((typeId) =>
    values.includes(typeId)
  );
}

function sameLayers(
  first: readonly PalworldMapLayer[],
  second: readonly PalworldMapLayer[],
): boolean {
  return first.length === second.length
    && first.every((layer, index) => layer === second[index]);
}

function sameCollectibleTypes(
  first: readonly PalworldMapCollectibleTypeId[],
  second: readonly PalworldMapCollectibleTypeId[],
): boolean {
  return first.length === second.length
    && first.every((typeId, index) => typeId === second[index]);
}

export function updatePalworldMapLayerSelection(
  current: readonly PalworldMapLayer[],
  layerIds: readonly PalworldMapLayer[],
  selected: boolean,
): readonly PalworldMapLayer[] {
  if (
    [...current, ...layerIds].some((layer) => !PALWORLD_MAP_LAYERS.includes(layer))
    || new Set(current).size !== current.length
    || new Set(layerIds).size !== layerIds.length
  ) {
    throw new TypeError("지도 레이어 선택값이 올바르지 않습니다.");
  }
  const next = new Set(current);
  for (const layerId of layerIds) {
    if (selected) next.add(layerId);
    else next.delete(layerId);
  }
  return PALWORLD_MAP_LAYERS.filter((layerId) => next.has(layerId));
}

function assertPublicId(value: string, key: string): void {
  if (!isPalworldMapPublicId(value)) {
    throw new TypeError(`${key} 값이 올바른 Palworld 공개 ID가 아닙니다.`);
  }
}

function assertNormalizedCoordinate(value: number, key: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${key} 좌표는 0 이상 1 이하여야 합니다.`);
  }
}

function formatQueryNumber(value: number, maximumFractionDigits: number): string {
  return Number(value.toFixed(maximumFractionDigits)).toString();
}

export function parsePalworldMapQuery(
  params: URLSearchParams,
): PalworldMapQueryState {
  const worldValue = singleQueryValue(params, "world");
  const periodValue = singleQueryValue(params, "period");
  const focusPalValue = singleQueryValue(params, "focusPal");
  const markerValue = singleQueryValue(params, "marker");
  const x = parseNormalizedCoordinate(singleQueryValue(params, "x"));
  const y = parseNormalizedCoordinate(singleQueryValue(params, "y"));

  return {
    ...(x !== undefined && y !== undefined ? { center: { x, y } } : {}),
    ...(focusPalValue !== undefined && isPalworldMapPublicId(focusPalValue)
      ? { focusPal: focusPalValue }
      : {}),
    layers: parseLayers(singleQueryValue(params, "layers")),
    ...(markerValue !== undefined && isPalworldMapPublicId(markerValue)
      ? { marker: markerValue }
      : {}),
    period: periodValue !== undefined
      && PALWORLD_MAP_PERIODS.includes(periodValue as PalworldMapPeriod)
      ? periodValue as PalworldMapPeriod
      : "all",
    types: parseCollectibleTypes(singleQueryValue(params, "types")),
    world: worldValue !== undefined
      && PALWORLD_MAP_WORLDS.includes(worldValue as PalworldMapWorld)
      ? worldValue as PalworldMapWorld
      : "main",
    zoom: parseZoom(singleQueryValue(params, "zoom")) ?? PALWORLD_MAP_MIN_ZOOM,
  };
}

/**
 * 지도 전용 query만 변경하고 검색·상세 Modal 등 다른 공개 페이지 query는 보존합니다.
 * `pal`은 상세 Modal용이므로 지도 초점에는 `focusPal`만 기록합니다.
 */
export function updatePalworldMapQueryParams(
  current: URLSearchParams,
  patch: PalworldMapQueryPatch,
): URLSearchParams {
  const next = new URLSearchParams(current);

  if (patch.world !== undefined) {
    if (!PALWORLD_MAP_WORLDS.includes(patch.world)) {
      throw new TypeError("world 값이 지원되지 않습니다.");
    }
    if (patch.world === "main") next.delete("world");
    else next.set("world", patch.world);
  }

  if (patch.layers !== undefined) {
    if (
      patch.layers.some((layer) => !PALWORLD_MAP_LAYERS.includes(layer))
      || new Set(patch.layers).size !== patch.layers.length
    ) {
      throw new TypeError("layers 값에 지원되지 않거나 중복된 레이어가 있습니다.");
    }
    const orderedLayers = PALWORLD_MAP_LAYERS.filter((layer) => patch.layers?.includes(layer));
    if (sameLayers(orderedLayers, PALWORLD_MAP_DEFAULT_LAYERS)) next.delete("layers");
    else next.set("layers", orderedLayers.join(","));
  }

  if (patch.types !== undefined) {
    if (
      patch.types.some((typeId) => !isPalworldMapCollectibleTypeId(typeId))
      || new Set(patch.types).size !== patch.types.length
    ) {
      throw new TypeError("types 값에 지원되지 않거나 중복된 수집품 종류가 있습니다.");
    }
    const orderedTypes = PALWORLD_MAP_COLLECTIBLE_TYPE_IDS.filter((typeId) =>
      patch.types?.includes(typeId)
    );
    if (sameCollectibleTypes(orderedTypes, PALWORLD_MAP_COLLECTIBLE_TYPE_IDS)) {
      next.delete("types");
    } else {
      next.set("types", orderedTypes.join(","));
    }
  }

  if (patch.focusPal !== undefined) {
    if (patch.focusPal === null) next.delete("focusPal");
    else {
      assertPublicId(patch.focusPal, "focusPal");
      next.set("focusPal", patch.focusPal);
    }
  }

  if (patch.period !== undefined) {
    if (!PALWORLD_MAP_PERIODS.includes(patch.period)) {
      throw new TypeError("period 값이 지원되지 않습니다.");
    }
    if (patch.period === "all") next.delete("period");
    else next.set("period", patch.period);
  }

  if (patch.center !== undefined) {
    if (patch.center === null) {
      next.delete("x");
      next.delete("y");
    } else {
      assertNormalizedCoordinate(patch.center.x, "x");
      assertNormalizedCoordinate(patch.center.y, "y");
      next.set("x", formatQueryNumber(patch.center.x, 6));
      next.set("y", formatQueryNumber(patch.center.y, 6));
    }
  }

  if (patch.zoom !== undefined) {
    if (
      !Number.isFinite(patch.zoom)
      || patch.zoom < PALWORLD_MAP_MIN_ZOOM
      || patch.zoom > PALWORLD_MAP_MAX_ZOOM
    ) {
      throw new RangeError(
        `zoom 값은 ${PALWORLD_MAP_MIN_ZOOM} 이상 ${PALWORLD_MAP_MAX_ZOOM} 이하여야 합니다.`,
      );
    }
    if (patch.zoom === PALWORLD_MAP_MIN_ZOOM) next.delete("zoom");
    else next.set("zoom", formatQueryNumber(patch.zoom, 3));
  }

  if (patch.marker !== undefined) {
    if (patch.marker === null) next.delete("marker");
    else {
      assertPublicId(patch.marker, "marker");
      next.set("marker", patch.marker);
    }
  }

  return next;
}

export function palworldMapUrlWithQueryPatch(
  current: URLSearchParams,
  patch: PalworldMapQueryPatch,
): string {
  const query = updatePalworldMapQueryParams(current, patch).toString();
  const pathname = palworldPathForPage("map");
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function subscribePalworldMapQueryState(
  target: PalworldMapLocationEventTarget,
  listener: () => void,
): () => void {
  const handleLocationChange: EventListener = () => listener();
  target.addEventListener("popstate", handleLocationChange);
  target.addEventListener(PALWORLD_ROUTE_EVENT, handleLocationChange);
  return () => {
    target.removeEventListener("popstate", handleLocationChange);
    target.removeEventListener(PALWORLD_ROUTE_EVENT, handleLocationChange);
  };
}

export function usePalworldMapQueryState() {
  const [locationRevision, setLocationRevision] = useState(0);

  useEffect(
    () => subscribePalworldMapQueryState(
      window,
      () => setLocationRevision((revision) => revision + 1),
    ),
    [],
  );

  const search = typeof window === "undefined" ? "" : window.location.search;
  const state = useMemo(
    () => parsePalworldMapQuery(new URLSearchParams(search)),
    [locationRevision, search],
  );

  const commit = useCallback((patch: PalworldMapQueryPatch, replace: boolean): void => {
    const current = new URLSearchParams(window.location.search);
    setPalworldUrl(palworldMapUrlWithQueryPatch(current, patch), replace);
  }, []);

  const pushQuery = useCallback(
    (patch: PalworldMapQueryPatch): void => commit(patch, false),
    [commit],
  );
  const replaceQuery = useCallback(
    (patch: PalworldMapQueryPatch): void => commit(patch, true),
    [commit],
  );

  return {
    locationRevision,
    pushQuery,
    replaceQuery,
    state,
  };
}
