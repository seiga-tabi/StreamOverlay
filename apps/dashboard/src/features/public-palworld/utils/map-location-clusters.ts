export type PalworldMapClusterSource = {
  id: string;
  category: string;
  subtype?: string;
  normalizedX: number;
  normalizedY: number;
};

export type PalworldMapLocationCluster<T extends PalworldMapClusterSource> = {
  id: string;
  category: T["category"];
  count: number;
  normalizedX: number;
  normalizedY: number;
  locations: readonly T[];
};

export type PalworldMapLocationClusterZoomBand = 1 | 1.75 | 2.5;

/**
 * 같은 격자를 사용하는 확대 범위에서는 위치 배열을 다시 정렬하지 않도록
 * 확대값을 세 개의 안정적인 구간으로 정규화합니다.
 */
export function palworldMapLocationClusterZoomBand(
  zoom: number,
): PalworldMapLocationClusterZoomBand {
  if (zoom >= 2.5) return 2.5;
  if (zoom >= 1.75) return 1.75;
  return 1;
}

function gridSizeForZoom(zoom: number): number {
  switch (palworldMapLocationClusterZoomBand(zoom)) {
    case 2.5:
      return 48;
    case 1.75:
      return 32;
    default:
      return 20;
  }
}

/**
 * 수천 개의 월드 actor를 모두 HTML button으로 만들지 않도록 같은 레이어와
 * 화면 격자에 속한 위치를 하나의 접근 가능한 지도 마커로 묶습니다.
 */
export function clusterPalworldMapLocations<T extends PalworldMapClusterSource>(
  locations: readonly T[],
  zoom: number,
): readonly PalworldMapLocationCluster<T>[] {
  const gridSize = gridSizeForZoom(zoom);
  const buckets = new Map<string, T[]>();
  const orderedLocations = [...locations].sort(
    (left, right) => left.category.localeCompare(right.category, "en")
      || (left.subtype ?? "").localeCompare(right.subtype ?? "", "en")
      || left.id.localeCompare(right.id, "en"),
  );

  for (const location of orderedLocations) {
    if (
      !Number.isFinite(location.normalizedX)
      || !Number.isFinite(location.normalizedY)
      || location.normalizedX < 0
      || location.normalizedX > 1
      || location.normalizedY < 0
      || location.normalizedY > 1
    ) {
      continue;
    }
    const column = Math.min(gridSize - 1, Math.floor(location.normalizedX * gridSize));
    const row = Math.min(gridSize - 1, Math.floor(location.normalizedY * gridSize));
    const key = `${location.category}:${location.subtype ?? ""}:${column}:${row}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(location);
    } else {
      buckets.set(key, [location]);
    }
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([key, entries]) => ({
      id: `map-cluster-${key.replaceAll(":", "-")}`,
      category: entries[0]!.category as T["category"],
      count: entries.length,
      normalizedX: entries.reduce((sum, entry) => sum + entry.normalizedX, 0) / entries.length,
      normalizedY: entries.reduce((sum, entry) => sum + entry.normalizedY, 0) / entries.length,
      locations: entries,
    }));
}
