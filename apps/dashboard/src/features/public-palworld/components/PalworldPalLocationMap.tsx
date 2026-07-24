import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import type {
  PalworldMapMarker,
  PalworldPalSpawnPoint,
  PalworldPalSpawnResponse,
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Skeleton } from "../../../shared/ui/Skeleton";
import { Badge } from "../../../shared/ui/Status";
import { getPalworldMapMarkers, getPalworldPalSpawns } from "../api/palworld";
import {
  PALWORLD_MAP_MAX_ZOOM,
  PALWORLD_MAP_MIN_ZOOM,
  PALWORLD_MAP_ZOOM_EPSILON,
  PALWORLD_MAP_ZOOM_STEP,
  usePalworldMapViewport,
} from "../hooks/usePalworldMapViewport";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import type { PalworldSpawnPeriod } from "../utils/routes";
import { PALWORLD_WORLD_MAP_IMAGE } from "../utils/element-images";
import { resolvePalworldName } from "../utils/localization";
import {
  filterPalworldBossMarkers,
  palworldSpawnPointOpacity,
  palworldSpawnPointRadius,
  summarizePalworldSpawnPoints,
} from "../utils/spawns";
import { PalworldMedia } from "./PalworldMedia";

export { filterPalworldBossMarkers } from "../utils/spawns";

type LocationLayerState<T> =
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "confirmed_empty" }
  | { kind: "data_unavailable" }
  | { kind: "error" };

function markerSummary(marker: PalworldMapMarker, locale: PalworldLocale): string {
  const name = resolvePalworldName(marker.pal, locale).text || marker.pal.nameEn;
  return `${palworldI18n[locale].mapBossMarker}: ${name}, ${palworldI18n[locale].levelPrefix}${marker.level}`;
}

function markerName(marker: PalworldMapMarker, locale: PalworldLocale): string {
  const name = resolvePalworldName(marker.pal, locale).text || marker.pal.nameEn;
  return `${palworldI18n[locale].mapBossMarker}: ${name}`;
}

function spawnSummary(
  points: readonly PalworldPalSpawnPoint[],
  locale: PalworldLocale,
): string {
  const summary = summarizePalworldSpawnPoints(points);
  if (!summary) return "";
  return palworldI18n[locale].palWildSpawnSummary
    .replace("{placements}", summary.placements.toLocaleString(locale === "ko" ? "ko-KR" : "ja-JP"))
    .replace("{areas}", summary.areas.toLocaleString(locale === "ko" ? "ko-KR" : "ja-JP"));
}

function spawnLevelSummary(
  points: readonly PalworldPalSpawnPoint[],
  locale: PalworldLocale,
): string {
  const summary = summarizePalworldSpawnPoints(points);
  if (!summary) return "";
  return palworldI18n[locale].palWildSpawnLevelRange
    .replace("{minimum}", String(summary.minimumLevel))
    .replace("{maximum}", String(summary.maximumLevel));
}

function spawnPeriods(
  points: readonly PalworldPalSpawnPoint[],
  locale: PalworldLocale,
): string[] {
  const summary = summarizePalworldSpawnPoints(points);
  if (!summary) return [];
  return [
    ...(summary.daytime ? [palworldI18n[locale].palWildSpawnDay] : []),
    ...(summary.nighttime ? [palworldI18n[locale].palWildSpawnNight] : []),
  ];
}

