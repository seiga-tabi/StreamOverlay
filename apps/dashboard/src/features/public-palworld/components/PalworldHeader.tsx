import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { trackGoogleAnalyticsEvent } from "../../../analytics/google-analytics";
import { PublicGameHeaderFrame, PublicHorizontalNav } from "../../../shared/PublicGameChrome";
import { PublicMobileMenuSheet } from "../../../shared/PublicMobileMenuSheet";
import {
  PublicTwitchAccountChip,
  type PublicTwitchAccountMenuAction,
  type PublicTwitchAccountUser
} from "../../../shared/PublicTwitchAccountChip";
import { PublicGameSelector } from "../../public-lol/components/PublicGameSelector";
import { PublicLocaleSelector } from "../../public-lol/components/PublicLocaleSelector";
import type { PublicMainPage, PublicTwitchViewerStatus } from "../../public-lol/types/public-lol";
import { setPublicPath } from "../../public-lol/utils/routes";
import { accountOAuthUrl, openYoroDashboard } from "../../yoro-account/api";
import {
  authenticatedYoroIdentity,
  useYoroAccountSession
} from "../../yoro-account/useYoroAccountSession";
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
  onTwitchLogin = () => undefined,
  onTwitchLogout = () => undefined,
}: {
  locale: PalworldLocale;
  onLocale: (locale: PalworldLocale) => void;
  page: PalworldPage;
  searchContent?: ReactNode;
  twitchStatus?: PublicTwitchViewerStatus;
  onTwitchLogin?: () => void;
  onTwitchLogout?: () => void;
}) {
  const [gameSelectorOpen, setGameSelectorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [twitchMenuOpen, setTwitchMenuOpen] = useState(false);
  const yoroAccount = useYoroAccountSession();
  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const text = palworldI18n[locale];
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
              configured={twitchStatus.configured}
              connected={accountConnected}
              dashboardLabel={text.yoroDashboardOpen}
              dashboardLabelJa={palworldI18n.ja.yoroDashboardOpen}
              dashboardLabelKo={palworldI18n.ko.yoroDashboardOpen}
              discordLoginLabel={text.discordLogin}
              loginLabel={text.accountLogin}
              loginLabelJa={palworldI18n.ja.accountLogin}
              loginLabelKo={palworldI18n.ko.accountLogin}
              loginMenuLabel={text.accountLoginMenu}
              loginTitle={text.accountLoginTitle}
              logoutLabel={text.accountLogout}
              logoutLabelJa={palworldI18n.ja.accountLogout}
              logoutLabelKo={palworldI18n.ko.accountLogout}
              menuActions={twitchMenuActions}
              menuLabel={text.accountMenu}
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
                }
              }}
              open={twitchMenuOpen}
              twitchLoginLabel={text.twitchLoginChoice}
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
        navigation={navigation}
        search={searchContent}
      />
    </div>
  );
}
