import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "sketchtrude";
const STORE_NAME = "documents";

export type LocalDocument = {
  projectId: string;
  data: unknown;
  updatedAt: number;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: "projectId" });
      },
    });
  }
  return dbPromise;
}

export async function saveLocalDocument(
  projectId: string,
  data: unknown
): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, {
    projectId,
    data,
    updatedAt: Date.now(),
  });
}

export async function loadLocalDocument(
  projectId: string
): Promise<LocalDocument | undefined> {
  const db = await getDb();
  return db.get(STORE_NAME, projectId);
}

export async function deleteLocalDocument(projectId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, projectId);
}
