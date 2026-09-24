import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PageView } from '../src/renderer/Page';
import { textoUi } from '../src/renderer/ui';
import { RenderContext } from '../src/renderer/context';
import { migrate } from '../src/migrate/migrate';
import { loadFixture } from './helpers/fixtures';
import type { PortfolioV4 } from '../src/schema/v4';

const base = (): PortfolioV4 => migrate(loadFixture('template-v3.json')).data;

const render = (data: PortfolioV4, itemId: string, opts: { editing?: boolean; nav?: boolean } = {}): string => {
  const item = data.collections.projects.find((p) => p.id === itemId)!;
  const page = data.pages.find((p) => p.id === 'project-detail')!;
  return renderToStaticMarkup(
    <RenderContext.Provider value={{ data, lang: 'pt', resolveAsset: () => '', editing: !!opts.editing, onNavigate: opts.nav === false ? undefined : () => {} }}>
      <PageView page={page} item={item} />
    </RenderContext.Provider>,
  );
};

describe('fim da página de projeto: anterior · todos · próximo', () => {
  it('no meio da lista, leva ao anterior, ao próximo e à página da lista, na ordem da lista', () => {
    const d = base();
    const pub = d.collections.projects.filter((p) => p.visibility === 'public');
    expect(pub.length).toBeGreaterThanOrEqual(3);
    const html = render(d, pub[1]!.id);
    expect(html).toContain(`href="#project/${pub[0]!.id}"`);
    expect(html).toContain(`href="#project/${pub[2]!.id}"`);
    // O texto vem do dicionário da interface — o personalizado do site, se houver.
    expect(html).toContain(textoUi(d, 'pt', 'allProjects'));
    expect(html).toMatch(/class="pager-link pager-all" href="#[a-z]/); // a página da lista, não a Home
  });

  it('o primeiro não tem anterior; o último não tem próximo', () => {
    const d = base();
    const pub = d.collections.projects.filter((p) => p.visibility === 'public');
    expect(render(d, pub[0]!.id)).not.toContain('pager-prev');
    expect(render(d, pub[pub.length - 1]!.id)).not.toContain('pager-next');
  });

  it('rascunho fica fora no site; projeto NDA só anda entre os NDA', () => {
    const d = base();
    const pub = d.collections.projects.filter((p) => p.visibility === 'public');
    pub[1]!.visibility = 'draft';
    expect(render(d, pub[0]!.id)).toContain(`href="#project/${pub[2]!.id}"`);
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
});
