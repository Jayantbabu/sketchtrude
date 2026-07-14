export type SyncStatus =
  | "local-only"
  | "pending"
  | "syncing"
  | "synced"
  | "failed"
  | "conflict";

export type LocalLoadCandidate = {
  valid: boolean;
  baseServerRevision: number;
  localMutationVersion: number;
  lastSyncedMutationVersion: number;
  syncStatus: SyncStatus;
  updatedAt?: string;
  corrupt?: boolean;
} | null;

export type CloudLoadCandidate = {
  valid: boolean;
  revision: number;
  updatedAt?: string;
} | null;

export type LoadSourceDecision =
  | { source: "empty" }
  | { source: "local"; mode?: "offline" | "resume-sync" }
  | { source: "cloud"; retainCorruptLocal?: boolean }
  | { source: "conflict" }
  | { source: "failure"; reason: string };

function hasPendingEdits(local: NonNullable<LocalLoadCandidate>): boolean {
  if (local.syncStatus === "pending" || local.syncStatus === "failed") {
    return true;
  }
  if (local.syncStatus === "local-only") return true;
  return local.localMutationVersion > local.lastSyncedMutationVersion;
}

function isFullySynced(local: NonNullable<LocalLoadCandidate>): boolean {
  return (
    local.syncStatus === "synced" &&
    local.localMutationVersion <= local.lastSyncedMutationVersion
  );
}

/**
 * Recovery selection rules from the implementation brief.
 */
export function chooseLoadSource(
  local: LocalLoadCandidate,
  cloud: CloudLoadCandidate,
): LoadSourceDecision {
  const localOk = Boolean(local?.valid && !local.corrupt);
  const cloudOk = Boolean(cloud?.valid);
  const localCorrupt = Boolean(local && (local.corrupt || !local.valid));

  // Brand-new project: nothing stored locally or in the cloud yet.
  if (local == null && cloud == null) {
    return { source: "empty" };
  }

  // No usable data (e.g. cloud fetch failed and nothing local) — open empty rather than hard-fail.
  if (!localOk && !cloudOk && !localCorrupt) {
    return { source: "empty" };
  }

  if (!localOk && !cloudOk) {
    return {
      source: "failure",
      reason: "Both local and cloud project documents failed to load",
    };
  }

  if (localCorrupt && cloudOk) {
    return { source: "cloud", retainCorruptLocal: true };
  }

  if (!cloudOk && localOk && local) {
    return { source: "local", mode: "offline" };
  }

  if (!localOk && cloudOk) {
    return { source: "cloud" };
  }

  if (localOk && cloudOk && local && cloud) {
    const pending = hasPendingEdits(local);
    const cloudNewer = cloud.revision > local.baseServerRevision;
    const revisionsMatch = cloud.revision === local.baseServerRevision;

    if (revisionsMatch && pending) {
      return { source: "local", mode: "resume-sync" };
    }

    if (isFullySynced(local) && cloudNewer) {
      return { source: "cloud" };
    }

    if (pending && cloudNewer) {
      return { source: "conflict" };
    }

    if (cloudNewer) {
      return { source: "cloud" };
    }

    if (pending) {
      return { source: "local", mode: "resume-sync" };
    }

    return { source: "cloud" };
  }

  return {
    source: "failure",
    reason: "Unable to choose a safe load source",
  };
}
