import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { migrate } from '../src/migrate/migrate';
import { buildPublishPayload } from '../src/publish/buildPayload';
import { assembleSiteHtml } from '../src/publish/assemble';
import { loadFixture } from './helpers/fixtures';
import { PageView } from '../src/renderer/Page';
import { RenderContext } from '../src/renderer/context';

describe('desempenho da primeira pintura', () => {
  const shell = readFileSync('src/publish/site-shell.html', 'utf8');

  it('nenhuma folha de fonte bloqueia a pintura no shell', () => {
    // O <noscript> não conta: ele só vale quando não há JavaScript.
    const semNoscript = shell.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
    const bloqueantes = [...semNoscript.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => tag.includes('fonts.googleapis.com') && !tag.includes('media="print"'));
    expect(bloqueantes).toEqual([]);
  });

  it('as fontes do tema entram assíncronas, com alternativa sem JavaScript', async () => {
    const mig = migrate(loadFixture('template-v3.json'));
    mig.data.theme.fonts.display = 'Playfair Display';
    const html = assembleSiteHtml(shell, await buildPublishPayload(mig));
    const tag = html.match(/<link rel="stylesheet" href="[^"]*Playfair[^"]*"[^>]*>/)?.[0] ?? '';
    expect(tag).toContain(`media="print"`);
    expect(tag).toContain(`onload="this.media='all'"`);
    expect(html).toMatch(/<noscript><link rel="stylesheet" href="[^"]*Playfair/);
  });
});

describe('prioridade de carregamento das imagens', () => {
  const { data } = migrate(loadFixture('template-v3.json'));
  const html = renderToStaticMarkup(
    <RenderContext.Provider value={{ data, lang: 'pt', resolveAsset: () => 'x.webp', editing: false }}>
      <PageView page={data.pages.find((p) => p.id === 'home')!} />
    </RenderContext.Provider>,
  );

  it('a imagem do topo não é preguiçosa (é a maior pintura da tela)', () => {
    const primeira = html.match(/<img[^>]*class="block-image-img"[^>]*>/)?.[0] ?? '';
    expect(primeira).toContain('loading="eager"');
    expect(primeira.toLowerCase()).toContain('fetchpriority="high"');
  });

  it('o resto das imagens continua preguiçoso', () => {
    const todas = [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
    expect(todas.length).toBeGreaterThan(1);
    expect(todas.filter((t) => t.includes('loading="eager"')).length).toBe(1);
    expect(todas.filter((t) => t.includes('loading="lazy"')).length).toBe(todas.length - 1);
  });
});
