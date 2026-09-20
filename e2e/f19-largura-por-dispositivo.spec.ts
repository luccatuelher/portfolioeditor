import { test, expect } from '@playwright/test';

const abrirLayout = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.editor-canvas .block-heading').first().click();
  await page.getByRole('button', { name: 'Layout', exact: true }).click();
};

test.describe('Largura por dispositivo', () => {
  test('mexer no celular não mexe no computador, e dá para voltar ao herdado', async ({ page }) => {
    await abrirLayout(page);
    const tags = page.locator('.insp-span-tag');
    await expect(tags).toHaveCount(3);
    await expect(tags.nth(1)).toContainText('herdado');

    await page.locator('.tb-devices button').nth(2).click(); // celular
    await page.locator('.insp-span-row input[type="range"]').nth(2).fill('4');

    await expect(tags.nth(2)).toContainText('próprio');
    await expect(tags.nth(0)).toContainText('padrão'); // computador intacto
    await expect(tags.nth(0)).toContainText('12/12');

    await page.locator('.insp-span-reset').first().click();
    await expect(tags.nth(2)).toContainText('herdado');
  });

  test('cascata: o ajuste do tablet desce para o celular', async ({ page }) => {
    await abrirLayout(page);
    await page.locator('.tb-devices button').nth(1).click(); // tablet
    await page.locator('.insp-span-row input[type="range"]').nth(1).fill('6');

    const tags = page.locator('.insp-span-tag');
    await expect(tags.nth(1)).toContainText('próprio');
    await expect(tags.nth(2)).toContainText('herdado do tablet');
    await expect(tags.nth(2)).toContainText('6/12');
  });

  test('miniaturas não viram selos no celular; cards empilham; fila de blocos é preservada', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.waitForSelector('.editor-canvas .storyboard-cell');
    await page.locator('.tb-devices button').nth(2).click();

    const larguras = await page.evaluate(() => {
      const w = (sel: string) => {
        const el = document.querySelector(`.editor-canvas ${sel}`);
        return el ? Math.round(el.getBoundingClientRect().width) : null;
      };
      const canvas = document.querySelector('.editor-canvas')!.getBoundingClientRect().width;
      return { quadro: w('.storyboard-cell'), card: w('.project-card'), canvas: Math.round(canvas) };
    });

    expect(larguras.quadro).toBeGreaterThan(140); // duas por fila, não quatro selos
    expect(larguras.card).toBe(larguras.canvas! - 32); // card com texto ocupa a linha
  });
});
