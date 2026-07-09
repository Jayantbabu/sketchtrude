import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildStoragePath,
  uploadToStorage,
} from "@/lib/storage";

type RouteContext = { params: Promise<{ id: string }> };

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
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const layerId = formData.get("layer_id") as string;
  const name = (formData.get("name") as string) || "Layer";
  const sortOrder = parseInt((formData.get("sort_order") as string) || "0", 10);
  const raster = formData.get("raster") as File | null;
  const vectorData = formData.get("vector_data") as string | null;

  let rasterUrl: string | null = null;

  if (raster) {
    const path = buildStoragePath(
      user.id,
      projectId,
      `${layerId || crypto.randomUUID()}.png`
    );
    const buffer = Buffer.from(await raster.arrayBuffer());
    const uploaded = await uploadToStorage(
      "layer-rasters",
      path,
      buffer,
      "image/png"
    );
    rasterUrl = uploaded;
  }

  const layerPayload = {
    project_id: projectId,
    name,
    sort_order: sortOrder,
    visible: formData.get("visible") !== "false",
    locked: formData.get("locked") === "true",
    opacity: parseFloat((formData.get("opacity") as string) || "1"),
    blend_mode: (formData.get("blend_mode") as string) || "source-over",
    trace_tint: parseFloat((formData.get("trace_tint") as string) || "0"),
    raster_url: rasterUrl,
    vector_data: vectorData ? JSON.parse(vectorData) : {},
  };

  const { data, error } = layerId
    ? await supabase
        .from("layers")
        .update(layerPayload)
        .eq("id", layerId)
        .select()
        .single()
    : await supabase.from("layers").insert(layerPayload).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
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

  const { data, error } = await supabase
    .from("layers")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
