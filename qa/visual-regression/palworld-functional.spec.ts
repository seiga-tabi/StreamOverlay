import { expect, test, type Page, type Route } from "@playwright/test";
import { resolve } from "node:path";
import {
  PALWORLD_ELEMENTS,
  PALWORLD_MAP_LOCATION_CATEGORIES,
  PALWORLD_PASSIVE_EFFECT_FILTERS,
  PALWORLD_PASSIVE_TIERS,
  PALWORLD_PUBLIC_NOTICE_JA,
  PALWORLD_PUBLIC_NOTICE_KO,
  PALWORLD_SKILL_TYPES,
  PALWORLD_VARIANT_TYPES,
  PALWORLD_WORK_SUITABILITY_TYPES,
} from "@streamops/shared";
import type {
  PalworldBreedingPair,
  PalworldDataMetadata,
  PalworldItemDetail,
  PalworldItemSummary,
  PalworldMapMarkersResponse,
  PalworldMapLocationsResponse,
  PalworldPaginatedResponse,
  PalworldPalDetail,
  PalworldPalListFacets,
  PalworldPalListResponse,
  PalworldPalReference,
  PalworldPalSpawnResponse,
  PalworldPalSummary,
  PalworldSkillDetail,
  PalworldSkillListFacets,
  PalworldSkillSummary,
  PalworldTechnologyUnlockSummary,
} from "@streamops/shared";

const metadata: PalworldDataMetadata = {
  gameVersion: "1.0.1",
  sourceName: "Palworld fixed release artifact",
  sourceUrl: "https://github.com/seiga-tabi/StreamOverlay/blob/main/apps/server/data/palworld/1.0.1/sources.lock.json",
  sourceRevision: "fixed-source-revision",
  extractedAt: "2026-07-21T00:00:00.000Z",
  verifiedAt: "2026-07-21T00:00:00.000Z",
  license: "Test-only Pal text fixture",
};

const READY_PAL_IMAGE_URL = `/images/palworld/1.0.1/pals/${"a".repeat(64)}.webp`;
const READY_ITEM_IMAGE_URL = `/images/palworld/1.0.1/items/${"b".repeat(64)}.webp`;
const READY_WORLD_MAP_URL = "/images/palworld/1.0.1/maps/dfb08d86604f7e563aaf4c4de4a426af169982ee67792867d8945ab105f66e8a.webp";
const READY_TREE_MAP_URL = "/images/palworld/1.0.1/maps/c49b2a18bf1512019f0e18c592c20d74cd491b10394ab8121581cc294f74a2cf.webp";
const LOCAL_WEBP_FIXTURE = resolve("apps/dashboard/public/images/yorogg-logo.webp");
const MAIN_MAP_COORDINATE_TRANSFORM = {
  status: "verified" as const,
  revision: "main-map-transform-v1",
  horizontalAxis: "world_y" as const,
  verticalAxis: "world_x" as const,
  invertHorizontal: false,
  invertVertical: true,
  sourceBounds: {
    minX: -1_099_400,
    maxX: 349_400,
    minY: -724_400,
    maxY: 724_400,
  },
};

const mapMarkers: PalworldMapMarkersResponse = {
  state: "ready",
  world: "main",
  coordinateTransform: MAIN_MAP_COORDINATE_TRANSFORM,
  markers: [{
    id: "anubis-field-boss",
    sourceRowId: "Anubis_FieldBoss",
    sourceInternalId: "Anubis",
    pal: {
      id: "anubis",
      number: 100,
      nameKo: "아누비스",
      nameJa: "アヌビス",
      nameEn: "Anubis",
      imageUrl: READY_PAL_IMAGE_URL,
      imageWidth: 128,
      imageHeight: 128,
      elements: ["ground"],
    },
    level: 55,
    normalizedX: 0.566558531,
    normalizedY: 0.356591662,
  }],
  metadata,
  overlay: {
    schemaVersion: 1,
    technicalStatus: "ready",
    sourceType: "operator_pak_export",
    archiveSha256: "1".repeat(64),
    sourceMember: "Pal/DataTable/UI/DT_BossSpawnerLoactionData.json",
    sourceMemberSha256: "2".repeat(64),
    targetMapAssetSha256: "3b9c9c70f0fe0e025d67971d16bc6cb42a8ce3b63ad42f30681dcbf6ac379003",
    sourceGameVersion: null,
    sourceSteamBuildId: null,
    targetGameVersion: "1.0.1",
    compatibilityBasis: "exact_map_geometry_and_coordinate_transform",
    transformRevision: "main-map-v1",
    rightsVerified: false,
    usageBasis: "operator_reference_use",
  },
};

const treeMapMarkers: PalworldMapMarkersResponse = {
  state: "ready",
  world: "tree",
  markers: [{
    id: "tree-015-dualith",
    sourceRowId: "15",
    sourceInternalId: "GrassGolem",
    pal: {
      id: "dualith",
      number: 138,
      nameKo: "스태초",
      nameJa: "ウゴクゾー",
      nameEn: "Dualith",
      imageUrl: READY_PAL_IMAGE_URL,
      imageWidth: 128,
      imageHeight: 128,
      elements: ["ground", "grass"],
    },
    level: 75,
    normalizedX: 0.559563133,
    normalizedY: 0.502340571,
  }],
  metadata,
  overlay: {
    schemaVersion: 1,
    technicalStatus: "ready",
    sourceType: "operator_pak_export",
    archiveSha256: "1".repeat(64),
    sourceMember: "Pal/DataTable/UI/DT_BossSpawnerLoactionData.json",
    sourceMemberSha256: "2".repeat(64),
    targetMapAssetSha256: "c49b2a18bf1512019f0e18c592c20d74cd491b10394ab8121581cc294f74a2cf",
    sourceGameVersion: null,
    sourceSteamBuildId: null,
    targetGameVersion: "1.0.1",
    compatibilityBasis: "exact_map_geometry_and_coordinate_transform",
    transformRevision: "tree-map-fmodel-bounds-v1",
    rightsVerified: false,
    usageBasis: "operator_reference_use",
  },
};

function mapLocationsResponse(url: URL): PalworldMapLocationsResponse {
  const world = url.searchParams.get("world") === "tree" ? "tree" : "main";
  const requestedLayers = new Set(
    (url.searchParams.get("layers") ?? "").split(",").filter(Boolean),
  );
  const layers = PALWORLD_MAP_LOCATION_CATEGORIES.filter((category) =>
    requestedLayers.has(category)
  );
  const allLocations = [{
    id: `${world}-egg-grass-001`,
    category: "egg" as const,
    subtype: "grass-01",
    normalizedX: 0.35,
    normalizedY: 0.45,
  }, {
    id: `${world}-resource-ancient-beast-bone-001`,
    category: "resource" as const,
    subtype: "ancient-beast-bone",
    normalizedX: 0.62,
    normalizedY: 0.58,
  }, {
    id: `${world}-resource-ancient-tree-bark-001`,
    category: "resource" as const,
    subtype: "ancient-tree-bark",
    normalizedX: 0.68,
    normalizedY: 0.52,
  }, {
    id: `${world}-resource-copper-ore-001`,
    category: "resource" as const,
    subtype: "copper-ore",
    normalizedX: 0.55,
    normalizedY: 0.65,
  }].filter((location) => layers.includes(location.category));
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number(url.searchParams.get("limit") ?? "5000");
  const locations = allLocations.slice(offset, offset + limit);
  return {
    state: locations.length > 0 ? "ready" : "confirmed_empty",
    world,
    layers,
    offset,
    limit,
    total: allLocations.length,
    returned: locations.length,
    hasMore: offset + locations.length < allLocations.length,
    locations,
    metadata,
    overlay: {
      schemaVersion: 1,
      technicalStatus: "ready",
      sourceType: "operator_pak_export",
      archiveSha256: "1".repeat(64),
      sourceMember: "Maps/index.json",
      sourceMemberSha256: "5".repeat(64),
      targetMapAssetSha256: world === "tree"
        ? "c49b2a18bf1512019f0e18c592c20d74cd491b10394ab8121581cc294f74a2cf"
        : "3b9c9c70f0fe0e025d67971d16bc6cb42a8ce3b63ad42f30681dcbf6ac379003",
      sourceGameVersion: null,
      sourceSteamBuildId: null,
      targetGameVersion: "1.0.1",
      compatibilityBasis: "exact_world_actor_join_and_map_geometry",
      transformRevision: world === "tree"
        ? "tree-map-fmodel-bounds-v1"
        : "main-map-fmodel-bounds-v1",
      rightsVerified: false,
      usageBasis: "operator_reference_use",
      activationBasis: "versioned_compatibility_approval",
      compatibilityApprovalSha256: "6".repeat(64),
    },
  };
}

function palSpawnResponse(palId: string): PalworldPalSpawnResponse {
  const overlay = {
    schemaVersion: 1 as const,
    technicalStatus: "ready" as const,
    sourceType: "operator_pak_export" as const,
    archiveSha256: "1".repeat(64),
    sourceMember: "Pal/DataTable/Spawner/DT_PalSpawnerPlacement.json",
    sourceMemberSha256: "4".repeat(64),
    targetMapAssetSha256: "3b9c9c70f0fe0e025d67971d16bc6cb42a8ce3b63ad42f30681dcbf6ac379003",
    sourceGameVersion: "1.0.1",
    sourceSteamBuildId: "24181105",
    targetGameVersion: "1.0.1",
    compatibilityBasis: "exact_active_paldex_join_and_map_geometry" as const,
    transformRevision: "main-map-fmodel-spawns-v1",
    rightsVerified: false as const,
    usageBasis: "operator_reference_use" as const,
  };
  if (palId !== "anubis") {
    return {
      state: "confirmed_empty",
      world: "main",
      palId,
      gridSize: 32,
      totalPlacements: 0,
      points: [],
      metadata,
      overlay,
    };
  }
  return {
    state: "ready",
    world: "main",
    palId,
    gridSize: 32,
    totalPlacements: 35,
    points: [{
      id: "main-anubis-06-16",
      cellX: 6,
      cellY: 16,
      normalizedX: 0.201051551,
      normalizedY: 0.517600865,
      placementCount: 35,
      minimumLevel: 68,
      maximumLevel: 72,
      daytime: true,
      nighttime: true,
    }],
    metadata,
    overlay,
  };
}

const pals: PalworldPalDetail[] = [
  {
    id: "penking",
    number: 11,
    nameKo: "펭킹",
    nameJa: "キャプペン",
    nameEn: "Penking",
    imageUrl: READY_PAL_IMAGE_URL,
    imageWidth: 128,
    imageHeight: 128,
    elements: ["water", "ice"],
    rarity: 6,
    variantType: "normal",
    workSuitabilities: [
      { type: "watering", level: 2 },
      { type: "mining", level: 2 },
    ],
    stats: { hp: 95, attack: 95, defense: 95, moveSpeed: 450, stamina: 100 },
    nocturnal: false,
    partnerSkill: {
      id: "penking-partner-skill",
      type: "partner",
      nameKo: "펭킹 파트너 스킬",
      nameJa: "キャプペンのパートナースキル",
      nameEn: "Penking Partner Skill",
      descriptionKo: "펭킹의 고유 능력입니다.",
      descriptionJa: "キャプペンの固有能力です。",
    },
    activeSkills: [],
    drops: [],
    breeding: { breedingPower: 520, specialParentPairs: [] },
    metadata,
  },
  {
    id: "bushi",
    number: 72,
    nameKo: "불무사",
    nameJa: "ツジギリ",
    nameEn: "Bushi",
    elements: ["fire"],
    rarity: 7,
    variantType: "normal",
    workSuitabilities: [
      { type: "kindling", level: 2 },
      { type: "lumbering", level: 3 },
    ],
    stats: { hp: 80, attack: 125, defense: 80, moveSpeed: 600, stamina: 100 },
    nocturnal: false,
    partnerSkill: {
      id: "bushi-partner-skill",
      type: "partner",
      nameKo: "불무사 파트너 스킬",
      nameJa: "ツジギリのパートナースキル",
      nameEn: "Bushi Partner Skill",
      descriptionKo: "불무사의 고유 능력입니다.",
      descriptionJa: "ツジギリの固有能力です。",
    },
    activeSkills: [],
    drops: [],
    breeding: { breedingPower: 640, specialParentPairs: [] },
    metadata,
  },
  {
    id: "anubis",
    number: 100,
    nameKo: "아누비스",
    nameJa: "アヌビス",
    nameEn: "Anubis",
    elements: ["ground"],
    rarity: 10,
    variantType: "special",
    workSuitabilities: [
      { type: "handiwork", level: 4 },
      { type: "mining", level: 3 },
      { type: "transporting", level: 2 },
      { type: "farming", level: 1 },
    ],
    stats: { hp: 120, attack: 130, defense: 100, moveSpeed: 800, stamina: 100 },
    nocturnal: true,
    partnerSkill: {
      id: "anubis-partner-skill",
      type: "partner",
      nameKo: "아누비스 파트너 스킬",
      nameJa: "アヌビスのパートナースキル",
      nameEn: "Anubis Partner Skill",
      descriptionKo: "아누비스의 고유 능력입니다.",
      descriptionJa: "アヌビスの固有能力です。",
    },
    activeSkills: [
      {
        id: "stone-blast",
        type: "active",
        nameKo: "스톤 샷",
        nameJa: "ストーンショット",
        nameEn: "Stone Blast",
        descriptionKo: "바위 탄환으로 피해를 줍니다.",
        descriptionJa: "岩の弾でダメージを与えます。",
        element: "ground",
        power: 30,
        cooldownSeconds: 2,
      },
    ],
    drops: [
      {
        id: "ancient-technology-parts",
        nameKo: "고대 문명의 부품",
        nameJa: "古代文明の部品",
        nameEn: "Ancient Civilization Parts",
      },
    ],
    breeding: {
      breedingPower: 570,
      specialParentPairs: [],
    },
    metadata,
  },
  {
    id: "sibelyx",
    number: 116,
    nameKo: "실키누",
    nameJa: "シルキーヌ",
    nameEn: "Sibelyx",
    elements: ["ice"],
    rarity: 7,
    variantType: "normal",
    workSuitabilities: [
      { type: "medicine_production", level: 3 },
      { type: "cooling", level: 3 },
      { type: "farming", level: 3 },
    ],
    stats: { hp: 110, attack: 90, defense: 100, moveSpeed: 400, stamina: 100 },
    nocturnal: false,
    activeSkills: [],
    drops: [],
    breeding: { breedingPower: 1810, specialParentPairs: [] },
    metadata,
  },
  {
    id: "katress",
    number: 79,
    nameKo: "캐티메이지",
    nameJa: "クレメーオ",
    nameEn: "Katress",
    elements: ["dark"],
    rarity: 6,
    variantType: "normal",
    workSuitabilities: [],
    stats: { hp: 90, attack: 105, defense: 90, moveSpeed: 440, stamina: 100 },
    nocturnal: true,
    activeSkills: [],
    drops: [],
    breeding: { breedingPower: 2040, specialParentPairs: [] },
    metadata,
  },
  {
    id: "wixen",
    number: 78,
    nameKo: "마호",
    nameJa: "フォレーナ",
    nameEn: "Wixen",
    elements: ["fire"],
    rarity: 6,
    variantType: "normal",
    workSuitabilities: [],
    stats: { hp: 90, attack: 110, defense: 80, moveSpeed: 440, stamina: 100 },
    nocturnal: false,
    activeSkills: [],
    drops: [],
    breeding: { breedingPower: 2080, specialParentPairs: [] },
    metadata,
  },
  {
    id: "katress-ignis",
    number: 79,
    nameKo: "캐티위자드",
    nameJa: "クレメーナ",
    nameEn: "Katress Ignis",
    elements: ["dark", "fire"],
    rarity: 6,
    variantType: "variant",
    workSuitabilities: [],
    stats: { hp: 95, attack: 105, defense: 90, moveSpeed: 440, stamina: 100 },
    nocturnal: true,
    activeSkills: [],
    drops: [],
    breeding: {
      breedingPower: 1800,
      specialParentPairs: [{
        parentAId: "katress",
        parentBId: "wixen",
        parentAGender: "female",
        parentBGender: "male",
        parentA: {
          id: "katress",
          number: 79,
          nameKo: "캐티메이지",
          nameJa: "クレメーオ",
          nameEn: "Katress",
          elements: ["dark"],
        },
        parentB: {
          id: "wixen",
          number: 78,
          nameKo: "마호",
          nameJa: "フォレーナ",
          nameEn: "Wixen",
          elements: ["fire"],
        },
      }],
    },
    metadata,
  },
];

const items: PalworldItemDetail[] = [
  {
    id: "pal-sphere",
    nameKo: "Pal 스피어",
    nameJa: "パルスフィア",
    nameEn: "Pal Sphere",
    imageUrl: READY_ITEM_IMAGE_URL,
    imageWidth: 256,
    imageHeight: 256,
    category: "sphere",
    rarity: 1,
    descriptionKo: "낮은 등급의 Pal 포획에 사용하는 기본 스피어입니다.",
    descriptionJa: "低ランクのパル捕獲に使う基本スフィアです。",
    descriptionEn: "A basic sphere used to capture lower-tier Pals.",
    sellPrice: 10,
    technologyLevel: 2,
    craftingMaterials: [
      {
        item: {
          id: "paldium-fragment",
          nameKo: "팰지움 파편",
          nameJa: "パルジウムの欠片",
          nameEn: "Paldium Fragment",
        },
        quantity: 1,
      },
    ],
    craftingFacility: {
      id: "primitive-workbench",
      nameKo: "원시적인 작업대",
      nameJa: "原始的な作業台",
      nameEn: "Primitive Workbench",
    },
    dropPals: [],
    acquisitionMethods: [
      {
        type: "craft",
        labelKo: "작업대에서 제작",
        labelJa: "作業台で製作",
        labelEn: "Crafted at a workbench",
      },
    ],
    relatedItems: [],
    metadata,
  },
  {
    id: "ancient-technology-parts",
    nameKo: "고대 문명의 부품",
    nameJa: "古代文明の部品",
    nameEn: "Ancient Civilization Parts",
    category: "key_item",
    rarity: 4,
    descriptionKo: "고대 기술 장비 제작에 사용하는 희귀 부품입니다.",
    descriptionJa: "古代技術装備の製作に使う希少な部品です。",
    descriptionEn: "Rare parts used to craft ancient technology gear.",
    craftingMaterials: [],
    dropPals: [palReference("anubis")],
    acquisitionMethods: [
      {
        type: "drop",
        labelKo: "강력한 Pal 보상에서 획득",
        labelJa: "強力なパルの報酬から入手",
        labelEn: "Obtained from powerful Pals",
      },
    ],
    relatedItems: [],
    metadata,
  },
];

const breedingPair: PalworldBreedingPair = {
  id: "fixture-penking-bushi-sibelyx",
  parentA: palReference("penking"),
  parentB: palReference("bushi"),
  child: palReference("sibelyx"),
  isSpecial: false,
};

function genderBreedingPair(
  parentAId: string,
  parentBId: string,
  katressGender: "female" | "male",
): PalworldBreedingPair {
  const parentAIsKatress = parentAId === "katress";
  const wixenGender = katressGender === "female" ? "male" : "female";
  return {
    id: `fixture-${parentAId}-${parentBId}-katress-ignis-${katressGender}`,
    parentA: palReference(parentAId),
    parentB: palReference(parentBId),
    child: palReference("katress-ignis"),
    isSpecial: true,
    genderCondition: {
      parentA: parentAIsKatress ? katressGender : wixenGender,
      parentB: parentAIsKatress ? wixenGender : katressGender,
    },
  };
}

const apiRequestUrls = new WeakMap<Page, string[]>();

function palReference(id: string): PalworldPalReference {
  const pal = pals.find((candidate) => candidate.id === id);
  if (!pal) throw new TypeError(`테스트 Pal fixture를 찾을 수 없습니다: ${id}`);
  return {
    id: pal.id,
    number: pal.number,
    nameKo: pal.nameKo,
    nameJa: pal.nameJa,
    nameEn: pal.nameEn,
    ...(pal.imageUrl ? { imageUrl: pal.imageUrl } : {}),
    ...(pal.imageWidth === undefined ? {} : { imageWidth: pal.imageWidth }),
    ...(pal.imageHeight === undefined ? {} : { imageHeight: pal.imageHeight }),
    elements: [...pal.elements],
  };
}

function palSummary(pal: PalworldPalDetail): PalworldPalSummary {
  return {
    id: pal.id,
    number: pal.number,
    nameKo: pal.nameKo,
    nameJa: pal.nameJa,
    nameEn: pal.nameEn,
    ...(pal.imageUrl ? { imageUrl: pal.imageUrl } : {}),
    ...(pal.imageWidth === undefined ? {} : { imageWidth: pal.imageWidth }),
    ...(pal.imageHeight === undefined ? {} : { imageHeight: pal.imageHeight }),
    elements: [...pal.elements],
    rarity: pal.rarity,
    variantType: pal.variantType,
    workSuitabilities: pal.workSuitabilities.map((work) => ({ ...work })),
  };
}

function itemSummary(item: PalworldItemDetail): PalworldItemSummary {
  return {
    id: item.id,
    nameKo: item.nameKo,
    nameJa: item.nameJa,
    nameEn: item.nameEn,
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
    ...(item.imageWidth === undefined ? {} : { imageWidth: item.imageWidth }),
    ...(item.imageHeight === undefined ? {} : { imageHeight: item.imageHeight }),
    category: item.category,
    rarity: item.rarity,
    descriptionKo: item.descriptionKo,
    descriptionJa: item.descriptionJa,
    ...(item.descriptionEn ? { descriptionEn: item.descriptionEn } : {}),
    ...(item.sellPrice === undefined ? {} : { sellPrice: item.sellPrice }),
    ...(item.technologyLevel === undefined ? {} : { technologyLevel: item.technologyLevel }),
    ...(item.technologyPal === undefined ? {} : { technologyPal: item.technologyPal }),
  };
}

