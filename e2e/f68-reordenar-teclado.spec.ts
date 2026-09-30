import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Guarda: toda lista arrastável do editor também reordena pelo teclado
 * (Espaço pega, ↓ move, Espaço solta, ↑ volta, Esc cancela). Antes só o mouse
 * movia: a alça recebia foco e se anunciava "reordenável" sem fazer nada.
 * Cobre as 8 listas: projetos, notas, galeria e sketches (Dados), blocos e
 * seções (Layers), páginas e itens sob cada página (Páginas).
 */
const texto = (l: Locator): Promise<string[]> => l.allInnerTexts().then((t) => t.map((s) => s.replace(/\s+/g, ' ').trim()));
const viva = (page: Page): Promise<string> => page.locator('[id^="DndLiveRegion"]').allInnerTexts().then((t) => t.join(' '));
const pausa = (page: Page): Promise<void> => page.waitForTimeout(250);

/** Pega a alça, aperta `tecla` e solta — devolve o que o leitor de tela ouviu. */
async function mover(page: Page, alca: Locator, tecla: 'ArrowDown' | 'ArrowUp'): Promise<string> {
  await alca.focus();
  await page.keyboard.press('Space');
  await pausa(page);
  await page.keyboard.press(tecla);
  await pausa(page);
  await page.keyboard.press('Space');
  await pausa(page);
  return viva(page);
}

/** Desce o 1º item da lista, confere a troca com o 2º, sobe de volta e confere. */
async function trocaPorTeclado(page: Page, alcas: Locator, nomes: Locator, onde: string): Promise<void> {
  expect(await alcas.count(), `${onde}: precisa de ao menos 2 itens`).toBeGreaterThan(1);
  const antes = await texto(nomes);
  const falou = await mover(page, alcas.first(), 'ArrowDown');
  expect(falou, `${onde}: anúncio em português`).toMatch(/Solto na posição 2/);
  const depois = await texto(nomes);
  expect(depois[0], `${onde}: 1º virou o 2º`).toBe(antes[1]);
  expect(depois[1], `${onde}: 2º virou o 1º`).toBe(antes[0]);
  await mover(page, alcas.nth(1), 'ArrowUp');
  expect(await texto(nomes), `${onde}: ↑ desfaz`).toEqual(antes);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await expect(page.locator('.left-tabs')).toBeVisible();
});

test('Dados: projetos, notas, galeria e sketches reordenam pelo teclado', async ({ page }) => {
  await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
  const tabelas = page.locator('.data-panel table');
  let testadas = 0;
  for (let i = 0; i < (await tabelas.count()); i++) {
    const t = tabelas.nth(i);
    if ((await t.locator('.tree-grip').count()) < 2) continue;
    await trocaPorTeclado(page, t.locator('.tree-grip'), t.locator('.data-name'), `Dados, tabela ${i + 1}`);
    testadas++;
  }
  // O exemplo tem projetos, notas e mais uma coleção com 2+ itens; coleção de 1 item não tem o que mover.
  expect(testadas, 'tabelas com 2+ itens').toBeGreaterThanOrEqual(3);
});

test('Layers: blocos de uma seção e as seções reordenam pelo teclado', async ({ page }) => {
  await page.locator('.left-tabs button', { hasText: 'Layers' }).click();
  const secoes = page.locator('.editor-left .tree-section');
  // 2ª seção da Home tem dois blocos.
  const sec = secoes.nth(1);
  await trocaPorTeclado(page, sec.locator('.tree-row.blk .tree-grip'), sec.locator('.tree-row.blk .tree-main'), 'Layers, blocos');
  // Seções se chamam "Seção N" pela posição: quem prova a troca é a ordem dos blocos.
  const blocos = secoes.locator('.tree-row.blk .tree-main');
  const antes = await texto(blocos);
  const alcas = secoes.locator('.tree-row.sec .tree-grip');
  expect(await mover(page, alcas.first(), 'ArrowDown'), 'Layers, seções: anúncio').toMatch(/Solto na posição 2/);
  const depois = await texto(blocos);
  expect(depois, 'Layers, seções: a 1ª desceu').not.toEqual(antes);
  await mover(page, alcas.nth(1), 'ArrowUp');
  expect(await texto(blocos), 'Layers, seções: ↑ desfaz').toEqual(antes);
});

test('Páginas: páginas e os projetos sob cada uma reordenam pelo teclado', async ({ page }) => {
  await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
  await trocaPorTeclado(page, page.locator('.editor-left .pagerow .tree-grip'), page.locator('.editor-left .pagerow .tree-main'), 'Páginas');
  const aninhados = page.locator('.editor-left .tree-row.nested');
  await trocaPorTeclado(page, aninhados.locator('.tree-grip'), aninhados.locator('.tree-main'), 'Itens sob a página');
});

test('Esc cancela: nada muda e o leitor de tela avisa', async ({ page }) => {
  await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
  const nomes = page.locator('.editor-left .pagerow .tree-main');
  const antes = await texto(nomes);
  await page.locator('.editor-left .pagerow .tree-grip').nth(3).focus();
  await page.keyboard.press('Space');
  await pausa(page);
  await page.keyboard.press('ArrowDown');
  await pausa(page);
  await page.keyboard.press('Escape');
  await pausa(page);
  expect(await viva(page)).toMatch(/cancelado/);
  expect(await texto(nomes)).toEqual(antes);
});
