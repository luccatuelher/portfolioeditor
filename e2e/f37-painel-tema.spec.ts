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

  test('escala tipográfica faz efeito: "Tamanho do texto" escala tudo; "Contraste entre tamanhos", só os títulos', async ({ page }) => {
    const px = (sel: string) => page.locator(`.editor-canvas ${sel}`).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const antes = { titulo: await px('.header-name'), nav: await px('.nav-link') };

    await page.getByLabel('Tamanho do texto').selectOption('20'); // 16 → 20: tudo × 1,25
    await expect.poll(() => px('.nav-link')).toBeCloseTo(antes.nav * 1.25, 0);
    await expect.poll(() => px('.header-name')).toBeCloseTo(antes.titulo * 1.25, 0);

    await page.getByLabel('Contraste entre tamanhos').selectOption('1.5'); // 1,25 → 1,5: títulos × 1,44
    await expect.poll(() => px('.header-name')).toBeCloseTo(antes.titulo * 1.25 * 1.44, 0);
    expect(await px('.nav-link')).toBeCloseTo(antes.nav * 1.25, 0); // texto comum não muda
  });

  test('"Destaque 2" é a cor do anel de foco no site', async ({ page }) => {
    const cor = page.locator('input[type=color][data-token="accent2"]');
    await cor.fill('#00aa55');
    const link = page.locator('.editor-canvas .nav-link').first();
    await link.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.activeElement!).outlineColor)).toBe('rgb(0, 170, 85)');
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
