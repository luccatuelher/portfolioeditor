import { test, expect } from '@playwright/test';

// Texto publicado só em português entra na lista "Traduções" do painel Dados,
// e "Traduzir" troca o idioma de edição e põe o cursor no campo que falta.
test('título sem EN entra na lista; Traduzir leva ao campo em inglês', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
  const total = async (): Promise<number> => Number(await page.locator('.traducoes').getAttribute('data-faltam'));
  const antes = await total();

  // O nome do site perde o inglês.
  await page.locator('.editor-canvas [data-site-header]').first().click();
  await page.locator('.insp-lang', { hasText: 'EN' }).click();
  const nome = page.locator('.insp-row', { hasText: 'Nome' }).first().locator('input');
  await nome.fill('');
  await nome.press('Tab');
  await page.locator('.insp-lang', { hasText: 'PT' }).click();
  await expect.poll(total).toBe(antes + 1);

  // Traduzir: idioma vira EN e o foco cai no campo vazio.
  await page.locator('.traducoes > summary').click();
  await page.locator('.traducoes-lista li', { hasText: 'nome do site' }).locator('.descricoes-ir').click();
  await expect(page.locator('.insp-lang', { hasText: 'EN' })).toHaveAttribute('aria-pressed', 'true');
  const foco = page.locator('.inspector [data-campo="site.name"] input');
  await expect(foco).toBeFocused();
  await foco.fill('Studio');
  await foco.press('Tab');
  await expect.poll(total).toBe(antes);
});

// A importação do portfólio antigo copia o português para o inglês: o texto
// "existe" nos dois, mas quem visita em inglês lê português.
test('texto longo igual em PT e EN entra como "iguais"; Traduzir cai no campo certo da ficha', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
  const painel = page.locator('.traducoes');
  const iguais = async (): Promise<number> => Number(await painel.getAttribute('data-iguais'));
  expect(await iguais()).toBeGreaterThan(0);
  const antes = await iguais();

  await painel.locator('> summary').click();
  await painel.locator('li', { hasText: 'Processo · projeto' }).locator('.descricoes-ir').click();
  await expect(page.locator('.insp-lang', { hasText: 'EN' })).toHaveAttribute('aria-pressed', 'true');
  const campo = page.locator('.inspector [data-campo="meta.processNotes"]').locator('input, textarea');
  await expect(campo).toBeFocused();
  await campo.fill('Use this project to test rows and attachments.');
  await campo.press('Tab');
  await expect.poll(iguais).toBe(antes - 1);
  // O que é igual de propósito e curto (nome, "Storyboard & Visual Development") não entra.
  await expect(painel.locator('li', { hasText: 'Função · cabeçalho' })).toHaveCount(0);
});

// O pedido de foco vale só para o item que o pediu: abrir outro projeto
// depois não pode pôr o cursor no título dele.
test('depois de Traduzir, abrir outro projeto não rouba o cursor', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
  const painel = page.locator('.traducoes');
  await painel.locator('> summary').click();
  await painel.locator('li', { hasText: 'Processo · projeto' }).locator('.descricoes-ir').click();
  await expect(page.locator('.inspector [data-campo="meta.processNotes"]').locator('input, textarea')).toBeFocused();
  await page.locator('.data-table button', { hasText: 'Intervalo' }).click();
  await expect(page.locator('.editor-canvas .detail-title')).toHaveText('Intervalo');
  await expect(page.locator('.inspector [data-campo="title"] input')).not.toBeFocused();
});
