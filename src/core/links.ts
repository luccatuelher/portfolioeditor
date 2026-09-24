import type { BlogItem, Page, PortfolioV4, ProjectItem, Section } from '../schema/v4';

/**
 * Links internos do site (#…), num lugar só.
 *
 * Um link para página é GRAVADO pelo id da página (#about, #page_k3j2) e
 * EXIBIDO pelo endereço dela (#sobre). Gravar o endereço fazia qualquer
 * renomeação de endereço quebrar, em silêncio, todo botão e link que apontava
 * para a página — o site levava para a Home. Projeto e nota já eram por id.
 */

export type Destino =
  | { tipo: 'vazio' }
  /** https:, mailto:, tel:, arquivo ao lado (cv.pdf)… */
  | { tipo: 'externo' }
  | { tipo: 'pagina'; page: Page }
  | { tipo: 'item'; colecao: 'projects' | 'blog'; item: ProjectItem | BlogItem }
  /** Aponta para página/projeto/nota que não existe (mais). */
  | { tipo: 'quebrado'; rota: string };

/** Rota de um "#…" (sem o #), decodificada; um "%" solto não derruba nada. */
function rotaDe(href: string): string {
  const cru = href.replace(/^#\/?/, '');
  try {
    return decodeURIComponent(cru);
  } catch {
    return cru;
  }
}

/** Para onde um link leva. Aceita página por id ou por endereço (dados antigos). */
export function destinoDoLink(doc: PortfolioV4, href: string): Destino {
  const h = href.trim();
  if (!h || h === '#') return { tipo: 'vazio' };
  if (!h.startsWith('#')) return { tipo: 'externo' };
  const rota = rotaDe(h);
  if (!rota || rota === 'home') {
    const home = doc.pages.find((p) => p.id === 'home');
    return home ? { tipo: 'pagina', page: home } : { tipo: 'quebrado', rota };
  }
  const det = rota.match(/^(project|blog)\/(.+)$/);
  if (det) {
    const colecao = det[1] === 'project' ? 'projects' : 'blog';
    const item = (doc.collections[colecao] as (ProjectItem | BlogItem)[]).find((i) => i.id === det[2]);
    return item ? { tipo: 'item', colecao, item } : { tipo: 'quebrado', rota };
  }
  const page = doc.pages.find((p) => p.id === rota) ?? doc.pages.find((p) => p.slug === rota);
  return page && page.kind === 'static' ? { tipo: 'pagina', page } : { tipo: 'quebrado', rota };
}

/** Como GRAVAR o link para uma página: pelo id, que não muda. */
export function hrefDaPagina(p: Page): string {
  return p.id === 'home' ? '#home' : `#${p.id}`;
}

/** Rota que aparece no endereço do navegador: a página pelo endereço dela (slug). */
export function rotaCanonica(doc: PortfolioV4, rota: string): string {
  if (!rota || rota === 'home' || /^(project|blog)\//.test(rota)) return rota;
  const page = doc.pages.find((p) => p.id === rota) ?? doc.pages.find((p) => p.slug === rota);
  if (!page || page.id === 'home') return page ? '' : rota;
  return page.slug || page.id;
}

/** O href que vai para o HTML do site: link de página pelo endereço bonito; o resto, como está. */
export function hrefPublico(doc: PortfolioV4, href: string): string {
  const d = destinoDoLink(doc, href);
  if (d.tipo !== 'pagina') return href;
  const r = rotaCanonica(doc, d.page.id);
  return r ? `#${r}` : '#';
}

/** Onde um link mora no documento: o bloco e o campo. */
export interface LinkNoDocumento {
  href: string;
  campo: 'button' | 'cv' | 'texto';
  /** Descrição curta para listas e avisos ("Botão “Ver projetos” · página Sobre"). */
  onde: string;
  container: { on: 'page'; pageId: string } | { on: 'item'; collection: 'projects' | 'blog'; itemId: string };
  sectionId: string;
  blockId: string;
}

const HREF_NO_HTML = /href="([^"]*)"/g;
const nomeDe = (v: { pt: string; en: string }): string => v.pt || v.en;

