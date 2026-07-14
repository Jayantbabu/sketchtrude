export type DirtyState = {
  mutationVersion: number;
  lastSavedMutationVersion: number;
  dirtySince: number | null;
};

/**
 * Tracks committed document mutations for autosave / clean marking.
 * Preview interactions must NOT call markDirty.
 */
export class DirtyStateTracker {
  private mutationVersion = 0;
  private lastSavedMutationVersion = 0;
  private dirtySince: number | null = null;

  getState(): DirtyState {
    return {
      mutationVersion: this.mutationVersion,
      lastSavedMutationVersion: this.lastSavedMutationVersion,
      dirtySince: this.dirtySince,
    };
  }

  getMutationVersion(): number {
    return this.mutationVersion;
  }

  isDirty(): boolean {
    return this.mutationVersion > this.lastSavedMutationVersion;
  }

  /** Increment mutation version after a committed document change. */
  markDirty(at: number = Date.now()): number {
    this.mutationVersion += 1;
    if (this.dirtySince == null) {
      this.dirtySince = at;
    }
    return this.mutationVersion;
  }

  /** Capture the version being saved (call when a save starts). */
  captureSaveVersion(): number {
    return this.mutationVersion;
  }

  /**
   * Mark clean up to a captured save version.
   * If newer edits landed during save, remains dirty.
   */
  markSaved(savedMutationVersion: number, at: number = Date.now()): void {
    if (savedMutationVersion < this.lastSavedMutationVersion) {
      return;
    }
    this.lastSavedMutationVersion = savedMutationVersion;
    if (this.mutationVersion <= this.lastSavedMutationVersion) {
      this.dirtySince = null;
    } else if (this.dirtySince == null) {
      this.dirtySince = at;
    }
  }

  /** Reset tracker after a fresh load / hydration. */
  reset(mutationVersion = 0): void {
    this.mutationVersion = mutationVersion;
    this.lastSavedMutationVersion = mutationVersion;
    this.dirtySince = null;
  }

  hydrate(state: DirtyState): void {
    this.mutationVersion = state.mutationVersion;
    this.lastSavedMutationVersion = state.lastSavedMutationVersion;
    this.dirtySince = state.dirtySince;
  }
}
