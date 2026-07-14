export type ProjectPersistenceEventName =
  | "project_load_started"
  | "project_load_local_found"
  | "project_load_cloud_found"
  | "project_load_recovery_selected"
  | "project_load_completed"
  | "project_save_requested"
  | "project_local_save_completed"
  | "project_cloud_save_started"
  | "project_cloud_save_completed"
  | "project_cloud_save_failed"
  | "project_save_conflict"
  | "project_document_validation_failed"
  | "project_document_migration_completed";

export type ProjectPersistenceLogFields = {
  projectId?: string;
  mutationVersion?: number;
  baseRevision?: number;
  resultingRevision?: number;
  reason?: string;
  documentSize?: number;
  durationMs?: number;
  errorCode?: string;
  [key: string]: unknown;
};

type LogLevel = "debug" | "info" | "warn" | "error";

function write(
  level: LogLevel,
  event: ProjectPersistenceEventName,
  fields: ProjectPersistenceLogFields = {},
): void {
  const payload = {
    scope: "project-persistence",
    event,
    ...fields,
    ts: new Date().toISOString(),
  };

  // Never log full project documents.
  if ("document" in payload) {
    delete (payload as Record<string, unknown>).document;
  }

  const line = `[project-persistence] ${event}`;
  switch (level) {
    case "debug":
      console.debug(line, payload);
      break;
    case "info":
      console.info(line, payload);
      break;
    case "warn":
      console.warn(line, payload);
      break;
    case "error":
      console.error(line, payload);
      break;
  }
}

export const projectPersistenceLogger = {
  debug(event: ProjectPersistenceEventName, fields?: ProjectPersistenceLogFields) {
    write("debug", event, fields);
  },
  info(event: ProjectPersistenceEventName, fields?: ProjectPersistenceLogFields) {
    write("info", event, fields);
  },
  warn(event: ProjectPersistenceEventName, fields?: ProjectPersistenceLogFields) {
    write("warn", event, fields);
  },
  error(event: ProjectPersistenceEventName, fields?: ProjectPersistenceLogFields) {
    write("error", event, fields);
  },
};
