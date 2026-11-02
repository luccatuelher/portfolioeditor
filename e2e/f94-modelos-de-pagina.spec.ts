import { test, expect } from '@playwright/test';

// "＋ Nova página" oferece modelos (como os tipos de página do Adobe Portfolio): a página já nasce montada.
test('nova página a partir do modelo Projeto já vem com capa, texto + imagem e três imagens', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
  await page.locator('.newpage').click();
  const modelos = page.getByRole('group', { name: 'Modelo da página nova' });
  await expect(modelos.getByRole('button')).toHaveCount(6);
  await modelos.getByRole('button', { name: 'Projeto' }).click();
  await expect(modelos).toHaveCount(0);
  await expect(page.locator('.tree-rename')).toHaveValue('Novo projeto');
  await page.locator('.tree-rename').fill('Curta X');
  await page.locator('.tree-rename').press('Enter');
  await expect(page.locator('.tree-row.pagerow').filter({ hasText: 'Curta X' })).toHaveCount(1);
  await expect(page.locator('.editor-canvas section[data-section-id]')).toHaveCount(3);
  await expect(page.locator('.editor-canvas .block-image')).toHaveCount(5);
});
