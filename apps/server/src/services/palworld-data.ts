import {
  assertPalworldDataSnapshot,
  validatePalworldMetaResponse,
  type PalworldBreedingPair,
  type PalworldBreedingParentsResponse,
  type PalworldBreedingResultResponse,
  type PalworldDataCoverage,
  type PalworldDataSnapshot,
  type PalworldDomainCoverageMap,
  type PalworldItemDetail,
  type PalworldItemSummary,
  type PalworldMetaResponse,
  type PalworldPaginatedResponse,
  type PalworldPagination,
  type PalworldPalDetail,
  type PalworldPalReference,
  type PalworldPalSummary,
  type PalworldRuntimeGates,
  type PalworldSearchResult,
  type PalworldSkillDetail,
  type PalworldSkillSummary
} from "@streamops/shared";
import { createHash } from "node:crypto";
import path from "node:path";
import { PALWORLD_SNAPSHOT } from "../data/palworld-snapshot.js";
import { PalworldCatalogAdapterError, adaptPalworldCatalog } from "../data/palworld-catalog-adapter.js";
import {
  PalworldCatalogValidationError,
  loadPalworldCatalogDataSource,
  validatePalworldCatalogAssetFiles
} from "../data/palworld-catalog-artifact.js";
import {
  loadPalworldPaldexRuntimeRelease,
  type PalworldDataIntegrityGate,
  type PalworldImageAssetGate,
  type PalworldPaldexRuntimeRelease
} from "../data/palworld-paldex-adapter.js";
import {
  PALWORLD_PALDEX_IMAGE_ROOT,
  PALWORLD_PALDEX_RELEASE_ROOT
} from "../data/palworld-paldex-import.js";
import {
  normalizePalworldSearchTerm,
  type PalworldBreedingParentsQuery,
  type PalworldBreedingQuery,
  type PalworldItemListQuery,
  type PalworldPalListQuery,
  type PalworldSkillListQuery,
  type PalworldSortOrder
} from "./palworld-query.js";

export const PALWORLD_PUBLIC_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=86400";

export class PalworldRecordNotFoundError extends Error {
  readonly code = "PALWORLD_NOT_FOUND";

  constructor(
    readonly recordType: "pal" | "item" | "skill",
    readonly recordId: string
  ) {
    super(`${recordType === "pal" ? "Pal" : recordType === "item" ? "아이템" : "스킬"}을 찾을 수 없습니다: ${recordId}`);
    this.name = "PalworldRecordNotFoundError";
  }
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
    elements: pal.elements,
    rarity: pal.rarity,
    variantType: pal.variantType,
    workSuitabilities: pal.workSuitabilities
  };
}

function palReference(pal: PalworldPalDetail): PalworldPalReference {
  return {
    id: pal.id,
    number: pal.number,
    nameKo: pal.nameKo,
    nameJa: pal.nameJa,
    nameEn: pal.nameEn,
    ...(pal.imageUrl ? { imageUrl: pal.imageUrl } : {}),
    ...(pal.imageWidth === undefined ? {} : { imageWidth: pal.imageWidth }),
    ...(pal.imageHeight === undefined ? {} : { imageHeight: pal.imageHeight }),
    elements: pal.elements
  };
}

function itemSummary(item: PalworldItemDetail): PalworldItemSummary {
  return {
    id: item.id,
    ...(item.nameKo === undefined ? {} : { nameKo: item.nameKo }),
    ...(item.nameJa === undefined ? {} : { nameJa: item.nameJa }),
    nameEn: item.nameEn,
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
    ...(item.imageWidth === undefined ? {} : { imageWidth: item.imageWidth }),
    ...(item.imageHeight === undefined ? {} : { imageHeight: item.imageHeight }),
    ...(item.localization === undefined ? {} : { localization: { ...item.localization } }),
    category: item.category,
    rarity: item.rarity,
    ...(item.descriptionKo === undefined ? {} : { descriptionKo: item.descriptionKo }),
    ...(item.descriptionJa === undefined ? {} : { descriptionJa: item.descriptionJa }),
    ...(item.descriptionEn ? { descriptionEn: item.descriptionEn } : {}),
    ...(item.sellPrice === undefined ? {} : { sellPrice: item.sellPrice }),
    ...(item.technologyLevel === undefined ? {} : { technologyLevel: item.technologyLevel })
  };
}

