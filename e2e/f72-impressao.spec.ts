import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

/**
 * Guarda da impressão: quem salva uma página do site como PDF leva o conteúdo,
 * não o menu, as bandeiras, a janela de imagem nem o fundo escuro do tema.
 * O vídeo vira nome + endereço (o player não toca no papel).
 */
function publicar(fixture: string): string {
  const saida = resolve(mkdtempSync(resolve(tmpdir(), 'impressao-')), 'index.html');
  execFileSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', 'vite.emit.config.ts'], {
    env: { ...process.env, PUBLISH_FIXTURE: fixture, PUBLISH_SHELL: 'src/publish/site-shell.html', PUBLISH_OUTPUT: saida },
    stdio: 'ignore',
  });
  return pathToFileURL(saida).href;
}

test('imprimir: sem menu nem janelas, texto escuro no branco, vídeo vira endereço', async ({ page }) => {
  const url = publicar('template-v3.json');
  await page.route(/youtube|youtu\.be|vimeo|speakerdeck|ytimg|fonts\.googleapis|fonts\.gstatic/, (r) => r.abort());
  await page.goto(url, { waitUntil: 'load' });

  const rotas = await page.evaluate(() => {
    type D = { collections: { projects: { id: string }[] } };
    const d = (window as unknown as { __PORTFOLIO_DATA__: D }).__PORTFOLIO_DATA__;
    return d.collections.projects.map((p) => `project/${p.id}`);
  });
  // Acha um projeto que tem vídeo.
  let rotaComVideo = '';
  for (const r of rotas) {
    await page.evaluate((x) => { location.hash = `#${x}`; }, r);
    await expect(page.locator(`main#conteudo[data-route="${r}"]`)).toBeVisible();
    if (await page.locator('.embed-area iframe').count()) { rotaComVideo = r; break; }
  }
  expect(rotaComVideo, 'nenhum projeto da fixture tem vídeo').not.toBe('');

  // Tema escuro: no papel nada disso pode sobrar.
  await page.evaluate(() => {
    const s = document.querySelector<HTMLElement>('.site')!;
    s.style.setProperty('--ink', 'rgb(240, 240, 240)');
    s.style.setProperty('--bg', 'rgb(20, 20, 20)');
  });
  // Janela de imagem aberta na tela: some no papel.
  const foto = page.locator('main img').first();
  if (await foto.count()) await foto.click({ trial: true }).catch(() => undefined);

  await page.emulateMedia({ media: 'print' });
  const display = (sel: string) => page.locator(sel).evaluateAll((els) => els.map((e) => getComputedStyle(e).display));
  for (const sel of ['.sticky-nav', '.skip-link', '.hdr-nav', '.hdr-lang', '.detail-pager', '.embed-area iframe', '.lightbox']) {
    for (const d of await display(sel)) expect(d, `${sel} aparece na impressão`).toBe('none');
  }
  expect(await page.locator('.site').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(255, 255, 255)');
  const cor = await page.locator('main').evaluate((e) => getComputedStyle(e).color);
  expect(cor, 'texto claro no papel').toBe('rgb(0, 0, 0)');
  for (const t of await page.locator('.site .block').evaluateAll((els) => els.map((e) => getComputedStyle(e).transform))) expect(t).toBe('none');
  for (const b of await page.locator('main img').evaluateAll((els) => els.map((e) => getComputedStyle(e).breakInside))) expect(b).toBe('avoid');
  const video = await page.locator('.embed-area').first().evaluate((e) => getComputedStyle(e, '::after').content);
  expect(video, 'vídeo sem o endereço no papel').toMatch(/youtu|vimeo|speakerdeck/);
  expect(await page.locator('h1').count()).toBe(1);

  // Um PDF de verdade sai (A4) e tem conteúdo.
  const pdf = await page.pdf({ format: 'A4' });
  expect(pdf.length).toBeGreaterThan(5_000);

  // Voltou para a tela: nada vazou.
  await page.emulateMedia({ media: 'screen' });
  expect(await page.locator('.sticky-nav').first().evaluate((e) => getComputedStyle(e).display)).toBe('flex');
});
