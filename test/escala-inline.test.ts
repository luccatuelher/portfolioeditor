import { describe, expect, it } from 'vitest';
import { escalarTamanhos } from '../src/renderer/text';
import { sanitizeRich } from '../src/core/sanitizeHtml';

describe('texto de tamanho próprio', () => {
  it('px e rem escritos na mão passam pela escala do tablet/celular', () => {
    const html = escalarTamanhos(sanitizeRich('<p><span style="font-size: 18px">oi</span> <span style="font-size: 1.5rem">x</span></p>'));
    expect(html).toContain('font-size: calc(18px * var(--escala-inline, 1))');
    expect(html).toContain('font-size: calc(1.5rem * var(--escala-inline, 1))');
  });
  it('em e % já são relativos e ficam como estão', () => {
    expect(escalarTamanhos(sanitizeRich('<span style="font-size: 120%">x</span>'))).toContain('font-size: 120%');
  });
});
