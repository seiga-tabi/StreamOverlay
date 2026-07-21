import {
  assertPalworldDataSnapshot,
  type PalworldDataMetadata,
  type PalworldDataSnapshot,
  type PalworldItemDetail,
  type PalworldItemReference,
  type PalworldItemSummary,
  type PalworldPalDetail,
  type PalworldPalReference,
  type PalworldPalSummary,
  type PalworldSkill
} from "@streamops/shared";

export const PALWORLD_DATA_METADATA: PalworldDataMetadata = {
  gameVersion: "sample-baseline",
  sourceName: "StreamOverlay curated sample snapshot",
  sourceUrl: "https://github.com/seiga-tabi/StreamOverlay/blob/main/apps/server/src/data/PALWORLD_DATA.md",
  sourceRevision: "streamops-palworld-sample-2026-07-21",
  extractedAt: "2026-07-21T00:00:00.000Z",
  verifiedAt: "2026-07-21T00:00:00.000Z",
  license: "저장소 작성 샘플. 교배 구조 참고: tylercamp/palcalc MIT @ 59d70fecd99698021809b09760fa0a57adaefea2. Palworld 상표·게임 자산의 권리는 Pocketpair에 있습니다."
};

const PAL_SUMMARIES: PalworldPalSummary[] = [
  {
    id: "lamball",
    number: 1,
    nameKo: "램볼",
    nameJa: "モコロン",
    nameEn: "Lamball",
    elements: ["neutral"],
    rarity: 1,
    variantType: "normal",
    workSuitabilities: [
      { type: "handiwork", level: 1 },
      { type: "transporting", level: 1 },
      { type: "farming", level: 1 }
    ]
  },
  {
    id: "cattiva",
    number: 2,
    nameKo: "까부냥",
    nameJa: "ツッパニャン",
    nameEn: "Cattiva",
    elements: ["neutral"],
    rarity: 1,
    variantType: "normal",
    workSuitabilities: [
      { type: "handiwork", level: 1 },
      { type: "gathering", level: 1 },
      { type: "mining", level: 1 },
      { type: "transporting", level: 1 }
    ]
  },
  {
    id: "chikipi",
    number: 3,
    nameKo: "꼬꼬닭",
    nameJa: "タマコッコ",
    nameEn: "Chikipi",
    elements: ["neutral"],
    rarity: 1,
    variantType: "normal",
    workSuitabilities: [
      { type: "gathering", level: 1 },
      { type: "farming", level: 1 }
    ]
  },
  {
    id: "lifmunk",
    number: 4,
    nameKo: "큐룰리스",
    nameJa: "クルリス",
    nameEn: "Lifmunk",
    elements: ["grass"],
    rarity: 1,
    variantType: "normal",
    workSuitabilities: [
      { type: "planting", level: 1 },
      { type: "handiwork", level: 1 },
      { type: "gathering", level: 1 },
      { type: "lumbering", level: 1 },
      { type: "medicine_production", level: 1 }
    ]
  },
  {
    id: "foxparks",
    number: 5,
    nameKo: "파이호",
    nameJa: "キツネビ",
    nameEn: "Foxparks",
    elements: ["fire"],
    rarity: 1,
    variantType: "normal",
    workSuitabilities: [{ type: "kindling", level: 1 }]
  },
  {
    id: "sparkit",
    number: 7,
    nameKo: "번개냥",
    nameJa: "ボルトラ",
    nameEn: "Sparkit",
    elements: ["electric"],
    rarity: 1,
    variantType: "normal",
    workSuitabilities: [
      { type: "generating_electricity", level: 1 },
      { type: "handiwork", level: 1 },
      { type: "transporting", level: 1 }
    ]
  },
  {
    id: "pengullet",
    number: 10,
    nameKo: "펭키",
    nameJa: "ペンタマ",
    nameEn: "Pengullet",
    elements: ["water", "ice"],
    rarity: 1,
    variantType: "normal",
    workSuitabilities: [
      { type: "watering", level: 1 },
      { type: "handiwork", level: 1 },
      { type: "cooling", level: 1 },
      { type: "transporting", level: 1 }
    ]
  },
  {
    id: "penking",
    number: 11,
    nameKo: "펭킹",
    nameJa: "キャプペン",
    nameEn: "Penking",
    elements: ["water", "ice"],
    rarity: 6,
    variantType: "normal",
    workSuitabilities: [
      { type: "watering", level: 2 },
      { type: "handiwork", level: 2 },
      { type: "mining", level: 2 },
      { type: "cooling", level: 2 },
      { type: "transporting", level: 2 }
    ]
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
      { type: "handiwork", level: 1 },
      { type: "gathering", level: 1 },
      { type: "lumbering", level: 3 },
      { type: "transporting", level: 2 }
    ]
  },
  {
    id: "relaxaurus",
    number: 85,
    nameKo: "페스키",
    nameJa: "ペコドン",
    nameEn: "Relaxaurus",
    elements: ["dragon", "water"],
    rarity: 5,
    variantType: "normal",
    workSuitabilities: [
      { type: "watering", level: 2 },
      { type: "transporting", level: 1 }
    ]
  },
  {
    id: "relaxaurus-lux",
    number: 85,
    nameKo: "일렉판다",
    nameJa: "パリピドン",
    nameEn: "Relaxaurus Lux",
    elements: ["dragon", "electric"],
    rarity: 6,
    variantType: "variant",
    workSuitabilities: [
      { type: "generating_electricity", level: 3 },
      { type: "transporting", level: 1 }
    ]
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
      { type: "transporting", level: 2 }
    ]
  }
];

