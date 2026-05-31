import { TffFundData } from './types';

export interface TffDbRecord {
  id: number; // timestamp
  fileName: string;
  parsedAt: string;
  fundData: TffFundData;
  rawSheets: any;
}

const DB_NAME = 'TffDatabase';
const STORE_NAME = 'tff_records';
const DB_VERSION = 1;

export function openTffDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in browser environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveTffRecord(record: Omit<TffDbRecord, 'id'>): Promise<number> {
  const db = await openTffDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const id = Date.now();
    const newRecord: TffDbRecord = { ...record, id };

    const request = store.put(newRecord);

    request.onsuccess = () => {
      resolve(id);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function getTffRecords(): Promise<TffDbRecord[]> {
  const db = await openTffDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by ID (timestamp) descending so the latest is first
      const sorted = (request.result as TffDbRecord[]).sort((a, b) => b.id - a.id);
      resolve(sorted);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteTffRecord(id: number): Promise<void> {
  const db = await openTffDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function clearAllTffRecords(): Promise<void> {
  const db = await openTffDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
