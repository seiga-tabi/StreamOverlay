import {
  assertPalworldDataSnapshot,
  type PalworldAcquisitionMethod,
  type PalworldBreedingPair,
  type PalworldDataCoverage,
  type PalworldDataSnapshot,
  type PalworldDomainCoverageMap,
  type PalworldElement,
  type PalworldElementDefinition,
  type PalworldItemCategory,
  type PalworldItemDetail,
  type PalworldItemReference,
  type PalworldLocalizationFallback,
  type PalworldPalDetail,
  type PalworldPalReference,
  type PalworldSkill,
  type PalworldSkillDetail
} from "@streamops/shared";
import type {
  PalworldCatalogArtifact,
  PalworldCatalogItem,
  PalworldCatalogSkill
} from "./palworld-catalog-artifact.js";
import type { PalworldPaldexAdapterResult } from "./palworld-paldex-adapter.js";

const ENGLISH_FALLBACK: PalworldLocalizationFallback = {
  sourceLanguage: "en",
  ko: "source_language_fallback",
  ja: "source_language_fallback"
};

const ELEMENT_NAMES: Readonly<Record<PalworldElement, { ko: string; ja: string; en: string }>> = {
  neutral: { ko: "무속성", ja: "無属性", en: "Neutral" },
  fire: { ko: "불", ja: "炎", en: "Fire" },
  water: { ko: "물", ja: "水", en: "Water" },
  electric: { ko: "전기", ja: "雷", en: "Electric" },
  grass: { ko: "풀", ja: "草", en: "Grass" },
  ice: { ko: "얼음", ja: "氷", en: "Ice" },
  ground: { ko: "땅", ja: "地", en: "Ground" },
  dark: { ko: "어둠", ja: "闇", en: "Dark" },
  dragon: { ko: "용", ja: "竜", en: "Dragon" }
};

export type PalworldCatalogAdapterResult = {
  snapshot: PalworldDataSnapshot;
  domains: PalworldDomainCoverageMap;
  coverage: PalworldDataCoverage;
};

export type PalworldCatalogAdapterInput = {
  basePaldex: PalworldPaldexAdapterResult;
  catalog: PalworldCatalogArtifact;
  catalogChecksum: string;
  localizedSnapshot: PalworldDataSnapshot;
  sourceChecksum: string;
  sourceInternalIds: Readonly<Record<string, string>>;
  assetAvailability?: {
    items: boolean;
    elements: boolean;
  };
};

export class PalworldCatalogAdapterError extends Error {
  readonly code = "PALWORLD_CATALOG_ADAPTER_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PalworldCatalogAdapterError";
  }
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value as object)) return value;
  seen.add(value as object);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function palReference(pal: PalworldPalDetail): PalworldPalReference {
  return {
    id: pal.id,
    number: pal.number,
    nameKo: pal.nameKo,
    nameJa: pal.nameJa,
    nameEn: pal.nameEn,
    ...(pal.imageUrl === undefined ? {} : { imageUrl: pal.imageUrl }),
    ...(pal.imageWidth === undefined ? {} : { imageWidth: pal.imageWidth }),
    ...(pal.imageHeight === undefined ? {} : { imageHeight: pal.imageHeight }),
    elements: [...pal.elements]
  };
}

function catalogItemReference(
  item: PalworldCatalogItem,
  localizedItem: PalworldItemDetail | undefined,
  imagesAvailable: boolean
): PalworldItemReference {
  const localized = localizedItem !== undefined;
  return {
    id: item.id,
    ...(localizedItem?.nameKo === undefined ? {} : { nameKo: localizedItem.nameKo }),
    ...(localizedItem?.nameJa === undefined ? {} : { nameJa: localizedItem.nameJa }),
    nameEn: item.nameEn,
    ...(!imagesAvailable || item.imageUrl === undefined ? {} : { imageUrl: item.imageUrl }),
    ...(!imagesAvailable || item.imageWidth === undefined ? {} : { imageWidth: item.imageWidth }),
    ...(!imagesAvailable || item.imageHeight === undefined ? {} : { imageHeight: item.imageHeight }),
    localization: localized
      ? { sourceLanguage: "en", ko: "localized", ja: "localized" }
      : { ...ENGLISH_FALLBACK }
  };
}

