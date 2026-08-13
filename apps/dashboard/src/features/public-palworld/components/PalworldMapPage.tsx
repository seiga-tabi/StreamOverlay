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
  type PalworldMapWorld,
} from "../hooks/usePalworldMapQueryState";
import {
  clampPalworldMapView,
  focusPalworldMapViewAt,
  PALWORLD_MAP_MAX_ZOOM,
  PALWORLD_MAP_MIN_ZOOM,
  PALWORLD_MAP_ZOOM_EPSILON,
  PALWORLD_MAP_ZOOM_STEP,
  palworldMapCenterFromView,
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
  PALWORLD_MAP_ENEMY_TYPE_IDS,
  PALWORLD_MAP_EGG_TYPE_IDS,
  PALWORLD_MAP_LOCATION_TYPE_IDS,
  PALWORLD_MAP_NPC_TYPE_IDS,
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
import { palworldMapToWorldCoordinate } from "../utils/map-coordinates";
import {
  type PalworldMapExplorerLayerId,
  type PalworldMapLayerDisplayState,
  type PalworldMapLayerGroup,
  type PalworldMapLocalizedLabel,
} from "./PalworldMapExplorerTypes";
import { PalworldMapFilterPanel } from "./PalworldMapFilterPanel";
import { PalworldMapLocationLayer } from "./PalworldMapLocationLayer";
import { PalworldMapMarkerPopover } from "./PalworldMapMarkerPopover";
import { PalworldMapMobileFilters, type PalworldMapSheetSnap } from "./PalworldMapMobileFilters";
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

/**
 * 캐시에 실제로 받은 카테고리만 집계합니다.
 *
 * 엔트리가 없는 카테고리·타입은 "아직 모름"이라 count 를 내지 않습니다 —
 * 0 은 서버가 비었다고 확인해 준 경우에만 씁니다. 로드된 카테고리에 속한
 * 타입은 0 으로 초기화해 "확인된 비어 있음"이 구분되게 합니다.
 */
function summarizePalworldLocationCache(
  layers: ReadonlyMap<PalworldMapLocationCategory, readonly PalworldMapLocation[]>,
): {
  categories: ReadonlyMap<PalworldMapLocationCategory, number>;
  types: ReadonlyMap<PalworldMapCollectibleTypeId, number>;
} {
  const categories = new Map<PalworldMapLocationCategory, number>();
  const types = new Map<PalworldMapCollectibleTypeId, number>();
  for (const [category, locations] of layers) {
    categories.set(category, locations.length);
    for (const typeId of palworldMapCollectibleTypesForCategory(category)) {
      types.set(typeId, types.get(typeId) ?? 0);
    }
    for (const location of locations) {
      const typeId = palworldMapCollectibleTypeForLocation(location);
      if (typeId) types.set(typeId, (types.get(typeId) ?? 0) + 1);
    }
  }
  return { categories, types };
}

/**
 * 요청한 카테고리들의 위치를 페이지네이션으로 끝까지 받습니다.
 *
 * 페이지 사이에 데이터가 바뀌면(총계·식별자 불일치) 절반짜리 목록을 그리지 않도록
 * 통째로 실패시킵니다 — 예전 전체 로드가 하던 검증을 그대로 유지합니다.
 */
async function fetchPalworldMapLocationCategories(
  categories: readonly PalworldMapLocationCategory[],
  world: PalworldMapWorld,
  signal: AbortSignal,
): Promise<
  | { state: "ready"; byCategory: Map<PalworldMapLocationCategory, PalworldMapLocation[]> }
  | { state: Exclude<PalworldMapLocationRequestState, "ready" | "loading"> }
> {
  /* 서버는 카테고리를 정의 순서로 돌려주므로 요청도 같은 순서로 보냅니다. */
  const ordered = PALWORLD_MAP_LOCATION_CATEGORIES.filter(
    (category) => categories.includes(category),
  );
  const byCategory = new Map<PalworldMapLocationCategory, PalworldMapLocation[]>();
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
    const response = await getPalworldMapLocations(ordered, world, signal, {
      limit: PALWORLD_MAP_LOCATION_PAGE_LIMIT,
      offset,
    });
    if (signal.aborted) return { state: "error" };
    if (offset === 0 && response.state !== "ready") {
      return { state: response.state };
    }
    const pageIdentity = mapLocationPageIdentity(response);
    const pageTotal = expectedTotal ?? response.total;
    const expectedReturned = Math.min(
      PALWORLD_MAP_LOCATION_PAGE_LIMIT,
      pageTotal - offset,
    );
    if (
      response.state !== "ready"
      || response.world !== world
      || response.layers.length !== ordered.length
      || response.layers.some((layer, index) => layer !== ordered[index])
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
      const bucket = byCategory.get(location.category) ?? [];
      bucket.push(location);
      byCategory.set(location.category, bucket);
    }
    if (!response.hasMore) break;
    if (response.returned === 0) {
      throw new Error("지도 위치 pagination이 진행되지 않았습니다.");
    }
    offset += response.returned;
  }
  let received = 0;
  for (const bucket of byCategory.values()) received += bucket.length;
  if (received !== (expectedTotal ?? 0)) {
    throw new Error("지도 위치 pagination 전체 수가 일치하지 않습니다.");
  }
  return { state: "ready", byCategory };
}

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
  enemy: mapLabel(palworldI18n.ko.mapEnemyLayers, palworldI18n.ja.mapEnemyLayers),
  location: mapLabel(
    palworldI18n.ko.mapLocationLayers,
    palworldI18n.ja.mapLocationLayers,
  ),
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
  enemy: "⚔",
  location: "⌖",
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
  "resource-ancient-beast-bone": mapLabel(
    palworldI18n.ko.mapResourceAncientBeastBone,
    palworldI18n.ja.mapResourceAncientBeastBone,
  ),
  "resource-ancient-dragon-fragment": mapLabel(
    palworldI18n.ko.mapResourceAncientDragonFragment,
    palworldI18n.ja.mapResourceAncientDragonFragment,
  ),
  "resource-ancient-tree-bark": mapLabel(
    palworldI18n.ko.mapResourceAncientTreeBark,
    palworldI18n.ja.mapResourceAncientTreeBark,
  ),
  "resource-pal-crystal": mapLabel(
    palworldI18n.ko.mapResourcePalCrystal,
    palworldI18n.ja.mapResourcePalCrystal,
  ),
  "resource-coal": mapLabel(
    palworldI18n.ko.mapResourceCoal,
    palworldI18n.ja.mapResourceCoal,
  ),
  "resource-chromite": mapLabel(
    palworldI18n.ko.mapResourceChromite,
    palworldI18n.ja.mapResourceChromite,
  ),
  "resource-hexolite-quartz": mapLabel(
    palworldI18n.ko.mapResourceHexoliteQuartz,
    palworldI18n.ja.mapResourceHexoliteQuartz,
  ),
  "resource-copper-ore": mapLabel(
    palworldI18n.ko.mapResourceCopperOre,
    palworldI18n.ja.mapResourceCopperOre,
  ),
  "resource-manganese-ore": mapLabel(
    palworldI18n.ko.mapResourceManganeseOre,
    palworldI18n.ja.mapResourceManganeseOre,
  ),
  "resource-quartz": mapLabel(
    palworldI18n.ko.mapResourceQuartz,
    palworldI18n.ja.mapResourceQuartz,
  ),
  "resource-quartz-cluster": mapLabel(
    palworldI18n.ko.mapResourceQuartzCluster,
    palworldI18n.ja.mapResourceQuartzCluster,
  ),
  "resource-stone": mapLabel(
    palworldI18n.ko.mapResourceStone,
    palworldI18n.ja.mapResourceStone,
  ),
  "resource-solarlite": mapLabel(
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
  "npc-wandering-merchant": mapLabel(
    palworldI18n.ko.mapNpcWanderingMerchant,
    palworldI18n.ja.mapNpcWanderingMerchant,
  ),
  "npc-dark-trader": mapLabel(
    palworldI18n.ko.mapNpcDarkTrader,
    palworldI18n.ja.mapNpcDarkTrader,
  ),
  "npc-medal-trader": mapLabel(
    palworldI18n.ko.mapNpcMedalTrader,
    palworldI18n.ja.mapNpcMedalTrader,
  ),
  "enemy-boss-tower": mapLabel(
    palworldI18n.ko.mapEnemyBossTower,
    palworldI18n.ja.mapEnemyBossTower,
  ),
  "enemy-camp": mapLabel(
    palworldI18n.ko.mapEnemyCamp,
    palworldI18n.ja.mapEnemyCamp,
  ),
  "enemy-incident": mapLabel(
    palworldI18n.ko.mapEnemyIncident,
    palworldI18n.ja.mapEnemyIncident,
  ),
  "location-respawn": mapLabel(
    palworldI18n.ko.mapLocationRespawn,
    palworldI18n.ja.mapLocationRespawn,
  ),
  "location-warp-altar": mapLabel(
    palworldI18n.ko.mapLocationWarpAltar,
    palworldI18n.ja.mapLocationWarpAltar,
  ),
  "location-home": mapLabel(
    palworldI18n.ko.mapLocationHome,
    palworldI18n.ja.mapLocationHome,
  ),
  "location-observation-tower": mapLabel(
    palworldI18n.ko.mapLocationObservationTower,
    palworldI18n.ja.mapLocationObservationTower,
  ),
  "location-region-name": mapLabel(
    palworldI18n.ko.mapLocationRegionName,
    palworldI18n.ja.mapLocationRegionName,
  ),
  "location-treasure-map": mapLabel(
    palworldI18n.ko.mapLocationTreasureMap,
    palworldI18n.ja.mapLocationTreasureMap,
  ),
  "location-ancient-ruin": mapLabel(
    palworldI18n.ko.mapAncientRuins,
    palworldI18n.ja.mapAncientRuins,
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
  /* 카테고리별 위치 캐시. world 나 재시도(revision)가 바뀌면 통째로 버립니다. */
  const locationCacheRef = useRef<{
    world: PalworldMapWorld;
    revision: number;
    unavailable: boolean;
    layers: Map<PalworldMapLocationCategory, readonly PalworldMapLocation[]>;
  }>({ world: "main", revision: 0, unavailable: false, layers: new Map() });
  const [markerResponse, setMarkerResponse] = useState<PalworldMapMarkersResponse>();
  const [markerState, setMarkerState] = useState<PalworldMapMarkerRequestState>("loading");
  const [spawnResponse, setSpawnResponse] = useState<PalworldPalSpawnResponse>();
  const [spawnState, setSpawnState] = useState<PalworldMapSpawnRequestState>("idle");
  const [mapLocations, setMapLocations] = useState<readonly PalworldMapLocation[]>([]);
  const [locationState, setLocationState] =
    useState<PalworldMapLocationRequestState>("loading");
  const [focusedPal, setFocusedPal] = useState<PalworldPalReference | PalworldPalSummary | null>(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  /* 64행 중 49행이 "위치 없음"이었습니다. 기본은 켤 수 있는 항목만 보여 줍니다. */
  const [filtersAvailableOnly, setFiltersAvailableOnly] = useState(true);
  /* 좁은 화면 시트의 자리. peek=손잡이만 · half=칩 줄 · full=전체 목록. */
  const [mobileSheetSnap, setMobileSheetSnap] = useState<PalworldMapSheetSnap>("peek");
  const [collapsedFilterGroups, setCollapsedFilterGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const selectedMarkerTriggerRef = useRef<HTMLElement | null>(null);
  const restoredViewKeyRef = useRef<string>();
  const appliedFocusMarkerRef = useRef<string>();
  const {
    commitView,
    endPointer,
    handleKeyDown,
    handleClickCapture,
    handlePointerDown,
    handlePointerMove,
    isPanning,
    resetView,
    view,
    viewRef,
    viewportRef,
    zoomAt,
  } = usePalworldMapViewport(loadState === "ready", "map", "modifier");
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
  const coordinateTransform = markerState === "ready"
    ? markerResponse?.coordinateTransform
    : undefined;
  const selectedMarker = useMemo(
    () => mapQuery.marker
      ? visibleBossMarkers.find((marker) => marker.id === mapQuery.marker)
      : undefined,
    [mapQuery.marker, visibleBossMarkers],
  );
  /* 카테고리를 골라 받게 되면서 "0 = 확인된 비어 있음"과 "엔트리 없음 = 아직 모름"을
     구분해야 합니다. 모름을 0 으로 보고하면 데이터가 있는 레이어까지 잠급니다.
     캐시는 ref 라 프리페치가 채워도 리렌더가 없으므로 집계를 state 로 둡니다. */
  const [locationCounts, setLocationCounts] =
    useState<ReadonlyMap<PalworldMapLocationCategory, number>>(new Map());
  const [collectibleTypeCounts, setCollectibleTypeCounts] =
    useState<ReadonlyMap<PalworldMapCollectibleTypeId, number>>(new Map());
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
  /* 변형이 없으면 srcSet 을 아예 만들지 않아 기존 동작 그대로입니다. */
  const mapImageSrcSet = useMemo(() => {
    if (!activeMapImage?.variants?.length) return undefined;
    return [
      ...activeMapImage.variants.map(
        (variant) => `${variant.imageUrl} ${variant.width}w`,
      ),
      `${activeMapImage.imageUrl} ${activeMapImage.width}w`,
    ].join(", ");
  }, [activeMapImage]);
  const mapImageSizes = mapImageSrcSet
    ? `${Math.min(Math.ceil(view.zoom * 100), 400)}vw`
    : undefined;

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

  /* 위치는 켜진 레이어만 받습니다.
   *
   * 예전에는 첫 로드에 11개 카테고리 20,786건을 5왕복(gzip 564KB)으로 전부
   * 받았습니다 — 기본 상태에서는 위치 레이어가 하나도 켜져 있지 않은데도요.
   * 지금은 켜진 카테고리 중 캐시에 없는 것만 요청하고, 받은 카테고리는
   * world 가 바뀔 때까지 캐시합니다. 즉시 토글은 idle 프리페치가 맡습니다.
   */
  useEffect(() => {
    const cache = locationCacheRef.current;
    if (cache.world !== mapQuery.world || cache.revision !== locationRevision) {
      cache.world = mapQuery.world;
      cache.revision = locationRevision;
      cache.layers.clear();
      cache.unavailable = false;
      setLocationCounts(new Map());
      setCollectibleTypeCounts(new Map());
    }
    if (cache.unavailable) {
      setLocationState("data_unavailable");
      return;
    }
    const missing = selectedLocationLayers.filter(
      (category) => !cache.layers.has(category),
    );
    if (missing.length === 0) {
      const cached = selectedLocationLayers.flatMap(
        (category) => cache.layers.get(category) ?? [],
      );
      setMapLocations(cached);
      setLocationState(
        selectedLocationLayers.length === 0 || cached.length > 0
          ? "ready"
          : "confirmed_empty",
      );
      return;
    }
    const controller = new AbortController();
    setLocationState("loading");
    void fetchPalworldMapLocationCategories(
      missing,
      mapQuery.world,
      controller.signal,
    ).then((result) => {
      if (controller.signal.aborted) return;
      if (result.state !== "ready") {
        if (result.state === "data_unavailable") cache.unavailable = true;
        setLocationState(result.state);
        return;
      }
      for (const category of missing) {
        cache.layers.set(category, result.byCategory.get(category) ?? []);
      }
      const summary = summarizePalworldLocationCache(cache.layers);
      setLocationCounts(summary.categories);
      setCollectibleTypeCounts(summary.types);
      const merged = selectedLocationLayers.flatMap(
        (category) => cache.layers.get(category) ?? [],
      );
      setMapLocations(merged);
      setLocationState(merged.length > 0 ? "ready" : "confirmed_empty");
    }).catch(() => {
      if (!controller.signal.aborted) setLocationState("error");
    });
    return () => controller.abort();
  }, [locationRevision, mapQuery.world, selectedLocationLayers]);

  /* 나머지 카테고리는 첫 페인트가 끝난 뒤 한가할 때 조용히 채웁니다.
     그래야 레이어 토글이 지금처럼 즉시이면서 첫 화면은 그 비용을 내지 않습니다. */
  useEffect(() => {
    if (locationState !== "ready" && locationState !== "confirmed_empty") return;
    const cache = locationCacheRef.current;
    if (cache.world !== mapQuery.world || cache.unavailable) return;
    const remaining = PALWORLD_MAP_LOCATION_CATEGORIES.filter(
      (category) => !cache.layers.has(category),
    );
    if (remaining.length === 0) return;
    const controller = new AbortController();
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const schedule = idleWindow.requestIdleCallback
      ?? ((callback: () => void) => window.setTimeout(callback, 1_200));
    const cancel = idleWindow.cancelIdleCallback
      ?? ((handle: number) => window.clearTimeout(handle));
    const handle = schedule(() => {
      void fetchPalworldMapLocationCategories(
        remaining,
        mapQuery.world,
        controller.signal,
      ).then((result) => {
        if (controller.signal.aborted || result.state !== "ready") return;
        if (cache.world !== mapQuery.world) return;
        for (const category of remaining) {
          if (!cache.layers.has(category)) {
            cache.layers.set(category, result.byCategory.get(category) ?? []);
          }
        }
        const summary = summarizePalworldLocationCache(cache.layers);
        setLocationCounts(summary.categories);
        setCollectibleTypeCounts(summary.types);
      }).catch(() => {
        /* 프리페치 실패는 조용히 둡니다. 켜는 순간 정식 경로가 다시 요청합니다. */
      });
    });
    return () => {
      cancel(handle);
      controller.abort();
    };
  }, [locationState, mapQuery.world]);

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
      const center = palworldMapCenterFromView(
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
    const affectedCollectibleCategories = new Set(
      collectibleTypeIds.map(palworldMapCollectibleCategory),
    );
    const nextTypes = new Set(mapQuery.types);
    const nextLayers = new Set(
      updatePalworldMapLayerSelection(mapQuery.layers, runtimeLayerIds, selected),
    );
    for (const typeId of collectibleTypeIds) {
      if (selected) nextTypes.add(typeId);
      else nextTypes.delete(typeId);
    }
    if (!selected) {
      for (const category of affectedCollectibleCategories) {
        for (const typeId of palworldMapCollectibleTypesForCategory(category)) {
          nextTypes.delete(typeId);
        }
      }
    }
    for (const category of [
      "egg",
      "lifmunk",
      "resource",
      "npc",
      "enemy",
      "location",
    ] as const) {
      const categoryTypes = palworldMapCollectibleTypesForCategory(category);
      if (!affectedCollectibleCategories.has(category)) {
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

  const selectSpawnPal = useCallback((pal: PalworldPalReference | PalworldPalSummary | null): void => {
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
    ): PalworldMapLayerGroup["layers"][number] => {
      /* count 가 없으면 아직 안 받아 본 카테고리입니다. 잠그지 않고 켤 수 있게 두면
         켜는 순간 정식 로드가 받아 옵니다. 0 은 서버가 확인해 준 비어 있음입니다. */
      const count = locationCounts.get(id);
      const selectedNow = mapQuery.layers.includes(id);
      const state = importedLocationState === "data_unavailable"
        ? "data_unavailable"
        : selectedNow && importedLocationState !== "ready"
          ? importedLocationState
          : count === 0
            ? "confirmed_empty"
            : "ready";
      return {
        id,
        label: PALWORLD_MAP_LOCATION_LABELS[id],
        statusLabel: layerStatusLabel(state),
        count,
        iconAsset: PALWORLD_MAP_LAYER_ICONS[id],
        iconFallback: PALWORLD_MAP_LOCATION_FALLBACKS[id],
        selected: state === "ready" && selectedNow,
        state,
      };
    };
    const collectibleTypeLayer = (
      id: PalworldMapCollectibleTypeId,
    ): PalworldMapLayerGroup["layers"][number] => {
      const category = palworldMapCollectibleCategory(id);
      const count = collectibleTypeCounts.get(id);
      const categorySelected = mapQuery.layers.includes(category);
      const state = importedLocationState === "data_unavailable"
        ? "data_unavailable"
        : categorySelected && importedLocationState !== "ready"
          ? importedLocationState
          : count === 0
            ? "confirmed_empty"
            : "ready";
      return {
        id,
        label: PALWORLD_MAP_COLLECTIBLE_TYPE_LABELS[id],
        statusLabel: layerStatusLabel(state),
        count,
        iconAsset: PALWORLD_MAP_LAYER_ICONS[id]
          ?? (
            id === "resource-quartz-cluster"
                ? PALWORLD_MAP_LAYER_ICONS["resource-quartz"]
                : category === "enemy"
                  ? PALWORLD_MAP_LAYER_ICONS.boss
                  : category === "location"
                    ? PALWORLD_MAP_LAYER_ICONS["fast-travel"]
                    : category === "npc"
                      ? PALWORLD_MAP_LAYER_ICONS.npc
                      : PALWORLD_MAP_LAYER_ICONS[category]
          ),
        iconFallback: category === "egg"
          ? "●"
          : category === "resource"
            ? "◆"
            : category === "enemy"
              ? "⚔"
              : category === "location"
                ? "⌖"
                : category === "npc"
                  ? "♙"
                  : "✦",
        selected: state === "ready"
          && categorySelected
          && mapQuery.types.includes(id),
        state,
      };
    };
    return [{
      id: "pal",
      label: mapLabel(palworldI18n.ko.mapPalLayers, palworldI18n.ja.mapPalLayers),
      collapsed: collapsedFilterGroups.has("pal"),
      layers: [{
        id: "spawn",
        label: mapLabel(palworldI18n.ko.palWildSpawnAreas, palworldI18n.ja.palWildSpawnAreas),
        description: activeFocusPalId
          ? mapLabel(
              palworldI18n.ko.mapSpawnLayerDescription,
              palworldI18n.ja.mapSpawnLayerDescription,
            )
          : undefined,
        statusLabel: layerStatusLabel(spawnDisplayState),
        count: spawnResponse?.points.length,
        iconAsset: focusedSpawnIcon,
        iconFallback: "●",
        selected: spawnLayerSelected,
        state: spawnDisplayState,
      }],
    }, {
      id: "places",
      label: mapLabel(
        palworldI18n.ko.mapLocationLayers,
        palworldI18n.ja.mapLocationLayers,
      ),
      collapsed: collapsedFilterGroups.has("places"),
      layers: [
        locationLayer("fast-travel"),
        locationLayer("dungeon"),
        ...PALWORLD_MAP_LOCATION_TYPE_IDS.map(collectibleTypeLayer),
      ],
    }, {
      id: "npcs",
      label: mapLabel(palworldI18n.ko.mapNpcLayers, palworldI18n.ja.mapNpcLayers),
      collapsed: collapsedFilterGroups.has("npcs"),
      layers: PALWORLD_MAP_NPC_TYPE_IDS.map(collectibleTypeLayer),
    }, {
      id: "enemies",
      label: mapLabel(
        palworldI18n.ko.mapEnemyLayers,
        palworldI18n.ja.mapEnemyLayers,
      ),
      collapsed: collapsedFilterGroups.has("enemies"),
      layers: [{
        id: "boss",
        label: mapLabel(palworldI18n.ko.mapBossMarkers, palworldI18n.ja.mapBossMarkers),
        statusLabel: layerStatusLabel(markerState),
        count: markerResponse?.markers.length,
        iconAsset: PALWORLD_MAP_LAYER_ICONS.boss,
        iconFallback: "◆",
        selected: bossLayerSelected,
        state: layerDisplayState(markerState),
      }, ...PALWORLD_MAP_ENEMY_TYPE_IDS.map(collectibleTypeLayer)],
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
      layers: [
        ...PALWORLD_MAP_RESOURCE_TYPE_IDS.map(collectibleTypeLayer),
      ],
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
      ],
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
    availableOnly: mapLabel(
      palworldI18n.ko.mapFilterAvailableOnly,
      palworldI18n.ja.mapFilterAvailableOnly,
    ),
    hiddenEmpty: mapLabel(
      palworldI18n.ko.mapFilterHiddenEmpty,
      palworldI18n.ja.mapFilterHiddenEmpty,
    ),
    hide: mapLabel(palworldI18n.ko.mapFilterHide, palworldI18n.ja.mapFilterHide),
    reset: mapLabel(palworldI18n.ko.mapFilterReset, palworldI18n.ja.mapFilterReset),
    show: mapLabel(palworldI18n.ko.mapFilterShow, palworldI18n.ja.mapFilterShow),
    title: mapLabel(palworldI18n.ko.mapFilters, palworldI18n.ja.mapFilters),
  };
  const activeLayerCount = Number(bossLayerSelected)
    + Number(spawnLayerSelected)
    + selectedLocationLayers.filter((category) =>
      category !== "egg"
      && category !== "lifmunk"
      && category !== "resource"
      && category !== "npc"
      && category !== "enemy"
      && category !== "location"
    ).length
    + selectedCollectibleTypes.filter((typeId) =>
      mapQuery.layers.includes(palworldMapCollectibleCategory(typeId))
    ).length;
  /* 시트 손잡이에 넣는 한 줄 상태 요약 — 지도 아래 배지 줄이 하던 "지금 몇 개가
     보이는가"를 대신합니다. 재시도 버튼이 필요한 오류 상태는 여기 넣지 않고
     toolbar 를 유지합니다(손잡이는 button 이라 버튼을 중첩할 수 없습니다). */
  const mobileStatusSummary = [
    focusedPal ? resolvePalworldName(focusedPal, locale).text : undefined,
    markerState === "ready" && markerResponse
      ? `${text.mapBossMarkers} ${visibleBossMarkers.length}`
      : undefined,
    importedLayerSelected && locationState === "ready"
      ? `${text.mapLocationPoint} ${visibleMapLocations.length.toLocaleString(localeTag)}`
      : undefined,
    spawnLayerSelected && spawnState === "ready" && spawnSummary ? spawnMapSummary : undefined,
  ].filter(Boolean).join(" · ");
  /* 오류 상태에서만 모바일에서도 toolbar 를 보여 재시도 경로를 남깁니다. */
  const toolbarHasAlert = markerState === "error"
    || (importedLayerSelected && locationState === "error")
    || (spawnLayerSelected && spawnState === "error");

  function worldPositionDetail(coordinate: {
    normalizedX: number;
    normalizedY: number;
  }): string | undefined {
    if (!coordinateTransform) return undefined;
    const worldCoordinate = palworldMapToWorldCoordinate(coordinateTransform, {
      x: coordinate.normalizedX,
      y: coordinate.normalizedY,
    });
    if (!worldCoordinate) return undefined;
    return `X ${Math.round(worldCoordinate.x).toLocaleString()} · Y ${Math.round(worldCoordinate.y).toLocaleString()}`;
  }

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
      }, ...(worldPositionDetail(selectedMarker) ? [{
        label: mapLabel(palworldI18n.ko.mapWorldPosition, palworldI18n.ja.mapWorldPosition),
        value: worldPositionDetail(selectedMarker)!,
      }] : []), {
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
      details={[...(worldPositionDetail(selectedMapLocation) ? [{
        label: mapLabel(palworldI18n.ko.mapWorldPosition, palworldI18n.ja.mapWorldPosition),
        value: worldPositionDetail(selectedMapLocation)!,
      }] : []), {
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
          availableOnly={filtersAvailableOnly}
          className="palworld-map-desktop-filter"
          collapsed={filtersCollapsed}
          copy={filterCopy}
          groups={layerGroups}
          locale={locale}
          onAvailableOnlyChange={setFiltersAvailableOnly}
          onCollapsedChange={setFiltersCollapsed}
          onGroupCollapsedChange={changeGroupCollapsed}
          onGroupLayerChange={changeGroupLayers}
          onLayerChange={changeLayer}
          onReset={resetExplorer}
        >
          {renderFilterControls("palworld-map-pal-picker")}
        </PalworldMapFilterPanel>
        <PalworldMapMobileFilters
          availableOnly={filtersAvailableOnly}
          copy={filterCopy}
          groups={layerGroups}
          locale={locale}
          onAvailableOnlyChange={setFiltersAvailableOnly}
          onGroupCollapsedChange={changeGroupCollapsed}
          onGroupLayerChange={changeGroupLayers}
          onLayerChange={changeLayer}
          onReset={() => {
            resetExplorer();
            setMobileSheetSnap("half");
          }}
          onSnapChange={setMobileSheetSnap}
          snap={mobileSheetSnap}
          statusSummary={mobileStatusSummary}
        >
          {renderFilterControls("palworld-map-mobile-pal-picker")}
        </PalworldMapMobileFilters>
        {/* 좌상단 명령 바(필터 N개 버튼)는 제거 — 시트 손잡이가 유일한 필터 트리거입니다.
            트리거가 두 곳이면 상태가 갈리고, 지도 위 위젯도 하나 늘어납니다. */}
        <div className="palworld-map-explorer-main">
          <Card as="section" className="palworld-map-card" padding="none" aria-labelledby="palworld-map-title">

            <div className="palworld-map-canvas-shell">
              <figure className="palworld-map-figure">
                <div
                aria-label={text.mapImageAlt}
                aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight + - Home"
                className="palworld-map-viewport"
                data-testid="palworld-map-viewport"
                data-panning={isPanning ? "true" : undefined}
                data-touch-mode="map"
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
                onClickCapture={handleClickCapture}
                onKeyDown={handleKeyDown}
                onLostPointerCapture={endPointer}
                onPointerCancel={endPointer}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endPointer}
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
                      /* 지도는 이 화면의 LCP 요소입니다. React 18 은 camelCase 를 모르므로 소문자로 넘깁니다. */
                      {...{ fetchpriority: "high" }}
                      height={activeMapImage.height}
                      key={`${mapQuery.world}-${imageRevision}`}
                      onError={() => setLoadState("error")}
                      onLoad={() => setLoadState("ready")}
                      /* 원본은 4096×4096(1,056KB)인데 390px 화면에도 그대로 내려갔습니다.
                         변형이 있으면 폭·배율에 맞는 판을 브라우저가 고릅니다.
                         sizes 를 확대 배율에 묶어 두면 확대할 때 더 큰 판으로 올라갑니다
                         (브라우저는 이미 받은 판보다 작은 판으로는 되돌아가지 않습니다). */
                      sizes={mapImageSizes}
                      src={activeMapImage.imageUrl}
                      srcSet={mapImageSrcSet}
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
                {/* 월드 전환은 어느 폭에서나 지도 왼쪽 위입니다. 예전에는 좁은 화면에서 지도 아래 회색 띠에 있었습니다. */}
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
                <div
                  aria-label={text.mapWheelZoomHint}
                  className="palworld-map-wheel-hint"
                  data-map-interactive="true"
                  role="note"
                >
                  <kbd>{text.mapWheelZoomShortcut}</kbd>
                  <span>{text.mapWheelZoomHint}</span>
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
              {/* 상태 배지는 지도 상자 기준으로 놓습니다. 카드 기준이면 지도가 좁아졌을 때 밖으로 나갑니다. */}
            <div className="palworld-map-toolbar" data-has-alert={toolbarHasAlert ? "true" : undefined}>
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
            </div>
              {markerPopover ?? locationPopover}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
