import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SectionView } from '../src/renderer/blocks';
import { RenderContext } from '../src/renderer/context';
import { migrate } from '../src/migrate/migrate';
import { loadFixture } from './helpers/fixtures';
import type { Block, Section } from '../src/schema/v4';

const { data } = migrate(loadFixture('template-v3.json'));

const render = (block: Block, lang: 'pt' | 'en', editing: boolean): string => {
  const section: Section = { id: 's', style: { width: 'normal' }, blocks: [block] };
  return renderToStaticMarkup(
    <RenderContext.Provider value={{ data, lang, resolveAsset: () => '', editing }}>
      <SectionView section={section} />
    </RenderContext.Provider>,
  );
};

const titulo = (pt: string, en: string): Block =>
  ({ id: 'h', type: 'heading', visibility: 'public', span: 12, content: { text: { pt, en }, level: 2 } } as Block);

describe('aviso de tradução pendente', () => {
  it('marca no editor o texto que falta no idioma em edição', () => {
    const html = render(titulo('Trabalhos', ''), 'en', true);
    expect(html).toContain('falta-traducao');
    expect(html).toContain('sem EN');
  });

  it('não marca quando os dois idiomas estão preenchidos', () => {
    expect(render(titulo('Trabalhos', 'Work'), 'en', true)).not.toContain('falta-traducao');
  });

  it('não marca quando NENHUM idioma tem texto (é um bloco vazio, não falta de tradução)', () => {
    expect(render(titulo('', ''), 'en', true)).not.toContain('falta-traducao');
  });

  it('o aviso nunca aparece no site publicado', () => {
    const html = render(titulo('Trabalhos', ''), 'en', false);
    expect(html).not.toContain('falta-traducao');
    expect(html).not.toContain('sem EN');
    expect(html).toContain('Trabalhos'); // o visitante vê o outro idioma, sem saber
  });

  it('vale para o português também (editando em PT com só o inglês preenchido)', () => {
    expect(render(titulo('', 'Work'), 'pt', true)).toContain('sem PT');
  });
});
