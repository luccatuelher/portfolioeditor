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

  it('o runtime vem depois do conteúdo: a Home pinta sem esperar o JavaScript baixar', async () => {
    const payload = await buildPublishPayload(migrate(loadFixture('template-v3.json')));
    const html = assembleSiteHtml(shell, payload);
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).not.toContain('<script type="module"');
    const root = html.indexOf('<div id="root">');
    const dados = html.indexOf('window.__PORTFOLIO_DATA__');
    const runtime = html.indexOf('<script type="module"');
    expect(runtime).toBeGreaterThan(root);
    expect(runtime).toBeGreaterThan(dados);
    expect(runtime).toBeLessThan(html.lastIndexOf('</body>'));
    // O CSS continua no <head>: a Home pré-renderizada já pinta com estilo.
    expect(head).toContain('<style');
  });

  it('imagens da Home: sem repetir o peso, preenchidas antes do runtime e do NDA', async () => {
    const mig = migrate(loadFixture('template-v3.json'));
    const payload = await buildPublishPayload(mig);
    const html = assembleSiteHtml(shell, payload);
    const root = html.slice(html.indexOf('<div id="root">'), html.indexOf('window.__PORTFOLIO_DATA__'));
    // No pré-render a imagem vai só com o id (e as dimensões), sem o data URL.
    expect(root).toMatch(/<img[^>]*data-asset="asset_[\w-]+"/);
    expect(root).not.toContain('data:image');
    expect(html).not.toContain('prerender-asset:');
    // Nenhum preload apontando para um id de imagem (seria um pedido a endereço inexistente).
    expect(root).not.toMatch(/<link[^>]*href="asset_/);
    for (const url of Object.values(payload.assetMap)) expect(html.split(url).length - 1).toBe(1);
  });

  it('imagens da Home chegam primeiro, uma a uma e na ordem da página — não esperam as do resto do portfólio', async () => {
    const mig = migrate(loadFixture('template-v3.json'));
    // O NDA cifrado entra no arquivo: tem de vir depois das fotos da Home.
    mig.data.collections.projects[mig.data.collections.projects.length - 1]!.visibility = 'nda';
    const payload = await buildPublishPayload(mig, 'senha-longa-de-teste-123');
    expect(payload.ndaBlob).not.toBeNull();
    const html = assembleSiteHtml(shell, payload);
    const root = html.slice(html.indexOf('<div id="root">'), html.indexOf('window.__PORTFOLIO_DATA__'));
    const daHome = [...new Set([...root.matchAll(/ data-asset="([\w-]+)"/g)].map((m) => m[1]!))];
    const outras = Object.keys(payload.assetMap).filter((id) => !daHome.includes(id));
    // O exemplo tem das duas: fotos na Home e fotos só dentro dos projetos.
    expect(daHome.length).toBeGreaterThan(1);
    expect(outras.length).toBeGreaterThan(0);

    const pos = (id: string): number => html.indexOf(payload.assetMap[id]!);
    const chegadaDaHome = daHome.map((id) => html.indexOf(`<script>__IMG__("${id}",`));
    // Cada foto da Home tem o próprio <script>, na ordem em que aparece na página.
    for (const p of chegadaDaHome) expect(p).toBeGreaterThan(0);
    expect([...chegadaDaHome].sort((a, b) => a - b)).toEqual(chegadaDaHome);
    // Nenhuma imagem de fora da Home vem antes da última da Home.
    const ultimaDaHome = Math.max(...daHome.map(pos));
    for (const id of outras) expect(pos(id), id).toBeGreaterThan(ultimaDaHome);
    // Tudo antes do NDA cifrado e do runtime.
    expect(ultimaDaHome).toBeLessThan(html.indexOf('window.__NDA__'));
    expect(ultimaDaHome).toBeLessThan(html.indexOf('<script type="module"'));

    // O runtime começa sem esperar o resto: `async` (um módulo embutido sem ele
    // só roda com o arquivo inteiro lido) e ANTES das demais imagens e do NDA.
    const runtime = html.indexOf('<script type="module" async');
    expect(runtime).toBeGreaterThan(ultimaDaHome);
    for (const id of outras) {
      expect(pos(id), id).toBeGreaterThan(runtime);
      expect(html.indexOf(`<script>__IMG__("${id}",`), `${id} no próprio <script>`).toBeGreaterThan(runtime);
    }
    expect(html.indexOf('window.__NDA__=')).toBeGreaterThan(runtime);
    // O runtime sabe desde o início que há NDA a caminho.
    expect(html.indexOf('window.__TEM_NDA__=true')).toBeLessThan(runtime);
    expect(html).not.toContain('<!--PORTFOLIO_RUNTIME-->');
    expect(html.match(/<script type="module"/g)?.length).toBe(1);
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

describe('assembleSiteHtml — compartilhamento do link', () => {
  const shell = readFileSync('src/publish/site-shell.html', 'utf8');
  const comSite = async (ajuste: (m: ReturnType<typeof migrate>) => void) => {
    const mig = migrate(loadFixture('template-v3.json'));
    ajuste(mig);
    return assembleSiteHtml(shell, await buildPublishPayload(mig));
  };

  it('imagem embutida NÃO vira og:image (nenhuma rede busca data:)', async () => {
    const html = await comSite((m) => {
      const home = m.data.pages.find((p) => p.id === 'home')!;
      home.seo = { image: { assetId: Object.keys(m.data.assets)[0]!, alt: { pt: '', en: '' } } };
    });
    expect(html).not.toMatch(/og:image" content="data:/);
    expect(html).toContain('twitter:card" content="summary"'); // cartão pequeno, sem imagem
  });

  it('imagem por endereço público vira og:image e cartão grande', async () => {
    const html = await comSite((m) => {
      m.data.site.url = 'https://luccatuelher.com/';
      const home = m.data.pages.find((p) => p.id === 'home')!;
      home.seo = { image: { url: 'capa.jpg', alt: { pt: '', en: '' } } };
    });
    expect(html).toContain('<meta property="og:image" content="https://luccatuelher.com/capa.jpg">');
    expect(html).toContain('twitter:card" content="summary_large_image"');
    expect(html).toContain('<meta name="twitter:image" content="https://luccatuelher.com/capa.jpg">');
  });

  it('com endereço do site sai link canônico e og:url', async () => {
    const html = await comSite((m) => void (m.data.site.url = 'https://luccatuelher.com'));
    expect(html).toContain('<link rel="canonical" href="https://luccatuelher.com">');
    expect(html).toContain('<meta property="og:url" content="https://luccatuelher.com">');
  });

  it('sem endereço, nada de canônico inventado', async () => {
    const html = await comSite(() => {});
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('og:url');
  });

  it('dados estruturados descrevem a pessoa e os perfis', async () => {
    const html = await comSite((m) => {
      m.data.site.url = 'https://luccatuelher.com';
    });
    const bloco = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '';
    const dados = JSON.parse(bloco.replace(/\u003c/g, '<'));
    expect(dados['@type']).toBe('Person');
    expect(dados.name).toBe(migrate(loadFixture('template-v3.json')).data.site.name.pt);
    expect(dados.url).toBe('https://luccatuelher.com');
  });

  it('nome com "</script>" não corta o bloco de dados', async () => {
    const html = await comSite((m) => void (m.data.site.name = { pt: 'Lucca </script><script>alert(1)</script>', en: 'x' }));
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html.match(/<script type="application\/ld\+json">/g)?.length).toBe(1);
  });

  it('locale e nome do site saem sempre', async () => {
    const html = await comSite(() => {});
    expect(html).toContain('og:locale" content="pt_BR"');
    expect(html).toContain('og:site_name');
  });
});
