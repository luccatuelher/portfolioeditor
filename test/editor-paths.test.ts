import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { createStore } from '../src/state/store';
import { findBlock, findSection, getSections, locateBlock, parentOf, type BlockRef, type Container } from '../src/editor/paths';
import { loadFixture } from './helpers/fixtures';
import type { PortfolioV4 } from '../src/schema/v4';

function firstBlock(data: PortfolioV4): { container: Container; ref: BlockRef } {
  const page = data.pages.find((p) => p.id === 'home')!;
  const container: Container = { on: 'page', pageId: 'home' };
  const section = page.sections.find((s) => s.blocks.length > 0)!;
  const block = section.blocks[0]!;
  return { container, ref: { container, sectionId: section.id, blockId: block.id } };
}

describe('editor/paths', () => {
  const { data } = migrate(loadFixture('template-v3.json'));

  it('getSections resolve página e item', () => {
    expect(getSections(data, { on: 'page', pageId: 'home' })).toBeDefined();
    const proj = data.collections.projects[0]!;
    expect(getSections(data, { on: 'item', collection: 'projects', itemId: proj.id })).toBe(proj.sections);
  });

  it('locateBlock encontra a seção que contém um bloco', () => {
    const { container, ref } = firstBlock(data);
    const found = locateBlock(data, container, ref.blockId);
    expect(found).toEqual(ref);
    expect(locateBlock(data, container, 'inexistente')).toBeNull();
  });

  it('findBlock / findSection', () => {
    const { ref } = firstBlock(data);
    expect(findBlock(data, ref)?.id).toBe(ref.blockId);
    expect(findSection(data, ref)?.id).toBe(ref.sectionId);
  });

  it('parentOf sobe bloco → seção → página → null', () => {
    const { ref } = firstBlock(data);
    const asBlock = { kind: 'block', ref } as const;
    const asSection = parentOf(asBlock);
    expect(asSection).toEqual({ kind: 'section', ref: { container: ref.container, sectionId: ref.sectionId } });
    const asPage = parentOf(asSection);
    expect(asPage).toEqual({ kind: 'page', pageId: 'home' });
    expect(parentOf(asPage)).toBeNull();
  });
});

describe('editor — mutação de bloco via store + undo', () => {
  it('edita um heading e desfaz', () => {
    const { data } = migrate(loadFixture('template-v3.json'));
    const store = createStore<PortfolioV4>(data);

    // Localiza o heading "Selected Work" na home.
    const container: Container = { on: 'page', pageId: 'home' };
    let ref: BlockRef | null = null;
    for (const s of store.getState().pages.find((p) => p.id === 'home')!.sections) {
      const h = s.blocks.find((b) => b.type === 'heading');
      if (h) { ref = { container, sectionId: s.id, blockId: h.id }; break; }
    }
    expect(ref).not.toBeNull();

    store.update((d) => {
      const b = findBlock(d, ref!);
      if (b && b.type === 'heading') b.content.text = { pt: 'Trabalho', en: 'Work' };
    });
    const after = findBlock(store.getState(), ref!);
    expect(after?.type === 'heading' && after.content.text.pt).toBe('Trabalho');

    store.undo();
    const reverted = findBlock(store.getState(), ref!);
    expect(reverted?.type === 'heading' && reverted.content.text.pt).not.toBe('Trabalho');
  });
});
