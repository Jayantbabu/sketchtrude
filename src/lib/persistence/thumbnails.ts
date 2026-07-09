const THUMB_DB = "nm-trace";
const THUMB_STORE = "doc";

type ThumbRecord = { blob: Blob; savedAt: number };

export async function loadLocalThumbnail(
  projectId: string,
): Promise<string | null> {
  if (typeof indexedDB === "undefined" || !projectId) return null;

  return new Promise((resolve) => {
    const req = indexedDB.open(THUMB_DB, 1);
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(THUMB_STORE)) {
        resolve(null);
        return;
      }
      const tx = db.transaction(THUMB_STORE, "readonly");
      const getReq = tx.objectStore(THUMB_STORE).get(`thumb-${projectId}`);
      getReq.onsuccess = () => {
        const rec = getReq.result as ThumbRecord | undefined;
        if (rec?.blob instanceof Blob) {
          resolve(URL.createObjectURL(rec.blob));
          return;
        }
        resolve(null);
      };
      getReq.onerror = () => resolve(null);
    };
  });
}
