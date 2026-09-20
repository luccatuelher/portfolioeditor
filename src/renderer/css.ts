import type { CSSProperties } from 'react';

/**
 * Constrói um objeto de style contendo APENAS variáveis CSS (--*).
 * É a única forma de estilo inline permitida na arquitetura v4.
 */
export function styleVars(vars: Record<string, string | number | undefined>): CSSProperties {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (v !== undefined && v !== '') out[k] = String(v);
  }
  return out as CSSProperties;
}
