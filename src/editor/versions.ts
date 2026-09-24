import { openDb, STORE_DRAFTS } from '../assets/assetStore';
import type { PortfolioV4 } from '../schema/v4';

/**
 * Histórico de versões NOMEADAS, no mesmo IndexedDB do rascunho.
 *
 * Guarda só o DOCUMENTO — as imagens continuam no mapa de assets do editor, que
 * é aditivo (subir imagem nova nunca apaga as antigas). Assim uma versão custa
 * alguns KB e dá para guardar várias; o backup (.json) continua sendo a cópia
 * completa, para levar embora.
 */
export interface VersionEntry {
  id: string;
  name: string;
  savedAt: number;
  auto: boolean;
}

interface StoredVersion extends VersionEntry {
  doc: PortfolioV4;
}

const KEY = 'editor-versions';
/** Teto de segurança: o IndexedDB é do navegador, não um servidor. */
export const MAX_VERSIONS = 20;

function put(db: IDBDatabase, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_DRAFTS, 'readwrite');
    t.objectStore(STORE_DRAFTS).put(value, KEY);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Gravação interrompida'));
  });
}

async function readAll(db: IDBDatabase): Promise<StoredVersion[]> {
  const list = await new Promise<unknown>((resolve, reject) => {
    const req = db.transaction(STORE_DRAFTS, 'readonly').objectStore(STORE_DRAFTS).get(KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return Array.isArray(list) ? (list as StoredVersion[]) : [];
}

/** Só os metadados (sem os documentos) — é o que a lista da interface mostra. */
export async function listVersions(): Promise<VersionEntry[]> {
  const all = await readAll(await openDb());
  return all.map(({ id, name, savedAt, auto }) => ({ id, name, savedAt, auto })).sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Grava uma versão. As mais antigas caem quando passa de `MAX_VERSIONS`, mas as
 * salvas à mão só são descartadas depois que não sobrar nenhuma automática.
 */
export async function saveVersion(name: string, doc: PortfolioV4, auto = false): Promise<VersionEntry> {
  const db = await openDb();
  const all = await readAll(db);
  const entry: StoredVersion = { id: `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: name.trim() || 'Sem nome', savedAt: Date.now(), auto, doc };
  const next = [entry, ...all];
  while (next.length > MAX_VERSIONS) {
    const autos = next.filter((v) => v.auto);
    const victim = autos.length ? autos.reduce((a, b) => (a.savedAt <= b.savedAt ? a : b)) : next[next.length - 1]!;
    next.splice(next.indexOf(victim), 1);
  }
  await put(db, next);
  const { id, savedAt } = entry;
  return { id, name: entry.name, savedAt, auto };
}

/** Documentos de todas as versões (para saber que imagens elas ainda usam). */
export async function loadVersionDocs(): Promise<PortfolioV4[]> {
  return (await readAll(await openDb())).map((v) => v.doc);
}

/** Documento de uma versão (para restaurar). */
export async function loadVersion(id: string): Promise<PortfolioV4 | null> {
  const all = await readAll(await openDb());
  return all.find((v) => v.id === id)?.doc ?? null;
}

export async function deleteVersion(id: string): Promise<void> {
  const db = await openDb();
  await put(db, (await readAll(db)).filter((v) => v.id !== id));
}

/**
 * Guarda o que está aberto antes de uma troca (importar backup, restaurar
 * versão) — é a rede prometida no diálogo ("vira uma versão automática").
 * Antes, a falha dessa gravação era engolida e a troca seguia: o trabalho
 * aberto sumia sem cópia. Agora, se não guardar, pergunta se segue mesmo
 * assim (e sugere o backup). Devolve se pode trocar.
 */
export async function guardarAntesDeTrocar(
  nome: string,
  doc: PortfolioV4,
  confirmar: (c: { titulo: string; texto: string; confirmar: string; cancelar?: string; perigo?: boolean }) => Promise<boolean>,
): Promise<boolean> {
  try {
    await saveVersion(nome, doc, true);
    return true;
  } catch (err) {
    return confirmar({
      titulo: 'Não consegui guardar o que está aberto',
      texto: `A versão automática falhou (${err instanceof Error ? err.message : String(err)}) — em geral, falta espaço neste navegador. Se seguir, o que está aberto agora é substituído sem cópia. Baixe um backup antes (Ctrl+S), por segurança.`,
      confirmar: 'Seguir mesmo assim',
      cancelar: 'Cancelar',
      perigo: true,
    });
  }
}