/**
 * Todos os links do conteúdo (botões, CV do bloco Contato e links dentro de
 * textos), de páginas, projetos e notas — rascunhos inclusive: quem decide o
 * que importa é quem pergunta.
 */
export function linksDoDocumento(doc: PortfolioV4): LinkNoDocumento[] {
  const out: LinkNoDocumento[] = [];
  const secoes = (sections: Section[], container: LinkNoDocumento['container'], lugar: string): void => {
    for (const s of sections) {
      for (const b of s.blocks) {
        const base = { container, sectionId: s.id, blockId: b.id };
        if (b.type === 'button') out.push({ ...base, href: b.content.href, campo: 'button', onde: `Botão “${nomeDe(b.content.label)}” · ${lugar}` });
        else if (b.type === 'contact' && b.content.cvHref) out.push({ ...base, href: b.content.cvHref, campo: 'cv', onde: `CV do Contato · ${lugar}` });
        else if (b.type === 'text') {
          const vistos = new Set<string>();
          for (const html of [b.content.html.pt, b.content.html.en]) {
            for (const m of html.matchAll(HREF_NO_HTML)) {
              const href = m[1]!.replace(/&amp;/g, '&');
              if (vistos.has(href)) continue;
              vistos.add(href);
              out.push({ ...base, href, campo: 'texto', onde: `Link num texto · ${lugar}` });
            }
          }
        }
      }
    }
  };
  for (const p of doc.pages) secoes(p.sections, { on: 'page', pageId: p.id }, `página ${nomeDe(p.title) || p.slug}`);
  for (const coll of ['projects', 'blog'] as const) {
    for (const it of doc.collections[coll] as (ProjectItem | BlogItem)[]) {
      secoes(it.sections, { on: 'item', collection: coll, itemId: it.id }, `${coll === 'projects' ? 'projeto' : 'nota'} “${nomeDe(it.title)}”`);
    }
  }
  return out;
}

/** Problema de um link interno para quem publica, ou null se está tudo certo. */
export function problemaDoLink(doc: PortfolioV4, href: string): string | null {
  const d = destinoDoLink(doc, href);
  if (d.tipo === 'quebrado') return 'leva para uma página que não existe mais';
  if (d.tipo === 'pagina' && d.page.visibility === 'draft' && d.page.id !== 'home') return `leva para a página “${nomeDe(d.page.title)}”, que está em rascunho (não vai para o site)`;
  if (d.tipo === 'item' && d.item.visibility === 'draft') return `leva para “${nomeDe(d.item.title)}”, que está em rascunho (não vai para o site)`;
  return null;
}

/**
 * Regrava links de página feitos pelo endereço (#sobre) como link pelo id
 * (#about). Idempotente; devolve quantos mudaram. Link quebrado fica como
 * está (para aparecer no aviso, e não sumir).
 */
export function linksPorId(doc: PortfolioV4): number {
  let n = 0;
  const porId = (href: string): string => {
    const d = destinoDoLink(doc, href);
    // "#" + id já é o formato novo; só muda o que foi achado pelo endereço.
    if (d.tipo !== 'pagina' || rotaDe(href.trim()) === d.page.id) return href;
    n++;
    return hrefDaPagina(d.page);
  };
  const secoes = (sections: Section[]): void => {
    for (const s of sections) {
      for (const b of s.blocks) {
        if (b.type === 'button') b.content.href = porId(b.content.href);
        else if (b.type === 'contact' && b.content.cvHref) b.content.cvHref = porId(b.content.cvHref);
        else if (b.type === 'text') {
          for (const l of ['pt', 'en'] as const) {
            b.content.html[l] = b.content.html[l].replace(HREF_NO_HTML, (todo, href: string) => {
              const novo = porId(href.replace(/&amp;/g, '&'));
              return novo === href.replace(/&amp;/g, '&') ? todo : `href="${novo}"`;
            });
          }
        }
      }
    }
  };
  for (const p of doc.pages) secoes(p.sections);
  for (const coll of ['projects', 'blog'] as const) for (const it of doc.collections[coll]) secoes(it.sections);
  return n;
}
