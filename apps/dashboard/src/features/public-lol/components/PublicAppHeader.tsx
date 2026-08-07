import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { StreamerRiotIdRequest } from "@streamops/shared";
import { trackGoogleAnalyticsEvent } from "../../../analytics/google-analytics";
import { PublicGameHeaderFrame } from "../../../shared/PublicGameChrome";
import { PublicMobileMenuSheet } from "../../../shared/PublicMobileMenuSheet";
import {
  PublicTwitchAccountChip,
  type PublicTwitchAccountMenuAction,
  type PublicTwitchAccountUser
} from "../../../shared/PublicTwitchAccountChip";
import { accountOAuthUrl, openYoroDashboard } from "../../yoro-account/api";
import {
  authenticatedYoroIdentity,
  useYoroAccountSession
} from "../../yoro-account/useYoroAccountSession";
import { publicI18n, t, type PublicLocale } from "../i18n/public-lol-i18n";
import type { PublicMainPage, PublicNavTarget, PublicTwitchViewerStatus } from "../types/public-lol";
import { PublicGameSelector } from "./PublicGameSelector";
import { PublicHeaderMenu } from "./PublicHeaderMenu";
import { PublicLocaleSelector } from "./PublicLocaleSelector";

function isRegisteredStreamerRequest(request: StreamerRiotIdRequest | undefined): request is StreamerRiotIdRequest {
  return request?.status === "approved";
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
  onStreamerRecord: () => void;
  onTwitchLogout: () => void;
};

