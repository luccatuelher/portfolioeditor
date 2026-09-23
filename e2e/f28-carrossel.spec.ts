import { test, expect } from '@playwright/test';

/**
 * No popup do projeto, os vídeos e apresentações dividem um carrossel — em vez
 * de empilharem e obrigarem a rolar sem saber que há mais de um.
 */
test.describe('Carrossel de vídeos na prévia do projeto', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  });

  test('com um vídeo só não há carrossel (seria moldura sem função)', async ({ page }) => {
    await page.locator('.editor-canvas .project-card').first().click();
    await expect(page.locator('.home-preview')).toBeVisible();
    await expect(page.locator('.home-preview .block-embed')).toHaveCount(1);
    await expect(page.locator('.pv-carrossel-aba')).toHaveCount(0);
  });

  test('com dois, vira carrossel com abas, setas e marcadores', async ({ page }) => {
    // acrescenta um segundo vídeo ao projeto, com nome próprio
    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    await page.locator('.tree-row.blk').filter({ hasText: 'A Travessia' }).first().click();
    await page.locator('.element-tile').filter({ hasText: 'Embed' }).click();
    await page.locator('.insp-input').nth(1).fill('https://youtu.be/dQw4w9WgXcQ');
    await page.locator('.insp-i18n-field input').last().fill('Vídeo final');

    // volta à Home e inclui o novo vídeo na prévia
    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    await page.locator('.tree-row.pagerow').filter({ hasText: 'Home' }).click();
    await page.locator('.editor-canvas .project-card').first().click();
    const chips = page.locator('.pv-chip').filter({ hasText: /Vídeo/ });
    for (let i = 0; i < (await chips.count()); i++) {
      const classe = await chips.nth(i).getAttribute('class');
      if (!classe?.includes('on')) await chips.nth(i).click();
    }

    const abas = page.locator('.pv-carrossel-aba');
    await expect(abas).toHaveCount(2);
    await expect(abas.nth(1)).toHaveText(/Vídeo final/i);
    await expect(page.locator('.pv-carrossel-seta')).toHaveCount(2);
    await expect(page.locator('.pv-carrossel-pontos span')).toHaveCount(2);
    // um de cada vez, não empilhados
    await expect(page.locator('.home-preview .block-embed')).toHaveCount(1);

    await abas.nth(1).click();
    await expect(page.locator('.pv-carrossel-aba.on')).toHaveText(/Vídeo final/i);

    // a seta dá a volta
    await page.locator('.pv-carrossel-seta.next').click();
    await expect(page.locator('.pv-carrossel-aba.on')).not.toHaveText(/Vídeo final/i);
  });

  test('sem nome, a aba mostra o provedor', async ({ page }) => {
    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    await page.locator('.tree-row.blk').filter({ hasText: 'A Travessia' }).first().click();
    await page.locator('.element-tile').filter({ hasText: 'Embed' }).click();
    await page.locator('.insp-input').nth(1).fill('https://vimeo.com/123456789');

    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    await page.locator('.tree-row.pagerow').filter({ hasText: 'Home' }).click();
    await page.locator('.editor-canvas .project-card').first().click();
    const chips = page.locator('.pv-chip').filter({ hasText: /Vídeo/ });
    for (let i = 0; i < (await chips.count()); i++) {
      const classe = await chips.nth(i).getAttribute('class');
      if (!classe?.includes('on')) await chips.nth(i).click();
    }
    await expect(page.locator('.pv-carrossel-aba')).toHaveText([/YouTube/i, /Vimeo/i]);
  });
});
