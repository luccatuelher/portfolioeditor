import { test, expect } from '@playwright/test';

test.describe('Paridade com o site antigo', () => {
  test('filtro de projetos por categoria (visitante)', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/preview.html?route=projects', { waitUntil: 'load' });

    await expect(page.locator('.project-filter .filter-btn')).toHaveCount(3);
    // Profissionais → só "Intervalo".
    await page.locator('.filter-btn', { hasText: 'Profissionais' }).click();
    await expect(page.locator('.project-card', { hasText: 'Intervalo' })).toBeVisible();
    await expect(page.locator('.project-card', { hasText: 'A Travessia' })).toHaveCount(0);
    // Pessoais → "A Travessia" aparece, "Intervalo" some.
    await page.locator('.filter-btn', { hasText: 'Pessoais' }).click();
    await expect(page.locator('.project-card', { hasText: 'A Travessia' })).toBeVisible();
    await expect(page.locator('.project-card', { hasText: 'Intervalo' })).toHaveCount(0);
  });

  test('detalhe do projeto mostra metadados (ano, cliente, papel…)', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/preview.html?route=project/demo-sequencia', { waitUntil: 'load' });
    await expect(page.locator('.detail-meta')).toBeVisible();
    await expect(page.locator('.detail-meta')).toContainText('2026'); // ano
    await expect(page.locator('.detail-tag')).toBeVisible();
  });

  test('contato mostra telefone (tel:)', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/preview.html?fixture=synthetic&route=contact', { waitUntil: 'load' });
    const phone = page.locator('.contact-phone');
    await expect(phone).toBeVisible();
    await expect(phone).toHaveAttribute('href', /^tel:/);
  });
});
