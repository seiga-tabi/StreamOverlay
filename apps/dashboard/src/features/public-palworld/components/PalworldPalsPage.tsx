import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PalworldPalListFacets, PalworldPalListResponse } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Card, CardContent } from "../../../shared/ui/Card";
import { Input } from "../../../shared/ui/Form";
import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../../shared/ui/Modal";
import { getPalworldPals } from "../api/palworld";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { usePalworldInfiniteList } from "../hooks/usePalworldInfiniteList";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { setPalworldUrl, palworldUrl } from "../utils/routes";
import {
  clearPalworldPalsFilterParams,
  PALWORLD_PALS_FILTER_KEYS,
  PALWORLD_PALS_ROUTE_KEYS,
  palworldPalsDetailFilterCount,
  updatePalworldPalsParams,
  type PalworldPalsFilterKey,
  type PalworldPalsRouteKey,
} from "../utils/pals";
import { PalCard } from "./PalworldCards";
import { PalworldAutoLoadControl } from "./PalworldAutoLoadControl";
import {
  PalworldPalsAppliedFilters,
  PalworldPalsDesktopFilterPanel,
  PalworldPalsFilterControls,
  PalworldPalsResultToolbar,
} from "./PalworldPalsFilters";
import { PalworldEmpty, PalworldError, PalworldLoading } from "./PalworldStates";

function routeSignature(params: URLSearchParams): string {
  return PALWORLD_PALS_ROUTE_KEYS
    .flatMap((key) => params.getAll(key).map((value) => `${key}=${value}`))
    .join("&");
}

function hasPalworldPalsFilters(params: URLSearchParams): boolean {
  return PALWORLD_PALS_FILTER_KEYS.some((key) => Boolean(params.get(key)?.trim()));
}

