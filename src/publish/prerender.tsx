import { renderToStaticMarkup } from 'react-dom/server';
import type { PortfolioV4 } from '../schema/v4';
import { Site } from '../renderer/Site';

/**
 * HTML estático da Home para ir dentro do #root do site publicado: o site
 * aparece mesmo onde o JavaScript não roda (visualizadores de arquivo, bloqueio
 * de scripts, buscadores). Quando o JS roda, o React substitui por inteiro.
 *
 * Imagens embutidas (data URL) não são repetidas aqui — dobraria o peso do
 * arquivo. Cada uma sai como <img data-asset="id"> (com largura e altura, sem
 * pulo de layout) e o PREENCHER_IMAGENS, logo depois do mapa de imagens, põe o
 * src assim que o mapa chega: a foto aparece sem esperar o runtime inteiro.
 */
const MARCA = 'prerender-asset:';

export function prerenderHome(data: PortfolioV4): string {
  try {
    const html = renderToStaticMarkup(<Site data={data} initialLang="pt" resolveAsset={(ref) => (ref.assetId ? MARCA + ref.assetId : ref.url ?? '')} />);
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

/** Põe o src nas imagens pré-renderizadas assim que o mapa de imagens foi lido. */
export const PREENCHER_IMAGENS =
  "<script>(function(){var a=window.__ASSETS__||{},l=document.querySelectorAll('img[data-asset]');for(var i=0;i<l.length;i++){var u=a[l[i].getAttribute('data-asset')];if(u)l[i].src=u;}})();</script>";
