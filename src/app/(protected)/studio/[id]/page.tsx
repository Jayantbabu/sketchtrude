import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudioPageClient } from "@/components/studio/StudioPageClient";

type PageProps = { params: Promise<{ id: string }> };

export default async function StudioPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    redirect("/dashboard");
  }

  return (
    <StudioPageClient
      projectId={project.id}
      projectTitle={project.title}
    />
  );
}