function skillSummary(skill: PalworldSkillDetail): PalworldSkillSummary {
  return {
    id: skill.id,
    type: skill.type,
    ...(skill.nameKo === undefined ? {} : { nameKo: skill.nameKo }),
    ...(skill.nameJa === undefined ? {} : { nameJa: skill.nameJa }),
    nameEn: skill.nameEn,
    ...(skill.descriptionKo === undefined ? {} : { descriptionKo: skill.descriptionKo }),
    ...(skill.descriptionJa === undefined ? {} : { descriptionJa: skill.descriptionJa }),
    ...(skill.descriptionEn === undefined ? {} : { descriptionEn: skill.descriptionEn }),
    ...(skill.element === undefined ? {} : { element: skill.element }),
    ...(skill.power === undefined ? {} : { power: skill.power }),
    ...(skill.cooldownSeconds === undefined ? {} : { cooldownSeconds: skill.cooldownSeconds }),
    ...(skill.unlockLevel === undefined ? {} : { unlockLevel: skill.unlockLevel }),
    ...(skill.passiveTier === undefined ? {} : { passiveTier: skill.passiveTier }),
    ...(skill.passiveAbility === undefined ? {} : { passiveAbility: skill.passiveAbility }),
    ...(skill.localization === undefined ? {} : { localization: { ...skill.localization } }),
    relatedPalCount: skill.relatedPalCount
  };
}

function searchFields(fields: Array<string | number>): string[] {
  return fields.map((field) => normalizePalworldSearchTerm(String(field)));
}

function identifierAliases(id: string): string[] {
  const normalized = id.toLocaleLowerCase();
  return [...new Set([
    normalized,
    normalized.replaceAll("_", "-"),
    normalized.replaceAll("-", "_")
  ])];
}

function matchScore(term: string, fields: Array<string | number>): number | undefined {
  const normalizedFields = searchFields(fields);
  if (normalizedFields.some((field) => field === term)) return 0;
  if (normalizedFields.some((field) => field.startsWith(term))) return 1;
  if (normalizedFields.some((field) => field.includes(term))) return 2;
  return undefined;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, ["ko", "ja", "en"], { numeric: true, sensitivity: "base" });
}

function direction(value: number, order: PalworldSortOrder): number {
  return order === "desc" ? -value : value;
}

function compareOptionalNumber(
  left: number | undefined,
  right: number | undefined,
  order: PalworldSortOrder
): number {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return direction(left - right, order);
}

function pagination(page: number, pageSize: number, total: number): PalworldPagination {
  const totalPages = Math.ceil(total / pageSize);
  const effectivePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
  return {
    page: effectivePage,
    pageSize,
    total,
    totalPages,
    hasNextPage: effectivePage < totalPages,
    hasPreviousPage: effectivePage > 1
  };
}

