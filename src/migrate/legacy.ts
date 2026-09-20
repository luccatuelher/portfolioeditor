import { asArray, asObject, asString, isObject } from '../core/access';

/**
 * Visão normalizada de "linhas" de um projeto v3, usada tanto pela migração
 * quanto pelos contadores dos testes, para que ambos contem exatamente a mesma
 * fonte de verdade (evita contar `rows` e o espelho legado `images[]` em dobro).
 *
 * Porta a lógica de `migrateProjectToRows` do v3 (legacy/index.html l.3110):
 * se o projeto tem `rows`, elas mandam; senão as linhas são reconstruídas a
 * partir de `images[]` (em blocos de 3), `embeds[]` e `text`.
 */

export interface NormRowItem {
  kind: 'image' | 'embed' | 'text';
  src?: string;
  alt?: string;
  content?: string;
  embedType?: string;
  embedId?: string;
  widthPct?: number;
  homeVisible?: boolean;
  rawId?: string;
}

export interface NormRow {
  rawId?: string;
  cols: number;
  homeVisible?: boolean;
  items: NormRowItem[];
}

function clampCols(n: unknown, len: number): number {
  const parsed = typeof n === 'number' ? n : parseInt(String(n ?? ''), 10);
  const base = Number.isFinite(parsed) && parsed > 0 ? parsed : Math.min(3, len) || 1;
  return Math.max(1, Math.min(3, base));
}

function itemFromRaw(raw: unknown): NormRowItem | null {
  if (!isObject(raw)) return null;
  const kind = raw['kind'];
  if (kind !== 'image' && kind !== 'embed' && kind !== 'text') return null;
  const item: NormRowItem = { kind };
  if (typeof raw['id'] === 'string') item.rawId = raw['id'];
  if (typeof raw['src'] === 'string') item.src = raw['src'];
  if (typeof raw['alt'] === 'string') item.alt = raw['alt'];
  if (typeof raw['content'] === 'string') item.content = raw['content'];
  if (typeof raw['embedType'] === 'string') item.embedType = raw['embedType'];
  if (typeof raw['embedId'] === 'string') item.embedId = raw['embedId'];
  if (typeof raw['widthPct'] === 'number') item.widthPct = raw['widthPct'];
  if (typeof raw['homeVisible'] === 'boolean') item.homeVisible = raw['homeVisible'];
  return item;
}

export function normalizeProjectRows(project: Record<string, unknown>): NormRow[] {
  const rawRows = project['rows'];
  if (Array.isArray(rawRows)) {
    return rawRows.map((r): NormRow => {
      const row = asObject(r);
      const items = asArray(row['items'])
        .map(itemFromRaw)
        .filter((x): x is NormRowItem => x !== null);
      const out: NormRow = { cols: clampCols(row['cols'], items.length), items };
      if (typeof row['id'] === 'string') out.rawId = row['id'];
      if (typeof row['homeVisible'] === 'boolean') out.homeVisible = row['homeVisible'];
      return out;
    });
  }

  // Sem rows: reconstruir a partir do legado (images/embeds/text).
  const rows: NormRow[] = [];
  let imgs = asArray(project['images']).filter((x): x is string => typeof x === 'string');
  const thumb = asString(project['thumb']);
  if (!imgs.length && thumb) imgs = [thumb];
  for (let i = 0; i < imgs.length; i += 3) {
    const chunk = imgs.slice(i, i + 3);
    rows.push({ cols: chunk.length, items: chunk.map((src): NormRowItem => ({ kind: 'image', src })) });
  }
  for (const e of asArray(project['embeds'])) {
    if (!isObject(e)) continue;
    rows.push({
      cols: 1,
      items: [{ kind: 'embed', embedType: asString(e['type']), embedId: asString(e['id']) }],
    });
  }
  const text = asString(project['text']);
  if (text) rows.push({ cols: 1, items: [{ kind: 'text', content: text }] });
  return rows;
}
