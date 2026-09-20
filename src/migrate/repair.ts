import { defaultTheme, DEFAULT_HEADER, DEFAULT_LAYOUT, PortfolioV4Schema, SCHEMA_VERSION, type PortfolioV4 } from '../schema/v4';
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
/**
 * Antes de validar: repõe as partes que dá para repor sem inventar conteúdo.
 * Perder o tema ou a lista de projetos não pode custar as PÁGINAS do usuário —
 * o conteúdo dele está nelas.
 */
function reporBasico(d: Obj, fixes: string[]): void {
  if (d['schemaVersion'] !== SCHEMA_VERSION && typeof d['schemaVersion'] === 'number') {
    d['schemaVersion'] = SCHEMA_VERSION;
    fixes.push('versão do formato normalizada');
  }
  if (!d['theme'] || typeof d['theme'] !== 'object') {
    d['theme'] = defaultTheme();
    fixes.push('tema reposto com o padrão');
  }
  const c = d['collections'];
  if (!c || typeof c !== 'object' || Array.isArray(c)) {
    d['collections'] = { projects: [], blog: [], gallery: [], sketches: [] };
    fixes.push('coleções repostas (vazias)');
  } else {
    for (const k of ['projects', 'blog', 'gallery', 'sketches']) {
      if (!Array.isArray((c as Obj)[k])) {
        (c as Obj)[k] = [];
        fixes.push(`coleção reposta (vazia): ${k}`);
      }
    }
  }
  const s = d['site'];
  if (!s || typeof s !== 'object' || Array.isArray(s)) {
    d['site'] = {
      name: { pt: '', en: '' }, role: { pt: '', en: '' }, locales: ['pt', 'en'],
      nav: [], ui: {}, header: DEFAULT_HEADER, layout: DEFAULT_LAYOUT,
    };
    fixes.push('dados do site repostos (nome e função em branco)');
  }
}

/** Ids repetidos quebram seleção e navegação: o segundo ganha um sufixo. */
function desduplicarIds(doc: PortfolioV4, fixes: string[]): void {
  const vistos = new Set<string>();
  const unico = (id: string, rotulo: string): string => {
    if (!vistos.has(id)) { vistos.add(id); return id; }
    let n = 2;
    while (vistos.has(`${id}-${n}`)) n++;
    const novo = `${id}-${n}`;
    vistos.add(novo);
    fixes.push(`${rotulo} com id repetido renomeado: ${id} → ${novo}`);
    return novo;
  };
  const slugs = new Set<string>();
  for (const p of doc.pages) {
    p.id = unico(p.id, 'página');
    if (slugs.has(p.slug)) {
      let n = 2;
      while (slugs.has(`${p.slug}-${n}`)) n++;
      fixes.push(`endereço repetido corrigido: ${p.slug} → ${p.slug}-${n}`);
      p.slug = `${p.slug}-${n}`;
    }
    slugs.add(p.slug);
    for (const s of p.sections) {
      s.id = unico(s.id, 'seção');
      for (const b of s.blocks) b.id = unico(b.id, 'elemento');
    }
  }
  for (const nome of ['projects', 'blog', 'gallery', 'sketches'] as const) {
    for (const item of doc.collections[nome]) item.id = unico(item.id, 'item');
  }
}

