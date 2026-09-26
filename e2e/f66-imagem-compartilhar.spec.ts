import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dimensoesDaImagem } from '../src/core/dimensoesImagem';

/**
 * Imagem ao compartilhar o link, de ponta a ponta: escolhida na Home › SEO,
 * com o endereço do site preenchido, o "Baixar site" entrega DOIS arquivos —
 * o index.html apontando para a imagem pelo endereço, e o compartilhar.jpg no
 * tamanho do cartão das redes (1200 × 630). A imagem não vai embutida no
 * index.html, e o aviso manda subir o arquivo junto.
 */
test('Baixar site entrega o index.html e o compartilhar.jpg (1200 × 630) apontado pelo endereço', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });

  // Endereço do site (Tema › Avançado).
  await page.locator('.left-tabs button', { hasText: 'Tema' }).click();
  await page.locator('.theme-advanced > summary').click();
  await page.locator('.site-url-input').fill('https://lucca.github.io/portfolio');

  // Imagem de compartilhamento da Home (foto 1600 × 1600: o cartão corta ao centro).
  await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
  await page.locator('.editor-left .tree-row.pagerow .tree-main').first().click();
  await page.locator('.inspector summary', { hasText: 'SEO e compartilhamento' }).click();
  const b64 = await page.evaluate(async () => {
    const c = new OffscreenCanvas(1600, 1600);
    const g = c.getContext('2d')!;
    g.fillStyle = '#17324d';
    g.fillRect(0, 0, 1600, 1600);
    g.fillStyle = '#c1440e';
    g.fillRect(400, 400, 800, 800);
    const b = await c.convertToBlob({ type: 'image/png' });
    let s = '';
    for (const x of new Uint8Array(await b.arrayBuffer())) s += String.fromCharCode(x);
    return btoa(s);
  });
  const escolha = page.waitForEvent('filechooser');
  await page.locator('.inspector .insp-row', { hasText: 'Imagem ao compartilhar o link' }).locator('button').first().click();
  await (await escolha).setFiles({ name: 'capa.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  const miniatura = page.locator('.inspector .insp-row', { hasText: 'Imagem ao compartilhar o link' }).locator('img');
  await expect(miniatura).toBeVisible();
  // O que o editor guardou (a foto enviada vira WebP): é isso que não pode ir embutido.
  const guardada = (await miniatura.getAttribute('src')) ?? '';
  expect(guardada).toMatch(/^data:image\//);

  // Baixar site: dois arquivos.
  const baixados: { nome: string; caminho: string }[] = [];
  page.on('download', async (d) => baixados.push({ nome: d.suggestedFilename(), caminho: await d.path() }));
  await page.locator('.tb-btn.primary', { hasText: 'Baixar site' }).click();
  await expect.poll(() => baixados.map((b) => b.nome).sort()).toEqual(['compartilhar.jpg', 'index.html']);
  await expect.poll(() => baixados.every((b) => !!b.caminho)).toBe(true);

  const jpg = readFileSync(baixados.find((b) => b.nome === 'compartilhar.jpg')!.caminho);
  expect(dimensoesDaImagem(`data:image/jpeg;base64,${jpg.toString('base64')}`)).toEqual({ w: 1200, h: 630 });

  const html = readFileSync(baixados.find((b) => b.nome === 'index.html')!.caminho, 'utf8');
  expect(html).toContain('<meta property="og:image" content="https://lucca.github.io/portfolio/compartilhar.jpg">');
  // A foto enviada não vai embutida (o site não a mostra).
  expect(html).not.toContain(guardada.slice(-80));

  // O aviso manda subir o arquivo junto do index.html.
  await expect(page.locator('.publish-notice')).toContainText('compartilhar.jpg');
});
