import { expect, test, type Page, type Route } from "@playwright/test";
import { resolve } from "node:path";
import {
  PALWORLD_ELEMENTS,
  PALWORLD_PUBLIC_NOTICE_JA,
  PALWORLD_PUBLIC_NOTICE_KO,
  PALWORLD_VARIANT_TYPES,
  PALWORLD_WORK_SUITABILITY_TYPES,
} from "@streamops/shared";
import type {
  PalworldBreedingPair,
  PalworldDataMetadata,
  PalworldItemDetail,
  PalworldItemSummary,
  PalworldMapMarkersResponse,
  PalworldPaginatedResponse,
  PalworldPalDetail,
  PalworldPalListFacets,
  PalworldPalListResponse,
  PalworldPalReference,
  PalworldPalSpawnResponse,
  PalworldPalSummary,
  PalworldSkillDetail,
  PalworldSkillSummary,
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
const READY_WORLD_MAP_URL = "/images/palworld/1.0.1/maps/3b9c9c70f0fe0e025d67971d16bc6cb42a8ce3b63ad42f30681dcbf6ac379003.webp";
const LOCAL_WEBP_FIXTURE = resolve("apps/dashboard/public/images/yorogg-logo.webp");

const mapMarkers: PalworldMapMarkersResponse = {
  state: "ready",
  world: "main",
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
  const { relatedPals: _relatedPals, metadata: _metadata, ...summary } = skill;
  return summary;
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
  const sort = url.searchParams.get("sort") ?? "name";
  return items
    .filter((item) => !query || matches(query, [...aliases(item.id), item.nameKo, item.nameJa, item.nameEn]))
    .filter((item) => !category || item.category === category)
    .filter((item) => !rarity || item.rarity === Number(rarity))
    .filter((item) => !acquisition || item.acquisitionMethods.some((method) => method.type === acquisition))
    .sort((left, right) => {
      if (sort === "rarity") return left.rarity - right.rarity;
      if (sort === "price") return (left.sellPrice ?? Number.MAX_SAFE_INTEGER) - (right.sellPrice ?? Number.MAX_SAFE_INTEGER);
      if (sort === "technologyLevel") return (left.technologyLevel ?? Number.MAX_SAFE_INTEGER) - (right.technologyLevel ?? Number.MAX_SAFE_INTEGER);
      return left.nameKo.localeCompare(right.nameKo);
    })
    .map(itemSummary);
}

function filteredSkills(url: URL): PalworldSkillSummary[] {
  const query = url.searchParams.get("q");
  const type = url.searchParams.get("type");
  const element = url.searchParams.get("element");
  const sort = url.searchParams.get("sort") ?? "name";
  const order = url.searchParams.get("order") === "desc" ? -1 : 1;
  return skills
    .filter((skill) => !query || matches(query, [skill.id, skill.nameKo ?? "", skill.nameJa ?? "", skill.nameEn, skill.descriptionKo ?? "", skill.descriptionJa ?? "", skill.descriptionEn ?? ""]))
    .filter((skill) => !type || skill.type === type)
    .filter((skill) => !element || skill.element === element)
    .sort((left, right) => {
      if (sort === "power") return order * ((left.power ?? Number.MAX_SAFE_INTEGER) - (right.power ?? Number.MAX_SAFE_INTEGER));
      if (sort === "unlockLevel") return order * ((left.unlockLevel ?? Number.MAX_SAFE_INTEGER) - (right.unlockLevel ?? Number.MAX_SAFE_INTEGER));
      return order * left.nameEn.localeCompare(right.nameEn);
    })
    .map(skillSummary);
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
      await json(route, mapMarkers);
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
    if (url.pathname === "/api/palworld/skills") {
      await json(route, pageResponse(filteredSkills(url), url));
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
    if (url.pathname === "/api/public/tournaments") {
      await json(route, { tournaments: [] });
      return;
    }
    if (url.pathname === "/api/public/community/posts") {
      await json(route, { posts: [] });
      return;
    }
    await json(route, {});
  });
}

