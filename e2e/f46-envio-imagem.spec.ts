import { test, expect, type Page } from '@playwright/test';

// Enviar imagem não pode piorar o que já está bom: SVG continua vetorial e um
// JPG pequeno que já cabe continua o mesmo arquivo (não vira WebP maior).
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#e33"/></svg>';

async function enviar(page: Page, arquivo: { name: string; mimeType: string; buffer: Buffer }): Promise<string> {
  const bloco = page.locator('.editor-canvas .block-image').first();
  const img = bloco.locator('img.block-image-img');
  // As imagens do exemplo já são SVG: esperar só pelo tipo passava com a imagem
  // ANTIGA, antes de o envio terminar. Espera o src mudar.
  const antes = (await img.getAttribute('src')) ?? '';
  await bloco.hover();
  const escolha = page.waitForEvent('filechooser');
  await bloco.locator('.pe-act-image').click({ force: true });
  await (await escolha).setFiles(arquivo);
  await expect.poll(async () => { const src = (await img.getAttribute('src')) ?? ''; return src === antes ? '' : src; }).toMatch(new RegExp(`^data:${arquivo.mimeType.replace('+', '\\+')}`));
  return (await img.getAttribute('src'))!;
}

test('SVG fica vetorial e JPG pequeno fica como veio', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await expect(page.locator('.editor-canvas .block-image').first()).toBeVisible();

  const svg = await enviar(page, { name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) });
  expect(Buffer.from(svg.split(',')[1]!, 'base64').toString()).toBe(SVG);

  // JPG já bem comprimido (textura + qualidade baixa), feito pelo próprio
  // navegador: recodificar em WebP 0,82 só aumentaria o peso.
  const b64 = await page.evaluate(async () => {
    const c = new OffscreenCanvas(320, 200);
    const g = c.getContext('2d')!;
    const d = g.createImageData(320, 200);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i] = Math.random() * 255; d.data[i + 1] = Math.random() * 255; d.data[i + 2] = Math.random() * 255; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    const b = await c.convertToBlob({ type: 'image/jpeg', quality: 0.3 });
    let s = '';
    for (const x of new Uint8Array(await b.arrayBuffer())) s += String.fromCharCode(x);
    return btoa(s);
  });
  const jpg = await enviar(page, { name: 'pequena.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
  expect(jpg.split(',')[1]).toBe(b64);
});

// Enviar imagem é UMA ação: o registro técnico do arquivo (tamanho, tipo)
// virava um passo de desfazer invisível — o 2º Ctrl+Z não fazia nada.
test('depois de enviar imagem, cada Ctrl+Z desfaz algo que se vê', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  const blocos = page.locator('.editor-canvas [data-block-id]');
  const total = await blocos.count();
  // Uma edição qualquer antes do envio: excluir um bloco de divisor/espaço/título.
  await page.locator('.editor-canvas .block-heading').first().click();
  await page.locator('.editor-topbar').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Delete');
  await expect(blocos).toHaveCount(total - 1);

  const img = page.locator('.editor-canvas .block-image').first().locator('img.block-image-img');
  const original = (await img.getAttribute('src')) ?? '';
  await enviar(page, { name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) });
  await page.locator('.editor-topbar').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+z');
  await expect.poll(async () => img.getAttribute('src')).toBe(original);
  await page.keyboard.press('Control+z');
  await expect(blocos).toHaveCount(total);
});
