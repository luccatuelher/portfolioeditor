import { describe, expect, it } from 'vitest';
import { computeTargetSize, dataUrlToBlob, importImage } from '../src/assets/importImage';

describe('computeTargetSize', () => {
  it('reduz para caber no lado máximo, mantendo proporção', () => {
    expect(computeTargetSize(4000, 2000, 2400)).toEqual({ w: 2400, h: 1200, scale: 0.6 });
  });
  it('nunca amplia imagens menores', () => {
    expect(computeTargetSize(800, 600, 2400)).toEqual({ w: 800, h: 600, scale: 1 });
  });
  it('lida com dimensões degeneradas', () => {
    expect(computeTargetSize(0, 0, 2400)).toEqual({ w: 0, h: 0, scale: 1 });
  });
});

describe('dataUrlToBlob', () => {
  it('decodifica data URL base64 em Blob do mime certo', () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const blob = dataUrlToBlob(png);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('importImage (canvas injetado)', () => {
  it('redimensiona e recodifica em WebP, uma vez só (sem miniatura)', async () => {
    let codificacoes = 0;
    const env = {
      createImageBitmap: async () => ({ width: 4000, height: 2000, close() {} }),
      makeCanvas: (w: number, h: number) => ({
        getContext: () => ({ drawImage() {} }),
        convertToBlob: async (opts: { type: string; quality: number }) => {
          codificacoes++;
          return new Blob([new Uint8Array(Math.max(1, Math.round(w * h / 1000)))], { type: opts.type });
        },
      }),
    };
    const r = await importImage(new Blob(['x']), { maxSide: 2400 }, env);
    expect(r.mime).toBe('image/webp');
    expect(r.w).toBe(2400);
    expect(r.h).toBe(1200);
    expect(r.blob.type).toBe('image/webp');
    expect(codificacoes).toBe(1);
  });
});

describe('importImage: o que fica como veio', () => {
  // Canvas simulado: a recodificação sai com `bytes` bytes.
  const env = (w: number, h: number, bytes: number) => ({
    createImageBitmap: async () => ({ width: w, height: h, close() {} }),
    makeCanvas: () => ({
      getContext: () => ({ drawImage() {} }),
      convertToBlob: async (opts: { type: string; quality: number }) => new Blob([new Uint8Array(bytes)], { type: opts.type }),
    }),
  });
  const arquivo = (bytes: number, type: string) => new Blob([new Uint8Array(bytes)], { type });

  it('SVG continua vetorial', async () => {
    const svg = arquivo(300, 'image/svg+xml');
    const r = await importImage(svg, {}, env(400, 300, 5000));
    expect(r.blob).toBe(svg);
    expect(r.mime).toBe('image/svg+xml');
  });

  it('GIF continua animado; acima de 4 MB vira imagem parada, com aviso', async () => {
    const gif = arquivo(200_000, 'image/gif');
    expect((await importImage(gif, {}, env(600, 400, 50_000))).blob).toBe(gif);
    const gigante = arquivo(5 * 1024 * 1024, 'image/gif');
    const r = await importImage(gigante, {}, env(600, 400, 50_000));
    expect(r.mime).toBe('image/webp');
    expect(r.aviso).toMatch(/imagem parada/);
  });

  it('já cabia e o original é menor: fica o original; senão, WebP', async () => {
    const pequeno = arquivo(4_000, 'image/jpeg');
    expect((await importImage(pequeno, {}, env(800, 600, 9_000))).blob).toBe(pequeno);
    const pesado = arquivo(90_000, 'image/png');
    const r = await importImage(pesado, {}, env(800, 600, 30_000));
    expect(r.mime).toBe('image/webp');
    expect(r.blob.size).toBe(30_000);
  });

  it('grande demais é sempre reduzida, mesmo que o original seja pequeno em bytes', async () => {
    const r = await importImage(arquivo(10_000, 'image/jpeg'), { maxSide: 2400 }, env(5000, 3000, 80_000));
    expect(r.mime).toBe('image/webp');
    expect(r.w).toBe(2400);
  });
});
