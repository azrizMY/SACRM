import type { CustomerRecord } from '../data/customer-data';
import { CUSTOMERS_STORE, openAppDb } from './app-db';

export async function putCustomer(record: CustomerRecord): Promise<void> {
  const db = await openAppDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CUSTOMERS_STORE, 'readwrite');
    tx.objectStore(CUSTOMERS_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await openAppDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CUSTOMERS_STORE, 'readwrite');
    tx.objectStore(CUSTOMERS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllCustomers(): Promise<void> {
  const db = await openAppDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CUSTOMERS_STORE, 'readwrite');
    tx.objectStore(CUSTOMERS_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllCustomers(): Promise<CustomerRecord[]> {
  const db = await openAppDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOMERS_STORE, 'readonly');
    const req = tx.objectStore(CUSTOMERS_STORE).getAll();
    req.onsuccess = () => resolve(req.result as CustomerRecord[]);
    req.onerror = () => reject(req.error);
  });
}
