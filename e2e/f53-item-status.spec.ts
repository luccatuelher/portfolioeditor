import { test, expect } from '@playwright/test';

// Inspector do item: "Onde aparece" no topo (projeto nasce rascunho) e a
// imagem escolhida à vista no campo de capa.
test('projeto novo: publicar pelo topo do Inspector', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
  await page.locator('.data-panel button', { hasText: 'Projeto' }).click();

  const status = page.locator('.insp-status');
  await expect(status.locator('button', { hasText: 'Rascunho' })).toHaveAttribute('aria-pressed', 'true');
  await expect(status).toContainText('Só aparece aqui no editor');
  // É o primeiro controle do Inspector: vem antes do título.
  const [yStatus, yTitulo] = await Promise.all([
    status.boundingBox().then((b) => b!.y),
    page.locator('.insp-row', { hasText: 'Título' }).first().boundingBox().then((b) => b!.y),
  ]);
  expect(yStatus).toBeLessThan(yTitulo);

  await status.locator('button', { hasText: 'Público' }).click();
  await expect(status.locator('button', { hasText: 'Público' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.data-table tr', { hasText: 'Novo projeto' }).locator('select')).toHaveValue('public');
});

test('capa já escolhida aparece no campo, com "Trocar imagem…"', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
  await page.locator('.data-table button', { hasText: 'A Travessia' }).first().click();
  const capa = page.locator('.insp-row', { hasText: 'Capa' });
  await expect(capa.locator('.insp-img-atual img')).toBeVisible();
  await expect(capa.locator('button', { hasText: 'Trocar imagem' })).toBeVisible();
});
