import type { ReactNode } from "react";
import { Card, CardContent } from "../../../shared/ui/Card";
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
import { Skeleton, SkeletonButton, SkeletonCard, SkeletonText } from "../../../shared/ui/Skeleton";
import { StatusPill } from "../../../shared/ui/Status";

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

export type PublicHomeLiveStreamer = {
  id: string;
  name: string;
  nameJa?: string;
  primaryMeta: string;
  primaryMetaJa?: string;
  secondaryMeta?: string;
  secondaryMetaJa?: string;
  server?: string;
  avatarLabel: string;
  avatarUrl?: string;
  channelUrl?: string;
  statusLabel: string;
  statusKo: string;
  statusJa: string;
};

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
  const showLivePagination = liveStreamers.length > 5;

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
          <section className="public-home-live-section" aria-labelledby="public-home-live-title">
            <div className="public-home-live-head">
              <h2 id="public-home-live-title"  >
                {text.liveTitle.label}
              </h2>
              <button type="button" onClick={onShowStreamers}  >
                {text.liveViewAll.label}
                <span aria-hidden="true">›</span>
              </button>
            </div>
            <div className="public-home-live-rail" aria-label={text.liveTitle.label}>
              {liveLoading ? (
                Array.from({ length: 4 }, (_, index) => (
                  <SkeletonCard className="public-home-live-card public-home-live-skeleton" key={index} loadingLabel={text.loadingStatus.label} size="md">
                    <Skeleton rounded size="md" />
                    <SkeletonText lines={3} size="sm" />
                    <SkeletonButton size="sm" />
                  </SkeletonCard>
                ))
              ) : liveStreamers.length > 0 ? liveStreamers.map((streamer) => (
                <article className="public-home-live-card" key={streamer.id}>
                  <StatusPill className="public-home-live-pill" size="sm" tone="live"  >{streamer.statusLabel}</StatusPill>
                  <span className="public-home-live-avatar" aria-hidden="true">
                    {streamer.avatarUrl ? <img src={streamer.avatarUrl} alt="" /> : streamer.avatarLabel}
                  </span>
                  <strong  >{streamer.name}</strong>
                  <small  >{streamer.primaryMeta}</small>
                  {streamer.secondaryMeta ? (
                    <small  >{streamer.secondaryMeta}</small>
                  ) : null}
                  {streamer.server ? <em>{streamer.server}</em> : null}
                  {streamer.channelUrl ? (
                    <a
                      className="public-home-live-action"
                      href={streamer.channelUrl}
                      target="_blank"
                      rel="noreferrer"


                    >
                      {text.liveWatch.label}
                    </a>
                  ) : (
                    <button
                      className="public-home-live-action"
                      type="button"
                      onClick={onShowStreamers}


                    >
                      {text.liveWatch.label}
                    </button>
                  )}
                </article>
              )) : (
                <EmptyState className="public-home-live-empty" variant="streamer">
                  <EmptyStateIcon>?</EmptyStateIcon>
                  <EmptyStateTitle as="h3"  >
                    {text.liveEmptyTitle.label}
                  </EmptyStateTitle>
                  <EmptyStateDescription  >
                    {text.liveEmptyDescription.label}
                  </EmptyStateDescription>
                </EmptyState>
              )}
            </div>
            {showLivePagination ? <div className="public-home-live-pagination" aria-hidden="true">
              <span className="active" />
              <span />
              <span />
              <span />
              <span />
            </div> : null}
          </section>
        )}
      </div>
    </section>
  );
}