const ITEM_SUMMARIES: PalworldItemSummary[] = [
  {
    id: "wood",
    nameKo: "목재",
    nameJa: "木材",
    nameEn: "Wood",
    category: "material",
    rarity: 1,
    descriptionKo: "건축과 제작에 폭넓게 사용하는 기초 재료입니다.",
    descriptionJa: "建築やクラフトで幅広く使う基本素材です。",
    descriptionEn: "A basic material used broadly in building and crafting.",
    sellPrice: 1
  },
  {
    id: "stone",
    nameKo: "돌",
    nameJa: "石",
    nameEn: "Stone",
    category: "material",
    rarity: 1,
    descriptionKo: "시설과 도구 제작에 사용하는 기초 광물 재료입니다.",
    descriptionJa: "設備や道具の製作に使う基本的な鉱物素材です。",
    descriptionEn: "A basic mineral material for facilities and tools.",
    sellPrice: 1
  },
  {
    id: "fiber",
    nameKo: "섬유",
    nameJa: "繊維",
    nameEn: "Fiber",
    category: "material",
    rarity: 1,
    descriptionKo: "천과 여러 생활 도구에 사용하는 재료입니다.",
    descriptionJa: "布やさまざまな生活道具に使う素材です。",
    descriptionEn: "A material used for cloth and utility items.",
    sellPrice: 1
  },
  {
    id: "paldium-fragment",
    nameKo: "팰지움 파편",
    nameJa: "パルジウムの欠片",
    nameEn: "Paldium Fragment",
    category: "material",
    rarity: 1,
    descriptionKo: "Pal 관련 장비와 스피어 제작에 필요한 결정 파편입니다.",
    descriptionJa: "パル関連装備やスフィアの製作に必要な結晶片です。",
    descriptionEn: "A crystal fragment used for Pal gear and spheres.",
    sellPrice: 10
  },
  {
    id: "ore",
    nameKo: "금속 광석",
    nameJa: "金属鉱石",
    nameEn: "Ore",
    category: "material",
    rarity: 1,
    descriptionKo: "주괴 제련에 사용하는 광석입니다.",
    descriptionJa: "インゴットの精錬に使う鉱石です。",
    descriptionEn: "Ore used to smelt ingots.",
    sellPrice: 5
  },
  {
    id: "ingot",
    nameKo: "금속 주괴",
    nameJa: "金属インゴット",
    nameEn: "Ingot",
    category: "material",
    rarity: 2,
    descriptionKo: "고급 시설과 장비 제작에 사용하는 금속 재료입니다.",
    descriptionJa: "高度な設備や装備の製作に使う金属素材です。",
    descriptionEn: "A metal material used for advanced facilities and gear.",
    sellPrice: 20,
    technologyLevel: 10
  },
  {
    id: "leather",
    nameKo: "가죽",
    nameJa: "革",
    nameEn: "Leather",
    category: "material",
    rarity: 1,
    descriptionKo: "Pal 장비와 방어구 제작에 사용하는 재료입니다.",
    descriptionJa: "パル装備や防具の製作に使う素材です。",
    descriptionEn: "A material used for Pal gear and armor.",
    sellPrice: 15
  },
  {
    id: "pal-sphere",
    nameKo: "Pal 스피어",
    nameJa: "パルスフィア",
    nameEn: "Pal Sphere",
    category: "sphere",
    rarity: 1,
    descriptionKo: "낮은 등급의 Pal 포획에 사용하는 기본 스피어입니다.",
    descriptionJa: "低ランクのパル捕獲に使う基本スフィアです。",
    descriptionEn: "A basic sphere used to capture lower-tier Pals.",
    sellPrice: 10,
    technologyLevel: 2
  },
  {
    id: "mega-sphere",
    nameKo: "메가 스피어",
    nameJa: "メガスフィア",
    nameEn: "Mega Sphere",
    category: "sphere",
    rarity: 2,
    descriptionKo: "기본 스피어보다 높은 포획 성능을 가진 스피어입니다.",
    descriptionJa: "基本スフィアより高い捕獲性能を持つスフィアです。",
    descriptionEn: "A sphere with better capture performance than the basic model.",
    sellPrice: 100,
    technologyLevel: 14
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
    descriptionEn: "Rare parts used to craft ancient technology gear."
  }
];