function catalogSkill(skill: PalworldCatalogSkill, unlockLevel?: number): PalworldSkill {
  return {
    id: skill.id,
    type: skill.type,
    nameEn: skill.nameEn,
    ...(skill.descriptionEn === undefined ? {} : { descriptionEn: skill.descriptionEn }),
    ...(skill.element === undefined ? {} : { element: skill.element as PalworldElement }),
    ...(skill.power === undefined ? {} : { power: skill.power }),
    ...(skill.cooldownSeconds === undefined ? {} : { cooldownSeconds: skill.cooldownSeconds }),
    ...(unlockLevel === undefined ? {} : { unlockLevel }),
    ...(skill.passiveTier === undefined ? {} : { passiveTier: skill.passiveTier }),
    ...(skill.passiveAbility === undefined ? {} : { passiveAbility: skill.passiveAbility }),
    localization: { ...ENGLISH_FALLBACK }
  };
}

function acquisitionMethods(item: PalworldCatalogItem): PalworldAcquisitionMethod[] {
  const methods: PalworldAcquisitionMethod[] = [];
  if (item.craftingMaterials.length > 0) {
    methods.push({
      type: "craft",
      labelKo: "제작식 확인",
      labelJa: "製作レシピあり",
      labelEn: "Crafting recipe available"
    });
  }
  if (item.dropPalIds.length > 0) {
    methods.push({
      type: "drop",
      labelKo: "Pal 드롭",
      labelJa: "パルのドロップ",
      labelEn: "Pal drop"
    });
  }
  return methods;
}

function coverageCount(available: number, total: number): { available: number; missing: number; total: number } {
  if (!Number.isInteger(available) || !Number.isInteger(total) || available < 0 || total < available) {
    throw new TypeError("Palworld coverage 집계가 올바르지 않습니다.");
  }
  return { available, missing: total - available, total };
}

