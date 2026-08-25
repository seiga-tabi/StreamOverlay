import type { PublicTwitchFollowedLolResponse } from "../../public-lol/types/public-lol";
import { publicLiveRailState, publicLiveText } from "../../../shared/public-live-streamers";
import {
  PublicGameHomeHero,
} from "../../../shared/PublicGameHome";
import { HomeLiveSection } from "../../public-home/components/HomeSections";
import { homeI18n } from "../../public-home/i18n/home-i18n";
import { palworldI18n, type PalworldLocale, type PalworldTextKey } from "../i18n/palworld-i18n";
import { publicContentLocale } from "../../public-lol/i18n/public-lol-i18n";
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
  followedChannels,
  liveError,
  liveLoading,
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
  /* LoL 홈과 같은 「지금 방송 중」(HomeLiveSection)을 그립니다 — 사용자 요청 2026-08-25.
     카드 뷰모델(PublicLiveStreamerCard)이 아니라 팔로우 응답 원본을 그대로 받습니다.
     HomeLiveSection 이 isLive 필터·4장 상한·스켈레톤·빈 상태를 단일 원본으로 갖습니다. */
  followedChannels: PublicTwitchFollowedLolResponse | null;
  liveError: boolean;
  liveLoading: boolean;
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
  /* LoL 홈의 「지금 방송 중」과 같은 컴포넌트·같은 문구(homeI18n)입니다.
     HomeLiveSection 에는 오류 상태가 없어서(LoL 홈은 조회 실패를 빈 상태로 접습니다)
     그 한 갈래만 기존 rail 문구(public-live-streamers 단일 원본)로 남깁니다 —
     「불러오지 못했습니다 · 다시 시도」는 실제 동작이라 조용히 없애지 않습니다. */
  const railState = publicLiveRailState({ configured: twitchConfigured, connected: twitchConnected, error: liveError });
  /* publicLiveText 는 ko·ja 두 벌이라 publicContentLocale 로 en 을 ko 로 접습니다(기존 rail 과 동일). */
  const railText = (key: "errorTitle" | "errorDescription" | "retry") => publicLiveText(publicContentLocale(locale), key).label;
  const liveContent = railState === "error" ? (
    <section className="yoro-home-section">
      <div className="yoro-home-live-empty" role="alert">
        <p className="yoro-home-live-empty-title">{railText("errorTitle")}</p>
        <p className="yoro-home-live-empty-sub">{railText("errorDescription")}</p>
        <button className="yoro-home-outline-button" onClick={onLiveRetry} type="button">
          {railText("retry")}
        </button>
      </div>
    </section>
  ) : (
    <HomeLiveSection
      connected={twitchConnected}
      followedChannels={followedChannels}
      loading={liveLoading}
      onLoginOpen={onTwitchLogin}
      text={homeI18n[locale]}
      variant="lol"
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
      {/* 레거시 rail 래퍼(.public-game-home__live-strip)는 뺍니다 — HomeLiveSection 이
          .yoro-home-section 으로 자기 여백·제목·전체 보기를 다 갖습니다. */}
      {liveContent}
      <PalworldHomeDashboard
        data={dashboardData}
        locale={locale}
        onNavigate={onNavigate}
        onRetry={retryDashboardData}
      />
    </div>
  );
}