function pageItems<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export class PalworldDataService {
  private readonly snapshot: PalworldDataSnapshot;
  private readonly supplementalSnapshot: PalworldDataSnapshot;
  private readonly palsById: ReadonlyMap<string, PalworldPalDetail>;
  private readonly itemsById: ReadonlyMap<string, PalworldItemDetail>;
  private readonly skillsById: ReadonlyMap<string, PalworldSkillDetail>;
  private readonly sourceInternalIds: Readonly<Record<string, string>>;
  private readonly domains: PalworldDomainCoverageMap;
  private readonly gates: PalworldRuntimeGates;
  private readonly coverage: PalworldDataCoverage | undefined;

  constructor(snapshot: unknown, options: {
    supplementalSnapshot?: unknown;
    sourceInternalIds?: Readonly<Record<string, string>>;
    domains?: PalworldDomainCoverageMap;
    gates?: PalworldRuntimeGates;
    coverage?: PalworldDataCoverage;
  } = {}) {
    this.snapshot = assertPalworldDataSnapshot(snapshot);
    this.supplementalSnapshot = options.supplementalSnapshot === undefined
      ? this.snapshot
      : assertPalworldDataSnapshot(options.supplementalSnapshot);
    this.palsById = this.indexByIdAliases(this.snapshot.pals);
    this.itemsById = this.indexByIdAliases(this.supplementalSnapshot.items);
    this.skillsById = this.indexByIdAliases(this.snapshot.skills ?? []);
    this.sourceInternalIds = options.sourceInternalIds ?? {};
    this.coverage = options.coverage;
    const snapshotIsSample = this.snapshot.metadata.gameVersion === "sample-baseline";
    const supplementalIsSample = this.supplementalSnapshot.metadata.gameVersion === "sample-baseline";
    this.domains = options.domains ?? {
      pals: {
        status: snapshotIsSample ? "sample" : "ready",
        recordCount: this.snapshot.pals.length,
        metadata: this.snapshot.metadata
      },
      items: {
        status: supplementalIsSample ? "sample" : "ready",
        recordCount: this.supplementalSnapshot.items.length,
        metadata: this.supplementalSnapshot.metadata
      },
      breeding: {
        status: supplementalIsSample ? "sample" : "ready",
        recordCount: this.supplementalSnapshot.breedingPairs.length,
        metadata: this.supplementalSnapshot.metadata
      },
      ...(this.snapshot.skills === undefined ? {} : {
        skills: {
          status: snapshotIsSample ? "sample" : "ready",
          recordCount: this.snapshot.skills.length,
          metadata: this.snapshot.metadata
        }
      })
    };
    const readyImages = this.snapshot.pals.filter((pal) => pal.imageUrl !== undefined).length;
    this.gates = options.gates ?? {
      dataIntegrity: { passed: true, status: "ready" },
      imageAssets: {
        status: "blocked_by_license",
        policyStatus: "missing",
        technicalPassed: false,
        publicActivationAllowed: false,
        rightsVerified: false,
        usageBasis: "none",
        readyImages: 0,
        fallbackPals: this.snapshot.pals.length,
        publicNoticeRequired: true
      }
    };
    if (readyImages !== this.gates.imageAssets.readyImages) {
      throw new TypeError("Palworld runtime 이미지 수와 image asset gate가 일치하지 않습니다.");
    }
    if (!this.gates.imageAssets.publicActivationAllowed && readyImages > 0) {
      throw new TypeError("공개 활성화가 차단된 Palworld imageUrl을 runtime에 전달할 수 없습니다.");
    }
    const metaValidation = validatePalworldMetaResponse(this.meta());
    if (!metaValidation.ok) {
      throw new TypeError(`Palworld runtime metadata 검증에 실패했습니다. ${metaValidation.error}`);
    }
  }

  private indexByIdAliases<T extends { id: string }>(entries: T[]): ReadonlyMap<string, T> {
    const index = new Map<string, T>();
    for (const entry of entries) {
      for (const alias of identifierAliases(entry.id)) {
        const existing = index.get(alias);
        if (existing && existing.id !== entry.id) {
          throw new TypeError(`Palworld ID alias가 충돌합니다: ${existing.id}, ${entry.id}`);
        }
        index.set(alias, entry);
      }
    }
    return index;
  }

  meta(): PalworldMetaResponse {
    return {
      metadata: this.snapshot.metadata,
      counts: {
        pals: this.snapshot.pals.length,
        items: this.supplementalSnapshot.items.length,
        breedingPairs: this.supplementalSnapshot.breedingPairs.length,
        ...(this.snapshot.skills === undefined ? {} : { skills: this.snapshot.skills.length })
      },
      domains: {
        pals: { ...this.domains.pals, metadata: { ...this.domains.pals.metadata } },
        items: { ...this.domains.items, metadata: { ...this.domains.items.metadata } },
        breeding: { ...this.domains.breeding, metadata: { ...this.domains.breeding.metadata } },
        ...(this.domains.skills === undefined ? {} : {
          skills: { ...this.domains.skills, metadata: { ...this.domains.skills.metadata } }
        })
      },
      gates: {
        dataIntegrity: { ...this.gates.dataIntegrity },
        imageAssets: { ...this.gates.imageAssets }
      },
      ...(this.coverage === undefined ? {} : { coverage: structuredClone(this.coverage) })
    };
  }

  sourceInternalIdForPal(id: string): string | undefined {
    const pal = identifierAliases(id).map((alias) => this.palsById.get(alias)).find(Boolean);
    return pal ? this.sourceInternalIds[pal.id] : undefined;
  }

  search(rawQuery: string, limit: number): PalworldSearchResult {
    const query = rawQuery.trim().replace(/\s+/gu, " ");
    const term = normalizePalworldSearchTerm(query);
    const matchedPals = this.snapshot.pals
      .map((pal) => ({
        pal,
        score: matchScore(term, [
          ...identifierAliases(pal.id),
          this.sourceInternalIds[pal.id] ?? "",
          pal.number,
          `#${pal.number}`,
          pal.nameKo,
          pal.nameJa,
          pal.nameEn
        ])
      }))
      .filter((entry): entry is { pal: PalworldPalDetail; score: number } => entry.score !== undefined)
      .sort((left, right) => left.score - right.score || left.pal.number - right.pal.number);
    const pals = matchedPals
      .slice(0, limit)
      .map(({ pal }) => palSummary(pal));
    const matchedItems = this.supplementalSnapshot.items
      .map((item) => ({ item, score: matchScore(term, [
        ...identifierAliases(item.id),
        item.sourceInternalId ?? "",
        item.nameKo ?? "",
        item.nameJa ?? "",
        item.nameEn
      ]) }))
      .filter((entry): entry is { item: PalworldItemDetail; score: number } => entry.score !== undefined)
      .sort((left, right) => left.score - right.score || compareText(left.item.nameEn, right.item.nameEn));
    const items = matchedItems
      .slice(0, limit)
      .map(({ item }) => itemSummary(item));
    return {
      query,
      total: matchedPals.length + matchedItems.length,
      pals,
      items,
      metadata: this.snapshot.metadata,
      domains: {
        pals: { ...this.domains.pals, metadata: { ...this.domains.pals.metadata } },
        items: { ...this.domains.items, metadata: { ...this.domains.items.metadata } }
      }
    };
  }

  listPals(query: PalworldPalListQuery): PalworldPaginatedResponse<PalworldPalSummary> {
    const term = query.q ? normalizePalworldSearchTerm(query.q) : undefined;
    const filtered = this.snapshot.pals
      .filter((pal) => term === undefined || matchScore(term, [
        ...identifierAliases(pal.id),
        this.sourceInternalIds[pal.id] ?? "",
        pal.number,
        `#${pal.number}`,
        pal.nameKo,
        pal.nameJa,
        pal.nameEn
      ]) !== undefined)
      .filter((pal) => query.element === undefined || pal.elements.includes(query.element))
      .filter((pal) => query.work === undefined || pal.workSuitabilities.some((work) => work.type === query.work))
      .filter((pal) => query.rarity === undefined || pal.rarity === query.rarity)
      .filter((pal) => query.variant === undefined || pal.variantType === query.variant)
      .sort((left, right) => {
        const result = query.sort === "number"
          ? left.number - right.number || compareText(left.id, right.id)
          : query.sort === "rarity"
            ? left.rarity - right.rarity || left.number - right.number
            : compareText(left.nameKo, right.nameKo) || left.number - right.number;
        return direction(result, query.order);
      });
    const pageInfo = pagination(query.page, query.limit, filtered.length);
    return {
      items: pageItems(filtered, pageInfo.page, query.limit).map(palSummary),
      pagination: pageInfo,
      metadata: this.snapshot.metadata
    };
  }

  getPal(id: string): PalworldPalDetail {
    const pal = identifierAliases(id).map((alias) => this.palsById.get(alias)).find(Boolean);
    if (!pal) throw new PalworldRecordNotFoundError("pal", id);
    return pal;
  }

  listItems(query: PalworldItemListQuery): PalworldPaginatedResponse<PalworldItemSummary> {
    const term = query.q ? normalizePalworldSearchTerm(query.q) : undefined;
    const filtered = this.supplementalSnapshot.items
      .filter((item) => term === undefined || matchScore(term, [
        ...identifierAliases(item.id),
        item.sourceInternalId ?? "",
        item.nameKo ?? "",
        item.nameJa ?? "",
        item.nameEn
      ]) !== undefined)
      .filter((item) => query.category === undefined || item.category === query.category)
      .filter((item) => query.rarity === undefined || item.rarity === query.rarity)
      .filter((item) => query.acquisition === undefined || item.acquisitionMethods.some((method) => method.type === query.acquisition))
      .sort((left, right) => {
        if (query.sort === "price") {
          return compareOptionalNumber(left.sellPrice, right.sellPrice, query.order) || compareText(left.nameEn, right.nameEn);
        }
        if (query.sort === "technologyLevel") {
          return compareOptionalNumber(left.technologyLevel, right.technologyLevel, query.order) || compareText(left.nameEn, right.nameEn);
        }
        const result = query.sort === "rarity"
          ? left.rarity - right.rarity || compareText(left.nameEn, right.nameEn)
          : compareText(left.nameKo ?? left.nameEn, right.nameKo ?? right.nameEn);
        return direction(result, query.order);
      });
    const pageInfo = pagination(query.page, query.limit, filtered.length);
    return {
      items: pageItems(filtered, pageInfo.page, query.limit).map(itemSummary),
      pagination: pageInfo,
      metadata: this.domains.items.metadata
    };
  }

  getItem(id: string): PalworldItemDetail {
    const item = identifierAliases(id).map((alias) => this.itemsById.get(alias)).find(Boolean);
    if (!item) throw new PalworldRecordNotFoundError("item", id);
    return item;
  }

  listSkills(query: PalworldSkillListQuery): PalworldPaginatedResponse<PalworldSkillSummary> {
    const term = query.q ? normalizePalworldSearchTerm(query.q) : undefined;
    const filtered = [...(this.snapshot.skills ?? [])]
      .filter((skill) => term === undefined || matchScore(term, [
        ...identifierAliases(skill.id),
        skill.nameKo ?? "",
        skill.nameJa ?? "",
        skill.nameEn,
        skill.descriptionKo ?? "",
        skill.descriptionJa ?? "",
        skill.descriptionEn ?? ""
      ]) !== undefined)
      .filter((skill) => query.type === undefined || skill.type === query.type)
      .filter((skill) => query.element === undefined || skill.element === query.element)
      .sort((left, right) => {
        if (query.sort === "power") {
          return compareOptionalNumber(left.power, right.power, query.order) || compareText(left.nameEn, right.nameEn);
        }
        if (query.sort === "unlockLevel") {
          return compareOptionalNumber(left.unlockLevel, right.unlockLevel, query.order) || compareText(left.nameEn, right.nameEn);
        }
        return direction(compareText(left.nameEn, right.nameEn), query.order);
      });
    const pageInfo = pagination(query.page, query.limit, filtered.length);
    return {
      items: pageItems(filtered, pageInfo.page, query.limit).map(skillSummary),
      pagination: pageInfo,
      metadata: this.domains.skills?.metadata ?? this.snapshot.metadata
    };
  }

  getSkill(id: string): PalworldSkillDetail {
    const skill = identifierAliases(id).map((alias) => this.skillsById.get(alias)).find(Boolean);
    if (!skill) throw new PalworldRecordNotFoundError("skill", id);
    return skill;
  }

  breeding(query: PalworldBreedingQuery): PalworldBreedingResultResponse {
    const parentA = this.getPal(query.parentA);
    const parentB = this.getPal(query.parentB);
    const sampleResult = this.supplementalSnapshot.breedingPairs.find((pair) =>
      (pair.parentA.id === parentA.id && pair.parentB.id === parentB.id) ||
      (pair.parentA.id === parentB.id && pair.parentB.id === parentA.id)
    ) ?? null;
    const result = sampleResult ? this.withActivePalReferences(sampleResult) : null;
    return {
      parentA: palReference(parentA),
      parentB: palReference(parentB),
      result,
      metadata: this.domains.breeding.metadata
    };
  }

  breedingParents(query: PalworldBreedingParentsQuery): PalworldBreedingParentsResponse {
    const child = this.getPal(query.child);
    const pairs = this.supplementalSnapshot.breedingPairs
      .filter((pair) => pair.child.id === child.id)
      .map((pair) => this.withActivePalReferences(pair));
    const pageInfo = pagination(query.page, query.limit, pairs.length);
    return {
      child: palReference(child),
      items: pageItems(pairs, pageInfo.page, query.limit),
      pagination: pageInfo,
      metadata: this.domains.breeding.metadata
    };
  }

  private withActivePalReferences(pair: PalworldBreedingPair): PalworldBreedingPair {
    return {
      ...pair,
      parentA: palReference(this.getPal(pair.parentA.id)),
      parentB: palReference(this.getPal(pair.parentB.id)),
      child: palReference(this.getPal(pair.child.id))
    };
  }
}

