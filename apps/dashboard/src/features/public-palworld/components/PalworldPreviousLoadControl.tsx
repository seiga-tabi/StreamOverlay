import { useEffect, useRef } from "react";
import { Button } from "../../../shared/ui/Button";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";

export function PalworldPreviousLoadControl({
  error,
  hasPrevious,
  loading,
  locale,
  onLoadPrevious,
  onRetry,
  paused = false,
  retryBlocked = false,
}: {
  error: unknown;
  hasPrevious: boolean;
  loading: boolean;
  locale: PalworldLocale;
  onLoadPrevious: () => void;
  onRetry: () => void;
  paused?: boolean;
  retryBlocked?: boolean;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadPreviousRef = useRef(onLoadPrevious);
  const text = palworldI18n[locale];
  onLoadPreviousRef.current = onLoadPrevious;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (
      !sentinel
      || !hasPrevious
      || loading
      || error
      || paused
      || typeof IntersectionObserver === "undefined"
    ) {
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadPreviousRef.current();
    }, {
      rootMargin: "160px 0px",
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, hasPrevious, loading, paused]);

  if (!hasPrevious) return null;

  return (
    <div aria-busy={loading} className="palworld-auto-load palworld-auto-load--previous">
      <div aria-hidden="true" className="palworld-auto-load-sentinel" ref={sentinelRef} />
      {error ? (
        <div className="palworld-auto-load-error" role="alert">
          <p>{retryBlocked ? text.rateLimitWait : text.loadPreviousError}</p>
          <Button disabled={retryBlocked} onClick={onRetry} size="sm" type="button" variant="secondary">
            {text.retryLoadPrevious}
          </Button>
        </div>
      ) : (
        <>
          <p className="palworld-auto-load-hint" role={paused ? "status" : undefined}>
            {paused ? text.autoLoadPaused : text.previousLoadHint}
          </p>
          <Button
            disabled={paused}
            loading={loading}
            loadingLabel={text.loadingPrevious}
            onClick={onLoadPrevious}
            size="sm"
            type="button"
            variant="secondary"
          >
            {text.loadPrevious}
          </Button>
        </>
      )}
    </div>
  );
}
