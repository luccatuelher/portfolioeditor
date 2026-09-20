import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { migrate } from '../src/migrate/migrate';
import { buildPublishPayload } from '../src/publish/buildPayload';
import { assembleSiteHtml } from '../src/publish/assemble';
import { loadFixture } from './helpers/fixtures';

describe('assembleSiteHtml', () => {
  const shell = readFileSync('src/publish/site-shell.html', 'utf8');

  it('vem com a Home pré-renderizada (não fica branco sem JS)', async () => {
    const payload = await buildPublishPayload(migrate(loadFixture('template-v3.json')));
    const html = assembleSiteHtml(shell, payload);
    expect(html).not.toContain('<div id="root"></div>');
    expect(html).toMatch(/<div id="root"><div class="site"/);
  });

  it('dados com "$&" e "$\'" não corrompem o HTML', async () => {
    const mig = migrate(loadFixture('template-v3.json'));
    mig.data.site.role = { pt: "Preço R$& e $' teste", en: 'x' };
    const payload = await buildPublishPayload(mig);
    const html = assembleSiteHtml(shell, payload);
    expect(html).toContain("Preço R$& e $' teste");
    expect(html.match(/<script type="module"/g)?.length).toBe(1);
  });
});

describe('assembleSiteHtml — favicon', () => {
  it('coloca o ícone da aba no <head>', async () => {
    const mig = migrate(loadFixture('template-v3.json'));
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    mig.assets.push({ id: 'asset_fav', dataUrl: png, mime: 'image/png' });
    mig.data.assets['asset_fav'] = { mime: 'image/png', w: 128, h: 128, alt: { pt: '', en: '' } };
    mig.data.site.favicon = { assetId: 'asset_fav', alt: { pt: '', en: '' } };
    const html = assembleSiteHtml(readFileSync('src/publish/site-shell.html', 'utf8'), await buildPublishPayload(mig));
    expect(html).toContain('<link rel="icon" href="' + png + '">');
  });
});

describe('assembleSiteHtml — analytics', () => {
  const shell = readFileSync('src/publish/site-shell.html', 'utf8');

  it('coloca o snippet do dono do site no <head>, sem mexer nele', async () => {
    const mig = migrate(loadFixture('template-v3.json'));
    const snippet = '<script defer data-domain="lucca.art" src="https://plausible.io/js/script.js"></script>';
    mig.data.site.analytics = snippet;
    const html = assembleSiteHtml(shell, await buildPublishPayload(mig));
    expect(html).toContain(snippet);
    expect(html.indexOf(snippet)).toBeLessThan(html.indexOf('</head>'));
  });

  it('sem snippet, nada é injetado', async () => {
    const html = assembleSiteHtml(shell, await buildPublishPayload(migrate(loadFixture('template-v3.json'))));
    expect(html).not.toContain('plausible.io');
  });

  it('recusa um snippet que fecharia o <head>', async () => {
    const mig = migrate(loadFixture('template-v3.json'));
    mig.data.site.analytics = '</head><body onload="alert(1)">';
    const html = assembleSiteHtml(shell, await buildPublishPayload(mig));
    expect(html).not.toContain('onload="alert(1)"');
  });
});

describe('assembleSiteHtml — celular', () => {
  it('pinta a barra do navegador com a cor de fundo do site', async () => {
    const mig = migrate(loadFixture('template-v3.json'));
    mig.data.theme.colors.bg = '#101014';
    const html = assembleSiteHtml(readFileSync('src/publish/site-shell.html', 'utf8'), await buildPublishPayload(mig));
    expect(html).toContain('<meta name="theme-color" content="#101014">');
  });
});
