export const MINECRAFT_RECIPE_TYPES = [
  "crafting",
  "smelting",
  "brewing",
  "smithing",
  "stonecutting"
] as const;

export const MINECRAFT_PATCH_EDITIONS = ["java", "bedrock"] as const;
export const MINECRAFT_PATCH_TYPES = ["release", "snapshot", "preview"] as const;

export const MINECRAFT_TRANSLATION_DISPLAY_STATUSES = [
  "source_provided",
  "source_language_fallback"
] as const;

export const MINECRAFT_RECIPE_TYPE_AVAILABILITIES = [
  "ready",
  "not_provided_by_source"
] as const;

export type MinecraftRecipeType = (typeof MINECRAFT_RECIPE_TYPES)[number];
export type MinecraftPatchEdition = (typeof MINECRAFT_PATCH_EDITIONS)[number];
export type MinecraftPatchType = (typeof MINECRAFT_PATCH_TYPES)[number];
export type MinecraftTranslationDisplayStatus =
  (typeof MINECRAFT_TRANSLATION_DISPLAY_STATUSES)[number];
export type MinecraftRecipeTypeAvailability =
  (typeof MINECRAFT_RECIPE_TYPE_AVAILABILITIES)[number];

export type MinecraftLocalizedName = Readonly<{
  en: string;
  ko: string;
  ja: string;
  status: Readonly<{
    ko: MinecraftTranslationDisplayStatus;
    ja: MinecraftTranslationDisplayStatus;
  }>;
}>;

export type MinecraftItemReference = Readonly<{
  id: string;
  name: MinecraftLocalizedName;
}>;

export type MinecraftCatalogMetadata = Readonly<{
  schemaVersion: 1;
  gameVersion: string;
  sourceName: "minecraft-data";
  sourceUrl: "https://github.com/PrismarineJS/minecraft-data";
  sourcePackageVersion: string;
  sourceRevision: string;
  generatedAt: string;
  license: "MIT";
  coverage: Readonly<{
    items: number;
    recipes: number;
    enchants: number;
    excludedRecipes: number;
    localizedItemNamesKo: number;
    localizedItemNamesJa: number;
    localizedEnchantNamesKo: number;
    localizedEnchantNamesJa: number;
    recipeTypes: Readonly<Record<MinecraftRecipeType, MinecraftRecipeTypeAvailability>>;
  }>;
}>;

export type MinecraftPagination = Readonly<{
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  returned: number;
  hasNextPage: boolean;
}>;

export type MinecraftItem = Readonly<{
  id: string;
  numericId: number;
  name: MinecraftLocalizedName;
  stackSize: number;
  maxDurability?: number;
  enchantCategoryIds: readonly string[];
}>;

export type MinecraftRecipeIngredient = Readonly<{
  item: MinecraftItemReference;
  count: number;
}>;

export type MinecraftRecipe = Readonly<{
  id: string;
  type: MinecraftRecipeType;
  result: MinecraftRecipeIngredient;
  ingredients: readonly MinecraftRecipeIngredient[];
  /** shaped crafting에서만 존재하며 빈 칸은 null입니다. */
  shape?: readonly (readonly (MinecraftItemReference | null)[])[];
}>;

export type MinecraftEnchant = Readonly<{
  id: string;
  numericId: number;
  name: MinecraftLocalizedName;
  maxLevel: number;
  minCost: Readonly<{ a: number; b: number }>;
  maxCost: Readonly<{ a: number; b: number }>;
  treasureOnly: boolean;
  curse: boolean;
  categoryId: string;
  weight: number;
  tradeable: boolean;
  discoverable: boolean;
  incompatibleIds: readonly string[];
}>;

export type MinecraftCatalogResponse<T> =
  | Readonly<{ state: "data_unavailable" }>
  | Readonly<{
      state: "ready";
      items: readonly T[];
      pagination: MinecraftPagination;
      metadata: MinecraftCatalogMetadata;
    }>;

export type MinecraftPatchLocalizedSummary = Readonly<{
  ko: string;
  ja: string;
}>;

