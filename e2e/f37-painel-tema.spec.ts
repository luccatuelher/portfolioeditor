import { test, expect } from '@playwright/test';

// Painel Tema, do jeito que o dono do site usa: título da aba editável na
// própria prévia, fontes escolhidas numa lista e os campos opcionais recolhidos.
test.describe('Painel Tema', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Tema' }).click();
  });

  test('o título da aba se edita ali mesmo e muda o nome no cabeçalho', async ({ page }) => {
    const titulo = page.getByRole('textbox', { name: 'Título da aba (nome do site)' });
    await expect(titulo).toBeEditable();
    await titulo.fill('Lucca Tuelher — Storyboard');
    await expect(page.locator('.editor-canvas .header-name')).toHaveText('Lucca Tuelher — Storyboard');
  });

  test('fontes: lista de opções, com "Outra" para digitar qualquer nome', async ({ page }) => {
    const titulos = page.getByLabel('Títulos (display)');
    await expect(titulos).toHaveJSProperty('tagName', 'SELECT');
    const opcoes = await titulos.locator('option').allTextContents();
    expect(opcoes).toContain('Playfair Display');
    expect(opcoes.at(-1)).toMatch(/Outra/);

    await titulos.selectOption('Playfair Display');
    const fonteNoCanvas = (): Promise<string> => page.locator('.editor-canvas .site').first().evaluate((el) => getComputedStyle(el).getPropertyValue('--font-display'));
    await expect.poll(fonteNoCanvas).toContain('Playfair Display');

    // Outra: abre um campo para digitar; o que se digita vale no site.
    const texto = page.getByLabel('Texto corrido (body)');
    await texto.selectOption('__outra');
    const campo = page.getByRole('textbox', { name: /Nome da fonte \(Texto corrido/ });
    await campo.fill('Poppins');
    await expect(texto.locator('option').last()).toHaveText('Outra: Poppins');
    await expect.poll(() => page.locator('.editor-canvas .site').first().evaluate((el) => getComputedStyle(el).getPropertyValue('--font-body'))).toContain('Poppins');
  });

  test('endereço do site e analytics ficam recolhidos em "Avançado (opcional)"', async ({ page }) => {
    const grupo = page.locator('.theme-advanced');
    await expect(grupo.locator('summary')).toHaveText('Avançado (opcional)');
    await expect(page.locator('.site-url-input')).toBeHidden();
    await grupo.locator('summary').click();
    await expect(page.locator('.site-url-input')).toBeVisible();
  });
});
