import type { ReactNode } from "react";
import {
  PublicLiveStreamerRail,
  type PublicLiveStreamerCard,
} from "../../../shared/PublicLiveStreamerRail";
import {
  PublicGameHomeHero,
  PublicHomeFeatureCard,
  PublicHomeFeaturePanel,
} from "../../../shared/PublicGameHome";
import type { PublicMainPage } from "../types/public-lol";

export type PublicHomeSearchPanelLocalizedText = {
  label: string;
  ko: string;
  ja: string;
};

export type PublicHomeSearchPanelText = {
  eyebrow: PublicHomeSearchPanelLocalizedText;
  title: PublicHomeSearchPanelLocalizedText;
  description: PublicHomeSearchPanelLocalizedText;
  loadingStatus: PublicHomeSearchPanelLocalizedText;
  readyStatus: PublicHomeSearchPanelLocalizedText;
  guideTitle: PublicHomeSearchPanelLocalizedText;
  guideDescription: PublicHomeSearchPanelLocalizedText;
  liveTitle: PublicHomeSearchPanelLocalizedText;
  livePrevious: PublicHomeSearchPanelLocalizedText;
  liveNext: PublicHomeSearchPanelLocalizedText;
  liveViewAll: PublicHomeSearchPanelLocalizedText;
  liveWatch: PublicHomeSearchPanelLocalizedText;
  liveEmptyTitle: PublicHomeSearchPanelLocalizedText;
  liveEmptyDescription: PublicHomeSearchPanelLocalizedText;
  primaryFeaturesTitle?: PublicHomeSearchPanelLocalizedText;
  participationTitle?: PublicHomeSearchPanelLocalizedText;
  participationDescription?: PublicHomeSearchPanelLocalizedText;
  aramTitle?: PublicHomeSearchPanelLocalizedText;
  aramDescription?: PublicHomeSearchPanelLocalizedText;
  communityTitle?: PublicHomeSearchPanelLocalizedText;
  communityDescription?: PublicHomeSearchPanelLocalizedText;
  streamerTitle?: PublicHomeSearchPanelLocalizedText;
  streamerDescription?: PublicHomeSearchPanelLocalizedText;
  additionalFeaturesTitle?: PublicHomeSearchPanelLocalizedText;
};

export type PublicHomeLiveStreamer = PublicLiveStreamerCard;

/* 기능 카드 아이콘. stroke 관련 값은 .public-game-home__feature-visual svg가 지정하므로
   여기서는 형태만 정의합니다(팰월드 홈의 PalworldHomeIcon과 같은 방식). */
function PublicHomeFeatureIcon({
  kind,
}: {
  kind: "aram" | "community" | "participation" | "streamer";
}) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    height: 32,
    viewBox: "0 0 24 24",
    width: 32,
  };
  if (kind === "participation") {
    return <svg {...common}><path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" /><circle cx="9" cy="7" r="4" /><path d="M17 11h5m-2.5-2.5v5" /></svg>;
  }
  if (kind === "aram") {
    return <svg {...common}><path d="m12 3 2.2 5.1L20 9.3l-4 3.9.9 5.8-4.9-2.7-4.9 2.7.9-5.8-4-3.9 5.8-1.2L12 3Z" /></svg>;
  }
  if (kind === "community") {
    return <svg {...common}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5.4A8 8 0 1 1 21 12Z" /><path d="M9 11h.01M12 11h.01M15 11h.01" /></svg>;
  }
  return <svg {...common}><rect height="12" rx="2" width="16" x="2" y="6" /><path d="m18 12 4-2.5v7L18 14" /><circle cx="7" cy="12" r="1.6" /></svg>;
}

export function PublicHomeSearchPanel({
  liveLoading = false,
  liveStreamers,
  onPage,
  onShowStreamers,
  searchForm,
  text,
}: {
  liveLoading?: boolean;
  liveStreamers: PublicHomeLiveStreamer[];
  loading: boolean;
  onPage: (page: PublicMainPage) => void;
  onShowStreamers?: () => void;
  searchForm: ReactNode;
  text: PublicHomeSearchPanelText;
}) {
  const liveContent = (
    <PublicLiveStreamerRail
      emptyDescription={text.liveEmptyDescription}
      emptyTitle={text.liveEmptyTitle}
      loading={liveLoading}
      loadingLabel={text.loadingStatus}
      onViewAll={onShowStreamers}
      previous={text.livePrevious}
      streamers={liveStreamers}
      title={text.liveTitle}
      next={text.liveNext}
      viewAll={text.liveViewAll}
      watch={text.liveWatch}
    />
  );

  const featureCards = [
    text.participationTitle && text.participationDescription ? (
      <PublicHomeFeatureCard
        key="participation"
        description={text.participationDescription}
        onClick={() => onPage("followJoin")}
        title={text.participationTitle}
        visual={<PublicHomeFeatureIcon kind="participation" />}
      />
    ) : null,
    text.aramTitle && text.aramDescription ? (
      <PublicHomeFeatureCard
        key="aram"
        description={text.aramDescription}
        onClick={() => onPage("aram")}
        title={text.aramTitle}
        visual={<PublicHomeFeatureIcon kind="aram" />}
      />
    ) : null,
    text.communityTitle && text.communityDescription ? (
      <PublicHomeFeatureCard
        key="community"
        description={text.communityDescription}
        onClick={() => onPage("communityParty")}
        title={text.communityTitle}
        visual={<PublicHomeFeatureIcon kind="community" />}
      />
    ) : null,
    text.streamerTitle && text.streamerDescription ? (
      <PublicHomeFeatureCard
        key="streamer"
        description={text.streamerDescription}
        onClick={() => onPage("subscriptions")}
        title={text.streamerTitle}
        visual={<PublicHomeFeatureIcon kind="streamer" />}
      />
    ) : null,
  ].filter(Boolean);

  return (
    <div id="public-search" className="public-home-content public-dashboard-home public-home-shared-content">
      {/* eyebrow는 의도적으로 전달하지 않습니다. 게임명이 헤더 game selector와 h1에 이미
          있어 세 번 반복되고, shared-ui-render.test.tsx가 이 부재를 단언하고 있습니다. */}
      <PublicGameHomeHero
        description={text.description}
        game="lol"
        search={searchForm}
        title={text.title}
      />
      <div className="public-game-home__live-strip">
        {liveContent}
      </div>
      {text.primaryFeaturesTitle && featureCards.length > 0 ? (
      <div className="public-game-home__feature-grid">
        <PublicHomeFeaturePanel className="public-game-home__feature-panel--primary" title={text.primaryFeaturesTitle}>
          {featureCards}
        </PublicHomeFeaturePanel>
      </div>
        ) : null}
    </div>
  );
}
