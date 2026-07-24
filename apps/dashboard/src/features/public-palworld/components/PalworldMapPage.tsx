import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  PalworldMapMarker,
  PalworldMapMarkersResponse,
  PalworldPalSpawnPoint,
  PalworldPalSpawnResponse,
} from "@streamops/shared";
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
import { getPalworldMapMarkers, getPalworldPalSpawns } from "../api/palworld";
import {
  clampPalworldMapView,
  focusPalworldMapViewAt,
  PALWORLD_MAP_MAX_ZOOM,
  PALWORLD_MAP_MIN_ZOOM,
  PALWORLD_MAP_ZOOM_EPSILON,
  PALWORLD_MAP_ZOOM_STEP,
  usePalworldMapViewport,
  zoomPalworldMapViewAt,
  type PalworldMapViewState,
} from "../hooks/usePalworldMapViewport";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { isLocalPalworldMapUrl, PALWORLD_WORLD_MAP_IMAGE } from "../utils/element-images";
import { resolvePalworldName } from "../utils/localization";
import {
  filterPalworldBossMarkers,
  palworldSpawnPointOpacity,
  palworldSpawnPointRadius,
  summarizePalworldSpawnPoints,
} from "../utils/spawns";
import { PalworldMedia } from "./PalworldMedia";

export const PALWORLD_WORLD_MAP_IMAGE_URL = PALWORLD_WORLD_MAP_IMAGE?.imageUrl;

type PalworldMapPageProps = {
  focusPalId?: string;
  locale: PalworldLocale;
  markerLayer?: ReactNode | ((view: Readonly<PalworldMapViewState>) => ReactNode);
  onOpenPal?: (id: string) => void;
};

export { isLocalPalworldMapUrl };
export {
  clampPalworldMapView,
  focusPalworldMapViewAt,
  zoomPalworldMapViewAt,
};
export type { PalworldMapViewState };

type PalworldMapMarkerRequestState = "loading" | "ready" | "data_unavailable" | "error";
type PalworldMapSpawnRequestState =
  | "idle"
  | "loading"
  | "ready"
  | "confirmed_empty"
  | "data_unavailable"
  | "error";

function markerLabel(marker: PalworldMapMarker, locale: PalworldLocale): string {
  const text = palworldI18n[locale];
  const name = resolvePalworldName(marker.pal, locale).text || marker.pal.nameEn;
  return `${text.mapBossMarker}: ${name}, ${text.levelPrefix}${marker.level}`;
}

export function PalworldBossMarkerLayer({
  focusedPalId,
  locale,
  markers,
  onOpenPal,
  zoom,
}: {
  focusedPalId?: string;
  locale: PalworldLocale;
  markers: readonly PalworldMapMarker[];
  onOpenPal?: (id: string) => void;
  zoom: number;
}) {
  return (
    <>
      {markers.map((marker) => {
        const displayName = resolvePalworldName(marker.pal, locale).text || marker.pal.nameEn;
        const label = markerLabel(marker, locale);
        const focused = marker.pal.id === focusedPalId;
        const markerStyle = {
          "--palworld-map-marker-inverse-scale": 1 / zoom,
          left: `${marker.normalizedX * 100}%`,
          ...(focused ? {
            outline: "var(--yoro-focus-ring-width) solid var(--yoro-color-focus-ring)",
            outlineOffset: "var(--yoro-space-1)",
          } : {}),
          top: `${marker.normalizedY * 100}%`,
        } as CSSProperties;
        return (
          <button
            aria-current={focused ? "location" : undefined}
            aria-label={label}
            className="palworld-map-boss-marker"
            data-focused={focused ? "true" : undefined}
            data-map-interactive="true"
            key={marker.id}
            onClick={(event) => {
              event.stopPropagation();
              onOpenPal?.(marker.pal.id);
            }}
            style={markerStyle}
            title={label}
            type="button"
          >
            <span aria-hidden="true" className="palworld-map-boss-marker-media">
              <PalworldMedia
                alt=""
                imageUrl={marker.pal.imageUrl}
                intrinsicHeight={marker.pal.imageHeight}
                intrinsicWidth={marker.pal.imageWidth}
                kind="pal"
                locale={locale}
              />
            </span>
            <span aria-hidden="true" className="palworld-map-boss-marker-tooltip">
              <span>{displayName}</span>
              <small>{palworldI18n[locale].levelPrefix}{marker.level}</small>
            </span>
          </button>
        );
      })}
    </>
  );
}

