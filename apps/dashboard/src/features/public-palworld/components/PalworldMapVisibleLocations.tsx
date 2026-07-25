import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../../../shared/ui/EmptyState";
import { Skeleton, SkeletonText } from "../../../shared/ui/Skeleton";
import { Badge } from "../../../shared/ui/Status";
import type { PalworldLocale } from "../i18n/palworld-i18n";
import {
  resolvePalworldMapLabel,
  type PalworldMapLayerDisplayState,
  type PalworldMapLocalizedLabel,
  type PalworldMapVisibleLocation,
} from "./PalworldMapExplorerTypes";

export type PalworldMapVisibleLocationsCopy = {
  title: PalworldMapLocalizedLabel;
  loading: PalworldMapLocalizedLabel;
  empty: PalworldMapLocalizedLabel;
  unavailable: PalworldMapLocalizedLabel;
  error: PalworldMapLocalizedLabel;
  retry: PalworldMapLocalizedLabel;
};

type PalworldMapVisibleLocationsProps = {
  className?: string;
  copy: PalworldMapVisibleLocationsCopy;
  locale: PalworldLocale;
  locations: readonly PalworldMapVisibleLocation[];
  onRetry?: () => void;
  onSelect: (location: PalworldMapVisibleLocation) => void;
  state: PalworldMapLayerDisplayState;
};

function LocationSkeletons({
  label,
  locale,
}: {
  label: PalworldMapLocalizedLabel;
  locale: PalworldLocale;
}) {
  return (
    <div
      aria-busy="true"
      aria-label={resolvePalworldMapLabel(label, locale)}
      className="palworld-map-visible-location-skeletons"
      role="status"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <div className="palworld-map-visible-location-skeleton" key={index}>
          <Skeleton rounded />
          <SkeletonText lines={2} size="sm" />
        </div>
      ))}
    </div>
  );
}

function LocationState({
  copy,
  locale,
  onRetry,
  state,
}: {
  copy: PalworldMapVisibleLocationsCopy;
  locale: PalworldLocale;
  onRetry?: () => void;
  state: Exclude<PalworldMapLayerDisplayState, "ready" | "loading">;
}) {
  const label = state === "error"
    ? copy.error
    : state === "data_unavailable"
      ? copy.unavailable
      : copy.empty;
  const isError = state === "error";
  return (
    <EmptyState
      as="div"
      className="palworld-map-visible-location-state"
      role={isError ? "alert" : "status"}
      variant={isError ? "error" : "default"}
    >
      <EmptyStateIcon>{isError ? "!" : "○"}</EmptyStateIcon>
      <EmptyStateTitle
        as="h3"
        data-ja={label.ja}
        data-ko={label.ko}
      >
        {resolvePalworldMapLabel(label, locale)}
      </EmptyStateTitle>
      <EmptyStateDescription
        className="yoro-u-sr-only"
        data-ja={label.ja}
        data-ko={label.ko}
      >
        {resolvePalworldMapLabel(label, locale)}
      </EmptyStateDescription>
      {isError && onRetry ? (
        <EmptyStateActions>
          <Button
            data-ja={copy.retry.ja}
            data-ko={copy.retry.ko}
            onClick={onRetry}
            size="sm"
            variant="secondary"
          >
            {resolvePalworldMapLabel(copy.retry, locale)}
          </Button>
        </EmptyStateActions>
      ) : null}
    </EmptyState>
  );
}

/**
 * 공간 지도만으로 정보를 파악하기 어려운 사용자를 위한 동기화된 위치 목록입니다.
 */
export function PalworldMapVisibleLocations({
  className,
  copy,
  locale,
  locations,
  onRetry,
  onSelect,
  state,
}: PalworldMapVisibleLocationsProps) {
  const panelClassName = ["palworld-map-visible-locations", className]
    .filter(Boolean)
    .join(" ");
  const effectiveState = state === "ready" && locations.length === 0
    ? "confirmed_empty"
    : state;

  return (
    <Card as="section" className={panelClassName} padding="sm">
      <header className="palworld-map-visible-locations-header">
        <h2 data-ja={copy.title.ja} data-ko={copy.title.ko}>
          {resolvePalworldMapLabel(copy.title, locale)}
        </h2>
        {effectiveState === "ready" ? (
          <Badge size="sm" tone="info">{locations.length}</Badge>
        ) : null}
      </header>

      {effectiveState === "loading" ? (
        <LocationSkeletons label={copy.loading} locale={locale} />
      ) : effectiveState === "ready" ? (
        <ul aria-live="polite" className="palworld-map-visible-location-list">
          {locations.map((location) => (
            <li key={location.id}>
              <button
                aria-current={location.selected ? "location" : undefined}
                className="palworld-map-visible-location"
                data-layer={location.layerId}
                onClick={() => onSelect(location)}
                type="button"
              >
                {location.media ? (
                  <span aria-hidden="true" className="palworld-map-visible-location-media">
                    {location.media}
                  </span>
                ) : null}
                <span className="palworld-map-visible-location-copy">
                  <span className="palworld-map-visible-location-heading">
                    <strong data-ja={location.title.ja} data-ko={location.title.ko}>
                      {resolvePalworldMapLabel(location.title, locale)}
                    </strong>
                    <Badge
                      data-ja={location.layerLabel.ja}
                      data-ko={location.layerLabel.ko}
                      size="sm"
                      tone={location.layerId === "boss" ? "danger" : "info"}
                    >
                      {resolvePalworldMapLabel(location.layerLabel, locale)}
                    </Badge>
                  </span>
                  {location.description ? (
                    <small
                      data-ja={location.description.ja}
                      data-ko={location.description.ko}
                    >
                      {resolvePalworldMapLabel(location.description, locale)}
                    </small>
                  ) : null}
                  {location.metadata?.length ? (
                    <span className="palworld-map-visible-location-metadata">
                      {location.metadata.map((entry, index) => (
                        <span key={`${entry.label.ko}-${index}`}>
                          <span
                            className="yoro-u-sr-only"
                            data-ja={entry.label.ja}
                            data-ko={entry.label.ko}
                          >
                            {resolvePalworldMapLabel(entry.label, locale)}
                          </span>
                          {entry.value}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <LocationState
          copy={copy}
          locale={locale}
          onRetry={onRetry}
          state={effectiveState}
        />
      )}
    </Card>
  );
}

export type { PalworldMapVisibleLocationsProps };
