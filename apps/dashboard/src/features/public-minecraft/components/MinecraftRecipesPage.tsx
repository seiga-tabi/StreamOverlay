import { useCallback, useState, type CSSProperties } from "react";
import type { MinecraftItemReference, MinecraftRecipe, MinecraftRecipeType } from "@streamops/shared";
import { MINECRAFT_RECIPE_TYPES } from "@streamops/shared";
import { getMinecraftRecipes } from "../api/minecraft";
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { useMinecraftCatalog } from "../hooks/useMinecraftCatalog";
import { minecraftTileHue, resolveMinecraftName } from "../utils/names";
import { MinecraftCatalogShell, MinecraftName } from "./MinecraftCatalogShell";

const TYPE_LABEL_KEYS = {
  crafting: "recipeTypeCrafting",
  smelting: "recipeTypeSmelting",
  brewing: "recipeTypeBrewing",
  smithing: "recipeTypeSmithing",
  stonecutting: "recipeTypeStonecutting",
} as const;

const CRAFT_GRID_SIZE = 3;

/* 텍스처 대신 쓰는 자체 스와치 — ID 해시 색 + 2글자 라벨(전체 명칭은 aria/title). */
function ItemSwatch({ locale, reference }: {
  locale: MinecraftLocale;
  reference: MinecraftItemReference;
}) {
  const name = resolveMinecraftName(reference.name, locale);
  return (
    <span
      aria-label={name.text}
      className="minecraft-item-swatch"
      role="img"
      style={{ "--minecraft-tile-hue": minecraftTileHue(reference.id) } as CSSProperties}
      title={name.text}
    >
      {name.text.slice(0, 2)}
    </span>
  );
}

function CraftSlot({ locale, reference }: {
  locale: MinecraftLocale;
  reference: MinecraftItemReference | null;
}) {
  return (
    <span className={`minecraft-craft-cell${reference ? "" : " is-empty"}`}>
      {reference ? <ItemSwatch locale={locale} reference={reference} /> : null}
    </span>
  );
}

/* 제작대와 같은 3×3 로 정규화 — 작은 shape(예: 2×1)도 빈 슬롯으로 채워 보여줍니다. */
function normalizedShape(
  shape: NonNullable<MinecraftRecipe["shape"]>,
): ReadonlyArray<ReadonlyArray<MinecraftItemReference | null>> {
  return Array.from({ length: CRAFT_GRID_SIZE }, (_, rowIndex) =>
    Array.from({ length: CRAFT_GRID_SIZE }, (_, columnIndex) => shape[rowIndex]?.[columnIndex] ?? null));
}

function RecipeCard({ locale, recipe }: { locale: MinecraftLocale; recipe: MinecraftRecipe }) {
  const text = minecraftI18n[locale];
  const result = resolveMinecraftName(recipe.result.item.name, locale);
  return (
    <article className="minecraft-recipe-card" data-testid="minecraft-recipe-card">
      <h2 className="minecraft-recipe-card__title">
        <MinecraftName fallback={result.fallback} locale={locale} text={result.text} />
        {recipe.result.count > 1 ? <span className="minecraft-recipe-card__count">×{recipe.result.count}</span> : null}
      </h2>
      <div className="minecraft-craft">
        {recipe.shape ? (
          <span aria-label={text.recipeGridLabel} className="minecraft-craft-grid" role="img">
            {normalizedShape(recipe.shape).map((row, rowIndex) => (
              <span className="minecraft-craft-grid__row" key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <CraftSlot key={cellIndex} locale={locale} reference={cell} />
                ))}
              </span>
            ))}
          </span>
        ) : (
          <span className="minecraft-craft-shapeless">
            <span className="minecraft-craft-shapeless__tiles">
              {recipe.ingredients.map((entry) => (
                <CraftSlot key={entry.item.id} locale={locale} reference={entry.item} />
              ))}
            </span>
            <span className="minecraft-recipe-card__shapeless">{text.recipeShapeless}</span>
          </span>
        )}
        <span aria-hidden="true" className="minecraft-craft-arrow">→</span>
        <span className="minecraft-craft-out" title={`${text.recipeResult}: ${result.text} ×${recipe.result.count}`}>
          <ItemSwatch locale={locale} reference={recipe.result.item} />
          {recipe.result.count > 1 ? (
            <span aria-hidden="true" className="minecraft-craft-out__count">×{recipe.result.count}</span>
          ) : null}
        </span>
      </div>
      <dl className="minecraft-recipe-card__facts">
        <dt>{text.recipeIngredients}</dt>
        <dd>
          {recipe.ingredients.map((entry, index) => {
            const name = resolveMinecraftName(entry.item.name, locale);
            return (
              <span key={entry.item.id}>
                {index > 0 ? " · " : ""}
                {name.text}
                {entry.count > 1 ? ` ×${entry.count}` : ""}
              </span>
            );
          })}
        </dd>
      </dl>
    </article>
  );
}

export function MinecraftRecipesPage({ locale }: { locale: MinecraftLocale }) {
  const text = minecraftI18n[locale];
  const [search, setSearch] = useState("");
  const [type, setType] = useState<MinecraftRecipeType | "all">("all");
  const fetcher = useCallback(
    (page: number, signal: AbortSignal) =>
      getMinecraftRecipes({ q: search, page, type }, signal),
    [search, type],
  );
  const catalog = useMinecraftCatalog(fetcher, `recipes:${type}:${search}`);
  const availability = catalog.metadata?.coverage.recipeTypes;

  return (
    <MinecraftCatalogShell
      filters={(
        <div aria-label={text.recipeTypeFilterLabel} className="minecraft-type-chips" role="group">
          <button
            aria-pressed={type === "all"}
            className={type === "all" ? "active" : ""}
            onClick={() => setType("all")}
            type="button"
          >
            {text.recipeTypeAll}
          </button>
          {MINECRAFT_RECIPE_TYPES.map((candidate) => {
            const provided = availability ? availability[candidate] === "ready" : candidate === "crafting";
            return (
              <button
                aria-pressed={type === candidate}
                className={type === candidate ? "active" : ""}
                disabled={!provided}
                key={candidate}
                onClick={() => setType(candidate)}
                title={provided ? undefined : text.recipeTypeNotProvided}
                type="button"
              >
                {text[TYPE_LABEL_KEYS[candidate]]}
                {!provided ? <small> · {text.recipeTypeNotProvided}</small> : null}
              </button>
            );
          })}
        </div>
      )}
      loadMore={() => { void catalog.loadMore(); }}
      loadMoreError={catalog.loadMoreError}
      loadMoreLoading={catalog.loadMoreLoading}
      locale={locale}
      metadata={catalog.metadata}
      onSearch={setSearch}
      pagination={catalog.pagination}
      retry={catalog.retry}
      search={search}
      status={catalog.status}
      title={text.recipes}
      titleId="minecraft-recipes-title"
    >
      <div className="minecraft-recipe-list">
        {catalog.entries.map((entry) => (
          <RecipeCard key={entry.id} locale={locale} recipe={entry} />
        ))}
      </div>
    </MinecraftCatalogShell>
  );
}
