import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type {
  PalworldMapMarker,
  PalworldPalReference,
  PalworldPalSpawnResponse,
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Skeleton } from "../../../shared/ui/Skeleton";
import { getPalworldMapMarkers, getPalworldPalSpawns } from "../api/palworld";
import {
  PALWORLD_MAP_MAX_ZOOM,
  PALWORLD_MAP_MIN_ZOOM,
  PALWORLD_MAP_ZOOM_EPSILON,
  PALWORLD_MAP_ZOOM_STEP,
  focusPalworldMapViewAt,
  usePalworldMapViewport,
} from "../hooks/usePalworldMapViewport";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import type { PalworldSpawnPeriod } from "../utils/routes";
import { PALWORLD_WORLD_MAP_IMAGE } from "../utils/element-images";
import { resolvePalworldName } from "../utils/localization";
import {
  clusterPalworldPreviewSpawnPoints,
  filterPalworldPreviewClustersInViewport,
  filterPalworldBossMarkers,
  summarizePalworldSpawnPoints,
  type PalworldPreviewSpawnCluster,
} from "../utils/spawns";
import { PalworldMedia } from "./PalworldMedia";

export { filterPalworldBossMarkers } from "../utils/spawns";

export const PALWORLD_PAL_DETAIL_INITIAL_ZOOM = 1.5;

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

function spawnPeriods(
  points: ReadonlyArray<PalworldPalSpawnResponse["points"][number]>,
  locale: PalworldLocale,
): string[] {
  const summary = summarizePalworldSpawnPoints(points);
  if (!summary) return [];
  return [
    ...(summary.daytime ? [palworldI18n[locale].palWildSpawnDay] : []),
    ...(summary.nighttime ? [palworldI18n[locale].palWildSpawnNight] : []),
  ];
}

type PalworldLocationTypeFilter = "all" | "wild" | "boss";

function replaceCount(template: string, count: number, locale: PalworldLocale): string {
  return template.replace(
    "{count}",
    count.toLocaleString(locale === "ko" ? "ko-KR" : "ja-JP"),
  );
}

function clusterPeriodLabel(
  cluster: Pick<PalworldPreviewSpawnCluster, "daytime" | "nighttime">,
  locale: PalworldLocale,
): string {
  const text = palworldI18n[locale];
  return [
    ...(cluster.daytime ? [text.palWildSpawnDay] : []),
    ...(cluster.nighttime ? [text.palWildSpawnNight] : []),
  ].join(" · ");
}

function SpawnPreviewCanvas({
  clusters,
  zoom,
}: {
  clusters: readonly PalworldPreviewSpawnCluster[];
  zoom: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const render = (): void => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(bounds.width * pixelRatio);
      canvas.height = Math.round(bounds.height * pixelRatio);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);
      for (const cluster of clusters) {
        const x = cluster.normalizedX * bounds.width;
        const y = cluster.normalizedY * bounds.height;
        const density = Math.min(1, Math.log2(cluster.placementCount + 1) / 7);
        const radius = (10 + (density * 8)) / Math.max(1, zoom);
        const glow = context.createRadialGradient(x, y, 0, x, y, radius * 2.6);
        glow.addColorStop(0, "rgba(139, 92, 246, 0.48)");
        glow.addColorStop(1, "rgba(139, 92, 246, 0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(x, y, radius * 2.6, 0, Math.PI * 2);
        context.fill();
      }
    };
    render();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", render);
      return () => window.removeEventListener("resize", render);
    }
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [clusters, zoom]);

  return <canvas aria-hidden="true" className="palworld-pal-location-spawn-canvas" ref={canvasRef} />;
}

