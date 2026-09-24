import type { Block, ImageRef, PortfolioV4, Section } from '../schema/v4';
import { pick } from '../renderer/text';
import type { Container, Selection } from './paths';

/**
 * Imagem publicada sem descrição (texto alternativo): o que o leitor de tela
 * lê no lugar dela, e o que o buscador entende da imagem. `alvo` é o que
 * selecionar para cair direto no campo de descrição.
 */
export interface ImagemSemDescricao {
  onde: string;
  imagem: ImageRef;
  alvo: NonNullable<Selection>;
  /** Quadro do storyboard a pôr em foco no Inspector. */
  quadro?: number;
}

const temImagem = (r: ImageRef | undefined): boolean => !!r && (!!r.assetId || !!(r.url && r.url.trim()));
const semDescricao = (r: ImageRef): boolean => temImagem(r) && !r.alt.pt.trim() && !r.alt.en.trim();

/** As imagens que vão para o site (rascunho não) e ainda não têm descrição. */
export function imagensSemDescricao(doc: PortfolioV4): ImagemSemDescricao[] {
  const out: ImagemSemDescricao[] = [];
  const blocos = (sections: Section[], container: Container, lugar: string): void => {
    for (const s of sections) {
      for (const b of s.blocks as Block[]) {
        if (b.visibility === 'draft') continue;
        const ref = { container, sectionId: s.id, blockId: b.id };
        if (b.type === 'image' && semDescricao(b.content.image)) out.push({ onde: `Imagem · ${lugar}`, imagem: b.content.image, alvo: { kind: 'block', ref } });
        if (b.type === 'storyboard') {
          b.content.frames.forEach((f, i) => {
            if (semDescricao(f)) out.push({ onde: `quadro ${i + 1} do Storyboard · ${lugar}`, imagem: f, alvo: { kind: 'block', ref }, quadro: i });
          });
        }
      }
    }
  };
  for (const p of doc.pages) if (p.visibility !== 'draft') blocos(p.sections, { on: 'page', pageId: p.id }, `página ${pick(p.title, 'pt') || p.slug}`);
  for (const coll of ['projects', 'blog'] as const) {
    for (const it of doc.collections[coll]) {
      if (it.visibility === 'draft') continue;
      blocos(it.sections, { on: 'item', collection: coll, itemId: it.id }, `${coll === 'projects' ? 'projeto' : 'nota'} “${pick(it.title, 'pt')}”`);
    }
  }
  for (const g of doc.collections.gallery) {
    if (g.visibility !== 'draft' && semDescricao(g.image)) out.push({ onde: pick(g.caption, 'pt') ? `galeria “${pick(g.caption, 'pt')}”` : 'imagem da galeria', imagem: g.image, alvo: { kind: 'item', collection: 'gallery', itemId: g.id } });
  }
  for (const s of doc.collections.sketches) {
    if (s.visibility !== 'draft' && semDescricao(s.image)) out.push({ onde: 'sketch', imagem: s.image, alvo: { kind: 'item', collection: 'sketches', itemId: s.id } });
  }
  return out;
}

/** Um texto publicado que só existe num idioma. `falta` é o idioma a preencher. */
export interface TextoSemTraducao {
  onde: string;
  falta: 'pt' | 'en';
  /** Começo do texto que existe, para a pessoa reconhecer qual é. */
  trecho: string;
  alvo: NonNullable<Selection>;
}

const limpo = (s: string): string => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Textos que vão para o site com PT e sem EN (ou o contrário). No site, o
 * visitante do outro idioma vê o texto do idioma que existe — funciona, mas
 * fica pela metade. Mesmos campos que o canvas marca com "sem EN"/"sem PT".
 */
export function textosSemTraducao(doc: PortfolioV4): TextoSemTraducao[] {
  const out: TextoSemTraducao[] = [];
  const ver = (v: { pt: string; en: string } | undefined, onde: string, alvo: NonNullable<Selection>): void => {
    if (!v) return;
    const pt = limpo(v.pt);
    const en = limpo(v.en);
    if (!!pt === !!en) return;
    const texto = pt || en;
    out.push({ onde, falta: pt ? 'en' : 'pt', trecho: texto.length > 40 ? `${texto.slice(0, 40)}…` : texto, alvo });
  };
  ver(doc.site.name, 'nome do site', { kind: 'site' });
  ver(doc.site.role, 'função no cabeçalho', { kind: 'site' });
  const blocos = (sections: Section[], container: Container, lugar: string): void => {
    for (const s of sections) {
      for (const b of s.blocks as Block[]) {
        if (b.visibility === 'draft') continue;
        const alvo = { kind: 'block' as const, ref: { container, sectionId: s.id, blockId: b.id } };
        if (b.type === 'heading') ver(b.content.text, `Título · ${lugar}`, alvo);
        else if (b.type === 'text') ver(b.content.html, `Texto · ${lugar}`, alvo);
        else if (b.type === 'button') ver(b.content.label, `Botão · ${lugar}`, alvo);
        else if (b.type === 'image') ver(b.content.image.alt, `Descrição da imagem · ${lugar}`, alvo);
        else if (b.type === 'contact') {
          ver(b.content.heading, `Contato (título) · ${lugar}`, alvo);
          ver(b.content.body, `Contato (texto) · ${lugar}`, alvo);
        }
      }
    }
  };
  for (const p of doc.pages) {
    if (p.visibility === 'draft') continue;
    const nome = `página ${pick(p.title, 'pt') || p.slug}`;
    if (p.kind === 'static') ver(p.title, `nome da ${nome}`, { kind: 'page', pageId: p.id });
    blocos(p.sections, { on: 'page', pageId: p.id }, nome);
  }
  for (const it of doc.collections.projects) {
    if (it.visibility === 'draft') continue;
    const nome = `projeto “${pick(it.title, 'pt')}”`;
    const alvo = { kind: 'item' as const, collection: 'projects' as const, itemId: it.id };
    ver(it.title, `título do ${nome}`, alvo);
    ver(it.description, `descrição do ${nome}`, alvo);
    blocos(it.sections, { on: 'item', collection: 'projects', itemId: it.id }, nome);
  }
  for (const it of doc.collections.blog) {
    if (it.visibility === 'draft') continue;
    const nome = `nota “${pick(it.title, 'pt')}”`;
    const alvo = { kind: 'item' as const, collection: 'blog' as const, itemId: it.id };
    ver(it.title, `título da ${nome}`, alvo);
    ver(it.excerpt, `resumo da ${nome}`, alvo);
    blocos(it.sections, { on: 'item', collection: 'blog', itemId: it.id }, nome);
  }
  for (const g of doc.collections.gallery) {
    if (g.visibility !== 'draft') ver(g.caption, 'legenda da galeria', { kind: 'item', collection: 'gallery', itemId: g.id });
  }
  return out;
}
