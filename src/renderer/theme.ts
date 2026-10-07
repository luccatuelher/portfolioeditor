import type { Theme } from '../schema/v4';
import { legivel } from '../core/contrast';

/** 4,5:1 sobre as duas bases em que o texto aparece: o fundo e a superfície. */
function legivelNosDois(fg: string, bg: string, surface: string, rumo: string): string {
  return legivel(legivel(fg, bg, 4.5, rumo), surface, 4.5, rumo);
}

/**
 * Converte os tokens do tema v4 em variáveis CSS. É a ÚNICA ponte entre dados e
 * estilo: nenhum bloco referencia cor/fonte diretamente — tudo vem daqui.
 */
export function themeToCssVars(theme: Theme): Record<string, string> {
  const c = theme.colors;
  const vars: Record<string, string> = {
    '--bg': c.bg,
    '--surface': c.surface,
    '--ink': c.ink,
    '--ink-soft': c.inkSoft,
    '--ink-pale': c.inkPale,
    // Texto em cinza claro (legendas, datas, rótulos): a mesma cor, escurecida só
    // o necessário para 4,5:1 — sobre o fundo E sobre a superfície (cartões e
    // faixas, mais escuros). A original segue nas linhas e bordas.
    '--ink-pale-texto': legivelNosDois(c.inkPale, c.bg, c.surface, c.ink),
    '--rule': c.rule,
    '--accent': c.accent,
    // Destaque em TEXTO (etiquetas, links, erro da senha): legível sobre o fundo.
    // Botões, bordas e sublinhados seguem com a cor da marca.
    '--accent-texto': legivelNosDois(c.accent, c.bg, c.surface, c.ink),
    '--accent2': c.accent2,
    '--font-display': `'${theme.fonts.display}', Georgia, serif`,
    '--font-body': `'${theme.fonts.body}', Helvetica, sans-serif`,
    '--font-mono': `'${theme.fonts.mono}', 'Courier New', monospace`,
    // Tema › Tamanho do texto: todo texto do site acompanha (16 px = como veio).
    '--escala-texto': String(theme.type.base / 16),
    // Tema › Contraste entre tamanhos: os títulos crescem (ou encolhem) em
    // relação ao texto — 1,25 (terça maior) é o desenho original.
    '--escala-titulos': String(Math.round((theme.type.ratio / 1.25) ** 2 * 1000) / 1000),
    '--space-unit': `${theme.space.unit}px`,
    '--radius': `${theme.radius}px`,
    '--grid-cols': String(theme.grid.cols),
    '--grid-max': `${theme.grid.maxWidth}px`,
    '--grid-gutter': `${theme.grid.gutter}px`,
  };
  // Estilos de texto nomeados → variáveis (font/size/weight/tracking/case).
  for (const [name, s] of Object.entries(theme.textStyles)) {
    vars[`--ts-${name}-font`] = `var(--font-${s.font})`;
    vars[`--ts-${name}-size`] = `${s.size}rem`;
    vars[`--ts-${name}-weight`] = String(s.weight);
    vars[`--ts-${name}-tracking`] = `${s.tracking}em`;
    vars[`--ts-${name}-case`] = s.case === 'none' ? 'none' : s.case === 'upper' ? 'uppercase' : s.case === 'lower' ? 'lowercase' : 'capitalize';
  }
  return vars;
}

/** Serializa as variáveis para uma string de `style` (uso em SSR / <html>). */
export function cssVarsToString(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}
