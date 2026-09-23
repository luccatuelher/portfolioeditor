import { test, expect } from '@playwright/test';

test.describe('Lacunas do portfolio.html', () => {
  test('card de projeto abre pelo teclado (Enter)', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/preview.html?route=projects', { waitUntil: 'load' });
    const card = page.locator('.project-card', { hasText: 'A Travessia' });
    // Card que leva à página do projeto é link de verdade (Tab, Enter, nova aba).
    await expect(card).toHaveAttribute('href', /^#project\//);
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.detail-title', { hasText: 'A Travessia' })).toBeVisible();
  });

  test('alça universal de largura: arrastar muda a largura do bloco no grid', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    const blk = page.locator('.editor-canvas .block-image').first();
    await blk.hover();
    const handle = blk.locator(':scope > .pe-span-handle');
    await expect(handle).toBeVisible();
    const box = await blk.boundingBox();
    const hb = await handle.boundingBox();
    if (box && hb) {
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.5, hb.y + hb.height / 2, { steps: 6 });
      await page.mouse.up();
    }
    await expect(page.locator('.editor-canvas .block-image').first()).toHaveAttribute('style', /--span: 6/);
  });
});