export function PalworldSpawnAreaLayer({
  points,
  zoom,
}: {
  points: readonly PalworldPalSpawnPoint[];
  zoom: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className="palworld-map-spawn-layer"
      preserveAspectRatio="none"
      viewBox="0 0 1 1"
    >
      {points.map((point) => (
        <circle
          className="palworld-map-spawn-point"
          cx={point.normalizedX}
          cy={point.normalizedY}
          key={point.id}
          opacity={palworldSpawnPointOpacity(point.placementCount)}
          r={palworldSpawnPointRadius(point.placementCount, zoom)}
        />
      ))}
    </svg>
  );
}

export function PalworldMapPage({ focusPalId, locale, markerLayer, onOpenPal }: PalworldMapPageProps) {
  const text = palworldI18n[locale];
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(PALWORLD_WORLD_MAP_IMAGE ? "loading" : "error");
  const [imageRevision, setImageRevision] = useState(0);
  const [bossRevision, setBossRevision] = useState(0);
  const [spawnRevision, setSpawnRevision] = useState(0);
  const [markerResponse, setMarkerResponse] = useState<PalworldMapMarkersResponse>();
  const [markerState, setMarkerState] = useState<PalworldMapMarkerRequestState>("loading");
  const [spawnResponse, setSpawnResponse] = useState<PalworldPalSpawnResponse>();
  const [spawnState, setSpawnState] = useState<PalworldMapSpawnRequestState>("idle");
  const {
    commitView,
    endPointer,
    handleKeyDown,
    handlePointerDown,
    handlePointerMove,
    handleWheel,
    isPanning,
    resetView,
    view,
    viewRef,
    viewportRef,
    zoomAt,
  } = usePalworldMapViewport(loadState === "ready");
  const appliedFocusMarkerRef = useRef<string>();
  const zoomPercent = Math.round(view.zoom * 100);
  const mapStyle = {
    "--palworld-map-translate-x": `${view.x}px`,
    "--palworld-map-translate-y": `${view.y}px`,
    "--palworld-map-zoom": view.zoom,
  } as CSSProperties;
  const mapAspectRatio = PALWORLD_WORLD_MAP_IMAGE
    ? `${PALWORLD_WORLD_MAP_IMAGE.width} / ${PALWORLD_WORLD_MAP_IMAGE.height}`
    : "1 / 1";
  const visibleBossMarkers = markerState === "ready" && markerResponse
    ? focusPalId
      ? filterPalworldBossMarkers(markerResponse.markers, focusPalId)
      : markerResponse.markers
    : [];
  const spawnSummary = spawnState === "ready" && spawnResponse
    ? summarizePalworldSpawnPoints(spawnResponse.points)
    : undefined;
  const localeTag = locale === "ko" ? "ko-KR" : "ja-JP";
  const spawnMapSummary = spawnSummary
    ? text.palWildSpawnMapSummary
      .replace("{areas}", spawnSummary.areas.toLocaleString(localeTag))
      .replace("{placements}", spawnSummary.placements.toLocaleString(localeTag))
    : "";
  const spawnLevelSummary = spawnSummary
    ? text.palWildSpawnLevelRange
      .replace("{minimum}", String(spawnSummary.minimumLevel))
      .replace("{maximum}", String(spawnSummary.maximumLevel))
    : "";

  useEffect(() => {
    const controller = new AbortController();
    setMarkerState("loading");
    setMarkerResponse(undefined);
    void getPalworldMapMarkers("main", controller.signal).then((response) => {
      if (controller.signal.aborted) {
        return;
      }
      setMarkerResponse(response);
      setMarkerState(response.state);
    }).catch(() => {
      if (!controller.signal.aborted) {
        setMarkerState("error");
      }
    });
    return () => controller.abort();
  }, [bossRevision]);

  useEffect(() => {
    if (!focusPalId) {
      setSpawnResponse(undefined);
      setSpawnState("idle");
      return;
    }
    const controller = new AbortController();
    setSpawnResponse(undefined);
    setSpawnState("loading");
    void getPalworldPalSpawns(focusPalId, "main", controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      setSpawnResponse(response);
      setSpawnState(response.state);
    }).catch(() => {
      if (!controller.signal.aborted) setSpawnState("error");
    });
    return () => controller.abort();
  }, [focusPalId, spawnRevision]);

  useEffect(() => {
    if (!focusPalId) {
      appliedFocusMarkerRef.current = undefined;
      return;
    }
    if (loadState !== "ready") {
      return;
    }
    const marker = markerState === "ready"
      ? markerResponse?.markers.find((entry) => entry.pal.id === focusPalId)
      : undefined;
    const spawnFocus = spawnState === "ready" && spawnResponse
      ? (() => {
          const weight = spawnResponse.points.reduce(
            (sum, point) => sum + point.placementCount,
            0,
          );
          if (weight <= 0) return undefined;
          return {
            normalizedX: spawnResponse.points.reduce(
              (sum, point) => sum + (point.normalizedX * point.placementCount),
              0,
            ) / weight,
            normalizedY: spawnResponse.points.reduce(
              (sum, point) => sum + (point.normalizedY * point.placementCount),
              0,
            ) / weight,
          };
        })()
      : undefined;
    const target = marker ?? spawnFocus;
    const viewport = viewportRef.current;
    if (!target) {
      appliedFocusMarkerRef.current = undefined;
      return;
    }
    const focusKey = marker?.id
      ?? `spawn-${focusPalId}-${spawnResponse?.totalPlacements ?? 0}`;
    if (
      !viewport
      || viewport.clientWidth <= 0
      || viewport.clientHeight <= 0
      || appliedFocusMarkerRef.current === focusKey
    ) {
      return;
    }
    appliedFocusMarkerRef.current = focusKey;
    commitView(focusPalworldMapViewAt(
      target,
      viewport.clientWidth,
      viewport.clientHeight,
    ));
  }, [
    commitView,
    focusPalId,
    loadState,
    markerResponse,
    markerState,
    spawnResponse,
    spawnState,
  ]);

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
          <div
            aria-live="polite"
            aria-relevant="text"
            className="palworld-map-toolbar-info"
          >
            <Badge tone="success" data-ko={palworldI18n.ko.mapFastTravel} data-ja={palworldI18n.ja.mapFastTravel}>{text.mapFastTravel}</Badge>
            {markerState === "loading" ? (
              <Badge
                data-ko={palworldI18n.ko.mapBossLoading}
                data-ja={palworldI18n.ja.mapBossLoading}
                role="status"
                tone="neutral"
              >
                {text.mapBossLoading}
              </Badge>
            ) : null}
            {markerState === "ready" && markerResponse ? (
              <Badge
                data-ko={`${palworldI18n.ko.mapBossMarkers} ${visibleBossMarkers.length}`}
                data-ja={`${palworldI18n.ja.mapBossMarkers} ${visibleBossMarkers.length}`}
                tone="danger"
              >
                {text.mapBossMarkers} {visibleBossMarkers.length}
              </Badge>
            ) : null}
            {spawnState === "ready" && spawnSummary ? (
              <Badge tone="info">
                {text.palWildSpawnAreas} · {spawnMapSummary}
              </Badge>
            ) : null}
            {spawnState === "loading" ? (
              <Badge role="status" tone="neutral">
                {text.palWildSpawnLoading}
              </Badge>
            ) : null}
            {spawnState === "confirmed_empty" ? (
              <Badge tone="neutral">{text.palWildSpawnEmpty}</Badge>
            ) : null}
            {spawnState === "data_unavailable" ? (
              <Badge tone="neutral">{text.palLocationUnavailable}</Badge>
            ) : null}
            {spawnState === "error" ? (
              <span className="palworld-map-marker-error" role="alert">
                <Badge tone="warning">{text.palLocationError}</Badge>
                <Button
                  onClick={() => setSpawnRevision((revision) => revision + 1)}
                  size="sm"
                  variant="ghost"
                >
                  {text.palWildSpawnRetry}
                </Button>
              </span>
            ) : null}
            {markerState === "data_unavailable" ? (
              <Badge
                data-ko={palworldI18n.ko.mapBossUnavailable}
                data-ja={palworldI18n.ja.mapBossUnavailable}
                tone="neutral"
              >
                {text.mapBossUnavailable}
              </Badge>
            ) : null}
            {markerState === "error" ? (
              <span className="palworld-map-marker-error" role="alert">
                <Badge
                  data-ko={palworldI18n.ko.mapBossLoadError}
                  data-ja={palworldI18n.ja.mapBossLoadError}
                  tone="warning"
                >
                  {text.mapBossLoadError}
                </Badge>
                <Button
                  data-ko={palworldI18n.ko.mapBossRetry}
                  data-ja={palworldI18n.ja.mapBossRetry}
                  onClick={() => setBossRevision((revision) => revision + 1)}
                  size="sm"
                  variant="ghost"
                >
                  {text.mapBossRetry}
                </Button>
              </span>
            ) : null}
          </div>
          <div className="palworld-map-controls" aria-label={text.mapZoomLevel}>
            <Button
              aria-label={text.mapZoomOut}
              disabled={view.zoom <= PALWORLD_MAP_MIN_ZOOM + PALWORLD_MAP_ZOOM_EPSILON}
              onClick={() => zoomAt(viewRef.current.zoom - PALWORLD_MAP_ZOOM_STEP)}
              size="sm"
              variant="secondary"
            >
              −
            </Button>
            <output aria-live="polite" aria-label={`${text.mapZoomLevel} ${zoomPercent}%`}>{zoomPercent}%</output>
            <Button
              aria-label={text.mapZoomIn}
              disabled={view.zoom >= PALWORLD_MAP_MAX_ZOOM - PALWORLD_MAP_ZOOM_EPSILON}
              onClick={() => zoomAt(viewRef.current.zoom + PALWORLD_MAP_ZOOM_STEP)}
              size="sm"
              variant="secondary"
            >
              +
            </Button>
            <Button
              data-ko={palworldI18n.ko.mapZoomReset}
              data-ja={palworldI18n.ja.mapZoomReset}
              disabled={view.zoom <= PALWORLD_MAP_MIN_ZOOM + PALWORLD_MAP_ZOOM_EPSILON && view.x === 0 && view.y === 0}
              onClick={resetView}
              size="sm"
              variant="ghost"
            >
              {text.mapZoomReset}
            </Button>
          </div>
        </div>
        {(focusPalId || visibleBossMarkers.length > 0) ? (
          <div
            aria-label={text.mapLayerLegend}
            className="palworld-map-layer-legend"
            role="group"
          >
            <strong>{text.mapLayerLegend}</strong>
            <ul>
              {focusPalId ? (
                <li>
                  <span aria-hidden="true" className="palworld-map-legend-spawn" />
                  <span>
                    <strong>{text.palWildSpawnAreas}</strong>
                    {spawnSummary ? (
                      <>
                        <small>{spawnMapSummary} · {spawnLevelSummary}</small>
                        <span className="palworld-map-legend-periods">
                          {spawnSummary.daytime ? <Badge size="sm" tone="neutral">{text.palWildSpawnDay}</Badge> : null}
                          {spawnSummary.nighttime ? <Badge size="sm" tone="neutral">{text.palWildSpawnNight}</Badge> : null}
                        </span>
                        <small>{text.palWildSpawnDensity}</small>
                      </>
                    ) : null}
                  </span>
                </li>
              ) : null}
              {markerState === "ready" ? (
                <li>
                  <span aria-hidden="true" className="palworld-map-legend-boss" />
                  <span>
                    <strong>{text.mapBossMarker}</strong>
                    <small>{visibleBossMarkers.length}</small>
                  </span>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <figure className="palworld-map-figure">
          <div
            aria-describedby="palworld-map-caption palworld-map-hint"
            aria-label={text.mapImageAlt}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight + - Home"
            className="palworld-map-viewport"
            data-testid="palworld-map-viewport"
            data-panning={isPanning ? "true" : undefined}
            data-zoomed={view.zoom > PALWORLD_MAP_MIN_ZOOM + PALWORLD_MAP_ZOOM_EPSILON ? "true" : undefined}
            onKeyDown={handleKeyDown}
            onLostPointerCapture={endPointer}
            onPointerCancel={endPointer}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPointer}
            onWheel={handleWheel}
            ref={viewportRef}
            role="region"
            style={{ aspectRatio: mapAspectRatio }}
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
              <div className="palworld-map-stage" data-testid="palworld-map-stage" style={mapStyle}>
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
                {markerLayer ? (
                  <div className="palworld-map-marker-layer">
                    {typeof markerLayer === "function" ? markerLayer(view) : markerLayer}
                  </div>
                ) : null}
                {loadState === "ready" && spawnState === "ready" && spawnResponse ? (
                  <div className="palworld-map-marker-layer" data-testid="palworld-map-spawn-areas">
                    <PalworldSpawnAreaLayer points={spawnResponse.points} zoom={view.zoom} />
                  </div>
                ) : null}
                {loadState === "ready" && visibleBossMarkers.length ? (
                  <div className="palworld-map-marker-layer" data-testid="palworld-map-boss-markers">
                    <PalworldBossMarkerLayer
                      focusedPalId={focusPalId}
                      locale={locale}
                      markers={visibleBossMarkers}
                      onOpenPal={onOpenPal}
                      zoom={view.zoom}
                    />
                  </div>
                ) : null}
              </div>
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
