import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PublicGameHeaderFrame, PublicHorizontalNav } from "../../../shared/PublicGameChrome";
import { PublicMobileMenuSheet } from "../../../shared/PublicMobileMenuSheet";
import { PublicTwitchAccountChip, type PublicTwitchAccountMenuAction } from "../../../shared/PublicTwitchAccountChip";
import { PublicGameSelector } from "../../public-lol/components/PublicGameSelector";
import { PublicLocaleSelector } from "../../public-lol/components/PublicLocaleSelector";
import type { PublicMainPage, PublicTwitchViewerStatus } from "../../public-lol/types/public-lol";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { palworldPathForPage, setPalworldUrl, type PalworldPage } from "../utils/routes";

const navItems: Array<{ page: Exclude<PalworldPage, "search">; ko: string; ja: string }> = [
  { page: "home", ko: palworldI18n.ko.home, ja: palworldI18n.ja.home },
  { page: "pals", ko: palworldI18n.ko.pals, ja: palworldI18n.ja.pals },
  { page: "breeding", ko: palworldI18n.ko.breeding, ja: palworldI18n.ja.breeding },
  { page: "items", ko: palworldI18n.ko.items, ja: palworldI18n.ja.items },
  { page: "technology", ko: palworldI18n.ko.technology, ja: palworldI18n.ja.technology },
  { page: "skills", ko: palworldI18n.ko.skills, ja: palworldI18n.ja.skills },
  { page: "map", ko: palworldI18n.ko.map, ja: palworldI18n.ja.map },
];

function PalworldNavIcon({ page }: { page: Exclude<PalworldPage, "search"> }) {
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
  onStreamerDashboard = () => undefined,
  onTwitchLogin = () => undefined,
  onTwitchLogout = () => undefined,
}: {
  locale: PalworldLocale;
  onLocale: (locale: PalworldLocale) => void;
  page: PalworldPage;
  searchContent?: ReactNode;
  twitchStatus?: PublicTwitchViewerStatus;
  onStreamerDashboard?: () => void;
  onTwitchLogin?: () => void;
  onTwitchLogout?: () => void;
}) {
  const [gameSelectorOpen, setGameSelectorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [twitchMenuOpen, setTwitchMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const text = palworldI18n[locale];

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
      if (event.key === "Escape") closeMenus();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenus]);

  const twitchMenuActions: PublicTwitchAccountMenuAction[] = twitchStatus.streamerRiotRequest?.status === "approved"
    && twitchStatus.streamerRiotRequest.dashboardEnabled === true
    ? [{
      id: "dashboard",
      label: (
        <span
          data-ko={palworldI18n.ko.streamerDashboardOpen}
          data-ja={palworldI18n.ja.streamerDashboardOpen}
        >
          {text.streamerDashboardOpen}
        </span>
      ),
      onSelect: onStreamerDashboard,
      variant: "dashboard",
    }]
    : [];

  function handleGame(nextPage: PublicMainPage): void {
    closeMenus();
    if (nextPage === "palworld") {
      setPalworldUrl("/palworld");
      return;
    }
    if (nextPage === "bot") {
      window.history.pushState({}, "", "/bot");
      window.dispatchEvent(new CustomEvent("publicroutechange"));
      return;
    }
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new CustomEvent("publicroutechange"));
  }

  const navigation = (
    <PublicHorizontalNav ariaLabel={text.mainMenu} testId="palworld-secondary-nav">
      {navItems.map((item) => {
        const active = item.page === page || (page === "search" && item.page === "home");
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
              connected={twitchStatus.connected}
              loginLabel={text.twitchLogin}
              loginLabelJa={palworldI18n.ja.twitchLogin}
              loginLabelKo={palworldI18n.ko.twitchLogin}
              loginTitle={text.twitchLoginTitle}
              logoutLabel={text.twitchLogout}
              logoutLabelJa={palworldI18n.ja.twitchLogout}
              logoutLabelKo={palworldI18n.ko.twitchLogout}
              menuActions={twitchMenuActions}
              menuLabel={text.twitchProfileMenu}
              onLogin={onTwitchLogin}
              onLogout={onTwitchLogout}
              onOpenChange={(open) => {
                setTwitchMenuOpen(open);
                if (open) {
                  setGameSelectorOpen(false);
                  setMobileMenuOpen(false);
                  setLocaleMenuOpen(false);
                }
              }}
              open={twitchMenuOpen}
              user={twitchStatus.user}
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
            activePage="palworld"
            id="palworld-mobile-menu"
            labels={{
              close: text.closeMobileMenu,
              game: text.gameMenu,
              language: text.languageSection,
              login: text.twitchLogin,
              loginLoading: text.twitchLoginLoading,
              logout: text.twitchLogout,
              title: text.mobileMenu,
              twitch: text.twitchAccount,
              twitchUnavailable: text.twitchNotConfiguredDescription,
            }}
            locale={locale}
            onClose={() => setMobileMenuOpen(false)}
            onGamePage={handleGame}
            onLocale={onLocale}
            onTwitchLogin={onTwitchLogin}
            onTwitchLogout={onTwitchLogout}
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
