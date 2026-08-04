import type { PublicLiveStreamerCard, PublicLiveStreamerRailState } from "../../../shared/PublicLiveStreamerRail";
import { PublicLiveStreamerRail } from "../../../shared/PublicLiveStreamerRail";
import {
  PublicGameHomeHero,
} from "../../../shared/PublicGameHome";
import { palworldI18n, type PalworldLocale, type PalworldTextKey } from "../i18n/palworld-i18n";
import {
  PalworldHomeDashboard,
  PalworldHomeQuickSearch,
  usePalworldHomeDashboardData,
} from "./PalworldHomeDashboard";
import { PalworldSearchForm } from "./PalworldSearchForm";

function localizedText(locale: PalworldLocale, key: PalworldTextKey) {
  return {
    label: palworldI18n[locale][key],
    ko: palworldI18n.ko[key],
    ja: palworldI18n.ja[key],
  };
}

export function PalworldHome({
  liveError,
  liveLoading,
  liveStreamers,
  onLiveRetry,
  onOpenItem,
  onOpenPal,
  onNavigate,
  onSearch,
  onTwitchLogin,
  twitchConfigured,
  twitchConnected,
  locale,
}: {
  liveError: boolean;
  liveLoading: boolean;
  liveStreamers: PublicLiveStreamerCard[];
  locale: PalworldLocale;
  onLiveRetry: () => void;
  onOpenItem: (id: string) => void;
  onOpenPal: (id: string) => void;
  onNavigate: (href: string) => void;
  onSearch: (query: string) => void;
  onTwitchLogin: () => void;
  twitchConfigured: boolean;
  twitchConnected: boolean;
}) {
  const text = palworldI18n[locale];
  const { data: dashboardData, retry: retryDashboardData } = usePalworldHomeDashboardData(locale);
  const liveState: PublicLiveStreamerRailState = liveError
    ? "error"
    : !twitchConfigured
      ? "not-configured"
      : !twitchConnected
        ? "login-required"
        : "ready";

  const liveContent = <PublicLiveStreamerRail
      emptyDescription={localizedText(locale, "noLiveStreamersDescription")}
      emptyTitle={localizedText(locale, liveError ? "twitchErrorTitle" : "noLiveStreamers")}
      errorDescription={localizedText(locale, "twitchErrorDescription")}
      loading={liveLoading}
      loadingLabel={localizedText(locale, "loadingStreamers")}
      loginAction={localizedText(locale, "twitchLogin")}
      loginDescription={localizedText(locale, "twitchLoginDescription")}
      loginTitle={localizedText(locale, "twitchLoginTitle")}
      notConfiguredDescription={localizedText(locale, "twitchNotConfiguredDescription")}
      notConfiguredTitle={localizedText(locale, "twitchNotConfiguredTitle")}
      onLogin={onTwitchLogin}
      onRetry={onLiveRetry}
      previous={localizedText(locale, "livePrevious")}
      retryAction={localizedText(locale, "retryTwitch")}
      state={liveState}
      streamers={liveStreamers}
      title={localizedText(locale, "followedLiveTitle")}
      next={localizedText(locale, "liveNext")}
      viewAll={localizedText(locale, "viewAll")}
      watch={localizedText(locale, "watchStream")}
    />;

  return (
    <div className="palworld-home-content">
      <PublicGameHomeHero
        description={localizedText(locale, "homeHeroDescription")}
        eyebrow={localizedText(locale, "homeEyebrow")}
        game="palworld"
        search={(
          <PalworldSearchForm
            locale={locale}
            variant="hero"
            onSearch={onSearch}
            onPal={(pal) => onOpenPal(pal.id)}
            onItem={(item) => onOpenItem(item.id)}
          />
        )}
        title={localizedText(locale, "homeHeroTitle")}
      >
        <PalworldHomeQuickSearch
          data={dashboardData}
          locale={locale}
          onOpenItem={onOpenItem}
          onOpenPal={onOpenPal}
        />
      </PublicGameHomeHero>
      <div className="public-game-home__live-strip">
        {liveContent}
      </div>
      <PalworldHomeDashboard
        data={dashboardData}
        locale={locale}
        onNavigate={onNavigate}
        onRetry={retryDashboardData}
      />
    </div>
  );
}
