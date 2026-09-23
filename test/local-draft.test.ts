import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { loadLocalDraft, manterImagensEmUso, saveLocalAssets, saveLocalDoc } from '../src/editor/localDraft';
import { saveVersion } from '../src/editor/versions';
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

  it('ao abrir, poda só as imagens que nem o documento nem as versões usam', async () => {
    const { data } = migrate(loadFixture('legacy-synthetic-v3.json'));
    const comImagem = (id: string) => ({ ...data, site: { ...data.site, favicon: { assetId: id, alt: { pt: '', en: '' } } } });
    await saveVersion('antiga', comImagem('asset_da_versao'));
    const mapa = { asset_do_doc: 'data:a', asset_da_versao: 'data:b', asset_orfao: 'data:c' };
    const podado = await manterImagensEmUso(comImagem('asset_do_doc'), mapa);
    expect(podado).toEqual({ asset_do_doc: 'data:a', asset_da_versao: 'data:b' });
  });
});
