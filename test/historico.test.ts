import { describe, expect, it } from 'vitest';
import { createStore } from '../src/state/store';
import { migrate } from '../src/migrate/migrate';
import { rotuloDaMudanca } from '../src/editor/historyLabel';
import type { PortfolioV4 } from '../src/schema/v4';
import { loadFixture } from './helpers/fixtures';

// O botão de desfazer diz o que vai voltar: o rótulo sai dos próprios patches.
describe('rótulo da mudança no histórico', () => {
  const base = (): PortfolioV4 => migrate(loadFixture('template-v3.json')).data;
  const ultimo = (doc: PortfolioV4, recipe: (d: PortfolioV4) => void): string => {
    const store = createStore(doc);
    store.update(recipe);
    return rotuloDaMudanca(store.getState(), store.peekUndo()!.patches);
  };
  const home = (d: PortfolioV4) => d.pages.find((p) => p.id === 'home')!;
  const acharBloco = (d: PortfolioV4, tipo: string) => {
    for (const s of home(d).sections) for (const b of s.blocks) if (b.type === tipo) return b;
    throw new Error(tipo);
  };

  it('texto, largura e visibilidade de um elemento dizem o tipo do elemento', () => {
    expect(ultimo(base(), (d) => { const b = acharBloco(d, 'heading'); if (b.type === 'heading') b.content.text.pt = 'Outro'; })).toBe('texto de Título');
    expect(ultimo(base(), (d) => void (acharBloco(d, 'image').span = 6))).toBe('largura de Imagem');
    expect(ultimo(base(), (d) => void (acharBloco(d, 'image').visibility = 'draft'))).toBe('visibilidade de Imagem');
  });

  it('mover, adicionar e excluir elementos', () => {
    expect(ultimo(base(), (d) => { const s = home(d).sections.find((x) => x.blocks.length > 1)!; s.blocks.reverse(); })).toBe('ordem dos elementos');
    expect(ultimo(base(), (d) => void home(d).sections[0]!.blocks.push({ id: 'novo', type: 'divider', span: 12, visibility: 'public', content: {} } as never))).toBe('novo Divisor');
    expect(ultimo(base(), (d) => void home(d).sections[0]!.blocks.splice(0, 1))).toBe('exclusão de elemento');
  });

  it('tema, site e itens de coleção', () => {
    expect(ultimo(base(), (d) => void (d.theme.colors.accent = '#123456'))).toBe('cores do tema');
    expect(ultimo(base(), (d) => void (d.site.name.pt = 'Outro nome'))).toBe('nome do site');
    const proj = base().collections.projects[0]!;
    expect(ultimo(base(), (d) => void (d.collections.projects[0]!.featured = !proj.featured))).toBe(`projeto “${proj.title.pt}”`);
  });

  it('muitas partes de uma vez viram "várias mudanças"', () => {
    expect(ultimo(base(), (d) => { d.theme.colors.accent = '#000'; d.site.name.pt = 'x'; })).toBe('várias mudanças');
  });
});

describe('rótulo: excluir do meio de uma lista não é "ordem"', () => {
  it('tirar o primeiro de vários elementos continua sendo exclusão', () => {
    const doc = migrate(loadFixture('template-v3.json')).data;
    const store = createStore(doc);
    store.update((d) => {
      const s = d.pages.find((p) => p.id === 'home')!.sections.find((x) => x.blocks.length > 1)!;
      s.blocks.splice(0, 1);
    });
    expect(rotuloDaMudanca(store.getState(), store.peekUndo()!.patches)).toBe('exclusão de elemento');
  });
});
