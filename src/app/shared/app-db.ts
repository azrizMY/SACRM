/** Single shared IndexedDB connection for the app — one place to own the version and schema. */
const DB_NAME = 'redline-crm';
const DB_VERSION = 5;

export const BROCHURES_STORE = 'brochures';
export const CUSTOMERS_STORE = 'customers';
export const BANKERS_STORE = 'bankers';
export const TRADE_INS_STORE = 'tradeIns';

export function openAppDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BROCHURES_STORE)) {
        db.createObjectStore(BROCHURES_STORE);
      }
      if (!db.objectStoreNames.contains(CUSTOMERS_STORE)) {
        db.createObjectStore(CUSTOMERS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(BANKERS_STORE)) {
        db.createObjectStore(BANKERS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(TRADE_INS_STORE)) {
        db.createObjectStore(TRADE_INS_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
