/** Acessores seguros para ler dados v3 não-tipados sem recorrer a `any`. */

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function asObject(v: unknown): Record<string, unknown> {
  return isObject(v) ? v : {};
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

export function asNumber(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/**
 * Clone profundo com guarda anti-poluição de protótipo, portado de `cloneData`
 * + reviver de `validateData` do v3 (legacy/index.html l.1967, l.1987).
 */
export function safeClone<T>(value: T): T {
  const BLOCKED = ['__proto__', 'prototype', 'constructor'];
  const walk = (v: unknown): unknown => {
    if (v === undefined) return null;
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v)) {
      const val = (v as Record<string, unknown>)[k];
      // Campo opcional vazio (undefined) é OMITIDO — virar null quebraria o schema
      // (campos opcionais aceitam ausência, não null) e o site publicado morria.
      if (!BLOCKED.includes(k) && val !== undefined) out[k] = walk(val);
    }
    return out;
  };
  return walk(value) as T;
}
