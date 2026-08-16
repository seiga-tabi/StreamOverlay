import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { StreamerRiotIdRequest } from "@streamops/shared";
import { PublicGameHeaderFrame } from "../../../shared/PublicGameChrome";
import { PublicMobileMenuSheet } from "../../../shared/PublicMobileMenuSheet";
import {
  PublicTwitchAccountChip,
  type PublicTwitchAccountMenuAction
} from "../../../shared/PublicTwitchAccountChip";
import { publicAccountI18n, usePublicAccountLogin } from "../../../shared/public-account-login";
import { openYoroDashboard } from "../../yoro-account/api";
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
/* 이 깊이 아래로 올라오면 상단바를 항상 펼칩니다. */
const MOBILE_CHROME_RESET_SCROLL = 24;
/* nav-slot은 하단 탭바가 대체해 모바일에서 항상 숨어 있으므로(31-bottom-tab-bar.css)
   실제로 접히는 건 검색 행뿐입니다. 그 높이만큼 스크롤이 지나가기 전에는 접지 않아야,
   접힘으로 문서 높이가 줄면서 브라우저가 scroll 위치를 되돌리는 반동이 화면 밖에서
   일어나 눈에 보이지 않습니다. */
const MOBILE_CHROME_COLLAPSE_MARGIN = 32;
const MOBILE_CHROME_SLOTS = ".public-game-header__search-slot, .public-game-header__nav-slot";
/* 이 값보다 작은 프레임 간 이동은 방향 전환으로 보지 않습니다. */
const MOBILE_CHROME_DELTA_THRESHOLD = 6;

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
  /* 계정 라벨의 단일 원본 — 다섯 게임 헤더가 같은 문구를 씁니다. */
  const account = publicAccountI18n[locale];
  const [gameSelectorOpen, setGameSelectorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [twitchMenuOpen, setTwitchMenuOpen] = useState(false);
  const [mobileChromeScrolled, setMobileChromeScrolled] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const registeredStreamerRequest = isRegisteredStreamerRequest(twitchStatus.streamerRiotRequest)
    ? twitchStatus.streamerRiotRequest
    : undefined;
  const canRegisterStreamer = twitchStatus.streamerRiotRequest?.status !== "approved"
    && twitchStatus.streamerRiotRequest?.status !== "pending";
  /* 계정 세션·핸들러·뷰어 Twitch 합성의 단일 원본 — shared/public-account-login.ts.
     페이지가 소유한 뷰어 세션은 옵션으로 주입합니다(로그아웃 시 함께 해제). */
  const {
    accountConnected,
    accountUser,
    loginWithDiscord: handleDiscordLogin,
    loginWithTwitch: handleTwitchAccountLogin,
    logout: handleAccountLogout,
  } = usePublicAccountLogin({
    viewerTwitch: {
      connected: twitchStatus.connected,
      ...(twitchStatus.user ? { user: twitchStatus.user } : {}),
      onDisconnect: onTwitchLogout,
    },
  });

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
    let settleUntil = 0;

    const collapsibleHeight = (): number => {
      const root = headerRef.current;
      if (!root) return 0;
      let total = 0;
      for (const slot of root.querySelectorAll(MOBILE_CHROME_SLOTS)) {
        total += slot.getBoundingClientRect().height;
      }
      return total;
    };

    const resetMobileChrome = () => {
      lastScrollY = window.scrollY;
      settleUntil = 0;
      setMobileChromeScrolled(false);
    };

    const syncMobileChrome = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const currentScrollY = Math.max(0, window.scrollY);
        if (!mobileMedia.matches || currentScrollY <= MOBILE_CHROME_RESET_SCROLL) {
          resetMobileChrome();
          return;
        }

        // 접힘/펼침은 검색 행 높이만큼 문서를 줄이고, 브라우저는 그만큼 scroll
        // 위치를 되돌립니다. 그 반동을 방향 전환으로 오해하지 않도록 전환
        // 애니메이션이 끝날 때까지는 판정을 쉽니다.
        if (performance.now() < settleUntil) {
          lastScrollY = currentScrollY;
          return;
        }

        const delta = currentScrollY - lastScrollY;
        lastScrollY = currentScrollY;
        if (delta > MOBILE_CHROME_DELTA_THRESHOLD) {
          // 반동이 리셋 구간까지 닿으면 접자마자 다시 펼쳐져 왕복이 반복되므로,
          // 되돌아가도 리셋 구간에 닿지 않을 만큼 내려온 뒤에만 접습니다.
          if (currentScrollY < collapsibleHeight() + MOBILE_CHROME_RESET_SCROLL + MOBILE_CHROME_COLLAPSE_MARGIN) {
            return;
          }
          setMobileChromeScrolled(true);
          settleUntil = performance.now() + MOBILE_CHROME_SETTLE_MS;
        } else if (delta < -MOBILE_CHROME_DELTA_THRESHOLD) {
          setMobileChromeScrolled(false);
          settleUntil = performance.now() + MOBILE_CHROME_SETTLE_MS;
        }
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
      {accountConnected && canRegisterStreamer ? (
        <button
          className="public-header-streamer-cta"
          data-ja={publicI18n.ja.streamerRiotRegister}
          data-ko={publicI18n.ko.streamerRiotRegister}
          onClick={onStreamerRegister}
          type="button"
        >
          {t().streamerRiotRegister}
        </button>
      ) : null}
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
        dashboardLabel={account.dashboard}
        dashboardLabelJa={publicAccountI18n.ja.dashboard}
        dashboardLabelKo={publicAccountI18n.ko.dashboard}
        discordLoginLabel={account.discordLogin}
        loginLabel={account.login}
        loginLabelJa={publicAccountI18n.ja.login}
        loginLabelKo={publicAccountI18n.ko.login}
        loginMenuLabel={account.loginMenu}
        loginTitle={account.loginTitle}
        logoutLabel={account.logout}
        logoutLabelJa={publicAccountI18n.ja.logout}
        logoutLabelKo={publicAccountI18n.ko.logout}
        menuActions={twitchMenuActions}
        menuLabel={account.menu}
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
        twitchLoginLabel={account.twitchLogin}
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

  /* 모바일 하단 탭바(PublicBottomTabBar)는 이 헤더 안에서 렌더링하지 않습니다.
     전적검색 결과 헤더에는 backdrop-filter가 걸려 있어(02-legacy.css) 그 안의
     position:fixed 는 뷰포트가 아니라 헤더를 기준으로 배치됩니다 — 탭바가 화면
     하단이 아니라 상단바 바로 아래에 붙었습니다. 탭바는 PublicLolPage 의 AppShell
     직계 자식으로 두어 어떤 헤더 스타일에도 영향받지 않게 합니다.
     탭 클릭 시 열려 있던 메뉴는 아래 pointerdown 핸들러가 headerRef 밖 클릭으로
     인식해 닫습니다. */
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
              dashboard: account.dashboard,
              discordLogin: account.discordLogin,
              game: t().gameMenu,
              language: t().language,
              login: account.login,
              loginLoading: account.twitchLoading,
              logout: account.logout,
              title: t().mobileMenu,
              twitch: account.section,
              twitchLogin: account.twitchLogin,
              twitchUnavailable: account.twitchUnavailable,
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
