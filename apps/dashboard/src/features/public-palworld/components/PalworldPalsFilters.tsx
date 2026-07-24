import { useEffect, useState } from "react";
import {
  PALWORLD_ELEMENTS,
  PALWORLD_VARIANT_TYPES,
  PALWORLD_WORK_SUITABILITY_TYPES,
  type PalworldElement,
  type PalworldPagination,
  type PalworldPalListFacets,
  type PalworldWorkSuitabilityType,
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Select } from "../../../shared/ui/Form";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { isLocalPalworldElementImageUrl, PALWORLD_ELEMENT_IMAGES } from "../utils/element-images";
import { elementLabel, workLabel } from "../utils/labels";
import type { PalworldPalsFilterKey, PalworldPalsRouteKey } from "../utils/pals";
import { workSuitabilityFilterIconUrl } from "../utils/work-suitability-icons";

type FilterUpdate = (key: PalworldPalsRouteKey, value: string) => void;

function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function includesValue<T extends string>(values: readonly T[], value: string | null): value is T {
  return value !== null && values.includes(value as T);
}

function ElementFilterIcon({ element }: { element: PalworldElement }) {
  const asset = PALWORLD_ELEMENT_IMAGES[element];
  const imageUrl = asset && isLocalPalworldElementImageUrl(asset.imageUrl)
    ? asset.imageUrl
    : undefined;
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [imageUrl]);
  if (!asset || !imageUrl || failed) return null;

  return (
    <img
      alt=""
      aria-hidden="true"
      className="palworld-pal-filter-element-icon"
      decoding="async"
      height={asset.height}
      onError={() => setFailed(true)}
      src={imageUrl}
      width={asset.width}
    />
  );
}

function WorkFilterIcon({ type }: { type: PalworldWorkSuitabilityType }) {
  const imageUrl = workSuitabilityFilterIconUrl(type);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [imageUrl]);
  if (!imageUrl || failed) return null;

  return (
    <img
      alt=""
      aria-hidden="true"
      className="palworld-pal-filter-work-icon"
      decoding="async"
      height="64"
      onError={() => setFailed(true)}
      src={imageUrl}
      width="64"
    />
  );
}

function FilterCheck({ selected }: { selected: boolean }) {
  return selected ? <span aria-hidden="true" className="palworld-pal-filter-check">✓</span> : null;
}

