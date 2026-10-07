/**
 * NDA real: os itens confidenciais são encriptados com AES-GCM, a chave
 * derivada da senha via PBKDF2 (WebCrypto). O `site.html` publicado carrega só
 * o blob cifrado; a descriptografia acontece no cliente ao informar a senha.
 * Funciona em Node 24 (webcrypto global) e no browser.
 */

export interface EncryptedNda {
  /** 1 = JSON cifrado; 2 = pacote binário (JSON + bytes das imagens), ver selarPacoteNda. */
  v: 1 | 2;
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64
  iterations: number;
  hash: 'SHA-256';
}

// 600.000: o mínimo atual recomendado pela OWASP para PBKDF2-HMAC-SHA256. O número
// vai gravado no pacote, então os já publicados (210.000) continuam abrindo.
const DEFAULT_ITERATIONS = 600_000;

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}
function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey('raw', bs(new TextEncoder().encode(password)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bs(salt), iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function cifrar(data: Uint8Array, password: string, iterations: number, v: EncryptedNda['v']): Promise<EncryptedNda> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(iv) }, key, bs(data));
  return { v, salt: toB64(salt), iv: toB64(iv), ct: toB64(new Uint8Array(ctBuf)), iterations, hash: 'SHA-256' };
}

async function decifrar(enc: EncryptedNda, password: string): Promise<Uint8Array> {
  const key = await deriveKey(password, fromB64(enc.salt), enc.iterations);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bs(fromB64(enc.iv)) }, key, bs(fromB64(enc.ct))));
}

/** Cifra um JSON qualquer (formato 1). */
export async function encryptNda(payload: unknown, password: string, iterations = DEFAULT_ITERATIONS): Promise<EncryptedNda> {
  return cifrar(new TextEncoder().encode(JSON.stringify(payload)), password, iterations, 1);
}

export async function decryptNda<T = unknown>(enc: EncryptedNda, password: string): Promise<T> {
  return JSON.parse(new TextDecoder().decode(await decifrar(enc, password))) as T;
}

// ------------------------------------------------------------ pacote do site

/** O que vai cifrado no site: os itens NDA e as imagens deles (id → data URL). */
export interface PacoteNda<T = unknown> {
  items: T;
  assets: Record<string, string>;
}

interface Cabecalho<T> {
  items: T;
  imagens: { id: string; mime: string; tam: number }[];
}

/** Bytes e tipo de um data URL (base64 ou texto, como o SVG). */
function bytesDoDataUrl(url: string): { mime: string; bytes: Uint8Array } | null {
  const virgula = url.indexOf(',');
  if (!url.startsWith('data:') || virgula < 0) return null;
  const cab = url.slice(5, virgula);
  const corpo = url.slice(virgula + 1);
  const base64 = /;base64$/i.test(cab);
  const mime = (cab.split(';')[0] || 'application/octet-stream').toLowerCase();
  try {
    return { mime, bytes: base64 ? fromB64(corpo.replace(/\s+/g, '')) : new TextEncoder().encode(decodeURIComponent(corpo)) };
  } catch {
    return null;
  }
}

/** Padrão para abrir: devolve data URL (o site passa um que cria blob: URL). */
export const paraDataUrl = (mime: string, bytes: Uint8Array): string => `data:${mime};base64,${toB64(bytes)}`;

/**
 * Cifra o pacote do site (formato 2). As imagens entram como BYTES, não como
 * data URL: o pacote cifrado inteiro já vira base64 para caber no HTML, e uma
 * imagem em base64 dentro dele passava pelo base64 duas vezes — ~1,78× o
 * arquivo original, contra ~1,33× de uma imagem pública. Com trabalho de
 * cliente sob NDA, era o pedaço que mais crescia o index.html.
 *
 * Por dentro: 4 bytes com o tamanho do cabeçalho, o cabeçalho (JSON: itens e a
 * lista de imagens com tipo e tamanho) e os bytes das imagens, em sequência.
 * Um data URL que não dá para ler segue como texto, no formato antigo.
 */
export async function selarPacoteNda<T>(pacote: PacoteNda<T>, password: string, iterations = DEFAULT_ITERATIONS): Promise<EncryptedNda> {
  const imagens: Cabecalho<T>['imagens'] = [];
  const partes: Uint8Array[] = [];
  const soltas: Record<string, string> = {};
  for (const [id, url] of Object.entries(pacote.assets)) {
    const b = bytesDoDataUrl(url);
    if (!b) {
      soltas[id] = url;
      continue;
    }
    imagens.push({ id, mime: b.mime, tam: b.bytes.length });
    partes.push(b.bytes);
  }
  const cabecalho = new TextEncoder().encode(JSON.stringify({ items: pacote.items, imagens, ...(Object.keys(soltas).length ? { soltas } : {}) }));
  const total = 4 + cabecalho.length + partes.reduce((s, p) => s + p.length, 0);
  const tudo = new Uint8Array(total);
  new DataView(tudo.buffer).setUint32(0, cabecalho.length);
  tudo.set(cabecalho, 4);
  let pos = 4 + cabecalho.length;
  for (const p of partes) {
    tudo.set(p, pos);
    pos += p.length;
  }
  return cifrar(tudo, password, iterations, 2);
}

/**
 * Abre o pacote do site, nos dois formatos. `url` decide como cada imagem
 * volta: data URL por padrão; o site usa blob: URL (sem recodificar base64).
 * Senha errada: rejeita.
 */
export async function abrirPacoteNda<T = unknown>(enc: EncryptedNda, password: string, url: (mime: string, bytes: Uint8Array) => string = paraDataUrl): Promise<PacoteNda<T>> {
  const tudo = await decifrar(enc, password);
  if (enc.v !== 2) return JSON.parse(new TextDecoder().decode(tudo)) as PacoteNda<T>;
  const n = new DataView(tudo.buffer, tudo.byteOffset).getUint32(0);
  const cab = JSON.parse(new TextDecoder().decode(tudo.subarray(4, 4 + n))) as Cabecalho<T> & { soltas?: Record<string, string> };
  const assets: Record<string, string> = { ...(cab.soltas ?? {}) };
  let pos = 4 + n;
  for (const img of cab.imagens) {
    assets[img.id] = url(img.mime, tudo.subarray(pos, pos + img.tam));
    pos += img.tam;
  }
  return { items: cab.items, assets };
}
