"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectLoader } from "@/features/projects/hooks/use-project-loader";
import type { ProjectSaveStatus } from "@/features/projects/domain/project-save-status";
import "@/styles/globals.css";

type StudioAppProps = {
  projectId: string;
  projectTitle: string;
};

function saveStatusLabel(status: ProjectSaveStatus): string {
  switch (status.state) {
    case "initializing":
    case "loading":
      return "Loading…";
    case "dirty":
      return "Unsaved changes";
    case "saving-local":
    case "saving-cloud":
      return "Saving…";
    case "saved-local":
      return "Saved locally";
    case "saved-cloud":
      return "Saved";
    case "ready-clean":
      return status.lastSavedAt ? "Saved" : "Ready";
    case "offline":
      return "Offline — changes will sync";
    case "conflict":
      return "Conflict detected";
    case "error":
      return status.recoverable ? "Save failed" : "Save failed";
    default:
      return "";
  }
}

export function StudioApp({ projectId, projectTitle }: StudioAppProps) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeShellLoaded, setIframeShellLoaded] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [modeLoading, setModeLoading] = useState(false);

  const {
    status: loadStatus,
    saveStatus,
    error: loadError,
    contentReady: sessionContentReady,
    session,
    flushSave,
  } = useProjectLoader({ projectId, iframeRef });

  useEffect(() => {
    if (sessionContentReady) setContentReady(true);
  }, [sessionContentReady]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "sketchtrude-content-ready") {
        if (data.projectId && data.projectId !== projectId) return;
        setContentReady(true);
      }
      if (data.type === "sketchtrude-mode-loading") {
        setModeLoading(!!data.loading);
      }
      if (data.type === "sketchtrude-conflict-resolve") {
        if (data.projectId && data.projectId !== projectId) return;
        const action = data.action as string | undefined;
        void (async () => {
          if (!session) return;
          if (action === "keep-local") {
            await session.resolveConflictKeepLocal();
          } else if (action === "reload-cloud") {
            await session.resolveConflictReloadFromCloud();
          }
        })();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [projectId, session]);

  // Push save status into the engine topbar (left of Draw / Navigate).
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !contentReady) return;
    const label = saveStatusLabel(saveStatus);
    win.postMessage(
      {
        type: "sketchtrude-save-status",
        projectId,
        state: saveStatus.state,
        label,
      },
      "*",
    );
  }, [saveStatus, contentReady, projectId]);

  const handleBack = useCallback(async () => {
    if (navigating) return;
    setNavigating(true);
    try {
      // Local recovery first; cloud flush is capped so Back never hangs.
      await Promise.race([
        flushSave(),
        new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
      ]);
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: "sketchtrude-save" }, "*");
        await new Promise<void>((resolve) => {
          const timeout = window.setTimeout(resolve, 2500);
          function onMessage(event: MessageEvent) {
            if (event.data?.type !== "sketchtrude-save-done") return;
            if (event.data?.projectId && event.data.projectId !== projectId) return;
            window.clearTimeout(timeout);
            window.removeEventListener("message", onMessage);
            resolve();
          }
          window.addEventListener("message", onMessage);
        });
      }
    } catch {
      /* local recovery still attempted by controller */
    }
    router.push("/dashboard");
  }, [flushSave, navigating, projectId, router]);

  const showLoading =
    !iframeShellLoaded ||
    !contentReady ||
    loadStatus === "loading" ||
    modeLoading ||
    navigating;

  const loadingMessage = useMemo(() => {
    if (navigating) return "Saving…";
    if (modeLoading) return "Switching view…";
    if (loadStatus === "error") return loadError || "Failed to load project";
    if (!iframeShellLoaded) return "Opening studio…";
    if (loadStatus === "loading" || !contentReady) return "Loading project…";
    return "Loading…";
  }, [
    contentReady,
    iframeShellLoaded,
    loadError,
    loadStatus,
    modeLoading,
    navigating,
  ]);

  return (
    <>
      <button
        type="button"
        className="studio-back-btn"
        title={`Back to projects — ${projectTitle}`}
        aria-label="Back to dashboard"
        disabled={navigating}
        onClick={handleBack}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width={20}
          height={20}
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        <span className="studio-back-label">Back</span>
      </button>

      {showLoading && (
        <div className="studio-loading" aria-busy="true">
          <div className="studio-loading-card">
            <div className="studio-loading-spinner" aria-hidden="true" />
            <p>{loadingMessage}</p>
            {loadStatus === "error" && loadError && (
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: 12 }}
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={`/engine/studio-frame.html?project=${encodeURIComponent(projectId)}`}
        title={`SketchTrude — ${projectTitle}`}
        className="studio-iframe"
        onLoad={() => setIframeShellLoaded(true)}
        allow="clipboard-read; clipboard-write"
      />
    </>
  );
}
