import type { HeaderConfig, PageLayout, Theme } from './v4';

/**
 * Valores padrão do schema v4, sem depender do zod. O runtime do site publicado
 * importa daqui: o schema completo (e a biblioteca de validação) fica só no editor.
 */
export const SCHEMA_VERSION = 4 as const;

export const DEFAULT_LAYOUT: PageLayout = { margin: 10, maxWidth: 2200 };

export const DEFAULT_HEADER: HeaderConfig = { order: ['brand', 'lang', 'nav'], layout: 'grid', spans: { brand: 6, lang: 6, nav: 12 }, align: { lang: 'end', nav: 'end' } };

/** Largura padrão de um elemento do cabeçalho quando não definida. */
export const headerSpan = (cfg: HeaderConfig, el: string): number => cfg.spans?.[el] ?? DEFAULT_HEADER.spans?.[el] ?? 12;

/** Tema padrão, portado dos tokens CSS `:root` do v3 (legacy/index.html l.13). */
export function defaultTheme(): Theme {
  return {
    colors: {
      bg: '#F2EFE8',
      surface: '#E8E4DB',
      ink: '#1C1B18',
      inkSoft: '#5A574F',
      inkPale: '#A09C93',
      rule: '#C8C4BB',
      accent: '#C1440E',
      accent2: '#2D5A8E',
    },
    fonts: { display: 'DM Serif Display', body: 'DM Sans', mono: 'DM Mono' },
    type: { base: 16, ratio: 1.25 },
    textStyles: {
      display: { font: 'display', size: 3.2, weight: 400, tracking: -0.02, case: 'none' },
      label: { font: 'mono', size: 0.68, weight: 500, tracking: 0.15, case: 'upper' },
      body: { font: 'body', size: 1, weight: 300, tracking: 0, case: 'none' },
    },
    space: { unit: 8 },
    radius: 2,
    grid: { cols: 12, maxWidth: 1100, gutter: 24 },
  };
}
