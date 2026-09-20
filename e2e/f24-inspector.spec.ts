import { test, expect } from '@playwright/test';

const selecionarPorLayers = async (page: import('@playwright/test').Page, nome: string): Promise<void> => {
  await page.locator('.left-tabs button', { hasText: 'Layers' }).click();
  await page.locator('.tree-row.blk').filter({ hasText: nome }).first().click();
};

/** Os rótulos são exibidos em caixa alta pelo CSS: comparação sem caixa. */
const camposDaAba = async (page: import('@playwright/test').Page, aba: string): Promise<string[]> => {
  await page.getByRole('button', { name: aba, exact: true }).click();
  await page.locator('.insp-body').waitFor();
  // Abre os grupos recolhidos, senão os campos de dentro não contam.
  const grupos = page.locator('.insp-group:not([open]) > summary');
  for (let i = await grupos.count(); i > 0; i--) await grupos.first().click();
  const textos = await page.locator('.insp-label').allInnerTexts();
  return textos.map((s) => s.trim().toLowerCase()).filter(Boolean);
};

test.describe('Inspector', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
    await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  });

  test('alinhamento aparece num lugar só (era em Conteúdo e em Layout)', async ({ page }) => {
    await selecionarPorLayers(page, 'Imagem');
    const conteudo = await camposDaAba(page, 'Conteúdo');
    const layout = await camposDaAba(page, 'Layout');
    expect(conteudo.filter((c) => c === 'alinhamento')).toHaveLength(0);
    expect(layout.filter((c) => c === 'alinhamento')).toHaveLength(1);
  });

  test('estilo de texto do tema só aparece em quem tem texto', async ({ page }) => {
    await selecionarPorLayers(page, 'Título');
    expect((await camposDaAba(page, 'Estilo')).join(' ')).toContain('estilo de texto');

    for (const semTexto of ['Imagem', 'Coleção', 'Storyboard', 'Vídeo']) {
      await selecionarPorLayers(page, semTexto);
      const estilo = await camposDaAba(page, 'Estilo');
      expect(estilo.join(' '), `${semTexto} não deveria oferecer estilo de texto`).not.toContain('estilo de texto');
      expect(estilo.join(' '), `${semTexto} perdeu a cor de fundo`).toContain('cor de fundo');
    }
  });

  test('todo tipo de elemento tem as mesmas ferramentas de layout', async ({ page }) => {
    for (const tipo of ['Imagem', 'Título', 'Coleção', 'Storyboard', 'Vídeo']) {
      await selecionarPorLayers(page, tipo);
      const layout = (await camposDaAba(page, 'Layout')).join(' ');
      expect(layout, `${tipo} sem largura por dispositivo`).toContain('largura · celular');
      expect(layout, `${tipo} sem espaço próprio`).toContain('acima');
    }
  });
});
