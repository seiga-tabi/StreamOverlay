import {
  PALWORLD_ELEMENTS,
  PALWORLD_MAP_WORLDS,
  type PalworldElement,
  type PalworldMapWorld,
} from "@streamops/shared";
import generatedAssets from "../data/palworld-static-assets.generated.json";

export type PalworldElementImage = {
  imageUrl: string;
  width: number;
  height: number;
};

const ELEMENT_IMAGE_PATTERN = /^\/images\/palworld\/(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\/elements\/[0-9a-f]{64}\.webp$/u;
const MAP_IMAGE_PATTERN = /^\/images\/palworld\/(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\/maps\/[0-9a-f]{64}\.webp$/u;
const ASSET_RELEASE_PATTERN = /^\/images\/palworld\/((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\//u;

function safeDimensions(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 8_192;
}

export function isLocalPalworldElementImageUrl(value: string): boolean {
  return ELEMENT_IMAGE_PATTERN.test(value);
}

export function isLocalPalworldMapUrl(value: string | undefined): value is string {
  return typeof value === "string" && MAP_IMAGE_PATTERN.test(value);
}

function assetRelease(imageUrl: string): string | undefined {
  return ASSET_RELEASE_PATTERN.exec(imageUrl)?.[1];
}

function staticAssets(): {
  elements: Readonly<Partial<Record<PalworldElement, PalworldElementImage>>>;
  map?: PalworldElementImage;
  maps: Readonly<Partial<Record<PalworldMapWorld, PalworldElementImage>>>;
} {
  if (generatedAssets.schemaVersion !== 1) {
    return { elements: Object.freeze({}), maps: Object.freeze({}) };
  }
  const coordinateMap = generatedAssets.map;
  const safeCoordinateMap = isLocalPalworldMapUrl(coordinateMap.imageUrl)
    && safeDimensions(coordinateMap.width)
    && safeDimensions(coordinateMap.height)
    ? {
        imageUrl: coordinateMap.imageUrl,
        width: coordinateMap.width,
        height: coordinateMap.height,
      }
    : undefined;
  const displayMap = generatedAssets.displayMap;
  const safeDisplayMap = safeCoordinateMap
    && isLocalPalworldMapUrl(displayMap.imageUrl)
    && safeDimensions(displayMap.width)
    && safeDimensions(displayMap.height)
    && displayMap.width === safeCoordinateMap.width
    && displayMap.height === safeCoordinateMap.height
    && assetRelease(displayMap.imageUrl) === assetRelease(safeCoordinateMap.imageUrl)
    ? {
        imageUrl: displayMap.imageUrl,
        width: displayMap.width,
        height: displayMap.height,
      }
    : undefined;
  const expectedRelease = safeCoordinateMap
    ? assetRelease(safeCoordinateMap.imageUrl)
    : undefined;
  const maps = new Map<PalworldMapWorld, PalworldElementImage>();
  const generatedMaps = generatedAssets.maps as Partial<
    Record<PalworldMapWorld, PalworldElementImage>
  >;
  for (const world of PALWORLD_MAP_WORLDS) {
    const candidate = generatedMaps[world];
    if (
      candidate
      && isLocalPalworldMapUrl(candidate.imageUrl)
      && safeDimensions(candidate.width)
      && safeDimensions(candidate.height)
      && assetRelease(candidate.imageUrl) === expectedRelease
    ) {
      maps.set(world, {
        imageUrl: candidate.imageUrl,
        width: candidate.width,
        height: candidate.height,
      });
    }
  }
  const mainCoordinateMap = maps.get("main");
  if (
    !safeCoordinateMap
    || !safeDisplayMap
    || mainCoordinateMap?.imageUrl !== safeCoordinateMap.imageUrl
    || mainCoordinateMap.width !== safeCoordinateMap.width
    || mainCoordinateMap.height !== safeCoordinateMap.height
  ) {
    maps.delete("main");
  } else {
    maps.set("main", safeDisplayMap);
  }
  const entries = new Map<PalworldElement, PalworldElementImage>();
  const duplicates = new Set<PalworldElement>();

  for (const entry of generatedAssets.elements) {
    if (
      !PALWORLD_ELEMENTS.includes(entry.id as PalworldElement)
      || !isLocalPalworldElementImageUrl(entry.imageUrl)
      || !safeDimensions(entry.width)
      || !safeDimensions(entry.height)
      || assetRelease(entry.imageUrl) !== expectedRelease
    ) continue;
    const id = entry.id as PalworldElement;
    if (entries.has(id)) {
      duplicates.add(id);
      continue;
    }
    entries.set(id, {
      imageUrl: entry.imageUrl,
      width: entry.width,
      height: entry.height,
    });
  }
  for (const id of duplicates) entries.delete(id);

  return {
    elements: Object.freeze(Object.fromEntries(entries)) as Readonly<Partial<Record<PalworldElement, PalworldElementImage>>>,
    maps: Object.freeze(Object.fromEntries(maps)) as Readonly<
      Partial<Record<PalworldMapWorld, PalworldElementImage>>
    >,
    ...(safeDisplayMap ? { map: Object.freeze(safeDisplayMap) } : {}),
  };
}

const STATIC_ASSETS = staticAssets();

export const PALWORLD_ELEMENT_IMAGES = STATIC_ASSETS.elements;
export const PALWORLD_WORLD_MAP_IMAGE = STATIC_ASSETS.map;
export const PALWORLD_MAP_IMAGES = STATIC_ASSETS.maps;
