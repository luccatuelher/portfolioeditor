/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { sanitizeInlineHtml } from '../src/editor/sanitize';
import { ADDABLE_BLOCKS, makeDefaultBlock } from '../src/editor/blockFactory';
import { SECTION_PRESETS } from '../src/editor/sectionPresets';
import { themeFontUrls } from '../src/renderer/fonts';
import { themeToCssVars, cssVarsToString } from '../src/renderer/theme';
import { bi, emptyI18n, isBlankI18n } from '../src/core/i18n';
import { cyrb53, hashHex } from '../src/core/hash';
import { BlockSchema, defaultTheme, SectionSchema } from '../src/schema/v4';

/**
 * Módulos que só eram exercitados de lado (pelo e2e ou pelo render inteiro).
 * Testados aqui direto, porque o custo de um erro neles é alto.
 */
describe('texto colado no canvas (segurança)', () => {
  it('não deixa passar script, iframe nem manipulador de evento', () => {
    const sujo = '<p onclick="roubar()">oi</p><script>alert(1)</script><iframe src="http://x"></iframe><img src=x onerror=alert(1)>';
    const limpo = sanitizeInlineHtml(sujo);
    expect(limpo).not.toMatch(/<script|<iframe|onclick|onerror/i);
    expect(limpo).toContain('oi');
  });

  it('não deixa passar javascript: em link', () => {
    const limpo = sanitizeInlineHtml('<a href="javascript:alert(1)">clique</a>');
    expect(limpo.toLowerCase()).not.toContain('javascript:');
    expect(limpo).toContain('clique');
  });

  it('mantém a formatação que o editor oferece', () => {
    const limpo = sanitizeInlineHtml('<b>forte</b> <i>itálico</i> <a href="https://exemplo.com">link</a>');
    expect(limpo).toContain('forte');
    expect(limpo).toContain('itálico');
    expect(limpo).toContain('https://exemplo.com');
  });
});

describe('fábrica de blocos', () => {
  it('todo tipo oferecido na paleta nasce válido', () => {
    for (const { type } of ADDABLE_BLOCKS) {
      const b = makeDefaultBlock(type);
      const r = BlockSchema.safeParse(b);
      expect(r.success, `${type}: ${r.success ? '' : r.error.issues[0]?.message}`).toBe(true);
      expect(b.id).toBeTruthy();
      expect(b.visibility).toBe('public');
    }
  });

  it('dois blocos nunca nascem com o mesmo id', () => {
    const ids = Array.from({ length: 50 }, () => makeDefaultBlock('text').id);
    expect(new Set(ids).size).toBe(50);
  });
});

describe('seções prontas', () => {
  it('toda seção pronta nasce válida e com ids próprios', () => {
    for (const preset of SECTION_PRESETS) {
      const s1 = preset.make();
      const s2 = preset.make();
      expect(SectionSchema.safeParse(s1).success, preset.id).toBe(true);
      expect(s1.id).not.toBe(s2.id);
      const ids = s1.blocks.map((b) => b.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(s1.blocks.length).toBeGreaterThan(0);
    }
  });
});

describe('fontes do tema', () => {
  it('fonte embutida não vira pedido ao Google', () => {
    expect(themeFontUrls({ display: 'DM Serif Display', body: 'DM Sans', mono: 'DM Mono' })).toEqual([]);
  });

  it('fonte de fora pede regular e negrito, sempre com display=swap', () => {
    const urls = themeFontUrls({ display: 'Playfair Display', body: 'DM Sans', mono: 'DM Mono' });
    expect(urls).toHaveLength(2);
    expect(urls.every((u) => u.includes('display=swap'))).toBe(true);
    expect(urls[0]).toContain('Playfair+Display');
    expect(urls[1]).toContain('wght@700');
  });

  it('nome com caractere estranho é ignorado (não vira URL torta)', () => {
    expect(themeFontUrls({ display: 'Fonte"; --x', body: 'DM Sans', mono: 'DM Mono' })).toEqual([]);
  });
});

describe('tokens do tema em CSS', () => {
  it('cada cor do tema vira uma variável', () => {
    const vars = themeToCssVars(defaultTheme());
    for (const k of Object.keys(defaultTheme().colors)) {
      const nome = `--${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`;
      expect(Object.keys(vars).join(' ')).toContain(nome);
    }
    expect(vars['--grid-gutter']).toMatch(/px$/);
  });

  it('a string de CSS sai pronta para colar num style', () => {
    const s = cssVarsToString({ '--a': '1px', '--b': 'red' });
    expect(s).toBe('--a:1px;--b:red');
  });
});

describe('texto bilíngue e hash', () => {
  it('bi() usa o português quando não há inglês', () => {
    expect(bi('Olá')).toEqual({ pt: 'Olá', en: 'Olá' });
    expect(bi('Olá', 'Hi').en).toBe('Hi');
  });

  it('vazio é reconhecido mesmo com espaços', () => {
    expect(isBlankI18n(emptyI18n())).toBe(true);
    expect(isBlankI18n({ pt: '   ', en: '\n' })).toBe(true);
    expect(isBlankI18n({ pt: 'x', en: '' })).toBe(false);
  });

  it('o hash é estável e muda com o conteúdo', () => {
    expect(cyrb53('abc')).toBe(cyrb53('abc'));
    expect(cyrb53('abc')).not.toBe(cyrb53('abd'));
    expect(hashHex('abc')).toMatch(/^[0-9a-f]+$/);
  });
});
