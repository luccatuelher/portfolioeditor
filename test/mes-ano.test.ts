import { describe, expect, it } from 'vitest';
import { escreverMesAno, lerMesAno } from '../src/editor/choices';

// Data da nota escolhida em listas: o editor escreve nos dois idiomas e
// reconhece o que já estava escrito, para não jogar fora a data antiga.
describe('data da nota (mês e ano)', () => {
  it('escreve em português e em inglês', () => {
    expect(escreverMesAno(9, 2026)).toEqual({ pt: 'Setembro 2026', en: 'September 2026' });
    expect(escreverMesAno(0, 2024)).toEqual({ pt: '2024', en: '2024' });
  });

  it('reconhece datas já escritas, com ou sem "de" e acento', () => {
    expect(lerMesAno({ pt: 'Setembro 2026', en: '' })).toEqual({ mes: 9, ano: 2026 });
    expect(lerMesAno({ pt: 'março de 2023', en: '' })).toEqual({ mes: 3, ano: 2023 });
    expect(lerMesAno({ pt: 'Marco 2023', en: '' })).toEqual({ mes: 3, ano: 2023 });
    expect(lerMesAno({ pt: '', en: 'October 2021' })).toEqual({ mes: 10, ano: 2021 });
    expect(lerMesAno({ pt: '2019', en: '2019' })).toEqual({ mes: 0, ano: 2019 });
  });

  it('texto que não é mês/ano fica como texto livre', () => {
    expect(lerMesAno({ pt: 'Primavera 2024', en: '' })).toBeNull();
    expect(lerMesAno({ pt: '12/03/2024', en: '' })).toBeNull();
    expect(lerMesAno({ pt: '', en: '' })).toBeNull();
  });

  it('ida e volta: o que o editor escreve ele lê de novo', () => {
    for (let mes = 0; mes <= 12; mes++) expect(lerMesAno(escreverMesAno(mes, 2025))).toEqual({ mes, ano: 2025 });
  });
});
