import { test, expect } from '@playwright/test';

test.describe('Preview na Home + reordenação', () => {
  test('clicar num projeto na Home abre a prévia inline', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/preview.html?route=', { waitUntil: 'load' });
    await page.locator('.project-card', { hasText: 'A Travessia' }).click();
    const prev = page.locator('.home-preview');
    await expect(prev).toBeVisible();
    await expect(prev.locator('.home-preview-title')).toContainText('A Travessia');
    await expect(prev.locator('.home-preview-go')).toBeVisible();
    await prev.locator('.home-preview-close').click();
    await expect(page.locator('.home-preview')).toHaveCount(0);
  });

  test('galeria e sketches têm alça de arrastar no painel Dados', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
    const galleryTable = page.locator('.panel-h', { hasText: 'Galeria' }).locator('xpath=following-sibling::table[1]');
    await expect(galleryTable.locator('tbody tr').first().locator('.tree-grip')).toBeVisible();
  });

  test('badges de estado aparecem nos cards do editor', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    // torna um projeto rascunho e confere o badge no card da Home
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
    await page.locator('.data-table').first().locator('tbody tr').first().locator('.data-vis').selectOption('draft');
    await expect(page.locator('.editor-canvas .edit-badge.draft').first()).toBeVisible();
  });

  test('NDA aparece no menu com cadeado (site público)', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/preview.html', { waitUntil: 'load' });
    await expect(page.locator('.site-header nav .nav-nda')).toContainText('🔒');
  });

  test('arrastar um card na Home reordena a coleção; um Ctrl+Z desfaz', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
    const cards = page.locator('.editor-canvas .project-card[data-item-id]');
    const ordem = (): Promise<string[]> => cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-item-id')!));
    const antes = await ordem();
    expect(antes.length).toBeGreaterThanOrEqual(2);

    // Mesmo gesto do navegador: dragstart no card, dragover e drop no alvo.
    const dt = await page.evaluateHandle(() => new DataTransfer());
    await cards.nth(0).dispatchEvent('dragstart', { dataTransfer: dt });
    await cards.nth(1).dispatchEvent('dragover', { dataTransfer: dt });
    await cards.nth(1).dispatchEvent('drop', { dataTransfer: dt });
    await page.locator('.editor-canvas').dispatchEvent('dragend', { dataTransfer: dt });

    await expect.poll(ordem).not.toEqual(antes);
    const depois = await ordem();
    expect(depois.slice().sort()).toEqual(antes.slice().sort()); // só mudou a ordem
    expect(depois[0]).not.toBe(antes[0]);

    // O painel Dados mostra a mesma ordem da Home (os que aparecem lá).
    await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
    const nomesNoCanvas = await cards.evaluateAll((els) => els.map((e) => e.querySelector('.card-title, h3')?.textContent?.trim() ?? ''));
    const nomesNoPainel = await page.locator('.data-table').first().locator('.data-name').allInnerTexts();
    const noPainel = nomesNoPainel.map((n) => n.trim()).filter((n) => nomesNoCanvas.includes(n));
    expect(noPainel).toEqual(nomesNoCanvas.filter((n) => noPainel.includes(n)));

    // Um desfazer volta tudo.
    await page.locator('.editor-topbar button[aria-label^="Desfazer"]').click();
    await expect.poll(ordem).toEqual(antes);
  });
});
