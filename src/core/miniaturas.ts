import type { AssetMeta, Block, ImageRef, PortfolioV4, Section } from '../schema/v4';
import { resolveSpan } from '../renderer/responsive';
import { dimensoesDaImagem } from './dimensoesImagem';

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
/**
 * Versão do tamanho do bloco Imagem: chave própria, para nunca ser confundida
 * com a miniatura de grade (960 px) — um pacote NDA antigo, ou uma capa
 * pública usada num bloco largo do NDA, mostraria a de 960 esticada.
 */
export const blocoVersaoId = (id: string): string => `${id}-bloco`;

/** Só vale gerar para foto bem maior que a miniatura, e não para vetor/animação. */
export function valeMiniatura(meta: AssetMeta | undefined, largura: number = LARGURA_MINIATURA): boolean {
  if (!meta) return false;
  if (/svg|gif/i.test(meta.mime)) return false;
  return meta.w > largura * 1.25;
}

/**
 * Px por coluna (de 12) que um bloco Imagem pode chegar a ocupar, já contando a
 * densidade da tela. Computador: notebook grande (1728 px) em tela 2×, com a
 * margem e a largura máxima do tema; tablet ~710 px em 2×; celular ~360 px em 3×.
 */
export function pxPorColuna(data: Pick<PortfolioV4, 'site'>): { desktop: number; tablet: number; mobile: number } {
  const margem = data.site.layout?.margin ?? 10;
  const maximo = data.site.layout?.maxWidth ?? 2200;
  const conteudo = Math.min(maximo, 1728 * (1 - (2 * margem) / 100));
  return { desktop: (conteudo * 2) / 12, tablet: 118, mobile: 90 };
}
const FATOR_LARGURA_SECAO: Record<string, number> = { wide: 1.12, full: 1.25 };

/**
 * Largura (px) que basta para um bloco Imagem nítido em qualquer tela. Um logo
 * em 2 de 12 colunas não precisa da foto de 1254 px — mas o mesmo bloco em 12
 * colunas precisa. Recorte amplia o trecho: a foto inteira precisa ser maior.
 */
export function larguraDoBloco(b: Extract<Block, { type: 'image' }>, larguraSecao?: string, porColuna = pxPorColuna({ site: {} as PortfolioV4['site'] })): number {
  const spans = { desktop: b.span, tablet: b.responsive?.tablet?.span, mobile: b.responsive?.mobile?.span };
  const fator = FATOR_LARGURA_SECAO[larguraSecao ?? ''] ?? 1;
  const px = Math.max(
    resolveSpan(spans, 'desktop').span * porColuna.desktop * fator,
    resolveSpan(spans, 'tablet').span * porColuna.tablet,
    resolveSpan(spans, 'mobile').span * porColuna.mobile,
  );
  const recorte = b.content.image.crop?.w;
  return Math.ceil(px / (recorte && recorte > 0 && recorte < 1 ? recorte : 1) / 16) * 16;
}

/** Os blocos Imagem do conteúdo (com a largura da seção onde estão). */
function blocosImagem(data: PortfolioV4): { bloco: Extract<Block, { type: 'image' }>; larguraSecao?: string }[] {
  const out: { bloco: Extract<Block, { type: 'image' }>; larguraSecao?: string }[] = [];
  const visitar = (secs: Section[]): void => {
    for (const s of secs) for (const b of s.blocks as Block[]) if (b.type === 'image') out.push({ bloco: b, larguraSecao: s.style.width });
  };
  for (const p of data.pages) visitar(p.sections);
  for (const i of [...data.collections.projects, ...data.collections.blog]) visitar(i.sections);
  return out;
}

/**
 * Largura da versão de cada imagem usada em bloco Imagem: a que a largura do
 * bloco pede. Usada em mais de um bloco, vale a maior.
 */
export function largurasDosBlocos(data: PortfolioV4): Map<string, number> {
  const out = new Map<string, number>();
  const px = pxPorColuna(data);
  for (const { bloco, larguraSecao } of blocosImagem(data)) {
    const id = bloco.content.image.assetId;
    if (id) out.set(id, Math.max(out.get(id) ?? 0, larguraDoBloco(bloco, larguraSecao, px)));
  }
  return out;
}

