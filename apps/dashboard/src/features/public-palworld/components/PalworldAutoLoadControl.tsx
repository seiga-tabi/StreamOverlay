import { useEffect, useRef } from "react";
import { Button } from "../../../shared/ui/Button";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";

function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function PalworldAutoLoadControl({
  error,
  hasMore,
  loadedCount,
  loading,
  locale,
  onLoadMore,
  onRetry,
  paused = false,
  total,
}: {
  error: unknown;
  hasMore: boolean;
  loadedCount: number;
  loading: boolean;
  locale: PalworldLocale;
  onLoadMore: () => void;
  onRetry: () => void;
  paused?: boolean;
  total: number;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const text = palworldI18n[locale];
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading || error || paused || typeof IntersectionObserver === "undefined") {
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMoreRef.current();
    }, {
      rootMargin: "480px 0px",
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, hasMore, loading, paused]);

  if (total === 0) return null;

  const loadedSummary = interpolate(text.loadedResults, {
    loaded: loadedCount.toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR"),
    total: total.toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR"),
  });

  return (
    <div
      aria-busy={loading}
      className="palworld-auto-load"
      data-testid="palworld-auto-load"
    >
      <p aria-live="polite" className="palworld-auto-load-summary">{loadedSummary}</p>
      {error ? (
        <div className="palworld-auto-load-error" role="alert">
          <p>{text.loadMoreError}</p>
          <Button onClick={onRetry} size="sm" type="button" variant="secondary">
            {text.retryLoadMore}
          </Button>
        </div>
      ) : hasMore ? (
        <>
          <p className="palworld-auto-load-hint">{text.autoLoadHint}</p>
          <Button
            loading={loading}
            loadingLabel={text.loadingMore}
            disabled={paused}
            onClick={onLoadMore}
            size="sm"
            type="button"
            variant="secondary"
          >
            {text.loadMore}
          </Button>
          <div aria-hidden="true" className="palworld-auto-load-sentinel" ref={sentinelRef} />
        </>
      ) : (
        <p className="palworld-auto-load-end" role="status">{text.allResultsLoaded}</p>
      )}
    </div>
  );
}
