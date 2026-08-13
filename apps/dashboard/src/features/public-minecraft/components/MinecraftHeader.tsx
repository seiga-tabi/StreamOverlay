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
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { setMinecraftUrl, minecraftPathForPage, type MinecraftPage } from "../utils/routes";

/* 상단 nav 와 하단 탭바가 공유하는 단일 원본 — 라벨·순서·활성 판정이 어긋나지 않게. */
export const minecraftNavItems: Array<{ page: MinecraftPage; ko: string; ja: string }> = [
  { page: "home", ko: minecraftI18n.ko.home, ja: minecraftI18n.ja.home },
  { page: "recipes", ko: minecraftI18n.ko.recipes, ja: minecraftI18n.ja.recipes },
  { page: "items", ko: minecraftI18n.ko.items, ja: minecraftI18n.ja.items },
  { page: "enchants", ko: minecraftI18n.ko.enchants, ja: minecraftI18n.ja.enchants },
  { page: "library", ko: minecraftI18n.ko.library, ja: minecraftI18n.ja.library },
  { page: "patchNotes", ko: minecraftI18n.ko.patchNotes, ja: minecraftI18n.ja.patchNotes },
];

/* 하단 탭바는 5칸 규칙 — 인챈트는 상단 nav 와 위키 홈 타일로 접근합니다. */
export const minecraftTabItems = minecraftNavItems.filter((item) => item.page !== "enchants");

export function MinecraftNavIcon({ page }: { page: MinecraftPage }) {
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

  if (page === "home") return <svg {...commonProps}><path d="M4 8h16v12H4Zm0 0 8-5 8 5M9 13h2v2H9Zm4 0h2v2h-2Z" /></svg>;
  if (page === "recipes") return <svg {...commonProps}><path d="M4 4h16v16H4Zm5.3 0v16M14.6 4v16M4 9.3h16M4 14.6h16" /></svg>;
  if (page === "items") return <svg {...commonProps}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Zm0 0v9m8-4.5L12 12M4 7.5 12 12" /></svg>;
  if (page === "enchants") return <svg {...commonProps}><path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>;
  if (page === "library") return <svg {...commonProps}><path d="M4 7h16v13H4Zm0 0 2-4h12l2 4M10 11h4" /></svg>;
  return <svg {...commonProps}><path d="M6 3h9l4 4v14H6Zm9 0v4h4M9 12h6M9 16h6" /></svg>;
}

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
  const yoroAccount = useYoroAccountSession();
  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const text = minecraftI18n[locale];
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
    setPublicPath("/");
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
              dashboardLabelJa={minecraftI18n.ja.yoroDashboardOpen}
              dashboardLabelKo={minecraftI18n.ko.yoroDashboardOpen}
              discordLoginLabel={text.discordLogin}
              loginLabel={text.accountLogin}
              loginLabelJa={minecraftI18n.ja.accountLogin}
              loginLabelKo={minecraftI18n.ko.accountLogin}
              loginMenuLabel={text.accountLoginMenu}
              loginTitle={text.accountLoginTitle}
              logoutLabel={text.accountLogout}
              logoutLabelJa={minecraftI18n.ja.accountLogout}
              logoutLabelKo={minecraftI18n.ko.accountLogout}
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
