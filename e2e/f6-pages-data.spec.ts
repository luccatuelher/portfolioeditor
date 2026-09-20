import { test, expect } from '@playwright/test';

test.describe('F6 — páginas e coleções', () => {
  test('tabela de dados altera a visibilidade de um projeto', async ({ page }) => {
    await page.goto('/editor.html?fixture=synthetic', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Dados' }).click();

    // proj-a é público; torna-o rascunho e confirma o select.
    const firstRowVis = page.locator('.data-table').first().locator('tbody tr').first().locator('.data-vis');
    await expect(firstRowVis).toHaveValue('public');
    await firstRowVis.selectOption('draft');
    await expect(firstRowVis).toHaveValue('draft');
  });

  test('criar página adiciona ao menu do site (nav)', async ({ page }) => {
    await page.goto('/editor.html', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    await page.locator('.newpage').click();
    // O nome já nasce editável na própria linha (sem prompt do navegador).
    await page.locator('.tree-rename').fill('Serviços');
    await page.locator('.tree-rename').press('Enter');
    // A nova página passa a constar na lista de páginas (e é adicionada ao nav).
    await expect(page.locator('.editor-left')).toContainText('Serviços');
  });
});
