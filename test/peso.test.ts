import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { migrate } from '../src/migrate/migrate';
import { buildPublishPayload } from '../src/publish/buildPayload';
import { assembleSiteHtml } from '../src/publish/assemble';
import { formatarPeso, pesoDoSite } from '../src/publish/peso';
import { loadFixture } from './helpers/fixtures';

// A estimativa que o editor mostra tem que bater com o index.html de verdade.
describe('peso estimado do site', () => {
  const shell = readFileSync('src/publish/site-shell.html', 'utf8');

  it('fica a menos de 5% do arquivo gerado, e com uma foto grande também', async () => {
    const mig = migrate(loadFixture('template-v3.json'));
    const assets = Object.fromEntries(mig.assets.map((a) => [a.id, a.dataUrl]));
    // Uma "foto" de ~600 KB no primeiro projeto.
    const foto = 'data:image/webp;base64,' + 'A'.repeat(600 * 1024);
    assets['asset_foto'] = foto;
    mig.data.assets['asset_foto'] = { mime: 'image/webp', w: 1600, h: 900, alt: { pt: '', en: '' } };
    mig.data.collections.projects[0]!.thumb = { assetId: 'asset_foto', alt: { pt: '', en: '' } };
    mig.data.collections.projects[0]!.visibility = 'public';

    const estimado = pesoDoSite(mig.data, assets, shell.length);
    const html = assembleSiteHtml(shell, await buildPublishPayload({ data: mig.data, assets: Object.entries(assets).map(([id, dataUrl]) => ({ id, dataUrl, mime: '' })) }));
    expect(Math.abs(estimado.total - html.length) / html.length).toBeLessThan(0.05);
    // A maior imagem aparece primeiro, com onde ela está.
    expect(estimado.imagens[0]!.id).toBe('asset_foto');
    expect(estimado.imagens[0]!.onde).toMatch(/^projeto “/);
  });

  it('rascunho não conta', () => {
    const mig = migrate(loadFixture('template-v3.json'));
    mig.data.collections.projects[0]!.visibility = 'draft';
    mig.data.collections.projects[0]!.thumb = { assetId: 'asset_so_rascunho', alt: { pt: '', en: '' } };
    const p = pesoDoSite(mig.data, { asset_so_rascunho: 'data:image/png;base64,' + 'B'.repeat(1000) }, 0);
    expect(p.imagens.map((i) => i.id)).not.toContain('asset_so_rascunho');
  });

  it('formata em KB e MB com vírgula', () => {
    expect(formatarPeso(512 * 1024)).toBe('512 KB');
    expect(formatarPeso(3.4 * 1048576)).toBe('3,4 MB');
  });
});

describe('runtime do site publicado', () => {
  it('não carrega a biblioteca de validação (zod): os dados já saem validados da publicação', () => {
    const shell = readFileSync(new URL('../src/publish/site-shell.html', import.meta.url), 'utf8');
    expect(shell).not.toContain('ZodError');
    // Referência: com o zod eram ~403 KB; sem ele, ~300 KB.
    expect(shell.length).toBeLessThan(340_000);
  });
});
