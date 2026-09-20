import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { computeTargetSize, dataUrlToBlob, importImage } from '../src/assets/importImage';
import { deleteAsset, getAsset, getThumb, listAssetIds, openDb, putAsset } from '../src/assets/assetStore';

describe('computeTargetSize', () => {
  it('reduz para caber no lado máximo, mantendo proporção', () => {
    expect(computeTargetSize(4000, 2000, 2400)).toEqual({ w: 2400, h: 1200, scale: 0.6 });
  });
  it('nunca amplia imagens menores', () => {
    expect(computeTargetSize(800, 600, 2400)).toEqual({ w: 800, h: 600, scale: 1 });
  });
  it('lida com dimensões degeneradas', () => {
    expect(computeTargetSize(0, 0, 2400)).toEqual({ w: 0, h: 0, scale: 1 });
  });
});

describe('dataUrlToBlob', () => {
  it('decodifica data URL base64 em Blob do mime certo', () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const blob = dataUrlToBlob(png);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('importImage (canvas injetado)', () => {
  it('redimensiona e recodifica em WebP + thumbnail', async () => {
    const env = {
      createImageBitmap: async () => ({ width: 4000, height: 2000, close() {} }),
      makeCanvas: (w: number, h: number) => ({
        getContext: () => ({ drawImage() {} }),
        convertToBlob: async (opts: { type: string; quality: number }) =>
          new Blob([new Uint8Array(Math.max(1, Math.round(w * h / 1000)))], { type: opts.type }),
      }),
    };
    const r = await importImage(new Blob(['x']), { maxSide: 2400, thumbSide: 480 }, env);
    expect(r.mime).toBe('image/webp');
    expect(r.w).toBe(2400);
    expect(r.h).toBe(1200);
    expect(r.blob.type).toBe('image/webp');
    expect(r.thumb.type).toBe('image/webp');
    expect(r.thumb.size).toBeLessThan(r.blob.size); // thumb menor
  });
});

describe('assetStore (fake-indexeddb)', () => {
  it('grava e lê Blobs de asset + thumbnail em stores separadas', async () => {
    const db = await openDb(new IDBFactory());
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' });
    const thumb = new Blob([new Uint8Array([9])], { type: 'image/webp' });
    await putAsset(db, 'asset_x', blob, thumb);

    expect((await getAsset(db, 'asset_x'))?.size).toBe(4);
    expect((await getThumb(db, 'asset_x'))?.size).toBe(1);
    expect(await listAssetIds(db)).toEqual(['asset_x']);

    await deleteAsset(db, 'asset_x');
    expect(await getAsset(db, 'asset_x')).toBeUndefined();
    expect(await listAssetIds(db)).toEqual([]);
    db.close();
  });
});
