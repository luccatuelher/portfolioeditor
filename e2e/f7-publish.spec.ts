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
    await page.locator('.site-header nav .nav-link', { hasText: 'Projetos' }).click();
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
    await page.locator('.site-header nav .nav-link', { hasText: 'Projetos' }).click();
    await expect(page.locator('.project-card', { hasText: 'Projeto B' })).toHaveCount(0);
  });

  test('bloco NDA solto: fora do código público, volta no mesmo lugar depois da senha', async ({ page }) => {
    await page.route(/youtube|youtu\.be|vimeo|speakerdeck|ytimg/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    const titulo = page.locator('.editor-canvas main .block-heading').first();
    const id = (await titulo.getAttribute('data-block-id'))!;
    const vizinhoAntes = await titulo.evaluate((el) => el.previousElementSibling?.getAttribute('data-block-id') ?? null);
    await titulo.click();
    await page.locator('.insp-tab', { hasText: 'Visibilidade' }).click();
    await page.locator('.insp-body select').selectOption('nda');
    await expect(page.locator('.insp-body .insp-note').first()).toContainText('senha');

    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.tb-btn', { hasText: 'Backup' }).click()]);
    const backupPath = resolve(tmpdir(), `portfolio-nda-bloco-${Date.now()}.json`);
    await download.saveAs(backupPath);
    publish({ PUBLISH_INPUT: backupPath, PUBLISH_NDA_PASSWORD: 'segredo-longo-123' });

    // Público: nem o id do bloco está no arquivo (vai cifrado).
    const [dados] = readFileSync(resolve('dist/site.html'), 'utf8').match(/window\.__PORTFOLIO_DATA__[^<]*/) ?? [''];
    expect(dados.length).toBeGreaterThan(100);
    expect(dados).not.toContain(id);

    await page.goto(DIST, { waitUntil: 'load' });
    await expect(page.locator(`[data-block-id="${id}"]`)).toHaveCount(0);
    await page.locator('.site-header nav .nav-nda').click();
    await page.locator('.nda-unlock input').fill('segredo-longo-123');
    await page.locator('.nda-unlock button').click();
    await expect(page.locator('.nda-unlock')).toHaveCount(0);

    // Desbloqueado: o título volta à Home, no mesmo lugar.
    await page.locator('.site-header a.site-header-left').click();
    const volta = page.locator(`[data-block-id="${id}"]`);
    await expect(volta).toBeVisible();
    expect(await volta.evaluate((el) => el.previousElementSibling?.getAttribute('data-block-id') ?? null)).toBe(vizinhoAntes);
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
