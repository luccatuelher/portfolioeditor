import { describe, expect, it } from 'vitest';
import { sanitizeRich } from '../src/core/sanitizeHtml';

describe('sanitizeRich', () => {
  it('mantém links seguros e estilos permitidos', () => {
    const out = sanitizeRich('<p style="text-align: center; position: fixed">Oi <a href="https://x.com" onclick="alert(1)">link</a> <span style="color: #c1440e; font-size: 24px">cor</span></p>');
    expect(out).toBe('<p style="text-align: center">Oi <a href="https://x.com" target="_blank" rel="noopener noreferrer">link</a> <span style="color: #c1440e; font-size: 24px">cor</span></p>');
  });
  it('remove scripts, javascript: e tags fora da lista', () => {
    const out = sanitizeRich('<script>alert(1)</script><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)>');
    expect(out).toBe('<a>x</a>');
  });
  it('texto puro passa intacto', () => {
    expect(sanitizeRich('Rocky & Nutes')).toBe('Rocky & Nutes');
  });
  it('remover uma tag do meio não cola os pedaços numa tag nova (XSS)', () => {
    for (const evil of ['<<x>img src=x onerror=alert(1)>', '<<<x>x>img src=x onerror=alert(1)>', '<p><<svg>img src=x onerror=alert(1)></p>', '<a<x> href=x onclick=alert(1)>y</a>']) {
      const out = sanitizeRich(evil);
      expect(out, evil).not.toMatch(/<(img|svg|script)/i);
      expect(out, evil).not.toMatch(/<[^>]*\bon[a-z]+\s*=/i);
    }
  });
  it('link com "&" continua funcionando, por quantas vezes passar pelo sanitizador', () => {
    // É assim que o navegador serializa o link criado no canvas.
    const salvo = '<a href="https://x.com/?a=1&amp;b=2">x</a>';
    const uma = sanitizeRich(salvo);
    expect(uma).toBe('<a href="https://x.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">x</a>');
    expect(sanitizeRich(uma)).toBe(uma);
  });
  it('entidade no href não esconde um javascript:', () => {
    for (const evil of ['<a href="javascript&#58;alert(1)">x</a>', '<a href="javascript&#x3A;alert(1)">x</a>', '<a href="jav&#x09;ascript:alert(1)">x</a>']) {
      expect(sanitizeRich(evil), evil).toBe('<a>x</a>');
    }
  });
  it('estilo com aspas codificadas (fonte) é mantido e estável', () => {
    const uma = sanitizeRich('<span style="font-family: &quot;DM Sans&quot;">a</span>');
    expect(uma).toBe('<span style="font-family: &quot;DM Sans&quot;">a</span>');
    expect(sanitizeRich(uma)).toBe(uma);
  });
});