const skills: PalworldSkillDetail[] = [
  {
    id: "active-ground-stone-blast-30-2",
    type: "active",
    nameKo: "스톤 샷",
    nameJa: "ストーンショット",
    nameEn: "Stone Blast",
    descriptionKo: "고속 바위 탄환을 적에게 발사합니다.",
    descriptionJa: "高速の岩弾を敵に発射します。",
    descriptionEn: "Fires a high-speed stone projectile at an enemy.",
    element: "ground",
    power: 30,
    cooldownSeconds: 2,
    unlockLevel: 1,
    relatedPalCount: 1,
    relatedPals: [{ pal: palReference("anubis"), unlockLevel: 1 }],
    localization: {
      sourceLanguage: "en",
      ko: "localized",
      ja: "localized",
    },
    translation: {
      name: { ko: "machine_assisted", ja: "machine_assisted" },
      description: { ko: "machine_assisted", ja: "machine_assisted" },
    },
    metadata,
  },
  {
    id: "partner-anubis-guardian-of-the-desert",
    type: "partner",
    nameKo: "사막의 수호신",
    nameJa: "砂漠の守護神",
    nameEn: "Guardian of the Desert",
    descriptionKo: "함께 싸우는 동안 플레이어의 공격에 땅 속성을 부여합니다.",
    descriptionJa: "共闘中、プレイヤーの攻撃に地属性を付与します。",
    descriptionEn: "Applies Ground damage to the player's attacks while fighting together.",
    element: "ground",
    relatedPalCount: 1,
    relatedPals: [{ pal: palReference("anubis") }],
    metadata,
  },
  {
    id: "passive-workaholic-tier-2",
    type: "passive",
    nameEn: "Workaholic",
    descriptionEn: "Sanity drops more slowly while working.",
    passiveTier: 2,
    passiveAbility: "SAN decrease -15%",
    relatedPalCount: 1,
    relatedPals: [{ pal: palReference("penking") }],
    localization: {
      sourceLanguage: "en",
      ko: "source_language_fallback",
      ja: "source_language_fallback",
    },
    metadata,
  },
];

function skillSummary(skill: PalworldSkillDetail): PalworldSkillSummary {
  const { relatedPals, metadata: _metadata, ...summary } = skill;
  return {
    ...summary,
    relatedPalPreviews: relatedPals.slice(0, 3).map(({ pal }) => ({ ...pal })),
  };
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

function aliases(id: string): string[] {
  return [id, id.replaceAll("-", "_"), id.replaceAll("_", "-")];
}

function matches(query: string, values: Array<string | number>): boolean {
  const term = normalize(query);
  return values.some((value) => normalize(String(value)).includes(term));
}

function pageResponse<T>(allItems: T[], url: URL, responseMetadata = metadata): PalworldPaginatedResponse<T> {
  const requestedPage = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("limit") ?? "24");
  const totalPages = Math.ceil(allItems.length / pageSize);
  const page = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages);
  return {
    items: allItems.slice((page - 1) * pageSize, page * pageSize),
    pagination: {
      page,
      pageSize,
      total: allItems.length,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    metadata: responseMetadata,
  };
}

function filteredPals(url: URL): PalworldPalSummary[] {
  const query = url.searchParams.get("q");
  const element = url.searchParams.get("element");
  const work = url.searchParams.get("work");
  const rarity = url.searchParams.get("rarity");
  const variant = url.searchParams.get("variant");
  const sort = url.searchParams.get("sort") ?? "number";
  const locale = url.searchParams.get("locale") === "ja" ? "ja" : "ko";
  const order = url.searchParams.get("order") === "desc" ? -1 : 1;
  return pals
    .filter((pal) => !query || matches(query, [...aliases(pal.id), pal.number, `#${pal.number}`, pal.nameKo, pal.nameJa, pal.nameEn]))
    .filter((pal) => !element || pal.elements.includes(element as never))
    .filter((pal) => !work || pal.workSuitabilities.some((entry) => entry.type === work))
    .filter((pal) => !rarity || pal.rarity === Number(rarity))
    .filter((pal) => !variant || pal.variantType === variant)
    .sort((left, right) => {
      const result = sort === "rarity"
        ? left.rarity - right.rarity || left.number - right.number
        : sort === "name"
          ? (locale === "ja" ? left.nameJa : left.nameKo).localeCompare(locale === "ja" ? right.nameJa : right.nameKo)
          : left.number - right.number;
      return order * result;
    })
    .map(palSummary);
}

function palListFacets(): PalworldPalListFacets {
  const count = <T extends string | number>(values: T[], value: T) =>
    values.filter((candidate) => candidate === value).length;
  const elements = pals.flatMap((pal) => pal.elements);
  const workSuitabilities = pals.flatMap((pal) => pal.workSuitabilities.map((work) => work.type));
  const rarities = pals.map((pal) => pal.rarity);
  const variants = pals.map((pal) => pal.variantType);
  return {
    elements: PALWORLD_ELEMENTS
      .map((value) => ({ value, count: count(elements, value) }))
      .filter((facet) => facet.count > 0),
    workSuitabilities: PALWORLD_WORK_SUITABILITY_TYPES
      .map((value) => ({ value, count: count(workSuitabilities, value) }))
      .filter((facet) => facet.count > 0),
    rarities: [...new Set(rarities)]
      .sort((left, right) => left - right)
      .map((value) => ({ value, count: count(rarities, value) })),
    variants: PALWORLD_VARIANT_TYPES
      .map((value) => ({ value, count: count(variants, value) }))
      .filter((facet) => facet.count > 0),
  };
}

function palListResponse(url: URL): PalworldPalListResponse {
  return {
    ...pageResponse(filteredPals(url), url),
    facets: palListFacets(),
  };
}

function filteredItems(url: URL): PalworldItemSummary[] {
  const query = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  const rarity = url.searchParams.get("rarity");
  const acquisition = url.searchParams.get("acquisition");
  const technology = url.searchParams.get("technology");
  const sort = url.searchParams.get("sort") ?? "name";
  return items
    .filter((item) => !query || matches(query, [...aliases(item.id), item.nameKo, item.nameJa, item.nameEn]))
    .filter((item) => !category || item.category === category)
    .filter((item) => !rarity || item.rarity === Number(rarity))
    .filter((item) => !acquisition || item.acquisitionMethods.some((method) => method.type === acquisition))
    .filter((item) => technology !== "unlockable" || item.technologyLevel !== undefined)
    .sort((left, right) => {
      if (sort === "rarity") return left.rarity - right.rarity;
      if (sort === "price") return (left.sellPrice ?? Number.MAX_SAFE_INTEGER) - (right.sellPrice ?? Number.MAX_SAFE_INTEGER);
      if (sort === "technologyLevel") return (left.technologyLevel ?? Number.MAX_SAFE_INTEGER) - (right.technologyLevel ?? Number.MAX_SAFE_INTEGER);
      return left.nameKo.localeCompare(right.nameKo);
    })
    .map(itemSummary);
}

test("기술 해금 페이지는 레벨 타임라인과 상세 연결을 PC·모바일에서 유지한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  const technologyItems = Array.from({ length: 12 }, (_, index): PalworldTechnologyUnlockSummary => {
    const item: PalworldItemSummary = {
      ...itemSummary(items[0]!),
      id: index === 0 ? "pal-sphere" : `technology-item-${index + 1}`,
      nameKo: index === 0 ? "Pal 스피어" : `기술 아이템 ${index + 1}`,
      nameJa: index === 0 ? "パルスフィア" : `テクノロジーアイテム ${index + 1}`,
      nameEn: index === 0 ? "Pal Sphere" : `Technology Item ${index + 1}`,
      rarity: index % 5,
      technologyLevel: index < 8 ? 2 : 3,
      ...(index === 0 ? {
        technologyPal: {
          id: pals[0]!.id,
          number: pals[0]!.number,
          nameKo: pals[0]!.nameKo,
          nameJa: pals[0]!.nameJa,
          nameEn: pals[0]!.nameEn,
          imageUrl: pals[0]!.imageUrl,
          imageWidth: pals[0]!.imageWidth,
          imageHeight: pals[0]!.imageHeight,
          elements: [...pals[0]!.elements],
        },
      } : {}),
    };
    return {
      id: `technology-item-${item.id}`,
      kind: "item",
      technologyLevel: item.technologyLevel!,
      item,
    };
  });
  const technologyRequests: URL[] = [];
  await page.route("**/api/palworld/technology?*", async (route) => {
    const url = new URL(route.request().url());
    technologyRequests.push(url);
    await json(route, pageResponse(technologyItems, url));
  });

  for (const viewport of [
    { width: 1440, height: 1000, columns: 6 },
    { width: 390, height: 844, columns: 2 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/palworld/technology");
    await expect(page.getByTestId("technology-unlock-card")).toHaveCount(12);
    await expect(page.getByText("기술 해금 항목 12개")).toBeVisible();
    await expect(page.locator(".palworld-technology-level-group")).toHaveCount(2);
    await expect(page.locator(".palworld-technology-level-marker").first()).toHaveText("2");
    await expect(page.getByTestId("technology-unlock-card").first().locator("img")).toHaveAttribute(
      "src",
      /\/images\/palworld\/1\.0\.1\/pals\/[a-f0-9]{64}\.webp$/u,
    );
    await expect.poll(() => page.locator(".palworld-technology-level-grid").first().evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length
    )).toBe(viewport.columns);
    await expect.poll(() => page.getByTestId("technology-unlock-card").first().evaluate((element) => {
      const { width, height } = element.getBoundingClientRect();
      return Math.abs(width - height) <= 1;
    })).toBe(true);
    const rarityStyles = await page.getByTestId("technology-unlock-card").evaluateAll((cards) =>
      cards.slice(0, 2).map((card) => {
        const style = getComputedStyle(card);
        return {
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          borderWidth: style.borderTopWidth,
        };
      })
    );
    expect(rarityStyles[0]?.backgroundColor).not.toBe(rarityStyles[1]?.backgroundColor);
    expect(rarityStyles[0]?.borderColor).not.toBe(rarityStyles[1]?.borderColor);
    expect(rarityStyles.every((style) => style.borderWidth === "3px")).toBe(true);
    const mediaStyle = await page.getByTestId("technology-unlock-card").first()
      .locator(".palworld-technology-card-media")
      .evaluate((media) => {
        const style = getComputedStyle(media);
        return {
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          borderBottomWidth: style.borderBottomWidth,
        };
      });
    expect(mediaStyle).toEqual({
      backgroundColor: "rgba(0, 0, 0, 0)",
      backgroundImage: "none",
      borderBottomWidth: "0px",
    });
    const mediaSizing = await page.getByTestId("technology-unlock-card").evaluateAll((cards) =>
      cards.slice(0, 2).map((card) => {
        const media = card.querySelector(".palworld-technology-card-media");
        const image = media?.querySelector("img");
        return {
          imageHeight: image?.getBoundingClientRect().height ?? 0,
          mediaHeight: media?.getBoundingClientRect().height ?? 0,
        };
      })
    );
    expect(mediaSizing.every(({ imageHeight, mediaHeight }) =>
      mediaHeight > 0 && imageHeight > 0 && imageHeight <= mediaHeight + 1
    )).toBe(true);
    await expect.poll(() => page.locator(".palworld-technology-level-marker").first().evaluate((element) =>
      getComputedStyle(element).position
    )).toBe("sticky");
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )).toBe(true);
  }

  expect(technologyRequests.every((url) =>
    url.searchParams.get("order") === "asc"
    && url.searchParams.get("locale") === "ko"
    && url.searchParams.get("limit") === "24"
  )).toBe(true);
  await page.getByRole("button", { name: "Pal 스피어 기술 해금 아이템 상세 보기" }).click();
  await expect(page.getByTestId("item-detail-modal")).toContainText(/기술 해금 레벨\s*2/u);
  await assertHealthyDocument(page, errors);
});

function filteredSkills(url: URL): PalworldSkillSummary[] {
  const query = url.searchParams.get("q");
  const type = url.searchParams.get("type");
  const element = url.searchParams.get("element");
  const partnerElement = url.searchParams.get("partnerElement");
  const passiveEffect = url.searchParams.get("passiveEffect");
  const passiveTier = url.searchParams.get("passiveTier");
  const sort = url.searchParams.get("sort") ?? "name";
  const order = url.searchParams.get("order") === "desc" ? -1 : 1;
  return skills
    .filter((skill) => !query || matches(query, [skill.id, skill.nameKo ?? "", skill.nameJa ?? "", skill.nameEn, skill.descriptionKo ?? "", skill.descriptionJa ?? "", skill.descriptionEn ?? ""]))
    .filter((skill) => !type || skill.type === type)
    .filter((skill) => !element || (skill.type === "active" && skill.element === element))
    .filter((skill) => !partnerElement || (skill.type === "partner" && skill.element === partnerElement))
    .filter((skill) => !passiveEffect || (
      skill.type === "passive"
      && passiveEffectForSkill(skill) === passiveEffect
    ))
    .filter((skill) => !passiveTier || (
      skill.type === "passive"
      && skill.passiveTier === Number(passiveTier)
    ))
    .sort((left, right) => {
      if (sort === "power") return order * ((left.power ?? Number.MAX_SAFE_INTEGER) - (right.power ?? Number.MAX_SAFE_INTEGER));
      if (sort === "unlockLevel") return order * ((left.unlockLevel ?? Number.MAX_SAFE_INTEGER) - (right.unlockLevel ?? Number.MAX_SAFE_INTEGER));
      return order * left.nameEn.localeCompare(right.nameEn);
    })
    .map(skillSummary);
}

function passiveEffectForSkill(skill: PalworldSkillSummary): (typeof PALWORLD_PASSIVE_EFFECT_FILTERS)[number] {
  return skill.passiveAbility?.toLocaleUpperCase().includes("SAN") ? "san" : "other";
}

function skillListFacets(source: readonly PalworldSkillSummary[] = skills.map(skillSummary)): PalworldSkillListFacets {
  const count = <T extends string | number>(values: readonly T[], value: T) =>
    values.filter((candidate) => candidate === value).length;
  const types = source.map((skill) => skill.type);
  const activeElements = source.flatMap((skill) =>
    skill.type === "active" && skill.element ? [skill.element] : []
  );
  const partnerElements = source.flatMap((skill) =>
    skill.type === "partner" && skill.element ? [skill.element] : []
  );
  const passiveSkills = source.filter((skill) => skill.type === "passive");
  const passiveEffects = passiveSkills.map(passiveEffectForSkill);
  const passiveTiers = passiveSkills.flatMap((skill) =>
    skill.passiveTier === undefined ? [] : [skill.passiveTier]
  );
  return {
    types: PALWORLD_SKILL_TYPES
      .map((value) => ({ value, count: count(types, value) }))
      .filter((facet) => facet.count > 0),
    activeElements: PALWORLD_ELEMENTS
      .map((value) => ({ value, count: count(activeElements, value) }))
      .filter((facet) => facet.count > 0),
    partnerElements: PALWORLD_ELEMENTS
      .map((value) => ({ value, count: count(partnerElements, value) }))
      .filter((facet) => facet.count > 0),
    passiveEffects: PALWORLD_PASSIVE_EFFECT_FILTERS
      .map((value) => ({ value, count: count(passiveEffects, value) }))
      .filter((facet) => facet.count > 0),
    passiveTiers: PALWORLD_PASSIVE_TIERS
      .map((value) => ({ value, count: count(passiveTiers, value) }))
      .filter((facet) => facet.count > 0),
  };
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=86400" },
    body: JSON.stringify(body),
  });
}

async function installApiFixtures(page: Page): Promise<void> {
  const requests: string[] = [];
  apiRequestUrls.set(page, requests);
  await page.route(`**${READY_PAL_IMAGE_URL}`, async (route) => {
    await route.fulfill({
      path: LOCAL_WEBP_FIXTURE,
      contentType: "image/webp",
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    });
  });
  await page.route(`**${READY_ITEM_IMAGE_URL}`, async (route) => {
    await route.fulfill({
      path: LOCAL_WEBP_FIXTURE,
      contentType: "image/webp",
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    });
  });
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const url = new URL(route.request().url());
    requests.push(`${url.pathname}${url.search}`);

    if (url.pathname === "/api/palworld/meta") {
      await json(route, {
        metadata,
        counts: { pals: 287, items: 1_847, breedingPairs: 41_329, skills: 566 },
        domains: {
          pals: { status: "ready", recordCount: 287, metadata },
          items: { status: "incomplete", recordCount: 1_847, metadata },
          breeding: { status: "ready", recordCount: 41_329, metadata },
          skills: { status: "incomplete", recordCount: 566, metadata },
        },
        coverage: {
          palDetails: { available: 270, missing: 17, total: 287 },
          itemDetails: { available: 1_847, missing: 0, total: 1_847 },
          skillDetails: { available: 564, missing: 2, total: 566 },
          palDescriptions: { available: 268, missing: 19, total: 287 },
          palStats: { available: 287, missing: 0, total: 287 },
          partnerSkills: { available: 270, missing: 17, total: 287 },
          activeSkills: { available: 267, missing: 20, total: 287 },
          palDrops: { available: 267, missing: 20, total: 287 },
          breedingFields: { available: 0, missing: 287, total: 287 },
          itemDescriptions: { available: 1_847, missing: 0, total: 1_847 },
          craftingRecipes: { available: 889, missing: 958, total: 1_847 },
          craftingFacilities: { available: 0, missing: 1_847, total: 1_847 },
          dropPals: { available: 96, missing: 1_751, total: 1_847 },
          technologyLevels: { available: 372, missing: 1_475, total: 1_847 },
          prices: { available: 1_705, missing: 142, total: 1_847 },
          durability: { available: 172, missing: 1_675, total: 1_847 },
          acquisitionMethods: { available: 965, missing: 882, total: 1_847 },
          skillDescriptions: { available: 564, missing: 2, total: 566 },
          relatedPals: { available: 487, missing: 79, total: 566 },
          palImages: { available: 1, missing: 286, total: 287 },
          itemImages: { available: 1, missing: 1_846, total: 1_847 },
          elementImages: { available: 9, missing: 0, total: 9 },
          localization: {
            ko: { available: 292, missing: 2_408, total: 2_700 },
            ja: { available: 292, missing: 2_408, total: 2_700 },
            en: { available: 2_700, missing: 0, total: 2_700 },
          },
        },
        gates: {
          dataIntegrity: { passed: true, status: "ready" },
          imageAssets: {
            status: "partial",
            policyStatus: "operator_acknowledged",
            technicalPassed: true,
            publicActivationAllowed: true,
            rightsVerified: false,
            usageBasis: "operator_reference_use",
            readyImages: 1,
            fallbackPals: 286,
            publicNoticeRequired: true,
          },
        },
      });
      return;
    }
    if (url.pathname === "/api/palworld/map/markers") {
      await json(route, url.searchParams.get("world") === "tree" ? treeMapMarkers : mapMarkers);
      return;
    }
    if (url.pathname === "/api/palworld/map/locations") {
      await json(route, mapLocationsResponse(url));
      return;
    }
    if (url.pathname === "/api/palworld/map/spawns") {
      await json(route, palSpawnResponse(url.searchParams.get("pal") ?? "missing-pal"));
      return;
    }
    if (url.pathname === "/api/palworld/search") {
      const query = url.searchParams.get("q") ?? "";
      const matchedPals = filteredPals(new URL(`/palworld?q=${encodeURIComponent(query)}`, url.origin));
      const matchedItems = filteredItems(new URL(`/palworld?q=${encodeURIComponent(query)}`, url.origin));
      await json(route, {
        query: query.trim().replace(/\s+/gu, " "),
        total: matchedPals.length + matchedItems.length,
        pals: matchedPals,
        items: matchedItems,
        metadata,
        domains: {
          pals: { status: "ready", recordCount: 287, metadata },
          items: { status: "incomplete", recordCount: 1_847, metadata },
        },
      });
      return;
    }
    if (url.pathname === "/api/palworld/pals") {
      await json(route, palListResponse(url));
      return;
    }
    if (url.pathname === "/api/palworld/items") {
      await json(route, pageResponse(filteredItems(url), url));
      return;
    }
    if (url.pathname === "/api/palworld/technology") {
      const unlocks: PalworldTechnologyUnlockSummary[] = filteredItems(url)
        .filter((item) => item.technologyLevel !== undefined)
        .map((item) => ({
          id: `technology-item-${item.id}`,
          kind: "item",
          technologyLevel: item.technologyLevel!,
          item,
        }));
      await json(route, pageResponse(unlocks, url));
      return;
    }
    if (url.pathname === "/api/palworld/skills") {
      await json(route, {
        ...pageResponse(filteredSkills(url), url),
        facets: skillListFacets(),
      });
      return;
    }
    if (url.pathname === "/api/palworld/breeding/partners") {
      const parent = aliases(url.searchParams.get("parent") ?? "")
        .find((id) => pals.some((pal) => pal.id === id));
      if (!parent) {
        await json(route, { error: "PALWORLD_NOT_FOUND", message: "Pal을 찾을 수 없습니다." }, 404);
        return;
      }
      const type = url.searchParams.get("type") ?? "all";
      const allPairs = parent === "penking" || parent === "bushi"
        ? [breedingPair]
        : parent === "katress" || parent === "wixen"
          ? [
            genderBreedingPair("katress", "wixen", "female"),
            genderBreedingPair("katress", "wixen", "male"),
          ]
          : [{
            id: `fixture-${parent}-self`,
            parentA: palReference(parent),
            parentB: palReference(parent),
            child: palReference(parent),
            isSpecial: false,
          } satisfies PalworldBreedingPair];
      const pairs = allPairs.filter((pair) =>
        type === "all" || (type === "special" ? pair.isSpecial : !pair.isSpecial)
      );
      await json(route, {
        parent: palReference(parent),
        ...pageResponse(pairs, url, metadata),
        state: pairs.length ? "resolved" : "not_found",
      });
      return;
    }
    if (url.pathname === "/api/palworld/breeding/parents") {
      const child = aliases(url.searchParams.get("child") ?? "")
        .find((id) => id === "sibelyx" || id === "katress-ignis");
      const type = url.searchParams.get("type") ?? "all";
      const childPairs = child === "sibelyx"
        ? [breedingPair]
        : child === "katress-ignis"
          ? Array.from({ length: 13 }, (_, index) => ({
            ...genderBreedingPair("katress", "wixen", index % 2 === 0 ? "female" : "male"),
            id: `fixture-katress-wixen-katress-ignis-reverse-${index + 1}`,
          }))
          : [];
      const pairs = childPairs
        .filter((pair) => type === "all" || (type === "special" ? pair.isSpecial : !pair.isSpecial));
      await json(route, {
        child: palReference(child ?? "sibelyx"),
        ...pageResponse(pairs, url, metadata),
        state: pairs.length ? "resolved" : "not_found",
      });
      return;
    }
    if (url.pathname === "/api/palworld/breeding") {
      const parentAId = aliases(url.searchParams.get("parentA") ?? "").find((id) => pals.some((pal) => pal.id === id));
      const parentBId = aliases(url.searchParams.get("parentB") ?? "").find((id) => pals.some((pal) => pal.id === id));
      if (!parentAId || !parentBId) {
        await json(route, { error: "PALWORLD_NOT_FOUND", message: "Pal을 찾을 수 없습니다." }, 404);
        return;
      }
      const isSupported = new Set([parentAId, parentBId]).size === 2
        && [parentAId, parentBId].every((id) => id === "penking" || id === "bushi");
      const isGendered = new Set([parentAId, parentBId]).size === 2
        && [parentAId, parentBId].every((id) => id === "katress" || id === "wixen");
      const selfPair = parentAId === parentBId
        ? {
          id: `fixture-${parentAId}-self`,
          parentA: palReference(parentAId),
          parentB: palReference(parentBId),
          child: palReference(parentAId),
          isSpecial: false,
        } satisfies PalworldBreedingPair
        : null;
      const genderPairs = isGendered
        ? [
          genderBreedingPair(parentAId, parentBId, "female"),
          genderBreedingPair(parentAId, parentBId, "male"),
        ]
        : [];
      const parentAGender = url.searchParams.get("parentAGender");
      const parentBGender = url.searchParams.get("parentBGender");
      const genderPair = genderPairs.find((pair) => pair.genderCondition
        && parentAGender === pair.genderCondition.parentA
        && parentBGender === pair.genderCondition.parentB) ?? null;
      const genderResolved = genderPair !== null;
      await json(route, {
        parentA: palReference(parentAId),
        parentB: palReference(parentBId),
        result: isSupported ? breedingPair : selfPair ?? (genderResolved ? genderPair : null),
        state: isSupported || selfPair ? "resolved" : isGendered && (!parentAGender || !parentBGender)
          ? "requires_gender"
          : genderResolved
            ? "resolved"
            : "not_found",
        alternatives: isGendered && (!parentAGender || !parentBGender) ? genderPairs : [],
        metadata,
      });
      return;
    }

    const palMatch = url.pathname.match(/^\/api\/palworld\/pals\/([^/]+)$/u);
    if (palMatch?.[1]) {
      const id = decodeURIComponent(palMatch[1]);
      const pal = pals.find((candidate) => aliases(candidate.id).includes(id));
      await json(route, pal ?? { error: "PALWORLD_NOT_FOUND", message: "Pal을 찾을 수 없습니다." }, pal ? 200 : 404);
      return;
    }
    const itemMatch = url.pathname.match(/^\/api\/palworld\/items\/([^/]+)$/u);
    if (itemMatch?.[1]) {
      const id = decodeURIComponent(itemMatch[1]);
      const item = items.find((candidate) => aliases(candidate.id).includes(id));
      await json(route, item ?? { error: "PALWORLD_NOT_FOUND", message: "아이템을 찾을 수 없습니다." }, item ? 200 : 404);
      return;
    }
    const skillMatch = url.pathname.match(/^\/api\/palworld\/skills\/([^/]+)$/u);
    if (skillMatch?.[1]) {
      const id = decodeURIComponent(skillMatch[1]);
      const skill = skills.find((candidate) => candidate.id === id);
      await json(route, skill ?? { error: "PALWORLD_NOT_FOUND", message: "스킬을 찾을 수 없습니다." }, skill ? 200 : 404);
      return;
    }

    if (url.pathname === "/api/public/locale") {
      await json(route, { locale: "ko" });
      return;
    }
    if (url.pathname === "/api/public/twitch/status") {
      await json(route, {
        connected: false,
        configured: true,
        requiredScopes: [],
        missingScopes: [],
        streamers: [],
        queue: [],
        maxQueueSize: 100,
        updatedAt: "2026-07-21T00:00:00.000Z",
      });
      return;
    }
    if (url.pathname === "/api/public/twitch/followed-lol") {
      await json(route, {
        connected: false,
        total: 0,
        truncated: false,
        matchedCount: 0,
        subscriptionScopeGranted: false,
        subscriptions: [],
        channels: [],
      });
      return;
    }
    if (url.pathname === "/api/public/twitch/logout") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (url.pathname === "/api/public/aram/augments") {
      await json(route, {
        schemaVersion: 1,
        mode: "aram_augments",
        status: "preparing",
        dataVersion: "candidate",
        sourceRevision: "not_imported",
        augments: [],
      });
      return;
    }
    if (url.pathname === "/api/public/community/posts") {
      await json(route, { posts: [] });
      return;
    }
    await json(route, {});
  });
}

