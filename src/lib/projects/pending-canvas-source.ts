"use client";

const DB_NAME = "sketchtrude-pending-canvas-sources";
const DB_VERSION = 1;
const STORE_NAME = "sources";

export const CANVAS_SOURCE_DPI = 150;

export type CanvasSourceKind = "image" | "pdf";

export type CanvasSourceSelection = {
  sourceId: string;
  file: File;
  kind: CanvasSourceKind;
  pageNumber: number;
  pageCount: number;
  widthPx: number;
  heightPx: number;
  docWidthMm: number;
  docHeightMm: number;
  dpi: number;
};

export type PendingCanvasSource = Omit<CanvasSourceSelection, "file"> & {
  projectId: string;
  fileName: string;
  mimeType: string;
  lastModified: number;
  blob: Blob;
};

export function pixelsToMillimeters(
  pixels: number,
  dpi = CANVAS_SOURCE_DPI,
): number {
  return (pixels / dpi) * 25.4;
}

export function pdfPointsToMillimeters(points: number): number {
  return (points / 72) * 25.4;
}

function openPendingCanvasSourceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "projectId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open pending source storage"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openPendingCanvasSourceDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Pending source operation failed"));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Pending source transaction aborted"));
    });
  } finally {
    db.close();
  }
}

export async function savePendingCanvasSource(
  projectId: string,
  source: CanvasSourceSelection,
): Promise<void> {
  const pending: PendingCanvasSource = {
    projectId,
    sourceId: source.sourceId,
    kind: source.kind,
    pageNumber: source.pageNumber,
    pageCount: source.pageCount,
    widthPx: source.widthPx,
    heightPx: source.heightPx,
    docWidthMm: source.docWidthMm,
    docHeightMm: source.docHeightMm,
    dpi: source.dpi,
    fileName: source.file.name,
    mimeType: source.file.type,
    lastModified: source.file.lastModified,
    blob: source.file,
  };
  await withStore("readwrite", (store) => store.put(pending));
}

export async function getPendingCanvasSource(
  projectId: string,
): Promise<PendingCanvasSource | null> {
  const result = await withStore<PendingCanvasSource | undefined>(
    "readonly",
    (store) => store.get(projectId),
  );
  return result ?? null;
}

export async function deletePendingCanvasSource(projectId: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(projectId));
}
