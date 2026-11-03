import { test, expect } from '@playwright/test';

// Várias imagens soltas de uma vez sobre uma galeria viram itens; mudar algo acende "não publicado" depois de publicar.
test('soltar 3 imagens numa galeria cria 3 itens', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
  await page.locator('.newpage').click();
  await page.getByRole('group', { name: 'Modelo da página nova' }).getByRole('button', { name: 'Galeria' }).click();
  await page.locator('.tree-rename').press('Enter');
  const grid = page.locator('.editor-canvas .collection-gallery');
  await expect(grid).toHaveCount(1);
  const antes = await page.locator('.editor-canvas .collection-gallery .art-item').count();
  await page.evaluate(async () => {
    const mk = async (name: string, cor: string): Promise<File> => {
      const c = document.createElement('canvas');
      c.width = 60; c.height = 40;
      const g = c.getContext('2d')!; g.fillStyle = cor; g.fillRect(0, 0, 60, 40);
      const blob: Blob = await new Promise((ok) => c.toBlob((b) => ok(b!), 'image/png'));
      return new File([blob], name, { type: 'image/png' });
    };
    const dt = new DataTransfer();
    for (const [n, c] of [['b.png', '#c33'], ['a.png', '#3c3'], ['c.png', '#33c']] as const) dt.items.add(await mk(n, c));
    const alvo = document.querySelector('.editor-canvas .collection-gallery')!.closest('[data-block-id]')!;
    alvo.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    alvo.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  await expect(page.locator('.editor-canvas .collection-gallery .art-item')).toHaveCount(antes + 3);
});

test('indicador de alterações não publicadas', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  // Nunca publicou neste navegador: nada a mostrar.
  await expect(page.locator('.tb-nao-publicado')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem('pe:publicadoHash', 'antigo'));
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('.tb-nao-publicado')).toBeVisible({ timeout: 5000 });
});
