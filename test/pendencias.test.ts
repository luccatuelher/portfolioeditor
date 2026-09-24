import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { imagensSemDescricao, textosSemTraducao } from '../src/editor/pendencias';
import { loadFixture } from './helpers/fixtures';
import { runPreflight } from '../src/publish/preflight';

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
    expect(lista.some((l) => l.alvo.kind === 'site' && l.campo === 'site.role' && l.onde === 'Função · cabeçalho')).toBe(true);
    expect(lista.some((l) => l.alvo.kind === 'item' && l.alvo.itemId === proj.id && l.campo === 'title' && l.onde.startsWith('Título · projeto'))).toBe(true);
  });
});

describe('imagens sem descrição: uma regra só', () => {
  it('a foto do Contato sem descrição entra na lista, com o campo certo', () => {
    const d = migrate(loadFixture('template-v3.json')).data;
    const home = d.pages.find((p) => p.id === 'home')!;
    home.sections[0]!.blocks.push({ id: 'c1', type: 'contact', span: 12, visibility: 'public', content: { heading: { pt: 'Oi', en: 'Hi' }, body: { pt: '', en: '' }, email: 'a@b.c', phone: '', cvHref: '', cvLabel: { pt: '', en: '' }, socials: [], image: { assetId: 'foto', alt: { pt: '', en: '' } } } } as never);
    const foto = imagensSemDescricao(d).find((l) => l.alvo.kind === 'block' && l.alvo.ref.blockId === 'c1');
    expect(foto).toMatchObject({ campo: 'content.image.alt' });
    expect(foto!.onde).toMatch(/^Foto do Contato · página/);
  });

  it('o aviso de publicação conta exatamente o que o painel lista (rascunho dentro de projeto não conta)', () => {
    const d = migrate(loadFixture('template-v3.json')).data;
    const proj = d.collections.projects.find((p) => p.visibility === 'public')!;
    proj.sections[0]!.blocks.push({ id: 'rasc', type: 'image', span: 12, visibility: 'draft', content: { image: { assetId: 'x', alt: { pt: '', en: '' } } } } as never);
    const n = imagensSemDescricao(d).length;
    expect(n).toBeGreaterThan(0);
    expect(imagensSemDescricao(d).some((l) => l.alvo.kind === 'block' && l.alvo.ref.blockId === 'rasc')).toBe(false);
    const aviso = runPreflight(d).warnings.find((w) => /sem descrição/.test(w));
    expect(aviso).toMatch(new RegExp(`^${n} imagem`));
  });
});
