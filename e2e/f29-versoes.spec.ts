import { test, expect } from '@playwright/test';

/**
 * Rede de segurança do trabalho: versões guardam só o DOCUMENTO — as imagens
 * vivem no mapa do editor. Se importar um backup apagasse as imagens que ele
 * não traz, restaurar uma versão anterior devolveria o documento sem elas, em
 * silêncio. Este teste tranca esse caminho.
 */
test.describe('Versões e backup', () => {
  const imagensComSrc = (page: import('@playwright/test').Page): Promise<number> =>
    page.evaluate(() => [...document.querySelectorAll('.editor-canvas img')].filter((i) => i.getAttribute('src')).length);

  test('restaurar uma versão devolve as imagens, mesmo depois de importar um backup menor', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.waitForSelector('.editor-canvas img');

    const antes = await imagensComSrc(page);
    expect(antes).toBeGreaterThan(4);

    await page.locator('.tb-btn', { hasText: 'Versões' }).click();
    await page.locator('.versions-save input').fill('com todas as imagens');
    await page.locator('.versions-save button').click();
    await expect(page.locator('.versions-list li')).toHaveCount(1);
    await page.locator('.modal-head button').click();

    // backup com menos conteúdo (e menos imagens) que o rascunho atual
    await page.locator('input[accept*=json]').setInputFiles('e2e/fixtures/backup-parcial.json');
    await expect.poll(() => imagensComSrc(page)).toBeLessThan(antes);

    await page.locator('.tb-btn', { hasText: 'Versões' }).click();
    await page.locator('.versions-list li', { hasText: 'com todas as imagens' }).locator('.tb-btn').click();

    await expect.poll(() => imagensComSrc(page), { timeout: 15000 }).toBe(antes);
  });

  test('publicar guarda um ponto de retorno automático', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    const baixou = page.waitForEvent('download');
    await page.locator('.tb-btn.primary', { hasText: 'Baixar site' }).click();
    await baixou;

    await page.locator('.tb-btn', { hasText: 'Versões' }).click();
    await expect(page.locator('.versions-list li')).toContainText([/Publicado em/]);
    await expect(page.locator('.versions-list .v-main span')).toContainText([/automática/]);
  });
});
