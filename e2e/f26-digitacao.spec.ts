import { test, expect } from '@playwright/test';

/**
 * A digitação no inspector não grava a cada tecla (isso redesenhava o canvas
 * inteiro). Estes testes garantem que a gravação adiada NÃO perde texto em
 * nenhum dos caminhos de saída.
 */
test.describe('Digitação no inspector', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.editor-canvas .block-heading').first().click({ position: { x: 60, y: 12 } });
    await expect(page.locator('.insp-head')).toBeVisible();
  });

  test('o texto aparece no canvas depois da pausa', async ({ page }) => {
    const campo = page.locator('.insp-input').first();
    await campo.fill('Trabalhos recentes');
    await expect(page.locator('.editor-canvas .block-heading').first()).toContainText('Trabalhos recentes');
  });

  test('trocar de elemento no meio da digitação não perde o que foi escrito', async ({ page }) => {
    const campo = page.locator('.insp-input').first();
    await campo.click();
    await campo.pressSequentially('Sem pausa nenhuma', { delay: 0 });
    // sai imediatamente, sem esperar a pausa
    await page.locator('.editor-canvas .block').nth(1).click({ position: { x: 60, y: 12 } });
    await expect(page.locator('.editor-canvas .block-heading').first()).toContainText('Sem pausa nenhuma');
  });

  test('Enter grava na hora', async ({ page }) => {
    const campo = page.locator('.insp-input').first();
    await campo.click();
    await campo.pressSequentially('Com Enter', { delay: 0 });
    await campo.press('Enter');
    await expect(page.locator('.editor-canvas .block-heading').first()).toContainText('Com Enter');
  });

  test('desfazer continua funcionando depois de digitar', async ({ page }) => {
    const antes = await page.locator('.editor-canvas .block-heading').first().innerText();
    const campo = page.locator('.insp-input').first();
    await campo.fill('Texto novo');
    await expect(page.locator('.editor-canvas .block-heading').first()).toContainText('Texto novo');
    await page.locator('.editor-canvas').click({ position: { x: 5, y: 400 } });
    await page.keyboard.press('Control+z');
    await expect(page.locator('.editor-canvas .block-heading').first()).toContainText(antes.split('\n').pop()!.trim());
  });
});
