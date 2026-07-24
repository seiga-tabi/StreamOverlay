import {
  assertPalworldDataSnapshot,
  type PalworldAcquisitionMethod,
  type PalworldDataCoverage,
  type PalworldDataSnapshot,
  type PalworldDomainCoverageMap,
  type PalworldElement,
  type PalworldElementDefinition,
  type PalworldItemCategory,
  type PalworldItemDetail,
  type PalworldItemReference,
  type PalworldPalDetail,
  type PalworldPalReference,
  type PalworldSkill,
  type PalworldSkillDetail,
  type PalworldTranslationDisplayStatus,
  type PalworldTranslationField,
  type PalworldTranslationFieldValue,
  type PalworldTranslationLocale,
  type PalworldTranslationRecordKind,
  type PalworldTranslationSnapshot,
  type PalworldTranslationDomainCoverage
} from "@streamops/shared";
import type {
  PalworldCatalogArtifact,
  PalworldCatalogItem,
  PalworldCatalogSkill
} from "./palworld-catalog-artifact.js";
import type { PalworldPaldexAdapterResult } from "./palworld-paldex-adapter.js";
import {
  localizedReviewedItemsByCanonicalId,
  type PalworldReviewedItemAlias
} from "./palworld-reviewed-item-aliases.js";

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
    items: boolean | ReadonlySet<string>;
    elements: boolean | ReadonlySet<string>;
  };
  translations?: {
    snapshots: Partial<Record<PalworldTranslationLocale, PalworldTranslationSnapshot>>;
    staleSourceHash: Record<PalworldTranslationLocale, boolean>;
  };
  reviewedItemAliases?: readonly PalworldReviewedItemAlias[];
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

type TranslationRecordIndex = Readonly<Record<PalworldTranslationLocale, ReadonlyMap<string, PalworldTranslationSnapshot["records"][number]>>>;

function translationRecordKey(kind: PalworldTranslationRecordKind, id: string): string {
  return `${kind}:${id}`;
}

function createTranslationRecordIndex(
  snapshots: Partial<Record<PalworldTranslationLocale, PalworldTranslationSnapshot>>
): TranslationRecordIndex {
  return {
    ko: new Map((snapshots.ko?.records ?? []).map((record) => [translationRecordKey(record.kind, record.id), record])),
    ja: new Map((snapshots.ja?.records ?? []).map((record) => [translationRecordKey(record.kind, record.id), record]))
  };
}

function translatedField(
  index: TranslationRecordIndex,
  locale: PalworldTranslationLocale,
  kind: PalworldTranslationRecordKind,
  id: string,
  field: PalworldTranslationField
): PalworldTranslationFieldValue | undefined {
  const translated = index[locale].get(translationRecordKey(kind, id))?.fields[field];
  // 이름은 의미 품질 검증이 설명보다 엄격해야 한다. 현재 machine-assisted
  // 아이템·스킬 이름은 검수 완료 전까지 공개하지 않고 영문 원문으로 되돌린다.
  if (
    field === "name"
    && kind !== "pal"
    && translated?.status === "machine_assisted"
  ) {
    return undefined;
  }
  return translated;
}

function displayStatus(
  translation: PalworldTranslationFieldValue | undefined,
  hasExistingLocale: boolean,
  hasSource: boolean
): PalworldTranslationDisplayStatus {
  if (translation !== undefined) return translation.status;
  if (hasExistingLocale) return "human_reviewed";
  return hasSource ? "source_language_fallback" : "missing_source";
}

function legacyLocalizationStatus(
  nameAvailable: boolean,
  descriptionAvailable: boolean,
  hasDescription: boolean
): "localized" | "source_language_fallback" {
  return nameAvailable && (!hasDescription || descriptionAvailable) ? "localized" : "source_language_fallback";
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
    elements: [...pal.elements],
    ...(pal.translation?.name === undefined ? {} : {
      translation: { name: { ...pal.translation.name } }
    })
  };
}

