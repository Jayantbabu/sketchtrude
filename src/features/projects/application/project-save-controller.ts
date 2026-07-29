import type { EngineDocumentAdapter } from "@/engine/document/engine-document-adapter";
import type { ProjectDocument } from "@/features/projects/domain/project-document";
import {
  APPLICATION_VERSION,
  stripLegacyStudioBlobs,
  type LegacyStudioDocument,
  type LegacyStudioLayerMeta,
} from "@/features/projects/domain/project-document";
import { migrateProjectDocument } from "@/features/projects/domain/project-document-migrations";
import {
  InvalidProjectDocumentError,
  ProjectSaveConflictError,
  ProjectSaveNetworkError,
} from "@/features/projects/domain/project-errors";
import type { ProjectSaveStatus } from "@/features/projects/domain/project-save-status";
import type { ProjectApiRepository } from "@/features/projects/infrastructure/project-api-repository";
import type { ProjectIndexedDbRepository } from "@/features/projects/infrastructure/project-indexeddb-repository";
import type {
  LocalProjectSnapshotRecord,
  ProjectSyncStateRecord,
} from "@/features/projects/infrastructure/project-repository-types";
import { AutosaveManager } from "@/persistence/autosave/autosave-manager";
import { DirtyStateTracker } from "@/persistence/autosave/dirty-state-tracker";
import {
  defaultRetryPolicy,
  waitForBackoff,
  type RetryPolicy,
} from "@/persistence/autosave/retry-policy";
import { ProjectSaveQueue } from "@/persistence/autosave/save-queue";
import type { SaveReason } from "@/persistence/autosave/save-request";
import type { SyncStatus } from "@/persistence/recovery/recovery-policy";
import { networkState } from "@/persistence/sync/network-state";
import { projectPersistenceLogger } from "@/shared/logging/project-persistence-logger";

export type SaveOutcome =
  | {
      ok: true;
      local: true;
      cloud: boolean;
      mutationVersion: number;
      revision?: number;
      savedAt?: string;
    }
  | {
      ok: false;
      local: boolean;
      cloud: false;
      error: string;
      recoverable: boolean;
      conflict?: { currentRevision: number };
      mutationVersion?: number;
    };

export type ProjectSaveStatusListener = (status: ProjectSaveStatus) => void;

export type ProjectSaveControllerOptions = {
  adapter: EngineDocumentAdapter;
  localRepo: ProjectIndexedDbRepository;
  cloudRepo: ProjectApiRepository;
  onStatusChange?: ProjectSaveStatusListener;
  retryPolicy?: RetryPolicy;
  /** Used only when export still contains layer blobs/data-URLs. Prefer raster_path. */
  uploadLayerRaster?: (
    projectId: string,
    layerId: string,
    blob: Blob,
  ) => Promise<string>;
  uploadLayerTile?: (
    projectId: string,
    layerId: string,
    tileKey: string,
    blob: Blob,
  ) => Promise<string>;
};

