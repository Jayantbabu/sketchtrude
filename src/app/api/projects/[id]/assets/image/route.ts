import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildStoragePath, getSignedUrl, uploadToStorage } from "@/lib/storage";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_IMAGE_BYTES = 100 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
]);

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
    return NextResponse.json({ error: "Missing image file" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image exceeds the 100 MiB limit" },
      { status: 413 },
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  const extension =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/avif"
          ? "avif"
          : "png";
  const storagePath = buildStoragePath(
    user.id,
    projectId,
    `images/${crypto.randomUUID()}.${extension}`,
  );
  const uploaded = await uploadToStorage(
    "user-assets",
    storagePath,
    Buffer.from(await file.arrayBuffer()),
    file.type,
  );
  if (!uploaded) {
    return NextResponse.json({ error: "Image upload failed" }, { status: 500 });
  }
  return NextResponse.json({
    storagePath: uploaded,
    signedUrl: await getSignedUrl("user-assets", uploaded, 3600),
  });
}
