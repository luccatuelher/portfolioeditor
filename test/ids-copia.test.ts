import { describe, expect, it } from 'vitest';
import { renewItemIds, renewSectionIds } from '../src/editor/blockFactory';
import type { ProjectItem, Section } from '../src/schema/v4';

// Colar ou duplicar (Ctrl+D) cria uma cópia independente: nada da cópia
// pode dividir id com o original.
describe('ids da cópia', () => {
  const secao = (id: string, blocos: string[]): Section => ({
    id,
    style: { width: 'normal' },
    blocks: blocos.map((b) => ({ id: b, type: 'divider', span: 12, visibility: 'public', content: {} }) as unknown as Section['blocks'][number]),
  });

  it('seção copiada ganha ids novos para ela e para cada bloco', () => {
    const s = secao('s_a', ['b_1', 'b_2']);
    const mapa = renewSectionIds(s);
    expect(s.id).not.toBe('s_a');
    expect(s.blocks.map((b) => b.id)).not.toContain('b_1');
    expect(new Set(s.blocks.map((b) => b.id)).size).toBe(2);
    expect(mapa.get('b_1')).toBe(s.blocks[0]!.id);
  });

  it('projeto copiado: item, seções e blocos novos; a prévia aponta os blocos da cópia', () => {
    const original = {
      id: 'proj_x',
      sections: [secao('s_a', ['b_1', 'b_2']), secao('s_b', ['b_3'])],
      preview: { items: [{ ref: 'b_3', span: 6 }, { ref: 'b_1', span: 12 }] },
    } as unknown as ProjectItem;
    const copia = renewItemIds(structuredClone(original), 'projects');

    expect(copia.id).toMatch(/^proj_/);
    expect(copia.id).not.toBe(original.id);
    const antigos = new Set([...original.sections.map((s) => s.id), ...original.sections.flatMap((s) => s.blocks.map((b) => b.id))]);
    for (const s of copia.sections) {
      expect(antigos.has(s.id)).toBe(false);
      for (const b of s.blocks) expect(antigos.has(b.id)).toBe(false);
    }
    const blocosCopia = copia.sections.flatMap((s) => s.blocks);
    expect(copia.preview!.items.map((i) => i.ref)).toEqual([blocosCopia[2]!.id, blocosCopia[0]!.id]);
    // O original não foi tocado.
    expect(original.preview!.items[0]!.ref).toBe('b_3');
  });
});
