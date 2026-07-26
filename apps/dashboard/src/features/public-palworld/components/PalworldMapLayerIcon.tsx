import { useEffect, useState } from "react";
import type { PalworldMapLayerIconAsset } from "./PalworldMapExplorerTypes";

type PalworldMapLayerIconProps = {
  asset?: PalworldMapLayerIconAsset;
  fallbackSymbol: string;
};

export function PalworldMapLayerIcon({
  asset,
  fallbackSymbol,
}: PalworldMapLayerIconProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [asset?.imageUrl]);

  return (
    <span aria-hidden="true" className="palworld-map-filter-layer-icon">
      {asset && !failed ? (
        <img
          alt=""
          aria-hidden="true"
          decoding="async"
          draggable={false}
          height={asset.height}
          loading="eager"
          onError={() => setFailed(true)}
          src={asset.imageUrl}
          width={asset.width}
        />
      ) : (
        <span className="palworld-map-filter-layer-icon-fallback">
          {fallbackSymbol}
        </span>
      )}
    </span>
  );
}
