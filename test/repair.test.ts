import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { repairDoc } from '../src/migrate/repair';
import { loadFixture } from './helpers/fixtures';

describe('repairDoc', () => {
  const { data } = migrate(loadFixture('template-v3.json'));

  it('documento válido passa sem ajustes', () => {
    const r = repairDoc(data);
    expect(r.doc).not.toBeNull();
    expect(r.fixes).toEqual([]);
  });

  it('campo que não existe mais é removido, o resto preservado', () => {
    const raw = structuredClone(data) as unknown as { collections: { projects: Record<string, unknown>[] }; site: { name: { pt: string } } };
    raw.collections.projects[0]!['span'] = 3; // campo de uma versão anterior
    raw.site.name.pt = 'Meu Nome';
    const r = repairDoc(raw);
    expect(r.doc?.site.name.pt).toBe('Meu Nome');
    expect(r.doc?.collections.projects.length).toBe(data.collections.projects.length);
    expect(r.fixes.some((f) => f.includes('span'))).toBe(true);
    expect(raw.collections.projects[0]!['span']).toBe(3); // não muta a entrada
  });

  it('bloco quebrado é removido sem derrubar a página', () => {
    const raw = structuredClone(data) as unknown as { pages: { sections: { blocks: unknown[] }[] }[] };
    const blocks = raw.pages[0]!.sections[0]!.blocks;
    const before = blocks.length;
    blocks.push({ id: 'x', type: 'nao-existe' });
    const r = repairDoc(raw);
    expect(r.doc?.pages[0]!.sections[0]!.blocks.length).toBe(before);
  });
});

describe('repairDoc — valores nulos', () => {
  it('opcional com null é removido (caso do site publicado em branco)', () => {
    const { data } = migrate(loadFixture('template-v3.json'));
    const raw = structuredClone(data) as unknown as { collections: { projects: Record<string, unknown>[] } };
    raw.collections.projects[0]!['preview'] = { items: [], hideDescription: null };
    const r = repairDoc(raw);
    expect(r.doc).not.toBeNull();
    expect(r.doc?.collections.projects[0]?.preview).toEqual({ items: [] });
  });
});
