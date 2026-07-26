import { useEffect, useState, type FormEvent } from "react";
import {
  PALWORLD_ACQUISITION_TYPES,
  PALWORLD_ITEM_FILTER_CATEGORIES,
  PALWORLD_ITEM_RARITY_TIERS,
  PALWORLD_SEARCH_MAX_LENGTH,
  type PalworldItemFilterCategory,
  type PalworldItemRarityTier,
  type PalworldItemSummary,
  type PalworldPaginatedResponse
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Input, Select } from "../../../shared/ui/Form";
import { getPalworldItems } from "../api/palworld";
import { usePalworldInfiniteList } from "../hooks/usePalworldInfiniteList";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { acquisitionLabel, itemRarityTierLabel, itemTypeLabel } from "../utils/labels";
import {
  hasMachineAssistedTranslation,
  resolvePalworldDescription,
  resolvePalworldName,
} from "../utils/localization";
import { setPalworldUrl } from "../utils/routes";
import { ItemCard } from "./PalworldCards";
import { PalworldAutoLoadControl } from "./PalworldAutoLoadControl";
import { PalworldPreviousLoadControl } from "./PalworldPreviousLoadControl";
import { PalworldEmpty, PalworldError, PalworldLoading } from "./PalworldStates";
import { PalworldTranslationReviewNotice } from "./PalworldTranslationBadge";

const FILTER_KEYS = ["q", "category", "itemType", "rarity", "rarityTier", "acquisition", "sort", "order", "page"] as const;

function isItemType(value: string): value is PalworldItemFilterCategory {
  return PALWORLD_ITEM_FILTER_CATEGORIES.includes(value as PalworldItemFilterCategory);
}

function legacyRarityTier(value: string | null): PalworldItemRarityTier | "" {
  if (value === null || !/^(?:0|[1-9]|1\d|20)$/u.test(value)) return "";
  const rarity = Number(value);
  if (rarity === 0) return "common";
  if (rarity === 1) return "uncommon";
  if (rarity === 2) return "rare";
  if (rarity === 3) return "epic";
  if (rarity === 4) return "legendary";
  return "";
}

