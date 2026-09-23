import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// A categoria do projeto é uma escolha fechada no Inspector: o que se escolhe
// é exatamente o que o filtro "Profissionais / Pessoais" do site entende.
test('Categoria no Inspector é escolha fechada e grava o valor do filtro', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  const card = page.locator('.editor-canvas .project-card').first();
  await expect(card).toBeVisible();
  await card.locator('.pe-act-edit').click({ force: true });

  const campo = page.getByRole('combobox', { name: 'Categoria' });
  await expect(campo).toBeVisible();
  const opcoes = await campo.locator('option').allTextContents();
  expect(opcoes.slice(0, 3)).toEqual(['— Sem categoria', 'Profissional', 'Pessoal']);

  await campo.selectOption('personal');
  await expect(campo).toHaveValue('personal');

  const baixou = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const doc = JSON.parse(readFileSync((await (await baixou).path())!, 'utf8')).doc;
  const id = await card.getAttribute('data-card');
  const proj = doc.collections.projects.find((p: { id: string }) => p.id === id);
  expect(proj.meta.category).toEqual({ pt: 'personal', en: 'personal' });

  // "Sem categoria" tira o campo em vez de deixar texto vazio.
  await campo.selectOption('');
  const baixou2 = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const doc2 = JSON.parse(readFileSync((await (await baixou2).path())!, 'utf8')).doc;
  expect(doc2.collections.projects.find((p: { id: string }) => p.id === id).meta.category).toBeUndefined();
});
