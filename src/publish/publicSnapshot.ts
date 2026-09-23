import { safeClone } from '../core/access';
import type { AssetMeta, BlogItem, GalleryItem, PortfolioV4, ProjectItem, Section, SketchItem } from '../schema/v4';

/**
 * Separa o documento em conteúdo PÚBLICO (visibility 'public') e conteúdo NDA
 * (visibility 'nda'). Rascunhos ('draft') são descartados. O público não contém
 * nada de NDA/rascunho; o NDA é devolvido à parte para ser encriptado (F7).
 */
export interface NdaBundle {
  projects: ProjectItem[];
  blog: BlogItem[];
  gallery: GalleryItem[];
  sketches: SketchItem[];
}

export interface PublicResult {
  data: PortfolioV4;
  nda: NdaBundle;
}

function collectAssetIds(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const x of node) collectAssetIds(x, out);
  } else if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>;
    if (typeof rec['assetId'] === 'string') out.add(rec['assetId']);
    for (const v of Object.values(rec)) collectAssetIds(v, out);
  }
}

/**
 * Só blocos públicos saem do editor. O site esconde os demais na tela, mas o
 * que está nos dados vai inteiro para o código da página — um bloco marcado
 * NDA dentro de um projeto público seria lido por qualquer um no "ver código".
 */
function soBlocosPublicos(sections: Section[]): Section[] {
  return sections.map((s) => ({ ...s, blocks: s.blocks.filter((b) => b.visibility === 'public') }));
}

export function publicSnapshot(input: PortfolioV4): PublicResult {
  const d = safeClone(input);

  const splitPublic = <T extends { visibility: string }>(items: T[]): T[] => items.filter((i) => i.visibility === 'public');
  const splitNda = <T extends { visibility: string }>(items: T[]): T[] => items.filter((i) => i.visibility === 'nda');
  const limparSecoes = <T extends { sections: Section[] }>(items: T[]): T[] => items.map((it) => ({ ...it, sections: soBlocosPublicos(it.sections) }));

  const nda: NdaBundle = {
    projects: limparSecoes(splitNda(d.collections.projects)),
    blog: limparSecoes(splitNda(d.collections.blog)),
    gallery: splitNda(d.collections.gallery),
    sketches: splitNda(d.collections.sketches),
  };

  d.collections = {
    projects: limparSecoes(splitPublic(d.collections.projects)),
    blog: limparSecoes(splitPublic(d.collections.blog)),
    gallery: splitPublic(d.collections.gallery),
    sketches: splitPublic(d.collections.sketches),
  };

  // Páginas: mantém a página NDA (só casca: título + lista 'nda', sem itens —
  // estes vão cifrados), descarta as páginas em rascunho e remove blocos
  // não-públicos.
  d.pages = d.pages
    // (A Home e os modelos de detalhe ficam sempre: sem eles o site não abre.)
    .filter((p) => p.visibility !== 'draft' || p.id === 'home' || p.kind === 'template')
    .map((p) => ({ ...p, sections: soBlocosPublicos(p.sections) }));

  // Poda assets: mantém só os referenciados pelo conteúdo público.
  const used = new Set<string>();
  collectAssetIds({ pages: d.pages, collections: d.collections, site: d.site }, used);
  const prunedAssets: Record<string, AssetMeta> = {};
  for (const id of used) if (d.assets[id]) prunedAssets[id] = d.assets[id]!;
  d.assets = prunedAssets;

  return { data: d, nda };
}
