import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildStoragePath, getSignedUrl, uploadToStorage } from "@/lib/storage";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_PDF_BYTES = 50 * 1024 * 1024;

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

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing PDF file" }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "PDF exceeds the 50 MiB limit" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    return NextResponse.json({ error: "Invalid PDF file" }, { status: 400 });
  }

  const storagePath = buildStoragePath(
    user.id,
    projectId,
    `pdf/${crypto.randomUUID()}.pdf`,
  );
  const uploaded = await uploadToStorage(
    "user-assets",
    storagePath,
    buffer,
    "application/pdf",
  );
  if (!uploaded) {
    return NextResponse.json({ error: "PDF upload failed" }, { status: 500 });
  }

  const signedUrl = await getSignedUrl("user-assets", uploaded, 3600);
  return NextResponse.json({ storagePath: uploaded, signedUrl });
}
