import { useCallback, useEffect, useRef, useState } from "react";
import { trackGoogleAnalyticsEvent } from "../../../analytics/google-analytics";
import { PublicGameHeaderFrame, PublicHorizontalNav } from "../../../shared/PublicGameChrome";
import { PublicMobileMenuSheet } from "../../../shared/PublicMobileMenuSheet";
import {
  PublicTwitchAccountChip,
  type PublicTwitchAccountUser,
} from "../../../shared/PublicTwitchAccountChip";
import { PublicGameSelector } from "../../public-lol/components/PublicGameSelector";
import { PublicLocaleSelector } from "../../public-lol/components/PublicLocaleSelector";
import type { PublicMainPage } from "../../public-lol/types/public-lol";
import { setPublicPath } from "../../public-lol/utils/routes";
import { accountOAuthUrl, openYoroDashboard } from "../../yoro-account/api";
import {
  authenticatedYoroIdentity,
  useYoroAccountSession,
} from "../../yoro-account/useYoroAccountSession";
import { valorantI18n, type ValorantLocale } from "../i18n/valorant-i18n";
import { setValorantUrl, valorantPathForPage, type ValorantPage } from "../utils/routes";

/* 상단 nav 와 하단 탭바가 공유하는 단일 원본 — 라벨·순서·활성 판정이 어긋나지 않게. */
export const valorantNavItems: Array<{ page: ValorantPage; ko: string; ja: string }> = [
  { page: "home", ko: valorantI18n.ko.home, ja: valorantI18n.ja.home },
  { page: "agents", ko: valorantI18n.ko.agents, ja: valorantI18n.ja.agents },
  { page: "weapons", ko: valorantI18n.ko.weapons, ja: valorantI18n.ja.weapons },
  { page: "maps", ko: valorantI18n.ko.maps, ja: valorantI18n.ja.maps },
  { page: "ranked", ko: valorantI18n.ko.ranked, ja: valorantI18n.ja.ranked },
];

export function ValorantNavIcon({ page }: { page: ValorantPage }) {
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
  if (page === "agents") return <svg {...commonProps}><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" /></svg>;
  if (page === "weapons") return <svg {...commonProps}><path d="M3 17 17 3l4 4L7 21l-4-4Zm10-10 4 4M5 15l4 4" /></svg>;
  if (page === "maps") return <svg {...commonProps}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  return <svg {...commonProps}><path d="M8 21h8m-4-4v4M5 4h14v3a7 7 0 0 1-14 0V4Zm-2 2H1v1a4 4 0 0 0 4 4M21 6h2v1a4 4 0 0 1-4 4" /></svg>;
}

