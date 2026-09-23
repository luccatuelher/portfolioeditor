import { test, expect } from '@playwright/test';

// Site publicado usado só pelo teclado: o foco nunca pode se perder no <body>
// quando algo fecha, e o que leva a outra página é link de verdade.
test.describe('Site pelo teclado', () => {
  test('prévia do projeto: aria-expanded, Esc fecha e o foco volta ao card', async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck|ytimg/, (r) => r.abort());
    await page.goto('/preview.html', { waitUntil: 'load' });
    const card = page.locator('.project-card').first();
    await expect(card).toHaveAttribute('aria-expanded', 'false');
    await card.focus();
    await page.keyboard.press('Enter');
    const painel = page.locator('.home-preview');
    await expect(painel).toBeVisible();
    await expect(card).toHaveAttribute('aria-expanded', 'true');
    await expect(painel).toHaveAttribute('role', 'region');
    const controla = await card.getAttribute('aria-controls');
    expect(controla).toBeTruthy();
    await expect(painel).toHaveAttribute('id', controla!);

    // Esc de dentro do painel fecha e devolve o foco ao card.
    await painel.locator('.home-preview-go').focus();
    await page.keyboard.press('Escape');
    await expect(painel).toHaveCount(0);
    await expect(card).toBeFocused();

    // O ✕ também devolve o foco ao card.
    await page.keyboard.press('Enter');
    await painel.locator('.home-preview-close').focus();
    await page.keyboard.press('Enter');
    await expect(painel).toHaveCount(0);
    await expect(card).toBeFocused();
  });

  test('visualizador de imagem devolve o foco a quem o abriu', async ({ page }) => {
    await page.goto('/preview.html?route=gallery', { waitUntil: 'load' });
    const botao = page.locator('.art-img-btn').nth(1);
    await botao.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.lightbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.lightbox')).toHaveCount(0);
    await expect(botao).toBeFocused();
  });

  test('nome no topo e menu são links: alcançáveis pelo Tab e abríveis em nova aba', async ({ page }) => {
    await page.goto('/preview.html?route=gallery', { waitUntil: 'load' });
    const nome = page.locator('.site-header a.site-header-left');
    await expect(nome).toHaveAttribute('href', '#');
    const links = page.locator('.site-header nav a.nav-link');
    expect(await links.count()).toBeGreaterThan(0);
    const href = await links.first().getAttribute('href');
    expect(href).toMatch(/^#/);

    // Clique comum continua navegando dentro do site, sem recarregar.
    await links.nth(1).click();
    await expect(page.locator('main[data-route]')).not.toHaveAttribute('data-route', 'gallery');
    // O nome leva à Home pelo teclado.
    await nome.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('main[data-route]')).toHaveAttribute('data-route', 'home');
  });
});
