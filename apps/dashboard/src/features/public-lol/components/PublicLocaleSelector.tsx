import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { t, type PublicLocale } from "../i18n/public-lol-i18n";

export type PublicLocaleSelectorProps = {
  locale: PublicLocale;
  onLocale: (locale: PublicLocale) => void;
  onAutoLocale?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 노출할 언어 목록 — 기본 ko·ja. en 콘텐츠가 있는 섹션(팰월드)만 en 을 추가합니다. */
  locales?: readonly PublicLocale[];
};

const DEFAULT_LOCALES: readonly PublicLocale[] = ["ko", "ja"];

function localeOptionList(locales: readonly PublicLocale[]): Array<{ locale: PublicLocale; code: string; label: string }> {
  const all: Array<{ locale: PublicLocale; code: string; label: string }> = [
    { locale: "ko", code: "KR", label: t().languageKo },
    { locale: "ja", code: "JP", label: t().languageJa },
    { locale: "en", code: "EN", label: t().languageEn },
  ];
  return all.filter((option) => locales.includes(option.locale));
}

function applyLocale(nextLocale: PublicLocale, onLocale: (locale: PublicLocale) => void): void {
  window.localStorage.setItem("preferredLanguage", nextLocale);
  window.dispatchEvent(new CustomEvent("languagechange", {
    detail: { language: nextLocale }
  }));
  onLocale(nextLocale);
}

export function PublicLocaleOptions({
  ariaLabel,
  locale,
  onLocale,
  locales = DEFAULT_LOCALES,
}: {
  ariaLabel?: string;
  locale: PublicLocale;
  onLocale: (locale: PublicLocale) => void;
  locales?: readonly PublicLocale[];
}) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const options = localeOptionList(locales);

  function focusOption(index: number): void {
    const nextIndex = (index + options.length) % options.length;
    optionRefs.current[nextIndex]?.focus();
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(options.length - 1);
    }
  }

  return (
    <div
      aria-label={ariaLabel ?? t().language}
      className="public-locale-options"
      role="radiogroup"
    >
      {options.map((option, index) => (
        <button
          aria-checked={option.locale === locale}
          className={`public-locale-option${option.locale === locale ? " active" : ""}`}
          data-ja={option.locale === "ja" ? option.label : undefined}
          data-ko={option.locale === "ko" ? option.label : undefined}
          key={option.locale}
          onClick={() => applyLocale(option.locale, onLocale)}
          onKeyDown={(event) => handleOptionKeyDown(event, index)}
          ref={(node) => {
            optionRefs.current[index] = node;
          }}
          role="radio"
          type="button"
        >
          <span className="public-locale-option-radio" aria-hidden="true" />
          <strong>{option.label}</strong>
          <small>{option.code}</small>
          <span className="public-locale-option-check" aria-hidden="true">✓</span>
        </button>
      ))}
    </div>
  );
}

export function PublicLocaleSelector({
  locale,
  onLocale,
  onAutoLocale: _onAutoLocale,
  open: controlledOpen,
  onOpenChange,
  locales = DEFAULT_LOCALES
}: PublicLocaleSelectorProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const open = controlledOpen ?? internalOpen;
  const options = localeOptionList(locales);
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
    applyLocale(nextLocale, onLocale);
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
