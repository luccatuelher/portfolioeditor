import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { deleteVersion, listVersions, loadVersion, MAX_VERSIONS, saveVersion } from '../src/editor/versions';
import { loadFixture } from './helpers/fixtures';

const doc = (name: string) => {
  const { data } = migrate(loadFixture('legacy-synthetic-v3.json'));
  return { ...data, site: { ...data.site, name: { pt: name, en: name } } };
};

describe('histórico de versões', () => {
  it('salva, lista da mais nova para a mais velha, restaura e apaga', async () => {
    const a = await saveVersion('Antes da reforma', doc('A'));
    await new Promise((r) => setTimeout(r, 2));
    const b = await saveVersion('Depois da reforma', doc('B'));

    const list = await listVersions();
    expect(list.map((v) => v.id).slice(0, 2)).toEqual([b.id, a.id]);

    expect((await loadVersion(a.id))?.site.name.pt).toBe('A');
    await deleteVersion(a.id);
    expect(await loadVersion(a.id)).toBeNull();
    expect((await listVersions()).some((v) => v.id === a.id)).toBe(false);
  });

  it('ao estourar o teto, descarta as automáticas antes das salvas à mão', async () => {
    for (const v of await listVersions()) await deleteVersion(v.id);
    const manual = await saveVersion('Minha versão', doc('M'));
    for (let i = 0; i < MAX_VERSIONS + 3; i++) await saveVersion(`Publicado ${i}`, doc(`P${i}`), true);

    const list = await listVersions();
    expect(list).toHaveLength(MAX_VERSIONS);
    expect(list.some((v) => v.id === manual.id)).toBe(true);
    expect((await loadVersion(manual.id))?.site.name.pt).toBe('M');
  });
});
