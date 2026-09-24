import { test, expect } from '@playwright/test';

// Avisos e perguntas no visual do editor: nenhum alert/confirm/prompt do navegador.
test.beforeEach(async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  page.on('dialog', () => { throw new Error('não devia abrir diálogo do navegador'); });
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
});

test('diálogo sobre diálogo: o Esc fecha só o de cima', async ({ page }) => {
  await page.locator('.tb-btn', { hasText: 'Versões' }).click();
  await page.locator('.versions-save input').fill('ponto');
  await page.locator('.versions-save button').click();
  await page.locator('.versions-list li', { hasText: 'ponto' }).locator('.tb-btn').click();
  const pergunta = page.locator('.dialogo-confirmar');
  await expect(pergunta).toContainText('Restaurar “ponto”?');
  await page.keyboard.press('Escape');
  await expect(pergunta).toHaveCount(0);
  await expect(page.locator('.versions-modal')).toBeVisible(); // o de baixo continua
  // E o Tab continua preso no de baixo, agora o de cima.
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.versions-modal'))).toBe(true);
});

test('link no texto: escolhe a página na lista e grava pelo id', async ({ page }) => {
  // A Home do exemplo não tem bloco de texto; a página Sobre tem.
  await page.locator('.editor-canvas .site-header .nav-link', { hasText: 'Sobre' }).click();
  await page.locator('.editor-canvas .block-text').first().click(); // seleciona: aí o texto vira editável
  const texto = page.locator('.editor-canvas .block-text .inline-edit').first();
  await texto.click();
  await page.keyboard.press('Control+a');
  await page.locator('.pe-toolbar button[title="Link no texto selecionado"]').dispatchEvent('mousedown');
  const dialogo = page.locator('.dialogo-link');
  await expect(dialogo).toBeVisible();
  const lista = dialogo.locator('select[aria-label="Leva para"]');
  const valor = await lista.locator('option', { hasText: 'Sobre' }).first().getAttribute('value');
  expect(valor).toMatch(/^#/);
  await lista.selectOption(valor!);
  await dialogo.locator('.tb-btn.primary', { hasText: 'Aplicar' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(page.locator('.editor-canvas .block-text a').first()).toHaveAttribute('href', valor!);
});

test('imagem que não dá para usar: aviso de erro que fica até fechar', async ({ page }) => {
  const bloco = page.locator('.editor-canvas .block-image').first();
  await bloco.hover();
  const escolha = page.waitForEvent('filechooser');
  await bloco.locator('.pe-act-image').click({ force: true });
  await (await escolha).setFiles({ name: 'quebrada.png', mimeType: 'image/png', buffer: Buffer.from('isto não é png') });
  const aviso = page.locator('.aviso-erro');
  await expect(aviso).toContainText('Não consegui usar essa imagem');
  await page.waitForTimeout(6500); // aviso de info sumiria; erro fica
  await expect(aviso).toBeVisible();
  await aviso.locator('.aviso-fechar').click();
  await expect(aviso).toHaveCount(0);
});
