import { test, expect } from '@playwright/test';

const abrirDados = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
};

test.describe('Painel de dados', () => {
  test('todas as coleções têm alça de arrastar (não só galeria e sketches)', async ({ page }) => {
    await abrirDados(page);
    const tabelas = page.locator('.data-table');
    const total = await tabelas.count();
    expect(total).toBe(4);
    for (let i = 0; i < total; i++) {
      const linhas = await tabelas.nth(i).locator('tbody tr').count();
      const alcas = await tabelas.nth(i).locator('.tree-grip').count();
      expect(alcas, `tabela ${i}: ${alcas} alças para ${linhas} linhas`).toBe(linhas);
    }
  });

  test('arrastar reordena a lista de projetos', async ({ page }) => {
    await abrirDados(page);
    const tabela = page.locator('.data-table').first();
    const antes = await tabela.locator('.data-name').allInnerTexts();
    expect(antes.length).toBeGreaterThan(1);

    const a = (await tabela.locator('.tree-grip').first().boundingBox())!;
    const b = (await tabela.locator('.tree-grip').nth(1).boundingBox())!;
    await page.mouse.move(a.x + 6, a.y + 6);
    await page.mouse.down();
    await page.mouse.move(b.x + 6, b.y + 14, { steps: 10 });
    await page.mouse.up();

    const depois = await tabela.locator('.data-name').allInnerTexts();
    expect(depois[0]).toBe(antes[1]);
    expect(depois[1]).toBe(antes[0]);
  });

  test('clicar num item leva o canvas até ele', async ({ page }) => {
    await abrirDados(page);
    await page.locator('.data-name').first().click();
    await expect(page.locator('.editor-canvas [data-page-id="project-detail"]')).toBeVisible();
    await expect(page.locator('.insp-head')).toContainText('Projeto');
  });

  test('criar item mostra o item criado, não deixa o canvas parado na Home', async ({ page }) => {
    await abrirDados(page);
    await page.locator('button', { hasText: '＋ Projeto' }).click();
    await expect(page.locator('.editor-canvas .detail-title')).toContainText('Novo projeto');

    await page.locator('button', { hasText: '＋ Imagem na galeria' }).click();
    await expect(page.locator('.editor-canvas [data-page-id="gallery"]')).toBeVisible();
  });
});