async function installConnectedTwitchFixtures(page: Page, { liveCount = 1, longContent = false } = {}) {
  let connected = true;
  let statusRequests = 0;
  let followedRequests = 0;
  const additionalLiveChannels = Array.from({ length: Math.max(0, liveCount - 1) }, (_, index) => ({
    twitchUserId: `live-${index + 2}`,
    twitchLogin: `live_pal_${index + 2}`,
    twitchDisplayName: `Live Pal ${index + 2}`,
    profileImageUrl: "/images/yorogg-mark.png",
    followedAt: "2026-07-20T00:00:00.000Z",
    isLive: true,
    channelUrl: `https://www.twitch.tv/live_pal_${index + 2}`,
    gameName: "Palworld",
    title: `Palworld LIVE ${index + 2}`,
    viewerCount: 100 + index,
    thumbnailUrl: `https://static-cdn.jtvnw.net/previews-ttv/live_user_live_pal_${index + 2}-{width}x{height}.jpg`,
  }));
  const channels = [
    {
      twitchUserId: "55",
      twitchLogin: "live_pal",
      twitchDisplayName: longContent ? "아주 긴 이름을 사용하는 Palworld LIVE 스트리머" : "Live Pal",
      profileImageUrl: "/images/yorogg-mark.png",
      followedAt: "2026-07-20T00:00:00.000Z",
      isLive: true,
      channelUrl: "https://www.twitch.tv/live_pal",
      gameName: longContent ? "Palworld 장시간 협동 탐험과 기지 건설 방송" : "Palworld",
      title: longContent ? "아주 긴 방송 제목도 모바일 페이지 전체 너비를 확장하지 않아야 합니다" : "오늘도 팰 모험",
      viewerCount: 321,
      thumbnailUrl: "https://static-cdn.jtvnw.net/previews-ttv/live_user_live_pal-{width}x{height}.jpg",
    },
    ...additionalLiveChannels,
    {
      twitchUserId: "55",
      twitchLogin: "live_pal_duplicate",
      twitchDisplayName: "중복 Live Pal",
      followedAt: "2026-07-20T00:00:00.000Z",
      isLive: true,
    },
    {
      twitchUserId: "77",
      twitchLogin: "offline_pal",
      twitchDisplayName: "Offline Pal",
      profileImageUrl: "/images/yorogg-mark.png",
      followedAt: "2026-07-19T00:00:00.000Z",
      isLive: false,
      channelUrl: "https://www.twitch.tv/offline_pal",
    },
  ];

  await page.route("https://static-cdn.jtvnw.net/previews-ttv/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#6f55ff"/></svg>',
    });
  });

  await page.route("**/api/public/twitch/status", async (route) => {
    statusRequests += 1;
    await json(route, connected ? {
      connected: true,
      configured: true,
      requiredScopes: ["user:read:follows", "user:read:subscriptions"],
      missingScopes: [],
      user: {
        id: "viewer-1",
        login: "pal_viewer",
        displayName: longContent ? "아주 긴 Twitch 프로필 표시 이름" : "Pal Viewer",
        profileImageUrl: "/images/yorogg-mark.png",
      },
      streamerRiotRequest: {
        id: "request-1",
        twitchUserId: "viewer-1",
        twitchLogin: "pal_viewer",
        twitchDisplayName: "Pal Viewer",
        riotGameName: "Viewer",
        riotTagLine: "JP1",
        status: "approved",
        requestedAt: "2026-07-20T00:00:00.000Z",
        updatedAt: "2026-07-20T00:00:00.000Z",
        dashboardEnabled: true,
      },
    } : {
      connected: false,
      configured: true,
      requiredScopes: ["user:read:follows", "user:read:subscriptions"],
      missingScopes: ["user:read:follows", "user:read:subscriptions"],
    });
  });
  await page.route("**/api/public/twitch/followed-lol?*", async (route) => {
    followedRequests += 1;
    await json(route, {
      connected,
      total: connected ? 2 : 0,
      truncated: false,
      matchedCount: connected ? channels.length : 0,
      subscriptionScopeGranted: true,
      subscriptions: [],
      channels: connected ? channels : [],
    });
  });
  await page.route("**/api/public/twitch/logout", async (route) => {
    connected = false;
    await route.fulfill({ status: 204 });
  });
  return {
    followedRequestCount: () => followedRequests,
    isConnected: () => connected,
    statusRequestCount: () => statusRequests,
  };
}

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return errors;
}

async function assertHealthyDocument(page: Page, errors: string[]): Promise<void> {
  await page.waitForLoadState("networkidle");
  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  expect(dimensions.documentWidth, "페이지 전체에 수평 overflow가 없어야 합니다.").toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(errors, "console 또는 page runtime 오류가 없어야 합니다.").toEqual([]);
}

async function chooseGame(page: Page, game: "league" | "palworld"): Promise<void> {
  const optionName = game === "league" ? "리그 오브 레전드 선택" : "Palworld 선택";
  if ((page.viewportSize()?.width ?? 1440) <= 768) {
    await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
    await page.getByRole("dialog", { name: "메뉴" })
      .getByRole("option", { name: optionName, exact: true })
      .click();
    return;
  }
  await page.locator(".public-game-selector-trigger").click();
  await page.locator(".public-game-selector-menu")
    .getByRole("option", { name: optionName, exact: true })
    .click();
}

function usesMobilePublicMenu(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) <= 768;
}

async function openMobilePublicMenu(page: Page) {
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "메뉴" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function selectPublicLocale(page: Page, locale: "ko" | "ja"): Promise<void> {
  if (usesMobilePublicMenu(page)) {
    const dialog = await openMobilePublicMenu(page);
    const option = dialog.getByRole("radio", {
      name: locale === "ja" ? /일본어|日本語/u : /한국어|韓国語/u,
    });
    await option.click();
    const localizedDialog = page.getByRole("dialog", { name: locale === "ja" ? "メニュー" : "메뉴" });
    await expect(localizedDialog.getByRole("radio", {
      name: locale === "ja" ? /일본어|日本語/u : /한국어|韓国語/u,
    })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await expect(localizedDialog).toHaveCount(0);
    return;
  }

  await page.locator(".public-locale-button").click();
  await page.getByRole("menuitemradio", { name: locale === "ja" ? /JP/u : /KR/u }).click();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("loltrace.locale", "ko");
    window.localStorage.removeItem("preferredGame");
  });
  await page.route("**/dashboard/config.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: "window.__STREAMOPS_CONFIG__ = { apiBase: window.location.origin };",
    });
  });
  await installApiFixtures(page);
});

test("모바일 통합 메뉴는 전체 시트가 자연스럽게 올라오고 내부 콘텐츠는 따로 이동하지 않는다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/palworld");
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();

  const sheet = page.locator(".public-bottom-sheet");
  const dialog = sheet.locator(".yoro-modal__dialog");
  const surface = sheet.locator(".public-bottom-sheet__surface");
  await expect(sheet).toHaveAttribute("data-sheet-state", "open");
  const motion = await sheet.evaluate((element) => {
    const dialogElement = element.querySelector<HTMLElement>(".yoro-modal__dialog");
    const surfaceElement = element.querySelector<HTMLElement>(".public-bottom-sheet__surface");
    if (!dialogElement || !surfaceElement) return null;
    const backdropStyle = window.getComputedStyle(element);
    const dialogStyle = window.getComputedStyle(dialogElement);
    const surfaceStyle = window.getComputedStyle(surfaceElement);
    return {
      backdropDuration: backdropStyle.transitionDuration,
      dialogDuration: dialogStyle.transitionDuration,
      dialogProperty: dialogStyle.transitionProperty,
      surfaceDuration: surfaceStyle.transitionDuration,
      surfaceProperty: surfaceStyle.transitionProperty,
    };
  });
  expect(motion).toEqual({
    backdropDuration: "0.44s",
    dialogDuration: "0.44s",
    dialogProperty: "transform",
    surfaceDuration: "0s",
    surfaceProperty: "all",
  });
  await expect(dialog).toBeVisible();
  await expect(surface).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole("button", { name: "메뉴 열기", exact: true })).toBeFocused();
});

test("LoL·Palworld LIVE rail은 PC 이동 버튼·정사각형 LoL 카드·모바일 터치 스크롤을 제공한다", async ({ page }) => {
  await installConnectedTwitchFixtures(page, { liveCount: 8 });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/palworld");

  const rail = page.getByTestId("public-live-streamer-rail");
  await expect(rail.locator(".public-home-live-card")).toHaveCount(8);
  const cardMetrics = await rail.evaluate((element) => {
    const cards = Array.from(element.querySelectorAll<HTMLElement>(".public-home-live-card"));
    const railRect = element.getBoundingClientRect();
    const gap = Number.parseFloat(getComputedStyle(element).columnGap);
    return {
      cardWidth: cards[0]?.getBoundingClientRect().width ?? 0,
      expectedWidth: (railRect.width - gap) / 2,
      thirdCardStartsOutside: (cards[2]?.getBoundingClientRect().left ?? 0) >= railRect.right - 1,
    };
  });
  expect(Math.abs(cardMetrics.cardWidth - cardMetrics.expectedWidth)).toBeLessThanOrEqual(2);
  expect(cardMetrics.thirdCardStartsOutside).toBe(true);

  const nextButton = page.getByRole("button", { name: "다음 LIVE 스트리머 보기" });
  await expect(nextButton).toBeVisible();
  const initialScrollLeft = await rail.evaluate((element) => element.scrollLeft);
  await nextButton.click();
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(initialScrollLeft);
  await expect(page.getByRole("button", { name: "이전 LIVE 스트리머 보기" })).toBeVisible();

  await chooseGame(page, "league");
  await expect(page).toHaveURL(/\/$/u);
  const lolRail = page.getByTestId("public-live-streamer-rail");
  await expect(lolRail.locator(".public-home-live-card")).toHaveCount(8);
  await expect(lolRail.locator(".public-home-live-preview")).toHaveCount(8);
  const lolCardMetrics = await lolRail.evaluate((element) => {
    const firstCard = element.querySelector<HTMLElement>(".public-home-live-card");
    const preview = firstCard?.querySelector<HTMLElement>(".public-home-live-preview");
    const title = firstCard?.querySelector<HTMLElement>("strong");
    const description = firstCard?.querySelector<HTMLElement>("small");
    return {
      cardWidth: firstCard?.getBoundingClientRect().width ?? 0,
      cardHeight: firstCard?.getBoundingClientRect().height ?? 0,
      contentFits: (firstCard?.scrollHeight ?? 0) <= (firstCard?.clientHeight ?? 0) + 1,
      previewRatio: preview ? preview.getBoundingClientRect().width / preview.getBoundingClientRect().height : 0,
      railWidth: element.getBoundingClientRect().width,
      titleColor: title ? getComputedStyle(title).color : "",
      descriptionColor: description ? getComputedStyle(description).color : "",
    };
  });
  expect(Math.abs(lolCardMetrics.cardWidth - lolCardMetrics.cardHeight)).toBeLessThanOrEqual(2);
  expect(lolCardMetrics.cardWidth).toBeLessThan(lolCardMetrics.railWidth / 2);
  expect(lolCardMetrics.contentFits).toBe(true);
  expect(Math.abs(lolCardMetrics.previewRatio - (16 / 9))).toBeLessThan(0.02);
  expect(lolCardMetrics.titleColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(lolCardMetrics.descriptionColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(lolCardMetrics.titleColor).not.toBe(lolCardMetrics.descriptionColor);
  const lolNextButton = page.getByRole("button", { name: "다음 LIVE 스트리머 보기" });
  await expect(lolNextButton).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(lolNextButton).toBeHidden();
  const mobileMetrics = await lolRail.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      hasHorizontalOverflow: element.scrollWidth > element.clientWidth,
      overflowX: style.overflowX,
      scrollSnapType: style.scrollSnapType,
      touchAction: style.touchAction,
    };
  });
  expect(mobileMetrics).toMatchObject({
    hasHorizontalOverflow: true,
    overflowX: "auto",
    scrollSnapType: "inline mandatory",
    touchAction: "pan-x pan-y",
  });
});

test("LoL 홈 연관 검색은 Hero와 LIVE 영역보다 위에서 포인터 입력을 받는다", async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 900 });
  await page.addInitScript(() => {
    window.localStorage.setItem("loltrace.recent.jp", JSON.stringify([{
      gameName: "YoroTester",
      tagLine: "JP1",
      source: "recent",
    }]));
  });
  await page.goto("/");

  const search = page.locator(".public-game-home--lol .public-home-shared-input");
  await expect(search).toBeVisible();
  const heroAlignment = await page.locator(".public-game-home--lol .public-game-home__hero").evaluate((hero) => {
    const copy = hero.querySelector<HTMLElement>(".public-game-home__copy");
    const heroRect = hero.getBoundingClientRect();
    const copyRect = copy?.getBoundingClientRect();
    return {
      copyCenter: copyRect ? copyRect.left + (copyRect.width / 2) : Number.NaN,
      heroCenter: heroRect.left + (heroRect.width / 2),
    };
  });
  expect(Math.abs(heroAlignment.copyCenter - heroAlignment.heroCenter)).toBeLessThanOrEqual(2);

  await search.focus();
  const panel = page.locator(".public-game-home--lol .public-suggestion-panel");
  await expect(panel).toBeVisible();

  const stacking = await panel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + Math.min(rect.width / 2, Math.max(2, rect.width - 2));
    const y = Math.min(window.innerHeight - 2, rect.top + Math.min(rect.height / 2, 48));
    const hit = document.elementFromPoint(x, y);
    return {
      copyZIndex: getComputedStyle(element.closest(".public-game-home__copy") as Element).zIndex,
      heroZIndex: getComputedStyle(element.closest(".public-game-home__hero") as Element).zIndex,
      hitInsidePanel: hit !== null && element.contains(hit),
      panelZIndex: getComputedStyle(element).zIndex,
    };
  });
  expect(Number(stacking.copyZIndex)).toBeGreaterThanOrEqual(30);
  expect(Number(stacking.heroZIndex)).toBeGreaterThanOrEqual(30);
  expect(Number(stacking.panelZIndex)).toBeGreaterThanOrEqual(30);
  expect(stacking.hitInsidePanel, "LoL 연관 검색 항목이 다른 Hero 콘텐츠에 가려지면 안 됩니다.").toBe(true);
});

test("펠월드 홈은 Hero 검색과 Twitch 로그인 LIVE rail만 표시하고 게임 선택으로 LoL과 왕복 이동한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld");

  await expect(page.locator(".palworld-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Palworld DB", level: 1 })).toBeVisible();
  await expect(page.getByTestId("hero-search")).toBeVisible();
  await expect(page.getByTestId("header-search")).toHaveCount(0);
  await expect(page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "홈" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".palworld-hero-meta, .palworld-shortcuts, .palworld-summary")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "팔로우 중인 LIVE 스트리머" })).toBeVisible();
  await expect(page.getByText("Twitch 로그인 후 팔로우 중인 스트리머의 방송 상태를 확인할 수 있습니다.")).toBeVisible();
  await expect(page.getByTestId("public-live-streamer-rail").getByRole("button", { name: "Twitch 로그인" })).toBeVisible();
  await expect(page.getByTestId("palworld-secondary-nav").getByRole("button")).toHaveCount(7);
  const primaryCards = page.locator(".palworld-home-primary-card");
  await expect(primaryCards).toHaveCount(3);
  await expect(page.locator(".palworld-home-primary-card__arrow")).toHaveCount(0);
  const primaryImageMetrics = await primaryCards.evaluateAll((cards) => cards.map((card) => {
    const image = card.querySelector<HTMLElement>(".palworld-home-primary-card__image");
    if (!image) return { centerRatio: Number.NaN, staysInside: false };
    const cardRect = card.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    return {
      centerRatio: ((imageRect.left + (imageRect.width / 2)) - cardRect.left) / cardRect.width,
      staysInside: (
        imageRect.left >= cardRect.left - 1
        && imageRect.right <= cardRect.right + 1
        && imageRect.top >= cardRect.top - 1
        && imageRect.bottom <= cardRect.bottom + 1
      ),
    };
  }));
  expect(
    primaryImageMetrics.every(({ staysInside }) => staysInside),
    "주요 기능 이미지는 모바일과 PC 카드 경계 안에 전부 표시되어야 합니다.",
  ).toBe(true);
  const primaryImageCenters = primaryImageMetrics.map(({ centerRatio }) => centerRatio);
  expect(
    Math.max(...primaryImageCenters) - Math.min(...primaryImageCenters),
    "주요 기능 이미지 세 개는 같은 세로 중심축에 정렬되어야 합니다.",
  ).toBeLessThanOrEqual(0.02);
  await assertHealthyDocument(page, errors);

  await chooseGame(page, "league");
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.locator(".public-home-shared-shell")).toBeVisible();

  await chooseGame(page, "palworld");
  await expect(page).toHaveURL(/\/palworld$/u);
  await expect(page.locator(".palworld-shell")).toBeVisible();
  await expect(page.getByTestId("hero-search")).toBeVisible();
  await assertHealthyDocument(page, errors);
});

test("LoL의 공개 Twitch session은 Palworld 프로필과 홈 LIVE 목록에 그대로 연결된다", async ({ page }) => {
  await installConnectedTwitchFixtures(page);
  const errors = collectRuntimeErrors(page);
  await page.goto("/");
  if (usesMobilePublicMenu(page)) {
    const mobileMenu = await openMobilePublicMenu(page);
    await expect(mobileMenu.getByText("Pal Viewer", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByRole("button", { name: "Pal Viewer" })).toBeVisible();
  }

  await chooseGame(page, "palworld");
  await expect(page).toHaveURL(/\/palworld$/u);
  if (usesMobilePublicMenu(page)) {
    const mobileMenu = await openMobilePublicMenu(page);
    await expect(mobileMenu.getByText("Pal Viewer", { exact: true })).toBeVisible();
    await expect(mobileMenu.getByRole("button", { name: "YORO Dashboard" })).toBeVisible();
    await expect(mobileMenu.getByRole("button", { name: "대시보드 열기" })).toHaveCount(0);
    await expect(mobileMenu.getByRole("button", { name: "로그아웃" })).toBeVisible();
    await expect(mobileMenu.getByText(/Riot ID|내 전적/u)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "메뉴" })).toHaveCount(0);
  } else {
    const accountButton = page.getByRole("button", { name: "Pal Viewer" });
    await expect(accountButton).toBeVisible();
    await accountButton.click();
    await expect(page.getByRole("menu", { name: "계정 메뉴" })).toBeVisible();
    const dashboardMenuItem = page.getByRole("menuitem", { name: "YORO Dashboard" });
    const logoutMenuItem = page.getByRole("menuitem", { name: "로그아웃" });
    await expect(dashboardMenuItem).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "대시보드 열기" })).toHaveCount(0);
    await expect(dashboardMenuItem).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(logoutMenuItem).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(dashboardMenuItem).toBeFocused();
    await expect(page.getByRole("menu").getByText(/Riot ID|내 전적/u)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: "계정 메뉴" })).toHaveCount(0);
    await accountButton.click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: "계정 메뉴" })).toHaveCount(0);
  }
  await expect(page.getByTestId("public-live-streamer-rail").getByText("Live Pal", { exact: true })).toBeVisible();
  await expect(page.getByTestId("public-live-streamer-rail").getByText("Offline Pal", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("public-live-streamer-rail").getByText("중복 Live Pal", { exact: true })).toHaveCount(0);

  await expect(page.getByText(/Riot ID|랭크|전적 보기/u)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "전체 보기" })).toHaveCount(0);
  await assertHealthyDocument(page, errors);
});

