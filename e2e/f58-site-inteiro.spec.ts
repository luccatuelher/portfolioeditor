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
      }
      expect(erros).toEqual([]);
    });
  }
}
