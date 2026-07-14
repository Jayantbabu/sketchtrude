import type { SaveReason } from "./save-request";

export const LOCAL_AUTOSAVE_DEBOUNCE_MS = 400;
export const CLOUD_AUTOSAVE_DEBOUNCE_MS = 2000;

export type AutosaveManagerOptions = {
  onLocalSave: (reason: SaveReason) => void | Promise<void>;
  onCloudSave: (reason: SaveReason) => void | Promise<void>;
  localDebounceMs?: number;
  cloudDebounceMs?: number;
  isOnline?: () => boolean;
};

/**
 * Debounced local recovery + cloud autosave scheduler.
 * Local: 400ms. Cloud: 2000ms. Immediate flush helpers for project switch / unload.
 */
export class AutosaveManager {
  private localTimer: ReturnType<typeof setTimeout> | null = null;
  private cloudTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private readonly onLocalSave: AutosaveManagerOptions["onLocalSave"];
  private readonly onCloudSave: AutosaveManagerOptions["onCloudSave"];
  private readonly localDebounceMs: number;
  private readonly cloudDebounceMs: number;
  private readonly isOnline: () => boolean;

  constructor(options: AutosaveManagerOptions) {
    this.onLocalSave = options.onLocalSave;
    this.onCloudSave = options.onCloudSave;
    this.localDebounceMs = options.localDebounceMs ?? LOCAL_AUTOSAVE_DEBOUNCE_MS;
    this.cloudDebounceMs = options.cloudDebounceMs ?? CLOUD_AUTOSAVE_DEBOUNCE_MS;
    this.isOnline = options.isOnline ?? (() =>
      typeof navigator === "undefined" ? true : navigator.onLine);
  }

  /** Schedule debounced local + cloud saves after a committed mutation. */
  schedule(reason: SaveReason = "autosave"): void {
    if (this.disposed) return;
    this.scheduleLocal(reason);
    if (this.isOnline()) {
      this.scheduleCloud(reason);
    }
  }

  scheduleLocal(reason: SaveReason = "autosave"): void {
    if (this.disposed) return;
    if (this.localTimer) clearTimeout(this.localTimer);
    this.localTimer = setTimeout(() => {
      this.localTimer = null;
      void this.onLocalSave(reason);
    }, this.localDebounceMs);
  }

  scheduleCloud(reason: SaveReason = "autosave"): void {
    if (this.disposed) return;
    if (!this.isOnline()) return;
    if (this.cloudTimer) clearTimeout(this.cloudTimer);
    this.cloudTimer = setTimeout(() => {
      this.cloudTimer = null;
      void this.onCloudSave(reason);
    }, this.cloudDebounceMs);
  }

  /** Immediate local write (e.g. before project switch). */
  async flushLocal(reason: SaveReason = "project-switch"): Promise<void> {
    if (this.localTimer) {
      clearTimeout(this.localTimer);
      this.localTimer = null;
    }
    await this.onLocalSave(reason);
  }

  /** Immediate cloud write. */
  async flushCloud(reason: SaveReason = "project-switch"): Promise<void> {
    if (this.cloudTimer) {
      clearTimeout(this.cloudTimer);
      this.cloudTimer = null;
    }
    if (!this.isOnline()) return;
    await this.onCloudSave(reason);
  }

  async flushAll(reason: SaveReason = "project-switch"): Promise<void> {
    await this.flushLocal(reason);
    await this.flushCloud(reason);
  }

  dispose(): void {
    this.disposed = true;
    if (this.localTimer) clearTimeout(this.localTimer);
    if (this.cloudTimer) clearTimeout(this.cloudTimer);
    this.localTimer = null;
    this.cloudTimer = null;
  }
}
