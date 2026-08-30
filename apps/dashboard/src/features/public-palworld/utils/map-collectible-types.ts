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

export const PALWORLD_MAP_RESOURCE_TYPE_IDS = [
  "resource-ancient-beast-bone",
  "resource-ancient-dragon-fragment",
  "resource-ancient-tree-bark",
  "resource-pal-crystal",
  "resource-coal",
  "resource-copper-ore",
  "resource-chromite",
  "resource-hexolite-quartz",
  "resource-manganese-ore",
  "resource-quartz",
  "resource-quartz-cluster",
  "resource-solarlite",
  "resource-stone",
  "resource-sulfur",
  "resource-world-tree-ore",
] as const;

export const PALWORLD_MAP_NPC_TYPE_IDS = [
  "npc-wandering-merchant",
  "npc-dark-trader",
  "npc-medal-trader",
] as const;

export const PALWORLD_MAP_ENEMY_TYPE_IDS = [
  "enemy-boss-tower",
  "enemy-camp",
  "enemy-incident",
] as const;

export const PALWORLD_MAP_LOCATION_TYPE_IDS = [
  "location-respawn",
  "location-warp-altar",
  "location-home",
  "location-observation-tower",
  "location-region-name",
  "location-treasure-map",
  "location-ancient-ruin",
] as const;

export const PALWORLD_MAP_COLLECTIBLE_TYPE_IDS = [
  ...PALWORLD_MAP_STATUE_TYPE_IDS,
  ...PALWORLD_MAP_EGG_TYPE_IDS,
  ...PALWORLD_MAP_RESOURCE_TYPE_IDS,
  ...PALWORLD_MAP_NPC_TYPE_IDS,
  ...PALWORLD_MAP_ENEMY_TYPE_IDS,
  ...PALWORLD_MAP_LOCATION_TYPE_IDS,
] as const;

export type PalworldMapEggTypeId =
  (typeof PALWORLD_MAP_EGG_TYPE_IDS)[number];
export type PalworldMapResourceTypeId =
  (typeof PALWORLD_MAP_RESOURCE_TYPE_IDS)[number];
export type PalworldMapNpcTypeId =
  (typeof PALWORLD_MAP_NPC_TYPE_IDS)[number];
export type PalworldMapEnemyTypeId =
  (typeof PALWORLD_MAP_ENEMY_TYPE_IDS)[number];
export type PalworldMapLocationTypeId =
  (typeof PALWORLD_MAP_LOCATION_TYPE_IDS)[number];
export type PalworldMapCollectibleTypeId =
  (typeof PALWORLD_MAP_COLLECTIBLE_TYPE_IDS)[number];

const COLLECTIBLE_TYPE_CATEGORY: Readonly<
  Record<
    PalworldMapCollectibleTypeId,
    "egg" | "lifmunk" | "resource" | "npc" | "enemy" | "location"
  >
> = Object.freeze(Object.fromEntries([
  ...PALWORLD_MAP_STATUE_TYPE_IDS.map((id) => [id, "lifmunk"] as const),
  ...PALWORLD_MAP_EGG_TYPE_IDS.map((id) => [id, "egg"] as const),
  ...PALWORLD_MAP_RESOURCE_TYPE_IDS.map((id) => [id, "resource"] as const),
  ...PALWORLD_MAP_NPC_TYPE_IDS.map((id) => [id, "npc"] as const),
  ...PALWORLD_MAP_ENEMY_TYPE_IDS.map((id) => [id, "enemy"] as const),
  ...PALWORLD_MAP_LOCATION_TYPE_IDS.map((id) => [id, "location"] as const),
])) as Readonly<
  Record<
    PalworldMapCollectibleTypeId,
    "egg" | "lifmunk" | "resource" | "npc" | "enemy" | "location"
  >
>;

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

const RESOURCE_SUBTYPE_TYPES: Readonly<
  Record<string, PalworldMapResourceTypeId>
