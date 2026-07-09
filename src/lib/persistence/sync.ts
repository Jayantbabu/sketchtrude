import { saveLocalDocument, loadLocalDocument } from "./local";

const CLOUD_SYNC_DEBOUNCE_MS = 30_000;
const LOCAL_SAVE_DEBOUNCE_MS = 10_000;

type SyncBridgeOptions = {
  projectId: string;
  getDocumentData: () => unknown;
  onSyncStatus?: (status: "idle" | "syncing" | "synced" | "error") => void;
};

export class SyncBridge {
  private projectId: string;
  private getDocumentData: () => unknown;
  private onSyncStatus?: SyncBridgeOptions["onSyncStatus"];
  private localTimer: ReturnType<typeof setTimeout> | null = null;
  private cloudTimer: ReturnType<typeof setTimeout> | null = null;
  private onlineHandler: () => void;
  private offlineHandler: () => void;

  constructor(options: SyncBridgeOptions) {
    this.projectId = options.projectId;
    this.getDocumentData = options.getDocumentData;
    this.onSyncStatus = options.onSyncStatus;

    this.onlineHandler = () => this.syncToCloud();
    this.offlineHandler = () => this.onSyncStatus?.("idle");

    if (typeof window !== "undefined") {
      window.addEventListener("online", this.onlineHandler);
      window.addEventListener("offline", this.offlineHandler);
    }
  }

  scheduleSave() {
    if (this.localTimer) clearTimeout(this.localTimer);
    this.localTimer = setTimeout(() => this.saveLocal(), LOCAL_SAVE_DEBOUNCE_MS);

    if (navigator.onLine) {
      if (this.cloudTimer) clearTimeout(this.cloudTimer);
      this.cloudTimer = setTimeout(
        () => this.syncToCloud(),
        CLOUD_SYNC_DEBOUNCE_MS
      );
    }
  }

  async saveLocal() {
    const data = this.getDocumentData();
    await saveLocalDocument(this.projectId, data);
  }

  async syncToCloud() {
    if (!navigator.onLine) return;

    this.onSyncStatus?.("syncing");

    try {
      const data = this.getDocumentData();
      await saveLocalDocument(this.projectId, data);

      const res = await fetch(`/api/projects/${this.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: data }),
      });

      if (!res.ok) throw new Error("Cloud sync failed");
      this.onSyncStatus?.("synced");
    } catch {
      this.onSyncStatus?.("error");
    }
  }

  async restore(): Promise<unknown | null> {
    const local = await loadLocalDocument(this.projectId);
    if (local) return local.data;

    if (navigator.onLine) {
      const res = await fetch(`/api/projects/${this.projectId}`);
      if (res.ok) {
        const project = await res.json();
        return project.metadata;
      }
    }

    return null;
  }

  destroy() {
    if (this.localTimer) clearTimeout(this.localTimer);
    if (this.cloudTimer) clearTimeout(this.cloudTimer);
    window.removeEventListener("online", this.onlineHandler);
    window.removeEventListener("offline", this.offlineHandler);
  }
}
