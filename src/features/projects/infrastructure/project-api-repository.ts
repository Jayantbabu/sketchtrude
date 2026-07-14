import {
  projectDocumentFromLegacyStudio,
  type LegacyStudioDocument,
  type ProjectDocument,
} from "@/features/projects/domain/project-document";
import { migrateProjectDocument } from "@/features/projects/domain/project-document-migrations";
import {
  InvalidProjectDocumentError,
  ProjectLoadError,
  ProjectSaveConflictError,
  ProjectSaveNetworkError,
} from "@/features/projects/domain/project-errors";
import type {
  LoadedProjectDocument,
  SaveProjectDocumentRequest,
  SaveProjectDocumentResponse,
} from "@/features/projects/domain/project-revision";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "@/features/projects/domain/project-document-schema";
import { projectPersistenceLogger } from "@/shared/logging/project-persistence-logger";
import { shouldRetry } from "@/persistence/autosave/retry-policy";
import type { ProjectCloudRepository } from "./project-repository-types";

function isLegacyStudioDocument(value: unknown): value is LegacyStudioDocument {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.version === "number" &&
    typeof record.savedAt === "number" &&
    record.doc != null &&
    typeof record.doc === "object" &&
    Array.isArray(record.layers) &&
    record.schemaVersion == null
  );
}

function isNewLoadedEnvelope(value: unknown): value is {
  projectId: string;
  revision: number;
  schemaVersion: number;
  updatedAt: string;
  checksum?: string;
  document: unknown;
} {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.projectId === "string" &&
    typeof record.revision === "number" &&
    typeof record.schemaVersion === "number" &&
    record.document != null &&
    typeof record.document === "object"
  );
}

function isProjectDocumentLike(value: unknown): value is ProjectDocument {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.schemaVersion === "number" &&
    typeof record.projectId === "string" &&
    record.canvas != null &&
    record.scene != null
  );
}

export function normalizeLoadedDocument(
  projectId: string,
  body: unknown,
): LoadedProjectDocument | null {
  if (body == null) return null;

  if (isNewLoadedEnvelope(body)) {
    const document = migrateProjectDocument(body.document);
    return {
      projectId: body.projectId || projectId,
      revision: body.revision,
      schemaVersion: body.schemaVersion,
      updatedAt: body.updatedAt ?? new Date().toISOString(),
      checksum: body.checksum,
      document,
    };
  }

  // Transition: raw StudioDocument (old GET shape)
  if (isLegacyStudioDocument(body)) {
    const document = projectDocumentFromLegacyStudio(projectId, body);
    return {
      projectId,
      revision: 0,
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      updatedAt: new Date(body.savedAt || Date.now()).toISOString(),
      document,
    };
  }

  // Bare ProjectDocument
  if (isProjectDocumentLike(body)) {
    const document = migrateProjectDocument(body);
    return {
      projectId: document.projectId || projectId,
      revision: 0,
      schemaVersion: document.schemaVersion,
      updatedAt: document.metadata.updatedAt,
      document,
    };
  }

  throw new ProjectLoadError("Unrecognized project document response shape");
}

export type ProjectApiRepositoryOptions = {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
};

