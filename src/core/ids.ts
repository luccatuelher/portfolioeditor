import { hashHex } from './hash';

/**
 * Fábrica de ids determinística para a migração.
 *
 * Regra: ids de entidades existentes no v3 são PRESERVADOS. Quando um id falta
 * (ex.: fixture legada crua), derivamos um id estável a partir de um "caminho"
 * (ex.: `project/<pid>/row/2/item/0`). Assim `migrate` é puro: a mesma entrada
 * gera exatamente a mesma saída, sem `Math.random`/`Date.now`.
 */
export function makeIdFactory(): (existing: unknown, path: string) => string {
  const used = new Set<string>();
  return (existing: unknown, path: string): string => {
    let id: string;
    if (typeof existing === 'string' && /^[a-zA-Z0-9_-]+$/.test(existing) && !used.has(existing)) {
      id = existing;
    } else {
      let candidate = `m_${hashHex(path)}`;
      let n = 0;
      while (used.has(candidate)) candidate = `m_${hashHex(path)}_${++n}`;
      id = candidate;
    }
    used.add(id);
    return id;
  };
}

/** Id de asset determinístico, derivado do conteúdo (dedupe automático). */
export function assetIdFromContent(content: string): string {
  return `asset_${hashHex(content)}`;
}
