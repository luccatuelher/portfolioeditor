import { test, expect } from '@playwright/test';

// "＋" entre seções (como no Adobe Portfolio): insere uma seção nova naquele ponto, já com o bloco escolhido.
test('o "＋" entre seções insere uma seção no lugar certo', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.waitForSelector('.editor-canvas [data-section-id]');
  const idsAntes = await page.locator('.editor-canvas section[data-section-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-section-id')));
  expect(idsAntes.length).toBeGreaterThan(1);

  // Entre a 1ª e a 2ª seção: invisível até o hover.
  const faixa = page.locator('.editor-canvas .canvas-insert-section').nth(1);
  const botao = faixa.locator('button');
  await expect(botao).toHaveCSS('opacity', '0');
  await botao.scrollIntoViewIfNeeded();
  await botao.hover();
  await expect(botao).toHaveCSS('opacity', '1');
  await botao.click();
  await page.getByRole('dialog', { name: 'Adicionar bloco' }).getByRole('button', { name: /Texto/ }).first().click();

  const idsDepois = await page.locator('.editor-canvas section[data-section-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-section-id')));
  expect(idsDepois.length).toBe(idsAntes.length + 1);
  expect(idsDepois[0]).toBe(idsAntes[0]);
  expect(idsDepois[2]).toBe(idsAntes[1]);
  expect(idsAntes).not.toContain(idsDepois[1]);
  await expect(page.locator(`.editor-canvas section[data-section-id="${idsDepois[1]}"] [data-block-id]`)).toHaveCount(1);
});

test('na prévia o "＋" entre seções some', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.waitForSelector('.editor-canvas .canvas-insert-section', { state: 'attached' });
  await page.locator('.tb-previa').click();
  await expect(page.locator('.editor-canvas .canvas-insert-section').first()).toHaveCSS('display', 'none');
});
