import { renderToStaticMarkup } from 'react-dom/server';
import type { PortfolioV4 } from '../schema/v4';
import { Site } from '../renderer/Site';

/**
 * HTML estático da Home para ir dentro do #root do site publicado: o site
 * aparece mesmo onde o JavaScript não roda (visualizadores de arquivo, bloqueio
 * de scripts, buscadores). Quando o JS roda, o React substitui por inteiro.
 * Imagens embutidas (data URL) ficam de fora para não duplicar o peso do arquivo.
 */
export function prerenderHome(data: PortfolioV4): string {
  try {
    return renderToStaticMarkup(<Site data={data} initialLang="pt" resolveAsset={(ref) => (ref.assetId ? '' : ref.url ?? '')} />);
  } catch {
    return '';
  }
}
