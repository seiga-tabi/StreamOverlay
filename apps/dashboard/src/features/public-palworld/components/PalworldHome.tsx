import type { PublicLiveStreamerCard, PublicLiveStreamerRailState } from "../../../shared/PublicLiveStreamerRail";
import { PublicLiveStreamerRail } from "../../../shared/PublicLiveStreamerRail";
import { palworldI18n, type PalworldLocale, type PalworldTextKey } from "../i18n/palworld-i18n";
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
  onSearch,
  onShowStreamers,
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
  onSearch: (query: string) => void;
  onShowStreamers: () => void;
  onTwitchLogin: () => void;
  twitchConfigured: boolean;
  twitchConnected: boolean;
}) {
  const text = palworldI18n[locale];
  const liveState: PublicLiveStreamerRailState = liveError
    ? "error"
    : !twitchConfigured
      ? "not-configured"
      : !twitchConnected
        ? "login-required"
        : "ready";

  return <>
    <section className="palworld-hero" aria-labelledby="palworld-home-title">
      <span className="palworld-hero-mark" aria-hidden="true">{text.homeKicker}</span>
      <h1 id="palworld-home-title" data-ko={palworldI18n.ko.brand} data-ja={palworldI18n.ja.brand}>{text.brand}</h1>
      <p data-ko={palworldI18n.ko.description} data-ja={palworldI18n.ja.description}>{text.description}</p>
      <PalworldSearchForm locale={locale} variant="hero" onSearch={onSearch} onPal={(pal) => onOpenPal(pal.id)} onItem={(item) => onOpenItem(item.id)} />
    </section>
    <PublicLiveStreamerRail
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
      onViewAll={onShowStreamers}
      retryAction={localizedText(locale, "retryTwitch")}
      state={liveState}
      streamers={liveStreamers}
      title={localizedText(locale, "followedLiveTitle")}
      viewAll={localizedText(locale, "viewAll")}
      watch={localizedText(locale, "watchStream")}
    />
  </>;
}
