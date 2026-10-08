import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

/**
 * Acessibilidade de navegação do site publicado:
 * - "Pular para o conteúdo" leva ao <main> e NÃO vira rota ("#conteudo" já mostrou
 *   a tela "não encontrado");
 * - depois de trocar de página, o foco vai para o título da página (antes caía no <body>).
 */
function publicar(): string {
  const saida = resolve(mkdtempSync(resolve(tmpdir(), 'pular-foco-')), 'index.html');
  execFileSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', 'vite.emit.config.ts'], {
    env: { ...process.env, PUBLISH_FIXTURE: 'template-v3.json', PUBLISH_SHELL: 'src/publish/site-shell.html', PUBLISH_OUTPUT: saida },
    stdio: 'ignore',
  });
  return pathToFileURL(saida).href;
}

test('o link de pular leva ao conteúdo sem trocar de rota', async ({ page }) => {
  await page.route(/youtube|youtu\.be|vimeo|speakerdeck|ytimg|fonts\.googleapis|fonts\.gstatic/, (r) => r.abort());
  await page.goto(publicar(), { waitUntil: 'load' });
  // O runtime troca a Home pré-renderizada pela viva; um Tab dado nesse instante
  // perde o foco com o elemento antigo. Sob carga isso derrubava o teste 1 em N:
  // repete o Tab (do começo) até o foco ficar no link de pular.
  await expect(async () => {
    // O ponto de partida do Tab só se move quando algo novo recebe foco: focar o
    // <body> o devolve ao topo da página.
    await page.evaluate(() => { const b = document.body; b.tabIndex = -1; b.focus(); b.removeAttribute('tabindex'); });
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  await page.keyboard.press('Enter');
  await expect(page.locator('main#conteudo')).toBeFocused();
  await expect(page.locator('.nao-encontrado')).toHaveCount(0);
  await expect(page.locator('main#conteudo[data-route="home"]')).toBeVisible();
  expect(page.url()).not.toContain('#conteudo');
});

test('um endereço com #conteudo abre a Home, não "não encontrado"', async ({ page }) => {
  await page.route(/youtube|youtu\.be|vimeo|speakerdeck|ytimg|fonts\.googleapis|fonts\.gstatic/, (r) => r.abort());
  await page.goto(`${publicar()}#conteudo`, { waitUntil: 'load' });
  await expect(page.locator('main#conteudo[data-route="home"]')).toBeVisible();
  await expect(page.locator('.nao-encontrado')).toHaveCount(0);
});

test('trocar de página leva o foco ao título da nova página', async ({ page }) => {
  await page.route(/youtube|youtu\.be|vimeo|speakerdeck|ytimg|fonts\.googleapis|fonts\.gstatic/, (r) => r.abort());
  await page.goto(publicar(), { waitUntil: 'load' });
  await page.locator('header .nav-link', { hasText: /Projetos|Projects/ }).first().click();
  await expect(page.locator('main#conteudo[data-route="projects"]')).toBeVisible();
  await expect(page.locator('main#conteudo h1').first()).toBeFocused();
  // Ao abrir o site, o foco não é roubado.
  await page.goto(`${publicar()}#projects`, { waitUntil: 'load' });
  await expect(page.locator('main#conteudo[data-route="projects"]')).toBeVisible();
  await expect(page.locator('main#conteudo h1').first()).not.toBeFocused();
});

test('em inglês, o link de pular clicado antes do site subir também não vira rota', async ({ page }) => {
  await page.route(/youtube|youtu\.be|vimeo|speakerdeck|ytimg|fonts\.googleapis|fonts\.gstatic/, (r) => r.abort());
  await page.addInitScript(() => { if (window.top === window) localStorage.setItem('portfolio-lang', 'en'); });
  await page.goto(`${publicar()}#conteudo-en`, { waitUntil: 'load' });
  await expect(page.locator('main#conteudo[data-route="home"]')).toBeVisible();
  await expect(page.locator('.nao-encontrado')).toHaveCount(0);
});
