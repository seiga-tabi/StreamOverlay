import {
  PALWORLD_ELEMENTS,
  PALWORLD_VARIANT_TYPES,
  PALWORLD_WORK_SUITABILITY_TYPES,
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
  type PalworldPalListFacets,
  type PalworldPalListResponse,
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
  PalworldBreedingArtifactError,
  loadPalworldBreedingRuntimeSource,
  type PalworldBreedingRuntimeSource
} from "../data/palworld-breeding-artifact.js";
import {
  collectPalworldCatalogRuntimeAssetCoverage,
  PalworldCatalogValidationError,
  loadPalworldCatalogDataSource
} from "../data/palworld-catalog-artifact.js";
import {
  PalworldPaldexValidationError
} from "../data/palworld-paldex-artifact.js";
import {
  loadPalworldPaldexRuntimeRelease,
  type PalworldDataIntegrityGate,
  type PalworldImageAssetGate,
  type PalworldPaldexRuntimeRelease
} from "../data/palworld-paldex-adapter.js";
import {
  PALWORLD_PALDEX_IMAGE_ROOT,
} from "../data/palworld-paldex-import.js";
import {
  loadPalworldActiveRuntime,
  type PalworldActiveRuntime
} from "../data/palworld-active-runtime.js";
import {
  createPalworldTranslationValidationContext,
  loadPalworldTranslationBundle
} from "../data/palworld-translation-artifact.js";
import {
  PalworldBreedingEngine,
  type PalworldBreedingEnginePair,
  type PalworldBreedingEngineQuery
} from "./palworld-breeding-engine.js";
import {
  loadPalworldReviewedItemAliases,
  type PalworldReviewedItemAlias
} from "../data/palworld-reviewed-item-aliases.js";
import {
  normalizePalworldSearchTerm,
  type PalworldBreedingParentsQuery,
  type PalworldBreedingQuery,
  type PalworldItemListQuery,
  type PalworldPalListQuery,
  type PalworldSkillListQuery,
  type PalworldSortOrder
} from "./palworld-query.js";

// release 전환 중 서로 다른 endpoint의 하루짜리 stale 응답이 섞이지 않도록
// 브라우저·CDN이 매 요청에서 release별 ETag를 재검증하게 합니다.
export const PALWORLD_PUBLIC_CACHE_CONTROL = "public, max-age=0, must-revalidate";

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

export class PalworldDomainUnavailableError extends Error {
  readonly code = "PALWORLD_DATA_UNAVAILABLE";

  constructor(readonly domain: "items" | "skills") {
    super(`Palworld ${domain} 데이터를 사용할 수 없습니다.`);
    this.name = "PalworldDomainUnavailableError";
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
    workSuitabilities: pal.workSuitabilities,
    ...(pal.translation?.name === undefined ? {} : {
      translation: { name: { ...pal.translation.name } }
    })
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
    elements: pal.elements,
    ...(pal.translation?.name === undefined ? {} : {
      translation: { name: { ...pal.translation.name } }
    })
  };
}