async function installConnectedTwitchFixtures(page: Page, { longContent = false } = {}) {
  let connected = true;
  let statusRequests = 0;
  let followedRequests = 0;
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
    },
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
  await page.route("**/api/public/twitch/followed-lol?limit=100", async (route) => {
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
  const optionName = game === "league" ? /리그 오브 레전드/u : /펠월드/u;
  if ((page.viewportSize()?.width ?? 1440) <= 600) {
    await page.locator(".public-mobile-menu-toggle").click();
    await page.locator(".public-mobile-game-tray").getByRole("option", { name: optionName }).click();
    return;
  }
  await page.locator(".public-game-selector-trigger").click();
  await page.locator(".public-game-selector-menu").getByRole("option", { name: optionName }).click();
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

test("펠월드 홈은 Hero 검색과 Twitch 로그인 LIVE rail만 표시하고 게임 선택으로 LoL과 왕복 이동한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld");

  await expect(page.locator(".palworld-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "펠월드 데이터베이스", level: 1 })).toBeVisible();
  await expect(page.getByTestId("hero-search")).toBeVisible();
  await expect(page.getByTestId("header-search")).toHaveCount(0);
  await expect(page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "홈" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".palworld-hero-meta, .palworld-shortcuts, .palworld-summary")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "팔로우 중인 LIVE 스트리머" })).toBeVisible();
  await expect(page.getByText("Twitch 로그인 후 팔로우 중인 스트리머의 방송 상태를 확인할 수 있습니다.")).toBeVisible();
  await expect(page.getByTestId("public-live-streamer-rail").getByRole("button", { name: "Twitch 로그인" })).toBeVisible();
  await expect(page.getByTestId("palworld-secondary-nav").getByRole("button")).toHaveCount(7);
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

test("LoL의 공개 Twitch session은 Palworld 프로필과 LIVE 목록에 그대로 연결된다", async ({ page }) => {
  const fixture = await installConnectedTwitchFixtures(page);
  const errors = collectRuntimeErrors(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Pal Viewer" })).toBeVisible();

  await chooseGame(page, "palworld");
  await expect(page).toHaveURL(/\/palworld$/u);
  const accountButton = page.getByRole("button", { name: "Pal Viewer" });
  await expect(accountButton).toBeVisible();
  await accountButton.click();
  await expect(page.getByRole("menu", { name: "Twitch 프로필 메뉴" })).toBeVisible();
  const dashboardMenuItem = page.getByRole("menuitem", { name: "대시보드 열기" });
  const logoutMenuItem = page.getByRole("menuitem", { name: "로그아웃" });
  await expect(dashboardMenuItem).toBeVisible();
  await expect(dashboardMenuItem).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(logoutMenuItem).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(dashboardMenuItem).toBeFocused();
  await expect(page.getByRole("menu").getByText(/Riot ID|내 전적/u)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: "Twitch 프로필 메뉴" })).toHaveCount(0);
  await accountButton.click();
  await page.getByRole("heading", { name: "펠월드 데이터베이스" }).click();
  await expect(page.getByRole("menu", { name: "Twitch 프로필 메뉴" })).toHaveCount(0);
  await expect(page.getByTestId("public-live-streamer-rail").getByText("Live Pal", { exact: true })).toBeVisible();
  await expect(page.getByTestId("public-live-streamer-rail").getByText("Offline Pal", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("public-live-streamer-rail").getByText("중복 Live Pal", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "전체 보기" }).click();
  await expect(page).toHaveURL(/\/palworld\/streamers$/u);
  await expect(page.getByTestId("header-search")).toBeVisible();
  await expect(page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "스트리머" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("palworld-streamer-list").locator(".palworld-streamer-card")).toHaveCount(2);
  await expect(page.getByTestId("palworld-streamer-list").locator(".palworld-streamer-card").nth(0)).toContainText("Live Pal");
  await expect(page.getByTestId("palworld-streamer-list")).toContainText("Offline Pal");
  await expect(page.getByText("팔로우 채널 2")).toBeVisible();
  await expect(page.getByText(/Riot ID|랭크|전적 보기/u)).toHaveCount(0);

  const beforeRefresh = fixture.followedRequestCount();
  await page.getByRole("button", { name: "새로고침" }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect.poll(() => fixture.followedRequestCount()).toBe(beforeRefresh + 1);
  await page.goBack();
  await expect(page).toHaveURL(/\/palworld$/u);
  await page.goForward();
  await expect(page).toHaveURL(/\/palworld\/streamers$/u);
  await assertHealthyDocument(page, errors);
});

test("Palworld 하위 데이터 페이지는 Twitch 상태만 조회하고 홈 진입 시 팔로우 목록을 지연 조회한다", async ({ page }) => {
  const fixture = await installConnectedTwitchFixtures(page);
  await page.goto("/palworld/pals");
  await expect(page.getByRole("button", { name: "Pal Viewer" })).toBeVisible();
  expect(fixture.followedRequestCount()).toBe(0);

  await page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "홈" }).click();
  await expect(page).toHaveURL(/\/palworld$/u);
  await expect.poll(() => fixture.followedRequestCount()).toBe(1);
  await expect(page.getByTestId("public-live-streamer-rail").getByText("Live Pal", { exact: true })).toBeVisible();
});

