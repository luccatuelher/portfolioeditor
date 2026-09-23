import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../src/core/sanitizeHtml';
import { migrate } from '../src/migrate/migrate';

describe('sanitizeHtml (ingestão de HTML não confiável)', () => {
  it('remove script com conteúdo', () => {
    expect(sanitizeHtml('oi<script>alert(1)</script>tchau')).toBe('oitchau');
  });
  it('remove atributos de evento e javascript: (removendo todos os atributos)', () => {
    const out = sanitizeHtml('<p onclick="alert(1)">x</p><a href="javascript:alert(1)">y</a>');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('<p>x</p>');
  });
  it('remove <img onerror> (tag fora da allowlist)', () => {
    expect(sanitizeHtml('<img src=x onerror=alert(1)>')).toBe('');
  });
  it('mantém formatação simples', () => {
    expect(sanitizeHtml('<p><strong>a</strong> <em>b</em><br><ul><li>c</li></ul></p>')).toBe(
      '<p><strong>a</strong> <em>b</em><br><ul><li>c</li></ul></p>',
    );
  });
  it('remove iframe e style', () => {
    expect(sanitizeHtml('<iframe src="evil"></iframe><style>body{}</style>ok')).toBe('ok');
  });
  it('remover uma tag do meio não cola os pedaços numa tag nova', () => {
    for (const evil of ['<<x>img src=x onerror=alert(1)>', '<<<x>x>img src=x onerror=alert(1)>', '<scr<!-- -->ipt>alert(1)</script>', '<img src=x onerror=alert(1)']) {
      const out = sanitizeHtml(evil);
      expect(out, evil).not.toMatch(/<(img|script)/i);
    }
  });
});

describe('migrate sanitiza backup malicioso', () => {
  it('não deixa script/handler passar do v3 para o documento v4', () => {
    const evil = '<img src=x onerror="alert(1)"><script>alert(2)</script><p onmouseover="x()">texto</p>';
    const v3 = {
      schemaVersion: 3,
      projects: [{ id: 'p1', title: 'T', published: true, rows: [{ id: 'r1', cols: 1, items: [{ id: 'i1', kind: 'text', content: evil }] }] }],
      blog: [{ id: 'b1', title: 'B', content: evil, published: true }],
      gallery: [], sketches: [],
      texts: {},
      meta: { elementText: { 'txt-site-name': evil } },
    };
    const json = JSON.stringify(migrate(v3).data);
    expect(json).not.toContain('onerror');
    expect(json).not.toContain('onmouseover');
    expect(json).not.toContain('<script');
    expect(json).toContain('texto'); // o texto legítimo é preservado
  });
});
