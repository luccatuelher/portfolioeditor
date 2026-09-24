import { test, expect } from '@playwright/test';

// Imagem publicada sem descrição aparece na lista do painel Dados, e
// "Descrever" leva direto ao campo no Inspector.
test('imagem que perde a descrição entra na lista; Descrever leva ao campo', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
  const total = async (): Promise<number> => Number(await page.locator('.descricoes').getAttribute('data-faltam'));
  // Um bloco de imagem com descrição conhecida (nos dois idiomas)…
  const bloco = page.locator('.editor-canvas .block-image').first();
  await bloco.click();
  const alt = page.locator('.insp-row', { hasText: 'Descrição da imagem (alt)' }).locator('input');
  await alt.fill('Rua de noite');
  await alt.press('Tab');
  const antes = await total();
  // …que perde a descrição: entra na lista.
  await alt.fill('');
  await alt.press('Tab');
  await page.locator('.insp-lang', { hasText: 'EN' }).click();
  await alt.fill('');
  await alt.press('Tab');
  await expect.poll(total).toBe(antes + 1);

  // Descrever: seleciona o elemento e mostra o campo.
  await page.locator('.editor-canvas').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.locator('.descricoes > summary').click(); // a lista fica recolhida para não empurrar os dados
  await page.locator('.descricoes-ir').first().click();
  await expect(page.locator('.insp-row', { hasText: 'Descrição da imagem (alt)' })).toBeVisible();
  await expect(page.locator('.inspector [data-campo="content.image.alt"] input')).toBeFocused();
});
