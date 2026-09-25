import { test, expect, type Page } from '@playwright/test';

/**
 * Guarda ampla do editor: abre TODA página, todo projeto e toda nota, seleciona
 * cada elemento (pelo painel Layers — clicar no canvas pode acionar o conteúdo
 * do bloco, como o card de uma coleção) e passa pelas quatro abas do
 * Inspector. Qualquer erro de JavaScript, tela de erro do editor ou elemento
 * com defeito derruba o teste — seja qual for o tipo de bloco ou a página.
 */
const ABAS = ['Conteúdo', 'Layout', 'Estilo', 'Visibilidade'];

/**
 * Auditoria de acessibilidade (axe-core, WCAG 2.1 A/AA + boas práticas) da tela
 * como está — todas as regras, inclusive a de botão dentro de botão.
 */
async function auditar(page: Page, onde: string): Promise<void> {
  const v = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (c: Document, o: object) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> } }).axe;
    const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] });
    return r.violations.map((x) => `${x.id}: ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' · ')}`);
  });
  expect(v, `acessibilidade do editor em ${onde}`).toEqual([]);
}

/** Tipos de bloco que já passaram pelas quatro abas (uma vez por tipo basta). */
const tiposVistos = new Set<string>();
let elementosVisitados = 0;

async function percorrerBlocos(page: Page, onde: string): Promise<void> {
  await page.locator('.left-tabs button', { hasText: 'Layers' }).click();
  const linhas = page.locator('.editor-left .tree-row.blk .tree-main');
  const n = await linhas.count();
  for (let i = 0; i < n; i++) {
    const linha = linhas.nth(i);
    const tipo = (await linha.innerText()).replace('◈', '').trim();
    await linha.click();
    await expect(page.locator('.insp-head'), `Inspector em ${onde} (${tipo}, ${i + 1}º)`).toBeVisible();
    elementosVisitados++;
    if (tiposVistos.has(tipo)) continue;
    tiposVistos.add(tipo);
    for (const aba of ABAS) {
      await page.locator('.insp-tab', { hasText: aba }).click();
      await auditar(page, `${onde} · ${tipo} · ${aba}`);
    }
    await page.locator('.insp-tab', { hasText: 'Conteúdo' }).click();
  }
  await expect(page.locator('.block-defeito, .tela-de-erro'), `defeito em ${onde}`).toHaveCount(0);
}

test('toda página, projeto e nota abre, e todo elemento aceita seleção e as abas do Inspector', async ({ page }) => {
  test.setTimeout(120_000);
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await page.route(/youtube|youtu\.be|vimeo|speakerdeck|ytimg|fonts\.googleapis|fonts\.gstatic/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  for (const aba of ['Tema', 'Dados']) {
    await page.locator('.left-tabs button', { hasText: aba }).click();
    await auditar(page, `aba ${aba}`);
  }
  await page.locator('.tb-btn', { hasText: 'Versões' }).click();
  await auditar(page, 'janela de Versões');
  await page.keyboard.press('Escape');

  // Páginas: pela árvore do painel Páginas.
  const paginas = page.locator('.editor-left .tree-row.pagerow .tree-main');
  await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
  const nPaginas = await paginas.count();
  expect(nPaginas).toBeGreaterThan(3);
  for (let i = 0; i < nPaginas; i++) {
    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    const nome = (await paginas.nth(i).innerText()).trim();
    await paginas.nth(i).click();
    await percorrerBlocos(page, `página ${nome}`);
  }

  // Projetos e notas: pela tabela do painel Dados.
  for (const tabela of [0, 1]) {
    await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
    const n = await page.locator('.data-table').nth(tabela).locator('.data-name').count();
    for (let i = 0; i < n; i++) {
      await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
      const item = page.locator('.data-table').nth(tabela).locator('.data-name').nth(i);
      const nome = (await item.innerText()).trim();
      await item.click();
      await expect(page.locator('.editor-canvas .detail-title')).toBeVisible();
      await percorrerBlocos(page, `${tabela ? 'nota' : 'projeto'} ${nome}`);
    }
  }
  expect(erros).toEqual([]);
  // Alcance: o teste passou por muitos elementos e por todos os tipos do exemplo.
  expect(elementosVisitados).toBeGreaterThan(20);
  expect(tiposVistos.size).toBeGreaterThanOrEqual(8);
});
