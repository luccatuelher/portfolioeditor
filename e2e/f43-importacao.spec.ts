import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

// Importar troca o que está aberto: precisa confirmar, guardar o estado atual
// como versão e, se o arquivo não servir, dizer isso em português sem mexer em nada.
const IMPORTAR = '.editor-topbar input[type=file]';

test.describe('Importar backup', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await expect(page.locator('.editor-canvas .block-heading').first()).toBeVisible();
  });

  test('arquivo truncado: aviso claro e nada muda', async ({ page }) => {
    const antes = await page.locator('.site-header .header-name').first().textContent();
    await page.setInputFiles(IMPORTAR, { name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"portfolio-v4-backup","doc":{"schemaVersion":4,"pages":[{"id":"ho') });
    // O erro é um aviso do editor que fica até fechar (antes: alert do navegador).
    await expect(page.locator('.aviso-erro')).toContainText('incompleto ou corrompido');
    await expect(page.locator('.site-header .header-name').first()).toHaveText(antes!);
  });

  test('confirmação mostra o que vem no arquivo; cancelar não troca nada', async ({ page }) => {
    const antes = await page.locator('.site-header .header-name').first().textContent();
    await page.setInputFiles(IMPORTAR, resolve('fixtures/legacy-synthetic-v3.json'));
    const dialogo = page.locator('.dialogo-confirmar');
    await expect(dialogo).toBeVisible();
    const texto = (await dialogo.innerText()).replace(/\s+/g, ' ');
    // Importar troca o que está aberto: o foco começa em Cancelar.
    await expect(dialogo.locator('.tb-btn', { hasText: 'Cancelar' })).toBeFocused();
    await dialogo.locator('.tb-btn', { hasText: 'Cancelar' }).click();
    expect(texto).toContain('legacy-synthetic-v3.json');
    expect(texto).toMatch(/\d+ projetos?/);
    expect(texto).toContain('versão automática');
    await expect(page.locator('.site-header .header-name').first()).toHaveText(antes!);
  });

  test('importar guarda o que estava aberto em Versões ("Antes de importar")', async ({ page }) => {
    await page.setInputFiles(IMPORTAR, resolve('fixtures/legacy-synthetic-v3.json'));
    await page.locator('.dialogo-confirmar .tb-btn.primary').click(); // diálogo do editor (antes: confirm do navegador)
    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    await expect(page.locator('.editor-left')).toContainText('Projeto A');
    await page.locator('.tb-btn', { hasText: 'Versões' }).click();
    await expect(page.locator('.versions-list')).toContainText('Antes de importar "legacy-synthetic-v3.json"');
  });
});
