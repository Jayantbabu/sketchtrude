export type {
  Vector3,
  CanvasUnit,
  CanvasBackground,
  GridSettings,
  SnapSettings,
  PerspectiveAssistSettings,
  DrawingAssistSettings,
  ProjectLayer,
  ObjectTransform,
  BaseProjectObject,
  ImageObject,
  WindowObject,
  ProjectObject,
  MaterialResource,
  ImageResource,
  TextureResource,
  AssetSyncStatus,
  ProjectDocumentMetadata,
  ProjectDocumentCanvas,
  ProjectDocumentViews,
  ProjectDocumentSettings,
  ProjectDocument,
  LegacyStudioLayerMeta,
  LegacyStudioDocument,
  CreateEmptyProjectDocumentMeta,
} from "./project-document";

export {
  CURRENT_PROJECT_SCHEMA_VERSION as DOCUMENT_SCHEMA_VERSION,
  APPLICATION_VERSION,
  createEmptyProjectDocument,
  projectDocumentFromLegacyStudio,
  legacyStudioFromProjectDocument,
  stripLegacyStudioBlobs,
} from "./project-document";

export {
  projectDocumentSchema,
  CURRENT_PROJECT_SCHEMA_VERSION,
} from "./project-document-schema";

export { migrateProjectDocument } from "./project-document-migrations";

export type {
  ProjectRevisionSummary,
  LoadedProjectDocument,
  SaveProjectDocumentRequest,
  SaveProjectDocumentResponse,
} from "./project-revision";

export type { ProjectSaveStatus } from "./project-save-status";

export {
  InvalidProjectDocumentError,
  UnsupportedSchemaVersionError,
  ProjectSaveConflictError,
  ProjectSaveNetworkError,
  ProjectLoadError,
  ProjectRecoveryError,
} from "./project-errors";
