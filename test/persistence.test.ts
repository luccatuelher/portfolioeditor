import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { listAssetIds, openDb, putAsset } from '../src/assets/assetStore';
import { createPersister, readDraft, writeDraft } from '../src/persistence/draftStore';
import { migrate } from '../src/migrate/migrate';
import { loadFixture } from './helpers/fixtures';

const migrated = () => migrate(loadFixture('legacy-synthetic-v3.json')).data;

describe('draftStore', () => {
  it('grava e recupera o rascunho v4', async () => {
    const db = await openDb(new IDBFactory());
    const data = migrated();
    await writeDraft(db, 'current', data);
    const rec = await readDraft(db, 'current');
    expect(rec?.data).toEqual(data);
    expect(typeof rec?.savedAt).toBe('number');
    db.close();
  });

  it('o rascunho não contém Blobs nem data: URLs de imagem', async () => {
    const db = await openDb(new IDBFactory());
    const data = migrated();
    await writeDraft(db, 'current', data);
    const rec = await readDraft(db, 'current');
    // data.assets guarda só metadados (mime/w/h/alt); nenhum base64 de imagem.
    expect(JSON.stringify(rec?.data)).not.toContain('data:image');
    db.close();
  });

  it('editar texto persiste o rascunho sem tocar no asset store', async () => {
    const db = await openDb(new IDBFactory());
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' });
    await putAsset(db, 'asset_pre', blob);

    const data = migrated();
    const persister = createPersister({ db, delay: 5 });

    data.site.name.pt = 'Novo nome';
    persister.queue(data);
    await persister.flush();

    data.site.name.pt = 'Outro nome';
    persister.queue(data);
    await persister.flush();

    expect(persister.writes).toBe(2);
    // Nenhuma escrita de asset foi provocada pela edição de texto.
    expect(await listAssetIds(db)).toEqual(['asset_pre']);
    const rec = await readDraft(db, 'current');
    expect(rec?.data.site.name.pt).toBe('Outro nome');
    persister.destroy();
    db.close();
  });

  it('debounce: várias chamadas queue geram uma escrita', async () => {
    const db = await openDb(new IDBFactory());
    const data = migrated();
    const persister = createPersister({ db, delay: 5 });
    persister.queue(data);
    persister.queue(data);
    persister.queue(data);
    await persister.flush();
    expect(persister.writes).toBe(1);
    persister.destroy();
    db.close();
  });
});
