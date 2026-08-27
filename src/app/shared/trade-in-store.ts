import type { TradeInContactRecord } from '../data/trade-in-data';
import { TRADE_INS_STORE, openAppDb } from './app-db';

export async function putTradeInContact(record: TradeInContactRecord): Promise<void> {
  const db = await openAppDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TRADE_INS_STORE, 'readwrite');
    tx.objectStore(TRADE_INS_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteTradeInContact(id: string): Promise<void> {
  const db = await openAppDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TRADE_INS_STORE, 'readwrite');
    tx.objectStore(TRADE_INS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllTradeInContacts(): Promise<TradeInContactRecord[]> {
  const db = await openAppDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TRADE_INS_STORE, 'readonly');
    const req = tx.objectStore(TRADE_INS_STORE).getAll();
    req.onsuccess = () => resolve(req.result as TradeInContactRecord[]);
    req.onerror = () => reject(req.error);
  });
}