test("Palworld 하위 데이터 페이지는 Twitch 상태만 조회하고 홈 진입 시 팔로우 목록을 지연 조회한다", async ({ page }) => {
  const fixture = await installConnectedTwitchFixtures(page);
  await page.goto("/palworld/pals");
  if (usesMobilePublicMenu(page)) {
    const mobileMenu = await openMobilePublicMenu(page);
    await expect(mobileMenu.getByText("Pal Viewer", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByRole("button", { name: "Pal Viewer" })).toBeVisible();
  }
  expect(fixture.followedRequestCount()).toBe(0);

  await page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "홈" }).click();
  await expect(page).toHaveURL(/\/palworld$/u);
  await expect.poll(() => fixture.followedRequestCount()).toBe(1);
  await expect(page.getByTestId("public-live-streamer-rail").getByText("Live Pal", { exact: true })).toBeVisible();
});

test("Twitch 상태 API 오류는 미설정으로 오표시하지 않고 Palworld 홈 검색과 분리된다", async ({ page }) => {
  await page.route("**/api/public/twitch/status", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });
  await page.goto("/palworld");
  await expect(page.getByTestId("public-live-streamer-rail").getByRole("alert")).toContainText("Twitch 방송 상태를 불러오지 못했습니다.");
  await expect(page.getByText("Twitch 기능이 설정되지 않았습니다.")).toHaveCount(0);
  const search = page.getByTestId("hero-search").getByRole("searchbox");
  await search.fill("펭킹");
  await expect(page.getByTestId("hero-search").getByRole("option", { name: /펭킹/u })).toBeVisible();
});

test("Twitch 팔로우 API 오류가 발생해도 Palworld 홈 검색은 계속 동작한다", async ({ page }) => {
  await installConnectedTwitchFixtures(page);
  await page.route("**/api/public/twitch/followed-lol?limit=100", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });
  await page.goto("/palworld");
  await expect(page.getByTestId("public-live-streamer-rail").getByRole("alert")).toContainText("Twitch 방송 상태를 불러오지 못했습니다.");
  const search = page.getByTestId("hero-search").getByRole("searchbox");
  await search.fill("펭킹");
  const option = page.getByTestId("hero-search").getByRole("option", { name: /펭킹/u });
  await expect(option).toBeVisible();
  if ((page.viewportSize()?.width ?? 1440) <= 600) {
    const optionReceivesPointer = await option.evaluate((element) => {
      const hero = element.closest(".public-game-home__hero, .palworld-hero");
      if (!hero) return false;
      const optionRect = element.getBoundingClientRect();
      const heroRect = hero.getBoundingClientRect();
      const x = optionRect.left + (optionRect.width / 2);
      const y = Math.min(
        optionRect.bottom - 2,
        Math.max(optionRect.top + 2, heroRect.bottom + 8),
      );
      const hit = document.elementFromPoint(x, y);
      return hit !== null && element.contains(hit);
    });
    expect(optionReceivesPointer, "Hero 경계 밖의 모바일 검색 제안을 터치할 수 있어야 합니다.").toBe(true);
  }
});

test("통합 검색 자동완성은 오류를 빈 결과와 구분하고 키보드로 선택할 수 있다", async ({ page }) => {
  const searchPattern = "**/api/palworld/search?*";
  const unavailableHandler = async (route: Route) => {
    await json(route, {
      error: "PALWORLD_DATA_UNAVAILABLE",
      message: "Palworld 데이터를 사용할 수 없습니다.",
    }, 503);
  };
  await page.route(searchPattern, unavailableHandler);
  await page.goto("/palworld");

  const form = page.getByTestId("hero-search");
  const input = form.getByRole("searchbox");
  await input.fill("펭킹");
  await expect(form.getByRole("alert")).toContainText("Palworld 데이터를 사용할 수 없어 검색할 수 없습니다.");
  await expect(form).not.toContainText("검색 결과가 없습니다.");

  await page.unroute(searchPattern, unavailableHandler);
  await form.getByRole("button", { name: "다시 시도" }).click();
  const option = form.getByRole("option", { name: /펭킹/u });
  await expect(option).toBeVisible();
  await input.press("ArrowDown");
  const optionId = await option.getAttribute("id");
  expect(optionId).toBeTruthy();
  await expect(input).toHaveAttribute("aria-activedescendant", optionId!);
  await expect(option).toHaveAttribute("aria-selected", "true");
  await input.press("Escape");
  await expect(form.getByRole("listbox")).toHaveCount(0);
  await expect(input).toHaveAttribute("aria-expanded", "false");

  await input.focus();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/palworld\/pals\?pal=penking$/u);
  await expect(page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "펭킹" })).toBeVisible();
});

test("Palworld route SEO와 skip link는 locale·base canonical을 반영한다", async ({ page }) => {
  await page.goto("/palworld/breeding?mode=child&child=anubis&page=1");
  await expect(page).toHaveTitle("교배 조합 | YORO.gg");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://yoro.gg/palworld/breeding");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /부모/u);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "교배 조합 | YORO.gg");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://yoro.gg/palworld/breeding");
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", "교배 조합 | YORO.gg");

  const skipLink = page.locator(".yoro-app-shell__skip-link");
  await expect(skipLink).toHaveAttribute("href", "#palworld-main");
  await expect(skipLink).toHaveText("본문으로 이동");
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();

  await selectPublicLocale(page, "ja");
  await expect(page).toHaveTitle("配合組み合わせ | YORO.gg");
  await expect(skipLink).toHaveText("本文へ移動");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://yoro.gg/palworld/breeding");
});

test("Palworld pending Twitch 요청은 화면 전환 시 abort되고 늦은 응답이 LoL 화면을 갱신하지 않는다", async ({ page }) => {
  let palworldConnected = true;
  let followedAborted = false;
  let resolveFollowedStarted!: () => void;
  let releaseFollowed!: () => void;
  const followedStarted = new Promise<void>((resolve) => { resolveFollowedStarted = resolve; });
  const followedRelease = new Promise<void>((resolve) => { releaseFollowed = resolve; });
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).pathname === "/api/public/twitch/followed-lol") followedAborted = true;
  });
  await page.route("**/api/public/twitch/status", async (route) => {
    await json(route, palworldConnected ? {
      connected: true,
      configured: true,
      requiredScopes: ["user:read:follows", "user:read:subscriptions"],
      missingScopes: [],
      user: { id: "viewer-1", login: "pal_viewer", displayName: "Pal Viewer" },
    } : {
      connected: false,
      configured: true,
      requiredScopes: ["user:read:follows", "user:read:subscriptions"],
      missingScopes: ["user:read:follows", "user:read:subscriptions"],
    });
  });
  await page.route("**/api/public/twitch/followed-lol?limit=100", async (route) => {
    resolveFollowedStarted();
    await followedRelease;
    if (route.request().failure()) return;
    await json(route, {
      connected: true,
      total: 1,
      truncated: false,
      matchedCount: 0,
      subscriptionScopeGranted: true,
      subscriptions: [],
      channels: [],
    });
  });

  await page.goto("/palworld");
  await followedStarted;
  palworldConnected = false;
  await chooseGame(page, "league");
  await expect(page).toHaveURL(/\/$/u);
  await expect.poll(() => followedAborted).toBe(true);
  releaseFollowed();
  await expect(page.locator(".public-home-shared-shell")).toBeVisible();
  await expect(page.locator(".palworld-shell")).toHaveCount(0);
});

test("Palworld OAuth marker는 기존 검색 query를 보존해 제거하고 현재 경로를 return_to로 전달한다", async ({ page }) => {
  await page.goto(`/palworld/search?q=${encodeURIComponent("아누비스")}&pal=anubis&viewer_twitch=connected`);
  await expect.poll(() => new URL(page.url()).searchParams.has("viewer_twitch")).toBe(false);
  expect(new URL(page.url()).searchParams.get("q")).toBe("아누비스");
  expect(new URL(page.url()).searchParams.get("pal")).toBe("anubis");
  const palModal = page.getByTestId("pal-detail-modal");
  await expect(palModal).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palModal).toHaveCount(0);

  const authRequestPromise = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/api/account/oauth/twitch/start"
  );
  if (usesMobilePublicMenu(page)) {
    const mobileMenu = await openMobilePublicMenu(page);
    await mobileMenu.getByRole("button", { name: "Twitch 로그인" }).click();
  } else {
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await page.getByRole("menuitem", { name: "Twitch 로그인" }).click();
  }
  const authRequest = await authRequestPromise;
  const returnTo = new URL(authRequest.url()).searchParams.get("return_to");
  expect(returnTo).toBe(`/palworld/search?q=${encodeURIComponent("아누비스")}`);
});

test("LoL과 Palworld 상단 로그인은 Discord·Twitch 선택 메뉴를 동일하게 제공한다", async ({ page }) => {
  for (const path of ["/", "/palworld"]) {
    await page.goto(path);
    if (usesMobilePublicMenu(page)) {
      const mobileMenu = await openMobilePublicMenu(page);
      await expect(mobileMenu.getByRole("button", { name: "Discord 로그인" })).toBeVisible();
      await expect(mobileMenu.getByRole("button", { name: "Twitch 로그인" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(mobileMenu).toHaveCount(0);
      continue;
    }

    const header = page.locator(".public-game-header").first();
    const loginButton = header.getByRole("button", { name: "로그인", exact: true });
    await loginButton.click();
    await expect(header.getByRole("menuitem", { name: "Discord 로그인" })).toBeVisible();
    await expect(header.getByRole("menuitem", { name: "Twitch 로그인" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(loginButton).toHaveAttribute("aria-expanded", "false");
    await expect(loginButton).toBeFocused();
  }
});

test("모바일 Pal·아이템·스킬 상세는 핸들 드래그로 복귀하거나 닫힌다", async ({ page }) => {
  const mobileViewport = (page.viewportSize()?.width ?? 0) <= 768;
  await page.goto("/palworld/pals?pal=anubis");
  const palModal = page.getByTestId("pal-detail-modal");
  const palDialog = palModal.locator(".yoro-modal__dialog");
  const palHandle = palModal.getByTestId("palworld-mobile-dismiss-handle");
  await expect(palModal).toBeVisible();

  if (!mobileViewport) {
    await expect(palHandle).toBeHidden();
    await palModal.getByRole("button", { name: "닫기" }).click();
    await expect(palModal).toHaveCount(0);
    return;
  }

  await expect(palHandle).toBeVisible();
  await expect(palHandle).toHaveAttribute("aria-label", "아래로 끌어 상세 보기 닫기");
  const handleBox = await palHandle.boundingBox();
  expect(handleBox).not.toBeNull();

  async function dragHandle(distance: number): Promise<void> {
    const box = await palHandle.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const y = box!.y + box!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + distance, { steps: 6 });
    await page.mouse.up();
  }

  await dragHandle(24);
  await expect(palModal).toBeVisible();
  await expect.poll(() => palDialog.evaluate((element) => {
    const transform = window.getComputedStyle(element).transform;
    return transform === "none" ? 0 : new DOMMatrix(transform).m42;
  })).toBeLessThanOrEqual(1);

  await dragHandle(140);
  await expect(palModal).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.has("pal")).toBe(false);

  await page.goto("/palworld/items?item=pal_sphere");
  const itemModal = page.getByTestId("item-detail-modal");
  const itemHandle = itemModal.getByTestId("palworld-mobile-dismiss-handle");
  await expect(itemHandle).toBeVisible();
  await itemHandle.click();
  await expect(itemModal).toBeVisible();
  await itemHandle.focus();
  await page.keyboard.press("Enter");
  await expect(itemModal).toHaveCount(0);

  await page.goto("/palworld/skills?skill=active-ground-stone-blast-30-2");
  await expect(
    page.getByTestId("skill-detail-modal").getByTestId("palworld-mobile-dismiss-handle"),
  ).toBeVisible();
});

test("Palworld OAuth callback 표시 후 공유 Twitch 상태를 재조회하고 marker만 제거한다", async ({ page }) => {
  const fixture = await installConnectedTwitchFixtures(page);
  await page.goto("/palworld/technology?order=desc&viewer_twitch=connected");
  if (usesMobilePublicMenu(page)) {
    const mobileMenu = await openMobilePublicMenu(page);
    await expect(mobileMenu.getByText("Pal Viewer", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByRole("button", { name: "Pal Viewer" })).toBeVisible();
  }
  await expect.poll(() => fixture.statusRequestCount()).toBeGreaterThanOrEqual(2);
  const currentUrl = new URL(page.url());
  expect(currentUrl.pathname).toBe("/palworld/technology");
  expect(currentUrl.searchParams.get("order")).toBe("desc");
  expect(currentUrl.searchParams.has("viewer_twitch")).toBe(false);
});

test("Palworld 로그아웃은 공유 session을 제거해 LoL에서도 미로그인 상태가 된다", async ({ page }) => {
  const fixture = await installConnectedTwitchFixtures(page);
  await page.goto("/palworld");
  if (usesMobilePublicMenu(page)) {
    const mobileMenu = await openMobilePublicMenu(page);
    await mobileMenu.getByRole("button", { name: "로그아웃" }).click();
  } else {
    await page.getByRole("button", { name: "Pal Viewer" }).click();
    await page.getByRole("menuitem", { name: "로그아웃" }).click();
  }
  await expect.poll(() => fixture.isConnected()).toBe(false);
  await expect(page.getByRole("button", { name: "로그인", exact: true }).first()).toBeVisible();

  await chooseGame(page, "league");
  await expect(page).toHaveURL(/\/$/u);
  if (usesMobilePublicMenu(page)) {
    const mobileMenu = await openMobilePublicMenu(page);
    await expect(mobileMenu.getByRole("button", { name: "Discord 로그인" })).toBeVisible();
    await expect(mobileMenu.getByRole("button", { name: "Twitch 로그인" })).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(page.getByRole("button", { name: "로그인", exact: true }).first()).toBeVisible();
  }
});

test("Pal 필터 query를 유지하고 정렬된 compact 카드·ESC·직접 URL 상세 Modal을 지원한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld/pals?element=ground&work=mining&sort=number&order=desc");

  await expect(page.getByTestId("header-search")).toBeVisible();
  await expect(page.getByTestId("hero-search")).toHaveCount(0);
  const mobileFilterTrigger = page.getByTestId("pal-filter-trigger");
  const mobileFilters = await mobileFilterTrigger.isVisible();
  if (mobileFilters) await mobileFilterTrigger.click();
  const filterSurface = mobileFilters ? page.getByRole("dialog", { name: "상세 필터" }) : page;
  const elementFilters = filterSurface.getByRole("group", { name: "속성" });
  const workFilters = filterSurface.getByRole("group", { name: "작업 적성" });
  const groundFilter = elementFilters.getByRole("button", { name: /땅/u });
  const miningFilter = workFilters.getByRole("button", { name: /채굴/u });
  await expect(groundFilter).toHaveAttribute("aria-pressed", "true");
  await expect(miningFilter).toHaveAttribute("aria-pressed", "true");
  const elementIcon = groundFilter.locator(".palworld-pal-filter-element-icon");
  const workIcon = miningFilter.locator(".palworld-pal-filter-work-icon");
  await expect(elementIcon).toBeVisible();
  await expect(workIcon).toBeVisible();
  await expect(workIcon).toHaveAttribute(
    "src",
    /^\/images\/palworld\/(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\/work\/[a-f0-9]{64}\.webp$/u,
  );
  const elementIconBox = await elementIcon.boundingBox();
  const workIconBox = await workIcon.boundingBox();
  expect(elementIconBox).not.toBeNull();
  expect(workIconBox).not.toBeNull();
  if (elementIconBox) {
    expect(elementIconBox.width).toBeGreaterThanOrEqual(24);
  }
  if (workIconBox) {
    expect(workIconBox.width).toBeGreaterThanOrEqual(24);
  }
  if (mobileFilters) await page.keyboard.press("Escape");
  await expect(page.getByRole("combobox", { name: "정렬", exact: true })).toHaveValue("number");
  await expect(page.locator(".palworld-pal-sort-order")).toContainText("내림차순");
  await expect(page.locator(".palworld-pal-grid")).toBeVisible();
  const anubisCard = page.getByTestId("pal-card").filter({ hasText: "아누비스" });
  await expect(anubisCard).toBeVisible();
  await expect(anubisCard.locator(".palworld-pal-card-image-frame")).toBeVisible();
  await expect(anubisCard.locator(".palworld-card-work-list [role='listitem']")).toHaveCount(3);
  await expect(anubisCard.locator(".palworld-work-suitability-badge")).toHaveCount(2);
  await expect(anubisCard.locator(".palworld-card-work-more")).toHaveText("...");
  await expect(anubisCard.locator(".palworld-card-work-more")).toHaveAttribute("aria-label", "그 외 작업 적성 2개");
  await expect(anubisCard.locator('[data-work-type="handiwork"]')).toContainText("Lv.4");
  await expect(anubisCard.locator('[data-work-type="mining"]')).toContainText("Lv.3");
  await expect(anubisCard.locator('[data-work-type="transporting"]')).toHaveCount(0);
  await expect(anubisCard.locator('[data-work-type="farming"]')).toHaveCount(0);
  await expect(anubisCard.locator('[data-work-type="handiwork"]')).not.toHaveAttribute("title");
  await expect(anubisCard.locator('[data-work-type="mining"]')).not.toHaveAttribute("title");
  await expect(anubisCard.locator('[data-work-type="handiwork"]')).toHaveAttribute("aria-describedby", /.+/u);
  await expect(anubisCard.locator('[data-work-type="mining"]')).toHaveAttribute("aria-describedby", /.+/u);
  await expect(anubisCard.locator('[data-work-type="handiwork"] .palworld-work-suitability-tooltip')).toHaveText("수작업: Lv.4");
  await expect(anubisCard.locator('[data-work-type="mining"] .palworld-work-suitability-tooltip')).toHaveText("채굴: Lv.3");
  await expect(anubisCard.locator('[data-work-type="handiwork"] .palworld-work-suitability-label')).toHaveClass(/yoro-u-sr-only/u);
  await expect(anubisCard.locator('[data-work-type="mining"] .palworld-work-suitability-label')).toHaveClass(/yoro-u-sr-only/u);
  await expect(anubisCard.locator(".palworld-work-suitability-icon.is-source-image")).toHaveCount(2);
  await expect(anubisCard.locator(".palworld-work-suitability-badge.has-no-icon")).toHaveCount(0);
  const cardBox = await anubisCard.boundingBox();
  const cardMainBox = await anubisCard.locator(".palworld-pal-card-main").boundingBox();
  const cardImageFrameBox = await anubisCard.locator(".palworld-pal-card-image-frame").boundingBox();
  const cardContentBox = await anubisCard.locator(".palworld-pal-card-content").boundingBox();
  const cardWorkBox = await anubisCard.locator(".palworld-card-work-list").boundingBox();
  const workItemBoxes = await anubisCard.locator(".palworld-card-work-list [role='listitem']").evaluateAll((items) =>
    items.map((item) => {
      const bounds = item.getBoundingClientRect();
      return { bottom: bounds.bottom, top: bounds.top };
    })
  );
  const cardWorkIconBoxes = await anubisCard.locator(".palworld-work-suitability-icon").evaluateAll((icons) =>
    icons.map((icon) => {
      const bounds = icon.getBoundingClientRect();
      return { height: bounds.height, width: bounds.width };
    })
  );
  expect(cardBox).not.toBeNull();
  expect(cardMainBox).not.toBeNull();
  expect(cardImageFrameBox).not.toBeNull();
  expect(cardContentBox).not.toBeNull();
  expect(cardWorkBox).not.toBeNull();
  const workItemCenters = workItemBoxes.map((bounds) => (bounds.top + bounds.bottom) / 2);
  expect(Math.max(...workItemCenters) - Math.min(...workItemCenters))
    .toBeLessThanOrEqual(1);
  expect(cardWorkIconBoxes.every((bounds) => bounds.width >= 24 && bounds.height >= 24)).toBe(true);
  if (cardBox && cardMainBox && cardImageFrameBox && cardContentBox && cardWorkBox) {
    if (mobileFilters) {
      expect(cardImageFrameBox.y + cardImageFrameBox.height).toBeLessThanOrEqual(cardContentBox.y + 1);
    } else {
      expect(cardImageFrameBox.x + cardImageFrameBox.width).toBeLessThanOrEqual(cardContentBox.x + 1);
      expect(cardBox.width / cardBox.height).toBeGreaterThan(1.1);
    }
    expect(cardWorkBox.y).toBeGreaterThanOrEqual(cardMainBox.y + cardMainBox.height - 1);
    expect(cardImageFrameBox.width).toBeLessThanOrEqual(120);
  }

  await anubisCard.getByRole("button", { name: "Pal 상세 보기" }).click();
  await expect(page).toHaveURL(/pal=anubis/u);
  await expect(page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "아누비스" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pal-detail-modal")).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.has("pal")).toBe(false);

  await page.goto("/palworld/pals?pal=anubis");
  const directDialog = page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "아누비스" });
  await expect(directDialog).toBeVisible();
  await expect(directDialog).not.toContainText("アヌビス");
  await expect(directDialog).not.toContainText("교배 파워");
  await expect(directDialog).not.toContainText("교배 정보");
  await expect(directDialog.getByText("야행성: 예", { exact: true })).toBeVisible();
  const workList = directDialog.getByRole("list", { name: "작업 적성" });
  await expect(workList.locator(".palworld-work-suitability-badge")).toHaveCount(4);
  await expect(workList.locator('[data-work-type="handiwork"]')).toContainText("Lv.4");
  await expect(workList.locator('[data-work-type="mining"]')).toContainText("Lv.3");
  await expect(workList.locator('[data-work-type="handiwork"] .palworld-work-suitability-label')).toHaveText("수작업");
  await expect(workList.locator('[data-work-type="mining"] .palworld-work-suitability-label')).toHaveText("채굴");
  const statChart = directDialog.getByTestId("palworld-stat-chart");
  await expect(statChart.locator(".palworld-stat-chart-row")).toHaveCount(5);
  await expect(statChart.locator('[data-stat="hp"]')).toContainText("120");
  await expect(statChart.locator('[data-stat="moveSpeed"]')).toContainText("800");
  const palMediaBox = await directDialog.locator(".palworld-pal-detail-media").boundingBox();
  const palImageBox = await directDialog.getByRole("img", { name: "아누비스" }).boundingBox();
  expect(palMediaBox).not.toBeNull();
  expect(palImageBox).not.toBeNull();
  if (palMediaBox && palImageBox) {
    expect(palMediaBox.width).toBeLessThanOrEqual(160);
    expect(palMediaBox.width - palImageBox.width).toBeLessThanOrEqual(32);
  }
  await expect(apiRequestUrls.get(page) ?? []).toContain("/api/palworld/pals/anubis");
  await page.keyboard.press("Escape");
  await page.goto("/palworld/pals?pal=katress-ignis");
  const specialDialog = page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "캐티위자드" });
  await expect(specialDialog).toContainText("교배 정보");
  await expect(specialDialog).not.toContainText("교배 파워");
  await expect(specialDialog).toContainText("캐티메이지");
  await expect(specialDialog).toContainText("마호");
  await expect(specialDialog).toContainText("성별 조건: 암컷 / 수컷");
  await expect(specialDialog).not.toContainText("katress");
  await expect(specialDialog).not.toContainText("wixen");
  await page.keyboard.press("Escape");
  await selectPublicLocale(page, "ja");
  await page.evaluate(() => {
    window.history.pushState(null, "", "/palworld/pals?pal=katress-ignis");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  const japaneseDialog = page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "クレメーナ" });
  await expect(japaneseDialog).toContainText("配合情報");
  await expect(japaneseDialog).not.toContainText("配合パワー");
  await expect(japaneseDialog).toContainText("クレメーオ");
  await expect(japaneseDialog).toContainText("フォレーナ");
  await expect(japaneseDialog).toContainText("性別条件: メス / オス");
  await expect(japaneseDialog.getByText("夜行性: はい", { exact: true })).toBeVisible();
  await assertHealthyDocument(page, errors);
});

test("Pal 도감 검색·facet·chip·초기화·정렬은 URL을 단일 적용 상태로 유지한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld/pals?element=ground&work=mining&rarity=10&variant=special&sort=name&order=desc&page=2");

  const search = page.locator(".palworld-pal-search-form").getByRole("searchbox", { name: "이름 검색" });
  await expect(search).toBeVisible();
  const mobileFilterTrigger = page.getByTestId("pal-filter-trigger");
  const mobileFilters = await mobileFilterTrigger.isVisible();
  if (mobileFilters) await mobileFilterTrigger.click();
  let filterSurface = mobileFilters ? page.getByRole("dialog", { name: "상세 필터" }) : page;
  const elementGroup = filterSurface.getByRole("group", { name: "속성" });
  const workGroup = filterSurface.getByRole("group", { name: "작업 적성" });
  await expect(elementGroup.getByRole("button", { name: /땅/u })).toHaveAttribute("aria-pressed", "true");
  await expect(workGroup.getByRole("button", { name: /채굴/u })).toHaveAttribute("aria-pressed", "true");
  await expect(elementGroup.getByRole("button", { name: /물/u })).toBeVisible();
  await expect(filterSurface.getByRole("combobox", { name: "레어도", exact: true })).toHaveValue("10");
  await expect(filterSurface.getByRole("option", { name: /★ 20/u })).toHaveCount(0);
  await expect(filterSurface.getByRole("combobox", { name: "종류", exact: true })).toHaveValue("special");
  if (mobileFilters) await page.keyboard.press("Escape");
  await expect(page.getByText("조건에 맞는 Pal 1종 · 1종 표시", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "땅 속성 필터 제거" })).toBeVisible();

  await search.fill("  펭킹  ");
  await page.getByRole("combobox", { name: "정렬", exact: true }).selectOption("rarity");
  await expect(search).toHaveValue("  펭킹  ");
  await search.press("Enter");
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("펭킹");
  await expect.poll(() => new URL(page.url()).searchParams.has("page")).toBe(false);
  expect(new URL(page.url()).searchParams.get("order")).toBe("desc");

  await page.getByRole("button", { name: "땅 속성 필터 제거" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has("element")).toBe(false);
  expect(new URL(page.url()).searchParams.get("work")).toBe("mining");
  expect(new URL(page.url()).searchParams.get("sort")).toBe("rarity");
  expect(new URL(page.url()).searchParams.get("order")).toBe("desc");

  if (mobileFilters) {
    await mobileFilterTrigger.click();
    filterSurface = page.getByRole("dialog", { name: "상세 필터" });
    await filterSurface.getByRole("button", { name: "필터 초기화" }).click();
    await page.keyboard.press("Escape");
  } else {
    await page.getByRole("button", { name: "필터 초기화" }).click();
  }
  await expect.poll(() => {
    const current = new URL(page.url()).searchParams;
    return ["q", "element", "work", "rarity", "variant", "page"].every((key) => !current.has(key));
  }).toBe(true);
  expect(new URL(page.url()).searchParams.get("sort")).toBe("rarity");
  expect(new URL(page.url()).searchParams.get("order")).toBe("desc");
  await expect(search).toHaveValue("");

  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.has("element")).toBe(false);
  await expect(search).toHaveValue("펭킹");
  await page.goForward();
  await expect(search).toHaveValue("");

  await page.goto("/palworld/pals?q=존재하지않는Pal");
  await expect(page.getByText("조건에 맞는 Pal 0종 · 0종 표시", { exact: true })).toBeVisible();
  await expect(page.getByText("조건에 맞는 Pal이 없습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await selectPublicLocale(page, "ja");
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("존재하지않는Pal");
  await expect(page.getByText("条件に一致するパル 0体 · 0体を表示", { exact: true })).toBeVisible();
  if (mobileFilters) await page.getByTestId("pal-filter-trigger").click();
  await expect(page.getByRole("group", { name: "属性" })).toBeVisible();
  if (mobileFilters) await page.keyboard.press("Escape");
  await assertHealthyDocument(page, errors);
});

const palFilterMobileViewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
] as const;

for (const viewport of palFilterMobileViewports) {
  test(`Pal 도감 모바일 필터 Modal은 즉시 적용·focus 복귀·scroll lock을 지원한다 (${viewport.width}×${viewport.height})`, async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await page.goto("/palworld/pals?q=아누비스&element=ground&work=mining&rarity=10&variant=special");
    const search = page.locator(".palworld-pal-search-form").getByRole("searchbox", { name: "이름 검색" });
    const trigger = page.getByTestId("pal-filter-trigger");
    await expect(search).toBeVisible();
    await expect(trigger).toHaveText("필터 4개");
    await expect(page.locator(".palworld-pal-filter-panel")).toBeHidden();

    await trigger.focus();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "상세 필터" });
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await dialog.getByRole("group", { name: "속성" }).getByRole("button", { name: /불/u }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("element")).toBe("fire");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: /물/u })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
    await assertHealthyDocument(page, errors);

    await page.goto("/palworld/pals");
    const firstCard = page.getByTestId("pal-card").nth(0);
    const secondCard = page.getByTestId("pal-card").nth(1);
    await expect(firstCard).toBeVisible();
    await expect(secondCard).toBeVisible();
    const [firstCardBox, secondCardBox, imageBox, contentBox] = await Promise.all([
      firstCard.boundingBox(),
      secondCard.boundingBox(),
      firstCard.locator(".palworld-pal-card-image-frame").boundingBox(),
      firstCard.locator(".palworld-pal-card-content").boundingBox(),
    ]);
    expect(firstCardBox).not.toBeNull();
    expect(secondCardBox).not.toBeNull();
    expect(imageBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    if (firstCardBox && secondCardBox && imageBox && contentBox) {
      expect(Math.abs(firstCardBox.y - secondCardBox.y)).toBeLessThanOrEqual(1);
      expect(secondCardBox.x).toBeGreaterThan(firstCardBox.x + firstCardBox.width - 1);
      if (viewport.width <= 512) {
        expect(imageBox.y + imageBox.height).toBeLessThanOrEqual(contentBox.y + 1);
      }
    }
    await assertHealthyDocument(page, errors);
  });
}

const palFilterDesktopViewports = [
  { width: 1280, height: 900 },
  { width: 1366, height: 900 },
  { width: 1440, height: 1000 },
  { width: 1535, height: 1000 },
  { width: 1536, height: 1000 },
] as const;

for (const viewport of palFilterDesktopViewports) {
  test(`Pal 도감 필터 panel은 desktop 화면 폭과 정렬을 유지한다 (${viewport.width}×${viewport.height})`, async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await page.goto("/palworld/pals");
    const filterPanel = page.locator(".palworld-pal-filter-panel");
    const firstCard = page.getByTestId("pal-card").first();
    await expect(filterPanel).toBeVisible();
    await expect(firstCard).toBeVisible();
    await expect(page.getByTestId("pal-filter-trigger")).toBeHidden();

    const [filterPanelBox, firstCardBox, filterGroupBoxes] = await Promise.all([
      filterPanel.boundingBox(),
      firstCard.boundingBox(),
      filterPanel.locator(".palworld-pal-filter-group").evaluateAll((groups) =>
        groups.map((group) => {
          const bounds = group.getBoundingClientRect();
          return { width: bounds.width, x: bounds.x, y: bounds.y };
        })
      ),
    ]);
    expect(filterPanelBox).not.toBeNull();
    expect(firstCardBox).not.toBeNull();
    expect(filterGroupBoxes).toHaveLength(3);
    expect(Math.abs(filterPanelBox!.y - firstCardBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.max(...filterGroupBoxes.map((bounds) => bounds.x))
      - Math.min(...filterGroupBoxes.map((bounds) => bounds.x))).toBeLessThanOrEqual(1);
    expect(filterGroupBoxes[1]!.y).toBeGreaterThan(filterGroupBoxes[0]!.y);
    expect(filterGroupBoxes[2]!.y).toBeGreaterThan(filterGroupBoxes[1]!.y);
    expect(Math.max(...filterGroupBoxes.map((bounds) => bounds.width))
      - Math.min(...filterGroupBoxes.map((bounds) => bounds.width))).toBeLessThanOrEqual(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await assertHealthyDocument(page, errors);
  });
}

test("Pal 도감 API 오류는 결과 없음과 구분하고 동일 query로 재시도한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  let fail = true;
  await page.route("**/api/palworld/pals*", async (route) => {
    if (!fail) {
      await route.fallback();
      return;
    }
    await json(route, { error: "PALWORLD_TEMPORARY_FAILURE", message: "일시적인 오류" }, 503);
  });
  await page.goto("/palworld/pals?element=ground&sort=name");
  await expect(page.getByRole("alert")).toContainText("데이터를 불러오지 못했습니다.");
  await expect(page.getByText("조건에 맞는 Pal이 없습니다.", { exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByTestId("pal-card").filter({ hasText: "아누비스" })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("element")).toBe("ground");
  expect(new URL(page.url()).searchParams.get("sort")).toBe("name");
  expect(errors.some((message) => message.includes("503 (Service Unavailable)"))).toBe(true);
  errors.length = 0;
  await assertHealthyDocument(page, errors);
});

test("Pal·아이템·스킬 목록은 스크롤 시 다음 페이지를 누적하고 추가 오류만 다시 시도한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  const manyPals = Array.from({ length: 50 }, (_, index): PalworldPalSummary => ({
    ...palSummary(pals[index % pals.length]!),
    id: `scroll-pal-${index + 1}`,
    number: index + 1,
    nameKo: `스크롤 Pal ${index + 1}`,
    nameJa: `スクロールパル ${index + 1}`,
    nameEn: `Scroll Pal ${index + 1}`,
  }));
  let failPalPageTwo = true;
  let palPageTwoRequests = 0;
  await page.route("**/api/palworld/pals?*", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("page") === "2") {
      palPageTwoRequests += 1;
      if (failPalPageTwo) {
        await json(route, { error: "PALWORLD_TEMPORARY_FAILURE", message: "일시적인 오류" }, 503);
        return;
      }
    }
    await json(route, {
      ...pageResponse(manyPals, url),
      facets: palListFacets(),
    });
  });

  await page.goto("/palworld/pals");
  await expect(page.getByTestId("pal-card")).toHaveCount(24);
  if (await page.getByTestId("pal-filter-trigger").isVisible()) {
    const firstCard = page.getByTestId("pal-card").nth(0);
    const secondCard = page.getByTestId("pal-card").nth(1);
    const [firstCardBox, secondCardBox, firstImageBox, firstContentBox] = await Promise.all([
      firstCard.boundingBox(),
      secondCard.boundingBox(),
      firstCard.locator(".palworld-pal-card-image-frame").boundingBox(),
      firstCard.locator(".palworld-pal-card-content").boundingBox(),
    ]);
    expect(firstCardBox).not.toBeNull();
    expect(secondCardBox).not.toBeNull();
    expect(firstImageBox).not.toBeNull();
    expect(firstContentBox).not.toBeNull();
    if (firstCardBox && secondCardBox && firstImageBox && firstContentBox) {
      expect(Math.abs(firstCardBox.y - secondCardBox.y)).toBeLessThanOrEqual(1);
      expect(secondCardBox.x).toBeGreaterThan(firstCardBox.x + firstCardBox.width - 1);
      expect(firstImageBox.y + firstImageBox.height).toBeLessThanOrEqual(firstContentBox.y + 1);
    }
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )).toBe(true);
  }
  const palAutoLoad = page.getByTestId("palworld-auto-load");
  await palAutoLoad.scrollIntoViewIfNeeded();
  await expect(palAutoLoad.getByRole("alert")).toContainText("현재까지 불러온 결과는 그대로 유지됩니다.");
  await expect(page.getByTestId("pal-card")).toHaveCount(24);
  failPalPageTwo = false;
  await palAutoLoad.getByRole("button", { name: "다음 결과 다시 불러오기" }).click();
  await expect(page.getByTestId("pal-card")).toHaveCount(48);
  expect(palPageTwoRequests).toBe(2);
  await expect(palAutoLoad).toContainText("결과 48/50개 표시");
  await expect(page.getByRole("button", { name: "이전" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "다음", exact: true })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  expect(errors.some((message) => message.includes("503 (Service Unavailable)"))).toBe(true);
  errors.length = 0;
  await assertHealthyDocument(page, errors);

  const manyItems = Array.from({ length: 30 }, (_, index): PalworldItemSummary => ({
    ...itemSummary(items[index % items.length]!),
    id: `scroll-item-${index + 1}`,
    nameKo: `스크롤 아이템 ${index + 1}`,
    nameJa: `スクロールアイテム ${index + 1}`,
    nameEn: `Scroll Item ${index + 1}`,
  }));
  await page.route("**/api/palworld/items?*", async (route) => {
    const url = new URL(route.request().url());
    await json(route, pageResponse(manyItems, url));
  });
  await page.goto("/palworld/items");
  await expect(page.getByTestId("item-card")).toHaveCount(24);
  await page.getByTestId("palworld-auto-load").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("item-card")).toHaveCount(30);
  await expect(page.getByTestId("palworld-auto-load")).toContainText("모든 결과를 불러왔습니다.");
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await assertHealthyDocument(page, errors);

  const manySkills = Array.from({ length: 30 }, (_, index): PalworldSkillSummary => ({
    ...skillSummary(skills[index % skills.length]!),
    id: `scroll-skill-${index + 1}`,
    nameKo: `스크롤 스킬 ${index + 1}`,
    nameJa: `スクロールスキル ${index + 1}`,
    nameEn: `Scroll Skill ${index + 1}`,
  }));
  await page.route("**/api/palworld/skills?*", async (route) => {
    const url = new URL(route.request().url());
    await json(route, {
      ...pageResponse(manySkills, url),
      facets: skillListFacets(manySkills),
    });
  });
  await page.goto("/palworld/skills");
  await expect(page.locator(".palworld-skill-card")).toHaveCount(24);
  await page.getByTestId("palworld-auto-load").scrollIntoViewIfNeeded();
  await expect(page.locator(".palworld-skill-card")).toHaveCount(30);
  await expect(page.getByTestId("palworld-auto-load")).toContainText("모든 결과를 불러왔습니다.");
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await assertHealthyDocument(page, errors);
});

test("Pal 무한 목록은 page deep-link의 이전·다음 페이지를 복원하고 상세 Modal 동안 자동 로드를 멈춘다", async ({ page }) => {
  const manyPals = Array.from({ length: 50 }, (_, index): PalworldPalSummary => ({
    ...palSummary(pals[index % pals.length]!),
    id: `deep-link-pal-${index + 1}`,
    number: index + 1,
    nameKo: `딥 링크 Pal ${index + 1}`,
    nameJa: `ディープリンクパル ${index + 1}`,
    nameEn: `Deep Link Pal ${index + 1}`,
  }));
  const requestedPages: string[] = [];
  await page.route("**/api/palworld/pals?*", async (route) => {
    const url = new URL(route.request().url());
    requestedPages.push(url.searchParams.get("page") ?? "1");
    await json(route, {
      ...pageResponse(manyPals, url),
      facets: palListFacets(),
    });
  });

  await page.goto("/palworld/pals?page=2");
  await expect(page.getByTestId("pal-card")).toHaveCount(48);
  expect(requestedPages.slice(0, 2)).toEqual(["2", "1"]);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(new URL(page.url()).searchParams.get("page")).toBe("2");

  await page.getByTestId("palworld-auto-load").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("pal-card")).toHaveCount(50);
  expect(requestedPages).toContain("3");
  expect(new URL(page.url()).searchParams.get("page")).toBe("2");

  requestedPages.length = 0;
  await page.goto("/palworld/pals?page=1&pal=anubis");
  await expect(page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "아누비스" })).toBeVisible();
  await page.getByTestId("palworld-auto-load").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  expect(requestedPages).toEqual(["1"]);
  await expect(page.getByTestId("palworld-auto-load")).toContainText("상세 정보를 닫으면 목록 자동 불러오기를 계속합니다.");

  await page.keyboard.press("Escape");
  await page.getByTestId("palworld-auto-load").scrollIntoViewIfNeeded();
  await expect.poll(() => page.getByTestId("pal-card").count()).toBeGreaterThanOrEqual(48);
  expect(requestedPages).toContain("2");
});

test("Pal 상세 농축 단계와 인터랙티브 스폰 지도는 URL·history·키보드 상태를 함께 유지한다", async ({ page }) => {
  const anubis = pals.find((pal) => pal.id === "anubis")!;
  const stageValues = [120, 121, 125, 130, 137] as const;
  const condensationStages = stageValues.map((value, stars) => ({
    stars: stars as 0 | 1 | 2 | 3 | 4,
    characterRank: (stars + 1) as 1 | 2 | 3 | 4 | 5,
    partnerSkillRank: (stars + 1) as 1 | 2 | 3 | 4 | 5,
    stats: [{ stat: "hp" as const, baseValue: 120, value }],
    workSuitabilities: [{
      type: "handiwork" as const,
      baseLevel: 4,
      level: stars === 4 ? 5 : 4,
    }],
  }));
  const detailWithVerifiedFixture = {
    ...anubis,
    condensation: {
      availability: "available" as const,
      sourceRuleSha256: "c".repeat(64),
      stages: condensationStages,
    },
  } satisfies PalworldPalDetail;
  const spawnWithPeriods = {
    ...palSpawnResponse("anubis"),
    totalPlacements: 35,
    points: [
      {
        id: "main-anubis-06-16-day",
        cellX: 6,
        cellY: 16,
        normalizedX: 0.201051551,
        normalizedY: 0.517600865,
        placementCount: 20,
        minimumLevel: 68,
        maximumLevel: 70,
        daytime: true,
        nighttime: false,
      },
      {
        id: "main-anubis-07-16-night",
        cellX: 7,
        cellY: 16,
        normalizedX: 0.231051551,
        normalizedY: 0.517600865,
        placementCount: 15,
        minimumLevel: 70,
        maximumLevel: 72,
        daytime: false,
        nighttime: true,
      },
    ],
  } satisfies PalworldPalSpawnResponse;

  await page.route("**/api/palworld/pals/anubis", async (route) => {
    await json(route, detailWithVerifiedFixture);
  });
  await page.route(/\/api\/palworld\/map\/spawns(?:\?|$)/u, async (route) => {
    await json(route, spawnWithPeriods);
  });

  await page.goto("/palworld/pals?pal=anubis&stars=4");
  const dialog = page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "아누비스" });
  const condensation = dialog.getByTestId("pal-condensation");
  await expect(condensation.getByRole("radio", { name: "농축 4★" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(condensation).toContainText("캐릭터 랭크 5");
  await expect(condensation).toContainText("파트너 스킬 랭크 5");
  await expect(condensation.locator('[data-stat="hp"]')).toContainText("120→137");
  await expect(condensation).toContainText("수작업");
  await expect(condensation).toContainText("Lv.4 → Lv.5");

  await condensation.getByRole("radio", { name: "농축 2★" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("stars")).toBe("2");
  await expect(condensation.locator('[data-stat="hp"]')).toContainText("120→125");
  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get("stars")).toBe("4");
  await expect(condensation.getByRole("radio", { name: "농축 4★" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  const location = dialog.getByTestId("pal-detail-location");
  await location.scrollIntoViewIfNeeded();
  const viewport = location.getByTestId("pal-detail-map-viewport");
  const stage = location.getByTestId("pal-detail-map-stage");
  await expect(location.locator(".palworld-pal-location-spawn-point")).toHaveCount(2);
  const spawnPointStyle = await location
    .locator(".palworld-pal-location-spawn-point")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fill: style.fill,
        opacity: Number(style.opacity),
        stroke: style.stroke,
        strokeWidth: Number.parseFloat(style.strokeWidth),
      };
    });
  expect(spawnPointStyle.fill).not.toBe(spawnPointStyle.stroke);
  expect(spawnPointStyle.opacity).toBeGreaterThanOrEqual(0.96);
  expect(spawnPointStyle.strokeWidth).toBeGreaterThan(0.0035);
  await location.getByRole("button", { name: "야간", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("spawnPeriod")).toBe("night");
  await expect(location.locator(".palworld-pal-location-spawn-point")).toHaveCount(1);
  await location.getByRole("button", { name: "주간", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("spawnPeriod")).toBe("day");
  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get("spawnPeriod")).toBe("night");
  await expect(location.getByRole("button", { name: "야간", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await expect.poll(() => viewport.evaluate((element) =>
    getComputedStyle(element).touchAction
  )).toBe("none");
  await location.getByRole("button", { name: "지도 확대" }).click();
  await expect(viewport).toHaveAttribute("data-zoomed", "true");
  await expect.poll(() => viewport.evaluate((element) =>
    getComputedStyle(element).touchAction
  )).toBe("none");
  const stageStyleBeforeKeyboard = await stage.getAttribute("style");
  await viewport.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => stage.getAttribute("style")).not.toBe(stageStyleBeforeKeyboard);
  await location.getByRole("button", { name: "배율 초기화" }).click();
  await expect(viewport).not.toHaveAttribute("data-zoomed", "true");
  await expect.poll(() => viewport.evaluate((element) =>
    getComputedStyle(element).touchAction
  )).toBe("pan-y");
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
  )).toBe(true);
});

test("Pal 상세 mini-map은 일반 스폰과 필드 보스를 함께 표시하고 confirmed empty를 구분한다", async ({ page }) => {
  await page.goto("/palworld/pals?pal=anubis");
  const anubisDialog = page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "아누비스" });
  await expect(anubisDialog).toBeVisible();

  const location = anubisDialog.getByTestId("pal-detail-location");
  await location.scrollIntoViewIfNeeded();
  await expect(location.getByRole("heading", { name: "출현 위치", level: 4 })).toBeVisible();
  const miniMapImage = location.getByRole("img", { name: "일반 야생 스폰 영역과 필드 보스 위치가 표시된 Palworld 월드 지도" });
  await expect(miniMapImage).toHaveAttribute("src", READY_WORLD_MAP_URL);
  await expect.poll(() => miniMapImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(4096);
  await expect(location.locator(".palworld-pal-location-spawn-point")).toHaveCount(1);
  await expect(location).toContainText("원본 스폰 지점 35개를 지도 영역 1개로 묶어 표시");
  await expect(location).toContainText("레벨 68~72");
  await expect(location.getByText("주간", { exact: true })).toBeVisible();
  await expect(location.getByText("야간", { exact: true })).toBeVisible();
  await expect(location.getByRole("listitem", { name: "필드 보스: 아누비스, Lv.55" })).toBeVisible();
  const previewBox = await location.locator(".palworld-pal-location-preview").boundingBox();
  const sectionBox = await location.boundingBox();
  expect(previewBox).not.toBeNull();
  expect(sectionBox).not.toBeNull();
  if (previewBox && sectionBox) expect(previewBox.width).toBeGreaterThan(sectionBox.width * 0.9);
  await expect.poll(() => location.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await expect(apiRequestUrls.get(page) ?? []).toContain("/api/palworld/map/markers?world=main");
  await expect(apiRequestUrls.get(page) ?? []).toContain("/api/palworld/map/spawns?pal=anubis&world=main");

  await location.getByRole("button", { name: "전체 지도에서 보기" }).click();
  await expect(page).toHaveURL(/\/palworld\/map\?focusPal=anubis$/u);
  await expect(page.getByTestId("pal-detail-modal")).toHaveCount(0);
  await expect(page.getByTestId("palworld-map-image")).toBeVisible();
  const focusedMarker = page.getByRole("button", { name: "필드 보스: 아누비스, Lv.55" });
  await expect(focusedMarker).toHaveAttribute("aria-current", "location");
  await expect(focusedMarker).toHaveAttribute("data-focused", "true");
  await expect(page.getByTestId("palworld-map-viewport")).toHaveAttribute("data-zoomed", "true");

  await page.goBack();
  await expect(page).toHaveURL(/\/palworld\/pals\?pal=anubis$/u);
  const restoredDialog = page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "아누비스" });
  await expect(restoredDialog).toBeVisible();
  await expect(restoredDialog.getByTestId("pal-detail-location")).toContainText("출현 위치");

  await page.goto("/palworld/pals?pal=penking");
  const penkingDialog = page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "펭킹" });
  await expect(penkingDialog).toBeVisible();
  const emptyLocation = penkingDialog.getByTestId("pal-detail-location");
  await expect(emptyLocation.getByRole("status")).toHaveText("현재 지도 데이터에서 확인된 이 Pal의 출현 위치가 없습니다.");
  await expect(emptyLocation.locator(".palworld-pal-location-map-image")).toHaveCount(0);
  await expect(emptyLocation.getByRole("button", { name: "전체 지도에서 보기" })).toBeVisible();
  await expect(emptyLocation).not.toContainText("아누비스");
});

