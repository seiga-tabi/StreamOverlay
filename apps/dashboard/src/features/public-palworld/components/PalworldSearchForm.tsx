import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { PalworldItemSummary, PalworldPalSummary, PalworldSearchResult } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { PalworldApiError, searchPalworld } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { formatPalNumber } from "../utils/search";
import { categoryLabel } from "../utils/labels";
import { resolvePalworldName } from "../utils/localization";
import { PalworldMedia } from "./PalworldMedia";
import { PalworldElementBadge } from "./PalworldElementBadge";
import { PalworldTranslationBadge } from "./PalworldTranslationBadge";

type SearchSuggestion =
  | { type: "pal"; pal: PalworldPalSummary }
  | { type: "item"; item: PalworldItemSummary };

type SearchFailureKey =
  | "palDataUnavailable"
  | "searchHttpError"
  | "searchInvalidResponse"
  | "searchNetworkError"
  | "searchTimeout";

function searchFailureKey(error: unknown): SearchFailureKey {
  if (!(error instanceof PalworldApiError)) return "searchNetworkError";
  if (error.code === "PALWORLD_REQUEST_TIMEOUT") return "searchTimeout";
  if (error.code === "PALWORLD_RESPONSE_INVALID") return "searchInvalidResponse";
  if (error.code === "PALWORLD_NETWORK_ERROR") return "searchNetworkError";
  if (error.status === 503) return "palDataUnavailable";
  return "searchHttpError";
}

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
  const [requestError, setRequestError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [revision, setRevision] = useState(0);
  const listId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const requestIdRef = useRef(0);
  const text = palworldI18n[locale];
  const showPanel = focused && query.trim().length > 0 && (loading || result !== null || requestError !== null);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  useEffect(() => {
    const normalized = query.trim();
    const requestId = ++requestIdRef.current;
    setResult(null);
    setRequestError(null);
    setActiveIndex(-1);
    if (!normalized) {
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void searchPalworld(normalized, controller.signal)
        .then((nextResult) => {
          if (controller.signal.aborted || requestIdRef.current !== requestId) return;
          setResult(nextResult);
          setRequestError(null);
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (controller.signal.aborted || requestIdRef.current !== requestId) return;
          setResult(null);
          setRequestError(error);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, revision]);

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

  const suggestions: SearchSuggestion[] = [
    ...(result?.pals.slice(0, 4).map((pal) => ({ type: "pal" as const, pal })) ?? []),
    ...(result?.items.slice(0, 4).map((item) => ({ type: "item" as const, item })) ?? []),
  ];
  const activeOptionId = activeIndex >= 0 && activeIndex < suggestions.length
    ? `${listId}-option-${activeIndex}`
    : undefined;

  function selectSuggestion(suggestion: SearchSuggestion): void {
    setFocused(false);
    setActiveIndex(-1);
    if (suggestion.type === "pal") onPal(suggestion.pal);
    else onItem(suggestion.item);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      if (showPanel) event.preventDefault();
      setFocused(false);
      setActiveIndex(-1);
      return;
    }
    if (!suggestions.length || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) {
      if (event.key === "Enter" && activeIndex >= 0) {
        const selected = suggestions[activeIndex];
        if (selected) {
          event.preventDefault();
          selectSuggestion(selected);
        }
      }
      return;
    }
    event.preventDefault();
    setFocused(true);
    setActiveIndex((current) => {
      if (event.key === "ArrowDown") return current >= suggestions.length - 1 ? 0 : current + 1;
      return current <= 0 ? suggestions.length - 1 : current - 1;
    });
  }

  const failureKey = requestError === null ? undefined : searchFailureKey(requestError);

  return (
    <form className={`palworld-search-form is-${variant}`} onSubmit={submit} ref={formRef} role="search" data-testid={`${variant}-search`}>
      <div className="palworld-search-control">
        <span className="palworld-search-icon" aria-hidden="true">⌕</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleInputKeyDown}
          placeholder={text.searchPlaceholder}
          data-ko={palworldI18n.ko.searchPlaceholder}
          data-ja={palworldI18n.ja.searchPlaceholder}
          aria-label={text.searchPlaceholder}
          aria-autocomplete="list"
          aria-controls={showPanel ? listId : undefined}
          aria-expanded={showPanel}
          aria-activedescendant={activeOptionId}
        />
        {query ? (
          <button className="palworld-search-clear" type="button" aria-label={text.searchReset} onClick={() => {
            setQuery("");
            setResult(null);
            setRequestError(null);
            setActiveIndex(-1);
          }}>×</button>
        ) : null}
        <button className="palworld-search-submit" type="submit" disabled={!query.trim()} data-ko={palworldI18n.ko.searchAction} data-ja={palworldI18n.ja.searchAction}>
          {text.searchAction}
        </button>
      </div>
      {showPanel ? (
        <div className="palworld-autocomplete" id={listId} role="listbox" aria-label={text.autocomplete}>
          {loading ? <p role="status" data-ko={palworldI18n.ko.searching} data-ja={palworldI18n.ja.searching}>{text.searching}</p> : null}
          {!loading && suggestions.map((suggestion, index) => {
            if (suggestion.type === "pal") {
              const pal = suggestion.pal;
              const name = resolvePalworldName(pal, locale);
              return (
                <button
                  className={activeIndex === index ? "is-active" : undefined}
                  id={`${listId}-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  onClick={() => selectSuggestion(suggestion)}
                  onPointerMove={() => setActiveIndex(index)}
                  key={`pal-${pal.id}`}
                >
                  <span className="palworld-autocomplete-media"><PalworldMedia kind="pal" imageUrl={pal.imageUrl} alt={name.text} locale={locale} /></span>
                  <span><strong>{name.text}</strong><PalworldTranslationBadge locale={locale} status={name.status} /><small>{formatPalNumber(pal.number)} · Pal</small><span className="palworld-badge-row palworld-compact-element-row">{pal.elements.map((element) => <PalworldElementBadge element={element} locale={locale} key={element} />)}</span></span>
                </button>
              );
            }
            const item = suggestion.item;
            const name = resolvePalworldName(item, locale);
            return (
              <button
                className={activeIndex === index ? "is-active" : undefined}
                id={`${listId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                onClick={() => selectSuggestion(suggestion)}
                onPointerMove={() => setActiveIndex(index)}
                key={`item-${item.id}`}
              >
                <span className="palworld-autocomplete-media"><PalworldMedia kind="item" imageUrl={item.imageUrl} alt={name.text} locale={locale} /></span>
                <span><strong>{name.text}</strong><PalworldTranslationBadge locale={locale} status={name.status} /><small>{categoryLabel(item.category, locale)} · {text.items}</small></span>
              </button>
            );
          })}
          {!loading && failureKey ? (
            <div className="palworld-picker-error" role="alert">
              <p data-ko={palworldI18n.ko[failureKey]} data-ja={palworldI18n.ja[failureKey]}>
                {text[failureKey]}
              </p>
              <Button size="sm" variant="secondary" onClick={() => setRevision((value) => value + 1)}>{text.retry}</Button>
            </div>
          ) : null}
          {!loading && result && suggestions.length === 0 ? <p data-ko={palworldI18n.ko.noResults} data-ja={palworldI18n.ja.noResults}>{text.noResults}</p> : null}
        </div>
      ) : null}
    </form>
  );
}
