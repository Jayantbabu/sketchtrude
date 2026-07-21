import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { layerRasterPath } from "@/lib/projects/document";
import { uploadToStorage } from "@/lib/storage";

type RouteContext = { params: Promise<{ id: string }> };

export const maxDuration = 60;

export async function POST(request: Request, context: RouteContext) {
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
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to parse multipart body";
    console.error("[document/layer] formData parse failed:", message);
    return NextResponse.json(
      { error: "Invalid multipart body", detail: message },
      { status: 400 },
    );
  }
  const indexRaw = formData.get("layer_index");
  const layerIndex = Number(indexRaw);
  const file = formData.get("raster");

  if (!Number.isFinite(layerIndex) || layerIndex < 0) {
    return NextResponse.json({ error: "Invalid layer_index" }, { status: 400 });
  }

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing raster" }, { status: 400 });
  }

  const raster_path = layerRasterPath(user.id, projectId, layerIndex);
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadToStorage(
    "layer-rasters",
    raster_path,
    buffer,
    file.type || "image/png",
  );

  if (!uploaded) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  return NextResponse.json({ raster_path: uploaded, layer_index: layerIndex });
}
