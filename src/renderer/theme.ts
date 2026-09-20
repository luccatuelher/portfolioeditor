import type { Theme } from '../schema/v4';

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
    '--rule': c.rule,
    '--accent': c.accent,
    '--accent2': c.accent2,
    '--font-display': `'${theme.fonts.display}', Georgia, serif`,
    '--font-body': `'${theme.fonts.body}', Helvetica, sans-serif`,
    '--font-mono': `'${theme.fonts.mono}', 'Courier New', monospace`,
    '--type-base': `${theme.type.base}px`,
    '--type-ratio': String(theme.type.ratio),
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
