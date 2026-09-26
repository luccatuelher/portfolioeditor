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

export function prerenderHome(data: PortfolioV4, noMapa: ReadonlySet<string> = new Set()): string {
  // Em grade, marca a miniatura quando a publicação gerou uma (é ela que vem primeiro).
  const marcar = (id: string, uso?: 'miniatura'): string => MARCA + (uso === 'miniatura' && noMapa.has(miniId(id)) ? miniId(id) : id);
  try {
    const html = renderToStaticMarkup(<Site data={data} initialLang="pt" resolveAsset={(ref, uso) => (ref.assetId ? marcar(ref.assetId, uso) : ref.url ?? '')} />);
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
