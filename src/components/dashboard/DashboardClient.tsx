"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";
import type { PaperTemplate } from "@/lib/paper-templates";
import { NewProjectModal } from "@/components/dashboard/NewProjectModal";
import { ProjectThumbnail } from "@/components/dashboard/ProjectThumbnail";
import {
  savePendingCanvasSource,
  type CanvasSourceSelection,
} from "@/lib/projects/pending-canvas-source";

export function DashboardClient({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [loading, setLoading] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  async function handleCreateProject(
    template: PaperTemplate,
    title: string,
    source: CanvasSourceSelection | null,
  ) {
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          doc_width_mm: source?.docWidthMm ?? template.doc_width_mm,
          doc_height_mm: source?.docHeightMm ?? template.doc_height_mm,
          doc_dpi: source?.dpi ?? template.doc_dpi,
          scale_label: template.scale_label ?? null,
          metadata: {
            ...(source
              ? {
                  template: "imported-canvas",
                  paper_bg: "#ffffff",
                  canvas_source: {
                    source_id: source.sourceId,
                    kind: source.kind,
                    name: source.file.name,
                    mime_type: source.file.type,
                    page_number: source.pageNumber,
                    page_count: source.pageCount,
                    width_px: source.widthPx,
                    height_px: source.heightPx,
                  },
                }
              : template.metadata),
            infinite_canvas: source ? false : !!template.infinite_canvas,
            auto_expand: false,
          },
        }),
      });
      const project = await res.json();
      if (!res.ok || !project.id) {
        throw new Error(project.error || "Project creation failed");
      }
      if (source) {
        await savePendingCanvasSource(project.id, source);
      }
      setShowNewProject(false);
      router.push(`/studio/${project.id}`);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Project creation failed",
      );
    } finally {
      setLoading(false);
    }
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
    router.replace("/");
  }

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
      {showNewProject ? (
        <NewProjectModal
          open
          loading={loading}
          onClose={() => setShowNewProject(false)}
          onCreate={handleCreateProject}
        />
      ) : null}
    </div>
  );
}
