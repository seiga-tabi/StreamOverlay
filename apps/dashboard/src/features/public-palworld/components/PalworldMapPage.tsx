import { useState, type CSSProperties } from "react";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../../../shared/ui/EmptyState";
import { Skeleton } from "../../../shared/ui/Skeleton";
import { Badge } from "../../../shared/ui/Status";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { isLocalPalworldMapUrl, PALWORLD_WORLD_MAP_IMAGE } from "../utils/element-images";

export const PALWORLD_WORLD_MAP_IMAGE_URL = PALWORLD_WORLD_MAP_IMAGE?.imageUrl;
const MAP_ZOOM_LEVELS = [100, 150, 200, 300] as const;

export { isLocalPalworldMapUrl };

export function PalworldMapPage({ locale }: { locale: PalworldLocale }) {
  const text = palworldI18n[locale];
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(PALWORLD_WORLD_MAP_IMAGE ? "loading" : "error");
  const [imageRevision, setImageRevision] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(0);
  const zoom = MAP_ZOOM_LEVELS[zoomIndex] ?? MAP_ZOOM_LEVELS[0];
  const mapStyle = { "--palworld-map-scale": `${zoom}%` } as CSSProperties;

  function retry(): void {
    setLoadState("loading");
    setImageRevision((revision) => revision + 1);
  }

  return (
    <section className="palworld-page-section palworld-map-page" aria-labelledby="palworld-map-title">
      <header className="palworld-page-heading">
        <div>
          <span aria-hidden="true">{text.mapKicker}</span>
          <h1 id="palworld-map-title" data-ko={palworldI18n.ko.mapTitle} data-ja={palworldI18n.ja.mapTitle}>{text.mapTitle}</h1>
          <p data-ko={palworldI18n.ko.mapDescription} data-ja={palworldI18n.ja.mapDescription}>{text.mapDescription}</p>
        </div>
      </header>

      <Card as="section" className="palworld-map-card" padding="none" aria-labelledby="palworld-map-title">
        <div className="palworld-map-toolbar">
          <div className="palworld-map-toolbar-info">
            <Badge tone="success" data-ko={palworldI18n.ko.mapFastTravel} data-ja={palworldI18n.ja.mapFastTravel}>{text.mapFastTravel}</Badge>
          </div>
          <div className="palworld-map-controls" aria-label={text.mapZoomLevel}>
            <Button
              aria-label={text.mapZoomOut}
              disabled={zoomIndex === 0}
              onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
              size="sm"
              variant="secondary"
            >
              −
            </Button>
            <output aria-live="polite" aria-label={`${text.mapZoomLevel} ${zoom}%`}>{zoom}%</output>
            <Button
              aria-label={text.mapZoomIn}
              disabled={zoomIndex === MAP_ZOOM_LEVELS.length - 1}
              onClick={() => setZoomIndex((index) => Math.min(MAP_ZOOM_LEVELS.length - 1, index + 1))}
              size="sm"
              variant="secondary"
            >
              +
            </Button>
            <Button
              data-ko={palworldI18n.ko.mapZoomReset}
              data-ja={palworldI18n.ja.mapZoomReset}
              disabled={zoomIndex === 0}
              onClick={() => setZoomIndex(0)}
              size="sm"
              variant="ghost"
            >
              {text.mapZoomReset}
            </Button>
          </div>
        </div>

        <figure className="palworld-map-figure">
          <div
            aria-describedby="palworld-map-caption palworld-map-hint"
            aria-label={text.mapImageAlt}
            className="palworld-map-viewport"
            data-testid="palworld-map-viewport"
            data-zoomed={zoom > 100 ? "true" : undefined}
            style={mapStyle}
            tabIndex={0}
          >
            {loadState === "loading" ? (
              <div className="palworld-map-loading" role="status" aria-label={text.mapLoading}>
                <Skeleton className="palworld-map-skeleton" rounded />
              </div>
            ) : null}
            {loadState === "error" || !PALWORLD_WORLD_MAP_IMAGE ? (
              <EmptyState className="palworld-map-error" variant="error" role="alert">
                <EmptyStateIcon>!</EmptyStateIcon>
                <EmptyStateTitle data-ko={palworldI18n.ko.mapLoadError} data-ja={palworldI18n.ja.mapLoadError}>{text.mapLoadError}</EmptyStateTitle>
                <EmptyStateDescription data-ko={palworldI18n.ko.mapLoadErrorDescription} data-ja={palworldI18n.ja.mapLoadErrorDescription}>{text.mapLoadErrorDescription}</EmptyStateDescription>
                <EmptyStateActions>
                  <Button data-ko={palworldI18n.ko.mapRetry} data-ja={palworldI18n.ja.mapRetry} onClick={retry} variant="secondary">{text.mapRetry}</Button>
                </EmptyStateActions>
              </EmptyState>
            ) : (
              <img
                alt={text.mapImageAlt}
                className={`palworld-map-image${loadState === "loading" ? " is-loading" : ""}`}
                data-testid="palworld-map-image"
                decoding="async"
                draggable={false}
                height={PALWORLD_WORLD_MAP_IMAGE.height}
                key={imageRevision}
                onError={() => setLoadState("error")}
                onLoad={() => setLoadState("ready")}
                src={PALWORLD_WORLD_MAP_IMAGE.imageUrl}
                width={PALWORLD_WORLD_MAP_IMAGE.width}
              />
            )}
          </div>
          <figcaption className="palworld-map-caption" id="palworld-map-caption">
            <p data-ko={palworldI18n.ko.mapCaption} data-ja={palworldI18n.ja.mapCaption}>{text.mapCaption}</p>
          </figcaption>
        </figure>
        <p className="palworld-map-hint" id="palworld-map-hint" data-ko={palworldI18n.ko.mapUsageHint} data-ja={palworldI18n.ja.mapUsageHint}>{text.mapUsageHint}</p>
      </Card>
    </section>
  );
}
