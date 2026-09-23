import { test, expect } from '@playwright/test';

// Com um diálogo na frente, os atalhos do editor não podem mexer no documento
// que está por trás dele.
test.describe('Diálogo aberto segura os atalhos', () => {
  test('Delete, Backspace e Esc com Versões aberto não mexem no documento', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    const titulos = page.locator('.editor-canvas .block-heading');
    await expect(titulos.first()).toBeVisible();
    const n = await titulos.count();

    await titulos.first().click();
    await expect(page.locator('.editor-canvas .block-heading.is-selected')).toHaveCount(1);
    await page.locator('.tb-btn', { hasText: 'Versões' }).click();
    await page.locator('.versions-modal .modal-head button').focus();

    await page.keyboard.press('Delete');
    await expect(titulos).toHaveCount(n);
    await page.keyboard.press('Backspace');
    await expect(titulos).toHaveCount(n);

    // O Esc fecha só o diálogo: a seleção atrás dele continua a mesma.
    await page.keyboard.press('Escape');
    await expect(page.locator('.versions-modal')).toHaveCount(0);
    await expect(page.locator('.editor-canvas .block-heading.is-selected')).toHaveCount(1);

    // Sem diálogo, o Delete volta a valer.
    await page.keyboard.press('Delete');
    await expect(titulos).toHaveCount(n - 1);
  });
});
