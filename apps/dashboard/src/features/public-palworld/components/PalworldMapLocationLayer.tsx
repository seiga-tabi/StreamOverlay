import type {
  PalworldMapLocation,
  PalworldMapLocationCategory,
} from "@streamops/shared";
import {
  memo,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  clusterPalworldMapLocations,
  palworldMapLocationClusterZoomBand,
  type PalworldMapLocationCluster,
} from "../utils/map-location-clusters";
import type { PalworldLocale } from "../i18n/palworld-i18n";
import {
  resolvePalworldMapLabel,
  type PalworldMapLayerIconAsset,
  type PalworldMapLocalizedLabel,
} from "./PalworldMapExplorerTypes";
import {
  palworldMapCollectibleTypeForLocation,
  type PalworldMapCollectibleTypeId,
} from "../utils/map-collectible-types";

const CATEGORY_SYMBOLS: Record<PalworldMapLocationCategory, string> = {
  "fast-travel": "◇",
  dungeon: "▣",
  egg: "●",
  "skill-fruit": "◆",
  lifmunk: "✦",
  journal: "▤",
};

type PalworldMapLocationIconId =
  | PalworldMapLocationCategory
  | PalworldMapCollectibleTypeId;

export function PalworldMapLocationIcon({
  asset,
  className,
  fallbackSymbol,
}: {
  asset?: PalworldMapLayerIconAsset;
  className?: string;
  fallbackSymbol: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [asset?.imageUrl]);

  return (
    <span
      aria-hidden="true"
      className={["palworld-map-location-icon", className]
        .filter(Boolean)
        .join(" ")}
    >
      {asset && !failed ? (
        <img
          alt=""
          aria-hidden="true"
          decoding="async"
          draggable={false}
          height={asset.height}
          loading="lazy"
          onError={() => setFailed(true)}
          src={asset.imageUrl}
          width={asset.width}
        />
      ) : (
        <span className="palworld-map-location-icon-fallback">
          {fallbackSymbol}
        </span>
      )}
    </span>
  );
}

type PalworldMapLocationLayerProps = {
  clusterLabel: (count: number) => string;
  iconAssets?: Readonly<
    Partial<Record<PalworldMapLocationIconId, PalworldMapLayerIconAsset>>
  >;
  labels: Readonly<Record<PalworldMapLocationCategory, PalworldMapLocalizedLabel>>;
  locale: PalworldLocale;
  locations: readonly PalworldMapLocation[];
  onSelectCluster: (cluster: PalworldMapLocationCluster<PalworldMapLocation>) => void;
  onSelectLocation: (
    location: PalworldMapLocation,
    trigger: HTMLButtonElement,
  ) => void;
  popoverId?: string;
  selectedLocationId?: string;
  subtypeLabels?: Readonly<
    Partial<Record<PalworldMapCollectibleTypeId, PalworldMapLocalizedLabel>>
  >;
  zoom: number;
};

export const PalworldMapLocationLayer = memo(function PalworldMapLocationLayer({
  clusterLabel,
  iconAssets,
  labels,
  locale,
  locations,
  onSelectCluster,
  onSelectLocation,
  popoverId,
  selectedLocationId,
  subtypeLabels,
  zoom,
}: PalworldMapLocationLayerProps) {
  const clusterZoom = palworldMapLocationClusterZoomBand(zoom);
  const clusters = useMemo(
    () => clusterPalworldMapLocations(locations, clusterZoom),
    [clusterZoom, locations],
  );

  return (
    <>
      {clusters.map((cluster) => {
        const representativeLocation = cluster.locations[0]!;
        const typeId = palworldMapCollectibleTypeForLocation(
          representativeLocation,
        );
        const subtypeLabel = typeId ? subtypeLabels?.[typeId] : undefined;
        const label = resolvePalworldMapLabel(
          subtypeLabel ?? labels[cluster.category],
          locale,
        );
        const singleLocation = cluster.count === 1 ? cluster.locations[0] : undefined;
        const selected = singleLocation?.id === selectedLocationId;
        const accessibleLabel = singleLocation
          ? label
          : `${label}, ${clusterLabel(cluster.count)}`;
        const markerIcon = typeId
          ? iconAssets?.[typeId]
          : iconAssets?.[cluster.category];
        const style = {
          "--palworld-map-marker-inverse-scale": 1 / zoom,
          left: `${cluster.normalizedX * 100}%`,
          top: `${cluster.normalizedY * 100}%`,
        } as CSSProperties;

        return (
          <button
            aria-controls={selected && popoverId ? popoverId : undefined}
            aria-expanded={singleLocation && popoverId ? selected : undefined}
            aria-label={accessibleLabel}
            className="palworld-map-location-marker"
            data-category={cluster.category}
            data-cluster={singleLocation ? undefined : "true"}
            data-map-interactive="true"
            data-selected={selected ? "true" : undefined}
            key={cluster.id}
            onClick={(event) => {
              event.stopPropagation();
              if (singleLocation) {
                onSelectLocation(singleLocation, event.currentTarget);
              } else {
                onSelectCluster(cluster);
              }
            }}
            style={style}
            title={accessibleLabel}
            type="button"
          >
            <PalworldMapLocationIcon
              asset={markerIcon}
              fallbackSymbol={CATEGORY_SYMBOLS[cluster.category]}
            />
            {singleLocation ? null : (
              <strong aria-hidden="true">{cluster.count}</strong>
            )}
          </button>
        );
      })}
    </>
  );
});

export type { PalworldMapLocationLayerProps };
