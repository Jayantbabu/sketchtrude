import type { EngineDocumentAdapter } from "@/engine/document/engine-document-adapter";
import type { EngineDocumentChangeEvent } from "@/engine/document/engine-document-events";
import {
  createEmptyProjectDocument,
  type LegacyStudioDocument,
  type LegacyStudioLayerMeta,
  type ProjectDocument,
} from "@/features/projects/domain/project-document";
import { migrateProjectDocument } from "@/features/projects/domain/project-document-migrations";
import {
  ProjectLoadError,
  ProjectRecoveryError,
} from "@/features/projects/domain/project-errors";
import type { LoadedProjectDocument } from "@/features/projects/domain/project-revision";
import type { ProjectApiRepository } from "@/features/projects/infrastructure/project-api-repository";
import type { ProjectIndexedDbRepository } from "@/features/projects/infrastructure/project-indexeddb-repository";
import type { LocalProjectSnapshotRecord } from "@/features/projects/infrastructure/project-repository-types";
import {
  RecoveryManager,
  type CloudLoadCandidate,
  type LoadSourceDecision,
  type LocalLoadCandidate,
} from "@/persistence/recovery/recovery-manager";
import { projectPersistenceLogger } from "@/shared/logging/project-persistence-logger";
import type {
  ProjectSaveControllerImpl,
  SaveOutcome,
} from "./project-save-controller";

export type LoadStatus = "loading" | "ready" | "conflict" | "error";

export type ProjectLoadStatusListener = (status: LoadStatus) => void;

export type ProjectLoadControllerOptions = {
  adapter: EngineDocumentAdapter;
  localRepo: ProjectIndexedDbRepository;
  cloudRepo: ProjectApiRepository;
  saveController: ProjectSaveControllerImpl;
  /** Optional iframe used to signal sketchtrude-start-fresh for empty projects. */
  getEngineWindow?: () => Window | null;
  onStatusChange?: ProjectLoadStatusListener;
};

export type ProjectLoadResult = {
  status: LoadStatus;
  decision: LoadSourceDecision | null;
  document: ProjectDocument | null;
  error?: string;
};

/**
 * Local recovery snapshots intentionally contain storage paths but not signed
 * URLs. When a newer local snapshot wins recovery, borrow only the transient
 * URLs from the cloud candidate so source PDFs/images can be reopened without
 * replacing any newer local drawing state.
 */
export function mergeTransientLayerAssetUrls(
  localDocument: ProjectDocument,
  cloudDocument: ProjectDocument | null | undefined,
): ProjectDocument {
  const localLegacy = localDocument.extensions?.legacyStudio as
    | LegacyStudioDocument
    | undefined;
  const cloudLegacy = cloudDocument?.extensions?.legacyStudio as
    | LegacyStudioDocument
    | undefined;
  if (!localLegacy?.layers?.length || !cloudLegacy?.layers?.length) {
    return localDocument;
  }

  const cloudById = new Map<string, LegacyStudioLayerMeta>();
  cloudLegacy.layers.forEach((layer) => {
    if (typeof layer.layer_id === "string" && layer.layer_id) {
      cloudById.set(layer.layer_id, layer);
    }
  });

  let changed = false;
  const layers = localLegacy.layers.map((localLayer, index) => {
    const cloudLayer =
      (typeof localLayer.layer_id === "string"
        ? cloudById.get(localLayer.layer_id)
        : undefined) ?? cloudLegacy.layers[index];
    if (!cloudLayer) return localLayer;

    const next = { ...localLayer };
    const localPdf = localLayer.pdf as { storagePath?: string | null } | null | undefined;
    const cloudPdf = cloudLayer.pdf as { storagePath?: string | null } | null | undefined;
    if (
      localPdf?.storagePath &&
      localPdf.storagePath === cloudPdf?.storagePath &&
      typeof cloudLayer.pdf_url === "string" &&
      cloudLayer.pdf_url
    ) {
      next.pdf_url = cloudLayer.pdf_url;
      changed = true;
    }

    if (
      localLayer.imageReference?.storagePath &&
      localLayer.imageReference.storagePath ===
        cloudLayer.imageReference?.storagePath &&
      typeof cloudLayer.image_url === "string" &&
      cloudLayer.image_url
    ) {
      next.image_url = cloudLayer.image_url;
      changed = true;
    }

    if (
      localLayer.raster_path &&
      localLayer.raster_path === cloudLayer.raster_path &&
      typeof cloudLayer.raster_url === "string" &&
      cloudLayer.raster_url
    ) {
      next.raster_url = cloudLayer.raster_url;
      changed = true;
    }

    if (
      localLayer.rendering?.architecture === "hybrid-v1" &&
      cloudLayer.rendering?.architecture === "hybrid-v1"
    ) {
      const cloudTiles = new Map(
        cloudLayer.rendering.tiles.map((tile) => [tile.key, tile]),
      );
      let renderingChanged = false;
      const tiles = localLayer.rendering.tiles.map((tile) => {
        const cloudTile = cloudTiles.get(tile.key);
        if (
          tile.storagePath &&
          tile.storagePath === cloudTile?.storagePath &&
          typeof cloudTile.url === "string" &&
          cloudTile.url
        ) {
          renderingChanged = true;
          return { ...tile, url: cloudTile.url };
        }
        return tile;
      });
      if (renderingChanged) {
        next.rendering = { ...localLayer.rendering, tiles };
        changed = true;
      }
    }

    return next;
  });

  if (!changed) return localDocument;
  return {
    ...localDocument,
    extensions: {
      ...localDocument.extensions,
      legacyStudio: { ...localLegacy, layers },
    },
  };
}

