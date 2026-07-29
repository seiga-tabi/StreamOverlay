import type { RefObject } from "react";
import { PublicGameSelector } from "../features/public-lol/components/PublicGameSelector";
import { PublicLocaleOptions } from "../features/public-lol/components/PublicLocaleSelector";
import type { PublicLocale } from "../features/public-lol/i18n/public-lol-i18n";
import type { PublicMainPage } from "../features/public-lol/types/public-lol";
import {
  PublicTwitchAccountPanel,
  type PublicTwitchAccountMenuAction,
  type PublicTwitchAccountUser,
} from "./PublicTwitchAccountChip";
import { BottomSheet } from "./ui/BottomSheet";

export type PublicMobileMenuLabels = {
  discordLogin: string;
  close: string;
  game: string;
  language: string;
  login: string;
  loginLoading: string;
  title: string;
  twitch: string;
  twitchLogin: string;
  twitchUnavailable: string;
  logout: string;
};

export function PublicMobileMenuSheet({
  activePage,
  labels,
  locale,
  onClose,
  onGamePage,
  onLocale,
  onDiscordLogin,
  onTwitchLogin,
  onTwitchLogout,
  onAccountLogout,
  open,
  returnFocusRef,
  accountConnected,
  accountUser,
  twitchActions,
  twitchConfigured,
  twitchConnected,
  twitchLoginLoading = false,
  twitchUser,
  id,
}: {
  activePage: PublicMainPage;
  id: string;
  labels: PublicMobileMenuLabels;
  locale: PublicLocale;
  onClose: () => void;
  onGamePage: (page: PublicMainPage) => void;
  onLocale: (locale: PublicLocale) => void;
  onDiscordLogin: () => void;
  onTwitchLogin: () => void;
  onTwitchLogout: () => void;
  onAccountLogout?: () => void;
  open: boolean;
  returnFocusRef?: RefObject<HTMLElement>;
  accountConnected?: boolean;
  accountUser?: PublicTwitchAccountUser;
  twitchActions?: PublicTwitchAccountMenuAction[];
  twitchConfigured: boolean;
  twitchConnected: boolean;
  twitchLoginLoading?: boolean;
  twitchUser?: PublicTwitchAccountUser;
}) {
  return (
    <BottomSheet
      className={activePage === "palworld" ? "public-bottom-sheet--palworld" : "public-bottom-sheet--lol"}
      closeLabel={labels.close}
      id={id}
      onClose={onClose}
      open={open}
      returnFocusRef={returnFocusRef}
      title={labels.title}
    >
      <div className="public-mobile-menu">
        <section className="public-mobile-menu__section">
          <h3>{labels.game}</h3>
          <PublicGameSelector
            activePage={activePage}
            mode="tray"
            onPage={(page) => {
              onClose();
              onGamePage(page);
            }}
          />
        </section>
        <section className="public-mobile-menu__section">
          <h3>{labels.language}</h3>
          <PublicLocaleOptions
            ariaLabel={labels.language}
            locale={locale}
            onLocale={onLocale}
          />
        </section>
        <section className="public-mobile-menu__section">
          <h3>{labels.twitch}</h3>
          <PublicTwitchAccountPanel
            configured={twitchConfigured}
            connected={accountConnected ?? twitchConnected}
            discordLoginLabel={labels.discordLogin}
            loginLabel={labels.login}
            loginLoading={twitchLoginLoading}
            loginLoadingLabel={labels.loginLoading}
            logoutLabel={labels.logout}
            menuActions={twitchActions}
            onAction={onClose}
            onDiscordLogin={onDiscordLogin}
            onLogin={onTwitchLogin}
            onLogout={onAccountLogout ?? onTwitchLogout}
            twitchLoginLabel={labels.twitchLogin}
            unavailableLabel={labels.twitchUnavailable}
            user={accountUser ?? twitchUser}
          />
        </section>
      </div>
    </BottomSheet>
  );
}
