export type {
  BrushCategory,
  BrushEngineType,
  BrushPreset,
  DashSettings,
  PressureSettings,
  ResolvedStrokeParams,
  ScaleAwareSettings,
  StrokePoint,
  StrokeRecord,
  TextureMode,
  EraserMode,
  TipType,
} from "./types";

export {
  BUILTIN_BRUSH_PRESETS,
  BRUSH_CATEGORY_LABELS,
  BRUSH_FAMILIES,
  BRUSH_SUBFAMILIES,
  getBuiltinBrush,
} from "./presets";

export {
  BrushLibrary,
  createBrushLibrary,
} from "./library";

export {
  applyBrushToCanvasContext,
  resolveStrokeParams,
  smoothPoint,
  stabilizePoint,
  type StrokeContext,
} from "./stroke-engine";