/** Todas as versões reduzidas a gerar: chave no mapa → [id da foto, largura]. */
export function versoesReduzidas(data: PortfolioV4): Map<string, [string, number]> {
  const out = new Map<string, [string, number]>();
  for (const id of imagensEmGrade(data)) out.set(miniId(id), [id, LARGURA_MINIATURA]);
  for (const [id, largura] of largurasDosBlocos(data)) out.set(blocoVersaoId(id), [id, largura]);
  return out;
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

/**
 * Imagens que o site usa SÓ como capa de card (projeto e nota). Com a
 * miniatura pronta, a foto inteira delas não serve a ninguém — a página do
 * projeto não mostra a capa — e só pesa no arquivo (e no pacote do NDA, que
 * todo visitante baixa mesmo sem abrir). Galeria, sketches, quadros e blocos
 * seguem com a inteira: o visualizador ampliado a usa. A imagem de SEO fica
 * de fora da conta (vai como arquivo ao lado).
 */
export function soComoCapa(data: PortfolioV4): Set<string> {
  const capas = new Set<string>();
  for (const i of [...data.collections.projects, ...data.collections.blog]) if (i.thumb?.assetId) capas.add(i.thumb.assetId);
  // Bloco Imagem sem ampliar (sem visualizador): a versão do tamanho do bloco basta.
  for (const { bloco } of blocosImagem(data)) if (!bloco.content.zoom && bloco.content.image.assetId) capas.add(bloco.content.image.assetId);
  const sem = (i: { thumb?: ImageRef }): unknown => ({ ...i, thumb: undefined });
  const outros = new Set<string>();
  const visitar = (n: unknown): void => {
    if (Array.isArray(n)) n.forEach(visitar);
    else if (n && typeof n === 'object') {
      const r = n as Record<string, unknown>;
      // O bloco Imagem sem ampliar não conta como uso da foto inteira (os outros campos dele, sim).
      if (r['type'] === 'image' && r['content'] && typeof r['content'] === 'object' && !(r['content'] as { zoom?: boolean }).zoom) {
        const { type: _t, content, ...resto } = r;
        visitar(resto);
        visitar({ ...(content as object), image: undefined });
        return;
      }
      for (const [k, v] of Object.entries(r)) {
        if (k === 'seo') continue;
        if (k === 'assetId' && typeof v === 'string') outros.add(v);
        else visitar(v);
      }
    }
  };
  visitar({
    pages: data.pages,
    site: data.site,
    projects: data.collections.projects.map(sem),
    blog: data.collections.blog.map(sem),
    gallery: data.collections.gallery,
    sketches: data.collections.sketches,
  });
  for (const id of outros) capas.delete(id);
  return capas;
}

/**
 * Tira dos mapas a foto inteira das imagens que só servem de capa e já têm
 * miniatura nele (nunca solta a inteira sem a miniatura: sem ela, a capa
 * ficaria sem imagem).
 */
export function descartarCapasInteiras(data: PortfolioV4, mapas: Record<string, unknown>[], comMiniatura: (id: string) => boolean): void {
  for (const id of dispensaveis(data, comMiniatura)) for (const m of mapas) delete m[id];
}

/**
 * As fotos inteiras que podem sair: só usadas como capa e/ou em bloco Imagem
 * sem ampliar, e com a versão reduzida de CADA um desses usos pronta.
 */
export function dispensaveis(data: PortfolioV4, temVersao: (chave: string) => boolean): string[] {
  const capas = new Set<string>();
  for (const i of [...data.collections.projects, ...data.collections.blog]) if (i.thumb?.assetId) capas.add(i.thumb.assetId);
  const blocos = new Set<string>();
  for (const { bloco } of blocosImagem(data)) if (bloco.content.image.assetId) blocos.add(bloco.content.image.assetId);
  return [...soComoCapa(data)].filter((id) => (!capas.has(id) || temVersao(miniId(id))) && (!blocos.has(id) || temVersao(blocoVersaoId(id))));
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
  for (const [chave, [id, largura]] of versoesReduzidas(data)) {
    const original = assetMap[id];
    if (!original) continue;
    // A largura real vem do arquivo: a guardada nos dados pode ser antiga (imagem trocada, migração).
    const meta = data.assets[id];
    const real = dimensoesDaImagem(original);
    if (!valeMiniatura(meta && real ? { ...meta, w: real.w, h: real.h } : meta, largura)) continue;
    const mini = await gerar(original, largura).catch(() => null);
    if (mini && mini.length <= original.length * 0.7) out[chave] = mini;
  }
  return out;
}

/**
 * Bytes estimados das miniaturas (para o peso mostrado antes de baixar): a
 * foto encolhe na área — (960 / largura)² do tamanho original.
 */
export function pesoEstimadoDasMiniaturas(data: PortfolioV4, tamanhoDe: (id: string) => number): number {
  let total = 0;
  for (const [id, largura] of versoesReduzidas(data).values()) {
    const meta = data.assets[id];
    if (!valeMiniatura(meta, largura)) continue;
    total += Math.round(tamanhoDe(id) * (largura / meta!.w) ** 2);
  }
  return total;
}
