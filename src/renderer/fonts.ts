import type { Theme } from '../schema/v4';

/** Fontes que o shell já carrega (não precisam de <link> extra). */
const BUILT_IN = new Set(['DM Serif Display', 'DM Sans', 'DM Mono']);

/**
 * URLs do Google Fonts para as fontes do tema que não vêm de fábrica.
 * Uma URL por família: se uma não existir no Google Fonts, só ela falha
 * (o navegador cai no fallback) e as outras continuam carregando.
 */
export function themeFontUrls(fonts: Theme['fonts']): string[] {
  const names = [...new Set([fonts.display, fonts.body, fonts.mono].map((f) => f.trim()).filter(Boolean))];
  return names
    .filter((n) => !BUILT_IN.has(n) && /^[\w\s-]+$/.test(n))
    .flatMap((n) => {
      const fam = encodeURIComponent(n).replace(/%20/g, '+');
      // Regular sempre existe; o negrito vem numa URL própria (famílias sem negrito só perdem essa).
      return [`https://fonts.googleapis.com/css2?family=${fam}&display=swap`, `https://fonts.googleapis.com/css2?family=${fam}:wght@700&display=swap`];
    });
}
