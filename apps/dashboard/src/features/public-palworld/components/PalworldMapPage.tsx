import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
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
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { isLocalPalworldMapUrl, PALWORLD_WORLD_MAP_IMAGE } from "../utils/element-images";
import { resolvePalworldName } from "../utils/localization";
import { PalworldMedia } from "./PalworldMedia";

export const PALWORLD_WORLD_MAP_IMAGE_URL = PALWORLD_WORLD_MAP_IMAGE?.imageUrl;
const MAP_MIN_ZOOM = 1;
const MAP_MAX_ZOOM = 3;
const MAP_ZOOM_STEP = 0.5;
const MAP_KEYBOARD_PAN_STEP = 48;
const MAP_ZOOM_EPSILON = 0.001;

type MapPoint = {
  x: number;
  y: number;
};

export type PalworldMapViewState = MapPoint & {
  zoom: number;
};

type PalworldMapPageProps = {
  focusPalId?: string;
  locale: PalworldLocale;
  markerLayer?: ReactNode | ((view: Readonly<PalworldMapViewState>) => ReactNode);
  onOpenPal?: (id: string) => void;
};

type MapGesture =
  | {
      kind: "drag";
      lastPoint: MapPoint;
    }
  | {
      anchorContent: MapPoint;
      kind: "pinch";
      startDistance: number;
      startZoom: number;
    };

export { isLocalPalworldMapUrl };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function clampPalworldMapView(
  view: Readonly<PalworldMapViewState>,
  viewportWidth: number,
  viewportHeight: number,
): PalworldMapViewState {
  const zoom = clamp(Number.isFinite(view.zoom) ? view.zoom : MAP_MIN_ZOOM, MAP_MIN_ZOOM, MAP_MAX_ZOOM);
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { x: 0, y: 0, zoom };
  }

  return {
    x: clamp(Number.isFinite(view.x) ? view.x : 0, viewportWidth - (viewportWidth * zoom), 0),
    y: clamp(Number.isFinite(view.y) ? view.y : 0, viewportHeight - (viewportHeight * zoom), 0),
    zoom,
  };
}

export function zoomPalworldMapViewAt(
  view: Readonly<PalworldMapViewState>,
  nextZoom: number,
  anchor: Readonly<MapPoint>,
  viewportWidth: number,
  viewportHeight: number,
): PalworldMapViewState {
  const zoom = clamp(nextZoom, MAP_MIN_ZOOM, MAP_MAX_ZOOM);
  const currentZoom = clamp(view.zoom, MAP_MIN_ZOOM, MAP_MAX_ZOOM);
  return clampPalworldMapView({
    x: anchor.x - (((anchor.x - view.x) / currentZoom) * zoom),
    y: anchor.y - (((anchor.y - view.y) / currentZoom) * zoom),
    zoom,
  }, viewportWidth, viewportHeight);
}

export function focusPalworldMapViewAt(
  marker: Pick<PalworldMapMarker, "normalizedX" | "normalizedY">,
  viewportWidth: number,
  viewportHeight: number,
  zoom = 2,
): PalworldMapViewState {
  return clampPalworldMapView({
    x: (viewportWidth / 2) - (marker.normalizedX * viewportWidth * zoom),
    y: (viewportHeight / 2) - (marker.normalizedY * viewportHeight * zoom),
    zoom,
  }, viewportWidth, viewportHeight);
}

function distanceBetween(first: MapPoint, second: MapPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpoint(first: MapPoint, second: MapPoint): MapPoint {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function isMapControlTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest("button, a, input, select, textarea, [data-map-interactive='true']"));
}

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
          r={0.009 / zoom}
        />
      ))}
    </svg>
  );
}

