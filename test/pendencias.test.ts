import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { imagensSemDescricao, textosSemTraducao } from '../src/editor/pendencias';
import { loadFixture } from './helpers/fixtures';

describe('imagens sem descrição', () => {
  it('acha blocos de imagem, quadros, galeria e sketches publicados sem descrição — rascunho não', () => {
    const d = migrate(loadFixture('template-v3.json')).data;
    const semAlt = { pt: '', en: '' };
    const home = d.pages.find((p) => p.id === 'home')!;
    home.sections[0]!.blocks.push({ id: 'img1', type: 'image', span: 12, visibility: 'public', content: { image: { assetId: 'a1', alt: semAlt } } } as never);
    home.sections[0]!.blocks.push({ id: 'img2', type: 'image', span: 12, visibility: 'draft', content: { image: { assetId: 'a2', alt: semAlt } } } as never);
    home.sections[0]!.blocks.push({ id: 'img3', type: 'image', span: 12, visibility: 'public', content: { image: { assetId: 'a3', alt: { pt: 'Rua de noite', en: '' } } } } as never);
    const lista = imagensSemDescricao(d);
    const onde = lista.map((l) => l.onde);
    expect(onde.some((o) => o.startsWith('Imagem · página'))).toBe(true);
    // Rascunho e imagem já descrita ficam de fora.
    expect(lista.filter((l) => l.alvo.kind === 'block' && l.alvo.ref.blockId === 'img2')).toHaveLength(0);
    expect(lista.filter((l) => l.alvo.kind === 'block' && l.alvo.ref.blockId === 'img3')).toHaveLength(0);
    const a1 = lista.find((l) => l.alvo.kind === 'block' && l.alvo.ref.blockId === 'img1')!;
    expect(a1.alvo.kind === 'block' && a1.alvo.ref.container).toEqual({ on: 'page', pageId: 'home' });
  });
});

describe('textos sem tradução', () => {
  it('acha o texto que só tem um idioma, diz qual falta e onde — rascunho, vazio e HTML vazio não', () => {
    const d = migrate(loadFixture('template-v3.json')).data;
    const home = d.pages.find((p) => p.id === 'home')!;
    const base = textosSemTraducao(d).length;
    const h = (id: string, pt: string, en: string, visibility = 'public'): never => ({ id, type: 'heading', span: 12, visibility, content: { text: { pt, en }, level: 2 } }) as never;
    home.sections[0]!.blocks.push(h('t1', 'Trabalhos recentes', ''));
    home.sections[0]!.blocks.push(h('t2', '', 'Recent work'));
    home.sections[0]!.blocks.push(h('t3', 'Rascunho', '', 'draft'));
    home.sections[0]!.blocks.push(h('t4', '', ''));
    home.sections[0]!.blocks.push({ id: 't5', type: 'text', span: 12, visibility: 'public', content: { html: { pt: '<p>Olá</p>', en: '<p></p>' } } } as never);
    const lista = textosSemTraducao(d);
    expect(lista).toHaveLength(base + 3);
    const de = (id: string) => lista.find((l) => l.alvo.kind === 'block' && l.alvo.ref.blockId === id);
    expect(de('t1')).toMatchObject({ falta: 'en', trecho: 'Trabalhos recentes' });
    expect(de('t2')).toMatchObject({ falta: 'pt', trecho: 'Recent work' });
    expect(de('t3')).toBeUndefined();
    expect(de('t4')).toBeUndefined();
    expect(de('t5')).toMatchObject({ falta: 'en', trecho: 'Olá' });
  });

  it('vale para nome do site, título de página e de projeto', () => {
    const d = migrate(loadFixture('template-v3.json')).data;
    d.site.role = { pt: 'Diretora de arte', en: '' };
    const proj = d.collections.projects.find((p) => p.visibility !== 'draft')!;
    proj.title = { pt: 'Casa', en: '' };
    const lista = textosSemTraducao(d);
    expect(lista.some((l) => l.alvo.kind === 'site' && l.onde === 'função no cabeçalho')).toBe(true);
    expect(lista.some((l) => l.alvo.kind === 'item' && l.alvo.itemId === proj.id && l.onde.startsWith('título do projeto'))).toBe(true);
  });
});
