import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import minecraftData from "minecraft-data";
import {
  MINECRAFT_CATALOG_GAME_VERSION,
  MINECRAFT_CATALOG_SOURCE_REVISION,
  MINECRAFT_CATALOG_SOURCE_URL,
  MINECRAFT_DATA_PACKAGE_VERSION,
  validateMinecraftCatalogArtifact,
  type MinecraftCatalogArtifact,
  type MinecraftCatalogRecipe,
  type MinecraftCatalogRecipeIngredient
} from "../data/minecraft-catalog-artifact.js";
import type {
  MinecraftEnchant,
  MinecraftItem,
  MinecraftLocalizedName
} from "@streamops/shared";

type TranslationEntry = {
  id: string;
  ko?: string;
  ja?: string;
  source: "official_game";
  verifiedAt: string;
};

type TranslationOverlay = {
  schemaVersion: 1;
  gameVersion: string;
  items: TranslationEntry[];
  enchants: TranslationEntry[];
};

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const DEFAULT_OUTPUT_PATH = path.resolve(
  PROJECT_ROOT,
  `apps/server/data/minecraft/catalog-${MINECRAFT_CATALOG_GAME_VERSION}.json`
);
const DEFAULT_TRANSLATION_PATH = path.resolve(
  PROJECT_ROOT,
  "apps/server/src/data/minecraft-translations.json"
);
const ID_PATTERN = /^[a-z0-9][a-z0-9_]{0,127}$/u;
const require = createRequire(import.meta.url);

function optionalArgument(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value ? path.resolve(value) : fallback;
}

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`${name.slice(2).replaceAll("-", "_")}_required`);
  return value;
}

function canonicalTimestamp(name: string): string {
  const value = requiredArgument(name);
  const timestamp = Date.parse(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    || !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString() !== value
  ) throw new Error(`${name.slice(2).replaceAll("-", "_")}_invalid`);
  return value;
}