function palReference(id: string): PalworldPalReference {
  const pal = PAL_SUMMARIES.find((candidate) => candidate.id === id);
  if (!pal) throw new TypeError(`Pal 참조를 찾을 수 없습니다: ${id}`);
  return {
    id: pal.id,
    number: pal.number,
    nameKo: pal.nameKo,
    nameJa: pal.nameJa,
    nameEn: pal.nameEn,
    ...(pal.imageUrl ? { imageUrl: pal.imageUrl } : {}),
    elements: [...pal.elements]
  };
}

function itemReference(id: string): PalworldItemReference {
  const item = ITEM_SUMMARIES.find((candidate) => candidate.id === id);
  if (!item) throw new TypeError(`아이템 참조를 찾을 수 없습니다: ${id}`);
  return {
    id: item.id,
    nameKo: item.nameKo,
    nameJa: item.nameJa,
    nameEn: item.nameEn,
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {})
  };
}

function activeSkill(
  id: string,
  names: { ko: string; ja: string; en: string },
  element: PalworldSkill["element"],
  power: number
): PalworldSkill {
  return {
    id,
    type: "active",
    nameKo: names.ko,
    nameJa: names.ja,
    nameEn: names.en,
    descriptionKo: `${names.ko}로 대상에게 피해를 줍니다.`,
    descriptionJa: `${names.ja}で対象にダメージを与えます。`,
    descriptionEn: `Deals damage with ${names.en}.`,
    element,
    power,
    cooldownSeconds: 2
  };
}

const ACTIVE_SKILLS = {
  neutral: activeSkill("air-cannon", { ko: "공기 대포", ja: "エアーキャノン", en: "Air Cannon" }, "neutral", 25),
  fire: activeSkill("ignis-blast", { ko: "파이어 샷", ja: "ファイアーショット", en: "Ignis Blast" }, "fire", 30),
  water: activeSkill("aqua-gun", { ko: "워터 제트", ja: "ウォータージェット", en: "Aqua Gun" }, "water", 30),
  electric: activeSkill("spark-blast", { ko: "스파크 샷", ja: "スパークショット", en: "Spark Blast" }, "electric", 30),
  grass: activeSkill("wind-cutter", { ko: "바람의 칼날", ja: "ウィンドカッター", en: "Wind Cutter" }, "grass", 30),
  ground: activeSkill("stone-blast", { ko: "스톤 샷", ja: "ストーンショット", en: "Stone Blast" }, "ground", 30),
  dragon: activeSkill("dragon-cannon", { ko: "용의 대포", ja: "ドラゴンキャノン", en: "Dragon Cannon" }, "dragon", 30)
} satisfies Record<string, PalworldSkill>;

