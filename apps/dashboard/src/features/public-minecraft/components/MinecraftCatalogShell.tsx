import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../../../shared/ui/Button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../../../shared/ui/EmptyState";
import { Skeleton } from "../../../shared/ui/Skeleton";
import { MINECRAFT_SEARCH_MAX_LENGTH } from "../api/minecraft";
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import type { MinecraftCatalogStatus } from "../hooks/useMinecraftCatalog";
import type { MinecraftCatalogMetadata, MinecraftPagination } from "@streamops/shared";

export function formatMinecraftTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

/* 카탈로그 3화면이 공유하는 프레임 — 검색 입력·건수·상태·더 보기.
 * 목록 자체는 children 으로 받아 화면별 행 구성만 다르게 둡니다. */
export function MinecraftCatalogShell({
  children,
  filters,
  loadMore,
  loadMoreError,
  loadMoreLoading,
  locale,
  metadata,
  onSearch,
  pagination,
  retry,
  search,
  status,
  title,
  titleId,
}: {
  children: ReactNode;
  filters?: ReactNode;
  loadMore: () => void;
  loadMoreError: boolean;
  loadMoreLoading: boolean;
  locale: MinecraftLocale;
  metadata: MinecraftCatalogMetadata | null;
  onSearch: (value: string) => void;
  pagination: MinecraftPagination | null;
  retry: () => void;
  search: string;
  status: MinecraftCatalogStatus;
  title: string;
  titleId: string;
}) {
  const text = minecraftI18n[locale];
  const [draft, setDraft] = useState(search);
  /* URL(?q=)이 단일 원본 — nav 재클릭·뒤로가기로 search 가 바뀌면 입력도 따라갑니다. */
  useEffect(() => setDraft(search), [search]);

  return (
    <section aria-labelledby={titleId} className="minecraft-catalog">
      <header className="minecraft-catalog__head">
        <h1 id={titleId}>{title}</h1>
        {pagination ? (
          <span aria-live="polite" className="minecraft-catalog__count">
            {formatMinecraftTemplate(text.resultCount, { count: pagination.total.toLocaleString() })}
          </span>
        ) : null}
        <form
          className="minecraft-catalog__search"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch(draft);
          }}
          role="search"
          aria-label={text.searchLabel}
        >
          <input
            aria-label={text.searchLabel}
            maxLength={MINECRAFT_SEARCH_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={text.searchPlaceholder}
            type="search"
            value={draft}
          />
          <button type="submit">{text.homeSearchSubmit}</button>
        </form>
      </header>
      {filters}
      {status === "loading" ? (
        <div aria-hidden="true" className="minecraft-catalog__skeletons">
          <Skeleton className="minecraft-catalog__skeleton" />
          <Skeleton className="minecraft-catalog__skeleton" />
          <Skeleton className="minecraft-catalog__skeleton" />
        </div>
      ) : null}
      {status === "empty" ? (
        <EmptyState>
          <EmptyStateIcon>∅</EmptyStateIcon>
          <EmptyStateTitle data-ja={minecraftI18n.ja.catalogEmpty} data-ko={minecraftI18n.ko.catalogEmpty}>
            {text.catalogEmpty}
          </EmptyStateTitle>
        </EmptyState>
      ) : null}
      {status === "error" || status === "data_unavailable" ? (
        <EmptyState role="alert" variant="error">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle>
            {status === "error" ? text.catalogError : text.catalogUnavailable}
          </EmptyStateTitle>
          <EmptyStateDescription>
            {status === "error" ? text.catalogErrorDescription : text.catalogUnavailableDescription}
          </EmptyStateDescription>
          <EmptyStateActions>
            <Button onClick={retry} variant="secondary">{text.retry}</Button>
          </EmptyStateActions>
        </EmptyState>
      ) : null}
      {status === "ready" ? (
        <>
          {children}
          <div className="minecraft-catalog__more">
            {loadMoreError ? <p role="alert">{text.loadMoreFailed}</p> : null}
            {pagination?.hasNextPage ? (
              <Button disabled={loadMoreLoading} onClick={loadMore} variant="secondary">
                {loadMoreLoading ? text.loading : text.loadMore}
              </Button>
            ) : (
              <p className="minecraft-catalog__done">{text.allLoaded}</p>
            )}
          </div>
          {metadata ? (
            <p className="minecraft-unofficial-note">
              {formatMinecraftTemplate(text.dataSourceNote, { version: metadata.gameVersion })}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function MinecraftName({
  fallback,
  locale,
  text: nameText,
}: {
  fallback: boolean;
  locale: MinecraftLocale;
  text: string;
}) {
  const text = minecraftI18n[locale];
  return (
    <span className="minecraft-name">
      <strong>{nameText}</strong>
      {fallback ? (
        <span className="minecraft-name__fallback" title={text.fallbackNameLabel}>
          {text.fallbackNameBadge}
          <span className="yoro-u-sr-only">{text.fallbackNameLabel}</span>
        </span>
      ) : null}
    </span>
  );
}
