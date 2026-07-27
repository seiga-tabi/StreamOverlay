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
  PalworldMapLocation,
  PalworldMapLocationCategory,
  PalworldMapLocationsResponse,
  PalworldMapMarker,
  PalworldMapMarkersResponse,
  PalworldPalReference,
  PalworldPalSpawnPoint,
  PalworldPalSpawnResponse,
  PalworldPalSummary,
} from "@streamops/shared";
import {
  PALWORLD_MAP_LOCATION_CATEGORIES,
  PALWORLD_MAP_LOCATION_MAX_ARTIFACT_ENTRIES,
  PALWORLD_MAP_LOCATION_MAX_RESPONSE,
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
  getPalworldMapLocations,
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
import {
  isLocalPalworldMapUrl,
  PALWORLD_MAP_IMAGES,
  PALWORLD_WORLD_MAP_IMAGE,
} from "../utils/element-images";
import { resolvePalworldName } from "../utils/localization";
import {
  PALWORLD_MAP_COLLECTIBLE_TYPE_IDS,
  PALWORLD_MAP_EGG_TYPE_IDS,
  PALWORLD_MAP_RESOURCE_TYPE_IDS,
  PALWORLD_MAP_STATUE_TYPE_IDS,
  isPalworldMapCollectibleTypeId,
  palworldMapCollectibleCategory,
  palworldMapCollectibleTypeForLocation,
  palworldMapCollectibleTypesForCategory,
  type PalworldMapCollectibleTypeId,
} from "../utils/map-collectible-types";
import { PALWORLD_MAP_LAYER_ICONS } from "../utils/map-layer-icons";
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
} from "./PalworldMapExplorerTypes";
import { PalworldMapFilterPanel } from "./PalworldMapFilterPanel";
import {
  PalworldMapLocationIcon,
  PalworldMapLocationLayer,
} from "./PalworldMapLocationLayer";
import {
  PalworldMapLegend,
  PalworldMapLegendSheet,
} from "./PalworldMapLegend";
import { PalworldMapMarkerPopover } from "./PalworldMapMarkerPopover";
import { PalworldMapMobileFilters } from "./PalworldMapMobileFilters";
import { isLocalPalworldImageUrl, PalworldMedia } from "./PalworldMedia";
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
type PalworldMapLocationRequestState =
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
const PALWORLD_MAP_LOCATION_PAGE_LIMIT = PALWORLD_MAP_LOCATION_MAX_RESPONSE;
const PALWORLD_MAP_LOCATION_MAX_PAGES = Math.ceil(
  PALWORLD_MAP_LOCATION_MAX_ARTIFACT_ENTRIES / PALWORLD_MAP_LOCATION_PAGE_LIMIT,
);

function mapLocationPageIdentity(response: PalworldMapLocationsResponse): string {
  return JSON.stringify({
    world: response.world,
    layers: response.layers,
    release: {
      gameVersion: response.metadata.gameVersion,
      release: response.metadata.release ?? null,
      steamBuildId: response.metadata.steamBuildId ?? null,
      sourceRevision: response.metadata.sourceRevision,
    },
    overlay: response.overlay ? {
      archiveSha256: response.overlay.archiveSha256,
      sourceMember: response.overlay.sourceMember,
      sourceMemberSha256: response.overlay.sourceMemberSha256,
      targetMapAssetSha256: response.overlay.targetMapAssetSha256,
      targetGameVersion: response.overlay.targetGameVersion,
      compatibilityBasis: response.overlay.compatibilityBasis,
      transformRevision: response.overlay.transformRevision,
      activationBasis: response.overlay.activationBasis ?? null,
      compatibilityApprovalSha256:
        response.overlay.compatibilityApprovalSha256 ?? null,
    } : null,
  });
}

const PALWORLD_MAP_LOCATION_LABELS: Readonly<
  Record<PalworldMapLocationCategory, PalworldMapLocalizedLabel>
> = {
  "fast-travel": mapLabel(palworldI18n.ko.mapFastTravel, palworldI18n.ja.mapFastTravel),
  dungeon: mapLabel(palworldI18n.ko.mapDungeon, palworldI18n.ja.mapDungeon),
  npc: mapLabel(palworldI18n.ko.mapMerchantsNpcs, palworldI18n.ja.mapMerchantsNpcs),
  egg: mapLabel(palworldI18n.ko.mapEggs, palworldI18n.ja.mapEggs),
  lifmunk: mapLabel(
    palworldI18n.ko.mapLifmunkEffigies,
    palworldI18n.ja.mapLifmunkEffigies,
  ),
  "skill-fruit": mapLabel(
    palworldI18n.ko.mapSkillFruits,
    palworldI18n.ja.mapSkillFruits,
  ),
  treasure: mapLabel(palworldI18n.ko.mapTreasures, palworldI18n.ja.mapTreasures),
  journal: mapLabel(palworldI18n.ko.mapJournals, palworldI18n.ja.mapJournals),
  resource: mapLabel(palworldI18n.ko.mapResources, palworldI18n.ja.mapResources),
};
const PALWORLD_MAP_LOCATION_FALLBACKS: Readonly<
  Record<PalworldMapLocationCategory, string>
> = {
  "fast-travel": "◇",
  dungeon: "▣",
  npc: "♙",
  egg: "●",
  lifmunk: "✦",
  "skill-fruit": "◆",
  treasure: "◇",
  journal: "▤",
  resource: "◆",
};
const PALWORLD_MAP_COLLECTIBLE_TYPE_LABELS: Readonly<
  Record<PalworldMapCollectibleTypeId, PalworldMapLocalizedLabel>
