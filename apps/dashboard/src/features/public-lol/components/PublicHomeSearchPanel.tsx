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

  return (
    <div id="public-search" className="public-home-content public-dashboard-home public-home-shared-content">
      <PublicGameHomeHero
        description={text.description}
        eyebrow={text.eyebrow}
        game="lol"
        search={searchForm}
        title={text.title}
      />
      <div className="public-game-home__live-strip">
        {liveContent}
      </div>
      {text.primaryFeaturesTitle
        && text.participationTitle
        && text.participationDescription
        && text.aramTitle
        && text.aramDescription
        && text.communityTitle
        && text.communityDescription
        && text.additionalFeaturesTitle
        && text.streamerTitle
        && text.streamerDescription ? (
      <div className="public-game-home__feature-grid">
        <PublicHomeFeaturePanel className="public-game-home__feature-panel--primary" title={text.primaryFeaturesTitle}>
          <PublicHomeFeatureCard
            description={text.participationDescription}
            onClick={() => onPage("followJoin")}
            title={text.participationTitle}
          />
          <PublicHomeFeatureCard
            description={text.aramDescription}
            onClick={() => onPage("aram")}
            title={text.aramTitle}
          />
          <PublicHomeFeatureCard
            description={text.communityDescription}
            onClick={() => onPage("communityParty")}
            title={text.communityTitle}
          />
        </PublicHomeFeaturePanel>
        <PublicHomeFeaturePanel title={text.additionalFeaturesTitle}>
          <PublicHomeFeatureCard
            description={text.streamerDescription}
            onClick={() => onPage("subscriptions")}
            title={text.streamerTitle}
          />
        </PublicHomeFeaturePanel>
      </div>
        ) : null}
    </div>
  );
}
