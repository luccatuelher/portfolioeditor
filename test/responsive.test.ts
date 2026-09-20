import { describe, expect, it } from 'vitest';
import { columnWidth, minSpanFor, resolveSpan, snapUp, spanVars } from '../src/renderer/responsive';

describe('largura por dispositivo', () => {
  it('sem ajuste nenhum, tudo herda o computador', () => {
    expect(resolveSpan({ desktop: 6 }, 'tablet').span).toBe(6);
    expect(resolveSpan({ desktop: 6 }, 'mobile').span).toBe(6);
  });

  it('cascata: o que eu ajusto no tablet desce para o celular', () => {
    const r = resolveSpan({ desktop: 3, tablet: 6 }, 'mobile');
    expect(r.span).toBe(6);
    expect(r.own).toBe(false);
    expect(r.from).toBe('tablet');
  });

  it('o valor próprio do celular vence o do tablet e o do computador', () => {
    const r = resolveSpan({ desktop: 3, tablet: 6, mobile: 12 }, 'mobile');
    expect(r.span).toBe(12);
    expect(r.own).toBe(true);
  });

  it('valor próprio passa intacto, mesmo abaixo do piso confortável', () => {
    const r = resolveSpan({ desktop: 12, mobile: 2 }, 'mobile', 'media');
    expect(r.span).toBe(2);
    expect(r.floored).toBe(false);
  });

  it('piso fluido: miniatura herdada não vira selo no celular', () => {
    const r = resolveSpan({ desktop: 3 }, 'mobile', 'media');
    expect(r.span).toBe(6); // duas por fila em vez de quatro de 80px
    expect(r.floored).toBe(true);
  });

  it('card com texto empilha no celular e mantém 3 por fila no tablet', () => {
    expect(resolveSpan({ desktop: 4 }, 'mobile', 'card').span).toBe(12);
    expect(resolveSpan({ desktop: 4 }, 'tablet', 'card').span).toBe(4);
  });

  it('bloco posicionado à mão não sofre piso: a fila de cinco logos continua com cinco', () => {
    const r = resolveSpan({ desktop: 2 }, 'mobile', 'block');
    expect(r.span).toBe(2);
    expect(r.floored).toBe(false);
  });

  it('só usa divisores de 12, então a fila sempre fecha', () => {
    for (let s = 1; s <= 12; s++) expect(12 % snapUp(s)).toBe(0);
    expect(snapUp(4.2)).toBe(6);
    expect(snapUp(2)).toBe(2);
  });

  it('a coluna do celular é mais estreita que a do tablet, que é mais que a do computador', () => {
    expect(columnWidth('mobile')).toBeLessThan(columnWidth('tablet'));
    expect(columnWidth('tablet')).toBeLessThan(columnWidth('desktop'));
    expect(minSpanFor('media', 'mobile')).toBeGreaterThanOrEqual(minSpanFor('media', 'tablet'));
  });

  it('as variáveis de grade saem prontas para o CSS', () => {
    expect(spanVars({ desktop: 4, mobile: 12 }, 'card')).toEqual({ '--span': 4, '--gc-t': 'span 4', '--gc-m': 'span 12' });
  });

  it('largura fora da faixa não quebra a grade', () => {
    expect(resolveSpan({ desktop: 99 }, 'tablet').span).toBe(12);
    expect(resolveSpan({ desktop: 0 }, 'mobile').span).toBe(1);
  });
});
