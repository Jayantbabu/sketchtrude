import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStoragePath, getSignedUrl } from "@/lib/storage";

export type StudioLayerMeta = {
  name: string;
  visible: boolean;
  opacity: number;
  trace?: number;
  blendMode?: string;
  raster_path?: string | null;
};

export type StudioDocument = {
  version: number;
  savedAt: number;
  doc: { wmm: number; hmm: number; dpi: number };
  infiniteCanvas?: boolean;
  paperBg?: string;
  grid?: { show: boolean; type?: string; spacingMM?: number };
  activeLayer?: number;
  pxPerUnit?: number | null;
  scaleUnit?: string;
  scaleLabel?: string | null;
  measurements?: unknown[];
  walls?: unknown[];
  wallsVisible?: boolean;
  shapes?: unknown[];
  masses?: unknown[];
  massBaseAnchor?: unknown;
  layers: StudioLayerMeta[];
};

export function layerRasterPath(
  userId: string,
  projectId: string,
  index: number,
): string {
  return buildStoragePath(userId, projectId, `layers/${index}.png`);
}

export async function attachLayerRasterUrls(
  supabase: SupabaseClient,
  document: StudioDocument,
): Promise<
  StudioDocument & {
    layers: Array<StudioLayerMeta & { raster_url?: string | null }>;
  }
> {
  const layers = await Promise.all(
    document.layers.map(async (layer) => {
      if (!layer.raster_path) return { ...layer, raster_url: null };
      const raster_url = await getSignedUrl("layer-rasters", layer.raster_path, 3600);
      return { ...layer, raster_url };
    }),
  );
  return { ...document, layers };
}
