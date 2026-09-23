import { test, expect, type Page } from '@playwright/test';

// Editor em tablet e celular: o canvas fica com a largura toda e os painéis
// viram gavetas. Nenhum botão da barra fica fora da tela.
const abrir = async (page: Page): Promise<void> => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await expect(page.locator('.editor-canvas .block-heading').first()).toBeVisible();
};

for (const [nome, viewport] of [['tablet em pé', { width: 768, height: 1024 }], ['celular', { width: 390, height: 844 }]] as const) {
  test.describe(`Editor no ${nome}`, () => {
    test.use({ viewport, hasTouch: true });

    test('canvas com a largura da tela e todos os botões da barra à vista', async ({ page }) => {
      await abrir(page);
      const canvas = await page.locator('.editor-canvas').boundingBox();
      expect(canvas!.width).toBeGreaterThan(viewport.width - 48);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
      for (const b of await page.locator('.editor-topbar button').all()) {
        const r = await b.boundingBox();
        expect(r!.x + r!.width, `botão fora da tela: ${await b.textContent()}`).toBeLessThanOrEqual(viewport.width + 1);
      }
      await expect(page.locator('.tb-btn.primary', { hasText: 'Baixar site' })).toBeInViewport();
    });

    test('gavetas: abrem pela faixa, mostram a seleção e fecham por fora, pelo ✕ e pelo Esc', async ({ page }) => {
      await abrir(page);
      const esquerda = page.locator('.editor-left');
      const direita = page.locator('.editor-right');
      // Fechadas, nem o Tab chega nelas.
      await expect(esquerda).toBeHidden();
      await expect(direita).toBeHidden();

      await page.locator('.editor-gavetas button', { hasText: 'Páginas' }).tap();
      await expect(esquerda).toBeVisible();
      await expect(esquerda.locator('.left-tabs')).toBeInViewport();
      await page.locator('.editor-scrim').tap({ position: { x: viewport.width - 10, y: 200 } });
      await expect(esquerda).toBeHidden();

      await page.locator('.editor-canvas .block-heading').first().tap();
      const editar = page.locator('.editor-gavetas button', { hasText: 'Editar' });
      await expect(editar).toContainText('Título');
      await editar.tap();
      await expect(direita).toBeVisible();
      await expect(direita.locator('.insp-head')).toContainText('Título');
      await direita.locator('.gaveta-fechar').tap();
      await expect(direita).toBeHidden();

      await editar.tap();
      await expect(direita).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(direita).toBeHidden();
      // O Esc fechou só a gaveta: a seleção continua.
      await expect(page.locator('.editor-canvas .block-heading.is-selected')).toHaveCount(1);
    });
  });
}

test('no computador nada muda: três colunas, sem faixa de gavetas', async ({ page }) => {
  await abrir(page);
  await expect(page.locator('.editor-gavetas')).toBeHidden();
  await expect(page.locator('.editor-left')).toBeVisible();
  await expect(page.locator('.editor-right .inspector')).toBeVisible();
  const esquerda = await page.locator('.editor-left').boundingBox();
  const direita = await page.locator('.editor-right').boundingBox();
  expect(esquerda!.width).toBe(260);
  expect(direita!.width).toBe(340);
});