export function PalworldItemsPage({ locale, onOpenItem, params }: { locale: PalworldLocale; onOpenItem: (id: string) => void; params: URLSearchParams }) {
  const [nameQuery, setNameQuery] = useState(params.get("q") ?? "");
  const text = palworldI18n[locale];
  const routeQuery = FILTER_KEYS.map((key) => `${key}=${params.get(key) ?? ""}`).join("&");
  const {
    initialError: error,
    initialLoading: loading,
    hasPreviousPage,
    loadMore,
    loadMoreError,
    loadMoreLoading,
    loadMoreRetryBlocked,
    loadPrevious,
    loadPreviousError,
    loadPreviousLoading,
    loadPreviousRetryBlocked,
    response,
    retryInitial,
    retryLoadMore,
    retryLoadPrevious,
  } = usePalworldInfiniteList<PalworldItemSummary, PalworldPaginatedResponse<PalworldItemSummary>>({
    initialPage: params.get("page") ?? "1",
    itemKey: (item) => item.id,
    loadPage: (page, signal) => {
      const apiParams = new URLSearchParams();
      FILTER_KEYS.forEach((key) => {
        if (key === "page") return;
        if (key === "category" && params.has("itemType")) return;
        if (key === "rarity" && params.has("rarityTier")) return;
        const value = params.get(key);
        if (value) apiParams.set(key, value);
      });
      apiParams.set("page", String(page));
      apiParams.set("locale", locale);
      apiParams.set("limit", "24");
      return getPalworldItems(apiParams, signal);
    },
    paused: Boolean(params.get("pal") || params.get("item") || params.get("skill")),
    queryKey: `${locale}:${routeQuery}`,
  });

  useEffect(() => setNameQuery(params.get("q") ?? ""), [routeQuery]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("item");
    if (key === "itemType") next.delete("category");
    if (key === "rarityTier") next.delete("rarity");
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setPalworldUrl(`/palworld/items${next.toString() ? `?${next}` : ""}`);
  }
  function submit(event: FormEvent) { event.preventDefault(); update("q", nameQuery.trim()); }
  const legacyCategory = params.get("category") ?? "";
  const selectedItemType = params.get("itemType") ?? (isItemType(legacyCategory) ? legacyCategory : "");
  const selectedRarityTier = params.get("rarityTier") ?? legacyRarityTier(params.get("rarity"));
  const hasItemTypeFilter = params.has("itemType") || params.has("category");
  const hasRarityFilter = params.has("rarityTier") || params.has("rarity");
  const hasReviewPending = response?.items.some((item) => (
    hasMachineAssistedTranslation([
      resolvePalworldName(item, locale).status,
      resolvePalworldDescription(item, locale).status,
    ])
  )) ?? false;

  return <section className="palworld-page-section">
    <header className="palworld-page-heading"><div><span aria-hidden="true">{text.itemsKicker}</span><h1 data-ko={palworldI18n.ko.items} data-ja={palworldI18n.ja.items}>{text.items}</h1><p data-ko={palworldI18n.ko.itemsDescription} data-ja={palworldI18n.ja.itemsDescription}>{text.itemsDescription}</p></div></header>
    {hasReviewPending ? <PalworldTranslationReviewNotice locale={locale} /> : null}
    <form className="palworld-item-filter-panel" onSubmit={submit} aria-label={text.filter}>
      <div className="palworld-item-search-row">
        <label>
          <span>{text.nameSearch}</span>
          <Input maxLength={PALWORLD_SEARCH_MAX_LENGTH} type="search" value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} />
        </label>
        <Button size="sm" type="submit">{text.searchAction}</Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setPalworldUrl("/palworld/items")}>{text.clearFilters}</Button>
      </div>
      <fieldset className="palworld-item-filter-group">
        <legend>{text.category}</legend>
        <div className="palworld-item-filter-chip-list">
          <Button
            aria-label={text.allItemCategories}
            aria-pressed={!hasItemTypeFilter}
            className="palworld-item-filter-chip"
            data-ja={palworldI18n.ja.allItemCategories}
            data-ko={palworldI18n.ko.allItemCategories}
            onClick={() => update("itemType", "")}
            size="sm"
            type="button"
            variant={!hasItemTypeFilter ? "primary" : "tertiary"}
          >
            {text.all}
          </Button>
          {PALWORLD_ITEM_FILTER_CATEGORIES.map((value) => {
            const label = itemTypeLabel(value, locale);
            return (
              <Button
                aria-label={text.filterByItemCategory.replace("{value}", label)}
                aria-pressed={selectedItemType === value}
                className="palworld-item-filter-chip"
                key={value}
                onClick={() => update("itemType", value)}
                size="sm"
                type="button"
                variant={selectedItemType === value ? "primary" : "tertiary"}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="palworld-item-filter-group">
        <legend>{text.rarity}</legend>
        <div className="palworld-item-filter-chip-list">
          <Button
            aria-label={text.allItemRarities}
            aria-pressed={!hasRarityFilter}
            className="palworld-item-filter-chip"
            data-ja={palworldI18n.ja.allItemRarities}
            data-ko={palworldI18n.ko.allItemRarities}
            onClick={() => update("rarityTier", "")}
            size="sm"
            type="button"
            variant={!hasRarityFilter ? "primary" : "tertiary"}
          >
            {text.all}
          </Button>
          {PALWORLD_ITEM_RARITY_TIERS.map((value) => {
            const label = itemRarityTierLabel(value, locale);
            return (
              <Button
                aria-label={text.filterByItemRarity.replace("{value}", label)}
                aria-pressed={selectedRarityTier === value}
                className="palworld-item-filter-chip palworld-item-rarity-chip"
                data-rarity-band={value}
                key={value}
                onClick={() => update("rarityTier", value)}
                size="sm"
                type="button"
                variant={selectedRarityTier === value ? "primary" : "tertiary"}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </fieldset>
      <div className="palworld-item-filter-secondary">
        <label><span>{text.acquisition}</span><Select value={params.get("acquisition") ?? ""} onChange={(event) => update("acquisition", event.target.value)}><option value="">{text.all}</option>{PALWORLD_ACQUISITION_TYPES.map((value) => <option value={value} key={value}>{acquisitionLabel(value, locale)}</option>)}</Select></label>
        <label><span>{text.sort}</span><Select value={params.get("sort") ?? "name"} onChange={(event) => update("sort", event.target.value)}><option value="name">{text.name}</option><option value="rarity">{text.rarity}</option><option value="price">{text.price}</option><option value="technologyLevel">{text.technologyLevel}</option></Select></label>
        <label><span>{text.sortOrder}</span><Select aria-label={text.sortOrder} value={params.get("order") ?? "asc"} onChange={(event) => update("order", event.target.value)}><option value="asc">{text.ascending}</option><option value="desc">{text.descending}</option></Select></label>
      </div>
    </form>
    {loading && !error ? <PalworldLoading locale={locale} /> : null}
    {error ? <PalworldError error={error} locale={locale} onRetry={retryInitial} /> : null}
    {response?.items.length === 0 ? <PalworldEmpty locale={locale} title={text.itemListEmpty} /> : null}
    {response?.items.length ? <><div className="palworld-result-count">{text.results}: {response.pagination.total.toLocaleString()}</div><PalworldPreviousLoadControl error={loadPreviousError} hasPrevious={hasPreviousPage} loading={loadPreviousLoading} locale={locale} onLoadPrevious={() => { void loadPrevious(); }} onRetry={() => { void retryLoadPrevious(); }} paused={Boolean(params.get("item"))} retryBlocked={loadPreviousRetryBlocked} /><div aria-busy={loadMoreLoading || loadPreviousLoading} className="palworld-entity-grid">{response.items.map((item, index) => <ItemCard key={item.id} item={item} locale={locale} priority={index < 4} onOpen={(selected) => onOpenItem(selected.id)} />)}</div><PalworldAutoLoadControl error={loadMoreError} hasMore={response.pagination.hasNextPage} loadedCount={response.items.length} loading={loadMoreLoading} locale={locale} onLoadMore={() => { void loadMore(); }} onRetry={() => { void retryLoadMore(); }} paused={Boolean(params.get("item"))} retryBlocked={loadMoreRetryBlocked} total={response.pagination.total} /></> : null}
  </section>;
}
