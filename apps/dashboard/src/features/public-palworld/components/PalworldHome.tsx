import type { PublicLiveStreamerCard } from "../../../shared/PublicLiveStreamerRail";
import { PublicFollowedLiveRail } from "../../../shared/public-live-streamers";
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
  /* 문구·상태 산출은 shared/public-live-streamers.tsx 가 단일 원본입니다. */
  const liveContent = (
    <PublicFollowedLiveRail
      configured={twitchConfigured}
      connected={twitchConnected}
      error={liveError}
      loading={liveLoading}
      locale={locale}
      onLogin={onTwitchLogin}
      onRetry={onLiveRetry}
      streamers={liveStreamers}
    />
  );

  return (
    <div className="palworld-home-content">
      <PublicGameHomeHero
        description={localizedText(locale, "homeHeroDescription")}
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
