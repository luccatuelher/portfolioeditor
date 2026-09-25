import { describe, expect, it } from 'vitest';
import { completarDimensoes, dimensoesDaImagem } from '../src/core/dimensoesImagem';
import { migrate } from '../src/migrate/migrate';
import { buildPublishPayload } from '../src/publish/buildPayload';
import { decryptNda } from '../src/publish/nda';
import { mergeNda, type NdaBundle } from '../src/publish/publicSnapshot';
import type { PortfolioV4 } from '../src/schema/v4';
import { loadFixture } from './helpers/fixtures';

/**
 * Tamanho das imagens lido do cabeçalho do arquivo. Sem ele, o <img> do site
 * sai sem width/height: a página pula quando cada foto chega. Os arquivos
 * abaixo são montados byte a byte (só o cabeçalho que importa).
 */
const url = (mime: string, bytes: number[] | Uint8Array): string => `data:${mime};base64,${Buffer.from(Uint8Array.from(bytes)).toString('base64')}`;
const be16 = (n: number): number[] => [(n >> 8) & 255, n & 255];
const be32 = (n: number): number[] => [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
const le16 = (n: number): number[] => [n & 255, (n >> 8) & 255];
const le32 = (n: number): number[] => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

function png(w: number, h: number): string {
  return url('image/png', [0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, ...be32(13), ...ascii('IHDR'), ...be32(w), ...be32(h), 8, 6, 0, 0, 0]);
}

/** JPEG: SOI, (EXIF com orientação), (enchimento), SOF0, EOI. */
function jpeg(w: number, h: number, opts: { orientacao?: number; enchimento?: number; progressivo?: boolean } = {}): string {
  const partes: number[] = [0xff, 0xd8];
  partes.push(0xff, 0xe0, ...be16(16), ...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0);
  if (opts.orientacao !== undefined) {
    // TIFF big-endian ('MM'), IFD0 com 1 entrada: 0x0112 (Orientation), SHORT, 1, valor.
    const tiff = [...ascii('MM'), 0, 42, ...be32(8), ...be16(1), ...be16(0x0112), ...be16(3), ...be32(1), ...be16(opts.orientacao), 0, 0, ...be32(0)];
    const app1 = [...ascii('Exif'), 0, 0, ...tiff];
    partes.push(0xff, 0xe1, ...be16(app1.length + 2), ...app1);
  }
  let resta = opts.enchimento ?? 0;
  while (resta > 0) {
    const n = Math.min(resta, 65000);
    partes.push(0xff, 0xe2, ...be16(n + 2), ...new Array<number>(n).fill(0x41));
    resta -= n;
  }
  partes.push(0xff, opts.progressivo ? 0xc2 : 0xc0, ...be16(17), 8, ...be16(h), ...be16(w), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1);
  partes.push(0xff, 0xd9);
  return url('image/jpeg', partes);
}

const svg = (tag: string, corpo = '<rect width="5" height="5"/>'): string => `data:image/svg+xml;base64,${Buffer.from(`<?xml version="1.0"?>${tag}${corpo}</svg>`).toString('base64')}`;

describe('dimensoesDaImagem — lê o tamanho do cabeçalho', () => {
  it('PNG', () => {
    expect(dimensoesDaImagem(png(1600, 900))).toEqual({ w: 1600, h: 900 });
    expect(dimensoesDaImagem(png(70000, 3))).toEqual({ w: 70000, h: 3 });
  });

  it('GIF e BMP (inclusive BMP de cima para baixo)', () => {
    expect(dimensoesDaImagem(url('image/gif', [...ascii('GIF89a'), ...le16(320), ...le16(240), 0, 0, 0]))).toEqual({ w: 320, h: 240 });
    const bmp = (h: number): string => url('image/bmp', [...ascii('BM'), ...new Array<number>(16).fill(0), ...le32(640), ...le32(h), 0, 0]);
    expect(dimensoesDaImagem(bmp(480))).toEqual({ w: 640, h: 480 });
    expect(dimensoesDaImagem(bmp(-480 >>> 0))).toEqual({ w: 640, h: 480 });
  });

  it('JPEG normal, progressivo e com EXIF grande antes do tamanho', () => {
    expect(dimensoesDaImagem(jpeg(4032, 3024))).toEqual({ w: 4032, h: 3024 });
    expect(dimensoesDaImagem(jpeg(800, 600, { progressivo: true }))).toEqual({ w: 800, h: 600 });
    // O tamanho só aparece depois de 150 KB de metadados: além do trecho lido de início.
    expect(dimensoesDaImagem(jpeg(1200, 800, { enchimento: 150_000 }))).toEqual({ w: 1200, h: 800 });
  });

  it('JPEG girado pelo EXIF (orientação 5–8) troca largura e altura, como o navegador mostra', () => {
    expect(dimensoesDaImagem(jpeg(4032, 3024, { orientacao: 6 }))).toEqual({ w: 3024, h: 4032 });
    expect(dimensoesDaImagem(jpeg(4032, 3024, { orientacao: 8 }))).toEqual({ w: 3024, h: 4032 });
    expect(dimensoesDaImagem(jpeg(4032, 3024, { orientacao: 1 }))).toEqual({ w: 4032, h: 3024 });
    expect(dimensoesDaImagem(jpeg(4032, 3024, { orientacao: 3 }))).toEqual({ w: 4032, h: 3024 });
  });

  it('WebP com perdas (VP8), sem perdas (VP8L) e estendido (VP8X)', () => {
    const riff = (chunk: number[]): string => url('image/webp', [...ascii('RIFF'), ...le32(100), ...ascii('WEBP'), ...chunk]);
    // VP8: 10 bytes de quadro (3 de tag + código 9d 01 2a) antes do tamanho.
    const vp8 = riff([...ascii('VP8 '), ...le32(30), 0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(1920), ...le16(1080), 0, 0]);
    expect(dimensoesDaImagem(vp8)).toEqual({ w: 1920, h: 1080 });
    // VP8L: assinatura 0x2f + 14 bits (largura-1) + 14 bits (altura-1).
    const [w1, h1] = [1023 - 1, 777 - 1];
    const bits = w1 | (h1 << 14);
    const vp8l = riff([...ascii('VP8L'), ...le32(30), 0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255, 0, 0, 0]);
    expect(dimensoesDaImagem(vp8l)).toEqual({ w: 1023, h: 777 });
    const tri = (n: number): number[] => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
    const vp8x = riff([...ascii('VP8X'), ...le32(10), 0x10, 0, 0, 0, ...tri(3000 - 1), ...tri(2000 - 1)]);
    expect(dimensoesDaImagem(vp8x)).toEqual({ w: 3000, h: 2000 });
  });

  it('AVIF pela caixa ispe', () => {
    const avif = url('image/avif', [...be32(24), ...ascii('ftyp'), ...ascii('avif'), 0, 0, 0, 0, ...ascii('mif1avif'), ...be32(20), ...ascii('ispe'), 0, 0, 0, 0, ...be32(2048), ...be32(1536)]);
    expect(dimensoesDaImagem(avif)).toEqual({ w: 2048, h: 1536 });
  });

  it('SVG: width/height do <svg> raiz, senão o viewBox; nunca os de um filho', () => {
    expect(dimensoesDaImagem(svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675">'))).toEqual({ w: 1200, h: 675 });
    expect(dimensoesDaImagem(svg('<svg width="400px" height="300" viewBox="0 0 40 30">'))).toEqual({ w: 400, h: 300 });
    // Largura em % não é tamanho: vale o viewBox.
    expect(dimensoesDaImagem(svg('<svg width="100%" viewBox="0,0,16,9">'))).toEqual({ w: 16, h: 9 });
    // Só a largura: a altura segue a proporção do viewBox.
    expect(dimensoesDaImagem(svg("<svg width='800' viewBox='0 0 16 9'>"))).toEqual({ w: 800, h: 450 });
    // Sem nada no <svg>: não inventa a partir do <rect>.
    expect(dimensoesDaImagem(svg('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    // SVG em texto (não base64), como o marcador "sem imagem" do site antigo.
    expect(dimensoesDaImagem("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 400 300%27%3E%3C/svg%3E")).toEqual({ w: 400, h: 300 });
  });

  it('arquivo ilegível, truncado ou que não é data URL: null (nunca lança)', () => {
    for (const x of ['', 'https://exemplo.com/a.png', 'data:image/png;base64,IMGDATA0001', 'data:image/png;base64,%%%', url('image/jpeg', [0xff, 0xd8, 0xff]), url('image/png', [0x89, 0x50]), 'data:image/svg+xml,%E0%A4%A']) {
      expect(dimensoesDaImagem(x)).toBeNull();
    }
    expect(dimensoesDaImagem(png(0, 900))).toBeNull();
  });
});

describe('completarDimensoes', () => {
  const doc = (assets: PortfolioV4['assets']): PortfolioV4 => ({ assets } as unknown as PortfolioV4);
  const alt = { pt: '', en: '' };

  it('preenche só o que falta e mantém o resto', () => {
    const d = doc({ a: { mime: 'image/png', w: 0, h: 0, alt }, b: { mime: 'image/png', w: 10, h: 20, alt }, c: { mime: 'image/png', w: 0, h: 0, alt } });
    const out = completarDimensoes(d, { a: png(300, 200), b: png(1, 1) });
    expect(out.assets['a']).toMatchObject({ w: 300, h: 200 });
    expect(out.assets['b']).toMatchObject({ w: 10, h: 20 }); // já tinha: não relê
    expect(out.assets['c']).toMatchObject({ w: 0, h: 0 }); // sem arquivo: fica como estava
    expect(d.assets['a']).toMatchObject({ w: 0, h: 0 }); // não muda o original
  });

  it('nada a preencher: devolve o MESMO documento (quem compara por referência não vê mudança)', () => {
    const d = doc({ b: { mime: 'image/png', w: 10, h: 20, alt } });
    expect(completarDimensoes(d, { b: png(1, 1) })).toBe(d);
  });
});

describe('guarda: imagem que vai para o site sai com largura e altura', () => {
  it('a migração do site antigo já grava o tamanho real', () => {
    const { data } = migrate(loadFixture('template-v3.json'));
    const metas = Object.values(data.assets);
    expect(metas.length).toBeGreaterThan(5);
    for (const m of metas) expect(m.w * m.h, JSON.stringify(m)).toBeGreaterThan(0);
  });

  it('publicar completa o que falta, no público e no NDA desbloqueado', async () => {
    const { data, assets } = migrate(loadFixture('template-v3.json'));
    // Simula um rascunho antigo, migrado quando a migração ainda gravava 0 × 0.
    const antigo = structuredClone(data);
    for (const m of Object.values(antigo.assets)) Object.assign(m, { w: 0, h: 0 });
    // Um projeto com imagem vira NDA.
    const comImagem = antigo.collections.projects.find((p) => JSON.stringify(p).includes('"assetId"'))!;
    comImagem.visibility = 'nda';
    const idsDoNda = [...JSON.stringify(comImagem).matchAll(/"assetId":"([^"]+)"/g)].map((m) => m[1]!);
    expect(idsDoNda.length).toBeGreaterThan(0);

    const p = await buildPublishPayload({ data: antigo, assets }, 'senha-longa-de-teste-123');
    expect(Object.keys(p.publicData.assets).length).toBeGreaterThan(3);
    for (const [id, m] of Object.entries(p.publicData.assets)) expect(m.w * m.h, id).toBeGreaterThan(0);

    const aberto = await decryptNda<{ items: NdaBundle; assets: Record<string, string> }>(p.ndaBlob!, 'senha-longa-de-teste-123');
    const site = mergeNda(p.publicData, aberto.items);
    for (const id of idsDoNda) expect(site.assets[id]?.w ?? 0, `NDA ${id}`).toBeGreaterThan(0);
  });
});
