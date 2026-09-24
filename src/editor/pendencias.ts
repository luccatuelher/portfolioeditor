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