export function PalworldPalsPage({
  locale,
  onOpenPal,
  params,
}: {
  locale: PalworldLocale;
  onOpenPal: (id: string) => void;
  params: URLSearchParams;
}) {
  const [facets, setFacets] = useState<PalworldPalListFacets | null>(null);
  const [nameQuery, setNameQuery] = useState(params.get("q") ?? "");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const text = palworldI18n[locale];
  const routeQuery = routeSignature(params);
  const appliedQuery = params.get("q") ?? "";
  const detailFilterCount = palworldPalsDetailFilterCount(params);
  const hasFilters = hasPalworldPalsFilters(params);
  const {
    initialError: error,
    initialLoading: loading,
    loadMore,
    loadMoreError,
    loadMoreLoading,
    response,
    retryInitial,
    retryLoadMore,
  } = usePalworldInfiniteList<PalworldPalListResponse["items"][number], PalworldPalListResponse>({
    initialPage: params.get("page") ?? "1",
    itemKey: (pal) => pal.id,
    loadPage: (page, signal): Promise<PalworldPalListResponse> => {
      const apiParams = new URLSearchParams();
      for (const key of PALWORLD_PALS_ROUTE_KEYS) {
        if (key === "page") continue;
        for (const value of params.getAll(key)) apiParams.append(key, value);
      }
      apiParams.set("page", String(page));
      apiParams.set("locale", locale);
      apiParams.set("limit", "24");
      return getPalworldPals(apiParams, signal);
    },
    queryKey: `${locale}:${routeQuery}`,
  });

  useBodyScrollLock(filterOpen);

  useEffect(() => setNameQuery(appliedQuery), [appliedQuery]);
  useEffect(() => {
    if (response) setFacets(response.facets);
  }, [response]);

  function update(key: PalworldPalsRouteKey, value: string) {
    setPalworldUrl(palworldUrl("pals", updatePalworldPalsParams(params, key, value)));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    update("q", nameQuery.trim());
  }

  function clearFilters() {
    setNameQuery("");
    setPalworldUrl(palworldUrl("pals", clearPalworldPalsFilterParams(params)));
  }

  function removeFilter(key: PalworldPalsFilterKey) {
    update(key, "");
  }

  return (
    <section className="palworld-page-section palworld-pals-page">
      <header className="palworld-page-heading">
        <div>
          <span aria-hidden="true">{text.palsKicker}</span>
          <h1 data-ja={palworldI18n.ja.pals} data-ko={palworldI18n.ko.pals}>{text.pals}</h1>
          <p data-ja={palworldI18n.ja.palsDescription} data-ko={palworldI18n.ko.palsDescription}>{text.palsDescription}</p>
        </div>
      </header>

      <Card as="section" className="palworld-pals-search-card" padding="md">
        <form aria-label={text.nameSearch} className="palworld-pals-search palworld-pal-search-form" onSubmit={submit} role="search">
          <label>
            <span>{text.nameSearch}</span>
            <Input
              aria-label={text.nameSearch}
              placeholder={text.palSearchPlaceholder}
              type="search"
              value={nameQuery}
              onChange={(event) => setNameQuery(event.target.value)}
            />
          </label>
          <Button type="submit">{text.searchAction}</Button>
        </form>
      </Card>

      <div className="palworld-pals-desktop-filter">
        <PalworldPalsDesktopFilterPanel
          clearDisabled={!hasFilters}
          facets={facets}
          locale={locale}
          onClear={clearFilters}
          onUpdate={update}
          params={params}
        />
      </div>

      <Button
        aria-expanded={filterOpen}
        aria-haspopup="dialog"
        className="palworld-pal-mobile-filter-trigger palworld-pals-mobile-filter-trigger"
        data-testid="pal-filter-trigger"
        onClick={() => setFilterOpen(true)}
        ref={filterTriggerRef}
        type="button"
        variant="secondary"
      >
        {text.filterCount.replace("{count}", String(detailFilterCount))}
      </Button>

      <Modal
        className="palworld-pals-filter-modal"
        onClose={() => setFilterOpen(false)}
        open={filterOpen}
        returnFocusRef={filterTriggerRef}
        size="lg"
      >
        <ModalHeader>
          <div>
            <ModalTitle>{text.detailedFilters}</ModalTitle>
            <ModalDescription>{text.detailedFiltersDescription}</ModalDescription>
          </div>
          <ModalCloseButton aria-label={text.closeFilters}>×</ModalCloseButton>
        </ModalHeader>
        <ModalContent>
          <PalworldPalsFilterControls facets={facets} locale={locale} onUpdate={update} params={params} />
        </ModalContent>
        <ModalFooter>
          <Button disabled={!hasFilters} onClick={clearFilters} type="button" variant="ghost">{text.clearFilters}</Button>
          <Button onClick={() => setFilterOpen(false)} type="button">{text.close}</Button>
        </ModalFooter>
      </Modal>

      <PalworldPalsAppliedFilters locale={locale} onRemove={removeFilter} params={params} />

      <PalworldPalsResultToolbar
        loadedCount={response?.items.length ?? 0}
        loading={loading}
        locale={locale}
        onUpdate={update}
        pagination={response?.pagination}
        params={params}
      />

      <div aria-busy={loading || loadMoreLoading} className="palworld-pals-results" data-testid="palworld-pals-results">
        {loading && !error ? <PalworldLoading locale={locale} /> : null}
        {error ? <PalworldError error={error} locale={locale} onRetry={retryInitial} /> : null}
        {!loading && !error && response?.items.length === 0 && response.pagination.total === 0 ? (
          <PalworldEmpty locale={locale} title={text.palListEmpty} />
        ) : null}
        {!loading && !error && response?.items.length === 0 && response.pagination.total > 0 ? (
          <PalworldEmpty description={text.currentPageEmptyDescription} locale={locale} title={text.currentPageEmpty} />
        ) : null}
        {!loading && !error && response?.items.length ? (
          <>
            <div className="palworld-entity-grid palworld-pal-grid">
              {response.items.map((pal, index) => (
                <PalCard key={pal.id} locale={locale} onOpen={(selected) => onOpenPal(selected.id)} pal={pal} priority={index < 4} />
              ))}
            </div>
            <PalworldAutoLoadControl
              error={loadMoreError}
              hasMore={response.pagination.hasNextPage}
              loadedCount={response.items.length}
              loading={loadMoreLoading}
              locale={locale}
              onLoadMore={() => { void loadMore(); }}
              onRetry={() => { void retryLoadMore(); }}
              paused={Boolean(params.get("pal"))}
              total={response.pagination.total}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
