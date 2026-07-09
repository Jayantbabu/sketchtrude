import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { thumbnailStoragePath } from "@/lib/projects/thumbnails";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
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
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing thumbnail file" }, { status: 400 });
  }

  const path = thumbnailStoragePath(user.id, id);
  const { error: uploadError } = await supabase.storage
    .from("thumbnails")
    .upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("projects")
    .update({ thumbnail_url: path, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("thumbnail_url")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { data: signed } = await supabase.storage
    .from("thumbnails")
    .createSignedUrl(path, 3600);

  return NextResponse.json({
    thumbnail_url: signed?.signedUrl ?? updated.thumbnail_url,
  });
}
