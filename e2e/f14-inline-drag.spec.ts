import { test, expect } from '@playwright/test';

test.describe('Edição inline + arrastar no canvas', () => {
  test('editar um título inline no canvas', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.editor-canvas .block-heading', { hasText: 'Selected Work' }).click();
    const editable = page.locator('.editor-canvas .block-heading .inline-edit');
    await expect(editable).toBeVisible();
    await editable.click();
    await editable.pressSequentially(' EDITADO');
    await expect(editable).toContainText('Selected Work EDITADO');
  });

  test('toolbar flutuante aparece ao editar um bloco de texto', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    await page.locator('.tree-row .tree-main', { hasText: 'Sobre' }).click();
    await page.locator('.editor-canvas .block-text').first().click();
    const editable = page.locator('.editor-canvas .block-text .inline-edit').first();
    await expect(editable).toBeVisible();
    await editable.click();
    await expect(page.locator('.pe-toolbar')).toBeVisible();
  });

  test('blocos têm alça de arrastar no canvas', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await expect(page.locator('.editor-canvas .block .pe-drag-handle').first()).toBeAttached();
  });
});
