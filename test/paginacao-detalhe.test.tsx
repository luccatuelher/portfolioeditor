import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MAIS_ITENS, PageView, proximosDaLista, videoDaPrevia } from '../src/renderer/Page';
import { textoUi } from '../src/renderer/ui';
import { RenderContext } from '../src/renderer/context';
import { migrate } from '../src/migrate/migrate';
import { loadFixture } from './helpers/fixtures';
import type { PortfolioV4, ProjectItem } from '../src/schema/v4';

const base = (): PortfolioV4 => migrate(loadFixture('template-v3.json')).data;

const render = (data: PortfolioV4, itemId: string, opts: { editing?: boolean; nav?: boolean; lang?: 'pt' | 'en' } = {}): string => {
  const item = data.collections.projects.find((p) => p.id === itemId)!;
  const page = data.pages.find((p) => p.id === 'project-detail')!;
  return renderToStaticMarkup(
    <RenderContext.Provider value={{ data, lang: opts.lang ?? 'pt', resolveAsset: () => '', editing: !!opts.editing, onNavigate: opts.nav === false ? undefined : () => {} }}>
      <PageView page={page} item={item} />
    </RenderContext.Provider>,
  );
};

describe('fim da página de projeto: "Você também pode gostar"', () => {
  it('mostra os próximos da lista, na ordem, e o link para a página da lista', () => {
    const d = base();
    const pub = d.collections.projects.filter((p) => p.visibility === 'public');
    expect(pub.length).toBeGreaterThanOrEqual(3);
    const html = render(d, pub[0]!.id);
    expect(html).toContain(textoUi(d, 'pt', 'vocePodeGostar'));
    expect(html).toContain(`href="#project/${pub[1]!.id}"`);
    expect(html).toContain(`href="#project/${pub[2]!.id}"`);
    expect(html).not.toContain(`href="#project/${pub[0]!.id}"`);
    expect(html.match(/class="pager-card"/g)?.length).toBe(Math.min(MAIS_ITENS, pub.length - 1));
    expect(html).toContain(textoUi(d, 'pt', 'allProjects'));
    expect(html).toMatch(/class="pager-link pager-all" href="#[a-z]/); // a página da lista, não a Home
    expect(render(d, pub[0]!.id, { lang: 'en' })).toContain('You may also like');
  });

  it('no fim da lista, dá a volta e sugere os primeiros; nunca o próprio projeto', () => {
    const d = base();
    const pub = d.collections.projects.filter((p) => p.visibility === 'public');
    const ultimo = pub[pub.length - 1]!;
    const sug = proximosDaLista(d.collections.projects, ultimo, false);
    expect(sug[0]!.id).toBe(pub[0]!.id);
    expect(sug.some((p) => p.id === ultimo.id)).toBe(false);
    expect(proximosDaLista([ultimo], ultimo, false)).toEqual([]);
  });

  it('mostra o ano no card', () => {
    const d = base();
    const pub = d.collections.projects.filter((p) => p.visibility === 'public');
    pub[1]!.meta['year'] = { pt: '2031', en: '2031' };
    expect(render(d, pub[0]!.id)).toContain('2031');
  });

  it('rascunho fica fora no site; projeto NDA só sugere NDA', () => {
    const d = base();
    const pub = d.collections.projects.filter((p) => p.visibility === 'public');
    pub[1]!.visibility = 'draft';
    expect(render(d, pub[0]!.id)).not.toContain(`href="#project/${pub[1]!.id}"`);
    pub[1]!.visibility = 'nda';
    pub[0]!.visibility = 'nda';
    const html = render(d, pub[0]!.id);
    expect(html).toContain(`href="#project/${pub[1]!.id}"`);
    expect(html).not.toContain(`href="#project/${pub[2]!.id}"`);
  });

  it('no editor vira botão (o clique troca o projeto do canvas); sem navegação, não aparece', () => {
    const d = base();
    const pub = d.collections.projects.filter((p) => p.visibility === 'public');
    const ed = render(d, pub[1]!.id, { editing: true });
    expect(ed).toContain('<button');
    expect(ed).not.toContain('href="#project/');
    expect(render(d, pub[1]!.id, { nav: false })).not.toContain('detail-pager');
  });

  it('o vídeo da prévia é o primeiro YouTube público do projeto, sem player no HTML inicial', () => {
    const d = base();
    const p = structuredClone(d.collections.projects[0]!) as ProjectItem;
    p.sections = [{ ...p.sections[0]!, blocks: [{ id: 'e1', type: 'embed', span: 12, visibility: 'public', content: { provider: 'youtube', ref: 'https://youtu.be/t2aQ5dqt-fY?t=12' } } as never] }];
    expect(videoDaPrevia(p)).toEqual({ id: 't2aQ5dqt-fY', start: '12' });
    p.sections[0]!.blocks = [];
    expect(videoDaPrevia(p)).toBeNull();
    expect(render(base(), base().collections.projects[0]!.id)).not.toContain('<iframe');
  });
});
