import { embedSource } from '../embed/embedSource';
import type { Block, ImageRef, PortfolioV4 } from '../schema/v4';
import { textosSemTraducao } from '../editor/pendencias';

export interface PreflightResult {
  errors: string[];
  warnings: string[];
}

export interface PreflightOptions {
  /** Bytes por assetId (para checar tamanho do export). */
  assetSizes?: Record<string, number>;
  /** Limite de export em MB antes de avisar (default 8). */
  maxExportMB?: number;
}

const hasImg = (r: ImageRef | undefined): boolean => !!r && (!!r.assetId || !!(r.url && r.url.trim()));
const emailValid = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** Endereço que aponta para um arquivo ao lado do site (cv.pdf, img/foto.jpg), e não para fora nem para dentro dele. */
const relativo = (href: string | undefined): string | null => {
  const h = (href ?? '').trim();
  if (!h || h === '#' || /^(https?:|mailto:|tel:|data:|#|\/\/)/i.test(h)) return null;
  return h.replace(/^\.\//, '');
};

/**
 * Arquivos que o site publicado espera encontrar AO LADO do index.html
 * (CV em PDF, imagem por caminho). O site é um arquivo só: sem subir esses
 * junto, o link baixa nada. Olha só o conteúdo que vai para o site.
 */
export function arquivosAoLado(data: PortfolioV4): string[] {
  const out = new Set<string>();
  const add = (h: string | undefined): void => {
    const r = relativo(h);
    if (r) out.add(r);
  };
  const walk = (b: Block): void => {
    if (b.visibility !== 'public') return;
    if (b.type === 'button') add(b.content.href);
    else if (b.type === 'contact') {
      add(b.content.cvHref);
      for (const s of b.content.socials) add(s.href);
    } else if (b.type === 'image') add(b.content.image.url);
  };
  for (const p of data.pages) for (const s of p.sections) s.blocks.forEach(walk);
  for (const coll of [data.collections.projects, data.collections.blog]) for (const it of coll) for (const s of it.sections) s.blocks.forEach(walk);
  return [...out];
}

/** Verificação de pré-publicação expandida (F7), pura e testável. */
export function runPreflight(data: PortfolioV4, opts: PreflightOptions = {}): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let missingAlt = 0;

  // Compartilhamento: o que aparece quando alguém manda o link no WhatsApp,
  // no LinkedIn ou no X. Imagem embutida (data:) nenhuma rede busca.
  const home = data.pages.find((pg) => pg.id === 'home');
  const socialImg = home?.seo?.image;
  // (O endereço do site é opcional: no GitHub Pages o site funciona sem ele,
  // e a imagem de compartilhamento já vai por URL completa. Não é aviso.)
  if (!socialImg) {
    warnings.push('Sem imagem de compartilhamento (inspector da Home › SEO): o link vai aparecer sem miniatura.');
  } else if (socialImg.assetId) {
    warnings.push('A imagem de compartilhamento está embutida no arquivo — WhatsApp, LinkedIn e X só buscam imagem por endereço http. Use uma URL pública no campo de imagem do SEO.');
  }

  const checkImg = (r: ImageRef): void => {
    if (hasImg(r) && !r.alt.pt.trim() && !r.alt.en.trim()) missingAlt++;
  };
  const walkBlock = (b: Block): void => {
    if (b.type === 'image') checkImg(b.content.image);
    else if (b.type === 'storyboard') b.content.frames.forEach(checkImg);
    else if (b.type === 'embed' && b.visibility === 'public' && b.content.ref && !embedSource({ type: b.content.provider, id: b.content.ref })) {
      errors.push(`Embed inválido em um bloco (${b.content.provider}).`);
    }
  };

  // Páginas públicas
  for (const p of data.pages.filter((x) => x.visibility !== 'nda')) {
    for (const s of p.sections) for (const b of s.blocks.filter((x) => x.visibility === 'public')) walkBlock(b);
  }

  // Projetos públicos
  for (const proj of data.collections.projects.filter((p) => p.visibility === 'public')) {
    const label = proj.title.pt || proj.title.en || proj.id;
    if (!proj.title.pt.trim() && !proj.title.en.trim()) errors.push(`Projeto sem título (${proj.id}).`);
    if (!hasImg(proj.thumb)) warnings.push(`${label}: capa ausente.`);
    const mediaBlocks = proj.sections.flatMap((s) => s.blocks).filter((b) => ['image', 'embed', 'storyboard'].includes(b.type));
    if (mediaBlocks.length === 0) warnings.push(`${label}: sem imagens nem embeds.`);
    for (const s of proj.sections) for (const b of s.blocks) walkBlock(b);
  }
  for (const b of data.collections.blog.filter((x) => x.visibility === 'public')) {
    for (const s of b.sections) for (const bl of s.blocks) walkBlock(bl);
  }
  for (const g of data.collections.gallery.filter((x) => x.visibility === 'public')) checkImg(g.image);
  for (const s of data.collections.sketches.filter((x) => x.visibility === 'public')) checkImg(s.image);

  // Links: bloco Contato (legado) e botões — em páginas, projetos e notas publicados.
  const allSections = [
    ...data.pages.flatMap((p) => p.sections),
    ...data.collections.projects.filter((x) => x.visibility === 'public').flatMap((x) => x.sections),
    ...data.collections.blog.filter((x) => x.visibility === 'public').flatMap((x) => x.sections),
  ];
  for (const s of allSections) {
    for (const b of s.blocks) {
      if (b.visibility !== 'public') continue;
      if (b.type === 'contact') {
        if (!emailValid(b.content.email)) warnings.push('Contato: e-mail ausente ou inválido.');
        for (const soc of b.content.socials) if (!soc.href || soc.href === '#') warnings.push(`Rede social "${soc.label || 'sem nome'}": link ausente (não aparece no site).`);
        // O site publicado é UM arquivo. Um caminho relativo (cv.pdf) só funciona
        // se você subir o arquivo junto, no mesmo lugar — senão o botão baixa nada.
        if (b.content.cvHref.trim() && !/^(https?:|mailto:|tel:)/i.test(b.content.cvHref.trim())) {
          warnings.push(`CV aponta para "${b.content.cvHref}": como o site é um arquivo só, suba o PDF no mesmo lugar ou use um endereço https completo.`);
        }
      } else if (b.type === 'button') {
        if (!b.content.href.trim() || b.content.href.trim() === '#') warnings.push(`Botão "${b.content.label.pt || b.content.label.en}": sem link.`);
        else if (!/^(https?:|mailto:|tel:|#)/i.test(b.content.href.trim())) {
          warnings.push(`Botão "${b.content.label.pt || b.content.label.en}" aponta para "${b.content.href}": arquivo relativo só funciona se for publicado junto do site.`);
        }
      }
    }
  }

  if (missingAlt > 0) warnings.push(`${missingAlt} imagem(ns) sem descrição (texto alternativo) — a lista, com atalho para cada uma, está no painel Dados › Descrição das imagens.`);
  const semTraducao = textosSemTraducao(data).length;
  if (semTraducao > 0) warnings.push(`${semTraducao} texto(s) só em um idioma — a lista, com atalho para traduzir cada um, está no painel Dados › Traduções.`);

  // Tamanho do export
  if (opts.assetSizes) {
    const totalBytes = Object.values(opts.assetSizes).reduce((a, b) => a + b, 0);
    const mb = totalBytes / (1024 * 1024);
    const limit = opts.maxExportMB ?? 8;
    if (mb > limit) warnings.push(`Export grande: ~${mb.toFixed(1)} MB (limite sugerido ${limit} MB).`);
  }

  return { errors, warnings };
}
