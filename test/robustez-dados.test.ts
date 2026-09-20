import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { repairDoc } from '../src/migrate/repair';
import { PortfolioV4Schema, type PortfolioV4 } from '../src/schema/v4';
import { loadFixture } from './helpers/fixtures';

/**
 * Um rascunho estragado não pode custar o trabalho do dono do site. O conserto
 * só desiste quando não sobrou conteúdo nenhum para salvar.
 */
describe('robustez do rascunho salvo', () => {
  const { data } = migrate(loadFixture('template-v3.json'));
  const base = (): any => JSON.parse(JSON.stringify(data));
  const consertar = (d: unknown): PortfolioV4 => {
    const r = repairDoc(d);
    expect(r.doc, `descartado: ${r.fixes.slice(0, 3).join(' · ')}`).not.toBeNull();
    expect(PortfolioV4Schema.safeParse(r.doc).success).toBe(true);
    return r.doc!;
  };
  const blocos = (d: PortfolioV4): number => d.pages.reduce((n, p) => n + p.sections.reduce((m, s) => m + s.blocks.length, 0), 0);
  // Referência: o mesmo documento passando pelo conserto sem estar estragado
  // (o upgrade pode acrescentar peças novas de formato).
  const limpo = consertar(base());

  it('tema perdido é reposto e as páginas ficam intactas', () => {
    const d = base();
    delete d.theme;
    const r = consertar(d);
    expect(r.pages).toHaveLength(limpo.pages.length);
    expect(blocos(r)).toBe(blocos(limpo));
  });

  it('coleções perdidas voltam vazias em vez de derrubar o documento', () => {
    const d = base();
    delete d.collections;
    const r = consertar(d);
    expect(r.collections.projects).toEqual([]);
    expect(r.pages).toHaveLength(limpo.pages.length);
  });

  it('páginas guardadas como objeto viram lista', () => {
    const d = base();
    d.pages = Object.fromEntries(d.pages.map((p: any) => [p.id, p]));
    expect(consertar(d).pages.length).toBe(limpo.pages.length);
  });

  it('texto que virou número é convertido, não apagado', () => {
    const d = base();
    d.site.name = { pt: 42, en: 'Studio' };
    expect(consertar(d).site.name.pt).toBe('42');
  });

  it('largura fora da faixa é presa no limite (a escolha é mantida)', () => {
    const d = base();
    d.pages[0].sections[0].blocks[0].span = 999;
    expect(consertar(d).pages[0]!.sections[0]!.blocks[0]!.span).toBe(12);
  });

  it('recorte corrompido é descartado, mas a imagem continua lá', () => {
    const d = base();
    const bloco = d.pages[0].sections[0].blocks.find((b: any) => b.type === 'image');
    const antes = bloco.content.image.assetId ?? bloco.content.image.url;
    bloco.content.image.crop = { x: -5, y: 2, w: 0, h: 0, ar: 0 };
    const r = consertar(d);
    const depois: any = r.pages[0]!.sections[0]!.blocks.find((b) => b.type === 'image');
    expect(depois.content.image.assetId ?? depois.content.image.url).toBe(antes);
    expect(depois.content.image.crop).toBeUndefined();
  });

  it('páginas com id repetido são separadas (senão a navegação quebra)', () => {
    const d = base();
    d.pages.push(JSON.parse(JSON.stringify(d.pages[0])));
    const r = consertar(d);
    const ids = r.pages.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const slugs = r.pages.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('bloco de tipo desconhecido sai sozinho, sem levar a seção junto', () => {
    const d = base();
    d.pages[0].sections[0].blocks.push({ id: 'x', type: 'carrossel-3d', visibility: 'public', span: 12, content: {} });
    const r = consertar(d);
    expect(blocos(r)).toBe(blocos(limpo));
  });

  it('versão do formato errada é normalizada', () => {
    for (const v of [1, 99]) {
      const d = base();
      d.schemaVersion = v;
      expect(consertar(d).schemaVersion).toBe(4);
    }
  });

  it('sem páginas não há o que salvar: desiste em vez de inventar', () => {
    for (const lixo of [null, {}, [], 'oi', 42, (() => { const d = base(); delete d.pages; return d; })()]) {
      expect(repairDoc(lixo).doc).toBeNull();
    }
  });

  it('o conserto nunca entra em laço, mesmo com valor impossível', () => {
    const d = base();
    d.pages[0].sections[0].blocks[0].span = Number.NaN;
    d.pages[0].sections[0].style = { width: 'gigante' };
    const t0 = Date.now();
    repairDoc(d);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('não muta o documento recebido', () => {
    const d = base();
    d.schemaVersion = 99;
    const copia = JSON.stringify(d);
    repairDoc(d);
    expect(JSON.stringify(d)).toBe(copia);
  });
});
