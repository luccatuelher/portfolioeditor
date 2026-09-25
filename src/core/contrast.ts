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

/** Mistura duas cores #rrggbb: t = 0 é `a`, t = 1 é `b`. */
function misturar(a: [number, number, number], b: [number, number, number], t: number): string {
  return `#${a.map((v, i) => Math.round(v + (b[i]! - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * A mesma cor, só o necessário mais perto de `rumo` (a tinta do tema) para o
 * texto ter pelo menos `alvo`:1 contra o fundo. Já legível: volta igual.
 *
 * O tema padrão (e o portfólio antigo) usa um cinza claro (#A09C93, 2,4:1)
 * em legendas, datas e rótulos de 10–11 px — ilegível ao sol no celular. As
 * cores são escolha do dono do site: em vez de trocá-las, o site deriva a
 * versão legível para TEXTO e guarda a original para linhas e bordas.
 */
export function legivel(fg: string, bg: string, alvo = 4.5, rumo = '#000000'): string {
  const a = parseHex(fg);
  const b = parseHex(bg);
  if (!a || !b) return fg;
  if ((contrastRatio(fg, bg) ?? 0) >= alvo) return fg;
  // A tinta do tema também não chega lá (tema muito apagado): vai para preto ou branco.
  const alvoCor = (contrastRatio(rumo, bg) ?? 0) >= alvo ? parseHex(rumo)! : (luminance(bg) ?? 1) > 0.18 ? ([0, 0, 0] as [number, number, number]) : ([255, 255, 255] as [number, number, number]);
  // Menor mistura que atinge o alvo (a luminância anda num sentido só ao misturar).
  let [lo, hi] = [0, 1];
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2;
    if ((contrastRatio(misturar(a, alvoCor, t), bg) ?? 0) >= alvo) hi = t;
    else lo = t;
  }
  return misturar(a, alvoCor, hi);
}