export type MinecraftPatchEntry = Readonly<{
  id: string;
  edition: MinecraftPatchEdition;
  version: string;
  type: MinecraftPatchType;
  publishedAt: string;
  officialUrl: string;
  /** 사람이 검수해 작성한 요약만 존재하며, 준비 전에는 필드 자체를 생략합니다. */
  title?: MinecraftPatchLocalizedSummary;
  highlights?: readonly MinecraftPatchLocalizedSummary[];
}>;

export type MinecraftPatchNotesResponse =
  | Readonly<{ state: "data_unavailable" }>
  | Readonly<{
      state: "ready";
      entries: readonly MinecraftPatchEntry[];
      pagination: Readonly<{
        page: number;
        totalPages: number;
        hasNextPage: boolean;
        total: number;
      }>;
    }>;

export type MinecraftValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ID_PATTERN = /^[a-z0-9][a-z0-9_]{0,127}$/u;
const RECIPE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,159}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MINECRAFT_PATCH_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const MINECRAFT_PATCH_VERSION_PATTERN = /^[0-9][0-9a-zA-Z._-]{0,31}$/u;

function invalid<T>(error: string): MinecraftValidationResult<T> {
  return { ok: false, error };
}

function exactRecord(
  value: unknown,
  allowed: readonly string[],
  path: string
): MinecraftValidationResult<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid(`${path}_object_required`);
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowed.includes(key))) {
    return invalid(`${path}_unknown_field`);
  }
  return { ok: true, data: record };
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && value.trim().length > 0
    && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function integer(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum;
}

