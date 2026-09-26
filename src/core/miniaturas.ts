import type { AssetMeta, Block, ImageRef, PortfolioV4, Section } from '../schema/v4';

/**
 * Miniaturas das imagens que o site mostra em GRADE — capa de projeto e de
 * nota, galeria, sketches, quadros de storyboard. Ali a foto aparece com uns
 * 300–450 px de largura, mas ia inteira (até 2400 px): a Home esperava as
 * fotos grandes dos cards e o celular decodificava imagens enormes. O
 * visualizador ampliado e o bloco Imagem continuam com a foto inteira.
 *
 * A miniatura é outra entrada no mapa de imagens (`<id>-mini`); quem não tem
 * miniatura (SVG, GIF, foto já pequena, publicação sem navegador) usa a foto
 * inteira — nada quebra na falta dela.
 */

/** Largura da miniatura: um card de ~450 px em tela 2×. */
export const LARGURA_MINIATURA = 960;

export const miniId = (id: string): string => `${id}-mini`;

/** Só vale gerar para foto bem maior que a miniatura, e não para vetor/animação. */
export function valeMiniatura(meta: AssetMeta | undefined): boolean {
  if (!meta) return false;
  if (/svg|gif/i.test(meta.mime)) return false;
  return meta.w > LARGURA_MINIATURA * 1.25;
}

/** As imagens que aparecem em grade no conteúdo dado (ids de asset). */
export function imagensEmGrade(data: PortfolioV4): Set<string> {
  const out = new Set<string>();
  const add = (r: ImageRef | undefined): void => {
    if (r?.assetId) out.add(r.assetId);
  };
  for (const p of data.collections.projects) add(p.thumb);
  for (const b of data.collections.blog) add(b.thumb);
  for (const g of data.collections.gallery) add(g.image);
  for (const s of data.collections.sketches) add(s.image);
  const quadros = (secs: Section[]): void => {
    for (const s of secs) for (const b of s.blocks as Block[]) if (b.type === 'storyboard') b.content.frames.forEach(add);
  };
  for (const p of data.pages) quadros(p.sections);
  for (const i of [...data.collections.projects, ...data.collections.blog]) quadros(i.sections);
  return out;
}

/** Gera a miniatura (data URL) de uma foto; null se não conseguir. */
export type GerarMiniatura = (dataUrl: string, largura: number) => Promise<string | null>;

/**
 * Miniaturas para as imagens em grade do conteúdo público. Fica só a que sai
 * de fato menor (no máximo 70% da original); falhar numa não impede as outras.
 */
export async function miniaturasDoSite(
  data: PortfolioV4,
  assetMap: Record<string, string>,
  gerar: GerarMiniatura,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const id of imagensEmGrade(data)) {
    const original = assetMap[id];
    if (!original || !valeMiniatura(data.assets[id])) continue;
    const mini = await gerar(original, LARGURA_MINIATURA).catch(() => null);
    if (mini && mini.length <= original.length * 0.7) out[miniId(id)] = mini;
  }
  return out;
}

/**
 * Bytes estimados das miniaturas (para o peso mostrado antes de baixar): a
 * foto encolhe na área — (960 / largura)² do tamanho original.
 */
export function pesoEstimadoDasMiniaturas(data: PortfolioV4, tamanhoDe: (id: string) => number): number {
  let total = 0;
  for (const id of imagensEmGrade(data)) {
    const meta = data.assets[id];
    if (!valeMiniatura(meta)) continue;
    total += Math.round(tamanhoDe(id) * (LARGURA_MINIATURA / meta!.w) ** 2);
  }
  return total;
}
