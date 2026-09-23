import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { migrate } from '../src/migrate/migrate';
import { RenderContext, type RenderContextValue } from '../src/renderer/context';
import { BlockView } from '../src/renderer/blocks';
import { dataUrlResolver } from '../src/renderer/dataUrlResolver';
import type { Block } from '../src/schema/v4';
import { loadFixture } from './helpers/fixtures';
import { projectCategory } from '../src/core/category';

describe('coleção de projetos — filtro fixo', () => {
  const { data } = migrate(loadFixture('template-v3.json'));
  data.collections.projects.forEach((p, i) => {
    p.visibility = 'public';
    p.meta['category'] = { pt: i === 0 ? 'personal' : 'professional', en: '' };
  });
  const ctx: RenderContextValue = { data, lang: 'pt', resolveAsset: dataUrlResolver([]), editing: false };
  const render = (content: Partial<Extract<Block, { type: 'collection' }>['content']>): string => {
    const block: Block = { id: 'c', type: 'collection', span: 12, visibility: 'public', content: { collection: 'projects', cols: 3, ...content } };
    return renderToStaticMarkup(<RenderContext.Provider value={ctx}><BlockView block={block} /></RenderContext.Provider>);
  };
  const cards = (html: string): number => (html.match(/class="project-card/g) ?? []).length;

  it('filtro fixo vale mesmo com os botões do visitante ligados', () => {
    expect(cards(render({ filter: 'personal', showFilter: true }))).toBe(1);
    expect(cards(render({ filter: 'personal' }))).toBe(1);
  });
  it('filtro fixo de categoria esconde os botões de categoria', () => {
    expect(render({ filter: 'personal', showFilter: true })).not.toContain('project-filter');
    expect(render({ filter: 'all', showFilter: true })).toContain('project-filter');
  });
});

describe('categoria do projeto — texto livre antigo', () => {
  const { data } = migrate(loadFixture('template-v3.json'));
  const valores = [{ pt: 'Profissional', en: '' }, { pt: '', en: 'Professional' }, { pt: 'pessoal ', en: 'personal' }, { pt: 'freelance', en: '' }];
  data.collections.projects.forEach((p, i) => {
    p.visibility = 'public';
    p.meta['category'] = valores[i % valores.length]!;
  });
  const ctx: RenderContextValue = { data, lang: 'pt', resolveAsset: dataUrlResolver([]), editing: false };
  const render = (filter: string): string => {
    const block: Block = { id: 'c', type: 'collection', span: 12, visibility: 'public', content: { collection: 'projects', cols: 3, filter: filter as 'all' } };
    return renderToStaticMarkup(<RenderContext.Provider value={ctx}><BlockView block={block} /></RenderContext.Provider>);
  };
  const cards = (html: string): number => (html.match(/class="project-card/g) ?? []).length;

  it('"Profissional", "Professional" (só em inglês) e "pessoal" entram no filtro certo', () => {
    const esperado = (cat: string): number => data.collections.projects.filter((_, i) => projectCategory(valores[i % valores.length]) === cat).length;
    expect(esperado('professional')).toBeGreaterThan(0);
    expect(cards(render('professional'))).toBe(esperado('professional'));
    expect(cards(render('personal'))).toBe(esperado('personal'));
  });

  it('reconhece as grafias comuns e deixa o resto sem categoria', () => {
    expect(projectCategory({ pt: 'Profissional', en: '' })).toBe('professional');
    expect(projectCategory({ pt: 'PROFISSIONAL', en: '' })).toBe('professional');
    expect(projectCategory({ pt: '', en: 'Professional work' })).toBe('professional');
    expect(projectCategory({ pt: 'Pessoal', en: '' })).toBe('personal');
    expect(projectCategory({ pt: 'autoral', en: '' })).toBe('personal');
    expect(projectCategory({ pt: 'freelance', en: '' })).toBeUndefined();
    expect(projectCategory(undefined)).toBeUndefined();
  });
});