function canonicalIsoDate(value: unknown): value is string {
  if (
    typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  ) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function localizedName(value: unknown, path: string): MinecraftValidationResult<MinecraftLocalizedName> {
  const result = exactRecord(value, ["en", "ko", "ja", "status"], path);
  if (!result.ok) return result;
  if (
    !boundedText(result.data.en, 160)
    || !boundedText(result.data.ko, 160)
    || !boundedText(result.data.ja, 160)
  ) return invalid(`${path}_invalid`);
  const status = exactRecord(result.data.status, ["ko", "ja"], `${path}_status`);
  if (!status.ok) return status;
  for (const locale of ["ko", "ja"] as const) {
    if (!MINECRAFT_TRANSLATION_DISPLAY_STATUSES.includes(
      status.data[locale] as MinecraftTranslationDisplayStatus
    )) return invalid(`${path}_${locale}_status_invalid`);
    if (status.data[locale] === "source_language_fallback" && result.data[locale] !== result.data.en) {
      return invalid(`${path}_${locale}_fallback_mismatch`);
    }
  }
  return { ok: true, data: result.data as MinecraftLocalizedName };
}

function itemReference(value: unknown, path: string): MinecraftValidationResult<MinecraftItemReference> {
  const result = exactRecord(value, ["id", "name"], path);
  if (!result.ok) return result;
  if (typeof result.data.id !== "string" || !ID_PATTERN.test(result.data.id)) {
    return invalid(`${path}_id_invalid`);
  }
  const name = localizedName(result.data.name, `${path}_name`);
  if (!name.ok) return name;
  return { ok: true, data: result.data as MinecraftItemReference };
}

function metadata(value: unknown): MinecraftValidationResult<MinecraftCatalogMetadata> {
  const result = exactRecord(value, [
    "schemaVersion",
    "gameVersion",
    "sourceName",
    "sourceUrl",
    "sourcePackageVersion",
    "sourceRevision",
    "generatedAt",
    "license",
    "coverage"
  ], "metadata");
  if (!result.ok) return result;
  if (
    result.data.schemaVersion !== 1
    || !boundedText(result.data.gameVersion, 40)
    || result.data.sourceName !== "minecraft-data"
    || result.data.sourceUrl !== "https://github.com/PrismarineJS/minecraft-data"
    || !boundedText(result.data.sourcePackageVersion, 40)
    || typeof result.data.sourceRevision !== "string"
    || !SHA256_PATTERN.test(result.data.sourceRevision)
    || !canonicalIsoDate(result.data.generatedAt)
    || result.data.license !== "MIT"
  ) return invalid("metadata_invalid");
  const coverage = exactRecord(result.data.coverage, [
    "items",
    "recipes",
    "enchants",
    "excludedRecipes",
    "localizedItemNamesKo",
    "localizedItemNamesJa",
    "localizedEnchantNamesKo",
    "localizedEnchantNamesJa",
    "recipeTypes"
  ], "metadata_coverage");
  if (!coverage.ok) return coverage;
  for (const key of [
    "items",
    "recipes",
    "enchants",
    "excludedRecipes",
    "localizedItemNamesKo",
    "localizedItemNamesJa",
    "localizedEnchantNamesKo",
    "localizedEnchantNamesJa"
  ]) {
    if (!integer(coverage.data[key], 0, 100_000)) return invalid(`metadata_coverage_${key}_invalid`);
  }
  if (
    (coverage.data.localizedItemNamesKo as number) > (coverage.data.items as number)
    || (coverage.data.localizedItemNamesJa as number) > (coverage.data.items as number)
    || (coverage.data.localizedEnchantNamesKo as number) > (coverage.data.enchants as number)
    || (coverage.data.localizedEnchantNamesJa as number) > (coverage.data.enchants as number)
  ) return invalid("metadata_coverage_localized_count_invalid");
  const recipeTypes = exactRecord(
    coverage.data.recipeTypes,
    MINECRAFT_RECIPE_TYPES,
    "metadata_coverage_recipe_types"
  );
  if (!recipeTypes.ok || Object.keys(recipeTypes.data).length !== MINECRAFT_RECIPE_TYPES.length) {
    return invalid("metadata_coverage_recipe_types_invalid");
  }
  for (const type of MINECRAFT_RECIPE_TYPES) {
    if (!MINECRAFT_RECIPE_TYPE_AVAILABILITIES.includes(
      recipeTypes.data[type] as MinecraftRecipeTypeAvailability
    )) return invalid(`metadata_coverage_recipe_type_${type}_invalid`);
  }
  return { ok: true, data: result.data as MinecraftCatalogMetadata };
}

function item(value: unknown, index: number): MinecraftValidationResult<MinecraftItem> {
  const path = `items_${index}`;
  const result = exactRecord(value, [
    "id", "numericId", "name", "stackSize", "maxDurability", "enchantCategoryIds"
  ], path);
  if (!result.ok) return result;
  if (
    typeof result.data.id !== "string"
    || !ID_PATTERN.test(result.data.id)
    || !integer(result.data.numericId, 0, 1_000_000)
    || !integer(result.data.stackSize, 1, 99)
    || (result.data.maxDurability !== undefined && !integer(result.data.maxDurability, 1, 1_000_000))
    || !Array.isArray(result.data.enchantCategoryIds)
    || result.data.enchantCategoryIds.length > 32
  ) return invalid(`${path}_invalid`);
  const name = localizedName(result.data.name, `${path}_name`);
  if (!name.ok) return name;
  const categories = result.data.enchantCategoryIds;
  if (
    categories.some((entry) => typeof entry !== "string" || !ID_PATTERN.test(entry))
    || new Set(categories).size !== categories.length
  ) return invalid(`${path}_enchant_categories_invalid`);
  return { ok: true, data: result.data as MinecraftItem };
}

function ingredient(value: unknown, path: string): MinecraftValidationResult<MinecraftRecipeIngredient> {
  const result = exactRecord(value, ["item", "count"], path);
  if (!result.ok) return result;
  const reference = itemReference(result.data.item, `${path}_item`);
  if (!reference.ok) return reference;
  if (!integer(result.data.count, 1, 99)) return invalid(`${path}_count_invalid`);
  return { ok: true, data: result.data as MinecraftRecipeIngredient };
}

function recipe(value: unknown, index: number): MinecraftValidationResult<MinecraftRecipe> {
  const path = `recipes_${index}`;
  const result = exactRecord(value, ["id", "type", "result", "ingredients", "shape"], path);
  if (!result.ok) return result;
  if (
    typeof result.data.id !== "string"
    || !RECIPE_ID_PATTERN.test(result.data.id)
    || !MINECRAFT_RECIPE_TYPES.includes(result.data.type as MinecraftRecipeType)
  ) return invalid(`${path}_invalid`);
  const output = ingredient(result.data.result, `${path}_result`);
  if (!output.ok) return output;
  if (!Array.isArray(result.data.ingredients) || result.data.ingredients.length < 1 || result.data.ingredients.length > 16) {
    return invalid(`${path}_ingredients_invalid`);
  }
  const seenIngredients = new Set<string>();
  for (const [ingredientIndex, candidate] of result.data.ingredients.entries()) {
    const parsed = ingredient(candidate, `${path}_ingredients_${ingredientIndex}`);
    if (!parsed.ok || seenIngredients.has(parsed.data.item.id)) {
      return parsed.ok ? invalid(`${path}_ingredients_duplicate`) : parsed;
    }
    seenIngredients.add(parsed.data.item.id);
  }
  if (result.data.shape !== undefined) {
    if (!Array.isArray(result.data.shape) || result.data.shape.length < 1 || result.data.shape.length > 3) {
      return invalid(`${path}_shape_invalid`);
    }
    const width = Array.isArray(result.data.shape[0]) ? result.data.shape[0].length : 0;
    if (width < 1 || width > 3) return invalid(`${path}_shape_width_invalid`);
    for (const [rowIndex, row] of result.data.shape.entries()) {
      if (!Array.isArray(row) || row.length !== width) return invalid(`${path}_shape_${rowIndex}_invalid`);
      for (const [columnIndex, cell] of row.entries()) {
        if (cell === null) continue;
        const parsed = itemReference(cell, `${path}_shape_${rowIndex}_${columnIndex}`);
        if (!parsed.ok) return parsed;
      }
    }
  }
  return { ok: true, data: result.data as MinecraftRecipe };
}

function cost(value: unknown, path: string): MinecraftValidationResult<Readonly<{ a: number; b: number }>> {
  const result = exactRecord(value, ["a", "b"], path);
  if (!result.ok) return result;
  if (!integer(result.data.a, 0, 1_000) || !integer(result.data.b, 0, 1_000)) {
    return invalid(`${path}_invalid`);
  }
  return { ok: true, data: result.data as Readonly<{ a: number; b: number }> };
}

function enchant(value: unknown, index: number): MinecraftValidationResult<MinecraftEnchant> {
  const path = `enchants_${index}`;
  const result = exactRecord(value, [
    "id", "numericId", "name", "maxLevel", "minCost", "maxCost", "treasureOnly", "curse",
    "categoryId", "weight", "tradeable", "discoverable", "incompatibleIds"
  ], path);
  if (!result.ok) return result;
  if (
    typeof result.data.id !== "string"
    || !ID_PATTERN.test(result.data.id)
    || !integer(result.data.numericId, 0, 10_000)
    || !integer(result.data.maxLevel, 1, 255)
    || !integer(result.data.weight, 1, 1_000)
    || typeof result.data.categoryId !== "string"
    || !ID_PATTERN.test(result.data.categoryId)
    || typeof result.data.treasureOnly !== "boolean"
    || typeof result.data.curse !== "boolean"
    || typeof result.data.tradeable !== "boolean"
    || typeof result.data.discoverable !== "boolean"
    || !Array.isArray(result.data.incompatibleIds)
    || result.data.incompatibleIds.length > 128
  ) return invalid(`${path}_invalid`);
  const name = localizedName(result.data.name, `${path}_name`);
  if (!name.ok) return name;
  const minCost = cost(result.data.minCost, `${path}_min_cost`);
  if (!minCost.ok) return minCost;
  const maxCost = cost(result.data.maxCost, `${path}_max_cost`);
  if (!maxCost.ok) return maxCost;
  if (
    result.data.incompatibleIds.some((entry) => typeof entry !== "string" || !ID_PATTERN.test(entry))
    || new Set(result.data.incompatibleIds).size !== result.data.incompatibleIds.length
  ) return invalid(`${path}_incompatible_ids_invalid`);
  return { ok: true, data: result.data as MinecraftEnchant };
}

function pagination(value: unknown, itemLength: number): MinecraftValidationResult<MinecraftPagination> {
  const result = exactRecord(value, [
    "page", "limit", "total", "totalPages", "returned", "hasNextPage"
  ], "pagination");
  if (!result.ok) return result;
  if (
    !integer(result.data.page, 1, 10_000)
    || !integer(result.data.limit, 1, 100)
    || !integer(result.data.total, 0, 100_000)
    || !integer(result.data.totalPages, 1, 10_000)
    || result.data.totalPages !== Math.max(1, Math.ceil(result.data.total / result.data.limit))
    || result.data.page > result.data.totalPages
    || !integer(result.data.returned, 0, 100)
    || result.data.returned !== itemLength
    || result.data.returned !== Math.min(
      result.data.limit as number,
      Math.max(
        0,
        (result.data.total as number)
          - (((result.data.page as number) - 1) * (result.data.limit as number))
      )
    )
    || result.data.returned > result.data.limit
    || typeof result.data.hasNextPage !== "boolean"
    || result.data.hasNextPage !== (result.data.page < result.data.totalPages)
  ) return invalid("pagination_invalid");
  return { ok: true, data: result.data as MinecraftPagination };
}

function catalogResponse<T>(
  value: unknown,
  itemParser: (candidate: unknown, index: number) => MinecraftValidationResult<T>
): MinecraftValidationResult<MinecraftCatalogResponse<T>> {
  const root = exactRecord(value, ["state", "items", "pagination", "metadata"], "response");
  if (!root.ok) return root;
  if (root.data.state === "data_unavailable") {
    return Object.keys(root.data).length === 1
      ? { ok: true, data: { state: "data_unavailable" } }
      : invalid("response_unavailable_unknown_field");
  }
  if (root.data.state !== "ready" || !Array.isArray(root.data.items) || root.data.items.length > 100) {
    return invalid("response_invalid");
  }
  const ids = new Set<string>();
  for (const [index, candidate] of root.data.items.entries()) {
    const parsed = itemParser(candidate, index);
    if (!parsed.ok) return parsed;
    const id = (parsed.data as { id: string }).id;
    if (ids.has(id)) return invalid("response_duplicate_id");
    ids.add(id);
  }
  const page = pagination(root.data.pagination, root.data.items.length);
  if (!page.ok) return page;
  const meta = metadata(root.data.metadata);
  if (!meta.ok) return meta;
  return { ok: true, data: root.data as MinecraftCatalogResponse<T> };
}

export function validateMinecraftItemCatalogResponse(
  value: unknown
): MinecraftValidationResult<MinecraftCatalogResponse<MinecraftItem>> {
  return catalogResponse(value, item);
}

export function validateMinecraftRecipeCatalogResponse(
  value: unknown
): MinecraftValidationResult<MinecraftCatalogResponse<MinecraftRecipe>> {
  return catalogResponse(value, recipe);
}

export function validateMinecraftEnchantCatalogResponse(
  value: unknown
): MinecraftValidationResult<MinecraftCatalogResponse<MinecraftEnchant>> {
  return catalogResponse(value, enchant);
}

export function isMinecraftPatchOfficialUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    const officialHostname = hostname === "minecraft.net"
      || hostname.endsWith(".minecraft.net")
      || hostname === "mojang.com"
      || hostname.endsWith(".mojang.com");
    return parsed.protocol === "https:"
      && parsed.username === ""
      && parsed.password === ""
      && parsed.port === ""
      && officialHostname;
  } catch {
    return false;
  }
}

