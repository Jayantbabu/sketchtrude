import type { Point3D, SnapResult, SnapType, Vector3 } from "./types";

export type SnapTarget = {
  type: SnapType;
  point: Point3D;
  objectId?: string;
  axis?: "x" | "y" | "z";
};

export type SnapEngineOptions = {
  enabled?: boolean;
  tolerancePx?: number;
  gridSpacing?: number;
  gridSnap?: boolean;
  objectSnap?: boolean;
};

/**
 * Shared snap engine for drawing and transforming.
 * Returns structured SnapResult — never just a bare point.
 */
export class SnapEngine {
  private enabled: boolean;
  private tolerancePx: number;
  private gridSpacing: number;
  private gridSnap: boolean;
  private objectSnap: boolean;
  private targets: SnapTarget[] = [];

  constructor(options: SnapEngineOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.tolerancePx = options.tolerancePx ?? 8;
    this.gridSpacing = options.gridSpacing ?? 5;
    this.gridSnap = options.gridSnap ?? true;
    this.objectSnap = options.objectSnap ?? true;
  }

  configure(options: SnapEngineOptions): void {
    if (options.enabled !== undefined) this.enabled = options.enabled;
    if (options.tolerancePx !== undefined) this.tolerancePx = options.tolerancePx;
    if (options.gridSpacing !== undefined) this.gridSpacing = options.gridSpacing;
    if (options.gridSnap !== undefined) this.gridSnap = options.gridSnap;
    if (options.objectSnap !== undefined) this.objectSnap = options.objectSnap;
  }

  setTargets(targets: SnapTarget[]): void {
    this.targets = targets.slice();
  }

  clearTargets(): void {
    this.targets = [];
  }

  snap(point: Vector3, excludeObjectIds: string[] = []): SnapResult | null {
    if (!this.enabled) return null;

    const exclude = new Set(excludeObjectIds);
    let best: SnapResult | null = null;

    if (this.gridSnap && this.gridSpacing > 0) {
      const gx = Math.round(point.x / this.gridSpacing) * this.gridSpacing;
      const gy = Math.round(point.y / this.gridSpacing) * this.gridSpacing;
      const gridPoint = { x: gx, y: gy, z: point.z };
      const distance = Math.hypot(point.x - gx, point.y - gy);
      if (distance <= this.tolerancePx) {
        best = {
          type: "grid",
          point: gridPoint,
          distance,
        };
      }
    }

    if (this.objectSnap) {
      for (const target of this.targets) {
        if (target.objectId && exclude.has(target.objectId)) continue;
        const distance = Math.hypot(
          point.x - target.point.x,
          point.y - target.point.y,
          point.z - target.point.z,
        );
        if (distance > this.tolerancePx) continue;
        // Closer wins; object snaps beat grid at equal distance.
        if (best) {
          if (distance > best.distance) continue;
          if (distance === best.distance && best.type !== "grid") continue;
        }
        best = {
          type: target.type,
          targetObjectId: target.objectId,
          point: { ...target.point },
          distance,
          guide: target.axis
            ? { axis: target.axis, from: point, to: target.point }
            : undefined,
        };
      }
    }

    return best;
  }

  /** Apply snap if available, otherwise return the original point. */
  resolve(point: Vector3, excludeObjectIds?: string[]): Vector3 {
    const hit = this.snap(point, excludeObjectIds);
    return hit ? { ...hit.point } : { ...point };
  }
}

export function createSnapEngine(options?: SnapEngineOptions): SnapEngine {
  return new SnapEngine(options);
}
