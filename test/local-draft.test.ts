import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { loadLocalDraft, saveLocalAssets, saveLocalDoc } from '../src/editor/localDraft';
import { loadFixture } from './helpers/fixtures';

describe('rascunho local do editor', () => {
  it('salvar o documento não regrava nem apaga as imagens', async () => {
    const { data } = migrate(loadFixture('legacy-synthetic-v3.json'));
    await saveLocalAssets({ asset_x: 'data:image/png;base64,QQ==' });
    const edited = { ...data, site: { ...data.site, name: { pt: 'Editado', en: 'Edited' } } };
    await saveLocalDoc(edited);
    const back = await loadLocalDraft();
    expect(back?.doc.site.name.pt).toBe('Editado');
    expect(back?.assets).toEqual({ asset_x: 'data:image/png;base64,QQ==' });
  });
});
