import type { ProjectDocument } from "@/features/projects/domain/project-document";
import {
  legacyStudioFromProjectDocument,
  projectDocumentFromLegacyStudio,
  type LegacyStudioDocument,
} from "@/features/projects/domain/project-document";
import type { EngineDocumentAdapter } from "./engine-document-adapter";
import type { EngineDocumentChangeEvent } from "./engine-document-events";

type SketchtrudeEngineApi = {
  exportProjectDocument?: () => unknown | Promise<unknown>;
  importProjectDocument?: (document: unknown) => void | Promise<void>;
  subscribeToDocumentChanges?: (
    callback: (event: EngineDocumentChangeEvent) => void,
  ) => () => void;
  hasUnsavedChanges?: () => boolean;
  getMutationVersion?: () => number;
};

declare global {
  interface Window {
    sketchtrudeEngine?: SketchtrudeEngineApi;
  }
}

const EXPORT_TYPE = "sketchtrude-export-document";
const EXPORT_RESULT_TYPE = "sketchtrude-export-document-result";
const IMPORT_TYPE = "sketchtrude-import-document";
const IMPORT_RESULT_TYPE = "sketchtrude-import-document-result";
const CHANGED_TYPE = "sketchtrude-document-changed";
const RESTORE_LOCAL_TYPE = "sketchtrude-restore-local";
const RESTORE_LOCAL_RESULT_TYPE = "sketchtrude-restore-local-result";

/**
 * Adapts the legacy engine (iframe) to EngineDocumentAdapter.
 * Uses postMessage only — calling iframe functions from the parent is unreliable
 * (async exports were previously not awaited, saving empty documents).
 */
export class LegacyEngineDocumentAdapter implements EngineDocumentAdapter {
  private readonly iframe: HTMLIFrameElement;
  private readonly projectId: string;
  private mutationVersion = 0;
  private unsaved = false;

  constructor(iframe: HTMLIFrameElement, projectId: string) {
    this.iframe = iframe;
    this.projectId = projectId;
  }

  private get targetWindow(): Window | null {
    return this.iframe.contentWindow;
  }

  private postToEngine(message: unknown): void {
    const win = this.targetWindow;
    if (!win) {
      throw new Error("Engine iframe contentWindow is not available");
    }
    win.postMessage(message, "*");
  }

  private waitForMessage<T extends { type: string }>(
    type: string,
    timeoutMs = 30_000,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error(`Timed out waiting for ${type}`));
      }, timeoutMs);

      const onMessage = (event: MessageEvent) => {
        if (event.source && event.source !== this.targetWindow) return;
        const data = event.data;
        if (!data || typeof data !== "object") return;
        if ((data as { type?: string }).type !== type) return;
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve(data as T);
      };

      window.addEventListener("message", onMessage);
    });
  }

  async exportDocument(projectId: string = this.projectId): Promise<ProjectDocument> {
    this.postToEngine({ type: EXPORT_TYPE, projectId });
    const result = await this.waitForMessage<{
      type: string;
      document?: unknown;
      error?: string;
    }>(EXPORT_RESULT_TYPE);

    if (result.error) {
      throw new Error(result.error);
    }
    if (!result.document) {
      throw new Error("Engine export returned no document");
    }

    return this.toProjectDocument(projectId, result.document);
  }

  async importDocument(document: ProjectDocument): Promise<void> {
    let legacy = legacyStudioFromProjectDocument(document);

    // If the saved ProjectDocument lost layer rasters (bad prior exports),
    // still send what we have — engine may fill pixels from its local IDB.
    if (!legacy.layers?.length && document.scene?.rootLayerIds?.length) {
      legacy = {
        ...legacy,
        layers: document.scene.rootLayerIds.map((id, index) => {
          const layer = document.scene.layers[id];
          return {
            name: layer?.name ?? `Layer ${index + 1}`,
            visible: layer?.visible !== false,
            opacity: layer?.opacity ?? 1,
            trace: layer?.trace ?? 0,
            blendMode: layer?.blendMode ?? "source-over",
            raster_path: layer?.rasterPath ?? null,
          };
        }),
      };
    }

    this.postToEngine({ type: IMPORT_TYPE, document: legacy, projectId: this.projectId });
    const result = await this.waitForMessage<{
      type: string;
      ok?: boolean;
      error?: string;
    }>(IMPORT_RESULT_TYPE);

    if (result.error || result.ok === false) {
      // Last resort: engine-local nm-trace recovery (pixel blobs).
      const restored = await this.tryRestoreEngineLocal();
      if (restored) {
        this.unsaved = false;
        return;
      }
      throw new Error(result.error || "Failed to import project");
    }

    this.unsaved = false;
  }

  /** Ask the engine to restore from its own IndexedDB autosave. */
  async tryRestoreEngineLocal(): Promise<boolean> {
    this.postToEngine({
      type: RESTORE_LOCAL_TYPE,
      projectId: this.projectId,
    });
    try {
      const result = await this.waitForMessage<{
        type: string;
        ok?: boolean;
        error?: string;
      }>(RESTORE_LOCAL_RESULT_TYPE, 20_000);
      return result.ok === true;
    } catch {
      return false;
    }
  }

  subscribeToChanges(
    listener: (event: EngineDocumentChangeEvent) => void,
  ): () => void {
    const onMessage = (event: MessageEvent) => {
      if (event.source && event.source !== this.targetWindow) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if ((data as { type?: string }).type !== CHANGED_TYPE) return;
      const change = (data as { event?: EngineDocumentChangeEvent }).event;
      if (!change) return;
      this.mutationVersion = change.mutationVersion;
      this.unsaved = true;
      listener(change);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }

  hasUnsavedChanges(): boolean {
    return this.unsaved;
  }

  getMutationVersion(): number {
    return this.mutationVersion;
  }

  private toProjectDocument(
    projectId: string,
    payload: unknown,
  ): ProjectDocument {
    if (
      payload &&
      typeof payload === "object" &&
      "schemaVersion" in payload &&
      "projectId" in payload
    ) {
      return payload as ProjectDocument;
    }
    return projectDocumentFromLegacyStudio(
      projectId,
      payload as LegacyStudioDocument,
    );
  }
}
