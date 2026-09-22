import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * O CSS da prévia (tablet/celular do editor) é GERADO do CSS do site. Este
 * teste falha se alguém mexer no responsivo e esquecer de regerar — foi
 * exatamente assim que a prévia de tablet passou a mostrar 30px a mais que o
 * site de verdade.
 */
describe('CSS da prévia gerado', () => {
  it('está em dia com o CSS do site', () => {
    const antes = readFileSync('src/editor/preview.generated.css', 'utf8');
    execFileSync(process.execPath, ['scripts/gen-preview-css.mjs'], { stdio: 'pipe' });
    const depois = readFileSync('src/editor/preview.generated.css', 'utf8');
    expect(depois, 'rode: npm run gen:preview').toBe(antes);
  });

  it('não sobrou espelho escrito à mão no editor.css', () => {
    const css = readFileSync('src/editor/editor.css', 'utf8');
    const espelhos = [...css.matchAll(/^\.pv-(tablet|mobile)\s+[^{]*\{/gm)].map((m) => m[0]);
    expect(espelhos, 'regras de prévia devem ser geradas, não escritas à mão').toEqual([]);
  });

  it('converte as unidades de janela: no canvas, vw não é a largura da tela', () => {
    const gerado = readFileSync('src/editor/preview.generated.css', 'utf8');
    expect(gerado).not.toMatch(/\d+vw/);
  });
});
