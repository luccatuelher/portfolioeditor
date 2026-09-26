import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

/**
 * O site publicado responde enquanto o arquivo ainda chega. O index.html é
 * quase todo imagem; o runtime vem logo depois das fotos da Home e começa sem
 * esperar o resto. Aqui um servidor SEGURA o arquivo no meio — o visitante numa
 * rede lenta — e o site tem de: abrir um projeto pelo link, reservar o espaço
 * das fotos que faltam e, quando elas chegam, trocar a reserva pela foto. A
 * senha do NDA digitada antes de o pacote cifrado chegar espera por ele.
 */
function publicar(env: Record<string, string>): string {
  const saida = resolve(mkdtempSync(resolve(tmpdir(), 'responde-cedo-')), 'index.html');
  execFileSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', 'vite.emit.config.ts'], {
    env: { ...process.env, ...env, PUBLISH_SHELL: 'src/publish/site-shell.html', PUBLISH_OUTPUT: saida },
    stdio: 'ignore',
  });
  return readFileSync(saida, 'utf8');
}

/** Serve o HTML até `corte` e só manda o resto quando `soltar()` for chamado. */
async function servirComPausa(html: string, corte: number): Promise<{ url: string; soltar: () => void; fechar: () => void }> {
  let soltar!: () => void;
  const solto = new Promise<void>((ok) => (soltar = ok));
  const srv = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.write(html.slice(0, corte));
    void solto.then(() => res.end(html.slice(corte)));
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
  const { port } = srv.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/`, soltar, fechar: () => srv.close() };
}

async function semRedeExterna(page: Page): Promise<void> {
  await page.route(/youtube|youtu\.be|vimeo|speakerdeck|ytimg|fonts\.googleapis|fonts\.gstatic/, (r) => r.abort());
}

const RESERVA = 'data:image/svg+xml,%3Csvg';

test('com o arquivo pela metade: abre um projeto, reserva o espaço das fotos e as põe quando chegam', async ({ page }) => {
  const html = publicar({ PUBLISH_FIXTURE: 'template-v3.json' });
  // Pausa logo depois do runtime: as imagens de fora da Home ainda não vieram.
  const fimRuntime = html.indexOf('</script>', html.indexOf('<script type="module" async')) + '</script>'.length;
  expect(html.indexOf('<script type="module" async')).toBeGreaterThan(0);
  expect(html.indexOf('<script>__IMG__(', fimRuntime)).toBe(fimRuntime);
  const srv = await servirComPausa(html, fimRuntime);
  try {
    await semRedeExterna(page);
    await page.goto(srv.url, { waitUntil: 'commit' });

    // Um projeto com foto que ainda não chegou.
    const alvo = await page.waitForFunction(() => {
      const w = window as unknown as { __PORTFOLIO_DATA__?: { collections: { projects: { id: string }[] } }; __ASSETS__?: Record<string, string> };
      const d = w.__PORTFOLIO_DATA__;
      const chegou = w.__ASSETS__ ?? {};
      if (!d || !document.querySelector('script[type="module"]')) return null;
      const p = d.collections.projects.find((x) => [...JSON.stringify(x).matchAll(/"assetId":"([^"]+)"/g)].some((m) => !chegou[m[1]!]));
      return p?.id ?? null;
    });
    const id = (await alvo.jsonValue()) as string;
    await page.evaluate((r) => (location.hash = `#project/${r}`), id);
    await expect(page.locator(`main#conteudo[data-route="project/${id}"]`), 'o runtime não abriu o projeto antes do fim do arquivo').toBeVisible();
    expect(await page.evaluate(() => document.readyState)).toBe('loading');

    // As fotos que faltam têm o lugar reservado (altura > 0), não somem da página.
    const reservas = await page.evaluate((r) => [...document.querySelectorAll<HTMLImageElement>('main img')].filter((i) => i.src.startsWith(r)).map((i) => i.getBoundingClientRect().height), RESERVA);
    expect(reservas.length, 'nenhuma foto esperando com lugar reservado').toBeGreaterThan(0);
    for (const h of reservas) expect(h).toBeGreaterThan(0);

    srv.soltar();
    await page.waitForLoadState('load');
    await expect.poll(() => page.evaluate((r) => [...document.querySelectorAll<HTMLImageElement>('main img')].filter((i) => i.src.startsWith(r)).length, RESERVA)).toBe(0);
    const fotos = await page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>('main img')].filter((i) => i.src.startsWith('data:image/') && i.naturalWidth > 0).length);
    expect(fotos).toBeGreaterThan(0);
  } finally {
    srv.fechar();
  }
});

test('senha do NDA digitada antes de o pacote cifrado chegar: espera por ele e abre', async ({ page }) => {
  const html = publicar({ PUBLISH_FIXTURE: 'legacy-synthetic-v3.json', PUBLISH_NDA_PASSWORD: 'segredo123' });
  const corte = html.indexOf('<script>window.__NDA__=');
  expect(corte).toBeGreaterThan(html.indexOf('<script type="module" async'));
  const srv = await servirComPausa(html, corte);
  try {
    await semRedeExterna(page);
    await page.goto(srv.url, { waitUntil: 'commit' });
    // Antes do runtime, a Home pré-renderizada existe nos dois idiomas (uma escondida): o link visível.
    await page.locator('.site-header nav .nav-nda:visible').click();
    await page.locator('.nda-unlock input').fill('segredo123');
    await page.locator('.nda-unlock button').click();
    expect(await page.evaluate(() => document.readyState)).toBe('loading');
    await expect(page.locator('.nda-unlock-error')).toHaveCount(0);

    srv.soltar();
    const cartao = page.locator('.project-card', { hasText: 'Projeto B' });
    await expect(cartao).toBeVisible();
    // As imagens do NDA chegam como bytes e viram blob: URL (sem recodificar base64).
    await cartao.click();
    await expect(page.locator('main#conteudo[data-route^="project/"]')).toBeVisible();
    await expect(page.locator('main img[src^="blob:"]').first()).toBeAttached();
  } finally {
    srv.fechar();
  }
});
