"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";
import type { PaperTemplate } from "@/lib/paper-templates";
import { NewProjectModal } from "@/components/dashboard/NewProjectModal";
import { ProjectThumbnail } from "@/components/dashboard/ProjectThumbnail";

export function DashboardClient({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [loading, setLoading] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  async function handleCreateProject(template: PaperTemplate, title: string) {
    setLoading(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        doc_width_mm: template.doc_width_mm,
        doc_height_mm: template.doc_height_mm,
        doc_dpi: template.doc_dpi,
        scale_label: template.scale_label ?? null,
        metadata: {
          ...template.metadata,
          infinite_canvas: !!template.infinite_canvas,
          auto_expand: false,
        },
      }),
    });
    const project = await res.json();
    if (project.id) {
      router.push(`/studio/${project.id}`);
    }
    setLoading(false);
    setShowNewProject(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this project?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  function openProject(id: string) {
    if (openingId) return;
    setOpeningId(id);
    router.push(`/studio/${id}`);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const refreshProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const data = await res.json();
      setProjects(data);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/logo.png" alt="SketchTrude" width={32} height={32} />
          <h1>My Projects</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn-primary"
            onClick={() => setShowNewProject(true)}
            disabled={loading}
          >
            {loading ? "Creating…" : "+ New Project"}
          </button>
          <button className="btn-ghost" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", color: "var(--muted)" }}>
          <p style={{ marginBottom: 16 }}>No projects yet. Create your first sketch.</p>
          <button className="btn-primary" onClick={() => setShowNewProject(true)}>
            + New Project
          </button>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map((project) => (
            <article key={project.id} className="project-card">
              <button
                type="button"
                className="project-open-area"
                onClick={() => openProject(project.id)}
                disabled={openingId === project.id}
              >
                <div className="project-thumb">
                  <ProjectThumbnail
                    projectId={project.id}
                    remoteUrl={project.thumbnail_url}
                    title={project.title}
                  />
                </div>
                <div className="project-body">
                  <h3>{project.title}</h3>
                  <p className="project-meta">
                    {new Date(project.updated_at).toLocaleDateString()} ·{" "}
                    {project.scale_label || "Scale unset"}
                  </p>
                </div>
              </button>
              <div className="project-actions">
                <button
                  type="button"
                  className="btn-primary project-action-open"
                  onClick={() => openProject(project.id)}
                  disabled={openingId === project.id}
                >
                  {openingId === project.id ? "Opening…" : "Open"}
                </button>
                <button
                  type="button"
                  className="btn-ghost project-action-delete"
                  onClick={() => handleDelete(project.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <NewProjectModal
        open={showNewProject}
        loading={loading}
        onClose={() => setShowNewProject(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}