test("Twitch 상태 API 오류는 미설정으로 오표시하지 않고 Palworld 검색과 분리된다", async ({ page }) => {
  await page.route("**/api/public/twitch/status", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });
  await page.goto("/palworld/streamers");
  await expect(page.getByRole("alert")).toContainText("Twitch 방송 상태를 불러오지 못했습니다.");
  await expect(page.getByText("Twitch 기능이 설정되지 않았습니다.")).toHaveCount(0);
  const search = page.getByTestId("header-search").getByRole("searchbox");
  await search.fill("펭킹");
  await expect(page.getByTestId("header-search").getByRole("option", { name: /펭킹/u })).toBeVisible();
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
      const hero = element.closest(".palworld-hero");
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

  await page.locator(".public-locale-button").click();
  await page.getByRole("menuitemradio", { name: /JP/u }).click();
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

  const authRequestPromise = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/public/twitch/auth/start");
  await page.getByRole("button", { name: "Twitch 로그인" }).first().click();
  const authRequest = await authRequestPromise;
  const returnTo = new URL(authRequest.url()).searchParams.get("return_to");
  expect(returnTo).toBe(`/palworld/search?q=${encodeURIComponent("아누비스")}`);
});

test("Palworld OAuth callback 표시 후 공유 Twitch 상태를 재조회하고 marker만 제거한다", async ({ page }) => {
  const fixture = await installConnectedTwitchFixtures(page);
  await page.goto("/palworld/streamers?view=all&viewer_twitch=connected");
  await expect(page.getByRole("button", { name: "Pal Viewer" })).toBeVisible();
  await expect.poll(() => fixture.statusRequestCount()).toBeGreaterThanOrEqual(2);
  const currentUrl = new URL(page.url());
  expect(currentUrl.pathname).toBe("/palworld/streamers");
  expect(currentUrl.searchParams.get("view")).toBe("all");
  expect(currentUrl.searchParams.has("viewer_twitch")).toBe(false);
});

