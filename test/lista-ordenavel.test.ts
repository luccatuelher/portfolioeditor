import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guarda estática: todo `DndContext` do editor usa o mecanismo ÚNICO de
 * listaOrdenavel.ts (mouse + teclado, anúncios em português, colisão e medição
 * comuns). Lista arrastável nova que esquece disso só move com o mouse.
 */
const pasta = join(__dirname, '..', 'src', 'editor');
const arquivos = readdirSync(pasta).filter((f) => f.endsWith('.tsx'));

describe('listas arrastáveis do editor', () => {
  it('há listas arrastáveis para guardar', () => {
    const total = arquivos.reduce((n, f) => n + (readFileSync(join(pasta, f), 'utf8').match(/<DndContext\b/g)?.length ?? 0), 0);
    expect(total).toBe(8);
  });

  for (const f of arquivos) {
    const src = readFileSync(join(pasta, f), 'utf8');
    const contextos = src.match(/<DndContext\b[^>]*>/g) ?? [];
    if (!contextos.length) continue;
    it(`${f}: todo DndContext usa os sensores, anúncios, colisão e medição comuns`, () => {
      for (const c of contextos) {
        expect(c, c).toContain('sensors={sensors}');
        expect(c, c).toContain('accessibility={ACESSIBILIDADE_DA_LISTA}');
        expect(c, c).toContain('measuring={MEDICAO_DA_LISTA}');
        expect(c, c).toContain('collisionDetection={COLISAO_DA_LISTA}');
      }
      expect(src).not.toMatch(/useSensor\(PointerSensor/);
      expect(src).toMatch(/const sensors = useSensoresDaLista\(\)/);
    });
  }
});