test("Pal 상세 위치 layer는 오류와 retry를 서로 격리하고 focusPal 보스만 표시한다", async ({ page }) => {
  let allowBossResponse = false;
  let bossRequests = 0;
  let spawnRequests = 0;
  const markerResponseWithUnrelated: PalworldMapMarkersResponse = {
    ...mapMarkers,
    markers: [
      ...mapMarkers.markers,
      {
        ...mapMarkers.markers[0]!,
        id: "penking-field-boss",
        sourceRowId: "Penking_FieldBoss",
        sourceInternalId: "PenguinKing",
        pal: {
          ...mapMarkers.markers[0]!.pal,
          id: "penking",
          number: 11,
          nameKo: "펭킹",
          nameJa: "キャプペン",
          nameEn: "Penking",
          elements: ["water", "ice"],
        },
        level: 15,
        normalizedX: 0.25,
        normalizedY: 0.25,
      },
    ],
  };

  await page.route(/\/api\/palworld\/map\/markers(?:\?|$)/u, async (route) => {
    bossRequests += 1;
    if (!allowBossResponse) {
      await route.abort("failed");
      return;
    }
    await json(route, markerResponseWithUnrelated);
  });
  await page.route(/\/api\/palworld\/map\/spawns(?:\?|$)/u, async (route) => {
    spawnRequests += 1;
    const url = new URL(route.request().url());
    await json(route, palSpawnResponse(url.searchParams.get("pal") ?? "missing-pal"));
  });

  await page.goto("/palworld/pals?pal=anubis");
  const location = page
    .getByTestId("pal-detail-modal")
    .getByRole("dialog", { name: "아누비스" })
    .getByTestId("pal-detail-location");
  await expect(location.locator(".palworld-pal-location-spawn-point")).toHaveCount(1);
  await expect(location.getByRole("alert")).toContainText("필드 보스 위치를 불러오지 못했습니다.");
  const spawnRequestsBeforeRetry = spawnRequests;
  const bossRequestsBeforeRetry = bossRequests;
  expect(spawnRequestsBeforeRetry).toBeGreaterThan(0);
  expect(bossRequestsBeforeRetry).toBeGreaterThan(0);

  allowBossResponse = true;
  await location.getByRole("button", { name: "보스 위치 다시 불러오기" }).click();
  await expect(location.getByRole("listitem", { name: "필드 보스: 아누비스, Lv.55" })).toBeVisible();
  expect(spawnRequests).toBe(spawnRequestsBeforeRetry);
  expect(bossRequests).toBeGreaterThan(bossRequestsBeforeRetry);

  await location.getByRole("button", { name: "전체 지도에서 보기" }).click();
  await expect(page).toHaveURL(/\/palworld\/map\?focusPal=anubis$/u);
  await expect(page.getByRole("button", { name: "필드 보스: 아누비스, Lv.55" })).toBeVisible();
  await expect(page.getByRole("button", { name: "필드 보스: 펭킹, Lv.15" })).toHaveCount(0);
});

test("일반 스폰 layer retry는 정상 필드 보스 요청을 다시 실행하지 않는다", async ({ page }) => {
  let allowSpawnResponse = false;
  let bossRequests = 0;
  let spawnRequests = 0;
  await page.route(/\/api\/palworld\/map\/markers(?:\?|$)/u, async (route) => {
    bossRequests += 1;
    await json(route, mapMarkers);
  });
  await page.route(/\/api\/palworld\/map\/spawns(?:\?|$)/u, async (route) => {
    spawnRequests += 1;
    if (!allowSpawnResponse) {
      await route.abort("failed");
      return;
    }
    const url = new URL(route.request().url());
    await json(route, palSpawnResponse(url.searchParams.get("pal") ?? "missing-pal"));
  });

  await page.goto("/palworld/pals?pal=anubis");
  const location = page
    .getByTestId("pal-detail-modal")
    .getByRole("dialog", { name: "아누비스" })
    .getByTestId("pal-detail-location");
  await expect(location.getByRole("listitem", { name: "필드 보스: 아누비스, Lv.55" })).toBeVisible();
  await expect(location.getByRole("alert")).toContainText("일반 야생 스폰 위치를 불러오지 못했습니다.");
  const spawnRequestsBeforeRetry = spawnRequests;
  const bossRequestsBeforeRetry = bossRequests;
  expect(spawnRequestsBeforeRetry).toBeGreaterThan(0);
  expect(bossRequestsBeforeRetry).toBeGreaterThan(0);

  allowSpawnResponse = true;
  await location.getByRole("button", { name: "일반 야생 스폰 다시 불러오기" }).click();
  await expect(location.locator(".palworld-pal-location-spawn-point")).toHaveCount(1);
  expect(spawnRequests).toBeGreaterThan(spawnRequestsBeforeRetry);
  expect(bossRequests).toBe(bossRequestsBeforeRetry);
});

test("일반 스폰과 필드 보스의 data_unavailable 상태는 정상 layer를 숨기지 않는다", async ({ page }) => {
  let bossUnavailable = false;
  let spawnUnavailable = true;
  await page.route(/\/api\/palworld\/map\/markers(?:\?|$)/u, async (route) => {
    await json(route, bossUnavailable
      ? {
          state: "data_unavailable",
          world: "main",
          markers: [],
          metadata,
        } satisfies PalworldMapMarkersResponse
      : mapMarkers);
  });
  await page.route(/\/api\/palworld\/map\/spawns(?:\?|$)/u, async (route) => {
    const url = new URL(route.request().url());
    const palId = url.searchParams.get("pal") ?? "missing-pal";
    await json(route, spawnUnavailable
      ? {
          state: "data_unavailable",
          world: "main",
          palId,
          gridSize: 32,
          totalPlacements: 0,
          points: [],
          metadata,
        } satisfies PalworldPalSpawnResponse
      : palSpawnResponse(palId));
  });

  await page.goto("/palworld/pals?pal=anubis");
  let location = page
    .getByTestId("pal-detail-modal")
    .getByRole("dialog", { name: "아누비스" })
    .getByTestId("pal-detail-location");
  await expect(location.getByRole("listitem", { name: "필드 보스: 아누비스, Lv.55" })).toBeVisible();
  await expect(location.getByText("일반 야생 스폰 위치 데이터가 준비되지 않았습니다.")).toBeVisible();

  spawnUnavailable = false;
  bossUnavailable = true;
  await page.reload();
  location = page
    .getByTestId("pal-detail-modal")
    .getByRole("dialog", { name: "아누비스" })
    .getByTestId("pal-detail-location");
  await expect(location.locator(".palworld-pal-location-spawn-point")).toHaveCount(1);
  await expect(location.getByText("필드 보스 위치 데이터가 준비되지 않았습니다.")).toBeVisible();
});

test("underscore 아이템 ID의 직접 URL로 아이템 상세 Modal을 연다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld/items?rarity=0");
  await expect(page.getByRole("button", { name: "레어도 일반 선택", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/palworld/items?item=pal_sphere");

  await expect(page.getByTestId("header-search")).toBeVisible();
  const dialog = page.getByTestId("item-detail-modal").getByRole("dialog", { name: "Pal 스피어" });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText("パルスフィア");
  await expect(dialog.getByText("pal-sphere", { exact: true })).toBeVisible();
  await expect(page.getByTestId("palworld-items-coverage")).toHaveCount(0);
  await expect(apiRequestUrls.get(page) ?? []).toContain("/api/palworld/items/pal_sphere");
  const itemImage = dialog.getByRole("img", { name: "Pal 스피어" });
  await expect(itemImage).toHaveAttribute("src", READY_ITEM_IMAGE_URL);
  await expect(itemImage).toHaveAttribute("width", "256");
  await expect(itemImage).toHaveAttribute("height", "256");
  await expect(itemImage).toHaveAttribute("loading", "eager");
  await expect(page.getByText("응답 데이터 버전이 서로 다릅니다. 새로고침해 주세요.")).toHaveCount(0);
  await assertHealthyDocument(page, errors);
});

test("아이템 상세의 관련 Pal 링크는 이미지와 fallback을 유지하며 Pal 상세로 이동한다", async ({ page }) => {
  await page.goto("/palworld/items?item=ancient-technology-parts");

  const itemDialog = page.getByTestId("item-detail-modal").getByRole("dialog", { name: "고대 문명의 부품" });
  const relatedPal = itemDialog.locator(".palworld-related-pal-link").filter({ hasText: "아누비스" });
  await expect(relatedPal).toBeVisible();
  await expect(relatedPal.getByRole("img", { name: "아누비스 · 이미지 준비 중" })).toBeVisible();
  await relatedPal.click();
  await expect(page).toHaveURL(/\/palworld\/pals\?pal=anubis/u);
  await expect(page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "아누비스" })).toBeVisible();
});

test("스킬 경로는 필터·현지화 번역·속성 아이콘·상세·관련 Pal과 history를 지원한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld/skills?type=active&element=ground&sort=power&order=desc");

  await expect(page.getByTestId("header-search")).toBeVisible();
  await expect(page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "스킬" })).toHaveAttribute("aria-current", "page");
  const skillTypeTabs = page.getByRole("navigation", { name: "스킬 종류" });
  await expect(skillTypeTabs.getByRole("button", { name: "액티브 스킬" })).toHaveAttribute("aria-pressed", "true");
  await expect(skillTypeTabs.getByRole("button", { name: "패시브 스킬" })).toHaveAttribute("aria-pressed", "false");
  await expect(skillTypeTabs.getByRole("button", { name: "파트너 스킬" })).toHaveAttribute("aria-pressed", "false");
  const elementFilters = page.getByRole("group", { name: "속성" });
  await expect(elementFilters.getByRole("button", { name: "땅 속성 스킬로 필터" })).toHaveAttribute("aria-pressed", "true");
  await expect(elementFilters.getByRole("button", { name: "땅 속성 스킬로 필터" }).locator(".palworld-element-icon")).toHaveCount(1);
  await page.getByText("정렬 필터", { exact: true }).click();
  await expect(page.getByRole("combobox", { name: "정렬", exact: true })).toHaveValue("power");
  await expect(page.getByRole("combobox", { name: "정렬 방향", exact: true })).toHaveValue("desc");
  await expect(page.getByTestId("palworld-skills-coverage")).toHaveCount(0);
  const translationReviewNotice = page.locator(".palworld-translation-review-notice");
  await expect(translationReviewNotice).toHaveCount(1);
  await expect(translationReviewNotice).toContainText("일부 이름과 설명은 자동 번역 후 검수 중입니다.");

  const skillCard = page.locator(".palworld-skill-card").filter({ hasText: "스톤 샷" });
  await expect(skillCard).toBeVisible();
  await expect(skillCard).not.toContainText("번역 검수 중");
  await expect(skillCard).not.toContainText("영문 원문");
  await expect(skillCard).toContainText("위력 30");
  await expect(skillCard.locator(".palworld-element-icon")).toHaveCount(1);
  await expect.poll(() => skillCard.locator(".palworld-skill-description").evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.whiteSpace, style.overflow, style.textOverflow];
  })).toEqual(["nowrap", "hidden", "ellipsis"]);
  const relatedPalPreview = skillCard.getByRole("group", { name: "관련 Pal" });
  await expect(relatedPalPreview).toBeVisible();
  await expect(relatedPalPreview.locator(".palworld-skill-related-preview-media")).toHaveCount(1);
  await expect(relatedPalPreview.getByRole("img", { name: /아누비스/u })).toBeVisible();
  await expect(relatedPalPreview.locator(".palworld-skill-related-preview-more")).toHaveCount(0);
  await expect.poll(() => relatedPalPreview.evaluate((element) =>
    element.scrollWidth <= element.clientWidth
  )).toBe(true);
  await skillCard.getByRole("button", { name: "스킬 상세 보기" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("skill")).toBe("active-ground-stone-blast-30-2");
  const dialog = page.getByTestId("skill-detail-modal").getByRole("dialog", { name: "스톤 샷" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".palworld-translation-review-notice")).toHaveCount(1);
  await expect(dialog).toContainText("고속 바위 탄환을 적에게 발사합니다.");
  await expect(dialog).toContainText("아누비스");
  await expect(apiRequestUrls.get(page) ?? []).toContain("/api/palworld/skills/active-ground-stone-blast-30-2");

  await dialog.getByRole("button", { name: /아누비스/u }).click();
  await expect(page).toHaveURL(/\/palworld\/pals\?pal=anubis/u);
  await expect(page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "아누비스" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/palworld\/skills\?.*skill=active-ground-stone-blast-30-2/u);
  await expect(page.getByTestId("skill-detail-modal").getByRole("dialog", { name: "스톤 샷" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect.poll(() => new URL(page.url()).searchParams.has("skill")).toBe(false);

  await skillTypeTabs.getByRole("button", { name: "패시브 스킬" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("type")).toBe("passive");
  await expect.poll(() => new URL(page.url()).searchParams.has("element")).toBe(false);
  const passiveTierFilters = page.getByRole("group", { name: "패시브 등급" });
  await expect(page.getByRole("group", { name: "효과" })).toBeVisible();
  await passiveTierFilters.getByRole("button", { name: "패시브 등급 +2로 필터" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("passiveTier")).toBe("2");

  await skillTypeTabs.getByRole("button", { name: "파트너 스킬" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("type")).toBe("partner");
  await expect.poll(() => new URL(page.url()).searchParams.has("passiveTier")).toBe(false);
  await page.getByRole("group", { name: "속성" }).getByRole("button", { name: "땅 속성 스킬로 필터" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("partnerElement")).toBe("ground");

  await skillTypeTabs.getByRole("button", { name: "액티브 스킬" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has("partnerElement")).toBe(false);
  await page.getByRole("group", { name: "속성" }).getByRole("button", { name: "땅 속성 스킬로 필터" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("element")).toBe("ground");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Palworld 스킬", level: 1 })).toBeVisible();
  await selectPublicLocale(page, "ja");
  await expect(page.getByRole("heading", { name: "Palworld スキル", level: 1 })).toBeVisible();
  await expect(translationReviewNotice).toContainText(
    "一部の名称と説明は自動翻訳後の確認中です。",
  );
  await expect(page.locator(".palworld-skill-card").filter({ hasText: "ストーンショット" })).not.toContainText(
    "翻訳確認中",
  );
  await page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "アイテム" }).click();
  await expect(page).toHaveURL(/\/palworld\/items/u);
  await page.goBack();
  await expect(page).toHaveURL(/\/palworld\/skills/u);
  await expect(page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "スキル" })).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(page).toHaveURL(/\/palworld\/items/u);
  await assertHealthyDocument(page, errors);
});

test("부모 Pal 자동완성으로 일반 교배 결과를 조회하고 URL과 부모 위치를 교환한다", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          window.sessionStorage.setItem("copiedBreedingUrl", value);
        },
      },
    });
  });
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld/breeding");

  await expect(page.getByTestId("palworld-breeding-coverage")).toHaveCount(0);

  const parentA = page.getByTestId("breeding-parent-a");
  const parentB = page.getByTestId("breeding-parent-b");
  const parentASearch = parentA.getByRole("searchbox");
  await parentASearch.fill("펭킹");
  const parentAOption = parentA.getByRole("option", { name: /펭킹/u });
  await expect(parentAOption).toBeVisible();
  await parentASearch.press("ArrowDown");
  await expect(parentASearch).toHaveAttribute("aria-activedescendant", await parentAOption.getAttribute("id") ?? "");
  await expect(parentAOption).toHaveAttribute("aria-selected", "true");
  await parentASearch.press("Enter");
  const parentImage = parentA.getByRole("img", { name: "펭킹" });
  await expect(parentImage).toBeVisible();
  await expect(parentImage).toHaveAttribute("src", READY_PAL_IMAGE_URL);
  await expect.poll(() => parentImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await parentB.getByRole("searchbox").fill("불무사");
  await parentB.getByRole("option", { name: /불무사/u }).click();

  const result = page.getByTestId("breeding-result");
  await expect(result).toContainText("일반 교배");
  await expect(result).toContainText("실키누");
  await expect(result.getByTestId("breeding-direct-card").locator(".palworld-direct-result-hero")).toBeVisible();
  await expect(page.getByRole("button", { name: "성별 조건 설정" })).toBeVisible();
  await expect(page.getByLabel("부모 1 성별")).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.get("parentA")).toBe("penking");
  await expect.poll(() => new URL(page.url()).searchParams.get("parentB")).toBe("bushi");

  await parentA.getByRole("button", { name: "부모 Pal 상세 보기: 펭킹" }).click();
  await expect(page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "펭킹" })).toBeVisible();
  await page.keyboard.press("Escape");
  await result.getByRole("button", { name: "결과 Pal 상세 보기: 실키누" }).click();
  await expect(page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "실키누" })).toBeVisible();
  await page.keyboard.press("Escape");

  await result.getByRole("button", { name: "링크 복사" }).click();
  await expect(result.locator(".palworld-copy-feedback")).toHaveText("링크가 복사되었습니다.");
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("copiedBreedingUrl"))).toContain("parentA=penking");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("clipboard blocked");
        },
      },
    });
  });
  await result.getByRole("button", { name: "링크 복사" }).click();
  await expect(result.locator(".palworld-copy-feedback")).toHaveText("링크를 복사하지 못했습니다.");

  await page.getByTestId("breeding-swap").click();
  await expect(parentA).toContainText("불무사");
  await expect(parentB).toContainText("펭킹");
  await expect.poll(() => new URL(page.url()).searchParams.get("parentA")).toBe("bushi");
  await expect.poll(() => new URL(page.url()).searchParams.get("parentB")).toBe("penking");
  await expect.poll(() => (apiRequestUrls.get(page) ?? []).some((requestUrl) => {
    const url = new URL(requestUrl, "https://fixture.invalid");
    return url.pathname === "/api/palworld/breeding"
      && url.searchParams.get("parentA") === "bushi"
      && url.searchParams.get("parentB") === "penking";
  })).toBe(true);

  await page.reload();
  await expect(parentA).toContainText("불무사");
  await expect(parentB).toContainText("펭킹");
  await expect(result).toContainText("실키누");
  await page.goBack();
  await expect(parentA).toContainText("펭킹");
  await expect(parentB).toContainText("불무사");
  await page.goForward();
  await expect(parentA).toContainText("불무사");
  await expect(parentB).toContainText("펭킹");

  await result.getByRole("button", { name: "이 Pal의 부모 조합 보기" }).click();
  await expect(page).toHaveURL(/mode=child.*child=sibelyx/u);
  await expect(page.getByTestId("breeding-target-summary")).toContainText("실키누");
  await expect(page.getByTestId("breeding-reverse-pair").getByRole("button", { name: "계산기에 넣기" })).toHaveCount(0);
  await assertHealthyDocument(page, errors);
});

