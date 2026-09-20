import { describe, expect, it } from 'vitest';
import { contrastLevel, contrastRatio, luminance, parseHex } from '../src/core/contrast';

describe('contraste (WCAG)', () => {
  it('lê #rgb, #rrggbb e rejeita lixo', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('1c1b18')).toEqual([28, 27, 24]);
    expect(parseHex('rgb(0,0,0)')).toBeNull();
  });

  it('luminância nos extremos', () => {
    expect(luminance('#000')).toBe(0);
    expect(luminance('#fff')).toBeCloseTo(1, 5);
  });

  it('preto sobre branco = 21:1 e a razão não depende da ordem', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('classifica os limiares da WCAG', () => {
    expect(contrastLevel(7.1)).toBe('AAA');
    expect(contrastLevel(4.6)).toBe('AA');
    expect(contrastLevel(3.2)).toBe('AA-large');
    expect(contrastLevel(3.2, true)).toBe('AA');
    expect(contrastLevel(2.9, true)).toBe('fail');
  });

  it('cor inválida não quebra: devolve null', () => {
    expect(contrastRatio('#zzz', '#fff')).toBeNull();
  });
});
