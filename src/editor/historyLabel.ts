import type { Patch } from 'immer';
import type { PortfolioV4 } from '../schema/v4';
import { TYPE_LABEL } from '../renderer/preview';
import { pick } from '../renderer/text';

/*
 * Nome curto de uma mudança do histórico ("texto de Título", "cores do tema"),
 * tirado dos próprios patches — sem precisar rotular cada edição onde ela é
 * feita. Serve aos botões de desfazer/refazer e ao aviso "Desfeito: …".
 */

type Caminho = (string | number)[];

const CAMPO_DO_BLOCO: Record<string, string> = {
  content: 'conteúdo', span: 'largura', responsive: 'largura por tela', visibility: 'visibilidade',
  style: 'estilo', align: 'alinhamento', rowAlign: 'alinhamento da linha', stack: 'posição', pad: 'espaço',
};
const CAMPO_DO_SITE: Record<string, string> = {
  name: 'nome do site', role: 'função no cabeçalho', header: 'cabeçalho', nav: 'menu', favicon: 'ícone da aba',
  layout: 'área da página', backdrop: 'fundo do site', url: 'endereço do site', analytics: 'analytics',
};
const PARTE_DO_TEMA: Record<string, string> = { colors: 'cores do tema', fonts: 'fontes', type: 'escala tipográfica' };
const COLECAO: Record<string, string> = { projects: 'projeto', blog: 'nota', gallery: 'imagem da galeria', sketches: 'sketch' };

const aspas = (s: string): string => (s ? ` “${s.length > 28 ? `${s.slice(0, 28)}…` : s}”` : '');

/** Segue um caminho de patch no documento (o que ainda existir). */
function em(doc: unknown, caminho: Caminho): unknown {
  let cur = doc;
  for (const k of caminho) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[k];
  }
  return cur;
}

/** Descreve um patch; `null` quando não diz nada útil sozinho (ex.: metadado de imagem). */
function descrever(doc: PortfolioV4, p: Patch): string | null {
  const c = p.path as Caminho;
  const [raiz] = c;
  if (raiz === 'assets') return null;
  if (raiz === 'theme') return PARTE_DO_TEMA[String(c[1])] ?? 'tema';
  if (raiz === 'site') return CAMPO_DO_SITE[String(c[1])] ?? 'site';

  // Blocos: .../sections/i/blocks/k/campo…
  const b = c.lastIndexOf('blocks');
  if (b >= 0) {
    if (c.length === b + 1 || c.length === b + 2) {
      // A própria lista de blocos: entrou, saiu ou mudou de lugar.
      if (p.op === 'add' && c.length === b + 2 && p.value && typeof p.value === 'object' && 'type' in p.value) {
        return `novo ${TYPE_LABEL[String((p.value as { type: string }).type)] ?? 'elemento'}`;
      }
      if (p.op === 'remove') return 'exclusão de elemento';
      return 'ordem dos elementos';
    }
    const bloco = em(doc, c.slice(0, b + 2)) as { type?: string } | undefined;
    const tipo = (bloco?.type && TYPE_LABEL[bloco.type]) || 'elemento';
    const campo = String(c[b + 2]);
    if (campo === 'content') {
      const sub = String(c[b + 3] ?? '');
      if (sub === 'text' || sub === 'html') return `texto de ${tipo}`;
      if (sub === 'image' || sub === 'frames') return `imagem de ${tipo}`;
    }
    return `${CAMPO_DO_BLOCO[campo] ?? 'ajuste'} de ${tipo}`;
  }
  // Seções: .../sections/i/…
  const s = c.lastIndexOf('sections');
  if (s >= 0) return c.length <= s + 2 ? 'seções' : 'ajuste de seção';

  if (raiz === 'collections') {
    const nome = COLECAO[String(c[1])] ?? 'item';
    if (c.length <= 3) return p.op === 'remove' ? `exclusão de ${nome}` : p.op === 'add' ? `novo ${nome}` : `ordem dos itens`;
    const item = em(doc, c.slice(0, 3)) as { title?: { pt: string; en: string } } | undefined;
    return `${nome}${aspas(item?.title ? pick(item.title, 'pt') : '')}`;
  }
  if (raiz === 'pages') {
    if (c.length <= 2) return 'páginas';
    const pag = em(doc, c.slice(0, 2)) as { title?: { pt: string; en: string } } | undefined;
    return `página${aspas(pag?.title ? pick(pag.title, 'pt') : '')}`;
  }
  return null;
}

/**
 * Nome da mudança guardada numa entrada do histórico. Várias partes diferentes
 * de uma vez (colar uma seção, restaurar um backup) viram "várias mudanças".
 */
export function rotuloDaMudanca(doc: PortfolioV4, patches: Patch[]): string {
  // A lista de elementos que só perdeu itens é exclusão; que só ganhou, inclusão.
  // (Tirar um do meio também "anda uma casa" com os seguintes — são reposições,
  // não uma reordenação.)
  const naLista = (p: Patch): boolean => {
    const c = p.path as Caminho;
    const b = c.lastIndexOf('blocks');
    return b >= 0 && c.length === b + 2;
  };
  const tirou = patches.some((p) => naLista(p) && p.op === 'remove');
  const pos = patches.find((p) => naLista(p) && p.op === 'add');
  if (tirou && !pos) return 'exclusão de elemento';
  if (pos && !tirou) return descrever(doc, pos) ?? 'novo elemento';
  const nomes = [...new Set(patches.map((p) => descrever(doc, p)).filter((n): n is string => !!n))];
  if (nomes.length === 0) return 'edição';
  if (nomes.length === 1) return nomes[0]!;
  // "ordem dos elementos" + "largura de X" num arrasto: o que conta é o movimento.
  if (nomes.includes('ordem dos elementos')) return 'ordem dos elementos';
  return 'várias mudanças';
}
