import {
  MINECRAFT_RECIPE_TYPES,
  validateMinecraftEnchantCatalogResponse,
  validateMinecraftItemCatalogResponse,
  type MinecraftCatalogMetadata,
  type MinecraftEnchant,
  type MinecraftItem,
  type MinecraftRecipeType
} from "@streamops/shared";

export const MINECRAFT_CATALOG_GAME_VERSION = "1.21.11";
export const MINECRAFT_DATA_PACKAGE_VERSION = "3.111.0";
export const MINECRAFT_CATALOG_SOURCE_REVISION =
  "8e22b8d97d807f47ab5450f03ab45bd5e3a0d45607e09d784d47200f43a05382";
export const MINECRAFT_CATALOG_SOURCE_URL =
  "https://github.com/PrismarineJS/minecraft-data" as const;

export type MinecraftCatalogRecipeIngredient = {
  itemId: string;
  count: number;
};

export type MinecraftCatalogRecipe = {
  id: string;
  type: MinecraftRecipeType;
  result: MinecraftCatalogRecipeIngredient;
  ingredients: MinecraftCatalogRecipeIngredient[];
  shape?: Array<Array<string | null>>;
};

export type MinecraftCatalogArtifact = {
  schemaVersion: 1;
  metadata: MinecraftCatalogMetadata;
  items: MinecraftItem[];
  recipes: MinecraftCatalogRecipe[];
  enchants: MinecraftEnchant[];
};

export class MinecraftCatalogArtifactError extends Error {
  readonly code = "MINECRAFT_CATALOG_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "MinecraftCatalogArtifactError";
  }
}

const ID_PATTERN = /^[a-z0-9][a-z0-9_]{0,127}$/u;
const RECIPE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,159}$/u;

function fail(pathName: string, message: string): never {
  throw new MinecraftCatalogArtifactError(`${pathName}: ${message}`);
}