function incompletePaldexSnapshot(release: PalworldPaldexRuntimeRelease): PalworldDataSnapshot {
  return assertPalworldDataSnapshot({
    metadata: { ...release.metadata },
    pals: release.pals.map((pal) => ({
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
      ...(pal.descriptionEn === undefined ? {} : {
        descriptionEn: pal.descriptionEn,
        localization: {
          sourceLanguage: "en",
          ko: "source_language_fallback",
          ja: "source_language_fallback"
        }
      }),
      ...(pal.partnerSkill === undefined ? {} : { partnerSkill: { ...pal.partnerSkill } }),
      activeSkills: pal.activeSkills.map((skill) => ({ ...skill })),
      // Catalog가 차단된 fallback에서는 canonical item reference를 만들지 않는다.
      drops: [],
      breeding: {
        breedingPower: pal.breedingPower,
        specialParentPairs: pal.specialParentPairs.map((pair) => ({ ...pair }))
      },
      metadata: { ...release.metadata }
    })),
    items: [],
    breedingPairs: []
  });
}

function runtimeGates(input: {
  dataIntegrityGate: PalworldDataIntegrityGate;
  imageAssetGate: PalworldImageAssetGate;
}): PalworldRuntimeGates {
  return {
    dataIntegrity: {
      passed: input.dataIntegrityGate.passed,
      status: input.dataIntegrityGate.status
    },
    imageAssets: {
      status: input.imageAssetGate.status,
      policyStatus: input.imageAssetGate.policyStatus,
      technicalPassed: input.imageAssetGate.technicalPassed,
      publicActivationAllowed: input.imageAssetGate.publicActivationAllowed,
      rightsVerified: input.imageAssetGate.rightsVerified,
      usageBasis: input.imageAssetGate.usageBasis,
      readyImages: input.imageAssetGate.readyImages,
      fallbackPals: input.imageAssetGate.fallbackPals,
      publicNoticeRequired: input.imageAssetGate.publicNoticeRequired
    }
  };
}

