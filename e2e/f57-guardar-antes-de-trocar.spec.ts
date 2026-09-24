import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

// Importar/restaurar prometem guardar o que está aberto como versão. Se essa
// gravação falha, a troca não pode seguir calada — o trabalho sumiria sem cópia.
test('versão automática falhou: pergunta antes de trocar; cancelar mantém tudo', async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (key === 'editor-versions') throw new DOMException('cheio', 'QuotaExceededError');
      return put.call(this, value, key);
    };
  });
  page.on('dialog', () => { throw new Error('não devia abrir diálogo do navegador'); });
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  const nome = page.locator('.editor-canvas .site-header .header-name').first();
  const antes = (await nome.textContent()) ?? '';

  const importar = async (): Promise<void> => {
    await page.setInputFiles('.editor-topbar input[type=file]', resolve('fixtures/legacy-synthetic-v3.json'));
    await page.locator('.dialogo-confirmar .tb-btn.primary', { hasText: 'Importar' }).click();
  };

  await importar();
  const alerta = page.locator('.dialogo-confirmar', { hasText: 'Não consegui guardar o que está aberto' });
  await expect(alerta).toBeVisible();
  await alerta.locator('.tb-btn', { hasText: 'Cancelar' }).click();
  await expect(nome).toHaveText(antes);

  // Seguir mesmo assim: a pessoa decidiu, com o aviso na frente.
  await importar();
  await page.locator('.dialogo-confirmar .tb-btn.primary', { hasText: 'Seguir mesmo assim' }).click();
  await expect(nome).not.toHaveText(antes);
});

// A importação é gravada pelo autosave do editor que abre (o mesmo que avisa
// falha): recarregar mantém o que veio no arquivo.
test('importar e recarregar: o conteúdo importado continua', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck|ytimg|fonts\.googleapis/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  await page.setInputFiles('.editor-topbar input[type=file]', resolve('fixtures/legacy-synthetic-v3.json'));
  await page.locator('.dialogo-confirmar .tb-btn.primary', { hasText: 'Importar' }).click();
  await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
  await expect(page.locator('.editor-left')).toContainText('Projeto A');
  await expect(page.locator('.tb-status')).toHaveText('Salvo neste navegador');
  await page.goto('/editor.html', { waitUntil: 'load' });
  await page.locator('.left-tabs button', { hasText: 'Páginas' }).click();
  await expect(page.locator('.editor-left')).toContainText('Projeto A');
});
