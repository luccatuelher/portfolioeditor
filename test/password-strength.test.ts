import { describe, expect, it } from 'vitest';
import { medirForca, sugerirSenha, TAMANHO_MINIMO } from '../src/publish/passwordStrength';

describe('força da senha do NDA', () => {
  it('recusa o que não protege um arquivo que o atacante já tem', () => {
    for (const s of ['', '123', 'abc', '1234567']) {
      const f = medirForca(s);
      expect(f.aceitavel, s).toBe(false);
      expect(f.problemas.length).toBeGreaterThan(0);
    }
  });

  it('recusa as senhas mais tentadas do mundo, mesmo com tamanho', () => {
    expect(medirForca('12345678').aceitavel).toBe(false);
    expect(medirForca('password').aceitavel).toBe(false);
    expect(medirForca('aaaaaaaaaa').aceitavel).toBe(false);
  });

  it('só números passa, mas com nível baixo e recado claro', () => {
    const f = medirForca('90817263541');
    expect(f.aceitavel).toBe(true);
    expect(f.nivel).toBeLessThanOrEqual(1);
    expect(f.problemas.join(' ')).toContain('números');
  });

  it('frase longa vale mais que senha curta cheia de símbolos', () => {
    expect(medirForca('meu-cavalo-azul-atravessa-a-ponte').nivel).toBeGreaterThan(medirForca('aB3$xY!z').nivel);
  });

  it('senha confortável chega ao topo', () => {
    const f = medirForca('Traco-Luz-Sombra-42x');
    expect(f.aceitavel).toBe(true);
    expect(f.nivel).toBe(4);
    expect(f.problemas).toEqual([]);
  });

  it('a sugestão é sempre aceitável e nunca se repete', () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const s = sugerirSenha();
      expect(medirForca(s).aceitavel).toBe(true);
      expect(s.length).toBeGreaterThanOrEqual(TAMANHO_MINIMO);
      vistas.add(s);
    }
    expect(vistas.size).toBeGreaterThan(15);
  });

  it('espaço em volta não conta como tamanho', () => {
    expect(medirForca('   abc   ').aceitavel).toBe(false);
  });
});
