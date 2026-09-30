import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Backup no GitHub mais novo que o rascunho (outro navegador, ou uma revisão
// enviada direto para lá): o editor pergunta ao abrir, ANTES de o envio
// automático gravar por cima, e carrega a versão do GitHub se pedir.
test('ao abrir, oferece a versão mais nova do GitHub e só envia depois da resposta', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });

  // O backup "do GitHub": o mesmo documento, com um título trocado e salvo depois.
  const baixou = page.waitForEvent('download');
  await page.locator('.tb-btn', { hasText: 'Backup' }).click();
  const backup = JSON.parse(readFileSync((await (await baixou).path())!, 'utf8')) as { savedAt: string; doc: { pages: { sections: { blocks: { type: string; content: { text?: { pt: string } } }[] }[] }[] } };
  const titulo = backup.doc.pages.flatMap((p) => p.sections).flatMap((s) => s.blocks).find((b) => b.type === 'heading')!;
  titulo.content.text!.pt = 'Versão que veio do GitHub';
  backup.savedAt = new Date(Date.now() + 3_600_000).toISOString();
  const remoto = JSON.stringify(backup);

  const envios: string[] = [];
  await page.route('https://api.github.com/**', (r) => {
    const req = r.request();
    if (req.method() === 'PUT') {
      envios.push(req.url());
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'enviado' } }) });
    }
    const cru = (req.headers()['accept'] ?? '').includes('raw');
    return cru ? r.fulfill({ status: 200, contentType: 'text/plain', body: remoto }) : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha: 'do-github' }) });
  });
  await page.evaluate(() => localStorage.setItem('portfolio-v4:github-sync', JSON.stringify({ repo: 'eu/portfolio-backup', token: 't', path: 'portfolio-backup.json' })));

  // Reabre com o rascunho salvo neste navegador (mais velho que o do GitHub).
  await page.goto('/editor.html', { waitUntil: 'load' });
  const pergunta = page.locator('.dialogo-confirmar');
  await expect(pergunta).toContainText('Tem uma versão mais nova no GitHub');
  expect(envios).toHaveLength(0); // nada gravado por cima enquanto pergunta

  await pergunta.locator('.tb-btn.primary').click();
  await expect(page.locator('.editor-canvas')).toContainText('Versão que veio do GitHub');
  await expect(page.locator('.dialogo-confirmar')).toHaveCount(0); // não pergunta de novo ao remontar
  expect(await page.evaluate(() => localStorage.getItem('portfolio-v4:github-sync-sha'))).toContain('do-github');
});
