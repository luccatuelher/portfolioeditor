import { test, expect } from '@playwright/test';

test.describe('F4 — visualizador de imagem', () => {
  test('abre em overlay, navega com setas e fecha com Esc / clique fora', async ({ page }) => {
    await page.goto('/preview.html?route=gallery', { waitUntil: 'load' });
    await page.locator('.art-img-btn').first().click();

    const box = page.locator('.lightbox');
    await expect(box).toBeVisible();
    await expect(box.locator('.lightbox-count')).toContainText('1 /');
    await expect(page.locator('.reader-toolbar')).toHaveCount(0);

    await page.keyboard.press('ArrowRight');
    await expect(box.locator('.lightbox-count')).toContainText('2 /');

    await page.keyboard.press('Escape');
    await expect(box).toHaveCount(0);

    await page.locator('.art-img-btn').first().click();
    await box.click({ position: { x: 5, y: 5 } });
    await expect(box).toHaveCount(0);
  });
});