test("Palworld 로그아웃은 공유 session을 제거해 LoL에서도 미로그인 상태가 된다", async ({ page }) => {
  const fixture = await installConnectedTwitchFixtures(page);
  await page.goto("/palworld");
  await page.getByRole("button", { name: "Pal Viewer" }).click();
  await page.getByRole("menuitem", { name: "로그아웃" }).click();
  await expect.poll(() => fixture.isConnected()).toBe(false);
  await expect(page.getByRole("button", { name: "Twitch 로그인" }).first()).toBeVisible();

  await chooseGame(page, "league");
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.getByRole("button", { name: /Twitch/u }).first()).toBeVisible();
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
    /^\/images\/palworld\/work\/[a-f0-9]{64}\.webp$/u,
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
  await expect(anubisCard.locator(".palworld-card-work-list [role='listitem']")).toHaveCount(2);
  await expect(anubisCard.locator('[data-work-type="handiwork"]')).toContainText("Lv.4");
  await expect(anubisCard.locator('[data-work-type="mining"]')).toContainText("Lv.3");
  await expect(anubisCard.locator('[data-work-type="handiwork"]')).not.toHaveAttribute("title");
  await expect(anubisCard.locator('[data-work-type="mining"]')).not.toHaveAttribute("title");
  await expect(anubisCard.locator('[data-work-type="handiwork"]')).toHaveAttribute("aria-describedby", /.+/u);
  await expect(anubisCard.locator('[data-work-type="mining"]')).toHaveAttribute("aria-describedby", /.+/u);
  await expect(anubisCard.locator('[data-work-type="handiwork"] .palworld-work-suitability-tooltip')).toHaveText("수작업: Lv.4");
  await expect(anubisCard.locator('[data-work-type="mining"] .palworld-work-suitability-tooltip')).toHaveText("채굴: Lv.3");
  await expect(anubisCard.locator('[data-work-type="handiwork"] .palworld-work-suitability-label')).toHaveClass(/yoro-u-sr-only/u);
  await expect(anubisCard.locator('[data-work-type="mining"] .palworld-work-suitability-label')).toHaveClass(/yoro-u-sr-only/u);
  await expect(anubisCard.locator(".palworld-work-suitability-icon.is-source-image")).toHaveCount(0);
  await expect(anubisCard.locator(".palworld-work-suitability-icon:not(.is-source-image)")).toHaveCount(2);
  const cardBox = await anubisCard.boundingBox();
  const cardMainBox = await anubisCard.locator(".palworld-pal-card-main").boundingBox();
  const cardImageFrameBox = await anubisCard.locator(".palworld-pal-card-image-frame").boundingBox();
  const cardContentBox = await anubisCard.locator(".palworld-pal-card-content").boundingBox();
  const cardWorkBox = await anubisCard.locator(".palworld-card-work-list").boundingBox();
  expect(cardBox).not.toBeNull();
  expect(cardMainBox).not.toBeNull();
  expect(cardImageFrameBox).not.toBeNull();
  expect(cardContentBox).not.toBeNull();
  expect(cardWorkBox).not.toBeNull();
  if (cardBox && cardMainBox && cardImageFrameBox && cardContentBox && cardWorkBox) {
    if (mobileFilters) {
      expect(cardImageFrameBox.y + cardImageFrameBox.height).toBeLessThanOrEqual(cardContentBox.y + 1);
    } else {
      expect(cardImageFrameBox.x + cardImageFrameBox.width).toBeLessThanOrEqual(cardContentBox.x + 1);
      expect(cardBox.width / cardBox.height).toBeGreaterThan(1.2);
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
  await expect(workList.locator(".palworld-work-suitability-badge")).toHaveCount(2);
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
  await page.locator(".public-locale-button").click();
  await page.getByRole("menuitemradio", { name: /JP/u }).click();
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
  await expect(filterSurface.getByRole("combobox", { name: "희귀도", exact: true })).toHaveValue("10");
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
  await page.locator(".public-locale-button").click();
  await page.getByRole("menuitemradio", { name: /JP/u }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("존재하지않는Pal");
  await expect(page.getByText("条件に一致するパル 0体 · 0体を表示", { exact: true })).toBeVisible();
  if (mobileFilters) await page.getByTestId("pal-filter-trigger").click();
  await expect(page.getByRole("group", { name: "属性" })).toBeVisible();
  if (mobileFilters) await page.keyboard.press("Escape");
  await assertHealthyDocument(page, errors);
});

test("Pal 도감 모바일 필터 Modal은 즉시 적용·focus 복귀·scroll lock과 모든 화면 폭을 지원한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  const mobileViewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
  ];

  for (const viewport of mobileViewports) {
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
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/palworld/pals?element=ground");
  await expect(page.locator(".palworld-pal-filter-panel")).toBeVisible();
  await expect(page.getByTestId("pal-filter-trigger")).toBeHidden();
  await assertHealthyDocument(page, errors);
});

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
    await json(route, pageResponse(manySkills, url));
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
  )).toBe("pan-y");
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
  await expect(page.getByRole("combobox", { name: "희귀도", exact: true })).toHaveValue("0");
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
  const filters = page.locator(".palworld-skill-filter-bar select");
  await expect(filters.nth(0)).toHaveValue("active");
  await expect(filters.nth(1)).toHaveValue("ground");
  await expect(filters.nth(2)).toHaveValue("power");
  await expect(filters.nth(3)).toHaveValue("desc");
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

  await page.reload();
  await expect(page.getByRole("heading", { name: "Palworld 스킬", level: 1 })).toBeVisible();
  await page.locator(".public-locale-button").click();
  await page.getByRole("menuitemradio", { name: /JP/u }).click();
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
  await page.getByTestId("breeding-reverse-pair").getByRole("button", { name: "계산기에 넣기" }).click();
  await expect(page).toHaveURL(/mode=parents.*parentA=penking.*parentB=bushi/u);
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

