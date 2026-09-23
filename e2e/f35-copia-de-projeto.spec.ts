import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Ctrl+D / Ctrl+C + Ctrl+V num projeto: a cópia é independente, sem nenhum
// id de seção ou bloco em comum com o original.
test('duplicar e colar um projeto dá ids novos às seções e aos blocos', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  const cards = page.locator('.editor-canvas .project-card');
  await expect(cards.first()).toBeVisible();
  const antes = await cards.count();

  await cards.first().locator('.pe-act-edit').click({ force: true });
  await page.keyboard.press('Control+d');
  await expect(cards).toHaveCount(antes + 1);
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await expect(cards).toHaveCount(antes + 2);

  const baixou = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const doc = JSON.parse(readFileSync((await (await baixou).path())!, 'utf8')).doc;

  type Sec = { id: string; blocks: { id: string }[] };
  const secoes: Sec[] = [
    ...doc.pages.flatMap((p: { sections: Sec[] }) => p.sections),
    ...doc.collections.projects.flatMap((p: { sections: Sec[] }) => p.sections),
    ...doc.collections.blog.flatMap((b: { sections: Sec[] }) => b.sections),
  ];
  const ids = [...secoes.map((s) => s.id), ...secoes.flatMap((s) => s.blocks.map((b) => b.id))];
  expect(ids.length).toBeGreaterThan(0);
  expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);

  // A prévia de cada projeto só aponta blocos dele mesmo.
  for (const p of doc.collections.projects as { id: string; sections: Sec[]; preview?: { items: { ref: string }[] } }[]) {
    const proprios = new Set(p.sections.flatMap((s) => s.blocks.map((b) => b.id)));
    for (const it of p.preview?.items ?? []) expect(proprios.has(it.ref), `prévia de ${p.id} aponta ${it.ref}`).toBe(true);
  }
});
