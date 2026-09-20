import { test, expect } from '@playwright/test';

test.describe('F5 — tokens globais', () => {
  test('mudar o token de destaque atualiza a variável CSS do site', async ({ page }) => {
    await page.goto('/editor.html', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Tema' }).click();

    const accent = page.locator('input[data-token="accent"]');
    await expect(accent).toBeVisible();
    await accent.fill('#00ff88');

    const value = await page.evaluate(() => getComputedStyle(document.querySelector('.editor')!).getPropertyValue('--accent').trim());
    expect(value.toLowerCase()).toBe('#00ff88');
  });
});
