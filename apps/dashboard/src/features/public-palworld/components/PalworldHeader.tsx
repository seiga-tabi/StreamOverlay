import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PublicMainPage } from "../../public-lol/types/public-lol";
import type { PublicTwitchViewerStatus } from "../../public-lol/types/public-lol";
import { PublicGameSelector } from "../../public-lol/components/PublicGameSelector";
import { PublicLocaleSelector } from "../../public-lol/components/PublicLocaleSelector";
import { PublicTwitchAccountChip, type PublicTwitchAccountMenuAction } from "../../../shared/PublicTwitchAccountChip";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { palworldPathForPage, setPalworldUrl, type PalworldPage } from "../utils/routes";

const navItems: Array<{ page: Exclude<PalworldPage, "search">; ko: string; ja: string }> = [
  { page: "home", ko: palworldI18n.ko.home, ja: palworldI18n.ja.home },
  { page: "streamers", ko: palworldI18n.ko.streamers, ja: palworldI18n.ja.streamers },
  { page: "pals", ko: palworldI18n.ko.pals, ja: palworldI18n.ja.pals },
  { page: "breeding", ko: palworldI18n.ko.breeding, ja: palworldI18n.ja.breeding },
  { page: "items", ko: palworldI18n.ko.items, ja: palworldI18n.ja.items },
  { page: "skills", ko: palworldI18n.ko.skills, ja: palworldI18n.ja.skills },
  { page: "map", ko: palworldI18n.ko.map, ja: palworldI18n.ja.map },
];

export function PalworldHeader({
  locale,
  onLocale,
  page,
  searchContent,
  twitchStatus = { connected: false, configured: false, requiredScopes: [], missingScopes: [] },
  onStreamerDashboard = () => undefined,
  onTwitchLogin = () => undefined,
  onTwitchLogout = () => undefined,
}: {
  locale: PalworldLocale;
  onLocale: (locale: PalworldLocale) => void;
  page: PalworldPage;
  searchContent?: ReactNode;
  twitchStatus?: PublicTwitchViewerStatus;
  onStreamerDashboard?: () => void;
  onTwitchLogin?: () => void;
  onTwitchLogout?: () => void;
}) {
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [twitchMenuOpen, setTwitchMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const closeMenus = useCallback(() => {
    setGameMenuOpen(false);
    setLocaleMenuOpen(false);
    setTwitchMenuOpen(false);
  }, []);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) closeMenus();
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [closeMenus]);

  useEffect(() => {
    const activeItem = navRef.current?.querySelector<HTMLElement>("[aria-current='page']");
    activeItem?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [page]);

  const twitchMenuActions: PublicTwitchAccountMenuAction[] = twitchStatus.streamerRiotRequest?.status === "approved"
    && twitchStatus.streamerRiotRequest.dashboardEnabled === true
    ? [{
      id: "dashboard",
      label: <span data-ko={palworldI18n.ko.streamerDashboardOpen} data-ja={palworldI18n.ja.streamerDashboardOpen}>{palworldI18n[locale].streamerDashboardOpen}</span>,
      onSelect: onStreamerDashboard,
      variant: "dashboard",
    }]
    : [];

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
              <img className="public-brand-mark public-brand-mobile-logo" src="/images/yorogg-home-logo.webp" alt="" aria-hidden="true" />
            </button>
            <PublicGameSelector activePage="palworld" onPage={handleGame} open={gameMenuOpen} onOpenChange={(open) => {
              setGameMenuOpen(open);
              if (open) {
                setLocaleMenuOpen(false);
                setTwitchMenuOpen(false);
              }
            }} />
          </div>
          <div className="public-header-tools">
            <PublicLocaleSelector locale={locale} onLocale={onLocale} open={localeMenuOpen} onOpenChange={(open) => {
              setLocaleMenuOpen(open);
              if (open) {
                setGameMenuOpen(false);
                setTwitchMenuOpen(false);
              }
            }} />
            <PublicTwitchAccountChip
              configured={twitchStatus.configured}
              connected={twitchStatus.connected}
              loginLabel={palworldI18n[locale].twitchLogin}
              loginLabelJa={palworldI18n.ja.twitchLogin}
              loginLabelKo={palworldI18n.ko.twitchLogin}
              loginTitle={palworldI18n[locale].twitchLoginTitle}
              logoutLabel={palworldI18n[locale].twitchLogout}
              logoutLabelJa={palworldI18n.ja.twitchLogout}
              logoutLabelKo={palworldI18n.ko.twitchLogout}
              menuActions={twitchMenuActions}
              menuLabel={palworldI18n[locale].twitchProfileMenu}
              onLogin={onTwitchLogin}
              onLogout={onTwitchLogout}
              onOpenChange={(open) => {
                setTwitchMenuOpen(open);
                if (open) {
                  setGameMenuOpen(false);
                  setLocaleMenuOpen(false);
                }
              }}
              open={twitchMenuOpen}
              user={twitchStatus.user}
            />
          </div>
          <button className="public-mobile-menu-toggle" type="button" aria-label={palworldI18n[locale].gameMenu} aria-expanded={gameMenuOpen} onClick={() => setGameMenuOpen((open) => {
            const nextOpen = !open;
            if (nextOpen) {
              setLocaleMenuOpen(false);
              setTwitchMenuOpen(false);
            }
            return nextOpen;
          })}>
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
            <nav className="public-header-nav palworld-header-nav" aria-label={palworldI18n[locale].brand} data-testid="palworld-secondary-nav" ref={navRef}>
              {navItems.map((item) => {
                const active = item.page === page || (page === "search" && item.page === "home");
                return (
                  <button
                    className={active ? "active" : ""}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    data-ko={item.ko}
                    data-ja={item.ja}
                    onClick={() => setPalworldUrl(palworldPathForPage(item.page))}
                    onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })}
                    key={item.page}
                  >
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
