import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../../shared/ui/Button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../../../shared/ui/EmptyState";
import { Skeleton } from "../../../shared/ui/Skeleton";
import {
  getMinecraftPatchNotes,
  MinecraftPatchApiError,
  MINECRAFT_PATCH_EDITIONS,
  type MinecraftPatchEdition,
  type MinecraftPatchEntry,
  type MinecraftPatchType,
} from "../api/patch-notes";
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { useMinecraftRoute } from "../hooks/useMinecraftRoute";
import { minecraftPathForPage, setMinecraftUrl } from "../utils/routes";

type PatchStatus = "loading" | "ready" | "empty" | "not_collected" | "data_unavailable" | "error";

/* 에디션은 URL(?edition=)이 단일 원본 — 검색 q 와 같은 규칙으로 공유·복원됩니다. */
function editionFromUrl(): MinecraftPatchEdition {
  if (typeof window === "undefined") return "java";
  const value = new URLSearchParams(window.location.search).get("edition");
  return value === "bedrock" ? "bedrock" : "java";
}

function formatPatchDate(publishedAt: string, locale: MinecraftLocale): string {
  const date = new Date(publishedAt);
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", { dateStyle: "medium" }).format(date);
}

function PatchCard({ entry, isLatest, locale }: {
  entry: MinecraftPatchEntry;
  isLatest: boolean;
  locale: MinecraftLocale;
}) {
  const text = minecraftI18n[locale];
  const typeLabel = entry.type === "release"
    ? text.patchTypeRelease
    : entry.type === "snapshot" ? text.patchTypeSnapshot : text.patchTypePreview;
  const summarized = Boolean(entry.title);
  const officialLink = (
    <a href={entry.officialUrl} rel="noopener noreferrer" target="_blank">
      {text.patchOfficialLink}
    </a>
  );

  /* 요약이 없는 버전은 컴팩트 1줄 — 카드마다 "준비 중"을 반복하지 않고
     목록 상단 안내 1회로 대신합니다(노이즈 축소, 정직성 유지). */
  if (!summarized) {
    return (
      <article className={`minecraft-patch pixel-corner is-compact${isLatest ? " is-latest" : ""}`} data-testid="minecraft-patch-card">
        <header className="minecraft-patch__head">
          {isLatest ? <span className="minecraft-patch__latest pixel-corner-sm">{text.patchLatest}</span> : null}
          <h2 className="minecraft-patch__version">{entry.version}</h2>
          <span className={`minecraft-patch__type pixel-corner-sm is-${entry.type}`}>{typeLabel}</span>
          <time className="minecraft-patch__date" dateTime={entry.publishedAt}>
            {formatPatchDate(entry.publishedAt, locale)}
          </time>
          {officialLink}
        </header>
      </article>
    );
  }

  return (
    <article className={`minecraft-patch pixel-corner${isLatest ? " is-latest" : ""}`} data-testid="minecraft-patch-card">
      <header className="minecraft-patch__head">
        {isLatest ? <span className="minecraft-patch__latest pixel-corner-sm">{text.patchLatest}</span> : null}
        <h2 className="minecraft-patch__version">{entry.version}</h2>
        <span className={`minecraft-patch__type pixel-corner-sm is-${entry.type}`}>{typeLabel}</span>
        <time className="minecraft-patch__date" dateTime={entry.publishedAt}>
          {formatPatchDate(entry.publishedAt, locale)}
        </time>
      </header>
      <p className="minecraft-patch__title">{entry.title![locale]}</p>
      {entry.highlights && entry.highlights.length > 0 ? (
        <ul className="minecraft-patch__highlights">
          {entry.highlights.map((highlight) => <li key={highlight.ko}>{highlight[locale]}</li>)}
        </ul>
      ) : null}
      <footer className="minecraft-patch__foot">
        {officialLink}
        <span>{text.patchSummaryCredit}</span>
      </footer>
    </article>
  );
}

