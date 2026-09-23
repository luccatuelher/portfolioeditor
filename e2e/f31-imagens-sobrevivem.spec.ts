import { test, expect } from '@playwright/test';

/**
 * As imagens que uma versão (ou o desfazer) ainda usa precisam sobreviver a
 * recarregar a página. O salvamento automático gravava só as imagens em uso
 * NAQUELE momento: trocar uma imagem apagava a antiga do navegador, e restaurar
 * uma versão depois de recarregar devolvia o elemento sem imagem, em silêncio.
 */
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.describe('Imagens sobrevivem a recarregar', () => {
  const srcs = (page: import('@playwright/test').Page): Promise<string[]> =>
    page.evaluate(() => [...document.querySelectorAll('.editor-canvas img')].map((i) => i.getAttribute('src') ?? '').filter(Boolean));

  test('trocar uma imagem, recarregar e restaurar a versão devolve a imagem original', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.waitForSelector('.editor-canvas .block-image img');
    const antes = await srcs(page);

    await page.locator('.tb-btn', { hasText: 'Versões' }).click();
    await page.locator('.versions-save input').fill('original');
    await page.locator('.versions-save button').click();
    await expect(page.locator('.versions-list li')).toHaveCount(1);
    await page.locator('.modal-head button').click();

    // Troca a imagem do primeiro bloco de imagem por uma nova.
    const escolha = page.waitForEvent('filechooser');
    await page.locator('.editor-canvas .block-image .pe-act-image').first().click({ force: true });
    await (await escolha).setFiles({ name: 'nova.png', mimeType: 'image/png', buffer: PNG_1PX });
    await expect.poll(async () => (await srcs(page)).join('|')).not.toBe(antes.join('|'));
    await expect(page.locator('.tb-status')).toHaveText('Salvo neste navegador');
    await page.waitForTimeout(1200); // o mapa de imagens grava com atraso próprio

    // Recarrega SEM ?fresh: volta do rascunho salvo.
    await page.goto('/editor.html', { waitUntil: 'load' });
    await page.waitForSelector('.editor-canvas .block-image img');

    await page.locator('.tb-btn', { hasText: 'Versões' }).click();
    await page.locator('.versions-list li', { hasText: 'original' }).locator('.tb-btn').click();
    await expect.poll(() => srcs(page), { timeout: 15000 }).toEqual(antes);
  });

  test('primeira visita: editar só texto e recarregar mantém as imagens do exemplo', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
    // Navegador sem rascunho nenhum: o editor abre no exemplo.
    await page.goto('/editor.html', { waitUntil: 'load' });
    await page.waitForSelector('.editor-canvas .block-image img');
    const antes = await srcs(page);

    await page.locator('.editor-canvas .block-heading').first().click();
    await page.keyboard.press('Control+d');
    await expect(page.locator('.tb-status')).toHaveText('Salvo neste navegador');
    await page.waitForTimeout(1200);

    await page.goto('/editor.html', { waitUntil: 'load' });
    await page.waitForSelector('.editor-canvas .block-heading');
    await expect.poll(() => srcs(page), { timeout: 10000 }).toEqual(antes);
  });
});
