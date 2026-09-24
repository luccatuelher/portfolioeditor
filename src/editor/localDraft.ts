import { openDb, STORE_DRAFTS } from '../assets/assetStore';
import type { PortfolioV4 } from '../schema/v4';
import { collectAssetIds } from './backup';
import { loadVersionDocs } from './versions';

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

/**
 * Poda o mapa de imagens ao abrir o editor: fica o que o documento, alguma
 * versão salva ou a cópia de resgate ainda usam. Durante a sessão o mapa só
 * cresce (o desfazer precisa das imagens trocadas); aqui ele volta ao tamanho
 * do que pode ser pedido de novo. Se não der para ler as versões, não poda
 * nada — sobrar imagem custa espaço, faltar custa trabalho.
 */
export async function manterImagensEmUso(doc: PortfolioV4, assets: Record<string, string>): Promise<Record<string, string>> {
  let fontes: unknown[];
  try {
    fontes = [doc, ...(await loadVersionDocs()), (await loadRescueCopy())?.doc];
  } catch {
    return assets;
  }
  const usados = new Set<string>();
  for (const f of fontes) collectAssetIds(f, usados);
  const out: Record<string, string> = {};
  for (const id of usados) if (assets[id]) out[id] = assets[id];
  return out;
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
