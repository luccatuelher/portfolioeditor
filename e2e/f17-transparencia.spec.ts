import { test, expect } from '@playwright/test';

/**
 * PNG/WebP/SVG com transparência tem que mostrar o fundo da PÁGINA por trás —
 * nenhuma imagem pode ter cor de fundo própria (era var(--surface), um cinza
 * que apagava a transparência). Vale para todas as imagens, em todas as páginas.
 */
test('nenhuma imagem do site tem fundo próprio', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.waitForSelector('.editor-canvas .card-thumb-wrap, .editor-canvas .block-image-img');

  const seletores = ['.block-image-img', '.card-thumb-wrap', '.blog-thumb', '.art-img', '.sketch-item img', '.storyboard-frame', '.contact-img'];
  const fundos = await page.evaluate(
    (sels) =>
      sels.flatMap((sel) =>
        [...document.querySelectorAll(sel)].map((el) => ({ sel, bg: getComputedStyle(el).backgroundColor })),
      ),
    seletores,
  );

  expect(fundos.length).toBeGreaterThan(0);
  expect(fundos.filter((f) => f.bg !== 'rgba(0, 0, 0, 0)' && f.bg !== 'transparent')).toEqual([]);
});