export function MinecraftPatchNotesPage({ locale }: { locale: MinecraftLocale }) {
  const text = minecraftI18n[locale];
  const { locationRevision } = useMinecraftRoute();
  const edition = useMemo(() => editionFromUrl(), [locationRevision]);
  const [type, setType] = useState<MinecraftPatchType | "all">("all");
  /* 에디션 전환 시 유형을 리셋 — java 의 snapshot 선택이 bedrock 요청에 남아
     빈 결과처럼 보이던 잠복 결함의 수정점입니다. */
  useEffect(() => setType("all"), [edition]);
  const [status, setStatus] = useState<PatchStatus>("loading");
  const [entries, setEntries] = useState<readonly MinecraftPatchEntry[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setEntries([]);
    void getMinecraftPatchNotes({ edition, ...(type !== "all" ? { type } : {}) }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        if (response.state === "data_unavailable") {
          setStatus("data_unavailable");
          return;
        }
        setEntries(response.entries);
        setHasNextPage(response.pagination.hasNextPage);
        setStatus(response.entries.length === 0 ? "empty" : "ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (controller.signal.aborted) return;
        if (error instanceof MinecraftPatchApiError && error.code === "PATCH_NOT_COLLECTED") {
          setStatus("not_collected");
          return;
        }
        setStatus(error instanceof MinecraftPatchApiError && error.status === 503 ? "data_unavailable" : "error");
      });
    return () => controller.abort();
  }, [edition, type, revision]);

  const loadMore = useCallback(async () => {
    if (loadMoreLoading || !hasNextPage) return;
    setLoadMoreLoading(true);
    try {
      const nextPage = Math.floor(entries.length / 20) + 1 + 1;
      const response = await getMinecraftPatchNotes({ edition, ...(type !== "all" ? { type } : {}), page: nextPage });
      if (response.state !== "ready") return;
      setEntries((previous) => {
        const known = new Set(previous.map((entry) => entry.id));
        return [...previous, ...response.entries.filter((entry) => !known.has(entry.id))];
      });
      setHasNextPage(response.pagination.hasNextPage);
    } catch {
      /* 더 보기 실패는 다음 클릭으로 재시도 */
    } finally {
      setLoadMoreLoading(false);
    }
  }, [edition, entries.length, hasNextPage, loadMoreLoading, type]);

  const changeEdition = (next: MinecraftPatchEdition) => {
    const path = minecraftPathForPage("patchNotes");
    setMinecraftUrl(next === "java" ? path : `${path}?edition=${next}`);
  };

  /* LATEST = 현재 목록의 최신 정식 릴리스 1건 */
  const latestReleaseId = entries.find((entry) => entry.type === "release")?.id;
  /* 연도 구분 — publishedAt 내림차순 전제(수집기 계약) */
  let lastYear = "";
  const editionTypes: ReadonlyArray<MinecraftPatchType> =
    edition === "java" ? ["release", "snapshot"] : ["release", "preview"];

  return (
    <section aria-labelledby="minecraft-patch-title" className="minecraft-catalog">
      <header className="minecraft-catalog__head">
        <h1 id="minecraft-patch-title">{text.patchNotes}</h1>
        <div aria-label={text.patchEditionLabel} className="minecraft-patch-editions" role="group">
          {MINECRAFT_PATCH_EDITIONS.map((candidate) => (
            <button
              aria-pressed={edition === candidate}
              className={`pixel-corner-sm${edition === candidate ? " active" : ""} is-${candidate}`}
              key={candidate}
              onClick={() => changeEdition(candidate)}
              type="button"
            >
              {candidate === "java" ? "Java" : "Bedrock"}
            </button>
          ))}
        </div>
      </header>
      <p className="minecraft-patch-lead" data-ja={minecraftI18n.ja.patchLead} data-ko={minecraftI18n.ko.patchLead}>
        {text.patchLead}
      </p>
      <div aria-label={text.patchTypeLabel} className="minecraft-type-chips" role="group">
        <button aria-pressed={type === "all"} className={`pixel-corner-sm${type === "all" ? " active" : ""}`} onClick={() => setType("all")} type="button">
          {text.patchTypeAll}
        </button>
        {editionTypes.map((candidate) => (
          <button
            aria-pressed={type === candidate}
            className={`pixel-corner-sm${type === candidate ? " active" : ""}`}
            key={candidate}
            onClick={() => setType(candidate)}
            type="button"
          >
            {candidate === "release" ? text.patchTypeRelease : candidate === "snapshot" ? text.patchTypeSnapshot : text.patchTypePreview}
          </button>
        ))}
      </div>

      {status === "loading" ? (
        <div aria-hidden="true" className="minecraft-catalog__skeletons">
          <Skeleton className="minecraft-catalog__skeleton" />
          <Skeleton className="minecraft-catalog__skeleton" />
        </div>
      ) : null}

      {status === "not_collected" || status === "data_unavailable" ? (
        <EmptyState>
          <EmptyStateIcon>…</EmptyStateIcon>
          <EmptyStateTitle data-ja={minecraftI18n.ja.patchNotCollectedTitle} data-ko={minecraftI18n.ko.patchNotCollectedTitle}>
            {text.patchNotCollectedTitle}
          </EmptyStateTitle>
          <EmptyStateDescription>{text.patchNotCollectedDescription}</EmptyStateDescription>
        </EmptyState>
      ) : null}

      {status === "empty" ? (
        <EmptyState>
          <EmptyStateIcon>∅</EmptyStateIcon>
          <EmptyStateTitle>{text.patchEmptyFiltered}</EmptyStateTitle>
        </EmptyState>
      ) : null}

      {status === "error" ? (
        <EmptyState role="alert" variant="error">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle>{text.patchErrorTitle}</EmptyStateTitle>
          <EmptyStateDescription>{text.catalogErrorDescription}</EmptyStateDescription>
          <EmptyStateActions>
            <Button onClick={() => setRevision((value) => value + 1)} variant="secondary">{text.retry}</Button>
          </EmptyStateActions>
        </EmptyState>
      ) : null}

      {status === "ready" ? (
        <>
          {entries.some((entry) => !entry.title) ? (
            <p className="minecraft-patch-pending-note" role="note">{text.patchPendingNote}</p>
          ) : null}
          <div className="minecraft-patch-list">
            {entries.map((entry) => {
              const year = String(new Date(entry.publishedAt).getFullYear());
              const yearHeading = year !== lastYear ? <p className="minecraft-patch-year" key={`year-${year}`}>{year}</p> : null;
              lastYear = year;
              return (
                <div className="minecraft-patch-list__group" key={entry.id}>
                  {yearHeading}
                  <PatchCard entry={entry} isLatest={entry.id === latestReleaseId} locale={locale} />
                </div>
              );
            })}
          </div>
          <div className="minecraft-catalog__more">
            {hasNextPage ? (
              <Button disabled={loadMoreLoading} onClick={() => void loadMore()} variant="secondary">
                {loadMoreLoading ? text.loading : text.patchLoadOlder}
              </Button>
            ) : (
              <p className="minecraft-catalog__done">{text.patchAllLoaded}</p>
            )}
          </div>
        </>
      ) : null}

      {/* 하단 가이드 — 상태와 무관하게 항상 실콘텐츠(광고 오인 빈 박스 금지) */}
      <div className="minecraft-patch-guide" data-testid="minecraft-patch-guide">
        <div>
          <h3>{text.patchGuideHowTitle}</h3>
          <ol>
            <li>{text.patchGuideHow1}</li>
            <li>{text.patchGuideHow2}</li>
            <li>{text.patchGuideHow3}</li>
          </ol>
        </div>
        <div>
          <h3>{text.patchGuideReadTitle}</h3>
          <dl>
            <div><dt>{text.patchGuideRead1Term}</dt><dd>{text.patchGuideRead1}</dd></div>
            <div><dt>{text.patchGuideRead2Term}</dt><dd>{text.patchGuideRead2}</dd></div>
          </dl>
        </div>
        <div>
          <h3>{text.patchGuideDataTitle}</h3>
          <p>{text.patchGuideData}</p>
          <h3>{text.patchFaqTitle}</h3>
          <details className="minecraft-patch-guide__faq">
            <summary>{text.patchFaq1Q}</summary>
            <p>{text.patchFaq1A}</p>
          </details>
          <details className="minecraft-patch-guide__faq">
            <summary>{text.patchFaq2Q}</summary>
            <p>{text.patchFaq2A}</p>
          </details>
        </div>
      </div>
    </section>
  );
}
