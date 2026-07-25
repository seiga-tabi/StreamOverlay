import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  PalworldMapMarker,
  PalworldMapMarkersResponse,
  PalworldPalReference,
  PalworldPalSpawnPoint,
  PalworldPalSpawnResponse,
  PalworldPalSummary,
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
import {
  getPalworldMapMarkers,
  getPalworldPal,
  getPalworldPalSpawns,
} from "../api/palworld";
import {
  PALWORLD_MAP_LAYERS,
  updatePalworldMapLayerSelection,
  usePalworldMapQueryState,
  type PalworldMapLayer,
} from "../hooks/usePalworldMapQueryState";
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
  filterPalworldSpawnPointsByPeriod,
  palworldSpawnPointOpacity,
  palworldSpawnPointRadius,
  summarizePalworldSpawnPoints,
} from "../utils/spawns";
import {
  type PalworldMapExplorerLayerId,
  type PalworldMapLayerDisplayState,
  type PalworldMapLayerGroup,
  type PalworldMapLocalizedLabel,
  type PalworldMapVisibleLocation,
} from "./PalworldMapExplorerTypes";
import { PalworldMapFilterPanel } from "./PalworldMapFilterPanel";
import { PalworldMapMarkerPopover } from "./PalworldMapMarkerPopover";
import { PalworldMapMobileFilters } from "./PalworldMapMobileFilters";
import { PalworldMapVisibleLocations } from "./PalworldMapVisibleLocations";
import { PalworldMedia } from "./PalworldMedia";
import { PalworldPalPicker } from "./PalworldPalPicker";

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

const mapLabel = (ko: string, ja: string): PalworldMapLocalizedLabel => ({
  ja,
  ko,
});
const PALWORLD_MAP_MARKER_POPOVER_ID = "palworld-map-marker-popover";

function layerDisplayState(
  state: PalworldMapMarkerRequestState | PalworldMapSpawnRequestState,
): PalworldMapLayerDisplayState {
  return state;
}

function isRuntimeMapLayer(
  layerId: PalworldMapExplorerLayerId,
): layerId is PalworldMapLayer {
  return PALWORLD_MAP_LAYERS.includes(layerId as PalworldMapLayer);
}

function markerIsInsideViewport(
  marker: Pick<PalworldMapMarker, "normalizedX" | "normalizedY">,
  view: Readonly<PalworldMapViewState>,
  viewportWidth: number,
  viewportHeight: number,
): boolean {
  if (viewportWidth <= 0 || viewportHeight <= 0) return true;
  const screenX = (marker.normalizedX * viewportWidth * view.zoom) + view.x;
  const screenY = (marker.normalizedY * viewportHeight * view.zoom) + view.y;
  return screenX >= 0
    && screenX <= viewportWidth
    && screenY >= 0
    && screenY <= viewportHeight;
}

