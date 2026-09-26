import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { dimensoesDaImagem } from '../src/core/dimensoesImagem';

/**
 * Miniaturas de ponta a ponta, no navegador de verdade: uma foto grande vira a
 * capa de um projeto no editor; o site baixado leva uma miniatura de 960 px
 * (bem menor) que o card da Home usa — e a foto inteira continua no arquivo
 * para a página do projeto.
 */
test('capa grande: o card do site usa a miniatura de 960 px; a foto inteira segue no arquivo', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  const card = page.locator('.editor-canvas .project-card').first();
  await expect(card).toBeVisible();

  // Foto 2400 × 1350 feita no próprio navegador (gradiente + ruído: não comprime a quase nada).
  const b64 = await page.evaluate(async () => {
    const c = new OffscreenCanvas(2400, 1350);
    const g = c.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 2400, 1350);
    gr.addColorStop(0, '#17324d');
    gr.addColorStop(1, '#c1440e');
    g.fillStyle = gr;
    g.fillRect(0, 0, 2400, 1350);
    const d = g.getImageData(0, 0, 2400, 1350);
    for (let i = 0; i < d.data.length; i += 4) d.data[i] = (d.data[i]! + Math.random() * 60) & 255;
    g.putImageData(d, 0, 0);
    const b = await c.convertToBlob({ type: 'image/png' });
    let s = '';
    for (const x of new Uint8Array(await b.arrayBuffer())) s += String.fromCharCode(x);
    return btoa(s);
  });
  const img = card.locator('img.card-thumb');
  const antes = (await img.getAttribute('src')) ?? '';
  await card.hover();
  const escolha = page.waitForEvent('filechooser');
  await card.locator('.pe-act-image').click({ force: true });
  await (await escolha).setFiles({ name: 'capa.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await expect.poll(async () => ((await img.getAttribute('src')) ?? '') !== antes).toBe(true);

  const baixou = page.waitForEvent('download', { timeout: 30_000 });
  await page.locator('.tb-btn.primary', { hasText: 'Baixar site' }).click();
  const arquivo = await (await baixou).path();
  const html = readFileSync(arquivo, 'utf8');

  // A miniatura da capa: 960 px de largura, bem menor que a foto inteira.
  const root = html.slice(html.indexOf('<div id="root">'), html.indexOf('window.__PORTFOLIO_DATA__'));
  const idMini = root.match(/data-asset="([\w-]+-mini)"/)?.[1];
  expect(idMini, 'o card da Home não usa miniatura').toBeTruthy();
  const idInteira = idMini!.replace(/-mini$/, '');
  const dados = (id: string): string => html.match(new RegExp(`__IMG__\\("${id}","([^"]+)"\\)`))![1]!;
  const mini = dados(idMini!);
  const inteira = dados(idInteira);
  expect(dimensoesDaImagem(mini)).toEqual({ w: 960, h: 540 });
  expect(dimensoesDaImagem(inteira)?.w).toBe(2400);
  expect(mini.length).toBeLessThan(inteira.length * 0.4);

  // Aberto no navegador (como index.html: o download vem sem extensão): o card mostra a miniatura.
  const site = resolve(mkdtempSync(resolve(tmpdir(), 'miniaturas-')), 'index.html');
  writeFileSync(site, html);
  await page.goto(pathToFileURL(site).href, { waitUntil: 'load' });
  const src = await page.locator('.project-card img.card-thumb').first().getAttribute('src');
  expect(src).toBe(mini);
});
