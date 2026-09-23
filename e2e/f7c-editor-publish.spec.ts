import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

// Publicação sem terminal: botão "Baixar site" no editor gera o index.html completo
// (o arquivo que o GitHub Pages abre sozinho) e diz como pôr no ar.
test('botão "Baixar site" gera um index.html que roda sozinho', async ({ page, context }) => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto('/editor.html', { waitUntil: 'load' });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.tb-btn', { hasText: 'Baixar site' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('index.html');
  // O aviso diz como publicar no GitHub Pages.
  const aviso = page.locator('.publish-notice');
  await expect(aviso).toContainText('index.html baixado');
  await expect(aviso).toContainText('Upload files');
  const out = resolve(tmpdir(), `site-e2e-${Date.now()}.html`);
  await download.saveAs(out);

  const p2 = await context.newPage();
  await p2.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await p2.goto(pathToFileURL(out).href, { waitUntil: 'load' });
  await expect(p2.locator('.site-header .header-name')).toContainText('Studio Quadro');
  await expect(p2.locator('.project-card').first()).toBeVisible();
});
