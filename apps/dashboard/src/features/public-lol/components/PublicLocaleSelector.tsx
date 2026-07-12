import { useState } from "react";
import { publicI18n, t, type PublicLocale } from "../i18n/public-lol-i18n";

export type PublicLocaleSelectorProps = {
  locale: PublicLocale;
  onLocale: (locale: PublicLocale) => void;
  onAutoLocale?: () => void;
};

export function PublicLocaleSelector({
  locale,
  onLocale,
  onAutoLocale: _onAutoLocale
}: PublicLocaleSelectorProps) {
  const [open, setOpen] = useState(false);
  const options: Array<{ locale: PublicLocale; code: string; label: string }> = [
    { locale: "ko", code: "KR", label: t().languageKo },
    { locale: "ja", code: "JP", label: t().languageJa }
  ];
  const activeCode = locale === "ja" ? "JP" : "KR";

  function selectLocale(nextLocale: PublicLocale): void {
    onLocale(nextLocale);
    setOpen(false);
  }

  return (
    <div className="public-locale-menu">
      <button
        className="public-locale-button"
        type="button"
        aria-label={t().languageMenu}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="public-globe-icon" aria-hidden="true"><span /></span>
        <strong>{activeCode}</strong>
        <i aria-hidden="true" />
      </button>
      {open ? (
        <div className="public-locale-popover" role="menu" aria-label={t().language}>
          {options.map((option) => (
            <button
              key={option.locale}
              type="button"
              className={option.locale === locale ? "active" : ""}
              role="menuitemradio"
              aria-checked={option.locale === locale}
              aria-label={`${option.code} ${option.label}`}
              onClick={() => selectLocale(option.locale)}
            >
              <strong>{option.code}</strong>
              <em aria-hidden="true">✓</em>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
