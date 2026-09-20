import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const DIST = pathToFileURL(resolve('dist/site.html')).href;
const publish = (env: Record<string, string> = {}): void => {
  execFileSync(process.execPath, [resolve('scripts/publish.mjs')], { env: { ...process.env, ...env }, stdio: 'ignore' });
};

// Serial: cada cenário republica dist/site.html, então não podem correr em paralelo.
test.describe.serial('F7 — site publicado (self-contained)', () => {
  test('template: renderiza standalone, sem NDA e sem código de edição', async ({ page }) => {
    publish({ PUBLISH_FIXTURE: 'template-v3.json' });
    await page.route(/youtube|youtu\.be|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto(DIST, { waitUntil: 'load' });
    await expect(page.locator('.site-header .header-name')).toContainText('Studio Quadro');
    await expect(page.locator('.project-card').first()).toBeVisible();
    await expect(page.locator('.nda-bar')).toHaveCount(0);
  });

  test('NDA: público esconde o confidencial; a senha revela', async ({ page }) => {
    publish({ PUBLISH_FIXTURE: 'legacy-synthetic-v3.json', PUBLISH_NDA_PASSWORD: 'segredo123' });
    await page.route(/youtube|youtu\.be|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto(DIST, { waitUntil: 'load' });

    // Vai para Projetos: só o público (Projeto A) aparece.
    await page.locator('.site-header nav button', { hasText: 'Projetos' }).click();
    await expect(page.locator('.project-card', { hasText: 'Projeto A' })).toBeVisible();
    await expect(page.locator('.project-card', { hasText: 'Projeto B' })).toHaveCount(0);

    // A senha é pedida dentro da página NDA (não há barra no topo).
    await expect(page.locator('.nda-bar')).toHaveCount(0);
    await page.locator('.site-header nav .nav-nda').click();
    await page.locator('.nda-unlock input').fill('errada');
    await page.locator('.nda-unlock button').click();
    await expect(page.locator('.nda-unlock-error')).toBeVisible();
    await page.locator('.nda-unlock input').fill('segredo123');
    await page.locator('.nda-unlock button').click();

    // O projeto NDA aparece na página NDA — e continua fora da lista pública.
    await expect(page.locator('.project-card', { hasText: 'Projeto B' })).toBeVisible();
    await page.locator('.site-header nav button', { hasText: 'Projetos' }).click();
    await expect(page.locator('.project-card', { hasText: 'Projeto B' })).toHaveCount(0);
  });

  test('ciclo completo: exportar backup do editor → publicar esse backup', async ({ page }) => {
    await page.goto('/editor.html', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    // Exporta o backup (doc + imagens) do editor.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.tb-btn', { hasText: 'Backup' }).click(),
    ]);
    const backupPath = resolve(tmpdir(), `portfolio-backup-e2e-${Date.now()}.json`);
    await download.saveAs(backupPath);

    // Publica a partir do backup exportado.
    execFileSync(process.execPath, [resolve('scripts/publish.mjs')], {
      env: { ...process.env, PUBLISH_INPUT: backupPath },
      stdio: 'ignore',
    });

    const html = readFileSync(resolve('dist/site.html'), 'utf8');
    expect(html).toContain('window.__PORTFOLIO_DATA__');
    expect(html).toContain('Studio Quadro'); // conteúdo do backup publicado
  });
});
