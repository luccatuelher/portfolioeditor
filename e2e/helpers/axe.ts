import { expect, type Page } from '@playwright/test';

/**
 * Auditoria de acessibilidade (axe-core: WCAG 2.1 A/AA + boas práticas) da
 * tela como está agora. Um lugar só para todos os testes — antes cada um
 * tinha a sua cópia da chamada. Injeta o axe na página se ainda não houver.
 */
export async function auditarAcessibilidade(page: Page, onde: string): Promise<void> {
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  const violacoes = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (c: Document, o: object) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
    const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] });
    return r.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' · ')}`);
  });
  expect(violacoes, `acessibilidade em ${onde}`).toEqual([]);
}
