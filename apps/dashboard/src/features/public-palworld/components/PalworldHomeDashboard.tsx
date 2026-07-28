import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  PalworldItemSummary,
  PalworldMetaResponse,
  PalworldPaginatedResponse,
  PalworldPalListResponse,
  PalworldSkillListResponse,
} from "@streamops/shared";
import {
  PublicHomeFeatureCard,
  PublicHomeFeaturePanel,
  type PublicGameHomeLocalizedText,
} from "../../../shared/PublicGameHome";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../../../shared/ui/EmptyState";
import { Button } from "../../../shared/ui/Button";
import { SkeletonCard, SkeletonText } from "../../../shared/ui/Skeleton";
import { Badge, StatusPill } from "../../../shared/ui/Status";
import {
  getPalworldItems,
  getPalworldMeta,
  getPalworldPals,
  getPalworldSkills,
} from "../api/palworld";
import { palworldI18n, type PalworldLocale, type PalworldTextKey } from "../i18n/palworld-i18n";
import { PALWORLD_ELEMENT_IMAGES } from "../utils/element-images";
import {
  categoryLabel,
  elementLabel,
  itemTypeLabel,
  skillTypeLabel,
  workLabel,
} from "../utils/labels";
import { resolvePalworldName } from "../utils/localization";
import { workSuitabilityIconUrl } from "../utils/work-suitability-icons";

export type HomeResource<T> =
  | { state: "loading" }
  | { state: "ready"; data: T }
  | { state: "error" };

export type PalworldHomeDashboardData = {
  items: HomeResource<PalworldPaginatedResponse<PalworldItemSummary>>;
  meta: HomeResource<PalworldMetaResponse>;
  pals: HomeResource<PalworldPalListResponse>;
  skills: HomeResource<PalworldSkillListResponse>;
};

const INITIAL_HOME_DATA: PalworldHomeDashboardData = {
  items: { state: "loading" },
  meta: { state: "loading" },
  pals: { state: "loading" },
  skills: { state: "loading" },
};

function localizedText(
  locale: PalworldLocale,
  key: PalworldTextKey,
): PublicGameHomeLocalizedText {
  return {
    label: palworldI18n[locale][key],
    ko: palworldI18n.ko[key],
    ja: palworldI18n.ja[key],
  };
}

function apiParams(locale: PalworldLocale, limit: number): URLSearchParams {
  return new URLSearchParams({
    limit: String(limit),
    locale,
    page: "1",
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function usePalworldHomeDashboardData(locale: PalworldLocale): {
  data: PalworldHomeDashboardData;
  retry: () => void;
} {
  const [data, setData] = useState<PalworldHomeDashboardData>(INITIAL_HOME_DATA);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(INITIAL_HOME_DATA);

    void getPalworldMeta(controller.signal)
      .then((meta) => {
        if (!controller.signal.aborted) {
          setData((current) => ({ ...current, meta: { state: "ready", data: meta } }));
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setData((current) => ({ ...current, meta: { state: "error" } }));
        }
      });

    void getPalworldPals(apiParams(locale, 5), controller.signal)
      .then((pals) => {
        if (!controller.signal.aborted) {
          setData((current) => ({ ...current, pals: { state: "ready", data: pals } }));
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setData((current) => ({ ...current, pals: { state: "error" } }));
        }
      });

    void getPalworldItems(apiParams(locale, 3), controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setData((current) => ({ ...current, items: { state: "ready", data: items } }));
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setData((current) => ({ ...current, items: { state: "error" } }));
        }
      });

    void getPalworldSkills(apiParams(locale, 1), controller.signal)
      .then((skills) => {
        if (!controller.signal.aborted) {
          setData((current) => ({ ...current, skills: { state: "ready", data: skills } }));
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setData((current) => ({ ...current, skills: { state: "error" } }));
        }
      });

    return () => controller.abort();
  }, [locale, revision]);

  return {
    data,
    retry: () => setRevision((current) => current + 1),
  };
}