export function PalworldMapPage({ focusPalId, locale, markerLayer, onOpenPal }: PalworldMapPageProps) {
  const text = palworldI18n[locale];
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(PALWORLD_WORLD_MAP_IMAGE ? "loading" : "error");
  const [imageRevision, setImageRevision] = useState(0);
  const [markerRevision, setMarkerRevision] = useState(0);
  const [markerResponse, setMarkerResponse] = useState<PalworldMapMarkersResponse>();
  const [markerState, setMarkerState] = useState<PalworldMapMarkerRequestState>("loading");
  const [spawnResponse, setSpawnResponse] = useState<PalworldPalSpawnResponse>();
  const [spawnState, setSpawnState] = useState<PalworldMapSpawnRequestState>("idle");
  const [view, setView] = useState<PalworldMapViewState>({ x: 0, y: 0, zoom: MAP_MIN_ZOOM });
  const [isPanning, setIsPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  const appliedFocusMarkerRef = useRef<string>();
  const pointersRef = useRef(new Map<number, MapPoint>());
  const gestureRef = useRef<MapGesture>();
  const zoomPercent = Math.round(view.zoom * 100);
  const mapStyle = {
    "--palworld-map-translate-x": `${view.x}px`,
    "--palworld-map-translate-y": `${view.y}px`,
    "--palworld-map-zoom": view.zoom,
  } as CSSProperties;

  const commitView = useCallback((nextView: PalworldMapViewState): void => {
    const viewport = viewportRef.current;
    const clampedView = clampPalworldMapView(
      nextView,
      viewport?.clientWidth ?? 0,
      viewport?.clientHeight ?? 0,
    );
    viewRef.current = clampedView;
    setView(clampedView);
  }, []);

  const zoomAt = useCallback((nextZoom: number, anchor?: MapPoint): void => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    commitView(zoomPalworldMapViewAt(
      viewRef.current,
      nextZoom,
      anchor ?? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 },
      viewport.clientWidth,
      viewport.clientHeight,
    ));
  }, [commitView]);

  const resetView = useCallback((): void => {
    pointersRef.current.clear();
    gestureRef.current = undefined;
    setIsPanning(false);
    commitView({ x: 0, y: 0, zoom: MAP_MIN_ZOOM });
  }, [commitView]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const clampCurrentView = (): void => commitView(viewRef.current);
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", clampCurrentView);
      return () => window.removeEventListener("resize", clampCurrentView);
    }

    const observer = new ResizeObserver(clampCurrentView);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [commitView]);

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
  }, [markerRevision]);

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
  }, [focusPalId, markerRevision]);

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

  function pointFromPointer(event: PointerEvent<HTMLDivElement>): MapPoint {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  function beginPinch(): void {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) {
      return;
    }
    const [first, second] = points;
    if (!first || !second) {
      return;
    }
    const center = midpoint(first, second);
    gestureRef.current = {
      anchorContent: {
        x: (center.x - viewRef.current.x) / viewRef.current.zoom,
        y: (center.y - viewRef.current.y) / viewRef.current.zoom,
      },
      kind: "pinch",
      startDistance: Math.max(1, distanceBetween(first, second)),
      startZoom: viewRef.current.zoom,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (
      loadState !== "ready"
      || (event.pointerType === "mouse" && event.button !== 0)
      || isMapControlTarget(event.target)
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromPointer(event);
    pointersRef.current.set(event.pointerId, point);
    setIsPanning(true);
    if (pointersRef.current.size >= 2) {
      beginPinch();
    } else {
      gestureRef.current = { kind: "drag", lastPoint: point };
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }

    event.preventDefault();
    const point = pointFromPointer(event);
    pointersRef.current.set(event.pointerId, point);
    const gesture = gestureRef.current;

    if (pointersRef.current.size >= 2) {
      if (!gesture || gesture.kind !== "pinch") {
        beginPinch();
        return;
      }
      const points = [...pointersRef.current.values()];
      const [first, second] = points;
      if (!first || !second) {
        return;
      }
      const center = midpoint(first, second);
      const zoom = clamp(
        gesture.startZoom * (distanceBetween(first, second) / gesture.startDistance),
        MAP_MIN_ZOOM,
        MAP_MAX_ZOOM,
      );
      commitView({
        x: center.x - (gesture.anchorContent.x * zoom),
        y: center.y - (gesture.anchorContent.y * zoom),
        zoom,
      });
      return;
    }

    if (!gesture || gesture.kind !== "drag") {
      gestureRef.current = { kind: "drag", lastPoint: point };
      return;
    }
    commitView({
      ...viewRef.current,
      x: viewRef.current.x + (point.x - gesture.lastPoint.x),
      y: viewRef.current.y + (point.y - gesture.lastPoint.y),
    });
    gestureRef.current = { kind: "drag", lastPoint: point };
  }

  function endPointer(event: PointerEvent<HTMLDivElement>): void {
    if (!pointersRef.current.delete(event.pointerId)) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const remainingPoint = pointersRef.current.values().next().value as MapPoint | undefined;
    if (remainingPoint) {
      gestureRef.current = { kind: "drag", lastPoint: remainingPoint };
      return;
    }
    gestureRef.current = undefined;
    setIsPanning(false);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>): void {
    if (loadState !== "ready") {
      return;
    }
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const wheelDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    zoomAt(viewRef.current.zoom * Math.exp(-wheelDelta * 0.0015), {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.target !== event.currentTarget || loadState !== "ready") {
      return;
    }

    switch (event.key) {
      case "ArrowLeft":
        commitView({ ...viewRef.current, x: viewRef.current.x + MAP_KEYBOARD_PAN_STEP });
        break;
      case "ArrowRight":
        commitView({ ...viewRef.current, x: viewRef.current.x - MAP_KEYBOARD_PAN_STEP });
        break;
      case "ArrowUp":
        commitView({ ...viewRef.current, y: viewRef.current.y + MAP_KEYBOARD_PAN_STEP });
        break;
      case "ArrowDown":
        commitView({ ...viewRef.current, y: viewRef.current.y - MAP_KEYBOARD_PAN_STEP });
        break;
      case "+":
      case "=":
        zoomAt(viewRef.current.zoom + MAP_ZOOM_STEP);
        break;
      case "-":
      case "_":
        zoomAt(viewRef.current.zoom - MAP_ZOOM_STEP);
        break;
      case "Home":
        resetView();
        break;
      default:
        return;
    }
    event.preventDefault();
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
                data-ko={`${palworldI18n.ko.mapBossMarkers} ${markerResponse.markers.length}`}
                data-ja={`${palworldI18n.ja.mapBossMarkers} ${markerResponse.markers.length}`}
                tone="danger"
              >
                {text.mapBossMarkers} {markerResponse.markers.length}
              </Badge>
            ) : null}
            {spawnState === "ready" && spawnResponse ? (
              <Badge tone="info">
                {text.palWildSpawnAreas} {spawnResponse.totalPlacements.toLocaleString(
                  locale === "ko" ? "ko-KR" : "ja-JP",
                )}
              </Badge>
            ) : null}
            {spawnState === "loading" ? (
              <Badge role="status" tone="neutral">
                {text.palLocationLoading}
              </Badge>
            ) : null}
            {spawnState === "confirmed_empty" ? (
              <Badge tone="neutral">{text.palLocationEmpty}</Badge>
            ) : null}
            {spawnState === "data_unavailable" ? (
              <Badge tone="neutral">{text.palLocationUnavailable}</Badge>
            ) : null}
            {spawnState === "error" ? (
              <span className="palworld-map-marker-error" role="alert">
                <Badge tone="warning">{text.palLocationError}</Badge>
                <Button
                  onClick={() => setMarkerRevision((revision) => revision + 1)}
                  size="sm"
                  variant="ghost"
                >
                  {text.retry}
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
                  onClick={() => setMarkerRevision((revision) => revision + 1)}
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
              disabled={view.zoom <= MAP_MIN_ZOOM + MAP_ZOOM_EPSILON}
              onClick={() => zoomAt(viewRef.current.zoom - MAP_ZOOM_STEP)}
              size="sm"
              variant="secondary"
            >
              −
            </Button>
            <output aria-live="polite" aria-label={`${text.mapZoomLevel} ${zoomPercent}%`}>{zoomPercent}%</output>
            <Button
              aria-label={text.mapZoomIn}
              disabled={view.zoom >= MAP_MAX_ZOOM - MAP_ZOOM_EPSILON}
              onClick={() => zoomAt(viewRef.current.zoom + MAP_ZOOM_STEP)}
              size="sm"
              variant="secondary"
            >
              +
            </Button>
            <Button
              data-ko={palworldI18n.ko.mapZoomReset}
              data-ja={palworldI18n.ja.mapZoomReset}
              disabled={view.zoom <= MAP_MIN_ZOOM + MAP_ZOOM_EPSILON && view.x === 0 && view.y === 0}
              onClick={resetView}
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
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight + - Home"
            className="palworld-map-viewport"
            data-testid="palworld-map-viewport"
            data-panning={isPanning ? "true" : undefined}
            data-zoomed={view.zoom > MAP_MIN_ZOOM + MAP_ZOOM_EPSILON ? "true" : undefined}
            onKeyDown={handleKeyDown}
            onLostPointerCapture={endPointer}
            onPointerCancel={endPointer}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPointer}
            onWheel={handleWheel}
            ref={viewportRef}
            role="region"
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
                {loadState === "ready" && markerState === "ready" && markerResponse?.markers.length ? (
                  <div className="palworld-map-marker-layer" data-testid="palworld-map-boss-markers">
                    <PalworldBossMarkerLayer
                      focusedPalId={focusPalId}
                      locale={locale}
                      markers={markerResponse.markers}
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
