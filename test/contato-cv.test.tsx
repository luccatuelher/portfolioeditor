import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { migrate } from '../src/migrate/migrate';
import { loadFixture } from './helpers/fixtures';
import { SectionView } from '../src/renderer/blocks';
import { RenderContext } from '../src/renderer/context';
import { arquivosAoLado, runPreflight } from '../src/publish/preflight';
import type { Block, PortfolioV4, Section } from '../src/schema/v4';

const { data } = migrate(loadFixture('template-v3.json'));

const contato = (extra: Partial<Record<string, unknown>> = {}): Block =>
  ({
    id: 'c', type: 'contact', visibility: 'public', span: 12,
    content: {
      heading: { pt: 'Vamos conversar', en: "Let's talk" },
      body: { pt: 'Disponível', en: 'Available' },
      email: 'oi@exemplo.com',
      phone: '+55 48 99999-0000',
      cvLabel: { pt: 'Baixar CV', en: 'Download CV' },
      cvHref: '',
      socials: [{ label: 'LinkedIn', href: 'https://linkedin.com/in/lucca' }, { label: 'Instagram', href: '#' }],
      ...extra,
    },
  } as Block);

const render = (bloco: Block, editing = false): string => {
  const secao: Section = { id: 's', style: { width: 'normal' }, blocks: [bloco] };
  return renderToStaticMarkup(
    <RenderContext.Provider value={{ data, lang: 'pt', resolveAsset: () => '', editing }}>
      <SectionView section={secao} />
    </RenderContext.Provider>,
  );
};

describe('links do bloco de contato', () => {
  it('rede social abre em outra aba, sem deixar a página exposta', () => {
    const html = render(contato());
    expect(html).toContain('href="https://linkedin.com/in/lucca"');
    expect(html).toMatch(/linkedin[^>]*target="_blank"|target="_blank"[^>]*linkedin/);
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('rede sem link não vira link no site — mas continua visível no editor', () => {
    expect(render(contato())).not.toContain('Instagram');
    const noEditor = render(contato(), true);
    expect(noEditor).toContain('Instagram');
    expect(noEditor).toContain('sem-link');
  });

  it('botão sem link segue a mesma regra: some do site, aparece riscado no editor', () => {
    const botao = (href: string): Block => ({ id: 'bt', type: 'button', visibility: 'public', span: 4, content: { label: { pt: 'Baixar CV', en: '' }, href, variant: 'solid' } });
    for (const vazio of ['', '#', '  ']) {
      const site = render(botao(vazio));
      expect(site, `href "${vazio}"`).not.toContain('Baixar CV');
      expect(site).not.toContain('href="#"');
      const noEditor = render(botao(vazio), true);
      expect(noEditor).toContain('Baixar CV');
      expect(noEditor).toContain('sem-link');
    }
    expect(render(botao('https://exemplo.com/cv.pdf'))).toContain('href="https://exemplo.com/cv.pdf"');
  });

  it('e-mail e telefone continuam na mesma aba (é o app do aparelho que abre)', () => {
    const html = render(contato());
    const mail = html.match(/<a[^>]*mailto:[^>]*>/)?.[0] ?? '';
    expect(mail).not.toContain('target=');
    expect(html).toContain('href="tel:+5548999990000"');
  });

  it('CV em endereço https abre em outra aba e já pede download', () => {
    const html = render(contato({ cvHref: 'https://exemplo.com/cv.pdf' }));
    expect(html).toContain('target="_blank"');
    expect(html).toContain('download');
  });
});

describe('preflight avisa do CV que não vai funcionar', () => {
  const comContato = (cvHref: string): PortfolioV4 => {
    const doc: PortfolioV4 = JSON.parse(JSON.stringify(data));
    // Tira os blocos de contato que já vêm no exemplo: senão o aviso poderia
    // vir do CV DELES e o teste passaria sem provar nada.
    for (const pg of doc.pages) pg.sections = pg.sections.map((s) => ({ ...s, blocks: s.blocks.filter((b) => b.type !== 'contact') }));
    doc.pages[0]!.sections = [{ id: 's', style: { width: 'normal' }, blocks: [contato({ cvHref })] }];
    return doc;
  };

  it('caminho relativo é avisado (o site é um arquivo só)', () => {
    const avisos = runPreflight(comContato('cv.pdf'), {}).warnings.join(' | ');
    expect(avisos).toContain('cv.pdf');
    expect(avisos).toContain('arquivo só');
  });

  it('endereço https completo não gera aviso', () => {
    const avisos = runPreflight(comContato('https://exemplo.com/cv.pdf'), {}).warnings.join(' | ');
    expect(avisos).not.toContain('cv.pdf');
  });

  it('sem CV, nada a avisar', () => {
    expect(runPreflight(comContato(''), {}).warnings.join(' | ')).not.toContain('CV aponta');
  });
});

describe('arquivos que vão ao lado do index.html', () => {
  const { data } = migrate(loadFixture('template-v3.json'));
  const comBlocos = (blocos: Block[]): PortfolioV4 => {
    const doc: PortfolioV4 = JSON.parse(JSON.stringify(data));
    for (const pg of doc.pages) pg.sections = [];
    for (const k of ['projects', 'blog'] as const) for (const it of doc.collections[k]) it.sections = [];
    doc.pages[0]!.sections = [{ id: 's', style: { width: 'normal' }, blocks: blocos }];
    return doc;
  };
  const botao = (href: string, visibility: Block['visibility'] = 'public'): Block =>
    ({ id: `b${href}`, type: 'button', span: 4, visibility, content: { label: { pt: 'x', en: 'x' }, href, variant: 'solid' } }) as Block;

  it('lista CV e botões com caminho relativo; ignora https, mailto, links internos e rascunhos', () => {
    const doc = comBlocos([
      contato({ cvHref: './cv.pdf' }),
      botao('portfolio.pdf'),
      botao('https://exemplo.com/a.pdf'),
      botao('mailto:eu@exemplo.com'),
      botao('#projects'),
      botao('rascunho.pdf', 'draft'),
    ]);
    expect(arquivosAoLado(doc).sort()).toEqual(['cv.pdf', 'portfolio.pdf']);
  });

  it('sem nada relativo, lista vazia', () => {
    expect(arquivosAoLado(comBlocos([botao('https://exemplo.com')]))).toEqual([]);
  });
});
