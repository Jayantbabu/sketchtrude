/** Core runtime types for the studio engine (expanded as modules are typed). */

export type DocConfig = {
  wMM: number;
  hMM: number;
  dpi: number;
  wPx: number;
  hPx: number;
};

export type StudioMode = "draw" | "navigate";

export type Point2 = { x: number; y: number };

/** Vector-entity snapshot shared by undo entries and `vectorSnapshot()`. */
export type VectorEntitySnapshot = {
  walls: Wall[];
  wallRooms?: WallRoom[];
  shapes: Shape[];
  measurements: Measurement[];
};

/** Raster stroke/op undo: ImageData region at (x, y). */
export type RegionHistoryEntry = {
  x: number;
  y: number;
  before: ImageData;
  after: ImageData;
  vector?: undefined;
};

/** Vector-entity undo interleaved on the same layer history stack. */
export type VectorHistoryEntry = {
  vector: {
    before: VectorEntitySnapshot;
    after: VectorEntitySnapshot;
  };
  x?: number;
  y?: number;
  before?: ImageData;
  after?: ImageData;
};

export type HistoryEntry = RegionHistoryEntry | VectorHistoryEntry;

/** 2D plan opening on a wall polyline segment. */
export type Opening2D = {
  kind: string;
  seg?: number;
  t?: number;
  wMM?: number;
  hMM?: number;
  sillMM?: number;
  hand?: number;
  swing?: number;
  [key: string]: unknown;
};

/** 3D massing opening along a wall face (u in 0..1). */
export type Opening3D = {
  kind: string;
  u?: number;
  w?: number;
  h?: number;
  sill?: number;
  [key: string]: unknown;
};

export type Opening = Opening2D | Opening3D;

export type Wall = {
  id?: string;
  pts: Point2[];
  thickMM?: number;
  heightM?: number;
  openings?: Opening2D[];
  /** Signed circular-arc sagitta in doc px; 0/undefined = straight. */
  bulge?: number;
  roomId?: string | null;
  name?: string;
  visible?: boolean;
  [key: string]: unknown;
};

/** Closed loop of independent wall segments detected by the wall graph. */
export type WallRoom = {
  id: string;
  name: string;
  wallIds: string[];
  areaPx2: number;
};

export type Shape = {
  id?: string;
  kind?: string;
  pts?: Point2[];
  closed?: boolean;
  stroke?: string;
  width?: number;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  fill?: string | null;
  [key: string]: unknown;
};

export type Measurement = {
  type?: string;
  name?: string;
  label?: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  points?: Point2[];
  [key: string]: unknown;
};

/** 3D mass: box `{x,z,w,d,h}` or prism `{poly,h}` (plus wall-derived fields). */
export type Mass = {
  x?: number;
  z?: number;
  w?: number;
  d?: number;
  h?: number;
  poly?: Array<{ x: number; z: number }>;
  rot?: number;
  openings?: Opening3D[];
  _wall?: boolean;
  _fromWall?: boolean;
  _wallKey?: string;
  [key: string]: unknown;
};

/** Lightweight brush / preset shape used by app state (full preset lives in brushes/). */
export type BrushPreset = {
  id: string;
  name: string;
  size: number;
  opacity: number;
  tipType?: string;
  category?: string;
  engineType?: string;
  kind?: "draw" | "erase" | "smudge" | string;
  spacing?: number;
  hardness?: number;
  blend?: string;
  maxSize?: number;
  builtIn?: boolean;
  family?: string;
  [key: string]: unknown;
};

export type Brush = BrushPreset;

export type EngineLayer = {
  id: number | string;
  engineId?: string;
  name: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  imageCanvas?: HTMLCanvasElement;
  imageCtx?: CanvasRenderingContext2D;
  visible: boolean;
  opacity: number;
  trace: number;
  blendMode: string;
  history: HistoryEntry[];
  redo: HistoryEntry[];
  _cur?: ImageData | null;
  _dirty?: boolean;
  _savedBlob?: Blob | null;
  image?: HTMLImageElement | null;
  imageSource?: string | null;
  imageTransform?: {
    x: number;
    y: number;
    w: number;
    h: number;
    rotation: number;
  } | null;
  imageOpacity?: number;
  imageCrop?: { x: number; y: number; w: number; h: number } | null;
  imageBaked?: boolean;
  imageManipulating?: boolean;
  locked?: boolean;
  /** Legacy migration fields; `any` keeps converted modules compiling under strict. */
  [key: string]: any;
};

