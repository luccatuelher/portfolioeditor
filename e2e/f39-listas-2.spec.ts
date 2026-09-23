import { test, expect } from '@playwright/test';

// Segunda leva de campos que viraram escolha: largura dos itens nas três
// telas (igual à dos blocos), ano do projeto, data da nota e tamanho do texto.
test.describe('Mais campos de escolha', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await expect(page.locator('.editor-canvas .project-card').first()).toBeVisible();
  });

  test('largura do projeto: mesmo controle dos blocos, com automático e ↺', async ({ page }) => {
    const card = page.locator('.editor-canvas .project-card').first();
    await card.locator('.pe-act-edit').click({ force: true });
    const linhas = page.locator('.insp-row', { hasText: 'Largura ·' });
    await expect(linhas).toHaveCount(3);
    const linha = (tela: string) => page.locator('.insp-row').filter({ has: page.locator('.insp-label', { hasText: new RegExp(`^Largura · ${tela}$`) }) });
    const computador = linha('Computador');
    await expect(computador).toContainText('automático');

    await computador.locator('input[type="range"]').fill('6');
    await expect(computador).toContainText('6/12 · próprio');
    await expect.poll(() => card.evaluate((el) => getComputedStyle(el).getPropertyValue('--span').trim())).toBe('6');
    // O tablet herda do computador.
    await expect(linha('Tablet')).toContainText('herdado do computador');

    await computador.locator('.insp-span-reset').click();
    await expect(computador).toContainText('automático');
  });

  test('ano do projeto em lista, com "Outro" para período', async ({ page }) => {
    await page.locator('.editor-canvas .project-card').first().locator('.pe-act-edit').click({ force: true });
    const ano = page.getByRole('combobox', { name: 'Ano', exact: true });
    await ano.selectOption('2020');
    await expect(ano).toHaveValue('2020');
    await ano.selectOption('__outro');
    await expect(page.locator('.insp-row', { hasText: 'Ano (texto)' }).locator('input')).toBeVisible();
  });

  test('data da nota: mês e ano em listas, escritos nos dois idiomas', async ({ page }) => {
    await page.locator('.editor-canvas .nav-link', { hasText: 'Notas' }).first().click();
    await page.locator('.editor-canvas .blog-item').first().locator('.pe-act-edit').click({ force: true });
    const mes = page.getByRole('combobox', { name: 'Mês' });
    const ano = page.getByRole('combobox', { name: 'Ano da nota' });
    // O exemplo já vem com "Setembro 2026": a lista reconhece.
    await expect(mes).toHaveValue('9');
    await mes.selectOption('3');
    await ano.selectOption('2024');
    await expect(page.locator('.editor-canvas .blog-item').first().locator('.blog-date')).toHaveText('Março 2024');
  });

  test('tamanho do texto em lista, com "Outro…"', async ({ page }) => {
    await page.locator('.left-tabs button', { hasText: 'Tema' }).click();
    const base = page.getByLabel('Tamanho do texto', { exact: true });
    await base.selectOption('18');
    await expect(base).toHaveValue('18');
    await base.selectOption('__outra');
    await expect(page.getByRole('spinbutton', { name: 'Tamanho do texto (px)' })).toHaveValue('18');
  });
});
