import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  PalworldPaginatedResponse,
  PalworldTechnologyUnlockSummary,
} from "@streamops/shared";
import { PALWORLD_SEARCH_MAX_LENGTH } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Card, CardContent } from "../../../shared/ui/Card";
import { Input, Select } from "../../../shared/ui/Form";
import { getPalworldTechnologyUnlocks } from "../api/palworld";
import { usePalworldInfiniteList } from "../hooks/usePalworldInfiniteList";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import {
  categoryLabel,
  itemRarityBand,
  itemTypeLabel,
} from "../utils/labels";
import { resolvePalworldName } from "../utils/localization";
import { setPalworldUrl } from "../utils/routes";
import { groupTechnologyUnlockItems } from "../utils/technology";
import { PalworldAutoLoadControl } from "./PalworldAutoLoadControl";
import { PalworldItemMedia, PalworldMedia } from "./PalworldMedia";
import { PalworldPreviousLoadControl } from "./PalworldPreviousLoadControl";
import { PalworldEmpty, PalworldError, PalworldLoading } from "./PalworldStates";

const FILTER_KEYS = ["q", "order", "page"] as const;

export function TechnologyUnlockCard({
  unlock,
  locale,
  onOpen,
  priority = false,
}: {
  unlock: PalworldTechnologyUnlockSummary;
  locale: PalworldLocale;
  onOpen: (id: string) => void;
  priority?: boolean;
}) {
  const text = palworldI18n[locale];
  const item = unlock.kind === "item" ? unlock.item : undefined;
  const name = resolvePalworldName(item ?? unlock, locale).text;
  const technologyPalName = item?.technologyPal
    ? resolvePalworldName(item.technologyPal, locale).text
    : undefined;
  const rarityBand = item ? itemRarityBand(item.rarity) : "common";

  return (
    <Card
      {...(item ? {
        "aria-haspopup": "dialog" as const,
        "aria-label": text.openTechnologyItem.replace("{name}", name),
        onClick: () => onOpen(item.id),
      } : {})}
      as="article"
      className="palworld-entity-card palworld-technology-card"
      data-rarity-band={rarityBand}
      data-technology-kind={unlock.kind}
      data-technology-level={unlock.technologyLevel}
      data-testid="technology-unlock-card"
      padding="none"
      variant={item ? "interactive" : "default"}
    >
      <div className="palworld-entity-media palworld-technology-card-media" data-rarity-band={rarityBand}>
        {item?.technologyPal && technologyPalName ? (
          <PalworldMedia
            alt={technologyPalName}
            imageUrl={item.technologyPal.imageUrl}
            intrinsicHeight={item.technologyPal.imageHeight}
            intrinsicWidth={item.technologyPal.imageWidth}
            kind="pal"
            locale={locale}
            priority={priority}
          />
        ) : item ? (
          <PalworldItemMedia alt={name} item={item} locale={locale} priority={priority} />
        ) : unlock.kind === "building" ? (
          <PalworldMedia
            alt={name}
            imageUrl={unlock.imageUrl}
            intrinsicHeight={unlock.imageHeight}
            intrinsicWidth={unlock.imageWidth}
            kind="building"
            locale={locale}
            priority={priority}
          />
        ) : null}
      </div>
      <CardContent>
        <h3 title={name}>{name}</h3>
        <p className="palworld-technology-card-type">
          {item
            ? item.itemType
              ? itemTypeLabel(item.itemType, locale)
              : categoryLabel(item.category, locale)
            : text.technologyBuilding}
        </p>
      </CardContent>
    </Card>
  );
}

