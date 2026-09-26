import { renderToStaticMarkup } from 'react-dom/server';
import type { PortfolioV4 } from '../schema/v4';
import { Site } from '../renderer/Site';
import { miniId } from '../core/miniaturas';

/**
 * HTML estático da Home para ir dentro do #root do site publicado: o site
 * aparece mesmo onde o JavaScript não roda (visualizadores de arquivo, bloqueio
 * de scripts, buscadores). Quando o JS roda, o React substitui por inteiro.
 *
 * Imagens embutidas (data URL) não são repetidas aqui — dobraria o peso do
 * arquivo. Cada uma sai como <img data-asset="id"> (com largura e altura, sem
 * pulo de layout) e o src chega depois, imagem por imagem (ver
 * scriptsDasImagens em assemble.ts): a foto aparece antes do runtime.
 */
const MARCA = 'prerender-asset:';

/**
 * A Home vai pré-renderizada nos DOIS idiomas; um script no <head> escolhe qual
 * aparece antes de qualquer pintura — a mesma regra do runtime
 * (initialVisitorLang: a escolha salva, senão o idioma do navegador). Antes
 * ia só em português: quem visita em inglês lia português até o runtime
 * chegar e trocar tudo (segundos, numa rede lenta). Sem JavaScript, português.
 */
export const ESCOLHER_IDIOMA =
  `<script>try{var s=localStorage.getItem('portfolio-lang'),l=s==='pt'||s==='en'?s:((navigator.language||'').toLowerCase().indexOf('pt')===0?'pt':'en');document.documentElement.setAttribute('data-idioma',l);if(l==='en')document.documentElement.lang='en'}catch(e){}</script>` +
  `<style>html[data-idioma="en"] [data-prerender="pt"],html:not([data-idioma="en"]) [data-prerender="en"]{display:none}</style>`;

/**
 * As duas versões da Home convivem no mesmo documento: os ids da segunda
 * ganham um sufixo (e as referências a eles também — link de pular o menu,
 * clipPath da bandeira), para nenhum id repetir.
 */
export function sufixarIds(html: string, sufixo: string): string {
  const ids = [...new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!))];
  let out = html;
  for (const id of ids) {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(` id="${esc}"`, 'g'), ` id="${id}${sufixo}"`)
      .replace(new RegExp(`"#${esc}"`, 'g'), `"#${id}${sufixo}"`)
      .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${id}${sufixo})`)
      .replace(new RegExp(` (aria-controls|aria-labelledby|aria-describedby|for)="${esc}"`, 'g'), ` $1="${id}${sufixo}"`);
  }
  return out;
}

export function prerenderHome(data: PortfolioV4, noMapa: ReadonlySet<string> = new Set(), lang: 'pt' | 'en' = 'pt'): string {
  // Em grade, marca a miniatura quando a publicação gerou uma (é ela que vem primeiro).
  const marcar = (id: string, uso?: 'miniatura'): string => MARCA + (uso === 'miniatura' && noMapa.has(miniId(id)) ? miniId(id) : id);
  try {
    const html = renderToStaticMarkup(<Site data={data} initialLang={lang} resolveAsset={(ref, uso) => (ref.assetId ? marcar(ref.assetId, uso) : ref.url ?? '')} />);
    return html
      // O React põe um <link rel="preload" as="image"> para a imagem prioritária;
      // com o marcador, seria um pedido a um endereço que não existe.
      .replace(/<link\b[^>]*prerender-asset:[^>]*>/g, '')
      .replace(/ src="prerender-asset:([\w-]+)"/g, ' data-asset="$1"')
      // Fundo do site (variável CSS): fica sem imagem até o runtime chegar.
      .replace(/url\(&quot;prerender-asset:[\w-]+&quot;\)/g, 'none')
      .split(MARCA).join('');
  } catch {
    return '';
  }
}
