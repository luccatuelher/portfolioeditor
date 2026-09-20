/** Qualquer coisa que ocupa colunas numa grade de 12 (bloco, elemento do cabeçalho…). */
export interface GridCell {
  id: string;
  span: number;
  rowAlign?: 'start' | 'center' | 'end' | 'between';
  /** Empilhado: fica embaixo do bloco anterior, na mesma coluna (mesma largura). */
  stack?: boolean;
}

/**
 * Grid dinâmico por arrastar. Estrutura implícita na ordem dos blocos:
 *  - uma COLUNA é um bloco "cabeça" + os blocos `stack` que vêm logo depois dele;
 *  - uma LINHA é uma sequência de colunas cuja soma de larguras ≤ 12.
 * Soltar na lateral de um bloco o põe na mesma linha (larguras divididas por
 * igual); em cima/embaixo de um bloco que divide a linha com outros, empilha
 * na mesma coluna; numa linha de coluna única, cria uma linha própria.
 */

export type DropZone = 'left' | 'right' | 'top' | 'bottom';

const MAX_PER_ROW = 4;

/** Colunas: listas de índices (cabeça + empilhados). */
export function computeColumns(blocks: { span: number; stack?: boolean }[]): number[][] {
  const cols: number[][] = [];
  blocks.forEach((b, i) => {
    if (b.stack && cols.length) cols[cols.length - 1]!.push(i);
    else cols.push([i]);
  });
  return cols;
}

/** Linhas: listas de colunas (cada coluna = lista de índices). */
export function computeRowColumns(blocks: { span: number; stack?: boolean }[]): number[][][] {
  const rows: number[][][] = [];
  let cur: number[][] = [];
  let sum = 0;
  for (const col of computeColumns(blocks)) {
    const span = blocks[col[0]!]!.span;
    if (cur.length && sum + span > 12) {
      rows.push(cur);
      cur = [];
      sum = 0;
    }
    cur.push(col);
    sum += span;
  }
  if (cur.length) rows.push(cur);
  return rows;
}

/** Linhas como listas planas de índices (compatibilidade). */
export function computeRows(blocks: { span: number; stack?: boolean }[]): number[][] {
  return computeRowColumns(blocks).map((r) => r.flat());
}

export interface Placement {
  /** grid-column: "início / span n" */
  col: string;
  /** grid-row: "início / span n" */
  row: string;
  /** Índice da coluna na linha (0 = primeira). */
  k: number;
  /** Quantas colunas a linha tem. */
  n: number;
  /** Colunas (de 12) livres na linha — espaço que o afastamento pode usar sem encolher nada. */
  free: number;
  /** Alinhamento da linha. */
  align: 'start' | 'center' | 'end' | 'between';
}

/**
 * Posição explícita de cada bloco na grade. Colunas com menos blocos que a
 * mais alta da linha esticam o último bloco até o fim — é isso que deixa o
 * texto da esquerda correr ao lado de "imagem + texto" empilhados à direita.
 * Retorna também o total de linhas da grade usadas.
 */
export function layoutGrid(blocks: { span: number; stack?: boolean; rowAlign?: Placement['align'] }[]): { places: Placement[]; rows: number } {
  const places: Placement[] = [];
  let line = 1;
  for (const row of computeRowColumns(blocks)) {
    const depth = Math.max(...row.map((c) => c.length));
    const used = row.reduce((s, c) => s + Math.min(12, blocks[c[0]!]!.span), 0);
    const align = blocks[row[0]![0]!]!.rowAlign ?? 'start';
    let colStart = 1;
    row.forEach((col, ci) => {
      const span = Math.min(12, blocks[col[0]!]!.span);
      col.forEach((idx, k) => {
        const rows = k === col.length - 1 ? depth - k : 1;
        places[idx] = { col: `${colStart} / span ${span}`, row: `${line + k} / span ${rows}`, k: ci, n: row.length, free: Math.max(0, 12 - used), align };
      });
      colStart += span;
    });
    line += depth;
  }
  return { places, rows: line - 1 };
}

function evenSpan(n: number): number {
  return Math.max(1, Math.floor(12 / Math.max(1, n)));
}

/** Índices da coluna a que o bloco `i` pertence. */
function columnOf(blocks: GridCell[], i: number): number[] {
  return computeColumns(blocks).find((c) => c.includes(i)) ?? [i];
}

/** Id do 1º bloco da linha do bloco `id` (onde o alinhamento da linha é guardado). */
export function rowHeadId(blocks: GridCell[], id: string): string {
  const i = blocks.findIndex((b) => b.id === id);
  const row = computeRowColumns(blocks).find((r) => r.some((c) => c.includes(i)));
  return row ? blocks[row[0]![0]!]!.id : id;
}

