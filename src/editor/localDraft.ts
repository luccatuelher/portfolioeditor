import { openDb, STORE_DRAFTS } from '../assets/assetStore';
import type { PortfolioV4 } from '../schema/v4';

/**
 * Rascunho local do EDITOR no IndexedDB.
 *
 * O documento e as imagens ficam em REGISTROS SEPARADOS de propósito: editar
 * texto grava só o doc (pequeno) e nunca re-serializa os data URLs das imagens
 * (que só mudam quando você importa/envia imagem).
 */
export interface LocalBundle {
  doc: PortfolioV4;
  assets: Record<string, string>;
  savedAt: number;
}

const DOC_KEY = 'editor-doc';
const ASSETS_KEY = 'editor-assets';
const LEGACY_KEY = 'editor-bundle'; // formato antigo (doc+assets juntos)
const RESCUE_KEY = 'editor-doc-rescue'; // cópia intacta antes de qualquer conserto

function put(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_DRAFTS, 'readwrite');
    t.objectStore(STORE_DRAFTS).put(value, key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Gravação interrompida'));
  });
}

function get<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_DRAFTS, 'readonly').objectStore(STORE_DRAFTS).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** Grava só o documento (rápido; não toca nas imagens). */
export async function saveLocalDoc(doc: PortfolioV4): Promise<void> {
  const db = await openDb();
  await put(db, DOC_KEY, { doc, savedAt: Date.now() });
}

/** Grava só o mapa de imagens (chamado quando as imagens mudam). */
export async function saveLocalAssets(assets: Record<string, string>): Promise<void> {
  const db = await openDb();
  await put(db, ASSETS_KEY, { assets, savedAt: Date.now() });
}

/** Grava os dois (usado ao importar um backup). */
export async function saveLocalDraft(doc: PortfolioV4, assets: Record<string, string>): Promise<void> {
  await saveLocalDoc(doc);
  await saveLocalAssets(assets);
}

export async function loadLocalDraft(): Promise<LocalBundle | null> {
  const db = await openDb();
  const docRec = await get<{ doc: PortfolioV4; savedAt: number }>(db, DOC_KEY);
  if (docRec?.doc) {
    const assetsRec = await get<{ assets: Record<string, string> }>(db, ASSETS_KEY);
    return { doc: docRec.doc, assets: assetsRec?.assets ?? {}, savedAt: docRec.savedAt };
  }
  // Compatibilidade: rascunho salvo no formato antigo (um registro só).
  const legacy = await get<LocalBundle>(db, LEGACY_KEY);
  return legacy?.doc ? { doc: legacy.doc, assets: legacy.assets ?? {}, savedAt: legacy.savedAt } : null;
}

/** Guarda uma cópia intacta do documento salvo antes de consertá-lo/substituí-lo. */
export async function saveRescueCopy(raw: unknown): Promise<void> {
  const db = await openDb();
  await put(db, RESCUE_KEY, { doc: raw, savedAt: Date.now() });
}

export async function loadRescueCopy(): Promise<{ doc: unknown; savedAt: number } | undefined> {
  const db = await openDb();
  return get(db, RESCUE_KEY);
}

export async function clearLocalDraft(): Promise<void> {
  const db = await openDb();
  for (const key of [DOC_KEY, ASSETS_KEY, LEGACY_KEY]) {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(STORE_DRAFTS, 'readwrite');
      t.objectStore(STORE_DRAFTS).delete(key);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }
}
