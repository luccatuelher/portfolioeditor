import { test, expect } from '@playwright/test';

// Arrastar até a borda da área do canvas faz a página rolar sozinha — senão só
// dá para soltar no que já está na tela.
test.describe('Arrastar no canvas: rolagem automática', () => {
  test.use({ viewport: { width: 1280, height: 560 } });

  test('perto da borda de baixo o canvas rola; ao soltar, para', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    const wrap = page.locator('.editor-canvas-wrap');
    await expect(page.locator('.editor-canvas .block .pe-drag-handle').first()).toBeAttached();

    const podeRolar = await wrap.evaluate((el) => el.scrollHeight > el.clientHeight + 100);
    expect(podeRolar).toBe(true);

    const handle = await page.locator('.editor-canvas .block .pe-drag-handle').first().elementHandle();
    const dt = await page.evaluateHandle(() => new DataTransfer());
    await handle!.dispatchEvent('dragstart', { dataTransfer: dt });

    const box = (await wrap.boundingBox())!;
    const y = box.y + box.height - 8;
    const x = box.x + box.width / 2;
    const antes = await wrap.evaluate((el) => el.scrollTop);
    // Um único dragover basta: o laço segue rolando mesmo sem novos eventos.
    await wrap.dispatchEvent('dragover', { dataTransfer: dt, clientX: x, clientY: y });
    await expect.poll(() => wrap.evaluate((el) => el.scrollTop)).toBeGreaterThan(antes + 40);

    // Ao terminar o arrasto a rolagem para.
    await page.locator('.editor-canvas').dispatchEvent('dragend', { dataTransfer: dt });
    const parado = await wrap.evaluate((el) => el.scrollTop);
    await page.waitForTimeout(250);
    expect(await wrap.evaluate((el) => el.scrollTop)).toBe(parado);
  });

  test('no meio da área não rola', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    const wrap = page.locator('.editor-canvas-wrap');
    await expect(page.locator('.editor-canvas .block .pe-drag-handle').first()).toBeAttached();
    const handle = await page.locator('.editor-canvas .block .pe-drag-handle').first().elementHandle();
    const dt = await page.evaluateHandle(() => new DataTransfer());
    await handle!.dispatchEvent('dragstart', { dataTransfer: dt });
    const box = (await wrap.boundingBox())!;
    await wrap.dispatchEvent('dragover', { dataTransfer: dt, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
    await page.waitForTimeout(250);
    expect(await wrap.evaluate((el) => el.scrollTop)).toBe(0);
    await page.locator('.editor-canvas').dispatchEvent('dragend', { dataTransfer: dt });
  });
});
