import {
  legacyStudioFromProjectDocument,
  projectDocumentFromLegacyStudio,
  type LegacyStudioDocument,
  type ProjectDocument,
  type CreateEmptyProjectDocumentMeta,
} from "@/features/projects/domain/project-document";

/**
 * Serialize a ProjectDocument to the legacy StudioDocument payload
 * expected by the current engine / transitional API.
 */
export function serializeProjectDocument(
  document: ProjectDocument,
): LegacyStudioDocument {
  return legacyStudioFromProjectDocument(document);
}

/**
 * Deserialize a legacy StudioDocument into a ProjectDocument.
 */
export function deserializeProjectDocument(
  projectId: string,
  legacy: LegacyStudioDocument,
  meta?: CreateEmptyProjectDocumentMeta,
): ProjectDocument {
  return projectDocumentFromLegacyStudio(projectId, legacy, meta);
}

export { legacyStudioFromProjectDocument, projectDocumentFromLegacyStudio };
