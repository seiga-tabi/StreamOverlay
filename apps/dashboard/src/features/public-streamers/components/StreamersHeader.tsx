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
import { streamersI18n, type StreamersLocale } from "../i18n/streamers-i18n";
import { publicContentLocale } from "../../public-lol/i18n/public-lol-i18n";
import { usePublicViewerTwitch } from "../hooks/usePublicViewerTwitch";
import {
  STREAMERS_BASE_PATH,
  STREAMER_SCOPES,
  setStreamersUrl,
  streamersScopePath,
  type StreamerScope,
} from "../utils/routes";

/* 이 섹션의 nav 는 게임 범위입니다 — 상단 nav 와 하단 탭바가 같은 원본을 씁니다.
   근거: docs/mockups/streamer-board (게임 선택기로 들어오는 독립 섹션). */
export const streamerScopeItems: Array<{ scope: StreamerScope; ko: string; ja: string }> = [
  { scope: "all", ko: streamersI18n.ko.scopeAll, ja: streamersI18n.ja.scopeAll },
  { scope: "lol", ko: streamersI18n.ko.scopeLol, ja: streamersI18n.ja.scopeLol },
  { scope: "valorant", ko: streamersI18n.ko.scopeValorant, ja: streamersI18n.ja.scopeValorant },
  { scope: "palworld", ko: streamersI18n.ko.scopePalworld, ja: streamersI18n.ja.scopePalworld },
  { scope: "minecraft", ko: streamersI18n.ko.scopeMinecraft, ja: streamersI18n.ja.scopeMinecraft },
];

export function StreamerScopeIcon({ scope }: { scope: StreamerScope }) {
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
  if (scope === "all") return <svg {...commonProps}><rect x="3" y="6" width="14" height="12" rx="2.5" /><path d="M17 11l4-2.6v9.2L17 15" /></svg>;
  return <svg {...commonProps}><circle cx="12" cy="12" r="8.5" /><path d="M12 8v8M8 12h8" /></svg>;
}

export function StreamersHeader({
  locale,
  onLocale,
  scope,
}: {
  locale: StreamersLocale;
  onLocale: (locale: StreamersLocale) => void;
  scope: StreamerScope;
}) {
  const [gameSelectorOpen, setGameSelectorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const text = streamersI18n[locale];
  const viewerTwitch = usePublicViewerTwitch();
  const {
    accountUser,
    loginWithDiscord,
    loginWithTwitch,
    logout: handleAccountLogout,
    openDashboard,
    twitchConfigured,
    accountConnected,
    yoroConnected,
  } = usePublicAccountLogin({
    /* 공개 페이지의 로그인 상태는 계정 세션과 뷰어 세션 둘입니다 — LoL 화면처럼
       둘을 합쳐 봐야 그쪽에서 로그인한 사람이 여기서 비로그인으로 보이지 않습니다. */
    viewerTwitch: {
      connected: viewerTwitch.status.connected,
      ...(viewerTwitch.status.user ? { user: viewerTwitch.status.user } : {}),
      onDisconnect: viewerTwitch.disconnect,
    },
  });
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
    if (nextPage === "streamers") {
      setStreamersUrl(STREAMERS_BASE_PATH);
      return;
    }
    if (nextPage === "games") {
      setPublicPath("/games");
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
    <PublicHorizontalNav ariaLabel={text.mainMenu} testId="streamers-secondary-nav">
      {streamerScopeItems.map((item) => {
        const active = item.scope === scope;
        return (
          <button
            className={active ? "active" : ""}
            type="button"
            aria-current={active ? "page" : undefined}
            data-ko={item.ko}
            data-ja={item.ja}
            onClick={() => setStreamersUrl(streamersScopePath(item.scope))}
            key={item.scope}
          >
            <StreamerScopeIcon scope={item.scope} />
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
            onClick={() => setStreamersUrl(STREAMERS_BASE_PATH)}
            aria-label={text.brand}
          >
            <img
              className="public-game-header__brand-logo"
              src="/images/yorogg-home-logo.webp"
              alt="YORO.gg"
            />
          </button>
        )}
        className="streamers-header"
        gameSelector={(
          <PublicGameSelector
            activePage="streamers"
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
            aria-controls="streamers-mobile-menu"
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
            <strong data-ko={streamersI18n.ko.mobileMenu} data-ja={streamersI18n.ja.mobileMenu}>
              {text.mobileMenu}
            </strong>
          </button>
        )}
        mobileMenu={(
          <PublicMobileMenuSheet
            accountConnected={accountConnected}
            accountUser={accountUser}
            activePage="streamers"
            id="streamers-mobile-menu"
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
