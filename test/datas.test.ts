import { describe, expect, it } from 'vitest';
import { dataHora, hora } from '../src/core/datas';

// Datas do editor: dia/mês/ano e relógio de 24 h, seja qual for o idioma do navegador.
describe('datas no formato brasileiro', () => {
  const tarde = new Date(2026, 10, 8, 20, 13, 48); // 8 de novembro, 20:13 (hora local)
  const manha = new Date(2026, 0, 3, 7, 5);

  it('dia antes do mês, 24 h, sem segundos', () => {
    expect(dataHora(tarde)).toBe('08/11 20:13');
    expect(dataHora(manha)).toBe('03/01 07:05');
  });

  it('com o ano, quando pedido', () => {
    expect(dataHora(tarde, { ano: true })).toBe('08/11/26 20:13');
  });

  it('aceita milissegundos e texto ISO', () => {
    expect(dataHora(tarde.getTime())).toBe('08/11 20:13');
    expect(dataHora(tarde.toISOString())).toBe('08/11 20:13');
  });

  it('só a hora', () => {
    expect(hora(tarde)).toBe('20:13');
    expect(hora(manha)).toBe('07:05');
  });

  it('data inválida vira texto vazio, não "Invalid Date"', () => {
    expect(dataHora('não é data')).toBe('');
    expect(hora('não é data')).toBe('');
  });
});
