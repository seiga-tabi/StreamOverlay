import type { ReactNode } from "react";
import { Card, CardContent } from "../../../shared/ui/Card";
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
import {
  PublicLiveStreamerRail,
  type PublicLiveStreamerCard,
} from "../../../shared/PublicLiveStreamerRail";

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
};

export type PublicHomeLiveStreamer = PublicLiveStreamerCard;

export function PublicHomeSearchPanel({
  error,
  liveLoading = false,
  liveStreamers,
  onShowStreamers,
  searchForm,
  showEmptyResult,
  text,
}: {
  error: string;
  liveLoading?: boolean;
  liveStreamers: PublicHomeLiveStreamer[];
  loading: boolean;
  onShowStreamers?: () => void;
  searchForm: ReactNode;
  showEmptyResult: boolean;
  text: PublicHomeSearchPanelText;
}) {
  return (
    <section id="public-search" className="public-home-content public-dashboard-home public-home-shared-content">
      <div className="public-home-shared-inner">
        <div className="public-home-brand-hero" aria-labelledby="public-home-title">
          <img className="public-home-brand-logo-image" src="/images/yorogg-home-logo.webp" alt="" aria-hidden="true" />
          <h1 id="public-home-title" className="sr-only"  >{text.title.label}</h1>
          <p className="sr-only"  >{text.description.label}</p>
        </div>

        <Card as="section" className="public-home-shared-search-card" padding="lg" variant="glass">
          <CardContent>
            {searchForm}
          </CardContent>
        </Card>

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
        ) : (
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
        )}
      </div>
    </section>
  );
}
