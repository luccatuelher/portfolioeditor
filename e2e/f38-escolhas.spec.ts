import { test, expect } from '@playwright/test';

// Onde existe um conjunto conhecido de valores, o editor oferece a lista em
// vez de pedir que se digite o valor exato — sempre com uma saída "Outro…".
test.describe('Campos de escolha no editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await expect(page.locator('.editor-canvas .block-heading').first()).toBeVisible();
  });

  test('botão: "Leva para" lista páginas e projetos; "Outro" abre o campo de endereço', async ({ page }) => {
    await page.locator('.element-tile', { hasText: 'Botão' }).click();
    const destino = page.getByRole('combobox', { name: 'Leva para' });
    await expect(destino).toBeVisible();
    await expect(destino.locator('optgroup[label="Página do site"] option')).not.toHaveCount(0);
    await expect(destino.locator('optgroup[label="Projeto"] option')).not.toHaveCount(0);

    const pagina = await destino.locator('optgroup[label="Página do site"] option').nth(1).getAttribute('value');
    await destino.selectOption(pagina!);
    await expect(page.locator('.editor-canvas .block-button.is-selected a.btn')).toHaveAttribute('href', pagina!);

    await destino.selectOption('__outro');
    const endereco = page.getByRole('textbox', { name: 'Endereço do link' });
    await expect(endereco).toHaveValue('');
    await endereco.fill('https://exemplo.com/cv.pdf');
    await endereco.press('Tab');
    await expect(page.locator('.editor-canvas .block-button.is-selected a.btn')).toHaveAttribute('href', 'https://exemplo.com/cv.pdf');
  });

  test('no site, link interno de botão (#pagina) navega sem recarregar', async ({ page }) => {
    await page.goto('/preview.html', { waitUntil: 'load' });
    await page.evaluate(() => {
      const a = document.createElement('a');
      a.href = '#gallery';
      a.id = 'link-teste';
      a.textContent = 'ir';
      document.querySelector('main')!.prepend(a);
    });
    await page.locator('#link-teste').click();
    await expect(page.locator('main[data-route]')).toHaveAttribute('data-route', 'gallery');
  });

  test('formato do projeto: Storyboard/Animatic na lista, "Outro…" para texto', async ({ page }) => {
    await page.locator('.editor-canvas .project-card').first().locator('.pe-act-edit').click({ force: true });
    const formato = page.getByRole('combobox', { name: 'Formato' });
    await formato.selectOption('animatic');
    await expect(formato).toHaveValue('animatic');
    await formato.selectOption('__outro');
    await expect(page.locator('.insp-row', { hasText: 'Formato (texto)' }).locator('input')).toBeVisible();
  });

  test('rede social: colar o link preenche o nome; o nome sugere as redes', async ({ page }) => {
    await page.locator('.editor-canvas .nav-link', { hasText: 'Contato' }).first().click();
    await page.locator('.editor-canvas .block-contact').first().click();
    await page.locator('.add-block-btn', { hasText: 'Rede social' }).click();
    const n = await page.locator('.insp-social').count();
    const link = page.getByRole('textbox', { name: `Link da rede ${n}` });
    await link.fill('https://www.behance.net/lucca');
    await link.press('Tab');
    await expect(page.getByLabel(`Nome da rede ${n}`, { exact: true })).toHaveValue('Behance');
    await expect(page.getByLabel(`Nome da rede ${n}`, { exact: true })).toHaveAttribute('list', 'redes-sociais');
    await expect(page.locator('#redes-sociais option[value="Instagram"]')).toHaveCount(1);
  });

  test('escala tipográfica: escalas com nome, "Outra…" para número próprio', async ({ page }) => {
    await page.locator('.left-tabs button', { hasText: 'Tema' }).click();
    const escala = page.getByLabel('Contraste entre tamanhos');
    await escala.selectOption('1.5');
    await expect(escala).toHaveValue('1.5');
    await escala.selectOption('__outra');
    await expect(page.getByRole('spinbutton', { name: 'Razão da escala (número)' })).toHaveValue('1.5');
  });
});
