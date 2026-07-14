"use client";

import { useEffect, useState } from "react";
import type { ProjectSaveStatus } from "@/features/projects/domain/project-save-status";
import type { ProjectSaveController } from "@/features/projects/application/project-save-controller";

/**
 * Subscribe to a ProjectSaveController's status for UI badges / labels.
 */
export function useProjectSaveStatus(
  controller: ProjectSaveController | null | undefined,
): ProjectSaveStatus {
  const [status, setStatus] = useState<ProjectSaveStatus>(
    () => controller?.getStatus() ?? { state: "initializing" },
  );

  useEffect(() => {
    if (!controller) {
      setStatus({ state: "initializing" });
      return;
    }
    setStatus(controller.getStatus());
    return controller.subscribe(setStatus);
  }, [controller]);

  return status;
}
