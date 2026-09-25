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
 * pulo de layout) e o src chega depois, imagem por imagem (ver
 * scriptsDasImagens em assemble.ts): a foto aparece antes do runtime.
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
