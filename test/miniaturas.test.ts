import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { imagensEmGrade, miniId, soComoCapa, valeMiniatura, type GerarMiniatura } from '../src/core/miniaturas';
import { migrate } from '../src/migrate/migrate';
import { buildPublishPayload } from '../src/publish/buildPayload';
import { abrirPacoteNda } from '../src/publish/nda';
import type { NdaBundle } from '../src/publish/publicSnapshot';
import { assembleSiteHtml } from '../src/publish/assemble';
import { pesoDoSite } from '../src/publish/peso';
import { mapResolver } from '../src/renderer/dataUrlResolver';
import type { Block, PortfolioV4 } from '../src/schema/v4';
import { loadFixture } from './helpers/fixtures';

/**
 * Miniaturas das imagens em grade (cards, galeria, sketches, quadros): a Home
 * e as grades não carregam mais a foto inteira; o visualizador e o bloco
 * Imagem continuam com ela.
 */
const alt = { pt: '', en: '' };
/** Um PNG "grande" (só o cabeçalho diz 2400 × 1350) com recheio para ter peso. */
const pngGrande = (n: number): string => {
  const cab = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 9, 0x60, 0, 0, 5, 0x46, 8, 6, 0, 0, 0]);
  return `data:image/png;base64,${Buffer.concat([cab, Buffer.alloc(60_000, n)]).toString('base64')}`;
};

function comFotosGrandes(): { data: PortfolioV4; assets: { id: string; dataUrl: string; mime: string }[]; capa: string; bloco: string } {
  const { data, assets } = migrate(loadFixture('template-v3.json'));
  const capa = 'asset_capa_grande';
  const bloco = 'asset_bloco_grande';
  assets.push({ id: capa, dataUrl: pngGrande(1), mime: 'image/png' }, { id: bloco, dataUrl: pngGrande(2), mime: 'image/png' });
  data.assets[capa] = { mime: 'image/png', w: 0, h: 0, alt };
  data.assets[bloco] = { mime: 'image/png', w: 0, h: 0, alt };
  // A capa do 1º projeto (aparece na Home, em card) e um bloco Imagem de página inteira.
  data.collections.projects[0]!.thumb = { assetId: capa, alt };
  const img = data.collections.projects[0]!.sections.flatMap((s) => s.blocks).find((b): b is Extract<Block, { type: 'image' }> => b.type === 'image')!;
  img.content.image = { assetId: bloco, alt };
  return { data, assets, capa, bloco };
}

/** Gerador de mentira: devolve um data URL curto e conta as chamadas. */
function geradorFalso(): { gerar: GerarMiniatura; pedidos: number[] } {
  const pedidos: number[] = [];
  return { pedidos, gerar: async (_url, largura) => (pedidos.push(largura), `data:image/webp;base64,${Buffer.alloc(3000, 7).toString('base64')}`) };
}

describe('quais imagens ganham miniatura', () => {
  it('as que aparecem em grade — capas, galeria, sketches, quadros; não o bloco Imagem', () => {
    const { data, capa, bloco } = comFotosGrandes();
    const grade = imagensEmGrade(data);
    expect(grade.has(capa)).toBe(true);
    expect(grade.has(bloco)).toBe(false);
    for (const g of data.collections.gallery) if (g.image.assetId) expect(grade.has(g.image.assetId)).toBe(true);
  });

  it('só foto bem maior que a miniatura; SVG e GIF nunca', () => {
    expect(valeMiniatura({ mime: 'image/webp', w: 2400, h: 1350, alt })).toBe(true);
    expect(valeMiniatura({ mime: 'image/webp', w: 1000, h: 700, alt })).toBe(false);
    expect(valeMiniatura({ mime: 'image/svg+xml', w: 4000, h: 2000, alt })).toBe(false);
    expect(valeMiniatura({ mime: 'image/gif', w: 4000, h: 2000, alt })).toBe(false);
  });
});

