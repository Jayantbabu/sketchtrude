import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildStoragePath, uploadToStorage } from "@/lib/storage";

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
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const exportId = crypto.randomUUID();
  const path = buildStoragePath(user.id, projectId, `export-${exportId}.png`);
  const buffer = Buffer.from(await file.arrayBuffer());

  const uploadedPath = await uploadToStorage(
    "exports",
    path,
    buffer,
    "image/png"
  );

  if (!uploadedPath) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("exports")
    .insert({
      project_id: projectId,
      user_id: user.id,
      file_url: uploadedPath,
      file_size_bytes: buffer.length,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
