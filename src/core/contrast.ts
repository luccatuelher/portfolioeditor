/**
 * Contraste de cor (WCAG 2.1). Usado no painel de Tema para avisar quando um
 * token de cor deixa o texto difícil de ler — o site é uma vitrine e o usuário
 * escolhe as cores à mão.
 */

/** Aceita #rgb, #rrggbb (com ou sem #). Devolve null se não reconhecer. */
export function parseHex(hex: string): [number, number, number] | null {
  const s = hex.trim().replace(/^#/, '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/** Luminância relativa (WCAG): canais sRGB linearizados. */
export function luminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste entre duas cores: 1 (igual) a 21 (preto/branco). */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastLevel = 'AAA' | 'AA' | 'AA-large' | 'fail';

/**
 * Classifica a razão. `large` = texto grande (>= 24px ou 19px negrito), que a
 * WCAG deixa passar com 3:1.
 */
export function contrastLevel(ratio: number, large = false): ContrastLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return large ? 'AA' : 'AA-large';
  return 'fail';
}