export function repairDoc(raw: unknown): RepairResult {
  const draft: unknown = structuredClone(raw);
  const fixes: string[] = [];
  /** Quantas vezes já mexemos em cada caminho: evita ficar consertando em círculo. */
  const tentativas = new Map<string, number>();
  // Páginas guardadas como objeto ({home: {...}}) ainda têm o conteúdo: viram lista.
  if (draft && typeof draft === 'object' && !Array.isArray(draft)) {
    const pgs = (draft as Obj)['pages'];
    if (pgs && typeof pgs === 'object' && !Array.isArray(pgs)) {
      const lista = Object.values(pgs as Obj).filter((p) => p && typeof p === 'object');
      if (lista.length) {
        (draft as Obj)['pages'] = lista;
        fixes.push('páginas convertidas de objeto para lista');
      }
    }
  }
  // Só vale tentar salvar se ainda houver páginas: é onde mora o conteúdo.
  if (draft && typeof draft === 'object' && !Array.isArray(draft) && Array.isArray((draft as Obj)['pages'])) {
    reporBasico(draft as Obj, fixes);
  }
  for (let round = 0; round < 200; round++) {
    const res = PortfolioV4Schema.safeParse(draft);
    if (res.success) {
      const doc = upgradeDoc(res.data);
      desduplicarIds(doc, fixes);
      return { doc, fixes };
    }
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
      const chaveCaminho = path.join('.');
      const jaTentado = (tentativas.get(chaveCaminho) ?? 0) + 1;
      tentativas.set(chaveCaminho, jaTentado);
      const atual = (parent as Obj)[key as string];
      if (jaTentado > 3) {
        // Esse campo não tem conserto (limite exclusivo, valor impossível).
        // Se ele é obrigatório, o que sai é o sub-objeto inteiro (um recorte
        // corrompido, por exemplo) — a imagem fica, sem recorte.
        if (Object.prototype.hasOwnProperty.call(parent, key)) {
          delete (parent as Obj)[key as string];
          fixes.push(`campo sem conserto removido: ${chaveCaminho}`);
          changed = true;
          continue;
        }
        const dono = at(draft, path.slice(0, -2));
        const chaveDono = path[path.length - 2];
        if (dono && typeof dono === 'object' && !Array.isArray(dono) && chaveDono !== undefined && Object.prototype.hasOwnProperty.call(dono, chaveDono)) {
          delete (dono as Obj)[chaveDono as string];
          fixes.push(`parte corrompida descartada: ${path.slice(0, -1).join('.')}`);
          changed = true;
          continue;
        }
      }
      // Tipo trocado por engano (número onde ia texto, texto onde ia número):
      // converter preserva o conteúdo; apagar perderia o nome do site.
      if (issue.code === 'invalid_type' && atual !== null && atual !== undefined && typeof atual !== 'object') {
        const esperado = (issue as { expected?: string }).expected;
        if (esperado === 'string') {
          (parent as Obj)[key as string] = String(atual);
          fixes.push(`valor convertido para texto: ${path.join('.')}`);
          changed = true;
          continue;
        }
        if (esperado === 'number' && Number.isFinite(Number(atual))) {
          (parent as Obj)[key as string] = Number(atual);
          fixes.push(`valor convertido para número: ${path.join('.')}`);
          changed = true;
          continue;
        }
      }
      // Número fora da faixa: prende no limite em vez de perder a escolha.
      if ((issue.code === 'too_small' || issue.code === 'too_big') && typeof atual === 'number') {
        const limite = (issue as { minimum?: number; maximum?: number });
        const novo = issue.code === 'too_small' ? Number(limite.minimum ?? 1) : Number(limite.maximum ?? 12);
        if (Number.isFinite(novo)) {
          (parent as Obj)[key as string] = novo;
          fixes.push(`valor ajustado ao limite: ${path.join('.')} = ${novo}`);
          changed = true;
          continue;
        }
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
    if (!changed) {
      // Travou: descarta o sub-objeto inteiro que está impedindo (ex.: um
      // recorte de imagem corrompido) em vez de perder o documento todo.
      const p = PortfolioV4Schema.safeParse(draft);
      const caminho = p.success ? [] : (p.error.issues[0]?.path ?? []);
      let removido = false;
      for (let i = caminho.length - 1; i > 0; i--) {
        const alvo = at(draft, caminho.slice(0, i));
        const dono = at(draft, caminho.slice(0, i - 1));
        const chave = caminho[i - 1]!;
        if (alvo && typeof alvo === 'object' && !Array.isArray(alvo) && dono && typeof dono === 'object' && !Array.isArray(dono)) {
          delete (dono as Obj)[chave as string];
          fixes.push(`parte corrompida descartada: ${caminho.slice(0, i).join('.')}`);
          removido = true;
          break;
        }
      }
      if (!removido) break;
    }
  }
  return { doc: null, fixes };
}
