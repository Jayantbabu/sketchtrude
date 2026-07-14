import type { ProjectDocument } from "@/features/projects/domain/project-document";
import type { EngineDocumentChangeEvent } from "./engine-document-events";

/**
 * Boundary between the live engine and the persistence layer.
 * The engine must not call APIs, manage autosave, or resolve conflicts.
 */
export interface EngineDocumentAdapter {
  exportDocument(projectId: string): Promise<ProjectDocument>;
  importDocument(document: ProjectDocument): Promise<void>;
  subscribeToChanges(
    listener: (event: EngineDocumentChangeEvent) => void,
  ): () => void;
  hasUnsavedChanges(): boolean;
  getMutationVersion(): number;
}
