import { describe, expect, it } from 'vitest';
import type { Block } from '../src/schema/v4';
import { computeRows, detachBlock, layoutGrid, placeBlock, rowHeadId } from '../src/editor/gridOps';

const blk = (id: string, span = 12): Block => ({ id, span, visibility: 'public', type: 'divider', content: {} });
const ids = (bs: Block[]): string => bs.map((b) => `${b.id}:${b.span}${b.stack ? '^' : ''}`).join(' ');

describe('gridOps', () => {
  it('alinhamento da linha vem do 1º bloco e vale para a linha toda', () => {
    const bs = [{ ...blk('a', 2), rowAlign: 'center' as const }, blk('b', 2), blk('c')];
    expect(rowHeadId(bs, 'b')).toBe('a');
    const { places } = layoutGrid(bs);
    expect(places.map((p) => p.align)).toEqual(['center', 'center', 'start']);
  });

  it('layout informa colunas livres da linha (espaço para afastar sem encolher)', () => {
    const { places } = layoutGrid([blk('a', 2), blk('b', 2), blk('c', 2), blk('d', 2)]);
    expect(places.map((p) => [p.k, p.n, p.free])).toEqual([[0, 4, 4], [1, 4, 4], [2, 4, 4], [3, 4, 4]]);
  });

  it('agrupa linhas pela soma de spans', () => {
    expect(computeRows([blk('a', 6), blk('b', 6), blk('c'), blk('d', 4)])).toEqual([[0, 1], [2], [3]]);
  });

  it('soltar na lateral forma uma grade de 2 e depois de 3', () => {
    const bs = [blk('a'), blk('b')];
    placeBlock(bs, detachBlock(bs, 'b')!, 'a', 'right');
    expect(ids(bs)).toBe('a:6 b:6');
    placeBlock(bs, blk('c'), 'a', 'left');
    expect(ids(bs)).toBe('c:4 a:4 b:4');
  });

  it('tirar um bloco da linha NÃO redimensiona os vizinhos', () => {
    const bs = [blk('a', 4), blk('b', 4), blk('c', 4), blk('d')];
    const b = detachBlock(bs, 'b')!;
    expect(ids(bs)).toBe('a:4 c:4 d:12');
    placeBlock(bs, b, 'd', 'bottom');
    expect(ids(bs)).toBe('a:4 c:4 d:12 b:12');
  });

  it('soltar ao lado usa a sobra da linha sem encolher os vizinhos', () => {
    const bs = [blk('a', 2), blk('b', 2), blk('c', 2)];
    placeBlock(bs, blk('n', 6), 'c', 'right');
    expect(ids(bs)).toBe('a:2 b:2 c:2 n:6');
    const cheia = [blk('x', 6), blk('y', 6)];
    placeBlock(cheia, blk('z', 6), 'y', 'right'); // sem sobra: redistribui
    expect(ids(cheia)).toBe('x:4 y:4 z:4');
  });

  it('keepSpan mantém a largura numa linha nova (duplicar/colar abaixo)', () => {
    const bs = [blk('a', 6)];
    placeBlock(bs, blk('n', 6), 'a', 'bottom', { keepSpan: true });
    expect(ids(bs)).toBe('a:6 n:6');
  });

  it('topo de linha única cria linha cheia antes', () => {
    const bs = [blk('a')];
    placeBlock(bs, blk('n'), 'a', 'top');
    expect(ids(bs)).toBe('n:12 a:12');
  });

  it('embaixo de um bloco que divide a linha: empilha na mesma coluna', () => {
    // texto (esq.) | imagem (dir.) → soltar texto novo embaixo da imagem
    const bs = [blk('txt', 6), blk('img', 6)];
    placeBlock(bs, blk('novo'), 'img', 'bottom');
    expect(ids(bs)).toBe('txt:6 img:6 novo:6^');
    const { places, rows } = layoutGrid(bs);
    expect(rows).toBe(2);
    expect(places[0]).toMatchObject({ col: '1 / span 6', row: '1 / span 2', k: 0, n: 2, free: 0 }); // texto corre ao lado das duas
    expect(places[1]).toMatchObject({ col: '7 / span 6', row: '1 / span 1', k: 1 });
    expect(places[2]).toMatchObject({ col: '7 / span 6', row: '2 / span 1', k: 1 });
  });

  it('em cima de um bloco que divide a linha: entra no topo da pilha', () => {
    const bs = [blk('a', 6), blk('b', 6)];
    placeBlock(bs, blk('n'), 'b', 'top');
    expect(ids(bs)).toBe('a:6 n:6 b:6^');
  });

  it('tirar a cabeça da pilha promove o próximo; tirar da pilha não mexe na linha', () => {
    const bs = [blk('a', 6), blk('b', 6), { ...blk('c', 6), stack: true }];
    detachBlock(bs, 'b');
    expect(ids(bs)).toBe('a:6 c:6');
    const alinhada = [{ ...blk('a', 2), rowAlign: 'center' as const }, blk('b', 2)];
    detachBlock(alinhada, 'a');
    expect(alinhada[0]!.rowAlign).toBe('center'); // o alinhamento da linha fica com quem sobra
    const bs2 = [blk('a', 6), blk('b', 6), { ...blk('c', 6), stack: true }];
    detachBlock(bs2, 'c');
    expect(ids(bs2)).toBe('a:6 b:6');
  });
});