export type EngineState = {
  mode: StudioMode;
  tool: string;
  color: string;
  size: number;
  alpha: number;
  layers: EngineLayer[];
  activeLayer: number;
  zoom: number;
  panX: number;
  panY: number;
  baseZoom: number;
  drawing: boolean;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  lastStampX: number;
  lastStampY: number;
  stampAccum: number;
  snapshot: ImageData | null;
  pxPerUnit: number | null;
  scaleUnit: string;
  measurements: Measurement[];
  showGrid: boolean;
  gridType: string;
  gridSpacingMM: number;
  snapEnabled: boolean;
  walls: Wall[];
  wallsVisible: boolean;
  wallRooms: WallRoom[];
  wallChainEnd: Point2 | null;
  wallDrag: { start: Point2; current: Point2; shift?: boolean } | null;
  shapes: Shape[];
  wallThickMM: number;
  wallHeightM: number;
  openingKind: string;
  doorWMM: number;
  doorHMM: number;
  winWMM: number;
  winHMM: number;
  winSillMM: number;
  openWMM: number;
  openHMM: number;
  selOpening2D: { wi: number; idx: number } | null;
  gridMajor: number;
  gridOpacity: number;
  showMeasurements: boolean;
  pendingScale: boolean;
  pendingScaleStart: Point2 | null;
  pendingScaleEnd: Point2 | null;
  selectedStencil: unknown;
  customStencils: unknown[];
  customHatches: unknown[];
  fillStyle: string;
  fillTextures: unknown[];
  fillTexIndex: number | null;
  fillTexMode: string;
  fillTexScale: number;
  stencilCat: string;
  customBrushes: Brush[];
  activeBrush: Brush | null;
  tipImageCache: Record<string, HTMLImageElement | HTMLCanvasElement>;
  cropMode: boolean;
  replaceImageInLayer: unknown;
  eyedropperActive: boolean;
  stabilizer: number;
  smoothedX: number;
  smoothedY: number;
  velocity: number;
  strokeAge: number;
  usingBuffer: boolean;
  isPanning: boolean;
  pinchStart: unknown;
  infiniteCanvas: boolean;
  autoExpandCanvas: boolean;
  symmetryAxis: string | null;
  paperBg: string;
  lineDrag: unknown;
  /** Allow legacy modules to attach extra fields during migration. */
  [key: string]: any;
};

export type DomRefs = {
  paper: HTMLElement;
  stage: HTMLElement;
  area: HTMLElement;
  bgImg: HTMLImageElement | null;
  layersList: HTMLElement;
  rulerOverlay: HTMLElement;
  colorPopover: HTMLElement | null;
  stencilPopover: HTMLElement | null;
  hintEl: HTMLElement | null;
  fileInputImportImage: HTMLInputElement | null;
  fileInputStencil: HTMLInputElement | null;
  /** Created in viewport init; not always present on DomRefs from initDom. */
  fileInputHatch?: HTMLInputElement | null;
  scalePrompt: HTMLElement | null;
  imgOverlay: HTMLElement | null;
};

/**
 * Known members of the classic shared bag `S`.
 * Index signature keeps migration flexible; named fields document the contract.
 */
export interface EngineScope {
  state: EngineState;
  doc: DocConfig;
  syncDocPx: () => void;
  dom?: DomRefs;
  layerEngine?: any;
  __ix?: any;
  __layersApi?: any;
  brushes?: any;
  helpers?: any;
  massing?: any;
  gridCanvas?: HTMLCanvasElement | null;
  gridCtx?: CanvasRenderingContext2D | null;
  fileInputHatch?: HTMLInputElement | null;
  // Common methods are assigned by init modules; index signature types them as `any`
  // so call sites need no non-null assertions during migration.
  [key: string]: any;
}
