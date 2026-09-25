import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastLevel, contrastRatio, legivel, luminance, parseHex } from '../src/core/contrast';
import { themeToCssVars } from '../src/renderer/theme';
import { defaultTheme } from '../src/schema/v4';

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

describe('legivel — a cor de texto que o site usa', () => {
  const bg = '#F2EFE8';
  const ink = '#1C1B18';

  it('o cinza claro padrão (2,4:1) vira uma versão legível do mesmo tom', () => {
    const c = legivel('#A09C93', bg, 4.5, ink);
    expect(contrastRatio(c, bg)!).toBeGreaterThanOrEqual(4.5);
    // Escurece só o necessário: fica mais clara que a tinta e perto de 4,5:1.
    expect(contrastRatio(c, bg)!).toBeLessThan(4.7);
    expect(luminance(c)!).toBeGreaterThan(luminance('#5A574F')! * 0.8);
  });

  it('cor que já é legível volta igual', () => {
    expect(legivel('#5A574F', bg, 4.5, ink)).toBe('#5A574F');
  });

  it('tema escuro: clareia em vez de escurecer', () => {
    const c = legivel('#55524C', '#141311', 4.5, '#F2EFE8');
    expect(contrastRatio(c, '#141311')!).toBeGreaterThanOrEqual(4.5);
    expect(luminance(c)!).toBeGreaterThan(luminance('#55524C')!);
  });

  it('tema em que nem a tinta chega a 4,5:1: vai para preto (ou branco)', () => {
    const c = legivel('#CCCCCC', '#DDDDDD', 4.5, '#BBBBBB');
    expect(contrastRatio(c, '#DDDDDD')!).toBeGreaterThanOrEqual(4.5);
  });

  it('cor que não dá para ler volta como veio (o CSS decide)', () => {
    expect(legivel('red', bg)).toBe('red');
  });

  it('o tema padrão entrega a variável de texto legível; a original fica para linhas', () => {
    const v = themeToCssVars(defaultTheme());
    expect(v['--ink-pale']).toBe('#A09C93');
    expect(contrastRatio(v['--ink-pale-texto']!, v['--bg']!)!).toBeGreaterThanOrEqual(4.5);
  });

  it('guarda: no CSS do site, texto em cinza claro ou em destaque só pela versão legível', () => {
    const css = readFileSync('src/renderer/styles.css', 'utf8');
    expect(css.match(/(^|[^-])color:\s*var\(--(ink-pale|accent)\)/gm) ?? []).toEqual([]);
  });
});
