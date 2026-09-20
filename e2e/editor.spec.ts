import { test, expect } from '@playwright/test';

test.describe('editor v4 — loop de edição', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/youtube|youtu\.be|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
  });

  test('shell renderiza: topbar, layers e canvas', async ({ page }) => {
    await expect(page.locator('.editor-topbar')).toContainText('Portfolio v4');
    await expect(page.locator('.editor-left .panel-h').first()).toBeVisible();
    await expect(page.locator('.editor-canvas .block').first()).toBeVisible();
    await page.locator('.editor-canvas .block-heading', { hasText: 'Selected Work' }).click();
    await page.screenshot({ path: 'e2e/__screenshots__/editor.png', fullPage: false });
  });

  test('selecionar um bloco abre o inspector contextual', async ({ page }) => {
    await page.locator('.editor-canvas .block-heading', { hasText: 'Selected Work' }).click();
    await expect(page.locator('.insp-head')).toContainText('Título');
    await expect(page.locator('.insp-tab')).toHaveCount(4);
    await expect(page.locator('.editor-canvas .block-heading.is-selected')).toBeVisible();
  });

  test('editar texto no inspector reflete no canvas; undo reverte', async ({ page }) => {
    await page.locator('.editor-canvas .block-heading', { hasText: 'Selected Work' }).click();

    const ptInput = page.locator('.insp-i18n-field input[data-lang="pt"]').first();
    await ptInput.fill('Trabalho Selecionado');

    await expect(page.locator('.editor-canvas .block-heading-text', { hasText: 'Trabalho Selecionado' })).toBeVisible();

    // Undo na topbar (primeiro botão do centro).
    await page.locator('.tb-center button').first().click();
    await expect(page.locator('.editor-canvas .block-heading-text', { hasText: 'Selected Work' })).toBeVisible();
  });

  test('adicionar bloco pela paleta insere no canvas', async ({ page }) => {
    const before = await page.locator('.editor-canvas .block-heading').count();
    // Abre a paleta da primeira seção e adiciona um Título.
    await page.locator('.add-block-btn').first().click();
    await page.locator('.add-block-menu button', { hasText: 'Título' }).first().click();
    await expect(page.locator('.editor-canvas .block-heading')).toHaveCount(before + 1);
    // O bloco novo fica selecionado e o inspector mostra heading.
    await expect(page.locator('.insp-head')).toContainText('Título');
  });

  test('exportar backup dispara download de JSON', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.tb-btn', { hasText: 'Backup' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/portfolio-backup-.*\.json/);
  });

  test('toggle de visibilidade nas Layers esmaece o bloco no canvas', async ({ page }) => {
    // Seleciona a Coleção da home e oculta via inspector (Visibilidade).
    const layerColecao = page.locator('.editor-left .tree-row.blk', { hasText: 'Coleção' }).first();
    await layerColecao.locator('.tree-eye').click();
    await expect(page.locator('.editor-canvas .block-collection.vis-draft')).toHaveCount(1);
  });
});
