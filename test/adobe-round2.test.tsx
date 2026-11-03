import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { migrate } from '../src/migrate/migrate';
import { RenderContext, type RenderContextValue } from '../src/renderer/context';
import { BlockView } from '../src/renderer/blocks';
import { SiteHeader, navEntries } from '../src/renderer/Header';
import { dataUrlResolver } from '../src/renderer/dataUrlResolver';
import { PortfolioV4Schema, type Block, type Page } from '../src/schema/v4';
import { impressaoDoDocumento } from '../src/editor/publicado';
import { loadFixture } from './helpers/fixtures';

const base = migrate(loadFixture('template-v3.json')).data;

describe('galeria — modos de exibição', () => {
  const data = structuredClone(base);
  data.collections.gallery.forEach((g) => (g.visibility = 'public'));
  const render = (display: 'grid' | 'stack' | 'strip' | 'slideshow' | undefined, editing = false): string => {
    const ctx: RenderContextValue = { data, lang: 'pt', resolveAsset: dataUrlResolver([]), editing };
    const block: Block = { id: 'g', type: 'collection', span: 12, visibility: 'public', content: { collection: 'gallery', cols: 3, ...(display ? { display } : {}) } };
    return renderToStaticMarkup(<RenderContext.Provider value={ctx}><BlockView block={block} /></RenderContext.Provider>);
  };
  it('grade é o padrão (sem classe de modo)', () => {
    expect(data.collections.gallery.length).toBeGreaterThan(0);
    expect(render(undefined)).not.toContain('disp-');
  });
  it('pilha e faixa só trocam a classe da grade', () => {
    expect(render('stack')).toContain('disp-stack');
    expect(render('strip')).toContain('disp-strip');
  });
  it('apresentação no site mostra imagem grande e miniaturas; no editor segue grade', () => {
    const site = render('slideshow');
    expect(site).toContain('slideshow-stage');
    expect(site).toContain('slideshow-thumb');
    const ed = render('slideshow', true);
    expect(ed).not.toContain('slideshow-stage');
    expect(ed).toContain('collection-grid');
  });
  it('o schema aceita display e recusa valor desconhecido', () => {
    const d = structuredClone(base);
    const p = d.pages.find((x) => x.sections.some((s) => s.blocks.some((b) => b.type === 'collection')))!;
    const b = p.sections.flatMap((s) => s.blocks).find((x) => x.type === 'collection')!;
    if (b.type === 'collection') b.content.display = 'strip';
    expect(PortfolioV4Schema.safeParse(d).success).toBe(true);
    if (b.type === 'collection') (b.content as { display?: string }).display = 'carousel3d';
    expect(PortfolioV4Schema.safeParse(d).success).toBe(false);
  });
});

describe('menu — pastas', () => {
  const pg = (id: string, folder?: { pt: string; en: string }): Page => ({ id, slug: id, title: { pt: id, en: id }, kind: 'static', visibility: 'public', ...(folder ? { menuFolder: folder } : {}), sections: [] });
  it('agrupa páginas da mesma pasta onde está a primeira delas', () => {
    const f = { pt: 'Trabalhos', en: 'Work' };
    const e = navEntries([pg('home'), pg('a', f), pg('sobre'), pg('b', f)]);
    expect(e).toHaveLength(3);
    expect('folder' in e[1]! && e[1].pages.map((p) => p.id)).toEqual(['a', 'b']);
  });
  it('pasta vazia é ignorada (links soltos)', () => {
    expect(navEntries([pg('a', { pt: ' ', en: '' }), pg('b')])).toHaveLength(2);
  });
  it('o cabeçalho desenha o menu suspenso', () => {
    const data = structuredClone(base);
    const f = { pt: 'Trabalhos', en: 'Work' };
    const ids = data.site.nav.slice(0, 2);
    for (const id of ids) {
      const p = data.pages.find((x) => x.id === id);
      if (p) p.menuFolder = f;
    }
    const ctx: RenderContextValue = { data, lang: 'pt', resolveAsset: dataUrlResolver([]), editing: false };
    const html = renderToStaticMarkup(<RenderContext.Provider value={ctx}><SiteHeader data={data} lang="pt" /></RenderContext.Provider>);
    expect(html).toContain('nav-folder-btn');
    expect(html).toContain('Trabalhos');
  });
});

describe('indicador de alterações não publicadas', () => {
  it('a impressão muda quando o documento muda e é estável quando não muda', () => {
    const a = structuredClone(base);
    expect(impressaoDoDocumento(a)).toBe(impressaoDoDocumento(structuredClone(base)));
    a.site.name.pt += 'x';
    expect(impressaoDoDocumento(a)).not.toBe(impressaoDoDocumento(base));
  });
});
