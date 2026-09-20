import { test, expect } from '@playwright/test';

const abrir = async (page: import('@playwright/test').Page, aba: string): Promise<void> => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: aba }).click();
};

const renomear = async (linha: import('@playwright/test').Locator, nome: string): Promise<void> => {
  await linha.hover();
  await linha.locator('.tree-rename-btn').click();
  const campo = linha.page().locator('.tree-rename');
  await campo.fill(nome);
  await campo.press('Enter');
};

test.describe('Árvore: renomear e voltar', () => {
  test('o mesmo gesto renomeia seção, página e projeto', async ({ page }) => {
    await abrir(page, 'Layers');
    await renomear(page.locator('.tree-row.sec').filter({ hasText: 'Seção' }).first(), 'Abertura');
    await expect(page.locator('.tree-row.sec').filter({ hasText: 'Abertura' })).toHaveCount(1);

    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    await renomear(page.locator('.tree-row.pagerow').filter({ hasText: 'Galeria' }), 'Portfólio visual');
    await expect(page.locator('.tree-row.pagerow').filter({ hasText: 'Portfólio visual' })).toHaveCount(1);

    await renomear(page.locator('.tree-row.blk').first(), 'Projeto renomeado');
    await expect(page.locator('.tree-row.blk').filter({ hasText: 'Projeto renomeado' })).toHaveCount(1);
  });

  test('Esc desiste do renome sem gravar', async ({ page }) => {
    await abrir(page, 'Páginas');
    const linha = page.locator('.tree-row.pagerow').filter({ hasText: 'Sobre' });
    await linha.hover();
    await linha.locator('.tree-rename-btn').click();
    await page.locator('.tree-rename').fill('Nome descartado');
    await page.locator('.tree-rename').press('Escape');
    await expect(page.locator('.tree-row.pagerow').filter({ hasText: 'Nome descartado' })).toHaveCount(0);
    await expect(linha).toBeVisible();
  });

  test('dentro de um projeto, a trilha diz onde estou e devolve para a lista', async ({ page }) => {
    await abrir(page, 'Páginas');
    await page.locator('.tree-row.blk').filter({ hasText: 'A Travessia' }).first().click();

    const trilha = page.locator('.tb-page');
    await expect(trilha).toContainText('Projetos');
    await expect(trilha).toContainText('A Travessia');

    await page.locator('.tb-voltar').click();
    await expect(page.locator('.editor-canvas [data-page-id="projects"]')).toBeVisible();
    await expect(page.locator('.tb-voltar')).toHaveCount(0); // fora de item, sem trilha
  });
});
