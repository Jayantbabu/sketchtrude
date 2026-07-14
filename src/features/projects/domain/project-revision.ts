import type { ProjectDocument } from "./project-document";

export type ProjectRevisionSummary = {
  revision: number;
  savedAt: string;
  schemaVersion: number;
  checksum?: string;
  clientMutationId?: string;
};

export type LoadedProjectDocument = {
  projectId: string;
  revision: number;
  schemaVersion: number;
  updatedAt: string;
  checksum?: string;
  document: ProjectDocument;
};

export type SaveProjectDocumentRequest = {
  projectId: string;
  baseRevision: number;
  mutationVersion: number;
  clientMutationId: string;
  schemaVersion: number;
  document: ProjectDocument;
  checksum?: string;
};

export type SaveProjectDocumentResponse = {
  projectId: string;
  revision: number;
  savedAt: string;
  clientMutationId: string;
  checksum?: string;
};
