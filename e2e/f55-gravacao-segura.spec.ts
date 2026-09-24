import { test, expect } from '@playwright/test';

test('duas abas do editor: as duas avisam; fechar uma tira o aviso da outra', async ({ context }) => {
  const a = await context.newPage();
  await a.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  const aviso = (p: typeof a) => p.locator('.editor-alerta', { hasText: 'aberto em outra aba' });
  await expect(aviso(a)).toHaveCount(0);
  const b = await context.newPage();
  await b.goto('/editor.html', { waitUntil: 'load' });
  await expect(aviso(a)).toBeVisible();
  await expect(aviso(b)).toBeVisible();
  await b.close();
  await expect(aviso(a)).toHaveCount(0);
});

test('imagens que não gravam (espaço cheio): aviso com backup, e gravar o texto depois não esconde a falha', async ({ page }) => {
  // Toda gravação das IMAGENS falha como "espaço cheio"; a do documento passa.
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (key === 'editor-assets') throw new DOMException('cheio', 'QuotaExceededError');
      return put.call(this, value, key);
    };
  });
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  const alerta = page.locator('.editor-alerta', { hasText: 'Não estou conseguindo salvar' });
  await expect(alerta).toBeVisible();
  await expect(alerta).toContainText('espaço deste navegador');
  await expect(alerta.locator('button', { hasText: 'Baixar backup' })).toBeVisible();

  // Edita o texto: o documento grava, mas a falha das imagens continua à vista.
  await page.locator('.editor-canvas .block-heading').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await page.waitForTimeout(1500);
  await expect(page.locator('.tb-status')).toHaveText('Falha ao salvar');
  await expect(alerta).toBeVisible();
});
