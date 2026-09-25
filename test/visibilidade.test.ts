import { describe, expect, it } from 'vitest';
import { migrate } from '../src/migrate/migrate';
import { camposDeTexto, type Dono } from '../src/core/camposTexto';
import { publicSnapshot, type PublicResult } from '../src/publish/publicSnapshot';
import { loadFixture } from './helpers/fixtures';
import { readFileSync } from 'node:fs';
import { blocosQueVaoProSite } from '../src/core/visibilidade';
import type { Block, PortfolioV4, Section } from '../src/schema/v4';

/**
 * Guarda: "vai para o site" é UMA regra (core/visibilidade). A lista de campos
 * (que alimenta Traduções, descrições e o aviso de publicação) tem de concordar
 * com o que o publicSnapshot de fato publica — aberto ou cifrado (NDA).
 */
function doc(): PortfolioV4 {
  const d = migrate(loadFixture('template-v3.json')).data;
  const [p0, p1, p2] = d.collections.projects;
  p1!.visibility = 'draft';
  p2!.visibility = 'nda';
  const blocos = p0!.sections[0]!.blocks as Block[];
  blocos.push({ id: 'b-rasc', type: 'heading', span: 12, visibility: 'draft', content: { text: { pt: 'Rascunho', en: 'Draft' }, level: 2 } } as Block);
  blocos.push({ id: 'b-nda', type: 'heading', span: 12, visibility: 'nda', content: { text: { pt: 'Segredo', en: 'Secret' }, level: 2 } } as Block);
  const sobre = d.pages.find((p) => p.kind === 'static' && p.id !== 'home')!;
  sobre.visibility = 'draft';
  return d;
}

const blocosDe = (secs: Section[]): string[] => secs.flatMap((s) => s.blocks.map((b) => b.id));

function publicado(snap: PublicResult, dono: Dono): boolean {
  const { data, nda } = snap;
  if (dono.tipo === 'site') return true;
  if (dono.tipo === 'pagina') return data.pages.some((p) => p.id === dono.pageId);
  if (dono.tipo === 'item') {
    const c = dono.colecao;
    return [...data.collections[c], ...nda[c]].some((i) => i.id === dono.itemId);
  }
  const todas = [
    ...data.pages.flatMap((p) => blocosDe(p.sections)),
    ...[...data.collections.projects, ...data.collections.blog, ...nda.projects, ...nda.blog].flatMap((i) => blocosDe(i.sections)),
    ...(nda.blocks ?? []).map((b) => b.block.id),
  ];
  return todas.includes(dono.blockId);
}

describe('uma regra de "vai para o site"', () => {
  it('a lista de campos concorda com o que o publicSnapshot publica (aberto ou cifrado)', () => {
    const d = doc();
    const snap = publicSnapshot(d);
    const divergentes = camposDeTexto(d)
      .filter((c) => c.publicado !== publicado(snap, c.dono))
      .map((c) => `${c.campo} · ${c.lugar} (lista: ${c.publicado})`);
    expect(divergentes).toEqual([]);
  });

  it('rascunho fica fora; NDA vai (cifrado)', () => {
    const d = doc();
    const campos = camposDeTexto(d);
    const do_ = (blockId: string) => campos.find((c) => c.dono.tipo === 'bloco' && c.dono.blockId === blockId)!;
    expect(do_('b-rasc').publicado).toBe(false);
    expect(do_('b-nda').publicado).toBe(true);
  });
});

describe('blocosQueVaoProSite — o mesmo que o publicSnapshot publica', () => {
  it('cada bloco que vai (e só ele), com NDA marcado onde é cifrado', () => {
    const d = doc();
    const snap = publicSnapshot(d);
    const abertos = new Set([
      ...snap.data.pages.flatMap((p) => blocosDe(p.sections)),
      ...[...snap.data.collections.projects, ...snap.data.collections.blog].flatMap((i) => blocosDe(i.sections)),
    ]);
    const cifrados = new Set([
      ...[...snap.nda.projects, ...snap.nda.blog].flatMap((i) => blocosDe(i.sections)),
      ...(snap.nda.blocks ?? []).map((b) => b.block.id),
    ]);
    const lista = blocosQueVaoProSite(d);
    expect(new Set(lista.map((b) => b.bloco.id))).toEqual(new Set([...abertos, ...cifrados]));
    for (const b of lista) expect(b.nda, b.bloco.id).toBe(cifrados.has(b.bloco.id));
    expect(lista.some((b) => b.bloco.id === 'b-rasc')).toBe(false);
    expect(lista.find((b) => b.bloco.id === 'b-nda')?.nda).toBe(true);
  });

  it('a conferência antes de publicar não filtra por conta própria (usa a regra única)', () => {
    const fonte = readFileSync('src/publish/preflight.ts', 'utf8');
    expect(fonte.match(/visibility\s*[!=]==/g) ?? []).toEqual([]);
  });
});
