import { test, expect } from '@playwright/test';

const openEditor = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
};

test.describe('Guias, versões, contraste e analytics', () => {
  test('as colunas da grade aparecem ao arrastar e somem ao soltar', async ({ page }) => {
    await openEditor(page);
    const grid = page.locator('.editor-canvas .section-grid').first();
    const box = (await grid.boundingBox())!;
    await page.locator('.element-tile').first().hover();
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 40, { steps: 8 });

    await expect(page.locator('.editor-canvas.dragging')).toBeVisible();
    const guia = await grid.evaluate((el) => getComputedStyle(el, '::before').backgroundImage);
    expect(guia).toContain('repeating-linear-gradient');

    await page.mouse.up();
    await expect(page.locator('.editor-canvas.dragging')).toHaveCount(0);
  });

  test('salvar e restaurar uma versão devolve o texto anterior', async ({ page }) => {
    await openEditor(page);
    page.on('dialog', (d) => void d.accept());
    const titulo = page.locator('.editor-canvas .block-heading').first();
    const antes = (await titulo.innerText()).trim();

    await page.locator('.tb-btn', { hasText: 'Versões' }).click();
    await page.locator('.versions-save input').fill('estado bom');
    await page.locator('.versions-save button').click();
    await expect(page.locator('.versions-list li')).toHaveCount(1);
    await page.locator('.modal-head button').click();

    await titulo.dblclick();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('TEXTO ESTRAGADO');
    await page.locator('.editor-canvas').click({ position: { x: 5, y: 400 } });
    await expect(page.locator('.editor-canvas .block-heading').first()).toContainText('TEXTO ESTRAGADO');

    await page.locator('.tb-btn', { hasText: 'Versões' }).click();
    await page.locator('.versions-list li', { hasText: 'estado bom' }).locator('.tb-btn').click();
    await expect(page.locator('.versions-modal')).toHaveCount(0);
    await expect(page.locator('.editor-canvas .block-heading').first()).toContainText(antes.split('\n').pop()!);
  });

  test('o painel de tema mostra o contraste de cada par de cor', async ({ page }) => {
    await openEditor(page);
    await page.locator('.left-tabs button', { hasText: 'Tema' }).click();
    await expect(page.locator('.contrast-row')).toHaveCount(6);
    await expect(page.locator('.contrast-row .contrast-ratio').first()).toContainText(':1');
  });

  test('o snippet de analytics fica guardado no documento', async ({ page }) => {
    await openEditor(page);
    await page.locator('.left-tabs button', { hasText: 'Tema' }).click();
    const snippet = '<script defer src="https://plausible.io/js/script.js"></script>';
    await page.locator('.theme-advanced > summary').click(); // opcionais ficam recolhidos
    await page.locator('.analytics-input').fill(snippet);
    await page.locator('.left-tabs button', { hasText: 'Layers' }).click();
    await page.locator('.left-tabs button', { hasText: 'Tema' }).click();
    await expect(page.locator('.analytics-input')).toHaveValue(snippet);
  });
});

test('o endereço do site fica guardado e é campo próprio (não se mistura com o analytics)', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: 'Tema' }).click();

  await page.locator('.theme-advanced > summary').click(); // opcionais ficam recolhidos
  await page.locator('.site-url-input').fill('https://luccatuelher.com');
  await page.locator('.analytics-input').fill('<script defer src="https://plausible.io/js/script.js"></script>');

  await page.locator('.left-tabs button', { hasText: 'Layers' }).click();
  await page.locator('.left-tabs button', { hasText: 'Tema' }).click();

  await expect(page.locator('.site-url-input')).toHaveValue('https://luccatuelher.com');
  await expect(page.locator('.analytics-input')).toContainText('');
  await expect(page.locator('.analytics-input')).toHaveValue(/plausible/);
});
