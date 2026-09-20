import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { migrate } from '../src/migrate/migrate';
import { RenderContext, type RenderContextValue } from '../src/renderer/context';
import { SectionView } from '../src/renderer/blocks';
import { dataUrlResolver } from '../src/renderer/dataUrlResolver';
import { Site } from '../src/renderer/Site';
import type { Block, Section } from '../src/schema/v4';
import { loadFixture } from './helpers/fixtures';

function renderRoute(fixture: string, route: string, lang: 'pt' | 'en' = 'pt'): string {
  const { data, assets } = migrate(loadFixture(fixture));
  return renderToStaticMarkup(
    <Site data={data} resolveAsset={dataUrlResolver(assets)} initialRoute={route} initialLang={lang} />,
  );
}

describe('renderer — páginas a partir do v4', () => {
  it('Home: banner, coleção de projetos, storyboard e embed', () => {
    const html = renderRoute('template-v3.json', '');
    expect(html).toContain('header-name');
    expect(html).toContain('card-thumb'); // cards de projeto
    expect(html).toContain('storyboard-grid'); // homeItems imagem
    expect(html).toContain('embed-area'); // homeItems vídeo
  });

  it('Sobre: bloco de texto', () => {
    expect(renderRoute('template-v3.json', 'about')).toContain('block-text-body');
  });

  it('Galeria: cards de galeria', () => {
    expect(renderRoute('template-v3.json', 'gallery')).toContain('art-item');
  });

  it('Contato: e-mail e sociais', () => {
    const html = renderRoute('template-v3.json', 'contact');
    expect(html).toContain('contact-email');
    expect(html).toContain('contato@exemplo.com');
  });

  it('Detalhe de projeto: título e seções do item', () => {
    const html = renderRoute('template-v3.json', 'project/demo-sequencia');
    expect(html).toContain('detail-title');
    expect(html).toContain('A Travessia');
  });

  it('alterna idioma (initialLang=en) no chrome', () => {
    const html = renderRoute('template-v3.json', 'projects', 'en');
    expect(html).toContain('Projects'); // navProjectsEn
  });

  it('não renderiza páginas/blocos NDA no modo público (sintética)', () => {
    const html = renderRoute('legacy-synthetic-v3.json', 'projects');
    expect(html).not.toContain('Projeto B (confidencial)');
  });
});

describe('renderer — todos os tipos de bloco', () => {
  it('renderiza cada tipo do catálogo sem lançar', () => {
    const { data, assets } = migrate(loadFixture('template-v3.json'));
    const img = { url: 'https://example.com/x.jpg', alt: { pt: 'a', en: 'a' } };
    const b = (block: Block): Block => block;
    const blocks: Block[] = [
      b({ id: 'h', type: 'heading', span: 12, visibility: 'public', content: { text: { pt: 'Título', en: 'Title' } } }),
      b({ id: 't', type: 'text', span: 12, visibility: 'public', content: { html: { pt: '<p>oi</p>', en: '<p>hi</p>' } } }),
      b({ id: 'i', type: 'image', span: 6, visibility: 'public', content: { image: img } }),
      b({ id: 'e', type: 'embed', span: 6, visibility: 'public', content: { provider: 'youtube', ref: 'aqz-KE-bpKQ' } }),
      b({ id: 's', type: 'storyboard', span: 12, visibility: 'public', content: { frames: [img, img] } }),
      b({ id: 'c', type: 'collection', span: 12, visibility: 'public', content: { collection: 'projects', cols: 3 } }),
      b({ id: 'sp', type: 'spacer', span: 12, visibility: 'public', content: { size: 'm' } }),
      b({ id: 'dv', type: 'divider', span: 12, visibility: 'public', content: {} }),
      b({
        id: 'ct', type: 'contact', span: 12, visibility: 'public',
        content: { heading: { pt: 'H', en: 'H' }, body: { pt: 'B', en: 'B' }, email: 'a@b.com', phone: '', cvLabel: { pt: 'CV', en: 'CV' }, cvHref: '#', socials: [] },
      }),
      b({ id: 'cl', type: 'columns', span: 12, visibility: 'public', content: { count: 2 } }),
    ];
    const section: Section = { id: 'sec', style: { width: 'normal' }, blocks };
    const ctx: RenderContextValue = { data, lang: 'pt', resolveAsset: dataUrlResolver(assets), editing: false };

    const html = renderToStaticMarkup(
      <RenderContext.Provider value={ctx}>
        <SectionView section={section} />
      </RenderContext.Provider>,
    );

    for (const cls of ['block-heading-text', 'block-text-body', 'block-image-img', 'embed-area', 'storyboard-grid', 'collection-grid', 'spacer', 'block-divider', 'contact-layout', 'columns-placeholder']) {
      expect(html, `faltou ${cls}`).toContain(cls);
    }
  });
});

describe('renderer — pureza de estilo (arquitetura)', () => {
  const css = readFileSync(new URL('../src/renderer/styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('CSS não usa cores hex hardcoded (só tokens)', () => {
    const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g);
    expect(hex).toBeNull();
  });

  it('CSS não usa !important', () => {
    expect(css.includes('!important')).toBe(false);
  });
});

describe('coleção vazia', () => {
  const { data } = migrate(loadFixture('template-v3.json'));
  const vazio: PortfolioV4 = { ...data, collections: { projects: [], blog: [], gallery: [], sketches: [] } };
  const bloco: Block = { id: 'c1', type: 'collection', visibility: 'public', span: 12, content: { collection: 'projects', cols: 3 } } as Block;
  const secao: Section = { id: 's1', style: { width: 'normal' }, blocks: [bloco] };

  const render = (editing: boolean): string =>
    renderToStaticMarkup(
      <RenderContext.Provider value={{ data: vazio, lang: 'pt', resolveAsset: () => '', editing }}>
        <SectionView section={secao} />
      </RenderContext.Provider>,
    );

  it('no site publicado, lista vazia não anuncia que está vazia', () => {
    const html = render(false);
    expect(html).not.toContain('Nenhum item');
    expect(html).not.toContain('empty-collection');
  });

  it('no editor, a mensagem fica e diz onde resolver', () => {
    const html = render(true);
    expect(html).toContain('empty-collection');
    expect(html).toContain('painel Dados');
  });
});
