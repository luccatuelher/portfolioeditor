import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { loadLocalDraft, manterImagensEmUso, saveLocalAssets, saveLocalDoc } from '../src/editor/localDraft';
import { openDb, STORE_DRAFTS } from '../src/assets/assetStore';
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

  it('o registro do documento não carrega imagem (editar texto não regrava fotos)', async () => {
    const { data } = migrate(loadFixture('legacy-synthetic-v3.json'));
    await saveLocalAssets({ asset_y: 'data:image/png;base64,QUJD' });
    await saveLocalDoc(data);
    const db = await openDb();
    const chaves = await new Promise<IDBValidKey[]>((ok, erro) => {
      const req = db.transaction(STORE_DRAFTS, 'readonly').objectStore(STORE_DRAFTS).getAllKeys();
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });
    const registro = await new Promise<unknown>((ok, erro) => {
      const req = db.transaction(STORE_DRAFTS, 'readonly').objectStore(STORE_DRAFTS).get('editor-doc');
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });
    expect(chaves).toContain('editor-doc');
    expect(JSON.stringify(registro)).not.toContain('data:image');
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
