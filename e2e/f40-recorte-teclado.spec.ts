import { test, expect, type Page } from '@playwright/test';

// O recorte faz pelo teclado tudo o que faz pelo mouse: a moldura recebe foco,
// setas movem, + e − mudam o tamanho, Alt+setas (proporção livre) mudam
// largura/altura e Enter aplica.
const caixa = (page: Page): Promise<{ x: number; y: number; w: number; h: number }> =>
  page.locator('.crop-rect').evaluate((el) => {
    const s = (el as HTMLElement).style;
    return { x: parseFloat(s.left), y: parseFloat(s.top), w: parseFloat(s.width), h: parseFloat(s.height) };
  });

test.describe('Recorte pelo teclado', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await expect(page.locator('.editor-canvas .project-card').first()).toBeVisible();
  });

  test('capa do projeto (16:9): Tab até a moldura, − diminui, setas movem, Enter aplica', async ({ page }) => {
    const card = page.locator('.editor-canvas .project-card').first();
    await card.hover();
    await card.locator('.pe-act-crop').click();
    const rect = page.locator('.crop-rect');
    await expect(rect).toBeVisible();

    // Alcançável pelo Tab (o foco fica preso no diálogo).
    for (let i = 0; i < 15 && !(await rect.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(rect).toBeFocused();

    const antes = await caixa(page);
    for (let i = 0; i < 4; i++) await page.keyboard.press('-');
    const menor = await caixa(page);
    expect(menor.w).toBeLessThan(antes.w);
    // A proporção travada se mantém ao diminuir.
    expect(Math.abs(menor.w / menor.h - antes.w / antes.h)).toBeLessThan(0.01);

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    const movido = await caixa(page);
    expect(movido.x).toBeGreaterThan(menor.x);
    expect(movido.y).toBeGreaterThan(menor.y);
    expect(movido.w).toBeCloseTo(menor.w, 5);

    await page.keyboard.press('Enter');
    await expect(page.locator('.crop-modal')).toHaveCount(0);
    await expect(card.locator('.card-thumb.img-crop')).toHaveCount(1);
  });

  test('galeria (proporção livre): Alt+setas mudam largura e altura', async ({ page }) => {
    await page.locator('.editor-canvas .nav-link', { hasText: 'Galeria' }).first().click();
    const item = page.locator('.editor-canvas .art-item').first();
    await item.hover();
    await item.locator('.pe-act-crop').click();
    const rect = page.locator('.crop-rect');
    await rect.focus();
    const antes = await caixa(page);
    await page.keyboard.press('Shift+Alt+ArrowLeft');
    await page.keyboard.press('Alt+ArrowUp');
    const depois = await caixa(page);
    expect(depois.w).toBeLessThan(antes.w);
    expect(depois.h).toBeLessThan(antes.h);
    await expect(page.locator('.crop-hint')).toContainText('Alt');
  });
});