function PalworldHomeIcon({
  kind,
}: {
  kind: "breeding" | "items" | "map" | "pals" | "skills" | "technology";
}) {
  const common = {
    "aria-hidden": true,
    fill: "none",
    height: 32,
    viewBox: "0 0 24 24",
    width: 32,
  };
  if (kind === "pals") return <svg {...common}><path d="M7 11c-2-4-1-7 1-8 2 1 3 3 3 5m6 3c2-4 1-7-1-8-2 1-3 3-3 5" /><path d="M5 14c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7Z" /><path d="M9 14h.01M15 14h.01M10 17c1 .7 3 .7 4 0" /></svg>;
  if (kind === "breeding") return <svg {...common}><path d="M12 20s-8-4.6-8-10a4 4 0 0 1 7-2.7A4 4 0 0 1 18 10c0 5.4-6 10-6 10Z" /><path d="M12 7.3V20" /></svg>;
  if (kind === "map") return <svg {...common}><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15m6-12v15" /><circle cx="15" cy="10" r="2" /></svg>;
  if (kind === "technology") return <svg {...common}><path d="M9 3h6l1 4 3 2v6l-3 2-1 4H9l-1-4-3-2V9l3-2 1-4Z" /><circle cx="12" cy="12" r="3" /></svg>;
  if (kind === "skills") return <svg {...common}><path d="m13 2-7 11h6l-1 9 7-12h-6l1-8Z" /></svg>;
  return <svg {...common}><path d="M6 3h12v18H6z" /><path d="M9 7h6M9 11h6M9 15h4" /></svg>;
}

function navigateAnchor(
  href: string,
  onNavigate: (href: string) => void,
): { href: string; onClick: () => void } {
  return { href, onClick: () => onNavigate(href) };
}

