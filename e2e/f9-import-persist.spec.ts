import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

test.describe('Import do app antigo + persistência local', () => {
  test('edições ficam salvas localmente e sobrevivem ao recarregar', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });

    await page.locator('.editor-canvas .block-heading', { hasText: 'Selected Work' }).click();
    await page.locator('.insp-i18n-field input[data-lang="pt"]').first().fill('Trabalho Fixo XYZ');
    await expect(page.locator('.editor-canvas .block-heading-text', { hasText: 'Trabalho Fixo XYZ' })).toBeVisible();
    await expect(page.locator('.tb-status')).toHaveText('Salvo neste navegador');

    // Recarrega SEM ?fresh → deve carregar o rascunho salvo.
    await page.goto('/editor.html', { waitUntil: 'load' });
    await expect(page.locator('.editor-canvas .block-heading-text', { hasText: 'Trabalho Fixo XYZ' })).toBeVisible();
  });

  test('importa backup do app antigo (v3) e carrega o conteúdo', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });

    await page.setInputFiles('.editor-topbar input[type=file]', resolve('fixtures/legacy-synthetic-v3.json'));

    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    await expect(page.locator('.editor-left')).toContainText('Projeto A');
  });
});