/** Ids de todos os blocos da mesma coluna (para mudar a largura da coluna inteira). */
export function columnIds(blocks: GridCell[], id: string): string[] {
  const i = blocks.findIndex((b) => b.id === id);
  if (i < 0) return [id];
  return columnOf(blocks, i).map((j) => blocks[j]!.id);
}

/** Redistribui as larguras das colunas (cabeças + empilhados) igualmente. */
function equalizeColumns(blocks: GridCell[], headIds: string[]): void {
  const span = evenSpan(headIds.length);
  const cols = computeColumns(blocks);
  for (const col of cols) {
    if (headIds.includes(blocks[col[0]!]!.id)) for (const j of col) blocks[j]!.span = span;
  }
}

/**
 * Solta um bloco da estrutura sem movê-lo: se ele encabeça uma pilha, o próximo
 * da pilha vira a cabeça; ele próprio deixa de ser empilhado e perde o
 * alinhamento de linha (que passa para quem ficar na frente).
 */
export function unstackBlock<T extends GridCell>(blocks: T[], id: string): void {
  const i = blocks.findIndex((b) => b.id === id);
  if (i < 0) return;
  const b = blocks[i]!;
  const col = columnOf(blocks, i);
  const next = blocks[i + 1];
  if (!b.stack && col.length > 1 && next) {
    next.stack = undefined;
    next.rowAlign ??= b.rowAlign;
  } else if (!b.stack && b.rowAlign && next && !next.stack) {
    next.rowAlign ??= b.rowAlign;
  }
  b.stack = undefined;
  b.rowAlign = undefined;
}

/**
 * Remove um bloco da grade. Os outros elementos NÃO mudam de tamanho (a sobra
 * da linha fica livre para alinhamento/espaçamento). Retorna o bloco.
 */
export function detachBlock<T extends GridCell>(blocks: T[], id: string): T | undefined {
  const i = blocks.findIndex((b) => b.id === id);
  if (i < 0) return undefined;
  unstackBlock(blocks, id);
  const [removed] = blocks.splice(i, 1);
  return removed;
}

/**
 * Insere `block` relativo ao alvo `targetId` segundo a zona. Muta `blocks`.
 * `keepSpan`: numa linha nova (topo/base), mantém a largura do bloco em vez de 12.
 */
export function placeBlock<T extends GridCell>(blocks: T[], block: T, targetId: string, zone: DropZone, opts: { keepSpan?: boolean } = {}): void {
  block.stack = undefined;
  block.rowAlign = undefined;
  const ti = blocks.findIndex((b) => b.id === targetId);
  if (ti < 0) {
    block.span = 12;
    blocks.push(block);
    return;
  }
  const rows = computeRowColumns(blocks);
  const row = rows.find((r) => r.some((c) => c.includes(ti))) ?? [[ti]];
  const col = row.find((c) => c.includes(ti)) ?? [ti];
  const colSpan = blocks[col[0]!]!.span;

  if (zone === 'left' || zone === 'right') {
    if (row.length < MAX_PER_ROW) {
      // Nova coluna ao lado da coluna do alvo. Usa a sobra da linha sem mexer nos
      // vizinhos; só redistribui as larguras quando não sobra espaço (≥ 2 colunas).
      const used = row.reduce((sum, c) => sum + blocks[c[0]!]!.span, 0);
      const free = 12 - used;
      const at = zone === 'left' ? col[0]! : col[col.length - 1]! + 1;
      blocks.splice(at, 0, block);
      if (free >= 2) {
        block.span = Math.min(block.span, free);
      } else {
        const heads = [...row.map((c) => blocks[c[0]! >= at ? c[0]! + 1 : c[0]!]!.id), block.id];
        equalizeColumns(blocks, heads);
      }
      return;
    }
  } else if (row.length > 1) {
    // Em cima/embaixo de um bloco que divide a linha: empilha na mesma coluna.
    block.span = colSpan;
    if (zone === 'bottom') {
      block.stack = true;
      blocks.splice(ti + 1, 0, block);
    } else {
      const target = blocks[ti]!;
      block.stack = target.stack;
      target.stack = true;
      blocks.splice(ti, 0, block);
    }
    return;
  }
  // Linha própria (largura cheia, ou a do bloco com keepSpan), antes/depois da linha do alvo.
  if (!opts.keepSpan) block.span = 12;
  const flat = row.flat();
  const at = zone === 'top' || zone === 'left' ? Math.min(...flat) : Math.max(...flat) + 1;
  blocks.splice(at, 0, block);
}