function partnerSkill(pal: PalworldPalSummary): PalworldSkill {
  return {
    id: `${pal.id}-partner-skill`,
    type: "partner",
    nameKo: `${pal.nameKo} 파트너 스킬`,
    nameJa: `${pal.nameJa}のパートナースキル`,
    nameEn: `${pal.nameEn} Partner Skill`,
    descriptionKo: `${pal.nameKo}과(와) 함께할 때 사용할 수 있는 고유 능력입니다.`,
    descriptionJa: `${pal.nameJa}と一緒にいる時に使える固有能力です。`,
    descriptionEn: `A unique ability available while partnered with ${pal.nameEn}.`
  };
}

const PAL_DETAIL_SEEDS: Record<string, {
  stats: PalworldPalDetail["stats"];
  drops: string[];
  activeSkill: PalworldSkill;
  breedingPower: number;
  specialParentPairs?: Array<{ parentAId: string; parentBId: string }>;
}> = {
  lamball: { stats: { hp: 70, attack: 70, defense: 70, moveSpeed: 400, stamina: 100 }, drops: ["leather"], activeSkill: ACTIVE_SKILLS.neutral, breedingPower: 1470 },
  cattiva: { stats: { hp: 70, attack: 70, defense: 70, moveSpeed: 400, stamina: 100 }, drops: ["leather"], activeSkill: ACTIVE_SKILLS.neutral, breedingPower: 1460 },
  chikipi: { stats: { hp: 60, attack: 60, defense: 60, moveSpeed: 375, stamina: 100 }, drops: [], activeSkill: ACTIVE_SKILLS.neutral, breedingPower: 1500 },
  lifmunk: { stats: { hp: 75, attack: 70, defense: 70, moveSpeed: 400, stamina: 100 }, drops: [], activeSkill: ACTIVE_SKILLS.grass, breedingPower: 1430 },
  foxparks: { stats: { hp: 65, attack: 75, defense: 70, moveSpeed: 400, stamina: 100 }, drops: ["leather"], activeSkill: ACTIVE_SKILLS.fire, breedingPower: 1400 },
  sparkit: { stats: { hp: 60, attack: 75, defense: 70, moveSpeed: 350, stamina: 100 }, drops: [], activeSkill: ACTIVE_SKILLS.electric, breedingPower: 1410 },
  pengullet: { stats: { hp: 70, attack: 75, defense: 70, moveSpeed: 500, stamina: 100 }, drops: [], activeSkill: ACTIVE_SKILLS.water, breedingPower: 1350 },
  penking: { stats: { hp: 95, attack: 95, defense: 95, moveSpeed: 450, stamina: 100 }, drops: ["ancient-technology-parts"], activeSkill: ACTIVE_SKILLS.water, breedingPower: 520 },
  bushi: { stats: { hp: 80, attack: 125, defense: 80, moveSpeed: 600, stamina: 100 }, drops: ["ingot"], activeSkill: ACTIVE_SKILLS.fire, breedingPower: 640 },
  relaxaurus: { stats: { hp: 110, attack: 100, defense: 70, moveSpeed: 650, stamina: 100 }, drops: [], activeSkill: ACTIVE_SKILLS.dragon, breedingPower: 280 },
  "relaxaurus-lux": {
    stats: { hp: 110, attack: 110, defense: 75, moveSpeed: 650, stamina: 100 },
    drops: [],
    activeSkill: ACTIVE_SKILLS.electric,
    breedingPower: 280,
    specialParentPairs: [{ parentAId: "relaxaurus", parentBId: "sparkit" }]
  },
  anubis: {
    stats: { hp: 120, attack: 130, defense: 100, moveSpeed: 800, stamina: 100 },
    drops: ["ancient-technology-parts"],
    activeSkill: ACTIVE_SKILLS.ground,
    breedingPower: 570,
    specialParentPairs: [{ parentAId: "penking", parentBId: "bushi" }]
  }
};