function exactRecord(value: unknown, pathName: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(pathName, "객체여야 합니다.");
  const record = value as Record<string, unknown>;
  const allowed = new Set(keys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${pathName}.${key}`, "허용되지 않은 필드입니다.");
  }
  return record;
}

function integer(value: unknown, pathName: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    fail(pathName, `${minimum}~${maximum} 정수여야 합니다.`);
  }
  return value as number;
}

function validatePublicCatalogChunks(
  artifact: MinecraftCatalogArtifact,
  kind: "items" | "enchants"
): void {
  const values = artifact[kind];
  const validate = kind === "items"
    ? validateMinecraftItemCatalogResponse
    : validateMinecraftEnchantCatalogResponse;
  for (let offset = 0; offset < values.length; offset += 100) {
    const pageItems = values.slice(offset, offset + 100);
    const limit = 100;
    const totalPages = Math.max(1, Math.ceil(values.length / limit));
    const result = validate({
      state: "ready",
      items: pageItems,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: values.length,
        totalPages,
        returned: pageItems.length,
        hasNextPage: Math.floor(offset / limit) + 1 < totalPages
      },
      metadata: artifact.metadata
    });
    if (!result.ok) fail(kind, result.error);
  }
}

function validateIngredient(
  value: unknown,
  pathName: string,
  itemIds: ReadonlySet<string>
): MinecraftCatalogRecipeIngredient {
  const record = exactRecord(value, pathName, ["itemId", "count"]);
  if (typeof record.itemId !== "string" || !ID_PATTERN.test(record.itemId) || !itemIds.has(record.itemId)) {
    fail(`${pathName}.itemId`, "카탈로그에 존재하는 item ID여야 합니다.");
  }
  integer(record.count, `${pathName}.count`, 1, 99);
  return record as MinecraftCatalogRecipeIngredient;
}

function validateRecipe(
  value: unknown,
  index: number,
  itemIds: ReadonlySet<string>
): MinecraftCatalogRecipe {
  const pathName = `recipes[${index}]`;
  const record = exactRecord(value, pathName, ["id", "type", "result", "ingredients", "shape"]);
  if (typeof record.id !== "string" || !RECIPE_ID_PATTERN.test(record.id)) {
    fail(`${pathName}.id`, "형식이 올바르지 않습니다.");
  }
  if (!MINECRAFT_RECIPE_TYPES.includes(record.type as MinecraftRecipeType)) {
    fail(`${pathName}.type`, "허용된 레시피 type이어야 합니다.");
  }
  validateIngredient(record.result, `${pathName}.result`, itemIds);
  if (!Array.isArray(record.ingredients) || record.ingredients.length < 1 || record.ingredients.length > 16) {
    fail(`${pathName}.ingredients`, "1~16개 배열이어야 합니다.");
  }
  const ingredientIds = new Set<string>();
  for (const [ingredientIndex, ingredient] of record.ingredients.entries()) {
    const parsed = validateIngredient(ingredient, `${pathName}.ingredients[${ingredientIndex}]`, itemIds);
    if (ingredientIds.has(parsed.itemId)) fail(`${pathName}.ingredients`, "중복 item ID가 있습니다.");
    ingredientIds.add(parsed.itemId);
  }
  if (record.shape !== undefined) {
    if (!Array.isArray(record.shape) || record.shape.length < 1 || record.shape.length > 3) {
      fail(`${pathName}.shape`, "1~3행 배열이어야 합니다.");
    }
    const width = Array.isArray(record.shape[0]) ? record.shape[0].length : 0;
    if (width < 1 || width > 3) fail(`${pathName}.shape`, "열은 1~3개여야 합니다.");
    for (const [rowIndex, row] of record.shape.entries()) {
      if (!Array.isArray(row) || row.length !== width) fail(`${pathName}.shape[${rowIndex}]`, "열 수가 같아야 합니다.");
      for (const [columnIndex, cell] of row.entries()) {
        if (cell !== null && (typeof cell !== "string" || !itemIds.has(cell))) {
          fail(`${pathName}.shape[${rowIndex}][${columnIndex}]`, "item ID 또는 null이어야 합니다.");
        }
      }
    }
  }
  return record as MinecraftCatalogRecipe;
}

export function validateMinecraftCatalogArtifact(value: unknown): MinecraftCatalogArtifact {
  const root = exactRecord(value, "artifact", ["schemaVersion", "metadata", "items", "recipes", "enchants"]);
  if (root.schemaVersion !== 1) fail("artifact.schemaVersion", "1이어야 합니다.");
  if (!Array.isArray(root.items) || root.items.length < 1 || root.items.length > 10_000) {
    fail("artifact.items", "1~10,000개 배열이어야 합니다.");
  }
  if (!Array.isArray(root.recipes) || root.recipes.length < 1 || root.recipes.length > 20_000) {
    fail("artifact.recipes", "1~20,000개 배열이어야 합니다.");
  }
  if (!Array.isArray(root.enchants) || root.enchants.length < 1 || root.enchants.length > 1_000) {
    fail("artifact.enchants", "1~1,000개 배열이어야 합니다.");
  }
  const artifact = root as MinecraftCatalogArtifact;
  validatePublicCatalogChunks(artifact, "items");
  validatePublicCatalogChunks(artifact, "enchants");
  const metadata = artifact.metadata;
  if (
    metadata.gameVersion !== MINECRAFT_CATALOG_GAME_VERSION
    || metadata.sourcePackageVersion !== MINECRAFT_DATA_PACKAGE_VERSION
    || metadata.sourceRevision !== MINECRAFT_CATALOG_SOURCE_REVISION
    || metadata.sourceUrl !== MINECRAFT_CATALOG_SOURCE_URL
    || metadata.coverage.items !== artifact.items.length
    || metadata.coverage.recipes !== artifact.recipes.length
    || metadata.coverage.enchants !== artifact.enchants.length
    || metadata.coverage.recipeTypes.crafting !== "ready"
    || MINECRAFT_RECIPE_TYPES.slice(1).some(
      (type) => metadata.coverage.recipeTypes[type] !== "not_provided_by_source"
    )
  ) fail("artifact.metadata", "고정 source 또는 coverage와 일치하지 않습니다.");

  const itemIds = new Set<string>();
  const itemNumericIds = new Set<number>();
  let localizedItemNamesKo = 0;
  let localizedItemNamesJa = 0;
  for (const item of artifact.items) {
    if (itemIds.has(item.id) || itemNumericIds.has(item.numericId)) fail("artifact.items", "중복 ID가 있습니다.");
    itemIds.add(item.id);
    itemNumericIds.add(item.numericId);
    if (item.name.status.ko === "source_provided") localizedItemNamesKo += 1;
    if (item.name.status.ja === "source_provided") localizedItemNamesJa += 1;
  }
  const recipeIds = new Set<string>();
  for (const [index, candidate] of artifact.recipes.entries()) {
    const recipe = validateRecipe(candidate, index, itemIds);
    if (recipeIds.has(recipe.id)) fail("artifact.recipes", "중복 ID가 있습니다.");
    recipeIds.add(recipe.id);
  }
  const enchantIds = new Set(artifact.enchants.map((enchant) => enchant.id));
  if (enchantIds.size !== artifact.enchants.length) fail("artifact.enchants", "중복 ID가 있습니다.");
  let localizedEnchantNamesKo = 0;
  let localizedEnchantNamesJa = 0;
  for (const enchant of artifact.enchants) {
    if (enchant.incompatibleIds.some((id) => !enchantIds.has(id))) {
      fail(`artifact.enchants.${enchant.id}.incompatibleIds`, "존재하지 않는 enchant ID가 있습니다.");
    }
    if (enchant.name.status.ko === "source_provided") localizedEnchantNamesKo += 1;
    if (enchant.name.status.ja === "source_provided") localizedEnchantNamesJa += 1;
  }
  if (
    metadata.coverage.localizedItemNamesKo !== localizedItemNamesKo
    || metadata.coverage.localizedItemNamesJa !== localizedItemNamesJa
    || metadata.coverage.localizedEnchantNamesKo !== localizedEnchantNamesKo
    || metadata.coverage.localizedEnchantNamesJa !== localizedEnchantNamesJa
  ) fail("artifact.metadata.coverage", "번역 coverage와 실제 항목이 일치하지 않습니다.");
  return artifact;
}
