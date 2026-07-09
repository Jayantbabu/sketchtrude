"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "@/styles/globals.css";

type StudioAppProps = {
  projectId: string;
  projectTitle: string;
};

function waitForStudioSave(projectId: string, iframe: HTMLIFrameElement) {
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve();
    }, 10000);

    function onMessage(event: MessageEvent) {
      if (event.data?.type !== "sketchtrude-save-done") return;
      if (event.data?.projectId && event.data.projectId !== projectId) return;
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      resolve();
    }

    window.addEventListener("message", onMessage);
    iframe.contentWindow?.postMessage({ type: "sketchtrude-save" }, "*");
  });
}

export function StudioApp({ projectId, projectTitle }: StudioAppProps) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const handleBack = useCallback(async () => {
    if (navigating) return;
    setNavigating(true);

    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      await waitForStudioSave(projectId, iframe);
    }

    router.push("/dashboard");
  }, [navigating, projectId, router]);

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
      </button>

      {!loaded && (
        <div className="studio-loading">
          <p>Loading studio…</p>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={`/engine/studio-frame.html?project=${encodeURIComponent(projectId)}`}
        title={`SketchTrude — ${projectTitle}`}
        className="studio-iframe"
        onLoad={() => setLoaded(true)}
        allow="clipboard-read; clipboard-write"
      />
    </>
  );
}
