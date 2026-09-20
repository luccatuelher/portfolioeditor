import { test, expect } from '@playwright/test';

test.describe('Duplicar e pré-visualização responsiva', () => {
  test('Ctrl+D duplica o bloco (cópia do rascunho do Immer)', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.editor-canvas .block-heading').first().click();
    const antes = await page.locator('.editor-canvas .block').count();
    await page.keyboard.press('Control+d');
    await expect(page.locator('.editor-canvas .block')).toHaveCount(antes + 1);
  });

  test('duplicar página cria uma cópia na lista', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    const linha = page.locator('.tree-row.pagerow', { hasText: 'Sobre' });
    await linha.hover();
    await linha.locator('.tree-dup').click();
    await expect(page.locator('.tree-row.pagerow', { hasText: 'cópia' })).toHaveCount(1);
  });

  test('seção pronta insere uma seção composta', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    const antes = await page.locator('.editor-canvas .section').count();
    await page.locator('.preset-tile', { hasText: 'Texto + imagem' }).click();
    await expect(page.locator('.editor-canvas .section')).toHaveCount(antes + 1);
    await expect(page.locator('.insp-head')).toContainText('Seção');
  });

  test('largura do canvas: celular mostra o layout de celular', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.tb-devices button').nth(2).click();
    await expect(page.locator('.editor-canvas.pv-mobile')).toBeVisible();
    // No celular cada card ocupa a linha inteira da coleção.
    const largura = await page.locator('.editor-canvas .collection-grid').first().evaluate((el) => {
      const card = el.querySelector('.project-card, .blog-item');
      return card ? Math.round(card.getBoundingClientRect().width / el.getBoundingClientRect().width * 100) : 0;
    });
    expect(largura).toBeGreaterThan(95);
  });
});
