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
 *
 * Cada imagem é UM registro (`editor-asset:<id>`). O id vem do conteúdo, então
 * uma imagem gravada nunca muda: enviar uma foto grava só ela. Antes o mapa
 * inteiro ia num registro só — num storyboard com centenas de quadros, cada
 * envio regravava dezenas de MB (lentidão e espaço do navegador dobrando
 * durante a gravação).
 */
export interface LocalBundle {
  doc: PortfolioV4;
  assets: Record<string, string>;
  savedAt: number;
}

const DOC_KEY = 'editor-doc';
/** Formato anterior das imagens: o mapa inteiro num registro. Lido e migrado. */
const ASSETS_KEY = 'editor-assets';
const LEGACY_KEY = 'editor-bundle'; // formato antigo (doc+assets juntos)
const RESCUE_KEY = 'editor-doc-rescue'; // cópia intacta antes de qualquer conserto
const ASSET_PREFIX = 'editor-asset:';
const faixaDasImagens = (): IDBKeyRange => IDBKeyRange.bound(ASSET_PREFIX, `${ASSET_PREFIX}￿`);

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

/** Ids das imagens já gravadas, cada uma no seu registro. */
function idsGravados(db: IDBDatabase): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_DRAFTS, 'readonly').objectStore(STORE_DRAFTS).getAllKeys(faixaDasImagens());
    req.onsuccess = () => resolve(new Set(req.result.map((k) => String(k).slice(ASSET_PREFIX.length))));
    req.onerror = () => reject(req.error);
  });
}

/** Grava só o documento (rápido; não toca nas imagens). */
export async function saveLocalDoc(doc: PortfolioV4): Promise<void> {
  const db = await openDb();
  await put(db, DOC_KEY, { doc, savedAt: Date.now() });
}

/**
 * Grava as imagens do mapa que ainda não estão gravadas — só ACRESCENTA: pode
 * repetir, cruzar com outra gravação ou chegar atrasada sem apagar nada (a
 * poda é à parte, em podarImagensGravadas). Imagem já gravada não é regravada
 * (o id é o conteúdo). O registro antigo do mapa inteiro sai na mesma
 * transação em que as imagens dele viram registros próprios.
 */
export async function saveLocalAssets(assets: Record<string, string>): Promise<void> {
  const db = await openDb();
  const gravados = await idsGravados(db);
  const novos = Object.keys(assets).filter((id) => !gravados.has(id));
  const temAntigo = (await get(db, ASSETS_KEY)) !== undefined;
  if (!novos.length && !temAntigo) return;
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE_DRAFTS, 'readwrite');
    const store = t.objectStore(STORE_DRAFTS);
    for (const id of novos) store.put(assets[id], ASSET_PREFIX + id);
    if (temAntigo) store.delete(ASSETS_KEY);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Gravação interrompida'));
  });
}

/**
 * Apaga as imagens gravadas que não estão em `manter` — a poda da abertura
 * (manterImagensEmUso), feita uma vez, antes de o editor começar a gravar.
 */
export async function podarImagensGravadas(manter: Record<string, string>): Promise<void> {
  const db = await openDb();
  const saindo = [...(await idsGravados(db))].filter((id) => !(id in manter));
  if (!saindo.length) return;
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE_DRAFTS, 'readwrite');
    const store = t.objectStore(STORE_DRAFTS);
    for (const id of saindo) store.delete(ASSET_PREFIX + id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/** Todas as imagens gravadas: as de registro próprio e, se houver, as do formato antigo. */
async function lerImagens(db: IDBDatabase): Promise<Record<string, string>> {
  const antigo = await get<{ assets: Record<string, string> }>(db, ASSETS_KEY);
  const proprias = await new Promise<Record<string, string>>((resolve, reject) => {
    const out: Record<string, string> = {};
    const req = db.transaction(STORE_DRAFTS, 'readonly').objectStore(STORE_DRAFTS).openCursor(faixaDasImagens());
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return resolve(out);
      if (typeof c.value === 'string') out[String(c.key).slice(ASSET_PREFIX.length)] = c.value;
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
  return { ...(antigo?.assets ?? {}), ...proprias };
}

export async function loadLocalDraft(): Promise<LocalBundle | null> {
  const db = await openDb();
  const docRec = await get<{ doc: PortfolioV4; savedAt: number }>(db, DOC_KEY);
  if (docRec?.doc) return { doc: docRec.doc, assets: await lerImagens(db), savedAt: docRec.savedAt };
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
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE_DRAFTS, 'readwrite');
    const store = t.objectStore(STORE_DRAFTS);
    for (const key of [DOC_KEY, ASSETS_KEY, LEGACY_KEY]) store.delete(key);
    store.delete(faixaDasImagens());
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
