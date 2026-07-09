export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  title: string;
  doc_width_mm: number;
  doc_height_mm: number;
  doc_dpi: number;
  scale_ratio: number | null;
  scale_label: string | null;
  metadata: Record<string, unknown>;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Layer = {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blend_mode: string;
  trace_tint: number;
  raster_url: string | null;
  vector_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ExportRecord = {
  id: string;
  project_id: string;
  user_id: string;
  file_url: string;
  file_size_bytes: number | null;
  created_at: string;
};

export type UserAsset = {
  id: string;
  user_id: string;
  asset_type: "stencil" | "brush" | "hatch" | "fill_texture";
  name: string;
  file_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type StudioMode = "draw" | "navigate";

export type StudioTool =
  | "pen"
  | "marker"
  | "pencil"
  | "brush"
  | "watercolour"
  | "eraser"
  | "brushes"
  | "line"
  | "rect"
  | "circle"
  | "ruler"
  | "stencil"
  | "area"
  | "wall"
  | "opening"
  | "fill"
  | "wand"
  | "lasso"
  | "hatch"
  | "massing";
