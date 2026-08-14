import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MINECRAFT_RECIPE_TYPES,
  type MinecraftCatalogMetadata,
  type MinecraftCatalogResponse,
  type MinecraftEnchant,
  type MinecraftItem,
  type MinecraftItemReference,
  type MinecraftRecipe,
  type MinecraftRecipeIngredient,
  type MinecraftRecipeType
} from "@streamops/shared";
import {
  MINECRAFT_CATALOG_GAME_VERSION,
  MinecraftCatalogArtifactError,
  validateMinecraftCatalogArtifact,
  type MinecraftCatalogArtifact,
  type MinecraftCatalogRecipe,
  type MinecraftCatalogRecipeIngredient
} from "../data/minecraft-catalog-artifact.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DEFAULT_ARTIFACT_PATH = path.resolve(
  PROJECT_ROOT,
  `apps/server/data/minecraft/catalog-${MINECRAFT_CATALOG_GAME_VERSION}.json`
);
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const MAX_SEARCH_LENGTH = 80;
const EXPECTED_ARTIFACT_SHA256 =
  "6368f0da9a17efeea379f76f793ceb16b7c6050cf82ecd41fbd9a3c2a3182e22";

export class MinecraftCatalogQueryError extends Error {
  readonly code = "MINECRAFT_QUERY_INVALID";

  constructor(readonly publicMessage: string) {
    super(publicMessage);
    this.name = "MinecraftCatalogQueryError";
  }
}

export class MinecraftCatalogUnavailableError extends Error {
  readonly code = "MINECRAFT_CATALOG_UNAVAILABLE";

  constructor() {
    super("마인크래프트 카탈로그를 사용할 수 없습니다.");
    this.name = "MinecraftCatalogUnavailableError";
  }
}

type PageQuery = {
  q?: string;
  page: number;
  limit: number;
};

type RecipePageQuery = PageQuery & {
  type?: MinecraftRecipeType;
};

