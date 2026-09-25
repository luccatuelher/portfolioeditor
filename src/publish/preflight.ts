import { embedSource } from '../embed/embedSource';
import { aberto, blocosQueVaoProSite, paginaVaiProSite, vaiProSite, type BlocoNoSite } from '../core/visibilidade';
import type { ImageRef, PortfolioV4 } from '../schema/v4';
import { imagensSemDescricao, textosSemTraducao } from '../editor/pendencias';
import { linksDoDocumento, problemaDoLink, type LinkNoDocumento } from '../core/links';

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
  for (const { bloco: b } of blocosQueVaoProSite(data)) {
    if (b.type === 'button') add(b.content.href);
    else if (b.type === 'contact') {
      add(b.content.cvHref);
      for (const s of b.content.socials) add(s.href);
    } else if (b.type === 'image') add(b.content.image.url);
  }
  return [...out];
}

/** "no projeto “A Travessia” (NDA)", "na página Sobre": onde está o bloco do aviso. */
function ondeEsta({ dono, nda }: BlocoNoSite): string {
  const nome = 'page' in dono ? `página ${dono.page.title.pt || dono.page.title.en || dono.page.slug}` : `${dono.coll === 'projects' ? 'projeto' : 'nota'} “${dono.item.title.pt || dono.item.title.en || dono.item.id}”`;
  return `${nome}${nda ? ' (NDA)' : ''}`;
}

/** Verificação de pré-publicação expandida (F7), pura e testável. */
export function runPreflight(data: PortfolioV4, opts: PreflightOptions = {}): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  // Mesma lista do painel Dados › Descrição das imagens (sai de camposTexto).
  const missingAlt = imagensSemDescricao(data).length;

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

  // Tudo o que vai para o site: páginas, projetos e notas — o NDA também, que
  // aparece depois da senha. Quem chama passa o que vai de fato (sem senha, o
  // NDA fica de fora da publicação e dos avisos).
  const noSite = blocosQueVaoProSite(data);
  for (const nb of noSite) {
    const b = nb.bloco;
    if (b.type === 'embed' && b.content.ref && !embedSource({ type: b.content.provider, id: b.content.ref })) {
      errors.push(`Embed inválido (${b.content.provider}) — ${ondeEsta(nb)}.`);
    }
  }

  for (const proj of data.collections.projects.filter((p) => vaiProSite(p.visibility))) {
    const label = `${proj.title.pt || proj.title.en || proj.id}${aberto(proj.visibility) ? '' : ' (NDA)'}`;
    if (!proj.title.pt.trim() && !proj.title.en.trim()) errors.push(`Projeto sem título (${proj.id}).`);
    if (!hasImg(proj.thumb)) warnings.push(`${label}: capa ausente.`);
    const mediaBlocks = proj.sections.flatMap((s) => s.blocks).filter((b) => vaiProSite(b.visibility) && ['image', 'embed', 'storyboard'].includes(b.type));
    if (mediaBlocks.length === 0) warnings.push(`${label}: sem imagens nem embeds.`);
  }

  // Links: bloco Contato (legado) e botões.
  for (const nb of noSite) {
    const b = nb.bloco;
    // Só o NDA diz onde está: é o que ninguém ia imaginar que também é conferido.
    const noNda = nb.nda ? ` — ${ondeEsta(nb)}` : '';
    if (b.type === 'contact') {
      if (!emailValid(b.content.email)) warnings.push(`Contato: e-mail ausente ou inválido${noNda}.`);
      for (const soc of b.content.socials) if (!soc.href || soc.href === '#') warnings.push(`Rede social "${soc.label || 'sem nome'}": link ausente (não aparece no site)${noNda}.`);
      // O site publicado é UM arquivo. Um caminho relativo (cv.pdf) só funciona
      // se você subir o arquivo junto, no mesmo lugar — senão o botão baixa nada.
      if (b.content.cvHref.trim() && !/^(https?:|mailto:|tel:)/i.test(b.content.cvHref.trim())) {
        warnings.push(`CV aponta para "${b.content.cvHref}": como o site é um arquivo só, suba o PDF no mesmo lugar ou use um endereço https completo.`);
      }
    } else if (b.type === 'button') {
      if (!b.content.href.trim() || b.content.href.trim() === '#') warnings.push(`Botão "${b.content.label.pt || b.content.label.en}": sem link${noNda}.`);
      else if (!/^(https?:|mailto:|tel:|#)/i.test(b.content.href.trim())) {
        warnings.push(`Botão "${b.content.label.pt || b.content.label.en}" aponta para "${b.content.href}": arquivo relativo só funciona se for publicado junto do site.`);
      }
    }
  }

  // Links internos (botões, CV, links nos textos) do que vai para o site:
  // página excluída ou em rascunho não quebra o site, mas leva o visitante à Home.
  const linkPublicado = (l: LinkNoDocumento): boolean => {
    const c = l.container;
    const secs = c.on === 'page'
      ? data.pages.find((p) => p.id === c.pageId && paginaVaiProSite(p))?.sections
      : data.collections[c.collection].find((i) => i.id === c.itemId && vaiProSite(i.visibility))?.sections;
    return !!secs?.find((s) => s.id === l.sectionId)?.blocks.some((b) => b.id === l.blockId && vaiProSite(b.visibility));
  };
  for (const l of linksDoDocumento(data)) {
    const problema = linkPublicado(l) ? problemaDoLink(data, l.href) : null;
    if (problema) warnings.push(`${l.onde}: ${problema}.`);
  }

  if (missingAlt > 0) warnings.push(`${missingAlt} imagem(ns) sem descrição (texto alternativo) — a lista, com atalho para cada uma, está no painel Dados › Descrição das imagens.`);
  const semTraducao = textosSemTraducao(data).filter((t) => t.tipo === 'falta').length;
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