test("부모 Pal 한 마리만 선택하면 가능한 상대와 결과 목록을 버튼 없이 표시한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld/breeding?mode=parents&parentA=penking");

  const partnerResults = page.getByTestId("breeding-partner-results");
  await expect(partnerResults).toContainText("선택한 부모의 교배 조합");
  await expect(partnerResults.locator(".palworld-section-title")).toHaveCount(0);
  await expect(partnerResults.getByText("다른 부모와 결과 Pal을 확인하고 원하는 조합을 계산기에 넣을 수 있습니다.", { exact: true })).toHaveCount(0);
  await expect(partnerResults.getByTestId("breeding-partner-pair")).toHaveCount(1);
  await expect(partnerResults).toContainText("펭킹");
  await expect(partnerResults).toContainText("불무사");
  await expect(partnerResults).toContainText("실키누");
  await expect(page.getByTestId("breeding-direct-card")).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).searchParams.has("parentB")).toBe(false);

  await expect(partnerResults.getByRole("button", { name: "계산기에 넣기" })).toHaveCount(0);
  await assertHealthyDocument(page, errors);
});

test("교배 모드 탭은 키보드 이동과 query 정리를 지원한다", async ({ page }) => {
  await page.goto("/palworld/breeding?mode=parents&parentA=penking&parentB=bushi");
  const directTab = page.getByRole("tab", { name: "부모로 결과 찾기" });
  const reverseTab = page.getByRole("tab", { name: "목표 Pal의 부모 찾기" });

  await directTab.focus();
  await directTab.press("Home");
  await expect.poll(() => new URL(page.url()).searchParams.get("parentA")).toBe("penking");
  await directTab.press("ArrowRight");
  await expect(reverseTab).toBeFocused();
  await expect(reverseTab).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => new URL(page.url()).searchParams.get("mode")).toBe("child");
  await expect.poll(() => new URL(page.url()).searchParams.has("parentA")).toBe(false);

  await reverseTab.press("Home");
  await expect(directTab).toBeFocused();
  await expect(directTab).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => new URL(page.url()).searchParams.get("mode")).toBe("parents");
});

test("성별 조건이 필요한 교배는 대안을 한 번에 적용하고 부모 교환 시 조건도 교환한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld/breeding?mode=parents&parentA=katress&parentB=wixen");

  const result = page.getByTestId("breeding-result");
  await expect(result).toContainText("성별 조건을 선택해야 결과를 확정할 수 있습니다.");
  await expect(page.getByRole("button", { name: "성별 조건 접기" })).toBeVisible();
  const applyConditionButtons = result.getByRole("button", { name: /^이 조건 적용:/u });
  await expect(applyConditionButtons).toHaveCount(2);
  await expect(result).toContainText("캐티위자드");

  await applyConditionButtons.first().click();
  await expect.poll(() => new URL(page.url()).searchParams.get("parentAGender")).toBe("female");
  await expect.poll(() => new URL(page.url()).searchParams.get("parentBGender")).toBe("male");
  await expect(result.getByTestId("breeding-direct-card")).toContainText("캐티위자드");

  await page.getByTestId("breeding-swap").click();
  await expect.poll(() => new URL(page.url()).searchParams.get("parentA")).toBe("wixen");
  await expect.poll(() => new URL(page.url()).searchParams.get("parentB")).toBe("katress");
  await expect.poll(() => new URL(page.url()).searchParams.get("parentAGender")).toBe("male");
  await expect.poll(() => new URL(page.url()).searchParams.get("parentBGender")).toBe("female");
  await expect(result.getByTestId("breeding-direct-card")).toContainText("캐티위자드");
  await assertHealthyDocument(page, errors);
});

test("동일한 부모 Pal 두 마리도 자동 계산 결과를 표시한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld/breeding?mode=parents&parentA=penking&parentB=penking");

  const directCard = page.getByTestId("breeding-direct-card");
  await expect(directCard).toContainText("일반 교배");
  await expect(directCard.locator(".palworld-direct-result-hero")).toContainText("펭킹");
  await expect.poll(() => new URL(page.url()).searchParams.get("parentA")).toBe("penking");
  await expect.poll(() => new URL(page.url()).searchParams.get("parentB")).toBe("penking");
  await assertHealthyDocument(page, errors);
});

test("목표 Pal 부모 역검색은 직접 URL과 새로고침에서 선택과 결과를 복원한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld/breeding?mode=child&child=sibelyx&page=1");

  await expect(page.getByRole("tab", { name: "목표 Pal의 부모 찾기" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("breeding-target").getByRole("button", { name: "다른 목표 Pal 선택" })).toBeVisible();
  const results = page.getByTestId("breeding-parent-results");
  const pair = page.getByTestId("breeding-reverse-pair");
  await expect(page.getByTestId("breeding-target-summary")).toContainText("실키누");
  await expect(results.getByText("실키누", { exact: true })).toHaveCount(1);
  await expect(page.getByTestId("breeding-target-summary")).toContainText("총 1개 조합");
  await expect(page.getByTestId("breeding-target-summary")).toContainText("1/1개 조합 표시");
  await expect(results).toContainText("펭킹");
  await expect(results).toContainText("불무사");
  await expect(results).toContainText("실키누");
  await expect(pair).not.toContainText("실키누");

  await page.reload();
  await expect(page).toHaveURL(/mode=child.*child=sibelyx.*page=1/u);
  await expect(page.getByTestId("breeding-target-summary")).toContainText("실키누");
  await expect(results).toContainText("펭킹");

  await page.getByLabel("교배 종류").selectOption("special");
  await expect.poll(() => new URL(page.url()).searchParams.get("type")).toBe("special");
  await expect(results).toContainText("등록된 부모 조합이 없습니다.");
  await expect(page.getByTestId("breeding-target-summary")).toContainText("총 0개 조합");
  await expect(page.getByTestId("breeding-target-summary")).not.toContainText("1/0개 조합 표시");
  await page.getByLabel("교배 종류").selectOption("normal");
  await expect.poll(() => new URL(page.url()).searchParams.get("type")).toBe("normal");
  await expect(pair).toContainText("펭킹");

  await page.goto("/palworld/breeding?mode=child&child=sibelyx&page=999");
  await expect.poll(() => new URL(page.url()).searchParams.has("page")).toBe(false);
  await expect(page.getByTestId("breeding-target-summary")).toContainText("1/1개 조합 표시");
  await assertHealthyDocument(page, errors);
});

test("목표 Pal 역검색은 스크롤 위치에서 다음 조합을 자동으로 누적한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld/breeding?mode=child&child=katress-ignis");

  const summary = page.getByTestId("breeding-target-summary");
  await expect(summary).toContainText("총 13개 조합");
  await expect(summary).toContainText("12/13개 조합 표시");
  await expect(page.getByTestId("breeding-reverse-pair")).toHaveCount(12);

  await page.getByTestId("palworld-auto-load").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("breeding-reverse-pair")).toHaveCount(13);
  await expect(summary).toContainText("13/13개 조합 표시");
  await expect(page.getByTestId("palworld-auto-load")).toContainText("모든 결과를 불러왔습니다.");
  await expect.poll(() => new URL(page.url()).searchParams.has("page")).toBe(false);
  await page.getByTestId("breeding-reverse-pair").first().locator(".palworld-breeding-pal-button").first().click();
  await expect(page.getByTestId("pal-detail-modal").getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("breeding-reverse-pair")).toHaveCount(13);
  await assertHealthyDocument(page, errors);
});

const breedingResponsiveViewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 790, height: 844 },
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
  { width: 1440, height: 1000 },
];

for (const viewport of breedingResponsiveViewports) {
  test(`교배 직접 결과와 한쪽 부모 조합은 수평 overflow 없이 표시된다 (${viewport.width}×${viewport.height})`, async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.setViewportSize(viewport);
    await page.goto("/palworld/breeding?mode=parents&parentA=penking&parentB=bushi");
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveCount(2);
    const [directTabBounds, reverseTabBounds] = await Promise.all([
      tabs.nth(0).boundingBox(),
      tabs.nth(1).boundingBox(),
    ]);
    expect(directTabBounds).not.toBeNull();
    expect(reverseTabBounds).not.toBeNull();
    expect(Math.abs(directTabBounds!.y - reverseTabBounds!.y)).toBeLessThanOrEqual(2);
    expect(reverseTabBounds!.x + reverseTabBounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    await expect(page.getByTestId("breeding-direct-card").locator(".palworld-direct-result-hero")).toBeVisible();
    await assertHealthyDocument(page, errors);

    await page.goto("/palworld/breeding?mode=parents&parentA=penking");
    const partnerResults = page.getByTestId("breeding-partner-results");
    const partnerTable = partnerResults.getByRole("table", { name: "선택한 부모의 교배 조합" });
    const partnerRow = page.getByTestId("breeding-partner-pair").first();
    await expect(partnerTable).toBeVisible();
    await expect(partnerResults).toContainText("가능한 조합 1개");
    await expect(partnerResults).toContainText("현재 1/1개 표시");
    await expect(partnerRow.locator(":scope > [role='cell']")).toHaveCount(3);
    if (viewport.width <= 768) {
      const parentCells = partnerRow.locator(":scope > .palworld-breeding-combination-cell.is-pal");
      const resultCell = partnerRow.locator(":scope > .palworld-breeding-combination-result");
      const [firstParentBounds, secondParentBounds, resultBounds] = await Promise.all([
        parentCells.nth(0).boundingBox(),
        parentCells.nth(1).boundingBox(),
        resultCell.boundingBox(),
      ]);
      expect(firstParentBounds).not.toBeNull();
      expect(secondParentBounds).not.toBeNull();
      expect(resultBounds).not.toBeNull();
      expect(secondParentBounds!.x).toBeGreaterThan(firstParentBounds!.x);
      expect(resultBounds!.x).toBeGreaterThan(secondParentBounds!.x);
      expect(Math.abs(resultBounds!.y - firstParentBounds!.y)).toBeLessThanOrEqual(1);
    } else {
      const headers = partnerTable.getByRole("columnheader");
      const cells = partnerRow.locator(":scope > [role='cell']");
      for (let index = 0; index < 3; index += 1) {
        const [headerBounds, cellBounds] = await Promise.all([
          headers.nth(index).boundingBox(),
          cells.nth(index).boundingBox(),
        ]);
        expect(headerBounds).not.toBeNull();
        expect(cellBounds).not.toBeNull();
        expect(Math.abs(headerBounds!.x - cellBounds!.x)).toBeLessThanOrEqual(1);
      }
    }
    await assertHealthyDocument(page, errors);
  });
}

test("교배 역검색 고밀도 조합은 요구 화면 크기에서 열 너비와 수평 overflow를 유지한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);

  for (const viewport of breedingResponsiveViewports) {
    await page.setViewportSize(viewport);
    await page.goto("/palworld/breeding?mode=child&child=sibelyx");
    await expect(page.getByTestId("breeding-target-summary")).toBeVisible();
    const reverseRow = page.getByTestId("breeding-reverse-pair").first();
    const reverseCells = reverseRow.locator(":scope > [role='cell']");
    await expect(reverseRow).toBeVisible();
    await expect(reverseCells).toHaveCount(3);
    const [reverseParentA, reverseParentB, reverseCondition] = await Promise.all([
      reverseCells.nth(0).boundingBox(),
      reverseCells.nth(1).boundingBox(),
      reverseCells.nth(2).boundingBox(),
    ]);
    expect(reverseParentA).not.toBeNull();
    expect(reverseParentB).not.toBeNull();
    expect(reverseCondition).not.toBeNull();
    expect(Math.abs(reverseParentA!.width - reverseParentB!.width)).toBeLessThanOrEqual(1);
    expect(reverseCondition!.width).toBeLessThan(reverseParentA!.width);
    await assertHealthyDocument(page, errors);
  }
});

test("교배 API 장애와 정상적인 결과 없음을 서로 다른 상태로 표시한다", async ({ page }) => {
  const directPattern = "**/api/palworld/breeding?*";
  const unavailableHandler = async (route: Route) => {
    await json(route, {
      error: "PALWORLD_DATA_UNAVAILABLE",
      message: "Palworld 데이터를 사용할 수 없습니다.",
    }, 503);
  };
  await page.route(directPattern, unavailableHandler);
  await page.goto("/palworld/breeding?mode=parents&parentA=penking&parentB=bushi");

  const result = page.getByTestId("breeding-result");
  await expect(result.getByRole("alert")).toContainText("교배 데이터를 사용할 수 없습니다.");
  await expect(result).not.toContainText("지원되는 교배 결과가 없습니다.");

  await page.unroute(directPattern, unavailableHandler);
  await page.goto("/palworld/breeding?mode=parents&parentA=penking&parentB=anubis");
  await expect(result).toContainText("지원되는 교배 결과가 없습니다.");
  await expect(result.getByRole("alert")).toHaveCount(0);
});

test("교배 Pal 검색 장애는 빈 결과로 숨기지 않고 재시도할 수 있다", async ({ page }) => {
  const searchPattern = "**/api/palworld/search?*";
  const unavailableHandler = async (route: Route) => {
    await json(route, {
      error: "PALWORLD_DATA_UNAVAILABLE",
      message: "Palworld 데이터를 사용할 수 없습니다.",
    }, 503);
  };
  await page.route(searchPattern, unavailableHandler);
  await page.goto("/palworld/breeding");

  const parent = page.getByTestId("breeding-parent-a");
  await parent.getByRole("searchbox").fill("펭킹");
  await expect(parent.getByRole("alert")).toContainText("Palworld 데이터를 사용할 수 없어 검색할 수 없습니다.");
  await expect(parent).not.toContainText("검색 결과가 없습니다.");

  await page.unroute(searchPattern, unavailableHandler);
  await parent.getByRole("button", { name: "다시 시도" }).click();
  await expect(parent.getByRole("option", { name: /펭킹/u })).toBeVisible();
});

test("Pal 이미지 404는 페이지 오류 없이 접근 가능한 fallback으로 전환한다", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route(`**${READY_PAL_IMAGE_URL}`, async (route) => {
    await route.fulfill({ status: 404, body: "" });
  });
  await page.goto("/palworld/pals?q=펭킹");

  const card = page.getByTestId("pal-card").filter({ hasText: "펭킹" });
  await expect(card).toBeVisible();
  await expect(card.locator(".palworld-media-image")).toHaveCount(0);
  await expect(card.getByRole("img", { name: "펭킹 · 이미지 준비 중" })).toBeVisible();
  await card.getByRole("button", { name: "Pal 상세 보기" }).click();
  const dialog = page.getByTestId("pal-detail-modal").getByRole("dialog", { name: "펭킹" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".palworld-media-image")).toHaveCount(0);
  await expect(dialog.getByRole("img", { name: "펭킹 · 이미지 준비 중" })).toBeVisible();
  await expect(pageErrors).toEqual([]);
});

test("작업 적성 이미지 404는 해당 아이콘만 SVG fallback으로 바꾸고 이름과 레벨을 유지한다", async ({ page }) => {
  await page.route("**/images/palworld/*/work/*.webp", async (route) => {
    await route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
  });
  await page.goto("/palworld/pals?element=ground&work=mining");

  const anubisCard = page.getByTestId("pal-card").filter({ hasText: "아누비스" });
  await expect(anubisCard).toBeVisible();
  const mobileFilterTrigger = page.getByTestId("pal-filter-trigger");
  const mobileFilters = await mobileFilterTrigger.isVisible();
  if (mobileFilters) await mobileFilterTrigger.click();
  const filterSurface = mobileFilters ? page.getByRole("dialog", { name: "상세 필터" }) : page;
  if (mobileFilters) await expect(filterSurface).toBeVisible();
  const miningFilter = filterSurface
    .getByRole("group", { name: "작업 적성" })
    .getByRole("button", { name: /채굴/u });
  await expect(miningFilter.locator(".palworld-pal-filter-work-icon")).toHaveCount(0);
  await expect(miningFilter).toContainText("채굴");
  if (mobileFilters) await page.keyboard.press("Escape");

  await expect(anubisCard.locator(".palworld-work-suitability-icon.is-source-image")).toHaveCount(0);
  await expect(anubisCard.locator(".palworld-work-suitability-badge.has-no-icon")).toHaveCount(2);
  await expect(anubisCard.locator(".palworld-work-suitability-label.yoro-u-sr-only")).toHaveCount(0);
  await expect(anubisCard.locator('[data-work-type="handiwork"]')).toContainText("수작업");
  await expect(anubisCard.locator('[data-work-type="handiwork"]')).toContainText("Lv.4");
  await expect(anubisCard.locator('[data-work-type="mining"]')).toContainText("채굴");
  await expect(anubisCard.locator('[data-work-type="mining"]')).toContainText("Lv.3");
});

test("통합 검색은 한국어와 일본어 이름 결과를 표시한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto(`/palworld/search?q=${encodeURIComponent("아누비스")}`);

  await expect(page.getByRole("heading", { name: "아누비스", level: 1 })).toBeVisible();
  await expect(page.getByTestId("pal-card").filter({ hasText: "아누비스" })).toBeVisible();

  await selectPublicLocale(page, "ja");
  const headerSearch = page.getByTestId("header-search").getByRole("searchbox");
  await headerSearch.fill("パルスフィア");
  await headerSearch.press("Enter");

  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("パルスフィア");
  await expect(page.getByRole("heading", { name: "パルスフィア", level: 1 })).toBeVisible();
  await expect(page.getByTestId("item-card").filter({ hasText: "パルスフィア" })).toBeVisible();
  await expect(page.getByTestId("palworld-items-coverage")).toHaveCount(0);
  await expect(page.getByText("応答データのバージョンが一致しません。更新してください。")).toHaveCount(0);
  await assertHealthyDocument(page, errors);
});

test("PC 화면에서 모든 펠월드 페이지 본문을 중앙 정렬한다", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const routes = [
    "/palworld",
    "/palworld/pals",
    "/palworld/breeding",
    "/palworld/items",
    "/palworld/technology",
    "/palworld/skills",
    "/palworld/map",
    `/palworld/search?q=${encodeURIComponent("아누비스")}`,
  ];

  for (const route of routes) {
    await page.goto(route);
    const main = page.locator(".palworld-main");
    await expect(main).toBeVisible();
    const bounds = await main.boundingBox();
    expect(bounds, `${route} 본문 영역을 측정할 수 있어야 합니다.`).not.toBeNull();
    const viewportCenter = (page.viewportSize()?.width ?? 0) / 2;
    const mainCenter = bounds!.x + (bounds!.width / 2);
    expect(Math.abs(mainCenter - viewportCenter), `${route} 본문 중심이 viewport 중심과 일치해야 합니다.`).toBeLessThanOrEqual(1);
  }
});

test("모든 Palworld 공개 경로 하단에 한국어·일본어 비공식 출처 공지를 표시한다", async ({ page }) => {
  const routes = [
    "/palworld",
    "/palworld/pals",
    "/palworld/breeding",
    "/palworld/items",
    "/palworld/technology",
    "/palworld/skills",
    "/palworld/map",
    `/palworld/search?q=${encodeURIComponent("아누비스")}`,
  ];

  for (const route of routes) {
    await page.goto(route);
    const koreanFooter = page.getByTestId("palworld-source-footer");
    await expect(koreanFooter).toBeVisible();
    await expect(koreanFooter.locator("p")).toHaveText(PALWORLD_PUBLIC_NOTICE_KO);
    await expect(koreanFooter.locator("p")).toHaveAttribute("data-ko", PALWORLD_PUBLIC_NOTICE_KO);
    await expect(koreanFooter.locator("p")).toHaveAttribute("data-ja", PALWORLD_PUBLIC_NOTICE_JA);
    await expect(koreanFooter.locator("a")).toHaveCount(2);
    await expect.poll(() => koreanFooter.evaluate((footer) => window.getComputedStyle(footer).position)).toBe("static");
    await expect(koreanFooter.getByRole("link", { name: /Palworld · 외부 사이트, 새 창에서 열기/u })).toHaveAttribute("target", "_blank");
    await expect(koreanFooter.getByRole("link", { name: /Pocketpair · 외부 사이트, 새 창에서 열기/u })).toHaveAttribute("rel", "noopener noreferrer");

    await selectPublicLocale(page, "ja");
    const japaneseFooter = page.getByTestId("palworld-source-footer");
    await expect(japaneseFooter.locator("p")).toHaveText(PALWORLD_PUBLIC_NOTICE_JA);
    await expect(japaneseFooter.getByRole("link", { name: /Palworld · 外部サイト、新しいタブで開く/u })).toBeVisible();
  }
});

