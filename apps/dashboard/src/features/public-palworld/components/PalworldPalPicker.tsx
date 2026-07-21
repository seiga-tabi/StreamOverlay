import { useEffect, useId, useRef, useState } from "react";
import type { PalworldPalReference, PalworldPalSummary } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { searchPalworld } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { elementLabel } from "../utils/labels";
import { formatPalNumber, palName } from "../utils/search";
import { PalworldMedia } from "./PalworldMedia";

type PickerPal = PalworldPalReference | PalworldPalSummary;

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
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const text = palworldI18n[locale];

  useEffect(() => {
    if (!query.trim() || selected) {
      setSuggestions([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void searchPalworld(query, controller.signal).then((result) => setSuggestions(result.pals.slice(0, 8))).catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSuggestions([]);
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setFocused(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  if (selected) {
    const displayName = locale === "ja" ? selected.nameJa : selected.nameKo;
    return <div className="palworld-picker" ref={pickerRef} data-testid={testId}>
      <span className="palworld-picker-label">{label}</span>
      <div className="palworld-selected-pal">
        <span className="palworld-selected-media"><PalworldMedia kind="pal" imageUrl={selected.imageUrl} alt={displayName} locale={locale} /></span>
        <span><strong>{displayName}</strong><small>{formatPalNumber(selected.number)} · {selected.elements.map((value) => elementLabel(value, locale)).join(" / ")}</small></span>
        <Button size="sm" variant="ghost" aria-label={`${displayName} ${text.reset}`} onClick={() => { onChange(null); setQuery(""); }}>×</Button>
      </div>
    </div>;
  }

  return <div className="palworld-picker" ref={pickerRef} data-testid={testId}>
    <label className="palworld-picker-label" htmlFor={`${listId}-input`}>{label}</label>
    <input id={`${listId}-input`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setFocused(true)} placeholder={text.searchPlaceholder} aria-autocomplete="list" aria-expanded={focused && Boolean(query.trim())} aria-controls={listId} />
    {focused && query.trim() ? <div className="palworld-picker-list" id={listId} role="listbox" aria-label={text.autocomplete}>
      {loading ? <p role="status">{text.searching}</p> : null}
      {!loading && suggestions.map((pal) => <button type="button" role="option" aria-selected="false" onClick={() => { onChange(pal); setQuery(""); setFocused(false); }} key={pal.id}>
        <span className="palworld-picker-option-media"><PalworldMedia kind="pal" imageUrl={pal.imageUrl} alt={palName(pal, locale)} locale={locale} /></span>
        <span><strong>{palName(pal, locale)}</strong><small>{formatPalNumber(pal.number)} · {pal.elements.map((value) => elementLabel(value, locale)).join(" / ")}</small></span>
      </button>)}
      {!loading && suggestions.length === 0 ? <p>{text.noResults}</p> : null}
    </div> : null}
  </div>;
}
