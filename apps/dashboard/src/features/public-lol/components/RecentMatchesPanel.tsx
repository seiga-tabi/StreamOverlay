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
          // 실제 완성 행의 실루엣(승패·아바타·이름·KDA·아이템·팀리스트·화살표)을
          // 반영한 스켈레톤 — 목업: docs/mockups/lol-match-row-skeleton-redesign-v1.html.
          <div className="public-match-skeleton-list" role="status" aria-label={String(text.loadingMoreMatches)}>
            {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
              <div aria-hidden="true" className="public-match-skeleton-row" key={index}>
                <div className="public-match-skeleton-outcome">
                  <span className="public-match-skeleton-block" />
                  <span className="public-match-skeleton-block" />
                </div>
                <span className="public-match-skeleton-avatar" />
                <div className="public-match-skeleton-name">
                  <span className="public-match-skeleton-block" />
                  <span className="public-match-skeleton-block" />
                </div>
                <div className="public-match-skeleton-kda">
                  <span className="public-match-skeleton-block" />
                  <span className="public-match-skeleton-block" />
                </div>
                <div className="public-match-skeleton-stats">
                  <span className="public-match-skeleton-block" />
                  <span className="public-match-skeleton-block" />
                </div>
                <div className="public-match-skeleton-items">
                  {Array.from({ length: 6 }, (_, itemIndex) => (
                    <span className="public-match-skeleton-item" key={itemIndex} />
                  ))}
                </div>
                <div className="public-match-skeleton-team">
                  <span className="public-match-skeleton-block" />
                  <span className="public-match-skeleton-block" />
                </div>
                <span className="public-match-skeleton-expand" />
              </div>
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
