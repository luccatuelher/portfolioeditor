import { safeClone } from '../core/access';
import type { AssetMeta, BlogItem, GalleryItem, PortfolioV4, ProjectItem, SketchItem } from '../schema/v4';

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

export function publicSnapshot(input: PortfolioV4): PublicResult {
  const d = safeClone(input);

  const splitPublic = <T extends { visibility: string }>(items: T[]): T[] => items.filter((i) => i.visibility === 'public');
  const splitNda = <T extends { visibility: string }>(items: T[]): T[] => items.filter((i) => i.visibility === 'nda');

  const nda: NdaBundle = {
    projects: splitNda(d.collections.projects),
    blog: splitNda(d.collections.blog),
    gallery: splitNda(d.collections.gallery),
    sketches: splitNda(d.collections.sketches),
  };

  d.collections = {
    projects: splitPublic(d.collections.projects),
    blog: splitPublic(d.collections.blog),
    gallery: splitPublic(d.collections.gallery),
    sketches: splitPublic(d.collections.sketches),
  };

  // Páginas: mantém a página NDA (só casca: título + lista 'nda', sem itens —
  // estes vão cifrados) e remove blocos não-públicos.
  d.pages = d.pages
    .map((p) => ({
      ...p,
      sections: p.sections.map((s) => ({ ...s, blocks: s.blocks.filter((b) => b.visibility === 'public') })),
    }));

  // Poda assets: mantém só os referenciados pelo conteúdo público.
  const used = new Set<string>();
  collectAssetIds({ pages: d.pages, collections: d.collections, site: d.site }, used);
  const prunedAssets: Record<string, AssetMeta> = {};
  for (const id of used) if (d.assets[id]) prunedAssets[id] = d.assets[id]!;
  d.assets = prunedAssets;

  return { data: d, nda };
}