test("월드 지도 메뉴는 직접 URL·확대·초기화·뒤로 가기와 일본어를 지원한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  const isMobileViewport = (page.viewportSize()?.width ?? 0) <= 768;
  await page.goto("/palworld/items");
  await page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "지도" }).click();

  await expect(page).toHaveURL(/\/palworld\/map(?:\?.*)?$/u);
  await expect(page.getByTestId("header-search")).toBeVisible();
  await expect(page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "지도" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Palworld 월드 지도", level: 1 })).toHaveClass(/yoro-u-sr-only/u);
  await expect(page.locator(".palworld-map-page > .palworld-page-heading")).toHaveCount(0);
  const mapImage = page.getByTestId("palworld-map-image");
  await expect(mapImage).toBeVisible();
  await expect(mapImage).toHaveAttribute("src", READY_WORLD_MAP_URL);
  await expect.poll(() => mapImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(4096);
  const viewport = page.getByTestId("palworld-map-viewport");
  await expect.poll(() => viewport.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

  await page.getByRole("button", { name: "지도 확대" }).click();
  const mapControls = viewport.locator(":scope > .palworld-map-controls");
  const zoomInButton = mapControls.getByRole("button", { name: "지도 확대" });
  const zoomOutButton = mapControls.getByRole("button", { name: "지도 축소" });
  const zoomResetButton = mapControls.getByRole("button", { name: "배율 초기화" });
  const zoomOutput = mapControls.locator(".palworld-map-zoom-output");
  if (isMobileViewport) {
    await expect(zoomOutput).toBeHidden();
    await expect(zoomResetButton).toBeHidden();
    const [viewportBounds, controlsBounds, zoomInBounds, zoomOutBounds] = await Promise.all([
      viewport.boundingBox(),
      mapControls.boundingBox(),
      zoomInButton.boundingBox(),
      zoomOutButton.boundingBox(),
    ]);
    expect(viewportBounds).not.toBeNull();
    expect(controlsBounds).not.toBeNull();
    expect(zoomInBounds).not.toBeNull();
    expect(zoomOutBounds).not.toBeNull();
    expect(controlsBounds!.y).toBeLessThan(viewportBounds!.y + (viewportBounds!.height * 0.25));
    expect(Math.abs(controlsBounds!.x + controlsBounds!.width - viewportBounds!.x - viewportBounds!.width))
      .toBeLessThanOrEqual(16);
    expect(zoomInBounds!.y).toBeLessThan(zoomOutBounds!.y);
  } else {
    await expect(zoomOutput).toHaveText("150%");
    await expect(zoomResetButton).toBeVisible();
  }
  await expect.poll(() => viewport.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  const mapStage = page.getByTestId("palworld-map-stage");
  const transformBeforeDrag = await mapStage.evaluate((element) => window.getComputedStyle(element).transform);
  await viewport.scrollIntoViewIfNeeded();
  const viewportBounds = await viewport.boundingBox();
  expect(viewportBounds).not.toBeNull();
  if (viewportBounds) {
    await page.mouse.move(
      viewportBounds.x + (viewportBounds.width * 0.2),
      viewportBounds.y + (viewportBounds.height * 0.2),
    );
    await page.mouse.down();
    await page.mouse.move(
      viewportBounds.x + (viewportBounds.width * 0.35),
      viewportBounds.y + (viewportBounds.height * 0.35),
      { steps: 4 },
    );
    await page.mouse.up();
  }
  await expect.poll(
    () => mapStage.evaluate((element) => window.getComputedStyle(element).transform),
  ).not.toBe(transformBeforeDrag);
  if (isMobileViewport) {
    await zoomOutButton.click();
    await expect(zoomOutput).toBeHidden();
  } else {
    await zoomResetButton.click();
    await expect(zoomOutput).toHaveText("100%");
  }
  const [resetViewportBounds, resetImageBounds] = await Promise.all([
    viewport.boundingBox(),
    mapImage.boundingBox(),
  ]);
  expect(resetViewportBounds).not.toBeNull();
  expect(resetImageBounds).not.toBeNull();
  expect(resetImageBounds!.x).toBeGreaterThanOrEqual(resetViewportBounds!.x - 1);
  expect(resetImageBounds!.y).toBeGreaterThanOrEqual(resetViewportBounds!.y - 1);
  expect(resetImageBounds!.x + resetImageBounds!.width)
    .toBeLessThanOrEqual(resetViewportBounds!.x + resetViewportBounds!.width + 1);
  expect(resetImageBounds!.y + resetImageBounds!.height)
    .toBeLessThanOrEqual(resetViewportBounds!.y + resetViewportBounds!.height + 1);

  await page.goBack();
  await expect(page).toHaveURL(/\/palworld\/items$/u);
  await page.goForward();
  await expect(page).toHaveURL(/\/palworld\/map(?:\?.*)?$/u);
  await expect(page.getByTestId("palworld-map-image")).toBeVisible();
  await page.getByRole("tab", { name: "세계수" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("world")).toBe("tree");
  await expect(mapImage).toHaveAttribute("src", READY_TREE_MAP_URL);
  await expect.poll(
    () => mapImage.evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBe(4096);
  await expect(page.getByRole("button", { name: "필드 보스: 스태초, Lv.75" })).toBeVisible();
  await page.getByRole("tab", { name: "팰파고스섬" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has("world")).toBe(false);
  await expect(mapImage).toHaveAttribute("src", READY_WORLD_MAP_URL);
  const mobileViewport = (page.viewportSize()?.width ?? 1440) <= 768;
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await expect(page.getByRole("button", { name: "지도 범례" })).toHaveCount(0);
  await expect(page.locator(".palworld-map-layer-legend, .palworld-map-legend-sheet")).toHaveCount(0);
  const mobileFilterTrigger = page.getByRole("button", { name: "필터 1개" });
  const coordinateControl = page.locator(".palworld-map-coordinate-control");
  const filterScope = mobileViewport
    ? page.getByTestId("palworld-map-mobile-filters")
    : page.locator(".palworld-map-desktop-filter");
  if (mobileViewport) {
    await expect(coordinateControl).toBeHidden();
    await expect(mobileFilterTrigger).toBeVisible();
    await mobileFilterTrigger.click();
    await expect(filterScope).toBeVisible();
    await expect(filterScope.getByRole("heading", { name: "지도 필터" })).toBeVisible();
    await expect(filterScope.locator(".palworld-map-mobile-filters__footer")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  } else {
    await expect(coordinateControl).toBeVisible();
    await expect(mobileFilterTrigger).toBeHidden();
    const filterContent = filterScope.locator(".palworld-map-filter-content");
    const explorerMain = page.locator(".palworld-map-explorer-main");
    const expandedWidth = await explorerMain.evaluate((element) => element.getBoundingClientRect().width);
    await filterScope.getByRole("button", { name: "필터 숨기기" }).click();
    await expect(filterContent).toBeHidden();
    await expect(filterScope).toHaveAttribute("data-collapsed", "true");
    await expect.poll(
      () => explorerMain.evaluate((element) => element.getBoundingClientRect().width),
    ).toBeGreaterThan(expandedWidth);
    await filterScope.getByRole("button", { name: "필터 열기" }).click();
    await expect(filterContent).toBeVisible();
    await expect(filterScope).not.toHaveAttribute("data-collapsed", "true");

    const mapCard = page.locator(".palworld-map-card");
    const groupToggles = filterScope.locator(".palworld-map-filter-group-toggle");
    const expandedMapCardHeight = await mapCard.evaluate((element) => element.getBoundingClientRect().height);
    await expect.poll(
      () => filterContent.evaluate((element) => element.scrollHeight > element.clientHeight),
    ).toBe(true);
    for (let index = 0; index < await groupToggles.count(); index += 1) {
      const toggle = groupToggles.nth(index);
      if (await toggle.getAttribute("aria-expanded") === "true") await toggle.click();
    }
    await expect.poll(
      () => mapCard.evaluate(
        (element, expectedHeight) => Math.abs(element.getBoundingClientRect().height - expectedHeight),
        expandedMapCardHeight,
      ),
    ).toBeLessThanOrEqual(1);
    for (let index = 0; index < await groupToggles.count(); index += 1) {
      const toggle = groupToggles.nth(index);
      if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    }
  }
  await expect(filterScope.getByText("사용 가능", { exact: true })).toHaveCount(0);
  const filterLayerName = filterScope.locator(".palworld-map-filter-layer-copy strong").first();
  await expect(filterLayerName).toHaveAttribute("title", /.+/u);
  const filterLayerNameStyle = await filterLayerName.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      fontSize: Number.parseFloat(style.fontSize),
      lineClamp: style.webkitLineClamp,
    };
  });
  expect(filterLayerNameStyle.fontSize).toBeLessThanOrEqual(14);
  expect(filterLayerNameStyle.lineClamp).toBe("2");
  const eggGroup = filterScope.locator(".palworld-map-filter-group").filter({
    has: page.locator('[data-layer="egg-grass"]'),
  });
  const eggGroupToggle = eggGroup.getByRole("button", { name: "알", exact: true });
  const eggGroupList = eggGroup.locator("ul");
  const eggIcon = eggGroup.locator('[data-layer="egg-grass"] img');
  await eggIcon.scrollIntoViewIfNeeded();
  await expect(eggIcon).toBeVisible();
  await expect.poll(
    () => eggIcon.evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
  await eggGroupToggle.click();
  await expect(eggGroupToggle).toHaveAttribute("aria-expanded", "false");
  await expect(eggGroupList).toBeHidden();
  await eggGroupToggle.click();
  await expect(eggGroupToggle).toHaveAttribute("aria-expanded", "true");
  await expect(eggGroupList).toBeVisible();
  const resourceGroup = filterScope.locator(".palworld-map-filter-group").filter({
    has: page.locator('[data-layer="resource-copper-ore"]'),
  });
  const resourceGroupAll = resourceGroup.locator('input[id$="-all"]');
  await expect(resourceGroupAll).toBeEnabled();
  await resourceGroupAll.check();
  await expect.poll(
    () => new URL(page.url()).searchParams.get("layers")?.split(","),
  ).toContain("resource");
  await expect(
    page.locator('.palworld-map-location-marker[data-category="resource"]').first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "고대 짐승뼈" })).toBeVisible();
  await expect(page.getByRole("button", { name: "고대나무껍질" })).toBeVisible();
  await resourceGroupAll.uncheck();
  await expect.poll(
    () => new URL(page.url()).searchParams.get("layers")?.split(",") ?? [],
  ).not.toContain("resource");
  const bossLayerCheckbox = filterScope.locator('[data-layer="boss"] input[type="checkbox"]');
  await expect(bossLayerCheckbox).toBeChecked();
  await bossLayerCheckbox.uncheck();
  await expect.poll(() => new URL(page.url()).searchParams.get("layers")).toBe("spawn");
  await expect(page.getByTestId("palworld-map-boss-markers")).toBeHidden();
  await bossLayerCheckbox.check();
  await expect.poll(() => new URL(page.url()).searchParams.has("layers")).toBe(false);
  await expect(page.getByTestId("palworld-map-boss-markers")).toBeVisible();
  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get("layers")).toBe("spawn");
  await expect(page.getByTestId("palworld-map-boss-markers")).toBeHidden();
  await page.goForward();
  await expect.poll(() => new URL(page.url()).searchParams.has("layers")).toBe(false);
  await expect(page.getByTestId("palworld-map-boss-markers")).toBeVisible();
  if (mobileViewport) {
    await filterScope
      .locator(".palworld-map-mobile-filters__header")
      .getByRole("button", { name: "닫기" })
      .click();
    await expect(filterScope).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
    await expect(mobileFilterTrigger).toBeFocused();
  }
  const bossMarker = page.getByRole("button", { name: "필드 보스: 아누비스, Lv.55" });
  await expect(bossMarker).toBeVisible();
  await bossMarker.click();
  await expect.poll(() => new URL(page.url()).searchParams.get("marker")).toBe("anubis-field-boss");
  const markerPopover = page.getByRole("dialog", { name: "아누비스" });
  await expect(markerPopover).toHaveAttribute("id", "palworld-map-marker-popover");
  await expect(bossMarker).toHaveAttribute("aria-controls", "palworld-map-marker-popover");
  await markerPopover.getByRole("button", { name: "지도 중앙에 맞추기" }).click();
  await page.keyboard.press("Escape");
  await expect.poll(() => new URL(page.url()).searchParams.has("marker")).toBe(false);
  await expect(bossMarker).toBeFocused();
  await bossMarker.click();
  await expect(page.getByRole("dialog", { name: "아누비스" })).toBeVisible();
  await page.locator(".palworld-map-toolbar").dispatchEvent("pointerdown");
  await expect.poll(() => new URL(page.url()).searchParams.has("marker")).toBe(false);
  await bossMarker.click();
  await expect(page.getByRole("dialog", { name: "아누비스" })).toBeVisible();
  await page.getByRole("dialog", { name: "아누비스" }).getByRole("button", { name: "Pal 상세 보기" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("pal")).toBe("anubis");
  await expect(page.getByTestId("pal-detail-modal")).toBeVisible();
  await page.getByTestId("pal-detail-modal").getByRole("button", { name: "닫기", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has("pal")).toBe(false);
  await page.getByRole("dialog", { name: "아누비스" }).getByRole("button", { name: "위치 정보 닫기" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has("marker")).toBe(false);

  await selectPublicLocale(page, "ja");
  await expect(page.getByRole("heading", { name: "Palworld ワールドマップ", level: 1 })).toHaveClass(/yoro-u-sr-only/u);
  await expect(page.getByRole("button", { name: "マップを拡大" })).toBeVisible();
  await expect(page.getByRole("button", { name: "フィールドボス: アヌビス, Lv.55" })).toBeVisible();
  await assertHealthyDocument(page, errors);
});

test("월드 지도 이미지 오류는 페이지를 깨뜨리지 않고 재시도할 수 있다", async ({ page }) => {
  const mapRoute = `**${READY_WORLD_MAP_URL}`;
  await page.route(mapRoute, async (route) => route.abort());
  await page.goto("/palworld/map");
  await expect(page.getByRole("alert")).toContainText("월드 지도를 불러오지 못했습니다.");
  await page.unroute(mapRoute);
  await page.getByRole("button", { name: "지도 다시 불러오기" }).click();
  await expect(page.getByTestId("palworld-map-image")).toBeVisible();
  await expect.poll(() => page.getByTestId("palworld-map-image").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(4096);
});

test("Palworld 화면은 외부 origin 이미지 요청 없이 카드·자동완성·상세·교배 이미지를 표시한다", async ({ page }) => {
  const imageRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image") imageRequests.push(request.url());
  });

  await page.goto("/palworld/pals?q=펭킹");
  const cardImage = page.getByTestId("pal-card").filter({ hasText: "펭킹" }).getByRole("img", { name: "펭킹" });
  await expect(cardImage).toBeVisible();
  await expect(cardImage).toHaveAttribute("src", READY_PAL_IMAGE_URL);
  await expect(cardImage).toHaveAttribute("width", "128");
  await expect(cardImage).toHaveAttribute("height", "128");
  await expect(cardImage).toHaveAttribute("loading", "eager");
  await expect(cardImage).toHaveAttribute("fetchpriority", "high");
  await expect(cardImage).toHaveClass(/is-low-resolution/u);
  await page
    .getByTestId("pal-card")
    .filter({ hasText: "펭킹" })
    .getByRole("button", { name: "Pal 상세 보기" })
    .click();
  await expect(page.getByTestId("pal-detail-modal").getByRole("img", { name: "펭킹" })).toBeVisible();
  await page.keyboard.press("Escape");

  const headerSearch = page.getByTestId("header-search").getByRole("searchbox");
  await headerSearch.fill("펭킹");
  await expect(page.getByTestId("header-search").getByRole("option", { name: /펭킹/u }).getByRole("img", { name: "펭킹" })).toBeVisible();

  await page.goto("/palworld/breeding");
  const parent = page.getByTestId("breeding-parent-a");
  await parent.getByRole("searchbox").fill("펭킹");
  await parent.getByRole("option", { name: /펭킹/u }).click();
  await expect(parent.getByRole("img", { name: "펭킹" })).toBeVisible();

  await selectPublicLocale(page, "ja");
  const japaneseSearch = page.getByTestId("header-search").getByRole("searchbox");
  await japaneseSearch.fill("キャプペン");
  await japaneseSearch.press("Enter");
  await expect(page.getByRole("heading", { name: "キャプペン", level: 1 })).toBeVisible();
  await expect(page.getByTestId("pal-card").filter({ hasText: "キャプペン" }).getByRole("img", { name: "キャプペン" })).toBeVisible();

  const pageOrigin = new URL(page.url()).origin;
  expect(imageRequests.filter((requestUrl) => new URL(requestUrl).origin !== pageOrigin)).toEqual([]);
});

const publicChromeResponsiveViewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1180, height: 820 },
  { width: 1440, height: 1000 },
] as const;

for (const viewport of publicChromeResponsiveViewports) {
  test(`연결 프로필·LIVE rail·메뉴가 페이지 overflow를 만들지 않는다 (${viewport.width}×${viewport.height})`, async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await installConnectedTwitchFixtures(page, { longContent: true });
    await page.setViewportSize(viewport);
    await page.goto("/palworld");
    const localeButton = page.locator(".public-locale-button");
    const profileButton = page.locator(".public-twitch-login-chip");
    const productCluster = page.locator(".public-game-header__product");
    const headerTools = page.locator(".public-game-header__tools");
    const mobileMenuButton = page.getByRole("button", { name: "메뉴 열기", exact: true });
    if (viewport.width <= 768) {
      await expect(localeButton).toBeHidden();
      await expect(profileButton).toBeHidden();
      await expect(mobileMenuButton).toBeVisible();
      await mobileMenuButton.click();
      const mobileMenu = page.getByRole("dialog", { name: "메뉴" });
      await expect(mobileMenu.getByRole("heading", { name: "게임 선택" })).toBeVisible();
      await expect(mobileMenu.getByRole("heading", { name: "언어" })).toBeVisible();
      await expect(mobileMenu.getByRole("heading", { name: "계정" })).toBeVisible();
      await expect(mobileMenu.getByText("아주 긴 Twitch 프로필 표시 이름")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(mobileMenu).toBeHidden();
      await expect(mobileMenuButton).toBeFocused();
    } else {
      await expect(localeButton).toBeVisible();
      await expect(profileButton).toBeVisible();
    }
    const [localeBounds, profileBounds, productBounds, toolsBounds] = await Promise.all([
      localeButton.boundingBox(),
      profileButton.boundingBox(),
      productCluster.boundingBox(),
      headerTools.boundingBox(),
    ]);
    expect(productBounds).not.toBeNull();
    if (viewport.width > 768) {
      expect(localeBounds).not.toBeNull();
      expect(profileBounds).not.toBeNull();
      expect(toolsBounds).not.toBeNull();
      expect(localeBounds!.x + localeBounds!.width).toBeLessThanOrEqual(profileBounds!.x);
      const productToolsOverlap = (
        productBounds!.x < toolsBounds!.x + toolsBounds!.width
        && productBounds!.x + productBounds!.width > toolsBounds!.x
        && productBounds!.y < toolsBounds!.y + toolsBounds!.height
        && productBounds!.y + productBounds!.height > toolsBounds!.y
      );
      expect(productToolsOverlap, `${viewport.width}px에서 게임 선택과 헤더 도구가 겹치지 않아야 합니다.`).toBe(false);
    }
    await expect(page.getByTestId("public-live-streamer-rail").locator(".public-home-live-card")).toHaveCount(1);
    await assertHealthyDocument(page, errors);

    const secondaryRow = page.locator(".public-horizontal-nav");
    const homeMenu = page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "홈" });
    const mapMenu = page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "지도" });
    await homeMenu.focus();
    await expect(homeMenu).toBeFocused();
    await expect.poll(() => secondaryRow.evaluate((row) => {
      const button = document.activeElement as HTMLElement | null;
      if (!button || !row.contains(button)) return false;
      const rowBounds = row.getBoundingClientRect();
      const buttonBounds = button.getBoundingClientRect();
      return buttonBounds.left >= rowBounds.left - 1 && buttonBounds.right <= rowBounds.right + 1;
    })).toBe(true);
    await mapMenu.focus();
    await expect(mapMenu).toBeFocused();
    await expect.poll(() => secondaryRow.evaluate((row) => {
      const button = row.querySelector<HTMLElement>("button:last-child");
      if (!button) return false;
      const rowBounds = row.getBoundingClientRect();
      const buttonBounds = button.getBoundingClientRect();
      return buttonBounds.left >= rowBounds.left - 1 && buttonBounds.right <= rowBounds.right + 1;
    })).toBe(true);
    const menuMetrics = await secondaryRow.evaluate((row) => ({
      clientHeight: row.clientHeight,
      scrollHeight: row.scrollHeight,
      clientWidth: row.clientWidth,
      scrollWidth: row.scrollWidth,
      overflowY: window.getComputedStyle(row).overflowY,
    }));
    expect(menuMetrics.overflowY).toBe("hidden");
    if (viewport.width >= 1024) {
      expect(menuMetrics.scrollHeight, `${viewport.width}px 메뉴에 세로 스크롤 영역이 없어야 합니다.`).toBe(menuMetrics.clientHeight);
    }
    if (viewport.width === 1440) expect(menuMetrics.scrollWidth).toBeLessThanOrEqual(menuMetrics.clientWidth + 1);

    await mapMenu.click();
    await expect(page).toHaveURL(/\/palworld\/map$/u);
    await expect(page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "지도" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("palworld-map-image")).toBeVisible();
    const mobileMapLayout = viewport.width <= 768;
    if (!mobileMapLayout) {
      const [baseMapBounds, baseMapImageBounds] = await Promise.all([
        page.getByTestId("palworld-map-viewport").boundingBox(),
        page.getByTestId("palworld-map-image").boundingBox(),
      ]);
      expect(baseMapBounds).not.toBeNull();
      expect(baseMapImageBounds).not.toBeNull();
      expect(baseMapImageBounds!.x).toBeGreaterThanOrEqual(baseMapBounds!.x - 1);
      expect(baseMapImageBounds!.y).toBeGreaterThanOrEqual(baseMapBounds!.y - 1);
      expect(baseMapImageBounds!.x + baseMapImageBounds!.width)
        .toBeLessThanOrEqual(baseMapBounds!.x + baseMapBounds!.width + 1);
      expect(baseMapImageBounds!.y + baseMapImageBounds!.height)
        .toBeLessThanOrEqual(baseMapBounds!.y + baseMapBounds!.height + 1);
    }
    await page.goto("/palworld/map?focusPal=anubis");
    const mapViewport = page.getByTestId("palworld-map-viewport");
    const mapToolbar = page.locator(".palworld-map-toolbar");
    const [mapBounds, toolbarBounds] = await Promise.all([
      mapViewport.boundingBox(),
      mapToolbar.boundingBox(),
    ]);
    expect(mapBounds).not.toBeNull();
    expect(toolbarBounds).not.toBeNull();
    expect(mapBounds!.x).toBeGreaterThanOrEqual(0);
    expect(mapBounds!.x + mapBounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    if (mobileMapLayout) {
      const commandBounds = await page.locator(".palworld-map-mobile-command-bar").boundingBox();
      expect(commandBounds).not.toBeNull();
      expect(commandBounds!.y).toBeGreaterThanOrEqual(mapBounds!.y);
      expect(commandBounds!.y + commandBounds!.height).toBeLessThanOrEqual(mapBounds!.y + mapBounds!.height);
      expect(toolbarBounds!.y).toBeGreaterThanOrEqual(mapBounds!.y + mapBounds!.height);
    } else {
      const [sidebarBounds, cardBounds] = await Promise.all([
        page.locator(".palworld-map-desktop-filter").boundingBox(),
        page.locator(".palworld-map-card").boundingBox(),
      ]);
      expect(sidebarBounds).not.toBeNull();
      expect(cardBounds).not.toBeNull();
      expect(Math.abs(sidebarBounds!.x + sidebarBounds!.width - cardBounds!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(sidebarBounds!.height - cardBounds!.height)).toBeLessThanOrEqual(1);
      expect(toolbarBounds!.x).toBeGreaterThanOrEqual(mapBounds!.x);
      expect(toolbarBounds!.x + toolbarBounds!.width).toBeLessThanOrEqual(mapBounds!.x + mapBounds!.width);
    }
    await expect(page.getByRole("button", { name: "지도 범례" })).toHaveCount(0);
    await expect(page.locator(".palworld-map-layer-legend, .palworld-map-legend-sheet")).toHaveCount(0);
    if (mobileMapLayout) {
      await expect.poll(() => mapViewport.evaluate((element) =>
        window.getComputedStyle(element).touchAction
      )).toBe("none");
    }
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )).toBe(true);
    await assertHealthyDocument(page, errors);
  });
}
