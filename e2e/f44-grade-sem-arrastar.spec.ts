import { test, expect, type Page } from '@playwright/test';

// Montar a grade sem arrastar (toque, teclado): pelos botões de
// "Posição na grade" no Inspector › Layout.
const caixa = async (page: Page, id: string) => (await page.locator(`.editor-canvas [data-block-id="${id}"]`).boundingBox())!;

test('lado a lado, embaixo do anterior e linha própria, sem arrastar', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });

  // Seção com Storyboard + Vídeo, um embaixo do outro (linhas próprias).
  const video = page.locator('.editor-canvas .block-embed').first();
  const idVideo = (await video.getAttribute('data-block-id'))!;
  const idStory = (await page.locator('.editor-canvas .block-storyboard').first().getAttribute('data-block-id'))!;
  await video.click();
  await page.locator('.insp-tab', { hasText: 'Layout' }).click();
  const grade = page.getByRole('group', { name: 'Posição na grade' });
  await expect(grade.getByRole('button', { name: /Linha própria/ })).toBeDisabled();

  // Ao lado do anterior: mesma linha (mesmo topo), à direita.
  await grade.getByRole('button', { name: /Ao lado do anterior/ }).click();
  await expect.poll(async () => Math.abs((await caixa(page, idVideo)).y - (await caixa(page, idStory)).y)).toBeLessThan(4);
  expect((await caixa(page, idVideo)).x).toBeGreaterThan((await caixa(page, idStory)).x);
  await expect(grade.getByRole('button', { name: /Ao lado do anterior/ })).toBeDisabled();

  // Linha própria: volta para baixo, na largura toda.
  await grade.getByRole('button', { name: /Linha própria/ }).click();
  await expect.poll(async () => (await caixa(page, idVideo)).y).toBeGreaterThan((await caixa(page, idStory)).y + 20);
  await expect(grade.getByRole('button', { name: /Linha própria/ })).toBeDisabled();

  // Tudo é desfazível como qualquer mudança.
  await page.keyboard.press('Control+z');
  await expect.poll(async () => Math.abs((await caixa(page, idVideo)).y - (await caixa(page, idStory)).y)).toBeLessThan(4);
});
