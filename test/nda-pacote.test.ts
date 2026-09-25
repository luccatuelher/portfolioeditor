import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { abrirPacoteNda, encryptNda, selarPacoteNda } from '../src/publish/nda';
import { migrate } from '../src/migrate/migrate';
import { buildPublishPayload } from '../src/publish/buildPayload';
import { assembleSiteHtml } from '../src/publish/assemble';
import { pesoDoSite } from '../src/publish/peso';
import { loadFixture } from './helpers/fixtures';

/**
 * Pacote NDA do site: as imagens vão como bytes dentro do cifrado (base64 uma
 * vez só, no pacote inteiro), não como data URL dentro de JSON cifrado — que
 * passava pelo base64 duas vezes e deixava cada imagem NDA ~1,78× o arquivo.
 */
const ITER = 1000; // derivação rápida nos testes (o site usa 210 000)
const b64 = (b: Uint8Array | Buffer): string => Buffer.from(b).toString('base64');
const bytesDe = (url: string): Buffer => {
  const [cab, corpo] = [url.slice(0, url.indexOf(',')), url.slice(url.indexOf(',') + 1)];
  return /;base64$/.test(cab) ? Buffer.from(corpo, 'base64') : Buffer.from(decodeURIComponent(corpo));
};

describe('selarPacoteNda / abrirPacoteNda', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), randomBytes(5000)]);
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), randomBytes(3000)]);
  const svgTexto = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 3'><text>ção</text></svg>";
  const pacote = {
    items: { projects: [{ id: 'p1', title: { pt: 'Confidencial — ção', en: 'x' } }] },
    assets: {
      a_png: `data:image/png;base64,${b64(png)}`,
      a_jpg: `data:image/jpeg;base64,${b64(jpg)}`,
      a_svg: `data:image/svg+xml,${encodeURIComponent(svgTexto)}`,
      a_estranho: 'data:image/png;base64',
    },
  };

  it('ida e volta: os itens e os mesmos bytes de cada imagem, com o tipo', async () => {
    const aberto = await abrirPacoteNda(await selarPacoteNda(pacote, 'senha-certa', ITER), 'senha-certa');
    expect(aberto.items).toEqual(pacote.items);
    expect(bytesDe(aberto.assets['a_png']!).equals(png)).toBe(true);
    expect(aberto.assets['a_png']).toMatch(/^data:image\/png;base64,/);
    expect(bytesDe(aberto.assets['a_jpg']!).equals(jpg)).toBe(true);
    expect(bytesDe(aberto.assets['a_svg']!).toString()).toBe(svgTexto);
    expect(aberto.assets['a_svg']).toMatch(/^data:image\/svg\+xml;/);
    // O que não é um data URL legível passa como veio.
    expect(aberto.assets['a_estranho']).toBe('data:image/png;base64');
  });

  it('o site pode pedir outra forma de URL (blob:) sem recodificar base64', async () => {
    const vistos: string[] = [];
    const aberto = await abrirPacoteNda(await selarPacoteNda(pacote, 's', ITER), 's', (mime, bytes) => {
      vistos.push(`${mime}:${bytes.length}`);
      return `blob:teste/${mime}`;
    });
    expect(vistos).toEqual([`image/png:${png.length}`, `image/jpeg:${jpg.length}`, `image/svg+xml:${Buffer.byteLength(svgTexto)}`]);
    expect(aberto.assets['a_png']).toBe('blob:teste/image/png');
  });

  it('senha errada: recusa', async () => {
    await expect(abrirPacoteNda(await selarPacoteNda(pacote, 'certa', ITER), 'errada')).rejects.toBeTruthy();
  });

  it('pacote do formato antigo (JSON cifrado) continua abrindo', async () => {
    const antigo = await encryptNda({ items: pacote.items, assets: { a: pacote.assets.a_png } }, 'velha', ITER);
    expect(antigo.v).toBe(1);
    const aberto = await abrirPacoteNda(antigo, 'velha');
    expect(aberto.items).toEqual(pacote.items);
    expect(aberto.assets['a']).toBe(pacote.assets.a_png);
  });

  it('guarda de tamanho: imagem NDA pesa no arquivo o mesmo que uma pública (~1,33×), não ~1,78×', async () => {
    const foto = randomBytes(300 * 1024);
    const enc = await selarPacoteNda({ items: {}, assets: { f: `data:image/webp;base64,${b64(foto)}` } }, 's', ITER);
    const noArquivo = JSON.stringify(enc).length;
    expect(noArquivo / foto.length).toBeLessThan(1.36);
    const publica = `data:image/webp;base64,${b64(foto)}`.length;
    expect(noArquivo / publica).toBeLessThan(1.02);
  });
});

describe('peso estimado com NDA', () => {
  it('bate com o index.html gerado mesmo com uma foto grande só no NDA', async () => {
    const shell = readFileSync('src/publish/site-shell.html', 'utf8');
    const mig = migrate(loadFixture('template-v3.json'));
    const assets = Object.fromEntries(mig.assets.map((a) => [a.id, a.dataUrl]));
    assets['asset_nda'] = `data:image/webp;base64,${b64(randomBytes(600 * 1024))}`;
    mig.data.assets['asset_nda'] = { mime: 'image/webp', w: 1600, h: 900, alt: { pt: '', en: '' } };
    const proj = mig.data.collections.projects[0]!;
    proj.thumb = { assetId: 'asset_nda', alt: { pt: '', en: '' } };
    proj.visibility = 'nda';

    const estimado = pesoDoSite(mig.data, assets, shell.length);
    const payload = await buildPublishPayload({ data: mig.data, assets: Object.entries(assets).map(([id, dataUrl]) => ({ id, dataUrl, mime: '' })) }, 'senha-longa-de-teste-123');
    expect(payload.ndaBlob?.v).toBe(2);
    const html = assembleSiteHtml(shell, payload);
    expect(Math.abs(estimado.total - html.length) / html.length).toBeLessThan(0.05);
  });
});