/**
 * Loads local + cloud candidates, applies recovery selection, imports into the
 * engine, then wires change events to the save controller.
 */
export class ProjectLoadController {
  private readonly adapter: EngineDocumentAdapter;
  private readonly localRepo: ProjectIndexedDbRepository;
  private readonly cloudRepo: ProjectApiRepository;
  private readonly saveController: ProjectSaveControllerImpl;
  private readonly getEngineWindow?: () => Window | null;
  private readonly externalOnStatusChange?: ProjectLoadStatusListener;

  private projectId: string | null = null;
  private status: LoadStatus = "loading";
  private readonly listeners = new Set<ProjectLoadStatusListener>();
  private unsubscribeChanges: (() => void) | null = null;
  private disposed = false;
  private localSnapshot: LocalProjectSnapshotRecord | undefined;
  private cloudLoaded: LoadedProjectDocument | null = null;
  private lastError: string | null = null;

  constructor(options: ProjectLoadControllerOptions) {
    this.adapter = options.adapter;
    this.localRepo = options.localRepo;
    this.cloudRepo = options.cloudRepo;
    this.saveController = options.saveController;
    this.getEngineWindow = options.getEngineWindow;
    this.externalOnStatusChange = options.onStatusChange;
  }

  getStatus(): LoadStatus {
    return this.status;
  }

  getError(): string | null {
    return this.lastError;
  }

