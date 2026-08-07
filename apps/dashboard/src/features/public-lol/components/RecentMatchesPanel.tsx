import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "../../../shared/ui/Button";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
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
  loadFailedTitle: RecentMatchesPanelLocalizedText;
  retry: ReactNode;
};

export type RecentMatchesPanelProps = {
  matchCount: ReactNode;
  summaryStrip?: ReactNode;
  filterBar: ReactNode;
  shareAction?: ReactNode;
  isEmpty: boolean;
  initialLoading?: boolean;
  matchRows: ReactNode;
  /** 목록 자체를 불러오지 못한 경우. 비어 있음과 구분해 재시도 버튼을 노출합니다. */
  loadError?: ReactNode;
  onRetry?: () => void;
  moreError?: ReactNode;
  canLoadMore: boolean;
  loadingMore: boolean;
  showNoMore: boolean;
  text: RecentMatchesPanelText;
  onLoadMore?: () => void;
  onLoadMoreIntent?: () => void;
  loadMoreKey?: string;
};

const SKELETON_ROW_COUNT = 5;

function allowsPublicLolMatchPrefetch(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  }).connection;
  return connection?.saveData !== true && connection?.effectiveType !== "slow-2g" && connection?.effectiveType !== "2g";
}

export function RecentMatchesPanel({
  matchCount,
  summaryStrip,
  filterBar,
  shareAction,
  isEmpty,
  initialLoading = false,
  matchRows,
  loadError,
  onRetry,
  moreError,
  canLoadMore,
  loadingMore,
  showNoMore,
  text,
  onLoadMore,
  onLoadMoreIntent,
  loadMoreKey
}: RecentMatchesPanelProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const warmedKeyRef = useRef<string | undefined>(undefined);
  const intentRef = useRef(onLoadMoreIntent);
  intentRef.current = onLoadMoreIntent;

  function warmNextPage(): void {
    if (!canLoadMore || loadingMore || !loadMoreKey || warmedKeyRef.current === loadMoreKey || !allowsPublicLolMatchPrefetch()) return;
    warmedKeyRef.current = loadMoreKey;
    intentRef.current?.();
  }

  useEffect(() => {
    if (!canLoadMore || loadingMore || !loadMoreKey) return undefined;
    if (warmedKeyRef.current !== loadMoreKey) warmedKeyRef.current = undefined;
    const target = loadMoreRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        warmNextPage();
        observer.disconnect();
      }
    }, { rootMargin: "320px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [canLoadMore, loadingMore, loadMoreKey]);

  return (
    <section id="public-recent-matches" className="public-panel public-matches-panel">
      <div className="public-section-head">
        <h2  >{text.title.label}</h2>
        <Badge size="sm" tone="info">{matchCount}</Badge>
      </div>
      {summaryStrip}
      {filterBar}
      {shareAction}
      <div className="public-match-list" aria-busy={initialLoading || undefined}>
        {initialLoading ? (
          // 행 높이를 미리 확보해 스피너 교체 시 발생하던 레이아웃 점프를 없앱니다.
          <div className="public-match-skeleton-list" role="status" aria-label={String(text.loadingMoreMatches)}>
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
              <span aria-hidden="true" className="public-match-skeleton-row" key={index} />
            ))}
          </div>
        ) : loadError ? (
          <EmptyState className="public-profile-shared-empty-inline" variant="error">
            <EmptyStateIcon>!</EmptyStateIcon>
            <EmptyStateTitle as="h3">{text.loadFailedTitle.label}</EmptyStateTitle>
            <EmptyStateDescription>{loadError}</EmptyStateDescription>
            {onRetry ? (
              <EmptyStateActions>
                <Button type="button" variant="secondary" onClick={onRetry}>{text.retry}</Button>
              </EmptyStateActions>
            ) : null}
          </EmptyState>
        ) : isEmpty ? (
          <EmptyState className="public-profile-shared-empty-inline" variant="search">
            <EmptyStateIcon>?</EmptyStateIcon>
            <EmptyStateTitle as="h3"  >{text.emptyTitle.label}</EmptyStateTitle>
            <EmptyStateDescription  >
              {text.emptyDescription.label}
            </EmptyStateDescription>
          </EmptyState>
        ) : matchRows}
      </div>
      {moreError ? <p className="public-match-more-error">{moreError}</p> : null}
      {canLoadMore && onLoadMore ? (
        <div className="public-match-more" ref={loadMoreRef} onFocusCapture={warmNextPage} onPointerEnter={warmNextPage} onTouchStart={warmNextPage}>
          <Button type="button" onClick={onLoadMore} disabled={loadingMore} loading={loadingMore} loadingLabel={text.loadingMoreMatches} size="md" variant="tertiary">
            {loadingMore ? text.loadingMoreMatches : text.loadMoreMatches}
          </Button>
        </div>
      ) : showNoMore ? (
        <p className="public-match-more-done"  >{text.noMoreMatches.label}</p>
      ) : null}
    </section>
  );
}
