import { describe, expect, it } from 'vitest';
import { combinarStatus, explicarFalha } from '../src/editor/useLocalDraft';

describe('status da gravação (documento + imagens)', () => {
  it('um canal com erro é erro, mesmo que o outro tenha acabado de gravar', () => {
    expect(combinarStatus('ok', 'erro', true)).toBe('error');
    expect(combinarStatus('erro', 'ok', true)).toBe('error');
    expect(combinarStatus('salvando', 'erro', true)).toBe('error');
  });
  it('gravando em qualquer canal é "salvando"; nada gravado ainda é "idle"', () => {
    expect(combinarStatus('ok', 'salvando', true)).toBe('saving');
    expect(combinarStatus('ok', 'ok', false)).toBe('idle');
    expect(combinarStatus('ok', 'ok', true)).toBe('saved');
  });
  it('espaço cheio é dito com essas palavras', () => {
    expect(explicarFalha(new DOMException('x', 'QuotaExceededError'))).toMatch(/espaço deste navegador/);
    expect(explicarFalha(new Error('disco'))).toMatch(/recusou a gravação \(disco\)/);
  });
});
