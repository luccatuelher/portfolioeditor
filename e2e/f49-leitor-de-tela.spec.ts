import { test, expect } from '@playwright/test';

// Canvas para quem usa leitor de tela: cada ícone diz de que elemento é, a
// linha selecionada nas Layers é "atual" e a seleção é anunciada.
test('ícones com nome do alvo, Layers com aria-current e anúncio da seleção', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  const titulo = page.locator('.editor-canvas .block-heading').first();
  await expect(titulo).toBeVisible();

  // Nomes: "Editar: Título · …", "Editar: projeto “…”" — não mais dezenas de "Editar" iguais.
  await expect(titulo.locator(':scope > .pe-actions .pe-act-edit')).toHaveAttribute('aria-label', /^Editar: Título · /);
  await expect(page.locator('.editor-canvas .project-card .pe-act-edit').first()).toHaveAttribute('aria-label', /^Editar: projeto “/);
  const nomes = await page.locator('.editor-canvas .pe-act').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label')));
  expect(nomes.every((n) => n && n.includes(': '))).toBe(true);

  await titulo.click();
  // Anúncio da seleção.
  await expect(page.locator('.sr-only[aria-live="polite"]')).toHaveText(/^Selecionado: Título · /);
  // A linha dele nas Layers é a atual.
  await page.locator('.left-tabs button', { hasText: 'Layers' }).click();
  await expect(page.locator('.editor-left .tree-main[aria-current="true"]')).toHaveCount(1);
  await expect(page.locator('.editor-left .tree-main[aria-current="true"]')).toContainText('Título');
});