> = {
  "statue-lifmunk": mapLabel(
    palworldI18n.ko.mapStatueLifmunk,
    palworldI18n.ja.mapStatueLifmunk,
  ),
  "statue-lamball": mapLabel(
    palworldI18n.ko.mapStatueLamball,
    palworldI18n.ja.mapStatueLamball,
  ),
  "statue-pengullet": mapLabel(
    palworldI18n.ko.mapStatuePengullet,
    palworldI18n.ja.mapStatuePengullet,
  ),
  "statue-munchill": mapLabel(
    palworldI18n.ko.mapStatueMunchill,
    palworldI18n.ja.mapStatueMunchill,
  ),
  "statue-rooby": mapLabel(
    palworldI18n.ko.mapStatueRooby,
    palworldI18n.ja.mapStatueRooby,
  ),
  "statue-herbil": mapLabel(
    palworldI18n.ko.mapStatueHerbil,
    palworldI18n.ja.mapStatueHerbil,
  ),
  "statue-tanzee": mapLabel(
    palworldI18n.ko.mapStatueTanzee,
    palworldI18n.ja.mapStatueTanzee,
  ),
  "statue-depresso": mapLabel(
    palworldI18n.ko.mapStatueDepresso,
    palworldI18n.ja.mapStatueDepresso,
  ),
  "statue-cattiva": mapLabel(
    palworldI18n.ko.mapStatueCattiva,
    palworldI18n.ja.mapStatueCattiva,
  ),
  "statue-lunaris": mapLabel(
    palworldI18n.ko.mapStatueLunaris,
    palworldI18n.ja.mapStatueLunaris,
  ),
  "statue-relaxaurus": mapLabel(
    palworldI18n.ko.mapStatueRelaxaurus,
    palworldI18n.ja.mapStatueRelaxaurus,
  ),
  "statue-yakumo": mapLabel(
    palworldI18n.ko.mapStatueYakumo,
    palworldI18n.ja.mapStatueYakumo,
  ),
  "egg-grass": mapLabel(palworldI18n.ko.mapEggGrass, palworldI18n.ja.mapEggGrass),
  "egg-desert": mapLabel(palworldI18n.ko.mapEggDesert, palworldI18n.ja.mapEggDesert),
  "egg-glacier": mapLabel(
    palworldI18n.ko.mapEggGlacier,
    palworldI18n.ja.mapEggGlacier,
  ),
  "egg-volcanic": mapLabel(
    palworldI18n.ko.mapEggVolcanic,
    palworldI18n.ja.mapEggVolcanic,
  ),
  "egg-sakurajima": mapLabel(
    palworldI18n.ko.mapEggSakurajima,
    palworldI18n.ja.mapEggSakurajima,
  ),
  "egg-sky-island": mapLabel(
    palworldI18n.ko.mapEggSkyIsland,
    palworldI18n.ja.mapEggSkyIsland,
  ),
  "egg-tenraku": mapLabel(
    palworldI18n.ko.mapEggTenraku,
    palworldI18n.ja.mapEggTenraku,
  ),
  "egg-world-tree": mapLabel(
    palworldI18n.ko.mapEggWorldTree,
    palworldI18n.ja.mapEggWorldTree,
  ),
  "resource-night-stone": mapLabel(
    palworldI18n.ko.mapResourceNightStone,
    palworldI18n.ja.mapResourceNightStone,
  ),
  "resource-pal-crystal": mapLabel(
    palworldI18n.ko.mapResourcePalCrystal,
    palworldI18n.ja.mapResourcePalCrystal,
  ),
  "resource-coal": mapLabel(
    palworldI18n.ko.mapResourceCoal,
    palworldI18n.ja.mapResourceCoal,
  ),
  "resource-copper-ore": mapLabel(
    palworldI18n.ko.mapResourceCopperOre,
    palworldI18n.ja.mapResourceCopperOre,
  ),
  "resource-iron-ore": mapLabel(
    palworldI18n.ko.mapResourceIronOre,
    palworldI18n.ja.mapResourceIronOre,
  ),
  "resource-quartz": mapLabel(
    palworldI18n.ko.mapResourceQuartz,
    palworldI18n.ja.mapResourceQuartz,
  ),
  "resource-stone": mapLabel(
    palworldI18n.ko.mapResourceStone,
    palworldI18n.ja.mapResourceStone,
  ),
  "resource-sky-island-ore": mapLabel(
    palworldI18n.ko.mapResourceSkyIslandOre,
    palworldI18n.ja.mapResourceSkyIslandOre,
  ),
  "resource-sulfur": mapLabel(
    palworldI18n.ko.mapResourceSulfur,
    palworldI18n.ja.mapResourceSulfur,
  ),
  "resource-world-tree-ore": mapLabel(
    palworldI18n.ko.mapResourceWorldTreeOre,
    palworldI18n.ja.mapResourceWorldTreeOre,
  ),
};

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
  const activeMapImage = PALWORLD_MAP_IMAGES[mapQuery.world];
  const activeFocusPalId = mapQuery.focusPal ?? focusPalId;
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    activeMapImage ? "loading" : "error",
  );
  const [imageRevision, setImageRevision] = useState(0);
  const [bossRevision, setBossRevision] = useState(0);
  const [spawnRevision, setSpawnRevision] = useState(0);
  const [locationRevision, setLocationRevision] = useState(0);
  const [markerResponse, setMarkerResponse] = useState<PalworldMapMarkersResponse>();
  const [markerState, setMarkerState] = useState<PalworldMapMarkerRequestState>("loading");
  const [spawnResponse, setSpawnResponse] = useState<PalworldPalSpawnResponse>();
  const [spawnState, setSpawnState] = useState<PalworldMapSpawnRequestState>("idle");
  const [mapLocations, setMapLocations] = useState<readonly PalworldMapLocation[]>([]);
  const [locationState, setLocationState] =
    useState<PalworldMapLocationRequestState>("loading");
  const [focusedPal, setFocusedPal] = useState<PalworldPalReference | PalworldPalSummary | null>(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const [mobileLegendOpen, setMobileLegendOpen] = useState(false);
  const [collapsedFilterGroups, setCollapsedFilterGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const mobileFilterButtonRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  const mobileLegendButtonRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
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
  const selectedLocationLayers = useMemo(
    () => PALWORLD_MAP_LOCATION_CATEGORIES.filter(
      (category) => mapQuery.layers.includes(category),
    ),
    [mapQuery.layers],
  );
  const selectedCollectibleTypes = mapQuery.types;
  const visibleSpawnPoints = useMemo(
    () => spawnState === "ready" && spawnResponse
      ? filterPalworldSpawnPointsByPeriod(spawnResponse.points, mapQuery.period)
      : [],
    [mapQuery.period, spawnResponse, spawnState],
  );
  const visibleBossMarkers = useMemo(
    () => markerState === "ready" && markerResponse && bossLayerSelected
      ? activeFocusPalId
        ? filterPalworldBossMarkers(markerResponse.markers, activeFocusPalId)
        : markerResponse.markers
      : [],
    [activeFocusPalId, bossLayerSelected, markerResponse, markerState],
  );
  const selectedMarker = useMemo(
    () => mapQuery.marker
      ? visibleBossMarkers.find((marker) => marker.id === mapQuery.marker)
      : undefined,
    [mapQuery.marker, visibleBossMarkers],
  );
  const locationCounts = useMemo<ReadonlyMap<PalworldMapLocationCategory, number>>(() => {
    const counts = new Map<PalworldMapLocationCategory, number>();
    for (const category of PALWORLD_MAP_LOCATION_CATEGORIES) {
      counts.set(category, 0);
    }
    if (locationState === "ready") {
      for (const location of mapLocations) {
        counts.set(location.category, (counts.get(location.category) ?? 0) + 1);
      }
    }
    return counts;
  }, [locationState, mapLocations]);
  const collectibleTypeCounts = useMemo<
    ReadonlyMap<PalworldMapCollectibleTypeId, number>
  >(() => {
    const counts = new Map<PalworldMapCollectibleTypeId, number>(
      PALWORLD_MAP_COLLECTIBLE_TYPE_IDS.map((typeId) => [typeId, 0]),
    );
    if (locationState === "ready") {
      for (const location of mapLocations) {
        const typeId = palworldMapCollectibleTypeForLocation(location);
        if (typeId) counts.set(typeId, (counts.get(typeId) ?? 0) + 1);
      }
    }
    return counts;
  }, [locationState, mapLocations]);
  const visibleMapLocations = useMemo(
    () => locationState === "ready"
      ? mapLocations.filter((location) => {
          if (!selectedLocationLayers.includes(location.category)) return false;
          const typeId = palworldMapCollectibleTypeForLocation(location);
          if (typeId) return selectedCollectibleTypes.includes(typeId);
          const categoryTypes = palworldMapCollectibleTypesForCategory(
            location.category,
          );
          return categoryTypes.length === 0
            || categoryTypes.every((candidate) =>
              selectedCollectibleTypes.includes(candidate)
            );
        })
      : [],
    [
      locationState,
      mapLocations,
      selectedCollectibleTypes,
      selectedLocationLayers,
    ],
  );
  const selectedMapLocation = useMemo(
    () => mapQuery.marker
      ? visibleMapLocations.find((location) => location.id === mapQuery.marker)
      : undefined,
    [mapQuery.marker, visibleMapLocations],
  );
  const mapLocationLabel = useCallback(
    (location: Pick<PalworldMapLocation, "category" | "subtype">) => {
      const typeId = palworldMapCollectibleTypeForLocation(location);
      return typeId
        ? PALWORLD_MAP_COLLECTIBLE_TYPE_LABELS[typeId]
        : PALWORLD_MAP_LOCATION_LABELS[location.category];
    },
    [],
  );
  const spawnSummary = useMemo(
    () => spawnLayerSelected
      ? summarizePalworldSpawnPoints(visibleSpawnPoints)
      : undefined,
    [spawnLayerSelected, visibleSpawnPoints],
  );
  const localeTag = locale === "ko" ? "ko-KR" : "ja-JP";
  const locationClusterLabel = useCallback(
    (count: number) => text.mapLocationCluster.replace(
      "{count}",
      count.toLocaleString(localeTag),
    ),
    [localeTag, text.mapLocationCluster],
  );
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
  const mapAspectRatio = activeMapImage
    ? `${activeMapImage.width} / ${activeMapImage.height}`
    : "1 / 1";

  useEffect(() => {
    setLoadState(activeMapImage ? "loading" : "error");
    setImageRevision((revision) => revision + 1);
    resetView();
  }, [activeMapImage, mapQuery.world, resetView]);

  useEffect(() => {
    const controller = new AbortController();
    setMarkerState("loading");
    setMarkerResponse(undefined);
    void getPalworldMapMarkers(mapQuery.world, controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      setMarkerResponse(response);
      setMarkerState(response.state);
    }).catch(() => {
      if (!controller.signal.aborted) setMarkerState("error");
    });
    return () => controller.abort();
  }, [bossRevision, mapQuery.world]);

  useEffect(() => {
    const controller = new AbortController();
    setMapLocations([]);
    setLocationState("loading");
    void (async () => {
      const locations: PalworldMapLocation[] = [];
      const ids = new Set<string>();
      let expectedTotal: number | undefined;
      let expectedPageIdentity: string | undefined;
      let offset = 0;
      let pageCount = 0;
      while (true) {
        if (pageCount >= PALWORLD_MAP_LOCATION_MAX_PAGES) {
          throw new Error("지도 위치 pagination이 안전한 최대 페이지 수를 초과했습니다.");
        }
        pageCount += 1;
        const response = await getPalworldMapLocations(
          PALWORLD_MAP_LOCATION_CATEGORIES,
          mapQuery.world,
          controller.signal,
          {
            limit: PALWORLD_MAP_LOCATION_PAGE_LIMIT,
            offset,
          },
        );
        if (controller.signal.aborted) return;
        if (offset === 0 && response.state !== "ready") {
          setLocationState(response.state);
          return;
        }
        const pageIdentity = mapLocationPageIdentity(response);
        const pageTotal = expectedTotal ?? response.total;
        const expectedReturned = Math.min(
          PALWORLD_MAP_LOCATION_PAGE_LIMIT,
          pageTotal - offset,
        );
        if (
          response.state !== "ready"
          || response.world !== mapQuery.world
          || response.layers.length !== PALWORLD_MAP_LOCATION_CATEGORIES.length
          || response.layers.some(
            (layer, index) => layer !== PALWORLD_MAP_LOCATION_CATEGORIES[index],
          )
          || response.offset !== offset
          || response.limit !== PALWORLD_MAP_LOCATION_PAGE_LIMIT
          || response.returned !== expectedReturned
          || (expectedTotal !== undefined && response.total !== expectedTotal)
          || (
            expectedPageIdentity !== undefined
            && pageIdentity !== expectedPageIdentity
          )
        ) {
          throw new Error("지도 위치 pagination 응답이 서로 일치하지 않습니다.");
        }
        expectedTotal ??= response.total;
        expectedPageIdentity ??= pageIdentity;
        for (const location of response.locations) {
          if (ids.has(location.id)) {
            throw new Error("지도 위치 pagination 응답에 중복 ID가 있습니다.");
          }
          ids.add(location.id);
          locations.push(location);
        }
        if (!response.hasMore) break;
        if (response.returned === 0) {
          throw new Error("지도 위치 pagination이 진행되지 않았습니다.");
        }
        offset += response.returned;
      }
      if (controller.signal.aborted) return;
      if (locations.length !== expectedTotal) {
        throw new Error("지도 위치 pagination 전체 수가 일치하지 않습니다.");
      }
      setMapLocations(locations);
      setLocationState(locations.length > 0 ? "ready" : "confirmed_empty");
    })().catch(() => {
      if (!controller.signal.aborted) setLocationState("error");
    });
    return () => controller.abort();
  }, [locationRevision, mapQuery.world]);

  useEffect(() => {
    if (!activeFocusPalId) {
      setSpawnResponse(undefined);
      setSpawnState("idle");
      return;
    }
    const controller = new AbortController();
    setSpawnResponse(undefined);
    setSpawnState("loading");
    void getPalworldPalSpawns(
      activeFocusPalId,
      mapQuery.world,
      controller.signal,
    ).then((response) => {
      if (controller.signal.aborted) return;
      setSpawnResponse(response);
      setSpawnState(response.state);
    }).catch(() => {
      if (!controller.signal.aborted) setSpawnState("error");
    });
    return () => controller.abort();
  }, [activeFocusPalId, mapQuery.world, spawnRevision]);

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
    if (
      loadState !== "ready"
      || !selectedMapLocation
      || mapQuery.center
    ) {
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextView = focusPalworldMapViewAt(
      selectedMapLocation,
      viewport.clientWidth,
      viewport.clientHeight,
      Math.max(2, mapQuery.zoom),
    );
    commitView(nextView);
    replaceQuery({
      center: {
        x: selectedMapLocation.normalizedX,
        y: selectedMapLocation.normalizedY,
      },
      zoom: nextView.zoom,
    });
  }, [
    commitView,
    loadState,
    mapQuery.center,
    mapQuery.zoom,
    replaceQuery,
    selectedMapLocation,
    viewportRef,
  ]);

  useEffect(() => {
    if (loadState !== "ready") return;
    const timer = window.setTimeout(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      if (
        (!mapQuery.center && activeFocusPalId && !appliedFocusMarkerRef.current)
        || (
          !mapQuery.center
          && mapQuery.marker
          && !selectedMarker
          && !selectedMapLocation
        )
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
    selectedMapLocation,
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
      && (locationState === "ready" || locationState === "confirmed_empty")
      && !visibleBossMarkers.some((marker) => marker.id === mapQuery.marker)
      && !visibleMapLocations.some((location) => location.id === mapQuery.marker)
    ) {
      replaceQuery({ marker: null });
    }
  }, [
    locationState,
    mapQuery.marker,
    markerState,
    replaceQuery,
    visibleBossMarkers,
    visibleMapLocations,
  ]);

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

  const selectMapLocation = useCallback((
    location: PalworldMapLocation,
    trigger?: HTMLElement,
  ): void => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (trigger) {
      selectedMarkerTriggerRef.current = trigger;
    } else if (mapQuery.marker !== location.id) {
      selectedMarkerTriggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    const nextView = focusPalworldMapViewAt(
      location,
      viewport.clientWidth,
      viewport.clientHeight,
      Math.max(2, viewRef.current.zoom),
    );
    commitView(nextView);
    pushQuery({
      center: { x: location.normalizedX, y: location.normalizedY },
      marker: location.id,
      zoom: nextView.zoom,
    });
  }, [commitView, mapQuery.marker, pushQuery, viewRef, viewportRef]);

  const focusMapLocationCluster = useCallback((
    cluster: Pick<PalworldMapLocation, "normalizedX" | "normalizedY">,
  ): void => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextView = focusPalworldMapViewAt(
      cluster,
      viewport.clientWidth,
      viewport.clientHeight,
      Math.min(PALWORLD_MAP_MAX_ZOOM, Math.max(2, viewRef.current.zoom + 0.75)),
    );
    commitView(nextView);
    pushQuery({
      center: { x: cluster.normalizedX, y: cluster.normalizedY },
      marker: null,
      zoom: nextView.zoom,
    });
    window.requestAnimationFrame(() => {
      viewport.focus({ preventScroll: true });
    });
  }, [commitView, pushQuery, viewRef, viewportRef]);

  useEffect(() => {
    if (!selectedMarker && !selectedMapLocation) return undefined;

    const handleOutsidePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(`#${PALWORLD_MAP_MARKER_POPOVER_ID}`)
        || target.closest(".palworld-map-boss-marker")
        || target.closest(".palworld-map-location-marker")
        || target.closest(".yoro-modal")
      ) {
        return;
      }
      selectedMarkerTriggerRef.current = null;
      replaceQuery({ marker: null });
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [replaceQuery, selectedMapLocation, selectedMarker]);

  const changeLayer = useCallback((
    layer: PalworldMapExplorerLayerId,
    selected: boolean,
  ): void => {
    if (isPalworldMapCollectibleTypeId(layer)) {
      const category = palworldMapCollectibleCategory(layer);
      const categoryTypes = palworldMapCollectibleTypesForCategory(category);
      const nextTypes = new Set(mapQuery.types);
      if (!mapQuery.layers.includes(category)) {
        for (const typeId of categoryTypes) nextTypes.delete(typeId);
      }
      if (selected) nextTypes.add(layer);
      else nextTypes.delete(layer);
      const hasSelectedType = categoryTypes.some((typeId) =>
        nextTypes.has(typeId)
      );
      const nextLayers = new Set(mapQuery.layers);
      if (hasSelectedType) nextLayers.add(category);
      else nextLayers.delete(category);
      pushQuery({
        layers: PALWORLD_MAP_LAYERS.filter((entry) => nextLayers.has(entry)),
        types: PALWORLD_MAP_COLLECTIBLE_TYPE_IDS.filter((typeId) =>
          nextTypes.has(typeId)
        ),
        ...(!selected && selectedMapLocation ? { marker: null } : {}),
      });
      return;
    }
    if (!isRuntimeMapLayer(layer)) return;
    const next = selected
      ? [...mapQuery.layers, layer]
      : mapQuery.layers.filter((entry) => entry !== layer);
    const selectedLayer = selectedMarker
      ? "boss"
      : selectedMapLocation?.category;
    pushQuery({
      layers: next,
      ...(!selected && selectedLayer === layer ? { marker: null } : {}),
    });
  }, [
    mapQuery.layers,
    mapQuery.types,
    pushQuery,
    selectedMapLocation,
    selectedMarker,
  ]);

  const changeGroupLayers = useCallback((
    layerIds: readonly PalworldMapExplorerLayerId[],
    selected: boolean,
  ): void => {
    const runtimeLayerIds = layerIds.filter(isRuntimeMapLayer);
    const collectibleTypeIds = layerIds.filter(isPalworldMapCollectibleTypeId);
    const nextTypes = new Set(mapQuery.types);
    const nextLayers = new Set(
      updatePalworldMapLayerSelection(mapQuery.layers, runtimeLayerIds, selected),
    );
    for (const typeId of collectibleTypeIds) {
      if (selected) nextTypes.add(typeId);
      else nextTypes.delete(typeId);
    }
    for (const category of ["egg", "lifmunk", "resource"] as const) {
      const categoryTypes = palworldMapCollectibleTypesForCategory(category);
      if (!collectibleTypeIds.some((typeId) =>
        palworldMapCollectibleCategory(typeId) === category
      )) {
        continue;
      }
      if (categoryTypes.some((typeId) => nextTypes.has(typeId))) {
        nextLayers.add(category);
      } else {
        nextLayers.delete(category);
      }
    }
    const selectedLayer = selectedMarker
      ? "boss"
      : selectedMapLocation?.category;
    pushQuery({
      layers: PALWORLD_MAP_LAYERS.filter((layerId) => nextLayers.has(layerId)),
      types: PALWORLD_MAP_COLLECTIBLE_TYPE_IDS.filter((typeId) =>
        nextTypes.has(typeId)
      ),
      ...(
        !selected
        && selectedLayer
        && (
          runtimeLayerIds.includes(selectedLayer)
          || collectibleTypeIds.some((typeId) =>
            palworldMapCollectibleCategory(typeId) === selectedLayer
          )
        )
          ? { marker: null }
          : {}
      ),
    });
  }, [
    mapQuery.layers,
    mapQuery.types,
    pushQuery,
    selectedMapLocation,
    selectedMarker,
  ]);

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
      types: PALWORLD_MAP_COLLECTIBLE_TYPE_IDS,
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
    const focusedSpawnIcon =
      focusedPal?.imageUrl
      && isLocalPalworldImageUrl(focusedPal.imageUrl, "pal")
      && Number.isInteger(focusedPal.imageWidth)
      && Number(focusedPal.imageWidth) > 0
      && Number.isInteger(focusedPal.imageHeight)
      && Number(focusedPal.imageHeight) > 0
        ? {
            imageUrl: focusedPal.imageUrl,
            width: Number(focusedPal.imageWidth),
            height: Number(focusedPal.imageHeight),
          }
        : PALWORLD_MAP_LAYER_ICONS.spawn;
    const importedLocationState = layerDisplayState(locationState);
    const locationLayer = (
      id: PalworldMapLocationCategory,
    ): PalworldMapLayerGroup["layers"][number] => ({
      id,
      label: PALWORLD_MAP_LOCATION_LABELS[id],
      statusLabel: layerStatusLabel(importedLocationState),
      count: importedLocationState === "ready" ? locationCounts.get(id) : undefined,
      iconAsset: PALWORLD_MAP_LAYER_ICONS[id],
      iconFallback: PALWORLD_MAP_LOCATION_FALLBACKS[id],
      selected: mapQuery.layers.includes(id),
      state: importedLocationState,
    });
    const collectibleTypeLayer = (
      id: PalworldMapCollectibleTypeId,
    ): PalworldMapLayerGroup["layers"][number] => {
      const category = palworldMapCollectibleCategory(id);
      return {
        id,
        label: PALWORLD_MAP_COLLECTIBLE_TYPE_LABELS[id],
        statusLabel: layerStatusLabel(importedLocationState),
        count: importedLocationState === "ready"
          ? collectibleTypeCounts.get(id)
          : undefined,
        iconAsset: PALWORLD_MAP_LAYER_ICONS[id],
        iconFallback: category === "egg" ? "●" : category === "resource" ? "◆" : "✦",
        selected: mapQuery.layers.includes(category)
          && mapQuery.types.includes(id),
        state: importedLocationState,
      };
    };
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
        iconAsset: PALWORLD_MAP_LAYER_ICONS.boss,
        iconFallback: "◆",
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
        iconAsset: focusedSpawnIcon,
        iconFallback: "●",
        selected: spawnLayerSelected,
        state: spawnDisplayState,
      }],
    }, {
      id: "places",
      label: mapLabel(palworldI18n.ko.mapPlaceLayers, palworldI18n.ja.mapPlaceLayers),
      collapsed: collapsedFilterGroups.has("places"),
      layers: [
        locationLayer("fast-travel"),
        locationLayer("dungeon"),
        locationLayer("npc"),
      ],
    }, {
      id: "statues",
      label: mapLabel(
        palworldI18n.ko.mapStatueLayers,
        palworldI18n.ja.mapStatueLayers,
      ),
      collapsed: collapsedFilterGroups.has("statues"),
      layers: PALWORLD_MAP_STATUE_TYPE_IDS.map(collectibleTypeLayer),
    }, {
      id: "eggs",
      label: mapLabel(
        palworldI18n.ko.mapEggLayers,
        palworldI18n.ja.mapEggLayers,
      ),
      collapsed: collapsedFilterGroups.has("eggs"),
      layers: PALWORLD_MAP_EGG_TYPE_IDS.map(collectibleTypeLayer),
    }, {
      id: "resources",
      label: mapLabel(
        palworldI18n.ko.mapResourceLayers,
        palworldI18n.ja.mapResourceLayers,
      ),
      collapsed: collapsedFilterGroups.has("resources"),
      layers: PALWORLD_MAP_RESOURCE_TYPE_IDS.map(collectibleTypeLayer),
    }, {
      id: "collectibles",
      label: mapLabel(
        palworldI18n.ko.mapOtherCollectibleLayers,
        palworldI18n.ja.mapOtherCollectibleLayers,
      ),
      collapsed: collapsedFilterGroups.has("collectibles"),
      layers: [
        locationLayer("skill-fruit"),
        locationLayer("treasure"),
        locationLayer("journal"),
        {
        id: "ancient-ruin",
        label: mapLabel(palworldI18n.ko.mapAncientRuins, palworldI18n.ja.mapAncientRuins),
        description: unavailableDescription,
        statusLabel: unavailableStatus,
        iconAsset: PALWORLD_MAP_LAYER_ICONS["ancient-ruin"],
        iconFallback: "⌂",
        selected: false,
        state: "data_unavailable",
      }],
    }];
  }, [
    activeFocusPalId,
    bossLayerSelected,
    collapsedFilterGroups,
    collectibleTypeCounts,
    focusedPal,
    layerStatusLabel,
    locationCounts,
    locationState,
    mapQuery.layers,
    mapQuery.types,
    markerResponse,
    markerState,
    spawnLayerSelected,
    spawnResponse,
    spawnState,
  ]);

  const importedLayerSelected = selectedLocationLayers.length > 0;
  const filterCopy = {
    all: mapLabel(palworldI18n.ko.mapFilterAll, palworldI18n.ja.mapFilterAll),
    hide: mapLabel(palworldI18n.ko.mapFilterHide, palworldI18n.ja.mapFilterHide),
    reset: mapLabel(palworldI18n.ko.mapFilterReset, palworldI18n.ja.mapFilterReset),
    show: mapLabel(palworldI18n.ko.mapFilterShow, palworldI18n.ja.mapFilterShow),
    title: mapLabel(palworldI18n.ko.mapFilters, palworldI18n.ja.mapFilters),
  };
  const activeLayerCount = Number(bossLayerSelected)
    + Number(spawnLayerSelected)
    + selectedLocationLayers.filter((category) =>
      category !== "egg" && category !== "lifmunk" && category !== "resource"
    ).length
    + selectedCollectibleTypes.filter((typeId) =>
      mapQuery.layers.includes(palworldMapCollectibleCategory(typeId))
    ).length;
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
  const locationPopover = selectedMapLocation ? (
    <PalworldMapMarkerPopover
      actions={[{
        id: "center",
        label: mapLabel(palworldI18n.ko.mapCenterMarker, palworldI18n.ja.mapCenterMarker),
        onClick: () => selectMapLocation(selectedMapLocation),
      }, {
        id: "copy",
        label: mapLabel(palworldI18n.ko.mapCopyLink, palworldI18n.ja.mapCopyLink),
        onClick: () => void copyMapLink(),
        variant: "primary",
      }]}
      closeLabel={mapLabel(palworldI18n.ko.mapCloseMarker, palworldI18n.ja.mapCloseMarker)}
      description={mapLabel(
        palworldI18n.ko.mapImportedLocationDescription,
        palworldI18n.ja.mapImportedLocationDescription,
      )}
      details={[{
        label: mapLabel(palworldI18n.ko.mapNormalizedPosition, palworldI18n.ja.mapNormalizedPosition),
        value: `${(selectedMapLocation.normalizedX * 100).toFixed(1)}% · ${(selectedMapLocation.normalizedY * 100).toFixed(1)}%`,
      }]}
      id={PALWORLD_MAP_MARKER_POPOVER_ID}
      kindLabel={mapLabel(palworldI18n.ko.mapLocationPoint, palworldI18n.ja.mapLocationPoint)}
      locale={locale}
      onClose={closeMarkerPopover}
      title={mapLocationLabel(selectedMapLocation)}
    />
  ) : null;
  const legendAvailable =
    spawnLayerSelected
    || visibleBossMarkers.length > 0
    || visibleMapLocations.length > 0;

  function renderLegendContent() {
    return (
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
        {selectedLocationLayers
          .filter((category) =>
            category !== "egg"
            && category !== "lifmunk"
            && category !== "resource"
          )
          .map((category) => {
            const count = locationCounts.get(category) ?? 0;
            if (count === 0) return null;
            return (
              <li key={category}>
                <PalworldMapLocationIcon
                  asset={PALWORLD_MAP_LAYER_ICONS[category]}
                  className="palworld-map-legend-location-icon"
                  fallbackSymbol={PALWORLD_MAP_LOCATION_FALLBACKS[category]}
                />
                <span>
                  <strong>{PALWORLD_MAP_LOCATION_LABELS[category][locale]}</strong>
                  <small>{count.toLocaleString(localeTag)}</small>
                </span>
              </li>
            );
          })}
        {selectedCollectibleTypes.map((typeId) => {
          const category = palworldMapCollectibleCategory(typeId);
          if (!mapQuery.layers.includes(category)) return null;
          const count = collectibleTypeCounts.get(typeId) ?? 0;
          if (count === 0) return null;
          return (
            <li key={typeId}>
              <PalworldMapLocationIcon
                asset={PALWORLD_MAP_LAYER_ICONS[typeId]}
                className="palworld-map-legend-location-icon"
                fallbackSymbol={category === "egg" ? "●" : category === "resource" ? "◆" : "✦"}
              />
              <span>
                <strong>{PALWORLD_MAP_COLLECTIBLE_TYPE_LABELS[typeId][locale]}</strong>
                <small>{count.toLocaleString(localeTag)}</small>
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="palworld-page-section palworld-map-page" aria-labelledby="palworld-map-title">
      <h1
        className="yoro-u-sr-only"
        data-ja={palworldI18n.ja.mapTitle}
        data-ko={palworldI18n.ko.mapTitle}
        id="palworld-map-title"
      >
        {text.mapTitle}
      </h1>

      <div
        className="palworld-map-workspace"
        data-filter-collapsed={filtersCollapsed ? "true" : undefined}
      >
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
        <PalworldMapLegendSheet
          closeLabel={mapLabel(palworldI18n.ko.close, palworldI18n.ja.close)}
          locale={locale}
          onClose={() => setMobileLegendOpen(false)}
          open={mobileLegendOpen}
          returnFocusRef={mobileLegendButtonRef}
          title={mapLabel(palworldI18n.ko.mapLayerLegend, palworldI18n.ja.mapLayerLegend)}
        >
          {renderLegendContent()}
        </PalworldMapLegendSheet>

        <div className="palworld-map-explorer-main">
          <div className="palworld-map-mobile-command-bar">
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
            {legendAvailable ? (
              <Button
                aria-expanded={mobileLegendOpen}
                aria-haspopup="dialog"
                data-ja={palworldI18n.ja.mapLayerLegend}
                data-ko={palworldI18n.ko.mapLayerLegend}
                onClick={() => setMobileLegendOpen(true)}
                ref={mobileLegendButtonRef}
                size="sm"
                variant="secondary"
              >
                {text.mapLayerLegend}
              </Button>
            ) : null}
            {focusedPal ? (
              <Badge tone="info">{resolvePalworldName(focusedPal, locale).text}</Badge>
            ) : null}
          </div>
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
                {importedLayerSelected && locationState === "loading" ? (
                  <Badge role="status" tone="neutral">{text.mapImportedLocationsLoading}</Badge>
                ) : null}
                {importedLayerSelected && locationState === "ready" ? (
                  <Badge tone="info">
                    {text.mapLocationPoint} {visibleMapLocations.length.toLocaleString(localeTag)}
                  </Badge>
                ) : null}
                {importedLayerSelected && locationState === "data_unavailable" ? (
                  <Badge tone="neutral">{text.mapImportedLocationsUnavailable}</Badge>
                ) : null}
                {importedLayerSelected && locationState === "error" ? (
                  <span className="palworld-map-marker-error" role="alert">
                    <Badge tone="warning">{text.mapImportedLocationsError}</Badge>
                    <Button
                      onClick={() => setLocationRevision((revision) => revision + 1)}
                      size="sm"
                      variant="ghost"
                    >
                      {text.mapImportedLocationsRetry}
                    </Button>
                  </span>
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
                <button
                  aria-selected={mapQuery.world === "main"}
                  onClick={() => {
                    if (mapQuery.world === "main") return;
                    pushQuery({
                      center: null,
                      marker: null,
                      world: "main",
                      zoom: PALWORLD_MAP_MIN_ZOOM,
                    });
                  }}
                  role="tab"
                  type="button"
                >
                  {text.mapMainWorld}
                </button>
                <button
                  aria-selected={mapQuery.world === "tree"}
                  onClick={() => {
                    if (mapQuery.world === "tree" || !PALWORLD_MAP_IMAGES.tree) return;
                    pushQuery({
                      center: null,
                      marker: null,
                      world: "tree",
                      zoom: PALWORLD_MAP_MIN_ZOOM,
                    });
                  }}
                  role="tab"
                  type="button"
                >
                  {text.mapTreeWorld}
                </button>
              </div>
            </div>

            {legendAvailable ? (
              <PalworldMapLegend
                expanded={legendExpanded}
                locale={locale}
                onExpandedChange={setLegendExpanded}
                title={mapLabel(palworldI18n.ko.mapLayerLegend, palworldI18n.ja.mapLayerLegend)}
              >
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
                  {selectedLocationLayers
                    .filter((category) =>
                      category !== "egg"
                      && category !== "lifmunk"
                      && category !== "resource"
                    )
                    .map((category) => {
                    const count = locationCounts.get(category) ?? 0;
                    if (count === 0) return null;
                    return (
                      <li key={category}>
                        <PalworldMapLocationIcon
                          asset={PALWORLD_MAP_LAYER_ICONS[category]}
                          className="palworld-map-legend-location-icon"
                          fallbackSymbol={PALWORLD_MAP_LOCATION_FALLBACKS[category]}
                        />
                        <span>
                          <strong>{PALWORLD_MAP_LOCATION_LABELS[category][locale]}</strong>
                          <small>{count.toLocaleString(localeTag)}</small>
                        </span>
                      </li>
                    );
                  })}
                  {selectedCollectibleTypes.map((typeId) => {
                    const category = palworldMapCollectibleCategory(typeId);
                    if (!mapQuery.layers.includes(category)) return null;
                    const count = collectibleTypeCounts.get(typeId) ?? 0;
                    if (count === 0) return null;
                    return (
                      <li key={typeId}>
                        <PalworldMapLocationIcon
                          asset={PALWORLD_MAP_LAYER_ICONS[typeId]}
                          className="palworld-map-legend-location-icon"
                          fallbackSymbol={category === "egg" ? "●" : category === "resource" ? "◆" : "✦"}
                        />
                        <span>
                          <strong>
                            {PALWORLD_MAP_COLLECTIBLE_TYPE_LABELS[typeId][locale]}
                          </strong>
                          <small>{count.toLocaleString(localeTag)}</small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </PalworldMapLegend>
            ) : null}

            <div className="palworld-map-canvas-shell">
              <figure className="palworld-map-figure">
                <div
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
                    if (selectedMarker || selectedMapLocation) closeMarkerPopover();
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
                {loadState === "error" || !activeMapImage ? (
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
                      height={activeMapImage.height}
                      key={`${mapQuery.world}-${imageRevision}`}
                      onError={() => setLoadState("error")}
                      onLoad={() => setLoadState("ready")}
                      src={activeMapImage.imageUrl}
                      width={activeMapImage.width}
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
                    {loadState === "ready" && visibleMapLocations.length ? (
                      <div
                        className="palworld-map-marker-layer"
                        data-testid="palworld-map-imported-locations"
                      >
                        <PalworldMapLocationLayer
                          clusterLabel={locationClusterLabel}
                          iconAssets={PALWORLD_MAP_LAYER_ICONS}
                          labels={PALWORLD_MAP_LOCATION_LABELS}
                          locale={locale}
                          locations={visibleMapLocations}
                          subtypeLabels={PALWORLD_MAP_COLLECTIBLE_TYPE_LABELS}
                          onSelectCluster={focusMapLocationCluster}
                          onSelectLocation={selectMapLocation}
                          popoverId={PALWORLD_MAP_MARKER_POPOVER_ID}
                          selectedLocationId={selectedMapLocation?.id}
                          zoom={view.zoom}
                        />
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
                    className="palworld-map-control is-zoom-out"
                    disabled={view.zoom <= PALWORLD_MAP_MIN_ZOOM + PALWORLD_MAP_ZOOM_EPSILON}
                    onClick={() => zoomAt(viewRef.current.zoom - PALWORLD_MAP_ZOOM_STEP)}
                    size="sm"
                    variant="secondary"
                  >
                    −
                  </Button>
                  <output
                    aria-live="polite"
                    aria-label={`${text.mapZoomLevel} ${zoomPercent}%`}
                    className="palworld-map-zoom-output"
                  >
                    {zoomPercent}%
                  </output>
                  <Button
                    aria-label={text.mapZoomIn}
                    className="palworld-map-control is-zoom-in"
                    disabled={view.zoom >= PALWORLD_MAP_MAX_ZOOM - PALWORLD_MAP_ZOOM_EPSILON}
                    onClick={() => zoomAt(viewRef.current.zoom + PALWORLD_MAP_ZOOM_STEP)}
                    size="sm"
                    variant="secondary"
                  >
                    +
                  </Button>
                  <Button
                    className="palworld-map-control is-zoom-reset"
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
              </figure>
              {markerPopover ?? locationPopover}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
