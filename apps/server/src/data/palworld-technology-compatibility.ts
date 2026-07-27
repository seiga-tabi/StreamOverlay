import type { PalworldCatalogItem } from "./palworld-catalog-artifact.js";

export const PALWORLD_TECHNOLOGY_COMPATIBILITY_EVIDENCE = Object.freeze({
  candidateId: "candidate-1248184a4b527d94",
  archiveSha256: "1248184a4b527d947b5411940726d5b41fa0e212b355b7e4cc917821e0496384",
  sourceMember: "Pal/DataTable/Technology/DT_TechnologyRecipeUnlock_Common.json",
  sourceSha256: "b9f98dd1966e0be1786b29ac2361930fbfb61cecca399f0248cd1246277b8975",
});

export type PalworldTechnologyCompatibilityEntry = {
  id: string;
  sourceInternalId: string;
  sourceRowId: string;
  unlockLevel: number;
};

export const PALWORLD_TECHNOLOGY_COMPATIBILITY_ENTRIES =
  Object.freeze<readonly PalworldTechnologyCompatibilityEntry[]>([
    {
      id: "grappling-gun",
      sourceInternalId: "GrapplingGun",
      sourceRowId: "GrapplingGun",
      unlockLevel: 12,
    },
    {
      id: "grappling-gun2",
      sourceInternalId: "GrapplingGun2",
      sourceRowId: "GrapplingGun2",
      unlockLevel: 17,
    },
    {
      id: "grappling-gun3",
      sourceInternalId: "GrapplingGun3",
      sourceRowId: "GrapplingGun3",
      unlockLevel: 31,
    },
    {
      id: "grappling-gun4",
      sourceInternalId: "GrapplingGun4",
      sourceRowId: "GrapplingGun4",
      unlockLevel: 49,
    },
    {
      id: "flame-thrower",
      sourceInternalId: "FlameThrower",
      sourceRowId: "Battle_RangeWeapon_FlameThrower",
      unlockLevel: 52,
    },
    {
      id: "glider-tera",
      sourceInternalId: "Glider_Tera",
      sourceRowId: "Battle_Glider_Grade_04",
      unlockLevel: 52,
    },
    {
      id: "shield-ultra",
      sourceInternalId: "Shield_Ultra",
      sourceRowId: "Shield_05",
      unlockLevel: 55,
    },
    {
      id: "grappling-gun5",
      sourceInternalId: "GrapplingGun5",
      sourceRowId: "GrapplingGun5",
      unlockLevel: 63,
    },
  ]);

const compatibilityByItemId = new Map(
  PALWORLD_TECHNOLOGY_COMPATIBILITY_ENTRIES.map((entry) => [entry.id, entry]),
);

const PALWORLD_TECHNOLOGY_PAL_SOURCE_ALIASES = new Map([
  ["Thunderdog_Ice", "ThunderDog_Ice"],
]);

export function resolvePalworldTechnologyPalSourceInternalId(
  item: Pick<PalworldCatalogItem, "sourceCategory" | "sourceInternalId">,
): string | undefined {
  if (
    item.sourceCategory !== "Essential/Essential_PalGear"
    || !item.sourceInternalId.startsWith("SkillUnlock_")
  ) {
    return undefined;
  }

  const sourceInternalId = item.sourceInternalId.slice("SkillUnlock_".length);
  return PALWORLD_TECHNOLOGY_PAL_SOURCE_ALIASES.get(sourceInternalId)
    ?? sourceInternalId;
}

/**
 * 현재 게시 카탈로그에서 빠진 기술 행만 검증된 원본 행과 정확히 결합합니다.
 * 후보 artifact 전체를 활성화하지 않으며 ID가 변조되면 조용히 보완하지 않습니다.
 */
export function resolvePalworldTechnologyLevel(
  item: Pick<PalworldCatalogItem, "id" | "sourceInternalId" | "technologyLevel">,
): number | undefined {
  if (item.technologyLevel !== undefined) return item.technologyLevel;

  const compatibility = compatibilityByItemId.get(item.id);
  if (compatibility === undefined) return undefined;
  if (compatibility.sourceInternalId !== item.sourceInternalId) {
    throw new TypeError(
      `Palworld 기술 해금 호환성 internal ID가 일치하지 않습니다: ${item.id}`,
    );
  }
  return compatibility.unlockLevel;
}