function collectPalListFacets(pals: readonly PalworldPalDetail[]): PalworldPalListFacets {
  const elementCounts = new Map(PALWORLD_ELEMENTS.map((value) => [value, 0]));
  const workCounts = new Map(PALWORLD_WORK_SUITABILITY_TYPES.map((value) => [value, 0]));
  const variantCounts = new Map(PALWORLD_VARIANT_TYPES.map((value) => [value, 0]));
  const rarityCounts = new Map<number, number>();

  for (const pal of pals) {
    for (const element of pal.elements) {
      elementCounts.set(element, (elementCounts.get(element) ?? 0) + 1);
    }
    for (const work of pal.workSuitabilities) {
      workCounts.set(work.type, (workCounts.get(work.type) ?? 0) + 1);
    }
    variantCounts.set(pal.variantType, (variantCounts.get(pal.variantType) ?? 0) + 1);
    rarityCounts.set(pal.rarity, (rarityCounts.get(pal.rarity) ?? 0) + 1);
  }

  return {
    elements: PALWORLD_ELEMENTS.flatMap((value) => {
      const count = elementCounts.get(value) ?? 0;
      return count > 0 ? [{ value, count }] : [];
    }),
    workSuitabilities: PALWORLD_WORK_SUITABILITY_TYPES.flatMap((value) => {
      const count = workCounts.get(value) ?? 0;
      return count > 0 ? [{ value, count }] : [];
    }),
    rarities: [...rarityCounts.entries()]
      .sort(([left], [right]) => left - right)
      .map(([value, count]) => ({ value, count })),
    variants: PALWORLD_VARIANT_TYPES.flatMap((value) => {
      const count = variantCounts.get(value) ?? 0;
      return count > 0 ? [{ value, count }] : [];
    })
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
    ...(item.translation === undefined ? {} : { translation: structuredClone(item.translation) }),
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
    ...(skill.passiveAbilityKo === undefined ? {} : { passiveAbilityKo: skill.passiveAbilityKo }),
    ...(skill.passiveAbilityJa === undefined ? {} : { passiveAbilityJa: skill.passiveAbilityJa }),
    ...(skill.localization === undefined ? {} : { localization: { ...skill.localization } }),
    ...(skill.translation === undefined ? {} : { translation: structuredClone(skill.translation) }),
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
  return matchNormalizedSearchFields(term, normalizedFields);
}

function matchNormalizedSearchFields(term: string, normalizedFields: readonly string[]): number | undefined {
  if (normalizedFields.some((field) => field === term)) return 0;
  if (normalizedFields.some((field) => field.startsWith(term))) return 1;
  if (normalizedFields.some((field) => field.includes(term))) return 2;
  return undefined;
}

const PALWORLD_COLLATOR = new Intl.Collator(["ko", "ja", "en"], {
  numeric: true,
  sensitivity: "base"
});
const PALWORLD_LOCALE_COLLATORS = {
  ko: new Intl.Collator(["ko", "ja", "en"], { numeric: true, sensitivity: "base" }),
  ja: new Intl.Collator(["ja", "ko", "en"], { numeric: true, sensitivity: "base" }),
  en: new Intl.Collator(["en", "ko", "ja"], { numeric: true, sensitivity: "base" })
} as const;
const PALWORLD_ID_COLLATOR = new Intl.Collator("en");

function compareText(left: string, right: string): number {
  return PALWORLD_COLLATOR.compare(left, right);
}

function localizedName(
  value: { nameKo?: string; nameJa?: string; nameEn: string },
  locale: "ko" | "ja" | "en"
): string {
  return locale === "ja"
    ? value.nameJa ?? value.nameEn
    : locale === "ko"
      ? value.nameKo ?? value.nameEn
      : value.nameEn;
}

function compareLocalizedName(
  left: { nameKo?: string; nameJa?: string; nameEn: string },
  right: { nameKo?: string; nameJa?: string; nameEn: string },
  locale: "ko" | "ja" | "en"
): number {
  return PALWORLD_LOCALE_COLLATORS[locale].compare(
    localizedName(left, locale),
    localizedName(right, locale)
  );
}

function compareCanonicalId(left: { id: string }, right: { id: string }): number {
  return PALWORLD_ID_COLLATOR.compare(left.id, right.id);
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

function pageItems<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

type PalworldBreedingResolver = Pick<
  PalworldBreedingEngine,
  "pairCount" | "resolve" | "parents"
>;

function snapshotBreedingPairKey(parentAId: string, parentBId: string): string {
  return parentAId <= parentBId
    ? `${parentAId}\0${parentBId}`
    : `${parentBId}\0${parentAId}`;
}

function snapshotBreedingPairOrder(
  left: PalworldBreedingEnginePair,
  right: PalworldBreedingEnginePair
): number {
  return left.parentAId.localeCompare(right.parentAId, "en")
    || left.parentBId.localeCompare(right.parentBId, "en")
    || (left.parentAGender ?? "").localeCompare(right.parentAGender ?? "", "en")
    || (left.parentBGender ?? "").localeCompare(right.parentBGender ?? "", "en")
    || left.childId.localeCompare(right.childId, "en");
}

function snapshotPairForRequestedOrder(
  pair: PalworldBreedingPair,
  query: PalworldBreedingEngineQuery
): PalworldBreedingEnginePair | undefined {
  const direct =
    pair.parentA.id === query.parentAId
    && pair.parentB.id === query.parentBId;
  const reversed =
    pair.parentA.id === query.parentBId
    && pair.parentB.id === query.parentAId;
  if (!direct && !reversed) return undefined;
  const parentAGender = direct
    ? pair.genderCondition?.parentA
    : pair.genderCondition?.parentB;
  const parentBGender = direct
    ? pair.genderCondition?.parentB
    : pair.genderCondition?.parentA;
  return {
    parentAId: query.parentAId,
    parentBId: query.parentBId,
    childId: pair.child.id,
    isSpecial: pair.isSpecial,
    ...(parentAGender === undefined || parentAGender === "any"
      ? {}
      : { parentAGender }),
    ...(parentBGender === undefined || parentBGender === "any"
      ? {}
      : { parentBGender })
  };
}

function snapshotGenderMatches(
  required: "male" | "female" | undefined,
  selected: "male" | "female" | undefined
): boolean {
  return selected === undefined || required === undefined || required === selected;
}

class PalworldSnapshotBreedingIndex implements PalworldBreedingResolver {
  readonly pairCount: number;

  private readonly pairsByParents: ReadonlyMap<
    string,
    readonly PalworldBreedingPair[]
  >;
  private readonly pairsByChild: ReadonlyMap<
    string,
    readonly PalworldBreedingEnginePair[]
  >;

  constructor(pairs: readonly PalworldBreedingPair[]) {
    this.pairCount = pairs.length;
    const pairsByParents = new Map<string, PalworldBreedingPair[]>();
    const pairsByChild = new Map<string, PalworldBreedingEnginePair[]>();
    for (const pair of pairs) {
      const parentKey = snapshotBreedingPairKey(
        pair.parentA.id,
        pair.parentB.id
      );
      pairsByParents.set(parentKey, [
        ...(pairsByParents.get(parentKey) ?? []),
        pair
      ]);
      const indexedPair: PalworldBreedingEnginePair = {
        parentAId: pair.parentA.id,
        parentBId: pair.parentB.id,
        childId: pair.child.id,
        isSpecial: pair.isSpecial,
        ...(pair.genderCondition?.parentA === undefined
          || pair.genderCondition.parentA === "any"
          ? {}
          : { parentAGender: pair.genderCondition.parentA }),
        ...(pair.genderCondition?.parentB === undefined
          || pair.genderCondition.parentB === "any"
          ? {}
          : { parentBGender: pair.genderCondition.parentB })
      };
      pairsByChild.set(pair.child.id, [
        ...(pairsByChild.get(pair.child.id) ?? []),
        indexedPair
      ]);
    }
    this.pairsByParents = pairsByParents;
    this.pairsByChild = new Map(
      [...pairsByChild.entries()].map(([childId, childPairs]) => [
        childId,
        [...childPairs].sort(snapshotBreedingPairOrder)
      ])
    );
  }

  resolve(
    query: PalworldBreedingEngineQuery
  ): ReturnType<PalworldBreedingEngine["resolve"]> {
    const candidates = (
      this.pairsByParents.get(
        snapshotBreedingPairKey(query.parentAId, query.parentBId)
      ) ?? []
    )
      .map((pair) => snapshotPairForRequestedOrder(pair, query))
      .filter((pair): pair is PalworldBreedingEnginePair =>
        pair !== undefined
        && snapshotGenderMatches(pair.parentAGender, query.parentAGender)
        && snapshotGenderMatches(pair.parentBGender, query.parentBGender)
      )
      .sort(snapshotBreedingPairOrder);
    if (candidates.length === 1) {
      return {
        state: "resolved",
        result: candidates[0]!,
        alternatives: []
      };
    }
    if (candidates.length > 1) {
      return {
        state: "requires_gender",
        alternatives: candidates
      };
    }
    return { state: "not_found", alternatives: [] };
  }

  parents(childId: string): PalworldBreedingEnginePair[] {
    return [...(this.pairsByChild.get(childId) ?? [])];
  }
}

export class PalworldDataService {
  private readonly snapshot: PalworldDataSnapshot;
  private readonly supplementalSnapshot: PalworldDataSnapshot;
  private readonly palsById: ReadonlyMap<string, PalworldPalDetail>;
  private readonly itemsById: ReadonlyMap<string, PalworldItemDetail>;
  private readonly skillsById: ReadonlyMap<string, PalworldSkillDetail>;
  private readonly sourceInternalIds: Readonly<Record<string, string>>;
  private readonly palListFacets: PalworldPalListFacets;
  private readonly domains: PalworldDomainCoverageMap;
  private readonly gates: PalworldRuntimeGates;
  private readonly coverage: PalworldDataCoverage | undefined;
  private readonly breedingEngine: PalworldBreedingResolver | undefined;
  private readonly unavailableDomains: ReadonlySet<"items" | "skills">;
  private readonly palSearchFields: ReadonlyMap<string, readonly string[]>;
  private readonly itemSearchFields: ReadonlyMap<string, readonly string[]>;
  private readonly skillSearchFields: ReadonlyMap<string, readonly string[]>;
  private readonly itemListCache = new Map<string, readonly PalworldItemDetail[]>();
  private readonly skillListCache = new Map<string, readonly PalworldSkillDetail[]>();
  private readonly searchCache = new Map<string, PalworldSearchResult>();

  constructor(snapshot: unknown, options: {
    supplementalSnapshot?: unknown;
    sourceInternalIds?: Readonly<Record<string, string>>;
    domains?: PalworldDomainCoverageMap;
    gates?: PalworldRuntimeGates;
    coverage?: PalworldDataCoverage;
    breedingEngine?: PalworldBreedingEngine;
    useSnapshotBreedingPairs?: boolean;
    unavailableDomains?: readonly ("items" | "skills")[];
  } = {}) {
    this.snapshot = assertPalworldDataSnapshot(snapshot);
    this.supplementalSnapshot = options.supplementalSnapshot === undefined
      ? this.snapshot
      : assertPalworldDataSnapshot(options.supplementalSnapshot);
    this.palsById = this.indexByIdAliases(this.snapshot.pals);
    this.itemsById = this.indexByIdAliases(this.supplementalSnapshot.items);
    this.skillsById = this.indexByIdAliases(this.snapshot.skills ?? []);
    this.sourceInternalIds = options.sourceInternalIds ?? {};
    this.palSearchFields = new Map(this.snapshot.pals.map((pal) => [
      pal.id,
      searchFields([
        ...identifierAliases(pal.id),
        this.sourceInternalIds[pal.id] ?? "",
        pal.number,
        `#${pal.number}`,
        pal.nameKo,
        pal.nameJa,
        pal.nameEn
      ])
    ]));
    this.itemSearchFields = new Map(this.supplementalSnapshot.items.map((item) => [
      item.id,
      searchFields([
        ...identifierAliases(item.id),
        item.sourceInternalId ?? "",
        item.nameKo ?? "",
        item.nameJa ?? "",
        item.nameEn
      ])
    ]));
    this.skillSearchFields = new Map((this.snapshot.skills ?? []).map((skill) => [
      skill.id,
      searchFields([
        ...identifierAliases(skill.id),
        skill.nameKo ?? "",
        skill.nameJa ?? "",
        skill.nameEn,
        skill.descriptionKo ?? "",
        skill.descriptionJa ?? "",
        skill.descriptionEn ?? ""
      ])
    ]));
    this.palListFacets = collectPalListFacets(this.snapshot.pals);
    this.coverage = options.coverage;
    this.breedingEngine = options.breedingEngine
      ?? (
        options.useSnapshotBreedingPairs === true
          ? new PalworldSnapshotBreedingIndex(this.snapshot.breedingPairs)
          : undefined
      );
    this.unavailableDomains = new Set(options.unavailableDomains ?? []);
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
        status: "incomplete",
        recordCount: this.breedingEngine?.pairCount ?? 0,
        metadata: this.snapshot.metadata
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
        breedingPairs: this.breedingEngine?.pairCount ?? 0,
        ...(this.domains.skills === undefined ? {} : { skills: this.snapshot.skills?.length ?? 0 })
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
    const cacheKey = JSON.stringify([term, limit]);
    const cached = this.searchCache.get(cacheKey);
    if (cached !== undefined) {
      this.searchCache.delete(cacheKey);
      this.searchCache.set(cacheKey, cached);
      return structuredClone(cached);
    }
    const matchedPals = this.snapshot.pals
      .map((pal) => ({
        pal,
        score: matchNormalizedSearchFields(term, this.palSearchFields.get(pal.id) ?? [])
      }))
      .filter((entry): entry is { pal: PalworldPalDetail; score: number } => entry.score !== undefined)
      .sort((left, right) => left.score - right.score || left.pal.number - right.pal.number);
    const pals = matchedPals
      .slice(0, limit)
      .map(({ pal }) => palSummary(pal));
    const matchedItems = (this.unavailableDomains.has("items") ? [] : this.supplementalSnapshot.items)
      .map((item) => ({
        item,
        score: matchNormalizedSearchFields(term, this.itemSearchFields.get(item.id) ?? [])
      }))
      .filter((entry): entry is { item: PalworldItemDetail; score: number } => entry.score !== undefined)
      .sort((left, right) => left.score - right.score || compareText(left.item.nameEn, right.item.nameEn));
    const items = matchedItems
      .slice(0, limit)
      .map(({ item }) => itemSummary(item));
    const response: PalworldSearchResult = {
      query,
      total: matchedPals.length + matchedItems.length,
      pals,
      items,
      domainResults: {
        pals: {
          total: matchedPals.length,
          returned: pals.length,
          hasMore: pals.length < matchedPals.length
        },
        items: {
          total: matchedItems.length,
          returned: items.length,
          hasMore: items.length < matchedItems.length
        }
      },
      metadata: this.snapshot.metadata,
      domains: {
        pals: { ...this.domains.pals, metadata: { ...this.domains.pals.metadata } },
        items: { ...this.domains.items, metadata: { ...this.domains.items.metadata } }
      }
    };
    this.searchCache.set(cacheKey, response);
    if (this.searchCache.size > 64) {
      const oldest = this.searchCache.keys().next().value;
      if (oldest !== undefined) this.searchCache.delete(oldest);
    }
    return structuredClone(response);
  }

  listPals(query: PalworldPalListQuery): PalworldPalListResponse {
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
          ? left.number - right.number || compareCanonicalId(left, right)
          : query.sort === "rarity"
            ? left.rarity - right.rarity || left.number - right.number || compareCanonicalId(left, right)
            : compareLocalizedName(left, right, query.locale ?? "ko")
              || left.number - right.number
              || compareCanonicalId(left, right);
        return direction(result, query.order);
      });
    const pageInfo = pagination(query.page, query.limit, filtered.length);
    return {
      items: pageItems(filtered, pageInfo.page, query.limit).map(palSummary),
      pagination: pageInfo,
      metadata: this.snapshot.metadata,
      facets: {
        elements: this.palListFacets.elements.map((facet) => ({ ...facet })),
        workSuitabilities: this.palListFacets.workSuitabilities.map((facet) => ({ ...facet })),
        rarities: this.palListFacets.rarities.map((facet) => ({ ...facet })),
        variants: this.palListFacets.variants.map((facet) => ({ ...facet }))
      }
    };
  }

  getPal(id: string): PalworldPalDetail {
    const pal = identifierAliases(id).map((alias) => this.palsById.get(alias)).find(Boolean);
    if (!pal) throw new PalworldRecordNotFoundError("pal", id);
    return {
      ...pal,
      breeding: {
        ...pal.breeding,
        specialParentPairs: pal.breeding.specialParentPairs.map((pair) => ({
          ...pair,
          parentA: palReference(this.requiredPal(pair.parentAId)),
          parentB: palReference(this.requiredPal(pair.parentBId))
        }))
      }
    };
  }

  listItems(query: PalworldItemListQuery): PalworldPaginatedResponse<PalworldItemSummary> {
    this.ensureDomainAvailable("items");
    const term = query.q ? normalizePalworldSearchTerm(query.q) : undefined;
    const cacheKey = JSON.stringify([
      term ?? "",
      query.category ?? "",
      query.rarity ?? "",
      query.acquisition ?? "",
      query.sort,
      query.order,
      query.locale ?? "en"
    ]);
    const filtered = this.cachedList(this.itemListCache, cacheKey, () => this.supplementalSnapshot.items
      .filter((item) =>
        term === undefined
        || matchNormalizedSearchFields(term, this.itemSearchFields.get(item.id) ?? []) !== undefined
      )
      .filter((item) => query.category === undefined || item.category === query.category)
      .filter((item) => query.rarity === undefined || item.rarity === query.rarity)
      .filter((item) => query.acquisition === undefined || item.acquisitionMethods.some((method) => method.type === query.acquisition))
      .sort((left, right) => {
        if (query.sort === "price") {
          return compareOptionalNumber(left.sellPrice, right.sellPrice, query.order)
            || compareLocalizedName(left, right, query.locale ?? "en")
            || compareCanonicalId(left, right);
        }
        if (query.sort === "technologyLevel") {
          return compareOptionalNumber(left.technologyLevel, right.technologyLevel, query.order)
            || compareLocalizedName(left, right, query.locale ?? "en")
            || compareCanonicalId(left, right);
        }
        const result = query.sort === "rarity"
          ? left.rarity - right.rarity
            || compareLocalizedName(left, right, query.locale ?? "en")
            || compareCanonicalId(left, right)
          : compareLocalizedName(left, right, query.locale ?? "en")
            || compareCanonicalId(left, right);
        return direction(result, query.order);
      }));
    const pageInfo = pagination(query.page, query.limit, filtered.length);
    return {
      items: pageItems(filtered, pageInfo.page, query.limit).map(itemSummary),
      pagination: pageInfo,
      metadata: this.snapshot.metadata,
      domainMetadata: this.domains.items.domainMetadata
        ?? this.supplementalSnapshot.items[0]?.domainMetadata
        ?? this.domains.items.metadata
    };
  }

  getItem(id: string): PalworldItemDetail {
    this.ensureDomainAvailable("items");
    const item = identifierAliases(id).map((alias) => this.itemsById.get(alias)).find(Boolean);
    if (!item) throw new PalworldRecordNotFoundError("item", id);
    return item;
  }

  listSkills(query: PalworldSkillListQuery): PalworldPaginatedResponse<PalworldSkillSummary> {
    this.ensureDomainAvailable("skills");
    const term = query.q ? normalizePalworldSearchTerm(query.q) : undefined;
    const cacheKey = JSON.stringify([
      term ?? "",
      query.type ?? "",
      query.element ?? "",
      query.sort,
      query.order,
      query.locale ?? "en"
    ]);
    const filtered = this.cachedList(this.skillListCache, cacheKey, () => [...(this.snapshot.skills ?? [])]
      .filter((skill) =>
        term === undefined
        || matchNormalizedSearchFields(term, this.skillSearchFields.get(skill.id) ?? []) !== undefined
      )
      .filter((skill) => query.type === undefined || skill.type === query.type)
      .filter((skill) => query.element === undefined || skill.element === query.element)
      .sort((left, right) => {
        if (query.sort === "power") {
          return compareOptionalNumber(left.power, right.power, query.order)
            || compareLocalizedName(left, right, query.locale ?? "en")
            || compareCanonicalId(left, right);
        }
        if (query.sort === "unlockLevel") {
          return compareOptionalNumber(left.unlockLevel, right.unlockLevel, query.order)
            || compareLocalizedName(left, right, query.locale ?? "en")
            || compareCanonicalId(left, right);
        }
        return direction(
          compareLocalizedName(left, right, query.locale ?? "en")
            || compareCanonicalId(left, right),
          query.order
        );
      }));
    const pageInfo = pagination(query.page, query.limit, filtered.length);
    return {
      items: pageItems(filtered, pageInfo.page, query.limit).map(skillSummary),
      pagination: pageInfo,
      metadata: this.snapshot.metadata,
      domainMetadata: this.domains.skills?.domainMetadata
        ?? this.snapshot.skills?.[0]?.domainMetadata
        ?? this.domains.skills?.metadata
        ?? this.snapshot.metadata
    };
  }

  getSkill(id: string): PalworldSkillDetail {
    this.ensureDomainAvailable("skills");
    const skill = identifierAliases(id).map((alias) => this.skillsById.get(alias)).find(Boolean);
    if (!skill) throw new PalworldRecordNotFoundError("skill", id);
    return skill;
  }

  private ensureDomainAvailable(domain: "items" | "skills"): void {
    if (this.unavailableDomains.has(domain)) {
      throw new PalworldDomainUnavailableError(domain);
    }
  }

  private cachedList<T>(
    cache: Map<string, readonly T[]>,
    key: string,
    create: () => readonly T[]
  ): readonly T[] {
    const existing = cache.get(key);
    if (existing !== undefined) {
      cache.delete(key);
      cache.set(key, existing);
      return existing;
    }
    const created = create();
    cache.set(key, created);
    if (cache.size > 64) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return created;
  }

  breeding(query: PalworldBreedingQuery): PalworldBreedingResultResponse {
    const parentA = this.getPal(query.parentA);
    const parentB = this.getPal(query.parentB);
    if (!this.breedingEngine) {
      return {
        parentA: palReference(parentA),
        parentB: palReference(parentB),
        result: null,
        state: "data_unavailable",
        alternatives: [],
        metadata: this.snapshot.metadata
      };
    }
    const resolution = this.breedingEngine.resolve({
      parentAId: parentA.id,
      parentBId: parentB.id,
      ...(query.parentAGender === undefined ? {} : { parentAGender: query.parentAGender }),
      ...(query.parentBGender === undefined ? {} : { parentBGender: query.parentBGender })
    });
    const result = resolution.state === "resolved"
      ? this.enginePair(resolution.result)
      : null;
    const alternatives = resolution.state === "requires_gender"
      ? resolution.alternatives.map((pair) => this.enginePair(pair))
      : [];
    return {
      parentA: palReference(parentA),
      parentB: palReference(parentB),
      result,
      state: resolution.state,
      alternatives,
      metadata: this.snapshot.metadata
    };
  }

  breedingParents(query: PalworldBreedingParentsQuery): PalworldBreedingParentsResponse {
    const child = this.getPal(query.child);
    const pairs = (this.breedingEngine?.parents(child.id).map((pair) => this.enginePair(pair)) ?? [])
      .filter((pair) => query.type === undefined
        || query.type === "all"
        || (query.type === "special" ? pair.isSpecial : !pair.isSpecial));
    const pageInfo = pagination(query.page, query.limit, pairs.length);
    return {
      child: palReference(child),
      items: pageItems(pairs, pageInfo.page, query.limit),
      pagination: pageInfo,
      state: this.breedingEngine === undefined
        ? "data_unavailable"
        : pairs.length === 0
          ? "not_found"
          : "resolved",
      metadata: this.snapshot.metadata
    };
  }

  private requiredPal(id: string): PalworldPalDetail {
    const pal = identifierAliases(id).map((alias) => this.palsById.get(alias)).find(Boolean);
    if (!pal) throw new TypeError(`검증된 교배 artifact에 없는 Pal 참조가 있습니다: ${id}`);
    return pal;
  }

  private enginePair(pair: PalworldBreedingEnginePair): PalworldBreedingPair {
    const condition = pair.parentAGender !== undefined && pair.parentBGender !== undefined
      ? {
          parentA: pair.parentAGender,
          parentB: pair.parentBGender
        }
      : undefined;
    const id = `breeding-${createHash("sha256")
      .update(pair.parentAId)
      .update("\0")
      .update(pair.parentBId)
      .update("\0")
      .update(pair.childId)
      .update("\0")
      .update(pair.parentAGender ?? "")
      .update("\0")
      .update(pair.parentBGender ?? "")
      .digest("hex")
      .slice(0, 24)}`;
    return {
      id,
      parentA: palReference(this.requiredPal(pair.parentAId)),
      parentB: palReference(this.requiredPal(pair.parentBId)),
      child: palReference(this.requiredPal(pair.childId)),
      isSpecial: pair.isSpecial,
      ...(condition === undefined ? {} : { genderCondition: condition })
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
  activeRuntime?: PalworldActiveRuntime;
  releaseRoot?: string;
  imageRoot?: string;
  itemImageRoot?: string;
  elementImageRoot?: string;
  mappingRoot?: string;
  catalogRoot?: string;
  dataRoot?: string;
  activeManifestPath?: string;
  dashboardStaticRoot?: string;
  onTranslationState?: (
    locale: "ko" | "ja",
    state: Readonly<{
      status: "loaded" | "missing" | "invalid";
      errorCode?: string;
      staleSourceHash: boolean;
    }>
  ) => void;
  onBreedingState?: (
    state: Readonly<{
      status: "loaded" | "missing" | "invalid";
      release: string;
      errorCode?: string;
      artifactChecksum?: string;
    }>
  ) => void;
  onCatalogState?: (
    state: Readonly<{
      status: "loaded" | "missing" | "invalid" | "checksum_mismatch";
      release: string;
      errorCode?: string;
      items: number;
      skills: number;
    }>
  ) => void;
} = {}): Promise<PalworldDataService> {
  const activeRuntime = options.activeRuntime ?? (options.releaseRoot === undefined
    ? await loadPalworldActiveRuntime({
        ...(options.dataRoot === undefined ? {} : { dataRoot: options.dataRoot }),
        ...(options.activeManifestPath === undefined
          ? {}
          : { activeManifestPath: options.activeManifestPath })
      })
    : undefined);
  if (activeRuntime?.manifest.format === "operator_pak_v1") {
    const {
      loadPalworldPakShadowRuntimeFromStagingRoot
    } = await import("../data/palworld-pak-shadow-runtime.js");
    return (
      await loadPalworldPakShadowRuntimeFromStagingRoot({
        stagingRoot: activeRuntime.releaseRoot
      })
    ).service;
  }
  const releaseRoot = options.releaseRoot ?? activeRuntime?.releaseRoot;
  const activeRelease = activeRuntime?.manifest.release;
  const imageRoot = options.imageRoot
    ?? (
      options.dashboardStaticRoot === undefined || activeRelease === undefined
        ? undefined
        : path.join(
            options.dashboardStaticRoot,
            "images",
            "palworld",
            activeRelease,
            "pals"
          )
    );
  const release = await loadPalworldPaldexRuntimeRelease({
    ...(releaseRoot === undefined ? {} : { releaseRoot }),
    ...(imageRoot === undefined ? {} : { imageRoot }),
    ...(options.mappingRoot === undefined ? {} : { mappingRoot: options.mappingRoot })
  });
  const palworldImageRoot = path.dirname(imageRoot ?? PALWORLD_PALDEX_IMAGE_ROOT);
  const catalogRoot = options.catalogRoot ?? releaseRoot;
  if (catalogRoot === undefined) {
    throw new TypeError("PALWORLD_ACTIVE_RUNTIME_ROOT_UNAVAILABLE");
  }
  let breedingEngine: PalworldBreedingEngine | undefined;
  let breedingSource: PalworldBreedingRuntimeSource | undefined;
  try {
    breedingSource = await loadPalworldBreedingRuntimeSource(catalogRoot, {
      requireImportReport: false
    });
    if (
      breedingSource.artifact.release !== release.metadata.gameVersion
      || breedingSource.artifact.metadata.sourceRevision !== release.metadata.sourceRevision
    ) {
      throw new PalworldBreedingArtifactError("active Pal release와 교배 artifact provenance가 일치하지 않습니다.");
    }
    breedingEngine = new PalworldBreedingEngine(breedingSource.artifact);
    try {
      options.onBreedingState?.({
        status: "loaded",
        release: breedingSource.artifact.release,
        artifactChecksum: breedingSource.manifest.breedingSha256
      });
    } catch {
      // 진단 callback 실패는 공개 데이터 runtime과 분리합니다.
    }
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    try {
      options.onBreedingState?.({
        status: missing ? "missing" : "invalid",
        release: release.metadata.gameVersion,
        errorCode: missing
          ? "PALWORLD_BREEDING_ARTIFACT_MISSING"
          : error instanceof PalworldBreedingArtifactError
            ? error.code
            : "PALWORLD_BREEDING_INITIALIZATION_FAILED"
      });
    } catch {
      // 진단 callback 실패는 공개 데이터 runtime과 분리합니다.
    }
  }
  try {
    const catalogSource = await loadPalworldCatalogDataSource(catalogRoot);
    let reviewedItemAliases: PalworldReviewedItemAlias[] = [];
    try {
      reviewedItemAliases = await loadPalworldReviewedItemAliases(catalogRoot, catalogSource.catalog);
    } catch {
      // 검수 이름 alias 손상은 번역 bundle만 stale/invalid로 차단하고,
      // Palworld 영문 catalog와 기존 공개 API는 계속 제공한다.
    }
    const translationBundle = await loadPalworldTranslationBundle({
      releaseRoot: catalogRoot,
      context: createPalworldTranslationValidationContext({
        catalog: catalogSource.catalog,
        catalogSha256: catalogSource.manifest.catalogSha256,
        paldex: release,
        paldexSha256: release.manifest.paldexSha256,
        reviewedItemAliases
      })
    });
    for (const locale of ["ko", "ja"] as const) {
      try {
        options.onTranslationState?.(locale, { ...translationBundle.states[locale] });
      } catch {
        // 진단 callback 실패가 공개 Palworld 데이터 runtime을 중단시키지 않도록 격리한다.
      }
    }
    let itemAssetsAvailable: boolean | ReadonlySet<string> = new Set<string>();
    let elementAssetsAvailable: boolean | ReadonlySet<string> = new Set<string>();
    try {
      itemAssetsAvailable = (await collectPalworldCatalogRuntimeAssetCoverage({
        root: options.itemImageRoot ?? path.join(palworldImageRoot, "items"),
        kind: "items",
        manifest: catalogSource.itemImagesManifest
      })).validIds;
    } catch (error) {
      if (
        !(error instanceof PalworldCatalogValidationError)
        && !(error instanceof PalworldPaldexValidationError)
        && (error as NodeJS.ErrnoException).code !== "ENOENT"
        && (error as NodeJS.ErrnoException).code !== "EACCES"
      ) {
        throw error;
      }
    }
    try {
      elementAssetsAvailable = (await collectPalworldCatalogRuntimeAssetCoverage({
        root: options.elementImageRoot ?? path.join(palworldImageRoot, "elements"),
        kind: "elements",
        manifest: catalogSource.elementImagesManifest
      })).validIds;
    } catch (error) {
      if (
        !(error instanceof PalworldCatalogValidationError)
        && !(error instanceof PalworldPaldexValidationError)
        && (error as NodeJS.ErrnoException).code !== "ENOENT"
        && (error as NodeJS.ErrnoException).code !== "EACCES"
      ) {
        throw error;
      }
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
      translations: {
        snapshots: translationBundle.snapshots,
        staleSourceHash: {
          ko: translationBundle.states.ko.staleSourceHash,
          ja: translationBundle.states.ja.staleSourceHash
        }
      },
      reviewedItemAliases,
      sourceChecksum: createHash("sha256")
        .update(release.manifest.paldexSha256)
        .update("\0")
        .update(catalogSource.manifest.catalogSha256)
        .digest("hex")
    });
    const requiredBreedingCoverage = breedingSource !== undefined
      && Object.values(breedingSource.fieldCoverage).every((field) =>
        field.available === adaptedCatalog.snapshot.pals.length
        && field.total === adaptedCatalog.snapshot.pals.length
      )
      ? adaptedCatalog.snapshot.pals.length
      : 0;
    try {
      options.onCatalogState?.({
        status: "loaded",
        release: release.metadata.gameVersion,
        items: adaptedCatalog.snapshot.items.length,
        skills: adaptedCatalog.snapshot.skills?.length ?? 0
      });
    } catch {
      // 진단 callback 실패는 공개 데이터 runtime과 분리합니다.
    }
    return new PalworldDataService(adaptedCatalog.snapshot, {
      sourceInternalIds: release.sourceInternalIds,
      domains: {
        ...adaptedCatalog.domains,
        breeding: {
          status: "incomplete",
          recordCount: breedingEngine?.pairCount ?? 0,
          metadata: { ...adaptedCatalog.snapshot.metadata }
        }
      },
      gates: runtimeGates(release),
      coverage: {
        ...adaptedCatalog.coverage,
        breedingFields: {
          available: requiredBreedingCoverage,
          missing: adaptedCatalog.snapshot.pals.length - requiredBreedingCoverage,
          total: adaptedCatalog.snapshot.pals.length
        }
      },
      breedingEngine
    });
  } catch (error) {
    if (
      !(error instanceof PalworldCatalogValidationError)
      && !(error instanceof PalworldCatalogAdapterError)
      && (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      throw error;
    }
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    const checksumMismatch = error instanceof PalworldCatalogValidationError
      && /checksum|sha-?256/i.test(error.message);
    try {
      options.onCatalogState?.({
        status: missing ? "missing" : checksumMismatch ? "checksum_mismatch" : "invalid",
        release: release.metadata.gameVersion,
        errorCode: missing
          ? "PALWORLD_CATALOG_MISSING"
          : checksumMismatch
            ? "PALWORLD_CATALOG_CHECKSUM_MISMATCH"
            : error instanceof PalworldCatalogValidationError
              ? error.code
              : "PALWORLD_CATALOG_INVALID",
        items: 0,
        skills: 0
      });
    } catch {
      // 진단 callback 실패는 공개 데이터 runtime과 분리합니다.
    }
  }
  const fallbackSnapshot = incompletePaldexSnapshot(release);
  return new PalworldDataService(fallbackSnapshot, {
    sourceInternalIds: release.sourceInternalIds,
    domains: {
      pals: {
        status: "incomplete",
        recordCount: fallbackSnapshot.pals.length,
        metadata: fallbackSnapshot.metadata
      },
      items: {
        status: "unavailable",
        recordCount: 0,
        metadata: fallbackSnapshot.metadata
      },
      breeding: {
        status: "incomplete",
        recordCount: breedingEngine?.pairCount ?? 0,
        metadata: fallbackSnapshot.metadata
      },
      skills: {
        status: "unavailable",
        recordCount: 0,
        metadata: fallbackSnapshot.metadata
      }
    },
    gates: runtimeGates(release),
    breedingEngine,
    unavailableDomains: ["items", "skills"]
  });
}
