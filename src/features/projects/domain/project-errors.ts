export class InvalidProjectDocumentError extends Error {
  readonly issues?: unknown;

  constructor(message: string, issues?: unknown) {
    super(message);
    this.name = "InvalidProjectDocumentError";
    this.issues = issues;
  }
}

export class UnsupportedSchemaVersionError extends Error {
  readonly foundVersion: number;
  readonly supportedVersion: number;

  constructor(foundVersion: number, supportedVersion: number) {
    super(
      `Unsupported project schemaVersion ${foundVersion} (current supported: ${supportedVersion})`,
    );
    this.name = "UnsupportedSchemaVersionError";
    this.foundVersion = foundVersion;
    this.supportedVersion = supportedVersion;
  }
}

export class ProjectSaveConflictError extends Error {
  readonly expectedRevision: number;
  readonly currentRevision: number;

  constructor(expectedRevision: number, currentRevision: number, message?: string) {
    super(
      message ??
        `Project revision conflict: expected ${expectedRevision}, current ${currentRevision}`,
    );
    this.name = "ProjectSaveConflictError";
    this.expectedRevision = expectedRevision;
    this.currentRevision = currentRevision;
  }
}

export class ProjectSaveNetworkError extends Error {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, options?: { status?: number; retryable?: boolean }) {
    super(message);
    this.name = "ProjectSaveNetworkError";
    this.status = options?.status;
    this.retryable = options?.retryable ?? true;
  }
}

export class ProjectLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectLoadError";
  }
}

export class ProjectRecoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectRecoveryError";
  }
}
