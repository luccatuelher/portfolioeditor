import { test, expect } from '@playwright/test';

test.describe('Preview na Home + reordenação', () => {
  test('clicar num projeto na Home abre a prévia inline', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/preview.html?route=', { waitUntil: 'load' });
    await page.locator('.project-card', { hasText: 'A Travessia' }).click();
    const prev = page.locator('.home-preview');
    await expect(prev).toBeVisible();
    await expect(prev.locator('.home-preview-title')).toContainText('A Travessia');
    await expect(prev.locator('.home-preview-go')).toBeVisible();
    await prev.locator('.home-preview-close').click();
    await expect(page.locator('.home-preview')).toHaveCount(0);
  });

  test('galeria e sketches têm alça de arrastar no painel Dados', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
    const galleryTable = page.locator('.panel-h', { hasText: 'Galeria' }).locator('xpath=following-sibling::table[1]');
    await expect(galleryTable.locator('tbody tr').first().locator('.tree-grip')).toBeVisible();
  });

  test('badges de estado aparecem nos cards do editor', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    // torna um projeto rascunho e confere o badge no card da Home
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
    await page.locator('.data-table').first().locator('tbody tr').first().locator('.data-vis').selectOption('draft');
    await expect(page.locator('.editor-canvas .edit-badge.draft').first()).toBeVisible();
  });

  test('NDA aparece no menu com cadeado (site público)', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/preview.html', { waitUntil: 'load' });
    await expect(page.locator('.site-header nav .nav-nda')).toContainText('🔒');
  });
});
