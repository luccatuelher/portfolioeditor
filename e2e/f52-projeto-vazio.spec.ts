import { test, expect } from '@playwright/test';

// Projeto recém-criado (sem seções) tinha o canvas sem onde clicar para
// começar: o "＋ Adicionar bloco" mora dentro das seções.
test('projeto novo: o canvas oferece o primeiro bloco e cria a seção junto', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
  await page.locator('.data-panel button', { hasText: 'Projeto' }).click();
  await expect(page.locator('.editor-canvas .detail-title')).toHaveText('Novo projeto');

  const primeiro = page.locator('.editor-canvas .canvas-vazio .canvas-add-block');
  await expect(primeiro).toHaveText('＋ Adicionar o primeiro bloco');
  await primeiro.click();
  await page.locator('.element-tile', { hasText: 'Texto' }).click();

  await expect(page.locator('.editor-canvas [data-block-id]')).toHaveCount(1);
  await expect(page.locator('.editor-canvas .canvas-vazio')).toHaveCount(0);
  await expect(page.locator('.insp-head')).toHaveText('Texto');
});

test('nota nova pelo teclado: o primeiro bloco é um botão de verdade (Enter abre o menu)', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
  await page.locator('.data-panel button', { hasText: 'Nota' }).click();
  const primeiro = page.locator('.editor-canvas .canvas-vazio .canvas-add-block');
  await primeiro.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.element-tile', { hasText: 'Título' })).toBeVisible();
});
