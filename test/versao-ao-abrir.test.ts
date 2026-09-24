import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { guardarAoAbrir, INTERVALO_AO_ABRIR_MS, listVersions, MAX_VERSIONS, saveVersion } from '../src/editor/versions';
import { loadFixture } from './helpers/fixtures';

const doc = (nome: string) => {
  const { data } = migrate(loadFixture('template-v3.json'));
  return { ...data, site: { ...data.site, name: { pt: nome, en: nome } } };
};

describe('versão "ao abrir o editor"', () => {
  it('guarda o ponto de volta da sessão — no máximo uma a cada 6 h, e só se mudou', async () => {
    const primeira = await guardarAoAbrir(doc('A'));
    expect(primeira?.name).toMatch(/^Ao abrir o editor/);
    expect(primeira?.auto).toBe(true);

    // Reabriu logo depois: já há ponto de volta recente.
    expect(await guardarAoAbrir(doc('B'))).toBeNull();

    const depois = Date.now() + INTERVALO_AO_ABRIR_MS + 1000;
    // Muito depois, mas nada mudou: não repete a mesma versão.
    expect(await guardarAoAbrir(doc('A'), depois)).toBeNull();
    // Muito depois e com mudança: guarda.
    expect(await guardarAoAbrir(doc('B'), depois)).not.toBeNull();
    expect((await listVersions()).filter((v) => v.name.startsWith('Ao abrir')).length).toBe(2);
  });

  it('é automática: sai antes das salvas à mão quando o limite enche', async () => {
    const mao = await saveVersion('Minha versão', doc('M'));
    const depois = Date.now() + INTERVALO_AO_ABRIR_MS + 1000;
    for (let i = 0; i < MAX_VERSIONS; i++) await saveVersion(`auto ${i}`, doc(`X${i}`), true);
    await guardarAoAbrir(doc('Z'), depois + 1);
    const lista = await listVersions();
    expect(lista.length).toBe(MAX_VERSIONS);
    expect(lista.some((v) => v.id === mao.id)).toBe(true);
  });
});
