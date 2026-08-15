import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PublicGameHeaderFrame, PublicHorizontalNav } from "../../../shared/PublicGameChrome";
import { PublicMobileMenuSheet } from "../../../shared/PublicMobileMenuSheet";
import {
  PublicTwitchAccountChip,
  type PublicTwitchAccountMenuAction
} from "../../../shared/PublicTwitchAccountChip";
import { publicAccountI18n, usePublicAccountLogin } from "../../../shared/public-account-login";
import { PublicGameSelector } from "../../public-lol/components/PublicGameSelector";
import { PublicLocaleSelector } from "../../public-lol/components/PublicLocaleSelector";
import type { PublicMainPage, PublicTwitchViewerStatus } from "../../public-lol/types/public-lol";
import { setPublicPath } from "../../public-lol/utils/routes";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { palworldPathForPage, setPalworldUrl, type PalworldPage } from "../utils/routes";

/* 하단 탭바(PalworldBottomTabBar)와 항목 데이터·아이콘을 공유합니다 —
   라벨·순서·활성 판정이 두 곳에서 어긋나지 않게 하는 단일 원본입니다. */
export const palworldNavItems: Array<{ page: Exclude<PalworldPage, "search">; ko: string; ja: string }> = [
  { page: "home", ko: palworldI18n.ko.home, ja: palworldI18n.ja.home },
  { page: "pals", ko: palworldI18n.ko.pals, ja: palworldI18n.ja.pals },
  { page: "breeding", ko: palworldI18n.ko.breeding, ja: palworldI18n.ja.breeding },
  { page: "items", ko: palworldI18n.ko.items, ja: palworldI18n.ja.items },
  { page: "technology", ko: palworldI18n.ko.technology, ja: palworldI18n.ja.technology },
  { page: "skills", ko: palworldI18n.ko.skills, ja: palworldI18n.ja.skills },
  { page: "map", ko: palworldI18n.ko.map, ja: palworldI18n.ja.map },
];
const navItems = palworldNavItems;

export function isPalworldNavItemActive(
  itemPage: Exclude<PalworldPage, "search">,
  page: PalworldPage
): boolean {
  return itemPage === page || (page === "search" && itemPage === "home");
}

