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
      />
    ) : null,
    text.aramTitle && text.aramDescription ? (
      <PublicHomeFeatureCard
        key="aram"
        description={text.aramDescription}
        onClick={() => onPage("aram")}
        title={text.aramTitle}
      />
    ) : null,
    text.communityTitle && text.communityDescription ? (
      <PublicHomeFeatureCard
        key="community"
        description={text.communityDescription}
        onClick={() => onPage("communityParty")}
        title={text.communityTitle}
      />
    ) : null,
    text.streamerTitle && text.streamerDescription ? (
      <PublicHomeFeatureCard
        key="streamer"
        description={text.streamerDescription}
        onClick={() => onPage("subscriptions")}
        title={text.streamerTitle}
      />
    ) : null,
  ].filter(Boolean);

  return (
    <div id="public-search" className="public-home-content public-dashboard-home public-home-shared-content">
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