function parsePositiveInteger(
  params: URLSearchParams,
  key: string,
  fallback: number,
  maximum: number
): number {
  const raw = params.get(key);
  if (raw === null) return fallback;
  if (!/^[1-9]\d{0,4}$/u.test(raw)) {
    throw new MinecraftCatalogQueryError(`${key} 값은 양의 정수여야 합니다.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) {
    throw new MinecraftCatalogQueryError(`${key} 값이 허용 범위를 벗어났습니다.`);
  }
  return value;
}

function parsePageQuery(
  params: URLSearchParams,
  options: { allowType: boolean }
): PageQuery | RecipePageQuery {
  const allowed = new Set(options.allowType
    ? ["q", "type", "page", "limit"]
    : ["q", "page", "limit"]);
  for (const key of params.keys()) {
    if (!allowed.has(key)) throw new MinecraftCatalogQueryError(`지원하지 않는 query parameter입니다: ${key}`);
    if (params.getAll(key).length > 1) {
      throw new MinecraftCatalogQueryError(`query parameter는 한 번만 지정할 수 있습니다: ${key}`);
    }
  }
  const rawQuery = params.get("q");
  const q = rawQuery?.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (
    q !== undefined
    && (q.length < 1 || q.length > MAX_SEARCH_LENGTH || /[\u0000-\u001f\u007f]/u.test(q))
  ) throw new MinecraftCatalogQueryError("q 검색어 형식이 올바르지 않습니다.");
  const page = parsePositiveInteger(params, "page", 1, 10_000);
  const limit = parsePositiveInteger(params, "limit", 50, 100);
  if (!options.allowType) return { ...(q ? { q } : {}), page, limit };
  const type = params.get("type");
  if (type !== null && !MINECRAFT_RECIPE_TYPES.includes(type as MinecraftRecipeType)) {
    throw new MinecraftCatalogQueryError("type 값이 허용 목록에 없습니다.");
  }
  return {
    ...(q ? { q } : {}),
    ...(type === null ? {} : { type: type as MinecraftRecipeType }),
    page,
    limit
  };
}

function normalizedSearchFields(values: readonly string[]): string[] {
  return values.map((value) => value.normalize("NFKC").toLocaleLowerCase());
}

function matchesSearch(query: string | undefined, fields: readonly string[]): boolean {
  if (!query) return true;
  const normalized = query.normalize("NFKC").toLocaleLowerCase();
  return fields.some((field) => field.includes(normalized));
}

function itemSearchFields(item: MinecraftItem): string[] {
  return normalizedSearchFields([item.id, item.name.en, item.name.ko, item.name.ja]);
}

function itemReference(item: MinecraftItem): MinecraftItemReference {
  return { id: item.id, name: item.name };
}

function pageResponse<T>(
  values: readonly T[],
  query: PageQuery,
  metadata: MinecraftCatalogMetadata
): MinecraftCatalogResponse<T> {
  const totalPages = Math.max(1, Math.ceil(values.length / query.limit));
  const page = Math.min(query.page, totalPages);
  const offset = (page - 1) * query.limit;
  const items = values.slice(offset, offset + query.limit);
  return {
    state: "ready",
    items,
    pagination: {
      page,
      limit: query.limit,
      total: values.length,
      totalPages,
      returned: items.length,
      hasNextPage: page < totalPages
    },
    metadata
  };
}

export class MinecraftCatalogService {
  private readonly itemById: ReadonlyMap<string, MinecraftItem>;
  private readonly itemSearchById: ReadonlyMap<string, readonly string[]>;

  private constructor(private readonly artifact: MinecraftCatalogArtifact) {
    this.itemById = new Map(artifact.items.map((item) => [item.id, item]));
    this.itemSearchById = new Map(artifact.items.map((item) => [item.id, itemSearchFields(item)]));
  }

  static load(artifactPath = DEFAULT_ARTIFACT_PATH): MinecraftCatalogService {
    try {
      const raw = fs.readFileSync(artifactPath, "utf8");
      if (Buffer.byteLength(raw, "utf8") > MAX_ARTIFACT_BYTES) throw new Error("artifact_too_large");
      const artifactSha256 = createHash("sha256").update(raw, "utf8").digest("hex");
      if (artifactSha256 !== EXPECTED_ARTIFACT_SHA256) throw new Error("artifact_hash_mismatch");
      return new MinecraftCatalogService(validateMinecraftCatalogArtifact(JSON.parse(raw) as unknown));
    } catch (error) {
      if (error instanceof MinecraftCatalogArtifactError) throw new MinecraftCatalogUnavailableError();
      throw new MinecraftCatalogUnavailableError();
    }
  }

  metadata(): MinecraftCatalogMetadata {
    return this.artifact.metadata;
  }

  items(params: URLSearchParams): MinecraftCatalogResponse<MinecraftItem> {
    const query = parsePageQuery(params, { allowType: false }) as PageQuery;
    const filtered = this.artifact.items.filter((item) =>
      matchesSearch(query.q, this.itemSearchById.get(item.id) ?? []));
    return pageResponse(filtered, query, this.artifact.metadata);
  }

  recipes(params: URLSearchParams): MinecraftCatalogResponse<MinecraftRecipe> {
    const query = parsePageQuery(params, { allowType: true }) as RecipePageQuery;
    const filtered = this.artifact.recipes.filter((recipe) => {
      if (query.type !== undefined && recipe.type !== query.type) return false;
      if (!query.q) return true;
      return [recipe.result.itemId, ...recipe.ingredients.map((ingredient) => ingredient.itemId)]
        .some((id) => matchesSearch(query.q, this.itemSearchById.get(id) ?? []));
    }).map((recipe) => this.publicRecipe(recipe));
    return pageResponse(filtered, query, this.artifact.metadata);
  }

  enchants(params: URLSearchParams): MinecraftCatalogResponse<MinecraftEnchant> {
    const query = parsePageQuery(params, { allowType: false }) as PageQuery;
    const filtered = this.artifact.enchants.filter((enchant) => matchesSearch(
      query.q,
      normalizedSearchFields([enchant.id, enchant.name.en, enchant.name.ko, enchant.name.ja])
    ));
    return pageResponse(filtered, query, this.artifact.metadata);
  }

  private publicIngredient(ingredient: MinecraftCatalogRecipeIngredient): MinecraftRecipeIngredient {
    const item = this.itemById.get(ingredient.itemId);
    if (!item) throw new MinecraftCatalogUnavailableError();
    return { item: itemReference(item), count: ingredient.count };
  }

  private publicRecipe(recipe: MinecraftCatalogRecipe): MinecraftRecipe {
    return {
      id: recipe.id,
      type: recipe.type,
      result: this.publicIngredient(recipe.result),
      ingredients: recipe.ingredients.map((ingredient) => this.publicIngredient(ingredient)),
      ...(recipe.shape === undefined ? {} : {
        shape: recipe.shape.map((row) => row.map((itemId) => {
          if (itemId === null) return null;
          const item = this.itemById.get(itemId);
          if (!item) throw new MinecraftCatalogUnavailableError();
          return itemReference(item);
        }))
      })
    };
  }
}
