import { useMemo, useCallback, useState } from "react";
import type { MinecraftItemReference, MinecraftRecipe, MinecraftRecipeType } from "@streamops/shared";
import { MINECRAFT_RECIPE_TYPES } from "@streamops/shared";
import { getMinecraftRecipes } from "../api/minecraft";
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { useMinecraftCatalog } from "../hooks/useMinecraftCatalog";
import { useMinecraftRoute } from "../hooks/useMinecraftRoute";
import { minecraftSearchQueryFromUrl, setMinecraftSearchUrl } from "../utils/routes";
import { resolveMinecraftName } from "../utils/names";
import { formatMinecraftTemplate, MinecraftCatalogShell, MinecraftName } from "./MinecraftCatalogShell";
import { MinecraftItemImage } from "./MinecraftItemImage";

const TYPE_LABEL_KEYS = {
  crafting: "recipeTypeCrafting",
  smelting: "recipeTypeSmelting",
  brewing: "recipeTypeBrewing",
  smithing: "recipeTypeSmithing",
  stonecutting: "recipeTypeStonecutting",
} as const;

const CRAFT_GRID_SIZE = 3;

function ItemSwatch({ locale, reference }: {
  locale: MinecraftLocale;
  reference: MinecraftItemReference;
}) {
  const name = resolveMinecraftName(reference.name, locale);
  return <MinecraftItemImage fallbackText={name.text} id={reference.id} label={name.text} />;
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

/* 가로형 컴팩트 카드 — [그리드|자유 배치 타일] → 결과 슬롯 → 결과 정보 스택.
 * 산출 수량은 결과명 옆 한 곳(×N), 재료는 muted 1줄(그리드 2글자 약칭의 보완). */
function RecipeCard({ locale, recipe }: { locale: MinecraftLocale; recipe: MinecraftRecipe }) {
  const text = minecraftI18n[locale];
  const result = resolveMinecraftName(recipe.result.item.name, locale);
  const ingredientLine = recipe.ingredients
    .map((entry) => {
      const name = resolveMinecraftName(entry.item.name, locale);
      return entry.count > 1 ? `${name.text} ×${entry.count}` : name.text;
    })
    .join(" · ");
  return (
    <article className="minecraft-recipe-card" data-testid="minecraft-recipe-card">
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
        <span className="minecraft-craft-shapeless__tiles">
          {recipe.ingredients.map((entry) => (
            <CraftSlot key={entry.item.id} locale={locale} reference={entry.item} />
          ))}
        </span>
      )}
      <span aria-hidden="true" className="minecraft-craft-arrow">→</span>
      <span className="minecraft-craft-out" title={`${text.recipeResult}: ${result.text} ×${recipe.result.count}`}>
        <ItemSwatch locale={locale} reference={recipe.result.item} />
      </span>
      <div className="minecraft-recipe-card__body">
        <h2 className="minecraft-recipe-card__title">
          <MinecraftName fallback={result.fallback} locale={locale} text={result.text} />
        </h2>
        {recipe.result.count > 1 ? <span className="minecraft-recipe-card__count">×{recipe.result.count}</span> : null}
        {!recipe.shape ? <span className="minecraft-recipe-card__shapeless">{text.recipeShapeless}</span> : null}
        <span className="minecraft-recipe-card__ingredients" title={ingredientLine}>
          <span className="yoro-u-sr-only">{text.recipeIngredients}: </span>
          {ingredientLine}
        </span>
      </div>
    </article>
  );
}

/* 같은 결과 아이템의 재료 변형(Barrel — 목재별 8종 등)을 대표 1장 + 확장으로 접습니다.
 * 알파벳순 정렬에서 변형이 연속으로 도배되어 스캔 거리가 길어지던 문제의 수정점 —
 * 그룹 키는 결과 아이템 id, 대표는 첫 레시피(정렬 순서 보존)입니다. */
