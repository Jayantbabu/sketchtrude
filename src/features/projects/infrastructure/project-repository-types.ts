import type { ProjectDocument } from "@/features/projects/domain/project-document";
import type {
  LoadedProjectDocument,
  ProjectRevisionSummary,
  SaveProjectDocumentRequest,
  SaveProjectDocumentResponse,
} from "@/features/projects/domain/project-revision";
import type { SyncStatus } from "@/persistence/recovery/recovery-policy";

export type LocalProjectSnapshotRecord = {
  projectId: string;
  document: ProjectDocument;
  localMutationVersion: number;
  lastSyncedMutationVersion: number;
  baseServerRevision: number;
  syncStatus: SyncStatus;
  updatedAt: string;
  checksum?: string;
};

export type ProjectSyncStateRecord = {
  projectId: string;
  baseServerRevision: number;
  localMutationVersion: number;
  lastSyncedMutationVersion: number;
  syncStatus: SyncStatus;
  lastLocalSavedAt?: string;
  lastCloudSavedAt?: string;
  lastError?: string;
  updatedAt: string;
};

export type PendingProjectSaveRecord = {
  projectId: string;
  clientMutationId: string;
  baseRevision: number;
  mutationVersion: number;
  schemaVersion: number;
  document: ProjectDocument;
  checksum?: string;
  reason: string;
  createdAt: string;
  attempts: number;
};

export type ProjectRecoverySnapshotRecord = {
  projectId: string;
  document: ProjectDocument;
  localMutationVersion: number;
  baseServerRevision: number;
  createdAt: string;
  reason: string;
  checksum?: string;
};

export interface ProjectLocalRepository {
  getSnapshot(projectId: string): Promise<LocalProjectSnapshotRecord | undefined>;
  putSnapshot(record: LocalProjectSnapshotRecord): Promise<void>;
  deleteSnapshot(projectId: string): Promise<void>;
  getSyncState(projectId: string): Promise<ProjectSyncStateRecord | undefined>;
  putSyncState(record: ProjectSyncStateRecord): Promise<void>;
  getPendingSave(projectId: string): Promise<PendingProjectSaveRecord | undefined>;
  putPendingSave(record: PendingProjectSaveRecord): Promise<void>;
  deletePendingSave(projectId: string): Promise<void>;
  putRecoverySnapshot(record: ProjectRecoverySnapshotRecord): Promise<void>;
  getLatestRecoverySnapshot(
    projectId: string,
  ): Promise<ProjectRecoverySnapshotRecord | undefined>;
}

export interface ProjectCloudRepository {
  loadDocument(projectId: string): Promise<LoadedProjectDocument | null>;
  saveDocument(
    request: SaveProjectDocumentRequest,
  ): Promise<SaveProjectDocumentResponse>;
  loadRevision?(
    projectId: string,
    revisionId: string,
  ): Promise<LoadedProjectDocument>;
  listRevisions?(projectId: string): Promise<ProjectRevisionSummary[]>;
}