const PALS: PalworldPalDetail[] = PAL_SUMMARIES.map((pal) => {
  const seed = PAL_DETAIL_SEEDS[pal.id];
  if (!seed) throw new TypeError(`Pal 상세 seed를 찾을 수 없습니다: ${pal.id}`);
  return {
    ...pal,
    stats: seed.stats,
    partnerSkill: partnerSkill(pal),
    activeSkills: [seed.activeSkill],
    drops: seed.drops.map(itemReference),
    breeding: {
      breedingPower: seed.breedingPower,
      specialParentPairs: seed.specialParentPairs ?? []
    },
    metadata: PALWORLD_DATA_METADATA
  };
});

const PRIMITIVE_WORKBENCH = {
  id: "primitive-workbench",
  nameKo: "원시적인 작업대",
  nameJa: "原始的な作業台",
  nameEn: "Primitive Workbench"
};

const ITEM_DETAIL_SEEDS: Record<string, Omit<PalworldItemDetail, keyof PalworldItemSummary | "metadata"> & {
  materialIds: Array<{ id: string; quantity: number }>;
  dropPalIds: string[];
  relatedItemIds: string[];
}> = {
  wood: {
    craftingMaterials: [], materialIds: [], craftingFacility: undefined, dropPals: [], dropPalIds: [],
    acquisitionMethods: [{ type: "gathering", labelKo: "벌목으로 획득", labelJa: "伐採で入手", labelEn: "Obtained by logging" }],
    relatedItems: [], relatedItemIds: []
  },
  stone: {
    craftingMaterials: [], materialIds: [], craftingFacility: undefined, dropPals: [], dropPalIds: [],
    acquisitionMethods: [{ type: "gathering", labelKo: "채굴로 획득", labelJa: "採掘で入手", labelEn: "Obtained by mining" }],
    relatedItems: [], relatedItemIds: []
  },
  fiber: {
    craftingMaterials: [], materialIds: [{ id: "wood", quantity: 1 }], craftingFacility: PRIMITIVE_WORKBENCH, dropPals: [], dropPalIds: [],
    acquisitionMethods: [{ type: "craft", labelKo: "목재를 가공해 제작", labelJa: "木材を加工して製作", labelEn: "Crafted from wood" }],
    relatedItems: [], relatedItemIds: ["wood"]
  },
  "paldium-fragment": {
    craftingMaterials: [], materialIds: [], craftingFacility: undefined, dropPals: [], dropPalIds: [],
    acquisitionMethods: [{ type: "gathering", labelKo: "푸른 광석을 채굴해 획득", labelJa: "青い鉱石を採掘して入手", labelEn: "Mined from blue ore nodes" }],
    relatedItems: [], relatedItemIds: ["pal-sphere", "mega-sphere"]
  },
  ore: {
    craftingMaterials: [], materialIds: [], craftingFacility: undefined, dropPals: [], dropPalIds: [],
    acquisitionMethods: [{ type: "gathering", labelKo: "광상에서 채굴", labelJa: "鉱床から採掘", labelEn: "Mined from ore deposits" }],
    relatedItems: [], relatedItemIds: ["ingot"]
  },
  ingot: {
    craftingMaterials: [], materialIds: [{ id: "ore", quantity: 2 }],
    craftingFacility: { id: "primitive-furnace", nameKo: "원시적인 용광로", nameJa: "原始的な炉", nameEn: "Primitive Furnace" },
    dropPals: [], dropPalIds: ["bushi"],
    acquisitionMethods: [{ type: "craft", labelKo: "용광로에서 제련", labelJa: "炉で精錬", labelEn: "Smelted in a furnace" }],
    relatedItems: [], relatedItemIds: ["ore", "mega-sphere"]
  },
  leather: {
    craftingMaterials: [], materialIds: [], craftingFacility: undefined, dropPals: [], dropPalIds: ["lamball", "cattiva", "foxparks"],
    acquisitionMethods: [{ type: "drop", labelKo: "일부 Pal에게서 획득", labelJa: "一部のパルから入手", labelEn: "Dropped by some Pals" }],
    relatedItems: [], relatedItemIds: []
  },
  "pal-sphere": {
    craftingMaterials: [], materialIds: [{ id: "paldium-fragment", quantity: 1 }, { id: "wood", quantity: 3 }, { id: "stone", quantity: 3 }],
    craftingFacility: PRIMITIVE_WORKBENCH, dropPals: [], dropPalIds: [],
    acquisitionMethods: [
      { type: "craft", labelKo: "작업대에서 제작", labelJa: "作業台で製作", labelEn: "Crafted at a workbench" },
      { type: "chest", labelKo: "필드 상자에서 획득 가능", labelJa: "フィールドの宝箱から入手可能", labelEn: "Can be found in field chests" }
    ],
    relatedItems: [], relatedItemIds: ["mega-sphere"]
  },
  "mega-sphere": {
    craftingMaterials: [], materialIds: [{ id: "paldium-fragment", quantity: 2 }, { id: "ingot", quantity: 1 }, { id: "wood", quantity: 5 }],
    craftingFacility: { id: "sphere-workbench", nameKo: "스피어 제작대", nameJa: "スフィア製作台", nameEn: "Sphere Workbench" },
    dropPals: [], dropPalIds: [],
    acquisitionMethods: [{ type: "craft", labelKo: "스피어 제작대에서 제작", labelJa: "スフィア製作台で製作", labelEn: "Crafted at a sphere workbench" }],
    relatedItems: [], relatedItemIds: ["pal-sphere"]
  },
  "ancient-technology-parts": {
    craftingMaterials: [], materialIds: [], craftingFacility: undefined, dropPals: [], dropPalIds: ["penking", "anubis"],
    acquisitionMethods: [{ type: "drop", labelKo: "강력한 Pal 보상에서 획득", labelJa: "強力なパルの報酬から入手", labelEn: "Obtained as a reward from powerful Pals" }],
    relatedItems: [], relatedItemIds: []
  }
};

