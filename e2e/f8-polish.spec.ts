import { test, expect } from '@playwright/test';

test.describe('F8 — polimento', () => {
  test('ocultar no mobile aplica a classe no bloco do canvas', async ({ page }) => {
    await page.goto('/editor.html', { waitUntil: 'load' });
    await page.locator('.editor-canvas .block-heading', { hasText: 'Selected Work' }).click();
    await page.locator('.insp-tab', { hasText: 'Layout' }).click();
    // A opção fica no grupo recolhível "Mostrar em cada tela" da aba Layout.
    const grupo = page.locator('.insp-group', { hasText: 'Mostrar em cada tela' });
    if (!(await grupo.getAttribute('open') !== null)) await grupo.locator('summary').click();
    await page.locator('.insp-check', { hasText: 'Ocultar no celular' }).locator('input').check();
    await expect(page.locator('.editor-canvas .block-heading.hide-mobile')).toBeVisible();
  });

  test('página nova mostra estado vazio de seção', async ({ page }) => {
    await page.goto('/editor.html', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    page.once('dialog', (d) => d.accept('Vazia'));
    await page.locator('.newpage').click();
    await expect(page.locator('.editor-canvas .canvas-add-block').first()).toBeVisible();
  });

  test('imagens usam lazy-load e decoding async', async ({ page }) => {
    await page.goto('/preview.html?route=gallery', { waitUntil: 'load' });
    const img = page.locator('.art-img').first();
    await expect(img).toHaveAttribute('loading', 'lazy');
    await expect(img).toHaveAttribute('decoding', 'async');
  });
});
