import { openDb, STORE_DRAFTS } from '../assets/assetStore';
import type { PortfolioV4 } from '../schema/v4';

/**
 * Persistência do rascunho com debounce. O rascunho é só o JSON do documento
 * (que contém apenas METADADOS de asset — os Blobs vivem em outra store), logo
 * editar texto nunca re-serializa imagens.
 *
 * Chaves de recuperação portadas do v3 (legacy/index.html): `current`,
 * `before-migration`, `before-import`, `recovery-invalid`.
 */

export type DraftKey = 'current' | 'before-migration' | 'before-import' | 'recovery-invalid';

export interface DraftRecord {
  data: PortfolioV4;
  savedAt: number;
}

export function writeDraft(db: IDBDatabase, key: DraftKey, data: PortfolioV4): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_DRAFTS, 'readwrite');
    t.objectStore(STORE_DRAFTS).put({ data, savedAt: Date.now() } satisfies DraftRecord, key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Gravação interrompida'));
  });
}

export function readDraft(db: IDBDatabase, key: DraftKey): Promise<DraftRecord | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_DRAFTS, 'readonly').objectStore(STORE_DRAFTS).get(key);
    req.onsuccess = () => resolve(req.result as DraftRecord | undefined);
    req.onerror = () => reject(req.error);
  });
}

export interface Persister {
  /** Agenda a gravação (debounced) do estado mais recente. */
  queue(data: PortfolioV4): void;
  /** Grava imediatamente o último estado enfileirado (se houver). */
  flush(): Promise<void>;
  /** Cancela timers pendentes. */
  destroy(): void;
  /** Nº de gravações efetivamente realizadas (telemetria/teste). */
  readonly writes: number;
}

export interface PersisterOptions {
  db: IDBDatabase;
  delay?: number;
  onError?: (e: unknown) => void;
}

export function createPersister({ db, delay = 500, onError }: PersisterOptions): Persister {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: PortfolioV4 | null = null;
  let writes = 0;

  const flush = async (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending) return;
    const data = pending;
    pending = null;
    try {
      await writeDraft(db, 'current', data);
      writes++;
    } catch (e) {
      onError?.(e);
      throw e;
    }
  };

  return {
    queue(data: PortfolioV4) {
      pending = data;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delay);
    },
    flush,
    destroy() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = null;
    },
    get writes() {
      return writes;
    },
  };
}

export { openDb };
