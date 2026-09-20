import { test, expect } from '@playwright/test';

test.describe('CRUD de itens de coleção', () => {
  test('criar projeto, editar título e ver na lista', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    await page.locator('.add-block-btn', { hasText: 'Adicionar projeto' }).click();
    await expect(page.locator('.insp-head')).toContainText('Projeto');
    await page.locator('.insp-i18n-field input[data-lang="pt"]').first().fill('Meu Projeto Novo');
    await expect(page.locator('.editor-left')).toContainText('Meu Projeto Novo');
  });

  test('adicionar imagem na galeria pelo painel Dados', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
    await page.locator('.add-block-btn', { hasText: 'Imagem na galeria' }).click();
    await expect(page.locator('.insp-head')).toContainText('Imagem da galeria');
  });
});