function catalogItemReference(
  item: PalworldCatalogItem,
  localizedItem: PalworldItemDetail | undefined,
  imagesAvailable: boolean | ReadonlySet<string>,
  translations: TranslationRecordIndex
): PalworldItemReference {
  const translatedNameKo = translatedField(translations, "ko", "item", item.id, "name");
  const translatedNameJa = translatedField(translations, "ja", "item", item.id, "name");
  // 검증된 공식 locale(source_provided)을 기존 sample/legacy 이름보다 우선합니다.
  // machine-assisted item 이름은 translatedField()에서 계속 차단됩니다.
  const nameKo = translatedNameKo?.text ?? localizedItem?.nameKo;
  const nameJa = translatedNameJa?.text ?? localizedItem?.nameJa;
  const imageAvailable = typeof imagesAvailable === "boolean"
    ? imagesAvailable
    : imagesAvailable.has(item.id);
  return {
    id: item.id,
    ...(nameKo === undefined ? {} : { nameKo }),
    ...(nameJa === undefined ? {} : { nameJa }),
    nameEn: item.nameEn,
    ...(!imageAvailable || item.imageUrl === undefined ? {} : { imageUrl: item.imageUrl }),
    ...(!imageAvailable || item.imageWidth === undefined ? {} : { imageWidth: item.imageWidth }),
    ...(!imageAvailable || item.imageHeight === undefined ? {} : { imageHeight: item.imageHeight }),
    localization: {
      sourceLanguage: "en",
      ko: nameKo === undefined ? "source_language_fallback" : "localized",
      ja: nameJa === undefined ? "source_language_fallback" : "localized"
    },
    translation: {
      name: {
        ko: displayStatus(
          translatedNameKo,
          translatedNameKo === undefined && localizedItem?.nameKo !== undefined,
          true
        ),
        ja: displayStatus(
          translatedNameJa,
          translatedNameJa === undefined && localizedItem?.nameJa !== undefined,
          true
        )
      }
    }
  };
}

function catalogSkill(
  skill: PalworldCatalogSkill,
  translations: TranslationRecordIndex,
  unlockLevel?: number
): PalworldSkill {
  const nameKo = translatedField(translations, "ko", "skill", skill.id, "name");
  const nameJa = translatedField(translations, "ja", "skill", skill.id, "name");
  const descriptionKo = translatedField(translations, "ko", "skill", skill.id, "description");
  const descriptionJa = translatedField(translations, "ja", "skill", skill.id, "description");
  const passiveAbilityKo = translatedField(translations, "ko", "skill", skill.id, "passiveAbility");
  const passiveAbilityJa = translatedField(translations, "ja", "skill", skill.id, "passiveAbility");
  return {
    id: skill.id,
    type: skill.type,
    ...(nameKo === undefined ? {} : { nameKo: nameKo.text }),
    ...(nameJa === undefined ? {} : { nameJa: nameJa.text }),
    nameEn: skill.nameEn,
    ...(descriptionKo === undefined ? {} : { descriptionKo: descriptionKo.text }),
    ...(descriptionJa === undefined ? {} : { descriptionJa: descriptionJa.text }),
    ...(skill.descriptionEn === undefined ? {} : { descriptionEn: skill.descriptionEn }),
    ...(skill.element === undefined ? {} : { element: skill.element as PalworldElement }),
    ...(skill.power === undefined ? {} : { power: skill.power }),
    ...(skill.cooldownSeconds === undefined ? {} : { cooldownSeconds: skill.cooldownSeconds }),
    ...(unlockLevel === undefined ? {} : { unlockLevel }),
    ...(skill.passiveTier === undefined ? {} : { passiveTier: skill.passiveTier }),
    ...(skill.passiveAbility === undefined ? {} : { passiveAbility: skill.passiveAbility }),
    ...(passiveAbilityKo === undefined ? {} : { passiveAbilityKo: passiveAbilityKo.text }),
    ...(passiveAbilityJa === undefined ? {} : { passiveAbilityJa: passiveAbilityJa.text }),
    localization: {
      sourceLanguage: "en",
      ko: legacyLocalizationStatus(nameKo !== undefined, descriptionKo !== undefined, skill.descriptionEn !== undefined),
      ja: legacyLocalizationStatus(nameJa !== undefined, descriptionJa !== undefined, skill.descriptionEn !== undefined)
    },
    translation: {
      name: {
        ko: displayStatus(nameKo, false, true),
        ja: displayStatus(nameJa, false, true)
      },
      description: {
        ko: displayStatus(descriptionKo, false, skill.descriptionEn !== undefined),
        ja: displayStatus(descriptionJa, false, skill.descriptionEn !== undefined)
      },
      ...(skill.type !== "passive" ? {} : {
        passiveAbility: {
          ko: displayStatus(passiveAbilityKo, false, skill.passiveAbility !== undefined),
          ja: displayStatus(passiveAbilityJa, false, skill.passiveAbility !== undefined)
        }
      })
    }
  };
}