export async function loadPalworldDataService(options: {
  releaseRoot?: string;
  imageRoot?: string;
  itemImageRoot?: string;
  elementImageRoot?: string;
  mappingRoot?: string;
  catalogRoot?: string;
} = {}): Promise<PalworldDataService> {
  const release = await loadPalworldPaldexRuntimeRelease(options);
  const palworldImageRoot = path.dirname(options.imageRoot ?? PALWORLD_PALDEX_IMAGE_ROOT);
  try {
    const catalogSource = await loadPalworldCatalogDataSource(
      options.catalogRoot ?? options.releaseRoot ?? PALWORLD_PALDEX_RELEASE_ROOT
    );
    let itemAssetsAvailable = true;
    let elementAssetsAvailable = true;
    try {
      await validatePalworldCatalogAssetFiles({
        root: options.itemImageRoot ?? path.join(palworldImageRoot, "items"),
        kind: "items",
        manifest: catalogSource.itemImagesManifest
      });
    } catch (error) {
      if (!(error instanceof PalworldCatalogValidationError) && (error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      itemAssetsAvailable = false;
    }
    try {
      await validatePalworldCatalogAssetFiles({
        root: options.elementImageRoot ?? path.join(palworldImageRoot, "elements"),
        kind: "elements",
        manifest: catalogSource.elementImagesManifest
      });
    } catch (error) {
      if (!(error instanceof PalworldCatalogValidationError) && (error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      elementAssetsAvailable = false;
    }
    const adaptedCatalog = adaptPalworldCatalog({
      basePaldex: release,
      catalog: catalogSource.catalog,
      catalogChecksum: catalogSource.manifest.catalogSha256,
      localizedSnapshot: PALWORLD_SNAPSHOT,
      sourceInternalIds: release.sourceInternalIds,
      assetAvailability: {
        items: itemAssetsAvailable,
        elements: elementAssetsAvailable
      },
      sourceChecksum: createHash("sha256")
        .update(release.manifest.paldexSha256)
        .update("\0")
        .update(catalogSource.manifest.catalogSha256)
        .digest("hex")
    });
    return new PalworldDataService(adaptedCatalog.snapshot, {
      sourceInternalIds: release.sourceInternalIds,
      domains: adaptedCatalog.domains,
      gates: runtimeGates(release),
      coverage: adaptedCatalog.coverage
    });
  } catch (error) {
    if (
      !(error instanceof PalworldCatalogValidationError)
      && !(error instanceof PalworldCatalogAdapterError)
      && (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      throw error;
    }
  }
  const fallbackSnapshot = incompletePaldexSnapshot(release);
  return new PalworldDataService(fallbackSnapshot, {
    supplementalSnapshot: PALWORLD_SNAPSHOT,
    sourceInternalIds: release.sourceInternalIds,
    domains: {
      pals: {
        status: "incomplete",
        recordCount: fallbackSnapshot.pals.length,
        metadata: fallbackSnapshot.metadata
      },
      items: {
        status: "sample",
        recordCount: PALWORLD_SNAPSHOT.items.length,
        metadata: PALWORLD_SNAPSHOT.metadata
      },
      breeding: {
        status: "sample",
        recordCount: PALWORLD_SNAPSHOT.breedingPairs.length,
        metadata: PALWORLD_SNAPSHOT.metadata
      }
    },
    gates: runtimeGates(release)
  });
}
