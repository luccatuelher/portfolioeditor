import { test, expect } from '@playwright/test';

test.describe('Quadros de storyboard e sketches', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  });

  test('o quadro tem as mesmas ações de uma imagem solta', async ({ page }) => {
    const quadro = page.locator('.editor-canvas .storyboard-cell').first();
    await quadro.scrollIntoViewIfNeeded();
    await quadro.hover();
    const acoes = await quadro.locator('[data-act]').evaluateAll((els) => els.map((e) => e.getAttribute('data-act')));
    expect(acoes).toEqual(['image', 'crop', 'edit', 'delete']);
  });

  test('editar o quadro abre a descrição dele, e o texto chega na imagem', async ({ page }) => {
    const quadro = page.locator('.editor-canvas .storyboard-cell').first();
    await quadro.scrollIntoViewIfNeeded();
    await quadro.hover();
    await quadro.locator('[data-act=edit]').click();

    await expect(page.locator('.insp-quadro.em-foco')).toBeVisible();
    await page.locator('.insp-quadro.em-foco [data-campo="frames.0.alt"] input').fill('Cena 1: personagem entra pela esquerda');
    await expect(page.locator('.editor-canvas .storyboard-cell img').first()).toHaveAttribute('alt', 'Cena 1: personagem entra pela esquerda');
  });

  test('legenda do quadro: aparece embaixo dele, entra nas traduções e "Traduzir" leva ao campo', async ({ page }) => {
    await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
    const faltam = async (): Promise<number> => Number(await page.locator('.traducoes').getAttribute('data-faltam'));
    const antes = await faltam();

    const quadro = page.locator('.editor-canvas .storyboard-cell').first();
    await quadro.scrollIntoViewIfNeeded();
    await quadro.hover();
    await quadro.locator('[data-act=edit]').click();
    const legenda = page.locator('.insp-quadro.em-foco [data-campo="frames.0.caption"] input');
    await legenda.fill('SH 01 — Ana entra pela esquerda');
    await legenda.press('Tab');

    // No canvas: embaixo do quadro, ligada a ele (figure/figcaption).
    await expect(page.locator('.editor-canvas figure.storyboard-cell').first().locator('figcaption')).toHaveText('SH 01 — Ana entra pela esquerda');
    // Só em português: vira pendência de tradução.
    await expect.poll(faltam).toBe(antes + 1);

    await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
    await page.locator('.traducoes > summary').click();
    await page.locator('.traducoes-lista li', { hasText: 'Quadro 1 (legenda)' }).locator('.descricoes-ir').click();
    await expect(page.locator('.insp-lang', { hasText: 'EN' })).toHaveAttribute('aria-pressed', 'true');
    const emIngles = page.locator('.inspector [data-campo="frames.0.caption"] input');
    await expect(emIngles).toBeFocused();
    await emIngles.fill('SH 01 — Ana enters from the left');
    await emIngles.press('Tab');
    await expect.poll(faltam).toBe(antes);
  });

  test('legenda do bloco Imagem: aparece embaixo da imagem, no idioma escolhido', async ({ page }) => {
    const img = page.locator('.editor-canvas .block-image-img').first();
    await img.scrollIntoViewIfNeeded();
    await img.click();
    const campo = page.locator('.inspector [data-campo="content.caption"] input');
    await campo.fill('Frame final, 2024');
    await campo.press('Tab');
    await expect(page.locator('.editor-canvas figure.block-image-inner figcaption').first()).toHaveText('Frame final, 2024');
    // Apagar a legenda tira a <figure>: a imagem volta a ser só imagem.
    await campo.fill('');
    await campo.press('Tab');
    await expect(page.locator('.editor-canvas figure.block-image-inner')).toHaveCount(0);
  });

  test('sketch também ganhou a ação de editar (era a única imagem sem ela)', async ({ page }) => {
    await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
    const sketches = page.locator('.tree-row.pagerow').filter({ hasText: 'Sketch' });
    if (await sketches.count()) await sketches.first().click();
    else await page.locator('.left-tabs button', { hasText: 'Dados' }).click();

    const item = page.locator('.editor-canvas .sketch-item').first();
    if (!(await item.count())) test.skip(true, 'fixture sem página de sketches no canvas');
    await item.hover();
    const acoes = await item.locator('[data-act]').evaluateAll((els) => els.map((e) => e.getAttribute('data-act')));
    expect(acoes).toContain('edit');
  });
});
