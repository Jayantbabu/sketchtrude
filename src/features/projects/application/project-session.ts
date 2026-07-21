import type { RefObject } from "react";
import { LegacyEngineDocumentAdapter } from "@/engine/document/legacy-engine-document-adapter";
import type { EngineDocumentAdapter } from "@/engine/document/engine-document-adapter";
import {
  createProjectApiRepository,
  type ProjectApiRepository,
} from "@/features/projects/infrastructure/project-api-repository";
import {
  createProjectIndexedDbRepository,
  type ProjectIndexedDbRepository,
} from "@/features/projects/infrastructure/project-indexeddb-repository";
import type { ProjectSaveStatus } from "@/features/projects/domain/project-save-status";
import {
  createProjectLoadController,
  type LoadStatus,
  type ProjectLoadController,
  type ProjectLoadResult,
} from "./project-load-controller";
import {
  createProjectSaveController,
  type ProjectSaveControllerImpl,
  type SaveOutcome,
} from "./project-save-controller";
import {
  createProjectRecoveryController,
  type ProjectRecoveryController,
} from "./project-recovery-controller";
import type { SaveReason } from "@/persistence/autosave/save-request";

export type ProjectSessionOptions = {
  projectId: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  adapter?: EngineDocumentAdapter;
  localRepo?: ProjectIndexedDbRepository;
  cloudRepo?: ProjectApiRepository;
  onSaveStatusChange?: (status: ProjectSaveStatus) => void;
  onLoadStatusChange?: (status: LoadStatus) => void;
};

/**
 * Wires save + load (+ recovery) controllers for StudioApp.
 * Call `start()` after the engine posts `sketchtrude-engine-ready`.
 */
export class ProjectSession {
  readonly projectId: string;
  readonly adapter: EngineDocumentAdapter;
  readonly localRepo: ProjectIndexedDbRepository;
  readonly cloudRepo: ProjectApiRepository;
  readonly saveController: ProjectSaveControllerImpl;
  readonly loadController: ProjectLoadController;
  readonly recoveryController: ProjectRecoveryController;

  private started = false;
  private disposed = false;
  private lastLoadResult: ProjectLoadResult | null = null;

  constructor(options: ProjectSessionOptions) {
    this.projectId = options.projectId;
    this.localRepo = options.localRepo ?? createProjectIndexedDbRepository();
    this.cloudRepo = options.cloudRepo ?? createProjectApiRepository();

    const iframe = options.iframeRef.current;
    if (!options.adapter && !iframe) {
      throw new Error(
        "ProjectSession requires an iframe ref or an EngineDocumentAdapter",
      );
    }

    this.adapter =
      options.adapter ??
      new LegacyEngineDocumentAdapter(iframe!, options.projectId);

    this.saveController = createProjectSaveController({
      adapter: this.adapter,
      localRepo: this.localRepo,
      cloudRepo: this.cloudRepo,
      onStatusChange: options.onSaveStatusChange,
    });

    this.loadController = createProjectLoadController({
      adapter: this.adapter,
      localRepo: this.localRepo,
      cloudRepo: this.cloudRepo,
      saveController: this.saveController,
      getEngineWindow: () => options.iframeRef.current?.contentWindow ?? null,
      onStatusChange: options.onLoadStatusChange,
    });

    this.recoveryController = createProjectRecoveryController({
      projectId: options.projectId,
      localRepo: this.localRepo,
      cloudRepo: this.cloudRepo,
    });
  }

  async start(): Promise<ProjectLoadResult> {
    if (this.disposed) {
      throw new Error("ProjectSession has been disposed");
    }
    if (this.started) {
      return (
        this.lastLoadResult ?? {
          status: this.loadController.getStatus(),
          decision: null,
          document: null,
        }
      );
    }

    await this.saveController.initialize(this.projectId);
    const result = await this.loadController.load(this.projectId);
    this.lastLoadResult = result;
    this.started = true;
    return result;
  }

  getSaveStatus(): ProjectSaveStatus {
    return this.saveController.getStatus();
  }

  getLoadStatus(): LoadStatus {
    return this.loadController.getStatus();
  }

  getError(): string | null {
    return this.loadController.getError();
  }

  requestAutosave(reason: SaveReason = "autosave"): void {
    this.saveController.requestAutosave(reason);
  }

  saveNow(reason: SaveReason = "manual"): Promise<SaveOutcome> {
    return this.saveController.saveNow(reason);
  }

  flushSave(): Promise<SaveOutcome> {
    return this.saveController.flushPendingSave();
  }

  resolveConflictKeepLocal(): Promise<SaveOutcome> {
    return this.saveController.resolveConflictKeepLocal();
  }

  async resolveConflictReloadFromCloud(): Promise<{ ok: boolean; error?: string }> {
    if (this.disposed) {
      return { ok: false, error: "Project session has been disposed" };
    }
    try {
      this.saveController.beginHydration();
      const loaded = await this.cloudRepo.loadDocument(this.projectId);
      if (!loaded?.document) {
        this.saveController.markHydrated({
          baseServerRevision: this.saveController.getBaseServerRevision(),
          cloudPending: true,
        });
        return { ok: false, error: "No cloud document available" };
      }
      await this.adapter.importDocument(loaded.document);
      // Drop stale local recovery so the next load prefers cloud.
      try {
        await this.localRepo.deleteSnapshot(this.projectId);
        await this.localRepo.deletePendingSave(this.projectId);
      } catch {
        /* best-effort */
      }
      const mutationVersion = this.adapter.getMutationVersion();
      await this.localRepo.putSnapshot({
        projectId: this.projectId,
        document: loaded.document,
        localMutationVersion: mutationVersion,
        lastSyncedMutationVersion: mutationVersion,
        baseServerRevision: loaded.revision,
        syncStatus: "synced",
        updatedAt: loaded.updatedAt || new Date().toISOString(),
      });
      this.saveController.markHydrated({
        baseServerRevision: loaded.revision,
        mutationVersion,
        lastSyncedMutationVersion: mutationVersion,
        lastSavedAt: loaded.updatedAt,
        cloudPending: false,
      });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.saveController.markConflict(
        this.saveController.getBaseServerRevision(),
      );
      return { ok: false, error: message };
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await this.loadController.dispose();
    await this.saveController.dispose();
  }
}

export function createProjectSession(
  options: ProjectSessionOptions,
): ProjectSession {
  return new ProjectSession(options);
}

/**
 * Wait until the engine iframe posts `sketchtrude-engine-ready`.
 * Also pings the iframe in case ready already fired before we subscribed.
 */
export function waitForEngineReady(
  projectId: string,
  timeoutMs = 30_000,
  iframe?: HTMLIFrameElement | null,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.clearInterval(pingTimer);
      window.removeEventListener("message", onMessage);
      resolve();
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      window.clearInterval(pingTimer);
      window.removeEventListener("message", onMessage);
      reject(new Error("Timed out waiting for sketchtrude-engine-ready"));
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if ((data as { type?: string }).type !== "sketchtrude-engine-ready") {
        return;
      }
      const msgProjectId = (data as { projectId?: string }).projectId;
      if (msgProjectId && msgProjectId !== projectId) return;
      finish();
    }

    window.addEventListener("message", onMessage);

    const ping = () => {
      iframe?.contentWindow?.postMessage(
        { type: "sketchtrude-ping-ready", projectId },
        "*",
      );
    };
    ping();
    const pingTimer = window.setInterval(ping, 400);
  });
}
