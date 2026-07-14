import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  LocalProjectSnapshotRecord,
  PendingProjectSaveRecord,
  ProjectLocalRepository,
  ProjectRecoverySnapshotRecord,
  ProjectSyncStateRecord,
} from "./project-repository-types";

const DB_NAME = "sketchtrude-projects";
const DB_VERSION = 1;

interface SketchtrudeProjectsDB extends DBSchema {
  projectSnapshots: {
    key: string;
    value: LocalProjectSnapshotRecord;
  };
  projectSyncState: {
    key: string;
    value: ProjectSyncStateRecord;
  };
  pendingProjectSaves: {
    key: string;
    value: PendingProjectSaveRecord;
  };
  projectRecoverySnapshots: {
    key: string;
    value: ProjectRecoverySnapshotRecord;
    indexes: { "by-project": string };
  };
}

let dbPromise: Promise<IDBPDatabase<SketchtrudeProjectsDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<SketchtrudeProjectsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("projectSnapshots")) {
          db.createObjectStore("projectSnapshots", { keyPath: "projectId" });
        }
        if (!db.objectStoreNames.contains("projectSyncState")) {
          db.createObjectStore("projectSyncState", { keyPath: "projectId" });
        }
        if (!db.objectStoreNames.contains("pendingProjectSaves")) {
          db.createObjectStore("pendingProjectSaves", { keyPath: "projectId" });
        }
        if (!db.objectStoreNames.contains("projectRecoverySnapshots")) {
          const store = db.createObjectStore("projectRecoverySnapshots", {
            keyPath: "projectId",
          });
          store.createIndex("by-project", "projectId");
        }
      },
    });
  }
  return dbPromise;
}

export class ProjectIndexedDbRepository implements ProjectLocalRepository {
  async getSnapshot(
    projectId: string,
  ): Promise<LocalProjectSnapshotRecord | undefined> {
    const db = await getDb();
    return db.get("projectSnapshots", projectId);
  }

  async putSnapshot(record: LocalProjectSnapshotRecord): Promise<void> {
    const db = await getDb();
    await db.put("projectSnapshots", record);
  }

  async deleteSnapshot(projectId: string): Promise<void> {
    const db = await getDb();
    await db.delete("projectSnapshots", projectId);
  }

  async getSyncState(
    projectId: string,
  ): Promise<ProjectSyncStateRecord | undefined> {
    const db = await getDb();
    return db.get("projectSyncState", projectId);
  }

  async putSyncState(record: ProjectSyncStateRecord): Promise<void> {
    const db = await getDb();
    await db.put("projectSyncState", record);
  }

  async getPendingSave(
    projectId: string,
  ): Promise<PendingProjectSaveRecord | undefined> {
    const db = await getDb();
    return db.get("pendingProjectSaves", projectId);
  }

  async putPendingSave(record: PendingProjectSaveRecord): Promise<void> {
    const db = await getDb();
    await db.put("pendingProjectSaves", record);
  }

  async deletePendingSave(projectId: string): Promise<void> {
    const db = await getDb();
    await db.delete("pendingProjectSaves", projectId);
  }

  async putRecoverySnapshot(
    record: ProjectRecoverySnapshotRecord,
  ): Promise<void> {
    const db = await getDb();
    await db.put("projectRecoverySnapshots", record);
  }

  async getLatestRecoverySnapshot(
    projectId: string,
  ): Promise<ProjectRecoverySnapshotRecord | undefined> {
    const db = await getDb();
    return db.get("projectRecoverySnapshots", projectId);
  }
}

export function createProjectIndexedDbRepository(): ProjectIndexedDbRepository {
  return new ProjectIndexedDbRepository();
}

/** Test helper — reset the singleton connection. */
export function resetProjectIndexedDbConnection(): void {
  dbPromise = null;
}
