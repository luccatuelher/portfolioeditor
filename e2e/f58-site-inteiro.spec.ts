import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

/**
 * Guarda ampla do site publicado: publica e visita TODA página, todo projeto
 * e toda nota, em português e em inglês. Qualquer erro de JavaScript, seção
 * ou bloco com defeito, título vazio, idioma errado no <html> ou página sem
 * exatamente um <h1> derruba o teste — seja qual for a rota que quebrar.
 *
 * Publica num arquivo próprio (PUBLISH_OUTPUT) a partir do shell já gerado
 * (PUBLISH_SHELL): não disputa o dist/site.html com os outros testes.
 */
function publicar(fixture: string): string {
  const saida = resolve(mkdtempSync(resolve(tmpdir(), 'site-inteiro-')), 'index.html');
  execFileSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', 'vite.emit.config.ts'], {
    env: { ...process.env, PUBLISH_FIXTURE: fixture, PUBLISH_SHELL: 'src/publish/site-shell.html', PUBLISH_OUTPUT: saida },
    stdio: 'ignore',
  });
  return pathToFileURL(saida).href;
}

for (const fixture of ['template-v3.json', 'legacy-synthetic-v3.json']) {
  for (const lang of ['pt', 'en'] as const) {
    test(`todas as rotas abrem sem defeito — ${fixture} em ${lang.toUpperCase()}`, async ({ page }) => {
      const url = publicar(fixture);
      const erros: string[] = [];
      page.on('pageerror', (e) => erros.push(String(e)));
      await page.route(/youtube|youtu\.be|vimeo|speakerdeck|ytimg|fonts\.googleapis|fonts\.gstatic/, (r) => r.abort());
      // Só na página principal: nos iframes dos vídeos o localStorage é proibido.
      await page.addInitScript((l) => {
        if (window.top === window) localStorage.setItem('portfolio-lang', l);
      }, lang);
      await page.goto(url, { waitUntil: 'load' });

      const rotas = await page.evaluate(() => {
        type D = { pages: { id: string; slug: string; kind: string }[]; collections: { projects: { id: string }[]; blog: { id: string }[] } };
        const d = (window as unknown as { __PORTFOLIO_DATA__: D }).__PORTFOLIO_DATA__;
        return [
          ...d.pages.filter((p) => p.kind === 'static').map((p) => (p.id === 'home' ? '' : p.slug || p.id)),
          ...d.collections.projects.map((p) => `project/${p.id}`),
          ...d.collections.blog.map((b) => `blog/${b.id}`),
        ];
      });
      expect(rotas.length).toBeGreaterThan(3);

      for (const rota of rotas) {
        await page.evaluate((r) => { location.hash = r ? `#${r}` : '#'; }, rota);
        const main = page.locator(`main#conteudo[data-route="${rota || 'home'}"]`);
        await expect(main, `rota "${rota}" não abriu`).toBeVisible();
        const onde = `${fixture} · ${lang} · "${rota || 'home'}"`;
        await expect(page.locator('.secao-defeito, .block-defeito, .tela-de-erro'), `defeito em ${onde}`).toHaveCount(0);
        expect(await page.title(), `título vazio em ${onde}`).not.toBe('');
        expect(await page.evaluate(() => document.documentElement.lang), `lang em ${onde}`).toBe(lang === 'en' ? 'en' : 'pt-BR');
        expect(await page.locator('h1').count(), `h1 em ${onde}`).toBe(1);
      }
      expect(erros).toEqual([]);
    });
  }
}
