import { PortfolioV4Schema, type PortfolioV4 } from '../schema/v4';
import { upgradeDoc } from './upgrade';

export interface RepairResult {
  doc: PortfolioV4 | null;
  /** Descrição legível de cada ajuste feito (vazio = documento já estava válido). */
  fixes: string[];
}

type Obj = Record<string, unknown>;

function at(root: unknown, path: PropertyKey[]): unknown {
  let cur: unknown = root;
  for (const k of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Obj)[k as string];
  }
  return cur;
}

/**
 * Lê um documento v4 salvo (rascunho/backup) tolerando mudanças de formato:
 * em vez de descartar tudo quando um campo não bate com o schema atual,
 * remove só o que é incompatível (campos que não existem mais, opcionais com
 * valor inválido, itens de lista quebrados) e relata cada ajuste.
 * Nunca muta o `raw` recebido.
 */
export function repairDoc(raw: unknown): RepairResult {
  const draft: unknown = structuredClone(raw);
  const fixes: string[] = [];
  for (let round = 0; round < 200; round++) {
    const res = PortfolioV4Schema.safeParse(draft);
    if (res.success) return { doc: upgradeDoc(res.data), fixes };
    let changed = false;
    for (const issue of res.error.issues) {
      const path = issue.path;
      if (issue.code === 'unrecognized_keys') {
        const parent = at(draft, path);
        if (parent && typeof parent === 'object') {
          for (const k of issue.keys) delete (parent as Obj)[k];
          fixes.push(`campo removido: ${[...path, ...issue.keys].join('.')}`);
          changed = true;
        }
        continue;
      }
      if (!path.length) continue;
      const parent = at(draft, path.slice(0, -1));
      const key = path[path.length - 1]!;
      if (parent === null || typeof parent !== 'object') continue;
      if (Array.isArray(parent) && typeof key === 'number') {
        // Elemento de lista inválido (ex.: bloco quebrado): remove só ele.
        parent.splice(key, 1);
        fixes.push(`item inválido removido: ${path.join('.')}`);
        changed = true;
        break; // índices mudaram: revalida
      }
      // (O zod não inclui o valor na issue: confere no próprio dado se o campo falta.)
      const missing = !Object.prototype.hasOwnProperty.call(parent, key);
      if (key === 'type' || missing) {
        // Tipo desconhecido (discriminador) ou campo obrigatório ausente: remove o item inteiro da lista.
        const gp = at(draft, path.slice(0, -2));
        const pk = path[path.length - 2];
        if (Array.isArray(gp) && typeof pk === 'number') {
          gp.splice(pk, 1);
          fixes.push(`item incompleto removido: ${path.slice(0, -1).join('.')}`);
          changed = true;
          break;
        }
        continue;
      }
      delete (parent as Obj)[key as string];
      fixes.push(`valor inválido removido: ${path.join('.')}`);
      changed = true;
    }
    if (!changed) break;
  }
  return { doc: null, fixes };
}
