import { useCallback, useEffect, useRef, useState } from "react";
import { PublicGameHeaderFrame, PublicHorizontalNav } from "../../../shared/PublicGameChrome";
import { PublicMobileMenuSheet } from "../../../shared/PublicMobileMenuSheet";
import { PublicGameSelector } from "../../public-lol/components/PublicGameSelector";
import { PublicLocaleSelector } from "../../public-lol/components/PublicLocaleSelector";
import type { PublicMainPage } from "../../public-lol/types/public-lol";
import { setPublicPath } from "../../public-lol/utils/routes";
import { publicAccountI18n, usePublicAccountLogin } from "../../../shared/public-account-login";
import {
  PublicTwitchAccountChip,
} from "../../../shared/PublicTwitchAccountChip";
import { gamesI18n, type GamesLocale } from "../i18n/games-i18n";
import { gamesPathForPage, setGamesUrl, type GamesPage } from "../utils/routes";

/* 상단 nav 와 하단 탭바가 공유하는 단일 원본 — Valorant 헤더 패턴 복제. */
export const gamesNavItems: Array<{ page: GamesPage; ko: string; ja: string }> = [
  { page: "hub", ko: gamesI18n.ko.navHub, ja: gamesI18n.ja.navHub },
  { page: "reaction", ko: gamesI18n.ko.navReaction, ja: gamesI18n.ja.navReaction },
  { page: "ranking", ko: gamesI18n.ko.navRanking, ja: gamesI18n.ja.navRanking },
];

export function GamesNavIcon({ page }: { page: GamesPage }) {
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

  if (page === "hub") return <svg {...commonProps}><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg>;
  if (page === "ranking") return <svg {...commonProps}><path d="M4 21V10m8 11V3m8 18v-7" /></svg>;
  return <svg {...commonProps}><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" /></svg>;
}

export function GamesHeader({
  locale,
  onLocale,
  page,
}: {
  locale: GamesLocale;
  onLocale: (locale: GamesLocale) => void;
  page: GamesPage | null;
}) {
  const [gameSelectorOpen, setGameSelectorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const text = gamesI18n[locale];
  const {
    accountUser,
    loginWithDiscord,
    loginWithTwitch,
    logout: handleAccountLogout,
    openDashboard,
    twitchConfigured,
    yoroConnected,
  } = usePublicAccountLogin();
  const account = publicAccountI18n[locale];

  const closeMenus = useCallback(() => {
    setGameSelectorOpen(false);
    setMobileMenuOpen(false);
    setLocaleMenuOpen(false);
    setAccountMenuOpen(false);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".public-bottom-sheet")) return;
      if (!headerRef.current?.contains(event.target as Node)) closeMenus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenus]);

  function handleGame(nextPage: PublicMainPage): void {
    closeMenus();
    if (nextPage === "games") {
      setGamesUrl("/games");
      return;
    }
    if (nextPage === "palworld") {
      setPublicPath("/palworld");
      return;
    }
    if (nextPage === "valorant") {
      setPublicPath("/valorant");
      return;
    }
    if (nextPage === "minecraft") {
      setPublicPath("/minecraft");
      return;
    }
    if (nextPage === "bot") {
      setPublicPath("/bot");
      return;
    }
    setPublicPath("/");
  }

  const navigation = (
    <PublicHorizontalNav ariaLabel={text.mainMenu} testId="games-secondary-nav">
      {gamesNavItems.map((item) => {
        const active = item.page === page;
        return (
          <button
            className={active ? "active" : ""}
            type="button"
            aria-current={active ? "page" : undefined}
            data-ko={item.ko}
            data-ja={item.ja}
            onClick={() => setGamesUrl(gamesPathForPage(item.page))}
            key={item.page}
          >
            <GamesNavIcon page={item.page} />
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
                  setAccountMenuOpen(false);
                }
              }}
            />
            <PublicTwitchAccountChip
              configured={twitchConfigured}
              connected={yoroConnected}
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
              menuActions={[]}
              menuLabel={account.menu}
              onDashboard={openDashboard}
              onDiscordLogin={loginWithDiscord}
              onLogin={loginWithTwitch}
              onLogout={handleAccountLogout}
              onOpenChange={(open) => {
                setAccountMenuOpen(open);
                if (open) {
                  setGameSelectorOpen(false);
                  setMobileMenuOpen(false);
                  setLocaleMenuOpen(false);
                }
              }}
              open={accountMenuOpen}
              twitchLoginLabel={account.twitchLogin}
              user={accountUser}
            />
          </>
        )}
        brand={(
          <button
            className="public-game-header__brand"
            type="button"
            onClick={() => setGamesUrl("/games")}
            aria-label={text.brand}
          >
            <img
              className="public-game-header__brand-logo"
              src="/images/yorogg-home-logo.webp"
              alt="YORO.gg"
            />
          </button>
        )}
        className="games-header"
        gameSelector={(
          <PublicGameSelector
            activePage="games"
            onPage={handleGame}
            open={gameSelectorOpen}
            onOpenChange={(open) => {
              setGameSelectorOpen(open);
              if (open) {
                setMobileMenuOpen(false);
                setLocaleMenuOpen(false);
                setAccountMenuOpen(false);
              }
            }}
          />
        )}
        home
        mobileMenuToggle={(
          <button
            aria-controls="games-mobile-menu"
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
                  setAccountMenuOpen(false);
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
            <strong data-ko={gamesI18n.ko.mobileMenu} data-ja={gamesI18n.ja.mobileMenu}>
              {text.mobileMenu}
            </strong>
          </button>
        )}
        mobileMenu={(
          <PublicMobileMenuSheet
            accountConnected={yoroConnected}
            accountUser={accountUser}
            activePage="games"
            id="games-mobile-menu"
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
            onTwitchLogout={handleAccountLogout}
            onAccountLogout={handleAccountLogout}
            open={mobileMenuOpen}
            returnFocusRef={mobileMenuTriggerRef}
            twitchActions={[]}
            twitchConfigured={twitchConfigured}
            twitchConnected={false}
          />
        )}
        navigation={navigation}
      />
    </div>
  );
}
