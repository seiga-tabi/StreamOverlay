import {
  assertPalworldDataSnapshot,
  type PalworldBreedingParentsResponse,
  type PalworldBreedingResultResponse,
  type PalworldDataSnapshot,
  type PalworldItemDetail,
  type PalworldItemSummary,
  type PalworldMetaResponse,
  type PalworldPaginatedResponse,
  type PalworldPagination,
  type PalworldPalDetail,
  type PalworldPalReference,
  type PalworldPalSummary,
  type PalworldSearchResult
} from "@streamops/shared";
import { PALWORLD_SNAPSHOT } from "../data/palworld-snapshot.js";
import {
  normalizePalworldSearchTerm,
  type PalworldBreedingParentsQuery,
  type PalworldBreedingQuery,
  type PalworldItemListQuery,
  type PalworldPalListQuery,
  type PalworldSortOrder
} from "./palworld-query.js";

export const PALWORLD_PUBLIC_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=86400";

export class PalworldRecordNotFoundError extends Error {
  readonly code = "PALWORLD_NOT_FOUND";

  constructor(
    readonly recordType: "pal" | "item",
    readonly recordId: string
  ) {
    super(`${recordType === "pal" ? "Pal" : "아이템"}을 찾을 수 없습니다: ${recordId}`);
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
    elements: pal.elements
  };
}

function itemSummary(item: PalworldItemDetail): PalworldItemSummary {
  return {
    id: item.id,
    nameKo: item.nameKo,
    nameJa: item.nameJa,
    nameEn: item.nameEn,
    ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
    category: item.category,
    rarity: item.rarity,
    descriptionKo: item.descriptionKo,
    descriptionJa: item.descriptionJa,
    ...(item.descriptionEn ? { descriptionEn: item.descriptionEn } : {}),
    ...(item.sellPrice === undefined ? {} : { sellPrice: item.sellPrice }),
    ...(item.technologyLevel === undefined ? {} : { technologyLevel: item.technologyLevel })
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
  private readonly palsById: ReadonlyMap<string, PalworldPalDetail>;
  private readonly itemsById: ReadonlyMap<string, PalworldItemDetail>;

  constructor(snapshot: unknown = PALWORLD_SNAPSHOT) {
    this.snapshot = assertPalworldDataSnapshot(snapshot);
    this.palsById = this.indexByIdAliases(this.snapshot.pals);
    this.itemsById = this.indexByIdAliases(this.snapshot.items);
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
        items: this.snapshot.items.length,
        breedingPairs: this.snapshot.breedingPairs.length
      }
    };
  }

  search(rawQuery: string, limit: number): PalworldSearchResult {
    const query = rawQuery.trim().replace(/\s+/gu, " ");
    const term = normalizePalworldSearchTerm(query);
    const matchedPals = this.snapshot.pals
      .map((pal) => ({
        pal,
        score: matchScore(term, [...identifierAliases(pal.id), pal.number, `#${pal.number}`, pal.nameKo, pal.nameJa, pal.nameEn])
      }))
      .filter((entry): entry is { pal: PalworldPalDetail; score: number } => entry.score !== undefined)
      .sort((left, right) => left.score - right.score || left.pal.number - right.pal.number);
    const pals = matchedPals
      .slice(0, limit)
      .map(({ pal }) => palSummary(pal));
    const matchedItems = this.snapshot.items
      .map((item) => ({ item, score: matchScore(term, [...identifierAliases(item.id), item.nameKo, item.nameJa, item.nameEn]) }))
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
      metadata: this.snapshot.metadata
    };
  }

  listPals(query: PalworldPalListQuery): PalworldPaginatedResponse<PalworldPalSummary> {
    const term = query.q ? normalizePalworldSearchTerm(query.q) : undefined;
    const filtered = this.snapshot.pals
      .filter((pal) => term === undefined || matchScore(term, [...identifierAliases(pal.id), pal.number, `#${pal.number}`, pal.nameKo, pal.nameJa, pal.nameEn]) !== undefined)
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
    const filtered = this.snapshot.items
      .filter((item) => term === undefined || matchScore(term, [...identifierAliases(item.id), item.nameKo, item.nameJa, item.nameEn]) !== undefined)
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
          : compareText(left.nameKo, right.nameKo);
        return direction(result, query.order);
      });
    const pageInfo = pagination(query.page, query.limit, filtered.length);
    return {
      items: pageItems(filtered, pageInfo.page, query.limit).map(itemSummary),
      pagination: pageInfo,
      metadata: this.snapshot.metadata
    };
  }

  getItem(id: string): PalworldItemDetail {
    const item = identifierAliases(id).map((alias) => this.itemsById.get(alias)).find(Boolean);
    if (!item) throw new PalworldRecordNotFoundError("item", id);
    return item;
  }

  breeding(query: PalworldBreedingQuery): PalworldBreedingResultResponse {
    const parentA = this.getPal(query.parentA);
    const parentB = this.getPal(query.parentB);
    const result = this.snapshot.breedingPairs.find((pair) =>
      (pair.parentA.id === parentA.id && pair.parentB.id === parentB.id) ||
      (pair.parentA.id === parentB.id && pair.parentB.id === parentA.id)
    ) ?? null;
    return {
      parentA: palReference(parentA),
      parentB: palReference(parentB),
      result,
      metadata: this.snapshot.metadata
    };
  }

  breedingParents(query: PalworldBreedingParentsQuery): PalworldBreedingParentsResponse {
    const child = this.getPal(query.child);
    const pairs = this.snapshot.breedingPairs.filter((pair) => pair.child.id === child.id);
    const pageInfo = pagination(query.page, query.limit, pairs.length);
    return {
      child: palReference(child),
      items: pageItems(pairs, pageInfo.page, query.limit),
      pagination: pageInfo,
      metadata: this.snapshot.metadata
    };
  }
}

export const palworldDataService = new PalworldDataService();