export function PalworldTechnologyPage({
  locale,
  onOpenItem,
  params,
}: {
  locale: PalworldLocale;
  onOpenItem: (id: string) => void;
  params: URLSearchParams;
}) {
  const text = palworldI18n[locale];
  const [nameQuery, setNameQuery] = useState(params.get("q") ?? "");
  const routeQuery = FILTER_KEYS.map((key) => `${key}=${params.get(key) ?? ""}`).join("&");
  const {
    initialError: error,
    initialLoading: loading,
    hasPreviousPage,
    loadMore,
    loadMoreError,
    loadMoreLoading,
    loadMoreRetryBlocked,
    loadPrevious,
    loadPreviousError,
    loadPreviousLoading,
    loadPreviousRetryBlocked,
    response,
    retryInitial,
    retryLoadMore,
    retryLoadPrevious,
  } = usePalworldInfiniteList<
    PalworldTechnologyUnlockSummary,
    PalworldPaginatedResponse<PalworldTechnologyUnlockSummary>
  >({
    initialPage: params.get("page") ?? "1",
    itemKey: (item) => item.id,
    loadPage: (page, signal) => {
      const apiParams = new URLSearchParams({
        order: params.get("order") === "desc" ? "desc" : "asc",
        page: String(page),
        locale,
        limit: "24",
      });
      const query = params.get("q")?.trim();
      if (query) apiParams.set("q", query);
      return getPalworldTechnologyUnlocks(apiParams, signal);
    },
    paused: Boolean(params.get("item")),
    queryKey: `${locale}:${routeQuery}`,
  });
  const technologyGroups = useMemo(
    () => groupTechnologyUnlockItems(response?.items ?? []),
    [response?.items],
  );
  const priorityItemIds = useMemo(
    () => new Set((response?.items ?? []).slice(0, 6).map((item) => item.id)),
    [response?.items],
  );

  useEffect(() => setNameQuery(params.get("q") ?? ""), [routeQuery]);

  function update(key: "q" | "order", value: string) {
    const next = new URLSearchParams(params);
    next.delete("item");
    next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    setPalworldUrl(`/palworld/technology${next.toString() ? `?${next}` : ""}`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    update("q", nameQuery.trim());
  }

  return (
    <section aria-labelledby="palworld-technology-title" className="palworld-page-section palworld-technology-page">
      <h1
        className="yoro-u-sr-only"
        data-ja={palworldI18n.ja.technologyTitle}
        data-ko={palworldI18n.ko.technologyTitle}
        id="palworld-technology-title"
      >
        {text.technologyTitle}
      </h1>
      <form aria-label={text.technologyFilters} className="palworld-technology-toolbar" onSubmit={submit}>
        <label className="palworld-technology-search">
          <span>{text.nameSearch}</span>
          <Input
            maxLength={PALWORLD_SEARCH_MAX_LENGTH}
            onChange={(event) => setNameQuery(event.target.value)}
            placeholder={text.technologySearchPlaceholder}
            type="search"
            value={nameQuery}
          />
        </label>
        <label>
          <span>{text.sortOrder}</span>
          <Select
            onChange={(event) => update("order", event.target.value)}
            value={params.get("order") === "desc" ? "desc" : "asc"}
          >
            <option value="asc">{text.technologyLevelAscending}</option>
            <option value="desc">{text.technologyLevelDescending}</option>
          </Select>
        </label>
        <Button size="sm" type="submit">{text.searchAction}</Button>
        <Button
          onClick={() => setPalworldUrl("/palworld/technology")}
          size="sm"
          type="button"
          variant="ghost"
        >
          {text.clearFilters}
        </Button>
      </form>
      {loading && !error ? <PalworldLoading locale={locale} /> : null}
      {error ? <PalworldError error={error} locale={locale} onRetry={retryInitial} /> : null}
      {response?.items.length === 0 ? (
        <PalworldEmpty locale={locale} title={text.technologyListEmpty} />
      ) : null}
      {response?.items.length ? (
        <>
          <div aria-live="polite" className="palworld-result-count">
            {text.technologyResults.replace(
              "{count}",
              response.pagination.total.toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR"),
            )}
          </div>
          <PalworldPreviousLoadControl
            error={loadPreviousError}
            hasPrevious={hasPreviousPage}
            loading={loadPreviousLoading}
            locale={locale}
            onLoadPrevious={() => { void loadPrevious(); }}
            onRetry={() => { void retryLoadPrevious(); }}
            paused={Boolean(params.get("item"))}
            retryBlocked={loadPreviousRetryBlocked}
          />
          <div
            aria-busy={loadMoreLoading || loadPreviousLoading}
            className="palworld-technology-level-list"
            data-order={params.get("order") === "desc" ? "desc" : "asc"}
          >
            {technologyGroups.map((group) => {
              const formattedLevel = group.level.toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR");
              const headingId = `palworld-technology-level-${group.level}`;
              return (
                <section
                  aria-labelledby={headingId}
                  className="palworld-technology-level-group"
                  data-technology-level={group.level}
                  key={group.level}
                >
                  <header className="palworld-technology-level-rail">
                    <h2 className="yoro-u-sr-only" id={headingId}>
                      {text.technologyLevelGroup.replace("{level}", formattedLevel)}
                    </h2>
                    <div aria-hidden="true" className="palworld-technology-level-marker">
                      <span>{formattedLevel}</span>
                    </div>
                  </header>
                  <div className="palworld-technology-level-grid">
                    {group.items.map((item) => (
                      <TechnologyUnlockCard
                        unlock={item}
                        key={item.id}
                        locale={locale}
                        onOpen={onOpenItem}
                        priority={priorityItemIds.has(item.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <PalworldAutoLoadControl
            error={loadMoreError}
            hasMore={response.pagination.hasNextPage}
            loadedCount={response.items.length}
            loading={loadMoreLoading}
            locale={locale}
            onLoadMore={() => { void loadMore(); }}
            onRetry={() => { void retryLoadMore(); }}
            paused={Boolean(params.get("item"))}
            retryBlocked={loadMoreRetryBlocked}
            total={response.pagination.total}
          />
        </>
      ) : null}
    </section>
  );
}