function patchLocalizedSummary(
  value: unknown,
  path: string
): MinecraftValidationResult<MinecraftPatchLocalizedSummary> {
  const result = exactRecord(value, ["ko", "ja"], path);
  if (!result.ok) return result;
  if (!boundedText(result.data.ko, 300) || !boundedText(result.data.ja, 300)) {
    return invalid(`${path}_invalid`);
  }
  return { ok: true, data: result.data as MinecraftPatchLocalizedSummary };
}

export function validateMinecraftPatchEntry(
  value: unknown,
  path = "entry"
): MinecraftValidationResult<MinecraftPatchEntry> {
  const result = exactRecord(value, [
    "id", "edition", "version", "type", "publishedAt", "officialUrl", "title", "highlights"
  ], path);
  if (!result.ok) return result;
  if (
    typeof result.data.id !== "string"
    || !MINECRAFT_PATCH_ID_PATTERN.test(result.data.id)
    || !MINECRAFT_PATCH_EDITIONS.includes(result.data.edition as MinecraftPatchEdition)
    || typeof result.data.version !== "string"
    || !MINECRAFT_PATCH_VERSION_PATTERN.test(result.data.version)
    || !MINECRAFT_PATCH_TYPES.includes(result.data.type as MinecraftPatchType)
    || !canonicalIsoDate(result.data.publishedAt)
    || !isMinecraftPatchOfficialUrl(result.data.officialUrl)
  ) return invalid(`${path}_invalid`);

  if (result.data.title !== undefined) {
    const title = patchLocalizedSummary(result.data.title, `${path}_title`);
    if (!title.ok) return title;
  }
  if (result.data.highlights !== undefined) {
    if (
      !Array.isArray(result.data.highlights)
      || result.data.highlights.length < 1
      || result.data.highlights.length > 8
    ) return invalid(`${path}_highlights_invalid`);
    for (const [index, candidate] of result.data.highlights.entries()) {
      const highlight = patchLocalizedSummary(candidate, `${path}_highlights_${index}`);
      if (!highlight.ok) return highlight;
    }
  }
  return { ok: true, data: result.data as MinecraftPatchEntry };
}

