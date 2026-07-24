import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  PALWORLD_SEARCH_MAX_LENGTH,
  type PalworldPalReference,
  type PalworldPalSummary
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { PalworldApiError, searchPalworld } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { resolvePalworldName } from "../utils/localization";
import { formatPalNumber } from "../utils/search";
import { PalworldElementBadge } from "./PalworldElementBadge";
import { PalworldMedia } from "./PalworldMedia";
import { PalworldTranslationBadge } from "./PalworldTranslationBadge";

type PickerPal = PalworldPalReference | PalworldPalSummary;
type PickerRequestState =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "error"
  | "data_unavailable"
  | "network_error"
  | "timeout"
  | "invalid_response";

function pickerErrorState(error: unknown): PickerRequestState {
  if (!(error instanceof PalworldApiError)) return "error";
  if (error.status === 503 || error.code === "PALWORLD_DATA_UNAVAILABLE") return "data_unavailable";
  if (error.code === "PALWORLD_NETWORK_ERROR") return "network_error";
  if (error.code === "PALWORLD_REQUEST_TIMEOUT") return "timeout";
  if (error.code === "PALWORLD_RESPONSE_INVALID") return "invalid_response";
  return "error";
}

export function PalworldPalPicker({
  label,
  locale,
  onChange,
  onOpenPal,
  selected,
  testId,
}: {
  label: string;
  locale: PalworldLocale;
  onChange: (pal: PalworldPalSummary | null) => void;
  onOpenPal?: (id: string) => void;
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
  const statusId = `${listId}-status`;
  const text = palworldI18n[locale];
  const normalizedQuery = query.trim();
  const queryTooLong = normalizedQuery.length > PALWORLD_SEARCH_MAX_LENGTH;

  useEffect(() => {
    if (!query.trim() || query.trim().length > PALWORLD_SEARCH_MAX_LENGTH || selected) {
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
          setRequestState(pickerErrorState(error));
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, revision, selected]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setFocused(false);
        setActiveIndex(-1);
      }
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
    const selectedContent = <>
      <span className="palworld-selected-media"><PalworldMedia kind="pal" imageUrl={selected.imageUrl} alt={displayName} locale={locale} /></span>
      <span><strong>{displayName}</strong><PalworldTranslationBadge locale={locale} status={name.status} /><small>{formatPalNumber(selected.number, locale)}</small><span className="palworld-badge-row palworld-compact-element-row">{selected.elements.map((element) => <PalworldElementBadge element={element} locale={locale} key={element} />)}</span></span>
    </>;
    return <div className="palworld-picker" ref={pickerRef} data-testid={testId}>
      <span className="palworld-picker-label">{label}</span>
      <div className="palworld-selected-pal">
        {onOpenPal ? <button className="palworld-selected-pal-button" type="button" aria-label={`${text.openParentPalDetails}: ${displayName}`} onClick={() => onOpenPal(selected.id)}>{selectedContent}</button> : selectedContent}
        <Button size="sm" variant="ghost" aria-label={`${displayName} ${text.removePalSelection}`} onClick={() => { onChange(null); setQuery(""); }}>×</Button>
      </div>
    </div>;
  }

  const describedBy = queryTooLong
    ? statusId
    : requestState !== "idle" && requestState !== "success"
    ? statusId
    : undefined;
  const popupOpen = focused && Boolean(normalizedQuery) && !queryTooLong;
  const suggestionsOpen = popupOpen && requestState === "success";
  const errorKey: "searchError" | "palDataUnavailable" | "apiNetworkError" | "apiTimeout" | "apiInvalidResponse" =
    requestState === "data_unavailable"
      ? "palDataUnavailable"
      : requestState === "network_error"
        ? "apiNetworkError"
        : requestState === "timeout"
          ? "apiTimeout"
          : requestState === "invalid_response"
            ? "apiInvalidResponse"
            : "searchError";

  return <div className="palworld-picker" ref={pickerRef} data-testid={testId} aria-busy={requestState === "loading"}>
    <label className="palworld-picker-label" htmlFor={`${listId}-input`}>{label}</label>
    <input
      id={`${listId}-input`}
      type="search"
      maxLength={PALWORLD_SEARCH_MAX_LENGTH}
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      onFocus={() => setFocused(true)}
      onKeyDown={handleInputKeyDown}
      placeholder={text.palPickerPlaceholder}
      aria-autocomplete="list"
      aria-busy={requestState === "loading"}
      aria-haspopup="listbox"
      aria-expanded={suggestionsOpen}
      aria-controls={suggestionsOpen ? listId : undefined}
      aria-activedescendant={suggestionsOpen && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
      aria-describedby={describedBy}
      aria-invalid={queryTooLong}
    />
    {queryTooLong ? (
      <div className="palworld-picker-list palworld-picker-error" id={statusId} role="alert">
        <p data-ko={palworldI18n.ko.searchTooLong} data-ja={palworldI18n.ja.searchTooLong}>{text.searchTooLong}</p>
      </div>
    ) : null}
    {suggestionsOpen ? <div className="palworld-picker-list" id={listId} role="listbox" aria-label={text.autocomplete}>
      {suggestions.map((pal, index) => {
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
          <span><strong>{name.text}</strong><PalworldTranslationBadge locale={locale} status={name.status} /><small>{formatPalNumber(pal.number, locale)}</small><span className="palworld-badge-row palworld-compact-element-row">{pal.elements.map((element) => <PalworldElementBadge element={element} locale={locale} key={element} />)}</span></span>
        </button>;
      })}
    </div> : null}
    {popupOpen && requestState === "loading"
      ? <div className="palworld-picker-list" id={statusId} role="status" aria-live="polite"><p>{text.searching}</p></div>
      : null}
    {popupOpen && requestState === "empty"
      ? <div className="palworld-picker-list" id={statusId}><p>{text.noResults}</p></div>
      : null}
    {popupOpen && ["error", "data_unavailable", "network_error", "timeout", "invalid_response"].includes(requestState) ? (
      <div className="palworld-picker-list palworld-picker-error" id={statusId} role="alert">
        <p data-ko={palworldI18n.ko[errorKey]} data-ja={palworldI18n.ja[errorKey]}>{text[errorKey]}</p>
        <Button size="sm" variant="secondary" onClick={() => setRevision((value) => value + 1)}>{text.retry}</Button>
      </div>
    ) : null}
  </div>;
}