function mapCenterFromView(
  view: Readonly<PalworldMapViewState>,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } | undefined {
  if (viewportWidth <= 0 || viewportHeight <= 0 || view.zoom <= 0) {
    return undefined;
  }
  return {
    x: Math.min(1, Math.max(0, ((viewportWidth / 2) - view.x) / (viewportWidth * view.zoom))),
    y: Math.min(1, Math.max(0, ((viewportHeight / 2) - view.y) / (viewportHeight * view.zoom))),
  };
}

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
  onSelectMarker,
  popoverId,
  selectedMarkerId,
  zoom,
}: {
  focusedPalId?: string;
  locale: PalworldLocale;
  markers: readonly PalworldMapMarker[];
  onOpenPal?: (id: string) => void;
  onSelectMarker?: (
    marker: PalworldMapMarker,
    trigger: HTMLButtonElement,
  ) => void;
  popoverId?: string;
  selectedMarkerId?: string;
  zoom: number;
}) {
  return (
    <>
      {markers.map((marker) => {
        const displayName = resolvePalworldName(marker.pal, locale).text || marker.pal.nameEn;
        const label = markerLabel(marker, locale);
        const focused = marker.pal.id === focusedPalId;
        const selected = marker.id === selectedMarkerId;
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
            aria-controls={selected && popoverId ? popoverId : undefined}
            aria-current={focused ? "location" : undefined}
            aria-expanded={onSelectMarker ? selected : undefined}
            aria-label={label}
            className="palworld-map-boss-marker"
            data-focused={focused ? "true" : undefined}
            data-selected={selected ? "true" : undefined}
            data-map-interactive="true"
            key={marker.id}
            onClick={(event) => {
              event.stopPropagation();
              if (onSelectMarker) {
                onSelectMarker(marker, event.currentTarget);
              } else {
                onOpenPal?.(marker.pal.id);
              }
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
  const { pushQuery, replaceQuery, state: mapQuery } = usePalworldMapQueryState();
  const activeFocusPalId = mapQuery.focusPal ?? focusPalId;
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    PALWORLD_WORLD_MAP_IMAGE ? "loading" : "error",
  );
  const [imageRevision, setImageRevision] = useState(0);
  const [bossRevision, setBossRevision] = useState(0);
  const [spawnRevision, setSpawnRevision] = useState(0);
  const [markerResponse, setMarkerResponse] = useState<PalworldMapMarkersResponse>();
  const [markerState, setMarkerState] = useState<PalworldMapMarkerRequestState>("loading");
  const [spawnResponse, setSpawnResponse] = useState<PalworldPalSpawnResponse>();
  const [spawnState, setSpawnState] = useState<PalworldMapSpawnRequestState>("idle");
  const [focusedPal, setFocusedPal] = useState<PalworldPalReference | PalworldPalSummary | null>(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [collapsedFilterGroups, setCollapsedFilterGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const mobileFilterButtonRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  const selectedMarkerTriggerRef = useRef<HTMLElement | null>(null);
  const restoredViewKeyRef = useRef<string>();
  const appliedFocusMarkerRef = useRef<string>();
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
  const bossLayerSelected = mapQuery.layers.includes("boss");
  const spawnLayerSelected = mapQuery.layers.includes("spawn") && Boolean(activeFocusPalId);
  const visibleSpawnPoints = spawnState === "ready" && spawnResponse
    ? filterPalworldSpawnPointsByPeriod(spawnResponse.points, mapQuery.period)
    : [];
  const visibleBossMarkers = markerState === "ready" && markerResponse && bossLayerSelected
    ? activeFocusPalId
      ? filterPalworldBossMarkers(markerResponse.markers, activeFocusPalId)
      : markerResponse.markers
    : [];
  const selectedMarker = mapQuery.marker
    ? visibleBossMarkers.find((marker) => marker.id === mapQuery.marker)
    : undefined;
  const spawnSummary = spawnLayerSelected
    ? summarizePalworldSpawnPoints(visibleSpawnPoints)
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
  const zoomPercent = Math.round(view.zoom * 100);
  const mapStyle = {
    "--palworld-map-translate-x": `${view.x}px`,
    "--palworld-map-translate-y": `${view.y}px`,
    "--palworld-map-layout-width": `${view.zoom * 100}%`,
    "--palworld-map-zoom": view.zoom,
  } as CSSProperties;
  const mapAspectRatio = PALWORLD_WORLD_MAP_IMAGE
    ? `${PALWORLD_WORLD_MAP_IMAGE.width} / ${PALWORLD_WORLD_MAP_IMAGE.height}`
    : "1 / 1";

  useEffect(() => {
    if (mapQuery.world !== "main") {
      replaceQuery({ marker: null, world: "main" });
    }
  }, [mapQuery.world, replaceQuery]);

  useEffect(() => {
    const controller = new AbortController();
    setMarkerState("loading");
    setMarkerResponse(undefined);
    void getPalworldMapMarkers("main", controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      setMarkerResponse(response);
      setMarkerState(response.state);
    }).catch(() => {
      if (!controller.signal.aborted) setMarkerState("error");
    });
    return () => controller.abort();
  }, [bossRevision]);

  useEffect(() => {
    if (!activeFocusPalId) {
      setSpawnResponse(undefined);
      setSpawnState("idle");
      return;
    }
    const controller = new AbortController();
    setSpawnResponse(undefined);
    setSpawnState("loading");
    void getPalworldPalSpawns(activeFocusPalId, "main", controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      setSpawnResponse(response);
      setSpawnState(response.state);
    }).catch(() => {
      if (!controller.signal.aborted) setSpawnState("error");
    });
    return () => controller.abort();
  }, [activeFocusPalId, spawnRevision]);

  useEffect(() => {
    if (!activeFocusPalId) {
      setFocusedPal(null);
      return;
    }
    const markerPal = markerResponse?.markers.find(
      (marker) => marker.pal.id === activeFocusPalId,
    )?.pal;
    if (markerPal) {
      setFocusedPal(markerPal);
      return;
    }
    const controller = new AbortController();
    void getPalworldPal(activeFocusPalId, controller.signal).then((pal) => {
      if (!controller.signal.aborted) setFocusedPal(pal);
    }).catch(() => {
      if (!controller.signal.aborted) setFocusedPal(null);
    });
    return () => controller.abort();
  }, [activeFocusPalId, markerResponse]);

  useEffect(() => {
    if (loadState !== "ready") return;
    const viewport = viewportRef.current;
    if (!viewport || viewport.clientWidth <= 0 || viewport.clientHeight <= 0) return;
    const restoreKey = mapQuery.center
      ? `${mapQuery.center.x}:${mapQuery.center.y}:${mapQuery.zoom}`
      : `center:${mapQuery.zoom}`;
    if (restoredViewKeyRef.current === restoreKey) return;
    restoredViewKeyRef.current = restoreKey;
    if (mapQuery.center) {
      commitView(focusPalworldMapViewAt(
        {
          normalizedX: mapQuery.center.x,
          normalizedY: mapQuery.center.y,
        },
        viewport.clientWidth,
        viewport.clientHeight,
        mapQuery.zoom,
      ));
    } else if (mapQuery.zoom !== PALWORLD_MAP_MIN_ZOOM) {
      commitView(focusPalworldMapViewAt(
        { normalizedX: 0.5, normalizedY: 0.5 },
        viewport.clientWidth,
        viewport.clientHeight,
        mapQuery.zoom,
      ));
    }
  }, [commitView, loadState, mapQuery.center, mapQuery.zoom, viewportRef]);

  useEffect(() => {
    if (!activeFocusPalId) {
      appliedFocusMarkerRef.current = undefined;
      return;
    }
    if (loadState !== "ready" || mapQuery.center) return;
    const marker = markerState === "ready"
      ? markerResponse?.markers.find((entry) => entry.pal.id === activeFocusPalId)
      : undefined;
    const spawnFocus = spawnState === "ready" && spawnResponse
      ? (() => {
          const weight = visibleSpawnPoints.reduce(
            (sum, point) => sum + point.placementCount,
            0,
          );
          if (weight <= 0) return undefined;
          return {
            normalizedX: visibleSpawnPoints.reduce(
              (sum, point) => sum + (point.normalizedX * point.placementCount),
              0,
            ) / weight,
            normalizedY: visibleSpawnPoints.reduce(
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
      ?? `spawn-${activeFocusPalId}-${spawnResponse?.totalPlacements ?? 0}-${mapQuery.period}`;
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
    activeFocusPalId,
    commitView,
    loadState,
    mapQuery.center,
    mapQuery.period,
    markerResponse,
    markerState,
    spawnResponse,
    spawnState,
    viewportRef,
    visibleSpawnPoints,
  ]);

  useEffect(() => {
    if (
      loadState !== "ready"
      || !selectedMarker
      || mapQuery.center
    ) {
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextView = focusPalworldMapViewAt(
      selectedMarker,
      viewport.clientWidth,
      viewport.clientHeight,
      Math.max(2, mapQuery.zoom),
    );
    commitView(nextView);
    replaceQuery({
      center: {
        x: selectedMarker.normalizedX,
        y: selectedMarker.normalizedY,
      },
      zoom: nextView.zoom,
    });
  }, [
    commitView,
    loadState,
    mapQuery.center,
    mapQuery.zoom,
    replaceQuery,
    selectedMarker,
    viewportRef,
  ]);

  useEffect(() => {
    if (loadState !== "ready") return;
    const timer = window.setTimeout(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      if (
        (!mapQuery.center && activeFocusPalId && !appliedFocusMarkerRef.current)
        || (!mapQuery.center && mapQuery.marker && !selectedMarker)
      ) {
        return;
      }
      if (
        viewRef.current.zoom <= PALWORLD_MAP_MIN_ZOOM + PALWORLD_MAP_ZOOM_EPSILON
        && viewRef.current.x === 0
        && viewRef.current.y === 0
      ) {
        if (mapQuery.center || mapQuery.zoom !== PALWORLD_MAP_MIN_ZOOM) {
          replaceQuery({
            center: null,
            zoom: PALWORLD_MAP_MIN_ZOOM,
          });
        }
        return;
      }
      const center = mapCenterFromView(
        viewRef.current,
        viewport.clientWidth,
        viewport.clientHeight,
      );
      if (!center) return;
      const centerMatches = mapQuery.center
        && Math.abs(mapQuery.center.x - center.x) < 0.000001
        && Math.abs(mapQuery.center.y - center.y) < 0.000001;
      if (centerMatches && Math.abs(mapQuery.zoom - viewRef.current.zoom) < 0.001) {
        return;
      }
      replaceQuery({
        center,
        zoom: viewRef.current.zoom,
      });
    }, 240);
    return () => window.clearTimeout(timer);
  }, [
    activeFocusPalId,
    loadState,
    mapQuery.center,
    mapQuery.marker,
    mapQuery.zoom,
    replaceQuery,
    selectedMarker,
    view.x,
    view.y,
    view.zoom,
    viewRef,
    viewportRef,
  ]);

  useEffect(() => {
    if (
      mapQuery.marker
      && markerState === "ready"
      && !visibleBossMarkers.some((marker) => marker.id === mapQuery.marker)
    ) {
      replaceQuery({ marker: null });
    }
  }, [mapQuery.marker, markerState, replaceQuery, visibleBossMarkers]);

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = window.setTimeout(() => setCopyState("idle"), 2400);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const closeMarkerPopover = useCallback((): void => {
    const trigger = selectedMarkerTriggerRef.current;
    selectedMarkerTriggerRef.current = null;
    replaceQuery({ marker: null });
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) {
        trigger.focus();
        return;
      }
      viewportRef.current?.focus();
    });
  }, [replaceQuery, viewportRef]);

  const selectBossMarker = useCallback((
    marker: PalworldMapMarker,
    trigger?: HTMLElement,
  ): void => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (trigger) {
      selectedMarkerTriggerRef.current = trigger;
    } else if (mapQuery.marker !== marker.id) {
      selectedMarkerTriggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    const nextView = focusPalworldMapViewAt(
      marker,
      viewport.clientWidth,
      viewport.clientHeight,
      Math.max(2, viewRef.current.zoom),
    );
    commitView(nextView);
    pushQuery({
      center: { x: marker.normalizedX, y: marker.normalizedY },
      marker: marker.id,
      zoom: nextView.zoom,
    });
  }, [commitView, mapQuery.marker, pushQuery, viewRef, viewportRef]);

  useEffect(() => {
    if (!selectedMarker) return undefined;

    const handleOutsidePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(`#${PALWORLD_MAP_MARKER_POPOVER_ID}`)
        || target.closest(".palworld-map-boss-marker")
        || target.closest(".yoro-modal")
      ) {
        return;
      }
      selectedMarkerTriggerRef.current = null;
      replaceQuery({ marker: null });
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [replaceQuery, selectedMarker]);

  const focusSpawnAreas = useCallback((): void => {
    const viewport = viewportRef.current;
    if (!viewport || !spawnSummary) return;
    const totalWeight = visibleSpawnPoints.reduce(
      (sum, point) => sum + point.placementCount,
      0,
    );
    if (totalWeight <= 0) return;
    const target = {
      normalizedX: visibleSpawnPoints.reduce(
        (sum, point) => sum + (point.normalizedX * point.placementCount),
        0,
      ) / totalWeight,
      normalizedY: visibleSpawnPoints.reduce(
        (sum, point) => sum + (point.normalizedY * point.placementCount),
        0,
      ) / totalWeight,
    };
    const nextView = focusPalworldMapViewAt(
      target,
      viewport.clientWidth,
      viewport.clientHeight,
      Math.max(2, viewRef.current.zoom),
    );
    commitView(nextView);
    pushQuery({
      center: { x: target.normalizedX, y: target.normalizedY },
      marker: null,
      zoom: nextView.zoom,
    });
  }, [
    commitView,
    pushQuery,
    spawnSummary,
    viewRef,
    viewportRef,
    visibleSpawnPoints,
  ]);

  const changeLayer = useCallback((
    layer: PalworldMapExplorerLayerId,
    selected: boolean,
  ): void => {
    if (!isRuntimeMapLayer(layer)) return;
    const next = selected
      ? [...mapQuery.layers, layer]
      : mapQuery.layers.filter((entry) => entry !== layer);
    pushQuery({
      layers: next,
      ...(layer === "boss" && !selected ? { marker: null } : {}),
    });
  }, [mapQuery.layers, pushQuery]);

  const changeGroupLayers = useCallback((
    layerIds: readonly PalworldMapExplorerLayerId[],
    selected: boolean,
  ): void => {
    const runtimeLayerIds = layerIds.filter(isRuntimeMapLayer);
    pushQuery({
      layers: updatePalworldMapLayerSelection(mapQuery.layers, runtimeLayerIds, selected),
      ...(!selected && runtimeLayerIds.includes("boss") ? { marker: null } : {}),
    });
  }, [mapQuery.layers, pushQuery]);

  const changeGroupCollapsed = useCallback((groupId: string, collapsed: boolean): void => {
    setCollapsedFilterGroups((current) => {
      const next = new Set(current);
      if (collapsed) next.add(groupId);
      else next.delete(groupId);
      return next;
    });
  }, []);

  const selectSpawnPal = useCallback((pal: PalworldPalSummary | null): void => {
    setFocusedPal(pal);
    if (!pal) {
      pushQuery({
        center: null,
        focusPal: null,
        marker: null,
        period: "all",
        zoom: PALWORLD_MAP_MIN_ZOOM,
      });
      resetView();
      return;
    }
    const nextLayers = mapQuery.layers.includes("spawn")
      ? mapQuery.layers
      : [...mapQuery.layers, "spawn" as const];
    appliedFocusMarkerRef.current = undefined;
    pushQuery({
      center: null,
      focusPal: pal.id,
      layers: nextLayers,
      marker: null,
      zoom: PALWORLD_MAP_MIN_ZOOM,
    });
  }, [mapQuery.layers, pushQuery, resetView]);

  function resetExplorer(): void {
    appliedFocusMarkerRef.current = undefined;
    restoredViewKeyRef.current = undefined;
    setFocusedPal(null);
    resetView();
    pushQuery({
      center: null,
      focusPal: null,
      layers: ["boss", "spawn"],
      marker: null,
      period: "all",
      world: "main",
      zoom: PALWORLD_MAP_MIN_ZOOM,
    });
  }

  function retryMapImage(): void {
    setLoadState("loading");
    setImageRevision((revision) => revision + 1);
  }

  async function copyMapLink(): Promise<void> {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  const layerStatusLabel = useCallback((
    state: PalworldMapLayerDisplayState,
  ): PalworldMapLocalizedLabel => {
    switch (state) {
      case "loading":
        return mapLabel(palworldI18n.ko.mapLayerLoading, palworldI18n.ja.mapLayerLoading);
      case "ready":
        return mapLabel(palworldI18n.ko.mapLayerReady, palworldI18n.ja.mapLayerReady);
      case "confirmed_empty":
        return mapLabel(palworldI18n.ko.mapLayerEmpty, palworldI18n.ja.mapLayerEmpty);
      case "data_unavailable":
      case "idle":
        return mapLabel(palworldI18n.ko.mapLayerUnavailable, palworldI18n.ja.mapLayerUnavailable);
      case "error":
        return mapLabel(palworldI18n.ko.mapLayerError, palworldI18n.ja.mapLayerError);
    }
  }, []);

  const layerGroups = useMemo<PalworldMapLayerGroup[]>(() => {
    const spawnDisplayState: PalworldMapLayerDisplayState = activeFocusPalId
      ? layerDisplayState(spawnState)
      : "idle";
    const unavailableStatus = layerStatusLabel("data_unavailable");
    const unavailableDescription = mapLabel(
      palworldI18n.ko.mapCoordinateExportRequired,
      palworldI18n.ja.mapCoordinateExportRequired,
    );
    return [{
      id: "pal",
      label: mapLabel(palworldI18n.ko.mapPalLayers, palworldI18n.ja.mapPalLayers),
      collapsed: collapsedFilterGroups.has("pal"),
      layers: [{
        id: "boss",
        label: mapLabel(palworldI18n.ko.mapBossMarkers, palworldI18n.ja.mapBossMarkers),
        description: mapLabel(
          palworldI18n.ko.mapBossLayerDescription,
          palworldI18n.ja.mapBossLayerDescription,
        ),
        statusLabel: layerStatusLabel(markerState),
        count: markerResponse?.markers.length,
        icon: <span className="palworld-map-filter-symbol is-boss">◆</span>,
        selected: bossLayerSelected,
        state: layerDisplayState(markerState),
      }, {
        id: "spawn",
        label: mapLabel(palworldI18n.ko.palWildSpawnAreas, palworldI18n.ja.palWildSpawnAreas),
        description: mapLabel(
          activeFocusPalId
            ? palworldI18n.ko.mapSpawnLayerDescription
            : palworldI18n.ko.mapSpawnSelectPal,
          activeFocusPalId
            ? palworldI18n.ja.mapSpawnLayerDescription
            : palworldI18n.ja.mapSpawnSelectPal,
        ),
        statusLabel: layerStatusLabel(spawnDisplayState),
        count: spawnResponse?.points.length,
        icon: <span className="palworld-map-filter-symbol is-spawn">●</span>,
        selected: spawnLayerSelected,
        state: spawnDisplayState,
      }],
    }, {
      id: "places",
      label: mapLabel(palworldI18n.ko.mapPlaceLayers, palworldI18n.ja.mapPlaceLayers),
      collapsed: collapsedFilterGroups.has("places"),
      layers: [{
        id: "fast-travel",
        label: mapLabel(palworldI18n.ko.mapFastTravel, palworldI18n.ja.mapFastTravel),
        description: unavailableDescription,
        statusLabel: unavailableStatus,
        icon: <span className="palworld-map-filter-symbol">◇</span>,
        selected: false,
        state: "data_unavailable",
      }, {
        id: "dungeon",
        label: mapLabel(palworldI18n.ko.mapDungeon, palworldI18n.ja.mapDungeon),
        description: unavailableDescription,
        statusLabel: unavailableStatus,
        icon: <span className="palworld-map-filter-symbol">▣</span>,
        selected: false,
        state: "data_unavailable",
      }, {
        id: "npc",
        label: mapLabel(palworldI18n.ko.mapMerchantsNpcs, palworldI18n.ja.mapMerchantsNpcs),
        description: unavailableDescription,
        statusLabel: unavailableStatus,
        icon: <span className="palworld-map-filter-symbol">♙</span>,
        selected: false,
        state: "data_unavailable",
      }],
    }, {
      id: "collectibles",
      label: mapLabel(
        palworldI18n.ko.mapCollectibleLayers,
        palworldI18n.ja.mapCollectibleLayers,
      ),
      collapsed: collapsedFilterGroups.has("collectibles"),
      layers: [{
        id: "egg",
        label: mapLabel(palworldI18n.ko.mapEggs, palworldI18n.ja.mapEggs),
        description: unavailableDescription,
        statusLabel: unavailableStatus,
        selected: false,
        state: "data_unavailable",
      }, {
        id: "lifmunk",
        label: mapLabel(
          palworldI18n.ko.mapLifmunkEffigies,
          palworldI18n.ja.mapLifmunkEffigies,
        ),
        description: unavailableDescription,
        statusLabel: unavailableStatus,
        selected: false,
        state: "data_unavailable",
      }, {
        id: "skill-fruit",
        label: mapLabel(palworldI18n.ko.mapSkillFruits, palworldI18n.ja.mapSkillFruits),
        description: unavailableDescription,
        statusLabel: unavailableStatus,
        selected: false,
        state: "data_unavailable",
      }, {
        id: "treasure",
        label: mapLabel(palworldI18n.ko.mapTreasures, palworldI18n.ja.mapTreasures),
        description: unavailableDescription,
        statusLabel: unavailableStatus,
        selected: false,
        state: "data_unavailable",
      }, {
        id: "journal",
        label: mapLabel(palworldI18n.ko.mapJournals, palworldI18n.ja.mapJournals),
        description: unavailableDescription,
        statusLabel: unavailableStatus,
        selected: false,
        state: "data_unavailable",
      }, {
        id: "ancient-ruin",
        label: mapLabel(palworldI18n.ko.mapAncientRuins, palworldI18n.ja.mapAncientRuins),
        description: unavailableDescription,
        statusLabel: unavailableStatus,
        selected: false,
        state: "data_unavailable",
      }],
    }];
  }, [
    activeFocusPalId,
    bossLayerSelected,
    collapsedFilterGroups,
    layerStatusLabel,
    markerResponse,
    markerState,
    spawnLayerSelected,
    spawnResponse,
    spawnState,
  ]);

  const locations = useMemo<PalworldMapVisibleLocation[]>(() => {
    const viewport = viewportRef.current;
    const width = viewport?.clientWidth ?? 0;
    const height = viewport?.clientHeight ?? 0;
    const bossLocations = visibleBossMarkers
      .filter((marker) => markerIsInsideViewport(marker, view, width, height))
      .slice(0, 60)
      .map((marker) => {
        const title = {
          ko: marker.pal.nameKo,
          ja: marker.pal.nameJa,
        };
        return {
          id: marker.id,
          layerId: "boss" as const,
          title,
          layerLabel: mapLabel(
            palworldI18n.ko.mapBossMarker,
            palworldI18n.ja.mapBossMarker,
          ),
          media: (
            <PalworldMedia
              alt=""
              imageUrl={marker.pal.imageUrl}
              intrinsicHeight={marker.pal.imageHeight}
              intrinsicWidth={marker.pal.imageWidth}
              kind="pal"
              locale={locale}
            />
          ),
          metadata: [{
            label: mapLabel(palworldI18n.ko.mapMarkerLevel, palworldI18n.ja.mapMarkerLevel),
            value: `${text.levelPrefix}${marker.level}`,
          }],
          selected: marker.id === selectedMarker?.id,
        };
      });
    if (!spawnLayerSelected || !spawnSummary || !activeFocusPalId) {
      return bossLocations;
    }
    const fallbackName = focusedPal
      ? resolvePalworldName(focusedPal, locale).text
      : activeFocusPalId;
    return [{
      id: `spawn-${activeFocusPalId}`,
      layerId: "spawn" as const,
      title: mapLabel(
        focusedPal?.nameKo ?? fallbackName,
        focusedPal?.nameJa ?? fallbackName,
      ),
      layerLabel: mapLabel(
        palworldI18n.ko.palWildSpawnAreas,
        palworldI18n.ja.palWildSpawnAreas,
      ),
      description: mapLabel(
        palworldI18n.ko.mapSpawnLocationDescription,
        palworldI18n.ja.mapSpawnLocationDescription,
      ),
      media: focusedPal ? (
        <PalworldMedia
          alt=""
          imageUrl={focusedPal.imageUrl}
          intrinsicHeight={focusedPal.imageHeight}
          intrinsicWidth={focusedPal.imageWidth}
          kind="pal"
          locale={locale}
        />
      ) : undefined,
      metadata: [{
        label: mapLabel(palworldI18n.ko.mapSpawnAreasCount, palworldI18n.ja.mapSpawnAreasCount),
        value: spawnSummary.areas.toLocaleString(localeTag),
      }, {
        label: mapLabel(palworldI18n.ko.mapMarkerLevel, palworldI18n.ja.mapMarkerLevel),
        value: spawnLevelSummary,
      }],
    }, ...bossLocations];
  }, [
    activeFocusPalId,
    focusedPal,
    locale,
    localeTag,
    selectedMarker,
    spawnLayerSelected,
    spawnLevelSummary,
    spawnSummary,
    text.levelPrefix,
    view,
    viewportRef,
    visibleBossMarkers,
  ]);

  const locationsState: PalworldMapLayerDisplayState = locations.length > 0
    ? "ready"
    : (bossLayerSelected && markerState === "loading")
      || (spawnLayerSelected && spawnState === "loading")
      ? "loading"
      : (bossLayerSelected && markerState === "error")
        || (spawnLayerSelected && spawnState === "error")
        ? "error"
        : (bossLayerSelected && markerState === "data_unavailable")
          || (spawnLayerSelected && spawnState === "data_unavailable")
          ? "data_unavailable"
          : "confirmed_empty";
  const filterCopy = {
    all: mapLabel(palworldI18n.ko.mapFilterAll, palworldI18n.ja.mapFilterAll),
    hide: mapLabel(palworldI18n.ko.mapFilterHide, palworldI18n.ja.mapFilterHide),
    reset: mapLabel(palworldI18n.ko.mapFilterReset, palworldI18n.ja.mapFilterReset),
    show: mapLabel(palworldI18n.ko.mapFilterShow, palworldI18n.ja.mapFilterShow),
    title: mapLabel(palworldI18n.ko.mapFilters, palworldI18n.ja.mapFilters),
  };
  const activeLayerCount = Number(bossLayerSelected) + Number(spawnLayerSelected);
  const mobileFilterButtonCopy = mapLabel(
    palworldI18n.ko.mapMobileFilterButton.replace(
      "{count}",
      activeLayerCount.toLocaleString("ko-KR"),
    ),
    palworldI18n.ja.mapMobileFilterButton.replace(
      "{count}",
      activeLayerCount.toLocaleString("ja-JP"),
    ),
  );

  function renderFilterControls(testId: string): ReactNode {
    return (
      <>
        <PalworldPalPicker
          label={text.mapPalSearch}
          locale={locale}
          onChange={selectSpawnPal}
          onOpenPal={onOpenPal}
          selected={focusedPal}
          testId={testId}
        />
        {activeFocusPalId ? (
          <fieldset className="palworld-map-period-filter">
            <legend>{text.palWildSpawnPeriod}</legend>
            <div>
              {(["all", "day", "night"] as const).map((period) => {
                const label = period === "all"
                  ? text.palWildSpawnAllPeriods
                  : period === "day"
                    ? text.palWildSpawnDay
                    : text.palWildSpawnNight;
                return (
                  <button
                    aria-pressed={mapQuery.period === period}
                    key={period}
                    onClick={() => pushQuery({ period })}
                    type="button"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}
      </>
    );
  }
  const markerPopover = selectedMarker ? (
    <PalworldMapMarkerPopover
      actions={[{
        id: "center",
        label: mapLabel(palworldI18n.ko.mapCenterMarker, palworldI18n.ja.mapCenterMarker),
        onClick: () => selectBossMarker(selectedMarker),
      }, {
        id: "detail",
        label: mapLabel(palworldI18n.ko.mapOpenPalDetail, palworldI18n.ja.mapOpenPalDetail),
        onClick: () => onOpenPal?.(selectedMarker.pal.id),
        variant: "primary",
      }, {
        id: "copy",
        label: mapLabel(palworldI18n.ko.mapCopyLink, palworldI18n.ja.mapCopyLink),
        onClick: () => void copyMapLink(),
      }]}
      closeLabel={mapLabel(palworldI18n.ko.mapCloseMarker, palworldI18n.ja.mapCloseMarker)}
      details={[{
        label: mapLabel(palworldI18n.ko.mapMarkerLevel, palworldI18n.ja.mapMarkerLevel),
        value: `${text.levelPrefix}${selectedMarker.level}`,
      }, {
        label: mapLabel(palworldI18n.ko.mapNormalizedPosition, palworldI18n.ja.mapNormalizedPosition),
        value: `${(selectedMarker.normalizedX * 100).toFixed(1)}% · ${(selectedMarker.normalizedY * 100).toFixed(1)}%`,
      }]}
      id={PALWORLD_MAP_MARKER_POPOVER_ID}
      kindLabel={mapLabel(palworldI18n.ko.mapBossMarker, palworldI18n.ja.mapBossMarker)}
      locale={locale}
      media={(
        <PalworldMedia
          alt=""
          imageUrl={selectedMarker.pal.imageUrl}
          intrinsicHeight={selectedMarker.pal.imageHeight}
          intrinsicWidth={selectedMarker.pal.imageWidth}
          kind="pal"
          locale={locale}
        />
      )}
      onClose={closeMarkerPopover}
      title={{
        ko: selectedMarker.pal.nameKo,
        ja: selectedMarker.pal.nameJa,
      }}
    />
  ) : null;

  return (
    <section className="palworld-page-section palworld-map-page" aria-labelledby="palworld-map-title">
      <header className="palworld-page-heading">
        <div>
          <span aria-hidden="true">{text.mapKicker}</span>
          <h1 id="palworld-map-title" data-ko={palworldI18n.ko.mapTitle} data-ja={palworldI18n.ja.mapTitle}>{text.mapTitle}</h1>
          <p data-ko={palworldI18n.ko.mapDescription} data-ja={palworldI18n.ja.mapDescription}>{text.mapDescription}</p>
        </div>
      </header>

      <div
        className="palworld-map-workspace"
        data-filter-collapsed={filtersCollapsed ? "true" : undefined}
      >
        <Button
          aria-expanded={mobileFiltersOpen}
          aria-haspopup="dialog"
          className="palworld-map-mobile-filter-trigger"
          data-ja={mobileFilterButtonCopy.ja}
          data-ko={mobileFilterButtonCopy.ko}
          onClick={() => setMobileFiltersOpen(true)}
          ref={mobileFilterButtonRef}
          size="sm"
          variant="secondary"
        >
          {mobileFilterButtonCopy[locale]}
        </Button>
        <PalworldMapFilterPanel
          className="palworld-map-desktop-filter"
          collapsed={filtersCollapsed}
          copy={filterCopy}
          groups={layerGroups}
          locale={locale}
          onCollapsedChange={setFiltersCollapsed}
          onGroupCollapsedChange={changeGroupCollapsed}
          onGroupLayerChange={changeGroupLayers}
          onLayerChange={changeLayer}
          onReset={resetExplorer}
        >
          {renderFilterControls("palworld-map-pal-picker")}
        </PalworldMapFilterPanel>
        <PalworldMapMobileFilters
          copy={filterCopy}
          groups={layerGroups}
          locale={locale}
          onClose={() => setMobileFiltersOpen(false)}
          onGroupCollapsedChange={changeGroupCollapsed}
          onGroupLayerChange={changeGroupLayers}
          onLayerChange={changeLayer}
          onReset={() => {
            resetExplorer();
            setMobileFiltersOpen(false);
          }}
          open={mobileFiltersOpen}
          returnFocusRef={mobileFilterButtonRef}
        >
          {renderFilterControls("palworld-map-mobile-pal-picker")}
        </PalworldMapMobileFilters>

        <div className="palworld-map-explorer-main">
          <Card as="section" className="palworld-map-card" padding="none" aria-labelledby="palworld-map-title">
            <div className="palworld-map-toolbar">
              <div
                aria-live="polite"
                aria-relevant="text"
                className="palworld-map-toolbar-info"
              >
                {markerState === "loading" ? (
                  <Badge role="status" tone="neutral">{text.mapBossLoading}</Badge>
                ) : null}
                {markerState === "ready" && markerResponse ? (
                  <Badge tone="danger">
                    {text.mapBossMarkers} {visibleBossMarkers.length}
                  </Badge>
                ) : null}
                {spawnLayerSelected && spawnState === "ready" && spawnSummary ? (
                  <Badge tone="info">{text.palWildSpawnAreas} · {spawnMapSummary}</Badge>
                ) : null}
                {spawnLayerSelected && spawnState === "loading" ? (
                  <Badge role="status" tone="neutral">{text.palWildSpawnLoading}</Badge>
                ) : null}
                {spawnLayerSelected && spawnState === "confirmed_empty" ? (
                  <Badge tone="neutral">{text.palWildSpawnEmpty}</Badge>
                ) : null}
                {spawnLayerSelected && spawnState === "data_unavailable" ? (
                  <Badge tone="neutral">{text.palLocationUnavailable}</Badge>
                ) : null}
                {spawnLayerSelected && spawnState === "error" ? (
                  <span className="palworld-map-marker-error" role="alert">
                    <Badge tone="warning">{text.palLocationError}</Badge>
                    <Button onClick={() => setSpawnRevision((revision) => revision + 1)} size="sm" variant="ghost">
                      {text.palWildSpawnRetry}
                    </Button>
                  </span>
                ) : null}
                {markerState === "data_unavailable" ? (
                  <Badge tone="neutral">{text.mapBossUnavailable}</Badge>
                ) : null}
                {markerState === "error" ? (
                  <span className="palworld-map-marker-error" role="alert">
                    <Badge tone="warning">{text.mapBossLoadError}</Badge>
                    <Button onClick={() => setBossRevision((revision) => revision + 1)} size="sm" variant="ghost">
                      {text.mapBossRetry}
                    </Button>
                  </span>
                ) : null}
              </div>
              <div
                aria-label={text.mapWorldSelection}
                className="palworld-map-world-switcher"
                role="tablist"
              >
                <button aria-selected="true" role="tab" type="button">
                  {text.mapMainWorld}
                </button>
                <button
                  aria-describedby="palworld-map-tree-status"
                  aria-selected="false"
                  disabled
                  role="tab"
                  type="button"
                >
                  {text.mapTreeWorld}
                </button>
                <span className="yoro-u-sr-only" id="palworld-map-tree-status">
                  {text.mapWorldUnavailable}
                </span>
              </div>
            </div>

            {(spawnLayerSelected || visibleBossMarkers.length > 0) ? (
              <div aria-label={text.mapLayerLegend} className="palworld-map-layer-legend" role="group">
                <strong>{text.mapLayerLegend}</strong>
                <ul>
                  {spawnLayerSelected ? (
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
                  {bossLayerSelected && markerState === "ready" ? (
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

            <div className="palworld-map-canvas-shell">
              <figure className="palworld-map-figure">
                <div
                aria-describedby="palworld-map-caption palworld-map-hint"
                aria-label={text.mapImageAlt}
                aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight + - Home"
                className="palworld-map-viewport"
                data-testid="palworld-map-viewport"
                data-panning={isPanning ? "true" : undefined}
                data-zoomed={view.zoom > PALWORLD_MAP_MIN_ZOOM + PALWORLD_MAP_ZOOM_EPSILON ? "true" : undefined}
                onClick={(event) => {
                  const target = event.target;
                  if (
                    target === event.currentTarget
                    || !(target instanceof Element)
                    || !target.closest("[data-map-interactive='true']")
                  ) {
                    if (selectedMarker) closeMarkerPopover();
                  }
                }}
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
                    <EmptyStateTitle>{text.mapLoadError}</EmptyStateTitle>
                    <EmptyStateDescription>{text.mapLoadErrorDescription}</EmptyStateDescription>
                    <EmptyStateActions>
                      <Button onClick={retryMapImage} variant="secondary">{text.mapRetry}</Button>
                    </EmptyStateActions>
                  </EmptyState>
                ) : (
                  <div
                    className="palworld-map-stage palworld-map-stage-layout-zoom"
                    data-testid="palworld-map-stage"
                    style={mapStyle}
                  >
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
                    {loadState === "ready" && spawnLayerSelected && spawnState === "ready" ? (
                      <div className="palworld-map-marker-layer" data-testid="palworld-map-spawn-areas">
                        <PalworldSpawnAreaLayer points={visibleSpawnPoints} zoom={view.zoom} />
                      </div>
                    ) : null}
                    {loadState === "ready" && visibleBossMarkers.length ? (
                      <div className="palworld-map-marker-layer" data-testid="palworld-map-boss-markers">
                        <PalworldBossMarkerLayer
                          focusedPalId={activeFocusPalId}
                          locale={locale}
                          markers={visibleBossMarkers}
                          onOpenPal={onOpenPal}
                          onSelectMarker={selectBossMarker}
                          popoverId={PALWORLD_MAP_MARKER_POPOVER_ID}
                          selectedMarkerId={selectedMarker?.id}
                          zoom={view.zoom}
                        />
                      </div>
                    ) : null}
                  </div>
                )}
                <div className="palworld-map-controls" aria-label={text.mapZoomLevel} data-map-interactive="true">
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
                    disabled={view.zoom <= PALWORLD_MAP_MIN_ZOOM + PALWORLD_MAP_ZOOM_EPSILON && view.x === 0 && view.y === 0}
                    onClick={() => {
                      resetView();
                      replaceQuery({ center: null, marker: null, zoom: PALWORLD_MAP_MIN_ZOOM });
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    {text.mapZoomReset}
                  </Button>
                </div>
                <span aria-live="polite" className="yoro-u-sr-only">
                  {copyState === "copied"
                    ? text.mapLinkCopied
                    : copyState === "error"
                      ? text.mapLinkCopyError
                      : ""}
                </span>
                </div>
                <figcaption className="palworld-map-caption" id="palworld-map-caption">
                  <p data-ko={palworldI18n.ko.mapCaption} data-ja={palworldI18n.ja.mapCaption}>{text.mapCaption}</p>
                </figcaption>
              </figure>
              {markerPopover}
            </div>
            <p className="palworld-map-hint" id="palworld-map-hint" data-ko={palworldI18n.ko.mapUsageHint} data-ja={palworldI18n.ja.mapUsageHint}>{text.mapUsageHint}</p>
          </Card>

          <PalworldMapVisibleLocations
            copy={{
              empty: mapLabel(palworldI18n.ko.mapVisibleLocationsEmpty, palworldI18n.ja.mapVisibleLocationsEmpty),
              error: mapLabel(palworldI18n.ko.mapVisibleLocationsError, palworldI18n.ja.mapVisibleLocationsError),
              loading: mapLabel(palworldI18n.ko.mapVisibleLocationsLoading, palworldI18n.ja.mapVisibleLocationsLoading),
              retry: mapLabel(palworldI18n.ko.retry, palworldI18n.ja.retry),
              title: mapLabel(palworldI18n.ko.mapVisibleLocations, palworldI18n.ja.mapVisibleLocations),
              unavailable: mapLabel(palworldI18n.ko.mapVisibleLocationsUnavailable, palworldI18n.ja.mapVisibleLocationsUnavailable),
            }}
            locale={locale}
            locations={locations}
            onRetry={() => {
              if (bossLayerSelected) setBossRevision((revision) => revision + 1);
              if (spawnLayerSelected) setSpawnRevision((revision) => revision + 1);
            }}
            onSelect={(location) => {
              if (location.layerId === "spawn") {
                focusSpawnAreas();
                return;
              }
              const marker = visibleBossMarkers.find((entry) => entry.id === location.id);
              if (marker) selectBossMarker(marker);
            }}
            state={locationsState}
          />
        </div>
      </div>
    </section>
  );
}
