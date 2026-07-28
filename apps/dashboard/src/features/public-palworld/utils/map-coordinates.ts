import type { PalworldMapLocationArtifactTransform } from "@streamops/shared";

export type PalworldMapNormalizedCoordinate = {
  x: number;
  y: number;
};

export type PalworldMapWorldCoordinate = {
  x: number;
  y: number;
};

function normalizedAxisValue(
  value: number,
  minimum: number,
  maximum: number,
  inverted: boolean,
): number | undefined {
  if (
    !Number.isFinite(value)
    || !Number.isFinite(minimum)
    || !Number.isFinite(maximum)
    || minimum >= maximum
    || value < minimum
    || value > maximum
  ) {
    return undefined;
  }
  const normalized = (value - minimum) / (maximum - minimum);
  return inverted ? 1 - normalized : normalized;
}

function worldAxisValue(
  value: number,
  minimum: number,
  maximum: number,
  inverted: boolean,
): number | undefined {
  if (
    !Number.isFinite(value)
    || value < 0
    || value > 1
    || !Number.isFinite(minimum)
    || !Number.isFinite(maximum)
    || minimum >= maximum
  ) {
    return undefined;
  }
  const normalized = inverted ? 1 - value : value;
  return minimum + (normalized * (maximum - minimum));
}

export function worldToPalworldMapCoordinate(
  transform: PalworldMapLocationArtifactTransform,
  coordinate: PalworldMapWorldCoordinate,
): PalworldMapNormalizedCoordinate | undefined {
  const horizontalValue = transform.horizontalAxis === "world_x"
    ? coordinate.x
    : coordinate.y;
  const verticalValue = transform.verticalAxis === "world_x"
    ? coordinate.x
    : coordinate.y;
  const horizontalBounds = transform.horizontalAxis === "world_x"
    ? [transform.sourceBounds.minX, transform.sourceBounds.maxX] as const
    : [transform.sourceBounds.minY, transform.sourceBounds.maxY] as const;
  const verticalBounds = transform.verticalAxis === "world_x"
    ? [transform.sourceBounds.minX, transform.sourceBounds.maxX] as const
    : [transform.sourceBounds.minY, transform.sourceBounds.maxY] as const;
  const x = normalizedAxisValue(
    horizontalValue,
    horizontalBounds[0],
    horizontalBounds[1],
    transform.invertHorizontal,
  );
  const y = normalizedAxisValue(
    verticalValue,
    verticalBounds[0],
    verticalBounds[1],
    transform.invertVertical,
  );
  return x === undefined || y === undefined ? undefined : { x, y };
}

export function palworldMapToWorldCoordinate(
  transform: PalworldMapLocationArtifactTransform,
  coordinate: PalworldMapNormalizedCoordinate,
): PalworldMapWorldCoordinate | undefined {
  const horizontalBounds = transform.horizontalAxis === "world_x"
    ? [transform.sourceBounds.minX, transform.sourceBounds.maxX] as const
    : [transform.sourceBounds.minY, transform.sourceBounds.maxY] as const;
  const verticalBounds = transform.verticalAxis === "world_x"
    ? [transform.sourceBounds.minX, transform.sourceBounds.maxX] as const
    : [transform.sourceBounds.minY, transform.sourceBounds.maxY] as const;
  const horizontal = worldAxisValue(
    coordinate.x,
    horizontalBounds[0],
    horizontalBounds[1],
    transform.invertHorizontal,
  );
  const vertical = worldAxisValue(
    coordinate.y,
    verticalBounds[0],
    verticalBounds[1],
    transform.invertVertical,
  );
  if (horizontal === undefined || vertical === undefined) {
    return undefined;
  }
  return transform.horizontalAxis === "world_x"
    ? { x: horizontal, y: vertical }
    : { x: vertical, y: horizontal };
}
