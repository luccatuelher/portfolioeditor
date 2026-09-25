import { test, expect, type Page } from '@playwright/test';

/**
 * O rascunho mora no IndexedDB, que o navegador pode apagar sozinho com o disco
 * apertado. O editor pede espaço persistente; se o navegador nega e não há
 * backup recente, uma faixa diz isso e oferece o backup. Aqui o navegador é
 * simulado (persist/estimate) para cada situação.
 */
test.use({ storageState: { cookies: [], origins: [] } });

async function abrir(page: Page, o: { concede: boolean; uso?: number; ultimoBackup?: number }): Promise<void> {
  await page.addInitScript((c) => {
    const s = navigator.storage;
    s.persisted = async () => false;
    s.persist = async () => c.concede;
    s.estimate = async () => ({ usage: (c.uso ?? 0.01) * 1e9, quota: 1e9 });
    if (c.ultimoBackup !== undefined && !localStorage.getItem('portfolio-ultimo-backup')) localStorage.setItem('portfolio-ultimo-backup', String(c.ultimoBackup));
  }, o);
  await page.goto('/editor.html?fresh=1');
  await expect(page.locator('.editor-canvas')).toBeVisible();
}

const faixa = (page: Page) => page.locator('.editor-protecao');

test('navegador nega e nunca houve backup: avisa; baixar o backup tira o aviso até o próximo prazo', async ({ page }) => {
  await abrir(page, { concede: false });
  await expect(faixa(page)).toContainText('pode apagar o rascunho');
  await expect(faixa(page)).toContainText('ainda não baixou nenhum backup');

  const baixou = page.waitForEvent('download');
  await faixa(page).getByRole('button', { name: 'Baixar backup' }).click();
  expect((await baixou).suggestedFilename()).toMatch(/^portfolio-backup-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(faixa(page)).toHaveCount(0);

  // Reabrir logo depois: o backup é recente, nada a dizer.
  await page.reload();
  await expect(page.locator('.editor-canvas')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(faixa(page)).toHaveCount(0);
});

test('backup de 10 dias atrás: avisa dizendo há quanto tempo; o ✕ fecha', async ({ page }) => {
  await abrir(page, { concede: false, ultimoBackup: Date.now() - 10 * 86_400_000 });
  await expect(faixa(page)).toContainText('último backup foi há 10 dias');
  await faixa(page).getByRole('button', { name: 'Fechar aviso' }).click();
  await expect(faixa(page)).toHaveCount(0);
});

test('Ctrl+S também conta como backup', async ({ page }) => {
  await abrir(page, { concede: false });
  await expect(faixa(page)).toBeVisible();
  const baixou = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  await baixou;
  await expect(faixa(page)).toHaveCount(0);
});

test('navegador concede espaço persistente: nenhum aviso, mesmo sem backup', async ({ page }) => {
  await abrir(page, { concede: true });
  await page.waitForTimeout(300);
  await expect(faixa(page)).toHaveCount(0);
});

test('espaço quase cheio: avisa mesmo com backup recente', async ({ page }) => {
  await abrir(page, { concede: true, uso: 0.9, ultimoBackup: Date.now() });
  await expect(faixa(page)).toContainText('90% cheio');
});
