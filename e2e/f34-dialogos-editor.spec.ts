import { test, expect, type Locator, type Page } from '@playwright/test';
import { auditarAcessibilidade } from './helpers/axe';

// Diálogos do editor (Versões, senha NDA, recorte): modais de verdade para o
// leitor de tela, o Tab não escapa para o editor atrás, o Esc fecha e o foco
// volta para o botão que abriu.
async function tabNaoEscapa(page: Page, dialogo: Locator): Promise<void> {
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
    const dentro = await dialogo.evaluate((d) => d.contains(document.activeElement));
    expect(dentro, `Tab nº ${i + 1} saiu do diálogo`).toBe(true);
  }
}

async function modalDeVerdade(dialogo: Locator): Promise<void> {
  await expect(dialogo).toHaveAttribute('role', 'dialog');
  await expect(dialogo).toHaveAttribute('aria-modal', 'true');
  // O nome vem do título visível do diálogo.
  const titulo = await dialogo.getAttribute('aria-labelledby');
  expect(titulo).toBeTruthy();
  await expect(dialogo.locator(`[id="${titulo}"]`)).toBeVisible();
  // Abriu: o foco já está dentro.
  await expect.poll(() => dialogo.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  // E passa na auditoria de acessibilidade (os botões secundários eram invisíveis: 1,06:1).
  await auditarAcessibilidade(dialogo.page(), `diálogo ${await dialogo.getAttribute('class')}`);
}

test.describe('Diálogos do editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await expect(page.locator('.editor-canvas .block-heading').first()).toBeVisible();
  });

  test('Versões', async ({ page }) => {
    const abrir = page.locator('.tb-btn', { hasText: 'Versões' });
    await abrir.focus();
    await page.keyboard.press('Enter');
    const dialogo = page.locator('.versions-modal');
    await modalDeVerdade(dialogo);
    await tabNaoEscapa(page, dialogo);
    await page.keyboard.press('Escape');
    await expect(dialogo).toHaveCount(0);
    await expect(abrir).toBeFocused();
  });

  test('senha NDA', async ({ page }) => {
    await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
    await page.locator('select').first().selectOption('nda');
    const abrir = page.locator('.tb-btn.primary', { hasText: 'Baixar site' });
    await abrir.focus();
    await page.keyboard.press('Enter');
    const dialogo = page.locator('.nda-modal');
    await modalDeVerdade(dialogo);
    // O campo da senha continua sendo o primeiro foco.
    await expect(dialogo.locator('input')).toBeFocused();
    await tabNaoEscapa(page, dialogo);
    await page.keyboard.press('Escape');
    await expect(dialogo).toHaveCount(0);
    await expect(abrir).toBeFocused();
  });

  test('recorte', async ({ page }) => {
    const card = page.locator('.editor-canvas .project-card').first();
    await card.hover();
    const abrir = card.locator('.pe-act-crop');
    await abrir.click();
    const dialogo = page.locator('.crop-modal');
    await modalDeVerdade(dialogo);
    await tabNaoEscapa(page, dialogo);
    await page.keyboard.press('Escape');
    await expect(dialogo).toHaveCount(0);
    await expect(abrir).toBeFocused();
  });
});