function adaptPalworldCatalogInternal(input: PalworldCatalogAdapterInput): PalworldCatalogAdapterResult {
  const basePaldex = input.basePaldex;
  const localizedSnapshot = assertPalworldDataSnapshot(input.localizedSnapshot);
  const catalog = input.catalog;
  const assetAvailability = input.assetAvailability ?? { items: true, elements: true };
  const metadata = {
    gameVersion: basePaldex.metadata.gameVersion,
    sourceName: `${basePaldex.metadata.sourceName} + ${catalog.metadata.sourceName}`,
    sourceUrl: basePaldex.metadata.sourceUrl,
    sourceRevision: `${basePaldex.metadata.sourceRevision}+catalog@${catalog.metadata.sourceRevision}`,
    sourceChecksum: input.sourceChecksum,
    extractedAt: catalog.metadata.extractedAt,
    verifiedAt: catalog.metadata.verifiedAt,
    license: `${basePaldex.metadata.license}; ${catalog.metadata.license}`,
    rightsVerified: false
  } as const;
  const catalogMetadata = {
    ...catalog.metadata,
    sourceChecksum: input.catalogChecksum,
    rightsVerified: false
  } as const;
  const basePalsById = new Map(basePaldex.pals.map((pal) => [pal.id, pal]));
  if (catalog.coverage.canonicalPals !== basePaldex.pals.length) {
    throw new TypeError("Palworld catalog canonical Pal coverage가 base snapshot과 일치하지 않습니다.");
  }
  const localizedItemsById = new Map(localizedSnapshot.items.map((item) => [item.id, item]));
  const catalogItemsById = new Map(catalog.items.map((item) => [item.id, item]));
  const itemReferences = new Map(catalog.items.map((item) => [
    item.id,
    catalogItemReference(item, localizedItemsById.get(item.id), assetAvailability.items)
  ]));
  const skillSourceById = new Map(catalog.skills.map((skill) => [skill.id, skill]));
  const palDetailsById = new Map(catalog.palDetails.map((detail) => [detail.palId, detail]));
  for (const detail of catalog.palDetails) {
    if (!basePalsById.has(detail.palId)) {
      throw new TypeError(`Palworld catalog Pal 상세가 base snapshot에 없습니다: ${detail.palId}`);
    }
    const sourceInternalId = input.sourceInternalIds[detail.palId];
    if (sourceInternalId === undefined || sourceInternalId !== detail.sourceInternalId) {
      throw new TypeError(`Palworld catalog Pal 원본 internal ID가 canonical mapping과 일치하지 않습니다: ${detail.palId}`);
    }
  }
  const activeAssignmentsByPal = new Map<string, typeof catalog.skillAssignments>();
  const partnerAssignmentsByPal = new Map<string, typeof catalog.skillAssignments>();
  const specialParentPairsByChild = new Map<string, typeof catalog.specialBreedingPairs>();

  for (const assignment of catalog.skillAssignments) {
    const target = assignment.kind === "active" ? activeAssignmentsByPal : partnerAssignmentsByPal;
    const entries = target.get(assignment.palId) ?? [];
    target.set(assignment.palId, [...entries, assignment]);
  }
  for (const pair of catalog.specialBreedingPairs) {
    if (!basePalsById.has(pair.parentAId) || !basePalsById.has(pair.parentBId) || !basePalsById.has(pair.childId)) {
      throw new TypeError(`Palworld catalog 특수 교배에 canonical Pal이 아닌 참조가 있습니다: ${pair.childId}`);
    }
    const entries = specialParentPairsByChild.get(pair.childId) ?? [];
    specialParentPairsByChild.set(pair.childId, [...entries, pair]);
  }

  const pals: PalworldPalDetail[] = basePaldex.pals.map((pal) => {
    const detail = palDetailsById.get(pal.id);
    const activeSkills = (activeAssignmentsByPal.get(pal.id) ?? []).map((assignment) => {
      const skill = skillSourceById.get(assignment.skillId);
      if (!skill) throw new TypeError(`Palworld active skill 참조가 없습니다: ${assignment.skillId}`);
      return catalogSkill(skill, assignment.unlockLevel);
    });
    const partnerAssignments = partnerAssignmentsByPal.get(pal.id) ?? [];
    if (partnerAssignments.length > 1) {
      throw new TypeError(`Palworld partner skill이 중복 연결되었습니다: ${pal.id}`);
    }
    const partnerAssignment = partnerAssignments[0];
    const partnerSource = partnerAssignment ? skillSourceById.get(partnerAssignment.skillId) : undefined;
    if (partnerAssignment && !partnerSource) {
      throw new TypeError(`Palworld partner skill 참조가 없습니다: ${partnerAssignment.skillId}`);
    }
    const dropDetails = (detail?.drops ?? []).flatMap((drop) => {
      const item = drop.itemId ? itemReferences.get(drop.itemId) : undefined;
      if (!item) return [];
      return [{
        item,
        minQuantity: drop.minimum,
        maxQuantity: drop.maximum,
        ...(drop.rate === undefined ? {} : { dropRatePercent: drop.rate })
      }];
    });
    const embeddedPartnerId = pal.partnerSkill?.id;
    if (embeddedPartnerId !== partnerSource?.id) {
      throw new TypeError(`Palworld Paldex·catalog partner skill이 일치하지 않습니다: ${pal.id}`);
    }
    const embeddedActive = pal.activeSkills
      .map((skill) => `${skill.id}\0${skill.unlockLevel ?? ""}`)
      .sort();
    const catalogActive = activeSkills
      .map((skill) => `${skill.id}\0${skill.unlockLevel ?? ""}`)
      .sort();
    if (JSON.stringify(embeddedActive) !== JSON.stringify(catalogActive)) {
      throw new TypeError(`Palworld Paldex·catalog active skill이 일치하지 않습니다: ${pal.id}`);
    }
    const embeddedDrops = pal.rawDrops.map((drop) => JSON.stringify(drop));
    const catalogDrops = (detail?.drops ?? []).map((drop) => JSON.stringify(drop));
    if (JSON.stringify(embeddedDrops) !== JSON.stringify(catalogDrops)) {
      throw new TypeError(`Palworld Paldex·catalog drop 상세가 일치하지 않습니다: ${pal.id}`);
    }
    if (pal.descriptionEn !== detail?.descriptionEn) {
      throw new TypeError(`Palworld Paldex·catalog 설명이 일치하지 않습니다: ${pal.id}`);
    }
    const embeddedSpecialPairs = pal.specialParentPairs.map((pair) => JSON.stringify(pair));
    const catalogSpecialPairs = (specialParentPairsByChild.get(pal.id) ?? []).map((pair) => JSON.stringify({
      parentAId: pair.parentAId,
      parentBId: pair.parentBId,
      ...(pair.parentAGender === undefined ? {} : { parentAGender: pair.parentAGender }),
      ...(pair.parentBGender === undefined ? {} : { parentBGender: pair.parentBGender })
    }));
    if (JSON.stringify(embeddedSpecialPairs) !== JSON.stringify(catalogSpecialPairs)) {
      throw new TypeError(`Palworld Paldex·catalog 특수 교배가 일치하지 않습니다: ${pal.id}`);
    }
    return {
      id: pal.id,
      number: pal.number,
      nameKo: pal.nameKo,
      nameJa: pal.nameJa,
      nameEn: pal.nameEn,
      ...(pal.imageUrl === undefined ? {} : { imageUrl: pal.imageUrl }),
      ...(pal.imageWidth === undefined ? {} : { imageWidth: pal.imageWidth }),
      ...(pal.imageHeight === undefined ? {} : { imageHeight: pal.imageHeight }),
      elements: [...pal.elements],
      rarity: pal.rarity,
      variantType: pal.variantType,
      workSuitabilities: pal.workSuitabilities.map((work) => ({ ...work })),
      stats: { ...pal.stats },
      nocturnal: pal.nocturnal,
      metadata: { ...metadata },
      ...(detail?.descriptionEn === undefined ? {} : {
        descriptionEn: detail.descriptionEn,
        localization: { ...ENGLISH_FALLBACK }
      }),
      ...(partnerSource === undefined ? {} : {
        partnerSkill: catalogSkill(partnerSource, partnerAssignment?.unlockLevel)
      }),
      activeSkills,
      drops: dropDetails.map((drop) => drop.item),
      ...(dropDetails.length === 0 ? {} : { dropDetails }),
      breeding: {
        breedingPower: pal.breedingPower,
        specialParentPairs: pal.specialParentPairs.map((pair) => ({ ...pair }))
      }
    };
  });
  const palsById = new Map(pals.map((pal) => [pal.id, pal]));

  const items: PalworldItemDetail[] = catalog.items.map((item) => {
    const localized = localizedItemsById.get(item.id);
    const reference = itemReferences.get(item.id)!;
    const materials = item.craftingMaterials.map((material) => {
      const materialItem = catalogItemsById.get(material.itemId);
      const materialReference = itemReferences.get(material.itemId);
      if (!materialItem || !materialReference) {
        throw new TypeError(`Palworld 제작 재료 참조가 없습니다: ${item.id} -> ${material.itemId}`);
      }
      return { item: materialReference, quantity: material.quantity };
    });
    const dropPals = item.dropPalIds.map((palId) => {
      const pal = palsById.get(palId);
      if (!pal) throw new TypeError(`Palworld item drop Pal 참조가 없습니다: ${item.id} -> ${palId}`);
      return palReference(pal);
    });
    return {
      ...reference,
      sourceInternalId: item.sourceInternalId,
      category: item.category as PalworldItemCategory,
      rarity: item.rarity,
      ...(localized?.descriptionKo === undefined ? {} : { descriptionKo: localized.descriptionKo }),
      ...(localized?.descriptionJa === undefined ? {} : { descriptionJa: localized.descriptionJa }),
      ...(item.descriptionEn === undefined ? {} : { descriptionEn: item.descriptionEn }),
      ...(item.sellPrice === undefined ? {} : { sellPrice: item.sellPrice }),
      ...(item.technologyLevel === undefined ? {} : { technologyLevel: item.technologyLevel }),
      weight: item.weight,
      maxStack: item.maxStack,
      ...(item.durability === undefined ? {} : { durability: item.durability }),
      craftingMaterials: materials,
      dropPals,
      acquisitionMethods: acquisitionMethods(item),
      relatedItems: [],
      metadata: { ...metadata }
    };
  });

  const skills: PalworldSkillDetail[] = catalog.skills.map((skill) => {
    const relatedAssignments = catalog.skillAssignments.filter((assignment) => assignment.skillId === skill.id);
    const unlockLevels = relatedAssignments.flatMap((assignment) =>
      assignment.unlockLevel === undefined ? [] : [assignment.unlockLevel]
    );
    const relatedPals = relatedAssignments.map((assignment) => {
      const pal = palsById.get(assignment.palId);
      if (!pal) throw new TypeError(`Palworld skill Pal 참조가 없습니다: ${skill.id} -> ${assignment.palId}`);
      return {
        pal: palReference(pal),
        ...(assignment.unlockLevel === undefined ? {} : { unlockLevel: assignment.unlockLevel })
      };
    });
    return {
      ...catalogSkill(skill, unlockLevels.length === 0 ? undefined : Math.min(...unlockLevels)),
      relatedPalCount: relatedPals.length,
      relatedPals,
      metadata: { ...metadata }
    };
  });

  const elements: PalworldElementDefinition[] = catalog.elements.map((element) => {
    const id = element.id as PalworldElement;
    const names = ELEMENT_NAMES[id];
    if (!names) throw new TypeError(`Palworld element 정의가 없습니다: ${element.id}`);
    return {
      id,
      nameKo: names.ko,
      nameJa: names.ja,
      nameEn: names.en,
      ...(assetAvailability.elements ? {
        iconUrl: element.imageUrl,
        imageWidth: element.imageWidth,
        imageHeight: element.imageHeight
      } : {})
    };
  });

  const breedingPairs: PalworldBreedingPair[] = localizedSnapshot.breedingPairs.map((pair) => {
    const parentA = palsById.get(pair.parentA.id);
    const parentB = palsById.get(pair.parentB.id);
    const child = palsById.get(pair.child.id);
    if (!parentA || !parentB || !child) {
      throw new TypeError(`Palworld 교배 참조가 없습니다: ${pair.id}`);
    }
    return {
      ...pair,
      parentA: palReference(parentA),
      parentB: palReference(parentB),
      child: palReference(child)
    };
  });

  const snapshot = assertPalworldDataSnapshot({
    metadata: { ...metadata },
    pals,
    items,
    breedingPairs,
    skills,
    elements
  });
  const localizedItemCount = items.filter((item) => item.nameKo && item.nameJa).length;
  const localizedTotal = pals.length + items.length + skills.length;
  const coverage: PalworldDataCoverage = {
    palDetails: coverageCount(catalog.coverage.exactPalDetails, pals.length),
    itemDetails: coverageCount(items.length, items.length),
    skillDetails: coverageCount(skills.filter((skill) => skill.descriptionEn).length, skills.length),
    palImages: coverageCount(pals.filter((pal) => pal.imageUrl).length, pals.length),
    itemImages: coverageCount(items.filter((item) => item.imageUrl).length, items.length),
    elementImages: coverageCount(elements.filter((element) => element.iconUrl).length, elements.length),
    localization: {
      ko: coverageCount(pals.length + localizedItemCount, localizedTotal),
      ja: coverageCount(pals.length + localizedItemCount, localizedTotal),
      en: coverageCount(localizedTotal, localizedTotal)
    }
  };
  const domains: PalworldDomainCoverageMap = {
    pals: {
      status: "ready",
      recordCount: pals.length,
      metadata: { ...metadata }
    },
    items: {
      status: localizedItemCount === items.length ? "ready" : "incomplete",
      recordCount: items.length,
      metadata: { ...catalogMetadata }
    },
    breeding: {
      status: "sample",
      recordCount: localizedSnapshot.breedingPairs.length,
      metadata: { ...localizedSnapshot.metadata }
    },
    skills: {
      status: "incomplete",
      recordCount: skills.length,
      metadata: { ...catalogMetadata }
    }
  };
  return deepFreeze({ snapshot, domains, coverage });
}

export function adaptPalworldCatalog(input: PalworldCatalogAdapterInput): PalworldCatalogAdapterResult {
  try {
    return adaptPalworldCatalogInternal(input);
  } catch (error) {
    if (error instanceof PalworldCatalogAdapterError) throw error;
    const message = error instanceof Error ? error.message : "알 수 없는 catalog adapter 오류";
    throw new PalworldCatalogAdapterError(message);
  }
}
