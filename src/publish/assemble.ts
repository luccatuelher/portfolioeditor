import type { PublishPayload } from './buildPayload';
import { ESCOLHER_IDIOMA, prerenderHome, sufixarIds } from './prerender';
import { themeFontUrls } from '../renderer/fonts';

const jsonSafe = (o: unknown): string => JSON.stringify(o).replace(/</g, '\\u003c');
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Injeta os dados públicos + NDA cifrado + meta/OG no shell (site.html buildado),
 * produzindo o site final self-contained. Usado tanto pelo CLI (`publish`) quanto
 * pelo botão "Baixar site" do editor.
 */
export function assembleSiteHtml(shell: string, payload: PublishPayload): string {
  // Home pré-renderizada: nunca uma página branca, mesmo sem JavaScript.
  const noMapa = new Set(Object.keys(payload.assetMap));
  const homePt = prerenderHome(payload.publicData, noMapa, 'pt');
  const homeEn = prerenderHome(payload.publicData, noMapa, 'en');
  // Os dois idiomas; ESCOLHER_IDIOMA (no <head>) mostra um só, antes da pintura.
  const home = homePt && homeEn ? `<div data-prerender="pt">${homePt}</div><div data-prerender="en">${sufixarIds(homeEn, '-en')}</div>` : homePt;
  // Ordem do arquivo (o navegador roda cada <script> assim que o lê): dados →
  // imagens da Home, uma a uma → runtime (começa já, sem esperar o resto) →
  // as demais imagens, uma a uma → NDA cifrado (que pode ser grande).
  const imagens = scriptsDasImagens(payload.assetMap, home);
  const dataScript =
    `<script>window.__PORTFOLIO_DATA__=${jsonSafe(payload.publicData)};${payload.ndaBlob ? 'window.__TEM_NDA__=true;' : ''}</script>` +
    imagens.daHome +
    MARCA_RUNTIME +
    imagens.resto +
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
  let html = shell.replace('<!--PORTFOLIO_META-->', () => (home ? ESCOLHER_IDIOMA : '') + meta).replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(name)}</title>`);
  html = html.includes('<!--PORTFOLIO_DATA-->') ? html.replace('<!--PORTFOLIO_DATA-->', () => dataScript) : html.replace(/<script/, () => `${dataScript}<script`);
  if (home) html = html.replace('<div id="root"></div>', () => `<div id="root">${home}</div>`);
  return runtimeNoLugar(html);
}

/** Onde o runtime entra: depois das imagens da Home, antes das demais. */
const MARCA_RUNTIME = '<!--PORTFOLIO_RUNTIME-->';

/**
 * Cada imagem no próprio <script>, que o navegador roda assim que o lê: a foto
 * aparece quando os bytes DELA chegam, sem esperar as outras. Primeiro as da
 * Home, na ordem em que a página pré-renderizada as usa (a do topo antes); as
 * demais depois, na ordem dos dados. Antes o mapa era um bloco só: a primeira
 * foto da Home, e o runtime, esperavam todas as imagens do portfólio.
 *
 * `__IMG__` guarda a imagem no mapa (window.__ASSETS__), põe o src nas imagens
 * pré-renderizadas que a esperam e avisa o runtime ('portfolio-imagem'), que
 * então troca a reserva de espaço pela foto. Cada imagem vai uma vez só.
 */
export function scriptsDasImagens(assets: Record<string, string>, home: string): { daHome: string; resto: string } {
  const daHome = [...new Set([...home.matchAll(/ data-asset="([\w-]+)"/g)].map((m) => m[1]!))].filter((id) => Object.hasOwn(assets, id));
  const primeiro = new Set(daHome);
  const resto = Object.keys(assets).filter((id) => !primeiro.has(id));
  const preencher =
    "<script>window.__ASSETS__={};function __IMG__(i,u){__ASSETS__[i]=u;var l=document.querySelectorAll('img[data-asset=\"'+i+'\"]');for(var k=0;k<l.length;k++)l[k].src=u;dispatchEvent(new Event('portfolio-imagem'))}</script>";
  const uma = (id: string): string => `<script>__IMG__(${jsonSafe(id)},${jsonSafe(assets[id])})</script>`;
  return { daHome: preencher + daHome.map(uma).join(''), resto: resto.map(uma).join('') };
}

/**
 * O Vite põe o runtime do site (centenas de KB de JavaScript embutido) no
 * <head>: a Home pré-renderizada esperava o JavaScript inteiro para pintar.
 * Ele vai para a marca, depois das fotos da Home, e com `async`: um módulo
 * embutido sem `async` só roda quando o arquivo INTEIRO foi lido — e o arquivo
 * é quase todo imagem. Assim o site responde (menu, projetos, idioma, link
 * direto para um projeto) enquanto as demais imagens ainda chegam. Sem a marca
 * (shell antigo), vai para o fim do <body>, como antes.
 */
export function runtimeNoLugar(html: string): string {
  const fimHead = html.indexOf('</head>');
  const fimBody = html.lastIndexOf('</body>');
  const marca = html.indexOf(MARCA_RUNTIME, Math.max(fimHead, 0));
  const semMarca = (h: string): string => h.split(MARCA_RUNTIME).join('');
  if (fimHead < 0 || fimBody < fimHead) return semMarca(html);
  const modulo = /<script type="module"[^>]*>[\s\S]*?<\/script>/g;
  const cabeca = html.slice(0, fimHead);
  const scripts = cabeca.match(modulo);
  if (!scripts) return semMarca(html);
  const semRuntime = semMarca(cabeca.replace(modulo, ''));
  if (marca < 0 || marca > fimBody) return semRuntime + semMarca(html.slice(fimHead, fimBody)) + scripts.join('') + html.slice(fimBody);
  const cedo = scripts.map((s) => s.replace(/^<script type="module"/, '<script type="module" async'));
  return semRuntime + html.slice(fimHead, marca) + cedo.join('') + semMarca(html.slice(marca + MARCA_RUNTIME.length));
}
