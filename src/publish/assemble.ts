import type { PublishPayload } from './buildPayload';
import { prerenderHome } from './prerender';
import { themeFontUrls } from '../renderer/fonts';

const jsonSafe = (o: unknown): string => JSON.stringify(o).replace(/</g, '\\u003c');
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Injeta os dados públicos + NDA cifrado + meta/OG no shell (site.html buildado),
 * produzindo o site final self-contained. Usado tanto pelo CLI (`publish`) quanto
 * pelo botão "Baixar site" do editor.
 */
export function assembleSiteHtml(shell: string, payload: PublishPayload): string {
  const dataScript =
    `<script>window.__PORTFOLIO_DATA__=${jsonSafe(payload.publicData)};` +
    `window.__ASSETS__=${jsonSafe(payload.assetMap)};` +
    (payload.ndaBlob ? `window.__NDA__=${jsonSafe(payload.ndaBlob)};` : '') +
    `</script>`;

  const name = payload.publicData.site.name.pt || payload.publicData.site.name.en || 'Portfolio';
  const homePage = payload.publicData.pages.find((p) => p.id === 'home');
  const homeDesc = homePage?.seo?.description;
  const role = homeDesc?.pt || homeDesc?.en || payload.publicData.site.role.pt || payload.publicData.site.role.en || '';
  const homeImg = homePage?.seo?.image;
  const homeImgUrl = homeImg ? (homeImg.assetId ? payload.assetMap[homeImg.assetId] ?? '' : homeImg.url ?? '') : '';
  const firstImg = homeImgUrl || Object.values(payload.assetMap)[0] || '';
  // Snippet de analytics: é código do próprio dono do site, então entra cru —
  // só barramos o que fecharia o <head> ou escaparia do que ele colou.
  const analytics = (payload.publicData.site.analytics ?? '').trim();
  const analyticsTag = analytics && !/<\/head|<\/html/i.test(analytics) ? analytics : '';
  const fav = payload.publicData.site.favicon;
  const favicon = fav ? (fav.assetId ? payload.assetMap[fav.assetId] ?? '' : fav.url ?? '') : '';
  const meta =
    `<meta name="description" content="${esc(role)}">` +
    // Pinta a barra do navegador no celular com a cor de fundo do site.
    `<meta name="theme-color" content="${esc(payload.publicData.theme.colors.bg)}">` +
    `<meta property="og:title" content="${esc(name)}">` +
    `<meta property="og:description" content="${esc(role)}">` +
    `<meta property="og:type" content="website">` +
    (firstImg ? `<meta property="og:image" content="${esc(firstImg)}">` : '') +
    (favicon ? `<link rel="icon" href="${esc(favicon)}"><link rel="apple-touch-icon" href="${esc(favicon)}">` : '') +
    themeFontUrls(payload.publicData.theme.fonts).map((u) => `<link rel="stylesheet" href="${esc(u)}">`).join('') +
    analyticsTag;

  // Substituições SEMPRE por função: com string, "$&", "$'" etc. dentro dos dados
  // do usuário seriam interpretados pelo replace e corromperiam o JS do site.
  let html = shell.replace('<!--PORTFOLIO_META-->', () => meta).replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(name)}</title>`);
  html = html.includes('<!--PORTFOLIO_DATA-->') ? html.replace('<!--PORTFOLIO_DATA-->', () => dataScript) : html.replace(/<script/, () => `${dataScript}<script`);
  // Home pré-renderizada: nunca uma página branca, mesmo sem JavaScript.
  const home = prerenderHome(payload.publicData);
  if (home) html = html.replace('<div id="root"></div>', () => `<div id="root">${home}</div>`);
  return html;
}
