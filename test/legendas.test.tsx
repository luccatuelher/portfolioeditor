/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Site } from '../src/renderer/Site';
import { migrate } from '../src/migrate/migrate';
import { mapResolver } from '../src/renderer/dataUrlResolver';
import type { Block, PortfolioV4 } from '../src/schema/v4';
import { loadFixture } from './helpers/fixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Legenda visível no bloco Imagem e em cada quadro do storyboard: embaixo da
 * imagem (figure/figcaption), no idioma de quem visita, e no visualizador
 * ampliado do quadro.
 */
function comLegendas(): { doc: PortfolioV4; assets: Record<string, string> } {
  const { data, assets } = migrate(loadFixture('template-v3.json'));
  const home = data.pages.find((p) => p.id === 'home')!;
  const blocos = home.sections.flatMap((s) => s.blocks);
  const img = blocos.find((b): b is Extract<Block, { type: 'image' }> => b.type === 'image')!;
  const sb = blocos.find((b): b is Extract<Block, { type: 'storyboard' }> => b.type === 'storyboard')!;
  img.content.caption = { pt: 'Frame final, 2024', en: 'Final frame, 2024' };
  sb.content.frames[0]!.caption = { pt: 'SH 01 — Ana entra', en: '' };
  return { doc: data, assets: Object.fromEntries(assets.map((a) => [a.id, a.dataUrl])) };
}

async function montar(lang: 'pt' | 'en'): Promise<{ el: HTMLElement; sair: () => void }> {
  const { doc, assets } = comLegendas();
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(<Site data={doc} resolveAsset={mapResolver(assets)} initialLang={lang} />));
  return { el, sair: () => { act(() => root.unmount()); el.remove(); } };
}

describe('legendas no site', () => {
  it('embaixo da imagem e do quadro, ligadas a eles', async () => {
    const { el, sair } = await montar('pt');
    const img = el.querySelector('figure.block-image-inner');
    expect(img?.querySelector('img')).not.toBeNull();
    expect(img?.querySelector('figcaption')?.textContent).toBe('Frame final, 2024');
    const quadro = el.querySelector('figure.storyboard-cell');
    expect(quadro?.querySelector('figcaption')?.textContent).toBe('SH 01 — Ana entra');
    // Só o quadro com legenda vira <figure>; os outros continuam como estavam.
    expect(el.querySelectorAll('figure.storyboard-cell').length).toBe(1);
    sair();
  });

  it('em inglês: a tradução; sem tradução, o português (como todo texto do site)', async () => {
    const { el, sair } = await montar('en');
    expect(el.querySelector('figure.block-image-inner figcaption')?.textContent).toBe('Final frame, 2024');
    expect(el.querySelector('figure.storyboard-cell figcaption')?.textContent).toBe('SH 01 — Ana entra');
    sair();
  });

  it('o visualizador ampliado mostra a legenda do quadro', async () => {
    const { el, sair } = await montar('pt');
    const botao = el.querySelector<HTMLButtonElement>('figure.storyboard-cell .storyboard-frame-btn')!;
    await act(async () => botao.click());
    expect(document.querySelector('.lightbox .lightbox-caption')?.textContent).toBe('SH 01 — Ana entra');
    sair();
  });
});
