/**
 * Classificação e parsing de fontes de imagem, portado de `validUrl(...,'image')`
 * do v3 (legacy/index.html l.1968). Puro, sem DOM.
 */

export const DATA_IMAGE_RE = /^data:image\/(png|jpeg|jpg|webp|gif|avif|svg\+xml)(;charset=[^;,]+)?(;base64)?,/i;

export type ImageSrcKind = 'data' | 'url' | 'empty';

export interface ClassifiedImage {
  kind: ImageSrcKind;
  /** src normalizado (string original quando válida, '' quando vazia). */
  src: string;
  /** mime quando `kind==='data'`. */
  mime?: string;
}

function hasControlOrQuotes(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x1f || c === 0x3c /* < */ || c === 0x3e /* > */ || c === 0x22 /* " */ || c === 0x27 /* ' */) return true;
  }
  return false;
}

export function classifyImageSrc(value: unknown): ClassifiedImage {
  const s = String(value ?? '').trim();
  if (!s) return { kind: 'empty', src: '' };

  const m = s.match(DATA_IMAGE_RE);
  if (m) {
    const sub = m[1]!.toLowerCase();
    const mime = sub === 'svg+xml' ? 'image/svg+xml' : `image/${sub === 'jpg' ? 'jpeg' : sub}`;
    return { kind: 'data', src: s, mime };
  }

  // Controle/aspas → inválido (tratado como vazio). Sem regex de faixa de
  // caracteres de controle: ela corrompe ao ser minificada/embutida no build.
  if (hasControlOrQuotes(s)) return { kind: 'empty', src: '' };

  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.username || u.password) return { kind: 'empty', src: '' };
      return { kind: 'url', src: u.href };
    } catch {
      return { kind: 'empty', src: '' };
    }
  }

  // Caminho relativo seguro (ex.: 'cv.pdf', 'assets/x.png').
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s) && !s.startsWith('//') && !s.startsWith('\\') && !s.includes('..')) {
    return { kind: 'url', src: s };
  }

  return { kind: 'empty', src: '' };
}