  subscribe(listener: ProjectLoadStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async load(projectId: string): Promise<ProjectLoadResult> {
    if (this.disposed) {
      throw new ProjectLoadError("ProjectLoadController has been disposed");
    }

    this.projectId = projectId;
    this.lastError = null;
    this.setStatus("loading");
    this.saveController.beginHydration();

    projectPersistenceLogger.info("project_load_started", { projectId });

    let localCandidate: LocalLoadCandidate = null;
    let cloudCandidate: CloudLoadCandidate = null;

    try {
      this.localSnapshot = await this.localRepo.getSnapshot(projectId);
      localCandidate = this.toLocalCandidate(this.localSnapshot);
    } catch (error) {
      localCandidate = {
        valid: false,
        corrupt: true,
        baseServerRevision: 0,
        localMutationVersion: 0,
        lastSyncedMutationVersion: 0,
        syncStatus: "failed",
      };
      projectPersistenceLogger.warn("project_load_local_found", {
        projectId,
        errorCode: error instanceof Error ? error.name : "unknown",
      });
    }

    try {
      this.cloudLoaded = await this.cloudRepo.loadDocument(projectId);
      cloudCandidate = this.toCloudCandidate(this.cloudLoaded);
    } catch {
      cloudCandidate = { valid: false, revision: 0 };
    }

    const recovery = new RecoveryManager({
      projectId,
      loadLocal: async () => localCandidate,
      loadCloud: async () => cloudCandidate,
    });

    let decision: LoadSourceDecision;
    try {
      const result = await recovery.chooseSafeLoadSource();
      decision = result.decision;
    } catch (error) {
      // RecoveryManager throws only on source === "failure".
      // Empty projects are returned as source "empty" and do not throw.
      if (
        localCandidate == null &&
        cloudCandidate == null &&
        !(error instanceof ProjectRecoveryError)
      ) {
        decision = { source: "empty" };
      } else if (
        error instanceof ProjectRecoveryError &&
        localCandidate == null &&
        cloudCandidate == null
      ) {
        decision = { source: "empty" };
      } else {
        const message =
          error instanceof Error ? error.message : "Project load failed";
        this.lastError = message;
        this.setStatus("error");
        this.saveController.markHydrated();
        return {
          status: "error",
          decision: { source: "failure", reason: message },
          document: null,
          error: message,
        };
      }
    }

    if (decision.source === "conflict") {
      this.setStatus("conflict");
      // Prefer keeping local editable; mark conflict on the save controller.
      const localDoc = this.localSnapshot?.document
        ? mergeTransientLayerAssetUrls(
            migrateProjectDocument(this.localSnapshot.document),
            this.cloudLoaded?.document,
          )
        : null;
      if (localDoc) {
        await this.importGuarded(localDoc);
      }
      this.saveController.markHydrated({
        baseServerRevision: this.localSnapshot?.baseServerRevision ?? 0,
        mutationVersion: this.localSnapshot?.localMutationVersion ?? 0,
        lastSyncedMutationVersion:
          this.localSnapshot?.lastSyncedMutationVersion ?? 0,
        cloudPending: true,
        lastSavedAt: this.localSnapshot?.updatedAt,
      });
      this.saveController.markConflict(
        this.cloudLoaded?.revision ??
          this.localSnapshot?.baseServerRevision ??
          0,
      );
      this.subscribeToEngineChanges();
      return { status: "conflict", decision, document: localDoc };
    }

    if (decision.source === "empty") {
      // Keep engine boot layers (Base + Sketch 01); do not import a synthetic empty doc.
      this.signalStartFresh(projectId);
      this.saveController.markHydrated({
        baseServerRevision: 0,
        mutationVersion: 0,
        lastSyncedMutationVersion: 0,
        cloudPending: false,
      });
      this.subscribeToEngineChanges();
      this.setStatus("ready");
      projectPersistenceLogger.info("project_load_completed", {
        projectId,
        reason: "empty",
      });
      return {
        status: "ready",
        decision,
        document: createEmptyProjectDocument(projectId),
      };
    }

    if (decision.source === "failure") {
      const message = decision.reason;
      this.lastError = message;
      this.setStatus("error");
      this.saveController.markHydrated();
      return { status: "error", decision, document: null, error: message };
    }

    let document: ProjectDocument;
    let baseServerRevision = 0;
    let mutationVersion = 0;
    let lastSyncedMutationVersion = 0;
    let cloudPending = false;
    let lastSavedAt: string | undefined;

    try {
      if (decision.source === "local") {
        if (!this.localSnapshot?.document) {
          throw new ProjectLoadError("Local snapshot missing document");
        }
        document = mergeTransientLayerAssetUrls(
          migrateProjectDocument(this.localSnapshot.document),
          this.cloudLoaded?.document,
        );
        baseServerRevision = this.localSnapshot.baseServerRevision;
        mutationVersion = this.localSnapshot.localMutationVersion;
        lastSyncedMutationVersion =
          this.localSnapshot.lastSyncedMutationVersion;
        cloudPending =
          mutationVersion > lastSyncedMutationVersion ||
          decision.mode === "resume-sync" ||
          decision.mode === "offline";
        lastSavedAt = this.localSnapshot.updatedAt;
      } else {
        // cloud
        if (!this.cloudLoaded?.document) {
          throw new ProjectLoadError("Cloud document missing");
        }
        document = migrateProjectDocument(this.cloudLoaded.document);
        baseServerRevision = this.cloudLoaded.revision;
        mutationVersion = 0;
        lastSyncedMutationVersion = 0;
        cloudPending = false;
        lastSavedAt = this.cloudLoaded.updatedAt;
      }

      await this.importGuarded(document);

      // Only mirror cloud into local AFTER a successful import.
      if (decision.source === "cloud") {
        await this.localRepo.putSnapshot({
          projectId,
          document,
          localMutationVersion: 0,
          lastSyncedMutationVersion: 0,
          baseServerRevision,
          syncStatus: "synced",
          updatedAt: lastSavedAt ?? new Date().toISOString(),
          checksum: this.cloudLoaded?.checksum,
        });
        await this.localRepo.putSyncState({
          projectId,
          baseServerRevision,
          localMutationVersion: 0,
          lastSyncedMutationVersion: 0,
          syncStatus: "synced",
          lastCloudSavedAt: lastSavedAt,
          updatedAt: lastSavedAt ?? new Date().toISOString(),
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to import project";
      this.lastError = message;
      this.setStatus("error");
      this.saveController.markHydrated();
      return {
        status: "error",
        decision,
        document: null,
        error: message,
      };
    }

    this.saveController.markHydrated({
      baseServerRevision,
      mutationVersion,
      lastSyncedMutationVersion,
      cloudPending,
      lastSavedAt,
    });
    this.subscribeToEngineChanges();
    this.setStatus("ready");

    projectPersistenceLogger.info("project_load_completed", {
      projectId,
      reason: decision.source,
      baseRevision: baseServerRevision,
      mutationVersion,
    });

    // Resume pending cloud sync after offline / resume-sync loads.
    if (cloudPending && decision.source === "local") {
      this.saveController.requestAutosave(
        decision.mode === "offline" ? "recovery" : "autosave",
      );
    }

    return { status: "ready", decision, document };
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.unsubscribeChanges?.();
    this.unsubscribeChanges = null;
    this.listeners.clear();
  }

  private setStatus(status: LoadStatus): void {
    this.status = status;
    for (const listener of this.listeners) {
      listener(status);
    }
    this.externalOnStatusChange?.(status);
  }

  private toLocalCandidate(
    snapshot: LocalProjectSnapshotRecord | undefined,
  ): LocalLoadCandidate {
    if (!snapshot) return null;
    try {
      migrateProjectDocument(snapshot.document);
      return {
        valid: true,
        baseServerRevision: snapshot.baseServerRevision,
        localMutationVersion: snapshot.localMutationVersion,
        lastSyncedMutationVersion: snapshot.lastSyncedMutationVersion,
        syncStatus: snapshot.syncStatus,
        updatedAt: snapshot.updatedAt,
      };
    } catch {
      return {
        valid: false,
        corrupt: true,
        baseServerRevision: snapshot.baseServerRevision,
        localMutationVersion: snapshot.localMutationVersion,
        lastSyncedMutationVersion: snapshot.lastSyncedMutationVersion,
        syncStatus: "failed",
        updatedAt: snapshot.updatedAt,
      };
    }
  }

  private toCloudCandidate(
    loaded: LoadedProjectDocument | null,
  ): CloudLoadCandidate {
    if (!loaded) return null;
    try {
      migrateProjectDocument(loaded.document);
      return {
        valid: true,
        revision: loaded.revision,
        updatedAt: loaded.updatedAt,
      };
    } catch {
      return { valid: false, revision: loaded.revision };
    }
  }

  private signalStartFresh(projectId: string): void {
    const win = this.getEngineWindow?.();
    win?.postMessage({ type: "sketchtrude-start-fresh", projectId }, "*");
  }

  private async importGuarded(document: ProjectDocument): Promise<void> {
    this.saveController.beginHydration();
    try {
      await this.adapter.importDocument(document);
    } catch (error) {
      // Recover drawings that still exist in the engine's local IDB autosave.
      const adapter = this.adapter as {
        tryRestoreEngineLocal?: () => Promise<boolean>;
      };
      if (typeof adapter.tryRestoreEngineLocal === "function") {
        const restored = await adapter.tryRestoreEngineLocal();
        if (restored) return;
      }
      const message =
        error instanceof Error ? error.message : "Failed to import project";
      throw new ProjectLoadError(message);
    }
  }

  private subscribeToEngineChanges(): void {
    this.unsubscribeChanges?.();
    this.unsubscribeChanges = this.adapter.subscribeToChanges(
      (_event: EngineDocumentChangeEvent) => {
        if (this.disposed) return;
        this.saveController.requestAutosave("autosave");
      },
    );
  }
}

export function createProjectLoadController(
  options: ProjectLoadControllerOptions,
): ProjectLoadController {
  return new ProjectLoadController(options);
}

export type { SaveOutcome };
