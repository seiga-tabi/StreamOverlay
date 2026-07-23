import { useEffect, useState } from "react";
import type { PalworldSearchResult } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { searchPalworld } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { setPalworldUrl } from "../utils/routes";
import { ItemCard, PalCard } from "./PalworldCards";
import { PalworldEmpty, PalworldError, PalworldLoading } from "./PalworldStates";

export function PalworldSearchResults({
  locale,
  onOpenItem,
  onOpenPal,
  query,
}: {
  locale: PalworldLocale;
  onOpenItem: (id: string) => void;
  onOpenPal: (id: string) => void;
  query: string;
}) {
  const [result, setResult] = useState<PalworldSearchResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const text = palworldI18n[locale];

  useEffect(() => {
    const normalized = query.trim();
    setResult(null);
    setError(null);
    if (!normalized) return undefined;
    const controller = new AbortController();
    void searchPalworld(normalized, controller.signal).then(setResult).catch((requestError) => {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(requestError);
    });
    return () => controller.abort();
  }, [query, revision]);

  return <section className="palworld-page-section">
    <header className="palworld-page-heading"><div><span>{text.searchQuery}</span><h1>{query || text.searchResults}</h1>{result ? <p>{text.results}: <strong>{result.total.toLocaleString()}</strong></p> : null}</div><Button variant="secondary" onClick={() => setPalworldUrl("/palworld/search")}>{text.searchReset}</Button></header>
    {!query ? <PalworldEmpty locale={locale} title={text.searchPlaceholder} /> : null}
    {query && !result && !error ? <PalworldLoading locale={locale} /> : null}
    {error ? <PalworldError error={error} locale={locale} onRetry={() => setRevision((value) => value + 1)} /> : null}
    {result?.total === 0 ? <PalworldEmpty locale={locale} title={text.noResults} /> : null}
    {result?.pals.length ? <section><div className="palworld-section-title"><h2>{text.pals}</h2><span>{result.pals.length}</span></div><div className="palworld-entity-grid">{result.pals.map((pal) => <PalCard key={pal.id} pal={pal} locale={locale} onOpen={(selected) => onOpenPal(selected.id)} />)}</div></section> : null}
    {result?.items.length ? <section className="palworld-search-domain-section"><div className="palworld-section-title"><h2>{text.items}</h2><span>{result.items.length}</span></div><div className="palworld-entity-grid">{result.items.map((item) => <ItemCard key={item.id} item={item} locale={locale} onOpen={(selected) => onOpenItem(selected.id)} />)}</div></section> : null}
  </section>;
}
