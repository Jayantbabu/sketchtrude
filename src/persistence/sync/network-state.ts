export type NetworkStatus = "online" | "offline";

export type NetworkStateListener = (status: NetworkStatus) => void;

/**
 * Browser online/offline listener for cloud sync gating.
 */
export class NetworkState {
  private listeners = new Set<NetworkStateListener>();
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;
  private started = false;

  isOnline(): boolean {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  }

  getStatus(): NetworkStatus {
    return this.isOnline() ? "online" : "offline";
  }

  subscribe(listener: NetworkStateListener): () => void {
    this.listeners.add(listener);
    this.ensureStarted();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  private ensureStarted(): void {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    this.onlineHandler = () => this.emit("online");
    this.offlineHandler = () => this.emit("offline");
    window.addEventListener("online", this.onlineHandler);
    window.addEventListener("offline", this.offlineHandler);
  }

  private emit(status: NetworkStatus): void {
    for (const listener of this.listeners) {
      listener(status);
    }
  }

  stop(): void {
    if (!this.started || typeof window === "undefined") return;
    if (this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
    }
    if (this.offlineHandler) {
      window.removeEventListener("offline", this.offlineHandler);
    }
    this.onlineHandler = null;
    this.offlineHandler = null;
    this.started = false;
  }
}

export const networkState = new NetworkState();
