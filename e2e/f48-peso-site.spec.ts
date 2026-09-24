import { test, expect } from '@playwright/test';

// O peso estimado do site aparece antes de baixar: chip na barra de cima,
// que abre o painel Dados com a régua dos 25 MB e as imagens que mais pesam.
test('chip de peso abre o detalhamento no painel Dados', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  const chip = page.locator('.tb-peso');
  await expect(chip).toHaveText(/^≈ \d+(,\d)? (KB|MB)$/);
  await chip.click();
  await expect(page.locator('.left-tabs button.active')).toHaveText('Dados');
  const painel = page.locator('.peso-site');
  await expect(painel).toContainText('de 25 MB');
  await expect(page.getByRole('meter', { name: 'Peso estimado do site' })).toBeVisible();
  // O número do chip e o do painel são o mesmo.
  const noChip = (await chip.textContent())!.replace('≈ ', '');
  await expect(painel.locator('.peso-resumo b')).toHaveText(noChip);
});
