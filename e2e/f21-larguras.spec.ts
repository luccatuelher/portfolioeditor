import { test, expect } from '@playwright/test';

/**
 * Junções entre as faixas de largura. Um site não pode ter degraus: passar de
 * 900 para 901 pixels não pode ENCOLHER a página, e um card com título não
 * pode cair para ~160px só porque a tela passou de 600.
 */
const medir = async (page: import('@playwright/test').Page, largura: number) => {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.goto('/preview.html?route=projects', { waitUntil: 'load' });
  await page.waitForSelector('.project-card');
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const cont = document.querySelector('main.container');
    const cards = [...document.querySelectorAll('.project-card')];
    const ys = cards.map((c) => Math.round(c.getBoundingClientRect().y));
    const ok = cards.length > 0 && cont;
    return {
      renderou: !!ok,
      container: cont ? Math.round(cont.getBoundingClientRect().width) : 0,
      porFila: ys.length ? ys.filter((y) => y === ys[0]).length : 0,
      larguraCard: cards[0] ? Math.round(cards[0].getBoundingClientRect().width) : 0,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
};

test('a página nunca encolhe quando a janela cresce', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  let anterior = 0;
  for (const w of [601, 640, 700, 768, 820, 900, 901, 1000, 1100, 1280]) {
    const m = await medir(page, w);
    expect(m.renderou, `a página nem renderizou em ${w}px — teste vazio`).toBe(true);
    expect(m.overflow, `rolagem lateral em ${w}px`).toBeLessThanOrEqual(1);
    expect(m.container, `a página encolheu de ${anterior} para ${m.container} ao ir para ${w}px`).toBeGreaterThanOrEqual(anterior - 2);
    anterior = m.container;
  }
});

test('card com título nunca fica estreito demais nas telas intermediárias', async ({ page }) => {
  await page.route(/youtube|vimeo|speakerdeck/, (r) => r.abort());
  for (const w of [601, 700, 768, 820, 900]) {
    const m = await medir(page, w);
    expect(m.renderou, `a página nem renderizou em ${w}px — teste vazio`).toBe(true);
    expect(m.larguraCard, `card de ${m.larguraCard}px em ${w}px de tela`).toBeGreaterThan(180);
  }
});
