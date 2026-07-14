export type EngineDocumentChangeType =
  | "object-created"
  | "object-updated"
  | "object-deleted"
  | "layer-updated"
  | "resource-updated"
  | "view-updated"
  | "settings-updated"
  | "bulk-update";

export type EngineDocumentChangeEvent = {
  mutationId: string;
  mutationVersion: number;
  type: EngineDocumentChangeType;
  affectedObjectIds?: string[];
  timestamp: number;
};

export type SketchtrudeExportDocumentMessage = {
  type: "sketchtrude-export-document";
};

export type SketchtrudeExportDocumentResultMessage = {
  type: "sketchtrude-export-document-result";
  document: unknown;
  error?: string;
};

export type SketchtrudeImportDocumentMessage = {
  type: "sketchtrude-import-document";
  document: unknown;
};

export type SketchtrudeImportDocumentResultMessage = {
  type: "sketchtrude-import-document-result";
  ok?: boolean;
  error?: string;
};

export type SketchtrudeDocumentChangedMessage = {
  type: "sketchtrude-document-changed";
  event: EngineDocumentChangeEvent;
};

/** Engine → parent: iframe runtime is ready for import/export. */
export type SketchtrudeEngineReadyMessage = {
  type: "sketchtrude-engine-ready";
  projectId?: string;
};

/** Parent → engine: no local/cloud document; start a blank canvas. */
export type SketchtrudeStartFreshMessage = {
  type: "sketchtrude-start-fresh";
  projectId?: string;
};

export type SketchtrudeEngineBridgeMessage =
  | SketchtrudeExportDocumentMessage
  | SketchtrudeExportDocumentResultMessage
  | SketchtrudeImportDocumentMessage
  | SketchtrudeImportDocumentResultMessage
  | SketchtrudeDocumentChangedMessage
  | SketchtrudeEngineReadyMessage
  | SketchtrudeStartFreshMessage;
