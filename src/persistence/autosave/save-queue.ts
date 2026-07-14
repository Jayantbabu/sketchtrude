import {
  chooseHigherPriority,
  type SaveReason,
} from "./save-request";

export type PerformSaveFn = (reason: SaveReason) => Promise<void>;

/**
 * Single-flight cloud/local save queue per project.
 * Coalesces repeated requests; never caches stale document snapshots —
 * `performSave` should serialize immediately before writing.
 */
export class ProjectSaveQueue {
  private isSaving = false;
  private saveRequested = false;
  private highestPriorityReason: SaveReason | null = null;
  private disposed = false;
  private processPromise: Promise<void> | null = null;
  private readonly performSave: PerformSaveFn;

  constructor(performSave: PerformSaveFn) {
    this.performSave = performSave;
  }

  request(reason: SaveReason): void {
    if (this.disposed) return;
    this.saveRequested = true;
    this.highestPriorityReason = chooseHigherPriority(
      this.highestPriorityReason,
      reason,
    );
    void this.process();
  }

  /** Wait until the queue drains (including coalesced follow-up saves). */
  async flush(): Promise<void> {
    if (this.disposed) return;
    if (!this.isSaving && !this.saveRequested) return;
    this.saveRequested = true;
    this.highestPriorityReason = chooseHigherPriority(
      this.highestPriorityReason,
      "manual",
    );
    await this.process();
  }

  isBusy(): boolean {
    return this.isSaving;
  }

  dispose(): void {
    this.disposed = true;
    this.saveRequested = false;
    this.highestPriorityReason = null;
  }

  private async process(): Promise<void> {
    if (this.processPromise) {
      return this.processPromise;
    }

    this.processPromise = this.runLoop();
    try {
      await this.processPromise;
    } finally {
      this.processPromise = null;
    }
  }

  private async runLoop(): Promise<void> {
    if (this.isSaving) return;
    this.isSaving = true;
    try {
      while (this.saveRequested && !this.disposed) {
        this.saveRequested = false;
        const reason = this.highestPriorityReason ?? "autosave";
        this.highestPriorityReason = null;
        await this.performSave(reason);
      }
    } finally {
      this.isSaving = false;
    }
  }
}