export class ProjectApiRepository implements ProjectCloudRepository {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: ProjectApiRepositoryOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.baseUrl = options.baseUrl ?? "";
  }

  private documentUrl(projectId: string): string {
    return `${this.baseUrl}/api/projects/${encodeURIComponent(projectId)}/document`;
  }

  async loadDocument(projectId: string): Promise<LoadedProjectDocument | null> {
    const started = Date.now();
    const res = await this.fetchImpl(this.documentUrl(projectId), {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw new ProjectLoadError(
        `Failed to load project document (${res.status})`,
      );
    }

    const body = await res.json().catch(() => null);
    if (body == null) return null;

    const loaded = normalizeLoadedDocument(projectId, body);
    projectPersistenceLogger.info("project_load_cloud_found", {
      projectId,
      baseRevision: loaded?.revision,
      durationMs: Date.now() - started,
    });
    return loaded;
  }

  async saveDocument(
    request: SaveProjectDocumentRequest,
  ): Promise<SaveProjectDocumentResponse> {
    const started = Date.now();
    projectPersistenceLogger.info("project_cloud_save_started", {
      projectId: request.projectId,
      baseRevision: request.baseRevision,
      mutationVersion: request.mutationVersion,
    });

    const res = await this.fetchImpl(this.documentUrl(request.projectId), {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        baseRevision: request.baseRevision,
        mutationVersion: request.mutationVersion,
        clientMutationId: request.clientMutationId,
        schemaVersion: request.schemaVersion,
        checksum: request.checksum,
        document: request.document,
      }),
    });

    if (res.status === 409) {
      const conflict = (await res.json().catch(() => ({}))) as {
        expectedRevision?: number;
        currentRevision?: number;
        message?: string;
      };
      projectPersistenceLogger.warn("project_save_conflict", {
        projectId: request.projectId,
        baseRevision: request.baseRevision,
        resultingRevision: conflict.currentRevision,
      });
      throw new ProjectSaveConflictError(
        conflict.expectedRevision ?? request.baseRevision,
        conflict.currentRevision ?? request.baseRevision + 1,
        conflict.message,
      );
    }

    if (res.status === 400) {
      const invalid = (await res.json().catch(() => ({}))) as {
        message?: string;
        issues?: unknown;
      };
      projectPersistenceLogger.error("project_document_validation_failed", {
        projectId: request.projectId,
        errorCode: "INVALID_PROJECT_DOCUMENT",
      });
      throw new InvalidProjectDocumentError(
        invalid.message ?? "The project document failed validation.",
        invalid.issues,
      );
    }

    if (!res.ok) {
      const retryable = shouldRetry(res.status);
      projectPersistenceLogger.error("project_cloud_save_failed", {
        projectId: request.projectId,
        errorCode: String(res.status),
        durationMs: Date.now() - started,
      });
      throw new ProjectSaveNetworkError(
        `Cloud save failed with status ${res.status}`,
        { status: res.status, retryable },
      );
    }

    const body = (await res.json()) as Partial<SaveProjectDocumentResponse> & {
      ok?: boolean;
      savedAt?: number | string;
    };

    // New contract
    if (
      typeof body.revision === "number" &&
      typeof body.clientMutationId === "string"
    ) {
      const response: SaveProjectDocumentResponse = {
        projectId: body.projectId ?? request.projectId,
        revision: body.revision,
        savedAt:
          typeof body.savedAt === "string"
            ? body.savedAt
            : new Date(body.savedAt ?? Date.now()).toISOString(),
        clientMutationId: body.clientMutationId,
        checksum: body.checksum,
      };
      projectPersistenceLogger.info("project_cloud_save_completed", {
        projectId: request.projectId,
        baseRevision: request.baseRevision,
        resultingRevision: response.revision,
        durationMs: Date.now() - started,
      });
      return response;
    }

    // Old contract: { ok: true, savedAt: number }
    const savedAt =
      typeof body.savedAt === "number"
        ? new Date(body.savedAt).toISOString()
        : typeof body.savedAt === "string"
          ? body.savedAt
          : new Date().toISOString();

    const response: SaveProjectDocumentResponse = {
      projectId: request.projectId,
      revision: request.baseRevision + 1,
      savedAt,
      clientMutationId: request.clientMutationId,
      checksum: request.checksum,
    };

    projectPersistenceLogger.info("project_cloud_save_completed", {
      projectId: request.projectId,
      baseRevision: request.baseRevision,
      resultingRevision: response.revision,
      durationMs: Date.now() - started,
    });

    return response;
  }
}

export function createProjectApiRepository(
  options?: ProjectApiRepositoryOptions,
): ProjectApiRepository {
  return new ProjectApiRepository(options);
}
