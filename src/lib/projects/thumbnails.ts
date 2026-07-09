import type { SupabaseClient } from "@supabase/supabase-js";
import type { Project } from "@/lib/types";
import { buildStoragePath } from "@/lib/storage";

export function thumbnailStoragePath(
  userId: string,
  projectId: string,
): string {
  return buildStoragePath(userId, projectId, "preview.jpg");
}

export async function attachThumbnailUrls(
  supabase: SupabaseClient,
  projects: Project[],
): Promise<Project[]> {
  return Promise.all(
    projects.map(async (project) => {
      const path = project.thumbnail_url;
      if (!path || path.startsWith("http")) return project;

      const { data, error } = await supabase.storage
        .from("thumbnails")
        .createSignedUrl(path, 3600);

      if (error || !data?.signedUrl) return { ...project, thumbnail_url: null };

      return { ...project, thumbnail_url: data.signedUrl };
    }),
  );
}
