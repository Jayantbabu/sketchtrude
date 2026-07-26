/**
 * Shared mutable scope for the classic engine modules.
 * Modules assign functions/values onto S; boot wires cores then runs inits.
 */
import type { EngineState, DocConfig, EngineScope } from "./types";

function computePx(wMM: number, hMM: number, dpi: number) {
  return {
    wPx: Math.round((wMM / 25.4) * dpi),
    hPx: Math.round((hMM / 25.4) * dpi),
  };
}

const initial = computePx(420, 297, 150);

export const doc: DocConfig = {
  wMM: 420,
  hMM: 297,
  dpi: 150,
  wPx: initial.wPx,
  hPx: initial.hPx,
};

export function syncDocPx() {
  const px = computePx(doc.wMM, doc.hMM, doc.dpi);
  doc.wPx = px.wPx;
  doc.hPx = px.hPx;
}

/** Runtime engine state (typed progressively). */
export const state: EngineState = {
  mode: "draw",
  tool: "pen",
  color: "#0a0a0a",
  size: 2,
  alpha: 1.0,
  layers: [],
  activeLayer: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  baseZoom: 1,
  drawing: false,
  lastX: 0,
  lastY: 0,
  startX: 0,
  startY: 0,
  lastStampX: 0,
  lastStampY: 0,
  stampAccum: 0,
  snapshot: null,
  pxPerUnit: null,
  scaleUnit: "cm",
  measurements: [],
  showGrid: false,
  gridType: "square",
  gridSpacingMM: 20,
  snapEnabled: true,
  walls: [],
  wallsVisible: true,
  wallRooms: [],
  wallChainEnd: null,
  wallDrag: null,
  shapes: [],
  wallThickMM: 230,
  wallHeightM: 3,
  openingKind: "door",
  doorWMM: 900,
  doorHMM: 2100,
  winWMM: 1200,
  winHMM: 1200,
  winSillMM: 900,
  openWMM: 900,
  openHMM: 2100,
  selOpening2D: null,
  gridMajor: 5,
  gridOpacity: 0.45,
  showMeasurements: true,
  pendingScale: false,
  pendingScaleStart: null,
  pendingScaleEnd: null,
  selectedStencil: null,
  customStencils: [],
  customHatches: [],
  fillStyle: "color",
  fillTextures: [],
  fillTexIndex: null,
  fillTexMode: "tile",
  fillTexScale: 1.0,
  stencilCat: "builtin",
  customBrushes: [],
  activeBrush: null,
  tipImageCache: {},
  cropMode: false,
  replaceImageInLayer: null,
  eyedropperActive: false,
  stabilizer: 0.3,
  smoothedX: 0,
  smoothedY: 0,
  velocity: 0,
  strokeAge: 0,
  usingBuffer: false,
  isPanning: false,
  pinchStart: null,
  infiniteCanvas: false,
  autoExpandCanvas: false,
  symmetryAxis: null,
  paperBg: "#ffffff",
  lineDrag: null,
};

/**
 * Classic global bag. Modules hoist top-level bindings onto S so cross-file
 * calls behave like the original single-script scope.
 * Index signature on EngineScope keeps assigning init functions type-safe enough.
 */
export const S: EngineScope = {
  state,
  doc,
  syncDocPx,
};
