import { createClient } from "@/lib/supabase/server";

export type StorageBucket =
  | "layer-rasters"
  | "exports"
  | "thumbnails"
  | "user-assets";

export function buildStoragePath(
  userId: string,
  projectId: string,
  filename: string
): string {
  return `${userId}/${projectId}/${filename}`;
}

export async function uploadToStorage(
  bucket: StorageBucket,
  path: string,
  file: Blob | Buffer,
  contentType: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType });

  if (error) {
    console.error("Storage upload error:", error);
    return null;
  }

  return data.path;
}

export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresIn = 3600
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error("Signed URL error:", error);
    return null;
  }

  return data.signedUrl;
}

export async function deleteFromStorage(
  bucket: StorageBucket,
  paths: string[]
): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from(bucket).remove(paths);
}
