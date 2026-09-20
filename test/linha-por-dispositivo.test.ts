import { describe, expect, it } from 'vitest';
import { sobraDaLinha, spanEfetivo } from '../src/renderer/responsive';

const img = (span: number, mobile?: number, tablet?: number) => ({
  type: 'image', span, responsive: { mobile: mobile ? { span: mobile } : undefined, tablet: tablet ? { span: tablet } : undefined },
});
const texto = (span: number, mobile?: number) => ({ type: 'text', span, responsive: { mobile: mobile ? { span: mobile } : undefined } });

describe('a linha recalculada em cada tela', () => {
  it('imagem herda a largura; texto vai para a linha inteira no celular', () => {
    expect(spanEfetivo(img(2), 'mobile')).toBe(2);
    expect(spanEfetivo(texto(6), 'mobile')).toBe(12);
    expect(spanEfetivo(texto(6), 'tablet')).toBe(6);
  });

  it('largura escolhida à mão manda, inclusive em texto', () => {
    expect(spanEfetivo(texto(6, 4), 'mobile')).toBe(4);
    expect(spanEfetivo(img(2, 6), 'mobile')).toBe(6);
  });

  it('fila de cinco logos: cabe no computador e no celular', () => {
    const fila = [img(2), img(2), img(2), img(2), img(2)];
    expect(sobraDaLinha(fila, 'desktop')).toBe(2);
    expect(sobraDaLinha(fila, 'mobile')).toBe(2);
  });

  it('se a largura do celular estoura as 12 colunas, a linha quebra e não há alinhamento', () => {
    const fila = [img(2, 3), img(2, 3), img(2, 3), img(2, 3), img(2, 3)]; // 15 no celular
    expect(sobraDaLinha(fila, 'desktop')).toBe(2);
    expect(sobraDaLinha(fila, 'mobile')).toBeNull();
  });

  it('linha com texto e imagem quebra no celular (o texto toma a linha)', () => {
    expect(sobraDaLinha([texto(6), img(6)], 'desktop')).toBe(0);
    expect(sobraDaLinha([texto(6), img(6)], 'mobile')).toBeNull();
  });

  it('o tablet herda do computador quando não há ajuste próprio', () => {
    const fila = [img(4), img(4), img(4)];
    expect(sobraDaLinha(fila, 'tablet')).toBe(0);
    expect(sobraDaLinha([img(4, undefined, 6), img(4, undefined, 6)], 'tablet')).toBe(0);
  });
});
