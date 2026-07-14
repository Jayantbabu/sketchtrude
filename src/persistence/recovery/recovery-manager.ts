import {
  chooseLoadSource,
  type CloudLoadCandidate,
  type LoadSourceDecision,
  type LocalLoadCandidate,
} from "./recovery-policy";
import { ProjectRecoveryError } from "@/features/projects/domain/project-errors";
import { projectPersistenceLogger } from "@/shared/logging/project-persistence-logger";

export type RecoveryManagerOptions = {
  projectId: string;
  loadLocal: () => Promise<LocalLoadCandidate>;
  loadCloud: () => Promise<CloudLoadCandidate>;
};

/**
 * Loads local + cloud candidates and applies recovery selection rules.
 */
export class RecoveryManager {
  private readonly projectId: string;
  private readonly loadLocal: RecoveryManagerOptions["loadLocal"];
  private readonly loadCloud: RecoveryManagerOptions["loadCloud"];

  constructor(options: RecoveryManagerOptions) {
    this.projectId = options.projectId;
    this.loadLocal = options.loadLocal;
    this.loadCloud = options.loadCloud;
  }

  async chooseSafeLoadSource(): Promise<{
    decision: LoadSourceDecision;
    local: LocalLoadCandidate;
    cloud: CloudLoadCandidate;
  }> {
    projectPersistenceLogger.info("project_load_started", {
      projectId: this.projectId,
    });

    let local: LocalLoadCandidate = null;
    let cloud: CloudLoadCandidate = null;

    try {
      local = await this.loadLocal();
      if (local?.valid) {
        projectPersistenceLogger.info("project_load_local_found", {
          projectId: this.projectId,
          baseRevision: local.baseServerRevision,
          mutationVersion: local.localMutationVersion,
        });
      }
    } catch (error) {
      projectPersistenceLogger.warn("project_load_local_found", {
        projectId: this.projectId,
        errorCode: error instanceof Error ? error.name : "unknown",
      });
      local = { valid: false, corrupt: true, baseServerRevision: 0, localMutationVersion: 0, lastSyncedMutationVersion: 0, syncStatus: "failed" };
    }

    try {
      cloud = await this.loadCloud();
      if (cloud?.valid) {
        projectPersistenceLogger.info("project_load_cloud_found", {
          projectId: this.projectId,
          baseRevision: cloud.revision,
        });
      }
    } catch {
      cloud = { valid: false, revision: 0 };
    }

    const decision = chooseLoadSource(local, cloud);

    projectPersistenceLogger.info("project_load_recovery_selected", {
      projectId: this.projectId,
      reason: decision.source,
    });

    if (decision.source === "failure") {
      throw new ProjectRecoveryError(decision.reason);
    }

    return { decision, local, cloud };
  }
}

export { chooseLoadSource } from "./recovery-policy";
export type {
  CloudLoadCandidate,
  LocalLoadCandidate,
  LoadSourceDecision,
  SyncStatus,
} from "./recovery-policy";
