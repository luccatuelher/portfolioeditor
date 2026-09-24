import { test, expect } from '@playwright/test';

// Excluir não pergunta antes (confirm() do navegador): exclui e oferece
// "Desfazer", que traz de volta — inclusive o projeto que estava aberto.
test.beforeEach(async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  page.on('dialog', () => { throw new Error('não devia abrir diálogo do navegador'); });
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
});

test('projeto aberto: excluir pelo Inspector e desfazer volta a ele', async ({ page }) => {
  await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
  await page.locator('.data-table button', { hasText: 'Intervalo' }).click();
  await expect(page.locator('.editor-canvas .detail-title')).toHaveText('Intervalo');
  await page.locator('.insp-delete', { hasText: 'Excluir projeto' }).click();

  const aviso = page.locator('.aviso');
  await expect(aviso).toContainText('Excluído: projeto “Intervalo”');
  await expect(page.locator('.data-table button', { hasText: 'Intervalo' })).toHaveCount(0);
  await aviso.locator('.aviso-acao').click();
  await expect(page.locator('.data-table button', { hasText: 'Intervalo' })).toHaveCount(1);
  await expect(page.locator('.editor-canvas .detail-title')).toHaveText('Intervalo');
  await expect(aviso).toHaveCount(0);
});

test('bloco pela tecla Delete; o Ctrl+Z também desfaz e o aviso sai junto', async ({ page }) => {
  const blocos = page.locator('.editor-canvas [data-block-id]');
  const antes = await blocos.count();
  await page.locator('.editor-canvas .block-image').first().click();
  await page.keyboard.press('Delete');
  await expect(blocos).toHaveCount(antes - 1);
  await expect(page.locator('.aviso')).toContainText('Excluído: bloco Imagem');
  await page.keyboard.press('Control+z');
  await expect(blocos).toHaveCount(antes);
  await expect(page.locator('.aviso')).toHaveCount(0);
});

test('página pelo painel Páginas', async ({ page }) => {
  await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
  await page.locator('.tree-del[aria-label="Excluir página Sobre"]').click();
  await expect(page.locator('.aviso')).toContainText('Excluído: página “Sobre”');
  await expect(page.locator('.tree-del[aria-label="Excluir página Sobre"]')).toHaveCount(0);
  await page.locator('.aviso-acao').click();
  await expect(page.locator('.tree-del[aria-label="Excluir página Sobre"]')).toHaveCount(1);
});
