/**
 * Pipeline de importação de imagem: decodifica → redimensiona (lado máx.
 * configurável) → recodifica em WebP. (Não gera miniatura: o site e o editor
 * usam a imagem em si — codificar uma segunda cópia a cada envio era custo à toa.)
 * Exceções: SVG e GIF animado ficam como vieram, e uma imagem que já cabia e
 * é menor que a versão recodificada também.
 *
 * A matemática de redimensionamento (`computeTargetSize`) é pura e testável.
 * A parte de canvas depende do browser (`createImageBitmap`/`OffscreenCanvas`)
 * e é injetável para testes.
 */

export const DEFAULT_MAX_SIDE = 2400;
export const DEFAULT_QUALITY = 0.82;

export interface TargetSize {
  w: number;
  h: number;
  scale: number;
}

/** Redimensiona proporcionalmente para caber em `maxSide` (nunca amplia). */
export function computeTargetSize(w: number, h: number, maxSide: number): TargetSize {
  if (w <= 0 || h <= 0) return { w: 0, h: 0, scale: 1 };
  const longest = Math.max(w, h);
  const scale = longest > maxSide ? maxSide / longest : 1;
  return { w: Math.round(w * scale), h: Math.round(h * scale), scale };
}

export interface ImportedImage {
  blob: Blob;
  w: number;
  h: number;
  /** image/webp quando recodificada; o tipo original quando a imagem fica como veio. */
  mime: string;
  /** Algo que a pessoa precisa saber sobre o que aconteceu com a imagem. */
  aviso?: string;
}

/** Formatos que qualquer navegador exibe e que podem ficar como vieram. */
const WEB = /^image\/(jpeg|png|webp|gif|avif)$/;
/** Acima disso um GIF animado pesaria demais no arquivo único do site. */
export const MAX_GIF_BYTES = 4 * 1024 * 1024;

export interface ImportOptions {
  maxSide?: number;
  quality?: number;
}

interface CanvasEnv {
  createImageBitmap: (blob: Blob) => Promise<{ width: number; height: number; close?: () => void }>;
  makeCanvas: (w: number, h: number) => {
    getContext: (t: '2d') => { drawImage: (img: unknown, x: number, y: number, w: number, h: number) => void } | null;
    convertToBlob?: (opts: { type: string; quality: number }) => Promise<Blob>;
  };
}

function defaultEnv(): CanvasEnv {
  return {
    createImageBitmap: (blob) => decodeImage(blob),
    makeCanvas: (w, h) => {
      const canvas = new OffscreenCanvas(w, h);
      return {
        getContext: (t) => {
          const ctx = canvas.getContext(t);
          if (!ctx) return null;
          // Adapta a API DOM ao contrato injetável (único cast, localizado).
          return { drawImage: (img, x, y, dw, dh) => ctx.drawImage(img as CanvasImageSource, x, y, dw, dh) };
        },
        convertToBlob: (opts) => canvas.convertToBlob(opts),
      };
    },
  };
}

async function encode(
  env: CanvasEnv,
  bmp: { width: number; height: number },
  size: TargetSize,
  quality: number,
): Promise<Blob> {
  const canvas = env.makeCanvas(size.w, size.h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível.');
  ctx.drawImage(bmp, 0, 0, size.w, size.h);
  if (!canvas.convertToBlob) throw new Error('convertToBlob indisponível.');
  return canvas.convertToBlob({ type: 'image/webp', quality });
}

export async function importImage(
  source: Blob,
  options: ImportOptions = {},
  env: CanvasEnv = defaultEnv(),
): Promise<ImportedImage> {
  const maxSide = options.maxSide ?? DEFAULT_MAX_SIDE;
  const quality = options.quality ?? DEFAULT_QUALITY;

  const bmp = await env.createImageBitmap(source);
  const full = computeTargetSize(bmp.width, bmp.height, maxSide);
  const original = { blob: source, w: bmp.width, h: bmp.height, mime: source.type };
  // Vetor e animação não sobrevivem ao canvas: SVG fica vetorial (nítido em
  // qualquer tamanho e quase sempre menor), GIF continua animado.
  if (source.type === 'image/svg+xml' || (source.type === 'image/gif' && source.size <= MAX_GIF_BYTES)) {
    bmp.close?.();
    return original;
  }
  const blob = await encode(env, bmp, full, quality);
  bmp.close?.();
  // Já cabia e o original é menor: recodificar só aumentaria o peso (e somaria
  // mais uma perda de qualidade).
  if (full.scale === 1 && WEB.test(source.type) && source.type !== 'image/gif' && source.size <= blob.size) return original;
  const aviso = source.type === 'image/gif'
    ? `O GIF tinha ${(source.size / 1048576).toFixed(1).replace('.', ',')} MB e virou imagem parada (acima de 4 MB pesaria demais no site). Para animação longa, use um vídeo (YouTube ou Vimeo).`
    : undefined;
  return { blob, w: full.w, h: full.h, mime: 'image/webp', ...(aviso ? { aviso } : {}) };
}

/** Converte uma data: URL (usada pela migração) em Blob, para ingestão. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(5, comma); // após "data:"
  const isBase64 = /;base64/i.test(header);
  const mime = header.split(';')[0] || 'application/octet-stream';
  const payload = dataUrl.slice(comma + 1);
  if (isBase64) {
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(payload)], { type: mime });
}

/**
 * Decodifica qualquer imagem que o navegador saiba exibir. createImageBitmap é
 * o caminho rápido, mas não aceita SVG em alguns navegadores: aí usa <img>.
 */
export async function decodeImage(source: Blob): Promise<{ width: number; height: number; close?: () => void }> {
  try {
    return await createImageBitmap(source);
  } catch {
    const url = URL.createObjectURL(source);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      // SVG sem tamanho próprio: usa um tamanho de trabalho razoável.
      const w = img.naturalWidth || 1200;
      const h = img.naturalHeight || Math.round(w * 0.75);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')?.drawImage(img, 0, 0, w, h);
      return await createImageBitmap(c);
    } catch {
      throw new Error('Formato de imagem não suportado por este navegador (use JPG, PNG, WebP, GIF ou SVG).');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