function record(value: unknown, pathName: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${pathName}_object_required`);
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !keys.includes(key))) throw new Error(`${pathName}_unknown_field`);
  return candidate;
}

function safeId(value: unknown, pathName: string): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) throw new Error(`${pathName}_invalid`);
  return value;
}

function safeInteger(value: unknown, pathName: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error(`${pathName}_invalid`);
  }
  return value as number;
}

function safeLocalizedText(value: unknown, pathName: string): string {
  if (
    typeof value !== "string"
    || value.trim().length < 1
    || value.length > 160
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) throw new Error(`${pathName}_invalid`);
  return value.trim();
}

function fallbackEnglishName(id: string): string {
  return id.split("_").map((word) => word ? `${word[0]?.toUpperCase()}${word.slice(1)}` : "").join(" ");
}

function parseTranslationEntries(
  value: unknown,
  pathName: string,
  validIds: ReadonlySet<string>
): Map<string, TranslationEntry> {
  if (!Array.isArray(value) || value.length > validIds.size) throw new Error(`${pathName}_invalid`);
  const entries = new Map<string, TranslationEntry>();
  for (const [index, candidate] of value.entries()) {
    const currentPath = `${pathName}_${index}`;
    const item = record(candidate, currentPath, ["id", "ko", "ja", "source", "verifiedAt"]);
    const id = safeId(item.id, `${currentPath}_id`);
    if (!validIds.has(id) || entries.has(id)) throw new Error(`${currentPath}_id_unknown_or_duplicate`);
    if (item.ko === undefined && item.ja === undefined) throw new Error(`${currentPath}_locale_required`);
    const verifiedAt = safeLocalizedText(item.verifiedAt, `${currentPath}_verified_at`);
    const verifiedAtTimestamp = Date.parse(verifiedAt);
    if (
      !Number.isFinite(verifiedAtTimestamp)
      || new Date(verifiedAtTimestamp).toISOString() !== verifiedAt
    ) throw new Error(`${currentPath}_verified_at_invalid`);
    if (item.source !== "official_game") throw new Error(`${currentPath}_source_invalid`);
    entries.set(id, {
      id,
      ...(item.ko === undefined ? {} : { ko: safeLocalizedText(item.ko, `${currentPath}_ko`) }),
      ...(item.ja === undefined ? {} : { ja: safeLocalizedText(item.ja, `${currentPath}_ja`) }),
      source: "official_game",
      verifiedAt
    });
  }
  return entries;
}

function localizedName(id: string, translation: TranslationEntry | undefined): MinecraftLocalizedName {
  const en = fallbackEnglishName(id);
  return {
    en,
    ko: translation?.ko ?? en,
    ja: translation?.ja ?? en,
    status: {
      ko: translation?.ko === undefined ? "source_language_fallback" : "source_provided",
      ja: translation?.ja === undefined ? "source_language_fallback" : "source_provided"
    }
  };
}

function sourceRevision(dataRoot: string): string {
  const hash = crypto.createHash("sha256");
  for (const fileName of ["items.json", "recipes.json", "enchantments.json"]) {
    hash.update(fileName).update("\0").update(fs.readFileSync(path.resolve(dataRoot, fileName))).update("\0");
  }
  return hash.digest("hex");
}

function recipeItemId(value: unknown, pathName: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number") throw new Error(`${pathName}_unsupported_representation`);
  return safeInteger(value, pathName, 0, 1_000_000);
}

function resultIngredient(
  value: unknown,
  pathName: string,
  itemsByNumericId: ReadonlyMap<number, MinecraftItem>
): MinecraftCatalogRecipeIngredient {
  let numericId: number;
  let count = 1;
  if (typeof value === "number") {
    numericId = safeInteger(value, `${pathName}_id`, 0, 1_000_000);
  } else {
    const result = record(value, pathName, ["id", "count"]);
    numericId = safeInteger(result.id, `${pathName}_id`, 0, 1_000_000);
    count = safeInteger(result.count ?? 1, `${pathName}_count`, 0, 99);
  }
  const item = itemsByNumericId.get(numericId);
  if (!item) throw new Error(`${pathName}_item_missing`);
  return { itemId: item.id, count };
}

function buildRecipe(
  source: Record<string, unknown>,
  sourcePath: string,
  itemsByNumericId: ReadonlyMap<number, MinecraftItem>
): MinecraftCatalogRecipe | undefined {
  const shaped = source.inShape !== undefined;
  const shapeless = source.ingredients !== undefined;
  if (shaped === shapeless) throw new Error(`${sourcePath}_shape_invalid`);
  const result = resultIngredient(source.result, `${sourcePath}_result`, itemsByNumericId);
  /* minecraft-data 1.21.11의 단 하나뿐인 special recipe sentinel은 공개 조합법이 아닙니다. */
  if (result.itemId === "air" && result.count === 0) return undefined;
  if (result.count < 1) throw new Error(`${sourcePath}_result_count_invalid`);

  let shape: Array<Array<string | null>> | undefined;
  const inputIds: string[] = [];
  if (shaped) {
    if (!Array.isArray(source.inShape) || source.inShape.length < 1 || source.inShape.length > 3) {
      throw new Error(`${sourcePath}_in_shape_invalid`);
    }
    const width = Array.isArray(source.inShape[0]) ? source.inShape[0].length : 0;
    if (width < 1 || width > 3) throw new Error(`${sourcePath}_in_shape_width_invalid`);
    shape = source.inShape.map((row, rowIndex) => {
      if (!Array.isArray(row) || row.length !== width) throw new Error(`${sourcePath}_row_${rowIndex}_invalid`);
      return row.map((cell, columnIndex) => {
        const numericId = recipeItemId(cell, `${sourcePath}_${rowIndex}_${columnIndex}`);
        if (numericId === null) return null;
        const item = itemsByNumericId.get(numericId);
        if (!item) throw new Error(`${sourcePath}_${rowIndex}_${columnIndex}_item_missing`);
        inputIds.push(item.id);
        return item.id;
      });
    });
  } else {
    if (!Array.isArray(source.ingredients) || source.ingredients.length < 1 || source.ingredients.length > 9) {
      throw new Error(`${sourcePath}_ingredients_invalid`);
    }
    for (const [index, ingredient] of source.ingredients.entries()) {
      const numericId = recipeItemId(ingredient, `${sourcePath}_ingredient_${index}`);
      if (numericId === null) throw new Error(`${sourcePath}_ingredient_${index}_empty`);
      const item = itemsByNumericId.get(numericId);
      if (!item) throw new Error(`${sourcePath}_ingredient_${index}_missing`);
      inputIds.push(item.id);
    }
  }
  const counts = new Map<string, number>();
  for (const id of inputIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const ingredients = [...counts]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([itemId, count]) => ({ itemId, count }));
  const identity = JSON.stringify({ type: "crafting", result, ingredients, ...(shape ? { shape } : {}) });
  const digest = crypto.createHash("sha256").update(identity).digest("hex").slice(0, 20);
  return {
    id: `crafting-${result.itemId}-${digest}`,
    type: "crafting",
    result,
    ingredients,
    ...(shape ? { shape } : {})
  };
}

function buildArtifact(generatedAt: string, translationPath: string): MinecraftCatalogArtifact {
  const packagePath = require.resolve("minecraft-data/package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8")) as { version?: unknown; license?: unknown };
  if (packageJson.version !== MINECRAFT_DATA_PACKAGE_VERSION || packageJson.license !== "MIT") {
    throw new Error("minecraft_data_package_mismatch");
  }
  const dataRoot = path.resolve(
    path.dirname(packagePath),
    "minecraft-data",
    "data",
    "pc",
    MINECRAFT_CATALOG_GAME_VERSION
  );
  const revision = sourceRevision(dataRoot);
  if (revision !== MINECRAFT_CATALOG_SOURCE_REVISION) throw new Error("minecraft_data_source_revision_mismatch");
  const source = minecraftData(MINECRAFT_CATALOG_GAME_VERSION);
  if (!source || source.version.minecraftVersion !== MINECRAFT_CATALOG_GAME_VERSION) {
    throw new Error("minecraft_data_game_version_mismatch");
  }

  const sourceItems = source.itemsArray;
  const sourceEnchants = source.enchantmentsArray;
  if (sourceItems.length < 1 || sourceEnchants.length < 1) throw new Error("minecraft_data_domain_missing");
  const itemIds = new Set(sourceItems.map((item) => safeId(item.name, `item_${item.id}_name`)));
  const enchantIds = new Set(sourceEnchants.map((enchant) => safeId(enchant.name, `enchant_${enchant.id}_name`)));
  const overlayRecord = record(
    JSON.parse(fs.readFileSync(translationPath, "utf8")) as unknown,
    "translations",
    ["schemaVersion", "gameVersion", "items", "enchants"]
  );
  if (overlayRecord.schemaVersion !== 1 || overlayRecord.gameVersion !== MINECRAFT_CATALOG_GAME_VERSION) {
    throw new Error("translations_version_mismatch");
  }
  const itemTranslations = parseTranslationEntries(overlayRecord.items, "translations_items", itemIds);
  const enchantTranslations = parseTranslationEntries(overlayRecord.enchants, "translations_enchants", enchantIds);

  const items: MinecraftItem[] = sourceItems.map((sourceItem) => {
    const id = safeId(sourceItem.name, `item_${sourceItem.id}_name`);
    const enchantCategoryIds = sourceItem.enchantCategories ?? [];
    if (
      !Array.isArray(enchantCategoryIds)
      || enchantCategoryIds.some((category) => typeof category !== "string" || !ID_PATTERN.test(category))
      || new Set(enchantCategoryIds).size !== enchantCategoryIds.length
    ) throw new Error(`item_${id}_enchant_categories_invalid`);
    return {
      id,
      numericId: safeInteger(sourceItem.id, `item_${id}_numeric_id`, 0, 1_000_000),
      name: localizedName(id, itemTranslations.get(id)),
      stackSize: safeInteger(sourceItem.stackSize, `item_${id}_stack_size`, 1, 99),
      ...(sourceItem.maxDurability === undefined
        ? {}
        : { maxDurability: safeInteger(sourceItem.maxDurability, `item_${id}_durability`, 1, 1_000_000) }),
      enchantCategoryIds: [...enchantCategoryIds].sort()
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  const itemsByNumericId = new Map(items.map((item) => [item.numericId, item]));

  let excludedRecipes = 0;
  const recipes: MinecraftCatalogRecipe[] = [];
  for (const [resultNumericId, sourceRecipes] of Object.entries(source.recipes)) {
    if (!Array.isArray(sourceRecipes)) throw new Error(`recipes_${resultNumericId}_invalid`);
    for (const [index, sourceRecipe] of sourceRecipes.entries()) {
      const candidate = buildRecipe(
        sourceRecipe as unknown as Record<string, unknown>,
        `recipes_${resultNumericId}_${index}`,
        itemsByNumericId
      );
      if (!candidate) excludedRecipes += 1;
      else recipes.push(candidate);
    }
  }
  recipes.sort((left, right) => left.result.itemId.localeCompare(right.result.itemId) || left.id.localeCompare(right.id));
  if (excludedRecipes !== 1 || new Set(recipes.map((recipe) => recipe.id)).size !== recipes.length) {
    throw new Error("recipes_exclusion_or_duplicate_mismatch");
  }

  const enchants: MinecraftEnchant[] = sourceEnchants.map((sourceEnchant) => {
    const id = safeId(sourceEnchant.name, `enchant_${sourceEnchant.id}_name`);
    const incompatibleIds = sourceEnchant.exclude.map((entry) => safeId(entry, `enchant_${id}_exclude`)).sort();
    if (incompatibleIds.some((entry) => !enchantIds.has(entry)) || new Set(incompatibleIds).size !== incompatibleIds.length) {
      throw new Error(`enchant_${id}_exclude_invalid`);
    }
    return {
      id,
      numericId: safeInteger(sourceEnchant.id, `enchant_${id}_numeric_id`, 0, 10_000),
      name: localizedName(id, enchantTranslations.get(id)),
      maxLevel: safeInteger(sourceEnchant.maxLevel, `enchant_${id}_max_level`, 1, 255),
      minCost: {
        a: safeInteger(sourceEnchant.minCost.a ?? 0, `enchant_${id}_min_a`, 0, 1_000),
        b: safeInteger(sourceEnchant.minCost.b ?? 0, `enchant_${id}_min_b`, 0, 1_000)
      },
      maxCost: {
        a: safeInteger(sourceEnchant.maxCost.a ?? 0, `enchant_${id}_max_a`, 0, 1_000),
        b: safeInteger(sourceEnchant.maxCost.b ?? 0, `enchant_${id}_max_b`, 0, 1_000)
      },
      treasureOnly: sourceEnchant.treasureOnly,
      curse: sourceEnchant.curse,
      categoryId: safeId(sourceEnchant.category, `enchant_${id}_category`),
      weight: safeInteger(sourceEnchant.weight, `enchant_${id}_weight`, 1, 1_000),
      tradeable: sourceEnchant.tradeable,
      discoverable: sourceEnchant.discoverable,
      incompatibleIds
    };
  }).sort((left, right) => left.id.localeCompare(right.id));

  return validateMinecraftCatalogArtifact({
    schemaVersion: 1,
    metadata: {
      schemaVersion: 1,
      gameVersion: MINECRAFT_CATALOG_GAME_VERSION,
      sourceName: "minecraft-data",
      sourceUrl: MINECRAFT_CATALOG_SOURCE_URL,
      sourcePackageVersion: MINECRAFT_DATA_PACKAGE_VERSION,
      sourceRevision: revision,
      generatedAt,
      license: "MIT",
      coverage: {
        items: items.length,
        recipes: recipes.length,
        enchants: enchants.length,
        excludedRecipes,
        localizedItemNamesKo: itemTranslations.size
          ? items.filter((item) => item.name.status.ko === "source_provided").length
          : 0,
        localizedItemNamesJa: itemTranslations.size
          ? items.filter((item) => item.name.status.ja === "source_provided").length
          : 0,
        localizedEnchantNamesKo: enchantTranslations.size
          ? enchants.filter((enchant) => enchant.name.status.ko === "source_provided").length
          : 0,
        localizedEnchantNamesJa: enchantTranslations.size
          ? enchants.filter((enchant) => enchant.name.status.ja === "source_provided").length
          : 0,
        recipeTypes: {
          crafting: "ready",
          smelting: "not_provided_by_source",
          brewing: "not_provided_by_source",
          smithing: "not_provided_by_source",
          stonecutting: "not_provided_by_source"
        }
      }
    },
    items,
    recipes,
    enchants
  });
}

const outputPath = optionalArgument("--output", DEFAULT_OUTPUT_PATH);
const translationPath = optionalArgument("--translations", DEFAULT_TRANSLATION_PATH);
const artifact = buildArtifact(canonicalTimestamp("--generated-at"), translationPath);
const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, serialized, { encoding: "utf8", mode: 0o644 });
console.log(JSON.stringify({
  output: outputPath,
  artifactSha256: crypto.createHash("sha256").update(serialized).digest("hex"),
  sourceRevision: artifact.metadata.sourceRevision,
  counts: artifact.metadata.coverage
}));
