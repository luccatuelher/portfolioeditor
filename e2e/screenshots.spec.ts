import { test, expect } from '@playwright/test';

const PAGES = [
  { name: 'home', route: '' },
  { name: 'projects', route: 'projects' },
  { name: 'gallery', route: 'gallery' },
  { name: 'blog', route: 'blog' },
  { name: 'about', route: 'about' },
  { name: 'contact', route: 'contact' },
  { name: 'project-detail', route: 'project/demo-sequencia' },
];

test.describe('renderer v4 — visual + smoke', () => {
  // Bloqueia embeds externos: screenshots determinísticos e offline-friendly.
  test.beforeEach(async ({ page }) => {
    await page.route(/youtube|youtu\.be|vimeo|speakerdeck/, (r) => r.abort());
  });

  for (const p of PAGES) {
    test(`${p.name} renderiza e captura screenshot`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));

      await page.goto(`/preview.html?route=${encodeURIComponent(p.route)}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('.site')).toBeVisible();
      await expect(page.locator('.site-header .header-name')).not.toBeEmpty();

      await page.screenshot({ path: `e2e/__screenshots__/${p.name}.png`, fullPage: true });
      expect(errors, `erros de página em ${p.name}:\n${errors.join('\n')}`).toEqual([]);
    });
  }

  test('idioma EN muda o chrome de navegação', async ({ page }) => {
    await page.goto('/preview.html?route=projects&lang=en', { waitUntil: 'load' });
    await expect(page.locator('.site-header nav')).toContainText('Projects');
  });
});
