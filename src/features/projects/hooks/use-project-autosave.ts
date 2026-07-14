"use client";

import { useEffect, useEffectEvent } from "react";
import type { ProjectSaveController } from "@/features/projects/application/project-save-controller";

export type UseProjectAutosaveOptions = {
  saveController: ProjectSaveController | null | undefined;
  /** Bind Ctrl/Cmd+S. Default true. */
  enableKeyboardShortcut?: boolean;
  enabled?: boolean;
};

/**
 * Manual save shortcut (Ctrl/Cmd+S). Autosave itself is owned by the controller.
 */
export function useProjectAutosave(
  options: UseProjectAutosaveOptions,
): void {
  const {
    saveController,
    enableKeyboardShortcut = true,
    enabled = true,
  } = options;

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!enabled || !saveController || !enableKeyboardShortcut) return;
    const isSaveChord =
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      event.key.toLowerCase() === "s";
    if (!isSaveChord) return;
    event.preventDefault();
    void saveController.saveNow("manual");
  });

  useEffect(() => {
    if (!enabled || !enableKeyboardShortcut || !saveController) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, enableKeyboardShortcut, saveController]);
}
