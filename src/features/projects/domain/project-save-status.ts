/**
 * Discriminated save/load UI status — exact shapes from the implementation brief.
 */
export type ProjectSaveStatus =
  | { state: "initializing" }
  | { state: "loading" }
  | { state: "ready-clean"; lastSavedAt?: string }
  | { state: "dirty"; dirtySince: number }
  | { state: "saving-local" }
  | { state: "saved-local"; cloudPending: true }
  | { state: "saving-cloud" }
  | { state: "saved-cloud"; savedAt: string }
  | { state: "offline"; pendingChanges: true }
  | { state: "conflict"; currentRevision: number }
  | { state: "error"; message: string; recoverable: boolean };
