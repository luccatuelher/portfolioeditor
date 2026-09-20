/**
 * Gera o ícone da aba a partir de qualquer imagem: recorte quadrado central,
 * 128×128 PNG (nítido em telas de alta densidade, leve no arquivo).
 */
import { decodeImage } from './importImage';

export async function makeFavicon(file: Blob, size = 128): Promise<string> {
  const bmp = await decodeImage(file);
  const side = Math.min(bmp.width, bmp.height);
  const sx = (bmp.width - side) / 2;
  const sy = (bmp.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp as CanvasImageSource, sx, sy, side, side, 0, 0, size, size);
  bmp.close?.();
  return canvas.toDataURL('image/png');
}
