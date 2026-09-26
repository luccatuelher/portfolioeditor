import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

/**
 * A Home já chega no idioma de quem visita, antes do runtime: a mesma regra
 * dele (escolha salva, senão o idioma do navegador). Aqui o site abre SEM o
 * runtime — é o que a pessoa vê enquanto ele não chega numa rede lenta.
 */
let url = '';
test.beforeAll(() => {
  const pasta = mkdtempSync(resolve(tmpdir(), 'idioma-antes-'));
  const saida = resolve(pasta, 'index.html');
  execFileSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', 'vite.emit.config.ts'], {
    env: { ...process.env, PUBLISH_FIXTURE: 'template-v3.json', PUBLISH_SHELL: 'src/publish/site-shell.html', PUBLISH_OUTPUT: saida },
    stdio: 'ignore',
  });
  const semRuntime = resolve(pasta, 'sem-runtime.html');
  writeFileSync(semRuntime, readFileSync(saida, 'utf8').replace(/<script type="module"[^>]*>[\s\S]*?<\/script>/g, ''));
  url = pathToFileURL(semRuntime).href;
});

async function visivel(page: Page): Promise<{ pt: boolean; en: boolean; lang: string; menu: string }> {
  return page.evaluate(() => {
    const ver = (l: string): boolean => !!(document.querySelector(`[data-prerender="${l}"]`) as HTMLElement | null)?.offsetParent;
    const alvo = document.querySelector<HTMLElement>(ver('en') ? '[data-prerender="en"]' : '[data-prerender="pt"]');
    return { pt: ver('pt'), en: ver('en'), lang: document.documentElement.lang, menu: alvo?.querySelector('.site-header nav')?.textContent ?? '' };
  });
}

test.describe('navegador em inglês', () => {
  test.use({ locale: 'en-US' });
  test('a Home aparece em inglês antes do runtime', async ({ page }) => {
    await page.goto(url, { waitUntil: 'load' });
    const v = await visivel(page);
    expect(v).toMatchObject({ pt: false, en: true, lang: 'en' });
    expect(v.menu).toMatch(/Projects/i);
  });

  test('quem já escolheu português (escolha salva) vê português', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('portfolio-lang', 'pt'));
    await page.goto(url, { waitUntil: 'load' });
    expect(await visivel(page)).toMatchObject({ pt: true, en: false, lang: 'pt-BR' });
  });
});

test.describe('navegador em português', () => {
  test.use({ locale: 'pt-BR' });
  test('a Home aparece em português; escolha salva de inglês vale mais', async ({ page }) => {
    await page.goto(url, { waitUntil: 'load' });
    const v = await visivel(page);
    expect(v).toMatchObject({ pt: true, en: false, lang: 'pt-BR' });
    expect(v.menu).toMatch(/Projetos/i);

    await page.evaluate(() => localStorage.setItem('portfolio-lang', 'en'));
    await page.reload({ waitUntil: 'load' });
    expect(await visivel(page)).toMatchObject({ pt: false, en: true, lang: 'en' });
  });
});
