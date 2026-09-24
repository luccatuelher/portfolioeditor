import { safeClone } from '../core/access';
import type { AssetMeta, Block, BlogItem, GalleryItem, PortfolioV4, ProjectItem, Section, SketchItem, Visibility } from '../schema/v4';
import { aberto, paginaVaiProSite, vaiProSite } from '../core/visibilidade';

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
  /** Blocos NDA soltos em páginas e itens públicos, com o lugar de onde saíram. */
  blocks?: NdaBlock[];
}

/**
 * Um bloco NDA fora de um item NDA (numa página ou num projeto público). Sai
 * do público e vai cifrado; ao desbloquear, volta logo depois de `afterId` (o
 * bloco que vinha antes dele; null = início da seção).
 */
export interface NdaBlock {
  onde: { page: string } | { coll: 'projects' | 'blog'; id: string };
  sectionId: string;
  afterId: string | null;
  block: Block;
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
  return sections.map((s) => ({ ...s, blocks: s.blocks.filter((b) => aberto(b.visibility)) }));
}

/** Dentro de um item NDA (já cifrado inteiro), os blocos NDA vão junto; só o rascunho fica. */
function semRascunhos(sections: Section[]): Section[] {
  return sections.map((s) => ({ ...s, blocks: s.blocks.filter((b) => vaiProSite(b.visibility)) }));
}

/** Recolhe os blocos NDA de um conjunto de seções públicas, lembrando o lugar de cada um. */
function recolherBlocosNda(sections: Section[], onde: NdaBlock['onde'], out: NdaBlock[]): void {
  for (const s of sections) {
    let anterior: string | null = null;
    for (const b of s.blocks) {
      if (!vaiProSite(b.visibility)) continue;
      if (!aberto(b.visibility)) out.push({ onde, sectionId: s.id, afterId: anterior, block: b });
      anterior = b.id;
    }
  }
}

export function publicSnapshot(input: PortfolioV4): PublicResult {
  const d = safeClone(input);

  const splitPublic = <T extends { visibility: Visibility }>(items: T[]): T[] => items.filter((i) => aberto(i.visibility));
  const splitNda = <T extends { visibility: Visibility }>(items: T[]): T[] => items.filter((i) => vaiProSite(i.visibility) && !aberto(i.visibility));
  const limparSecoes = <T extends { sections: Section[] }>(items: T[]): T[] => items.map((it) => ({ ...it, sections: soBlocosPublicos(it.sections) }));
  const secoesNda = <T extends { sections: Section[] }>(items: T[]): T[] => items.map((it) => ({ ...it, sections: semRascunhos(it.sections) }));

  // Blocos NDA soltos: das páginas publicadas e dos projetos/notas públicos.
  const blocks: NdaBlock[] = [];
  for (const p of d.pages) if (paginaVaiProSite(p)) recolherBlocosNda(p.sections, { page: p.id }, blocks);
  for (const coll of ['projects', 'blog'] as const) {
    for (const it of splitPublic<ProjectItem | BlogItem>(d.collections[coll])) recolherBlocosNda(it.sections, { coll, id: it.id }, blocks);
  }

  const nda: NdaBundle = {
    projects: secoesNda(splitNda(d.collections.projects)),
    blog: secoesNda(splitNda(d.collections.blog)),
    gallery: splitNda(d.collections.gallery),
    sketches: splitNda(d.collections.sketches),
    blocks,
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
    .filter(paginaVaiProSite)
    .map((p) => ({ ...p, sections: soBlocosPublicos(p.sections) }));

  // Poda assets: mantém só os referenciados pelo conteúdo público.
  const used = new Set<string>();
  collectAssetIds({ pages: d.pages, collections: d.collections, site: d.site }, used);
  const prunedAssets: Record<string, AssetMeta> = {};
  for (const id of used) if (d.assets[id]) prunedAssets[id] = d.assets[id]!;
  d.assets = prunedAssets;

  return { data: d, nda };
}

/** Há algo para cifrar? (itens NDA ou blocos NDA soltos) */
export function ndaCount(nda: NdaBundle): number {
  return nda.projects.length + nda.blog.length + nda.gallery.length + nda.sketches.length + (nda.blocks?.length ?? 0);
}

/**
 * Site desbloqueado: os itens NDA entram nas coleções (mantendo visibility
 * 'nda': aparecem nas listas NDA e nas próprias páginas de detalhe) e cada
 * bloco NDA volta ao lugar de onde saiu. Se o bloco anterior não existe mais,
 * o bloco vai para o fim da seção; se a seção sumiu, ele fica de fora.
 */
export function mergeNda(base: PortfolioV4, bundle: NdaBundle): PortfolioV4 {
  const d = safeClone(base);
  d.collections = {
    projects: [...d.collections.projects, ...bundle.projects],
    blog: [...d.collections.blog, ...bundle.blog],
    gallery: [...d.collections.gallery, ...bundle.gallery],
    sketches: [...d.collections.sketches, ...bundle.sketches],
  };
  for (const nb of bundle.blocks ?? []) {
    const secs = 'page' in nb.onde ? d.pages.find((p) => p.id === (nb.onde as { page: string }).page)?.sections : d.collections[nb.onde.coll].find((i) => i.id === (nb.onde as { id: string }).id)?.sections;
    const s = secs?.find((x) => x.id === nb.sectionId);
    if (!s || s.blocks.some((b) => b.id === nb.block.id)) continue;
    const at = nb.afterId === null ? 0 : s.blocks.findIndex((b) => b.id === nb.afterId) + 1 || s.blocks.length;
    s.blocks.splice(at, 0, nb.block);
  }
  return d;
}
