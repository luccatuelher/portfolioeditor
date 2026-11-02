import { test, expect } from '@playwright/test';

// Painel Páginas: tirar uma página do menu (ela continua no ar) e trazê-la de volta, como no Adobe Portfolio.
test('tirar e devolver uma página ao menu pelo painel Páginas', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
  const linha = page.locator('.tree-row.pagerow', { hasText: 'Sobre' });
  const nome = 'Sobre';
  const menu = page.locator('.editor-canvas [data-site-header] nav');
  await expect(menu).toContainText(nome);
  await expect(linha.locator('.badge-fora-menu')).toHaveCount(0);

  await linha.hover();
  await linha.getByRole('button', { name: /Tirar do menu/ }).click();
  await expect(linha.locator('.badge-fora-menu')).toBeVisible();
  await expect(menu).not.toContainText(nome);

  await linha.getByRole('button', { name: /Mostrar no menu/ }).click();
  await expect(linha.locator('.badge-fora-menu')).toHaveCount(0);
  await expect(menu).toContainText(nome);
});
