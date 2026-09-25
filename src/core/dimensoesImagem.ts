import type { PortfolioV4 } from '../schema/v4';

/**
 * Tamanho natural de uma imagem lido do CABEÇALHO do arquivo, sem decodificar
 * a imagem: PNG, GIF, JPEG (com a rotação do EXIF), WebP, AVIF, BMP e SVG.
 * Puro e síncrono — roda igual na migração, no editor e na publicação (Node).
 *
 * Por que importa: sem largura e altura, o <img> do site não reserva espaço.
 * A página pula quando cada foto chega, e o carregamento preguiçoso perde o
 * efeito (toda imagem de altura zero "está na tela" e baixa de uma vez).
 */
export interface Dimensoes {
  w: number;
  h: number;
}

/** Quantos bytes decodificar de início: o cabeçalho de quase tudo cabe aqui. */
const INICIO = 64 * 1024;

export function dimensoesDaImagem(dataUrl: string): Dimensoes | null {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const virgula = dataUrl.indexOf(',');
  if (virgula < 0) return null;
  const cabecalho = dataUrl.slice(5, virgula).toLowerCase();
  const corpo = dataUrl.slice(virgula + 1);
  const base64 = cabecalho.endsWith(';base64');
  try {
    if (cabecalho.startsWith('image/svg')) return dimensoesDoSvg(base64 ? latin1(bytesBase64(corpo, Infinity)) : decodeURIComponent(corpo));
    if (!base64) return null;
    // O JPEG pode trazer um EXIF grande antes do tamanho: se não achou no começo, lê o arquivo todo.
    const d = dimensoesDosBytes(bytesBase64(corpo, INICIO));
    if (d || corpo.length <= (INICIO / 3) * 4) return d;
    return dimensoesDosBytes(bytesBase64(corpo, Infinity));
  } catch {
    return null;
  }
}

/** Decodifica os primeiros `max` bytes (aprox.) de um base64. */
function bytesBase64(b64: string, max: number): Uint8Array {
  const limpo = b64.replace(/\s+/g, '');
  const trecho = max === Infinity ? limpo : limpo.slice(0, Math.ceil(max / 3) * 4);
  const bin = atob(trecho);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function latin1(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  // Bytes UTF-8 lidos como Latin-1: bastam para achar números e nomes de atributo.
  return s;
}

const valido = (w: number, h: number): Dimensoes | null => (w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h) ? { w, h } : null);
const be16 = (b: Uint8Array, i: number): number => (b[i]! << 8) | b[i + 1]!;
const le16 = (b: Uint8Array, i: number): number => b[i]! | (b[i + 1]! << 8);
const be32 = (b: Uint8Array, i: number): number => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
const le32 = (b: Uint8Array, i: number): number => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
const ascii = (b: Uint8Array, i: number, n: number): string => String.fromCharCode(...b.subarray(i, i + n));

export function dimensoesDosBytes(b: Uint8Array): Dimensoes | null {
  if (b.length < 10) return null;
  // PNG: assinatura + bloco IHDR.
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && ascii(b, 12, 4) === 'IHDR') return valido(be32(b, 16), be32(b, 20));
  // GIF87a/GIF89a: tela lógica.
  if (ascii(b, 0, 3) === 'GIF') return valido(le16(b, 6), le16(b, 8));
  // BMP: altura negativa = de cima para baixo.
  if (ascii(b, 0, 2) === 'BM' && b.length >= 26) return valido(le32(b, 18), Math.abs(le32(b, 22) | 0));
  if (b[0] === 0xff && b[1] === 0xd8) return dimensoesDoJpeg(b);
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return dimensoesDoWebp(b);
  // AVIF/HEIF: caixa 'ispe' (largura e altura da imagem).
  if (ascii(b, 4, 4) === 'ftyp') {
    for (let i = 8; i + 16 <= Math.min(b.length, 8192); i++) {
      if (b[i] === 0x69 && ascii(b, i, 4) === 'ispe') return valido(be32(b, i + 8), be32(b, i + 12));
    }
  }
  return null;
}

