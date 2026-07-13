import { useEffect, useRef, useState, type ReactNode } from "react";
import type { StreamerRiotIdRequest } from "@streamops/shared";
import { publicI18n, t, type PublicLocale } from "../i18n/public-lol-i18n";
import type { PublicMainPage, PublicNavTarget, PublicTwitchViewerStatus } from "../types/public-lol";
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [twitchMenuOpen, setTwitchMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const twitchMenuCloseTimer = useRef<number | undefined>(undefined);
  const registeredStreamerRequest = isRegisteredStreamerRequest(twitchStatus.streamerRiotRequest) ? twitchStatus.streamerRiotRequest : undefined;
  const canRegisterStreamer = twitchStatus.streamerRiotRequest?.status !== "approved" && twitchStatus.streamerRiotRequest?.status !== "pending";
  const canOpenStreamerDashboard = registeredStreamerRequest?.dashboardEnabled === true;

  const handleMenuPage = (page: PublicMainPage) => {
    onPage(page);
    setMobileMenuOpen(false);
  };

  const handleHome = () => {
    onHome();
    setFilterOpen(false);
    setTwitchMenuOpen(false);
    setMobileMenuOpen(false);
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

  useEffect(() => () => clearTwitchMenuCloseTimer(), []);

  return (
    <header id={showSearch ? "public-search" : undefined} className={`public-app-header ${showSearch ? "" : "home"} ${mobileMenuOpen ? "mobile-menu-open" : ""}`}>
      <button className="public-header-brand" type="button" onClick={handleHome} aria-label={t().home}>
        <img className="public-brand-logo public-brand-logo-full public-brand-logo-topbar" src="/images/yorogg-topbar-logo.webp" alt={t().brand} />
      </button>
      <button
        className="public-mobile-menu-toggle"
        type="button"
        aria-label={t().mobileMenu}
        aria-expanded={mobileMenuOpen}
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        <span aria-hidden="true" />
        <strong data-ko={publicI18n.ko.mobileMenu} data-ja={publicI18n.ja.mobileMenu}>{t().mobileMenu}</strong>
      </button>
      <PublicHeaderMenu activePage={activePage} activeTarget={activeTarget} showSubscriptions={twitchStatus.connected} onPage={handleMenuPage} />
      {showSearch ? searchContent : null}
      <div className="public-header-tools">
        <PublicLocaleSelector locale={locale} onLocale={onLocale} onAutoLocale={onAutoLocale} />
        <div className={`public-twitch-profile-wrap ${twitchMenuOpen ? "menu-open" : ""}`} onMouseEnter={clearTwitchMenuCloseTimer} onMouseLeave={scheduleTwitchMenuClose}>
          <button
            className={`public-twitch-login-chip ${twitchStatus.connected ? "connected" : ""}`}
            type="button"
            onClick={() => {
              if (!twitchStatus.connected) {
                onTwitchLogin();
                return;
              }
              setTwitchMenuOpen((open) => !open);
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
            <button className={`public-filter-button ${filterActive ? "active" : ""}`} type="button" aria-expanded={filterOpen} onClick={() => setFilterOpen((open) => !open)}>
              <span aria-hidden="true">▽</span>
              <strong data-ko={publicI18n.ko.filter} data-ja={publicI18n.ja.filter}>{filterActive ? t().activeFilter : t().filter}</strong>
            </button>
            {filterOpen ? filterContent : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