export function PalworldNavIcon({ page }: { page: Exclude<PalworldPage, "search"> }) {
  const commonProps = {
    "aria-hidden": true,
    className: "public-header-menu-icon",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  if (page === "home") return <svg {...commonProps}><path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3Z" /></svg>;
  if (page === "pals") return <svg {...commonProps}><circle cx="12" cy="13" r="4" /><circle cx="6" cy="8" r="2" /><circle cx="12" cy="6" r="2" /><circle cx="18" cy="8" r="2" /></svg>;
  if (page === "breeding") return <svg {...commonProps}><path d="M8.5 8.5 5 5m10.5 3.5L19 5M8 16l-3 3m11-3 3 3" /><circle cx="12" cy="12" r="5" /></svg>;
  if (page === "items") return <svg {...commonProps}><path d="m4 8 8-4 8 4-8 4-8-4Zm0 0v8l8 4 8-4V8M12 12v8" /></svg>;
  if (page === "technology") return <svg {...commonProps}><path d="M8 3v3m8-3v3M8 18v3m8-3v3M3 8h3m12 0h3M3 16h3m12 0h3" /><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M10 10h4v4h-4z" /></svg>;
  if (page === "skills") return <svg {...commonProps}><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" /></svg>;
  return <svg {...commonProps}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}

export function PalworldHeader({
  locale,
  onLocale,
  page,
  searchContent,
  twitchStatus = { connected: false, configured: false, requiredScopes: [], missingScopes: [] },
  onTwitchLogout = () => undefined,
}: {
  locale: PalworldLocale;
  onLocale: (locale: PalworldLocale) => void;
  page: PalworldPage;
  searchContent?: ReactNode;
  twitchStatus?: PublicTwitchViewerStatus;
  onTwitchLogout?: () => void;
}) {
  const [gameSelectorOpen, setGameSelectorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [twitchMenuOpen, setTwitchMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const text = palworldI18n[locale];
  /* 계정 라벨의 단일 원본 — 다섯 게임 헤더가 같은 문구를 씁니다. */
  const account = publicAccountI18n[locale];
  /* 계정 세션·핸들러·뷰어 Twitch 합성의 단일 원본 — shared/public-account-login.ts.
     페이지가 소유한 뷰어 세션은 옵션으로 주입합니다(로그아웃 시 함께 해제). */
  const {
    accountConnected,
    accountUser,
    loginWithDiscord,
    loginWithTwitch,
    logout: handleAccountLogout,
    openDashboard,
    twitchConfigured,
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
    setTwitchMenuOpen(false);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Element
        && event.target.closest(".public-bottom-sheet")
      ) {
        return;
      }
      if (!headerRef.current?.contains(event.target as Node)) closeMenus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setGameSelectorOpen(false);
        setMobileMenuOpen(false);
        setLocaleMenuOpen(false);
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

  function handleGame(nextPage: PublicMainPage): void {
    closeMenus();
    if (nextPage === "palworld") {
      setPalworldUrl("/palworld");
      return;
    }
    if (nextPage === "minecraft") {
      setPublicPath("/minecraft");
      return;
    }
    if (nextPage === "valorant") {
      setPublicPath("/valorant");
      return;
    }
    if (nextPage === "bot") {
      setPublicPath("/bot");
      return;
    }
    setPublicPath("/");
  }

  const navigation = (
    <PublicHorizontalNav ariaLabel={text.mainMenu} testId="palworld-secondary-nav">
      {navItems.map((item) => {
        const active = isPalworldNavItemActive(item.page, page);
        return (
          <button
            className={active ? "active" : ""}
            type="button"
            aria-current={active ? "page" : undefined}
            data-ko={item.ko}
            data-ja={item.ja}
            onClick={() => setPalworldUrl(palworldPathForPage(item.page))}
            key={item.page}
          >
            <PalworldNavIcon page={item.page} />
            <strong>{locale === "ja" ? item.ja : item.ko}</strong>
          </button>
        );
      })}
    </PublicHorizontalNav>
  );

  return (
    <div ref={headerRef}>
      <PublicGameHeaderFrame
        accountTools={(
          <>
            <PublicLocaleSelector
              locale={locale}
              onLocale={onLocale}
              open={localeMenuOpen}
              onOpenChange={(open) => {
                setLocaleMenuOpen(open);
                if (open) {
                  setGameSelectorOpen(false);
                  setMobileMenuOpen(false);
                  setTwitchMenuOpen(false);
                }
              }}
            />
            <PublicTwitchAccountChip
              configured={twitchConfigured}
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
              onDashboard={openDashboard}
              onDiscordLogin={loginWithDiscord}
              onLogin={loginWithTwitch}
              onLogout={handleAccountLogout}
              onOpenChange={(open) => {
                setTwitchMenuOpen(open);
                if (open) {
                  setGameSelectorOpen(false);
                  setMobileMenuOpen(false);
                  setLocaleMenuOpen(false);
                }
              }}
              open={twitchMenuOpen}
              twitchLoginLabel={account.twitchLogin}
              user={accountUser}
            />
          </>
        )}
        brand={(
          <button
            className="public-game-header__brand"
            type="button"
            onClick={() => setPalworldUrl("/palworld")}
            aria-label={text.home}
          >
            <img
              className="public-game-header__brand-logo"
              src="/images/yorogg-home-logo.webp"
              alt="YORO.gg"
            />
          </button>
        )}
        className="palworld-header"
        gameSelector={(
          <PublicGameSelector
            activePage="palworld"
            onPage={handleGame}
            open={gameSelectorOpen}
            onOpenChange={(open) => {
              setGameSelectorOpen(open);
              if (open) {
                setMobileMenuOpen(false);
                setLocaleMenuOpen(false);
                setTwitchMenuOpen(false);
              }
            }}
          />
        )}
        home={!searchContent}
        mobileMenuToggle={(
          <button
            aria-controls="palworld-mobile-menu"
            aria-expanded={mobileMenuOpen}
            aria-haspopup="dialog"
            aria-label={mobileMenuOpen ? text.closeMobileMenu : text.openMobileMenu}
            className="public-game-header__menu-button"
            onClick={() => {
              setMobileMenuOpen((open) => {
                const nextOpen = !open;
                if (nextOpen) {
                  setGameSelectorOpen(false);
                  setLocaleMenuOpen(false);
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
            <strong data-ko={palworldI18n.ko.mobileMenu} data-ja={palworldI18n.ja.mobileMenu}>
              {text.mobileMenu}
            </strong>
          </button>
        )}
        mobileMenu={(
          <PublicMobileMenuSheet
            accountConnected={accountConnected}
            accountUser={accountUser}
            activePage="palworld"
            id="palworld-mobile-menu"
            labels={{
              close: text.closeMobileMenu,
              dashboard: account.dashboard,
              discordLogin: account.discordLogin,
              game: text.gameMenu,
              language: text.languageSection,
              login: account.login,
              loginLoading: account.twitchLoading,
              logout: account.logout,
              title: text.mobileMenu,
              twitch: account.section,
              twitchLogin: account.twitchLogin,
              twitchUnavailable: account.twitchUnavailable,
            }}
            locale={locale}
            onClose={() => setMobileMenuOpen(false)}
            onGamePage={handleGame}
            onLocale={onLocale}
            onDiscordLogin={loginWithDiscord}
            onDashboard={openDashboard}
            onTwitchLogin={loginWithTwitch}
            onTwitchLogout={onTwitchLogout}
            onAccountLogout={handleAccountLogout}
            open={mobileMenuOpen}
            returnFocusRef={mobileMenuTriggerRef}
            twitchActions={twitchMenuActions}
            twitchConfigured={twitchConfigured}
            twitchConnected={twitchStatus.connected}
            twitchUser={twitchStatus.user}
          />
        )}
        navigation={navigation}
        search={searchContent}
      />
    </div>
  );
}
