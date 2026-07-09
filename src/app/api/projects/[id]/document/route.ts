import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  attachLayerRasterUrls,
  layerRasterPath,
  type StudioDocument,
} from "@/lib/projects/document";
import { uploadToStorage } from "@/lib/storage";

type RouteContext = { params: Promise<{ id: string }> };

export const maxDuration = 60;

function readStudioDocument(metadata: Record<string, unknown> | null | undefined) {
  const doc = metadata?.studio_document;
  if (!doc || typeof doc !== "object") return null;
  return doc as StudioDocument;
}

function buildStudioDocument(
  manifest: StudioDocument & { layer_count?: number },
  savedLayers: StudioDocument["layers"],
): StudioDocument {
  return {
    version: manifest.version ?? 1,
    savedAt: manifest.savedAt ?? Date.now(),
    doc: manifest.doc,
    infiniteCanvas: manifest.infiniteCanvas,
    autoExpandCanvas: manifest.autoExpandCanvas,
    paperBg: manifest.paperBg,
    grid: manifest.grid,
    activeLayer: manifest.activeLayer,
    pxPerUnit: manifest.pxPerUnit,
    scaleUnit: manifest.scaleUnit,
    scaleLabel: manifest.scaleLabel,
    measurements: manifest.measurements,
    walls: manifest.walls,
    wallsVisible: manifest.wallsVisible,
    shapes: manifest.shapes,
    masses: manifest.masses,
    massBaseAnchor: manifest.massBaseAnchor,
    layers: savedLayers,
  };
}

async function parseManifest(request: Request): Promise<{
  manifest: StudioDocument & { layer_count?: number };
  files: Map<number, Blob>;
} | null> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return null;
    return {
      manifest: body as StudioDocument & { layer_count?: number },
      files: new Map(),
    };
  }

  const formData = await request.formData();
  const manifestRaw = formData.get("manifest");
  if (typeof manifestRaw !== "string") return null;

  let manifest: StudioDocument & { layer_count?: number };
  try {
    manifest = JSON.parse(manifestRaw) as StudioDocument & { layer_count?: number };
  } catch {
    return null;
  }

  const files = new Map<number, Blob>();
  const layerCount = manifest.layer_count ?? manifest.layers?.length ?? 0;
  for (let i = 0; i < layerCount; i++) {
    const file = formData.get(`layer_${i}`);
    if (file instanceof Blob && file.size > 0) files.set(i, file);
  }

  return { manifest, files };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("metadata")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const metadata = (project.metadata || {}) as Record<string, unknown>;
  const studioDoc = readStudioDocument(metadata);
  if (!studioDoc?.layers?.length) {
    return NextResponse.json(null);
  }

  const withUrls = await attachLayerRasterUrls(supabase, studioDoc);
  return NextResponse.json(withUrls);
}

export async function PUT(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, metadata")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = await parseManifest(request);
  if (!parsed) {
    return NextResponse.json({ error: "Missing or invalid manifest" }, { status: 400 });
  }

  const { manifest, files } = parsed;
  const layerCount = manifest.layer_count ?? manifest.layers?.length ?? 0;
  const savedLayers = [];

  for (let i = 0; i < layerCount; i++) {
    const meta = manifest.layers?.[i];
    let raster_path = meta?.raster_path ?? null;
    const file = files.get(i);

    if (file) {
      raster_path = layerRasterPath(user.id, projectId, i);
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploaded = await uploadToStorage(
        "layer-rasters",
        raster_path,
        buffer,
        file.type || "image/png",
      );
      if (!uploaded) {
        return NextResponse.json({ error: "Layer upload failed" }, { status: 500 });
      }
    }

    savedLayers.push({
      name: meta?.name || `Layer ${i + 1}`,
      visible: meta?.visible !== false,
      opacity: meta?.opacity ?? 1,
      trace: meta?.trace ?? 0,
      blendMode: meta?.blendMode || "source-over",
      raster_path,
    });
  }

  const studio_document = buildStudioDocument(manifest, savedLayers);

  const existingMeta = (project.metadata || {}) as Record<string, unknown>;
  const nextMetadata = {
    ...existingMeta,
    studio_document,
  };

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      metadata: nextMetadata,
      doc_width_mm: manifest.doc?.wmm,
      doc_height_mm: manifest.doc?.hmm,
      doc_dpi: manifest.doc?.dpi,
      scale_label: manifest.scaleLabel || undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, savedAt: studio_document.savedAt });
}
