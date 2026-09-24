import type { PublishPayload } from './buildPayload';
import { prerenderHome, PREENCHER_IMAGENS } from './prerender';
import { themeFontUrls } from '../renderer/fonts';

const jsonSafe = (o: unknown): string => JSON.stringify(o).replace(/</g, '\\u003c');
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Injeta os dados públicos + NDA cifrado + meta/OG no shell (site.html buildado),
 * produzindo o site final self-contained. Usado tanto pelo CLI (`publish`) quanto
 * pelo botão "Baixar site" do editor.
 */
export function assembleSiteHtml(shell: string, payload: PublishPayload): string {
  // Ordem: dados e imagens → preencher as imagens da Home → NDA cifrado (que
  // pode ser grande e não precisa atrasar a primeira foto).
  const dataScript =
    `<script>window.__PORTFOLIO_DATA__=${jsonSafe(payload.publicData)};` +
    `window.__ASSETS__=${jsonSafe(payload.assetMap)};</script>` +
    PREENCHER_IMAGENS +
    (payload.ndaBlob ? `<script>window.__NDA__=${jsonSafe(payload.ndaBlob)};</script>` : '');

  const name = payload.publicData.site.name.pt || payload.publicData.site.name.en || 'Portfolio';
  const homePage = payload.publicData.pages.find((p) => p.id === 'home');
  const homeDesc = homePage?.seo?.description;
  const role = homeDesc?.pt || homeDesc?.en || payload.publicData.site.role.pt || payload.publicData.site.role.en || '';
  const homeImg = homePage?.seo?.image;
  // Endereço público do site: sem ele não há link canônico nem imagem de preview
  // (WhatsApp, LinkedIn e X só buscam imagem por http — data: eles ignoram).
  const siteUrl = (payload.publicData.site.url ?? '').trim().replace(/\/+$/, '');
  const absoluto = (u: string): string => (/^https?:\/\//i.test(u) ? u : siteUrl && u ? `${siteUrl}/${u.replace(/^\//, '')}` : '');
  // A imagem social só entra se der para buscá-la de fora. Uma embutida (data:)
  // não vira preview em rede nenhuma e ainda repetiria a foto inteira no <head>.
  const socialImg = homeImg && !homeImg.assetId && homeImg.url ? absoluto(homeImg.url) : '';
  // Snippet de analytics: é código do próprio dono do site, então entra cru —
  // só barramos o que fecharia o <head> ou escaparia do que ele colou.
  const analytics = (payload.publicData.site.analytics ?? '').trim();
  const analyticsTag = analytics && !/<\/head|<\/html/i.test(analytics) ? analytics : '';
  const fav = payload.publicData.site.favicon;
  const favicon = fav ? (fav.assetId ? payload.assetMap[fav.assetId] ?? '' : fav.url ?? '') : '';
  const socials = payload.publicData.pages
    .flatMap((p) => p.sections.flatMap((s) => s.blocks))
    .flatMap((b) => (b.type === 'contact' ? b.content.socials : []))
    .map((s) => s.href)
    .filter((h) => /^https?:\/\//i.test(h));

  // Dados estruturados: diz ao buscador que este site é o portfólio de UMA
  // pessoa, com nome, função e perfis — é o que alimenta o painel de resultado.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    jobTitle: payload.publicData.site.role.pt || payload.publicData.site.role.en || undefined,
    description: role || undefined,
    url: siteUrl || undefined,
    image: socialImg || undefined,
    sameAs: socials.length ? [...new Set(socials)] : undefined,
  };

  const meta =
    `<meta name="description" content="${esc(role)}">` +
    // Pinta a barra do navegador no celular com a cor de fundo do site.
    `<meta name="theme-color" content="${esc(payload.publicData.theme.colors.bg)}">` +
    `<meta property="og:title" content="${esc(name)}">` +
    `<meta property="og:description" content="${esc(role)}">` +
    `<meta property="og:type" content="website">` +
    `<meta property="og:site_name" content="${esc(name)}">` +
    `<meta property="og:locale" content="pt_BR"><meta property="og:locale:alternate" content="en_US">` +
    (siteUrl ? `<meta property="og:url" content="${esc(siteUrl)}"><link rel="canonical" href="${esc(siteUrl)}">` : '') +
    (socialImg ? `<meta property="og:image" content="${esc(socialImg)}">` : '') +
    // X/Twitter: sem esta linha o link vira só texto, sem cartão.
    `<meta name="twitter:card" content="${socialImg ? 'summary_large_image' : 'summary'}">` +
    `<meta name="twitter:title" content="${esc(name)}"><meta name="twitter:description" content="${esc(role)}">` +
    (socialImg ? `<meta name="twitter:image" content="${esc(socialImg)}">` : '') +
    // O JSON passa pelo mesmo escape do resto: um "</script>" dentro de um nome
    // fecharia o bloco cedo demais e quebraria a página.
    `<script type="application/ld+json">${jsonSafe(jsonLd)}</script>` +
    (favicon ? `<link rel="icon" href="${esc(favicon)}"><link rel="apple-touch-icon" href="${esc(favicon)}">` : '') +
    // Sem bloquear a pintura: entra como impressão e vira 'all' ao carregar.
    themeFontUrls(payload.publicData.theme.fonts)
      .map((u) => `<link rel="stylesheet" href="${esc(u)}" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="${esc(u)}"></noscript>`)
      .join('') +
    analyticsTag;

  // Substituições SEMPRE por função: com string, "$&", "$'" etc. dentro dos dados
  // do usuário seriam interpretados pelo replace e corromperiam o JS do site.
  let html = shell.replace('<!--PORTFOLIO_META-->', () => meta).replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(name)}</title>`);
  html = html.includes('<!--PORTFOLIO_DATA-->') ? html.replace('<!--PORTFOLIO_DATA-->', () => dataScript) : html.replace(/<script/, () => `${dataScript}<script`);
  // Home pré-renderizada: nunca uma página branca, mesmo sem JavaScript.
  const home = prerenderHome(payload.publicData);
  if (home) html = html.replace('<div id="root"></div>', () => `<div id="root">${home}</div>`);
  return runtimeNoFim(html);
}

/**
 * O Vite põe o runtime do site (centenas de KB de JavaScript embutido) no
 * <head>. Aí o navegador precisava baixar tudo isso antes de chegar à Home
 * pré-renderizada, e a primeira pintura esperava o JavaScript inteiro (~2 s
 * numa 4G lenta). No fim do <body>, o conteúdo aparece antes. Script de módulo
 * só roda depois que a página foi lida de qualquer jeito: a ordem não muda.
 */
export function runtimeNoFim(html: string): string {
  const fimHead = html.indexOf('</head>');
  const fimBody = html.lastIndexOf('</body>');
  if (fimHead < 0 || fimBody < fimHead) return html;
  const modulo = /<script type="module"[^>]*>[\s\S]*?<\/script>/g;
  const cabeca = html.slice(0, fimHead);
  const scripts = cabeca.match(modulo);
  if (!scripts) return html;
  return cabeca.replace(modulo, '') + html.slice(fimHead, fimBody) + scripts.join('') + html.slice(fimBody);
}
