import { useEffect, useState, type FormEvent } from "react";
import {
  PALWORLD_ACQUISITION_TYPES,
  PALWORLD_ITEM_CATEGORIES,
  PALWORLD_SEARCH_MAX_LENGTH,
  type PalworldItemSummary,
  type PalworldPaginatedResponse
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Input, Select } from "../../../shared/ui/Form";
import { getPalworldItems } from "../api/palworld";
import { usePalworldInfiniteList } from "../hooks/usePalworldInfiniteList";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { acquisitionLabel, categoryLabel } from "../utils/labels";
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

const FILTER_KEYS = ["q", "category", "rarity", "acquisition", "sort", "order", "page"] as const;

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
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setPalworldUrl(`/palworld/items${next.toString() ? `?${next}` : ""}`);
  }
  function submit(event: FormEvent) { event.preventDefault(); update("q", nameQuery.trim()); }
  const hasReviewPending = response?.items.some((item) => (
    hasMachineAssistedTranslation([
      resolvePalworldName(item, locale).status,
      resolvePalworldDescription(item, locale).status,
    ])
  )) ?? false;

  return <section className="palworld-page-section">
    <header className="palworld-page-heading"><div><span aria-hidden="true">{text.itemsKicker}</span><h1 data-ko={palworldI18n.ko.items} data-ja={palworldI18n.ja.items}>{text.items}</h1><p data-ko={palworldI18n.ko.itemsDescription} data-ja={palworldI18n.ja.itemsDescription}>{text.itemsDescription}</p></div></header>
    {hasReviewPending ? <PalworldTranslationReviewNotice locale={locale} /> : null}
    <form className="palworld-filter-bar" onSubmit={submit} aria-label={text.filter}>
      <label><span>{text.nameSearch}</span><Input maxLength={PALWORLD_SEARCH_MAX_LENGTH} type="search" value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} /></label>
      <label><span>{text.category}</span><Select value={params.get("category") ?? ""} onChange={(event) => update("category", event.target.value)}><option value="">{text.all}</option>{PALWORLD_ITEM_CATEGORIES.map((value) => <option value={value} key={value}>{categoryLabel(value, locale)}</option>)}</Select></label>
      <label><span>{text.rarity}</span><Select aria-label={text.rarity} value={params.get("rarity") ?? ""} onChange={(event) => update("rarity", event.target.value)}><option value="">{text.all}</option>{Array.from({ length: 21 }, (_, index) => index).map((value) => <option value={value} key={value}>★ {value}</option>)}</Select></label>
      <label><span>{text.acquisition}</span><Select value={params.get("acquisition") ?? ""} onChange={(event) => update("acquisition", event.target.value)}><option value="">{text.all}</option>{PALWORLD_ACQUISITION_TYPES.map((value) => <option value={value} key={value}>{acquisitionLabel(value, locale)}</option>)}</Select></label>
      <label><span>{text.sort}</span><Select value={params.get("sort") ?? "name"} onChange={(event) => update("sort", event.target.value)}><option value="name">{text.name}</option><option value="rarity">{text.rarity}</option><option value="price">{text.price}</option><option value="technologyLevel">{text.technologyLevel}</option></Select></label>
      <label><span>{text.sortOrder}</span><Select aria-label={text.sortOrder} value={params.get("order") ?? "asc"} onChange={(event) => update("order", event.target.value)}><option value="asc">{text.ascending}</option><option value="desc">{text.descending}</option></Select></label>
      <div className="palworld-filter-actions"><Button size="sm" type="submit">{text.searchAction}</Button><Button size="sm" type="button" variant="ghost" onClick={() => setPalworldUrl("/palworld/items")}>{text.clearFilters}</Button></div>
    </form>
    {loading && !error ? <PalworldLoading locale={locale} /> : null}
    {error ? <PalworldError error={error} locale={locale} onRetry={retryInitial} /> : null}
    {response?.items.length === 0 ? <PalworldEmpty locale={locale} title={text.itemListEmpty} /> : null}
    {response?.items.length ? <><div className="palworld-result-count">{text.results}: {response.pagination.total.toLocaleString()}</div><PalworldPreviousLoadControl error={loadPreviousError} hasPrevious={hasPreviousPage} loading={loadPreviousLoading} locale={locale} onLoadPrevious={() => { void loadPrevious(); }} onRetry={() => { void retryLoadPrevious(); }} paused={Boolean(params.get("item"))} retryBlocked={loadPreviousRetryBlocked} /><div aria-busy={loadMoreLoading || loadPreviousLoading} className="palworld-entity-grid">{response.items.map((item, index) => <ItemCard key={item.id} item={item} locale={locale} priority={index < 4} onOpen={(selected) => onOpenItem(selected.id)} />)}</div><PalworldAutoLoadControl error={loadMoreError} hasMore={response.pagination.hasNextPage} loadedCount={response.items.length} loading={loadMoreLoading} locale={locale} onLoadMore={() => { void loadMore(); }} onRetry={() => { void retryLoadMore(); }} paused={Boolean(params.get("item"))} retryBlocked={loadMoreRetryBlocked} total={response.pagination.total} /></> : null}
  </section>;
}
