import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { PalworldPalReference, PalworldPalSummary } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { PalworldApiError, searchPalworld } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { resolvePalworldName } from "../utils/localization";
import { formatPalNumber } from "../utils/search";
import { PalworldElementBadge } from "./PalworldElementBadge";
import { PalworldMedia } from "./PalworldMedia";
import { PalworldTranslationBadge } from "./PalworldTranslationBadge";

type PickerPal = PalworldPalReference | PalworldPalSummary;
type PickerRequestState = "idle" | "loading" | "success" | "empty" | "error" | "data_unavailable";

export function PalworldPalPicker({
  label,
  locale,
  onChange,
  selected,
  testId,
}: {
  label: string;
  locale: PalworldLocale;
  onChange: (pal: PalworldPalSummary | null) => void;
  selected: PickerPal | null;
  testId: string;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PalworldPalSummary[]>([]);
  const [requestState, setRequestState] = useState<PickerRequestState>("idle");
  const [revision, setRevision] = useState(0);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const pickerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const listId = useId();
  const text = palworldI18n[locale];

  useEffect(() => {
    if (!query.trim() || selected) {
      setSuggestions([]);
      setRequestState("idle");
      setActiveIndex(-1);
      return undefined;
    }
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    setSuggestions([]);
    setRequestState("loading");
    setActiveIndex(-1);
    const timer = window.setTimeout(() => {
      void searchPalworld(query, controller.signal)
        .then((result) => {
          if (controller.signal.aborted || requestIdRef.current !== requestId) return;
          const nextSuggestions = result.pals.slice(0, 8);
          setSuggestions(nextSuggestions);
          setRequestState(nextSuggestions.length ? "success" : "empty");
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (controller.signal.aborted || requestIdRef.current !== requestId) return;
          setSuggestions([]);
          setRequestState(error instanceof PalworldApiError && error.status === 503 ? "data_unavailable" : "error");
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, revision, selected]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setFocused(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function selectPal(pal: PalworldPalSummary): void {
    onChange(pal);
    setQuery("");
    setFocused(false);
    setActiveIndex(-1);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      if (focused && query.trim()) event.preventDefault();
      setFocused(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      const selectedPal = suggestions[activeIndex];
      if (selectedPal) {
        event.preventDefault();
        selectPal(selectedPal);
      }
      return;
    }
    if (!suggestions.length || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    setFocused(true);
    setActiveIndex((current) => {
      if (event.key === "ArrowDown") return current >= suggestions.length - 1 ? 0 : current + 1;
      return current <= 0 ? suggestions.length - 1 : current - 1;
    });
  }

  if (selected) {
    const name = resolvePalworldName(selected, locale);
    const displayName = name.text;
    return <div className="palworld-picker" ref={pickerRef} data-testid={testId}>
      <span className="palworld-picker-label">{label}</span>
      <div className="palworld-selected-pal">
        <span className="palworld-selected-media"><PalworldMedia kind="pal" imageUrl={selected.imageUrl} alt={displayName} locale={locale} /></span>
        <span><strong>{displayName}</strong><PalworldTranslationBadge locale={locale} status={name.status} /><small>{formatPalNumber(selected.number)}</small><span className="palworld-badge-row palworld-compact-element-row">{selected.elements.map((element) => <PalworldElementBadge element={element} locale={locale} key={element} />)}</span></span>
        <Button size="sm" variant="ghost" aria-label={`${displayName} ${text.reset}`} onClick={() => { onChange(null); setQuery(""); }}>×</Button>
      </div>
    </div>;
  }

  return <div className="palworld-picker" ref={pickerRef} data-testid={testId}>
    <label className="palworld-picker-label" htmlFor={`${listId}-input`}>{label}</label>
    <input
      id={`${listId}-input`}
      type="search"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      onFocus={() => setFocused(true)}
      onKeyDown={handleInputKeyDown}
      placeholder={text.searchPlaceholder}
      aria-autocomplete="list"
      aria-expanded={focused && Boolean(query.trim())}
      aria-controls={focused && query.trim() ? listId : undefined}
      aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
    />
    {focused && query.trim() ? <div className="palworld-picker-list" id={listId} role="listbox" aria-label={text.autocomplete}>
      {requestState === "loading" ? <p role="status" aria-live="polite">{text.searching}</p> : null}
      {requestState === "success" && suggestions.map((pal, index) => {
        const name = resolvePalworldName(pal, locale);
        return <button
          className={activeIndex === index ? "is-active" : undefined}
          id={`${listId}-option-${index}`}
          type="button"
          role="option"
          aria-selected={activeIndex === index}
          onClick={() => selectPal(pal)}
          onPointerMove={() => setActiveIndex(index)}
          key={pal.id}
        >
          <span className="palworld-picker-option-media"><PalworldMedia kind="pal" imageUrl={pal.imageUrl} alt={name.text} locale={locale} /></span>
          <span><strong>{name.text}</strong><PalworldTranslationBadge locale={locale} status={name.status} /><small>{formatPalNumber(pal.number)}</small><span className="palworld-badge-row palworld-compact-element-row">{pal.elements.map((element) => <PalworldElementBadge element={element} locale={locale} key={element} />)}</span></span>
        </button>;
      })}
      {requestState === "empty" ? <p>{text.noResults}</p> : null}
      {requestState === "error" || requestState === "data_unavailable" ? (
        <div className="palworld-picker-error" role="alert">
          <p
            data-ko={requestState === "data_unavailable" ? palworldI18n.ko.palDataUnavailable : palworldI18n.ko.searchError}
            data-ja={requestState === "data_unavailable" ? palworldI18n.ja.palDataUnavailable : palworldI18n.ja.searchError}
          >
            {requestState === "data_unavailable" ? text.palDataUnavailable : text.searchError}
          </p>
          <Button size="sm" variant="secondary" onClick={() => setRevision((value) => value + 1)}>{text.retry}</Button>
        </div>
      ) : null}
    </div> : null}
  </div>;
}