function groupedByResult<T extends { result: { item: { id: string } } }>(
  entries: readonly T[],
): Array<{ representative: T; variants: T[] }> {
  const byResult = new Map<string, { representative: T; variants: T[] }>();
  for (const entry of entries) {
    const bucket = byResult.get(entry.result.item.id);
    if (bucket) bucket.variants.push(entry);
    else byResult.set(entry.result.item.id, { representative: entry, variants: [] });
  }
  return [...byResult.values()];
}

export function MinecraftRecipesPage({ locale }: { locale: MinecraftLocale }) {
  const text = minecraftI18n[locale];
  /* 검색어의 단일 원본은 URL 의 ?q= — 공유·새로고침·뒤로가기·nav 재클릭이 전부 일관됩니다. */
  const { locationRevision } = useMinecraftRoute();
  const search = useMemo(() => minecraftSearchQueryFromUrl(), [locationRevision]);
  const submitSearch = useCallback((value: string) => setMinecraftSearchUrl("recipes", value), []);
  const [type, setType] = useState<MinecraftRecipeType | "all">("all");
  const fetcher = useCallback(
    (page: number, signal: AbortSignal) =>
      getMinecraftRecipes({ q: search, page, type }, signal),
    [search, type],
  );
  const catalog = useMinecraftCatalog(fetcher, `recipes:${type}:${search}`);
  const availability = catalog.metadata?.coverage.recipeTypes;
  /* 쓸 수 없는 유형을 크게 그리지 않습니다 — 제공 유형만 칩, 미제공은 캡션 한 줄. */
  const providedTypes = MINECRAFT_RECIPE_TYPES.filter((candidate) =>
    availability ? availability[candidate] === "ready" : candidate === "crafting");
  const missingTypes = MINECRAFT_RECIPE_TYPES.filter((candidate) => !providedTypes.includes(candidate));

  return (
    <MinecraftCatalogShell
      filters={(
        <div className="minecraft-type-row">
          <div aria-label={text.recipeTypeFilterLabel} className="minecraft-type-chips" role="group">
            <button
              aria-pressed={type === "all"}
              className={type === "all" ? "active" : ""}
              onClick={() => setType("all")}
              type="button"
            >
              {text.recipeTypeAll}
            </button>
            {providedTypes.map((candidate) => (
              <button
                aria-pressed={type === candidate}
                className={type === candidate ? "active" : ""}
                key={candidate}
                onClick={() => setType(candidate)}
                type="button"
              >
                {text[TYPE_LABEL_KEYS[candidate]]}
              </button>
            ))}
          </div>
          {missingTypes.length > 0 ? (
            <p className="minecraft-type-row__missing">
              {formatMinecraftTemplate(text.recipeTypeNotProvidedList, {
                types: missingTypes.map((candidate) => text[TYPE_LABEL_KEYS[candidate]]).join(" · "),
              })}
            </p>
          ) : null}
        </div>
      )}
      loadMore={() => { void catalog.loadMore(); }}
      loadMoreError={catalog.loadMoreError}
      loadMoreLoading={catalog.loadMoreLoading}
      locale={locale}
      metadata={catalog.metadata}
      onSearch={submitSearch}
      pagination={catalog.pagination}
      retry={catalog.retry}
      search={search}
      status={catalog.status}
      title={text.recipes}
      titleId="minecraft-recipes-title"
    >
      <div className="minecraft-recipe-list">
        {groupedByResult(catalog.entries).map(({ representative, variants }) => (
          variants.length === 0 ? (
            <RecipeCard key={representative.id} locale={locale} recipe={representative} />
          ) : (
            <div className="minecraft-recipe-group" key={representative.id}>
              <RecipeCard locale={locale} recipe={representative} />
              <details className="minecraft-recipe-group__variants">
                <summary>{formatMinecraftTemplate(text.recipeVariantToggle, { count: variants.length })}</summary>
                {variants.map((variant) => (
                  <RecipeCard key={variant.id} locale={locale} recipe={variant} />
                ))}
              </details>
            </div>
          )
        ))}
      </div>
    </MinecraftCatalogShell>
  );
}
