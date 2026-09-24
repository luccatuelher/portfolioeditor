import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { clearLocalDraft, loadLocalDraft, manterImagensEmUso, podarImagensGravadas, saveLocalAssets, saveLocalDoc } from '../src/editor/localDraft';
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

describe('imagens: um registro por imagem', () => {
  const chaves = async (): Promise<string[]> => {
    const db = await openDb();
    return new Promise((ok, erro) => {
      const req = db.transaction(STORE_DRAFTS, 'readonly').objectStore(STORE_DRAFTS).getAllKeys();
      req.onsuccess = () => ok(req.result.map(String));
      req.onerror = () => erro(req.error);
    });
  };

  it('enviar uma imagem grava só ela, ao lado das que já estavam', async () => {
    await clearLocalDraft();
    await saveLocalAssets({ asset_1: 'data:1' });
    await saveLocalAssets({ asset_1: 'data:1', asset_2: 'data:2' });
    const k = (await chaves()).filter((c) => c.startsWith('editor-asset'));
    expect(k.sort()).toEqual(['editor-asset:asset_1', 'editor-asset:asset_2']);
  });

  it('gravação atrasada (mapa antigo, menor) não apaga imagem nova', async () => {
    await clearLocalDraft();
    await saveLocalAssets({ asset_1: 'data:1', asset_novo: 'data:n' });
    await saveLocalAssets({ asset_1: 'data:1' }); // chegou depois
    const { data } = migrate(loadFixture('legacy-synthetic-v3.json'));
    await saveLocalDoc(data);
    expect((await loadLocalDraft())?.assets).toEqual({ asset_1: 'data:1', asset_novo: 'data:n' });
  });

  it('formato antigo (mapa num registro só) continua sendo lido e vira registros próprios', async () => {
    await clearLocalDraft();
    const db = await openDb();
    await new Promise<void>((ok, erro) => {
      const t = db.transaction(STORE_DRAFTS, 'readwrite');
      t.objectStore(STORE_DRAFTS).put({ assets: { asset_velho: 'data:v' }, savedAt: 1 }, 'editor-assets');
      t.oncomplete = () => ok();
      t.onerror = () => erro(t.error);
    });
    const { data } = migrate(loadFixture('legacy-synthetic-v3.json'));
    await saveLocalDoc(data);
    const lido = await loadLocalDraft();
    expect(lido?.assets).toEqual({ asset_velho: 'data:v' });
    await saveLocalAssets(lido!.assets);
    const k = await chaves();
    expect(k).toContain('editor-asset:asset_velho');
    expect(k).not.toContain('editor-assets');
    expect((await loadLocalDraft())?.assets).toEqual({ asset_velho: 'data:v' });
  });

  it('a poda da abertura apaga só o que não fica', async () => {
    await clearLocalDraft();
    await saveLocalAssets({ fica: 'data:f', sai: 'data:s' });
    await podarImagensGravadas({ fica: 'data:f' });
    expect((await chaves()).filter((c) => c.startsWith('editor-asset'))).toEqual(['editor-asset:fica']);
  });
});
