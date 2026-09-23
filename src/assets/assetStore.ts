/**
 * Banco local (IndexedDB) do editor: a conexão e a store `drafts`, onde o
 * rascunho, as imagens (data URLs, em registro separado do documento) e as
 * versões ficam guardados — ver editor/localDraft.ts e editor/versions.ts.
 * Injeta-se `factory` (IDBFactory) para testar com fake-indexeddb.
 */

export const DB_NAME = 'portfolio-v4';
export const DB_VERSION = 1;
export const STORE_DRAFTS = 'drafts';
// Stores de uma versão antiga (imagens como Blob + miniatura). Nada mais grava
// nelas, mas continuam sendo criadas: sumir com elas exigiria migrar o banco
// de quem já usa o editor, sem ganho nenhum.
const STORE_ASSETS = 'assets';
const STORE_THUMBS = 'thumbs';

function getFactory(factory?: IDBFactory): IDBFactory {
  if (factory) return factory;
  if (typeof indexedDB !== 'undefined') return indexedDB;
  throw new Error('IndexedDB indisponível neste ambiente.');
}

/**
 * Conexão reaproveitada do navegador. Cada gravação automática abria uma
 * conexão nova e nunca a fechava — dezenas por minuto de edição. Se outra aba
 * precisar atualizar o banco, esta fecha e a próxima chamada reabre.
 */
let compartilhada: Promise<IDBDatabase> | null = null;

export function openDb(factory?: IDBFactory): Promise<IDBDatabase> {
  if (factory) return abrir(factory);
  compartilhada ??= abrir(getFactory()).then(
    (db) => {
      db.onversionchange = () => {
        db.close();
        compartilhada = null;
      };
      db.onclose = () => {
        compartilhada = null;
      };
      return db;
    },
    (err: unknown) => {
      compartilhada = null;
      throw err;
    },
  );
  return compartilhada;
}

function abrir(idb: IDBFactory): Promise<IDBDatabase> {
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