export interface ProjectSaveController {
  initialize(projectId: string): Promise<void>;
  requestAutosave(reason: SaveReason): void;
  saveNow(reason: SaveReason): Promise<SaveOutcome>;
  flushPendingSave(): Promise<SaveOutcome>;
  dispose(): Promise<void>;
  getStatus(): ProjectSaveStatus;
  subscribe(listener: ProjectSaveStatusListener): () => void;
  /** Called by the load controller after hydration. */
  markHydrated(options?: {
    baseServerRevision?: number;
    mutationVersion?: number;
    lastSyncedMutationVersion?: number;
    lastSavedAt?: string;
    cloudPending?: boolean;
  }): void;
  /** Surface a revision conflict without discarding local recovery. */
  markConflict(currentRevision: number): void;
  /** Overwrite cloud with local by advancing base revision, then save. */
  resolveConflictKeepLocal(): Promise<SaveOutcome>;
  getBaseServerRevision(): number;
  getDirtyTracker(): DirtyStateTracker;
  beginHydration(): void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createClientMutationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `mut-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:");
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/**
 * Upload any pending layer rasters embedded in the export, then strip blobs.
 * Phase 1 preference: engine already uploaded and only returns raster_path.
 */
export async function prepareDocumentForPersistence(
  projectId: string,
  document: ProjectDocument,
  uploadLayerRaster?: ProjectSaveControllerOptions["uploadLayerRaster"],
  uploadLayerTile?: ProjectSaveControllerOptions["uploadLayerTile"],
): Promise<ProjectDocument> {
  const legacy = document.extensions?.legacyStudio as
    | LegacyStudioDocument
    | undefined;
  if (!legacy?.layers?.length) {
    return migrateProjectDocument(document);
  }

  const layers: LegacyStudioLayerMeta[] = [];
  for (let i = 0; i < legacy.layers.length; i += 1) {
    const layer = { ...legacy.layers[i] };
    const layerId =
      (typeof layer.layer_id === "string" && layer.layer_id.trim()) ||
      document.scene.rootLayerIds[i] ||
      `legacy-layer-${i}`;
    layer.layer_id = layerId;
    const hasPath =
      typeof layer.raster_path === "string" && layer.raster_path.length > 0;

    // Always re-upload when the engine provides a fresh blob. Skipping when
    // raster_path already exists left clears/erases pointing at stale PNGs.
    let blob: Blob | null = null;
    if (typeof Blob !== "undefined" && layer.blob instanceof Blob) {
      blob = layer.blob;
    } else if (typeof Blob !== "undefined" && layer.raster instanceof Blob) {
      blob = layer.raster;
    } else if (isDataUrl(layer.raster)) {
      blob = await dataUrlToBlob(layer.raster);
    } else if (isDataUrl(layer.blob)) {
      blob = await dataUrlToBlob(layer.blob);
    }

    if (uploadLayerRaster && blob && blob.size > 0) {
      layer.raster_path = await uploadLayerRaster(projectId, layerId, blob);
    } else if (!hasPath && blob && blob.size > 0) {
      // Offline / no uploader: keep blob for local recovery only.
    }

    if (layer.rendering?.architecture === "hybrid-v1") {
      const tiles = [];
      for (const tileEntry of layer.rendering.tiles) {
        const tile = { ...tileEntry };
        if (
          uploadLayerTile &&
          typeof Blob !== "undefined" &&
          tile.blob instanceof Blob &&
          tile.blob.size > 0
        ) {
          tile.storagePath = await uploadLayerTile(
            projectId,
            layerId,
            tile.key,
            tile.blob,
          );
        }
        tiles.push(tile);
      }
      layer.rendering = { ...layer.rendering, tiles };
    }

    layers.push(layer);
  }

  const cleaned: ProjectDocument = {
    ...document,
    extensions: {
      ...document.extensions,
      legacyStudio: stripLegacyStudioBlobs({ ...legacy, layers }),
    },
  };

  // Mirror raster paths onto scene layers when present.
  for (let i = 0; i < layers.length; i += 1) {
    const id = layers[i]?.layer_id;
    if (!id) continue;
    const sceneLayer = cleaned.scene.layers[id];
    if (sceneLayer && layers[i]?.raster_path !== undefined) {
      cleaned.scene.layers[id] = {
        ...sceneLayer,
        rasterPath: (layers[i].raster_path as string | null) ?? null,
      };
    }
  }

  return migrateProjectDocument(cleaned);
}

async function defaultUploadLayerRaster(
  projectId: string,
  layerId: string,
  blob: Blob,
): Promise<string> {
  const form = new FormData();
  form.set("layer_id", layerId);
  form.set("raster", blob, "layer.png");

  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/document/layer`,
    {
      method: "POST",
      body: form,
      credentials: "same-origin",
    },
  );

  if (!res.ok) {
    throw new ProjectSaveNetworkError(
      `Layer raster upload failed (${res.status})`,
      { status: res.status, retryable: res.status >= 500 || res.status === 0 },
    );
  }

  const body = (await res.json()) as { raster_path?: string };
  if (!body.raster_path) {
    throw new ProjectSaveNetworkError("Layer raster upload returned no path", {
      retryable: false,
    });
  }
  return body.raster_path;
}

