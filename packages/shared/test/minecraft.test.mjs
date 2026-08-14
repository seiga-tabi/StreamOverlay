import test from "node:test";
import assert from "node:assert/strict";
import {
  validateMinecraftEnchantCatalogResponse,
  validateMinecraftItemCatalogResponse,
  validateMinecraftRecipeCatalogResponse
} from "../dist/index.js";

const fallbackName = {
  en: "Diamond Sword",
  ko: "Diamond Sword",
  ja: "Diamond Sword",
  status: { ko: "source_language_fallback", ja: "source_language_fallback" }
};
const metadata = {
  schemaVersion: 1,
  gameVersion: "1.21.11",
  sourceName: "minecraft-data",
  sourceUrl: "https://github.com/PrismarineJS/minecraft-data",
  sourcePackageVersion: "3.111.0",
  sourceRevision: "a".repeat(64),
  generatedAt: "2026-08-13T17:59:51.000Z",
  license: "MIT",
  coverage: {
    items: 1,
    recipes: 1,
    enchants: 1,
    excludedRecipes: 0,
    localizedItemNamesKo: 0,
    localizedItemNamesJa: 0,
    localizedEnchantNamesKo: 0,
    localizedEnchantNamesJa: 0,
    recipeTypes: {
      crafting: "ready",
      smelting: "not_provided_by_source",
      brewing: "not_provided_by_source",
      smithing: "not_provided_by_source",
      stonecutting: "not_provided_by_source"
    }
  }
};

function response(items) {
  return {
    state: "ready",
    items,
    pagination: {
      page: 1,
      limit: 50,
      total: items.length,
      totalPages: 1,
      returned: items.length,
      hasNextPage: false
    },
    metadata
  };
}

test("Minecraft item 응답은 고정 source metadata와 번역 fallback 상태를 검증한다", () => {
  const valid = response([{
    id: "diamond_sword",
    numericId: 900,
    name: fallbackName,
    stackSize: 1,
    maxDurability: 1_561,
    enchantCategoryIds: ["breakable", "weapon"]
  }]);
  assert.equal(validateMinecraftItemCatalogResponse(valid).ok, true);
  assert.equal(validateMinecraftItemCatalogResponse({
    ...valid,
    items: [{ ...valid.items[0], imageUrl: "https://evil.example/texture.png" }]
  }).ok, false);
  assert.equal(validateMinecraftItemCatalogResponse({
    ...valid,
    items: [{
      ...valid.items[0],
      name: { ...fallbackName, ko: "다이아몬드 검" }
    }]
  }).ok, false, "fallback 상태에서 현지어 문자열을 위장할 수 없습니다.");
});

test("Minecraft recipe 응답은 type과 3x3 shape·참조 구조를 exact 검증한다", () => {
  const item = { id: "diamond_sword", name: fallbackName };
  const valid = response([{
    id: "crafting-diamond_sword-abcdef0123456789",
    type: "crafting",
    result: { item, count: 1 },
    ingredients: [{ item, count: 2 }],
    shape: [[item], [item]]
  }]);
  assert.equal(validateMinecraftRecipeCatalogResponse(valid).ok, true);
  assert.equal(validateMinecraftRecipeCatalogResponse({
    ...valid,
    items: [{ ...valid.items[0], type: "unknown" }]
  }).ok, false);
  assert.equal(validateMinecraftRecipeCatalogResponse({
    ...valid,
    items: [{ ...valid.items[0], shape: [[item, item, item, item]] }]
  }).ok, false);
});

test("Minecraft enchant 응답은 비용·배타 ID·boolean 필드를 검증한다", () => {
  const valid = response([{
    id: "sharpness",
    numericId: 30,
    name: fallbackName,
    maxLevel: 5,
    minCost: { a: 1, b: 1 },
    maxCost: { a: 1, b: 1 },
    treasureOnly: false,
    curse: false,
    categoryId: "weapon",
    weight: 10,
    tradeable: true,
    discoverable: true,
    incompatibleIds: ["smite"]
  }]);
  assert.equal(validateMinecraftEnchantCatalogResponse(valid).ok, true);
  assert.equal(validateMinecraftEnchantCatalogResponse({
    ...valid,
    items: [{ ...valid.items[0], incompatibleIds: ["smite", "smite"] }]
  }).ok, false);
  assert.deepEqual(validateMinecraftEnchantCatalogResponse({ state: "data_unavailable" }), {
    ok: true,
    data: { state: "data_unavailable" }
  });
});

test("Minecraft 응답 validator는 잘못된 날짜·coverage·pagination을 예외 없이 거부한다", () => {
  const valid = response([{
    id: "diamond_sword",
    numericId: 900,
    name: fallbackName,
    stackSize: 1,
    maxDurability: 1_561,
    enchantCategoryIds: ["breakable", "weapon"]
  }]);
  for (const mutate of [
    (candidate) => { candidate.metadata.generatedAt = "9999-99-99T99:99:99.999Z"; },
    (candidate) => { candidate.metadata.coverage.localizedItemNamesKo = 2; },
    (candidate) => { candidate.pagination.total = 2; }
  ]) {
    const candidate = structuredClone(valid);
    mutate(candidate);
    assert.doesNotThrow(() => validateMinecraftItemCatalogResponse(candidate));
    assert.equal(validateMinecraftItemCatalogResponse(candidate).ok, false);
  }
});
