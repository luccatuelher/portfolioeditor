import { test, expect } from '@playwright/test';

test.describe('Primeiro uso e estados vazios', () => {
  test('criar página não usa prompt do navegador e já abre o nome para digitar', async ({ page }) => {
    let prompts = 0;
    page.on('dialog', async (d) => { prompts++; await d.accept('x'); });
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });

    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    await page.locator('button', { hasText: 'Nova página' }).click();

    await expect(page.locator('.tree-rename')).toBeVisible();
    expect(prompts).toBe(0);

    await page.locator('.tree-rename').fill('Processo');
    await page.locator('.tree-rename').press('Enter');
    await expect(page.locator('.tree-row.pagerow').filter({ hasText: 'Processo' })).toHaveCount(1);
  });

  test('página nova convida a começar, em vez de ficar em branco', async ({ page }) => {
    page.on('dialog', async (d) => await d.accept('Processo'));
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    await page.locator('button', { hasText: 'Nova página' }).click();
    await page.locator('.tree-rename').press('Enter');

    await expect(page.locator('.editor-canvas')).toContainText('Adicionar o primeiro bloco');
    await expect(page.locator('.editor-canvas .section')).toHaveCount(1);
  });
});