async function defaultUploadLayerTile(
  projectId: string,
  layerId: string,
  tileKey: string,
  blob: Blob,
): Promise<string> {
  const form = new FormData();
  form.set("layer_id", layerId);
  form.set("tile_key", tileKey);
  form.set("tile", blob, "tile.png");
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/document/tile`,
    { method: "POST", body: form, credentials: "same-origin" },
  );
  if (!res.ok) {
    throw new ProjectSaveNetworkError(`Layer tile upload failed (${res.status})`, {
      status: res.status,
      retryable: res.status >= 500 || res.status === 0,
    });
  }
  const body = (await res.json()) as { storage_path?: string };
  if (!body.storage_path) {
    throw new ProjectSaveNetworkError("Layer tile upload returned no path", {
      retryable: false,
    });
  }
  return body.storage_path;
}

/**
 * Owns ProjectDocument JSON persistence: local IndexedDB first, then cloud sync.
 * Engine remains responsible for pixel crash-recovery of layer PNGs in its own IDB.
 * Prefer exports that already include raster_path; blobs/data-URLs are uploaded first.
 */
export class ProjectSaveControllerImpl implements ProjectSaveController {
  private readonly adapter: EngineDocumentAdapter;
  private readonly localRepo: ProjectIndexedDbRepository;
  private readonly cloudRepo: ProjectApiRepository;
  private readonly retryPolicy: RetryPolicy;
  private readonly uploadLayerRaster: NonNullable<
    ProjectSaveControllerOptions["uploadLayerRaster"]
  >;
  private readonly uploadLayerTile: NonNullable<
    ProjectSaveControllerOptions["uploadLayerTile"]
  >;
  private readonly externalOnStatusChange?: ProjectSaveStatusListener;

  private projectId: string | null = null;
  private status: ProjectSaveStatus = { state: "initializing" };
  private readonly listeners = new Set<ProjectSaveStatusListener>();
  private readonly dirtyTracker = new DirtyStateTracker();
  private baseServerRevision = 0;
  private lastSavedAt: string | undefined;
  private cloudPending = false;
  private disposed = false;
  private initialized = false;
  private lastOutcome: SaveOutcome | null = null;
  private hydrating = false;

  private autosaveManager: AutosaveManager | null = null;
  private saveQueue: ProjectSaveQueue | null = null;
  private unsubscribeNetwork: (() => void) | null = null;
  private beforeUnloadHandler: ((event: BeforeUnloadEvent) => void) | null =
    null;

  constructor(options: ProjectSaveControllerOptions) {
    this.adapter = options.adapter;
    this.localRepo = options.localRepo;
    this.cloudRepo = options.cloudRepo;
    this.retryPolicy = options.retryPolicy ?? defaultRetryPolicy;
    this.uploadLayerRaster =
      options.uploadLayerRaster ?? defaultUploadLayerRaster;
    this.uploadLayerTile = options.uploadLayerTile ?? defaultUploadLayerTile;
    this.externalOnStatusChange = options.onStatusChange;
  }

  async initialize(projectId: string): Promise<void> {
    if (this.disposed) {
      throw new Error("ProjectSaveController has been disposed");
    }

    this.projectId = projectId;
    this.setStatus({ state: "initializing" });

    const sync = await this.localRepo.getSyncState(projectId);
    if (sync) {
      this.baseServerRevision = sync.baseServerRevision;
      this.lastSavedAt = sync.lastCloudSavedAt ?? sync.lastLocalSavedAt;
      this.dirtyTracker.reset(sync.localMutationVersion);
      if (sync.localMutationVersion > sync.lastSyncedMutationVersion) {
        this.cloudPending = true;
        this.dirtyTracker.hydrate({
          mutationVersion: sync.localMutationVersion,
          lastSavedMutationVersion: sync.lastSyncedMutationVersion,
          dirtySince: Date.now(),
        });
      }
    }

    this.saveQueue = new ProjectSaveQueue((reason) => this.performCloudSave(reason));
    this.autosaveManager = new AutosaveManager({
      onLocalSave: (reason) => this.performLocalSave(reason),
      onCloudSave: (reason) => {
        this.saveQueue?.request(reason);
      },
      isOnline: () => networkState.isOnline(),
    });

    this.unsubscribeNetwork = networkState.subscribe((status) => {
      if (this.disposed || !this.initialized) return;
      if (status === "offline") {
        if (this.dirtyTracker.isDirty() || this.cloudPending) {
          this.setStatus({ state: "offline", pendingChanges: true });
        }
        return;
      }
      // Back online — resume cloud sync if needed.
      if (this.cloudPending || this.dirtyTracker.isDirty()) {
        this.saveQueue?.request("recovery");
      }
    });

    this.attachBeforeUnload();
    this.initialized = true;

    if (this.dirtyTracker.isDirty() || this.cloudPending) {
      this.setStatus(
        networkState.isOnline()
          ? { state: "saved-local", cloudPending: true }
          : { state: "offline", pendingChanges: true },
      );
    } else {
      this.setStatus({
        state: "ready-clean",
        lastSavedAt: this.lastSavedAt,
      });
    }
  }

  markHydrated(options: {
    baseServerRevision?: number;
    mutationVersion?: number;
    lastSyncedMutationVersion?: number;
    lastSavedAt?: string;
    cloudPending?: boolean;
  } = {}): void {
    this.hydrating = false;
    if (options.baseServerRevision != null) {
      this.baseServerRevision = options.baseServerRevision;
    }
    if (options.lastSavedAt) {
      this.lastSavedAt = options.lastSavedAt;
    }
    this.cloudPending = Boolean(options.cloudPending);
    const mutationVersion =
      options.mutationVersion ?? this.adapter.getMutationVersion();
    const lastSynced =
      options.lastSyncedMutationVersion ??
      (this.cloudPending ? mutationVersion - 1 : mutationVersion);
    this.dirtyTracker.reset(Math.max(0, lastSynced));
    if (mutationVersion > lastSynced) {
      this.dirtyTracker.hydrate({
        mutationVersion,
        lastSavedMutationVersion: lastSynced,
        dirtySince: Date.now(),
      });
    } else {
      this.dirtyTracker.reset(mutationVersion);
    }

    if (this.cloudPending) {
      this.setStatus(
        networkState.isOnline()
          ? { state: "saved-local", cloudPending: true }
          : { state: "offline", pendingChanges: true },
      );
    } else {
      this.setStatus({
        state: "ready-clean",
        lastSavedAt: this.lastSavedAt,
      });
    }
  }

  /** Load controller sets this while importing so change events are ignored. */
  beginHydration(): void {
    this.hydrating = true;
  }

  markConflict(currentRevision: number): void {
    this.cloudPending = true;
    void this.writeSyncState({
      syncStatus: "conflict",
      baseServerRevision: this.baseServerRevision,
      lastError: `Conflict with server revision ${currentRevision}`,
    });
    this.setStatus({ state: "conflict", currentRevision });
  }

  async resolveConflictKeepLocal(): Promise<SaveOutcome> {
    if (!this.ensureReady()) {
      return {
        ok: false,
        local: false,
        cloud: false,
        error: "Save controller is not initialized",
        recoverable: false,
      };
    }
    const status = this.status;
    const currentRevision =
      status.state === "conflict"
        ? status.currentRevision
        : this.baseServerRevision;
    // Accept the server tip as our new base so the next put succeeds (overwrite).
    this.baseServerRevision = Math.max(this.baseServerRevision, currentRevision);
    this.cloudPending = true;
    this.dirtyTracker.markDirty();
    await this.writeSyncState({
      syncStatus: "pending",
      baseServerRevision: this.baseServerRevision,
      lastError: undefined,
    });
    this.setStatus({
      state: "dirty",
      dirtySince: this.dirtyTracker.getState().dirtySince ?? Date.now(),
    });
    return this.saveNow("manual");
  }

  requestAutosave(reason: SaveReason): void {
    if (!this.initialized || this.disposed || this.hydrating) return;
    if (this.status.state === "conflict") return;

    this.syncDirtyFromAdapter();
    if (!this.dirtyTracker.isDirty() && reason === "autosave") {
      return;
    }

    const dirtySince =
      this.dirtyTracker.getState().dirtySince ?? Date.now();
    this.setStatus({ state: "dirty", dirtySince });
    this.autosaveManager?.schedule(reason);
  }

  async saveNow(reason: SaveReason): Promise<SaveOutcome> {
    if (!this.ensureReady()) {
      return {
        ok: false,
        local: false,
        cloud: false,
        error: "Save controller is not initialized",
        recoverable: false,
      };
    }

    this.syncDirtyFromAdapter();
    await this.autosaveManager?.flushLocal(reason);

    // Project switch / navigation: one cloud attempt, do not sit in retry backoff.
    if (reason === "project-switch" || reason === "navigation" || reason === "before-unload") {
      try {
        await Promise.race([
          (async () => {
            this.saveQueue?.request(reason);
            await this.saveQueue?.flush();
          })(),
          new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
        ]);
      } catch {
        /* local already saved */
      }
      return (
        this.lastOutcome ?? {
          ok: true,
          local: true,
          cloud: !this.cloudPending,
          mutationVersion: this.dirtyTracker.getMutationVersion(),
          revision: this.baseServerRevision,
          savedAt: this.lastSavedAt,
        }
      );
    }

    this.saveQueue?.request(reason);
    await this.saveQueue?.flush();
    return (
      this.lastOutcome ?? {
        ok: true,
        local: true,
        cloud: !this.cloudPending,
        mutationVersion: this.dirtyTracker.getMutationVersion(),
        revision: this.baseServerRevision,
        savedAt: this.lastSavedAt,
      }
    );
  }

  async flushPendingSave(): Promise<SaveOutcome> {
    return this.saveNow("project-switch");
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    try {
      if (this.initialized && this.dirtyTracker.isDirty()) {
        await this.autosaveManager?.flushLocal("before-unload");
      }
    } catch {
      // Best-effort local flush on dispose.
    }

    this.autosaveManager?.dispose();
    this.saveQueue?.dispose();
    this.unsubscribeNetwork?.();
    this.detachBeforeUnload();
    this.listeners.clear();
    this.initialized = false;
  }

  getStatus(): ProjectSaveStatus {
    return this.status;
  }

  subscribe(listener: ProjectSaveStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getBaseServerRevision(): number {
    return this.baseServerRevision;
  }

  getDirtyTracker(): DirtyStateTracker {
    return this.dirtyTracker;
  }

  private ensureReady(): boolean {
    return Boolean(this.initialized && this.projectId && !this.disposed);
  }

  private syncDirtyFromAdapter(): void {
    const adapterVersion = this.adapter.getMutationVersion();
    const state = this.dirtyTracker.getState();
    if (adapterVersion > state.mutationVersion) {
      this.dirtyTracker.hydrate({
        mutationVersion: adapterVersion,
        lastSavedMutationVersion: state.lastSavedMutationVersion,
        dirtySince: state.dirtySince ?? Date.now(),
      });
    } else if (
      this.adapter.hasUnsavedChanges() &&
      !this.dirtyTracker.isDirty()
    ) {
      this.dirtyTracker.markDirty();
    }
  }

  private setStatus(status: ProjectSaveStatus): void {
    this.status = status;
    for (const listener of this.listeners) {
      listener(status);
    }
    this.externalOnStatusChange?.(status);
  }

  private attachBeforeUnload(): void {
    if (typeof window === "undefined") return;
    this.beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      if (this.disposed) return;
      // Fire-and-forget local flush; beforeunload cannot await cloud.
      void this.autosaveManager?.flushLocal("before-unload");
      if (this.cloudPending || this.dirtyTracker.isDirty()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", this.beforeUnloadHandler);
  }

  private detachBeforeUnload(): void {
    if (typeof window === "undefined" || !this.beforeUnloadHandler) return;
    window.removeEventListener("beforeunload", this.beforeUnloadHandler);
    this.beforeUnloadHandler = null;
  }

  private async performLocalSave(reason: SaveReason): Promise<void> {
    if (!this.ensureReady() || this.hydrating) return;
    if (this.status.state === "conflict") return;

    const projectId = this.projectId!;
    const started = Date.now();
    const mutationVersion = Math.max(
      this.dirtyTracker.captureSaveVersion(),
      this.adapter.getMutationVersion(),
    );

    projectPersistenceLogger.info("project_save_requested", {
      projectId,
      mutationVersion,
      reason,
      baseRevision: this.baseServerRevision,
    });

    this.setStatus({ state: "saving-local" });

    try {
      const exported = await this.adapter.exportDocument(projectId);
      const document = await prepareDocumentForPersistence(
        projectId,
        this.withUpdatedMetadata(exported),
      );

      const updatedAt = nowIso();
      const syncStatus: SyncStatus = networkState.isOnline()
        ? "pending"
        : "local-only";

      const snapshot: LocalProjectSnapshotRecord = {
        projectId,
        document,
        localMutationVersion: mutationVersion,
        lastSyncedMutationVersion:
          this.dirtyTracker.getState().lastSavedMutationVersion,
        baseServerRevision: this.baseServerRevision,
        syncStatus,
        updatedAt,
      };

      await this.localRepo.putSnapshot(snapshot);
      await this.localRepo.putRecoverySnapshot({
        projectId,
        document,
        localMutationVersion: mutationVersion,
        baseServerRevision: this.baseServerRevision,
        createdAt: updatedAt,
        reason,
      });
      await this.localRepo.putPendingSave({
        projectId,
        clientMutationId: createClientMutationId(),
        baseRevision: this.baseServerRevision,
        mutationVersion,
        schemaVersion: document.schemaVersion,
        document,
        reason,
        createdAt: updatedAt,
        attempts: 0,
      });
      await this.writeSyncState({
        localMutationVersion: mutationVersion,
        lastSyncedMutationVersion:
          this.dirtyTracker.getState().lastSavedMutationVersion,
        syncStatus,
        lastLocalSavedAt: updatedAt,
        lastError: undefined,
      });

      this.cloudPending = true;
      this.lastSavedAt = updatedAt;
      this.lastOutcome = {
        ok: true,
        local: true,
        cloud: false,
        mutationVersion,
      };

      projectPersistenceLogger.info("project_local_save_completed", {
        projectId,
        mutationVersion,
        reason,
        durationMs: Date.now() - started,
      });

      if (!networkState.isOnline()) {
        this.setStatus({ state: "offline", pendingChanges: true });
      } else {
        this.setStatus({ state: "saved-local", cloudPending: true });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Local save failed";
      const logFields = {
        projectId,
        errorCode: error instanceof Error ? error.name : "unknown",
        reason,
      };
      if (error instanceof InvalidProjectDocumentError) {
        projectPersistenceLogger.error(
          "project_document_validation_failed",
          logFields,
        );
      } else {
        // Local recovery must not be reported as schema corruption. Network
        // uploads happen in performCloudSave; export/IDB failures are recoverable.
        projectPersistenceLogger.warn("project_local_save_failed", logFields);
      }
      this.lastOutcome = {
        ok: false,
        local: false,
        cloud: false,
        error: message,
        recoverable: true,
        mutationVersion,
      };
      this.setStatus({ state: "error", message, recoverable: true });
      throw error;
    }
  }

  private async performCloudSave(reason: SaveReason): Promise<void> {
    if (!this.ensureReady() || this.hydrating) return;
    if (this.status.state === "conflict") return;
    if (!networkState.isOnline()) {
      this.setStatus({ state: "offline", pendingChanges: true });
      return;
    }

    const projectId = this.projectId!;
    const started = Date.now();

    // Always re-export immediately before cloud write (never use stale queued docs).
    let mutationVersion = Math.max(
      this.dirtyTracker.captureSaveVersion(),
      this.adapter.getMutationVersion(),
    );

    this.setStatus({ state: "saving-cloud" });

    let pending = await this.localRepo.getPendingSave(projectId);
    let document: ProjectDocument;

    try {
      const exported = await this.adapter.exportDocument(projectId);
      document = await prepareDocumentForPersistence(
        projectId,
        this.withUpdatedMetadata(exported),
        this.uploadLayerRaster,
        this.uploadLayerTile,
      );
      mutationVersion = Math.max(mutationVersion, this.adapter.getMutationVersion());

      // Ensure local is at least as fresh as the cloud attempt.
      const updatedAt = nowIso();
      await this.localRepo.putSnapshot({
        projectId,
        document,
        localMutationVersion: mutationVersion,
        lastSyncedMutationVersion:
          this.dirtyTracker.getState().lastSavedMutationVersion,
        baseServerRevision: this.baseServerRevision,
        syncStatus: "syncing",
        updatedAt,
      });

      const clientMutationId =
        pending?.clientMutationId ?? createClientMutationId();
      pending = {
        projectId,
        clientMutationId,
        baseRevision: this.baseServerRevision,
        mutationVersion,
        schemaVersion: document.schemaVersion,
        document,
        reason,
        createdAt: pending?.createdAt ?? updatedAt,
        attempts: pending?.attempts ?? 0,
      };
      await this.localRepo.putPendingSave(pending);
      await this.writeSyncState({
        localMutationVersion: mutationVersion,
        syncStatus: "syncing",
        lastLocalSavedAt: updatedAt,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Cloud save prepare failed";
      this.lastOutcome = {
        ok: false,
        local: true,
        cloud: false,
        error: message,
        recoverable: true,
        mutationVersion,
      };
      this.setStatus({ state: "error", message, recoverable: true });
      return;
    }

    let attempt = pending.attempts;
    while (attempt < this.retryPolicy.maxAttempts) {
      if (this.disposed || this.getStatus().state === "conflict") return;

      try {
        const response = await this.cloudRepo.saveDocument({
          projectId,
          baseRevision: this.baseServerRevision,
          mutationVersion,
          clientMutationId: pending.clientMutationId,
          schemaVersion: document.schemaVersion,
          document,
        });

        this.baseServerRevision = response.revision;
        this.lastSavedAt = response.savedAt;
        this.cloudPending = false;
        this.dirtyTracker.markSaved(mutationVersion);
        await this.localRepo.deletePendingSave(projectId);
        await this.localRepo.putSnapshot({
          projectId,
          document,
          localMutationVersion: mutationVersion,
          lastSyncedMutationVersion: mutationVersion,
          baseServerRevision: response.revision,
          syncStatus: "synced",
          updatedAt: response.savedAt,
          checksum: response.checksum,
        });
        await this.writeSyncState({
          baseServerRevision: response.revision,
          localMutationVersion: this.dirtyTracker.getMutationVersion(),
          lastSyncedMutationVersion: mutationVersion,
          syncStatus: "synced",
          lastCloudSavedAt: response.savedAt,
          lastError: undefined,
        });

        this.lastOutcome = {
          ok: true,
          local: true,
          cloud: true,
          mutationVersion,
          revision: response.revision,
          savedAt: response.savedAt,
        };

        projectPersistenceLogger.info("project_cloud_save_completed", {
          projectId,
          mutationVersion,
          baseRevision: pending.baseRevision,
          resultingRevision: response.revision,
          reason,
          durationMs: Date.now() - started,
        });

        if (this.dirtyTracker.isDirty()) {
          this.setStatus({
            state: "dirty",
            dirtySince: this.dirtyTracker.getState().dirtySince ?? Date.now(),
          });
          this.autosaveManager?.schedule("autosave");
        } else {
          this.setStatus({
            state: "saved-cloud",
            savedAt: response.savedAt,
          });
        }
        return;
      } catch (error) {
        if (error instanceof ProjectSaveConflictError) {
          this.cloudPending = true;
          await this.writeSyncState({
            syncStatus: "conflict",
            lastError: error.message,
          });
          this.lastOutcome = {
            ok: false,
            local: true,
            cloud: false,
            error: error.message,
            recoverable: true,
            conflict: { currentRevision: error.currentRevision },
            mutationVersion,
          };
          this.setStatus({
            state: "conflict",
            currentRevision: error.currentRevision,
          });
          projectPersistenceLogger.warn("project_save_conflict", {
            projectId,
            baseRevision: this.baseServerRevision,
            resultingRevision: error.currentRevision,
          });
          return;
        }

        if (error instanceof InvalidProjectDocumentError) {
          this.cloudPending = true;
          await this.writeSyncState({
            syncStatus: "failed",
            lastError: error.message,
          });
          this.lastOutcome = {
            ok: false,
            local: true,
            cloud: false,
            error: error.message,
            recoverable: true,
            mutationVersion,
          };
          this.setStatus({
            state: "error",
            message: error.message,
            recoverable: true,
          });
          projectPersistenceLogger.error("project_document_validation_failed", {
            projectId,
            mutationVersion,
            reason,
            errorCode: "INVALID_PROJECT_DOCUMENT",
          });
          // Never retry validation failures.
          return;
        }

        const networkError =
          error instanceof ProjectSaveNetworkError
            ? error
            : new ProjectSaveNetworkError(
                error instanceof Error ? error.message : "Cloud save failed",
                { status: 0, retryable: true },
              );

        const status = networkError.status ?? 0;

        // Respect non-retryable HTTP statuses (400/401/403/404/409).
        const canRetry =
          networkError.retryable &&
          status !== 400 &&
          status !== 401 &&
          status !== 403 &&
          status !== 404 &&
          status !== 409 &&
          this.retryPolicy.shouldRetry(status);

        attempt += 1;
        pending = { ...pending, attempts: attempt };
        await this.localRepo.putPendingSave(pending);
        await this.writeSyncState({
          syncStatus: "failed",
          lastError: networkError.message,
        });

        projectPersistenceLogger.error("project_cloud_save_failed", {
          projectId,
          mutationVersion,
          reason,
          errorCode: String(status),
          durationMs: Date.now() - started,
        });

        if (!canRetry || attempt >= this.retryPolicy.maxAttempts) {
          this.cloudPending = true;
          this.lastOutcome = {
            ok: false,
            local: true,
            cloud: false,
            error: networkError.message,
            recoverable: true,
            mutationVersion,
          };
          this.setStatus({
            state: "error",
            message: networkError.message,
            recoverable: true,
          });
          return;
        }

        await waitForBackoff(attempt - 1, this.retryPolicy);
        if (!networkState.isOnline()) {
          this.setStatus({ state: "offline", pendingChanges: true });
          return;
        }
        this.setStatus({ state: "saving-cloud" });
      }
    }
  }

  private withUpdatedMetadata(document: ProjectDocument): ProjectDocument {
    const updatedAt = nowIso();
    return {
      ...document,
      metadata: {
        ...document.metadata,
        updatedAt,
        applicationVersion:
          document.metadata.applicationVersion || APPLICATION_VERSION,
      },
    };
  }

  private async writeSyncState(
    patch: Partial<ProjectSyncStateRecord>,
  ): Promise<void> {
    if (!this.projectId) return;
    const existing = await this.localRepo.getSyncState(this.projectId);
    const record: ProjectSyncStateRecord = {
      projectId: this.projectId,
      baseServerRevision:
        patch.baseServerRevision ??
        existing?.baseServerRevision ??
        this.baseServerRevision,
      localMutationVersion:
        patch.localMutationVersion ??
        existing?.localMutationVersion ??
        this.dirtyTracker.getMutationVersion(),
      lastSyncedMutationVersion:
        patch.lastSyncedMutationVersion ??
        existing?.lastSyncedMutationVersion ??
        0,
      syncStatus: patch.syncStatus ?? existing?.syncStatus ?? "local-only",
      lastLocalSavedAt: patch.lastLocalSavedAt ?? existing?.lastLocalSavedAt,
      lastCloudSavedAt: patch.lastCloudSavedAt ?? existing?.lastCloudSavedAt,
      lastError:
        patch.lastError !== undefined ? patch.lastError : existing?.lastError,
      updatedAt: nowIso(),
    };
    await this.localRepo.putSyncState(record);
  }
}

export function createProjectSaveController(
  options: ProjectSaveControllerOptions,
): ProjectSaveControllerImpl {
  return new ProjectSaveControllerImpl(options);
}
