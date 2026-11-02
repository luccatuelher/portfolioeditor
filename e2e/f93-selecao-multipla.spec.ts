import { test, expect, type Page } from '@playwright/test';

// Seleção múltipla (Shift+clique), como no Adobe Portfolio: alinhar, duplicar e excluir vários blocos de uma vez.
async function abrir(page: Page): Promise<string[]> {
  await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.waitForSelector('.editor-canvas .block[data-block-id]');
  const ids = await page.locator('.editor-canvas .block-heading[data-block-id], .editor-canvas .block-text[data-block-id]').evaluateAll((els) => els.slice(0, 2).map((e) => e.getAttribute('data-block-id')!));
  expect(ids.length).toBe(2);
  await page.locator(`.editor-canvas [data-block-id="${ids[0]}"]`).click({ position: { x: 4, y: 4 } });
  await page.locator(`.editor-canvas [data-block-id="${ids[1]}"]`).click({ position: { x: 4, y: 4 }, modifiers: ['Shift'] });
  return ids;
}

test('Shift+clique junta blocos; Delete exclui todos num passo e Desfazer devolve', async ({ page }) => {
  const ids = await abrir(page);
  await expect(page.locator('.multi-bar')).toContainText('2 blocos');
  await expect(page.locator(`.editor-canvas [data-block-id="${ids[1]}"]`)).toHaveClass(/is-multi/);
  const total = await page.locator('.editor-canvas .block[data-block-id]').count();
  await page.keyboard.press('Delete');
  await expect(page.locator('.editor-canvas .block[data-block-id]')).toHaveCount(total - 2);
  await expect(page.locator('.multi-bar')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.editor-canvas .block[data-block-id]')).toHaveCount(total);
});

test('alinhar e duplicar o grupo pela barra', async ({ page }) => {
  const ids = await abrir(page);
  await page.locator('.multi-bar').getByRole('button', { name: /^↔$/ }).click();
  for (const id of ids) await expect(page.locator(`.editor-canvas [data-block-id="${id}"]`)).toHaveClass(/align-center/);
  const total = await page.locator('.editor-canvas .block[data-block-id]').count();
  await page.locator('.multi-bar').getByRole('button', { name: 'Duplicar' }).click();
  await expect(page.locator('.editor-canvas .block[data-block-id]')).toHaveCount(total + 2);
  await expect(page.locator('.multi-bar')).toContainText('2 blocos');
  await page.keyboard.press('Escape');
  await expect(page.locator('.multi-bar')).toHaveCount(0);
});
