import { useEffect, useState, type FormEvent } from "react";
import { PALWORLD_ELEMENTS, PALWORLD_WORK_SUITABILITY_TYPES, type PalworldPaginatedResponse, type PalworldPalSummary } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Input, Select } from "../../../shared/ui/Form";
import { getPalworldPals } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { elementLabel, workLabel } from "../utils/labels";
import { setPalworldUrl } from "../utils/routes";
import { Pagination } from "./Pagination";
import { PalCard } from "./PalworldCards";
import { PalworldEmpty, PalworldError, PalworldLoading } from "./PalworldStates";

const FILTER_KEYS = ["q", "element", "work", "rarity", "variant", "sort", "page"] as const;

export function PalworldPalsPage({ locale, onOpenPal, params }: { locale: PalworldLocale; onOpenPal: (id: string) => void; params: URLSearchParams }) {
  const [response, setResponse] = useState<PalworldPaginatedResponse<PalworldPalSummary> | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [nameQuery, setNameQuery] = useState(params.get("q") ?? "");
  const text = palworldI18n[locale];
  const routeQuery = FILTER_KEYS.map((key) => `${key}=${params.get(key) ?? ""}`).join("&");

  useEffect(() => setNameQuery(params.get("q") ?? ""), [routeQuery]);
  useEffect(() => {
    const controller = new AbortController();
    const apiParams = new URLSearchParams();
    FILTER_KEYS.forEach((key) => {
      const value = params.get(key);
      if (value) apiParams.set(key, value);
    });
    apiParams.set("limit", "24");
    setResponse(null);
    setError(false);
    void getPalworldPals(apiParams, controller.signal).then(setResponse).catch((requestError) => {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(true);
    });
    return () => controller.abort();
  }, [routeQuery, revision]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("pal");
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setPalworldUrl(`/palworld/pals${next.toString() ? `?${next}` : ""}`);
  }
  function submit(event: FormEvent) { event.preventDefault(); update("q", nameQuery.trim()); }

  return <section className="palworld-page-section">
    <header className="palworld-page-heading"><div><span aria-hidden="true">PALDEX</span><h1 data-ko={palworldI18n.ko.pals} data-ja={palworldI18n.ja.pals}>{text.pals}</h1><p data-ko={palworldI18n.ko.palsDescription} data-ja={palworldI18n.ja.palsDescription}>{text.palsDescription}</p></div></header>
    <form className="palworld-filter-bar" onSubmit={submit} aria-label={text.filter}>
      <label><span>{text.nameSearch}</span><Input type="search" value={nameQuery} onChange={(event) => setNameQuery(event.target.value)} /></label>
      <label><span>{text.element}</span><Select value={params.get("element") ?? ""} onChange={(event) => update("element", event.target.value)}><option value="">{text.all}</option>{PALWORLD_ELEMENTS.map((value) => <option value={value} key={value}>{elementLabel(value, locale)}</option>)}</Select></label>
      <label><span>{text.work}</span><Select value={params.get("work") ?? ""} onChange={(event) => update("work", event.target.value)}><option value="">{text.all}</option>{PALWORLD_WORK_SUITABILITY_TYPES.map((value) => <option value={value} key={value}>{workLabel(value, locale)}</option>)}</Select></label>
      <label><span>{text.rarity}</span><Select value={params.get("rarity") ?? ""} onChange={(event) => update("rarity", event.target.value)}><option value="">{text.all}</option>{Array.from({ length: 20 }, (_, index) => index + 1).map((value) => <option value={value} key={value}>★ {value}</option>)}</Select></label>
      <label><span>{text.variant}</span><Select value={params.get("variant") ?? ""} onChange={(event) => update("variant", event.target.value)}><option value="">{text.all}</option><option value="normal">{text.normal}</option><option value="variant">{text.variantPal}</option><option value="special">{text.special}</option></Select></label>
      <label><span>{text.sort}</span><Select value={params.get("sort") ?? "number"} onChange={(event) => update("sort", event.target.value)}><option value="number">{text.number}</option><option value="name">{text.name}</option><option value="rarity">{text.rarity}</option></Select></label>
      <div className="palworld-filter-actions"><Button size="sm" type="submit">{text.searchAction}</Button><Button size="sm" type="button" variant="ghost" onClick={() => setPalworldUrl("/palworld/pals")}>{text.clearFilters}</Button></div>
    </form>
    {!response && !error ? <PalworldLoading locale={locale} /> : null}
    {error ? <PalworldError locale={locale} onRetry={() => setRevision((value) => value + 1)} /> : null}
    {response?.items.length === 0 ? <PalworldEmpty locale={locale} title={text.palListEmpty} /> : null}
    {response?.items.length ? <><div className="palworld-result-count">{text.results}: {response.pagination.total.toLocaleString()}</div><div className="palworld-entity-grid">{response.items.map((pal, index) => <PalCard key={pal.id} pal={pal} locale={locale} priority={index < 4} onOpen={(selected) => onOpenPal(selected.id)} />)}</div><Pagination locale={locale} pagination={response.pagination} onPage={(page) => update("page", String(page))} /></> : null}
  </section>;
}
