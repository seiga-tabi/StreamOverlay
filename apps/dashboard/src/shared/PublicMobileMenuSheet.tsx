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
  close: string;
  game: string;
  language: string;
  login: string;
  loginLoading: string;
  title: string;
  twitch: string;
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
  onTwitchLogin,
  onTwitchLogout,
  open,
  returnFocusRef,
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
  onTwitchLogin: () => void;
  onTwitchLogout: () => void;
  open: boolean;
  returnFocusRef?: RefObject<HTMLElement>;
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
            connected={twitchConnected}
            loginLabel={labels.login}
            loginLoading={twitchLoginLoading}
            loginLoadingLabel={labels.loginLoading}
            logoutLabel={labels.logout}
            menuActions={twitchActions}
            onAction={onClose}
            onLogin={onTwitchLogin}
            onLogout={onTwitchLogout}
            unavailableLabel={labels.twitchUnavailable}
            user={twitchUser}
          />
        </section>
      </div>
    </BottomSheet>
  );
}
