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
  const foco = page.locator('.inspector [data-falta] input');
  await expect(foco).toBeFocused();
  await foco.fill('Studio');
  await foco.press('Tab');
  await expect.poll(total).toBe(antes);
});
