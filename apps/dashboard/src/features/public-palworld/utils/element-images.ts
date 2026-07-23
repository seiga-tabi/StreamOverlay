import { PALWORLD_ELEMENTS, type PalworldElement } from "@streamops/shared";
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
} {
  if (generatedAssets.schemaVersion !== 1) {
    return { elements: Object.freeze({}) };
  }
  const map = generatedAssets.map;
  const safeMap = isLocalPalworldMapUrl(map.imageUrl) && safeDimensions(map.width) && safeDimensions(map.height)
    ? { imageUrl: map.imageUrl, width: map.width, height: map.height }
    : undefined;
  const expectedRelease = safeMap ? assetRelease(safeMap.imageUrl) : undefined;
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
    ...(safeMap ? { map: Object.freeze(safeMap) } : {}),
  };
}

const STATIC_ASSETS = staticAssets();

export const PALWORLD_ELEMENT_IMAGES = STATIC_ASSETS.elements;
export const PALWORLD_WORLD_MAP_IMAGE = STATIC_ASSETS.map;
