import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * O site grava largura e altura reais em todo <img> (reserva o espaço antes de a
 * foto chegar). Uma regra que dá proporção a uma imagem (aspect-ratio +
 * object-fit) sem `height: auto` perde para a altura gravada: a capa de uma nota
 * de 1920×1080 saía com 1080 px de altura num card de 245 px de largura.
 */
describe('imagens com proporção no CSS do site', () => {
  const css = readFileSync('src/renderer/styles.css', 'utf8');
  const regras = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, corpo]) => ({ sel: sel!.trim(), corpo: corpo! }));
  const comProporcao = regras.filter((r) => /aspect-ratio\s*:/.test(r.corpo) && /object-fit\s*:/.test(r.corpo));

  it('acha as regras (a guarda não passa vazia)', () => {
    expect(comProporcao.map((r) => r.sel)).toEqual(expect.arrayContaining(['.blog-thumb', '.contact-img']));
  });

  it.each(comProporcao.map((r) => [r.sel, r.corpo] as const))('%s libera a altura (height: auto)', (_sel, corpo) => {
    expect(corpo).toMatch(/(^|;)\s*height\s*:\s*auto/);
  });
});
