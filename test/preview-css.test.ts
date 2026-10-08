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
    // Quebra de linha não conta: o git devolve o arquivo com CRLF no Windows.
    const ler = (): string => readFileSync('src/editor/preview.generated.css', 'utf8').replace(/\r\n/g, '\n');
    const antes = ler();
    execFileSync(process.execPath, ['scripts/gen-preview-css.mjs'], { stdio: 'pipe' });
    expect(ler(), 'rode: npm run gen:preview').toBe(antes);
  });

  it('o @import da prévia vem antes de qualquer regra (senão o navegador o ignora)', () => {
    // Uma regra acima do @import desligava a prévia de tablet e celular inteira, sem erro.
    const css = readFileSync('src/editor/editor.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const antesDoImport = css.slice(0, css.indexOf('@import')).trim();
    expect(css.indexOf('@import')).toBeGreaterThanOrEqual(0);
    expect(antesDoImport).toBe('');
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

  it('a impressão é um @media print puro: fica fora da prévia do editor', () => {
    // `@media print and (max-width…)` seria lido como regra de largura e vazaria para .pv-mobile.
    const site = readFileSync('src/renderer/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(site).toMatch(/@media print\s*\{/);
    expect(site).not.toMatch(/@media print\s+and/);
    const gerado = readFileSync('src/editor/preview.generated.css', 'utf8');
    expect(gerado).not.toMatch(/@media print|embed-area::after|@page|\.skip-link/);
  });
});
