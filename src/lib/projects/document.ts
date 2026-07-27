import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStoragePath, getSignedUrl } from "@/lib/storage";

export type PdfLayerDescriptor = {
  storagePath: string | null;
  originalName: string;
  byteSize: number;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  transform: { x: number; y: number; w: number; h: number; rotation: number };
  opacity: number;
};

export type StudioLayerMeta = {
  name: string;
  visible: boolean;
  opacity: number;
  trace?: number;
  blendMode?: string;
  raster_path?: string | null;
  pdf?: PdfLayerDescriptor | null;
  pdf_url?: string | null;
};

export type StudioDocument = {
  version: number;
  savedAt: number;
  doc: { wmm: number; hmm: number; dpi: number };
  infiniteCanvas?: boolean;
  autoExpandCanvas?: boolean;
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
    layers: Array<StudioLayerMeta & { raster_url?: string | null; pdf_url?: string | null }>;
  }
> {
  const layers = await Promise.all(
    document.layers.map(async (layer) => {
      const [raster_url, pdf_url] = await Promise.all([
        layer.raster_path
          ? getSignedUrl("layer-rasters", layer.raster_path, 3600)
          : Promise.resolve(null),
        layer.pdf?.storagePath
          ? getSignedUrl("user-assets", layer.pdf.storagePath, 3600)
          : Promise.resolve(null),
      ]);
      return { ...layer, raster_url, pdf_url };
    }),
  );
  return { ...document, layers };
}
