import { describe, expect, it } from 'vitest';
import { reorderArray } from '../src/core/array';

describe('reorderArray', () => {
  it('move para frente', () => {
    const a = ['a', 'b', 'c', 'd'];
    reorderArray(a, 0, 2);
    expect(a).toEqual(['b', 'c', 'a', 'd']);
  });
  it('move para trás', () => {
    const a = ['a', 'b', 'c', 'd'];
    reorderArray(a, 3, 1);
    expect(a).toEqual(['a', 'd', 'b', 'c']);
  });
  it('no-op para índices iguais ou inválidos', () => {
    const a = ['a', 'b', 'c'];
    reorderArray(a, 1, 1);
    reorderArray(a, -1, 2);
    reorderArray(a, 0, 9);
    expect(a).toEqual(['a', 'b', 'c']);
  });
});
