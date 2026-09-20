/**
 * NDA real: os itens confidenciais são encriptados com AES-GCM, a chave
 * derivada da senha via PBKDF2 (WebCrypto). O `site.html` publicado carrega só
 * o blob cifrado; a descriptografia acontece no cliente ao informar a senha.
 * Funciona em Node 24 (webcrypto global) e no browser.
 */

export interface EncryptedNda {
  v: 1;
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64
  iterations: number;
  hash: 'SHA-256';
}

const DEFAULT_ITERATIONS = 210_000;

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

export async function encryptNda(payload: unknown, password: string, iterations = DEFAULT_ITERATIONS): Promise<EncryptedNda> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, iterations);
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(iv) }, key, bs(data));
  return { v: 1, salt: toB64(salt), iv: toB64(iv), ct: toB64(new Uint8Array(ctBuf)), iterations, hash: 'SHA-256' };
}

export async function decryptNda<T = unknown>(enc: EncryptedNda, password: string): Promise<T> {
  const key = await deriveKey(password, fromB64(enc.salt), enc.iterations);
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bs(fromB64(enc.iv)) }, key, bs(fromB64(enc.ct)));
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buf))) as T;
}
