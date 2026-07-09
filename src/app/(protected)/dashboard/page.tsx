import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { attachThumbnailUrls } from "@/lib/projects/thumbnails";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const withThumbs = await attachThumbnailUrls(supabase, projects ?? []);

  return <DashboardClient initialProjects={withThumbs} />;
}
