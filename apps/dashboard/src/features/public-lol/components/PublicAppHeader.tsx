import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { StreamerRiotIdRequest } from "@streamops/shared";
import { PublicTwitchAccountChip, type PublicTwitchAccountMenuAction } from "../../../shared/PublicTwitchAccountChip";
import { t, type PublicLocale } from "../i18n/public-lol-i18n";
import type { PublicMainPage, PublicNavTarget, PublicTwitchViewerStatus } from "../types/public-lol";
import { PublicGameSelector } from "./PublicGameSelector";
import { PublicHeaderMenu } from "./PublicHeaderMenu";
import { PublicLocaleSelector } from "./PublicLocaleSelector";

function isRegisteredStreamerRequest(request: StreamerRiotIdRequest | undefined): request is StreamerRiotIdRequest {
  return request?.status === "approved" && Boolean(request.overlaySlug && request.overlayKey);
}

export type PublicAppHeaderProps = {
  locale: PublicLocale;
  twitchStatus: PublicTwitchViewerStatus;
  activePage: PublicMainPage;
  activeTarget: PublicNavTarget;
  showSearch?: boolean;
  showFilters?: boolean;
  searchContent?: ReactNode;
  filterContent?: ReactNode;
  filterActive: boolean;
  onHome: () => void;
  onPage: (page: PublicMainPage) => void;
  onLocale: (locale: PublicLocale) => void;
  onAutoLocale: () => void;
  onTwitchLogin: () => void;
  onStreamerRegister: () => void;
  onStreamerDashboard: () => void;
  onStreamerRecord: () => void;
  onTwitchLogout: () => void;
};

