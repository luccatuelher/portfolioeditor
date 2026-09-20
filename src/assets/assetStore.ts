/**
 * Asset store em IndexedDB: os Blobs das imagens vivem em object stores
 * separadas do rascunho JSON, para nunca passarem por JSON.stringify a cada
 * edição/undo. Injeta-se `factory` (IDBFactory) para testar com fake-indexeddb.
 */

export const DB_NAME = 'portfolio-v4';
export const DB_VERSION = 1;
export const STORE_DRAFTS = 'drafts';
export const STORE_ASSETS = 'assets';
export const STORE_THUMBS = 'thumbs';

export interface StoredAsset {
  blob: Blob;
  thumb?: Blob;
}

function getFactory(factory?: IDBFactory): IDBFactory {
  if (factory) return factory;
  if (typeof indexedDB !== 'undefined') return indexedDB;
  throw new Error('IndexedDB indisponível neste ambiente.');
}

export function openDb(factory?: IDBFactory): Promise<IDBDatabase> {
  const idb = getFactory(factory);
  return openAt(idb, DB_VERSION).catch((err: unknown) => {
    // Banco já está numa versão mais nova (ex.: aberto por outra versão do editor):
    // abre na versão atual em vez de falhar — os stores são os mesmos.
    if (err instanceof DOMException && err.name === 'VersionError') return openAt(idb);
    throw err;
  });
}

function openAt(idb: IDBFactory, version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = version === undefined ? idb.open(DB_NAME) : idb.open(DB_NAME, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) db.createObjectStore(STORE_DRAFTS);
      if (!db.objectStoreNames.contains(STORE_ASSETS)) db.createObjectStore(STORE_ASSETS);
      if (!db.objectStoreNames.contains(STORE_THUMBS)) db.createObjectStore(STORE_THUMBS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = run(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.onabort = () => reject(t.error ?? new Error('Transação abortada'));
  });
}

export async function putAsset(db: IDBDatabase, id: string, blob: Blob, thumb?: Blob): Promise<void> {
  await tx(db, STORE_ASSETS, 'readwrite', (s) => s.put(blob, id));
  if (thumb) await tx(db, STORE_THUMBS, 'readwrite', (s) => s.put(thumb, id));
}

export async function getAsset(db: IDBDatabase, id: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>(db, STORE_ASSETS, 'readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>);
}

export async function getThumb(db: IDBDatabase, id: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>(db, STORE_THUMBS, 'readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>);
}

export async function deleteAsset(db: IDBDatabase, id: string): Promise<void> {
  await tx(db, STORE_ASSETS, 'readwrite', (s) => s.delete(id));
  await tx(db, STORE_THUMBS, 'readwrite', (s) => s.delete(id));
}

export function listAssetIds(db: IDBDatabase): Promise<string[]> {
  return tx<IDBValidKey[]>(db, STORE_ASSETS, 'readonly', (s) => s.getAllKeys()).then((keys) =>
    keys.map((k) => String(k)),
  );
}
