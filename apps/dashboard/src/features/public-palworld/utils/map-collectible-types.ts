import type {
  PalworldMapLocation,
  PalworldMapLocationCategory,
} from "@streamops/shared";

export const PALWORLD_MAP_STATUE_TYPE_IDS = [
  "statue-lifmunk",
  "statue-lamball",
  "statue-pengullet",
  "statue-munchill",
  "statue-rooby",
  "statue-herbil",
  "statue-tanzee",
  "statue-depresso",
  "statue-cattiva",
  "statue-lunaris",
  "statue-relaxaurus",
  "statue-yakumo",
] as const;

export const PALWORLD_MAP_EGG_TYPE_IDS = [
  "egg-grass",
  "egg-desert",
  "egg-glacier",
  "egg-volcanic",
  "egg-sakurajima",
  "egg-sky-island",
  "egg-tenraku",
  "egg-world-tree",
] as const;

export const PALWORLD_MAP_COLLECTIBLE_TYPE_IDS = [
  ...PALWORLD_MAP_STATUE_TYPE_IDS,
  ...PALWORLD_MAP_EGG_TYPE_IDS,
] as const;

export type PalworldMapStatueTypeId =
  (typeof PALWORLD_MAP_STATUE_TYPE_IDS)[number];
export type PalworldMapEggTypeId =
  (typeof PALWORLD_MAP_EGG_TYPE_IDS)[number];
export type PalworldMapCollectibleTypeId =
  (typeof PALWORLD_MAP_COLLECTIBLE_TYPE_IDS)[number];

const COLLECTIBLE_TYPE_CATEGORY: Readonly<
  Record<PalworldMapCollectibleTypeId, "egg" | "lifmunk">
> = Object.freeze(Object.fromEntries([
  ...PALWORLD_MAP_STATUE_TYPE_IDS.map((id) => [id, "lifmunk"] as const),
  ...PALWORLD_MAP_EGG_TYPE_IDS.map((id) => [id, "egg"] as const),
])) as Readonly<Record<PalworldMapCollectibleTypeId, "egg" | "lifmunk">>;

const EGG_SUBTYPE_PREFIXES: Readonly<
  Record<PalworldMapEggTypeId, string>
> = {
  "egg-grass": "grass-",
  "egg-desert": "desert-",
  "egg-glacier": "glacier-",
  "egg-volcanic": "volcanic-",
  "egg-sakurajima": "sakurajima-",
  "egg-sky-island": "sky-island-",
  "egg-tenraku": "tenraku-",
  "egg-world-tree": "world-tree-",
};

export function isPalworldMapCollectibleTypeId(
  value: string,
): value is PalworldMapCollectibleTypeId {
  return PALWORLD_MAP_COLLECTIBLE_TYPE_IDS.includes(
    value as PalworldMapCollectibleTypeId,
  );
}

export function palworldMapCollectibleCategory(
  typeId: PalworldMapCollectibleTypeId,
): "egg" | "lifmunk" {
  return COLLECTIBLE_TYPE_CATEGORY[typeId];
}

export function palworldMapCollectibleTypesForCategory(
  category: PalworldMapLocationCategory,
): readonly PalworldMapCollectibleTypeId[] {
  if (category === "egg") return PALWORLD_MAP_EGG_TYPE_IDS;
  if (category === "lifmunk") return PALWORLD_MAP_STATUE_TYPE_IDS;
  return [];
}

export function palworldMapCollectibleTypeForLocation(
  location: Pick<PalworldMapLocation, "category" | "subtype">,
): PalworldMapCollectibleTypeId | undefined {
  if (location.category === "lifmunk") {
    return isPalworldMapCollectibleTypeId(location.subtype)
      && location.subtype.startsWith("statue-")
      ? location.subtype
      : undefined;
  }
  if (location.category !== "egg") return undefined;
  return PALWORLD_MAP_EGG_TYPE_IDS.find((id) =>
    location.subtype.startsWith(EGG_SUBTYPE_PREFIXES[id])
  );
}