function SpawnAreaLayer({
  points,
  zoom,
}: {
  points: readonly PalworldPalSpawnPoint[];
  zoom: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className="palworld-pal-location-spawn-layer"
      preserveAspectRatio="none"
      viewBox="0 0 1 1"
    >
      {points.map((point) => (
        <circle
          className="palworld-pal-location-spawn-point"
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

function LocationLayerNotice({
  empty,
  error,
  kind,
  loading,
  onRetry,
  retryLabel,
  unavailable,
}: {
  empty: string;
  error: string;
  kind: LocationLayerState<unknown>["kind"];
  loading: string;
  onRetry: () => void;
  retryLabel: string;
  unavailable: string;
}) {
  if (kind === "ready") return null;
  if (kind === "error") {
    return (
      <div className="palworld-pal-location-inline-error" role="alert">
        <span>{error}</span>
        <Button onClick={onRetry} size="sm" variant="secondary">
          {retryLabel}
        </Button>
      </div>
    );
  }
  return (
    <p
      aria-busy={kind === "loading" ? "true" : undefined}
      className="palworld-pal-location-inline-status"
      role="status"
    >
      {kind === "loading" ? loading : kind === "confirmed_empty" ? empty : unavailable}
    </p>
  );
}

export function PalworldPalLocationMap({
  locale,
  onOpenFullMap,
  onPeriodChange = () => undefined,
  palId,
  period = "all",
}: {
  locale: PalworldLocale;
  onOpenFullMap: (palId: string) => void;
  onPeriodChange?: (period: PalworldSpawnPeriod) => void;
  palId: string;
  period?: PalworldSpawnPeriod;
}) {
  const text = palworldI18n[locale];
  const titleId = useId();
  const mapHintId = useId();
  const [bossRevision, setBossRevision] = useState(0);
  const [spawnRevision, setSpawnRevision] = useState(0);
  const [imageRevision, setImageRevision] = useState(0);
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">(
    PALWORLD_WORLD_MAP_IMAGE ? "loading" : "error",
  );
  const [bossState, setBossState] = useState<LocationLayerState<PalworldMapMarker[]>>({
    kind: "loading",
  });
  const [spawnState, setSpawnState] = useState<LocationLayerState<PalworldPalSpawnResponse>>({
    kind: "loading",
  });
  const {
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
  } = usePalworldMapViewport(imageState === "ready");

  useEffect(() => {
    const controller = new AbortController();
    setBossState({ kind: "loading" });
    void getPalworldMapMarkers("main", controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      if (response.state === "data_unavailable") {
        setBossState({ kind: "data_unavailable" });
        return;
      }
      const markers = filterPalworldBossMarkers(response.markers, palId);
      setBossState(markers.length
        ? { kind: "ready", data: markers }
        : { kind: "confirmed_empty" });
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (!controller.signal.aborted) setBossState({ kind: "error" });
    });

    return () => controller.abort();
  }, [bossRevision, palId]);

  useEffect(() => {
    const controller = new AbortController();
    setSpawnState({ kind: "loading" });
    void getPalworldPalSpawns(palId, "main", controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      if (response.state === "ready") setSpawnState({ kind: "ready", data: response });
      else setSpawnState({ kind: response.state });
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (!controller.signal.aborted) setSpawnState({ kind: "error" });
    });

    return () => controller.abort();
  }, [palId, spawnRevision]);

  const bossMarkers = bossState.kind === "ready" ? bossState.data : [];
  const spawnResponse = spawnState.kind === "ready" ? spawnState.data : undefined;
  const visibleSpawnPoints = useMemo(
    () => spawnResponse?.points.filter((point) =>
      period === "all"
      || (period === "day" ? point.daytime : point.nighttime)
    ) ?? [],
    [period, spawnResponse],
  );
  const hasLocations = bossMarkers.length > 0 || spawnResponse !== undefined;
  const bothLoading = bossState.kind === "loading" && spawnState.kind === "loading";
  const bothEmpty = bossState.kind === "confirmed_empty"
    && spawnState.kind === "confirmed_empty";
  const mapAspectRatio = PALWORLD_WORLD_MAP_IMAGE
    ? `${PALWORLD_WORLD_MAP_IMAGE.width} / ${PALWORLD_WORLD_MAP_IMAGE.height}`
    : "1 / 1";
  const periods = spawnResponse ? spawnPeriods(visibleSpawnPoints, locale) : [];
  const zoomPercent = Math.round(view.zoom * 100);
  const mapStyle = {
    "--palworld-map-translate-x": `${view.x}px`,
    "--palworld-map-translate-y": `${view.y}px`,
    "--palworld-map-zoom": view.zoom,
  } as CSSProperties;

  useEffect(() => {
    resetView();
  }, [palId, resetView]);

  return (
    <section
      aria-labelledby={titleId}
      className="palworld-pal-location-section"
      data-testid="pal-detail-location"
    >
      <div className="palworld-pal-location-heading">
        <h4
          data-ja={palworldI18n.ja.palLocationTitle}
          data-ko={palworldI18n.ko.palLocationTitle}
          id={titleId}
        >
          {text.palLocationTitle}
        </h4>
        <p
          data-ja={palworldI18n.ja.palLocationDescription}
          data-ko={palworldI18n.ko.palLocationDescription}
        >
          {text.palLocationDescription}
        </p>
      </div>

      {!hasLocations && bothLoading ? (
        <div
          aria-busy="true"
          aria-label={text.palLocationLoading}
          className="palworld-pal-location-loading"
          role="status"
        >
          <Skeleton rounded />
        </div>
      ) : null}

      {!hasLocations && !bothLoading && bothEmpty ? (
        <p
          className="palworld-pal-location-status"
          data-ja={palworldI18n.ja.palLocationEmpty}
          data-ko={palworldI18n.ko.palLocationEmpty}
          role="status"
        >
          {text.palLocationEmpty}
        </p>
      ) : null}

      {!hasLocations && !bothLoading && !bothEmpty ? (
        <div className="palworld-pal-location-layer-statuses">
          <LocationLayerNotice
            empty={text.palWildSpawnEmpty}
            error={text.palLocationError}
            kind={spawnState.kind}
            loading={text.palWildSpawnLoading}
            onRetry={() => setSpawnRevision((value) => value + 1)}
            retryLabel={text.palWildSpawnRetry}
            unavailable={text.palLocationUnavailable}
          />
          <LocationLayerNotice
            empty={text.palBossLocationEmpty}
            error={text.palBossLocationError}
            kind={bossState.kind}
            loading={text.mapBossLoading}
            onRetry={() => setBossRevision((value) => value + 1)}
            retryLabel={text.mapBossRetry}
            unavailable={text.palBossLocationUnavailable}
          />
        </div>
      ) : null}

      {hasLocations ? (
        <figure className="palworld-pal-location-figure">
          <div className="palworld-pal-location-toolbar">
            {spawnResponse ? (
              <div
                aria-label={text.palWildSpawnPeriod}
                className="palworld-pal-location-periods"
                role="group"
              >
                {([
                  ["all", text.palWildSpawnAllPeriods],
                  ["day", text.palWildSpawnDay],
                  ["night", text.palWildSpawnNight],
                ] as const).map(([value, label]) => (
                  <Button
                    aria-pressed={period === value}
                    key={value}
                    onClick={() => onPeriodChange(value)}
                    size="sm"
                    variant={period === value ? "secondary" : "ghost"}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            ) : <span />}
            <div
              aria-label={text.mapZoomLevel}
              className="palworld-pal-location-controls"
              role="group"
            >
              <Button
                aria-label={text.mapZoomOut}
                disabled={
                  imageState !== "ready"
                  || view.zoom <= PALWORLD_MAP_MIN_ZOOM + PALWORLD_MAP_ZOOM_EPSILON
                }
                onClick={() => zoomAt(viewRef.current.zoom - PALWORLD_MAP_ZOOM_STEP)}
                size="sm"
                variant="secondary"
              >
                −
              </Button>
              <output
                aria-label={`${text.mapZoomLevel} ${zoomPercent}%`}
                aria-live="polite"
              >
                {zoomPercent}%
              </output>
              <Button
                aria-label={text.mapZoomIn}
                disabled={
                  imageState !== "ready"
                  || view.zoom >= PALWORLD_MAP_MAX_ZOOM - PALWORLD_MAP_ZOOM_EPSILON
                }
                onClick={() => zoomAt(viewRef.current.zoom + PALWORLD_MAP_ZOOM_STEP)}
                size="sm"
                variant="secondary"
              >
                +
              </Button>
              <Button
                disabled={
                  imageState !== "ready"
                  || (
                    view.zoom <= PALWORLD_MAP_MIN_ZOOM + PALWORLD_MAP_ZOOM_EPSILON
                    && view.x === 0
                    && view.y === 0
                  )
                }
                onClick={resetView}
                size="sm"
                variant="ghost"
              >
                {text.mapZoomReset}
              </Button>
            </div>
          </div>
          <div
            aria-describedby={mapHintId}
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight + - Home"
            aria-label={text.palLocationMapAlt}
            className="palworld-pal-location-preview palworld-map-viewport"
            data-panning={isPanning ? "true" : undefined}
            data-testid="pal-detail-map-viewport"
            data-zoomed={
              view.zoom > PALWORLD_MAP_MIN_ZOOM + PALWORLD_MAP_ZOOM_EPSILON
                ? "true"
                : undefined
            }
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
            {imageState === "loading" ? (
              <div
                aria-busy="true"
                aria-label={text.mapLoading}
                className="palworld-pal-location-image-loading"
                role="status"
              >
                <Skeleton rounded />
              </div>
            ) : null}
            {imageState !== "error" && PALWORLD_WORLD_MAP_IMAGE ? (
              <div
                className="palworld-map-stage"
                data-testid="pal-detail-map-stage"
                style={mapStyle}
              >
                <img
                  alt={text.palLocationMapAlt}
                  className={`palworld-pal-location-map-image${imageState === "loading" ? " is-loading" : ""}`}
                  decoding="async"
                  draggable={false}
                  height={PALWORLD_WORLD_MAP_IMAGE.height}
                  key={imageRevision}
                  loading="lazy"
                  onError={() => setImageState("error")}
                  onLoad={() => setImageState("ready")}
                  src={PALWORLD_WORLD_MAP_IMAGE.imageUrl}
                  width={PALWORLD_WORLD_MAP_IMAGE.width}
                />
                {imageState === "ready" && spawnResponse ? (
                  <SpawnAreaLayer points={visibleSpawnPoints} zoom={view.zoom} />
                ) : null}
                {imageState === "ready" && bossMarkers.length > 0 ? (
                  <div aria-hidden="true" className="palworld-pal-location-marker-layer">
                    {bossMarkers.map((marker) => (
                      <span
                        className="palworld-pal-location-marker"
                        key={marker.id}
                        style={{
                          "--palworld-map-marker-scale": 1 / view.zoom,
                          left: `${marker.normalizedX * 100}%`,
                          top: `${marker.normalizedY * 100}%`,
                        } as CSSProperties}
                      >
                        <span className="palworld-map-boss-marker-media">
                          <PalworldMedia
                            alt=""
                            imageUrl={marker.pal.imageUrl}
                            intrinsicHeight={marker.pal.imageHeight}
                            intrinsicWidth={marker.pal.imageWidth}
                            kind="pal"
                            locale={locale}
                          />
                        </span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {imageState === "error" ? (
              <div className="palworld-pal-location-image-error" role="alert">
                <p>{text.mapLoadError}</p>
                {PALWORLD_WORLD_MAP_IMAGE ? (
                  <Button
                    onClick={() => {
                      setImageState("loading");
                      setImageRevision((value) => value + 1);
                    }}
                    size="sm"
                    variant="secondary"
                  >
                    {text.mapRetry}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <figcaption className="palworld-pal-location-caption">
            <ul aria-label={text.palLocationTitle}>
              {spawnResponse && visibleSpawnPoints.length > 0 ? (
                <li className="palworld-pal-location-spawn-summary">
                  <span className="palworld-pal-location-legend">
                    <span aria-hidden="true" className="palworld-pal-location-legend-dot" />
                    {text.palWildSpawnAreas}
                  </span>
                  <span className="palworld-pal-location-spawn-details">
                    <span>{spawnSummary(visibleSpawnPoints, locale)}</span>
                    <Badge size="sm" tone="info">
                      {spawnLevelSummary(visibleSpawnPoints, locale)}
                    </Badge>
                    {periods.map((period) => (
                      <Badge key={period} size="sm" tone="neutral">
                        {text.palWildSpawnPeriod}: {period}
                      </Badge>
                    ))}
                  </span>
                </li>
              ) : null}
              {spawnResponse && visibleSpawnPoints.length === 0 ? (
                <li role="status">{text.palWildSpawnPeriodEmpty}</li>
              ) : null}
              {bossMarkers.map((marker) => (
                <li aria-label={markerSummary(marker, locale)} key={marker.id}>
                  <span>{markerName(marker, locale)}</span>
                  <Badge size="sm" tone="danger">{text.levelPrefix}{marker.level}</Badge>
                </li>
              ))}
            </ul>
            <LocationLayerNotice
              empty={text.palWildSpawnEmpty}
              error={text.palLocationError}
              kind={spawnState.kind}
              loading={text.palWildSpawnLoading}
              onRetry={() => setSpawnRevision((value) => value + 1)}
              retryLabel={text.palWildSpawnRetry}
              unavailable={text.palLocationUnavailable}
            />
            <LocationLayerNotice
              empty={text.palBossLocationEmpty}
              error={text.palBossLocationError}
              kind={bossState.kind}
              loading={text.mapBossLoading}
              onRetry={() => setBossRevision((value) => value + 1)}
              retryLabel={text.mapBossRetry}
              unavailable={text.palBossLocationUnavailable}
            />
          </figcaption>
          <p className="palworld-map-hint" id={mapHintId}>
            {text.mapUsageHint}
          </p>
        </figure>
      ) : null}
      <div className="palworld-pal-location-actions">
        <Button onClick={() => onOpenFullMap(palId)} size="sm" variant="secondary">
          {text.viewOnFullMap}
        </Button>
      </div>
    </section>
  );
}
