import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStoragePath, getSignedUrl } from "@/lib/storage";
import type { ProjectLayerKind } from "@/features/projects/domain/project-document";
import type { ScaleCalibration } from "@/lib/scale-system";

export type PdfLayerDescriptor = {
  storagePath: string | null;
  originalName: string;
  byteSize: number;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  transform: { x: number; y: number; w: number; h: number; rotation: number };
  opacity: number;
  rasterMode?: "drawing-only";
};

export type StudioLayerMeta = {
  layer_id?: string;
  name: string;
  visible: boolean;
  locked?: boolean;
  layerKind?: ProjectLayerKind;
  canvasSourceId?: string | null;
  opacity: number;
  trace?: number;
  blendMode?: string;
  raster_path?: string | null;
  pdf?: PdfLayerDescriptor | null;
  pdf_url?: string | null;
  imageReference?: {
    storagePath: string | null;
    originalName: string;
    mimeType: string;
    byteSize: number;
    pixelWidth: number;
    pixelHeight: number;
    transform: { x: number; y: number; w: number; h: number; rotation: number };
    opacity: number;
  } | null;
  image_url?: string | null;
  rendering?: {
    architecture: "hybrid-v1";
    tileSize: number;
    strokes?: unknown;
    tiles: Array<{
      key: string;
      column: number;
      row: number;
      width: number;
      height: number;
      storagePath?: string | null;
      url?: string | null;
    }>;
  } | null;
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
  scaleCalibration?: ScaleCalibration;
  pxPerUnit?: number | null;
  scaleUnit?: string;
  scaleLabel?: string | null;
  measurements?: unknown[];
  walls?: unknown[];
  wallRooms?: unknown[];
  wallsVisible?: boolean;
  shapes?: unknown[];
  masses?: unknown[];
  massBaseAnchor?: unknown;
  layers: StudioLayerMeta[];
};

/** Build the JSON-safe studio payload stored in project metadata. */
export function buildStoredStudioDocument(
  manifest: StudioDocument & { layer_count?: number },
  savedLayers: StudioDocument["layers"],
): StudioDocument {
  return {
    version: manifest.version ?? 1,
    savedAt: manifest.savedAt ?? Date.now(),
    doc: manifest.doc,
    infiniteCanvas: manifest.infiniteCanvas,
    autoExpandCanvas: false,
    paperBg: manifest.paperBg,
    grid: manifest.grid,
    activeLayer: manifest.activeLayer,
    scaleCalibration: manifest.scaleCalibration,
    pxPerUnit: manifest.pxPerUnit,
    scaleUnit: manifest.scaleUnit,
    scaleLabel: manifest.scaleLabel ?? null,
    measurements: manifest.measurements,
    walls: manifest.walls,
    wallRooms: manifest.wallRooms,
    wallsVisible: manifest.wallsVisible,
    shapes: manifest.shapes,
    masses: manifest.masses,
    massBaseAnchor: manifest.massBaseAnchor,
    layers: savedLayers,
  };
}

export function layerRasterPath(
  userId: string,
  projectId: string,
  layerId: string | number,
  version?: string,
): string {
  const safeLayerId =
    String(layerId).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 160) || "legacy";
  const safeVersion = version
    ? version.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 160)
    : null;
  const filename = safeVersion
    ? `layers/${safeLayerId}/${safeVersion}.png`
    : `layers/${safeLayerId}.png`;
  return buildStoragePath(userId, projectId, filename);
}

export function layerTilePath(
  userId: string,
  projectId: string,
  layerId: string,
  tileKey: string,
  version: string,
): string {
  const safeLayerId =
    layerId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 160) || "legacy";
  const safeTileKey =
    tileKey.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80) || "tile";
  const safeVersion =
    version.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 160) || "current";
  return buildStoragePath(
    userId,
    projectId,
    `layers/${safeLayerId}/tiles/${safeTileKey}/${safeVersion}.png`,
  );
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
      const [raster_url, pdf_url, image_url] = await Promise.all([
        layer.raster_path
          ? getSignedUrl("layer-rasters", layer.raster_path, 3600)
          : Promise.resolve(null),
        layer.pdf?.storagePath
          ? getSignedUrl("user-assets", layer.pdf.storagePath, 3600)
          : Promise.resolve(null),
        layer.imageReference?.storagePath
          ? getSignedUrl("user-assets", layer.imageReference.storagePath, 3600)
          : Promise.resolve(null),
      ]);
      const rendering = layer.rendering?.architecture === "hybrid-v1"
        ? {
            ...layer.rendering,
            tiles: await Promise.all(
              layer.rendering.tiles.map(async (tile) => ({
                ...tile,
                url: tile.storagePath
                  ? await getSignedUrl("layer-rasters", tile.storagePath, 3600)
                  : null,
              })),
            ),
          }
        : layer.rendering;
      return { ...layer, raster_url, pdf_url, image_url, rendering };
    }),
  );
  return { ...document, layers };
}
