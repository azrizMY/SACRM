import { BROCHURES_STORE, openAppDb } from './app-db';

/** IndexedDB-backed storage so an uploaded brochure survives a page reload without re-uploading. */
export type StoredBrochure = { fileName: string; blob: Blob };

export async function saveBrochure(key: string, file: File): Promise<void> {
  const db = await openAppDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BROCHURES_STORE, 'readwrite');
    tx.objectStore(BROCHURES_STORE).put({ fileName: file.name, blob: file } satisfies StoredBrochure, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteBrochure(key: string): Promise<void> {
  const db = await openAppDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BROCHURES_STORE, 'readwrite');
    tx.objectStore(BROCHURES_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllBrochures(): Promise<Record<string, StoredBrochure>> {
  const db = await openAppDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BROCHURES_STORE, 'readonly');
    const cursorReq = tx.objectStore(BROCHURES_STORE).openCursor();
    const result: Record<string, StoredBrochure> = {};
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        result[String(cursor.key)] = cursor.value as StoredBrochure;
        cursor.continue();
      } else {
        resolve(result);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}
