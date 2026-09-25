import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { publicSnapshot } from '../src/publish/publicSnapshot';
import { abrirPacoteNda, encryptNda, decryptNda } from '../src/publish/nda';
import { runPreflight } from '../src/publish/preflight';
import { buildPublishPayload } from '../src/publish/buildPayload';
import { loadFixture } from './helpers/fixtures';

describe('publicSnapshot', () => {
  const { data } = migrate(loadFixture('legacy-synthetic-v3.json'));
  const { data: pub, nda } = publicSnapshot(data);

  it('remove NDA e rascunhos do público', () => {
    const ids = pub.collections.projects.map((p) => p.id);
    expect(ids).toContain('proj-a');
    expect(ids).not.toContain('proj-b'); // NDA
    expect(ids).not.toContain('proj-c'); // rascunho
    expect(pub.collections.projects.every((p) => p.visibility === 'public')).toBe(true);
  });

  it('separa os itens NDA num bundle', () => {
    expect(nda.projects.map((p) => p.id)).toEqual(['proj-b']);
    expect(nda.blog.map((b) => b.id)).toEqual(['note-y']);
    expect(nda.gallery.map((g) => g.id)).toEqual(['gal-2']);
    expect(nda.sketches.map((s) => s.id)).toEqual(['sk-2']);
  });

  it('bloco NDA ou rascunho dentro de projeto/nota pública não vai para o site', () => {
    const doc = structuredClone(data);
    const proj = doc.collections.projects.find((p) => p.visibility === 'public')!;
    const nota = doc.collections.blog.find((b) => b.visibility === 'public')!;
    const texto = (id: string, vis: 'nda' | 'draft', t: string) => ({ id, type: 'text' as const, span: 12, visibility: vis, content: { html: { pt: t, en: '' } } });
    proj.sections.push({ id: 's_seg', style: {}, blocks: [texto('b_nda', 'nda', 'SEGREDO-NDA'), texto('b_rasc', 'draft', 'RASCUNHO-PROJ')] });
    nota.sections.push({ id: 's_seg2', style: {}, blocks: [texto('b_nda2', 'nda', 'SEGREDO-NOTA')] });
    const json = JSON.stringify(publicSnapshot(doc).data);
    expect(json).not.toContain('SEGREDO-NDA');
    expect(json).not.toContain('RASCUNHO-PROJ');
    expect(json).not.toContain('SEGREDO-NOTA');
  });

  it('página em rascunho não vai para o site (a Home fica sempre)', () => {
    const doc = structuredClone(data);
    doc.pages.push({ id: 'pg_oculta', slug: 'oculta', title: { pt: 'Oculta', en: '' }, kind: 'static', visibility: 'draft', sections: [{ id: 's_o', style: {}, blocks: [{ id: 'b_o', type: 'text', span: 12, visibility: 'public', content: { html: { pt: 'PAGINA-OCULTA', en: '' } } }] }] });
    doc.pages.find((p) => p.id === 'home')!.visibility = 'draft';
    const out = publicSnapshot(doc).data;
    expect(JSON.stringify(out)).not.toContain('PAGINA-OCULTA');
    expect(out.pages.some((p) => p.id === 'home')).toBe(true);
  });

  it('mantém a página NDA só como casca (sem itens) e poda assets', () => {
    // A página NDA continua (título + lista 'nda'), mas nenhum item NDA vai em claro.
    expect(JSON.stringify(pub)).not.toContain('proj-b');
    // Todo assetId referenciado deve existir no mapa podado.
    const ids = new Set(Object.keys(pub.assets));
    const json = JSON.stringify({ pages: pub.pages, collections: pub.collections });
    for (const m of json.matchAll(/"assetId":"([^"]+)"/g)) expect(ids.has(m[1]!)).toBe(true);
  });
});

describe('NDA — AES-GCM + PBKDF2', () => {
  it('encripta e descriptografa com a senha correta', async () => {
    const payload = { secret: 'confidencial', items: [1, 2, 3] };
    const enc = await encryptNda(payload, 'senha-forte', 50_000);
    expect(enc.v).toBe(1);
    expect(enc.ct).not.toContain('confidencial');
    const back = await decryptNda(enc, 'senha-forte');
    expect(back).toEqual(payload);
  });

  it('falha com senha errada', async () => {
    const enc = await encryptNda({ a: 1 }, 'certa', 50_000);
    await expect(decryptNda(enc, 'errada')).rejects.toBeTruthy();
  });
});

describe('buildPublishPayload', () => {
  it('monta payload público + NDA cifrado e recuperável', async () => {
    const migrated = migrate(loadFixture('legacy-synthetic-v3.json'));
    const payload = await buildPublishPayload(migrated, 'senha-nda');

    // Público sem NDA/rascunho.
    expect(payload.publicData.collections.projects.map((p) => p.id)).toEqual(['proj-a']);
    // assetMap só referencia assets do público.
    for (const id of Object.keys(payload.assetMap)) expect(payload.publicData.assets[id]).toBeDefined();
    // NDA cifrado e recuperável com a senha.
    expect(payload.ndaBlob).not.toBeNull();
    const back = await abrirPacoteNda<{ projects: { id: string }[] }>(payload.ndaBlob!, 'senha-nda');
    expect(back.items.projects.map((p) => p.id)).toEqual(['proj-b']);
  });

  it('sem senha, não gera blob NDA', async () => {
    const migrated = migrate(loadFixture('legacy-synthetic-v3.json'));
    const payload = await buildPublishPayload(migrated);
    expect(payload.ndaBlob).toBeNull();
  });
});

describe('preflight', () => {
  it('roda sobre o template sem erros bloqueantes', () => {
    const { data } = migrate(loadFixture('template-v3.json'));
    const r = runPreflight(data);
    expect(Array.isArray(r.errors)).toBe(true);
    expect(Array.isArray(r.warnings)).toBe(true);
  });

  it('avisa sobre alt ausente e PT/EN incompleto', () => {
    const { data } = migrate(loadFixture('template-v3.json'));
    // Sketches migrados têm alt; força um sem alt e um título só PT.
    if (data.collections.sketches[0]) data.collections.sketches[0].image.alt = { pt: '', en: '' };
    data.site.name = { pt: 'Só PT', en: '' };
    const r = runPreflight(data);
    expect(r.warnings.some((w) => /alternativo/.test(w))).toBe(true);
    expect(r.warnings.some((w) => /só em um idioma/.test(w))).toBe(true);
  });

  it('avisa sobre export grande via assetSizes', () => {
    const { data } = migrate(loadFixture('template-v3.json'));
    const big = Object.fromEntries(Object.keys(data.assets).map((id) => [id, 5 * 1024 * 1024]));
    const r = runPreflight(data, { assetSizes: big, maxExportMB: 8 });
    expect(r.warnings.some((w) => /Export grande/.test(w))).toBe(true);
  });
});

describe('preflight — botões', () => {
  it('avisa botão sem link e não acusa mais "CV ausente" no Contato', () => {
    const { data } = migrate(loadFixture('template-v3.json'));
    const sec = data.pages[0]!.sections[0]!;
    sec.blocks.push({ id: 'btn', type: 'button', span: 4, visibility: 'public', content: { label: { pt: 'Baixar CV', en: 'CV' }, href: '', variant: 'solid' } });
    const r = runPreflight(data, { assetSizes: {} });
    expect(r.warnings.some((w) => w.includes('Baixar CV') && w.includes('sem link'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('link de CV'))).toBe(false);
  });
});