export function ValorantHeader({
  locale,
  onLocale,
  page,
}: {
  locale: ValorantLocale;
  onLocale: (locale: ValorantLocale) => void;
  page: ValorantPage | null;
}) {
  const [gameSelectorOpen, setGameSelectorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const yoroAccount = useYoroAccountSession();
  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const text = valorantI18n[locale];
  const yoroIdentity = authenticatedYoroIdentity(yoroAccount.session);
  const yoroConnected = yoroAccount.session?.authenticated === true;
  const accountUser: PublicTwitchAccountUser | undefined = yoroIdentity
    ? {
      displayName: yoroIdentity.displayName,
      provider: yoroIdentity.provider,
      linkedProviders: yoroAccount.session?.authenticated
        ? yoroAccount.session.identities.map((identity) => identity.provider)
        : [yoroIdentity.provider],
      ...(yoroIdentity.avatarUrl ? { profileImageUrl: yoroIdentity.avatarUrl } : {}),
    }
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
    void yoroAccount.logout().catch(() => {
      /* 로그아웃 실패 시 연결 표시를 유지해 다시 시도할 수 있게 합니다. */
    });
  };

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
    if (nextPage === "valorant") {
      setValorantUrl("/valorant");
      return;
    }
    if (nextPage === "palworld") {
      setPublicPath("/palworld");
      return;
    }
    if (nextPage === "bot") {
      setPublicPath("/bot");
      return;
    }
    setPublicPath("/");
  }

  const navigation = (
    <PublicHorizontalNav ariaLabel={text.mainMenu} testId="valorant-secondary-nav">
      {valorantNavItems.map((item) => {
        const active = item.page === page;
        return (
          <button
            className={active ? "active" : ""}
            type="button"
            aria-current={active ? "page" : undefined}
            data-ko={item.ko}
            data-ja={item.ja}
            onClick={() => setValorantUrl(valorantPathForPage(item.page))}
            key={item.page}
          >
            <ValorantNavIcon page={item.page} />
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
              configured={false}
              connected={yoroConnected}
              dashboardLabel={text.yoroDashboardOpen}
              dashboardLabelJa={valorantI18n.ja.yoroDashboardOpen}
              dashboardLabelKo={valorantI18n.ko.yoroDashboardOpen}
              discordLoginLabel={text.discordLogin}
              loginLabel={text.accountLogin}
              loginLabelJa={valorantI18n.ja.accountLogin}
              loginLabelKo={valorantI18n.ko.accountLogin}
              loginMenuLabel={text.accountLoginMenu}
              loginTitle={text.accountLoginTitle}
              logoutLabel={text.accountLogout}
              logoutLabelJa={valorantI18n.ja.accountLogout}
              logoutLabelKo={valorantI18n.ko.accountLogout}
              menuActions={[]}
              menuLabel={text.accountMenu}
              onDashboard={openYoroDashboard}
              onDiscordLogin={handleDiscordLogin}
              onLogin={handleTwitchAccountLogin}
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
              twitchLoginLabel={text.twitchLoginChoice}
              user={accountUser}
            />
          </>
        )}
        brand={(
          <button
            className="public-game-header__brand"
            type="button"
            onClick={() => setValorantUrl("/valorant")}
            aria-label={text.home}
          >
            <img
              className="public-game-header__brand-logo"
              src="/images/yorogg-home-logo.webp"
              alt="YORO.gg"
            />
          </button>
        )}
        className="valorant-header"
        gameSelector={(
          <PublicGameSelector
            activePage="valorant"
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
            aria-controls="valorant-mobile-menu"
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
            <strong data-ko={valorantI18n.ko.mobileMenu} data-ja={valorantI18n.ja.mobileMenu}>
              {text.mobileMenu}
            </strong>
          </button>
        )}
        mobileMenu={(
          <PublicMobileMenuSheet
            accountConnected={yoroConnected}
            accountUser={accountUser}
            activePage="valorant"
            id="valorant-mobile-menu"
            labels={{
              close: text.closeMobileMenu,
              dashboard: text.yoroDashboardOpen,
              discordLogin: text.discordLogin,
              game: text.gameMenu,
              language: text.languageSection,
              login: text.accountLogin,
              loginLoading: text.twitchLoginLoading,
              logout: text.accountLogout,
              title: text.mobileMenu,
              twitch: text.account,
              twitchLogin: text.twitchLoginChoice,
              twitchUnavailable: text.twitchNotConfiguredDescription,
            }}
            locale={locale}
            onClose={() => setMobileMenuOpen(false)}
            onGamePage={handleGame}
            onLocale={onLocale}
            onDiscordLogin={handleDiscordLogin}
            onDashboard={openYoroDashboard}
            onTwitchLogin={handleTwitchAccountLogin}
            onTwitchLogout={handleAccountLogout}
            onAccountLogout={handleAccountLogout}
            open={mobileMenuOpen}
            returnFocusRef={mobileMenuTriggerRef}
            twitchActions={[]}
            twitchConfigured={false}
            twitchConnected={false}
          />
        )}
        navigation={navigation}
      />
    </div>
  );
}
