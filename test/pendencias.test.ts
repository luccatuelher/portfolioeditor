import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { imagensSemDescricao } from '../src/editor/pendencias';
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
