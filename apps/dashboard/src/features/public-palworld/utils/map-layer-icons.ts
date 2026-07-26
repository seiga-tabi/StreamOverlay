import generatedMapLayerIcons from "../data/palworld-map-layer-icons.json";
import {
  PALWORLD_MAP_EXPLORER_LAYER_IDS,
  type PalworldMapExplorerLayerId,
  type PalworldMapLayerIconAsset,
} from "../components/PalworldMapExplorerTypes";

const MAP_LAYER_ICON_URL_PATTERN =
  /^\/images\/palworld\/((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\/(map-icons|pals|items)\/[0-9a-f]{64}\.webp$/u;
const MAP_LAYER_ICON_KINDS = ["map", "pal", "item"] as const;
const MAP_LAYER_ICON_MAPPING_STATUSES = [
  "exact_datatable_reference",
  "verified_game_ui",
  "representative_game_asset",
  "representative_runtime_asset",
] as const;
const MAP_LAYER_ICON_DIRECTORIES: Record<PalworldMapLayerIconKind, string> = {
  map: "map-icons",
  pal: "pals",
  item: "items",
};

type PalworldMapLayerIconKind = (typeof MAP_LAYER_ICON_KINDS)[number];
type PalworldMapLayerIconMappingStatus =
  (typeof MAP_LAYER_ICON_MAPPING_STATUSES)[number];

type GeneratedMapLayerIcon = PalworldMapLayerIconAsset & {
  id: PalworldMapExplorerLayerId;
  kind: PalworldMapLayerIconKind;
  mappingStatus: PalworldMapLayerIconMappingStatus;
  sourceReference: string;
};

function safeDimension(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 512;
}

export function isLocalPalworldMapLayerIconUrl(value: string): boolean {
  return MAP_LAYER_ICON_URL_PATTERN.test(value);
}

function loadMapLayerIcons(): Readonly<
  Partial<Record<PalworldMapExplorerLayerId, PalworldMapLayerIconAsset>>
> {
  if (
    generatedMapLayerIcons.schemaVersion !== 1
    || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(
      generatedMapLayerIcons.release,
    )
    || !Array.isArray(generatedMapLayerIcons.entries)
  ) {
    return Object.freeze({});
  }

  const expectedIds = new Set<PalworldMapExplorerLayerId>(
    PALWORLD_MAP_EXPLORER_LAYER_IDS,
  );
  const entries = new Map<
    PalworldMapExplorerLayerId,
    PalworldMapLayerIconAsset
  >();
  const duplicates = new Set<PalworldMapExplorerLayerId>();

  for (const candidate of generatedMapLayerIcons.entries) {
    const entry = candidate as GeneratedMapLayerIcon;
    const match = MAP_LAYER_ICON_URL_PATTERN.exec(entry.imageUrl);
    if (expectedIds.has(entry.id) && entries.has(entry.id)) {
      duplicates.add(entry.id);
      continue;
    }
    if (
      !expectedIds.has(entry.id)
      || !MAP_LAYER_ICON_KINDS.includes(entry.kind)
      || !MAP_LAYER_ICON_MAPPING_STATUSES.includes(entry.mappingStatus)
      || typeof entry.sourceReference !== "string"
      || entry.sourceReference.length < 1
      || entry.sourceReference.length > 256
      || /[\u0000-\u001f\u007f]/u.test(entry.sourceReference)
      || match?.[1] !== generatedMapLayerIcons.release
      || match?.[2] !== MAP_LAYER_ICON_DIRECTORIES[entry.kind]
      || !safeDimension(entry.width)
      || !safeDimension(entry.height)
    ) {
      continue;
    }
    entries.set(entry.id, Object.freeze({
      imageUrl: entry.imageUrl,
      width: entry.width,
      height: entry.height,
    }));
  }

  for (const duplicate of duplicates) entries.delete(duplicate);

  return Object.freeze(Object.fromEntries(entries)) as Readonly<
    Partial<Record<PalworldMapExplorerLayerId, PalworldMapLayerIconAsset>>
  >;
}

export const PALWORLD_MAP_LAYER_ICONS = loadMapLayerIcons();
