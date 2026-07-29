import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { layerTilePath } from "@/lib/projects/document";
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

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const layerId = formData?.get("layer_id");
  const key = formData?.get("tile_key");
  const file = formData?.get("tile");
  if (
    typeof layerId !== "string" ||
    !/^[A-Za-z0-9_-]{1,160}$/.test(layerId) ||
    typeof key !== "string" ||
    !/^[A-Za-z0-9:_-]{1,80}$/.test(key)
  ) {
    return NextResponse.json(
      { error: "Missing or invalid layer/tile id" },
      { status: 400 },
    );
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing tile" }, { status: 400 });
  }

  const storagePath = layerTilePath(
    user.id,
    projectId,
    layerId,
    key,
    crypto.randomUUID(),
  );
  const uploaded = await uploadToStorage(
    "layer-rasters",
    storagePath,
    Buffer.from(await file.arrayBuffer()),
    file.type || "image/png",
  );
  if (!uploaded) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
  return NextResponse.json({
    storage_path: uploaded,
    layer_id: layerId,
    tile_key: key,
  });
}