export function PublicAppHeader({
  locale,
  twitchStatus,
  activePage,
  activeTarget,
  showSearch = true,
  showFilters = true,
  searchContent,
  filterContent,
  filterActive,
  onHome,
  onPage,
  onLocale,
  onAutoLocale,
  onTwitchLogin,
  onStreamerRegister,
  onStreamerDashboard,
  onStreamerRecord,
  onTwitchLogout
}: PublicAppHeaderProps) {
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [twitchMenuOpen, setTwitchMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const registeredStreamerRequest = isRegisteredStreamerRequest(twitchStatus.streamerRiotRequest) ? twitchStatus.streamerRiotRequest : undefined;
  const canRegisterStreamer = twitchStatus.streamerRiotRequest?.status !== "approved" && twitchStatus.streamerRiotRequest?.status !== "pending";
  const canOpenStreamerDashboard = registeredStreamerRequest?.dashboardEnabled === true;

  const closeMenus = useCallback(() => {
    setGameMenuOpen(false);
    setLocaleMenuOpen(false);
    setFilterOpen(false);
    setTwitchMenuOpen(false);
  }, []);

  const handleMenuPage = (page: PublicMainPage) => {
    onPage(page);
    closeMenus();
  };

  const handleHome = () => {
    onHome();
    closeMenus();
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) {
        closeMenus();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenus]);

  const twitchMenuActions: PublicTwitchAccountMenuAction[] = [];
  if (canRegisterStreamer) {
    twitchMenuActions.push({ id: "register", label: t().streamerRiotRegister, onSelect: onStreamerRegister });
  }
  if (canOpenStreamerDashboard) {
    twitchMenuActions.push({ id: "dashboard", label: t().streamerDashboardOpen, onSelect: onStreamerDashboard, variant: "dashboard" });
  }
  if (registeredStreamerRequest) {
    twitchMenuActions.push({ id: "record", label: t().streamerRecordOpen, onSelect: onStreamerRecord });
  }

  return (
    <header
      id={showSearch ? "public-search" : undefined}
      className={`public-app-header public-app-header-v2 ${showSearch ? "" : "home"}${gameMenuOpen ? " game-menu-open" : ""}`}
      ref={headerRef}
    >
      <div className="public-header-top-band">
        <div className="public-header-primary-row">
          <div className="public-header-product-cluster">
            <button className="public-header-brand" type="button" onClick={handleHome} aria-label={t().home}>
              <img className="public-brand-logo public-brand-logo-full public-brand-logo-topbar" src="/images/yorogg-topbar-logo.webp" alt={t().brand} />
              <img className="public-brand-mark public-brand-mobile-logo" src="/images/yorogg-home-logo.webp" alt="" aria-hidden="true" />
            </button>
            <PublicGameSelector
              activePage={activePage}
              onPage={handleMenuPage}
              open={gameMenuOpen}
              onOpenChange={(open) => {
                setGameMenuOpen(open);
                if (open) {
                  setLocaleMenuOpen(false);
                  setFilterOpen(false);
                  setTwitchMenuOpen(false);
                }
              }}
            />
          </div>
          <div className="public-header-tools">
            <PublicLocaleSelector
              locale={locale}
              onLocale={onLocale}
              onAutoLocale={onAutoLocale}
              open={localeMenuOpen}
              onOpenChange={(open) => {
                setLocaleMenuOpen(open);
                if (open) {
                  setGameMenuOpen(false);
                  setFilterOpen(false);
                  setTwitchMenuOpen(false);
                }
              }}
            />
            <PublicTwitchAccountChip
              configured={twitchStatus.configured}
              connected={twitchStatus.connected}
              loginLabel={t().twitchViewerLogin}
              loginTitle={t().twitchLoginRequired}
              logoutLabel={t().twitchViewerLogout}
              menuActions={twitchMenuActions}
              menuLabel={t().twitchProfileMenu}
              onLogin={onTwitchLogin}
              onLogout={onTwitchLogout}
              onOpenChange={(open) => {
                setTwitchMenuOpen(open);
                if (open) {
                  setGameMenuOpen(false);
                  setLocaleMenuOpen(false);
                  setFilterOpen(false);
                }
              }}
              open={twitchMenuOpen}
              user={twitchStatus.user}
            />
            {showFilters ? (
              <div className="public-header-popover-wrap">
                <button
                  className={`public-filter-button ${filterActive ? "active" : ""}`}
                  type="button"
                  aria-expanded={filterOpen}
                  onClick={() => {
                    setFilterOpen((open) => {
                      const nextOpen = !open;
                      if (nextOpen) {
                        setGameMenuOpen(false);
                        setLocaleMenuOpen(false);
                        setTwitchMenuOpen(false);
                      }
                      return nextOpen;
                    });
                  }}
                >
                  <span aria-hidden="true">▽</span>
                  <strong>{filterActive ? t().activeFilter : t().filter}</strong>
                </button>
                {filterOpen ? filterContent : null}
              </div>
            ) : null}
          </div>
          <button
            className="public-mobile-menu-toggle"
            type="button"
            aria-label={t().gameMenu}
            aria-expanded={gameMenuOpen}
            onClick={() => {
              setGameMenuOpen((open) => {
                const nextOpen = !open;
                if (nextOpen) {
                  setLocaleMenuOpen(false);
                  setFilterOpen(false);
                  setTwitchMenuOpen(false);
                }
                return nextOpen;
              });
            }}
          >
            <span aria-hidden="true" />
            <strong>{t().gameMenu}</strong>
          </button>
          {gameMenuOpen ? (
            <div className="public-mobile-game-tray">
              <PublicGameSelector activePage={activePage} onPage={handleMenuPage} mode="tray" />
            </div>
          ) : null}
        </div>
      </div>
      <div className="public-header-bottom-band">
        <div className="public-header-bottom-row">
          {showSearch ? searchContent : null}
          <div className="public-header-secondary-row">
            <PublicHeaderMenu activePage={activePage} activeTarget={activeTarget} onPage={handleMenuPage} />
          </div>
        </div>
      </div>
    </header>
  );
}
