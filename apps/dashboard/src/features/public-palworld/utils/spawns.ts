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
