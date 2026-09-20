import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SectionView } from '../src/renderer/blocks';
import { RenderContext } from '../src/renderer/context';
import { migrate } from '../src/migrate/migrate';
import { loadFixture } from './helpers/fixtures';
import type { Block, PortfolioV4, Section } from '../src/schema/v4';

const { data } = migrate(loadFixture('template-v3.json'));

const imagem = (id: string, span: number, mobile?: number): Block => ({
  id, type: 'image', visibility: 'public', span,
  content: { image: { url: 'x.webp', alt: { pt: '', en: '' } } },
  ...(mobile ? { responsive: { mobile: { span: mobile } } } : {}),
} as Block);

const render = (blocks: Block[], rowAlign: 'start' | 'center' | 'end' | 'between' = 'center'): string => {
  const section: Section = { id: 's1', style: { width: 'normal' }, blocks: blocks.map((b, i) => (i === 0 ? { ...b, rowAlign } : b)) };
  const doc: PortfolioV4 = { ...data, pages: [{ ...data.pages[0]!, sections: [section] }] };
  return renderToStaticMarkup(
    <RenderContext.Provider value={{ data: doc, lang: 'pt', resolveAsset: () => 'x.webp', editing: false }}>
      <SectionView section={section} />
    </RenderContext.Provider>,
  );
};

/** Lê as variáveis e classes que o CSS usa para posicionar a linha. */
const primeiroBloco = (html: string): { classes: string; estilo: string } => {
  const m = html.match(/<div class="(block[^"]*)" style="([^"]*)"/);
  return { classes: m?.[1] ?? '', estilo: m?.[2] ?? '' };
};

describe('alinhamento da linha em cada tela', () => {
  it('fila que cabe nas três telas mantém o alinhamento em todas', () => {
    const html = render([imagem('a', 2), imagem('b', 2), imagem('c', 2), imagem('d', 2), imagem('e', 2)]);
    const { classes, estilo } = primeiroBloco(html);
    expect(classes).toContain('t-row');
    expect(classes).toContain('m-row');
    // sobra de 2 colunas (5 × 2 = 10 de 12) em tablet e celular
    expect(estilo).toContain('--cfree-t:2');
    expect(estilo).toContain('--cfree-m:2');
  });

  it('largura de celular que estoura a linha tira o alinhamento SÓ do celular', () => {
    const html = render([imagem('a', 2, 3), imagem('b', 2, 3), imagem('c', 2, 3), imagem('d', 2, 3), imagem('e', 2, 3)]);
    const { classes, estilo } = primeiroBloco(html);
    expect(classes).toContain('t-row'); // no tablet a fila continua cabendo
    expect(classes).not.toContain('m-row'); // no celular ela quebra
    expect(estilo).toContain('--cfree-t:2');
    expect(estilo).not.toContain('--cfree-m');
  });

  it('linha com texto perde o alinhamento no celular (o texto toma a linha inteira)', () => {
    const texto: Block = { id: 't', type: 'text', visibility: 'public', span: 6, content: { html: { pt: 'oi', en: 'hi' } } } as Block;
    const html = render([texto, imagem('b', 6)]);
    const { classes } = primeiroBloco(html);
    expect(classes).toContain('t-row');
    expect(classes).not.toContain('m-row');
  });

  it('a sobra do computador continua sendo a do computador', () => {
    const html = render([imagem('a', 3), imagem('b', 3)]);
    expect(primeiroBloco(html).estilo).toContain('--cfree:6');
  });
});
