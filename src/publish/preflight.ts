import type { I18n } from '../core/i18n';
import { embedSource } from '../embed/embedSource';
import type { Block, ImageRef, PortfolioV4 } from '../schema/v4';

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
const i18nIncomplete = (v: I18n): boolean => (!!v.pt.trim() && !v.en.trim()) || (!v.pt.trim() && !!v.en.trim());
const emailValid = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** Verificação de pré-publicação expandida (F7), pura e testável. */
export function runPreflight(data: PortfolioV4, opts: PreflightOptions = {}): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let missingAlt = 0;
  let incompleteI18n = 0;

  const checkI18n = (v: I18n): void => {
    if (i18nIncomplete(v)) incompleteI18n++;
  };
  const checkImg = (r: ImageRef): void => {
    if (hasImg(r) && !r.alt.pt.trim() && !r.alt.en.trim()) missingAlt++;
  };
  const walkBlock = (b: Block): void => {
    if (b.type === 'heading') checkI18n(b.content.text);
    else if (b.type === 'text') checkI18n(b.content.html);
    else if (b.type === 'image') checkImg(b.content.image);
    else if (b.type === 'storyboard') b.content.frames.forEach(checkImg);
    else if (b.type === 'embed' && b.visibility === 'public' && b.content.ref && !embedSource({ type: b.content.provider, id: b.content.ref })) {
      errors.push(`Embed inválido em um bloco (${b.content.provider}).`);
    }
  };

  // Site
  checkI18n(data.site.name);
  checkI18n(data.site.role);

  // Páginas públicas
  for (const p of data.pages.filter((x) => x.visibility !== 'nda')) {
    for (const s of p.sections) for (const b of s.blocks.filter((x) => x.visibility === 'public')) walkBlock(b);
  }

  // Projetos públicos
  for (const proj of data.collections.projects.filter((p) => p.visibility === 'public')) {
    const label = proj.title.pt || proj.title.en || proj.id;
    if (!proj.title.pt.trim() && !proj.title.en.trim()) errors.push(`Projeto sem título (${proj.id}).`);
    checkI18n(proj.title);
    checkI18n(proj.description);
    if (!hasImg(proj.thumb)) warnings.push(`${label}: capa ausente.`);
    const mediaBlocks = proj.sections.flatMap((s) => s.blocks).filter((b) => ['image', 'embed', 'storyboard'].includes(b.type));
    if (mediaBlocks.length === 0) warnings.push(`${label}: sem imagens nem embeds.`);
    for (const s of proj.sections) for (const b of s.blocks) walkBlock(b);
  }
  for (const b of data.collections.blog.filter((x) => x.visibility === 'public')) {
    checkI18n(b.title);
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
        for (const soc of b.content.socials) if (!soc.href || soc.href === '#') warnings.push(`Social "${soc.label}": link ausente.`);
      } else if (b.type === 'button') {
        if (!b.content.href.trim() || b.content.href.trim() === '#') warnings.push(`Botão "${b.content.label.pt || b.content.label.en}": sem link.`);
      }
    }
  }

  if (missingAlt > 0) warnings.push(`${missingAlt} imagem(ns) sem texto alternativo.`);
  if (incompleteI18n > 0) warnings.push(`${incompleteI18n} texto(s) com PT ou EN faltando.`);

  // Tamanho do export
  if (opts.assetSizes) {
    const totalBytes = Object.values(opts.assetSizes).reduce((a, b) => a + b, 0);
    const mb = totalBytes / (1024 * 1024);
    const limit = opts.maxExportMB ?? 8;
    if (mb > limit) warnings.push(`Export grande: ~${mb.toFixed(1)} MB (limite sugerido ${limit} MB).`);
  }

  return { errors, warnings };
}
