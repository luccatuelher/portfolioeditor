import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

/**
 * Miniaturas no conteúdo NDA, de ponta a ponta: a capa grande de um projeto NDA
 * chega ao visitante que destrancou como miniatura de 960 px, e a foto inteira
 * (só capa) nem entra no pacote que todo visitante baixa. Nada da capa NDA —
 * inteira ou miniatura — aparece antes da senha.
 */
test('capa de projeto NDA: o pacote leva a miniatura de 960 px, não a foto de 2400 px', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  const card = page.locator('.editor-canvas .project-card').first();
  await expect(card).toBeVisible();

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

  // O 1º projeto vira NDA (mesmo caminho do f20) e o site é baixado com senha.
  await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
  await page.locator('select').first().selectOption('nda');
  await page.locator('.tb-btn.primary', { hasText: 'Baixar site' }).click();
  await page.locator('.nda-modal-row button', { hasText: 'Sugerir' }).click();
  const senha = await page.locator('.nda-modal input').inputValue();
  const baixou = page.waitForEvent('download', { timeout: 60_000 });
  await page.locator('.nda-modal-acoes .primary').click();
  const html = readFileSync(await (await baixou).path(), 'utf8');

  const ndaPos = html.indexOf('window.__NDA__=');
  expect(ndaPos, 'o pacote NDA não foi embutido').toBeGreaterThan(0);

  const site = resolve(mkdtempSync(resolve(tmpdir(), 'miniaturas-nda-')), 'index.html');
  writeFileSync(site, html);
  await page.goto(pathToFileURL(site).href, { waitUntil: 'load' });
  await page.locator('.site-header nav .nav-nda:visible').click();
  await page.locator('.nda-unlock input').fill(senha);
  await page.locator('.nda-unlock button').click();
  const thumb = page.locator('.project-card img.card-thumb').first();
  await expect(thumb).toBeVisible();
  // O card do NDA usa a miniatura (960 px de largura)…
  await expect.poll(() => thumb.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(960);
  // …e o pacote trouxe só ela: a inteira (2400 px, só capa) não veio.
  const ids = await page.evaluate(() => Object.keys((window as unknown as { __ASSETS__: Record<string, unknown> }).__ASSETS__));
  const idMini = ids.find((k) => k.endsWith('-mini') && !html.slice(0, ndaPos).includes(`"${k}"`));
  expect(idMini, 'a miniatura da capa NDA não chegou depois da senha').toBeTruthy();
  expect(ids, 'a foto inteira da capa NDA veio no pacote').not.toContain(idMini!.replace(/-mini$/, ''));
  // Antes da senha, nem a miniatura nem a inteira estão no código aberto.
  expect(html.slice(0, ndaPos)).not.toContain(idMini!.replace(/-mini$/, ''));
});
