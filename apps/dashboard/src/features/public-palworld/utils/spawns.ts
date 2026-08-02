import type {
  PalworldMapMarker,
  PalworldPalSpawnPoint,
} from "@streamops/shared";

export type PalworldSpawnPointSummary = {
  areas: number;
  daytime: boolean;
  maximumLevel: number;
  minimumLevel: number;
  nighttime: boolean;
  placements: number;
};

export type PalworldPreviewSpawnCluster = {
  daytime: boolean;
  id: string;
  maximumLevel: number;
  minimumLevel: number;
  nighttime: boolean;
  normalizedX: number;
  normalizedY: number;
  placementCount: number;
  pointCount: number;
};

export type PalworldSpawnPeriod = "all" | "day" | "night";

export function filterPalworldSpawnPointsByPeriod(
  points: readonly PalworldPalSpawnPoint[],
  period: PalworldSpawnPeriod,
): PalworldPalSpawnPoint[] {
  if (period === "all") return [...points];
  return points.filter((point) =>
    period === "day" ? point.daytime : point.nighttime
  );
}

export function summarizePalworldSpawnPoints(
  points: readonly PalworldPalSpawnPoint[],
): PalworldSpawnPointSummary | undefined {
  if (points.length === 0) return undefined;
  return {
    areas: points.length,
    daytime: points.some((point) => point.daytime),
    maximumLevel: Math.max(...points.map((point) => point.maximumLevel)),
    minimumLevel: Math.min(...points.map((point) => point.minimumLevel)),
    nighttime: points.some((point) => point.nighttime),
    placements: points.reduce((total, point) => total + point.placementCount, 0),
  };
}

export function clusterPalworldPreviewSpawnPoints(
  points: readonly PalworldPalSpawnPoint[],
  zoom = 1,
): PalworldPreviewSpawnCluster[] {
  const safeZoom = Number.isFinite(zoom) ? Math.max(1, zoom) : 1;
  const cellSize = Math.max(0.022, 0.072 / Math.sqrt(safeZoom));
  const orderedPoints = [...points].sort((first, second) => first.id.localeCompare(second.id));
  const visited = new Set<string>();
  const buckets: PalworldPalSpawnPoint[][] = [];

  for (const point of orderedPoints) {
    if (visited.has(point.id)) continue;
    const bucket = [point];
    visited.add(point.id);
    for (let index = 0; index < bucket.length; index += 1) {
      const current = bucket[index];
      if (!current) continue;
      for (const candidate of orderedPoints) {
        if (visited.has(candidate.id)) continue;
        if (Math.hypot(
          candidate.normalizedX - current.normalizedX,
          candidate.normalizedY - current.normalizedY,
        ) <= cellSize) {
          visited.add(candidate.id);
          bucket.push(candidate);
        }
      }
    }
    buckets.push(bucket.sort((first, second) => first.id.localeCompare(second.id)));
  }

  return buckets.map((bucket) => {
    const placementCount = bucket.reduce(
      (total, point) => total + Math.max(1, point.placementCount),
      0,
    );
    const weightedX = bucket.reduce(
      (total, point) => total + (point.normalizedX * Math.max(1, point.placementCount)),
      0,
    );
    const weightedY = bucket.reduce(
      (total, point) => total + (point.normalizedY * Math.max(1, point.placementCount)),
      0,
    );
    return {
      daytime: bucket.some((point) => point.daytime),
      id: `spawn-cluster-${bucket[0]?.id ?? "unknown"}`,
      maximumLevel: Math.max(...bucket.map((point) => point.maximumLevel)),
      minimumLevel: Math.min(...bucket.map((point) => point.minimumLevel)),
      nighttime: bucket.some((point) => point.nighttime),
      normalizedX: weightedX / placementCount,
      normalizedY: weightedY / placementCount,
      placementCount,
      pointCount: bucket.length,
    };
  }).sort((first, second) => first.id.localeCompare(second.id));
}

export function filterPalworldPreviewClustersInViewport(
  clusters: readonly PalworldPreviewSpawnCluster[],
  view: Readonly<{ x: number; y: number; zoom: number }>,
  viewportWidth: number,
  viewportHeight: number,
  overscan = 0.06,
): PalworldPreviewSpawnCluster[] {
  if (viewportWidth <= 0 || viewportHeight <= 0) return [...clusters];
  const zoom = Number.isFinite(view.zoom) ? Math.max(1, view.zoom) : 1;
  const normalizedOverscan = Math.max(0, overscan) / zoom;
  const minimumX = (-view.x / (viewportWidth * zoom)) - normalizedOverscan;
  const maximumX = ((viewportWidth - view.x) / (viewportWidth * zoom)) + normalizedOverscan;
  const minimumY = (-view.y / (viewportHeight * zoom)) - normalizedOverscan;
  const maximumY = ((viewportHeight - view.y) / (viewportHeight * zoom)) + normalizedOverscan;
  return clusters.filter((cluster) =>
    cluster.normalizedX >= minimumX
    && cluster.normalizedX <= maximumX
    && cluster.normalizedY >= minimumY
    && cluster.normalizedY <= maximumY
  );
}

export function filterPalworldBossMarkers(
  markers: readonly PalworldMapMarker[],
  palId: string,
): PalworldMapMarker[] {
  return markers.filter((marker) => marker.pal.id === palId);
}

function spawnPointDensity(placementCount: number): number {
  const safeCount = Number.isFinite(placementCount)
    ? Math.max(1, placementCount)
    : 1;
  return Math.min(1, Math.log2(safeCount + 1) / 6);
}

export function palworldSpawnPointRadius(
  placementCount: number,
  zoom = 1,
): number {
  const safeZoom = Number.isFinite(zoom) ? Math.max(1, zoom) : 1;
  return (0.0065 + (spawnPointDensity(placementCount) * 0.0045)) / safeZoom;
}

export function palworldSpawnPointOpacity(placementCount: number): number {
  return 0.52 + (spawnPointDensity(placementCount) * 0.36);
}