describe('publicação com miniaturas', () => {
  it('a capa grande ganha miniatura; o bloco Imagem e os SVG, não', async () => {
    const { data, assets, capa, bloco } = comFotosGrandes();
    const g = geradorFalso();
    const p = await buildPublishPayload({ data, assets }, undefined, { miniatura: g.gerar });
    expect(p.assetMap[miniId(capa)]).toMatch(/^data:image\/webp/);
    // A capa só serve de card: com a miniatura pronta, a inteira não vai no arquivo.
    expect(p.assetMap[capa]).toBeUndefined();
    expect(p.assetSizes[capa]).toBeUndefined();
    expect(p.assetMap[miniId(bloco)]).toBeUndefined();
    expect(g.pedidos.every((l) => l === 960)).toBe(true);
    expect(Object.keys(p.assetMap).filter((k) => k.endsWith('-mini'))).toEqual([miniId(capa)]);
  });

  it('miniatura que não sai menor, ou que falha, fica de fora — as outras seguem', async () => {
    const { data, assets, capa } = comFotosGrandes();
    const semGanho = await buildPublishPayload({ data, assets }, undefined, { miniatura: async (url) => url });
    expect(semGanho.assetMap[miniId(capa)]).toBeUndefined();
    const falha = await buildPublishPayload({ data, assets }, undefined, { miniatura: async () => { throw new Error('canvas'); } });
    expect(falha.assetMap[miniId(capa)]).toBeUndefined();
    expect(falha.assetMap[capa]).toBeDefined(); // sem miniatura, a capa fica com a inteira
    expect(semGanho.assetMap[capa]).toBeDefined();
  });

  it('a capa que também é imagem de galeria ou bloco mantém a inteira (o visualizador a usa)', async () => {
    const { data, assets, capa } = comFotosGrandes();
    data.collections.gallery[0]!.image = { assetId: capa, alt };
    expect(soComoCapa(data).has(capa)).toBe(false);
    const p = await buildPublishPayload({ data, assets }, undefined, { miniatura: geradorFalso().gerar });
    expect(p.assetMap[miniId(capa)]).toBeDefined();
    expect(p.assetMap[capa]).toBeDefined();
  });

  it('sem gerador (publicação pela linha de comando): nada muda', async () => {
    const { data, assets } = comFotosGrandes();
    const p = await buildPublishPayload({ data, assets });
    expect(Object.keys(p.assetMap).some((k) => k.endsWith('-mini'))).toBe(false);
  });

  it('na Home, o card chega pela miniatura antes do runtime; a inteira nem vai (só capa)', async () => {
    const { data, assets, capa } = comFotosGrandes();
    const p = await buildPublishPayload({ data, assets }, undefined, { miniatura: geradorFalso().gerar });
    const html = assembleSiteHtml(readFileSync('src/publish/site-shell.html', 'utf8'), p);
    const root = html.slice(html.indexOf('<div id="root">'), html.indexOf('window.__PORTFOLIO_DATA__'));
    expect(root).toContain(`data-asset="${miniId(capa)}"`);
    expect(root).not.toContain(`data-asset="${capa}"`);
    const runtime = html.indexOf('<script type="module" async');
    expect(html.indexOf(`__IMG__("${miniId(capa)}",`)).toBeLessThan(runtime);
    expect(html).not.toContain(`__IMG__("${capa}",`); // só capa: a inteira nem vai no arquivo
  });

  it('peso com NDA: a miniatura do NDA entra, a inteira só-capa sai e some da lista de pesadas', () => {
    const { data, assets, capa } = comFotosGrandes();
    data.collections.projects[0]!.visibility = 'nda';
    const mapa = Object.fromEntries(assets.map((a) => [a.id, a.dataUrl]));
    const sem = pesoDoSite(data, mapa, 1000);
    const com = pesoDoSite(data, mapa, 1000, { miniaturas: true });
    expect(sem.imagens.some((i) => i.id === capa)).toBe(true);
    expect(com.imagens.some((i) => i.id === capa), 'a capa dispensada aparece como imagem a cortar').toBe(false);
    expect(com.total).toBeLessThan(sem.total);
  });

  it('peso mostrado no editor conta as miniaturas (só com a opção do editor)', () => {
    const { data, assets, capa } = comFotosGrandes();
    const mapa = Object.fromEntries(assets.map((a) => [a.id, a.dataUrl]));
    const sem = pesoDoSite(data, mapa, 1000).total;
    const com = pesoDoSite(data, mapa, 1000, { miniaturas: true }).total;
    // A miniatura entra e a inteira (só capa) sai.
    const esperado = Math.round(mapa[capa]!.length * (960 / 2400) ** 2) - mapa[capa]!.length;
    expect(com - sem).toBe(esperado);
  });
});