function dimensoesDoWebp(b: Uint8Array): Dimensoes | null {
  const tipo = ascii(b, 12, 4);
  if (tipo === 'VP8 ' && b.length >= 30) return valido(le16(b, 26) & 0x3fff, le16(b, 28) & 0x3fff);
  if (tipo === 'VP8L' && b.length >= 25) {
    return valido(1 + (((b[22]! & 0x3f) << 8) | b[21]!), 1 + (((b[24]! & 0x0f) << 10) | (b[23]! << 2) | ((b[22]! & 0xc0) >> 6)));
  }
  if (tipo === 'VP8X' && b.length >= 30) {
    return valido(1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)));
  }
  return null;
}

/** Marcadores SOF (início de quadro) do JPEG — os que trazem o tamanho. */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function dimensoesDoJpeg(b: Uint8Array): Dimensoes | null {
  let girada = false;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1]!;
    if (m === 0xff) {
      i++; // byte de preenchimento
      continue;
    }
    // Marcadores sem comprimento.
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) {
      i += 2;
      continue;
    }
    if (m === 0xd9 || m === 0xda) return null; // fim/início dos dados sem ter visto o tamanho
    const len = be16(b, i + 2);
    if (m === 0xe1 && ascii(b, i + 4, 6) === 'Exif\0\0') girada = exifGirada(b, i + 10, i + 2 + len);
    if (SOF.has(m) && i + 9 <= b.length) {
      const h = be16(b, i + 5);
      const w = be16(b, i + 7);
      // Orientação 5–8: o navegador mostra a foto de lado trocado.
      return girada ? valido(h, w) : valido(w, h);
    }
    i += 2 + len;
  }
  return null;
}

/** Orientação EXIF 5–8 (90°/270°): largura e altura trocam na tela. */
function exifGirada(b: Uint8Array, tiff: number, fim: number): boolean {
  if (tiff + 8 > b.length) return false;
  const le = b[tiff] === 0x49; // 'II' = little-endian, 'MM' = big-endian
  const u16 = (i: number): number => (le ? le16(b, i) : be16(b, i));
  const u32 = (i: number): number => (le ? le32(b, i) : be32(b, i));
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > Math.min(fim, b.length)) return false;
  const n = u16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 10 > b.length) return false;
    if (u16(e) === 0x0112) {
      const o = u16(e + 8);
      return o >= 5 && o <= 8;
    }
  }
  return false;
}

/** SVG: width/height do <svg> raiz em px (ou sem unidade); senão, o viewBox. */
function dimensoesDoSvg(texto: string): Dimensoes | null {
  const tag = texto.match(/<svg\b[^>]*>/i)?.[0];
  if (!tag) return null;
  const attr = (nome: string): string | undefined => tag.match(new RegExp(`\\s${nome}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
  const px = (v: string | undefined): number | null => {
    const m = v?.trim().match(/^([\d.]+)(px)?$/i);
    return m ? parseFloat(m[1]!) : null;
  };
  const w = px(attr('width'));
  const h = px(attr('height'));
  if (w && h) return valido(Math.round(w), Math.round(h));
  const vb = attr('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (vb && vb.length === 4) {
    const [, , vw, vh] = vb as [number, number, number, number];
    // Só a largura (ou só a altura) informada: a outra segue a proporção do viewBox.
    if (w && vw > 0) return valido(Math.round(w), Math.round((w * vh) / vw));
    if (h && vh > 0) return valido(Math.round((h * vw) / vh), Math.round(h));
    return valido(Math.round(vw), Math.round(vh));
  }
  return null;
}

/**
 * Preenche o tamanho que falta (w ou h = 0) das imagens do documento, lendo o
 * arquivo de cada uma. Devolve o MESMO objeto quando não há nada a preencher
 * (quem compara por referência não vê mudança). Imagem sem arquivo ou de
 * formato que não dá para ler continua 0 × 0 — o site só não reserva espaço.
 */
export function completarDimensoes(doc: PortfolioV4, arquivos: Record<string, string> | ReadonlyMap<string, string>): PortfolioV4 {
  const arquivo = (id: string): string | undefined => (arquivos instanceof Map ? arquivos.get(id) : (arquivos as Record<string, string>)[id]);
  let assets: PortfolioV4['assets'] | null = null;
  for (const [id, meta] of Object.entries(doc.assets)) {
    if (meta.w > 0 && meta.h > 0) continue;
    const url = arquivo(id);
    const d = url ? dimensoesDaImagem(url) : null;
    if (!d) continue;
    assets ??= { ...doc.assets };
    assets[id] = { ...meta, w: d.w, h: d.h };
  }
  return assets ? { ...doc, assets } : doc;
}
