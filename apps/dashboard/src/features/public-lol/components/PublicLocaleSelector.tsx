import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { t, type PublicLocale } from "../i18n/public-lol-i18n";

export type PublicLocaleSelectorProps = {
  locale: PublicLocale;
  onLocale: (locale: PublicLocale) => void;
  onAutoLocale?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function PublicLocaleSelector({
  locale,
  onLocale,
  onAutoLocale: _onAutoLocale,
  open: controlledOpen,
  onOpenChange
}: PublicLocaleSelectorProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const open = controlledOpen ?? internalOpen;
  const options: Array<{ locale: PublicLocale; code: string; label: string }> = [
    { locale: "ko", code: "KR", label: t().languageKo },
    { locale: "ja", code: "JP", label: t().languageJa }
  ];
  const activeOption = options.find((option) => option.locale === locale) ?? options[0]!;

  function setOpen(nextOpen: boolean): void {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }

  function focusOption(index: number): void {
    const nextIndex = (index + options.length) % options.length;
    optionRefs.current[nextIndex]?.focus();
  }

  const restoreTriggerFocus = useCallback((): void => {
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  function selectLocale(nextLocale: PublicLocale): void {
    window.localStorage.setItem("preferredLanguage", nextLocale);
    window.dispatchEvent(new CustomEvent("languagechange", {
      detail: { language: nextLocale }
    }));
    onLocale(nextLocale);
    setOpen(false);
    restoreTriggerFocus();
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(options.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      restoreTriggerFocus();
    }
  }

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        restoreTriggerFocus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, restoreTriggerFocus]);

  return (
    <div className={`public-locale-menu public-app-locale-menu${open ? " is-open" : ""}`} ref={menuRef}>
      <button
        className="public-locale-button"
        type="button"
        ref={triggerRef}
        aria-label={t().languageMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
            window.requestAnimationFrame(() => {
              focusOption(Math.max(0, options.findIndex((option) => option.locale === locale)));
            });
          }
        }}
      >
        <span className="public-globe-icon" aria-hidden="true"><span /></span>
        <span className="mobile-language-label" aria-hidden="true">文</span>
        <strong className="public-locale-current-code">{activeOption.code}</strong>
        <span className="public-locale-chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          className="public-locale-popover"
          role="menu"
          aria-label={t().language}
        >
          {options.map((option, index) => (
            <button
              key={option.locale}
              type="button"
              className={option.locale === locale ? "active" : ""}
              role="menuitemradio"
              aria-checked={option.locale === locale}
              aria-label={`${option.code} ${option.label}`}
              onClick={() => selectLocale(option.locale)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
            >
              <span className="public-locale-option-label">{option.label}</span>
              <strong className="public-locale-option-code">{option.code}</strong>
              <em className="public-locale-option-check" aria-hidden="true">✓</em>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
