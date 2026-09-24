import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Lightbox } from '../src/renderer/Lightbox';
import { RenderContext } from '../src/renderer/context';
import { migrate } from '../src/migrate/migrate';
import { loadFixture } from './helpers/fixtures';
import type { LightItem } from '../src/renderer/context';

const { data } = migrate(loadFixture('template-v3.json'));
const render = (items: LightItem[], lang: 'pt' | 'en'): string =>
  renderToStaticMarkup(
    <RenderContext.Provider value={{ data, lang, resolveAsset: () => '', editing: false }}>
      <Lightbox items={items} index={0} onIndex={() => {}} onClose={() => {}} />
    </RenderContext.Provider>,
  );

describe('visualizador de imagem', () => {
  it('mostra a legenda da galeria e liga ela ao diálogo', () => {
    const html = render([{ src: 'a.jpg', alt: 'Rua de noite', caption: 'Exploração de cor' }, { src: 'b.jpg', alt: '' }], 'pt');
    expect(html).toContain('<p class="lightbox-caption" id="lightbox-legenda">Exploração de cor</p>');
    expect(html).toContain('aria-describedby="lightbox-legenda"');
    expect(html).toContain('1 / 2');
  });

  it('sem legenda e com uma imagem só, não sobra rodapé vazio', () => {
    const html = render([{ src: 'a.jpg', alt: 'Rua' }], 'pt');
    expect(html).not.toContain('lightbox-bar');
    expect(html).not.toContain('aria-describedby');
  });

  it('em inglês, os botões falam inglês', () => {
    const html = render([{ src: 'a.jpg', alt: '' }, { src: 'b.jpg', alt: '' }], 'en');
    for (const t of ['aria-label="Close"', 'aria-label="Previous image"', 'aria-label="Next image"', 'aria-label="Enlarged image"', 'alt="Image 1"']) expect(html).toContain(t);
    expect(html).not.toContain('Fechar');
  });
});
