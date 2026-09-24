import { test, expect, type Page } from '@playwright/test';

// Editor só com teclado: nenhuma parada do Tab em botão invisível, chegar a
// um elemento do canvas e selecioná-lo com Enter, e mover com Alt+↑/↓.
const abrir = async (page: Page): Promise<void> => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await expect(page.locator('.editor-canvas .block-heading').first()).toBeVisible();
};

test('o Tab nunca para em botão invisível', async ({ page }) => {
  await abrir(page);
  for (let i = 0; i < 90; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150); // fim da transição de opacidade
    const f = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      if (!e || e === document.body) return null;
      let op = 1;
      for (let n: HTMLElement | null = e; n; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
      return { op, desc: `${e.tagName} ${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)}` };
    });
    if (f) expect(f.op, `parada invisível: ${f.desc}`).toBeGreaterThan(0.3);
  }
});

test('Enter no "Editar" de um elemento seleciona; Alt+↓ / Alt+↑ movem', async ({ page }) => {
  await abrir(page);
  const ordem = (): Promise<string[]> => page.locator('.editor-canvas .section').nth(1).locator(':scope .block[data-block-id]').evaluateAll((els) => els.map((e) => e.getAttribute('data-block-id')!));
  const antes = await ordem();
  expect(antes.length).toBeGreaterThanOrEqual(2);
  const primeiro = page.locator(`.editor-canvas [data-block-id="${antes[0]}"]`);
  const editar = primeiro.locator(':scope > .pe-actions .pe-act-edit');
  await editar.focus();
  await expect(primeiro.locator(':scope > .pe-actions')).toHaveCSS('opacity', '1');
  await page.keyboard.press('Enter');
  await expect(primeiro).toHaveClass(/is-selected/);

  // O foco volta ao corpo da página para os atalhos valerem (não está num campo).
  await page.locator('.editor-canvas').evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(ordem).toEqual([antes[1], antes[0], ...antes.slice(2)]);
  await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(ordem).toEqual(antes);
});
