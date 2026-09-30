import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// O GitHub é a fonte da versão mais nova: quando o backup de lá muda por fora
// (outro navegador, ou uma revisão enviada direto para lá), o editor carrega
// sozinho — ao abrir, com a aba aberta, e quando um envio encontra o arquivo
// mudado — sem nunca gravar por cima dele. O que estava aberto vai para Versões.

type Doc = { pages: { sections: { blocks: { type: string; content: { text?: { pt: string } } }[] }[] }[] };

/** "GitHub" de mentira: guarda o arquivo atual, conta os envios (PUT). */
async function githubFalso(page: Page) {
  const estado = { sha: 'do-github-1', texto: '', envios: 0 };
  await page.route('https://api.github.com/**', (r) => {
    const req = r.request();
    if (req.method() === 'PUT') {
      const corpo = JSON.parse(req.postData() ?? '{}') as { sha?: string };
      if (corpo.sha && corpo.sha !== estado.sha) return r.fulfill({ status: 409, contentType: 'application/json', body: '{}' });
      estado.envios++;
      estado.sha = `enviado-${estado.envios}`;
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: estado.sha } }) });
    }
    const cru = (req.headers()['accept'] ?? '').includes('raw');
    return cru ? r.fulfill({ status: 200, contentType: 'text/plain', body: estado.texto }) : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha: estado.sha }) });
  });
  return estado;
}

/** Backup do documento aberto, com o 1º título trocado e salvo "depois". */
async function backupComTitulo(page: Page, titulo: string): Promise<string> {
  const baixou = page.waitForEvent('download');
  await page.locator('.tb-btn', { hasText: 'Backup' }).click();
  const backup = JSON.parse(readFileSync((await (await baixou).path())!, 'utf8')) as { savedAt: string; doc: Doc };
  backup.doc.pages.flatMap((p) => p.sections).flatMap((s) => s.blocks).find((b) => b.type === 'heading')!.content.text!.pt = titulo;
  backup.savedAt = new Date(Date.now() + 3_600_000).toISOString();
  return JSON.stringify(backup);
}

async function abrirComGitHub(page: Page) {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  await page.goto('/editor.html?fresh=1', { waitUntil: 'load' });
  const github = await githubFalso(page);
  github.texto = await backupComTitulo(page, 'Versão que veio do GitHub');
  await page.evaluate(() => localStorage.setItem('portfolio-v4:github-sync', JSON.stringify({ repo: 'eu/portfolio-backup', token: 't', path: 'portfolio-backup.json' })));
  // Reabre com o rascunho salvo neste navegador (mais velho que o do GitHub).
  await page.goto('/editor.html', { waitUntil: 'load' });
  return github;
}

test('ao abrir, carrega sozinho a versão mais nova do GitHub, sem gravar por cima dela', async ({ page }) => {
  const github = await abrirComGitHub(page);
  await expect(page.locator('.editor-canvas')).toContainText('Versão que veio do GitHub');
  await expect(page.locator('body')).toContainText('Carreguei a versão mais nova do GitHub');
  await expect(page.locator('.dialogo-confirmar')).toHaveCount(0); // não pergunta nada
  expect(github.envios).toBe(0); // o que estava aberto não subiu por cima
  expect(await page.evaluate(() => localStorage.getItem('portfolio-v4:github-sync-sha'))).toContain('do-github-1');
});

test('com o editor aberto: mudou no GitHub, carrega ao voltar para a aba; um envio que encontra o arquivo mudado carrega em vez de gravar', async ({ page }) => {
  await page.clock.install();
  const github = await abrirComGitHub(page);
  await expect(page.locator('.editor-canvas')).toContainText('Versão que veio do GitHub');

  // Outra revisão chega ao GitHub com o editor aberto.
  github.texto = await backupComTitulo(page, 'Segunda revisão do GitHub');
  github.sha = 'do-github-2';
  await page.clock.fastForward(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.editor-canvas')).toContainText('Segunda revisão do GitHub');

  // Terceira revisão, e desta vez é um envio automático que percebe (antes da conferência periódica).
  github.texto = await backupComTitulo(page, 'Terceira revisão do GitHub');
  github.sha = 'do-github-3';
  const antes = github.envios;
  await page.locator('.left-tabs button', { hasText: 'Dados' }).click();
  await page.locator('.data-table input[type=checkbox]').first().click(); // uma edição daqui, para ter o que enviar
  await page.locator('.sync-github button', { hasText: 'Enviar agora' }).click();
  await expect(page.locator('.editor-canvas')).toContainText('Terceira revisão do GitHub');
  expect(github.envios).toBe(antes); // não gravou por cima da revisão
});
