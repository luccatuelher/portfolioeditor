import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { migrate } from '../src/migrate/migrate';
import { loadFixture } from './helpers/fixtures';
import { PageView } from '../src/renderer/Page';
import { RenderContext } from '../src/renderer/context';
import type { PortfolioV4 } from '../src/schema/v4';

const render = (data: PortfolioV4, pageId: string): string => {
  const page = data.pages.find((p) => p.id === pageId)!;
  return renderToStaticMarkup(
    <RenderContext.Provider value={{ data, lang: 'pt', resolveAsset: () => '', editing: false }}>
      <PageView page={page} />
    </RenderContext.Provider>,
  );
};

describe('estrutura acessível da página', () => {
  const { data } = migrate(loadFixture('template-v3.json'));

  it('toda página tem exatamente um h1', () => {
    for (const page of data.pages.filter((p) => p.kind !== 'template')) {
      const html = render(data, page.id);
      expect(html.match(/<h1/g)?.length ?? 0, `página ${page.id}`).toBe(1);
    }
  });

  it('na Home o h1 diz quem é o dono do site, não "Home"', () => {
    expect(render(data, 'home')).toContain(data.site.name.pt);
  });

  it('o h1 automático é invisível: não mexe no desenho da página', () => {
    expect(render(data, 'home')).toMatch(/<h1 class="sr-only"/);
  });

  it('se o conteúdo já tem um título nível 1, não entra outro', () => {
    const copia: PortfolioV4 = JSON.parse(JSON.stringify(data));
    const page = copia.pages.find((p) => p.id === 'home')!;
    page.sections[0]!.blocks.unshift({
      id: 'h1-proprio', type: 'heading', visibility: 'public', span: 12,
      content: { text: { pt: 'Meu título', en: 'My title' }, level: 1 },
    });
    const html = render(copia, 'home');
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).toContain('Meu título');
    expect(html).not.toContain('sr-only');
  });
});
