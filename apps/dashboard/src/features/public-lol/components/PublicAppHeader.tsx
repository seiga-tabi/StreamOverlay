import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { StreamerRiotIdRequest } from "@streamops/shared";
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
  const twitchMenuCloseTimer = useRef<number | undefined>(undefined);
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

  function clearTwitchMenuCloseTimer(): void {
    if (twitchMenuCloseTimer.current === undefined) return;
    window.clearTimeout(twitchMenuCloseTimer.current);
    twitchMenuCloseTimer.current = undefined;
  }

  function scheduleTwitchMenuClose(): void {
    clearTwitchMenuCloseTimer();
    twitchMenuCloseTimer.current = window.setTimeout(() => {
      setTwitchMenuOpen(false);
      twitchMenuCloseTimer.current = undefined;
    }, 320);
  }

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
      clearTwitchMenuCloseTimer();
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenus]);

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
              <img className="public-brand-mark" src="/images/yorogg-mark.png" alt="" aria-hidden="true" />
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
            <div className={`public-twitch-profile-wrap ${twitchMenuOpen ? "menu-open" : ""}`} onMouseEnter={clearTwitchMenuCloseTimer} onMouseLeave={scheduleTwitchMenuClose}>
              <button
                className={`public-twitch-login-chip ${twitchStatus.connected ? "connected" : ""}`}
                type="button"
                onClick={() => {
                  if (!twitchStatus.connected) {
                    onTwitchLogin();
                    return;
                  }
                  setTwitchMenuOpen((open) => {
                    const nextOpen = !open;
                    if (nextOpen) {
                      setGameMenuOpen(false);
                      setLocaleMenuOpen(false);
                      setFilterOpen(false);
                    }
                    return nextOpen;
                  });
                }}
                disabled={!twitchStatus.configured}
                aria-expanded={twitchMenuOpen}
                title={twitchStatus.connected ? twitchStatus.user?.displayName ?? t().twitchViewerLogin : t().twitchLoginRequired}
              >
                {twitchStatus.user?.profileImageUrl ? <img src={twitchStatus.user.profileImageUrl} alt="" /> : <span aria-hidden="true">T</span>}
                <strong>{twitchStatus.connected ? twitchStatus.user?.displayName ?? t().twitchViewerLogin : t().twitchViewerLogin}</strong>
              </button>
              {twitchStatus.connected && twitchMenuOpen ? (
                <div className="public-twitch-profile-menu" role="menu" aria-label={t().twitchProfileMenu}>
                  <div className="public-twitch-profile-menu-head">
                    {twitchStatus.user?.profileImageUrl ? <img src={twitchStatus.user.profileImageUrl} alt="" /> : <span aria-hidden="true">T</span>}
                    <div>
                      <strong>{twitchStatus.user?.displayName ?? twitchStatus.user?.login}</strong>
                      <small>@{twitchStatus.user?.login}</small>
                    </div>
                  </div>
                  {canRegisterStreamer ? (
                    <button type="button" role="menuitem" onClick={() => { setTwitchMenuOpen(false); onStreamerRegister(); }}>
                      {t().streamerRiotRegister}
                    </button>
                  ) : null}
                  {canOpenStreamerDashboard ? (
                    <button className="dashboard" type="button" role="menuitem" onClick={() => { setTwitchMenuOpen(false); onStreamerDashboard(); }}>
                      {t().streamerDashboardOpen}
                    </button>
                  ) : null}
                  {registeredStreamerRequest ? (
                    <button type="button" role="menuitem" onClick={() => { setTwitchMenuOpen(false); onStreamerRecord(); }}>
                      {t().streamerRecordOpen}
                    </button>
                  ) : null}
                  <button type="button" role="menuitem" onClick={() => { setTwitchMenuOpen(false); onTwitchLogout(); }}>
                    {t().twitchViewerLogout}
                  </button>
                </div>
              ) : null}
            </div>
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