export function PalworldPalsFilterControls({
  facets,
  locale,
  onUpdate,
  params,
}: {
  facets: PalworldPalListFacets | null;
  locale: PalworldLocale;
  onUpdate: FilterUpdate;
  params: URLSearchParams;
}) {
  const text = palworldI18n[locale];
  const selectedElement = params.get("element");
  const selectedWork = params.get("work");
  const selectedRarity = params.get("rarity") ?? "";
  const selectedVariant = params.get("variant") ?? "";

  return (
    <div aria-busy={!facets} className="palworld-pal-filter-controls">
      <fieldset className="palworld-pal-filter-group">
        <legend>{text.element}</legend>
        <div className="palworld-pal-filter-options">
          <button
            aria-label={text.selectAllElements}
            aria-pressed={!selectedElement}
            className="palworld-pal-filter-option"
            onClick={() => onUpdate("element", "")}
            type="button"
          >
            <FilterCheck selected={!selectedElement} />
            <span>{text.all}</span>
          </button>
          {facets?.elements.map((facet) => {
            const selected = selectedElement === facet.value;
            return (
              <button
                aria-pressed={selected}
                className="palworld-pal-filter-option"
                key={facet.value}
                onClick={() => onUpdate("element", selected ? "" : facet.value)}
                type="button"
              >
                <FilterCheck selected={selected} />
                <ElementFilterIcon element={facet.value} />
                <span>{elementLabel(facet.value, locale)}</span>
                <small>{interpolate(text.filterOptionCount, { count: facet.count })}</small>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="palworld-pal-filter-group">
        <legend>{text.work}</legend>
        <div className="palworld-pal-filter-options is-work">
          <button
            aria-label={text.selectAllWorkSuitabilities}
            aria-pressed={!selectedWork}
            className="palworld-pal-filter-option"
            onClick={() => onUpdate("work", "")}
            type="button"
          >
            <FilterCheck selected={!selectedWork} />
            <span>{text.all}</span>
          </button>
          {facets?.workSuitabilities.map((facet) => {
            const selected = selectedWork === facet.value;
            return (
              <button
                aria-pressed={selected}
                className="palworld-pal-filter-option"
                key={facet.value}
                onClick={() => onUpdate("work", selected ? "" : facet.value)}
                type="button"
              >
                <FilterCheck selected={selected} />
                <WorkFilterIcon type={facet.value} />
                <span>{workLabel(facet.value, locale)}</span>
                <small>{interpolate(text.filterOptionCount, { count: facet.count })}</small>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="palworld-pal-filter-group is-other">
        <legend>{text.otherFilters}</legend>
        <div className="palworld-pal-filter-selects">
          <label>
            <span>{text.rarity}</span>
            <Select value={selectedRarity} onChange={(event) => onUpdate("rarity", event.target.value)}>
              <option value="">{text.all}</option>
              {facets?.rarities.map((facet) => (
                <option value={facet.value} key={facet.value}>
                  ★ {facet.value} · {interpolate(text.filterOptionCount, { count: facet.count })}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span>{text.variant}</span>
            <Select value={selectedVariant} onChange={(event) => onUpdate("variant", event.target.value)}>
              <option value="">{text.all}</option>
              {facets?.variants.map((facet) => (
                <option value={facet.value} key={facet.value}>
                  {facet.value === "normal" ? text.normal : facet.value === "variant" ? text.variantPal : text.specialVariant}
                  {" · "}
                  {interpolate(text.filterOptionCount, { count: facet.count })}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </fieldset>
    </div>
  );
}

type AppliedFilter = {
  key: PalworldPalsFilterKey;
  label: string;
  removeLabel: string;
};

function appliedFilters(
  locale: PalworldLocale,
  params: URLSearchParams,
): AppliedFilter[] {
  const text = palworldI18n[locale];
  const filters: AppliedFilter[] = [];
  const query = params.get("q")?.trim();
  if (query) {
    filters.push({
      key: "q",
      label: interpolate(text.searchFilterChip, { value: query }),
      removeLabel: interpolate(text.removeFilter, { value: query }),
    });
  }
  const element = params.get("element");
  if (includesValue(PALWORLD_ELEMENTS, element)) {
    const label = elementLabel(element, locale);
    filters.push({
      key: "element",
      label: interpolate(text.elementFilterChip, { value: label }),
      removeLabel: interpolate(text.removeElementFilter, { value: label }),
    });
  }
  const work = params.get("work");
  if (includesValue(PALWORLD_WORK_SUITABILITY_TYPES, work)) {
    const label = workLabel(work, locale);
    filters.push({
      key: "work",
      label: interpolate(text.workFilterChip, { value: label }),
      removeLabel: interpolate(text.removeWorkFilter, { value: label }),
    });
  }
  const rarity = params.get("rarity")?.trim();
  if (rarity) {
    const label = interpolate(text.rarityFilterChip, { value: rarity });
    filters.push({
      key: "rarity",
      label,
      removeLabel: interpolate(text.removeFilter, { value: label }),
    });
  }
  const variant = params.get("variant");
  if (includesValue(PALWORLD_VARIANT_TYPES, variant)) {
    const variantLabel = variant === "normal" ? text.normal : variant === "variant" ? text.variantPal : text.specialVariant;
    const label = interpolate(text.variantFilterChip, { value: variantLabel });
    filters.push({
      key: "variant",
      label,
      removeLabel: interpolate(text.removeFilter, { value: label }),
    });
  }
  return filters;
}

export function PalworldPalsAppliedFilters({
  locale,
  onRemove,
  params,
}: {
  locale: PalworldLocale;
  onRemove: (key: PalworldPalsFilterKey) => void;
  params: URLSearchParams;
}) {
  const text = palworldI18n[locale];
  const filters = appliedFilters(locale, params);
  if (filters.length === 0) return null;

  return (
    <section aria-label={text.filtersApplied} className="palworld-pal-applied-filters">
      <strong>{text.filtersApplied}</strong>
      <div className="palworld-pal-filter-chip-list">
        {filters.map((filter) => (
          <span className="palworld-pal-filter-chip" key={filter.key}>
            <span>{filter.label}</span>
            <button aria-label={filter.removeLabel} onClick={() => onRemove(filter.key)} type="button">
              <span aria-hidden="true">×</span>
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}

export function PalworldPalsResultToolbar({
  loadedCount,
  loading,
  locale,
  onUpdate,
  pagination,
  params,
}: {
  loadedCount: number;
  loading: boolean;
  locale: PalworldLocale;
  onUpdate: FilterUpdate;
  pagination?: PalworldPagination;
  params: URLSearchParams;
}) {
  const text = palworldI18n[locale];
  const order = params.get("order") === "desc" ? "desc" : "asc";
  const summary = loading || !pagination
    ? text.matchingPalsLoading
    : interpolate(text.matchingPals, {
      count: pagination.total.toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR"),
      loaded: loadedCount.toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR"),
    });

  return (
    <div className="palworld-pal-result-toolbar">
      <p aria-live="polite" className="palworld-pal-result-summary">{summary}</p>
      <div className="palworld-pal-sort-controls">
        <label>
          <span>{text.sort}</span>
          <Select value={params.get("sort") ?? "number"} onChange={(event) => onUpdate("sort", event.target.value)}>
            <option value="number">{text.number}</option>
            <option value="name">{text.name}</option>
            <option value="rarity">{text.rarity}</option>
          </Select>
        </label>
        <Button
          aria-label={order === "asc" ? text.changeSortAscending : text.changeSortDescending}
          className="palworld-pal-sort-order"
          onClick={() => onUpdate("order", order === "asc" ? "desc" : "asc")}
          size="sm"
          type="button"
          variant="secondary"
        >
          <span aria-hidden="true">{order === "asc" ? "↑" : "↓"}</span>
          {order === "asc" ? text.ascending : text.descending}
        </Button>
      </div>
    </div>
  );
}

export function PalworldPalsDesktopFilterPanel({
  clearDisabled,
  facets,
  locale,
  onClear,
  onUpdate,
  params,
}: {
  clearDisabled: boolean;
  facets: PalworldPalListFacets | null;
  locale: PalworldLocale;
  onClear: () => void;
  onUpdate: FilterUpdate;
  params: URLSearchParams;
}) {
  const text = palworldI18n[locale];
  return (
    <Card as="section" className="palworld-pal-filter-panel" padding="md">
      <div className="palworld-pal-filter-panel-heading">
        <h2>{text.detailedFilters}</h2>
        <Button disabled={clearDisabled} onClick={onClear} size="sm" type="button" variant="ghost">
          {text.clearFilters}
        </Button>
      </div>
      <PalworldPalsFilterControls facets={facets} locale={locale} onUpdate={onUpdate} params={params} />
    </Card>
  );
}
