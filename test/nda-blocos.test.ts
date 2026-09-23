import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { mergeNda, ndaCount, publicSnapshot } from '../src/publish/publicSnapshot';
import { buildPublishPayload } from '../src/publish/buildPayload';
import { decryptNda } from '../src/publish/nda';
import type { Block, PortfolioV4 } from '../src/schema/v4';
import { loadFixture } from './helpers/fixtures';

// Bloco marcado NDA fora de um item NDA: sai do público, vai cifrado e volta
// para o mesmo lugar quando o visitante digita a senha.
describe('blocos NDA soltos', () => {
  const base = migrate(loadFixture('legacy-synthetic-v3.json')).data;
  const bloco = (id: string, visibility: Block['visibility']): Block => ({ id, type: 'divider', span: 12, visibility, content: {} }) as unknown as Block;
  const montar = (): PortfolioV4 => {
    const d = structuredClone(base);
    const home = d.pages.find((p) => p.id === 'home')!;
    home.sections[0]!.blocks.push(bloco('x_pub1', 'public'), bloco('x_nda1', 'nda'), bloco('x_nda2', 'nda'), bloco('x_rasc', 'draft'), bloco('x_pub2', 'public'));
    const pub = d.collections.projects.find((p) => p.visibility === 'public')!;
    pub.sections[0]!.blocks.unshift(bloco('x_nda_proj', 'nda'));
    const secreto = d.collections.projects.find((p) => p.visibility === 'nda')!;
    secreto.sections[0]!.blocks.push(bloco('x_nda_no_nda', 'nda'), bloco('x_rasc_no_nda', 'draft'));
    return d;
  };
  const ordem = (d: PortfolioV4): string[] => d.pages.find((p) => p.id === 'home')!.sections[0]!.blocks.map((b) => b.id).filter((id) => id.startsWith('x_'));

  it('o público não leva nenhum bloco NDA nem rascunho', () => {
    const { data } = publicSnapshot(montar());
    const json = JSON.stringify(data);
    for (const id of ['x_nda1', 'x_nda2', 'x_rasc', 'x_nda_proj', 'x_nda_no_nda']) expect(json).not.toContain(id);
    expect(ordem(data)).toEqual(['x_pub1', 'x_pub2']);
  });

  it('desbloqueado, cada bloco volta ao lugar (inclusive dois seguidos e no início da seção)', () => {
    const doc = montar();
    const { data, nda } = publicSnapshot(doc);
    expect(nda.blocks!.map((b) => b.block.id)).toEqual(['x_nda1', 'x_nda2', 'x_nda_proj']);
    const aberto = mergeNda(data, nda);
    expect(ordem(aberto)).toEqual(['x_pub1', 'x_nda1', 'x_nda2', 'x_pub2']);
    const proj = aberto.collections.projects.find((p) => p.id === doc.collections.projects.find((x) => x.visibility === 'public')!.id)!;
    expect(proj.sections[0]!.blocks[0]!.id).toBe('x_nda_proj');
  });

  it('dentro de um projeto NDA, o bloco NDA vai junto e o rascunho fica', () => {
    const { nda } = publicSnapshot(montar());
    const ids = nda.projects.flatMap((p) => p.sections.flatMap((s) => s.blocks.map((b) => b.id)));
    expect(ids).toContain('x_nda_no_nda');
    expect(ids).not.toContain('x_rasc_no_nda');
  });

  it('se o bloco de antes sumiu, vai para o fim da seção; seção que não existe é ignorada', () => {
    const { data, nda } = publicSnapshot(montar());
    const perdido = { ...nda, blocks: [{ ...nda.blocks![0]!, afterId: 'nao-existe' }, { ...nda.blocks![1]!, sectionId: 'secao-fantasma' }] };
    const aberto = mergeNda(data, perdido);
    expect(ordem(aberto)).toEqual(['x_pub1', 'x_pub2', 'x_nda1']);
  });

  it('só bloco NDA (nenhum item NDA) já pede senha e vai no pacote cifrado', async () => {
    const d = structuredClone(base);
    for (const k of ['projects', 'blog', 'gallery', 'sketches'] as const) d.collections[k] = d.collections[k].filter((i) => i.visibility !== 'nda') as never;
    d.pages.find((p) => p.id === 'home')!.sections[0]!.blocks.push(bloco('x_so_bloco', 'nda'));
    expect(ndaCount(publicSnapshot(d).nda)).toBe(1);
    const out = await buildPublishPayload({ data: d, assets: [] }, 'senha-bem-longa-1');
    expect(out.ndaBlob).not.toBeNull();
    const aberto = await decryptNda<{ items: { blocks: { block: Block }[] } }>(out.ndaBlob!, 'senha-bem-longa-1');
    expect(aberto.items.blocks.map((b) => b.block.id)).toEqual(['x_so_bloco']);
  });
});
