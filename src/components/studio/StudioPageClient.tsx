"use client";

import dynamic from "next/dynamic";
import { StudioErrorBoundary } from "@/components/studio/StudioErrorBoundary";

const StudioApp = dynamic(
  () => import("@/components/studio/StudioApp").then((mod) => mod.StudioApp),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--paper-bg)",
        }}
      >
        <p style={{ fontWeight: 600, color: "var(--muted)" }}>Loading studio…</p>
      </div>
    ),
  }
);

type StudioPageClientProps = {
  projectId: string;
  projectTitle: string;
};

export function StudioPageClient({
  projectId,
  projectTitle,
}: StudioPageClientProps) {
  return (
    <StudioErrorBoundary>
      <StudioApp projectId={projectId} projectTitle={projectTitle} />
    </StudioErrorBoundary>
  );
}