function SpawnClusterLayer({
  clusters,
  locale,
  onSelect,
  palName,
  selectedId,
  zoom,
}: {
  clusters: readonly PalworldPreviewSpawnCluster[];
  locale: PalworldLocale;
  onSelect: (cluster: PalworldPreviewSpawnCluster) => void;
  palName: string;
  selectedId?: string;
  zoom: number;
}) {
  const text = palworldI18n[locale];
  return <div className="palworld-pal-location-spawn-markers">
    {clusters.map((cluster) => {
      const periodLabel = clusterPeriodLabel(cluster, locale);
      const clusterLabel = cluster.pointCount > 1
        ? replaceCount(text.palLocationCluster, cluster.pointCount, locale)
        : text.palLocationMarkerWild;
      const selected = selectedId === cluster.id;
      const markerStyle = {
        "--palworld-map-marker-scale": 1 / zoom,
        left: `${cluster.normalizedX * 100}%`,
        top: `${cluster.normalizedY * 100}%`,
      } as CSSProperties;
      return <button
        aria-label={`${palName}, ${clusterLabel}, ${text.palLocationLevelLabel} ${cluster.minimumLevel}~${cluster.maximumLevel}, ${periodLabel}`}
        aria-pressed={selected}
        className="palworld-pal-location-spawn-marker"
        data-clustered={cluster.pointCount > 1 ? "true" : undefined}
        data-current-pal="true"
        data-map-interactive="true"
        data-selected={selected ? "true" : undefined}
        key={cluster.id}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(cluster);
        }}
        style={markerStyle}
        type="button"
      >
        <span aria-hidden="true" className="palworld-pal-location-spawn-marker-core">
          {cluster.pointCount > 1 ? cluster.pointCount : ""}
        </span>
        <span aria-hidden="true" className="palworld-pal-location-marker-tooltip">
          <strong>{palName}</strong>
          <span>{clusterLabel}</span>
          <small>{text.palLocationLevelLabel} {cluster.minimumLevel}~{cluster.maximumLevel}</small>
          <small>{text.palLocationPeriodLabel} {periodLabel}</small>
        </span>
      </button>;
    })}
  </div>;
}

