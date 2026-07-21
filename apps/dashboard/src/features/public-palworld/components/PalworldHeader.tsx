import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PublicMainPage } from "../../public-lol/types/public-lol";
import { PublicGameSelector } from "../../public-lol/components/PublicGameSelector";
import { PublicLocaleSelector } from "../../public-lol/components/PublicLocaleSelector";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { palworldPathForPage, setPalworldUrl, type PalworldPage } from "../utils/routes";

const navItems: Array<{ page: Exclude<PalworldPage, "search">; ko: string; ja: string }> = [
  { page: "home", ko: palworldI18n.ko.home, ja: palworldI18n.ja.home },
  { page: "pals", ko: palworldI18n.ko.pals, ja: palworldI18n.ja.pals },
  { page: "breeding", ko: palworldI18n.ko.breeding, ja: palworldI18n.ja.breeding },
  { page: "items", ko: palworldI18n.ko.items, ja: palworldI18n.ja.items },
];

export function PalworldHeader({
  locale,
  onLocale,
  page,
  searchContent,
}: {
  locale: PalworldLocale;
  onLocale: (locale: PalworldLocale) => void;
  page: PalworldPage;
  searchContent?: ReactNode;
}) {
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  const closeMenus = useCallback(() => {
    setGameMenuOpen(false);
    setLocaleMenuOpen(false);
  }, []);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) closeMenus();
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [closeMenus]);

  function handleGame(page: PublicMainPage): void {
    closeMenus();
    if (page === "palworld") {
      setPalworldUrl("/palworld");
      return;
    }
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new CustomEvent("publicroutechange"));
  }

  return (
    <header className={`public-app-header public-app-header-v2 palworld-header${searchContent ? "" : " home"}`} ref={headerRef}>
      <div className="public-header-top-band">
        <div className="public-header-primary-row">
          <div className="public-header-product-cluster">
            <button className="public-header-brand" type="button" onClick={() => setPalworldUrl("/palworld")} aria-label={palworldI18n[locale].home}>
              <img className="public-brand-logo public-brand-logo-full public-brand-logo-topbar" src="/images/yorogg-topbar-logo.webp" alt="YORO.gg" />
              <img className="public-brand-mark" src="/images/yorogg-mark.png" alt="" aria-hidden="true" />
            </button>
            <PublicGameSelector activePage="palworld" onPage={handleGame} open={gameMenuOpen} onOpenChange={(open) => {
              setGameMenuOpen(open);
              if (open) setLocaleMenuOpen(false);
            }} />
          </div>
          <div className="public-header-tools">
            <PublicLocaleSelector locale={locale} onLocale={onLocale} open={localeMenuOpen} onOpenChange={(open) => {
              setLocaleMenuOpen(open);
              if (open) setGameMenuOpen(false);
            }} />
          </div>
          <button className="public-mobile-menu-toggle" type="button" aria-label={palworldI18n[locale].gameMenu} aria-expanded={gameMenuOpen} onClick={() => setGameMenuOpen((open) => !open)}>
            <span aria-hidden="true" />
            <strong data-ko={palworldI18n.ko.gameMenu} data-ja={palworldI18n.ja.gameMenu}>{palworldI18n[locale].gameMenu}</strong>
          </button>
          {gameMenuOpen ? <div className="public-mobile-game-tray"><PublicGameSelector activePage="palworld" onPage={handleGame} mode="tray" /></div> : null}
        </div>
      </div>
      <div className="public-header-bottom-band">
        <div className="public-header-bottom-row palworld-header-bottom-row">
          {searchContent}
          <div className="public-header-secondary-row palworld-secondary-row">
            <nav className="public-header-nav palworld-header-nav" aria-label={palworldI18n[locale].brand} data-testid="palworld-secondary-nav">
              {navItems.map((item) => {
                const active = item.page === page || (page === "search" && item.page === "home");
                return (
                  <button className={active ? "active" : ""} type="button" aria-current={active ? "page" : undefined} data-ko={item.ko} data-ja={item.ja} onClick={() => setPalworldUrl(palworldPathForPage(item.page))} key={item.page}>
                    <strong>{locale === "ja" ? item.ja : item.ko}</strong>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
