import type { PortfolioV4 } from '../schema/v4';
import type { AssetResolver } from './context';

/**
 * Classes e variáveis do "quadro" do site: margem de respiro (safe area),
 * largura máxima e imagem de fundo (laterais ou atrás). Usado pelo site
 * publicado e pelo canvas do editor, para os dois ficarem iguais.
 */
export function siteFrame(data: PortfolioV4, resolveAsset: AssetResolver): { className: string; vars: Record<string, string | number | undefined> } {
  const layout = data.site.layout;
  const bd = data.site.backdrop;
  const src = bd ? resolveAsset(bd.image) : '';
  const cls = src && bd ? ` has-backdrop bd-${bd.mode}` : '';
  return {
    className: cls,
    vars: {
      '--safe': layout ? `${layout.margin}vw` : undefined,
      '--page-cap': layout ? `${layout.maxWidth}px` : undefined,
      '--backdrop': src ? `url("${src.replace(/"/g, '%22')}")` : undefined,
      '--bd-veil': bd ? `${Math.round(bd.veil * 100)}%` : undefined,
    },
  };
}
