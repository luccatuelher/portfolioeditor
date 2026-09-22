import { test, expect } from '@playwright/test';

test.describe('Quadros de storyboard e sketches', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  });

  test('o quadro tem as mesmas ações de uma imagem solta', async ({ page }) => {
    const quadro = page.locator('.editor-canvas .storyboard-cell').first();
    await quadro.scrollIntoViewIfNeeded();
    await quadro.hover();
    const acoes = await quadro.locator('[data-act]').evaluateAll((els) => els.map((e) => e.getAttribute('data-act')));
    expect(acoes).toEqual(['image', 'crop', 'edit', 'delete']);
  });

  test('editar o quadro abre a descrição dele, e o texto chega na imagem', async ({ page }) => {
    const quadro = page.locator('.editor-canvas .storyboard-cell').first();
    await quadro.scrollIntoViewIfNeeded();
    await quadro.hover();
    await quadro.locator('[data-act=edit]').click();

    await expect(page.locator('.insp-quadro.em-foco')).toBeVisible();
    await page.locator('.insp-quadro.em-foco input').fill('Cena 1: personagem entra pela esquerda');
    await expect(page.locator('.editor-canvas .storyboard-cell img').first()).toHaveAttribute('alt', 'Cena 1: personagem entra pela esquerda');
  });

  test('sketch também ganhou a ação de editar (era a única imagem sem ela)', async ({ page }) => {
    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    const sketches = page.locator('.tree-row.pagerow').filter({ hasText: 'Sketch' });
    if (await sketches.count()) await sketches.first().click();
    else await page.locator('.left-tabs button', { hasText: 'Dados' }).click();

    const item = page.locator('.editor-canvas .sketch-item').first();
    if (!(await item.count())) test.skip(true, 'fixture sem página de sketches no canvas');
    await item.hover();
    const acoes = await item.locator('[data-act]').evaluateAll((els) => els.map((e) => e.getAttribute('data-act')));
    expect(acoes).toContain('edit');
  });
});