function acquisitionMethods(item: PalworldCatalogItem): PalworldAcquisitionMethod[] {
  const methods: PalworldAcquisitionMethod[] = [];
  if (item.craftingMaterials.length > 0) {
    methods.push({
      type: "craft",
      labelKo: "제작식 확인",
      labelJa: "製作レシピあり",
      labelEn: "Crafting recipe available",
      translation: {
        label: { ko: "human_reviewed", ja: "human_reviewed" }
      }
    });
  }
  if (item.dropPalIds.length > 0) {
    methods.push({
      type: "drop",
      labelKo: "Pal 드롭",
      labelJa: "パルのドロップ",
      labelEn: "Pal drop",
      translation: {
        label: { ko: "human_reviewed", ja: "human_reviewed" }
      }
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

function isTranslated(status: PalworldTranslationDisplayStatus | undefined): boolean {
  return status === "source_provided"
    || status === "human_reviewed"
    || status === "machine_assisted";
}

function translationCoverageForLocale(
  locale: PalworldTranslationLocale,
  pals: PalworldPalDetail[],
  items: PalworldItemDetail[],
  skills: PalworldSkillDetail[],
  staleSourceHash: boolean,
  artifactTranslated: number
): PalworldTranslationDomainCoverage {
  const palDescriptionSources = pals.filter((pal) => pal.descriptionEn !== undefined);
  const itemDescriptionSources = items.filter((item) => item.descriptionEn !== undefined);
  const skillDescriptionSources = skills.filter((skill) => skill.descriptionEn !== undefined);
  const skillPassiveAbilitySources = skills.filter((skill) => skill.passiveAbility !== undefined);
  const displayStatuses: PalworldTranslationDisplayStatus[] = [
    ...pals.flatMap((pal) => [pal.translation?.name?.[locale], pal.translation?.description?.[locale]]),
    ...items.flatMap((item) => [item.translation?.name?.[locale], item.translation?.description?.[locale]]),
    ...skills.flatMap((skill) => [
      skill.translation?.name?.[locale],
      skill.translation?.description?.[locale],
      ...(skill.type === "passive" ? [skill.translation?.passiveAbility?.[locale]] : [])
    ])
  ].filter((status): status is PalworldTranslationDisplayStatus => status !== undefined);
  const sourceFieldTotal = pals.length
    + palDescriptionSources.length
    + items.length
    + itemDescriptionSources.length
    + skills.length
    + skillDescriptionSources.length
    + skillPassiveAbilitySources.length;
  return {
    palNames: coverageCount(pals.filter((pal) => isTranslated(pal.translation?.name?.[locale])).length, pals.length),
    palDescriptions: coverageCount(
      palDescriptionSources.filter((pal) => isTranslated(pal.translation?.description?.[locale])).length,
      palDescriptionSources.length
    ),
    itemNames: coverageCount(items.filter((item) => isTranslated(item.translation?.name?.[locale])).length, items.length),
    itemDescriptions: coverageCount(
      itemDescriptionSources.filter((item) => isTranslated(item.translation?.description?.[locale])).length,
      itemDescriptionSources.length
    ),
    skillNames: coverageCount(skills.filter((skill) => isTranslated(skill.translation?.name?.[locale])).length, skills.length),
    skillDescriptions: coverageCount(
      skillDescriptionSources.filter((skill) => isTranslated(skill.translation?.description?.[locale])).length,
      skillDescriptionSources.length
    ),
    skillPassiveAbilities: coverageCount(
      skillPassiveAbilitySources.filter((skill) => isTranslated(skill.translation?.passiveAbility?.[locale])).length,
      skillPassiveAbilitySources.length
    ),
    artifactTranslated,
    publicUsable: displayStatuses.filter((status) => isTranslated(status)).length,
    sourceProvided: displayStatuses.filter((status) => status === "source_provided").length,
    humanReviewed: displayStatuses.filter((status) => status === "human_reviewed").length,
    machineAssisted: displayStatuses.filter((status) => status === "machine_assisted").length,
    sourceLanguageFallback: displayStatuses.filter((status) => status === "source_language_fallback").length,
    missingSource: displayStatuses.filter((status) => status === "missing_source").length,
    staleSourceHash: staleSourceHash ? sourceFieldTotal : 0
  };
}

function adaptPalworldCatalogInternal(input: PalworldCatalogAdapterInput): PalworldCatalogAdapterResult {
  const basePaldex = input.basePaldex;
  const localizedSnapshot = assertPalworldDataSnapshot(input.localizedSnapshot);
  const catalog = input.catalog;
  const assetAvailability = input.assetAvailability ?? { items: true, elements: true };
  const translationIndex = createTranslationRecordIndex(input.translations?.snapshots ?? {});
  const metadata = {
    gameVersion: basePaldex.metadata.gameVersion,
    ...(basePaldex.metadata.release === undefined
      || basePaldex.metadata.steamBuildId === undefined
      ? {}
      : {
          release: basePaldex.metadata.release,
          steamBuildId: basePaldex.metadata.steamBuildId
        }),
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
  for (const [canonicalId, item] of localizedReviewedItemsByCanonicalId(input.reviewedItemAliases ?? [])) {
    if (localizedItemsById.has(canonicalId)) {
      throw new TypeError(`Palworld 검수 아이템 alias가 기존 locale ID와 충돌합니다: ${canonicalId}`);
    }
    localizedItemsById.set(canonicalId, item);
  }
  const catalogItemsById = new Map(catalog.items.map((item) => [item.id, item]));
  const itemReferences = new Map(catalog.items.map((item) => [
    item.id,
    catalogItemReference(item, localizedItemsById.get(item.id), assetAvailability.items, translationIndex)
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
    const nameKoTranslation = translatedField(translationIndex, "ko", "pal", pal.id, "name");
    const nameJaTranslation = translatedField(translationIndex, "ja", "pal", pal.id, "name");
    const descriptionKoTranslation = translatedField(translationIndex, "ko", "pal", pal.id, "description");
    const descriptionJaTranslation = translatedField(translationIndex, "ja", "pal", pal.id, "description");
    const activeSkills = (activeAssignmentsByPal.get(pal.id) ?? []).map((assignment) => {
      const skill = skillSourceById.get(assignment.skillId);
      if (!skill) throw new TypeError(`Palworld active skill 참조가 없습니다: ${assignment.skillId}`);
      return catalogSkill(skill, translationIndex, assignment.unlockLevel);
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
      nameKo: nameKoTranslation?.text ?? pal.nameKo,
      nameJa: nameJaTranslation?.text ?? pal.nameJa,
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
        ...(descriptionKoTranslation === undefined ? {} : { descriptionKo: descriptionKoTranslation.text }),
        ...(descriptionJaTranslation === undefined ? {} : { descriptionJa: descriptionJaTranslation.text }),
        descriptionEn: detail.descriptionEn,
        localization: {
          sourceLanguage: "en" as const,
          ko: descriptionKoTranslation === undefined ? "source_language_fallback" as const : "localized" as const,
          ja: descriptionJaTranslation === undefined ? "source_language_fallback" as const : "localized" as const
        }
      }),
      translation: {
        name: {
          ko: displayStatus(nameKoTranslation, true, true),
          ja: displayStatus(nameJaTranslation, true, true)
        },
        description: {
          ko: displayStatus(descriptionKoTranslation, false, detail?.descriptionEn !== undefined),
          ja: displayStatus(descriptionJaTranslation, false, detail?.descriptionEn !== undefined)
        }
      },
      ...(partnerSource === undefined ? {} : {
        partnerSkill: catalogSkill(partnerSource, translationIndex, partnerAssignment?.unlockLevel)
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
    const descriptionKoTranslation = translatedField(translationIndex, "ko", "item", item.id, "description");
    const descriptionJaTranslation = translatedField(translationIndex, "ja", "item", item.id, "description");
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
      ...(descriptionKoTranslation?.text === undefined && localized?.descriptionKo === undefined ? {} : {
        descriptionKo: descriptionKoTranslation?.text ?? localized!.descriptionKo!
      }),
      ...(descriptionJaTranslation?.text === undefined && localized?.descriptionJa === undefined ? {} : {
        descriptionJa: descriptionJaTranslation?.text ?? localized!.descriptionJa!
      }),
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
      translation: {
        name: { ...reference.translation!.name! },
        description: {
          ko: displayStatus(descriptionKoTranslation, localized?.descriptionKo !== undefined, item.descriptionEn !== undefined),
          ja: displayStatus(descriptionJaTranslation, localized?.descriptionJa !== undefined, item.descriptionEn !== undefined)
        }
      },
      localization: {
        sourceLanguage: "en",
        ko: legacyLocalizationStatus(
          reference.nameKo !== undefined,
          descriptionKoTranslation !== undefined || localized?.descriptionKo !== undefined,
          item.descriptionEn !== undefined
        ),
        ja: legacyLocalizationStatus(
          reference.nameJa !== undefined,
          descriptionJaTranslation !== undefined || localized?.descriptionJa !== undefined,
          item.descriptionEn !== undefined
        )
      },
      metadata: { ...metadata },
      domainMetadata: { ...catalogMetadata }
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
      ...catalogSkill(skill, translationIndex, unlockLevels.length === 0 ? undefined : Math.min(...unlockLevels)),
      relatedPalCount: relatedPals.length,
      relatedPals,
      metadata: { ...metadata },
      domainMetadata: { ...catalogMetadata }
    };
  });

  const elements: PalworldElementDefinition[] = catalog.elements.map((element) => {
    const id = element.id as PalworldElement;
    const names = ELEMENT_NAMES[id];
    if (!names) throw new TypeError(`Palworld element 정의가 없습니다: ${element.id}`);
    const imageAvailable = typeof assetAvailability.elements === "boolean"
      ? assetAvailability.elements
      : assetAvailability.elements.has(element.id);
    return {
      id,
      nameKo: names.ko,
      nameJa: names.ja,
      nameEn: names.en,
      ...(imageAvailable ? {
        iconUrl: element.imageUrl,
        imageWidth: element.imageWidth,
        imageHeight: element.imageHeight
      } : {})
    };
  });

  const snapshot = assertPalworldDataSnapshot({
    metadata: { ...metadata },
    pals,
    items,
    breedingPairs: [],
    skills,
    elements
  });
  const localizedItemCount = items.filter((item) => item.nameKo && item.nameJa).length;
  const localizedSkillKoCount = skills.filter((skill) => skill.nameKo !== undefined).length;
  const localizedSkillJaCount = skills.filter((skill) => skill.nameJa !== undefined).length;
  const localizedItemKoCount = items.filter((item) => item.nameKo !== undefined).length;
  const localizedItemJaCount = items.filter((item) => item.nameJa !== undefined).length;
  const localizedTotal = pals.length + items.length + skills.length;
  const coverage: PalworldDataCoverage = {
    palDetails: coverageCount(catalog.coverage.exactPalDetails, pals.length),
    itemDetails: coverageCount(items.length, items.length),
    skillDetails: coverageCount(skills.filter((skill) => skill.descriptionEn).length, skills.length),
    palDescriptions: coverageCount(
      pals.filter((pal) => pal.descriptionKo !== undefined || pal.descriptionJa !== undefined || pal.descriptionEn !== undefined).length,
      pals.length
    ),
    palStats: coverageCount(pals.filter((pal) => pal.stats !== undefined).length, pals.length),
    partnerSkills: coverageCount(pals.filter((pal) => pal.partnerSkill !== undefined).length, pals.length),
    activeSkills: coverageCount(pals.filter((pal) => pal.activeSkills.length > 0).length, pals.length),
    palDrops: coverageCount(pals.filter((pal) => (pal.dropDetails?.length ?? pal.drops.length) > 0).length, pals.length),
    breedingFields: coverageCount(pals.filter((pal) => pal.breeding.breedingPower !== undefined).length, pals.length),
    itemDescriptions: coverageCount(
      items.filter((item) => item.descriptionKo !== undefined || item.descriptionJa !== undefined || item.descriptionEn !== undefined).length,
      items.length
    ),
    craftingRecipes: coverageCount(items.filter((item) => item.craftingMaterials.length > 0).length, items.length),
    craftingFacilities: coverageCount(items.filter((item) => item.craftingFacility !== undefined).length, items.length),
    dropPals: coverageCount(items.filter((item) => item.dropPals.length > 0).length, items.length),
    technologyLevels: coverageCount(items.filter((item) => item.technologyLevel !== undefined).length, items.length),
    prices: coverageCount(items.filter((item) => item.sellPrice !== undefined).length, items.length),
    durability: coverageCount(items.filter((item) => item.durability !== undefined).length, items.length),
    acquisitionMethods: coverageCount(items.filter((item) => item.acquisitionMethods.length > 0).length, items.length),
    skillDescriptions: coverageCount(
      skills.filter((skill) =>
        skill.descriptionKo !== undefined || skill.descriptionJa !== undefined || skill.descriptionEn !== undefined
      ).length,
      skills.length
    ),
    relatedPals: coverageCount(skills.filter((skill) => skill.relatedPals.length > 0).length, skills.length),
    palImages: coverageCount(pals.filter((pal) => pal.imageUrl).length, pals.length),
    itemImages: coverageCount(items.filter((item) => item.imageUrl).length, items.length),
    elementImages: coverageCount(elements.filter((element) => element.iconUrl).length, elements.length),
    localization: {
      ko: coverageCount(pals.length + localizedItemKoCount + localizedSkillKoCount, localizedTotal),
      ja: coverageCount(pals.length + localizedItemJaCount + localizedSkillJaCount, localizedTotal),
      en: coverageCount(localizedTotal, localizedTotal)
    },
    translations: {
      ko: translationCoverageForLocale(
        "ko",
        pals,
        items,
        skills,
        input.translations?.staleSourceHash.ko ?? false,
        input.translations?.snapshots.ko?.records.reduce(
          (sum, record) => sum + Object.keys(record.fields).length,
          0
        ) ?? 0
      ),
      ja: translationCoverageForLocale(
        "ja",
        pals,
        items,
        skills,
        input.translations?.staleSourceHash.ja ?? false,
        input.translations?.snapshots.ja?.records.reduce(
          (sum, record) => sum + Object.keys(record.fields).length,
          0
        ) ?? 0
      )
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
      metadata: { ...metadata },
      domainMetadata: { ...catalogMetadata }
    },
    breeding: {
      status: "incomplete",
      recordCount: 0,
      metadata: { ...metadata }
    },
    skills: {
      status: "incomplete",
      recordCount: skills.length,
      metadata: { ...metadata },
      domainMetadata: { ...catalogMetadata }
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
