import type { ReactNode } from "react";
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
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
  errorTitle: PublicHomeSearchPanelLocalizedText;
  emptyTitle: PublicHomeSearchPanelLocalizedText;
  emptyDescription: PublicHomeSearchPanelLocalizedText;
  guideTitle: PublicHomeSearchPanelLocalizedText;
  guideDescription: PublicHomeSearchPanelLocalizedText;
  liveTitle: PublicHomeSearchPanelLocalizedText;
  liveViewAll: PublicHomeSearchPanelLocalizedText;
  liveWatch: PublicHomeSearchPanelLocalizedText;
  liveEmptyTitle: PublicHomeSearchPanelLocalizedText;
  liveEmptyDescription: PublicHomeSearchPanelLocalizedText;
  primaryFeaturesTitle?: PublicHomeSearchPanelLocalizedText;
  participationTitle?: PublicHomeSearchPanelLocalizedText;
  participationDescription?: PublicHomeSearchPanelLocalizedText;
  tournamentTitle?: PublicHomeSearchPanelLocalizedText;
  tournamentDescription?: PublicHomeSearchPanelLocalizedText;
  communityTitle?: PublicHomeSearchPanelLocalizedText;
  communityDescription?: PublicHomeSearchPanelLocalizedText;
  streamerTitle?: PublicHomeSearchPanelLocalizedText;
  streamerDescription?: PublicHomeSearchPanelLocalizedText;
  additionalFeaturesTitle?: PublicHomeSearchPanelLocalizedText;
};

export type PublicHomeLiveStreamer = PublicLiveStreamerCard;

export function PublicHomeSearchPanel({
  error,
  liveLoading = false,
  liveStreamers,
  onPage,
  onShowStreamers,
  searchForm,
  showEmptyResult,
  text,
}: {
  error: string;
  liveLoading?: boolean;
  liveStreamers: PublicHomeLiveStreamer[];
  loading: boolean;
  onPage: (page: PublicMainPage) => void;
  onShowStreamers?: () => void;
  searchForm: ReactNode;
  showEmptyResult: boolean;
  text: PublicHomeSearchPanelText;
}) {
  const liveContent = (
    <PublicLiveStreamerRail
      emptyDescription={text.liveEmptyDescription}
      emptyTitle={text.liveEmptyTitle}
      loading={liveLoading}
      loadingLabel={text.loadingStatus}
      onViewAll={onShowStreamers}
      streamers={liveStreamers}
      title={text.liveTitle}
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
        liveContent={liveContent}
        search={searchForm}
        title={text.title}
      >
        {error ? (
          <EmptyState className="public-home-shared-empty" variant="error">
            <EmptyStateIcon>!</EmptyStateIcon>
            <EmptyStateTitle as="h2"  >
              {text.errorTitle.label}
            </EmptyStateTitle>
            <EmptyStateDescription>{error}</EmptyStateDescription>
          </EmptyState>
        ) : showEmptyResult ? (
          <EmptyState className="public-home-shared-empty" variant="search">
            <EmptyStateIcon>?</EmptyStateIcon>
            <EmptyStateTitle as="h2"  >
              {text.emptyTitle.label}
            </EmptyStateTitle>
            <EmptyStateDescription  >
              {text.emptyDescription.label}
            </EmptyStateDescription>
          </EmptyState>
        ) : null}
      </PublicGameHomeHero>
      {text.primaryFeaturesTitle
        && text.participationTitle
        && text.participationDescription
        && text.tournamentTitle
        && text.tournamentDescription
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
            description={text.tournamentDescription}
            onClick={() => onPage("tournamentCalendar")}
            title={text.tournamentTitle}
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
