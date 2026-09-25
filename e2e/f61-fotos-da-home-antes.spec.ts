import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

/**
 * As fotos da Home aparecem sem o runtime: cada uma chega no próprio <script>,
 * logo depois da Home pré-renderizada, e se põe no lugar sozinha. Aqui o site
 * publicado abre SEM o runtime (o script de módulo é retirado) — se alguma foto
 * da Home dependesse dele, ou do mapa inteiro de imagens, ficaria vazia.
 */
function publicarSemRuntime(): string {
  const pasta = mkdtempSync(resolve(tmpdir(), 'fotos-home-'));
  const saida = resolve(pasta, 'index.html');
  execFileSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', 'vite.emit.config.ts'], {
    env: { ...process.env, PUBLISH_FIXTURE: 'template-v3.json', PUBLISH_SHELL: 'src/publish/site-shell.html', PUBLISH_OUTPUT: saida },
    stdio: 'ignore',
  });
  const html = readFileSync(saida, 'utf8');
  const semRuntime = html.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>/g, '');
  expect(semRuntime.length).toBeLessThan(html.length);
  const arquivo = resolve(pasta, 'sem-runtime.html');
  writeFileSync(arquivo, semRuntime);
  return pathToFileURL(arquivo).href;
}

test('toda foto da Home aparece antes (e sem) o runtime, com o tamanho certo', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await page.route(/fonts\.googleapis|fonts\.gstatic|ytimg/, (r) => r.abort());
  await page.goto(publicarSemRuntime(), { waitUntil: 'load' });

  const fotos = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLImageElement>('#root img[data-asset]')].map((i) => ({
      id: i.dataset['asset'],
      src: (i.getAttribute('src') ?? '').slice(0, 11),
      w: i.getAttribute('width'),
    })),
  );
  expect(fotos.length).toBeGreaterThan(1);
  for (const f of fotos) {
    expect(f.src, `foto ${f.id} sem src`).toBe('data:image/');
    expect(Number(f.w), `foto ${f.id} sem largura`).toBeGreaterThan(0);
  }
  // O runtime, quando vier, encontra o mapa completo (Home + resto).
  const mapa = await page.evaluate(() => Object.keys((window as unknown as { __ASSETS__: Record<string, string> }).__ASSETS__).length);
  expect(mapa).toBeGreaterThan(new Set(fotos.map((f) => f.id)).size);
  expect(erros).toEqual([]);
});
