import type { ProjectApiRepository } from "@/features/projects/infrastructure/project-api-repository";
import type { ProjectIndexedDbRepository } from "@/features/projects/infrastructure/project-indexeddb-repository";
import {
  RecoveryManager,
  type CloudLoadCandidate,
  type LoadSourceDecision,
  type LocalLoadCandidate,
} from "@/persistence/recovery/recovery-manager";
import { migrateProjectDocument } from "@/features/projects/domain/project-document-migrations";

export type ProjectRecoveryEvaluation = {
  decision: LoadSourceDecision;
  local: LocalLoadCandidate;
  cloud: CloudLoadCandidate;
};

export type ProjectRecoveryControllerOptions = {
  projectId: string;
  localRepo: ProjectIndexedDbRepository;
  cloudRepo: ProjectApiRepository;
};

/**
 * Thin wrapper around RecoveryManager for conflict / recovery UI later.
 * Does not import into the engine or mutate save state.
 */
export class ProjectRecoveryController {
  private readonly projectId: string;
  private readonly localRepo: ProjectIndexedDbRepository;
  private readonly cloudRepo: ProjectApiRepository;

  constructor(options: ProjectRecoveryControllerOptions) {
    this.projectId = options.projectId;
    this.localRepo = options.localRepo;
    this.cloudRepo = options.cloudRepo;
  }

  async evaluate(): Promise<ProjectRecoveryEvaluation> {
    const manager = new RecoveryManager({
      projectId: this.projectId,
      loadLocal: () => this.loadLocalCandidate(),
      loadCloud: () => this.loadCloudCandidate(),
    });
    return manager.chooseSafeLoadSource();
  }

  async loadLocalCandidate(): Promise<LocalLoadCandidate> {
    try {
      const snapshot = await this.localRepo.getSnapshot(this.projectId);
      if (!snapshot) return null;
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
        baseServerRevision: 0,
        localMutationVersion: 0,
        lastSyncedMutationVersion: 0,
        syncStatus: "failed",
      };
    }
  }

  async loadCloudCandidate(): Promise<CloudLoadCandidate> {
    try {
      const loaded = await this.cloudRepo.loadDocument(this.projectId);
      if (!loaded) return null;
      migrateProjectDocument(loaded.document);
      return {
        valid: true,
        revision: loaded.revision,
        updatedAt: loaded.updatedAt,
      };
    } catch {
      return { valid: false, revision: 0 };
    }
  }
}

export function createProjectRecoveryController(
  options: ProjectRecoveryControllerOptions,
): ProjectRecoveryController {
  return new ProjectRecoveryController(options);
}
