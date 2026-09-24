import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';

enablePatches();

// `applyPatches` é tipado para `Objectish`; nosso T é um estado genérico.
// Cast localizado através do próprio tipo de parâmetro da lib (sem `any`).
type ImmerBase = Parameters<typeof applyPatches>[0];
function applyPatchesT<T>(base: T, patches: Patch[]): T {
  return applyPatches(base as unknown as ImmerBase, patches) as unknown as T;
}

/**
 * Store de estado com undo/redo por PATCHES do Immer (não snapshots inteiros):
 * cada edição guarda só o diff e seu inverso. Edições contínuas com a mesma
 * `groupKey` dentro de uma janela são coalescidas numa única entrada de undo.
 */

export interface HistoryEntry {
  patches: Patch[];
  inverse: Patch[];
  groupKey?: string;
  at: number;
}

export interface UpdateOptions {
  /** Coalesce com a entrada anterior de mesma groupKey dentro de `groupWindow`. */
  groupKey?: string;
  /**
   * Registro técnico, não edição da pessoa (ex.: tamanho e tipo de uma imagem
   * recém-enviada): muda o estado sem virar passo de desfazer. Só para dados
   * em caminho próprio, que nenhuma edição desfeita depois precisa encontrar.
   */
  semHistorico?: boolean;
}

export interface Store<T> {
  getState(): T;
  update(recipe: (draft: T) => void, opts?: UpdateOptions): void;
  /**
   * Uma ação da pessoa = um passo de desfazer, mesmo que mude o documento em
   * várias etapas (criar a seção e pôr o bloco nela). As mudanças valem na
   * hora (getState já as vê); quem ouve o store é avisado uma vez, no fim. Se
   * `fn` lançar erro, tudo o que ela mudou é desfeito. Aninhada, junta-se à
   * de fora.
   */
  transaction<R>(fn: () => R): R;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  /** A entrada que o próximo undo/redo aplicaria (sem aplicar) — para dizer o que vai mudar. */
  peekUndo(): HistoryEntry | undefined;
  peekRedo(): HistoryEntry | undefined;
  subscribe(fn: (state: T) => void): () => void;
  /** Tamanho atual da pilha de undo (teste/telemetria). */
  historyLength(): number;
}

export interface StoreOptions {
  /** Máximo de entradas de histórico (default 200). */
  limit?: number;
  /** Janela de agrupamento de edições contínuas em ms (default 700). */
  groupWindow?: number;
  /** Relógio injetável (testes determinísticos). */
  now?: () => number;
}

export function createStore<T>(initial: T, options: StoreOptions = {}): Store<T> {
  const limit = options.limit ?? 200;
  const groupWindow = options.groupWindow ?? 700;
  const now = options.now ?? (() => Date.now());

  let state = initial;
  /** Transação aberta: as mudanças se acumulam aqui até o fim dela. */
  let tx: HistoryEntry | null = null;
  /** Algo mudou durante a transação aberta (com ou sem histórico): avisar no fim. */
  let txMudou = false;
  const undoStack: HistoryEntry[] = [];
  const redoStack: HistoryEntry[] = [];
  const subs = new Set<(state: T) => void>();

  const emit = (): void => {
    for (const fn of subs) fn(state);
  };

  return {
    getState: () => state,

    update(recipe, opts) {
      const [next, patches, inverse] = produceWithPatches(state, recipe);
      if (patches.length === 0) return; // no-op não polui histórico
      state = next as T;
      if (opts?.semHistorico) {
        if (tx) txMudou = true;
        else emit();
        return;
      }
      if (tx) {
        txMudou = true;
        tx.patches.push(...patches);
        tx.inverse.unshift(...inverse);
        return;
      }

      const at = now();
      const last = undoStack[undoStack.length - 1];
      const canGroup =
        !!opts?.groupKey && !!last && last.groupKey === opts.groupKey && at - last.at <= groupWindow;

      if (canGroup && last) {
        // Coalesce: mantém o inverso MAIS ANTIGO na frente (ordem de reversão).
        last.patches.push(...patches);
        last.inverse.unshift(...inverse);
        last.at = at;
      } else {
        const entry: HistoryEntry = { patches, inverse, at };
        if (opts?.groupKey) entry.groupKey = opts.groupKey;
        undoStack.push(entry);
        if (undoStack.length > limit) undoStack.shift();
      }
      redoStack.length = 0;
      emit();
    },

    transaction<R>(fn: () => R): R {
      if (tx) return fn();
      const t: HistoryEntry = { patches: [], inverse: [], at: now() };
      tx = t;
      txMudou = false;
      let ok = false;
      try {
        const r = fn();
        ok = true;
        return r;
      } finally {
        tx = null;
        if (!ok && t.inverse.length) state = applyPatchesT(state, t.inverse);
        if (ok && t.patches.length) {
          undoStack.push(t);
          if (undoStack.length > limit) undoStack.shift();
          redoStack.length = 0;
        }
        if (txMudou) emit();
      }
    },

    undo() {
      const entry = undoStack.pop();
      if (!entry) return false;
      state = applyPatchesT(state, entry.inverse);
      redoStack.push(entry);
      emit();
      return true;
    },

    redo() {
      const entry = redoStack.pop();
      if (!entry) return false;
      state = applyPatchesT(state, entry.patches);
      undoStack.push(entry);
      emit();
      return true;
    },

    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    peekUndo: () => undoStack[undoStack.length - 1],
    peekRedo: () => redoStack[redoStack.length - 1],
    historyLength: () => undoStack.length,

    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
  };
}
