import type { BankerRecord } from '../data/banker-data';
import { BANKERS_STORE, openAppDb } from './app-db';

export async function putBanker(record: BankerRecord): Promise<void> {
  const db = await openAppDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BANKERS_STORE, 'readwrite');
    tx.objectStore(BANKERS_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteBanker(id: string): Promise<void> {
  const db = await openAppDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BANKERS_STORE, 'readwrite');
    tx.objectStore(BANKERS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllBankers(): Promise<BankerRecord[]> {
  const db = await openAppDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BANKERS_STORE, 'readonly');
    const req = tx.objectStore(BANKERS_STORE).getAll();
    req.onsuccess = () => resolve(req.result as BankerRecord[]);
    req.onerror = () => reject(req.error);
  });
}
