import { test, expect } from '@playwright/test';

// Desfazer/refazer dizem o que vai mudar, e o atalho avisa o que mudou.
test('botões e aviso de desfazer/refazer nomeiam a mudança', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  const titulos = page.locator('.editor-canvas .block-heading');
  await expect(titulos.first()).toBeVisible();
  const n = await titulos.count();

  const desfazer = page.locator('.tb-center button[title^="Desfazer"], .tb-center button[title="Nada para desfazer"]').first();
  await expect(desfazer).toHaveAttribute('title', 'Nada para desfazer');

  await titulos.first().click();
  await page.keyboard.press('Delete');
  await expect(titulos).toHaveCount(n - 1);
  await expect(desfazer).toHaveAttribute('title', 'Desfazer: exclusão de elemento (Ctrl+Z)');

  await page.keyboard.press('Control+z');
  await expect(titulos).toHaveCount(n);
  await expect(page.locator('.tb-historico')).toHaveText('Desfeito: exclusão de elemento');
  await expect(page.locator('.tb-center button[title^="Refazer"]')).toHaveAttribute('title', 'Refazer: exclusão de elemento (Ctrl+Shift+Z)');

  await page.keyboard.press('Control+Shift+z');
  await expect(titulos).toHaveCount(n - 1);
  await expect(page.locator('.tb-historico')).toHaveText('Refeito: exclusão de elemento');
});