const MOBILE_CHROME_SETTLE_MS = 320;

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
  onStreamerRecord,
  onTwitchLogout,
}: PublicAppHeaderProps) {
  const [gameSelectorOpen, setGameSelectorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [twitchMenuOpen, setTwitchMenuOpen] = useState(false);
  const [mobileChromeScrolled, setMobileChromeScrolled] = useState(false);
  const yoroAccount = useYoroAccountSession();
  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const registeredStreamerRequest = isRegisteredStreamerRequest(twitchStatus.streamerRiotRequest)
    ? twitchStatus.streamerRiotRequest
    : undefined;
  const canRegisterStreamer = twitchStatus.streamerRiotRequest?.status !== "approved"
    && twitchStatus.streamerRiotRequest?.status !== "pending";
  const yoroIdentity = authenticatedYoroIdentity(yoroAccount.session);
  const yoroConnected = yoroAccount.session?.authenticated === true;
  const accountConnected = yoroConnected || twitchStatus.connected;
  const accountUser: PublicTwitchAccountUser | undefined = yoroIdentity
    ? {
      displayName: yoroIdentity.displayName,
      provider: yoroIdentity.provider,
      linkedProviders: yoroAccount.session?.authenticated
        ? yoroAccount.session.identities.map((identity) => identity.provider)
        : [yoroIdentity.provider],
      ...(yoroIdentity.avatarUrl ? { profileImageUrl: yoroIdentity.avatarUrl } : {}),
      ...(yoroIdentity.provider === "twitch" && twitchStatus.user
        ? {
          login: twitchStatus.user.login,
          ...(yoroIdentity.avatarUrl
            ? {}
            : { profileImageUrl: twitchStatus.user.profileImageUrl })
        }
        : {})
    }
    : twitchStatus.user
      ? { ...twitchStatus.user, linkedProviders: ["twitch"] }
      : undefined;
  const handleDiscordLogin = () => {
    const returnPath = `${window.location.pathname}${window.location.search}`;
    trackGoogleAnalyticsEvent("discord_click", { link_context: "account_login" });
    window.location.assign(accountOAuthUrl("discord", "login", returnPath));
  };
  const handleTwitchAccountLogin = () => {
    const returnPath = `${window.location.pathname}${window.location.search}`;
    trackGoogleAnalyticsEvent("twitch_click", { link_context: "account_login" });
    window.location.assign(accountOAuthUrl("twitch", "login", returnPath));
  };
  const handleAccountLogout = () => {
    void (async () => {
      try {
        if (yoroConnected) await yoroAccount.logout();
        if (twitchStatus.connected) onTwitchLogout();
      } catch {
        // 로그아웃 요청이 실패하면 연결 표시를 유지해 사용자가 다시 시도할 수 있게 합니다.
      }
    })();
  };

  const closeMenus = useCallback(() => {
    setGameSelectorOpen(false);
    setMobileMenuOpen(false);
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
      if (
        event.target instanceof Element
        && event.target.closest(".public-bottom-sheet")
      ) {
        return;
      }
      if (!headerRef.current?.contains(event.target as Node)) {
        closeMenus();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setGameSelectorOpen(false);
        setMobileMenuOpen(false);
        setLocaleMenuOpen(false);
        setFilterOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenus]);

  useEffect(() => {
    const mobileMedia = window.matchMedia("(max-width: 48rem)");
    let animationFrame = 0;
    let lastScrollY = window.scrollY;
    let directionStartY = lastScrollY;
    let scrollDirection = 0;
    let settleUntil = 0;

    const resetMobileChrome = () => {
      lastScrollY = window.scrollY;
      directionStartY = lastScrollY;
      scrollDirection = 0;
      settleUntil = 0;
      setMobileChromeScrolled(false);
    };

    const syncMobileChrome = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const currentScrollY = Math.max(0, window.scrollY);
        if (!mobileMedia.matches || currentScrollY <= 24) {
          resetMobileChrome();
          return;
        }

        const nextDirection = Math.sign(currentScrollY - lastScrollY);
        if (nextDirection !== 0 && nextDirection !== scrollDirection) {
          scrollDirection = nextDirection;
          directionStartY = lastScrollY;
        }

        // 접힘/펼침은 상단바 높이를 바꾸고, 브라우저는 그만큼 scroll 위치를 되돌립니다.
        // 그 반동(약 40px)을 사용자의 방향 전환으로 오해하면 접힘과 펼침이 서로를
        // 유발해 계속 진동합니다. 전환 애니메이션이 끝날 때까지는 판정을 멈춥니다.
        if (performance.now() < settleUntil) {
          lastScrollY = currentScrollY;
          directionStartY = currentScrollY;
          scrollDirection = 0;
          return;
        }

        const directionTravel = Math.abs(currentScrollY - directionStartY);
        if (scrollDirection > 0 && directionTravel >= 20) {
          setMobileChromeScrolled(true);
          settleUntil = performance.now() + MOBILE_CHROME_SETTLE_MS;
          directionStartY = currentScrollY;
          scrollDirection = 0;
        } else if (scrollDirection < 0 && directionTravel >= 12) {
          setMobileChromeScrolled(false);
          settleUntil = performance.now() + MOBILE_CHROME_SETTLE_MS;
          directionStartY = currentScrollY;
          scrollDirection = 0;
        }
        lastScrollY = currentScrollY;
      });
    };

    resetMobileChrome();
    window.addEventListener("scroll", syncMobileChrome, { passive: true });
    mobileMedia.addEventListener("change", resetMobileChrome);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", syncMobileChrome);
      mobileMedia.removeEventListener("change", resetMobileChrome);
    };
  }, []);

  const twitchMenuActions: PublicTwitchAccountMenuAction[] = [];
  if (canRegisterStreamer) {
    twitchMenuActions.push({ id: "register", label: t().streamerRiotRegister, onSelect: onStreamerRegister });
  }
  if (registeredStreamerRequest) {
    twitchMenuActions.push({ id: "record", label: t().streamerRecordOpen, onSelect: onStreamerRecord });
  }

  const accountTools = (
    <>
      <PublicLocaleSelector
        locale={locale}
        onLocale={onLocale}
        onAutoLocale={onAutoLocale}
        open={localeMenuOpen}
        onOpenChange={(open) => {
          setLocaleMenuOpen(open);
          if (open) {
            setGameSelectorOpen(false);
            setMobileMenuOpen(false);
            setFilterOpen(false);
            setTwitchMenuOpen(false);
          }
        }}
      />
      <PublicTwitchAccountChip
        configured={twitchStatus.configured}
        connected={accountConnected}
        dashboardLabel={t().yoroDashboardOpen}
        dashboardLabelJa={publicI18n.ja.yoroDashboardOpen}
        dashboardLabelKo={publicI18n.ko.yoroDashboardOpen}
        discordLoginLabel={t().discordLogin}
        loginLabel={t().accountLogin}
        loginLabelJa={publicI18n.ja.accountLogin}
        loginLabelKo={publicI18n.ko.accountLogin}
        loginMenuLabel={t().accountLoginMenu}
        loginTitle={t().accountLoginTitle}
        logoutLabel={t().accountLogout}
        logoutLabelJa={publicI18n.ja.accountLogout}
        logoutLabelKo={publicI18n.ko.accountLogout}
        menuActions={twitchMenuActions}
        menuLabel={t().accountMenu}
        onDashboard={openYoroDashboard}
        onDiscordLogin={handleDiscordLogin}
        onLogin={handleTwitchAccountLogin}
        onLogout={handleAccountLogout}
        onOpenChange={(open) => {
          setTwitchMenuOpen(open);
          if (open) {
            setGameSelectorOpen(false);
            setMobileMenuOpen(false);
            setLocaleMenuOpen(false);
            setFilterOpen(false);
          }
        }}
        open={twitchMenuOpen}
        twitchLoginLabel={t().twitchLoginChoice}
        user={accountUser}
      />
    </>
  );
  const pageActions = showFilters ? (
    <div className="public-header-popover-wrap">
      <button
        className={`public-filter-button ${filterActive ? "active" : ""}`}
        type="button"
        aria-expanded={filterOpen}
        onClick={() => {
          setFilterOpen((open) => {
            const nextOpen = !open;
            if (nextOpen) {
              setGameSelectorOpen(false);
              setMobileMenuOpen(false);
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
  ) : undefined;

  return (
    <div id={showSearch ? "public-search" : undefined} ref={headerRef}>
      <PublicGameHeaderFrame
        accountTools={accountTools}
        brand={(
          <button className="public-game-header__brand" type="button" onClick={handleHome} aria-label={t().home}>
            <img
              className="public-game-header__brand-logo"
              src="/images/yorogg-home-logo.webp"
              alt={t().brand}
            />
          </button>
        )}
        className={`lol-public-game-header ${mobileChromeScrolled ? "mobile-chrome-scrolled" : ""}`}
        gameSelector={(
          <PublicGameSelector
            activePage={activePage}
            onPage={handleMenuPage}
            open={gameSelectorOpen}
            onOpenChange={(open) => {
              setGameSelectorOpen(open);
              if (open) {
                setMobileMenuOpen(false);
                setLocaleMenuOpen(false);
                setFilterOpen(false);
                setTwitchMenuOpen(false);
              }
            }}
          />
        )}
        home={!showSearch}
        mobileMenuToggle={(
          <button
            aria-controls="lol-mobile-menu"
            aria-expanded={mobileMenuOpen}
            aria-haspopup="dialog"
            aria-label={mobileMenuOpen ? t().closeMobileMenu : t().openMobileMenu}
            className="public-game-header__menu-button"
            onClick={() => {
              setMobileMenuOpen((open) => {
                const nextOpen = !open;
                if (nextOpen) {
                  setGameSelectorOpen(false);
                  setLocaleMenuOpen(false);
                  setFilterOpen(false);
                  setTwitchMenuOpen(false);
                }
                return nextOpen;
              });
            }}
            ref={mobileMenuTriggerRef}
            type="button"
          >
            <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <strong data-ko={publicI18n.ko.mobileMenu} data-ja={publicI18n.ja.mobileMenu}>
              {t().mobileMenu}
            </strong>
          </button>
        )}
        mobileMenu={(
          <PublicMobileMenuSheet
            accountConnected={accountConnected}
            accountUser={accountUser}
            activePage={activePage}
            id="lol-mobile-menu"
            labels={{
              close: t().closeMobileMenu,
              dashboard: t().yoroDashboardOpen,
              discordLogin: t().discordLogin,
              game: t().gameMenu,
              language: t().language,
              login: t().accountLogin,
              loginLoading: t().twitchLoginLoading,
              logout: t().accountLogout,
              title: t().mobileMenu,
              twitch: t().account,
              twitchLogin: t().twitchLoginChoice,
              twitchUnavailable: t().twitchNotConfigured,
            }}
            locale={locale}
            onClose={() => setMobileMenuOpen(false)}
            onGamePage={handleMenuPage}
            onLocale={onLocale}
            onDiscordLogin={handleDiscordLogin}
            onDashboard={openYoroDashboard}
            onTwitchLogin={handleTwitchAccountLogin}
            onTwitchLogout={onTwitchLogout}
            onAccountLogout={handleAccountLogout}
            open={mobileMenuOpen}
            returnFocusRef={mobileMenuTriggerRef}
            twitchActions={twitchMenuActions}
            twitchConfigured={twitchStatus.configured}
            twitchConnected={twitchStatus.connected}
            twitchUser={twitchStatus.user}
          />
        )}
        navigation={(
          <PublicHeaderMenu
            activePage={activePage}
            activeTarget={activeTarget}
            onPage={handleMenuPage}
          />
        )}
        pageActions={pageActions}
        search={showSearch ? searchContent : undefined}
      />
    </div>
  );
}
