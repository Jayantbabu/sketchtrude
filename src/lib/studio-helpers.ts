/** Pure helpers shared by the studio engine and unit tests. */

export type MassingState = {
  active: boolean;
  tool: string;
  selected: number;
  panX: number;
  panY: number;
  cam: { scale: number };
};

export const INSPECTOR_TOOLS = new Set([
  "select",
  "move",
  "height",
  "push",
  "material",
]);

/** All 3D massing toolbar tools */
export const MASSING_TOOLS = [
  "add",
  "build",
  "select",
  "sketch",
  "push",
  "material",
  "remove",
  "orbit",
  "pan",
  "move",
  "height",
] as const;

export type MassingTool = (typeof MASSING_TOOLS)[number];

/** 2D sketch / draw tools */
export const SKETCH_DRAW_TOOLS = new Set([
  "pen",
  "marker",
  "pencil",
  "brush",
  "watercolour",
  "eraser",
  "fine-pen",
  "chisel",
  "flat",
]);

/** 2D build / measure tools in sketch mode */
export const SKETCH_BUILD_TOOLS = new Set([
  "wall",
  "opening",
  "select",
  "offset",
  "line",
  "area",
  "ruler",
  "hand",
]);

export const MASSING_TOOL_HINTS: Record<string, string> = {
  add: "Drag a footprint on the ground, release to extrude",
  build: "Wall: tap corners. Door/Window: tap a wall to drop one",
  select: "Tap a mass to select · drag body to move · grab a handle to edit",
  sketch: "Tap a face to sketch its elevation / plan",
  push: "Tap a face region and drag — out to extrude, in to recess",
  material: "Pick a material, then tap a face or region",
  remove: "Tap a mass to delete it",
  orbit: "Drag to orbit · pinch or scroll to zoom",
  pan: "Drag to pan the view",
  move: "Drag sideways to move on ground · drag up/down to raise/lower",
  height: "Drag up / down to push-pull height",
};

export function shouldShowMassInspector(
  massing: Pick<MassingState, "active" | "tool" | "selected">,
): boolean {
  if (!massing.active) return false;
  if (massing.selected < 0) return false;
  return INSPECTOR_TOOLS.has(massing.tool);
}

export function shouldShowBuildPalette(
  massing: Pick<MassingState, "active" | "tool">,
): boolean {
  return massing.active && massing.tool === "build";
}

export function shouldShowWall2dPalette(
  tool: string,
  massingActive: boolean,
): boolean {
  return !massingActive && tool === "wall";
}

export function shouldShowOpeningPalette(
  tool: string,
  massingActive: boolean,
): boolean {
  return !massingActive && tool === "opening";
}

export function activeRailHighlight(
  tool: string,
  massingActive: boolean,
): string {
  return massingActive ? "massing" : tool;
}

/** Auto-expand is removed — canvases are fixed-size (infinite uses a large world). */
export function resolveAutoExpandFromMetadata(
  _meta: Record<string, unknown>,
): boolean {
  return false;
}

export function shouldAutoExpandCanvas(_flags: {
  infiniteCanvas?: boolean;
  autoExpandCanvas?: boolean;
}): boolean {
  return false;
}

export function shouldExpandAtEdge(
  x: number,
  y: number,
  docWidth: number,
  docHeight: number,
  threshold = 140,
): { left: boolean; right: boolean; top: boolean; bottom: boolean } {
  return {
    left: x < threshold,
    right: x > docWidth - threshold,
    top: y < threshold,
    bottom: y > docHeight - threshold,
  };
}

export const MIN_CANVAS_ZOOM = 0.2;
export const MAX_CANVAS_ZOOM = 64;

export function clampZoom(
  zoom: number,
  min = MIN_CANVAS_ZOOM,
  max = MAX_CANVAS_ZOOM,
): number {
  return Math.max(min, Math.min(max, zoom));
}

export function zoomIn(zoom: number, factor = 1.25): number {
  return clampZoom(zoom * factor);
}

export function zoomOut(zoom: number, factor = 1.25): number {
  return clampZoom(zoom / factor);
}

export function fitToScreenTransform(
  areaWidth: number,
  areaHeight: number,
  docWidthPx: number,
  docHeightPx: number,
  padding = 60,
) {
  const aw = areaWidth - padding * 2;
  const ah = areaHeight - padding * 2;
  const aspect = docWidthPx / docHeightPx;
  let w: number;
  let h: number;
  if (aw / ah > aspect) {
    h = ah;
    w = h * aspect;
  } else {
    w = aw;
    h = w / aspect;
  }
  return {
    baseZoom: w / docWidthPx,
    zoom: 1,
    panX: 0,
    panY: 0,
  };
}

export function applyPanDelta(
  startPanX: number,
  startPanY: number,
  startSx: number,
  startSy: number,
  currentSx: number,
  currentSy: number,
) {
  return {
    panX: startPanX + (currentSx - startSx),
    panY: startPanY + (currentSy - startSy),
  };
}

export function massingZoomAtCursor(
  scale: number,
  deltaY: number,
  zoomInFactor = 1.08,
  zoomOutFactor = 0.93,
  min = 6,
  max = 160,
): number {
  const next = scale * (deltaY < 0 ? zoomInFactor : zoomOutFactor);
  return Math.max(min, Math.min(max, next));
}

export function zoomDisplayPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

export function isDrawTool(tool: string): boolean {
  return SKETCH_DRAW_TOOLS.has(tool);
}

export function massingToolUsesSelection(tool: string): boolean {
  return INSPECTOR_TOOLS.has(tool);
}

const UNIT_MM: Record<string, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

export function scaleLabelFromPxPerUnit(
  pxPerUnit: number,
  scaleUnit: string,
  docWidthPx: number,
  docWidthMm: number,
): string | null {
  if (!pxPerUnit || !scaleUnit || docWidthMm <= 0) return null;
  const unitInMm = UNIT_MM[scaleUnit] || 1;
  const realPerPxMm = unitInMm / pxPerUnit;
  const docPxPerMm = docWidthPx / docWidthMm;
  const ratio = realPerPxMm * docPxPerMm;
  if (!ratio || ratio <= 0) return null;
  return `1:${Math.round(ratio)}`;
}

export function pxPerUnitFromScaleLabel(
  label: string,
  docWidthPx: number,
  docWidthMm: number,
): { pxPerUnit: number; scaleUnit: string } | null {
  const m = String(label).match(/1\s*:\s*(\d+(?:\.\d+)?)/);
  if (!m || docWidthMm <= 0) return null;
  const ratio = parseFloat(m[1]);
  if (!ratio || ratio <= 0) return null;
  const docPxPerMm = docWidthPx / docWidthMm;
  return {
    pxPerUnit: (10 * docPxPerMm) / ratio,
    scaleUnit: "cm",
  };
}
