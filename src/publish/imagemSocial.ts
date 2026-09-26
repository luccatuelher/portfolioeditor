import type { ImageRef, PortfolioV4 } from '../schema/v4';

/**
 * Imagem que aparece quando o link do site é colado no LinkedIn, WhatsApp, X…
 * As redes só buscam imagem por endereço http — uma embutida no index.html
 * (data:) elas ignoram. Escolhida no editor (Home › SEO), ela vai como ARQUIVO
 * ao lado do index.html, no tamanho do cartão, e o <head> aponta para ela pelo
 * endereço do site. Sem o endereço, não há como apontar: a conferência avisa.
 */
export const ARQUIVO_SOCIAL = 'compartilhar.jpg';

/** A imagem de compartilhamento da Home, se for uma imagem enviada no editor. */
export function imagemSocialEmbutida(data: PortfolioV4): ImageRef | undefined {
  const img = data.pages.find((p) => p.id === 'home')?.seo?.image;
  return img?.assetId ? img : undefined;
}
