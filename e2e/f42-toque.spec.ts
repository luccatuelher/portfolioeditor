import { test, expect } from '@playwright/test';

// Editor no toque (tablet): arrastar a largura funciona com o dedo e os
// ícones de ação dos itens não dependem de hover. Toques de verdade (CDP),
// não cliques de mouse.
test.describe('Editor no toque', () => {
  test.use({ viewport: { width: 1280, height: 900 }, hasTouch: true, isMobile: true });

  test.beforeEach(async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await expect(page.locator('.editor-canvas .block-image').first()).toBeVisible();
  });

  test('arrastar a alça de largura com o dedo muda a largura (a página não rouba o gesto)', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    const toque = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const bloco = page.locator('.editor-canvas .block-image').first();
    await bloco.tap();
    const alca = bloco.locator(':scope > .pe-span-handle');
    const b = (await alca.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(24); // área de toque de verdade
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await toque('touchStart', x, y);
    for (let i = 1; i <= 8; i++) await toque('touchMove', x - i * 40, y);
    await toque('touchEnd');
    await expect.poll(() => bloco.evaluate((el) => Number(getComputedStyle(el).getPropertyValue('--span')))).toBeLessThanOrEqual(6);
  });

  test('ícones de ação dos cards à mostra sem hover; tocar em "Editar" abre o item', async ({ page }) => {
    const card = page.locator('.editor-canvas .project-card').first();
    const acoes = card.locator('.pe-actions');
    await expect(acoes).toHaveCSS('opacity', '1');
    await card.locator('.pe-act-edit').tap();
    await expect(page.locator('.insp-head')).toContainText('Projeto');
  });
});

test('com mouse, o card selecionado mantém os ícones (como os blocos)', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  const card = page.locator('.editor-canvas .project-card').first();
  await card.hover();
  await card.locator('.pe-act-edit').click();
  await page.mouse.move(2, 2);
  await expect(card).toHaveClass(/is-selected/);
  await expect(card.locator('.pe-actions')).toHaveCSS('opacity', '1');
});
