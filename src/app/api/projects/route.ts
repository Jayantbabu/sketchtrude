import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { attachThumbnailUrls } from "@/lib/projects/thumbnails";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const projects = await attachThumbnailUrls(supabase, data ?? []);
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title = (body.title as string) || "Untitled";

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      title,
      doc_width_mm: body.doc_width_mm ?? 420,
      doc_height_mm: body.doc_height_mm ?? 297,
      doc_dpi: body.doc_dpi ?? 150,
      scale_label: body.scale_label ?? null,
      metadata: {
        ...(body.metadata ?? {}),
        auto_expand: false,
      },
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create default layer
  await supabase.from("layers").insert({
    project_id: data.id,
    name: "Layer 1",
    sort_order: 0,
  });

  return NextResponse.json(data, { status: 201 });
}