describe('miniaturas no conteúdo NDA', () => {
  const SENHA = 'senha-longa-de-teste-123';

  it('o pacote cifrado leva a miniatura da capa NDA e não a foto inteira (só capa); nada vaza para o público', async () => {
    const { data, assets, capa } = comFotosGrandes();
    data.collections.projects[0]!.visibility = 'nda';
    const p = await buildPublishPayload({ data, assets }, SENHA, { miniatura: geradorFalso().gerar });
    const aberto = await abrirPacoteNda<NdaBundle>(p.ndaBlob!, SENHA);
    expect(aberto.assets[miniId(capa)]).toMatch(/^data:image\/webp/);
    expect(aberto.assets[capa]).toBeUndefined();
    const html = assembleSiteHtml(readFileSync('src/publish/site-shell.html', 'utf8'), p);
    expect(Object.keys(p.assetMap)).not.toContain(capa);
    expect(Object.keys(p.assetMap)).not.toContain(miniId(capa));
    expect(html).not.toContain(capa);
  });

  it('a capa NDA que também é bloco Imagem do projeto mantém a inteira no pacote', async () => {
    const { data, assets, capa } = comFotosGrandes();
    const proj = data.collections.projects[0]!;
    proj.visibility = 'nda';
    const img = proj.sections.flatMap((s) => s.blocks).find((b): b is Extract<Block, { type: 'image' }> => b.type === 'image')!;
    img.content.image = { assetId: capa, alt };
    const p = await buildPublishPayload({ data, assets }, SENHA, { miniatura: geradorFalso().gerar });
    const aberto = await abrirPacoteNda<NdaBundle>(p.ndaBlob!, SENHA);
    expect(aberto.assets[miniId(capa)]).toBeDefined();
    expect(aberto.assets[capa]).toBeDefined();
  });

  it('o pacote é autossuficiente: a capa dividida com um projeto público leva a miniatura própria', async () => {
    // O `publicar:site` sem senha reaproveita o pacote antigo ao lado de dados públicos novos:
    // o card NDA não pode depender da miniatura do público.
    const { data, assets, capa } = comFotosGrandes();
    data.collections.projects[0]!.visibility = 'nda';
    data.collections.projects[1]!.thumb = { assetId: capa, alt }; // um projeto público usa a mesma capa
    const p = await buildPublishPayload({ data, assets }, SENHA, { miniatura: geradorFalso().gerar });
    expect(p.assetMap[miniId(capa)]).toBeDefined();
    const aberto = await abrirPacoteNda<NdaBundle>(p.ndaBlob!, SENHA);
    expect(aberto.assets[miniId(capa)], 'sem miniatura no pacote o card NDA fica vazio').toBeDefined();
  });

  it('capa que também é favicon do site mantém a inteira', async () => {
    const { data, assets, capa } = comFotosGrandes();
    data.site.favicon = { assetId: capa, alt };
    expect(soComoCapa(data).has(capa)).toBe(false);
    const p = await buildPublishPayload({ data, assets }, undefined, { miniatura: geradorFalso().gerar });
    expect(p.assetMap[capa]).toBeDefined();
  });

  it('capa que também é quadro de storyboard mantém a inteira', () => {
    const { data, capa } = comFotosGrandes();
    const quadro = [...data.pages.flatMap((pg) => pg.sections), ...data.collections.projects.flatMap((pr) => pr.sections)]
      .flatMap((sec) => sec.blocks)
      .find((b): b is Extract<Block, { type: 'storyboard' }> => b.type === 'storyboard')!;
    expect(soComoCapa(data).has(capa)).toBe(true);
    quadro.content.frames.push({ assetId: capa, alt });
    expect(soComoCapa(data).has(capa)).toBe(false);
  });

  it('sem gerador (linha de comando) o pacote segue com a inteira', async () => {
    const { data, assets, capa } = comFotosGrandes();
    data.collections.projects[0]!.visibility = 'nda';
    const p = await buildPublishPayload({ data, assets }, SENHA);
    const aberto = await abrirPacoteNda<NdaBundle>(p.ndaBlob!, SENHA);
    expect(aberto.assets[capa]).toBeDefined();
    expect(aberto.assets[miniId(capa)]).toBeUndefined();
  });
});

describe('resolver: grade prefere a miniatura; o resto, a inteira', () => {
  const r = mapResolver({ a: 'INTEIRA', [miniId('a')]: 'MINI', b: 'SÓ-INTEIRA', [miniId('c')]: 'SÓ-MINI' });
  it('em grade: miniatura, e a inteira na falta dela', () => {
    expect(r({ assetId: 'a', alt }, 'miniatura')).toBe('MINI');
    expect(r({ assetId: 'b', alt }, 'miniatura')).toBe('SÓ-INTEIRA');
  });
  it('fora da grade: a inteira, e a miniatura enquanto a inteira não existe', () => {
    expect(r({ assetId: 'a', alt })).toBe('INTEIRA');
    expect(r({ assetId: 'c', alt })).toBe('SÓ-MINI');
    expect(r({ assetId: 'zz', alt })).toBe('');
    expect(r({ url: 'https://x/y.jpg', alt })).toBe('https://x/y.jpg');
  });
});
