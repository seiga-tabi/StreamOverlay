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
  /** 반응형 변형(좁은 폭·낮은 배율용). 검증을 통과한 것만 담습니다. */
  variants?: readonly PalworldMapImageVariant[];
};

export type PalworldMapImageVariant = {
  width: number;
  imageUrl: string;
};

const ELEMENT_IMAGE_PATTERN = /^\/images\/palworld\/(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\/elements\/[0-9a-f]{64}\.webp$/u;
const MAP_IMAGE_PATTERN = /^\/images\/palworld\/(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\/maps\/[0-9a-f]{64}\.webp$/u;
/* 변형은 파생 자산 전용 트리에 삽니다. `/images/palworld/<release>/` 는 서버가
   "파일명 = 내용 SHA-256" 으로 봉인한 원본 공간이라 리사이즈본을 둘 수 없습니다. */
const MAP_VARIANT_PATTERN = /^\/images\/palworld-derived\/(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\/maps\/[0-9a-f]{64}-w(?:768|1024|1536|2048)\.webp$/u;
const ASSET_RELEASE_PATTERN = /^\/images\/palworld\/((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\//u;

function safeDimensions(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 8_192;
}

/** 원본과 같은 릴리스·같은 해시에서 파생된 변형만 통과시킵니다. */
function safeMapVariants(
  source: string,
  value: unknown,
): readonly PalworldMapImageVariant[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const prefix = source
    .replace("/images/palworld/", "/images/palworld-derived/")
    .replace(/\.webp$/u, "");
  const variants: PalworldMapImageVariant[] = [];
  for (const candidate of value) {
    if (
      typeof candidate !== "object" || candidate === null
      || typeof (candidate as { imageUrl?: unknown }).imageUrl !== "string"
      || !safeDimensions((candidate as { width?: unknown }).width)
    ) return undefined;
    const variant = candidate as { imageUrl: string; width: number };
    if (
      !MAP_VARIANT_PATTERN.test(variant.imageUrl)
      || variant.imageUrl !== `${prefix}-w${variant.width}.webp`
    ) return undefined;
    variants.push({ width: variant.width, imageUrl: variant.imageUrl });
  }
  return Object.freeze([...variants].sort((a, b) => a.width - b.width));
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
      const candidateVariants = safeMapVariants(
        candidate.imageUrl,
        (candidate as { variants?: unknown }).variants,
      );
      maps.set(world, {
        imageUrl: candidate.imageUrl,
        width: candidate.width,
        height: candidate.height,
        ...(candidateVariants ? { variants: candidateVariants } : {}),
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
    const displayVariants = safeMapVariants(
      safeDisplayMap.imageUrl,
      (generatedMaps as Record<string, { variants?: unknown }>)["main-display"]?.variants,
    );
    maps.set("main", displayVariants
      ? { ...safeDisplayMap, variants: displayVariants }
      : safeDisplayMap);
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
