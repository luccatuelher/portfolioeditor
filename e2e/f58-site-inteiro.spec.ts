import { test, expect } from '@playwright/test';
import { auditarAcessibilidade } from './helpers/axe';
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
function publicar(fixture: string, senhaNda?: string): string {
  const saida = resolve(mkdtempSync(resolve(tmpdir(), 'site-inteiro-')), 'index.html');
  execFileSync(process.execPath, [resolve('node_modules/vitest/vitest.mjs'), 'run', '--config', 'vite.emit.config.ts'], {
    env: { ...process.env, PUBLISH_FIXTURE: fixture, PUBLISH_SHELL: 'src/publish/site-shell.html', PUBLISH_OUTPUT: saida, ...(senhaNda ? { PUBLISH_NDA_PASSWORD: senhaNda } : {}) },
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
        // Toda foto que carrega reservou o espaço certo antes de chegar: tem
        // width/height, na proporção em que aparece (a página não pula).
        const semEspaco = await page.evaluate(async () => {
          const imgs = [...document.querySelectorAll<HTMLImageElement>('main img[src^="data:"]')];
          // As preguiçosas fora da tela nem começam a carregar: espera pouco, uma vez só.
          await Promise.race([Promise.all(imgs.map((i) => i.decode().catch(() => undefined))), new Promise((r) => setTimeout(r, 600))]);
          return imgs
            // Só onde a caixa é ditada pela foto (não num recorte nem num quadro de proporção fixa).
            .filter((i) => i.complete && i.naturalWidth > 0 && !i.closest('.img-crop') && getComputedStyle(i).objectFit === 'fill')
            .filter((i) => {
              const w = Number(i.getAttribute('width'));
              const h = Number(i.getAttribute('height'));
              if (!(w > 0 && h > 0)) return true;
              const r = i.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && Math.abs(r.width / r.height - w / h) > 0.02 * (w / h);
            })
            .map((i) => `${i.className || 'img'} ${i.getAttribute('width')}×${i.getAttribute('height')} (natural ${i.naturalWidth}×${i.naturalHeight})`);
        });
        expect(semEspaco, `imagem sem espaço reservado em ${onde}`).toEqual([]);
        // Todo texto visível legível (WCAG AA): 4,5:1, ou 3:1 no texto grande.
        // Só onde o fundo é cor sólida (sobre foto, o contraste depende da foto).
        const ilegiveis = await page.evaluate(() => {
          const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
          const rgba = (c: string): [number, number, number, number] => {
            ctx.clearRect(0, 0, 1, 1);
            ctx.fillStyle = '#000';
            ctx.fillStyle = c;
            ctx.fillRect(0, 0, 1, 1);
            const d = ctx.getImageData(0, 0, 1, 1).data;
            return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
          };
          const lum = ([r, g, b]: number[]): number => {
            const f = (v: number): number => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
            return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
          };
          const fundo = (el: Element): number[] | null => {
            for (let e: Element | null = el; e; e = e.parentElement) {
              const cs = getComputedStyle(e);
              if (cs.backgroundImage !== 'none') return null;
              const c = rgba(cs.backgroundColor);
              if (c[3] >= 0.99) return c;
              if (c[3] > 0) return null; // translúcido: depende do que está atrás
            }
            return rgba(getComputedStyle(document.body).backgroundColor);
          };
          const out: string[] = [];
          for (const el of document.querySelectorAll('#root *')) {
            const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
            if (!temTexto || el.closest('[aria-hidden="true"], .sr-only, .img-crop, iframe')) continue;
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (!r.width || !r.height || cs.visibility === 'hidden') continue;
            let opacidade = 1;
            for (let e: Element | null = el; e; e = e.parentElement) opacidade *= Number(getComputedStyle(e).opacity);
            const bg = fundo(el);
            if (!bg || opacidade < 0.05) continue;
            const fg = rgba(cs.color);
            const a = fg[3] * opacidade;
            const visto = [0, 1, 2].map((i) => fg[i]! * a + bg[i]! * (1 - a));
            const [hi, lo] = [lum(visto), lum(bg)].sort((x, y) => y - x);
            const razao = (hi! + 0.05) / (lo! + 0.05);
            const px = parseFloat(cs.fontSize);
            const grande = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
            if (razao < (grande ? 3 : 4.5)) out.push(`"${el.textContent!.trim().slice(0, 30)}" (${el.className || el.tagName}) ${razao.toFixed(2)}:1`);
          }
          return out;
        });
        expect(ilegiveis, `texto ilegível em ${onde}`).toEqual([]);
        await auditarAcessibilidade(page, onde);
      }
      expect(erros).toEqual([]);
    });
  }
}

test('menos movimento (preferência do sistema): o visualizador abre sem animação', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(publicar('template-v3.json'), { waitUntil: 'load' });
  await page.evaluate(() => { location.hash = '#gallery'; });
  await page.locator('.art-img-btn').first().click();
  const img = page.locator('.lightbox .lightbox-img');
  await expect(img).toBeVisible();
  expect(await img.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await page.keyboard.press('Escape');
  // A capa do card também não desliza ao passar o mouse.
  await page.evaluate(() => { location.hash = '#'; });
  const capa = page.locator('.card-thumb').first();
  expect(await capa.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  // Sem a preferência, as animações continuam lá (a regra não vale para todos).
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await capa.evaluate((el) => getComputedStyle(el).transitionDuration)).not.toBe('0s');
});

for (const lang of ['pt', 'en'] as const) {
  test(`endereço quebrado diz que não encontrou e oferece saídas — ${lang.toUpperCase()}`, async ({ page }) => {
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(String(e)));
    await page.addInitScript((l) => { if (window.top === window) localStorage.setItem('portfolio-lang', l); }, lang);
    await page.goto(publicar('template-v3.json'), { waitUntil: 'load' });
    const titulos = { 'project/nao-existe': ['Este projeto não está aqui', 'This project isn’t here'], 'blog/nao-existe': ['Esta nota não está aqui', 'This note isn’t here'], 'pagina-que-sumiu': ['Esta página não está aqui', 'This page isn’t here'] } as const;
    for (const [rota, [pt, en]] of Object.entries(titulos)) {
      await page.evaluate((r) => { location.hash = r; }, rota);
      const aviso = page.locator('.nao-encontrado');
      await expect(aviso, rota).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(lang === 'en' ? en : pt);
      expect(await page.title()).toContain(lang === 'en' ? en : pt);
      await auditarAcessibilidade(page, `endereço quebrado ${rota}`);
    }
    // Saída: o link para o início leva à Home de verdade.
    await page.locator('.nao-encontrado-saidas a').last().click();
    await expect(page.locator('main#conteudo[data-route="home"]')).toBeVisible();
    await expect(page.locator('.nao-encontrado')).toHaveCount(0);
    expect(erros).toEqual([]);
  });
}

test('link direto para um projeto confidencial: pede a senha ali mesmo e abre o projeto', async ({ page }) => {
  await page.goto(publicar('legacy-synthetic-v3.json', 'segredo123') + '#project/proj-b', { waitUntil: 'load' });
  const aviso = page.locator('.nao-encontrado');
  await expect(aviso).toBeVisible();
  await aviso.locator('.nda-unlock input').fill('segredo123');
  await aviso.locator('.nda-unlock button').click();
  // Destrancou: o mesmo endereço agora é o projeto.
  await expect(page.locator('main#conteudo[data-route="project/proj-b"] h1')).toContainText('Projeto B');
  await expect(page.locator('.nao-encontrado')).toHaveCount(0);
});