> = Object.freeze({
  "ancient-beast-bone": "resource-ancient-beast-bone",
  "ancient-dragon-fragment": "resource-ancient-dragon-fragment",
  "ancient-tree-bark": "resource-ancient-tree-bark",
  "pal-crystal": "resource-pal-crystal",
  "pal-crystal-small": "resource-pal-crystal",
  chromite: "resource-chromite",
  coal: "resource-coal",
  "copper-ore": "resource-copper-ore",
  "hexolite-quartz": "resource-hexolite-quartz",
  "manganese-ore": "resource-manganese-ore",
  quartz: "resource-quartz",
  "quartz-cluster": "resource-quartz-cluster",
  solarlite: "resource-solarlite",
  stone: "resource-stone",
  "stone-18": "resource-stone",
  "stone-2": "resource-stone",
  "stone-3": "resource-stone",
  "stone-4": "resource-stone",
  "stone-5": "resource-stone",
  "stone-6": "resource-stone",
  "stone-7": "resource-stone",
  sulfur: "resource-sulfur",
  "world-tree-ore": "resource-world-tree-ore",
});

const NPC_SUBTYPE_TYPES: Readonly<Record<string, PalworldMapNpcTypeId>> =
  Object.freeze({
    "dark-trader": "npc-dark-trader",
    "medal-trader": "npc-medal-trader",
    "merchant-1": "npc-wandering-merchant",
    "merchant-2": "npc-wandering-merchant",
    "merchant-3": "npc-wandering-merchant",
  });

const ENEMY_SUBTYPE_TYPES: Readonly<Record<string, PalworldMapEnemyTypeId>> =
  Object.freeze({
    "boss-tower": "enemy-boss-tower",
    "enemy-camp": "enemy-camp",
    incident: "enemy-incident",
  });

const LOCATION_SUBTYPE_TYPES: Readonly<
  Record<string, PalworldMapLocationTypeId>
> = Object.freeze({
  "ancient-ruin": "location-ancient-ruin",
  home: "location-home",
  "observation-tower": "location-observation-tower",
  "region-name": "location-region-name",
  respawn: "location-respawn",
  "treasure-map": "location-treasure-map",
  "warp-altar": "location-warp-altar",
});

export function isPalworldMapCollectibleTypeId(
  value: string,
): value is PalworldMapCollectibleTypeId {
  return PALWORLD_MAP_COLLECTIBLE_TYPE_IDS.includes(
    value as PalworldMapCollectibleTypeId,
  );
}

export function palworldMapCollectibleCategory(
  typeId: PalworldMapCollectibleTypeId,
): "egg" | "lifmunk" | "resource" | "npc" | "enemy" | "location" {
  return COLLECTIBLE_TYPE_CATEGORY[typeId];
}

export function palworldMapCollectibleTypesForCategory(
  category: PalworldMapLocationCategory,
): readonly PalworldMapCollectibleTypeId[] {
  if (category === "egg") return PALWORLD_MAP_EGG_TYPE_IDS;
  if (category === "lifmunk") return PALWORLD_MAP_STATUE_TYPE_IDS;
  if (category === "resource") return PALWORLD_MAP_RESOURCE_TYPE_IDS;
  if (category === "npc") return PALWORLD_MAP_NPC_TYPE_IDS;
  if (category === "enemy") return PALWORLD_MAP_ENEMY_TYPE_IDS;
  if (category === "location") return PALWORLD_MAP_LOCATION_TYPE_IDS;
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
  if (location.category === "egg") {
    return PALWORLD_MAP_EGG_TYPE_IDS.find((id) =>
      location.subtype.startsWith(EGG_SUBTYPE_PREFIXES[id])
    );
  }
  if (location.category === "resource") {
    return RESOURCE_SUBTYPE_TYPES[location.subtype];
  }
  if (location.category === "npc") return NPC_SUBTYPE_TYPES[location.subtype];
  if (location.category === "enemy") return ENEMY_SUBTYPE_TYPES[location.subtype];
  if (location.category === "location") {
    return LOCATION_SUBTYPE_TYPES[location.subtype];
  }
  return undefined;
}
