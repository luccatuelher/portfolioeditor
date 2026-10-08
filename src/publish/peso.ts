import type { PortfolioV4 } from '../schema/v4';
import { pick } from '../renderer/text';
import { mergeNda, ndaCount, publicSnapshot } from './publicSnapshot';
import { pesoEstimadoDasMiniaturas, soComoCapa, valeMiniatura } from '../core/miniaturas';
import { completarDimensoes } from '../core/dimensoesImagem';

/** O upload pelo navegador do GitHub não aceita arquivo acima disso. */
export const LIMITE_GITHUB_BYTES = 25 * 1024 * 1024;

export interface ImagemPesada {
  id: string;
  bytes: number;
  /** Onde a imagem aparece primeiro ("projeto “A Travessia”", "página Sobre"). */
  onde: string;
}

export interface PesoDoSite {
  /** Estimativa do index.html inteiro, em bytes. */
  total: number;
  runtime: number;
  dados: number;
  imagens: ImagemPesada[];
}

function idsEm(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) node.forEach((n) => idsEm(n, out));
  else if (node && typeof node === 'object') {
    const r = node as Record<string, unknown>;
    if (typeof r['assetId'] === 'string') out.add(r['assetId']);
    // A imagem de SEO não vai no index.html (vai como arquivo ao lado).
    for (const [k, v] of Object.entries(r)) if (k !== 'seo') idsEm(v, out);
  }
}

/**
 * Peso estimado do site publicado, sem gerar o arquivo: o runtime, os dados
 * públicos e cada imagem que vai para o site (públicas e NDA; rascunho não
 * entra). Serve para ver, antes de baixar, se o index.html cabe no upload do
 * GitHub e quais imagens mais pesam.
 */
export function pesoDoSite(doc: PortfolioV4, assets: Record<string, string>, runtimeBytes: number, opts: { miniaturas?: boolean } = {}): PesoDoSite {
  const { data, nda } = publicSnapshot(doc);
  const dados = JSON.stringify(data).length + (ndaCount(nda) ? Math.round(JSON.stringify(nda).length * 1.4) : 0);

  // Onde cada imagem aparece primeiro: o nome que a pessoa reconhece.
  const onde = new Map<string, string>();
  const marcar = (node: unknown, rotulo: string): void => {
    const ids = new Set<string>();
    idsEm(node, ids);
    for (const id of ids) if (!onde.has(id)) onde.set(id, rotulo);
  };
  marcar(data.site, 'cabeçalho / tema');
  for (const p of [...data.pages]) marcar(p, `página ${pick(p.title, 'pt') || p.slug}`);
  const itens = [
    ...data.collections.projects.map((i) => [i, `projeto “${pick(i.title, 'pt')}”`] as const),
    ...nda.projects.map((i) => [i, `projeto NDA “${pick(i.title, 'pt')}”`] as const),
    ...data.collections.blog.map((i) => [i, `nota “${pick(i.title, 'pt')}”`] as const),
    ...nda.blog.map((i) => [i, `nota NDA “${pick(i.title, 'pt')}”`] as const),
    ...[...data.collections.gallery, ...nda.gallery].map((i) => [i, 'galeria'] as const),
    ...[...data.collections.sketches, ...nda.sketches].map((i) => [i, 'sketches'] as const),
    ...(nda.blocks ?? []).map((b) => [b.block, 'elemento NDA'] as const),
  ];
  for (const [item, rotulo] of itens) marcar(item, rotulo);

  const imagens = [...onde.keys()]
    .filter((id) => assets[id])
    .map((id) => ({ id, bytes: assets[id]!.length, onde: onde.get(id)! }))
    .sort((a, b) => b.bytes - a.bytes);
  // Publicando pelo editor, as imagens em grade ganham miniatura (core/miniaturas).
  // Vale também para o NDA (o que o visitante vê ao destrancar), e a foto inteira
  // de quem só serve de capa sai do arquivo quando ganha miniatura.
  let miniaturas = 0;
  let capasInteiras = 0;
  if (opts.miniaturas) {
    const vista = completarDimensoes(ndaCount(nda) ? mergeNda(data, nda) : data, assets);
    miniaturas = pesoEstimadoDasMiniaturas(vista, (id) => assets[id]?.length ?? 0);
    for (const id of soComoCapa(vista)) if (valeMiniatura(vista.assets[id])) capasInteiras += assets[id]?.length ?? 0;
  }
  const somaImagens = imagens.reduce((s, i) => s + i.bytes, 0);
  return { total: runtimeBytes + dados + somaImagens + miniaturas - capasInteiras, runtime: runtimeBytes, dados, imagens };
}

/** "3,4 MB" / "820 KB". */
export function formatarPeso(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
