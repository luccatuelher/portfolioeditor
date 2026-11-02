import { test, expect } from '@playwright/test';

// Ctrl+V com uma imagem na área de transferência vira um bloco de imagem (sem abrir o seletor).
const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('colar uma imagem cria um bloco de imagem', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.waitForSelector('.editor-canvas .block-image img');
  const antes = await page.locator('.editor-canvas .block-image').count();
  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'colada.png', { type: 'image/png' }));
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, PNG_1PX);
  await expect(page.locator('.editor-canvas .block-image')).toHaveCount(antes + 1);
});