const ITEMS: PalworldItemDetail[] = ITEM_SUMMARIES.map((item) => {
  const seed = ITEM_DETAIL_SEEDS[item.id];
  if (!seed) throw new TypeError(`아이템 상세 seed를 찾을 수 없습니다: ${item.id}`);
  return {
    ...item,
    craftingMaterials: seed.materialIds.map((material) => ({
      item: itemReference(material.id),
      quantity: material.quantity
    })),
    ...(seed.craftingFacility ? { craftingFacility: seed.craftingFacility } : {}),
    dropPals: seed.dropPalIds.map(palReference),
    acquisitionMethods: seed.acquisitionMethods,
    relatedItems: seed.relatedItemIds.map(itemReference),
    metadata: PALWORLD_DATA_METADATA
  };
});

const RAW_SNAPSHOT: PalworldDataSnapshot = {
  metadata: PALWORLD_DATA_METADATA,
  pals: PALS,
  items: ITEMS,
  breedingPairs: [
    {
      id: "lamball-lamball-lamball",
      parentA: palReference("lamball"),
      parentB: palReference("lamball"),
      child: palReference("lamball"),
      isSpecial: false
    },
    {
      id: "relaxaurus-sparkit-relaxaurus-lux",
      parentA: palReference("relaxaurus"),
      parentB: palReference("sparkit"),
      child: palReference("relaxaurus-lux"),
      isSpecial: true
    },
    {
      id: "penking-bushi-anubis",
      parentA: palReference("penking"),
      parentB: palReference("bushi"),
      child: palReference("anubis"),
      isSpecial: true
    }
  ]
};

export const PALWORLD_SNAPSHOT = assertPalworldDataSnapshot(RAW_SNAPSHOT);
