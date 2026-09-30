import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// O editor de "dois cliques": dist-editor/editor.html roda sem servidor.
test('editor standalone abre e é interativo via file://', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto(pathToFileURL(resolve('dist-editor/editor.html')).href, { waitUntil: 'load' });
  await expect(page.locator('.editor-topbar')).toContainText('Portfolio');
  await expect(page.locator('.editor-canvas .block').first()).toBeVisible();
  await expect(page.locator('.tb-btn', { hasText: 'Backup' })).toBeVisible();
  // Seleção funciona.
  await page.locator('.editor-canvas .block-heading', { hasText: 'Selected Work' }).click();
  await expect(page.locator('.insp-head')).toContainText('Título');
});
