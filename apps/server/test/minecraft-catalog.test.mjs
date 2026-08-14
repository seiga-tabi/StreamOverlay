import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const {
  MinecraftCatalogQueryError,
  MinecraftCatalogService,
  MinecraftCatalogUnavailableError
} = await import("../dist/services/minecraft-catalog.js");

test("Minecraft 정적 카탈로그는 고정 source와 coverage를 fail-closed로 로드한다", () => {
  const service = MinecraftCatalogService.load();
  const metadata = service.metadata();
  assert.equal(metadata.gameVersion, "1.21.11");
  assert.equal(metadata.sourcePackageVersion, "3.111.0");
  assert.match(metadata.sourceRevision, /^[a-f0-9]{64}$/u);
  assert.equal(metadata.coverage.items, 1_505);
  assert.equal(metadata.coverage.recipes, 1_678);
  assert.equal(metadata.coverage.enchants, 43);
  assert.equal(metadata.coverage.excludedRecipes, 1);
  assert.equal(metadata.coverage.recipeTypes.crafting, "ready");
  assert.equal(metadata.coverage.recipeTypes.smelting, "not_provided_by_source");
});

test("Minecraft item·recipe·enchant 목록은 검색과 필터 이후 pagination을 적용한다", () => {
  const service = MinecraftCatalogService.load();
  const items = service.items(new URLSearchParams("q=diamond_sword&page=999&limit=1"));
  assert.equal(items.state, "ready");
  assert.equal(items.pagination.total, 1);
  assert.equal(items.pagination.page, 1);
  assert.equal(items.items[0]?.id, "diamond_sword");
  assert.equal(items.items[0]?.name.status.ko, "source_language_fallback");

  const recipes = service.recipes(new URLSearchParams("q=diamond_sword&type=crafting&limit=100"));
  assert.equal(recipes.state, "ready");
  assert.ok(recipes.pagination.total > 0);
  assert.equal(recipes.items.every((recipe) => recipe.type === "crafting"), true);
  assert.equal(recipes.items.some((recipe) => recipe.result.item.id === "diamond_sword"), true);
  const unavailableType = service.recipes(new URLSearchParams("type=smelting"));
  assert.equal(unavailableType.state, "ready");
  assert.equal(unavailableType.pagination.total, 0);
  assert.deepEqual(unavailableType.items, []);

  const enchants = service.enchants(new URLSearchParams("q=sharpness"));
  assert.equal(enchants.state, "ready");
  assert.equal(enchants.items[0]?.id, "sharpness");
});

test("Minecraft query는 unknown·중복·범위 밖 값을 거부한다", () => {
  const service = MinecraftCatalogService.load();
  for (const params of [
    "redirect=https%3A%2F%2Fevil.example",
    "q=stone&q=diamond",
    "page=0",
    "page=10001",
    "limit=101"
  ]) {
    assert.throws(() => service.items(new URLSearchParams(params)), MinecraftCatalogQueryError, params);
  }
  assert.throws(
    () => service.recipes(new URLSearchParams("type=unknown")),
    MinecraftCatalogQueryError
  );
  assert.throws(
    () => service.enchants(new URLSearchParams("type=crafting")),
    MinecraftCatalogQueryError
  );
});

test("Minecraft artifact 누락·내용 변조는 전체 카탈로그를 중단한다", () => {
  assert.throws(
    () => MinecraftCatalogService.load("/definitely-missing/minecraft-catalog.json"),
    MinecraftCatalogUnavailableError
  );
  const sourcePath = new URL("../data/minecraft/catalog-1.21.11.json", import.meta.url);
  const tampered = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  tampered.items[0].stackSize = tampered.items[0].stackSize === 1 ? 2 : 1;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "minecraft-catalog-test-"));
  const artifactPath = path.join(directory, "catalog.json");
  try {
    fs.writeFileSync(artifactPath, JSON.stringify(tampered));
    assert.throws(() => MinecraftCatalogService.load(artifactPath), MinecraftCatalogUnavailableError);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