export function validateMinecraftPatchNotesResponse(
  value: unknown
): MinecraftValidationResult<MinecraftPatchNotesResponse> {
  const root = exactRecord(value, ["state", "entries", "pagination"], "response");
  if (!root.ok) return root;
  if (root.data.state === "data_unavailable") {
    return Object.keys(root.data).length === 1
      ? { ok: true, data: { state: "data_unavailable" } }
      : invalid("response_unavailable_unknown_field");
  }
  if (
    root.data.state !== "ready"
    || !Array.isArray(root.data.entries)
    || root.data.entries.length > 100
  ) return invalid("response_invalid");

  const ids = new Set<string>();
  let previousPublishedAt = Number.POSITIVE_INFINITY;
  for (const [index, candidate] of root.data.entries.entries()) {
    const entry = validateMinecraftPatchEntry(candidate, `entries_${index}`);
    if (!entry.ok) return entry;
    if (ids.has(entry.data.id)) return invalid("response_duplicate_id");
    ids.add(entry.data.id);
    const publishedAt = Date.parse(entry.data.publishedAt);
    if (publishedAt > previousPublishedAt) return invalid("response_sort_invalid");
    previousPublishedAt = publishedAt;
  }

  const page = exactRecord(
    root.data.pagination,
    ["page", "totalPages", "hasNextPage", "total"],
    "pagination"
  );
  if (!page.ok) return page;
  if (
    !integer(page.data.page, 1, 10_000)
    || !integer(page.data.totalPages, 1, 10_000)
    || !integer(page.data.total, 0, 100_000)
    || page.data.page > page.data.totalPages
    || typeof page.data.hasNextPage !== "boolean"
    || page.data.hasNextPage !== (page.data.page < page.data.totalPages)
    || root.data.entries.length > page.data.total
    || (page.data.total === 0 && (
      root.data.entries.length !== 0
      || page.data.page !== 1
      || page.data.totalPages !== 1
    ))
    || (page.data.total > 0 && root.data.entries.length === 0)
    || page.data.totalPages < Math.max(1, Math.ceil((page.data.total as number) / 100))
  ) return invalid("pagination_invalid");

  return { ok: true, data: root.data as MinecraftPatchNotesResponse };
}
