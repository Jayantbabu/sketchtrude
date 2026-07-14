import type { ProjectDocument } from "./project-document";
import {
  CURRENT_PROJECT_SCHEMA_VERSION,
  projectDocumentSchema,
} from "./project-document-schema";
import {
  InvalidProjectDocumentError,
  UnsupportedSchemaVersionError,
} from "./project-errors";

type VersionedDocument = { schemaVersion: number } & Record<string, unknown>;

function identifyDocumentVersion(document: unknown): VersionedDocument {
  if (!document || typeof document !== "object") {
    throw new InvalidProjectDocumentError("Project document must be an object");
  }

  const record = document as Record<string, unknown>;
  const schemaVersion = record.schemaVersion;

  if (typeof schemaVersion !== "number" || !Number.isFinite(schemaVersion)) {
    throw new InvalidProjectDocumentError(
      "Project document is missing a numeric schemaVersion",
    );
  }

  if (schemaVersion > CURRENT_PROJECT_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(schemaVersion, CURRENT_PROJECT_SCHEMA_VERSION);
  }

  if (schemaVersion < 1) {
    throw new InvalidProjectDocumentError(
      `Unsupported schemaVersion ${schemaVersion}`,
    );
  }

  return { ...record, schemaVersion } as VersionedDocument;
}

/**
 * Sequential migrations. Currently CURRENT = 1, so no transform steps run.
 * Add migrateV1ToV2 etc. here when bumping the schema.
 */
function runNextMigration(document: VersionedDocument): VersionedDocument {
  throw new InvalidProjectDocumentError(
    `No migration registered from schemaVersion ${document.schemaVersion}`,
  );
}

export function migrateProjectDocument(document: unknown): ProjectDocument {
  let versioned = identifyDocumentVersion(document);

  while (versioned.schemaVersion < CURRENT_PROJECT_SCHEMA_VERSION) {
    const previous = versioned.schemaVersion;
    versioned = runNextMigration(versioned);
    if (versioned.schemaVersion <= previous) {
      throw new InvalidProjectDocumentError(
        `Migration from schemaVersion ${previous} did not advance the version`,
      );
    }
  }

  const parsed = projectDocumentSchema.safeParse(versioned);
  if (!parsed.success) {
    throw new InvalidProjectDocumentError(
      "Project document failed schema validation",
      parsed.error.issues,
    );
  }

  return parsed.data as ProjectDocument;
}

export { CURRENT_PROJECT_SCHEMA_VERSION };