export function PalworldHomeQuickSearch({
  data,
  locale,
  onOpenItem,
  onOpenPal,
}: {
  data: PalworldHomeDashboardData;
  locale: PalworldLocale;
  onOpenItem: (id: string) => void;
  onOpenPal: (id: string) => void;
}) {
  const quickEntries = useMemo(() => {
    const pals = data.pals.state === "ready"
      ? data.pals.data.items.slice(0, 3).map((pal) => ({ kind: "pal" as const, value: pal }))
      : [];
    const items = data.items.state === "ready"
      ? data.items.data.items.slice(0, 2).map((item) => ({ kind: "item" as const, value: item }))
      : [];
    return [...pals, ...items].slice(0, 5);
  }, [data.items, data.pals]);

  if (data.pals.state === "loading" || data.items.state === "loading") {
    return (
      <div className="palworld-home-quick-search" aria-label={palworldI18n[locale].homeQuickSearch}>
        <span>{palworldI18n[locale].homeQuickSearch}</span>
        <span className="palworld-home-quick-search__loading" aria-hidden="true" />
      </div>
    );
  }
  if (quickEntries.length === 0) return null;

  return (
    <div className="palworld-home-quick-search" aria-label={palworldI18n[locale].homeQuickSearch}>
      <span data-ko={palworldI18n.ko.homeQuickSearch} data-ja={palworldI18n.ja.homeQuickSearch}>
        {palworldI18n[locale].homeQuickSearch}
      </span>
      <div className="palworld-home-quick-search__list">
        {quickEntries.map((entry) => {
          const name = resolvePalworldName(entry.value, locale).text;
          return (
            <button
              aria-label={`${name} ${entry.kind === "pal" ? palworldI18n[locale].palEntityLabel : palworldI18n[locale].items}`}
              key={`${entry.kind}:${entry.value.id}`}
              onClick={() => entry.kind === "pal" ? onOpenPal(entry.value.id) : onOpenItem(entry.value.id)}
              type="button"
            >
              <span>{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuickExploreVisual({ children }: { children: ReactNode }) {
  return <span className="palworld-home-quick-visual">{children}</span>;
}

export function PalworldHomePrimaryFeatures({
  locale,
  onNavigate,
}: {
  locale: PalworldLocale;
  onNavigate: (href: string) => void;
}) {
  return (
    <PublicHomeFeaturePanel
      className="public-game-home__feature-panel--primary palworld-home-primary-features"
      title={localizedText(locale, "homePrimaryTools")}
    >
      <PublicHomeFeatureCard
        {...navigateAnchor("/palworld/pals", onNavigate)}
        description={localizedText(locale, "homePalsDescription")}
        title={localizedText(locale, "pals")}
        visual={<PalworldHomeIcon kind="pals" />}
      />
      <PublicHomeFeatureCard
        {...navigateAnchor("/palworld/breeding", onNavigate)}
        description={localizedText(locale, "homeBreedingDescription")}
        title={localizedText(locale, "breeding")}
        visual={<PalworldHomeIcon kind="breeding" />}
      />
      <PublicHomeFeatureCard
        {...navigateAnchor("/palworld/map", onNavigate)}
        description={localizedText(locale, "homeMapDescription")}
        title={localizedText(locale, "map")}
        visual={<PalworldHomeIcon kind="map" />}
      />
    </PublicHomeFeaturePanel>
  );
}

export function PalworldHomeQuickExplore({
  data,
  locale,
  onNavigate,
}: {
  data: PalworldHomeDashboardData;
  locale: PalworldLocale;
  onNavigate: (href: string) => void;
}) {
  const element = data.pals.state === "ready" ? data.pals.data.facets.elements[0]?.value : undefined;
  const work = data.pals.state === "ready" ? data.pals.data.facets.workSuitabilities[0]?.value : undefined;
  const firstItem = data.items.state === "ready" ? data.items.data.items[0] : undefined;
  const skillType = data.skills.state === "ready" ? data.skills.data.facets.types[0]?.value : undefined;
  const elementImage = element ? PALWORLD_ELEMENT_IMAGES[element] : undefined;
  const workImage = work ? workSuitabilityIconUrl(work) : undefined;
  const itemFilter = firstItem?.itemType
    ? { key: "itemType", value: firstItem.itemType, label: itemTypeLabel(firstItem.itemType, locale) }
    : firstItem
      ? { key: "category", value: firstItem.category, label: categoryLabel(firstItem.category, locale) }
      : undefined;

  return (
    <PublicHomeFeaturePanel
      className="palworld-home-quick-explore"
      title={localizedText(locale, "homeQuickExplore")}
    >
      <PublicHomeFeatureCard
        {...navigateAnchor(`/palworld/pals${element ? `?element=${encodeURIComponent(element)}` : ""}`, onNavigate)}
        description={{
          ...localizedText(locale, "homeAttributePalsDescription"),
          label: element ? elementLabel(element, locale) : palworldI18n[locale].homeAttributePalsDescription,
        }}
        title={localizedText(locale, "homeAttributePals")}
        visual={<QuickExploreVisual>{elementImage ? <img alt="" height={elementImage.height} src={elementImage.imageUrl} width={elementImage.width} /> : <PalworldHomeIcon kind="pals" />}</QuickExploreVisual>}
      />
      <PublicHomeFeatureCard
        {...navigateAnchor(`/palworld/pals${work ? `?work=${encodeURIComponent(work)}` : ""}`, onNavigate)}
        description={{
          ...localizedText(locale, "homeWorkPalsDescription"),
          label: work ? workLabel(work, locale) : palworldI18n[locale].homeWorkPalsDescription,
        }}
        title={localizedText(locale, "homeWorkPals")}
        visual={<QuickExploreVisual>{workImage ? <img alt="" height={64} src={workImage} width={64} /> : <PalworldHomeIcon kind="technology" />}</QuickExploreVisual>}
      />
      <PublicHomeFeatureCard
        {...navigateAnchor(`/palworld/items${itemFilter ? `?${itemFilter.key}=${encodeURIComponent(itemFilter.value)}` : ""}`, onNavigate)}
        description={{
          ...localizedText(locale, "homeItemTypesDescription"),
          label: itemFilter?.label ?? palworldI18n[locale].homeItemTypesDescription,
        }}
        title={localizedText(locale, "homeItemTypes")}
        visual={<PalworldHomeIcon kind="items" />}
      />
      <PublicHomeFeatureCard
        {...navigateAnchor(`/palworld/skills${skillType ? `?type=${encodeURIComponent(skillType)}` : ""}`, onNavigate)}
        description={{
          ...localizedText(locale, "homeSkillTypesDescription"),
          label: skillType ? skillTypeLabel(skillType, locale) : palworldI18n[locale].homeSkillTypesDescription,
        }}
        title={localizedText(locale, "homeSkillTypes")}
        visual={<PalworldHomeIcon kind="skills" />}
      />
      <a className="palworld-home-quick-explore__all" href="/palworld/pals" onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNavigate("/palworld/pals");
      }}>
        <span data-ko={palworldI18n.ko.homeAllFilters} data-ja={palworldI18n.ja.homeAllFilters}>
          {palworldI18n[locale].homeAllFilters}
        </span>
        <span aria-hidden="true">›</span>
      </a>
    </PublicHomeFeaturePanel>
  );
}

function HomePanelLoading({
  label,
}: {
  label: string;
}) {
  return (
    <SkeletonCard className="palworld-home-dashboard-panel" loadingLabel={label} size="md">
      <SkeletonText lines={4} size="md" />
    </SkeletonCard>
  );
}

function HomePanelError({
  locale,
  onRetry,
}: {
  locale: PalworldLocale;
  onRetry: () => void;
}) {
  return (
    <EmptyState className="palworld-home-panel-error" role="alert" variant="error">
      <EmptyStateIcon>!</EmptyStateIcon>
      <EmptyStateTitle as="h3">{palworldI18n[locale].homeDataLoadError}</EmptyStateTitle>
      <EmptyStateDescription>{palworldI18n[locale].homeDataLoadErrorDescription}</EmptyStateDescription>
      <EmptyStateActions>
        <Button onClick={onRetry} size="sm" variant="secondary">{palworldI18n[locale].retry}</Button>
      </EmptyStateActions>
    </EmptyState>
  );
}

function dataState(meta: PalworldMetaResponse): {
  key: "homeDataIncomplete" | "homeDataReady" | "homeDataUnavailable";
  tone: "success" | "warning" | "danger";
} {
  const statuses = Object.values(meta.domains).flatMap((domain) => domain ? [domain.status] : []);
  if (!meta.gates.dataIntegrity.passed || statuses.includes("unavailable")) {
    return { key: "homeDataUnavailable", tone: "danger" };
  }
  if (statuses.includes("sample") || statuses.includes("incomplete")) {
    return { key: "homeDataIncomplete", tone: "warning" };
  }
  return { key: "homeDataReady", tone: "success" };
}

export function PalworldHomeDataStatus({
  locale,
  meta,
  onRetry,
}: {
  locale: PalworldLocale;
  meta: HomeResource<PalworldMetaResponse>;
  onRetry: () => void;
}) {
  if (meta.state === "loading") return <HomePanelLoading label={palworldI18n[locale].loading} />;
  if (meta.state === "error") return <section className="palworld-home-dashboard-panel palworld-home-dashboard-panel--data"><HomePanelError locale={locale} onRetry={onRetry} /></section>;
  const status = dataState(meta.data);
  const rows = [
    { key: "pals" as const, count: meta.data.counts.pals },
    { key: "items" as const, count: meta.data.counts.items },
    ...(meta.data.counts.skills === undefined ? [] : [{ key: "skills" as const, count: meta.data.counts.skills }]),
    { key: "homeBreedingPairs" as const, count: meta.data.counts.breedingPairs },
  ];

  return (
    <section aria-labelledby="palworld-home-data-title" className="palworld-home-dashboard-panel palworld-home-dashboard-panel--data">
      <header className="palworld-home-dashboard-panel__header">
        <h2 id="palworld-home-data-title">{palworldI18n[locale].homeDataStatus}</h2>
        <StatusPill size="sm" tone={status.tone}>{palworldI18n[locale][status.key]}</StatusPill>
      </header>
      <dl className="palworld-home-data-list">
        {rows.map((row) => (
          <div key={row.key}>
            <dt>{palworldI18n[locale][row.key]}</dt>
            <dd>{row.count.toLocaleString(locale === "ja" ? "ja-JP" : "ko-KR")}</dd>
          </div>
        ))}
      </dl>
      <p className="palworld-home-data-version">
        <span>{palworldI18n[locale].dataVersion}</span>
        <strong>{meta.data.metadata.release ?? meta.data.metadata.gameVersion}</strong>
      </p>
    </section>
  );
}

function formatVerifiedAt(locale: PalworldLocale, value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function PalworldHomeUpdates({
  locale,
  meta,
  onRetry,
}: {
  locale: PalworldLocale;
  meta: HomeResource<PalworldMetaResponse>;
  onRetry: () => void;
}) {
  if (meta.state === "loading") return <HomePanelLoading label={palworldI18n[locale].loading} />;
  if (meta.state === "error") return <section className="palworld-home-dashboard-panel palworld-home-dashboard-panel--updates"><HomePanelError locale={locale} onRetry={onRetry} /></section>;

  return (
    <section aria-labelledby="palworld-home-updates-title" className="palworld-home-dashboard-panel palworld-home-dashboard-panel--updates">
      <header className="palworld-home-dashboard-panel__header">
        <h2 id="palworld-home-updates-title">{palworldI18n[locale].homeLatestUpdates}</h2>
      </header>
      <article className="palworld-home-release">
        <Badge size="sm" tone="success">{palworldI18n[locale].homeVerifiedRelease}</Badge>
        <div>
          <strong>{meta.data.metadata.release ?? meta.data.metadata.gameVersion}</strong>
          <p>{palworldI18n[locale].homeReleaseDescription}</p>
        </div>
        <time dateTime={meta.data.metadata.verifiedAt}>
          {formatVerifiedAt(locale, meta.data.metadata.verifiedAt)}
        </time>
      </article>
    </section>
  );
}

export function PalworldHomeMoreFeatures({
  locale,
  onNavigate,
}: {
  locale: PalworldLocale;
  onNavigate: (href: string) => void;
}) {
  return (
    <PublicHomeFeaturePanel
      className="palworld-home-dashboard-panel palworld-home-dashboard-panel--more"
      title={localizedText(locale, "homeMoreFeatures")}
    >
      <PublicHomeFeatureCard
        {...navigateAnchor("/palworld/items", onNavigate)}
        description={localizedText(locale, "homeItemsDescription")}
        title={localizedText(locale, "items")}
        visual={<PalworldHomeIcon kind="items" />}
      />
      <PublicHomeFeatureCard
        {...navigateAnchor("/palworld/technology", onNavigate)}
        description={localizedText(locale, "homeTechnologyDescription")}
        title={localizedText(locale, "technology")}
        visual={<PalworldHomeIcon kind="technology" />}
      />
      <PublicHomeFeatureCard
        {...navigateAnchor("/palworld/skills", onNavigate)}
        description={localizedText(locale, "homeSkillsDescription")}
        title={localizedText(locale, "skills")}
        visual={<PalworldHomeIcon kind="skills" />}
      />
      <PublicHomeFeatureCard
        {...navigateAnchor("/palworld/map", onNavigate)}
        description={localizedText(locale, "homeMapDescription")}
        title={localizedText(locale, "map")}
        visual={<PalworldHomeIcon kind="map" />}
      />
    </PublicHomeFeaturePanel>
  );
}

export function PalworldHomeDashboard({
  data,
  locale,
  onNavigate,
  onRetry,
}: {
  data: PalworldHomeDashboardData;
  locale: PalworldLocale;
  onNavigate: (href: string) => void;
  onRetry: () => void;
}) {
  return (
    <>
      <div className="palworld-home-dashboard-main">
        <PalworldHomePrimaryFeatures locale={locale} onNavigate={onNavigate} />
        <PalworldHomeQuickExplore data={data} locale={locale} onNavigate={onNavigate} />
      </div>
      <div className="palworld-home-dashboard-bottom">
        <PalworldHomeDataStatus locale={locale} meta={data.meta} onRetry={onRetry} />
        <PalworldHomeUpdates locale={locale} meta={data.meta} onRetry={onRetry} />
        <PalworldHomeMoreFeatures locale={locale} onNavigate={onNavigate} />
      </div>
    </>
  );
}
