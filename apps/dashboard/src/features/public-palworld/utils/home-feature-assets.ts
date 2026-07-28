import generatedAssets from "../data/palworld-home-feature-assets.json";

export type PalworldHomeFeatureAssetId = "breeding" | "map" | "pals";

export type PalworldHomeFeatureAsset = {
  canonicalEntityId: string;
  height: number;
  imageUrl: string;
  width: number;
};

const HOME_ASSET_URL_PATTERN =
  /^\/images\/public-home\/palworld\/features\/((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\/[0-9a-f]{64}\.webp$/u;
const HOME_ASSET_IDS: readonly PalworldHomeFeatureAssetId[] = [
  "pals",
  "breeding",
  "map",
];

function isSafeDimension(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 4_096;
}

function homeFeatureAssets(): Readonly<
  Partial<Record<PalworldHomeFeatureAssetId, PalworldHomeFeatureAsset>>
> {
  if (
    generatedAssets.schemaVersion !== 1
    || generatedAssets.rightsVerified !== false
    || generatedAssets.usageBasis !== "operator_reference_use"
  ) {
    return Object.freeze({});
  }

  const assets = new Map<PalworldHomeFeatureAssetId, PalworldHomeFeatureAsset>();
  const duplicates = new Set<PalworldHomeFeatureAssetId>();

  for (const entry of generatedAssets.entries) {
    if (!HOME_ASSET_IDS.includes(entry.id as PalworldHomeFeatureAssetId)) continue;
    const id = entry.id as PalworldHomeFeatureAssetId;
    const release = HOME_ASSET_URL_PATTERN.exec(entry.imageUrl)?.[1];
    if (
      release !== generatedAssets.release
      || entry.format !== "webp"
      || entry.rightsVerified !== false
      || entry.usageBasis !== "operator_reference_use"
      || !isSafeDimension(entry.width)
      || !isSafeDimension(entry.height)
      || typeof entry.canonicalEntityId !== "string"
      || entry.canonicalEntityId.length === 0
    ) continue;

    if (assets.has(id)) {
      duplicates.add(id);
      continue;
    }
    assets.set(id, {
      canonicalEntityId: entry.canonicalEntityId,
      height: entry.height,
      imageUrl: entry.imageUrl,
      width: entry.width,
    });
  }

  for (const id of duplicates) assets.delete(id);
  return Object.freeze(Object.fromEntries(assets));
}

export const PALWORLD_HOME_FEATURE_ASSETS = homeFeatureAssets();
