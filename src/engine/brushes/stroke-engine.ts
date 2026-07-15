import type { BrushPreset, ResolvedStrokeParams } from "./types";

export type StrokeContext = {
  color: string;
  size: number;
  alpha: number;
  /** px per document mm — used for scale-aware technical pens. */
  pxPerMm?: number | null;
  zoom?: number;
};

/**
 * Resolve screen/document stroke parameters from a brush + stylus pressure.
 * Scale-aware brushes convert mm lineweight → document pixels.
 */
export function resolveStrokeParams(
  brush: BrushPreset,
  pressure: number,
  ctx: StrokeContext,
): ResolvedStrokeParams {
  const p = clamp01(pressure);
  let baseSize = ctx.size > 0 ? ctx.size : brush.size;

  if (brush.scaleAware?.enabled && brush.scaleAware.lineWeightMm && ctx.pxPerMm) {
    const docPx = brush.scaleAware.lineWeightMm * ctx.pxPerMm;
    // Keep preview readable at extreme zoom without changing document weight intent.
    const zoom = ctx.zoom && ctx.zoom > 0 ? ctx.zoom : 1;
    baseSize = Math.max(0.5, docPx * Math.min(1.5, Math.max(0.35, 1 / Math.sqrt(zoom))));
  }

  const lineWidth = Math.max(
    0.3,
    baseSize * (1 - brush.pressureSize + brush.pressureSize * p),
  );
  const alpha = clamp01(
    ctx.alpha *
      (1 - brush.pressureOpacity + brush.pressureOpacity * p) *
      (brush.flow ?? 1) *
      (1 - (brush.pressureFlow ?? 0) + (brush.pressureFlow ?? 0) * p),
  );

  const isErase = brush.kind === "erase";
  const useBuffer =
    !isErase &&
    brush.kind !== "smudge" &&
    brush.tipType !== "texture" &&
    brush.engineType !== "texture";

  return {
    lineWidth,
    alpha: isErase ? 1 : Math.max(0.02, alpha),
    flow: brush.flow ?? 1,
    blend: brush.blend,
    composite: isErase ? "destination-out" : brush.blend,
    spacing: brush.spacing,
    useBuffer,
  };
}

/** EMA smoothing for stylus coordinates. */
export function smoothPoint(
  prev: { x: number; y: number } | null,
  next: { x: number; y: number },
  smoothing: number,
): { x: number; y: number } {
  if (!prev || smoothing <= 0) return { ...next };
  const t = clamp01(1 - smoothing);
  return {
    x: prev.x + (next.x - prev.x) * t,
    y: prev.y + (next.y - prev.y) * t,
  };
}

/**
 * Stabilizer lag: pulls the drawing point toward the target with a delay factor.
 * stabilization 0 = none, 1 = heavy lag.
 */
export function stabilizePoint(
  current: { x: number; y: number },
  target: { x: number; y: number },
  stabilization: number,
): { x: number; y: number } {
  if (stabilization <= 0) return { ...target };
  const k = clamp01(1 - stabilization * 0.85);
  return {
    x: current.x + (target.x - current.x) * k,
    y: current.y + (target.y - current.y) * k,
  };
}

export function applyBrushToCanvasContext(
  ctx: CanvasRenderingContext2D,
  brush: BrushPreset,
  params: ResolvedStrokeParams,
  color: string,
  options: { skipMasterAlpha?: boolean } = {},
): void {
  ctx.globalCompositeOperation = params.composite as GlobalCompositeOperation;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = brush.tipType === "chisel" || brush.tipType === "flat" ? "butt" : "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = params.lineWidth;
  if (options.skipMasterAlpha) {
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = params.alpha;
  }

  if (brush.dash?.enabled) {
    const dash = brush.dash.dashMm ?? 4;
    const gap = brush.dash.gapMm ?? 2;
    if (brush.dash.pattern === "centerline") {
      ctx.setLineDash([dash * 3, gap, dash, gap]);
    } else {
      ctx.setLineDash([dash, gap]);
    }
  } else {
    ctx.setLineDash([]);
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