test("교배 직접 결과와 역검색 카드는 요구 화면 크기에서 수평 overflow 없이 표시된다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 1000 },
  ];

  for (const viewport of viewports) {
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
    expect(Math.abs(directTabBounds!.y - reverseTabBounds!.y)).toBeLessThanOrEqual(1);
    expect(reverseTabBounds!.x + reverseTabBounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    await expect(page.getByTestId("breeding-direct-card").locator(".palworld-direct-result-hero")).toBeVisible();
    await assertHealthyDocument(page, errors);

    await page.goto("/palworld/breeding?mode=child&child=sibelyx");
    await expect(page.getByTestId("breeding-target-summary")).toBeVisible();
    await expect(page.getByTestId("breeding-reverse-pair")).toBeVisible();
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
  await page.route("**/images/palworld/work/*.webp", async (route) => {
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
  await expect(anubisCard.locator(".palworld-work-suitability-icon:not(.is-source-image)")).toHaveCount(2);
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

  await page.locator(".public-locale-button").click();
  await page.getByRole("menuitemradio", { name: /JP/u }).click();
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
    "/palworld/streamers",
    "/palworld/pals",
    "/palworld/breeding",
    "/palworld/items",
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
    "/palworld/streamers",
    "/palworld/pals",
    "/palworld/breeding",
    "/palworld/items",
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

    await page.locator(".public-locale-button").click();
    await page.getByRole("menuitemradio", { name: /JP/u }).click();
    const japaneseFooter = page.getByTestId("palworld-source-footer");
    await expect(japaneseFooter.locator("p")).toHaveText(PALWORLD_PUBLIC_NOTICE_JA);
    await expect(japaneseFooter.getByRole("link", { name: /Palworld · 外部サイト、新しいタブで開く/u })).toBeVisible();
  }
});

test("월드 지도 메뉴는 직접 URL·확대·초기화·뒤로 가기와 일본어를 지원한다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await page.goto("/palworld/items");
  await page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "지도" }).click();

  await expect(page).toHaveURL(/\/palworld\/map$/u);
  await expect(page.getByTestId("header-search")).toBeVisible();
  await expect(page.getByTestId("palworld-secondary-nav").getByRole("button", { name: "지도" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Palworld 월드 지도", level: 1 })).toBeVisible();
  const mapImage = page.getByTestId("palworld-map-image");
  await expect(mapImage).toBeVisible();
  await expect(mapImage).toHaveAttribute("src", READY_WORLD_MAP_URL);
  await expect.poll(() => mapImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(4096);
  const viewport = page.getByTestId("palworld-map-viewport");
  await expect.poll(() => viewport.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

  await page.getByRole("button", { name: "지도 확대" }).click();
  await expect(page.getByText("150%", { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "배율 초기화" }).click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/palworld\/items$/u);
  await page.goForward();
  await expect(page).toHaveURL(/\/palworld\/map$/u);
  await expect(page.getByTestId("palworld-map-image")).toBeVisible();
  const bossMarker = page.getByRole("button", { name: "필드 보스: 아누비스, Lv.55" });
  await expect(bossMarker).toBeVisible();
  await bossMarker.click();
  await expect(page).toHaveURL(/\/palworld\/map\?pal=anubis$/u);
  await expect(page.getByRole("dialog", { name: "아누비스" })).toBeVisible();
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page).toHaveURL(/\/palworld\/map$/u);

  await page.locator(".public-locale-button").click();
  await page.getByRole("menuitemradio", { name: /JP/u }).click();
  await expect(page.getByRole("heading", { name: "Palworld ワールドマップ", level: 1 })).toBeVisible();
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

  await page.locator(".public-locale-button").click();
  await page.getByRole("menuitemradio", { name: /JP/u }).click();
  const japaneseSearch = page.getByTestId("header-search").getByRole("searchbox");
  await japaneseSearch.fill("キャプペン");
  await japaneseSearch.press("Enter");
  await expect(page.getByRole("heading", { name: "キャプペン", level: 1 })).toBeVisible();
  await expect(page.getByTestId("pal-card").filter({ hasText: "キャプペン" }).getByRole("img", { name: "キャプペン" })).toBeVisible();

  const pageOrigin = new URL(page.url()).origin;
  expect(imageRequests.filter((requestUrl) => new URL(requestUrl).origin !== pageOrigin)).toEqual([]);
});

test("요구 화면 크기에서 연결 프로필·LIVE rail·스트리머 목록과 메뉴가 페이지 overflow를 만들지 않는다", async ({ page }) => {
  const errors = collectRuntimeErrors(page);
  await installConnectedTwitchFixtures(page, { longContent: true });
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1180, height: 820 },
    { width: 1440, height: 1000 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/palworld");
    const localeButton = page.locator(".public-locale-button");
    const profileButton = page.locator(".public-twitch-login-chip");
    await expect(localeButton).toBeVisible();
    await expect(profileButton).toBeVisible();
    const [localeBounds, profileBounds] = await Promise.all([localeButton.boundingBox(), profileButton.boundingBox()]);
    expect(localeBounds).not.toBeNull();
    expect(profileBounds).not.toBeNull();
    expect(localeBounds!.x + localeBounds!.width).toBeLessThanOrEqual(profileBounds!.x);
    await expect(page.getByTestId("public-live-streamer-rail").locator(".public-home-live-card")).toHaveCount(1);
    await assertHealthyDocument(page, errors);

    await page.getByRole("button", { name: "전체 보기" }).click();
    const streamerCards = page.getByTestId("palworld-streamer-list").locator(".palworld-streamer-card");
    await expect(streamerCards).toHaveCount(2);
    await expect(streamerCards.first()).not.toHaveAttribute("tabindex");
    await expect(streamerCards.last()).not.toHaveAttribute("tabindex");
    const watchLinks = page.getByTestId("palworld-streamer-list").getByRole("link", { name: "방송 보기" });
    await watchLinks.first().focus();
    await expect(watchLinks.first()).toBeFocused();
    await watchLinks.last().focus();
    await expect(watchLinks.last()).toBeFocused();
    await assertHealthyDocument(page, errors);

    const secondaryRow = page.locator(".palworld-secondary-row");
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
    await page.goto("/palworld/map?focusPal=anubis");
    const mapLegend = page.getByRole("group", { name: "지도 범례" });
    await expect(mapLegend).toBeVisible();
    await expect(mapLegend).toContainText("일반 야생 스폰");
    await expect.poll(() => mapLegend.evaluate((element) =>
      element.scrollWidth <= element.clientWidth + 1
    )).toBe(true);
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )).toBe(true);
    await assertHealthyDocument(page, errors);
  }
});
