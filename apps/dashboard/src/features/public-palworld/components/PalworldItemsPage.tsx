import { useEffect, useState, type FormEvent } from "react";
import { PALWORLD_ACQUISITION_TYPES, PALWORLD_ITEM_CATEGORIES, type PalworldItemSummary, type PalworldPaginatedResponse } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Input, Select } from "../../../shared/ui/Form";
import { getPalworldItems } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { acquisitionLabel, categoryLabel } from "../utils/labels";
import { setPalworldUrl } from "../utils/routes";
import { ItemCard } from "./PalworldCards";
import { PalworldDomainCoverageNotice, usePalworldDomainCoverage } from "./PalworldCoverageNotice";
import { Pagination } from "./Pagination";
import { PalworldEmpty, PalworldError, PalworldLoading } from "./PalworldStates";

const FILTER_KEYS = ["q", "category", "rarity", "acquisition", "sort", "page"] as const;

export function PalworldItemsPage({ locale, onOpenItem, params }: { locale: PalworldLocale; onOpenItem: (id: string) => void; params: URLSearchParams }) {
  const [response, setResponse] = useState<PalworldPaginatedResponse<PalworldItemSummary> | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [nameQuery, setNameQuery] = useState(params.get("q") ?? "");
  const coverage = usePalworldDomainCoverage("items");
  const text = palworldI18n[locale];
  const routeQuery = FILTER_KEYS.map((key) => `${key}=${params.get(key) ?? ""}`).join("&");

  useEffect(() => setNameQuery(params.get("q") ?? ""), [routeQuery]);
  useEffect(() => {
    const controller = new AbortController();
    const apiParams = new URLSearchParams();
    FILTER_KEYS.forEach((key) => { const value = params.get(key); if (value) apiParams.set(key, value); });
    apiParams.set("limit", "24");
    setResponse(null);
    setError(false);
    void getPalworldItems(apiParams, controller.signal).then(setResponse).catch((requestError) => {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(true);
    });
    return () => controller.abort();
  }, [routeQuery, revision]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("item");
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setPalworldUrl(`/palworld/items${next.toString() ? `?${next}` : ""}`);
  }
  function submit(event: FormEvent) { event.preventDefault(); update("q", nameQuery.trim()); }

  return <section className="palworld-page-section">
    <header className="palworld-page-heading"><div><span aria-hidden="true">ITEMS</span><h1 data-ko={palworldI18n.ko.items} data-ja={palworldI18n.ja.items}>{text.items}</h1><p data-ko={palworldI18n.ko.itemsDescription} data-ja={palworldI18n.ja.itemsDescription}>{text.itemsDescription}</p></div></header>
    <PalworldDomainCoverageNotice coverage={coverage} domain="items" locale={locale} />
    <form className="palworld-filter-bar" onSubmit={submit} aria-label={text.filter}>
      <label><span>{text.nameSearch}</span><Input type="search" value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} /></label>
      <label><span>{text.category}</span><Select value={params.get("category") ?? ""} onChange={(event) => update("category", event.target.value)}><option value="">{text.all}</option>{PALWORLD_ITEM_CATEGORIES.map((value) => <option value={value} key={value}>{categoryLabel(value, locale)}</option>)}</Select></label>
      <label><span>{text.rarity}</span><Select value={params.get("rarity") ?? ""} onChange={(event) => update("rarity", event.target.value)}><option value="">{text.all}</option>{Array.from({ length: 20 }, (_, index) => index + 1).map((value) => <option value={value} key={value}>★ {value}</option>)}</Select></label>
      <label><span>{text.acquisition}</span><Select value={params.get("acquisition") ?? ""} onChange={(event) => update("acquisition", event.target.value)}><option value="">{text.all}</option>{PALWORLD_ACQUISITION_TYPES.map((value) => <option value={value} key={value}>{acquisitionLabel(value, locale)}</option>)}</Select></label>
      <label><span>{text.sort}</span><Select value={params.get("sort") ?? "name"} onChange={(event) => update("sort", event.target.value)}><option value="name">{text.name}</option><option value="rarity">{text.rarity}</option><option value="price">{text.price}</option><option value="technologyLevel">{text.technologyLevel}</option></Select></label>
      <div className="palworld-filter-actions"><Button size="sm" type="submit">{text.searchAction}</Button><Button size="sm" type="button" variant="ghost" onClick={() => setPalworldUrl("/palworld/items")}>{text.clearFilters}</Button></div>
    </form>
    {!response && !error ? <PalworldLoading locale={locale} /> : null}
    {error ? <PalworldError locale={locale} onRetry={() => setRevision((value) => value + 1)} /> : null}
    {response?.items.length === 0 ? <PalworldEmpty locale={locale} title={text.itemListEmpty} /> : null}
    {response?.items.length ? <><div className="palworld-result-count">{text.results}: {response.pagination.total.toLocaleString()}</div><div className="palworld-entity-grid">{response.items.map((item) => <ItemCard key={item.id} item={item} locale={locale} onOpen={(selected) => onOpenItem(selected.id)} />)}</div><Pagination locale={locale} pagination={response.pagination} onPage={(page) => update("page", String(page))} /></> : null}
  </section>;
}
