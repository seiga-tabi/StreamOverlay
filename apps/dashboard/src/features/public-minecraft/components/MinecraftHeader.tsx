import { useCallback, useEffect, useRef, useState } from "react";
import { PublicGameHeaderFrame, PublicHorizontalNav } from "../../../shared/PublicGameChrome";
import { PublicMobileMenuSheet } from "../../../shared/PublicMobileMenuSheet";
import {
  PublicTwitchAccountChip,
  type PublicTwitchAccountUser,
} from "../../../shared/PublicTwitchAccountChip";
import { PublicGameSelector } from "../../public-lol/components/PublicGameSelector";
import { PublicLocaleSelector } from "../../public-lol/components/PublicLocaleSelector";
import type { PublicMainPage } from "../../public-lol/types/public-lol";
import { PUBLIC_LOL_HOME_PATH, setPublicPath } from "../../public-lol/utils/routes";
import { publicAccountI18n, usePublicAccountLogin } from "../../../shared/public-account-login";
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { publicContentLocale } from "../../public-lol/i18n/public-locale";
import { setMinecraftUrl, minecraftPathForPage, type MinecraftPage } from "../utils/routes";

import { minecraftNavItems } from "./minecraft-navigation";
import { MinecraftNavIcon } from "./MinecraftNavIcon";

export { minecraftNavItems, minecraftTabItems } from "./minecraft-navigation";
export { MinecraftNavIcon } from "./MinecraftNavIcon";

export function MinecraftHeader({
  locale,
  onLocale,
  page,
}: {
  locale: MinecraftLocale;
  onLocale: (locale: MinecraftLocale) => void;
  page: MinecraftPage | null;
}) {
  const [gameSelectorOpen, setGameSelectorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const text = minecraftI18n[locale];
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
    if (nextPage === "minecraft") {
      setMinecraftUrl("/minecraft");
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
    if (nextPage === "bot") {
      setPublicPath("/bot");
      return;
    }
    setPublicPath(PUBLIC_LOL_HOME_PATH);
  }

  const navigation = (
    <PublicHorizontalNav ariaLabel={text.mainMenu} testId="minecraft-secondary-nav">
      {minecraftNavItems.map((item) => {
        const active = item.page === page;
        return (
          <button
            className={active ? "active" : ""}
            type="button"
            aria-current={active ? "page" : undefined}
            data-ko={item.ko}
            data-ja={item.ja}
            onClick={() => setMinecraftUrl(minecraftPathForPage(item.page))}
            key={item.page}
          >
            <MinecraftNavIcon page={item.page} />
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
              onLocale={(next) => onLocale(publicContentLocale(next))}
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
            onClick={() => setMinecraftUrl("/minecraft")}
            aria-label={text.home}
          >
            <img
              className="public-game-header__brand-logo"
              src="/images/yorogg-home-logo.webp"
              alt="YORO.gg"
            />
          </button>
        )}
        className="minecraft-header"
        gameSelector={(
          <PublicGameSelector
            activePage="minecraft"
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
            aria-controls="minecraft-mobile-menu"
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
            <strong data-ko={minecraftI18n.ko.mobileMenu} data-ja={minecraftI18n.ja.mobileMenu}>
              {text.mobileMenu}
            </strong>
          </button>
        )}
        mobileMenu={(
          <PublicMobileMenuSheet
            accountConnected={yoroConnected}
            accountUser={accountUser}
            activePage="minecraft"
            id="minecraft-mobile-menu"
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
            onLocale={(next) => onLocale(publicContentLocale(next))}
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
