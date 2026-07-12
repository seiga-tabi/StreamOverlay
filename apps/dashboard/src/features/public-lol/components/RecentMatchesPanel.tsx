import type { ReactNode } from "react";
import { Button } from "../../../shared/ui/Button";
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
import { Badge } from "../../../shared/ui/Status";

export type RecentMatchesPanelLocalizedText = {
  label: ReactNode;
  ko: string;
  ja: string;
};

export type RecentMatchesPanelText = {
  title: RecentMatchesPanelLocalizedText;
  emptyTitle: RecentMatchesPanelLocalizedText;
  emptyDescription: RecentMatchesPanelLocalizedText;
  loadingMoreMatches: ReactNode;
  loadMoreMatches: ReactNode;
  noMoreMatches: RecentMatchesPanelLocalizedText;
};

export type RecentMatchesPanelProps = {
  matchCount: ReactNode;
  filterBar: ReactNode;
  isEmpty: boolean;
  matchRows: ReactNode;
  moreError?: ReactNode;
  canLoadMore: boolean;
  loadingMore: boolean;
  showNoMore: boolean;
  text: RecentMatchesPanelText;
  onLoadMore?: () => void;
};

export function RecentMatchesPanel({
  matchCount,
  filterBar,
  isEmpty,
  matchRows,
  moreError,
  canLoadMore,
  loadingMore,
  showNoMore,
  text,
  onLoadMore
}: RecentMatchesPanelProps) {
  return (
    <section className="public-panel public-matches-panel">
      <div className="public-section-head">
        <h2 data-ko={text.title.ko} data-ja={text.title.ja}>{text.title.label}</h2>
        <Badge size="sm" tone="info">{matchCount}</Badge>
      </div>
      {filterBar}
      <div className="public-match-list">
        {isEmpty ? (
          <EmptyState className="public-profile-shared-empty-inline" variant="search">
            <EmptyStateIcon>?</EmptyStateIcon>
            <EmptyStateTitle as="h3" data-ko={text.emptyTitle.ko} data-ja={text.emptyTitle.ja}>{text.emptyTitle.label}</EmptyStateTitle>
            <EmptyStateDescription data-ko={text.emptyDescription.ko} data-ja={text.emptyDescription.ja}>
              {text.emptyDescription.label}
            </EmptyStateDescription>
          </EmptyState>
        ) : matchRows}
      </div>
      {moreError ? <p className="public-match-more-error">{moreError}</p> : null}
      {canLoadMore && onLoadMore ? (
        <div className="public-match-more">
          <Button type="button" onClick={onLoadMore} disabled={loadingMore} loading={loadingMore} loadingLabel={text.loadingMoreMatches} size="md" variant="tertiary">
            {loadingMore ? text.loadingMoreMatches : text.loadMoreMatches}
          </Button>
        </div>
      ) : showNoMore ? (
        <p className="public-match-more-done" data-ko={text.noMoreMatches.ko} data-ja={text.noMoreMatches.ja}>{text.noMoreMatches.label}</p>
      ) : null}
    </section>
  );
}