function BossPreviewLayer({
  locale,
  markers,
  onSelect,
  selectedId,
  zoom,
}: {
  locale: PalworldLocale;
  markers: readonly PalworldMapMarker[];
  onSelect: (marker: PalworldMapMarker) => void;
  selectedId?: string;
  zoom: number;
}) {
  const text = palworldI18n[locale];
  return <div className="palworld-pal-location-marker-layer">
    {markers.map((marker) => {
      const displayName = resolvePalworldName(marker.pal, locale).text || marker.pal.nameEn;
      const selected = selectedId === marker.id;
      return <button
        aria-label={markerSummary(marker, locale)}
        aria-pressed={selected}
        className="palworld-pal-location-marker"
        data-current-pal="true"
        data-map-interactive="true"
        data-selected={selected ? "true" : undefined}
        key={marker.id}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(marker);
        }}
        style={{
          "--palworld-map-marker-scale": 1 / zoom,
          left: `${marker.normalizedX * 100}%`,
          top: `${marker.normalizedY * 100}%`,
        } as CSSProperties}
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
        <span aria-hidden="true" className="palworld-pal-location-marker-tooltip">
          <strong>{displayName}</strong>
          <span>{text.palLocationMarkerBoss}</span>
          <small>{text.palLocationLevelLabel} {marker.level}</small>
        </span>
      </button>;
    })}
  </div>;
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
  pal,
  palId,
  period = "all",
}: {
  locale: PalworldLocale;
  onOpenFullMap: (palId: string) => void;
  onPeriodChange?: (period: PalworldSpawnPeriod) => void;
  pal?: PalworldPalReference;
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
  const [locationType, setLocationType] = useState<PalworldLocationTypeFilter>("all");
  const [selectedMarker, setSelectedMarker] = useState<{
    id: string;
    type: "wild" | "boss";
  }>();
  const {
    commitView,
    endPointer,
    handleKeyDown,
    handlePointerDown,
    handlePointerMove,
    handleClickCapture,
    isPanning,
    resetView,
    view,
    viewRef,
    viewportRef,
    zoomAt,
  } = usePalworldMapViewport(imageState === "ready", "page-scroll", "modifier");

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
  const spawnClusters = useMemo(
    () => clusterPalworldPreviewSpawnPoints(visibleSpawnPoints, view.zoom),
    [view.zoom, visibleSpawnPoints],
  );
  const visibleSpawnClusters = locationType === "boss" ? [] : filterPalworldPreviewClustersInViewport(
    spawnClusters,
    view,
    viewportRef.current?.clientWidth ?? 0,
    viewportRef.current?.clientHeight ?? 0,
  );
  const visibleBossMarkers = locationType === "wild" ? [] : bossMarkers;
  const hasLocations = bossMarkers.length > 0 || spawnResponse !== undefined;
  const bothLoading = bossState.kind === "loading" && spawnState.kind === "loading";
  const bothEmpty = bossState.kind === "confirmed_empty"
    && spawnState.kind === "confirmed_empty";
  const periods = spawnResponse ? spawnPeriods(visibleSpawnPoints, locale) : [];
  const spawnPointSummary = summarizePalworldSpawnPoints(visibleSpawnPoints);
  const palDisplayName = pal
    ? resolvePalworldName(pal, locale).text
    : bossMarkers[0]
      ? resolvePalworldName(bossMarkers[0].pal, locale).text
      : palId;
  const zoomPercent = Math.round(view.zoom * 100);
  const mapStyle = {
    "--palworld-map-translate-x": `${view.x}px`,
    "--palworld-map-translate-y": `${view.y}px`,
    "--palworld-map-zoom": view.zoom,
  } as CSSProperties;

  useEffect(() => {
    if (imageState !== "ready" || !hasLocations) return;
    resetView();
    zoomAt(PALWORLD_PAL_DETAIL_INITIAL_ZOOM);
  }, [hasLocations, imageState, palId, resetView, zoomAt]);

  useEffect(() => {
    setSelectedMarker(undefined);
  }, [locationType, palId, period]);

  const focusLocation = (
    location: Pick<PalworldMapMarker, "normalizedX" | "normalizedY">,
  ): void => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    commitView(focusPalworldMapViewAt(
      location,
      viewport.clientWidth,
      viewport.clientHeight,
      Math.max(2.25, viewRef.current.zoom),
    ));
  };

  return (
    <section
      aria-labelledby={titleId}
      className="palworld-pal-location-section"
      data-testid="pal-detail-location"
    >
      <div className="palworld-pal-location-heading">
        <span className="palworld-pal-location-kicker">{text.palLocationPreviewKicker}</span>
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
        <div
          className="palworld-pal-location-status"
          role="status"
        >
          <span aria-hidden="true">⌖</span>
          <strong data-ja={palworldI18n.ja.palLocationEmptyTitle} data-ko={palworldI18n.ko.palLocationEmptyTitle}>
            {text.palLocationEmptyTitle}
          </strong>
          <p data-ja={palworldI18n.ja.palLocationEmptyDescription} data-ko={palworldI18n.ko.palLocationEmptyDescription}>
            {text.palLocationEmptyDescription}
          </p>
        </div>
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
              aria-label={text.palLocationTypeFilter}
              className="palworld-pal-location-types"
              role="group"
            >
              {([
                ["all", text.palLocationTypeAll, true],
                ["wild", text.palLocationTypeWild, spawnResponse !== undefined],
                ["boss", text.palLocationTypeBoss, bossMarkers.length > 0],
              ] as const).map(([value, label, available]) => <Button
                aria-pressed={locationType === value}
                disabled={!available}
                key={value}
                onClick={() => setLocationType(value)}
                size="sm"
                variant={locationType === value ? "secondary" : "ghost"}
              >
                {label}
              </Button>)}
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
            onClickCapture={handleClickCapture}
            ref={viewportRef}
            role="region"
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
                {imageState === "ready" && visibleSpawnClusters.length > 0 ? (
                  <>
                    <SpawnPreviewCanvas clusters={visibleSpawnClusters} zoom={view.zoom} />
                    <SpawnClusterLayer
                      clusters={visibleSpawnClusters}
                      locale={locale}
                      onSelect={(cluster) => {
                        setSelectedMarker({ id: cluster.id, type: "wild" });
                        focusLocation(cluster);
                      }}
                      palName={palDisplayName}
                      selectedId={selectedMarker?.type === "wild" ? selectedMarker.id : undefined}
                      zoom={view.zoom}
                    />
                  </>
                ) : null}
                {imageState === "ready" && visibleBossMarkers.length > 0 ? (
                  <BossPreviewLayer
                    locale={locale}
                    markers={visibleBossMarkers}
                    onSelect={(marker) => {
                      setSelectedMarker({ id: marker.id, type: "boss" });
                      focusLocation(marker);
                    }}
                    selectedId={selectedMarker?.type === "boss" ? selectedMarker.id : undefined}
                    zoom={view.zoom}
                  />
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
            <aside className="palworld-pal-location-overview" aria-label={text.palLocationCurrentPal}>
              {pal ? <span className="palworld-pal-location-overview-media">
                <PalworldMedia
                  alt=""
                  imageUrl={pal.imageUrl}
                  intrinsicHeight={pal.imageHeight}
                  intrinsicWidth={pal.imageWidth}
                  kind="pal"
                  locale={locale}
                />
              </span> : null}
              <span className="palworld-pal-location-overview-copy">
                <small>{text.palLocationCurrentPal}</small>
                <strong>{palDisplayName}</strong>
                <span>
                  {spawnPointSummary
                    ? `${text.levelPrefix}${spawnPointSummary.minimumLevel}~${spawnPointSummary.maximumLevel}`
                    : bossMarkers[0]
                      ? `${text.levelPrefix}${bossMarkers[0].level}`
                      : text.none}
                </span>
              </span>
              <Button
                onClick={() => onOpenFullMap(palId)}
                size="sm"
                variant="primary"
              >
                {text.viewOnFullMap}
              </Button>
            </aside>
            <div
              aria-label={text.mapZoomLevel}
              className="palworld-pal-location-controls"
              role="group"
            >
              <Button
                aria-label={text.mapZoomIn}
                disabled={imageState !== "ready" || view.zoom >= PALWORLD_MAP_MAX_ZOOM - PALWORLD_MAP_ZOOM_EPSILON}
                onClick={() => zoomAt(viewRef.current.zoom + PALWORLD_MAP_ZOOM_STEP)}
                size="sm"
                variant="secondary"
              >+</Button>
              <Button
                aria-label={text.mapZoomOut}
                disabled={imageState !== "ready" || view.zoom <= PALWORLD_MAP_MIN_ZOOM + PALWORLD_MAP_ZOOM_EPSILON}
                onClick={() => zoomAt(viewRef.current.zoom - PALWORLD_MAP_ZOOM_STEP)}
                size="sm"
                variant="secondary"
              >−</Button>
              <Button
                aria-label={`${text.mapZoomReset}, ${text.mapZoomLevel} ${zoomPercent}%`}
                disabled={imageState !== "ready" || (view.zoom <= PALWORLD_MAP_MIN_ZOOM + PALWORLD_MAP_ZOOM_EPSILON && view.x === 0 && view.y === 0)}
                onClick={resetView}
                size="sm"
                variant="secondary"
              >{text.mapZoomReset}</Button>
              <output className="yoro-u-sr-only" aria-live="polite">{zoomPercent}%</output>
            </div>
          </div>
          <figcaption className="palworld-pal-location-caption">
            <div className="palworld-pal-location-legend" aria-label={text.palLocationLegendTitle} role="list">
              {spawnResponse ? <span role="listitem">
                <span aria-hidden="true" className="palworld-pal-location-legend-dot is-wild" />
                {text.palLocationTypeWild}
              </span> : null}
              {bossMarkers.length > 0 ? <span role="listitem">
                <span aria-hidden="true" className="palworld-pal-location-legend-dot is-boss" />
                {text.palLocationTypeBoss}
              </span> : null}
            </div>
            <section className="palworld-pal-location-quick-info" aria-label={text.palLocationQuickSummary}>
              {spawnPointSummary ? <>
                <div>
                  <span>{text.palLocationAreasLabel}</span>
                  <strong>{replaceCount(text.palLocationCountValue, spawnPointSummary.areas, locale)}</strong>
                </div>
                <div>
                  <span>{text.palLocationLevelLabel}</span>
                  <strong>{spawnPointSummary.minimumLevel}~{spawnPointSummary.maximumLevel}</strong>
                </div>
                <div>
                  <span>{text.palLocationPeriodLabel}</span>
                  <strong>{periods.join(" · ") || text.none}</strong>
                </div>
              </> : null}
              {bossMarkers.length > 0 ? <div>
                <span>{text.palLocationBossCountLabel}</span>
                <strong>{replaceCount(text.palLocationCountValue, bossMarkers.length, locale)}</strong>
              </div> : null}
            </section>
            {spawnResponse && visibleSpawnPoints.length === 0 ? (
              <p className="palworld-pal-location-inline-status" role="status">{text.palWildSpawnPeriodEmpty}</p>
            ) : null}
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
          <div className="palworld-pal-location-footer" id={mapHintId}>
            <p className="palworld-map-hint">{text.palLocationUsageShort}</p>
            <details>
              <summary>{text.palLocationHelp}</summary>
              <p>{text.mapUsageHint}</p>
            </details>
          </div>
        </figure>
      ) : null}
      {!hasLocations ? <div className="palworld-pal-location-actions">
        <Button onClick={() => onOpenFullMap(palId)} size="sm" variant="primary">
          {text.viewOnFullMap}
        </Button>
      </div> : null}
    </section>
  );
}
