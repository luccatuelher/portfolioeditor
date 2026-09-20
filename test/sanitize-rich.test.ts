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
});
