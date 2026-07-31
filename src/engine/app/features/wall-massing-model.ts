export type WallMassPoint = {
  x: number;
  y: number;
};

export type WallMassSource = {
  id?: string | null;
  pts?: WallMassPoint[] | null;
};

export type WallMassAnchor = {
  px: number;
  py: number;
  ppm: number;
};

export type WallMassBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

function validAnchor(anchor: WallMassAnchor | null | undefined): anchor is WallMassAnchor {
  return Boolean(
    anchor &&
      Number.isFinite(anchor.px) &&
      Number.isFinite(anchor.py) &&
      Number.isFinite(anchor.ppm) &&
      anchor.ppm > 0,
  );
}

export function wallMassKey(
  wall: WallMassSource,
  wallIndex: number,
  segmentIndex: number,
): string {
  const wallId =
    typeof wall.id === "string" && wall.id.trim()
      ? wall.id
      : `legacy-index-${wallIndex}`;
  return `${wallId}:${segmentIndex}`;
}

export function legacyWallMassKey(
  wallIndex: number,
  segmentIndex: number,
): string {
  return `${wallIndex}:${segmentIndex}`;
}

export function wallMassBounds(
  walls: WallMassSource[],
): WallMassBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const wall of walls) {
    for (const point of wall.pts || []) {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) continue;
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  return { minX, minY, maxX, maxY };
}

export function resolveWallMassAnchor(options: {
  walls: WallMassSource[];
  currentPpm: number;
  existingAnchor?: WallMassAnchor | null;
  preserveExisting: boolean;
}): {
  anchor: WallMassAnchor | null;
  bounds: WallMassBounds | null;
  reanchored: boolean;
} {
  const bounds = wallMassBounds(options.walls);
  const ppm =
    Number.isFinite(options.currentPpm) && options.currentPpm > 0
      ? options.currentPpm
      : null;

  if (options.preserveExisting && validAnchor(options.existingAnchor)) {
    return {
      anchor: { ...options.existingAnchor },
      bounds,
      reanchored: false,
    };
  }
  if (!bounds || ppm == null) {
    return {
      anchor: validAnchor(options.existingAnchor)
        ? { ...options.existingAnchor }
        : null,
      bounds,
      reanchored: false,
    };
  }

  const anchor = {
    px: (bounds.minX + bounds.maxX) / 2,
    py: (bounds.minY + bounds.maxY) / 2,
    ppm,
  };
  const reanchored =
    !validAnchor(options.existingAnchor) ||
    Math.abs(options.existingAnchor.px - anchor.px) > 0.01 ||
    Math.abs(options.existingAnchor.py - anchor.py) > 0.01 ||
    Math.abs(options.existingAnchor.ppm - anchor.ppm) > 0.0001;

  return { anchor, bounds, reanchored };
}

export function fitWallMassCameraScale(options: {
  bounds: WallMassBounds | null;
  ppm: number;
  viewportWidth: number;
  viewportHeight: number;
}): number | null {
  const { bounds, ppm, viewportWidth, viewportHeight } = options;
  if (
    !bounds ||
    !Number.isFinite(ppm) ||
    ppm <= 0 ||
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return null;
  }
  const spanMetres = Math.max(
    (bounds.maxX - bounds.minX) / ppm,
    (bounds.maxY - bounds.minY) / ppm,
    3,
  );
  const fitted = Math.min(viewportWidth, viewportHeight) / (spanMetres * 1.65);
  return Math.max(4, Math.min(60, fitted));
}
