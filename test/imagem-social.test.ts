import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { migrate } from '../src/migrate/migrate';
import { buildPublishPayload } from '../src/publish/buildPayload';
import { assembleSiteHtml } from '../src/publish/assemble';
import { runPreflight } from '../src/publish/preflight';
import { pesoDoSite } from '../src/publish/peso';
import { ARQUIVO_SOCIAL, imagemSocialEmbutida } from '../src/publish/imagemSocial';
import type { Block } from '../src/schema/v4';
import { loadFixture } from './helpers/fixtures';

/**
 * Imagem ao compartilhar o link (Home › SEO): o campo só aceitava enviar uma
 * imagem, e imagem embutida nenhuma rede busca — o controle não fazia efeito.
 * Agora ela vai como arquivo ao lado (compartilhar.jpg), apontada pelo
 * endereço do site; e deixa de ir embutida no index.html (o site nunca a
 * mostrava).
 */
const shell = readFileSync('src/publish/site-shell.html', 'utf8');
const alt = { pt: '', en: '' };
const FOTO = `data:image/png;base64,${Buffer.alloc(40_000, 9).toString('base64')}`;

function comImagemSocial(url?: string) {
  const mig = migrate(loadFixture('template-v3.json'));
  mig.assets.push({ id: 'asset_social', dataUrl: FOTO, mime: 'image/png' });
  mig.data.assets['asset_social'] = { mime: 'image/png', w: 2400, h: 1350, alt };
  const home = mig.data.pages.find((p) => p.id === 'home')!;
  home.seo = { ...(home.seo ?? {}), image: { assetId: 'asset_social', alt } };
  mig.data.site.url = url;
  return mig;
}

describe('imagem de compartilhamento como arquivo ao lado', () => {
  it('com o endereço do site: o <head> aponta para o arquivo, no tamanho do cartão', async () => {
    const mig = comImagemSocial('https://lucca.github.io/portfolio/');
    const p = await buildPublishPayload(mig);
    p.arquivoSocial = ARQUIVO_SOCIAL; // o editor gera o arquivo e marca
    const html = assembleSiteHtml(shell, p);
    expect(html).toContain(`<meta property="og:image" content="https://lucca.github.io/portfolio/${ARQUIVO_SOCIAL}">`);
    expect(html).toContain('<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain(`<meta name="twitter:image" content="https://lucca.github.io/portfolio/${ARQUIVO_SOCIAL}">`);
  });

  it('sem o arquivo ou sem o endereço: nenhum og:image quebrado', async () => {
    const semArquivo = assembleSiteHtml(shell, await buildPublishPayload(comImagemSocial('https://x.io')));
    expect(semArquivo).not.toContain('og:image');
    const p = await buildPublishPayload(comImagemSocial());
    p.arquivoSocial = ARQUIVO_SOCIAL;
    expect(assembleSiteHtml(shell, p)).not.toContain('og:image');
  });

  it('a imagem de SEO não vai embutida no index.html (o site não a mostra)…', async () => {
    const p = await buildPublishPayload(comImagemSocial('https://x.io'));
    expect(p.assetMap['asset_social']).toBeUndefined();
    expect(assembleSiteHtml(shell, p)).not.toContain(FOTO.slice(30, 90));
    expect(imagemSocialEmbutida(p.publicData)?.assetId).toBe('asset_social');
  });

  it('…mas vai, se a mesma imagem também aparece num bloco', async () => {
    const mig = comImagemSocial('https://x.io');
    const img = mig.data.pages.find((p) => p.id === 'home')!.sections.flatMap((s) => s.blocks).find((b): b is Extract<Block, { type: 'image' }> => b.type === 'image')!;
    img.content.image = { assetId: 'asset_social', alt };
    expect((await buildPublishPayload(mig)).assetMap['asset_social']).toBe(FOTO);
  });

  it('o peso mostrado antes de baixar não conta a imagem de SEO', () => {
    const mig = comImagemSocial('https://x.io');
    const mapa = Object.fromEntries(mig.assets.map((a) => [a.id, a.dataUrl]));
    expect(pesoDoSite(mig.data, mapa, 1000).imagens.some((i) => i.id === 'asset_social')).toBe(false);
  });
});

describe('conferência antes de publicar', () => {
  it('imagem enviada sem o endereço do site: diz o que falta e onde', () => {
    const w = runPreflight(comImagemSocial().data).warnings.join('\n');
    expect(w).toMatch(/precisa do endereço do site \(Tema › Endereço do site/);
  });

  it('com o endereço: nada a avisar sobre a imagem de compartilhamento', () => {
    const w = runPreflight(comImagemSocial('https://lucca.github.io/portfolio').data).warnings.join('\n');
    expect(w).not.toMatch(/compartilhamento/);
  });
});
