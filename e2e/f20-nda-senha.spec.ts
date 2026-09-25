import { test, expect } from '@playwright/test';

test.describe('Senha da área NDA', () => {
  const comItemNda = async (page: import('@playwright/test').Page): Promise<void> => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
    await page.locator('select').first().selectOption('nda');
  };

  test('pede senha ao gerar o site e recusa senha que não protege', async ({ page }) => {
    await comItemNda(page);
    await page.locator('.tb-btn.primary', { hasText: 'Baixar site' }).click();

    const modal = page.locator('.nda-modal');
    await expect(modal).toBeVisible();
    const gerar = modal.locator('.nda-modal-acoes .primary');
    await expect(gerar).toBeDisabled(); // vazio não passa

    await modal.locator('input').fill('123');
    await expect(page.locator('.nda-forca')).toContainText('pelo menos 8');
    await expect(gerar).toBeDisabled();

    await modal.locator('input').fill('12345678'); // tamanho ok, mas é das mais tentadas
    await expect(gerar).toBeDisabled();
  });

  test('sugere uma senha forte e libera a publicação', async ({ page }) => {
    await comItemNda(page);
    await page.locator('.tb-btn.primary', { hasText: 'Baixar site' }).click();
    await page.locator('.nda-modal-row button', { hasText: 'Sugerir' }).click();

    const senha = await page.locator('.nda-modal input').inputValue();
    expect(senha.length).toBeGreaterThanOrEqual(8);
    await expect(page.locator('.nda-forca b')).toHaveText(/forte|boa/);
    await expect(page.locator('.nda-modal-acoes .primary')).toBeEnabled();
  });

  test('dá para publicar sem os itens confidenciais', async ({ page }) => {
    await comItemNda(page);
    await page.locator('.tb-btn.primary', { hasText: 'Baixar site' }).click();
    const baixou = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('.nda-modal-acoes .tb-btn', { hasText: 'Publicar sem os itens NDA' }).click();
    expect((await baixou).suggestedFilename()).toBe('index.html');
    await expect(page.locator('.nda-modal')).toHaveCount(0);
  });

  test('com a senha, o NDA também é conferido: o aviso conta o mesmo que o painel Dados', async ({ page }) => {
    // O 1º projeto (com 4 imagens sem descrição) vira NDA: continua indo para o site, cifrado.
    await comItemNda(page);
    const noPainel = Number(await page.locator('.descricoes').getAttribute('data-faltam'));
    expect(noPainel).toBeGreaterThan(4);

    await page.locator('.tb-btn.primary', { hasText: 'Baixar site' }).click();
    await page.locator('.nda-modal-row button', { hasText: 'Sugerir' }).click();
    const baixou = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('.nda-modal-acoes .primary').click();
    await baixou;
    const avisos = page.locator('.publish-notice details');
    await avisos.locator('summary').click();
    await expect(avisos).toContainText(`${noPainel} imagem(ns) sem descrição`);
  });

  test('sem item confidencial, nem pergunta', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    const baixou = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('.tb-btn.primary', { hasText: 'Baixar site' }).click();
    expect((await baixou).suggestedFilename()).toBe('index.html');
    await expect(page.locator('.nda-modal')).toHaveCount(0);
  });
});
