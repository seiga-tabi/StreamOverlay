import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { PalworldItemSummary, PalworldPalSummary, PalworldSearchResult } from "@streamops/shared";
import { searchPalworld } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { formatPalNumber, itemName, palName } from "../utils/search";
import { categoryLabel } from "../utils/labels";
import { PalworldMedia } from "./PalworldMedia";

export function PalworldSearchForm({
  initialQuery = "",
  locale,
  onItem,
  onPal,
  onSearch,
  variant = "header",
}: {
  initialQuery?: string;
  locale: PalworldLocale;
  onItem: (item: PalworldItemSummary) => void;
  onPal: (pal: PalworldPalSummary) => void;
  onSearch: (query: string) => void;
  variant?: "header" | "hero";
}) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<PalworldSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const listId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const text = palworldI18n[locale];
  const showPanel = focused && query.trim().length > 0 && (loading || result !== null);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) {
      setResult(null);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void searchPalworld(normalized, controller.signal)
        .then(setResult)
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setResult(null);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!formRef.current?.contains(event.target as Node)) setFocused(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) return;
    setFocused(false);
    onSearch(normalized);
  }

  const suggestions = [
    ...(result?.pals.slice(0, 4).map((pal) => ({ type: "pal" as const, pal })) ?? []),
    ...(result?.items.slice(0, 4).map((item) => ({ type: "item" as const, item })) ?? []),
  ];

  return (
    <form className={`palworld-search-form is-${variant}`} onSubmit={submit} ref={formRef} role="search" data-testid={`${variant}-search`}>
      <div className="palworld-search-control">
        <span className="palworld-search-icon" aria-hidden="true">⌕</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={text.searchPlaceholder}
          data-ko={palworldI18n.ko.searchPlaceholder}
          data-ja={palworldI18n.ja.searchPlaceholder}
          aria-label={text.searchPlaceholder}
          aria-autocomplete="list"
          aria-controls={showPanel ? listId : undefined}
          aria-expanded={showPanel}
        />
        {query ? (
          <button className="palworld-search-clear" type="button" aria-label={text.searchReset} onClick={() => {
            setQuery("");
            setResult(null);
          }}>×</button>
        ) : null}
        <button className="palworld-search-submit" type="submit" disabled={!query.trim()} data-ko={palworldI18n.ko.searchAction} data-ja={palworldI18n.ja.searchAction}>
          {text.searchAction}
        </button>
      </div>
      {showPanel ? (
        <div className="palworld-autocomplete" id={listId} role="listbox" aria-label={text.autocomplete}>
          {loading ? <p role="status" data-ko={palworldI18n.ko.searching} data-ja={palworldI18n.ja.searching}>{text.searching}</p> : null}
          {!loading && suggestions.map((suggestion) => {
            if (suggestion.type === "pal") {
              const pal = suggestion.pal;
              return (
                <button type="button" role="option" aria-selected="false" onClick={() => {
                  setFocused(false);
                  onPal(pal);
                }} key={`pal-${pal.id}`}>
                  <span className="palworld-autocomplete-media"><PalworldMedia kind="pal" imageUrl={pal.imageUrl} alt={palName(pal, locale)} locale={locale} /></span>
                  <span><strong>{palName(pal, locale)}</strong><small>{formatPalNumber(pal.number)} · Pal</small></span>
                </button>
              );
            }
            const item = suggestion.item;
            return (
              <button type="button" role="option" aria-selected="false" onClick={() => {
                setFocused(false);
                onItem(item);
              }} key={`item-${item.id}`}>
                <span className="palworld-autocomplete-media"><PalworldMedia kind="item" imageUrl={item.imageUrl} alt={itemName(item, locale)} locale={locale} /></span>
                <span><strong>{itemName(item, locale)}</strong><small>{categoryLabel(item.category, locale)} · {text.items}</small></span>
              </button>
            );
          })}
          {!loading && result && suggestions.length === 0 ? <p data-ko={palworldI18n.ko.noResults} data-ja={palworldI18n.ja.noResults}>{text.noResults}</p> : null}
        </div>
      ) : null}
    </form>
  );
}
