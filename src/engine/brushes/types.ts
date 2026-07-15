/**
 * Sketchtrude pen & brush system — data-driven presets.
 * Technical pens prioritize scale/snap/export; artistic brushes prioritize pressure/texture.
 */

export type BrushCategory =
  | "technical"
  | "pencil"
  | "ink"
  | "marker"
  | "paint"
  | "watercolor"
  | "airbrush"
  | "dry-media"
  | "texture"
  | "landscape"
  | "effects"
  | "blend"
  | "eraser"
  | "architectural"
  | "imported"
  | "user";

export type BrushEngineType =
  | "standard"
  | "technical"
  | "marker"
  | "watercolor"
  | "paint"
  | "texture"
  | "smudge"
  | "eraser"
  | "roller"
  | "stamp";

export type TipType = "round" | "soft" | "texture" | "chisel" | "flat";

export type PressureSettings = {
  size: number;
  opacity: number;
  flow: number;
  textureDepth?: number;
};

export type ScaleAwareSettings = {
  enabled: boolean;
  /** Document line weight in mm when scale-aware. */
  lineWeightMm?: number;
  class?:
    | "extra-fine"
    | "fine"
    | "medium"
    | "heavy"
    | "extra-heavy"
    | "automatic";
};

export type DashSettings = {
  enabled: boolean;
  pattern: "dashed" | "centerline" | "custom";
  dashMm?: number;
  gapMm?: number;
};

/** Runtime-compatible brush used by the canvas stroke path. */
export type BrushPreset = {
  id: string;
  name: string;
  category: BrushCategory;
  engineType: BrushEngineType;
  tipType: TipType;
  tipImage?: string | null;
  size: number;
  opacity: number;
  flow: number;
  spacing: number;
  hardness: number;
  pressureSize: number;
  pressureOpacity: number;
  pressureFlow?: number;
  jitter: number;
  blend: string;
  maxSize: number;
  kind: "draw" | "erase" | "smudge";
  smoothing: number;
  stabilization: number;
  scaleAware?: ScaleAwareSettings;
  dash?: DashSettings;
  family?: string;
  builtIn: boolean;
  favorite?: boolean;
  source: "built-in" | "user-created" | "imported";
  version?: number;
  grain?: "fine" | "coarse";
  createdAt?: string;
  updatedAt?: string;
};

export type StrokePoint = {
  x: number;
  y: number;
  pressure: number;
  tiltX?: number;
  tiltY?: number;
  twist?: number;
  t: number;
};

export type StrokeRecord = {
  id: string;
  brushId: string;
  brushVersion: number;
  color: string;
  size: number;
  opacity: number;
  layerId: string;
  points: StrokePoint[];
  createdAt: string;
};

export type ResolvedStrokeParams = {
  lineWidth: number;
  alpha: number;
  flow: number;
  blend: string;
  composite: GlobalCompositeOperation | string;
  spacing: number;
  useBuffer: boolean;
};
