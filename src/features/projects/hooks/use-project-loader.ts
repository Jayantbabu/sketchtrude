"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { ProjectSaveStatus } from "@/features/projects/domain/project-save-status";
import type { LoadStatus } from "@/features/projects/application/project-load-controller";
import type { SaveOutcome } from "@/features/projects/application/project-save-controller";
import {
  createProjectSession,
  waitForEngineReady,
  type ProjectSession,
} from "@/features/projects/application/project-session";
import { useProjectAutosave } from "./use-project-autosave";

export type UseProjectLoaderOptions = {
  projectId: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  /** Wait for iframe onLoad in addition to engine-ready. Default true. */
  waitForIframeLoad?: boolean;
  enableKeyboardShortcut?: boolean;
};

export type UseProjectLoaderResult = {
  status: LoadStatus;
  saveStatus: ProjectSaveStatus;
  error: string | null;
  contentReady: boolean;
  session: ProjectSession | null;
  flushSave: () => Promise<SaveOutcome>;
  saveNow: () => Promise<SaveOutcome>;
};

/**
 * Creates adapters/repos/controllers, waits for `sketchtrude-engine-ready`,
 * runs the load controller, and exposes save helpers for StudioApp.
 */
export function useProjectLoader(
  options: UseProjectLoaderOptions,
): UseProjectLoaderResult {
  const {
    projectId,
    iframeRef,
    waitForIframeLoad = true,
    enableKeyboardShortcut = true,
  } = options;

  const sessionRef = useRef<ProjectSession | null>(null);
  const [session, setSession] = useState<ProjectSession | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [saveStatus, setSaveStatus] = useState<ProjectSaveStatus>({
    state: "initializing",
  });
  const [error, setError] = useState<string | null>(null);
  const [contentReady, setContentReady] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(!waitForIframeLoad);

  useProjectAutosave({
    saveController: session?.saveController ?? null,
    enableKeyboardShortcut,
    enabled: contentReady,
  });

  useEffect(() => {
    if (!waitForIframeLoad) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    if (iframe.contentDocument?.readyState === "complete") {
      setIframeLoaded(true);
      return;
    }

    const onLoad = () => setIframeLoaded(true);
    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [iframeRef, projectId, waitForIframeLoad]);

  useEffect(() => {
    if (!iframeLoaded) return;
    if (!iframeRef.current) return;

    let cancelled = false;
    let activeSession: ProjectSession | null = null;

    const run = async () => {
      setStatus("loading");
      setContentReady(false);
      setError(null);

      try {
        await waitForEngineReady(projectId, 30_000, iframeRef.current);

        if (cancelled) return;
        if (!iframeRef.current) {
          throw new Error("Engine iframe is not available");
        }

        activeSession = createProjectSession({
          projectId,
          iframeRef,
          onSaveStatusChange: (next) => {
            if (!cancelled) setSaveStatus(next);
          },
          onLoadStatusChange: (next) => {
            if (!cancelled) setStatus(next);
          },
        });

        sessionRef.current = activeSession;
        setSession(activeSession);

        const result = await activeSession.start();
        if (cancelled) return;

        setStatus(result.status);
        setError(result.error ?? activeSession.getError());
        setSaveStatus(activeSession.getSaveStatus());
        setContentReady(
          result.status === "ready" || result.status === "conflict",
        );
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load project";
        setError(message);
        setStatus("error");
        setContentReady(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      const toDispose = activeSession ?? sessionRef.current;
      sessionRef.current = null;
      setSession(null);
      void toDispose?.dispose();
    };
  }, [iframeLoaded, iframeRef, projectId]);

  const flushSave = useCallback(async (): Promise<SaveOutcome> => {
    const current = sessionRef.current;
    if (!current) {
      return {
        ok: false,
        local: false,
        cloud: false,
        error: "Project session is not ready",
        recoverable: false,
      };
    }
    return current.flushSave();
  }, []);

  const saveNow = useCallback(async (): Promise<SaveOutcome> => {
    const current = sessionRef.current;
    if (!current) {
      return {
        ok: false,
        local: false,
        cloud: false,
        error: "Project session is not ready",
        recoverable: false,
      };
    }
    return current.saveNow("manual");
  }, []);

  return {
    status,
    saveStatus,
    error,
    contentReady,
    session,
    flushSave,
    saveNow,
  };
}
